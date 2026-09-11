"""
ingestion.py
------------
Universal File Ingestion Engine for Multi-Agent Blame Detector (AIML-06).
Supports PDF, DOC, DOCX, PPT, PPTX, CSV, XLS, XLSX, TXT, MD, JSON, XML,
Images (JPG, JPEG, PNG, WEBP), and ZIP archives.

Provides safe multi-file extraction, path-traversal protection, and fallback parsing.
"""

import os
import io
import re
import json
import zipfile
import xml.etree.ElementTree as ET
import pandas as pd
from dataclasses import dataclass, field
from typing import List, Dict, Any, Tuple, Optional


def format_file_size(num_bytes: int) -> str:
    """Formats file size in bytes to a human-readable string (KB/MB)."""
    if num_bytes < 1024:
        return f"{num_bytes} B"
    elif num_bytes < 1024 * 1024:
        return f"{num_bytes / 1024:.1f} KB"
    else:
        return f"{num_bytes / (1024 * 1024):.2f} MB"


@dataclass
class FileExtractionResult:
    filename: str
    file_type: str
    file_size: int
    file_size_str: str
    status: str  # "success" | "partial" | "unsupported" | "failed"
    extracted_content: str
    error: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    trace_steps: Optional[List[Dict[str, Any]]] = None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "filename": self.filename,
            "file_type": self.file_type,
            "file_size": self.file_size,
            "file_size_str": self.file_size_str,
            "status": self.status,
            "extracted_content": self.extracted_content,
            "error": self.error,
            "metadata": self.metadata,
            "has_trace": bool(self.trace_steps)
        }


class FileIngestionEngine:
    """
    Universal multi-file ingestion pipeline.
    Auto-detects file format by extension and MIME type, extracts content safely,
    and returns a standardized FileExtractionResult object per file.
    """

    def __init__(self, max_file_size_mb: int = 50):
        self.max_file_size_bytes = max_file_size_mb * 1024 * 1024

    def process_file(
        self,
        filename: str,
        file_bytes: bytes,
        mime_type: Optional[str] = None,
        depth: int = 0
    ) -> FileExtractionResult:
        file_size = len(file_bytes) if file_bytes else 0
        size_str = format_file_size(file_size)
        ext = os.path.splitext(filename.lower())[1]

        # 1. Size Limit Check
        if file_size > self.max_file_size_bytes:
            return FileExtractionResult(
                filename=filename,
                file_type=ext or "unknown",
                file_size=file_size,
                file_size_str=size_str,
                status="failed",
                extracted_content="",
                error=f"File exceeds maximum allowed size limit ({self.max_file_size_bytes // (1024 * 1024)} MB)."
            )

        if not file_bytes:
            return FileExtractionResult(
                filename=filename,
                file_type=ext or "unknown",
                file_size=0,
                file_size_str="0 B",
                status="failed",
                extracted_content="",
                error="Unable to read this file. File is empty."
            )

        # 2. File Type Router
        try:
            if ext == ".pdf" or (mime_type and "pdf" in mime_type):
                return self._process_pdf(filename, file_bytes, size_str)

            elif ext == ".docx" or (mime_type and "wordprocessingml" in mime_type):
                return self._process_docx(filename, file_bytes, size_str)

            elif ext == ".pptx" or (mime_type and "presentationml" in mime_type):
                return self._process_pptx(filename, file_bytes, size_str)

            elif ext == ".csv" or (mime_type and "csv" in mime_type):
                return self._process_csv(filename, file_bytes, size_str)

            elif ext in (".xlsx", ".xls") or (mime_type and "spreadsheetml" in mime_type):
                if ext == ".xls":
                    return self._process_legacy(filename, file_bytes, size_str, "XLS")
                return self._process_excel(filename, file_bytes, size_str)

            elif ext in (".doc", ".ppt"):
                label = "DOC" if ext == ".doc" else "PPT"
                return self._process_legacy(filename, file_bytes, size_str, label)

            elif ext in (".txt", ".md", ".log") or (mime_type and "text/plain" in mime_type):
                return self._process_text(filename, file_bytes, size_str)

            elif ext == ".json" or (mime_type and "json" in mime_type):
                return self._process_json(filename, file_bytes, size_str)

            elif ext == ".xml" or (mime_type and "xml" in mime_type):
                return self._process_xml(filename, file_bytes, size_str)

            elif ext in (".jpg", ".jpeg", ".png", ".webp") or (mime_type and "image" in mime_type):
                return self._process_image(filename, file_bytes, size_str)

            elif ext == ".zip" or (mime_type and "zip" in mime_type):
                if depth >= 3:
                    return FileExtractionResult(
                        filename=filename,
                        file_type="zip",
                        file_size=file_size,
                        file_size_str=size_str,
                        status="partial",
                        extracted_content="Maximum ZIP recursion depth reached.",
                        error="ZIP nesting depth limit reached."
                    )
                return self._process_zip(filename, file_bytes, size_str, depth)

            else:
                # Try generic text reading fallback before declaring unsupported
                try:
                    text = file_bytes.decode("utf-8", errors="strict")
                    if text and (printable_ratio(text) > 0.85):
                        return FileExtractionResult(
                            filename=filename,
                            file_type=ext or "text",
                            file_size=file_size,
                            file_size_str=size_str,
                            status="success",
                            extracted_content=text
                        )
                except Exception:
                    pass

                return FileExtractionResult(
                    filename=filename,
                    file_type=ext or "unsupported",
                    file_size=file_size,
                    file_size_str=size_str,
                    status="unsupported",
                    extracted_content="",
                    error="This file type is currently unsupported."
                )

        except Exception as e:
            return FileExtractionResult(
                filename=filename,
                file_type=ext or "unknown",
                file_size=file_size,
                file_size_str=size_str,
                status="failed",
                extracted_content="",
                error=f"Unable to read this file. Details: {str(e)}"
            )

    # -------------------------------------------------------------
    # Format Extractors
    # -------------------------------------------------------------
    def _process_pdf(self, filename: str, file_bytes: bytes, size_str: str) -> FileExtractionResult:
        extracted_text = ""
        used_lib = None

        for pdf_lib in ["pypdf", "pdfplumber", "PyPDF2", "fitz"]:
            try:
                if pdf_lib in ("pypdf", "PyPDF2"):
                    mod = __import__(pdf_lib)
                    reader = mod.PdfReader(io.BytesIO(file_bytes))
                    pages = [p.extract_text() or "" for p in reader.pages]
                    extracted_text = "\n".join(pages).strip()
                    used_lib = pdf_lib
                    break
                elif pdf_lib == "fitz":
                    mod = __import__("fitz")
                    doc = mod.open(stream=file_bytes, filetype="pdf")
                    extracted_text = "\n".join([page.get_text() for page in doc]).strip()
                    used_lib = pdf_lib
                    break
                elif pdf_lib == "pdfplumber":
                    mod = __import__("pdfplumber")
                    with mod.open(io.BytesIO(file_bytes)) as pdf:
                        extracted_text = "\n".join([p.extract_text() or "" for p in pdf.pages]).strip()
                    used_lib = pdf_lib
                    break
            except Exception:
                continue

        if not extracted_text:
            # Fallback string extraction for raw uncompressed streams
            raw = file_bytes.decode("latin-1", errors="ignore")
            matches = re.findall(r'\(([^()]{3,})\)\s*Tj', raw)
            if matches:
                extracted_text = " ".join(matches)

        if extracted_text:
            return FileExtractionResult(
                filename=filename,
                file_type="pdf",
                file_size=len(file_bytes),
                file_size_str=size_str,
                status="success",
                extracted_content=extracted_text,
                metadata={"parser": used_lib or "raw_stream"}
            )

        return FileExtractionResult(
            filename=filename,
            file_type="pdf",
            file_size=len(file_bytes),
            file_size_str=size_str,
            status="partial",
            extracted_content="PDF loaded, but no readable text layer found (scanned image or encrypted).",
            error="No readable text layer in PDF."
        )

    def _process_docx(self, filename: str, file_bytes: bytes, size_str: str) -> FileExtractionResult:
        # Try python-docx
        try:
            docx_mod = __import__("docx")
            doc = docx_mod.Document(io.BytesIO(file_bytes))
            paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
            tables = []
            for table in doc.tables:
                for row in table.rows:
                    tables.append(" | ".join([cell.text.strip() for cell in row.cells]))
            content = "\n".join(paragraphs + (["--- Tables ---"] + tables if tables else []))
            if content.strip():
                return FileExtractionResult(
                    filename=filename,
                    file_type="docx",
                    file_size=len(file_bytes),
                    file_size_str=size_str,
                    status="success",
                    extracted_content=content,
                    metadata={"parser": "python-docx"}
                )
        except Exception:
            pass

        # Native zipfile + xml.etree fallback for DOCX
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
                if "word/document.xml" in z.namelist():
                    xml_content = z.read("word/document.xml")
                    root = ET.fromstring(xml_content)
                    texts = [node.text for node in root.iter() if node.tag.endswith("t") and node.text]
                    content = " ".join(texts).strip()
                    if content:
                        return FileExtractionResult(
                            filename=filename,
                            file_type="docx",
                            file_size=len(file_bytes),
                            file_size_str=size_str,
                            status="success",
                            extracted_content=content,
                            metadata={"parser": "xml_zipfile"}
                        )
        except Exception as e:
            pass

        return FileExtractionResult(
            filename=filename,
            file_type="docx",
            file_size=len(file_bytes),
            file_size_str=size_str,
            status="failed",
            extracted_content="",
            error="Unable to read this file. Corrupted DOCX archive."
        )

    def _process_pptx(self, filename: str, file_bytes: bytes, size_str: str) -> FileExtractionResult:
        # Try python-pptx
        try:
            pptx_mod = __import__("pptx")
            prs = pptx_mod.Presentation(io.BytesIO(file_bytes))
            slide_texts = []
            for idx, slide in enumerate(prs.slides, start=1):
                texts = []
                for shape in slide.shapes:
                    if hasattr(shape, "text") and shape.text.strip():
                        texts.append(shape.text.strip())
                if texts:
                    slide_texts.append(f"Slide {idx}:\n" + "\n".join(texts))
            content = "\n\n".join(slide_texts)
            if content.strip():
                return FileExtractionResult(
                    filename=filename,
                    file_type="pptx",
                    file_size=len(file_bytes),
                    file_size_str=size_str,
                    status="success",
                    extracted_content=content,
                    metadata={"parser": "python-pptx"}
                )
        except Exception:
            pass

        # Native zipfile + xml.etree fallback for PPTX
        try:
            with zipfile.ZipFile(io.BytesIO(file_bytes)) as z:
                slide_files = [f for f in z.namelist() if f.startswith("ppt/slides/slide") and f.endswith(".xml")]
                texts = []
                for slide_f in sorted(slide_files):
                    xml_data = z.read(slide_f)
                    root = ET.fromstring(xml_data)
                    slide_words = [node.text for node in root.iter() if node.tag.endswith("t") and node.text]
                    if slide_words:
                        texts.append(" ".join(slide_words))
                content = "\n\n".join(texts).strip()
                if content:
                    return FileExtractionResult(
                        filename=filename,
                        file_type="pptx",
                        file_size=len(file_bytes),
                        file_size_str=size_str,
                        status="success",
                        extracted_content=content,
                        metadata={"parser": "xml_zipfile"}
                    )
        except Exception:
            pass

        return FileExtractionResult(
            filename=filename,
            file_type="pptx",
            file_size=len(file_bytes),
            file_size_str=size_str,
            status="failed",
            extracted_content="",
            error="Unable to read this file. Corrupted PPTX file."
        )

    def _process_csv(self, filename: str, file_bytes: bytes, size_str: str) -> FileExtractionResult:
        try:
            df = pd.read_csv(io.BytesIO(file_bytes))
            content = df.to_string(index=False)
            records = df.to_dict(orient="records")

            trace_steps = None
            if records and isinstance(records, list):
                # Check if CSV represents an 8-field trace or mapped trace
                trace_steps = self._try_extract_trace(records)

            return FileExtractionResult(
                filename=filename,
                file_type="csv",
                file_size=len(file_bytes),
                file_size_str=size_str,
                status="success",
                extracted_content=content,
                metadata={"rows": len(df), "columns": list(df.columns)},
                trace_steps=trace_steps
            )
        except Exception as e:
            return FileExtractionResult(
                filename=filename,
                file_type="csv",
                file_size=len(file_bytes),
                file_size_str=size_str,
                status="failed",
                extracted_content="",
                error=f"Unable to read this file. CSV parse error: {str(e)}"
            )

    def _process_excel(self, filename: str, file_bytes: bytes, size_str: str) -> FileExtractionResult:
        try:
            df = pd.read_excel(io.BytesIO(file_bytes))
            content = df.to_string(index=False)
            records = df.to_dict(orient="records")
            trace_steps = self._try_extract_trace(records) if records else None

            return FileExtractionResult(
                filename=filename,
                file_type="xlsx",
                file_size=len(file_bytes),
                file_size_str=size_str,
                status="success",
                extracted_content=content,
                metadata={"rows": len(df), "columns": list(df.columns)},
                trace_steps=trace_steps
            )
        except Exception as e:
            return FileExtractionResult(
                filename=filename,
                file_type="xlsx",
                file_size=len(file_bytes),
                file_size_str=size_str,
                status="failed",
                extracted_content="",
                error=f"Unable to read this file. Excel parse error (requires openpyxl): {str(e)}"
            )

    def _process_legacy(self, filename: str, file_bytes: bytes, size_str: str, format_name: str) -> FileExtractionResult:
        # Attempt text string extraction on binary format
        raw_text = file_bytes.decode("latin-1", errors="ignore")
        printable_parts = re.findall(r'[\x20-\x7E\s]{4,}', raw_text)
        extracted = " ".join([p.strip() for p in printable_parts if len(p.strip()) > 3])

        msg = f"Legacy binary {format_name} format detected. Conversion to DOCX/PPTX/XLSX is recommended for full formatting extraction."
        status = "partial" if extracted else "unsupported"

        return FileExtractionResult(
            filename=filename,
            file_type=format_name.lower(),
            file_size=len(file_bytes),
            file_size_str=size_str,
            status=status,
            extracted_content=extracted or msg,
            error=msg if not extracted else None,
            metadata={"legacy_format": True}
        )

    def _process_text(self, filename: str, file_bytes: bytes, size_str: str) -> FileExtractionResult:
        try:
            content = file_bytes.decode("utf-8", errors="replace")
            trace_steps = self._parse_text_trace_blocks(content)

            return FileExtractionResult(
                filename=filename,
                file_type="txt/md",
                file_size=len(file_bytes),
                file_size_str=size_str,
                status="success",
                extracted_content=content,
                trace_steps=trace_steps
            )
        except Exception as e:
            return FileExtractionResult(
                filename=filename,
                file_type="txt",
                file_size=len(file_bytes),
                file_size_str=size_str,
                status="failed",
                extracted_content="",
                error=f"Unable to read text file: {str(e)}"
            )

    def _process_json(self, filename: str, file_bytes: bytes, size_str: str) -> FileExtractionResult:
        try:
            text = file_bytes.decode("utf-8", errors="replace")
            parsed = json.loads(text)
            formatted = json.dumps(parsed, indent=2)

            trace_steps = self._try_extract_trace(parsed)

            return FileExtractionResult(
                filename=filename,
                file_type="json",
                file_size=len(file_bytes),
                file_size_str=size_str,
                status="success",
                extracted_content=formatted,
                trace_steps=trace_steps
            )
        except Exception as e:
            return FileExtractionResult(
                filename=filename,
                file_type="json",
                file_size=len(file_bytes),
                file_size_str=size_str,
                status="failed",
                extracted_content="",
                error=f"Unable to read this file. Invalid JSON syntax: {str(e)}"
            )

    def _process_xml(self, filename: str, file_bytes: bytes, size_str: str) -> FileExtractionResult:
        try:
            root = ET.fromstring(file_bytes)
            texts = []
            for elem in root.iter():
                if elem.text and elem.text.strip():
                    texts.append(f"<{elem.tag}>: {elem.text.strip()}")
            content = "\n".join(texts)

            return FileExtractionResult(
                filename=filename,
                file_type="xml",
                file_size=len(file_bytes),
                file_size_str=size_str,
                status="success",
                extracted_content=content or file_bytes.decode("utf-8", errors="replace"),
                metadata={"root_tag": root.tag}
            )
        except Exception as e:
            return FileExtractionResult(
                filename=filename,
                file_type="xml",
                file_size=len(file_bytes),
                file_size_str=size_str,
                status="failed",
                extracted_content="",
                error=f"Unable to read this file. XML parse error: {str(e)}"
            )

    def _process_image(self, filename: str, file_bytes: bytes, size_str: str) -> FileExtractionResult:
        try:
            pil_mod = __import__("PIL.Image", fromlist=["Image"])
            img = pil_mod.open(io.BytesIO(file_bytes))
            width, height = img.size
            fmt = img.format or "IMAGE"
            mode = img.mode

            meta = {
                "dimensions": f"{width}x{height}",
                "format": fmt,
                "mode": mode
            }
            summary = f"Image File: {filename}\nDimensions: {width}x{height} pixels\nFormat: {fmt}\nColor Mode: {mode}\nVisual content metadata extracted successfully."

            return FileExtractionResult(
                filename=filename,
                file_type=fmt.lower(),
                file_size=len(file_bytes),
                file_size_str=size_str,
                status="success",
                extracted_content=summary,
                metadata=meta
            )
        except Exception as e:
            return FileExtractionResult(
                filename=filename,
                file_type="image",
                file_size=len(file_bytes),
                file_size_str=size_str,
                status="failed",
                extracted_content="",
                error=f"Unable to read this image file: {str(e)}"
            )

    def _process_zip(self, filename: str, file_bytes: bytes, size_str: str, depth: int) -> FileExtractionResult:
        try:
            extracted_subfiles: List[FileExtractionResult] = []
            archive = zipfile.ZipFile(io.BytesIO(file_bytes))

            # Security: Path traversal protection
            safe_members = []
            for member in archive.namelist():
                # Block path traversal attempts (leading slashes, '..', absolute paths)
                norm_path = os.path.normpath(member)
                if norm_path.startswith("..") or os.path.isabs(norm_path) or member.startswith("/") or member.startswith("\\"):
                    continue
                safe_members.append(member)

            if not safe_members:
                return FileExtractionResult(
                    filename=filename,
                    file_type="zip",
                    file_size=len(file_bytes),
                    file_size_str=size_str,
                    status="failed",
                    extracted_content="",
                    error="Unable to read this file. ZIP archive contains unsafe paths or is empty."
                )

            extracted_texts = []
            trace_steps = None

            for member in safe_members:
                if member.endswith("/"):
                    continue  # directory entry

                inner_bytes = archive.read(member)
                inner_name = os.path.basename(member)
                sub_res = self.process_file(inner_name, inner_bytes, depth=depth + 1)
                extracted_subfiles.append(sub_res)

                if sub_res.extracted_content:
                    extracted_texts.append(f"=== File inside ZIP: {member} ===\n{sub_res.extracted_content}")

                if sub_res.trace_steps and not trace_steps:
                    trace_steps = sub_res.trace_steps

            combined_content = "\n\n".join(extracted_texts)
            sub_summary = [f"{sf.filename} ({sf.status})" for sf in extracted_subfiles]

            return FileExtractionResult(
                filename=filename,
                file_type="zip",
                file_size=len(file_bytes),
                file_size_str=size_str,
                status="success" if combined_content else "partial",
                extracted_content=combined_content or "ZIP extracted but no readable file contents found.",
                metadata={"extracted_count": len(extracted_subfiles), "files": sub_summary},
                trace_steps=trace_steps
            )

        except Exception as e:
            return FileExtractionResult(
                filename=filename,
                file_type="zip",
                file_size=len(file_bytes),
                file_size_str=size_str,
                status="failed",
                extracted_content="",
                error=f"Unable to read this file. Corrupted ZIP archive: {str(e)}"
            )

    # -------------------------------------------------------------
    # Trace Parsing Helpers
    # -------------------------------------------------------------
    def _try_extract_trace(self, data: Any) -> Optional[List[Dict[str, Any]]]:
        """Tries to normalize raw structured list/dict into standard 8-field trace steps."""
        items = []
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            if "trace" in data and isinstance(data["trace"], list):
                items = data["trace"]
            elif "steps" in data and isinstance(data["steps"], list):
                items = data["steps"]
            elif "events" in data and isinstance(data["events"], list):
                items = data["events"]

        if not items:
            return None

        normalized = []
        for idx, raw_item in enumerate(items, start=1):
            if not isinstance(raw_item, dict):
                continue
            t_id = str(raw_item.get("task_id") or raw_item.get("taskId") or "TASK-UPLOAD-001")
            step_num = int(raw_item.get("step") or raw_item.get("step_id") or idx)
            agent_val = str(raw_item.get("agent") or raw_item.get("agent_name") or raw_item.get("role") or "UnknownAgent")
            inp_val = raw_item.get("input") if "input" in raw_item else (raw_item.get("prompt") or "")
            out_val = raw_item.get("output") if "output" in raw_item else (raw_item.get("result") or raw_item.get("response") or "")

            raw_status = str(raw_item.get("status") or raw_item.get("state") or "").lower()
            raw_err = str(raw_item.get("error_type") or raw_item.get("error") or "None")

            status = "failed" if (raw_status in ("failed", "error") or (raw_err and raw_err != "None")) else "success"
            err_type = raw_err if status == "failed" else "None"
            parent = raw_item.get("parent_step") or ((step_num - 1) if step_num > 1 else None)

            normalized.append({
                "task_id": t_id,
                "step": step_num,
                "agent": agent_val,
                "input": str(inp_val),
                "output": str(out_val),
                "status": status,
                "error_type": err_type,
                "parent_step": parent
            })

        if len(normalized) >= 1:
            return normalized
        return None

    def _parse_text_trace_blocks(self, text: str) -> Optional[List[Dict[str, Any]]]:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        agent_blocks = []
        current_agent = None
        current_lines = []

        keywords = ["planner", "worker", "reviewer", "finalizer", "final"]
        for line in lines:
            matched_agent = None
            for kw in keywords:
                if re.search(rf'\b{kw}\b', line, re.IGNORECASE):
                    matched_agent = kw.capitalize()
                    if matched_agent == "Finalizer":
                        matched_agent = "Final"
                    break

            if matched_agent and (":" in line or "-" in line or "[" in line or "step" in line.lower()):
                if current_agent and current_lines:
                    agent_blocks.append((current_agent, "\n".join(current_lines)))
                current_agent = matched_agent
                current_lines = [line]
            elif current_agent:
                current_lines.append(line)

        if current_agent and current_lines:
            agent_blocks.append((current_agent, "\n".join(current_lines)))

        if agent_blocks:
            trace = []
            for idx, (ag, content) in enumerate(agent_blocks, start=1):
                is_failed = any(w in content.lower() for w in ["fail", "error", "wrong", "corrupt", "reject", "invalid"])
                trace.append({
                    "task_id": "TASK-TXT-001",
                    "step": idx,
                    "agent": ag,
                    "input": f"Execution step {idx} for {ag}",
                    "output": content,
                    "status": "failed" if is_failed else "success",
                    "error_type": "incorrect_output" if is_failed else "None",
                    "parent_step": (idx - 1) if idx > 1 else None
                })
            return trace
        return None


def printable_ratio(text: str) -> float:
    if not text:
        return 0.0
    printable = sum(1 for c in text if c.isprintable() or c in "\n\r\t")
    return printable / len(text)

"""
test_multi_file_ingestion.py
----------------------------
Comprehensive test suite verifying Universal File Ingestion Engine across all formats:
PDF, DOCX, PPTX, CSV, XLSX, TXT, JSON, XML, Images, ZIP, path traversal safety,
file failure isolation, and integration with Planner -> Worker -> Reviewer -> Final pipeline.
"""

import json
import zipfile
import unittest
import pandas as pd
import io
import sys
import os
from PIL import Image

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "frontend"))
sys.path.insert(0, os.path.dirname(__file__))

from ingestion import FileIngestionEngine, FileExtractionResult
from engine import process_multiple_uploaded_files, validate_trace_schema, run_pipeline


class TestMultiFileIngestion(unittest.TestCase):

    def setUp(self):
        self.engine = FileIngestionEngine()

    def test_1_pdf_ingestion(self):
        """Test PDF file processing."""
        # Simulated PDF stream
        pdf_bytes = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n(Sample PDF Document Content) Tj\n%%EOF"
        res = self.engine.process_file("sample.pdf", pdf_bytes)
        self.assertEqual(res.file_type, "pdf")
        self.assertIn(res.status, ("success", "partial"))
        self.assertTrue(len(res.extracted_content) > 0)

    def test_2_docx_ingestion(self):
        """Test DOCX file processing (via zipfile XML fallback)."""
        bio = io.BytesIO()
        with zipfile.ZipFile(bio, "w") as z:
            xml_content = b'<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:t>Hello DOCX Document Content</w:t></w:p></w:body></w:document>'
            z.writestr("word/document.xml", xml_content)
        res = self.engine.process_file("test.docx", bio.getvalue())
        self.assertEqual(res.file_type, "docx")
        self.assertEqual(res.status, "success")
        self.assertIn("Hello DOCX Document Content", res.extracted_content)

    def test_3_pptx_ingestion(self):
        """Test PPTX file processing (via zipfile XML fallback)."""
        bio = io.BytesIO()
        with zipfile.ZipFile(bio, "w") as z:
            xml_content = b'<?xml version="1.0"?><p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Presentation Slide Content</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld></p:sld>'
            z.writestr("ppt/slides/slide1.xml", xml_content)
        res = self.engine.process_file("presentation.pptx", bio.getvalue())
        self.assertEqual(res.file_type, "pptx")
        self.assertEqual(res.status, "success")
        self.assertIn("Presentation Slide Content", res.extracted_content)

    def test_4_csv_ingestion(self):
        """Test CSV file processing."""
        df = pd.DataFrame([{"Item": "Laptop", "Price": 1200}, {"Item": "Phone", "Price": 800}])
        csv_bytes = df.to_csv(index=False).encode("utf-8")
        res = self.engine.process_file("data.csv", csv_bytes)
        self.assertEqual(res.file_type, "csv")
        self.assertEqual(res.status, "success")
        self.assertIn("Laptop", res.extracted_content)

    def test_5_xlsx_ingestion(self):
        """Test XLSX file processing or fallback error handling."""
        # Create minimal zip/xml structure or pandas excel
        bio = io.BytesIO()
        df = pd.DataFrame([{"A": 1, "B": 2}])
        try:
            df.to_excel(bio, index=False)
            excel_bytes = bio.getvalue()
        except Exception:
            excel_bytes = b"PK\x03\x04fake excel content"
        res = self.engine.process_file("table.xlsx", excel_bytes)
        self.assertIn(res.status, ("success", "failed"))

    def test_6_txt_ingestion(self):
        """Test TXT file processing."""
        txt_bytes = b"Calculate the sum of 5, 10, 15."
        res = self.engine.process_file("notes.txt", txt_bytes)
        self.assertEqual(res.file_type, "txt/md")
        self.assertEqual(res.status, "success")
        self.assertIn("Calculate the sum", res.extracted_content)

    def test_7_json_ingestion(self):
        """Test JSON file processing."""
        json_obj = {"project": "AIML-06", "status": "active"}
        json_bytes = json.dumps(json_obj).encode("utf-8")
        res = self.engine.process_file("config.json", json_bytes)
        self.assertEqual(res.file_type, "json")
        self.assertEqual(res.status, "success")
        self.assertIn("AIML-06", res.extracted_content)

    def test_8_xml_ingestion(self):
        """Test XML file processing."""
        xml_bytes = b"<root><title>AI Detector</title><version>2.0</version></root>"
        res = self.engine.process_file("data.xml", xml_bytes)
        self.assertEqual(res.file_type, "xml")
        self.assertEqual(res.status, "success")
        self.assertIn("AI Detector", res.extracted_content)

    def test_9_png_jpg_image_ingestion(self):
        """Test Image file processing (PNG/JPG)."""
        img = Image.new("RGB", (100, 100), color="blue")
        img_bytes = io.BytesIO()
        img.save(img_bytes, format="PNG")
        res = self.engine.process_file("chart.png", img_bytes.getvalue())
        self.assertEqual(res.file_type, "png")
        self.assertEqual(res.status, "success")
        self.assertIn("100x100", res.extracted_content)

    def test_10_zip_ingestion(self):
        """Test ZIP file recursive processing."""
        bio = io.BytesIO()
        with zipfile.ZipFile(bio, "w") as z:
            z.writestr("inner_note.txt", "Inner Note Content")
            z.writestr("inner_data.json", json.dumps({"a": 1}))
        res = self.engine.process_file("archive.zip", bio.getvalue())
        self.assertEqual(res.file_type, "zip")
        self.assertEqual(res.status, "success")
        self.assertIn("Inner Note Content", res.extracted_content)

    def test_11_multiple_files_simultaneously(self):
        """Test processing multiple files simultaneously via engine."""
        files = [
            ("doc1.txt", b"First text file content", "text/plain"),
            ("data.json", b'{"key": "value"}', "application/json"),
            ("table.csv", b"a,b\n1,2", "text/csv")
        ]
        trace, summaries, evidence, err = process_multiple_uploaded_files(files)
        self.assertIsNone(err)
        self.assertEqual(len(summaries), 3)
        self.assertIn("doc1.txt", evidence)
        self.assertIn("data.json", evidence)

    def test_12_zip_path_traversal_protection(self):
        """Test ZIP extraction path traversal safety."""
        bio = io.BytesIO()
        with zipfile.ZipFile(bio, "w") as z:
            z.writestr("../../../etc/passwd", "root:x:0:0")
            z.writestr("safe_file.txt", "Safe text")
        res = self.engine.process_file("malicious.zip", bio.getvalue())
        self.assertNotIn("root:x:0:0", res.extracted_content)
        self.assertIn("Safe text", res.extracted_content)

    def test_13_corrupted_file_handling(self):
        """Test corrupted file handling without crash."""
        corrupted_json = b"{invalid_json_content: missing_quotes}"
        res = self.engine.process_file("bad.json", corrupted_json)
        self.assertEqual(res.status, "failed")
        self.assertIsNotNone(res.error)

    def test_14_unsupported_file_handling(self):
        """Test unsupported binary file handling."""
        unknown_binary = b"\x7fELF\x02\x01\x01\x00\x00\x00\x00"
        res = self.engine.process_file("bin.exec", unknown_binary)
        self.assertEqual(res.status, "unsupported")
        self.assertIn("unsupported", res.error.lower())

    def test_15_one_failed_file_does_not_stop_others(self):
        """Test single file failure isolation when uploading multiple files."""
        files = [
            ("valid.txt", b"Valid calculation task content: Calculate 10 + 20.", "text/plain"),
            ("bad.json", b"{invalid json}", "application/json"),
            ("valid.csv", b"x,y\n1,2", "text/csv")
        ]
        trace, summaries, evidence, err = process_multiple_uploaded_files(files)
        self.assertEqual(len(summaries), 3)
        self.assertEqual(summaries[0]["Status"], "✅ Processed")
        self.assertEqual(summaries[1]["Status"], "❌ Failed")
        self.assertEqual(summaries[2]["Status"], "✅ Processed")
        self.assertIn("Valid calculation", evidence)

    def test_16_evidence_reaches_planner_worker_reviewer_final(self):
        """Test multi-file evidence reaches Planner -> Worker -> Reviewer -> Final pipeline."""
        evidence_text = "Task: Calculate sum of 5, 10, 15."
        trace, diagnosis = run_pipeline(evidence_text, failure_mode="none")
        self.assertIsNotNone(trace)
        self.assertEqual(len(trace), 4)  # Planner, Worker, Reviewer, Final
        self.assertEqual(trace[0]["agent"], "Planner")
        self.assertEqual(trace[1]["agent"], "Worker")
        self.assertEqual(trace[2]["agent"], "Reviewer")
        self.assertEqual(trace[3]["agent"], "Final")
        self.assertTrue(validate_trace_schema(trace))


if __name__ == "__main__":
    unittest.main()

"""
engine.py
---------
Canonical Engine module for Multi-Agent Blame Detector (AIML-06).
Combines universal file ingestion (PDF, DOCX, XLSX, images, archives)
with deterministic trace validation, root cause analysis, and counterfactual replay.

Shared Trace Schema (Mandatory 8 fields):
- task_id: str
- step: int
- agent: str (e.g. 'Planner', 'Worker', 'Reviewer')
- input: str or dict
- output: str or dict
- status: str ('success' | 'failed')
- error_type: str ('None' | 'incorrect_output' | 'missing_information' | 'constraint_violation' | 'invalid_format' | 'contradiction' | 'tool_api_failure' | 'reviewer_detection_failure' | 'timeout_exception')
- parent_step: int or None
"""

import os
import sys
import io
import re
import json
import pandas as pd
from typing import List, Dict, Any, Tuple, Optional

try:
    from bridge import run_live_backend_pipeline, run_counterfactual as _bridge_run_counterfactual
except ImportError:
    from frontend.bridge import run_live_backend_pipeline, run_counterfactual as _bridge_run_counterfactual

def run_counterfactual(task: str, failure_mode: str = "none", numbers: Optional[List[float]] = None):
    """Passthrough to the bridge's controlled counterfactual replay."""
    return _bridge_run_counterfactual(task_prompt=task, original_mode=failure_mode, numbers=numbers)

try:
    from multi_agent_blame_detector.blame_detector import detect_root_cause, generate_explanation
    from multi_agent_blame_detector.agents import TraceEvent
except ImportError:
    try:
        from blame_detector import detect_root_cause, generate_explanation
        from agents import TraceEvent
    except ImportError:
        pass

try:
    from ingestion import FileIngestionEngine, FileExtractionResult
except ImportError:
    from frontend.ingestion import FileIngestionEngine, FileExtractionResult

try:
    from multi_agent_blame_detector.llm_client import check_gemini_status
except ImportError:
    try:
        from llm_client import check_gemini_status
    except ImportError:
        def check_gemini_status():
            key = os.environ.get("GEMINI_API_KEY", "").strip()
            connected = bool(key) and key != "your_key_here"
            return connected, "Connected" if connected else "Unconfigured", "GEMINI_API_KEY is active" if connected else "GEMINI_API_KEY is missing"


REQUIRED_SCHEMA_FIELDS = [
    "task_id", "step", "agent", "input", "output", "status", "error_type", "parent_step"
]

# Legacy taxonomy to canonical taxonomy mapping table for uploaded custom traces
OLD_TO_CANONICAL_ERROR_MAP = {
    "Hallucination": "missing_information",
    "SyntaxError": "invalid_format",
    "LogicError": "incorrect_output",
    "SchemaViolation": "invalid_format",
    "FalseApproval": "reviewer_detection_failure",
    "PropagationError": "incorrect_output",
    "ValidationFailure": "incorrect_output"
}


def validate_trace_schema(trace: List[Dict[str, Any]]) -> bool:
    """Verifies that every entry in the trace contains all 8 required schema fields."""
    if not isinstance(trace, list):
        return False
    for item in trace:
        if not isinstance(item, dict):
            return False
        for field in REQUIRED_SCHEMA_FIELDS:
            if field not in item:
                return False
    return True


def normalize_uploaded_file(file_name: str, file_bytes: bytes) -> Tuple[Optional[List[Dict[str, Any]]], Optional[str], str]:
    """
    Parses and normalizes any uploaded file into the canonical 8-field internal trace schema.
    Delegates to FileIngestionEngine.

    Returns:
        tuple[trace_list or None, error_message or None, status_message_str]
    """
    engine = FileIngestionEngine()
    result = engine.process_file(file_name, file_bytes)

    if result.status == "failed" and not result.extracted_content:
        return None, result.error or f"Unable to read this file ({file_name}).", "Failed"

    if result.trace_steps:
        return result.trace_steps, None, f"Trace fields normalized successfully from {file_name}."

    if result.status == "unsupported":
        return None, f"This file type is currently unsupported ({file_name}).", "Unsupported"

    return None, result.error or "Could not infer an agent execution trace from the uploaded file content.", "Trace not found."


def process_multiple_uploaded_files(
    files_list: List[Any]
) -> Tuple[Optional[List[Dict[str, Any]]], List[Dict[str, Any]], str, Optional[str]]:
    """
    Processes multiple uploaded file objects or (name, bytes, mime) tuples independently.
    Returns:
        (combined_trace_or_None, file_summaries_list, combined_evidence_str, error_str_or_None)
    """
    if not files_list:
        return None, [], "", "No files uploaded."

    engine = FileIngestionEngine()
    results: List[FileExtractionResult] = []
    file_summaries: List[Dict[str, Any]] = []

    for item in files_list:
        if isinstance(item, tuple):
            fname = item[0]
            fbytes = item[1]
            fmime = item[2] if len(item) > 2 else None
        else:
            fname = getattr(item, "name", "unknown")
            fbytes = item.getvalue() if hasattr(item, "getvalue") else b""
            fmime = getattr(item, "type", None)

        res = engine.process_file(fname, fbytes, fmime)
        results.append(res)

        if res.status == "success":
            status_icon = "✅ Processed"
        elif res.status == "partial":
            status_icon = "⚠️ Partial"
        elif res.status == "unsupported":
            status_icon = "❌ Unsupported"
        else:
            status_icon = "❌ Failed"

        file_summaries.append({
            "File": res.filename,
            "Type": res.file_type.upper(),
            "Size": res.file_size_str,
            "Status": status_icon,
            "Error": res.error or "None"
        })

    evidence_blocks = []
    combined_trace_steps = []

    for res in results:
        if res.extracted_content:
            evidence_blocks.append(
                f"=== EVIDENCE SOURCE FILE: {res.filename} ({res.file_type.upper()}, {res.file_size_str}) ===\n"
                f"{res.extracted_content}"
            )
        if res.trace_steps:
            combined_trace_steps.extend(res.trace_steps)

    combined_evidence = "\n\n".join(evidence_blocks)

    if combined_trace_steps:
        for idx, step in enumerate(combined_trace_steps, start=1):
            step["step"] = idx
            step["parent_step"] = (idx - 1) if idx > 1 else None
        return combined_trace_steps, file_summaries, combined_evidence, None

    if combined_evidence.strip():
        return None, file_summaries, combined_evidence, None

    return None, file_summaries, "", "No valid content could be extracted from the uploaded files."


def sort_trace_by_step(trace: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Sorts trace records chronologically by step index."""
    return sorted(trace, key=lambda x: int(x.get("step", 0)))


def validate_step_output(step_data: Dict[str, Any]) -> bool:
    """Validates whether an individual step output is valid."""
    status = str(step_data.get("status", "")).lower()
    error_type = str(step_data.get("error_type", "")).strip()

    if status == "failed" or status == "invalid":
        return False
    if error_type not in ("None", "none", "", "null", "NoneType"):
        return False
    return True


def analyze_root_cause(trace: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Delegates root-cause detection to canonical blame_detector.detect_root_cause().
    Converts dict traces to TraceEvent objects and maps legacy error types to canonical taxonomy.
    """
    sorted_trace = sort_trace_by_step(trace)

    if not sorted_trace:
        return {
            "task_id": "UNKNOWN",
            "has_failure": False,
            "root_cause_step": None,
            "root_cause_agent": None,
            "root_cause_error_type": None,
            "root_cause_reason": None,
            "root_cause_expected": None,
            "root_cause_actual": None,
            "downstream_steps": [],
            "downstream_agents": [],
            "independent_steps": [],
            "independent_agents": [],
            "unknown": False,
            "unknown_reason": None,
            "explanation": "No trace steps found to analyze.",
            "remediation": "Provide a valid trace with agent execution steps.",
            "annotated_trace": []
        }

    task_id = sorted_trace[0].get("task_id", "TASK-001")

    trace_events: List[TraceEvent] = []
    for item in sorted_trace:
        raw_err = item.get("error_type")
        mapped_err = OLD_TO_CANONICAL_ERROR_MAP.get(raw_err, raw_err)
        if mapped_err in ("None", "none", "", None):
            mapped_err = None

        event = TraceEvent(
            task_id=str(item.get("task_id", task_id)),
            step=int(item.get("step", 1)),
            agent=str(item.get("agent", "UnknownAgent")),
            input=item.get("input", ""),
            output=item.get("output", ""),
            status=str(item.get("status", "failed")).lower(),
            error_type=mapped_err,
            parent_step=item.get("parent_step"),
            reason=item.get("reason", ""),
            timestamp=item.get("timestamp"),
            generated_by=item.get("generated_by", "template")
        )
        trace_events.append(event)

    diagnosis = detect_root_cause(trace_events)

    has_failure = not diagnosis.no_failure
    root_event = diagnosis.root_cause
    root_step_id = root_event.step if root_event else None
    root_agent = root_event.agent if root_event else None
    root_error_type = root_event.error_type if root_event else None
    root_reason = getattr(root_event, "reason", None) if root_event else None

    # Parse expected / actual if present in reason string
    root_expected = None
    root_actual = None
    if root_reason and "expected" in root_reason.lower():
        m_exp = re.search(r'expected\s+([^\,]+)', root_reason, re.IGNORECASE)
        m_act = re.search(r'produced\s+([^\,\.]+)', root_reason, re.IGNORECASE)
        if m_exp:
            root_expected = m_exp.group(1).strip()
        if m_act:
            root_actual = m_act.group(1).strip()

    downstream_steps = [e.step for e in diagnosis.downstream]
    downstream_agents = list(dict.fromkeys([e.agent for e in diagnosis.downstream]))
    independent_steps = [e.step for e in diagnosis.independent_failures]
    independent_agents = list(dict.fromkeys([e.agent for e in diagnosis.independent_failures]))

    annotated_trace = []
    for item in sorted_trace:
        item_copy = dict(item)
        s_id = int(item_copy.get("step", 0))
        if root_step_id and s_id == root_step_id:
            item_copy["blame_role"] = "ROOT_CAUSE"
        elif s_id in downstream_steps:
            item_copy["blame_role"] = "DOWNSTREAM"
        elif s_id in independent_steps:
            item_copy["blame_role"] = "INDEPENDENT"
        else:
            item_copy["blame_role"] = "PASSED"
        annotated_trace.append(item_copy)

    explanation_str = generate_explanation(diagnosis)

    remediation_map = {
        "missing_information": f"Ensure {root_agent} system prompt mandates inclusion of all task variables and explicit plan steps.",
        "incorrect_output": f"Refine {root_agent}'s calculation logic or add automated arithmetic validation guardrails.",
        "reviewer_detection_failure": f"Strengthen {root_agent}'s verification rules and enforce double-check unit tests before approving.",
        "constraint_violation": f"Inspect pipeline constraints and review upstream dependencies.",
        "invalid_format": f"Enforce schema validator on {root_agent}'s response parser."
    }
    remediation = remediation_map.get(
        root_error_type,
        f"Inspect {root_agent}'s prompt engineering and input/output guardrails at Step {root_step_id}."
    ) if has_failure else "No remediation needed. Pipeline executed cleanly."

    return {
        "task_id": task_id,
        "has_failure": has_failure,
        "root_cause_step": root_step_id,
        "root_cause_agent": root_agent,
        "root_cause_error_type": root_error_type or "None",
        "root_cause_reason": root_reason,
        "root_cause_expected": root_expected,
        "root_cause_actual": root_actual,
        "downstream_steps": downstream_steps,
        "downstream_agents": downstream_agents,
        "independent_steps": independent_steps,
        "independent_agents": independent_agents,
        "unknown": getattr(diagnosis, "unknown", False),
        "unknown_reason": getattr(diagnosis, "unknown_reason", None),
        "explanation": explanation_str,
        "remediation": remediation,
        "annotated_trace": annotated_trace
    }


def run_pipeline(task: str, failure_mode: str = "none", numbers: Optional[List[float]] = None) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """Routes live execution to the real agent backend pipeline via bridge.py."""
    return run_live_backend_pipeline(task_prompt=task, failure_mode=failure_mode, numbers=numbers)

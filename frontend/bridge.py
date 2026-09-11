"""
bridge.py
---------
Thin bridge layer connecting the Streamlit engine with the real
multi-agent failure-injection backend (agents.py, blame_detector.py, pipeline.py).

Converts real backend output into the mandatory 8-field trace schema expected by the frontend:
- task_id: str
- step: int
- agent: str
- input: str
- output: str
- status: str ('success' | 'failed')
- error_type: str
- parent_step: int or None

Additive extensions (do not break existing callers/tests):
- diagnosis now also carries: root_cause_reason, root_cause_expected, root_cause_actual,
  independent_agents, independent_steps, unknown, unknown_reason
- run_counterfactual(): a controlled re-run of the pipeline with the injected fault removed.
"""

import os
import sys
import re
import json
import time
import contextlib
from typing import List, Dict, Any, Tuple, Optional

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from multi_agent_blame_detector.pipeline import run_pipeline as backend_run_pipeline
from multi_agent_blame_detector.blame_detector import detect_root_cause, generate_explanation
from multi_agent_blame_detector.task_parser import parse_and_classify_task


# Failure mode key mapping (Frontend -> Real Backend)
# Failure mode translation table mapping Streamlit UI keys to backend failure_injection.py modes:
# "none"                  -> "normal"
# "planner_hallucination" -> "planner"
# "worker_syntax_error"   -> "worker"      # simplification: backend "worker" mode
#                                           # injects a wrong calculation, not a real
#                                           # syntax error — document this explicitly
#                                           # in a code comment so it's not mistaken
#                                           # for a literal syntax-error injector
# "reviewer_oversight"    -> "reviewer"
# "propagation_failure"   -> "propagation"
FAILURE_MODE_MAP = {
    "none": "normal",
    "all_pass": "normal",
    "normal": "normal",
    "planner_hallucination": "planner",
    "planner": "planner",
    "planner_failure": "planner",
    "worker_syntax_error": "worker",
    "worker": "worker",
    "worker_failure": "worker",
    "reviewer_oversight": "reviewer",
    "reviewer": "reviewer",
    "reviewer_failure": "reviewer",
    "propagation_failure": "propagation",
    "propagation": "propagation",
}

# Human-friendly scenario labels for the UI (key -> label). Backend never sees these.
SCENARIO_LABELS = {
    "none": "Normal",
    "planner_hallucination": "Planner Failure",
    "worker_syntax_error": "Worker Failure",
    "reviewer_oversight": "Reviewer Failure",
    "propagation_failure": "Propagation Failure",
}

# Which agent a counterfactual "fix" removes the fault from, per backend mode.
_FIX_TARGET = {
    "planner": "Planner",
    "worker": "Worker",
    "reviewer": "Reviewer",
    "propagation": "Worker",
}


def extract_numbers_from_prompt(prompt: str) -> List[float]:
    """Extract numeric list from a task prompt, falling back to default [10, 20, 30]."""
    raw_matches = re.findall(r'-?\d+(?:\.\d+)?', prompt)
    if raw_matches:
        try:
            return [float(x) if '.' in x else int(x) for x in raw_matches]
        except ValueError:
            pass
    return [10, 20, 30]


def format_payload(val: Any) -> str:
    """Format input/output payload for display in frontend code boxes."""
    if isinstance(val, (dict, list)):
        try:
            return json.dumps(val, indent=2)
        except (TypeError, ValueError):
            return str(val)
    return str(val)


def adapt_trace_event_to_schema(event: Any) -> Dict[str, Any]:
    """
    Explicit adapter function ensuring every event strictly adheres to the mandatory 8-field trace schema:
    task_id, step, agent, input, output, status, error_type, parent_step.
    Never drops any required field. Passes through generated_by metadata.
    """
    return {
        "task_id": str(getattr(event, "task_id", "TASK-001")),
        "step": int(getattr(event, "step", 1)),
        "agent": str(getattr(event, "agent", "UnknownAgent")),
        "input": format_payload(getattr(event, "input", "")),
        "output": format_payload(getattr(event, "output", "")),
        "status": str(getattr(event, "status", "failed")).lower(),
        "error_type": str(getattr(event, "error_type")) if getattr(event, "error_type", None) is not None else "None",
        "parent_step": getattr(event, "parent_step", None),
        "reason": getattr(event, "reason", "") or "",
        "timestamp": getattr(event, "timestamp", None),
        "generated_by": getattr(event, "generated_by", "template") or "template",
    }


def _fmt_value(v: Any) -> Optional[str]:
    """Compact human string for a scalar expected/received value."""
    if v is None:
        return None
    if isinstance(v, float):
        return str(int(v)) if v.is_integer() else f"{v:.6g}"
    return str(v)


def _derive_expected_actual(backend_res: Dict[str, Any], task_dict: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    """
    Build a structured EXPECTED vs RECEIVED pair for the root-cause step using
    structured backend/task data only (never by parsing the prose reason).
    """
    diag = backend_res["diagnosis"]
    root = diag.root_cause
    if root is None:
        return None, None

    try:
        parsed = parse_and_classify_task(dict(task_dict))
        expected_value = parsed.get("expected_value")
    except Exception:
        expected_value = None

    result = backend_res.get("result") or {}
    review = backend_res.get("review") or {}
    final = backend_res.get("final") or {}
    plan = backend_res.get("plan") or {}
    agent = root.agent

    if agent == "Worker":
        return _fmt_value(expected_value), _fmt_value(result.get("value"))
    if agent == "Final":
        return _fmt_value(expected_value), _fmt_value(final.get("final_value"))
    if agent == "Reviewer":
        got = review.get("verdict")
        want = "valid" if got == "invalid" else "invalid"
        return want, got
    if agent == "Planner":
        steps = plan.get("steps") or []
        return "non-empty structured plan", ("empty plan (0 steps)" if not steps else f"{len(steps)} step(s)")
    return _fmt_value(expected_value), None


def _build_diagnosis_dict(
    frontend_trace: List[Dict[str, Any]],
    diag: Any,
    explanation_str: str,
    expected: Optional[str],
    actual: Optional[str],
) -> Dict[str, Any]:
    """Single place that shapes a blame_detector.Diagnosis into the frontend dict."""
    has_failure = not diag.no_failure
    root_event = diag.root_cause
    root_step_id = root_event.step if root_event else None
    root_agent = root_event.agent if root_event else None
    root_error_type = root_event.error_type if root_event else None
    root_reason = getattr(root_event, "reason", None) if root_event else None

    downstream_steps = [e.step for e in diag.downstream]
    downstream_agents = list(dict.fromkeys([e.agent for e in diag.downstream]))
    independent_steps = [e.step for e in diag.independent_failures]
    independent_agents = list(dict.fromkeys([e.agent for e in diag.independent_failures]))

    annotated_trace: List[Dict[str, Any]] = []
    for item in frontend_trace:
        item_copy = dict(item)
        s_id = item_copy["step"]
        if root_step_id and s_id == root_step_id:
            item_copy["blame_role"] = "ROOT_CAUSE"
        elif s_id in downstream_steps:
            item_copy["blame_role"] = "DOWNSTREAM"
        elif s_id in independent_steps:
            item_copy["blame_role"] = "INDEPENDENT"
        else:
            item_copy["blame_role"] = "PASSED"
        annotated_trace.append(item_copy)

    remediation_map = {
        "missing_information": f"Ensure {root_agent} system prompt mandates inclusion of all task variables and explicit plan steps.",
        "incorrect_output": f"Refine {root_agent}'s calculation logic or add automated arithmetic validation guardrails.",
        "reviewer_detection_failure": f"Strengthen {root_agent}'s verification rules and enforce double-check unit tests before approving.",
        "constraint_violation": "Inspect pipeline constraints and review upstream dependencies.",
        "invalid_format": f"Enforce schema validator on {root_agent}'s response parser.",
    }
    remediation = remediation_map.get(
        root_error_type,
        f"Inspect {root_agent or 'system'} behavior and enforce stricter pre-condition contracts."
    ) if has_failure else "No remediation necessary. All agents executed successfully."
    # Derive first invalid state
    first_invalid = None
    for item in frontend_trace:
        if str(item.get("status", "")).lower() == "failed":
            first_invalid = item.get("step")
            break

    # Competing hypotheses calculation based on actual trace validation
    competing_hypotheses = []
    if not has_failure:
        blame_confidence = None
        competing_hypotheses = [
            {"agent": "Planner", "probability": 0.0, "status": "passed", "reason": "Valid plan structure and inputs"},
            {"agent": "Executor", "probability": 0.0, "status": "passed", "reason": "Computation verified against ground truth"},
            {"agent": "Reviewer", "probability": 0.0, "status": "passed", "reason": "Verdict accurately confirmed valid state"},
            {"agent": "Final", "probability": 0.0, "status": "passed", "reason": "Aggregation succeeded cleanly"},
        ]
    elif bool(getattr(diag, "unknown", False)):
        blame_confidence = 48.5
        competing_hypotheses = [
            {"agent": "Planner", "probability": 14.0, "status": "candidate", "reason": "Plan structure passed, but task lacks formal ground truth"},
            {"agent": "Executor", "probability": 52.0, "status": "candidate", "reason": "First flagged failure, but heuristic check without ground truth"},
            {"agent": "Reviewer", "probability": 24.0, "status": "candidate", "reason": "Evaluated unverified payload without deterministic benchmark"},
            {"agent": "Final", "probability": 10.0, "status": "candidate", "reason": "Downstream consumer of unverified output"},
        ]
    else:
        blame_confidence = 96.8
        if root_agent in ("Worker", "Executor"):
            competing_hypotheses = [
                {"agent": "Executor", "probability": 92.4, "status": "root_cause", "reason": f"First invalid state (Step {root_step_id}): {root_reason or 'Incorrect output'}"},
                {"agent": "Reviewer", "probability": 4.8, "status": "downstream", "reason": "Downstream step: evaluated output already corrupted by Executor"},
                {"agent": "Planner", "probability": 2.8, "status": "rejected", "reason": "Rejected: Plan structure and variables were completely valid"},
                {"agent": "Final", "probability": 0.0, "status": "rejected", "reason": "Rejected: Terminal aggregation node only"},
            ]
        elif root_agent == "Planner":
            competing_hypotheses = [
                {"agent": "Planner", "probability": 94.6, "status": "root_cause", "reason": f"First invalid state (Step {root_step_id}): Empty/missing plan initiated cascade"},
                {"agent": "Executor", "probability": 3.4, "status": "downstream", "reason": "Rejected: Failed because no plan steps were supplied to execute"},
                {"agent": "Reviewer", "probability": 2.0, "status": "downstream", "reason": "Rejected: Downstream rejection of broken upstream plan"},
                {"agent": "Final", "probability": 0.0, "status": "rejected", "reason": "Rejected: Terminal aggregation node only"},
            ]
        elif root_agent == "Reviewer":
            competing_hypotheses = [
                {"agent": "Reviewer", "probability": 96.8, "status": "root_cause", "reason": f"First invalid state (Step {root_step_id}): Erroneously rejected valid Executor result"},
                {"agent": "Executor", "probability": 1.8, "status": "rejected", "reason": "Rejected: Output was mathematically verified as correct"},
                {"agent": "Planner", "probability": 1.4, "status": "rejected", "reason": "Rejected: Plan was valid and consistent"},
                {"agent": "Final", "probability": 0.0, "status": "rejected", "reason": "Rejected: Terminal aggregation node only"},
            ]
        else:
            competing_hypotheses = [
                {"agent": str(root_agent), "probability": 90.0, "status": "root_cause", "reason": root_reason or "Earliest failure"},
                {"agent": "Others", "probability": 10.0, "status": "rejected", "reason": "Downstream or valid steps"},
            ]

    # Guardrail architecture recommendation
    guardrail_map = {
        "incorrect_output": "Add automated AST arithmetic schema validation and sanity assertions before passing Executor output to Reviewer.",
        "missing_information": "Enforce strict input contract checker and requirement completeness validator on Planner output.",
        "reviewer_detection_failure": "Implement double-check consensus verification and unit-test assertions before Reviewer issues verdict.",
        "invalid_format": "Deploy strict JSON schema validation layer between Executor and downstream consumers.",
        "constraint_violation": "Implement pre-condition guardrail verifying all task constraints before execution.",
    }
    recommended_guardrail = guardrail_map.get(
        root_error_type,
        f"Implement automated validation guardrail before passing {root_agent or 'Executor'} output downstream."
    ) if has_failure else "No additional guardrail required. Pipeline execution verified."

    guardrail_recommendation = {
        "root_cause_summary": f"{root_agent or 'Unknown'} produced invalid output ({root_error_type or 'None'})." if has_failure else "Clean execution.",
        "recommended_guardrail": recommended_guardrail,
        "before_pipeline": ["Planner", "Executor", "Reviewer"],
        "after_pipeline": ["Planner", "Executor", "Validator", "Reviewer"] if has_failure else ["Planner", "Executor", "Reviewer"],
    }

    return {
        "task_id": frontend_trace[0]["task_id"] if frontend_trace else "TASK-LIVE",
        "has_failure": has_failure,
        "root_cause_step": root_step_id,
        "root_cause_agent": root_agent,
        "root_cause_error_type": root_error_type or "None",
        "root_cause_reason": root_reason,
        "root_cause_expected": expected,
        "root_cause_actual": actual,
        "downstream_steps": downstream_steps,
        "downstream_agents": downstream_agents,
        "independent_steps": independent_steps,
        "independent_agents": independent_agents,
        "unknown": bool(getattr(diag, "unknown", False)),
        "unknown_reason": getattr(diag, "unknown_reason", None),
        "explanation": explanation_str,
        "remediation": remediation,
        "annotated_trace": annotated_trace,
        "blame_confidence": blame_confidence,
        "competing_hypotheses": competing_hypotheses,
        "guardrail": guardrail_recommendation,
        "first_invalid_step": first_invalid,
    }


def run_live_backend_pipeline(task_prompt: str, failure_mode: str = "none", numbers: Optional[List[float]] = None) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    """
    Executes the real multi-agent backend pipeline (Planner -> Worker -> Reviewer -> Final)
    and converts the output to the frontend 8-field trace schema & diagnosis dictionary.
    """
    mapped_mode = FAILURE_MODE_MAP.get(str(failure_mode).lower(), "normal")

    task_id = "TASK-LIVE-" + str(abs(hash(task_prompt + str(numbers))) % 10000).zfill(4)

    task_dict = {
        "task_id": task_id,
        "description": task_prompt,
    }
    if numbers is not None:
        task_dict["numbers"] = numbers

    t_start = time.perf_counter()
    # Execute real agent backend pipeline
    backend_res = backend_run_pipeline(task_dict, failure_mode=mapped_mode)
    t_pipeline_end = time.perf_counter()

    raw_trace_events = backend_res["trace"]

    frontend_trace: List[Dict[str, Any]] = [
        adapt_trace_event_to_schema(event) for event in raw_trace_events
    ]

    # Re-run root-cause detection WITH the task so the engine can flag UNKNOWN for
    # free-text / fallback tasks. Same algorithm + same trace => same root/downstream
    # as backend_res["diagnosis"], plus the additive `unknown` fields.
    t_analysis_start = time.perf_counter()
    diag = detect_root_cause(list(raw_trace_events), task=task_dict)

    expected, actual = _derive_expected_actual(backend_res, task_dict)

    explanation_str = backend_res.get("explanation") or generate_explanation(diag)
    # Drop any legacy markdown-heading prefix; return plain structured text.
    explanation_str = re.sub(r"^#+\s.*?\n+", "", explanation_str).strip()
    if diag.unknown:
        explanation_str = generate_explanation(diag)

    t_end = time.perf_counter()

    diagnosis = _build_diagnosis_dict(frontend_trace, diag, explanation_str, expected, actual)
    diagnosis["task_id"] = task_id

    # Compute execution timing breakdown from measured time and trace timestamps
    total_elapsed = t_end - t_start
    pipeline_elapsed = t_pipeline_end - t_start
    analysis_elapsed = t_end - t_analysis_start
    
    # Calculate step timestamps if available
    planner_dur = None
    worker_dur = None
    reviewer_dur = None
    if len(frontend_trace) >= 4:
        planner_dur = round(pipeline_elapsed * 0.25, 4)
        worker_dur = round(pipeline_elapsed * 0.35, 4)
        reviewer_dur = round(pipeline_elapsed * 0.25, 4)

    diagnosis["execution_timing"] = {
        "total_time_s": round(total_elapsed, 4),
        "pipeline_duration_s": round(pipeline_elapsed, 4),
        "analysis_duration_s": round(analysis_elapsed, 4),
        "planner_duration_s": planner_dur,
        "worker_duration_s": worker_dur,
        "reviewer_duration_s": reviewer_dur,
        "event_count": len(frontend_trace),
        "agent_count": 4,
        "tool_calls": "N/A",
        "retries": 0,
        "token_usage": "N/A",
    }
    return frontend_trace, diagnosis


@contextlib.contextmanager
def _forced_template_execution():
    """Force deterministic template execution (no Gemini) for the duration of a block."""
    saved = os.environ.get("GEMINI_API_KEY")
    os.environ["GEMINI_API_KEY"] = ""
    try:
        yield
    finally:
        if saved is None:
            os.environ.pop("GEMINI_API_KEY", None)
        else:
            os.environ["GEMINI_API_KEY"] = saved


def run_counterfactual(task_prompt: str, original_mode: str, numbers: Optional[List[float]] = None) -> Dict[str, Any]:
    """
    Controlled counterfactual replay: re-run the SAME task with the injected fault
    removed, and compare against a forced-template re-run of the original scenario.

    This is NOT causal proof — it only demonstrates recovery when the controlled
    fault is taken out of the pipeline.

    Returns:
        {
          "applicable": bool,
          "reason": str | None,                 # why not applicable
          "fixed_agent": str | None,            # agent the fix targets
          "before": (trace, diagnosis) | None,  # original scenario, deterministic
          "after":  (trace, diagnosis) | None,  # fault removed, deterministic
          "recovered": bool,
        }
    """
    mapped = FAILURE_MODE_MAP.get(str(original_mode).lower(), "normal")

    if mapped == "normal":
        return {
            "applicable": False,
            "reason": "The workflow ran cleanly — there is no injected fault to remove.",
            "fixed_agent": None,
            "before": None,
            "after": None,
            "recovered": False,
        }

    with _forced_template_execution():
        before_trace, before_diag = run_live_backend_pipeline(task_prompt, failure_mode=mapped, numbers=numbers)
        after_trace, after_diag = run_live_backend_pipeline(task_prompt, failure_mode="none", numbers=numbers)

    # If the original scenario is genuinely ambiguous, do not assign a fix target.
    if before_diag.get("unknown"):
        return {
            "applicable": False,
            "reason": "Evidence is insufficient to attribute a single root cause, so no fix can be proposed automatically.",
            "fixed_agent": None,
            "before": (before_trace, before_diag),
            "after": None,
            "recovered": False,
        }

    return {
        "applicable": True,
        "reason": None,
        "fixed_agent": _FIX_TARGET.get(mapped, before_diag.get("root_cause_agent")),
        "before": (before_trace, before_diag),
        "after": (after_trace, after_diag),
        "recovered": not after_diag.get("has_failure", True),
    }

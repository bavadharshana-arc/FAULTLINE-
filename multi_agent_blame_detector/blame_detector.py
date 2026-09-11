"""
blame_detector.py
------------------
Root-Cause Engine + Explanation Generator.

Algorithm (matches the project spec, section 11):
    1. Collect all trace events for a task.
    2. Sort events by execution step.
    3. Validation has already been done per-event during collection.
    4. Find the earliest invalid output.
    5. Check whether later failures depend on that event
       (via parent_step chains -> dependency graph).
    6. Mark the earliest causally relevant failure as ROOT CAUSE.
    7. Mark dependent later failures as DOWNSTREAM.
    8. Generate an evidence report.

We also build a simple directed dependency graph (section 12) so that
"downstream" is based on actual parent_step chains, not just
chronological order — an independent failure that does NOT depend on
the root cause is reported separately rather than silently merged.
"""

from typing import List, Dict, Optional
try:
    from agents import TraceEvent
except ImportError:
    from multi_agent_blame_detector.agents import TraceEvent


class Diagnosis:
    def __init__(self):
        self.root_cause: Optional[TraceEvent] = None
        self.downstream: List[TraceEvent] = []
        self.independent_failures: List[TraceEvent] = []
        self.no_failure: bool = False
        # UNKNOWN / insufficient-evidence state (additive; defaults keep old behaviour).
        # When True, `root_cause` still holds the earliest failed step as a candidate
        # only — callers must not present it as a confident attribution.
        self.unknown: bool = False
        self.unknown_reason: Optional[str] = None

    def to_dict(self) -> Dict:
        return {
            "root_cause": self.root_cause.to_dict() if self.root_cause else None,
            "downstream": [e.to_dict() for e in self.downstream],
            "independent_failures": [e.to_dict() for e in self.independent_failures],
            "no_failure": self.no_failure,
            "unknown": self.unknown,
            "unknown_reason": self.unknown_reason,
        }


def _build_dependency_chain(event: TraceEvent, events_by_step: Dict[int, TraceEvent]) -> List[int]:
    """Walk parent_step links backward to build the chain of steps this
    event ultimately depends on (inclusive of itself)."""
    chain = [event.step]
    current = event
    seen = set(chain)
    while current.parent_step is not None and current.parent_step in events_by_step:
        parent = events_by_step[current.parent_step]
        if parent.step in seen:
            break  # guard against cycles
        chain.append(parent.step)
        seen.add(parent.step)
        current = parent
    return chain


# Failure reasons that come from a NON-deterministic / heuristic validator
_HEURISTIC_FAILURE_MARKERS = (
    "incomplete or corrupted text output",
    "empty or null text output",
    "unverified",
)


def _is_heuristic_failure(event: Optional[TraceEvent], task: Optional[Dict]) -> bool:
    """True when the earliest failure has no deterministic ground truth behind it."""
    if event is None:
        return False
    if task is not None and str(task.get("op_type", "")).lower() == "fallback":
        return True
    reason = (getattr(event, "reason", "") or "").lower()
    return any(marker in reason for marker in _HEURISTIC_FAILURE_MARKERS)


def detect_root_cause(trace: List[TraceEvent], task: Optional[Dict] = None) -> Diagnosis:
    diagnosis = Diagnosis()
    if not trace:
        diagnosis.no_failure = True
        return diagnosis

    sorted_trace = sorted(trace, key=lambda e: e.step)
    events_by_step = {e.step: e for e in sorted_trace}

    failed_events = [e for e in sorted_trace if e.status == "failed"]

    if not failed_events:
        diagnosis.no_failure = True
        return diagnosis

    # Earliest failure = candidate root cause.
    root = min(failed_events, key=lambda e: e.step)
    diagnosis.root_cause = root

    for e in failed_events:
        if e.step == root.step:
            continue
        chain = _build_dependency_chain(e, events_by_step)
        if root.step in chain:
            diagnosis.downstream.append(e)
        else:
            diagnosis.independent_failures.append(e)

    diagnosis.downstream.sort(key=lambda e: e.step)
    diagnosis.independent_failures.sort(key=lambda e: e.step)

    # ---- UNKNOWN / insufficient-evidence assessment (additive) ----------------
    if _is_heuristic_failure(root, task):
        diagnosis.unknown = True
        diagnosis.unknown_reason = (
            "The earliest failing step is a free-text task with no deterministic "
            "ground truth; the failure was flagged by a heuristic check only, so a "
            "confident root-cause attribution is not possible."
        )
    elif diagnosis.independent_failures:
        indep_steps = ", ".join(str(e.step) for e in diagnosis.independent_failures)
        diagnosis.unknown = True
        diagnosis.unknown_reason = (
            f"Multiple independent failures were detected (step {root.step} and "
            f"step(s) {indep_steps}) with no shared parent_step ancestry; the trace "
            f"does not contain enough evidence to attribute them to a single root cause."
        )

    return diagnosis


# ---------------------------------------------------------------------
# Explanation Generator
# ---------------------------------------------------------------------
def generate_explanation(diagnosis: Diagnosis, use_llm: bool = False) -> str:
    """
    Rule-based explanation by default (deterministic, always available).
    If use_llm=True and an Anthropic API key is configured, this can be
    swapped to call the LLM to phrase the same evidence more naturally
    — the LLM only *explains* evidence that validation already found,
    it never decides who is at fault (see project spec, section 10).
    """
    if diagnosis.no_failure:
        return "All agents produced valid, expected outputs. No root cause detected."

    root = diagnosis.root_cause
    if diagnosis.unknown:
        lines = ["INSUFFICIENT EVIDENCE: a single root cause cannot be attributed with confidence."]
        if diagnosis.unknown_reason:
            lines.append(f"WHY: {diagnosis.unknown_reason}")
        candidates = [root] if root else []
        candidates += list(diagnosis.independent_failures)
        if candidates:
            cand_str = ", ".join(f"{e.agent} (step {e.step}, {e.error_type})" for e in candidates)
            lines.append(f"CANDIDATE failing steps: {cand_str}.")
        return "\n".join(lines)

    lines = []
    lines.append(f"WHO failed first: {root.agent} (step {root.step}).")
    lines.append(f"WHAT was invalid: {root.output}")
    lines.append(f"WHY it was invalid: {root.reason} (error_type: {root.error_type}).")

    if diagnosis.downstream:
        affected = ", ".join(f"{e.agent} (step {e.step})" for e in diagnosis.downstream)
        lines.append(f"WHICH later agents were affected: {affected}.")
    else:
        lines.append("WHICH later agents were affected: none — failure did not propagate further.")

    lines.append(
        f"EVIDENCE: {root.agent}'s output at step {root.step} was the earliest event "
        f"whose deterministic validation failed; all listed downstream events causally "
        f"depend on it via the parent_step chain."
    )

    if diagnosis.independent_failures:
        indep = ", ".join(f"{e.agent} (step {e.step})" for e in diagnosis.independent_failures)
        lines.append(
            f"NOTE: additional failures that do NOT depend on the root cause were also "
            f"observed and may need separate investigation: {indep}."
        )

    return "\n".join(lines)


def generate_explanation_llm(diagnosis: Diagnosis, call_llm_fn) -> str:
    """
    Optional: pass a callable call_llm_fn(prompt: str) -> str that hits
    an LLM API (e.g. Anthropic Messages API) to turn the deterministic
    evidence into a more natural-language incident report. The
    deterministic explanation is always generated first and given to
    the LLM as ground truth so it cannot invent a different verdict.
    """
    base_evidence = generate_explanation(diagnosis)
    if diagnosis.no_failure:
        return base_evidence

    prompt = (
        "You are an incident-report writer for a multi-agent AI system. "
        "Rewrite the following deterministic evidence into a short, clear "
        "incident report for a non-technical reader. Do NOT change the "
        "attributed root cause or invent new facts — only rephrase.\n\n"
        f"Evidence:\n{base_evidence}"
    )
    return call_llm_fn(prompt)

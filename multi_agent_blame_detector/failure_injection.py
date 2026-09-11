"""
failure_injection.py
---------------------
Controlled failure injection so the team can reliably demo the
detector during judging. This is a TESTING feature — not the actual
intelligence of the product (see project spec, section 13).

Modes:
    "normal"       -> no injected failure
    "planner"      -> Planner produces a broken/incomplete plan
    "worker"       -> Worker produces a wrong calculation
    "reviewer"     -> Reviewer wrongly accepts a bad Worker result
    "propagation"  -> Worker fails AND Reviewer fails to catch it
                       (demonstrates root cause vs downstream)
"""

FAILURE_MODES = ["normal", "planner", "worker", "reviewer", "propagation"]


def apply_planner_failure(plan: dict, mode: str) -> dict:
    if mode == "planner":
        # Simulate a broken plan: drop the steps entirely.
        return {"steps": []}
    return plan


def apply_worker_failure(result: dict, mode: str) -> dict:
    if mode in ("worker", "propagation"):
        val = result.get("value")
        if isinstance(val, (int, float)):
            corrupted = val + 7
        elif isinstance(val, str):
            # Realistic corruption: truncate abruptly mid-sentence, dropping key content.
            # No sentinel strings or 'CORRUPTED' markers used.
            if len(val) > 15:
                corrupted = val[:8].rstrip() + "..."
            else:
                corrupted = "Incomplete"
        else:
            corrupted = None
        return {**result, "value": corrupted}
    return result


def apply_reviewer_failure(review: dict, mode: str) -> dict:
    if mode == "reviewer":
        # Worker was actually CORRECT here, but Reviewer wrongly
        # rejects it (false negative) -> Reviewer becomes the root
        # cause since Planner and Worker were both fine.
        return {**review, "verdict": "invalid", "note": "(injected) reviewer wrongly rejected a correct result"}
    if mode == "propagation":
        # Worker's error (injected above) slips past the Reviewer,
        # who wrongly approves it -> Worker stays the root cause,
        # Reviewer becomes a downstream (dependent) failure.
        return {**review, "verdict": "valid", "note": "(injected) reviewer missed worker error"}
    return review

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

try:
    from engine import (
        REQUIRED_SCHEMA_FIELDS,
        validate_trace_schema,
        run_pipeline,
        analyze_root_cause
    )
except ImportError:
    from frontend.engine import (
        REQUIRED_SCHEMA_FIELDS,
        validate_trace_schema,
        run_pipeline,
        analyze_root_cause
    )


def test_schema_fields():
    print("Testing trace schema fields...")
    modes = ["none", "planner_hallucination", "worker_syntax_error", "reviewer_oversight", "propagation_failure"]
    for mode in modes:
        trace, _ = run_pipeline("Calculate the sum of 10, 20, 30.", mode)
        assert validate_trace_schema(trace), f"Schema validation failed for mode '{mode}'"
        for step in trace:
            for field in REQUIRED_SCHEMA_FIELDS:
                assert field in step, f"Missing field '{field}' in step {step}"
    print("[OK] Trace schema verification passed.")


def test_planner_hallucination_blame():
    print("Testing Planner Hallucination blame attribution...")
    trace, diagnosis = run_pipeline("Calculate the sum of 10, 20, 30.", "planner_hallucination")
    assert diagnosis["has_failure"] is True
    assert diagnosis["root_cause_agent"] == "Planner"
    assert diagnosis["root_cause_step"] == 1
    assert "Worker" in diagnosis["downstream_agents"]
    print("[OK] Planner Hallucination blame attribution passed.")


def test_worker_syntax_error_blame():
    print("Testing Worker Syntax Error blame attribution...")
    trace, diagnosis = run_pipeline("Calculate the sum of 10, 20, 30.", "worker_syntax_error")
    assert diagnosis["has_failure"] is True
    assert diagnosis["root_cause_agent"] == "Worker"
    assert diagnosis["root_cause_step"] == 2
    assert "Planner" not in diagnosis["downstream_agents"]
    print("[OK] Worker Syntax Error blame attribution passed.")


def test_all_pass():
    print("Testing All Pass scenario...")
    trace, diagnosis = run_pipeline("Calculate the sum of 10, 20, 30.", "none")
    assert diagnosis["has_failure"] is False
    assert diagnosis["root_cause_agent"] is None
    print("[OK] All Pass scenario passed.")


def test_live_backend_propagation():
    print("Testing Live Backend Propagation Failure via Bridge...")
    trace, diagnosis = run_pipeline("Calculate average of 10, 20, 30", "propagation_failure")
    assert validate_trace_schema(trace), "Live backend trace failed schema validation"
    assert diagnosis["has_failure"] is True
    assert diagnosis["root_cause_agent"] == "Worker"
    assert diagnosis["root_cause_step"] == 2
    assert "Reviewer" in diagnosis["downstream_agents"]
    print("[OK] Live Backend Propagation Failure passed.")


if __name__ == "__main__":
    test_schema_fields()
    test_planner_hallucination_blame()
    test_worker_syntax_error_blame()
    test_all_pass()
    test_live_backend_propagation()
    print("\nALL ENGINE TESTS PASSED SUCCESSFULLY!")

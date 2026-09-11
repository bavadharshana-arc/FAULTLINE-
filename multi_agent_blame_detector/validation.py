"""
validation.py
-------------
Deterministic validators. We deliberately do NOT let an LLM be the only
judge of correctness — every agent output that CAN be checked with a
rule, is checked with a rule. An LLM is only used later, to *explain*
a failure that validation has already established (see blame_detector.py).

Failure taxonomy (from the project spec):
    incorrect_output
    missing_information
    constraint_violation
    invalid_format
    contradiction
    tool_api_failure
    reviewer_detection_failure
    timeout_exception
"""

import math
from typing import Any, Dict, Tuple, Optional

try:
    from task_parser import parse_and_classify_task
except ImportError:
    from multi_agent_blame_detector.task_parser import parse_and_classify_task


class ValidationResult:
    def __init__(self, valid: bool, error_type: Optional[str] = None, reason: str = ""):
        self.valid = valid
        self.error_type = error_type
        self.reason = reason

    def __repr__(self):
        return f"ValidationResult(valid={self.valid}, error_type={self.error_type}, reason={self.reason!r})"


def validate_plan(plan: Dict, task: Dict) -> ValidationResult:
    """A plan must contain a non-empty ordered list of steps."""
    if not isinstance(plan, dict) or "steps" not in plan:
        return ValidationResult(False, "invalid_format", "Plan is not a structured step list.")
    if not plan["steps"]:
        return ValidationResult(False, "missing_information", "Plan contains no steps.")
    numbers = task.get("numbers", [])
    if numbers and not all(str(n) in " ".join(plan["steps"]) for n in numbers):
        return ValidationResult(False, "contradiction", "Plan does not reference all input numbers.")
    return ValidationResult(True, None, "Plan structure and inputs are consistent.")


# ---------------------------------------------------------------------
# Individual Operation Validators (Step 3 Requirement)
# ---------------------------------------------------------------------

def _check_numeric_worker_output(result: Dict, expected: Any, op_name: str) -> ValidationResult:
    if not isinstance(result, dict) or "value" not in result:
        return ValidationResult(False, "invalid_format", "Worker result missing 'value' field.")

    actual = result["value"]

    # Integer exact comparison for Python arbitrary-precision integers
    if isinstance(expected, int):
        try:
            actual_int = int(actual)
            if isinstance(actual, float) and not actual.is_integer():
                return ValidationResult(
                    False,
                    "incorrect_output",
                    f"Expected integer {op_name} {expected}, but Worker produced fractional float {actual}."
                )
        except (TypeError, ValueError):
            return ValidationResult(False, "invalid_format", f"Worker output '{actual}' is not an integer.")

        if actual_int != expected:
            return ValidationResult(
                False,
                "incorrect_output",
                f"Expected {op_name} {expected}, but Worker produced {actual_int}.",
            )
        return ValidationResult(True, None, f"Worker output {actual_int} matches expected {op_name} {expected}.")

    # Float comparison using relative and absolute tolerance
    try:
        actual_num = float(actual)
        expected_num = float(expected)
    except (TypeError, ValueError):
        return ValidationResult(False, "invalid_format", f"Worker output '{actual}' is not numeric.")

    if not math.isclose(actual_num, expected_num, rel_tol=1e-9, abs_tol=1e-6):
        return ValidationResult(
            False,
            "incorrect_output",
            f"Expected {op_name} {expected_num}, but Worker produced {actual_num}.",
        )
    return ValidationResult(True, None, f"Worker output {actual_num} matches expected {op_name} {expected_num}.")


def validate_average_result(result: Dict, task: Dict) -> ValidationResult:
    parsed = parse_and_classify_task(task)
    expected = parsed["expected_value"]
    if expected is None:
        return ValidationResult(False, "missing_information", "No numbers found in task to calculate average.")
    return _check_numeric_worker_output(result, expected, "average")


def validate_sum_result(result: Dict, task: Dict) -> ValidationResult:
    parsed = parse_and_classify_task(task)
    expected = parsed["expected_value"]
    if expected is None:
        return ValidationResult(False, "missing_information", "No numbers found in task to calculate sum.")
    return _check_numeric_worker_output(result, expected, "sum")


def validate_product_result(result: Dict, task: Dict) -> ValidationResult:
    parsed = parse_and_classify_task(task)
    expected = parsed["expected_value"]
    if expected is None:
        return ValidationResult(False, "missing_information", "No numbers found in task to calculate product.")
    return _check_numeric_worker_output(result, expected, "product")


def validate_min_result(result: Dict, task: Dict) -> ValidationResult:
    parsed = parse_and_classify_task(task)
    expected = parsed["expected_value"]
    if expected is None:
        return ValidationResult(False, "missing_information", "No numbers found in task to find min.")
    return _check_numeric_worker_output(result, expected, "minimum")


def validate_max_result(result: Dict, task: Dict) -> ValidationResult:
    parsed = parse_and_classify_task(task)
    expected = parsed["expected_value"]
    if expected is None:
        return ValidationResult(False, "missing_information", "No numbers found in task to find max.")
    return _check_numeric_worker_output(result, expected, "maximum")


def validate_count_result(result: Dict, task: Dict) -> ValidationResult:
    parsed = parse_and_classify_task(task)
    expected = parsed["expected_value"]
    if expected is None:
        return ValidationResult(False, "missing_information", "No numbers found in task to count.")
    return _check_numeric_worker_output(result, expected, "count")


def validate_factorial_result(result: Dict, task: Dict) -> ValidationResult:
    parsed = parse_and_classify_task(task)
    expected = parsed["expected_value"]
    if expected is None:
        return ValidationResult(False, "missing_information", "No integer n found in task to calculate factorial.")
    return _check_numeric_worker_output(result, expected, "factorial")


def validate_fibonacci_result(result: Dict, task: Dict) -> ValidationResult:
    parsed = parse_and_classify_task(task)
    expected = parsed["expected_value"]
    if expected is None:
        return ValidationResult(False, "missing_information", "No integer n found in task to calculate fibonacci.")
    return _check_numeric_worker_output(result, expected, "fibonacci")


def validate_expression_result(result: Dict, task: Dict) -> ValidationResult:
    parsed = parse_and_classify_task(task)
    expected = task.get("expected_value") or parsed.get("expected_value")
    if expected is None:
        return ValidationResult(False, "missing_information", "Expression could not be safely evaluated.")
    return _check_numeric_worker_output(result, expected, "expression value")


def validate_calculation_result(result: Dict, task: Dict) -> ValidationResult:
    parsed = parse_and_classify_task(task)
    expected = task.get("expected_value") or parsed.get("expected_value")
    if expected is None:
        return validate_fallback_result(result, task)
    return _check_numeric_worker_output(result, expected, "calculation")


def validate_scenario_result(result: Dict, task: Dict) -> ValidationResult:
    parsed = parse_and_classify_task(task)
    expected = task.get("expected_value") or parsed.get("expected_value")
    if expected is not None:
        return _check_numeric_worker_output(result, expected, "scenario calculation")
    return validate_fallback_result(result, task)


def validate_file_analysis_result(result: Dict, task: Dict) -> ValidationResult:
    return validate_fallback_result(result, task)


def validate_text_question_result(result: Dict, task: Dict) -> ValidationResult:
    return validate_fallback_result(result, task)


def validate_fallback_result(result: Dict, task: Dict) -> ValidationResult:
    """
    Explicit fallback validator for arbitrary free-text tasks where no numeric ground truth exists.
    Validates structural integrity, non-empty content, minimum length, and completion properties.
    Zero sentinel string checking.
    """
    if not isinstance(result, dict) or "value" not in result:
        return ValidationResult(False, "invalid_format", "Worker result missing 'value' field.")

    val_str = str(result.get("value", "")).strip()
    if not val_str or val_str in ("None", "null"):
        return ValidationResult(False, "missing_information", "Worker produced empty or null text output.")

    # Validate structural properties (e.g. truncated mid-sentence < 15 chars or ending abruptly)
    if len(val_str) < 15 or val_str.endswith("..."):
        return ValidationResult(False, "incorrect_output", "Worker produced incomplete or corrupted text output.")

    return ValidationResult(True, None, "Unverified: Output format is valid and non-empty (free-text task).")


# Map operation name to specific validator function
VALIDATOR_ROUTER = {
    "average": validate_average_result,
    "sum": validate_sum_result,
    "product": validate_product_result,
    "min": validate_min_result,
    "max": validate_max_result,
    "count": validate_count_result,
    "factorial": validate_factorial_result,
    "fibonacci": validate_fibonacci_result,
    "expression": validate_expression_result,
    "calculation": validate_calculation_result,
    "scenario": validate_scenario_result,
    "file_analysis": validate_file_analysis_result,
    "text_question": validate_text_question_result,
    "fallback": validate_fallback_result,
}


def validate_worker_result(result: Dict, task: Dict) -> ValidationResult:
    """
    Dynamic Worker Validator Router:
    Classifies task operation type and routes to matching operation validator.
    Never falls through to average by default.
    """
    op_type = task.get("op_type")
    if not op_type:
        parsed = parse_and_classify_task(task)
        op_type = parsed["op_type"]
        task["op_type"] = op_type
        task["expected_value"] = parsed["expected_value"]

    validator_fn = VALIDATOR_ROUTER.get(op_type, validate_fallback_result)
    return validator_fn(result, task)


def validate_reviewer(review: Dict, worker_validation: ValidationResult) -> ValidationResult:
    """The Reviewer's job is to correctly flag whatever the deterministic
    validator already found. If Reviewer says 'valid' but the Worker
    output was actually invalid, that is a reviewer_detection_failure."""
    if not isinstance(review, dict) or "verdict" not in review:
        return ValidationResult(False, "invalid_format", "Reviewer produced no verdict.")

    reviewer_says_valid = review["verdict"] == "valid"
    worker_actually_valid = worker_validation.valid

    if worker_actually_valid and not reviewer_says_valid:
        return ValidationResult(
            False,
            "reviewer_detection_failure",
            "Reviewer rejected a correct Worker output (false negative).",
        )
    if not worker_actually_valid and reviewer_says_valid:
        return ValidationResult(
            False,
            "reviewer_detection_failure",
            "Reviewer accepted an incorrect Worker output (false negative on detection).",
        )
    return ValidationResult(True, None, "Reviewer verdict matches deterministic ground truth.")

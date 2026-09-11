"""
test_task_generalization.py
----------------------------
Comprehensive test suite verifying Step 3 & 4 acceptance criteria:
1. Two different user-typed tasks produce distinct input/output payloads in trace.
2. Each of the 5 failure modes attributes exact expected root_cause_agent.
3. Schema adapter never drops any of the 8 required trace fields.
4. Each operation validator (sum, product, min, max, count, factorial, fibonacci) flags correct vs incorrect Worker outputs.
5. Safe expression evaluator rejects dangerous inputs (imports, function calls, attribute access).
6. Prompts without numbers return missing_information error without fabricating default input arrays.
"""

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from multi_agent_blame_detector.task_parser import safe_eval_expression, parse_and_classify_task
from multi_agent_blame_detector.pipeline import run_pipeline as backend_run_pipeline
from multi_agent_blame_detector.validation import (
    validate_sum_result,
    validate_product_result,
    validate_min_result,
    validate_max_result,
    validate_count_result,
    validate_factorial_result,
    validate_fibonacci_result,
    validate_worker_result,
)
from frontend.bridge import run_live_backend_pipeline, adapt_trace_event_to_schema
from frontend.engine import REQUIRED_SCHEMA_FIELDS, validate_trace_schema


class TestTaskGeneralizationAndSecurity(unittest.TestCase):

    # ---------------------------------------------------------------------
    # Requirement 1: Two different user-typed tasks produce distinct traces
    # ---------------------------------------------------------------------
    def test_two_different_tasks_produce_distinct_traces(self):
        task1_prompt = "Calculate average of 10, 20, 30."
        task2_prompt = "Calculate sum of 5, 15, 25."

        trace1, diag1 = run_live_backend_pipeline(task1_prompt, failure_mode="none")
        trace2, diag2 = run_live_backend_pipeline(task2_prompt, failure_mode="none")

        worker_output1 = next(item["output"] for item in trace1 if item["agent"] == "Worker")
        worker_output2 = next(item["output"] for item in trace2 if item["agent"] == "Worker")

        self.assertNotEqual(worker_output1, worker_output2, "Worker outputs for distinct tasks must be different")
        self.assertTrue("20" in worker_output1 or "20.0" in worker_output1)
        self.assertIn("45", worker_output2)

    # ---------------------------------------------------------------------
    # Requirement 2: All 5 failure modes attribute expected root cause
    # ---------------------------------------------------------------------
    def test_five_failure_modes_root_cause_attribution(self):
        test_cases = [
            ("none", False, None),
            ("planner_hallucination", True, "Planner"),
            ("worker_syntax_error", True, "Worker"),
            ("reviewer_oversight", True, "Reviewer"),
            ("propagation_failure", True, "Worker"),
        ]

        task_prompt = "Calculate sum of 10, 20, 30."
        for mode_key, expected_has_fail, expected_rc_agent in test_cases:
            with self.subTest(mode=mode_key):
                trace, diag = run_live_backend_pipeline(task_prompt, failure_mode=mode_key)
                self.assertEqual(diag["has_failure"], expected_has_fail)
                self.assertEqual(diag["root_cause_agent"], expected_rc_agent)
                if mode_key == "propagation_failure":
                    self.assertIn("Reviewer", diag["downstream_agents"])

    # ---------------------------------------------------------------------
    # Requirement 3: Schema adapter never drops mandatory 8 fields
    # ---------------------------------------------------------------------
    def test_schema_adapter_preserves_required_fields(self):
        for mode in ["none", "planner_hallucination", "worker_syntax_error", "reviewer_oversight", "propagation_failure"]:
            trace, _ = run_live_backend_pipeline("Calculate product of 2, 3, 4", failure_mode=mode)
            self.assertTrue(validate_trace_schema(trace))
            for step_item in trace:
                for field_name in REQUIRED_SCHEMA_FIELDS:
                    self.assertIn(field_name, step_item)
                    if field_name != "parent_step":
                        self.assertIsNotNone(step_item[field_name], f"Field {field_name} is None in step {step_item['step']}")

    # ---------------------------------------------------------------------
    # Requirement 4: Operation validators flag correct vs incorrect outputs
    # ---------------------------------------------------------------------
    def test_operation_validators_correct_and_incorrect(self):
        ops = [
            (validate_sum_result, {"op_type": "sum", "numbers": [10, 20]}, {"value": 30}, {"value": 99}),
            (validate_product_result, {"op_type": "product", "numbers": [3, 4]}, {"value": 12}, {"value": 99}),
            (validate_min_result, {"op_type": "min", "numbers": [10, 5, 20]}, {"value": 5}, {"value": 99}),
            (validate_max_result, {"op_type": "max", "numbers": [10, 5, 20]}, {"value": 20}, {"value": 99}),
            (validate_count_result, {"op_type": "count", "numbers": [10, 20, 30]}, {"value": 3}, {"value": 99}),
            (validate_factorial_result, {"op_type": "factorial", "numbers": [5]}, {"value": 120}, {"value": 99}),
            (validate_fibonacci_result, {"op_type": "fibonacci", "numbers": [6]}, {"value": 8}, {"value": 99}),
        ]

        for val_fn, task_dict, correct_res, wrong_res in ops:
            with self.subTest(validator=val_fn.__name__):
                res_good = val_fn(correct_res, task_dict)
                self.assertTrue(res_good.valid, f"Validator {val_fn.__name__} failed valid output")

                res_bad = val_fn(wrong_res, task_dict)
                self.assertFalse(res_bad.valid, f"Validator {val_fn.__name__} passed invalid output")
                self.assertEqual(res_bad.error_type, "incorrect_output")

    # ---------------------------------------------------------------------
    # Requirement 5: Safe AST evaluator sandboxing (rejects dangerous input)
    # ---------------------------------------------------------------------
    def test_safe_evaluator_valid_expressions(self):
        self.assertEqual(safe_eval_expression("10 + 20 * 3"), 70)
        self.assertEqual(safe_eval_expression("(5 + 15) / 2"), 10.0)
        self.assertEqual(safe_eval_expression("2 ** 8"), 256)
        self.assertEqual(safe_eval_expression("-5 + 10"), 5)

    def test_safe_evaluator_rejects_dangerous_inputs(self):
        dangerous_payloads = [
            "__import__('os').system('ls')",
            "eval('1 + 1')",
            "exec('import sys')",
            "open('/etc/passwd').read()",
            "[x for x in (1, 2, 3)]",
            "lambda x: x + 1",
            "globals()",
            "__builtins__",
            "getattr(int, 'mro')",
        ]

        for payload in dangerous_payloads:
            with self.subTest(payload=payload):
                with self.assertRaises(ValueError, msg=f"Payload '{payload}' was not refused by safe_eval_expression!"):
                    safe_eval_expression(payload)

    # ---------------------------------------------------------------------
    # Requirement 6 (Issue 4 Coverage): Prompts without numbers return missing_information
    # ---------------------------------------------------------------------
    def test_no_numbers_prompts_return_missing_information(self):
        no_num_prompts = [
            "Calculate average",
            "Calculate sum",
            "Calculate product",
            "Calculate max",
            "Calculate min",
            "Calculate count",
            "Calculate factorial",
            "Calculate fibonacci"
        ]

        for prompt in no_num_prompts:
            with self.subTest(prompt=prompt):
                parsed = parse_and_classify_task(prompt)
                self.assertEqual(parsed["numbers"], [], f"Prompt '{prompt}' fabricated default numbers!")
                self.assertIsNone(parsed["expected_value"], f"Prompt '{prompt}' fabricated expected_value!")

                val_res = validate_worker_result({"value": 20}, parsed)
                self.assertFalse(val_res.valid)
                self.assertEqual(val_res.error_type, "missing_information")


if __name__ == "__main__":
    unittest.main(verbosity=2)

"""
test_correctness_fixes.py
--------------------------
Comprehensive unit test suite for correctness fixes (Issues 0-8 + Requirements 1-3).
Verifies:
1. Issue 0: Worker execution with zero failure injection catches wrong Worker answers.
2. Issue 1 & Requirement 1: Non-circular realistic free-text corruption & validation without sentinel strings.
3. Issue 2: ZeroDivisionError is caught and handled gracefully in parse_and_classify_task.
4. Issue 3 & Requirement 2: Integer ground truth arbitrary-precision (100! exact) & off-by-1e140 rejection.
5. Issue 4 & Requirement 3: Missing numbers in prompt return missing_information error without fabricating inputs.
6. Issue 5: engine.analyze_root_cause delegates to blame_detector and maps legacy taxonomy.
7. Issue 6: Independent failures are correctly mapped to blame_role = 'INDEPENDENT'.
"""

import math
import os
import sys
import unittest
from unittest.mock import patch

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from multi_agent_blame_detector.tools import execute
from multi_agent_blame_detector.agents import worker, planner, TraceCollector
from multi_agent_blame_detector.validation import validate_worker_result, validate_fallback_result, validate_factorial_result
from multi_agent_blame_detector.task_parser import parse_and_classify_task, safe_eval_expression
from multi_agent_blame_detector.failure_injection import apply_worker_failure
from frontend.engine import analyze_root_cause


class TestCorrectnessFixes(unittest.TestCase):

    # ---------------------------------------------------------------------
    # Issue 0: Real tool execution & catching wrong Worker output with ZERO injection
    # ---------------------------------------------------------------------
    def test_issue0_wrong_worker_answer_caught_without_injection(self):
        """
        Prove that a wrong Worker answer is caught by validation when failure_mode="normal"
        (zero failure injection).
        """
        task = {
            "task_id": "T-ISSUE0-01",
            "description": "Calculate sum of 10 and 20",
            "op_type": "sum",
            "numbers": [10, 20],
        }
        tracer = TraceCollector()
        plan = {"steps": ["Identify numbers", "Calculate sum"]}

        # Mock tools.execute and call_gemini to return a wrong answer (99) under failure_mode="normal"
        with patch("multi_agent_blame_detector.agents.execute_tool", return_value=99), \
             patch("multi_agent_blame_detector.agents.call_gemini", return_value=("Final Answer: 99", True)):
            res = worker(plan=plan, task=task, tracer=tracer, planner_step=1, failure_mode="normal", real_execution=True)
            events = tracer.get_trace("T-ISSUE0-01")

            self.assertEqual(res["value"], 99)
            self.assertEqual(events[0].status, "failed")
            self.assertEqual(events[0].error_type, "incorrect_output")

    def test_issue0_real_tools_executor_calculates_independently(self):
        """Verify tools.execute calculates operations accurately."""
        self.assertEqual(execute("average", [10.0, 20.0, 30.0]), 20.0)
        self.assertEqual(execute("sum", [5.0, 15.0]), 20)
        self.assertEqual(execute("product", [2.0, 3.0, 4.0]), 24)
        self.assertEqual(execute("min", [10.0, 5.0, 30.0]), 5.0)
        self.assertEqual(execute("max", [10.0, 50.0, 30.0]), 50.0)
        self.assertEqual(execute("factorial", [5]), 120)
        self.assertEqual(execute("fibonacci", [6]), 8)

    # ---------------------------------------------------------------------
    # Requirement 1: Non-circular free-text validation without sentinel strings
    # ---------------------------------------------------------------------
    def test_req1_non_circular_free_text_validation_catches_corruption(self):
        """Verify free-text validator catches truncated string without sentinel markers."""
        corrupted_output = {"value": "Output r..."}  # truncated to < 15 chars
        task = {"description": "Write a haiku about rain", "op_type": "fallback"}

        val_res = validate_fallback_result(corrupted_output, task)
        self.assertFalse(val_res.valid)
        self.assertEqual(val_res.error_type, "incorrect_output")
        self.assertNotIn("CORRUPTED", corrupted_output["value"])

    # ---------------------------------------------------------------------
    # Issue 2: ZeroDivisionError handling
    # ---------------------------------------------------------------------
    def test_issue2_zero_division_error_intercepted(self):
        """Verify 5 / 0 in safe_eval_expression raises ValueError and parse_and_classify_task handles it cleanly."""
        with self.assertRaises(ValueError):
            safe_eval_expression("5 / 0")

        parsed = parse_and_classify_task("Calculate 5 / 0")
        self.assertIsNone(parsed["expected_value"])

    # ---------------------------------------------------------------------
    # Requirement 2: Arbitrary precision int ground truth & 1e140 off rejection
    # ---------------------------------------------------------------------
    def test_req2_exact_100_factorial_validates_and_off_by_1e140_rejected(self):
        """Verify exact 100! passes and value off by 1e140 is rejected."""
        exact_100_fact = math.factorial(100)
        self.assertIsInstance(exact_100_fact, int)

        task = {"description": "factorial of 100"}
        parsed = parse_and_classify_task(task)
        self.assertIsInstance(parsed["expected_value"], int)
        self.assertEqual(parsed["expected_value"], exact_100_fact)

        # Correct worker result
        good_res = validate_factorial_result({"value": exact_100_fact}, task)
        self.assertTrue(good_res.valid)

        # Worker result off by 1e140
        wrong_1e140_val = exact_100_fact + (10 ** 140)
        bad_res = validate_factorial_result({"value": wrong_1e140_val}, task)
        self.assertFalse(bad_res.valid)
        self.assertEqual(bad_res.error_type, "incorrect_output")

    # ---------------------------------------------------------------------
    # Requirement 3 & Issue 4: Prompts without numbers return missing_information
    # ---------------------------------------------------------------------
    def test_req3_prompts_without_numbers_return_missing_information(self):
        """Verify prompts without numbers return expected_value = None without fabricating defaults."""
        no_num_prompts = ["Calculate average", "Calculate sum", "Calculate product", "Calculate max"]
        for prompt in no_num_prompts:
            parsed = parse_and_classify_task(prompt)
            self.assertEqual(parsed["numbers"], [], f"Prompt '{prompt}' fabricated numbers!")
            self.assertIsNone(parsed["expected_value"], f"Prompt '{prompt}' fabricated expected_value!")

            val_res = validate_worker_result({"value": 20.0}, parsed)
            self.assertFalse(val_res.valid)
            self.assertEqual(val_res.error_type, "missing_information")

    # ---------------------------------------------------------------------
    # Issue 5: Engine analyze_root_cause delegates to canonical blame detector
    # ---------------------------------------------------------------------
    def test_issue5_engine_analyze_root_cause_delegates_to_blame_detector(self):
        """Verify analyze_root_cause maps legacy error types and delegates to blame_detector."""
        legacy_trace = [
            {
                "task_id": "T-LEGACY-01",
                "step": 1,
                "agent": "Planner",
                "input": "Task input",
                "output": "Broken plan",
                "status": "failed",
                "error_type": "Hallucination",
                "parent_step": None
            },
            {
                "task_id": "T-LEGACY-01",
                "step": 2,
                "agent": "Worker",
                "input": "Broken plan",
                "output": "Execution crash",
                "status": "failed",
                "error_type": "PropagationError",
                "parent_step": 1
            }
        ]

        diag = analyze_root_cause(legacy_trace)
        self.assertTrue(diag["has_failure"])
        self.assertEqual(diag["root_cause_step"], 1)
        self.assertEqual(diag["root_cause_agent"], "Planner")
        self.assertEqual(diag["root_cause_error_type"], "missing_information")
        self.assertIn(2, diag["downstream_steps"])

    # ---------------------------------------------------------------------
    # Issue 6: Independent failures assigned INDEPENDENT blame_role
    # ---------------------------------------------------------------------
    def test_issue6_independent_failures_role_assigned(self):
        """Verify independent failure steps receive blame_role = 'INDEPENDENT'."""
        trace_events = [
            {
                "task_id": "T-IND-01",
                "step": 1,
                "agent": "Planner",
                "input": "Input 1",
                "output": "Plan 1",
                "status": "failed",
                "error_type": "missing_information",
                "parent_step": None
            },
            {
                "task_id": "T-IND-01",
                "step": 2,
                "agent": "Worker",
                "input": "Input 2",
                "output": "Output 2",
                "status": "failed",
                "error_type": "incorrect_output",
                "parent_step": None
            }
        ]

        diag = analyze_root_cause(trace_events)
        roles = {item["step"]: item["blame_role"] for item in diag["annotated_trace"]}
        self.assertEqual(roles[1], "ROOT_CAUSE")
        self.assertEqual(roles[2], "INDEPENDENT")


if __name__ == "__main__":
    unittest.main(verbosity=2)

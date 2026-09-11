"""
test_trace_normalization.py
---------------------------
Tests custom trace upload normalization across file formats (JSON, CSV, TXT, MD, PDF)
and verifies that the existing Task Prompt pipeline remains fully functional.
"""

import json
import unittest
import pandas as pd
import io
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "frontend"))
sys.path.insert(0, os.path.dirname(__file__))

from engine import normalize_uploaded_file, validate_trace_schema, analyze_root_cause, run_pipeline


class TestTraceNormalization(unittest.TestCase):

    def test_case_a_valid_8_field_json(self):
        """Test Case A: Valid 8-field JSON trace must work directly."""
        valid_trace = [
            {
                "task_id": "T-101",
                "step": 1,
                "agent": "Planner",
                "input": "Calculate average",
                "output": "Plan steps",
                "status": "success",
                "error_type": "None",
                "parent_step": None
            },
            {
                "task_id": "T-101",
                "step": 2,
                "agent": "Worker",
                "input": "Plan steps",
                "output": "Result 20",
                "status": "success",
                "error_type": "None",
                "parent_step": 1
            }
        ]
        file_bytes = json.dumps(valid_trace).encode("utf-8")
        trace, err, status_msg = normalize_uploaded_file("trace.json", file_bytes)
        self.assertIsNone(err)
        self.assertIsNotNone(trace)
        self.assertEqual(len(trace), 2)
        self.assertTrue(validate_trace_schema(trace))
        self.assertTrue(any(w in status_msg for w in ["Valid 8-field", "normalized successfully"]))

    def test_case_b_json_without_8_fields(self):
        """Test Case B: JSON without 8 fields should be normalized to standard 8 fields."""
        partial_json = [
            {"role": "Planner", "prompt": "Task", "result": "Decompose into steps"},
            {"role": "Worker", "prompt": "Steps", "result": "Failed calculation", "state": "failed", "error": "incorrect_output"}
        ]
        file_bytes = json.dumps(partial_json).encode("utf-8")
        trace, err, status_msg = normalize_uploaded_file("partial_trace.json", file_bytes)
        self.assertIsNone(err)
        self.assertIsNotNone(trace)
        self.assertEqual(len(trace), 2)
        self.assertTrue(validate_trace_schema(trace))
        self.assertEqual(trace[0]["agent"], "Planner")
        self.assertEqual(trace[1]["agent"], "Worker")
        self.assertEqual(trace[1]["status"], "failed")

    def test_case_c_txt_file_with_agent_trace(self):
        """Test Case C: TXT file containing agent execution trace steps."""
        txt_content = (
            "Step 1 - Planner:\n"
            "Plan: 1. Identify numbers 10, 20, 30. 2. Calculate average.\n\n"
            "Step 2 - Worker:\n"
            "Output: Worker calculated result: 25. Error: incorrect calculation.\n\n"
            "Step 3 - Reviewer:\n"
            "Review: Reject calculation due to wrong average.\n"
        )
        file_bytes = txt_content.encode("utf-8")
        trace, err, status_msg = normalize_uploaded_file("trace.txt", file_bytes)
        self.assertIsNone(err)
        self.assertIsNotNone(trace)
        self.assertTrue(validate_trace_schema(trace))
        self.assertGreaterEqual(len(trace), 2)

    def test_case_d_csv_file(self):
        """Test Case D: CSV file handling."""
        df = pd.DataFrame([
            {"agent_name": "Planner", "prompt": "Plan task", "response": "Plan ok"},
            {"agent_name": "Worker", "prompt": "Execute", "response": "Output 42", "state": "success"}
        ])
        csv_bytes = df.to_csv(index=False).encode("utf-8")
        trace, err, status_msg = normalize_uploaded_file("trace.csv", csv_bytes)
        self.assertIsNone(err)
        self.assertIsNotNone(trace)
        self.assertTrue(validate_trace_schema(trace))
        self.assertEqual(trace[0]["agent"], "Planner")

    def test_case_e_invalid_file_no_agent_steps(self):
        """Test Case E: Plain text without agent trace -> returns clear error, no crash."""
        plain_txt = "Hello, this is just a plain note without any agent execution logs."
        file_bytes = plain_txt.encode("utf-8")
        trace, err, status_msg = normalize_uploaded_file("plain.txt", file_bytes)
        self.assertIsNone(trace)
        self.assertIsNotNone(err)
        self.assertIn("Could not infer an agent execution trace", err)

    def test_case_f_existing_task_prompt_pipeline(self):
        """Test Case F: Existing Task Prompt -> Run Pipeline flow works unchanged."""
        trace, diagnosis = run_pipeline("Calculate the average of 10, 20, 30.", failure_mode="none")
        self.assertIsNotNone(trace)
        self.assertIsNotNone(diagnosis)
        self.assertTrue(validate_trace_schema(trace))
        self.assertIn("has_failure", diagnosis)


if __name__ == "__main__":
    unittest.main()

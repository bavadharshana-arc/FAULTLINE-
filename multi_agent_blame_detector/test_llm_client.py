import os
import sys
import unittest
from unittest.mock import patch, MagicMock

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from multi_agent_blame_detector import llm_client, agents, validation

call_gemini = llm_client.call_gemini
worker = agents.worker
planner = agents.planner
TraceCollector = agents.TraceCollector
validate_worker_result = validation.validate_worker_result


class TestLLMClientFallbackAndValidation(unittest.TestCase):

    def test_fallback_when_no_api_key_set(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": ""}, clear=True):
            res, is_gemini = call_gemini("Test prompt", fallback="Default fallback text")
            self.assertFalse(is_gemini)
            self.assertEqual(res, "Default fallback text")

    def test_fallback_when_placeholder_key_set(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "your_key_here"}):
            res, is_gemini = call_gemini("Test prompt", fallback="Default fallback text")
            self.assertFalse(is_gemini)
            self.assertEqual(res, "Default fallback text")

    def test_fallback_when_api_throws_exception(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_test_key_123"}):
            with patch("google.generativeai.GenerativeModel") as mock_model_cls:
                mock_model = MagicMock()
                mock_model.generate_content.side_effect = Exception("API connection timed out or quota exceeded")
                mock_model_cls.return_value = mock_model

                res, is_gemini = call_gemini("Test prompt", fallback="Fallback string on exception")
                self.assertFalse(is_gemini)
                self.assertEqual(res, "Fallback string on exception")

    def test_gemini_success_response(self):
        with patch.dict(os.environ, {"GEMINI_API_KEY": "fake_valid_key"}):
            with patch("google.generativeai.GenerativeModel") as mock_model_cls:
                mock_model = MagicMock()
                mock_response = MagicMock()
                mock_response.text = "1. Parse input numbers\n2. Compute average"
                mock_model.generate_content.return_value = mock_response
                mock_model_cls.return_value = mock_model

                res, is_gemini = call_gemini("Test prompt", fallback="Fallback")
                self.assertTrue(is_gemini)
                self.assertIn("Parse input numbers", res)

    def test_deterministically_wrong_gemini_output_is_flagged_as_failure(self):
        """
        Verify that even if Gemini produces an output, validation.py strictly checks it
        against the expected value (e.g. average of [10, 20, 30] is 20, but Gemini says 99).
        The Worker output MUST be flagged as failed!
        """
        task = {
            "task_id": "T-WRONG-01",
            "description": "Calculate average of 10, 20 and 30",
            "op_type": "average",
            "numbers": [10, 20, 30],
            "expected_value": 20.0
        }
        tracer = TraceCollector()
        plan = {"steps": ["Calculate sum", "Divide by count"]}

        with patch.object(agents, "call_gemini", return_value=("The calculated average is 99", True)), \
             patch("multi_agent_blame_detector.agents.call_gemini", return_value=("The calculated average is 99", True)):
            worker_res = worker(plan=plan, task=task, tracer=tracer, planner_step=1, failure_mode="normal")
            event = tracer.get_trace("T-WRONG-01")[0]

            # Output value is 99, expected is 20.0 -> must be failed
            self.assertEqual(worker_res["value"], 99)
            self.assertEqual(event.status, "failed")
            self.assertEqual(event.error_type, "incorrect_output")
            self.assertEqual(event.generated_by, "gemini")


if __name__ == "__main__":
    unittest.main()

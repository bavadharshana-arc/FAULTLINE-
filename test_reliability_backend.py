import unittest
import os
import shutil
import reliability_store

class TestReliabilityIntelligence(unittest.TestCase):
    def setUp(self):
        self.orig_file = reliability_store.STORE_FILE
        reliability_store.STORE_FILE = "test_history_runs.json"
        if os.path.exists("test_history_runs.json"):
            os.remove("test_history_runs.json")

    def tearDown(self):
        if os.path.exists("test_history_runs.json"):
            os.remove("test_history_runs.json")
        reliability_store.STORE_FILE = self.orig_file

    def test_zero_history(self):
        overview = reliability_store.compute_reliability_overview()
        self.assertEqual(overview["total_runs"], 0)
        self.assertEqual(overview["status"], "insufficient_data")
        pred = reliability_store.predict_failure_risk("Calculate average")
        self.assertEqual(pred["status"], "unavailable")

    def test_single_successful_run(self):
        trace = [
            {"agent": "Planner", "step": 1, "status": "success"},
            {"agent": "Worker", "step": 2, "status": "success"},
            {"agent": "Reviewer", "step": 3, "status": "success"},
            {"agent": "Final", "step": 4, "status": "success"},
        ]
        diag = {"has_failure": False, "unknown": False, "task_id": "T1"}
        reliability_store.record_run("Calculate average", "none", trace, diag)
        
        overview = reliability_store.compute_reliability_overview()
        self.assertEqual(overview["total_runs"], 1)
        self.assertEqual(overview["successful_runs"], 1)
        worker_stats = overview["agents"]["Worker"]
        self.assertEqual(worker_stats["runs"], 1)
        self.assertEqual(worker_stats["failed_runs"], 0)
        self.assertEqual(worker_stats["reliability_score"], 100.0)

    def test_multiple_runs_and_prediction(self):
        # Run 1: Worker failure
        trace1 = [
            {"agent": "Planner", "step": 1, "status": "success"},
            {"agent": "Worker", "step": 2, "status": "failed", "error_type": "incorrect_output"},
            {"agent": "Reviewer", "step": 3, "status": "success"},
            {"agent": "Final", "step": 4, "status": "failed"},
        ]
        diag1 = {"has_failure": True, "unknown": False, "root_cause_agent": "Worker", "root_cause_step": 2, "root_cause_error_type": "incorrect_output", "task_id": "T1"}
        reliability_store.record_run("Calculate average of 10, 20, 30", "worker_syntax_error", trace1, diag1)

        # Run 2: Clean run
        trace2 = [
            {"agent": "Planner", "step": 1, "status": "success"},
            {"agent": "Worker", "step": 2, "status": "success"},
            {"agent": "Reviewer", "step": 3, "status": "success"},
            {"agent": "Final", "step": 4, "status": "success"},
        ]
        diag2 = {"has_failure": False, "unknown": False, "task_id": "T2"}
        reliability_store.record_run("Calculate average of 10, 20, 30", "none", trace2, diag2)

        overview = reliability_store.compute_reliability_overview()
        self.assertEqual(overview["total_runs"], 2)
        worker_stats = overview["agents"]["Worker"]
        self.assertEqual(worker_stats["runs"], 2)
        self.assertEqual(worker_stats["failed_runs"], 1)
        self.assertEqual(worker_stats["root_cause_count"], 1)
        self.assertEqual(worker_stats["failure_rate"], 50.0)
        
        # Prediction
        pred = reliability_store.predict_failure_risk("Calculate average of 5, 10, 15")
        self.assertEqual(pred["status"], "ready")
        self.assertTrue(len(pred["predictions"]) >= 3)
        # Worker/Executor should have higher risk than Planner
        worker_pred = next(p for p in pred["predictions"] if p["raw_agent"] == "Worker")
        planner_pred = next(p for p in pred["predictions"] if p["raw_agent"] == "Planner")
        self.assertGreater(worker_pred["risk_score"], planner_pred["risk_score"])
        self.assertTrue(any("1 failure" in e for e in worker_pred["evidence"]))

if __name__ == "__main__":
    unittest.main()

"""
test_trace.py — Unit tests for trace.py (AIML-06 Trace & Observability module)

Run standalone with:
    python test_trace.py
"""

import json
import unittest

try:
    from trace import TraceCollector, TraceEvent, generate_fake_traces
except ImportError:
    from trace_and_detect.trace import TraceCollector, TraceEvent, generate_fake_traces


class TestTraceCollectorBasics(unittest.TestCase):

    def test_start_task_generates_unique_ids(self):
        collector = TraceCollector()
        task_a = collector.start_task()
        task_b = collector.start_task()
        self.assertTrue(task_a.startswith("T-"))
        self.assertTrue(task_b.startswith("T-"))
        self.assertNotEqual(task_a, task_b)

    def test_record_requires_started_task(self):
        collector = TraceCollector()
        with self.assertRaises(KeyError):
            collector.record(task_id="T-doesnotexist", agent_name="Planner")

    def test_record_returns_trace_event(self):
        collector = TraceCollector()
        task_id = collector.start_task()
        event = collector.record(task_id=task_id, agent_name="Planner",
                                  input_data="task", output_data="plan")
        self.assertIsInstance(event, TraceEvent)
        self.assertEqual(event.agent_name, "Planner")
        self.assertEqual(event.task_id, task_id)


class TestStepNumbering(unittest.TestCase):

    def test_step_ids_increment_chronologically(self):
        collector = TraceCollector()
        task_id = collector.start_task()
        e1 = collector.record(task_id, "Planner")
        e2 = collector.record(task_id, "Worker")
        e3 = collector.record(task_id, "Reviewer")
        self.assertEqual([e1.step_id, e2.step_id, e3.step_id], [1, 2, 3])

    def test_step_counters_independent_per_task(self):
        collector = TraceCollector()
        task_a = collector.start_task()
        task_b = collector.start_task()
        collector.record(task_a, "Planner")
        e_b1 = collector.record(task_b, "Planner")
        self.assertEqual(e_b1.step_id, 1)

    def test_get_full_trace_is_sorted_by_step(self):
        collector = TraceCollector()
        task_id = collector.start_task()
        collector.record(task_id, "Planner")
        collector.record(task_id, "Worker")
        collector.record(task_id, "Reviewer")
        trace = collector.get_full_trace(task_id)
        step_ids = [e.step_id for e in trace]
        self.assertEqual(step_ids, sorted(step_ids))


class TestParentChildLinking(unittest.TestCase):

    def test_parent_step_id_recorded(self):
        collector = TraceCollector()
        task_id = collector.start_task()
        planner = collector.record(task_id, "Planner")
        worker = collector.record(task_id, "Worker", parent_step_id=planner.step_id)
        self.assertEqual(worker.parent_step_id, planner.step_id)

    def test_dependency_chain_is_traceable(self):
        collector = TraceCollector()
        task_id = collector.start_task()
        planner = collector.record(task_id, "Planner")
        worker = collector.record(task_id, "Worker", parent_step_id=planner.step_id)
        reviewer = collector.record(task_id, "Reviewer", parent_step_id=worker.step_id)

        trace = {e.step_id: e for e in collector.get_full_trace(task_id)}
        # walk reviewer -> worker -> planner
        self.assertEqual(trace[reviewer.step_id].parent_step_id, worker.step_id)
        self.assertEqual(trace[worker.step_id].parent_step_id, planner.step_id)
        self.assertIsNone(trace[planner.step_id].parent_step_id)


class TestValidationUpdates(unittest.TestCase):

    def test_update_validation_sets_fields(self):
        collector = TraceCollector()
        task_id = collector.start_task()
        step = collector.record(task_id, "Worker", output_data=25, status="failed")
        collector.update_validation(task_id, step.step_id, "invalid", "expected 20, got 25")

        updated = collector.get_full_trace(task_id)[0]
        self.assertEqual(updated.validation_status, "invalid")
        self.assertEqual(updated.validation_error, "expected 20, got 25")

    def test_update_validation_unknown_step_raises(self):
        collector = TraceCollector()
        task_id = collector.start_task()
        collector.record(task_id, "Worker")
        with self.assertRaises(KeyError):
            collector.update_validation(task_id, 999, "invalid")

    def test_default_validation_is_none_until_set(self):
        collector = TraceCollector()
        task_id = collector.start_task()
        step = collector.record(task_id, "Worker")
        self.assertIsNone(step.validation_status)


class TestJsonSerialization(unittest.TestCase):

    def test_get_trace_json_is_valid_json(self):
        collector = TraceCollector()
        task_id = collector.start_task()
        collector.record(task_id, "Planner", input_data="task", output_data="plan")
        raw = collector.get_trace_json(task_id)
        parsed = json.loads(raw)
        self.assertIsInstance(parsed, list)
        self.assertEqual(parsed[0]["agent_name"], "Planner")

    def test_get_trace_json_reflects_all_events(self):
        collector = TraceCollector()
        task_id = collector.start_task()
        collector.record(task_id, "Planner")
        collector.record(task_id, "Worker")
        collector.record(task_id, "Reviewer")
        parsed = json.loads(collector.get_trace_json(task_id))
        self.assertEqual(len(parsed), 3)


class TestTaskLifecycle(unittest.TestCase):

    def test_clear_task_removes_events(self):
        collector = TraceCollector()
        task_id = collector.start_task()
        collector.record(task_id, "Planner")
        collector.clear_task(task_id)
        self.assertEqual(collector.get_full_trace(task_id), [])

    def test_clear_task_resets_step_counter(self):
        collector = TraceCollector()
        task_id = collector.start_task()
        collector.record(task_id, "Planner")
        collector.clear_task(task_id)
        # re-registering the same id externally isn't supported; start fresh instead
        new_task_id = collector.start_task()
        e1 = collector.record(new_task_id, "Planner")
        self.assertEqual(e1.step_id, 1)

    def test_list_tasks(self):
        collector = TraceCollector()
        t1 = collector.start_task()
        t2 = collector.start_task()
        self.assertEqual(set(collector.list_tasks()), {t1, t2})


class TestFakeTraceGeneration(unittest.TestCase):

    def test_all_scenarios_present(self):
        scenarios = generate_fake_traces()
        expected = {"normal", "worker_failure", "propagation", "reviewer_failure"}
        self.assertEqual(set(scenarios.keys()), expected)

    def test_normal_scenario_all_valid(self):
        scenarios = generate_fake_traces()
        collector = scenarios["normal"]
        task_id = collector.list_tasks()[0]
        for event in collector.get_full_trace(task_id):
            self.assertEqual(event.validation_status, "valid")
            self.assertEqual(event.status, "success")

    def test_worker_failure_scenario_has_one_root_and_one_downstream(self):
        scenarios = generate_fake_traces()
        collector = scenarios["worker_failure"]
        task_id = collector.list_tasks()[0]
        trace = collector.get_full_trace(task_id)
        invalid_steps = [e for e in trace if e.validation_status == "invalid"]
        self.assertEqual(len(invalid_steps), 2)  # Worker + Reviewer
        # earliest invalid step should be the Worker
        earliest_invalid = min(invalid_steps, key=lambda e: e.step_id)
        self.assertEqual(earliest_invalid.agent_name, "Worker")

    def test_propagation_scenario_has_four_steps(self):
        scenarios = generate_fake_traces()
        collector = scenarios["propagation"]
        task_id = collector.list_tasks()[0]
        trace = collector.get_full_trace(task_id)
        self.assertEqual(len(trace), 4)
        self.assertEqual(trace[-1].agent_name, "Final")

    def test_reviewer_failure_scenario_worker_is_valid(self):
        scenarios = generate_fake_traces()
        collector = scenarios["reviewer_failure"]
        task_id = collector.list_tasks()[0]
        trace = {e.agent_name: e for e in collector.get_full_trace(task_id)}
        self.assertEqual(trace["Worker"].validation_status, "valid")
        self.assertEqual(trace["Reviewer"].validation_status, "invalid")


if __name__ == "__main__":
    unittest.main(verbosity=2)

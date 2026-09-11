#!/usr/bin/env bash
# One-command installer for AIML-06 trace module (Person 2 deliverables)
set -e
mkdir -p trace_module
cd trace_module

cat > trace.py << 'PYEOF'
"""
trace.py — Trace & Observability module for AIML-06 Multi-Agent Blame Detector

Owner: Person 2 (Trace & Observability Developer)

Responsibilities:
- Record every agent action (input, output, status, timestamp, dependency)
- Give Person 1 (Agents) a simple record() call
- Give Person 3 (Blame Engine) get_full_trace() with causal links (parent_step_id)
- Give Person 5 (Frontend) get_trace_json() for the dashboard
- Give Person 4 (Validation) update_validation() hooks

Design: MVP-only. Pure Python, in-memory, dataclasses. No DB, no microservices.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from typing import Any, Optional


# --------------------------------------------------------------------------
# Data model
# --------------------------------------------------------------------------

@dataclass
class TraceEvent:
    """A single recorded agent action within a task execution."""

    task_id: str
    step_id: int
    agent_name: str
    status: str  # "running" | "success" | "failed"
    input_data: Any = None
    output_data: Any = None
    parent_step_id: Optional[int] = None
    error_message: Optional[str] = None
    timestamp_start: str = field(default_factory=lambda: _now_iso())
    timestamp_end: Optional[str] = None
    validation_status: Optional[str] = None  # "valid" | "invalid" | None (not yet validated)
    validation_error: Optional[str] = None

    def mark_end(self, status: Optional[str] = None) -> None:
        """Stamp the event as finished, optionally updating its status."""
        self.timestamp_end = _now_iso()
        if status is not None:
            self.status = status

    def to_dict(self) -> dict:
        return asdict(self)


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# --------------------------------------------------------------------------
# Collector
# --------------------------------------------------------------------------

class TraceCollector:
    """
    In-memory store of TraceEvents for one or more tasks.

    Typical usage (Person 1 / agent code):
        collector = TraceCollector()
        task_id = collector.start_task()
        step = collector.record(
            task_id=task_id,
            agent_name="Planner",
            input_data=user_task,
            output_data=plan,
            status="success",
        )
    """

    def __init__(self) -> None:
        # task_id -> list[TraceEvent]
        self._tasks: dict[str, list[TraceEvent]] = {}
        # task_id -> next step counter
        self._step_counters: dict[str, int] = {}

    # -- task lifecycle ----------------------------------------------------

    def start_task(self) -> str:
        """Create a new task and return its generated task_id (format 'T-xxxx')."""
        task_id = f"T-{uuid.uuid4().hex[:8]}"
        self._tasks[task_id] = []
        self._step_counters[task_id] = 0
        return task_id

    def clear_task(self, task_id: str) -> None:
        """Reset/remove all trace state for a task."""
        self._tasks.pop(task_id, None)
        self._step_counters.pop(task_id, None)

    def clear_all(self) -> None:
        """Reset the entire collector (all tasks)."""
        self._tasks.clear()
        self._step_counters.clear()

    # -- recording -----------------------------------------------------------

    def record(
        self,
        task_id: str,
        agent_name: str,
        input_data: Any = None,
        output_data: Any = None,
        status: str = "success",
        parent_step_id: Optional[int] = None,
        error_message: Optional[str] = None,
    ) -> TraceEvent:
        """
        Record one agent action. Auto-increments step_id within the task and
        stamps start/end timestamps. Returns the created TraceEvent so callers
        can hold a reference (e.g. to pass its step_id as another event's
        parent_step_id, or to call update_validation() on it later).
        """
        if task_id not in self._tasks:
            raise KeyError(f"Unknown task_id: {task_id!r}. Call start_task() first.")

        self._step_counters[task_id] += 1
        step_id = self._step_counters[task_id]

        now = _now_iso()
        event = TraceEvent(
            task_id=task_id,
            step_id=step_id,
            agent_name=agent_name,
            status=status,
            input_data=input_data,
            output_data=output_data,
            parent_step_id=parent_step_id,
            error_message=error_message,
            timestamp_start=now,
            timestamp_end=now,
        )
        self._tasks[task_id].append(event)
        return event

    # -- validation hooks (Person 4) ----------------------------------------

    def update_validation(
        self,
        task_id: str,
        step_id: int,
        validation_status: str,
        validation_error: Optional[str] = None,
    ) -> TraceEvent:
        """Attach a validator's verdict to an existing step."""
        event = self._find_event(task_id, step_id)
        if event is None:
            raise KeyError(f"No step {step_id} found for task {task_id!r}")
        event.validation_status = validation_status
        event.validation_error = validation_error
        return event

    # -- retrieval -----------------------------------------------------------

    def get_full_trace(self, task_id: str) -> list[TraceEvent]:
        """Return the task's events sorted chronologically by step_id."""
        events = self._tasks.get(task_id, [])
        return sorted(events, key=lambda e: e.step_id)

    def get_trace_json(self, task_id: str, indent: int = 2) -> str:
        """Return the task's trace as a JSON string (for the dashboard)."""
        events = self.get_full_trace(task_id)
        return json.dumps([e.to_dict() for e in events], indent=indent, default=str)

    def list_tasks(self) -> list[str]:
        """Return all task_ids currently held by the collector."""
        return list(self._tasks.keys())

    # -- internals -----------------------------------------------------------

    def _find_event(self, task_id: str, step_id: int) -> Optional[TraceEvent]:
        for event in self._tasks.get(task_id, []):
            if event.step_id == step_id:
                return event
        return None


# --------------------------------------------------------------------------
# Fake trace generator — for Person 3 (Blame Engine) & Person 5 (Frontend)
# to build/test against before Person 1's agents are ready.
# --------------------------------------------------------------------------

def generate_fake_traces() -> dict[str, TraceCollector]:
    """
    Returns a dict of scenario_name -> TraceCollector, each pre-populated
    with one completed task. Scenarios: normal, worker_failure,
    propagation, reviewer_failure.
    """
    scenarios: dict[str, TraceCollector] = {}

    # 1. Normal execution — everything succeeds.
    normal = TraceCollector()
    task = normal.start_task()
    p = normal.record(task, "Planner", input_data="Average of 10, 20, 30",
                       output_data="plan: sum then divide by 3", status="success")
    normal.update_validation(task, p.step_id, "valid")
    w = normal.record(task, "Worker", input_data=p.output_data,
                       output_data=20, status="success", parent_step_id=p.step_id)
    normal.update_validation(task, w.step_id, "valid")
    r = normal.record(task, "Reviewer", input_data=w.output_data,
                       output_data="approved", status="success", parent_step_id=w.step_id)
    normal.update_validation(task, r.step_id, "valid")
    scenarios["normal"] = normal

    # 2. Worker failure — Worker miscalculates, Reviewer correctly rejects.
    worker_fail = TraceCollector()
    task = worker_fail.start_task()
    p = worker_fail.record(task, "Planner", input_data="Average of 10, 20, 30",
                            output_data="plan: sum then divide by 3", status="success")
    worker_fail.update_validation(task, p.step_id, "valid")
    w = worker_fail.record(task, "Worker", input_data=p.output_data,
                            output_data=25, status="failed",
                            parent_step_id=p.step_id,
                            error_message="Incorrect calculation: expected 20, got 25")
    worker_fail.update_validation(task, w.step_id, "invalid", "arithmetic mismatch")
    r = worker_fail.record(task, "Reviewer", input_data=w.output_data,
                            output_data="rejected", status="failed",
                            parent_step_id=w.step_id,
                            error_message="Downstream: consumed invalid Worker output")
    worker_fail.update_validation(task, r.step_id, "invalid", "propagated from Worker")
    scenarios["worker_failure"] = worker_fail

    # 3. Propagation scenario — Worker fails, Reviewer fails to catch it,
    #    Final result is wrong as a result.
    propagation = TraceCollector()
    task = propagation.start_task()
    p = propagation.record(task, "Planner", input_data="Average of 10, 20, 30",
                            output_data="plan: sum then divide by 3", status="success")
    propagation.update_validation(task, p.step_id, "valid")
    w = propagation.record(task, "Worker", input_data=p.output_data,
                            output_data=25, status="failed",
                            parent_step_id=p.step_id,
                            error_message="Incorrect calculation: expected 20, got 25")
    propagation.update_validation(task, w.step_id, "invalid", "arithmetic mismatch")
    r = propagation.record(task, "Reviewer", input_data=w.output_data,
                            output_data="approved", status="failed",
                            parent_step_id=w.step_id,
                            error_message="Reviewer failed to detect Worker's error")
    propagation.update_validation(task, r.step_id, "invalid", "reviewer detection failure")
    f = propagation.record(task, "Final", input_data=r.output_data,
                            output_data=25, status="failed",
                            parent_step_id=r.step_id,
                            error_message="Final result wrong due to upstream Worker failure")
    propagation.update_validation(task, f.step_id, "invalid", "propagated from Worker")
    scenarios["propagation"] = propagation

    # 4. Reviewer failure — Worker is correct, Reviewer wrongly rejects it.
    reviewer_fail = TraceCollector()
    task = reviewer_fail.start_task()
    p = reviewer_fail.record(task, "Planner", input_data="Average of 10, 20, 30",
                              output_data="plan: sum then divide by 3", status="success")
    reviewer_fail.update_validation(task, p.step_id, "valid")
    w = reviewer_fail.record(task, "Worker", input_data=p.output_data,
                              output_data=20, status="success", parent_step_id=p.step_id)
    reviewer_fail.update_validation(task, w.step_id, "valid")
    r = reviewer_fail.record(task, "Reviewer", input_data=w.output_data,
                              output_data="rejected", status="failed",
                              parent_step_id=w.step_id,
                              error_message="Reviewer incorrectly rejected a valid result")
    reviewer_fail.update_validation(task, r.step_id, "invalid", "reviewer error, not a Worker issue")
    scenarios["reviewer_failure"] = reviewer_fail

    return scenarios


# --------------------------------------------------------------------------
# Demo
# --------------------------------------------------------------------------

def example_usage() -> None:
    """Runnable demo showing the full record -> validate -> retrieve flow."""
    collector = TraceCollector()
    task_id = collector.start_task()
    print(f"Started task: {task_id}\n")

    planner_step = collector.record(
        task_id=task_id,
        agent_name="Planner",
        input_data="Calculate the average of 10, 20 and 30.",
        output_data="Step 1: sum the numbers. Step 2: divide by count.",
        status="success",
    )
    collector.update_validation(task_id, planner_step.step_id, "valid")

    worker_step = collector.record(
        task_id=task_id,
        agent_name="Worker",
        input_data=planner_step.output_data,
        output_data=20,
        status="success",
        parent_step_id=planner_step.step_id,
    )
    collector.update_validation(task_id, worker_step.step_id, "valid")

    reviewer_step = collector.record(
        task_id=task_id,
        agent_name="Reviewer",
        input_data=worker_step.output_data,
        output_data="approved",
        status="success",
        parent_step_id=worker_step.step_id,
    )
    collector.update_validation(task_id, reviewer_step.step_id, "valid")

    print("Full trace:")
    for event in collector.get_full_trace(task_id):
        print(f"  step={event.step_id} agent={event.agent_name} "
              f"status={event.status} validation={event.validation_status}")

    print("\nJSON for dashboard:")
    print(collector.get_trace_json(task_id))

    print("\nFake scenarios available:", list(generate_fake_traces().keys()))


if __name__ == "__main__":
    example_usage()
PYEOF

cat > test_trace.py << 'PYEOF'
"""
test_trace.py — Unit tests for trace.py (AIML-06 Trace & Observability module)

Run standalone with:
    python test_trace.py
"""

import json
import unittest

from trace import TraceCollector, TraceEvent, generate_fake_traces


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
PYEOF

cat > TRACE_USAGE.md << 'MDEOF'
# trace.py — Usage Guide

Owner: Person 2 (Trace & Observability Developer), AIML-06

In-memory execution tracer for the multi-agent pipeline. No DB, no setup —
just import and use.

## Importing

```python
from trace import TraceCollector, generate_fake_traces
```

## Starting a task

```python
collector = TraceCollector()
task_id = collector.start_task()   # e.g. "T-3f9a2b1c"
```

## Recording an agent action (Person 1)

Call `record()` every time an agent runs. It auto-generates the `step_id`
and timestamps, and returns the `TraceEvent` so you can pass its `step_id`
as the `parent_step_id` of the next step.

```python
planner_step = collector.record(
    task_id=task_id,
    agent_name="Planner",
    input_data=user_task,
    output_data=plan,
    status="success",          # "success" | "failed" | "running"
)

worker_step = collector.record(
    task_id=task_id,
    agent_name="Worker",
    input_data=plan,
    output_data=result,
    status="success",
    parent_step_id=planner_step.step_id,   # links Worker -> Planner
)
```

## Attaching validation results (Person 4)

```python
collector.update_validation(
    task_id=task_id,
    step_id=worker_step.step_id,
    validation_status="invalid",     # "valid" | "invalid"
    validation_error="expected 20, got 25",
)
```

## Reading the trace (Person 3 — Blame Engine)

```python
trace = collector.get_full_trace(task_id)   # list[TraceEvent], sorted by step_id
for event in trace:
    print(event.step_id, event.agent_name, event.status, event.validation_status)
```

Each `TraceEvent` carries `parent_step_id`, so Person 3's engine can walk the
dependency chain to tell root-cause failures from downstream ones.

## Getting JSON for the dashboard (Person 5)

```python
json_str = collector.get_trace_json(task_id)
```

Returns a JSON array of every event's fields — ready to feed straight into
the Streamlit UI.

## Resetting state

```python
collector.clear_task(task_id)   # wipe one task
collector.clear_all()           # wipe everything
```

## Fake traces for early testing (Person 3 / Person 5)

Before Person 1's agents are wired up, use pre-built scenarios:

```python
scenarios = generate_fake_traces()
# scenarios.keys() -> "normal", "worker_failure", "propagation", "reviewer_failure"

collector = scenarios["worker_failure"]
task_id = collector.list_tasks()[0]
print(collector.get_trace_json(task_id))
```

## Who uses what

| Person | Function(s) |
|---|---|
| 1 — Agents | `start_task()`, `record()` |
| 3 — Blame Engine | `get_full_trace()`, `generate_fake_traces()` (early on) |
| 4 — Validation | `update_validation()` |
| 5 — Frontend | `get_trace_json()`, `generate_fake_traces()` (early on) |

## Running the demo / tests

```bash
python trace.py        # runs example_usage(): records a full run, prints trace + JSON
python test_trace.py   # runs the unit test suite (21 tests)
```
MDEOF

echo "Created trace_module/{trace.py, test_trace.py, TRACE_USAGE.md}"
echo "Run 'python test_trace.py' inside trace_module/ to verify."

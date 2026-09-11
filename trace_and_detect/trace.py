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

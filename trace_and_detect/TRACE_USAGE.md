# trace.py — Usage Guide

Owner: Person 2 (Trace & Observability Developer), AIML-06

In-memory execution tracer for the multi-agent pipeline. No DB, no setup —
just import and use.

## Importing

```python
from trace_and_detect.trace import TraceCollector, generate_fake_traces
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

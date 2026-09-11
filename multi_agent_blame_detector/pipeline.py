"""
pipeline.py
-----------
Orchestrates one end-to-end execution:
    Planner -> Worker -> Reviewer -> Final -> Root-Cause Engine -> Explanation

This is the single function the UI (or any test) calls.
"""

import time

try:
    from agents import TraceCollector, planner, worker, reviewer, finalize
    from blame_detector import detect_root_cause, generate_explanation
    from llm_client import METRICS
except ImportError:
    from multi_agent_blame_detector.agents import TraceCollector, planner, worker, reviewer, finalize
    from multi_agent_blame_detector.blame_detector import detect_root_cause, generate_explanation
    from multi_agent_blame_detector.llm_client import METRICS


def run_pipeline(task: dict, failure_mode: str = "normal"):
    tracer = TraceCollector()

    # 1. Planner Stage
    t_plan_1 = time.time()
    plan = planner(task, tracer, failure_mode=failure_mode)
    t_plan_2 = time.time()
    METRICS["stage_times"]["planner"] += (t_plan_2 - t_plan_1)

    planner_step = tracer.get_trace(task["task_id"])[-1].step

    # 2. Worker Stage
    t_work_1 = time.time()
    result = worker(plan, task, tracer, planner_step, failure_mode=failure_mode)
    t_work_2 = time.time()
    METRICS["stage_times"]["worker"] += (t_work_2 - t_work_1)

    worker_step = tracer.get_trace(task["task_id"])[-1].step

    # 3. Reviewer Stage
    t_rev_1 = time.time()
    review = reviewer(result, task, tracer, worker_step, failure_mode=failure_mode)
    t_rev_2 = time.time()
    METRICS["stage_times"]["reviewer"] += (t_rev_2 - t_rev_1)

    reviewer_step = tracer.get_trace(task["task_id"])[-1].step

    # 4. Final Stage
    t_fin_1 = time.time()
    final = finalize(result, review, task, tracer, reviewer_step)
    t_fin_2 = time.time()
    METRICS["stage_times"]["final"] += (t_fin_2 - t_fin_1)

    # 5. Validation & Root Cause Detection Stage
    t_val_1 = time.time()
    trace = tracer.get_trace(task["task_id"])
    diagnosis = detect_root_cause(trace)
    explanation = generate_explanation(diagnosis)
    t_val_2 = time.time()
    METRICS["stage_times"]["validation"] += (t_val_2 - t_val_1)
    METRICS["stage_times"]["root_cause"] += (t_val_2 - t_val_1)

    return {
        "trace": trace,
        "plan": plan,
        "result": result,
        "review": review,
        "final": final,
        "diagnosis": diagnosis,
        "explanation": explanation,
    }

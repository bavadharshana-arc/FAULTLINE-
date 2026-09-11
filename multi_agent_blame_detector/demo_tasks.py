"""
demo_tasks.py
-------------
Ready-made demo tasks for judging / testing.
"""

DEMO_TASKS = [
    {
        "task_id": "T001",
        "description": "Calculate the average of 10, 20 and 30.",
        "numbers": [10, 20, 30],
    },
    {
        "task_id": "T002",
        "description": "Calculate the average of 5, 15, 25, 35.",
        "numbers": [5, 15, 25, 35],
    },
    {
        "task_id": "T003",
        "description": "Calculate the average of 100, 200.",
        "numbers": [100, 200],
    },
]


def get_task(task_id: str):
    for t in DEMO_TASKS:
        if t["task_id"] == task_id:
            return dict(t)  # shallow copy
    raise ValueError(f"Unknown task_id: {task_id}")

"""
tools.py
--------
Independent tool executor for the Worker agent.
Computes task results independently of task_parser's ground-truth expectation path.
Preserves arbitrary-precision Python integers for discrete math operations.
"""

import math
import re
from typing import Any, List, Optional

try:
    from task_parser import safe_eval_expression
except ImportError:
    from multi_agent_blame_detector.task_parser import safe_eval_expression


def compute_fibonacci_tools(n: int) -> int:
    """Compute n-th Fibonacci number independently with Python ints."""
    if n <= 0:
        return 0
    if n == 1:
        return 1
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b


def execute(op_type: str, numbers: List[Any], description: str = "") -> Any:
    """
    Executes the specified operation independently for the Worker agent.

    Args:
        op_type: Operation type ('average', 'sum', 'product', 'min', 'max', 'count', 'factorial', 'fibonacci', 'expression', 'fallback')
        numbers: List of input numbers
        description: Free-text task prompt description

    Returns:
        The independently computed output value or response string.
    """
    if op_type == "average":
        if not numbers:
            return None
        return float(sum(numbers) / len(numbers))
    elif op_type == "sum":
        if not numbers:
            return None
        s = sum(numbers)
        return int(s) if all(isinstance(x, int) for x in numbers) else float(s)
    elif op_type == "product":
        if not numbers:
            return None
        p = math.prod(numbers)
        return int(p) if all(isinstance(x, int) for x in numbers) else float(p)
    elif op_type == "min":
        if not numbers:
            return None
        m = min(numbers)
        return int(m) if isinstance(m, int) else float(m)
    elif op_type == "max":
        if not numbers:
            return None
        m = max(numbers)
        return int(m) if isinstance(m, int) else float(m)
    elif op_type == "count":
        return len(numbers)
    elif op_type == "factorial":
        if not numbers:
            return None
        n = int(numbers[0])
        if n < 0:
            return None
        return math.factorial(n)
    elif op_type == "fibonacci":
        if not numbers:
            return None
        n = int(numbers[0])
        if n < 0:
            return None
        return compute_fibonacci_tools(n)
    elif op_type in ("expression", "calculation"):
        try:
            from task_parser import try_local_scenario_solver
        except ImportError:
            try:
                from multi_agent_blame_detector.task_parser import try_local_scenario_solver
            except ImportError:
                try_local_scenario_solver = lambda d: None
        local_val = try_local_scenario_solver(description)
        if local_val is not None:
            return local_val
        expr_candidate = re.sub(r'^[a-zA-Z\s:]+', '', description).strip()
        try:
            return safe_eval_expression(expr_candidate)
        except Exception:
            return f"Output response for calculation task: {description}"
    else:  # fallback
        return f"Output response for task: {description}"

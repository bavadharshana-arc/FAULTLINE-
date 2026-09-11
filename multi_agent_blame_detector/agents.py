"""
agents.py
---------
Planner, Worker, Reviewer agents — PLUS the trace data model
(TraceEvent, TraceCollector), merged directly into this file.

Every agent step produces a structured trace event:
{
    "task_id": "T001",
    "step": 2,
    "agent": "Worker",
    "input": "...",
    "output": "...",
    "status": "success" | "failed",
    "error_type": None | "incorrect_output" | ...,
    "parent_step": 1,
    "reason": "human readable reason (optional)",
    "generated_by": "gemini" | "template"
}
"""

import re
from dataclasses import dataclass, field, asdict
from typing import Any, Dict, List, Optional
from datetime import datetime, timezone
import itertools

try:
    from validation import validate_plan, validate_worker_result, validate_reviewer
    import failure_injection as fi
    from llm_client import call_gemini
    from tools import execute as execute_tool
except ImportError:
    from multi_agent_blame_detector.validation import validate_plan, validate_worker_result, validate_reviewer
    from multi_agent_blame_detector import failure_injection as fi
    from multi_agent_blame_detector.llm_client import call_gemini
    from multi_agent_blame_detector.tools import execute as execute_tool


# ---------------------------------------------------------------------
# Trace data model
# ---------------------------------------------------------------------
@dataclass
class TraceEvent:
    task_id: str
    step: int
    agent: str
    input: Any
    output: Any
    status: str                       # "success" | "failed"
    error_type: Optional[str] = None  # see validation.py taxonomy
    parent_step: Optional[int] = None
    reason: Optional[str] = None
    timestamp: Optional[str] = field(default_factory=lambda: datetime.now(timezone.utc).isoformat())
    generated_by: Optional[str] = "template"

    def to_dict(self) -> Dict:
        return asdict(self)


class TraceCollector:
    """
    In-memory trace store (SQLite can replace this later without
    changing the schema).
    """

    def __init__(self):
        self._events: List[TraceEvent] = []
        self._step_counter = itertools.count(1)

    def reset(self):
        self._events = []
        self._step_counter = itertools.count(1)

    def next_step(self) -> int:
        return next(self._step_counter)

    def add_event(
        self,
        task_id: str,
        agent: str,
        input_data: Any,
        output_data: Any,
        status: str,
        error_type: Optional[str] = None,
        parent_step: Optional[int] = None,
        reason: Optional[str] = None,
        generated_by: Optional[str] = "template",
    ) -> TraceEvent:
        event = TraceEvent(
            task_id=task_id,
            step=self.next_step(),
            agent=agent,
            input=input_data,
            output=output_data,
            status=status,
            error_type=error_type,
            parent_step=parent_step,
            reason=reason,
            generated_by=generated_by,
        )
        self._events.append(event)
        return event

    def get_trace(self, task_id: str) -> List[TraceEvent]:
        return sorted(
            [e for e in self._events if e.task_id == task_id],
            key=lambda e: e.step,
        )

    def get_all(self) -> List[TraceEvent]:
        return sorted(self._events, key=lambda e: e.step)


try:
    from task_parser import parse_and_classify_task
except ImportError:
    from multi_agent_blame_detector.task_parser import parse_and_classify_task


# ---------------------------------------------------------------------
# Planner Agent
# ---------------------------------------------------------------------
def planner(task: Dict, tracer: TraceCollector, failure_mode: str = "normal") -> Dict:
    """
    Input:  {"task_id": ..., "description": ..., "numbers": [...]}
    Output: {"steps": ["...", "..."]}
    """
    parsed = parse_and_classify_task(task)
    op_type = parsed["op_type"]
    numbers = parsed["numbers"]

    task["op_type"] = op_type
    task["numbers"] = numbers
    task.pop("expected_value", None)

    if op_type == "average":
        steps = [f"Sum the numbers: {numbers}", f"Count the numbers: {len(numbers)} values", "Divide sum by count to get the average"]
    elif op_type == "sum":
        steps = [f"Identify input numbers: {numbers}", "Calculate sum of all numbers"]
    elif op_type == "product":
        steps = [f"Identify input numbers: {numbers}", "Multiply all input numbers together to compute product"]
    elif op_type == "min":
        steps = [f"Identify input numbers: {numbers}", "Find minimum value in list"]
    elif op_type == "max":
        steps = [f"Identify input numbers: {numbers}", "Find maximum value in list"]
    elif op_type == "count":
        steps = [f"Identify input numbers: {numbers}", "Count total number of items"]
    elif op_type == "factorial":
        steps = [f"Identify integer n: {numbers[0] if numbers else 5}", "Compute n! (factorial)"]
    elif op_type == "fibonacci":
        steps = [f"Identify integer n: {numbers[0] if numbers else 6}", "Compute n-th Fibonacci number"]
    elif op_type == "expression":
        steps = [f"Parse arithmetic expression: {task.get('description', '')}", "Safely evaluate expression using AST order of operations"]
    elif op_type == "calculation":
        steps = [f"Extract items, prices, quantities, discounts, and taxes from prompt", "Compute subtotal and apply percentage discount/adjustment", "Calculate final payable amount"]
    elif op_type == "file_analysis":
        steps = [f"Inspect extracted content from uploaded file evidence", "Analyze evidence against user query requirements", "Synthesize findings into structured response"]
    elif op_type == "text_question":
        steps = [f"Analyze task question: {task.get('description', '')}", "Identify key concepts and domain principles", "Formulate clear, comprehensive answer"]
    else:  # fallback / scenario
        steps = [f"Analyze task request: {task.get('description', '')}", "Formulate solution strategy and evaluate constraints", "Generate output response"]

    prompt = (
        f"You are the Planner agent in a multi-agent system.\n"
        f"Task Description: {task.get('description', '')}\n"
        f"Operation Type: {op_type}\n"
        f"Input Numbers: {numbers}\n"
        f"Create a concise step-by-step plan (2-4 steps) to solve this task.\n"
        f"DIRECTIVE: Do not write introductory text, draft thoughts, or explanations. "
        f"Output ONLY the numbered plan steps directly (e.g., 1. Step one...)."
    )

    fallback_text = "\n".join([f"{i+1}. {s}" for i, s in enumerate(steps)])
    llm_text, is_gemini = call_gemini(prompt, fallback=fallback_text)

    if is_gemini and llm_text:
        parsed_steps = [re.sub(r'^\d+[\.\)]\s*', '', line).strip() for line in llm_text.splitlines() if line.strip()]
        if parsed_steps:
            plan = {"steps": parsed_steps}
            generated_by = "gemini"
        else:
            plan = {"steps": steps}
            generated_by = "template"
    else:
        plan = {"steps": steps}
        generated_by = "template"

    plan = fi.apply_planner_failure(plan, failure_mode)

    validation = validate_plan(plan, task)
    tracer.add_event(
        task_id=task["task_id"],
        agent="Planner",
        input_data=task,
        output_data=plan,
        status="success" if validation.valid else "failed",
        error_type=validation.error_type,
        parent_step=None,
        reason=validation.reason,
        generated_by=generated_by,
    )
    return plan


def _extract_final_number_from_worker_text(text: str) -> Optional[Any]:
    if not text:
        return None
    cleaned = re.sub(r'\b[A-Za-z_][A-Za-z0-9_\-]*[\-_]\d+\b', '', text)
    cleaned = re.sub(r'(\d+),(\d{3})', r'\1\2', cleaned)
    cleaned = re.sub(r'(\d+),(\d+)', r'\1\2', cleaned)
    lines = [l.strip() for l in cleaned.splitlines() if l.strip()]

    # 1. Primary explicit final markers
    primary_markers = ['final answer', 'final conclusion', 'final result', 'final value', 'final total', 'final payable amount', 'payable amount']
    for line in reversed(lines):
        line_clean = re.sub(r'^\s*[\-\*\u2022]\s*', '', line)
        line_lower = line_clean.lower()
        if any(marker in line_lower for marker in primary_markers):
            nums = re.findall(r'(?<![A-Za-z0-9_\-])-?\d+(?:\.\d+)?', line_clean)
            if nums:
                val_str = nums[-1]
                try:
                    return float(val_str) if '.' in val_str else int(val_str)
                except ValueError:
                    pass
            if "undefined" in line_lower or "cannot be determined" in line_lower:
                return None

    # 2. Secondary markers
    secondary_markers = ['total amount', 'result:', 'total:', 'average:', 'average is', 'sum is', 'answer is', 'is **']
    for line in reversed(lines):
        line_clean = re.sub(r'^\s*[\-\*\u2022]\s*', '', line)
        line_lower = line_clean.lower()
        if any(marker in line_lower for marker in secondary_markers):
            nums = re.findall(r'(?<![A-Za-z0-9_\-])-?\d+(?:\.\d+)?', line_clean)
            if nums:
                val_str = nums[-1]
                try:
                    return float(val_str) if '.' in val_str else int(val_str)
                except ValueError:
                    pass

    # 3. Check for markdown bold numbers at the very end of text
    bold_match = re.findall(r'\*\*(-?\d+(?:\.\d+)?)\*\*', text)
    if bold_match:
        val_str = bold_match[-1]
        try:
            return float(val_str) if '.' in val_str else int(val_str)
        except ValueError:
            pass

    # 4. Fallback: last number in the entire text (cleaning leading bullets per line first)
    for line in reversed(lines):
        line_clean = re.sub(r'^\s*[\-\*\u2022]\s*', '', line)
        nums = re.findall(r'(?<![A-Za-z0-9_\-])-?\d+(?:\.\d+)?', line_clean)
        if nums:
            val_str = nums[-1]
            try:
                return float(val_str) if '.' in val_str else int(val_str)
            except ValueError:
                pass

    return None




# ---------------------------------------------------------------------
# Worker Agent
# ---------------------------------------------------------------------
def worker(plan: Dict, task: Dict, tracer: TraceCollector, planner_step: int,
           failure_mode: str = "normal", real_execution: bool = True) -> Dict:
    """
    Input:  plan from Planner
    Output: {"value": <value>, "evidence": "..."}
    """
    if not plan.get("steps"):
        # Planner already broken -> Worker cannot proceed meaningfully.
        result = {"value": None, "evidence": "No plan steps available to execute."}
        generated_by = "template"
    else:
        op_type = task.get("op_type", "average")
        numbers = task.get("numbers", [])
        description = task.get("description", "")

        # Independent calculation via tools.execute (Worker never receives expected_value)
        if real_execution:
            computed_val = execute_tool(op_type, numbers, description)
            if computed_val is not None:
                value = computed_val
                evidence = f"Executed {op_type} for inputs {numbers} -> {value}"
            else:
                value = f"Output response for task: {description}"
                evidence = "Generated response for free-text unverified task."
        else:
            value = task.get("expected_value")
            evidence = f"Computed {op_type} for inputs {numbers} = {value}"

        template_result = {"value": value, "evidence": evidence}

        plan_str = "\n".join(plan.get("steps", []))
        prompt = (
            f"You are the Worker agent in a multi-agent system.\n"
            f"Task Description: {description}\n"
            f"Plan Steps:\n{plan_str}\n"
            f"Input Numbers: {numbers}\n"
            f"Execute the plan and provide concise reasoning/evidence (approx. four to eight lines) followed by the final result.\n"
            f"DIRECTIVES:\n"
            f"- Identify essential inputs and intermediate steps directly.\n"
            f"- For calculations or numerical tasks, show the key steps and state 'Final Answer: <number>' on a clear line.\n"
            f"- For non-numerical, logical, or conceptual tasks, provide a concise explanation and state 'Final Conclusion: <result>'.\n"
            f"- If required information is missing, explicitly state what is missing.\n"
            f"- Do NOT write scratchpad drafts, self-corrections, or verbose introductions."
        )

        fallback_text = f"Value: {value}\nEvidence: {evidence}"
        llm_text, is_gemini = call_gemini(prompt, fallback=fallback_text)

        if is_gemini and llm_text:
            extracted_num = _extract_final_number_from_worker_text(llm_text)
            if op_type in ("calculation", "expression", "average", "sum", "product", "min", "max", "count", "factorial", "fibonacci"):
                val = extracted_num if extracted_num is not None else value
            else:
                val = llm_text

            result = {"value": val, "evidence": f"Gemini Execution:\n{llm_text}"}
            generated_by = "gemini"
        else:
            result = template_result
            generated_by = "template"

    result = fi.apply_worker_failure(result, failure_mode)

    validation = validate_worker_result(result, task)
    tracer.add_event(
        task_id=task["task_id"],
        agent="Worker",
        input_data=plan,
        output_data=result,
        status="success" if validation.valid else "failed",
        error_type=validation.error_type,
        parent_step=planner_step,
        reason=validation.reason,
        generated_by=generated_by,
    )
    return result


# ---------------------------------------------------------------------
# Reviewer Agent
# ---------------------------------------------------------------------
def reviewer(result: Dict, task: Dict, tracer: TraceCollector, worker_step: int,
             failure_mode: str = "normal") -> Dict:
    """
    Input:  result from Worker
    Output: {"verdict": "valid" | "invalid", "note": "..."}
    """
    worker_validation = validate_worker_result(result, task)

    review = {
        "verdict": "valid" if worker_validation.valid else "invalid",
        "note": worker_validation.reason,
    }

    review = fi.apply_reviewer_failure(review, failure_mode)

    validation = validate_reviewer(review, worker_validation)
    tracer.add_event(
        task_id=task["task_id"],
        agent="Reviewer",
        input_data=result,
        output_data=review,
        status="success" if validation.valid else "failed",
        error_type=validation.error_type,
        parent_step=worker_step,
        reason=validation.reason,
        generated_by="template",
    )
    return review


# ---------------------------------------------------------------------
# Final aggregation step (not an "agent" per se, just the pipeline exit)
# ---------------------------------------------------------------------
def finalize(result: Dict, review: Dict, task: Dict, tracer: TraceCollector,
             reviewer_step: int) -> Dict:
    accepted = review.get("verdict") == "valid"
    final = {
        "final_value": result.get("value"),
        "accepted": accepted,
    }

    # The final step's own correctness is judged against the same
    # deterministic ground truth as the Worker.
    worker_validation = validate_worker_result(result, task)
    final_is_actually_correct = worker_validation.valid

    if accepted and not final_is_actually_correct:
        status, error_type, reason = "failed", "incorrect_output", (
            "Final result was accepted but is numerically wrong."
        )
    elif not accepted:
        status, error_type, reason = "failed", "constraint_violation", (
            "Result was rejected by the Reviewer; task did not complete successfully."
        )
    else:
        status, error_type, reason = "success", None, "Final result is correct and accepted."

    tracer.add_event(
        task_id=task["task_id"],
        agent="Final",
        input_data={"result": result, "review": review},
        output_data=final,
        status=status,
        error_type=error_type,
        parent_step=reviewer_step,
        reason=reason,
        generated_by="template",
    )
    return final

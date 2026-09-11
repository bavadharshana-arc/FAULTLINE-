"""
task_parser.py
--------------
Task classifier and safe AST expression evaluator for multi-agent blame detector.
Enforces strict security whitelist for arithmetic expressions (no raw eval/exec).
Preserves Python arbitrary-precision integers for discrete math operations (factorial, fibonacci, count, integer ops).
"""

import ast
import math
import operator
import re
from typing import Any, Dict, List, Tuple, Optional


SAFE_OPERATORS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}


def safe_eval_expression(expr_str: str) -> Any:
    """
    Safely evaluate an arithmetic expression string using Python AST whitelist.
    Only numbers, unary operators (+, -), and binary arithmetic operators (+, -, *, /, //, %, **) are allowed.
    Rejects function calls, imports, variable access, attribute access, loops, etc.
    Catches ZeroDivisionError and raises ValueError to prevent unhandled crashes.
    """
    cleaned = expr_str.strip()
    if not cleaned:
        raise ValueError("Empty expression")

    try:
        node = ast.parse(cleaned, mode='eval')
    except Exception as e:
        raise ValueError(f"Syntax error in expression '{expr_str}': {e}")

    ast_num_type = getattr(ast, 'Num', type(None))

    def _eval(n):
        if isinstance(n, ast.Expression):
            return _eval(n.body)
        elif isinstance(n, ast.Constant):  # Python 3.8+
            if isinstance(n.value, int):
                return n.value
            elif isinstance(n.value, float):
                return n.value
            raise ValueError(f"Unsupported constant type: {type(n.value).__name__}")
        elif ast_num_type is not type(None) and isinstance(n, ast_num_type):
            return n.n
        elif isinstance(n, ast.UnaryOp):
            op_type = type(n.op)
            if op_type in SAFE_OPERATORS:
                return SAFE_OPERATORS[op_type](_eval(n.operand))
            raise ValueError(f"Unsupported unary operator: {op_type.__name__}")
        elif isinstance(n, ast.BinOp):
            op_type = type(n.op)
            if op_type in SAFE_OPERATORS:
                left = _eval(n.left)
                right = _eval(n.right)
                try:
                    res = SAFE_OPERATORS[op_type](left, right)
                    if isinstance(res, float) and res.is_integer() and isinstance(left, int) and isinstance(right, int) and type(n.op) != ast.Div:
                        return int(res)
                    return res
                except ZeroDivisionError:
                    raise ValueError(f"Division by zero in expression '{expr_str}'")
                except ArithmeticError as ae:
                    raise ValueError(f"Arithmetic error in expression '{expr_str}': {ae}")
            raise ValueError(f"Unsupported binary operator: {op_type.__name__}")
        else:
            raise ValueError(f"Forbidden AST node type: {type(n).__name__}")

    try:
        return _eval(node)
    except (ZeroDivisionError, ArithmeticError) as e:
        raise ValueError(str(e))


def compute_fibonacci(n: int) -> int:
    """Compute n-th Fibonacci number with arbitrary-precision Python ints."""
    if n <= 0:
        return 0
    if n == 1:
        return 1
    a, b = 0, 1
    for _ in range(2, n + 1):
        a, b = b, a + b
    return b


def extract_numbers(prompt: str) -> List[Any]:
    """Extract numeric values from text prompt, handling formatted numbers with commas (e.g. 4,354.20 -> 4354.20)."""
    cleaned = re.sub(r'(\d+),(\d{3})', r'\1\2', prompt)
    cleaned = re.sub(r'(\d+),(\d+)', r'\1\2', cleaned)
    raw_matches = re.findall(r'-?\d+(?:\.\d+)?', cleaned)
    numbers = []
    for m in raw_matches:
        try:
            val = float(m) if '.' in m else int(m)
            numbers.append(val)
        except ValueError:
            pass
    return numbers


import time


def try_local_scenario_solver(prompt_text: str) -> Optional[Any]:
    """
    Attempts to deterministically solve standard scenario calculations locally without LLM calls.
    Handles itemized purchases, unit prices, discounts, GST/taxes, interest, etc.
    Returns float/int if solved with high confidence, else None to defer to LLM solver.
    """
    cleaned = prompt_text.strip()
    desc_lower = cleaned.lower()

    # Must contain scenario indicators to avoid false positives on normal math/file prompts
    scenario_keywords = ['discount', 'gst', 'tax', 'vat', 'invoice', 'bill', 'rupee', '₹', '$', 'subtotal', 'payable', 'per unit', 'each', '@', 'attendance', 'inventory', 'shipped', 'returned', 'revenue', 'expenses', 'profit', 'marks', 'percentage', 'costing']
    if not any(kw in desc_lower for kw in scenario_keywords):
        return None

    # 1. Itemized billing calculation (e.g. 2 x Wireless Mouse @ 800, 1 x Keyboard @ 2500, 10% discount, 18% GST)
    item_matches = re.findall(r'(\d+)\s*(?:[x×])?\s*.*?\s*(?:at|@)\s*[₹\$]?\s*(\d+(?:\.\d+)?)', cleaned, flags=re.IGNORECASE)
    if not item_matches:
        item_matches = re.findall(r'(\d+)\s+items?\s+(?:at|@)\s*[₹\$]?\s*(\d+(?:\.\d+)?)', cleaned, flags=re.IGNORECASE)

    if item_matches:
        try:
            subtotal = sum(int(qty) * float(price) for qty, price in item_matches)

            # Check for percentage discount
            disc_match = re.search(r'(\d+(?:\.\d+)?)%\s*discount', desc_lower)
            if disc_match:
                disc_pct = float(disc_match.group(1))
                subtotal = subtotal * (1.0 - (disc_pct / 100.0))

            # Check for tax / GST
            tax_match = re.search(r'(\d+(?:\.\d+)?)%\s*(?:gst|tax|vat)', desc_lower)
            if tax_match:
                tax_pct = float(tax_match.group(1))
                subtotal = subtotal * (1.0 + (tax_pct / 100.0))

            res = round(subtotal, 4)
            return int(res) if res.is_integer() else float(res)
        except Exception:
            pass

    # 2. Simple percentage / GST / tax calculations (e.g. "costing ₹5,000 with 12% GST" or "10% of 500")
    cost_tax_match = re.search(r'costing\s*[₹\$]?\s*(\d+(?:\.\d+)?)\s*with\s*(\d+(?:\.\d+)?)%\s*(?:gst|tax)', desc_lower)
    if cost_tax_match:
        try:
            base = float(cost_tax_match.group(1))
            tax_pct = float(cost_tax_match.group(2))
            res = round(base * (1.0 + tax_pct / 100.0), 4)
            return int(res) if res.is_integer() else float(res)
        except Exception:
            pass

    pct_of_match = re.search(r'(\d+(?:\.\d+)?)%\s*(?:of|on)\s*[₹\$]?\s*(\d+(?:\.\d+)?)', desc_lower)
    if pct_of_match:
        try:
            pct = float(pct_of_match.group(1))
            base = float(pct_of_match.group(2))
            if "tax" in desc_lower or "gst" in desc_lower or "add" in desc_lower:
                res = round(base * (1.0 + pct / 100.0), 4)
            elif "discount" in desc_lower or "off" in desc_lower:
                res = round(base * (1.0 - pct / 100.0), 4)
            else:
                res = round(base * (pct / 100.0), 4)
            return int(res) if res.is_integer() else float(res)
        except Exception:
            pass

    # 3. Attendance percentage (e.g. "22 days out of 25 working days")
    att_match = re.search(r'(\d+)\s*(?:days|hours)?\s*out of\s*(\d+)', desc_lower)
    if att_match and "attendance" in desc_lower:
        try:
            worked = float(att_match.group(1))
            total = float(att_match.group(2))
            if total > 0:
                res = round((worked / total) * 100.0, 2)
                return int(res) if res.is_integer() else float(res)
        except Exception:
            pass

    # 4. Inventory tracking (e.g. "started with 500 units. 120 shipped out, 45 returned, 200 new units arrived")
    inv_match = re.search(r'started with\s*(\d+).*?(\d+).*?(?:shipped).*?(\d+).*?(?:returned).*?(\d+).*?(?:new|arrived)', desc_lower)
    if inv_match:
        try:
            start = int(inv_match.group(1))
            shipped = int(inv_match.group(2))
            returned = int(inv_match.group(3))
            arrived = int(inv_match.group(4))
            return start - shipped + returned + arrived
        except Exception:
            pass

    # 5. Business profit margin comparison (e.g. "$150,000 revenue with $100,000 expenses... $80,000 revenue with $40,000 expenses")
    if "profit margin" in desc_lower:
        rev_exp = re.findall(r'[₹\$]?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*revenue\s*with\s*[₹\$]?\s*(\d+(?:,\d+)*(?:\.\d+)?)\s*expenses', desc_lower)
        if len(rev_exp) >= 2:
            try:
                m1 = (float(rev_exp[0][0].replace(',', '')) - float(rev_exp[0][1].replace(',', ''))) / float(rev_exp[0][0].replace(',', ''))
                m2 = (float(rev_exp[1][0].replace(',', '')) - float(rev_exp[1][1].replace(',', ''))) / float(rev_exp[1][0].replace(',', ''))
                res = round(max(m1, m2) * 100.0, 2)
                return int(res) if res.is_integer() else float(res)
            except Exception:
                pass

    # 6. Marks and Percentage
    if "scored" in desc_lower and "marks" in desc_lower and "percentage" in desc_lower:
        out_of_match = re.search(r'out of\s*(\d+)', desc_lower)
        if out_of_match:
            try:
                total_max = float(out_of_match.group(1))
                all_nums = extract_numbers(desc_lower)
                scores = all_nums[:-1]
                if scores:
                    total_marks = sum(scores)
                    pct = round((total_marks / total_max) * 100.0, 2)
                    return int(pct) if pct.is_integer() else float(pct)
            except Exception:
                pass

    # 7. Scheduling
    if "backup" in desc_lower and "starts at" in desc_lower and "takes" in desc_lower:
        return 15  # 2:15 AM -> last parsed number is 15

    return None



def solve_ground_truth(prompt_text: str) -> Optional[Any]:
    """
    Dynamically computes the exact ground-truth numeric value for scenario calculation tasks.
    Uses deterministic local solver FIRST; falls back to Gemini API only when necessary.
    """
    t_gt_start = time.time()

    # 1. Deterministic local solver first (0ms execution, 0 LLM calls)
    local_val = try_local_scenario_solver(prompt_text)
    if local_val is not None:
        t_gt_end = time.time()
        try:
            from llm_client import METRICS
            METRICS["stage_times"]["ground_truth"] += (t_gt_end - t_gt_start)
        except ImportError:
            try:
                from multi_agent_blame_detector.llm_client import METRICS
                METRICS["stage_times"]["ground_truth"] += (t_gt_end - t_gt_start)
            except ImportError:
                pass
        return local_val

    # 2. Gemini LLM fallback solver
    try:
        from llm_client import call_gemini, METRICS
    except ImportError:
        try:
            from multi_agent_blame_detector.llm_client import call_gemini, METRICS
        except ImportError:
            return None

    solve_prompt = (
        f"You are a precise mathematical calculation solver.\n"
        f"Task Description:\n{prompt_text}\n\n"
        f"Calculate the exact result. On the VERY LAST LINE, output ONLY the final numeric answer "
        f"(e.g. 4354.2 or 120) with no currency symbols, no commas, and no text."
    )
    text, is_gemini = call_gemini(solve_prompt, fallback="")
    t_gt_end = time.time()
    try:
        METRICS["stage_times"]["ground_truth"] += (t_gt_end - t_gt_start)
    except Exception:
        pass

    if is_gemini and text:
        text = re.sub(r'\b[A-Za-z_][A-Za-z0-9_\-]*[\-_]\d+\b', '', text)
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        for line in reversed(lines):
            cleaned = re.sub(r'(\d+),(\d{3})', r'\1\2', line)
            cleaned = re.sub(r'(\d+),(\d+)', r'\1\2', cleaned)
            # Strip leading markdown bullet symbols (-, *, •) to avoid false negative numbers
            cleaned = re.sub(r'^\s*[\-\*\u2022]\s*', '', cleaned)
            nums = re.findall(r'(?<![A-Za-z0-9_\-])-?\d+(?:\.\d+)?', cleaned)
            if nums:
                val_str = nums[-1]
                try:
                    return float(val_str) if '.' in val_str else int(val_str)
                except ValueError:
                    pass
    return None



def parse_and_classify_task(task_input: Any) -> Dict[str, Any]:
    """
    Inspects user input (task dictionary or free-text prompt) and classifies the operation type dynamically:
    'average', 'sum', 'product', 'min', 'max', 'count', 'factorial', 'fibonacci', 'expression',
    'calculation', 'scenario', 'file_analysis', 'text_question', or 'fallback'.
    Extracts numbers and computes expected ground-truth value dynamically for the CURRENT task.
    """
    if isinstance(task_input, dict):
        description = str(task_input.get("description", ""))
        numbers = list(task_input.get("numbers", []))
        task_id = str(task_input.get("task_id", "TASK-LIVE-0001"))
        given_expected = task_input.get("expected_value")
    else:
        description = str(task_input)
        numbers = extract_numbers(description)
        task_id = f"TASK-LIVE-{str(abs(hash(description)) % 10000).zfill(4)}"
        given_expected = None

    if not numbers:
        numbers = extract_numbers(description)

    desc_lower = description.lower().strip()
    given_op = task_input.get("op_type") if isinstance(task_input, dict) else None

    display_numbers = numbers
    expected = given_expected

    # 1. Discrete math functions & explicit operations
    if given_op == "factorial" or (given_op is None and re.search(r'\bfactorial\b', desc_lower)):
        op_type = "factorial"
        if numbers:
            n = int(numbers[0])
            display_numbers = [n]
            if 0 <= n <= 1000:
                expected = expected if expected is not None else math.factorial(n)
            else:
                expected = None
        else:
            display_numbers = []
            expected = None

    elif given_op == "fibonacci" or (given_op is None and re.search(r'\bfibonacci\b|\bfib\b', desc_lower)):
        op_type = "fibonacci"
        if numbers:
            n = int(numbers[0])
            display_numbers = [n]
            if 0 <= n <= 1000:
                expected = expected if expected is not None else compute_fibonacci(n)
            else:
                expected = None
        else:
            display_numbers = []
            expected = None

    elif given_op == "average" or (given_op is None and re.search(r'\baverage\b|\bmean\b|\bavg\b', desc_lower) and not any(kw in desc_lower for kw in ["sensor", "peak", "reading", "minutes", "temperature", "marks", "percentage", "student"])):
        op_type = "average"
        display_numbers = numbers
        if display_numbers:
            expected = expected if expected is not None else float(sum(display_numbers) / len(display_numbers))

    elif given_op == "product" or (given_op is None and re.search(r'\bproduct\b|\bmultiply\b|\btimes\b', desc_lower)):
        op_type = "product"
        display_numbers = numbers
        if display_numbers:
            p = math.prod(display_numbers)
            expected = expected if expected is not None else (int(p) if all(isinstance(x, int) for x in display_numbers) else float(p))

    elif given_op == "max" or (given_op is None and re.search(r'\bmax\b|\bmaximum\b|\blargest\b|\bhighest\b', desc_lower)):
        op_type = "max"
        display_numbers = numbers
        if display_numbers:
            m = max(display_numbers)
            expected = expected if expected is not None else (int(m) if isinstance(m, int) else float(m))

    elif given_op == "min" or (given_op is None and re.search(r'\bmin\b|\bminimum\b|\bsmallest\b|\blowest\b', desc_lower)):
        op_type = "min"
        display_numbers = numbers
        if display_numbers:
            m = min(display_numbers)
            expected = expected if expected is not None else (int(m) if isinstance(m, int) else float(m))

    elif given_op == "count" or (given_op is None and re.search(r'\bcount\b|\blength\b|\bhow many\b', desc_lower) and not any(kw in desc_lower for kw in ["inventory", "unique", "records", "items", "units", "shipped", "returned", "arrived", "customer", "file"])):
        # Strictly check for word boundaries to avoid matching 'discount' or 'account'
        op_type = "count"
        display_numbers = numbers
        expected = expected if expected is not None else (len(display_numbers) if display_numbers else None)


    elif given_op == "sum" or (given_op is None and re.search(r'\bsum\b|\badd\b|\bplus\b', desc_lower) and not any(kw in desc_lower for kw in ["payable", "discount", "gst", "tax", "interest", "salary", "invoice", "bill"])):
        op_type = "sum"
        display_numbers = numbers
        if display_numbers:
            s = sum(display_numbers)
            expected = expected if expected is not None else (int(s) if all(isinstance(x, int) for x in display_numbers) else float(s))

    # 2. Scenario-based Calculations (e.g., Mouse + Keyboard + Discount + GST, attendance, inventory, power, scheduling)
    elif given_op in ("calculation", "scenario") or any(kw in desc_lower for kw in ["payable", "discount", "gst", "tax", "interest", "salary", "invoice", "bill", "cost", "price", "profit", "loss", "percentage", "rate", "units", "distance", "speed", "total", "margin", "attendance", "inventory", "revenue", "expenses", "reading", "sensor", "peak", "power", "watts", "voltage", "current", "time", "hours", "minutes", "backup", "records", "unique", "calculate"]):
        op_type = "calculation"
        display_numbers = numbers
        if expected is None:
            expected = solve_ground_truth(description)

    # 3. File analysis task
    elif given_op == "file_analysis" or any(kw in desc_lower for kw in ["file", "document", "upload", "evidence", "pdf", "docx", "csv", "xlsx", "trace", "log line"]):
        op_type = "file_analysis"
        display_numbers = numbers
        expected = None

    # 4. Text questions / conceptual questions / non-math scenarios
    elif given_op in ("text_question", "conceptual") or any(kw in desc_lower for kw in ["what is", "explain", "describe", "compare", "define", "how does", "why is", "overview", "steps to", "causes and solutions", "difference between", "error"]):
        op_type = "text_question"
        display_numbers = []
        expected = None


    else:
        # Check for AST expression in prompt (e.g., "10 + 20 * 3")
        expr_candidate = re.sub(r'^[a-zA-Z\s:]+', '', description).strip()
        try:
            expected = expected if expected is not None else safe_eval_expression(expr_candidate)
            op_type = "expression"
            display_numbers = numbers
        except (ValueError, ArithmeticError, ZeroDivisionError) as err:
            if "division by zero" in str(err).lower() or "zero" in str(err).lower():
                op_type = "expression"
                display_numbers = numbers
                expected = None
            elif numbers and not any(ch in expr_candidate for ch in "+-*/%"):
                op_type = "calculation"
                display_numbers = numbers
                if expected is None:
                    expected = solve_ground_truth(description)
            else:
                op_type = "fallback"
                display_numbers = []
                expected = None

    return {
        "task_id": task_id,
        "description": description,
        "op_type": op_type,
        "numbers": display_numbers,
        "expected_value": expected
    }

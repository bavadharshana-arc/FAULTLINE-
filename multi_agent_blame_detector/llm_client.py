"""
llm_client.py
-------------
Gemini API client wrapper for multi-agent reasoning.
Provides call_gemini() with strict fallback semantics:
- Returns (fallback, False) immediately if GEMINI_API_KEY is missing/empty/placeholder.
- Returns (fallback, False) on any exception or API error (NEVER raises).
- Returns (response_text, True) on successful Gemini LLM call.
"""

import os
import logging
from typing import Tuple, Optional, Dict
from dotenv import load_dotenv, find_dotenv

# Ensure .env is loaded reliably regardless of execution working directory
load_dotenv(find_dotenv(usecwd=True))

import hashlib

logger = logging.getLogger("llm_client")

MODEL_CANDIDATES = [
    "gemini-1.5-flash",
    "gemini-1.5-pro",
    "gemini-2.0-flash-exp",
    "gemini-flash-latest",
    "gemma-4-26b-a4b-it",
]

# Task-lifecycle in-memory LLM cache & latency metrics
_LLM_CACHE: Dict[str, Tuple[str, bool]] = {}

METRICS = {
    "cache_hits": 0,
    "cache_misses": 0,
    "gemini_calls": 0,
    "stage_times": {
        "ground_truth": 0.0,
        "planner": 0.0,
        "worker": 0.0,
        "reviewer": 0.0,
        "final": 0.0,
        "validation": 0.0,
        "root_cause": 0.0,
    }
}


def reset_metrics():
    """Resets cache and performance metrics for benchmark measurement."""
    global _LLM_CACHE
    _LLM_CACHE.clear()
    METRICS["cache_hits"] = 0
    METRICS["cache_misses"] = 0
    METRICS["gemini_calls"] = 0
    for k in METRICS["stage_times"]:
        METRICS["stage_times"][k] = 0.0


def get_metrics() -> dict:
    """Returns current performance metrics."""
    return METRICS


def _extract_response_text(res) -> Optional[str]:
    """Safely extracts text from Gemini GenerateContentResponse object across SDK versions."""
    if not res:
        return None
    # 1. Direct property accessor
    if hasattr(res, "text"):
        try:
            text = res.text
            if text and isinstance(text, str) and text.strip():
                return text.strip()
        except Exception:
            pass

    # 2. Extract from candidates and content parts
    if hasattr(res, "candidates") and res.candidates:
        for candidate in res.candidates:
            if hasattr(candidate, "content") and candidate.content and hasattr(candidate.content, "parts"):
                parts_text = "".join(getattr(p, "text", "") for p in candidate.content.parts if hasattr(p, "text"))
                if parts_text and parts_text.strip():
                    return parts_text.strip()
    return None


def _inspect_response_diagnostics(res) -> str:
    """Diagnose reasons why a response object contained no extracted text."""
    if not res:
        return "No response object returned"
    if hasattr(res, "prompt_feedback") and res.prompt_feedback:
        pf = res.prompt_feedback
        if hasattr(pf, "block_reason") and pf.block_reason:
            return f"Blocked by safety settings (reason code: {pf.block_reason})"
    if hasattr(res, "candidates") and res.candidates:
        c = res.candidates[0]
        if hasattr(c, "finish_reason") and c.finish_reason:
            reasons = {1: "STOP", 2: "MAX_TOKENS", 3: "SAFETY", 4: "RECITATION", 5: "OTHER"}
            reason_str = reasons.get(c.finish_reason, str(c.finish_reason))
            if c.finish_reason != 1:
                return f"Generation stopped (finish_reason: {reason_str})"
    return "Gemini API connected but returned an empty response"


def _try_generate_content(genai_module, prompt: str, preferred_model: str) -> Tuple[Optional[str], str, Optional[str]]:
    """Tries generating content with preferred model and candidate fallbacks."""
    candidates = [preferred_model] + [m for m in MODEL_CANDIDATES if m != preferred_model]
    last_diagnostic = None
    generation_config = getattr(genai_module, "types", None)
    config = {"max_output_tokens": 1500, "temperature": 0.2}

    for m_name in candidates:
        try:
            model = genai_module.GenerativeModel(m_name, generation_config=config)
            res = model.generate_content(prompt)
            text = _extract_response_text(res)
            if text:
                return text, m_name, None
            last_diagnostic = _inspect_response_diagnostics(res)
        except Exception as e:
            last_diagnostic = f"Model {m_name} call error: {str(e)[:100]}"
            continue
    return None, preferred_model, last_diagnostic



def check_gemini_status() -> Tuple[bool, str, str]:
    """
    Performs a safe, real runtime check of Gemini API configuration & connectivity.

    Returns:
        tuple[is_connected: bool, status_title: str, diagnostic_reason: str]
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key:
        return False, "Unconfigured", "GEMINI_API_KEY environment variable is missing"
    if api_key == "your_key_here":
        return False, "Unconfigured", "GEMINI_API_KEY is set to default placeholder in .env"

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)

        preferred = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
        text, used_model, diagnostic = _try_generate_content(genai, "Ping", preferred)

        if text:
            return True, f"Connected ({used_model})", f"Gemini API verified successfully using {used_model}"

        reason = diagnostic or "Gemini API connected but returned an empty response"
        return False, "Empty Response", reason

    except Exception as e:
        err_msg = str(e)
        if api_key in err_msg:
            err_msg = err_msg.replace(api_key, "[REDACTED_API_KEY]")
        return False, "Connection Failed", f"API Error: {err_msg[:120]}"


def call_gemini(prompt: str, fallback: str) -> Tuple[str, bool]:
    """
    Calls Gemini API with the given prompt. Uses safe in-memory cache for duplicate prompts.

    Args:
        prompt: Detailed instructions for Gemini LLM.
        fallback: Default template string to return if LLM is unavailable or fails.

    Returns:
        tuple[str, bool]:
            - str: LLM-generated response text or fallback template.
            - bool: True if LLM-generated, False if template fallback was used.
    """
    api_key = os.environ.get("GEMINI_API_KEY", "").strip()
    if not api_key or api_key == "your_key_here":
        return fallback, False

    cache_key = hashlib.sha256(prompt.strip().encode("utf-8")).hexdigest()
    if cache_key in _LLM_CACHE:
        METRICS["cache_hits"] += 1
        return _LLM_CACHE[cache_key]

    METRICS["cache_misses"] += 1
    METRICS["gemini_calls"] += 1

    try:
        import google.generativeai as genai
        genai.configure(api_key=api_key)

        preferred = os.environ.get("GEMINI_MODEL", "gemini-1.5-flash")
        text, used_model, diagnostic = _try_generate_content(genai, prompt, preferred)

        if text:
            _LLM_CACHE[cache_key] = (text, True)
            return text, True

        logger.warning(f"Gemini API returned empty response ({diagnostic}); falling back to template logic.")
        return fallback, False

    except Exception as e:
        logger.warning(f"Gemini API call failed: {e}. Falling back to template logic.")
        return fallback, False


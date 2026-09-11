"""
api.py
------
Thin, robust REST API adapter exposing FAULTLINE's multi-agent failure forensics
engine to the React frontend.

Preserves the locked forensic backend as the sole source of truth:
- Python = forensic intelligence
- React = presentation + interaction
"""

import os
import sys
import json
import logging
from typing import Optional, List, Dict, Any

from starlette.applications import Starlette
from starlette.responses import JSONResponse
from starlette.routing import Route
from starlette.requests import Request
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
import uvicorn

# Ensure repository root is on sys.path
REPO_ROOT = os.path.dirname(os.path.abspath(__file__))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from frontend.bridge import run_live_backend_pipeline, run_counterfactual
from frontend.engine import validate_trace_schema, analyze_root_cause
import reliability_store

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("faultline-api")

DEFAULT_TASK = "Calculate the average of 10, 20, and 30."

SCENARIOS_DATA = [
    {
        "key": "none",
        "label": "Normal",
        "description": "Flawless execution (no injected failure). All agents pass validation.",
    },
    {
        "key": "planner_hallucination",
        "label": "Planner Failure",
        "description": "Planner fails (produces empty plan steps). Root cause at Step 1.",
    },
    {
        "key": "worker_syntax_error",
        "label": "Worker Failure",
        "description": "Worker calculation fails (expected 20, produced 27). Root cause at Step 2.",
    },
    {
        "key": "reviewer_oversight",
        "label": "Reviewer Failure",
        "description": "Reviewer false negative (wrongly rejects valid Worker output). Root cause at Step 3.",
    },
    {
        "key": "propagation_failure",
        "label": "Propagation Failure",
        "description": "Worker calculation corrupted AND Reviewer misses it. Root cause at Step 2 with downstream impact.",
    },
]


async def handle_status(request: Request) -> JSONResponse:
    gemini_key = os.environ.get("GEMINI_API_KEY", "").strip()
    connected = bool(gemini_key) and gemini_key != "your_key_here"
    return JSONResponse({
        "status": "operational",
        "gemini_connected": connected,
        "gemini_mode": "LLM Connected (gemini-2.0-flash)" if connected else "Deterministic Template Mode (Reliable Demos)",
        "version": "2.0.0",
        "engine": "FAULTLINE Forensic Engine (AIML-06)"
    })


async def handle_scenarios(request: Request) -> JSONResponse:
    return JSONResponse({
        "default_task": DEFAULT_TASK,
        "scenarios": SCENARIOS_DATA
    })


async def handle_run(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        body = {}

    task = (body.get("task") or "").strip() or DEFAULT_TASK
    failure_mode = body.get("failure_mode") or "none"
    numbers = body.get("numbers")
    if numbers is not None and not isinstance(numbers, list):
        numbers = None

    try:
        trace, diagnosis = run_live_backend_pipeline(
            task_prompt=task,
            failure_mode=failure_mode,
            numbers=numbers
        )
        # Record into persistent reliability intelligence store
        try:
            reliability_store.record_run(
                task=task,
                scenario_key=failure_mode,
                trace=trace,
                diagnosis=diagnosis
            )
        except Exception as exc:
            logger.warning("Could not record run to reliability store: %s", exc)

        return JSONResponse({
            "success": True,
            "task": task,
            "failure_mode": failure_mode,
            "trace": trace,
            "diagnosis": diagnosis
        })
    except Exception as exc:
        logger.exception("Error executing pipeline")
        return JSONResponse({
            "success": False,
            "error": f"{type(exc).__name__}: {str(exc)}"
        }, status_code=500)


async def handle_replay(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        body = {}

    task = (body.get("task") or "").strip() or DEFAULT_TASK
    failure_mode = body.get("failure_mode") or "none"
    numbers = body.get("numbers")

    try:
        res = run_counterfactual(
            task_prompt=task,
            original_mode=failure_mode,
            numbers=numbers
        )
        return JSONResponse({
            "success": True,
            "replay": res
        })
    except Exception as exc:
        logger.exception("Error executing counterfactual replay")
        return JSONResponse({
            "success": False,
            "error": f"{type(exc).__name__}: {str(exc)}"
        }, status_code=500)


async def handle_analyze_trace(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        return JSONResponse({"success": False, "error": "Invalid JSON payload"}, status_code=400)

    trace = body.get("trace")
    if not isinstance(trace, list):
        return JSONResponse({"success": False, "error": "Trace must be a list of step dictionaries"}, status_code=400)

    if not validate_trace_schema(trace):
        return JSONResponse({
            "success": False,
            "error": "Trace does not adhere to mandatory 8-field schema (task_id, step, agent, input, output, status, error_type, parent_step)"
        }, status_code=422)

    try:
        diagnosis = analyze_root_cause(trace)
        return JSONResponse({
            "success": True,
            "trace": trace,
            "diagnosis": diagnosis
        })
    except Exception as exc:
        logger.exception("Error analyzing custom trace")
        return JSONResponse({
            "success": False,
            "error": f"{type(exc).__name__}: {str(exc)}"
        }, status_code=500)


async def handle_reliability_overview(request: Request) -> JSONResponse:
    try:
        overview = reliability_store.compute_reliability_overview()
        return JSONResponse({"success": True, "data": overview})
    except Exception as exc:
        logger.exception("Error computing reliability overview")
        return JSONResponse({"success": False, "error": str(exc)}, status_code=500)


async def handle_agent_reliability(request: Request) -> JSONResponse:
    agent_name = request.path_params.get("agent")
    try:
        overview = reliability_store.compute_reliability_overview()
        agents = overview.get("agents", {})
        # Map Executor/Worker alias
        target = "Worker" if agent_name == "Executor" else agent_name
        agent_data = agents.get(target) or agents.get(agent_name)
        if not agent_data:
            return JSONResponse({"success": False, "error": f"Agent {agent_name!r} not found"}, status_code=404)
        return JSONResponse({"success": True, "data": agent_data})
    except Exception as exc:
        logger.exception("Error fetching agent reliability")
        return JSONResponse({"success": False, "error": str(exc)}, status_code=500)


async def handle_reliability_prediction(request: Request) -> JSONResponse:
    try:
        body = await request.json()
    except Exception:
        body = {}
    task = body.get("task", DEFAULT_TASK)
    scenario_key = body.get("scenario_key")
    try:
        prediction = reliability_store.predict_failure_risk(task, scenario_key)
        return JSONResponse({"success": True, "data": prediction})
    except Exception as exc:
        logger.exception("Error calculating reliability prediction")
        return JSONResponse({"success": False, "error": str(exc)}, status_code=500)


async def handle_reliability_history(request: Request) -> JSONResponse:
    try:
        limit = int(request.query_params.get("limit", 50))
        history = reliability_store.get_history(limit=limit)
        return JSONResponse({"success": True, "data": history})
    except Exception as exc:
        logger.exception("Error fetching reliability history")
        return JSONResponse({"success": False, "error": str(exc)}, status_code=500)


routes = [
    Route("/api/status", handle_status, methods=["GET"]),
    Route("/api/scenarios", handle_scenarios, methods=["GET"]),
    Route("/api/run", handle_run, methods=["POST"]),
    Route("/api/replay", handle_replay, methods=["POST"]),
    Route("/api/analyze-trace", handle_analyze_trace, methods=["POST"]),
    Route("/api/reliability", handle_reliability_overview, methods=["GET"]),
    Route("/api/reliability/history", handle_reliability_history, methods=["GET"]),
    Route("/api/reliability/prediction", handle_reliability_prediction, methods=["POST"]),
    Route("/api/reliability/{agent}", handle_agent_reliability, methods=["GET"]),
]

middleware = [
    Middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )
]

app = Starlette(debug=False, routes=routes, middleware=middleware)

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 8008))
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")

"""
reliability_store.py
--------------------
Lightweight, deterministic persistence and reliability intelligence module
for FAULTLINE multi-agent failure forensics.

Stores completed investigation runs in a persistent JSON ledger (history_runs.json)
and provides deterministic reliability scoring, failure pattern detection,
and explainable next-run risk prediction based exclusively on real historical runs.

NO FAKE METRICS. If insufficient data exists, returns None / "Insufficient data".
"""

import os
import json
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

logger = logging.getLogger("faultline-reliability")

STORE_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "history_runs.json")
CANONICAL_AGENTS = ["Planner", "Worker", "Reviewer", "Final"]


def _load_raw_runs() -> List[Dict[str, Any]]:
    if not os.path.exists(STORE_FILE):
        return []
    try:
        with open(STORE_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data if isinstance(data, list) else []
    except Exception as exc:
        logger.warning("Could not read history_runs.json: %s", exc)
        return []


def _save_raw_runs(runs: List[Dict[str, Any]]) -> None:
    try:
        with open(STORE_FILE, "w", encoding="utf-8") as f:
            json.dump(runs, f, indent=2)
    except Exception as exc:
        logger.error("Could not write history_runs.json: %s", exc)


def record_run(task: str, scenario_key: str, trace: List[Dict[str, Any]], diagnosis: Dict[str, Any]) -> Dict[str, Any]:
    runs = _load_raw_runs()

    base_id = diagnosis.get("task_id") or "TASK-LIVE"
    run_id = f"{base_id}-{len(runs) + 1:04d}"
    root_agent = diagnosis.get("root_cause_agent") if (diagnosis.get("has_failure") and not diagnosis.get("unknown")) else None
    error_type = diagnosis.get("root_cause_error_type") if root_agent else None
    
    agent_steps = {}
    for step in trace:
        agent = step.get("agent")
        if agent:
            agent_steps[agent] = {
                "step": step.get("step"),
                "status": step.get("status"),
                "error_type": step.get("error_type"),
                "reason": step.get("reason"),
            }

    entry = {
        "id": run_id,
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "task": task,
        "scenario_key": scenario_key,
        "has_failure": bool(diagnosis.get("has_failure")),
        "unknown": bool(diagnosis.get("unknown")),
        "root_cause_agent": root_agent,
        "root_cause_step": diagnosis.get("root_cause_step"),
        "root_cause_error_type": error_type,
        "downstream_agents": list(diagnosis.get("downstream_agents") or []),
        "agent_steps": agent_steps,
        "execution_timing": diagnosis.get("execution_timing") or {},
    }

    runs = [entry] + [r for r in runs if r.get("id") != run_id][:199]
    _save_raw_runs(runs)
    return entry


def get_history(limit: int = 50) -> List[Dict[str, Any]]:
    runs = _load_raw_runs()
    return runs[:limit]


def compute_reliability_overview() -> Dict[str, Any]:
    runs = _load_raw_runs()
    total_runs = len(runs)
    
    if total_runs == 0:
        return {
            "total_runs": 0,
            "successful_runs": 0,
            "failed_runs": 0,
            "agents_monitored": len(CANONICAL_AGENTS),
            "agents": {agent: _empty_agent_stats(agent) for agent in CANONICAL_AGENTS},
            "recent_trend": [],
            "status": "insufficient_data",
            "message": "Insufficient historical data"
        }

    failed_runs = sum(1 for r in runs if r.get("has_failure") and not r.get("unknown"))
    successful_runs = sum(1 for r in runs if not r.get("has_failure"))

    agent_stats = {}
    for agent in CANONICAL_AGENTS:
        agent_stats[agent] = _compute_single_agent_stats(agent, runs)

    recent_trend = []
    for r in runs[:10][::-1]:
        recent_trend.append({
            "run_id": r.get("id"),
            "timestamp": r.get("timestamp"),
            "has_failure": r.get("has_failure", False),
            "root_cause_agent": r.get("root_cause_agent"),
            "scenario": r.get("scenario_key", "none"),
        })

    return {
        "total_runs": total_runs,
        "successful_runs": successful_runs,
        "failed_runs": failed_runs,
        "agents_monitored": len(CANONICAL_AGENTS),
        "agents": agent_stats,
        "recent_trend": recent_trend,
        "status": "ready" if total_runs >= 3 else "limited_data",
        "message": f"Based on {total_runs} run{'s' if total_runs != 1 else ''}"
    }


def _empty_agent_stats(agent: str) -> Dict[str, Any]:
    return {
        "agent": agent,
        "runs": 0,
        "successful_runs": 0,
        "failed_runs": 0,
        "root_cause_count": 0,
        "failure_rate": 0.0,
        "reliability_score": None,
        "reliability_display": "Insufficient data",
        "recent_failure_trend": [],
        "failure_types": {},
        "task_performance": {},
        "avg_duration_s": None,
    }


def _compute_single_agent_stats(agent: str, runs: List[Dict[str, Any]]) -> Dict[str, Any]:
    total_runs = len(runs)
    if total_runs == 0:
        return _empty_agent_stats(agent)

    runs_participated = 0
    failed_steps = 0
    root_cause_count = 0
    failure_types = {}
    task_perf = {}
    recent_trend = []

    lookup_names = [agent]
    if agent in ("Worker", "Executor"):
        lookup_names = ["Worker", "Executor"]

    for r in runs:
        agent_steps = r.get("agent_steps") or {}
        step_info = None
        for name in lookup_names:
            if name in agent_steps:
                step_info = agent_steps[name]
                break

        runs_participated += 1

        is_rc = r.get("root_cause_agent") in lookup_names
        if is_rc:
            root_cause_count += 1

        step_failed = False
        if step_info:
            step_failed = step_info.get("status") == "failed"
        elif is_rc:
            step_failed = True

        if step_failed:
            failed_steps += 1
            err_type = (step_info.get("error_type") if step_info else None) or r.get("root_cause_error_type") or "unspecified_error"
            if err_type and err_type != "None":
                failure_types[err_type] = failure_types.get(err_type, 0) + 1

        task_desc = r.get("task", "").lower()
        if "average" in task_desc or "sum" in task_desc or "calculate" in task_desc or "revenue" in task_desc:
            cat = "Calculation / Arithmetic"
        elif "api" in task_desc or "debug" in task_desc or "code" in task_desc or "function" in task_desc:
            cat = "Software Debugging"
        elif "ticket" in task_desc or "customer" in task_desc:
            cat = "Customer Support"
        elif "inventory" in task_desc or "order" in task_desc:
            cat = "Operations / Inventory"
        else:
            cat = "General Workflow"

        if cat not in task_perf:
            task_perf[cat] = {"runs": 0, "failures": 0}
        task_perf[cat]["runs"] += 1
        if is_rc or step_failed:
            task_perf[cat]["failures"] += 1

    for r in runs[:10]:
        recent_trend.append({
            "run_id": r.get("id"),
            "failed": (r.get("root_cause_agent") in lookup_names) or (r.get("agent_steps", {}).get(agent, {}).get("status") == "failed")
        })

    fail_rate = (failed_steps / runs_participated) if runs_participated > 0 else 0.0
    rc_rate = (root_cause_count / runs_participated) if runs_participated > 0 else 0.0
    weighted_penalty = (0.7 * fail_rate) + (0.3 * rc_rate)
    rel_score = max(0.0, min(1.0, 1.0 - weighted_penalty))
    rel_percent = round(rel_score * 100.0, 1)

    return {
        "agent": agent,
        "runs": runs_participated,
        "successful_runs": runs_participated - failed_steps,
        "failed_runs": failed_steps,
        "root_cause_count": root_cause_count,
        "failure_rate": round(fail_rate * 100.0, 1),
        "reliability_score": rel_percent,
        "reliability_display": f"{rel_percent}%",
        "recent_failure_trend": recent_trend,
        "failure_types": failure_types,
        "task_performance": {
            k: {
                "runs": v["runs"],
                "failures": v["failures"],
                "failure_rate": round((v["failures"] / v["runs"]) * 100.0, 1) if v["runs"] > 0 else 0.0
            }
            for k, v in task_perf.items()
        },
        "avg_duration_s": None,
    }


def predict_failure_risk(task_prompt: str, scenario_key: Optional[str] = None) -> Dict[str, Any]:
    runs = _load_raw_runs()
    total_runs = len(runs)

    if total_runs < 2:
        return {
            "status": "unavailable",
            "message": "Prediction unavailable — insufficient historical evidence.",
            "predictions": []
        }

    target_agents = ["Planner", "Worker", "Reviewer"]
    predictions = []
    prompt_lower = (task_prompt or "").lower()

    for agent in target_agents:
        stats = _compute_single_agent_stats(agent, runs)
        runs_count = stats["runs"]
        fail_count = stats["failed_runs"]
        rc_count = stats["root_cause_count"]
        fail_rate = stats["failure_rate"] / 100.0
        rc_rate = (rc_count / runs_count) if runs_count > 0 else 0.0

        recent_5 = runs[:5]
        recent_fails = sum(
            1 for r in recent_5 
            if (r.get("root_cause_agent") == agent or r.get("agent_steps", {}).get(agent, {}).get("status") == "failed")
        )
        recent_rate = (recent_fails / len(recent_5)) if recent_5 else 0.0

        similar_fails = 0
        for r in runs:
            r_task = r.get("task", "").lower()
            overlap = set(prompt_lower.split()) & set(r_task.split())
            if len(overlap) >= 2 and (r.get("root_cause_agent") == agent):
                similar_fails += 1

        raw_risk = (0.4 * fail_rate) + (0.3 * rc_rate) + (0.3 * recent_rate)
        risk_score = round(max(0.05, min(0.95, raw_risk)) * 100.0, 1)

        if risk_score >= 50.0:
            level = "HIGH"
        elif risk_score >= 25.0:
            level = "MEDIUM"
        else:
            level = "LOW"

        evidence = [
            f"{fail_count} failure{'s' if fail_count != 1 else ''} across {runs_count} historical run{'s' if runs_count != 1 else ''}",
            f"{rc_count} run{'s' if rc_count != 1 else ''} where {agent} was verified ROOT CAUSE",
        ]
        if recent_fails > 0:
            evidence.append(f"{recent_fails} failure{'s' if recent_fails != 1 else ''} occurred in the last {len(recent_5)} runs")
        if similar_fails > 0:
            evidence.append(f"{similar_fails} similar task{'s' if similar_fails != 1 else ''} previously produced {agent} failures")

        predictions.append({
            "agent": "Executor" if agent == "Worker" else agent,
            "raw_agent": agent,
            "risk_score": risk_score,
            "risk_level": level,
            "reliability_score": stats["reliability_score"],
            "evidence": evidence
        })

    predictions.sort(key=lambda p: p["risk_score"], reverse=True)

    return {
        "status": "ready",
        "message": f"Calculated from {total_runs} historical investigation{'s' if total_runs != 1 else ''}",
        "predictions": predictions
    }

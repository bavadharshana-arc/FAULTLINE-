"""
test_failure_injection.py
--------------------------
Failure Injection module-a specific-ah check panna. Ovvoru mode-kum:
- Ovvoru agent-oda status (success/failed)
- Enna error_type varuthu
- Final diagnosis enna varuthu
nu detail-ah kaamikkum.
"""

try:
    from pipeline import run_pipeline
    from demo_tasks import get_task
    from failure_injection import FAILURE_MODES
except ImportError:
    from multi_agent_blame_detector.pipeline import run_pipeline
    from multi_agent_blame_detector.demo_tasks import get_task
    from multi_agent_blame_detector.failure_injection import FAILURE_MODES

STATUS_ICON = {"success": "PASS", "failed": "FAIL"}

for mode in FAILURE_MODES:
    print("=" * 65)
    print(f"FAILURE MODE: {mode}")
    print("=" * 65)

    task = get_task("T001")
    out = run_pipeline(task, failure_mode=mode)

    for e in out["trace"]:
        icon = STATUS_ICON.get(e.status, "????")
        print(f"  [{icon}] step {e.step} | {e.agent:9s} | error_type={e.error_type}")
        print(f"          output = {e.output}")
        if e.reason:
            print(f"          reason = {e.reason}")

    diagnosis = out["diagnosis"]
    print()
    if diagnosis.no_failure:
        print("  DIAGNOSIS: No root cause (everything worked).")
    else:
        print(f"  DIAGNOSIS: Root Cause = {diagnosis.root_cause.agent} (step {diagnosis.root_cause.step})")
        downstream = [e.agent for e in diagnosis.downstream]
        print(f"             Downstream = {downstream if downstream else 'none'}")
        independent = [e.agent for e in diagnosis.independent_failures]
        if independent:
            print(f"             Independent failures = {independent}")
    print()

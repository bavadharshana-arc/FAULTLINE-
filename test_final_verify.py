import urllib.request
import json

base = "http://127.0.0.1:8008"

# Check reliability
req = urllib.request.urlopen(f"{base}/api/reliability")
res = json.loads(req.read().decode("utf-8"))
print("Total runs:", res["data"]["total_runs"])
print("Successful runs:", res["data"]["successful_runs"])
print("Failed runs:", res["data"]["failed_runs"])
print("Agents:")
for k, v in res["data"]["agents"].items():
    print(f"  {k}: Reliability={v['reliability_display']}, Failures={v['failed_runs']}, RC={v['root_cause_count']}")

# Check prediction
pred_data = json.dumps({"task": "Calculate the average of 5, 10, and 15."}).encode("utf-8")
req_pred = urllib.request.Request(f"{base}/api/reliability/prediction", data=pred_data, headers={"Content-Type": "application/json"})
pred_res = json.loads(urllib.request.urlopen(req_pred).read().decode("utf-8"))
print("\n=== PREDICTION OUTCOME ===")
print("Status:", pred_res["data"]["status"])
for p in pred_res["data"]["predictions"]:
    print(f"Agent: {p['agent']} -> Risk: {p['risk_level']} ({p['risk_score']}%) | Reliability: {p['reliability_score']}%")
    for ev in p["evidence"]:
        print(f"    • {ev}")

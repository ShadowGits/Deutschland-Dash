import json, urllib.request
BASE_URL = "https://planner-os-api-645411441153.us-central1.run.app"
APP_KEY = "c4167655a44e89e6e1ce0b3de00f9255182be179e5f2f9326c3eee70b4df6c69"
req = urllib.request.Request(f"{BASE_URL}/v2/dashboard/metrics", headers={"X-App-Key": APP_KEY})
try:
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read().decode())
        print(json.dumps(data, indent=2))
except Exception as e:
    print(e)

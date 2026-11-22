import json

from starlette.testclient import TestClient

from app.mcp_app import build_app
from conftest import owner_sql

HDR = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json", "Host": "log.example.test"}


def rpc(c, method, params=None, path="/mcp-testpath", headers=HDR):
    return c.post(path, headers=headers, content=json.dumps({"jsonrpc": "2.0", "id": 1, "method": method, "params": params or {}}))


def client():
    return TestClient(build_app(), base_url="http://log.example.test")


def test_health_and_unknown_paths(bearer):
    with client() as c:
        assert c.get("/health").json()["status"] == "ok"
        assert c.get("/docs").status_code == 404
        assert rpc(c, "tools/list", path="/mcp", headers={**HDR, **bearer}).status_code in (404, 405)


def test_wrong_host_is_refused(bearer):
    with client() as c:
        r = rpc(c, "tools/list", headers={**HDR, **bearer, "Host": "evil.example.org"})
        assert r.status_code in (400, 403, 421)


def test_tools_list_and_a_call(bearer):
    with client() as c:
        tools = rpc(c, "tools/list", headers={**HDR, **bearer}).json()["result"]["tools"]
        assert {t["name"] for t in tools} == {"log", "answer", "add_food", "food_words", "food_lookup", "lab_report",
                                            "today_summary", "tick_habit", "untick_habit", "add_water", "set_checkin"}
        food = {"name": "Mcp test crispbread", "kcal": 350, "protein": 10, "fat": 2, "carbs": 70, "source": "estimate"}
        r = rpc(c, "tools/call", {"name": "add_food", "arguments": food}, headers={**HDR, **bearer})
        res = r.json()["result"]
        assert res.get("isError") in (False, None)
        body = res.get("structuredContent") or json.loads(res["content"][0]["text"])
        assert body["outcome"] == "saved"
        assert owner_sql("SELECT count(*) AS n FROM foods WHERE name = %s", food["name"])[0]["n"] == 1

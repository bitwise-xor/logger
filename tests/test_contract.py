"""Contract test: the tools the AI app sees through the MCP interface, and the arguments each one requires.
The pilot's typed tools (record_weight, amend, resolve, undo ...) were removed on 22.11.2026; chats use `log` and `answer`."""
import json

from starlette.testclient import TestClient

from app import mcp_app
from app.mcp_app import build_app

HDR = {"Accept": "application/json, text/event-stream", "Content-Type": "application/json", "Host": "log.example.test"}


def test_tool_schemas_are_stable(bearer):
    with TestClient(build_app(), base_url="http://log.example.test") as c:
        r = c.post("/mcp-testpath", headers={**HDR, **bearer}, content=json.dumps({"jsonrpc": "2.0", "id": 1, "method": "tools/list", "params": {}}))
        tools = {t["name"]: t["inputSchema"] for t in r.json()["result"]["tools"]}
    required = {"log": ["text"], "answer": ["question_id", "reply"],
                "add_food": ["carbs", "fat", "kcal", "name", "protein", "source"],
                "food_words": ["food_id", "words"], "food_lookup": [], "lab_report": ["text"],
                "today_summary": [], "tick_habit": ["name"], "untick_habit": ["name"], "add_water": [], "set_checkin": []}
    assert {k: sorted(v.get("required", [])) for k, v in tools.items()} == {k: sorted(v) for k, v in required.items()}
    assert {"idempotency_key"} <= set(tools["log"]["properties"])


def test_the_hubs_allowed_tools_are_unchanged():
    assert mcp_app.HUB_TOOLS == {"today_summary", "tick_habit", "untick_habit", "add_water", "set_checkin", "log", "answer"}

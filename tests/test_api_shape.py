"""The door's shape after the review of 16.11.2026 (deploy 77): the night's bed time on the Health card, a save's questions in full,
the private guard on questions and on lines the AI files as private, one name per field (the old names gone since deploy 78), Undo on a
reload, a mixed line's look-up in result, answer styles and refill buttons, the outcome's tone, no chat lines in read-backs, and
Try again / Delete on a message not read yet; the usual-meal editor's shapes (deploy 86); the scanner's, label photo's and look-up's
shapes (deploy 89); the Health page's and body measurements' shapes (deploy 91); the Habits page's shapes (deploy 93); the Gym's shapes (deploy 95); Home's shapes (deploy 98); Trends' shapes (deploy 101); Library's and Medical's shapes (deploy 104); Search's, Recent's, Usage's and Coach's shapes (deploy 107); Settings' and notifications' shapes (deploy 110). Every name, food, number and sentence is invented."""
from datetime import datetime, timedelta

import pytest

from app import api, reads
from conftest import owner_sql
from test_api_door import door, door_on, signed_in  # noqa: F401 - door_on is autouse
from test_api_reads import OFFSET, event as event_ago, pending
from test_api_saves import KEYS, Door, breakfast, clean_usual, got_undo, n, shaped  # noqa: F401 - clean_usual is autouse; breakfast a fixture
from test_log import ANSWERS, F, P, fake, off, skyr  # noqa: F401 - fixtures reused: the AI is a fake
from test_webbed import recent_wake
from test_webfood import eat_on, oats
from test_webhabits import habit_types_as_they_were  # noqa: F401 - autouse: the habit types and settings as they were
from test_webtoday import day, eat, food, raw  # noqa: F401


@pytest.fixture
def sv():
    return Door()


def get(sv, path):
    r = sv.c.get("/api/v1" + path, headers=sv.h)
    assert r.status_code == 200, r.text
    return r.json()


def card(sv):
    return {h["row"]: h for h in get(sv, "/day")["day"]["health"]}


def hm(iso):
    return datetime.fromisoformat(iso).strftime("%H:%M")


# ---- 1. the Health card's Bed row ------------------------------------------------------------------------------------

def test_the_bed_row_has_the_nights_bed_time_from_the_day_before(sv, fake):
    recent_wake()
    j = shaped(sv.post("/health", row="bed", key="bed-1", time="23:10"))
    assert j["outcome"] == "saved"
    bed = card(sv)["bed"]
    ref = owner_sql("SELECT 'e' || e.id AS ref, e.day FROM events e JOIN log_types t ON t.id = e.type_id WHERE t.name = 'bed'")[0]
    assert bed["ref"] == ref["ref"] and ref["day"] < day()  # the bed belongs to the logging day before
    assert OFFSET.search(bed["at"]) and hm(bed["at"]) == "23:10" and bed["v1"] is None and bed["last_at"] is None


def test_a_bed_row_with_nothing_logged_has_no_time(sv, fake):
    recent_wake()
    bed = card(sv)["bed"]
    assert bed["ref"] is None and bed["at"] is None


# ---- 2. a save's new questions in full ---------------------------------------------------------------------------------

def test_a_saves_question_is_the_full_question_also_on_the_food_page(sv, fake):
    food("Radishes", 16, 0.7, 0.1, 3.4)
    sv.post("/log", text="40 g radishes", key="q-1")
    r = sv.raw("/log", text="40 g radishes", key="q-2", view="food")
    j = shaped(r.json(), "food")
    [q] = j["questions"]
    assert q["tool"] == "log_repeat" and q["text"] == "Log it again?" and q["read_back"] and q["answers"][0]["style"] == "primary"
    assert "(yes) or not (no)" not in r.text and "call answer" not in r.text and "Ask the user" not in r.text


def test_a_question_that_is_no_longer_open_is_left_out(sv, fake, monkeypatch):
    monkeypatch.setattr(api.logbook, "log", lambda *a, **k: {"outcome": "needs_choice", "questions": [
        {"question_id": "p0000dead", "question": "Show the user these values; call add_food again."}]})
    r = sv.raw("/log", text="something")
    assert shaped(r.json())["questions"] == [] and "add_food" not in r.text


# ---- 3. the private guard ------------------------------------------------------------------------------------------------

def test_a_line_the_ai_files_as_private_is_saved_privately_and_nothing_more(sv, fake):
    r = sv.raw("/log", text="grateful for a quiet morning", key="pv-1")
    j = shaped(r.json())
    assert j["outcome"] == "saved" and j["head"] == "Saved privately." and j["tone"] == "ok"
    assert j["receipt"] == [] and j["notes"] == [] and j["reason"] is None and j["result"] is None and j["read_back"] is None
    assert "quiet morning" not in r.text and n("SELECT count(*) AS n FROM private.entries") == 1


def test_a_question_whose_message_names_a_private_entry_has_no_message_or_refill(sv, fake):
    pending("pq7", "log_repeat", "Same message as before.", {"text": "change P12 to violet umbrella"})
    r = sv.c.get("/api/v1/day", headers=sv.h)
    [q] = r.json()["day"]["needs"]["questions"]
    assert q["text"] == reads.HIDDEN and q["message"] is None and q["refill"] is None and q["read_back"] is None
    assert "violet" not in r.text and "P12" not in r.text


def test_a_private_entry_made_in_a_partly_saved_line_hides_the_rest_too(sv, fake, monkeypatch):
    monkeypatch.setattr(api.logbook, "log", lambda *a, **k: {
        "outcome": "partly_saved", "private_id": 5, "receipt": ["Saved: violet umbrella"], "notes": ["copper"], "questions": []})
    r = sv.raw("/log", text="x")
    j = shaped(r.json())
    assert j["head"] == "Saved privately." and j["receipt"] == [] and j["notes"] == [] and "violet" not in r.text


# ---- 4. one name each ------------------------------------------------------------------------------------------------------

def test_looks_right_takes_action(sv, fake):
    eat("Test odd bar", 900, 2, review=True, amount=40)
    ref = owner_sql("SELECT 'f' || id AS ref FROM food_entries")[0]["ref"]
    j = shaped(sv.post("/review", ref=ref, action="ok"))
    assert j["outcome"] == "changed" and j["day"]["needs"]["review"] == []


def test_a_food_entry_change_takes_action(sv, fake):
    eid = eat_on(day(), "08:10", oats(), 60)
    j = shaped(sv.post("/food/entry", ref=f"f{eid}", amount=80, key="fe-1", action="save"), "food")
    assert j["outcome"] == "changed" and float(owner_sql("SELECT amount FROM food_entries WHERE id = %s", eid)[0]["amount"]) == 80


def test_the_old_names_of_77_are_gone(sv, fake, breakfast):
    """act, t and items[].id worked for one deploy (77); since 78 they count as missing."""
    eid = eat_on(day(), "08:10", oats(), 60)
    r = sv.raw("/food/entry", ref=f"f{eid}", act="save", amount=80)
    assert r.status_code == 400 and r.json()["message"] == "action must be save or delete."
    r = sv.raw("/review", act="ok", ref=f"f{eid}")
    assert r.status_code == 400 and r.json()["message"] == "action must be ok or all."
    j = shaped(sv.post("/health", row="wake", t="07:10", key="old-t"))
    assert j["outcome"] == "rejected" and "hh:mm" in j["reason"]
    mid, (a, _b, _c) = breakfast
    j = shaped(sv.post("/usual", meal_id=mid, items=[{"id": a, "amount": 70}], time="08:00", key="old-id"))
    assert j["outcome"] == "rejected"
    assert [float(r["amount"]) for r in owner_sql("SELECT amount FROM food_entries")] == [60.0]


def test_an_unknown_action_names_the_new_field(sv):
    r = sv.raw("/food/entry", ref="f1", action="eat")
    assert r.status_code == 400 and r.json()["message"] == "action must be save or delete."
    r = sv.raw("/review")
    assert r.status_code == 400 and r.json()["message"] == "action must be ok or all."


def test_a_usual_meal_takes_item_id(sv, fake, breakfast):
    mid, (a, _b, _c) = breakfast
    j = shaped(sv.post("/usual", meal_id=mid, items=[{"item_id": a, "amount": 70}], time="08:00", key="u-1"))
    assert j["outcome"] == "saved"
    assert [float(r["amount"]) for r in owner_sql("SELECT amount FROM food_entries")] == [70.0]


def test_a_review_item_has_iso_at_and_logged_at(sv, fake):
    eid = event_ago("wake", minutes_ago=50)
    owner_sql("UPDATE events SET needs_review = true, review_reason = 'odd time' WHERE id = %s", eid)
    [r] = get(sv, "/day")["day"]["needs"]["review"]
    at = owner_sql("SELECT event_at FROM events WHERE id = %s", eid)[0]["event_at"]
    assert r["ref"] == f"e{eid}" and OFFSET.search(r["at"]) and datetime.fromisoformat(r["at"]) == at
    assert OFFSET.search(r["logged_at"]) and "time" not in r  # time: gone since deploy 78


# ---- 5. Undo on a reload, a mixed line's look-up ---------------------------------------------------------------------------

def test_the_reads_carry_the_sessions_undo(sv, fake):
    assert get(sv, "/day")["undo"] is None and get(sv, "/food/day")["undo"] is None
    u = got_undo(shaped(sv.post("/water", key="w-1")))
    assert get(sv, "/day")["undo"] == u and get(sv, "/food/day")["undo"] == u
    other = Door()  # another session has its own
    assert other.c.get("/api/v1/day", headers=other.h).json()["undo"] is None


def test_a_mixed_lines_look_up_is_in_result(sv, fake, skyr, monkeypatch):
    monkeypatch.setitem(ANSWERS, "150 g skyr and what did I eat today",
                        P(food=[F("skyr", 150)], command_text="what did I eat today"))
    j = shaped(sv.post("/log", text="150 g skyr and what did I eat today", key="mx-1"))
    assert j["outcome"] == "saved" and j["receipt"] and j["result"] and "Found." in j["result"] and "Skyr" in j["result"]


def test_a_mixed_lines_look_up_of_private_entries_is_hidden(sv, fake, monkeypatch):
    monkeypatch.setattr(api.logbook, "log", lambda *a, **k: {
        "outcome": "saved", "receipt": ["Saved: 150 g"], "questions": [],
        "command": {"outcome": "answered", "result": "P12 [gratitude] 14.11.2026: violet umbrella"}})
    r = sv.raw("/log", text="x")
    j = shaped(r.json())
    assert j["result"] is None and j["reason"] == reads.HIDDEN and j["receipt"] == [] and "violet" not in r.text


# ---- 6. hints ------------------------------------------------------------------------------------------------------------------

def test_a_found_food_says_per_100_ml_for_a_drink(sv):
    pending("pq8", "log", "Which food?", {"kind": "food", "item": {"food": "oat drink"},
                                           "lookup": {"name": "Oat drink", "src": "off", "values": {"kcal": 46, "drink": True}}})
    pending("pq9", "log", "Which food?", {"kind": "food", "item": {"food": "nut bar"},
                                           "lookup": {"name": "Nut bar", "src": "usda", "values": {"kcal": 500}}})
    qs = {q["id"]: q for q in get(sv, "/day")["day"]["needs"]["questions"]}
    assert qs["pq8"]["lookup"]["unit"] == "ml" and qs["pq9"]["lookup"]["unit"] == "g"
    assert [(a["reply"], a["style"]) for a in qs["pq9"]["answers"]] == [("yes", "primary"), ("skip", "quiet")]


def test_a_time_question_has_a_log_again_refill(sv):
    rid = raw()
    owner_sql("UPDATE raw_inbox SET content = 'tea at some point' WHERE id = %s", rid)
    pending("pq10", "log", "When was the tea?", {"kind": "time", "raw_id": rid})
    [q] = get(sv, "/day")["day"]["needs"]["questions"]
    assert q["refill"] == {"label": "Log again", "text": "tea at some point"} and q["answers"] == [{"reply": "skip", "label": "Skip", "style": "quiet"}]


@pytest.mark.parametrize("outcome", api.OUTCOMES)
def test_every_outcome_has_a_tone(sv, monkeypatch, outcome):
    monkeypatch.setattr(api.logbook, "log", lambda *a, **k: {"outcome": outcome, "questions": [], "reason": "x"})
    j = shaped(sv.post("/log", text="x"))
    assert j["tone"] == ("warning" if outcome in ("rejected", "needs_confirmation", "needs_choice", "not_logged", "held") else "ok")


def test_chat_lines_are_taken_out_of_read_backs():
    assert reads.plain("Test bar: 900 g in one item is a lot. Confirm with the user (resend with confirmed=true)") == \
        "Test bar: 900 g in one item is a lot."
    assert reads.plain("Nut: matches several foods: N1 a; N2 b. Ask which one; resend with its N-id") == "Nut: matches several foods: N1 a; N2 b."
    assert reads.plain("Weight 400 kg. Check the values with the user; resend with confirmed=true if they are right.") == "Weight 400 kg."
    table = "  N1  Test oats   60 g\nREAD BACK, nothing saved (nothing else in this message was saved either):\nAsk the user to confirm."
    assert reads.plain(table) == "N1  Test oats   60 g\nNothing saved yet:"
    assert reads.plain("Show the user these values; call add_food again.") is None and reads.plain(None) is None


def test_a_read_back_in_a_save_answer_has_no_chat_line(sv, monkeypatch):
    monkeypatch.setattr(api.logbook, "log", lambda *a, **k: {"outcome": "needs_confirmation", "questions": [],
                                                              "read_back": "Weight 400 kg is odd. Check with the user (confirmed=true if right)"})
    j = shaped(sv.post("/log", text="x"))
    assert j["read_back"] == "Weight 400 kg is odd."


# ---- 7. Try again and Delete on a message not read yet -------------------------------------------------------------------

def unread(text):
    return owner_sql("INSERT INTO private.incoming (channel, content, tries, last_error) VALUES ('web', %s, 1, 'ProviderError') RETURNING id",
                     text)[0]["id"]


def test_delete_takes_a_message_away_with_undo(sv, fake):
    hid = unread("150 g skyr, weight 82.4")
    j = shaped(sv.post("/held/delete", id=hid))
    assert j["outcome"] == "removed" and j["head"] == "Deleted the unread message." and j["day"]["needs"]["not_read"] == []
    u = got_undo(j)
    back = shaped(sv.post("/undo", token=u["token"]))
    assert back["head"] == "The unread message is back." and [m["id"] for m in back["day"]["needs"]["not_read"]] == [hid]
    again = shaped(sv.post("/held/delete", id=hid + 999))
    assert again["outcome"] == "rejected" and again["reason"] == "That message is no longer waiting."


def test_try_again_reads_and_saves_it(sv, fake, skyr):
    hid = unread("150 g skyr, weight 82.4")
    j = shaped(sv.post("/held/retry", id=hid, key="hr-1"))
    assert j["outcome"] == "saved" and j["receipt"] and j["day"]["needs"]["not_read"] == [] and j["refill"] is None
    assert n("SELECT count(*) AS n FROM food_entries") == 1


def test_try_again_on_words_that_are_not_an_entry_gives_them_back(sv, fake):
    unread("why is that?")
    hid = owner_sql("SELECT id FROM private.incoming")[0]["id"]
    j = shaped(sv.post("/held/retry", id=hid))
    assert j["outcome"] == "not_logged" and j["tone"] == "warning" and j["refill"] == {"label": "Log again", "text": "why is that?"}


@pytest.mark.parametrize("bad", [None, "12", 0, -3, True, 1.5])
def test_a_bad_message_id_is_a_bad_request(sv, bad):
    for path in ("/held/retry", "/held/delete"):
        r = sv.raw(path, id=bad)
        assert r.status_code == 400 and r.json()["error"] == "bad_request"


# ---- 8. the usual-meal editor (deploy 86) -------------------------------------------------------------------------------------

def test_the_usual_meal_shapes(sv, fake):
    oats, skyr = food("Test oats", 380, 13, 7, 60), food("Test skyr", 63, 11, 0.2, 4)
    meal = {"meal_id", "name", "drink", "nutrients", "items"}
    item = {"item_id", "food_id", "food", "amount", "unit", "nutrients"}
    j = sv.post("/usual/new", name="Test box", items=[{"food_id": oats, "amount": 60}, {"food_id": skyr, "amount": 150}], key="shape-u1")
    assert set(j) == {"v", "outcome", "head", "receipt", "notes", "reason", "questions", "read_back", "confirm", "result", "replayed",
                      "undo", "tone", "refill", "usual"}
    [m] = j["usual"]
    assert set(m) == meal and all(set(i) == item for i in m["items"]) and set(m["nutrients"]) == {"kcal", "protein", "fat", "carbs"}
    listed = get(sv, "/usual")
    assert set(listed) == {"v", "usual", "undo"} and listed["usual"] == j["usual"] and got_undo(listed)
    [f] = get(sv, "/foods?q=skyr")["foods"]
    assert set(f) == {"food_id", "name", "unit", "drink", "per_100"} and set(f["per_100"]) == {"kcal", "protein", "fat", "carbs"}
    asked = sv.post("/usual/meal", meal_id=m["meal_id"], action="save", name="Test box", items=[{"food_id": oats, "amount": 70}], view="day")
    assert asked["outcome"] == "needs_confirmation" and "day" in asked and "usual" not in asked  # view chooses the fresh read


# ---- 9. scan, label photo and look-up (deploy 89) ----------------------------------------------------------------------------------

def test_the_scan_shapes(sv, fake, off):
    from test_api_scan import GRANOLA_FORM, JPEG, Vision
    from test_log import OAT

    values = {"kcal", "protein", "fat", "carbs", "sat_fat", "sugar_total", "fibre", "salt_g"}
    fid = food("Test crispbread", 360, 10)
    owner_sql("UPDATE foods SET barcode = '4006040123456' WHERE id = %s", fid)
    j = get(sv, "/foods/barcode?code=4006040123456")
    assert set(j) == {"v", "code", "food"} and set(j["food"]) == {"food_id", "name", "unit", "amount"}
    assert get(sv, "/foods/barcode?code=40000000")["food"] is None
    off.products[OAT["code"]] = OAT
    j = get(sv, f"/foods/off?code={OAT['code']}")
    assert set(j) == {"v", "ok", "values", "name", "brand", "basis", "note"} and set(j["values"]) == values and j["ok"] is True
    assert set(get(sv, "/foods/off?code=40000000")) == {"v", "ok", "reason"}
    api.logbook.PROVIDER = Vision()
    try:
        r = sv.c.post("/api/v1/food/label", headers=sv.h, files=[("photo", JPEG)])
    finally:
        api.logbook.PROVIDER = fake
    j = r.json()
    assert set(j) == {"v", "ok", "values", "name", "brand", "basis", "note"} and set(j["values"]) == values
    assert shaped(sv.post("/food/labeladd", **GRANOLA_FORM, amount=40, key="shape-l1"))["outcome"] == "saved"
    j = shaped(sv.post("/lookup", text=OAT["code"]))
    [q] = j["questions"]
    assert j["outcome"] == "needs_confirmation" and q["tool"] == "lookup_confirm" and q["lookup"] is None and j["read_back"]


# ---- 10. the Health page and body measurements (deploy 91) -------------------------------------------------------------------------

def test_the_health_and_body_shapes(sv, fake):
    from test_api_health import week
    from test_body import seed, woke

    t = day()
    week(t)
    seed(t, waist=92.5, hips=101.0)
    h = get(sv, "/health?range=7")
    assert set(h) == {"v", "health", "undo"}
    h = h["health"]
    assert set(h) == {"today", "start", "range", "ranges", "all", "days_in_range", "shown_days", "oldest_day", "columns", "days", "charts", "times"}
    assert all(set(c) == {"row", "label", "sub", "type", "period", "kind"} for c in h["columns"])
    r = h["days"][1]
    assert set(r) == {"day", "values", "slept_minutes"} and len(r["values"]) == 8
    assert all(set(v) == {"ref", "v1", "v2", "time", "at"} for v in r["values"].values() if v)
    for c in h["charts"]:
        assert set(c) == {"id", "title", "small", "stat", "chart", "legend"}
        assert {"start", "days", "series", "label"} <= set(c["chart"]) and all(set(s) == {"mark", "cls", "pts"} for s in c["chart"]["series"])
        assert all(set(p) == {"text", "bold"} for p in c["stat"]) and all(set(k) == {"key", "text"} for k in c["legend"])
    tm = h["times"]
    assert set(tm) == {"days", "rows", "empty", "title", "small", "legend"}
    assert all(set(x) == {"date", "label", "bands", "ticks"} for x in tm["rows"])
    assert all(set(b) == {"from", "to", "nap", "tip"} for x in tm["rows"] for b in x["bands"])
    assert all(set(k) == {"at", "nap", "tip"} for x in tm["rows"] for k in x["ticks"])
    b = get(sv, "/body")
    assert set(b) == {"v", "body", "undo"}
    b = b["body"]
    assert set(b) == {"today", "day", "last_measured", "due_text", "interval_days", "hidden", "jump_cm", "protocol", "hint", "form", "table",
                      "first_day", "charts", "waist_height", "weight_rate"}
    assert all(set(f) == {"key", "label", "hint", "ref", "cm", "last_cm", "min", "max"} for f in b["form"])
    assert all(set(x) == {"key", "label", "ref", "cm", "day", "last", "start", "last_text", "start_text"} for x in b["table"])
    assert all(set(c) == {"key", "label", "chart"} for c in b["charts"])
    assert set(b["weight_rate"] or {"kg_week": 0, "pct_week": 0, "sign": ""}) == {"kg_week", "pct_week", "sign"}
    j = sv.post("/health/day", day=t.isoformat(), values={"weight": 79.9})
    assert set(j) == KEYS | {"health"}
    j = sv.post("/body", day=t.isoformat(), values={"waist": 92.0})
    assert set(j) == KEYS | {"body"}
    woke(t)
    assert set(get(sv, "/day")["day"]["needs"]) == {"questions", "not_read", "review", "checkin", "body_due"}
    assert set(sv.post("/body/skip")) == KEYS | {"day"}


# ---- 11. the Habits page (deploy 93) -------------------------------------------------------------------------------------------------

def test_the_habits_shapes(sv, fake):
    from test_api_habits import invented, today

    invented()
    j = get(sv, "/habits?show=all")
    assert set(j) == {"v", "habits", "undo"}
    h = j["habits"]
    assert set(h) == {"today", "start", "days", "edit_from", "checklist", "calendar", "show", "help", "shows", "list", "groups", "default_group", "limits"}
    assert set(h["checklist"]) == {"done", "total", "habits"}
    assert all(set(x) == {"name", "label", "done", "target", "complete", "avoid", "last_tick"} for x in h["checklist"]["habits"])
    assert all(set(c) == {"name", "label", "target", "avoid", "full", "editable", "days"} for c in h["calendar"])
    assert all(len(c["days"]) == 30 and all(set(d) == {"day", "n", "state", "text"} for d in c["days"]) for c in h["calendar"])
    assert {d["state"] for c in h["calendar"] for d in c["days"]} == {"done", "partly", "logged", "none"}
    assert all(set(s) == {"key", "label", "count"} for s in h["shows"]) and [s["key"] for s in h["shows"]] == ["tracked", "untracked", "retired", "all"]
    assert all(set(g) == {"group", "label", "habits"} for g in h["list"])
    assert all(set(x) == {"name", "label", "group", "target", "order", "remind_after", "avoid", "state", "ticks", "days30", "last_day", "stats", "can_track", "can_delete"}
               for g in h["list"] for x in g["habits"])
    assert all(set(g) == {"key", "label"} for g in h["groups"]) and set(h["limits"]) == {"label_max", "target_min", "target_max", "order_max", "remind_min", "remind_max", "remind_step"}
    j = sv.post("/habit/day", name="zz_walk", day=today().isoformat(), key="shape-1")
    assert set(j) == KEYS | {"habits"} and set(j["habits"]) == set(h)
    j = sv.post("/habits/manage", action="edit", name="zz_walk", label="Zz walk", target=1)
    assert set(j) == KEYS | {"habits"} and j["undo"] is None
    j = sv.post("/habits/manage", action="delete", name="zz_walk")
    assert set(j) == KEYS | {"habits"} and j["outcome"] == "rejected"


# ---- 12. the Gym (deploy 95) -------------------------------------------------------------------------------------------------------

SET = {"set_id", "sets", "reps", "kg", "minutes", "km", "text"}


def test_the_gym_shapes(sv, fake, monkeypatch):
    from test_api_gym import invented
    from test_watch import TOKEN, payload, post
    from test_web import client

    x = invented()
    j = get(sv, "/gym")
    assert set(j) == {"v", "gym", "undo"}
    g = j["gym"]
    assert set(g) == {"today", "title", "started_at", "done", "status", "has_split", "day", "free", "picked_by_hand", "chips", "why", "exercises",
                      "other", "empty", "hint", "week_split", "weeks", "retired", "fields", "numbers", "kinds"}
    assert set(g["day"]) == {"day_id", "name", "label"} and all(set(c) == {"day_id", "label", "on"} for c in g["chips"])
    for r in g["exercises"] + g["other"]:
        assert set(r) == {"exercise_id", "name", "kind", "active", "done", "logged", "values", "ready", "text", "up_kg", "last", "last_text", "plan", "open"}
        assert set(r["values"]) == {"sets", "reps", "kg", "minutes", "km"} and all(set(s) == SET for s in r["logged"])
        assert r["last"] is None or (set(r["last"]) == {"day", "rows"} and all(set(s) == SET for s in r["last"]["rows"]))
        assert r["plan"] is None or set(r["plan"]) == {"item_id", "sets", "reps"}
    assert all(set(s) == {"day_id", "label", "exercises", "done", "today"} for s in g["week_split"])
    assert set(g["weeks"]) == {"good", "weeks"} and all(set(w) == {"start", "label", "n", "days"} for w in g["weeks"]["weeks"])
    assert all(set(d) == {"day", "on", "today", "later"} for w in g["weeks"]["weeks"] for d in w["days"])
    assert set(g["fields"]) == {"weights", "bodyweight", "cardio"} and all(set(f) == {"name", "label", "step", "min", "max"} for fs in g["fields"].values() for f in fs)
    p = get(sv, "/gym/plan")["gym_plan"]
    assert set(p) == {"today", "how", "week", "done", "day", "free", "days", "removed", "limits"}
    assert all(set(d) == {"day_id", "name", "label", "today", "items", "can_add"} for d in p["days"])
    assert all(set(i) == {"item_id", "exercise_id", "name", "kind", "active", "sets", "reps", "text"} for d in p["days"] for i in d["items"])
    assert all(set(e) == {"exercise_id", "name"} for d in p["days"] for e in d["can_add"]) and all(set(d) == {"day_id", "label", "day"} for d in p["done"])
    e = get(sv, "/gym/exercises")["gym_exercises"]
    assert set(e) == {"active", "exercises", "kinds", "limits"}
    assert all(set(x_) == {"exercise_id", "name", "kind", "kind_label", "words", "active", "workouts", "last_day", "use", "meta"} for x_ in e["exercises"])
    pr = get(sv, f'/gym/progress?x={x["bench"]}')["gym_progress"]
    assert set(pr) == {"today", "start", "weeks", "per_week", "exercises", "exercise", "unit", "title", "top", "top_reps", "top_text", "change",
                       "one_rep_max", "sub", "chart", "recent"}
    assert set(pr["per_week"]) == {"weeks", "top", "good"} and all(set(w) == {"start", "n"} for w in pr["per_week"]["weeks"])
    assert {"start", "days", "label", "series", "decimals"} == set(pr["chart"]) and all(set(r) == {"day", "text", "rows"} for r in pr["recent"])
    assert set(get(sv, "/gym/progress?x=999999")["gym_progress"]) == set(pr)
    h = get(sv, "/gym/history")["gym_history"]
    assert set(h) == {"workouts"}
    assert all(set(w) == {"workout_id", "anchor", "day", "split_day_id", "split", "started_at", "ended_at", "when", "exercises"} for w in h["workouts"])
    assert all(set(x_) == {"exercise_id", "name", "kind", "text", "rows"} for w in h["workouts"] for x_ in w["exercises"])
    keys = {"has_data", "setup", "today", "day", "label", "prev_day", "next_day", "tiles", "sleep", "workouts", "charts"}
    a = get(sv, "/gym/activity")["gym_activity"]
    assert set(a) == keys and set(a["setup"]) == {"title", "token_set", "intro", "steps", "note"}
    assert all(set(part) == {"text", "code"} for st in a["setup"]["steps"] for part in st)
    monkeypatch.setenv("WATCH_TOKEN", TOKEN)
    post(client("log.19hospitalroad.fyi"), payload(day()))
    a = get(sv, "/gym/activity")["gym_activity"]
    assert set(a) == keys and all(set(t) == {"key", "label", "value", "unit", "text", "avg7", "sub"} for t in a["tiles"])
    assert set(a["sleep"]) == {"hours", "text", "in_bed_from", "in_bed_to", "in_bed", "stages", "stages_text", "typed", "typed_text"}
    assert all(set(s) == {"key", "label", "hours", "text"} for s in a["sleep"]["stages"])
    assert all(set(w) == {"name", "start_at", "end_at", "minutes", "kcal", "hr_avg", "km", "meta", "matches"} for w in a["workouts"])
    assert all(set(c) == {"id", "title", "chart"} for c in a["charts"])
    card = get(sv, "/day")["day"]["gym"]
    assert set(card) == {"last_workout", "day_label", "days", "n14", "last_week", "this_week", "text"} and all(set(d) == {"day", "on", "today"} for d in card["days"])
    j = sv.post("/gym/tick", exercise_id=x["press"], sets=3, reps=10, kg=30, key="shape-gym-1")
    assert set(j) == KEYS | {"gym"} and set(j["gym"]) == set(g)
    assert set(sv.post("/gym/itemremove", item_id=p["days"][0]["items"][0]["item_id"])) == KEYS | {"gym_plan"}
    assert set(sv.post("/gym/active", exercise_id=x["row"], on=False)) == KEYS | {"gym_exercises"}


# ---- 13. Home (deploy 98) ----------------------------------------------------------------------------------------------------------

HROW = {"chore_id", "zone_id", "name", "zone", "short", "label", "flat", "age", "age_text", "interval", "interval_text", "minutes", "done_today", "done_at"}
HDONE = {"ids", "chore_id", "chore", "zones", "flat", "label", "at", "day", "dated", "source", "how", "time", "when"}


def test_the_home_shapes(sv, fake):
    from test_api_home import invented

    x = invented()
    sv.post("/home/start", pairs=[[x["stove"], x["kitchen"]]], minutes=15)
    h = get(sv, "/home")["home"]
    assert set(h) == {"today", "empty", "minutes", "minutes_options", "timer", "week", "rows", "count", "shown", "hidden", "recent"}
    assert set(h["timer"]) == {"id", "state", "left", "ends_at", "minutes", "title", "pairs"} and OFFSET.search(h["timer"]["ends_at"])
    assert set(h["week"]) == {"goal", "this", "weeks"} and all(set(r) == HROW for r in h["rows"]) and all(set(e) == HDONE for e in h["recent"])
    assert all(OFFSET.search(e["at"]) for e in h["recent"]) and all(set(m) == {"minutes", "label"} for m in h["minutes_options"])
    p = get(sv, "/home/pick")["home_pick"]
    assert set(p) == {"today", "empty", "minutes", "title", "timer", "job", "n", "count", "also", "earlier", "next_from_s", "earlier_days"}
    assert set(p["job"]) == {"pairs", "title", "zone", "age", "age_text", "minutes", "steps", "howto", "over", "session"}
    z = get(sv, "/home/zones")["home_zones"]
    assert set(z) == {"today", "empty", "start", "flat", "zones"} and set(z["start"]) == {"jobs", "more", "answers"}
    assert all(set(j) == {"chore_id", "name", "pairs", "zone", "zones", "where", "interval", "interval_text"} for j in z["start"]["jobs"])
    for f in z["flat"]:
        assert set(f) == {"chore_id", "name", "interval", "interval_text", "minutes", "all_done_today", "per_zone", "tiles"}
        assert set(f["per_zone"]) == {"text", "groups", "off"} and all(set(t) == HROW | {"age_short", "tinted"} for t in f["tiles"])
    assert all(set(c) == {"zone_id", "name", "short", "count", "own", "chores", "open", "todoist", "oldest_age", "oldest_text"} for c in z["zones"])
    hi = get(sv, "/home/history")["home_history"]
    assert set(hi) == {"today", "limit", "step", "max", "more", "count", "days", "jobs", "earlier_days"}
    assert all(set(d) == {"day", "label", "rows"} and all(set(e) == HDONE for e in d["rows"]) for d in hi["days"])
    assert all(set(j) == {"pairs", "label"} for j in hi["jobs"])
    keys = {"chore_id", "name", "zone_id", "zone", "flat", "active", "interval", "interval_text", "minutes", "meta", "steps", "howto", "words", "zones",
            "last", "last_text", "usually_days", "usually"}
    c = get(sv, f'/home/chore?id={x["stove"]}')["home_chore"]
    f = get(sv, f'/home/chore?id={x["dust"]}')["home_chore"]
    assert set(c) == keys == set(f) and all(set(d) == {"day", "start"} for d in c["last"])
    assert all(set(zz) == {"zone_id", "zone", "on", "interval", "interval_text", "minutes", "text", "usually_days", "usually", "last", "last_text"}
               for zz in f["zones"])
    e = get(sv, "/home/edit")["home_edit"]
    assert set(e) == {"goal", "flat", "zones", "zone_options", "limits"}
    chore_keys = {"chore_id", "name", "zone_id", "flat", "active", "interval", "interval_text", "minutes", "meta", "steps", "howto", "words", "per_zone"}
    assert all(set(ch) == chore_keys for ch in e["flat"] + [ch for zz in e["zones"] for ch in zz["chores"]])
    assert all(set(zz) == {"zone_id", "name", "short", "spots", "words", "active", "count", "chores"} for zz in e["zones"])
    assert all(set(pz) == {"zone_id", "zone", "on", "days", "minutes"} for ch in e["flat"] for pz in ch["per_zone"])
    card = get(sv, "/day")["day"]["home"]
    assert set(card) == {"this_week", "goal", "text", "waiting", "hidden"} and set(card["waiting"]) == HROW
    j = sv.post("/home/tick", chore_id=x["fridge"], zone_id=x["kitchen"], key="shape-home-1")
    assert set(j) == KEYS | {"home"} and set(j["home"]) == set(h)
    for action, body, view in (("alldone", {"chore_id": x["vacuum"], "key": "shape-home-2"}, "home_zones"), ("remove", {"ids": [1]}, "home_history"),
                               ("goalset", {"goal": 4}, "home_edit"), ("skip", {"pairs": [[x["towels"], x["bath"]]]}, "home_pick")):
        assert set(sv.post(f"/home/{action}", **body)) == KEYS | {view}, action


# ---- 14. Trends (deploy 101) -------------------------------------------------------------------------------------------------------

def test_the_trends_shapes(sv, monkeypatch):
    from app import coach
    from test_api_trends import CARD, REVIEW, TILE, WEEK, invented, review
    from test_coach import FakeCoach

    monkeypatch.setattr(coach, "PROVIDER", FakeCoach())
    monkeypatch.setattr(coach, "BACKGROUND", False)
    t0 = invented()
    review("last", t0=t0)
    part = {"key", "title", "style", "tone", "items", "meal", "text"}
    for p in ("7", "last", "30", "this"):
        w = get(sv, f"/week?p={p}")["week"]
        assert set(w) == WEEK and all(set(t) == TILE for t in w["food"]) and all(set(r) == {"key", "label", "value", "detail"} for r in w["health"])
        assert set(w["foods"]) == {"by_kcal", "by_count"} and all(set(r) == {"name", "kcal", "n", "text"} for rs in w["foods"].values() for r in rs)
        assert all(set(c) == CARD and all(set(x) == {"text", "bold"} for x in c["stat"]) and all(set(k) == {"key", "text"} for k in c["legend"])
                   for c in w["charts"])
        assert all(set(r) == {"day", "label", "kcal", "protein", "fat", "carbs", "kg", "partly"} for r in w["days"])
        assert w["review"] is None or set(w["review"]) == REVIEW and all(set(x) == part for x in w["review"]["parts"])
    r = get(sv, "/week?p=last")["week"]["review"]
    assert r["state"] == "done" and set(r["meta"]) == {"model", "usd", "at", "at_text", "text"} and OFFSET.search(r["meta"]["at"])
    assert all(set(x) == {"label", "href"} for x in r["links"])
    r = get(sv, "/week?p=7")["week"]["review"]
    assert set(r["latest"]) == {"start", "end", "text"} and all(set(x) == {"p", "label"} for x in r["weeks"])
    t = get(sv, "/food/trends?range=7")["trends"]
    assert set(t) == {"range", "ranges", "start", "end", "title", "small", "charts"} and all(set(c) == CARD for c in t["charts"])
    i = get(sv, "/insights")["insights"]
    assert set(i) == {"days", "ranges", "min_each", "title", "small", "cards", "note"}
    keys = {"key", "title", "unit", "digits", "sign", "needs", "waiting", "wait_text", "chip", "say", "caveat", "zero", "groups"}
    assert all(set(c) == keys and all(set(g) == {"key", "label", "n", "mean", "text", "cls", "left", "width"} for g in c["groups"]) for c in i["cards"])
    assert get(sv, "/coach/status?id=1")["coaching"].keys() == {"id", "state"}
    from app import weekpage
    a, b = weekpage.bounds("30", t0)
    j = sv.post("/coach/start", kind="week", start=(a - timedelta(days=10)).isoformat(), end=b.isoformat())  # 40 days: refused
    assert set(j) == KEYS | {"week", "coaching"} and j["outcome"] == "rejected" and j["coaching"] is None


# ---- 15. Library and Medical (deploy 104) ----------------------------------------------------------------------------------------

def test_the_library_and_medical_shapes(sv, fake):
    from test_api_library import CATALOGUE, ITEM, ROW, invented as foods
    from test_api_medical import invented as labs
    f, x = foods(), labs()
    c = get(sv, "/food/catalogue?f=all&s=name")
    assert set(c) == {"v", "catalogue", "undo"} and set(c["catalogue"]) == CATALOGUE and all(set(r) == ROW for r in c["catalogue"]["rows"])
    assert all(set(r["per_100"]) == {"kcal", "protein", "fat", "carbs"} for r in c["catalogue"]["rows"])
    i = get(sv, f"/food/item?id={f['oatdrink']}")["food_item"]
    assert set(i) == ITEM and set(i["source"]) == {"text", "line", "source", "brand", "note"} and all(set(v) == {"key", "label", "value"} for v in i["values"])
    assert all(set(u) == {"unit", "grams", "text"} for u in i["units"]) and set(i["past"]) == {"n", "text"}
    lb = get(sv, f"/labs?open={x['r4']}")["labs"]
    assert set(lb["flagged"]) == {"report_id", "ref", "date", "date_text", "title", "heading", "empty", "hint", "chips"}
    assert all(set(r) == {"id", "ref", "date", "date_text", "title", "kind", "provider", "values", "flagged"} for r in lb["reports"])
    assert set(lb["open"]) == {"id", "ref", "date", "date_text", "title", "kind", "provider", "notes", "values", "empty", "form", "value_hint", "report_hint"}
    assert all(set(v) == {"id", "ref", "test_id", "test", "note", "text", "value", "unit", "range", "ref_low", "ref_high", "flag", "flag_word", "site",
                          "printed"} for v in lb["open"]["values"])
    t = get(sv, f"/labs/tests?t={x['t_vitd']}")["labs_tests"]
    assert set(t) == {"q", "placeholder", "title", "empty", "tests", "test", "card", "rows"}
    assert set(t["card"]) == {"id", "title", "small", "stat", "chart", "legend", "note"} and set(t["card"]["chart"]) == {"start", "days", "label", "years", "band", "series"}
    m = get(sv, "/labs/meds")["labs_meds"]
    assert set(m) == {"today", "running", "empty", "hint", "form_hint", "meds", "limits"}
    for path, body, view in (("/food/catalogue/reviewed", {"id": f["rye"]}, {"catalogue", "food_item"}),
                             ("/labs/value", {"id": x["r4_hb"], "value": "12.9"}, {"labs"}), ("/labs/med", {"id": x["d_vitd"], "act": "end"}, {"labs_meds"}),
                             ("/labs/report", {"id": x["r4"], "title": "Zz other"}, {"labs"})):
        assert set(sv.post(path, **body)) == KEYS | view, path
    assert set(sv.post("/labs/value", id=x["r4_hb"], value="12.9", view="labs_tests", view_t=x["t_hb"])) == KEYS | {"labs_tests"}


def test_the_food_words_shape(sv, fake):
    from test_food_words import ROW, WORDS, foods
    x = foods()
    w = get(sv, "/food/words")
    assert set(w) == {"v", "words", "undo"} and set(w["words"]) == WORDS and w["words"]["rows"] and all(set(r) == ROW for r in w["words"]["rows"])
    assert w["words"]["rows"][0]["added_at"] and OFFSET.search(w["words"]["rows"][0]["added_at"]) and w["words"]["rows"][0]["month"] == "2026-08"
    j = sv.post("/food/catalogue/words", id=x["rye"], act="remove", word="bread", view="words")
    assert set(j) == KEYS | {"words"} and set(j["words"]) == WORDS and j["undo"] and set(j["undo"]) == {"token", "head", "expires_at"}


# ---- 16. Search, Recent, Usage, Coach (deploy 107) ----------------------------------------------------------------------------------

def test_the_more_and_coach_shapes(sv, monkeypatch):
    from app import coach
    from test_api_coach import CARD, COACH, ITEM, PART, invented as coachings
    from test_api_more import KIND, MESSAGE, RECENT, SEARCH, TILES, TOP, USAGE, invented as more
    from test_coach import FakeCoach

    monkeypatch.setattr(coach, "PROVIDER", FakeCoach())
    monkeypatch.setattr(coach, "BACKGROUND", False)
    x = more()
    coachings()
    s = get(sv, "/search?q=zz")
    assert set(s) == {"v", "search", "undo"} and set(s["search"]) == SEARCH
    rows = {"foods": {"id", "food_id", "name"}, "ate": {"id", "ref", "day", "day_text", "food", "amount", "unit", "amount_text", "note"},
            "workouts": {"workout_id", "anchor", "day", "day_text", "split", "text"}, "chores": {"chore_id", "label", "day", "day_text", "start"},
            "tests": {"test_id", "name"}}
    for k, keys in rows.items():
        assert set(s["search"][k]) == {"title", "rows", "more"} and s["search"][k]["rows"] and all(set(r) == keys for r in s["search"][k]["rows"]), k
    r = get(sv, "/recent")["recent"]
    assert set(r) == RECENT and all(set(d) == {"day", "head", "messages"} for d in r["days"])
    assert all(set(m) == MESSAGE and all(set(i) == {"kind", "text"} for i in m["saved"]) for d in r["days"] for m in d["messages"])
    u = get(sv, "/usage?r=all")["usage"]
    assert set(u) == USAGE and set(u["tiles"]) == TILES and all(set(k) == KIND for k in [*u["kinds"], u["all"]]) and all(set(t) == TOP for t in u["top"])
    assert set(u["chart"]) == {"start", "days", "series", "label", "min", "prefix", "decimals"} and all(set(x_) == {"r", "label", "current"} for x_ in u["ranges"])
    c = get(sv, "/coach")["coach"]
    assert set(c) == COACH and set(c["card"]) == CARD and set(c["month"]) == {"count", "usd", "text"}
    assert all(set(i) == ITEM and all(set(p) == PART for p in i["parts"]) and set(i["meta"]) == {"model", "usd", "at", "at_text", "text"}
               for i in c["list"])
    assert OFFSET.search(c["list"][0]["meta"]["at"]) and all(set(f) == {"f", "label", "current"} for f in c["filters"])
    assert set(get(sv, "/day")["day"]["coach"]) == CARD
    h = get(sv, f"/gym/history?w={x['w_free']}")["gym_history"]
    assert set(h) == {"workouts"}
    t0 = get(sv, "/day")["day"]["day"]
    j = sv.post("/coach/start", kind="day", start=t0, end="2999-01-01")  # refused: end after today
    assert set(j) == KEYS | {"day", "coaching"} and j["outcome"] == "rejected" and j["coaching"] is None
    assert set(sv.post("/coach/start", kind="day", start=t0, end=t0, view="coach")) == KEYS | {"coach", "coaching"}


# ---- 17. Settings and notifications (deploy 110) --------------------------------------------------------------------------------------

SETTINGS = {
    "settings_targets": {"valid_from", "current", "fields", "history", "limits", "hint"},
    "settings_today": {"groups", "hint"},
    "settings_body": {"valid_from", "height", "heights", "height_range", "interval", "measures", "limits", "suggestions", "hints"},
    "settings_coach": {"goals", "style", "max", "kinds", "facts", "model", "daily_limit"},
    "settings_devices": {"devices", "others"},
    "settings_notify": {"on", "on_label", "nudges", "awake_hours", "subscriptions", "public_key", "twice"},
    "settings_export": {"title", "intro", "private_label", "button", "hint", "last"},
}


def test_the_settings_shapes(sv):
    owner_sql("INSERT INTO food_targets (valid_from, kcal, note) VALUES ('2020-01-01', 2000, 'zz')")
    owner_sql("INSERT INTO body_height (valid_from, height_cm) VALUES ('2020-01-01', 170)")
    owner_sql("""INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent, origin) VALUES ('https://web.push.apple.com/zz-shape', 'k', 'a', 'x', 'logger')""")
    owner_sql("INSERT INTO audit_log (tool, outcome, client, detail) VALUES ('export', 'ok', 'web', '{\"private\": false}')")
    try:
        for name, keys in SETTINGS.items():
            j = get(sv, "/settings/" + name.removeprefix("settings_"))
            assert set(j) == {"v", name, "undo"} and set(j[name]) == keys, name
        s = {name: get(sv, "/settings/" + name.removeprefix("settings_"))[name] for name in SETTINGS}
        t = s["settings_targets"]
        assert all(set(f) == {"key", "label", "unit", "value"} for f in t["fields"]) and set(t["current"]) == {"valid_from", "valid_from_text", "note"}
        assert all(set(h) == {"valid_from", "valid_from_text", "values", "note"} for h in t["history"])
        assert all(set(g) == {"kind", "heading", "items"} and all(set(i) == {"id", "label", "shown"} for i in g["items"]) for g in s["settings_today"]["groups"])
        b = s["settings_body"]
        assert set(b["height"]) == {"cm", "valid_from"} and all(set(h) == {"cm", "valid_from", "valid_from_text"} for h in b["heights"])
        assert set(b["interval"]) == {"days", "min", "max", "default"} and all(set(m) == {"key", "label", "landmark", "min", "max", "words", "shown", "has_values"} for m in b["measures"])
        assert set(b["limits"]) == {"label", "landmark_max", "cm", "words_max", "word_max"} and set(b["hints"]) == {"height", "measures", "remove"}
        assert all(set(x) == {"label", "landmark", "min", "max", "words"} for x in b["suggestions"]) and b["suggestions"]
        assert all(set(k) == {"kind", "title", "parts"} and all(set(p) == {"key", "label", "on"} for p in k["parts"]) for k in s["settings_coach"]["kinds"])
        assert all(set(d) == {"id", "name", "address", "signed_in", "last_used", "expires", "current"} for d in s["settings_devices"]["devices"])
        nt = s["settings_notify"]
        assert all(set(x) == {"key", "label", "after", "on", "hours", "note"}
                   and (x["hours"] is None and x["after"] is None or set(x["hours"]) == {"key", "value", "min", "max", "step", "default"})
                   for x in nt["nudges"])
        assert [x["key"] for x in nt["nudges"] if x["hours"] is None] == ["home_timer"]  # a switch alone (web item 57)
        assert all(set(x) == {"id", "name", "address", "on_since", "last_delivered", "this"} for x in nt["subscriptions"]) and nt["subscriptions"]
        assert set(s["settings_export"]["last"]) == {"at", "private", "text"} and OFFSET.search(s["settings_export"]["last"]["at"])
        assert set(get(sv, "/day")["day"]["shown"]) == {"review", "gratitude"}
        for path, body, view in (("/settings/targets", {"valid_from": "2021-01-01", "kcal": 1900}, "settings_targets"),
                                 ("/settings/today", {"groups": {"card": [{"id": "home", "shown": False}]}}, "settings_today"),
                                 ("/settings/today_reset", {}, "settings_today"), ("/settings/height", {"valid_from": "2021-01-01", "height": 171}, "settings_body"),
                                 ("/settings/body", {"interval": 30}, "settings_body"), ("/settings/coach", {"goals": "zz"}, "settings_coach"),
                                 ("/settings/others", {}, "settings_devices"), ("/settings/device", {"id": "x"}, "settings_devices"),
                                 ("/settings/nudges", {"on": True}, "settings_notify"), ("/push/off", {"id": 999999}, "settings_notify"),
                                 ("/push/subscribe", {"endpoint": "https://zz.example.test", "keys": {}}, "settings_notify"),
                                 ("/settings/coach", {"goals": "zz", "view": "day"}, "day")):
            assert set(sv.post(path, **body)) == KEYS | {view}, path
    finally:
        owner_sql("DELETE FROM food_targets")
        owner_sql("DELETE FROM push_subscriptions WHERE endpoint = 'https://web.push.apple.com/zz-shape'")

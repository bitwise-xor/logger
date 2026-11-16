"""The door's shape after the review of 16.11.2026 (deploy 77): the night's bed time on the Health card, a save's questions in full,
the private guard on questions and on lines the AI files as private, one name per field (the old names gone since deploy 78), Undo on a
reload, a mixed line's look-up in result, answer styles and refill buttons, the outcome's tone, no chat lines in read-backs, and
Try again / Delete on a message not read yet; the usual-meal editor's shapes (deploy 86). Every name, food, number and sentence is invented."""
from datetime import datetime

import pytest

from app import api, reads
from conftest import owner_sql
from test_api_door import door, door_on, signed_in  # noqa: F401 - door_on is autouse
from test_api_reads import OFFSET, event as event_ago, pending
from test_api_saves import Door, breakfast, clean_usual, got_undo, n, shaped  # noqa: F401 - clean_usual is autouse; breakfast a fixture
from test_log import ANSWERS, F, P, fake, off, skyr  # noqa: F401 - fixtures reused: the AI is a fake
from test_webbed import recent_wake
from test_webfood import eat_on, oats
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

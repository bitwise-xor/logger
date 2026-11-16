"""The JSON door's saves (api.py "saves (deploy 76)", 16.11.2026): POST /api/v1/log, /again, /usual, /water, /habit, /checkin, /health,
/answer, /review, /food/entry, /food/note and /undo. Each route is called as the front end calls it (JSON and the bearer token) and
runs the same function as the live form; the AI is a fake. Every route answers in one shape (saved), and a private or gratitude line
never has its words in the answer. Every name, food, number and sentence is invented."""
import json
import time
from datetime import timedelta

import pytest

from app import api, reads, service, webentry, webundo
from app import web as webapp
from conftest import owner_sql
from test_api_door import door, door_on, signed_in  # noqa: F401 - door_on is autouse
from test_log import fake, off, skyr  # noqa: F401 - fixtures reused: the AI is a fake (off: no Open Food Facts)
from test_web import web  # noqa: F401 - a signed-in app. session (fixture)
from test_webfood import eat_on, entry, oats
from test_webtoday import day, eat, food, raw

KEYS = {"v", "outcome", "head", "receipt", "notes", "reason", "questions", "read_back", "confirm", "result", "replayed", "undo", "tone", "refill"}
SKYR_LINE = "150 g skyr, weight 82.4"  # in test_log's fake answers: 150 g Skyr natural and a weight of 82.4


def n(sql, *args):
    return owner_sql(sql, *args)[0]["n"]


def foods_eaten():
    return [(r["name"], float(r["amount"])) for r in owner_sql(
        "SELECT f.name, e.amount FROM food_entries e JOIN foods f ON f.id = e.food_id ORDER BY e.id")]


@pytest.fixture(autouse=True)
def clean_usual():
    owner_sql("TRUNCATE usual_meals CASCADE")
    owner_sql("DELETE FROM food_targets")
    yield
    owner_sql("TRUNCATE usual_meals CASCADE")
    owner_sql("DELETE FROM food_targets")


class Door:
    """The front end's server: a signed-in door client."""

    def __init__(self):
        self.c, self.h, self.j = signed_in()

    def raw(self, path, **body):
        return self.c.post("/api/v1" + path, headers=self.h, json=body)

    def post(self, path, **body):
        r = self.raw(path, **body)
        assert r.status_code == 200, (path, r.status_code, r.text)
        j = r.json()
        assert j["v"] == 1
        return j

    def undo_row(self):
        return owner_sql("SELECT undo FROM web_sessions WHERE token_hash = %s", webapp._h(self.j["token"]))[0]["undo"]


@pytest.fixture
def sv():
    return Door()


def shaped(j, view="day"):
    """The one answer shape, with the day (Today) or the food day (Food page)."""
    assert set(j) == KEYS | {"day" if view == "day" else "food_day"}, sorted(j)
    assert isinstance(j["receipt"], list) and isinstance(j["notes"], list) and isinstance(j["questions"], list)
    assert isinstance(j["replayed"], bool) and isinstance(j["head"], str) and j["head"]
    json.dumps(j)
    return j


def got_undo(j):
    assert j["undo"] and set(j["undo"]) == {"token", "head", "expires_at"}, j["undo"]
    assert j["undo"]["token"] and j["undo"]["head"]
    return j["undo"]


def row_refs(j):
    return {r["ref"]: r for r in j["day"]["rows"]}


@pytest.fixture
def breakfast(skyr):
    o = food("Test oats", 380, 13, 7, 60)
    honey = food("Test honey", 304, 0.3, 0, 82)
    mid = owner_sql("INSERT INTO usual_meals (name) VALUES ('usual breakfast') RETURNING id")[0]["id"]
    items = owner_sql("""INSERT INTO usual_meal_items (meal_id, food_id, grams, sort_order)
                         VALUES (%s, %s, 60, 1), (%s, %s, 200, 2), (%s, %s, 10, 3) RETURNING id""", mid, o, mid, skyr, mid, honey)
    return mid, [i["id"] for i in items]


# ---- the answer shape ---------------------------------------------------------------------------------------------

def test_a_save_answers_in_one_shape_with_the_fresh_day(sv, fake):
    j = shaped(sv.post("/water"))
    assert j["outcome"] == "saved" and j["day"]["day"] == day().isoformat() and j["day"]["water"]["ml"] == 250
    assert j["reason"] is None and j["read_back"] is None and j["confirm"] is None and j["result"] is None and j["replayed"] is False


def test_view_food_gives_the_food_day_instead_of_the_day(sv, fake):
    j = shaped(sv.post("/water", view="food"), "food")
    assert "day" not in j and j["food_day"]["day"] == day().isoformat()
    assert [(r["food"], r["amount"], r["unit"]) for r in j["food_day"]["rows"]] == [("Water", 250, "ml")]


def test_a_past_day_asked_for_is_the_day_in_the_answer(sv, fake):
    past = day() - timedelta(days=3)
    j = shaped(sv.post("/water", view_day=past.isoformat()))
    assert j["day"]["day"] == past.isoformat() and j["day"]["past"] is True and j["day"]["rows"] == []  # saved today, shown for that day
    f = shaped(sv.post("/water", view_day=past.isoformat(), view="food"), "food")
    assert f["food_day"]["day"] == past.isoformat() and f["food_day"]["past"] is True
    junk = shaped(sv.post("/water", view_day="not a day"))  # an unreadable day is today
    assert junk["day"]["day"] == day().isoformat()


def test_the_food_routes_answer_with_the_food_day(sv, fake):
    eid = eat_on(day(), "08:10", oats(), 60)
    j = shaped(sv.post("/food/note", ref=f"f{eid}", note="tasty"), "food")
    assert j["food_day"]["rows"][0]["note"] == "tasty"
    j = shaped(sv.post("/food/entry", ref=f"f{eid}", action="save", amount=45), "food")
    assert j["food_day"]["rows"][0]["amount"] == 45
    j = shaped(sv.post("/food/note", ref=f"f{eid}", note="x", view="day"))  # view overrides the route's own
    assert "food_day" not in j


# ---- /log ---------------------------------------------------------------------------------------------------------

def test_a_typed_line_is_read_by_the_ai_and_saved(sv, fake, skyr):
    j = shaped(sv.post("/log", text=SKYR_LINE, key="door-1"))
    assert j["outcome"] == "saved" and j["head"] == "Saved." and j["receipt"] and j["replayed"] is False and j["questions"] == []
    assert any("kyr" in x for x in j["receipt"]) and any("82.4" in x for x in j["receipt"]), j["receipt"]
    u = got_undo(j)
    assert u["expires_at"] > time.strftime("%Y-%m-%dT%H:%M", time.gmtime())
    assert fake.calls == [(SKYR_LINE, "claude-haiku-5-5")]
    assert foods_eaten() == [("Skyr natural", 150.0)] and n("SELECT count(*) AS n FROM measurements WHERE value1 = 82.4") == 1
    assert owner_sql("SELECT channel FROM raw_inbox") == [{"channel": "web"}]
    rows = row_refs(j)
    assert any(r["kind"] == "food" and r["food"] == "Skyr natural" and r["amount"] == 150 for r in rows.values())
    assert any(r["kind"] == "measurement" and r["type"] == "weight" and r["v1"] == 82.4 for r in rows.values())
    assert j["day"]["water"]["ml"] == 0 and j["day"]["energy"]["totals"]["kcal"] > 0


def test_the_same_key_again_is_replayed_and_saves_nothing_twice(sv, fake, skyr):
    first = sv.post("/log", text=SKYR_LINE, key="door-2")
    again = shaped(sv.post("/log", text=SKYR_LINE, key="door-2"))
    assert again["outcome"] == "saved" and again["replayed"] is True and again["head"] == webentry._HEAD["replayed"]
    assert n("SELECT count(*) AS n FROM food_entries") == 1 and n("SELECT count(*) AS n FROM measurements") == 1
    assert n("SELECT count(*) AS n FROM raw_inbox") == 1 and len(fake.calls) == 1
    assert again["undo"] == first["undo"]  # the double tap did not take the first save's Undo away


def test_the_same_key_with_other_words_is_rejected(sv, fake, skyr):
    sv.post("/log", text=SKYR_LINE, key="door-3")
    j = shaped(sv.post("/log", text="weight 90", key="door-3"))
    assert j["outcome"] == "rejected" and "different message" in j["reason"] and j["receipt"] == []
    assert n("SELECT count(*) AS n FROM measurements") == 1 and len(fake.calls) == 1
    assert got_undo(j)  # a refusal leaves the Undo of the change just made


@pytest.mark.parametrize("words", ["", "   ", None])
def test_an_empty_line_is_rejected(sv, fake, words):
    body = {} if words is None else {"text": words}
    j = shaped(sv.post("/log", **body))
    assert j["outcome"] == "rejected" and j["reason"] == "Nothing saved: the message is empty." and j["head"] == "Nothing saved."
    assert fake.calls == [] and n("SELECT count(*) AS n FROM raw_inbox") == 0 and n("SELECT count(*) AS n FROM private.incoming") == 0


def test_an_ai_that_does_not_answer_holds_the_words(sv, fake, skyr):
    class Down:
        def json(self, *a, **k):
            raise api.ProviderError("down")

    from app import logbook
    logbook.PROVIDER = Down()
    j = shaped(sv.post("/log", text=SKYR_LINE, key="door-4"))
    assert j["outcome"] == "held" and j["head"] == "Not read yet, but kept." and j["undo"] is None
    assert j["reason"].startswith("The AI service did not answer. Your words are kept") and "Try again" in j["reason"]
    assert j["receipt"] == [] and j["questions"] == [] and j["replayed"] is False
    assert [(r["content"], r["channel"]) for r in owner_sql("SELECT content, channel FROM private.incoming")] == [(SKYR_LINE, "web")]
    assert n("SELECT count(*) AS n FROM food_entries") == 0 and n("SELECT count(*) AS n FROM raw_inbox") == 0
    kept = j["day"]["needs"]["not_read"]
    assert len(kept) == 1 and kept[0]["text"] == SKYR_LINE and kept[0]["tries"] == 1 and kept[0]["needs_you"] is False


def test_the_same_key_sent_again_while_the_words_wait_does_not_keep_them_twice(sv, fake, skyr):
    from app import logbook

    class Down:
        def json(self, *a, **k):
            raise api.ProviderError("down")

    logbook.PROVIDER = Down()
    sv.post("/log", text=SKYR_LINE, key="door-5")
    again = sv.post("/log", text=SKYR_LINE, key="door-5")
    assert again["outcome"] == "held" and n("SELECT count(*) AS n FROM private.incoming") == 1
    logbook.PROVIDER = fake  # the AI is back: the same call reads the kept words once
    done = sv.post("/log", text=SKYR_LINE, key="door-5")
    assert done["outcome"] == "saved" and done["receipt"] and got_undo(done)
    assert n("SELECT count(*) AS n FROM private.incoming") == 0 and n("SELECT count(*) AS n FROM food_entries") == 1
    assert done["day"]["needs"]["not_read"] == []


# ---- /log: private and gratitude lines -----------------------------------------------------------------------------

@pytest.mark.parametrize("line,label,words", [("g: thanks for the sample line", "gratitude", "thanks for the sample line"),
                                              ("gratitude: a sample warm evening", "gratitude", "a sample warm evening"),
                                              ("private: an invented sample note", "private", "an invented sample note")])
def test_a_private_or_gratitude_line_is_saved_without_its_words_in_the_answer(sv, fake, line, label, words):
    before = sv.post("/water")["day"]["gratitude"]["count"]  # a read of the count (and a glass of water)
    r = sv.raw("/log", text=line, key="door-6")
    assert r.status_code == 200 and words not in r.text
    j = shaped(r.json())
    assert j["outcome"] == "saved" and j["head"] == "Saved privately." and j["receipt"] == [] and j["notes"] == []
    assert j["result"] is None and j["read_back"] is None and j["reason"] is None
    assert fake.calls == [] and n("SELECT count(*) AS n FROM private.entries WHERE label = %s", label) == 1
    assert n("SELECT count(*) AS n FROM thoughts") == 0 and n("SELECT count(*) AS n FROM raw_inbox WHERE content ILIKE %s", f"%{words}%") == 0
    assert j["day"]["gratitude"]["count"] == before + (1 if label == "gratitude" else 0)
    assert words not in json.dumps(j["day"])  # nor in the fresh day (the door's reads never show them)


def test_a_private_line_sent_again_with_the_same_key_is_replayed_and_still_silent(sv, fake):
    sv.post("/log", text="g: thanks for the sample line", key="door-7")
    r = sv.raw("/log", text="g: thanks for the sample line", key="door-7")
    j = shaped(r.json())
    assert j["replayed"] is True and j["receipt"] == [] and j["notes"] == [] and "thanks for the sample" not in r.text
    assert n("SELECT count(*) AS n FROM private.entries") == 1


def test_a_private_label_without_words_is_refused_and_nothing_is_saved(sv, fake):
    r = sv.raw("/log", text="g:")
    j = shaped(r.json())
    assert j["outcome"] == "rejected" and j["receipt"] == [] and j["notes"] == []
    assert n("SELECT count(*) AS n FROM private.entries") == 0 and fake.calls == []


# ---- a look-up or change about private entries ----------------------------------------------------------------------

LOOK = "P12 [gratitude] 14.11.2026: some words"


@pytest.mark.parametrize("reply", [
    {"outcome": "answered", "result": LOOK},
    {"outcome": "answered", "receipt": [LOOK]},
    {"outcome": "saved", "receipt": ["Saved."], "notes": [LOOK]},
    {"outcome": "needs_confirmation", "read_back": "Delete " + LOOK + "?", "confirm": {"label": "Yes"}},
    {"outcome": "changed", "result": "Changed private entries: some words"},
    {"outcome": "rejected", "reason": "No entry " + LOOK},
    {"outcome": "answered", "result": "fine", "receipt": ["a P3 mention: some words"], "read_back": "also some words"},
])
def test_a_look_up_or_change_of_private_entries_never_shows_words(sv, fake, monkeypatch, reply):
    monkeypatch.setattr(api.logbook, "log", lambda *a, **k: {"questions": [], **reply})
    r = sv.raw("/log", text="what did I note on P12")
    assert r.status_code == 200 and "some words" not in r.text
    j = shaped(r.json())
    assert j["reason"] == reads.HIDDEN and j["receipt"] == [] and j["notes"] == [] and j["result"] is None and j["read_back"] is None
    assert j["outcome"] == reply["outcome"]


def test_an_ordinary_answer_with_numbers_is_not_hidden(sv, fake, monkeypatch):
    out = {"outcome": "answered", "result": "Skyr natural 150 g, Up12 and P-12 are not entries", "receipt": ["Saved: 150 g"], "questions": []}
    monkeypatch.setattr(api.logbook, "log", lambda *a, **k: out)
    j = shaped(sv.post("/log", text="what did I eat"))
    assert j["reason"] is None and j["receipt"] == ["Saved: 150 g"] and j["result"] == out["result"]


# ---- /again ---------------------------------------------------------------------------------------------------------

def test_an_again_chip_logs_the_food_once_more(sv, fake):
    oid = oats()
    eat_on(day(), "08:10", oid, 60)
    j = shaped(sv.post("/again", food_id=oid, amount=60, key="ag-1"))
    assert j["outcome"] == "saved" and j["receipt"] and got_undo(j) and fake.calls == []
    assert foods_eaten() == [("Test oats", 60.0), ("Test oats", 60.0)]
    assert n("SELECT count(*) AS n FROM food_entries WHERE abs(extract(epoch FROM eaten_at - now())) < 300") == 1  # now
    assert sum(r["kind"] == "food" for r in j["day"]["rows"]) == 2


def test_an_again_chip_with_amount_and_time(sv, fake):
    oid = oats()
    sv.post("/again", food_id=oid, amount=45, time="06:15", key="ag-2")
    (r,) = owner_sql("SELECT amount, to_char(eaten_at AT TIME ZONE 'Europe/Berlin', 'HH24:MI') AS t, time_known FROM food_entries")
    assert (float(r["amount"]), r["t"], r["time_known"]) == (45.0, "06:15", True)


def test_a_double_tap_of_an_again_chip_saves_once(sv, fake):
    oid = oats()
    first = sv.post("/again", food_id=oid, amount=60, key="ag-3")
    again = sv.post("/again", food_id=oid, amount=60, key="ag-3")
    assert again["replayed"] is True and again["head"] == webentry._HEAD["replayed"] and again["undo"] == first["undo"]
    assert n("SELECT count(*) AS n FROM food_entries") == 1


@pytest.mark.parametrize("body,why", [({"food_id": 99999, "amount": 60}, "not in the catalogue"), ({"food_id": "x", "amount": 60}, "Unknown food"),
                                      ({"amount": 60}, "Unknown food"), ({"food_id": "OATS", "amount": 0}, "amount"),
                                      ({"food_id": "OATS", "amount": "lots"}, "amount"), ({"food_id": "OATS", "amount": 6000}, "amount"),
                                      ({"food_id": "OATS"}, "amount"), ({"food_id": "OATS", "amount": 60, "time": "25:00"}, "hh:mm"),
                                      ({"food_id": "OATS", "amount": 60, "time": "9am"}, "hh:mm")])
def test_a_bad_again_is_rejected_and_saves_nothing(sv, fake, body, why):
    oid = oats()
    body = {k: (oid if v == "OATS" else v) for k, v in body.items()}
    j = shaped(sv.post("/again", **body))
    assert j["outcome"] == "rejected" and why in j["reason"] and j["undo"] is None and n("SELECT count(*) AS n FROM food_entries") == 0


# ---- /usual ---------------------------------------------------------------------------------------------------------

def test_a_usual_meal_in_one_tap_logs_every_item(sv, fake, breakfast):
    mid, _ = breakfast
    j = shaped(sv.post("/usual", meal_id=mid, key="us-1"))
    assert j["outcome"] == "saved" and got_undo(j) and fake.calls == []
    assert foods_eaten() == [("Test oats", 60.0), ("Skyr natural", 200.0), ("Test honey", 10.0)]
    assert owner_sql("SELECT content FROM raw_inbox")[0]["content"] == "my usual usual breakfast"
    assert n("SELECT count(*) AS n FROM food_entries WHERE abs(extract(epoch FROM eaten_at - now())) < 300") == 3
    assert {r["usual_meal"]["name"] for r in j["day"]["rows"] if r["kind"] == "food"} == {"usual breakfast"}
    again = sv.post("/usual", meal_id=mid, key="us-1")
    assert again["replayed"] is True and n("SELECT count(*) AS n FROM food_entries") == 3


def test_a_usual_meal_with_chosen_items_amounts_and_time(sv, fake, breakfast):
    mid, (a, b, c) = breakfast
    j = shaped(sv.post("/usual", meal_id=mid, items=[{"item_id": a, "amount": 60}, {"item_id": b, "amount": 150}], time="07:30", key="us-2"))
    assert j["outcome"] == "saved" and got_undo(j)
    assert foods_eaten() == [("Test oats", 60.0), ("Skyr natural", 150.0)]  # the honey was left out
    assert owner_sql("SELECT content FROM raw_inbox")[0]["content"] == "my usual usual breakfast (Skyr natural 150 g, no Test honey) at 07:30"
    assert {r["t"] for r in owner_sql("SELECT to_char(eaten_at AT TIME ZONE 'Europe/Berlin', 'HH24:MI') AS t FROM food_entries")} == {"07:30"}


@pytest.mark.parametrize("body,why", [({"items": []}, "Tick at least one item"), ({"items": [{"item_id": "{a}", "amount": 0}]}, "amount above 0"),
                                      ({"items": [{"item_id": "{a}", "amount": 9000}]}, "amount above 0"),
                                      ({"items": [{"item_id": "{a}", "amount": "lots"}]}, "amount above 0")])
def test_a_bad_usual_meal_is_rejected(sv, fake, breakfast, body, why):
    mid, (a, _b, _c) = breakfast
    body = json.loads(json.dumps(body).replace('"{a}"', str(a)))
    j = shaped(sv.post("/usual", meal_id=mid, **body))
    assert j["outcome"] == "rejected" and why in j["reason"] and n("SELECT count(*) AS n FROM food_entries") == 0


def test_an_unknown_usual_meal_is_rejected_and_a_bad_request_is_a_400(sv, fake, breakfast):
    assert sv.post("/usual", meal_id=99999)["reason"] == "Unknown usual meal."
    assert sv.post("/usual", meal_id="abc")["reason"] == "Unknown usual meal."
    for body in ({}, {"meal_id": 1, "items": "all"}, {"meal_id": 1, "items": [1, 2]}):
        r = sv.raw("/usual", **body)
        assert r.status_code == 400 and r.json()["error"] == "bad_request", body
    assert n("SELECT count(*) AS n FROM food_entries") == 0


# ---- /water ---------------------------------------------------------------------------------------------------------

def test_water_is_a_glass_by_default_or_the_ml_given(sv, fake):
    j = shaped(sv.post("/water", key="w-1"))
    assert j["outcome"] == "saved" and got_undo(j) and fake.calls == []
    sv.post("/water", ml=500, key="w-2")  # a second drink within 30 minutes is meant: no question
    assert foods_eaten() == [("Water", 250.0), ("Water", 500.0)]
    assert sv.post("/water", ml=50)["outcome"] == "saved"
    assert [float(r["amount"]) for r in owner_sql("SELECT amount FROM food_entries ORDER BY id")] == [250, 500, 50]
    assert owner_sql("SELECT is_drink, meal FROM food_entries LIMIT 1") == [{"is_drink": True, "meal": 0}]


def test_a_very_large_drink_is_asked_about_and_saved_on_yes(sv, fake):
    j = shaped(sv.post("/water", ml=2000))
    assert j["outcome"] == "needs_confirmation" and len(j["questions"]) == 1 and n("SELECT count(*) AS n FROM food_entries") == 0
    done = shaped(sv.post("/answer", question_id=j["questions"][0]["id"], reply="yes"))
    assert done["outcome"] == "saved" and foods_eaten() == [("Water", 2000.0)]


@pytest.mark.parametrize("ml", [10, 49, 2001, -5, 0, "x", "500", 250.5, True, [], {}])
def test_a_bad_water_amount_is_rejected(sv, fake, ml):
    j = shaped(sv.post("/water", ml=ml))
    assert j["outcome"] == "rejected" and j["reason"] == "Give the water in ml, from 50 to 2000." and j["undo"] is None
    assert n("SELECT count(*) AS n FROM food_entries") == 0 and n("SELECT count(*) AS n FROM foods") == 0


def test_a_double_tap_on_the_glass_saves_once(sv, fake):
    sv.post("/water", key="w-3")
    again = sv.post("/water", key="w-3")
    assert again["replayed"] is True and n("SELECT count(*) AS n FROM food_entries") == 1


# ---- /habit ---------------------------------------------------------------------------------------------------------

def meds():
    return n("SELECT count(*) AS n FROM events e JOIN log_types t ON t.id = e.type_id WHERE t.name = 'meds'")


def test_a_habit_tick(sv, fake):
    j = shaped(sv.post("/habit", name="meds", action="tick", key="hb-1"))
    assert j["outcome"] == "saved" and got_undo(j) and meds() == 1 and fake.calls == []
    assert owner_sql("SELECT content, channel FROM raw_inbox") == [{"content": "tick meds", "channel": "web"}]
    assert next(h for h in j["day"]["habits"] if h["name"] == "meds")["done"] >= 1
    again = sv.post("/habit", name="meds", action="tick", key="hb-1")  # a double tap
    assert again["replayed"] is True and again["undo"] == j["undo"] and meds() == 1


def test_a_second_tick_of_a_once_a_day_habit_asks_first(sv, fake):
    sv.post("/habit", name="meds", action="tick", key="hb-2")
    j = shaped(sv.post("/habit", name="meds", action="tick", key="hb-3"))
    assert j["outcome"] == "needs_confirmation" and len(j["questions"]) == 1 and "already logged" in j["read_back"] and meds() == 1
    done = shaped(sv.post("/answer", question_id=j["questions"][0]["id"], reply="yes"))
    assert done["outcome"] == "saved" and meds() == 2


def test_an_untick_by_ref_takes_that_tick_away(sv, fake):
    sv.post("/habit", name="meds", action="tick", key="hb-3")
    eid = owner_sql("SELECT id FROM events")[0]["id"]
    j = shaped(sv.post("/habit", name="meds", action="untick", ref=f"e{eid}"))
    assert j["outcome"] == "changed" and j["head"] == "Removed the Medication tick." and meds() == 0 and got_undo(j)
    again = shaped(sv.post("/habit", name="meds", action="untick", ref=f"e{eid}"))
    assert again["outcome"] == "unchanged" and again["head"] == "Nothing changed." and "no tick from today" in again["reason"]


def test_an_untick_without_a_ref_takes_todays_last_tick(sv, fake):
    first, second = [owner_sql("""INSERT INTO events (raw_id, type_id, day, event_at, time_known, extractor_version)
                                  SELECT %s, id, log_day(now()), now() - make_interval(mins => %s), true, 'test'
                                  FROM log_types WHERE name = 'meds' RETURNING id""", raw(), mins)[0]["id"] for mins in (120, 60)]
    j = sv.post("/habit", name="meds", action="untick")
    assert j["outcome"] == "changed" and [r["id"] for r in owner_sql("SELECT id FROM events")] == [first]
    sv.post("/habit", name="meds", action="untick")
    assert meds() == 0


def test_an_untick_of_a_habit_with_no_tick_is_unchanged(sv, fake):
    j = shaped(sv.post("/habit", name="meds", action="untick"))
    assert j["outcome"] == "unchanged" and "no tick from today" in j["reason"] and j["undo"] is None
    sv.post("/habit", name="meds", action="tick", key="hb-6")
    eid = owner_sql("SELECT id FROM events")[0]["id"]
    other = sv.post("/habit", name="shoonya", action="untick", ref=f"e{eid}")  # that tick is of another habit
    assert other["outcome"] == "unchanged" and meds() == 1
    owner_sql("UPDATE events SET day = day - 1")  # and only today's ticks are taken away
    assert sv.post("/habit", name="meds", action="untick", ref=f"e{eid}")["outcome"] == "unchanged"
    assert sv.post("/habit", name="meds", action="untick")["outcome"] == "unchanged" and meds() == 1


@pytest.mark.parametrize("name", ["weight", "nonsense", "night_hot_drink"])
def test_an_unknown_habit_is_rejected(sv, fake, name):
    j = shaped(sv.post("/habit", name=name, action="tick", key="hb-x"))
    assert j["outcome"] == "rejected" and j["reason"] == "That habit is not on the checklist." and n("SELECT count(*) AS n FROM raw_inbox") == 0
    assert sv.post("/habit", name=name, action="untick")["outcome"] == "rejected"


@pytest.mark.parametrize("body", [{"name": "meds", "action": "remove"}, {"name": "meds"}, {"name": "meds", "action": ""},
                                  {"name": "meds", "action": "untick", "ref": "x5"}, {"name": "meds", "action": "untick", "ref": "e"},
                                  {"action": "tick"}])
def test_a_bad_habit_request_is_a_400(sv, fake, body):
    r = sv.raw("/habit", **body)
    assert r.status_code == 400 and r.json()["error"] == "bad_request" and r.json()["v"] == 1
    assert meds() == 0


# ---- /checkin -------------------------------------------------------------------------------------------------------

def test_a_mood_check_in(sv, fake):
    j = shaped(sv.post("/checkin", type="mood", value=4, key="ci-1"))
    assert j["outcome"] == "saved" and got_undo(j) and fake.calls == []
    assert [float(r["value1"]) for r in owner_sql("""SELECT m.value1 FROM measurements m JOIN log_types t ON t.id = m.type_id
                                                      WHERE t.name = 'mood'""")] == [4.0]
    assert sv.post("/checkin", type="energy", value="2")["outcome"] == "saved"
    assert owner_sql("SELECT content FROM raw_inbox ORDER BY id") == [{"content": "mood 4"}, {"content": "energy 2"}]
    assert sv.post("/checkin", type="mood", value=5)["outcome"] == "saved"  # a second tap is meant, as on the card


@pytest.mark.parametrize("body,why", [({"type": "mood", "value": 7}, "Pick 1 to 5."), ({"type": "mood", "value": 0}, "Pick 1 to 5."),
                                      ({"type": "mood", "value": 2.5}, "Pick 1 to 5."), ({"type": "mood", "value": "x"}, "Pick 1 to 5."),
                                      ({"type": "mood"}, "Pick 1 to 5."), ({"type": "joy", "value": 3}, "Unknown check-in."),
                                      ({"value": 3}, "Unknown check-in."), ({"type": "mood", "value": 3, "day": "junk"}, "Unknown day."),
                                      ({"type": "mood", "value": 3, "day": "2020-01-01"}, "Only today or yesterday")])
def test_a_bad_check_in_is_rejected(sv, fake, body, why):
    j = shaped(sv.post("/checkin", **body))
    assert j["outcome"] == "rejected" and why in j["reason"] and n("SELECT count(*) AS n FROM measurements") == 0


def test_yesterdays_check_in(sv, fake):
    y = day() - timedelta(days=1)
    j = shaped(sv.post("/checkin", type="mood", value=3, day=y.isoformat()))
    assert j["outcome"] == "saved"
    assert owner_sql("SELECT day FROM measurements") == [{"day": y}]
    assert j["day"]["day"] == day().isoformat()  # the answer shows today: "day" is where the check-in goes, "view_day" what comes back


# ---- /health --------------------------------------------------------------------------------------------------------

def weights():
    return [float(r["value1"]) for r in owner_sql("""SELECT m.value1 FROM measurements m JOIN log_types t ON t.id = m.type_id
                                                      WHERE t.name = 'weight' ORDER BY m.id""")]


def test_a_new_weight(sv, fake):
    j = shaped(sv.post("/health", row="weight", v1=82.4, key="he-1"))
    assert j["outcome"] == "saved" and got_undo(j) and weights() == [82.4] and fake.calls == []
    card = {h["row"]: h for h in j["day"]["health"]}
    assert card["weight"]["v1"] == 82.4 and card["weight"]["ref"].startswith("m")
    assert sv.post("/health", row="sugar", v1="92")["outcome"] == "saved"


def test_a_correction_with_a_ref_changes_the_entry(sv, fake):
    service.record_weight(82.4)
    mid = owner_sql("SELECT id FROM measurements")[0]["id"]
    j = shaped(sv.post("/health", row="weight", ref=f"m{mid}", v1=82.1))
    assert j["outcome"] == "changed" and j["head"] == "Weight changed to 82.1." and got_undo(j)
    assert weights() == [82.1]  # corrected, not a second weighing
    assert {h["row"]: h for h in j["day"]["health"]}["weight"]["v1"] == 82.1
    gone = sv.post("/health", row="weight", ref="m99999", v1=80)
    assert gone["outcome"] == "rejected" and gone["reason"] == "That entry is not there any more."
    assert sv.post("/health", row="weight", ref="x1", v1=80)["reason"] == "Unknown entry."
    assert weights() == [82.1]


def test_a_blood_pressure_needs_both_numbers(sv, fake):
    j = shaped(sv.post("/health", row="bp_evening", v1=131, v2=84, key="he-2"))
    assert j["outcome"] == "saved"
    bp = owner_sql("SELECT value1, value2, period FROM measurements")[0]
    assert (float(bp["value1"]), float(bp["value2"]), bp["period"]) == (131, 84, "evening")
    only = shaped(sv.post("/health", row="bp_morning", v1=120))
    assert only["outcome"] == "rejected" and only["reason"] == "Blood pressure morning: give both numbers."
    assert n("SELECT count(*) AS n FROM measurements") == 1


def test_a_wake_up_time(sv, fake):
    j = shaped(sv.post("/health", row="wake", time="07:10", key="he-3"))
    assert j["outcome"] == "saved" and got_undo(j)
    assert owner_sql("""SELECT to_char(event_at AT TIME ZONE 'Europe/Berlin', 'HH24:MI') AS t FROM events e
                        JOIN log_types t ON t.id = e.type_id WHERE t.name = 'wake'""") == [{"t": "07:10"}]
    assert {h["row"]: h for h in j["day"]["health"]}["wake"]["ref"].startswith("e")


@pytest.mark.parametrize("body,why", [({"row": "weight"}, "give a number"), ({"row": "weight", "v1": "heavy"}, "give a number"),
                                      ({"row": "wake"}, "hh:mm"), ({"row": "wake", "time": "25:00"}, "hh:mm"), ({"row": "bed", "time": "late"}, "hh:mm"),
                                      ({"row": "pulse", "v1": 60}, "Unknown row.")])
def test_a_bad_health_value_is_rejected(sv, fake, body, why):
    j = shaped(sv.post("/health", **body))
    assert j["outcome"] == "rejected" and why in j["reason"] and n("SELECT count(*) AS n FROM measurements") == 0
    assert n("SELECT count(*) AS n FROM events") == 0


def test_a_health_request_without_a_row_is_a_400(sv, fake):
    assert sv.raw("/health", v1=80).status_code == 400


def test_an_odd_correction_is_read_back_first_and_saved_on_confirmed(sv, fake):
    service.record_weight(82.4)
    mid = owner_sql("SELECT id FROM measurements")[0]["id"]
    j = shaped(sv.post("/health", row="weight", ref=f"m{mid}", v1=400))
    assert j["outcome"] == "needs_confirmation" and j["head"] == "Nothing saved yet: please confirm."
    assert isinstance(j["read_back"], str) and "400" in j["read_back"] and "READ BACK" not in j["read_back"]
    assert j["confirm"] == {"label": "Yes, save it", "no_label": "No"} and j["undo"] is None
    assert weights() == [82.4]
    done = shaped(sv.post("/health", row="weight", ref=f"m{mid}", v1=400, confirmed=True))
    assert done["outcome"] == "changed" and done["confirm"] is None and done["read_back"] is None and weights() == [400.0]
    assert got_undo(done)


# ---- /answer --------------------------------------------------------------------------------------------------------

def ask_repeat(sv):
    """The same words twice within 30 minutes: the second one asks "log it again?" (a log_repeat question)."""
    food("Radishes", 16, 0.7, 0.1, 3.4)
    sv.post("/log", text="40 g radishes", key="an-1")
    j = shaped(sv.post("/log", text="40 g radishes", key="an-2"))
    assert j["outcome"] == "needs_confirmation" and len(j["questions"]) == 1 and j["undo"] is None  # a question replaces the Undo, as on app.
    (q,) = j["questions"]
    # the full Question (reads.question), never the chat app's wording
    assert q == j["day"]["needs"]["questions"][0] and q["text"] == "Log it again?" and "question" not in q
    assert [(a["reply"], a["style"]) for a in q["answers"]] == [("yes", "primary"), ("no", "plain")]
    assert q["refill"] == {"label": "Correct it", "text": "40 g radishes"}
    assert j["reason"] and "already logged" in j["reason"] and [x["id"] for x in j["day"]["needs"]["questions"]] == [q["id"]]
    return q["id"]


def test_a_yes_to_a_question_saves(sv, fake):
    qid = ask_repeat(sv)
    assert n("SELECT count(*) AS n FROM food_entries") == 1
    j = shaped(sv.post("/answer", question_id=qid, reply="yes"))
    assert j["outcome"] == "saved" and j["receipt"] and got_undo(j) and j["questions"] == []
    assert n("SELECT count(*) AS n FROM food_entries") == 2 and j["day"]["needs"]["questions"] == []
    again = shaped(sv.post("/answer", question_id=qid, reply="yes"))  # the question is closed
    assert again["outcome"] == "rejected" and n("SELECT count(*) AS n FROM food_entries") == 2


def test_a_no_to_a_question_drops_it(sv, fake):
    qid = ask_repeat(sv)
    j = shaped(sv.post("/answer", question_id=qid, reply="no"))
    assert j["outcome"] == "cancelled" and j["head"] == "Skipped." and n("SELECT count(*) AS n FROM food_entries") == 1
    assert j["day"]["needs"]["questions"] == []


def test_an_unclear_answer_keeps_the_question_open(sv, fake):
    qid = ask_repeat(sv)
    j = shaped(sv.post("/answer", question_id=qid, reply="hmm maybe"))
    assert j["outcome"] == "needs_confirmation" and [q["id"] for q in j["questions"]] == [qid]
    assert n("SELECT count(*) AS n FROM food_entries") == 1


@pytest.mark.parametrize("body", [{"question_id": "p1234abcd", "reply": ""}, {"question_id": "", "reply": "yes"}, {"reply": "yes"},
                                  {"question_id": "p1234abcd"}, {"question_id": "p1234abcd", "reply": "   "}])
def test_an_answer_with_nothing_typed_is_rejected(sv, fake, body):
    j = shaped(sv.post("/answer", **body))
    assert j["outcome"] == "rejected" and j["reason"] == "Type an answer first." and j["head"] == "Nothing saved."


def test_an_unknown_question_is_rejected(sv, fake):
    j = shaped(sv.post("/answer", question_id="p00000000", reply="yes"))
    assert j["outcome"] == "rejected" and j["reason"] == "There is no such open question."
    assert n("SELECT count(*) AS n FROM food_entries") == 0


# ---- /review --------------------------------------------------------------------------------------------------------

def flagged(name="Test oats"):
    eat(name, 400, 20, review=True)
    return owner_sql("SELECT id FROM food_entries ORDER BY id DESC LIMIT 1")[0]["id"]


def review_open():
    return n("SELECT count(*) AS n FROM food_entries WHERE needs_review")


def test_looks_right_clears_the_flag_of_one_item(sv, fake):
    a = flagged("Test oats")
    b = flagged("Test rice")
    before = sv.post("/water")["day"]["needs"]["review"]
    assert sorted(r["ref"] for r in before) == [f"f{a}", f"f{b}"]
    j = shaped(sv.post("/review", action="ok", ref=f"f{a}"))
    assert j["outcome"] == "changed" and j["head"] == "Kept. The flag is cleared." and got_undo(j)
    assert review_open() == 1 and [r["ref"] for r in j["day"]["needs"]["review"]] == [f"f{b}"]


def test_all_look_right_clears_every_item_shown(sv, fake):
    ids = [flagged(f"Test food {i}") for i in range(3)]
    measure = owner_sql("""INSERT INTO measurements (raw_id, type_id, day, event_at, time_known, value1, extractor_version, needs_review, review_reason)
                           SELECT %s, id, log_day(now()), now(), true, 81, 'test', true, 'odd' FROM log_types WHERE name = 'weight' RETURNING id""", raw())[0]["id"]
    shown = [r["ref"] for r in sv.post("/water")["day"]["needs"]["review"]]
    assert sorted(shown) == sorted([f"f{i}" for i in ids] + [f"m{measure}"])
    j = shaped(sv.post("/review", action="all", refs=shown))
    assert j["outcome"] == "changed" and j["head"] == "Kept 4 items. The flags are cleared." and got_undo(j)
    assert review_open() == 0 and n("SELECT count(*) AS n FROM measurements WHERE needs_review") == 0 and j["day"]["needs"]["review"] == []


def test_all_look_right_leaves_out_what_was_not_shown_and_what_is_already_clear(sv, fake):
    a, b = flagged("Test oats"), flagged("Test rice")
    j = sv.post("/review", action="all", refs=[f"f{a}", "f99999"])
    assert j["outcome"] == "changed" and j["head"] == "Kept 1 item. The flags are cleared." and review_open() == 1
    gone = shaped(sv.post("/review", action="all", refs=[f"f{a}"]))
    assert gone["outcome"] == "unchanged" and "no longer" not in gone["reason"] and "waiting for review" in gone["reason"]
    assert review_open() == 1 and b


@pytest.mark.parametrize("refs", [[], ["junk"], ["f1", "x2"], [f"f{i}" for i in range(1, 22)]])
def test_all_look_right_refuses_odd_refs(sv, fake, refs):
    flagged()
    j = shaped(sv.post("/review", action="all", refs=refs))
    assert j["outcome"] == "rejected" and j["reason"] == "Unknown item." and review_open() == 1


@pytest.mark.parametrize("body", [{"action": "delete", "ref": "f1"}, {"action": "change", "ref": "f1"}, {"action": ""}, {"ref": "f1"},
                                  {"action": "ok"}, {"action": "all"}, {"action": "all", "refs": "f1 f2"}, {"action": "all", "refs": [1, 2]}])
def test_a_bad_review_request_is_a_400(sv, fake, body):
    flagged()
    r = sv.raw("/review", **body)
    assert r.status_code == 400 and r.json()["error"] == "bad_request" and review_open() == 1


def test_looks_right_of_an_unknown_ref_is_rejected(sv, fake):
    j = shaped(sv.post("/review", action="ok", ref="zzz"))
    assert j["outcome"] == "rejected" and j["reason"] == "Unknown item."


# ---- /food/entry and /food/note -----------------------------------------------------------------------------------------

def test_a_food_entry_is_changed_at_once_with_undo(sv, fake):
    eid = eat_on(day(), "08:10", oats(), 60)
    j = shaped(sv.post("/food/entry", ref=f"f{eid}", action="save", amount=45), "food")
    assert j["outcome"] == "changed" and j["head"] == "Changed Test oats." and got_undo(j)
    assert float(entry(eid)["amount"]) == 45 and [r["amount"] for r in j["food_day"]["rows"]] == [45]
    done = sv.post("/undo", token=j["undo"]["token"], view="food")
    assert done["outcome"] == "changed" and done["head"] == "Undone." and float(entry(eid)["amount"]) == 60
    assert done["food_day"]["rows"][0]["amount"] == 60


def test_a_food_entry_time_can_be_changed(sv, fake):
    eid = eat_on(day(), "08:10", oats(), 60)
    j = sv.post("/food/entry", ref=f"f{eid}", action="save", amount=60, time="08:40")
    assert j["outcome"] == "changed" and entry(eid)["t"] == "08:40"


def test_nothing_to_change_is_unchanged(sv, fake):
    eid = eat_on(day(), "08:10", oats(), 60)
    j = shaped(sv.post("/food/entry", ref=f"f{eid}", action="save", amount=60), "food")
    assert j["outcome"] == "unchanged" and j["reason"] == "Nothing changed." and j["head"] == "Nothing changed." and j["undo"] is None


def test_deleting_a_food_entry_and_undoing_it_puts_it_back_with_the_same_id(sv, fake):
    eid = eat_on(day(), "08:10", oats(), 60)
    other = eat_on(day(), "12:10", oats(), 30)
    before = owner_sql("SELECT * FROM food_entries WHERE id = %s", eid)[0]
    j = shaped(sv.post("/food/entry", ref=f"f{eid}", action="delete", key="fe-1"), "food")
    assert j["outcome"] == "changed" and j["head"] == "Deleted Test oats." and entry(eid) is None and entry(other)
    assert [r["ref"] for r in j["food_day"]["rows"]] == [f"f{other}"]
    u = got_undo(j)
    done = shaped(sv.post("/undo", token=u["token"], view="food"), "food")
    assert done["outcome"] == "changed" and done["head"] == "Undone." and done["undo"] is None
    assert owner_sql("SELECT * FROM food_entries WHERE id = %s", eid) == [before]
    assert sorted(r["ref"] for r in done["food_day"]["rows"]) == sorted([f"f{eid}", f"f{other}"])
    again = shaped(sv.post("/undo", token=u["token"]))
    assert again["outcome"] == "rejected" and again["reason"] == "There is nothing to undo any more."
    assert n("SELECT count(*) AS n FROM food_entries") == 2


@pytest.mark.parametrize("ref,why", [("f99999", "That entry is not there any more."), ("x1", "Unknown entry."), ("f", "Unknown entry."),
                                     ("f1234567890", "Unknown entry.")])
def test_a_food_entry_that_is_not_there_is_rejected(sv, fake, ref, why):
    for act in ("save", "delete"):
        j = shaped(sv.post("/food/entry", ref=ref, action=act, amount=50), "food")
        assert j["outcome"] == "rejected" and j["reason"] == why, (ref, act)
    assert shaped(sv.post("/food/note", ref=ref, note="x"), "food")["outcome"] == "rejected"


def test_a_missing_ref_is_rejected_and_a_bad_act_is_a_400(sv, fake):
    assert sv.post("/food/entry", action="save", amount=50)["reason"] == "Unknown entry."
    eid = eat_on(day(), "08:10", oats(), 60)
    for body in ({"ref": f"f{eid}", "action": "copy"}, {"ref": f"f{eid}"}, {"ref": f"f{eid}", "action": ""}):
        r = sv.raw("/food/entry", **body)
        assert r.status_code == 400 and r.json()["error"] == "bad_request"
    assert entry(eid)


@pytest.mark.parametrize("body,why", [({"amount": 0}, "amount"), ({"amount": "lots"}, "amount"), ({"amount": 6000}, "amount"),
                                      ({"amount": 50, "time": "7pm"}, "hh:mm"), ({"amount": 50, "unit": "slice"}, "not a unit"),
                                      ({"amount": 50, "food_name": "Nothing like it"}, "No food called")])
def test_a_bad_food_entry_change_is_rejected(sv, fake, body, why):
    eid = eat_on(day(), "08:10", oats(), 60)
    j = shaped(sv.post("/food/entry", ref=f"f{eid}", action="save", **body), "food")
    assert j["outcome"] == "rejected" and why in j["reason"] and float(entry(eid)["amount"]) == 60


def test_a_note_is_set_and_cleared(sv, fake):
    eid = eat_on(day(), "08:10", oats(), 60)
    j = shaped(sv.post("/food/note", ref=f"f{eid}", note="  with  berries "), "food")
    assert j["outcome"] == "changed" and j["head"] == "Note saved." and got_undo(j)
    assert entry(eid)["note"] == "with berries" and j["food_day"]["rows"][0]["note"] == "with berries"
    gone = shaped(sv.post("/food/note", ref=f"f{eid}", note=""), "food")
    assert gone["outcome"] == "changed" and gone["head"] == "Note removed." and entry(eid)["note"] is None
    assert gone["food_day"]["rows"][0]["note"] is None
    sv.post("/food/note", ref=f"f{eid}", note="again")
    sv.post("/food/note", ref=f"f{eid}")  # no note sent at all clears it too
    assert entry(eid)["note"] is None
    sv.post("/food/note", ref=f"f{eid}", note="x" * 500)
    assert len(entry(eid)["note"]) == 300


# ---- /undo ----------------------------------------------------------------------------------------------------------

def test_an_undo_of_a_logged_line_takes_the_line_back(sv, fake, skyr):
    j = sv.post("/log", text=SKYR_LINE, key="un-1")
    done = shaped(sv.post("/undo", token=got_undo(j)["token"]))
    assert done["outcome"] == "changed" and done["head"] == "Undone." and done["undo"] is None
    assert n("SELECT count(*) AS n FROM food_entries") == 0 and n("SELECT count(*) AS n FROM measurements") == 0
    assert done["day"]["rows"] == []


def test_a_wrong_token_is_rejected_and_the_stored_undo_stays_usable(sv, fake):
    j = sv.post("/water", key="un-2")
    u = got_undo(j)
    for token in ("wrong", "", u["token"] + "x", u["token"][:-1]):
        r = shaped(sv.post("/undo", token=token))
        assert r["outcome"] == "rejected" and r["reason"] == "There is nothing to undo any more." and r["head"] == "Nothing undone."
        assert r["undo"] == u and n("SELECT count(*) AS n FROM food_entries") == 1
    assert sv.raw("/undo").json()["outcome"] == "rejected"  # no token at all
    assert sv.raw("/undo", token=None).json()["outcome"] == "rejected"
    assert sv.undo_row()["token"] == u["token"]
    done = sv.post("/undo", token=u["token"])
    assert done["outcome"] == "changed" and n("SELECT count(*) AS n FROM food_entries") == 0


def test_an_undo_with_nothing_stored_is_rejected(sv, fake):
    j = shaped(sv.post("/undo", token="anything"))
    assert j["outcome"] == "rejected" and j["reason"] == "There is nothing to undo any more." and j["undo"] is None


def test_an_old_undo_is_not_offered_or_used(sv, fake):
    j = sv.post("/water", key="un-3")
    token = got_undo(j)["token"]
    owner_sql("UPDATE web_sessions SET undo = jsonb_set(undo, '{at}', to_jsonb(%s::float8))", time.time() - webundo.MAX_AGE_S - 5)
    r = shaped(sv.post("/undo", token=token))
    assert r["outcome"] == "rejected" and r["reason"] == "There is nothing to undo any more." and r["undo"] is None
    assert n("SELECT count(*) AS n FROM food_entries") == 1
    owner_sql("UPDATE web_sessions SET undo = jsonb_set(undo, '{at}', to_jsonb(%s::float8))", time.time() - webundo.MAX_AGE_S + 60)
    assert sv.post("/undo", token=token)["outcome"] == "changed" and n("SELECT count(*) AS n FROM food_entries") == 0


def test_a_second_undo_with_the_same_token_is_rejected(sv, fake):
    u = got_undo(sv.post("/water", key="un-4"))
    assert sv.post("/undo", token=u["token"])["outcome"] == "changed"
    again = shaped(sv.post("/undo", token=u["token"]))
    assert again["outcome"] == "rejected" and again["reason"] == "There is nothing to undo any more."
    assert sv.undo_row() is None


def test_a_later_save_replaces_the_undo(sv, fake):
    first = got_undo(sv.post("/water", key="un-5"))
    second = got_undo(sv.post("/water", ml=500, key="un-6"))
    assert first["token"] != second["token"]
    assert sv.post("/undo", token=first["token"])["outcome"] == "rejected" and n("SELECT count(*) AS n FROM food_entries") == 2
    assert sv.post("/undo", token=second["token"])["outcome"] == "changed"
    assert foods_eaten() == [("Water", 250.0)]


def test_a_refused_or_replayed_save_keeps_the_undo_and_any_other_answer_replaces_it(sv, fake):
    u = got_undo(sv.post("/water", key="un-7"))
    assert sv.post("/water", ml=10)["undo"] == u  # rejected: nothing changed
    assert sv.post("/water", key="un-7")["undo"] == u  # replayed
    assert sv.raw("/habit", name="meds", action="bad").status_code == 400 and sv.undo_row()["token"] == u["token"]
    assert sv.post("/habit", name="meds", action="untick")["undo"] is None  # unchanged: as on app., the bar goes
    assert sv.undo_row() is None
    u2 = got_undo(sv.post("/water", ml=300, key="un-8"))
    assert u2["token"] != u["token"]


def test_the_undo_is_per_session(sv, fake):
    other = Door()
    u = got_undo(sv.post("/water", key="un-9"))
    j = shaped(other.post("/undo", token=u["token"]))
    assert j["outcome"] == "rejected" and j["reason"] == "There is nothing to undo any more." and j["undo"] is None
    assert n("SELECT count(*) AS n FROM food_entries") == 1
    assert sv.undo_row()["token"] == u["token"] and other.undo_row() is None  # the first session's own is untouched
    assert sv.post("/undo", token=u["token"])["outcome"] == "changed" and n("SELECT count(*) AS n FROM food_entries") == 0
    mine = got_undo(other.post("/water", ml=100, key="un-10"))
    assert sv.post("/undo", token=mine["token"])["outcome"] == "rejected"  # and the other way
    assert other.undo_row()["token"] == mine["token"] and foods_eaten() == [("Water", 100.0)]


def test_the_undo_expires_at_is_when_the_token_stops_working(sv, fake):
    from datetime import datetime
    u = got_undo(sv.post("/water"))
    ends = datetime.fromisoformat(u["expires_at"]).timestamp()
    assert abs(ends - (time.time() + webundo.MAX_AGE_S)) < 30
    assert u["expires_at"].endswith("+00:00")


# ---- failures ---------------------------------------------------------------------------------------------------------

def test_a_failure_inside_a_save_is_a_rejected_answer_not_a_500(sv, fake, monkeypatch):
    def boom(*a, **k):
        raise RuntimeError("the secret detail 123")

    monkeypatch.setattr(api.webfood, "water", boom)
    r = sv.raw("/water", key="fl-1")
    assert r.status_code == 200 and "secret detail" not in r.text
    j = shaped(r.json())
    assert j["outcome"] == "rejected" and j["reason"].startswith("Something went wrong") and "Nothing was saved" in j["reason"]
    assert j["receipt"] == [] and n("SELECT count(*) AS n FROM food_entries") == 0


@pytest.mark.parametrize("path,body,target", [("/log", {"text": "hello"}, "logbook.log"), ("/habit", {"name": "meds", "action": "tick"}, "webactions.habit"),
                                              ("/usual", {"meal_id": 1}, "webactions.usual"), ("/checkin", {"type": "mood", "value": 3}, "webactions.checkin"),
                                              ("/health", {"row": "weight", "v1": 80}, "webactions.health"),
                                              ("/answer", {"question_id": "p1", "reply": "yes"}, "logbook.answer"),
                                              ("/review", {"action": "ok", "ref": "f1"}, "webactions.review"), ("/again", {"food_id": 1, "amount": 5}, "webfood.again"),
                                              ("/food/entry", {"ref": "f1", "action": "delete"}, "webfood.entry"), ("/food/note", {"ref": "f1"}, "webfood.note")])
def test_every_save_route_turns_a_crash_into_a_rejected_answer(sv, fake, monkeypatch, path, body, target):
    mod, fn = target.split(".")
    monkeypatch.setattr(getattr(api, mod), fn, lambda *a, **k: 1 / 0)
    r = sv.raw(path, **body)
    assert r.status_code == 200
    j = r.json()
    assert j["outcome"] == "rejected" and j["reason"].startswith("Something went wrong") and ("day" in j or "food_day" in j)


def test_an_ai_error_that_escapes_is_the_ai_did_not_answer(sv, fake, monkeypatch):
    def down(*a, **k):
        raise api.ProviderError("down")

    monkeypatch.setattr(api.logbook, "log", down)
    j = shaped(sv.post("/log", text="hello"))
    assert j["outcome"] == "rejected" and j["reason"].startswith("The AI service did not answer. Nothing was saved")


def test_a_crash_while_undoing_is_a_rejected_answer_and_keeps_the_undo(sv, fake, monkeypatch):
    u = got_undo(sv.post("/water", key="fl-2"))
    with monkeypatch.context() as m:
        m.setattr(api.webundo, "apply", lambda rec: 1 / 0)
        j = shaped(sv.post("/undo", token=u["token"]))
    assert j["outcome"] == "rejected" and j["reason"].startswith("Something went wrong") and j["undo"] == u
    assert sv.post("/undo", token=u["token"])["outcome"] == "changed"


# ---- the checks ---------------------------------------------------------------------------------------------------------

SAVES = (("/log", {"text": "hello"}), ("/again", {"food_id": 1, "amount": 5}), ("/usual", {"meal_id": 1}), ("/water", {}),
         ("/habit", {"name": "meds", "action": "tick"}), ("/checkin", {"type": "mood", "value": 3}), ("/health", {"row": "weight", "v1": 80}),
         ("/answer", {"question_id": "p1", "reply": "yes"}), ("/review", {"action": "ok", "ref": "f1"}), ("/food/entry", {"ref": "f1", "action": "delete"}),
         ("/food/note", {"ref": "f1", "note": "x"}), ("/undo", {"token": "x"}))


@pytest.mark.parametrize("path,body", SAVES)
def test_signed_out_a_save_is_a_401(fake, path, body):
    c = door()
    r = c.post("/api/v1" + path, json=body)
    assert r.status_code == 401 and r.json() == {"v": 1, "error": "signed_out", "message": "Sign in first."}
    r = c.post("/api/v1" + path, json=body, headers={"Authorization": "Bearer " + "a" * 40})
    assert r.status_code == 401 and r.json()["error"] == "signed_out"
    assert n("SELECT count(*) AS n FROM raw_inbox") == 0 and n("SELECT count(*) AS n FROM food_entries") == 0


@pytest.mark.parametrize("path,body", SAVES)
def test_with_the_door_off_a_save_is_a_404(fake, monkeypatch, path, body):
    c, bearer, _ = signed_in()
    monkeypatch.setattr(api, "FRONT_TOKEN", "")
    r = c.post("/api/v1" + path, json=body, headers=bearer)
    assert r.status_code == 404 and r.json() == {"v": 1, "error": "not_found", "message": "Not found."}


@pytest.mark.parametrize("path,body", SAVES)
def test_a_wrong_service_token_is_a_404_before_the_session_is_looked_at(fake, path, body):
    _, bearer, _ = signed_in()
    r = door(token="wrong").post("/api/v1" + path, json=body, headers=bearer)
    assert r.status_code == 404


def test_a_session_of_app_cannot_save_at_the_door(web, fake):
    c, _ = web
    token = c.cookies.get(webapp.COOKIE)
    r = door().post("/api/v1/water", headers={"Authorization": "Bearer " + token}, json={})
    assert r.status_code == 401 and n("SELECT count(*) AS n FROM food_entries") == 0


def test_a_body_that_is_not_a_json_object_is_a_400(sv, fake):
    for raw_body in (b"[1, 2]", b"not json", b'"text"', b"5"):
        r = sv.c.post("/api/v1/log", headers=sv.h, content=raw_body)
        assert r.status_code == 400 and r.json()["error"] == "bad_request", raw_body
    assert sv.c.post("/api/v1/water", headers=sv.h, content=b"").status_code == 200  # no body at all is an empty one
    r = sv.c.post("/api/v1/log", headers=sv.h, content=b"x" * (api.MAX_BODY + 1))
    assert r.status_code == 413


@pytest.mark.parametrize("path,body", [("/log", {"text": {"a": 1}}), ("/log", {"text": ["x"]}), ("/log", {"text": True}), ("/water", {"key": {"a": 1}}),
                                       ("/habit", {"name": ["meds"], "action": "tick"}), ("/answer", {"question_id": 5.5, "reply": {}})])
def test_a_field_of_the_wrong_kind_is_a_400(sv, fake, path, body):
    r = sv.raw(path, **body)
    assert r.status_code == 400 and r.json()["error"] == "bad_request"
    assert n("SELECT count(*) AS n FROM raw_inbox") == 0 and n("SELECT count(*) AS n FROM food_entries") == 0


def test_the_answers_are_never_cached_and_carry_the_session_end(sv, fake):
    r = sv.raw("/water")
    assert r.headers["cache-control"] == "no-store" and r.headers["x-content-type-options"] == "nosniff" and r.headers["x-session-expires"]


# ---- the door's saves leave app.'s session alone ------------------------------------------------------------------------

def test_the_doors_saves_do_not_touch_the_web_sessions_undo_or_flash(web, fake, breakfast):
    c, _ = web
    mark = {"token": "app-undo-token", "head": "Saved.", "at": time.time(), "raw_id": 1}
    flash = {"outcome": "saved", "head": "Saved.", "receipt": ["Test line"]}
    from psycopg.types.json import Jsonb
    owner_sql("UPDATE web_sessions SET undo = %s, flash = %s WHERE front IS DISTINCT FROM %s", Jsonb(mark), Jsonb(flash), api.FRONT)
    app_row = lambda: owner_sql("SELECT token_hash, undo, flash, expires_at FROM web_sessions WHERE front IS DISTINCT FROM %s", api.FRONT)  # noqa: E731
    before = app_row()
    assert len(before) == 1 and before[0]["undo"] == mark and before[0]["flash"] == flash
    d = Door()  # signing in after the app. session: its own row
    assert n("SELECT count(*) AS n FROM web_sessions") == 2
    j = d.post("/water", key="ap-1")
    d.post("/habit", name="meds", action="tick", key="ap-2")
    d.post("/usual", meal_id=breakfast[0], key="ap-3")
    eid = owner_sql("SELECT id FROM food_entries ORDER BY id LIMIT 1")[0]["id"]
    d.post("/food/entry", ref=f"f{eid}", action="delete")
    got = d.post("/undo", token=d.undo_row()["token"])
    assert got["outcome"] == "changed" and j["outcome"] == "saved"
    d.post("/water", ml=10)
    assert d.post("/undo", token="wrong")["outcome"] == "rejected"
    after = app_row()
    assert after == before  # undo and flash exactly as they were
    assert d.undo_row() is None or d.undo_row()["token"] != "app-undo-token"
    assert c.get("/web/").status_code == 200  # and the app. page still works with its own undo bar
    assert owner_sql("SELECT undo FROM web_sessions WHERE front IS DISTINCT FROM %s", api.FRONT)[0]["undo"] == mark


def test_the_apps_undo_record_is_not_the_doors(web, fake):
    """An app. save sets that session's undo; the door's session has its own, so neither can undo the other's change."""
    c, csrf = web
    d = Door()
    u = got_undo(d.post("/water", key="ap-4"))
    assert owner_sql("SELECT undo FROM web_sessions WHERE front IS DISTINCT FROM %s", api.FRONT)[0]["undo"] is None
    r = c.post("/web/food/water", data={"csrf": csrf, "key": "ap-5"}, headers={"Origin": "https://app.example.test"})
    assert r.status_code == 303
    app_undo = owner_sql("SELECT undo FROM web_sessions WHERE front IS DISTINCT FROM %s", api.FRONT)[0]["undo"]
    assert app_undo and app_undo["token"] != u["token"]
    assert d.undo_row()["token"] == u["token"]
    assert d.post("/undo", token=app_undo["token"])["outcome"] == "rejected"

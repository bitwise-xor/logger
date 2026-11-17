"""The door's reads (reads.py through api.py, 16.11.2026): GET /api/v1/day, /food/day and /food/entry as plain JSON, and that the
hub's today_summary reads the same numbers. Private and gratitude words never come out. Every food, number and sentence is invented."""
import json
import re
from datetime import datetime, timedelta

import pytest

from app import gratitude, hubtools, todaypage
from app.rules import BERLIN
from conftest import owner_sql
from test_api_door import door, door_on, signed_in  # noqa: F401 - door_on is autouse
from test_log import fake  # noqa: F401 - fixture reused: the AI is a fake, never called for a gratitude line
from test_webfood import eat_on
from test_webtoday import day, eat, food, no_targets, raw  # noqa: F401 - no_targets: clean targets and usual meals

OFFSET = re.compile(r"T\d\d:\d\d:\d\d(\.\d+)?\+0[12]:00$")  # Berlin time, with the offset
TARGETS = "INSERT INTO food_targets (valid_from, kcal, protein, fat, carbs, water_ml) VALUES ('2020-01-01', 2000, 100, 70, 200, 2000)"
DAY_KEYS = {"day", "today", "past", "header", "needs", "energy", "water", "chips", "rows", "health", "habits", "gratitude", "gym", "home",
            "coach"}  # gym: Today's Gym card (deploy 95); home: Today's Home card (deploy 98); coach: Today's Coach card (deploy 107)


@pytest.fixture
def api():
    """GET as the signed-in front end: api("/day") -> the response."""
    c, bearer, _ = signed_in()
    return lambda path: c.get("/api/v1" + path, headers=bearer)


def today_json(api, path="/day"):
    r = api(path)
    assert r.status_code == 200 and r.json()["v"] == 1, r.text
    return r.json()["day"] if path.startswith("/day") else r.json()


def measurement(name, v1, v2=None, minutes_ago=30, review=False):
    return owner_sql("""INSERT INTO measurements (raw_id, type_id, day, event_at, time_known, value1, value2, extractor_version, needs_review, review_reason)
                        SELECT %s, id, log_day(now()), now() - make_interval(mins => %s), true, %s, %s, 'test', %s, %s
                        FROM log_types WHERE name = %s RETURNING id""", raw(), minutes_ago, v1, v2, review, "odd value" if review else None, name)[0]["id"]


def event(name, minutes_ago=30):
    return owner_sql("""INSERT INTO events (raw_id, type_id, day, event_at, time_known, extractor_version)
                        SELECT %s, id, log_day(now()), now() - make_interval(mins => %s), true, 'test' FROM log_types WHERE name = %s RETURNING id""",
                     raw(), minutes_ago, name)[0]["id"]


def pending(pid, tool, reason, payload=None):
    owner_sql("INSERT INTO pending (id, tool, payload, reason, expires_at) VALUES (%s, %s, %s, %s, now() + interval '1 day')",
              pid, tool, json.dumps(payload or {}), reason)


def entry_ids():
    return [r["id"] for r in owner_sql("SELECT id FROM food_entries ORDER BY id")]


# ---- Today: the shape ------------------------------------------------------------------------------------------

def test_an_empty_day_has_every_key(api, monkeypatch):
    monkeypatch.setattr(todaypage, "clock", lambda: datetime.now(BERLIN).replace(hour=12))  # no check-in card yet (from 17:00 without a wake-up)
    d = today_json(api)
    assert set(d) == DAY_KEYS
    assert d["day"] == d["today"] == day().isoformat() and d["past"] is False
    assert set(d["header"]) == {"wake_at", "slept_minutes", "awake_minutes", "naps", "next_sleep", "watch_wake_at"}
    assert d["header"]["naps"] == []
    assert set(d["needs"]) == {"questions", "not_read", "review", "checkin", "body_due"}
    assert d["needs"] == {"questions": [], "not_read": [], "review": [], "checkin": None, "body_due": None}
    assert set(d["energy"]) == {"totals", "targets", "meals"}
    assert d["energy"]["totals"] == {"kcal": 0, "protein": 0, "fat": 0, "carbs": 0}
    assert d["energy"]["targets"] == {"kcal": None, "protein": None, "fat": None, "carbs": None} and d["energy"]["meals"] == []
    assert d["water"] == {"ml": 0, "target_ml": None, "glass_ml": todaypage.WATER_GLASS}
    assert d["chips"] == {"again": [], "usual": []} and d["rows"] == []
    assert d["gratitude"] == {"count": 0, "goal": gratitude.DEFAULT_GOAL}
    assert [h["row"] for h in d["health"]] == ["bed", "wake", "weight", "sugar", "bp_morning", "bp_evening"]
    assert all(h["ref"] is None and h["v1"] is None and h["at"] is None for h in d["health"])
    assert all(set(h) == {"row", "label", "sub", "type", "period", "unit", "ref", "v1", "v2", "at", "last_at"} for h in d["health"])
    assert all(set(h) == {"name", "label", "done", "target", "complete", "avoid", "last_tick"} for h in d["habits"])
    json.dumps(d)  # plain JSON values only


def test_food_and_health_rows_with_refs_nutrients_and_berlin_times(api):
    eat("Test oats", 400, 20, 10, 60, 100, "now() - interval '5 hours'")
    eat("Test skyr", 100, 10, 1, 4, 150, "now() - interval '1 hour'")
    weight = measurement("weight", 82.4, minutes_ago=30)
    up = event("wake", minutes_ago=20)
    d = today_json(api)
    f1, f2 = entry_ids()
    rows = {r["ref"]: r for r in d["rows"]}
    assert set(rows) == {f"f{f1}", f"f{f2}", f"m{weight}", f"e{up}"}
    oats = rows[f"f{f1}"]
    assert oats["kind"] == "food" and oats["food"] == "Test oats" and oats["amount"] == 100 and oats["unit"] == "g"
    assert oats["nutrients"] == {"kcal": 400, "protein": 20, "fat": 10, "carbs": 60} and oats["time_known"] is True
    assert OFFSET.search(oats["at"]) and oats["usual_meal"] is None
    w = rows[f"m{weight}"]
    assert (w["kind"], w["type"], w["v1"], w["v2"], w["unit"], w["time_known"]) == ("measurement", "weight", 82.4, None, "kg", True) and OFFSET.search(w["at"])
    assert rows[f"e{up}"]["kind"] == "event" and rows[f"e{up}"]["type"] == "wake" and rows[f"e{up}"]["v1"] is None
    ats = [datetime.fromisoformat(r["at"]) for r in d["rows"]]
    assert ats == sorted(ats)  # in time order


def test_the_totals_are_the_sum_of_the_rows_and_the_meals(api):
    eat("Test oats", 400, 20, 10, 60, 100, "now() - interval '5 hours'")
    eat("Test skyr", 100, 10, 1, 4, 150, "now()")
    d = today_json(api)
    assert d["energy"]["totals"] == {"kcal": 500, "protein": 30, "fat": 11, "carbs": 64}
    foods = [r for r in d["rows"] if r["kind"] == "food"]
    for k in ("kcal", "protein", "fat", "carbs"):
        assert d["energy"]["totals"][k] == sum(r["nutrients"][k] for r in foods) == sum(m["nutrients"][k] for m in d["energy"]["meals"])
    assert [m["meal"] for m in d["energy"]["meals"]] == [1, 2] and [m["label"] for m in d["energy"]["meals"]] == ["Meal 1", "Meal 2"]


def test_targets_come_from_the_food_targets_also_before_the_first_meal(api):
    owner_sql(TARGETS)
    assert today_json(api)["energy"]["targets"] == {"kcal": 2000, "protein": 100, "fat": 70, "carbs": 200}  # nothing eaten yet
    eat("Test oats", 400, 20, 10, 60)
    d = today_json(api)["energy"]
    assert d["targets"] == {"kcal": 2000, "protein": 100, "fat": 70, "carbs": 200} and d["totals"]["kcal"] == 400


def test_water_counts_drinks_only_and_shows_the_target(api):
    owner_sql(TARGETS)
    eat("Test latte", 90, 5, drink=True, amount=250)
    eat("Test tea", 2, 0, drink=True, amount=300)
    eat("Test oats", 400, 20, amount=100)
    assert today_json(api)["water"] == {"ml": 550, "target_ml": 2000, "glass_ml": 250}


def test_the_health_card_rows_have_their_entry_and_values(api):
    weight = measurement("weight", 82.4, minutes_ago=40)
    bp = measurement("bp", 124, 81, minutes_ago=30)
    owner_sql("UPDATE measurements SET period = 'morning' WHERE id = %s", bp)
    up = event("wake", minutes_ago=50)
    card = {h["row"]: h for h in today_json(api)["health"]}
    assert card["weight"]["ref"] == f"m{weight}" and card["weight"]["v1"] == 82.4 and OFFSET.search(card["weight"]["at"]) and card["weight"]["unit"] == "kg"
    assert (card["bp_morning"]["ref"], card["bp_morning"]["v1"], card["bp_morning"]["v2"]) == (f"m{bp}", 124, 81)
    assert card["bp_evening"]["ref"] is None
    assert card["wake"]["ref"] == f"e{up}" and card["wake"]["v1"] is None and OFFSET.search(card["wake"]["at"])


def test_the_header_has_the_wake_up(api):
    event("wake", minutes_ago=90)
    h = today_json(api)["header"]
    assert OFFSET.search(h["wake_at"]) and h["next_sleep"] is False


def test_a_habit_tick_is_done_with_its_last_tick(api):
    before = {h["name"]: h for h in today_json(api)["habits"]}["meds"]
    assert before["done"] == 0 and before["last_tick"] is None
    first, second = event("meds", minutes_ago=120), event("meds", minutes_ago=10)
    after = {h["name"]: h for h in today_json(api)["habits"]}["meds"]
    assert after["done"] == 2 and after["last_tick"] == f"e{second}" and f"e{first}" != after["last_tick"]


def test_a_usual_meal_is_a_chip_with_its_items(api):
    oats, skyr = food("Test oats", 380, 13, 7, 60), food("Test skyr", 63, 11, 0.2, 4)
    mid = owner_sql("INSERT INTO usual_meals (name) VALUES ('test usual breakfast') RETURNING id")[0]["id"]
    owner_sql("INSERT INTO usual_meal_items (meal_id, food_id, grams, sort_order) VALUES (%s, %s, 60, 1), (%s, %s, 200, 2)", mid, oats, mid, skyr)
    [meal] = today_json(api)["chips"]["usual"]
    assert meal["meal_id"] == mid and meal["name"] == "test usual breakfast"
    assert [(i["food"], i["amount"], i["unit"]) for i in meal["items"]] == [("Test oats", 60, "g"), ("Test skyr", 200, "g")]
    assert meal["items"][0]["nutrients"]["kcal"] == 228  # 60 g of 380 kcal per 100 g
    assert meal["nutrients"] == {"kcal": 354, "protein": 29.8, "fat": 4.6, "carbs": 44}  # 60 g oats + 200 g skyr
    assert all(set(i) == {"item_id", "food", "amount", "unit", "nutrients"} for i in meal["items"])


def test_the_evening_checkin_is_a_card_with_its_scale(api, monkeypatch):
    monkeypatch.setattr(todaypage, "clock", lambda: datetime.now(BERLIN).replace(hour=18))
    ci = today_json(api)["needs"]["checkin"]
    assert ci["mood"] is None and ci["energy"] is None and ci["scale"]["mood"] == ["very low", "low", "okay", "good", "great"]
    assert len(ci["scale"]["energy"]) == 5


# ---- Today: what needs the owner ---------------------------------------------------------------------------------

def test_a_yes_no_question_has_answers_and_a_read_back(api):
    pending("pq1", "log_repeat", "Same message as before.\nAsk the user: log it again?", {"text": "Test weight 82.4"})
    pending("pq2", "log_confirm", "Weight 82.4 kg, today.")
    qs = {q["id"]: q for q in today_json(api)["needs"]["questions"]}
    for qid, text in (("pq1", "Log it again?"), ("pq2", "Save this?")):
        q = qs[qid]
        assert q["text"] == text and [(a["reply"], a["label"], a["style"]) for a in q["answers"]] == [("yes", "Yes", "primary"), ("no", "No", "plain")]
        assert OFFSET.search(q["asked_at"]) and OFFSET.search(q["open_until"])
    assert qs["pq1"]["read_back"] == "Same message as before." and qs["pq1"]["refill"] == {"label": "Correct it", "text": "Test weight 82.4"} and qs["pq1"]["message"] == "Test weight 82.4"
    assert qs["pq2"]["read_back"] == "Weight 82.4 kg, today." and qs["pq2"]["refill"] is None
    assert set(qs["pq1"]) == {"id", "tool", "kind", "asked_at", "open_until", "message", "text", "read_back", "answers", "free", "lookup", "refill"}


def test_a_question_with_a_free_answer_has_a_field_and_skip(api):
    pending("pq3", "command", "Which entry did you mean?")
    [q] = today_json(api)["needs"]["questions"]
    assert q["read_back"] is None and q["free"] == {"placeholder": "Your answer", "type": "text", "unit": None}
    assert q["answers"] == [{"reply": "skip", "label": "Skip", "style": "quiet"}] and q["text"] == "Which entry did you mean?"


def test_a_question_about_private_entries_never_says_what_it_is_about(api):
    pending("pq4", "command_confirm", "Change these private entries: P12 violet umbrella, P13 copper lantern.")
    pending("pq5", "log_confirm", "Delete P7 silver thimble?")
    out = api("/day")
    qs = out.json()["day"]["needs"]["questions"]
    assert len(qs) == 2 and all(q["read_back"] is None and "Open it in the app" in q["text"] for q in qs)
    for word in ("violet umbrella", "copper lantern", "silver thimble", "P12", "P7"):
        assert word not in out.text, word


def test_a_message_not_read_yet_comes_with_its_text_and_tries(api):
    owner_sql("INSERT INTO private.incoming (channel, content, tries, last_error) VALUES ('test', 'Test skyr 150 g, weight 82.4', 2, 'the reader was down')")
    [n] = today_json(api)["needs"]["not_read"]
    assert n["text"] == "Test skyr 150 g, weight 82.4" and n["tries"] == 2 and n["needs_you"] is False and n["reading"] is False
    assert OFFSET.search(n["received_at"]) and isinstance(n["id"], int)


def test_a_deleted_message_is_not_listed_as_not_read(api):
    owner_sql("INSERT INTO private.incoming (channel, content, deleted_at) VALUES ('test', 'Test gone', now())")
    assert today_json(api)["needs"]["not_read"] == []


def test_a_food_entry_to_review_is_listed(api):
    eat("Test odd bar", 900, 2, review=True, amount=40)
    [r] = today_json(api)["needs"]["review"]
    assert r["kind"] == "food" and r["ref"] == f"f{entry_ids()[0]}" and r["label"] == "Test odd bar" and r["reason"] == "odd value"
    assert r["v1"] == 40 and r["unit"] == "g" and r["thought_type"] is None and r["area"] is None and r["day"] == day().isoformat()


def test_a_measurement_to_review_has_its_type_and_values(api):
    ref = measurement("weight", 182.4, review=True)
    [r] = today_json(api)["needs"]["review"]
    assert (r["ref"], r["kind"], r["type"], r["v1"], r["unit"]) == (f"m{ref}", "measurement", "weight", 182.4, "kg")


def test_a_thought_to_review_is_named_by_its_type_and_never_by_its_words(api):
    owner_sql("""INSERT INTO thoughts (raw_id, original_text, summary, thought_type, area, needs_review, review_reason)
                 VALUES (%s, 'call the violet umbrella shop', 'violet umbrella shop call', 'task', 'personal', true, 'nothing extracted')""", raw())
    out = api("/day")
    [r] = out.json()["day"]["needs"]["review"]
    assert r["kind"] == "thought" and r["label"] is None and r["thought_type"] == "task" and r["area"] == "personal" and r["reason"] == "nothing extracted"
    assert r["ref"].startswith("t") and r["type"] is None and r["v1"] is None
    for word in ("violet", "umbrella", "shop"):
        assert word not in out.text, word


def test_gratitude_is_a_count_and_its_words_never_come_out(api, fake):
    from app import logbook
    assert logbook.log("gratitude: violet umbrella\nsilver thimble", None, channel="web")["outcome"] == "saved"
    out = api("/day")
    assert out.json()["day"]["gratitude"] == {"count": 2, "goal": 10} and fake.calls == []
    for word in ("violet", "umbrella", "silver", "thimble"):
        assert word not in out.text, word
    assert [r["kind"] for r in out.json()["day"]["rows"]] == []  # no row for a private entry either
    gratitude.save_goal(7)
    assert today_json(api)["gratitude"]["goal"] == 7


def test_a_private_line_waiting_to_be_read_is_not_shown_by_its_words(api):
    owner_sql("""INSERT INTO private.entries (channel, label, content, summary, thought_type, area, tags, event_at)
                 VALUES ('test', 'private', 'private: copper lantern', 'x', 'journal', 'personal', '{}', now())""")
    out = api("/day")
    assert "copper" not in out.text and out.json()["day"]["gratitude"]["count"] == 0


# ---- Today: which day ----------------------------------------------------------------------------------------------

def test_a_past_day_is_that_day_with_past_true(api):
    d = day()
    yesterday = d - timedelta(days=1)
    eat_on(yesterday, "08:10", food("Test oats", 400, 13, 7, 60), 60, 240)
    pending("pq6", "log_confirm", "Weight 82.4 kg, today.")
    j = today_json(api, f"/day?day={yesterday.isoformat()}")
    assert j["day"] == yesterday.isoformat() and j["today"] == d.isoformat() and j["past"] is True
    assert [r["food"] for r in j["rows"]] == ["Test oats"] and j["energy"]["totals"]["kcal"] == 240
    assert j["rows"][0]["at"].startswith(yesterday.isoformat() + "T08:10:00") and OFFSET.search(j["rows"][0]["at"])
    assert j["needs"]["questions"] == [] and j["needs"]["not_read"] == []  # what waits is for today only
    assert today_json(api)["day"] == d.isoformat()


def test_a_bad_day_is_a_bad_request(api):
    for bad in ("bad", "2026-13-40", "yesterday"):
        r = api(f"/day?day={bad}")
        assert r.status_code == 400 and r.json()["error"] == "bad_request", bad
        assert api(f"/food/day?day={bad}").status_code == 400, bad
    assert api("/day?day=").status_code == 200  # empty: today


def test_a_day_after_today_is_today(api):
    d = day()
    j = today_json(api, f"/day?day={(d + timedelta(days=5)).isoformat()}")
    assert j["day"] == d.isoformat() and j["past"] is False
    f = today_json(api, f"/food/day?day={(d + timedelta(days=5)).isoformat()}")
    assert f["food_day"]["day"] == d.isoformat() and f["food_day"]["past"] is False


# ---- the Food page's day ----------------------------------------------------------------------------------------------

def test_the_food_day_has_entries_meals_totals_and_targets(api):
    owner_sql(TARGETS)
    oats = food("Test oats", 400, 13, 7, 60)
    eid = eat_on(day(), "08:10", oats, 60, 240)
    owner_sql("UPDATE food_entries SET note = 'with a pinch of salt' WHERE id = %s", eid)
    skyr = eat_on(day(), "13:00", food("Test skyr", 63, 11, 0.2, 4), 150, 95)
    f = today_json(api, "/food/day")["food_day"]
    assert set(f) == {"day", "today", "past", "rows", "meals", "totals", "targets"}
    assert f["day"] == f["today"] == day().isoformat() and f["past"] is False
    r = f["rows"][0]
    assert r["ref"] == f"f{eid}" and r["food"] == "Test oats" and r["food_id"] == oats and r["amount"] == 60 and r["unit"] == "g"
    assert r["nutrients"] == {"kcal": 240, "protein": 10, "fat": 2, "carbs": 5} and r["note"] == "with a pinch of salt"
    assert r["at"].startswith(day().isoformat() + "T08:10:00") and r["time_known"] is True
    assert [x["ref"] for x in f["rows"]] == [f"f{eid}", f"f{skyr}"] and f["rows"][1]["note"] is None
    assert f["totals"] == {"kcal": 335, "protein": 20, "fat": 4, "carbs": 10}
    assert [m["meal"] for m in f["meals"]] == [1, 2] and f["meals"][0]["nutrients"]["kcal"] == 240
    assert f["targets"] == {"kcal": 2000, "protein": 100, "fat": 70, "carbs": 200}


def test_the_food_day_of_a_past_day_and_an_empty_day(api):
    owner_sql(TARGETS)
    yesterday = day() - timedelta(days=1)
    eat_on(yesterday, "09:00", food("Test oats", 400, 13, 7, 60), 60, 240)
    f = today_json(api, f"/food/day?day={yesterday.isoformat()}")["food_day"]
    assert f["past"] is True and f["day"] == yesterday.isoformat() and f["totals"]["kcal"] == 240 and len(f["rows"]) == 1
    empty = today_json(api, f"/food/day?day={(yesterday - timedelta(days=3)).isoformat()}")["food_day"]
    assert empty["rows"] == [] and empty["meals"] == [] and empty["totals"] == {"kcal": 0, "protein": 0, "fat": 0, "carbs": 0}
    assert empty["targets"]["kcal"] == 2000


def test_a_food_entry_has_the_basis_unit_first_then_its_own_units(api):
    oats = food("Test oats", 400, 13, 7, 60)
    owner_sql("INSERT INTO food_units (food_id, unit, grams) VALUES (%s, 'bowl', 80), (%s, 'spoon', 15)", oats, oats)
    eid = eat_on(day(), "08:10", oats, 60, 240)
    e = today_json(api, f"/food/entry?ref=f{eid}")["entry"]
    assert e["ref"] == f"f{eid}" and e["food"] == "Test oats" and e["food_id"] == oats and e["amount"] == 60 and e["unit"] == "g"
    assert e["day"] == day().isoformat() and e["time_known"] is True and e["at"].startswith(day().isoformat() + "T08:10:00") and e["note"] is None
    assert e["units"] == [{"unit": "g", "in_basis": 1}, {"unit": "spoon", "in_basis": 15}, {"unit": "bowl", "in_basis": 80}]


def test_a_drink_entry_is_in_ml(api):
    eat("Test latte", 90, 5, drink=True, amount=250)
    [eid] = entry_ids()
    e = today_json(api, f"/food/entry?ref=f{eid}")["entry"]
    assert e["unit"] == "ml" and e["amount"] == 250 and e["units"] == [{"unit": "ml", "in_basis": 1}]


@pytest.mark.parametrize("ref", ["f999999", "f0", "x1", "m1", "e1", "f", "f1x", "1", "", "f1 or 1=1", "f1234567890", "F1"])
def test_an_unknown_or_malformed_entry_is_a_404(api, ref):
    eat("Test oats", 400, 20)
    r = api("/food/entry?ref=" + ref.replace(" ", "%20"))
    assert r.status_code == 404 and r.json()["error"] == "no_entry" and r.json()["v"] == 1


def test_an_entry_call_without_a_ref_is_a_404(api):
    assert api("/food/entry").status_code == 404


def test_the_reads_need_a_session():
    c = door()
    for path in ("/day", "/food/day", "/food/entry?ref=f1"):
        assert c.get("/api/v1" + path).status_code == 401, path


# ---- the hub reads the same numbers ----------------------------------------------------------------------------------------

def test_the_hubs_summary_keeps_its_keys_and_its_food_equals_the_doors(api):
    owner_sql(TARGETS)
    eat("Test oats", 400, 20, 10, 60, 100, "now() - interval '5 hours'")
    eat("Test skyr", 100, 10, 1, 4, 150, "now()")
    s = hubtools.today_summary()
    assert sorted(s) == ["chores", "day", "food", "generated_at", "habit_history", "habits", "health", "links", "questions", "review", "water"]
    energy = today_json(api)["energy"]
    assert {k: s["food"][k] for k in ("kcal", "protein", "fat", "carbs")} == energy["totals"] == {"kcal": 500, "protein": 30, "fat": 11, "carbs": 64}
    assert s["food"]["targets"] == energy["targets"]
    assert s["day"] == day().isoformat()


def test_the_hubs_summary_and_the_door_count_the_same_water_questions_and_reviews(api):
    owner_sql(TARGETS)
    eat("Test latte", 90, 5, drink=True, amount=250)
    eat("Test odd bar", 900, 2, review=True)
    pending("pq7", "log_confirm", "Weight 82.4 kg, today.")
    owner_sql("INSERT INTO private.incoming (channel, content) VALUES ('test', 'Test unread line')")
    s, d = hubtools.today_summary(), today_json(api)
    assert s["water"] == {"ml": d["water"]["ml"], "target_ml": d["water"]["target_ml"]} == {"ml": 250, "target_ml": 2000}
    assert s["review"]["count"] == len(d["needs"]["review"]) == 1
    assert s["questions"]["count"] == len(d["needs"]["questions"]) == 1 and s["questions"]["not_read"] == len(d["needs"]["not_read"]) == 1

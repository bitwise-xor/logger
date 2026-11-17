"""The JSON door's Gym (deploy 95, 16.11.2026; step 2 of the move to logger.): GET /api/v1/gym, /gym/plan, /gym/exercises,
/gym/progress, /gym/activity and /gym/history, POST /api/v1/gym/<action> for each of gym.ACTIONS, and Today's Gym card in GET /day,
each through app.'s own function (gympage.load, workout_list, row_data, plan_day_data, progress, history, today_data;
activitypage.load; gym.ACTIONS; gym.undo through webundo). Every exercise, day and number is invented."""
from datetime import datetime, timedelta

import pytest

from app import api, gym, gympage, reads, rules
from conftest import owner_sql
from test_api_door import NOT_FOUND, door, door_on, signed_in  # noqa: F401 - door_on is autouse
from test_api_saves import KEYS, Door, got_undo, n  # noqa: F401
from test_gymprogress import session
from test_log import fake  # noqa: F401 - the AI is a fake: none of these saves may reach it
from test_webhealth import today


def ex(name, kind="weights", words=(), active=True):
    return owner_sql("INSERT INTO exercises (name, kind, words, active, sort_order) SELECT %s, %s, %s, %s, coalesce(max(sort_order), 0) + 10 "
                     "FROM exercises RETURNING id", name, kind, list(words), active)[0]["id"]


def day_of_split(name, items, active=True):
    """A day of the split with its items (exercise id, sets, reps), in this order."""
    did = owner_sql("INSERT INTO workout_days (name, sort_order, active) SELECT %s, coalesce(max(sort_order), 0) + 10, %s FROM workout_days "
                    "RETURNING id", name, active)[0]["id"]
    for i, (x, sets, reps) in enumerate(items):
        owner_sql("INSERT INTO workout_day_items (day_id, exercise_id, sets, reps, sort_order) VALUES (%s, %s, %s, %s, %s)", did, x, sets, reps, (i + 1) * 10)
    return did


# The sample file's names (front/tests/samples/gym.json); the tests use "Zz <key>"
PLAIN = {"bench": "Bench press", "press": "Shoulder press", "row": "Seated row", "squat": "Leg press", "pullup": "Pull-up", "pushup": "Push-up",
         "lunge": "Walking lunge", "bike": "Exercise bike", "curl": "Biceps curl", "flat": "flat bench", "push": "Push", "pull": "Pull",
         "legs": "Legs", "arms": "Arms"}


def weekday() -> int:
    """Today's weekday on the logging day the app uses (Monday 0 ... Sunday 6)."""
    return owner_sql("SELECT extract(isodow FROM log_day(now()))::int - 1 AS w")[0]["w"]


def past_days(wd: int) -> list:
    """How many days back each past workout is, oldest first: every third day, 19 of them, the newest on the Sunday before this week
    (or earlier). The app picks today's day of the split as the first one not done yet THIS week (Monday to yesterday), and a workout
    in this week would make that depend on the weekday the test runs on (the 17.11.2026 failures: Push done yesterday, so Pull is
    today's day). With none in this week, today's day is Push (Day 1) on every weekday."""
    return list(range(wd + 55, wd, -3))


def invented(today_workout=True, plain=False) -> dict:
    """A three-day split (Zz push, Zz pull, Zz legs) with weights, bodyweight and cardio exercises, a removed day, a retired exercise,
    an exercise never done; eight weeks of workouts (none in the current week before today: see past_days); and (today_workout) a workout started today with two exercises done, the bench
    in two rows. plain: the names of PLAIN instead. -> the ids by short name."""
    nm = (lambda k: PLAIN[k]) if plain else (lambda k: f"Zz {k}" if k not in ("pullup", "pushup", "flat") else
                                              {"pullup": "Zz pull-up", "pushup": "Zz push-up", "flat": "zz flat"}[k])
    x = {"bench": ex(nm("bench"), words=(nm("flat"),)), "press": ex(nm("press")), "row": ex(nm("row")), "squat": ex(nm("squat")),
         "pullup": ex(nm("pullup"), "bodyweight"), "pushup": ex(nm("pushup"), "bodyweight"), "lunge": ex(nm("lunge"), "bodyweight"),
         "bike": ex(nm("bike"), "cardio"), "curl": ex(nm("curl"), active=False)}
    x["push"] = day_of_split(nm("push"), [(x["bench"], 3, 8), (x["press"], 3, 10), (x["pushup"], None, None), (x["bike"], None, None)])
    x["pull"] = day_of_split(nm("pull"), [(x["row"], 3, 10), (x["pullup"], 3, 8), (x["bike"], None, None)])
    x["legs"] = day_of_split(nm("legs"), [(x["squat"], 3, 8), (x["lunge"], 3, 12), (x["bike"], None, None)])
    x["arms"] = day_of_split(nm("arms"), [(x["curl"], 3, 12)], active=False)
    plan = [("push", [(x["bench"], 3, 8, 50, None), (x["press"], 3, 10, 30, None), (x["pushup"], 3, 15, None, None), (x["bike"], None, None, None, 15)]),
            ("pull", [(x["row"], 3, 10, 40, None), (x["pullup"], 3, 5, None, None), (x["bike"], None, None, None, 20)]),
            ("legs", [(x["squat"], 3, 8, 60, None), (x["bike"], None, None, None, 25)])]
    for k, back in enumerate(past_days(weekday())):  # every third day for eight weeks, Push, Pull, Legs in turn, a little heavier each time
        name, rows = plan[k % 3]
        session(back, [(e, s, r, kg + k // 3 * 2.5 if kg else None, m and m + k % 4) for e, s, r, kg, m in rows], x[name])
    session(90, [(x["curl"], 3, 12, 10, None)], x["arms"])
    if today_workout:
        last = owner_sql("""SELECT max(s.kg) AS kg FROM workout_sets s JOIN workouts w ON w.id = s.workout_id WHERE s.exercise_id = %s
                            AND w.day < log_day(now())""", x["bench"])[0]["kg"]
        x["today"] = session(0, [(x["bench"], 3, 8, float(last) + 2.5, None), (x["bike"], None, None, None, 20), (x["bench"], 1, 6, float(last) + 5, None)],
                             x["push"])
        owner_sql("UPDATE workouts SET started_at = now() - interval '40 minutes' WHERE id = %s", x["today"])
    return x


@pytest.fixture
def sv():
    return Door()


def get(sv, path, status=200):
    r = sv.c.get("/api/v1" + path, headers=sv.h)
    assert r.status_code == status, r.text
    assert r.json()["v"] == 1
    return r.json()


def shaped(j, view):
    assert set(j) == KEYS | {view}, sorted(j)
    return j


def rows():
    return owner_sql("""SELECT s.id, x.name, s.sets, s.reps, s.kg, s.minutes FROM workout_sets s JOIN exercises x ON x.id = s.exercise_id
                        JOIN workouts w ON w.id = s.workout_id WHERE w.day = log_day(now()) ORDER BY s.id""")


def gym_ticks():
    return n("SELECT count(*) AS n FROM events e JOIN log_types t ON t.id = e.type_id WHERE t.name = 'gym'")


def by_name(rows_: list) -> dict:
    return {r["name"]: r for r in rows_}


# ---- GET /gym (the Workout tab) -----------------------------------------------------------------------------------------------------

def test_the_workout_read_is_app_s_tab_as_data(sv, fake):
    x = invented()
    j = get(sv, "/gym")
    assert set(j) == {"v", "gym", "undo"}
    g = j["gym"]
    assert g["title"] == "Day 1 · Zz push" and g["done"] == 2 and g["status"] == gympage.status(load())
    assert g["status"].startswith("started ") and g["status"].endswith(" · 2 done") and g["started_at"]
    assert g["has_split"] and g["day"] == {"day_id": x["push"], "name": "Zz push", "label": "Day 1 · Zz push"} and not g["free"]
    assert [(c["day_id"], c["label"], c["on"]) for c in g["chips"]] == [
        (x["push"], "Day 1 · Zz push", True), (x["pull"], "Day 2 · Zz pull", False), (x["legs"], "Day 3 · Zz legs", False), (None, "Free workout", False)]
    assert g["why"] == "Today’s day. Tap another day to switch." and not g["picked_by_hand"]
    # the plan's order, then the rest under "Other exercises" (the retired curl is not listed)
    assert [r["name"] for r in g["exercises"]] == ["Zz bench", "Zz press", "Zz push-up", "Zz bike"]
    assert [r["name"] for r in g["other"]] == ["Zz row", "Zz squat", "Zz pull-up", "Zz lunge"] and g["retired"] == ["Zz curl"]
    bench, press, bike = (by_name(g["exercises"])[k] for k in ("Zz bench", "Zz press", "Zz bike"))
    assert bench["done"] and [r["text"] for r in bench["logged"]] == [r["text"] for r in bench["logged"]] and len(bench["logged"]) == 2
    assert bench["logged"][0]["set_id"] and bench["logged"][0]["kg"] == bench["last"]["rows"][0]["kg"] + 2.5 and bench["up_kg"] == 5
    assert bench["text"] == ", ".join(r["text"] for r in bench["logged"]) and bench["values"] == {k: bench["logged"][-1][k] for k in gympage.VALS}
    assert bench["last_text"].startswith("Last ") and bench["plan"]["sets"] == 3 and bench["plan"]["reps"] == 8 and bench["plan"]["item_id"]
    assert not press["done"] and press["ready"] and press["values"]["kg"] == press["last"]["rows"][0]["kg"] and press["text"] == f'3 × 10 at {press["values"]["kg"]:g} kg'
    assert press["up_kg"] is None and not press["open"] and bike["done"] and bike["logged"][0]["minutes"] == 20 and bike["logged"][0]["text"] == "20 min"
    assert g["empty"] is None and g["hint"] == gympage.HINT
    assert [s["label"] for s in g["week_split"]] == ["Day 1 · Zz push", "Day 2 · Zz pull", "Day 3 · Zz legs"]
    assert g["week_split"][0]["today"] and g["week_split"][0]["exercises"] == "Zz bench, Zz press, Zz push-up, Zz bike"
    assert len(g["weeks"]["weeks"]) == 4 and all(len(w["days"]) == 7 for w in g["weeks"]["weeks"]) and g["weeks"]["weeks"][-1]["label"] == "This week"
    assert any(dd["today"] and dd["on"] for dd in g["weeks"]["weeks"][-1]["days"])
    assert g["fields"]["weights"] == [{"name": "sets", "label": "Sets", "step": 1, "min": 1, "max": 50}, {"name": "reps", "label": "Reps", "step": 1, "min": 1, "max": 500},
                                      {"name": "kg", "label": "kg", "step": 2.5, "min": 0, "max": 1000}]
    assert [f["name"] for f in g["fields"]["cardio"]] == ["minutes", "km"] and g["numbers"] == gym.NUMBERS
    assert [k["key"] for k in g["kinds"]] == ["weights", "bodyweight", "cardio"]
    # app.'s tab shows the same
    page = gympage.render_workout("c")
    assert "Day 1 · Zz push" in page and bench["last_text"] in page and f'+{bench["up_kg"]:g} kg' in page and "Other exercises (4)" in page


def load():
    from app.db import connect
    with connect() as c, c.cursor() as cur:
        return gympage.load(cur)


def test_a_new_exercise_with_plan_numbers_is_ready_and_opens(sv, fake):
    x = invented(today_workout=False)
    sv.post("/gym/pick", day_id=x["legs"])
    g = get(sv, "/gym")["gym"]
    assert g["title"] == "Day 3 · Zz legs" and g["picked_by_hand"] and g["why"].startswith("Picked by you instead of ")
    lunge = by_name(g["exercises"])["Zz lunge"]
    assert lunge["last"] is None and lunge["last_text"] == "Not done before · plan 3 × 12" and lunge["ready"] and not lunge["open"]
    assert lunge["values"] == {"sets": 3, "reps": 12, "kg": None, "minutes": None, "km": None} and lunge["text"] == "3 × 12"
    assert g["status"] == "not started: the first tick starts it" and g["started_at"] is None and g["done"] == 0


def test_no_split_and_an_empty_list(sv, fake):
    g = get(sv, "/gym")["gym"]
    assert g["title"] == "Today’s workout" and not g["has_split"] and g["chips"] == [] and g["why"] is None and g["day"] is None
    assert g["exercises"] == [] and g["other"] == [] and g["empty"] == "No exercises yet: add your first one below." and g["hint"] is None
    assert g["week_split"] == [] and g["retired"] == []
    ex("Zz first", "weights")
    r = get(sv, "/gym")["gym"]["exercises"][0]
    assert not r["ready"] and r["open"] and r["text"] == "first time: set the numbers" and r["values"] == {"sets": 3, "reps": 8, "kg": None, "minutes": None, "km": None}


# ---- GET /gym/plan and /gym/exercises ----------------------------------------------------------------------------------------------

def test_the_plan_read(sv, fake):
    x = invented()
    p = get(sv, "/gym/plan")["gym_plan"]
    assert p["how"] == gympage.HOW and p["day"]["day_id"] == x["push"] and not p["free"]
    assert [d["label"] for d in p["days"]] == ["Day 1 · Zz push", "Day 2 · Zz pull", "Day 3 · Zz legs"] and p["days"][0]["today"]
    push = p["days"][0]
    assert [(i["name"], i["sets"], i["reps"], i["text"]) for i in push["items"]] == [
        ("Zz bench", 3, 8, "Weights · plan 3 × 8"), ("Zz press", 3, 10, "Weights · plan 3 × 10"), ("Zz push-up", None, None, "Bodyweight"),
        ("Zz bike", None, None, "Machine cardio")]
    assert {e["name"] for e in push["can_add"]} == {"Zz row", "Zz squat", "Zz pull-up", "Zz lunge"}
    assert p["removed"] == [{"day_id": x["arms"], "name": "Zz arms"}] and p["limits"]["sets_max"] == 50
    assert p["week"] == gympage.plan_week(load()["split"]) and p["week"].endswith("Today: Day 1 · Zz push.")
    assert all(d["day"] < date_today() for d in p["done"])


def date_today():
    return today().isoformat()


def test_the_exercises_read(sv, fake):
    invented()
    e = get(sv, "/gym/exercises")["gym_exercises"]
    assert e["active"] == 8 and len(e["exercises"]) == 9
    by = by_name(e["exercises"])
    b = by["Zz bench"]
    assert b["words"] == ["zz flat"] and b["kind_label"] == "Weights" and b["workouts"] >= 7 and b["last_day"] == date_today()
    assert b["meta"] == f'Weights · also: zz flat · {b["workouts"]} workouts, last {today():%d.%m.}' and b["use"].endswith(f"last {today():%d.%m.}")
    assert by["Zz lunge"]["use"] == "not done yet" and by["Zz lunge"]["workouts"] == 0 and by["Zz lunge"]["last_day"] is None
    assert not by["Zz curl"]["active"] and e["limits"]["name_max"] == 60


# ---- GET /gym/progress and /gym/history ------------------------------------------------------------------------------------------------

def test_progress_of_a_weights_exercise(sv, fake):
    x = invented()
    p = get(sv, f'/gym/progress?x={x["bench"]}')["gym_progress"]
    want = gympage.progress({"x": str(x["bench"])})
    assert p["exercise"] == {"exercise_id": x["bench"], "name": "Zz bench", "kind": "weights"} and p["unit"] == "kg" and p["title"] == "top weight"
    assert p["chart"] == want["chart"] and [s["mark"] for s in p["chart"]["series"]] == ["line", "dot"] and p["chart"]["days"] == 56
    assert p["top"] == float(want["top"]) and p["top_reps"] == 6 and p["one_rep_max"] == round(want["top"] * (1 + 6 / 30))
    assert p["top_text"] == f'{p["top"]:g} kg' and p["change"].startswith("+") and " kg since " in p["change"]
    assert p["sub"] == f'Top set {p["top"]:g} kg × 6 · estimated 1-rep max ≈ {p["one_rep_max"]} kg'
    assert len(p["recent"]) == 6 and p["recent"][0]["day"] == date_today() and p["recent"][0]["rows"][0]["set_id"]
    assert [c["name"] for c in p["exercises"] if c["on"]] == ["Zz bench"] and "Zz curl" in [c["name"] for c in p["exercises"]]
    assert len(p["per_week"]["weeks"]) == 8 and p["per_week"]["top"] >= 3 and p["per_week"]["weeks"][-1]["n"] >= 1
    assert p["per_week"]["good"] == sum(w["n"] >= 2 for w in p["per_week"]["weeks"])
    page = gympage.render_progress("c", {"x": str(x["bench"])})
    assert f'{p["per_week"]["good"]} of 8 weeks with 2+' in page and p["change"] in page


def test_progress_of_bodyweight_and_cardio_and_the_fallbacks(sv, fake):
    x = invented()
    p = get(sv, f'/gym/progress?x={x["pushup"]}')["gym_progress"]
    assert p["unit"] == "reps" and p["title"] == "most reps in a set" and p["one_rep_max"] is None and p["sub"].startswith("Last session ")
    p = get(sv, f'/gym/progress?x={x["bike"]}')["gym_progress"]
    assert p["unit"] == "min" and p["top"] == 20 and p["top_text"] == "20 min"
    other = get(sv, "/gym/progress?x=999999")["gym_progress"]  # not one done: the most recently done, as app.
    assert other["exercise"]["exercise_id"] == get(sv, "/gym/progress")["gym_progress"]["exercise"]["exercise_id"]
    assert get(sv, "/gym/progress?x=abc", status=400)["message"] == "x must be an exercise's id."


def test_progress_with_nothing_logged(sv, fake):
    p = get(sv, "/gym/progress")["gym_progress"]
    assert p["exercise"] is None and p["chart"] is None and p["recent"] == [] and p["exercises"] == [] and len(p["per_week"]["weeks"]) == 8


def test_the_history_read(sv, fake):
    x = invented()
    h = get(sv, "/gym/history")["gym_history"]["workouts"]
    assert len(h) == 21 and h[0]["day"] == date_today() and h[0]["split"] == "Zz push" and h[0]["anchor"] == f'w{x["today"]}'
    assert [(e["name"], e["text"]) for e in h[0]["exercises"]][1] == ("Zz bike", "20 min") and len(h[0]["exercises"][0]["rows"]) == 2
    assert h[-1]["split"] == "Zz arms" and h[0]["when"] == gympage.history()[0]["when"] and "–" in h[0]["when"]
    owner_sql("UPDATE workouts SET split_day_id = NULL WHERE id = %s", x["today"])
    assert get(sv, "/gym/history")["gym_history"]["workouts"][0]["split"] == "Free workout"


# ---- GET /gym/activity -------------------------------------------------------------------------------------------------------------

def test_activity_without_watch_data_is_the_set_up_guide(sv, fake):
    a = get(sv, "/gym/activity")["gym_activity"]
    assert not a["has_data"] and a["tiles"] == [] and a["charts"] == [] and a["setup"]["title"] == "No watch data yet"
    assert len(a["setup"]["steps"]) == 5 and any(p["code"] for p in a["setup"]["steps"][0])
    assert "".join(p["text"] for p in a["setup"]["steps"][0]).startswith("Address https://")


def test_activity_with_watch_data(sv, fake, monkeypatch):
    from test_watch import TOKEN, payload, post
    from test_web import client
    monkeypatch.setenv("WATCH_TOKEN", TOKEN)
    x = invented(today_workout=False)
    t = datetime.now(rules.BERLIN).date()
    owner_sql("DELETE FROM workouts WHERE day = %s", t - timedelta(days=3))  # the page matches the day's first workout: this test's own, whatever day it is
    post(client("log.19hospitalroad.fyi"), payload(t - timedelta(days=3)))
    owner_sql("INSERT INTO workouts (day, started_at, split_day_id) VALUES (%s, %s, %s)", t - timedelta(days=3),
              datetime.combine(t - timedelta(days=3), datetime.min.time(), rules.BERLIN) + timedelta(hours=18, minutes=5), x["pull"])
    a = get(sv, f"/gym/activity?day={t - timedelta(days=3)}")["gym_activity"]
    assert a["has_data"] and a["setup"] is None and a["day"] == (t - timedelta(days=3)).isoformat() and a["next_day"] and a["prev_day"]
    tiles = {k["key"]: k for k in a["tiles"]}
    assert [k["key"] for k in a["tiles"]][:2] == ["step_count", "sleep"] and len(a["tiles"]) == 8
    assert tiles["step_count"]["value"] == 2000 and tiles["step_count"]["text"] == "2 000" and tiles["step_count"]["sub"] == "7-day avg 2 000"
    assert tiles["active_energy"]["text"] == "100 kcal" and tiles["sleep"]["text"] == "7 h 15 min" and tiles["flights_climbed"]["text"] == "–"
    s = a["sleep"]
    assert s["hours"] == 7.25 and s["in_bed"] == "in bed 22:15–06:45" and s["stages"][0] == {"key": "deep", "label": "Deep", "hours": 1, "text": "Deep 1 h 00 min"}
    assert s["typed"] is None and s["typed_text"] == "Nothing typed in the Logger for this night."
    w = a["workouts"][0]
    assert w["name"] == "Traditional Strength Training" and w["minutes"] == 60 and w["kcal"] == 300 and w["matches"] == "Day 2 · Zz pull"
    assert [c["id"] for c in a["charts"]] == ["steps", "sleep", "rhr"] and a["charts"][0]["chart"]["series"][0]["mark"] == "bar"
    assert a["charts"][1]["chart"]["lines"] == [[7, "w", "7 h"]] and a["charts"][0]["chart"]["start"] == (t - timedelta(days=9)).isoformat()
    later = get(sv, "/gym/activity?day=2999-01-01")["gym_activity"]
    assert later["day"] == t.isoformat() and later["label"] == "Today" and later["next_day"] is None and later["workouts"] == []
    assert get(sv, "/gym/activity?day=soon", status=400)["message"] == "day must be yyyy-mm-dd."


# ---- Today's Gym card in GET /day --------------------------------------------------------------------------------------------------

def test_todays_gym_card_in_the_day(sv, fake):
    invented()
    g = get(sv, "/day")["day"]["gym"]
    assert g["last_workout"] == date_today() and g["day_label"] == "Day 1 · Zz push" and len(g["days"]) == 14 and g["days"][-1]["today"]
    assert g["days"][-1]["on"] and g["n14"] == sum(dd["on"] for dd in g["days"]) and g["text"].startswith("Last week ")
    t = gympage.today_data()
    assert (g["this_week"], g["last_week"]) == (t["this_week"], t["last_week"]) and g["text"] in gympage.today_card()
    assert get(sv, f"/day?day={today() - timedelta(days=1)}")["day"]["gym"] is None  # a past day: no card, as app.


def test_the_card_without_workouts(sv, fake):
    g = get(sv, "/day")["day"]["gym"]
    assert g["last_workout"] is None and g["day_label"] is None and g["text"] == "Last week none yet · this week none yet"


# ---- POST /gym/tick and /gym/remove ------------------------------------------------------------------------------------------------

def test_a_tick_starts_the_workout_and_ticks_the_gym_habit_once(sv, fake):
    x = invented(today_workout=False)
    j = shaped(sv.post("/gym/tick", exercise_id=x["press"], sets=3, reps=10, kg=32.5, key="t-1"), "gym")
    assert j["outcome"] == "saved" and j["head"] == "Saved: Zz press 3 × 10 at 32.5 kg" and got_undo(j)
    assert n("SELECT count(*) AS n FROM workouts WHERE day = log_day(now())") == 1 and gym_ticks() == 1
    assert owner_sql("SELECT split_day_id FROM workouts WHERE day = log_day(now())")[0]["split_day_id"] == x["push"]
    assert by_name(j["gym"]["exercises"])["Zz press"]["done"] and j["gym"]["done"] == 1
    j = sv.post("/gym/tick", exercise_id=x["bike"], minutes=22.5, km=6.1, key="t-2")
    assert j["head"] == "Saved: Zz bike 22.5 min · 6.1 km" and gym_ticks() == 1
    press = by_name(j["gym"]["exercises"])["Zz press"]
    assert press["up_kg"] is None  # lighter than last time: no mark
    heavier = press["last"]["rows"][0]["kg"] + 2.5
    j = sv.post("/gym/tick", exercise_id=x["press"], sets=1, reps=6, kg=heavier, key="t-3")  # a second row of the same exercise
    press = by_name(j["gym"]["exercises"])["Zz press"]
    assert [r["text"] for r in press["logged"]] == ["3 × 10 at 32.5 kg", f"1 × 6 at {heavier:g} kg"] and press["up_kg"] == 2.5
    assert len(rows()) == 3 and n("SELECT count(*) AS n FROM workouts WHERE day = log_day(now())") == 1


def test_a_re_sent_key_on_a_tick_saves_once(sv, fake):
    x = invented(today_workout=False)
    a = sv.post("/gym/tick", exercise_id=x["pushup"], sets=3, reps=15, key="same-key")
    b = sv.post("/gym/tick", exercise_id=x["pushup"], sets=3, reps=15, key="same-key")
    assert b["replayed"] and b["outcome"] == "saved" and len(rows()) == 1 and gym_ticks() == 1 and b["undo"]["token"] == a["undo"]["token"]
    c = sv.post("/gym/tick", exercise_id=x["pushup"], sets=3, reps=16, key="same-key")
    assert c["outcome"] == "rejected" and c["reason"] == "This form was already used." and len(rows()) == 1


@pytest.mark.parametrize("body,why", [
    ({"sets": 51, "reps": 8, "kg": 60}, gym.NUMBERS), ({"sets": 3, "reps": 0, "kg": 60}, gym.NUMBERS), ({"sets": 3, "reps": 8, "kg": 1001}, gym.NUMBERS),
    ({"sets": 2.5, "reps": 8, "kg": 60}, gym.NUMBERS), ({"sets": 3, "reps": 8, "kg": -1}, gym.NUMBERS),
    ({"sets": 3, "reps": 8}, "Give the weight in kg."), ({"reps": 8, "kg": 60}, "Give sets and reps."),
])
def test_weights_numbers_are_checked(sv, fake, body, why):
    x = invented(today_workout=False)
    j = sv.post("/gym/tick", exercise_id=x["bench"], key="r-1", **body)
    assert j["outcome"] == "rejected" and j["reason"] == why and j["tone"] == "warning" and rows() == [] and gym_ticks() == 0


def test_cardio_needs_minutes_and_an_unknown_exercise_is_refused(sv, fake):
    x = invented(today_workout=False)
    assert sv.post("/gym/tick", exercise_id=x["bike"], km=5)["reason"] == "Give the minutes."
    assert sv.post("/gym/tick", exercise_id=x["bike"], minutes=601)["reason"] == gym.NUMBERS
    assert sv.post("/gym/tick", exercise_id=999999, sets=3, reps=8)["reason"] == "Unknown exercise."
    assert rows() == []


@pytest.mark.parametrize("body,why", [
    ({"sets": 3, "reps": 8, "kg": "60"}, "kg must be a number or null."), ({"sets": True, "reps": 8, "kg": 60}, "sets must be a number or null."),
    ({"exercise_id": "1", "sets": 3}, "exercise_id must be a number."), ({"exercise_id": None}, "exercise_id must be a number."),
])
def test_a_bad_tick_is_a_400(sv, fake, body, why):
    x = invented(today_workout=False)
    r = sv.raw("/gym/tick", **{"exercise_id": x["bench"], **body})
    assert r.status_code == 400 and r.json()["message"] == why and rows() == []


def test_remove_a_row_then_the_last_row_takes_the_workout_and_the_tick(sv, fake):
    x = invented(today_workout=False)
    sv.post("/gym/tick", exercise_id=x["press"], sets=3, reps=10, kg=30, key="a")
    sv.post("/gym/tick", exercise_id=x["press"], sets=1, reps=5, kg=35, key="b")
    first, second = rows()
    j = shaped(sv.post("/gym/remove", set_id=first["id"]), "gym")
    assert j["outcome"] == "changed" and j["head"] == "Removed: Zz press 3 × 10 at 30 kg" and got_undo(j) and [r["id"] for r in rows()] == [second["id"]]
    assert gym_ticks() == 1
    j = sv.post("/gym/remove", set_id=second["id"])
    assert rows() == [] and gym_ticks() == 0 and n("SELECT count(*) AS n FROM workouts WHERE day = log_day(now())") == 0
    assert j["gym"]["status"] == "not started: the first tick starts it"


def test_remove_all_of_an_exercise_and_a_row_that_is_not_todays(sv, fake):
    x = invented()
    old = owner_sql("SELECT s.id FROM workout_sets s JOIN workouts w ON w.id = s.workout_id WHERE w.day < log_day(now()) LIMIT 1")[0]["id"]
    j = sv.post("/gym/remove", set_id=old)
    assert j["outcome"] == "rejected" and j["reason"] == "That is not in today's workout."
    j = sv.post("/gym/remove", exercise_id=x["bench"])
    assert j["head"].startswith("Removed: Zz bench ") and [r["name"] for r in rows()] == ["Zz bike"]
    for body in ({}, {"set_id": old, "exercise_id": x["bench"]}):
        r = sv.raw("/gym/remove", **body)
        assert r.status_code == 400 and r.json()["message"] == "Send set_id (one row) or exercise_id (all of today's rows of it)."


def test_undo_of_a_tick_and_of_a_remove(sv, fake):
    x = invented(today_workout=False)
    j = sv.post("/gym/tick", exercise_id=x["row"], sets=3, reps=10, kg=40, key="u-1")
    u = sv.post("/undo", token=j["undo"]["token"], view="gym")
    assert u["outcome"] == "changed" and u["head"] == "Undone: the exercise is off today's workout." and "gym" in u
    assert rows() == [] and gym_ticks() == 0 and n("SELECT count(*) AS n FROM workouts WHERE day = log_day(now())") == 0
    sv.post("/gym/tick", exercise_id=x["row"], sets=3, reps=10, kg=40, key="u-2")
    before = (rows(), owner_sql("SELECT id FROM workouts WHERE day = log_day(now())"), gym_ticks())
    j = sv.post("/gym/remove", exercise_id=x["row"])
    assert rows() == [] and gym_ticks() == 0
    u = sv.post("/undo", token=j["undo"]["token"])
    assert u["head"] == "Undone: it is back in today's workout." and "day" in u
    assert (rows(), owner_sql("SELECT id FROM workouts WHERE day = log_day(now())"), gym_ticks()) == before  # the same ids


# ---- POST /gym/pick ----------------------------------------------------------------------------------------------------------------

def test_pick_another_day_or_free_workout(sv, fake):
    x = invented()
    j = shaped(sv.post("/gym/pick", day_id=x["pull"]), "gym")
    assert j["outcome"] == "changed" and j["head"] == "Today: Day 2 · Zz pull." and j["undo"] is None
    assert j["gym"]["title"] == "Day 2 · Zz pull" and owner_sql("SELECT split_day_id FROM workouts WHERE id = %s", x["today"])[0]["split_day_id"] == x["pull"]
    j = sv.post("/gym/pick", day_id=None)
    assert j["head"] == "Today: Free workout." and j["gym"]["free"] and j["gym"]["title"] == "Free workout" and j["gym"]["day"] is None
    assert [c["on"] for c in j["gym"]["chips"]] == [False, False, False, True] and j["gym"]["why"] == "Free workout: all your exercises."
    assert sv.post("/gym/pick", day_id=x["arms"])["reason"] == "Unknown day."  # a removed day
    r = sv.raw("/gym/pick")
    assert r.status_code == 400 and r.json()["message"] == "day_id is missing (null = Free workout)."


def test_a_save_without_undo_ends_the_one_before(sv, fake):
    x = invented(today_workout=False)
    sv.post("/gym/tick", exercise_id=x["row"], sets=3, reps=10, kg=40, key="e-1")
    j = sv.post("/gym/pick", day_id=x["legs"])
    assert j["undo"] is None and sv.undo_row() is None
    sv.post("/gym/tick", exercise_id=x["row"], sets=3, reps=10, kg=40, key="e-2")
    j = sv.post("/gym/pick", day_id=999999)  # a refusal leaves it
    assert j["outcome"] == "rejected" and j["undo"]


# ---- POST /gym/new, /rename, /active (the Exercises tab) ----------------------------------------------------------------------------

def test_a_new_exercise_from_the_workout_tab_goes_on_todays_day(sv, fake):
    x = invented()
    j = shaped(sv.post("/gym/new", name="  Zz  dip ", kind="bodyweight", words=["zz bar dip", "zz dips"], today=True), "gym")
    assert j["outcome"] == "changed" and j["head"] == "Added Zz dip (bodyweight). It is on today’s Zz push now." and j["undo"] is None
    assert "Zz dip" in [r["name"] for r in j["gym"]["exercises"]]
    assert owner_sql("SELECT words FROM exercises WHERE name = 'Zz dip'")[0]["words"] == ["zz bar dip", "zz dips"]
    j = shaped(sv.post("/gym/new", name="Zz fly", kind="weights"), "gym_exercises")
    assert j["head"] == "Added Zz fly (weights)." and "Zz fly" in [e["name"] for e in j["gym_exercises"]["exercises"]]
    assert x


def test_new_exercise_refusals_and_a_retired_one_comes_back(sv, fake):
    invented()
    assert sv.post("/gym/new", name="zz BENCH", kind="weights")["reason"] == "Zz bench is already in your list."
    assert sv.post("/gym/new", name="Zz jog", kind="running")["reason"] == "Pick weights, bodyweight or machine cardio."
    assert sv.post("/gym/new", name=" ", kind="weights")["reason"] == "Type the exercise's name."
    j = sv.post("/gym/new", name="Zz curl", kind="bodyweight")
    assert j["head"] == "Zz curl is back in your list (weights). It stays weights: it has sets logged."
    for body, why in (({"name": "x" * 61, "kind": "weights"}, "name must be 60 characters or fewer."),
                      ({"name": "Zz a", "kind": "weights", "words": ["a, b"]}, "words must be a list of up to 10 words of up to 40 characters, without commas."),
                      ({"name": "Zz a", "kind": "weights", "words": "a"}, "words must be a list of up to 10 words of up to 40 characters, without commas."),
                      ({"name": "Zz a", "kind": "weights", "today": "yes"}, "today must be true or false.")):
        r = sv.raw("/gym/new", **body)
        assert r.status_code == 400 and r.json()["message"] == why


def test_rename_retire_and_bring_back(sv, fake):
    x = invented()
    j = shaped(sv.post("/gym/rename", exercise_id=x["press"], name="Zz shoulder press"), "gym_exercises")
    assert j["head"] == "Renamed Zz press to Zz shoulder press. Its history moved with it."
    assert by_name(j["gym_exercises"]["exercises"])["Zz shoulder press"]["words"] == ["Zz press"]
    assert sv.post("/gym/rename", exercise_id=x["press"], name="Zz shoulder press")["reason"] == "It is called Zz shoulder press already."
    assert sv.post("/gym/rename", exercise_id=x["press"], name="zz row")["reason"] == "Zz row is already in your list."
    assert sv.post("/gym/rename", exercise_id=x["press"], name="Zz curl")["reason"] == "A retired exercise is called Zz curl."
    assert sv.post("/gym/rename", exercise_id=999999, name="Zz new")["reason"] == "Unknown exercise."
    j = shaped(sv.post("/gym/active", exercise_id=x["row"], on=False), "gym_exercises")
    assert j["head"] == "Retired Zz row. Its history stays." and not by_name(j["gym_exercises"]["exercises"])["Zz row"]["active"]
    assert sv.post("/gym/active", exercise_id=x["row"], on=True)["head"] == "Zz row is back in your list."
    assert sv.post("/gym/active", exercise_id=999999, on=True)["reason"] == "Unknown exercise."
    r = sv.raw("/gym/active", exercise_id=x["row"])
    assert r.status_code == 400 and r.json()["message"] == "on must be true or false."


# ---- the Plan tab's saves --------------------------------------------------------------------------------------------------------

def test_days_new_renamed_removed_and_brought_back(sv, fake):
    x = invented()
    j = shaped(sv.post("/gym/daynew", name="Zz core"), "gym_plan")
    assert j["head"] == "Added Day 4 · Zz core. Add its exercises below." and j["gym_plan"]["days"][-1]["name"] == "Zz core"
    assert sv.post("/gym/daynew", name="zz PUSH")["reason"] == "zz PUSH is already a day of your split."
    assert sv.post("/gym/daynew", name="")["reason"] == "Type the day's name, e.g. Push."
    assert sv.post("/gym/dayedit", day_id=x["legs"], name="Zz lower")["head"] == "Renamed to Zz lower."
    assert sv.post("/gym/dayedit", day_id=999999, name="Zz x")["reason"] == "Unknown day."
    j = sv.post("/gym/dayactive", day_id=x["pull"], on=False)
    assert j["head"].startswith("Removed Zz pull from your split.") and {"day_id": x["pull"], "name": "Zz pull"} in j["gym_plan"]["removed"]
    j = sv.post("/gym/dayactive", day_id=x["pull"], on=True)
    assert j["head"] == "Zz pull is back in your split." and j["gym_plan"]["days"][-1]["name"] == "Zz pull"
    assert sv.post("/gym/dayactive", day_id=999999, on=True)["reason"] == "Unknown day."
    r = sv.raw("/gym/daynew", name="x" * 41)
    assert r.status_code == 400 and r.json()["message"] == "name must be 40 characters or fewer."


def test_plan_items_added_changed_moved_and_removed_with_undo(sv, fake):
    x = invented()
    j = shaped(sv.post("/gym/itemadd", day_id=x["pull"], exercise_id=x["squat"], sets=4, reps=6), "gym_plan")
    assert j["head"] == "Added Zz squat to Zz pull." and j["undo"] is None
    pull = next(d for d in j["gym_plan"]["days"] if d["day_id"] == x["pull"])
    item = pull["items"][-1]
    assert (item["name"], item["sets"], item["reps"], item["text"]) == ("Zz squat", 4, 6, "Weights · plan 4 × 6")
    assert sv.post("/gym/itemadd", day_id=x["pull"], exercise_id=x["squat"])["reason"] == "Zz squat is already on Zz pull."
    assert sv.post("/gym/itemadd", day_id=x["pull"], exercise_id=x["press"], sets=3)["reason"] == "Give both sets and reps, or neither."
    assert sv.post("/gym/itemadd", day_id=x["pull"], exercise_id=x["press"], sets=3, reps=501)["reason"] == "Numbers only: sets 1 to 50, reps 1 to 500."
    assert sv.post("/gym/itemadd", day_id=x["pull"], exercise_id=x["curl"])["reason"] == "Pick a day and one of your exercises."  # retired
    assert sv.post("/gym/itemadd", day_id=x["arms"], exercise_id=x["press"])["reason"] == "Pick a day and one of your exercises."  # removed
    assert sv.post("/gym/itemset", item_id=item["item_id"], sets=5, reps=5)["head"] == "Zz squat: plan 5 × 5."
    assert sv.post("/gym/itemset", item_id=item["item_id"])["head"] == "Zz squat: plan without numbers."
    assert sv.post("/gym/itemset", item_id=item["item_id"], reps=5)["reason"] == "Give both sets and reps, or neither."
    assert sv.post("/gym/itemset", item_id=999999, sets=5, reps=5)["reason"] == "That is not on a day any more."
    j = sv.post("/gym/itemmove", item_id=item["item_id"], dir="up")
    assert j["head"] == "Moved Zz squat up." and [i["name"] for i in next(d for d in j["gym_plan"]["days"] if d["day_id"] == x["pull"])["items"]][-2] == "Zz squat"
    r = sv.raw("/gym/itemmove", item_id=item["item_id"], dir="left")
    assert r.status_code == 400 and r.json()["message"] == "dir must be up or down."
    before = owner_sql("SELECT * FROM workout_day_items WHERE id = %s", item["item_id"])
    j = sv.post("/gym/itemremove", item_id=item["item_id"])
    assert j["head"] == "Took Zz squat off Zz pull." and got_undo(j) and owner_sql("SELECT * FROM workout_day_items WHERE id = %s", item["item_id"]) == []
    u = sv.post("/undo", token=j["undo"]["token"], view="gym_plan")
    assert u["head"] == "Undone: Zz squat is back on Zz pull." and owner_sql("SELECT * FROM workout_day_items WHERE id = %s", item["item_id"]) == before
    assert "gym_plan" in u
    assert sv.post("/gym/itemremove", item_id=999999)["reason"] == "That is not on a day any more."


def test_a_view_in_the_body_chooses_the_read(sv, fake):
    x = invented()
    j = sv.post("/gym/rename", exercise_id=x["press"], name="Zz press two", view="gym")
    assert set(j) == KEYS | {"gym"}
    j = sv.post("/gym/tick", exercise_id=x["press"], sets=3, reps=10, kg=30, key="v-1", view="day")
    assert set(j) == KEYS | {"day"} and j["day"]["gym"]["day_label"] == "Day 1 · Zz push"


# ---- the checks --------------------------------------------------------------------------------------------------------------------

READS = ["/gym", "/gym/plan", "/gym/exercises", "/gym/progress", "/gym/history", "/gym/activity"]
NEW = [("GET", "/api/v1" + p, {}) for p in READS] + [("POST", f"/api/v1/gym/{a}", {"exercise_id": 1, "sets": 3, "reps": 8, "kg": 20, "day_id": 1, "item_id": 1, "on": True, "name": "Zz x"})
                                                      for a in gym.ACTIONS]


@pytest.mark.parametrize("method,path,body", NEW)
def test_signed_out_and_door_off(method, path, body, monkeypatch, fake):
    c, bearer, _ = signed_in()
    kw = {"json": body} if method == "POST" else {}
    r = c.request(method, path, **kw)  # no session
    assert r.status_code == 401 and r.json()["error"] == "signed_out"
    r = door(token="w" * 40).request(method, path, headers=bearer, **kw)  # a wrong service token
    assert r.status_code == 404 and r.json() == NOT_FOUND
    monkeypatch.setattr(api, "FRONT_TOKEN", "")
    r = c.request(method, path, headers=bearer, **kw)
    assert r.status_code == 404 and r.json() == NOT_FOUND
    assert n("SELECT count(*) AS n FROM exercises") == 0 and n("SELECT count(*) AS n FROM workout_days") == 0


def test_every_action_has_a_route_and_nothing_else_does(sv, fake):
    assert set(api.GYM_FORMS) == set(gym.ACTIONS)
    for path in ("/gym/finish", "/gym/seed", "/gym/undo"):
        assert sv.c.post("/api/v1" + path, headers=sv.h, json={}).status_code == 404
    assert reads  # the reads module is the door's

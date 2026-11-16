"""Sample answers of the JSON door for the new front end's page tests (front/tests/samples/, 16.11.2026, front end steps B to E).

The front end's stand-in door (front/tests/standin/door.mjs) answers with these files, so the page tests and the screenshots run
on the real door's shapes. This test builds a full invented day (meals, drinks, questions, a message not read yet, items to review,
the check-in, health values, habits, chips), reads it through the door (day.json) and makes two saves on it (save.json: a glass of
water, saved with Undo, and an odd weight correction read back first, with confirm; the stand-in answers every save in this shape),
the Food day (food.json, step E: GET /food/day of the day and the day before, GET /food/entry, a change and a note), and
- with WRITE_FRONT_SAMPLES=1: writes the answer to the sample file (then look at the diff and commit it);
- otherwise: checks that the committed sample still has the door's shape (the same keys at every level), so a change of the door
  that the stand-in does not know about fails here.
Every food, number and sentence is invented."""
import json
import os
from datetime import datetime, time, timedelta
from pathlib import Path

import pytest

from app import todaypage
from app.rules import BERLIN
from conftest import owner_sql
from test_api_door import door, door_on, signed_in  # noqa: F401 - door_on is autouse
from test_log import fake, skyr  # noqa: F401 - the AI is a fake (a save must never reach it); skyr: the food of its lines
from test_api_reads import api, pending  # noqa: F401 - api is a fixture
from test_webfood import eat_on
from test_webtoday import day, food, no_targets, raw  # noqa: F401 - no_targets: clean targets and usual meals

SAMPLES = Path(__file__).resolve().parent.parent / "front" / "tests" / "samples"
NOW = "16:10"  # the page is read at 16:10, 10 1/2 hours after the wake-up: past the check-in's 10 hours, before the next sleep's 12


def at(hm: str, back: int = 0) -> datetime:
    """hm on the logging day (back: so many days before), in Berlin."""
    return datetime.combine(day() - timedelta(days=back), time.fromisoformat(hm), BERLIN)


@pytest.fixture
def four_pm(monkeypatch):
    monkeypatch.setattr(todaypage, "clock", lambda: at(NOW))


def eat(name, per100, amount, hm, drink=False, portion=None, review=False):
    """A food entry of today; per100 = (kcal, protein, fat, carbs) per 100 g or ml, the entry's own for the amount eaten."""
    fid = food(name, *per100, drink)
    k = amount / 100
    owner_sql("""INSERT INTO food_entries (raw_id, food_id, amount, portion_text, eaten_at, time_known, day, day_rule, extractor_version,
                 kcal, protein, fat, carbs, source, needs_review, review_reason)
                 VALUES (%s, %s, %s, %s, %s, true, %s, 'wake', 'test', %s, %s, %s, %s, 'label', %s, %s)""",
              raw(), fid, amount, portion, at(hm), day(), *(round(v * k, 1) for v in per100), review, "odd value" if review else None)
    return fid


def event(name, hm, back=0):
    owner_sql("""INSERT INTO events (raw_id, type_id, day, event_at, time_known, extractor_version)
                 SELECT %s, id, %s, %s, true, 'test' FROM log_types WHERE name = %s""", raw(), day() - timedelta(days=back), at(hm, back), name)


def measure(name, hm, v1, v2=None, period=None, review=False):
    owner_sql("""INSERT INTO measurements (raw_id, type_id, day, event_at, time_known, value1, value2, period, extractor_version,
                 needs_review, review_reason)
                 SELECT %s, id, %s, %s, true, %s, %s, %s, 'test', %s, %s FROM log_types WHERE name = %s""",
              raw(), day(), at(hm), v1, v2, period, review, "odd value" if review else None, name)


def full_day():
    owner_sql("INSERT INTO food_targets (valid_from, kcal, protein, fat, carbs, water_ml) VALUES ('2020-01-01', 2100, 150, 70, 250, 3000)")
    event("bed", "22:20", back=1)  # the night before: 7 h 20 min of sleep
    event("wake", "05:40")
    measure("weight", "05:45", 82.4)
    measure("blood_sugar", "05:55", 94, period="fasted")
    measure("bp", "06:00", 118, 76, period="morning")
    measure("waist", "06:05", 88)
    measure("weight", "05:44", 182.4, review=True)  # an odd value: to review (the card shows the later 82.4)
    event("meds", "06:00")
    eat("Coffee with milk", (18, 1, 1, 1.5), 250, "05:50", drink=True, portion="1 cup")
    eat("Oats with milk and banana", (140, 6, 3, 22), 300, "06:10", portion="1 bowl")
    eat("Apple with peanut butter", (110, 3.3, 6, 12), 150, "10:30")
    eat("Water", (0, 0, 0, 0), 500, "11:00", drink=True)
    eat("Fruit bar", (400, 4, 20, 60), 40, "11:40", review=True)
    eat("Lentil soup", (117, 6.9, 3, 16), 350, "13:05")
    eat("Rye bread", (250, 7.5, 1.5, 48), 80, "13:05", portion="2 slices")
    # chips: two foods at this time of day on the two days before, and a usual meal
    skyr, banana, oats = food("Skyr", 63, 11, 0.2, 4), food("Banana", 89, 1.1, 0.3, 23), food("Oats", 380, 13, 7, 60)
    for back in (1, 2):
        eat_on(day() - timedelta(days=back), NOW, skyr, 200, 126)
        eat_on(day() - timedelta(days=back), NOW, banana, 120, 107)
    mid = owner_sql("INSERT INTO usual_meals (name) VALUES ('Usual breakfast') RETURNING id")[0]["id"]
    owner_sql("INSERT INTO usual_meal_items (meal_id, food_id, grams, sort_order) VALUES (%s, %s, 60, 1), (%s, %s, 200, 2)", mid, oats, mid, skyr)
    # what needs you
    pending("pq1", "log_confirm", "Skyr 450 g, today at breakfast.")
    pending("pq2", "command", "Which entry did you mean?")
    owner_sql("INSERT INTO private.incoming (channel, content, tries, last_error) VALUES ('test', '150 g skyr, weight 82', 2, 'the reader was down')")
    owner_sql("""INSERT INTO thoughts (raw_id, original_text, summary, thought_type, area, needs_review, review_reason)
                 VALUES (%s, 'an invented thought', 'an invented thought', 'task', 'personal', true, 'nothing extracted')""", raw())


def differences(have, want, path="day") -> list:
    """Where the sample (have) and the door's answer (want) differ in their keys. An empty list or a null on one side is no difference
    (a sample can show a list or a value the door leaves empty on another day)."""
    if isinstance(have, dict) and isinstance(want, dict):
        out = [f"{path}.{k}: not in the sample" for k in want.keys() - have.keys()]
        out += [f"{path}.{k}: no longer in the door" for k in have.keys() - want.keys()]
        for k in have.keys() & want.keys():
            out += differences(have[k], want[k], f"{path}.{k}")
        return out
    if isinstance(have, list) and isinstance(want, list):
        return differences(have[0], want[0], path + "[]") if have and want else []
    return []


def test_the_day_sample_has_the_doors_shape(api, four_pm):
    full_day()
    r = api("/day")
    assert r.status_code == 200, r.text
    answer = r.json()
    d = answer["day"]
    # the day is full: every list the front end draws has something in it
    for part in (d["rows"], d["energy"]["meals"], d["chips"]["again"], d["chips"]["usual"], d["needs"]["questions"],
                 d["needs"]["not_read"], d["needs"]["review"], d["habits"]):
        assert part, part
    assert d["needs"]["checkin"] is not None and d["header"]["awake_minutes"] and d["header"]["slept_minutes"] == 440
    path = SAMPLES / "day.json"
    if os.environ.get("WRITE_FRONT_SAMPLES") == "1":
        SAMPLES.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(answer, indent=1, ensure_ascii=False) + "\n")
        return
    sample = json.loads(path.read_text())
    gone = differences(sample, answer, "answer")
    assert not gone, "front/tests/samples/day.json no longer has the door's shape; run this test with WRITE_FRONT_SAMPLES=1:\n" + "\n".join(gone)


def test_the_save_sample_has_the_doors_shape(four_pm, fake):
    """Two answers of a save, without their day (the stand-in sends day.json's): "saved" with Undo, and "needs_confirmation"."""
    full_day()
    c, bearer, _ = signed_in()
    post = lambda path, **body: c.post("/api/v1" + path, headers=bearer, json=body)  # noqa: E731
    water = post("/water", ml=250, key="sample-water-key-0001", view="day")
    assert water.status_code == 200, water.text
    weight = next(h for h in water.json()["day"]["health"] if h["row"] == "weight")
    odd = post("/health", row="weight", ref=weight["ref"], v1="400", key="sample-health-key-0001", view="day")
    assert odd.status_code == 200, odd.text
    answers = {"saved": water.json(), "needs_confirmation": odd.json()}
    for outcome, a in answers.items():
        assert a["outcome"] == outcome and a.pop("day")["day"] == day().isoformat(), a
    assert answers["saved"]["undo"] and answers["needs_confirmation"]["confirm"] and answers["needs_confirmation"]["read_back"]
    path = SAMPLES / "save.json"
    if os.environ.get("WRITE_FRONT_SAMPLES") == "1":
        path.write_text(json.dumps(answers, indent=1, ensure_ascii=False) + "\n")
        return
    sample = json.loads(path.read_text())
    assert sample.keys() == answers.keys()
    gone = [x for k in answers for x in differences(sample[k], answers[k], f"save.{k}")]
    assert not gone, "front/tests/samples/save.json no longer has the door's shape; run this test with WRITE_FRONT_SAMPLES=1:\n" + "\n".join(gone)


def test_the_log_sample_has_the_doors_shape(fake, skyr):
    """Real answers of POST /log (step D, the logging box), without their day: a food line saved, a line that asks (the same words
    twice: "Log it again?", with Correct it), a change read back first (its question under Needs you), a look-up, a line kept
    because the AI did not answer, and a private line ("Saved privately.", nothing else). The AI is test_log's fake; every line is
    invented, and no private words are in an answer (the door never sends them)."""
    from app import logbook
    from test_api_saves import SKYR_LINE

    c, bearer, _ = signed_in()
    keys = iter(f"sample-log-key-{i:04}" for i in range(1, 99))
    post = lambda line: c.post("/api/v1/log", headers=bearer, json={"text": line, "key": next(keys), "view": "day"}).json()  # noqa: E731
    answers = {"saved": post(SKYR_LINE)}
    food("Radishes", 16, 0.7, 0.1, 3.4)
    post("40 g radishes")
    answers["question"] = post("40 g radishes")
    answers["confirm"] = post("the skyr was 120 g")
    answers["answered"] = post("what did I eat today")
    answers["private"] = post("g: an invented sample line")

    class Down:
        def json(self, *a, **k):
            from app.api import ProviderError
            raise ProviderError("down")

    logbook.PROVIDER = Down()
    answers["held"] = post("200 g invented soup")
    logbook.PROVIDER = fake
    want = {"saved": "saved", "question": "needs_confirmation", "confirm": "needs_confirmation", "answered": "answered",
            "private": "saved", "held": "held"}
    for name, a in answers.items():
        assert a["outcome"] == want[name] and a.pop("day")["day"] == day().isoformat(), (name, a)
    assert answers["question"]["questions"][0]["refill"]["label"] == "Correct it"
    assert answers["confirm"]["questions"] and answers["confirm"]["read_back"] and answers["confirm"]["confirm"] is None
    assert answers["answered"]["result"] and answers["saved"]["undo"] and answers["held"]["reason"]
    p = answers["private"]
    assert p["head"] == "Saved privately." and not (p["receipt"] or p["notes"] or p["result"] or p["read_back"] or p["reason"])
    assert "invented sample line" not in json.dumps(answers)
    path = SAMPLES / "log.json"
    if os.environ.get("WRITE_FRONT_SAMPLES") == "1":
        path.write_text(json.dumps(answers, indent=1, ensure_ascii=False) + "\n")
        return
    sample = json.loads(path.read_text())
    assert sample.keys() == answers.keys()
    gone = [x for k in answers for x in differences(sample[k], answers[k], f"log.{k}")]
    assert not gone, "front/tests/samples/log.json no longer has the door's shape; run this test with WRITE_FRONT_SAMPLES=1:\n" + "\n".join(gone)


def test_the_food_sample_has_the_doors_shape(four_pm, fake):
    """The Food day (step E): GET /food/day of the full day (a note on one entry) and of the day before, GET /food/entry of a
    food with its own unit, and two saves on it without their food_day: a change of amount and time (with Undo) and a note."""
    full_day()
    bread = owner_sql("SELECT e.id, e.food_id FROM food_entries e JOIN foods f ON f.id = e.food_id WHERE f.name = 'Rye bread'")[0]
    owner_sql("INSERT INTO food_units (food_id, unit, grams) VALUES (%s, 'slice', 40)", bread["food_id"])
    owner_sql("UPDATE food_entries SET note = 'toasted' FROM foods f WHERE f.id = food_entries.food_id AND f.name = 'Lentil soup'")
    ref = f"f{bread['id']}"
    c, bearer, _ = signed_in()
    get = lambda path: c.get("/api/v1" + path, headers=bearer)  # noqa: E731
    post = lambda path, **body: c.post("/api/v1" + path, headers=bearer, json=body)  # noqa: E731
    before = (day() - timedelta(days=1)).isoformat()
    answers = {"food_day": get("/food/day").json(), "before": get(f"/food/day?day={before}").json(), "entry": get(f"/food/entry?ref={ref}").json()}
    changed = post("/food/entry", ref=ref, action="save", amount=120, unit="g", time="13:20", view="food").json()
    note = post("/food/note", ref=ref, note="with butter", view="food", view_day=day().isoformat()).json()
    for a in (changed, note):
        assert a["outcome"] == "changed" and a.pop("food_day")["day"] == day().isoformat(), a
    answers["saves"] = {"changed": changed, "note": note}
    f, b = answers["food_day"]["food_day"], answers["before"]["food_day"]
    assert f["day"] == day().isoformat() and not f["past"] and b["day"] == before and b["past"] and b["rows"]
    assert [r["note"] for r in f["rows"] if r["food"] == "Lentil soup"] == ["toasted"] and f["meals"] and f["targets"]["kcal"] == 2100
    assert answers["entry"]["entry"]["units"] == [{"unit": "g", "in_basis": 1}, {"unit": "slice", "in_basis": 40}]
    assert changed["head"] == "Changed Rye bread." and changed["undo"] and note["head"] == "Note saved."
    path = SAMPLES / "food.json"
    if os.environ.get("WRITE_FRONT_SAMPLES") == "1":
        path.write_text(json.dumps(answers, indent=1, ensure_ascii=False) + "\n")
        return
    sample = json.loads(path.read_text())
    assert sample.keys() == answers.keys()
    gone = differences(sample, answers, "food")
    assert not gone, "front/tests/samples/food.json no longer has the door's shape; run this test with WRITE_FRONT_SAMPLES=1:\n" + "\n".join(gone)

"""Sample answers of the JSON door for the new front end's page tests (front/tests/samples/, 16.11.2026, front end steps B to E).

The front end's stand-in door (front/tests/standin/door.mjs) answers with these files, so the page tests and the screenshots run
on the real door's shapes. This test builds a full invented day (meals, drinks, questions, a message not read yet, items to review,
the check-in, health values, habits, chips), reads it through the door (day.json) and makes two saves on it (save.json: a glass of
water, saved with Undo, and an odd weight correction read back first, with confirm; the stand-in answers every save in this shape),
the Food day (food.json, step E: GET /food/day of the day and the day before, GET /food/entry, a change and a note), the usual
meals (usual.json, deploy 86: GET /usual, GET /foods, a change with Undo and a refusal), the scanner, label photo and look-up
(scan.json, deploy 89), the Health page and body measurements (health.json, deploy 91), the Habits page (habits.json, deploy 93), the
Gym (gym.json, deploy 95), Home (home.json, deploy 98; day.json has Today's Home card since then), Trends (week.json, food_trends.json,
insights.json, deploy 101), Library and Medical (catalogue.json, labs.json, deploy 104), and
- with WRITE_FRONT_SAMPLES=1: writes the answer to the sample file (then look at the diff and commit it);
- otherwise: checks that the committed sample still has the door's shape (the same keys at every level), so a change of the door
  that the stand-in does not know about fails here.
Every food, number and sentence is invented."""
import json
import os
from datetime import datetime, time, timedelta
from pathlib import Path

import pytest

from psycopg.types.json import Jsonb

from app import todaypage
from app.rules import BERLIN
from conftest import owner_sql
from test_api_door import door, door_on, signed_in  # noqa: F401 - door_on is autouse
from test_log import fake, off, skyr  # noqa: F401 - the AI is a fake (a save must never reach it); skyr: the food of its lines; off: Open Food Facts
from test_api_reads import api, pending  # noqa: F401 - api is a fixture
from test_webfood import eat_on
from test_webhabits import habit_types_as_they_were  # noqa: F401 - autouse: the habit types and settings as they were
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
    from test_api_home import invented
    invented(plain=True)  # Today's Home card (deploy 98)
    r = api("/day")
    assert r.status_code == 200, r.text
    answer = r.json()
    d = answer["day"]
    # the day is full: every list the front end draws has something in it
    for part in (d["rows"], d["energy"]["meals"], d["chips"]["again"], d["chips"]["usual"], d["needs"]["questions"],
                 d["needs"]["not_read"], d["needs"]["review"], d["habits"]):
        assert part, part
    assert d["home"] and d["home"]["waiting"]
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


def test_the_usual_sample_has_the_doors_shape(four_pm, fake):
    """The usual-meal editor (deploy 86, for step 87): GET /usual of the full day's usual meal and a drink, a food search
    (GET /foods?q=), and two answers without their list: a change saved at once with Undo, and a refusal (a name another
    usual meal has)."""
    full_day()
    milk = food("Milk", 46, 3.4, 1.5, 4.8, True)
    cocoa = owner_sql("INSERT INTO usual_meals (name, is_drink) VALUES ('Cocoa', true) RETURNING id")[0]["id"]
    owner_sql("INSERT INTO usual_meal_items (meal_id, food_id, grams, sort_order) VALUES (%s, %s, 250, 1)", cocoa, milk)
    c, bearer, _ = signed_in()
    get = lambda path: c.get("/api/v1" + path, headers=bearer).json()  # noqa: E731
    post = lambda path, **body: c.post("/api/v1" + path, headers=bearer, json=body).json()  # noqa: E731
    answers = {"usual": get("/usual"), "foods": get("/foods?q=oat")}
    bowl = next(u for u in answers["usual"]["usual"] if u["name"] == "Usual breakfast")
    rows = [{"food_id": i["food_id"], "amount": i["amount"]} for i in bowl["items"]]
    saved = post("/usual/meal", meal_id=bowl["meal_id"], action="save", name="Usual breakfast", items=[{**rows[0], "amount": 80}, rows[1]],
                 confirmed=True, key="sample-usual-key-0001")
    refused = post("/usual/meal", meal_id=bowl["meal_id"], action="save", name="Cocoa", items=rows, confirmed=True, key="sample-usual-key-0002")
    for a in (saved, refused):
        assert len(a.pop("usual")) == 2, a
    answers["saves"] = {"changed": saved, "rejected": refused}
    assert [u["name"] for u in answers["usual"]["usual"]] == ["Cocoa", "Usual breakfast"] and answers["usual"]["usual"][0]["drink"]
    assert [f["name"] for f in answers["foods"]["foods"]] == ["Oats with milk and banana", "Oats"]  # most eaten first, as the Catalogue
    assert saved["outcome"] == "changed" and saved["undo"] and refused["outcome"] == "rejected" and refused["reason"]
    path = SAMPLES / "usual.json"
    if os.environ.get("WRITE_FRONT_SAMPLES") == "1":
        path.write_text(json.dumps(answers, indent=1, ensure_ascii=False) + "\n")
        return
    sample = json.loads(path.read_text())
    assert sample.keys() == answers.keys()
    gone = differences(sample, answers, "usual")
    assert not gone, "front/tests/samples/usual.json no longer has the door's shape; run this test with WRITE_FRONT_SAMPLES=1:\n" + "\n".join(gone)


def test_the_scan_sample_has_the_doors_shape(four_pm, fake, off):
    """The scanner, label photo and look-up (deploy 89, for the page of deploy 90): a barcode in the catalogue and one that is not,
    Open Food Facts' values and a code it does not know, two label photos read (the AI a fake) and an unreadable one, the checked
    values added and logged (with Undo, without the day), a refusal of a photo, and a look-up read back (its question in full)
    and its yes through /answer. Every food, barcode and number is invented."""
    from app import logbook
    from test_api_scan import JPEG, PNG, Vision
    from test_log import OAT

    full_day()
    oats = owner_sql("SELECT id FROM foods WHERE name = 'Oats'")[0]["id"]
    owner_sql("UPDATE foods SET barcode = '4006040123456' WHERE id = %s", oats)
    off.products["4012345678901"] = {"product_name": "Oat drink", "brands": "Samplemarke", "quantity": "1 l",
                                     "nutriments": {"energy-kcal_100g": 46, "proteins_100g": 1, "fat_100g": 1.5,
                                                    "carbohydrates_100g": 6.6, "sugars_100g": 4, "salt_100g": 0.1}}
    off.products[OAT["code"]] = OAT
    c, bearer, _ = signed_in()
    get = lambda path: c.get("/api/v1" + path, headers=bearer).json()  # noqa: E731
    post = lambda path, **body: c.post("/api/v1" + path, headers=bearer, json=body).json()  # noqa: E731
    answers = {"barcode": get("/foods/barcode?code=4006040123456"), "barcode_none": get("/foods/barcode?code=4000000000000"),
               "off": get("/foods/off?code=4012345678901"), "off_none": get("/foods/off?code=4000000000000")}
    vision = Vision()
    logbook.PROVIDER = vision
    try:
        answers["label"] = c.post("/api/v1/food/label", headers=bearer, files=[("photo", JPEG), ("photo", PNG)]).json()
        vision.answer = {**{k: None for k in vision.answer}, "readable": False, "basis": "g", "note": "The table is cut off."}
        answers["label_unreadable"] = c.post("/api/v1/food/label", headers=bearer, files=[("photo", JPEG)]).json()
        answers["label_refused"] = c.post("/api/v1/food/label", headers=bearer, files=[("photo", ("a.pdf", b"%PDF", "application/pdf"))]).json()
    finally:
        logbook.PROVIDER = fake
    assert vision.calls[0] == ["image/jpeg", "image/png"]
    added = post("/food/labeladd", name="Crunchy granola (Samplemarke)", basis="g", kcal=452, protein=9.5, fat=17.8, carbs=61.2,
                 sat_fat=3.1, sugar_total=19, fibre=6.4, salt_g=0.3, barcode="4006040999999", source="label", amount=45, time="08:30",
                 key="sample-label-key-0001")
    found = post("/lookup", text=OAT["code"])
    yes = post("/answer", question_id=found["questions"][0]["id"], reply="yes")
    for a in (added, found, yes):
        assert a.pop("day")["day"] == day().isoformat(), a
    answers["saves"] = {"labeladd": added, "lookup": found, "answer": yes}
    assert answers["barcode"]["food"]["name"] == "Oats" and answers["barcode_none"]["food"] is None
    assert answers["off"]["ok"] and not answers["off_none"]["ok"] and answers["label"]["ok"] and not answers["label_unreadable"]["ok"]
    assert answers["label_refused"]["error"] == "bad_request"
    assert added["outcome"] == "saved" and added["undo"] and found["outcome"] == "needs_confirmation" and yes["outcome"] == "saved"
    path = SAMPLES / "scan.json"
    if os.environ.get("WRITE_FRONT_SAMPLES") == "1":
        path.write_text(json.dumps(answers, indent=1, ensure_ascii=False) + "\n")
        return
    sample = json.loads(path.read_text())
    assert sample.keys() == answers.keys()
    gone = differences(sample, answers, "scan")
    assert not gone, "front/tests/samples/scan.json no longer has the door's shape; run this test with WRITE_FRONT_SAMPLES=1:\n" + "\n".join(gone)


def month() -> None:
    """30 invented days of health values: weighings, blood pressure mornings and some evenings, fasted sugar, nights, a nap, a
    wake-up without a bed time, check-ins; and three tape-measure sessions with a height."""
    def put(kind, d, hm, v1, v2=None, period=None):
        owner_sql("""INSERT INTO measurements (raw_id, type_id, day, event_at, time_known, value1, value2, period, extractor_version)
                     SELECT %s, id, %s, %s, true, %s, %s, %s, 'test' FROM log_types WHERE name = %s""",
                  raw(), d, datetime.combine(d, time.fromisoformat(hm), BERLIN), v1, v2, period, kind)

    def ev(kind, d, hm):
        owner_sql("""INSERT INTO events (raw_id, type_id, day, event_at, time_known, extractor_version)
                     SELECT %s, id, log_day(%s), %s, true, 'test' FROM log_types WHERE name = %s""",
                  raw(), *(datetime.combine(d, time.fromisoformat(hm), BERLIN),) * 2, kind)

    t = day()
    for i in range(36):
        d = t - timedelta(days=i)
        if i % 4 != 3:
            put("weight", d, "07:00", round(81.6 - i * 0.04 + (i % 3) * 0.2, 1))
        if i >= 30:
            continue
        if i % 2 == 0:
            put("bp", d, "07:05", 118 + i % 7, 77 + i % 4, "morning")
        if i % 5 == 1:
            put("bp", d, "21:10", 124 + i % 6, 80 + i % 3, "evening")
        if i % 3 == 0:
            put("blood_sugar", d, "07:10", 88 + i % 9, None, "fasted")
        if i % 2 == 1:
            put("mood", d, "21:00", 2 + i % 4)
            put("energy", d, "21:01", 1 + (i + 1) % 5)
        if i % 7 != 4:
            ev("bed", d - timedelta(days=1), f"{22 + i % 2}:{(i * 7) % 60:02d}")
            ev("wake", d, f"0{6 + i % 2}:{(i * 11) % 60:02d}")
        else:
            ev("wake", d, "06:20")  # no bed time: a tick
        if i == 9:
            ev("bed", d, "14:10")
            ev("nap", d, "14:45")
    for back, vals in ((60, dict(waist=94.0, hips=103.0, chest=99.0, upper_arm=33.0, thigh=58.0)),
                       (32, dict(waist=93.0, hips=102.5, chest=99.0, thigh=57.5)), (4, dict(waist=92.0, hips=102.0, chest=98.5))):
        for k, v in vals.items():
            put(k, t - timedelta(days=back), "07:30", v)
    owner_sql("INSERT INTO body_height (valid_from, height_cm) VALUES ('2020-01-01', 178)")


def test_the_health_sample_has_the_doors_shape(four_pm, fake):
    """The Health page and body measurements (deploy 91, for the page of deploy 92): GET /health of 30 days with every chart and the
    sleep times filled, a day's row saved (with Undo) and an odd value read back, a delete asked first, GET /body, a body session
    saved, a jump read back, Today's due line (needs.body_due) and "Not today". Answers of saves without their fresh read."""
    month()
    c, bearer, _ = signed_in()
    get = lambda path: c.get("/api/v1" + path, headers=bearer).json()  # noqa: E731
    post = lambda path, **body: c.post("/api/v1" + path, headers=bearer, json=body).json()  # noqa: E731
    t = day()
    answers = {"health": get("/health?range=30")}
    h = answers["health"]["health"]
    assert all(any(s["pts"] for s in ch["chart"]["series"]) for ch in h["charts"]), "every chart filled"
    times = h["times"]["rows"]
    assert any(b["nap"] for r in times for b in r["bands"]) and any(r["ticks"] for r in times) and any(r["bands"] for r in times)
    y = t - timedelta(days=1)
    saved = post("/health/day", day=y.isoformat(), values={"weight": 81.2, "bp_morning": [121, 79], "sugar": 91, "mood": 3},
                 key="sample-healthday-key-0001", range=30)
    odd = post("/health/day", day=y.isoformat(), values={"weight": 400}, range=30)
    delete = post("/health/day", day=y.isoformat(), values={"sugar": None}, range=30)
    answers["body"] = get("/body")
    body_saved = post("/body", day=t.isoformat(), values={"waist": 91.8, "hips": 101.5}, key="sample-body-key-0001")
    jump = post("/body", day=t.isoformat(), values={"thigh": 52.5})
    for a in (saved, odd, delete):
        assert a.pop("health")["range"] == 30, a
    for a in (body_saved, jump):
        assert a.pop("body")["day"] == t.isoformat(), a
    answers["saves"] = {"health_day": saved, "health_day_read_back": odd, "health_day_delete": delete, "body": body_saved, "body_read_back": jump}
    assert saved["outcome"] == "saved" and saved["undo"] and odd["outcome"] == "needs_confirmation" and odd["confirm"]
    assert delete["outcome"] == "needs_confirmation" and delete["read_back"].startswith("Delete on")
    assert body_saved["outcome"] == "saved" and body_saved["undo"] and jump["outcome"] == "needs_confirmation" and "4 cm" not in jump["head"]
    b = answers["body"]["body"]
    assert b["table"] and b["charts"] and b["waist_height"]["ratio"] and b["weight_rate"] and b["form"][0]["last_cm"] == 92.0
    # Today's due line: without the sessions of the last 30 days, the last one is 32 days ago (due after 28), then "Not today"
    owner_sql("DELETE FROM measurements WHERE day > %s AND type_id IN (SELECT id FROM log_types WHERE name IN ('waist', 'hips', 'chest'))",
              t - timedelta(days=30))
    answers["day_body_due"] = get("/day")["day"]["needs"]["body_due"]
    skip = post("/body/skip")
    assert skip.pop("day")["needs"]["body_due"] is None
    answers["saves"]["body_skip"] = skip
    assert answers["day_body_due"] == {"last": (t - timedelta(days=32)).isoformat(), "days": 32}
    path = SAMPLES / "health.json"
    if os.environ.get("WRITE_FRONT_SAMPLES") == "1":
        path.write_text(json.dumps(answers, indent=1, ensure_ascii=False) + "\n")
        return
    sample = json.loads(path.read_text())
    assert sample.keys() == answers.keys()
    gone = differences(sample, answers, "health")
    assert not gone, "front/tests/samples/health.json no longer has the door's shape; run this test with WRITE_FRONT_SAMPLES=1:\n" + "\n".join(gone)


def habits_month() -> None:
    """Five invented habits with 30 days of ticks: stretching (once a day, mostly done), reading (twice a day, some days partly),
    a soft drink (a habit to avoid, a few days logged), cold showers (not tracked) and piano (retired, ticked long ago)."""
    for name, label, group, target, track, active, order in (
            ("sample_stretching", "Stretching", "practice", 1, True, True, 801), ("sample_reading", "Reading", "learning", 2, True, True, 802),
            ("sample_soft_drink", "Soft drink", "behaviour", 1, True, True, 803), ("sample_cold_shower", "Cold shower", "practice", 1, False, True, 804),
            ("sample_piano", "Piano", "learning", 1, False, False, 805)):
        owner_sql("""INSERT INTO log_types (name, label, kind, category, aliases, on_checklist, daily_target, active, sort_order)
                     VALUES (%s, %s, 'event', %s, %s, %s, %s, %s, %s)""", name, label, group, [label.lower()], track, target, active, order)
    owner_sql("INSERT INTO ui_settings (key, value) VALUES ('habit_aim', %s)", Jsonb({"avoid": ["sample_soft_drink"]}))
    for i in range(30):
        if i % 4 != 3:
            event("sample_stretching", "07:30", back=i)
        if i % 3 != 2:
            event("sample_reading", "21:00", back=i)
        if i % 3 == 0:
            event("sample_reading", "22:00", back=i)
        if i in (2, 3, 11, 20):
            event("sample_soft_drink", "15:00", back=i)
    for i in (33, 40):
        event("sample_cold_shower", "07:00", back=i)
    event("sample_piano", "18:00", back=90)


def test_the_habits_sample_has_the_doors_shape(four_pm, fake):
    """The Habits page (deploy 93, for the page of deploy 94): GET /habits tracked and all, a past day ticked and unticked, a refusal
    of a day, track, edit, new, retire, bring back, delete and a refusal of a duplicate label. Answers of saves without their fresh read."""
    habits_month()
    c, bearer, _ = signed_in()
    get = lambda path: c.get("/api/v1" + path, headers=bearer).json()  # noqa: E731
    post = lambda path, **body: c.post("/api/v1" + path, headers=bearer, json=body).json()  # noqa: E731
    t = day()
    answers = {"habits": get("/habits"), "habits_all": get("/habits?show=all")}
    h = answers["habits_all"]["habits"]
    by = {x["name"]: x for g in h["list"] for x in g["habits"]}
    assert {by[k]["state"] for k in ("sample_stretching", "sample_cold_shower", "sample_piano")} == {"tracked", "untracked", "retired"}
    assert {s["state"] for cal in h["calendar"] for s in cal["days"]} == {"done", "partly", "logged", "none"}
    assert any(cal["avoid"] for cal in h["calendar"]) and any(cal["target"] == 2 for cal in h["calendar"])
    gap = t - timedelta(days=3)  # a day stretching was not done (i % 4 == 3)
    saves = {"day": post("/habit/day", name="sample_stretching", day=gap.isoformat(), key="sample-habitday-key-0001"),
             "day_off": post("/habit/day", name="sample_stretching", day=gap.isoformat(), key="sample-habitday-key-0002"),
             "day_refused": post("/habit/day", name="sample_stretching", day=(t - timedelta(days=36)).isoformat(), key="sample-habitday-key-0003"),
             "track": post("/habits/manage", action="track", name="sample_cold_shower", on=True, show="all"),
             "edit": post("/habits/manage", action="edit", name="sample_reading", label="Reading", target=3, order=802, aim="do", show="all"),
             "new": post("/habits/manage", action="new", label="Evening walk", group="practice", target=1, track=True, show="all"),
             "retire": post("/habits/manage", action="retire", name="sample_cold_shower", show="all"),
             "restore": post("/habits/manage", action="restore", name="sample_cold_shower", show="all"),
             "delete": post("/habits/manage", action="delete", name="evening_walk", confirmed=True, show="all"),
             "refused": post("/habits/manage", action="new", label="stretching", group="practice")}
    for a in saves.values():
        assert a.pop("habits")["show"] in ("tracked", "all"), a
    assert saves["day"]["outcome"] == "saved" and saves["day"]["undo"] and saves["day_off"]["outcome"] == "changed" and saves["day_off"]["undo"]
    assert saves["day_refused"]["outcome"] == "rejected" and saves["refused"]["outcome"] == "rejected"
    assert all(saves[k]["outcome"] == "changed" and saves[k]["undo"] is None for k in ("track", "edit", "new", "retire", "restore", "delete"))
    answers["saves"] = saves
    path = SAMPLES / "habits.json"
    if os.environ.get("WRITE_FRONT_SAMPLES") == "1":
        path.write_text(json.dumps(answers, indent=1, ensure_ascii=False) + "\n")
        return
    sample = json.loads(path.read_text())
    assert sample.keys() == answers.keys()
    gone = differences(sample, answers, "habits")
    assert not gone, "front/tests/samples/habits.json no longer has the door's shape; run this test with WRITE_FRONT_SAMPLES=1:\n" + "\n".join(gone)


def test_the_gym_sample_has_the_doors_shape(fake, monkeypatch):
    """The Gym (deploy 95, for the pages of deploys 96 and 97): an invented three-day split (Push, Pull, Legs; weights, bodyweight and
    cardio; a removed day and a retired exercise) with eight weeks of workouts and a workout started today with two exercises done.
    Every read (Activity without watch data and with invented watch data), and the saves without their fresh read: a tick (with
    Undo), a remove (with Undo), a pick, a refusal, a plan change (itemadd) and a new exercise."""
    from test_api_gym import invented
    from test_watch import TOKEN, payload, post as watch_post
    from test_web import client

    x = invented(plain=True)
    c, bearer, _ = signed_in()
    get = lambda path: c.get("/api/v1" + path, headers=bearer).json()  # noqa: E731
    post = lambda path, **body: c.post("/api/v1" + path, headers=bearer, json=body).json()  # noqa: E731
    answers = {"gym": get("/gym"), "plan": get("/gym/plan"), "exercises": get("/gym/exercises"), "progress": get(f'/gym/progress?x={x["bench"]}'),
               "history": get("/gym/history"), "activity_none": get("/gym/activity")}
    monkeypatch.setenv("WATCH_TOKEN", TOKEN)
    for back in (1, 0):
        watch_post(client("log.19hospitalroad.fyi"), payload(day() - timedelta(days=back)))
    answers["activity"] = get(f"/gym/activity?day={day() - timedelta(days=1)}")
    g = answers["gym"]["gym"]
    assert g["done"] == 2 and g["exercises"] and g["other"] and any(r["up_kg"] for r in g["exercises"]) and g["chips"]
    assert answers["progress"]["gym_progress"]["chart"] and answers["plan"]["gym_plan"]["removed"] and answers["history"]["gym_history"]["workouts"]
    assert not answers["activity_none"]["gym_activity"]["has_data"] and answers["activity"]["gym_activity"]["sleep"]
    press = next(r for r in g["exercises"] if r["name"] == "Shoulder press")
    saves = {"tick": post("/gym/tick", exercise_id=x["press"], **{k: v for k, v in press["values"].items() if v is not None}, key="sample-gym-key-0001"),
             "remove": post("/gym/remove", set_id=g["exercises"][0]["logged"][-1]["set_id"]),
             "pick": post("/gym/pick", day_id=x["pull"]),
             "refused": post("/gym/tick", exercise_id=x["bench"], sets=3, reps=8, key="sample-gym-key-0002"),
             "itemadd": post("/gym/itemadd", day_id=x["legs"], exercise_id=x["pushup"], sets=3, reps=15),
             "new": post("/gym/new", name="Rowing machine", kind="cardio", words=["rower"])}
    views = {"tick": "gym", "remove": "gym", "pick": "gym", "refused": "gym", "itemadd": "gym_plan", "new": "gym_exercises"}
    for k, a in saves.items():
        assert views[k] in a and a.pop(views[k]), (k, a)
    assert saves["tick"]["outcome"] == "saved" and saves["tick"]["undo"] and saves["remove"]["outcome"] == "changed" and saves["remove"]["undo"]
    assert saves["pick"]["outcome"] == "changed" and saves["refused"]["outcome"] == "rejected" and saves["refused"]["reason"] == "Give the weight in kg."
    assert saves["itemadd"]["outcome"] == "changed" and saves["new"]["outcome"] == "changed"
    answers["saves"] = saves
    path = SAMPLES / "gym.json"
    if os.environ.get("WRITE_FRONT_SAMPLES") == "1":
        path.write_text(json.dumps(answers, indent=1, ensure_ascii=False) + "\n")
        return
    sample = json.loads(path.read_text())
    assert sample.keys() == answers.keys()
    gone = differences(sample, answers, "gym")
    assert not gone, "front/tests/samples/gym.json no longer has the door's shape; run this test with WRITE_FRONT_SAMPLES=1:\n" + "\n".join(gone)


def test_the_home_sample_has_the_doors_shape(fake):
    """Home (deploy 98, for the pages of deploys 99 and 100): four invented zones (one retired) and seven chores (two of the whole flat,
    one retired) with done rows of every kind. Every read (the Now tab and the Pick page also with a timer running; a chore of a zone and
    one of the whole flat), and the saves without their fresh read: a tick (with Undo), All done, a removal from History, Not today,
    a starting point, a job done earlier, the timer started, paused and Done, a per-zone change, a refusal and an Undo."""
    from test_api_home import invented

    x = invented(plain=True)
    c, bearer, _ = signed_in()
    get = lambda path: c.get("/api/v1" + path, headers=bearer).json()  # noqa: E731
    post = lambda path, **body: c.post("/api/v1" + path, headers=bearer, json=body).json()  # noqa: E731
    answers = {"home": get("/home"), "pick": get("/home/pick"), "pick_hour": get("/home/pick?min=60"), "zones": get("/home/zones"),
               "history": get("/home/history"), "chore": get(f'/home/chore?id={x["stove"]}'), "chore_flat": get(f'/home/chore?id={x["vacuum"]}'),
               "edit": get("/home/edit")}
    h = answers["home"]["home"]
    assert h["rows"] and h["recent"] and answers["zones"]["home_zones"]["start"]["jobs"] and answers["zones"]["home_zones"]["flat"]
    assert answers["pick_hour"]["home_pick"]["job"]["session"] and answers["history"]["home_history"]["days"]
    assert answers["chore"]["home_chore"]["usually"] and answers["chore_flat"]["home_chore"]["zones"]
    tick = post("/home/tick", chore_id=x["fridge"], zone_id=x["kitchen"], key="sample-home-key-0001")
    entry = answers["history"]["home_history"]["days"][0]["rows"][0]
    saves = {"tick": tick,
             "alldone": post("/home/alldone", chore_id=x["dust"], key="sample-home-key-0002"),
             "remove": post("/home/remove", ids=entry["ids"]),
             "skip": post("/home/skip", pairs=[[x["shoes"], x["hall"]]]),
             "startpoint": post("/home/startpoint", pairs=[[x["towels"], x["bath"]]], ago="week", key="sample-home-key-0003"),
             "earlier": post("/home/earlier", pairs=[[x["sink"], x["bath"]]], when=1, key="sample-home-key-0004"),
             "start": post("/home/start", pairs=[[x["stove"], x["kitchen"]]], minutes=15)}
    t = saves["start"]["home_pick"]["timer"]
    answers["home_timer"], answers["pick_timer"] = get("/home"), get("/home/pick")
    saves["pause"] = post("/home/pause", timer_id=t["id"])
    saves["pickdone"] = post("/home/pickdone", pairs=t["pairs"], timer_id=t["id"], key="sample-home-key-0005")
    saves["undo"] = post("/undo", token=saves["pickdone"]["undo"]["token"], view="home")
    saves["chorezones"] = post("/home/chorezones", chore_id=x["vacuum"], zones=[{"zone_id": x["kitchen"], "on": True, "days": 3},
                                                                                {"zone_id": x["bath"], "on": True, "minutes": 5},
                                                                                {"zone_id": x["hall"], "on": True}])
    saves["refused"] = post("/home/goalset", goal=9)
    views = {"tick": "home", "alldone": "home_zones", "remove": "home_history", "skip": "home_pick", "startpoint": "home_zones", "earlier": "home_pick",
             "start": "home_pick", "pause": "home_pick", "pickdone": "home", "chorezones": "home_edit", "refused": "home_edit", "undo": "home"}
    for k, a in saves.items():
        assert views[k] in a and a.pop(views[k]), (k, a)
    assert all(saves[k]["undo"] for k in ("tick", "alldone", "remove", "skip", "startpoint", "earlier")), saves
    assert saves["start"]["undo"] is None and saves["pause"]["outcome"] == "changed" and saves["pickdone"]["outcome"] == "saved"
    assert saves["refused"]["outcome"] == "rejected" and saves["undo"]["head"] == "Undone: the tick is gone."
    assert answers["home_timer"]["home"]["timer"] and answers["pick_timer"]["home_pick"]["timer"]
    answers["saves"] = saves
    path = SAMPLES / "home.json"
    if os.environ.get("WRITE_FRONT_SAMPLES") == "1":
        path.write_text(json.dumps(answers, indent=1, ensure_ascii=False) + "\n")
        return
    sample = json.loads(path.read_text())
    assert sample.keys() == answers.keys()
    gone = differences(sample, answers, "home")
    assert not gone, "front/tests/samples/home.json no longer has the door's shape; run this test with WRITE_FRONT_SAMPLES=1:\n" + "\n".join(gone)


def _trends_today(monkeypatch):
    """The samples of Trends are read as on a Wednesday (every period has days; "this week so far" two of them)."""
    from app import weekpage
    from test_api_trends import today
    t0 = today()
    wed = t0 - timedelta(days=(t0.weekday() - 2) % 7)
    monkeypatch.setattr(weekpage, "today_of", lambda cur: wed)
    return wed


def _write_or_check(name: str, answers: dict):
    path = SAMPLES / name
    if os.environ.get("WRITE_FRONT_SAMPLES") == "1":
        path.write_text(json.dumps(answers, indent=1, ensure_ascii=False) + "\n")
        return
    sample = json.loads(path.read_text())
    assert sample.keys() == answers.keys()
    gone = differences(sample, answers, name.removesuffix(".json"))
    assert not gone, f"front/tests/samples/{name} no longer has the door's shape; run this test with WRITE_FRONT_SAMPLES=1:\n" + "\n".join(gone)


def test_the_week_sample_has_the_doors_shape(monkeypatch):
    """The Week page (deploy 101, for the pages of deploys 102 and 103): about 90 invented days (test_api_trends.invented), read as on a
    Wednesday. Every period with the Week review card in each state: last week done (the parts, meta, Review again), none and failed,
    this week so far working (and cut off), the rolling 7 and 30 days with the blurb and the latest review; this week so far on a
    Monday (empty). The button (POST /coach/start, without its fresh read): started (working), already on it, the daily limit; and the
    status poll (working, done, failed, gone). The AI is a fake that never answers here: no review is read."""
    from app import coach, weekpage
    from test_api_trends import WEEK_BODY, invented, review
    from test_coach import FakeCoach

    f = FakeCoach()
    monkeypatch.setattr(coach, "PROVIDER", f)
    monkeypatch.setattr(coach, "BACKGROUND", False)
    monkeypatch.setattr(coach, "run", lambda cid: None)  # a started review stays "working"
    try:
        invented(plain=True)
        wed = _trends_today(monkeypatch)
        c, bearer, _ = signed_in()
        get = lambda path: c.get("/api/v1" + path, headers=bearer).json()  # noqa: E731
        post = lambda path, **body: c.post("/api/v1" + path, headers=bearer, json=body).json()  # noqa: E731
        answers = {"7": get("/week?p=7"), "30": get("/week?p=30"), "last_none": get("/week?p=last")}
        failed = review("last", "failed", error="ProviderError", t0=wed)
        answers["last_failed"] = get("/week?p=last")
        done = review("last", body=dict(WEEK_BODY, doctor="Ask your doctor about the morning sugar."), t0=wed)
        answers["last_done"] = get("/week?p=last")
        working = review("this", "working", t0=wed)
        answers["this_working"] = get("/week?p=this")
        owner_sql("UPDATE coachings SET created_at = now() - interval '11 minutes' WHERE id = %s", working)
        answers["this_cut_off"] = get("/week?p=this")
        answers["7_latest"] = get("/week?p=7")
        statuses = {"working": review("this", "working", t0=wed), "done": done, "failed": failed, "gone": 999999}
        answers["status"] = {k: get(f"/coach/status?id={v}") for k, v in statuses.items()}
        monkeypatch.setattr(weekpage, "today_of", lambda cur: wed - timedelta(days=2))
        answers["this_monday"] = get("/week?p=this")
        monkeypatch.setattr(weekpage, "today_of", lambda cur: wed)
        a, b = weekpage.bounds("last", today_real := owner_sql("SELECT log_day(now()) AS d")[0]["d"])
        owner_sql("DELETE FROM coachings")
        saves = {"start": post("/coach/start", kind="week", start=a.isoformat(), end=b.isoformat())}
        saves["on_it"] = post("/coach/start", kind="week", start=a.isoformat(), end=b.isoformat())
        for _ in range(coach.DAILY_LIMIT):
            owner_sql("INSERT INTO coachings (kind, start_day, end_day, status) VALUES ('day', %s, %s, 'done')", today_real, today_real)
        saves["limit"] = post("/coach/start", kind="week", start=(a - timedelta(days=7)).isoformat(), end=(b - timedelta(days=7)).isoformat())
    finally:
        owner_sql("DELETE FROM food_targets")
    assert answers["last_done"]["week"]["review"]["state"] == "done" and answers["last_done"]["week"]["review"]["parts"]
    assert (answers["last_none"]["week"]["review"]["state"], answers["last_failed"]["week"]["review"]["state"]) == ("none", "failed")
    assert answers["this_working"]["week"]["review"]["state"] == "working" and answers["this_cut_off"]["week"]["review"]["state"] == "failed"
    assert answers["7_latest"]["week"]["review"]["latest"] and answers["this_monday"]["week"]["empty"]
    assert [answers["status"][k]["coaching"]["state"] for k in statuses] == list(statuses)
    assert saves["start"]["coaching"]["state"] == "working" and saves["on_it"]["head"] == "The coach is already on it."
    assert saves["limit"]["outcome"] == "rejected" and saves["limit"]["coaching"] is None and not f.calls
    for a_ in saves.values():
        assert a_.pop("week")
    answers["saves"] = saves
    _write_or_check("week.json", answers)


def test_the_food_trends_and_insights_samples_have_the_doors_shape(monkeypatch):
    """The Food page's Trends tab in its three ranges, and Insights with two cards and one waiting (deploy 101)."""
    from test_api_trends import invented
    try:
        invented(plain=True)
        c, bearer, _ = signed_in()
        get = lambda path: c.get("/api/v1" + path, headers=bearer).json()  # noqa: E731
        trends = {str(r): get(f"/food/trends?range={r}") for r in (7, 30, 90)}
        insights = {"insights": get("/insights")}
    finally:
        owner_sql("DELETE FROM food_targets")
    assert all(len(t["trends"]["charts"]) == 4 for t in trends.values())
    assert [c_["waiting"] for c_ in insights["insights"]["insights"]["cards"]] == [False, True, False]
    _write_or_check("food_trends.json", trends)
    _write_or_check("insights.json", insights)


def test_the_catalogue_sample_has_the_doors_shape(fake):
    """The food catalogue (deploy 104, for the Library page of deploy 105): 14 invented foods (test_api_library.invented: a drink with a
    unit and a barcode, two that need review, one hidden, a recipe food), the list in each filter and two orders, a search with no match,
    four boxes (the drink, one that needs review with a unit, one with a barcode and past entries, the recipe food), and the saves'
    answers without their fresh read: a values change read back and made with the past, a word refused, a unit, a food hidden."""
    from test_api_library import invented
    x = invented(plain=True)
    c, bearer, _ = signed_in()
    get = lambda path: c.get("/api/v1" + path, headers=bearer).json()  # noqa: E731
    post = lambda path, **body: c.post("/api/v1" + path, headers=bearer, json=body).json()  # noqa: E731
    answers = {"all": get("/food/catalogue"), "drinks": get("/food/catalogue?f=drinks"), "review": get("/food/catalogue?f=review&s=name"),
               "new": get("/food/catalogue?f=new&s=added"), "none": get("/food/catalogue?q=zzqq")}
    answers["items"] = {k: get(f"/food/item?id=N{x[k]}") for k in ("oatdrink", "rye", "oats", "bowl")}
    saves = {"values_ask": post("/food/catalogue/values", id=x["skyr"], kcal=70, past=True, view_food=x["skyr"]),
             "values_done": post("/food/catalogue/values", id=x["skyr"], kcal=70, past=True, confirmed=True, view_food=x["skyr"]),
             "word_refused": post("/food/catalogue/words", id=x["rice"], act="add", word="porridge"),
             "unit": post("/food/catalogue/unit", id=x["rye"], unit="thick slice", grams=50, view_food=x["rye"]),
             "hidden": post("/food/catalogue/basics", id=x["apple"], hide=True, view_food=x["apple"])}
    assert answers["all"]["catalogue"]["count"] == 13 and answers["none"]["catalogue"]["empty"]
    assert answers["items"]["rye"]["food_item"]["needs_review"] and answers["items"]["oatdrink"]["food_item"]["units"]
    assert saves["values_ask"]["outcome"] == "needs_confirmation" and saves["values_done"]["outcome"] == "changed"
    assert saves["word_refused"]["outcome"] == "rejected" and saves["hidden"]["food_item"] is None and saves["unit"]["food_item"]["units"]
    for a in saves.values():
        a.pop("catalogue")
    answers["saves"] = saves
    _write_or_check("catalogue.json", answers)


def test_the_labs_sample_has_the_doors_shape(fake):
    """Medical (deploy 104, for the Medical page of deploy 106): five invented reports (one imaging; test_api_medical.invented), the
    Reports tab with nothing open and with one report open, Tests over time (the list, a search, one test with four values and a range,
    one with a single value, nothing found), the Medication tab (two running, two ended), and the saves' answers without their fresh
    read: a value read back and made, a course ended, a refusal; a new course typed through /log with its yes."""
    from test_api_medical import SENTENCE, invented
    from test_log import ANSWERS, COMMANDS, C, P
    x = invented(plain=True)
    c, bearer, _ = signed_in()
    get = lambda path: c.get("/api/v1" + path, headers=bearer).json()  # noqa: E731
    post = lambda path, **body: c.post("/api/v1" + path, headers=bearer, json=body).json()  # noqa: E731
    answers = {"reports": get("/labs"), "open": get(f"/labs?open=R{x['r4']}"), "open_imaging": get(f"/labs?open=R{x['img']}"),
               "tests": get("/labs/tests"), "search": get("/labs/tests?q=vit"), "test": get(f"/labs/tests?t={x['t_vitd']}"),
               "one_value": get(f"/labs/tests?t={x['t_tsh']}"), "no_test": get("/labs/tests?q=zzqq"), "meds": get("/labs/meds")}
    saves = {"value_ask": post("/labs/value", id=x["r4_hb"], value="12.9"),
             "value_done": post("/labs/value", id=x["r4_hb"], value="12.9", confirmed=True),
             "report_refused": post("/labs/report", id=x["r2"], title=""),
             "end_ask": post("/labs/med", id=x["d_vitd"], act="end"),
             "end_done": post("/labs/med", id=x["d_vitd"], act="end", confirmed=True),
             "end_again": post("/labs/med", id=x["d_vitd"], act="end", confirmed=True)}
    ANSWERS[SENTENCE] = P(intent="command", command_text=SENTENCE)
    COMMANDS[SENTENCE] = lambda u: C(("med", {"action": "start", "name": "Vitamin D", "dose": "1000 IU", "frequency": "daily"}))
    try:
        saves["log_ask"] = post("/log", text=SENTENCE, view="labs_meds")
        saves["log_yes"] = post("/answer", question_id=saves["log_ask"]["questions"][0]["id"], reply="yes", view="labs_meds")
    finally:
        ANSWERS.pop(SENTENCE)
        COMMANDS.pop(SENTENCE)
    assert answers["test"]["labs_tests"]["card"]["chart"]["band"] and len(answers["test"]["labs_tests"]["rows"]) == 4
    assert answers["meds"]["labs_meds"]["running"] == 2 and len(answers["meds"]["labs_meds"]["meds"]) == 4
    assert saves["value_done"]["outcome"] == "changed" and saves["report_refused"]["outcome"] == "rejected"
    assert saves["end_again"]["outcome"] == "unchanged" and saves["log_ask"]["outcome"] == "needs_confirmation"
    assert len(saves["log_yes"]["labs_meds"]["meds"]) == 5
    for k, a in saves.items():
        a.pop("labs" if k.startswith(("value", "report")) else "labs_meds")
    answers["saves"] = saves
    _write_or_check("labs.json", answers)

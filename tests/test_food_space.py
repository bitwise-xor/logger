"""The Food space at logger. (21.11.2026): GET /api/v1/food/nutrients (every tracked value of what was eaten, over 1, 7 or 30 days,
unknown values counted and said, never taken as zero), a meal's note (migration 033, mealnotes.py: kept by its time, so it follows its
meal when meals are renumbered or merge or go), POST /api/v1/food/mealnote, GET /api/v1/food/notes and the export. Every food, number
and sentence is invented."""
import io
import zipfile
from datetime import datetime, time, timedelta

import pytest

from app import export, mealnotes, reads
from app.rules import BERLIN
from conftest import owner_sql
from test_api_door import door, door_on, signed_in  # noqa: F401 - door_on is autouse
from test_webtoday import day, no_targets, raw  # noqa: F401 - no_targets: clean targets and usual meals

VALUES = ("kcal", "protein", "fat", "sat_fat", "carbs", "fibre", "sugar_total", "sugar_added", "sodium_mg", "caffeine_mg")


def food(name, drink=False, **per100):
    """A catalogue food with its values per 100 (the four main ones 0 unless given; the others unknown unless given)."""
    v = {k: per100.get(k, 0 if k in ("kcal", "protein", "fat", "carbs") else None) for k in VALUES}
    return owner_sql(f"""INSERT INTO foods (name, basis, source, is_drink, {", ".join(VALUES)})
                         VALUES (%s, %s, 'label', %s, {", ".join(["%s"] * len(VALUES))}) RETURNING id""",
                     name, "ml" if drink else "g", drink, *v.values())[0]["id"]


def eat(d, hm, fid, amount, **vals):
    """An entry of day d at hm (Berlin) with its own values as eaten (the four main ones 0 unless given, the others unknown)."""
    at = datetime.combine(d, time.fromisoformat(hm), BERLIN)
    v = {k: vals.get(k, 0 if k in ("kcal", "protein", "fat", "carbs") else None) for k in VALUES}
    return owner_sql(f"""INSERT INTO food_entries (raw_id, food_id, amount, eaten_at, time_known, day, day_rule, extractor_version, source,
                                                   {", ".join(VALUES)})
                         VALUES (%s, %s, %s, %s, true, %s, 'wake', 'test', 'label', {", ".join(["%s"] * len(VALUES))}) RETURNING id""",
                     raw(), fid, amount, at, d, *v.values())[0]["id"]


@pytest.fixture
def get():
    c, bearer, _ = signed_in()
    return lambda path: c.get("/api/v1" + path, headers=bearer)


@pytest.fixture
def post():
    c, bearer, _ = signed_in()
    return lambda path, **body: c.post("/api/v1" + path, headers=bearer, json=body)


def line(n, key):
    return next(x for x in n["nutrients"] if x["key"] == key)


# ---- the Nutrients tab ------------------------------------------------------------------------------------------

def test_one_day_has_every_line_in_order_with_totals_targets_and_unknown_counts(get):
    d = day()
    owner_sql("""INSERT INTO food_targets (valid_from, kcal, protein, fat, sat_fat, carbs, fibre, sugar_added, sodium_mg)
                 VALUES ('2020-01-01', 2000, 120, 70, 20, 250, 30, 25, 2000)""")
    banana, bar, coffee = food("Test banana"), food("Test bar"), food("Test coffee", drink=True)
    eat(d, "08:00", banana, 120, kcal=107, protein=1.3, fat=0.4, carbs=27, sugar_total=14.7, sugar_added=0, fibre=3.1, sat_fat=0.1, sodium_mg=1)
    eat(d, "08:10", bar, 40, kcal=180, protein=4, fat=8, carbs=22, sugar_total=12, fibre=2, sat_fat=3.5, sodium_mg=80)  # added sugar unknown
    eat(d, "08:15", coffee, 250, kcal=5, caffeine_mg=95, sodium_mg=4)
    eat(d, "13:00", banana, 100, kcal=89, protein=1.1, fat=0.3, carbs=23, sugar_total=12.2, sugar_added=0, fibre=2.6, sat_fat=0.1, sodium_mg=1)
    r = get(f"/food/nutrients?day={d.isoformat()}")
    assert r.status_code == 200, r.text
    n = r.json()["food_nutrients"]
    assert [x["key"] for x in n["nutrients"]] == ["kcal", "protein", "fat", "sat_fat", "carbs", "sugar_total", "sugar_added", "fibre", "salt",
                                                 "caffeine_mg"]
    assert [x["label"] for x in n["nutrients"]][:4] == ["Calories", "Protein", "Fat", "of which saturated"]
    assert n["days"] == 1 and n["per_day"] is False and n["day"] == n["start"] == n["end"] == d.isoformat() and n["eaten_days"] == 1
    assert line(n, "kcal")["value"] == 381 and line(n, "kcal")["unknown"] == 0 and line(n, "kcal")["target"] == 2000
    sugar = line(n, "sugar_total")
    assert sugar["value"] == 38.9 and sugar["unknown"] == 1 and sugar["unknown_foods"] == 1 and sugar["target"] is None  # the coffee
    added = line(n, "sugar_added")
    assert added["value"] == 0 and added["unknown"] == 2 and added["unknown_foods"] == 2 and added["aim"] == "under" and added["target"] == 25
    salt = line(n, "salt")
    assert salt["sodium_mg"] == 86 and salt["value"] == 0.21 and salt["unit"] == "g" and salt["target"] == 5 and salt["target_sodium_mg"] == 2000
    assert line(n, "protein")["aim"] == line(n, "fibre")["aim"] == "reach" and line(n, "caffeine_mg")["value"] == 95
    assert line(n, "caffeine_mg")["unknown"] == 3 and line(n, "sat_fat")["sub"] and not line(n, "fat")["sub"]
    # the foods: one row per food, added up; a value is null when one of its entries has none; refs on one day
    foods = {f["name"]: f for f in n["foods"]}
    assert [f["name"] for f in n["foods"]] == ["Test banana", "Test bar", "Test coffee"]  # most kcal first
    b = foods["Test banana"]
    assert b["amount"] == 220 and b["entries"] == 2 and len(b["refs"]) == 2 and b["values"]["sugar_total"] == 26.9 and b["values"]["kcal"] == 196
    assert b["values"]["caffeine_mg"] is None and foods["Test bar"]["values"]["sugar_added"] is None and foods["Test coffee"]["drink"]
    assert set(b["per_100"]) == {*VALUES, "salt"} and b["source"] == "label" and b["ref"] == f"N{b['food_id']}"
    # per meal (one day only): breakfast with the bar, lunch, and the drinks last
    assert [(m["meal"], m["label"]) for m in n["meals"]] == [(1, "Meal 1"), (2, "Meal 2"), (0, "Drinks")]
    assert n["meals"][0]["values"]["kcal"] == 287 and n["meals"][0]["unknown"]["sugar_added"] == 1 and len(n["meals"][0]["foods"]) == 2


def test_seven_days_give_the_average_per_day_with_entries_and_the_foods_added_up(get):
    d = day()
    oats = food("Test oats", kcal=380)
    eat(d, "08:00", oats, 100, kcal=380, fibre=10)
    eat(d - timedelta(days=3), "08:00", oats, 50, kcal=190)  # fibre unknown
    eat(d - timedelta(days=9), "08:00", oats, 50, kcal=190, fibre=5)  # outside the 7 days
    n = get("/food/nutrients?days=7").json()["food_nutrients"]
    assert n["days"] == 7 and n["per_day"] and n["eaten_days"] == 2 and n["start"] == (d - timedelta(days=6)).isoformat() and n["meals"] == []
    assert line(n, "kcal")["value"] == 285 and line(n, "kcal")["sum"] == 570
    assert line(n, "fibre")["value"] == 5 and line(n, "fibre")["unknown"] == 1 and line(n, "fibre")["sum"] == 10
    (f,) = n["foods"]
    assert f["amount"] == 150 and f["entries"] == 2 and f["refs"] is None and f["values"]["kcal"] == 570 and f["values"]["fibre"] is None
    month = get("/food/nutrients?days=30").json()["food_nutrients"]
    assert month["eaten_days"] == 3 and line(month, "kcal")["value"] == 253.3


def test_an_empty_period_and_the_checks(get):
    n = get("/food/nutrients").json()["food_nutrients"]
    assert n["eaten_days"] == 0 and n["foods"] == [] and n["meals"] == [] and line(n, "kcal")["value"] == 0
    for bad in ("days=2", "days=x", "days=0", "days=31", "day=21.11.2026"):
        r = get(f"/food/nutrients?{bad}")
        assert r.status_code == 400 and r.json()["error"] == "bad_request", bad
    assert get("/food/nutrients?days=5").json()["message"] == "days must be 1, 7 or 30."
    later = get(f"/food/nutrients?day={(day() + timedelta(days=4)).isoformat()}").json()["food_nutrients"]
    assert later["day"] == day().isoformat() and later["past"] is False


def test_salt_is_sodium_times_two_and_a_half():
    assert reads.salt(2000) == 5 and reads.salt(86) == 0.21 and reads.salt(None) is None


# ---- a meal's note: where it is shown --------------------------------------------------------------------------

def notes_of(d):
    with __import__("app.db", fromlist=["connect"]).connect() as c, c.cursor() as cur:
        return mealnotes.shown(cur, d)


@pytest.fixture
def yday():
    return day() - timedelta(days=1)


def test_a_note_is_saved_on_a_meal_and_replaced_and_removed(yday):
    oats, soup = food("Test oats"), food("Test soup")
    eat(yday, "08:00", oats, 60)
    eat(yday, "08:30", oats, 20)
    eat(yday, "13:00", soup, 300)
    assert mealnotes.save(yday, 2, "  too   salty ", day()) == {"outcome": "changed", "head": "Meal note saved."}
    assert notes_of(yday) == ({2: "too salty"}, None)
    rows = owner_sql("SELECT at, note FROM food_meal_notes")
    assert len(rows) == 1 and rows[0]["at"] == datetime.combine(yday, time(13), BERLIN)  # the meal's first entry
    assert mealnotes.save(yday, 2, "just right", day())["outcome"] == "changed"
    assert notes_of(yday) == ({2: "just right"}, None) and len(owner_sql("SELECT id FROM food_meal_notes")) == 1
    assert mealnotes.save(yday, 2, "just right", day()) == {"outcome": "unchanged", "head": "Nothing changed."}
    assert mealnotes.save(yday, 1, "with milk", day())["outcome"] == "changed"
    assert notes_of(yday) == ({1: "with milk", 2: "just right"}, None)
    assert mealnotes.save(yday, 2, "", day()) == {"outcome": "changed", "head": "Meal note removed."}
    assert notes_of(yday) == ({1: "with milk"}, None)
    assert mealnotes.save(yday, 2, "", day())["outcome"] == "unchanged"
    assert mealnotes.save(yday, 5, "x", day()) == {"outcome": "rejected", "reason": "That meal is not there any more."}
    assert mealnotes.save(day() + timedelta(days=1), 1, "x", day())["outcome"] == "rejected"


def test_a_meal_renumbered_by_an_earlier_entry_keeps_its_note(yday):
    soup = food("Test soup")
    eat(yday, "13:00", soup, 300)
    mealnotes.save(yday, 1, "lunch at work", day())
    eat(yday, "07:00", food("Test oats"), 60)  # a breakfast added later: lunch is meal 2 now
    assert owner_sql("SELECT meal FROM food_entries WHERE food_id = %s", soup)[0]["meal"] == 2
    assert notes_of(yday) == ({2: "lunch at work"}, None)


def test_two_meals_that_merge_show_the_newest_note_and_the_next_save_keeps_one(yday):
    oats = food("Test oats")
    eat(yday, "08:00", oats, 60)
    eat(yday, "11:00", oats, 60)  # 3 hours later: meal 2
    mealnotes.save(yday, 1, "first", day())
    mealnotes.save(yday, 2, "second", day())
    eat(yday, "09:40", oats, 10)  # bridges the two (within 2 hours of both): one meal
    assert owner_sql("SELECT DISTINCT meal FROM food_entries") == [{"meal": 1}]
    assert notes_of(yday) == ({1: "second"}, None)
    mealnotes.save(yday, 1, "one meal", day())
    assert [r["note"] for r in owner_sql("SELECT note FROM food_meal_notes")] == ["one meal"]


def test_a_note_moves_to_the_nearest_meal_when_its_entries_go_and_to_the_day_when_none_is_left(yday):
    oats, soup, tea = food("Test oats"), food("Test soup"), food("Test tea", drink=True)
    eat(yday, "08:00", oats, 60)
    lunch = eat(yday, "13:00", soup, 300)
    eat(yday, "13:05", tea, 250)  # a drink: never a meal's anchor
    mealnotes.save(yday, 2, "lunch note", day())
    owner_sql("DELETE FROM food_entries WHERE id = %s", lunch)
    assert notes_of(yday) == ({1: "lunch note"}, None)
    owner_sql("DELETE FROM food_entries WHERE food_id = %s", oats)
    assert notes_of(yday) == ({}, "lunch note")
    assert mealnotes.save(yday, 0, "the day's note", day())["head"] == "Note saved."
    assert notes_of(yday) == ({}, "the day's note")
    assert mealnotes.save(yday, 0, "", day())["head"] == "Note removed."
    assert mealnotes.save(yday, 0, "a new one", day())["outcome"] == "rejected"  # a day without meals takes no new note
    eat(yday, "09:00", oats, 60)
    assert mealnotes.save(yday, 0, "x", day())["outcome"] == "rejected"


def test_ties_go_to_the_earlier_entry():
    rows = [{"id": 1, "eaten_at": datetime(2026, 1, 1, 8, tzinfo=BERLIN), "meal": 1},
            {"id": 2, "eaten_at": datetime(2026, 1, 1, 12, tzinfo=BERLIN), "meal": 2}]
    assert mealnotes.meal_of(datetime(2026, 1, 1, 10, tzinfo=BERLIN), rows) == 1
    assert mealnotes.meal_of(datetime(2026, 1, 1, 10, 1, tzinfo=BERLIN), rows) == 2
    assert mealnotes.meal_of(datetime(2026, 1, 1, 10, tzinfo=BERLIN), []) is None


# ---- the door: POST /food/mealnote, the Food day, GET /food/notes ------------------------------------------------

def test_the_save_route_answers_with_the_fresh_food_day_and_checks_what_it_gets(post, yday):
    eat(yday, "08:00", food("Test oats"), 60)
    r = post("/food/mealnote", day=yday.isoformat(), meal=1, note="porridge  with  cinnamon")
    assert r.status_code == 200, r.text
    a = r.json()
    assert a["outcome"] == "changed" and a["head"] == "Meal note saved." and a["tone"] == "ok"
    fd = a["food_day"]
    assert fd["day"] == yday.isoformat() and fd["meals"][0]["note"] == "porridge with cinnamon" and fd["day_note"] is None
    gone = post("/food/mealnote", day=yday.isoformat(), meal=3, note="x").json()
    assert gone["outcome"] == "rejected" and gone["reason"] == "That meal is not there any more." and gone["tone"] == "warning"
    for body, words in ((dict(meal=1, note="x"), "day is missing."), (dict(day="21.11.2026", meal=1, note="x"), "day must be yyyy-mm-dd."),
                        (dict(day=yday.isoformat(), note="x"), "meal must be a meal's number (1, 2, …; 0 for the day's note)."),
                        (dict(day=yday.isoformat(), meal=True, note="x"), None), (dict(day=yday.isoformat(), meal=21, note="x"), None),
                        (dict(day=yday.isoformat(), meal=1, note=5), "note must be text."),
                        (dict(day=yday.isoformat(), meal=1, note="x" * 301), "note must be at most 300 characters.")):
        r = post("/food/mealnote", **body)
        assert r.status_code == 400 and r.json()["error"] == "bad_request", body
        if words:
            assert r.json()["message"] == words
    assert post("/food/mealnote", day=yday.isoformat(), meal="1", note="x" * 300 + "   ").json()["outcome"] == "changed"


def test_the_food_day_has_the_meal_notes_and_never_one_on_the_drinks(get, yday):
    eat(yday, "08:00", food("Test oats"), 60)
    eat(yday, "08:05", food("Test tea", drink=True), 250)
    mealnotes.save(yday, 1, "a quiet breakfast", day())
    fd = get(f"/food/day?day={yday.isoformat()}").json()["food_day"]
    assert [(m["meal"], m["note"]) for m in fd["meals"]] == [(1, "a quiet breakfast"), (0, None)] and fd["day_note"] is None
    empty = get("/food/day").json()["food_day"]
    assert empty["meals"] == [] and empty["day_note"] is None


def test_the_notes_list_has_meal_and_food_notes_newest_first(get, yday):
    oats, soup = food("Test oats"), food("Test soup")
    eat(yday - timedelta(days=1), "08:00", oats, 60)
    mealnotes.save(yday - timedelta(days=1), 1, "older breakfast", day())
    eat(yday, "08:00", oats, 60)
    lunch = eat(yday, "13:00", soup, 300)
    owner_sql("UPDATE food_entries SET note = 'too thick', portion_text = '1 bowl' WHERE id = %s", lunch)
    mealnotes.save(yday, 2, "lunch outside", day())
    eat(yday - timedelta(days=100), "08:00", oats, 60)
    mealnotes.save(yday - timedelta(days=100), 1, "long ago", day())
    r = get("/food/notes")
    assert r.status_code == 200, r.text
    n = r.json()["food_notes"]
    assert n["days"] == 90 and n["today"] == day().isoformat() and n["start"] == (day() - timedelta(days=89)).isoformat()
    assert [(x["kind"], x["day"], x["note"]) for x in n["notes"]] == [
        ("meal", yday.isoformat(), "lunch outside"), ("food", yday.isoformat(), "too thick"),
        ("meal", (yday - timedelta(days=1)).isoformat(), "older breakfast")]
    meal, fnote = n["notes"][0], n["notes"][1]
    assert meal["meal"] == 2 and meal["label"] == "Meal 2" and meal["at"].startswith(f"{yday.isoformat()}T13:00")
    assert fnote == {"kind": "food", "day": yday.isoformat(), "meal": 2, "label": "Meal 2", "at": meal["at"], "note": "too thick",
                     "ref": f"f{lunch}", "food": "Test soup", "amount": 300, "unit": "g", "portion_text": "1 bowl"}
    assert len(get("/food/notes?days=366").json()["food_notes"]["notes"]) == 4
    for bad in ("0", "367", "x", "-1"):
        r = get(f"/food/notes?days={bad}")
        assert r.status_code == 400 and r.json()["message"] == "days must be a whole number from 1 to 366.", bad


def test_the_export_has_the_meal_notes(yday):
    eat(yday, "08:00", food("Test oats"), 60)
    mealnotes.save(yday, 1, "zz-meal-note", day())
    data, _name, counts = export.build(False)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        csv = next(z.read(n) for n in z.namelist() if n.endswith("/food_meal_notes.csv")).decode("utf-8-sig")
    assert counts["food_meal_notes"] == 1 and "zz-meal-note" in csv and csv.startswith("id,day,time,note,")
    assert "food_meal_notes" in [name for name, _w, _s in export.FILES]


# ---- every value on the Food day (web 73, 23.11.2026) ------------------------------------------------------------

def test_the_food_day_has_every_value_per_row_and_meal_and_the_nutrients_tabs_lines(get):
    d = day()
    owner_sql("""INSERT INTO food_targets (valid_from, kcal, protein, fat, carbs, fibre, sugar_added, sodium_mg)
                 VALUES ('2020-01-01', 2000, 120, 70, 250, 30, 25, 2000)""")  # no target for saturated fat
    rye, bar, cola = food("Test rye bread"), food("Test nut bar"), food("Test cola", drink=True)
    eat(d, "08:00", rye, 80, kcal=190, protein=6.4, fat=1.2, sat_fat=0.2, carbs=36, sugar_total=2.1, sugar_added=0, fibre=5.6, sodium_mg=400)
    eat(d, "08:05", bar, 35, kcal=170, protein=5, fat=11, sat_fat=1.4, carbs=12, sugar_total=8, fibre=2.2, sodium_mg=30)  # added sugar unknown
    eat(d, "08:10", cola, 330, kcal=139, carbs=35, sugar_total=35, sugar_added=35, sodium_mg=13, caffeine_mg=32)
    fd = get(f"/food/day?day={d.isoformat()}").json()["food_day"]
    rows = {r["food"]: r for r in fd["rows"]}
    v = rows["Test rye bread"]["values"]
    assert set(v) == {"kcal", "protein", "fat", "sat_fat", "carbs", "sugar_total", "sugar_added", "fibre", "salt", "caffeine_mg", "sodium_mg"}
    assert v["kcal"] == 190 and v["fibre"] == 5.6 and v["salt"] == 1 and v["sodium_mg"] == 400 and v["caffeine_mg"] is None
    assert rows["Test nut bar"]["values"]["sugar_added"] is None and rows["Test nut bar"]["values"]["salt"] == 0.07  # 0.075 rounds as Python does
    assert rows["Test rye bread"]["nutrients"] == {"kcal": 190, "protein": 6.4, "fat": 1.2, "carbs": 36}  # what was there stays
    # the meals: the known values added up, and how many entries have none
    m1 = next(m for m in fd["meals"] if m["meal"] == 1)
    assert m1["values"]["kcal"] == 360 and m1["values"]["sugar_added"] == 0 and m1["unknown"]["sugar_added"] == 1
    assert m1["values"]["salt"] == 1.07 and m1["unknown"]["caffeine_mg"] == 2 and m1["unknown"]["kcal"] == 0
    drinks = next(m for m in fd["meals"] if m["meal"] == 0)
    assert drinks["values"]["caffeine_mg"] == 32 and drinks["unknown"]["caffeine_mg"] == 0 and drinks["note"] is None
    # the day's lines: the Nutrients tab's for the same day, targets where food_targets has them
    n = get(f"/food/nutrients?day={d.isoformat()}").json()["food_nutrients"]
    assert fd["lines"] == n["nutrients"]
    lines = {x["key"]: x for x in fd["lines"]}
    assert lines["kcal"]["target"] == 2000 and lines["sat_fat"]["target"] is None and lines["caffeine_mg"]["target"] is None
    assert lines["sugar_added"]["value"] == 35 and lines["sugar_added"]["unknown"] == 1 and lines["sugar_added"]["unknown_foods"] == 1
    assert lines["salt"]["target"] == 5 and lines["salt"]["sodium_mg"] == 443 and fd["totals"]["kcal"] == 499 and fd["targets"]["kcal"] == 2000


def test_the_food_days_lines_without_targets_and_on_an_empty_day(get):
    d = day()
    eat(d, "12:00", food("Test lentil soup"), 300, kcal=270, protein=18)
    fd = get("/food/day").json()["food_day"]
    assert [x["target"] for x in fd["lines"]] == [None] * 10 and [x["key"] for x in fd["lines"]][-1] == "caffeine_mg"
    assert fd["lines"][0]["value"] == 270 and next(x for x in fd["lines"] if x["key"] == "fibre")["unknown"] == 1
    yd = (d - timedelta(days=1)).isoformat()
    empty = get(f"/food/day?day={yd}").json()["food_day"]
    assert empty["rows"] == [] and empty["meals"] == [] and empty["lines"] == get(f"/food/nutrients?day={yd}").json()["food_nutrients"]["nutrients"]
    assert all(x["value"] == 0 and x["unknown"] == 0 for x in empty["lines"])


def test_todays_rows_do_not_grow():
    d = day()
    eat(d, "12:00", food("Test lentil soup"), 300, kcal=270, protein=18)
    (row,) = [r for r in reads.day()["rows"] if r["kind"] == "food"]
    assert "values" not in row and set(row["nutrients"]) == {"kcal", "protein", "fat", "carbs"}


def test_an_entry_has_its_values_and_the_foods_values_per_100(get):
    oats = food("Test oat flakes", kcal=372, protein=13.5, fat=7, carbs=58.7, fibre=10, sodium_mg=5)  # sugar unknown in the catalogue
    eid = eat(day(), "08:00", oats, 60, kcal=223, protein=8.1, fat=4.2, carbs=35.2, fibre=6, sodium_mg=3)
    e = get(f"/food/entry?ref=f{eid}").json()["entry"]
    assert e["values"]["kcal"] == 223 and e["values"]["fibre"] == 6 and e["values"]["sugar_total"] is None and e["values"]["salt"] == 0.01
    assert e["per_100"]["kcal"] == 372 and e["per_100"]["salt"] == 0.01 and e["per_100"]["sodium_mg"] == 5 and e["per_100"]["sugar_total"] is None
    assert set(e["per_100"]) == set(e["values"]) and e["units"][0] == {"unit": "g", "in_basis": 1}


def test_a_saves_answer_carries_the_wider_food_day(post):
    d = day()
    eid = eat(d, "08:00", food("Test oat flakes"), 60, kcal=223, fibre=6)
    a = post("/food/entry", ref=f"f{eid}", action="save", amount=90, view="food").json()
    fd = a["food_day"]
    assert a["outcome"] == "changed" and fd["rows"][0]["values"]["kcal"] is not None and "unknown" in fd["meals"][0]
    assert [x["key"] for x in fd["lines"]][:2] == ["kcal", "protein"] and len(fd["lines"]) == 10

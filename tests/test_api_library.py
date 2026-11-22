"""The JSON door's Library: the food catalogue (deploy 104, 17.11.2026; step 5 of the move to logger.): GET /api/v1/food/catalogue and
/food/item, POST /api/v1/food/catalogue/<action> for each of the Catalogue's six forms (values, words, barcode, basics, unit, reviewed),
each through app.'s own function (foodpage.catalogue_data, food_data; webfood.values, words, barcode, basics, unit_add, reviewed), and
a new food by /lookup with its yes through /answer, answered with the fresh Catalogue. The AI and Open Food Facts are fakes (no
network). Every food, barcode and number is invented."""
import html

import pytest

from app import api, foodpage, reads, webfood
from conftest import owner_sql
from test_api_door import NOT_FOUND, door, door_on, signed_in  # noqa: F401 - door_on is autouse
from test_api_saves import KEYS, Door, n  # noqa: F401
from test_log import OAT, fake, off  # noqa: F401 - the AI is a fake; off: a fake Open Food Facts
from test_webtoday import raw

# The sample file's names (front/tests/samples/catalogue.json); the tests use "Zz <key>"
PLAIN = {"oats": "Oat flakes", "skyr": "Skyr", "oatdrink": "Oat drink", "tea": "Green tea", "rye": "Rye bread", "apple": "Apple",
         "soup": "Lentil soup", "choc": "Dark chocolate", "banana": "Banana", "espresso": "Espresso", "walnuts": "Walnuts", "rice": "Rice",
         "crisps": "Crisps", "bowl": "Morning bowl"}


def add_food(name, basis="g", kcal=100, protein=1, fat=1, carbs=1, drink=False, review=None, days_old=100, aliases=(), barcode=None,
             active=True, source="database", **extra):
    cols = {"name": name, "basis": basis, "kcal": kcal, "protein": protein, "fat": fat, "carbs": carbs, "is_drink": drink,
            "needs_review": review is not None, "review_reason": review, "aliases": list(aliases), "barcode": barcode, "active": active,
            "source": source, **extra}
    ks = list(cols)
    return owner_sql(f"""INSERT INTO foods ({", ".join(ks)}, created_at) VALUES ({", ".join(["%s"] * len(ks))},
                         date_trunc('day', now()) - make_interval(days => %s) + interval '9 hours') RETURNING id""",
                     *[cols[k] for k in ks], days_old)[0]["id"]


def eaten(fid, days_ago, amount=100, kcal=1.0, drink=False, rid=None):
    """An entry so many days ago, with its own stored values (the past values a correction may rewrite)."""
    return owner_sql("""INSERT INTO food_entries (raw_id, food_id, amount, eaten_at, time_known, day, day_rule, extractor_version, kcal, protein,
                        fat, carbs, source, meal, is_drink) VALUES (%s, %s, %s, now() - make_interval(days => %s), true, log_day(now()) - %s,
                        'wake', 'test', %s, 1, 1, 1, 'label', %s, %s) RETURNING id""",
                     rid or raw(), fid, amount, days_ago, days_ago, kcal, 0 if drink else 1, drink)[0]["id"]


def invented(plain=False) -> dict:
    """14 foods: a drink with units and a barcode, one that needs review, one hidden, a recipe food, foods eaten often, rarely or never,
    added lately or long ago. -> the ids by key."""
    nm = (lambda k: PLAIN[k]) if plain else (lambda k: f"Zz {k}")
    x = {"oats": add_food(nm("oats"), kcal=372, protein=13.5, fat=7, carbs=58.7, aliases=("porridge",), barcode="4000000000017", days_old=200,
                          source="label", brand="Zz Mill", source_note="per the pack", fibre=10, sat_fat=1.2, sugar_total=0.7),
         "skyr": add_food(nm("skyr"), kcal=63, protein=11, fat=0.2, carbs=4, aliases=("quark",), days_old=150),
         "oatdrink": add_food(nm("oatdrink"), "ml", 46, 0.3, 1.5, 7.8, drink=True, barcode="4000000000024", days_old=5, sugar_total=4.1),
         "tea": add_food(nm("tea"), "ml", 1, 0, 0, 0.2, drink=True, aliases=("cuppa",), days_old=30, caffeine_mg=12),
         "rye": add_food(nm("rye"), kcal=210, protein=6.5, fat=1.2, carbs=39, review="values from an estimate", aliases=("bread",), days_old=3,
                         sodium_mg=480),
         "apple": add_food(nm("apple"), kcal=52, protein=0.3, fat=0.2, carbs=13.8, days_old=400, fibre=2.4),
         "soup": add_food(nm("soup"), kcal=88.5, protein=5.4, fat=2, carbs=12, review="the brand is unknown", days_old=1),
         "choc": add_food(nm("choc"), kcal=546, protein=7.8, fat=31, carbs=46, days_old=90, sugar_total=24, sugar_added=24),
         "banana": add_food(nm("banana"), kcal=89, protein=1.1, fat=0.3, carbs=22.8, days_old=60),
         "espresso": add_food(nm("espresso"), "ml", 2, 0.1, 0.2, 0, drink=True, days_old=10, caffeine_mg=212),
         "walnuts": add_food(nm("walnuts"), kcal=654, protein=15.2, fat=65, carbs=13.7, days_old=700),
         "rice": add_food(nm("rice"), kcal=130, protein=2.7, fat=0.3, carbs=28, days_old=365),
         "crisps": add_food(nm("crisps"), kcal=536, protein=6, fat=35, carbs=50, days_old=20, active=False),
         "bowl": add_food(nm("bowl"), kcal=120, protein=8, fat=3, carbs=15, days_old=12, source="calculated")}
    owner_sql("INSERT INTO food_units (food_id, unit, grams) VALUES (%s, 'cup', 240), (%s, 'slice', 35), (%s, 'piece', 120)",
              x["oatdrink"], x["rye"], x["apple"])
    owner_sql("INSERT INTO recipes (name, food_id, finished_weight_g) VALUES (%s, %s, 400)", nm("bowl"), x["bowl"])
    rid = raw()
    for key, days in (("oats", (1, 2, 3, 5, 8)), ("skyr", (1, 4)), ("oatdrink", (2, 3)), ("tea", (0, 1, 2, 3, 4, 5)), ("apple", (100,)),
                      ("banana", (31,)), ("espresso", (0, 1)), ("crisps", (3,)), ("bowl", (2,))):
        for d in days:
            eaten(x[key], d, drink=key in ("oatdrink", "tea", "espresso"), rid=rid)
    return x


@pytest.fixture
def sv():
    return Door()


def get(sv, path, status=200):
    r = sv.c.get("/api/v1" + path, headers=sv.h)
    assert r.status_code == status, r.text
    assert r.json()["v"] == 1
    return r.json()


def shaped(j):
    assert set(j) == KEYS | {"catalogue", "food_item"}, sorted(j)
    return j


def names(cat) -> list:
    return [r["name"] for r in cat["rows"]]


ROW = {"id", "ref", "name", "review", "drink", "aliases", "basis", "per_100", "per_100_text", "eaten", "last", "last_text", "added", "added_text"}
ITEM = {"id", "ref", "name", "basis", "source", "needs_review", "review_reason", "values", "aliases", "drink", "active", "units", "barcode",
        "eaten", "first", "last", "last_text", "added", "added_text", "recipe", "values_editable", "past", "words", "limits"}
CATALOGUE = {"q", "filter", "sort", "filters", "sorts", "limit", "more", "empty", "hint", "placeholder", "count", "rows"}


# ---- GET /food/catalogue -------------------------------------------------------------------------------------------------------------

def test_the_catalogue_is_app_s_list_as_data(sv, fake):
    x = invented()
    c = get(sv, "/food/catalogue")["catalogue"]
    assert set(c) == CATALOGUE and all(set(r) == ROW for r in c["rows"])
    assert (c["q"], c["filter"], c["sort"], c["count"], c["limit"], c["more"], c["empty"]) == ("", "all", "eaten", 13, 400, None, None)
    assert [f["key"] for f in c["filters"]] == ["all", "drinks", "new", "review"] and [f["on"] for f in c["filters"]] == [True, False, False, False]
    assert c["filters"][2]["label"] == "Added in the last 14 days" and len(c["sorts"]) == 8 and c["sorts"][0] == {"key": "eaten", "label": "Most eaten", "on": True}
    assert c["hint"] == "Sorted by: most eaten. Click a food to see and change it." and c["placeholder"] == "Search by name, word, N number or barcode"
    assert names(c)[:3] == ["Zz tea", "Zz oats", "Zz espresso"] and "Zz crisps" not in names(c)  # hidden: not listed
    oats = next(r for r in c["rows"] if r["id"] == x["oats"])
    assert oats["ref"] == f"N{x['oats']}" and oats["aliases"] == ["porridge"] and oats["basis"] == "g" and oats["eaten"] == 5
    assert oats["per_100"] == {"kcal": 372, "protein": 13.5, "fat": 7, "carbs": 58.7} and oats["per_100_text"]["carbs"] == "58.7"
    assert oats["last_text"] == foodpage.last_text(owner_sql("SELECT max(day) AS d FROM food_entries WHERE food_id = %s", x["oats"])[0]["d"])
    rye = next(r for r in c["rows"] if r["id"] == x["rye"])
    assert rye["review"] and not rye["drink"] and rye["last"] is None and rye["last_text"] == "–" and len(rye["added_text"]) == 8
    assert next(r for r in c["rows"] if r["id"] == x["tea"])["drink"]


def test_filters_orders_and_search(sv, fake):
    x = invented()
    assert names(get(sv, "/food/catalogue?f=drinks")["catalogue"]) == ["Zz tea", "Zz espresso", "Zz oatdrink"]
    assert set(names(get(sv, "/food/catalogue?f=review")["catalogue"])) == {"Zz rye", "Zz soup"}
    assert set(names(get(sv, "/food/catalogue?f=new")["catalogue"])) == {"Zz oatdrink", "Zz rye", "Zz soup", "Zz espresso", "Zz bowl"}
    c = get(sv, "/food/catalogue?s=name")["catalogue"]
    assert names(c) == sorted(names(c), key=str.lower) and c["hint"].startswith("Sorted by: name a to z.") and c["sorts"][-1]["on"]
    assert names(get(sv, "/food/catalogue?s=kcal")["catalogue"])[0] == "Zz walnuts"
    assert names(get(sv, "/food/catalogue?s=kcal_low&f=drinks")["catalogue"])[0] == "Zz tea"
    assert names(get(sv, "/food/catalogue?q=porridge")["catalogue"]) == ["Zz oats"]  # a word
    assert names(get(sv, "/food/catalogue?q=4000000000024")["catalogue"]) == ["Zz oatdrink"]  # a barcode
    assert names(get(sv, f"/food/catalogue?q=N{x['rice']}")["catalogue"]) == ["Zz rice"]
    none = get(sv, "/food/catalogue?q=zzqq-nothing")["catalogue"]
    assert none["rows"] == [] and none["count"] == 0 and none["empty"] == "No food matches."
    assert get(sv, "/food/catalogue?q=" + "a" * 80)["catalogue"]["q"] == "a" * 60


@pytest.mark.parametrize("query,why", [("f=hidden", "f must be all, drinks, new or review."),
                                       ("s=fat", "s must be eaten, recent, last, added, kcal, kcal_low, protein or name.")])
def test_a_bad_filter_or_order_is_a_400(sv, query, why):
    r = sv.c.get("/api/v1/food/catalogue?" + query, headers=sv.h)
    assert r.status_code == 400 and r.json() == {"v": 1, "error": "bad_request", "message": why}


def test_a_full_list_says_so(sv, fake, monkeypatch):
    invented()
    monkeypatch.setattr(foodpage, "LIST_LIMIT", 3)
    monkeypatch.setattr(foodpage, "MORE", "Showing the first 3; search to find others.")
    c = get(sv, "/food/catalogue")["catalogue"]
    assert c["count"] == 3 and c["more"] == "Showing the first 3; search to find others."


# ---- GET /food/item ------------------------------------------------------------------------------------------------------------------

def test_a_food_s_box(sv, fake):
    x = invented()
    a = get(sv, f"/food/item?id=N{x['oats']}")["food_item"]
    assert set(a) == ITEM and a == get(sv, f"/food/item?id={x['oats']}")["food_item"]
    assert a["source"]["text"].startswith("Source: label · Zz Mill · per the pack · added ") and a["source"]["text"].endswith(" · values per 100 g")
    assert "eaten 5 times, last " in a["source"]["text"] and (a["source"]["brand"], a["source"]["note"]) == ("Zz Mill", "per the pack")
    assert [v["key"] for v in a["values"]] == [k for k, _l in foodpage.NUT] and a["values"][1] == {"key": "protein", "label": "Protein g", "value": 13.5}
    assert {v["key"]: v["value"] for v in a["values"]}["sodium_mg"] is None  # unknown
    assert a["barcode"] == "4000000000017" and a["past"]["n"] == 5 and a["past"]["text"].startswith("Also recalculate the 5 past entries (")
    assert (a["recipe"], a["values_editable"], a["active"], a["drink"], a["needs_review"]) == (None, True, True, False, False)
    assert a["limits"] == {"name_min": 2, "name_max": 120, "word_max": 60, "words_max": 20, "unit_max": 30, "grams_max": 2000,
                           "barcode_min": 8, "barcode_max": 14}
    d = get(sv, f"/food/item?id={x['oatdrink']}")["food_item"]
    assert d["units"] == [{"unit": "cup", "grams": 240, "text": "1 cup = 240 ml"}] and d["drink"] and d["basis"] == "ml"
    r = get(sv, f"/food/item?id=n{x['rye']}")["food_item"]
    assert r["needs_review"] and r["review_reason"] == "values from an estimate" and r["past"] is None and r["last"] is None
    assert r["words"]["reviewed"] == "Looks right" and r["words"]["none"] == "none"
    b = get(sv, f"/food/item?id={x['bowl']}")["food_item"]
    assert b["recipe"].startswith("C") and not b["values_editable"]
    assert get(sv, f"/food/item?id={x['crisps']}")["food_item"]["active"] is False  # hidden: its box still reads


def test_a_food_that_is_not_there_or_not_an_id(sv):
    r = sv.c.get("/api/v1/food/item?id=N99999", headers=sv.h)
    assert r.status_code == 404 and r.json() == {"v": 1, "error": "no_entry", "message": "That food is not there any more."}
    for bad in ("", "abc", "N-1", "C12"):
        r = sv.c.get("/api/v1/food/item?id=" + bad, headers=sv.h)
        assert r.status_code == 400 and r.json()["message"] == "id must be a food's id (N12 or 12).", bad


# ---- POST /food/catalogue/values -------------------------------------------------------------------------------------------------------

def stored_kcal(fid):
    return [float(r["kcal"]) for r in owner_sql("SELECT kcal FROM food_entries WHERE food_id = %s ORDER BY id", fid)]


def test_values_are_shown_first_and_the_yes_saves_without_the_past(sv, fake):
    x = invented()
    first = shaped(sv.post("/food/catalogue/values", id=x["skyr"], kcal=70, fibre=0.5))
    assert first["outcome"] == "needs_confirmation" and first["confirm"] and first["read_back"] and first["undo"] is None
    assert n("SELECT count(*) AS n FROM foods WHERE id = %s AND kcal = 70", x["skyr"]) == 0
    done = shaped(sv.post("/food/catalogue/values", id=x["skyr"], kcal=70, fibre=0.5, confirmed=True, key="ignored"))
    assert done["outcome"] == "changed" and done["head"] == f"Changed N{x['skyr']} Zz skyr." and done["undo"] is None
    f = owner_sql("SELECT kcal, fibre FROM foods WHERE id = %s", x["skyr"])[0]
    assert (float(f["kcal"]), float(f["fibre"])) == (70, 0.5) and stored_kcal(x["skyr"]) == [1.0, 1.0]  # the past entries kept
    assert done["food_item"] is None and "Zz skyr" in names(done["catalogue"])  # no view_food: no box


def test_values_with_past_rewrite_the_past_entries(sv, fake):
    x = invented()
    j = shaped(sv.post("/food/catalogue/values", id=x["skyr"], kcal=80, past=True, view_food=x["skyr"]))
    assert j["outcome"] == "needs_confirmation" and stored_kcal(x["skyr"]) == [1.0, 1.0]
    j = shaped(sv.post("/food/catalogue/values", id=x["skyr"], kcal=80, past=True, confirmed=True, view_food=x["skyr"]))
    assert j["outcome"] == "changed" and stored_kcal(x["skyr"]) == [80.0, 80.0]  # 100 g each at 80 kcal per 100 g
    assert {v["key"]: v["value"] for v in j["food_item"]["values"]}["kcal"] == 80


def test_values_refusals_are_app_s(sv, fake):
    x = invented()
    j = shaped(sv.post("/food/catalogue/values", id=x["skyr"], kcal=-1))
    assert j["outcome"] == "rejected" and j["reason"] == "kcal: give a number of 0 or more."
    j = shaped(sv.post("/food/catalogue/values", id=x["skyr"], kcal=63, protein=11))
    assert j["outcome"] == "unchanged" and j["reason"] == "Nothing changed."
    assert shaped(sv.post("/food/catalogue/values", id=x["skyr"]))["reason"] == "Nothing changed."  # nothing sent = nothing changed
    assert shaped(sv.post("/food/catalogue/values", id=999999, kcal=5))["reason"] == "Unknown food."
    j = shaped(sv.post("/food/catalogue/values", id=x["bowl"], kcal=150))  # a recipe food: v1's change function says no
    assert j["outcome"] == "rejected" and "is calculated from recipe" in j["reason"]


# ---- words, barcode, basics, unit, reviewed --------------------------------------------------------------------------------------------

def aliases(fid):
    return owner_sql("SELECT aliases FROM foods WHERE id = %s", fid)[0]["aliases"]


def test_words_added_and_removed(sv, fake):
    x = invented()
    j = shaped(sv.post("/food/catalogue/words", id=x["rice"], act="add", word="  Basmati  ", key="k-1"))
    assert j["outcome"] == "changed" and j["head"] == f'"basmati" now means N{x["rice"]} Zz rice.' and aliases(x["rice"]) == ["basmati"]
    again = shaped(sv.post("/food/catalogue/words", id=x["rice"], act="add", word="basmati", key="k-1"))  # no key: not a replay
    assert not again["replayed"] and aliases(x["rice"]) == ["basmati"]
    j = shaped(sv.post("/food/catalogue/words", id=x["rice"], act="remove", word="basmati"))
    assert j["head"] == f'"basmati" no longer means N{x["rice"]} Zz rice.' and aliases(x["rice"]) == []


def test_a_word_may_not_shadow_another_food(sv, fake):
    x = invented()
    j = shaped(sv.post("/food/catalogue/words", id=x["rice"], act="add", word="Zz apple"))
    assert j["outcome"] == "rejected" and j["reason"].startswith(f"'zz apple' is the name of N{x['apple']} Zz apple: an alias must not shadow another food")
    j = shaped(sv.post("/food/catalogue/words", id=x["rice"], act="add", word="porridge"))
    assert j["outcome"] == "rejected" and j["reason"].startswith(f"'porridge' is already an alias of N{x['oats']} Zz oats")
    assert shaped(sv.post("/food/catalogue/words", id=x["rice"], act="add", word="123"))["reason"] == "Type a word first."
    assert shaped(sv.post("/food/catalogue/words", id=999999, act="add", word="x"))["reason"] == "Unknown food."
    assert aliases(x["rice"]) == []


def test_a_barcode(sv, fake):
    x = invented()
    assert shaped(sv.post("/food/catalogue/barcode", id=x["rice"], barcode="123"))["reason"] == "A barcode is 8 to 14 digits."
    j = shaped(sv.post("/food/catalogue/barcode", id=x["rice"], barcode="4000 0000 0003 1"))
    assert j["outcome"] == "changed" and owner_sql("SELECT barcode FROM foods WHERE id = %s", x["rice"])[0]["barcode"] == "4000000000031"
    assert shaped(sv.post("/food/catalogue/barcode", id=x["rice"], barcode="4000000000031"))["outcome"] == "unchanged"


def test_basics_rename_drink_and_hide(sv, fake):
    x = invented()
    j = shaped(sv.post("/food/catalogue/basics", id=x["rice"], name="Zz brown rice", view_food=x["rice"]))
    assert j["head"] == f'N{x["rice"]} Zz brown rice: name "Zz brown rice".' and j["food_item"]["name"] == "Zz brown rice"
    f = owner_sql("SELECT is_drink, active FROM foods WHERE id = %s", x["rice"])[0]
    assert (f["is_drink"], f["active"]) == (False, True)  # left out: as they were
    j = shaped(sv.post("/food/catalogue/basics", id=x["rice"], drink=True))
    assert j["head"] == f"N{x['rice']} Zz brown rice: a drink." and owner_sql("SELECT is_drink FROM foods WHERE id = %s", x["rice"])[0]["is_drink"]
    assert shaped(sv.post("/food/catalogue/basics", id=x["rice"], drink=True))["reason"] == "Nothing changed."
    assert shaped(sv.post("/food/catalogue/basics", id=x["rice"], name="Z"))["reason"] == "Give the food a name."
    assert shaped(sv.post("/food/catalogue/basics", id=x["rice"], name=None))["reason"] == "Give the food a name."  # null = empty


def test_hide_takes_the_food_out_of_the_catalogue(sv, fake):
    x = invented()
    j = shaped(sv.post("/food/catalogue/basics", id=x["apple"], hide=True, view_food=x["apple"], view_s="name"))
    assert j["outcome"] == "changed" and j["head"].endswith("hidden from the lists.")
    assert "Zz apple" not in names(j["catalogue"]) and j["food_item"] is None and j["catalogue"]["sort"] == "name"
    assert get(sv, f"/food/item?id={x['apple']}")["food_item"]["active"] is False
    j = shaped(sv.post("/food/catalogue/basics", id=x["apple"], hide=False, view_food=x["apple"]))
    assert j["head"].endswith("back in the lists.") and j["food_item"]["id"] == x["apple"]


def test_a_unit_is_added_and_changed(sv, fake):
    x = invented()
    j = shaped(sv.post("/food/catalogue/unit", id=x["rye"], unit="Thick slice", grams=50, view_food=x["rye"]))
    assert j["head"] == "1 thick slice of Zz rye = 50 g." and [u["text"] for u in j["food_item"]["units"]] == ["1 slice = 35 g", "1 thick slice = 50 g"]
    j = shaped(sv.post("/food/catalogue/unit", id=x["rye"], unit="slice", grams=40, view_food=x["rye"]))
    assert j["outcome"] == "changed" and [u["text"] for u in j["food_item"]["units"]] == ["1 slice = 40 g", "1 thick slice = 50 g"]
    assert shaped(sv.post("/food/catalogue/unit", id=x["rye"], unit="g", grams=5))["reason"] == "Name the unit, e.g. slice, piece, scoop or cup."
    assert shaped(sv.post("/food/catalogue/unit", id=x["rye"], unit="loaf", grams=3000))["reason"] == "Give its weight as a number above 0 and at most 2000 g."
    assert shaped(sv.post("/food/catalogue/unit", id=x["rye"], unit="loaf"))["reason"] == "Give its weight as a number above 0 and at most 2000 g."


def test_looks_right(sv, fake):
    x = invented()
    j = shaped(sv.post("/food/catalogue/reviewed", id=x["rye"], view_f="review"))
    assert j["head"] == f"Kept. N{x['rye']} Zz rye is no longer flagged." and names(j["catalogue"]) == ["Zz soup"]


# ---- the views, the checks ---------------------------------------------------------------------------------------------------------

def test_the_view_chooses_the_read(sv, fake):
    x = invented()
    j = shaped(sv.post("/food/catalogue/reviewed", id=x["rye"], view_q="zz r", view_f="all", view_s="name", view_food=f"N{x['rice']}"))
    assert j["catalogue"]["q"] == "zz r" and j["catalogue"]["sort"] == "name" and j["food_item"]["id"] == x["rice"]
    j = shaped(sv.post("/food/catalogue/reviewed", id=x["soup"], view_f="bogus", view_s="bogus"))
    assert (j["catalogue"]["filter"], j["catalogue"]["sort"], j["food_item"]) == ("all", "eaten", None)
    j = sv.post("/food/catalogue/barcode", id=x["rice"], barcode="40000000000048", view="day")
    assert set(j) == KEYS | {"day"}


@pytest.mark.parametrize("path,body,why", [
    ("/food/catalogue/values", {"id": "12", "kcal": 5}, "id must be a number."),
    ("/food/catalogue/values", {"id": 1, "kcal": "5"}, "kcal must be a number or null."),
    ("/food/catalogue/values", {"id": 1, "kcal": True}, "kcal must be a number or null."),
    ("/food/catalogue/values", {"id": 1, "kcal": 5, "past": "yes"}, "past must be true or false."),
    ("/food/catalogue/words", {"id": 1, "act": "rename", "word": "x"}, "act must be add or remove."),
    ("/food/catalogue/words", {"id": 1, "act": "add", "word": 5}, "word must be text or null."),
    ("/food/catalogue/words", {"id": 1, "act": "add", "word": "w" * 61}, "word must be 60 characters or fewer."),
    ("/food/catalogue/barcode", {"id": 1, "barcode": 4000000000017}, "barcode must be text or null."),
    ("/food/catalogue/basics", {"id": 1, "drink": "1"}, "drink must be true or false."),
    ("/food/catalogue/basics", {"id": 1, "name": "n" * 121}, "name must be 120 characters or fewer."),
    ("/food/catalogue/unit", {"id": 1, "unit": "cup", "grams": "35"}, "grams must be a number."),
    ("/food/catalogue/reviewed", {}, "id must be a number."),
])
def test_a_wrong_kind_of_field_is_a_400(sv, fake, path, body, why):
    invented()
    before = owner_sql("SELECT id, name, kcal, aliases, barcode, is_drink, needs_review FROM foods ORDER BY id")
    r = sv.raw(path, **body)
    assert r.status_code == 400 and r.json() == {"v": 1, "error": "bad_request", "message": why}
    assert owner_sql("SELECT id, name, kcal, aliases, barcode, is_drink, needs_review FROM foods ORDER BY id") == before


READS = ["/food/catalogue", "/food/item?id=1"]
NEW = [("GET", "/api/v1" + p, {}) for p in READS] + [("POST", f"/api/v1/food/catalogue/{a}", {"id": 1, "act": "add", "word": "zz"})
                                                      for a in api.CATALOGUE_FORMS]


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


def test_every_form_has_a_route_and_the_old_food_routes_are_as_they_were(sv, fake):
    assert set(api.CATALOGUE_FORMS) == {"values", "words", "barcode", "basics", "unit", "reviewed"}
    assert set(api.CATALOGUE_FORMS) < set(webfood.ACTIONS) | {"unit"}
    for path in ("/food/values", "/food/catalogue/lookup", "/food/catalogue/usualmeal"):
        assert sv.c.post("/api/v1" + path, headers=sv.h, json={}).status_code == 404, path
    assert sv.c.post("/api/v1/food/words", headers=sv.h, json={}).status_code == 405  # GET /food/words is the words review's read (core item 24)
    assert reads.catalogue and reads.food_item


# ---- a new food: /lookup, its yes through /answer ------------------------------------------------------------------------------------

def test_a_look_up_and_its_yes_answer_with_the_fresh_catalogue(sv, fake, off):
    invented()
    off.products[OAT["code"]] = OAT
    j = shaped(sv.post("/lookup", text=OAT["code"], view="catalogue", view_s="added"))
    assert j["outcome"] == "needs_confirmation" and j["catalogue"]["sort"] == "added" and j["catalogue"]["count"] == 13
    [q] = j["questions"]
    done = shaped(sv.post("/answer", question_id=q["id"], reply="yes", view="catalogue", view_s="added"))
    new = owner_sql("SELECT id, name FROM foods WHERE barcode = %s", OAT["code"])[0]
    assert done["outcome"] == "saved" and done["catalogue"]["count"] == 14 and done["catalogue"]["rows"][0]["id"] == new["id"]
    assert done["catalogue"]["rows"][0]["name"] == new["name"]


# ---- app.'s page ------------------------------------------------------------------------------------------------------------------

def test_app_s_catalogue_still_draws(fake, web):
    """app.'s Catalogue draws from the same data functions (checked byte for byte against the old code at deploy 104)."""
    x = invented()
    page = html.unescape(web[0].get(f"/web/food/catalogue?food=N{x['oats']}").text)
    assert "Zz oats" in page and "Also recalculate the 5 past entries" in page and "Source: label · Zz Mill · per the pack" in page
    assert "No food matches." in html.unescape(web[0].get("/web/food/catalogue?q=zzqq").text)
    page = html.unescape(web[0].get(f"/web/food/catalogue?food=N{x['oatdrink']}&f=drinks").text)
    assert "1 cup = 240 ml" in page


from test_web import web  # noqa: E402,F401 - the web app's signed-in client

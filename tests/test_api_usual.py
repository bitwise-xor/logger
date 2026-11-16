"""The JSON door's usual-meal editor (deploy 86, 16.11.2026; plan in the doc's Current tab, "editing usual meals at logger."):
GET /api/v1/usual and /foods, POST /usual/meal, /usual/new and /usual/from_meal, each through app.'s own function (webfood.usual_meal,
usual_create, usual_new), saved at once with Undo (webundo's usual-meal kind, also on app.), a name used twice refused in plain words,
and a re-sent key saving once. Every name, food and number is invented."""
import re

import pytest

from app import api, uiprefs
from conftest import owner_sql
from test_api_door import NOT_FOUND, door, door_on, signed_in  # noqa: F401 - door_on is autouse
from test_api_saves import KEYS, Door, clean_usual, got_undo, n  # noqa: F401 - clean_usual is autouse
from test_log import fake  # noqa: F401 - the AI is a fake (a usual-meal save never reaches it)
from test_web import act, web  # noqa: F401 - web: a signed-in app. session
from test_webfood import eat_on
from test_webtoday import day, food


@pytest.fixture
def sv():
    return Door()


def get(sv, path):
    r = sv.c.get("/api/v1" + path, headers=sv.h)
    assert r.status_code == 200, r.text
    assert r.json()["v"] == 1
    return r.json()


def shaped(j, view="usual"):
    assert set(j) == KEYS | {view}, sorted(j)
    return j


def foods():
    """Oats, skyr, milk and honey (per 100 g or ml)."""
    return {"oats": food("Test oats", 380, 13, 7, 60), "skyr": food("Test skyr", 63, 11, 0.2, 4),
            "milk": food("Test milk", 46, 3.4, 1.5, 4.8, drink=True), "honey": food("Test honey", 304, 0.3, 0, 82)}


def make(name, *items, drink=False):
    mid = owner_sql("INSERT INTO usual_meals (name, is_drink) VALUES (%s, %s) RETURNING id", name, drink)[0]["id"]
    for k, (fid, g) in enumerate(items, 1):
        owner_sql("INSERT INTO usual_meal_items (meal_id, food_id, grams, sort_order) VALUES (%s, %s, %s, %s)", mid, fid, g, k * 10)
    return mid


def items(mid):
    return [(r["name"], float(r["grams"])) for r in owner_sql("""SELECT f.name, i.grams FROM usual_meal_items i JOIN foods f ON f.id = i.food_id
                                                              WHERE i.meal_id = %s ORDER BY i.sort_order, i.id""", mid)]


def names():
    return [r["name"] for r in owner_sql("SELECT name FROM usual_meals ORDER BY id")]


@pytest.fixture
def bowl():
    f = foods()
    return f, make("Morning bowl", (f["oats"], 60), (f["skyr"], 150))


def undo(sv, j):
    return sv.post("/undo", token=got_undo(j)["token"], view="usual")


# ---- the reads ---------------------------------------------------------------------------------------------------------------

def test_the_list_has_every_usual_meal_by_name_with_its_foods(sv, bowl):
    f, mid = bowl
    cocoa_id = make("Cocoa", (f["milk"], 250), drink=True)
    uiprefs.save([f"usual:{cocoa_id}"], {})  # hidden from Today's chips
    assert [u["name"] for u in get(sv, "/day")["day"]["chips"]["usual"]] == ["Morning bowl"]
    j = get(sv, "/usual")
    assert set(j) == {"v", "usual", "undo"} and j["undo"] is None
    cocoa, bowl_ = j["usual"]  # by name, also one hidden from Today's chips
    assert (cocoa["name"], cocoa["drink"], bowl_["name"], bowl_["drink"]) == ("Cocoa", True, "Morning bowl", False)
    assert set(bowl_) == {"meal_id", "name", "drink", "nutrients", "items"} and bowl_["meal_id"] == mid
    oats, skyr = bowl_["items"]
    assert set(oats) == {"item_id", "food_id", "food", "amount", "unit", "nutrients"}
    assert (oats["food_id"], oats["food"], oats["amount"], oats["unit"]) == (f["oats"], "Test oats", 60, "g")
    assert oats["nutrients"] == {"kcal": 228, "protein": 7.8, "fat": 4.2, "carbs": 36} and skyr["nutrients"]["kcal"] == 94.5
    assert bowl_["nutrients"]["kcal"] == 322.5 and cocoa["items"][0]["unit"] == "ml"


def test_the_list_matches_the_chips_on_today(sv, bowl):
    chip = get(sv, "/day")["day"]["chips"]["usual"][0]
    meal = get(sv, "/usual")["usual"][0]
    assert chip["nutrients"] == meal["nutrients"] and [i["item_id"] for i in chip["items"]] == [i["item_id"] for i in meal["items"]]


def test_the_food_search_finds_by_name_word_and_number_up_to_20(sv):
    f = foods()
    owner_sql("UPDATE foods SET aliases = '{porridge}' WHERE id = %s", f["oats"])
    owner_sql("INSERT INTO foods (name, basis, kcal, protein, fat, carbs, source, active) VALUES ('Test oat bar', 'g', 400, 5, 9, 70, 'label', false)")
    found = get(sv, "/foods?q=oat")["foods"]
    assert [x["name"] for x in found] == ["Test oats"]  # a hidden food is not offered
    assert found[0] == {"food_id": f["oats"], "name": "Test oats", "unit": "g", "drink": False,
                        "per_100": {"kcal": 380, "protein": 13, "fat": 7, "carbs": 60}}
    assert [x["name"] for x in get(sv, "/foods?q=PORRIDGE")["foods"]] == ["Test oats"]
    assert [x["name"] for x in get(sv, f"/foods?q=N{f['milk']}")["foods"]] == ["Test milk"]
    assert get(sv, "/foods?q=nothing-like-it")["foods"] == []
    for k in range(25):
        food(f"Test bean {k:02}", 100, 7)
    assert len(get(sv, "/foods?q=bean")["foods"]) == 20 and len(get(sv, "/foods")["foods"]) == 20


# ---- changing a usual meal ----------------------------------------------------------------------------------------------------

def save(sv, mid, name="Morning bowl", rows=(), **kw):
    return sv.post("/usual/meal", meal_id=mid, action="save", name=name, items=[{"food_id": fid, "amount": g} for fid, g in rows],
                   confirmed=True, **kw)


def test_rename_amount_swap_remove_and_add_in_one_save_with_undo(sv, bowl):
    f, mid = bowl
    before = owner_sql("SELECT id FROM usual_meal_items WHERE meal_id = %s ORDER BY id", mid)
    j = shaped(save(sv, mid, "Big bowl", [(f["honey"], 15), (f["oats"], 80), (f["milk"], 200)], key="um-1"))
    assert j["outcome"] == "changed" and j["head"] == 'Changed the usual meal "Big bowl".' and j["tone"] == "ok"
    assert names() == ["Big bowl"] and items(mid) == [("Test honey", 15), ("Test oats", 80), ("Test milk", 200)]
    assert [i["food"] for i in j["usual"][0]["items"]] == ["Test honey", "Test oats", "Test milk"]  # the fresh list
    back = shaped(undo(sv, j))
    assert back["outcome"] == "changed" and back["head"] == 'Undone: the usual meal "Morning bowl" is back as it was.'
    assert names() == ["Morning bowl"] and items(mid) == [("Test oats", 60), ("Test skyr", 150)]
    assert owner_sql("SELECT id FROM usual_meal_items WHERE meal_id = %s ORDER BY id", mid) == before  # the same rows
    assert back["usual"][0]["items"][0]["amount"] == 60


def test_without_confirmed_the_change_is_read_back_first(sv, bowl):
    f, mid = bowl
    j = sv.post("/usual/meal", meal_id=mid, action="save", name="Morning bowl", items=[{"food_id": f["oats"], "amount": 70}])
    assert j["outcome"] == "needs_confirmation" and j["confirm"] and "Test oats: 60 → 70" in j["read_back"] and j["undo"] is None
    assert items(mid) == [("Test oats", 60), ("Test skyr", 150)]


def test_the_same_list_again_changes_nothing(sv, bowl):
    f, mid = bowl
    j = save(sv, mid, rows=[(f["oats"], 60), (f["skyr"], 150)])
    assert j["outcome"] == "unchanged" and j["reason"] == "Nothing changed."


def test_delete_with_undo_brings_back_the_meal_and_its_past_entries_links(sv, bowl):
    f, mid = bowl
    eid = eat_on(day(), "08:00", f["oats"], 60)
    owner_sql("UPDATE food_entries SET usual_meal_id = %s WHERE id = %s", mid, eid)
    j = shaped(sv.post("/usual/meal", meal_id=mid, action="delete", confirmed=True, key="del-1"))
    assert j["outcome"] == "changed" and j["head"] == 'Deleted the usual meal "Morning bowl". Past meals keep their values.'
    assert names() == [] and j["usual"] == [] and owner_sql("SELECT usual_meal_id FROM food_entries")[0]["usual_meal_id"] is None
    back = undo(sv, j)
    assert back["outcome"] == "changed" and names() == ["Morning bowl"] and items(mid) == [("Test oats", 60), ("Test skyr", 150)]
    assert owner_sql("SELECT usual_meal_id FROM food_entries WHERE id = %s", eid)[0]["usual_meal_id"] == mid
    assert get(sv, "/day")["day"]["rows"][0]["usual_meal"] == {"id": mid, "name": "Morning bowl"}


def test_refusals_say_why_and_change_nothing(sv, bowl):
    f, mid = bowl
    other = make("Evening bowl", (f["skyr"], 200))
    hidden = food("Test old cereal", 370, 8)
    owner_sql("UPDATE foods SET active = false WHERE id = %s", hidden)
    oats = (f["oats"], 60)
    for rows, name, why in (([(f["oats"], 0)], "Morning bowl", "Give every food an amount above 0 and at most 5000."),
                            ([(f["oats"], 6000)], "Morning bowl", "Give every food an amount above 0 and at most 5000."),
                            ([], "Morning bowl", "A usual meal needs at least one food. To remove it, use Delete."),
                            ([oats], "x", "Give the usual meal a name."),
                            ([(999999, 50)], "Morning bowl", "Pick each food from the catalogue (N999999 is not in it, or it is hidden)."),
                            ([(hidden, 50)], "Morning bowl", f"Pick each food from the catalogue (N{hidden} is not in it, or it is hidden)."),
                            ([oats], "Evening bowl", 'There is already a usual meal called "Evening bowl". Pick another name.'),
                            ([oats], "evening BOWL", 'There is already a usual meal called "Evening bowl". Pick another name.')):
        j = shaped(save(sv, mid, name, rows))
        assert (j["outcome"], j["tone"], j["reason"]) == ("rejected", "warning", why), (rows, name)
    gone = sv.post("/usual/meal", meal_id=999999, action="delete", confirmed=True)
    assert gone["reason"] == "That usual meal is not there any more."
    assert names() == ["Morning bowl", "Evening bowl"] and items(mid) == [("Test oats", 60), ("Test skyr", 150)] and items(other)
    j = save(sv, mid, "morning BOWL", [oats, (f["skyr"], 150)])  # its own name in another case is no clash
    assert j["outcome"] == "changed" and names()[0] == "morning BOWL"


@pytest.mark.parametrize("body", [{"action": "save", "items": "oats"}, {"action": "save", "items": [{"food_id": "1", "amount": 5}]},
                                  {"action": "save", "items": [{"food_id": 1, "amount": "5"}]}, {"action": "move"},
                                  {"action": "delete", "meal_id": "U1"}, {"action": "save", "items": [{"food_id": 1, "amount": 5}] * 41}])
def test_a_body_of_the_wrong_shape_is_a_bad_request(sv, body):
    r = sv.raw("/usual/meal", **{"meal_id": 1, **body})
    assert r.status_code == 400 and r.json()["error"] == "bad_request"


# ---- new usual meals --------------------------------------------------------------------------------------------------------

def test_a_new_usual_meal_from_foods_with_undo(sv):
    f = foods()
    j = shaped(sv.post("/usual/new", name="  Lunch  box ", drink=False, items=[{"food_id": f["skyr"], "amount": 200}, {"food_id": f["honey"], "amount": 12.5}],
                       key="new-1", confirmed=True))
    assert j["outcome"] == "changed" and j["head"].startswith('Saved "Lunch box" as a usual meal (2 items).')
    [m] = j["usual"]
    assert (m["name"], m["drink"], [i["amount"] for i in m["items"]]) == ("Lunch box", False, [200, 12.5])
    back = undo(sv, j)
    assert back["head"] == 'Undone: "Lunch box" is no longer a usual meal.' and names() == [] and back["usual"] == []
    drink = sv.post("/usual/new", name="Cocoa", drink=True, items=[{"food_id": f["milk"], "amount": 250}])
    assert drink["head"].startswith('Saved "Cocoa" as a usual drink (1 item).') and drink["usual"][0]["drink"] is True


def test_a_new_usual_meal_is_refused_in_plain_words(sv):
    f = foods()
    make("Lunch box", (f["skyr"], 100))
    one = [{"food_id": f["oats"], "amount": 50}]
    for body, why in (({"name": "LUNCH box", "items": one}, 'There is already a usual meal called "Lunch box". Pick another name.'),
                      ({"name": "x", "items": one}, "Give the usual meal a name."),
                      ({"name": "Snack", "items": []}, "Add at least one food with its amount."),
                      ({"name": "Snack", "items": [{"food_id": 999999, "amount": 5}]}, "Row 1: pick a food from the list"),
                      ({"name": "Snack", "items": [{"food_id": f["oats"], "amount": 0}]}, "Row 1: give an amount above 0 and at most 5000.")):
        j = shaped(sv.post("/usual/new", **body))
        assert j["outcome"] == "rejected" and j["reason"].startswith(why), (body, j["reason"])
    nine = sv.raw("/usual/new", name="Feast", items=one * 9)
    assert nine.status_code == 400 and nine.json()["message"] == "At most 8 foods."
    assert sv.raw("/usual/new", name="Feast", items=one, drink="yes").status_code == 400
    assert names() == ["Lunch box"]


def test_a_logged_meal_saved_as_a_usual_meal_with_undo(sv):
    f = foods()
    eat_on(day(), "08:00", f["oats"], 60)
    eat_on(day(), "08:05", f["skyr"], 150)
    j = shaped(sv.post("/usual/from_meal", day=day().isoformat(), meal=1, name="Usual breakfast", key="fm-1"), "food_day")
    assert j["outcome"] == "changed" and j["head"].startswith('Saved "Usual breakfast" as a usual meal (2 items).')
    assert j["food_day"]["day"] == day().isoformat() and got_undo(j)
    [mid] = [r["id"] for r in owner_sql("SELECT id FROM usual_meals")]
    assert items(mid) == [("Test oats", 60), ("Test skyr", 150)]
    for body, why in (({"meal": 1, "name": "usual BREAKFAST"}, 'There is already a usual meal called "Usual breakfast". Pick another name.'),
                      ({"meal": 0, "name": "Drinks"}, "Pick a meal: the day's drinks cannot be saved as a usual meal."),
                      ({"meal": 1, "name": "x"}, "Give the usual meal a name.")):
        r = sv.post("/usual/from_meal", day=day().isoformat(), **body)
        assert r["reason"] == why and got_undo(r)["token"] == j["undo"]["token"]  # a refusal keeps the Undo
    assert sv.post("/usual/from_meal", day="2000-01-01", meal=1, name="Old")["reason"] == "Unknown day."
    assert undo(sv, j)["outcome"] == "changed" and names() == []


# ---- once per key, the door's checks, Undo in a changed world -----------------------------------------------------------------

def test_a_resent_key_saves_once(sv):
    f = foods()
    body = dict(name="Lunch box", items=[{"food_id": f["skyr"], "amount": 200}], key="same-key-1")
    first = sv.post("/usual/new", **body)
    again = sv.post("/usual/new", **body)
    assert first["replayed"] is False and again["replayed"] is True and again["outcome"] == "changed"
    assert names() == ["Lunch box"] and again["undo"]["token"] == first["undo"]["token"]
    other = sv.post("/usual/new", **{**body, "name": "Other box"})
    assert other["outcome"] == "rejected" and other["reason"] == "This form was already used." and names() == ["Lunch box"]
    mid = first["usual"][0]["meal_id"]
    d1 = sv.post("/usual/meal", meal_id=mid, action="delete", confirmed=True, key="same-key-2")
    d2 = sv.post("/usual/meal", meal_id=mid, action="delete", confirmed=True, key="same-key-2")
    assert d1["outcome"] == d2["outcome"] == "changed" and d2["replayed"] and d2["undo"]["token"] == d1["undo"]["token"]


def test_undo_after_the_old_name_was_taken_says_so(sv, bowl):
    f, mid = bowl
    j = save(sv, mid, "Big bowl", [(f["oats"], 60)])
    make("Morning bowl", (f["skyr"], 10))
    back = undo(sv, j)
    assert back["outcome"] == "rejected" and "Another usual meal is called \"Morning bowl\" now." in back["reason"]
    assert items(mid) == [("Test oats", 60)]


def test_the_routes_are_behind_the_door(sv, bowl):
    f, mid = bowl
    for method, path in (("GET", "/usual"), ("GET", "/foods?q=oat"), ("POST", "/usual/meal"), ("POST", "/usual/new"),
                         ("POST", "/usual/from_meal")):
        signed_out = sv.c.request(method, "/api/v1" + path, json={})
        assert signed_out.status_code == 401 and signed_out.json()["error"] == "signed_out", path
        stranger = door(token="wrong-token").request(method, "/api/v1" + path, json={}, headers=sv.h)
        assert stranger.status_code == 404 and stranger.json() == NOT_FOUND, path


def test_the_door_off_hides_the_routes(sv, monkeypatch):
    monkeypatch.setattr(api, "FRONT_TOKEN", "")
    assert sv.c.get("/api/v1/usual", headers=sv.h).status_code == 404


# ---- app.'s own form gets the Undo bar too ---------------------------------------------------------------------------------------

def token(page):
    return re.search(r'action="/web/undo/last">.*?name="token" value="([^"]+)"', page)[1]


def test_apps_usual_meal_form_has_undo_after_a_change_a_delete_and_a_new_one(web, fake):
    f = foods()
    mid = make("test bowl", (f["oats"], 60))
    form = dict(id=f"U{mid}", rows="1", food_0=str(f["oats"]), g_0="80", name="test bowl", act="save")
    asked = act(web, "/web/food/usualmeal", **form)
    assert "please confirm" in asked.text and 'action="/web/undo/last"' not in asked.text  # app. still shows the change first
    done = act(web, "/web/food/usualmeal", **form, confirmed="1")
    assert items(mid) == [("Test oats", 80)] and 'action="/web/undo/last"' in done.text
    back = act(web, "/web/undo/last", token=token(done.text), back="/web/food/usual")
    assert "is back as it was" in back.text and items(mid) == [("Test oats", 60)]
    gone = act(web, "/web/food/usualmeal", id=f"U{mid}", act="delete", confirmed="1")
    assert names() == []
    act(web, "/web/undo/last", token=token(gone.text), back="/web/food/usual")
    assert names() == ["test bowl"] and items(mid) == [("Test oats", 60)]
    made = act(web, "/web/food/usualcreate", name="test box", kind="meal", food_0="Test skyr", g_0="100")
    assert names() == ["test bowl", "test box"]
    act(web, "/web/undo/last", token=token(made.text), back="/web/food/usual")
    assert names() == ["test bowl"]
    act(web, "/web/food/usualcreate", name="test box", kind="meal", food_0="Test skyr", g_0="100")
    clash = act(web, "/web/food/usualmeal", **{**form, "name": "TEST BOX"}, confirmed="1")
    assert "There is already a usual meal called &quot;test box&quot;. Pick another name." in clash.text
    assert "Something went wrong" not in clash.text and names() == ["test bowl", "test box"]

"""The JSON door's scanner, label photo and look-up (deploy 89, 16.11.2026; plan in the doc's Current tab, "Step 1 of the move:
daily gaps", 1a): GET /api/v1/foods/barcode and /foods/off, POST /food/label (one to three photos in one AI call), /food/labeladd
and /lookup, each through app.'s own function (webfood.scanned, off_values, labelread.read, label_add, look_up). The AI and Open
Food Facts are fakes (no network). Every name, food, barcode and number is invented."""
import json

import pytest

from app import api, labelread, logbook, webfood
from app.ai.provider import ProviderError, Usage
from conftest import owner_sql
from test_api_door import NOT_FOUND, door, door_on, signed_in  # noqa: F401 - door_on is autouse
from test_api_saves import KEYS, Door, got_undo, n  # noqa: F401
from test_label import GRANOLA
from test_log import OAT, fake, off  # noqa: F401 - the AI is a fake; off: a fake Open Food Facts
from test_web import ORIGIN, act, web  # noqa: F401 - web: a signed-in app. session
from test_webfood import eat_on
from test_webtoday import day, food, no_targets  # noqa: F401 - no_targets: clean targets and usual meals

JPEG, PNG = ("label.jpg", b"\xff\xd8 an invented jpeg", "image/jpeg"), ("table.png", b"\x89PNG an invented png", "image/png")
CODE = "4006040123456"


class Vision:
    """A fake AI that reads photos: records how many photos each call had."""

    def __init__(self, answer=None, fail=False):
        self.answer, self.fail, self.calls = answer or GRANOLA, fail, []

    def image_json(self, system, user, images, schema, model, max_tokens=2000):
        self.calls.append([mt for mt, _ in images])
        if self.fail:
            raise ProviderError("overloaded")
        return dict(self.answer), Usage(model, 1600, 120)


@pytest.fixture
def vision():
    v = Vision()
    logbook.PROVIDER = v
    yield v
    logbook.PROVIDER = None


@pytest.fixture
def sv():
    return Door()


def get(sv, path, status=200):
    r = sv.c.get("/api/v1" + path, headers=sv.h)
    assert r.status_code == status, r.text
    assert r.json()["v"] == 1
    return r.json()


def photos(sv, *files, status=200, **extra):
    r = sv.c.post("/api/v1/food/label", headers=sv.h, files=[("photo", f) for f in files], data=extra or None)
    assert r.status_code == status, r.text
    assert r.json()["v"] == 1
    return r.json()


def shaped(j, view="day"):
    assert set(j) == KEYS | {view}, sorted(j)
    return j


def catalogue():
    return owner_sql("SELECT name, basis, kcal, barcode, source FROM foods ORDER BY id")


GRANOLA_FORM = dict(name="Test crunchy granola", basis="g", kcal=452, protein=9.5, fat=17.8, carbs=61.2, sat_fat=3.1, fibre=6.4, salt_g=0.3)


# ---- the barcode -----------------------------------------------------------------------------------------------------------

def test_a_barcode_finds_the_catalogue_food_with_the_amount_eaten_last(sv):
    fid = food("Test crispbread", 360, 10)
    owner_sql("UPDATE foods SET barcode = %s WHERE id = %s", CODE, fid)
    assert get(sv, f"/foods/barcode?code={CODE}") == {"v": 1, "code": CODE,
                                                       "food": {"food_id": fid, "name": "Test crispbread", "unit": "g", "amount": 100.0}}
    eat_on(day(), "08:00", fid, 45)
    j = get(sv, "/foods/barcode?code=4006 0401 23456")  # spaces are left out
    assert j["food"]["amount"] == 45.0
    assert webfood.scanned(CODE)["food"]["id"] == fid  # the same function as app.'s scanner
    assert sv.c.get(f"/web/foods/barcode.json?code={CODE}").status_code == 404  # app.'s route needs app.'s session


def test_a_upc_a_code_finds_its_ean_13_and_an_unknown_code_finds_nothing(sv):
    fid = food("Test peanut butter", 600, 25)
    owner_sql("UPDATE foods SET barcode = '0012345678905' WHERE id = %s", fid)
    assert get(sv, "/foods/barcode?code=012345678905")["food"]["food_id"] == fid
    assert get(sv, "/foods/barcode?code=40000000") == {"v": 1, "code": "40000000", "food": None}
    owner_sql("UPDATE foods SET active = false WHERE id = %s", fid)
    assert get(sv, "/foods/barcode?code=0012345678905")["food"] is None  # only active foods


@pytest.mark.parametrize("code", ["", "1234567", "123456789012345", "40060401234ab", "4006040.12345"])
def test_a_code_that_is_not_8_to_14_digits_is_a_bad_request(sv, code):
    for path in ("/foods/barcode", "/foods/off"):
        j = get(sv, f"{path}?code={code}", status=400)
        assert j["error"] == "bad_request" and j["message"] == "A barcode is 8 to 14 digits."


# ---- Open Food Facts ----------------------------------------------------------------------------------------------------------

def test_open_food_facts_values_come_to_check_and_nothing_is_saved(sv, off):
    off.products["4012345678901"] = {"product_name": "Test oat drink", "brands": "Testmarke", "quantity": "1 l",
                                     "nutriments": {"energy-kcal_100g": 46, "proteins_100g": 1, "fat_100g": 1.5,
                                                    "carbohydrates_100g": 6.6, "salt_100g": 0.1}}
    j = get(sv, "/foods/off?code=4012345678901")
    assert j == {"v": 1, **webfood.off_values("4012345678901")}
    assert j["ok"] and j["name"] == "Test oat drink" and j["brand"] == "Testmarke" and j["basis"] == "ml"
    assert j["values"]["kcal"] == 46 and j["values"]["salt_g"] == 0.1 and j["values"]["fibre"] is None
    assert set(j["values"]) == {"kcal", "protein", "fat", "carbs", "sat_fat", "sugar_total", "fibre", "salt_g"}
    miss = get(sv, "/foods/off?code=4000000000000")
    assert miss == {"v": 1, "ok": False, "reason": "Barcode 4000000000000 is not in Open Food Facts. Take a photo of the label instead."}
    assert catalogue() == []


# ---- the label photo ---------------------------------------------------------------------------------------------------------

def test_one_photo_is_read_and_the_cost_is_logged_without_the_photo(sv, vision):
    j = photos(sv, JPEG)
    assert j["ok"] and j["name"] == "Crunchy Granola" and j["brand"] == "Testmarke" and j["basis"] == "g" and j["note"] is None
    assert j["values"]["kcal"] == 452 and j["values"]["salt_g"] == 0.3 and vision.calls == [["image/jpeg"]]
    [a] = owner_sql("SELECT outcome, detail FROM audit_log WHERE tool = 'label_photo'")
    assert a["outcome"] == "read" and a["detail"]["photos"] == 1 and "invented" not in json.dumps(a["detail"])
    assert catalogue() == []  # nothing saved by reading


def test_two_photos_reach_the_ai_in_one_call(sv, vision):
    j = photos(sv, JPEG, PNG)
    assert j["ok"] and vision.calls == [["image/jpeg", "image/png"]]
    assert owner_sql("SELECT detail FROM audit_log WHERE tool = 'label_photo'")[0]["detail"]["photos"] == 2
    photos(sv, JPEG, PNG, ("x.webp", b"RIFF an invented webp", "image/webp"))
    assert vision.calls[-1] == ["image/jpeg", "image/png", "image/webp"]


def test_an_unreadable_label_and_an_ai_that_does_not_answer_say_why(sv, vision):
    vision.answer = {**{k: None for k in GRANOLA}, "readable": False, "basis": "g", "note": "The table is cut off."}
    j = photos(sv, JPEG)
    assert j["ok"] is False and "The table is cut off." in j["reason"] and set(j) == {"v", "ok", "reason"}
    vision.fail = True
    assert "could not read it" in photos(sv, JPEG)["reason"]


def test_the_photo_refusals(sv, vision):
    big = ("big.jpg", b"\xff" * (labelread.MAX_BYTES + 1), "image/jpeg")
    assert photos(sv, big, status=413) == {"v": 1, "error": "too_large", "message": "A photo is too large: at most 8 MB each, 3 photos."}
    j = photos(sv, JPEG, JPEG, JPEG, JPEG, status=400)
    assert j["error"] == "bad_request" and j["message"] == "At most 3 photos."
    assert photos(sv, ("doc.pdf", b"%PDF invented", "application/pdf"), status=400)["message"] == "A photo must be JPEG, PNG, WebP or GIF."
    assert photos(sv, ("empty.jpg", b"", "image/jpeg"), status=400)["message"] == "A photo is empty."
    r = sv.c.post("/api/v1/food/label", headers=sv.h, data={"note": "no photo"}, files=[("other", JPEG)])
    assert r.status_code == 400 and r.json()["message"] == "No photo came with the request."
    r = sv.c.post("/api/v1/food/label", headers=sv.h, data={"photo": "not a file"})
    assert r.status_code == 400 and r.json()["error"] == "bad_request"
    r = sv.c.post("/api/v1/food/label", headers=sv.h, json={"photo": "x"})
    assert r.status_code == 400 and "multipart" in r.json()["message"]
    assert vision.calls == []  # none of them reached the AI


def test_a_body_larger_than_three_photos_is_cut_off_while_it_is_read(sv, vision, monkeypatch):
    monkeypatch.setattr(api, "MAX_PHOTO_BODY", 1000)
    j = photos(sv, ("a.jpg", b"\xff" * 2000, "image/jpeg"), status=413)
    assert j["error"] == "too_large" and vision.calls == []
    r = sv.c.post("/api/v1/food/label", headers={**sv.h, "Content-Length": "99999999", "Content-Type": "multipart/form-data; boundary=x"},
                  content=b"--x--")
    assert r.status_code == 413


def test_the_label_route_only_is_exempt_from_the_json_cap(sv, vision):
    """The 64 KB cap stays on every JSON route: a photo of more than 64 KB is fine here, a JSON body of that size elsewhere is not."""
    j = photos(sv, ("a.jpg", b"\xff" * (api.MAX_BODY + 10), "image/jpeg"))
    assert j["ok"]
    r = sv.c.post("/api/v1/food/labeladd", headers=sv.h, json={"name": "x" * (api.MAX_BODY + 10)})
    assert r.status_code == 413 and r.json()["error"] == "too_large"


# ---- the door's checks on every new route -------------------------------------------------------------------------------------

NEW = [("GET", f"/api/v1/foods/barcode?code={CODE}"), ("GET", f"/api/v1/foods/off?code={CODE}"), ("POST", "/api/v1/food/label"),
       ("POST", "/api/v1/food/labeladd"), ("POST", "/api/v1/lookup")]


@pytest.mark.parametrize("method,path", NEW)
def test_signed_out_and_door_off(method, path, monkeypatch, vision):
    c, bearer, _ = signed_in()
    kw = {"files": [("photo", JPEG)]} if path.endswith("/label") else {}
    r = c.request(method, path, **kw)  # no session
    assert r.status_code == 401 and r.json()["error"] == "signed_out"
    r = door(token="w" * 40).request(method, path, headers=bearer, **kw)  # a wrong service token
    assert r.status_code == 404 and r.json() == NOT_FOUND
    monkeypatch.setattr(api, "FRONT_TOKEN", "")
    r = c.request(method, path, headers=bearer, **kw)
    assert r.status_code == 404 and r.json() == NOT_FOUND
    assert vision.calls == []


# ---- adding the checked values ----------------------------------------------------------------------------------------------------

def test_the_checked_values_add_the_food_and_an_amount_logs_it_with_undo(sv, fake):
    j = shaped(sv.post("/food/labeladd", **GRANOLA_FORM, barcode=CODE, amount=45, time="08:30", key="lbl-door-1"))
    assert j["outcome"] == "saved" and j["head"].startswith("Added Test crunchy granola to your catalogue.") and j["tone"] == "ok"
    assert catalogue() == [{"name": "Test crunchy granola", "basis": "g", "kcal": 452, "barcode": CODE, "source": "label"}]
    assert [r["food"] for r in j["day"]["rows"]] == ["Test crunchy granola"] and fake.calls == []
    u = got_undo(j)
    again = shaped(sv.post("/food/labeladd", **GRANOLA_FORM, barcode=CODE, amount=45, time="08:30", key="lbl-door-1"))
    assert again["replayed"] and again["undo"] == u and len(catalogue()) == 1 and n("SELECT count(*) AS n FROM food_entries") == 1
    back = shaped(sv.post("/undo", token=u["token"]))
    assert back["outcome"] == "changed" and n("SELECT count(*) AS n FROM food_entries") == 0
    assert len(catalogue()) == 1  # Undo takes back the logged entry; the catalogue food stays
    assert get(sv, f"/foods/barcode?code={CODE}")["food"]["name"] == "Test crunchy granola"


def test_without_an_amount_the_food_is_only_added_and_a_resend_adds_it_once(sv, fake):
    j = shaped(sv.post("/food/labeladd", **GRANOLA_FORM, key="lbl-door-2"))
    assert j["outcome"] == "changed" and "Scan it again" in j["head"] and j["undo"] is None
    again = shaped(sv.post("/food/labeladd", **GRANOLA_FORM, key="lbl-door-2"))
    assert again["replayed"] and len(catalogue()) == 1 and n("SELECT count(*) AS n FROM food_entries") == 0
    other = shaped(sv.post("/food/labeladd", **{**GRANOLA_FORM, "kcal": 450}, key="lbl-door-2"))
    assert other["outcome"] == "rejected" and other["reason"] == "This form was already used." and len(catalogue()) == 1


def test_open_food_facts_values_a_drink_and_zero_values(sv, fake):
    j = shaped(sv.post("/food/labeladd", name="Test sparkling water", basis="ml", kcal=0, protein=0, fat=0, carbs=0, source="off",
                       barcode="4012345678901", amount=330, key="lbl-door-3"))
    assert j["outcome"] == "saved"
    f = owner_sql("SELECT basis, is_drink, source, source_note FROM foods")[0]
    assert (f["basis"], f["is_drink"], f["source"]) == ("ml", True, "database") and f["source_note"].startswith("Open Food Facts")


def test_missing_or_impossible_values_add_nothing(sv, fake):
    j = shaped(sv.post("/food/labeladd", **{**GRANOLA_FORM, "protein": None}, key="lbl-door-4"))
    assert j["outcome"] == "rejected" and j["reason"] == "Protein per 100 g is missing or not a number."
    j = shaped(sv.post("/food/labeladd", name="Test impossible", kcal=100, protein=90, fat=90, carbs=90, key="lbl-door-5"))
    assert j["outcome"] == "rejected" and j["reason"]
    j = shaped(sv.post("/food/labeladd", **GRANOLA_FORM, amount=9000, key="lbl-door-6"))  # the food is added, the amount refused
    assert j["outcome"] == "rejected" and "at most 5000" in j["reason"] and len(catalogue()) == 1
    assert shaped(sv.post("/food/labeladd", **GRANOLA_FORM, amount=9000, key="lbl-door-6"))["replayed"] and len(catalogue()) == 1
    assert n("SELECT count(*) AS n FROM food_entries") == 0


@pytest.mark.parametrize("body,message", [({"kcal": "452"}, "kcal must be a number."), ({"amount": True}, "amount must be a number."),
                                          ({"basis": "kg"}, "basis must be g or ml."), ({"source": "web"}, "source must be label or off.")])
def test_a_wrong_field_is_a_bad_request(sv, body, message):
    r = sv.raw("/food/labeladd", **{**GRANOLA_FORM, **body})
    assert r.status_code == 400 and r.json()["message"] == message and catalogue() == []


# ---- the look-up ----------------------------------------------------------------------------------------------------------------

def test_a_barcode_is_looked_up_read_back_and_a_yes_through_answer_adds_it(sv, fake, off):
    off.products[OAT["code"]] = OAT
    j = shaped(sv.post("/lookup", text="2200 2630 20656"))
    assert j["outcome"] == "needs_confirmation" and j["tone"] == "warning" and "61 kcal" in j["read_back"] and catalogue() == []
    [q] = j["questions"]
    assert q["tool"] == "lookup_confirm" and q["text"] == "Add this food?" and [a["reply"] for a in q["answers"]] == ["yes", "no"]
    assert "Show the user" not in json.dumps(j)
    done = shaped(sv.post("/answer", question_id=q["id"], reply="yes"))
    assert done["outcome"] == "saved" and owner_sql("SELECT barcode FROM foods")[0]["barcode"] == OAT["code"]
    known = shaped(sv.post("/lookup", text=OAT["code"]))
    assert known["outcome"] == "saved" and "already has N" in " ".join(known["receipt"])


def test_a_no_adds_nothing(sv, fake, off):
    off.products[OAT["code"]] = OAT
    [q] = sv.post("/lookup", text=OAT["code"])["questions"]
    assert shaped(sv.post("/answer", question_id=q["id"], reply="no"))["outcome"] == "cancelled" and catalogue() == []


def test_a_name_is_looked_up_in_usda(sv, fake, off):
    j = shaped(sv.post("/lookup", text="coconut"))
    assert j["outcome"] == "needs_confirmation" and "Nuts, coconut meat, raw" in j["read_back"]
    shaped(sv.post("/answer", question_id=j["questions"][0]["id"], reply="yes"))
    assert [f["name"] for f in catalogue()] == ["Coconut meat, raw"]


def test_a_questions_look_up_logs_its_waiting_item_after_the_yes(sv, fake, off):
    off.products[OAT["code"]] = OAT
    asked = shaped(sv.post("/log", text="30 g zzqfood", key="lu-1"))
    [q] = [q for q in asked["questions"] if q["kind"] == "food"]
    found = shaped(sv.post("/lookup", text=OAT["code"], question_id=q["id"]))
    assert found["outcome"] == "needs_confirmation"
    shaped(sv.post("/answer", question_id=found["questions"][0]["id"], reply="yes"))
    assert [(r["food"], r["amount"]) for r in get(sv, "/day")["day"]["rows"]] == [("Oat drink (BioPrimo)", 30)]


def test_a_look_up_without_words_takes_the_questions_word_or_says_what_to_type(sv, fake, off):
    j = shaped(sv.post("/lookup"))
    assert j["outcome"] == "rejected" and j["reason"] == "Type the food's name or barcode first."
    asked = shaped(sv.post("/log", text="30 g zzqfood", key="lu-2"))
    [q] = [q for q in asked["questions"] if q["kind"] == "food"]
    j = shaped(sv.post("/lookup", question_id=q["id"]))  # zzqfood: nothing found anywhere
    assert j["outcome"] == "rejected" and "nothing fitting found" in j["reason"]
    j = shaped(sv.post("/lookup", text="coconut", question_id="p00000000"))
    assert j["outcome"] == "rejected" and "no open food question" in j["reason"]


def test_app_s_look_up_button_goes_through_the_same_function(web, fake, off, monkeypatch):
    seen = []
    monkeypatch.setattr(webfood, "look_up", lambda words, qid="": seen.append((words, qid)) or {"outcome": "rejected", "reason": "x"})
    act(web, "/web/lookup", reply="coconut", question_id="p1234")
    assert seen == [("coconut", "p1234")]

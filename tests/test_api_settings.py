"""The JSON door's Settings (deploy 110, 17.11.2026; step 6 of the move to logger.): GET /api/v1/settings/targets, today, body, coach,
devices, export, and their saves through app.'s own functions (websettings.targets, today, today_reset, height, body_settings, device,
others; coach.goals_set) with their checks and words; POST /api/v1/export answers the ZIP itself; GET /day's shown. No key, no Undo, as
app.'s Settings. Notifications are tests/test_api_push.py. Every name, number and sentence is invented."""
import io
import json
import zipfile
from datetime import date

import pytest

from app import api, auth, export, reads, uiprefs
from conftest import owner_sql
from test_api_door import door, door_on, fresh_code, signed_in  # noqa: F401 - door_on is autouse
from test_api_saves import KEYS, Door, n
from test_export import GRATITUDE_WORDS, PRIVATE_WORDS, _seed, _zip
from test_web import ORIGIN, act, web  # noqa: F401 - web: a signed-in app. session (fixture)


@pytest.fixture(autouse=True)
def settings_clean():
    """ui_settings and body_height are emptied by conftest; food targets and usual meals are not. The habit rows stay as they were."""
    keep = owner_sql("SELECT name, label, sort_order, active FROM log_types WHERE on_checklist")
    owner_sql("DELETE FROM food_targets")
    owner_sql("TRUNCATE usual_meals CASCADE")
    yield
    owner_sql("DELETE FROM food_targets")
    owner_sql("TRUNCATE usual_meals CASCADE")
    for r in keep:
        owner_sql("UPDATE log_types SET label = %s, sort_order = %s, active = %s WHERE name = %s", r["label"], r["sort_order"], r["active"], r["name"])


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
    assert j["undo"] is None and j["replayed"] is False
    return j


def refused(sv, path, why, **body):
    r = sv.raw(path, **body)
    assert r.status_code == 400 and r.json() == {"v": 1, "error": "bad_request", "message": why}, r.text


def today():
    return date.fromisoformat(reads.settings_targets()["valid_from"])


def stored(key):
    rows = owner_sql("SELECT value FROM ui_settings WHERE key = %s", key)
    return rows[0]["value"] if rows else None


# ---- Food targets --------------------------------------------------------------------------------------------------------------------

def test_targets_read_with_none_and_with_history(sv):
    t = get(sv, "/settings/targets")["settings_targets"]
    assert t["current"] is None and t["history"] == [] and t["valid_from"] == today().isoformat()
    assert [(f["key"], f["label"], f["unit"], f["value"]) for f in t["fields"]][:2] == [("kcal", "Calories", "kcal", None), ("protein", "Protein", "g", None)]
    assert len(t["fields"]) == 9 and t["fields"][-1]["key"] == "water_ml" and t["limits"] == {"min": 0, "max": 100000, "note_max": 200}
    owner_sql("INSERT INTO food_targets (valid_from, kcal, protein, water_ml, note) VALUES ('2020-01-01', 2100, 140.5, 3000, 'zz first'), ('2099-01-01', 1500, NULL, NULL, NULL)")
    t = get(sv, "/settings/targets")["settings_targets"]
    assert t["current"] == {"valid_from": "2020-01-01", "valid_from_text": "01.01.2020", "note": "zz first"}
    assert {f["key"]: f["value"] for f in t["fields"]} == {"kcal": 2100, "protein": 140.5, "fat": None, "sat_fat": None, "carbs": None, "fibre": None,
                                                           "sugar_added": None, "sodium_mg": None, "water_ml": 3000}
    assert [h["valid_from"] for h in t["history"]] == ["2099-01-01", "2020-01-01"] and t["history"][0]["values"]["kcal"] == 1500


def test_new_targets_are_saved_with_app_s_words(sv):
    d = today()
    j = shaped(sv.post("/settings/targets", valid_from=d.isoformat(), kcal=2000, protein=120, fat=None, water_ml=2500, note="  zz  less  "), "settings_targets")
    assert j["outcome"] == "changed" and j["tone"] == "ok"
    assert j["head"] == f"Targets from {d:%d.%m.%Y} saved: Calories 2000, Protein 120, Water 2500 ml."
    row = owner_sql("SELECT kcal, protein, fat, water_ml, note FROM food_targets")[0]
    assert (float(row["kcal"]), float(row["protein"]), row["fat"], float(row["water_ml"]), row["note"]) == (2000, 120, None, 2500, "zz less")
    assert j["settings_targets"]["fields"][0]["value"] == 2000 and j["settings_targets"]["current"]["note"] == "zz less"
    assert n("SELECT count(*) AS n FROM audit_log WHERE detail->>'what' = 'food targets'") == 1


@pytest.mark.parametrize("body,why", [({"kcal": 2000}, "Give the date the targets start on."),
                                      ({"valid_from": "17.11.2026", "kcal": 2000}, "Give the date the targets start on."),
                                      ({"valid_from": "2026-01-05", "kcal": -1}, "Calories: give a number from 0 to 100000, or leave it empty."),
                                      ({"valid_from": "2026-01-05", "sodium_mg": 100001}, "Sodium: give a number from 0 to 100000, or leave it empty."),
                                      ({"valid_from": "2026-01-05", "note": "zz"}, "Give at least one target.")])
def test_targets_are_refused_with_app_s_words(sv, body, why):
    j = shaped(sv.post("/settings/targets", **body), "settings_targets")
    assert (j["outcome"], j["tone"], j["reason"]) == ("rejected", "warning", why) and n("SELECT count(*) AS n FROM food_targets") == 0


def test_a_target_that_is_not_a_number_is_a_bad_request(sv):
    refused(sv, "/settings/targets", "kcal must be a number or null.", valid_from="2026-01-05", kcal="2000")
    refused(sv, "/settings/targets", "note must be 200 characters or fewer.", valid_from="2026-01-05", kcal=1, note="x" * 201)


# ---- Today page ----------------------------------------------------------------------------------------------------------------------

def meals():
    return [str(owner_sql("INSERT INTO usual_meals (name) VALUES (%s) RETURNING id", nm)[0]["id"]) for nm in ("Zz bowl", "Aa toast")]


def groups(sv):
    return {g["kind"]: g for g in get(sv, "/settings/today")["settings_today"]["groups"]}


def test_today_read_has_the_five_groups_in_the_stored_order(sv):
    bowl, toast = meals()
    g = groups(sv)
    assert list(g) == ["habit", "health", "usual", "review", "card"] and g["card"]["heading"] == "Cards"
    assert [i["id"] for i in g["usual"]["items"]] == [toast, bowl] and all(i["shown"] for k in g for i in g[k]["items"])
    assert [i["id"] for i in g["health"]["items"]] == ["bed", "wake", "weight", "sugar", "bp_morning", "bp_evening"]
    assert g["review"]["items"] == [{"id": "box", "label": "To review", "shown": True}]
    assert [i["id"] for i in g["card"]["items"]] == ["gratitude", "home", "coach"]  # gratitude: show or hide only (its goal stays at app.)
    uiprefs.save(["health:sugar", "card:gratitude", "review:box"], {"health": ["weight", "bed"], "usual": [bowl]})
    g = groups(sv)
    assert [i["id"] for i in g["health"]["items"]][:3] == ["weight", "bed", "wake"] and [i["id"] for i in g["usual"]["items"]] == [bowl, toast]
    assert [i["shown"] for i in g["health"]["items"]] == [True, True, True, False, True, True]
    assert g["review"]["items"][0]["shown"] is False and g["card"]["items"][0]["shown"] is False
    assert "goal" not in json.dumps(get(sv, "/settings/today"))  # the gratitude goal stays at app.


def test_a_group_saved_at_the_door_is_stored_as_app_s_form_stores_it(web, sv):
    bowl, toast = meals()
    # app.'s form: health reordered with sugar hidden, the review box hidden, usual meals reversed (every group posted, as app. does)
    health = ["weight", "bed", "wake", "sugar", "bp_morning", "bp_evening"]
    form = {f"pos_health_{h}": str(k) for k, h in enumerate(health, 1)}
    form.update({f"show_health_{h}": "1" for h in health if h != "sugar"})
    habits = [i["id"] for i in groups(sv)["habit"]["items"]]
    form.update({f"show_habit_{h}": "1" for h in habits})
    form.update({f"pos_habit_{h}": str(k) for k, h in enumerate(habits, 1)})
    form.update({f"show_usual_{bowl}": "1", f"show_usual_{toast}": "1", f"pos_usual_{bowl}": "1", f"pos_usual_{toast}": "2"})
    form.update({"show_card_gratitude": "1", "show_card_home": "1", "show_card_coach": "1", "pos_card_gratitude": "1", "pos_card_home": "2",
                 "pos_card_coach": "3"})
    act(web, "/web/settings/today", back="/web/settings?tab=today", **form)
    app_stored = stored("today")
    uiprefs.reset()
    # the door: one tap per group, each the whole group in the wanted order
    sv.post("/settings/today", groups={"health": [{"id": h, "shown": h != "sugar"} for h in health]})
    sv.post("/settings/today", groups={"review": [{"id": "box", "shown": False}]})
    j = shaped(sv.post("/settings/today", groups={"usual": [{"id": int(bowl), "shown": True}, {"id": toast, "shown": True}]}), "settings_today")
    assert stored("today") == app_stored
    assert j["outcome"] == "changed" and j["head"] == "Saved. The Today page shows what you chose."
    assert [i["id"] for i in {g["kind"]: g for g in j["settings_today"]["groups"]}["usual"]["items"]] == [bowl, toast]


def test_a_partial_group_unknown_ids_and_groups_not_sent(sv):
    uiprefs.save(["card:home"], {"health": ["sugar"]})
    j = sv.post("/settings/today", groups={"card": [{"id": "coach", "shown": False}, {"id": "nothing-like-it", "shown": True}, {"id": "coach", "shown": True}]})
    s = stored("today")
    assert sorted(s["hidden"]) == ["card:coach", "card:home"]  # home: left out of the list, as it was
    assert s["order"]["card"] == ["coach", "gratitude", "home"] and s["order"]["health"][0] == "sugar"  # health not sent: as it was
    assert j["head"] == "Saved. The Today page shows what you chose."
    j = sv.post("/settings/today", groups={"card": [{"id": "home", "shown": True}, {"id": "coach", "shown": True}]})
    assert stored("today")["hidden"] == [] and j["head"] == "Saved. The Today page shows everything."


@pytest.mark.parametrize("groups,why", [(None, "groups must be an object of lists of {id, shown}."),
                                        ({"cards": []}, "groups: the groups are habit, health, usual, review and card."),
                                        ({"card": [{"id": "home"}]}, "groups.card must be a list of {id, shown}."),
                                        ({"card": [{"id": True, "shown": True}]}, "groups.card must be a list of {id, shown}."),
                                        ({"card": {"id": "home", "shown": True}}, "groups.card must be a list of {id, shown}.")])
def test_a_wrong_today_body_is_a_bad_request(sv, groups, why):
    refused(sv, "/settings/today", why, groups=groups)
    assert stored("today") is None


def test_today_reset(sv):
    uiprefs.save(["card:home"], {"card": ["coach"]})
    j = shaped(sv.post("/settings/today_reset"), "settings_today")
    assert j["head"] == "The Today page shows everything again, in the default order." and stored("today") is None


def test_the_day_says_what_the_two_switches_show_and_keeps_its_parts(sv):
    d = get(sv, "/day")["day"]
    assert d["shown"] == {"review": True, "gratitude": True}
    sv.post("/settings/today", groups={"review": [{"id": "box", "shown": False}], "card": [{"id": "gratitude", "shown": False}]})
    d2 = get(sv, "/day")["day"]
    assert d2["shown"] == {"review": False, "gratitude": False}
    assert d2["gratitude"] == d["gratitude"] and d2["needs"]["review"] == d["needs"]["review"]  # still filled in (a later front deploy hides them)


# ---- Body ----------------------------------------------------------------------------------------------------------------------------

def test_body_read_and_saves(sv):
    b = get(sv, "/settings/body")["settings_body"]
    assert b["height"] is None and b["heights"] == [] and b["height_range"] == {"min": 120, "max": 230}
    assert b["interval"] == {"days": 28, "min": 7, "max": 90, "default": 28} and [m["key"] for m in b["measures"]] == ["waist", "hips", "chest", "upper_arm", "thigh"]
    j = shaped(sv.post("/settings/height", valid_from="2024-02-03", height=171.46), "settings_body")
    assert j["head"] == "Height 171.5 cm saved, from 03.02.2024."
    assert j["settings_body"]["height"] == {"cm": 171.5, "valid_from": "2024-02-03"} and j["settings_body"]["heights"][0]["valid_from_text"] == "03.02.2024"
    j = shaped(sv.post("/settings/body", interval=21, show=["waist", "hips", "zz-unknown"]), "settings_body")
    assert j["head"] == "Body measurements: due every 21 days, 3 hidden."
    assert stored("body") == {"interval": 21, "hidden": ["chest", "upper_arm", "thigh"]}
    j = sv.post("/settings/body", interval=14)  # show left out: as now
    assert stored("body") == {"interval": 14, "hidden": ["chest", "upper_arm", "thigh"]} and j["head"] == "Body measurements: due every 14 days, 3 hidden."
    sv.post("/settings/body", show=["waist", "hips", "chest", "upper_arm", "thigh"])  # interval left out: as now
    assert stored("body") == {"interval": 14, "hidden": []}
    assert [m["shown"] for m in get(sv, "/settings/body")["settings_body"]["measures"]] == [True] * 5


@pytest.mark.parametrize("path,body,why", [("/settings/height", {"height": 170}, "Give the date the height counts from."),
                                           ("/settings/height", {"valid_from": "2024-02-03", "height": 300}, "Height: give a number from 120 to 230 cm."),
                                           ("/settings/height", {"valid_from": "2024-02-03"}, "Height: give a number from 120 to 230 cm."),
                                           ("/settings/body", {"interval": 6}, "Due every: give a whole number of days from 7 to 90."),
                                           ("/settings/body", {"interval": 28, "show": []}, "Keep at least one measure.")])
def test_body_refusals_have_app_s_words(sv, path, body, why):
    j = shaped(sv.post(path, **body), "settings_body")
    assert (j["outcome"], j["reason"]) == ("rejected", why)
    assert n("SELECT count(*) AS n FROM body_height") == 0 and stored("body") is None


def test_a_wrong_body_field_is_a_bad_request(sv):
    refused(sv, "/settings/body", "interval must be a whole number.", interval="21")
    refused(sv, "/settings/body", "show must be a list of keys.", show="waist")
    refused(sv, "/settings/height", "height must be a number or null.", valid_from="2024-02-03", height="171")


# ---- Coach ---------------------------------------------------------------------------------------------------------------------------

def test_coach_read_and_save(sv):
    c = get(sv, "/settings/coach")["settings_coach"]
    assert (c["goals"], c["style"], c["max"], c["daily_limit"]) == ("", "", 2000, 10)
    assert [k["kind"] for k in c["kinds"]] == ["day", "week"] and c["kinds"][0]["title"] == "Day coaching (Today)"
    assert c["kinds"][0]["parts"][0] == {"key": "went_well", "label": "What went well", "on": True} and len(c["kinds"][1]["parts"]) == 6
    assert c["facts"][2] == "Claude Opus 5.5; about 6 cents a day coaching, about 20 cents a week review; at most 10 a day." and len(c["facts"]) == 4
    j = shaped(sv.post("/settings/coach", goals="zz walk  more\n  swim", style="zz short", parts={"day": ["went_well", "improve"]}), "settings_coach")
    assert j["head"] == "Saved: the coach reads your settings every time."
    v = stored("coach")
    assert v["goals"] == "zz walk more\nswim" and v["style"] == "zz short" and v["hidden"] == ["day:next_meal", "day:gaps", "day:doctor"]
    sv.post("/settings/coach", style="zz kind")  # goals and parts left out: as they are
    v = stored("coach")
    assert (v["goals"], v["style"], v["hidden"]) == ("zz walk more\nswim", "zz kind", ["day:next_meal", "day:gaps", "day:doctor"])
    sv.post("/settings/coach", parts={"week": ["focus"]})  # the day's parts left out: as they are
    assert stored("coach")["hidden"] == ["day:next_meal", "day:gaps", "day:doctor", "week:targets", "week:trends", "week:habits", "week:days", "week:doctor"]
    on = {k["kind"]: [p["key"] for p in k["parts"] if p["on"]] for k in get(sv, "/settings/coach")["settings_coach"]["kinds"]}
    assert on == {"day": ["went_well", "improve"], "week": ["focus"]}


def test_coach_refusals(sv):
    for kind, words in (("day", "day coaching"), ("week", "week review")):
        j = shaped(sv.post("/settings/coach", parts={kind: []}), "settings_coach")
        assert (j["outcome"], j["reason"]) == ("rejected", f"Keep at least one part of the {words}.")
    assert stored("coach") is None
    refused(sv, "/settings/coach", "parts must be {day: [keys], week: [keys]}.", parts={"month": []})
    refused(sv, "/settings/coach", "day must be a list of keys.", parts={"day": "went_well"})
    refused(sv, "/settings/coach", "goals must be 2000 characters or fewer.", goals="x" * 2001)
    assert shaped(sv.post("/settings/coach", goals="y" * 2000), "settings_coach")["outcome"] == "changed"


# ---- Devices -------------------------------------------------------------------------------------------------------------------------

def test_devices_at_both_addresses_and_signing_out(web):
    sv = Door()
    other = Door()
    d = get(sv, "/settings/devices")["settings_devices"]
    assert d["others"] == 2 and len(d["devices"]) == 3
    by = {x["address"]: x for x in d["devices"] if not x["current"]}
    me = next(x for x in d["devices"] if x["current"])
    assert me["id"] == get(sv, "/session")["sid"] and me["address"] == "logger" and set(by) == {"app", "logger"}
    assert set(me) == {"id", "name", "address", "signed_in", "last_used", "expires", "current"}
    j = shaped(sv.post("/settings/device", id=me["id"]), "settings_devices")
    assert (j["outcome"], j["reason"]) == ("rejected", "This is the device you are using; use Sign out on More.")
    j = shaped(sv.post("/settings/device", id=by["app"]["id"]), "settings_devices")
    assert j["head"] == "Signed that device out." and j["settings_devices"]["others"] == 1
    assert web[0].get("/web/").status_code == 302  # app.'s session is gone
    j = sv.post("/settings/device", id=by["app"]["id"])
    assert (j["outcome"], j["reason"]) == ("unchanged", "That device is already signed out.")
    assert sv.post("/settings/device", id="not-a-device")["reason"] == "Unknown device."
    j = shaped(sv.post("/settings/others"), "settings_devices")
    assert j["head"] == "Signed out 1 other device." and [x["current"] for x in j["settings_devices"]["devices"]] == [True]
    assert other.c.get("/api/v1/day", headers=other.h).status_code == 401
    assert sv.post("/settings/others")["head"] == "No other device was signed in."
    assert get(sv, "/session")["signed_in"] is True


def test_app_s_devices_tab_still_refuses_its_own_device_with_its_words(web):
    sid = owner_sql("SELECT sid FROM web_sessions")[0]["sid"]
    page = act(web, "/web/settings/device", sid=str(sid), back="/web/settings?tab=devices")
    assert "This is the device you are using; use Sign out at the top." in page.text


# ---- Export --------------------------------------------------------------------------------------------------------------------------

def test_export_tab_and_the_zip_as_bytes(sv):
    e = get(sv, "/settings/export")["settings_export"]
    assert e["last"] is None and e["title"] == "Export everything" and e["private_label"] == "Include private and gratitude entries"
    _seed()
    r = sv.raw("/export")
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip" and r.headers["cache-control"] == "no-store"
    assert r.headers["content-disposition"] == f'attachment; filename="{export.build(False)[1]}"' and r.headers["x-session-expires"]
    files = _zip(r)
    data, _name, _counts = export.build(False)
    with zipfile.ZipFile(io.BytesIO(data)) as z:
        assert set(files) == {x.split("/", 1)[1] for x in z.namelist()} and "private.csv" not in files
    assert PRIVATE_WORDS.encode() not in b"".join(files.values()) and GRATITUDE_WORDS.encode() not in b"".join(files.values())
    audit = owner_sql("SELECT client, detail FROM audit_log WHERE tool = 'export'")
    assert len(audit) == 1 and audit[0]["client"] == "web" and audit[0]["detail"]["private"] is False and audit[0]["detail"]["bytes"] == len(r.content)
    last = get(sv, "/settings/export")["settings_export"]["last"]
    assert last["private"] is False and last["text"].startswith("Last download: ") and not last["text"].endswith("with private entries.")
    files = _zip(sv.raw("/export", private=True, code=fresh_code()))  # Core 37: private entries need the authenticator code
    assert "private.csv" in files and PRIVATE_WORDS.encode() in files["private.csv"]
    last = get(sv, "/settings/export")["settings_export"]["last"]
    assert last["private"] is True and last["text"].endswith(", with private entries.")


def test_export_refusals_are_json(sv, monkeypatch):
    refused(sv, "/export", "private must be true or false.", private="1")
    r = sv.c.post("/api/v1/export", headers=sv.h)
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip"  # no body: without private entries

    def down(*_a):
        raise OSError("the database is away")
    monkeypatch.setattr(export, "build", down)
    r = sv.raw("/export")
    assert r.status_code == 500 and r.json() == {"v": 1, "error": "server_error", "message": export.FAILED}
    assert door().post("/api/v1/export", json={}).status_code == 401  # signed out: JSON, no file
    assert door(token="wrong").post("/api/v1/export", headers=sv.h, json={}).json() == {"v": 1, "error": "not_found", "message": "Not found."}


# ---- Core 37: the export with private entries asks for the authenticator code -------------------------------------------------------

def _exports():
    return n("SELECT count(*) AS n FROM audit_log WHERE tool = 'export'")


def _fails(sv):
    return n("SELECT count(*) AS n FROM login_failures WHERE device_hash = (SELECT device_hash FROM web_sessions WHERE token_hash = %s)",
             api.web._h(sv.j["token"]))


def test_the_private_export_takes_the_right_code_once(sv):
    _seed()
    code = fresh_code()
    r = sv.raw("/export", private=True, code=code)
    assert r.status_code == 200 and r.headers["content-type"] == "application/zip" and "private.csv" in _zip(r)
    assert owner_sql("SELECT last_totp_step FROM owner_credentials")[0]["last_totp_step"] > 0  # the code is used up
    again = sv.raw("/export", private=True, code=code)  # the same code twice: refused, as at a sign-in
    assert again.status_code == 403 and again.json() == {"v": 1, "error": "wrong_code", "message": api.CODE_WRONG}
    assert again.headers["content-type"].startswith("application/json") and PRIVATE_WORDS.encode() not in again.content
    assert _exports() == 1 and _fails(sv) == 1


def test_a_wrong_or_missing_code_exports_nothing_and_counts_as_a_failed_try(sv):
    _seed()
    for body, message in (({}, api.CODE_NEEDED), ({"code": ""}, api.CODE_NEEDED), ({"code": "000000"}, api.CODE_WRONG), ({"code": "abc"}, api.CODE_WRONG)):
        r = sv.raw("/export", private=True, **body)
        assert r.status_code == 403 and r.json() == {"v": 1, "error": "wrong_code", "message": message}, body
        assert PRIVATE_WORDS.encode() not in r.content and GRATITUDE_WORDS.encode() not in r.content
    assert _exports() == 0 and _fails(sv) == 4
    assert "Nothing was exported" in api.CODE_NEEDED and "Nothing was exported" in api.CODE_WRONG
    # without private entries nothing changes: no code asked for, no failed try counted
    assert sv.raw("/export").status_code == 200 and sv.raw("/export", private=False).status_code == 200 and _fails(sv) == 4
    # the right code clears this device's failed tries, as a sign-in does
    assert sv.raw("/export", private=True, code=fresh_code()).status_code == 200 and _fails(sv) == 0


def test_the_sign_ins_limit_holds_for_the_code_and_shares_the_devices_tries(sv):
    _seed()
    for _ in range(auth.MAX_FAILURES):
        assert sv.raw("/export", private=True, code="000000").status_code == 403
    r = sv.raw("/export", private=True, code=fresh_code())  # even the right code now waits
    assert r.status_code == 429 and r.json()["error"] == "too_many_tries" and "Nothing was exported" in r.json()["message"]
    assert _exports() == 0 and _fails(sv) == auth.MAX_FAILURES  # a try over the limit is not counted again
    assert owner_sql("SELECT last_totp_step FROM owner_credentials")[0]["last_totp_step"] == 0  # and the code is not used up
    # the device's failed tries are the sign-in's: its next sign-in from this device is refused too
    out = sv.c.post("/api/v1/session", json={"password": "anything", "code": fresh_code(), "device": sv.j["device"]})
    assert out.status_code == 429
    # another device is not locked out by this one's tries
    other = Door()
    assert other.raw("/export", private=True, code=fresh_code()).status_code == 200
    # the window passes: the code works again
    owner_sql("UPDATE login_failures SET at = at - make_interval(mins => %s)", auth.FAILURE_WINDOW_MIN + 1)
    assert sv.raw("/export", private=True, code=fresh_code()).status_code == 200


def test_only_a_download_route_may_answer_a_file(monkeypatch):
    """The door's guard: a Download from a route not registered with download=True is a server error, never the file; one registered
    with it answers the file only after the door's checks."""
    from starlette.applications import Starlette
    from starlette.routing import Route
    from starlette.testclient import TestClient
    from test_api_door import FRONT, HOST

    monkeypatch.setattr(api, "_ROUTES", [])
    zz = lambda _r, _b, _s: api.Download(b"PK-zz", "application/zip", "zz.zip")  # noqa: E731
    api.route("/zz-file", "GET")(zz)
    api.route("/zz-file-ok", "GET", download=True)(zz)
    app = Starlette(routes=[Route(p, h, methods=[m]) for p, m, h in api._ROUTES])
    sv = Door()
    sv.c = TestClient(app, base_url=f"http://{HOST}", headers={"X-Front-Token": FRONT})
    r = sv.c.get("/api/v1/zz-file", headers=sv.h)
    assert r.status_code == 500 and r.json() == {"v": 1, "error": "server_error", "message": "Something went wrong. Nothing was lost; try again in a moment."}
    assert b"PK-zz" not in r.content
    r = sv.c.get("/api/v1/zz-file-ok", headers=sv.h)
    assert r.status_code == 200 and r.content == b"PK-zz" and r.headers["content-disposition"] == 'attachment; filename="zz.zip"'
    assert r.headers["x-content-type-options"] == "nosniff" and r.headers["cache-control"] == "no-store"
    assert sv.c.get("/api/v1/zz-file-ok", headers={**sv.h, "X-Front-Token": "wrong"}).json()["error"] == "not_found"
    assert sv.c.get("/api/v1/zz-file-ok", headers={**sv.h, "X-Forwarded-For": "1.2.3.4"}).json()["error"] == "not_found"
    assert sv.c.get("/api/v1/zz-file-ok", headers={"Authorization": "Bearer " + "x" * 40}).status_code == 401


def test_every_settings_read_needs_the_door_and_a_session(sv):
    for tab in ("targets", "today", "body", "coach", "devices", "notify", "export"):
        assert door().get(f"/api/v1/settings/{tab}").status_code == 401, tab
        assert door(token="wrong").get(f"/api/v1/settings/{tab}", headers=sv.h).status_code == 404, tab
        r = sv.c.get(f"/api/v1/settings/{tab}", headers=sv.h)
        assert set(r.json()) == {"v", f"settings_{tab}", "undo"} and r.headers["cache-control"] == "no-store", tab

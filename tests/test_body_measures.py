"""The body measures come from the database (web item 58, 22.11.2026): log_types rows marked body_measure, which the owner adds,
changes, moves and removes in Settings > Body at logger. (POST /settings/body_measure). The five of 024 behave as before; a new
one is read in typed lines, shown on the Health card, in Today's due line and on app.'s pages. Every value here is invented.
log_types is not emptied between tests: the measures a test adds are removed after it and the five restored."""
from datetime import timedelta

import pytest

from app import body, reads, tape, websettings
from app.db import connect
from conftest import owner_sql
from test_api_door import door_on, signed_in  # noqa: F401 - door_on is autouse
from test_api_saves import KEYS, Door
from test_body import seed, today, vals, woke
from test_log import call, fake  # noqa: F401 - fixtures reused
from test_web import act, web  # noqa: F401

FIVE = ["waist", "hips", "chest", "upper_arm", "thigh"]
NECK = {"label": "Neck", "landmark": "Below the larynx, tape level", "min": 25, "max": 60, "words": []}


@pytest.fixture(autouse=True)
def body_measures_as_they_were():
    """The body measure rows as before the test; a habit row a test adds is removed too."""
    keep = owner_sql("SELECT name, label, notes, min1, max1, aliases, sort_order, active FROM log_types WHERE body_measure")
    names = [r["name"] for r in owner_sql("SELECT name FROM log_types")]
    yield
    for r in keep:  # a removed measure comes back as it was
        owner_sql("""INSERT INTO log_types (name, label, kind, category, unit, aliases, body_measure) VALUES (%s, %s, 'measurement', 'vitals', 'cm', '{}', true)
                     ON CONFLICT (name) DO NOTHING""", r["name"], r["label"])
    owner_sql("DELETE FROM measurements WHERE type_id IN (SELECT id FROM log_types WHERE name <> ALL(%s))", names)
    owner_sql("DELETE FROM events WHERE type_id IN (SELECT id FROM log_types WHERE name <> ALL(%s))", names)
    owner_sql("DELETE FROM log_types WHERE name <> ALL(%s)", names)
    for r in keep:
        owner_sql("UPDATE log_types SET label = %s, notes = %s, min1 = %s, max1 = %s, aliases = %s, sort_order = %s, active = %s, body_measure = true WHERE name = %s",
                  r["label"], r["notes"], r["min1"], r["max1"], r["aliases"], r["sort_order"], r["active"], r["name"])


@pytest.fixture
def sv():
    return Door()


def measure(sv, **body):
    j = sv.post("/settings/body_measure", **body)
    assert set(j) == KEYS | {"settings_body"} and j["undo"] is None, sorted(j)
    return j


def keys(j=None):
    return [m["key"] for m in (j["settings_body"] if j else reads.settings_body())["measures"]]


def add_neck(sv, **more):
    j = measure(sv, action="add", **{**NECK, **more})
    assert j["outcome"] == "changed", j
    return j


# ---- the five, read from the database ------------------------------------------------------------------------------------------------

def test_the_five_come_from_the_database_as_the_fixed_list_had_them():
    with connect() as c, c.cursor() as cur:
        ms = body.measures(cur)
        assert [m["key"] for m in ms] == FIVE == body.names(cur, ms)
        assert body.labels(cur) == {"waist": "Waist", "hips": "Hips", "chest": "Chest", "upper_arm": "Upper arm", "thigh": "Thigh"}
        assert ms[0]["landmark"] == "At the navel, after a normal breath out" and ms[3]["landmark"] == "Halfway shoulder to elbow, relaxed, right side"
        assert (ms[0]["min"], ms[0]["max"]) == (50, 200) and ms[3]["words"] == ["arm", "bicep", "biceps"]
    b = reads.settings_body()
    assert keys() == FIVE and all(m["shown"] and not m["has_values"] for m in b["measures"])
    assert [s["label"] for s in b["suggestions"]] == ["Neck", "Calf"]
    assert b["limits"] == {"label": {"min": 2, "max": 30}, "landmark_max": 120, "cm": {"min": 10, "max": 300}, "words_max": 8, "word_max": 30}


# ---- add -----------------------------------------------------------------------------------------------------------------------------

def test_add_makes_the_key_from_the_label_and_lists_it_last(sv):
    j = add_neck(sv)
    assert j["head"] == "Added the measure Neck. Measure it in the form, or type “neck 38.5”."
    assert keys(j) == FIVE + ["neck"]
    neck = j["settings_body"]["measures"][-1]
    assert neck == {"key": "neck", "label": "Neck", "landmark": "Below the larynx, tape level", "min": 25, "max": 60, "words": [],
                    "shown": True, "has_values": False}
    assert [s["label"] for s in j["settings_body"]["suggestions"]] == ["Calf"]
    row = owner_sql("SELECT kind, category, unit, on_checklist, active, body_measure FROM log_types WHERE name = 'neck'")[0]
    assert row == {"kind": "measurement", "category": "vitals", "unit": "cm", "on_checklist": False, "active": True, "body_measure": True}
    calf = measure(sv, action="add", label="Calf", landmark="Widest point, standing, right side", min=20, max=70, words=["Calves", " calves "])
    assert calf["settings_body"]["measures"][-1]["words"] == ["calves"] and calf["settings_body"]["suggestions"] == []


def test_the_key_is_lower_case_letters_and_digits_and_gets_a_number_when_taken():
    assert websettings.measure_key("Upper  thigh (left)!", set()) == "upper_thigh_left"
    assert websettings.measure_key("Hüfte", set()) == "huefte"
    assert websettings.measure_key("Neck", {"neck"}) == "neck_2"
    assert websettings.measure_key("Neck", {"neck", "neck_2"}) == "neck_3"
    long = "A very long measure name for once"
    assert websettings.measure_key(long, set()) == "a_very_long_measure_name_for_o"
    assert len(websettings.measure_key(long, {"a_very_long_measure_name_for_o"})) == 30
    assert websettings.measure_key("Day", websettings.RESERVED) == "day_2"  # the Measure form's own fields stay free


@pytest.mark.parametrize("body_,why", [
    ({"label": "Shoonya"}, "“Shoonya” is already the name of the habit Shoonya: choose another."),           # a habit's name and label
    ({"label": "Belly"}, "“Belly” is already a word for the measure Waist: choose another."),                # another measure's word
    ({"label": "Neck", "words": ["bp"]}, "“bp” is already the name of the health value Blood pressure: choose another."),
    ({"label": "Arm girth", "words": ["arm"]}, "“arm” is already a word for the measure Upper arm: choose another."),
    ({"label": "Upper arm"}, "“Upper arm” is already the name of the measure Upper arm: choose another."),     # a label
    ({"label": "Weight"}, "“Weight” is already the name of the health value Weight: choose another."),
])
def test_a_clash_with_any_other_type_is_refused_by_name(sv, body_, why):
    j = measure(sv, action="add", **{**NECK, **body_})
    assert (j["outcome"], j["reason"]) == ("rejected", why) and keys(j) == FIVE


def test_a_clash_with_a_retired_habits_word_is_refused_too(sv):
    owner_sql("""INSERT INTO log_types (name, label, kind, category, aliases, on_checklist, active, sort_order)
                 VALUES ('zz_stretch', 'Neck stretch', 'event', 'daily', '{neckroll}', false, false, 500)""")
    j = measure(sv, action="add", **{**NECK, "words": ["neckroll"]})
    assert j["reason"] == "“neckroll” is already a word for the habit Neck stretch: choose another."
    j = measure(sv, action="add", **{**NECK, "label": "Neck stretch"})
    assert j["reason"] == "“Neck stretch” is already the name of the habit Neck stretch: choose another."


@pytest.mark.parametrize("body_,why", [
    ({"label": "N"}, "Name: give 2 to 30 characters."),
    ({"label": "x" * 31}, "Name: give 2 to 30 characters."),
    ({"label": "!!"}, "Name: use letters or digits."),
    ({"landmark": "y" * 121}, "Landmark: at most 120 characters."),
    ({"min": 5}, "Lowest: give a number from 10 to 300 cm."),
    ({"max": 301}, "Highest: give a number from 10 to 300 cm."),
    ({"min": None}, "Lowest: give a number from 10 to 300 cm."),
    ({"min": 60, "max": 60}, "The lowest value must be below the highest."),
    ({"words": ["neck1"]}, "The word “neck1”: use letters, spaces and hyphens only."),
    ({"words": [c * 2 for c in "abcdefghi"]}, "Words: at most 8."),
    ({"words": ["z" * 31]}, "The word “" + "z" * 31 + "” is longer than 30 characters."),
])
def test_the_form_is_checked_in_plain_words(sv, body_, why):
    j = measure(sv, action="add", **{**NECK, **body_})
    assert (j["outcome"], j["reason"]) == ("rejected", why)


def test_a_wrong_field_is_a_bad_request(sv):
    for body_, why in (({"action": "zz"}, "action must be add, edit, move or remove."),
                       ({"action": "edit", **NECK}, "key is missing."),
                       ({"action": "add", **{**NECK, "min": "25"}}, "min must be a number or null."),
                       ({"action": "add", **{**NECK, "words": "calves"}}, "words must be a list of words."),
                       ({"action": "move", "key": "waist", "dir": "left"}, 'dir must be "up" or "down".')):
        r = sv.raw("/settings/body_measure", **body_)
        assert r.status_code == 400 and r.json()["message"] == why, r.text


# ---- edit, move, remove --------------------------------------------------------------------------------------------------------------

def test_edit_keeps_the_key_and_the_history(sv):
    seed(today() - timedelta(days=3), waist=92.0)
    j = measure(sv, action="edit", key="waist", label="Belly girth", landmark="at the navel", min=40, max=180, words=["belly", "tummy"])
    assert j["head"] == "Saved the measure Belly girth." and keys(j) == FIVE
    w = j["settings_body"]["measures"][0]
    assert (w["label"], w["landmark"], w["min"], w["max"], w["words"], w["has_values"]) == ("Belly girth", "At the navel", 40, 180, ["belly", "tummy"], True)
    assert vals() == [("waist", 92.0)]
    assert owner_sql("SELECT aliases FROM log_types WHERE name = 'waist'")[0]["aliases"] == ["belly", "tummy", "belly girth"]
    refused = measure(sv, action="edit", key="waist", label="Hips", min=40, max=180)
    assert refused["reason"] == "“Hips” is already the name of the measure Hips: choose another."
    assert measure(sv, action="edit", key="zz", label="Zz", min=40, max=180)["reason"] == "Unknown measure."


def test_narrowing_the_range_below_logged_values_is_allowed(sv):
    seed(today() - timedelta(days=3), waist=92.0)
    j = measure(sv, action="edit", key="waist", label="Waist", landmark="", min=100, max=150, words=[])
    assert j["outcome"] == "changed" and j["settings_body"]["measures"][0]["landmark"] == ""


def test_move_swaps_with_the_neighbour_and_makes_equal_orders_distinct(sv):
    j = measure(sv, action="move", key="hips", dir="up")
    assert j["head"] == "Moved Hips up." and keys(j) == ["hips", "waist", "chest", "upper_arm", "thigh"]
    first = measure(sv, action="move", key="hips", dir="up")
    assert (first["outcome"], first["reason"]) == ("unchanged", "Hips is already first.")
    owner_sql("UPDATE log_types SET sort_order = 7 WHERE body_measure")
    j = measure(sv, action="move", key="chest", dir="down")
    orders = [r["sort_order"] for r in owner_sql("SELECT sort_order FROM log_types WHERE body_measure ORDER BY sort_order")]
    # equal orders read by name (chest, hips, thigh, upper_arm, waist), numbered so, then chest one down
    assert len(set(orders)) == 5 and keys(j) == ["hips", "chest", "thigh", "upper_arm", "waist"]


def test_remove_only_without_values_and_keep_one_shown(sv):
    add_neck(sv)
    seed(today() - timedelta(days=3), waist=92.0)
    j = measure(sv, action="remove", key="waist")
    assert (j["outcome"], j["reason"]) == ("rejected", "Waist has values: hide it instead.") and "waist" in keys(j)
    assert j["settings_body"]["hints"]["remove"] == "A measure with values cannot be removed: hide it instead."
    j = measure(sv, action="remove", key="neck")
    assert j["head"] == "Removed the measure Neck." and keys(j) == FIVE
    assert owner_sql("SELECT count(*) AS n FROM log_types WHERE name = 'neck'")[0]["n"] == 0
    sv.post("/settings/body", show=["chest"])
    j = measure(sv, action="remove", key="chest")
    assert j["reason"] == "Keep at least one measure shown." and "chest" in keys(j)


def test_a_hidden_key_that_is_gone_is_ignored_and_dropped(sv):
    add_neck(sv)
    sv.post("/settings/body", show=["waist", "hips"])
    assert sorted(reads.settings_body()["measures"][i]["key"] for i in range(6) if not reads.settings_body()["measures"][i]["shown"]) == \
        ["chest", "neck", "thigh", "upper_arm"]
    measure(sv, action="remove", key="neck")
    assert owner_sql("SELECT value FROM ui_settings WHERE key = 'body'")[0]["value"]["hidden"] == ["chest", "thigh", "upper_arm"]
    owner_sql("""UPDATE ui_settings SET value = '{"interval": 28, "hidden": ["zz_gone", "chest"]}' WHERE key = 'body'""")
    assert reads.body()["hidden"] == ["chest"]
    assert [m["shown"] for m in reads.settings_body()["measures"]] == [True, True, False, True, True]


# ---- typed lines ---------------------------------------------------------------------------------------------------------------------

def test_a_new_measure_and_its_word_are_read_in_cm_and_inches(sv, call, fake):
    measure(sv, action="add", label="Calf", landmark="Widest point", min=20, max=70, words=["calves"])
    out = call("log", text="calf 38.5", idempotency_key="m1")
    assert out["outcome"] == "saved" and fake.calls == []
    out = call("log", text="waist 92 calves 15 in", idempotency_key="m2")
    assert out["outcome"] == "needs_confirmation" and "Calf already 38.5 on" in out["message"]
    yes = call("answer", question_id=out["questions"][0]["question_id"], reply="yes")
    assert yes["outcome"] == "saved"
    rows = owner_sql("SELECT t.name, m.value1 FROM measurements m JOIN log_types t ON t.id = m.type_id ORDER BY m.id")
    assert [(r["name"], float(r["value1"])) for r in rows] == [("waist", 92.0), ("calf", 38.1)]


def test_a_new_measure_reads_back_a_jump_and_a_value_out_of_its_range(sv, call, fake):
    add_neck(sv)
    seed(today() - timedelta(days=28), neck=38.0)
    out = call("log", text="neck 42.5", idempotency_key="m3")
    assert out["outcome"] == "needs_confirmation" and "Neck 42.5 cm is 4.5 cm away from last time (38.0). Right?" in out["message"]
    out = call("log", text="neck 70", idempotency_key="m4")
    assert out["outcome"] == "needs_confirmation" and "outside the plausible range 25-60 cm" in out["message"]
    out = call("log", text="waist 92 nekc 40", idempotency_key="m5")
    assert "(waist, hips, chest, upper arm, thigh, neck)" in out["questions"][0]["question"]


def test_a_line_with_a_measures_word_of_another_type_still_goes_to_the_ai():
    with connect() as c, c.cursor() as cur:
        assert tape.read(cur, "weight 82 waist 92") is None
        assert tape.read(cur, "waist 92")["health"][0]["type"] == "waist"


# ---- the Health card, Today, app.'s pages --------------------------------------------------------------------------------------------

def test_the_body_card_and_today_with_six_measures(sv, web, fake):
    add_neck(sv)
    t = today()
    seed(t - timedelta(days=60), waist=94.0, neck=39.0)
    seed(t - timedelta(days=30), waist=93.0, hips=101.0, neck=38.5)
    b = reads.body()
    assert [f["key"] for f in b["form"]] == FIVE + ["neck"] and b["form"][-1]["hint"] == "Below the larynx, tape level"
    assert (b["form"][-1]["min"], b["form"][-1]["max"], b["form"][-1]["last_cm"]) == (25, 60, 38.5)
    assert [r["key"] for r in b["table"]] == ["waist", "hips", "neck"] and b["table"][-1]["last_text"] == "−0.5"
    assert [c["key"] for c in b["charts"]] == ["waist", "hips", "neck"] and b["charts"][-1]["chart"]["label"] == "Neck in cm"
    measure(sv, action="move", key="neck", dir="up")
    assert [c["key"] for c in reads.body()["charts"]] == ["waist", "hips", "neck"]  # neck before thigh: no chart of thigh
    assert [f["key"] for f in reads.body()["form"]][-2:] == ["neck", "thigh"]
    woke(t)
    assert reads.day()["needs"]["body_due"] == {"last": (t - timedelta(days=30)).isoformat(), "days": 30}
    page = web[0].get("/web/health?measure=1").text
    assert page.count('class="brow"') == 6 and "<b>Neck</b>" in page and "<td>Neck</td>" in page and ">Neck</a>" in page
    y = t - timedelta(days=1)
    saved = sv.post("/body", day=y.isoformat(), values={"neck": 38.0}, key="m6")
    assert saved["outcome"] == "saved" and [r["key"] for r in saved["body"]["table"]][-1] == "neck"
    assert "Body measurements: neck 38.0 cm (1 value)" in web[0].get("/web/recent").text
    assert f"Measured {y:%d.%m.}: neck −0.5 cm since last" in web[0].get("/web/week").text


def test_app_s_settings_and_health_pages_with_six_and_with_four(sv, web):
    add_neck(sv, label="Neck <b>")
    page = web[0].get("/web/settings?tab=body").text
    assert page.count('name="show"') == 6 and "Neck &lt;b&gt;" in page
    assert web[0].get("/web/health?measure=1").text.count('class="brow"') == 6
    sv.post("/settings/body", show=["waist", "neck_b"])
    assert web[0].get("/web/health?measure=1").text.count('class="brow"') == 2
    for k in ("neck_b", "thigh"):
        measure(sv, action="remove", key=k)
    assert keys() == ["waist", "hips", "chest", "upper_arm"]
    sv.post("/settings/body", show=["waist", "hips", "chest", "upper_arm"])
    page = web[0].get("/web/settings?tab=body").text
    assert page.count('name="show"') == 4
    assert web[0].get("/web/health?measure=1").text.count('class="brow"') == 4
    woke(today())
    seed(today() - timedelta(days=40), hips=100.0)
    assert "Body measurements due" in web[0].get("/web/").text

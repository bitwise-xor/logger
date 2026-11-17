"""The JSON door's Medical (deploy 104, 17.11.2026; step 5 of the move to logger.): GET /api/v1/labs, /labs/tests and /labs/meds, POST
/api/v1/labs/value, /labs/report and /labs/med, each through app.'s own function (labspage.reports_data, tests_data, test_chart,
meds_data; weblabs.value, report, med: shown first, made after the yes), and a new course by POST /log (read back, its yes through
/answer), answered with the fresh medication list. The AI is a fake (no network). Every report, test, value and course is invented."""
import html
import json
import logging
from datetime import date

import pytest

from app import api, labspage, reads, weblabs
from conftest import owner_sql
from test_api_door import NOT_FOUND, door, door_on, signed_in  # noqa: F401 - door_on is autouse
from test_api_saves import KEYS, Door, n  # noqa: F401
from test_log import fake  # noqa: F401 - the AI is a fake
from test_webtoday import raw

# The sample file's names (front/tests/samples/labs.json); the tests use "Zz <name>"
TESTS = {"hb": ("Haemoglobin", "g/dL"), "ferritin": ("Ferritin", "ng/mL"), "vitd": ("Vitamin D", "ng/mL"), "tsh": ("TSH", "mIU/L"),
         "liver": ("Liver", "", "imaging")}


def lab_test(name, unit, category="lab", aliases=()):
    """Lab tests are a catalogue the tests do not empty: reuse one by name."""
    got = owner_sql("SELECT id FROM lab_tests WHERE name = %s", name)
    if got:
        return got[0]["id"]
    return owner_sql("INSERT INTO lab_tests (name, category, unit, aliases) VALUES (%s, %s, %s, %s) RETURNING id", name, category, unit,
                     list(aliases))[0]["id"]


def report(d, title, kind="lab", provider="Zz Lab", notes=None):
    return owner_sql("""INSERT INTO lab_reports (raw_id, report_type, title, provider, collected_date, collected_at, extractor_version, notes)
                        VALUES (%s, %s, %s, %s, %s, %s::date + time '08:00', 'test', %s) RETURNING id""", raw(), kind, title, provider, d, d, notes)[0]["id"]


def value(rid, tid, v, unit, lo, hi, flag, text=None, site=None, side=None, note=None):
    ref = None if lo is None and hi is None else f"{lo}-{hi}" if lo is not None and hi is not None else f"<{hi}" if hi is not None else f">{lo}"
    return owner_sql("""INSERT INTO lab_results (report_id, test_id, value, unit, value_raw, unit_raw, ref_low, ref_high, ref_range_raw, flag,
                        value_text, body_site, side, note, extractor_version) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'test')
                        RETURNING id""", rid, tid, v, unit, None if v is None else str(v), unit, lo, hi, ref, flag, text, site, side, note)[0]["id"]


def course(name, dose, frequency, start, stop=None, ingredient=None, why=None):
    return owner_sql("""INSERT INTO medications (raw_id, name, ingredient, dose, frequency, indication, start_date, stop_date, extractor_version)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'test') RETURNING id""", raw(), name, ingredient, dose, frequency, why, start, stop)[0]["id"]


def invented(plain=False) -> dict:
    """Five reports (four lab, one imaging) over four years; Haemoglobin, Ferritin and Vitamin D on all four lab reports (a range,
    flags L and H), TSH once, the liver as a finding; four courses: two running, two ended. -> the ids by key."""
    nm = (lambda s: s) if plain else (lambda s: f"Zz {s}")
    t = {k: lab_test(nm(v[0]), v[1], *(v[2:] or ["lab"]), aliases=(v[0].split()[0].lower(),)) for k, v in TESTS.items()}
    x = {f"t_{k}": tid for k, tid in t.items()}
    x["r1"] = report(date(2023, 3, 14), "Blood count")
    x["r2"] = report(date(2024, 9, 2), "Annual check-up", notes="Fasting sample.")
    x["r3"] = report(date(2025, 6, 20), "Iron and vitamins")
    x["r4"] = report(date(2026, 10, 5), "Annual check-up")
    x["img"] = report(date(2026, 10, 12), "Abdominal ultrasound", "imaging", provider="Zz Imaging")
    for k, (hb, fe, vd) in (("r1", (13.2, 25, 18)), ("r2", (14.1, 40, 22)), ("r3", (12.0, 12, 31)), ("r4", (13.8, 450, 45))):
        x[f"{k}_hb"] = value(x[k], t["hb"], hb, "g/dL", 13.5, 17.5, "L" if hb < 13.5 else "N")
        x[f"{k}_fe"] = value(x[k], t["ferritin"], fe, "ng/mL", 30, 400, "L" if fe < 30 else "H" if fe > 400 else "N", note="haemolysed" if k == "r3" else None)
        x[f"{k}_vd"] = value(x[k], t["vitd"], vd, "ng/mL", 30, 100, "L" if vd < 30 else "N")
    x["r4_tsh"] = value(x["r4"], t["tsh"], 2.1, "mIU/L", 0.4, 4, "N")
    x["img_liver"] = value(x["img"], t["liver"], None, None, None, None, "A", text="slightly enlarged", site="liver")
    x["d_vitd"] = course(nm("Vitamin D 1000 IU"), "1000 IU", "daily", date(2026, 9, 1), ingredient="cholecalciferol", why="low vitamin D")
    x["d_iron"] = course(nm("Iron 50 mg"), "50 mg", "every other day", date(2025, 7, 1), date(2099, 1, 1), "ferrous sulfate", "low ferritin")
    x["d_old"] = course(nm("Iron 100 mg"), "100 mg", "daily", date(2023, 4, 1), date(2023, 10, 1), "ferrous sulfate")
    x["d_anti"] = course(nm("Antibiotic"), "500 mg", "three times daily", date(2024, 2, 1), date(2024, 2, 8), why="infection")
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


# ---- GET /labs -----------------------------------------------------------------------------------------------------------------------

def test_the_reports_tab(sv, fake):
    x = invented()
    lb = get(sv, "/labs")["labs"]
    assert set(lb) == {"flagged", "reports", "empty", "hint", "open", "limits"} and lb["open"] is None and lb["empty"] is None
    assert [r["id"] for r in lb["reports"]] == [x["img"], x["r4"], x["r3"], x["r2"], x["r1"]]
    r = lb["reports"][0]
    assert r == {"id": x["img"], "ref": f"R{x['img']}", "date": "2026-10-12", "date_text": "12.10.2026", "title": "Abdominal ultrasound",
                 "kind": "imaging", "provider": "Zz Imaging", "values": 1, "flagged": 1}
    f = lb["flagged"]  # the newest report of type lab, not the imaging one
    assert (f["report_id"], f["date"], f["title"], f["heading"], f["empty"]) == (x["r4"], "2026-10-05", "Annual check-up", "Flagged in your newest report", None)
    assert f["chips"] == [{"test_id": x["t_ferritin"], "test": "Zz Ferritin", "value": "450 ng/mL", "range": "30-400", "flag": "H", "flag_word": "high"}]
    assert lb["limits"] == {"value_max": 60, "unit_max": 30, "ref_max": 60, "title_max": 200, "provider_max": 200, "notes_max": 2000}
    assert lb["hint"].startswith("New reports come in through the chat")


def test_a_report_open(sv, fake):
    x = invented()
    o = get(sv, f"/labs?open=R{x['r3']}")["labs"]["open"]
    assert o == get(sv, f"/labs?open={x['r3']}")["labs"]["open"]
    assert (o["ref"], o["title"], o["kind"], o["notes"], o["empty"]) == (f"R{x['r3']}", "Iron and vitamins", "lab", None, None)
    assert o["form"] == {"collected": "2025-06-20", "title": "Iron and vitamins", "provider": "Zz Lab", "notes": ""}
    fe = o["values"][1]
    assert fe == {"id": x["r3_fe"], "ref": f"V{x['r3_fe']}", "test_id": x["t_ferritin"], "test": "Zz Ferritin", "note": "haemolysed",
                  "text": "12 ng/mL", "value": 12, "unit": "ng/mL", "range": "30-400", "ref_low": 30, "ref_high": 400, "flag": "L",
                  "flag_word": "low", "site": None, "printed": {"value": "12", "unit": "ng/mL", "ref": "30-400"}}
    img = get(sv, f"/labs?open=R{x['img']}")["labs"]["open"]["values"][0]
    assert (img["text"], img["value"], img["site"], img["flag_word"]) == ("slightly enlarged", None, "liver", "abnormal")
    assert get(sv, "/labs?open=R999999")["labs"]["open"] is None  # not there: none open, as app.
    r = sv.c.get("/api/v1/labs?open=V12", headers=sv.h)
    assert r.status_code == 400 and r.json()["message"] == "open must be a report's id (R12 or 12)."


def test_no_reports_yet(sv, fake):
    lb = get(sv, "/labs")["labs"]
    assert (lb["flagged"], lb["reports"], lb["empty"]) == (None, [], "No reports yet.")
    rid = report(date(2026, 1, 1), "Zz empty")
    lb = get(sv, f"/labs?open={rid}")["labs"]
    assert lb["flagged"]["empty"] == "Nothing flagged." and lb["open"]["empty"] == "No values in this report." and lb["open"]["values"] == []


# ---- GET /labs/tests -----------------------------------------------------------------------------------------------------------------

def test_tests_worth_a_chart_and_a_search(sv, fake):
    x = invented()
    t = get(sv, "/labs/tests")["labs_tests"]
    assert t["title"] == "Tests with values on three or more days:" and t["test"] is None and t["card"] is None and t["empty"] is None
    assert {r["name"] for r in t["tests"]} == {"Zz Haemoglobin", "Zz Ferritin", "Zz Vitamin D"} and t["tests"][0]["values"] == 4
    t = get(sv, "/labs/tests?q=zz")["labs_tests"]
    assert t["title"] is None and {r["name"] for r in t["tests"]} >= {"Zz TSH", "Zz Liver", "Zz Ferritin"}
    t = get(sv, "/labs/tests?q=zzqq-nothing")["labs_tests"]
    assert t["tests"] == [] and t["empty"] == "No test with that name. Try another word."
    one = get(sv, "/labs/tests?q=Zz TS")["labs_tests"]  # one match opens it, as app.
    assert one["test"] == {"id": x["t_tsh"], "name": "Zz TSH", "unit": "mIU/L", "values": 1} and one["tests"] == []
    assert one["card"]["chart"] is None and one["card"]["note"] == "Only one value so far; the chart starts with the second."
    assert get(sv, "/labs/tests?q=" + "z" * 80)["labs_tests"]["q"] == "z" * 60


def test_a_test_over_time(sv, fake):
    x = invented()
    t = get(sv, f"/labs/tests?t={x['t_ferritin']}")["labs_tests"]
    c = t["card"]
    assert (c["id"], c["title"], c["small"], c["stat"], c["note"]) == ("test", "Zz Ferritin", "4 values", [], None)
    ch = c["chart"]
    assert (ch["start"], ch["band"], ch["label"], ch["years"]) == ("2023-03-14", [30.0, 400.0], "Zz Ferritin over time", True)
    assert [s["cls"] for s in ch["series"]] == ["a", "a", "w", "r"] and ch["series"][0]["mark"] == "line"
    assert ch["series"][2]["pts"] == [[0, 25.0, "14.03.2023: 25 ng/mL"], [829, 12.0, "20.06.2025: 12 ng/mL"], [1301, 450.0, "05.10.2026: 450 ng/mL"]]
    assert c["legend"] == [{"key": "sq band", "text": "reference range (from the newest value)"}, {"key": "w", "text": "outside the range"}]
    assert [r["date"] for r in t["rows"]] == ["2026-10-05", "2025-06-20", "2024-09-02", "2023-03-14"]
    assert t["rows"][0] == {"id": x["r4_fe"], "date": "2026-10-05", "date_text": "05.10.2026", "site": None, "value": "450 ng/mL", "range": "30-400",
                            "flag": "H", "flag_word": "high", "report_id": x["r4"], "report_ref": f"R{x['r4']}"}
    assert json.loads(html.unescape(labspage.render_tests("x", {"t": str(x["t_ferritin"])}).split('data-chart="')[1].split('"></div>')[0])) == ch


def test_one_day_of_several_sites(sv, fake):
    tid = lab_test("Zz Spleen", "cm", "imaging")
    rid = report(date(2026, 5, 5), "Zz scan", "imaging")
    value(rid, tid, 11, "cm", None, 12, "N", site="spleen")
    value(rid, tid, 12.5, "cm", None, 12, "H", site="spleen", side="left")
    t = get(sv, f"/labs/tests?t={tid}")["labs_tests"]
    assert t["card"]["chart"] is None and t["card"]["note"].startswith("All values are from one day (different sites)")
    assert [r["site"] for r in t["rows"]] == ["left spleen", "spleen"]
    rid2 = report(date(2026, 6, 6), "Zz scan 2", "imaging")
    value(rid2, tid, 11.5, "cm", None, 12, "N", site="spleen")
    c = get(sv, f"/labs/tests?t={tid}")["labs_tests"]["card"]
    assert [s["mark"] for s in c["chart"]["series"]] == ["dot", "dot", "dot"]  # several values on one day: dots without a line
    assert c["legend"][1]["text"] == "outside the range · several values on one day (different sites), so dots without a line"


def test_a_test_that_is_not_there_or_not_an_id(sv, fake):
    invented()
    t = get(sv, "/labs/tests?t=32000")["labs_tests"]  # as app.: no test, the list
    assert t["test"] is None and t["tests"] and t["title"]
    for bad in ("abc", "-1", "T12"):
        r = sv.c.get("/api/v1/labs/tests?t=" + bad, headers=sv.h)
        assert r.status_code == 400 and r.json() == {"v": 1, "error": "bad_request", "message": "t must be a test's id."}


# ---- GET /labs/meds ------------------------------------------------------------------------------------------------------------------

def test_the_medication_tab(sv, fake):
    x = invented()
    m = get(sv, "/labs/meds")["labs_meds"]
    assert m["running"] == 2 and m["empty"] is None and m["hint"].startswith("A new course is a sentence")
    assert [r["id"] for r in m["meds"]] == [x["d_vitd"], x["d_iron"], x["d_anti"], x["d_old"]]
    v = m["meds"][0]
    assert v == {"id": x["d_vitd"], "ref": f"D{x['d_vitd']}", "name": "Zz Vitamin D 1000 IU", "ingredient": "cholecalciferol", "dose": "1000 IU",
                 "frequency": "daily", "indication": "low vitamin D", "start": "2026-09-01", "stop": None, "start_text": "01.09.2026",
                 "stop_text": None, "running": True, "can_end": True}
    iron = m["meds"][1]
    assert iron["running"] and not iron["can_end"] and iron["stop"] == "2099-01-01"  # a stop date ahead: running, no End (as app.)
    assert [r["running"] for r in m["meds"][2:]] == [False, False]
    assert m["limits"] == {"dose_max": 60, "frequency_max": 60, "indication_max": 120}
    owner_sql("DELETE FROM medications")
    m = get(sv, "/labs/meds")["labs_meds"]
    assert (m["meds"], m["running"], m["empty"]) == ([], 0, "No medication recorded.")


# ---- POST /labs/value, /labs/report ---------------------------------------------------------------------------------------------------

def lab_row(vid):
    return owner_sql("SELECT value, unit, value_raw, ref_low, ref_high, ref_range_raw, flag FROM lab_results WHERE id = %s", vid)[0]


def test_a_value_is_shown_first_and_made_after_the_yes(sv, fake):
    x = invented()
    j = shaped(sv.post("/labs/value", id=x["r4_hb"], value="12.9"), "labs")
    assert j["outcome"] == "needs_confirmation" and j["read_back"] and j["confirm"] and float(lab_row(x["r4_hb"])["value"]) == 13.8
    assert j["labs"]["open"]["id"] == x["r4"]  # the report of the change, open
    j = shaped(sv.post("/labs/value", id=x["r4_hb"], value="12.9", confirmed=True, key="ignored"), "labs")
    assert j["outcome"] == "changed" and j["head"] == "Changed Zz Haemoglobin." and j["undo"] is None
    row = lab_row(x["r4_hb"])
    assert (float(row["value"]), row["flag"], row["unit"]) == (12.9, "L", "g/dL")  # unit and range left out: as they were
    v = next(v for v in j["labs"]["open"]["values"] if v["id"] == x["r4_hb"])
    assert (v["text"], v["flag"]) == ("12.9 g/dL", "L")


def test_value_refusals_are_app_s(sv, fake):
    x = invented()
    assert shaped(sv.post("/labs/value", id=x["r4_hb"], value=""), "labs")["reason"] == "The value cannot be empty."
    assert shaped(sv.post("/labs/value", id=x["r4_hb"], value=None), "labs")["reason"] == "The value cannot be empty."
    j = shaped(sv.post("/labs/value", id=x["r4_hb"], value="13.8", unit="g/dL", ref="13.5-17.5"), "labs")
    assert (j["outcome"], j["reason"]) == ("unchanged", "Nothing changed.")
    assert shaped(sv.post("/labs/value", id=999999, value="1"), "labs")["reason"] == "That value is not there any more."
    assert float(lab_row(x["r4_hb"])["value"]) == 13.8


def test_a_report_change(sv, fake):
    x = invented()
    j = shaped(sv.post("/labs/report", id=x["r2"], title="Zz Yearly check-up", collected="2024-09-03"), "labs")
    assert j["outcome"] == "needs_confirmation" and j["labs"]["open"]["title"] == "Annual check-up"
    j = shaped(sv.post("/labs/report", id=x["r2"], title="Zz Yearly check-up", collected="2024-09-03", confirmed=True), "labs")
    assert j["outcome"] == "changed" and j["head"] == "Changed the report."
    o = j["labs"]["open"]
    assert (o["title"], o["date"], o["notes"], o["provider"]) == ("Zz Yearly check-up", "2024-09-03", "Fasting sample.", "Zz Lab")
    assert shaped(sv.post("/labs/report", id=x["r2"], title=""), "labs")["reason"] == "The title cannot be empty."
    assert shaped(sv.post("/labs/report", id=x["r2"], provider=None), "labs")["reason"] == "The lab cannot be empty."
    assert shaped(sv.post("/labs/report", id=x["r2"], collected="03.09.2024"), "labs")["reason"] == "Give the report's date."
    assert shaped(sv.post("/labs/report", id=x["r2"]), "labs")["reason"] == "Nothing changed."
    assert shaped(sv.post("/labs/report", id=999999, title="x"), "labs")["reason"] == "That report is not there any more."
    j = shaped(sv.post("/labs/report", id=x["r2"], notes=None, confirmed=True, view="labs", view_open=f"R{x['r1']}"), "labs")
    assert j["outcome"] == "changed" and j["labs"]["open"]["id"] == x["r1"]
    assert owner_sql("SELECT notes FROM lab_reports WHERE id = %s", x["r2"])[0]["notes"] is None


# ---- POST /labs/med ------------------------------------------------------------------------------------------------------------------

def med_row(mid):
    return owner_sql("SELECT dose, frequency, indication, start_date, stop_date FROM medications WHERE id = %s", mid)[0]


def test_end_a_course_and_end_it_again(sv, fake):
    x = invented()
    j = shaped(sv.post("/labs/med", id=x["d_vitd"], act="end"), "labs_meds")
    assert j["outcome"] == "needs_confirmation" and j["confirm"]["label"] == "Yes, end it today" and med_row(x["d_vitd"])["stop_date"] is None
    j = shaped(sv.post("/labs/med", id=x["d_vitd"], act="end", confirmed=True), "labs_meds")
    assert j["outcome"] == "changed" and j["head"] == "Zz Vitamin D 1000 IU ended today."
    today = owner_sql("SELECT log_day(now()) AS d")[0]["d"]
    assert med_row(x["d_vitd"])["stop_date"] == today and j["labs_meds"]["meds"][0]["can_end"] is False
    again = shaped(sv.post("/labs/med", id=x["d_vitd"], act="end", confirmed=True), "labs_meds")
    assert (again["outcome"], again["reason"]) == ("unchanged", "That course has a stop date already.")


def test_change_a_course(sv, fake):
    x = invented()
    j = shaped(sv.post("/labs/med", id=x["d_vitd"], act="save", dose="2000 IU"), "labs_meds")
    assert j["outcome"] == "needs_confirmation" and med_row(x["d_vitd"])["dose"] == "1000 IU"
    j = shaped(sv.post("/labs/med", id=x["d_vitd"], act="save", dose="2000 IU", confirmed=True), "labs_meds")
    assert j["outcome"] == "changed" and j["head"] == "Changed Zz Vitamin D 1000 IU."
    m = med_row(x["d_vitd"])
    assert (m["dose"], m["frequency"], m["indication"], m["start_date"], m["stop_date"]) == ("2000 IU", "daily", "low vitamin D", date(2026, 9, 1), None)
    j = shaped(sv.post("/labs/med", id=x["d_iron"], act="save", stop=None, indication=None, confirmed=True), "labs_meds")
    m = med_row(x["d_iron"])
    assert j["outcome"] == "changed" and (m["stop_date"], m["indication"]) == (None, None)  # null = empty: running again, no reason


def test_course_refusals_are_app_s(sv, fake):
    x = invented()
    j = shaped(sv.post("/labs/med", id=x["d_old"], act="save", stop="2023-01-01"), "labs_meds")  # before its start
    assert j["outcome"] == "rejected" and j["reason"] == "stop 01.01.2023 lies before start 01.04.2023"
    assert med_row(x["d_old"])["stop_date"] == date(2023, 10, 1)
    assert shaped(sv.post("/labs/med", id=x["d_old"], act="save", start="first of may"), "labs_meds")["reason"] == "Give the start as a date."
    assert shaped(sv.post("/labs/med", id=x["d_old"], act="save"), "labs_meds")["reason"] == "Nothing changed."
    assert shaped(sv.post("/labs/med", id=999999, act="end"), "labs_meds")["reason"] == "That course is not there any more."


# ---- the checks ------------------------------------------------------------------------------------------------------------------

@pytest.mark.parametrize("path,body,why", [
    ("/labs/value", {"id": "V1", "value": "1"}, "id must be a number."),
    ("/labs/value", {"id": 1, "value": 12.9}, "value must be text or null."),
    ("/labs/value", {"id": 1, "value": "1" * 61}, "value must be 60 characters or fewer."),
    ("/labs/value", {"id": 1, "unit": "u" * 31}, "unit must be 30 characters or fewer."),
    ("/labs/report", {"id": 1, "title": "t" * 201}, "title must be 200 characters or fewer."),
    ("/labs/report", {"id": 1, "notes": "n" * 2001}, "notes must be 2000 characters or fewer."),
    ("/labs/report", {"id": 1, "collected": 20240903}, "collected must be a date yyyy-mm-dd or null."),
    ("/labs/med", {"id": 1, "act": "stop"}, "act must be save or end."),
    ("/labs/med", {"id": 1, "act": "save", "dose": 5}, "dose must be text or null."),
    ("/labs/med", {"id": 1, "act": "save", "indication": "i" * 121}, "indication must be 120 characters or fewer."),
    ("/labs/med", {"id": 1, "act": "save", "stop": True}, "stop must be a date yyyy-mm-dd or null."),
])
def test_a_wrong_kind_of_field_is_a_400(sv, fake, path, body, why):
    invented()
    r = sv.raw(path, **body)
    assert r.status_code == 400 and r.json() == {"v": 1, "error": "bad_request", "message": why}


def test_the_views(sv, fake):
    x = invented()
    j = shaped(sv.post("/labs/value", id=x["r4_hb"], value="12.9", view="labs_tests", view_t=x["t_hb"]), "labs_tests")
    assert j["labs_tests"]["test"]["id"] == x["t_hb"]
    j = shaped(sv.post("/labs/value", id=x["r4_hb"], value="12.9", view="labs_tests", view_q="zzqq-nothing"), "labs_tests")
    assert j["labs_tests"]["empty"]
    j = shaped(sv.post("/labs/med", id=x["d_vitd"], act="end", view="labs", view_open="junk"), "labs")
    assert j["labs"]["open"] is None
    assert set(sv.post("/labs/med", id=x["d_vitd"], act="end", view="day")) == KEYS | {"day"}


def test_answers_are_never_cached_and_nothing_reaches_a_log_line(sv, fake, caplog):
    x = invented()
    caplog.set_level(logging.DEBUG)
    for path in ("/labs", f"/labs?open={x['r4']}", f"/labs/tests?t={x['t_hb']}", "/labs/meds"):
        r = sv.c.get("/api/v1" + path, headers=sv.h)
        assert r.headers["cache-control"] == "no-store" and r.headers["x-content-type-options"] == "nosniff"
    r = sv.raw("/labs/value", id=x["r4_hb"], value="12.9", confirmed=True)
    assert r.headers["cache-control"] == "no-store" and r.json()["outcome"] == "changed"
    sv.raw("/labs/med", id=x["d_vitd"], act="end", confirmed=True)
    logged = " ".join(rec.getMessage() for rec in caplog.records)
    for word in ("12.9", "13.8", "Haemoglobin", "Vitamin D", "1000 IU", "cholecalciferol"):
        assert word not in logged, word
    rows = owner_sql("SELECT detail FROM audit_log")
    details = json.dumps([r["detail"] for r in rows])
    assert len(rows) >= 2  # the two changes are audited: by ids and kinds only
    for word in ("12.9", "13.8", "Haemoglobin", "1000 IU"):
        assert word not in details, word


READS = ["/labs", "/labs/tests", "/labs/meds"]
NEW = [("GET", "/api/v1" + p, {}) for p in READS] + [("POST", f"/api/v1/labs/{a}", {"id": 1, "act": "end", "value": "1"}) for a in api.LABS_FORMS]


@pytest.mark.parametrize("method,path,body", NEW)
def test_signed_out_and_door_off(method, path, body, monkeypatch, fake):
    invented()
    c, bearer, _ = signed_in()
    kw = {"json": body} if method == "POST" else {}
    r = c.request(method, path, **kw)  # no session
    assert r.status_code == 401 and r.json()["error"] == "signed_out" and r.headers["cache-control"] == "no-store"
    r = door(token="w" * 40).request(method, path, headers=bearer, **kw)  # a wrong service token
    assert r.status_code == 404 and r.json() == NOT_FOUND
    monkeypatch.setattr(api, "FRONT_TOKEN", "")
    r = c.request(method, path, headers=bearer, **kw)
    assert r.status_code == 404 and r.json() == NOT_FOUND


def test_every_form_has_a_route(sv, fake):
    assert set(api.LABS_FORMS) == set(weblabs.ACTIONS) == {"value", "report", "med"}
    assert sv.c.post("/api/v1/labs/upload", headers=sv.h, json={}).status_code == 404
    assert reads.labs and reads.labs_tests and reads.labs_meds


# ---- a new course: /log, its yes through /answer ----------------------------------------------------------------------------------

SENTENCE = "started vitamin D 1000 IU daily"


@pytest.fixture
def course_line(monkeypatch):
    """The fake AI's two answers for the sentence: a command, and the command reader's med start."""
    from test_log import ANSWERS, COMMANDS, C, P
    monkeypatch.setitem(ANSWERS, SENTENCE, P(intent="command", command_text=SENTENCE))
    monkeypatch.setitem(COMMANDS, SENTENCE, lambda u: C(("med", {"action": "start", "name": "Vitamin D", "dose": "1000 IU", "frequency": "daily"})))


def test_a_new_course_through_log_is_read_back_and_the_yes_shows_it(sv, fake, course_line):
    j = shaped(sv.post("/log", text=SENTENCE, view="labs_meds"), "labs_meds")
    assert j["outcome"] == "needs_confirmation" and "Vitamin D" in (j["read_back"] or "") and n("SELECT count(*) AS n FROM medications") == 0
    assert j["labs_meds"]["meds"] == []
    [q] = j["questions"]
    done = shaped(sv.post("/answer", question_id=q["id"], reply="yes", view="labs_meds"), "labs_meds")
    m = done["labs_meds"]["meds"]
    assert done["outcome"] not in ("rejected", "needs_confirmation") and len(m) == 1
    assert (m[0]["name"], m[0]["dose"], m[0]["frequency"], m[0]["running"]) == ("Vitamin D", "1000 IU", "daily", True)
    assert done["labs_meds"]["running"] == 1 and [c[0] for c in fake.calls] == [SENTENCE, SENTENCE]


# ---- app.'s pages ---------------------------------------------------------------------------------------------------------------

def test_app_s_pages_still_draw(fake, web):
    """app.'s three Medical tabs draw from the same data functions (checked byte for byte against the old code at deploy 104)."""
    x = invented()
    c = web[0]
    page = html.unescape(c.get(f"/web/labs?open=R{x['r3']}&edit=V{x['r3_fe']}").text)
    assert "Flagged in your newest report" in page and "haemolysed" in page and 'name="value" value="12"' in page
    assert "Change date, title or notes" in html.unescape(c.get(f"/web/labs?open=R{x['r2']}&report=1").text)
    page = html.unescape(c.get(f"/web/labs/tests?t={x['t_ferritin']}").text)
    assert "Zz Ferritin" in page and "4 values" in page and "reference range (from the newest value)" in page
    assert "No test with that name. Try another word." in html.unescape(c.get("/web/labs/tests?q=zzqq").text)
    page = html.unescape(c.get(f"/web/labs/meds?edit=D{x['d_vitd']}").text)
    assert "2 running" in page and 'name="dose" value="1000 IU"' in page


from test_web import web  # noqa: E402,F401 - the web app's signed-in client

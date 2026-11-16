"""The JSON door's Health page and body measurements (deploy 91, 16.11.2026; plan in the doc's Current tab, "Step 1 of the move: daily
gaps", 1b): GET /api/v1/health and /body, POST /health/day, /body and /body/skip, and Today's body-measurements-due line in GET /day,
each through app.'s own function (healthpage.load, charts, times_data; bodypage.load; webactions.health_day, body_save, body_skip;
body.due). Every value, day and time is invented."""
from datetime import date, datetime, time, timedelta

import pytest

from app import api, bodypage, healthpage, reads, webactions
from app.when import BERLIN
from conftest import owner_sql
from test_api_door import NOT_FOUND, door, door_on, signed_in  # noqa: F401 - door_on is autouse
from test_api_saves import KEYS, Door, got_undo, n  # noqa: F401
from test_body import seed, vals, woke
from test_log import fake  # noqa: F401 - the AI is a fake: none of these saves may reach it
from test_webhealth import event, measure, today, weights


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


def row_of(h: dict, day: date) -> dict:
    return next(r for r in h["days"] if r["day"] == day.isoformat())


def chart(h: dict, cid: str) -> dict:
    return next(c for c in h["charts"] if c["id"] == cid)


def week(t: date) -> None:
    """Seven invented days: weights, blood pressure morning and evening, fasted sugar, sleeps, a nap, a lone wake-up, check-ins."""
    for i in range(7):
        d = t - timedelta(days=i)
        measure("weight", d, "07:00", 80 + i * 0.2)
        measure("bp", d, "07:05", 120 + i, 80, "morning")
        if i % 2:
            measure("bp", d, "21:00", 130, 85 - i, "evening")
        measure("blood_sugar", d, "07:10", 90 + i, None, "fasted")
        measure("mood", d, "21:00", 1 + i % 5)
        measure("energy", d, "21:01", 5 - i % 5)
        if i != 3:
            event("bed", d - timedelta(days=1), "23:00")
            event("wake", d, "06:30")
    event("wake", t - timedelta(days=3), "05:50")  # a wake-up without a bed time: a tick
    event("bed", t - timedelta(days=2), "14:00")
    event("nap", t - timedelta(days=2), "14:40")


# ---- GET /health ----------------------------------------------------------------------------------------------------------------

def test_the_health_read_is_app_s_page_as_data(sv, fake):
    t = today()
    week(t)
    j = get(sv, "/health?range=7")
    assert set(j) == {"v", "health", "undo"}
    h = j["health"]
    assert h["range"] == 7 and h["ranges"] == [7, 30, 90] and h["today"] == t.isoformat() and h["days_in_range"] == 7
    assert [c["row"] for c in h["columns"]] == ["weight", "bp_morning", "bp_evening", "sugar", "bed", "wake", "mood", "energy"]
    assert [c["kind"] for c in h["columns"]] == ["number", "pair", "pair", "number", "time", "time", "number", "number"]
    assert [r["day"] for r in h["days"]] == [(t - timedelta(days=i)).isoformat() for i in range(7)]  # newest first
    y = row_of(h, t - timedelta(days=1))["values"]
    assert y["weight"]["v1"] == 80.2 and y["weight"]["ref"].startswith("m") and y["weight"]["time"] is None
    assert (y["bp_morning"]["v1"], y["bp_morning"]["v2"]) == (121, 80) and (y["bp_evening"]["v1"], y["bp_evening"]["v2"]) == (130, 84)
    assert y["bed"]["time"] == "23:00" and y["bed"]["ref"].startswith("e") and y["bed"]["at"].startswith((t - timedelta(days=2)).isoformat())
    assert y["wake"]["time"] == "06:30" and y["mood"]["v1"] == 2 and y["energy"]["v1"] == 4
    assert row_of(h, t - timedelta(days=1))["slept_minutes"] == 450
    assert row_of(h, t - timedelta(days=3))["values"]["bed"] is None and row_of(h, t)["values"]["bp_evening"] is None
    # the charts: the same description app. puts into data-chart (healthpage.charts)
    d = healthpage.load(7)
    assert h["charts"] == healthpage.charts(d) and h["times"] == healthpage.times_data(d)
    assert [c["id"] for c in h["charts"]] == ["weight", "bp", "sugar", "sleep", "mood"]
    w = chart(h, "weight")
    assert [s["mark"] for s in w["chart"]["series"]] == ["line", "dot"] and w["chart"]["start"] == (t - timedelta(days=6)).isoformat()
    assert w["stat"] == [{"text": "80 kg", "bold": True}, {"text": " last · ", "bold": False}, {"text": "−1.2 kg", "bold": True},
                         {"text": " in 7 days", "bold": False}]
    bp = chart(h, "bp")["chart"]
    assert [s["mark"] for s in bp["series"]] == ["dot", "dot", "ring", "ring"] and [140, "r", "140"] in bp["lines"]
    assert chart(h, "sugar")["chart"]["lines"] == [[126, "r", "126"], [100, "w", "100"]]
    sl = chart(h, "sleep")
    assert [s["mark"] for s in sl["chart"]["series"]] == ["bar", "line"] and sl["chart"]["lines"] == [[7, "w", "7 h"], [6, "r", "6 h"]]
    assert sl["chart"]["series"][0]["pts"][0][2].startswith("Night to ") and chart(h, "mood")["chart"]["max"] == 5
    assert chart(h, "bp")["legend"][0] == {"key": "a", "text": "systolic"} and chart(h, "bp")["small"] == "mmHg"
    # the sleep times: a row per date, oldest first, bands in minutes from the row's midnight, naps, ticks
    tm = h["times"]
    assert tm["days"] == 7 and len(tm["rows"]) == 7 and tm["rows"][-1]["date"] == t.isoformat() and not tm["empty"]
    last = tm["rows"][-1]
    assert {"from": 0, "to": 390, "nap": False} == {k: last["bands"][-1][k] for k in ("from", "to", "nap")}
    assert any(b["nap"] and b["from"] == 840 and b["to"] == 880 for r in tm["rows"] for b in r["bands"])
    assert any(k["at"] == 350 and k["tip"].startswith("Woke up") for r in tm["rows"] for k in r["ticks"])
    # app.'s page draws the same data
    page = healthpage.render("c", 7)
    assert 'id="c-weight"' in page and "<b>80 kg</b> last" in page and 'class="slp nap"' in page and 'class="up"' in page


def test_fourteen_rows_or_all_of_the_range(sv, fake):
    h = get(sv, "/health")["health"]
    assert h["range"] == 30 and len(h["days"]) == 14 and h["shown_days"] == 14 and not h["all"]
    h = get(sv, "/health?range=30&all=1")["health"]
    assert len(h["days"]) == 30 and h["all"]
    assert len(get(sv, "/health?range=90&all=1")["health"]["days"]) == 90
    for bad in ("14", "x", "-7"):
        assert get(sv, f"/health?range={bad}", status=400)["message"] == "range must be 7, 30 or 90."


def test_an_empty_range_has_empty_charts(sv, fake):
    h = get(sv, "/health?range=7")["health"]
    assert all(all(not s["pts"] for s in c["chart"]["series"]) for c in h["charts"])
    assert chart(h, "weight")["stat"] == [{"text": "no weighings in this range", "bold": False}]
    assert h["times"]["empty"] and all(not r["bands"] and not r["ticks"] for r in h["times"]["rows"])
    assert all(v is None for r in h["days"] for v in r["values"].values()) and h["days"][0]["slept_minutes"] is None


# ---- POST /health/day -------------------------------------------------------------------------------------------------------------

def test_values_added_to_an_empty_day_are_saved_with_undo(sv, fake):
    y = today() - timedelta(days=3)
    j = shaped(sv.post("/health/day", day=y.isoformat(), key="hd-1", range=7,
                       values={"weight": 81.9, "bp_morning": [120, 80], "sugar": 92, "wake": "06:30", "bed": "23:15", "mood": 4}), "health")
    assert j["outcome"] == "saved" and j["head"].startswith(f"Saved for {y:%a %d.%m.}") and fake.calls == []
    assert j["health"]["range"] == 7  # the fresh read of the range asked for
    v = row_of(j["health"], y)["values"]
    assert v["weight"]["v1"] == 81.9 and v["bp_morning"]["v2"] == 80 and v["bed"]["time"] == "23:15" and v["mood"]["v1"] == 4
    u = got_undo(j)
    again = sv.post("/health/day", day=y.isoformat(), key="hd-1", values={"weight": 81.9, "bp_morning": [120, 80], "sugar": 92,
                                                                            "wake": "06:30", "bed": "23:15", "mood": 4})
    # a re-sent key saves once: the values are there now, so health_day has nothing to add (app.'s answer; "unchanged" ends the
    # Undo bar, as on app.)
    assert again["outcome"] == "unchanged" and n("SELECT count(*) AS n FROM measurements") == 4 and again["undo"] is None
    j = sv.post("/health/day", day=y.isoformat(), key="hd-2", values={"energy": 2})
    assert j["outcome"] == "saved" and n("SELECT count(*) AS n FROM measurements") == 5
    u = got_undo(j)
    back = shaped(sv.post("/undo", token=u["token"]), "day")
    assert back["outcome"] == "changed" and n("SELECT count(*) AS n FROM measurements") == 4  # the energy only: the newest save


def test_a_correction_is_made_at_once_and_undo_puts_it_back(sv, fake):
    y = today() - timedelta(days=1)
    measure("weight", y, "07:05", 82.4)
    event("wake", y, "06:40")
    j = shaped(sv.post("/health/day", day=y.isoformat(), values={"weight": 82.1, "wake": "06:45", "sugar": None}), "health")
    assert j["outcome"] == "changed" and "Weight 82.4 → 82.1" in j["head"] and "Woke up 06:40 → 06:45" in j["head"]
    assert weights() == [(y, 82.1)]
    u = got_undo(j)
    back = sv.post("/undo", token=u["token"], view="health")
    assert back["outcome"] == "changed" and weights() == [(y, 82.4)]
    assert row_of(back["health"], y)["values"]["wake"]["time"] == "06:40"
    same = sv.post("/health/day", day=y.isoformat(), values={"weight": 82.4})
    assert same["outcome"] == "unchanged" and same["reason"] == "Nothing changed."


def test_a_delete_asks_once_then_deletes_with_undo(sv, fake):
    y = today() - timedelta(days=1)
    measure("weight", y, "07:05", 82.4)
    measure("bp", y, "07:10", 124, 81, "morning")
    ask = sv.post("/health/day", day=y.isoformat(), values={"weight": None, "bp_morning": None})
    assert ask["outcome"] == "needs_confirmation" and ask["read_back"] == f"Delete on {y:%a %d.%m.}: Weight 82.4, BP morning 124/81?"
    assert ask["confirm"] == {"label": "Yes, delete", "no_label": "No"} and ask["tone"] == "warning"
    assert n("SELECT count(*) AS n FROM measurements") == 2
    done = sv.post("/health/day", day=y.isoformat(), values={"weight": "", "bp_morning": None}, confirm_delete=True)
    assert done["outcome"] == "changed" and n("SELECT count(*) AS n FROM measurements") == 0
    sv.post("/undo", token=got_undo(done)["token"])
    assert n("SELECT count(*) AS n FROM measurements") == 2


def test_an_odd_value_is_read_back_then_saved_on_confirmed(sv, fake):
    y = today() - timedelta(days=1)
    measure("weight", y, "07:05", 82.4)
    ask = sv.post("/health/day", day=y.isoformat(), values={"weight": 400})
    assert ask["outcome"] == "needs_confirmation" and ask["read_back"] and ask["confirm"]["label"] == "Yes, save it"
    assert weights() == [(y, 82.4)]
    assert sv.post("/health/day", day=y.isoformat(), values={"weight": 400}, confirmed=True)["outcome"] == "changed"
    assert weights() == [(y, 400.0)]


def test_a_new_weight_5_kg_away_is_read_back_first(sv, fake):
    t = today()
    measure("weight", t - timedelta(days=2), "07:00", 82.0)
    y = t - timedelta(days=1)
    ask = sv.post("/health/day", day=y.isoformat(), values={"weight": 88.5}, key="hd-jump")
    assert ask["outcome"] == "needs_confirmation" and "5 kg" in (ask["read_back"] or "") + " ".join(q["text"] or "" for q in ask["questions"])
    assert weights() == [(t - timedelta(days=2), 82.0)]
    [q] = ask["questions"]
    assert q["tool"] == "log_confirm" and ask["confirm"] is None  # a new value's check is a question, answered through /answer
    yes = sv.post("/answer", question_id=q["id"], reply="yes")
    assert yes["outcome"] == "saved" and weights()[-1] == (y, 88.5) and fake.calls == []


def test_the_refusals(sv, fake):
    t = today()
    y = t - timedelta(days=1)
    measure("bp", y, "07:10", 124, 81, "morning")
    post = lambda day, **v: sv.post("/health/day", day=day.isoformat(), values=v)  # noqa: E731
    assert post(y, bp_morning=[130, None])["reason"] == "BP morning: give both numbers."
    assert post(y, wake="25:00")["reason"] == "Woke up: give the time as hh:mm."
    assert post(t + timedelta(days=1), weight=80)["reason"] == "Pick a day of the last 12 months."
    assert post(t - timedelta(days=400), weight=80)["reason"] == "Pick a day of the last 12 months."
    assert sv.post("/health/day", day="drop table", values={"weight": 80})["reason"] == "Unknown day."
    assert n("SELECT count(*) AS n FROM measurements") == 1
    for body, msg in ((dict(day=y.isoformat(), values={"weight": "heavy"}), "weight must be a number or null."),
                      (dict(day=y.isoformat(), values={"weight": True}), "weight must be a number or null."),
                      (dict(day=y.isoformat(), values={"bp_morning": 120}), "bp_morning must be [upper, lower] or null."),
                      (dict(day=y.isoformat(), values={"bed": 2300}), "bed must be a time hh:mm or null."),
                      (dict(day=y.isoformat(), values={"steps": 4000}), "Unknown row: steps."),
                      (dict(day=y.isoformat(), values={}), "values must be an object of rows and values."),
                      (dict(day=y.isoformat(), values={"weight": 80}, range=14), "range must be 7, 30 or 90."),
                      (dict(values={"weight": 80}), "day is missing.")):
        r = sv.raw("/health/day", **body)
        assert r.status_code == 400 and r.json() == {"v": 1, "error": "bad_request", "message": msg}, (body, r.text)
    assert n("SELECT count(*) AS n FROM measurements") == 1 and fake.calls == []


def test_the_day_view_and_the_door_s_form_are_app_s(sv, fake, monkeypatch):
    seen = {}
    monkeypatch.setattr(webactions, "health_day", lambda day, r, form, key: seen.update(day=day, r=r, form=dict(form), key=key) or
                        {"outcome": "unchanged", "reason": "Nothing changed."})
    y = (today() - timedelta(days=2)).isoformat()
    j = sv.post("/health/day", day=y, values={"weight": 80.5, "bp_evening": [131, 84], "bed": None, "energy": 3}, confirmed=True,
                confirm_delete=True, key="k-1", range=90, view="day")
    assert "day" in j and "health" not in j
    assert seen == {"day": y, "r": "90", "key": "k-1", "form": {"w": "80.5", "be1": "131", "be2": "84", "bed": "", "en": "3",
                                                                   "confirmed": "1", "confirm_del": "1", "day": y, "r": "90"}}


# ---- GET /body and POST /body -----------------------------------------------------------------------------------------------------

def test_the_body_read_is_app_s_card_as_data(sv, fake):
    t = today()
    seed(t - timedelta(days=56), waist=94.0, hips=102.0)
    seed(t - timedelta(days=28), waist=93.0, hips=102.0, chest=98.0)
    seed(t - timedelta(days=3), waist=92.5, hips=102.5, chest=98.0)
    owner_sql("INSERT INTO body_height (valid_from, height_cm) VALUES (%s, 180)", t - timedelta(days=100))
    for i in range(36):
        measure("weight", t - timedelta(days=i), "07:00", 80 + i * 0.05)
    j = get(sv, "/body")
    assert set(j) == {"v", "body", "undo"}
    b = j["body"]
    assert b["day"] == t.isoformat() and b["last_measured"] == (t - timedelta(days=3)).isoformat() and b["due_text"] == "next due in about 4 weeks"
    assert b["interval_days"] == 28 and b["hidden"] == [] and b["jump_cm"] == 4 and b["protocol"].startswith("Morning, before eating")
    assert [f["key"] for f in b["form"]] == ["waist", "hips", "chest", "upper_arm", "thigh"]
    waist = b["form"][0]
    assert waist["label"] == "Waist" and waist["hint"].startswith("At the navel") and waist["cm"] is None and waist["last_cm"] == 92.5
    assert waist["min"] < 92.5 < waist["max"] and waist["ref"] is None
    [tw, th, tc] = b["table"]
    assert (tw["key"], tw["cm"], tw["last"], tw["start"], tw["last_text"], tw["start_text"]) == ("waist", 92.5, -0.5, -1.5, "−0.5", "−1.5")
    assert tc["last_text"] == "±0" and tc["day"] == (t - timedelta(days=3)).isoformat() and tw["ref"].startswith("m")
    assert b["first_day"] == (t - timedelta(days=56)).isoformat()
    assert [c["key"] for c in b["charts"]] == ["waist", "hips", "chest"]
    sessions = bodypage.load(t, t)["sessions"]
    assert b["charts"][1]["chart"] == bodypage.chart_data("hips", "Hips", sessions, t, 30) and b["charts"][1]["chart"]["xAtPoints"] == 1
    assert b["waist_height"] == {"waist_cm": 92.5, "day": (t - timedelta(days=3)).isoformat(), "height_cm": 180, "ratio": 0.51}
    r = b["weight_rate"]
    assert r["sign"] == "−" and r["kg_week"] < 0 and r["pct_week"] < 0
    # an earlier session asked for: its values in the form, the values before it as the placeholders
    s = get(sv, f"/body?day={(t - timedelta(days=28)).isoformat()}&range=90")["body"]
    assert s["form"][0]["cm"] == 93.0 and s["form"][0]["ref"].startswith("m") and s["form"][0]["last_cm"] == 94.0 and s["form"][3]["cm"] is None
    assert get(sv, "/body?range=12", status=400)["error"] == "bad_request"


def test_the_body_read_before_the_first_measurement(sv, fake):
    owner_sql("""INSERT INTO ui_settings (key, value) VALUES ('body', '{"interval": 42, "hidden": ["chest"]}')""")
    b = get(sv, "/body")["body"]
    assert b["last_measured"] is None and b["due_text"] is None and b["table"] == [] and b["charts"] == [] and b["first_day"] is None
    assert b["waist_height"] is None and b["weight_rate"] is None and b["interval_days"] == 42 and b["hidden"] == ["chest"]
    assert [f["key"] for f in b["form"]] == ["waist", "hips", "upper_arm", "thigh"]


def test_a_session_is_saved_with_undo_and_a_re_sent_key_saves_once(sv, fake):
    t = today()
    seed(t - timedelta(days=28), waist=92.0, hips=100.0)
    j = shaped(sv.post("/body", day=t.isoformat(), values={"waist": 91.5, "hips": 100.5, "chest": None}, key="b-1"), "body")
    assert j["outcome"] == "saved" and j["head"] == f"Saved for {t:%a %d.%m.}: Waist 91.5 added, Hips 100.5 added." and fake.calls == []
    assert j["body"]["form"][0]["cm"] == 91.5 and j["body"]["day"] == t.isoformat()
    back = sv.post("/undo", token=got_undo(j)["token"], view="body")
    assert back["outcome"] == "changed" and vals() == [("waist", 92.0), ("hips", 100.0)] and back["body"]["form"][0]["cm"] is None
    j = sv.post("/body", day=t.isoformat(), values={"waist": 91.5}, key="b-2")
    again = sv.post("/body", day=t.isoformat(), values={"waist": 91.5}, key="b-2")
    assert j["outcome"] == "saved" and again["outcome"] == "unchanged" and len(vals()) == 3  # a re-sent key saves once


def test_a_value_out_of_range_or_a_4_cm_jump_is_read_back(sv, fake):
    t = today()
    seed(t - timedelta(days=28), waist=92.0)
    ask = sv.post("/body", day=t.isoformat(), values={"waist": 96.5})
    assert ask["outcome"] == "needs_confirmation"
    assert ask["read_back"] == "Check: Waist 96.5 cm is 4.5 cm away from last time (92.0). Right?"
    assert ask["confirm"] == {"label": "Yes, save", "no_label": "Fix it"} and len(vals()) == 1
    odd = sv.post("/body", day=t.isoformat(), values={"thigh": 400})
    assert odd["outcome"] == "needs_confirmation" and "outside the usual range" in odd["read_back"]
    yes = sv.post("/body", day=t.isoformat(), values={"waist": 96.5}, confirmed=True)
    assert yes["outcome"] == "saved" and vals()[-1] == ("waist", 96.5)


def test_a_past_session_is_changed_and_a_cleared_value_deleted_after_its_yes(sv, fake):
    d = today() - timedelta(days=10)
    seed(d, waist=92.0, hips=100.0)
    ch = sv.post("/body", day=d.isoformat(), values={"waist": 92.5, "hips": 100})
    assert ch["outcome"] == "changed" and "Waist 92.0 → 92.5" in ch["head"] and ch["body"]["day"] == d.isoformat()
    sv.post("/undo", token=got_undo(ch)["token"])
    assert vals() == [("waist", 92.0), ("hips", 100.0)]
    ask = sv.post("/body", day=d.isoformat(), values={"hips": None})
    assert ask["outcome"] == "needs_confirmation" and ask["read_back"] == f"Delete on {d:%a %d.%m.}: Hips 100.0?"
    assert ask["confirm"] == {"label": "Yes, delete", "no_label": "Keep it"}
    assert sv.post("/body", day=d.isoformat(), values={"hips": ""}, confirm_delete=True)["outcome"] == "changed"
    assert vals() == [("waist", 92.0)]


def test_the_body_refusals(sv, fake):
    t = today()
    post = lambda day, **v: sv.post("/body", day=day.isoformat(), values=v)  # noqa: E731
    assert post(t + timedelta(days=1), waist=90)["reason"] == "Pick a day of the last 12 months."
    assert post(t - timedelta(days=366), waist=90)["reason"] == "Pick a day of the last 12 months."
    assert post(t, waist=-3)["reason"] == "Waist: give a number in cm."
    assert post(t, waist=None)["reason"] == "Nothing to save. Fill at least one field."
    for body, msg in ((dict(day=t.isoformat(), values={"neck": 40}), "Unknown measure: neck."),
                      (dict(day=t.isoformat(), values={"waist": "90"}), "waist must be a number or null."),
                      (dict(day=t.isoformat(), values=[]), "values must be an object of measures and cm."),
                      (dict(values={"waist": 90}), "day is missing.")):
        r = sv.raw("/body", **body)
        assert r.status_code == 400 and r.json()["message"] == msg, (body, r.text)
    assert vals() == []


# ---- Today's due line and "Not today" ---------------------------------------------------------------------------------------------

def test_the_due_line_is_in_the_day_and_not_today_hides_it(sv, fake):
    t = today()
    assert get(sv, "/day")["day"]["needs"]["body_due"] is None  # not before the wake-up
    woke(t)
    assert get(sv, "/day")["day"]["needs"]["body_due"] == {"last": None, "days": None}
    seed(t - timedelta(days=29), waist=92.0)
    assert get(sv, "/day")["day"]["needs"]["body_due"] == {"last": (t - timedelta(days=29)).isoformat(), "days": 29}
    j = shaped(sv.post("/body/skip"), "day")
    assert j["outcome"] == "changed" and j["head"] == "Body measurements hidden until tomorrow." and j["undo"] is None
    assert j["day"]["needs"]["body_due"] is None
    owner_sql("DELETE FROM ui_settings")
    seed(t - timedelta(days=10), waist=92.5)  # measured since: not due
    assert get(sv, "/day")["day"]["needs"]["body_due"] is None
    assert reads.body_due({"last": t, "days": 0}) == {"last": t.isoformat(), "days": 0}


# ---- the door's checks on every new route -------------------------------------------------------------------------------------

NEW = [("GET", "/api/v1/health"), ("POST", "/api/v1/health/day"), ("GET", "/api/v1/body"), ("POST", "/api/v1/body"),
       ("POST", "/api/v1/body/skip")]


@pytest.mark.parametrize("method,path", NEW)
def test_signed_out_and_door_off(method, path, monkeypatch, fake):
    c, bearer, _ = signed_in()
    kw = {"json": {"day": today().isoformat(), "values": {"weight": 80}}} if method == "POST" else {}
    r = c.request(method, path, **kw)  # no session
    assert r.status_code == 401 and r.json()["error"] == "signed_out"
    r = door(token="w" * 40).request(method, path, headers=bearer, **kw)  # a wrong service token
    assert r.status_code == 404 and r.json() == NOT_FOUND
    monkeypatch.setattr(api, "FRONT_TOKEN", "")
    r = c.request(method, path, headers=bearer, **kw)
    assert r.status_code == 404 and r.json() == NOT_FOUND
    assert n("SELECT count(*) AS n FROM measurements") == 0 and n("SELECT count(*) AS n FROM ui_settings WHERE key = 'body_skip'") == 0


def test_an_invented_range_s_chart_data(sv, fake, monkeypatch):
    """The chart data for an invented range: the start, the day indexes and the averages follow the range asked for."""
    t = today()
    for i, kg in enumerate((81.0, 80.6, 80.2)):
        measure("weight", t - timedelta(days=40 + i), "07:00", kg)
    measure("weight", t, "07:00", 79.8)
    h = get(sv, "/health?range=90")["health"]
    w = chart(h, "weight")["chart"]
    assert w["start"] == (t - timedelta(days=89)).isoformat() and w["days"] == 90
    assert [p[0] for p in w["series"][1]["pts"]] == [47, 48, 49, 89] and [p[1] for p in w["series"][1]["pts"]] == [80.2, 80.6, 81.0, 79.8]
    assert w["series"][0]["pts"][-1][1] == 79.8  # no other weighing in the week before the last: its own value
    assert chart(h, "weight")["stat"][2]["text"] == "−0.4 kg"
    h7 = get(sv, "/health?range=7")["health"]
    assert [p[0] for p in chart(h7, "weight")["chart"]["series"][1]["pts"]] == [6]

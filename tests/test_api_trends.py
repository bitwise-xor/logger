"""The JSON door's Trends (deploy 101, 16.11.2026; step 4 of the move to logger.): GET /api/v1/week, /food/trends, /insights and
/coach/status, POST /api/v1/coach/start, each through app.'s own function (weekpage.data, trendspage.data, insightspage.data,
coachpage.week_review, coach.start, coach.status). The AI is a fake (test_coach.FakeCoach): no test reaches the real one. Every food,
number and sentence is invented."""
import html
import json
import re
from datetime import date, datetime, time, timedelta

import pytest

from app import api, coach, coachpage, insightspage, reads, trendspage, weekpage
from app.db import connect
from app.rules import BERLIN
from conftest import owner_sql
from test_api_door import NOT_FOUND, door, door_on, signed_in  # noqa: F401 - door_on is autouse
from test_api_saves import KEYS, Door, n  # noqa: F401
from test_coach import WEEK_BODY, FakeCoach
from test_webhabits import habit_types_as_they_were  # noqa: F401 - autouse: the habit types and settings as they were

TARGETS = (2000, 120, 70, 220)
PLAIN = {"oats": "Oats with milk", "soup": "Lentil soup", "pasta": "Pasta with vegetables", "rice": "Rice & beans", "snack": "Fruit bar",
         "push": "Push", "pull": "Pull & core", "squat": "Squat", "row": "Rowing"}


@pytest.fixture
def ai(monkeypatch):
    """The coach's AI is a fake that answers WEEK_BODY at once (never the real one: a real review costs money)."""
    f = FakeCoach()
    monkeypatch.setattr(coach, "PROVIDER", f)
    monkeypatch.setattr(coach, "BACKGROUND", False)
    return f


@pytest.fixture(autouse=True)
def no_targets_after():
    owner_sql("DELETE FROM food_targets")
    yield
    owner_sql("DELETE FROM food_targets")


def today() -> date:
    return owner_sql("SELECT log_day(now()) AS d")[0]["d"]


def at(d: date, hm: str) -> datetime:
    return datetime.combine(d, time.fromisoformat(hm), BERLIN)


def invented(plain=False, targets=True):
    """About 90 invented days before today: three meals a day (the last one early or late), every 9th day partly logged, every 13th
    without food; bed and wake-up times (a short night every third), a fasting sugar each morning (higher after a late meal or many
    carbs), weight
    on two days of ten (so the "short nights" insight waits), blood pressure, mood and energy, three body measurement sessions,
    two habits and one to avoid on the checklist, and gym workouts (two with a plan day). -> today."""
    nm = (lambda k: PLAIN[k]) if plain else (lambda k: f"Zz {PLAIN[k]}")
    with connect(owner=True) as c:
        t0 = c.execute("SELECT log_day(now()) AS d, now() AS t").fetchone()
        t0, now = t0["d"], t0["t"]
        raw = c.execute("INSERT INTO raw_inbox (channel, content) VALUES ('test', 'by hand') RETURNING id").fetchone()["id"]
        if targets:
            c.execute("INSERT INTO food_targets (valid_from, kcal, protein, fat, carbs) VALUES ('2020-01-01', %s, %s, %s, %s)", TARGETS)
        fid = {}
        for k in ("oats", "soup", "pasta", "rice", "snack"):
            fid[k] = c.execute("""INSERT INTO foods (name, basis, kcal, protein, fat, carbs, source) VALUES (%s, 'g', 150, 8, 4, 20, 'label')
                                  RETURNING id""", (nm(k),)).fetchone()["id"]
        types = {r["name"]: r["id"] for r in c.execute("SELECT name, id FROM log_types").fetchall()}

        def food(d, hm, k, kcal, p, f, cb):
            c.execute("""INSERT INTO food_entries (raw_id, food_id, amount, eaten_at, time_known, day, day_rule, extractor_version, kcal, protein,
                         fat, carbs, source) VALUES (%s, %s, 100, %s, true, %s, 'wake', 'test', %s, %s, %s, %s, 'label')""",
                      (raw, fid[k], at(d, hm), d, kcal, p, f, cb))

        def event(name, d, ts):
            if ts < now:
                c.execute("""INSERT INTO events (raw_id, type_id, day, event_at, time_known, extractor_version) VALUES (%s, %s, %s, %s, true, 'test')""",
                          (raw, types[name], d, ts))

        def measure(name, d, ts, v1, v2=None, period=None):
            if ts < now:
                c.execute("""INSERT INTO measurements (raw_id, type_id, day, event_at, time_known, value1, value2, period, extractor_version)
                             VALUES (%s, %s, %s, %s, true, %s, %s, %s, 'test')""", (raw, types[name], d, ts, v1, v2, period))

        for back in range(1, 92):
            d = t0 - timedelta(days=back)
            late = back % 2 == 1 and back % 3 != 0
            if back % 13 == 0:
                pass
            elif back % 9 == 4:
                food(d, "12:00", "snack", 450, 10, 15, 60)
            else:
                kcal, p, f, cb = 1700 + back * 37 % 700, 80 + back * 7 % 60, 50 + back * 5 % 40, 150 + back * 11 % 150
                food(d, "09:00", "oats", round(kcal * 0.3), round(p * 0.3), round(f * 0.3), round(cb * 0.3))
                food(d, "13:30", "soup" if back % 4 else "rice", round(kcal * 0.3), round(p * 0.3), round(f * 0.3), round(cb * 0.3))
                food(d, "21:45" if back % 2 else "18:00", "pasta", kcal - 2 * round(kcal * 0.3), p - 2 * round(p * 0.3), f - 2 * round(f * 0.3),
                     cb - 2 * round(cb * 0.3))
            bed = at(d + timedelta(days=1), "01:30") if back % 3 == 0 else at(d, "23:30")
            event("bed", d, bed)
            event("wake", d + timedelta(days=1), at(d + timedelta(days=1), "06:00" if back % 4 == 0 else "07:00"))
            measure("blood_sugar", d + timedelta(days=1), at(d + timedelta(days=1), "07:10"),
                    95 + (12 if late else 0) + (7 if back * 11 % 150 > 75 else 0) + back % 5, period="fasted")
            if back % 10 in (0, 1):
                measure("weight", d, at(d, "07:05"), 80 + (back % 6) * 0.2 + back * 0.01)
            if back % 3 == 0:
                measure("bp", d, at(d, "07:20"), 118 + back % 9, 76 + back % 5, period="morning")
            if back % 4 == 0:
                measure("bp", d, at(d, "20:20"), 122 + back % 7, 79 + back % 4, period="evening")
            if back % 2 == 0:
                measure("mood", d, at(d, "21:00"), 1 + back % 5)
                measure("energy", d, at(d, "21:01"), 1 + (back + 2) % 5)
            if back in (40, 12, 3):
                measure("waist", d, at(d, "07:30"), {40: 90.0, 12: 89.0, 3: 88.5}[back])
                if back != 12:
                    measure("hips", d, at(d, "07:31"), {40: 101.0, 3: 100.0}[back])
            if back % 3:
                event("meds", d, at(d, "08:00"))
            if back % 2:
                event("shoonya", d, at(d, "19:00"))
            if back % 5 == 0:
                event("scrolling", d, at(d, "22:00"))
        c.execute("UPDATE log_types SET on_checklist = (name IN ('meds', 'shoonya', 'scrolling')) WHERE kind = 'event'")
        x = {k: c.execute("INSERT INTO exercises (name, kind) VALUES (%s, 'weights') RETURNING id", (nm(k),)).fetchone()["id"] for k in ("squat", "row")}
        days = {k: c.execute("INSERT INTO workout_days (name) VALUES (%s) RETURNING id", (nm(k),)).fetchone()["id"] for k in ("push", "pull")}
        for back, split in ((2, "push"), (5, "pull"), (9, None), (16, "push"), (33, None)):
            w = c.execute("""INSERT INTO workouts (day, started_at, split_day_id) VALUES (%s, %s, %s) RETURNING id""",
                          (t0 - timedelta(days=back), at(t0 - timedelta(days=back), "17:00"), days[split] if split else None)).fetchone()["id"]
            c.execute("INSERT INTO workout_sets (workout_id, exercise_id, sets, reps, kg, sort_order) VALUES (%s, %s, 3, 8, 60, 1)", (w, x["squat"]))
    return t0


def review(p, status="done", body=WEEK_BODY, usd=0.21, error=None, minutes_ago=1, t0=None):
    """A week review of the period p (as the button would save it): done with body, working, failed with error; minutes_ago > 10 on a
    working row = cut off."""
    a, b = weekpage.bounds(p, t0 or today())
    return owner_sql("""INSERT INTO coachings (kind, start_day, end_day, status, body, usd, error, model, created_at, finished_at)
                        VALUES ('week', %s, %s, %s, %s::jsonb, %s, %s, %s, now() - make_interval(mins => %s),
                                CASE WHEN %s = 'working' THEN NULL ELSE now() - make_interval(mins => %s) + interval '40 seconds' END) RETURNING id""",
                     a, b, status, json.dumps(body) if status == "done" else None, usd if status == "done" else None, error,
                     coach.MODEL if status == "done" else None, minutes_ago, status, minutes_ago)[0]["id"]


@pytest.fixture
def sv():
    return Door()


def get(sv, path, status=200):
    r = sv.c.get("/api/v1" + path, headers=sv.h)
    assert r.status_code == status, r.text
    assert r.json()["v"] == 1
    return r.json()


def plain(parts) -> str:
    return "".join(p["text"] for p in parts)


def page_charts(page: str) -> dict:
    """app.'s data-chart objects by the chart's id."""
    return {m[1]: json.loads(html.unescape(m[2])) for m in re.finditer(r'<div class="chart" id="([^"]+)" data-chart="([^"]+)"', page)}


def page_text(fragment: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", fragment))


WEEK = {"p", "periods", "today", "start", "end", "ndays", "empty", "empty_text", "with_food", "dates_text", "days_text", "left_out", "today_text",
        "food", "meter_hint", "health", "health_none", "foods", "charts", "days", "days_none", "review"}
TILE = {"key", "label", "unit", "average", "target", "pct", "level", "over", "average_text", "target_text", "note"}
REVIEW = {"offered", "kind", "start", "end", "title", "small", "state", "id", "wait", "wait_note", "parts", "caution", "meta", "failed", "intro", "cost",
          "button", "links", "blurb", "latest", "weeks"}
CARD = {"id", "title", "small", "stat", "chart", "legend"}


# ---- GET /week ----------------------------------------------------------------------------------------------------------------------

@pytest.mark.parametrize("p", ["7", "last", "30", "this"])
def test_the_week_read_is_app_s_page_as_data(sv, p, monkeypatch):
    t0 = invented()
    wed = t0 - timedelta(days=t0.weekday()) + timedelta(days=2)
    if wed > t0:
        wed -= timedelta(days=7)
    monkeypatch.setattr(weekpage, "today_of", lambda cur: wed)  # a Wednesday: every period has days
    j = get(sv, f"/week?p={p}")
    assert set(j) == {"v", "week", "undo"} and j["undo"] is None
    w = j["week"]
    assert set(w) == WEEK and w["p"] == p and not w["empty"] and w["empty_text"] is None
    a, b = weekpage.bounds(p, wed)
    assert (w["start"], w["end"], w["ndays"], w["today"]) == (a.isoformat(), b.isoformat(), (b - a).days + 1, wed.isoformat())
    assert [(x["p"], x["label"], x["current"]) for x in w["periods"]] == [(k, lbl, k == p) for k, lbl in weekpage.PERIODS]
    page = weekpage.render("x", {"p": p})
    head = f'{w["dates_text"]} · {w["days_text"]}' + (f' · {w["left_out"]}' if w["left_out"] else "") + f' · {w["today_text"]}'
    assert f'<p class="small">{head}</p>' in page and f'{w["with_food"]} of {w["ndays"]} days with food' == w["days_text"]
    # the Food card: tiles and meters as app. draws them
    assert [t["key"] for t in w["food"]] == ["kcal", "protein", "fat", "carbs"] and all(set(t) == TILE for t in w["food"])
    for t in w["food"]:
        assert f'{t["label"]} per day</div><span class="n num">{t["average_text"]}' in page and f'/ {t["target_text"]} {t["unit"]}' in page
        assert f'<td class="{t["level"]}">{t["pct"]:.0f}%</td>' in page and t["level"] == weekpage._pct_class(t["key"], t["average"], t["target"])
    # Health and habits: app.'s rows in app.'s order, with app.'s words
    rows = re.findall(r"<tr><td>([^<]*)</td><td>(.*?)</td></tr>", page.split("<h2>Health and habits</h2>")[1].split("</table>")[0])
    assert [(r["label"], r["value"] + (f' {r["detail"]}' if r["detail"] else "")) for r in w["health"]] == [(k, page_text(v)) for k, v in rows]
    assert {r["key"] for r in w["health"]} >= {"sugar", "sleep", "habits", "avoid", "gym"} | ({"weight", "feel"} if p != "this" else set())
    # the foods, the charts and the days
    for k, title in (("by_kcal", "Most calories"), ("by_count", "Eaten most often")):
        part = page.split(f"<h3>{title}</h3>")[1].split("</table>")[0]
        assert [(html.escape(r["name"]), r["text"]) for r in w["foods"][k]] == re.findall(r"<tr><td>([^<]*)</td><td>([^<]*)</td></tr>", part)
    assert 3 <= len(w["foods"]["by_kcal"]) <= 5
    want = page_charts(page)
    assert [c["id"] for c in w["charts"]] == ["kcal", "protein", "fat", "carbs"] and all(set(c) == CARD for c in w["charts"])
    assert all(c["chart"] == want[f'c-trend-{c["id"]}'] for c in w["charts"])
    table = re.findall(r"<tr><td>(\w\w\w \d\d\.\d\d\.)</td>", page.split("<h2>The days</h2>")[1])
    assert [r["label"] for r in w["days"]] == table and w["days"] == sorted(w["days"], key=lambda r: r["day"], reverse=True)
    assert all(set(r) == {"day", "label", "kcal", "protein", "fat", "carbs", "kg", "partly"} for r in w["days"])
    assert set(w["review"]) == REVIEW and w["review"]["offered"] == (p in ("last", "this"))


def test_the_default_and_a_bad_period(sv):
    invented()
    assert get(sv, "/week")["week"]["p"] == "7"
    for bad in ("8", "next", "LAST"):
        r = sv.c.get(f"/api/v1/week?p={bad}", headers=sv.h)
        assert r.status_code == 400 and r.json() == {"v": 1, "error": "bad_request", "message": "p must be 7, last, 30 or this."}


def test_this_week_on_a_monday_is_empty(sv, monkeypatch):
    t0 = invented()
    monday = t0 - timedelta(days=t0.weekday())
    monkeypatch.setattr(weekpage, "today_of", lambda cur: monday)
    w = get(sv, "/week?p=this")["week"]
    assert w["empty"] and w["ndays"] == 0 and w["empty_text"] == "No complete day in this period yet (this week so far starts after Monday)."
    assert w["food"] == [] and w["health"] == [] and w["charts"] == [] and w["days"] == [] and w["review"] is None and w["dates_text"] is None
    assert f'<p class="empty">{w["empty_text"]}</p>' in weekpage.render("x", {"p": "this"})
    assert not get(sv, "/week?p=last")["week"]["empty"]


def test_targets_missing_and_partly_logged_days(sv):
    invented(targets=False)
    w = get(sv, "/week?p=30")["week"]
    assert all(t["note"] == "no target set" and t["pct"] is None and t["target"] is None and t["level"] is None for t in w["food"])
    assert all(len(c["legend"]) == 2 and "lines" not in c["chart"] for c in w["charts"])
    owner_sql("INSERT INTO food_targets (valid_from, kcal, protein, fat, carbs) VALUES ('2020-01-01', %s, %s, %s, %s)", *TARGETS)
    w = get(sv, "/week?p=30")["week"]
    assert re.fullmatch(r"2 partly logged days left out \(\d\d\.\d\d\., \d\d\.\d\d\.: under half the calorie target\)", w["left_out"]), w["left_out"]
    assert any(r["partly"] for r in w["days"]) and w["left_out"] in plain(w["charts"][0]["stat"])


# ---- the Week review card ------------------------------------------------------------------------------------------------------------

def test_the_review_states(sv, monkeypatch):
    t0 = invented()
    wed = t0 - timedelta(days=(t0.weekday() - 2) % 7 or 7) if t0.weekday() != 2 else t0
    monkeypatch.setattr(weekpage, "today_of", lambda cur: wed)
    page = lambda p: weekpage.render("x", {"p": p})  # noqa: E731
    r = get(sv, "/week?p=last")["week"]["review"]
    a, b = weekpage.bounds("last", wed)
    assert r["offered"] and r["state"] == "none" and r["id"] is None and (r["start"], r["end"]) == (a.isoformat(), b.isoformat())
    assert r["button"] == "Review last week" and r["intro"].startswith("The period against your targets") and r["cost"] == "about 45 seconds · about 20 cents"
    assert f'>{r["button"]}</button>' in page("last") and f'<p class="small coc">{r["cost"]}</p>' in page("last")
    assert [x["label"] for x in r["links"]] == ["All coachings", "Your goals"] and r["title"] == "Week review" and r["small"] == "this period · on demand"
    assert get(sv, "/week?p=this")["week"]["review"]["button"] == "Review this week so far"
    # working, and the poll
    cid = review("last", "working", t0=wed)
    r = get(sv, "/week?p=last")["week"]["review"]
    assert r["state"] == "working" and r["id"] == cid and r["wait"] == "Reviewing… about 45 seconds" and r["button"] is None
    assert f'data-coach-wait="{cid}"' in page("last") and r["wait_note"] in page("last")
    assert get(sv, f"/coach/status?id={cid}")["coaching"] == {"id": cid, "state": "working"}
    # cut off (app.'s stale rule): failed, with app.'s words
    owner_sql("UPDATE coachings SET created_at = now() - interval '11 minutes' WHERE id = %s", cid)
    r = get(sv, "/week?p=last")["week"]["review"]
    assert r["state"] == "failed" and r["failed"] == "That did not work (cut off); nothing was charged if the AI did not answer. Try again."
    assert f'<p class="notice">{r["failed"]}</p>' in page("last") and r["button"] == "Review last week"
    assert get(sv, f"/coach/status?id={cid}")["coaching"]["state"] == "failed"
    # failed
    cid = review("last", "failed", error="ProviderError", t0=wed)
    r = get(sv, "/week?p=last")["week"]["review"]
    assert r["state"] == "failed" and r["id"] == cid and "(ProviderError)" in r["failed"]
    # done, with the owner's switches
    owner_sql("""INSERT INTO ui_settings (key, value) VALUES ('coach', '{"hidden": ["week:habits"]}')""")
    cid = review("last", body=dict(WEEK_BODY, doctor="Ask a doctor about the sugar."), t0=wed)
    r = get(sv, "/week?p=last")["week"]["review"]
    assert r["state"] == "done" and r["id"] == cid and r["button"] == "Review again" and r["caution"] == coachpage.CAUTION
    assert [x["key"] for x in r["parts"]] == ["targets", "trends", "days", "focus", "doctor"]
    assert [x["style"] for x in r["parts"]] == ["list", "list", "list", "numbered", "note"]
    assert r["parts"][2]["items"] == [WEEK_BODY["best_day"], WEEK_BODY["hardest_day"]] and r["parts"][2]["title"] == "Best and hardest day"
    assert r["parts"][4]["text"] == "Ask a doctor about the sugar." and r["parts"][0]["items"] == WEEK_BODY["targets"]
    m = r["meta"]
    assert m["model"] == "Claude Opus" and m["usd"] == 0.21 and re.fullmatch(r"\d\d\.\d\d\. \d\d:\d\d", m["at_text"])
    assert m["text"] == f'Claude Opus · $0.21 · {m["at_text"]}' and m["text"] in page("last") and "Habits, gym and home" not in page("last")
    for x in r["parts"][:2]:
        assert f'<h3>{x["title"]}</h3><ul>' + "".join(f"<li>{html.escape(i)}</li>" for i in x["items"]) in page("last")
    assert get(sv, f"/coach/status?id={cid}")["coaching"]["state"] == "done"
    # the rolling periods: not offered, the latest done review's period
    r = get(sv, "/week?p=7")["week"]["review"]
    assert not r["offered"] and r["state"] is None and r["blurb"] == "The review looks at one week from Monday to Sunday."
    assert r["latest"] == {"start": a.isoformat(), "end": b.isoformat(), "text": f"Latest review: {a:%d.%m.} to {b:%d.%m.}"}
    assert [w_["p"] for w_ in r["weeks"]] == ["last", "this"] and f'{r["latest"]["text"]} ›</a>' in page("7")


def test_the_status_poll(sv):
    assert get(sv, "/coach/status?id=999")["coaching"] == {"id": 999, "state": "gone"}
    for bad in ("", "x", "-1", "1.5", "1" * 13):
        r = sv.c.get(f"/api/v1/coach/status?id={bad}", headers=sv.h)
        assert r.status_code == 400 and r.json()["message"] == "id must be a coaching's id."


# ---- POST /coach/start ---------------------------------------------------------------------------------------------------------------

def test_a_review_starts_through_app_s_function(sv, ai):
    t0 = invented()
    a, b = weekpage.bounds("last", t0)
    j = sv.post("/coach/start", kind="week", start=a.isoformat(), end=b.isoformat())
    assert set(j) == KEYS | {"week", "coaching"} and j["outcome"] == "changed" and j["head"] == "The coach is reading your week: about 45 seconds."
    row = owner_sql("SELECT id, kind, start_day, end_day, status FROM coachings")[0]
    assert (row["kind"], row["start_day"], row["end_day"], row["status"]) == ("week", a, b, "done") and len(ai.calls) == 1
    assert j["coaching"] == {"id": row["id"], "state": "done"} and j["undo"] is None
    assert j["week"]["p"] == "last" and j["week"]["review"]["state"] == "done" and j["week"]["review"]["id"] == row["id"]
    assert "Against your targets" in weekpage.render("x", {"p": "last"})
    other = sv.post("/coach/start", kind="week", start=a.isoformat(), end=b.isoformat(), view="week", view_p="30")
    assert other["week"]["p"] == "30" and other["coaching"]["id"] == row["id"] + 1 and len(ai.calls) == 2
    assert set(sv.post("/coach/start", kind="week", start=a.isoformat(), end=b.isoformat(), view="day")) == KEYS | {"day", "coaching"}


def test_already_on_it_the_daily_limit_and_refusals(sv, ai):
    t0 = today()
    a, b = weekpage.bounds("last", t0)
    cid = review("last", "working")
    j = sv.post("/coach/start", kind="week", start=a.isoformat(), end=b.isoformat())
    assert j["outcome"] == "changed" and j["head"] == "The coach is already on it." and j["coaching"] == {"id": cid, "state": "working"}
    assert len(ai.calls) == 0 and n("SELECT count(*) AS n FROM coachings") == 1
    owner_sql("DELETE FROM coachings")
    for _ in range(coach.DAILY_LIMIT):
        owner_sql("INSERT INTO coachings (kind, start_day, end_day, status) VALUES ('day', %s, %s, 'done')", t0, t0)
    j = sv.post("/coach/start", kind="week", start=a.isoformat(), end=b.isoformat())
    assert j["outcome"] == "rejected" and j["tone"] == "warning" and j["coaching"] is None
    assert j["reason"] == "That is 10 coachings today, the daily limit. Tomorrow there are new ones." and len(ai.calls) == 0
    owner_sql("DELETE FROM coachings")
    for start, end in ((t0 - timedelta(days=40), t0 - timedelta(days=1)), (t0 - timedelta(days=3), t0 + timedelta(days=1)),
                       (t0 - timedelta(days=1), t0 - timedelta(days=3)), (date(2026, 2, 28), date(2026, 2, 28) + timedelta(days=40))):
        j = sv.post("/coach/start", kind="week", start=start.isoformat(), end=end.isoformat())
        assert j["outcome"] == "rejected" and j["reason"] == "That is not a day or week to coach." and j["coaching"] is None
    j = sv.post("/coach/start", kind="week", start="2026-02-30", end="2026-03-02")
    assert j["reason"] == "That is not a day or week to coach." and j["week"]["p"] == "7"
    assert n("SELECT count(*) AS n FROM coachings") == 0 and len(ai.calls) == 0


@pytest.mark.parametrize("body,why", [
    ({"start": "2026-11-02", "end": "2026-11-08"}, 'kind must be "week" (a day coaching is not in the door yet).'),
    ({"kind": "day", "start": "2026-11-02", "end": "2026-11-02"}, 'kind must be "week" (a day coaching is not in the door yet).'),
    ({"kind": "week", "end": "2026-11-08"}, "start must be a date yyyy-mm-dd."),
    ({"kind": "week", "start": "2026-11-02", "end": 20261108}, "end must be a date yyyy-mm-dd."),
    ({"kind": "week", "start": "02.11.2026", "end": "2026-11-08"}, "start must be a date yyyy-mm-dd."),
])
def test_a_wrong_field_is_a_400(sv, ai, body, why):
    r = sv.raw("/coach/start", **body)
    assert r.status_code == 400 and r.json() == {"v": 1, "error": "bad_request", "message": why}
    assert n("SELECT count(*) AS n FROM coachings") == 0 and len(ai.calls) == 0


def test_a_failed_review_says_so(sv, ai):
    ai.fail = True
    a, b = weekpage.bounds("last", today())
    j = sv.post("/coach/start", kind="week", start=a.isoformat(), end=b.isoformat())
    assert j["outcome"] == "changed" and j["coaching"]["state"] == "failed"
    assert j["week"]["review"]["state"] == "failed" and "(ProviderError)" in j["week"]["review"]["failed"]


# ---- GET /food/trends ----------------------------------------------------------------------------------------------------------------

@pytest.mark.parametrize("rng", [7, 30, 90])
def test_the_trends_read_is_app_s_tab_as_data(sv, rng):
    t0 = invented()
    j = get(sv, f"/food/trends?range={rng}")
    assert set(j) == {"v", "trends", "undo"}
    t = j["trends"]
    end, start = t0 - timedelta(days=1), t0 - timedelta(days=rng)
    assert set(t) == {"range", "ranges", "start", "end", "title", "small", "charts"} and t["ranges"] == [7, 30, 90]
    assert (t["range"], t["start"], t["end"]) == (rng, start.isoformat(), end.isoformat())
    assert t["title"] == f"Last {rng} complete days" and t["small"] == f"{start:%d.%m.} to {end:%d.%m.}, today not counted"
    page = trendspage.render("x", {"r": str(rng)})
    assert f'<h2>{t["title"]} <span class="small">{t["small"]}</span></h2>' in page
    want = page_charts(page)
    stats = re.findall(r'<p class="stat">(.*?)</p>', page)
    legends = re.findall(r'<p class="legend">(.*?)</p>', page)
    for c, stat, legend in zip(t["charts"], stats, legends, strict=True):
        assert set(c) == CARD and c["chart"] == want[f'c-trend-{c["id"]}'] and c["small"] == "per day"
        assert plain(c["stat"]) == page_text(stat) and [p["text"] for p in c["stat"] if p["bold"]] == re.findall(r"<b>([^<]*)</b>", stat)
        assert [k["text"] for k in c["legend"]] == ["day", "7-day average", "target"] and "target" in page_text(legend)
    kcal, protein = t["charts"][0], t["charts"][1]
    assert plain(kcal["stat"]).startswith("average ") and " · target 2,000 · over the target on " in plain(kcal["stat"])
    assert " · target reached on " in plain(protein["stat"]) and kcal["chart"]["lines"] == [[2000.0, "t", "2,000"]]


def test_trends_default_bad_range_and_no_food(sv):
    t = get(sv, "/food/trends")["trends"]
    assert t["range"] == 30 and [plain(c["stat"]) for c in t["charts"]] == ["no complete days with food in this range"] * 4
    for bad in ("14", "x", "7.0"):
        r = sv.c.get(f"/api/v1/food/trends?range={bad}", headers=sv.h)
        assert r.status_code == 400 and r.json() == {"v": 1, "error": "bad_request", "message": "range must be 7, 30 or 90."}


# ---- GET /insights -------------------------------------------------------------------------------------------------------------------

def test_the_insights_read_is_app_s_page_as_data(sv):
    invented()
    i = get(sv, "/insights")["insights"]
    assert set(i) == {"days", "min_each", "title", "small", "cards", "note"} and (i["days"], i["min_each"]) == (90, 4)
    page = insightspage.render("x")
    assert f'<span class="small">{i["small"]}</span>' in page and i["note"] in page
    assert [c["key"] for c in i["cards"]] == ["late", "sleep", "carbs"] and [c["waiting"] for c in i["cards"]] == [False, True, False]
    wait = i["cards"][1]
    assert wait["wait_text"].startswith("Not enough days yet: ") and wait["chip"] is None and wait["say"] is None
    assert html.escape(wait["wait_text"], quote=False) in page and [g["n"] for g in wait["groups"]] == [int(x) for x in re.findall(r"(\d+) for", wait["wait_text"])]
    for c in (i["cards"][0], i["cards"][2]):
        assert f'<h2>{c["title"]}<span class="dp">{c["chip"]}</span></h2>' in page
        said = "".join(f'<b>{p["text"]}</b>' if p["bold"] else p["text"] for p in c["say"])
        assert f'<p class="isay">{said}</p>' in page and [p["text"] for p in c["say"] if p["bold"]] == [g["text"] for g in c["groups"]]
        for g in c["groups"]:
            assert g["n"] >= 4 and f'x="{g["left"]:.1f}" width="{g["width"]:.1f}"' in page and f'<span class="ib-v num">{g["text"]}</span>' in page
            assert set(g) == {"key", "label", "n", "mean", "text", "cls", "left", "width"}
        assert c["unit"] == "mg/dL" and c["digits"] == 0 and c["sign"] is False and c["zero"] == 0


def test_insights_with_no_data_all_wait(sv):
    cards = get(sv, "/insights")["insights"]["cards"]
    assert all(c["waiting"] and c["wait_text"] for c in cards) and all(g["n"] == 0 for c in cards for g in c["groups"])


# ---- the door's own checks and app.'s pages ---------------------------------------------------------------------------------------------

NEW = [("GET", "/api/v1/week", {}), ("GET", "/api/v1/food/trends", {}), ("GET", "/api/v1/insights", {}), ("GET", "/api/v1/coach/status?id=1", {}),
       ("POST", "/api/v1/coach/start", {"kind": "week", "start": "2026-11-02", "end": "2026-11-08"})]


@pytest.mark.parametrize("method,path,body", NEW)
def test_signed_out_and_door_off(method, path, body, monkeypatch, ai):
    c, bearer, _ = signed_in()
    kw = {"json": body} if method == "POST" else {}
    r = c.request(method, path, **kw)  # no session
    assert r.status_code == 401 and r.json()["error"] == "signed_out"
    r = door(token="w" * 40).request(method, path, headers=bearer, **kw)  # a wrong service token
    assert r.status_code == 404 and r.json() == NOT_FOUND
    monkeypatch.setattr(api, "FRONT_TOKEN", "")
    r = c.request(method, path, headers=bearer, **kw)
    assert r.status_code == 404 and r.json() == NOT_FOUND
    assert n("SELECT count(*) AS n FROM coachings") == 0 and len(ai.calls) == 0


def test_app_s_pages_still_draw(web, ai):
    """app.'s Week (four periods), Trends (three ranges) and Insights pages draw from the same data functions (checked byte for byte
    against the old code at deploy 101)."""
    invented()
    review("last")
    for path in ("/web/week", "/web/week?p=last", "/web/week?p=30", "/web/week?p=this", "/web/food/trends?r=7", "/web/food/trends?r=90",
                 "/web/insights", "/web/coach"):
        r = web[0].get(path)
        assert r.status_code == 200 and ("<h1>" in r.text or "<h2>" in r.text), path
    assert "Against your targets" in web[0].get("/web/week?p=last").text
    assert reads.week and reads.food_trends and reads.insights


from test_web import web  # noqa: E402,F401 - the web app's signed-in client

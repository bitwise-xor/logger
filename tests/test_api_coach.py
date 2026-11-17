"""The JSON door's Coach (deploy 107, 17.11.2026; step 6 of the move to logger.): GET /api/v1/coach (app.'s Coach page through
coachpage.list_data, with the Coach card of a day through coachpage.card_data), Today's Coach card in GET /day, and POST /coach/start
with kind "day" (app.'s "Coach me": coach.start with its checks). The AI is a fake (test_coach.FakeCoach): no test reaches the real
one. Every number and sentence is invented."""
import html
import json
import re
from datetime import timedelta

import pytest

from app import coach, coachpage, uiprefs
from conftest import owner_sql
from test_api_door import door_on, signed_in  # noqa: F401 - door_on is autouse
from test_api_saves import KEYS, Door, n  # noqa: F401
from test_coach import DAY_BODY, WEEK_BODY, FakeCoach


@pytest.fixture
def ai(monkeypatch):
    """The coach's AI is a fake that answers at once (never the real one: a real coaching costs money)."""
    f = FakeCoach()
    monkeypatch.setattr(coach, "PROVIDER", f)
    monkeypatch.setattr(coach, "BACKGROUND", False)
    return f


@pytest.fixture
def sv():
    return Door()


def today():
    return owner_sql("SELECT log_day(now()) AS d")[0]["d"]


def get(sv, path, status=200):
    r = sv.c.get("/api/v1" + path, headers=sv.h)
    assert r.status_code == status, r.text
    assert r.json()["v"] == 1
    return r.json()


def coaching(kind, a, b=None, status="done", body=None, usd=0.06, error=None, minutes_ago=1):
    """A coaching row as coach.start and coach.run leave it."""
    body = body or (DAY_BODY if kind == "day" else WEEK_BODY)
    return owner_sql("""INSERT INTO coachings (kind, start_day, end_day, status, body, usd, error, model, created_at, finished_at)
                        VALUES (%s, %s, %s, %s, %s::jsonb, %s, %s, %s, now() - make_interval(mins => %s),
                                CASE WHEN %s = 'working' THEN NULL ELSE now() - make_interval(mins => %s) + interval '30 seconds' END) RETURNING id""",
                     kind, a, b or a, status, json.dumps(body) if status == "done" else None, usd if status == "done" else None, error,
                     coach.MODEL if status == "done" else None, minutes_ago, status, minutes_ago)[0]["id"]


def invented() -> dict:
    """Five finished coachings (three days, two weeks; one last month), one still working and one failed. -> the ids."""
    t = today()
    mon = t - timedelta(days=t.weekday() + 7)
    return {"d1": coaching("day", t - timedelta(days=1), minutes_ago=60 * 20, usd=0.061),
            "d2": coaching("day", t - timedelta(days=3), minutes_ago=60 * 70,
                           body=dict(DAY_BODY, doctor="Ask your doctor about the invented value.")),
            "w1": coaching("week", mon, mon + timedelta(days=6), minutes_ago=60 * 30, usd=0.2),
            "w_old": coaching("week", mon - timedelta(days=7), mon - timedelta(days=1), minutes_ago=60 * 24 * 40, usd=0.19),
            "d_old": coaching("day", t - timedelta(days=41), minutes_ago=60 * 24 * 41, usd=0.05),
            "working": coaching("day", t, status="working"),
            "failed": coaching("day", t - timedelta(days=2), status="failed", error="ProviderError", minutes_ago=60 * 40)}


COACH = {"f", "filters", "list", "empty", "month", "note", "day", "card"}
ITEM = {"id", "kind", "start", "end", "heading", "first", "parts", "caution", "meta"}
CARD = {"kind", "start", "end", "title", "small", "state", "id", "wait", "wait_note", "parts", "caution", "meta", "failed", "intro", "cost",
        "button", "links"}
PART = {"key", "title", "style", "tone", "items", "meal", "text"}


def text_of(fragment: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", fragment))


# ---- GET /coach -------------------------------------------------------------------------------------------------------------------

@pytest.mark.parametrize("f", ["all", "days", "weeks"])
def test_the_coach_read_is_app_s_page_as_data(sv, f):
    x = invented()
    c = get(sv, f"/coach?f={f}")["coach"]
    assert set(c) == COACH and c["f"] == f and [(i["f"], i["current"]) for i in c["filters"]] == [(k, k == f) for k in ("all", "days", "weeks")]
    assert all(set(i) == ITEM and all(set(p) == PART for p in i["parts"]) for i in c["list"])
    want = {"all": ["d1", "w1", "d2", "w_old", "d_old"], "days": ["d1", "d2", "d_old"], "weeks": ["w1", "w_old"]}[f]
    assert [i["id"] for i in c["list"]] == [x[k] for k in want]  # done only, newest first
    page = coachpage.render("x", {"f": f})
    summaries = re.findall(r"<summary>(.*?)</summary>", page)
    assert [(i["heading"], i["kind"], i["first"], i["meta"]["text"]) for i in c["list"]] == [
        (text_of(b), k, text_of(first), text_of(meta)) for b, k, first, meta in
        (re.match(r'<span class="row"><b>(.*?)</b><span class="pill ok">(.*?)</span></span><span>(.*?)</span><span class="small">(.*?)</span>', s).groups()
         for s in summaries)]
    assert f'{c["note"]} {c["month"]["text"]}' in html.unescape(page)
    if not early_in_month():  # not filtered: this month's three
        assert (c["month"]["count"], c["month"]["usd"]) == (3, 0.321)
    assert c["day"] == today().isoformat() and c["card"]["state"] == "working" and c["card"]["id"] == x["working"]


def early_in_month() -> bool:
    """The coachings 20 to 70 hours ago fall into last month on the first three days of a month."""
    return owner_sql("SELECT extract(day FROM now() AT TIME ZONE 'Europe/Berlin') AS d")[0]["d"] <= 3


def test_a_coaching_in_the_list(sv):
    x = invented()
    t = today()
    c = get(sv, "/coach?f=days")["coach"]
    d2 = next(i for i in c["list"] if i["id"] == x["d2"])
    assert d2["kind"] == "day" and d2["start"] == d2["end"] == (t - timedelta(days=3)).isoformat()
    assert d2["heading"] == f"{t - timedelta(days=3):%a %d.%m.}" and d2["first"] == "Carbs are high from the rolls."
    assert [p["key"] for p in d2["parts"]] == ["went_well", "improve", "next_meal", "gaps", "doctor"]
    assert d2["parts"][2]["meal"] == {"title": "Salmon 150 g with broccoli", "why": "Fits what is left.", "kcal": 380, "protein": 34, "carbs": 6,
                                      "fat": 25, "macros": "380 kcal · 34 g protein · 6 g carbs · 25 g fat"}
    assert d2["parts"][0]["tone"] == "ok" and d2["parts"][1]["tone"] == "warn" and d2["parts"][4]["text"] == "Ask your doctor about the invented value."
    assert d2["caution"] == "Comments only on what you logged; not medical advice." and d2["meta"]["model"] == "Claude Opus"
    assert d2["meta"]["usd"] == 0.06 and d2["meta"]["text"].startswith("Claude Opus · $0.06 · ")
    w = get(sv, "/coach?f=weeks")["coach"]["list"][0]
    assert w["heading"].startswith("Week ") and w["first"] == "Protein at breakfast." and w["parts"][-1]["style"] == "numbered"


def test_the_parts_switched_off_are_left_out(sv):
    x = invented()
    owner_sql("""INSERT INTO ui_settings (key, value) VALUES ('coach', '{"hidden": ["day:next_meal", "day:doctor", "week:habits"]}')""")
    c = get(sv, "/coach")["coach"]
    d2 = next(i for i in c["list"] if i["id"] == x["d2"])
    w1 = next(i for i in c["list"] if i["id"] == x["w1"])
    assert [p["key"] for p in d2["parts"]] == ["went_well", "improve", "gaps"] and "habits" not in [p["key"] for p in w1["parts"]]
    page = coachpage.render("x", {})
    assert "Salmon 150 g" not in page and "Stretching 6 of 7 days." not in page and "Salmon" not in json.dumps(c)


def test_the_coach_card_of_a_day(sv):
    x = invented()
    t = today()
    assert get(sv, f"/coach?day={t - timedelta(days=1)}")["coach"]["card"]["state"] == "done"
    card = get(sv, f"/coach?day={t - timedelta(days=1)}")["coach"]["card"]
    assert set(card) == CARD and card["id"] == x["d1"] and card["button"] == "Coach me again" and card["title"] == "Coach"
    assert card["small"] == "this day · on demand" and [p["key"] for p in card["parts"]] == ["went_well", "improve", "next_meal", "gaps"]
    assert card["meta"]["usd"] == 0.061 and card["start"] == card["end"] == (t - timedelta(days=1)).isoformat()
    failed = get(sv, f"/coach?day={t - timedelta(days=2)}")["coach"]["card"]
    assert failed["state"] == "failed" and "(ProviderError)" in failed["failed"] and failed["button"] == "Coach me"
    none = get(sv, f"/coach?day={t - timedelta(days=5)}")["coach"]["card"]
    assert none["state"] == "none" and none["id"] is None and none["cost"] == "about 30 seconds · about 6 cents"
    assert none["intro"].startswith("A short look at this day")
    work = get(sv, "/coach")["coach"]["card"]
    assert work["state"] == "working" and work["wait"] == "Coaching… about 30 seconds" and work["button"] is None


def test_no_coachings_yet(sv):
    c = get(sv, "/coach")["coach"]
    assert c["list"] == [] and c["empty"].startswith("No coachings yet.") and c["month"] == {"count": 0, "usd": 0, "text":
                                                                                              "This month: 0 coachings · $0.00 (also on the Usage page)."}
    assert c["card"]["state"] == "none"


@pytest.mark.parametrize("query,why", [("f=day", "f must be all, days or weeks."), ("f=ALL", "f must be all, days or weeks."),
                                       ("day=17.11.2026", "day must be yyyy-mm-dd."), ("day=2026-02-30", "day must be yyyy-mm-dd."),
                                       ("day=2999-01-01", "day must not be after today.")])
def test_a_bad_filter_or_day_is_a_bad_request(sv, query, why):
    r = sv.c.get(f"/api/v1/coach?{query}", headers=sv.h)
    assert r.status_code == 400 and r.json() == {"v": 1, "error": "bad_request", "message": why}


def test_tomorrow_is_a_bad_request(sv):
    r = sv.c.get(f"/api/v1/coach?day={today() + timedelta(days=1)}", headers=sv.h)
    assert r.status_code == 400 and r.json()["message"] == "day must not be after today."


# ---- Today's Coach card (GET /day) ------------------------------------------------------------------------------------------------

def test_today_has_the_coach_card_unless_it_is_hidden(sv):
    x = invented()
    t = today()
    card = get(sv, "/day")["day"]["coach"]
    assert set(card) == CARD and card["state"] == "working" and card["id"] == x["working"]
    past = get(sv, f"/day?day={t - timedelta(days=1)}")["day"]["coach"]  # earlier days too, as app.
    assert past["state"] == "done" and past["id"] == x["d1"]
    uiprefs.save(["card:coach"], {})
    assert get(sv, "/day")["day"]["coach"] is None and get(sv, f"/day?day={t - timedelta(days=1)}")["day"]["coach"] is None
    uiprefs.save(["card:home"], {})  # another card hidden: the Coach card shows
    assert get(sv, "/day")["day"]["coach"]["state"] == "working"


# ---- POST /coach/start, kind "day" ------------------------------------------------------------------------------------------------

def test_a_day_coaching_runs_end_to_end_with_the_fake(sv, ai, monkeypatch):
    t = today()
    later, run = [], coach.run
    monkeypatch.setattr(coach, "run", lambda cid: later.append(cid))  # the background thread, held back: the row stays "working"
    j = sv.post("/coach/start", kind="day", start=t.isoformat(), end=t.isoformat())
    assert set(j) == KEYS | {"day", "coaching"} and j["outcome"] == "changed" and j["head"] == "The coach is reading your day: about 30 seconds."
    row = owner_sql("SELECT id, kind, start_day, end_day, status FROM coachings")[0]
    assert (row["kind"], row["start_day"], row["end_day"], row["status"]) == ("day", t, t, "working") and later == [row["id"]]
    assert j["coaching"] == {"id": row["id"], "state": "working"} and j["day"]["day"] == t.isoformat()
    assert j["day"]["coach"]["state"] == "working" and j["day"]["coach"]["id"] == row["id"] and j["undo"] is None
    assert sv.c.get(f"/api/v1/coach/status?id={row['id']}", headers=sv.h).json()["coaching"]["state"] == "working"
    run(row["id"])  # the thread's work, here: the fake answers
    assert len(ai.calls) == 1 and "went_well" in ai.calls[0]["schema"]["properties"] and ai.calls[0]["model"] == coach.MODEL
    assert sv.c.get(f"/api/v1/coach/status?id={row['id']}", headers=sv.h).json()["coaching"]["state"] == "done"
    card = get(sv, "/day")["day"]["coach"]
    assert card["state"] == "done" and [p["key"] for p in card["parts"]] == ["went_well", "improve", "next_meal", "gaps"]
    assert card["parts"][0]["items"] == DAY_BODY["went_well"] and card["meta"]["usd"] > 0 and card["button"] == "Coach me again"
    assert get(sv, "/coach?f=days")["coach"]["list"][0]["id"] == row["id"]


def test_a_day_coaching_of_an_earlier_day_answers_that_day(sv, ai):
    d = today() - timedelta(days=4)
    j = sv.post("/coach/start", kind="day", start=d.isoformat(), end=d.isoformat())
    cid = owner_sql("SELECT id FROM coachings")[0]["id"]
    assert j["coaching"] == {"id": cid, "state": "done"} and j["day"]["day"] == d.isoformat() and j["day"]["coach"]["state"] == "done"
    assert len(ai.calls) == 1
    j = sv.post("/coach/start", kind="day", start=d.isoformat(), end=d.isoformat(), view="coach", view_f="days")
    assert set(j) == KEYS | {"coach", "coaching"} and j["coach"]["f"] == "days" and j["coach"]["day"] == d.isoformat()
    assert j["coach"]["card"]["id"] == j["coaching"]["id"] == cid + 1 and [i["id"] for i in j["coach"]["list"]] == [cid + 1, cid]
    j = sv.post("/coach/start", kind="day", start=d.isoformat(), end=d.isoformat(), view="coach", view_day=(d - timedelta(days=1)).isoformat(),
                view_f="nonsense")
    assert j["coach"]["f"] == "all" and j["coach"]["day"] == (d - timedelta(days=1)).isoformat() and j["coach"]["card"]["state"] == "none"
    j = sv.post("/coach/start", kind="day", start=d.isoformat(), end=d.isoformat(), view="coach", view_day="2999-01-01")
    assert j["coach"]["day"] == today().isoformat()  # a later day: today's card
    assert set(sv.post("/coach/start", kind="day", start=d.isoformat(), end=d.isoformat(), view="week")) == KEYS | {"week", "coaching"}
    assert len(ai.calls) == 5


def test_the_coaching_answered_is_the_one_of_that_kind_and_period(sv, ai, monkeypatch):
    t = today()
    mon = t - timedelta(days=t.weekday())
    if mon == t:
        mon -= timedelta(days=7)
    week = coaching("week", mon, t - timedelta(days=1) if t > mon else mon, status="working")
    monkeypatch.setattr(coach, "run", lambda cid: None)
    j = sv.post("/coach/start", kind="day", start=mon.isoformat(), end=mon.isoformat())
    day_row = owner_sql("SELECT id FROM coachings WHERE kind = 'day'")[0]["id"]
    assert j["coaching"] == {"id": day_row, "state": "working"} and day_row != week


def test_day_refusals_pass_through_unchanged(sv, ai):
    t = today()
    for start, end in ((t + timedelta(days=1), t + timedelta(days=1)), (t - timedelta(days=2), t - timedelta(days=1)), (t, t - timedelta(days=1))):
        j = sv.post("/coach/start", kind="day", start=start.isoformat(), end=end.isoformat())
        assert j["outcome"] == "rejected" and j["reason"] == "That is not a day or week to coach." and j["coaching"] is None and "day" in j
    j = sv.post("/coach/start", kind="day", start="2026-02-30", end="2026-02-30")
    assert j["reason"] == "That is not a day or week to coach." and j["day"]["day"] == t.isoformat()
    cid = coaching("day", t, status="working")
    j = sv.post("/coach/start", kind="day", start=t.isoformat(), end=t.isoformat())
    assert j["outcome"] == "changed" and j["head"] == "The coach is already on it." and j["coaching"] == {"id": cid, "state": "working"}
    owner_sql("DELETE FROM coachings")
    for _ in range(coach.DAILY_LIMIT):
        owner_sql("INSERT INTO coachings (kind, start_day, end_day, status) VALUES ('week', %s, %s, 'done')", t, t)
    j = sv.post("/coach/start", kind="day", start=(t - timedelta(days=1)).isoformat(), end=(t - timedelta(days=1)).isoformat())
    assert j["outcome"] == "rejected" and j["tone"] == "warning" and j["coaching"] is None
    assert j["reason"] == "That is 10 coachings today, the daily limit. Tomorrow there are new ones."
    assert n("SELECT count(*) AS n FROM coachings") == coach.DAILY_LIMIT and len(ai.calls) == 0


@pytest.mark.parametrize("body,why", [
    ({"kind": "day", "start": "2026-11-02"}, "end must be a date yyyy-mm-dd."),
    ({"kind": "day", "start": "2026-11-02", "end": None}, "end must be a date yyyy-mm-dd."),
    ({"kind": "Day", "start": "2026-11-02", "end": "2026-11-02"}, 'kind must be "day" or "week".'),
    ({"kind": ["day"], "start": "2026-11-02", "end": "2026-11-02"}, 'kind must be "day" or "week".'),
])
def test_a_wrong_field_is_a_400(sv, ai, body, why):
    r = sv.raw("/coach/start", **body)
    assert r.status_code == 400 and r.json() == {"v": 1, "error": "bad_request", "message": why}
    assert n("SELECT count(*) AS n FROM coachings") == 0 and len(ai.calls) == 0


def test_a_failed_day_coaching_says_so(sv, ai):
    ai.fail = True
    t = today()
    j = sv.post("/coach/start", kind="day", start=t.isoformat(), end=t.isoformat())
    assert j["outcome"] == "changed" and j["coaching"]["state"] == "failed"
    assert j["day"]["coach"]["state"] == "failed" and "(ProviderError)" in j["day"]["coach"]["failed"]

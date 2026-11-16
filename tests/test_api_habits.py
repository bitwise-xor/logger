"""The JSON door's Habits page (deploy 93, 16.11.2026; plan in the doc's Current tab, "Step 1 of the move: daily gaps", 1c):
GET /api/v1/habits, POST /habit/day and POST /habits/manage, each through app.'s own function (habitspage.load, todo, calendar,
sections, stats; webactions.habit_day; webhabits.ACTIONS). Every habit, label and number is invented."""
import re
from datetime import date, timedelta

import pytest
from psycopg.types.json import Jsonb

from app import api, habitspage, reads
from conftest import owner_sql
from test_api_door import NOT_FOUND, door, door_on, signed_in  # noqa: F401 - door_on is autouse
from test_api_saves import KEYS, Door, got_undo, n  # noqa: F401
from test_log import fake  # noqa: F401 - the AI is a fake: none of these saves may reach it
from test_webhabits import habit_types_as_they_were  # noqa: F401 - autouse: the habit types and settings as they were
from test_webhealth import event, today


@pytest.fixture
def sv():
    return Door()


def get(sv, path, status=200):
    r = sv.c.get("/api/v1" + path, headers=sv.h)
    assert r.status_code == status, r.text
    assert r.json()["v"] == 1
    return r.json()


def put(name, label, group="practice", target=1, track=True, active=True, order=801):
    owner_sql("""INSERT INTO log_types (name, label, kind, category, aliases, on_checklist, daily_target, active, sort_order)
                 VALUES (%s, %s, 'event', %s, %s, %s, %s, %s, %s)""", name, label, group, [label.lower()], track, target, active, order)


def ticks(name, day=None):
    return n("""SELECT count(*) AS n FROM events e JOIN log_types t ON t.id = e.type_id WHERE t.name = %s AND (%s::date IS NULL OR e.day = %s)""",
             name, day, day)


def cal(h: dict, name: str) -> dict:
    return next(c for c in h["calendar"] if c["name"] == name)


def sq(h: dict, name: str, day: date) -> dict:
    return next(x for x in cal(h, name)["days"] if x["day"] == day.isoformat())


def listed(h: dict) -> dict:
    return {x["name"]: x for g in h["list"] for x in g["habits"]}


def invented():
    """A daily habit, a twice-a-day habit, a habit to avoid, one not tracked and one retired, with invented ticks over 30 days."""
    t = today()
    put("zz_walk", "Zz walk", "practice", 1, order=801)
    put("zz_twice", "Zz twice", "practice", 2, order=802)
    put("zz_soda", "Zz soda", "behaviour", 1, order=803)
    put("zz_off", "Zz off", "learning", 1, track=False, order=804)
    put("zz_old", "Zz old", "intake", 1, active=False, track=False, order=805)
    put("zz_new", "Zz never", "daily", 1, track=False, order=806)
    owner_sql("INSERT INTO ui_settings (key, value) VALUES ('habit_aim', %s)", Jsonb({"avoid": ["zz_soda"]}))
    for i in range(0, 30, 2):
        event("zz_walk", t - timedelta(days=i), "08:00")
    for i in range(0, 12):
        event("zz_twice", t - timedelta(days=i), "08:00")
        if i % 3 == 0:
            event("zz_twice", t - timedelta(days=i), "20:00")
    for i in (1, 4, 29):
        event("zz_soda", t - timedelta(days=i), "12:00")
    event("zz_off", t - timedelta(days=45), "12:00")
    event("zz_old", t - timedelta(days=100), "12:00")
    return t


# ---- GET /habits ----------------------------------------------------------------------------------------------------------------

def test_the_habits_read_is_app_s_page_as_data(sv, fake):
    t = invented()
    j = get(sv, "/habits")
    assert set(j) == {"v", "habits", "undo"} and j["undo"] is None
    h = j["habits"]
    assert set(h) == {"today", "start", "days", "edit_from", "checklist", "calendar", "show", "help", "shows", "list", "groups", "default_group", "limits"}
    assert h["today"] == t.isoformat() and h["start"] == (t - timedelta(days=29)).isoformat() and h["days"] == 30
    assert h["edit_from"] == (t - timedelta(days=35)).isoformat()
    assert h["show"] == "tracked" and h["help"] == habitspage.HELP["tracked"]
    assert h["groups"] == [{"key": k, "label": v} for k, v in habitspage.GROUPS] and h["default_group"] == "practice"
    assert h["limits"] == {"label_max": 40, "target_min": 1, "target_max": 10, "order_max": 999}
    # today's ticks: "n of N done", the habit to avoid is not counted; the ticked ones carry the tick an untick removes
    c = h["checklist"]
    names = [x["name"] for x in c["habits"]]
    assert {"zz_walk", "zz_twice", "zz_soda"} <= set(names) and "zz_off" not in names and "zz_old" not in names
    assert c["total"] == len([x for x in c["habits"] if not x["avoid"]]) and c["done"] == len([x for x in c["habits"] if not x["avoid"] and x["complete"]])
    by = {x["name"]: x for x in c["habits"]}
    assert by["zz_walk"]["done"] == 1 and by["zz_walk"]["target"] == 1 and by["zz_walk"]["complete"] is True and by["zz_walk"]["avoid"] is False
    assert by["zz_walk"]["last_tick"] == "e" + str(owner_sql("SELECT max(id) AS i FROM events WHERE day = %s AND type_id = (SELECT id FROM log_types WHERE name = 'zz_walk')", t)[0]["i"])
    assert by["zz_twice"]["done"] == 2 and by["zz_twice"]["complete"] is True
    assert by["zz_soda"]["avoid"] is True and by["zz_soda"]["done"] == 0 and by["zz_soda"]["last_tick"] is None
    assert all(set(x) == {"name", "label", "done", "target", "complete", "avoid", "last_tick"} for x in c["habits"])


def test_the_last_30_days_per_tracked_habit(sv, fake):
    t = invented()
    h = get(sv, "/habits")["habits"]
    assert {"zz_off", "zz_old", "zz_new"}.isdisjoint(c["name"] for c in h["calendar"])  # tracked habits only
    walk, twice, soda = cal(h, "zz_walk"), cal(h, "zz_twice"), cal(h, "zz_soda")
    assert [d["day"] for d in walk["days"]] == [(t - timedelta(days=29 - i)).isoformat() for i in range(30)]  # oldest first, today last
    assert set(walk) == {"name", "label", "target", "avoid", "full", "editable", "days"} and walk["editable"] is True
    assert all(set(d) == {"day", "n", "state", "text"} for d in walk["days"])
    assert walk["full"] == 15 and sq(h, "zz_walk", t) == {"day": t.isoformat(), "n": 1, "state": "done", "text": "done"}
    assert sq(h, "zz_walk", t - timedelta(days=1)) == {"day": (t - timedelta(days=1)).isoformat(), "n": 0, "state": "none", "text": "not logged"}
    # a habit with a target of 2: one tick is partly, two are done
    assert twice["target"] == 2 and sq(h, "zz_twice", t)["state"] == "done" and sq(h, "zz_twice", t - timedelta(days=1)) == {
        "day": (t - timedelta(days=1)).isoformat(), "n": 1, "state": "partly", "text": "1 of 2"}
    assert twice["full"] == 4 and sq(h, "zz_twice", t - timedelta(days=20))["state"] == "none"
    # a habit to avoid: a logged day, and "full" counts the days without
    assert soda["avoid"] is True and soda["target"] == 1 and soda["full"] == 27
    assert sq(h, "zz_soda", t - timedelta(days=4)) == {"day": (t - timedelta(days=4)).isoformat(), "n": 1, "state": "logged", "text": "1 logged"}
    assert sq(h, "zz_soda", t - timedelta(days=2))["state"] == "none" and sq(h, "zz_soda", t - timedelta(days=29))["state"] == "logged"
    # the same squares as app.'s page: its class per day and its "full/30"
    page = habitspage.render("c")
    row = re.search(r'<form class="calrow"[^>]*>(?:(?!</form>).)*?name="name" value="zz_twice".*?</form>', page, re.S)[0]
    assert re.findall(r'class="sq ([dhx]?)"', row) == [{"done": "d", "partly": "h", "logged": "x", "none": ""}[d["state"]] for d in twice["days"]]
    assert "4/30" in row and "27/30 without" in page and "15/30" in page


def test_your_habits_with_its_filters_counts_and_what_can_be_done(sv, fake):
    t = invented()
    h = get(sv, "/habits")["habits"]
    assert h["shows"] == [{"key": "tracked", "label": "Tracked", "count": h["shows"][0]["count"]},
                          {"key": "untracked", "label": "Not tracked", "count": h["shows"][1]["count"]},
                          {"key": "retired", "label": "Retired", "count": h["shows"][2]["count"]}, {"key": "all", "label": "All", "count": h["shows"][3]["count"]}]
    assert h["shows"][3]["count"] == sum(s["count"] for s in h["shows"][:3]) and h["shows"][2]["count"] >= 1
    assert h["shows"][1]["count"] >= 2 and h["shows"][0]["count"] >= 3
    for s in h["shows"]:  # each filter lists as many habits as its count says
        got = get(sv, "/habits?show=" + s["key"])["habits"]
        assert got["show"] == s["key"] and got["help"] == habitspage.HELP[s["key"]]
        assert sum(len(g["habits"]) for g in got["list"]) == s["count"] and got["shows"] == h["shows"]
        assert [g["group"] for g in got["list"]] == [k for k, _ in habitspage.GROUPS if k in {x["group"] for g in got["list"] for x in g["habits"]}]
    allh = listed(get(sv, "/habits?show=all")["habits"])
    walk, off, old, new, soda, twice = (allh[k] for k in ("zz_walk", "zz_off", "zz_old", "zz_new", "zz_soda", "zz_twice"))
    assert set(walk) == {"name", "label", "group", "target", "order", "avoid", "state", "ticks", "days30", "last_day", "stats", "can_track", "can_delete"}
    assert (walk["state"], off["state"], old["state"]) == ("tracked", "untracked", "retired")
    assert walk["group"] == "practice" and walk["target"] == 1 and walk["order"] == 801 and walk["avoid"] is False and twice["target"] == 2
    assert soda["avoid"] is True and soda["group"] == "behaviour"
    # the stats line is app.'s: "n of the last 30 days · last date"; a habit never ticked, and one ticked long ago
    assert walk["ticks"] == 15 and walk["days30"] == 15 and walk["last_day"] == t.isoformat()
    assert walk["stats"] == f"15 of the last 30 days · last {t:%d.%m.}"
    assert new["stats"] == "Never ticked" and new["ticks"] == 0 and new["days30"] == 0 and new["last_day"] is None
    assert off["stats"].startswith("Last ticked ") and off["days30"] == 0 and off["ticks"] == 1
    assert habitspage.stats({"ticks": 1, "last_day": t - timedelta(days=100), "days30": 0}, t).startswith("Last ticked ")
    # what can be done: track only for a habit not retired, delete only without history
    assert (walk["can_track"], old["can_track"], off["can_track"]) == (True, False, True)
    assert (walk["can_delete"], new["can_delete"], old["can_delete"]) == (False, True, False)
    # the list is app.'s list: the same habits in the same order on app.'s page
    page = habitspage.render("c", {"show": "all"})
    assert re.findall(r'id="hab-([a-z0-9_]+)"', page) == [x["name"] for g in get(sv, "/habits?show=all")["habits"]["list"] for x in g["habits"]]
    assert "Zz never" in page and "Never ticked" in page


def test_an_unknown_show_is_a_bad_request_and_the_default_is_tracked(sv, fake):
    invented()
    assert get(sv, "/habits")["habits"]["show"] == "tracked" == get(sv, "/habits?show=")["habits"]["show"]
    for bad in ("nonsense", "ALL", "tracked,all"):
        j = get(sv, "/habits?show=" + bad, 400)
        assert j["error"] == "bad_request" and j["message"] == "show must be tracked, untracked, retired or all."
    assert reads.habits("bogus")["show"] == "tracked"


def test_an_empty_list_has_every_key(sv, fake):
    owner_sql("UPDATE log_types SET on_checklist = false WHERE kind = 'event'")
    h = get(sv, "/habits")["habits"]
    assert h["checklist"] == {"done": 0, "total": 0, "habits": []} and h["calendar"] == [] and h["list"] == []
    assert h["shows"][0]["count"] == 0 and h["shows"][1]["count"] > 0


def test_wake_up_and_bedtime_are_not_habits(sv, fake):
    h = get(sv, "/habits?show=all")["habits"]
    names = {x["name"] for g in h["list"] for x in g["habits"]} | {x["name"] for x in h["checklist"]["habits"]} | {c["name"] for c in h["calendar"]}
    assert not names & {"wake", "bed"}


# ---- POST /habit/day ------------------------------------------------------------------------------------------------------------

def test_a_past_day_ticked_and_unticked_again(sv, fake):
    t = today()
    put("zz_walk", "Zz walk")
    d = t - timedelta(days=3)
    j = sv.post("/habit/day", name="zz_walk", day=d.isoformat(), key="hd-1")
    assert set(j) == KEYS | {"habits"}
    assert j["outcome"] == "saved" and ticks("zz_walk", d) == 1 and fake.calls == []
    assert sq(j["habits"], "zz_walk", d)["state"] == "done" and cal(j["habits"], "zz_walk")["full"] == 1
    assert owner_sql("SELECT content, channel FROM raw_inbox")[0]["channel"] == "web" and f"{d:%d.%m.%Y}" in owner_sql("SELECT content FROM raw_inbox")[0]["content"]
    assert owner_sql("SELECT time_known FROM events WHERE day = %s", d)[0]["time_known"] is False  # a day without a time of its own
    j2 = sv.post("/habit/day", name="zz_walk", day=d.isoformat(), key="hd-2")  # done: the ticks of that day come off
    assert j2["outcome"] == "changed" and j2["head"] == f"Removed 1 tick of Zz walk on {d:%d.%m.%Y}." and ticks("zz_walk", d) == 0
    assert sq(j2["habits"], "zz_walk", d)["state"] == "none" and cal(j2["habits"], "zz_walk")["full"] == 0
    assert get(sv, "/habits")["habits"]["calendar"] == j2["habits"]["calendar"]  # the answer's read is the read


def test_a_habit_with_a_target_of_two_goes_partly_then_done_then_off(sv, fake):
    t = today()
    put("zz_twice", "Zz twice", target=2)
    d = t - timedelta(days=5)
    one = sv.post("/habit/day", name="zz_twice", day=d.isoformat(), key="tw-1")
    assert sq(one["habits"], "zz_twice", d) == {"day": d.isoformat(), "n": 1, "state": "partly", "text": "1 of 2"}
    assert cal(one["habits"], "zz_twice")["full"] == 0
    two = sv.post("/habit/day", name="zz_twice", day=d.isoformat(), key="tw-2")
    assert sq(two["habits"], "zz_twice", d)["state"] == "done" and ticks("zz_twice", d) == 2 and cal(two["habits"], "zz_twice")["full"] == 1
    off = sv.post("/habit/day", name="zz_twice", day=d.isoformat(), key="tw-3")
    assert off["outcome"] == "changed" and off["head"] == f"Removed 2 ticks of Zz twice on {d:%d.%m.%Y}." and ticks("zz_twice", d) == 0


def test_a_re_sent_key_of_a_square(sv, fake):
    """app.'s rule, kept: the message of a tick carries the time of the click, so a re-sent key never replays the first answer. A tick
    that is sent again with its key while the day still needs one is refused (a double tap in the same moment); sent again after the
    day is done it is the next click: the day's ticks come off (the toggle reads the day as it is now)."""
    t = today()
    put("zz_twice", "Zz twice", target=2)
    d = t - timedelta(days=2)
    first = sv.post("/habit/day", name="zz_twice", day=d.isoformat(), key="rk-1")
    assert first["outcome"] == "saved" and first["replayed"] is False and ticks("zz_twice", d) == 1
    again = sv.post("/habit/day", name="zz_twice", day=d.isoformat(), key="rk-1")  # 1 of 2: a tick again, with the key already used
    assert again["outcome"] == "rejected" and again["reason"] == "This idempotency key was already used for a different message."
    assert again["replayed"] is False and ticks("zz_twice", d) == 1 and set(again) == KEYS | {"habits"}
    assert sv.post("/habit/day", name="zz_twice", day=d.isoformat(), key="rk-2")["outcome"] == "saved" and ticks("zz_twice", d) == 2  # done
    assert sv.post("/habit/day", name="zz_twice", day=d.isoformat(), key="rk-2")["outcome"] == "changed" and ticks("zz_twice", d) == 0


def test_a_habit_to_avoid_is_logged_by_its_square(sv, fake):
    t = today()
    put("zz_soda", "Zz soda", "behaviour")
    owner_sql("INSERT INTO ui_settings (key, value) VALUES ('habit_aim', %s)", Jsonb({"avoid": ["zz_soda"]}))
    d = t - timedelta(days=2)
    j = sv.post("/habit/day", name="zz_soda", day=d.isoformat(), key="av-1")
    assert j["outcome"] == "saved" and sq(j["habits"], "zz_soda", d)["state"] == "logged" and cal(j["habits"], "zz_soda")["full"] == 29
    assert j["habits"]["checklist"]["total"] == len([x for x in j["habits"]["checklist"]["habits"] if not x["avoid"]])
    j = sv.post("/habit/day", name="zz_soda", day=d.isoformat(), key="av-2")  # a logged day is taken off again
    assert j["outcome"] == "changed" and sq(j["habits"], "zz_soda", d)["state"] == "none" and cal(j["habits"], "zz_soda")["full"] == 30


def test_the_edge_days_and_the_refusals_of_a_day_save(sv, fake):
    t = today()
    put("zz_walk", "Zz walk")
    ok = sv.post("/habit/day", name="zz_walk", day=(t - timedelta(days=35)).isoformat(), key="e-1")  # 35 days back is still allowed
    assert ok["outcome"] == "saved" and ticks("zz_walk") == 1
    sq_ = sv.post("/habit/day", name="zz_walk", day=t.isoformat(), key="e-2")  # today works too
    assert sq_["outcome"] == "saved" and ticks("zz_walk") == 2
    bad = {"36 days back": (t - timedelta(days=36)).isoformat(), "a future day": (t + timedelta(days=1)).isoformat()}
    for what, day in bad.items():
        j = sv.post("/habit/day", name="zz_walk", day=day, key="e-3")
        assert j["outcome"] == "rejected" and j["tone"] == "warning" and j["reason"] == "Only the last 30 days can be changed here.", what
        assert set(j) == KEYS | {"habits"} and j["habits"]["show"] == "tracked"
    j = sv.post("/habit/day", name="zz_walk", day="2026-13-45", key="e-4")
    assert j["outcome"] == "rejected" and j["reason"] == "Unknown day."
    assert sv.post("/habit/day", name="zz_walk", day="yesterday", key="e-4")["reason"] == "Unknown day."
    assert ticks("zz_walk") == 2 and n("SELECT count(*) AS n FROM raw_inbox") == 2
    # the wake-up is a time, not a habit; a habit not tracked or retired, and one that is not there, cannot be ticked here
    put("zz_off", "Zz off", track=False)
    put("zz_old", "Zz old", active=False, track=False)
    for name in ("wake", "bed", "zz_off", "zz_old", "nonsense", "weight"):
        j = sv.post("/habit/day", name=name, day=t.isoformat(), key="e-5")
        assert j["outcome"] == "rejected" and j["reason"] == "That habit cannot be changed for a past day here.", name
    assert n("SELECT count(*) AS n FROM raw_inbox") == 2 and n("SELECT count(*) AS n FROM events") == 2


@pytest.mark.parametrize("body", [{}, {"name": "zz_walk"}, {"day": "2026-11-01"}, {"name": "zz_walk", "day": ""}, {"name": ["x"], "day": "2026-11-01"},
                                  {"name": "zz_walk", "day": True}])
def test_a_bad_day_request_is_a_400(sv, fake, body):
    put("zz_walk", "Zz walk")
    r = sv.raw("/habit/day", **body)
    assert r.status_code == 400 and r.json()["error"] == "bad_request" and n("SELECT count(*) AS n FROM events") == 0


def test_today_s_button_can_answer_with_this_page(sv, fake):
    put("zz_walk", "Zz walk")
    j = sv.post("/habit", name="zz_walk", action="tick", key="tb-1", view="habits", show="all")
    assert set(j) == KEYS | {"habits"} and j["outcome"] == "saved" and j["habits"]["show"] == "all"
    assert next(x for x in j["habits"]["checklist"]["habits"] if x["name"] == "zz_walk")["complete"] is True
    eid = next(x for x in j["habits"]["checklist"]["habits"] if x["name"] == "zz_walk")["last_tick"]
    j = sv.post("/habit", name="zz_walk", action="untick", ref=eid, view="habits")
    assert j["outcome"] == "changed" and next(x for x in j["habits"]["checklist"]["habits"] if x["name"] == "zz_walk")["complete"] is False


# ---- Undo -----------------------------------------------------------------------------------------------------------------------

def test_undo_of_a_ticked_day_takes_the_tick_back(sv, fake):
    t = today()
    put("zz_walk", "Zz walk")
    d = t - timedelta(days=4)
    j = sv.post("/habit/day", name="zz_walk", day=d.isoformat(), key="u-1")
    u = got_undo(j)
    out = sv.post("/undo", token=u["token"])
    assert out["outcome"] == "changed" and ticks("zz_walk") == 0 and out["undo"] is None  # the chat's undo of that message


def test_undo_of_an_unticked_day_puts_the_ticks_back_as_they_were(sv, fake):
    t = today()
    put("zz_twice", "Zz twice", target=2)
    d = t - timedelta(days=6)
    a, b = event("zz_twice", d, "08:00"), event("zz_twice", d, "20:00")
    j = sv.post("/habit/day", name="zz_twice", day=d.isoformat(), key="u-2")
    assert j["outcome"] == "changed" and ticks("zz_twice") == 0
    out = sv.post("/undo", token=got_undo(j)["token"])
    assert out["outcome"] == "changed" and sorted(r["id"] for r in owner_sql("SELECT id FROM events")) == sorted([a, b])  # the same ids


def test_a_manage_save_has_no_undo_and_ends_the_one_before(sv, fake):
    t = today()
    put("zz_walk", "Zz walk")
    j = sv.post("/habit/day", name="zz_walk", day=(t - timedelta(days=1)).isoformat(), key="u-3")
    assert got_undo(j)
    m = sv.post("/habits/manage", action="retire", name="zz_walk")
    assert m["outcome"] == "changed" and m["undo"] is None and sv.undo_row() is None  # as on app.: the bar goes
    assert sv.post("/habit/day", name="zz_walk", day=t.isoformat(), key="u-4")["outcome"] == "rejected"  # a refusal: nothing to undo


# ---- POST /habits/manage --------------------------------------------------------------------------------------------------------

def manage(sv, **body):
    return sv.post("/habits/manage", **body)


def row(sv, name, show="all"):
    return listed(get(sv, "/habits?show=" + show)["habits"]).get(name)


def types(name):
    return owner_sql("SELECT label, category, daily_target, sort_order, active, on_checklist FROM log_types WHERE name = %s", name)


def test_track_on_and_off(sv, fake):
    put("zz_off", "Zz off", track=False)
    j = manage(sv, action="track", name="zz_off", on=True, key="m-1")
    assert set(j) == KEYS | {"habits"} and j["outcome"] == "changed" and j["head"] == "Now tracking Zz off. It shows on Today and in the calendar."
    assert types("zz_off")[0]["on_checklist"] is True and j["undo"] is None
    assert [c["name"] for c in j["habits"]["calendar"]].count("zz_off") == 1 and listed(j["habits"])["zz_off"]["state"] == "tracked"
    assert types("zz_off")[0]["sort_order"] == owner_sql("SELECT max(sort_order) AS m FROM log_types WHERE on_checklist")[0]["m"]  # last on Today
    j = manage(sv, action="track", name="zz_off", on=False)
    assert j["head"].startswith("Stopped tracking Zz off.") and types("zz_off")[0]["on_checklist"] is False
    assert row(sv, "zz_off", "untracked")["state"] == "untracked" and "zz_off" not in {c["name"] for c in j["habits"]["calendar"]}


def test_track_on_a_retired_habit_is_refused(sv, fake):
    put("zz_old", "Zz old", active=False, track=False)
    j = manage(sv, action="track", name="zz_old", on=True)
    assert j["outcome"] == "rejected" and j["reason"] == "Zz old is retired: bring it back first." and types("zz_old")[0]["on_checklist"] is False
    assert j["tone"] == "warning" and set(j) == KEYS | {"habits"}


def test_retire_and_bring_back(sv, fake):
    put("zz_walk", "Zz walk")
    j = manage(sv, action="retire", name="zz_walk", show="retired")
    assert j["outcome"] == "changed" and j["head"].startswith("Retired Zz walk.") and types("zz_walk")[0]["active"] is False
    assert j["habits"]["show"] == "retired" and listed(j["habits"])["zz_walk"]["state"] == "retired" and listed(j["habits"])["zz_walk"]["can_track"] is False
    assert "zz_walk" not in {x["name"] for x in j["habits"]["checklist"]["habits"]}
    j = manage(sv, action="restore", name="zz_walk")
    assert j["head"] == "Brought back Zz walk (tracked again)." and types("zz_walk")[0]["active"] is True
    assert listed(get(sv, "/habits?show=tracked")["habits"])["zz_walk"]["state"] == "tracked"
    put("zz_off", "Zz off", active=False, track=False)
    assert manage(sv, action="restore", name="zz_off")["head"] == "Brought back Zz off (not tracked: switch Track on to start)."


def test_edit_label_times_a_day_order_and_aim(sv, fake):
    put("zz_walk", "Zz walk")
    j = manage(sv, action="edit", name="zz_walk", label="  Zz   long  walk ", target=3, order=17, aim="avoid", show="all")
    assert j["outcome"] == "changed" and j["head"] == "Saved the habit Zz long walk."
    assert types("zz_walk")[0] | {} == {"label": "Zz long walk", "category": "practice", "daily_target": 3, "sort_order": 17, "active": True, "on_checklist": True}
    r = listed(j["habits"])["zz_walk"]
    assert (r["label"], r["target"], r["order"], r["avoid"]) == ("Zz long walk", 3, 17, True)
    assert next(x for x in j["habits"]["checklist"]["habits"] if x["name"] == "zz_walk")["avoid"] is True
    assert cal(j["habits"], "zz_walk")["avoid"] is True and cal(j["habits"], "zz_walk")["target"] == 3
    j = manage(sv, action="edit", name="zz_walk", label="Zz long walk", target=2, aim="do")  # no order: it stays
    assert types("zz_walk")[0]["sort_order"] == 17 and types("zz_walk")[0]["daily_target"] == 2 and row(sv, "zz_walk")["avoid"] is False
    manage(sv, action="edit", name="zz_walk", label="Zz long walk", target=2)  # no aim: it stays
    assert row(sv, "zz_walk")["avoid"] is False


def test_edit_refusals(sv, fake):
    put("zz_walk", "Zz walk")
    put("zz_other", "Zz other")
    j = manage(sv, action="edit", name="zz_walk", label="zz OTHER", target=1)  # a duplicate label, in any case
    assert j["outcome"] == "rejected" and j["reason"] == "There is already a log type called zz OTHER." and types("zz_walk")[0]["label"] == "Zz walk"
    j = manage(sv, action="edit", name="zz_walk", label="   ", target=1)
    assert j["outcome"] == "rejected" and j["reason"] == "A habit needs a name to show."
    assert manage(sv, action="edit", name="nonsense", label="x", target=1)["reason"] == "Unknown habit."
    assert manage(sv, action="edit", name="zz_walk", label="Zz walk", target=1)["outcome"] == "changed"  # the same label is its own


def test_delete_without_history_with_its_yes(sv, fake):
    put("zz_new", "Zz never", track=False)
    j = manage(sv, action="delete", name="zz_new")
    assert j["outcome"] == "rejected" and j["reason"] == "Press Yes, delete to delete a habit." and types("zz_new")
    j = manage(sv, action="delete", name="zz_new", confirmed=False)
    assert j["outcome"] == "rejected" and types("zz_new")
    j = manage(sv, action="delete", name="zz_new", confirmed=True)
    assert j["outcome"] == "changed" and j["head"] == "Deleted the habit Zz never." and types("zz_new") == [] and j["undo"] is None
    assert "zz_new" not in listed(j["habits"])
    assert manage(sv, action="delete", name="zz_new", confirmed=True)["reason"] == "Unknown habit."  # a re-send: nothing left


def test_delete_with_history_is_refused(sv, fake):
    t = today()
    put("zz_walk", "Zz walk")
    event("zz_walk", t - timedelta(days=60), "08:00")
    j = manage(sv, action="delete", name="zz_walk", confirmed=True)
    assert j["outcome"] == "rejected" and j["reason"] == "Zz walk has history, so it cannot be deleted. Retire it instead." and types("zz_walk")
    assert row(sv, "zz_walk")["can_delete"] is False


def test_a_new_habit(sv, fake):
    j = manage(sv, action="new", label=" Zz  stretching ", group="learning", target=2, track=True, key="n-1", show="all")
    assert j["outcome"] == "changed" and j["head"] == "Added the habit Zz stretching. It is tracked: tick it above or log it by its name."
    name = "zz_stretching"
    assert types(name)[0] == {"label": "Zz stretching", "category": "learning", "daily_target": 2, "sort_order": types(name)[0]["sort_order"],
                              "active": True, "on_checklist": True}
    assert owner_sql("SELECT aliases FROM log_types WHERE name = %s", name)[0]["aliases"] == ["zz stretching"]
    r = listed(j["habits"])[name]
    assert (r["state"], r["target"], r["group"], r["stats"], r["can_delete"]) == ("tracked", 2, "learning", "Never ticked", True)
    assert name in {c["name"] for c in j["habits"]["calendar"]} and name in {x["name"] for x in j["habits"]["checklist"]["habits"]}
    j = manage(sv, action="new", label="Zz quiet", group="daily", track=False)  # one a day when no target is given
    assert j["head"] == "Added the habit Zz quiet. It is in the list, not tracked yet: switch Track on to start."
    assert types("zz_quiet")[0]["daily_target"] == 1 and types("zz_quiet")[0]["on_checklist"] is False
    j = manage(sv, action="new", label="Zz plain")  # no group: daily, not tracked (as the form's own default for a missing field)
    assert types("zz_plain")[0]["category"] == "daily" and types("zz_plain")[0]["on_checklist"] is False


def test_new_habit_refusals(sv, fake):
    put("zz_walk", "Zz walk")
    put("zz_old", "Zz old", active=False, track=False)
    before = n("SELECT count(*) AS n FROM log_types")
    j = manage(sv, action="new", label="zz WALK", group="practice")  # a duplicate label, in any case
    assert j["outcome"] == "rejected" and j["reason"] == "There is already a log type called zz WALK."
    j = manage(sv, action="new", label="Zz old", group="practice")
    assert j["reason"] == "There is already a log type called Zz old (retired: bring it back from the Retired list)."
    assert manage(sv, action="new", label="weight", group="practice")["outcome"] == "rejected"  # a name of another log type
    assert manage(sv, action="new", label="Zz fine", group="nonsense")["reason"] == "Choose a group for the habit."
    assert manage(sv, action="new", label="", group="practice")["reason"] == "Give the habit a name with letters or digits."
    assert manage(sv, action="new", label="!!!", group="practice")["reason"] == "Give the habit a name with letters or digits."
    assert n("SELECT count(*) AS n FROM log_types") == before


def test_a_label_too_long_and_times_a_day_outside_1_to_10_are_bad_requests(sv, fake):
    put("zz_walk", "Zz walk")
    before = types("zz_walk")
    long_ = "x" * 41
    for body in ({"action": "new", "label": long_, "group": "practice"}, {"action": "edit", "name": "zz_walk", "label": long_, "target": 1},
                 {"action": "new", "label": "Zz a", "target": 0}, {"action": "new", "label": "Zz a", "target": 11},
                 {"action": "edit", "name": "zz_walk", "label": "Zz walk", "target": 0}, {"action": "edit", "name": "zz_walk", "label": "Zz walk", "target": 11},
                 {"action": "edit", "name": "zz_walk", "label": "Zz walk", "target": -2}, {"action": "edit", "name": "zz_walk", "label": "Zz walk", "target": 1.5},
                 {"action": "edit", "name": "zz_walk", "label": "Zz walk", "target": "2"}, {"action": "edit", "name": "zz_walk", "label": "Zz walk", "target": True},
                 {"action": "edit", "name": "zz_walk", "label": "Zz walk"},  # target missing: not set to 1 by a left-out field
                 {"action": "edit", "name": "zz_walk", "label": "Zz walk", "target": 1, "order": 1000},
                 {"action": "edit", "name": "zz_walk", "label": "Zz walk", "target": 1, "order": -1},
                 {"action": "edit", "name": "zz_walk", "label": "Zz walk", "target": 1, "aim": "maybe"},
                 {"action": "new", "label": ["a"], "group": "practice"}, {"action": "new", "label": "Zz a", "track": "yes"},
                 {"action": "track", "name": "zz_walk"}, {"action": "track", "name": "zz_walk", "on": "1"},
                 {"action": "retire"}, {"action": "retire", "name": ""}, {"action": "teleport", "name": "zz_walk"}, {}):
        r = sv.raw("/habits/manage", **body)
        assert r.status_code == 400 and r.json()["error"] == "bad_request", body
    assert types("zz_walk") == before and n("SELECT count(*) AS n FROM log_types WHERE name LIKE 'zz_a%%' OR name LIKE 'x%%'") == 0
    assert sv.raw("/habits/manage", action="new", label="x" * 40, group="practice", key="l-1").status_code == 200  # 40 letters are fine
    assert sv.raw("/habits/manage", action="new", label="Zz ten", target=10, group="practice").status_code == 200
    assert sv.raw("/habits/manage", action="new", label="Zz one", target=1, group="practice").status_code == 200


def test_a_re_sent_key_changes_nothing_twice(sv, fake):
    """The list's functions take no key (as on app.: every one is the same again or refused when sent twice)."""
    first = manage(sv, action="new", label="Zz twice sent", group="practice", track=True, key="r-1")
    again = manage(sv, action="new", label="Zz twice sent", group="practice", track=True, key="r-1")
    assert first["outcome"] == "changed" and again["outcome"] == "rejected" and n("SELECT count(*) AS n FROM log_types WHERE name = 'zz_twice_sent'") == 1
    assert manage(sv, action="retire", name="zz_twice_sent", key="r-2")["outcome"] == "changed"
    assert manage(sv, action="retire", name="zz_twice_sent", key="r-2")["outcome"] == "changed" and types("zz_twice_sent")[0]["active"] is False


def test_wake_up_and_bedtime_cannot_be_managed(sv, fake):
    for name in ("wake", "bed"):
        for body in ({"action": "track", "on": True}, {"action": "retire"}, {"action": "restore"}, {"action": "delete", "confirmed": True},
                     {"action": "edit", "label": "x", "target": 1}):
            j = manage(sv, name=name, **body)
            assert j["outcome"] == "rejected" and j["reason"] == "Unknown habit.", (name, body)
    assert types("wake")[0]["label"] != "x"


def test_the_manage_answer_reads_the_filter_asked_for(sv, fake):
    put("zz_walk", "Zz walk")
    j = manage(sv, action="retire", name="zz_walk", show="tracked")
    assert j["habits"]["show"] == "tracked" and "zz_walk" not in listed(j["habits"])
    assert manage(sv, action="restore", name="zz_walk", show="bogus")["habits"]["show"] == "tracked"
    assert manage(sv, action="retire", name="zz_walk", show=7)["habits"]["show"] == "tracked"
    assert manage(sv, action="restore", name="zz_walk", show="all")["habits"]["show"] == "all"


# ---- the door's checks on every new route -------------------------------------------------------------------------------------------

NEW = [("GET", "/api/v1/habits", {}), ("POST", "/api/v1/habit/day", {"name": "zz_walk", "day": "2026-11-01"}),
       ("POST", "/api/v1/habits/manage", {"action": "retire", "name": "zz_walk"})]


@pytest.mark.parametrize("method,path,body", NEW)
def test_signed_out_and_door_off(method, path, body, monkeypatch, fake):
    put("zz_walk", "Zz walk")
    c, bearer, _ = signed_in()
    kw = {"json": body} if method == "POST" else {}
    r = c.request(method, path, **kw)  # no session
    assert r.status_code == 401 and r.json()["error"] == "signed_out"
    r = door(token="w" * 40).request(method, path, headers=bearer, **kw)  # a wrong service token
    assert r.status_code == 404 and r.json() == NOT_FOUND
    monkeypatch.setattr(api, "FRONT_TOKEN", "")
    r = c.request(method, path, headers=bearer, **kw)
    assert r.status_code == 404 and r.json() == NOT_FOUND
    assert types("zz_walk")[0]["active"] is True and n("SELECT count(*) AS n FROM events") == 0 and n("SELECT count(*) AS n FROM raw_inbox") == 0


def test_hiding_and_ordering_on_today_have_no_route_here(sv, fake):
    for path in ("/habits/hide", "/habits/order", "/habits/reminders", "/habits/prefs"):
        assert sv.c.post("/api/v1" + path, headers=sv.h, json={}).status_code == 404

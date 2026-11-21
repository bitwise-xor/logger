"""The JSON door's Home (deploy 98, 16.11.2026; step 3 of the move to logger.): GET /api/v1/home, /home/pick, /home/zones,
/home/history, /home/chore and /home/edit, POST /api/v1/home/<action> for each of home.ACTIONS, and Today's Home card in GET /day,
each through app.'s own function (homepage.now_data, pick_data, zones_data, history_data, chore_data, edit_data, card_data;
home.ACTIONS; home.undo through webundo). Every zone, chore and number is invented."""
from datetime import timedelta

import pytest

from app import api, home, homepage, reads, uiprefs
from app.db import connect
from conftest import owner_sql
from test_api_door import NOT_FOUND, door, door_on, signed_in  # noqa: F401 - door_on is autouse
from test_api_saves import KEYS, Door, got_undo, n  # noqa: F401
from test_log import fake  # noqa: F401 - the AI is a fake: none of these saves may reach it


def zone(name, short, spots=(), words=(), active=True):
    return owner_sql("""INSERT INTO home_zones (name, short, spots, words, sort_order, active)
                        SELECT %s, %s, %s, %s, coalesce(max(sort_order), 0) + 10, %s FROM home_zones RETURNING id""",
                     name, short, list(spots), list(words), active)[0]["id"]


def chore(name, zone_id, days, minutes, steps=(), howto=None, words=(), active=True, zone_days=None, zone_minutes=None, zone_off=None):
    from psycopg.types.json import Jsonb
    return owner_sql("""INSERT INTO home_chores (name, zone_id, interval_days, minutes, steps, howto, words, active, zone_days, zone_minutes,
                        zone_off, sort_order) SELECT %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, coalesce(max(sort_order), 0) + 10 FROM home_chores
                        RETURNING id""", name, zone_id, days, minutes, list(steps), howto, list(words), active, Jsonb(zone_days or {}),
                     Jsonb(zone_minutes or {}), Jsonb(zone_off or []))[0]["id"]


def done(chore_id, zone_id, days, source="web", dated=False):
    """A done row so many logging days ago (whole days, as test_home.age_days)."""
    return owner_sql("""INSERT INTO home_done (chore_id, zone_id, done_at, day, source, dated)
                        VALUES (%s, %s, now() - make_interval(days => %s), log_day(now()) - %s, %s, %s) RETURNING id""",
                     chore_id, zone_id, days, days, source, dated)[0]["id"]


# The sample file's names (front/tests/samples/home.json); the tests use "Zz <key>"
PLAIN = {"kitchen": "Kitchen", "bath": "Bathroom", "hall": "Hallway", "attic": "Attic", "dust": "Dust", "vacuum": "Vacuum",
         "stove": "Wipe the stove", "fridge": "Clean the fridge", "sink": "Scrub the sink", "shoes": "Tidy the shoes", "oven": "Clean the oven",
         "towels": "Fresh towels"}


def invented(plain=False) -> dict:
    """Four zones (Zz attic retired) and seven chores: two of the whole flat (Zz dust off in the hall; Zz vacuum every 3 days in the
    kitchen and 5 minutes in the bathroom), four of a zone (one never done, one done today), one retired. Done rows of every kind: ticked,
    chat, timer, a job done earlier and a starting point. -> the ids by short name."""
    nm = (lambda k: PLAIN[k]) if plain else (lambda k: f"Zz {k}")
    x = {"kitchen": zone(nm("kitchen"), "Kit", ("Counter", "Stove top"), ("galley",)), "bath": zone(nm("bath"), "Bath", ("Mirror", "Sink")),
         "hall": zone(nm("hall"), "Hall"), "attic": zone(nm("attic"), "Attic", active=False)}
    x["dust"] = chore(nm("dust"), None, 14, 15, howto="Top to bottom.", words=("dust", "dusting"), zone_off=[x["hall"]])
    x["vacuum"] = chore(nm("vacuum"), None, 7, 10, zone_days={str(x["kitchen"]): 3}, zone_minutes={str(x["bath"]): 5})
    x["stove"] = chore(nm("stove"), x["kitchen"], 7, 15, steps=("Knobs", "Top", "Wall behind"))
    x["fridge"] = chore(nm("fridge"), x["kitchen"], 30, 20, steps=("Empty a shelf", "Wipe"), howto="One shelf at a time.")
    x["sink"] = chore(nm("sink"), x["bath"], 7, 10)
    x["shoes"] = chore(nm("shoes"), x["hall"], 30, 5)
    x["towels"] = chore(nm("towels"), x["bath"], 5, 5)
    x["oven"] = chore(nm("oven"), x["kitchen"], 90, 30, active=False)
    done(x["vacuum"], x["kitchen"], 2)
    done(x["dust"], x["bath"], 20, source="chat")
    for back in (30, 21, 9):  # the stove every 9 and 12 days: "usually every 12 days" (the median gap)
        done(x["stove"], x["kitchen"], back, source="pick" if back == 9 else "web")
    done(x["fridge"], x["kitchen"], 40, source="web", dated=True)
    done(x["sink"], x["bath"], 0)
    done(x["shoes"], x["hall"], 3, source="start", dated=True)
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


def done_rows(chore_id=None):
    return owner_sql("SELECT id, chore_id, zone_id, day, source, dated FROM home_done WHERE %s::int IS NULL OR chore_id = %s ORDER BY id", chore_id, chore_id)


def timers():
    return owner_sql("SELECT id, closed, ends_at IS NULL AS paused, pairs FROM home_timers ORDER BY id")


def today():
    return owner_sql("SELECT log_day(now()) AS d")[0]["d"]


def this_week() -> int:
    """invented()'s sessions this week: today's sink, and the vacuum 2 days ago when that is still this week (weeks start on Monday:
    on a Monday or a Tuesday it fell in the week before). The other done rows are 9 days ago or older, or a starting point."""
    return 1 + (today().weekday() >= 2)


def data(fn, *a):
    return fn(*a)


ROW = {"chore_id", "zone_id", "name", "zone", "short", "label", "flat", "age", "age_text", "interval", "interval_text", "minutes", "done_today", "done_at"}
TIMER = {"id", "state", "left", "ends_at", "minutes", "title", "pairs"}
JOB = {"pairs", "title", "zone", "age", "age_text", "minutes", "steps", "howto", "over", "session"}
DONE = {"ids", "chore_id", "chore", "zones", "flat", "label", "at", "day", "dated", "source", "how", "time", "when"}


# ---- GET /home (Now) ---------------------------------------------------------------------------------------------------------------

def test_the_now_read_is_app_s_tab_as_data(sv, fake):
    x = invented()
    j = get(sv, "/home")
    assert set(j) == {"v", "home", "undo"} and j["undo"] is None
    h = j["home"]
    assert set(h) == {"today", "empty", "minutes", "minutes_options", "timer", "week", "rows", "count", "shown", "hidden", "recent"}
    assert h["today"] == today().isoformat() and not h["empty"] and h["minutes"] == 15 and h["timer"] is None and h["shown"] == 6 and h["hidden"] == 0
    assert [m["minutes"] for m in h["minutes_options"]] == [5, 15, 30, 60] and h["minutes_options"][-1]["label"] == "1 hour"
    want = homepage.now_data()["rows"]
    assert [(r["chore_id"], r["zone_id"]) for r in h["rows"]] == [(p["chore"]["id"], p["zone"]["id"]) for p in want] and h["count"] == len(want) == 7
    assert all(set(r) == ROW for r in h["rows"])
    by = {r["name"]: r for r in h["rows"]}
    # never logged first (towels, every 5 days: shorter first), the oven is retired; one row per chore (a whole-flat chore: its oldest zone)
    assert h["rows"][0]["name"] == "Zz towels" and h["rows"][0]["age"] is None and h["rows"][0]["age_text"] == "not logged yet"
    assert "Zz oven" not in by and by["Zz dust"]["zone"] == "Zz kitchen" and by["Zz dust"]["flat"] and by["Zz dust"]["age"] is None
    assert by["Zz stove"]["age"] == 9 and by["Zz stove"]["age_text"] == "9 days ago" and by["Zz stove"]["interval_text"] == "weekly"
    assert by["Zz sink"]["done_today"] and by["Zz sink"]["age_text"] == "today" and by["Zz sink"]["label"] == "Zz sink · Zz bath"
    assert by["Zz fridge"]["age"] == 40 and by["Zz fridge"]["age_text"] == "5 weeks ago" and by["Zz fridge"]["done_at"]
    assert by["Zz vacuum"]["minutes"] in (5, 10) and by["Zz vacuum"]["interval"] in (3, 7)
    assert h["week"] == {"goal": 3, "this": this_week(), "weeks": h["week"]["weeks"]} and len(h["week"]["weeks"]) == 4
    # recent: no starting point; the last 5, newest first
    assert [e["chore"] for e in h["recent"]] == ["Zz sink", "Zz vacuum", "Zz stove", "Zz dust", "Zz stove"] and all(set(e) == DONE for e in h["recent"])
    sink, stove = h["recent"][0], h["recent"][2]
    assert sink["how"] == "ticked" and sink["time"] and sink["when"].endswith(sink["time"]) and stove["how"] == "timer"
    assert h["recent"][3]["how"] == "chat"
    assert get(sv, "/home?min=30")["home"]["minutes"] == 30 and get(sv, "/home?min=7")["home"]["minutes"] == 15
    assert get(sv, "/home?min=soon")["home"]["minutes"] == 15
    # the words are app.'s
    page = homepage.render_now("c")
    for r in h["rows"][:homepage.SHOWN]:
        assert r["age_text"] in page and r["interval_text"] in page
    assert x


def test_hidden_for_today_and_the_timer_on_now(sv, fake):
    x = invented()
    sv.post("/home/skip", pairs=[[x["towels"], x["bath"]]])
    h = get(sv, "/home")["home"]
    assert h["hidden"] == 1 and "Zz towels" not in [r["name"] for r in h["rows"]] and h["count"] == 6
    sv.post("/home/start", pairs=[[x["stove"], x["kitchen"]]], minutes=15)
    t = get(sv, "/home")["home"]["timer"]
    assert set(t) == TIMER and t["state"] == "running" and 890 <= t["left"] <= 900 and t["minutes"] == 15 and t["ends_at"]
    assert t["title"] == "Zz stove" and t["pairs"] == [[x["stove"], x["kitchen"]]]
    owner_sql("UPDATE home_timers SET pairs = '[[999999, 999999]]'::jsonb")  # its job is gone: no timer, as app.
    assert get(sv, "/home")["home"]["timer"] is None


def test_the_empty_states(sv, fake):
    h = get(sv, "/home")["home"]
    assert h["empty"] and h["rows"] == [] and h["count"] == 0 and h["recent"] == [] and h["timer"] is None
    p = get(sv, "/home/pick")["home_pick"]
    assert p["empty"] == "no_chores" and p["job"] is None and p["timer"] is None and p["count"] == 0 and p["also"] == []
    z = get(sv, "/home/zones")["home_zones"]
    assert z["empty"] and z["start"]["jobs"] == [] and z["flat"] == [] and z["zones"] == []
    hi = get(sv, "/home/history")["home_history"]
    assert hi["days"] == [] and hi["jobs"] == [] and hi["count"] == 0 and not hi["more"]
    e = get(sv, "/home/edit")["home_edit"]
    assert e["flat"] == [] and e["zones"] == [] and e["goal"] == 3
    assert get(sv, "/day")["day"]["home"] is None  # no chores: no card, as app.
    # chores, but every one done today or hidden: nothing is waiting
    k = zone("Zz box", "Box")
    c = chore("Zz one", k, 7, 10)
    done(c, k, 0)
    p = get(sv, "/home/pick")["home_pick"]
    assert p["empty"] == "nothing_waiting" and p["job"] is None and p["title"] == "Your 15 minutes"
    card = get(sv, "/day")["day"]["home"]
    assert card["waiting"]["name"] == "Zz one" and card["waiting"]["done_today"]


# ---- GET /home/pick ----------------------------------------------------------------------------------------------------------------

def test_the_pick_read(sv, fake):
    x = invented()
    p = get(sv, "/home/pick")["home_pick"]
    assert set(p) == {"today", "empty", "minutes", "title", "timer", "job", "n", "count", "also", "earlier", "next_from_s", "earlier_days"}
    want = homepage.pick_data({})
    assert p["empty"] is None and p["n"] == 0 and p["count"] == len(want["jobs"]) and set(p["job"]) == JOB and p["timer"] is None
    assert p["job"]["title"] == want["job"]["title"] and p["job"]["pairs"] == [list(pr) for pr in want["job"]["pairs"]]
    assert p["also"] == [{"n": i, "title": j["title"]} for i, j in want["more"]] and p["title"] == "Your 15 minutes"
    assert p["earlier"] == [{"when": 1, "label": "Yesterday"}, {"when": 2, "label": "2 days ago"}] and p["next_from_s"] == 180
    nth = get(sv, f'/home/pick?n={p["count"] + 1}')["home_pick"]
    assert nth["n"] == 1 and nth["job"]["title"] == p["also"][0]["title"]  # n modulo the number of jobs, as app.
    hour = get(sv, "/home/pick?min=60")["home_pick"]
    assert hour["title"] == "Your hour" and hour["minutes"] == 60 and hour["job"]["session"] and len(hour["job"]["pairs"]) >= 2
    assert hour["job"]["title"].endswith(" jobs") and all(s.endswith(" min)") for s in hour["job"]["steps"])
    fridge = next(j for j in homepage.pick_data({"min": "30"})["jobs"] if j["title"] == "Zz fridge")
    assert fridge["steps"] == ["Empty a shelf", "Wipe"] and fridge["howto"] == "One shelf at a time."
    five = get(sv, "/home/pick?min=5")["home_pick"]
    assert five["job"]["minutes"] <= 5 or five["job"]["over"]
    assert x


def test_with_a_timer_the_pick_is_the_timer_s_job(sv, fake):
    x = invented()
    sv.post("/home/start", pairs=[[x["fridge"], x["kitchen"]]], minutes=30)
    p = get(sv, "/home/pick?min=5&n=3")["home_pick"]
    assert p["minutes"] == 30 and p["title"] == "Your 30 minutes" and p["job"]["title"] == "Zz fridge" and p["n"] is None and p["count"] == 1
    assert p["also"] == [] and p["timer"]["state"] == "running" and p["timer"]["title"] == "Zz fridge"
    owner_sql("UPDATE home_timers SET pairs = '[[999999, 999999]]'::jsonb")  # its job is gone: a fresh pick
    p = get(sv, "/home/pick?min=5")["home_pick"]
    assert p["timer"] is None and p["minutes"] == 5 and p["n"] == 0


# ---- GET /home/zones ---------------------------------------------------------------------------------------------------------------

def test_the_zones_read(sv, fake):
    x = invented()
    z = get(sv, "/home/zones")["home_zones"]
    assert set(z) == {"today", "empty", "start", "flat", "zones"}
    st = z["start"]
    assert [a["ago"] for a in st["answers"]] == ["week", "month", "longer", "unknown"] and st["answers"][-1]["label"] == "Don’t know"
    names = [j["name"] for j in st["jobs"]]
    assert names[0] == "Zz towels" and "Zz shoes" not in names and st["more"] == 0  # the shoes have a starting point
    dust = next(j for j in st["jobs"] if j["name"] == "Zz dust")
    assert dust["zone"] == "Zz kitchen" and dust["zones"] == 1 and dust["where"] == "Zz kitchen" and dust["pairs"] == [[x["dust"], x["kitchen"]]]
    assert all(set(j) == {"chore_id", "name", "pairs", "zone", "zones", "where", "interval", "interval_text"} for j in st["jobs"])
    flat = {f["name"]: f for f in z["flat"]}
    assert list(flat) == ["Zz dust", "Zz vacuum"]
    v = flat["Zz vacuum"]
    assert v["per_zone"]["text"] == "weekly; Kit every 3 days" and v["per_zone"]["groups"] == [
        {"interval": 3, "interval_text": "every 3 days", "zones": [{"zone_id": x["kitchen"], "short": "Kit"}]}] and v["per_zone"]["off"] == []
    assert flat["Zz dust"]["per_zone"]["text"] == "every 2 weeks; not in Hall" and flat["Zz dust"]["per_zone"]["off"] == [{"zone_id": x["hall"], "short": "Hall"}]
    tiles = {t["short"]: t for t in v["tiles"]}
    assert list(tiles) == ["Kit", "Bath", "Hall"] and tiles["Kit"]["age"] == 2 and tiles["Kit"]["age_short"] == "2 days" and tiles["Kit"]["tinted"] is False
    assert tiles["Bath"]["minutes"] == 5 and tiles["Bath"]["age_short"] == "not yet" and not v["all_done_today"]
    assert [t["short"] for t in flat["Zz dust"]["tiles"]] == ["Kit", "Bath"] and flat["Zz dust"]["tiles"][1]["age_short"] == "2 wk"
    zones = {c["name"]: c for c in z["zones"]}
    assert list(zones) == ["Zz kitchen", "Zz bath", "Zz hall"]  # the retired attic is not here
    k = zones["Zz kitchen"]
    assert [r["name"] for r in k["chores"]] == ["Zz dust", "Zz stove", "Zz fridge", "Zz vacuum"]  # Dust first, the floor last
    assert k["open"] and k["own"] == 2 and k["count"] == 4 and k["oldest_age"] is None and k["oldest_text"] == "not yet" and not k["todoist"]
    assert zones["Zz hall"]["open"] and zones["Zz hall"]["oldest_text"] == "not yet"  # the shoes' starting point is 3 days old; Vacuum never
    page = homepage.render_zones("c")
    assert v["per_zone"]["text"] in page and flat["Zz dust"]["per_zone"]["text"] in page


def test_a_whole_flat_chore_done_everywhere_today_and_the_storage_zone(sv, fake):
    x = invented()
    sv.post("/home/alldone", chore_id=x["vacuum"], key="ad-1")
    v = next(f for f in get(sv, "/home/zones")["home_zones"]["flat"] if f["name"] == "Zz vacuum")
    assert v["all_done_today"] and all(t["done_today"] and t["tinted"] for t in v["tiles"])
    zone("Storage", "Store")
    s = next(c for c in get(sv, "/home/zones")["home_zones"]["zones"] if c["name"] == "Storage")
    assert s["todoist"] and s["chores"] and s["own"] == 0  # the whole-flat chores are done there too; no chore of its own


# ---- GET /home/history -------------------------------------------------------------------------------------------------------------

def test_the_history_read(sv, fake):
    x = invented()
    h = get(sv, "/home/history")["home_history"]
    assert set(h) == {"today", "limit", "step", "max", "more", "count", "days", "jobs", "earlier_days"}
    assert h["limit"] == 60 and h["step"] == 60 and h["max"] == 600 and not h["more"] and h["count"] == 8
    days = [d["day"] for d in h["days"]]
    assert days == sorted(days, reverse=True) and h["days"][0]["label"] == f"{today():%A %d.%m.}"
    rows = [r for d in h["days"] for r in d["rows"]]
    assert all(set(r) == DONE for r in rows)
    how = {r["chore"] + str(r["day"]): r["how"] for r in rows}
    assert how["Zz shoes" + str(today() - timedelta(days=3))] == "starting point" and how["Zz fridge" + str(today() - timedelta(days=40))] == "earlier"
    start = next(r for r in rows if r["chore"] == "Zz shoes")
    assert start["time"] is None and start["dated"] and start["when"] == f"{today() - timedelta(days=3):%d.%m.}"
    assert [j["label"] for j in h["jobs"]][:3] == ["Zz dust · Zz kitchen", "Zz dust · Zz bath", "Zz fridge · Zz kitchen"]
    assert all(len(j["pairs"]) == 1 for j in h["jobs"])
    for q, want in (("n=120", 120), ("n=5", 60), ("n=9999", 600), ("n=x", 60)):
        assert get(sv, f"/home/history?{q}")["home_history"]["limit"] == want
    for back in range(60):
        done(x["sink"], x["bath"], back + 50)
    h = get(sv, "/home/history")["home_history"]
    assert h["count"] == 60 and h["more"]


# ---- GET /home/chore ---------------------------------------------------------------------------------------------------------------

def test_a_chore_s_page(sv, fake):
    x = invented()
    c = get(sv, f'/home/chore?id={x["stove"]}')["home_chore"]
    assert set(c) == {"chore_id", "name", "zone_id", "zone", "flat", "active", "interval", "interval_text", "minutes", "meta", "steps", "howto",
                      "words", "zones", "last", "last_text", "usually_days", "usually"}
    assert c["zone"] == "Zz kitchen" and not c["flat"] and c["meta"] == "weekly · 15 min · Zz kitchen" and c["steps"] == ["Knobs", "Top", "Wall behind"]
    assert [d["day"] for d in c["last"]] == [(today() - timedelta(days=b)).isoformat() for b in (9, 21, 30)] and c["zones"] is None
    assert c["usually_days"] == 12 and c["usually"] == "usually every 12 days" and c["last_text"].count(" · ") == 2
    f = get(sv, f'/home/chore?id={x["dust"]}')["home_chore"]
    assert f["flat"] and f["zone"] == "whole flat" and f["zone_id"] is None and f["last"] == [] and f["usually"] is None
    assert [(z["zone"], z["on"], z["text"]) for z in f["zones"]] == [("Zz kitchen", True, "every 2 weeks · 15 min"), ("Zz bath", True, "every 2 weeks · 15 min")]
    assert f["zones"][1]["last_text"] == f"{today() - timedelta(days=20):%d.%m.}" and f["zones"][0]["last_text"] == "not logged yet"
    done(x["dust"], x["hall"], 4)  # done where it is off: "not done here"
    hall = [z for z in get(sv, f'/home/chore?id={x["dust"]}')["home_chore"]["zones"] if z["zone"] == "Zz hall"][0]
    assert not hall["on"] and hall["text"] == "not done here" and hall["interval"] is None
    shoes = get(sv, f'/home/chore?id={x["shoes"]}')["home_chore"]
    assert shoes["last"] == [{"day": (today() - timedelta(days=3)).isoformat(), "start": True}] and shoes["last_text"].endswith(" (starting point)")
    oven = get(sv, f'/home/chore?id={x["oven"]}')["home_chore"]
    assert not oven["active"] and oven["meta"].endswith(" · retired") and oven["last_text"] == "not logged yet"
    assert get(sv, "/home/chore?id=999999", status=404) == {"v": 1, "error": "no_entry", "message": "That chore is not in the list."}
    for bad in ("", "?id=", "?id=x1"):
        assert get(sv, "/home/chore" + bad, status=400)["message"] == "id must be a chore's id."
    page = homepage.render_chore("c", {"id": str(x["stove"])})
    assert c["usually"] in page and c["meta"] in page


# ---- GET /home/edit ----------------------------------------------------------------------------------------------------------------

def test_the_edit_read(sv, fake):
    x = invented()
    e = get(sv, "/home/edit")["home_edit"]
    assert set(e) == {"goal", "flat", "zones", "zone_options", "limits"}
    assert e["goal"] == 3 and e["limits"]["days_max"] == 730 and e["limits"]["minutes_max"] == 240 and e["limits"]["goal_max"] == 7
    chore_keys = {"chore_id", "name", "zone_id", "flat", "active", "interval", "interval_text", "minutes", "meta", "steps", "howto", "words", "per_zone"}
    assert [c["name"] for c in e["flat"]] == ["Zz dust", "Zz vacuum"] and all(set(c) == chore_keys for c in e["flat"])
    v = e["flat"][1]
    assert v["per_zone"] == [{"zone_id": x["kitchen"], "zone": "Zz kitchen", "on": True, "days": 3, "minutes": None},
                             {"zone_id": x["bath"], "zone": "Zz bath", "on": True, "days": None, "minutes": 5},
                             {"zone_id": x["hall"], "zone": "Zz hall", "on": True, "days": None, "minutes": None}]
    assert [z["on"] for z in e["flat"][0]["per_zone"]] == [True, True, False]
    zones = {z["name"]: z for z in e["zones"]}
    assert list(zones) == ["Zz kitchen", "Zz bath", "Zz hall", "Zz attic"] and not zones["Zz attic"]["active"]
    k = zones["Zz kitchen"]
    assert k["short"] == "Kit" and k["spots"] == ["Counter", "Stove top"] and k["words"] == ["galley"] and k["count"] == 2
    assert [(c["name"], c["active"]) for c in k["chores"]] == [("Zz stove", True), ("Zz fridge", True), ("Zz oven", False)]
    assert k["chores"][2]["meta"] == "every 3 months · 30 min · retired" and k["chores"][0]["per_zone"] is None
    assert e["zone_options"][0] == {"zone_id": None, "label": "Whole flat (each zone on its own)", "active": True}
    assert e["zone_options"][-1] == {"zone_id": x["attic"], "label": "Zz attic (retired)", "active": False}


# ---- Today's Home card in GET /day -------------------------------------------------------------------------------------------------

def test_todays_home_card_in_the_day(sv, fake):
    x = invented()
    card = get(sv, "/day")["day"]["home"]
    assert set(card) == {"this_week", "goal", "text", "waiting", "hidden"}
    assert card["this_week"] == this_week() and card["goal"] == 3 and card["text"] == f"this week {this_week()} of 3" and card["hidden"] == 0
    assert set(card["waiting"]) == ROW and card["waiting"]["name"] == "Zz towels" and card["waiting"]["age_text"] == "not logged yet"
    page = homepage.today_card()
    assert card["text"] in page and card["waiting"]["label"] in page
    sv.post("/home/skip", pairs=[[x["towels"], x["bath"]]])
    card = get(sv, "/day")["day"]["home"]
    assert card["hidden"] == 1 and card["waiting"]["name"] != "Zz towels"
    assert get(sv, f"/day?day={today() - timedelta(days=1)}")["day"]["home"] is None  # a past day: no card, as app.
    with connect() as c:
        c.execute("INSERT INTO ui_settings (key, value) VALUES (%s, %s) ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value",
                  (uiprefs.KEY, '{"hidden": ["card:home"], "order": {}}'))
    assert get(sv, "/day")["day"]["home"] is None  # hidden in Settings > Today page, as app.


# ---- POST /home/tick, /alldone, /remove (and their keys and Undo) ------------------------------------------------------------------

def test_a_tick_with_its_key_and_undo(sv, fake):
    x = invented()
    j = shaped(sv.post("/home/tick", chore_id=x["stove"], zone_id=x["kitchen"], key="t-1"), "home")
    assert j["outcome"] == "saved" and j["head"] == "Saved: Zz stove · Zz kitchen" and got_undo(j)
    assert next(r for r in j["home"]["rows"] if r["name"] == "Zz stove")["done_today"]
    again = sv.post("/home/tick", chore_id=x["stove"], zone_id=x["kitchen"], key="t-1")
    assert again["replayed"] and again["outcome"] == "saved" and again["undo"]["token"] == j["undo"]["token"]
    assert len(done_rows(x["stove"])) == 4
    other = sv.post("/home/tick", chore_id=x["fridge"], zone_id=x["kitchen"], key="t-1")
    assert other["outcome"] == "rejected" and other["reason"] == "This form was already used." and len(done_rows(x["fridge"])) == 1
    u = sv.post("/undo", token=j["undo"]["token"], view="home")
    assert u["outcome"] == "changed" and u["head"] == "Undone: the tick is gone." and "home" in u and len(done_rows(x["stove"])) == 3
    # a second tap on a done one takes its tick off; Undo puts it back
    off = sv.post("/home/tick", chore_id=x["sink"], zone_id=x["bath"], key="t-2")
    assert off["outcome"] == "changed" and off["head"] == "Ticked off: Zz sink · Zz bath" and done_rows(x["sink"]) == []
    u = sv.post("/undo", token=off["undo"]["token"], view="home_zones")
    assert u["head"] == "Undone: Zz sink · Zz bath is done again." and len(done_rows(x["sink"])) == 1 and "home_zones" in u
    bad = sv.post("/home/tick", chore_id=x["stove"], zone_id=x["bath"], key="t-3")  # not this chore's zone
    assert bad["outcome"] == "rejected" and bad["reason"] == "That chore is not in the list." and bad["tone"] == "warning"


def test_all_done_with_key_and_undo(sv, fake):
    x = invented()
    j = shaped(sv.post("/home/alldone", chore_id=x["vacuum"], key="a-1"), "home_zones")
    assert j["outcome"] == "saved" and j["head"] == "Saved: Zz vacuum · whole flat" and got_undo(j)
    today_rows = [r for r in done_rows(x["vacuum"]) if r["day"] == today()]
    assert sorted(r["zone_id"] for r in today_rows) == sorted([x["kitchen"], x["bath"], x["hall"]])
    assert sv.post("/home/alldone", chore_id=x["vacuum"], key="a-1")["replayed"]
    assert sv.post("/home/alldone", chore_id=x["dust"], key="a-1")["reason"] == "This form was already used."
    u = sv.post("/undo", token=j["undo"]["token"])
    assert u["head"] == "Undone: the tick is gone." and [r for r in done_rows(x["vacuum"]) if r["day"] == today()] == [] and "day" in u
    assert sv.post("/home/alldone", chore_id=x["stove"], key="a-2")["reason"] == "That is not a whole-flat chore."


def test_remove_from_the_history_and_undo(sv, fake):
    x = invented()
    sv.post("/home/alldone", chore_id=x["vacuum"], key="r-0")
    entry = get(sv, "/home/history")["home_history"]["days"][0]["rows"][0]
    assert entry["label"] == "Zz vacuum · whole flat" and len(entry["ids"]) == 3
    before = done_rows(x["vacuum"])
    j = shaped(sv.post("/home/remove", ids=entry["ids"]), "home_history")
    assert j["outcome"] == "changed" and j["head"] == "Removed: Zz vacuum" and got_undo(j) and len(done_rows(x["vacuum"])) == 1
    u = sv.post("/undo", token=j["undo"]["token"], view="home_history", view_limit=120)
    assert u["head"] == "Undone: Zz vacuum is back in the history." and done_rows(x["vacuum"]) == before and u["home_history"]["limit"] == 120
    assert sv.post("/home/remove", ids=[999999])["reason"] == "That is not in the history any more."


# ---- POST the timer: /start, /pause, /resume, /stop, /pickdone, /picknext, /skip --------------------------------------------------

def test_the_timer_start_pause_resume_stop(sv, fake):
    x = invented()
    j = shaped(sv.post("/home/start", pairs=[[x["stove"], x["kitchen"]]], minutes=15), "home_pick")
    assert j["outcome"] == "changed" and j["head"] == "Timer started: 15 minutes." and j["undo"] is None
    t = j["home_pick"]["timer"]
    assert t["state"] == "running" and t["minutes"] == 15
    j = sv.post("/home/pause", timer_id=t["id"])
    assert j["head"] == "Timer paused." and j["home_pick"]["timer"]["state"] == "paused" and j["home_pick"]["timer"]["ends_at"] is None
    assert sv.post("/home/pause", timer_id=t["id"])["reason"] == "That timer is not running."
    j = sv.post("/home/resume", timer_id=t["id"])
    assert j["head"] == "Timer running again." and j["home_pick"]["timer"]["state"] == "running" and j["home_pick"]["timer"]["ends_at"]
    assert sv.post("/home/resume", timer_id=t["id"])["reason"] == "That timer is not paused."
    owner_sql("UPDATE home_timers SET ends_at = now() - interval '1 second'")
    assert get(sv, "/home/pick")["home_pick"]["timer"]["state"] == "over"
    j = sv.post("/home/stop", timer_id=t["id"])
    assert j["head"] == "Timer closed." and j["home_pick"]["timer"] is None and timers()[0]["closed"]
    assert sv.post("/home/stop", timer_id=t["id"])["reason"] == "That timer is already closed."
    assert get(sv, "/home")["home"]["week"]["this"] == this_week()  # a timer that ran out is a session (today has a tick anyway)
    assert sv.post("/home/start", pairs=[[x["stove"], x["kitchen"]]], minutes=0)["reason"] == "That job is not in the list any more."
    assert sv.post("/home/start", pairs=[[x["oven"], x["kitchen"]]], minutes=15)["reason"] == "That job is not in the list any more."


def test_pick_done_with_key_and_undo(sv, fake):
    x = invented()
    sv.post("/home/start", pairs=[[x["stove"], x["kitchen"]], [x["fridge"], x["kitchen"]]], minutes=30)
    j = shaped(sv.post("/home/pickdone", pairs=[[x["stove"], x["kitchen"]], [x["fridge"], x["kitchen"]]], key="p-1"), "home")
    assert j["outcome"] == "saved" and j["head"] == "Saved: Zz stove · Zz kitchen; Zz fridge · Zz kitchen" and got_undo(j)
    assert all(t["closed"] for t in timers()) and j["home"]["timer"] is None
    assert [r["source"] for r in done_rows(x["stove"]) if r["day"] == today()] == ["pick"]
    assert sv.post("/home/pickdone", pairs=[[x["stove"], x["kitchen"]], [x["fridge"], x["kitchen"]]], key="p-1")["replayed"]
    assert sv.post("/home/pickdone", pairs=[[x["stove"], x["kitchen"]]], key="p-1")["reason"] == "This form was already used."
    u = sv.post("/undo", token=j["undo"]["token"])
    assert u["head"] == "Undone: the tick is gone." and [r for r in done_rows(x["stove"]) if r["day"] == today()] == []
    sv.post("/home/tick", chore_id=x["stove"], zone_id=x["kitchen"], key="p-2")
    j = sv.post("/home/pickdone", pairs=[[x["stove"], x["kitchen"]]], key="p-3")
    assert j["head"] == "Already ticked today." and j["undo"] is None  # nothing new ticked: no Undo


def test_done_next_job_with_key_and_undo(sv, fake):
    x = invented()
    sv.post("/home/start", pairs=[[x["stove"], x["kitchen"]]], minutes=60)
    t = timers()[0]
    j = shaped(sv.post("/home/picknext", pairs=[[x["stove"], x["kitchen"]]], timer_id=t["id"], key="n-1"), "home_pick")
    assert j["outcome"] == "saved" and j["head"].startswith("Saved: Zz stove · Zz kitchen. Next: ") and got_undo(j)
    nxt = j["home_pick"]["timer"]
    assert nxt["state"] == "running" and nxt["title"] == j["head"].split("Next: ")[1] and j["home_pick"]["job"]["title"] == nxt["title"]
    assert sv.post("/home/picknext", pairs=[[x["stove"], x["kitchen"]]], timer_id=t["id"], key="n-1")["replayed"]
    assert sv.post("/home/picknext", pairs=[[x["fridge"], x["kitchen"]]], timer_id=t["id"], key="n-1")["reason"] == "This form was already used."
    u = sv.post("/undo", token=j["undo"]["token"], view="home_pick")
    assert u["head"] == "Undone: the tick is gone." and [r for r in done_rows(x["stove"]) if r["day"] == today()] == []
    # a job ticked already: no Undo; under 3 minutes left: the timer closes
    owner_sql("UPDATE home_timers SET ends_at = now() + interval '100 seconds'")
    sv.post("/home/tick", chore_id=x["shoes"], zone_id=x["hall"], key="n-2")
    j = sv.post("/home/picknext", pairs=[[x["shoes"], x["hall"]]], timer_id=t["id"], key="n-3")
    assert j["outcome"] == "changed" and j["head"].endswith("Nothing else fits in the time left; the timer is closed.") and j["undo"] is None
    assert timers()[0]["closed"]
    assert sv.post("/home/picknext", pairs=[[x["shoes"], x["hall"]]], timer_id=t["id"], key="n-4")["reason"] == "That timer is not running."


def test_not_today_and_its_undo(sv, fake):
    x = invented()
    j = shaped(sv.post("/home/skip", pairs=[[x["towels"], x["bath"]]]), "home_pick")
    assert j["outcome"] == "changed" and j["head"] == "Not today: Zz towels · Zz bath" and got_undo(j)
    assert sv.post("/home/skip", pairs=[[x["towels"], x["bath"]]])["head"] == "Hidden already."
    sv.post("/home/skip", pairs=[[x["fridge"], x["kitchen"]]])
    u = sv.post("/undo", token=sv.post("/home/skip", pairs=[[x["stove"], x["kitchen"]]])["undo"]["token"], view="home")
    assert u["head"] == "Undone: the job is back in the list." and u["home"]["hidden"] == 2


# ---- POST /home/startpoint and /earlier -----------------------------------------------------------------------------------------

def test_a_starting_point_with_key_and_undo(sv, fake):
    x = invented()
    j = shaped(sv.post("/home/startpoint", pairs=[[x["towels"], x["bath"]]], ago="month", key="s-1"), "home_zones")
    assert j["outcome"] == "changed" and j["head"] == "Starting point: Zz towels · Zz bath" and got_undo(j)
    r = done_rows(x["towels"])
    assert len(r) == 1 and r[0]["source"] == "start" and r[0]["dated"] and today() - r[0]["day"] == timedelta(days=14)
    assert sv.post("/home/startpoint", pairs=[[x["towels"], x["bath"]]], ago="month", key="s-1")["replayed"]
    assert sv.post("/home/startpoint", pairs=[[x["towels"], x["bath"]]], ago="week", key="s-1")["reason"] == "This form was already used."
    sv.post("/undo", token=j["undo"]["token"])
    assert done_rows(x["towels"]) == []
    # "Don't know": off the card, still not logged; Undo puts it back on the card
    j = sv.post("/home/startpoint", pairs=[[x["towels"], x["bath"]]], ago="unknown", key="s-2")
    assert j["head"] == "Left as not logged yet: Zz towels · Zz bath" and got_undo(j)
    assert "Zz towels" not in [k["name"] for k in j["home_zones"]["start"]["jobs"]] and done_rows(x["towels"]) == []
    u = sv.post("/undo", token=j["undo"]["token"], view="home_zones")
    assert u["head"] == "Undone: the job is back on the card." and "Zz towels" in [k["name"] for k in u["home_zones"]["start"]["jobs"]]


def test_a_job_done_earlier_with_key_and_undo(sv, fake):
    x = invented()
    j = shaped(sv.post("/home/earlier", pairs=[[x["towels"], x["bath"]]], when=2, key="e-1"), "home_pick")
    d2 = today() - timedelta(days=2)
    assert j["outcome"] == "saved" and j["head"] == f"Saved: Zz towels · Zz bath on {d2:%d.%m.}" and got_undo(j)
    assert [(r["day"], r["dated"], r["source"]) for r in done_rows(x["towels"])] == [(d2, True, "web")]
    assert sv.post("/home/earlier", pairs=[[x["towels"], x["bath"]]], when=2, key="e-1")["replayed"]
    assert sv.post("/home/earlier", pairs=[[x["towels"], x["bath"]]], when=1, key="e-1")["reason"] == "This form was already used."
    sv.post("/undo", token=j["undo"]["token"])
    assert done_rows(x["towels"]) == []
    d = today() - timedelta(days=10)
    j = sv.post("/home/earlier", pairs=[[x["towels"], x["bath"]]], when=d.isoformat(), key="e-2", view="home_history")
    assert j["outcome"] == "saved" and "home_history" in j and done_rows(x["towels"])[0]["day"] == d
    assert sv.post("/home/earlier", pairs=[[x["towels"], x["bath"]]], when=today().isoformat(), key="e-3")["reason"] == "Pick a day before today, in the last year."
    assert sv.post("/home/earlier", pairs=[[999, 999]], when=1, key="e-4")["reason"] == "Pick a job from the list."


# ---- POST Edit zones: zones, chores, per zone, the goal ----------------------------------------------------------------------------

def test_zones_new_changed_retired_and_back(sv, fake):
    x = invented()
    j = shaped(sv.post("/home/zonenew", name=" Zz  study ", short="Desk", spots=["Desk", "Shelf"], words=["office", "den"]), "home_edit")
    assert j["outcome"] == "changed" and j["head"] == "Added the zone Zz study." and j["undo"] is None
    z = next(z for z in j["home_edit"]["zones"] if z["name"] == "Zz study")
    assert (z["short"], z["spots"], z["words"]) == ("Desk", ["Desk", "Shelf"], ["office", "den"])
    assert sv.post("/home/zonenew", name="zz STUDY")["reason"] == "Zz study is already in your list."
    j = sv.post("/home/zoneedit", zone_id=z["zone_id"], name="Zz den", short="Den", spots=[], words=[])
    assert j["head"] == "Saved the zone Zz den." and next(z_ for z_ in j["home_edit"]["zones"] if z_["zone_id"] == z["zone_id"])["spots"] == []
    assert sv.post("/home/zoneedit", zone_id=z["zone_id"], name="Zz kitchen")["reason"] == "Another zone has that name."
    assert sv.post("/home/zoneedit", zone_id=999999, name="Zz nowhere")["reason"] == "That zone is not in the list."
    assert sv.post("/home/zonenew", name="")["reason"] == "Type the zone's name."
    j = sv.post("/home/zoneactive", zone_id=x["hall"], on=False)
    assert j["head"] == "Zz hall is retired; its history stays." and "Zz hall" not in [c["name"] for c in get(sv, "/home/zones")["home_zones"]["zones"]]
    assert sv.post("/home/zoneactive", zone_id=x["hall"], on=True)["head"] == "Zz hall is back."
    assert sv.post("/home/zonenew", name="Zz attic")["head"] == "Zz attic is back in your list."  # a retired zone of that name


def test_chores_new_changed_retired_and_back(sv, fake):
    x = invented()
    j = shaped(sv.post("/home/chorenew", name="Zz windows", zone_id=None, days=90, minutes=30, steps=["Glass", "Frame"], howto="Dry cloth last.",
                       words=["window"]), "home_edit")
    assert j["outcome"] == "changed" and j["head"] == "Added Zz windows (every 3 months)." and j["undo"] is None
    w = next(c for c in j["home_edit"]["flat"] if c["name"] == "Zz windows")
    assert (w["interval"], w["minutes"], w["steps"], w["howto"], w["words"]) == (90, 30, ["Glass", "Frame"], "Dry cloth last.", ["window"])
    j = sv.post("/home/chorenew", name="Zz mirror", zone_id=x["bath"], days=14)
    m = next(c for z in j["home_edit"]["zones"] for c in z["chores"] if c["name"] == "Zz mirror")
    assert m["minutes"] == 15 and m["zone_id"] == x["bath"]  # minutes left out: 15, as app.
    assert sv.post("/home/chorenew", name="Zz x", zone_id=x["attic"], days=7)["reason"] == "Pick a zone from the list, or the whole flat."
    assert sv.post("/home/chorenew", name="Zz x", zone_id=None, days=800)["reason"] == "The interval is 1 to 730 days and the time 1 to 240 minutes."
    assert sv.post("/home/chorenew", name="Zz x", zone_id=None, days=7, minutes=0)["reason"] == "The interval is 1 to 730 days and the time 1 to 240 minutes."
    assert sv.post("/home/chorenew", name="", zone_id=None, days=7)["reason"] == "Type the chore's name."
    j = sv.post("/home/choreedit", chore_id=m["chore_id"], name="Zz mirror", zone_id=x["bath"], days=7, minutes=5, steps=[], howto=None, words=[])
    assert j["head"] == "Saved Zz mirror (weekly)."
    assert sv.post("/home/choreedit", chore_id=999999, name="Zz y", zone_id=None, days=7)["reason"] == "That chore is not in the list."
    j = sv.post("/home/choreactive", chore_id=x["stove"], on=False)
    assert j["head"] == "Zz stove is retired; its history stays." and "Zz stove" not in [r["name"] for r in get(sv, "/home")["home"]["rows"]]
    assert sv.post("/home/choreactive", chore_id=x["stove"], on=True, view="home")["head"] == "Zz stove is back."


def test_a_whole_flat_chore_per_zone(sv, fake):
    x = invented()
    j = shaped(sv.post("/home/chorezones", chore_id=x["vacuum"], zones=[
        {"zone_id": x["kitchen"], "on": True, "days": 3, "minutes": None}, {"zone_id": x["bath"], "on": True, "days": None, "minutes": 8},
        {"zone_id": x["hall"], "on": False, "days": None, "minutes": None}]), "home_edit")
    assert j["outcome"] == "changed" and j["head"] == "Saved Zz vacuum per zone." and j["undo"] is None
    v = next(c for c in j["home_edit"]["flat"] if c["name"] == "Zz vacuum")
    assert [(z["on"], z["days"], z["minutes"]) for z in v["per_zone"]] == [(True, 3, None), (True, None, 8), (False, None, None)]
    left_out = sv.post("/home/chorezones", chore_id=x["vacuum"], zones=[{"zone_id": x["kitchen"], "on": True}])  # a zone left out is off
    assert [z["on"] for z in next(c for c in left_out["home_edit"]["flat"] if c["name"] == "Zz vacuum")["per_zone"]] == [True, False, False]
    assert sv.post("/home/chorezones", chore_id=x["vacuum"], zones=[])["reason"] == "Zz vacuum needs at least one zone. Retire it instead."
    bad = sv.post("/home/chorezones", chore_id=x["vacuum"], zones=[{"zone_id": x["kitchen"], "on": True, "days": 731}])
    assert bad["reason"] == "Give the days (1 to 730) and minutes (1 to 240) as whole numbers, or leave them blank."
    assert sv.post("/home/chorezones", chore_id=x["stove"], zones=[])["reason"] == "That is not a whole-flat chore."


def test_the_weekly_goal(sv, fake):
    invented()
    j = shaped(sv.post("/home/goalset", goal=5), "home_edit")
    assert j["head"] == "Weekly goal: 5 sessions." and j["home_edit"]["goal"] == 5 and get(sv, "/day")["day"]["home"]["goal"] == 5
    j = sv.post("/home/goalset", goal=8)
    assert j["outcome"] == "rejected" and j["reason"] == "The weekly goal is 1 to 7 sessions." and j["tone"] == "warning"


def test_a_save_without_undo_ends_the_one_before_and_a_refusal_keeps_it(sv, fake):
    x = invented()
    sv.post("/home/tick", chore_id=x["stove"], zone_id=x["kitchen"], key="u-1")
    j = sv.post("/home/goalset", goal=4)
    assert j["undo"] is None and sv.undo_row() is None
    sv.post("/home/tick", chore_id=x["fridge"], zone_id=x["kitchen"], key="u-2")
    j = sv.post("/home/goalset", goal=9)
    assert j["outcome"] == "rejected" and j["undo"]


# ---- the views and the checks ------------------------------------------------------------------------------------------------------

def test_a_view_in_the_body_chooses_the_read(sv, fake):
    x = invented()
    j = sv.post("/home/tick", chore_id=x["stove"], zone_id=x["kitchen"], key="v-1", view="home", view_min=60)
    assert j["home"]["minutes"] == 60
    j = sv.post("/home/skip", pairs=[[x["towels"], x["bath"]]], view="home_pick", view_min=30, view_n=1)
    assert j["home_pick"]["minutes"] == 30 and j["home_pick"]["n"] == 1
    j = sv.post("/home/choreedit", chore_id=x["fridge"], name="Zz fridge", zone_id=x["kitchen"], days=30, view="home_chore", view_id=x["fridge"])
    assert j["home_chore"]["name"] == "Zz fridge"
    assert sv.post("/home/goalset", goal=3, view="home_chore")["home_chore"] is None  # no view_id: null, the save is made
    j = sv.post("/home/tick", chore_id=x["stove"], zone_id=x["kitchen"], key="v-2", view="day")
    assert set(j) == KEYS | {"day"} and j["day"]["home"]


@pytest.mark.parametrize("path,body,why", [
    ("/home/tick", {"chore_id": "1", "zone_id": 1}, "chore_id must be a number."),
    ("/home/tick", {"chore_id": 1}, "zone_id must be a number."),
    ("/home/remove", {"ids": "1,2"}, "ids must be a list of 1 to 20 ids (a history entry's ids)."),
    ("/home/remove", {"ids": []}, "ids must be a list of 1 to 20 ids (a history entry's ids)."),
    ("/home/start", {"pairs": "1-2", "minutes": 15}, "pairs must be a list of 1 to 12 [chore_id, zone_id]."),
    ("/home/start", {"pairs": [[1, True]], "minutes": 15}, "pairs must be a list of 1 to 12 [chore_id, zone_id]."),
    ("/home/start", {"pairs": [[1, 2]], "minutes": "15"}, "minutes must be a whole number."),
    ("/home/pause", {"timer_id": None}, "timer_id must be a number."),
    ("/home/zoneactive", {"zone_id": 1, "on": "1"}, "on must be true or false."),
    ("/home/zonenew", {"name": "x" * 41}, "name must be 40 characters or fewer."),
    ("/home/zonenew", {"name": "Zz a", "spots": "Desk"}, "spots must be a list of up to 12 texts of up to 40 characters, one line each."),
    ("/home/zonenew", {"name": "Zz a", "words": ["a, b"]}, "words must be a list of up to 12 texts of up to 40 characters, without commas."),
    ("/home/chorenew", {"name": "Zz a", "days": 7}, "zone_id is missing (null = the whole flat)."),
    ("/home/chorenew", {"name": "Zz a", "zone_id": None, "days": 7.5}, "days must be a whole number."),
    ("/home/chorenew", {"name": "Zz a", "zone_id": None, "days": 7, "steps": ["a\nb"]}, "steps must be a list of up to 8 texts of up to 80 characters, one line each."),
    ("/home/chorenew", {"name": "Zz a", "zone_id": None, "days": 7, "howto": 5}, "howto must be text or null."),
    ("/home/chorezones", {"chore_id": 1, "zones": {"1": True}}, "zones must be a list of {zone_id, on, days, minutes}."),
    ("/home/chorezones", {"chore_id": 1, "zones": [{"zone_id": 1, "on": True, "days": "3"}]}, "days must be a whole number."),
    ("/home/startpoint", {"pairs": [[1, 2]], "ago": "ages"}, "ago must be week, month, longer or unknown."),
    ("/home/earlier", {"pairs": [[1, 2]], "when": "yesterday"}, "when must be 1 to 7 (days ago) or a date yyyy-mm-dd."),
    ("/home/goalset", {"goal": None}, "goal must be a whole number."),
])
def test_a_wrong_kind_of_field_is_a_400(sv, fake, path, body, why):
    r = sv.raw(path, **body)
    assert r.status_code == 400 and r.json() == {"v": 1, "error": "bad_request", "message": why}
    assert n("SELECT count(*) AS n FROM home_zones") == 0 and n("SELECT count(*) AS n FROM home_timers") == 0


READS = ["/home", "/home/pick", "/home/zones", "/home/history", "/home/chore?id=1", "/home/edit"]
NEW = [("GET", "/api/v1" + p, {}) for p in READS] + [("POST", f"/api/v1/home/{a}", {"chore_id": 1, "zone_id": 1, "on": True, "name": "Zz x"})
                                                      for a in home.ACTIONS]


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
    assert n("SELECT count(*) AS n FROM home_zones") == 0 and n("SELECT count(*) AS n FROM home_chores") == 0


def test_every_action_has_a_route_and_nothing_else_does(sv, fake):
    assert set(api.HOME_FORMS) == set(home.ACTIONS) and len(home.ACTIONS) == 20
    assert set(api.HOME_KEYED) < set(home.ACTIONS)
    for path in ("/home/seed", "/home/undo", "/home/chat"):
        assert sv.c.post("/api/v1" + path, headers=sv.h, json={}).status_code == 404
    assert reads.home and homepage.now_data


def test_app_s_pages_still_draw(fake, web):
    """app.'s six Home pages and the card draw from the same data functions (checked byte for byte against the old code at deploy 98)."""
    x = invented()
    sv_ = Door()
    sv_.post("/home/start", pairs=[[x["stove"], x["kitchen"]]], minutes=15)
    for path in ("/web/home", "/web/home/pick", "/web/home/zones", "/web/home/history", f'/web/home/chore?id={x["dust"]}', "/web/home/edit", "/web/"):
        r = web[0].get(path)
        assert r.status_code == 200 and ("Home" in r.text), path
    assert f"this week {this_week()} of 3" in homepage.today_card()


from test_web import web  # noqa: E402,F401 - the web app's signed-in client

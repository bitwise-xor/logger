"""Web item 57 (22.11.2026): "Time is up" as a phone notification at the moment the Home > Pick timer ends (hometimer.py). The round
is tested as a plain function (the thread is started only in main.py, which the tests never import), with the starter list's jobs and
invented push subscriptions; webpush.send is a stub."""
import threading
import time
from datetime import timedelta

import pytest

from app import home, hometimer, nudges, webpush
from app.db import connect
from conftest import owner_sql
from test_api_door import door_on  # noqa: F401 - autouse: the door takes the front's token
from test_api_push import GOOGLE, notify, sub, sv  # noqa: F401 - sv: the JSON door signed in (fixture)
from test_home import starter  # noqa: F401 - fixture: the starter list of zones and chores
from test_nudges import APPLE, push_clean  # noqa: F401 - push_clean is autouse: a test VAPID key, no subscriptions
from test_web import act, web  # noqa: F401 - web: a signed-in app. session (fixture)


@pytest.fixture
def sent(monkeypatch):
    """webpush.send as a stub: every (endpoint, message, push options) it would post; each push service takes it (201)."""
    out = []
    monkeypatch.setattr(webpush, "send", lambda s, msg, **kw: out.append((s["endpoint"], msg, kw)) or 201)
    return out


@pytest.fixture
def phone():
    return sub(APPLE + "-timer")


def job():
    with connect() as c, c.cursor() as cur:
        d = home.load(cur)
        return home.candidates(d, 15, home.skipped(cur, d["today"]))[0]


def start(minutes=15) -> dict:
    j = job()
    assert home.start({"pairs": home.pairs_value(j["pairs"]), "minutes": str(minutes)})["outcome"] == "changed"
    return {**row(), "title": j["title"], "pairs_value": home.pairs_value(j["pairs"])}


def row() -> dict:
    return owner_sql("SELECT * FROM home_timers ORDER BY id DESC LIMIT 1")[0]


def at_end(t, seconds=5):
    """A moment just after the timer's end as it is stored now."""
    return row()["ends_at"] + timedelta(seconds=seconds) if t is None else t["ends_at"] + timedelta(seconds=seconds)


def audits():
    return owner_sql("SELECT tool, outcome, client, detail FROM audit_log WHERE tool = 'nudge'")


# ---- the round ----------------------------------------------------------------------------------------------------------------------

def test_a_timer_that_ends_is_announced_once_with_its_job_and_minutes(starter, phone, sent):
    t = start()
    assert hometimer.round(t["ends_at"] - timedelta(seconds=5)) == {"claimed": 0, "sent": 0, "devices": 0}  # still running
    assert hometimer.round(at_end(t)) == {"claimed": 1, "sent": 1, "devices": 1}
    assert [m for _e, m, _k in sent] == [{"title": "Time is up", "body": f'{t["title"]} · 15 minutes', "url": "/web/home/pick", "tag": "home_timer"}]
    assert sent[0][2] == {"ttl": 600, "urgency": "high"}  # nothing late from the push service; a sleeping phone wakes
    assert row()["notified_at"] is not None and not row()["closed"]  # the page still says "Time is up" and offers Done
    assert hometimer.round(at_end(t, 15))["claimed"] == 0  # the next round: nothing again
    assert hometimer.round(at_end(t, 300))["claimed"] == 0  # announced and left open: never again
    assert len(sent) == 1
    assert audits() == [{"tool": "nudge", "outcome": "sent", "client": "nudges", "detail": {"kind": "home_timer"}}]  # never the job's name


def test_the_round_uses_the_databases_clock_by_default(starter, phone, sent):
    start()
    owner_sql("UPDATE home_timers SET ends_at = now() - interval '3 seconds'")
    assert hometimer.round()["claimed"] == 1 and len(sent) == 1


def test_a_paused_timer_is_not_announced_and_a_resumed_one_at_its_new_end(starter, phone, sent):
    t = start()
    assert home.pause({"timer": str(t["id"])})["outcome"] == "changed"
    assert hometimer.round(at_end(t, 3600))["claimed"] == 0  # paused: no end, however late it is
    owner_sql("UPDATE home_timers SET left_s = 120")  # two minutes were left when it was paused
    assert home.resume({"timer": str(t["id"])})["outcome"] == "changed"
    new = row()
    assert new["ends_at"] < t["ends_at"]
    assert hometimer.round(new["ends_at"] - timedelta(seconds=2))["claimed"] == 0
    assert hometimer.round(new["ends_at"] + timedelta(seconds=2))["claimed"] == 1 and len(sent) == 1


def test_done_next_job_keeps_the_end_and_is_announced_once(starter, phone, sent):
    t = start(30)
    out = home.pick_next({"pairs": t["pairs_value"], "timer": str(t["id"])})
    assert "Next:" in out["head"]
    after = row()
    assert after["ends_at"] == t["ends_at"] and after["pairs"] != t["pairs"] and not after["closed"]
    assert hometimer.round(at_end(t))["claimed"] == 1
    assert hometimer.round(at_end(t, 20))["claimed"] == 0
    assert len(sent) == 1 and sent[0][1]["body"].endswith("· 30 minutes")


def test_a_timer_stopped_or_done_before_its_end_is_never_announced(starter, phone, sent):
    t = start()
    assert home.stop({"timer": str(t["id"])})["outcome"] == "changed"
    assert hometimer.round(at_end(t))["claimed"] == 0
    t = start()
    assert home.pick_done({"pairs": t["pairs_value"], "timer": str(t["id"])})["outcome"] == "saved"
    assert hometimer.round(at_end(t))["claimed"] == 0
    assert sent == [] and owner_sql("SELECT count(*) AS n FROM home_timers WHERE notified_at IS NOT NULL")[0]["n"] == 0


def test_a_timer_that_ended_more_than_ten_minutes_ago_is_never_announced_late(starter, phone, sent):
    t = start()
    assert hometimer.round(t["ends_at"] + timedelta(minutes=10, seconds=1))["claimed"] == 0  # the core was down
    assert row()["notified_at"] is None and sent == []
    assert hometimer.round(t["ends_at"] + timedelta(minutes=9, seconds=50))["claimed"] == 1  # within the 10 minutes it still comes


def test_the_setting_off_or_the_master_switch_off_sends_nothing_but_marks_the_timer(starter, phone, sent):
    for off in ({"home_timer": False}, {"on": False}):
        nudges.save({**nudges.DEFAULTS, **off})
        t = start()
        assert hometimer.round(at_end(t)) == {"claimed": 1, "sent": 0, "devices": 1}
        assert row()["notified_at"] is not None
    nudges.save(dict(nudges.DEFAULTS))
    assert hometimer.round(at_end(None, 30))["claimed"] == 0  # turned on again: nothing late
    assert sent == [] and audits() == []


def test_the_quiet_hours_and_once_a_day_do_not_apply(starter, phone, sent):
    """No wake-up logged today (the nudges' quiet hours) and two timers on the same day: each gets its notification."""
    for _ in range(2):
        t = start()
        assert hometimer.round(at_end(t))["sent"] == 1
    assert len(sent) == 2 and owner_sql("SELECT count(*) AS n FROM push_sent")[0]["n"] == 0


def test_with_no_device_the_timer_is_still_marked(starter, sent):
    t = start()
    assert hometimer.round(at_end(t)) == {"claimed": 1, "sent": 0, "devices": 0}
    sub(APPLE + "-later")  # a device subscribes a moment later
    assert hometimer.round(at_end(t, 30))["claimed"] == 0 and sent == []


def test_the_link_opens_the_pick_page_at_each_address(starter, sent):
    sub(APPLE + "-app", origin="app")
    sub(GOOGLE + "logger", origin="logger")
    t = start()
    assert hometimer.round(at_end(t)) == {"claimed": 1, "sent": 1, "devices": 2}
    assert {e: m["url"] for e, m, _k in sent} == {APPLE + "-app": "/web/home/pick", GOOGLE + "logger": "/home/pick"}


def test_a_job_that_is_gone_leaves_the_minutes_alone(starter, phone, sent):
    t = start(20)
    owner_sql("UPDATE home_chores SET active = false")
    assert hometimer.round(at_end(t))["sent"] == 1
    assert sent[0][1]["body"] == "20 minutes"


def test_a_failing_send_does_not_raise_and_is_not_repeated(starter, phone, monkeypatch):
    calls = []

    def boom(s, msg, **kw):
        calls.append(msg)
        raise RuntimeError("no network")

    monkeypatch.setattr(webpush, "send", boom)
    t = start()
    assert hometimer.round(at_end(t)) == {"claimed": 1, "sent": 0, "devices": 1}
    assert hometimer.round(at_end(t, 20))["claimed"] == 0 and len(calls) == 1
    monkeypatch.setattr(webpush, "send", lambda s, msg, **kw: 500)  # the push service refuses: counted as a failure, not repeated
    t = start()
    assert hometimer.round(at_end(t)) == {"claimed": 1, "sent": 0, "devices": 1}
    assert owner_sql("SELECT failures FROM push_subscriptions")[0]["failures"] == 1


def test_two_claims_at_the_same_moment_send_once(starter):
    t = start()
    when = at_end(t)
    other = {}
    with connect() as a:
        first = hometimer.claim(a.cursor(), when)  # not committed yet: holds the row

        def second():
            with connect() as b:
                other["rows"] = hometimer.claim(b.cursor(), when)

        th = threading.Thread(target=second)
        th.start()
        for _ in range(50):  # until the second claim waits for the first one's lock
            waiting = owner_sql("SELECT count(*) AS n FROM pg_locks WHERE NOT granted")[0]["n"]
            if waiting:
                break
            time.sleep(0.05)
        assert waiting == 1
    th.join(5)
    assert [r["id"] for r in first] == [t["id"]] and other["rows"] == []


def test_the_thread_is_not_running_in_the_tests():
    assert not any(th.name in ("hometimer", "maintenance") for th in threading.enumerate())


# ---- the switch in Settings > Notifications ----------------------------------------------------------------------------------------

def test_the_door_lists_the_switch_without_hours_and_saves_it(sv):
    s = notify(sv)
    h = s["nudges"][-1]
    assert h == {"key": "home_timer", "label": "When the Home timer ends", "after": None, "on": True, "hours": None,
                 "note": "At the moment it ends, at any hour; each timer once."}
    j = sv.post("/settings/nudges", home_timer=False)
    assert j["outcome"] == "changed" and j["settings_notify"]["nudges"][-1]["on"] is False
    v = owner_sql("SELECT value FROM ui_settings WHERE key = 'nudges'")[0]["value"]
    assert v == {**nudges.DEFAULTS, "home_timer": False}
    assert sv.post("/settings/nudges", weight=False)["settings_notify"]["nudges"][-1]["on"] is False  # left out: stays as it is
    assert sv.raw("/settings/nudges", home_timer="1").status_code == 400


def test_app_settings_show_and_save_the_switch(web):
    page = web[0].get("/web/settings?tab=notify").text
    assert 'name="home_timer" value="1" checked> When the Home timer ends' in page and "at the moment it ends, at any hour" in page
    act(web, "/web/settings/nudges", on="1", weight="1", back="/web/settings?tab=notify")
    assert owner_sql("SELECT value FROM ui_settings WHERE key = 'nudges'")[0]["value"]["home_timer"] is False
    act(web, "/web/settings/nudges", on="1", home_timer="1", back="/web/settings?tab=notify")
    assert owner_sql("SELECT value FROM ui_settings WHERE key = 'nudges'")[0]["value"]["home_timer"] is True

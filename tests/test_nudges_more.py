"""Two more phone nudges (web item 49, 22.11.2026). A: a question the logger asked that has waited a day (switch question, hours
question_after counted from when it was asked, the questions Today shows; only a count goes into the message). B: a reminder time for one
habit (log_types.remind_after, migration 037: hours after waking, one kind per habit, independent of the general habits switch).
All data invented."""
from datetime import timedelta

import pytest

from app import habitspage, nudges, webquestions
from app.db import connect
from conftest import owner_sql
from test_api_door import door_on  # noqa: F401 - autouse: the door is open
from test_api_habits import cal, get, listed, put  # noqa: F401
from test_api_push import notify, sv  # noqa: F401
from test_nudges import DAY, APPLE, at, push_clean  # noqa: F401 - autouse: a test VAPID key, no subscriptions
from test_web import act, web  # noqa: F401
from test_webhabits import habit_types_as_they_were  # noqa: F401 - autouse: the habit types and settings as they were
from test_webhealth import event

ONLY = {"weight": False, "habits": False, "idle": False, "checkin": False, "week": False}  # the switches of the other nudges off


@pytest.fixture(autouse=True)
def only_these(push_clean, habit_types_as_they_were):  # noqa: F811 - after their wipes
    owner_sql("DELETE FROM pending")
    owner_sql("UPDATE log_types SET remind_after = NULL")
    nudges.save({**nudges.DEFAULTS, **ONLY})
    yield
    owner_sql("DELETE FROM pending")
    owner_sql("UPDATE log_types SET remind_after = NULL")


def due(now):
    with connect() as c, c.cursor() as cur:
        return nudges.due(cur, now)


def kinds(now):
    return [n["kind"] for n in due(now)]


def by_kind(now):
    return {n["kind"]: n for n in due(now)}


# ---- A: a question that has waited a day -----------------------------------------------------------------------------------------

def ask(pid, asked_hours_ago, now=None, tool="log_confirm", expires="1 day", resolved=False, reason="Save this?"):
    """An invented open question asked this many hours before `now` (the nudge's clock), open for `expires` more from the real now."""
    now = now or at("12:00")
    owner_sql("""INSERT INTO pending (id, tool, payload, reason, created_at, expires_at, resolved_at, resolution)
                 VALUES (%s, %s, %s, %s, %s, now() + %s::interval, %s, %s)""",
              pid, tool, '{"text": "Zz secret supper words 4711"}', reason, now - timedelta(hours=asked_hours_ago), expires,
              None if not resolved else now, "cancelled" if resolved else None)


def up(wake="07:00"):
    event("wake", DAY, wake)


def test_the_defaults_are_on_and_a_day():
    assert nudges.DEFAULTS["question"] is True and nudges.DEFAULTS["question_after"] == 24.0


def test_a_question_is_not_due_before_its_hours_and_is_after():
    up()
    ask("pzq1", 23.5)
    assert kinds(at("12:00")) == []
    assert kinds(at("12:30")) == ["question"]  # 24 hours since it was asked
    n = by_kind(at("12:30"))["question"]
    assert (n["title"], n["body"]) == ("A question is waiting", "1 question waits for your answer on Today.")
    assert "url" not in n  # Today: the default link


def test_the_hours_follow_the_setting_and_count_from_asking_not_from_waking():
    up("11:50")
    ask("pzq1", 5)
    nudges.save({**nudges.DEFAULTS, **ONLY, "question_after": 6.0})
    assert kinds(at("12:30")) == []  # 5.5 hours since asked
    assert kinds(at("13:00")) == ["question"]  # 6 hours since it was asked, 1 hour after waking: not counted from waking
    nudges.save({**nudges.DEFAULTS, **ONLY, "question_after": 48.0})
    assert kinds(at("13:00")) == []


def test_only_the_old_enough_questions_are_counted():
    up()
    ask("pzq1", 30)
    ask("pzq2", 25)
    ask("pzq3", 2)
    n = by_kind(at("12:00"))["question"]
    assert n["body"] == "2 questions wait for your answer on Today."
    ask("pzq4", 24)
    assert by_kind(at("12:00"))["question"]["body"].startswith("3 questions wait")


def test_the_message_has_no_word_of_the_question():
    up()
    ask("pzq1", 40, reason="Zz secret reason 8812")
    n = by_kind(at("12:00"))["question"]
    words = n["title"] + " " + n["body"]
    for secret in ("secret", "supper", "4711", "8812", "reason"):
        assert secret not in words
    assert words == "A question is waiting 1 question waits for your answer on Today."


def test_the_same_questions_as_todays_card():
    up()
    ask("pzq1", 30)
    ask("pzq2", 30, tool="not_a_question_tool")  # a tool Today does not ask: not shown, not counted
    ask("pzq3", 30, expires="-1 hour")  # expired
    ask("pzq4", 30, resolved=True)  # answered
    shown = {q["id"] for q in webquestions.load()}
    assert shown == {"pzq1"}
    assert by_kind(at("12:00"))["question"]["body"] == "1 question waits for your answer on Today."


def test_an_answered_or_expired_question_does_not_count():
    up()
    ask("pzq1", 30, resolved=True)
    ask("pzq2", 30, expires="-1 minute")
    assert kinds(at("12:00")) == []


def test_once_a_logging_day():
    up()
    ask("pzq1", 30)
    assert kinds(at("12:00")) == ["question"]
    owner_sql("INSERT INTO push_sent (day, kind) VALUES (%s, 'question')", DAY)
    assert kinds(at("12:05")) == []
    owner_sql("DELETE FROM push_sent WHERE kind = 'question'")
    assert kinds(at("12:05")) == ["question"]


def test_the_switch_off_and_the_master_off():
    up()
    ask("pzq1", 30)
    nudges.save({**nudges.DEFAULTS, **ONLY, "question": False})
    assert kinds(at("12:00")) == []
    nudges.save({**nudges.DEFAULTS, **ONLY, "on": False})
    assert kinds(at("12:00")) == []


def test_quiet_hours_as_every_nudge():
    ask("pzq1", 30, now=at("09:30"))
    assert kinds(at("09:30")) == []  # not up yet
    up()
    assert kinds(at("09:30")) == ["question"]
    event("bed", DAY, "10:00")
    assert kinds(at("10:30")) == []  # gone to bed
    owner_sql("DELETE FROM events WHERE day = %s AND type_id = (SELECT id FROM log_types WHERE name = 'bed')", DAY)
    assert kinds(at("23:30")) == []  # more than 16 hours after waking (07:00)
    assert kinds(at("22:30")) == ["question"]


# ---- B: a reminder time for one habit --------------------------------------------------------------------------------------------

def habit(name="zz_stretch", label="Zz stretch", remind=3.0, target=1, track=True, active=True, group="practice", order=801):
    put(name, label, group, target, track=track, active=active, order=order)
    owner_sql("UPDATE log_types SET remind_after = %s WHERE name = %s", remind, name)


def test_a_habit_is_reminded_from_its_hours_after_waking_and_not_before():
    up()
    habit(remind=3.0)
    assert kinds(at("09:55")) == []
    n = by_kind(at("10:00"))["habit-zz_stretch"]
    assert (n["title"], n["body"]) == ("Zz stretch", "Still open today.")
    assert "url" not in n and n["day"] == DAY  # Today
    assert kinds(at("10:00")) == ["habit-zz_stretch"]


def test_half_hours():
    up()
    habit(remind=0.5)
    assert kinds(at("07:25")) == [] and kinds(at("07:30")) == ["habit-zz_stretch"]


def test_not_when_it_is_done_today():
    up()
    habit()
    event("zz_stretch", DAY, "08:00")
    assert kinds(at("11:00")) == []


def test_a_habit_of_two_a_day_says_how_many_are_done():
    up()
    habit(name="zz_twice", label="Zz twice", target=2, remind=2.0)
    assert by_kind(at("10:00"))["habit-zz_twice"]["body"] == "0 of 2 done today."
    event("zz_twice", DAY, "08:00")
    assert by_kind(at("10:00"))["habit-zz_twice"]["body"] == "1 of 2 done today."
    event("zz_twice", DAY, "09:00")
    assert kinds(at("10:00")) == []


def test_not_for_a_habit_to_avoid():
    up()
    habit(name="zz_soda", label="Zz soda", group="behaviour", remind=1.0)  # the group behaviour is "avoid" until the owner sets one
    assert kinds(at("12:00")) == []
    habit(name="zz_walk", label="Zz walk", remind=1.0, order=802)
    assert kinds(at("12:00")) == ["habit-zz_walk"]


def test_not_for_an_inactive_habit_or_one_not_on_the_checklist():
    up()
    habit(name="zz_old", label="Zz old", active=False)
    habit(name="zz_off", label="Zz off", track=False, order=802)
    assert kinds(at("12:00")) == []


def test_not_without_a_reminder_time():
    up()
    habit(name="zz_none", label="Zz none", remind=None)
    assert kinds(at("12:00")) == []


def test_once_a_day_per_habit():
    up()
    habit(name="zz_a", label="Zz a", remind=2.0)
    habit(name="zz_b", label="Zz b", remind=2.0, order=802)
    assert kinds(at("10:00")) == ["habit-zz_a", "habit-zz_b"]
    owner_sql("INSERT INTO push_sent (day, kind) VALUES (%s, 'habit-zz_a')", DAY)
    assert kinds(at("10:05")) == ["habit-zz_b"]  # a sent one is not due again, the other still is
    owner_sql("INSERT INTO push_sent (day, kind) VALUES (%s, 'habit-zz_b')", DAY)
    assert kinds(at("10:10")) == []


def test_two_habits_at_different_hours():
    up()
    habit(name="zz_a", label="Zz a", remind=2.0)
    habit(name="zz_b", label="Zz b", remind=5.5, order=802)
    assert kinds(at("08:30")) == []
    assert kinds(at("09:00")) == ["habit-zz_a"]
    assert kinds(at("12:30")) == ["habit-zz_a", "habit-zz_b"]
    event("zz_a", DAY, "12:40")
    assert kinds(at("12:45")) == ["habit-zz_b"]


def test_the_master_switch_and_the_quiet_hours_apply():
    habit(remind=1.0)
    assert kinds(at("12:00")) == []  # not up yet
    up()
    nudges.save({**nudges.DEFAULTS, **ONLY, "on": False})
    assert kinds(at("12:00")) == []
    nudges.save({**nudges.DEFAULTS, **ONLY})
    event("bed", DAY, "11:00")
    assert kinds(at("12:00")) == []  # gone to bed
    owner_sql("DELETE FROM events WHERE day = %s AND type_id = (SELECT id FROM log_types WHERE name = 'bed')", DAY)
    assert kinds(at("23:30")) == []  # more than 16 hours after waking
    habit(name="zz_late", label="Zz late", remind=15.5, order=802)
    assert kinds(at("22:30")) == ["habit-zz_stretch", "habit-zz_late"]


def test_the_general_habits_switch_does_not_stop_it_and_does_not_start_it():
    up()
    habit(remind=2.0)
    nudges.save({**nudges.DEFAULTS, **ONLY, "habits": False})
    assert kinds(at("22:00")) == ["habit-zz_stretch"]
    nudges.save({**nudges.DEFAULTS, **ONLY, "habits": True, "habits_after": 14.0})
    assert kinds(at("22:00")) == ["habits", "habit-zz_stretch"]  # the general nudge as before, both in the same round
    assert "Zz stretch" in by_kind(at("22:00"))["habits"]["body"]


def test_run_sends_it_with_the_habit_as_its_tag(monkeypatch):
    from app import webpush
    from test_api_push import sub
    up()
    habit(remind=2.0)
    sub(APPLE + "-habit")
    out = []
    monkeypatch.setattr(webpush, "send", lambda s, msg, **k: out.append(msg) or 201)
    assert nudges.run(at("10:00"))["sent"] == 1
    assert [(m["title"], m["body"], m["tag"], m["url"]) for m in out] == [("Zz stretch", "Still open today.", "habit-zz_stretch", "/web/")]
    assert nudges.run(at("10:05"))["due"] == 0
    assert nudges.link_for("/web/", "logger") == "/"  # Today, at both addresses


# ---- the door's read and save of remind_after ------------------------------------------------------------------------------------

def manage(sv, **body):
    return sv.post("/habits/manage", **body)


def remind(name):
    r = owner_sql("SELECT remind_after FROM log_types WHERE name = %s", name)[0]["remind_after"]
    return None if r is None else float(r)


def test_the_door_reads_remind_after_and_its_range(sv):  # noqa: F811
    habit(remind=2.5)
    put("zz_plain", "Zz plain", order=802)
    j = get(sv, "/habits?show=all")["habits"]
    rows = listed(j)
    assert rows["zz_stretch"]["remind_after"] == 2.5 and rows["zz_plain"]["remind_after"] is None
    assert (j["limits"]["remind_min"], j["limits"]["remind_max"], j["limits"]["remind_step"]) == (0.5, 15.5, 0.5)
    habit(name="zz_whole", label="Zz whole", remind=4.0, order=803)
    assert isinstance(listed(get(sv, "/habits?show=all")["habits"])["zz_whole"]["remind_after"], int)  # a plain number: 4, not 4.0


def test_the_door_saves_sets_and_clears_remind_after(sv):  # noqa: F811
    put("zz_walk", "Zz walk")
    j = manage(sv, action="edit", name="zz_walk", label="Zz walk", target=1, remind_after=7.5, show="all")
    assert j["outcome"] == "changed" and remind("zz_walk") == 7.5
    assert listed(j["habits"])["zz_walk"]["remind_after"] == 7.5
    for ok in (0.5, 15.5, 1, 12):
        manage(sv, action="edit", name="zz_walk", label="Zz walk", target=1, remind_after=ok)
        assert remind("zz_walk") == ok
    j = manage(sv, action="edit", name="zz_walk", label="Zz walk", target=1, remind_after=None, show="all")
    assert j["outcome"] == "changed" and remind("zz_walk") is None and listed(j["habits"])["zz_walk"]["remind_after"] is None


def test_a_save_that_does_not_send_it_leaves_it_as_it_is(sv):  # noqa: F811
    habit(name="zz_walk", label="Zz walk", remind=6.0)
    j = manage(sv, action="edit", name="zz_walk", label="Zz long walk", target=2, order=44, aim="do")
    assert j["outcome"] == "changed" and remind("zz_walk") == 6.0
    for other in ("retire", "restore"):
        manage(sv, action=other, name="zz_walk")
    manage(sv, action="track", name="zz_walk", on=False)
    assert remind("zz_walk") == 6.0


def test_remind_after_out_of_its_range_is_refused_and_nothing_changes(sv):  # noqa: F811
    habit(name="zz_walk", label="Zz walk", remind=6.0)
    for bad in (0, 0.4, 16, 15.6, -1, 2.3, "soon", True, [1], 1e9):
        r = sv.raw("/habits/manage", action="edit", name="zz_walk", label="Zz changed", target=3, remind_after=bad)
        assert r.status_code == 400 and r.json()["error"] == "bad_request", (bad, r.text)
        assert "remind_after must be a number from 0.5 to 15.5 in steps of 0.5, or null." in r.json()["message"], bad
    assert remind("zz_walk") == 6.0 and owner_sql("SELECT label FROM log_types WHERE name = 'zz_walk'")[0]["label"] == "Zz walk"


def test_app_form_does_not_send_it_and_does_not_clear_it(web):  # noqa: F811
    habit(name="zz_walk", label="Zz walk", remind=6.0)
    act(web, "/web/habits/edit", name="zz_walk", label="Zz walk 2", daily_target="1", sort_order="810", back="/web/habits")
    assert owner_sql("SELECT label FROM log_types WHERE name = 'zz_walk'")[0]["label"] == "Zz walk 2" and remind("zz_walk") == 6.0
    assert "remind_after" not in web[0].get("/web/habits").text  # not on app.'s old page


# ---- the settings row of the question nudge --------------------------------------------------------------------------------------

def test_the_door_lists_the_question_row_and_saves_it(sv):  # noqa: F811
    s = notify(sv)
    q = next(x for x in s["nudges"] if x["key"] == "question")
    assert (q["label"], q["after"], q["on"], q["note"]) == ("A question still waiting for an answer after", "hours", True, None)
    assert q["hours"] == {"key": "question_after", "value": 24, "min": 1, "max": 48, "step": 0.5, "default": 24}
    assert [x["key"] for x in s["nudges"]][-3:] == ["week", "question", "home_timer"]
    sv.post("/settings/nudges", question=False, question_after=30.2)
    v = owner_sql("SELECT value FROM ui_settings WHERE key = 'nudges'")[0]["value"]
    assert v["question"] is False and v["question_after"] == 30.0
    for given, kept in ((99, 48), (0.1, 1), (36, 36)):
        sv.post("/settings/nudges", question_after=given)
        assert owner_sql("SELECT value FROM ui_settings WHERE key = 'nudges'")[0]["value"]["question_after"] == kept, given


def test_the_full_apps_form_shows_and_saves_the_question_row(web):  # noqa: F811
    page = web[0].get("/web/settings?tab=notify").text
    assert "A question still waiting for an answer after" in page and 'name="question_after"' in page and 'min="1" max="48"' in page
    act(web, "/web/settings/nudges", on="1", question="1", question_after="18,5", back="/web/settings?tab=notify")
    v = owner_sql("SELECT value FROM ui_settings WHERE key = 'nudges'")[0]["value"]
    assert v["question"] is True and v["question_after"] == 18.5
    act(web, "/web/settings/nudges", on="1", back="/web/settings?tab=notify")
    assert owner_sql("SELECT value FROM ui_settings WHERE key = 'nudges'")[0]["value"]["question"] is False  # a box left out is off


# ---- the migration ---------------------------------------------------------------------------------------------------------------

def test_the_migration_is_applied_with_its_column_grant_and_range():
    assert owner_sql("SELECT 1 AS x FROM schema_migrations WHERE name = '037_habit_remind.sql'")
    col = owner_sql("""SELECT data_type, is_nullable FROM information_schema.columns
                       WHERE table_name = 'log_types' AND column_name = 'remind_after'""")[0]
    assert (col["data_type"], col["is_nullable"]) == ("numeric", "YES")
    assert all(r["remind_after"] is None for r in owner_sql("SELECT remind_after FROM log_types WHERE name IN ('weight', 'wake', 'meds')"))
    with connect() as c:  # core_rw (the logger's login) may change it, and only within the range
        c.execute("UPDATE log_types SET remind_after = 2.5 WHERE name = 'meds'")
        c.execute("UPDATE log_types SET remind_after = NULL WHERE name = 'meds'")
        with pytest.raises(Exception, match="check"):
            c.execute("UPDATE log_types SET remind_after = 16 WHERE name = 'meds'")
        c.rollback()
    assert owner_sql("""SELECT has_column_privilege('core_rw', 'log_types', 'remind_after', 'UPDATE') AS u,
                               has_column_privilege('core_rw', 'log_types', 'label', 'UPDATE') AS l,
                               has_column_privilege('core_rw', 'log_types', 'kind', 'UPDATE') AS k""")[0] == {"u": True, "l": True, "k": False}

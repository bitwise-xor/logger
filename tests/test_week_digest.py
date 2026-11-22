"""Last week's summary as a phone notification (web item 45, core item 17; 22.11.2026): once a week, on the first logging day of the
week the owner is up, week_after hours after waking (quiet hours as every nudge), the Week page's numbers for last week as shares and
changes only (a locked screen shows it), opening the Week page for last week at both addresses. All data invented."""
import re
from datetime import date, datetime, timedelta

import pytest

from app import nudges, weekdigest, webpush
from app.db import connect
from app.when import BERLIN
from conftest import owner_sql
from test_api_door import door_on  # noqa: F401 - autouse: the door is open
from test_api_push import GOOGLE, notify, shaped, sub, sv  # noqa: F401
from test_nudges import APPLE, push_clean  # noqa: F401 - autouse: a test VAPID key, no subscriptions
from test_web import act, web  # noqa: F401
from test_webhabits import habit_types_as_they_were  # noqa: F401 - autouse: the habit types and settings as they were
from test_webhealth import event, measure
from test_webtoday import raw

MONDAY = date(2027, 6, 14)  # a Monday later than every real message; last week is 07.06. to 13.06.2027
LAST = [MONDAY - timedelta(days=7 - i) for i in range(7)]  # Monday 07.06. .. Sunday 13.06.
KIND = "week-20270607"


def at(d: date, hm: str) -> datetime:
    return datetime.combine(d, datetime.strptime(hm, "%H:%M").time(), BERLIN)


@pytest.fixture(autouse=True)
def only_the_week(push_clean, habit_types_as_they_were):  # noqa: F811 - after their wipes
    nudges.save({**nudges.DEFAULTS, "weight": False, "habits": False, "idle": False, "checkin": False})


def target(kcal=2000, protein=150):
    owner_sql("INSERT INTO food_targets (valid_from, kcal, protein, fat, carbs) VALUES ('2020-01-01', %s, %s, 70, 220)", kcal, protein)


def food(d: date, kcal: float, protein: float):
    """One invented food entry on day d (the whole day's calories and protein)."""
    fid = owner_sql("""INSERT INTO foods (name, basis, kcal, protein, fat, carbs, source) VALUES (%s, 'g', 100, 5, 3, 10, 'label')
                       RETURNING id""", f"Zz digest dish {d}")[0]["id"]
    owner_sql("""INSERT INTO food_entries (raw_id, food_id, amount, eaten_at, time_known, day, day_rule, extractor_version, kcal, protein,
                 fat, carbs, source) VALUES (%s, %s, 100, %s, true, %s, 'wake', 'test', %s, %s, 20, 100, 'label')""",
              raw(), fid, at(d, "12:00"), d, kcal, protein)


def week_of_food(days=6, kcal=1880, protein=132):
    for d in LAST[:days]:
        food(d, kcal, protein)


def message(today=MONDAY):
    with connect() as c, c.cursor() as cur:
        return weekdigest.message(cur, today)


def due(now):
    with connect() as c, c.cursor() as cur:
        return nudges.due(cur, now)


def kinds(now):
    return [n["kind"] for n in due(now)]


def mark(n_day, kind=KIND):
    owner_sql("INSERT INTO push_sent (day, kind) VALUES (%s, %s)", n_day, kind)


# ---- when ------------------------------------------------------------------------------------------------------------------------

def test_the_switch_is_on_by_default_one_hour_after_waking():
    assert nudges.DEFAULTS["week"] is True and nudges.DEFAULTS["week_after"] == 1.0
    assert weekdigest.kind(MONDAY) == weekdigest.kind(MONDAY + timedelta(days=6)) == KIND  # named after the week summarised


def test_sent_on_monday_after_the_hour_and_not_before_or_before_waking():
    week_of_food()
    assert kinds(at(MONDAY, "07:30")) == []  # not up yet
    event("wake", MONDAY, "07:00")
    assert kinds(at(MONDAY, "07:55")) == []
    assert kinds(at(MONDAY, "08:00")) == [KIND]


def test_the_hours_follow_the_setting():
    week_of_food()
    event("wake", MONDAY, "07:00")
    nudges.save({**nudges.DEFAULTS, "weight": False, "habits": False, "idle": False, "checkin": False, "week_after": 3.5})
    assert kinds(at(MONDAY, "10:00")) == [] and kinds(at(MONDAY, "10:30")) == [KIND]


def test_not_sent_twice_the_same_day_or_later_in_the_week():
    week_of_food()
    event("wake", MONDAY, "07:00")
    mark(MONDAY)
    assert kinds(at(MONDAY, "09:00")) == []
    for later in range(1, 7):
        d = MONDAY + timedelta(days=later)
        event("wake", d, "07:00")
        assert kinds(at(d, "12:00")) == [], d


def test_sent_on_tuesday_when_monday_had_no_wake_up_and_next_monday_again():
    week_of_food()
    tue = MONDAY + timedelta(days=1)
    event("wake", tue, "08:00")
    assert kinds(at(tue, "09:15")) == [KIND]
    mark(tue)
    nxt = MONDAY + timedelta(days=7)
    event("wake", nxt, "07:00")
    food(MONDAY, 1900, 140)  # this week's food: next week's summary
    assert kinds(at(nxt, "08:30")) == ["week-20270614"]


def test_quiet_hours_as_every_nudge():
    week_of_food()
    event("wake", MONDAY, "07:00")
    event("bed", MONDAY, "07:30")
    assert kinds(at(MONDAY, "08:30")) == []  # gone to bed
    tue = MONDAY + timedelta(days=1)
    event("wake", tue, "06:00")
    assert kinds(at(tue + timedelta(days=1), "00:30")) == []  # 18.5 hours after waking


def test_the_switch_off_and_the_master_switch_off():
    week_of_food()
    event("wake", MONDAY, "07:00")
    nudges.save({**nudges.DEFAULTS, "weight": False, "habits": False, "idle": False, "checkin": False, "week": False})
    assert kinds(at(MONDAY, "09:00")) == []
    nudges.save({**nudges.DEFAULTS, "on": False})
    assert kinds(at(MONDAY, "09:00")) == []


def test_the_week_is_not_read_once_it_is_done(monkeypatch):
    event("wake", MONDAY, "07:00")
    mark(MONDAY)
    monkeypatch.setattr(weekdigest, "message", lambda cur, today: pytest.fail("the week was read again"))
    assert kinds(at(MONDAY, "09:00")) == []


# ---- the words -------------------------------------------------------------------------------------------------------------------

def test_the_title_and_the_link():
    week_of_food()
    m = message()
    assert m["title"] == "Last week · 07.06. to 13.06." and m["url"] == "/web/week?p=last"
    assert message(MONDAY + timedelta(days=3))["title"] == m["title"]  # any day of the week: last week


def test_the_body_with_a_target_a_weight_at_both_ends_and_habits():
    target()
    week_of_food()  # 1880 of 2000 kcal (94 %), 132 of 150 g protein (88 %), six days of seven
    measure("weight", LAST[0], "07:10", 83.6)
    measure("weight", LAST[3], "07:10", 83.9)
    measure("weight", LAST[6], "07:05", 83.2)
    owner_sql("UPDATE log_types SET on_checklist = false WHERE kind = 'event'")
    owner_sql("""INSERT INTO log_types (name, label, kind, category, aliases, on_checklist, daily_target, active, sort_order)
                 VALUES ('zz_stretch', 'Stretch', 'event', 'practice', '{stretch}', true, 1, true, 1)""")
    for d in LAST[:5]:
        event("zz_stretch", d, "08:00")  # 5 of 7 habit-days: 71 %
    m = message()
    assert m["body"] == "6 of 7 days logged · kcal 94 %, protein 88 % of target · weight −0.4 kg · habits 71 %"
    assert len(m["body"]) <= 150


def test_the_body_without_a_target_or_weights_has_the_days_only():
    owner_sql("UPDATE log_types SET on_checklist = false WHERE kind = 'event'")
    week_of_food(days=3)
    measure("weight", LAST[2], "07:00", 80.1)  # one weight: no change
    assert message()["body"] == "3 of 7 days logged"


def test_a_weight_gain_and_a_calorie_target_only():
    owner_sql("UPDATE log_types SET on_checklist = false WHERE kind = 'event'")
    owner_sql("INSERT INTO food_targets (valid_from, kcal) VALUES ('2020-01-01', 2500)")
    week_of_food(days=7, kcal=2600)
    measure("weight", LAST[1], "07:00", 70.0)
    measure("weight", LAST[5], "07:00", 70.3)
    assert message()["body"] == "7 of 7 days logged · kcal 104 % of target · weight +0.3 kg"


def test_no_absolute_health_value_in_title_or_body():
    target()
    week_of_food()
    for i, d in enumerate(LAST):
        measure("weight", d, "07:00", 91.7 - i / 10)
        measure("blood_sugar", d, "07:05", 113)
        measure("bp", d, "07:10", 138, 87, "morning")
    m = message()
    words = m["title"] + " " + m["body"]
    for value in ("91", "90", "113", "138", "87", "1880", "132", "2000", "150"):
        assert not re.search(rf"(?<![\d.]){value}(?![\d])", words), (value, words)
    assert "weight −0.6 kg" in m["body"]


def test_an_empty_last_week_sends_nothing_and_is_not_tried_again(monkeypatch):
    assert message() is None
    event("wake", MONDAY, "07:00")
    sub(APPLE + "-digest")
    out = []
    monkeypatch.setattr(webpush, "send", lambda s, msg, **k: out.append(msg) or 201)
    assert [(n["kind"], n.get("quiet")) for n in due(at(MONDAY, "08:30"))] == [(KIND, True)]
    assert nudges.run(at(MONDAY, "08:30"))["sent"] == 0 and out == []
    assert owner_sql("SELECT day FROM push_sent WHERE kind = %s", KIND) == [{"day": MONDAY}]
    week_of_food()  # logged late for last week: the week is done all the same
    event("wake", MONDAY + timedelta(days=1), "07:00")
    assert kinds(at(MONDAY + timedelta(days=1), "09:00")) == []


# ---- sent, and the link per address ----------------------------------------------------------------------------------------------

def test_run_sends_it_once_with_the_week_link_at_each_address(monkeypatch):
    target()
    week_of_food()
    event("wake", MONDAY, "07:00")
    sub(APPLE + "-app")
    sub(GOOGLE + "here", origin="logger")
    out = []
    monkeypatch.setattr(webpush, "send", lambda s, msg, **k: out.append((s["origin"], msg)) or 201)
    assert nudges.run(at(MONDAY, "08:05")) == {"due": 1, "sent": 1, "devices": 2}
    assert [(o, m["url"], m["tag"], m["title"]) for o, m in out] == [
        ("app", "/web/week?p=last", KIND, "Last week · 07.06. to 13.06."), ("logger", "/trends?p=last", KIND, "Last week · 07.06. to 13.06.")]
    assert out[0][1]["body"] == "6 of 7 days logged · kcal 94 %, protein 88 % of target · habits 0 %"  # the Week row: none done
    assert nudges.run(at(MONDAY, "08:10"))["due"] == 0
    assert nudges.link_for("/web/week?p=last", "app") == "/web/week?p=last"
    assert nudges.link_for("/web/week?p=last", "logger") == "/trends?p=last"
    assert nudges.link_for("/web/week?p=7", "logger").endswith("/web/week?p=7")  # any other Week link: the full app, as before


# ---- the settings ----------------------------------------------------------------------------------------------------------------

def test_the_door_lists_the_week_row_with_its_hours(sv):  # noqa: F811
    s = notify(sv)
    w = next(x for x in s["nudges"] if x["key"] == "week")
    assert (w["label"], w["after"], w["on"], w["note"]) == ("Last week's summary, on the first day of the week,", "hours after waking", True, None)
    assert w["hours"] == {"key": "week_after", "value": 1, "min": 0.5, "max": 12, "step": 0.5, "default": 1}
    assert [x["key"] for x in s["nudges"]][-3:] == ["week", "question", "home_timer"]


def test_the_door_saves_the_switch_and_clamps_the_hours_to_their_range(sv):  # noqa: F811
    j = shaped(sv.post("/settings/nudges", week=False, week_after=4.2))
    v = owner_sql("SELECT value FROM ui_settings WHERE key = 'nudges'")[0]["value"]
    assert v["week"] is False and v["week_after"] == 4.0
    assert next(x for x in j["settings_notify"]["nudges"] if x["key"] == "week")["on"] is False
    for given, kept in ((99, 12), (0.1, 0.5), (-3, 1)):  # below 0: not a number to the form, the default (as every hours field)
        sv.post("/settings/nudges", week_after=given)
        assert owner_sql("SELECT value FROM ui_settings WHERE key = 'nudges'")[0]["value"]["week_after"] == kept, given
    assert sv.raw("/settings/nudges", week_after="3").status_code == 400  # a number, not words
    assert sv.raw("/settings/nudges", week="yes").status_code == 400


def test_the_full_apps_form_shows_and_saves_the_week_row(web):  # noqa: F811
    page = web[0].get("/web/settings?tab=notify").text
    assert "Last week&#x27;s summary" in page or "Last week's summary, on the first day of the week," in page
    assert 'name="week_after"' in page and 'min="0.5" max="12"' in page and "once a week" in page
    act(web, "/web/settings/nudges", on="1", week_after="2,5", back="/web/settings?tab=notify")
    v = owner_sql("SELECT value FROM ui_settings WHERE key = 'nudges'")[0]["value"]
    assert v["week"] is False and v["week_after"] == 2.5  # a box left out is off, as every switch of the form
    act(web, "/web/settings/nudges", on="1", week="1", week_after="40", back="/web/settings?tab=notify")
    v = owner_sql("SELECT value FROM ui_settings WHERE key = 'nudges'")[0]["value"]
    assert v["week"] is True and v["week_after"] == 12

"""The JSON door's notifications (deploy 110, 17.11.2026): GET /api/v1/settings/notify, POST /settings/nudges, /push/subscribe, /push/off,
/push/test; and a push subscription that remembers its address (migration 032), so nudges.deliver gives each device the link of its own
front end (nudges.link_for: app.'s unchanged; logger.'s own pages, or the full app's absolute address for the gratitude list and any
other app. page). The push services are never called: webpush.send is a stub. Every endpoint, key and name is invented."""
import json

import pytest

from app import held, nudges, webpush
from conftest import owner_sql
from test_api_door import door, door_on, signed_in  # noqa: F401 - door_on is autouse
from test_api_saves import KEYS, Door, n
from test_nudges import APPLE, DAY, at, browser, push_clean  # noqa: F401 - push_clean is autouse: a test VAPID key, no subscriptions
from test_web import ORIGIN, act, web  # noqa: F401 - web: a signed-in app. session (fixture)
from test_webhealth import event

IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1"
PC = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/130.0 Safari/537.36"
GOOGLE = "https://fcm.googleapis.com/fcm/send/zz-invented-"


@pytest.fixture
def sv():
    return Door()


@pytest.fixture
def sent(monkeypatch):
    """webpush.send as a stub: every message it would post (endpoint, message); each push service takes it (201)."""
    out = []
    monkeypatch.setattr(webpush, "send", lambda sub, msg: out.append((sub["endpoint"], msg)) or 201)
    return out


def get(sv, path):
    r = sv.c.get("/api/v1" + path, headers=sv.h)
    assert r.status_code == 200, r.text
    return r.json()


def notify(sv):
    return get(sv, "/settings/notify")["settings_notify"]


def shaped(j):
    assert set(j) == KEYS | {"settings_notify"}, sorted(j)
    assert j["undo"] is None
    return j


def sub(endpoint, ua=IPHONE, origin="app", sid=None):
    _, p256dh, auth = browser()
    return owner_sql("""INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent, session_sid, origin) VALUES (%s, %s, %s, %s, %s, %s)
                        RETURNING id""", endpoint, p256dh, auth, ua, sid, origin)[0]["id"]


def subscribe(sv, endpoint=GOOGLE + "a", ua=IPHONE, **over):
    _, p256dh, auth = browser()
    return sv.raw("/push/subscribe", **{"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}, "user_agent": ua, **over})


# ---- the read ----------------------------------------------------------------------------------------------------------------------

def test_the_notifications_read(sv):
    s = notify(sv)
    assert s["on"] is True and s["on_label"] == "Send nudges" and s["awake_hours"] == 16 and s["subscriptions"] == [] and s["twice"] is False
    assert s["public_key"] == webpush.public_key() and s["public_key"]
    assert [x["key"] for x in s["nudges"]] == ["weight", "habits", "idle", "checkin", "bp_evening", "gratitude", "week", "home_timer"]
    w = s["nudges"][0]
    assert (w["label"], w["after"], w["on"], w["note"]) == ("No weight yet,", "hours after waking", True, None)
    assert w["hours"] == {"key": "weight_after", "value": 2, "min": 0.5, "max": 12, "step": 0.5, "default": 2}
    g = s["nudges"][-3]
    assert g["on"] is False and g["note"] == "A tap on this one opens the gratitude list in the full app." and g["hours"]["max"] == 15.5
    assert s["nudges"][2]["label"] == "Nothing logged for" and s["nudges"][2]["after"] == "hours"


def test_without_a_key_the_read_says_so(sv, monkeypatch):
    monkeypatch.delenv("VAPID_PRIVATE_KEY")
    assert notify(sv)["public_key"] is None


def test_the_devices_their_addresses_this_and_twice(sv):
    mine = get(sv, "/session")["sid"]
    sub(APPLE + "-app", IPHONE, "app")
    assert notify(sv)["twice"] is False
    sub(GOOGLE + "pc", PC, "logger")
    assert notify(sv)["twice"] is False  # another device here
    assert subscribe(sv, APPLE + "-logger", IPHONE).status_code == 200
    s = notify(sv)
    assert s["twice"] is True
    assert [(x["name"], x["address"], x["this"]) for x in s["subscriptions"]] == [
        ("iPhone, Safari", "app", False), ("Windows, Chrome", "logger", False), ("iPhone, Safari", "logger", True)]
    assert set(s["subscriptions"][0]) == {"id", "name", "address", "on_since", "last_delivered", "this"}
    assert s["subscriptions"][0]["last_delivered"] is None and s["subscriptions"][2]["on_since"]
    assert str(owner_sql("SELECT session_sid FROM push_subscriptions WHERE endpoint = %s", APPLE + "-logger")[0]["session_sid"]) == mine


# ---- the nudges --------------------------------------------------------------------------------------------------------------------

def test_nudges_save_keeps_what_is_left_out(sv):
    nudges.save({**nudges.DEFAULTS, "gratitude": True, "gratitude_after": 9.5, "idle": False})
    j = shaped(sv.post("/settings/nudges", weight=False, weight_after=3.3, habits_after=99))
    assert j["outcome"] == "changed" and j["head"] == "Saved. Nudges are on."
    v = owner_sql("SELECT value FROM ui_settings WHERE key = 'nudges'")[0]["value"]
    assert v == {**nudges.DEFAULTS, "weight": False, "weight_after": 3.5, "habits_after": 20, "gratitude": True, "gratitude_after": 9.5, "idle": False}
    assert j["settings_notify"]["nudges"][0]["hours"]["value"] == 3.5 and j["settings_notify"]["nudges"][0]["on"] is False
    assert shaped(sv.post("/settings/nudges", on=False))["head"] == "Saved. Nudges are off."
    assert owner_sql("SELECT value FROM ui_settings WHERE key = 'nudges'")[0]["value"]["gratitude_after"] == 9.5


def test_a_wrong_nudge_field_is_a_bad_request(sv):
    for body, why in (({"on": "1"}, "on must be true or false."), ({"idle_hours": "5"}, "idle_hours must be a number."),
                      ({"idle_hours": None, "weight": 1}, "weight must be true or false.")):
        r = sv.raw("/settings/nudges", **body)
        assert r.status_code == 400 and r.json()["message"] == why, body
    assert n("SELECT count(*) AS n FROM ui_settings WHERE key = 'nudges'") == 0


# ---- subscribe, off, test ----------------------------------------------------------------------------------------------------------

def test_subscribe_keeps_the_device_for_logger(sv):
    r = subscribe(sv, ua=PC)
    j = shaped(r.json())
    assert j["outcome"] == "changed" and j["head"] == "Notifications are on for this device."
    [row] = owner_sql("SELECT origin, user_agent, session_sid, failures FROM push_subscriptions")
    assert (row["origin"], row["user_agent"]) == ("logger", PC) and str(row["session_sid"]) == get(sv, "/session")["sid"]
    assert j["settings_notify"]["subscriptions"][0]["this"] is True
    assert n("SELECT count(*) AS n FROM audit_log WHERE tool = 'web_change' AND detail->>'what' = 'notifications on'") == 1
    owner_sql("UPDATE push_subscriptions SET failures = 3")
    assert subscribe(sv, ua=PC).status_code == 200  # again: still one, failures reset
    assert owner_sql("SELECT count(*) AS n, max(failures) AS f FROM push_subscriptions")[0] == {"n": 1, "f": 0}


@pytest.mark.parametrize("over", [{"endpoint": "https://push.example.test/zz"}, {"endpoint": "http://fcm.googleapis.com/zz"},
                                  {"keys": {"p256dh": "short", "auth": "short"}}, {"endpoint": ""}])
def test_subscribe_refuses_what_app_refuses(sv, over):
    j = shaped(subscribe(sv, **over).json())
    assert (j["outcome"], j["reason"]) == ("rejected", "Not a known push service.") and n("SELECT count(*) AS n FROM push_subscriptions") == 0


def test_a_wrong_subscribe_body_is_a_bad_request(sv):
    for body, why in (({"endpoint": GOOGLE}, "keys must be {p256dh, auth}."), ({"endpoint": GOOGLE, "keys": "x"}, "keys must be {p256dh, auth}."),
                      ({"endpoint": True, "keys": {}}, "endpoint must be text.")):
        r = sv.raw("/push/subscribe", **body)
        assert r.status_code == 400 and r.json()["message"] == why, body


def test_app_s_subscribe_still_keeps_app_s_address(web):
    c, csrf = web
    _, p256dh, auth = browser()
    assert c.post("/web/push/subscribe", json={"endpoint": APPLE, "keys": {"p256dh": p256dh, "auth": auth}},
                  headers={**ORIGIN, "X-CSRF": csrf}).json() == {"ok": True}
    assert owner_sql("SELECT origin FROM push_subscriptions")[0]["origin"] == "app"


def test_the_column_defaults_to_app_and_allows_only_the_two():
    sub(APPLE + "-old")
    assert owner_sql("SELECT origin FROM push_subscriptions")[0]["origin"] == "app"
    with pytest.raises(Exception):
        sub(APPLE + "-bad", origin="elsewhere")


def test_push_off(sv):
    pid = sub(APPLE + "-off")
    j = shaped(sv.post("/push/off", id=pid))
    assert j["head"] == "Notifications are off for that device." and j["settings_notify"]["subscriptions"] == []
    j = shaped(sv.post("/push/off", id=pid))
    assert (j["outcome"], j["reason"]) == ("rejected", "That device is not there any more.")
    r = sv.raw("/push/off", id="x")
    assert r.status_code == 400 and r.json()["message"] == "id must be a number."


def test_the_test_push_reaches_each_device_with_its_own_link(sv, sent):
    j = shaped(sv.post("/push/test"))
    assert (j["outcome"], j["reason"]) == ("rejected", "No device took the test notification. Turn notifications on again on the phone, then try once more.")
    sub(APPLE + "-app")
    assert subscribe(sv, GOOGLE + "here").status_code == 200
    j = shaped(sv.post("/push/test"))
    assert j["head"] == "Test notification sent to 2 devices."
    links = {e: m["url"] for e, m in sent}
    assert links == {APPLE + "-app": "/web/settings?tab=notify", GOOGLE + "here": "/settings/notifications"}
    assert all(m["title"] == "Logger" and m["tag"] == "test" for _e, m in sent)


def test_app_s_test_button_too(web, sent):
    sub(APPLE + "-app")
    sub(GOOGLE + "here", origin="logger")
    page = act(web, "/web/settings/nudge_test", back="/web/settings?tab=notify")
    assert "Test notification sent to 2 devices." in page.text
    assert sorted(m["url"] for _e, m in sent) == ["/settings/notifications", "/web/settings?tab=notify"]


# ---- the links per address -------------------------------------------------------------------------------------------------------

@pytest.mark.parametrize("url,app_link,logger_link", [
    ("/web/", "/web/", "/"),
    (None, "/web/", "/"),
    ("/web/settings?tab=notify", "/web/settings?tab=notify", "/settings/notifications"),
    ("/web/gratitude", "/web/gratitude", "https://app.example.test/web/gratitude"),
    ("/web/health", "/web/health", "https://app.example.test/web/health"),  # any other app. page: the full app (fail safe)
    ("/web/settings?tab=body", "/web/settings?tab=body", "https://app.example.test/web/settings?tab=body"),
    ("/web", "/web", "/"),
    ("/habits", "/habits", "/habits")])  # not an app. page: as it is
def test_link_for_each_address(url, app_link, logger_link):
    assert nudges.link_for(url, "app") == app_link and nudges.link_for(url, "logger") == logger_link


def test_a_nudge_goes_to_both_addresses_with_their_links(sent):
    sub(APPLE + "-app")
    sub(GOOGLE + "here", origin="logger")
    nudges.save({**nudges.DEFAULTS, "gratitude": True, "gratitude_after": 2.0})
    event("wake", DAY, "07:00")
    out = nudges.run(at("09:30"))  # weight (2 h) and gratitude (2 h) are due
    assert out["sent"] == 2 and out["devices"] == 2
    by = {}
    for e, m in sent:
        by.setdefault(m["tag"], {})[e] = m
    assert by["weight"][APPLE + "-app"]["url"] == "/web/" and by["weight"][GOOGLE + "here"]["url"] == "/"
    assert by["gratitude"][APPLE + "-app"]["url"] == "/web/gratitude"
    assert by["gratitude"][GOOGLE + "here"]["url"] == "https://app.example.test/web/gratitude"
    a, b = by["weight"][APPLE + "-app"], by["weight"][GOOGLE + "here"]
    assert {**a, "url": None} == {**b, "url": None}  # the same message otherwise
    assert a == {"title": "Weight", "body": "No weight logged yet today.", "url": "/web/", "tag": "weight"}  # app.'s payload as before
    assert n("SELECT count(*) AS n FROM audit_log WHERE tool = 'nudge'") == 2  # per nudge, not per device


def test_not_read_yet_goes_to_both_addresses(sent):
    sub(APPLE + "-app")
    sub(GOOGLE + "here", origin="logger")
    owner_sql("""INSERT INTO private.incoming (channel, content, tries, last_error, received_at)
                 VALUES ('test', 'zz invented words', 3, 'the reader was down', now() - interval '3 hours')""")
    assert held.run() == {"tried": 0, "saved": 0, "late": 1, "told": 2}  # past its two hours: no AI try, only the notice
    urls = {e: m["url"] for e, m in sent if m["tag"] == "held"}
    assert urls == {APPLE + "-app": "/web/", GOOGLE + "here": "/"}
    assert "zz invented words" not in json.dumps(sent)


def test_a_gone_logger_device_is_dropped_as_an_app_one(monkeypatch):
    sub(GOOGLE + "gone", origin="logger")
    monkeypatch.setattr(webpush, "send", lambda s, m: 410)
    assert nudges.deliver({"title": "x", "body": "y", "url": "/web/", "tag": "t"}) == 0
    assert n("SELECT count(*) AS n FROM push_subscriptions") == 0


# ---- app.'s tab ------------------------------------------------------------------------------------------------------------------

def test_app_s_tab_lists_every_device_alike(web):
    sub(APPLE + "-app", IPHONE)
    sub(GOOGLE + "here", PC, origin="logger")
    page = web[0].get("/web/settings?tab=notify").text
    assert "Devices with notifications · 2" in page and "iPhone, Safari" in page and "Windows, Chrome" in page
    assert page.count('action="/web/settings/push_off"') == 2  # each can be turned off at app. too

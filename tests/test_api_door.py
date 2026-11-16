"""The JSON door /api/v1 (api.py, 16.11.2026): the checks every call goes through (door on, from inside Docker, the service
token), the sign-in with its limits shared with /web/login, the bearer session (stored hashed, renewed, never the app.'s
cookie and the reverse), and the shape of every answer. All names, foods and numbers are invented."""
import hashlib
from datetime import datetime, timedelta, timezone

import pytest
from starlette.testclient import TestClient

from app import api, auth
from app import web as webapp
from app.mcp_app import build_app
from conftest import owner_sql
from test_auth import PW, code_now, set_owner
from test_web import ORIGIN, client, n, sign_in as web_sign_in, web  # noqa: F401 - web is a fixture

FRONT = "front-test-token-0123456789abcdef-0123456789"  # 44 characters
HOST = "logger-v2-core:8000"
ROUTES = (("POST", "/api/v1/session"), ("GET", "/api/v1/session"), ("DELETE", "/api/v1/session"), ("GET", "/api/v1/day"),
          ("GET", "/api/v1/food/day"), ("GET", "/api/v1/food/entry?ref=f1"))
NOT_FOUND = {"v": 1, "error": "not_found", "message": "Not found."}


@pytest.fixture(autouse=True)
def door_on(monkeypatch):
    monkeypatch.setattr(api, "FRONT_TOKEN", FRONT)
    set_owner()


def door(host=HOST, token=FRONT, scheme="http"):
    """A client as the front end's server: the core's own name inside Docker and the service token."""
    headers = {"X-Front-Token": token} if token is not None else {}
    return TestClient(build_app(), base_url=f"{scheme}://{host}", headers=headers, follow_redirects=False)


def fresh_code():
    """A code newer than any used before (each code works once; the tests sign in several times within one 30 s step)."""
    owner_sql("UPDATE owner_credentials SET last_totp_step = 0")
    return code_now()


def sign_in(c, **over):
    body = {"password": PW, "code": fresh_code(), "user_agent": "Test Browser/1.0", **over}
    return c.post("/api/v1/session", json=body)


def signed_in(c=None):
    """(client, bearer headers, the sign-in's JSON)."""
    c = c or door()
    out = sign_in(c)
    assert out.status_code == 201, out.text
    j = out.json()
    return c, {"Authorization": "Bearer " + j["token"]}, j


def call(c, method, path, headers=None, **kw):
    return c.request(method, path, headers=headers, **kw)


def fail(c, n_times, **over):
    for _ in range(n_times):
        assert sign_in(c, password="wrong password here", **over).status_code == 401


# ---- the door is off ------------------------------------------------------------------------------------

@pytest.mark.parametrize("token", ["", "x" * 31])
def test_the_door_is_off_without_a_long_enough_token(monkeypatch, token):
    c, bearer, _ = signed_in()  # a right session, made while the door was on
    monkeypatch.setattr(api, "FRONT_TOKEN", token)
    for method, path in ROUTES:
        r = call(door(token=token or FRONT), method, path, headers=bearer, json={"password": PW, "code": "123456"} if method == "POST" else None)
        assert r.status_code == 404 and r.json() == NOT_FOUND, (method, path)
        r = call(c, method, path, headers=bearer)
        assert r.status_code == 404 and r.json() == NOT_FOUND, (method, path)


def test_a_32_character_token_turns_the_door_on(monkeypatch):
    monkeypatch.setattr(api, "FRONT_TOKEN", "y" * 32)
    assert sign_in(door(token="y" * 32)).status_code == 201


# ---- the checks ---------------------------------------------------------------------------------------------

@pytest.mark.parametrize("token", [None, "", "wrong-token", FRONT + "x", FRONT[:-1], FRONT.upper()])
def test_a_wrong_or_missing_service_token_is_a_404(token):
    _, bearer, _ = signed_in()
    c = door(token=token)
    for method, path in ROUTES:
        r = call(c, method, path, headers=bearer, json={"password": PW, "code": "1"} if method == "POST" else None)
        assert r.status_code == 404 and r.json() == NOT_FOUND, (method, path)
    assert n("SELECT count(*) AS n FROM login_failures") == 0  # refused before anything is checked


@pytest.mark.parametrize("scheme,host", [("https", "app.example.test"), ("http", "localhost"), ("http", "logger-v2-core"),
                                        ("http", "logger-v2-core:8001"), ("https", "log.example.test"), ("http", "127.0.0.1:8000")])
def test_a_wrong_host_is_a_404(scheme, host):
    _, bearer, _ = signed_in()
    c = door(host=host, scheme=scheme)
    for method, path in ROUTES:
        r = call(c, method, path, headers=bearer, json={"password": PW, "code": "1"} if method == "POST" else None)
        assert r.status_code == 404 and r.json() == NOT_FOUND, (host, method, path)


@pytest.mark.parametrize("header", ["cf-ray", "cf-connecting-ip", "cf-visitor", "x-forwarded-for", "x-forwarded-host",
                                    "x-forwarded-proto", "forwarded", "x-real-ip"])
def test_a_call_with_cloudflare_or_proxy_headers_is_a_404(header):
    c, bearer, _ = signed_in()
    assert call(c, "GET", "/api/v1/session", headers=bearer).status_code == 200  # the same call without the header
    r = call(c, "GET", "/api/v1/session", headers={**bearer, header: "203.0.113.7"})
    assert r.status_code == 404 and r.json() == NOT_FOUND
    r = c.post("/api/v1/session", json={"password": PW, "code": fresh_code()}, headers={header: "x"})
    assert r.status_code == 404


def test_the_checks_come_before_the_sign_in_check():
    """A wrong service token is a 404 even without a session; with the token but no session it is a 401."""
    assert door(token="nope").get("/api/v1/day").status_code == 404
    r = door().get("/api/v1/day")
    assert r.status_code == 401 and r.json()["error"] == "signed_out"


def test_every_answer_has_v1_and_is_never_cached():
    c, bearer, _ = signed_in()
    answers = [
        door(token="nope").get("/api/v1/day"),                                  # 404
        c.get("/api/v1/day"),                                                    # 401
        c.get("/api/v1/day", headers=bearer),                                    # 200
        c.get("/api/v1/day?day=bad", headers=bearer),                            # 400
        c.get("/api/v1/food/entry?ref=f999", headers=bearer),                    # 404 no_entry
        c.post("/api/v1/session", content=b"{nope"),                              # 400
        sign_in(c),                                                               # 201
        sign_in(c, password="wrong password here"),                               # 401
        c.delete("/api/v1/session", headers=bearer),                              # 200
    ]
    assert [a.status_code for a in answers] == [404, 401, 200, 400, 404, 400, 201, 401, 200]
    for a in answers:
        assert a.json()["v"] == 1 and a.headers["cache-control"] == "no-store" and a.headers["x-content-type-options"] == "nosniff", a.text


def test_a_body_that_is_not_a_json_object_is_a_bad_request():
    c = door()
    for content in (b"[1,2]", b"{nope", b'"text"', b"42", b"null"):
        r = c.post("/api/v1/session", content=content, headers={"Content-Type": "application/json"})
        assert r.status_code == 400 and r.json()["error"] == "bad_request", content
    assert c.post("/api/v1/session", json=[1, 2]).status_code == 400
    assert n("SELECT count(*) AS n FROM web_sessions") == 0 and n("SELECT count(*) AS n FROM login_failures") == 0


def test_a_password_that_is_not_text_is_a_bad_request_and_a_missing_one_a_wrong_try():
    c = door()
    for body in ({"password": [1], "code": "123456"}, {"password": PW, "code": {"a": 1}}, {"password": True, "code": "123456"}):
        r = c.post("/api/v1/session", json=body)
        assert r.status_code == 400 and r.json()["error"] == "bad_request", body
    assert n("SELECT count(*) AS n FROM login_failures") == 0
    assert c.post("/api/v1/session", json={}).status_code == 401  # nothing sent is the same as a wrong password
    assert n("SELECT count(*) AS n FROM login_failures") == 1


# ---- sign-in -----------------------------------------------------------------------------------------------

def test_sign_in_gives_a_token_a_device_and_an_end_and_keeps_only_a_hash():
    c = door()
    r = sign_in(c, user_agent="Test Browser/1.0 (Linux)")
    j = r.json()
    assert r.status_code == 201 and j["v"] == 1 and set(j) == {"v", "token", "device", "expires_at"}
    ends = datetime.fromisoformat(j["expires_at"])
    assert timedelta(days=29, hours=23) < ends - datetime.now(timezone.utc) <= timedelta(days=30)
    rows = owner_sql("SELECT * FROM web_sessions")
    assert len(rows) == 1
    row = rows[0]
    assert row["front"] == "logger" and row["user_agent"] == "Test Browser/1.0 (Linux)"
    assert row["token_hash"] == hashlib.sha256(j["token"].encode()).hexdigest() and row["token_hash"] != j["token"]
    assert row["device_hash"] == hashlib.sha256(j["device"].encode()).hexdigest()
    assert j["token"] not in str(rows) and j["device"] != j["token"]
    assert n("SELECT count(*) AS n FROM trusted_devices") == 1
    assert "set-cookie" not in r.headers  # a bearer token, no cookie


def test_the_password_and_the_code_are_not_stored_or_logged_anywhere(caplog):
    c = door()
    with caplog.at_level("DEBUG"):
        sign_in(c)
        sign_in(c, password="wrong password here")
    assert PW not in caplog.text and "wrong password here" not in caplog.text
    for table in ("web_sessions", "login_failures", "trusted_devices", "audit_log"):
        assert PW not in str(owner_sql(f"SELECT * FROM {table}")), table


def test_wrong_password_or_code_is_a_401_and_counted():
    c = door()
    r = sign_in(c, password="wrong password here")
    assert r.status_code == 401 and r.json()["error"] == "wrong_credentials" and r.json()["v"] == 1
    assert "token" not in r.json()
    assert sign_in(c, code="000000").status_code == 401
    assert n("SELECT count(*) AS n FROM login_failures") == 2 and n("SELECT count(*) AS n FROM web_sessions") == 0


def test_no_owner_set_up_is_a_401():
    owner_sql("DELETE FROM owner_credentials")
    assert door().post("/api/v1/session", json={"password": PW, "code": "123456"}).status_code == 401


def test_five_failures_lock_the_sign_in_even_with_the_right_password():
    c = door()
    fail(c, auth.MAX_FAILURES)
    r = sign_in(c)
    assert r.status_code == 429 and r.json()["error"] == "too_many_tries" and "Try again" in r.json()["message"]
    assert n("SELECT count(*) AS n FROM web_sessions") == 0


def test_the_same_code_works_once():
    c = door()
    code = fresh_code()
    assert c.post("/api/v1/session", json={"password": PW, "code": code}).status_code == 201
    r = c.post("/api/v1/session", json={"password": PW, "code": code})
    assert r.status_code == 401 and r.json()["error"] == "wrong_credentials"
    assert n("SELECT count(*) AS n FROM web_sessions") == 1


def test_a_known_device_counts_its_own_failures_and_strangers_cannot_lock_it_out():
    c = door()
    device = sign_in(c).json()["device"]
    fail(c, auth.MAX_FAILURES)  # strangers: the shared pool
    assert sign_in(c).status_code == 429
    again = sign_in(c, device=device)  # the known device is not locked out by them
    assert again.status_code == 201 and again.json()["device"] == device
    fail(c, auth.MAX_FAILURES, device=device)  # now its own tries
    assert sign_in(c, device=device).status_code == 429
    assert n("SELECT count(*) AS n FROM login_failures WHERE device_hash IS NOT NULL") == auth.MAX_FAILURES


def test_an_unknown_device_token_is_treated_as_a_stranger():
    c = door()
    r = sign_in(c, device="made-up-device-token")
    assert r.status_code == 201 and r.json()["device"] != "made-up-device-token"


def test_failures_through_the_app_login_count_for_the_door_and_the_reverse():
    app = client()
    for _ in range(auth.MAX_FAILURES):
        assert web_sign_in(app, password="wrong password here").status_code == 401
    assert sign_in(door()).status_code == 429  # pooled with the door's strangers
    owner_sql("TRUNCATE login_failures")
    fail(door(), auth.MAX_FAILURES)
    assert web_sign_in(client(), code=fresh_code()).status_code == 429
    assert n("SELECT count(*) AS n FROM web_sessions") == 0


# ---- the session -----------------------------------------------------------------------------------------------

def test_the_session_call_says_who_is_signed_in():
    c, bearer, j = signed_in()
    r = c.get("/api/v1/session", headers=bearer)
    sid = str(owner_sql("SELECT sid FROM web_sessions")[0]["sid"])
    assert r.status_code == 200 and r.json()["signed_in"] is True and r.json()["sid"] == sid
    assert datetime.fromisoformat(r.json()["expires_at"]) > datetime.now(timezone.utc) + timedelta(days=29)


def test_without_a_session_or_with_a_wrong_one_is_signed_out():
    c, bearer, j = signed_in()
    for headers in ({}, {"Authorization": "Bearer " + "z" * 43}, {"Authorization": "Bearer short"}, {"Authorization": "Basic " + j["token"]},
                    {"Authorization": j["token"]}, {"Authorization": "Bearer "}, {"Authorization": "Bearer " + j["token"] + "x"}):
        for path in ("/api/v1/session", "/api/v1/day", "/api/v1/food/day", "/api/v1/food/entry?ref=f1"):
            r = c.get(path, headers=headers)
            assert r.status_code == 401 and r.json() == {"v": 1, "error": "signed_out", "message": "Sign in first."}, (headers, path)
    assert c.delete("/api/v1/session", headers={"Authorization": "Bearer " + "z" * 43}).status_code == 401
    assert n("SELECT count(*) AS n FROM web_sessions") == 1


def test_signing_out_removes_the_session():
    c, bearer, _ = signed_in()
    r = c.delete("/api/v1/session", headers=bearer)
    assert r.status_code == 200 and r.json() == {"v": 1, "outcome": "signed_out"}
    assert n("SELECT count(*) AS n FROM web_sessions") == 0
    assert c.get("/api/v1/session", headers=bearer).status_code == 401
    assert c.get("/api/v1/day", headers=bearer).status_code == 401


def test_signing_out_ends_only_this_session():
    c, bearer, _ = signed_in()
    _, other, _ = signed_in(c)
    c.delete("/api/v1/session", headers=bearer)
    assert c.get("/api/v1/session", headers=other).status_code == 200 and n("SELECT count(*) AS n FROM web_sessions") == 1


def test_a_door_session_is_not_the_apps_cookie():
    _, _, j = signed_in()
    app = client()
    r = app.get("/web/", headers={"Cookie": f"{webapp.COOKIE}={j['token']}"})
    assert r.status_code == 302 and r.headers["location"] == "/web/login"
    assert n("SELECT count(*) AS n FROM web_sessions") == 1  # still there, just not valid at app.


def test_an_app_session_is_not_a_door_bearer(web):
    c, _ = web
    token = c.cookies.get(webapp.COOKIE)
    assert token and c.get("/web/").status_code == 200
    r = door().get("/api/v1/session", headers={"Authorization": "Bearer " + token})
    assert r.status_code == 401 and r.json()["error"] == "signed_out"
    assert door().get("/api/v1/day", headers={"Authorization": "Bearer " + token}).status_code == 401
    assert door().delete("/api/v1/session", headers={"Authorization": "Bearer " + token}).status_code == 401
    assert n("SELECT count(*) AS n FROM web_sessions") == 1  # the app.'s session was not touched
    assert c.get("/web/").status_code == 200


def test_an_expired_session_is_signed_out():
    c, bearer, _ = signed_in()
    owner_sql("UPDATE web_sessions SET expires_at = now() - interval '1 minute'")
    for path in ("/api/v1/session", "/api/v1/day"):
        r = c.get(path, headers=bearer)
        assert r.status_code == 401 and r.json()["error"] == "signed_out", path


def test_a_session_in_use_is_renewed_to_30_days():
    c, bearer, _ = signed_in()
    owner_sql("UPDATE web_sessions SET expires_at = now() + interval '10 days'")
    r = c.get("/api/v1/day", headers=bearer)
    assert r.status_code == 200 and r.headers["x-session-expires"]
    ends = owner_sql("SELECT expires_at, extract(epoch FROM expires_at - now()) AS left FROM web_sessions")[0]
    assert abs(ends["left"] - 30 * 86400) < 60
    assert datetime.fromisoformat(r.headers["x-session-expires"]) == ends["expires_at"]


def test_a_session_with_30_days_left_is_not_changed():
    c, bearer, _ = signed_in()
    owner_sql("UPDATE web_sessions SET expires_at = now() + interval '30 days'")
    before = owner_sql("SELECT expires_at FROM web_sessions")[0]["expires_at"]
    r = c.get("/api/v1/day", headers=bearer)
    after = owner_sql("SELECT expires_at, last_seen FROM web_sessions")[0]
    assert r.status_code == 200 and abs((after["expires_at"] - before).total_seconds()) < 1
    assert r.headers["x-session-expires"] and datetime.fromisoformat(r.headers["x-session-expires"]) == after["expires_at"]
    assert (datetime.now(timezone.utc) - after["last_seen"]).total_seconds() < 60


def test_the_session_shows_under_devices_on_the_app_as_the_new_front_end(web):
    c, _ = web
    c2 = door()
    assert sign_in(c2, user_agent="Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0").status_code == 201
    page = c.get("/web/settings?tab=devices")
    assert page.status_code == 200 and "Linux, Firefox · new front end" in page.text
    assert page.text.count(" · new front end") == 1  # the app.'s own session carries no mark
    assert "Signed-in devices <span class=\"small\">2</span>" in page.text

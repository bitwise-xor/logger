"""The connector's sign-in (core 36, 21.11.2026): a stranger cannot lock the owner out of it. Failed tries are counted as the web
app's are (a device that signed in before has its own pool, every other try shares the connector's pool, the web's failures
do not count here), and junk client registrations cannot fill the list of clients for good."""
from starlette.testclient import TestClient

from app import auth, maintenance
from app import web as webapp
from app.mcp_app import build_app
from conftest import owner_sql
from test_auth import PW, code_now, register, set_owner, start


def client():
    return TestClient(build_app(), base_url="https://log.example.test", follow_redirects=False)


def n(sql, *args):
    return owner_sql(sql, *args)[0]["n"]


def fresh_code():
    """A code that works now: each code works once, so the step used by the last sign-in is forgotten first."""
    owner_sql("UPDATE owner_credentials SET last_totp_step = 0")
    return code_now()


def try_sign_in(c, cid, password=PW, code=None):
    return c.post("/login", data={"req": start(c, cid, "v" * 50), "password": password, "code": code or fresh_code()})


def pools():
    return {r["device_hash"]: r["n"] for r in owner_sql("SELECT device_hash, count(*) AS n FROM login_failures GROUP BY device_hash")}


def known():
    """A device that signed in once (it carries the connector's device cookie) and the client it signed in with."""
    set_owner()
    c = client()
    cid = register(c).json()["client_id"]
    assert try_sign_in(c, cid).status_code == 302
    return c, cid


def test_a_sign_in_sets_the_connectors_device_cookie_kept_hashed():
    set_owner()
    c = client()
    cid = register(c).json()["client_id"]
    header = try_sign_in(c, cid).headers["set-cookie"]
    assert header.startswith(auth.CONNECTOR_DEVICE_COOKIE + "=")
    for part in ("HttpOnly", "Secure", "SameSite=lax", "Path=/", f"Max-Age={auth.CONNECTOR_DEVICE_DAYS * 86400}"):
        assert part.lower() in header.lower(), part
    assert "domain" not in header.lower()  # __Host-: this host only
    raw = c.cookies[auth.CONNECTOR_DEVICE_COOKIE]
    assert owner_sql("SELECT device_hash FROM trusted_devices") == [{"device_hash": auth._h(raw)}]  # the hash, never the cookie
    again = try_sign_in(c, cid).headers["set-cookie"]
    assert again.startswith(f"{auth.CONNECTOR_DEVICE_COOKIE}={raw};")  # a known device keeps its cookie
    assert n("SELECT count(*) AS n FROM trusted_devices") == 1


def test_five_wrong_tries_from_an_unknown_device_do_not_block_a_known_device():
    c, cid = known()
    stranger = client()
    for _ in range(auth.MAX_FAILURES):
        assert try_sign_in(stranger, cid, password="nope").status_code == 401
    assert try_sign_in(stranger, cid).status_code == 429  # the stranger is locked out, even with the right password
    assert try_sign_in(c, cid).status_code == 302  # the owner's own device still gets in
    assert pools() == {auth.CONNECTOR_POOL: auth.MAX_FAILURES}  # and its success did not clear the shared pool


def test_a_known_device_counts_its_own_failures_and_clears_only_its_own():
    c, cid = known()
    stranger = client()
    assert try_sign_in(stranger, cid, password="nope").status_code == 401
    for _ in range(auth.MAX_FAILURES):
        assert try_sign_in(c, cid, password="nope").status_code == 401
    assert try_sign_in(c, cid).status_code == 429
    assert try_sign_in(client(), cid).status_code == 302  # a new device is not affected; its success clears the shared pool only
    assert list(pools().values()) == [auth.MAX_FAILURES] and auth.CONNECTOR_POOL not in pools()
    owner_sql("UPDATE login_failures SET at = now() - interval '20 minutes'")  # the window is over
    assert try_sign_in(c, cid, password="nope").status_code == 401
    assert try_sign_in(c, cid).status_code == 302
    assert pools() == {}  # its own pool is cleared


def test_the_web_apps_failures_do_not_count_here_and_a_sign_in_here_leaves_them():
    set_owner()
    for _ in range(auth.MAX_FAILURES):
        assert webapp.sign_in("nope", "000000", None, "test")["status"] == 401
    assert webapp.sign_in(PW, code_now(), None, "test")["status"] == 429  # the web's shared pool is full
    c = client()
    cid = register(c).json()["client_id"]
    assert try_sign_in(c, cid).status_code == 302  # an unknown device here: the connector's own pool is empty
    assert pools() == {None: auth.MAX_FAILURES}  # the web's failures are still there
    for _ in range(auth.MAX_FAILURES):
        assert try_sign_in(client(), cid, password="nope").status_code == 401
    owner_sql("UPDATE login_failures SET at = now() - interval '20 minutes' WHERE device_hash IS NULL")
    assert webapp.sign_in(PW, fresh_code(), None, "test")["ok"]  # and the connector's do not count on the web
    assert pools() == {auth.CONNECTOR_POOL: auth.MAX_FAILURES}


# ---- registered clients ----------------------------------------------------------------------------------------------------

def clients():
    return n("SELECT count(*) AS n FROM oauth_clients")


def test_a_used_client_survives_50_junk_registrations_and_the_51st_works():
    c, used = known()
    assert owner_sql("SELECT used_at IS NOT NULL AS u FROM oauth_clients WHERE client_id = %s", used) == [{"u": True}]
    junk = [register(c).json()["client_id"] for _ in range(auth.MAX_CLIENTS - 1)]
    assert clients() == auth.MAX_CLIENTS
    for _ in range(auth.MAX_CLIENTS):
        assert register(c).status_code == 201
    assert clients() == auth.MAX_CLIENTS
    assert n("SELECT count(*) AS n FROM oauth_clients WHERE client_id = %s", used) == 1
    assert n("SELECT count(*) AS n FROM oauth_clients WHERE client_id = ANY(%s)", junk) == 0  # the oldest went first
    new = register(c)
    assert new.status_code == 201 and n("SELECT count(*) AS n FROM oauth_clients WHERE client_id = %s", new.json()["client_id"]) == 1
    assert try_sign_in(c, used).status_code == 302  # the owner's connector still signs in


def test_a_client_in_the_middle_of_a_sign_in_is_not_removed_and_a_full_list_of_used_ones_refuses():
    set_owner()
    c = client()
    first = register(c).json()["client_id"]
    start(c, first, "v" * 50)  # a sign-in request waits for it
    for _ in range(auth.MAX_CLIENTS - 1):
        register(c)
    owner_sql("UPDATE oauth_clients SET used_at = now() WHERE client_id <> %s", first)
    assert register(c).status_code == 400  # every other one was used: nothing to remove
    assert n("SELECT count(*) AS n FROM oauth_clients WHERE client_id = %s", first) == 1
    owner_sql("UPDATE oauth_requests SET expires_at = now() - interval '1 minute'")
    assert register(c).status_code == 201  # its request ran out: now it is the one never used
    assert n("SELECT count(*) AS n FROM oauth_clients WHERE client_id = %s", first) == 0


def test_the_nightly_clean_up_removes_clients_never_used_after_a_day():
    c, used = known()
    old, young, waiting = (register(c).json()["client_id"] for _ in range(3))
    start(c, waiting, "v" * 50)
    owner_sql("UPDATE oauth_clients SET created_at = now() - interval '25 hours' WHERE client_id <> %s", young)
    owner_sql("DELETE FROM oauth_tokens")  # the owner's tokens ran out long ago: a client signed in with still stays
    assert maintenance.cleanup()["oauth_clients"] == 1
    assert {r["client_id"] for r in owner_sql("SELECT client_id FROM oauth_clients")} == {used, young, waiting}
    assert old not in (used, young, waiting)

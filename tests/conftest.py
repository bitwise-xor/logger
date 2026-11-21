import os
import socket
import subprocess
import sys


def _test_db_address():
    """Host and port of this checkout's own test database: 127.0.0.1 and 55433 in the main checkout, a port of its own in a
    git worktree (core item 30). tests/test-db.sh decides name and port, so the two never disagree; TESTDB_PORT overrides both.

    The tests are bound by round trips to the database (thousands of short queries), and the published port goes through
    Docker's userland proxy, which doubles each one. So when that port is this container's (docker says so) and the
    container's own address answers, the tests talk to it directly: the same database, half the wait. TESTDB_DIRECT=0, or
    anything unexpected, keeps the published port."""
    script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "test-db.sh")
    try:
        name, port = subprocess.run(["bash", script, "where"], capture_output=True, text=True, check=True, timeout=30).stdout.split()[:2]
    except (OSError, subprocess.SubprocessError, ValueError):
        return "127.0.0.1", os.environ.get("TESTDB_PORT", "55433")
    if os.environ.get("TESTDB_DIRECT", "1") != "0":
        try:
            run = dict(capture_output=True, text=True, check=True, timeout=10)
            published = subprocess.run(["docker", "port", name, "5432/tcp"], **run).stdout.split()
            ips = subprocess.run(["docker", "inspect", "-f", "{{range .NetworkSettings.Networks}}{{.IPAddress}} {{end}}", name], **run).stdout.split()
            if f"127.0.0.1:{port}" in published and ips:
                socket.create_connection((ips[0], 5432), timeout=1).close()
                return ips[0], "5432"
        except (OSError, subprocess.SubprocessError):
            pass
    return "127.0.0.1", port


DB_HOST, DB_PORT = _test_db_address()
os.environ.update(DB_HOST=DB_HOST, DB_PORT=DB_PORT, APP_OWNER_PASSWORD="testowner", CORE_RW_PASSWORD="testcore",
                  MCP_PATH="/mcp-testpath", ALLOWED_HOSTS="log.example.test,logger-v2-core:*", PUBLIC_URL="https://log.example.test", APP_HOST="app.example.test", PILOT_TOOLS="1")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "core"))

import pytest  # noqa: E402

from app import migrate  # noqa: E402
from app.db import connect  # noqa: E402


@pytest.fixture(scope="session", autouse=True)
def _schema():
    migrate.run()


@pytest.fixture(scope="session", autouse=True)
def _cheap_password_hash():
    """Signing in hashes and checks a password with scrypt, about 0.4 s each on purpose; the tests use a tiny cost
    (core item 28, 02.11.2026). The live app keeps auth.SCRYPT_N."""
    from app import auth
    auth.SCRYPT_N = 2 ** 4


CLEANED = ("food_entries, food_meal_notes, food_units, food_defaults, foods, thoughts, thought_updates, thought_links, private.entries, private.incoming, measurements, events, raw_inbox, pending, idempotency_keys, audit_log, owner_credentials, oauth_clients, oauth_requests, oauth_codes, oauth_tokens, login_failures, web_sessions, trusted_devices, ui_settings, workout_sets, workouts, workout_day_items, workout_days, exercises, watch_metrics, watch_workouts, body_height, home_done, home_skips, home_timers, home_chores, home_zones, coachings")

CLEANED += ", todo_sent"  # core item 33: the Todoist task made per request (todos.py)

@pytest.fixture(scope="session")
def _dirty_query(_schema):
    """One query that names every table the clean-up must empty: those with a row or whose own counter (id sequence) has
    moved since its last restart. The set checked is what `TRUNCATE <CLEANED> CASCADE` empties: CLEANED plus every table
    that refers to one of them by foreign key, again and again (lab_reports, recipes, food_targets, ... through raw_inbox
    and foods). A TRUNCATE costs a few ms per table even when it is empty, so emptying only these is much cheaper and
    leaves the same database: every one of those tables empty and every one of their counters back at its start."""
    with connect(owner=True) as c:
        oids = {c.execute("SELECT %s::regclass::oid AS o", (t,)).fetchone()["o"] for t in CLEANED.split(", ")}
        fks = c.execute("SELECT conrelid AS child, confrelid AS parent FROM pg_constraint WHERE contype = 'f'").fetchall()
        while True:
            more = {f["child"] for f in fks if f["parent"] in oids} - oids
            if not more:
                break
            oids |= more
        names = [r["n"] for r in c.execute("SELECT oid::regclass::text AS n FROM pg_class WHERE oid = ANY(%s) ORDER BY 1", (list(oids),))]
    rows = " UNION ALL ".join(f"SELECT '{t}' AS t WHERE EXISTS (SELECT 1 FROM {t})" for t in names)
    counters = ("SELECT d.refobjid::regclass::text FROM pg_class s JOIN pg_depend d ON d.classid = 'pg_class'::regclass AND d.objid = s.oid"
                " AND d.refclassid = 'pg_class'::regclass AND d.deptype IN ('a', 'i') JOIN pg_namespace ns ON ns.oid = s.relnamespace"
                " JOIN pg_sequences ps ON ps.schemaname = ns.nspname AND ps.sequencename = s.relname"
                f" WHERE s.relkind = 'S' AND ps.last_value IS NOT NULL AND d.refobjid = ANY('{{{','.join(map(str, sorted(oids)))}}}'::oid[])")
    return f"{rows} UNION SELECT * FROM ({counters}) AS moved"


@pytest.fixture(autouse=True)
def clean(_dirty_query):
    with connect(owner=True) as c:
        dirty = [r["t"] for r in c.execute(_dirty_query).fetchall()]
        if dirty:
            c.execute(f"TRUNCATE {', '.join(dirty)} RESTART IDENTITY CASCADE")
    yield


def owner_sql(sql, *args):
    with connect(owner=True) as c:
        cur = c.execute(sql, args)
        return cur.fetchall() if cur.description else []


@pytest.fixture
def bearer():
    """An access token for MCP calls, issued directly (the sign-in flow itself is tested in test_auth)."""
    import hashlib
    import secrets
    tok = secrets.token_urlsafe(32)
    owner_sql("INSERT INTO oauth_tokens (token_hash,kind,client_id,scopes,expires_at) VALUES (%s,'access','c',ARRAY['log'], now()+interval '1 hour')",
              hashlib.sha256(tok.encode()).hexdigest())
    return {"Authorization": "Bearer " + tok}

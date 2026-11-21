"""Core item 34 (21.11.2026): a waiting message is saved by one reader only. A read can outlast the 10-minute lease (cron:
several AI calls of up to 3 tries of 60 s), and another reader may then claim the same message. The transaction that saves
it first checks, with the row locked, that the message is still this reader's (held.owner: the `tries` its claim returned);
one that lost it saves nothing and leaves the row alone, and the row lock makes a claim made during a save wait for it."""
import threading
import time

from app import held, logbook
from conftest import owner_sql
from test_held import FOOD, TEXT, keep, kept
from test_log import fake, off, skyr  # noqa: F401 - fixtures reused
from test_web import n

EXPIRE = "UPDATE private.incoming SET reading_since = now() - interval '11 minutes' WHERE id = %s"


def started():
    return time.monotonic()


def test_a_reader_whose_lease_ran_out_saves_nothing_and_the_new_reader_saves_once(fake, skyr):
    keep(TEXT, "o1", fake)
    hid = kept()[0]["id"]
    a = held.claim(hid)  # reader A (cron) starts reading ...
    owner_sql(EXPIRE, hid)  # ... and takes longer than the lease
    b = held.claim(hid)  # reader B (Try again) takes it
    assert a["tries"] + 1 == b["tries"]
    out = logbook._read_claimed(a, True, started())  # A's save comes first: it no longer has the message
    assert out["outcome"] == "held" and out["reason"] == "It is being read right now."
    assert n(FOOD) == 0 and n("SELECT count(*) AS n FROM raw_inbox") == 0
    row = kept()[0]  # left alone: still B's
    assert row["tries"] == b["tries"] and row["reading_since"] == b["reading_since"] and row["last_error"] == "ProviderError"
    assert logbook._read_claimed(b, False, started())["outcome"] == "saved" and n(FOOD) == 1 and kept() == []
    assert logbook._read_claimed(a, False, started())["outcome"] == "rejected"  # and once saved, A finds it gone
    assert n(FOOD) == 1 and n("SELECT count(*) AS n FROM raw_inbox") == 1


def test_a_reader_that_lost_the_message_does_not_free_the_other_readers_lease(fake, skyr, monkeypatch):
    keep(TEXT, "o2", fake)
    hid = kept()[0]["id"]
    a = held.claim(hid)
    owner_sql(EXPIRE, hid)
    b = held.claim(hid)

    def down(*_a, **_k):
        raise RuntimeError("A's read failed late")
    monkeypatch.setattr(logbook, "_read", down)
    assert logbook._read_claimed(a, True, started())["outcome"] == "held"
    row = kept()[0]
    assert row["reading_since"] == b["reading_since"] and row["last_error"] == "ProviderError"  # not A's RuntimeError
    with logbook.connect() as c, c.cursor() as cur:
        held.needs_you(cur, hid, "A thinks it needs you", a["tries"])
        held.failed(cur, hid, "A", a["tries"])
    assert kept()[0]["reading_since"] == b["reading_since"] and kept()[0]["last_error"] == "ProviderError"
    with logbook.connect() as c, c.cursor() as cur:
        held.failed(cur, hid, "B", b["tries"])  # the owner's own failure frees it
    assert kept()[0]["reading_since"] is None and kept()[0]["last_error"] == "B"


def test_a_kept_private_line_is_saved_by_one_reader_only(fake):
    hid = owner_sql("""INSERT INTO private.incoming (received_at, channel, content, idempotency_key)
                       VALUES (now() - interval '10 minutes', 'mcp', 'private: the quiet one', 'o3') RETURNING id""")[0]["id"]
    a = held.claim(hid)
    owner_sql(EXPIRE, hid)
    b = held.claim(hid)
    assert logbook._read_claimed(a, False, started())["outcome"] == "held"
    assert n("SELECT count(*) AS n FROM private.entries") == 0
    assert logbook._read_claimed(b, False, started())["outcome"] == "saved"
    assert n("SELECT count(*) AS n FROM private.entries") == 1 and kept() == [] and fake.calls == []


def _waiting_for_a_lock(timeout=5.0) -> bool:
    end = time.monotonic() + timeout
    while time.monotonic() < end:
        if owner_sql("SELECT count(*) AS n FROM pg_locks WHERE NOT granted")[0]["n"]:
            return True
        time.sleep(0.02)
    return False


def test_a_claim_made_while_the_owner_saves_waits_and_then_finds_it_saved(fake, skyr, monkeypatch):
    """The other order: A already holds the row lock (it is saving) when B claims. B's UPDATE waits for A's transaction
    under READ COMMITTED; A deletes the row as it commits, so B's claim then finds nothing."""
    keep(TEXT, "o4", fake)
    hid = kept()[0]["id"]
    real_read, real_retry = logbook._read, logbook.todos.retry
    seen = {}

    def slow_read(*a, **k):  # A's AI read takes longer than the lease
        out = real_read(*a, **k)
        owner_sql(EXPIRE, hid)
        return out

    def claim_meanwhile(cur, *a, **k):  # inside A's save transaction, after held.owner locked the row
        t = threading.Thread(target=lambda: seen.update(b=held.claim(hid)))
        t.start()
        seen["waited"] = _waiting_for_a_lock()
        seen["alive"] = t.is_alive()
        seen["thread"] = t
        return real_retry(cur, *a, **k)
    monkeypatch.setattr(logbook, "_read", slow_read)
    monkeypatch.setattr(logbook.todos, "retry", claim_meanwhile)
    out = logbook.read_held(hid, background=True)
    seen["thread"].join(10)
    assert out["outcome"] == "saved" and n(FOOD) == 1 and kept() == []
    assert seen["waited"] and seen["alive"]  # B's claim waited for A's save ...
    assert seen["b"] is None  # ... and then found it saved
    monkeypatch.setattr(logbook.todos, "retry", real_retry)
    assert logbook.read_held(hid)["outcome"] == "rejected" and n(FOOD) == 1


def test_a_claim_made_while_the_owner_keeps_it_for_the_owner_takes_it_after(fake, monkeypatch):
    """A save that ends without deleting (cron: nothing to log, it waits for the owner) frees the row: a claim that waited
    for it then takes it, so Try again still works."""
    keep("why is that?", "o5", fake)
    hid = kept()[0]["id"]
    real_read, real_retry = logbook._read, logbook.todos.retry
    seen = {}

    def slow_read(*a, **k):
        out = real_read(*a, **k)
        owner_sql(EXPIRE, hid)
        return out

    def claim_meanwhile(cur, *a, **k):
        t = threading.Thread(target=lambda: seen.update(b=held.claim(hid)))
        t.start()
        seen["waited"], seen["thread"] = _waiting_for_a_lock(), t
        return real_retry(cur, *a, **k)
    monkeypatch.setattr(logbook, "_read", slow_read)
    monkeypatch.setattr(logbook.todos, "retry", claim_meanwhile)
    out = logbook.read_held(hid, background=True)
    seen["thread"].join(10)
    assert out["outcome"] == "not_logged" and out["held_id"] == hid and seen["waited"]
    assert isinstance(seen["b"], dict) and seen["b"]["tries"] == 3  # B has it now (keep: 1, A: 2, B: 3)
    assert kept()[0]["last_error"].startswith(held.NEEDS_YOU)

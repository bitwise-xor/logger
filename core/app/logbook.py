"""The core's free-text operations: log one message, answer one open question. A thin layer around record.py that
adds what a live call needs: the connection, the AI provider, the context (earlier messages, today's meals),
the idempotency key, the audit log (ids, outcomes and AI usage only, never health values) and a short reply text."""
import hashlib
import json
import logging
import os
import re
import secrets
import time
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Any, Callable, NamedTuple, Optional

from psycopg.types.json import Jsonb

from . import commands, cycle, held, labs, lookup, privateline, record, tape, todos
from .ai import parser
from .ai.provider import LIVE, AnthropicProvider, Provider, ProviderError, kind as error_kind
from .db import connect
from .v1_food import _food_cat, _types
from .v1_log import Reject
from .when import BERLIN

CHANNEL = "mcp"  # the chat apps (MCP connector)
WEB = "web"  # the web app
LIVE_CHANNELS = [CHANNEL, WEB]  # the repeat guard looks across these
PROVIDER: Optional[Provider] = None  # created on first use; tests put a fake here
_LOG = logging.getLogger("logger.log")
# A confirmation counts when the reply starts with a yes ("yes, it is correct ..."); only a clear no cancels.
YES = re.compile(r"^\s*(yes|y|ok|okay|confirm(ed)?|correct|right|ja|jawohl|stimmt|richtig)\b", re.I)
# The questions `answer` takes (the web app lists the open ones on Today).
ANSWER_TOOLS = ("log", "log_confirm", "log_repeat", "add_food_confirm", "command", "command_confirm", "lookup_confirm",
                "report_confirm", "home_choice")
NO = re.compile(r"^\s*(no|nope|nein|skip|cancel|stop|drop)\b", re.I)
# The answer to "a new day, or up from a nap or a night waking?" (cycle.py, 05.11.2026): the wake-up is saved as a nap instead.
NAP = re.compile(r"^\s*(nap|a nap|napped|night waking|mittagsschlaf|nickerchen)\b", re.I)


def clock() -> datetime:
    """Now, in Berlin. The replay test sets this to each message's original time."""
    return datetime.now(BERLIN)


def provider() -> Provider:
    global PROVIDER
    if PROVIDER is None:
        PROVIDER = AnthropicProvider(os.environ["ANTHROPIC_API_KEY"])
    return PROVIDER


def _audit(cur, tool: str, outcome: str, detail: dict, client: str = CHANNEL) -> None:
    cur.execute("INSERT INTO audit_log (tool, outcome, client, detail) VALUES (%s, %s, %s, %s)", (tool, outcome, client, Jsonb(detail)))


def _ai(usages: list) -> list[dict]:
    """The AI calls of one audit row as the Usage page reads them: model, tokens ("in" is all input tokens; the cached share is kept
    apart to show whether prompt caching is used), dollars and seconds. Every kind of call writes these (04.11.2026, core item 26)."""
    return [{"model": u.model, "in": u.input_tokens + u.cache_read_tokens + u.cache_write_tokens, "out": u.output_tokens,
             "cache_read": u.cache_read_tokens, "cache_write": u.cache_write_tokens, "usd": round(u.usd, 6), "s": round(u.seconds, 2)}
            for u in usages]


def _context(cur, now: datetime) -> tuple[list, list]:
    """The parser's context: the last few messages of the 6 hours before `now`, and what was eaten and drunk that day.
    `now` is a kept message's own time when it is read again later, so later messages are left out."""
    cur.execute("""SELECT received_at, content FROM raw_inbox WHERE received_at > %s - interval '6 hours' AND received_at <= %s
                   AND channel <> 'catalogue' AND content NOT LIKE 'add food: %%' AND NOT (metadata ? 'lab_report') AND NOT (metadata ? 'gym') AND NOT (metadata ? 'home')
                   ORDER BY received_at DESC LIMIT 4""", (now, now))  # the logger's own catalogue rows are not messages
    prev = [(r["received_at"].astimezone(BERLIN).replace(tzinfo=None), r["content"]) for r in reversed(cur.fetchall())]
    cur.execute("""SELECT e.day, e.meal, e.is_drink, e.eaten_at, f.name FROM food_entries e JOIN foods f ON f.id = e.food_id
                   WHERE e.time_known AND e.eaten_at <= %s AND e.eaten_at > %s - interval '18 hours' ORDER BY e.eaten_at, e.id""",
                (now, now))
    meals: dict = {}
    for m in cur.fetchall():
        key = ("drink", m["eaten_at"]) if m["is_drink"] else ("meal", m["day"], m["meal"])
        label = "drink" if m["is_drink"] else f"meal {m['meal']}"
        t = m["eaten_at"].astimezone(BERLIN).replace(tzinfo=None)
        meals.setdefault(key, [label, t, []])[2].append(m["name"])
    return prev, [tuple(v) for v in meals.values()]


def _message(out: dict) -> str:
    """One short text for the chat app to pass on."""
    o = out["outcome"]
    head = {"saved": "Saved.", "partly_saved": "Saved what was clear; one or more questions are open.",
            "needs_choice": "Nothing saved yet: a question is open.", "kept": "Kept as text.",
            "not_logged": "Not logged: this reads as a question or command for you, so answer the user yourself.",
            "needs_confirmation": "Nothing saved yet: please confirm.", "rejected": "Nothing saved.",
            "cancelled": "Skipped.", "replayed": "Already saved earlier (same message).",
            "answered": "Found.", "changed": "Changed.",
            "held": "Not read yet, but kept: the logger has the words and reads them again by itself. Do not send this "
                    "message again; tell the user in one line."}.get(o, o)
    if o == "rejected" and out.get("steps"):  # a command that matched nothing
        head = "Nothing changed."
    if o == "not_logged" and out.get("intent") == "command":
        head = "Nothing done: this reads as a request the logger cannot handle, so answer the user yourself."
    lines = [head] + out.get("receipt", []) + [f"note: {n}" for n in out.get("notes", [])]
    if out.get("result"):
        lines.append("Look-up result (answer the user from it, briefly; do not repeat it all):\n" + out["result"])
    if out.get("command"):
        lines.append(_message({**out["command"], "questions": []}))
    lines += [f"question {q['question_id']}: {q['question']}" for q in out.get("questions", [])]
    if out.get("read_back"):
        lines.append(out["read_back"])
    if out.get("reason"):
        lines.append(out["reason"])
    if out.get("questions") or o == "needs_confirmation":
        lines.append("Ask the user, then call answer with the question id and their reply.")
    return "\n".join(lines)


def _public(out: dict) -> dict:
    out = dict(out)
    out["questions"] = [{"question_id": q["pending_id"], "question": q["question"]} for q in out.get("questions", [])]
    out["message"] = _message(out)
    return out


def log(text: str, idempotency_key: Optional[str] = None, pred: Optional[dict] = None, channel: str = CHANNEL,
        button: bool = False) -> dict[str, Any]:
    """pred: a ready parser answer (the web app's quick buttons, or tape.read for a line of body measurements); the AI then
    does not read the text and the message is saved at once. Without one, the words are kept first (held.py) and then read and saved by read_held, so an AI or save
    failure cannot lose them (01.11.2026).
    channel: where the message came from (CHANNEL or WEB), stored with it and in the audit log.
    button: a tap on a button that ticks or toggles (a habit, the check-in): the same words again within 30 minutes are meant
    (tick, untick, tick again) and do not ask "log it again?"; a double tap is still stopped by the idempotency key (04.11.2026)."""
    now = clock()
    if not text or not text.strip():
        return {"outcome": "rejected", "message": "Nothing saved: the message is empty."}
    req_hash = hashlib.sha256(text.encode()).hexdigest()
    with connect() as conn, conn.cursor() as cur:
        if idempotency_key:
            cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (idempotency_key,))
            cur.execute("SELECT request_hash, response FROM idempotency_keys WHERE key = %s", (idempotency_key,))
            row = cur.fetchone()
            if row:
                if row["request_hash"] != req_hash:
                    _audit(cur, "log", "rejected", {"why": "key reused"}, channel)
                    return {"outcome": "rejected", "message": "This idempotency key was already used for a different message."}
                _audit(cur, "log", "replayed", {}, channel)
                return {**row["response"], "replayed": True}
        if pred is None and privateline.label(text):  # private and gratitude lines: saved here, never read by the AI (14.11.2026)
            resp = _public(_private(cur, text, now, channel))
            if idempotency_key and resp["outcome"] == "saved":
                cur.execute("INSERT INTO idempotency_keys (key, tool, request_hash, response) VALUES (%s, 'log', %s, %s)",
                            (idempotency_key, req_hash, Jsonb(resp)))
            return resp
        if pred is None:  # body measurements typed as pairs ("waist 123.5 hips 128") need no AI (03.11.2026)
            pred = tape.read(cur, text)
        hid = held.find(cur, idempotency_key) if pred is None else None  # sent again while it waits: read the kept one
        if hid is None:
            same = None
            if not button:
                cur.execute("""SELECT received_at FROM raw_inbox WHERE channel = ANY(%s) AND lower(content) = lower(%s)
                               AND received_at > %s - interval '30 minutes' AND NOT (metadata ? 'unprocessed')
                               ORDER BY received_at DESC LIMIT 1""", (LIVE_CHANNELS, text, now))
                same = cur.fetchone()
            waiting = held.waiting_same(cur, text, now) if pred is None and not same else None
            if same or waiting:  # the same words again within 30 minutes: ask before saving twice
                pid = "p" + secrets.token_hex(4)
                at = (same["received_at"] if same else waiting).astimezone(BERLIN).strftime("%H:%M")
                why = f"already logged at {at}" if same else f"already waiting to be read (sent at {at})"
                cur.execute("INSERT INTO pending (id, tool, payload, reason, expires_at) VALUES (%s, 'log_repeat', %s, %s, %s)",
                            (pid, Jsonb({"text": text, "now": now.isoformat()}), f"same message {why}",
                             now + timedelta(hours=record.QUESTION_HOURS)))
                resp = _public({"outcome": "needs_confirmation", "reason": f"This exact message was {why}.",
                                "questions": [{"pending_id": pid, "question": "Log it again (yes) or not (no)?"}]})
                _audit(cur, "log", "needs_confirmation", {"why": "repeat", "questions": [pid]}, channel)
                return resp
            if pred is None:  # a chore line ("vacuumed the kitchen") is read by a word match, no AI (Home page, 03.11.2026)
                from . import homechat  # here: homechat imports home, which imports this module
                chore = homechat.read(cur, text, now, channel)
                if chore is not None:
                    resp = _public(chore)
                    if idempotency_key:
                        cur.execute("INSERT INTO idempotency_keys (key, tool, request_hash, response) VALUES (%s, 'log', %s, %s)",
                                    (idempotency_key, req_hash, Jsonb(resp)))
                    _audit(cur, "log", chore["outcome"], {"raw_id": chore.get("raw_id"), "home": True,
                                                          "questions": [q["pending_id"] for q in chore.get("questions", [])]}, channel)
                    return resp
            if pred is not None:
                out = _process(cur, text, now, pred, channel)
                resp = _public(out)
                if idempotency_key:
                    cur.execute("INSERT INTO idempotency_keys (key, tool, request_hash, response) VALUES (%s, 'log', %s, %s)",
                                (idempotency_key, req_hash, Jsonb(resp)))
                return resp
            hid = held.keep(cur, text, channel, idempotency_key, now)
    return read_held(hid)


def read_held(hid: int, background: bool = False) -> dict[str, Any]:
    """Read a kept message with the AI and save it (core items 1 and 2). The AI reads with no transaction or connection
    open; the save, its audit row, the idempotency key and the removal of the kept words are one transaction. Whatever
    fails, the words stay kept, "not read yet", for the next try. A message read again later keeps its own time.
    background: the cron job's try, with nobody watching the reply: a message the logger refuses or will not log stays
    kept (marked "needs you", no more automatic tries) instead of being dropped. Any other read is live: the AI gets the
    shorter wait (provider.LIVE)."""
    token = LIVE.set(not background)
    try:
        return _read_held(hid, background)
    finally:
        LIVE.reset(token)


def _not_claimed(hid: int, why: str) -> dict[str, Any]:
    """The answer when this reader does not have the message: "gone" (saved or deleted) or "busy" (another reader has it)."""
    if why == "busy":
        return _public({"outcome": "held", "held_id": hid, "reason": "It is being read right now."})
    return _public({"outcome": "rejected", "reason": "That message is no longer waiting: it was saved or deleted."})


def _read_held(hid: int, background: bool) -> dict[str, Any]:
    started = time.monotonic()
    row = held.claim(hid)
    if row is None or row == "busy":
        return _not_claimed(hid, row or "gone")
    return _read_claimed(row, background, started)


def _read_claimed(row: dict, background: bool, started: float) -> dict[str, Any]:
    """Read and save a message this reader claimed. Each transaction that would save it first checks that it is still this
    reader's (held.owner, core item 34): a read that outlasted its lease and lost the message saves nothing."""
    hid, tries = row["id"], row["tries"]
    text, channel, key = row["content"], row["channel"], row["idempotency_key"]
    now = row["received_at"].astimezone(BERLIN)
    try:
        if privateline.label(text):  # kept before 14.11.2026, or by any other way: saved without the AI all the same
            with connect() as conn, conn.cursor() as cur:
                lost = held.owner(cur, hid, tries)
                if lost:
                    return _not_claimed(hid, lost)
                out = _private(cur, text, now, channel, tries)
                if background and out["outcome"] == "rejected":
                    held.needs_you(cur, hid, out["reason"], tries)
                    return _public({**out, "held_id": hid})
                resp = _public(out)
                if key and out["outcome"] == "saved":
                    cur.execute("""INSERT INTO idempotency_keys (key, tool, request_hash, response) VALUES (%s, 'log', %s, %s)
                                   ON CONFLICT (key) DO NOTHING""", (key, hashlib.sha256(text.encode()).hexdigest(), Jsonb(resp)))
                held.done(cur, hid)
            return resp
        with connect() as conn, conn.cursor() as cur:
            prev, meals = _context(cur, now)
        preds, usages = _read(text, now, prev, meals)
        with connect() as conn, conn.cursor() as cur:
            lost = held.owner(cur, hid, tries)  # the AI read took long: another reader may have it now (core item 34)
            if lost:
                return _not_claimed(hid, lost)
            if key:
                cur.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (key,))
            sent = todos.retry(cur, provider(), now)  # to-dos that waited because Todoist was down
            r = record.best(cur, preds, now)
            out = _save(cur, text, now, r, usages + sent["usages"], len(preds) > 1, channel, prev, sent, tries, started)
            if background and out["outcome"] in ("rejected", "not_logged"):  # nothing was saved: keep the words for the owner
                why = out.get("reason") or ("it reads as a question or a request, not an entry" if out["outcome"] == "not_logged" else "")
                held.needs_you(cur, hid, why, tries)
                return _public({**out, "held_id": hid})
            resp = _public(out)
            if key:
                cur.execute("""INSERT INTO idempotency_keys (key, tool, request_hash, response) VALUES (%s, 'log', %s, %s)
                               ON CONFLICT (key) DO NOTHING""", (key, hashlib.sha256(text.encode()).hexdigest(), Jsonb(resp)))
            asked = [q["question_id"] for q in resp.get("questions", [])]
            if asked:  # read again days later: its questions still get their full time to be answered
                cur.execute("UPDATE pending SET expires_at = greatest(expires_at, now() + make_interval(hours => %s)) WHERE id = ANY(%s)",
                            (record.QUESTION_HOURS, asked))
            held.done(cur, hid)
        return resp
    except Exception as e:  # noqa: BLE001 - whatever failed, the words stay kept for the next try
        kind = error_kind(e)  # an AI error says which (APITimeoutError, OverloadedError, ...), not just ProviderError
        _LOG.warning("message %s not read yet: %s", hid, kind)  # the kind only, never the words
        try:
            with connect() as conn, conn.cursor() as cur:
                held.failed(cur, hid, kind, tries)
                _audit(cur, "log", "held", {"held_id": hid, "error": kind, "tries": tries}, channel)
        except Exception:  # noqa: BLE001 - the database is down too: the 10-minute lease frees the message by itself
            pass
        reason = "The AI service did not answer." if isinstance(e, ProviderError) else "Something went wrong while saving it."
        return _public({"outcome": "held", "held_id": hid,
                        "reason": f"{reason} Your words are kept: the logger tries again by itself every 5 minutes for "
                                  f"{held.AUTO_HOURS} hours, and Today has a Try again button."})


def _read(text: str, now: datetime, prev: list, meals: list) -> tuple[list[dict], list]:
    """The AI's reading, with no transaction open: the small model, and the larger model's re-read when the first reading
    leaves a question (checked in a short look at the catalogue). -> (parser answers, usages)."""
    if privateline.label(text):  # fail closed: a private or gratitude line never goes to the AI (_read_held saves it before this)
        raise Reject("a private or gratitude line is never read by the AI")
    naive = now.replace(tzinfo=None)
    pred, u = parser.parse(provider(), text, naive, prev, meals)
    with connect() as conn, conn.cursor() as cur:
        unsettled = bool(record.best(cur, [pred], now).questions)
    if not unsettled:
        return [pred], [u]
    pred2, u2 = parser.parse(provider(), text, naive, prev, meals, model=record.ESCALATION_MODEL)
    return [pred, pred2], [u, u2]


def _process(cur, text: str, now: datetime, pred: Optional[dict] = None, channel: str = CHANNEL) -> dict:
    """Read, save and audit one message in the caller's transaction (a quick button's ready answer, or a repeated message
    the user confirmed); the caller makes it public."""
    if pred is None and privateline.label(text):  # e.g. "log it again?" answered yes: still saved without the AI
        return _private(cur, text, now, channel)
    started = time.monotonic()
    prev, meals = _context(cur, now)
    sent = todos.retry(cur, provider(), now)  # to-dos that waited because Todoist was down
    r, usages, escalated = record.read(cur, provider(), text, now, prev, meals, pred=pred)
    return _save(cur, text, now, r, usages + sent["usages"], escalated, channel, prev, sent, started=started)


def _private(cur, text: str, now: datetime, channel: str, tries: int = 0) -> dict:
    """A labelled message (privateline.py) saved straight into the private store, in the caller's transaction: no AI, no
    raw_inbox, no kept words, no to-dos or look-ups. A gratitude message gives one entry per line, all in this one call.
    The reply and the audit row hold ids and counts only, never the words."""
    started = time.monotonic()
    try:
        _kind, items = privateline.read(text)
    except privateline.Refused as e:
        _audit(cur, "log", "rejected", {"why": "private", "empty": e.empty, **({"tries": tries} if tries > 1 else {})}, channel)
        return {"outcome": "rejected", "raw_id": None, "reason": str(e), "questions": []}
    ids, receipt = [], []
    for line, p in items:
        r = record.settle(cur, {}, {}, p, now)  # a private answer needs no catalogue
        out = record.save(cur, r, line, channel, now)
        ids.append(out["private_id"])
        receipt += out["receipt"]
    _audit(cur, "log", "saved", {"raw_id": None, "private_id": ids[0], "private_ids": ids, "entries": len(ids), "ai": [],
                                 **({"tries": tries} if tries > 1 else {}), "secs": round(time.monotonic() - started, 2)}, channel)
    return {"outcome": "saved", "raw_id": None, "private_id": ids[0], "private_ids": ids, "receipt": receipt, "notes": [],
            "questions": []}


def _save(cur, text: str, now: datetime, r: record.Reading, usages: list, escalated: bool, channel: str, prev: list,
          sent: dict, tries: int = 0, started: Optional[float] = None) -> dict:
    """Save one read message with everything that follows from it (to-dos, look-ups, changes) and its audit row.
    started: when the work on it began (time.monotonic), so the audit row shows how long the message took ("secs")."""
    out = record.save(cur, r, text, channel, now)
    if r.pred.get("todos") and out.get("raw_id"):  # to-dos and shopping go to Todoist (v1's rules, in todos.py)
        t = todos.apply(cur, provider(), r.pred["todos"], out["raw_id"], now, text)
        usages += t["usages"]
        out["receipt"] = out.get("receipt", []) + t["receipt"]
        out["notes"] = out.get("notes", []) + t["notes"]
        asked = record._ask(cur, out["raw_id"], t["ask"], now)
        out["questions"] = out.get("questions", []) + asked
        if out["outcome"] in ("kept", "needs_choice"):
            out["outcome"] = "partly_saved" if t["receipt"] and asked else "saved" if t["receipt"] else "needs_choice" if asked else out["outcome"]
    usages += lookup.offer(cur, provider(), out, text)  # a food nothing in the catalogue fits: USDA or Open Food Facts
    if sent["receipt"] or sent["notes"]:
        out["notes"] = out.get("notes", []) + sent["receipt"] + sent["notes"]
    if out["outcome"] == "needs_confirmation":  # v1's read-back: keep the reading, the user's yes saves it
        pid = "p" + secrets.token_hex(4)
        nap = cycle.NAP_HINT in out["read_back"]  # a wake-up that may be a nap: yes = a new day, nap = a nap (05.11.2026)
        cur.execute("INSERT INTO pending (id, tool, payload, reason, expires_at) VALUES (%s, 'log_confirm', %s, %s, %s)",
                    (pid, Jsonb({"text": text, "pred": r.pred, "now": now.isoformat(), **({"nap": True} if nap else {})}),
                     out["read_back"][:500], now + timedelta(hours=record.QUESTION_HOURS)))
        out["questions"] = [{"pending_id": pid, "question": "A new day (yes), up from a nap or a night waking (nap), or not at all (no)?"
                             if nap else "Confirm this (yes), or correct it by logging again."}]
    if out["outcome"] == "not_logged" and out.get("intent") == "command":  # a look-up or a change
        out, used = commands.handle(cur, provider(), r.pred.get("command_text") or text, now, prev)
        usages += used
    elif r.pred.get("command_text") and out["outcome"] in ("saved", "partly_saved", "kept"):  # mixed: new entries + a change
        sub, used = commands.handle(cur, provider(), r.pred["command_text"], now, prev)
        usages += used
        out["command"] = sub
        out["questions"] = out.get("questions", []) + sub.get("questions", [])
    _audit(cur, "log", out["outcome"], {"raw_id": out.get("raw_id"), "private_id": out.get("private_id"),
                                        "questions": [q["pending_id"] for q in out.get("questions", [])], "escalated": escalated,
                                        "escalation": r.escalation, **({"tries": tries} if tries > 1 else {}),
                                        **({"secs": round(time.monotonic() - started, 2)} if started is not None else {}),
                                        "steps": out.get("steps") or out.get("command", {}).get("steps"), "ai": _ai(usages)}, channel)
    return out


def _confirm_food(cur, out: dict, args: dict, now: datetime) -> dict:
    """A new food waiting for the user's yes (a label, or odd values): keep the call, the yes repeats it."""
    pid = "p" + secrets.token_hex(4)
    cur.execute("INSERT INTO pending (id, tool, payload, reason, expires_at) VALUES (%s, 'add_food_confirm', %s, %s, %s)",
                (pid, Jsonb({**args, "code": out.get("code"), "now": now.isoformat()}), out["read_back"][:500],
                 now + timedelta(hours=record.QUESTION_HOURS)))
    out["questions"] = [{"pending_id": pid, "question": "Show the user these values; if they match the pack (or are right), "
                                                        "answer yes, otherwise call add_food again with the corrected values."}]
    return out


def add_food(name: str, values: dict, question_id: Optional[str] = None, aliases=()) -> dict[str, Any]:
    now = clock()
    with connect() as conn, conn.cursor() as cur:
        out = record.add_food(cur, name, values, "catalogue", now, question_id, aliases=list(aliases or []))
        if out["outcome"] == "needs_confirmation":
            out = _confirm_food(cur, out, {"name": name, "values": values, "question_id": question_id,
                                           "aliases": list(aliases or [])}, now)
        resp = _public(out)
        _audit(cur, "add_food", out["outcome"], {"food_id": out.get("food_id"), "question_id": question_id})
        return resp


def food_lookup(barcode: Optional[str] = None, name: Optional[str] = None, question_id: Optional[str] = None) -> dict[str, Any]:
    """A food looked up by barcode (Open Food Facts) or name (USDA and Open Food Facts); shown for the user's yes."""
    now = clock()
    with connect() as conn, conn.cursor() as cur:
        word = None
        if question_id:
            cur.execute("SELECT payload FROM pending WHERE id = %s AND tool = 'log' AND resolved_at IS NULL", (question_id,))
            q = cur.fetchone()
            if not q or q["payload"].get("kind") != "food":
                return _public({"outcome": "rejected", "reason": "there is no open food question with that id"})
            word = q["payload"]["item"]["food"]
        try:
            if barcode:
                cand, usages, why = lookup.by_barcode(cur, provider(), barcode)
            elif name:
                cand, usages, notes = lookup.by_name(cur, provider(), name, name, name)
                why = "nothing fitting found in USDA or Open Food Facts: send a label photo, or add it as an estimate"
            else:
                cand, usages, why = None, [], "give a barcode or a name"
        except lookup.FoodFactsError as e:
            cand, usages, why = None, [], f"{e}; try again later or send a label photo"
        except ProviderError:  # the AI that picks the entry did not answer: say so, like a food database that is down
            cand, usages, why = None, [], "The AI service did not answer; try again later or send a label photo"
        if not cand:
            out = {"outcome": "rejected", "reason": why}
        elif cand.get("existing"):
            out = lookup.accept(cur, cand, now, question_id, word)
        else:
            pid = "p" + secrets.token_hex(4)
            cur.execute("INSERT INTO pending (id, tool, payload, reason, expires_at) VALUES (%s, 'lookup_confirm', %s, %s, %s)",
                        (pid, Jsonb({"cand": cand, "question_id": question_id, "word": word, "now": now.isoformat()}),
                         cand["offer"][:500], now + timedelta(hours=record.QUESTION_HOURS)))
            out = {"outcome": "needs_confirmation", "read_back": cand["offer"] + ".",
                   "questions": [{"pending_id": pid, "question": "Show the user these values; add it (yes) or not (no)?"}]}
        resp = _public(out)
        _audit(cur, "food_lookup", out["outcome"], {"question_id": question_id, "barcode": bool(barcode), "ai": _ai(usages)})
        return resp


def lab_report(text: str, corrections: Optional[str] = None, source: str = "image") -> dict[str, Any]:
    """A report's text, structured and read back (labs.py); saved only after the user's yes."""
    now = clock()
    with connect() as conn, conn.cursor() as cur:
        usages = []
        try:
            rb, usages = labs.read_back(cur, provider(), text, now, source, corrections or "")
        except Reject as e:
            out = {"outcome": "rejected", "reason": str(e)}
        except ProviderError as e:
            out = {"outcome": "rejected", "reason": f"the report could not be read ({e}); try again"}
        else:
            pid = "p" + secrets.token_hex(4)
            cur.execute("INSERT INTO pending (id, tool, payload, reason, expires_at) VALUES (%s, 'report_confirm', %s, %s, %s)",
                        (pid, Jsonb({"report": rb["report"], "code": rb["code"], "text": text, "now": now.isoformat()}),
                         "lab report read-back", now + timedelta(hours=record.QUESTION_HOURS)))
            out = {"outcome": "needs_confirmation", "read_back": rb["read_back"],
                   "questions": [{"pending_id": pid, "question": "Is the whole table right (yes), or what is wrong?"}]}
        resp = _public(out)
        _audit(cur, "lab_report", out["outcome"], {"ai": _ai(usages)})  # no values
        return resp


def food_words(food_id: int, words: list, means: bool = False) -> dict[str, Any]:
    with connect() as conn, conn.cursor() as cur:
        out = record.add_words(cur, food_id, words, means)
        resp = _public(out)
        _audit(cur, "food_words", out["outcome"], {"food_id": food_id, "means": means})
        return resp


# answer(): one handler per kind of question (core item 16, 22.11.2026). A new kind is one handler and one entry, in
# FREE_ANSWERS when it takes a free answer (any reply, before the yes/no rule) or in YES_HANDLERS when it is a yes or no;
# its tool goes into ANSWER_TOOLS (tests/test_answer_order.py checks that the three agree).
@dataclass
class Answer:
    """One reply being answered, in answer()'s transaction: the open question's row (`pending`, locked) and id, the reply and
    whether it starts with a yes, where it came from, now, the cursor, and the AI calls the handler made (for the Usage page)."""
    p: dict
    question_id: str
    reply: str
    yes: bool
    channel: str
    now: datetime
    cur: Any
    used: list = field(default_factory=list)

    @property
    def payload(self) -> dict:
        return self.p["payload"]


class FreeAnswer(NamedTuple):
    """A kind that takes a free answer: for its tool, when matches(a), handle(a) answers instead of the yes/no rule.
    early: taken before the "already answered or expired" check, because the handler checks that itself (record.answer,
    in its own words: "that question does not exist, was already answered, or has expired")."""
    tool: str
    matches: Callable[[Answer], bool]
    handle: Callable[[Answer], dict]
    early: bool = False


def _log_item(a: Answer) -> dict:  # which food, how much (record.answer); a no or skip drops the item
    return record.answer(a.cur, a.question_id, a.reply, a.now)


def _log_lookup(a: Answer) -> dict:  # yes to a food found in USDA or Open Food Facts
    return lookup.accept(a.cur, a.payload["lookup"], a.now, a.question_id, a.payload["item"]["food"])


def _log_todo(a: Answer) -> dict:  # which shopping item was meant
    out = todos.answer(a.cur, provider(), a.p, a.reply, a.now)
    a.used = out.pop("usages", None) or []
    return out


def _home_choice(a: Answer) -> dict:  # which chore was meant (homechat.py)
    from . import homechat
    return homechat.answer(a.cur, a.p, a.reply, a.now)


def _command(a: Answer) -> dict:  # which entry was meant: read the request again with the answer
    prev, _ = _context(a.cur, a.now)
    out, a.used = commands.handle(a.cur, provider(), f"{a.payload['text']}\n(Asked: {a.p['reason']} Answer: {a.reply})", a.now, prev)
    a.cur.execute("UPDATE pending SET resolved_at = now(), resolution = 'confirmed' WHERE id = %s", (a.question_id,))
    return out


def _command_past(a: Answer) -> dict:  # change the past entries too (yes) or only new ones (no)
    out = commands.apply(a.cur, a.payload, a.now, past="yes" if a.yes else "no")
    if out["outcome"] == "changed":
        a.cur.execute("UPDATE pending SET resolved_at = now(), resolution = 'confirmed' WHERE id = %s", (a.question_id,))
    return out


def _log_confirm_nap(a: Answer) -> dict:  # the wake-up was a nap or night waking
    d = a.payload
    asked = datetime.fromisoformat(d["now"])
    r = record.settle(a.cur, _food_cat(a.cur), _types(a.cur)[1], record.as_nap(a.cur, d["pred"]), asked)
    out = record.save(a.cur, r, d["text"], a.channel, asked, confirmed=True)
    if out["outcome"] in ("saved", "partly_saved"):
        a.cur.execute("UPDATE pending SET resolved_at = now(), resolution = 'confirmed' WHERE id = %s", (a.question_id,))
    return out


# Checked in this order; the first whose tool and matches() fit answers.
FREE_ANSWERS = [
    FreeAnswer("log", lambda a: a.payload.get("kind") != "todo" and not (a.payload.get("lookup") and a.yes), _log_item, early=True),
    FreeAnswer("log", lambda a: bool(a.payload.get("lookup")), _log_lookup),
    FreeAnswer("log", lambda a: True, _log_todo),
    FreeAnswer("home_choice", lambda a: True, _home_choice),
    FreeAnswer("command", lambda a: True, _command),
    FreeAnswer("command_confirm", lambda a: bool(a.payload.get("ask_past") and (a.yes or re.match(r"^\s*(no|nein)\b", a.reply, re.I))),
               _command_past),
    FreeAnswer("log_confirm", lambda a: bool(a.payload.get("nap") and NAP.match(a.reply)), _log_confirm_nap),
]


def _report_confirm(a: Answer) -> dict:
    out = labs.save_report(a.cur, a.payload, a.now)
    if out["outcome"] == "saved":
        a.cur.execute("UPDATE pending SET resolved_at = now(), resolution = 'confirmed' WHERE id = %s", (a.question_id,))
    return out


def _lookup_confirm(a: Answer) -> dict:
    d = a.payload
    out = lookup.accept(a.cur, d["cand"], a.now, d.get("question_id"), d.get("word"))
    if out["outcome"] in ("saved", "partly_saved"):
        a.cur.execute("UPDATE pending SET resolved_at = now(), resolution = 'confirmed' WHERE id = %s", (a.question_id,))
    return out


def _command_confirm(a: Answer) -> dict:
    out = commands.apply(a.cur, a.payload, a.now)
    if out["outcome"] == "changed":
        a.cur.execute("UPDATE pending SET resolved_at = now(), resolution = 'confirmed' WHERE id = %s", (a.question_id,))
    return out


def _log_repeat(a: Answer) -> dict:
    out = _process(a.cur, a.payload["text"], a.now, None, a.channel)
    a.cur.execute("UPDATE pending SET resolved_at = now(), resolution = 'confirmed' WHERE id = %s", (a.question_id,))
    return out


def _add_food_confirm(a: Answer) -> dict:
    d = a.payload
    out = record.add_food(a.cur, d["name"], d["values"], a.channel, a.now, d["question_id"], food_code=d["code"],
                          confirmed=True, aliases=d.get("aliases") or [])
    if out["outcome"] == "saved":
        a.cur.execute("UPDATE pending SET resolved_at = now(), resolution = 'confirmed' WHERE id = %s", (a.question_id,))
    return out


def _log_confirm(a: Answer) -> dict:
    d = a.payload
    asked = datetime.fromisoformat(d["now"])
    r = record.settle(a.cur, _food_cat(a.cur), _types(a.cur)[1], d["pred"], asked)
    out = record.save(a.cur, r, d["text"], a.channel, asked, confirmed=True)
    if out["outcome"] in ("saved", "partly_saved"):
        a.cur.execute("UPDATE pending SET resolved_at = now(), resolution = 'confirmed' WHERE id = %s", (a.question_id,))
    return out


# A yes to a question no free answer took.
YES_HANDLERS: dict[str, Callable[[Answer], dict]] = {
    "report_confirm": _report_confirm, "lookup_confirm": _lookup_confirm, "command_confirm": _command_confirm,
    "log_repeat": _log_repeat, "add_food_confirm": _add_food_confirm, "log_confirm": _log_confirm}


def answer(question_id: str, reply: str, channel: str = CHANNEL) -> dict[str, Any]:
    """The owner's reply to one open question (Today, the chat's answer tool, the door). In this order: a question that is
    not one answer takes is refused; an early free answer (a food or amount question) checks the question itself; else an
    answered or expired question is refused; a free answer of its kind (FREE_ANSWERS); a clear no cancels; an unclear reply
    keeps the question open; a yes goes to its kind's handler (YES_HANDLERS)."""
    now = clock()
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT * FROM pending WHERE id = %s FOR UPDATE", (question_id,))
        p = cur.fetchone()
        if not p or p["tool"] not in ANSWER_TOOLS:
            _audit(cur, "answer", "rejected", {"why": "unknown question"}, channel)
            return {"outcome": "rejected", "message": "There is no such open question."}
        a = Answer(p, question_id, reply, bool(YES.match(reply)), channel, now, cur)
        free = next((f for f in FREE_ANSWERS if f.tool == p["tool"] and f.matches(a)), None)
        if free and free.early:
            out = free.handle(a)
        elif p["resolved_at"] is not None or p["expires_at"] < now:
            out = {"outcome": "rejected", "reason": "that question was already answered or has expired"}
        elif free:
            out = free.handle(a)
        elif NO.match(reply):
            cur.execute("UPDATE pending SET resolved_at = now(), resolution = 'cancelled' WHERE id = %s", (question_id,))
            out = {"outcome": "cancelled"}
        elif not a.yes:  # unclear: keep the question open
            out = {"outcome": "needs_confirmation", "reason": "answer yes to save it, or no to drop it",
                   "questions": [{"pending_id": question_id, "question": "Yes or no?"}]}
        else:
            out = YES_HANDLERS[p["tool"]](a)
        if "question" in out and "questions" not in out:  # a follow-up question about the same item
            out["questions"] = [{"pending_id": question_id, "question": out.pop("question")}]
        resp = _public(out)
        _audit(cur, "answer", out["outcome"], {"question_id": question_id, "raw_id": out.get("raw_id"), "steps": out.get("steps"),
                                               **({"ai": _ai(a.used)} if a.used else {})}, channel)
        return resp

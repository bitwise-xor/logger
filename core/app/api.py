"""The JSON door for the new front end (16.11.2026, deploys 75, 76 and 77; plan in the doc's Current tab, "New front end"; routes
and shapes in docs/API.md). Only the front end's own server calls it, from inside Docker: Caddy never forwards /api/ (its
app. site passes / and /web/* only) and the tunnel's calls carry Cloudflare's headers. Every route goes through one check
(route below), in this order, and each failure looks the same (404), so the door's existence is not revealed:
  1. the door is on: FRONT_TOKEN is set, 32 characters or more (config.py; unset = every path here answers 404);
  2. the call comes from inside Docker: Host logger-v2-core:8000, no Cloudflare or proxy headers;
  3. the front end's service token in X-Front-Token (compared on SHA-256 digests, in constant time);
then, for every route but the sign-in, the owner's session as "Authorization: Bearer <token>" (a web_sessions row of this
front end, migration 031; a session of app. never works here and the reverse). A session renews like a page view (30 days
from its last use); the end comes back in the X-Session-Expires header. Every answer is JSON with "v": 1, never cached.
The reads are reads.py; the saves call the same functions as the live forms (webactions, webfood, logbook, webundo, webheld)."""
import hashlib
import hmac
import json
import logging
import re
from datetime import date, datetime, timedelta, timezone

from psycopg.types.json import Jsonb
from starlette.concurrency import run_in_threadpool
from starlette.requests import Request
from starlette.responses import JSONResponse

from . import hubtools, logbook, privateline, reads, web, webactions, webentry, webfood, webheld, webundo
from .ai.provider import ProviderError
from .config import FRONT_TOKEN
from .db import connect

log = logging.getLogger("logger.api")
V = 1
FRONT = "logger"  # web_sessions.front of this front end's sessions
PREFIX = "/api/v1"
HOSTS = ("logger-v2-core:8000",)  # the core's name and port on the Docker network
TOKEN_MIN = 32
MAX_BODY = 64 * 1024
# Headers that mark a call that came through Cloudflare or a proxy (Caddy adds the X-Forwarded ones): never the front end's server
PROXIED = ("cf-ray", "cf-connecting-ip", "cf-visitor", "x-forwarded-for", "x-forwarded-host", "x-forwarded-proto", "forwarded",
           "x-real-ip")
_HEADERS = {"Cache-Control": "no-store", "X-Content-Type-Options": "nosniff"}
_ROUTES: list = []


class Refused(Exception):
    """A request the door answers with an error: HTTP status, a short code for the front end, a plain message."""

    def __init__(self, status: int, code: str, message: str):
        super().__init__(message)
        self.status, self.code, self.message = status, code, message


def reply(body: dict, status: int = 200, session=None) -> JSONResponse:
    headers = dict(_HEADERS)
    if session and session.get("expires_at"):
        headers["X-Session-Expires"] = session["expires_at"].astimezone(timezone.utc).isoformat()
    return JSONResponse({"v": V, **body}, status_code=status, headers=headers)


def error(status: int, code: str, message: str) -> JSONResponse:
    return reply({"error": code, "message": message}, status)


NOT_FOUND = (404, "not_found", "Not found.")


# ---- the checks ------------------------------------------------------------------------------------------

def door_open() -> bool:
    return len(FRONT_TOKEN) >= TOKEN_MIN


def from_inside(request: Request) -> bool:
    host = request.headers.get("host", "").lower()
    return host in HOSTS and not any(h in request.headers for h in PROXIED)


def token_ok(request: Request) -> bool:
    sent = request.headers.get("x-front-token", "")
    return bool(sent) and hmac.compare_digest(hashlib.sha256(sent.encode()).digest(), hashlib.sha256(FRONT_TOKEN.encode()).digest())


def bearer(request: Request) -> str:
    kind, _, token = request.headers.get("authorization", "").partition(" ")
    return token.strip() if kind.lower() == "bearer" and 20 <= len(token.strip()) <= 200 else ""


def session_for(token: str):
    """The front end's session for this bearer token, seen now and renewed like a page view (web._renew: once a day the end
    moves to SESSION_DAYS from now); None when there is none (signed out, expired, or a session of app.)."""
    with connect() as c:
        row = c.execute("SELECT * FROM web_sessions WHERE token_hash = %s AND expires_at > now() AND front = %s",
                        (web._h(token), FRONT)).fetchone()
        if not row:
            return None
        renew = row["expires_at"] <= datetime.now(timezone.utc) + timedelta(days=web.SESSION_DAYS - 1)
        r = c.execute(f"""UPDATE web_sessions SET last_seen = now()
                          {", expires_at = now() + make_interval(days => %s)" if renew else ""}
                          WHERE token_hash = %s RETURNING expires_at""",
                      ((web.SESSION_DAYS, row["token_hash"]) if renew else (row["token_hash"],))).fetchone()
    return {**row, "expires_at": r["expires_at"]}


def route(path: str, method: str, signed_in: bool = True):
    """Register a door route: fn(request, body, session) -> dict (or (dict, status)), run off the event loop. The checks of the
    module's docstring come first; a Refused becomes its JSON error; any other error a plain 500 (the kind goes to the log,
    never what was sent)."""
    def wrap(fn):
        async def handler(request: Request):
            if not (door_open() and from_inside(request) and token_ok(request)):
                return error(*NOT_FOUND)
            session = None
            if signed_in:
                tok = bearer(request)
                session = await run_in_threadpool(session_for, tok) if tok else None
                if not session:
                    return error(401, "signed_out", "Sign in first.")
            body: dict = {}
            if method in ("POST", "DELETE"):
                raw = await request.body()
                if len(raw) > MAX_BODY:
                    return error(413, "too_large", "The request is too large.")
                if raw.strip():
                    try:
                        body = json.loads(raw)
                    except ValueError:
                        body = None
                    if not isinstance(body, dict):
                        return error(400, "bad_request", "Send a JSON object.")
            try:
                out = await run_in_threadpool(lambda: fn(request, body, session))
            except Refused as e:
                return error(e.status, e.code, e.message)
            except Exception as e:  # noqa: BLE001 - the kind only
                log.error("the door's %s %s failed: %s", method, path, type(e).__name__)
                return error(500, "server_error", "Something went wrong. Nothing was lost; try again in a moment.")
            out, status = out if isinstance(out, tuple) else (out, 200)
            return reply(out, status, session)
        _ROUTES.append((PREFIX + path, method, handler))
        return fn
    return wrap


def add_routes(mcp) -> None:
    for path, method, handler in _ROUTES:
        mcp.custom_route(path, methods=[method])(handler)


# ---- small readers of the request ---------------------------------------------------------------------------

def text(body: dict, name: str, limit: int, required: bool = False) -> str:
    v = body.get(name)
    if v is None or v == "":
        if required:
            raise Refused(400, "bad_request", f"{name} is missing.")
        return ""
    if not isinstance(v, (str, int, float)) or isinstance(v, bool):
        raise Refused(400, "bad_request", f"{name} must be text.")
    return str(v)[:limit]


def day_param(request: Request):
    """?day=yyyy-mm-dd, or None for today (a day after today is today, as on the pages)."""
    raw = request.query_params.get("day", "")
    if not raw:
        return None
    try:
        return date.fromisoformat(raw[:10])
    except ValueError:
        raise Refused(400, "bad_request", "day must be yyyy-mm-dd.") from None


# ---- sign-in ---------------------------------------------------------------------------------------------------

@route("/session", "POST", signed_in=False)
def sign_in(request, body, _session):
    """Password and authenticator code, with the same checks, failure limits and trusted devices as /web/login (web.sign_in).
    device: the token the front end keeps for this browser (a trusted device counts its own failed tries); user_agent: the
    browser's, for Settings > Devices. -> the session token (stored hashed), the device token to keep, the session's end."""
    out = web.sign_in(text(body, "password", 1000), text(body, "code", 20), text(body, "device", 100) or None,
                      text(body, "user_agent", 300), front=FRONT)
    if not out["ok"]:
        raise Refused(out["status"], "too_many_tries" if out["status"] == 429 else "wrong_credentials", out["message"])
    return {"token": out["token"], "device": out["device_token"],
            "expires_at": out["expires_at"].astimezone(timezone.utc).isoformat()}, 201


@route("/session", "GET")
def session_info(_request, _body, session):
    return {"signed_in": True, "sid": str(session["sid"]), "expires_at": session["expires_at"].astimezone(timezone.utc).isoformat()}


@route("/session", "DELETE")
def sign_out(_request, _body, session):
    with connect() as c:
        c.execute("DELETE FROM web_sessions WHERE token_hash = %s AND front = %s", (session["token_hash"], FRONT))
    return {"outcome": "signed_out"}


# ---- reads -------------------------------------------------------------------------------------------------------

@route("/day", "GET")
def day(request, _body, session):
    """The day, and the session's Undo while it lasts (the same as in the last save's answer: a reload keeps the Undo bar)."""
    return {"day": reads.day(day_param(request)), "undo": _undo_out(session.get("undo"))}


@route("/food/day", "GET")
def food_day(request, _body, session):
    return {"food_day": reads.food_day(day_param(request)), "undo": _undo_out(session.get("undo"))}


@route("/usual", "GET")
def usual_list(_request, _body, session):
    """Every usual meal and drink with its foods (deploy 86, the usual-meal editor), and the session's Undo."""
    return {"usual": reads.usual(), "undo": _undo_out(session.get("undo"))}


@route("/foods", "GET")
def foods(request, _body, _session):
    """Up to 20 active foods for ?q= (the Catalogue's search), to pick a food for a usual meal."""
    return {"foods": reads.foods(request.query_params.get("q", ""))}


@route("/food/entry", "GET")
def food_entry(request, _body, _session):
    e = reads.food_entry(request.query_params.get("ref", "")[:12])
    if e is None:
        raise Refused(404, "no_entry", "That entry is not there any more.")
    return {"entry": e}


# ---- saves (deploy 76) -------------------------------------------------------------------------------------------
# Each save calls the same function as the live form (webactions, webfood, logbook, webundo), passes the re-send key where that
# function takes one, and answers in one shape (saved below): outcome, tone, head, receipt, notes, reason, questions, read_back,
# confirm, result, refill, replayed, undo, plus the fresh day ("day", Today) or food day ("food_day", the Food page), so a page can
# update in place. The body's "view" ("day" or "food") and "view_day" (yyyy-mm-dd; not "day", which the check-in saves to)
# choose which. The Undo record is kept in the session row, one per session, as the web app keeps one per device.

class Form(dict):
    """A JSON body as the live forms' functions read a form: .get(name), and .multi_items() (webfood._again)."""

    def multi_items(self):
        return list(self.items())


def _form(**fields) -> Form:
    """Only the fields that were sent, as text (a form sends text; None = not sent)."""
    return Form({k: ("1" if v is True else str(v)) for k, v in fields.items() if v not in (None, "", False)})


def _work(fn) -> dict:
    """web._run's rule, in the request's thread: an AI that does not answer, or any other error, is a refusal that says nothing
    was saved (a typed message is kept before the AI reads it, held.py); the kind of error goes to the log only."""
    try:
        return fn()
    except Refused:
        raise
    except ProviderError as e:
        log.warning("the AI service did not answer (%s)", type(e).__name__)
        return {"outcome": "rejected", "reason": "The AI service did not answer. Nothing was saved; try again in a moment."}
    except Exception as e:  # noqa: BLE001 - the kind only, never what was sent
        log.error("a door save failed: %s", type(e).__name__)
        return {"outcome": "rejected", "reason": "Something went wrong (the database or a service did not answer). Nothing was saved; try again in a moment."}


def _key(body: dict):
    return text(body, "key", 64) or None


# Every outcome a save can answer with; a warning is drawn as one on app. (webentry.reply_html), the rest are fine.
OUTCOMES = ("saved", "partly_saved", "changed", "removed", "answered", "unchanged", "kept", "cancelled",
            "held", "needs_confirmation", "needs_choice", "not_logged", "rejected")
WARNINGS = ("rejected", "needs_confirmation", "needs_choice", "not_logged", "held")


def _command_text(sub) -> str | None:
    """A mixed line's look-up or change (logbook: out["command"]) as plain lines: what it did, what it found."""
    if not sub:
        return None
    lines = [webentry._HEAD.get(sub.get("outcome"), sub.get("outcome") or ""), *(str(x) for x in sub.get("receipt") or []),
             sub.get("result"), reads.plain(sub.get("read_back")), sub.get("reason")]
    return "\n".join(str(x) for x in lines if x) or None


def _undo_out(rec) -> dict | None:
    if not webundo.fresh(rec):
        return None
    ends = datetime.fromtimestamp(float(rec["at"]) + webundo.MAX_AGE_S, timezone.utc)
    return {"token": rec["token"], "head": rec.get("head") or "Saved.", "expires_at": ends.isoformat()}


def saved(session, out: dict, body: dict, view: str = "day", private: bool = False) -> dict:
    """The one answer of every save. private: the words were a private or gratitude line: no receipt, notes or result.
    A save that made a private entry (a label, or the AI filed it so) is answered "Saved privately." and nothing more."""
    replace, new = webundo.settle(out)  # takes the rows before a change out of out (kept for Undo, never sent)
    if replace:
        with connect() as c:
            c.execute("UPDATE web_sessions SET undo = %s WHERE token_hash = %s", (Jsonb(new) if new else None, session["token_hash"]))
    rec = new if replace else session.get("undo")
    o = out.get("outcome", "rejected")
    head = webentry._HEAD["replayed"] if out.get("replayed") else out.get("head") or webentry._HEAD.get(o, o)
    if o == "rejected" and out.get("steps"):  # a change that matched nothing (webentry.reply_html)
        head = "Nothing changed."
    made_private = bool(out.get("private_id") or out.get("private_ids"))
    if (made_private or private and o == "saved") and not out.get("replayed"):
        head = "Saved privately."
    reason = out.get("reason") or (reads.plain(out.get("message")) if o == "rejected" and not out.get("receipt") else None)
    if made_private:
        private, reason = True, None if o != "rejected" else reason
    result = "\n\n".join(x for x in (str(out["result"]) if out.get("result") else None, _command_text(out.get("command"))) if x) or None
    refill = out.get("retry_text") or None  # Try again on a message not read yet: its words go back in the log box
    texts = [*(out.get("receipt") or []), *(out.get("notes") or []), result, out.get("read_back"), reason, refill]
    if not private and reads.names_private(*texts):  # a look-up or change of private entries typed here: no words (fail closed)
        private, reason = True, reads.HIDDEN
    if refill and privateline.label(refill):
        refill = None
    c = out.get("confirm")
    res = {"outcome": o, "tone": "warning" if o in WARNINGS else "ok", "head": head,
           "receipt": [] if private else [str(x) for x in out.get("receipt") or []],
           "notes": [] if private else [str(x) for x in out.get("notes") or []],
           "reason": reason or None,
           # the new questions in full (reads.question), never the chat app's wording; also when the page shown is Food
           "questions": reads.questions([q.get("question_id") or q.get("pending_id") for q in out.get("questions") or []]),
           "read_back": reads.plain(out["read_back"]) if out.get("read_back") and not private else None,
           # a change the logger read back first: send the same request again with "confirmed": true
           "confirm": {"label": c.get("label", "Yes"), "no_label": c.get("no_label", "No")} if c else None,
           "result": None if private else result,
           "refill": {"label": "Log again", "text": refill} if refill and not private else None,
           "replayed": bool(out.get("replayed")), "undo": _undo_out(rec)}
    try:
        asked = date.fromisoformat(str(body.get("view_day") or "")[:10]) if body.get("view_day") else None
    except ValueError:
        asked = None
    shown = body.get("view") or view
    if shown == "food":
        res["food_day"] = reads.food_day(asked)
    elif shown == "usual":  # the usual-meal editor (deploy 86): every usual meal, as GET /usual
        res["usual"] = reads.usual()
    else:
        res["day"] = reads.day(asked)
    return res


@route("/log", "POST")
def log_line(_request, body, session):
    """A typed line, read as /web/log reads it (logbook.log, synchronous: up to the AI's wait, then "held" with the words kept).
    A line with a private or gratitude label is saved without the AI and answered without its words."""
    words = text(body, "text", webentry.MAX_TEXT).strip()
    out = _work(lambda: logbook.log(words, _key(body), channel=logbook.WEB))
    return saved(session, out, body, private=bool(privateline.label(words)))


@route("/again", "POST")
def again(_request, body, session):
    """An Again chip: food_id, amount (in the food's unit), time hh:mm or none (= now)."""
    f = _form(food=text(body, "food_id", 12), amount=text(body, "amount", 20), time=text(body, "time", 5))
    return saved(session, _work(lambda: webfood.again(f, _key(body))), body)


@route("/usual", "POST")
def usual(_request, body, session):
    """A usual meal: every item with its saved amount, now (Today's one tap); or items [{"item_id", "amount"}] (only those are
    logged, with these amounts) and time hh:mm, as the meal's form on Today."""
    meal = text(body, "meal_id", 12, required=True)
    items = body.get("items")
    if items is None:
        f = _form(quick="1")
    else:
        if not isinstance(items, list) or not all(isinstance(i, dict) for i in items):
            raise Refused(400, "bad_request", "items must be a list of {item_id, amount}.")
        fields = {}
        for i in items[:50]:
            iid = text(i, "item_id", 12)
            fields[f"on_{iid}"] = "1"
            fields[f"g_{iid}"] = text(i, "amount", 20)
        f = _form(time=text(body, "time", 5), **fields)
    return saved(session, _work(lambda: webactions.usual(meal, f, _key(body))), body)


@route("/water", "POST")
def water(_request, body, session):
    """The water bar's glass (ml left out = 250 ml), or ml from 50 to 2000 (as the hub's add_water)."""
    ml = body.get("ml")
    lo, hi = hubtools.WATER_ML
    if ml is not None and (not isinstance(ml, int) or isinstance(ml, bool) or not lo <= ml <= hi):
        out = webactions._rejected(f"Give the water in ml, from {lo} to {hi}.")
    else:
        out = _work(lambda: webfood.water({}, _key(body), ml))
    return saved(session, out, body)


@route("/habit", "POST")
def habit(_request, body, session):
    """Tick a habit, or untick: the tick ref (e<id>, the day's last_tick) or, without one, today's last tick of it."""
    name, action = text(body, "name", 64, required=True), text(body, "action", 10)
    if action not in ("tick", "untick"):
        raise Refused(400, "bad_request", "action must be tick or untick.")
    eid = ""
    if action == "untick":
        ref = text(body, "ref", 20)
        if ref:
            if not re.fullmatch(r"e\d{1,12}", ref):
                raise Refused(400, "bad_request", "ref must be e<id>.")
            eid = ref[1:]
        else:
            with connect() as c:  # today's last tick of it, the one Today's button sends (hubtools.untick_habit)
                r = c.execute("""SELECT e.id FROM events e JOIN log_types t ON t.id = e.type_id
                                 WHERE t.name = %s AND e.day = log_day(now()) ORDER BY e.event_at DESC, e.id DESC LIMIT 1""", (name,)).fetchone()
            eid = str(r["id"] if r else 0)
    return saved(session, _work(lambda: webactions.habit(name, action, eid, _key(body))), body)


@route("/checkin", "POST")
def checkin(_request, body, session):
    """Mood or energy, 1 to 5; day: yesterday's, while the check-in asks about it (needs.checkin.day)."""
    f = _form(type=text(body, "type", 10), value=text(body, "value", 3), day=text(body, "day", 10))
    return saved(session, _work(lambda: webactions.checkin(f, _key(body))), body)


@route("/health", "POST")
def health(_request, body, session):
    """A Health card row (row: bed, wake, weight, sugar, bp_morning, bp_evening): v1 (blood pressure: v1 upper, v2 lower), or
    time hh:mm for bed and wake-up; ref = the entry to correct (the card row's ref). confirmed: true
    after a read-back."""
    row, ref = text(body, "row", 20, required=True), text(body, "ref", 20)
    f = _form(t=text(body, "time", 5), v1=text(body, "v1", 20), v2=text(body, "v2", 20), confirmed=body.get("confirmed") is True)
    return saved(session, _work(lambda: webactions.health(row, ref, f, _key(body))), body)


@route("/answer", "POST")
def answer(_request, body, session):
    """An answer to an open question: reply = one of its answers' reply, or typed words (logbook.answer; it takes no key)."""
    qid, words = text(body, "question_id", 64), text(body, "reply", webentry.MAX_REPLY).strip()
    if not qid or not words:
        out = {"outcome": "rejected", "reason": "Type an answer first."}
    else:
        out = _work(lambda: logbook.answer(qid, words, channel=logbook.WEB))
    return saved(session, out, body)


@route("/review", "POST")
def review(_request, body, session):
    """"Looks right": action "ok" with ref (one item), or action "all" with refs (the items shown; webactions.review_all)."""
    act = text(body, "action", 5)
    if act == "ok":
        ref = text(body, "ref", 20, required=True)
        out = _work(lambda: webactions.review(ref, "ok", Form()))
    elif act == "all":
        refs = body.get("refs")
        if not isinstance(refs, list) or not all(isinstance(r, str) for r in refs):
            raise Refused(400, "bad_request", "refs must be a list of refs.")
        out = _work(lambda: webactions.review("", "all", Form(refs=" ".join(refs)[:webactions.REVIEW_LIMIT * 12])))
    else:
        raise Refused(400, "bad_request", "action must be ok or all.")
    return saved(session, out, body)


@route("/food/entry", "POST")
def food_entry_save(_request, body, session):
    """Change (action "save": amount, unit, time hh:mm, food_name) or delete (action "delete") a food entry, made at once with
    Undo, as on the Food page (webfood.entry). An odd value is read back first: then send it again with "confirmed": true."""
    act = text(body, "action", 10)
    if act not in ("save", "delete"):
        raise Refused(400, "bad_request", "action must be save or delete.")
    f = _form(id=text(body, "ref", 12), act=act, amount=text(body, "amount", 20), unit=text(body, "unit", 40), time=text(body, "time", 5),
              food_name=text(body, "food_name", 200), confirmed=body.get("confirmed") is True, back="/web/food")
    return saved(session, _work(lambda: webfood.entry(f, _key(body))), body, view="food")


@route("/food/note", "POST")
def food_note(_request, body, session):
    """A food entry's note (empty = removed)."""
    f = _form(id=text(body, "ref", 12), note=text(body, "note", 300))
    return saved(session, _work(lambda: webfood.note(f, _key(body))), body, view="food")


@route("/undo", "POST")
def undo(_request, body, session):
    """Undo the session's last save: the token of its answer's undo (one per session, for 15 minutes, as the Undo bar)."""
    rec = session.get("undo") or {}
    if not webundo.matches(rec, body.get("token")):
        out = {"outcome": "rejected", "head": "Nothing undone.", "reason": "There is nothing to undo any more."}
    else:
        out = _work(lambda: webundo.apply(rec))
    return saved(session, out, body)


# ---- messages not read yet (deploy 77) ------------------------------------------------------------------------------
# Try again and Delete on day.needs.not_read, through the functions of app.'s two buttons (webheld.ACTIONS).

def _held_form(body: dict) -> Form:
    hid = body.get("id")
    if not isinstance(hid, int) or isinstance(hid, bool) or hid <= 0:
        raise Refused(400, "bad_request", "id must be the message's id (a number).")
    return Form(id=str(hid))


@route("/held/retry", "POST")
def held_retry(_request, body, session):
    """Read a message not read yet now (logbook.read_held, synchronous like /log). Nothing saved: its words come back in
    refill, for the log box."""
    f = _held_form(body)
    return saved(session, _work(lambda: webheld.retry(f, _key(body))), body)


@route("/held/delete", "POST")
def held_delete(_request, body, session):
    """Delete a message not read yet, with Undo (the message comes back)."""
    f = _held_form(body)
    return saved(session, _work(lambda: webheld.delete(f, _key(body))), body)


# ---- usual meals (deploy 86) ------------------------------------------------------------------------------------------
# The editor of app.'s Food › Usual meals: change or delete one (webfood.usual_meal), make one from foods (webfood.usual_create)
# or from a logged meal (webfood.usual_new). The front end saves at once ("confirmed": true) with Undo; a key saves once.

MAX_ITEMS = 40  # webfood.MAX_ROWS: the most foods a usual meal's editor sends


def _int(body: dict, name: str, low: int = 1) -> int:
    v = body.get(name)
    if not isinstance(v, int) or isinstance(v, bool) or not low <= v < 10**9:
        raise Refused(400, "bad_request", f"{name} must be a number.")
    return v


def _items(body: dict, most: int) -> list:
    """items: [{food_id, amount}] as the form's numbered rows (food_k, g_k), in this order."""
    items = body.get("items")
    if not isinstance(items, list) or not all(isinstance(i, dict) for i in items):
        raise Refused(400, "bad_request", "items must be a list of {food_id, amount}.")
    if len(items) > most:
        raise Refused(400, "bad_request", f"At most {most} foods.")
    rows = []
    for i in items:
        amount = i.get("amount")
        if not isinstance(amount, (int, float)) or isinstance(amount, bool):
            raise Refused(400, "bad_request", "Each food needs its amount as a number.")
        rows.append((_int(i, "food_id"), amount))
    return rows


@route("/usual/meal", "POST")
def usual_meal(_request, body, session):
    """Change a usual meal (action "save": name and the whole list of items, in order) or delete it (action "delete").
    "confirmed": true makes it at once with Undo (the front end's way); without it the change is read back first, as on app."""
    act = text(body, "action", 10)
    if act not in ("save", "delete"):
        raise Refused(400, "bad_request", "action must be save or delete.")
    fields = {"id": f"U{_int(body, 'meal_id')}", "act": act, "confirmed": body.get("confirmed") is True}
    if act == "save":
        rows = _items(body, MAX_ITEMS)
        fields.update(name=text(body, "name", 200), rows=str(len(rows)))
        for k, (fid, amount) in enumerate(rows):
            fields[f"food_{k}"], fields[f"g_{k}"] = str(fid), str(amount)
    f = _form(**fields)
    return saved(session, _work(lambda: webfood.usual_meal(f, _key(body))), body, view="usual")


@route("/usual/new", "POST")
def usual_new(_request, body, session):
    """A new usual meal or drink from foods: name, drink (true or false), items [{food_id, amount}], 1 to 8 (as app.)."""
    rows = _items(body, webfood.NEW_ROWS)
    drink = body.get("drink", False)
    if not isinstance(drink, bool):
        raise Refused(400, "bad_request", "drink must be true or false.")
    fields = {"name": text(body, "name", 200), "kind": "drink" if drink else "meal"}
    for k, (fid, amount) in enumerate(rows):
        fields[f"food_{k}"], fields[f"g_{k}"] = f"N{fid}", str(amount)
    f = _form(**fields)
    return saved(session, _work(lambda: webfood.usual_create(f, _key(body))), body, view="usual")


@route("/usual/from_meal", "POST")
def usual_from_meal(_request, body, session):
    """A logged meal saved as a usual meal: day (yyyy-mm-dd), meal (1, 2, ...; not 0, the drinks), name. Answers with the Food day."""
    f = _form(day=text(body, "day", 10, required=True), meal=str(_int(body, "meal", 0)), name=text(body, "name", 200))
    return saved(session, _work(lambda: webfood.usual_new(f, _key(body))), body, view="food")

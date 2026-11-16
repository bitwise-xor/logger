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
The reads are reads.py; the saves call the same functions as the live forms (webactions, webfood, logbook, webundo, webheld, gym)."""
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

from . import body as tape, gym, gympage, habitspage, healthpage, hubtools, labelread, logbook, privateline, reads, web, webactions, webentry, webfood, webhabits, webheld, webundo
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


def route(path: str, method: str, signed_in: bool = True, photos: bool = False):
    """Register a door route: fn(request, body, session) -> dict (or (dict, status)), run off the event loop. The checks of the
    module's docstring come first; a Refused becomes its JSON error; any other error a plain 500 (the kind goes to the log,
    never what was sent). photos: the body is multipart with one to three photos (body = {"photos": [(type, bytes)]}, see
    _photos), not JSON; only this route may be larger than MAX_BODY (deploy 89, the label photo)."""
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
            if photos:
                try:
                    body = await _photos(request)
                except Refused as e:
                    return error(e.status, e.code, e.message)
            elif method in ("POST", "DELETE"):
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


# The label photo's body (deploy 89): multipart/form-data with the field "photo" one to three times, each JPEG, PNG, WebP or GIF of
# at most 8 MB (labelread). The whole body may be three photos and a little form around them; a larger one is cut off while it
# is read (also without a Content-Length) and answered 413.
MAX_PHOTO_BODY = labelread.MAX_PHOTOS * labelread.MAX_BYTES + MAX_BODY
PHOTO_TYPES = "JPEG, PNG, WebP or GIF"


class _TooLarge(Exception):
    pass


async def _photos(request: Request) -> dict:
    """-> {"photos": [(media type, bytes)]}, or a Refused: 400 bad_request (not multipart, no photo, four or more, another kind of
    file, an empty one), 413 too_large (a photo over 8 MB, or the whole body over MAX_PHOTO_BODY). The photos are kept for this
    request only (above 1 MB in Starlette's temporary file, removed when the form is closed) and never stored."""
    big = Refused(413, "too_large", f"A photo is too large: at most {labelread.MAX_BYTES // (1024 * 1024)} MB each, {labelread.MAX_PHOTOS} photos.")
    try:
        sent = int(request.headers.get("content-length") or 0)
    except ValueError:
        sent = 0
    if sent > MAX_PHOTO_BODY:
        raise big
    if not request.headers.get("content-type", "").lower().startswith("multipart/form-data"):
        raise Refused(400, "bad_request", "Send the photos as multipart/form-data, in the field photo.")
    seen = 0

    async def receive():
        nonlocal seen
        msg = await request.receive()
        seen += len(msg.get("body", b""))
        if seen > MAX_PHOTO_BODY:
            raise _TooLarge
        return msg

    try:
        form = await Request(request.scope, receive).form(max_files=labelread.MAX_PHOTOS + 1, max_fields=10)
    except _TooLarge:
        raise big from None
    except Exception:  # noqa: BLE001 - a body that is not readable multipart, or five files or more
        raise Refused(400, "bad_request", f"Send one to {labelread.MAX_PHOTOS} photos in the field photo.") from None
    try:
        files = form.getlist("photo")
        if not files or not all(hasattr(f, "read") for f in files):
            raise Refused(400, "bad_request", "No photo came with the request.")
        if len(files) > labelread.MAX_PHOTOS:
            raise Refused(400, "bad_request", f"At most {labelread.MAX_PHOTOS} photos.")
        out = []
        for f in files:
            kind = (f.content_type or "").split(";")[0].strip().lower()
            if kind not in labelread.TYPES:
                raise Refused(400, "bad_request", f"A photo must be {PHOTO_TYPES}.")
            data = await f.read(labelread.MAX_BYTES + 1)
            if len(data) > labelread.MAX_BYTES:
                raise big
            if not data:
                raise Refused(400, "bad_request", "A photo is empty.")
            out.append((kind, data))
        return {"photos": out}
    finally:
        await form.close()


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
    elif shown == "health":  # the Health page (deploy 91), as GET /health with the body's range and all
        res["health"] = reads.health(_range(body.get("range"), strict=False), body.get("all") is True)
    elif shown == "body":  # the body card (deploy 91), as GET /body of view_day
        res["body"] = reads.body(asked, _range(body.get("range"), strict=False))
    elif shown == "habits":  # the Habits page (deploy 93), as GET /habits with the body's show (tracked when not given or unknown)
        res["habits"] = reads.habits(body.get("show") if isinstance(body.get("show"), str) else "tracked")
    elif shown in GYM_VIEWS:  # the Gym's Workout, Plan or Exercises tab (deploy 95), as its GET
        res[shown] = GYM_VIEWS[shown]()
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


# ---- scan, label photo and look-up (deploy 89) -------------------------------------------------------------------------------
# app.'s scanner on Today and its "Look it up", through the same functions: the catalogue food of a barcode (webfood.scanned), Open
# Food Facts' values to check (webfood.off_values), one to three label photos read in one AI call (labelread.read, the cost in the
# audit log, no photo kept), the checked values added to the catalogue and logged (webfood.label_add), and a food looked up by name
# or barcode and read back with yes or no (webfood.look_up -> logbook.food_lookup; the answer through /answer). A scanned food that
# is in the catalogue is logged through /again.

def _code(request: Request) -> str:
    """?code=: 8 to 14 digits (spaces and dashes are left out), as app.'s scanner."""
    code = re.sub(r"[\s-]", "", request.query_params.get("code", ""))
    if not webfood.BARCODE.fullmatch(code):
        raise Refused(400, "bad_request", "A barcode is 8 to 14 digits.")
    return code


@route("/foods/barcode", "GET")
def food_barcode(request, _body, _session):
    """The catalogue's active food with this barcode (a UPC-A code finds its EAN-13), with the amount eaten last (100 if never),
    or food null."""
    out = webfood.scanned(_code(request))
    f = out["food"]
    return {"code": out["code"],
            "food": {"food_id": f["id"], "name": f["name"], "unit": f["basis"], "amount": f["amount"]} if f else None}


@route("/foods/off", "GET")
def food_off(request, _body, _session):
    """Open Food Facts' values for a barcode, per 100 g or ml, for the label form to check (nothing saved); ok false with a
    reason when it does not know the code or not all its values."""
    return webfood.off_values(_code(request))


@route("/food/label", "POST", photos=True)
def food_label(_request, body, _session):
    """One to three photos of one package (multipart, field photo), read together in one AI call; nothing saved, no photo kept."""
    return labelread.read(body["photos"])


LABEL_NUMBERS = ("kcal", "protein", "fat", "carbs", "sat_fat", "sugar_total", "fibre", "salt_g", "amount")


@route("/food/labeladd", "POST")
def food_labeladd(_request, body, session):
    """The checked values (per 100 g or ml) as a new catalogue food, with its barcode; with amount (and time hh:mm, else now) it
    is logged at once, with Undo of the logged entry (the catalogue food stays). A key saves once."""
    basis, source = text(body, "basis", 2) or "g", text(body, "source", 5) or "label"
    if basis not in ("g", "ml"):
        raise Refused(400, "bad_request", "basis must be g or ml.")
    if source not in ("label", "off"):
        raise Refused(400, "bad_request", "source must be label or off.")
    fields = {"name": text(body, "name", 200), "basis": basis, "barcode": text(body, "barcode", 20), "time": text(body, "time", 5),
              "from": source}
    for k in LABEL_NUMBERS:
        v = body.get(k)
        if v is not None and (not isinstance(v, (int, float)) or isinstance(v, bool)):
            raise Refused(400, "bad_request", f"{k} must be a number.")
        fields[k] = "" if v is None else str(v)
    f = Form({k: v for k, v in fields.items() if v != ""})
    return saved(session, _work(lambda: webfood.label_add(f, _key(body))), body)


@route("/lookup", "POST")
def food_look_up(_request, body, session):
    """Look a food up in USDA and Open Food Facts: text = a name or a barcode; question_id = the open food question it answers
    (without text: the question's word). The food found is read back (needs_confirmation, its question in questions); "yes" or
    "no" to it through /answer."""
    words, qid = text(body, "text", 200), text(body, "question_id", 64)
    return saved(session, _work(lambda: webfood.look_up(words, qid)), body)


# ---- the Health page and body measurements (deploy 91) -------------------------------------------------------------------------
# app.'s Health page (healthpage) and its Body measurements card (bodypage), through the same functions: the reads as data (the
# charts as drawChart takes them, the sleep times as rows), a day's row saved by webactions.health_day, a session of tape measures
# by webactions.body_save, Today's "Not today" by webactions.body_skip. The body settings (interval, hidden measures, height) stay
# at app. for now: read, not changed here.

def _range(raw, strict: bool = True) -> int:
    """The Health page's range: 7, 30 or 90 days (30 when not given; strict: anything else is a bad request, else 30)."""
    if raw in (None, ""):
        return healthpage.DEFAULT_RANGE
    if str(raw) in {str(r) for r in healthpage.RANGES} and not isinstance(raw, bool):
        return int(raw)
    if strict:
        raise Refused(400, "bad_request", "range must be 7, 30 or 90.")
    return healthpage.DEFAULT_RANGE


def _flag(raw) -> bool:
    return raw in ("1", "true")


@route("/health", "GET")
def health_read(request, _body, session):
    """The Health page: ?range=7|30|90 (30), &all=1 for every day's row of the range (else the last 14); and the session's Undo."""
    q = request.query_params
    return {"health": reads.health(_range(q.get("range")), _flag(q.get("all", ""))), "undo": _undo_out(session.get("undo"))}


def _number(name: str, v, clear: bool = True) -> str:
    """A number of a save as the form's text; null or "" = cleared ("")."""
    if v is None or v == "":
        return ""
    if not isinstance(v, (int, float)) or isinstance(v, bool):
        raise Refused(400, "bad_request", f"{name} must be a number" + (" or null." if clear else "."))
    return str(v)


ROW_FIELDS = {row: col for col, row in reads.HEALTH_ROWS.items()}  # weight -> w, bp_morning -> bm, ...


@route("/health/day", "POST")
def health_day(_request, body, session):
    """One day's row of the Health page (webactions.health_day): day, values {row: value} with the rows to save (a row left out is
    not touched; null or "" clears it, a delete). Numbers for weight, sugar, mood and energy; [upper, lower] for blood pressure;
    "hh:mm" for bed and wake. confirmed: true after an odd value's read-back; confirm_delete: true is the delete's yes."""
    day_s = text(body, "day", 10, required=True)
    values = body.get("values")
    if not isinstance(values, dict) or not values:
        raise Refused(400, "bad_request", "values must be an object of rows and values.")
    fields = {}
    kinds = {col: kind for col, _h, _s, _t, _p, kind in healthpage.COLS}
    for row, v in values.items():
        col = ROW_FIELDS.get(row)
        if not col:
            raise Refused(400, "bad_request", f"Unknown row: {str(row)[:20]}.")
        kind = kinds[col]
        if kind == 2:
            if v is None or v == "":
                v = [None, None]
            if not isinstance(v, list) or len(v) != 2:
                raise Refused(400, "bad_request", f"{row} must be [upper, lower] or null.")
            fields[f"{col}1"], fields[f"{col}2"] = _number(row, v[0]), _number(row, v[1])
        elif kind == "t":
            if v is not None and not isinstance(v, str):
                raise Refused(400, "bad_request", f"{row} must be a time hh:mm or null.")
            fields[col] = (v or "")[:5]
        else:
            fields[col] = _number(row, v)
    r = str(_range(body.get("range")))
    flags = {"confirmed": "1"} if body.get("confirmed") is True else {}
    if body.get("confirm_delete") is True:
        flags["confirm_del"] = "1"
    f = Form({**fields, **flags, "day": day_s, "r": r})
    return saved(session, _work(lambda: webactions.health_day(day_s, r, f, _key(body))), body, view="health")


@route("/body", "GET")
def body_read(request, _body, session):
    """The Body measurements card: ?day=yyyy-mm-dd the session the form changes (today when not given), ?range=7|30|90 for the
    charts; and the session's Undo."""
    return {"body": reads.body(day_param(request), _range(request.query_params.get("range"))), "undo": _undo_out(session.get("undo"))}


@route("/body", "POST")
def body_save(_request, body, session):
    """A session of tape measures (webactions.body_save): day, values {measure: cm} with the measures of the form (one left out is
    not touched; null or "" clears it, a delete). confirmed: true after the read-back of a value out of range or a jump of 4 cm
    or more; confirm_delete: true is the delete's yes."""
    day_s = text(body, "day", 10, required=True)
    values = body.get("values")
    if not isinstance(values, dict) or not values:
        raise Refused(400, "bad_request", "values must be an object of measures and cm.")
    fields = {}
    for k, v in values.items():
        if k not in tape.NAMES:
            raise Refused(400, "bad_request", f"Unknown measure: {str(k)[:20]}.")
        fields[k] = _number(k, v)
    r = str(_range(body.get("range")))
    flags = {"confirmed": "1"} if body.get("confirmed") is True else {}
    if body.get("confirm_delete") is True:
        flags["confirm_del"] = "1"
    f = Form({**fields, **flags, "day": day_s, "r": r})
    return saved(session, _work(lambda: webactions.body_save(f, _key(body))), {"view_day": day_s, **body}, view="body")


@route("/body/skip", "POST")
def body_skip(_request, body, session):
    """"Not today" on Today's "Body measurements due" line: hidden until the next health day."""
    return saved(session, _work(webactions.body_skip), body)


# ---- the Habits page (deploy 93) -----------------------------------------------------------------------------------------------
# app.'s Habits page (habitspage), through the same functions: the read as data, a past day's tick or untick by webactions.habit_day
# (the squares), and the list's forms by webhabits.ACTIONS (track, retire, restore, edit, delete, new). Today's buttons are POST
# /habit (answer it with "view": "habits" for this page's read). Hiding and ordering habits on Today and the reminders stay at app.
# (Settings): no route here.

def _show(raw, strict: bool = True) -> str:
    if raw in (None, ""):
        return "tracked"
    if isinstance(raw, str) and raw in dict(habitspage.SHOWS):
        return raw
    if strict:
        raise Refused(400, "bad_request", "show must be tracked, untracked, retired or all.")
    return "tracked"


@route("/habits", "GET")
def habits_read(request, _body, session):
    """The Habits page: ?show=tracked|untracked|retired|all (tracked) for "Your habits"; and the session's Undo."""
    return {"habits": reads.habits(_show(request.query_params.get("show"))), "undo": _undo_out(session.get("undo"))}


@route("/habit/day", "POST")
def habit_day(_request, body, session):
    """A square of the calendar (webactions.habit_day): name, day (yyyy-mm-dd), key. A day with fewer ticks than the habit's target
    gets one more tick (date only); a done day has its ticks taken off. Answered with "view": "habits" unless the body says other."""
    name, day_s = text(body, "name", 64, required=True), text(body, "day", 10, required=True)
    return saved(session, _work(lambda: webactions.habit_day(name, day_s, _key(body))), body, view="habits")


def _whole(name: str, v, lo: int, hi: int) -> int:
    if not isinstance(v, int) or isinstance(v, bool) or not lo <= v <= hi:
        raise Refused(400, "bad_request", f"{name} must be a whole number from {lo} to {hi}.")
    return v


@route("/habits/manage", "POST")
def habits_manage(_request, body, session):
    """One of the list's forms (webhabits.ACTIONS): action, key, and by action
    track: name, on (true or false); retire, restore: name; delete: name, confirmed (true); edit: name, label, target (times a day),
    order (optional), aim ("do" or "avoid", optional); new: label, group, target (1 when not given), track (true or false).
    Nothing is saved without a plain yes: a label over 40 letters or a target outside 1 to 10 is a bad request here (the page's
    own form stops them first)."""
    action = body.get("action")
    if action not in webhabits.ACTIONS:
        raise Refused(400, "bad_request", "action must be track, retire, restore, edit, delete or new.")
    f = {}
    if action != "new":
        f["name"] = text(body, "name", 64, required=True)
    if action in ("edit", "new"):
        label = body.get("label")
        if label is not None and not isinstance(label, str):
            raise Refused(400, "bad_request", "label must be text.")
        label = " ".join((label or "").split())
        if len(label) > habitspage.LABEL_MAX:
            raise Refused(400, "bad_request", f"label must be {habitspage.LABEL_MAX} characters or fewer.")
        f["label"] = label
        lo, hi = habitspage.TARGET
        if body.get("target") is not None:
            f["daily_target"] = str(_whole("target", body["target"], lo, hi))
        elif action == "edit":  # the form's function sets 1 when it is not sent: not by a left-out field
            raise Refused(400, "bad_request", "target is missing.")
    if action == "edit":
        if body.get("order") is not None:
            f["sort_order"] = str(_whole("order", body["order"], 0, habitspage.ORDER_MAX))
        if body.get("aim") is not None:
            if body["aim"] not in ("do", "avoid"):
                raise Refused(400, "bad_request", 'aim must be "do" or "avoid".')
            f["aim"] = body["aim"]
    if action == "new":
        if body.get("group") is not None:
            f["group"] = text(body, "group", 20)
        if body.get("track") is not None:
            if not isinstance(body["track"], bool):
                raise Refused(400, "bad_request", "track must be true or false.")
            f["track"] = "1" if body["track"] else "0"
    if action == "track":
        if not isinstance(body.get("on"), bool):
            raise Refused(400, "bad_request", "on must be true or false.")
        f["on"] = "1" if body["on"] else "0"
    if action == "delete" and body.get("confirmed") is True:
        f["confirmed"] = "1"
    form, key = Form(f), _key(body)
    return saved(session, _work(lambda: webhabits.ACTIONS[action](form, key, session)), body, view="habits")


# ---- Gym (deploy 95) ---------------------------------------------------------------------------------------------------------------
# app.'s Gym section (gympage, activitypage), through the same functions: the six tabs as data (the Progress chart as drawChart takes
# it, workouts per week as data, Activity read only) and every form of gym.ACTIONS, with typed fields. Undo where app. has one
# (gym_undo: tick, remove, itemremove). The answer brings back the tab the save belongs to (view "gym", "gym_plan", "gym_exercises").

GYM_VIEWS = {"gym": reads.gym, "gym_plan": reads.gym_plan, "gym_exercises": reads.gym_exercises}


@route("/gym", "GET")
def gym_read(_request, _body, session):
    """The Workout tab: today's day and list, the day chips, this week's split, the last 4 weeks; and the session's Undo."""
    return {"gym": reads.gym(), "undo": _undo_out(session.get("undo"))}


@route("/gym/plan", "GET")
def gym_plan_read(_request, _body, session):
    return {"gym_plan": reads.gym_plan(), "undo": _undo_out(session.get("undo"))}


@route("/gym/exercises", "GET")
def gym_exercises_read(_request, _body, session):
    return {"gym_exercises": reads.gym_exercises(), "undo": _undo_out(session.get("undo"))}


@route("/gym/progress", "GET")
def gym_progress_read(request, _body, session):
    """?x=<exercise id>: one exercise's progress (an exercise never done, or none given: the most recently done one, as app.)."""
    x = request.query_params.get("x", "")
    if x and not re.fullmatch(r"\d{1,12}", x):
        raise Refused(400, "bad_request", "x must be an exercise's id.")
    return {"gym_progress": reads.gym_progress(x or None), "undo": _undo_out(session.get("undo"))}


@route("/gym/history", "GET")
def gym_history_read(_request, _body, session):
    return {"gym_history": reads.gym_history(), "undo": _undo_out(session.get("undo"))}


@route("/gym/activity", "GET")
def gym_activity_read(request, _body, session):
    """?day=yyyy-mm-dd (today when not given; a later day is today): the watch's data of that day, read only."""
    return {"gym_activity": reads.gym_activity(day_param(request)), "undo": _undo_out(session.get("undo"))}


def _gnum(body: dict, name: str) -> str:
    """A number of a gym form as the form's text; null or left out = not given ("")."""
    return _number(name, body.get(name))


def _on(body: dict) -> str:
    v = body.get("on")
    if not isinstance(v, bool):
        raise Refused(400, "bad_request", "on must be true or false.")
    return "1" if v else "0"


def _gname(body: dict, most: int) -> str:
    """A name with its spaces tidied (as gym._name), at most so many characters (the forms' maxlength)."""
    v = body.get("name")
    if v is not None and not isinstance(v, str):
        raise Refused(400, "bad_request", "name must be text.")
    name = " ".join((v or "").split())
    if len(name) > most:
        raise Refused(400, "bad_request", f"name must be {most} characters or fewer.")
    return name


def _words(body: dict) -> str:
    """An exercise's other words: a list of up to 10 words of up to 40 characters, without commas (app.'s form joins them with commas)."""
    v = body.get("words")
    if v is None:
        return ""
    lim = reads.EXERCISE_LIMITS
    if (not isinstance(v, list) or len(v) > lim["words_max"]
            or not all(isinstance(w, str) and "," not in w and len(" ".join(w.split())) <= lim["word_max"] for w in v)):
        raise Refused(400, "bad_request", f'words must be a list of up to {lim["words_max"]} words of up to {lim["word_max"]} characters, without commas.')
    return ", ".join(v)


def _gym_tick(body):
    return {"exercise": str(_int(body, "exercise_id")), **{k: _gnum(body, k) for k in gympage.VALS}}


def _gym_remove(body):
    has_set, has_ex = body.get("set_id") is not None, body.get("exercise_id") is not None
    if has_set == has_ex:
        raise Refused(400, "bad_request", "Send set_id (one row) or exercise_id (all of today's rows of it).")
    return {"set": str(_int(body, "set_id"))} if has_set else {"exercise": str(_int(body, "exercise_id"))}


def _gym_pick(body):
    if "day_id" not in body:
        raise Refused(400, "bad_request", "day_id is missing (null = Free workout).")
    return {"split": "free" if body["day_id"] is None else str(_int(body, "day_id"))}


def _gym_new(body):
    today = body.get("today", False)
    if not isinstance(today, bool):
        raise Refused(400, "bad_request", "today must be true or false.")
    return {"name": _gname(body, reads.EXERCISE_LIMITS["name_max"]), "kind": text(body, "kind", 20), "words": _words(body), "today": "1" if today else ""}


def _gym_move(body):
    if body.get("dir") not in ("up", "down"):
        raise Refused(400, "bad_request", "dir must be up or down.")
    return {"item": str(_int(body, "item_id")), "dir": body["dir"]}


DAY_NAME = reads.PLAN_LIMITS["name_max"]
GYM_FORMS = {  # action -> (the form's fields from the body, the tab the answer brings back)
    "tick": (_gym_tick, "gym"),
    "remove": (_gym_remove, "gym"),
    "pick": (_gym_pick, "gym"),
    "new": (_gym_new, None),  # "gym" when sent from the Workout tab (today: true), else "gym_exercises"
    "rename": (lambda b: {"exercise": str(_int(b, "exercise_id")), "name": _gname(b, reads.EXERCISE_LIMITS["name_max"])}, "gym_exercises"),
    "active": (lambda b: {"exercise": str(_int(b, "exercise_id")), "on": _on(b)}, "gym_exercises"),
    "daynew": (lambda b: {"name": _gname(b, DAY_NAME)}, "gym_plan"),
    "dayedit": (lambda b: {"day": str(_int(b, "day_id")), "name": _gname(b, DAY_NAME)}, "gym_plan"),
    "dayactive": (lambda b: {"day": str(_int(b, "day_id")), "on": _on(b)}, "gym_plan"),
    "itemadd": (lambda b: {"day": str(_int(b, "day_id")), "exercise": str(_int(b, "exercise_id")), "sets": _gnum(b, "sets"), "reps": _gnum(b, "reps")},
                "gym_plan"),
    "itemset": (lambda b: {"item": str(_int(b, "item_id")), "sets": _gnum(b, "sets"), "reps": _gnum(b, "reps")}, "gym_plan"),
    "itemmove": (_gym_move, "gym_plan"),
    "itemremove": (lambda b: {"item": str(_int(b, "item_id"))}, "gym_plan"),
}
assert set(GYM_FORMS) == set(gym.ACTIONS)


def _gym_route(action: str):
    fields, view = GYM_FORMS[action]
    fn = gym.ACTIONS[action]

    def handler(_request, body, session):
        f = Form({k: v for k, v in fields(body).items() if v != ""})
        shown = view or ("gym" if f.get("today") == "1" else "gym_exercises")
        return saved(session, _work(lambda: fn(f, _key(body), session)), body, view=shown)
    handler.__name__ = f"gym_{action}"
    handler.__doc__ = f"app.'s /web/gym/{action} (gym.ACTIONS[{action!r}]); see docs/API.md."
    return handler


for _action in GYM_FORMS:
    route(f"/gym/{_action}", "POST")(_gym_route(_action))

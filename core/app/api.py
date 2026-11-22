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
The reads are reads.py; the saves call the same functions as the live forms (webactions, webfood, logbook, webundo, webheld, gym, home,
coach, weblabs, websettings). One route answers a file instead of JSON (POST /export, deploy 110; route's download)."""
import hashlib
import hmac
import json
import logging
import re
from datetime import date, datetime, timedelta, timezone

from psycopg.types.json import Jsonb
from starlette.concurrency import run_in_threadpool
from starlette.requests import Request
from starlette.responses import JSONResponse, Response

from . import auth, body as tape, coach, coachpage, export, foodpage, gym, gympage, habitspage, healthpage, home as homelib, hubtools, insightspage, labelread, labspage, logbook, mealnotes, nudges, privateline, reads, settingspage, trendspage, uiprefs, usagepage, web, webactions, webentry, webfood, webhabits, webheld, weblabs, webpush, websettings, webundo, weekpage
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


class Download:
    """A file instead of JSON (deploy 110, POST /export's ZIP): only a route registered with download=True may answer one; from any
    other route it is a server error, so no other answer can ever leave the door as anything but the JSON of reply()."""

    def __init__(self, data: bytes, media_type: str, filename: str):
        self.data, self.media_type, self.filename = data, media_type, filename

    def response(self, session) -> Response:
        headers = {**_HEADERS, "Content-Disposition": f'attachment; filename="{self.filename}"'}
        if session and session.get("expires_at"):
            headers["X-Session-Expires"] = session["expires_at"].astimezone(timezone.utc).isoformat()
        return Response(self.data, media_type=self.media_type, headers=headers)


def route(path: str, method: str, signed_in: bool = True, photos: bool = False, download: bool = False):
    """Register a door route: fn(request, body, session) -> dict (or (dict, status)), run off the event loop. The checks of the
    module's docstring come first; a Refused becomes its JSON error; any other error a plain 500 (the kind goes to the log,
    never what was sent). photos: the body is multipart with one to three photos (body = {"photos": [(type, bytes)]}, see
    _photos), not JSON; only this route may be larger than MAX_BODY (deploy 89, the label photo). download: fn may answer a
    Download (bytes, no-store, after the same checks); its errors are JSON as everywhere (deploy 110, POST /export)."""
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
            if isinstance(out, Download):
                if download:
                    return out.response(session)
                log.error("the door's %s %s answered a file without download=True", method, path)
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


@route("/foods/suggest", "GET")
def foods_suggest(_request, _body, _session):
    """Every active food for the logging box's suggestions (deploy 116; the same data as app.'s /web/foods.json)."""
    return {"foods": reads.food_suggestions()}


@route("/food/nutrients", "GET")
def food_nutrients(request, _body, _session):
    """The Food space's Nutrients tab (21.11.2026): every tracked value of what was eaten in ?days=1|7|30 (1 when not given)
    ending at ?day= (today when not given; a later day is today)."""
    raw = request.query_params.get("days", "")
    if raw and raw not in {str(d) for d in reads.NUTRIENT_DAYS}:
        raise Refused(400, "bad_request", "days must be 1, 7 or 30.")
    return {"food_nutrients": reads.food_nutrients(day_param(request), int(raw or 1))}


@route("/food/notes", "GET")
def food_notes(request, _body, _session):
    """The Food space's Notes tab (21.11.2026): every meal note and food note of the last ?days= days (1 to 366; 90 when not given)."""
    raw = request.query_params.get("days", "")
    if raw and not (raw.isdigit() and 1 <= int(raw) <= 366):
        raise Refused(400, "bad_request", "days must be a whole number from 1 to 366.")
    return {"food_notes": reads.food_notes(int(raw) if raw else reads.NOTES_DAYS)}


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
    """A JSON body as the live forms' functions read a form: .get(name), .multi_items() (webfood._again), and .getlist(name) for a
    field a form sends once per ticked box (Settings > Body's show, deploy 110: its value here is a list)."""

    def multi_items(self):
        return list(self.items())

    def getlist(self, name):
        v = self.get(name)
        return [str(x) for x in v] if isinstance(v, (list, tuple)) else [] if v is None else [str(v)]


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
    elif shown in HOME_VIEWS:  # a Home page (deploy 98), as its GET with the body's view_min, view_n, view_limit, view_id
        res[shown] = HOME_VIEWS[shown](body)
    elif shown == "week":  # the Week page (deploy 101), as GET /week with the body's view_p (7 when not given or unknown)
        res["week"] = reads.week(_period(body.get("view_p"), strict=False))
    elif shown == "catalogue":  # the Catalogue (deploy 104), as GET /food/catalogue with view_q, view_f, view_s; and view_food's box
        res["catalogue"], res["food_item"] = _catalogue_view(body)
    elif shown == "words":  # the words review (core item 24), as GET /food/words with view_q and view_shared
        res["words"] = _words_view(body)
    elif shown in LABS_VIEWS:  # a Medical tab (deploy 104), as its GET with view_open, or view_q and view_t
        res[shown] = LABS_VIEWS[shown](body)
    elif shown == "coach":  # the Coach page (deploy 107), as GET /coach with view_f (all when unknown) and view_day (a later day: today)
        res["coach"] = reads.coach_page(body.get("view_f") if body.get("view_f") in COACH_FILTERS else "all", _coach_day(asked))
    elif shown in SETTINGS_VIEWS:  # a Settings tab (deploy 110), as its GET /settings/<tab>
        res[shown] = SETTINGS_VIEWS[shown](session)
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


@route("/food/mealnote", "POST")
def food_meal_note(_request, body, session):
    """A meal's one-line note (21.11.2026, mealnotes.py): day (yyyy-mm-dd), meal (1, 2, …; 0 = the note on a day with no meal
    left), note (up to 300 characters, whitespace collapsed; empty = removed). No Undo. Answers with the fresh food day of day."""
    try:
        the_day = date.fromisoformat(text(body, "day", 10, required=True))
    except ValueError:
        raise Refused(400, "bad_request", "day must be yyyy-mm-dd.") from None
    meal = body.get("meal")
    if isinstance(meal, str) and meal.isdigit():
        meal = int(meal)
    if not isinstance(meal, int) or isinstance(meal, bool) or not 0 <= meal <= 20:
        raise Refused(400, "bad_request", "meal must be a meal's number (1, 2, …; 0 for the day's note).")
    note = body.get("note")
    if note is not None and not isinstance(note, str):
        raise Refused(400, "bad_request", "note must be text.")
    if note and len(" ".join(note.split())) > mealnotes.MAX_NOTE:
        raise Refused(400, "bad_request", f"note must be at most {mealnotes.MAX_NOTE} characters.")
    with connect() as c:
        today = c.execute("SELECT log_day(now()) AS d").fetchone()["d"]
    out = _work(lambda: mealnotes.save(the_day, meal, note or "", today))
    return saved(session, out, {**body, "view_day": body.get("view_day") or the_day.isoformat()}, view="food")


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
    with connect() as c, c.cursor() as cur:
        known = set(tape.names(cur))
    for k, v in values.items():
        if k not in known:
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
    order (optional), aim ("do" or "avoid", optional), remind_after (hours after waking, 0.5 to 15.5 in half hours; null or "" = no
    reminder; left out = as it is); new: label, group, target (1 when not given), track (true or false).
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
        if "remind_after" in body:  # left out: the habit keeps its reminder (app.'s form does not send it)
            v = body["remind_after"]
            lo, hi = habitspage.REMIND
            if v is not None and v != "" and (not isinstance(v, (int, float)) or isinstance(v, bool) or webhabits.remind_problem(v)):
                raise Refused(400, "bad_request", f"remind_after must be a number from {lo:g} to {hi:g} in steps of {habitspage.REMIND_STEP:g}, or null.")
            f["remind_after"] = "" if v is None else str(v)
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
def gym_history_read(request, _body, session):
    """?w=<workout id> (deploy 107): that workout is added in its place when it is older than the last 60 (a search result's card)."""
    w = request.query_params.get("w", "")
    if w and not re.fullmatch(r"\d{1,12}", w):
        raise Refused(400, "bad_request", "w must be a workout's id.")
    return {"gym_history": reads.gym_history(int(w) if w else None), "undo": _undo_out(session.get("undo"))}


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


# ---- Home (deploy 98) --------------------------------------------------------------------------------------------------------------
# app.'s Home section (homepage's data functions), through the same functions: the six pages as data (Now, Pick, Zones, History, a
# chore's page, Edit zones) and every form of home.ACTIONS, with typed fields. Undo where app. has one (home.undo through webundo: tick,
# alldone, remove, pickdone, picknext when it ticked, earlier, startpoint, skip). The answer brings back the page the save belongs to
# (view "home", "home_pick", "home_zones", "home_history", "home_chore", "home_edit"; their parameters as view_min, view_n,
# view_limit, view_id, like view_day).

def _q(**params) -> dict:
    """A page's parameters as app.'s query string gives them (left out when not sent; app.'s own rules read them)."""
    return {k: v for k, v in params.items() if v is not None and not isinstance(v, (dict, list, bool))}


def _chore_view(body: dict):
    return reads.home_chore(_q(id=body.get("view_id")))


HOME_VIEWS = {"home": lambda b: reads.home(_q(min=b.get("view_min"))),
              "home_pick": lambda b: reads.home_pick(_q(min=b.get("view_min"), n=b.get("view_n"))),
              "home_zones": lambda b: reads.home_zones(),
              "home_history": lambda b: reads.home_history(_q(n=b.get("view_limit"))),
              "home_chore": _chore_view,  # null when the chore is not there (view_id missing or unknown)
              "home_edit": lambda b: reads.home_edit()}


@route("/home", "GET")
def home_read(request, _body, session):
    """The Now tab: ?min=5|15|30|60 (15; anything else is 15, as app.); and the session's Undo."""
    return {"home": reads.home(request.query_params), "undo": _undo_out(session.get("undo"))}


@route("/home/pick", "GET")
def home_pick_read(request, _body, session):
    """The Pick page: ?min= and ?n= (the n-th job; as app.); with a timer open its job and minutes."""
    return {"home_pick": reads.home_pick(request.query_params), "undo": _undo_out(session.get("undo"))}


@route("/home/zones", "GET")
def home_zones_read(_request, _body, session):
    return {"home_zones": reads.home_zones(), "undo": _undo_out(session.get("undo"))}


@route("/home/history", "GET")
def home_history_read(request, _body, session):
    """History: ?n= rows (60 to 600; 60 when not given or not a number, as app.)."""
    return {"home_history": reads.home_history(request.query_params), "undo": _undo_out(session.get("undo"))}


@route("/home/chore", "GET")
def home_chore_read(request, _body, session):
    """A chore's page: ?id=<chore id> (retired chores too); not digits is 400, an unknown chore 404 no_entry."""
    cid = request.query_params.get("id", "")
    if not re.fullmatch(r"\d{1,12}", cid):
        raise Refused(400, "bad_request", "id must be a chore's id.")
    out = reads.home_chore({"id": cid})
    if out is None:
        raise Refused(404, "no_entry", "That chore is not in the list.")
    return {"home_chore": out, "undo": _undo_out(session.get("undo"))}


@route("/home/edit", "GET")
def home_edit_read(_request, _body, session):
    return {"home_edit": reads.home_edit(), "undo": _undo_out(session.get("undo"))}


def _pairs(body: dict) -> str:
    """pairs: a list of [chore_id, zone_id] (1 to 12), as the form's "3-5,4-5"."""
    v = body.get("pairs")
    if (not isinstance(v, list) or not 1 <= len(v) <= 12
            or not all(isinstance(x, list) and len(x) == 2 and all(isinstance(i, int) and not isinstance(i, bool) and 0 < i < 10**9 for i in x) for x in v)):
        raise Refused(400, "bad_request", "pairs must be a list of 1 to 12 [chore_id, zone_id].")
    return homelib.pairs_value(v)


def _id_of(body: dict, name: str) -> str:
    return str(_int(body, name))


def _whole_n(body: dict, name: str) -> str:
    """A whole number of a form as its text; its range is app.'s function's to check (a refusal with app.'s words)."""
    v = body.get(name)
    if not isinstance(v, int) or isinstance(v, bool) or abs(v) >= 10**9:
        raise Refused(400, "bad_request", f"{name} must be a whole number.")
    return str(v)


def _hname(body: dict, most: int, name: str = "name") -> str:
    v = body.get(name)
    if v is not None and not isinstance(v, str):
        raise Refused(400, "bad_request", f"{name} must be text.")
    out = " ".join((v or "").split())
    if len(out) > most:
        raise Refused(400, "bad_request", f"{name} must be {most} characters or fewer.")
    return out


def _hlist(body: dict, name: str, most: int, width: int, sep: str) -> str:
    """A list of short texts (steps, spots, words) as the form's text: lines for steps and spots, commas for words."""
    v = body.get(name)
    if v is None:
        return ""
    if (not isinstance(v, list) or len(v) > most
            or not all(isinstance(x, str) and "\n" not in x and "\r" not in x and (sep != "," or "," not in x) and len(" ".join(x.split())) <= width for x in v)):
        extra = ", without commas" if sep == "," else ", one line each"
        raise Refused(400, "bad_request", f"{name} must be a list of up to {most} texts of up to {width} characters{extra}.")
    return (", " if sep == "," else "\n").join(v)


L = reads.HOME_LIMITS


def _zone_fields(b: dict) -> dict:
    return {"name": _hname(b, L["zone_name_max"]), "short": _hname(b, L["short_max"], "short"),
            "spots": _hlist(b, "spots", L["spots_max"], L["spot_max"], "\n"), "words": _hlist(b, "words", L["words_max"], L["word_max"], ",")}


def _chore_fields(b: dict) -> dict:
    if "zone_id" not in b:
        raise Refused(400, "bad_request", "zone_id is missing (null = the whole flat).")
    howto = b.get("howto")
    if howto is not None and not isinstance(howto, str):
        raise Refused(400, "bad_request", "howto must be text or null.")
    if howto and len(" ".join(howto.split())) > L["howto_max"]:
        raise Refused(400, "bad_request", f'howto must be {L["howto_max"]} characters or fewer.')
    return {"name": _hname(b, L["chore_name_max"]), "zone": "flat" if b["zone_id"] is None else _id_of(b, "zone_id"),
            "days": _whole_n(b, "days"), "minutes": "" if b.get("minutes") is None else _whole_n(b, "minutes"),
            "steps": _hlist(b, "steps", L["steps_max"], L["step_max"], "\n"), "howto": howto or "",
            "words": _hlist(b, "words", L["words_max"], L["word_max"], ",")}


def _chore_zones(b: dict) -> dict:
    """zones: [{zone_id, on, days, minutes}] as the Per zone table (a zone left out is off, as an unticked box; days and minutes
    null = blank = the chore's own)."""
    zs = b.get("zones")
    if not isinstance(zs, list) or not all(isinstance(z, dict) for z in zs) or len(zs) > 100:
        raise Refused(400, "bad_request", "zones must be a list of {zone_id, on, days, minutes}.")
    f = {"chore": _id_of(b, "chore_id")}
    for z in zs:
        zid = _int(z, "zone_id")
        f[f"on_{zid}"] = _on(z)
        for field, key_ in (("days", "days"), ("min", "minutes")):
            v = z.get(key_)
            if v is not None:
                f[f"{field}_{zid}"] = _whole_n(z, key_)
    return f


def _when(b: dict) -> str:
    """when: 1 to 7 (days ago: 1 = yesterday) or a date yyyy-mm-dd."""
    v = b.get("when")
    if isinstance(v, int) and not isinstance(v, bool):
        return str(v)
    if isinstance(v, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
        return v
    raise Refused(400, "bad_request", "when must be 1 to 7 (days ago) or a date yyyy-mm-dd.")


def _ago(b: dict) -> str:
    if b.get("ago") not in ("week", "month", "longer", "unknown"):
        raise Refused(400, "bad_request", "ago must be week, month, longer or unknown.")
    return b["ago"]


def _ids(b: dict) -> str:
    v = b.get("ids")
    if not isinstance(v, list) or not 1 <= len(v) <= 20 or not all(isinstance(i, int) and not isinstance(i, bool) and 0 < i < 10**12 for i in v):
        raise Refused(400, "bad_request", "ids must be a list of 1 to 20 ids (a history entry's ids).")
    return ",".join(str(i) for i in v)


def _timer_id(b: dict) -> dict:
    return {"timer": _id_of(b, "timer_id")}


HOME_FORMS = {  # action -> (the form's fields from the body, the page the answer brings back)
    "tick": (lambda b: {"chore": _id_of(b, "chore_id"), "zone": _id_of(b, "zone_id")}, "home"),
    "alldone": (lambda b: {"chore": _id_of(b, "chore_id")}, "home_zones"),
    "remove": (lambda b: {"ids": _ids(b)}, "home_history"),
    "zonenew": (_zone_fields, "home_edit"),
    "zoneedit": (lambda b: {"zone": _id_of(b, "zone_id"), **_zone_fields(b)}, "home_edit"),
    "zoneactive": (lambda b: {"zone": _id_of(b, "zone_id"), "on": _on(b)}, "home_edit"),
    "chorenew": (_chore_fields, "home_edit"),
    "choreedit": (lambda b: {"chore": _id_of(b, "chore_id"), **_chore_fields(b)}, "home_edit"),
    "choreactive": (lambda b: {"chore": _id_of(b, "chore_id"), "on": _on(b)}, "home_edit"),
    "start": (lambda b: {"pairs": _pairs(b), "minutes": _whole_n(b, "minutes")}, "home_pick"),
    "pause": (_timer_id, "home_pick"),
    "resume": (_timer_id, "home_pick"),
    "stop": (_timer_id, "home_pick"),
    "pickdone": (lambda b: {"pairs": _pairs(b)}, "home"),
    "skip": (lambda b: {"pairs": _pairs(b)}, "home_pick"),
    "goalset": (lambda b: {"goal": _whole_n(b, "goal")}, "home_edit"),
    "chorezones": (_chore_zones, "home_edit"),
    "startpoint": (lambda b: {"pairs": _pairs(b), "ago": _ago(b)}, "home_zones"),
    "earlier": (lambda b: {"pairs": _pairs(b), "when": _when(b)}, "home_pick"),
    "picknext": (lambda b: {"pairs": _pairs(b), **_timer_id(b)}, "home_pick"),
}
assert set(HOME_FORMS) == set(homelib.ACTIONS)
HOME_KEYED = ("tick", "alldone", "pickdone", "picknext", "earlier", "startpoint")  # the six that save once per key (home._once)


def _home_route(action: str):
    fields, view = HOME_FORMS[action]
    fn = homelib.ACTIONS[action]

    def handler(_request, body, session):
        f = Form({k: v for k, v in fields(body).items() if v != ""})
        key = _key(body) if action in HOME_KEYED else None
        return saved(session, _work(lambda: fn(f, key, session)), body, view=view)
    handler.__name__ = f"home_{action}"
    handler.__doc__ = f"app.'s /web/home/{action} (home.ACTIONS[{action!r}]); see docs/API.md."
    return handler


for _action in HOME_FORMS:
    route(f"/home/{_action}", "POST")(_home_route(_action))


# ---- Trends (deploy 101) -----------------------------------------------------------------------------------------------------------
# app.'s Week page (with its Week review card), the Food page's Trends tab and the Insights page as data, through the same functions
# (weekpage.data, trendspage.data, insightspage.data, coachpage.week_review), and the Week review's button (coach.start, as app.'s
# /web/coach/start) with its status poll (coach.status, as app.'s /web/coach/status). A review is read by the AI in the background
# and costs money: it starts only when the owner presses the button, and its request is never sent again by a page (no key: coach.start
# takes none; a second press while one reads is "The coach is already on it.").

def _period(raw, strict: bool = True) -> str:
    """The Week page's period: 7, last, 30 or this (7 when not given; strict: anything else is a bad request, else 7)."""
    if raw in (None, ""):
        return "7"
    if isinstance(raw, str) and raw in dict(weekpage.PERIODS):
        return raw
    if strict:
        raise Refused(400, "bad_request", "p must be 7, last, 30 or this.")
    return "7"


@route("/week", "GET")
def week_read(request, _body, session):
    """The Week page: ?p=7|last|30|this (7); and the session's Undo."""
    return {"week": reads.week(_period(request.query_params.get("p"))), "undo": _undo_out(session.get("undo"))}


def _trend_range(raw) -> int:
    """The Trends tab's range: 7, 30 or 90 days (30 when not given; anything else is a bad request)."""
    if raw in (None, ""):
        return trendspage.DEFAULT_RANGE
    if str(raw) in {str(r) for r in trendspage.RANGES}:
        return int(raw)
    raise Refused(400, "bad_request", "range must be 7, 30 or 90.")


@route("/food/trends", "GET")
def food_trends_read(request, _body, session):
    """The Food page's Trends tab: ?range=7|30|90 (30); and the session's Undo."""
    return {"trends": reads.food_trends(_trend_range(request.query_params.get("range"))), "undo": _undo_out(session.get("undo"))}


def _insight_days(raw) -> int:
    """The Insights page's range: 90, 180 or 365 days (90 when not given; anything else is a bad request)."""
    if raw in (None, ""):
        return insightspage.DAYS
    if str(raw) in {str(r) for r in insightspage.RANGES}:
        return int(raw)
    raise Refused(400, "bad_request", "days must be 90, 180 or 365.")


@route("/insights", "GET")
def insights_read(request, _body, session):
    """The Insights page: ?days=90|180|365 (90); and the session's Undo."""
    return {"insights": reads.insights(_insight_days(request.query_params.get("days"))), "undo": _undo_out(session.get("undo"))}


@route("/coach/status", "GET")
def coach_status(request, _body, session):
    """?id=<coaching id>: working, done, failed (also a cut-off one) or gone; not digits is 400."""
    cid = request.query_params.get("id", "")
    if not re.fullmatch(r"\d{1,12}", cid):
        raise Refused(400, "bad_request", "id must be a coaching's id.")
    return {"coaching": reads.coaching(int(cid)), "undo": _undo_out(session.get("undo"))}


def _iso_day(body: dict, name: str) -> str:
    v = body.get(name)
    if not isinstance(v, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", v):
        raise Refused(400, "bad_request", f"{name} must be a date yyyy-mm-dd.")
    return v


@route("/coach/start", "POST")
def coach_start(_request, body, session):
    """The Week review's button and, since deploy 107, the Coach card's "Coach me" (app.'s /web/coach/start, coach.start with its checks):
    kind "week" or "day", start and end (yyyy-mm-dd; a day: the same day twice, coach.start refuses another). No key, and never sent
    again by a page. The answer: the save's shape with coaching {id, state} of that kind and period (null when refused) and a fresh
    read: a week the Week page (view "week", view_p: the period of start and end when it is last week or this week so far, else 7), a
    day the day (view "day", view_day: the day coached); or another view ("coach" with view_f and view_day)."""
    kind = body.get("kind")
    if kind not in ("week", "day"):
        raise Refused(400, "bad_request", 'kind must be "day" or "week".')
    a, b = _iso_day(body, "start"), _iso_day(body, "end")
    out = _work(lambda: coach.start(Form({"kind": kind, "start": a, "end": b})))
    started = None
    if out.get("outcome") != "rejected":
        with connect() as c, c.cursor() as cur:
            row = coach.latest(cur, kind, date.fromisoformat(a), date.fromisoformat(b))
        if row:
            started = {"id": row["id"], "state": "failed" if row["stale"] else row["status"]}
    view = dict(body)
    if kind == "week" and not view.get("view_p") and (view.get("view") or "week") == "week":
        try:
            view["view_p"] = weekpage.period_of(date.fromisoformat(a), date.fromisoformat(b))
        except ValueError:  # not a calendar day: coach.start refused it
            view["view_p"] = "7"
    if kind == "day" and not view.get("view_day") and (view.get("view") or "day") in ("day", "coach"):
        view["view_day"] = a
    res = saved(session, out, view, view=kind)
    res["coaching"] = started
    return res


# ---- More: Search, Recent, Usage, Coach (deploy 107) ---------------------------------------------------------------------------------
# app.'s Search, Recent, Usage and Coach pages as data (reads.search, recent, usage, coach_page: searchpage.results, recentpage.messages,
# usagepage.data, coachpage.list_data and card_data, which app.'s pages draw from). Reads only; the Coach page's button is
# POST /coach/start above (kind "day").

USAGE_RANGES = tuple(k for k, _l in usagepage.RANGES)
COACH_FILTERS = tuple(k for k, _l in coachpage.FILTERS)


def _today():
    with connect() as c, c.cursor() as cur:
        cur.execute("SELECT log_day(now()) AS d")
        return cur.fetchone()["d"]


def _coach_day(asked):
    """A day for the Coach card of the Coach page's fresh read: the day asked when it is not after today, else today."""
    t = _today()
    return asked if asked and asked <= t else t


@route("/search", "GET")
def search_read(request, _body, session):
    """?q= (spaces squeezed, cut at 80; under two characters nothing is searched): app.'s Search without thoughts."""
    return {"search": reads.search(request.query_params.get("q", "")), "undo": _undo_out(session.get("undo"))}


@route("/recent", "GET")
def recent_read(_request, _body, session):
    return {"recent": reads.recent(), "undo": _undo_out(session.get("undo"))}


@route("/usage", "GET")
def usage_read(request, _body, session):
    """?r=7|30|all (7); anything else is a bad request."""
    r = request.query_params.get("r") or "7"
    if r not in USAGE_RANGES:
        raise Refused(400, "bad_request", "r must be 7, 30 or all.")
    return {"usage": reads.usage(r), "undo": _undo_out(session.get("undo"))}


@route("/coach", "GET")
def coach_read(request, _body, session):
    """?f=all|days|weeks (all) and ?day=yyyy-mm-dd (today; a day after today is a bad request): the Coach page and that day's card."""
    f = request.query_params.get("f") or "all"
    if f not in COACH_FILTERS:
        raise Refused(400, "bad_request", "f must be all, days or weeks.")
    asked = day_param(request)
    if asked and asked > _today():
        raise Refused(400, "bad_request", "day must not be after today.")
    return {"coach": reads.coach_page(f, asked), "undo": _undo_out(session.get("undo"))}


# ---- Library: the food catalogue (deploy 104) ------------------------------------------------------------------------------------
# app.'s Food > Catalogue (foodpage.catalogue_data, food_data) as data, and its six forms through webfood's functions (values, words,
# barcode, basics, unit, reviewed) with their checks and words. The saves are at /food/catalogue/<action> (not /food/<action>: /food/entry
# and /food/note change food entries). As on app., no key (one sent is ignored) and no Undo; a values change is shown first
# (needs_confirmation) and made when sent again with "confirmed": true. A new food is POST /lookup (and its yes through /answer).

FILTER_KEYS = tuple(k for k, _l in foodpage.FILTERS)
FOOD_REF = re.compile(r"[Nn]?(\d{1,9})")


def _food_ref(raw):
    """A food's id as app.'s ?food= ("N12") or plain ("12", 12); None when it is not one."""
    if isinstance(raw, int) and not isinstance(raw, bool):
        return raw if 0 < raw < 10**9 else None
    m = FOOD_REF.fullmatch(raw) if isinstance(raw, str) else None
    return int(m[1]) if m else None


def _catalogue_view(body: dict):
    """The Catalogue as GET /food/catalogue with the body's view_q, view_f, view_s (an unknown filter or order: app.'s default), and
    the box of view_food when that food is in the list (null when it is not, e.g. after it was hidden)."""
    q = body.get("view_q") if isinstance(body.get("view_q"), str) else ""
    f = body.get("view_f") if body.get("view_f") in FILTER_KEYS else "all"
    s = body.get("view_s") if body.get("view_s") in foodpage.SORT_KEYS else "eaten"
    cat = reads.catalogue(q[:60], f, s)
    fid = _food_ref(body.get("view_food"))
    item = reads.food_item(fid) if fid is not None and any(r["id"] == fid for r in cat["rows"]) else None
    return cat, item


@route("/food/catalogue", "GET")
def catalogue_read(request, _body, session):
    """The Catalogue: ?q= (cut at 60), ?f=all|drinks|new|review (all), ?s=<one of the eight orders> (eaten); and the session's Undo."""
    qp = request.query_params
    f, s = qp.get("f") or "all", qp.get("s") or "eaten"
    if f not in FILTER_KEYS:
        raise Refused(400, "bad_request", "f must be all, drinks, new or review.")
    if s not in foodpage.SORT_KEYS:
        raise Refused(400, "bad_request", "s must be " + ", ".join(foodpage.SORT_KEYS[:-1]) + " or " + foodpage.SORT_KEYS[-1] + ".")
    return {"catalogue": reads.catalogue(qp.get("q", "")[:60], f, s), "undo": _undo_out(session.get("undo"))}


def _words_view(body: dict):
    """The words review as GET /food/words with the body's view_q and view_shared (a save's fresh read of the words page)."""
    q = body.get("view_q") if isinstance(body.get("view_q"), str) else ""
    return reads.food_words(q[:reads.WORDS_Q_MAX], body.get("view_shared") is True)


@route("/food/words", "GET")
def food_words_read(request, _body, session):
    """The words review (core item 24): every word of an active food with its food, when and from where it was added and how many
    foods have it. ?q= (a word or a food's name; at most 60 characters), ?shared=1 (only words on more than one food), and the
    session's Undo. A word is removed with POST /food/catalogue/words (act remove)."""
    qp = request.query_params
    q = qp.get("q", "")
    if len(q) > reads.WORDS_Q_MAX:
        raise Refused(400, "bad_request", f"q must be {reads.WORDS_Q_MAX} characters or fewer.")
    shared = qp.get("shared", "")
    if shared not in ("", "0", "1"):
        raise Refused(400, "bad_request", "shared must be 1 or 0.")
    return {"words": reads.food_words(q, shared == "1"), "undo": _undo_out(session.get("undo"))}


@route("/food/item", "GET")
def food_item_read(request, _body, session):
    """One food's box: ?id=N12 or 12; not one is 400, a food that is not there 404 no_entry."""
    fid = _food_ref(request.query_params.get("id", ""))
    if fid is None:
        raise Refused(400, "bad_request", "id must be a food's id (N12 or 12).")
    out = reads.food_item(fid)
    if out is None:
        raise Refused(404, "no_entry", foodpage.GONE)
    return {"food_item": out, "undo": _undo_out(session.get("undo"))}


def _short(body: dict, name: str, most: int):
    """A text field: None when left out, "" when null, else the text (at most `most` characters; anything else is a bad request)."""
    if name not in body:
        return None
    v = body[name]
    if v is None:
        return ""
    if not isinstance(v, str):
        raise Refused(400, "bad_request", f"{name} must be text or null.")
    if len(" ".join(v.split()) if name != "notes" else v.strip()) > most:
        raise Refused(400, "bad_request", f"{name} must be {most} characters or fewer.")
    return v


def _bool(body: dict, name: str):
    """A tick box: None when left out, else true or false (anything else is a bad request)."""
    v = body.get(name)
    if v is None:
        return None
    if not isinstance(v, bool):
        raise Refused(400, "bad_request", f"{name} must be true or false.")
    return v


FL = foodpage.LIMITS


def _food_values(b: dict) -> dict:
    """values: the ten values per 100 as numbers; one left out or null is not sent (unchanged); past true rewrites the past entries."""
    f = {"id": f"N{_int(b, 'id')}"}
    for k, _label in foodpage.NUT:
        v = b.get(k)
        if v is None:
            continue
        if not isinstance(v, (int, float)) or isinstance(v, bool):
            raise Refused(400, "bad_request", f"{k} must be a number or null.")
        f[k] = str(v)
    if _bool(b, "past"):
        f["past"] = "yes"
    return f


def _food_words(b: dict) -> dict:
    if b.get("act") not in ("add", "remove"):
        raise Refused(400, "bad_request", "act must be add or remove.")
    return {"id": f"N{_int(b, 'id')}", "act": b["act"], "word": _short(b, "word", FL["word_max"]) or ""}


def _food_barcode(b: dict) -> dict:
    return {"id": f"N{_int(b, 'id')}", "barcode": _short(b, "barcode", 40) or ""}


def _food_basics(b: dict) -> dict:
    """name, drink, hide: one left out stays as it is (app.'s form sends all three, filled in)."""
    ref = f"N{_int(b, 'id')}"
    name, drink, hide = _short(b, "name", FL["name_max"]), _bool(b, "drink"), _bool(b, "hide")
    now = webfood._food(ref)
    if now:
        name = now["name"] if name is None else name
        drink = bool(now["is_drink"]) if drink is None else drink
        hide = (not now["active"]) if hide is None else hide
    return {"id": ref, "name": name or "", "drink": "1" if drink else "", "hide": "1" if hide else ""}


def _food_unit(b: dict) -> dict:
    g = b.get("grams")
    if g is not None and (not isinstance(g, (int, float)) or isinstance(g, bool)):
        raise Refused(400, "bad_request", "grams must be a number.")
    return {"id": f"N{_int(b, 'id')}", "unit": _short(b, "unit", FL["unit_max"]) or "", "grams": "" if g is None else str(g)}


CATALOGUE_FORMS = {  # action -> (the form's fields from the body, webfood's function: app.'s /web/food/<action>)
    "values": (_food_values, webfood.values),
    "words": (_food_words, webfood.words),
    "barcode": (_food_barcode, webfood.barcode),
    "basics": (_food_basics, webfood.basics),
    "unit": (_food_unit, webfood.unit_add),
    "reviewed": (lambda b: {"id": f"N{_int(b, 'id')}"}, webfood.reviewed),
}
assert all(webfood.ACTIONS[a][0] is fn for a, (_f, fn) in CATALOGUE_FORMS.items() if a != "unit") and webfood.ACTIONS["unit"][0] is webfood.unit_add


def _catalogue_route(action: str):
    fields, fn = CATALOGUE_FORMS[action]

    def handler(_request, body, session):
        f = fields(body)
        if body.get("confirmed") is True:
            f["confirmed"] = "1"
        form = Form({**{k: v for k, v in f.items() if v != ""}, "back": "/web/food/catalogue"})
        word = " ".join(f["word"].split()).lower()[:60] if action == "words" else ""
        had = word in ((webfood._food(f["id"]) or {}).get("aliases") or []) if word and body.get("view") == "words" else None
        out = _work(lambda: fn(form, None))
        if had is not None and out.get("outcome") == "changed" and had == (f["act"] == "remove"):
            # only the words review has an Undo (core item 24), and only for a change that made a difference: the opposite change of
            # that word alone (webundo.words_undo); an add of a word the food had, or a remove of one it had not, has nothing to undo
            out["words_undo"] = {"food_id": int(f["id"][1:]), "act": "add" if had else "remove", "word": word}
        return saved(session, out, body, view="catalogue")
    handler.__name__ = f"catalogue_{action}"
    handler.__doc__ = f"app.'s /web/food/{action} (webfood.ACTIONS[{action!r}]); no key, no Undo; see docs/API.md."
    return handler


for _action in CATALOGUE_FORMS:
    route(f"/food/catalogue/{_action}", "POST")(_catalogue_route(_action))


# ---- Medical: lab reports, tests over time, medication (deploy 104) ------------------------------------------------------------------
# app.'s Medical page (labspage.reports_data, tests_data, meds_data) as data, and its three forms through weblabs' functions (value,
# report, med) with their checks and words: each change is shown first (needs_confirmation) and made when the same request is sent
# again with "confirmed": true. No key (one sent is ignored), no Undo, as on app. A new course is a sentence through POST /log (read
# back, its yes through /answer). Health data: every answer is no-store (as every answer of the door), nothing of it goes to a log line,
# and the audit rows keep ids only (the change function's own).

REPORT_REF = re.compile(r"[Rr]?(\d{1,9})")


def _report_open(raw, strict: bool = True) -> str:
    """?open=R12 or 12 -> "R12" ("" when not given; strict: anything else is a bad request, else "")."""
    if raw in (None, ""):
        return ""
    if isinstance(raw, int) and not isinstance(raw, bool):
        raw = str(raw)
    m = REPORT_REF.fullmatch(raw) if isinstance(raw, str) else None
    if m:
        return f"R{int(m[1])}"
    if strict:
        raise Refused(400, "bad_request", "open must be a report's id (R12 or 12).")
    return ""


def _test_id(raw, strict: bool = True) -> str:
    if raw in (None, ""):
        return ""
    if isinstance(raw, int) and not isinstance(raw, bool):
        raw = str(raw)
    if isinstance(raw, str) and re.fullmatch(r"\d{1,9}", raw):
        return raw
    if strict:
        raise Refused(400, "bad_request", "t must be a test's id.")
    return ""


LABS_VIEWS = {"labs": lambda b: reads.labs(_report_open(b.get("view_open"), strict=False)),
              "labs_tests": lambda b: reads.labs_tests(b["view_q"][:60] if isinstance(b.get("view_q"), str) else "",
                                                       _test_id(b.get("view_t"), strict=False)),
              "labs_meds": lambda b: reads.labs_meds()}


@route("/labs", "GET")
def labs_read(request, _body, session):
    """The Reports tab: ?open=R12 or 12 (the report open; one that is not there: none open, as app.); and the session's Undo."""
    return {"labs": reads.labs(_report_open(request.query_params.get("open"))), "undo": _undo_out(session.get("undo"))}


@route("/labs/tests", "GET")
def labs_tests_read(request, _body, session):
    """Tests over time: ?q= (cut at 60) and ?t=<test id> (not digits: 400; unknown: no test, as app.)."""
    qp = request.query_params
    return {"labs_tests": reads.labs_tests(qp.get("q", "")[:60], _test_id(qp.get("t"))), "undo": _undo_out(session.get("undo"))}


@route("/labs/meds", "GET")
def labs_meds_read(_request, _body, session):
    return {"labs_meds": reads.labs_meds(), "undo": _undo_out(session.get("undo"))}


LL, ML = labspage.LIMITS, labspage.MED_LIMITS


def _day_text(body: dict, name: str):
    """A date field: None when left out, "" when null (empty), else the text as sent (weblabs says when it is not a date)."""
    if name not in body:
        return None
    v = body[name]
    if v is None:
        return ""
    if not isinstance(v, str):
        raise Refused(400, "bad_request", f"{name} must be a date yyyy-mm-dd or null.")
    return v.strip()[:20]


def _keep(new, old) -> str:
    """A form field: left out = as it is now (app.'s form comes filled in), null = empty."""
    return old if new is None else new


def _lab_value_fields(b: dict) -> tuple[dict, str]:
    vid = _int(b, "id")
    value, unit, ref = _short(b, "value", LL["value_max"]), _short(b, "unit", LL["unit_max"]), _short(b, "ref", LL["ref_max"])
    with connect() as c:
        r = c.execute(f"SELECT {labspage.RESULT_COLS} FROM lab_results v JOIN lab_tests t ON t.id = v.test_id WHERE v.id = %s", (vid,)).fetchone()
    now = labspage.printed(r) if r else ("", "", "")
    return ({"id": f"V{vid}", "value": _keep(value, now[0]), "unit": _keep(unit, now[1]), "ref": _keep(ref, now[2])},
            f"R{r['report_id']}" if r else "")


def _lab_report_fields(b: dict) -> tuple[dict, str]:
    rid = _int(b, "id")
    got = {"collected": _day_text(b, "collected"),
           **{k: _short(b, k, n) for k, n in (("title", LL["title_max"]), ("provider", LL["provider_max"]), ("notes", LL["notes_max"]))}}
    with connect() as c:
        p = c.execute("SELECT collected_date, title, provider, notes FROM lab_reports WHERE id = %s", (rid,)).fetchone()
    now = {"collected": p["collected_date"].isoformat(), "title": p["title"] or "", "provider": p["provider"] or "", "notes": p["notes"] or ""} if p else {}
    return {"id": f"R{rid}", **{k: _keep(v, now.get(k, "")) for k, v in got.items()}}, f"R{rid}"


def _med_fields(b: dict) -> tuple[dict, str]:
    mid = _int(b, "id")
    if b.get("act") not in ("save", "end"):
        raise Refused(400, "bad_request", "act must be save or end.")
    f = {"id": f"D{mid}", "act": b["act"]}
    if b["act"] == "save":
        got = {**{k: _short(b, k, n) for k, n in (("dose", ML["dose_max"]), ("frequency", ML["frequency_max"]), ("indication", ML["indication_max"]))},
               "start": _day_text(b, "start"), "stop": _day_text(b, "stop")}
        with connect() as c:
            m = c.execute("SELECT dose, frequency, indication, start_date, stop_date FROM medications WHERE id = %s", (mid,)).fetchone()
        now = ({"dose": m["dose"] or "", "frequency": m["frequency"] or "", "indication": m["indication"] or "",
                "start": m["start_date"].isoformat() if m["start_date"] else "", "stop": m["stop_date"].isoformat() if m["stop_date"] else ""}
               if m else {})
        f.update({k: _keep(v, now.get(k, "")) for k, v in got.items()})
    return f, ""


LABS_FORMS = {  # action -> (the form's fields from the body and the report it belongs to, weblabs' function, the view by default)
    "value": (_lab_value_fields, weblabs.value, "labs"),
    "report": (_lab_report_fields, weblabs.report, "labs"),
    "med": (_med_fields, weblabs.med, "labs_meds"),
}
assert all(weblabs.ACTIONS[a] is fn for a, (_f, fn, _v) in LABS_FORMS.items())


def _labs_route(action: str):
    fields, fn, view = LABS_FORMS[action]

    def handler(_request, body, session):
        f, report = fields(body)
        if body.get("confirmed") is True:
            f["confirmed"] = "1"
        form = Form({**f, "back": labspage.url("/web/labs/meds" if action == "med" else "/web/labs", open=report)})
        shown = dict(body)
        if report and "view_open" not in shown:  # the Reports tab answers with the report of the change open
            shown["view_open"] = report
        return saved(session, _work(lambda: fn(form, None)), shown, view=view)
    handler.__name__ = f"labs_{action}"
    handler.__doc__ = f"app.'s /web/labs/{action} (weblabs.ACTIONS[{action!r}]); no key, no Undo; see docs/API.md."
    return handler


for _action in LABS_FORMS:
    route(f"/labs/{_action}", "POST")(_labs_route(_action))


# ---- Settings and notifications (deploy 110) -----------------------------------------------------------------------------------------
# app.'s Settings tabs as data (reads.settings_*: settingspage's, coachpage's and export's data functions, which app.'s tabs draw from),
# and their forms through app.'s own functions (websettings.ACTIONS, coach.goals_set) with their checks and words. As on app.: no key
# (one sent is ignored) and no Undo (a change ends the session's Undo bar, as app.'s Settings forms do). Each save answers in the save
# shape with the fresh tab (view settings_<tab>; the body's view chooses another). A field left out stays as it is now (the door
# fills it in as app.'s form comes filled in), except Food targets, where a new row of targets is always all nine values (as app.).
# Not here: the gratitude goal (it stays at app. with the gratitude list). Notifications for this address: POST /push/subscribe keeps
# the browser's subscription with origin 'logger' (migration 032), so its nudges open logger.'s pages (nudges.link_for).

SETTINGS_VIEWS = {"settings_targets": lambda s: reads.settings_targets(), "settings_today": lambda s: reads.settings_today(),
                  "settings_body": lambda s: reads.settings_body(), "settings_coach": lambda s: reads.settings_coach(),
                  "settings_devices": reads.settings_devices, "settings_notify": reads.settings_notify,
                  "settings_export": lambda s: reads.settings_export()}


def _settings_read(tab: str):
    name = f"settings_{tab}"

    def handler(_request, _body, session):
        return {name: SETTINGS_VIEWS[name](session), "undo": _undo_out(session.get("undo"))}
    handler.__name__ = f"{name}_read"
    handler.__doc__ = f"app.'s Settings > {tab} as data (reads.{name}); see docs/API.md."
    return handler


for _tab in ("targets", "today", "body", "coach", "devices", "notify", "export"):
    route(f"/settings/{_tab}", "GET")(_settings_read(_tab))


def _setting(session, body: dict, fn, form: dict, view: str) -> dict:
    """One Settings save: app.'s function on the form (Form), answered in the save shape with the fresh tab."""
    f = Form(form)
    return saved(session, _work(lambda: fn(f, None, session)), body, view=view)


@route("/settings/targets", "POST")
def settings_targets_save(_request, body, session):
    """New food targets from a day: valid_from (yyyy-mm-dd), the nine values (numbers; left out or null: no target), note."""
    form = {"valid_from": _day_text(body, "valid_from") or "", "note": _short(body, "note", 200) or ""}
    form.update({k: _number(k, body.get(k)) for k, _l, _u in settingspage.TARGET_FIELDS})
    return _setting(session, body, websettings.targets, form, "settings_targets")


@route("/settings/height", "POST")
def settings_height_save(_request, body, session):
    """The height from a day: valid_from (yyyy-mm-dd), height (cm)."""
    form = {"valid_from": _day_text(body, "valid_from") or "", "height": _number("height", body.get("height"))}
    return _setting(session, body, websettings.height, form, "settings_body")


def _keys(body: dict, name: str):
    """A list of keys (strings); None when left out."""
    v = body.get(name)
    if v is None:
        return None
    if not isinstance(v, list) or not all(isinstance(x, str) for x in v):
        raise Refused(400, "bad_request", f"{name} must be a list of keys.")
    return v


@route("/settings/body", "POST")
def settings_body_save(_request, body, session):
    """How often body measurements are due (interval, whole days) and which measures show (show: the keys shown); left out: as now."""
    now = reads.settings_body()
    n = body.get("interval")
    if n is not None and (not isinstance(n, int) or isinstance(n, bool)):
        raise Refused(400, "bad_request", "interval must be a whole number.")
    show = _keys(body, "show")
    form = {"interval": str(now["interval"]["days"] if n is None else n),
            "show": [m["key"] for m in now["measures"] if m["shown"]] if show is None else show}
    return _setting(session, body, websettings.body_settings, form, "settings_body")


TODAY_KINDS = ("habit", "health", "usual", "review", "card")


def _today_form(sent: dict) -> dict:
    """The groups sent ({kind: [{id, shown}]} in the wanted order) as app.'s Today page form would post them: show_<kind>_<id> and
    pos_<kind>_<id>. A group not sent, and an item of a group not in its list, as they are now (an item left out goes after the sent
    ones, in its present order); an id that is not one of the group's is ignored."""
    form = {}
    with connect() as c, c.cursor() as cur:
        prefs = uiprefs.load(cur)
        groups = settingspage.today_items(cur)
    for kind, _heading, items in groups:
        items = uiprefs.ordered(items, lambda i: i[0], prefs["order"].get(kind, []))
        known = {i for i, _l in items}
        listed, shown = [], {}
        for x in sent.get(kind) or []:
            i = str(x["id"])
            if i in known and i not in shown:
                listed.append(i)
                shown[i] = x["shown"]
        listed += [i for i, _l in items if i not in shown]
        for n, i in enumerate(listed, 1):
            if shown.get(i, f"{kind}:{i}" not in prefs["hidden"]):
                form[f"show_{kind}_{i}"] = "1"
            form[f"pos_{kind}_{i}"] = str(n)
    return form


@route("/settings/today", "POST")
def settings_today_save(_request, body, session):
    """What shows on Today: groups {habit|health|usual|review|card: [{id, shown}]}, each list in the wanted order (one tap saves its
    whole group); stored as app.'s form stores it (uiprefs.save: hidden and order)."""
    groups = body.get("groups")
    if not isinstance(groups, dict):
        raise Refused(400, "bad_request", "groups must be an object of lists of {id, shown}.")
    for kind, items in groups.items():
        if kind not in TODAY_KINDS:
            raise Refused(400, "bad_request", "groups: the groups are " + ", ".join(TODAY_KINDS[:-1]) + " and " + TODAY_KINDS[-1] + ".")
        if not isinstance(items, list) or not all(isinstance(x, dict) and isinstance(x.get("id"), (str, int)) and not isinstance(x.get("id"), bool)
                                                  and isinstance(x.get("shown"), bool) for x in items):
            raise Refused(400, "bad_request", f"groups.{kind} must be a list of {{id, shown}}.")
    return _setting(session, body, websettings.today, _today_form(groups), "settings_today")


@route("/settings/today_reset", "POST")
def settings_today_reset(_request, body, session):
    """Everything on Today again, in the default order (uiprefs.reset)."""
    return _setting(session, body, websettings.today_reset, {}, "settings_today")


@route("/settings/coach", "POST")
def settings_coach_save(_request, body, session):
    """Settings > Coach: goals, style (text; left out: as now), parts {day: [keys on], week: [keys on]} (a kind left out: as now; parts
    left out: the switches stay); "Keep at least one part …" refused with app.'s words."""
    now = reads.settings_coach()
    form = {"goals": now["goals"], "style": now["style"]}
    for k in ("goals", "style"):
        v = _short(body, k, 10 * coach.GOALS_MAX)
        if v is not None:
            if len("\n".join(" ".join(line.split()) for line in v.splitlines()).strip()) > coach.GOALS_MAX:  # as coach._clean reads it, uncut
                raise Refused(400, "bad_request", f"{k} must be {coach.GOALS_MAX} characters or fewer.")
            form[k] = v
    parts = body.get("parts")
    if parts is not None:
        if not isinstance(parts, dict) or any(kind not in coach.PARTS for kind in parts):
            raise Refused(400, "bad_request", "parts must be {day: [keys], week: [keys]}.")
        form["parts"] = "1"
        for kind in now["kinds"]:
            on = _keys(parts, kind["kind"])
            for p in kind["parts"]:
                if (p["key"] in on) if on is not None else p["on"]:
                    form[f"show_{kind['kind']}_{p['key']}"] = "1"
    return _setting(session, body, coach.goals_set, form, "settings_coach")


# app.'s refusal for the device in use points to app.'s Sign out at the top; logger.'s Sign out is on More
DEVICE_WORDS = {"This is the device you are using; use Sign out at the top.": "This is the device you are using; use Sign out on More."}


@route("/settings/device", "POST")
def settings_device(_request, body, session):
    """Sign one other device out (id: the device's id from GET /settings/devices; at app. or here)."""
    out = _work(lambda: websettings.device(Form({"sid": text(body, "id", 40)}), None, session))
    if out.get("reason") in DEVICE_WORDS:
        out = {**out, "reason": DEVICE_WORDS[out["reason"]]}
    return saved(session, out, body, view="settings_devices")


@route("/settings/others", "POST")
def settings_others(_request, body, session):
    """Sign every other device out, at app. and here (websettings.others)."""
    return _setting(session, body, websettings.others, {}, "settings_devices")


NUDGE_SWITCHES = ("on",) + tuple(k for k, *_x in settingspage.NUDGE_ROWS) + tuple(k for k, *_x in settingspage.NUDGE_SWITCH_ROWS)
NUDGE_HOURS = tuple(hk for _k, hk, *_x in settingspage.NUDGE_ROWS)


@route("/settings/nudges", "POST")
def settings_nudges(_request, body, session):
    """The nudges: on and each switch (true or false), each hours field (a number; clamped to its range in half hours, as app.); a field
    left out stays as it is now (nudges.save stores the whole value: the door fills in every field)."""
    with connect() as c, c.cursor() as cur:
        now = nudges.load(cur)
    form = {}
    for k in NUDGE_SWITCHES:
        v = _bool(body, k)
        if v if v is not None else now[k]:
            form[k] = "1"
    for hk in NUDGE_HOURS:
        v = body.get(hk)
        form[hk] = str(now[hk]) if v is None else _number(hk, v, clear=False)
    return _setting(session, body, websettings.nudge_settings, form, "settings_notify")


@route("/push/subscribe", "POST")
def push_subscribe(_request, body, session):
    """Notifications on this device (the browser's subscription: endpoint, keys {p256dh, auth}, user_agent): app.'s checks (a known
    push service, valid keys), kept with origin 'logger' and this session (this: true in GET /settings/notify)."""
    keys = body.get("keys")
    if not isinstance(keys, dict):
        raise Refused(400, "bad_request", "keys must be {p256dh, auth}.")
    endpoint = text(body, "endpoint", 1000)
    p256dh, auth_key = text(keys, "p256dh", 200), text(keys, "auth", 100)
    if not webpush.allowed(endpoint) or not webpush.valid_keys(p256dh, auth_key):
        out = {"outcome": "rejected", "reason": "Not a known push service."}
    else:
        def keep():
            with connect() as c:
                c.execute("""INSERT INTO push_subscriptions (endpoint, p256dh, auth, user_agent, session_sid, origin) VALUES (%s, %s, %s, %s, %s, 'logger')
                             ON CONFLICT (endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth, user_agent = EXCLUDED.user_agent,
                               session_sid = EXCLUDED.session_sid, origin = EXCLUDED.origin, failures = 0""",
                          (endpoint, p256dh, auth_key, text(body, "user_agent", 300), session["sid"]))
                logbook._audit(c.cursor(), "web_change", "changed", {"what": "notifications on"}, logbook.WEB)
            return {"outcome": "changed", "head": "Notifications are on for this device."}
        out = _work(keep)
    return saved(session, out, body, view="settings_notify")


@route("/push/off", "POST")
def push_off(_request, body, session):
    """Notifications off for one device (id from GET /settings/notify's subscriptions; here or at app.)."""
    return _setting(session, body, websettings.push_off, {"id": str(_int(body, "id"))}, "settings_notify")


@route("/push/test", "POST")
def push_test(_request, body, session):
    """A test notification to every device (websettings.nudge_test); each opens its own address's Notifications tab."""
    return _setting(session, body, websettings.nudge_test, {}, "settings_notify")


CODE_NEEDED = "The export with private entries needs the authenticator code. Nothing was exported."
CODE_WRONG = "Wrong authenticator code (or one used already). Nothing was exported."


def _private_code(code: str, session) -> None:
    """Core 37 (21.11.2026): private and gratitude entries leave only with the authenticator code, checked as at a sign-in
    (web.sign_in): each code once (owner_credentials.last_totp_step, the row locked while it is checked), a wrong or missing code
    counted as a failed try of this session's device (login_failures, the sign-in's pool of a known device), and the sign-in's
    limit (auth.MAX_FAILURES in auth.FAILURE_WINDOW_MIN minutes) for both. Raises Refused; returns when the code is right."""
    pool = session.get("device_hash")
    refused = None  # raised after the transaction, so the failed try is kept (an error inside it would roll it back)
    with connect() as c:
        c.execute("DELETE FROM login_failures WHERE at < now() - interval '1 day'")
        fails = c.execute("""SELECT count(*) AS n FROM login_failures WHERE device_hash IS NOT DISTINCT FROM %s
                             AND at > now() - make_interval(mins => %s)""", (pool, auth.FAILURE_WINDOW_MIN)).fetchone()["n"]
        owner = c.execute("SELECT totp_secret, last_totp_step FROM owner_credentials WHERE id = 1 FOR UPDATE").fetchone()
        step = auth.check_totp(owner["totp_secret"], code, owner["last_totp_step"]) if owner and code else None
        if fails >= auth.MAX_FAILURES:
            refused = Refused(429, "too_many_tries", f"Too many failed attempts. Try again in {auth.FAILURE_WINDOW_MIN} minutes. Nothing was exported.")
        elif not step:
            c.execute("INSERT INTO login_failures (device_hash) VALUES (%s)", (pool,))
            refused = Refused(403, "wrong_code", CODE_WRONG if code else CODE_NEEDED)
        else:
            c.execute("UPDATE owner_credentials SET last_totp_step = %s WHERE id = 1", (step,))
            c.execute("DELETE FROM login_failures WHERE device_hash IS NOT DISTINCT FROM %s", (pool,))
    if refused:
        raise refused


@route("/export", "POST", download=True)
def export_download(_request, body, session):
    """The ZIP of everything logged (export.download, as app.'s /web/settings/export: the same file, file name and audit row);
    private: true adds private.csv, and needs code, the authenticator code (Core 37: _private_code). The answer is the file itself
    (application/zip), not JSON; a failure is JSON (500; a wrong or missing code 403 wrong_code, too many tries 429)."""
    private = _bool(body, "private")
    if private:
        _private_code(text(body, "code", 20), session)
    try:
        data, name = export.download(Form({"private": "1"} if private else {}), session)
    except Exception as e:  # noqa: BLE001 - the kind only
        log.error("the export failed: %s", type(e).__name__)
        raise Refused(500, "server_error", export.FAILED) from None
    return Download(data, "application/zip", name)

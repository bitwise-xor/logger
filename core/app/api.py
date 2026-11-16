"""The JSON door for the new front end (16.11.2026, deploys 75 and 76; plan in the doc's Current tab, "New front end"; routes
and shapes in docs/API.md). Only the front end's own server calls it, from inside Docker: Caddy never forwards /api/ (its
app. site passes / and /web/* only) and the tunnel's calls carry Cloudflare's headers. Every route goes through one check
(route below), in this order, and each failure looks the same (404), so the door's existence is not revealed:
  1. the door is on: FRONT_TOKEN is set, 32 characters or more (config.py; unset = every path here answers 404);
  2. the call comes from inside Docker: Host logger-v2-core:8000, no Cloudflare or proxy headers;
  3. the front end's service token in X-Front-Token (compared on SHA-256 digests, in constant time);
then, for every route but the sign-in, the owner's session as "Authorization: Bearer <token>" (a web_sessions row of this
front end, migration 031; a session of app. never works here and the reverse). A session renews like a page view (30 days
from its last use); the end comes back in the X-Session-Expires header. Every answer is JSON with "v": 1, never cached.
The reads are reads.py; the saves call the same functions as the live forms (webactions, webfood, logbook, webundo)."""
import hashlib
import hmac
import json
import logging
from datetime import date, datetime, timedelta, timezone

from starlette.concurrency import run_in_threadpool
from starlette.requests import Request
from starlette.responses import JSONResponse

from . import reads, web
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
def day(request, _body, _session):
    return {"day": reads.day(day_param(request))}


@route("/food/day", "GET")
def food_day(request, _body, _session):
    return {"food_day": reads.food_day(day_param(request))}


@route("/food/entry", "GET")
def food_entry(request, _body, _session):
    e = reads.food_entry(request.query_params.get("ref", "")[:12])
    if e is None:
        raise Refused(404, "no_entry", "That entry is not there any more.")
    return {"entry": e}

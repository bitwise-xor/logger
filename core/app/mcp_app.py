"""MCP adapter: thin. It exposes the core's operations as tools and holds no rules."""
import functools
import json
import logging
from typing import Any, Optional

from mcp.server.auth.middleware.auth_context import get_access_token
from mcp.server.mcpserver import MCPServer
from mcp.server.mcpserver.exceptions import ToolError
from mcp.server.transport_security import TransportSecuritySettings
from starlette.concurrency import run_in_threadpool
from starlette.requests import Request
from starlette.responses import JSONResponse

from . import logbook
from mcp.server.auth.settings import AuthSettings, ClientRegistrationOptions

from . import api, auth, hubtools, reads, watch, web
from .config import EXTRA_ALLOWED_HOSTS, MCP_PATH, PUBLIC_URL
from .db import connect

_LOG = logging.getLogger("logger.tools")  # not `log`: that is the name of the log tool below
provider = auth.OwnerProvider(PUBLIC_URL)
# The only tools the hub's service token may call (auth.hub_access). Every other tool refuses it; a new tool is closed to it until
# named here. `log` and `answer` (20.11.2026, the hub's chat bar: what the owner types there, look-ups included, and Logger's
# follow-up questions) reach every look-up and change command, lab values, food and notes included: a leaked hub token can read
# and change almost everything through them; only replies that name private or gratitude entries are cut (_for_hub). What keeps
# a leaked token out is where it may come from: since 21.11.2026 it is taken only on a call from inside the server, never
# through the tunnel (auth.from_inside).
HUB_TOOLS = {"today_summary", "tick_habit", "untick_habit", "add_water", "set_checkin", "log", "answer"}


def _not_for_hub(name: str) -> None:
    """Refuse the call when the request came with the hub's token and the tool is not one of the hub's: before the tool does
    anything (no AI call, no audit row, no write). The owner's sign-in tokens (Claude) pass, as does a call from inside the app."""
    token = get_access_token()  # the SDK's: the access token of the request being handled, None outside one
    if token is not None and token.client_id == auth.HUB_CLIENT and name not in HUB_TOOLS:
        _LOG.warning("tool %s refused: called with the hub's token", name)
        raise ToolError(f"{name} is not available to the hub: its token may call only {', '.join(sorted(HUB_TOOLS))}.")


def _for_hub(name: str, out):
    """log's and answer's reply to the hub's token: one that names private or gratitude entries (a look-up such as "show my
    private notes", a change of P12, a private line saved) keeps its outcome only: no words and no question, so the hub cannot
    confirm a change of one either (reads.names_private, the web door's rule, fail closed). Any other reply passes as it is."""
    token = get_access_token()
    if name not in ("log", "answer") or token is None or token.client_id != auth.HUB_CLIENT \
            or not reads.names_private(json.dumps(out, default=str)):
        return out
    made = out.get("outcome") == "saved" and (out.get("private_id") or out.get("private_ids"))
    return {"outcome": out.get("outcome"), "message": "Saved privately." if made else reads.HIDDEN, "questions": []}


def _logged(fn):
    """A tool that fails leaves one line on the container's log: the tool and the kind of error, never what the user said."""
    @functools.wraps(fn)
    def inner(*args, **kwargs):
        _not_for_hub(fn.__name__)
        try:
            return _for_hub(fn.__name__, fn(*args, **kwargs))
        except Exception as e:  # noqa: BLE001 - logged, then raised as before
            _LOG.error("tool %s failed: %s", fn.__name__, type(e).__name__)
            raise
    return inner

mcp = MCPServer(
    "logger-v2",
    auth_server_provider=provider,
    auth=AuthSettings(
        issuer_url=PUBLIC_URL, resource_server_url=PUBLIC_URL + MCP_PATH, validate_token_resource=False,
        client_registration_options=ClientRegistrationOptions(enabled=True, valid_scopes=[auth.SCOPE], default_scopes=[auth.SCOPE]),
        required_scopes=[auth.SCOPE],
    ),
    instructions=("Personal logger. Pass each message the user wants logged to `log`, word for word; the logger reads it. "
                  "Show its reply briefly. When it asks a question, ask the user and pass the reply to `answer`."),
)


@mcp.tool()
@_logged
def log(text: str, idempotency_key: Optional[str] = None) -> dict[str, Any]:
    """Log one user message (food, drinks, health values, habits, thoughts, private or gratitude lines) in the user's
    exact words, to-dos and shopping (they go to Todoist); also look-ups and changes ("what did I eat yesterday", "the apple
    was 150 g", "got the milk", "undo").
    Not for other questions to you. idempotency_key: a new unique string per message, the same on a retry."""
    return logbook.log(text, idempotency_key)


@mcp.tool()
@_logged
def add_food(name: str, kcal: float, protein: float, fat: float, carbs: float, source: str, sat_fat: Optional[float] = None,
             fibre: Optional[float] = None, sugar_total: Optional[float] = None, sugar_added: Optional[float] = None,
             sodium_mg: Optional[float] = None, caffeine_mg: Optional[float] = None, basis: str = "g",
             source_note: Optional[str] = None, state: Optional[str] = None, drink: bool = False,
             question_id: Optional[str] = None, aliases: Optional[list[str]] = None) -> dict[str, Any]:
    """Add a food missing from the catalogue, values per 100 g (basis ml: per 100 ml). source: label (read from the
    user's photo), database (name it in source_note) or estimate. Name in English, brand in brackets. A label's
    "sugar" is sugar_total; sodium_mg = salt g x 400; leave out what is not printed. question_id: the open food
    question, so the waiting item is saved with it. aliases: other words the user uses for it."""
    values = dict(kcal=kcal, protein=protein, fat=fat, carbs=carbs, source=source, sat_fat=sat_fat, fibre=fibre,
                  sugar_total=sugar_total, sugar_added=sugar_added, sodium_mg=sodium_mg, caffeine_mg=caffeine_mg,
                  basis=basis, source_note=source_note, state=state, drink=drink)
    return logbook.add_food(name, values, question_id, aliases)


@mcp.tool()
@_logged
def food_words(food_id: int, words: list[str], means: bool = False) -> dict[str, Any]:
    """Teach the logger words for a food it knows (N id): each word then finds that food. means=true when the user says
    a word now means this product ("waffle now means N250")."""
    return logbook.food_words(food_id, words, means)


@mcp.tool()
@_logged
def food_lookup(barcode: Optional[str] = None, name: Optional[str] = None, question_id: Optional[str] = None) -> dict[str, Any]:
    """Look up a food the catalogue does not know: by barcode (the digits under the bars, from the user's photo or words)
    in Open Food Facts, or by name in USDA and Open Food Facts. question_id: the open food question it answers.
    Show the user the values it returns; the food is added only after their yes (answer)."""
    return logbook.food_lookup(barcode, name, question_id)


@mcp.tool()
@_logged
def lab_report(text: str, corrections: Optional[str] = None, source: str = "image") -> dict[str, Any]:
    """A lab or imaging report from the user's photo or PDF: text = everything on all pages written out exactly as printed
    (values, units, ranges, names, dates; never converted or translated). source: image or document. Returns a read-back
    table: show it whole; the user's yes goes to answer; for a correction call again with the same text and corrections."""
    return logbook.lab_report(text, corrections, source)


@mcp.tool()
@_logged
def answer(question_id: str, reply: str) -> dict[str, Any]:
    """Answer a question from `log` with the user's reply: a food name or N number, an amount, yes, or skip."""
    return logbook.answer(question_id, reply)


# ---- the hub's tools (13.11.2026, hubtools.py): the home dashboard calls them with its service token (auth.hub_access) ----

@mcp.tool()
@_logged
def today_summary() -> dict[str, Any]:
    """A read-only summary of today for a dashboard: food and water against the targets, the habits with their last 7 days,
    health values, and what waits (items to review, open questions, chores), each with a link into the web app.
    Numbers and names only, never the user's notes. Not for answering the user in a chat: use log for look-ups."""
    return hubtools.today_summary()


@mcp.tool()
@_logged
def tick_habit(name: str, idempotency_key: Optional[str] = None) -> dict[str, Any]:
    """Dashboard button: tick a habit once for today, as a tap on the web app's Today page. name: the habit's name from
    today_summary. idempotency_key: a new unique string per tap, the same on a retry."""
    return hubtools.tick_habit(name, idempotency_key)


@mcp.tool()
@_logged
def untick_habit(name: str) -> dict[str, Any]:
    """Dashboard button: take today's last tick of a habit off again. name: the habit's name from today_summary."""
    return hubtools.untick_habit(name)


@mcp.tool()
@_logged
def add_water(ml: int = 250, idempotency_key: Optional[str] = None) -> dict[str, Any]:
    """Dashboard button: log water drunk now, 50 to 2000 ml (a glass is 250), as the Today page's water button.
    idempotency_key as for tick_habit."""
    return hubtools.add_water(ml, idempotency_key)


@mcp.tool()
@_logged
def set_checkin(mood: Optional[int] = None, energy: Optional[int] = None, idempotency_key: Optional[str] = None) -> dict[str, Any]:
    """Dashboard button: today's check-in, mood and energy from 1 (low) to 5 (high), one or both.
    idempotency_key as for tick_habit."""
    return hubtools.set_checkin(mood, energy, idempotency_key)


@mcp.custom_route("/health", methods=["GET"])
async def health(_: Request) -> JSONResponse:
    return JSONResponse({"status": "ok", "service": "logger-v2-core"})


def _db_reachable() -> bool:
    try:
        with connect() as c:
            c.execute("SELECT 1")
        return True
    except Exception as e:  # noqa: BLE001 - any failure means "not ready"
        _LOG.error("database check failed: %s", type(e).__name__)
        return False


@mcp.custom_route("/ready", methods=["GET"])
async def ready(_: Request) -> JSONResponse:
    """/health says the app runs; /ready also needs the database (for the uptime monitor). Nothing else is revealed."""
    ok = await run_in_threadpool(_db_reachable)
    return JSONResponse({"status": "ok" if ok else "unavailable", "database": "ok" if ok else "down"}, status_code=200 if ok else 503)


auth.add_login_routes(mcp, provider)
web.add_routes(mcp)
watch.add_routes(mcp)
api.add_routes(mcp)  # the new front end's JSON door /api/v1 (16.11.2026), off until FRONT_TOKEN is set


def build_app():
    hosts = ["127.0.0.1:*", "localhost:*", *EXTRA_ALLOWED_HOSTS]
    app = mcp.streamable_http_app(
        streamable_http_path=MCP_PATH, stateless_http=True, json_response=True,
        transport_security=TransportSecuritySettings(enable_dns_rebinding_protection=True, allowed_hosts=hosts, allowed_origins=[]),
    )
    app.add_middleware(auth.InsideMiddleware)  # outermost: marks a call from inside before the token check (auth.hub_access)
    app.add_exception_handler(Exception, web.server_error)  # a page of the web app that fails: the error page in the app's layout
    return app

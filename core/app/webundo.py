"""Undo for the web app's buttons (31.10.2026): the last change made with a button can be taken back from a bar that
stays until the device's next action (web.py done keeps it in web_sessions.undo). A save that logged a message (a tick,
a value, a usual meal, an Again chip) is undone by the chat's own undo of that message; a delete or a correction of a
food entry, a tick or a health value is undone by putting the rows back as they were just before it. A usual meal's change
or delete (deploy 86) is undone by putting the meal and its items back, and for a delete the past entries' links to it; a new
usual meal is undone by removing it again."""
import hmac
import secrets
import time
from typing import Optional

import psycopg
from psycopg.types.json import Jsonb

from . import held, logbook
from .db import connect

TABLES = {"f": "food_entries", "m": "measurements", "e": "events"}


def undoable(ref: str) -> bool:
    return len(ref) > 1 and ref[0] in TABLES and ref[1:].isdigit()


def snapshot(refs: list[str]) -> list[dict]:
    """The rows as they are now (to_jsonb, so every column comes back exactly), for refs like f12, e5, m3."""
    rows = []
    with connect() as c:
        for ref in refs:
            table = TABLES[ref[0]]  # one of three fixed names
            r = c.execute(f"SELECT to_jsonb(x) AS j FROM {table} x WHERE x.id = %s", (int(ref[1:]),)).fetchone()
            if r:
                rows.append({"t": table, "row": r["j"]})
    return rows


def usual_snapshot(uid: int) -> Optional[dict]:
    """A usual meal as it is now, for its Undo: the meal row, its items and the food entries logged with it (a delete unlinks
    them). None when there is no such meal."""
    with connect() as c:
        meal = c.execute("SELECT to_jsonb(u) AS j FROM usual_meals u WHERE id = %s", (uid,)).fetchone()
        if not meal:
            return None
        items = c.execute("SELECT to_jsonb(i) AS j FROM usual_meal_items i WHERE meal_id = %s ORDER BY id", (uid,)).fetchall()
        links = c.execute("SELECT id FROM food_entries WHERE usual_meal_id = %s ORDER BY id", (uid,)).fetchall()
    return {"meal": meal["j"], "items": [r["j"] for r in items], "links": [r["id"] for r in links]}


MAX_AGE_S = 15 * 60  # the Undo bar goes after 15 minutes: an old copy put back could undo a later change made elsewhere (04.11.2026)


def fresh(rec) -> bool:
    """Whether an Undo record is still offered (records from before 04.11.2026 have no time and are not)."""
    return bool(rec) and time.time() - float(rec.get("at") or 0) < MAX_AGE_S


def record(resp: dict, rows: Optional[list] = None) -> Optional[dict]:
    """What the Undo bar offers after this reply (with the time it was made), or None (then the bar goes away)."""
    rec = _record(resp, rows)
    return rec and {**rec, "at": time.time()}


def settle(resp: dict) -> tuple[bool, Optional[dict]]:
    """After an action (web.py done, and the JSON door's saves in api.py): takes the rows before a change out of resp (kept for
    Undo, never shown) -> (whether the device's Undo record is replaced, the new record or None). Every action replaces the
    last one's Undo (or clears it), except a double tap's repeat or a refusal: they changed nothing, and wiping the Undo of
    the change just made lost it (until 04.11.2026)."""
    rows = resp.pop("undo_rows", None)
    new = record(resp, rows)
    return new is not None or not (resp.get("replayed") or resp.get("outcome") == "rejected"), new


def matches(rec, token) -> bool:
    """Whether an Undo record is still offered and this is its token (compared in constant time)."""
    return fresh(rec) and hmac.compare_digest(str(token or ""), str(rec.get("token", "")))


def _record(resp: dict, rows: Optional[list] = None) -> Optional[dict]:
    if resp.get("held_undo"):  # an unread message deleted on Today or Recent (held.py)
        return {"token": secrets.token_urlsafe(12), "head": resp.get("head") or "Deleted.", "held": int(resp["held_undo"])}
    if resp.get("gym_undo") and not resp.get("replayed"):  # a gym tick or a removed gym row (gym.py)
        return {"token": secrets.token_urlsafe(12), "head": (resp.get("head") or "Saved.")[:160], "gym": resp["gym_undo"]}
    if resp.get("home_undo") and not resp.get("replayed"):  # a chore tick or a removed history row (home.py)
        return {"token": secrets.token_urlsafe(12), "head": (resp.get("head") or "Saved.")[:160], "home": resp["home_undo"]}
    if resp.get("usual_undo") and resp.get("outcome") == "changed" and not resp.get("replayed"):  # a usual meal (webfood, 86)
        return {"token": secrets.token_urlsafe(12), "head": (resp.get("head") or "Changed.")[:160], "usual": resp["usual_undo"]}
    if resp.get("outcome") == "changed" and rows:
        return {"token": secrets.token_urlsafe(12), "head": resp.get("head") or "Changed.", "rows": rows}
    if resp.get("raw_id") and resp.get("outcome") in ("saved", "partly_saved") and not resp.get("replayed"):
        said = "; ".join(str(x) for x in resp.get("receipt") or [])
        head = resp.get("head") or (f"Saved: {said}" if said else "Saved.")
        return {"token": secrets.token_urlsafe(12), "head": head[:160], "raw_id": resp["raw_id"]}
    return None


def apply(rec: dict) -> dict:
    """Undo one record: the logged message through the chat's undo, or the rows put back (same ids) in one transaction."""
    if rec.get("raw_id"):
        from .webactions import undo  # here, not at the top: webactions imports this module
        return undo(str(rec["raw_id"]))
    if rec.get("gym"):
        from .gym import undo as gym_undo  # here: gym imports logbook, like this module
        return gym_undo(rec["gym"])
    if rec.get("home"):
        from .home import undo as home_undo  # here: home imports logbook, like this module
        return home_undo(rec["home"])
    if rec.get("usual"):
        return usual_undo(rec["usual"])
    if rec.get("held"):
        if held.restore(int(rec["held"])):
            return {"outcome": "changed", "head": "The unread message is back."}
        return {"outcome": "rejected", "head": "Nothing undone.", "reason": "That message is gone for good."}
    days, ids = set(), []
    with connect() as conn, conn.cursor() as cur:
        for item in rec.get("rows") or []:
            table, row = item["t"], item["row"]
            if table not in TABLES.values():
                continue
            cur.execute(f"DELETE FROM {table} WHERE id = %s RETURNING day::text AS day", (row["id"],))
            gone = cur.fetchone()
            cur.execute(f"INSERT INTO {table} SELECT * FROM jsonb_populate_record(NULL::{table}, %s)", (Jsonb(row),))
            if table == "food_entries":
                days.update(d for d in (row.get("day"), gone and gone["day"]) if d)
            ids.append(f"{table}:{row['id']}")
        for d in sorted(days):  # meal numbers follow the times again (the 2-hour rule)
            cur.execute("SELECT assign_meals(%s::date)", (d,))
        logbook._audit(cur, "web_change", "changed", {"what": "undo", "ids": ids}, logbook.WEB)
    return {"outcome": "changed", "head": "Undone."}


def usual_undo(u: dict) -> dict:
    """A usual meal's change put back (usual_snapshot: the row, its items with their ids, the entries' links), or a new one
    removed again (u["remove"]; entries logged with it in the meantime keep their values, as after a delete)."""
    try:
        with connect() as conn, conn.cursor() as cur:
            if u.get("remove"):
                uid = int(u["remove"])
                cur.execute("UPDATE food_entries SET usual_meal_id = NULL WHERE usual_meal_id = %s", (uid,))
                cur.execute("DELETE FROM usual_meals WHERE id = %s RETURNING name", (uid,))
                gone = cur.fetchone()
                head = f'Undone: "{gone["name"]}" is no longer a usual meal.' if gone else "Undone."
            else:
                meal = u["meal"]
                uid = int(meal["id"])
                cur.execute("""UPDATE usual_meals m SET name = r.name, aliases = r.aliases, note = r.note, is_drink = r.is_drink
                               FROM jsonb_populate_record(NULL::usual_meals, %s) r WHERE m.id = %s""", (Jsonb(meal), uid))
                if not cur.rowcount:
                    cur.execute("INSERT INTO usual_meals SELECT * FROM jsonb_populate_record(NULL::usual_meals, %s)", (Jsonb(meal),))
                cur.execute("DELETE FROM usual_meal_items WHERE meal_id = %s", (uid,))
                for item in u.get("items") or []:
                    cur.execute("INSERT INTO usual_meal_items SELECT * FROM jsonb_populate_record(NULL::usual_meal_items, %s)", (Jsonb(item),))
                if u.get("links"):
                    cur.execute("UPDATE food_entries SET usual_meal_id = %s WHERE id = ANY(%s) AND usual_meal_id IS NULL", (uid, u["links"]))
                head = f'Undone: the usual meal "{meal["name"]}" is back as it was.'
            logbook._audit(cur, "web_change", "changed", {"what": "undo usual", "ids": [uid]}, logbook.WEB)
    except psycopg.errors.UniqueViolation:  # another usual meal took its old name in the meantime
        return {"outcome": "rejected", "head": "Nothing undone.",
                "reason": f'Another usual meal is called "{u["meal"]["name"]}" now. Rename that one first, then change this one by hand.'}
    return {"outcome": "changed", "head": head}

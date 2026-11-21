"""A one-line note on a meal (21.11.2026, the Food space at logger.; migration 033). The note on a single food stays
food_entries.note (webfood.note).

Meal numbers are not stable: assign_meals renumbers a day's meals by time whenever its entries change. So a note is not kept
against a meal number but anchored to a time, `at`, and belongs to the meal of the day's food entry nearest to `at` (drinks left
out, they have no meal; ties: the earlier entry). A day with no such entry left shows its notes as a note on the day. This module
is the one place that works that out (resolve); the Food day, the notes list, the save, Search and the export all read it here.

- A meal renumbered by an earlier entry added later keeps its note (its entries did not move).
- Two meals that merge show one note, the newest (updated_at); the next save on that meal keeps one row and deletes the others.
- When a meal's entries are deleted, its note moves to the meal nearest in time (where a newer note of that meal wins).

Saving a note for meal M of a day: `at` becomes the time of that meal's first entry, the notes that resolve to that meal now are
replaced by the one (the newest row is kept and changed, the others deleted), and an empty text removes them."""
from datetime import date, datetime  # noqa: F401 - datetime: the type of at
from typing import Optional

from .db import connect

MAX_NOTE = 300


def label(meal: Optional[int]) -> Optional[str]:
    """A meal's label as v_food_day names it: "Meal 2", "Drinks" (meal 0); none for a note on the day."""
    if meal is None:
        return None
    return "Drinks" if meal == 0 else f"Meal {meal}"


def entries(cur, days: list) -> dict:
    """day -> the day's food entries that are not drinks [{id, eaten_at, meal, time_known}], by time."""
    if not days:
        return {}
    cur.execute("""SELECT id, day, eaten_at, meal, time_known FROM food_entries WHERE day = ANY(%s) AND NOT is_drink
                   ORDER BY day, eaten_at, id""", (list(days),))
    out: dict = {}
    for r in cur.fetchall():
        out.setdefault(r["day"], []).append(r)
    return out


def meal_of(at: datetime, rows: list) -> Optional[int]:
    """The meal of the entry nearest to `at` (ties: the earlier entry, then the lower id); None when the day has none."""
    if not rows:
        return None
    best = min(rows, key=lambda e: (abs((e["eaten_at"] - at).total_seconds()), e["eaten_at"], e["id"]))
    return best["meal"]


def resolve(notes: list, rows: list) -> dict:
    """The notes of ONE day, each to where it is shown: meal number -> [notes], newest first (updated_at, then id); None -> the
    notes on the day (no meal left). The first of each list is the one shown."""
    out: dict = {}
    for n in notes:
        out.setdefault(meal_of(n["at"], rows), []).append(n)
    for lst in out.values():
        lst.sort(key=lambda n: (n["updated_at"], n["id"]), reverse=True)
    return out


def of_days(cur, days: list) -> dict:
    """day -> resolve(...) of that day, for every day asked that has a note."""
    if not days:
        return {}
    cur.execute("SELECT id, day, at, note, created_at, updated_at FROM food_meal_notes WHERE day = ANY(%s) ORDER BY id", (list(days),))
    notes: dict = {}
    for r in cur.fetchall():
        notes.setdefault(r["day"], []).append(r)
    rows = entries(cur, list(notes))
    return {d: resolve(ns, rows.get(d, [])) for d, ns in notes.items()}


def shown(cur, day: date) -> tuple[dict, Optional[str]]:
    """(meal number -> the note shown on it, the note shown on the day when no meal is left) for the Food day."""
    r = of_days(cur, [day]).get(day, {})
    return {m: ns[0]["note"] for m, ns in r.items() if m is not None}, (r[None][0]["note"] if None in r else None)


def clean(text) -> str:
    """The note as saved: whitespace collapsed (as webfood.note), at most 300 characters."""
    return " ".join(str(text or "").split())[:MAX_NOTE]


def _rejected(reason: str) -> dict:
    return {"outcome": "rejected", "reason": reason}


def save(day: date, meal: int, text: str, today: date) -> dict:
    """The note of meal `meal` (1, 2, …) of `day`; 0 = the note on a day that has no meal left. Empty text removes it.
    -> an answer for api.saved: changed ("Meal note saved." / "Meal note removed."), unchanged, or rejected with the reason."""
    if day > today:
        return _rejected("That day has not started yet.")
    note = clean(text)
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT pg_advisory_xact_lock(hashtext('food_meal_notes'), %s)", (day.toordinal(),))
        rows = entries(cur, [day]).get(day, [])
        cur.execute("SELECT id, day, at, note, created_at, updated_at FROM food_meal_notes WHERE day = %s", (day,))
        where = resolve(cur.fetchall(), rows)
        if meal == 0:
            if rows:
                return _rejected("This day has meals: a note goes on one of them.")
            at, mine = None, where.get(None, [])
        else:
            first = [e for e in rows if e["meal"] == meal]
            if not first:
                return _rejected("That meal is not there any more.")
            at, mine = first[0]["eaten_at"], where.get(meal, [])
        if not note:
            if not mine:
                return {"outcome": "unchanged", "head": "There was no note to remove."}
            cur.execute("DELETE FROM food_meal_notes WHERE id = ANY(%s)", ([n["id"] for n in mine],))
            return {"outcome": "changed", "head": "Meal note removed." if meal else "Note removed."}
        if mine:
            keep, drop = mine[0], [n["id"] for n in mine[1:]]
            if drop:
                cur.execute("DELETE FROM food_meal_notes WHERE id = ANY(%s)", (drop,))
            if keep["note"] == note and (at is None or keep["at"] == at) and not drop:
                return {"outcome": "unchanged", "head": "Nothing changed."}
            cur.execute("UPDATE food_meal_notes SET note = %s, at = coalesce(%s, at), updated_at = now() WHERE id = %s", (note, at, keep["id"]))
        else:
            cur.execute("INSERT INTO food_meal_notes (day, at, note) VALUES (%s, %s, %s)", (day, at, note))
    return {"outcome": "changed", "head": "Meal note saved." if meal else "Note saved."}


def listed(cur, start: date, end: date) -> list:
    """Every meal note shown in [start, end] (one per meal, the newest; a day's note when no meal is left) and every food note,
    newest first (day, then time), for the Notes tab, the export and Search."""
    cur.execute("SELECT DISTINCT day FROM food_meal_notes WHERE day BETWEEN %s AND %s", (start, end))
    days = [r["day"] for r in cur.fetchall()]
    resolved = of_days(cur, days)
    rows = entries(cur, days)
    out = []
    for d, where in resolved.items():
        meals: dict = {}
        for e in rows.get(d, []):
            meals.setdefault(e["meal"], []).append(e)
        for m, ns in where.items():
            n = ns[0]
            first = meals[m][0] if m is not None else None
            out.append({"kind": "meal" if m is not None else "day", "day": d, "meal": m, "label": label(m),
                        "at": first["eaten_at"] if first and first["time_known"] else None, "note": n["note"], "id": n["id"],
                        "updated_at": n["updated_at"], "sort": first["eaten_at"] if first else None})
    cur.execute("""SELECT e.id, e.day, e.eaten_at, e.time_known, e.meal, f.name, e.amount, f.basis, e.portion_text, e.note
                   FROM food_entries e JOIN foods f ON f.id = e.food_id
                   WHERE e.day BETWEEN %s AND %s AND e.note IS NOT NULL AND e.note <> ''""", (start, end))
    for r in cur.fetchall():
        out.append({"kind": "food", "day": r["day"], "meal": r["meal"], "label": label(r["meal"]), "ref": f"f{r['id']}",
                    "food": r["name"], "amount": r["amount"], "unit": r["basis"], "portion_text": r["portion_text"],
                    "at": r["eaten_at"] if r["time_known"] else None, "note": r["note"], "id": r["id"], "sort": r["eaten_at"]})
    # newest day first; in a day the latest first (a note on the day before its meals' notes), a meal's note before its foods'
    out.sort(key=lambda x: (x["day"], x["sort"].timestamp() if x["sort"] else float("inf"), x["kind"] != "food", x["id"]), reverse=True)
    for x in out:
        x.pop("sort")
    return out

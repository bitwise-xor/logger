"""The middle layer's reads (16.11.2026, the new front end): Today's day and the Food page's day as plain JSON values, for the
JSON door (api.py) and the hub's today_summary (hubtools.py), so the pages, the door and the hub read the same numbers.
Built on the live pages' own reads (todaypage.load, foodpage._day_rows, webquestions.load, held.rows, gratitude); the live
pages are not changed by it. Values are raw: numbers, ISO 8601 times (Europe/Berlin, with the offset), minutes; no display
strings. Private and gratitude words never come out of here (the gratitude lines as a count only, a thought to review by its
type only, a not-read message that carries a private label without its words)."""
import re
from datetime import date, datetime
from typing import Optional

from . import foodpage, gratitude, held, privateline, todaypage, uiprefs, webquestions
from .db import connect
from .rules import BERLIN
from .webentry import readable

REF = re.compile(r"f\d{1,9}")
# The logger's own texts name private and gratitude entries as "P12" and "... private entries:" (v1_commands._find_private,
# commands._private_between, change previews): a text that does is never passed on by the door, whatever else it says (fail closed).
PRIVATE = re.compile(r"\bP\d{1,12}\b|(?i:private entr)")
HIDDEN = "Not shown here: it is about private or gratitude entries. Open it in the app."


def names_private(*texts) -> bool:
    return any(t and PRIVATE.search(str(t)) for t in texts)


def num(x):
    """A plain JSON number from a database value (Decimal): whole numbers without ".0"; None stays None."""
    if x is None:
        return None
    v = float(x)
    return int(v) if v == int(v) else v


def iso(x) -> Optional[str]:
    """A moment as ISO 8601 in Berlin time with its offset; a date as yyyy-mm-dd; None stays None."""
    if x is None:
        return None
    if isinstance(x, datetime):
        return x.astimezone(BERLIN).isoformat()
    return x.isoformat()


def minutes(a, b) -> Optional[int]:
    return round((b - a).total_seconds() / 60) if a is not None and b is not None else None


def _macros(r) -> dict:
    return {k: num(r[k]) if r else 0 for k, _l, _u in todaypage.MACROS}


# ---- shared with the hub (hubtools.today_summary) ------------------------------------------------------

def snapshot(asked: Optional[date] = None) -> dict:
    """todaypage.load's dict plus, for today only, the open questions (webquestions.load) and the messages not read yet
    (held.rows), as Today shows them above the page."""
    d = todaypage.load(asked)
    today = d["day"] == d["today"]
    d["questions"] = webquestions.load() if today else []
    d["held"] = held.rows() if today else []
    return d


def totals(d: dict, cur) -> tuple[dict, dict]:
    """(the day's kcal, protein, fat, carbs; the targets of that day). Nothing eaten yet: the day has no total row to bring the
    targets (v_food_day), so they are read from food_targets."""
    total = next((r for r in d["food"] if r["meal"] is None), None)
    return _macros(total), targets(cur, d["day"], total)


def targets(cur, day: date, total=None) -> dict:
    if total:
        t = {k: total["target_" + k] for k, _l, _u in todaypage.MACROS}
    else:
        cur.execute("SELECT kcal, protein, fat, carbs FROM food_targets WHERE valid_from <= %s ORDER BY valid_from DESC LIMIT 1", (day,))
        t = cur.fetchone() or {}
    return {k: num(t.get(k)) for k, _l, _u in todaypage.MACROS}


def habits_shown(d: dict) -> list:
    """The habits as Today lists them: without the hidden ones, in the chosen order (todaypage._habit_section)."""
    prefs = d["prefs"]
    return uiprefs.ordered([h for h in d["habits"] if uiprefs.shown("habit", h["type_name"], prefs)],
                           lambda h: h["type_name"], prefs["order"].get("habit", []))


# ---- Today ------------------------------------------------------------------------------------------------

def _health_rows(cur, day: date) -> list:
    """The day's values and events (weight, blood pressure, sugar, mood, energy, tape measures, wake-up, bed, habit ticks ...)."""
    cur.execute("""SELECT 'm' || m.id AS ref, 'measurement' AS kind, t.name AS type, t.label, t.unit, m.value1, m.value2, m.period,
                          m.event_at AS at, m.time_known, m.needs_review
                     FROM measurements m JOIN log_types t ON t.id = m.type_id WHERE m.day = %s
                   UNION ALL
                   SELECT 'e' || e.id, 'event', t.name, t.label, t.unit, NULL, NULL, NULL, e.event_at, e.time_known, e.needs_review
                     FROM events e JOIN log_types t ON t.id = e.type_id WHERE e.day = %s""", (day, day))
    return cur.fetchall()


def _eaten(cur, day: date) -> dict:
    """id -> (eaten_at, time_known) of the day's food entries (the views give the clock time only)."""
    cur.execute("SELECT id, eaten_at, time_known FROM food_entries WHERE day = %s", (day,))
    return {r["id"]: (r["eaten_at"], r["time_known"]) for r in cur.fetchall()}


def _food_row(f: dict, eaten: dict, note: bool = False) -> dict:
    at, known = eaten.get(f["id"], (None, False))
    row = {"ref": f"f{f['id']}", "kind": "food", "meal": f["meal"], "at": iso(at) if known else None, "time_known": bool(known),
           "food": f["food"], "amount": num(f["amount"]), "unit": f["unit"], "portion_text": f["portion_text"],
           "nutrients": _macros(f)}
    if "usual_meal_id" in f:
        row["usual_meal"] = {"id": f["usual_meal_id"], "name": f["usual"]} if f["usual_meal_id"] else None
    if "food_id" in f:
        row["food_id"] = f["food_id"]
    if note:
        row["note"] = f["note"]
    return row


def _value_row(r: dict) -> dict:
    return {"ref": r["ref"], "kind": r["kind"], "type": r["type"], "label": r["label"], "at": iso(r["at"]) if r["time_known"] else None,
            "time_known": bool(r["time_known"]), "v1": num(r["value1"]), "v2": num(r["value2"]), "unit": r["unit"], "period": r["period"],
            "needs_review": bool(r["needs_review"])}


def _health_card(d: dict, by_ref: dict) -> list:
    """The Health card's rows (Settings > Today page: shown ones, in the chosen order), each with the entry it edits. Twelve
    hours after the wake-up Woke up and Bed are for the next sleep (todaypage._next_sleep): no entry, the last time in last_at."""
    h, raw, prefs = d["health"], d["raw"], d["prefs"]
    rows = [r for r in todaypage.HEALTH_ROWS if uiprefs.shown("health", r[0], prefs)]
    rows = uiprefs.ordered(rows, lambda r: r[0], prefs["order"].get("health", []))
    out = []
    for key, label, sub, ltype, period, unit in rows:
        cell = h.get(key) or {}
        ref = cell.get("id") or None
        entry = by_ref.get(ref) if ref else None
        item = {"row": key, "label": label, "sub": sub or None, "type": ltype, "period": period, "unit": unit or None, "ref": ref,
                "v1": num(entry["value1"]) if entry and entry["kind"] == "measurement" else None,
                "v2": num(entry["value2"]) if entry and entry["kind"] == "measurement" else None,
                "at": iso(entry["at"]) if entry and entry["time_known"] else None, "last_at": None}
        if key in ("wake", "bed") and raw["next_sleep"] and not ref:
            item["last_at"] = iso(raw["wake_at"] if key == "wake" else raw["bed_at"])
        out.append(item)
    return out


def _review(r: dict) -> dict:
    """An item to review. A thought is named by its type and area only: its words never leave through the door."""
    thought = r["kind"] == "thought"
    return {"ref": r["ref"], "kind": r["kind"], "label": None if thought else r["what"], "day": iso(r["day"]), "reason": r["reason"] or "",
            "at": iso(r["at"]), "thought_type": r["a"] if thought else None, "area": r["b"] if thought else None,
            "type": r["a"] if r["kind"] == "measurement" else None, "time": r["a"] if r["kind"] == "event" else None,
            "v1": num(r["v1"]), "v2": num(r["v2"]), "unit": r["unit"]}


def _ans(reply: str, label: str) -> dict:
    return {"reply": reply, "label": label}


SKIP = _ans("skip", "Skip")


def question(q: dict) -> dict:
    """An open question as webquestions.card shows it, as data: the text, a read-back to show first, the answers as buttons
    (each a reply for POST /api/v1/answer), a free answer field, a found food's values, the message it came from."""
    p, tool = q["payload"], q["tool"]
    kind = p.get("kind") if tool == "log" else None
    out = {"id": q["id"], "tool": tool, "kind": kind, "asked_at": iso(q["created_at"]), "open_until": iso(q["expires_at"]),
           "message": q["message"], "text": q["reason"] or "", "read_back": None, "answers": [], "free": None, "lookup": None,
           "refill": None}
    if tool == "log" and kind == "food":
        word = (p.get("item") or {}).get("food", "")
        lk = p.get("lookup")
        out["text"] = f'Not in your catalogue: "{word}".' if lk else f'Which food is "{word}"?'
        if lk:
            v = lk.get("values", {})
            out["lookup"] = {"name": lk.get("name", ""), "source": "usda" if lk.get("src") == "usda" else "off",
                             "per_100": {k: v.get(k) for k in ("kcal", "protein", "fat", "carbs")}}
            out["answers"].append(_ans("yes", "Use it" if lk.get("existing") else "Add this food"))
        out["answers"] += [_ans(f"N{i}", q["foods"][i]["name"]) for i in p.get("candidates") or [] if i in q["foods"]]
        out["free"] = {"placeholder": "Another food: name or N number", "type": "text", "unit": None}
        out["answers"].append(SKIP)
    elif tool == "log" and kind == "amount":
        f = q["foods"].get(p.get("food_id")) or {}
        out["free"] = {"placeholder": "Amount", "type": "number", "unit": f.get("basis", "g")}
        out["answers"].append(SKIP)
    elif tool == "log" and kind in ("time", "type"):
        out["refill"] = q["message"] or None
        out["answers"].append(SKIP)
    elif tool == "home_choice":
        out["text"] = (q["reason"] or "").split(" 1. ")[0]
        out["answers"] = [_ans(f"H{i}", c["label"]) for i, c in enumerate(p.get("cands") or [], 1)] + [_ans("all", "All of them"), SKIP]
    elif tool == "log_confirm" and p.get("nap"):
        out.update(read_back=readable(q["reason"]), text="A new day, or up from a nap or a night waking?",
                   answers=[_ans("yes", "New day"), _ans("nap", "Nap or night waking"), _ans("no", "Neither, drop it")])
    elif tool in webquestions._YES_NO and not (tool == "command_confirm" and p.get("ask_past")):
        out.update(read_back=readable(q["reason"]), text=webquestions._YES_NO[tool], answers=[_ans("yes", "Yes"), _ans("no", "No")])
        if tool in webquestions._CORRECTABLE and q["message"]:
            out["refill"] = q["message"]
    elif tool == "command_confirm":
        out.update(read_back=readable(q["reason"]), text="Change the past entries too?",
                   answers=[_ans("yes", "Yes, past ones too"), _ans("no", "Only new ones"), _ans("cancel", "Cancel")])
    else:  # which entry was meant, which shopping item, ...
        out["free"] = {"placeholder": "Your answer", "type": "text", "unit": None}
        out["answers"].append(SKIP)
    if names_private(out["text"], out["read_back"]):  # a change or look-up of private entries: its words stay at app.
        out.update(text=HIDDEN, read_back=None)
    return out


def _not_read(r: dict) -> dict:
    words = None if privateline.label(r["content"]) else r["content"]  # never the case (labelled lines are not kept), by design
    err = r["last_error"] or ""
    return {"id": r["id"], "received_at": iso(r["received_at"]), "text": words, "tries": r["tries"],
            "needs_you": err.startswith(held.NEEDS_YOU), "reading": r["reading_since"] is not None}


def _usual(d: dict) -> list:
    prefs = d["prefs"]
    meals = [kv for kv in d["usual"].items() if uiprefs.shown("usual", kv[0][0], prefs)]
    meals = uiprefs.ordered(meals, lambda kv: kv[0][0], prefs["order"].get("usual", []))
    out = []
    for (meal_id, name), items in meals:
        its = [{"item_id": i["id"], "food": i["name"], "amount": num(i["grams"]), "unit": i["basis"],
                "nutrients": {k: num(round(float(i[k] or 0) * float(i["grams"]) / 100, 1)) for k, _l, _u in todaypage.MACROS}}
               for i in items]
        out.append({"meal_id": meal_id, "name": name, "items": its,
                    "nutrients": {k: num(round(sum(float(x["nutrients"][k]) for x in its), 1)) for k, _l, _u in todaypage.MACROS}})
    return out


def day(asked: Optional[date] = None) -> dict:
    """Everything the new Today shows for a logging day (today, or an earlier day asked for)."""
    d = snapshot(asked)
    the_day, raw = d["day"], d["raw"]
    with connect() as conn, conn.cursor() as cur:
        tot, tgt = totals(d, cur)
        eaten = _eaten(cur, the_day)
        values = _health_rows(cur, the_day)
        grat = {"count": gratitude.count(cur, the_day), "goal": gratitude.goal(cur)}
    by_ref = {r["ref"]: r for r in values}
    rows = [(eaten.get(f["id"], (None, False)), _food_row(f, eaten)) for f in d["foods"]]
    rows += [((r["at"], r["time_known"]), _value_row(r)) for r in values]
    rows.sort(key=lambda x: (not x[0][1], x[0][0] or datetime.min.replace(tzinfo=BERLIN), x[1]["ref"]))
    water = d["water"] or {}
    tick = d["last_tick"]
    ci = None
    if d["ci_day"]:
        ci = {"day": iso(d["ci_day"]), **{k: d["ci_got"].get(k) for k, _l, _w in todaypage.CHECKIN},
              "scale": {k: list(words) for k, _l, words in todaypage.CHECKIN}}
    return {
        "day": iso(the_day), "today": iso(d["today"]), "past": d["past"],
        "header": {"wake_at": iso(raw["wake_at"]), "slept_minutes": minutes(raw["slept_from"], raw["wake_at"]),
                   "awake_minutes": minutes(raw["wake_at"], raw["awake_until"]),
                   "naps": [{"bed_at": iso(n["bed_at"]), "wake_at": iso(n["wake_at"]), "minutes": minutes(n["bed_at"], n["wake_at"])}
                            for n in raw["naps"]],
                   "next_sleep": raw["next_sleep"], "watch_wake_at": iso(d["watch_up"])},
        "needs": {"questions": [question(q) for q in d["questions"]], "not_read": [_not_read(r) for r in d["held"]],
                  "review": [_review(r) for r in d["review"]], "checkin": ci},
        "energy": {"totals": tot, "targets": tgt,
                   "meals": [{"meal": r["meal"], "label": r["meal_label"], "nutrients": _macros(r)} for r in d["food"] if r["meal"] is not None]},
        "water": {"ml": num(water.get("drunk")) or 0, "target_ml": num(water.get("target")), "glass_ml": todaypage.WATER_GLASS},
        "chips": {"again": [{"food_id": a["id"], "name": a["name"], "amount": num(a["amount"]), "unit": a["basis"]} for a in d["again"]],
                  "usual": _usual(d)},
        "rows": [r for _k, r in rows],
        "health": _health_card(d, by_ref),
        "habits": [{"name": h["type_name"], "label": h["label"], "done": h["done"], "target": h["target"], "complete": bool(h["complete"]),
                    "avoid": h["type_name"] in d["avoid"], "last_tick": f"e{tick[h['type_name']]}" if h["type_name"] in tick else None}
                   for h in habits_shown(d)],
        "gratitude": grat,
    }


# ---- the Food page's day ---------------------------------------------------------------------------------

def food_day(asked: Optional[date] = None) -> dict:
    """One day of the food log: its entries with amount, unit and nutrients, the meals' sums, the day's totals and targets."""
    with connect() as conn, conn.cursor() as cur:
        today = foodpage._today(cur)
        the_day = min(asked, today) if asked else today
        sums, items = foodpage._day_rows(cur, the_day)
        eaten = _eaten(cur, the_day)
        total = next((r for r in sums if r["meal"] is None), None)
        tgt = targets(cur, the_day, total)
    return {"day": iso(the_day), "today": iso(today), "past": the_day < today,
            "rows": [_food_row(i, eaten, note=True) for i in items],
            "meals": [{"meal": r["meal"], "label": r["meal_label"], "nutrients": _macros(r)} for r in sums if r["meal"] is not None],
            "totals": _macros(total), "targets": tgt}


def food_entry(ref: str) -> Optional[dict]:
    """One food entry with the units its amount can be given in (the food's basis, then its own units, foodpage._entry_panel).
    None when there is no such entry."""
    if not REF.fullmatch(str(ref or "")):
        return None
    with connect() as c:
        e = c.execute("""SELECT e.id, e.day, e.food_id, e.amount, e.eaten_at, e.time_known, e.note, f.name, f.basis FROM food_entries e
                         JOIN foods f ON f.id = e.food_id WHERE e.id = %s""", (int(ref[1:]),)).fetchone()
        if not e:
            return None
        units = c.execute("SELECT unit, grams FROM food_units WHERE food_id = %s ORDER BY grams, unit", (e["food_id"],)).fetchall()
    return {"ref": ref, "day": iso(e["day"]), "food_id": e["food_id"], "food": e["name"], "amount": num(e["amount"]), "unit": e["basis"],
            "at": iso(e["eaten_at"]) if e["time_known"] else None, "time_known": bool(e["time_known"]), "note": e["note"],
            "units": [{"unit": e["basis"], "in_basis": 1}] + [{"unit": u["unit"], "in_basis": num(u["grams"])} for u in units]}

"""The middle layer's reads (16.11.2026, the new front end): Today's day and the Food page's day as plain JSON values, for the
JSON door (api.py) and the hub's today_summary (hubtools.py), so the pages, the door and the hub read the same numbers.
Built on the live pages' own reads (todaypage.load, foodpage._day_rows, webquestions.load, held.rows, gratitude); the live
pages are not changed by it. Values are raw: numbers, ISO 8601 times (Europe/Berlin, with the offset), minutes; no display
strings. Private and gratitude words never come out of here (the gratitude lines as a count only, a thought to review by its
type only, a not-read message that carries a private label without its words)."""
import re
from datetime import date, datetime, timedelta
from typing import Optional

from . import activitypage, body as tape, bodypage, coach, coachpage, export, foodpage, gratitude, gym as gymlib, gympage, habitspage, healthpage, held, home as homelib, homepage, insightspage, labspage, nudges, privateline, recentpage, searchpage, settingspage, todaypage, trendspage, uiprefs, usagepage, v1_commands, webpush, webquestions, weekpage
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


# Sentences in the logger's texts that tell the chat app what to do next ("resend with confirmed=true", "call add_food again"):
# a person never sees them (deploy 77, the door review of 16.11.2026).
CHAT = re.compile(r"resend|confirmed=true|call add_food|call answer|ask the user|ask which one|show the user|with the user|answer the user",
                  re.I)


def plain(text) -> Optional[str]:
    """A read-back or question as a person reads it: webentry.readable, then without the sentences meant for the chat app.
    A line without such a sentence stays exactly as it was (tables keep their spacing)."""
    if not text:
        return None
    out = []
    for ln in readable(str(text)).splitlines():
        if not CHAT.search(ln):
            out.append(ln)
            continue
        kept = [part for part in re.split(r"(?<=[.!?;])\s+", ln) if not CHAT.search(part)]
        if kept:
            out.append(" ".join(kept).rstrip(";").rstrip())
    return "\n".join(out).strip() or None


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
        if key == "bed" and ref and not entry:  # the night's bed belongs to the day before: its time is the one Today found
            item["at"] = iso(raw["bed_at"])
        if key in ("wake", "bed") and raw["next_sleep"] and not ref:
            item["last_at"] = iso(raw["wake_at"] if key == "wake" else raw["bed_at"])
        out.append(item)
    return out


def _happened(cur, refs: list) -> dict:
    """ref -> when it happened (eaten_at or event_at; None when the time is not known), for the items to review: they can be
    from any day, so the day's rows do not have them all."""
    ids = {k: [int(r[1:]) for r in refs if r[0] == k] for k in "fme"}
    out = {}
    for k, sql in (("f", "SELECT id, eaten_at AS at, time_known FROM food_entries WHERE id = ANY(%s)"),
                   ("m", "SELECT id, event_at AS at, time_known FROM measurements WHERE id = ANY(%s)"),
                   ("e", "SELECT id, event_at AS at, time_known FROM events WHERE id = ANY(%s)")):
        if ids[k]:
            cur.execute(sql, (ids[k],))
            out.update({f"{k}{r['id']}": r["at"] if r["time_known"] else None for r in cur.fetchall()})
    return out


def _review(r: dict, happened: dict) -> dict:
    """An item to review. A thought is named by its type and area only: its words never leave through the door.
    at: when it happened (a thought: when it was logged); logged_at: when it was logged."""
    thought = r["kind"] == "thought"
    return {"ref": r["ref"], "kind": r["kind"], "label": None if thought else r["what"], "day": iso(r["day"]), "reason": r["reason"] or "",
            "at": iso(r["at"] if thought else happened.get(r["ref"])), "logged_at": iso(r["at"]),
            "thought_type": r["a"] if thought else None, "area": r["b"] if thought else None,
            "type": r["a"] if r["kind"] == "measurement" else None,
            "v1": num(r["v1"]), "v2": num(r["v2"]), "unit": r["unit"]}


def _ans(reply: str, label: str, style: str = "plain") -> dict:
    """An answer button; style as app. draws it: primary (the main one), plain, quiet (Skip, No, Cancel)."""
    return {"reply": reply, "label": label, "style": style}


SKIP = _ans("skip", "Skip", "quiet")


def question(q: dict) -> dict:
    """An open question as webquestions.card shows it, as data: the text, a read-back to show first, the answers as buttons
    (each a reply for POST /api/v1/answer, with its style), a free answer field, a found food's values (per 100 g or ml), the
    message it came from, and refill {label, text}: the button that puts the message back in the log box."""
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
                             "per_100": {k: v.get(k) for k in ("kcal", "protein", "fat", "carbs")}, "unit": "ml" if v.get("drink") else "g"}
            out["answers"].append(_ans("yes", "Use it" if lk.get("existing") else "Add this food", "primary"))
        out["answers"] += [_ans(f"N{i}", q["foods"][i]["name"]) for i in p.get("candidates") or [] if i in q["foods"]]
        out["free"] = {"placeholder": "Another food: name or N number", "type": "text", "unit": None}
        out["answers"].append(SKIP)
    elif tool == "log" and kind == "amount":
        f = q["foods"].get(p.get("food_id")) or {}
        out["free"] = {"placeholder": "Amount", "type": "number", "unit": f.get("basis", "g")}
        out["answers"].append(SKIP)
    elif tool == "log" and kind in ("time", "type"):
        out["refill"] = {"label": "Log again", "text": q["message"]} if q["message"] else None
        out["answers"].append(SKIP)
    elif tool == "home_choice":
        out["text"] = (q["reason"] or "").split(" 1. ")[0]
        out["answers"] = [_ans(f"H{i}", c["label"]) for i, c in enumerate(p.get("cands") or [], 1)] + [_ans("all", "All of them"), SKIP]
    elif tool == "log_confirm" and p.get("nap"):
        out.update(read_back=plain(q["reason"]), text="A new day, or up from a nap or a night waking?",
                   answers=[_ans("yes", "New day", "primary"), _ans("nap", "Nap or night waking"), _ans("no", "Neither, drop it", "quiet")])
    elif tool in webquestions._YES_NO and not (tool == "command_confirm" and p.get("ask_past")):
        out.update(read_back=plain(q["reason"]), text=webquestions._YES_NO[tool], answers=[_ans("yes", "Yes", "primary"), _ans("no", "No")])
        if tool in webquestions._CORRECTABLE and q["message"]:
            out["refill"] = {"label": "Correct it", "text": q["message"]}
    elif tool == "command_confirm":
        out.update(read_back=plain(q["reason"]), text="Change the past entries too?",
                   answers=[_ans("yes", "Yes, past ones too", "primary"), _ans("no", "Only new ones"), _ans("cancel", "Cancel", "quiet")])
    else:  # which entry was meant, which shopping item, ...
        out["free"] = {"placeholder": "Your answer", "type": "text", "unit": None}
        out["answers"].append(SKIP)
    out["text"] = plain(out["text"]) or ""
    # a change or look-up of private entries, or a message that names them ("change P12 to ..."): its words stay at app.
    if names_private(out["text"], out["read_back"], out["message"]) or privateline.label(out["message"] or ""):
        out.update(text=HIDDEN, read_back=None, message=None, refill=None)
    return out


def questions(ids: list) -> list:
    """The open questions with these ids, in this order, as Question objects (a save's new questions, deploy 77). One that is
    not open any more, or not one app. can answer, is left out."""
    if not ids:
        return []
    by_id = {q["id"]: q for q in webquestions.load()}
    return [question(by_id[i]) for i in dict.fromkeys(ids) if i in by_id]


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
        happened = _happened(cur, [r["ref"] for r in d["review"]])
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
                  "review": [_review(r, happened) for r in d["review"]], "checkin": ci, "body_due": body_due(d["body_due"])},
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
        "gym": None if d["past"] else gym_card(),
        # Today's Home card (deploy 98): as app.'s todaypage._home_card, none for a past day or when Settings > Today page hides it
        "home": None if d["past"] or not uiprefs.shown("card", "home", d["prefs"]) else home_card(),
        # Today's Coach card (deploy 107): as app.'s todaypage._coach_card, for the day shown (earlier days too), none when Settings >
        # Today page hides it
        "coach": coach_card(the_day) if uiprefs.shown("card", "coach", d["prefs"]) else None,
        # Settings > Today page's switches for the To review box and the Gratitude card (deploy 110), as app.'s todaypage reads them
        # ("review:box", "card:gratitude"); the parts above stay filled in, the front end hides them
        "shown": {"review": uiprefs.shown("review", "box", d["prefs"]), "gratitude": uiprefs.shown("card", "gratitude", d["prefs"])},
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


# ---- usual meals and the food search (deploy 86, the usual-meal editor at logger.) ----------------------------------------

def usual_rows(cur) -> dict:
    """(id, name, is_drink) -> the usual meal's items (food, grams, per-100 values) in their order, every usual meal by name; a
    meal without items has an empty list. The query of app.'s Usual meals tab (foodpage._usual_meals reads it here)."""
    cur.execute("""SELECT u.id, u.name, u.is_drink, i.id AS item, i.grams, f.id AS food_id, f.name AS food, f.basis,
                          f.kcal, f.protein, f.fat, f.carbs
                   FROM usual_meals u LEFT JOIN usual_meal_items i ON i.meal_id = u.id LEFT JOIN foods f ON f.id = i.food_id
                   ORDER BY lower(u.name), u.id, i.sort_order, i.id""")
    meals: dict = {}
    for r in cur.fetchall():
        meals.setdefault((r["id"], r["name"], r["is_drink"]), [])
        if r["item"]:
            meals[(r["id"], r["name"], r["is_drink"])].append(r)
    return meals


def _per(i: dict) -> dict:
    return {k: num(round(float(i[k] or 0) * float(i["grams"]) / 100, 1)) for k, _l, _u in todaypage.MACROS}


def usual() -> list:
    """Every usual meal and drink (also those hidden from Today's chips), by name: chips.usual's shape plus drink and each
    item's food_id."""
    with connect() as c, c.cursor() as cur:
        meals = usual_rows(cur)
    out = []
    for (meal_id, name, drink), items in meals.items():
        its = [{"item_id": i["item"], "food_id": i["food_id"], "food": i["food"], "amount": num(i["grams"]), "unit": i["basis"],
                "nutrients": _per(i)} for i in items]
        out.append({"meal_id": meal_id, "name": name, "drink": bool(drink), "items": its,
                    "nutrients": {k: num(round(sum(float(x["nutrients"][k]) for x in its), 1)) for k, _l, _u in todaypage.MACROS}})
    return out


FOODS_LIMIT = 20


def foods(q: str) -> list:
    """Up to 20 active foods for a search (the Catalogue's: name, word, N number or barcode; most eaten first; no words = the
    most eaten), each with its unit and values per 100 g or ml, to pick a food for a usual meal."""
    with connect() as c, c.cursor() as cur:
        rows = foodpage._food_list(cur, str(q or "")[:60], "all")[:FOODS_LIMIT]
    return [{"food_id": r["id"], "name": r["name"], "unit": r["basis"], "drink": bool(r["is_drink"]),
             "per_100": {k: num(r[k]) for k in ("kcal", "protein", "fat", "carbs")}} for r in rows]


def suggest_rows(cur) -> list:
    """Every active food for the entry box's suggestions, most eaten first, then by name: its name, basis, words (aliases), the
    amount eaten last (the newest entry's), how many entries there are and when the last one was. app.'s /web/foods.json and
    the door's GET /foods/suggest both read it here."""
    return cur.execute("""SELECT f.id, f.name, f.basis, f.aliases, x.amount, x.last, coalesce(x.n, 0) AS n FROM foods f
                          LEFT JOIN (SELECT food_id, count(*) AS n, (array_agg(amount ORDER BY eaten_at DESC, id DESC))[1] AS amount,
                                            max(eaten_at) AS last
                                     FROM food_entries GROUP BY food_id) x ON x.food_id = f.id
                          WHERE f.active ORDER BY n DESC, f.name""").fetchall()


def food_suggestions() -> list:
    """The door's GET /foods/suggest: every active food with its unit, words, last amount (null when never eaten), how often it
    was eaten and when last (null when never)."""
    with connect() as c, c.cursor() as cur:
        rows = suggest_rows(cur)
    return [{"food_id": r["id"], "name": r["name"], "unit": r["basis"], "words": list(r["aliases"] or []), "last_amount": num(r["amount"]),
             "eaten": r["n"], "last_at": iso(r["last"])} for r in rows]


# ---- the Health page and body measurements (deploy 91, step 1b of the move to logger.) -----------------------------------------

# The Health page's columns (healthpage.COLS) by the names the door's saves use (the Health card's rows, POST /health).
HEALTH_ROWS = {"w": "weight", "bm": "bp_morning", "be": "bp_evening", "s": "sugar", "bed": "bed", "wake": "wake", "mo": "mood", "en": "energy"}
KINDS = {1: "number", 2: "pair", "t": "time"}


def _hvalue(v, kind) -> Optional[dict]:
    """A day's value of one column (healthpage.day_values): the entry a change goes to, its numbers or its time hh:mm."""
    if not v:
        return None
    if kind == "t":
        return {"ref": v["id"], "v1": None, "v2": None, "time": v["v"][0], "at": iso(v.get("at"))}
    return {"ref": v["id"], "v1": num(float(v["v"][0])), "v2": num(float(v["v"][1])) if kind == 2 else None, "time": None, "at": None}


def health(days: int, show_all: bool = False) -> dict:
    """The Health page: the rows of its days (newest first: the last 14, or every day of the range), the five charts and the
    sleep times, as data (healthpage.load, charts, times_data: the same as app.'s page)."""
    d = healthpage.load(days)
    every, shown = healthpage.shown_days(d, show_all)
    return {
        "today": iso(d["today"]), "start": iso(d["start"]), "range": days, "ranges": list(healthpage.RANGES), "all": show_all,
        "days_in_range": len(every), "shown_days": healthpage.SHOWN_DAYS, "oldest_day": iso(d["today"] - timedelta(days=365)),
        "columns": [{"row": HEALTH_ROWS[col], "label": h, "sub": sub or None, "type": t, "period": per, "kind": KINDS[kind]}
                    for col, h, sub, t, per, kind in healthpage.COLS],
        "days": [{"day": iso(day), "values": {HEALTH_ROWS[col]: _hvalue(d["vals"].get(day, {}).get(col), kind)
                                              for col, _h, _s, _t, _p, kind in healthpage.COLS},
                  "slept_minutes": healthpage.slept_minutes(d, day)} for day in shown],
        "charts": healthpage.charts(d),
        "times": healthpage.times_data(d),
    }


def _r(x, n: int):
    return None if x is None else num(round(x, n))


def body(asked: Optional[date] = None, days: int = healthpage.DEFAULT_RANGE) -> dict:
    """The Body measurements card (bodypage.load): last measured and the due text, the session form of a day (today, or an earlier
    day asked for), the table Now / Last / Start, a chart per measure, waist ÷ height and the weight rate. days: the Health page's
    range, for the charts (a measure with fewer than 2 sessions in it shows every session)."""
    with connect() as c, c.cursor() as cur:
        today = c.execute("SELECT log_day(now()) AS d").fetchone()["d"]
        limits = tape.ranges(cur)
    the_day = min(asked, today) if asked else today
    b = bodypage.load(today, the_day)
    wh, rate = b["derived"]["waist_height"], b["derived"]["rate"]
    return {
        "today": iso(today), "day": iso(the_day), "last_measured": iso(b["last"]), "due_text": b["due_text"],
        "interval_days": b["prefs"]["interval"], "hidden": sorted(b["prefs"]["hidden"]), "jump_cm": tape.JUMP_CM,
        "protocol": tape.PROTOCOL, "hint": bodypage.HINT,
        "form": [{"key": k, "label": lbl, "hint": hint, "ref": b["now"][k]["id"] if k in b["now"] else None,
                  "cm": b["now"][k]["v"] if k in b["now"] else None, "last_cm": b["before"].get(k),
                  "min": num(limits[k][0]), "max": num(limits[k][1])} for k, lbl, hint in b["shown"]],
        "table": [{**{k: t[k] for k in ("key", "label", "ref", "cm")}, "day": iso(t["day"]),
                   "last": _r(t["last"], 1), "start": _r(t["start"], 1),
                   "last_text": tape.signed(t["last"]) if t["last"] is not None else None,
                   "start_text": tape.signed(t["start"]) if t["start"] is not None else None} for t in bodypage.table(b["sessions"], b["shown"])],
        "first_day": iso(b["sessions"][0]["day"]) if b["sessions"] else None,
        "charts": [{"key": k, "label": lbl, "chart": bodypage.chart_data(k, lbl, b["sessions"], today, days)}
                   for k, lbl in bodypage.charted(b["sessions"], b["shown"])],
        "waist_height": None if not wh else {"waist_cm": wh["waist"], "day": iso(wh["day"]), "height_cm": num(wh["height"]),
                                             "ratio": round(wh["waist"] / wh["height"], 2) if wh["height"] else None},
        "weight_rate": None if not rate else {"kg_week": _r(rate[0], 3), "pct_week": _r(rate[1], 3), "sign": bodypage.rate_sign(rate[0])},
    }


def body_due(due) -> Optional[dict]:
    """Today's "Body measurements due" line (body.due, bodypage.today_line): the last session and how many days ago, both None
    before the first one; None when not due."""
    return {"last": iso(due["last"]), "days": due["days"]} if due else None


# ---- the Habits page (deploy 93, step 1c of the move to logger.) ------------------------------------------------------------------

SQUARE = {"d": "done", "h": "partly", "x": "logged", "": "none"}  # the calendar's square classes (habitspage.day_state) as words


def habits(show: str = "tracked") -> dict:
    """The Habits page (habitspage.load, todo, calendar, sections, stats: the same as app.'s page): today's habits with "n of N done",
    the last 30 days of every tracked habit, "Your habits" for a filter (show: tracked, untracked, retired or all; else tracked)
    with its counts, and what the new-habit form and the forms need (the groups, the limits)."""
    show = show if show in dict(habitspage.SHOWS) else "tracked"
    with connect() as c, c.cursor() as cur:
        d = habitspage.load(cur)
    rows, n_done = habitspage.todo(d)
    avoid, n = d["avoid"], habitspage.counts(d["manage"])
    return {
        "today": iso(d["today"]), "start": iso(d["start"]), "days": habitspage.DAYS, "edit_from": iso(d["today"] - timedelta(days=habitspage.EDIT_DAYS)),
        "checklist": {"done": n_done, "total": len(rows),
                      "habits": [{"name": h["type_name"], "label": h["label"], "done": h["done"], "target": h["target"], "complete": bool(h["complete"]),
                                  "avoid": h["type_name"] in avoid,
                                  "last_tick": f"e{d['last_tick'][h['type_name']]}" if h["type_name"] in d["last_tick"] else None}
                                 for h in d["now"]]},
        "calendar": [{"name": r["h"]["name"], "label": r["h"]["label"], "target": r["target"], "avoid": r["avoid"], "full": r["full"],
                      "editable": r["h"]["name"] not in habitspage.LOCKED,
                      "days": [{"day": iso(day), "n": cnt, "state": SQUARE[cls], "text": words} for day, cnt, cls, words in r["days"]]}
                     for r in habitspage.calendar(d)],
        "show": show, "help": habitspage.HELP[show],
        "shows": [{"key": k, "label": label, "count": n[k]} for k, label in habitspage.SHOWS],
        "list": [{"group": cat, "label": title,
                  "habits": [{"name": r["name"], "label": r["label"], "group": r["category"], "target": r["daily_target"], "order": r["sort_order"],
                              "avoid": r["name"] in avoid, "state": habitspage.state(r), "ticks": r["ticks"], "days30": r["days30"],
                              "last_day": iso(r["last_day"]), "stats": habitspage.stats(r, d["today"]),
                              "can_track": bool(r["active"]), "can_delete": not r["ticks"]} for r in part]}
                 for cat, title, part in habitspage.sections(d, show)],
        "groups": [{"key": k, "label": v} for k, v in habitspage.GROUPS], "default_group": "practice",
        "limits": {"label_max": habitspage.LABEL_MAX, "target_min": habitspage.TARGET[0], "target_max": habitspage.TARGET[1],
                   "order_max": habitspage.ORDER_MAX},
    }


# ---- Gym (deploy 95, step 2 of the move to logger.) ---------------------------------------------------------------------------------

def gym_card() -> dict:
    """Today's Gym card (gympage.today_data): the last workout's day, today's day of the split, the last 14 days, this week and last."""
    t = gympage.today_data()
    return {"last_workout": iso(t["last"]), "day_label": t["day"],
            "days": [{"day": iso(x["day"]), "on": x["on"], "today": x["today"]} for x in t["days"]],
            "n14": t["n14"], "last_week": t["last_week"], "this_week": t["this_week"], "text": gympage.week_text(t)}


def _num2(x):
    return None if x is None else num(round(float(x), 2))


def _set(r: dict) -> dict:
    """A logged row: its id (for a remove), the numbers, and the text app. writes ("3 × 8 at 60 kg")."""
    return {"set_id": r["id"], "sets": r["sets"], "reps": r["reps"], "kg": num(r["kg"]), "minutes": num(r["minutes"]), "km": num(r["km"]),
            "text": gymlib.row_text(r)}


def _gym_row(ex: dict, d: dict, plan, first: bool) -> dict:
    r = gympage.row_data(ex, d, plan, first)
    prev = r["prev"]
    return {"exercise_id": ex["id"], "name": ex["name"], "kind": ex["kind"], "active": bool(ex["active"]), "done": bool(r["mine"]),
            "logged": [_set(x) for x in r["mine"]], "values": {k: num(r["vals"][k]) for k in gympage.VALS}, "ready": r["ready"],
            "text": r["said"], "up_kg": _num2(r["up"]),
            "last": {"day": iso(prev[0]["day"]), "rows": [_set(x) for x in prev]} if prev else None, "last_text": r["lastline"],
            "plan": {"item_id": plan["id"], "sets": plan["sets"], "reps": plan["reps"]} if plan else None, "open": r["open"]}


def _day_ref(sp: dict, x) -> Optional[dict]:
    return None if x is None else {"day_id": x["id"], "name": x["name"], "label": gymlib.label(sp["days"], x)}


def _gym_forms() -> dict:
    """What the forms need: the − / + steps and limits per kind (gympage.FIELDS), the plain refusal of numbers, the kinds."""
    return {"fields": {kind: [{"name": n, "label": lbl, "step": step, "min": lo, "max": hi} for n, lbl, step, lo, hi in f]
                       for kind, f in gympage.FIELDS.items()},
            "numbers": gymlib.NUMBERS, "kinds": [{"key": k, "label": v} for k, v in gymlib.KINDS.items()]}


def gym() -> dict:
    """The Workout tab (gympage.load, workout_list, row_data, daypick_data, split_card_data, weeks_data: the same as app.'s tab)."""
    with connect() as c, c.cursor() as cur:
        d = gympage.load(cur)
    sp, w, p = d["split"], gympage.workout_list(d), gympage.daypick_data(d["split"])
    wk = gympage.weeks_data(d)
    return {
        "today": iso(d["today"]), "title": w["title"], "started_at": iso(d["started"]),
        "done": len({r["exercise_id"] for r in d["now"]}), "status": gympage.status(d),
        "has_split": bool(sp["days"]), "day": _day_ref(sp, sp["day"]), "free": sp["free"], "picked_by_hand": sp["hand"],
        "chips": [{"day_id": None if v == "free" else int(v), "label": t, "on": on} for v, t, on in p["chips"]], "why": p["why"],
        "exercises": [_gym_row(x, d, plan, first) for x, plan, first in w["shown"]],
        "other": [_gym_row(x, d, plan, first) for x, plan, first in w["rest"]],
        "empty": None if w["shown"] else w["empty"], "hint": gympage.HINT if w["shown"] or w["rest"] else None,
        "week_split": [{"day_id": x["day"]["id"], "label": x["label"], "exercises": x["exercises"], "done": iso(x["done"]), "today": x["today"]}
                       for x in gympage.split_card_data(d)],
        "weeks": {"good": wk["good"], "weeks": [{"start": iso(r["start"]), "label": r["label"], "n": r["n"],
                                                 "days": [{"day": iso(c["day"]), "on": c["on"], "today": c["today"], "later": c["later"]} for c in r["days"]]}
                                                for r in wk["weeks"]]},
        "retired": [x["name"] for x in d["exercises"] if not x["active"]],
        **_gym_forms(),
    }


PLAN_LIMITS = {"name_max": 40, "sets_min": 1, "sets_max": 50, "reps_min": 1, "reps_max": 500}


def gym_plan() -> dict:
    """The Plan tab (gympage.load, plan_week, plan_day_data): how the day is picked, this week, a card per active day, the removed days."""
    with connect() as c, c.cursor() as cur:
        d = gympage.load(cur)
        gone = gymlib.days(cur, retired=True)
    sp = d["split"]
    days = []
    for x in sp["days"]:
        p = gympage.plan_day_data(x, d)
        days.append({"day_id": x["id"], "name": x["name"], "label": p["label"], "today": p["today"],
                     "items": [{"item_id": i["item"]["id"], "exercise_id": i["ex"]["id"], "name": i["ex"]["name"], "kind": i["ex"]["kind"],
                                "active": bool(i["ex"]["active"]), "sets": i["item"]["sets"], "reps": i["item"]["reps"], "text": i["what"]}
                               for i in p["items"]],
                     "can_add": [{"exercise_id": e["id"], "name": e["name"]} for e in p["can_add"]]})
    return {"today": iso(d["today"]), "how": gympage.HOW, "week": gympage.plan_week(sp) or None,
            "done": [{"day_id": x["id"], "label": gymlib.label(sp["days"], x), "day": iso(sp["done"][x["id"]])} for x in sp["days"] if x["id"] in sp["done"]],
            "day": _day_ref(sp, sp["day"]), "free": sp["free"], "days": days,
            "removed": [{"day_id": x["id"], "name": x["name"]} for x in gone], "limits": PLAN_LIMITS}


EXERCISE_LIMITS = {"name_max": 60, "words_max": 10, "word_max": 40}


def gym_exercises() -> dict:
    """The Exercises tab (gympage.load, exercise_use, exercise_meta): every exercise in the list's order, active or retired."""
    with connect() as c, c.cursor() as cur:
        d = gympage.load(cur)
        use = gympage.exercise_use(cur)
    out = []
    for x in d["exercises"]:
        u = use.get(x["id"])
        out.append({"exercise_id": x["id"], "name": x["name"], "kind": x["kind"], "kind_label": gymlib.KINDS[x["kind"]], "words": list(x["words"]),
                    "active": bool(x["active"]), "workouts": u["n"] if u else 0, "last_day": iso(u["day"]) if u else None,
                    "use": gympage.use_text(u), "meta": gympage.exercise_meta(x, u)})
    return {"active": sum(1 for x in d["exercises"] if x["active"]), "exercises": out,
            "kinds": [{"key": k, "label": v} for k, v in gymlib.KINDS.items()], "limits": EXERCISE_LIMITS}


def gym_progress(x=None) -> dict:
    """The Progress tab of exercise x (gympage.progress: the most recently done one when x is not one done): the chips, the top
    number, the change, the line under it, the chart as drawChart takes it, the last 6 sessions, workouts per week."""
    p = gympage.progress({"x": x} if x is not None else {})
    pw = p["per_week"]
    out = {"today": iso(p["today"]), "start": iso(p["first"]), "weeks": gympage.WEEKS,
           "per_week": {"weeks": [{"start": iso(w["start"]), "n": w["n"]} for w in pw["weeks"]], "top": pw["top"], "good": pw["good"]},
           "exercises": [], "exercise": None, "unit": None, "title": None, "top": None, "top_reps": None, "top_text": None, "change": None,
           "one_rep_max": None, "sub": None, "chart": None, "recent": []}
    if p["ex"] is None:
        return out
    out.update(exercises=[{"exercise_id": k, "name": nm, "on": on} for k, nm, on in p["chips"]],
               exercise={"exercise_id": p["ex"]["id"], "name": p["ex"]["name"], "kind": p["ex"]["kind"]}, unit=p["unit"], title=p["title"],
               top=_num2(p["top"]), top_reps=p["top_reps"], top_text=f'{gympage._plain(p["top"])} {p["unit"]}', change=p["change"],
               one_rep_max=p["one_rep_max"], sub=p["sub"], chart=p["chart"],
               recent=[{"day": iso(dd), "text": ", ".join(gymlib.row_text(r) for r in rs), "rows": [_set(r) for r in rs]} for dd, rs in p["recent"]])
    return out


def gym_history(also: Optional[int] = None) -> dict:
    """The History tab (gympage.history): the last 60 workouts, newest first; also: a workout's id added in its place when it is older
    (deploy 107: a search result's card)."""
    return {"workouts": [{"workout_id": h["w"]["id"], "anchor": f'w{h["w"]["id"]}', "day": iso(h["w"]["day"]),
                          "split_day_id": h["w"]["split_id"], "split": h["split"], "started_at": iso(h["start"]), "ended_at": iso(h["end"]),
                          "when": h["when"],
                          "exercises": [{"exercise_id": rs[0]["exercise_id"], "name": rs[0]["name"], "kind": rs[0]["kind"],
                                         "text": ", ".join(gymlib.row_text(r) for r in rs), "rows": [_set(r) for r in rs]} for rs in h["exercises"]]}
                         for h in gympage.history(also)]}


def gym_activity(asked: Optional[date] = None) -> dict:
    """The Activity tab (activitypage.load, setup): one calendar day of watch data (a later day is today), or, before any came, the
    set-up guide. Read only."""
    a = activitypage.load(asked)
    if a is None:
        return {"has_data": False, "setup": activitypage.setup(), "today": None, "day": None, "label": None, "prev_day": None, "next_day": None,
                "tiles": [], "sleep": None, "workouts": [], "charts": []}
    day, s = a["day"], a["sleep"]
    return {
        "has_data": True, "setup": None, "today": iso(a["today"]), "day": iso(day), "label": a["label"],
        "prev_day": iso(day - timedelta(days=1)), "next_day": iso(day + timedelta(days=1)) if day < a["today"] else None,
        "tiles": [{"key": t["key"], "label": t["label"], "value": _num2(t["value"]), "unit": t["unit"], "text": t["text"],
                   "avg7": _num2(t["avg7"]), "sub": t["sub"] or None} for t in a["tiles"]],
        "sleep": None if not s else {
            "hours": _num2(s["asleep"]), "text": s["asleep_text"], "in_bed_from": iso(s["start"]), "in_bed_to": iso(s["end"]), "in_bed": s["in_bed"] or None,
            "stages": [{"key": x["key"], "label": x["label"], "hours": _num2(x["hours"]), "text": x["text"]} for x in s["stages"]],
            "stages_text": s["stages_text"],
            "typed": {"bed_at": iso(s["typed"]["bed_at"]), "wake_at": iso(s["typed"]["wake_at"]), "hours": _num2(s["typed"]["hours"])} if s["typed"] else None,
            "typed_text": s["typed_text"]},
        "workouts": [{"name": x["w"]["name"], "start_at": iso(x["w"]["start_at"]), "end_at": iso(x["w"]["end_at"]), "minutes": x["minutes"],
                      "kcal": _num2(x["w"]["kcal"]), "hr_avg": _num2(x["w"]["hr_avg"]), "km": _num2(x["w"]["km"]), "meta": x["meta"],
                      "matches": x["matches"]} for x in a["workouts"]],
        "charts": [{"id": k, "title": title, "chart": a["charts"][k]} for k, _cid, title in activitypage.CHARTS],
    }


# ---- Home (deploy 98, step 3 of the move to logger.) ----------------------------------------------------------------------------------
# app.'s Home pages (homepage's data functions, home.py's rules) as data. A chore in a zone is a "pair" (chore_id, zone_id): a whole-flat
# chore (Dust, Vacuum, Mop) is one pair per zone it is done in. Ages and intervals are whole days (logging days, home.today); with each
# the words app. writes (age_text "3 weeks ago", age_short "3 wk", interval_text "every 2 weeks"), so both apps say the same.

def _pair(p: dict) -> list:
    return [p["chore"]["id"], p["zone"]["id"]]


def _hrow(p: dict) -> dict:
    """A pair as a row: the chore, the zone, how long ago it was done (days; None = never logged), its interval and minutes in this zone."""
    c, z = p["chore"], p["zone"]
    return {"chore_id": c["id"], "zone_id": z["id"], "name": c["name"], "zone": z["name"], "short": z["short"], "label": homelib.label(c, z),
            "flat": c["zone_id"] is None, "age": p["age"], "age_text": homelib.age_text(p["age"]), "interval": p["interval"],
            "interval_text": homelib.interval_text(p["interval"]), "minutes": p["minutes"], "done_today": p["age"] == 0,
            "done_at": iso(p["done_at"])}


def _timer(t: Optional[dict], job: Optional[dict]) -> Optional[dict]:
    """The open timer (home.timer_open) with its job; None when there is none or its job is gone (app. then shows no timer)."""
    if not t or not job:
        return None
    ends = t["ends_at"] if t["state"] != "paused" else None
    return {"id": t["id"], "state": t["state"], "left": int(t["left"]), "ends_at": iso(ends), "minutes": t["minutes"],
            "title": job["title"], "pairs": [list(x) for x in job["pairs"]]}


def _job(j: dict) -> dict:
    """A job of the Pick page (home.candidates, job_of): one pair, a zone session or "<chore> the whole flat"."""
    return {"pairs": [list(x) for x in j["pairs"]], "title": j["title"], "zone": j["zone"], "age": j["age"], "age_text": homelib.age_text(j["age"]),
            "minutes": j["minutes"], "steps": list(j["steps"]), "howto": j["howto"], "over": j["over"], "session": j["session"]}


def _done(e: dict) -> dict:
    """A done entry (home.recent): rows stamped together (All done) are one entry with all their ids; dated = a job done earlier or a
    starting point (12:00 of its day, only the date is shown)."""
    return {"ids": list(e["ids"]), "chore_id": e["chore_id"], "chore": e["chore"], "zones": list(e["zones"]), "flat": e["flat"], "label": e["label"],
            "at": iso(e["at"]), "day": iso(e["day"]), "dated": e["dated"], "source": e["source"], "how": homepage.how(e),
            "time": None if e["dated"] else e["at"].astimezone(BERLIN).strftime("%H:%M"), "when": homepage._at(e)}


def _week(w: dict) -> dict:
    return {"goal": w["goal"], "this": w["this"], "weeks": list(w["weeks"])}


HOME_MINUTES = [{"minutes": m, "label": homepage.LABEL[m]} for m in homelib.HOURS]


def home_card() -> Optional[dict]:
    """Today's Home card (homepage.card_data): None before there is an active chore in an active zone (app. shows no card)."""
    x = homepage.card_data()
    if x["empty"]:
        return None
    w = x["week"]
    return {"this_week": w["this"], "goal": w["goal"], "text": f'this week {w["this"]} of {w["goal"]}',
            "waiting": _hrow(x["rows"][0]) if x["rows"] else None, "hidden": x["hidden"]}


def home(q=None) -> dict:
    """The Now tab (homepage.now_data); q: {"min": ...} as app.'s ?min= (5, 15, 30, 60; anything else is 15)."""
    x = homepage.now_data(q)
    d = x["d"]
    return {"today": iso(d["today"]), "empty": x["empty"], "minutes": x["minutes"], "minutes_options": HOME_MINUTES,
            "timer": _timer(x["timer"], x["job"]), "week": _week(x["week"]),
            "rows": [_hrow(p) for p in x["rows"]], "count": len(x["rows"]), "shown": homepage.SHOWN, "hidden": x["hidden"],
            "recent": [_done(e) for e in x["recent"]]}


def home_pick(q=None) -> dict:
    """The Pick page (homepage.pick_data); q: {"min", "n"} as app.'s ?min=&n=, not looked at while a timer is open."""
    x = homepage.pick_data(q)
    t, jobs = x["timer"], x["jobs"]
    return {"today": iso(x["d"]["today"]), "empty": x["empty"], "minutes": x["minutes"], "title": homepage.pick_title(x["minutes"]),
            "timer": _timer(t, x["job"]), "job": _job(x["job"]) if x["job"] else None,
            "n": None if t or not jobs else x["n"], "count": len(jobs) if jobs else (1 if t else 0),
            "also": [{"n": i, "title": j["title"]} for i, j in x["more"]],
            "earlier": [{"when": int(w), "label": label} for w, label in (("1", "Yesterday"), ("2", "2 days ago"))],
            "next_from_s": homelib.NEXT_FROM * 60, "earlier_days": homelib.EARLIER_DAYS}


def home_zones() -> dict:
    """The Zones tab (homepage.zones_data, start_data, flat_data, zone_data, per_zone_data)."""
    x = homepage.zones_data()
    d = x["d"]
    st = homepage.start_data(x["never"])
    start = [{"chore_id": ps[0]["chore"]["id"], "name": ps[0]["chore"]["name"], "pairs": [_pair(p) for p in ps],
              "zone": ps[0]["zone"]["name"] if len(ps) == 1 else None, "zones": len(ps),
              "where": ps[0]["zone"]["name"] if len(ps) == 1 else homepage._n(len(ps), "zone"),
              "interval": ps[0]["interval"], "interval_text": homelib.interval_text(ps[0]["interval"])} for ps in st["jobs"]]
    flat = []
    for f in homepage.flat_data(d):
        c, pz = f["chore"], homepage.per_zone_data(f["chore"], d["zones"])
        flat.append({"chore_id": c["id"], "name": c["name"], "interval": c["interval_days"], "interval_text": homelib.interval_text(c["interval_days"]),
                     "minutes": c["minutes"], "all_done_today": f["all_today"],
                     "per_zone": {"text": homepage._per_zone(c, d["zones"]),
                                  "groups": [{"interval": days, "interval_text": homelib.interval_text(days),
                                              "zones": [{"zone_id": z["id"], "short": z["short"]} for z in zs]} for days, zs in pz["groups"]],
                                  "off": [{"zone_id": z["id"], "short": z["short"]} for z in pz["off"]]},
                     "tiles": [{**_hrow(p), "age_short": homelib.age_short(p["age"]), "tinted": homepage.tinted(p)} for p in f["pairs"]]})
    zones = []
    for z in d["zones"]:
        zx = homepage.zone_data(z, d)
        o = zx["oldest"]
        zones.append({"zone_id": z["id"], "name": z["name"], "short": z["short"], "count": len(zx["pairs"]), "own": zx["own"],
                      "chores": [_hrow(p) for p in zx["pairs"]], "open": zx["open"], "todoist": zx["todoist"],
                      "oldest_age": o["age"] if o else None, "oldest_text": None if not o else "not yet" if o["age"] is None else homelib.age_text(o["age"])})
    return {"today": iso(d["today"]), "empty": x["empty"],
            "start": {"jobs": start, "more": st["more"], "answers": [{"ago": a, "label": label} for a, label in homepage.START_CHIPS]},
            "flat": flat, "zones": zones}


def home_history(q=None) -> dict:
    """History (homepage.history_data); q: {"n"} as app.'s ?n= (60 to 600, else 60)."""
    x = homepage.history_data(q)
    d = x["d"]
    return {"today": iso(d["today"]), "limit": x["limit"], "step": homepage.HISTORY, "max": homepage.HISTORY_MAX, "more": x["more"],
            "count": len(x["rows"]),
            "days": [{"day": iso(day), "label": homepage._day_head(day), "rows": [_done(e) for e in es]} for day, es in x["days"]],
            "jobs": [{"pairs": [_pair(p)], "label": homelib.label(p["chore"], p["zone"])} for p in homepage.earlier_jobs(d)],
            "earlier_days": homelib.EARLIER_DAYS}


def _dates(rows: list, year: int) -> dict:
    """The last 10 done days (newest first) of a chore or of one zone of it, and app.'s line of them."""
    last = rows[:homepage.LAST]
    return {"last": [{"day": iso(r["day"]), "start": r["source"] == "start"} for r in last],
            "last_text": " · ".join(homepage._date(r["day"], year) + (" (starting point)" if r["source"] == "start" else "") for r in last)
            or "not logged yet"}


def _usually(rows: list) -> dict:
    gap = homepage.usual_gap([r["day"] for r in rows if r["source"] != "start"])
    return {"usually_days": gap, "usually": None if gap is None else f"usually every {homepage._n(gap, 'day')}"}


def home_chore(q=None) -> Optional[dict]:
    """A chore's page (homepage.chore_data); q: {"id"}. None when there is no such chore ("That chore is not in the list.")."""
    x = homepage.chore_data(q)
    c = x["chore"]
    if not c:
        return None
    year = x["d"]["today"].year
    out = {"chore_id": c["id"], "name": c["name"], "zone_id": c["zone_id"], "zone": x["where"], "flat": x["flat"], "active": c["active"],
           "interval": c["interval_days"], "interval_text": homelib.interval_text(c["interval_days"]), "minutes": c["minutes"], "meta": x["meta"],
           "steps": list(c["steps"] or []), "howto": c["howto"], "words": list(c["words"] or []), "zones": None}
    if x["flat"]:
        out.update({"last": [], "last_text": None, "usually_days": None, "usually": None})
        out["zones"] = [{"zone_id": zx["zone"]["id"], "zone": zx["zone"]["name"], "on": zx["pair"] is not None,
                         "interval": zx["pair"]["interval"] if zx["pair"] else None,
                         "interval_text": homelib.interval_text(zx["pair"]["interval"]) if zx["pair"] else None,
                         "minutes": zx["pair"]["minutes"] if zx["pair"] else None,
                         "text": f'{homelib.interval_text(zx["pair"]["interval"])} · {zx["pair"]["minutes"]} min' if zx["pair"] else "not done here",
                         **_usually(zx["rows"]), **_dates(zx["rows"], year)} for zx in x["zones"]]
    else:
        out.update(**_dates(x["rows"], year), **_usually(x["rows"]))
    return out


HOME_LIMITS = {"zone_name_max": 40, "short_max": 12, "spots_max": 12, "spot_max": 40, "chore_name_max": 60, "steps_max": 8, "step_max": 80,
               "howto_max": 300, "words_max": 12, "word_max": 40, "days_min": 1, "days_max": 730, "minutes_min": 1, "minutes_max": 240,
               "minutes_default": homelib.DEFAULT_MINUTES, "goal_min": 1, "goal_max": 7}


def _edit_chore(c: dict, zones: list) -> dict:
    """A chore of Edit zones with every field of its form; per_zone (a whole-flat chore that is not retired, as app.'s "Per zone"
    table): each active zone, on or off, its own days and minutes (None = blank = the chore's own)."""
    off = {int(x) for x in c["zone_off"]}
    per = None
    if c["zone_id"] is None and c["active"]:
        per = [{"zone_id": z["id"], "zone": z["name"], "on": z["id"] not in off, "days": c["zone_days"].get(str(z["id"])),
                "minutes": c["zone_minutes"].get(str(z["id"]))} for z in zones if z["active"]]
    return {"chore_id": c["id"], "name": c["name"], "zone_id": c["zone_id"], "flat": c["zone_id"] is None, "active": c["active"],
            "interval": c["interval_days"], "interval_text": homelib.interval_text(c["interval_days"]), "minutes": c["minutes"],
            "meta": f'{homelib.interval_text(c["interval_days"])} · {c["minutes"]} min' + ("" if c["active"] else " · retired"),
            "steps": list(c["steps"] or []), "howto": c["howto"], "words": list(c["words"] or []), "per_zone": per}


def home_edit() -> dict:
    """Edit zones (homepage.edit_data): the weekly goal, the whole-flat chores, every zone (retired ones too) with its chores."""
    x = homepage.edit_data()
    d = x["d"]
    zones = d["all_zones"]
    return {"goal": x["goal"],
            "flat": [_edit_chore(c, zones) for c in x["flat"]],
            "zones": [{"zone_id": z["id"], "name": z["name"], "short": z["short"], "spots": list(z["spots"] or []), "words": list(z["words"] or []),
                       "active": z["active"], "count": sum(1 for c in d["all_chores"] if c["zone_id"] == z["id"] and c["active"]),
                       "chores": [_edit_chore(c, zones) for c in d["all_chores"] if c["zone_id"] == z["id"]]} for z in zones],
            "zone_options": [{"zone_id": None, "label": "Whole flat (each zone on its own)", "active": True}]
                            + [{"zone_id": z["id"], "label": z["name"] + ("" if z["active"] else " (retired)"), "active": z["active"]} for z in zones],
            "limits": HOME_LIMITS}


# ---- Trends (deploy 101, step 4 of the move to logger.) ------------------------------------------------------------------------------
# app.'s Week page with its Week review card, the Food page's Trends tab and the Insights page as data (weekpage.data,
# trendspage.data, insightspage.data, coachpage.week_review: app.'s pages draw from the same). The charts are the Health page's card
# shape ({id, title, small, stat, chart, legend}, chart = exactly app.'s data-chart object). Numbers rounded for reading; the words
# are app.'s own.

def _week_review(c: Optional[dict]) -> Optional[dict]:
    if c is None:
        return None
    out = {**c, "start": iso(c["start"]), "end": iso(c["end"])}
    if c["meta"]:
        out["meta"] = {**c["meta"], "at": iso(c["meta"]["at"]), "usd": _r(c["meta"]["usd"], 4)}
    if c["latest"]:
        out["latest"] = {**c["latest"], "start": iso(c["latest"]["start"]), "end": iso(c["latest"]["end"])}
    return out


def week(p: str = "7") -> dict:
    """The Week page of the period p (7, last, 30, this; weekpage.data)."""
    w = weekpage.data(p)
    return {**w, "today": iso(w["today"]), "start": iso(w["start"]), "end": iso(w["end"]),
            "food": [{**t, "average": _r(t["average"], 1), "target": num(t["target"]), "pct": _r(t["pct"], 1)} for t in w["food"]],
            "foods": {k: [{**r, "kcal": num(r["kcal"])} for r in rs] for k, rs in w["foods"].items()},
            "days": [{**r, "day": iso(r["day"]), **{k: _r(r[k], 1) for k in ("kcal", "protein", "fat", "carbs")}, "kg": _r(r["kg"], 2)}
                     for r in w["days"]],
            "review": _week_review(w["review"])}


def food_trends(days: int = trendspage.DEFAULT_RANGE) -> dict:
    """The Food page's Trends tab of the last `days` complete days (7, 30, 90; trendspage.data)."""
    t = trendspage.data(days)
    return {**t, "start": iso(t["start"]), "end": iso(t["end"])}


def insights() -> dict:
    """The Insights page (insightspage.data): the three cards of the last 90 days."""
    d = insightspage.data()
    return {**d, "cards": [{**c, "zero": _r(c["zero"], 1),
                            "groups": [{**g, "mean": _r(g["mean"], 2), "left": _r(g["left"], 1), "width": _r(g["width"], 1)} for g in c["groups"]]}
                           for c in d["cards"]]}


def coaching(cid: int) -> dict:
    """A coaching's state as app.'s card polls it (coach.status): working, done, failed (also cut off) or gone."""
    return {"id": cid, "state": coach.status(cid)}


# ---- More: Search, Recent, Usage, Coach (deploy 107, step 6 of the move to logger.) -------------------------------------------------
# app.'s Search, Recent, Usage and Coach pages as data (searchpage.results, recentpage.load and messages, usagepage.data,
# coachpage.list_data and card_data: app.'s pages draw from the same, byte for byte as before). Ids and facts, with app.'s words beside
# them; the front end builds its own links. Never a thought (Search), never a private or gratitude entry's words (Recent: its label
# only; Usage: a "private" mark only), and no message whose words carry a private label or name private entries (fail closed).

def _words_ok(text) -> bool:
    return bool(text) and not privateline.label(text) and not names_private(text)


def _group(title: str, rows: list) -> dict:
    """A kind of Search result: app.'s heading, the rows, and more: the kind reached LIMIT (app.'s "15+")."""
    return {"title": title, "rows": rows, "more": len(rows) >= searchpage.LIMIT}


def search(q: str) -> dict:
    """app.'s Search for q (spaces squeezed, at most 80 characters; under two characters: nothing searched, app.'s hint). No thoughts."""
    term = searchpage.term_of(q)
    out = {"q": term, "searched": len(term) >= 2, "limit": searchpage.LIMIT, "hint": searchpage.HINT if len(term) >= 2 else searchpage.SHORT}
    d = searchpage.results(term, thoughts=False) if out["searched"] else {k: [] for k in ("foods", "ate", "workouts", "chores", "tests")}
    out["foods"] = _group("Foods in the catalogue", [{"id": f'N{r["id"]}', "food_id": r["id"], "name": r["name"]} for r in d["foods"]])
    out["ate"] = _group("What you ate", [{"id": r["id"], "ref": f'f{r["id"]}', "day": iso(r["day"]), "day_text": f'{r["day"]:%a %d.%m.%Y}',
                                          "food": r["name"], "amount": num(r["amount"]), "unit": r["basis"],
                                          "amount_text": f'{r["amount"]:g} {r["basis"]}', "note": r["note"] or None} for r in d["ate"]])
    out["workouts"] = _group("Gym workouts", [{"workout_id": w["id"], "anchor": f'w{w["id"]}', "day": iso(w["day"]), "day_text": f'{w["day"]:%a %d.%m.%Y}',
                                              "split": w["split"] or "Free workout", "text": w["what"]} for w in d["workouts"]])
    out["chores"] = _group("Chores done", [{"chore_id": e["chore_id"], "label": e["label"], "day": iso(e["day"]), "day_text": f'{e["day"]:%a %d.%m.%Y}',
                                           "start": e["source"] == "start"} for e in d["chores"]])
    out["tests"] = _group("Lab tests", [{"test_id": r["id"], "name": r["name"]} for r in d["tests"]])
    return out


def recent() -> dict:
    """app.'s Recent page: the last 50 messages from the web app and Claude by logging day, newest first, each with what it saved;
    a private or gratitude entry by its label only. not_read: how many messages wait to be read (they show on Today's card)."""
    days: list = []
    for x in recentpage.messages(recentpage.load()):
        m = x["m"]
        if not days or days[-1]["day"] != iso(x["logday"]):
            days.append({"day": iso(x["logday"]), "head": x["head"], "messages": []})
        private = m["kind"] == "private"
        words = m["content"] if not private and _words_ok(m["content"]) else None
        days[-1]["messages"].append({
            "id": None if private else m["id"], "private": private, "at": iso(m["received_at"]), "time": f'{x["at"]:%H:%M}',
            "channel": None if private else m["channel"], "channel_label": x["chan"], "text": words,
            "again": recentpage.again_text(words) if words else None, "open_day": iso(x["day"]),
            "saved": [{"kind": k, "text": v} for k, v in x["items"]]})
    return {"limit": recentpage.LIMIT, "small": recentpage.SMALL, "empty": recentpage.EMPTY, "none": recentpage.NONE, "days": days,
            "not_read": len(held.rows())}


def _first_words(row) -> Optional[str]:
    if row["detail"].get("private_id") or not _words_ok(row["content"]):
        return None
    words = " ".join(row["content"].split())
    return words[:usagepage.FIRST_WORDS] + ("…" if len(words) > usagepage.FIRST_WORDS else "")


def _usage_kind(kind: str, calls: int, usd: float, tin: int, tout: int, known: bool) -> dict:
    return {"kind": kind, "calls": calls, "tokens_in": tin, "tokens_out": tout, "tokens_known": known,
            "tokens_in_text": usagepage.tok(tin, known), "tokens_out_text": usagepage.tok(tout, known), "usd": _r(usd, 5),
            "usd_text": usagepage._usd(usd)}


def usage(r: str = "7") -> dict:
    """app.'s Usage page of the range r (7, 30, all)."""
    d = usagepage.data(r)
    msgs = d["msgs"]
    return {
        "r": d["r"], "ranges": [{"r": k, "label": lbl, "current": k == d["r"]} for k, lbl in usagepage.RANGES],
        "start": iso(d["start"]), "end": iso(d["today"]), "days": d["days"], "first": iso(d["first"]), "since": d["since"],
        "tiles": {"calls": d["calls"], "usd": _r(d["cost"], 5), "usd_text": usagepage._usd(d["cost"]),
                  "per_message": _r(d["msg_cost"] / msgs, 5) if msgs else None,
                  "per_message_text": usagepage._usd(d["msg_cost"] / msgs) if msgs else "–", "messages": msgs,
                  "tokens_in": d["tin"], "tokens_out": d["tout"], "tokens_text": f'{round(d["tin"] / 1000):,}k / {round(d["tout"] / 1000):,}k',
                  "tokens_known": d["tok_known"], "tokens_note": None if d["tok_known"] else "some older calls have none"},
        "chart": d["chart"] if d["chart"]["series"] else None, "empty": usagepage.EMPTY,
        "legend": [{"key": k, "text": t} for k, t in usagepage.LEGEND],
        "kinds": [_usage_kind(*k) for k in d["kinds"]],
        "all": _usage_kind("All", d["calls"], d["cost"], d["tin"], d["tout"], d["tok_known"]),
        "kinds_note": usagepage.OLD_NOTE if any(not k[5] for k in d["kinds"]) else None,
        "pushes": d["pushes"], "pushes_text": f'Phone notifications sent: {d["pushes"]:,} (free).',
        "top": [{"at": iso(row["at"]), "at_text": f'{row["at"].astimezone(BERLIN):%a %d.%m. %H:%M}', "kind": usagepage.KINDS.get(row["tool"], row["tool"]),
                 "text": _first_words(row), "private": bool(row["detail"].get("private_id")), "models": fams, "models_text": " + ".join(fams),
                 "usd": _r(c, 5), "usd_text": usagepage._usd(c), "escalated": bool(row["detail"].get("escalated"))} for c, row, fams in d["top"]],
        "note": usagepage.NOTE,
    }


def _card(c: dict) -> dict:
    """A coaching card (coachpage.card_data) with its dates and meta as JSON values."""
    out = {**c, "start": iso(c["start"]), "end": iso(c["end"])}
    if c["meta"]:
        out["meta"] = {**c["meta"], "at": iso(c["meta"]["at"]), "usd": _r(c["meta"]["usd"], 4)}
    return out


def coach_card(day: date) -> dict:
    """The Coach card of one day (coachpage.card_data, as Today's): none, working, done or failed."""
    return _card(coachpage.card_data("day", day, day))


def coach_page(f: str = "all", day: Optional[date] = None) -> dict:
    """app.'s Coach page (f: all, days, weeks), and the Coach card of day (today when not given) for the page's "Coach a day"."""
    d = coachpage.list_data(f)
    if day is None:
        with connect() as conn, conn.cursor() as cur:
            cur.execute("SELECT log_day(now()) AS d")
            day = cur.fetchone()["d"]
    m = d["month"]
    return {"f": d["f"], "filters": [{"f": k, "label": lbl, "current": k == d["f"]} for k, lbl in coachpage.FILTERS],
            "list": [{"id": r["id"], "kind": r["kind"], "start": iso(r["start_day"]), "end": iso(r["end_day"]), "heading": coachpage.heading(r),
                      "first": str(coachpage._first(r)) or None, "parts": coachpage.parts(r, d["hidden"]), "caution": coachpage.CAUTION,
                      "meta": {**(mt := coachpage.meta(r)), "at": iso(mt["at"]), "usd": _r(mt["usd"], 4)}} for r in d["rows"]],
            "empty": coachpage.EMPTY, "month": {"count": m["n"], "usd": _r(m["usd"], 4), "text": m["text"]}, "note": coachpage.KEPT,
            "day": iso(day), "card": coach_card(day)}


# ---- Library: the food catalogue (deploy 104, step 5 of the move to logger.) --------------------------------------------------------
# app.'s Food > Catalogue as data (foodpage.catalogue_data, food_data: app.'s page draws from the same, byte for byte as before), with
# app.'s words beside the facts. Numbers per 100 g or ml; unknown values null.

def _catalogue_row(r: dict) -> dict:
    return {"id": r["id"], "ref": f"N{r['id']}", "name": r["name"], "review": bool(r["needs_review"]), "drink": bool(r["is_drink"]),
            "aliases": list(r["aliases"] or []), "basis": r["basis"], "per_100": {k: num(r[k]) for k in ("kcal", "protein", "fat", "carbs")},
            "per_100_text": {k: foodpage.per_100_text(r[k]) for k in ("kcal", "protein", "fat", "carbs")},
            "eaten": r["n"], "last": iso(r["last"]), "last_text": foodpage.last_text(r["last"]),
            "added": iso(r["created_at"].astimezone(BERLIN).date()), "added_text": foodpage.added_text(r["created_at"])}


def catalogue(q: str = "", f: str = "all", s: str = "eaten") -> dict:
    """The Catalogue's list (foodpage.catalogue_data): the search, the filter chips and the orders with the one that is on, the
    rows (at most `limit`), the note when the list is full, the empty line, the hint."""
    d = foodpage.catalogue_data(q, f, s)
    return {**{k: d[k] for k in ("q", "filter", "sort", "filters", "sorts", "limit", "more", "empty", "hint", "placeholder")},
            "count": len(d["rows"]), "rows": [_catalogue_row(r) for r in d["rows"]]}


def food_item(fid: int) -> Optional[dict]:
    """One food as the Catalogue's box shows it (foodpage.food_data), or None when it is not there. A hidden food comes too
    (active false); app.'s list shows only active ones."""
    d = foodpage.food_data(fid)
    if d is None:
        return None
    f = d["food"]
    return {"id": f["id"], "ref": f"N{f['id']}", "name": f["name"], "basis": f["basis"],
            "source": {"text": d["line"], "line": d["source"], "source": f["source"], "brand": f["brand"], "note": f["source_note"]},
            "needs_review": bool(f["needs_review"]), "review_reason": f["review_reason"],
            "values": [{"key": k, "label": lbl, "value": num(f[k])} for k, lbl in foodpage.NUT],
            "aliases": list(f["aliases"] or []), "drink": bool(f["is_drink"]), "active": bool(f["active"]),
            "units": [{"unit": u["unit"], "grams": num(u["grams"]), "text": u["text"]} for u in d["units"]],
            "barcode": f["barcode"], "eaten": d["n"], "first": iso(d["first"]), "last": iso(d["last"]),
            "last_text": d["last"].strftime("%d.%m.%Y") if d["last"] else None,
            "added": iso(f["created_at"].astimezone(BERLIN).date()), "added_text": f"{f['created_at']:%d.%m.%Y}",
            "recipe": f"C{d['recipe']}" if d["recipe"] else None, "values_editable": d["recipe"] is None,
            "past": {"n": d["n"], "text": d["past"]} if d["past"] else None,
            "words": {"values_hint": foodpage.VALUES_HINT, "basics_hint": foodpage.BASICS_HINT, "none": foodpage.NONE_YET,
                      "review": "needs review", "reviewed": "Looks right"},
            "limits": foodpage.LIMITS}


# ---- Medical: lab reports, tests over time, medication (deploy 104) -----------------------------------------------------------------
# app.'s Medical page as data (labspage.reports_data, tests_data, test_chart, meds_data: app.'s three tabs draw from the same, byte for
# byte as before). Values as the logger prints them (v1's _val_text, _ref_text); the correction forms start from labspage.printed.
# Nothing of these reads is ever written to a log line.

def _flag_word(f) -> Optional[str]:
    return labspage.FLAGS.get(f)


def _lab_value(r: dict) -> dict:
    value, unit, ref = labspage.printed(r)
    return {"id": r["id"], "ref": f"V{r['id']}", "test_id": r["test_id"], "test": r["test"], "note": r["note"],
            "text": v1_commands._val_text(r), "value": num(r["value"]), "unit": r["unit"],
            "range": v1_commands._ref_text(r["ref_low"], r["ref_high"]), "ref_low": num(r["ref_low"]), "ref_high": num(r["ref_high"]),
            "flag": r["flag"], "flag_word": _flag_word(r["flag"]), "site": labspage._site(r) or None,
            "printed": {"value": value, "unit": unit, "ref": ref}}


def labs(open_: str = "") -> dict:
    """The Reports tab (labspage.reports_data): the newest lab report's flagged values, every report, the one open ("R<id>")."""
    d = labspage.reports_data(open_)
    newest, p = d["newest"], d["open"]
    return {
        "flagged": None if newest is None else {
            "report_id": newest["id"], "ref": f"R{newest['id']}", "date": iso(newest["collected_date"]),
            "date_text": f"{newest['collected_date']:%d.%m.%Y}", "title": newest["title"] or "Report",
            "heading": "Flagged in your newest report", "empty": labspage.NOTHING_FLAGGED if not d["flagged"] else None,
            "hint": labspage.FLAGGED_HINT,
            "chips": [{"test_id": r["test_id"], "test": r["test"], "value": v1_commands._val_text(r),
                       "range": v1_commands._ref_text(r["ref_low"], r["ref_high"]), "flag": r["flag"], "flag_word": _flag_word(r["flag"])}
                      for r in d["flagged"]]},
        "reports": [{"id": r["id"], "ref": f"R{r['id']}", "date": iso(r["collected_date"]), "date_text": f"{r['collected_date']:%d.%m.%Y}",
                     "title": r["title"] or "Report", "kind": r["report_type"], "provider": r["provider"] or "", "values": r["n"],
                     "flagged": r["flagged"]} for r in d["reports"]],
        "empty": None if d["reports"] else labspage.NO_REPORTS, "hint": labspage.REPORTS_HINT,
        "open": None if p is None else {
            "id": p["id"], "ref": f"R{p['id']}", "date": iso(p["collected_date"]), "date_text": f"{p['collected_date']:%d.%m.%Y}",
            "title": p["title"] or "Report", "kind": p["report_type"], "provider": p["provider"] or "", "notes": p["notes"],
            "values": [_lab_value(r) for r in d["values"]], "empty": None if d["values"] else labspage.NO_VALUES,
            "form": {"collected": iso(p["collected_date"]), "title": p["title"] or "", "provider": p["provider"] or "", "notes": p["notes"] or ""},
            "value_hint": labspage.VALUE_HINT, "report_hint": labspage.REPORT_HINT},
        "limits": labspage.LIMITS,
    }


def labs_tests(q: str = "", t: str = "") -> dict:
    """The Tests over time tab (labspage.tests_data): the tests worth a chart or the matches of q, or the test of t (or of the one
    match) with its chart card (Health's card shape; chart = app.'s data-chart object, or null with app.'s note) and its values,
    newest first."""
    d = labspage.tests_data(q, t)
    test = d["test"]
    return {"q": d["q"], "placeholder": labspage.TESTS_PLACEHOLDER, "title": d["title"], "empty": d["empty"],
            "tests": [{"id": m["id"], "name": m["name"], "unit": m["unit"] or None, "values": m["n"]} for m in d["matches"]],
            "test": None if test is None else {"id": test["id"], "name": test["name"], "unit": test["unit"] or None, "values": len(d["rows"])},
            "card": d["card"],
            "rows": [{"id": r["id"], "date": iso(r["collected_date"]), "date_text": f"{r['collected_date']:%d.%m.%Y}",
                      "site": labspage._site(r) or None, "value": v1_commands._val_text(r), "range": v1_commands._ref_text(r["ref_low"], r["ref_high"]),
                      "flag": r["flag"], "flag_word": _flag_word(r["flag"]), "report_id": r["report_id"], "report_ref": f"R{r['report_id']}"}
                     for r in reversed(d["rows"])]}


def labs_meds() -> dict:
    """The Medication tab (labspage.meds_data): the courses in app.'s order, the running count, app.'s words and the form's limits."""
    d = labspage.meds_data()
    return {"today": iso(d["today"]), "running": d["running"], "empty": None if d["meds"] else labspage.NO_MEDS,
            "hint": labspage.MEDS_HINT, "form_hint": labspage.MED_HINT,
            "meds": [{"id": m["id"], "ref": f"D{m['id']}", "name": m["name"], "ingredient": m["ingredient"], "dose": m["dose"],
                      "frequency": m["frequency"], "indication": m["indication"], "start": iso(m["start_date"]), "stop": iso(m["stop_date"]),
                      "start_text": f"{m['start_date']:%d.%m.%Y}" if m["start_date"] else None,
                      "stop_text": f"{m['stop_date']:%d.%m.%Y}" if m["stop_date"] else None,
                      "running": m["running"], "can_end": m["running"] and m["stop_date"] is None} for m in d["meds"]],
            "limits": labspage.MED_LIMITS}


# ---- Settings and notifications (deploy 110, step 6 of the move to logger.) -------------------------------------------------------------
# app.'s Settings tabs as data (settingspage.targets_data, today_data, body_data, devices_data, notify_data; coachpage.settings_data;
# export.settings_data), which app.'s tabs draw from. Not here: the gratitude goal (Today page tab) stays at app., as the list does.

def _day_text(x) -> str:
    return f"{x:%d.%m.%Y}"


def settings_targets() -> dict:
    """Food targets: the nine fields with the values in force now, the form's default "from" day, the history (newest first)."""
    d = settingspage.targets_data()
    cur = d["current"]
    return {"valid_from": iso(d["today"]),
            "current": None if cur is None else {"valid_from": iso(cur["valid_from"]), "valid_from_text": _day_text(cur["valid_from"]), "note": cur["note"]},
            "fields": [{"key": k, "label": lbl, "unit": unit, "value": num(cur[k]) if cur else None} for k, lbl, unit in settingspage.TARGET_FIELDS],
            "history": [{"valid_from": iso(r["valid_from"]), "valid_from_text": _day_text(r["valid_from"]),
                         "values": {k: num(r[k]) for k, _l, _u in settingspage.TARGET_FIELDS}, "note": r["note"]} for r in d["rows"]],
            "limits": {"min": 0, "max": 100000, "note_max": 200}, "hint": settingspage.TARGETS_HINT}


def settings_today() -> dict:
    """What shows on Today: the five groups (habit, health, usual, review, card) with their items in the chosen order."""
    d = settingspage.today_data()
    hidden = d["prefs"]["hidden"]
    return {"groups": [{"kind": kind, "heading": heading,
                        "items": [{"id": i, "label": lbl, "shown": f"{kind}:{i}" not in hidden} for i, lbl in items]}
                       for kind, heading, items in d["groups"]],
            "hint": settingspage.TODAY_HINT}


def settings_body() -> dict:
    """Body: the height now and its history, how often measurements are due, which measures show."""
    d = settingspage.body_data()
    lo, hi = tape.HEIGHT_RANGE
    ilo, ihi = tape.INTERVAL_RANGE
    return {"valid_from": iso(d["today"]),
            "height": None if d["now"] is None else {"cm": num(d["now"]["height_cm"]), "valid_from": iso(d["now"]["valid_from"])},
            "heights": [{"cm": num(r["height_cm"]), "valid_from": iso(r["valid_from"]), "valid_from_text": _day_text(r["valid_from"])} for r in d["rows"]],
            "height_range": {"min": lo, "max": hi},
            "interval": {"days": d["prefs"]["interval"], "min": ilo, "max": ihi, "default": tape.INTERVAL_DAYS},
            "measures": [{"key": k, "label": lbl, "shown": k not in d["prefs"]["hidden"]} for k, lbl, _h in tape.TAPE],
            "hints": {"height": settingspage.HEIGHT_HINT, "measures": settingspage.MEASURES_HINT}}


def settings_coach() -> dict:
    """Settings > Coach: the goals, how to coach, the parts of each kind (on or off) and how the coach works."""
    p = coachpage.settings_data()
    return {"goals": p["goals"], "style": p["style"], "max": coach.GOALS_MAX,
            "kinds": [{"kind": kind, "title": coachpage.KIND_TITLE[kind],
                       "parts": [{"key": k, "label": lbl, "on": f"{kind}:{k}" not in p["hidden"]} for k, lbl in parts]}
                      for kind, parts in coach.PARTS.items()],
            "facts": p["facts"], "model": coach.MODEL, "daily_limit": coach.DAILY_LIMIT}


def settings_devices(session) -> dict:
    """Every signed-in device, last used first, at app. or here (logger.); current: this session's own."""
    rows = settingspage.devices_data()
    out = [{"id": str(r["sid"]), "name": settingspage.device_name(r["user_agent"]), "address": "logger" if r["front"] else "app",
            "signed_in": iso(r["created_at"]), "last_used": iso(r["last_seen"]), "expires": iso(r["expires_at"]),
            "current": r["token_hash"] == session["token_hash"]} for r in rows]
    return {"devices": out, "others": sum(1 for x in out if not x["current"])}


GRATITUDE_NOTE = "A tap on this one opens the gratitude list in the full app."


def settings_notify(session) -> dict:
    """Settings > Notifications: the nudges (the master switch, each nudge with its hours), the devices with notifications on (this:
    turned on in this session), the key a browser subscribes with (null: not set up), and twice: a device name with notifications on
    both here and at app. (that device gets every nudge twice)."""
    d = settingspage.notify_data()
    s, subs = d["settings"], d["subs"]
    out = [{"id": r["id"], "name": settingspage.device_name(r["user_agent"]), "address": r["origin"], "on_since": iso(r["created_at"]),
            "last_delivered": iso(r["last_ok"]), "this": r["session_sid"] is not None and r["session_sid"] == session["sid"]} for r in subs]
    names = {a: {x["name"] for x in out if x["address"] == a} for a in ("app", "logger")}
    return {"on": bool(s["on"]), "on_label": "Send nudges",
            "nudges": [{"key": k, "label": before, "after": after, "on": bool(s[k]),
                        "hours": {"key": hk, "value": num(s[hk]), "min": num(lo), "max": num(hi), "step": settingspage.NUDGE_STEP,
                                  "default": num(nudges.DEFAULTS[hk])},
                        "note": GRATITUDE_NOTE if k == "gratitude" else None} for k, hk, lo, hi, before, after in settingspage.NUDGE_ROWS],
            "awake_hours": nudges.AWAKE_HOURS, "subscriptions": out, "public_key": webpush.public_key(),
            "twice": bool(names["app"] & names["logger"])}


def settings_export() -> dict:
    """Settings > Export: its words and the last download (POST /export makes the file)."""
    d = export.settings_data()
    last = d["last"]
    return {"title": export.TITLE, "intro": export.INTRO, "private_label": export.PRIVATE_LABEL, "button": export.BUTTON, "hint": export.HINT,
            "last": None if last is None else {"at": iso(last["at"]), "private": last["private"], "text": d["text"]}}

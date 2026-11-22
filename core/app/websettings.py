"""What the Settings page's forms do. Each takes (form, key, session) and returns the reply shown under the entry box.
Save is the owner's yes here (as on the Health card); every change leaves an audit row with what kind of change it was, never values."""
import re
from datetime import date
from typing import Optional

from psycopg.types.json import Jsonb

from . import body, coach, gratitude, logbook, nudges, settingspage, uiprefs
from .db import connect

SID = re.compile(r"[0-9a-f-]{36}")


def _rejected(reason: str) -> dict:
    return {"outcome": "rejected", "reason": reason}


def _number(s) -> tuple[bool, Optional[float]]:
    """(ok, value): an empty field is fine and means None; a number must be 0 to 100000."""
    s = str(s or "").strip().replace(",", ".")
    if not s:
        return True, None
    try:
        v = float(s)
    except ValueError:
        return False, None
    return (0 <= v <= 100000 and v == v), v


def _int(s, lo: int, hi: int, default: int) -> int:
    try:
        return min(hi, max(lo, int(str(s).strip())))
    except ValueError:
        return default


# ---- devices ---------------------------------------------------------------------------------------

def device(form, key: Optional[str], session) -> dict:
    """Sign one other device out."""
    sid = str(form.get("sid", ""))
    if not SID.fullmatch(sid):
        return _rejected("Unknown device.")
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT token_hash FROM web_sessions WHERE sid = %s", (sid,))
        row = cur.fetchone()
        if not row:
            return {"outcome": "unchanged", "reason": "That device is already signed out."}
        if row["token_hash"] == session["token_hash"]:
            return _rejected("This is the device you are using; use Sign out at the top.")
        cur.execute("DELETE FROM web_sessions WHERE sid = %s", (sid,))
        logbook._audit(cur, "web_change", "changed", {"what": "device signed out"}, logbook.WEB)
    return {"outcome": "changed", "head": "Signed that device out."}


def others(form, key: Optional[str], session) -> dict:
    """Sign every other device out."""
    with connect() as conn, conn.cursor() as cur:
        cur.execute("DELETE FROM web_sessions WHERE token_hash <> %s", (session["token_hash"],))
        n = cur.rowcount
        logbook._audit(cur, "web_change", "changed", {"what": "other devices signed out", "n": n}, logbook.WEB)
    return {"outcome": "changed", "head": f"Signed out {n} other device{'' if n == 1 else 's'}." if n else "No other device was signed in."}


# ---- food targets ----------------------------------------------------------------------------------

def targets(form, key: Optional[str], session) -> dict:
    """New targets from a date (a row of food_targets; an old row of the same date is replaced, earlier days keep theirs)."""
    try:
        valid_from = date.fromisoformat(str(form.get("valid_from", "")).strip())
    except ValueError:
        return _rejected("Give the date the targets start on.")
    vals = {}
    for k, label, _u in settingspage.TARGET_FIELDS:
        ok, v = _number(form.get(k))
        if not ok:
            return _rejected(f"{label}: give a number from 0 to 100000, or leave it empty.")
        vals[k] = v
    if all(v is None for v in vals.values()):
        return _rejected("Give at least one target.")
    note = " ".join(str(form.get("note", "")).split())[:200] or None
    cols = list(vals)
    with connect() as conn, conn.cursor() as cur:
        cur.execute(f"""INSERT INTO food_targets (valid_from, {", ".join(cols)}, note) VALUES (%s, {", ".join(["%s"] * len(cols))}, %s)
                        ON CONFLICT (valid_from) DO UPDATE SET {", ".join(f"{c} = EXCLUDED.{c}" for c in cols)}, note = EXCLUDED.note""",
                    [valid_from] + [vals[c] for c in cols] + [note])  # column names are the fixed list above
        logbook._audit(cur, "web_change", "changed", {"what": "food targets"}, logbook.WEB)
    shown = ", ".join(f"{label} {vals[k]:g}{' ' + u if u == 'mg' else ''}" for k, label, u in settingspage.TARGET_FIELDS[:5] if vals[k] is not None)
    if vals.get("water_ml") is not None:
        shown += (", " if shown else "") + f"Water {vals['water_ml']:g} ml"
    return {"outcome": "changed", "head": f"Targets from {valid_from:%d.%m.%Y} saved: {shown}."}


# ---- body measurements (03.11.2026) ------------------------------------------------------------------

def height(form, key: Optional[str], session) -> dict:
    """The owner's height from a date (a row of body_height; one of the same date is replaced, earlier days keep theirs)."""
    try:
        valid_from = date.fromisoformat(str(form.get("valid_from", "")).strip())
    except ValueError:
        return _rejected("Give the date the height counts from.")
    ok, v = _number(form.get("height"))
    lo, hi = body.HEIGHT_RANGE
    if not ok or v is None or not lo <= v <= hi:
        return _rejected(f"Height: give a number from {lo} to {hi} cm.")
    with connect() as conn, conn.cursor() as cur:
        cur.execute("""INSERT INTO body_height (valid_from, height_cm) VALUES (%s, %s)
                       ON CONFLICT (valid_from) DO UPDATE SET height_cm = EXCLUDED.height_cm, logged_at = now()""", (valid_from, round(v, 1)))
        logbook._audit(cur, "web_change", "changed", {"what": "height"}, logbook.WEB)
    return {"outcome": "changed", "head": f"Height {round(v, 1):g} cm saved, from {valid_from:%d.%m.%Y}."}


def body_settings(form, key: Optional[str], session) -> dict:
    """How often body measurements are due, and which measures show in the form, the table and the chips."""
    lo, hi = body.INTERVAL_RANGE
    try:
        n = int(str(form.get("interval", "")).strip())
    except ValueError:
        n = None
    if n is None or not lo <= n <= hi:
        return _rejected(f"Due every: give a whole number of days from {lo} to {hi}.")
    show = {str(x) for x in form.getlist("show")}
    with connect() as conn, conn.cursor() as cur:
        names = body.names(cur)
        if not show & set(names):
            return _rejected("Keep at least one measure.")
        hidden = [k for k in names if k not in show]
        cur.execute("""INSERT INTO ui_settings (key, value) VALUES (%s, %s)
                       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()""",
                    (body.KEY, Jsonb({"interval": n, "hidden": hidden})))
        logbook._audit(cur, "web_change", "changed", {"what": "body settings"}, logbook.WEB)
    return {"outcome": "changed", "head": f"Body measurements: due every {n} days" + (f", {len(hidden)} hidden." if hidden else ".")}


# ---- the body measures (web item 58, 22.11.2026) ----------------------------------------------------------
# Settings > Body at logger. adds, changes, moves and removes measures (rows of log_types marked body_measure, migration 038); app.
# has no form for them. A measure's key (log_types.name) is made from its label once and never changes, so its values stay. Its
# label, key and words must not be a name, label or word of any other log type (active or not): the typed-line reader resolves words
# across all types, so a shared word would make a line ambiguous. A label the reader would not find by the key (an umlaut, a sign)
# is kept among the words (aliases) too, unseen: body.measures leaves it out of the words.

RESERVED = {"day", "r", "key", "csrf", "back", "confirmed", "confirm_del"}  # the Measure form's own fields (webactions.body_save)
_WORD = re.compile(r"[a-zäöüß]+(?:[ -][a-zäöüß]+)*")


def _plainkey(s: str) -> str:
    return re.sub(r"[^a-z0-9]+", "_", s.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")).strip("_")


def measure_key(label: str, taken) -> str:
    """The key of a new measure: the label in lower case, letters and digits, "_" between words, at most 30 characters; "_2", "_3",
    ... added while the key is taken. "" when the label has no letter or digit."""
    base = _plainkey(label)[:body.KEY_MAX].strip("_")
    name, n = base, 2
    while base and name in taken:
        end = f"_{n}"
        name, n = base[:body.KEY_MAX - len(end)].rstrip("_") + end, n + 1
    return name


def _measure_form(form) -> dict | str:
    """The checked fields of a measure's form ({label, landmark, min, max, words}), or the refusal in plain words."""
    label = " ".join(str(form.get("label") or "").split())
    lo, hi = body.LABEL_LEN
    if not lo <= len(label) <= hi:
        return f"Name: give {lo} to {hi} characters."
    if not _plainkey(label):
        return "Name: use letters or digits."
    landmark = " ".join(str(form.get("landmark") or "").split())
    if len(landmark) > body.LANDMARK_MAX:
        return f"Landmark: at most {body.LANDMARK_MAX} characters."
    rlo, rhi = body.RANGE_CM
    vals = {}
    for k, what in (("min", "Lowest"), ("max", "Highest")):
        ok, v = _number(form.get(k))
        if not ok or v is None or not rlo <= v <= rhi:
            return f"{what}: give a number from {rlo} to {rhi} cm."
        vals[k] = round(v, 1)
    if vals["min"] >= vals["max"]:
        return "The lowest value must be below the highest."
    words: list[str] = []
    for part in form.getlist("words"):
        for w in part.split(","):
            w = " ".join(w.split()).lower()
            if w and w not in words:
                words.append(w)
    if len(words) > body.WORDS_MAX:
        return f"Words: at most {body.WORDS_MAX}."
    for w in words:
        if len(w) > body.WORD_LEN:
            return f"The word “{w}” is longer than {body.WORD_LEN} characters."
        if not _WORD.fullmatch(w):
            return f"The word “{w}”: use letters, spaces and hyphens only."
    return {"label": label, "landmark": landmark, **vals, "words": words}


def _clash(cur, own_id, texts: list[str]) -> Optional[str]:
    """The refusal when one of texts (a label, a key, a word) is the name, label or a word of another log type, else None."""
    from .v1_food import _norm
    cur.execute("SELECT id, name, label, kind, body_measure, aliases FROM log_types WHERE id IS DISTINCT FROM %s ORDER BY id", (own_id,))
    taken: dict = {}
    for r in cur.fetchall():
        for t, how in ((r["name"], "name"), (r["label"], "name"), *((a, "word") for a in r["aliases"] or [])):
            taken.setdefault(_norm(t), (r, how))
    for t in texts:
        hit = taken.get(_norm(t))
        if hit:
            r, how = hit
            what = "the measure" if r["body_measure"] else "the habit" if r["kind"] == "event" else "the health value"
            return (f"“{t}” is already the name of {what} {r['label']}: choose another." if how == "name" else
                    f"“{t}” is already a word for {what} {r['label']}: choose another.")
    return None


def _aliases(f: dict, name: str) -> list[str]:
    from .v1_food import _norm
    extra = [f["label"].lower()] if _norm(f["label"]) != _norm(name) and f["label"].lower() not in f["words"] else []
    return f["words"] + extra


def measure_add(form, key: Optional[str], session) -> dict:
    """A new body measure at the end of the list, shown."""
    f = _measure_form(form)
    if isinstance(f, str):
        return _rejected(f)
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT name FROM log_types")
        name = measure_key(f["label"], {r["name"] for r in cur.fetchall()} | RESERVED)
        clash = _clash(cur, None, [f["label"], name, *f["words"]])
        if clash:
            return _rejected(clash)
        cur.execute("SELECT coalesce(max(sort_order), 0) + 1 AS n FROM log_types WHERE body_measure")
        cur.execute("""INSERT INTO log_types (name, label, kind, category, unit, min1, max1, aliases, on_checklist, daily_target, active,
                                              sort_order, notes, body_measure)
                       VALUES (%s, %s, 'measurement', 'vitals', 'cm', %s, %s, %s, false, 1, true, %s, %s, true)""",
                    (name, f["label"], f["min"], f["max"], _aliases(f, name), min(cur.fetchone()["n"], 32767), f["landmark"] or None))
        logbook._audit(cur, "web_change", "changed", {"what": "body measure added"}, logbook.WEB)
    typed = name.replace("_", " ")
    return {"outcome": "changed", "head": f"Added the measure {f['label']}. Measure it in the form, or type “{typed} 38.5”."}


def _measure(cur, form) -> Optional[dict]:
    cur.execute("SELECT id, name, label, sort_order FROM log_types WHERE name = %s AND body_measure AND active", (str(form.get("key") or ""),))
    return cur.fetchone()


def measure_edit(form, key: Optional[str], session) -> dict:
    """A measure's label, landmark, range and words; its key stays, so its values stay."""
    f = _measure_form(form)
    if isinstance(f, str):
        return _rejected(f)
    with connect() as conn, conn.cursor() as cur:
        row = _measure(cur, form)
        if not row:
            return _rejected("Unknown measure.")
        clash = _clash(cur, row["id"], [f["label"], *f["words"]])
        if clash:
            return _rejected(clash)
        cur.execute("UPDATE log_types SET label = %s, notes = %s, min1 = %s, max1 = %s, aliases = %s WHERE id = %s",
                    (f["label"], f["landmark"] or None, f["min"], f["max"], _aliases(f, row["name"]), row["id"]))
        logbook._audit(cur, "web_change", "changed", {"what": "body measure changed"}, logbook.WEB)
    return {"outcome": "changed", "head": f"Saved the measure {f['label']}."}


def measure_move(form, key: Optional[str], session) -> dict:
    """One place up or down: the measure swaps its order with its neighbour's (the orders made distinct first)."""
    up = form.get("dir") == "up"
    with connect() as conn, conn.cursor() as cur:
        row = _measure(cur, form)
        if not row:
            return _rejected("Unknown measure.")
        ms = body.measures(cur)
        orders = [m["order"] for m in ms]
        if len(set(orders)) < len(orders):
            for n, m in enumerate(ms):
                m["order"] = orders[0] + n
                cur.execute("UPDATE log_types SET sort_order = %s WHERE name = %s AND body_measure", (m["order"], m["key"]))
        i = next(n for n, m in enumerate(ms) if m["key"] == row["name"])
        j = i - 1 if up else i + 1
        if not 0 <= j < len(ms):
            return {"outcome": "unchanged", "reason": f"{row['label']} is already {'first' if up else 'last'}."}
        a, b = ms[i], ms[j]
        cur.execute("UPDATE log_types SET sort_order = %s WHERE name = %s AND body_measure", (b["order"], a["key"]))
        cur.execute("UPDATE log_types SET sort_order = %s WHERE name = %s AND body_measure", (a["order"], b["key"]))
        logbook._audit(cur, "web_change", "changed", {"what": "body measure moved"}, logbook.WEB)
    return {"outcome": "changed", "head": f"Moved {row['label']} {'up' if up else 'down'}."}


def measure_remove(form, key: Optional[str], session) -> dict:
    """Removes a measure without values (its row); one with values is refused: hide it instead."""
    with connect() as conn, conn.cursor() as cur:
        row = _measure(cur, form)
        if not row:
            return _rejected("Unknown measure.")
        cur.execute("SELECT EXISTS (SELECT 1 FROM measurements WHERE type_id = %s) AS v", (row["id"],))
        if cur.fetchone()["v"]:
            return _rejected(f"{row['label']} has values: hide it instead.")
        ms = body.measures(cur)
        prefs = body.settings(cur, ms)
        if [m["key"] for m in body.shown(prefs, ms)] == [row["name"]]:
            return _rejected("Keep at least one measure shown.")
        cur.execute("DELETE FROM log_types WHERE id = %s", (row["id"],))
        if row["name"] in prefs["hidden"]:  # a hidden key that is gone would hide a later measure of the same key
            cur.execute("""INSERT INTO ui_settings (key, value) VALUES (%s, %s)
                           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()""",
                        (body.KEY, Jsonb({"interval": prefs["interval"], "hidden": sorted(prefs["hidden"] - {row["name"]})})))
        logbook._audit(cur, "web_change", "changed", {"what": "body measure removed"}, logbook.WEB)
    return {"outcome": "changed", "head": f"Removed the measure {row['label']}."}


MEASURE_ACTIONS = {"add": measure_add, "edit": measure_edit, "move": measure_move, "remove": measure_remove}


# ---- habits ----------------------------------------------------------------------------------------

def habit(form, key: Optional[str], session) -> dict:
    name = str(form.get("name", ""))[:40]
    label = " ".join(str(form.get("label", "")).split())[:40]
    if not label:
        return _rejected("A habit needs a name to show.")
    with connect() as conn, conn.cursor() as cur:
        cur.execute("""UPDATE log_types SET label = %s, daily_target = %s, sort_order = %s, active = %s
                       WHERE name = %s AND kind = 'event' AND on_checklist""",
                    (label, _int(form.get("daily_target"), 1, 10, 1), _int(form.get("sort_order"), 0, 999, 100), form.get("active") == "1", name))
        if not cur.rowcount:
            return _rejected("Unknown habit.")
        logbook._audit(cur, "web_change", "changed", {"what": "habit settings"}, logbook.WEB)
    return {"outcome": "changed", "head": f"Saved the habit {label}." + ("" if form.get("active") == "1" else " It is retired: it no longer shows anywhere.")}


def habit_new(form, key: Optional[str], session) -> dict:
    label = " ".join(str(form.get("label", "")).split())[:40]
    name = re.sub(r"[^a-z0-9]+", "_", label.lower().replace("ä", "ae").replace("ö", "oe").replace("ü", "ue").replace("ß", "ss")).strip("_")[:40]
    if not label or not name:
        return _rejected("Give the habit a name with letters or digits.")
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT active, on_checklist FROM log_types WHERE name = %s OR lower(label) = lower(%s)", (name, label))
        old = cur.fetchone()
        if old:
            return _rejected(f"There is already a log type called {label}" + (" (a retired habit: switch Active on above)." if old["on_checklist"] and not old["active"] else "."))
        cur.execute("SELECT coalesce(max(sort_order), 0) + 10 AS n FROM log_types WHERE on_checklist")
        order = min(cur.fetchone()["n"], 999)
        cur.execute("""INSERT INTO log_types (name, label, kind, category, on_checklist, daily_target, active, sort_order)
                       VALUES (%s, %s, 'event', 'daily', true, %s, true, %s)""", (name, label, _int(form.get("daily_target"), 1, 10, 1), order))
        logbook._audit(cur, "web_change", "changed", {"what": "habit added"}, logbook.WEB)
    return {"outcome": "changed", "head": f"Added the habit {label}. Log it by its name or tick it on Today."}


# ---- the Today page --------------------------------------------------------------------------------

def today(form, key: Optional[str], session) -> dict:
    with connect() as c, c.cursor() as cur:
        groups = settingspage.today_items(cur)
    hidden_items, order = [], {}
    for kind, _heading, items in groups:
        pos = {}
        for n, (i, _lbl) in enumerate(items):
            if form.get(f"show_{kind}_{i}") != "1":
                hidden_items.append(f"{kind}:{i}")
            pos[i] = (_int(form.get(f"pos_{kind}_{i}"), 1, 99, n + 1), n)
        order[kind] = [i for i, _p in sorted(pos.items(), key=lambda kv: kv[1])]
    uiprefs.save(hidden_items, order)
    with connect() as conn, conn.cursor() as cur:
        logbook._audit(cur, "web_change", "changed", {"what": "today page"}, logbook.WEB)
    return {"outcome": "changed", "head": "Saved. The Today page shows what you chose." if hidden_items else "Saved. The Today page shows everything."}


def today_reset(form, key: Optional[str], session) -> dict:
    uiprefs.reset()
    return {"outcome": "changed", "head": "The Today page shows everything again, in the default order."}


def gratitude_goal(form, key: Optional[str], session) -> dict:
    """How many gratitude lines a day the card and the page count towards (14.11.2026)."""
    lo, hi = gratitude.GOAL_RANGE
    try:
        n = int(str(form.get("goal", "")).strip())
    except ValueError:
        n = None
    if n is None or not lo <= n <= hi:
        return _rejected(f"Gratitude lines a day: give a whole number from {lo} to {hi}.")
    gratitude.save_goal(n)
    with connect() as conn, conn.cursor() as cur:
        logbook._audit(cur, "web_change", "changed", {"what": "gratitude goal"}, logbook.WEB)
    return {"outcome": "changed", "head": f"Saved. The gratitude list counts to {n} a day."}


# ---- notifications ---------------------------------------------------------------------------------

def _hours(s, lo: float, hi: float, default: float) -> float:
    ok, v = _number(s)
    return default if not ok or v is None else round(min(hi, max(lo, v)) * 2) / 2  # half hours


def nudge_settings(form, key: Optional[str], session) -> dict:
    d = nudges.DEFAULTS
    values = {"on": form.get("on") == "1", "weight": form.get("weight") == "1", "habits": form.get("habits") == "1",
              "idle": form.get("idle") == "1", "weight_after": _hours(form.get("weight_after"), 0.5, 12, d["weight_after"]),
              "habits_after": _hours(form.get("habits_after"), 1, 20, d["habits_after"]), "idle_hours": _hours(form.get("idle_hours"), 1, 12, d["idle_hours"]),
              "checkin": form.get("checkin") == "1", "checkin_after": _hours(form.get("checkin_after"), 2, 15.5, d["checkin_after"]),
              "bp_evening": form.get("bp_evening") == "1",
              "bp_evening_after": _hours(form.get("bp_evening_after"), 2, 15.5, d["bp_evening_after"]),
              "gratitude": form.get("gratitude") == "1",
              "gratitude_after": _hours(form.get("gratitude_after"), 2, 15.5, d["gratitude_after"]),
              "week": form.get("week") == "1", "week_after": _hours(form.get("week_after"), 0.5, 12, d["week_after"]),
              "question": form.get("question") == "1", "question_after": _hours(form.get("question_after"), 1, 48, d["question_after"]),
              "home_timer": form.get("home_timer") == "1"}
    nudges.save(values)
    with connect() as conn, conn.cursor() as cur:
        logbook._audit(cur, "web_change", "changed", {"what": "nudges"}, logbook.WEB)
    return {"outcome": "changed", "head": "Saved. Nudges are on." if values["on"] else "Saved. Nudges are off."}


def nudge_test(form, key: Optional[str], session) -> dict:
    n = nudges.deliver({"title": "Logger", "body": "A test notification. Nudges will look like this.", "url": "/web/settings?tab=notify", "tag": "test"})
    if not n:
        return _rejected("No device took the test notification. Turn notifications on again on the phone, then try once more.")
    return {"outcome": "changed", "head": f"Test notification sent to {n} device{'' if n == 1 else 's'}."}


def push_off(form, key: Optional[str], session) -> dict:
    pid = str(form.get("id", ""))
    if not pid.isdigit():
        return _rejected("Unknown device.")
    with connect() as c:
        gone = c.execute("DELETE FROM push_subscriptions WHERE id = %s RETURNING id", (int(pid),)).fetchone()
    return {"outcome": "changed", "head": "Notifications are off for that device."} if gone else _rejected("That device is not there any more.")


ACTIONS = {"device": device, "others": others, "targets": targets, "habit": habit, "habit_new": habit_new, "today": today, "today_reset": today_reset,
           "nudges": nudge_settings, "nudge_test": nudge_test, "push_off": push_off, "height": height, "body": body_settings, "coach_goals": coach.goals_set,
           "gratitude": gratitude_goal}

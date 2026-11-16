"""The web app's Gym section (02.11.2026, step (a) of the plan in the doc "Logger v2: status and web app plan"): the Workout
tab (today's list: one tap on the circle logs an exercise with the numbers shown, a tap on the name opens − / + to change
them; Add exercise; the last 4 weeks), the Exercises tab (the owner's list with Retire / Bring back and New exercise) and the
Gym card on Today. Step (b): the Plan tab (the split's days with their exercises, in order, with the plan's sets × reps) and
today's day on the Workout tab (chips to switch day or pick Free workout) and on the Today card. Without a split, today's list is
every active exercise in the list's order. Step (c): the Progress tab (one exercise over 8 weeks with an estimated 1-rep max,
workouts per week, recent sessions) and the History tab (workouts by date). The actions are in gym.py."""
import json
from datetime import timedelta

from . import gym, rules
from .db import connect
from .webentry import esc, here, hidden, icon, key

TABS = (("workout", "/web/gym", "Workout"), ("plan", "/web/gym/plan", "Plan"), ("progress", "/web/gym/progress", "Progress"),
        ("activity", "/web/gym/activity", "Activity"), ("history", "/web/gym/history", "History"), ("exercises", "/web/gym/exercises", "Exercises"))
# The first time an exercise is done there is nothing to repeat: its row opens these numbers to set first
DEFAULT = {"weights": {"sets": 3, "reps": 8, "kg": None, "minutes": None, "km": None},
           "bodyweight": {"sets": 3, "reps": 10, "kg": None, "minutes": None, "km": None},
           "cardio": {"sets": None, "reps": None, "kg": None, "minutes": 20, "km": None}}
FIELDS = {"weights": (("sets", "Sets", 1, 1, 50), ("reps", "Reps", 1, 1, 500), ("kg", "kg", 2.5, 0, 1000)),
          "bodyweight": (("sets", "Sets", 1, 1, 50), ("reps", "Reps", 1, 1, 500)),
          "cardio": (("minutes", "Minutes", 1, 1, 600), ("km", "km", 0.1, 0, 200))}
VALS = ("sets", "reps", "kg", "minutes", "km")


def _tabs(on: str) -> str:
    """The Activity tab shows once watch data has come (04.11.2026: until then it was set-up steps only; they are linked from
    Settings > Devices)."""
    with connect() as c:
        watch = c.execute("SELECT EXISTS (SELECT 1 FROM watch_metrics) OR EXISTS (SELECT 1 FROM watch_workouts) AS any").fetchone()["any"]
    links = "".join(f'<a href="{href}"' + (' aria-current="page"' if k == on else "") + f">{label}</a>" for k, href, label in TABS
                    if k != "activity" or watch or on == "activity")
    return f'<div class="head"><h1>Gym</h1><nav class="seg" aria-label="Gym">{links}</nav></div>'


def _plain(x) -> str:
    return "" if x is None else format(float(x), "g")


def load(cur) -> dict:
    cur.execute("SELECT log_day(now()) AS d")
    today = cur.fetchone()["d"]
    cur.execute("SELECT * FROM exercises ORDER BY sort_order, lower(name)")
    exercises = cur.fetchall()
    cur.execute("""SELECT s.*, x.kind, w.started_at FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
                   JOIN exercises x ON x.id = s.exercise_id WHERE w.day = %s ORDER BY s.sort_order, s.id""", (today,))
    now_rows = cur.fetchall()
    # each exercise's last earlier session: all its rows of that day
    cur.execute("""WITH last AS (SELECT s.exercise_id, max(w.day) AS day FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
                                 WHERE w.day < %s GROUP BY s.exercise_id)
                   SELECT s.*, x.kind, w.day FROM workout_sets s JOIN workouts w ON w.id = s.workout_id JOIN exercises x ON x.id = s.exercise_id
                   JOIN last l ON l.exercise_id = s.exercise_id AND l.day = w.day ORDER BY s.exercise_id, s.sort_order, s.id""", (today,))
    last: dict = {}
    for r in cur.fetchall():
        last.setdefault(r["exercise_id"], []).append(r)
    monday = today - timedelta(days=today.weekday())
    cur.execute("SELECT DISTINCT day FROM workouts WHERE day BETWEEN %s AND %s", (monday - timedelta(days=21), today))
    days = {r["day"] for r in cur.fetchall()}
    cur.execute("SELECT i.* FROM workout_day_items i JOIN workout_days d ON d.id = i.day_id WHERE d.active ORDER BY i.sort_order, i.id")
    items: dict = {}
    for r in cur.fetchall():
        items.setdefault(r["day_id"], []).append(r)
    return {"today": today, "monday": monday, "exercises": exercises, "now": now_rows, "last": last, "days": days,
            "started": min((r["started_at"] for r in now_rows), default=None), "split": gym.split(cur, today), "items": items}


def _field(ex_id: int, kind: str, vals: dict) -> str:
    out = []
    for name, label, step, lo, hi in FIELDS[kind]:
        fid = f"g{ex_id}-{name}"
        out.append(f'<label class="gstep" for="{fid}"><span class="small">{label}</span><span class="stepper">'
                   f'<button type="button" class="ghost sm" data-step="-{step}" data-for="{fid}" aria-label="{label} down by {step}">−</button>'
                   f'<input type="number" id="{fid}" name="{name}" value="{_plain(vals.get(name))}" min="{lo}" max="{hi}" step="any" inputmode="decimal">'
                   f'<button type="button" class="ghost sm" data-step="{step}" data-for="{fid}" aria-label="{label} up by {step}">+</button></span></label>')
    return "".join(out)


def row_data(ex: dict, d: dict, plan: dict | None = None, first: bool = True) -> dict:
    """One exercise of the Workout tab as data (deploy 95, shared with the JSON door): today's rows (mine), its last session (prev),
    the numbers the editor shows and the circle logs (vals; ready: complete, so one tap logs them), the "+2.5 kg" mark (up), the
    line under the name (said), the "Last Tue 04.11.: …" line and whether its editor starts opened."""
    mine = [r for r in d["now"] if r["exercise_id"] == ex["id"]]
    prev = d["last"].get(ex["id"], [])
    # today's last row, else the last session's heaviest row (its first until 04.11.2026: the lightest of a pyramid)
    top = max(prev, key=lambda r: (float(r["kg"] or 0), float(r["minutes"] or 0))) if prev else None
    pre = mine[-1] if mine else top
    vals = {k: pre[k] for k in VALS} if pre else dict(DEFAULT[ex["kind"]])
    if not pre and plan and plan["sets"] and ex["kind"] != "cardio":  # the first time: the plan's sets × reps
        vals.update(sets=plan["sets"], reps=plan["reps"])
    if not pre:  # the first time with complete numbers (cardio's 20 minutes, the plan's sets × reps): the circle logs them too
        try:
            gym.values(ex["kind"], {k: _plain(v) for k, v in vals.items() if v is not None})
            pre = vals
        except ValueError:
            pass
    up = None
    if mine and prev and ex["kind"] == "weights":
        top_now, top_then = max(float(r["kg"] or 0) for r in mine), max(float(r["kg"] or 0) for r in prev)
        if top_now > top_then:
            up = top_now - top_then
    said = ", ".join(gym.row_text(r) for r in mine) if mine else gym.fmt(ex["kind"], **vals) if pre else "first time: set the numbers"
    lastline = f'Last {prev[0]["day"]:%a %d.%m.}: {", ".join(gym.row_text(r) for r in prev)}' if prev else "Not done before" + (
        f' · plan {plan["sets"]} × {plan["reps"]}' if plan and plan["sets"] else "")
    return {"ex": ex, "mine": mine, "prev": prev, "vals": vals, "ready": bool(pre), "up": up, "said": said, "lastline": lastline,
            "plan": plan, "open": not (pre or mine or not first)}


def _row(ex: dict, d: dict, csrf: str, plan: dict | None = None, first: bool = True) -> str:
    r = row_data(ex, d, plan, first)
    mine, vals, said = r["mine"], r["vals"], r["said"]
    up = f' <span class="pill up">+{_plain(r["up"])} kg</span>' if r["up"] is not None else ""
    base = hidden("csrf", csrf) + hidden("exercise", str(ex["id"])) + here("/web/gym")
    if mine:
        tick = (f'<form method="post" action="/web/gym/remove">{base}<button class="gtick done" type="submit" aria-pressed="true" '
                f'aria-label="Take {esc(ex["name"])} off today’s workout"><span class="box">{icon("check")}</span></button></form>')
    elif r["ready"]:
        tick = (f'<form method="post" action="/web/gym/tick">{base}{hidden("key", key())}'
                + "".join(hidden(k, _plain(vals[k])) for k in VALS if vals[k] is not None)
                + f'<button class="gtick" type="submit" aria-pressed="false" aria-label="Log {esc(ex["name"])}: {esc(said)}">'
                  f'<span class="box">{icon("check")}</span></button></form>')
    else:
        tick = (f'<span class="gtick off" title="Set the numbers first: tap the name"><span class="box">{icon("check")}</span></span>')
    rows = "".join(f'<form class="gline" method="post" action="/web/gym/remove">{hidden("csrf", csrf)}{hidden("set", str(x["id"]))}{here("/web/gym")}'
                   f'<span>{esc(gym.row_text(x))}</span><button class="icon" type="submit" aria-label="Remove {esc(gym.row_text(x))}" title="Remove">&times;</button></form>'
                   for x in mine) if len(mine) > 1 else ""
    editor = (f'<form class="fe-form gform" method="post" action="/web/gym/tick">{base}{hidden("key", key())}{_field(ex["id"], ex["kind"], vals)}'
              f'<button class="primary sm" type="submit">{"Add another row" if mine else "Log"}</button></form>{rows}')
    return (f'<div class="gx{" done" if mine else ""}" id="x{ex["id"]}">{tick}<details class="gedit"{" open" if r["open"] else ""}>'
            f'<summary><span class="gname">{esc(ex["name"])}</span><span class="gval">{esc(said)}{up}</span>'
            f'<span class="small">{esc(r["lastline"])}</span></summary>{editor}</details></div>')


def _new(csrf: str, d: dict, back: str, open_: bool = False, today: bool = False) -> str:
    """today: the Workout tab's form, which also puts the exercise on today's day of the split (04.11.2026: it went to the
    closed "Other exercises" and seemed lost)."""
    gone = "".join(f'<option value="{esc(x["name"])}"></option>' for x in d["exercises"] if not x["active"])
    kinds = "".join(f'<option value="{k}">{v}</option>' for k, v in gym.KINDS.items())
    return (f'<details class="lookup"{" open" if open_ else ""}><summary class="ghost">+ {"New" if open_ else "Add"} exercise</summary>'
            f'<form class="fbox" method="post" action="/web/gym/new">{hidden("csrf", csrf)}{here(back)}{hidden("today", "1") if today else ""}<div class="fields">'
            '<label>Name<input name="name" maxlength="60" required list="gym-retired" autocomplete="off" placeholder="e.g. Bench press"></label>'
            f'<label>Kind<select name="kind">{kinds}</select></label>'
            '<label>Other words (optional)<input name="words" maxlength="200" placeholder="e.g. bench, chest press"></label></div>'
            f'<datalist id="gym-retired">{gone}</datalist><p class="row"><button class="primary sm" type="submit">Add</button>'
            '<span class="small">A retired exercise of the same name comes back with its history.</span></p></form></details>')


def weeks_data(d: dict) -> dict:
    """The last 4 weeks, Monday to Sunday, a square per day: consistency without streaks. good: the weeks with 2+ workouts."""
    rows, good = [], 0
    for i in range(3, -1, -1):
        start = d["monday"] - timedelta(days=7 * i)
        cells = [start + timedelta(days=j) for j in range(7)]
        n = sum(c in d["days"] for c in cells)
        good += n >= 2
        rows.append({"start": start, "label": "This week" if i == 0 else "Last week" if i == 1 else f"{start:%d.%m.}", "n": n,
                     "days": [{"day": c, "on": c in d["days"], "today": c == d["today"], "later": c > d["today"]} for c in cells]})
    return {"good": good, "weeks": rows}


def _weeks(d: dict) -> str:
    w = weeks_data(d)
    out = []
    heads = "".join(f'<span class="dh">{x}</span>' for x in ("M", "T", "W", "T", "F", "S", "S"))
    for row in w["weeks"]:
        label, n = row["label"], row["n"]
        sq = "".join(f'<span class="gd{" on" if c["on"] else ""}{" today" if c["today"] else ""}{" later" if c["later"] else ""}"></span>'
                     for c in row["days"])
        out.append(f'<div class="wk4" role="img" aria-label="{label}: {n} workout{"" if n == 1 else "s"}"><span class="small">{label}</span>{sq}'
                   f'<span class="small num">{n}</span></div>')
    return (f'<h2><span>Last 4 weeks</span><span class="small">{w["good"]} of 4 weeks with 2+ workouts</span></h2>'
            f'<div class="wk4 head" aria-hidden="true"><span></span>{heads}<span></span></div>{"".join(out)}')


def _nth(n: int) -> str:
    return f"{n}{'st' if n % 10 == 1 and n % 100 != 11 else 'nd' if n % 10 == 2 and n % 100 != 12 else 'rd' if n % 10 == 3 and n % 100 != 13 else 'th'}"


def daypick_data(sp: dict) -> dict:
    """The chips to switch today's day (split: a day's id or "free"; label; on) and why this day (plain words), or no split."""
    if not sp["days"]:
        return {"chips": [], "why": None}
    chips = [(str(x["id"]), gym.label(sp["days"], x), sp["day"] is not None and x["id"] == sp["day"]["id"]) for x in sp["days"]]
    chips.append(("free", "Free workout", sp["free"]))
    if sp["free"]:
        why = "Free workout: all your exercises."
    elif sp["hand"]:
        why = f'Picked by you instead of {gym.label(sp["days"], sp["auto"])}.'
    elif sp["started"]:
        why = "Today’s day. Tap another day to switch."
    else:
        why = f'Your {_nth(sp["nth"])} workout this week: the first day not done yet. Tap another day to switch.'
    return {"chips": chips, "why": why}


def _daypick(sp: dict, csrf: str) -> str:
    """The chips to switch today's day, and why this day."""
    p = daypick_data(sp)
    if not p["chips"]:
        return '<p class="small">No split yet: make one on the <a href="/web/gym/plan">Plan</a> tab.</p>'
    out = "".join(f'<form method="post" action="/web/gym/pick">{hidden("csrf", csrf)}{hidden("split", v)}{here("/web/gym")}'
                  f'<button type="submit" class="chip{" on" if on else ""}" aria-pressed="{"true" if on else "false"}">{esc(t)}</button></form>'
                  for v, t, on in p["chips"])
    return f'<div class="chips gpick" role="group" aria-label="Today’s day">{out}</div><p class="small gwhy">{esc(p["why"])}</p>'


def split_card_data(d: dict) -> list:
    """This week's split: each day with its exercises' names, the day it was done this week (or None), and whether it is today's."""
    sp = d["split"]
    names = {x["id"]: x["name"] for x in d["exercises"]}
    return [{"day": x, "label": gym.label(sp["days"], x), "done": sp["done"].get(x["id"]),
             "today": sp["day"] is not None and x["id"] == sp["day"]["id"],
             "exercises": ", ".join(names.get(i["exercise_id"], "") for i in d["items"].get(x["id"], [])) or "No exercises yet"}
            for x in sp["days"]]


def _split_card(d: dict) -> str:
    """This week's split (the PC only): each day, when it was done this week, today's."""
    rows = []
    for x in split_card_data(d):
        when = x["done"]
        note = (f'<span class="pill go">Done {when:%a}</span>' if when else '<span class="pill">Today</span>' if x["today"] else "")
        rows.append(f'<div class="hm"><span class="hm-main">{esc(x["label"])}<span class="small">{esc(x["exercises"])}</span></span>{note}</div>')
    if not rows:
        return ""
    return f'<div class="card gsplit"><h2><span>This week’s split</span><a class="small" href="/web/gym/plan">Edit</a></h2>{"".join(rows)}</div>'


def workout_list(d: dict) -> dict:
    """Today's list in app.'s order: with a day of the split, the day's exercises in the plan's order (retired ones only when done
    today), then any other done today, the rest folded away under "Other exercises"; without one (Free workout, no split), every
    active exercise and any done today. shown and rest: (exercise, its plan item or None, first: whether a new one may open)."""
    sp = d["split"]
    done_ids = {r["exercise_id"] for r in d["now"]}
    byid = {x["id"]: x for x in d["exercises"]}
    if sp["day"] is not None:  # the day's exercises in the plan's order, then any other done today; the rest folded away
        plan = {i["exercise_id"]: i for i in d["items"].get(sp["day"]["id"], [])}
        shown = [byid[i] for i in plan if byid[i]["active"] or i in done_ids]
        shown += [x for x in d["exercises"] if x["id"] in done_ids and x["id"] not in plan]
        rest = [x for x in d["exercises"] if x["active"] and x not in shown]
        new = next((x["id"] for x in shown if x["id"] not in done_ids and x["id"] not in d["last"]), None)  # only the first new one opens
        return {"title": gym.label(sp["days"], sp["day"]), "shown": [(x, plan.get(x["id"]), x["id"] == new) for x in shown],
                "rest": [(x, None, False) for x in rest], "empty": "No exercises on this day yet: add them on the Plan tab."}
    shown = [x for x in d["exercises"] if x["active"] or x["id"] in done_ids]
    return {"title": "Free workout" if sp["free"] else "Today’s workout", "shown": [(x, None, True) for x in shown], "rest": [],
            "empty": "No exercises yet: add your first one below."}


def status(d: dict) -> str:
    done = len({r["exercise_id"] for r in d["now"]})
    return f'started {d["started"].astimezone(rules.BERLIN):%H:%M} · {done} done' if d["started"] else "not started: the first tick starts it"


HINT = "Tap the circle to log the numbers shown, tap the name to change them. Undo is in the bar above."


def render_workout(csrf: str, q=None) -> str:
    with connect() as conn, conn.cursor() as cur:
        d = load(cur)
    sp, w = d["split"], workout_list(d)
    rows = "".join(_row(x, d, csrf, plan, first) for x, plan, first in w["shown"]) or f'<p class="empty">{w["empty"]}</p>'
    other = ""
    if w["rest"]:
        other = (f'<details class="gmore"><summary class="ghost">Other exercises ({len(w["rest"])})</summary>'
                 f'<div class="gx-list">{"".join(_row(x, d, csrf, first=False) for x, _p, _f in w["rest"])}</div></details>')
    hint = f'<p class="small hint">{HINT}</p>' if w["shown"] or w["rest"] else ""
    return (_tabs("workout") + f'<div class="card"><h2><span>{esc(w["title"])}</span><span class="small">{status(d)}</span></h2>{_daypick(sp, csrf)}'
            f'<div class="gx-list">{rows}</div>{other}{hint}{_new(csrf, d, "/web/gym", today=True)}</div>{_split_card(d)}<div class="card">{_weeks(d)}</div>')


def _numbers(item_id: int, item: dict | None, csrf: str, action: str, extra: str = "", button: str = "Save") -> str:
    """Sets × reps fields of the plan (both optional)."""
    v = item or {}
    f = "".join(f'<label class="gstep" for="p{item_id}-{k}"><span class="small">{t}</span><input type="number" id="p{item_id}-{k}" name="{k}" '
                f'value="{_plain(v.get(k))}" min="1" max="{hi}" step="1" inputmode="numeric"></label>' for k, t, hi in (("sets", "Sets", 50), ("reps", "Reps", 500)))
    return (f'<form class="fe-form gform" method="post" action="/web/gym/{action}">{hidden("csrf", csrf)}{extra}{here("/web/gym/plan")}'
            f'{f}<button class="primary sm" type="submit">{button}</button></form>')


def _move(item: dict, csrf: str, way: str, off: bool, name: str) -> str:
    arrow = "M6 15l6-6 6 6" if way == "up" else "M6 9l6 6 6-6"
    return (f'<form method="post" action="/web/gym/itemmove">{hidden("csrf", csrf)}{hidden("item", str(item["id"]))}{hidden("dir", way)}'
            f'{here("/web/gym/plan")}<button type="submit" class="icon" aria-label="Move {way}: {esc(name)}"{" disabled" if off else ""}>'
            f'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="{arrow}"/></svg></button></form>')


def plan_day_data(x: dict, d: dict) -> dict:
    """A day of the split on the Plan tab: its exercises in order (item, exercise, the line under the name), the active exercises
    that can still be added, whether it is today's day."""
    sp, byid = d["split"], {e["id"]: e for e in d["exercises"]}
    items = []
    for i in d["items"].get(x["id"], []):
        e = byid[i["exercise_id"]]
        what = gym.KINDS[e["kind"]] + (f' · plan {i["sets"]} × {i["reps"]}' if i["sets"] else "") + ("" if e["active"] else " · retired")
        items.append({"item": i, "ex": e, "what": what})
    on = {i["ex"]["id"] for i in items}
    return {"day": x, "label": gym.label(sp["days"], x), "items": items, "today": sp["day"] is not None and sp["day"]["id"] == x["id"],
            "can_add": [e for e in d["exercises"] if e["active"] and e["id"] not in on]}


def _plan_day(x: dict, d: dict, csrf: str) -> str:
    p = plan_day_data(x, d)
    items = p["items"]
    rows = []
    for n, it in enumerate(items):
        i, e, what = it["item"], it["ex"], it["what"]
        rows.append(f'<div class="pitem"><details class="gedit"><summary><span class="gname">{esc(e["name"])}</span><span class="small">{esc(what)}</span></summary>'
                    + (_numbers(i["id"], i, csrf, "itemset", hidden("item", str(i["id"]))) if e["kind"] != "cardio" else
                       '<p class="small">Cardio: you set the minutes when you log it.</p>')
                    + f'</details>{_move(i, csrf, "up", n == 0, e["name"])}{_move(i, csrf, "down", n == len(items) - 1, e["name"])}'
                    f'<form method="post" action="/web/gym/itemremove">{hidden("csrf", csrf)}{hidden("item", str(i["id"]))}{here("/web/gym/plan")}'
                    f'<button type="submit" class="icon" aria-label="Take {esc(e["name"])} off this day" title="Take off this day">&times;</button></form></div>')
    opts = "".join(f'<option value="{e["id"]}">{esc(e["name"])}</option>' for e in p["can_add"])
    add = (f'<details class="lookup"><summary class="ghost">+ Add exercise</summary>'
           f'<form class="fbox" method="post" action="/web/gym/itemadd">{hidden("csrf", csrf)}{hidden("day", str(x["id"]))}{here("/web/gym/plan")}'
           f'<div class="fields"><label>Exercise<select name="exercise" required>{opts}</select></label>'
           '<label>Sets (optional)<input type="number" name="sets" min="1" max="50" inputmode="numeric"></label>'
           '<label>Reps (optional)<input type="number" name="reps" min="1" max="500" inputmode="numeric"></label></div>'
           '<p class="row"><button class="primary sm" type="submit">Add</button><span class="small">New exercises: the '
           '<a href="/web/gym/exercises">Exercises</a> tab.</span></p></form></details>' if opts else
           '<p class="small">All your exercises are on this day. New ones: the <a href="/web/gym/exercises">Exercises</a> tab.</p>')
    edit = (f'<details class="lookup"><summary class="ghost">Rename or remove</summary><form class="fbox" method="post" action="/web/gym/dayedit">'
            f'{hidden("csrf", csrf)}{hidden("day", str(x["id"]))}{here("/web/gym/plan")}<div class="fields"><label>Name<input name="name" maxlength="40" '
            f'required value="{esc(x["name"])}"></label></div><p class="row"><button class="primary sm" type="submit">Rename</button></p></form>'
            f'<form method="post" action="/web/gym/dayactive">{hidden("csrf", csrf)}{hidden("day", str(x["id"]))}{hidden("on", "0")}{here("/web/gym/plan")}'
            '<p class="row"><button class="ghost sm" type="submit">Remove this day</button><span class="small">Past workouts keep its name.</span></p></form></details>')
    n = len(items)
    tag = '<span class="pill">Today</span>' if p["today"] else f'<span class="small">{n} exercise{"" if n == 1 else "s"}</span>'
    body = "".join(rows) or '<p class="empty">No exercises yet.</p>'
    return f'<div class="card"><h2><span>{esc(p["label"])}</span>{tag}</h2><div class="plist">{body}</div>{add}{edit}</div>'


HOW = ("Each workout takes the first day not done yet this week. Monday starts at Day 1 again; once every day is done, Day 1 comes "
       "again. On the Workout tab you can switch the day or pick Free workout.")


def plan_week(sp: dict) -> str:
    """The Plan tab's line on this week: the days done and today's day ("" without a split)."""
    done = [f'{gym.label(sp["days"], x)} on {sp["done"][x["id"]]:%a}' for x in sp["days"] if x["id"] in sp["done"]]
    return ("This week: " + ", ".join(done) + " done. " if done else "") + (
        f'Today: {gym.label(sp["days"], sp["day"])}.' if sp["day"] is not None else "Today: Free workout." if sp["free"] else "")


def render_plan(csrf: str, q=None) -> str:
    with connect() as conn, conn.cursor() as cur:
        d = load(cur)
        gone = gym.days(cur, retired=True)
    sp = d["split"]
    week = plan_week(sp)
    week = f'<p class="small">{esc(week)}</p>' if week else ""
    how = f'<div class="card"><h2><span>How the day is picked</span></h2><p>{HOW}</p>{week}</div>'
    cards = "".join(_plan_day(x, d, csrf) for x in sp["days"])
    new = (f'<div class="card"><details class="lookup"{"" if sp["days"] else " open"}><summary class="ghost">+ New workout day</summary>'
           f'<form class="fbox" method="post" action="/web/gym/daynew">{hidden("csrf", csrf)}{here("/web/gym/plan")}<div class="fields">'
           '<label>Name<input name="name" maxlength="40" required placeholder="e.g. Push"></label></div>'
           '<p class="row"><button class="primary sm" type="submit">Add day</button></p></form></details>')
    if gone:
        new += '<h2><span>Removed days</span></h2>' + "".join(
            f'<div class="hm retired"><span class="hm-main">{esc(x["name"])}</span><form method="post" action="/web/gym/dayactive">{hidden("csrf", csrf)}'
            f'{hidden("day", str(x["id"]))}{hidden("on", "1")}{here("/web/gym/plan")}<button class="ghost sm" type="submit">Bring back</button></form></div>'
            for x in gone)
    return _tabs("plan") + how + cards + new + "</div>"


def exercise_use(cur) -> dict:
    """exercise id -> {n: the days it was done, day: the last one}."""
    cur.execute("SELECT s.exercise_id, max(w.day) AS day, count(DISTINCT w.day) AS n FROM workout_sets s JOIN workouts w ON w.id = s.workout_id GROUP BY 1")
    return {r["exercise_id"]: r for r in cur.fetchall()}


def use_text(u) -> str:
    return f'{u["n"]} workout{"" if u["n"] == 1 else "s"}, last {u["day"]:%d.%m.}' if u else "not done yet"


def exercise_meta(x: dict, u) -> str:
    """The Exercises tab's line under a name: "Weights · also: bench · 3 workouts, last 04.11." """
    return " · ".join(v for v in (gym.KINDS[x["kind"]], f'also: {", ".join(x["words"])}' if x["words"] else "", use_text(u)) if v)


def render_exercises(csrf: str, q=None) -> str:
    with connect() as conn, conn.cursor() as cur:
        d = load(cur)
        use = exercise_use(cur)
    rows = []
    for x in d["exercises"]:
        meta = exercise_meta(x, use.get(x["id"]))
        ren = (f'<details class="hm-pop"><summary class="hm-link">Rename</summary><form method="post" action="/web/gym/rename">'
               f'{hidden("csrf", csrf)}{hidden("exercise", str(x["id"]))}{here("/web/gym/exercises")}'
               f'<input name="name" value="{esc(x["name"])}" maxlength="60" required aria-label="New name for {esc(x["name"])}">'
               '<button class="primary sm" type="submit">Save</button><span class="small">Past workouts move with it.</span></form></details>')
        btn = (f'<form method="post" action="/web/gym/active">{hidden("csrf", csrf)}{hidden("exercise", str(x["id"]))}{hidden("on", "0" if x["active"] else "1")}'
               f'{here("/web/gym/exercises")}<button class="ghost sm" type="submit">{"Retire" if x["active"] else "Bring back"}</button></form>')
        rows.append(f'<div class="hm{"" if x["active"] else " retired"}"><span class="hm-main">{esc(x["name"])}<span class="small">{esc(meta)}</span></span>'
                    f'<div class="hm-ctl">{ren}{btn}</div></div>')
    n = sum(1 for x in d["exercises"] if x["active"])
    body = "".join(rows) or '<p class="empty">No exercises yet.</p>'
    return (_tabs("exercises") + f'<div class="card"><h2><span>Your exercises</span><span class="small">{n} active</span></h2>{body}'
            f'{_new(csrf, d, "/web/gym/exercises", open_=not rows)}</div>')


def today_data() -> dict:
    """The Gym card on Today as data: the last workout's day, today's day of the split, the last 14 days, this week and last week."""
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT log_day(now()) AS d")
        today = cur.fetchone()["d"]
        cur.execute("SELECT DISTINCT day FROM workouts WHERE day BETWEEN %s AND %s", (today - timedelta(days=20), today))
        days = {r["day"] for r in cur.fetchall()}
        cur.execute("SELECT max(day) AS d FROM workouts")
        last = cur.fetchone()["d"]
        sp = gym.split(cur, today)
    monday = today - timedelta(days=today.weekday())
    two = [today - timedelta(days=13 - i) for i in range(14)]
    return {"today": today, "last": last, "split": sp,
            "day": gym.label(sp["days"], sp["day"]) if sp["day"] is not None else "Free workout" if sp["free"] else None,
            "days": [{"day": x, "on": x in days, "today": x == today} for x in two], "n14": sum(x in days for x in two),
            "this_week": sum(1 for x in days if x >= monday), "last_week": sum(1 for x in days if monday - timedelta(days=7) <= x < monday)}


def week_text(t: dict) -> str:
    say = lambda n: "none yet" if n == 0 else f"{n} workout{'' if n == 1 else 's'}"  # noqa: E731
    return f'Last week {say(t["last_week"])} · this week {say(t["this_week"])}'


def today_card() -> str:
    """The Gym card on Today: the last workout, the last 14 days as squares, this week and last week."""
    t = today_data()
    last, n14 = t["last"], t["n14"]
    sq = "".join(f'<span class="gd{" on" if x["on"] else ""}{" today" if x["today"] else ""}"></span>' for x in t["days"])
    pill = f'Last: {last:%a %d.%m.}' if last else "No workouts yet"
    day = f'<p class="gtoday">Today: {esc(t["day"])}</p>' if t["day"] else ""
    return (f'<div class="card gymcard"><h2><span>{icon("gym")}Gym</span><span class="pill">{pill}</span></h2>{day}'
            f'<div class="gdays" role="img" aria-label="Last 14 days: {n14} workout{"" if n14 == 1 else "s"}">{sq}</div>'
            f'<p class="small">{week_text(t)}</p>'
            '<a class="primary gopen" href="/web/gym">Open today’s workout</a></div>')


# Step (c), 02.11.2026: Progress (per exercise over 8 weeks, workouts per week, recent sessions) and History (workouts by date)
WEEKS = 8


def _top(kind: str, rows: list) -> tuple:
    """A session's best: weights the heaviest set (kg, reps of it), bodyweight the most reps, cardio the longest minutes."""
    if kind == "weights":
        r = max(rows, key=lambda r: (float(r["kg"] or 0), r["reps"] or 0))
        return float(r["kg"] or 0), r["reps"]
    if kind == "bodyweight":
        return float(max(r["reps"] or 0 for r in rows)), None
    return float(max(r["minutes"] or 0 for r in rows)), None


def per_week(today, days: set) -> dict:
    """Workouts per week, the last 8 weeks (oldest first, each Monday and its count), the axis top (3 at least) and the weeks with 2+."""
    monday = today - timedelta(days=today.weekday())
    weeks = [monday - timedelta(days=7 * i) for i in range(WEEKS - 1, -1, -1)]
    counts = [sum(1 for d in days if w <= d < w + timedelta(days=7)) for w in weeks]
    return {"weeks": [{"start": w, "n": n} for w, n in zip(weeks, counts)], "top": max(3, max(counts)), "good": sum(n >= 2 for n in counts)}


def _per_week(p: dict) -> str:
    """app.'s drawing of per_week: bars drawn on the server (counts above, Mondays below)."""
    top = p["top"]
    weeks, counts = [x["start"] for x in p["weeks"]], [x["n"] for x in p["weeks"]]
    bars = "".join(f'<rect class="gbar{" now" if i == WEEKS - 1 else ""}" x="{8 + i * 40}" y="{round(64 - n / top * 56, 1)}" width="24" '
                   f'height="{round(n / top * 56, 1)}" rx="3"/><text x="{20 + i * 40}" y="{round(60 - n / top * 56, 1)}" text-anchor="middle">{n}</text>'
                   for i, n in enumerate(counts))
    labels = "".join(f'<text x="{20 + i * 40}" y="80" text-anchor="middle">{w:%d.%m.}</text>' for i, w in enumerate(weeks))
    aria = ", ".join(f"week of {w:%d.%m.}: {n}" for w, n in zip(weeks, counts))
    return (f'<div class="card"><h2><span>Workouts per week</span><span class="small">{p["good"]} of {WEEKS} weeks with 2+</span></h2>'
            f'<svg class="gweeks" viewBox="0 0 320 84" role="img" aria-label="Workouts per week: {aria}"><path class="base" d="M0 64.5H320"/>{bars}{labels}</svg></div>')


UNITS = {"weights": "kg", "bodyweight": "reps", "cardio": "min"}
TITLES = {"weights": "top weight", "bodyweight": "most reps in a set", "cardio": "longest session"}


def progress(q=None) -> dict:
    """The Progress tab as data: the exercises done (most recently done first; x = the one asked for, else the first), its top
    number now, the change over the 8 weeks, the line under it (top set and the estimated 1-rep max, or the last session), the
    chart as drawChart takes it, the last 6 sessions, and workouts per week. ex None: nothing logged yet."""
    with connect() as conn, conn.cursor() as cur:
        today = gym._today(cur)
        first = today - timedelta(days=7 * WEEKS - 1)
        cur.execute("""SELECT s.*, x.name, x.kind, w.day FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
                       JOIN exercises x ON x.id = s.exercise_id ORDER BY w.day, s.sort_order, s.id""")
        rows = cur.fetchall()
        cur.execute("SELECT DISTINCT day FROM workouts WHERE day >= %s", (first - timedelta(days=7),))
        wdays = {r["day"] for r in cur.fetchall()}
    out = {"today": today, "first": first, "per_week": per_week(today, wdays), "ex": None}
    if not rows:
        return out
    by: dict = {}
    for r in rows:
        by.setdefault(r["exercise_id"], {}).setdefault(r["day"], []).append(r)
    last_day = {k: max(v) for k, v in by.items()}
    order = sorted(by, key=lambda k: last_day[k], reverse=True)  # the most recently done first
    want = gym._id((q or {}).get("x"))
    pick = want if want in by else order[0]
    sessions = by[pick]
    kind, name = sessions[max(sessions)][0]["kind"], sessions[max(sessions)][0]["name"]
    unit, title = UNITS[kind], TITLES[kind]
    tops = {d: _top(kind, rs) for d, rs in sessions.items()}
    window = sorted(d for d in tops if d >= first)
    now_v, now_reps = tops[max(tops)]
    if window and len(window) > 1:
        diff = tops[window[-1]][0] - tops[window[0]][0]
        change = (f'+{_plain(diff)} {unit} since {window[0]:%d.%m.}' if diff > 0 else f'−{_plain(-diff)} {unit} since {window[0]:%d.%m.}' if diff < 0
                  else f'same as {window[0]:%d.%m.}')
    else:
        change = "one session so far" if len(tops) == 1 else "no sessions in the last 8 weeks"
    orm = round(now_v * (1 + (now_reps or 1) / 30)) if kind == "weights" and now_v else None
    sub = f'Top set {_plain(now_v)} kg × {now_reps} · estimated 1-rep max ≈ {orm} kg' if orm is not None else f"Last session {max(tops):%a %d.%m.}"
    pts = [[(d - first).days, round(tops[d][0], 1), f'{d:%a %d.%m.}: {gym.fmt(kind, **_best_row(kind, sessions[d]))}'] for d in window]
    chart = {"start": first.isoformat(), "days": 7 * WEEKS, "label": f"{name}: {title} in {unit}", "decimals": 1,
             "series": [{"mark": "line", "cls": "a", "pts": pts}, {"mark": "dot", "cls": "a", "pts": pts}]} if pts else None
    out.update(ex={"id": pick, "name": name, "kind": kind}, chips=[(k, by[k][last_day[k]][0]["name"], k == pick) for k in order], unit=unit,
               title=title, top=now_v, top_reps=now_reps, change=change, one_rep_max=orm, sub=sub, chart=chart,
               recent=[(d, sessions[d]) for d in sorted(sessions, reverse=True)[:6]])
    return out


def render_progress(csrf: str, q=None) -> str:
    p = progress(q)
    weeks = _per_week(p["per_week"])
    if p["ex"] is None:
        return (_tabs("progress") + '<div class="card"><p class="empty">Nothing to show yet: tick exercises on the '
                '<a href="/web/gym">Workout</a> tab, and your progress shows here.</p></div>' + weeks)
    name, unit, title = p["ex"]["name"], p["unit"], p["title"]
    chips = "".join(f'<a class="chip{" on" if on else ""}" href="/web/gym/progress?x={k}"'
                    f'{" aria-current=\"page\"" if on else ""}>{esc(n)}</a>' for k, n, on in p["chips"])
    chart = (f'<div class="chart" id="c-gym" data-chart="{esc(json.dumps(p["chart"], separators=(",", ":")))}"></div>' if p["chart"] else
             '<p class="small">No sessions in the last 8 weeks.</p>')
    li = "".join(f'<tr><td>{d:%a %d.%m.}</td><td>{esc(", ".join(gym.row_text(r) for r in rs))}</td></tr>' for d, rs in p["recent"])
    return (_tabs("progress") + f'<p class="chips gpick" role="group" aria-label="Exercise">{chips}</p>'
            f'<div class="card"><h2><span>{esc(name)}: {title}</span><span class="small">8 weeks</span></h2>'
            f'<p class="gbig"><span class="num">{_plain(p["top"])} {unit}</span> <span class="small">{esc(p["change"])}</span></p>'
            f'<p class="small">{esc(p["sub"])}</p>{chart}</div>{weeks}'
            f'<div class="card"><h2><span>Recent sessions</span></h2><table class="ft plain"><tbody>{li}</tbody></table></div>')


def _best_row(kind: str, rows: list) -> dict:
    if kind == "weights":
        r = max(rows, key=lambda r: (float(r["kg"] or 0), r["reps"] or 0))
    elif kind == "bodyweight":
        r = max(rows, key=lambda r: r["reps"] or 0)
    else:
        r = max(rows, key=lambda r: float(r["minutes"] or 0))
    return {k: r[k] for k in VALS}


def history() -> list:
    """Workouts by date, newest first (the last 60): each with its day of the split (the name only, or "Free workout"), its start, its
    end (no Finish button: the last tick ends it), the times as app. writes them, and its exercises with their rows in order."""
    with connect() as conn, conn.cursor() as cur:
        cur.execute("""SELECT w.id, w.day, w.started_at, w.ended_at, d.id AS split_id, d.name AS split_name
                       FROM workouts w LEFT JOIN workout_days d ON d.id = w.split_day_id ORDER BY w.day DESC, w.id DESC LIMIT 60""")
        ws = cur.fetchall()
        cur.execute("""SELECT s.*, x.name, x.kind FROM workout_sets s JOIN exercises x ON x.id = s.exercise_id
                       WHERE s.workout_id = ANY(%s) ORDER BY s.sort_order, s.id""", ([w["id"] for w in ws],))
        sets: dict = {}
        for r in cur.fetchall():
            sets.setdefault(r["workout_id"], []).append(r)
    out = []
    for w in ws:
        split = w["split_name"] if w["split_id"] else "Free workout"  # the name only: a number followed today's days (until 04.11.2026)
        start = w["started_at"].astimezone(rules.BERLIN)
        ticks = [r["logged_at"] for r in sets.get(w["id"], [])]
        end = w["ended_at"] or (max(ticks) if ticks else None)  # no Finish button: the last tick ends it
        end = end and end.astimezone(rules.BERLIN)
        when = f"{start:%H:%M}–{end:%H:%M}" if end and f"{end:%H:%M}" != f"{start:%H:%M}" else f"{start:%H:%M}"
        by: dict = {}
        for r in sets.get(w["id"], []):
            by.setdefault(r["exercise_id"], []).append(r)
        out.append({"w": w, "split": split, "start": start, "end": end, "when": when, "exercises": list(by.values())})
    return out


def render_history(csrf: str, q=None) -> str:
    """Workouts by date, newest first, with their day of the split and what was done (the last 60)."""
    ws = history()
    if not ws:
        return _tabs("history") + '<div class="card"><p class="empty">No workouts yet.</p></div>'
    cards = []
    for h in ws:
        w = h["w"]
        lines = "".join(f'<tr><td>{esc(rs[0]["name"])}</td><td>{esc(", ".join(gym.row_text(r) for r in rs))}</td></tr>' for rs in h["exercises"])
        cards.append(f'<div class="card" id="w{w["id"]}"><h2><span>{w["day"]:%a %d.%m.%Y}</span><span class="small">{esc(h["split"])} · {h["when"]}</span></h2>'
                     f'<table class="ft plain"><tbody>{lines or "<tr><td class=empty>Nothing logged.</td></tr>"}</tbody></table></div>')
    return _tabs("history") + "".join(cards)

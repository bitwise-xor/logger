"""The web app's Settings page (decided 29.10.2026). Tabs: Food targets (the day's targets, new ones start on a date and the old ones
stay as history), Habits (label, daily count, order, active; add a habit), Today page (what shows on Today and in which order),
Body (03.11.2026: height from a date, how often body measurements are due, which measures show), Devices (the signed-in
devices), Notifications (31.10.2026: turn nudges on per device, pick them and their times), Export (05.11.2026: export.py).
The forms post to websettings.py; this module only reads. Each tab's reads are a data function (targets_data, body_data, today_data,
devices_data, notify_data; coachpage.settings_data, export.settings_data) that app.'s tab and the JSON door (reads.settings_*,
deploy 110) share."""
import re
from urllib.parse import urlencode

from . import body, coachpage, export, gratitude, nudges, rules, uiprefs, webpush
from .db import connect
from .todaypage import HEALTH_ROWS, _plain
from .webentry import esc, hidden

TABS = (("targets", "Food targets"), ("today", "Today page"), ("body", "Body"), ("coach", "Coach"), ("devices", "Devices"),
        ("notify", "Notifications"), ("export", "Export"))
BACK = re.compile(r"/web/settings(\?[A-Za-z0-9=&._%+-]*)?")
TARGET_FIELDS = (("kcal", "Calories", "kcal"), ("protein", "Protein", "g"), ("fat", "Fat", "g"), ("sat_fat", "Saturated fat", "g"),
                 ("carbs", "Carbs", "g"), ("fibre", "Fibre", "g"), ("sugar_added", "Added sugar", "g"), ("sodium_mg", "Sodium", "mg"),
                 ("water_ml", "Water", "ml"))  # water (05.11.2026, item 40): every drink counts, by its amount
# The tabs' words that the JSON door passes on too (reads.settings_*, deploy 110)
TARGETS_HINT = ("New targets count from the date; earlier days keep the targets they had. An empty field means no target for it. "
                "Water counts every drink by its amount.")
HEIGHT_HINT = "For waist ÷ height on the Health page. A new height counts from its date; earlier measurements keep the height they had."
MEASURES_HINT = "A hidden measure keeps its values; it is only left out of the form, the table and the chips."
TODAY_HINT = ("Food and drinks always show. A hidden item is only hidden on the Today page: it stays on the Habits page, in the Sheet "
              "and in your records. Order: the smaller number comes first. A hidden review box still shows one line while something waits for review.")


def url(**q) -> str:
    q = {k: v for k, v in q.items() if v not in (None, "", False)}
    return "/web/settings" + ("?" + urlencode(q) if q else "")


def safe_back(b) -> str:
    b = str(b or "")
    return b if BACK.fullmatch(b) else "/web/settings"


def device_name(ua: str) -> str:
    """"iPhone, Safari" from a browser's user-agent text (a rough reading; unknown parts are left out)."""
    ua = ua or ""
    system = next((n for k, n in (("iPhone", "iPhone"), ("iPad", "iPad"), ("Android", "Android"), ("Windows", "Windows"),
                                  ("Macintosh", "Mac"), ("Linux", "Linux")) if k in ua), "")
    browser = next((n for k, n in (("Edg/", "Edge"), ("OPR/", "Opera"), ("Firefox/", "Firefox"), ("CriOS", "Chrome"), ("FxiOS", "Firefox"),
                                   ("Chrome/", "Chrome"), ("Safari/", "Safari")) if k in ua), "")
    return ", ".join(x for x in (system, browser) if x) or "Unknown device"


def _tabs(on: str) -> str:
    links = "".join(f'<a href="{esc(url(tab=k))}"{' aria-current="page"' if k == on else ""}>{label}</a>' for k, label in TABS)
    return f'<div class="head"><h1>Settings</h1><nav class="seg" aria-label="Settings">{links}</nav></div>'


# ---- food targets ----------------------------------------------------------------------------------

def targets_data() -> dict:
    """{"today": the logging day (the form's "Valid from"), "rows": every food_targets row, newest first, "current": the row in force
    (the newest from today or before; when all start later, the newest; None without targets)}."""
    with connect() as c:
        today = c.execute("SELECT log_day(now()) AS d").fetchone()["d"]
        rows = c.execute("SELECT * FROM food_targets ORDER BY valid_from DESC").fetchall()
    return {"today": today, "rows": rows, "current": next((r for r in rows if r["valid_from"] <= today), rows[0] if rows else None)}


def _targets(session, csrf: str) -> str:
    d = targets_data()
    today, rows, cur = d["today"], d["rows"], d["current"]
    fields = "".join(f'<label><span>{lbl} <span class="small">{unit}</span></span><input type="number" name="{k}" min="0" step="any" inputmode="decimal" '
                     f'value="{_plain(cur[k]) if cur else ""}" placeholder="none"></label>' for k, lbl, unit in TARGET_FIELDS)
    hist = "".join(f'<tr><td>{r["valid_from"]:%d.%m.%Y}</td>' + "".join(f'<td>{_plain(r[k]) or "–"}</td>' for k, _l, _u in TARGET_FIELDS[:5])
                   + f'<td>{_plain(r["water_ml"]) or "–"}</td><td class="l">{esc(r["note"] or "")}</td></tr>' for r in rows)
    since = f"valid from {cur['valid_from']:%d.%m.%Y}" if cur else "none set yet"
    return (f'<div class="card"><h2>Daily food targets <span class="small">now {since}</span></h2>'
            f'<form method="post" action="/web/settings/targets">{hidden("csrf", csrf)}<div class="fields">'
            f'<label>Valid from<input type="date" name="valid_from" value="{today.isoformat()}" required></label>{fields}</div>'
            '<div class="fields wide"><label>Note (optional)<input name="note" maxlength="200" placeholder="why it changed"></label></div>'
            '<p class="row"><button class="primary" type="submit">Save targets</button>'
            f'<span class="small">{TARGETS_HINT}</span></p></form></div>'
            f'<div class="card"><h2>History</h2><div class="tablewrap"><table class="ft hist"><thead><tr><th>From</th><th>kcal</th><th>Protein</th><th>Fat</th><th>Sat fat</th>'
            f'<th>Carbs</th><th>Water ml</th><th class="l">Note</th></tr></thead><tbody>{hist or "<tr><td colspan=8 class=empty>No targets yet.</td></tr>"}</tbody></table></div></div>')


# ---- body measurements (03.11.2026) ------------------------------------------------------------------

def body_data() -> dict:
    """{"today", "rows": the heights, newest first, "now": the height in force today (None: not set yet), "prefs": body.settings}."""
    with connect() as c, c.cursor() as cur:
        today = cur.execute("SELECT log_day(now()) AS d").fetchone()["d"]
        rows = body.heights(cur)
        prefs = body.settings(cur)
    return {"today": today, "rows": rows, "now": next((r for r in rows if r["valid_from"] <= today), None), "prefs": prefs}


def _body(session, csrf: str) -> str:
    """Height (dated: a session uses the height valid on its day), how often measurements are due, which measures show."""
    d = body_data()
    today, rows, prefs, now = d["today"], d["rows"], d["prefs"], d["now"]
    lo, hi = body.HEIGHT_RANGE
    hist = "".join(f'<tr><td>{r["valid_from"]:%d.%m.%Y}</td><td>{_plain(r["height_cm"])} cm</td></tr>' for r in rows)
    boxes = "".join(f'<label class="row"><input type="checkbox" name="show" value="{k}"{"" if k in prefs["hidden"] else " checked"}> {lbl}</label>'
                    for k, lbl, _h in body.TAPE)
    ilo, ihi = body.INTERVAL_RANGE
    return (f'<div class="card"><h2>Height <span class="small">{f"{_plain(now["height_cm"])} cm" if now else "not set yet"}</span></h2>'
            f'<form method="post" action="/web/settings/height">{hidden("csrf", csrf)}{hidden("back", url(tab="body"))}<div class="fields">'
            f'<label>Valid from<input type="date" name="valid_from" value="{today.isoformat()}" required></label>'
            f'<label><span>Height <span class="small">cm</span></span><input type="number" name="height" min="{lo}" max="{hi}" step="any" inputmode="decimal" required></label></div>'
            '<p class="row"><button class="primary" type="submit">Save height</button>'
            f'<span class="small">{HEIGHT_HINT}</span></p></form>'
            + (f'<div class="tablewrap"><table class="ft hist"><thead><tr><th>From</th><th>Height</th></tr></thead><tbody>{hist}</tbody></table></div>' if rows else "")
            + '</div>'
            f'<div class="card"><h2>Body measurements</h2><form method="post" action="/web/settings/body">{hidden("csrf", csrf)}{hidden("back", url(tab="body"))}'
            f'<div class="fields"><label><span>Due every <span class="small">days, {ilo} to {ihi}</span></span>'
            f'<input type="number" name="interval" min="{ilo}" max="{ihi}" step="1" inputmode="numeric" value="{prefs["interval"]}" required></label></div>'
            f'<p class="small">Measures in the form and on the Health page:</p><div class="row bchecks">{boxes}</div>'
            '<p class="row"><button class="primary" type="submit">Save</button>'
            f'<span class="small">{MEASURES_HINT}</span></p></form></div>')


# ---- habits ----------------------------------------------------------------------------------------

def _habits(session, csrf: str) -> str:
    with connect() as c:
        rows = c.execute("""SELECT name, label, daily_target, sort_order, active FROM log_types WHERE on_checklist AND kind = 'event'
                            ORDER BY active DESC, sort_order, name""").fetchall()
    out = []
    for r in rows:
        out.append(f'<form class="habrow" method="post" action="/web/settings/habit">{hidden("csrf", csrf)}{hidden("back", url(tab="habits"))}{hidden("name", r["name"])}'
                   f'<label class="grow">Name shown<input name="label" value="{esc(r["label"])}" maxlength="40" required></label>'
                   f'<label>Times a day<input type="number" name="daily_target" min="1" max="10" value="{r["daily_target"]}"></label>'
                   f'<label>Order<input type="number" name="sort_order" min="0" max="999" value="{r["sort_order"]}"></label>'
                   f'<label class="row small"><input type="checkbox" name="active" value="1"{" checked" if r["active"] else ""}> Active</label>'
                   f'<button class="primary sm" type="submit">Save</button><span class="small">{esc(r["name"])}</span></form>')
    return (f'<div class="card"><h2>Habits <span class="small">{sum(1 for r in rows if r["active"])} active</span></h2>{"".join(out)}'
            '<p class="small hint">Order: the smaller number comes first. Taking Active off retires a habit (its history stays; it leaves Today, '
            'the Habits page and the Sheet). Which habits show on the Today page is set under Today page.</p></div>'
            f'<div class="card"><h2>Add a habit</h2><form class="row" method="post" action="/web/settings/habit_new">{hidden("csrf", csrf)}{hidden("back", url(tab="habits"))}'
            '<input name="label" maxlength="40" required class="grow" placeholder="Name, e.g. Yoga" aria-label="Name of the new habit">'
            '<label class="small">Times a day <input type="number" name="daily_target" min="1" max="10" value="1"></label>'
            '<button class="primary" type="submit">Add</button></form>'
            '<p class="small hint">Then you can log it in the chat or the entry box by its name ("did yoga") or tick it on Today.</p></div>')


# ---- the Today page --------------------------------------------------------------------------------

def today_items(cur) -> list[tuple[str, str, list[tuple[str, str]]]]:
    """(kind, heading, [(id, label)]) in the order the Today page shows them by default."""
    cur.execute("SELECT name, label FROM log_types WHERE on_checklist AND active AND kind = 'event' ORDER BY sort_order, name")
    habits = [(r["name"], r["label"]) for r in cur.fetchall()]
    health = [(k, f"{label}{' ' + sub if sub else ''}") for k, label, sub, _t, _p, _u in HEALTH_ROWS]
    cur.execute("SELECT id, name FROM usual_meals ORDER BY lower(name)")
    usual = [(str(r["id"]), r["name"]) for r in cur.fetchall()]
    return [("habit", "Habits", habits), ("health", "Health card rows", health), ("usual", "Usual meal buttons", usual),
            ("review", "Box", [("box", "To review")]), ("card", "Cards", [("gratitude", "Gratitude"), ("home", "Home"), ("coach", "Coach")])]


def today_data() -> dict:
    """{"groups": [(kind, heading, [(id, label)] in the chosen order)], "prefs": uiprefs.load, "goal": the gratitude goal}."""
    with connect() as c, c.cursor() as cur:
        groups, prefs, goal = today_items(cur), uiprefs.load(cur), gratitude.goal(cur)
    return {"groups": [(kind, heading, uiprefs.ordered(items, lambda i: i[0], prefs["order"].get(kind, []))) for kind, heading, items in groups],
            "prefs": prefs, "goal": goal}


def _today_tab(session, csrf: str) -> str:
    d = today_data()
    groups, prefs, goal = d["groups"], d["prefs"], d["goal"]
    out, (lo, hi) = [], gratitude.GOAL_RANGE
    for kind, heading, items in groups:
        rows = "".join(f'<tr><td><label class="row"><input type="checkbox" name="show_{kind}_{i}" value="1"'
                       f'{"" if f"{kind}:{i}" in prefs["hidden"] else " checked"}> {esc(lbl)}</label></td>'
                       + (f'<td><input type="number" name="pos_{kind}_{i}" min="1" max="99" value="{n}" aria-label="Order of {esc(lbl)}"></td>' if len(items) > 1 else "<td></td>")
                       + "</tr>" for n, (i, lbl) in enumerate(items, 1))
        out.append(f'<h3>{heading}</h3><div class="tablewrap"><table class="ft plain tset"><tbody>{rows or "<tr><td class=empty>None yet.</td></tr>"}</tbody></table></div>')
    return (f'<div class="card"><h2>What shows on the Today page</h2><form method="post" action="/web/settings/today">{hidden("csrf", csrf)}{hidden("back", url(tab="today"))}'
            f'{"".join(out)}<p class="row"><button class="primary" type="submit">Save</button></p></form>'
            f'<form class="row" method="post" action="/web/settings/today_reset">{hidden("csrf", csrf)}{hidden("back", url(tab="today"))}'
            '<button class="ghost" type="submit">Show everything in the default order</button></form>'
            f'<p class="small hint">{TODAY_HINT}</p></div>'
            f'<div class="card"><h2>Gratitude</h2><form method="post" action="/web/settings/gratitude">{hidden("csrf", csrf)}{hidden("back", url(tab="today"))}'
            f'<div class="fields"><label><span>Gratitude lines a day <span class="small">{lo} to {hi}</span></span>'
            f'<input type="number" name="goal" min="{lo}" max="{hi}" step="1" inputmode="numeric" value="{goal}" required></label></div>'
            '<p class="row"><button class="primary" type="submit">Save</button>'
            '<span class="small">The goal of the Gratitude card and page. More lines are always welcome.</span></p></form></div>')


# ---- devices ---------------------------------------------------------------------------------------

def devices_data() -> list:
    """Every signed-in device: the web_sessions rows not expired, last used first (app.'s, and logger.'s with front 'logger')."""
    with connect() as c:
        return c.execute("""SELECT sid, token_hash, user_agent, created_at, last_seen, expires_at, front FROM web_sessions
                            WHERE expires_at > now() ORDER BY last_seen DESC""").fetchall()


def _devices(session, csrf: str) -> str:
    rows = devices_data()
    out = []
    for r in rows:
        here = r["token_hash"] == session["token_hash"]
        seen = r["last_seen"].astimezone(rules.BERLIN).strftime("%d.%m.%Y %H:%M")
        made = r["created_at"].astimezone(rules.BERLIN).strftime("%d.%m.%Y")
        until = r["expires_at"].astimezone(rules.BERLIN).strftime("%d.%m.%Y")
        btn = ('<span class="pill ok">this device</span>' if here else
               f'<form method="post" action="/web/settings/device">{hidden("csrf", csrf)}{hidden("back", url(tab="devices"))}{hidden("sid", str(r["sid"]))}'
               '<button class="ghost sm bad" type="submit">Sign out</button></form>')
        name = device_name(r["user_agent"]) + (" · new front end" if r["front"] else "")  # signed in through the JSON door (api.py)
        out.append(f'<div class="dev"><div><b>{esc(name)}</b>'
                   f'<span class="small">signed in {made} · last used {seen} · stays signed in until {until}</span></div>{btn}</div>')
    others = sum(1 for r in rows if r["token_hash"] != session["token_hash"])
    allout = (f'<form class="row" method="post" action="/web/settings/others">{hidden("csrf", csrf)}{hidden("back", url(tab="devices"))}'
              f'<button class="ghost bad" type="submit">Sign out all {others} other device{"" if others == 1 else "s"}</button></form>'
              if others else "")
    return (f'<div class="card"><h2>Signed-in devices <span class="small">{len(rows)}</span></h2>{"".join(out)}{allout}'
            '<p class="small hint">A device in use stays signed in (30 days from its last use). If a phone is lost, sign it out here. '
            'Sign out in the menu ends this device only.</p></div>'
            '<div class="card"><h2>Watch</h2><p class="small">Steps, heart rate, sleep and workouts from the watch show under Gym › Activity '
            'once they arrive. <a href="/web/gym/activity">How to set it up ›</a></p></div>')


# ---- notifications ---------------------------------------------------------------------------------

# The nudge form's rows after "Send nudges": (switch, its hours field, lowest, highest, the words before the hours, after them); the
# ranges websettings.nudge_settings clamps to, in half hours
NUDGE_ROWS = (("weight", "weight_after", 0.5, 12, "No weight yet,", "hours after waking"),
              ("habits", "habits_after", 1, 20, "Habits still open,", "hours after waking"),
              ("idle", "idle_hours", 1, 12, "Nothing logged for", "hours"),
              ("checkin", "checkin_after", 2, 15.5, "Mood and energy not in yet,", "hours after waking"),
              ("bp_evening", "bp_evening_after", 2, 15.5, "No evening blood pressure yet,", "hours after waking"),
              ("gratitude", "gratitude_after", 2, 15.5, "Gratitude list: remind me when the day's lines are not full,", "hours after waking"))
NUDGE_STEP = 0.5
# The switches without an hours field, after those: (switch, its words, a note under it)
NUDGE_SWITCH_ROWS = (("home_timer", "When the Home timer ends", "At the moment it ends, at any hour; each timer once."),)


def notify_data() -> dict:
    """{"settings": nudges.load, "subs": the devices with notifications on, oldest first, each with its origin ('app' or 'logger',
    migration 032; app.'s tab lists them all alike). origin is read through to_jsonb, so this read also works on a database before
    032, where every row is app.'s."""
    with connect() as c, c.cursor() as cur:
        s = nudges.load(cur)
        subs = cur.execute("""SELECT id, user_agent, created_at, last_ok, session_sid, coalesce(to_jsonb(p) ->> 'origin', 'app') AS origin
                              FROM push_subscriptions p ORDER BY created_at""").fetchall()
    return {"settings": s, "subs": subs}


def _notify(session, csrf: str) -> str:
    d = notify_data()
    s, subs = d["settings"], d["subs"]
    key = webpush.public_key()
    base = hidden("csrf", csrf) + hidden("back", url(tab="notify"))
    mine = any(r["session_sid"] == session["sid"] for r in subs)  # this device is on (04.11.2026: the page could not tell)
    turn_on = (f'<div class="pushbox" data-push data-key="{esc(key)}" data-csrf="{esc(csrf)}">'
               + ('<p><span class="pill ok">On for this device</span></p>' if mine else "")
               + f'<button class="{"ghost" if mine else "primary"}" type="button" data-push-on>'
               + ("Turn on again (if notifications stopped)" if mine else "Turn on notifications on this device") + '</button>'
               '<p class="small" data-push-msg aria-live="polite"></p></div>' if key else
               '<p class="small">Notifications are not set up on the server yet (no key).</p>')
    devices = "".join(
        f'<div class="dev"><div><b>{esc(device_name(r["user_agent"]))}</b>{" <span class=\"pill ok\">this device</span>" if r["session_sid"] == session["sid"] else ""}'
        f'<span class="small">on since {r["created_at"].astimezone(rules.BERLIN):%d.%m.%Y}'
        + (f' · last delivered {r["last_ok"].astimezone(rules.BERLIN):%d.%m. %H:%M}' if r["last_ok"] else " · nothing delivered yet") + '</span></div>'
        f'<form method="post" action="/web/settings/push_off">{base}{hidden("id", str(r["id"]))}'
        '<button class="ghost sm bad" type="submit">Turn off</button></form></div>' for r in subs)
    test = (f'<form class="row" method="post" action="/web/settings/nudge_test">{base}'
            '<button class="ghost" type="submit">Send a test notification</button></form>' if subs else "")
    box = lambda k: " checked" if s[k] else ""  # noqa: E731
    num = lambda k, lo, hi: (f'<input type="number" name="{k}" id="n-{k}" min="{lo}" max="{hi}" step="0.5" inputmode="decimal" '  # noqa: E731
                             f'value="{_plain(s[k])}" aria-label="Hours">')
    form = (f'<form method="post" action="/web/settings/nudges">{base}'
            f'<label class="row nrow"><input type="checkbox" name="on" value="1"{box("on")}> <b>Send nudges</b></label>'
            + "".join(f'<label class="row nrow"><input type="checkbox" name="{k}" value="1"{box(k)}> {before} {num(hk, lo, hi)} {after}</label>'
                      for k, hk, lo, hi, before, after in NUDGE_ROWS)
            + "".join(f'<label class="row nrow"><input type="checkbox" name="{k}" value="1"{box(k)}> {words}</label>' for k, words, _n in NUDGE_SWITCH_ROWS)
            + '<p class="row"><button class="primary" type="submit">Save</button></p></form>')
    return (f'<div class="grid2"><div class="card"><h2>This device</h2>{turn_on}'
            '<p class="small hint">On an iPhone (iOS 16.4 or later): add Logger to the home screen first (Share, then Add to Home Screen), '
            'open it from there, then turn notifications on here. A tap on a notification opens the app (at home or with Tailscale on).</p>'
            f'<h3>Devices with notifications · {len(subs)}</h3>{devices or "<p class=empty>None yet.</p>"}{test}</div>'
            f'<div class="card"><h2>Nudges</h2>{form}'
            '<p class="small hint">Times count from the time you woke up (the Woke up value). Quiet hours: nothing before you log waking up, '
            f'nothing after a bed time is logged, nothing later than {nudges.AWAKE_HOURS} hours after waking. Each nudge comes at most once a day; '
            'the check runs every 5 minutes. The Home timer\'s comes at the moment it ends, at any hour, once for each timer.</p></div></div>')


def render(session, q) -> str:
    if q.get("tab") == "habits":  # an old link: habits are managed on the Habits page since 04.11.2026
        return _tabs("") + ('<div class="card"><h2>Habits</h2><p>Habits are now managed in one place: the Habits page (name, times a day, '
                            'order, do or avoid, track, retire).</p><p class="row"><a class="primary" href="/web/habits">Open the Habits page</a></p></div>')
    tab = q.get("tab") if q.get("tab") in dict(TABS) else TABS[0][0]
    csrf = session["csrf"]
    return _tabs(tab) + {"targets": _targets, "habits": _habits, "today": _today_tab, "body": _body, "coach": coachpage.settings_tab, "devices": _devices,
                         "notify": _notify, "export": export.settings_tab}[tab](session, csrf)

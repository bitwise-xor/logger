"""The Gym section's Activity tab (02.11.2026, step d; plan and the owner's answers in the doc, section "Step (d), Activity"): one
calendar day of watch data (Europe/Berlin) from watch.py's tables: steps, sleep, active energy, exercise minutes, resting heart
rate, heart rate variability, distance and floors; the night's sleep stages next to the bed and wake times typed in the Logger;
the workouts the watch recorded, matched to a Logger workout of that day; the last 7 days of steps, sleep and resting heart rate.
Before any data has come, it shows how to set up the iPhone app. Totals come from one source only (the one with the most, so
iPhone and watch steps are not added up); the averages use every source."""
import json
from datetime import date, datetime, time, timedelta

from . import gym, rules, watch
from .db import connect
from .gympage import _tabs
from .webentry import esc

SUMS = {"step_count": ("Steps", "", 0), "active_energy": ("Active energy", "kcal", 0), "apple_exercise_time": ("Exercise", "min", 0),
        "walking_running_distance": ("Distance", "km", 1), "flights_climbed": ("Floors climbed", "", 0)}
AVGS = {"resting_heart_rate": ("Resting heart rate", "bpm", 0), "heart_rate_variability": ("Heart rate variability", "ms", 0)}
STAGES = (("deep", "Deep"), ("core", "Core"), ("rem", "REM"), ("awake", "Awake"))


def _start(d: date) -> datetime:
    return datetime.combine(d, time(0), rules.BERLIN)


def _num(v, dec: int = 0) -> str:
    return "–" if v is None else f"{v:,.{dec}f}".replace(",", " ")


def _hm(hours) -> str:
    if hours is None:
        return "–"
    m = round(hours * 60)
    return f"{m // 60} h {m % 60:02d} min"


def _days(cur, first: date, last: date) -> dict:
    """Per calendar day: the sums (one source each, the largest) and the averages."""
    cur.execute("""SELECT (at AT TIME ZONE 'Europe/Berlin')::date AS d, metric, source, sum(value) AS s, avg(value) AS a
                   FROM watch_metrics WHERE at >= %s AND at < %s AND metric = ANY(%s) AND value IS NOT NULL GROUP BY 1, 2, 3""",
                (_start(first), _start(last + timedelta(days=1)), list(SUMS) + list(AVGS)))
    out: dict = {}
    for r in cur.fetchall():
        day = out.setdefault(r["d"], {})
        if r["metric"] in SUMS:
            day[r["metric"]] = max(day.get(r["metric"], 0), float(r["s"]))
        else:
            day.setdefault(r["metric"], []).append(float(r["a"]))
    for day in out.values():
        for k in AVGS:
            if k in day:
                day[k] = sum(day[k]) / len(day[k])
    return out


def _night(cur, d: date) -> dict | None:
    """The night that ends on day d (noon before to noon of d): the app's summary if it sent one, else its segments added up."""
    lo, hi = datetime.combine(d - timedelta(days=1), time(12), rules.BERLIN), datetime.combine(d, time(12), rules.BERLIN)
    cur.execute("""SELECT at, value, extra FROM watch_metrics WHERE metric = 'sleep_analysis' AND at >= %s AND at < %s
                   ORDER BY at""", (lo, hi))
    rows = cur.fetchall()
    nights = [r for r in rows if r["extra"].get("kind") == "night"]
    if nights:
        n = max(nights, key=lambda r: float(r["value"] or 0))["extra"]
        st = {k: watch._f(n.get(k)) for k, _ in STAGES}
        asleep = watch._f(n.get("totalSleep"))
        if asleep is None:
            asleep = sum(watch._f(n.get(k)) or 0 for k in ("asleep", "core", "deep", "rem"))
        times = [n.get(k) for k in ("inBedStart", "inBedEnd", "sleepStart", "sleepEnd")]
        start, end = times[0] or times[2], times[1] or times[3]
        return {"asleep": asleep, "stages": st, "start": start and watch.when(start), "end": end and watch.when(end)}
    segs = [r for r in rows if r["extra"].get("kind") == "segment"]
    if not segs:
        return None
    st = {k: 0.0 for k, _ in STAGES}
    plain = 0.0
    for r in segs:
        stage = r["extra"].get("stage", "").lower().replace(" ", "")
        h = float(r["value"] or 0)
        if stage in st:
            st[stage] += h
        elif stage in ("asleep", "unspecified"):
            plain += h
    ends = [watch.when(r["extra"]["end"]) for r in segs if r["extra"].get("end")]
    return {"asleep": st["deep"] + st["core"] + st["rem"] + plain, "stages": st, "start": segs[0]["at"], "end": max(ends) if ends else None}


def chart_data(first: date, label: str, series: list, **opts) -> dict:
    """A 7-day chart as app.js's drawChart takes it (the data-chart attribute)."""
    return {"start": first.isoformat(), "days": 7, "label": label, "series": series, **opts}


def _chart(cid: str, data: dict) -> str:
    return f'<div class="chart" id="{cid}" data-chart="{esc(json.dumps(data, separators=(",", ":")))}"></div>'


def setup() -> dict:
    """The set-up guide shown before any watch data has come, as data: each step in parts ({text, code}: code is drawn as code)."""
    ready = "is set on the server" if watch.token() else "is not set on the server yet: add a line WATCH_TOKEN=… (24 or more letters and digits) to /opt/stacks/logger-v2/.env and restart the core"
    t = lambda x: {"text": x, "code": False}  # noqa: E731
    c = lambda x: {"text": x, "code": True}  # noqa: E731
    return {"title": "No watch data yet", "token_set": bool(watch.token()),
            "intro": "The watch data comes from the iPhone app Health Auto Export (Premium). Set up two automations of the kind REST API:",
            "steps": [[t("Address "), c(f"https://log.19hospitalroad.fyi{watch.PATH}"), t(", format JSON, export version 2.")],
                      [t("A header "), c("Authorization"), t(" with the value "), c("Bearer"), t(f", a space and your token. The token {ready}.")],
                      [t("First automation: Health Metrics with Step Count, Active Energy, Apple Exercise Time, Resting Heart Rate, Heart Rate "
                         "Variability, Walking + Running Distance, Flights Climbed, Sleep Analysis and Heart Rate; Summarize Data on, by hour.")],
                      [t("Second automation: Workouts (no route data needed).")],
                      [t("Sync every 30 minutes; Background App Refresh on. The phone sends only while it is unlocked now and then.")]],
            "note": "Each run sends yesterday and today again; the logger keeps every reading once. Nothing goes to the Google Sheet."}


def _setup() -> str:
    g = setup()
    steps = "".join("<li>" + "".join(f"<code>{esc(x['text'])}</code>" if x["code"] else esc(x["text"]) for x in st) + "</li>" for st in g["steps"])
    return (f'<div class="card"><h2><span>{g["title"]}</span></h2><p>{g["intro"]}</p><ol class="steps">{steps}</ol>'
            f'<p class="small">{g["note"]}</p></div>')


CHARTS = (("steps", "c-steps", "Steps"), ("sleep", "c-wsleep", "Sleep"), ("rhr", "c-rhr", "Resting heart rate"))


def load(asked=None) -> dict | None:
    """One calendar day of watch data as data (deploy 95, shared with the JSON door): the day (a later one is today), the tiles, the
    night before, the watch's workouts with the Logger's workout they match, the three 7-day charts. None before any data came."""
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT EXISTS (SELECT 1 FROM watch_metrics) OR EXISTS (SELECT 1 FROM watch_workouts) AS any")
        if not cur.fetchone()["any"]:
            return None
        today = datetime.now(rules.BERLIN).date()
        day = min(asked, today) if asked else today
        first = day - timedelta(days=6)
        days = _days(cur, first, day)
        night = _night(cur, day)
        nights = {first + timedelta(days=i): _night(cur, first + timedelta(days=i)) for i in range(7)}
        cur.execute("SELECT bed_at, wake_at, hours FROM v_sleep WHERE wake_day = %s ORDER BY wake_at DESC LIMIT 1", (day,))
        typed = cur.fetchone()
        cur.execute("SELECT * FROM watch_workouts WHERE start_at >= %s AND start_at < %s ORDER BY start_at", (_start(day), _start(day + timedelta(days=1))))
        works = cur.fetchall()
        cur.execute("""SELECT w.started_at, d.id AS split_id, d.name FROM workouts w LEFT JOIN workout_days d ON d.id = w.split_day_id
                       WHERE w.day = %s ORDER BY w.id LIMIT 1""", (day,))
        logged = cur.fetchone()
        ds = gym.days(cur)
    v = days.get(day, {})
    week = [days.get(first + timedelta(days=i), {}) for i in range(7)]
    avg7 = lambda k: (lambda xs: sum(xs) / len(xs) if xs else None)([w[k] for w in week if k in w])  # noqa: E731
    tiles = []
    for k, (label, unit, dec) in {**SUMS, **AVGS}.items():
        a = avg7(k) if k in ("step_count", "resting_heart_rate") else None
        tiles.append({"key": k, "label": label, "value": v.get(k), "unit": unit or None, "text": f'{_num(v.get(k), dec)}{" " + unit if unit and k in v else ""}',
                      "avg7": a, "sub": f"7-day avg {_num(a, dec)}" if a is not None else ""})
    tiles.insert(1, {"key": "sleep", "label": "Sleep", "value": night and night["asleep"], "unit": "h", "text": _hm(night and night["asleep"]),
                     "avg7": None, "sub": "night before"})
    label = "Today" if day == today else "Yesterday" if day == today - timedelta(days=1) else f"{day:%a %d.%m.}"
    sleep = None
    if night:
        inbed = (f'in bed {night["start"].astimezone(rules.BERLIN):%H:%M}–{night["end"].astimezone(rules.BERLIN):%H:%M}'
                 if night.get("start") and night.get("end") else "")
        stages = [{"key": k, "label": t, "hours": night["stages"].get(k), "text": f'{t} {_hm(night["stages"].get(k))}'} for k, t in STAGES if night["stages"].get(k)]
        mine = (f'Typed in the Logger: bed {typed["bed_at"].astimezone(rules.BERLIN):%H:%M}, woke {typed["wake_at"].astimezone(rules.BERLIN):%H:%M}'
                f' ({_hm(float(typed["hours"]))})' if typed else "Nothing typed in the Logger for this night.")
        sleep = {"asleep": night["asleep"], "asleep_text": _hm(night["asleep"]), "start": night.get("start"), "end": night.get("end"), "in_bed": inbed,
                 "stages": stages, "stages_text": " · ".join(x["text"] for x in stages) or "No stages sent.",
                 "typed": typed, "typed_text": mine}
    wl = []
    for w in works:
        meta = " · ".join(x for x in (f'{round((w["end_at"] - w["start_at"]).total_seconds() / 60)} min',
                                      f'{_num(float(w["kcal"]))} kcal' if w["kcal"] is not None else "",
                                      f'avg {_num(float(w["hr_avg"]))} bpm' if w["hr_avg"] is not None else "",
                                      f'{_num(float(w["km"]), 1)} km' if w["km"] else "") if x)
        match = None
        if logged and abs((logged["started_at"] - w["start_at"]).total_seconds()) < 3 * 3600:
            match = gym.label(ds, {"id": logged["split_id"], "name": logged["name"]}) if logged["split_id"] else "Free workout"
        wl.append({"w": w, "minutes": round((w["end_at"] - w["start_at"]).total_seconds() / 60), "meta": meta, "matches": match})
    steps = [[i, round(w["step_count"]), f'{first + timedelta(days=i):%a %d.%m.}: {_num(w["step_count"])} steps']
             for i, w in enumerate(week) if "step_count" in w]
    slp = [[i, round(n["asleep"], 2), f'{d:%a %d.%m.}: {_hm(n["asleep"])}'] for i, (d, n) in enumerate(nights.items()) if n]
    rhr = [[i, round(w["resting_heart_rate"], 1), f'{first + timedelta(days=i):%a %d.%m.}: {_num(w["resting_heart_rate"])} bpm']
           for i, w in enumerate(week) if "resting_heart_rate" in w]
    charts = {"steps": chart_data(first, "Steps per day", [{"mark": "bar", "cls": "a", "pts": steps}], min=0),
              "sleep": chart_data(first, "Sleep in hours", [{"mark": "bar", "cls": "a", "pts": slp}], min=0, unit=" h", lines=[[7, "w", "7 h"]]),
              "rhr": chart_data(first, "Resting heart rate in bpm", [{"mark": "line", "cls": "a", "pts": rhr}, {"mark": "dot", "cls": "a", "pts": rhr}])}
    return {"today": today, "day": day, "first": first, "label": label, "tiles": tiles, "sleep": sleep, "workouts": wl, "charts": charts}


def render(csrf: str, q=None) -> str:
    try:
        asked = date.fromisoformat(str((q or {}).get("day", "")))
    except ValueError:
        asked = None
    a = load(asked)
    if a is None:
        return _tabs("activity") + _setup()
    day, today = a["day"], a["today"]
    tiles = "".join(f'<div class="wtile"><span class="small">{t["label"]}</span><span class="wv">{t["text"]}</span><span class="small">{t["sub"]}</span></div>'
                    for t in a["tiles"])
    nav = (f'<div class="wday"><a class="iconbtn" href="/web/gym/activity?day={day - timedelta(days=1)}" aria-label="Day before">‹</a>'
           f'<h2>{a["label"]} <span class="small">{day:%d.%m.%Y}</span></h2>'
           + (f'<a class="iconbtn" href="/web/gym/activity?day={day + timedelta(days=1)}" aria-label="Day after">›</a>' if day < today
              else '<span class="iconbtn off" aria-hidden="true">›</span>') + "</div>")
    s = a["sleep"]
    if s:
        sleep = (f'<div class="card"><h2><span>Sleep, night before</span><span class="small">{s["in_bed"]}</span></h2>'
                 f'<p class="gbig"><span class="num">{s["asleep_text"]}</span> <span class="small">asleep</span></p>'
                 f'<p class="small">{s["stages_text"]}</p><p class="small">{esc(s["typed_text"])}</p></div>')
    else:
        sleep = '<div class="card"><h2><span>Sleep, night before</span></h2><p class="empty">No sleep from the watch for this night.</p></div>'
    wl = []
    for x in a["workouts"]:
        w = x["w"]
        match = f'<span class="small wmatch">Matches {esc(x["matches"])} in the Logger</span>' if x["matches"] else ""
        wl.append(f'<div class="hm"><span class="hm-main">{esc(w["name"])}<span class="small">{esc(x["meta"])}</span>{match}</span>'
                  f'<span class="small">{w["start_at"].astimezone(rules.BERLIN):%H:%M}–{w["end_at"].astimezone(rules.BERLIN):%H:%M}</span></div>')
    workouts = (f'<div class="card"><h2><span>Workouts the watch recorded</span></h2>'
                f'{"".join(wl) or "<p class=empty>None on this day.</p>"}</div>')
    charts = ('<div class="grid2">' + "".join(f'<div class="card"><h2>{title}</h2>{_chart(cid, a["charts"][k])}</div>' for k, cid, title in CHARTS)
              + "</div>")
    return _tabs("activity") + f'{nav}<div class="wtiles">{tiles}</div>{sleep}{workouts}{charts}'

"""The Body measurements card on the Health page and the "Body measurements due" line in Today's To review card (03.11.2026,
body measurements T1; spec docs/specs/body-measurements-spec.md sections 6 and 7, mockups in docs/specs/mockups/body-measurements/).
The card: when it was last measured and when it is due, a Measure form (opened by ?measure=1, a session to change by
&mday=), the table Now / Last / Start, one chip per measure with its chart (?bx=), waist ÷ height and the weight rate.
Everything works without the script; the chart is drawn by app.js like the other Health charts. The form posts to
webactions.body_save; this module only reads."""
import json
from datetime import date, timedelta
from typing import Optional
from urllib.parse import urlencode

from . import body
from .db import connect
from .webentry import esc, hidden, key


def _url(r: int, **q) -> str:
    q = {k: v for k, v in q.items() if v not in (None, "", False)}
    return "/web/health?" + urlencode({"r": r, **q}) + "#body"


def _due_text(last: date, today: date, interval: int) -> str:
    left = interval - (today - last).days
    if left <= 0:
        return "due now"
    if left < 7:
        return f"next due in {left} day{'' if left == 1 else 's'}"
    weeks = round(left / 7)
    return f"next due in about {weeks} week{'' if weeks == 1 else 's'}"


def _form(csrf: str, r: int, day: date, today: date, shown: list, now: dict, before: dict) -> str:
    """One row per shown measure: the session's value (to change), the last value before it as the placeholder."""
    rows = "".join(
        f'<label class="brow"><span class="bl"><b>{lbl}</b><span class="small">{hint}</span></span>'
        f'<span class="bin"><input type="number" name="{k}" step="any" min="0" inputmode="decimal" value="{body.cm(now[k]["v"]) if k in now else ""}"'
        f' placeholder="{body.cm(before[k]) if k in before else ""}" aria-label="{lbl} in cm"> cm</span></label>'
        for k, lbl, hint in shown)
    which = "" if day == today else f'<p class="small"><b>Changing the session of {day:%d.%m.%Y}.</b> Clearing a value deletes it (asked once).</p>'
    return (f'<form class="fbox bform" method="post" action="/web/body">{hidden("csrf", csrf)}{hidden("day", day.isoformat())}'
            f'{hidden("r", str(r))}{hidden("key", key())}<p class="small">{body.PROTOCOL}</p>{which}{rows}'
            f'<p class="row"><button class="primary" type="submit">Save</button><a class="ghost" href="{esc(_url(r))}">Cancel</a></p></form>')


def table(sessions: list, shown: list) -> list[dict]:
    """The table Now / Last / Start as data (deploy 91, app.'s card and the JSON door): per shown measure with a value, its newest
    value (day, cm, ref), the change since the time before and since the first session (None with one value only)."""
    rows = []
    for k, lbl, _h in shown:
        vals = [(s["day"], s["vals"][k]) for s in sessions if k in s["vals"]]
        if not vals:
            continue
        now_d, now = vals[-1]
        rows.append({"key": k, "label": lbl, "day": now_d, "cm": now["v"], "ref": now["id"],
                     "last": now["v"] - vals[-2][1]["v"] if len(vals) > 1 else None,
                     "start": now["v"] - vals[0][1]["v"] if len(vals) > 1 else None})
    return rows


def _table(r: int, sessions: list, shown: list) -> str:
    rows = []
    for t in table(sessions, shown):
        lbl, now_d, now_v = t["label"], t["day"], t["cm"]
        last = body.signed(t["last"]) if t["last"] is not None else "–"
        start = body.signed(t["start"]) if t["start"] is not None else "–"
        rows.append(f'<tr><td>{lbl}</td><td class="num"><a href="{esc(_url(r, measure=1, mday=now_d.isoformat()))}" '
                    f'aria-label="{lbl} {body.cm(now_v)} cm on {now_d:%d.%m.%Y}, change it">{body.cm(now_v)}</a></td>'
                    f'<td class="num ch">{last}</td><td class="num ch">{start}</td></tr>')
    if not rows:
        return ""
    return ('<div class="tablewrap"><table class="ft bt"><thead><tr><th>cm</th><th>Now</th><th>Last</th><th>Start</th></tr></thead>'
            f'<tbody>{"".join(rows)}</tbody></table></div>'
            f'<p class="small">Last = change since the time before. Start = change since {sessions[0]["day"]:%d.%m.%Y}. Tap a value to change it.</p>')


def charted(sessions: list, shown: list) -> list[tuple]:
    """The shown measures that have a value: [(key, label)], in the form's order (one chip and chart each)."""
    return [(k, lbl) for k, lbl, _h in shown if any(k in s["vals"] for s in sessions)]


def chart_data(k: str, label: str, sessions: list, today: date, days: int) -> dict:
    """One measure's chart as app.js's drawChart takes it: its sessions in the Health page's range, or every session when fewer
    than 2 are in it; the value above each point, the dates of the points on the axis."""
    pts = [(s["day"], s["vals"][k]["v"]) for s in sessions if k in s["vals"]]
    inside = [p for p in pts if p[0] > today - timedelta(days=days)]
    pts = inside if len(inside) >= 2 else pts  # fewer than 2 in the range: every session
    first = pts[0][0]
    idx = lambda d: (d - first).days
    return {"start": first.isoformat(), "days": max(1, idx(pts[-1][0]) + 1), "label": f"{label} in cm",
            "series": [{"mark": "line", "cls": "a", "pts": [[idx(d), v] for d, v in pts]},
                       {"mark": "dot", "cls": "a", "pts": [[idx(d), v, f"{d:%d.%m.%Y}: {body.cm(v)} cm"] for d, v in pts]}],
            "pointLabels": 1, "xAtPoints": 1}


def _chart(r: int, sessions: list, shown: list, pick: Optional[str], today: date, days: int) -> str:
    have = charted(sessions, shown)
    if not have:
        return ""
    k = pick if pick in dict(have) else have[0][0]
    data = chart_data(k, dict(have)[k], sessions, today, days)
    chips = "".join(f'<a class="chip{" on" if m == k else ""}" href="{esc(_url(r, bx=m))}"{" aria-current=\"true\"" if m == k else ""}>{lbl}</a>'
                    for m, lbl in have)
    return (f'<p class="chips bchips" role="group" aria-label="Measure">{chips}</p>'
            f'<div class="chart" id="c-body" data-chart="{esc(json.dumps(data, separators=(",", ":")))}"></div>')


def derived(cur, sessions: list, today: date) -> dict:
    """Waist ÷ height ({waist, day, height or None}, None without a waist) and the weight rate ((kg, % a week) or None)."""
    waist = [(s["day"], s["vals"]["waist"]["v"]) for s in sessions if "waist" in s["vals"]]
    wh = None
    if waist:
        day, w = waist[-1]
        wh = {"waist": w, "day": day, "height": body.height_on(cur, day)}
    return {"waist_height": wh, "rate": body.weight_rate(cur, today)}


def _derived(der: dict) -> str:
    out = []
    wh = der["waist_height"]
    if wh:
        w, h = wh["waist"], wh["height"]
        out.append(f'Waist ÷ height: <b>{w / h:.2f}</b> (height {h:g} cm, from <a href="/web/settings?tab=body">Settings</a>). '
                   'Under 0.5 is the common target.' if h else
                   'Waist ÷ height: add your height in <a href="/web/settings?tab=body">Settings</a>.')
    if der["rate"]:
        kg, pct = der["rate"]
        sign = rate_sign(kg)
        out.append(f'Weight: <b>{sign}{abs(kg):.2f} kg</b> a week over the last 4 weeks ({sign}{abs(pct):.2f} % of body weight a week), '
                   'from the 7-day averages.')
    return "".join(f'<p class="bline">{x}</p>' for x in out)


def rate_sign(kg: float) -> str:
    return "±" if abs(kg) < 0.005 else "+" if kg > 0 else "−"


def load(today: date, day: date, before: bool = True) -> dict:
    """What the card shows (deploy 91: app.'s card and the JSON door read this): the settings, the shown measures, every session,
    waist ÷ height and the weight rate, the session of day (the form's values) and, with before, each shown measure's last value
    before that day (the form's placeholders)."""
    with connect() as conn, conn.cursor() as cur:
        prefs = body.settings(cur)
        shown = body.shown(prefs)
        sessions = body.sessions(cur)
        der = derived(cur, sessions, today)
        now = next((s["vals"] for s in sessions if s["day"] == day), {})
        last_vals = {}
        for k, _l, _h in shown if before else ():
            p = body.last_before(cur, k, day)
            if p:
                last_vals[k] = p[1]
    last = sessions[-1]["day"] if sessions else None
    return {"prefs": prefs, "shown": shown, "sessions": sessions, "derived": der, "day": day, "now": now, "before": last_vals,
            "last": last, "due_text": _due_text(last, today, prefs["interval"]) if last else None}


def card(csrf: str, q, today: date, days: int) -> str:
    """The Body measurements card: q = the Health page's query (measure, mday, bx)."""
    open_ = q.get("measure") == "1"
    try:
        day = min(date.fromisoformat(str(q.get("mday", ""))), today)
    except ValueError:
        day = today
    b = load(today, day, before=open_)
    shown, sessions, last = b["shown"], b["sessions"], b["last"]
    sub = (f'Last measured {last:%d.%m.%Y} · {b["due_text"]}' if last
           else "No measurements yet. About 3 minutes with a tape measure, every 4 weeks.")
    btn = (f'<a class="ghost" href="{esc(_url(days))}">Close</a>' if open_ else
           f'<a class="primary bmeasure" href="{esc(_url(days, measure=1))}">Measure</a>')
    form = _form(csrf, days, day, today, shown, b["now"], b["before"]) if open_ else ""
    hint = f'<p class="small hint">{HINT_HTML}</p>'
    return (f'<div class="card bodycard" id="body"><div class="bhead"><div><h2>Body measurements</h2><p class="small">{sub}</p></div>{btn}</div>'
            f'{form}{_table(days, sessions, shown)}{_chart(days, sessions, shown, q.get("bx"), today, days)}{_derived(b["derived"])}{hint}</div>')


HINT = ('Or type it in the Log bar or in Claude: waist 92.5 hips 101 chest 98 arm 33.5 thigh 57. '
        'Any of them alone works too ("waist 92.5"); no AI is needed for these.')
HINT_HTML = ('Or type it in the Log bar or in Claude: <b>waist 92.5 hips 101 chest 98 arm 33.5 thigh 57</b>. '
             'Any of them alone works too ("waist 92.5"); no AI is needed for these.')


def today_line(csrf: str, due: dict) -> str:
    """The line in Today's To review card (spec section 7): Measure opens the Health card's form, Not today hides it until the
    next health day."""
    if due["last"]:
        head = "Body measurements due"
        sub = f'Last {due["last"]:%d.%m.} · {due["days"]} days ago · takes about 3 minutes'
    else:
        head, sub = "Body measurements", "not measured yet · takes about 3 minutes"
    return (f'<div class="rev bdue"><div class="bdue-t"><b>{head}</b><span class="small">{sub}</span></div>'
            f'<div class="row"><a class="primary" href="/web/health?measure=1#body">Measure</a>'
            f'<form method="post" action="/web/body/skip">{hidden("csrf", csrf)}<button class="ghost dim" type="submit">Not today</button></form></div></div>')

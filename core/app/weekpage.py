"""The web app's Week page (decided 29.10.2026): the Sheet's weekly summary on the web, with fat next to calories and protein.
Only complete days count (today is left out). Periods: the last 7 days (the default), last week, the last 30 days, this week so far.
Food against the targets, how far from the targets, weight, blood pressure, fasting sugar, sleep, habits, the days, the foods that
count most, and the daily charts of calories, protein and fat."""
from datetime import date, timedelta

from . import coachpage, habitaim, trendspage
from .body import LABEL as BODY_LABEL, sessions as body_sessions, signed
from .db import connect
from .foodpage import _pct_class
from .todaypage import _n
from .webentry import esc

PERIODS = (("7", "Last 7 days"), ("last", "Last week"), ("30", "Last 30 days"), ("this", "This week so far"))
MACROS = (("kcal", "Calories", "kcal"), ("protein", "Protein", "g"), ("fat", "Fat", "g"), ("carbs", "Carbs", "g"))


def _monday(d: date) -> date:
    return d - timedelta(days=d.weekday())


def bounds(p: str, today: date) -> tuple[date, date]:
    yesterday = today - timedelta(days=1)
    if p == "last":
        return _monday(today) - timedelta(days=7), _monday(today) - timedelta(days=1)
    if p == "this":
        return _monday(today), yesterday
    return yesterday - timedelta(days=29 if p == "30" else 6), yesterday


def _avg(xs) -> float | None:
    xs = [float(x) for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


EMPTY = "No complete day in this period yet (this week so far starts after Monday)."
TODAY_LEFT_OUT = "today is left out, it is not over yet"
METER_HINT = "Average day as a share of the target; the thin line is 100%."
NOTHING = "Nothing logged in this period."
NO_DAYS = "No complete days with food."


def period(raw) -> str:
    """?p= as app. reads it: 7, last, 30 or this; anything else is 7."""
    return raw if raw in dict(PERIODS) else "7"


def today_of(cur) -> date:
    cur.execute("SELECT log_day(now()) AS d")
    return cur.fetchone()["d"]


def period_of(a: date, b: date) -> str:
    """The period whose days are a to b today: last or this (the two a review is offered for), else 7."""
    with connect() as conn, conn.cursor() as cur:
        today = today_of(cur)
    return next((p for p in coachpage.REVIEWED if bounds(p, today) == (a, b)), "7")


def food_tiles(totals: dict) -> list:
    """The Food card's four macros (deploy 101: data for app. and the door): the average complete day, the latest target, the
    average as a percent of it, app.'s meter class (level: foodpage._pct_class; over: the bar drawn as over) and the words app.
    writes (average_text, target_text, note when there is no bar: "no target set" or "no complete days")."""
    days = sorted(trendspage.full_days(totals))  # partly logged days left out (04.11.2026)
    out = []
    for key, label, unit in MACROS:
        target = next((float(totals[d]["target_" + key]) for d in reversed(days) if totals[d]["target_" + key]), None)
        mean = _avg(totals[d][key] for d in days)
        pct = mean / target * 100 if mean is not None and target else None
        level = _pct_class(key, mean, target) if pct is not None else None
        out.append({"key": key, "label": label, "unit": unit, "average": mean, "target": target, "pct": pct, "level": level,
                    "over": level in ("warn", "bad") and key != "protein", "average_text": _n(mean) if mean is not None else "–",
                    "target_text": _n(target) if target else None,
                    "note": None if pct is not None else "no target set" if mean is not None else "no complete days"})
    return out


def _bars(tiles: list) -> str:
    rows = []
    for t in tiles:
        if t["pct"] is None:
            rows.append(f'<tr><td>{t["label"]}</td><td class="small" colspan="2">{t["note"]}</td></tr>')
            continue
        pct = t["pct"]
        rows.append(f'<tr><td>{t["label"]}</td><td class="bar"><svg class="meter" viewBox="0 0 150 4" preserveAspectRatio="none" aria-hidden="true">'
                    f'<rect class="track" width="150" height="4" rx="2"/><rect class="fill {"over" if t["over"] else ""}" '
                    f'width="{min(150, pct):.1f}" height="4" rx="2"/><rect class="goal" x="100" width="1" height="4"/></svg></td>'
                    f'<td class="{t["level"]}">{pct:.0f}%</td></tr>')
    return ('<table class="ft plain far"><tbody>' + "".join(rows) + "</tbody></table>"
            f'<p class="small hint">{METER_HINT}</p>')


def _cards(tiles: list) -> str:
    out = []
    for t in tiles:
        out.append(f'<div class="total"><div class="lbl">{t["label"]} per day</div><span class="n num">{t["average_text"]}'
                   f'{"" if t["unit"] == "kcal" else " g"}</span>' + (f' <span class="of num">/ {t["target_text"]} {t["unit"]}</span>' if t["target"] else "") + "</div>")
    return f'<div class="totals">{"".join(out)}</div>'


def _row(key: str, label: str, value: str, detail=None) -> dict:
    return {"key": key, "label": label, "value": value, "detail": detail}


def health_rows(cur, start: date, end: date, ndays: int) -> list:
    """The "Health and habits" card's rows in app.'s order (deploy 101: data for app. and the door), only those with data: {key,
    label, value, detail} with app.'s words (detail: the small grey words after the value, or null). Keys: weight, bp_morning,
    bp_evening, sugar, sleep, feel (mood and energy), body (one per session), habits, avoid (one per habit to avoid; its label is
    the habit's), gym."""
    cur.execute("""SELECT t.name, m.period, m.day, m.value1, m.value2 FROM measurements m JOIN log_types t ON t.id = m.type_id
                   WHERE t.name IN ('weight','bp','blood_sugar') AND m.day BETWEEN %s AND %s ORDER BY m.event_at, m.id""", (start, end))
    rows = cur.fetchall()
    weights = {}
    for r in rows:
        if r["name"] == "weight":
            weights[r["day"]] = float(r["value1"])
    bp = {p: [r for r in rows if r["name"] == "bp" and r["period"] == p] for p in ("morning", "evening")}
    sugar = [r["value1"] for r in rows if r["name"] == "blood_sugar"]
    cur.execute("SELECT hours FROM v_sleep WHERE wake_day BETWEEN %s AND %s AND hours > 0 AND hours < 24", (start, end))
    sleep = _avg(r["hours"] for r in cur.fetchall())
    cur.execute("""SELECT t.name, t.daily_target, e.day, count(*)::int AS n FROM events e JOIN log_types t ON t.id = e.type_id
                   WHERE t.on_checklist AND t.active AND t.name <> 'wake' AND e.day BETWEEN %s AND %s GROUP BY 1, 2, 3""", (start, end))
    done = cur.fetchall()
    avoid = habitaim.avoid(cur)  # habits to avoid count their days without, not towards "done" (04.11.2026)
    cur.execute("SELECT name, label FROM log_types WHERE on_checklist AND active AND kind = 'event' AND name <> 'wake' ORDER BY sort_order, name")
    tracked = cur.fetchall()
    habits = sum(1 for t in tracked if t["name"] not in avoid)
    full = sum(1 for r in done if r["n"] >= (r["daily_target"] or 1) and r["name"] not in avoid)
    without = [(t["label"], ndays - len({r["day"] for r in done if r["name"] == t["name"]})) for t in tracked if t["name"] in avoid]
    items = []
    if weights:
        ds = sorted(weights)
        change = weights[ds[-1]] - weights[ds[0]]
        items.append(_row("weight", "Weight", f'{weights[ds[-1]]:.1f} kg', f'({"+" if change > 0 else "−" if change < 0 else "±"}{abs(change):.1f} kg since {ds[0]:%d.%m.})'))
    for p in ("morning", "evening"):
        if bp[p]:
            items.append(_row(f"bp_{p}", f"Blood pressure {p}", f'{_avg(r["value1"] for r in bp[p]):.0f}/{_avg(r["value2"] for r in bp[p]):.0f}', f'average of {len(bp[p])}'))
    if sugar:
        items.append(_row("sugar", "Fasting sugar", f'{_avg(sugar):.0f} mg/dL', f'average of {len(sugar)}'))
    if sleep is not None:
        items.append(_row("sleep", "Sleep", f'{int(sleep)} h {round((sleep % 1) * 60):02d}', "average night"))
    # mood and energy from the evening check-in (02.11.2026): the day's latest of each, averaged
    cur.execute("""SELECT DISTINCT ON (t.name, m.day) t.name, m.value1 FROM measurements m JOIN log_types t ON t.id = m.type_id
                   WHERE t.name IN ('mood','energy') AND m.day BETWEEN %s AND %s ORDER BY t.name, m.day, m.event_at DESC, m.id DESC""", (start, end))
    feel: dict = {}
    for r in cur.fetchall():
        feel.setdefault(r["name"], []).append(float(r["value1"]))
    if feel:
        said = " · ".join(f'{t} {_avg(feel[t]):.1f}' for t in ("mood", "energy") if t in feel)
        n = max(len(v) for v in feel.values())
        items.append(_row("feel", "Mood · energy", said, f'average of {n} evening{"" if n == 1 else "s"}, 1 to 5'))
    # body measurements (03.11.2026): one line per session in the period, with the waist's change since the session before
    sess = body_sessions(cur)
    for i, s in enumerate(sess):
        if start <= s["day"] <= end:
            k = "waist" if "waist" in s["vals"] else next(iter(s["vals"]))
            prev = next((p["vals"][k]["v"] for p in reversed(sess[:i]) if k in p["vals"]), None)
            said = f'{BODY_LABEL[k].lower()} {signed(s["vals"][k]["v"] - prev)} cm since last' if prev is not None else "the first measurement"
            n = len(s["vals"])
            items.append(_row("body", "Body measurements", f'Measured {s["day"]:%d.%m.}: {said}', f'({n} value{"" if n == 1 else "s"})'))
    if habits and ndays:
        items.append(_row("habits", "Habits", f'{full / (habits * ndays) * 100:.0f}%', f'of habit-days done ({full} of {habits * ndays})'))
    for label, free in without if ndays else []:
        items.append(_row("avoid", label, f'{free} of {ndays} days without', "(a habit to avoid)"))
    # gym days (02.11.2026, Gym step c; the owner's answer: on the Week page only, not in the Sheet), once there is a gym list
    cur.execute("""SELECT w.day, d.name FROM workouts w LEFT JOIN workout_days d ON d.id = w.split_day_id
                   WHERE w.day BETWEEN %s AND %s ORDER BY w.day, w.id""", (start, end))
    gymdays = cur.fetchall()
    cur.execute("SELECT EXISTS (SELECT 1 FROM exercises) AS e")
    if gymdays or cur.fetchone()["e"]:
        n = len({r["day"] for r in gymdays})
        when = ", ".join(f'{r["day"]:%a %d.%m.}' + (f' ({r["name"]})' if r["name"] else "") for r in gymdays)
        items.append(_row("gym", "Gym", f'{n} workout{"" if n == 1 else "s"}', when or None))
    return items


def _health(items: list) -> str:
    # the label as app. wrote it (a habit to avoid's label was never escaped: kept, so the page stays the same)
    body = "".join(f"<tr><td>{r['label']}</td><td>{esc(r['value'])}" + (f' <span class="small">{esc(r["detail"])}</span>' if r["detail"] else "") + "</td></tr>"
                   for r in items) or f'<tr><td class="empty">{NOTHING}</td></tr>'
    return f'<table class="ft plain"><tbody>{body}</tbody></table>'


def day_rows(cur, totals: dict, start: date, end: date) -> list:
    """The days table's rows, newest first: day, label (app.'s "Mon 09.11."), kcal, protein, fat, carbs, kg (the day's last
    weight or null) and partly (under half the calorie target: app.'s table does not mark it; its charts and averages do)."""
    cur.execute("""SELECT m.day, m.value1 FROM measurements m JOIN log_types t ON t.id = m.type_id
                   WHERE t.name = 'weight' AND m.day BETWEEN %s AND %s ORDER BY m.event_at, m.id""", (start, end))
    weights = {r["day"]: float(r["value1"]) for r in cur.fetchall()}
    return [{"day": d, "label": f"{d:%a %d.%m.}", **{k: totals[d][k] for k, _l, _u in MACROS}, "kg": weights.get(d),
             "partly": trendspage.partly(totals[d])} for d in sorted(totals, reverse=True)]


def _days(rows: list) -> str:
    kg = lambda v: "–" if v is None else f"{v:.1f}"  # noqa: E731
    out = [f'<tr><td>{r["label"]}</td>' + "".join(f"<td>{_n(r[k])}</td>" for k, _l, _u in MACROS) + f'<td>{kg(r["kg"])}</td></tr>' for r in rows]
    return ('<div class="tablewrap"><table class="ft"><thead><tr><th>Day</th><th>kcal</th><th>Protein g</th><th>Fat g</th><th>Carbs g</th><th>kg</th></tr></thead>'
            f'<tbody>{"".join(out) or "<tr><td colspan=6 class=empty>" + NO_DAYS + "</td></tr>"}</tbody></table></div>')


def top_foods(cur, start: date, end: date) -> dict:
    """The foods that count most: by_kcal and by_count, eight each: {name, kcal, n, text} (text: app.'s "1,240 kcal" or "5×")."""
    cur.execute("""SELECT f.name, round(sum(e.kcal)) AS kcal, count(*)::int AS n FROM food_entries e JOIN foods f ON f.id = e.food_id
                   WHERE e.day BETWEEN %s AND %s GROUP BY f.name""", (start, end))
    rows = cur.fetchall()
    by_kcal = sorted(rows, key=lambda r: (-r["kcal"], r["name"]))[:8]
    by_n = sorted(rows, key=lambda r: (-r["n"], r["name"]))[:8]
    return {"by_kcal": [{"name": r["name"], "kcal": r["kcal"], "n": r["n"], "text": f"{_n(r['kcal'])} kcal"} for r in by_kcal],
            "by_count": [{"name": r["name"], "kcal": r["kcal"], "n": r["n"], "text": f"{r['n']}×"} for r in by_n]}


def _foods(f: dict) -> str:
    li = lambda rs: "".join(f"<tr><td>{esc(r['name'])}</td><td>{r['text']}</td></tr>" for r in rs) or "<tr><td class=empty>Nothing.</td></tr>"  # noqa: E731
    return ('<div class="grid2"><div><h3>Most calories</h3><table class="ft plain"><tbody>' + li(f["by_kcal"])
            + '</tbody></table></div><div><h3>Eaten most often</h3><table class="ft plain"><tbody>' + li(f["by_count"])
            + "</tbody></table></div></div>")


def data(p: str) -> dict:
    """The Week page of period p as data (deploy 101: app.'s page and the JSON door read the same). empty: no complete day in the
    period yet (this week so far, on a Monday): then only the period, its bounds and the words. Otherwise the header's parts,
    the Food card (food_tiles), "Health and habits" (health_rows), the foods that count most (top_foods), the four charts
    (trendspage.charts), the days (day_rows) and the Week review card (coachpage.week_review)."""
    with connect() as conn, conn.cursor() as cur:
        today = today_of(cur)
        start, end = bounds(p, today)
        ndays = max(0, (end - start).days + 1)
        out = {"p": p, "periods": [{"p": k, "label": lbl, "current": k == p} for k, lbl in PERIODS], "today": today, "start": start,
               "end": end, "ndays": ndays, "empty": not ndays, "empty_text": EMPTY if not ndays else None,
               "with_food": None, "dates_text": None, "days_text": None, "left_out": None, "today_text": TODAY_LEFT_OUT,
               "food": [], "meter_hint": METER_HINT, "health": [], "health_none": NOTHING, "foods": {"by_kcal": [], "by_count": []},
               "charts": [], "days": [], "days_none": NO_DAYS, "review": None}
        if not ndays:
            return out
        totals = trendspage.day_totals(cur, start, end)
        out.update(with_food=len(totals), dates_text=f"{start:%a %d.%m.} to {end:%a %d.%m.%Y}", days_text=f"{len(totals)} of {ndays} days with food",
                   left_out=trendspage.left_out_text(totals), food=food_tiles(totals), health=health_rows(cur, start, end, ndays),
                   foods=top_foods(cur, start, end), charts=trendspage.charts(totals, start, end), days=day_rows(cur, totals, start, end),
                   review=coachpage.week_review(start, end, p))
    return out


def render(csrf: str, q) -> str:
    p = period(q.get("p"))
    d = data(p)
    seg = "".join(f'<a href="/web/week?p={x["p"]}"{" aria-current=\"page\"" if x["current"] else ""}>{x["label"]}</a>' for x in d["periods"])
    head = f'<div class="head"><h1>Week</h1><nav class="seg" aria-label="Period">{seg}</nav></div>'
    if d["empty"]:
        return head + f'<div class="card"><p class="empty">{d["empty_text"]}</p></div>'
    head += (f'<p class="small">{d["dates_text"]} · {d["days_text"]}{" · " + d["left_out"] if d["left_out"] else ""} · {d["today_text"]}</p>')
    body = (coachpage.week_html(d["review"], p, csrf) + f'<div class="card"><h2>Food</h2>{_cards(d["food"])}{_bars(d["food"])}</div>'
            f'<div class="grid2"><div class="card"><h2>Health and habits</h2>{_health(d["health"])}</div>'
            f'<div class="card"><h2>Foods that count most</h2>{_foods(d["foods"])}</div></div>'
            f'<div class="grid2">{trendspage.cards_html(d["charts"])}</div>'
            f'<div class="card"><h2>The days</h2>{_days(d["days"])}</div>')
    return head + body

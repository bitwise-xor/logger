"""The web app's food trends (decided 29.10.2026): calories, protein, fat and carbs per day over 7, 30 or 90 days against the targets, with
the 7-day average. Only complete days count: today is left out because it is not over yet. The charts are drawn by app.js from
the numbers in each chart's data-chart attribute. The same charts are used by the Week page."""
import json
from datetime import date, timedelta

from .db import connect
from .webentry import esc

RANGES = (7, 30, 90)
DEFAULT_RANGE = 30
NUTRIENTS = (("kcal", "Calories", " kcal", "kcal"), ("protein", "Protein", " g", "g"), ("fat", "Fat", " g", "g"),
             ("carbs", "Carbs", " g", "g"))  # carbs since 04.11.2026: it has a target like the others


def _dm(d: date) -> str:
    return d.strftime("%a %d.%m.")


def day_totals(cur, start: date, end: date) -> dict:
    """{day: row of v_food_day's total line} for the days that have food."""
    cur.execute("""SELECT day, kcal, protein, fat, carbs, target_kcal, target_protein, target_fat, target_carbs
                   FROM v_food_day WHERE meal IS NULL AND day BETWEEN %s AND %s AND kcal IS NOT NULL ORDER BY day""", (start, end))
    return {r["day"]: r for r in cur.fetchall()}


PARTLY = 0.5  # a day under half its calorie target counts as partly logged (04.11.2026)


def partly(r) -> bool:
    """A day probably not fully logged: under half of that day's calorie target. Its bar still shows; averages leave it out."""
    t = r["target_kcal"]
    return bool(t) and float(r["kcal"] or 0) < PARTLY * float(t)


def full_days(totals: dict) -> dict:
    return {d: r for d, r in totals.items() if not partly(r)}


def left_out_text(totals: dict):
    """"1 partly logged day left out (03.11.: under half the calorie target)", or None (deploy 101: the words without the dot)."""
    ds = sorted(d for d, r in totals.items() if partly(r))
    if not ds:
        return None
    return (f'{len(ds)} partly logged day{"" if len(ds) == 1 else "s"} left out ({", ".join(f"{d:%d.%m.}" for d in ds[:4])}'
            f'{"…" if len(ds) > 4 else ""}: under half the calorie target)')


def left_out(totals: dict) -> str:
    """" · 1 partly logged day left out (03.11.)", or "" """
    text = left_out_text(totals)
    return f" · {text}" if text else ""


def _t(text: str) -> dict:
    return {"text": text, "bold": False}


def _b(text: str) -> dict:
    return {"text": text, "bold": True}


def charts(totals: dict, start: date, end: date) -> list[dict]:
    """One card per nutrient as data (deploy 101: app.'s cards and the JSON door read the same; the Health page's card shape):
    id (kcal, protein, fat, carbs), title, small, the stat line as parts (bold or not), the chart as app.js's drawChart takes it
    (daily bars, the 7-day average, the target line) and the legend ({key: the colour key's class, text})."""
    days = (end - start).days + 1
    every = sorted(totals)
    have = sorted(full_days(totals))  # averages and counts leave out partly logged days (04.11.2026)
    out = []
    for key, label, unit, short in NUTRIENTS:
        vals = {d: float(totals[d][key]) for d in have}
        pts = [[(d - start).days, round(float(totals[d][key]), 1), f"{_dm(d)}: {float(totals[d][key]):,.0f}{unit}" + (" (partly logged)" if partly(totals[d]) else "")]
               for d in every]
        avg7 = []
        for d in have:
            window = [vals[x] for x in have if d - timedelta(days=6) <= x <= d]
            avg7.append([(d - start).days, round(sum(window) / len(window), 1)])
        target = next((float(totals[d]["target_" + key]) for d in reversed(have) if totals[d]["target_" + key]), None)
        series = [{"mark": "bar", "cls": "a", "pts": pts}, {"mark": "line", "cls": "b", "pts": avg7}]
        chart = {"start": start.isoformat(), "days": days, "series": series, "label": f"{label} per day", "min": 0,
                 "unit": "" if key == "kcal" else unit,  # "2,000 kcal" does not fit the axis
                 **({"lines": [[target, "t", f"{target:,.0f}"]]} if target else {})}
        if vals:
            mean = sum(vals.values()) / len(vals)
            stat = [_t("average "), _b(f"{mean:,.0f}{unit}")] + ([_t(f" · target {target:,.0f}")] if target else [])
            if target and key == "protein":
                hit = sum(1 for d in have if totals[d]["target_protein"] and vals[d] >= float(totals[d]["target_protein"]))
                stat += [_t(" · target reached on "), _b(str(hit)), _t(f" of {len(have)} days")]
            elif target:
                over = sum(1 for d in have if totals[d]["target_" + key] and vals[d] > float(totals[d]["target_" + key]))
                stat += [_t(" · over the target on "), _b(str(over)), _t(f" of {len(have)} days")]
            if key == "kcal" and left_out(totals):
                stat.append(_t(left_out(totals)))
        else:
            stat = [_t("no complete days with food in this range")]
        legend = [{"key": "sq a", "text": "day"}, {"key": "line b", "text": "7-day average"}] + ([{"key": "ref t", "text": "target"}] if target else [])
        out.append({"id": key, "title": label, "small": "per day", "stat": stat, "chart": chart, "legend": legend})
    return out


def _chart(cid: str, data: dict) -> str:
    return f'<div class="chart" id="{cid}" data-chart="{esc(json.dumps(data, separators=(",", ":")))}"></div>'


def _stat(parts: list) -> str:
    return "".join(f"<b>{esc(p['text'])}</b>" if p["bold"] else esc(p["text"]) for p in parts)


def _legend(items: list) -> str:
    """app.'s legend: a space after the first key's words only ("day 7-day averagetarget" as the page has it)."""
    return "".join(f'<i class="key {k["key"]}"></i>{esc(k["text"])}' + (" " if i == 0 else "") for i, k in enumerate(items))


def cards_html(cs: list) -> str:
    return "".join(f'<div class="card"><h2>{c["title"]} <span class="small">{c["small"]}</span></h2><p class="stat">{_stat(c["stat"])}</p>'
                   f'{_chart("c-trend-" + c["id"], c["chart"])}<p class="legend">{_legend(c["legend"])}</p></div>' for c in cs)


def cards(totals: dict, start: date, end: date) -> str:
    """One card per nutrient: daily bars, the 7-day average, the target line, a line of numbers."""
    return cards_html(charts(totals, start, end))


def days_of(raw) -> int:
    """?r= as app. reads it: 7, 30 or 90; anything else is 30."""
    r = str(raw or "")
    return int(r) if r in {str(x) for x in RANGES} else DEFAULT_RANGE


def data(days: int) -> dict:
    """The Trends tab as data (deploy 101): the last `days` complete days (today left out), the header's words, the four cards."""
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT log_day(now()) AS d")
        today = cur.fetchone()["d"]
        end = today - timedelta(days=1)
        start = end - timedelta(days=days - 1)
        totals = day_totals(cur, start, end)
    return {"range": days, "ranges": list(RANGES), "start": start, "end": end, "title": f"Last {days} complete days",
            "small": f"{start:%d.%m.} to {end:%d.%m.}, today not counted", "charts": charts(totals, start, end)}


def render(csrf: str, q) -> str:
    d = data(days_of(q.get("r", "")))
    seg = "".join(f'<a href="/web/food/trends?r={x}"{" aria-current=\"page\"" if x == d["range"] else ""}>{x} days</a>' for x in RANGES)
    return (f'<div class="head sub"><h2>{d["title"]} <span class="small">{d["small"]}</span></h2>'
            f'<nav class="seg" aria-label="Range">{seg}</nav></div><div class="grid2">{cards_html(d["charts"])}</div>')

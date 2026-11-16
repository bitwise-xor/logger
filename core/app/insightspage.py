"""The web app's Insights page (31.10.2026): plain statements from the owner's own numbers of the last 90 days, each with a
small chart: food close to bedtime and the next morning's fasting sugar, short nights and the next day's weight, the carb
share of a day and the next morning's fasting sugar. "Late" counts from the bed time, not the clock, because the owner's
day often starts in the afternoon. A statement shows once both groups have enough days; it is a pattern in the numbers,
not proof of a cause."""
from datetime import timedelta
from statistics import mean, median

from .db import connect
from .webentry import esc

DAYS = 90
MIN_EACH = 4  # days needed in each group
LATE_H = 3  # last food less than this many hours before bed
SHORT_H = 6  # a short night: less than this many hours asleep


def load() -> dict:
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT log_day(now()) AS d")
        today = cur.fetchone()["d"]
        start = today - timedelta(days=DAYS)

        def daily(name: str) -> dict:
            cur.execute("""SELECT m.day, avg(m.value1) AS v FROM measurements m JOIN log_types t ON t.id = m.type_id
                           WHERE t.name = %s AND m.day >= %s GROUP BY m.day""", (name, start))
            return {r["day"]: float(r["v"]) for r in cur.fetchall()}

        sugar, weight = daily("blood_sugar"), daily("weight")
        cur.execute("""SELECT e.day, min(e.event_at) AS at FROM events e JOIN log_types t ON t.id = e.type_id
                       WHERE t.name = 'wake' AND e.day >= %s GROUP BY e.day""", (start,))
        wake = {r["day"]: r["at"] for r in cur.fetchall()}
        # a bed time belongs to the day of the wake-up it pairs with (v_sleep; was noon to noon until 04.11.2026)
        cur.execute("SELECT wake_day, bed_at FROM v_sleep WHERE wake_day >= %s ORDER BY wake_at", (start,))
        bed = {r["wake_day"]: r["bed_at"] for r in cur.fetchall()}
        cur.execute("SELECT day, max(eaten_at) FILTER (WHERE time_known) AS last FROM food_entries WHERE day >= %s GROUP BY day", (start,))
        last = {r["day"]: r["last"] for r in cur.fetchall() if r["last"]}
        cur.execute("SELECT day, protein, carbs, fat FROM v_food_day WHERE meal IS NULL AND day >= %s AND day < %s", (start, today))
        macros = {r["day"]: (float(r["protein"] or 0), float(r["carbs"] or 0), float(r["fat"] or 0)) for r in cur.fetchall()}
    return {"today": today, "sugar": sugar, "weight": weight, "wake": wake, "bed": bed, "last": last, "macros": macros}


def insights(d: dict) -> list[dict]:
    """Each insight: its title, the two groups' values (True = the group the statement is about) and how to say it."""
    one = timedelta(days=1)
    late = []
    for day, last in d["last"].items():
        bed, s = d["bed"].get(day + one), d["sugar"].get(day + one)
        if bed and s is not None and bed > last:
            gap = (bed - last).total_seconds() / 3600
            if gap < 16:
                late.append((gap < LATE_H, s))
    short = []
    for day, up in d["wake"].items():
        bed, w, w0 = d["bed"].get(day), d["weight"].get(day), d["weight"].get(day - one)
        if bed and w is not None and w0 is not None:
            hours = (up - bed).total_seconds() / 3600
            if 2 <= hours <= 14:
                short.append((hours < SHORT_H, (w - w0) * 1000))  # in grams (08.11.2026): "+0.0 kg" hid the difference
    shares = []
    for day, (p, c, f) in d["macros"].items():
        s, energy = d["sugar"].get(day + one), p * 4 + c * 4 + f * 9
        if s is not None and energy > 0:
            shares.append((c * 4 / energy * 100, s))
    cut = median(x for x, _ in shares) if shares else 0
    return [
        {"key": "late", "title": "Food close to bedtime and fasting sugar", "pairs": late, "unit": "mg/dL", "digits": 0, "sign": False,
         "yes": f"Last food under {LATE_H} h before bed", "no": f"{LATE_H} h or more before bed",
         "say": "On the {ny} days your last food was less than " + str(LATE_H) + " hours before bed, fasting sugar the next morning "
                "averaged {my}, against {mn} after the {nn} days with a longer gap.",
         "needs": "days with a bed time, the time of the last food and a fasting sugar the next morning"},
        {"key": "sleep", "title": "Short nights and weight", "pairs": short, "unit": "g", "digits": 0, "sign": True,
         "yes": f"Under {SHORT_H} h of sleep", "no": f"{SHORT_H} h or more",
         "say": "After the {ny} nights with less than " + str(SHORT_H) + " hours of sleep, weight changed by {my} from the day before on "
                "average, against {mn} after the {nn} longer nights.",
         "needs": "nights with a bed and wake-up time and a weight that day and the day before"},
        {"key": "carbs", "title": "Carb share and fasting sugar", "pairs": [(x > cut, s) for x, s in shares], "unit": "mg/dL", "digits": 0,
         "sign": False, "yes": f"Carbs above {cut:.0f} % of calories", "no": f"{cut:.0f} % or less",
         "say": "After the {ny} days with more of the calories from carbs (above " + f"{cut:.0f}" + " %), fasting sugar the next "
                "morning averaged {my}, against {mn} after the {nn} days with less.",
         "needs": "days with food logged and a fasting sugar the next morning"},
    ]


def _fmt(v: float, digits: int, sign: bool, unit: str) -> str:
    """A value as shown; a value that rounds to zero has no sign ("-0 mg/dL" and "+0.0 kg" before 08.11.2026)."""
    if round(v, digits) == 0:
        return f"{0:.{digits}f} {unit}"
    return f"{v:+.{digits}f} {unit}" if sign else f"{v:.{digits}f} {unit}"


NOTE = ('These are patterns in your own numbers, not proof that one thing causes the other: other things change '
        'on the same days. They get steadier with more days. "Late" counts from your bed time, not the clock.')
_B = "\x00"  # marks the bold numbers of a sentence while it is split into parts


def card_data(i: dict) -> dict:
    """One insight as data (deploy 101: app.'s card and the JSON door read the same): key, title, waiting (too few days in a group)
    with app.'s words, else the chip ("+12 mg/dL" or "no difference"), the sentence as parts (the two averages bold) and the two
    groups ({key: yes | no, label, n, mean, text, cls}) with each bar from zero as app. draws it (left, width: percent of the
    track; zero: where zero is, 0 or in the middle when a value is below it)."""
    yes = [v for g, v in i["pairs"] if g]
    no = [v for g, v in i["pairs"] if not g]
    out = {"key": i["key"], "title": i["title"], "unit": i["unit"], "digits": i["digits"], "sign": i["sign"], "needs": i["needs"],
           "waiting": len(yes) < MIN_EACH or len(no) < MIN_EACH, "wait_text": None, "chip": None, "say": None, "zero": None,
           "groups": [{"key": k, "label": i[k], "n": len(vs), "mean": None, "text": None, "cls": cls, "left": None, "width": None}
                      for k, vs, cls in (("yes", yes, "a"), ("no", no, "b"))]}
    if out["waiting"]:
        out["wait_text"] = (f'Not enough days yet: {len(yes)} for "{i["yes"].lower()}" and {len(no)} for "{i["no"].lower()}"; '
                            f'each needs {MIN_EACH}. It counts {i["needs"]}.')
        return out
    my, mn = mean(yes), mean(no)
    fmt = lambda v: _fmt(v, i["digits"], i["sign"], i["unit"])  # noqa: E731
    diff = my - mn
    said = i["say"].format(ny=len(yes), nn=len(no), my=f"{_B}{fmt(my)}{_B}", mn=f"{_B}{fmt(mn)}{_B}")
    out["say"] = [{"text": s, "bold": k % 2 == 1} for k, s in enumerate(said.split(_B)) if s]
    out["chip"] = "no difference" if round(diff, i["digits"]) == 0 else f'{diff:+.{i["digits"]}f} {i["unit"]}'
    lo, hi = min(0.0, my, mn), max(0.0, my, mn)
    span = (hi - lo) or 1.0
    zero = (0 - lo) / span * 100
    out["zero"] = zero
    for g, v in zip(out["groups"], (my, mn)):
        x = (v - lo) / span * 100
        g.update(mean=v, text=fmt(v), left=min(zero, x), width=max(abs(x - zero), 0.8))
    return out


def data() -> dict:
    """The Insights page as data (deploy 101): the last DAYS days, MIN_EACH days needed in each group, the three cards, the note."""
    return {"days": DAYS, "min_each": MIN_EACH, "title": "Insights", "small": f"From the last {DAYS} days",
            "cards": [card_data(i) for i in insights(load())], "note": NOTE}


def _bars(c: dict) -> str:
    """One bar per group, from zero (zero in the middle when a value is below it), the value written beside it."""
    return "".join(f'<div class="ib"><span class="ib-l">{esc(g["label"])} <span class="small">· {g["n"]} days</span></span>'
                   f'<svg class="ibar" viewBox="0 0 100 8" preserveAspectRatio="none" aria-hidden="true"><rect class="track" width="100" height="8" rx="4"/>'
                   f'<rect class="fill {g["cls"]}" x="{g["left"]:.1f}" width="{g["width"]:.1f}" height="8" rx="4"/></svg>'
                   f'<span class="ib-v num">{g["text"]}</span></div>' for g in c["groups"])


def card_html(c: dict) -> str:
    if c["waiting"]:
        yes, no = c["groups"]
        return (f'<div class="card insight wait"><h2>{esc(c["title"])}</h2>'
                f'<p class="small">Not enough days yet: {yes["n"]} for "{esc(yes["label"].lower())}" and {no["n"]} for "{esc(no["label"].lower())}"; '
                f'each needs {MIN_EACH}. It counts {esc(c["needs"])}.</p></div>')
    said = "".join(f'<b>{p["text"]}</b>' if p["bold"] else p["text"] for p in c["say"])
    return (f'<div class="card insight"><h2>{esc(c["title"])}<span class="dp">{c["chip"]}</span></h2>'
            f'<p class="isay">{said}</p>{_bars(c)}</div>')


def card(i: dict) -> str:
    return card_html(card_data(i))


def render(csrf: str) -> str:
    d = data()
    cards = "".join(card_html(c) for c in d["cards"])
    return (f'<div class="head"><h1>{d["title"]}</h1><span class="small">{d["small"]}</span></div>'
            f'<div class="grid2 insights">{cards}</div>'
            f'<p class="small hint">{d["note"]}</p>')

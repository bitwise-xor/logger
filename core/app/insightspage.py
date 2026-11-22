"""The web app's Insights page (31.10.2026): plain statements from the owner's own numbers of the last 90 days (the JSON door also
180 or 365, 22.11.2026), each with a small chart: food close to bedtime and the next morning's fasting sugar or that night's sleep,
the carb share of a day and the next morning's fasting sugar, caffeine in the hours before bed and that night's sleep, and short
nights against the next day's weight, calories, morning blood pressure, mood and energy (the last six since 22.11.2026, web item
50). "Late" counts from the bed time, not the clock, because the owner's day often starts in the afternoon. A night belongs to the
day of its wake-up. A statement shows once both groups have enough days; it is a pattern in the numbers, not proof of a cause, and
a small difference or few days say so (the caveat)."""
from bisect import bisect_left
from datetime import timedelta
from math import sqrt
from statistics import mean, median, stdev

from . import trendspage
from .db import connect
from .webentry import esc

DAYS = 90  # app.'s page and the door's default
RANGES = (90, 180, 365)  # the door's ?days= (22.11.2026)
MIN_EACH = 4  # days needed in each group
FEW = 8  # fewer days than this in a group: the caveat says it can still change a lot
LATE_H = 3  # last food less than this many hours before bed
SHORT_H = 6  # a short night: less than this many hours asleep
CAFFEINE_MG = 50  # this much caffeine or more ...
CAFFEINE_H = 8  # ... in this many hours before bed counts as late caffeine


def load(days: int = DAYS) -> dict:
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT log_day(now()) AS d")
        today = cur.fetchone()["d"]
        start = today - timedelta(days=days)

        def daily(name: str, extra: str = "") -> dict:
            cur.execute(f"""SELECT m.day, avg(m.value1) AS v FROM measurements m JOIN log_types t ON t.id = m.type_id
                            WHERE t.name = %s AND m.day >= %s {extra} GROUP BY m.day""", (name, start))
            return {r["day"]: float(r["v"]) for r in cur.fetchall()}

        def latest(name: str) -> dict:
            """The latest value of each day (the check-in: a second answer replaces the first, as todaypage reads it)."""
            cur.execute("""SELECT DISTINCT ON (m.day) m.day, m.value1 AS v FROM measurements m JOIN log_types t ON t.id = m.type_id
                           WHERE t.name = %s AND m.day >= %s ORDER BY m.day, m.event_at DESC, m.id DESC""", (name, start))
            return {r["day"]: float(r["v"]) for r in cur.fetchall()}

        sugar, weight = daily("blood_sugar"), daily("weight")
        bp = daily("bp", "AND m.period = 'morning'")  # value1: systolic
        mood, energy = latest("mood"), latest("energy")
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
        # complete days without the partly logged ones (the Week page's rule: under half the calorie target)
        kcal = {d: float(r["kcal"]) for d, r in trendspage.full_days(trendspage.day_totals(cur, start, today - timedelta(days=1))).items()}
        # an entry's caffeine as the Nutrients tab adds it up (the food's value per 100 times the amount, kept on the entry)
        cur.execute("""SELECT eaten_at, caffeine_mg FROM food_entries WHERE time_known AND caffeine_mg > 0 AND day >= %s
                       ORDER BY eaten_at""", (start - timedelta(days=1),))
        caffeine = [(r["eaten_at"], float(r["caffeine_mg"])) for r in cur.fetchall()]
    return {"today": today, "sugar": sugar, "weight": weight, "wake": wake, "bed": bed, "last": last, "macros": macros, "mood": mood,
            "energy": energy, "bp": bp, "kcal": kcal, "caffeine": caffeine}


def night_hours(d: dict, day):
    """The hours slept in the night that ends on `day` (its wake-up's day), or None: no bed or wake-up time, or not between 2 and
    14 hours (a missed tap)."""
    up, bed = d["wake"].get(day), d["bed"].get(day)
    if not (up and bed):
        return None
    hours = (up - bed).total_seconds() / 3600
    return hours if 2 <= hours <= 14 else None


def caffeine_before(caffeine: list, at: list, bed) -> float:
    """The caffeine (mg) of the entries with a known time in the CAFFEINE_H hours before `bed` (caffeine: (eaten_at, mg) in time
    order, at: their times)."""
    i, j = bisect_left(at, bed - timedelta(hours=CAFFEINE_H)), bisect_left(at, bed)
    return sum(mg for _, mg in caffeine[i:j])


def insights(d: dict) -> list[dict]:
    """Each insight: its title, the two groups' values (True = the group the statement is about) and how to say it, in the order of
    the page (data() puts the waiting ones last)."""
    one = timedelta(days=1)
    late, late_sleep = [], []
    for day, last in d["last"].items():
        bed = d["bed"].get(day + one)
        if bed and bed > last:
            gap = (bed - last).total_seconds() / 3600
            if gap < 16:
                s, h = d["sugar"].get(day + one), night_hours(d, day + one)
                if s is not None:
                    late.append((gap < LATE_H, s))
                if h is not None:
                    late_sleep.append((gap < LATE_H, h))
    caff, times = [], [a for a, _ in d["caffeine"]]
    for day in d["last"]:  # a day with food logged at a known time, its bed time and that night's sleep
        bed, h = d["bed"].get(day + one), night_hours(d, day + one)
        if bed and h is not None:
            caff.append((caffeine_before(d["caffeine"], times, bed) >= CAFFEINE_MG, h))
    short, after = [], {k: [] for k in ("kcal", "bp", "mood", "energy")}
    for day in d["wake"]:
        hours = night_hours(d, day)
        if hours is None:
            continue
        w, w0 = d["weight"].get(day), d["weight"].get(day - one)
        if w is not None and w0 is not None:
            short.append((hours < SHORT_H, (w - w0) * 1000))  # in grams (08.11.2026): "+0.0 kg" hid the difference
        for k, vs in after.items():
            if d[k].get(day) is not None:
                vs.append((hours < SHORT_H, d[k][day]))
    shares = []
    for day, (p, c, f) in d["macros"].items():
        s, energy = d["sugar"].get(day + one), p * 4 + c * 4 + f * 9
        if s is not None and energy > 0:
            shares.append((c * 4 / energy * 100, s))
    cut = median(x for x, _ in shares) if shares else 0
    nights = {"yes": f"Under {SHORT_H} h of sleep", "no": f"{SHORT_H} h or more"}
    gap = {"yes": f"Last food under {LATE_H} h before bed", "no": f"{LATE_H} h or more before bed"}
    return [
        {"key": "late", "title": "Food close to bedtime and fasting sugar", "pairs": late, "unit": "mg/dL", "digits": 0, "sign": False, **gap,
         "say": "On the {ny} days your last food was less than " + str(LATE_H) + " hours before bed, fasting sugar the next morning "
                "averaged {my}, against {mn} after the {nn} days with a longer gap.",
         "needs": "days with a bed time, the time of the last food and a fasting sugar the next morning"},
        {"key": "carbs", "title": "Carb share and fasting sugar", "pairs": [(x > cut, s) for x, s in shares], "unit": "mg/dL", "digits": 0,
         "sign": False, "yes": f"Carbs above {cut:.0f} % of calories", "no": f"{cut:.0f} % or less",
         "say": "After the {ny} days with more of the calories from carbs (above " + f"{cut:.0f}" + " %), fasting sugar the next "
                "morning averaged {my}, against {mn} after the {nn} days with less.",
         "needs": "days with food logged and a fasting sugar the next morning"},
        {"key": "late_sleep", "title": "Food close to bedtime and sleep", "pairs": late_sleep, "unit": "h", "digits": 1, "sign": False, **gap,
         "say": "On the {ny} days your last food was less than " + str(LATE_H) + " hours before bed, you slept {my} that night on "
                "average, against {mn} after the {nn} days with a longer gap.",
         "needs": "days with a bed time, the time of the last food and a wake-up the next morning"},
        {"key": "caffeine_sleep", "title": "Late caffeine and sleep", "pairs": caff, "unit": "h", "digits": 1, "sign": False,
         "yes": f"{CAFFEINE_MG} mg caffeine or more within {CAFFEINE_H} h of bed", "no": f"Less than {CAFFEINE_MG} mg",
         "say": "On the {ny} days with " + str(CAFFEINE_MG) + " mg of caffeine or more in the " + str(CAFFEINE_H) + " hours before "
                "bed, you slept {my} that night on average, against {mn} after the {nn} days with less.",
         "needs": "days with food logged at known times, a bed time and a wake-up the next morning"},
        {"key": "sleep", "title": "Short nights and weight", "pairs": short, "unit": "g", "digits": 0, "sign": True, **nights,
         "say": "After the {ny} nights with less than " + str(SHORT_H) + " hours of sleep, weight changed by {my} from the day before on "
                "average, against {mn} after the {nn} longer nights.",
         "needs": "nights with a bed and wake-up time and a weight that day and the day before"},
        {"key": "sleep_kcal", "title": "Short nights and calories", "pairs": after["kcal"], "unit": "kcal", "digits": 0, "sign": False,
         **nights,
         "say": "On the {ny} days after a night of less than " + str(SHORT_H) + " hours of sleep, you ate {my} on average, against "
                "{mn} on the {nn} days after a longer night.",
         "needs": "nights with a bed and wake-up time followed by a complete day with all its food logged"},
        {"key": "sleep_bp", "title": "Short nights and morning blood pressure", "pairs": after["bp"], "unit": "mmHg", "digits": 0,
         "sign": False, **nights,
         "say": "On the {ny} mornings after a night of less than " + str(SHORT_H) + " hours of sleep, systolic blood pressure "
                "averaged {my}, against {mn} after the {nn} longer nights.",
         "needs": "nights with a bed and wake-up time and a morning blood pressure that day"},
        {"key": "sleep_mood", "title": "Short nights and mood", "pairs": after["mood"], "unit": "", "digits": 1, "sign": False, **nights,
         "say": "On the {ny} days after a night of less than " + str(SHORT_H) + " hours of sleep, mood that day averaged {my} of 5, "
                "against {mn} after the {nn} longer nights.",
         "needs": "nights with a bed and wake-up time and a mood check-in that day"},
        {"key": "sleep_energy", "title": "Short nights and energy", "pairs": after["energy"], "unit": "", "digits": 1, "sign": False,
         **nights,
         "say": "On the {ny} days after a night of less than " + str(SHORT_H) + " hours of sleep, energy that day averaged {my} of 5, "
                "against {mn} after the {nn} longer nights.",
         "needs": "nights with a bed and wake-up time and an energy check-in that day"},
    ]


def _fmt(v: float, digits: int, sign: bool, unit: str) -> str:
    """A value as shown; a value that rounds to zero has no sign ("-0 mg/dL" and "+0.0 kg" before 08.11.2026); no unit, no space."""
    if round(v, digits) == 0:
        s = f"{0:.{digits}f}"
    else:
        s = f"{v:+.{digits}f}" if sign else f"{v:.{digits}f}"
    return f"{s} {unit}" if unit else s


NOTE = ('These are patterns in your own numbers, not proof that one thing causes the other: other things change '
        'on the same days. They get steadier with more days. "Late" counts from your bed time, not the clock.')
_B = "\x00"  # marks the bold numbers of a sentence while it is split into parts


def _spread(yes: list, no: list) -> float:
    """The pooled standard deviation of the two groups (each group's sample standard deviation; all equal: 0)."""
    sd = lambda vs: stdev(vs) if len(vs) > 1 else 0.0  # noqa: E731
    return sqrt(((len(yes) - 1) * sd(yes) ** 2 + (len(no) - 1) * sd(no) ** 2) / (len(yes) + len(no) - 2))


def caveat(yes: list, no: list, digits: int, unit: str):
    """One plain sentence when a statement is weak, or None: the difference is under half the usual spread (it may be chance), or a
    group has fewer than FEW days. A difference that rounds to zero has none (its chip says "no difference")."""
    diff = mean(yes) - mean(no)
    if round(diff, digits) == 0:
        return None
    spread = _spread(yes, no)
    if abs(diff) < spread / 2:
        return f"The difference is smaller than the usual day-to-day spread (about {_fmt(spread, digits, False, unit)}), so it may be chance."
    if len(yes) < FEW or len(no) < FEW:
        return f"Few days so far ({len(yes)} and {len(no)}): this can still change a lot."
    return None


def card_data(i: dict) -> dict:
    """One insight as data (deploy 101: app.'s card and the JSON door read the same): key, title, waiting (too few days in a group)
    with app.'s words, else the chip ("+12 mg/dL" or "no difference"), the sentence as parts (the two averages bold), the caveat (a
    sentence or None) and the two groups ({key: yes | no, label, n, mean, text, cls}) with each bar from zero as app. draws it (left,
    width: percent of the track; zero: where zero is, 0 or in the middle when a value is below it)."""
    yes = [v for g, v in i["pairs"] if g]
    no = [v for g, v in i["pairs"] if not g]
    out = {"key": i["key"], "title": i["title"], "unit": i["unit"], "digits": i["digits"], "sign": i["sign"], "needs": i["needs"],
           "waiting": len(yes) < MIN_EACH or len(no) < MIN_EACH, "wait_text": None, "chip": None, "say": None, "caveat": None, "zero": None,
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
    out["chip"] = "no difference" if round(diff, i["digits"]) == 0 else _fmt(diff, i["digits"], True, i["unit"])
    out["caveat"] = caveat(yes, no, i["digits"], i["unit"])
    lo, hi = min(0.0, my, mn), max(0.0, my, mn)
    span = (hi - lo) or 1.0
    zero = (0 - lo) / span * 100
    out["zero"] = zero
    for g, v in zip(out["groups"], (my, mn)):
        x = (v - lo) / span * 100
        g.update(mean=v, text=fmt(v), left=min(zero, x), width=max(abs(x - zero), 0.8))
    return out


def data(days: int = DAYS) -> dict:
    """The Insights page as data (deploy 101): the last `days` days (90, 180 or 365; app.'s page: 90), MIN_EACH days needed in each
    group, the nine cards (those with a statement first, the waiting ones after, each half in the order of insights()), the note."""
    if days not in RANGES:
        raise ValueError(f"days must be one of {RANGES}")
    cards = [card_data(i) for i in insights(load(days))]
    return {"days": days, "ranges": list(RANGES), "min_each": MIN_EACH, "title": "Insights", "small": f"From the last {days} days",
            "cards": [c for c in cards if not c["waiting"]] + [c for c in cards if c["waiting"]], "note": NOTE}


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
    cav = f'<p class="small icav">{esc(c["caveat"])}</p>' if c["caveat"] else ""
    return (f'<div class="card insight"><h2>{esc(c["title"])}<span class="dp">{c["chip"]}</span></h2>'
            f'<p class="isay">{said}</p>{_bars(c)}{cav}</div>')


def card(i: dict) -> str:
    return card_html(card_data(i))


def render(csrf: str) -> str:
    d = data()
    cards = "".join(card_html(c) for c in d["cards"])
    return (f'<div class="head"><h1>{d["title"]}</h1><span class="small">{d["small"]}</span></div>'
            f'<div class="grid2 insights">{cards}</div>'
            f'<p class="small hint">{d["note"]}</p>')

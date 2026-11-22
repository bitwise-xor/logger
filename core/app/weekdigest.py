"""The week's summary as a phone notification (web item 45, core item 17; 22.11.2026): once a week, on the first logging day of the
week the owner is up (nudges.due decides when), last week (Monday to Sunday) in one line, which opens the Week page for last week.
The numbers are the Week page's (weekpage: its days with food, its Food tiles, its weight and its Habits row), not a second set.
A notification shows on a locked screen, so the line has shares and changes only, never an absolute health value: the days with food,
calories and protein as a percent of the target, the weight's change over the week, the habits done."""
from datetime import date

from . import trendspage, weekpage

URL = "/web/week?p=last"  # logger.: /trends?p=last (nudges.LOGGER_LINKS)
KIND = "week-"  # + the Monday of the week summarised, e.g. week-20261116 (push_sent is per day: the kind names the week)


def kind(today: date) -> str:
    """The push_sent kind of the summary sent in today's week: named after last week's Monday."""
    return KIND + f"{weekpage.bounds('last', today)[0]:%Y%m%d}"


def _pct(tiles: list) -> str | None:
    have = [f"{label} {t['pct']:.0f} %" for t in tiles for key, label in (("kcal", "kcal"), ("protein", "protein"))
            if t["key"] == key and t["pct"] is not None]
    return ", ".join(have) + " of target" if have else None


def message(cur, today: date) -> dict | None:
    """Last week's summary as of the logging day today: {title, body, url}, or None when last week has no day with food (nothing to
    say; the caller still marks the week as done). Parts without data are left out."""
    start, end = weekpage.bounds("last", today)
    ndays = (end - start).days + 1
    totals = trendspage.day_totals(cur, start, end)
    if not totals:
        return None
    parts = [f"{len(totals)} of {ndays} days logged", _pct(weekpage.food_tiles(totals))]
    kg = weekpage.weights(cur, start, end)
    if len(kg) >= 2:
        ds = sorted(kg)
        parts.append("weight " + weekpage.kg_change(kg[ds[-1]] - kg[ds[0]]))
    habits = next((r for r in weekpage.health_rows(cur, start, end, ndays) if r["key"] == "habits"), None)
    if habits:
        parts.append("habits " + habits["value"].replace("%", " %"))
    return {"title": f"Last week · {start:%d.%m.} to {end:%d.%m.}", "body": " · ".join(p for p in parts if p), "url": URL}

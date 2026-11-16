"""The coaching on the web app (web item 52, 04.11.2026; mockup https://claude.ai/artifact/4z4HLimQeLi2jo4Z6ZX3ND): the Coach card on
Today (for the day shown), the Week review card on the Week page (for the period shown), the Coach page under More (every coaching,
newest first) and the "My goals" tab in Settings. While the coach reads, the card says so and app.js asks /web/coach/status every few
seconds and shows the result when it is there. The data and the AI call are in coach.py."""
from . import coach, rules
from .db import connect
from .webentry import esc, hidden, icon, key

CAUTION = "Comments only on what you logged; not medical advice."
WAIT = {"day": "Coaching… about 30 seconds", "week": "Reviewing… about 45 seconds"}


def _items(xs) -> list:
    return [str(x) for x in xs or [] if str(x).strip()]


def _part(key: str, title: str, items: list, style: str = "list", tone=None, meal=None, text=None) -> dict:
    return {"key": key, "title": title, "style": style, "tone": tone, "items": items, "meal": meal, "text": text}


def parts(row: dict, hidden: frozenset = frozenset()) -> list:
    """A finished coaching's sections as data (deploy 101: app. and the JSON door read the same), in app.'s order, without the parts
    switched off in Settings > Coach (also in older coachings) and without empty ones. Each: key (coach.PARTS' key), title (app.'s
    heading; the doctor note has none on app.), style ("list", "numbered" for the focus, "meal" for the next meal, "note" for the
    doctor note), tone (day coaching: "ok" for what went well, "warn" for what to improve), items (the lines), meal
    ({title, why, kcal, protein, carbs, fat, macros}: app.'s line of the four), text (the doctor note)."""
    off = {k for k, _ in coach.PARTS[row["kind"]] if f'{row["kind"]}:{k}' in hidden}
    fields = {f for k in off for f in coach.FIELDS.get(k, (k,))}
    b = {k: v for k, v in (row["body"] or {}).items() if k not in fields}
    out = []
    if row["kind"] == "day":
        meal = b.get("next_meal")
        for k, title, tone in (("went_well", "What went well", "ok"), ("improve", "To improve", "warn")):
            if _items(b.get(k)):
                out.append(_part(k, title, _items(b.get(k)), tone=tone))
        if meal:
            nums = {k: round(meal.get(k) or 0) for k in ("kcal", "protein", "carbs", "fat")}
            macros = " · ".join(f"{v} {u}" for v, u in ((nums["kcal"], "kcal"), (nums["protein"], "g protein"), (nums["carbs"], "g carbs"), (nums["fat"], "g fat")))
            out.append(_part("next_meal", "Next meal", [], "meal",
                             meal={"title": str(meal.get("title", "")), "why": str(meal.get("why", "")), **nums, "macros": macros}))
        if _items(b.get("gaps")):
            out.append(_part("gaps", "Missing in the log", _items(b.get("gaps"))))
    else:
        for k, title in (("targets", "Against your targets"), ("trends", "Trends"), ("habits", "Habits, gym and home")):
            if _items(b.get(k)):
                out.append(_part(k, title, _items(b.get(k))))
        days = [str(x) for x in (b.get("best_day"), b.get("hardest_day")) if x]
        if days:
            out.append(_part("days", "Best and hardest day", days))
        if _items(b.get("focus")):
            out.append(_part("focus", "Focus for next week", _items(b.get("focus")), "numbered"))
    if b.get("doctor"):
        out.append(_part("doctor", "Doctor note", [], "note", text=str(b["doctor"])))
    return out


def _li(xs: list) -> str:
    return "".join(f"<li>{esc(x)}</li>" for x in xs)


def _part_html(p: dict) -> str:
    if p["style"] == "meal":
        m = p["meal"]
        return (f'<div class="comeal"><div class="small">Next meal</div><b>{esc(m["title"])}</b>'
                f'<div>{esc(m["macros"])}</div><div class="small">{esc(m["why"])}</div></div>')
    if p["style"] == "numbered":
        return f'<div class="comeal"><div class="small">{p["title"]}</div><ol>{_li(p["items"])}</ol></div>'
    if p["style"] == "note":
        return f'<p class="small">{esc(p["text"])}</p>'
    attr = f' class="{p["tone"]}"' if p["tone"] else ""
    return f'<div class="cosec"><h3{attr}>{esc(p["title"])}</h3><ul>{_li(p["items"])}</ul></div>'


def body_html(row: dict, hidden: frozenset = frozenset()) -> str:
    """A finished coaching's sections, without the parts switched off in Settings > Coach (also in older coachings)."""
    return "".join(_part_html(p) for p in parts(row, hidden)) + f'<p class="small">{CAUTION}</p>'


def _meta(row: dict) -> str:
    at = (row["finished_at"] or row["created_at"]).astimezone(rules.BERLIN)
    usd = f' · ${float(row["usd"]):.2f}' if row["usd"] is not None else ""
    return f'Claude Opus{usd} · {at:%d.%m. %H:%M}'


def meta(row: dict) -> dict:
    """The line under a finished coaching as data: model (app.'s "Claude Opus"), usd (null when not known), at (finished, or
    started), at_text ("16.11. 14:05") and app.'s whole line."""
    at = (row["finished_at"] or row["created_at"]).astimezone(rules.BERLIN)
    return {"model": "Claude Opus", "usd": float(row["usd"]) if row["usd"] is not None else None, "at": at,
            "at_text": f"{at:%d.%m. %H:%M}", "text": _meta(row)}


def _button(kind: str, a, b, csrf: str, back: str, label: str, primary: bool) -> str:
    return (f'<form method="post" action="/web/coach/start">{hidden("csrf", csrf)}{hidden("key", key())}{hidden("kind", kind)}'
            f'{hidden("start", a.isoformat())}{hidden("end", b.isoformat())}{hidden("back", back)}'
            f'<button class="{"primary" if primary else "ghost"}" type="submit">{label}</button></form>')


WAIT_NOTE = "You can leave this page: the coaching is kept and shows here when it is ready."
INTRO = {"day": "A short look at this day: what went well, what to improve, your next meal and what is missing in the log.",
         "week": "The period against your targets and goals: trends, habits, gym and home, best and hardest day, "
                 "and one or two things to focus on next."}
COST = {"day": "about 30 seconds · about 6 cents", "week": "about 45 seconds · about 20 cents"}
LINKS = [{"label": "All coachings", "href": "/web/coach"}, {"label": "Your goals", "href": "/web/settings?tab=coach"}]


def card_data(kind: str, a, b, first_label: str = "") -> dict:
    """The Coach card (day) or the Week review card (week) of one period as data (deploy 101: app.'s card and the JSON door read the
    same). state: "none" (never asked), "working" (the coach reads; poll coach.status with id), "done" (parts, meta, caution;
    the button asks again), "failed" (failed, or "working" for longer than coach.STALE_MINUTES: cut off; app.'s words in failed,
    and the first button again). With app.'s words for each: wait and wait_note, button, intro, cost, links."""
    with connect() as conn, conn.cursor() as cur:
        row = coach.latest(cur, kind, a, b)
        hidden = frozenset(coach.prefs(cur)["hidden"])
    out = {"kind": kind, "start": a, "end": b, "title": "Coach" if kind == "day" else "Week review",
           "small": f'{"this day" if kind == "day" else "this period"} · on demand', "state": "none", "id": row["id"] if row else None,
           "wait": None, "wait_note": None, "parts": [], "caution": None, "meta": None, "failed": None, "intro": None, "cost": None,
           "button": first_label or ("Coach me" if kind == "day" else "Review this week"), "links": LINKS}
    if row and row["status"] == "working" and not row["stale"]:
        out.update(state="working", wait=WAIT[kind], wait_note=WAIT_NOTE, button=None)
    elif row and row["status"] == "done":
        out.update(state="done", parts=parts(row, hidden), caution=CAUTION, meta=meta(row), button="Coach me again" if kind == "day" else "Review again")
    else:
        if row:
            out.update(state="failed", failed=f'That did not work ({"cut off" if row["stale"] else row["error"] or "an error"}); nothing was charged '
                                              'if the AI did not answer. Try again.')
        out.update(intro=INTRO[kind], cost=COST[kind])
    return out


def card_html(c: dict, csrf: str, back: str) -> str:
    kind, a, b = c["kind"], c["start"], c["end"]
    links = "".join(f'<a href="{x["href"]}">{x["label"]} ›</a>' for x in c["links"])
    if c["state"] == "working":
        inner = (f'<div class="cowait" data-coach-wait="{c["id"]}" role="status"><b>{c["wait"]}</b>'
                 f'<span class="small">{c["wait_note"]}</span></div>')
    elif c["state"] == "done":
        inner = ("".join(_part_html(p) for p in c["parts"]) + f'<p class="small">{c["caution"]}</p>'
                 f'<div class="cofoot"><span class="small">{esc(c["meta"]["text"])}</span>{_button(kind, a, b, csrf, back, c["button"], False)}</div>')
    else:
        failed = f'<p class="notice">{esc(c["failed"])}</p>' if c["failed"] else ""
        inner = f'{failed}<p>{c["intro"]}</p>{_button(kind, a, b, csrf, back, c["button"], True)}<p class="small coc">{c["cost"]}</p>'
    return (f'<div class="card coachcard"><h2><span>{icon("coach")}{c["title"]}</span>'
            f'<span class="small">{c["small"]}</span></h2>{inner}<p class="row small">{links}</p></div>')


def card(kind: str, a, b, csrf: str, back: str, first_label: str = "") -> str:
    """The Coach card (day) or the Week review card (week) for one period."""
    return card_html(card_data(kind, a, b, first_label), csrf, back)


def today_card(day, csrf: str) -> str:
    return card("day", day, day, csrf, f"/web/?day={day.isoformat()}")


REVIEWED = ("last", "this")  # the Week page's periods that are a Monday-to-Sunday week (or its days so far): a review is offered
FIRST = {"last": "Review last week", "this": "Review this week so far"}
BLURB = "The review looks at one week from Monday to Sunday."


def week_review(a, b, p: str) -> dict:
    """The Week review card of the Week page as data (deploy 101): offered for last week and this week so far (card_data's keys,
    the period a to b); for the rolling 7 and 30 days not offered: app.'s blurb, links to the two weeks and the latest finished
    review's period (latest, null when there is none). Every key is there in both cases (null when it does not apply)."""
    if p in REVIEWED:
        return {"offered": True, **card_data("week", a, b, FIRST[p]), "blurb": None, "latest": None, "weeks": None}
    with connect() as conn, conn.cursor() as cur:
        cur.execute("SELECT start_day, end_day FROM coachings WHERE kind = 'week' AND status = 'done' ORDER BY id DESC LIMIT 1")
        r = cur.fetchone()
    latest = {"start": r["start_day"], "end": r["end_day"], "text": f'Latest review: {r["start_day"]:%d.%m.} to {r["end_day"]:%d.%m.}'} if r else None
    return {"offered": False, "kind": "week", "start": None, "end": None, "title": "Week review", "small": "Monday to Sunday", "state": None,
            "id": None, "wait": None, "wait_note": None, "parts": [], "caution": None, "meta": None, "failed": None, "intro": None,
            "cost": None, "button": None, "links": [], "blurb": BLURB, "latest": latest,
            "weeks": [{"p": "last", "label": "Last week"}, {"p": "this", "label": "This week so far"}]}


def week_html(c: dict, p: str, csrf: str) -> str:
    if c["offered"]:
        return card_html(c, csrf, f"/web/week?p={p}")
    latest = f'<a href="/web/coach?f=weeks">{c["latest"]["text"]} ›</a>' if c["latest"] else ""
    weeks = "".join(f'<a class="ghost sm" href="/web/week?p={w["p"]}">{w["label"]}</a>' for w in c["weeks"])
    return (f'<div class="card coachcard"><h2><span>{icon("coach")}{c["title"]}</span><span class="small">{c["small"]}</span></h2>'
            f'<p>{c["blurb"]}</p><p class="row">{weeks}{latest}</p></div>')


def week_card(a, b, p: str, csrf: str) -> str:
    """The review is for a Monday-to-Sunday week (04.11.2026): a rolling 7 or 30 days found no review the next day, and the
    button said "this week" over 30 days. Those periods link to the week and to the latest review instead."""
    return week_html(week_review(a, b, p), p, csrf)


FILTERS = (("all", "All"), ("days", "Days"), ("weeks", "Weeks"))


def _first(row: dict) -> str:
    b = row["body"] or {}
    xs = (b.get("improve") or b.get("went_well") or []) if row["kind"] == "day" else (b.get("focus") or b.get("trends") or [])
    return xs[0] if xs else ""


def render(csrf: str, q=None) -> str:
    """The Coach page: every finished coaching, newest first, each opening in place."""
    f = (q or {}).get("f") if (q or {}).get("f") in dict(FILTERS) else "all"
    kinds = {"all": ["day", "week"], "days": ["day"], "weeks": ["week"]}[f]
    with connect() as conn, conn.cursor() as cur:
        cur.execute("""SELECT * FROM coachings WHERE status = 'done' AND kind = ANY(%s) ORDER BY created_at DESC LIMIT 100""", (kinds,))
        rows = cur.fetchall()
        cur.execute("""SELECT count(*) AS n, coalesce(sum(usd), 0) AS usd FROM coachings
                       WHERE status = 'done' AND date_trunc('month', created_at AT TIME ZONE 'Europe/Berlin') = date_trunc('month', now() AT TIME ZONE 'Europe/Berlin')""")
        month = cur.fetchone()
        hidden = frozenset(coach.prefs(cur)["hidden"])
    chips = "".join(f'<a href="/web/coach?f={k}"' + (' aria-current="page"' if k == f else "") + f">{lbl}</a>" for k, lbl in FILTERS)
    items = []
    for r in rows:
        when = f'{r["start_day"]:%a %d.%m.}' if r["kind"] == "day" else f'Week {r["start_day"]:%d.%m.} to {r["end_day"]:%d.%m.}'
        items.append(f'<details class="coitem"><summary><span class="row"><b>{esc(when)}</b><span class="pill ok">{r["kind"]}</span></span>'
                     f'<span>{esc(_first(r))}</span><span class="small">{esc(_meta(r))}</span></summary>{body_html(r, hidden)}</details>')
    body = "".join(items) or '<p class="empty">No coachings yet. Press "Coach me" on Today or "Review this week" on the Week page.</p>'
    return (f'<div class="head"><h1>Coach</h1><nav class="seg" aria-label="Coachings">{chips}</nav></div>'
            f'<div class="card">{body}</div>'
            f'<p class="small">Every coaching is kept; "Coach me again" adds a new one. This month: {month["n"]} coaching'
            f'{"" if month["n"] == 1 else "s"} · ${float(month["usd"]):.2f} (also on the Usage page).</p>')


def settings_tab(session, csrf: str) -> str:
    """Settings > Coach: the owner's goals, how to coach and which parts each coaching shows; the coach reads them every time."""
    with connect() as conn, conn.cursor() as cur:
        p = coach.prefs(cur)
    boxes = "".join(
        f'<fieldset class="coparts"><legend>{"Day coaching (Today)" if kind == "day" else "Week review (Week page)"}</legend>'
        + "".join(f'<label class="row"><input type="checkbox" name="show_{kind}_{k}" value="1"{"" if f"{kind}:{k}" in p["hidden"] else " checked"}> {esc(lbl)}</label>'
                  for k, lbl in parts) + "</fieldset>" for kind, parts in coach.PARTS.items())
    return (f'<form method="post" action="/web/settings/coach_goals">{hidden("csrf", csrf)}{hidden("back", "/web/settings?tab=coach")}{hidden("parts", "1")}'
            '<div class="card"><h2>My goals</h2><p class="small">The coach reads this every time. Empty: it coaches against your food targets only.</p>'
            f'<label for="coach-goals">Your goals, in your own words</label>'
            f'<textarea id="coach-goals" class="wide" name="goals" rows="5" maxlength="{coach.GOALS_MAX}" '
            f'placeholder="For example: lose 5 kg by March; fasting sugar under 100; three gym sessions a week.">{esc(p["goals"])}</textarea></div>'
            '<div class="card"><h2>How to coach me</h2><p class="small">Tone, length, focus, what to leave out: the coach follows this over its own defaults '
            '(it still uses only what you logged and never gives medical advice).</p>'
            '<label for="coach-style">How you want to be coached</label>'
            f'<textarea id="coach-style" class="wide" name="style" rows="5" maxlength="{coach.GOALS_MAX}" '
            'placeholder="For example: keep it short, two points at most; I eat late on purpose, do not suggest eating earlier; focus on fasting sugar and fat; '
            f'suggest meals only from foods I already eat.">{esc(p["style"])}</textarea></div>'
            '<div class="card"><h2>What each coaching shows</h2><p class="small">A part switched off is not asked for (a little cheaper) and not shown.</p>'
            f'<div class="coparts-wrap">{boxes}</div></div>'
            '<p class="row"><button class="primary" type="submit">Save</button></p></form>'
            '<div class="card"><h2>How the coach works</h2><ul class="small">'
            '<li>Only when you press Coach me (Today) or Review this week (Week page).</li>'
            '<li>Reads food, health values, sleep, habits, gym and home; never thoughts, private or gratitude entries.</li>'
            f'<li>Claude Opus 5.5; about 6 cents a day coaching, about 20 cents a week review; at most {coach.DAILY_LIMIT} a day.</li>'
            '<li>Every coaching is kept on the Coach page (under More); its cost is on the Usage page.</li></ul></div>')

"""The web app's Medical page: the reports (each opening with its values, ranges and flags; H and L in amber,
A in red, decided 26.10.2026; A in amber too since 15.11.2026), the values flagged in the newest lab report, one test over time with its reference range
as a band, and the medication courses. All reports are shown, 2014 included (decided 26.10.). Values are written the
way the logger prints them (v1's own helpers). Corrections post to weblabs.py; this module only reads."""
import json
import re
from urllib.parse import urlencode

from .db import connect
from .v1_commands import _lnum, _ref_text, _val_text
from .webentry import esc, hidden

BACK = re.compile(r"/web/labs(/tests|/meds)?(\?[A-Za-z0-9=&._%-]*)?")
FLAGS = {"H": "high", "L": "low", "A": "abnormal"}


def url(path: str = "/web/labs", **q) -> str:
    q = {k: v for k, v in q.items() if v not in (None, "", False)}
    return path + ("?" + urlencode(q) if q else "")


def safe_back(b) -> str:
    b = str(b or "")
    return b if BACK.fullmatch(b) else "/web/labs"


def printed(r: dict) -> tuple[str, str, str]:
    """A value, its unit and its range as they were printed (what a correction starts from)."""
    value = ((r["qualifier"] or "") + r["value_raw"]) if r["value_raw"] is not None else (r["value_text"] or _lnum(r["value"]))
    unit = r["unit_raw"] if r["unit_raw"] is not None else (r["unit"] or "")
    return value, unit or "", r["ref_range_raw"] or ""


def _flag(f) -> str:
    return f'<span class="flag {f}" title="{FLAGS[f]}">{f}</span>' if f in FLAGS else '<span class="small">–</span>'


def _tabs(on: str) -> str:
    tabs = (("reports", "/web/labs", "Reports"), ("tests", "/web/labs/tests", "Tests over time"), ("meds", "/web/labs/meds", "Medication"))
    return ('<div class="head"><h1>Medical</h1><nav class="seg" aria-label="Medical">'
            + "".join(f'<a href="{h}"{' aria-current="page"' if k == on else ""}>{lbl}</a>' for k, h, lbl in tabs) + "</nav></div>")


RESULT_COLS = """v.id, v.report_id, v.test_id, t.name AS test, v.value, v.unit, v.value_text, v.value_raw, v.unit_raw, v.qualifier,
                 v.ref_low, v.ref_high, v.ref_range_raw, v.flag, v.note, v.body_site, v.side"""


def _site(r: dict) -> str:
    return " ".join(x for x in (r["side"], r["body_site"]) if x)


# ---- the facts, with app.'s words (deploy 104: shared by app.'s three pages and the JSON door, reads.labs, labs_tests, labs_meds) ----

FLAGGED_HINT = "Click one to see it over time. H high, L low and A abnormal in amber."
NOTHING_FLAGGED = "Nothing flagged."
NO_REPORTS = "No reports yet."
NO_VALUES = "No values in this report."
REPORTS_HINT = ("New reports come in through the chat (photo or PDF). Click a report to see its values; the pencil corrects one "
                "(shown first, then Yes).")
VALUE_HINT = "You see the change first, then Yes. The logger converts the unit and sets the flag again."
REPORT_HINT = "You see the change first, then Yes."
TESTS_PLACEHOLDER = "Search a test: ldl, vitamin d, hba1c"
TESTS_WORTH = "Tests with values on three or more days:"
NO_TEST = "No test with that name. Try another word."
ONE_DAY = "All values are from one day (different sites); see them below. The chart starts with a second day."
ONE_VALUE = "Only one value so far; the chart starts with the second."
BAND = "reference range (from the newest value)"
OUTSIDE = "outside the range"
NO_LINE = " · several values on one day (different sites), so dots without a line"
NO_MEDS = "No medication recorded."
MEDS_HINT = ('A new course is a sentence in the box above ("started vitamin D 1000 IU daily"), read back before it is saved, '
             'as in the chat.')
MED_HINT = "You see the change first, then Yes."
# The limits of the forms (the inputs' maxlength; weblabs cuts at the same)
LIMITS = {"value_max": 60, "unit_max": 30, "ref_max": 60, "title_max": 200, "provider_max": 200, "notes_max": 2000}
MED_LIMITS = {"dose_max": 60, "frequency_max": 60, "indication_max": 120}
LIST_MAX = 30  # tests listed or matched


def report_values(cur, rid: int) -> list:
    cur.execute(f"SELECT {RESULT_COLS} FROM lab_results v JOIN lab_tests t ON t.id = v.test_id WHERE v.report_id = %s ORDER BY v.id", (rid,))
    return cur.fetchall()


def reports_data(open_: str = "", cur=None) -> dict:
    """The Reports tab: every report newest first with its count of values and of flagged ones, the newest lab report and its
    flagged values (by test name), the report open (open = "R<id>", as app.'s ?open=; None when it is not one of them) with its
    values, and app.'s words."""
    if cur is None:
        with connect() as conn, conn.cursor() as c:
            return reports_data(open_, c)
    cur.execute("""SELECT p.id, p.collected_date, p.title, p.provider, p.report_type, p.notes, count(v.id) AS n,
                          count(v.id) FILTER (WHERE v.flag IN ('H','L','A')) AS flagged
                   FROM lab_reports p LEFT JOIN lab_results v ON v.report_id = p.id
                   GROUP BY p.id ORDER BY p.collected_date DESC, p.id DESC""")
    reports = cur.fetchall()
    newest = next((p for p in reports if p["report_type"] == "lab"), None)
    flagged = []
    if newest:
        cur.execute(f"""SELECT {RESULT_COLS} FROM lab_results v JOIN lab_tests t ON t.id = v.test_id
                        WHERE v.report_id = %s AND v.flag IN ('H','L','A') ORDER BY t.name""", (newest["id"],))
        flagged = cur.fetchall()
    shown = next((p for p in reports if f"R{p['id']}" == open_), None)
    return {"reports": reports, "newest": newest, "flagged": flagged, "open": shown,
            "values": report_values(cur, shown["id"]) if shown else []}


# ---- reports ---------------------------------------------------------------------------------------

def _value_panel(csrf: str, r: dict, back: str) -> str:
    value, unit, ref = printed(r)
    return (f'<tr class="panel"><td colspan="5"><form class="fbox" method="post" action="/web/labs/value">{hidden("csrf", csrf)}'
            f'{hidden("id", "V" + str(r["id"]))}{hidden("back", back)}<div class="fields">'
            f'<label>Value as printed<input name="value" value="{esc(value)}" maxlength="60" required></label>'
            f'<label>Unit<input name="unit" value="{esc(unit)}" maxlength="30"></label>'
            f'<label>Range as printed<input name="ref" value="{esc(ref)}" maxlength="60" placeholder="e.g. 30-100 or <116"></label></div>'
            f'<p class="row"><button class="primary sm" type="submit">Save</button><a class="ghost sm dim" href="{esc(back)}">Cancel</a>'
            '<span class="small">You see the change first, then Yes. The logger converts the unit and sets the flag again.</span></p></form></td></tr>')


def _report_panel(csrf: str, p: dict, values: list, edit: str, edit_report: bool, back: str) -> str:
    rows = []
    for r in values:
        vid = f"V{r['id']}"
        trend = url("/web/labs/tests", t=str(r["test_id"]))
        rows.append(f'<tr class="{"out " if r["flag"] in FLAGS else ""}{"sel" if edit == vid else ""}" id="{vid}">'
                    f'<td><a href="{esc(trend)}" title="Over time">{esc(r["test"])}</a>'
                    + (f'<span class="notel">{esc(r["note"])}</span>' if r["note"] else "") + "</td>"
                    f'<td class="v">{esc(_val_text(r))}</td><td>{esc(_ref_text(r["ref_low"], r["ref_high"]))}</td><td>{_flag(r["flag"])}</td>'
                    f'<td><a class="icon" href="{esc(url("/web/labs", open=f"R{p["id"]}", edit="" if edit == vid else vid))}#{vid}" '
                    'title="Correct this value" aria-label="Correct">&#9998;</a></td></tr>')
        if edit == vid:
            rows.append(_value_panel(csrf, r, back))
    table = ('<div class="tablewrap"><table class="ft"><thead><tr><th>Test</th><th>Value</th><th>Range</th><th>Flag</th><th></th></tr></thead>'
             f'<tbody>{"".join(rows)}</tbody></table></div>') if rows else f'<p class="empty">{NO_VALUES}</p>'
    notes = f'<p class="find">{esc(p["notes"])}</p>' if p["notes"] else ""
    rlink = url("/web/labs", open=f"R{p['id']}", report="" if edit_report else "1")
    form = ""
    if edit_report:
        form = (f'<form class="fbox" method="post" action="/web/labs/report">{hidden("csrf", csrf)}{hidden("id", "R" + str(p["id"]))}{hidden("back", back)}'
                f'<div class="fields"><label>Date<input type="date" name="collected" value="{p["collected_date"].isoformat()}"></label>'
                f'<label>Title<input name="title" value="{esc(p["title"] or "")}" maxlength="{LIMITS["title_max"]}"></label>'
                f'<label>From<input name="provider" value="{esc(p["provider"] or "")}" maxlength="{LIMITS["provider_max"]}"></label></div>'
                f'<div class="fields wide"><label>Notes<textarea name="notes" rows="2" maxlength="{LIMITS["notes_max"]}">{esc(p["notes"] or "")}</textarea></label></div>'
                f'<p class="row"><button class="primary sm" type="submit">Save</button><a class="ghost sm dim" href="{esc(url("/web/labs", open=f"R{p['id']}"))}">Cancel</a>'
                f'<span class="small">{REPORT_HINT}</span></p></form>')
    return (f'<tr class="panel"><td colspan="6">{table}{notes}<p class="row"><a class="ghost sm" href="{esc(rlink)}#R{p["id"]}">Change date, title or notes</a></p>'
            f'{form}</td></tr>')


def render_reports(csrf: str, q) -> str:
    open_, edit = str(q.get("open", ""))[:12], str(q.get("edit", ""))[:12]
    back = url("/web/labs", open=open_)
    d = reports_data(open_)
    rows = []
    for p in d["reports"]:
        rid = f"R{p['id']}"
        is_open = d["open"] is not None and d["open"]["id"] == p["id"]
        link = url("/web/labs", open="" if is_open else rid)
        rows.append(f'<tr class="click{" sel" if is_open else ""}" id="{rid}"><td><a href="{esc(link)}#{rid}">{p["collected_date"]:%d.%m.%Y}</a></td>'
                    f'<td class="l"><a href="{esc(link)}#{rid}">{esc(p["title"] or "Report")}</a></td><td class="l"><span class="pill">{esc(p["report_type"])}</span></td>'
                    f'<td class="l hide-sm">{esc(p["provider"] or "")}</td><td>{p["n"] or "–"}</td>'
                    f'<td>{f"<span class=\"flag H\">{p['flagged']}</span>" if p["flagged"] else "–"}</td></tr>')
        if is_open:
            rows.append(_report_panel(csrf, p, d["values"], edit, q.get("report") == "1", back))
    newest = d["newest"]
    chips = "".join(f'<a class="fl" href="{esc(url("/web/labs/tests", t=str(r["test_id"])))}">{_flag(r["flag"])} {esc(r["test"])} '
                    f'<b>{esc(_val_text(r))}</b> <span class="small">range {esc(_ref_text(r["ref_low"], r["ref_high"]))}</span></a>' for r in d["flagged"])
    top = (f'<div class="card"><h2>Flagged in your newest report <span class="small">{newest["collected_date"]:%d.%m.%Y}</span></h2>'
           f'<div class="flagged">{chips or f"<span class=empty>{NOTHING_FLAGGED}</span>"}</div>'
           f'<p class="small hint">{FLAGGED_HINT}</p></div>') if newest else ""
    table = ('<div class="card"><div class="tablewrap"><table class="ft"><thead><tr><th>Date</th><th class="l">Report</th><th class="l">Kind</th>'
             '<th class="l hide-sm">From</th><th>Values</th><th>Flagged</th></tr></thead>'
             f'<tbody>{"".join(rows) or f"<tr><td colspan=6 class=empty>{NO_REPORTS}</td></tr>"}</tbody></table></div>'
             f'<p class="small hint">{REPORTS_HINT}</p></div>')
    return _tabs("reports") + top + table


# ---- one test over time ----------------------------------------------------------------------------

def test_chart(test: dict, rows: list) -> dict:
    """One test's chart as app. draws it, in the Health page's card shape ({id, title, small, stat, chart, legend}; chart = app.'s
    data-chart object: the reference band from the newest value, a dot per value coloured by its flag (a amber-free, w H or L,
    r A) with the tooltip words, a line when there is one value a day), or chart None and app.'s thin-case words in note."""
    nums = [r for r in rows if r["value"] is not None]
    last = rows[-1] if rows else None
    band = [float(last["ref_low"]) if last and last["ref_low"] is not None else None,
            float(last["ref_high"]) if last and last["ref_high"] is not None else None] if last else None
    card = {"id": "test", "title": test["name"], "small": f"{len(rows)} values", "stat": [], "chart": None, "legend": [], "note": None}
    dates = sorted({r["collected_date"] for r in nums})
    if len(dates) >= 2:
        first = dates[0]
        one_per_day = len(dates) == len(nums)
        site = lambda r: f" ({_site(r)})" if _site(r) else ""  # noqa: E731
        pt = lambda r: [(r["collected_date"] - first).days, float(r["value"]), f'{r["collected_date"]:%d.%m.%Y}: {_val_text(r)}{site(r)}']  # noqa: E731
        dots = [{"mark": "dot", "cls": "a", "pts": [pt(r) for r in nums if r["flag"] not in FLAGS]},
                {"mark": "dot", "cls": "w", "pts": [pt(r) for r in nums if r["flag"] in ("H", "L")]},
                {"mark": "dot", "cls": "r", "pts": [pt(r) for r in nums if r["flag"] == "A"]}]
        card["chart"] = {"start": first.isoformat(), "days": (dates[-1] - first).days + 1, "label": f'{test["name"]} over time', "years": True,
                         "band": band if band and any(b is not None for b in band) else None,
                         "series": ([{"mark": "line", "cls": "a", "pts": [pt(r) for r in nums]}] if one_per_day else []) + dots}
        card["legend"] = [{"key": "sq band", "text": BAND}, {"key": "w", "text": OUTSIDE + ("" if one_per_day else NO_LINE)}]
    elif len(nums) > 1:
        card["note"] = ONE_DAY
    elif nums:
        card["note"] = ONE_VALUE
    return card


def tests_data(text: str = "", tid: str = "", cur=None) -> dict:
    """The Tests over time tab: q (cut at 60, trimmed) and t (a test's id as text) as app.'s ?q= and ?t=. Without a test: the
    tests worth a chart (numbers on three or more days) or the matches of q (name or word), at most 30 each with their count of
    values; one match opens it. With a test: its values oldest first and its chart card (test_chart)."""
    if cur is None:
        with connect() as conn, conn.cursor() as c:
            return tests_data(text, tid, c)
    text, tid = str(text or "")[:60].strip(), str(tid or "")
    test = None
    if tid.isdigit():
        cur.execute("SELECT id, name, unit FROM lab_tests WHERE id = %s", (int(tid),))
        test = cur.fetchone()
    matches = []
    if text and not test:
        cur.execute("""SELECT t.id, t.name, t.unit, count(v.id) AS n FROM lab_tests t JOIN lab_results v ON v.test_id = t.id
                       WHERE t.name ILIKE %s OR EXISTS (SELECT 1 FROM unnest(t.aliases) a WHERE a ILIKE %s)
                       GROUP BY t.id ORDER BY count(v.id) DESC, t.name LIMIT 30""", (f"%{text}%", f"%{text}%"))
        matches = cur.fetchall()
        if len(matches) == 1:
            test = matches[0]
    if not test and not text:  # the tests worth a chart: numbers on three or more days
        cur.execute("""SELECT t.id, t.name, t.unit, count(v.id) AS n FROM lab_tests t JOIN lab_results v ON v.test_id = t.id
                       JOIN lab_reports p ON p.id = v.report_id WHERE v.value IS NOT NULL
                       GROUP BY t.id HAVING count(DISTINCT p.collected_date) >= 3 ORDER BY count(v.id) DESC, t.name LIMIT 30""")
        matches = cur.fetchall()
    rows = []
    if test:
        cur.execute(f"""SELECT {RESULT_COLS}, p.collected_date FROM lab_results v JOIN lab_tests t ON t.id = v.test_id
                        JOIN lab_reports p ON p.id = v.report_id WHERE v.test_id = %s ORDER BY p.collected_date, v.id""", (test["id"],))
        rows = cur.fetchall()
    listed = bool(matches) and not test
    return {"q": text, "test": test, "matches": matches if listed else [],
            "title": TESTS_WORTH if listed and not text else None,
            "empty": NO_TEST if text and not test and not matches else None,
            "rows": rows, "card": test_chart(test, rows) if test else None}


def render_tests(csrf: str, q) -> str:
    d = tests_data(q.get("q", ""), q.get("t", ""))
    text, test, rows = d["q"], d["test"], d["rows"]
    search = (f'<form class="row" method="get" action="/web/labs/tests"><input type="search" name="q" value="{esc(text)}" class="grow" '
              f'placeholder="{TESTS_PLACEHOLDER}" aria-label="Search a test"><button class="ghost sm" type="submit">Search</button></form>')
    pick = ""
    if d["matches"]:
        pick = ('<p class="chips">' + "".join(f'<a class="chip" href="{esc(url("/web/labs/tests", t=str(m["id"])))}">{esc(m["name"])} '
                                             f'<span class="small">{m["n"]}</span></a>' for m in d["matches"]) + "</p>")
        if d["title"]:
            pick = f'<p class="small">{d["title"]}</p>' + pick
    elif d["empty"]:
        pick = f'<p class="empty">{d["empty"]}</p>'
    body = ""
    if test:
        c = d["card"]
        chart = ""
        if c["chart"]:
            chart = (f'<div class="chart" id="c-test" data-chart="{esc(json.dumps(c["chart"], separators=(",", ":")))}"></div>'
                     '<p class="legend">' + " ".join(f'<i class="key {k["key"]}"></i>{k["text"]}' for k in c["legend"]) + "</p>")
        elif c["note"]:
            chart = f'<p class="small">{c["note"]}</p>'
        table = "".join(f'<tr class="{"out" if r["flag"] in FLAGS else ""}"><td>{r["collected_date"]:%d.%m.%Y}'
                        + (f'<span class="notel">{esc(_site(r))}</span>' if _site(r) else "") + f'</td><td class="v">{esc(_val_text(r))}</td>'
                        f'<td>{esc(_ref_text(r["ref_low"], r["ref_high"]))}</td><td>{_flag(r["flag"])}</td>'
                        f'<td class="l"><a href="{esc(url("/web/labs", open=f"R{r["report_id"]}"))}#R{r["report_id"]}">R{r["report_id"]}</a></td></tr>'
                        for r in reversed(rows))
        body = (f'<div class="card"><h2>{esc(c["title"])} <span class="small">{c["small"]}</span></h2>{chart}</div>'
                '<div class="card"><div class="tablewrap"><table class="ft"><thead><tr><th>Date</th><th>Value</th><th>Range</th><th>Flag</th>'
                f'<th class="l">Report</th></tr></thead><tbody>{table}</tbody></table></div></div>')
    return _tabs("tests") + f'<div class="card">{search}{pick}</div>' + body


# ---- medication ------------------------------------------------------------------------------------

def meds_data(cur=None) -> dict:
    """The Medication tab: every course (running ones first, then by start, newest first; a stop date after today is still
    running), today, and the count of running courses."""
    if cur is None:
        with connect() as conn, conn.cursor() as c:
            return meds_data(c)
    cur.execute("SELECT log_day(now()) AS d")
    today = cur.fetchone()["d"]
    cur.execute("""SELECT * FROM medications ORDER BY (stop_date IS NOT NULL AND stop_date < log_day(now())), start_date DESC NULLS LAST, id DESC""")
    meds = [{**m, "running": m["stop_date"] is None or m["stop_date"] >= today} for m in cur.fetchall()]
    return {"today": today, "meds": meds, "running": sum(1 for m in meds if m["running"])}


def render_meds(csrf: str, q) -> str:
    edit = str(q.get("edit", ""))[:12]
    d = meds_data()
    rows = []
    for m in d["meds"]:
        did = f"D{m['id']}"
        running = m["running"]
        base = hidden("csrf", csrf) + hidden("id", did) + hidden("back", "/web/labs/meds")
        end = ("" if not running or m["stop_date"] else
               f'<form method="post" action="/web/labs/med">{base}{hidden("act", "end")}<button class="ghost sm" type="submit">End</button></form>')
        rows.append(f'<tr class="{"sel" if edit == did else ""}" id="{did}"><td class="l"><b>{esc(m["name"])}</b>'
                    + (f'<span class="notel">{esc(m["ingredient"])}</span>' if m["ingredient"] else "") + "</td>"
                    f'<td class="l">{esc(m["dose"] or "–")}</td><td class="l">{esc(m["frequency"] or "–")}</td><td class="l hide-sm">{esc(m["indication"] or "–")}</td>'
                    f'<td>{m["start_date"].strftime("%d.%m.%Y") if m["start_date"] else "–"}</td>'
                    f'<td>{m["stop_date"].strftime("%d.%m.%Y") if m["stop_date"] else "<span class=med-run>running</span>"}</td>'
                    f'<td><span class="row end"><a class="icon" href="{esc(url("/web/labs/meds", edit="" if edit == did else did))}#{did}" '
                    f'title="Change" aria-label="Change">&#9998;</a>{end}</span></td></tr>')
        if edit == did:
            rows.append(f'<tr class="panel"><td colspan="7"><form class="fbox" method="post" action="/web/labs/med">{base}{hidden("act", "save")}<div class="fields">'
                        f'<label>Dose<input name="dose" value="{esc(m["dose"] or "")}" maxlength="{MED_LIMITS["dose_max"]}"></label>'
                        f'<label>How often<input name="frequency" value="{esc(m["frequency"] or "")}" maxlength="{MED_LIMITS["frequency_max"]}"></label>'
                        f'<label>Why<input name="indication" value="{esc(m["indication"] or "")}" maxlength="{MED_LIMITS["indication_max"]}"></label>'
                        f'<label>Start<input type="date" name="start" value="{m["start_date"].isoformat() if m["start_date"] else ""}"></label>'
                        f'<label><span>Stop <span class="small">(empty = running)</span></span><input type="date" name="stop" value="{m["stop_date"].isoformat() if m["stop_date"] else ""}"></label></div>'
                        '<p class="row"><button class="primary sm" type="submit">Save</button><a class="ghost sm dim" href="/web/labs/meds">Cancel</a>'
                        f'<span class="small">{MED_HINT}</span></p></form></td></tr>')
    return (_tabs("meds") + f'<div class="card"><h2>Medication <span class="small">{d["running"]} running</span></h2>'
            '<div class="tablewrap"><table class="ft"><thead><tr><th class="l">Name</th><th class="l">Dose</th><th class="l">How often</th>'
            '<th class="l hide-sm">Why</th><th>Start</th><th>Stop</th><th></th></tr></thead>'
            f'<tbody>{"".join(rows) or f"<tr><td colspan=7 class=empty>{NO_MEDS}</td></tr>"}</tbody></table></div>'
            f'<p class="small hint">{MEDS_HINT}</p></div>')

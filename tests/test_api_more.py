"""The JSON door's More pages (deploy 107, 17.11.2026; step 6 of the move to logger.): GET /api/v1/search, /recent and /usage, each
through app.'s own function (searchpage.results, recentpage.load and messages, usagepage.data: app.'s pages draw from the same), and
GET /gym/history?w= (an older workout's card for a search result). Search never answers thoughts; Recent and Usage never a private or
gratitude entry's words. Every food, message, number and sentence is invented."""
import html
import json
import re
from datetime import timedelta

import pytest

from app import recentpage, searchpage, usagepage
from conftest import owner_sql
from test_api_door import NOT_FOUND, door, door_on, signed_in  # noqa: F401 - door_on is autouse
from test_api_saves import Door, n  # noqa: F401
from test_api_library import add_food, eaten
from test_webusage import H, S, call as audit

# The sample files' names (front/tests/samples/search.json, recent.json, usage.json); the tests use "Zz <name>"
PLAIN = {"muesli": "Bircher Müsli", "bar": "Muesli bar", "skyr": "Skyr", "tea": "Green tea", "row": "Rowing", "squat": "Goblet squat",
         "pull": "Pull day", "kitchen": "Kitchen", "bath": "Bathroom", "stove": "Stove", "sink": "Sink", "test": "Vitamin Q"}
SECRET = "an invented private sentence"
GRATEFUL = "an invented gratitude line"


def today():
    return owner_sql("SELECT log_day(now()) AS d")[0]["d"]


def message(content, minutes_ago, channel="web"):
    return owner_sql("""INSERT INTO raw_inbox (channel, content, received_at) VALUES (%s, %s, now() - make_interval(mins => %s))
                        RETURNING id""", channel, content, minutes_ago)[0]["id"]


def lab_test(name):
    got = owner_sql("SELECT id FROM lab_tests WHERE name = %s", name)
    return got[0]["id"] if got else owner_sql("INSERT INTO lab_tests (name, category) VALUES (%s, 'lab') RETURNING id", name)[0]["id"]


def workout(days_ago, split=None, exercises=()):
    w = owner_sql("""INSERT INTO workouts (day, started_at, split_day_id) VALUES (log_day(now()) - %s, now() - make_interval(days => %s), %s)
                     RETURNING id""", days_ago, days_ago, split)[0]["id"]
    for i, x in enumerate(exercises):
        owner_sql("INSERT INTO workout_sets (workout_id, exercise_id, sets, reps, kg, sort_order) VALUES (%s, %s, 3, 8, 24, %s)", w, x, i)
    return w


def invented(plain=False) -> dict:
    """Foods (one with an umlaut and a word, one hidden), what was eaten, a thought, two workouts (one of a split day), chores
    (test_api_home.invented, one a starting point), a lab test; eight messages over four logging days with what they saved, a private
    and a gratitude entry, a message not read yet; AI calls of every kind over 12 days (one escalated, one of a private entry, a coaching)
    and two notifications. -> the ids by key."""
    from test_api_home import chore, done, zone
    nm = (lambda k: PLAIN[k]) if plain else (lambda k: f"Zz {PLAIN[k]}")
    x = {"muesli": add_food(nm("muesli"), kcal=380, aliases=("crunchy oats",)), "bar": add_food(nm("bar"), kcal=420),
         "skyr": add_food(nm("skyr"), kcal=63), "tea": add_food(nm("tea"), "ml", 1, drink=True),
         "hidden": add_food(f"{nm('muesli')} old", active=False)}
    m = {"now": message(f"40 g {nm('muesli').lower()} with skyr", 5), "tea": message("green tea at 09:30", 50, "mcp"),
         "y": message(f"150 g {nm('skyr').lower()} on 16.11.2026", 60 * 24 + 30, "claude-chat"),
         "old": message("an invented note about nothing", 60 * 24 * 3),
         "gym": message("rowing 3x8 24 kg", 60 * 24 * 3 + 10), "none": message("what did I eat yesterday", 60 * 24 * 3 + 20)}
    x["e_now"] = eaten(x["muesli"], 0, 40, rid=m["now"])
    x["e_skyr"] = eaten(x["skyr"], 0, 100, rid=m["now"])
    x["e_tea"] = eaten(x["tea"], 0, 250, drink=True, rid=m["tea"])
    x["e_y"] = eaten(x["skyr"], 1, 150, rid=m["y"])
    x["e_old"] = eaten(x["muesli"], 20, 60)
    owner_sql("UPDATE food_entries SET note = 'invented note: crunchy' WHERE id = %s", x["e_old"])
    owner_sql("""INSERT INTO thoughts (raw_id, original_text, summary, thought_type, area) VALUES (%s, %s, %s, 'idea', 'personal')""",
              m["old"], f"an invented muesli idea {nm('muesli')}", f"invented muesli idea {nm('muesli')}")
    ex = {k: owner_sql("INSERT INTO exercises (name, kind, words) VALUES (%s, 'weights', %s) RETURNING id", nm(k), w)[0]["id"]
          for k, w in (("row", ["erg"]), ("squat", []))}
    split = owner_sql("INSERT INTO workout_days (name) VALUES (%s) RETURNING id", nm("pull"))[0]["id"]
    x["w_pull"] = workout(3, split, (ex["row"], ex["squat"]))
    x["w_free"] = workout(9, None, (ex["squat"],))
    owner_sql("UPDATE workout_sets SET raw_id = %s WHERE workout_id = %s AND exercise_id = %s", m["gym"], x["w_pull"], ex["row"])
    x["kitchen"], x["bath"] = zone(nm("kitchen"), "Kit"), zone(nm("bath"), "Bath")
    x["stove"], x["sink"] = chore(nm("stove"), x["kitchen"], 7, 15), chore(nm("sink"), x["bath"], 7, 10)
    done(x["stove"], x["kitchen"], 2)
    done(x["stove"], x["kitchen"], 40, source="start", dated=True)
    done(x["sink"], x["bath"], 1)
    x["test"] = lab_test(nm("test"))
    x["p_private"] = owner_sql("""INSERT INTO private.entries (channel, label, content, summary, thought_type, area, received_at)
                                  VALUES ('web', 'private', %s, 'invented', 'journal', 'personal', now() - interval '20 minutes') RETURNING id""",
                               f"private: {SECRET}")[0]["id"]
    owner_sql("""INSERT INTO private.entries (channel, label, content, summary, thought_type, area, received_at)
                 VALUES ('web', 'gratitude', %s, 'invented', 'journal', 'personal', now() - interval '25 hours')""", f"g: {GRATEFUL}")
    owner_sql("INSERT INTO private.incoming (channel, content, tries, last_error) VALUES ('web', 'an invented unread line', 1, 'the reader was down')")
    audit("log", [{"model": H, "in": 6000, "out": 100, "usd": 0.002}, {"model": S, "in": 7000, "out": 200, "usd": 0.010}], raw_id=m["now"],
          escalated=True)
    audit("log", [{"model": H, "in": 5000, "out": 90, "usd": 0.003}], raw_id=m["tea"])
    audit("log", [{"model": H, "in": 5000, "out": 80, "usd": 0.004}], raw_id=None, private_id=x["p_private"])
    audit("food_lookup", [{"model": S, "usd": 0.005}], barcode="4000000000017")  # an older call: cost only
    audit("label_photo", [{"model": S, "in": 2500, "out": 300, "usd": 0.011}], days_ago=2)
    audit("coaching", [{"model": "claude-opus-5-5", "in": 9000, "out": 1500, "usd": 0.066}], days_ago=1, id=1, kind="day")
    audit("log", [{"model": H, "in": 5000, "out": 90, "usd": 0.002}], days_ago=12, raw_id=m["old"])
    for _ in range(2):
        owner_sql("INSERT INTO audit_log (tool, outcome, client, detail) VALUES ('nudge', 'sent', 'nudges', '{}'::jsonb)")
    x["m"] = m
    return x


@pytest.fixture
def sv():
    return Door()


def get(sv, path, status=200):
    r = sv.c.get("/api/v1" + path, headers=sv.h)
    assert r.status_code == status, r.text
    assert r.json()["v"] == 1
    return r.json()


def text_of(fragment: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", fragment))


def section(page: str, title: str) -> str:
    """One card of app.'s Search page."""
    return page.split(f"<h2>{title} ")[1].split('<div class="card">')[0]


# ---- GET /search ------------------------------------------------------------------------------------------------------------------

SEARCH = {"q", "searched", "limit", "hint", "foods", "ate", "workouts", "chores", "tests"}
GROUPS = {"foods": "Foods in the catalogue", "ate": "What you ate", "workouts": "Gym workouts", "chores": "Chores done", "tests": "Lab tests"}


@pytest.mark.parametrize("q", ["muesli", "MÜSLI", "zz", "crunch", "skyr", "row", "erg", "pull", "stove", "kit", "vitamin q", "tea"])
def test_the_search_is_app_s_search_as_data(sv, q):
    invented()
    s = get(sv, "/search?q=" + q)["search"]
    assert set(s) == SEARCH and s["q"] == q and s["searched"] and s["limit"] == searchpage.LIMIT == 15
    assert s["hint"] == "Private and gratitude entries are searched on the Private page only."
    page = searchpage.render("x", {"q": q})
    for k, title in GROUPS.items():
        g = s[k]
        assert set(g) == {"title", "rows", "more"} and g["title"] == title and g["more"] is False
        card = section(page, title)
        assert re.match(rf"<span class=\"small\">{len(g['rows'])}</span>", card), (k, card[:60])
        shown = [text_of(p) for p in re.findall(r"<p>(.*?)</p>", card)]
        assert len(shown) == len(g["rows"])
        for line, r in zip(shown, g["rows"]):  # the same rows, in the same order
            if k == "foods":
                assert line == f'{r["id"]} {r["name"]}' and r["id"] == f'N{r["food_id"]}'
            elif k == "ate":
                assert line.startswith(f'{r["day_text"]} · {r["food"]} {r["amount_text"]}') and r["ref"] == f'f{r["id"]}'
            elif k == "workouts":
                assert line == f'{r["day_text"]} · {r["split"]} {r["text"]}' and r["anchor"] == f'w{r["workout_id"]}'
            elif k == "chores":
                assert line == f'{r["day_text"]} · {r["label"]}' + (" starting point" if r["start"] else "")
            else:
                assert line == r["name"]
    assert "thoughts" not in s and "idea" not in json.dumps(s)  # app.'s page has its Thoughts card; the door never reads them


def test_umlauts_fold_and_each_kind_finds_its_rows(sv):
    x = invented()
    s = get(sv, "/search?q=muesli")["search"]
    assert [r["food_id"] for r in s["foods"]["rows"]] == [x["muesli"], x["bar"]]  # "muesli" finds "Müsli"; not the hidden food
    assert [r["id"] for r in s["ate"]["rows"]] == [x["e_now"], x["e_old"]]
    assert s["ate"]["rows"][1] == {"id": x["e_old"], "ref": f'f{x["e_old"]}', "day": (today() - timedelta(days=20)).isoformat(),
                                   "day_text": f'{today() - timedelta(days=20):%a %d.%m.%Y}', "food": "Zz Bircher Müsli", "amount": 60,
                                   "unit": "g", "amount_text": "60 g", "note": "invented note: crunchy"}
    assert "Zz Bircher Müsli" in searchpage.render("x", {"q": "muesli"}).split("<h2>Thoughts")[1].split("<h2>")[0]  # app. keeps its thoughts
    w = get(sv, "/search?q=erg")["search"]["workouts"]["rows"]  # an exercise's other word
    assert [r["workout_id"] for r in w] == [x["w_pull"]] and w[0]["split"] == "Zz Pull day" and w[0]["text"] == "Zz Rowing 3 × 8 at 24 kg"
    w = get(sv, "/search?q=squat")["search"]["workouts"]["rows"]
    assert [(r["workout_id"], r["split"]) for r in w] == [(x["w_pull"], "Zz Pull day"), (x["w_free"], "Free workout")]
    assert get(sv, "/search?q=pull")["search"]["workouts"]["rows"][0]["text"] == "Zz Rowing, Zz Goblet squat"  # only the day matched
    c = get(sv, "/search?q=stove")["search"]["chores"]["rows"]
    assert [(r["chore_id"], r["label"], r["start"]) for r in c] == [(x["stove"], "Zz Stove · Zz Kitchen", False),
                                                                     (x["stove"], "Zz Stove · Zz Kitchen", True)]
    tests = get(sv, "/search?q=vitamin q")["search"]["tests"]["rows"]  # lab tests stay in the test database (the samples add "Vitamin Q")
    assert {"test_id": x["test"], "name": "Zz Vitamin Q"} in tests and all("vitamin q" in t["name"].lower() for t in tests)


@pytest.mark.parametrize("q", ["", "m", " m ", "%", "Ü"])
def test_under_two_letters_nothing_is_searched(sv, q):
    invented()
    s = get(sv, "/search?q=" + q)["search"]
    assert not s["searched"] and s["hint"] == "Type at least two letters. Private and gratitude entries are searched on the Private page only."
    assert all(s[k] == {"title": t, "rows": [], "more": False} for k, t in GROUPS.items())
    assert searchpage.SHORT in searchpage.render("x", {"q": q})


def test_spaces_are_squeezed_and_the_words_cut_at_80(sv):
    invented()
    assert get(sv, "/search?q=%20%20green%20%20%20tea%20")["search"]["q"] == "green tea"
    assert get(sv, "/search?q=" + "x" * 200)["search"]["q"] == "x" * 80
    assert get(sv, "/search?q=50%25")["search"]["foods"]["rows"] == []  # % is a plain character


def test_at_most_15_of_a_kind_with_more(sv):
    fid = [add_food(f"Zz Lentil {i:02}") for i in range(17)]
    for f in fid[:14]:
        eaten(f, 1)
    s = get(sv, "/search?q=lentil")["search"]
    assert [r["name"] for r in s["foods"]["rows"]] == [f"Zz Lentil {i:02}" for i in range(15)] and s["foods"]["more"] is True
    assert len(s["ate"]["rows"]) == 14 and s["ate"]["more"] is False
    assert '<span class="small">15+</span>' in searchpage.render("x", {"q": "lentil"})


def test_search_needs_the_door_and_a_session():
    c = door()
    assert c.get("/api/v1/search?q=zz").status_code == 401
    assert door(token="x" * 40).get("/api/v1/search?q=zz", headers={"X-Front-Token": "x" * 40}).json() == NOT_FOUND


# ---- GET /gym/history?w= ----------------------------------------------------------------------------------------------------------

def test_an_older_workout_is_added_to_the_history_in_its_place(sv):
    x = owner_sql("INSERT INTO exercises (name, kind) VALUES ('Zz Rowing', 'weights') RETURNING id")[0]["id"]
    ws = [workout(back, None, (x,)) for back in range(62)]  # 62 workouts: the two oldest are not among the last 60
    plain = get(sv, "/gym/history")["gym_history"]["workouts"]
    assert [w["workout_id"] for w in plain] == ws[:60]
    j = get(sv, f"/gym/history?w={ws[61]}")["gym_history"]["workouts"]
    assert [w["workout_id"] for w in j] == ws[:60] + [ws[61]] and j[-1]["anchor"] == f"w{ws[61]}" and j[-1]["exercises"][0]["name"] == "Zz Rowing"
    assert get(sv, f"/gym/history?w={ws[3]}")["gym_history"]["workouts"] == plain  # already there: unchanged
    assert get(sv, "/gym/history?w=999999")["gym_history"]["workouts"] == plain  # no such workout: unchanged
    for bad in ("w12", "-1", "1.5", "x"):
        r = sv.c.get(f"/api/v1/gym/history?w={bad}", headers=sv.h)
        assert r.status_code == 400 and r.json()["message"] == "w must be a workout's id."


# ---- GET /recent ------------------------------------------------------------------------------------------------------------------

RECENT = {"limit", "small", "empty", "none", "days", "not_read"}
MESSAGE = {"id", "private", "at", "time", "channel", "channel_label", "text", "again", "open_day", "saved"}


def test_recent_is_app_s_page_as_data(sv):
    x = invented()
    r = get(sv, "/recent")["recent"]
    assert set(r) == RECENT and r["limit"] == recentpage.LIMIT == 50 and r["not_read"] == 1
    assert r["small"] == "The last 50 messages from the web app and Claude" and r["none"] == "Nothing saved from this message."
    page = recentpage.render("x")
    assert [d["head"] for d in r["days"]] == [text_of(h) for h in re.findall(r'<h3 class="rc-day">(.*?)</h3>', page)]
    assert r["days"][0]["head"] == "Today" and "Yesterday" in [d["head"] for d in r["days"]]
    msgs = [m for d in r["days"] for m in d["messages"]]
    assert all(set(m) == MESSAGE for m in msgs) and len(msgs) == 8
    arts = re.findall(r'<article class="rc">(.*?)</article>', page)
    for m, a in zip(msgs, arts):  # the same messages in the same order, each with app.'s time, pill and saved lines
        assert f'<span class="num">{m["time"]}</span><span class="pill">{m["channel_label"]}</span>' in a
        assert [(i["kind"], i["text"]) for i in m["saved"]] == [tuple(map(text_of, p)) for p in
                                                                re.findall(r'<li><span class="pill">(.*?)</span> (.*?)</li>', a)]
        assert (m["open_day"] is not None) == ("Open day" in a)
    first = msgs[0]
    assert first == {"id": x["m"]["now"], "private": False, "at": first["at"], "time": first["time"], "channel": "web",
                     "channel_label": "Web app", "text": "40 g zz bircher müsli with skyr", "again": "40 g zz bircher müsli with skyr",
                     "open_day": today().isoformat(), "saved": [{"kind": "Food", "text": "Zz Bircher Müsli 40 g · meal 1"},
                                                                 {"kind": "Food", "text": "Zz Skyr 100 g · meal 1"}]}
    tea = next(m for m in msgs if m["id"] == x["m"]["tea"])
    assert tea["channel_label"] == "Claude" and tea["again"] == "green tea" and tea["saved"] == [{"kind": "Food", "text": "Zz Green tea 250 ml · drinks"}]
    gym = next(m for m in msgs if m["id"] == x["m"]["gym"])
    assert gym["saved"] == [{"kind": "Gym", "text": "Zz Rowing 3 × 8 at 24 kg"}] and gym["open_day"] == (today() - timedelta(days=3)).isoformat()
    none = next(m for m in msgs if m["id"] == x["m"]["none"])
    assert none["saved"] == [] and none["open_day"] is None
    note = next(m for m in msgs if m["id"] == x["m"]["old"])
    assert note["saved"] == [{"kind": "Idea", "text": "invented muesli idea Zz Bircher Müsli"}]


def test_a_private_or_gratitude_entry_is_its_label_only(sv):
    x = invented()
    r = sv.c.get("/api/v1/recent", headers=sv.h)
    assert SECRET not in r.text and GRATEFUL not in r.text and "private:" not in r.text and "g: " not in r.text
    assert f'P{x["p_private"]}' not in r.text
    msgs = [m for d in r.json()["recent"]["days"] for m in d["messages"]]
    p = [m for m in msgs if m["private"]]
    assert [m["saved"] for m in p] == [[{"kind": "Private", "text": "private"}], [{"kind": "Private", "text": "gratitude"}]]
    assert all(m["id"] is None and m["text"] is None and m["again"] is None and m["channel"] is None and m["open_day"] is None
               and m["channel_label"] == "Private" for m in p)
    assert SECRET in recentpage.render("x")  # app.'s page shows the words (the owner's decision there); the door never


def test_a_message_with_a_private_label_or_naming_private_entries_has_no_words(sv):
    message("private: an invented line that should never be here", 3)
    message("show my private entries of last week", 4)
    message("delete P12", 6)
    msgs = [m for d in get(sv, "/recent")["recent"]["days"] for m in d["messages"]]
    assert [(m["text"], m["again"], m["private"]) for m in msgs] == [(None, None, False)] * 3


def test_recent_with_no_messages(sv):
    r = get(sv, "/recent")["recent"]
    assert r["days"] == [] and r["empty"] == "No messages yet." and r["not_read"] == 0


def test_fifty_messages_at_most(sv):
    for i in range(55):
        message(f"invented line {i}", i)
    msgs = [m for d in get(sv, "/recent")["recent"]["days"] for m in d["messages"]]
    assert len(msgs) == 50 and msgs[0]["text"] == "invented line 0" and msgs[-1]["text"] == "invented line 49"


# ---- GET /usage -------------------------------------------------------------------------------------------------------------------

USAGE = {"r", "ranges", "start", "end", "days", "first", "since", "tiles", "chart", "empty", "legend", "kinds", "all", "kinds_note", "pushes",
         "pushes_text", "top", "note"}
TILES = {"calls", "usd", "usd_text", "per_message", "per_message_text", "messages", "tokens_in", "tokens_out", "tokens_text", "tokens_known",
         "tokens_note"}
KIND = {"kind", "calls", "tokens_in", "tokens_out", "tokens_known", "tokens_in_text", "tokens_out_text", "usd", "usd_text"}
TOP = {"at", "at_text", "kind", "text", "private", "models", "models_text", "usd", "usd_text", "escalated"}


def page_chart(page):
    m = re.search(r'data-chart="([^"]*)"', page)
    return json.loads(html.unescape(m.group(1))) if m else None


@pytest.mark.parametrize("r", ["7", "30", "all"])
def test_usage_is_app_s_page_as_data(sv, r):
    invented()
    u = get(sv, f"/usage?r={r}")["usage"]
    assert set(u) == USAGE and u["r"] == r and [x["current"] for x in u["ranges"]] == [k == r for k in ("7", "30", "all")]
    assert set(u["tiles"]) == TILES and all(set(k) == KIND for k in [*u["kinds"], u["all"]]) and all(set(t) == TOP for t in u["top"])
    page = usagepage.render(r)
    assert u["chart"] == page_chart(page) and u["since"] in page and u["note"] in page and u["pushes_text"] in page
    t = u["tiles"]
    for word in (f'<span class="n num">{t["calls"]:,}</span>', f'<span class="n num">{t["usd_text"]}</span>',
                 f'<span class="n num">{t["per_message_text"]}</span> <span class="of">{t["messages"]} messages</span>',
                 f'<span class="n num">{t["tokens_text"]}</span> <span class="of">{t["tokens_note"]}</span>'):
        assert word in page, word
    rows = "".join(f'<tr><td>{k["kind"]}</td><td>{k["calls"]:,}</td><td>{k["tokens_in_text"]}</td><td>{k["tokens_out_text"]}</td><td>{k["usd_text"]}</td></tr>'
                   for k in u["kinds"])
    a = u["all"]
    assert rows + f'<tr class="sum"><td>All</td><td>{a["calls"]:,}</td><td>{a["tokens_in_text"]}</td><td>{a["tokens_out_text"]}</td><td>{a["usd_text"]}</td></tr>' in page
    assert u["kinds_note"] == usagepage.OLD_NOTE and u["kinds_note"] in page and u["pushes"] == 2
    tops = re.findall(r"<tr><td>([^<]*)</td><td class=\"l first\">(.*?)</td><td class=\"l\">(.*?)</td><td class=\"l\">(.*?)</td><td>(.*?)</td></tr>", page)
    assert [(x["at_text"], x["kind"], x["models_text"], x["usd_text"]) for x in u["top"]] == [(a_, k, html.unescape(m), c) for a_, _w, k, m, c in tops]
    for x, (_a, w, _k, _m, _c) in zip(u["top"], tops):
        assert (x["text"] or "") in html.unescape(w) and ("larger model" in w) == x["escalated"] and ('class="pill">private' in w) == x["private"]


def test_usage_ranges_counts_and_the_private_mark(sv):
    x = invented()
    u7, u30 = get(sv, "/usage")["usage"], get(sv, "/usage?r=30")["usage"]
    assert u7["r"] == "7" and u7["days"] == 7 and u7["start"] == (today() - timedelta(days=6)).isoformat() and u7["end"] == today().isoformat()
    assert u30["days"] == 30 and u7["tiles"]["calls"] == 7 and u30["tiles"]["calls"] == 8 and u7["tiles"]["messages"] == 3
    assert u7["tiles"]["usd"] == 0.101 and u7["tiles"]["usd_text"] == "$0.10" and u7["tiles"]["tokens_known"] is False
    assert [k["kind"] for k in u7["kinds"]] == ["coaching", "message", "label photo", "food look-up"]
    assert u7["kinds"][1] == {"kind": "message", "calls": 4, "tokens_in": 23000, "tokens_out": 470, "tokens_known": True, "tokens_in_text": "23.0k",
                              "tokens_out_text": "0.5k", "usd": 0.019, "usd_text": "$0.019"}
    assert [t["kind"] for t in u7["top"]] == ["message", "label photo", "food look-up", "message", "message"]  # no coaching
    first = u7["top"][0]
    assert first["text"] == "40 g zz bircher müsli with skyr" and first["escalated"] and first["models"] == ["Haiku", "Sonnet"]
    p = next(t for t in u7["top"] if t["private"])
    assert p["text"] is None and p["usd"] == 0.004 and next(t for t in u7["top"] if t["kind"] == "food look-up")["text"] is None
    assert len(u7["chart"]["series"]) == 3 and u7["chart"]["days"] == 7
    r = sv.c.get("/api/v1/usage?r=all", headers=sv.h)
    assert r.json()["usage"]["first"] == (today() - timedelta(days=12)).isoformat() and SECRET not in r.text
    assert f'P{x["p_private"]}' not in r.text


def test_usage_with_no_calls(sv):
    u = get(sv, "/usage?r=30")["usage"]
    assert u["chart"] is None and u["empty"] == "No AI calls in this range." and u["top"] == [] and u["kinds"] == []
    assert u["tiles"]["per_message"] is None and u["tiles"]["per_message_text"] == "–" and u["kinds_note"] is None


@pytest.mark.parametrize("bad", ["1", "90", "ALL", "7days"])
def test_another_range_is_a_bad_request(sv, bad):
    r = sv.c.get(f"/api/v1/usage?r={bad}", headers=sv.h)
    assert r.status_code == 400 and r.json() == {"v": 1, "error": "bad_request", "message": "r must be 7, 30 or all."}

"""The words review (core item 24, 22.11.2026): GET /api/v1/food/words, every word of an active food with its food, when and from where
it was added (the latest food_changes row that added it, else the food's creation time) and how many active foods have it. A word is
removed with the Catalogue's own save (POST /food/catalogue/words, act remove), which answers with the Undo and, asked for view
"words", the fresh list. Every food, word and date is invented."""
import json

import pytest

from app import api, reads
from conftest import owner_sql
from test_api_door import NOT_FOUND, door, door_on, signed_in  # noqa: F401 - door_on is autouse
from test_api_library import add_food
from test_api_saves import KEYS, Door  # noqa: F401
from test_log import fake, off  # noqa: F401 - the AI is a fake

ROW = {"word", "food_id", "food", "added_at", "by", "shared", "month"}
WORDS = {"count", "total", "rows", "limit"}


@pytest.fixture
def sv():
    return Door()


def get(sv, path, status=200):
    r = sv.c.get("/api/v1" + path, headers=sv.h)
    assert r.status_code == status, r.text
    j = r.json()
    if status == 200:
        assert j["v"] == 1 and set(j) == {"v", "words", "undo"} and set(j["words"]) == WORDS
        assert all(set(r_) == ROW for r_ in j["words"]["rows"])
    return j


def rows(sv, path=""):
    return get(sv, "/food/words" + path)["words"]["rows"]


def pairs(rs):
    return [(r["word"], r["food"]) for r in rs]


def say(sv, fid, act, word, **more):
    return sv.post("/food/catalogue/words", id=fid, act=act, word=word, **more)


def pin(fid, word, when, by="core_rw"):
    """Say that a word was added to a food at `when` by this role: the latest change row of the food that adds the word."""
    owner_sql("""UPDATE food_changes SET changed_at = %s::timestamptz, changed_by = %s
                 WHERE id = (SELECT max(id) FROM food_changes WHERE food_id = %s AND (new_values -> 'aliases') ? %s)""", when, by, fid, word)


def foods():
    """Four invented foods, all made on 15.08.2026; the rye bread came with the word "bread"."""
    x = {"rye": add_food("Zz rye bread", aliases=("bread",)), "oats": add_food("Zz oat flakes"), "skyr": add_food("Zz skyr"),
         "tea": add_food("Zz green tea")}
    owner_sql("UPDATE foods SET created_at = '2026-08-15 09:00+02' WHERE id = ANY(%s)", list(x.values()))
    return x


# ---- the read ------------------------------------------------------------------------------------------------------------------------

def test_a_word_added_through_the_door_shows_as_the_web_with_its_time(sv, fake):
    x = foods()
    j = say(sv, x["oats"], "add", "  Porridge ")
    assert j["outcome"] == "changed"
    [r] = [r for r in rows(sv) if r["word"] == "porridge"]
    assert (r["food_id"], r["food"], r["by"], r["shared"]) == (x["oats"], "Zz oat flakes", "web", 1)
    t = owner_sql("SELECT changed_at, changed_by FROM food_changes WHERE food_id = %s AND new_values ? 'aliases'", x["oats"])
    assert len(t) == 1 and t[0]["changed_by"] == "core_rw"
    assert r["added_at"] == reads.iso(t[0]["changed_at"]) and r["month"] == reads.iso(t[0]["changed_at"])[:7]


def test_a_word_from_the_creation_has_the_creation_time_and_no_source(sv, fake):
    x = foods()
    [r] = rows(sv)
    made = owner_sql("SELECT created_at FROM foods WHERE id = %s", x["rye"])[0]["created_at"]
    assert (r["word"], r["food"], r["by"], r["shared"]) == ("bread", "Zz rye bread", None, 1)
    assert r["added_at"] == reads.iso(made) and r["month"] == reads.iso(made)[:7]


def test_the_latest_change_that_added_the_word_wins_and_the_source_is_its_role(sv, fake):
    x = foods()
    say(sv, x["rye"], "add", "loaf")
    pin(x["rye"], "loaf", "2026-10-03 09:00+02", by="mcp_writer")
    say(sv, x["rye"], "add", "toast")  # another word later: the loaf's row is not the latest change of the food, still its own
    pin(x["rye"], "toast", "2026-11-05 10:00+01", by="pgadmin")
    say(sv, x["rye"], "remove", "loaf")  # removed and added again: the later adding counts
    say(sv, x["rye"], "add", "loaf")
    pin(x["rye"], "loaf", "2026-11-20 12:30+01", by="mcp_writer")
    by = {r["word"]: r for r in rows(sv)}
    assert (by["loaf"]["by"], by["loaf"]["added_at"], by["loaf"]["month"]) == ("chat", "2026-11-20T12:30:00+01:00", "2026-11")
    assert (by["toast"]["by"], by["toast"]["added_at"]) == ("other", "2026-11-05T10:00:00+01:00")
    assert by["bread"]["by"] is None


def test_the_month_is_in_berlin_time(sv, fake):
    x = foods()
    say(sv, x["oats"], "add", "granola")
    pin(x["oats"], "granola", "2026-10-31 23:30+00")  # past midnight in Berlin
    [r] = [r for r in rows(sv) if r["word"] == "granola"]
    assert r["added_at"] == "2026-11-01T00:30:00+01:00" and r["month"] == "2026-11"


def test_a_word_on_two_foods_is_shared_on_both_rows(sv, fake):
    x = foods()
    owner_sql("UPDATE foods SET aliases = ARRAY['Bread'] WHERE id = %s", x["tea"])  # another case, another food
    owner_sql("UPDATE foods SET aliases = ARRAY['bread', 'rusk'] WHERE id = %s", x["rye"])
    say(sv, x["oats"], "add", "porridge")
    rs = rows(sv)
    assert sorted((r["word"], r["food"], r["shared"]) for r in rs) == [
        ("Bread", "Zz green tea", 2), ("bread", "Zz rye bread", 2), ("porridge", "Zz oat flakes", 1), ("rusk", "Zz rye bread", 1)]
    only = rows(sv, "?shared=1")
    assert sorted(pairs(only)) == [("Bread", "Zz green tea"), ("bread", "Zz rye bread")] and all(r["shared"] == 2 for r in only)
    assert get(sv, "/food/words?shared=1")["words"]["total"] == 2 and get(sv, "/food/words?shared=0")["words"]["total"] == 4


def test_q_matches_the_word_and_the_food_s_name_in_any_case(sv, fake):
    x = foods()
    say(sv, x["oats"], "add", "porridge")
    say(sv, x["skyr"], "add", "quark")
    assert pairs(rows(sv, "?q=PORRI")) == [("porridge", "Zz oat flakes")]  # a word
    assert pairs(rows(sv, "?q=oat%20FLAKES")) == [("porridge", "Zz oat flakes")]  # the food's name
    assert sorted(pairs(rows(sv, "?q=zz"))) == [("bread", "Zz rye bread"), ("porridge", "Zz oat flakes"), ("quark", "Zz skyr")]
    assert get(sv, "/food/words?q=zzqq-nothing")["words"] == {"count": 0, "total": 0, "rows": [], "limit": 500}
    assert rows(sv, "?q=%25") == [] and rows(sv, "?q=_") == []  # % and _ are plain characters
    assert pairs(rows(sv, "?q=quark&shared=1")) == []
    assert len(rows(sv, "?q=" + "a" * 60)) == 0


def test_the_words_of_a_hidden_food_are_not_listed_and_do_not_count_as_shared(sv, fake):
    x = foods()
    say(sv, x["oats"], "add", "porridge")
    owner_sql("UPDATE foods SET aliases = ARRAY['bread'] WHERE id = %s", x["tea"])
    assert [r["shared"] for r in rows(sv, "?q=bread")] == [2, 2]
    owner_sql("UPDATE foods SET active = false WHERE id = %s", x["tea"])
    assert [(r["word"], r["shared"]) for r in rows(sv, "?q=bread")] == [("bread", 1)]
    owner_sql("UPDATE foods SET active = false WHERE id = %s", x["rye"])
    assert pairs(rows(sv)) == [("porridge", "Zz oat flakes")]


def test_the_order_is_newest_first_then_by_word_and_the_creation_time_counts(sv, fake):
    x = foods()
    for fid, w, when in ((x["oats"], "porridge", "2026-11-02 08:00+01"), (x["skyr"], "quark", "2026-11-18 08:00+01"),
                         (x["tea"], "cuppa", "2026-09-30 08:00+02"), (x["oats"], "muesli", "2026-11-02 08:00+01")):
        say(sv, fid, "add", w)
        pin(fid, w, when)
    rs = rows(sv)
    assert [r["word"] for r in rs] == ["quark", "muesli", "porridge", "cuppa", "bread"]  # the same moment: by word; "bread" came with the food
    assert [r["month"] for r in rs] == ["2026-11", "2026-11", "2026-11", "2026-09", "2026-08"]


def test_the_limit_and_the_total(sv, fake, monkeypatch):
    x = foods()
    owner_sql("UPDATE foods SET aliases = ARRAY(SELECT 'w' || lpad(g::text, 3, '0') FROM generate_series(1, 520) g) WHERE id = %s", x["oats"])
    w = get(sv, "/food/words")["words"]
    assert (w["count"], w["total"], w["limit"], len(w["rows"])) == (500, 521, 500, 500)
    assert w["rows"][0]["word"] == "w001" and w["rows"][-1]["word"] == "w500"  # the newest first; "bread" (older) is past the limit
    assert get(sv, "/food/words?q=w5")["words"]["count"] == 21
    q = get(sv, "/food/words?q=w00")["words"]
    assert (q["count"], q["total"]) == (9, 9)
    monkeypatch.setattr(reads, "WORDS_LIMIT", 3)
    w = get(sv, "/food/words")["words"]
    assert (w["count"], w["total"], w["limit"]) == (3, 521, 3)


def test_q_too_long_or_shared_odd_is_a_400(sv):
    r = get(sv, "/food/words?q=" + "a" * 61, 400)
    assert r["error"] == "bad_request" and r["message"] == "q must be 60 characters or fewer."
    assert get(sv, "/food/words?shared=yes", 400)["message"] == "shared must be 1 or 0."
    assert get(sv, "/food/words?q=" + "a" * 60)["words"]["count"] == 0


def test_the_door_s_rules_hold_for_the_route(sv):
    c = sv.c
    assert c.get("/api/v1/food/words").status_code == 401 and c.get("/api/v1/food/words").json()["error"] == "signed_out"
    r = door(token="w" * 40).get("/api/v1/food/words", headers=sv.h)  # a wrong service token
    assert r.status_code == 404 and r.json() == NOT_FOUND
    assert c.post("/api/v1/food/words", headers=sv.h, json={}).status_code == 405  # only a read: the save is the Catalogue's
    assert "no-store" in c.get("/api/v1/food/words", headers=sv.h).headers["cache-control"]


# ---- removing a word -----------------------------------------------------------------------------------------------------------------

def test_a_removed_word_is_gone_and_undo_brings_it_back(sv, fake):
    x = foods()
    say(sv, x["oats"], "add", "porridge")
    j = say(sv, x["oats"], "remove", "porridge", view="words", view_q="oat")
    assert j["outcome"] == "changed" and j["head"] == f'"porridge" no longer means N{x["oats"]} Zz oat flakes.'
    assert set(j) == KEYS | {"words"} and j["words"]["rows"] == [] and j["words"]["total"] == 0  # the fresh list, as asked for
    assert "porridge" not in [r["word"] for r in rows(sv)]
    u = j["undo"]
    assert u and set(u) == {"token", "head", "expires_at"} and get(sv, "/food/words")["undo"] == u  # the read carries it too
    back = sv.post("/undo", token=u["token"], view="words", view_q="porr")
    assert back["outcome"] == "changed" and pairs(back["words"]["rows"]) == [("porridge", "Zz oat flakes")]
    assert "porridge" in [r["word"] for r in rows(sv)]
    assert owner_sql("SELECT aliases FROM foods WHERE id = %s", x["oats"])[0]["aliases"] == ["porridge"]


def test_a_save_asked_for_the_words_brings_the_list_with_the_page_s_search_and_chip(sv, fake):
    x = foods()
    owner_sql("UPDATE foods SET aliases = ARRAY['bread', 'rusk'] WHERE id = %s", x["tea"])
    j = say(sv, x["tea"], "remove", "rusk", view="words", view_shared=True)
    assert pairs(j["words"]["rows"]) == [("bread", "Zz green tea"), ("bread", "Zz rye bread")]  # both foods have it
    j = say(sv, x["tea"], "remove", "bread", view="words", view_shared=True)
    assert j["words"]["rows"] == []  # only the rye is left with it: no longer shared
    j = say(sv, x["tea"], "add", "chai", view="words", view_q="x" * 80)  # a long search is cut, as the Catalogue's
    assert j["words"]["rows"] == [] and j["outcome"] == "changed"
    j = say(sv, x["tea"], "add", "rooibos", view="words", view_q="ROOI")
    assert pairs(j["words"]["rows"]) == [("rooibos", "Zz green tea")]
    assert "words" not in say(sv, x["tea"], "add", "mint", view="catalogue")  # the Catalogue's own view is as it was
    json.dumps(j)
    assert api.saved and reads.food_words


def test_undo_takes_a_word_back_in_both_directions_and_only_for_the_words_review(sv, fake):
    x = foods()
    j = say(sv, x["oats"], "add", "Porridge", view="words")
    assert j["undo"]["head"] == f'"porridge" now means N{x["oats"]} Zz oat flakes.'
    back = sv.post("/undo", token=j["undo"]["token"], view="words")
    assert (back["outcome"], back["head"]) == ("changed", f'Undone: "porridge" no longer means N{x["oats"]} Zz oat flakes.') and back["words"]["total"] == 1
    assert owner_sql("SELECT aliases FROM foods WHERE id = %s", x["oats"])[0]["aliases"] == []
    assert back["undo"] is None
    assert say(sv, x["oats"], "add", "porridge")["undo"] is None  # the Foods tab's save is as it was: no Undo
    assert say(sv, x["oats"], "add", "porridge", view="words")["undo"] is None  # nothing changed: nothing to undo


def test_undo_leaves_the_other_words_as_they_are_and_says_when_it_cannot(sv, fake):
    x = foods()
    owner_sql("UPDATE foods SET aliases = ARRAY['a1', 'a2'] WHERE id = %s", x["oats"])
    j = say(sv, x["oats"], "remove", "a1", view="words")
    owner_sql("UPDATE foods SET aliases = aliases || ARRAY['a3'] WHERE id = %s", x["oats"])  # changed meanwhile, by hand
    back = sv.post("/undo", token=j["undo"]["token"], view="words")
    assert back["outcome"] == "changed" and sorted(owner_sql("SELECT aliases FROM foods WHERE id = %s", x["oats"])[0]["aliases"]) == ["a1", "a2", "a3"]
    j = say(sv, x["oats"], "remove", "a2", view="words")
    owner_sql("UPDATE foods SET aliases = ARRAY['a2'] WHERE id = %s", x["tea"])  # another food took the word since
    back = sv.post("/undo", token=j["undo"]["token"], view="words")  # what was is put back: the word is on two foods, as it was found
    assert back["head"] == f'Undone: "a2" now means N{x["oats"]} Zz oat flakes again.'
    assert sorted((r["word"], r["food"], r["shared"]) for r in back["words"]["rows"] if r["word"] == "a2") == [("a2", "Zz green tea", 2), ("a2", "Zz oat flakes", 2)]
    owner_sql("UPDATE foods SET aliases = ARRAY['q1'] WHERE id = %s", x["skyr"])
    j = say(sv, x["skyr"], "remove", "q1", view="words")
    owner_sql("DELETE FROM foods WHERE id = %s", x["skyr"])  # (by hand: the app never deletes a food)
    back = sv.post("/undo", token=j["undo"]["token"], view="words")
    assert (back["outcome"], back["head"], back["reason"]) == ("rejected", "Nothing undone.", "That food is not there any more.")

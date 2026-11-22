"""The order in which logbook.answer takes a reply (core item 16, 22.11.2026), pinned before its if/elif chain became one
handler per kind: which kind takes a free answer before the general rule (a clear no cancels, an unclear reply keeps the
question open), which comes before the "already answered or expired" check, and which yes goes where. Every handler is a
stub here that names itself, so each case shows only the path taken."""
import json
from datetime import datetime, timezone

import pytest

from app import commands, labs, logbook, lookup, record, todos
from conftest import owner_sql
from test_log import fake  # noqa: F401 - fixture reused

EXPIRED = "that question was already answered or has expired"
UNKNOWN = "There is no such open question."
NOW = datetime.now(timezone.utc).isoformat()

FOOD = {"kind": "food", "item": {"food": "oat"}}
LOOKUP = {"kind": "food", "item": {"food": "oat"}, "lookup": {"cand": 1}}
TODO = {"kind": "todo", "item": {"item": "milk"}}
PAST = {"steps": [], "ask_past": True}
NAP = {"text": "woke up", "pred": {}, "now": NOW, "nap": True}
CONFIRM = {"text": "woke up", "pred": {}, "now": NOW}
ADD = {"name": "oat", "values": {}, "question_id": None, "code": None}


@pytest.fixture(autouse=True)
def stubs(monkeypatch, fake):  # noqa: F811 - the fake stops a real AI call
    """Each helper answer() calls answers with its own name and changes nothing ("rejected"), so a case shows its path."""
    def named(name):
        return {"outcome": "rejected", "reason": name}
    monkeypatch.setattr(record, "answer", lambda cur, pid, reply, now: named("record.answer"))
    monkeypatch.setattr(lookup, "accept", lambda cur, cand, now, qid=None, word=None: named("lookup.accept"))
    monkeypatch.setattr(todos, "answer", lambda cur, prov, p, reply, now: named("todos.answer"))
    from app import homechat
    monkeypatch.setattr(homechat, "answer", lambda cur, p, reply, now: named("homechat.answer"))
    monkeypatch.setattr(commands, "handle", lambda cur, prov, text, now, prev: (named("commands.handle"), []))
    monkeypatch.setattr(commands, "apply", lambda cur, payload, now, past=None: named(f"commands.apply past={past}"))
    monkeypatch.setattr(labs, "save_report", lambda cur, payload, now: named("labs.save_report"))
    monkeypatch.setattr(logbook, "_process", lambda cur, text, now, pred, channel: named("_process"))
    monkeypatch.setattr(record, "add_food", lambda *a, **k: named("record.add_food"))
    monkeypatch.setattr(record, "as_nap", lambda cur, pred: {"as_nap": True})
    monkeypatch.setattr(record, "settle", lambda cur, cat, types, pred, now: pred)
    monkeypatch.setattr(record, "save", lambda cur, r, text, channel, now, confirmed=False:
                        named("record.save as nap" if r.get("as_nap") else "record.save"))


def ask(tool, payload, state="open"):
    when = {"open": "now() + interval '1 day'", "expired": "now() - interval '1 minute'", "resolved": "now() + interval '1 day'"}[state]
    owner_sql(f"""INSERT INTO pending (id, tool, payload, reason, expires_at, resolved_at) VALUES ('pa', %s, %s, 'Which?', {when},
                  {"now()" if state == "resolved" else "NULL"})""", tool, json.dumps(payload))
    return "pa"


def path(out):
    """What answered: the stub's name, or the general rule's own outcome."""
    if out["outcome"] == "cancelled":
        return "cancelled"
    if out["outcome"] == "needs_confirmation" and out.get("reason") == "answer yes to save it, or no to drop it":
        return "unclear"
    return out.get("reason") or out.get("message")


CASES = [
    # a log question (which food, how much) is record.answer's, any reply, before the expired check (it checks that itself);
    # only a yes to a food found in USDA or Open Food Facts is accepted here
    ("log", FOOD, "N1", "open", "record.answer"),
    ("log", FOOD, "yes", "open", "record.answer"),
    ("log", FOOD, "no", "open", "record.answer"),
    ("log", FOOD, "N1", "expired", "record.answer"),
    ("log", FOOD, "N1", "resolved", "record.answer"),
    ("log", LOOKUP, "yes", "open", "lookup.accept"),
    ("log", LOOKUP, "no", "open", "record.answer"),
    ("log", LOOKUP, "N2", "open", "record.answer"),
    ("log", LOOKUP, "yes", "expired", EXPIRED),
    ("log", LOOKUP, "no", "expired", "record.answer"),
    # which shopping item: todos.answer, any reply, after the expired check
    ("log", TODO, "2", "open", "todos.answer"),
    ("log", TODO, "no", "open", "todos.answer"),
    ("log", TODO, "yes", "open", "todos.answer"),
    ("log", TODO, "2", "expired", EXPIRED),
    ("log", {**LOOKUP, "kind": "todo"}, "no", "open", "lookup.accept"),  # never made today; the look-up comes first
    # which chore, which entry: any reply, a no included, goes to the kind's own reader
    ("home_choice", {}, "no", "open", "homechat.answer"),
    ("home_choice", {}, "yes", "open", "homechat.answer"),
    ("home_choice", {}, "the kitchen", "open", "homechat.answer"),
    ("home_choice", {}, "no", "resolved", EXPIRED),
    ("command", {"text": "change it"}, "no", "open", "commands.handle"),
    ("command", {"text": "change it"}, "the second", "open", "commands.handle"),
    ("command", {"text": "change it"}, "yes", "open", "commands.handle"),
    ("command", {"text": "change it"}, "the second", "expired", EXPIRED),
    # past entries too? yes = past too, a plain no or nein = only new ones; any other no-word cancels
    ("command_confirm", PAST, "yes", "open", "commands.apply past=yes"),
    ("command_confirm", PAST, "no", "open", "commands.apply past=no"),
    ("command_confirm", PAST, "Nein.", "open", "commands.apply past=no"),
    ("command_confirm", PAST, "nope", "open", "cancelled"),
    ("command_confirm", PAST, "cancel", "open", "cancelled"),
    ("command_confirm", PAST, "maybe", "open", "unclear"),
    ("command_confirm", PAST, "no", "expired", EXPIRED),
    ("command_confirm", {"steps": []}, "yes", "open", "commands.apply past=None"),
    ("command_confirm", {"steps": []}, "no", "open", "cancelled"),
    ("command_confirm", {"steps": []}, "maybe", "open", "unclear"),
    # a new day, or a nap? a nap word only counts when the question asked it
    ("log_confirm", NAP, "nap", "open", "record.save as nap"),
    ("log_confirm", NAP, "night waking", "open", "record.save as nap"),
    ("log_confirm", NAP, "yes", "open", "record.save"),
    ("log_confirm", NAP, "no", "open", "cancelled"),
    ("log_confirm", NAP, "maybe", "open", "unclear"),
    ("log_confirm", NAP, "nap", "expired", EXPIRED),
    ("log_confirm", CONFIRM, "nap", "open", "unclear"),
    ("log_confirm", CONFIRM, "yes", "open", "record.save"),
    ("log_confirm", CONFIRM, "no", "open", "cancelled"),
    ("log_confirm", CONFIRM, "yes", "resolved", EXPIRED),
    ("log_confirm", CONFIRM, "no", "expired", EXPIRED),
    # the yes-or-no kinds
    ("report_confirm", {}, "yes", "open", "labs.save_report"),
    ("report_confirm", {}, "no", "open", "cancelled"),
    ("report_confirm", {}, "the date is wrong", "open", "unclear"),
    ("lookup_confirm", {"cand": {}}, "ok", "open", "lookup.accept"),
    ("lookup_confirm", {"cand": {}}, "skip", "open", "cancelled"),
    ("log_repeat", {"text": "coffee"}, "yes", "open", "_process"),
    ("log_repeat", {"text": "coffee"}, "no", "open", "cancelled"),
    ("log_repeat", {"text": "coffee"}, "yes", "expired", EXPIRED),
    ("add_food_confirm", ADD, "correct", "open", "record.add_food"),
    ("add_food_confirm", ADD, "drop", "open", "cancelled"),
    ("add_food_confirm", ADD, "hm", "open", "unclear"),
    # not a question answer takes
    ("add_food", {}, "yes", "open", UNKNOWN),
]


@pytest.mark.parametrize("tool,payload,reply,state,expected", CASES)
def test_each_reply_takes_the_path_it_took_before_the_handlers(tool, payload, reply, state, expected):
    assert path(logbook.answer(ask(tool, payload, state), reply)) == expected


def test_no_such_question():
    out = logbook.answer("pnone", "yes")
    assert out == {"outcome": "rejected", "message": UNKNOWN}


def test_the_free_answers_follow_up_question_keeps_the_same_id(monkeypatch):
    monkeypatch.setattr(record, "answer", lambda cur, pid, reply, now: {"outcome": "needs_choice", "question": "Which of these?"})
    out = logbook.answer(ask("log", FOOD), "oats")
    assert out["questions"] == [{"question_id": "pa", "question": "Which of these?"}]


def test_a_closed_food_question_is_refused_in_record_answers_words(monkeypatch):
    monkeypatch.undo()  # the real record.answer
    ask("log", {**FOOD, "now": NOW}, "expired")
    assert logbook.answer("pa", "N1")["reason"] == "that question does not exist, was already answered, or has expired"

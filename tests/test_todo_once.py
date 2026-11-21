"""Core item 33 (21.11.2026): a Todoist task is made once. The add happens inside the transaction that saves a message (an
answer, a waiting item); when a later step of it failed, the rows rolled back but the task stayed, and the retry added it
again. Each create now has a key that is the same on every retry of the same request, and the task made for it is kept
in todo_sent (committed at once), so the retry takes it from there. A create whose answer was lost is not sent again: the
next try first looks for the task in Todoist (api/v1 documents no request id for POST /tasks)."""
import io
import urllib.error

import pytest

from app import logbook, maintenance, todoist, todos
from app.todoist import TodoistAPI, TodoistError
from conftest import owner_sql
from test_log import ANSWERS, D, P, fake, off, todo  # noqa: F401 - fixtures reused
from test_web import n

ACTS = "SELECT op, item, task_id, content, place, undone_at IS NOT NULL AS undone FROM todo_actions ORDER BY id"


def adds(todo):
    return [e[2] for e in todo.log if e[0] == "add"]


def fail_once(monkeypatch, module, name):
    """`module.name` raises the first time it is called: a step after the Todoist add, in the same transaction."""
    real, seen = getattr(module, name), []

    def step(*a, **k):
        if not seen:
            seen.append(1)
            raise RuntimeError("a later step failed")
        return real(*a, **k)
    monkeypatch.setattr(module, name, step)


def kept_id():
    return owner_sql("SELECT id FROM private.incoming")[0]["id"]


def undo_newest():
    asked = logbook.log("undo that")
    return logbook.answer(asked["questions"][0]["question_id"], "yes")


def test_a_task_is_made_once_when_the_save_fails_after_the_add(fake, todo, monkeypatch):
    fail_once(monkeypatch, logbook.lookup, "offer")
    assert logbook.log("todo: renew passport", "t1")["outcome"] == "held"  # the words stay kept ...
    assert adds(todo) == ["Renew passport"] and n("SELECT count(*) AS n FROM todo_actions") == 0  # ... the task stays made
    out = logbook.read_held(kept_id())
    assert out["outcome"] == "saved" and "Created: Renew passport (Paperwork)" in out["message"]
    assert adds(todo) == ["Renew passport"]  # not added again, and not placed again by the AI
    assert [c for c in fake.calls if c[0] == "Renew passport"] == [("Renew passport", todos.PLACE_MODEL)]
    tid = todo.log[0][1]
    assert owner_sql(ACTS) == [{"op": "created", "item": "Renew passport", "task_id": tid, "content": "Renew passport",
                                "place": "Paperwork", "undone": False}]  # as on a first success, so Undo knows it
    sent = owner_sql("SELECT once FROM todo_sent")
    assert len(sent) == 1 and len(sent[0]["once"]) == 64 and "passport" not in sent[0]["once"]  # a hash, not the words
    assert undo_newest()["outcome"] == "changed" and tid not in todo.tasks  # Undo of the message still deletes it


def test_a_shopping_item_made_before_the_failure_is_still_created_not_already_on_the_list(fake, todo, monkeypatch):
    monkeypatch.setitem(ANSWERS, "todo: buy potatoes", P(todos=[D("Potatoes")]))
    fail_once(monkeypatch, logbook.lookup, "offer")
    assert logbook.log("todo: buy potatoes", "t2")["outcome"] == "held"
    out = logbook.read_held(kept_id())
    assert "Created: Potatoes (Produce, aldi)" in out["message"] and "Already on your list" not in out["message"]
    assert adds(todo) == ["Potatoes"] and [a["op"] for a in owner_sql(ACTS)] == ["created"]
    undo_newest()
    assert not any(t["content"] == "Potatoes" for t in todo.tasks.values())


def test_new_to_a_question_is_made_once_when_the_answer_fails_after_the_add(fake, todo, monkeypatch):
    qid = logbook.log("todo: buy meat", "t3")["questions"][0]["question_id"]
    real, seen = logbook._audit, []

    def audit(cur, tool, *a, **k):  # the answer's audit row: after todos.answer made the task
        if tool == "answer" and not seen:
            seen.append(1)
            raise RuntimeError("a later step failed")
        return real(cur, tool, *a, **k)
    monkeypatch.setattr(logbook, "_audit", audit)
    with pytest.raises(RuntimeError):
        logbook.answer(qid, "new")
    assert adds(todo) == ["Meat"] and owner_sql("SELECT resolved_at FROM pending WHERE id = %s", qid)[0]["resolved_at"] is None
    out = logbook.answer(qid, "new")  # answered again
    assert out["outcome"] == "saved" and "Created: Meat (Meat & Seafood, aldi)" in out["message"]
    assert adds(todo) == ["Meat"] and [(a["op"], a["content"]) for a in owner_sql(ACTS)] == [("created", "Meat")]


def test_a_waiting_item_is_made_once_when_the_save_that_sends_it_fails(fake, todo, monkeypatch):
    todo.down = True
    assert "waits" in logbook.log("todo: renew passport", "t4")["message"]
    todo.down = False
    owner_sql("UPDATE todo_actions SET payload = payload - 'once'")  # one kept before this change: its own row's key
    fail_once(monkeypatch, logbook.lookup, "offer")
    assert logbook.log("weight 90", "t5")["outcome"] == "held"  # the waiting item was sent, then the save failed
    assert adds(todo) == ["Renew passport"]
    out = logbook.read_held(kept_id())
    assert out["outcome"] == "saved" and "Sent to Todoist now" in out["message"] and "Created: Renew passport (Paperwork)" in out["message"]
    assert adds(todo) == ["Renew passport"]
    assert [(a["op"], a["undone"]) for a in owner_sql(ACTS)] == [("waiting", True), ("created", False)]


def test_an_add_whose_answer_was_lost_is_found_and_not_made_again(fake, todo):
    todo.lost = 1  # Todoist made it, but the answer never came
    out = logbook.log("todo: renew passport", "t6")
    assert "'Renew passport' waits" in out["message"] and adds(todo) == ["Renew passport"]
    assert owner_sql("SELECT task->>'unsure' AS u FROM todo_sent")[0]["u"] == "true"
    out = logbook.log("weight 90", "t7")  # the next message sends what waits: it finds the task first
    assert "Created: Renew passport (Paperwork)" in out["message"] and adds(todo) == ["Renew passport"]
    assert [(a["op"], a["task_id"]) for a in owner_sql(ACTS)] == [("waiting", None), ("created", todo.log[0][1])]
    assert owner_sql("SELECT task->>'id' AS id FROM todo_sent")[0]["id"] == todo.log[0][1]


def test_an_add_whose_answer_was_lost_and_that_was_not_made_is_added_on_the_next_try(fake, todo):
    todo.lost = 1
    logbook.log("todo: renew passport", "t8")
    todo.tasks.pop(todo.log[0][1])  # it never arrived after all
    out = logbook.log("weight 90", "t9")
    assert "Created: Renew passport (Paperwork)" in out["message"] and adds(todo) == ["Renew passport", "Renew passport"]
    assert [t["content"] for t in todo.tasks.values()].count("Renew passport") == 1


def test_an_older_task_of_the_same_name_is_not_taken_for_a_lost_add(fake, todo):
    todo.tasks["old"] = {"id": "old", "content": "Renew passport", "project_id": todos.LISTS, "section_id": "l1", "labels": [],
                         "checked": False, "due": None, "added_at": "2026-01-01T10:00:00.000000Z"}
    todo.lost = 1
    logbook.log("todo: renew passport", "t10")
    lost = todo.log[0][1]
    todo.tasks.pop(lost)
    logbook.log("weight 90", "t11")
    made = [a["task_id"] for a in owner_sql(ACTS) if a["op"] == "created"]
    assert made and made[0] not in ("old", lost) and "old" in todo.tasks  # the owner's own task is left alone


class Wire:
    """urllib's urlopen, failing every call the same way and counting them."""
    def __init__(self, err):
        self.err, self.calls = err, 0

    def __call__(self, req, timeout=None):
        self.calls += 1
        raise self.err()


def http(code):
    return lambda: urllib.error.HTTPError("https://api.todoist.com/api/v1/tasks", code, "x", {}, io.BytesIO(b""))


@pytest.mark.parametrize("err, unsure_create", [(TimeoutError, True), (lambda: urllib.error.URLError("reset"), True),
                                                (lambda: ConnectionResetError("reset"), True), (http(503), True), (http(429), False)])
def test_a_create_is_never_sent_twice_but_a_read_is(monkeypatch, err, unsure_create):
    monkeypatch.setattr(todoist.time, "sleep", lambda s: None)
    wire = Wire(err)
    monkeypatch.setattr(todoist.urllib.request, "urlopen", wire)
    api = TodoistAPI("token")
    with pytest.raises(TodoistError) as e:
        api.add("Renew passport", todos.LISTS)
    assert e.value.unsure is unsure_create and wire.calls == (1 if unsure_create else 2)  # a 429 was not done: tried again
    wire.calls = 0
    with pytest.raises(TodoistError) as e:
        api.open_tasks(todos.LISTS)
    assert not e.value.unsure and wire.calls == 2


def test_the_nightly_clean_up_removes_old_rows():
    owner_sql("INSERT INTO todo_sent (once, task, at) VALUES ('a', '{}', now() - interval '8 days'), ('b', '{}', now() - interval '6 days')")
    assert maintenance.cleanup()["todo_sent"] == 1
    assert [r["once"] for r in owner_sql("SELECT once FROM todo_sent")] == ["b"]

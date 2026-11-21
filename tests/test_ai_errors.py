"""Core item 32 (21.11.2026): the AI client's own errors (a timeout, no connection, overloaded, a 5xx) come out of the provider
as ProviderError, with the client's error class kept as its `kind`. So every caller that catches ProviderError catches them:
a failed side step (the food look-up's pick, a to-do's placement, a label photo) no longer undoes a save or gives a 500,
while a failed main read still keeps the words for the next try, and the kept message and the audit row still name the kind."""
import anthropic
import httpx2
import pytest
from anthropic._exceptions import OverloadedError

from app import coach, labelread, logbook
from app.ai.provider import AnthropicProvider, ProviderError
from conftest import owner_sql
from test_coach import coach_me
from test_log import FakeProvider, fake, off, skyr, todo  # noqa: F401 - fixtures reused
from test_web import act, n, web  # noqa: F401

REQ = httpx2.Request("POST", "https://api.anthropic.com/v1/messages")


def timeout():
    return anthropic.APITimeoutError(request=REQ)


def no_connection():
    return anthropic.APIConnectionError(request=REQ)


def overloaded():
    return OverloadedError("Overloaded", response=httpx2.Response(529, request=REQ), body=None)


def server_error():
    return anthropic.InternalServerError("Internal server error", response=httpx2.Response(500, request=REQ), body=None)


class Client:
    """The API client, failing every call with one of its own errors (the real provider is used around it)."""
    def __init__(self, err):
        self.err, self.messages = err, self

    def with_options(self, **_):
        return self

    def create(self, **_):
        raise self.err()


def wire(err=timeout) -> AnthropicProvider:
    p = AnthropicProvider.__new__(AnthropicProvider)
    p.client, p.effort = Client(err), "low"
    return p


class Flaky(FakeProvider):
    """The tests' fake AI, except that calls whose input starts with one of `failing` go through the real provider to an API
    client that times out (the food look-up's pick: "Word: ", a to-do's placement: "Item: ")."""
    def __init__(self, *failing):
        super().__init__()
        self.failing = failing

    def json(self, system, user, schema, model, max_tokens=4000):
        if self.failing and isinstance(user, str) and user.startswith(self.failing):
            return wire().json(system, user, schema, model, max_tokens)
        return super().json(system, user, schema, model, max_tokens)


@pytest.fixture
def flaky():
    f = Flaky()
    logbook.PROVIDER = f
    yield f
    logbook.PROVIDER = None


@pytest.mark.parametrize("err", [timeout, no_connection, overloaded, server_error])
def test_the_api_clients_own_errors_are_provider_errors_that_keep_their_kind(err):
    p = wire(err)
    for call in (lambda: p.json("s", "u", {}, "claude-haiku-5-5"),
                 lambda: p.image_json("s", "u", [("image/png", b"x")], {}, labelread.MODEL)):
        with pytest.raises(ProviderError) as e:
            call()
        assert e.value.kind == type(err()).__name__ and isinstance(e.value.__cause__, anthropic.APIError)
    assert ProviderError("down").kind == "ProviderError"


def test_a_main_read_that_times_out_keeps_the_words_and_names_the_kind(fake, skyr):
    logbook.PROVIDER = wire(timeout)
    out = logbook.log("150 g skyr, weight 82.4", "k1")
    assert out["outcome"] == "held" and out["reason"].startswith("The AI service did not answer.")
    assert [r["last_error"] for r in owner_sql("SELECT last_error FROM private.incoming")] == ["APITimeoutError"]
    assert owner_sql("SELECT detail FROM audit_log WHERE tool = 'log'")[0]["detail"]["error"] == "APITimeoutError"
    assert n("SELECT count(*) AS n FROM food_entries") == 0


def test_a_food_look_up_that_times_out_does_not_stop_the_message(flaky):
    flaky.failing = ("Word: ",)
    out = logbook.log("50 g coconut", "k2")
    assert out["outcome"] == "needs_choice" and "USDA has" not in out["message"]  # saved; the plain food question stays
    assert n("SELECT count(*) AS n FROM private.incoming") == 0 and n("SELECT count(*) AS n FROM raw_inbox") == 1
    found = logbook.food_lookup(name="coconut")  # asked for on its own: a refusal that says why, not an error
    assert found["outcome"] == "rejected" and "The AI service did not answer" in found["message"]


def test_a_label_photo_the_ai_cannot_read_for_overload_says_so(fake):
    logbook.PROVIDER = wire(overloaded)
    out = labelread.read([("image/jpeg", b"\xff\xd8 a jpeg")])
    assert not out["ok"] and "could not read it" in out["reason"]


def test_a_to_do_the_ai_cannot_place_waits_and_the_message_is_saved(flaky, todo):
    flaky.failing = ("Item: ",)
    out = logbook.log("todo: buy milk, cola, potatoes", "k3")
    assert out["outcome"] == "saved" and "The AI service did not answer: 'Potatoes' waits" in out["message"]
    assert [r["op"] for r in owner_sql("SELECT op FROM todo_actions ORDER BY id")] == ["exists", "reopened", "waiting"]
    assert logbook.log("weight 90", "k4")["outcome"] == "saved"  # the retry of the waiting item fails again: still saved
    assert n("SELECT count(*) AS n FROM todo_actions WHERE op = 'waiting' AND undone_at IS NULL") == 1
    flaky.failing = ()
    out = logbook.log("weight 90 kg", "k5")
    assert "Sent to Todoist now" in out["message"] and "Created: Potatoes" in out["message"]
    assert [e[2] for e in todo.log if e[0] == "add"] == ["Potatoes"]


def test_new_to_a_shopping_question_while_the_ai_is_down_keeps_the_question(flaky, todo):
    body = logbook.log("todo: buy meat", "k6")
    qid = body["questions"][0]["question_id"]
    flaky.failing = ("Item: ",)
    out = logbook.answer(qid, "new")
    assert out["outcome"] == "rejected" and "The AI service did not answer" in out["message"]
    assert owner_sql("SELECT resolved_at FROM pending WHERE id = %s", qid)[0]["resolved_at"] is None
    flaky.failing = ()
    assert "Created: Meat" in logbook.answer(qid, "new")["message"]


def test_a_coaching_that_times_out_names_the_kind(web, monkeypatch):
    monkeypatch.setattr(coach, "PROVIDER", wire(timeout))
    monkeypatch.setattr(coach, "BACKGROUND", False)
    coach_me(web)
    assert owner_sql("SELECT status, error FROM coachings")[0] == {"status": "failed", "error": "APITimeoutError"}

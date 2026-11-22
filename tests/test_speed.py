"""Speed (02.11.2026): the AI's instructions stay cached for an hour, and the audit log records how long each AI call and
each message took, so real speeds can be compared over a week."""
from types import SimpleNamespace

from app import logbook
from app.ai.provider import AnthropicProvider, Usage
from conftest import owner_sql
from test_log import fake, off, skyr  # noqa: F401 - fixtures reused


def test_the_instructions_are_cached_for_an_hour():
    p = AnthropicProvider("sk-test")
    sent = {}

    def create(**kw):
        sent.update(kw)
        return SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text="{}")],
                               usage=SimpleNamespace(input_tokens=10, output_tokens=2, cache_read_input_tokens=0, cache_creation_input_tokens=5000))
    p.client = SimpleNamespace(messages=SimpleNamespace(create=create))
    out, u = p.json("the instructions", "a message", {"type": "object"}, "claude-haiku-5-5")
    assert out == {} and sent["system"][0]["cache_control"] == {"type": "ephemeral", "ttl": "1h"}
    assert round(u.usd, 6) == round((10 * 0.10 + 2 * 0.50 + 5000 * 0.20) / 1e6, 6)  # an hour's cache write costs twice the input price
    assert u.seconds >= 0


def test_the_seldom_called_models_send_no_cache_and_sonnets_cache_reads_cost_a_twentieth():
    p = AnthropicProvider("sk-test")
    sent = {}

    def create(**kw):
        sent.update(kw)
        return SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text="{}")],
                               usage=SimpleNamespace(input_tokens=1000, output_tokens=10, cache_read_input_tokens=2000, cache_creation_input_tokens=0))
    p.client = SimpleNamespace(messages=SimpleNamespace(create=create))
    for model in ("claude-sonnet-5-5", "claude-opus-5-5"):
        out, u = p.json("the instructions", "a message", {"type": "object"}, model)
        assert sent["system"] == [{"type": "text", "text": "the instructions"}], model
    _out, u = p.json("the instructions", "a message", {"type": "object"}, "claude-sonnet-5-5")
    assert round(u.usd, 6) == round((1000 * 2.00 + 10 * 10.00 + 2000 * 0.10) / 1e6, 6)


def test_the_audit_row_shows_how_long_the_message_and_each_ai_call_took(fake, skyr):
    real = fake.json

    def timed(*a, **k):
        out, u = real(*a, **k)
        return out, Usage(u.model, u.input_tokens, u.output_tokens, seconds=1.234)
    fake.json = timed
    assert logbook.log("150 g skyr, weight 82.4", "s1")["outcome"] == "saved"
    d = owner_sql("SELECT detail FROM audit_log WHERE tool = 'log'")[0]["detail"]
    assert [a["s"] for a in d["ai"]] == [1.23] and 0 <= d["secs"] < 30

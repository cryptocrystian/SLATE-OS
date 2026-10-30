"""Classification parity with the factory (docs/83 §5.2, §9.2). Both sides of every boundary."""
import json
from pathlib import Path

from buildos_worker.classify import classify_call, exit_error, is_provider_notice, parse_stream

FIX = Path(__file__).parent / "fixtures"


def stream(stop, out_tokens, text, err=None):
    msg = {"role": "assistant", "content": [{"type": "text", "text": text}],
           "usage": {"input": 5, "output": out_tokens, "cost": {"total": 0.01}}, "stopReason": stop}
    if err:
        msg["errorMessage"] = err
    return [json.dumps({"type": "session", "id": "s-1"}),
            json.dumps({"type": "message_end", "message": msg}),
            json.dumps({"type": "agent_end", "messages": [{"role": "user", "content": "go"}, msg]})]


def cls(lines, *, rc=0, stderr="", timed_out=False, envelope_ok=False):
    return classify_call(parse_stream(lines), returncode=rc, stderr=stderr, timed_out=timed_out, envelope_ok=envelope_ok)


def test_recorded_outages_are_provider_unavailable_with_advertised_wait():
    for name, needle, wait in [("codex-usage-limit.jsonl", "usage_limit_reached", 1800.0),
                               ("anthropic-overloaded.jsonl", "overloaded_error", 0.0)]:
        s = parse_stream((FIX / name).read_text().splitlines())
        assert needle in s.provider_error and s.final_text == "" and s.retry_after_s == wait
        c = classify_call(s, returncode=0, stderr="", timed_out=False, envelope_ok=False)
        assert c.outcome == "provider_unavailable" and c.retry_after_s == wait and not c.config_error


def test_retired_model_notice_is_provider_not_answer():  # 515fbe1
    c = cls(stream("error", 0, "Gemini 3 Pro is no longer available.", "stream ended without a finish reason"))
    assert c.outcome == "provider_unavailable" and "no longer available" in c.detail


def test_errored_after_real_output_is_model_output():
    s = parse_stream(stream("error", 812, '{"status":"succ', "connection dropped"))
    assert s.final_text.startswith('{"status"')
    assert classify_call(s, returncode=0, stderr="", timed_out=False, envelope_ok=False).outcome == "behaviour"


def test_answered_then_garbled_is_behaviour_even_with_absorbed_error():  # 2026-08-19 grok
    lines = stream("stop", 40, "not json") + [json.dumps({"type": "auto_retry_end", "success": False,
                                                          "finalError": "transient 500"})]
    assert cls(lines).outcome == "behaviour"


def test_pre_model_exit_is_provider_and_a_config_error():  # 8858e35
    c = cls([json.dumps({"type": "session", "id": "s"})], rc=1,
            stderr="error: No API key found for xai.\n\nUse /login, set an API key environment variable")
    assert c.outcome == "provider_unavailable" and c.config_error and "No API key found for xai" in c.detail
    assert exit_error(0, "noise") == ""


def test_our_timeout_resumes_rather_than_blaming_the_route():
    assert cls([], rc=-9, timed_out=True).outcome == "timeout"


def test_ok_envelope():
    c = cls(stream("stop", 30, '{"status":"success"}'), envelope_ok=True)
    assert c.outcome == "ok"


def test_missing_usage_is_never_a_notice():
    assert not is_provider_notice({"role": "assistant", "content": "x", "stopReason": "error"})


def test_tokens_are_counted_from_assistant_turns():
    s = parse_stream(stream("stop", 30, "{}"))
    assert (s.tokens_in, s.tokens_out) == (5, 30)

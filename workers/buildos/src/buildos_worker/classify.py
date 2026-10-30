"""Failure-classification doctrine (docs/83 §5.2). Ported from factory control-plane/omp.py.

Every rule here was paid for with a factory incident; each boundary is pinned by a
test on both sides. The single question it answers: when an agent call produced no
usable answer, is that the PROVIDER (infrastructure — hold, never a finding, never
an escalation) or the MODEL (behaviour — re-prompt the same session)?

  26c8da1  a rate-limited provider emits no envelope → infra, not a synthetic finding
  2026-08-19 grok case  answered-then-garbled is behaviour even if auto-retry absorbed an error
  515fbe1  a provider NOTICE in assistant text (stopReason=error, 0 output tokens) is infra
  8858e35  the harness failing before the model (no key) is infra, and a config alarm
"""
from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Iterable, Literal

CallOutcome = Literal["ok", "behaviour", "provider_unavailable", "timeout"]


@dataclass(frozen=True)
class StreamResult:
    session_id: str | None
    final_text: str
    cost_usd: float
    events: int
    provider_error: str
    retry_after_s: float
    tokens_in: int
    tokens_out: int


def is_provider_notice(msg: dict) -> bool:
    """A final assistant turn that ended in ERROR with ZERO output tokens is the provider
    talking, not the model (515fbe1: retired-model notices). Missing usage → not a notice."""
    if msg.get("stopReason") != "error":
        return False
    usage = msg.get("usage")
    if not isinstance(usage, dict) or "output" not in usage:
        return False
    try:
        return float(usage.get("output") or 0) == 0
    except (TypeError, ValueError):
        return False


def _text(content) -> str:
    if isinstance(content, str):
        return content
    return "".join(p.get("text", "") for p in (content or []) if isinstance(p, dict))


def parse_stream(lines: Iterable[str]) -> StreamResult:
    """Parse an OMP `--mode json` JSONL stream (the factory's verified adapter contract)."""
    session_id, final_text, provider_error = None, "", ""
    max_cost, retry_after_s, n = 0.0, 0.0, 0
    tok_in = tok_out = 0
    for ln in lines:
        ln = ln.strip()
        if not ln:
            continue
        try:
            ev = json.loads(ln)
        except json.JSONDecodeError:
            continue
        n += 1
        t = ev.get("type")
        if t == "session" and session_id is None:
            session_id = ev.get("id")
        msg = ev.get("message") if isinstance(ev.get("message"), dict) else None
        for m in ([msg] if msg else []) + (ev.get("messages") or []):
            u = (m or {}).get("usage") or {}
            c = u.get("cost")
            if isinstance(c, dict):
                max_cost = max(max_cost, float(c.get("total", 0.0) or 0.0))
        if msg and msg.get("role") == "assistant" and t == "message_end":
            u = msg.get("usage") or {}
            tok_in += int(u.get("input") or 0)
            tok_out += int(u.get("output") or 0)
        if isinstance(msg, dict) and msg.get("stopReason") == "error" and msg.get("errorMessage"):
            provider_error = str(msg["errorMessage"])
        if t == "auto_retry_end" and not ev.get("success"):
            fe = str(ev.get("finalError") or "")
            if fe:
                provider_error = provider_error or fe
            mm = re.search(r"[Pp]rovider requested (\d+)ms wait", fe)
            if mm:
                retry_after_s = max(retry_after_s, int(mm.group(1)) / 1000.0)
        if t == "agent_end":
            for m in ev.get("messages", []):
                if m.get("role") != "assistant":
                    continue
                txt = _text(m.get("content")).strip()
                if txt:
                    final_text = txt
                    if is_provider_notice(m):
                        provider_error = f"{m.get('errorMessage') or 'provider notice'} — provider said: {final_text[:200]}"
                        final_text = ""
    return StreamResult(session_id, final_text, max_cost, n, provider_error, retry_after_s, tok_in, tok_out)


def exit_error(returncode: int | None, stderr: str) -> str:
    """The harness failed BEFORE the model (missing key, unknown provider): non-zero exit with
    nothing but stderr to explain it (8858e35). Empty on a clean exit."""
    if returncode in (0, None):
        return ""
    lines = [l.strip() for l in (stderr or "").splitlines() if l.strip()]
    for l in lines:
        if l.lower().startswith("error:"):
            return f"harness exit {returncode}: {l[:200]}"
    return f"harness exit {returncode}: {lines[-1][:200] if lines else 'no output'}"


@dataclass(frozen=True)
class Classified:
    outcome: CallOutcome
    detail: str
    retry_after_s: float
    config_error: bool  # a route that cannot even authenticate → capacity alarm, never "healthy"


def classify_call(stream: StreamResult, *, returncode: int | None, stderr: str, timed_out: bool,
                  envelope_ok: bool) -> Classified:
    """One agent call → its outcome. `envelope_ok` = the final text parsed as the expected envelope."""
    if envelope_ok and stream.final_text:
        return Classified("ok", "", 0.0, False)
    if timed_out:
        # Our own timeout kill is ours, not the route's: the phase resumes the session.
        return Classified("timeout", "worker timeout", 0.0, False)
    if stream.final_text:
        # The model answered; the envelope did not parse → behaviour, re-prompt (even if a
        # transient provider error was absorbed mid-stream — the 2026-08-19 grok case).
        return Classified("behaviour", "envelope did not parse", 0.0, False)
    provider_error = stream.provider_error
    config_error = False
    if not provider_error:
        provider_error = exit_error(returncode, stderr)
        config_error = bool(provider_error)
    if provider_error:
        return Classified("provider_unavailable", provider_error, stream.retry_after_s, config_error)
    # No answer, no provider complaint, clean exit: treat as behaviour (re-prompt), never as
    # healthy capacity and never as a finding.
    return Classified("behaviour", "no final assistant message", 0.0, False)

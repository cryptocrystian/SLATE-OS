"""Model capacity at call time (docs/83 §5.1).

Every agent call runs inside a capacity slot: acquire → call → classify → release (with
usage, which writes the cost ledger and, on provider failure, marks the account down).
Judging roles walk the project's judge families in order; the control plane refuses any
family that would break I3, so the worker never has to be trusted on it.
"""
from __future__ import annotations

import time
from dataclasses import dataclass, field
from typing import Any, Callable, Sequence

from .classify import Classified
from .controlplane import ControlPlane, Family, Slot


class CapacityExhausted(Exception):
    """No family could serve the call. The run finishes held/provider_unavailable."""

    def __init__(self, role: str, retry_after_s: float, tried: list[str]):
        super().__init__(f"no capacity for {role}: tried {tried or 'nothing (no free slot)'}")
        self.role, self.retry_after_s, self.tried = role, retry_after_s, tried


@dataclass
class CallResult:
    classified: Classified
    model: str
    tokens_in: int = 0
    tokens_out: int = 0
    list_cost_usd: float = 0.0
    billed_cost_usd: float = 0.0
    output: Any = None  # the parsed envelope (lane-defined) when classified.outcome == "ok"


@dataclass
class CapacityGate:
    cp: ControlPlane
    run_id: str
    project_id: str
    sleep: Callable[[float], None] = time.sleep
    wait_budget_s: float = 600.0          # how long to wait for a FREE slot before giving up
    poll_s: float = 15.0
    on_wait: Callable[[], None] = lambda: None   # the runner passes its liveness check here
    log: list[dict] = field(default_factory=list)

    def call(self, role: str, families: Sequence[Family], invoke: Callable[[Slot, Family], CallResult]) -> CallResult:
        """Run `invoke` on the first family with a free, healthy slot. Provider failures fall
        through to the next family; behaviour/timeout outcomes are returned to the lane (they are
        the lane's to re-prompt or resume, not capacity's)."""
        waited = 0.0
        tried: list[str] = []
        worst_retry = 0.0
        while True:
            any_slot = False
            for fam in families:
                slot = self.cp.acquire_slot(self.run_id, fam, role)
                if slot is None:
                    continue
                any_slot = True
                result: CallResult | None = None
                try:
                    result = invoke(slot, fam)
                finally:
                    self.cp.release_slot(slot.lease_id, self._usage(result))
                c = result.classified
                self.log.append({"role": role, "family": fam, "account": slot.account_id, "outcome": c.outcome})
                if c.outcome != "provider_unavailable":
                    return result
                tried.append(f"{fam}:{slot.provider}")
                worst_retry = max(worst_retry, c.retry_after_s)
                if c.config_error:
                    # A route that cannot even authenticate is a configuration fault (8858e35).
                    self.cp.raise_alarm(self.project_id, "capacity", f"route:{fam}:{slot.provider}", c.detail[:400])
            if any_slot or waited >= self.wait_budget_s:
                # Every reachable family failed as a provider, or no slot freed in time.
                raise CapacityExhausted(role, max(worst_retry, 900.0), tried)
            self.on_wait()
            self.sleep(self.poll_s)
            waited += self.poll_s

    @staticmethod
    def _usage(result: CallResult | None) -> dict[str, Any]:
        if result is None:  # invoke raised: count the attempt, attribute no cost
            return {"model": "unknown", "outcome": "error"}
        c = result.classified
        outcome = {"ok": "ok", "provider_unavailable": "provider_unavailable"}.get(c.outcome, "error")
        usage: dict[str, Any] = {
            "model": result.model, "tokens_in": result.tokens_in, "tokens_out": result.tokens_out,
            "list_cost_usd": result.list_cost_usd, "billed_cost_usd": result.billed_cost_usd, "outcome": outcome,
        }
        if outcome == "provider_unavailable":
            usage["retry_after_s"] = c.retry_after_s
            usage["detail"] = c.detail[:1000]
        return usage

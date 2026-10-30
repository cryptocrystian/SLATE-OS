"""A lane that exercises the full control-plane contract without building anything.

Used by the contract tests and for smoke-testing a worker deployment against a TEST
project. It walks the phases, takes one builder and one judge slot through the capacity
gate (so the ledger, slots and I3 enforcement are exercised), and finishes accepted with
synthetic pins. Never point it at a real project: it would mark real work accepted.
"""
from __future__ import annotations

from .capacity import CallResult
from .classify import Classified
from .controlplane import Lease
from .runner import LaneResult, RunContext

NOOP_BASE_SHA = "0000000"


class NoopLane:
    def run(self, lease: Lease, ctx: RunContext) -> LaneResult:
        project = lease.project
        ctx.phase("plan", base_sha=NOOP_BASE_SHA, canon_ref="noop", branch=f"buildos/{lease.run_key}")
        ok = lambda slot, fam: CallResult(Classified("ok", "", 0.0, False), model=f"noop-{fam}")  # noqa: E731
        ctx.capacity.call("builder", [project["builder_family"]], ok)
        ctx.phase("review")
        ctx.capacity.call("reviewer", list(project["judge_families"]), ok)
        ctx.event("gate", phase="review", passed=True, detail={"gate": "noop"})
        return LaneResult("accepted", None, {"summary": "noop lane", "merge_sha": NOOP_BASE_SHA})

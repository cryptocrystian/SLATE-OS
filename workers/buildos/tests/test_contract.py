"""Worker ⇄ control-plane contract on the REAL migrations (docs/83 §10, B2.1 exit).

B2.1 exit criteria:
  1. a stub lane runs claim → heartbeat → slot → finish against the real schema;
  2. a killed worker is reaped worker_lost;
  3. classification fixtures match the factory (test_classify.py).
"""
import time

import pytest

from buildos_worker.capacity import CallResult
from buildos_worker.classify import Classified
from buildos_worker.controlplane import RosterViolation, WorkerDisabled
from buildos_worker.lanes_noop import NoopLane
from buildos_worker.runner import LaneResult, Worker


def make_worker(fx, lane, **kw):
    wid = fx.worker()
    return wid, Worker(fx.control_plane(wid), lane, heartbeat_interval_s=0.05, **kw)


def run_row(fx, run_id):
    return fx.one("select verdict, failure_class, lane_version, base_sha, summary, status from public.build_runs where id = %s", run_id)


def item_row(fx, item_id):
    return fx.one("select status, hold_reason, hold_until is null from public.build_work_items where id = %s", item_id)


def test_noop_lane_end_to_end(fx):
    p = fx.project("e2e")
    it = fx.item(p, "jrn-1")
    fx.account("anthropic")
    fx.account("openai")
    _, w = make_worker(fx, NoopLane())
    assert w.run_once() is True
    run_id, verdict, lane_version, base_sha = fx.one(
        "select id, verdict, lane_version, base_sha from public.build_runs where work_item_id = %s", it)
    assert (verdict, base_sha) == ("accepted", "0000000") and lane_version.startswith("buildos-worker/")
    assert item_row(fx, it)[0] == "accepted"
    ledger = fx.sql("select role, outcome from public.build_cost_ledger where run_id = %s order by id", run_id)
    assert ledger == [("builder", "ok"), ("reviewer", "ok")]
    kinds = [r[0] for r in fx.sql("select kind from public.build_run_events where run_id = %s order by id", run_id)]
    assert kinds.count("phase_start") == 2 and "gate" in kinds
    live = fx.one("select count(*) from public.build_capacity_leases where run_id = %s and released_at is null", run_id)[0]
    assert live == 0
    assert w.run_once() is False  # nothing left


def test_no_dispatch_without_a_healthy_judge(fx):
    p = fx.project("nojudge")
    fx.item(p, "jrn-1")
    fx.account("anthropic")
    fx.account("openai", health="down")
    _, w = make_worker(fx, NoopLane())
    assert w.run_once() is False


class Hang:
    """A lane that idles at safe points until something stops it."""

    def __init__(self, on_start=None, timeout=10.0):
        self.on_start, self.timeout = on_start, timeout

    def run(self, lease, ctx):
        ctx.phase("build", base_sha="abc1234")
        if self.on_start:
            self.on_start(lease)
        t0 = time.monotonic()
        while time.monotonic() - t0 < self.timeout:
            ctx.check()
            time.sleep(0.02)
        raise AssertionError("lane was never stopped")


def test_operator_cancel_finishes_aborted(fx):
    p = fx.project("cancel")
    it = fx.item(p, "jrn-1")
    fx.account("anthropic")
    fx.account("openai")
    lane = Hang(on_start=lambda lease: fx.sql(
        "update public.build_runs set cancel_requested_at = now() where id = %s", lease.run_id))
    _, w = make_worker(fx, lane)
    w.run_once()
    rid = fx.one("select id from public.build_runs where work_item_id = %s", it)[0]
    assert run_row(fx, rid)[:2] == ("aborted", "operator_abort")
    assert item_row(fx, it) == ("held", "operator_abort", True)  # waits for an operator


def test_lost_lease_stops_the_lane_and_never_finishes(fx):
    p = fx.project("lost")
    it = fx.item(p, "jrn-1")
    fx.account("anthropic")
    fx.account("openai")

    def expire_and_reap(lease):
        # Atomic w.r.t. the heartbeat thread (same connection lock): otherwise a beat landing
        # between the expiry and the reap legitimately renews the lease.
        with fx.shared():
            fx.sql("update public.build_runs set lease_expires_at = now() - interval '1 second' where id = %s", lease.run_id)
            fx.sql("select public.build__reap_expired(%s)", fx.ws)

    _, w = make_worker(fx, Hang(on_start=expire_and_reap))
    w.run_once()
    rid = fx.one("select id from public.build_runs where work_item_id = %s order by attempt_no limit 1", it)[0]
    assert run_row(fx, rid)[:2] == ("held", "worker_lost")


def test_killed_worker_is_reaped_worker_lost(fx):
    """B2.1 exit 2: a worker that claims and dies leaves nothing a reclaim cannot recover."""
    p = fx.project("killed")
    it = fx.item(p, "jrn-1")
    fx.account("anthropic")
    fx.account("openai")
    dead = fx.control_plane(fx.worker())
    lease = dead.claim()  # ...and the process dies here: no heartbeat, no finish
    fx.sql("update public.build_runs set lease_expires_at = now() - interval '1 second' where id = %s", lease.run_id)
    _, w = make_worker(fx, NoopLane())
    assert w.run_once() is False  # the claim reaps the dead run; the item backs off for 1 minute
    assert run_row(fx, lease.run_id)[:2] == ("held", "worker_lost")
    assert item_row(fx, it)[:2] == ("held", "worker_lost")
    fx.sql("update public.build_work_items set hold_until = now() - interval '1 second' where id = %s", it)
    assert w.run_once() is True  # after the backoff, a live worker picks it up and completes it
    assert item_row(fx, it)[0] == "accepted"


def test_unexpected_lane_error_is_a_precondition_not_transient(fx):
    class Boom:
        def run(self, lease, ctx):
            raise RuntimeError("origin dirty")
    p = fx.project("boom")
    it = fx.item(p, "jrn-1")
    fx.account("anthropic")
    fx.account("openai")
    _, w = make_worker(fx, Boom())
    w.run_once()
    rid = fx.one("select id from public.build_runs where work_item_id = %s", it)[0]
    verdict, cls, _, _, summary, _ = run_row(fx, rid)
    assert (verdict, cls) == ("held", "precondition") and "RuntimeError: origin dirty" in summary
    assert item_row(fx, it) == ("held", "precondition", True)


def test_all_judges_down_mid_run_holds_provider_unavailable_and_marks_accounts(fx):
    def provider_down(slot, fam):
        return CallResult(Classified("provider_unavailable", "usage_limit_reached", 1800.0, False), model="gpt-x")

    class JudgeFails:
        def run(self, lease, ctx):
            ctx.phase("review", base_sha="abc1234")
            ctx.capacity.call("reviewer", list(lease.project["judge_families"]), provider_down)
            return LaneResult("accepted", None)

    p = fx.project("judgedown", judges=("openai", "google"))
    it = fx.item(p, "jrn-1")
    fx.account("anthropic")
    o, g = fx.account("openai"), fx.account("google")
    _, w = make_worker(fx, JudgeFails())
    w.run_once()
    rid = fx.one("select id from public.build_runs where work_item_id = %s", it)[0]
    assert run_row(fx, rid)[:2] == ("held", "provider_unavailable")
    assert {fx.one("select health from public.build_provider_accounts where id = %s", a)[0] for a in (o, g)} == {"down"}
    outcomes = [r[0] for r in fx.sql("select outcome from public.build_cost_ledger where run_id = %s", rid)]
    assert outcomes == ["provider_unavailable", "provider_unavailable"]
    hold_mins = fx.one("select extract(epoch from hold_until - now()) / 60 from public.build_work_items where id = %s", it)[0]
    assert float(hold_mins) >= 29  # honours the advertised 30-minute cooldown


def test_unauthenticated_route_raises_a_capacity_alarm(fx):
    def no_key(slot, fam):
        return CallResult(Classified("provider_unavailable", "harness exit 1: error: No API key found", 0.0, True), model="m")

    class Lane:
        def run(self, lease, ctx):
            ctx.phase("review", base_sha="abc1234")
            ctx.capacity.call("reviewer", ["openai"], no_key)

    p = fx.project("nokey")
    fx.item(p, "jrn-1")
    fx.account("anthropic")
    fx.account("openai")
    _, w = make_worker(fx, Lane())
    w.run_once()
    alarm = fx.one("select kind, subject from public.build_alarms where project_id = %s and cleared_at is null", p)
    assert alarm[0] == "capacity" and alarm[1].startswith("route:openai")


def test_i3_violation_is_refused_by_the_control_plane(fx):
    class Cheats:
        def run(self, lease, ctx):
            ctx.phase("review", base_sha="abc1234")
            ok = lambda s, f: CallResult(Classified("ok", "", 0.0, False), model="m")  # noqa: E731
            ctx.capacity.call("reviewer", [lease.project["builder_family"]], ok)

    p = fx.project("i3")
    it = fx.item(p, "jrn-1")
    fx.account("anthropic")
    fx.account("openai")
    _, w = make_worker(fx, Cheats())
    w.run_once()
    rid = fx.one("select id from public.build_runs where work_item_id = %s", it)[0]
    verdict, cls, _, _, summary, _ = run_row(fx, rid)
    assert (verdict, cls) == ("held", "precondition") and "RosterViolation" in summary


def test_disabled_worker_cannot_claim(fx):
    wid = fx.worker()
    fx.sql("update public.build_workers set status = 'disabled' where id = %s", wid)
    with pytest.raises(WorkerDisabled):
        fx.control_plane(wid).claim()


def test_accepted_without_pins_is_converted_not_left_dangling(fx):
    class NoPins:
        def run(self, lease, ctx):
            ctx.phase("build")  # never pins base_sha
            return LaneResult("accepted", None)

    p = fx.project("nopins")
    it = fx.item(p, "jrn-1")
    fx.account("anthropic")
    fx.account("openai")
    _, w = make_worker(fx, NoPins())
    w.run_once()
    rid = fx.one("select id from public.build_runs where work_item_id = %s", it)[0]
    verdict, cls, _, _, summary, status = run_row(fx, rid)
    assert (status, verdict, cls) == ("finished", "held", "precondition") and "finish refused" in summary

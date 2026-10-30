"""The worker loop (docs/83 §2): claim → heartbeat → lane → finish.

Invariants:
  - exactly one finish per claimed run, unless the lease was lost (the control plane has
    already reaped it as worker_lost — finishing again would be refused anyway);
  - an operator cancel stops the lane at its next safe point and finishes aborted;
  - an unexpected exception is a PRECONDITION (needs an operator), never transient
    (factory 21eb357: retrying an unknown failure looped 384 times).
"""
from __future__ import annotations

import logging
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Protocol

import psycopg

from . import LANE_VERSION
from .capacity import CapacityExhausted, CapacityGate
from .controlplane import ControlPlane, ControlPlaneError, FailureClass, Lease, RunFinished, Verdict

log = logging.getLogger("buildos.worker")


class LeaseLost(Exception):
    """The control plane no longer considers this run ours. Stop; do not finish."""


class Cancelled(Exception):
    """An operator requested cancellation."""


@dataclass(frozen=True)
class LaneResult:
    verdict: Verdict
    failure_class: FailureClass | None
    payload: dict[str, Any] = field(default_factory=dict)


class RunContext:
    """What a lane may touch: liveness checks, phase/pin reporting, events, capacity."""

    def __init__(self, cp: ControlPlane, lease: Lease, heartbeat: "Heartbeat", capacity: CapacityGate):
        self.cp, self.lease, self._hb, self.capacity = cp, lease, heartbeat, capacity
        self._events: list[dict[str, Any]] = []

    def check(self) -> None:
        """Call at every safe point. Raises if the lease is lost or the run was cancelled."""
        if self._hb.lost.is_set():
            raise LeaseLost(self._hb.lost_reason)
        if self._hb.cancel.is_set():
            raise Cancelled()

    def phase(self, name: str, **pins: Any) -> None:
        self._hb.set_phase(name, pins or None)
        self.event("phase_start", phase=name)
        self.check()

    def event(self, kind: str, **fields: Any) -> None:
        self._events.append({"kind": kind, **{k: v for k, v in fields.items() if v is not None}})
        if len(self._events) >= 100:
            self.flush()

    def flush(self) -> None:
        if self._events:
            batch, self._events = self._events, []
            self.cp.report_events(self.lease.run_id, batch)


class Lane(Protocol):
    def run(self, lease: Lease, ctx: RunContext) -> LaneResult: ...


class Heartbeat:
    """Background lease keeper. 60 s cadence against a 300 s lease; a phase change beats now."""

    def __init__(self, cp: ControlPlane, run_id: str, interval_s: float = 60.0, give_up_s: float = 240.0,
                 clock: Callable[[], float] = time.monotonic):
        self.cp, self.run_id, self.interval_s, self.give_up_s, self.clock = cp, run_id, interval_s, give_up_s, clock
        self.cancel, self.lost = threading.Event(), threading.Event()
        self.lost_reason = ""
        self._phase: str | None = None
        self._pins: dict[str, Any] | None = {"lane_version": LANE_VERSION}
        self._wake, self._stop = threading.Event(), threading.Event()
        self._lock = threading.Lock()
        self._thread = threading.Thread(target=self._loop, name=f"hb-{run_id[:8]}", daemon=True)
        self._last_ok = clock()

    def start(self) -> None:
        self.beat()  # first beat carries the lane-version pin synchronously
        self._thread.start()

    def stop(self) -> None:
        self._stop.set()
        self._wake.set()
        self._thread.join(timeout=5)

    def set_phase(self, phase: str, pins: dict[str, Any] | None) -> None:
        with self._lock:
            self._phase = phase
            if pins:
                self._pins = {**(self._pins or {}), **pins}
        self.beat()

    def beat(self) -> None:
        with self._lock:
            phase, pins = self._phase, self._pins
        try:
            answer = self.cp.heartbeat(self.run_id, phase, pins)
        except RunFinished as e:
            self.lost_reason = str(e)
            self.lost.set()
            return
        except (psycopg.OperationalError, ControlPlaneError) as e:
            if self.clock() - self._last_ok > self.give_up_s:
                self.lost_reason = f"control plane unreachable for {self.give_up_s:.0f}s: {e}"
                self.lost.set()
            return
        self._last_ok = self.clock()
        with self._lock:
            if self._pins is pins:
                self._pins = None  # pins are immutable once set; send them once
        if answer == "cancel":
            self.cancel.set()

    def _loop(self) -> None:
        while not self._stop.is_set():
            self._wake.wait(self.interval_s)
            self._wake.clear()
            if self._stop.is_set() or self.lost.is_set():
                return
            self.beat()


class Worker:
    def __init__(self, cp: ControlPlane, lane: Lane, *, workspace_id: str | None = None,
                 heartbeat_interval_s: float = 60.0, capacity_factory: Callable[..., CapacityGate] | None = None):
        self.cp, self.lane, self.workspace_id = cp, lane, workspace_id
        self.heartbeat_interval_s = heartbeat_interval_s
        self._capacity_factory = capacity_factory or (lambda cp, run_id, project_id, on_wait: CapacityGate(
            cp, run_id, project_id, on_wait=on_wait))

    def run_once(self) -> bool:
        """Claim and execute at most one run. Returns True if a run was claimed."""
        lease = self.cp.claim()
        if lease is None:
            return False
        hb = Heartbeat(self.cp, lease.run_id, self.heartbeat_interval_s)
        hb.start()
        ctx: RunContext | None = None
        try:
            ctx = RunContext(self.cp, lease, hb, None)  # type: ignore[arg-type]
            ctx.capacity = self._capacity_factory(self.cp, lease.run_id, lease.project["id"], ctx.check)
            ctx.check()
            result = self.lane.run(lease, ctx)
        except LeaseLost as e:
            log.warning("run %s lease lost (%s); not finishing — the control plane reaps it", lease.run_key, e)
            return True
        except Cancelled:
            result = LaneResult("aborted", "operator_abort", {"summary": "Stopped by operator request."})
        except CapacityExhausted as e:
            result = LaneResult("held", "provider_unavailable",
                                {"summary": str(e)[:4000], "retry_after_s": e.retry_after_s})
        except Exception as e:  # noqa: BLE001 — every unknown failure is a precondition by doctrine
            log.exception("run %s failed unexpectedly", lease.run_key)
            result = LaneResult("held", "precondition", {"summary": f"{type(e).__name__}: {e}"[:4000]})
        finally:
            if ctx is not None:
                try:
                    ctx.flush()
                except ControlPlaneError:
                    log.warning("run %s: could not flush events", lease.run_key)
            hb.stop()
        if hb.lost.is_set():
            return True
        try:
            self.cp.finish(lease.run_id, result.verdict, result.failure_class, result.payload)
        except RunFinished:
            log.warning("run %s was already finished/reaped", lease.run_key)
        except ControlPlaneError as e:
            # The verdict was refused (e.g. accepted without pins): never leave the run dangling.
            log.error("run %s finish refused (%s); finishing held/precondition", lease.run_key, e)
            self.cp.finish(lease.run_id, "held", "precondition", {"summary": f"finish refused: {e}"[:4000]})
        return True

    def run_forever(self, stop: threading.Event, *, idle_min_s: float = 5.0, idle_max_s: float = 60.0,
                    alarms_every_s: float = 300.0) -> None:
        idle, last_alarms = idle_min_s, 0.0
        while not stop.is_set():
            if self.run_once():
                idle = idle_min_s
                continue
            if self.workspace_id and time.monotonic() - last_alarms >= alarms_every_s:
                try:
                    self.cp.evaluate_alarms(self.workspace_id)
                except ControlPlaneError as e:
                    log.warning("alarm evaluation failed: %s", e)
                last_alarms = time.monotonic()
            stop.wait(idle)
            idle = min(idle * 2, idle_max_s)

"""Typed client for the BuildOS worker RPCs (migration 0033; docs/83 §3).

The worker's ONLY interface to SLATE. Each call is its own transaction, so a
worker crash can never leave a half-applied state change: the control plane is
always consistent, and a lost worker is reaped by lease expiry.

Authentication is the Postgres login role (IN ROLE buildos_worker) carried by the
DSN. `assume_role` exists only for tests, where the connection is a superuser and
must SET ROLE to exercise the real grants.
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable, Iterator, Literal
import contextlib

import psycopg
from psycopg.types.json import Jsonb

Verdict = Literal["accepted", "rejected", "escalated", "held", "aborted"]
FailureClass = Literal[
    "rejected", "merge_conflict", "escalated", "provider_unavailable", "no_verdict",
    "worker_lost", "budget_exceeded", "precondition", "operator_abort",
]
Family = Literal["anthropic", "openai", "google", "xai", "other"]


class ControlPlaneError(Exception):
    """A control-plane refusal the worker did not anticipate."""


class WorkerDisabled(ControlPlaneError):
    """The worker id is unknown or disabled — an operator must act; the process exits."""


class RunFinished(ControlPlaneError):
    """The run is no longer running (reaped after lease loss, or already finished)."""


class RunNotOwned(ControlPlaneError):
    """Another worker owns this run."""


class RosterViolation(ControlPlaneError):
    """I3 / roster refusal from build_acquire_slot — a programming error in the lane."""


_ERROR_MAP: tuple[tuple[str, type[ControlPlaneError]], ...] = (
    ("build_worker_unknown_or_disabled", WorkerDisabled),
    ("build_run_finished", RunFinished),
    ("build_run_not_owned", RunNotOwned),
    ("build_i3_violation", RosterViolation),
    ("build_family_not_in_roster", RosterViolation),
)


def _translate(err: psycopg.Error) -> ControlPlaneError:
    msg = str(err)
    for needle, cls in _ERROR_MAP:
        if needle in msg:
            return cls(msg.splitlines()[0])
    return ControlPlaneError(msg.splitlines()[0] if msg else type(err).__name__)


@dataclass(frozen=True)
class Lease:
    """The claim payload (build_claim_run). Everything a run needs, nothing it keeps."""

    run_id: str
    run_key: str
    attempt_no: int
    mode: Literal["build", "remediate", "resume"]
    lease_expires_at: str
    resume_from_phase: str | None
    resume_branch: str | None
    project: dict[str, Any]
    work_item: dict[str, Any]

    @classmethod
    def from_json(cls, d: dict[str, Any]) -> "Lease":
        return cls(
            run_id=d["run_id"], run_key=d["run_key"], attempt_no=int(d["attempt_no"]), mode=d["mode"],
            lease_expires_at=str(d["lease_expires_at"]), resume_from_phase=d.get("resume_from_phase"),
            resume_branch=d.get("resume_branch"), project=d["project"], work_item=d["work_item"],
        )


@dataclass(frozen=True)
class Slot:
    lease_id: str
    account_id: str
    provider: str
    billing_class: str
    secret_ref: str


class ControlPlane:
    def __init__(self, connect: Callable[[], psycopg.Connection], worker_id: str, *, assume_role: str | None = None):
        self._connect = connect
        self.worker_id = worker_id
        self._assume_role = assume_role

    @contextlib.contextmanager
    def _tx(self) -> Iterator[psycopg.Cursor]:
        with self._connect() as conn:
            try:
                with conn.transaction(), conn.cursor() as cur:
                    if self._assume_role:
                        cur.execute("select set_config('request.jwt.claims', '', true)")
                        cur.execute(f'set local role "{self._assume_role}"')
                    yield cur
            except psycopg.errors.RaiseException as e:  # P0001 from the RPC guards
                raise _translate(e) from None
            except psycopg.errors.InsufficientPrivilege as e:
                raise ControlPlaneError(f"permission denied: {str(e).splitlines()[0]}") from None
            except psycopg.errors.CheckViolation as e:
                raise ControlPlaneError(f"check violation: {str(e).splitlines()[0]}") from None

    def _call(self, fn: str, *args: Any) -> Any:
        placeholders = ", ".join(["%s"] * len(args))
        with self._tx() as cur:
            cur.execute(f"select public.{fn}({placeholders})", args)
            row = cur.fetchone()
            return row[0] if row else None

    # ---- worker RPCs ---------------------------------------------------------
    def claim(self) -> Lease | None:
        d = self._call("build_claim_run", self.worker_id)
        return Lease.from_json(d) if d else None

    def heartbeat(self, run_id: str, phase: str | None, pins: dict[str, Any] | None = None) -> Literal["continue", "cancel"]:
        return self._call("build_heartbeat", self.worker_id, run_id, phase, Jsonb(pins) if pins else None)

    def report_events(self, run_id: str, events: list[dict[str, Any]]) -> int:
        total = 0
        for i in range(0, len(events), 500):  # the RPC caps a batch at 500
            total += int(self._call("build_report_events", self.worker_id, run_id, Jsonb(events[i:i + 500])) or 0)
        return total

    def acquire_slot(self, run_id: str, family: Family, role: str) -> Slot | None:
        d = self._call("build_acquire_slot", self.worker_id, run_id, family, role)
        return Slot(**d) if d else None

    def release_slot(self, lease_id: str, usage: dict[str, Any]) -> None:
        self._call("build_release_slot", self.worker_id, lease_id, Jsonb(usage))

    def report_account_health(self, account_id: str, health: str, detail: str, cooldown_s: float | None = None) -> None:
        self._call("build_report_account_health", self.worker_id, account_id, health, detail, cooldown_s)

    def finish(self, run_id: str, verdict: Verdict, failure_class: FailureClass | None, payload: dict[str, Any] | None = None) -> None:
        self._call("build_finish_run", self.worker_id, run_id, verdict, failure_class, Jsonb(payload or {}))

    def raise_alarm(self, project_id: str | None, kind: Literal["merge", "capacity"], subject: str, detail: str) -> None:
        self._call("build_worker_raise_alarm", self.worker_id, project_id, kind, subject, detail)

    def evaluate_alarms(self, workspace_id: str) -> int:
        return int(self._call("build_evaluate_alarms", workspace_id) or 0)

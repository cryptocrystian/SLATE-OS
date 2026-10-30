"""`buildos-worker` entry point (docs/83 §2, §11).

B2.1 ships the control-plane loop only. The real lane arrives in B2.2; until then the
only runnable lane is `noop`, refused unless --i-understand-noop is given, because it
would finish real work items without doing them.
"""
from __future__ import annotations

import argparse
import logging
import os
import signal
import sys
import threading

import psycopg

from .controlplane import ControlPlane, WorkerDisabled


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="buildos-worker")
    sub = ap.add_subparsers(dest="cmd", required=True)
    r = sub.add_parser("run", help="claim and execute runs")
    r.add_argument("--worker-id", required=True, help="build_workers.id registered in /app/build/capacity")
    r.add_argument("--workspace-id", help="enables periodic alarm evaluation while idle")
    r.add_argument("--dsn-env", default="BUILDOS_WORKER_DSN", help="env var holding the worker login DSN")
    r.add_argument("--lane", choices=["noop"], required=True)
    r.add_argument("--once", action="store_true")
    r.add_argument("--i-understand-noop", action="store_true",
                   help="the noop lane finishes claimed items WITHOUT building them; test projects only")
    a = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")

    dsn = os.environ.get(a.dsn_env)
    if not dsn:
        print(f"error: {a.dsn_env} is not set", file=sys.stderr)
        return 2
    if a.lane == "noop" and not a.i_understand_noop:
        print("error: the noop lane is for test projects only; pass --i-understand-noop", file=sys.stderr)
        return 2

    from .lanes_noop import NoopLane
    from .runner import Worker

    cp = ControlPlane(lambda: psycopg.connect(dsn, autocommit=False), a.worker_id)
    worker = Worker(cp, NoopLane(), workspace_id=a.workspace_id)
    stop = threading.Event()
    signal.signal(signal.SIGTERM, lambda *_: stop.set())
    signal.signal(signal.SIGINT, lambda *_: stop.set())
    try:
        if a.once:
            worker.run_once()
        else:
            worker.run_forever(stop)
    except WorkerDisabled as e:
        print(f"error: {e} — register or enable this worker in /app/build/capacity", file=sys.stderr)
        return 3
    return 0


if __name__ == "__main__":
    sys.exit(main())

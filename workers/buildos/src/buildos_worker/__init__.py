"""BuildOS execution-plane worker (docs/83). BUILDOS MODULE.

Stateless: everything the worker needs comes from the control plane's lease, and
everything it learns goes back through the 0033 worker RPCs. A worker that dies
mid-run loses nothing — its lease expires and the run is reaped `held/worker_lost`.
"""

__version__ = "0.1.0"
LANE_VERSION = f"buildos-worker/{__version__}"

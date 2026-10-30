# BuildOS — Execution-Plane Design (B2) — docs/83

## Status

- **Date:** 2026-10-30
- **Branch:** `buildos/b2-worker` (from trunk `3586b89`)
- **Owner:** BuildOS. The doc number was reserved in `ops/claims.json`.
- **Authority:** implements `docs/80 §5–§7` under `docs/81`. `docs/80` rulings D4
  (sandbox bake-off), D5 (DB principal + RPCs) and D6 (Python worker) are binding here.
- **Scope:** the worker package, its contract with the control plane (migration
  `0033`), the port map from the software factory, model capacity at call time,
  merge flow, isolation and secrets, the parity plan, and the B2 slice plan.

---

## 1. Where the worker lives

**`workers/buildos/`** in the SLATE repo: a Python 3.12 package managed by `uv`.

- The worker RPC contract (`0033`) and the worker change together in one branch
  and one review. A contract change can never ship with a stale client.
- The factory repo (`~/factory`) stays frozen to bug fixes (B0). Its modules are
  **ported**, not imported. The factory is the reference implementation that
  parity is measured against (§9), not a runtime dependency.
- The Next.js build ignores `workers/`. The worker never imports app code, and
  the app never imports the worker. Their only shared surface is the database contract.

```
workers/buildos/
  pyproject.toml
  src/buildos_worker/
    controlplane.py     # typed client for the 0033 worker RPCs (psycopg)
    runner.py           # claim → heartbeat → lane → finish loop; crash/cancel handling
    classify.py         # failure-classification doctrine → docs/81 failure_class
    capacity.py         # per-call slot acquire/release + provider health (§5)
    profiles.py         # stack + canon profile loading/validation (§4)
    canon.py            # canon parsing driven by a canon profile (port of factory canon.py)
    lane/               # (B2.2) the feature lane, ported from factory lanes/feature.py
    agents/             # (B2.2) Agent port + OMP adapter (port of factory omp.py)
    isolation/          # (B2.4) Isolation port + adapters (§7)
  profiles/
    stack/next-supabase.toml
    canon/arxus-v2.toml
  tests/                # unit (fake transport) + contract tests on PGlite (real migrations)
```

## 2. Process model

One worker process runs one run at a time. Scale comes from more processes or
hosts; each is stateless (`docs/80 §5.1`).

```
loop:
  lease = claim_run(worker_id)            # null → sleep with backoff (5s → 60s), evaluate alarms every 5 min
  start heartbeat thread (every 60 s; lease is 300 s)
      heartbeat returns "cancel" → set cancel flag → lane stops at next safe point
  result = lane.run(lease, ctx)           # ctx: capacity gate, event reporter, cancel flag, isolation
  finish_run(verdict, failure_class, payload)
  stop heartbeat
```

**Crash safety.** The worker holds no state the control plane doesn't have.
- **The process dies:** the lease expires, and the next claim or alarm evaluation
  reaps the run as `held/worker_lost` (verified in `docs/82`).
- **The lane raises unexpectedly:** the runner finishes the run `held/precondition`
  with the exception class in `summary`. A precondition failure needs an operator.
  Unknown errors are never treated as transient (factory `21eb357`).
- **A heartbeat fails to reach the control plane:** the runner retries with backoff
  for up to 240 s (inside the 300 s lease). If it still can't connect, it aborts
  the lane, because the lease is lost and continuing would be double work.

## 3. Control-plane contract (`0033`)

The worker connects with a Postgres **login role `IN ROLE buildos_worker`**
(`docs/81 §11`) over the Supabase pooler DSN, read from `BUILDOS_WORKER_DSN`. It
calls only these functions:

| RPC | Worker use | Errors the worker must handle |
|---|---|---|
| `build_claim_run(worker)` → lease \| null | Get work | `build_worker_unknown_or_disabled` → exit non-zero (operator action) |
| `build_heartbeat(worker, run, phase, pins)` → `continue` \| `cancel` | Every 60 s, and at every phase change; pins on the first call | `build_run_finished` → lease lost, abort the lane |
| `build_report_events(worker, run, events[])` | Batches of ≤ 500 | `build_events_batch_invalid` → split the batch |
| `build_acquire_slot(worker, run, family, role)` → slot \| null | Before **every** agent call | `build_i3_violation` → programming error, abort `precondition`. Null → no capacity (§5). |
| `build_release_slot(worker, lease, usage)` | After every call, success or failure | `build_lease_unknown` → log and continue |
| `build_report_account_health(worker, account, health, detail, cooldown)` | Canary results (§5.3) | — |
| `build_finish_run(worker, run, verdict, class, payload)` | Exactly once per run | `build_run_finished` → already reaped; log it. `build_runs_verdict_class` / `build_runs_accepted_pinned` → bug, finish `held/precondition`. |
| `build_worker_raise_alarm(worker, project, kind, subject, detail)` | `merge` / `capacity` alarms | — |
| `build_evaluate_alarms(ws)` | Every 5 min while idle (B2's alarm scheduler) | — |

The lease payload is the claim's JSON: run key, mode, resume phase and branch,
project (repo, branch, profiles, roster), and work item. A `resume` mode lease
**must** start at `resume_from_phase` on `resume_branch` (`docs/80 §7.3`).

## 4. Profiles

Profiles are TOML files in `workers/buildos/profiles/`, versioned with the lane.
A worker advertises the stack profiles it can run in `build_workers.capabilities`.

**Stack profile** (`stack/<key>.toml`): `l0_gates` (ordered commands, each with a
name), `test_command`, `protected_paths`, `migration_gate` (a command run against
an in-sandbox throwaway Postgres), `install_command`, and `sandbox_image`. For
`next-supabase`, these are extracted from the gates Arxus currently runs
(`factory/lanes/feature.py:520-523`).

**Project overlay.** Gates a single project adds on top of its stack, e.g.
Arxus's `test:gates`, `check:tokens` and `check:composition`. They belong to the
project, not to the stack:
- **Normal location:** `buildos.toml` at the project repo root, `[gates].extra_l0`.
- **Interim fallback:** a project that has no `buildos.toml` yet uses
  `profiles/project/<project_key>.toml` in the worker package. Arxus does this
  until its repo carries the file.
- When both exist, the repo file wins.

**Canon profile** (`canon/<key>.toml`): the file paths for journeys, acceptance,
decisions and ontology; the journey heading pattern; and the binding syntax.
`arxus-v2` reproduces `factory/control-plane/canon.py:36-72` exactly. The parity
suite checks it binds every Arxus journey the same way the factory does.

Role prompts are **generic charters** plus the stack profile plus canon excerpts
fetched at run time. No project DEC numbers appear in a prompt (`docs/81 §8`).

## 5. Model capacity at call time

### 5.1 The call wrapper

Every agent call goes through `capacity.call(role, family, fn)`:

1. `acquire_slot(run, family, role)`. If it returns null, wait with backoff up to
   10 min while heart-beating. If it is still null, finish `held/provider_unavailable`
   with `retry_after_s` = 900. The control plane already refused to *dispatch*
   without capacity; this covers capacity that disappears mid-run.
2. Resolve `secret_ref` through the secret resolver (§7.2) and run the call.
3. Classify the result (§5.2) and call `release_slot` with usage: tokens, list and
   billed cost, outcome and `retry_after_s`. `provider_unavailable` marks the
   account down server-side.
4. On `provider_unavailable`, try the next judge family in the roster (the
   control plane enforces I3), up to every healthy family. When none remains,
   the phase is `provider_unavailable`.

### 5.2 Classification doctrine (port of the factory, with the 2026-10-02 fixes)

| Observation | Class | Factory source |
|---|---|---|
| Provider error, rate limit or quota (`stopReason=error`, `usage_limit_reached`, 429) and no answer | `provider_unavailable` (+ advertised cooldown) | `omp._parse_stream`, `26c8da1` |
| Final assistant turn `stopReason=error` with **0 output tokens** (a provider notice, e.g. retired model) | `provider_unavailable` | `515fbe1` |
| Harness exits non-zero before the model answers (no key, unknown provider) | `provider_unavailable` + `capacity` alarm (configuration) | `8858e35` |
| The model answered but the envelope did not parse | behaviour → re-prompt the same session (bounded) | `omp.AgentResult.infra_failed` |
| Judge produced no envelope after re-prompts | `no_verdict` | `PhaseUnavailable("no_verdict")` |
| The worker's own timeout killed the call | resume (not infra) | `omp.run` timeout path |

`classify.py` encodes this table, and its tests pin both sides of every boundary,
as `selftest_k1` does.

### 5.3 Canary

While idle, the worker runs a canary per account at most every 10 min: one
trivial completion through the same classifier, reported with
`build_report_account_health`. Every route in a roster is validated at worker
startup. An unauthenticated route raises a `capacity` alarm, and is never
"healthy" (`docs/80 §6.3`).

## 6. Merge flow (PR-based, `docs/80 §5.3`)

1. Work happens on branch `buildos/<project_key>/<item_key>/<attempt>`, pushed to
   the project remote. The branch name is reported in the heartbeat pins.
2. After review accepts and the L0 gates pass, the worker opens a PR and records
   `pr_url`.
3. **Merge with a base check (I11).** The worker merges through the git host API
   with the expected head SHA, and only if the default branch head equals the
   `base_sha` the gates ran on. If the base has advanced, it rebases and re-runs
   the L0 gates, retrying up to 2 times. A conflict or failed gate finishes the
   run `rejected/merge_conflict`, and the worker files a remediation item.
4. Only a **merged** PR finishes `accepted` with `merge_sha`. A conflict affects
   that run only; it can never wedge the repository (factory `15b3c73`).

## 7. Isolation and secrets

### 7.1 Isolation port

`acquire(lease) → workspace`, `exec(cmd)`, `destroy()`. Adapters:

| Adapter | Allowed for | Status |
|---|---|---|
| `local-worktree` | `internal` projects, single stream, B2 development and parity only | B2.2 (ported from `factory/control-plane/isolation.py`) |
| Bake-off candidates (D4): exe.dev VM · a container service · a managed sandbox | all, including `client` | B2.4 decides; the result is recorded here |

A worker advertises its isolation level as a capability (`sandbox:none` |
`sandbox:vm`). **A `client` project is never run without `sandbox:vm`.** That
check is added to `build_claim_run` in B2.4 (it needs a migration, claimed then).

**Bake-off criteria** (each measured on the same Arxus journey):
- cold start;
- per-run cost;
- egress allow-listing;
- Postgres-in-sandbox for the migration gate;
- an API to create and destroy sandboxes;
- secret injection;
- maximum run length of at least 3 h.

### 7.2 Secrets

Provider accounts store only `secret_ref` (`docs/81 §7`). The worker resolves a
ref through a **secret resolver port**:
- **B2:** an env-file resolver. The ref maps to an environment variable in a
  root-owned file on the worker host.
- **B2.4:** the chosen manager.

Secrets are injected into the sandbox per call or per run. They are never written
into the workspace or the repo, and never sent to the control plane.

## 8. Port map: factory → worker

| Factory | Worker | Change |
|---|---|---|
| `control-plane/envelopes.py` | `lane/envelopes.py` | as-is |
| `control-plane/permissions.py` | `lane/permissions.py` | protected paths come from the stack profile |
| `control-plane/gates.py`, `ledger.py`, `readiness.py` | `lane/gates.py`, `lane/ledger.py` | commands from the stack profile; readiness moves to intake (B2.3) |
| `control-plane/canon.py` | `canon.py` | file layout and binding syntax from the canon profile |
| `control-plane/omp.py` | `agents/omp.py` + `classify.py` | classification lifted into `classify.py`; slots through `capacity.py` |
| `control-plane/isolation.py` | `isolation/local_worktree.py` | merge replaced by the PR flow (§6) |
| `lanes/feature.py` | `lane/feature.py` | events through `report_events`; ladder and convergence guards kept |
| `agents/*/system.md` | `agents/charters/*.md` | Arxus DECs removed; project canon injected at run time |
| `orchestrator.py`, `statefile.py` | — | replaced by `build_claim_run` (scheduling in the DB) |
| `obsdb.py`, `tracer.py`, `observe.py` | — | replaced by `build_run_events` and `/app/build` |
| `quota.py`, `meter.py` | `capacity.py` | replaced by slots and the cost ledger |
| `buzz.py`, `notifier.py` | — | later, as a notifier adapter (D2) |
| `verify.py` goldens | `tests/parity/` | the parity suite (§9) |

## 9. Parity and the B2 exit

The B2 exit criteria are in `docs/80 §11`. The parity suite proves it:

1. **Replay parity.** The factory's recorded golden runs
   (`control-plane/goldens/`) run through the ported lane with a replay agent,
   and must reach the same verdict and gate sequence.
2. **Classification parity.** `classify.py` must reproduce every factory
   classification fixture, including the 2026-10-02 outage streams.
3. **Canon parity.** `arxus-v2` must give the same bindings as factory
   `canon.bindings()` for every Arxus journey.
4. **Live proof.** One remaining Arxus journey (T1) runs through BuildOS end to
   end. That requires activating the `arxus` project and therefore stopping the
   factory daemon first (D9), so the two systems never build the same item.

## 10. B2 slices

| Slice | Content | Exit |
|---|---|---|
| **B2.1** (this branch) | Package skeleton, control-plane client, runner loop with heartbeat/cancel/crash handling, `classify.py`, profiles + `arxus-v2` canon parity, contract tests on PGlite against the real migrations | A stub lane runs claim → heartbeat → slot → finish against the real schema. A killed worker is reaped `worker_lost`. Classification fixtures match the factory. |
| B2.2 | Lane + Agent port (OMP adapter), `local-worktree` isolation, PR merge flow | Replay parity passes |
| B2.3 | Readiness validator at intake, canary + startup route validation, alarm scheduling | An injected all-judges-down state → capacity hold + alarm + zero builder spend |
| B2.4 | Sandbox bake-off, secret manager, `sandbox:vm` capability gate (migration) | Decision recorded in §7 |
| B2.5 | Worker login role created (founder), worker registered, Arxus T1 live, factory retired | `docs/80` B2 exit |

## 11. Operations (out-of-band, founder-approved)

The worker login role is created in production by the release owner. It is never
created in a migration, because it carries a password:

```sql
create role buildos_worker_<host> login password '<from secret manager>' in role buildos_worker;
```

Register the worker in `/app/build/capacity` with the same `name`. Provider
accounts are added there (owner only), with `secret_ref` values matching the
worker host's resolver.

# BuildOS B1 — Control-Plane Foundation Acceptance Audit — docs/82

## Status

- **Date:** 2026-10-02
- **Branch:** `persistence/step-0-1-auth-shell`
- **Scope:** `docs/80 §11` B1, under the conventions in `docs/81`.
- **Verdict:** **BUILT AND VERIFIED IN-PROCESS.** All three B1 exit criteria pass on
  PGlite. **Nothing has been applied to any Supabase project**, and there has been no
  live UI walkthrough. Both are held for founder go-ahead (§5).

---

## 1. What was built

| Area | Artifact | Owner |
|---|---|---|
| Schema + RLS | `0030_buildos_projects_work_items.sql`, `0031_buildos_runs_capacity.sql`, `0032_buildos_decisions_deployments.sql`, `0033_buildos_engine_rpcs.sql` | BuildOS |
| Worker principal (D5) | `buildos_worker` NOLOGIN role with RPC-only grants (`0033`) | BuildOS |
| Engine RPCs | Worker: `build_claim_run`, `build_heartbeat`, `build_report_events`, `build_acquire_slot`, `build_release_slot`, `build_report_account_health`, `build_finish_run`, `build_worker_raise_alarm`. Operator: `build_rule_decision`, `build_request_cancel`, `build_clear_alarm`. Both: `build_evaluate_alarms`. | BuildOS |
| Service layer | `lib/build/{types,validation,authorization,activity,queries,service,actions}.ts` | BuildOS |
| Operator UX | `/app/build` (portfolio, alarms, capacity strip), `/app/build/new`, `/app/build/[projectId]`, `/app/build/[projectId]/runs/[runId]`, `/app/build/decisions`, `/app/build/capacity`; `components/build/*`; sidebar "Build" group | BuildOS |
| Import | `scripts/build/import-factory-project.cjs`: factory backlog + canon journeys → one reviewed SQL transaction | BuildOS |
| Platform touches | `check-migration-sequence` accepts the `buildos_` prefix; `.gitignore` `build/` anchored to the root (it was ignoring `tests/build` and would have ignored `lib/build`); ESLint boundary rules extended to BuildOS | Platform |

No ConsultOS or GovernanceOS code changed. No new runtime dependency was added. The
importer uses `js-yaml`, which is already in the lockfile.

## 2. Exit criteria (`docs/80 §11` B1)

| # | Criterion | Evidence | Result |
|---|---|---|---|
| 1 | Two seeded projects with overlapping canon keys never cross-read | `tests/build/b1-spine.db.test.ts` › "two projects (two workspaces) both with JRN-S1…": the runs are distinct, a member of workspace B reads none of A's runs, and a worker cannot finish another workspace's run (`build_run_not_owned`) | **PASS** |
| 2 | A simulated lease expiry requeues the run with `worker_lost` | › "lease expiry finishes the run held/worker_lost…": the run finishes `held/worker_lost`, the item is held for 1 min and then reclaimable as `lease/l1/2`, and a late heartbeat is refused | **PASS** |
| 3 | The claim RPC refuses dispatch when the judge family has no healthy account | › "refuses to claim when every judge account is down, and alarms…": the claim returns null, a `capacity/judge` alarm is raised, and once the canary reports healthy the claim succeeds and the alarm clears | **PASS** |

## 3. Additional invariants verified

All of these are in `tests/build/b1-spine.db.test.ts`, `tests/build/domain.test.ts` and
`tests/build/import.db.test.ts`.

**Projects**
- Projects start in intake; `ready` needs a readiness record; `closed` is terminal; I3 holds on the roster.
- A ConsultOS origin is client-isolated and holds its engagement (deletion is refused with `retention_hold_active … buildos`); the hold is released on close.

**Scheduling**
- The decomposition gate serializes overlapping bindings and parallelizes disjoint ones; a `'*'` foundation serializes the whole project.
- WIP caps, acyclic same-project dependencies, and stride fair share (equal weights alternate) all hold.

**Capacity**
- Client projects count only metered accounts.
- Per-call slots enforce I3 (`build_i3_violation`) and `max_concurrency`.
- Releasing a slot writes the cost ledger; a provider failure marks the account down with its cooldown.

**Finish transitions (`docs/81 §5.1`)**
- `accepted` requires pins; a finished run is immutable; verdict and failure class must match.
- `precondition` waits for an operator; `provider_unavailable` honours the advertised cooldown.
- The **thrash rule** parks an item after 5 identical failures and raises an alarm. This is the 384-run / 27-cycle loop class from the factory.
- Rejection past `max_attempts` escalates a technical decision. A ruling resets the attempt budget and **never dispatches** (B8).
- An escalated run must carry a decision payload. A decision is immutable and is ruled once, with option validation.
- Operator cancel reaches the worker through the heartbeat.

**Authorization (`docs/81 §11`)**
- Operators cannot write runs, decisions or engine-only item transitions or fields.
- The worker principal has no table access and cannot call operator RPCs.
- Authenticated users cannot call worker RPCs; anon gets nothing.
- Alarm evaluation is workspace-scoped for end users.
- Events and the ledger are append-only.

**Import**
- The importer maps factory states, keeps dependencies, lists decision items (not imported), leaves the project `ready` (never `active`) and is one-shot.
- Dry-run on the real Arxus canon: titles and `Touches:` bindings parsed correctly.

**Mutation check**
- Disabling the decomposition gate fails test 1 of "scheduling".
- Disabling the judge-capacity check fails exit criterion 3.

## 4. Verification run

| Check | Result |
|---|---|
| `vitest run` (whole repo) | **103/103 pass**, 9 files: 61 pre-existing + 42 BuildOS |
| `tsc --noEmit` | clean |
| `next lint` | clean; the boundary rules were verified to fire on probe imports (removed afterwards) |
| `next build` | clean; all six `/app/build` routes compile |
| `check:migrations` | 33 in sequence; next free `0034` |

Two defects were found and fixed during B1, both before commit:
1. `build_evaluate_alarms` authorized on `current_user`, which is the owner inside `SECURITY DEFINER`. It now authorizes on the caller's JWT.
2. The work-item guard did not give privileged callers the operator transition table (found by the import test).

## 5. Not done in B1 (by design or held)

| Item | Why | Next |
|---|---|---|
| Apply `0030`–`0033` to production | Held for founder go-ahead. Verify first on a short-lived Supabase dev branch (cost, per `docs/72` Q-G0-2). | Founder decision |
| Live signed-in walkthrough of `/app/build` | Needs the migrations applied | After apply |
| Import the real Arxus state | The live queue is `/root/factory/backlog.yml` on the factory host; the local copy is stale (5 items vs 16+ accepted). Generate with the importer against the live copy, review, apply. | After apply |
| Worker principal login | `CREATE ROLE … LOGIN IN ROLE buildos_worker` with a secret-manager password, out-of-band | B2 |
| Canon-profile readiness validator | B1 records an operator attestation at `intake → ready` | B2 (worker side) |
| Alarm scheduler | `build_evaluate_alarms` is idempotent but nothing calls it on a schedule yet (the operator button and the claim-time reaping do) | B2 |
| Deployment UX + governance gate | The table exists; the gate call is B4 | B4 |

## 6. Ledger

| Work item | Owner | Done |
|---|---|---|
| `build_*` schema, RLS, guards, engine and operator RPCs | BuildOS | ✓ |
| `lib/build/*`, `/app/build/**`, `components/build/*`, sidebar entry | BuildOS | ✓ |
| Importer + tests | BuildOS | ✓ |
| Migration-guard prefix, `.gitignore`, lint boundary | Platform (domain-agnostic) | ✓ |
| ConsultOS / GovernanceOS code | none | — (untouched) |

## 7. Production apply record (2026-10-05)

- **Approved by** the founder (2026-10-03). Applied by Claude via the Supabase MCP to `hhglrcvsmwaheikdvijw` (SLATE OS), verbatim from `09d7c56`.
- **Applied, in order:** `0030_buildos_projects_work_items`, `0031_buildos_runs_capacity`, `0032_buildos_decisions_deployments`, `0033_buildos_engine_rpcs`. All four are recorded in `supabase_migrations`.
- **Dev-branch step skipped.** The attempted branch (`buildos-b1-verify`) could not replay the base schema, because 0001–0017 predate migration tracking. It was deleted. The migrations are additive-only (new `build_*` objects plus the `buildos_worker` role), so production was verified directly:
  1. **Catalog check.**
     - All 12 `build_*` tables have RLS enabled.
     - anon has no select on any of them; `buildos_worker` has no table privileges.
     - Worker RPCs are executable only by `buildos_worker` (+ service_role); operator RPCs only by `authenticated`; internal helpers and guards by no API role.
     - `buildos_worker` is NOLOGIN, not superuser, and has no RLS bypass.
  2. **Functional smoke test**, inside a block that always raises, so it was fully rolled back (row counts verified at 0 afterwards):
     - As the workspace owner: created a project and an item, and moved the project through ready → active.
     - Operator `→ in_progress` was refused (`invalid_transition`); an operator insert into `build_runs` was refused (permission denied); an operator call to `build_claim_run` was refused (permission denied).
     - With the judge account down, the claim returned null; with it healthy, the claim succeeded (`smoke-test/smoke-1/1`).
  3. **Security advisors.** No errors and no RLS gaps. The only BuildOS findings are lint 0029 ("signed-in users can execute SECURITY DEFINER") on the five operator RPCs, which is intended: each authorizes internally. Pre-existing platform warnings are unchanged.
- **Not yet done:**
  - Signed-in UI walkthrough of `/app/build`. It needs a site deploy; Vercel production does not auto-deploy from this branch.
  - The worker login role.
  - (The live Arxus import was completed later the same day; see §8.)

## 8. Arxus import (2026-10-05)

- **Source:** the live factory queue `/root/factory/backlog.yml`, read from the VPS with the founder's authorization while the daemon was stopped. A copy was saved locally as `~/factory/backlog.live-2026-10-05.yml`. It was combined with Arxus `canon/Canonical Journeys v2.md` (arxus `0e0197c`).
- **Generated** by `scripts/build/import-factory-project.cjs` (`c0d766d`) using `--add-from-canon 1 --accepted-extra jrn-s1,jrn-s3`. S1 and S3 were merged before backlog tracking (arxus `8e181b2`, `67f5127`).
- **Process:** dry-run on PGlite → founder review → applied verbatim to production. SQL: `artifacts/buildos/arxus-import-2026-10-05.sql` (local and gitignored; reproducible from the committed importer and the saved backlog copy).
- **Result on production:**
  - Project `arxus` (venture, **ready, not active**), attributed to the founder.
  - Items: 18 accepted, 4 ready (T1 → T2 → N1 → N2), 2 draft (AI1, BR1), 1 superseded (the original B3). 16 dependencies; 0 runs.
  - Claimable once activated: `jrn-t1` only.
- **Not imported:** the two launch-gate ratifications (OPEN-S3-1, OPEN-VAL1). They are sign-offs, not build work.
- **Factory overlap:** the project stays `ready` until the B2 worker passes parity. Per D9 the factory may still drain Arxus in the meantime; this avoids double-building.

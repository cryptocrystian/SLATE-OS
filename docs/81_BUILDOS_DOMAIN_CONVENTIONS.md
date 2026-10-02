# BuildOS — Domain Conventions

## Status

- **Date:** 2026-10-02
- **Owner:** BuildOS (module canon, not platform)
- **Authority:** finalized in B0 per `docs/80 §15`. It binds every `buildos_*`
  migration, every `lib/build/*` module and the worker package. Changes require a
  `docs/09` decision-log entry. Where this doc and `docs/80 §4` differ, **this
  doc wins**. `docs/80 §4` was provisional.

---

## 1. Vocabulary

| Term | Meaning | Not to be confused with |
|---|---|---|
| **Project** | One codebase under BuildOS delivery (`build_projects`). | ConsultOS "engagement"; VentureOS "venture" (both can *originate* a project) |
| **Work item** | One unit of canon-governed work: a journey, a foundation, a remediation or a chore (`build_work_items`). | A task or ticket. There are no assignees and no estimates (B7). |
| **Run** | One lane execution against one work item (`build_runs`). | A "sprint". "AI Opportunity Sprint" stays a ConsultOS product. |
| **Decision** | A question only a human may rule on (`build_decisions`). | A review finding. Findings are fixed by the lane, not decided. |
| **Deployment** | Shipping a project ref to an environment (`build_deployments`). | ConsultOS "delivery", which means deliverable sharing |
| **Worker** | A registered execution host that claims runs (`build_workers`). | — |
| **Provider account** | One model-provider account BuildOS may spend (`build_provider_accounts`). | The secret itself. Secrets are never stored in SLATE. |
| **Lease** | A time-boxed claim: a worker on a run, or a run on a provider-account slot. | — |

Machine values are lowercase snake_case. UI copy uses the terms above.

## 2. Keys and identity

- Every row has a UUID `id` and a `workspace_id`.
- **Natural keys are project-scoped.** This fixes `docs/80 §2.3(1)`.
  - `build_projects.project_key`: a slug, unique per workspace (`^[a-z][a-z0-9-]{1,39}$`), e.g. `arxus`.
  - `build_work_items.item_key`: a slug, unique per project (`^[a-z0-9][a-z0-9.-]{0,79}$`), e.g. `jrn-s4`, `jrn-s4.r1`.
  - `build_runs.run_key`: `<project_key>/<item_key>/<attempt_no>`, unique per workspace, e.g. `arxus/jrn-s4/3`.
- `canon_ref` is the canon key the item implements (e.g. `JRN-S4`, `DEC-062`). It is
  free text owned by the project's canon, and BuildOS never interprets it.
- A run's identity never depends on wall-clock time.

## 3. Project

| Field | Rule |
|---|---|
| `origin_kind` | `consultos_engagement` → `origin_engagement_id` required; `ventureos_venture` → `origin_ref` required (text lineage, `docs/72 §4.5` pattern); `internal` → neither |
| `isolation_class` | `internal` \| `client`. **A `consultos_engagement` origin is always `client`.** `client` projects may only use **metered** provider accounts (D3). |
| `status` | `intake → ready → active ⇄ paused → closed`. Allowed shortcuts: `intake → closed`, `ready → closed`. `closed` is terminal. **There is no delete.** |
| `intake → ready` | Requires `readiness_checked_at` to be set: the canon package has been validated against its canon profile (`docs/80 §8`). |
| Origin hold | A `consultos_engagement` project takes a platform **retention hold** on the engagement (`held_by_module='buildos'`, `holder_ref=project id`). The hold is released when the project closes. `origin_engagement_ref` plus a name snapshot preserve lineage after any later engagement deletion. |
| `stack_profile`, `canon_profile` | Profile keys (§8). Immutable while any run is in flight. |
| Scheduling settings | `wip_limit` 1–8 (default 2), `priority_weight` 1–10 (default 5), `max_attempts` 1–10 (default 3), `daily_budget_usd` (nullable = no cap), `builder_family` (default `anthropic`), `judge_families` (non-empty, never containing `builder_family`; that is I3) |

Settings are columns on `build_projects`, not a separate table. They are always
read together with the project at claim time.

## 4. Work item state machine

```
           ┌──────────── release (operator) ───────────┐
           ▼                                            │
 draft ─► ready ─► in_progress ─► accepted (terminal)   │
           ▲  ▲         │                               │
           │  │         ├─► held ───────────────────────┤  (hold_until passes → claimable again)
           │  │         ├─► escalated ─► (ruling) ──────┘
           │  └─────────┘  rejected, attempts < max_attempts
           │
 any non-terminal ─► superseded | cancelled (terminal)
```

- **Claimable** means: `status = 'ready'`, **or** `status = 'held'` with
  `hold_until <= now()`. A held item whose `hold_until` is null waits for an
  operator release.
- `in_progress` is entered **only** by `build_claim_run` and left **only** by
  `build_finish_run` or by lease expiry. Operators cannot set it.
- Dependencies (`build_work_item_deps`, same project only) must all be
  `accepted` before an item is claimable. Being blocked on dependencies is
  *derived*, never stored.
- `bindings` (text[]) is the item's canon entity set for the decomposition gate.
  `'*'` binds the whole project (foundations).
- An item that reaches `escalated` keeps its last run's branch. When the ruling
  returns it to `ready`, the next run resumes from `resumable_from_phase` (§6.4).

## 5. Run

- **Created only by `build_claim_run`.** There is no queued run state: the queue
  is the set of claimable work items.
- `status`: `running → finished`. A finished run is immutable apart from
  `merge_sha` / `pr_url` back-fill.
- Pins (R9): `base_sha`, `canon_ref`, `lane_version`, `roster_hash`,
  `stack_profile`, `canon_profile`. The profiles are copied at claim. The rest
  are reported by the worker on its first heartbeat, and **a run may not finish
  with `accepted` unless `base_sha` and `lane_version` are pinned.**
- Worker lease: `lease_expires_at = now() + 300 s`, extended by every heartbeat.
  An expired lease is reaped as `held / worker_lost`.
- `cancel_requested_at` (operator): the next heartbeat returns `cancel`, and the
  worker finishes with `aborted / operator_abort`.

### 5.1 Verdicts and failure classes

`verdict` is one of `accepted | rejected | escalated | held | aborted`.
`failure_class` is null **iff** `verdict = 'accepted'`.

| `failure_class` | Allowed verdict | Item transition | `hold_until` |
|---|---|---|---|
| — | `accepted` | `accepted` | — |
| `rejected` | `rejected` | `ready`, or `escalated` (technical) once `attempts >= max_attempts` | — |
| `merge_conflict` | `rejected` | as `rejected`. The worker files a remediation item. | — |
| `escalated` | `escalated` | `escalated`, plus a `build_decisions` row from the run's decision payload | — |
| `provider_unavailable` | `held` | `held` | `now() + max(retry_after_s, 15 min)`, capped at 6 h |
| `no_verdict` | `held` | `held` | `now() + 5 min` |
| `worker_lost` | `held` | `held` | `now() + 1 min` |
| `budget_exceeded` | `held` | `held` | the next UTC midnight |
| `precondition` | `held` | `held` | **null** (operator release; never transient, factory `21eb357`) |
| `operator_abort` | `aborted` | `held` | **null** |

**Thrash rule.** Each item tracks `last_failure_class` and
`consecutive_failures`. When **5** consecutive finishes share the same
non-accepted class, the item is held with `hold_until = null` and a `thrash`
alarm is raised. Nothing loops unattended. (This rule would have caught both the
384-run loop and the 2026-10-02 27-cycle loop.)

## 6. Scheduling (`build_claim_run`)

### 6.1 Eligibility (all must hold, in this order)

1. The worker is `active`, the project is in the worker's workspace, the project
   is `active`, and the project's `stack_profile` is in the worker's `capabilities`.
2. The item is claimable (§4) and its dependencies are accepted.
3. **WIP:** the project's running runs number fewer than `wip_limit`.
4. **Decomposition gate:** the item's `bindings` are disjoint from those of every
   running item **in the same project**. `'*'` overlaps everything.
5. **Capacity:** there is a `healthy` account in `builder_family` with a free slot,
   **and** a `healthy` account in some `judge_families` member with a free slot.
   For `client` projects, only `metered` accounts count.
6. **Budget:** today's `build_cost_ledger` total for the project is below
   `daily_budget_usd`, if one is set.

### 6.2 Order: weighted round-robin (stride scheduling, D8)

- Each project carries `sched_pass` (numeric).
- Among eligible items, the claim takes the one whose project has the **lowest
  `sched_pass`**. Ties go to the higher `priority_weight`, then the oldest
  `ready_since`.
- On a claim: `sched_pass += 1 / priority_weight`.
- A project entering `active` starts at the current minimum `sched_pass` of
  active projects, so a new project gets no burst.

### 6.3 Concurrency

`build_claim_run` takes `FOR UPDATE` on the chosen project row (it serializes
claims per project, which is enough for WIP and the decomposition gate) and
`FOR UPDATE SKIP LOCKED` on the item. Two workers can never claim the same item,
and never exceed a project's WIP.

### 6.4 Resume

The claim returns `resume_from_phase` and `resume_branch` from the item's
most recent run that has `resumable_from_phase` set. A build that finished but
was not judged is judged, not rebuilt (`docs/80 §7.3`).

## 7. Capacity

- `build_provider_accounts`: `family` (`anthropic | openai | google | xai | other`),
  `provider` (free text, e.g. `openai-codex`), `billing_class`
  (`subscription | metered | metered_subscription`), `max_concurrency` (1–64),
  `status` (`active | disabled`), `health` (`healthy | degraded | down | unknown`),
  `health_checked_at`, `health_detail`, `cooldown_until`.
- **Secrets are never stored.** An account row names a secret by
  `secret_ref` (a key in the worker's secret manager), never by value.
- **Slots:** a worker acquires a slot (`build_acquire_slot(run, family, role)`)
  before **every** agent call and releases it with usage afterwards
  (`build_release_slot`). The release writes the cost-ledger row. Slot leases
  expire after 30 min, so a crashed worker cannot pin capacity.
- **Health:** canaries and live failures write `health`. A `down` account with
  `cooldown_until` in the future is not eligible. A failure classified
  `provider_unavailable` marks the account `down` with the advertised cooldown.
  This is canon, so the classification doctrine in the worker (`docs/80 §6.3`)
  must emit it.

## 8. Profiles (worker-side; registered by key)

Profiles are code in the worker package, versioned with the lane. BuildOS stores
only their keys. A key is valid if at least one active worker advertises it.

**Stack profile** (`next-supabase` is first):

| Field | Example (`next-supabase`) |
|---|---|
| `l0_gates` | `npm run typecheck`, `npm run test:unit`, project-declared extras (e.g. `check:tokens`) |
| `test_command` | `npm run test:unit` |
| `protected_paths` | `supabase/migrations/**`, `canon/**`, `.git/**` |
| `migration_gate` | Apply all migrations to an in-sandbox throwaway Postgres |
| `sandbox_image` | Node 20 + Postgres 15 client |

**Canon profile** (`arxus-v2` is first):

| Field | Example (`arxus-v2`) |
|---|---|
| `journeys` | `canon/Canonical Journeys v2.md` |
| `acceptance` | `canon/Acceptance Criteria v2.md` |
| `decisions` | `canon/Decision Log.md` |
| `ontology` | `canon/Canonical Ontology v2.md` |
| `binding_syntax` | `**Touches:** Entity, Entity` under each journey |

Project-specific DECs and composition rules come from the project's canon at
run time. **They never live in role prompts.**

## 9. Decisions

- `class`: `technical` (the architect could not resolve it within bounds),
  `product` (for PM triage), `owner` (a business, legal or commercial fork).
- Payload: `title`, `brief` (markdown), `options` (array of
  `{key, label, consequence}`), `recommended_option`.
- `status`: `open → ruled | withdrawn`. Ruling is **only** via `build_rule_decision`,
  which records `ruling_option`, `ruling_note`, `ruled_by`, `ruled_at` and the
  resulting item action (`ready | cancelled | superseded`).
  - **A ruling never dispatches work directly (B8).** It makes the item claimable,
    and the scheduler does the rest.
  - The ruling's canon consequence (a new DEC, an AC change) is authored in the project
    repo. `resulting_canon_ref` records it.

## 10. Alarms

`build_alarms`: `kind` (`stall | starvation | thrash | dead_man | capacity | merge`),
`project_id` (nullable for workspace-wide alarms), `subject`, `detail`,
`raised_at`, `cleared_at`. At most one open alarm per `(kind, project, subject)`.
`build_evaluate_alarms()` raises and clears them idempotently. Its scheduler (a
cron or a heartbeat side-effect) is chosen in B2.

| Kind | Raised when (B1 thresholds) |
|---|---|
| `stall` | The project is `active`, has a claimable item, has capacity, and no run has been claimed for 30 min |
| `starvation` | The project is `active`, has a claimable item, and no accepted run in 24 h |
| `thrash` | The §5.1 thrash rule fired. Cleared by an operator release. |
| `dead_man` | A worker that was active in the last 24 h has not been seen for 10 min |
| `capacity` | No healthy account in a family some active project needs |
| `merge` | Raised by the worker on a failed merge, or on a non-clean base it could not recover |

## 11. Authorization

- **Operators** (workspace `owner`/`operator`): create and edit projects,
  work items, dependencies, settings, provider accounts and workers. Release held
  items. Request run cancellation. Rule decisions.
  - **Viewers** read everything.
  - There are no project-level roles in B1; they arrive with client users.
- **Run, event, ledger and slot rows are written only by workers**, through the
  `buildos_worker` principal (D5). This principal is a NOLOGIN Postgres role
  with `EXECUTE` on the worker RPCs and nothing else.
  - Each deployment creates a login role `IN ROLE buildos_worker`, with its
    password held in the worker secret manager. This happens outside migrations.
  - Workers never hold the Supabase service-role key.
  - Every worker RPC checks that the calling `worker_id` is active and owns the
    run it touches.
- Authenticated operators get `SELECT` on all `build_*` tables and **no**
  `INSERT/UPDATE` on runs, events, ledger, slot leases or alarms.

## 12. Durability

- No `build_*` table is deleted from by application code. Projects close, items
  are cancelled or superseded, and decisions are withdrawn.
- `build_runs` and `build_run_events` are append-only. Triggers reject updates
  to a finished run's verdict and pins.
- Full agent transcripts go to `stored_files` (`owner_module='buildos'`). Events
  carry the file id.

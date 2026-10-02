# BuildOS — Integration Plan (rev 1: architecture + B0–B4 build plan) — docs/80

## Status

- **Date:** 2026-10-02 (rev 1)
- **Branch:** `persistence/step-0-1-auth-shell` (head `d9d4b9e`)
- **Type:** Canon-authoring / planning doc. No source code, no migration, no
  engagement mutation. **Ratified by the founder 2026-10-02. The rulings on D1–D10
  are recorded in §13 and in decision log 2026-10-02. B0 is complete apart from the
  `docs/00` / `docs/persistence/00` amendment notes and the `docs/81` conventions.**
- **Inputs:**
  - The SLATE module canon (`docs/72 §1`, decision log 2026-09-28).
  - The read-only review of the Saipien software factory (`~/factory`, HEAD
    `8858e35`) and its live VPS deployment, carried out 2026-10-02. Evidence is summarised in §2.
  - The factory's own `canon/buildops-canon.md` (2026-08-12), which is reconciled in §1.4.
- **Supersedes:** every "BuildOps stays documentation-only" boundary statement
  (decision log 2026-05-01, `docs/persistence/00` "BuildOps Non-Disruption",
  `docs/08`) **once this doc is ratified**. Until then those boundaries hold.

---

## 1. Architecture

### 1.1 What BuildOS is

BuildOS is the SLATE module that **runs governed software delivery**. It takes a
ratified canon package (requirements, journeys, acceptance criteria, decisions)
for a project and drives it to verified, merged and deployed code. Coding agents
do the work under deterministic control: *the agent proposes, code disposes*.
Humans rule only on business decisions.

It serves three kinds of project, each with its own entry point:

| Origin | Entry point | Example |
|---|---|---|
| **Client** (ConsultOS) | An approved SOW on a ConsultOS engagement → "Start BuildOS project" | A Sapient Digital build following its AI Opportunity Sprint |
| **Venture** (VentureOS) | A venture → its product build | Arxus, Wellstead, Pravado |
| **Internal** | Saipien tooling | SLATE itself (later) |

The requirement that shapes everything below is **many projects online at once**:
concurrent client and venture builds, each isolated, each fairly scheduled, each
with its cost attributed. The design does not hold if it has one daemon, one
host, or one provider account.

**BuildOS is not** a project-management clone (no Kanban, no assignees, no
velocity charts). It is not a CI service and not a code host. It orchestrates the
lifecycle and owns execution state. Git owns the code. Canon owns intent.

### 1.2 Two planes

```
 ┌──────────────────────────── SLATE (Vercel + Supabase) ────────────────────────────┐
 │  ConsultOS ──(approved SOW)──┐                                                     │
 │  VentureOS ──(venture)───────┼──► BuildOS CONTROL PLANE                            │
 │  internal ───────────────────┘    projects · work items · runs · decisions ·       │
 │                                   capacity · cost · events   (Postgres + RLS)      │
 │                                   /app/build UX · decisions inbox · alarms          │
 │                                        │  ▲                    │                    │
 │                  claim (lease) RPC ────┘  └── report events    └─► GovernanceOS     │
 │                                                                   contracts         │
 └────────────────────────────────────────┬───▲──────────────────────────────────────┘
                                          │   │  narrow worker API (no service role)
 ┌────────────────────────── EXECUTION PLANE (off-Vercel) ───────────────────────────┐
 │  Stateless workers: claim run → acquire sandbox → run LANE ENGINE → push branch → │
 │  open PR → report verdict → release.  N workers, M sandboxes, any host.           │
 │  Lane engine = the factory's proven lane, generalised behind stack/canon profiles │
 └───────────────────────────────────────────┬───────────────────────────────────────┘
                                             ▼
                          Git host (code SoR) · model providers (capacity pools)
```

- **The control plane** lives in SLATE, as module tables, RLS, a service layer, and the
  operator UX. It is the single source of truth for everything except code.
  Scheduling policy runs in the database: the WIP limit, the decomposition gate,
  provider capacity, and fair share are enforced inside the lease-claim RPC (§5.2).
  **There is no long-lived scheduler process whose memory holds state.**
- **The execution plane** is a pool of stateless workers that pull work. A worker
  can die at any moment. Its lease expires and the run is reclaimed. Workers
  hold no queue, no verdicts, and no retry counters.

### 1.3 System of record (D1)

| Fact | Owner | Everyone else |
|---|---|---|
| Project, work item, run, verdict, decision, ruling, deployment, capacity, cost | **BuildOS (SLATE Supabase)** | Workers write only through the worker API. The UX reads it. |
| Code, branches, PRs | **Git host** | BuildOS stores refs (base SHA, branch, PR URL) only |
| Project canon: journeys, AC, DECs, invariants | **The project repo's `canon/`** (versioned with the code) | BuildOS records the canon ref each run pinned. It never edits canon. |
| CRM relationship | Attio (`docs/42`) | Unchanged |
| Governance state of what is built | **GovernanceOS** (`docs/72 §1.1` critical rule) | BuildOS registers assets and submits evidence via contracts |

This **inverts** the factory's `buildops-canon.md §2`. That document makes the
factory plus Buzz the system of record and SLATE a read-model. The inversion
follows directly from the scale requirement. A record that has to be shared by
many workers, many projects, and the operator UX belongs in a transactional
database with RLS, not in a daemon's YAML and memory (§2.3). The factory's own
principle, *one writer per fact, no two-way sync*, is kept. Only the owner changes.

### 1.4 Reconciling the factory's BuildOps canon

| Factory canon (2026-08-12) | Ruling here |
|---|---|
| "Supersedes conflicting naming in SLATE-OS canon" | **Withdrawn.** SLATE canon governs SLATE modules. The factory canon stays authoritative only for the lane engine's own invariants (I1–I13, kept verbatim, §7.1). |
| Factory + Buzz are SoR; SLATE is a read-model | **Inverted** (§1.3). |
| Ontology: Tenant / Initiative / Track / Phase / Build / Run | **Narrowed.** BuildOS uses **Project → Work item → Run** (+ Decision, Deployment). "Initiative" and cross-track lifecycle (GTM, marketing, sales) are **out of BuildOS scope**. If they are wanted at all, they are a VentureOS concern. Tenant isolation = SLATE workspace (+ per-client sandbox and credential isolation, §5.4). |
| Run supersedes "Sprint" | **Kept.** "Run" is one lane execution. "AI Opportunity Sprint" stays a ConsultOS product. |
| Deployment supersedes "Delivery" for software | **Kept.** "Delivery" stays reserved for ConsultOS deliverable sharing. |
| B7: lifecycle orchestration, never PM | **Kept** (§1.1). |
| B8: no gate auto-advances across a human decision | **Kept** (§7.1). |
| Buzz as the decision plane | **Demoted to a notifier adapter** (D2). Decisions are ruled in the SLATE decisions inbox, and Buzz may mirror them. |

### 1.5 Naming and code layout

- Module name **BuildOS**. Machine value `buildos`, which already exists in
  `lib/platform/modules.ts`, `retention_holds.held_by_module`,
  `activity_events.module`, `stored_files.owner_module` and the GovernanceOS
  `SOURCE_SYSTEMS`. No platform schema change is needed for the name.
- Routes `/app/build/**` (D7; `docs/03` reserved `/app/builds`, see §10).
  Code in `lib/build/*`, `components/build/*`, `tests/build/`. Migrations
  `NNNN_buildos_*.sql`.
- Dependency direction follows `docs/72 §1.3`. BuildOS → platform is allowed.
  BuildOS → GovernanceOS goes **only** via `lib/governance/contracts`. Platform →
  BuildOS is forbidden. Extend the existing `no-restricted-imports` rule to cover
  `lib/build`.

---

## 2. What the factory review established (the evidence this plan rests on)

### 2.1 Proven, and worth carrying forward

| Asset | Evidence |
|---|---|
| Cross-family independent review catches real defects the builder's own tests miss | P0 DEC-052 gate bypass. INV-003 immutability hole. INV-012 concurrency race (`factory/design/P0-LOG.md`, `runs/decisions.yml`). |
| The lane delivers real product | Arxus: 14 of 22 journeys + the auth foundation merged by the factory (about 70k lines). Five landed in 36 hours on 2026-09-29/30, once quota and git state were healthy. |
| The governance ladder: builder → architect (protected paths, Postgres-validated migrations) → PM → owner | Under one genuine owner ruling per accepted journey (factory `61c2b99`). |
| Typed envelopes, write grants checked after the fact, and invariants I1–I13 | `envelopes.py`, `permissions.py`, `canon/invariants.md`. All stack-neutral. |
| Failure-classification doctrine, earned incident by incident | `infra_failed`, PhaseUnavailable, "no verdict is not a verdict", preflight probes, cooldown honouring. Latest additions are `515fbe1` and `8858e35` (2026-10-02). |
| Zero-spend golden replay plus a behavioural regression suite | `verify.py`, 214 checks, `control-plane/goldens/`. |

### 2.2 Not proven, or repeatedly broken

| Problem | Evidence |
|---|---|
| Unattended reliability | A conflicted merge wedged the origin repo, and the factory produced nothing for about 3 weeks (`15b3c73`). The builder credential expired, and the factory ran dead for 18 days without an alarm (`f6036c9`). 384 run records came from one untracked file (`21eb357`). 2026-10-02: 27 full plan+build cycles in 17 hours against a judge chain where every route was down (`515fbe1`, `8858e35`). |
| Yield | 7 of 107 runs accepted at 09-06. 50 provider-exhaustion holds. 23 silent kills (`264f72d`). |
| False escalations | 6 of 8 escalations were false at 08-31 (`61c2b99`). |
| Judge capacity | One subscription per family. As of 2026-10-02 every judge route was down: Codex weekly limit, Gemini 429s, the xAI key rejected, OpenRouter out of credit. |
| Operating cost | About 6 factory-fix commits per accepted journey. Nearly every severe incident was found by hand. |

### 2.3 Why the runtime does not scale (code-level)

1. **No project identity.** `run_id = timestamp-lane-target` with no repo
   (`session.py:127`). `_latest_run(target)` matches across repos
   (`orchestrator.py:209`). Backlog and escalation ids are global.
2. **One process, one host.** Scheduler state, retry counts, and migration claims
   live in daemon memory (`orchestrator.py:592-618`). The queue is a YAML file
   under flock. Merges into a shared origin clone are unlocked (`isolation.py:359-424`).
   Two daemons would corrupt each other.
3. **Hard-wired to Arxus.** Canon file names (`canon.py:36-40`), Supabase
   migration paths (`config.py:226-232`), Arxus npm gate scripts
   (`feature.py:520-523`), and Arxus DECs inside prompts (`feature.py:532-553`,
   `agents/*/system.md`). The registry's `lanes` and `stack` fields are never read.
4. **No security boundary.** Agents run as root with `--auto-approve` bash on a
   2-vCPU host that is shared with production. Docker is shared. There is no
   per-client credential isolation.
5. **No intake API.** Work enters by hand-editing `backlog.yml`.

**Conclusion (the basis of this plan):** reuse the **engine** (the lane, contracts,
ladder, and failure doctrine). Replace the **runtime** (scheduler, state, and
isolation), with SLATE as the control plane. Neither "adopt as-is" nor
"start from zero".

---

## 3. Requirements

| # | Requirement | Design answer |
|---|---|---|
| R1 | Many concurrent projects, scaling horizontally | Pull-based stateless workers. Scheduling in the claim RPC (§5.2). No singleton process. |
| R2 | Hard isolation between projects, and between clients | One ephemeral sandbox per run. Per-project secrets. Workspace RLS on all state (§5.4). |
| R3 | Entry points from ConsultOS and VentureOS, plus internal | `build_projects.origin_*` lineage plus an intake contract (§8). |
| R4 | Provider capacity is first-class, not discovered by failure | Capacity pools, per-family semaphores, a live canary, and alarms (§6). |
| R5 | No silent failure | Leases with heartbeats, stall/dead-man alarms, a "ready work but nothing accepted" alarm (§7.2). |
| R6 | Cost attributed per project and per client | A cost ledger keyed by run → project → origin (§6.4). |
| R7 | Governed delivery | GovernanceOS registration plus the `docs/73 §7` checklist as a pre-deployment gate (§9). |
| R8 | Durable history | Runs, decisions, and events are append-only. BuildOS takes retention holds on origin engagements. No cascade erases a run. |
| R9 | Reproducible runs | A run pins `(repo, base SHA, canon ref, lane version, model roster)` (factory I4/I10, kept). |
| R10 | Swappable tooling | Ports for the agent harness, isolation substrate, git host, and notifier. No product is named in the domain model. |

---

## 4. Domain model (provisional migrations `0030`+, `buildos_*`)

All tables carry `workspace_id` with `is_workspace_member` RLS (the `0022`/`0023`
pattern). Ids are UUIDs. Natural keys are always **project-scoped**, which fixes §2.3(1).

| Table | Holds | Notes |
|---|---|---|
| `build_projects` | Name, `origin_kind` (`consultos_engagement` \| `ventureos_venture` \| `internal`), `origin_engagement_id` (FK, nullable), `origin_ref` (text lineage for VentureOS until its tables exist, as `docs/72 §4.5` did), repo URL + default branch, `stack_profile`, `canon_profile`, `status` (`intake` → `ready` → `active` → `paused` → `closed`), isolation class (`internal` \| `client`) | A ConsultOS origin takes a **retention hold** on the engagement (`held_by_module='buildos'`), so engagement deletion can never orphan build history |
| `build_project_settings` | WIP limit, capacity class, risk tier, model-roster override, budget ceilings | Per project. These replace the factory's global `--max-parallel`. |
| `build_work_items` | `kind` (`foundation` \| `journey` \| `remediation` \| `chore`), canon key (e.g. `JRN-S4`), `bindings` (entity set for the decomposition gate), `depends_on`, `status` state machine, `attempts`, `hold_until`, `hold_reason_class` | Unique `(project_id, canon_key)`. **The state machine lives in the DB**, so retry and backoff state survive any restart. |
| `build_runs` | `work_item_id`, lane, mode, pinned `base_sha` / `canon_ref` / `lane_version` / roster hash, `worker_id`, `lease_expires_at`, `heartbeat_at`, `phase`, `verdict` (`accepted` \| `rejected` \| `escalated` \| `infra_hold` \| `aborted`), **`failure_class`** (typed enum, not parsed strings), branch, PR URL, merge SHA | A typed verdict replaces the factory's string-parsed `_verdict` 10-tuple |
| `build_run_events` | Append-only phase, gate, and agent-call summaries (role, model, family, tokens, cost, outcome) | Full transcripts go to `stored_files` (`owner_module='buildos'`) in the durable bucket, not in Postgres. One factory run directory was 15 MB. |
| `build_decisions` | Escalations: `class` (`technical` \| `product` \| `owner`), the brief, options, the recommended option, `status`, the ruling, `ruled_by`, `ruled_at`, the resulting canon ref | Ruled in the UX. A ruling never auto-dispatches across a human gate (B8). |
| `build_deployments` | Environment, ref, `governance_gate_result`, approver | §9 |
| `build_provider_accounts` | Family, provider, billing class (`subscription` \| `metered` \| `metered_subscription`), concurrency limit, status, **last canary result** | Secrets are **not** stored here (§5.4) |
| `build_capacity_leases` | Live per-account call slots | Enforced in the claim RPC and in workers' call wrapper |
| `build_cost_ledger` | Per agent call: run, project, account, tokens, list cost, billed cost | Rolls up by project, origin and client (R6) |
| `build_workers` | Worker id, substrate, capabilities (stack profiles), `last_seen_at` | Dead-man source (§7.2) |

`activity_events` (`module='buildos'`) records operator-visible milestones:
project created, run accepted, decision ruled, deployment approved. Events live in
`build_run_events`, not in the activity stream.

---

## 5. Execution plane

### 5.1 The worker contract

```
claim_run(worker_id, capabilities)      → lease {run, work item, project profile, pinned refs, budget}
loop: heartbeat(run_id, phase)          → extends lease; returns CANCEL if the operator stopped it
      call_model(role, …) via wrapper   → acquires/release capacity slot; writes cost ledger row
report_event(run_id, event)             → append-only
finish(run_id, verdict, failure_class, branch, pr_url, evidence_refs)
```

- **Pull, not push.** Any number of workers on any number of hosts. If a worker
  disappears, its lease expires and the run returns to the queue with
  `failure_class='worker_lost'`. That is an infrastructure failure, so it is never
  escalated. This fixes the factory's silent kills (`264f72d`).
- **Narrow API, no service role on workers (D5).** Workers authenticate as a
  dedicated `buildos_worker` principal that can execute only the worker RPCs.
  Workers never see the Supabase service-role key.

### 5.2 Scheduling in the claim RPC

`claim_run` runs inside one transaction with `FOR UPDATE SKIP LOCKED`. It picks
the oldest eligible work item that satisfies all of the following:

1. Its dependencies are accepted and `hold_until` has passed.
2. The project WIP is below its limit, and the global WIP is below the pool size.
3. **Decomposition gate:** its bindings are disjoint from in-flight runs in the
   **same project**. This is the factory's §9 logic, already namespaced per repo
   (`orchestrator.py:546-583`).
4. **Capacity:** every model family the lane needs (builder **and** judge) has a
   healthy account with a free slot. This is the factory's preflight lesson,
   moved from "probe before dispatch" to "do not dispatch without reserved
   capacity" (§6).
5. **Fair share** across projects, weighted by project priority (D8).

**Protected-path serialization** (migration numbering, canon edits) uses a
per-project advisory lock taken by the architect phase. This replaces the
factory's in-memory migration claims (`orchestrator.py:135-151`).

### 5.3 Merge model

- Workers **push a branch and open a PR**. They never merge into a shared clone.
- Merging is a per-project serialized step, either the git host's merge queue or a
  BuildOS merge job: rebase-check (I11) → required checks → merge. A conflict
  fails **that run** (`failure_class='merge_conflict'` → remediation item) and
  cannot wedge the repository for other runs. This fixes `15b3c73`, the three-week wedge.
- The PR is the artifact a human or client can inspect. Branch protection holds on
  every project.

### 5.4 Isolation and secrets (D4)

- **One ephemeral sandbox per run.** It is created on claim and destroyed on
  finish. It has no host access and no shared Docker. Each sandbox starts
  its own throwaway Postgres for migration gates, and its egress is restricted
  to the git host, package registries, and model providers.
- **Isolation classes.** An `internal` project may share a worker pool. A
  `client` project gets per-client credentials (a git deploy key and per-client
  model accounts where a contract requires it) and is never co-scheduled in a sandbox
  with another client.
- **Secrets** live in a secret manager (D4), are injected per run, are scoped
  per project, and are never written into the database or the repo. The factory's
  single-refresher auth broker pattern is kept **only** for any remaining rotating
  OAuth subscription credentials (§6.2).
- **Substrate.** The isolation port is kept. The adapter options are evaluated in
  D4: exe.dev VMs (whose core was proven in the factory), a container
  service, or a managed sandbox provider. **The VPS is not a multi-tenant worker.**
  It may run one internal worker during B2.

### 5.5 The lane engine

- The factory's lane (`lanes/feature.py` plus `control-plane/*`) becomes a
  **versioned worker package** (D6). It keeps its proven logic and gains:
  - **Stack profiles**, replacing hard-coded npm/Supabase gates. Each one declares
    the L0 gate commands, the test command, the protected paths, and the migration
    gate. `next-supabase` is the first profile, extracted from Arxus.
  - **Canon profiles**, replacing the hard-coded file names and `**Touches:**`
    regex. Each one declares where journeys, AC, DECs, and ontology live, and how
    bindings are declared. `arxus-v2` is the first.
  - **Prompt layering.** Role charters (generic) + the stack profile + project
    canon excerpts. The Arxus DECs come out of `agents/*/system.md`.
- `verify.py` goldens and behavioural checks become the engine's **parity suite**.
  The engine is not "done" until it reproduces them (§11, B2 exit).

---

## 6. Capacity and model routing

### 6.1 Judge capacity is the binding constraint

Builders were rarely the bottleneck. Judges were (§2.2). BuildOS therefore treats
each **family's** capacity as a schedulable resource. A lane is dispatchable only
if both the builder family and a different judge family hold reserved headroom.

### 6.2 Provider accounts (D3)

- **Client work runs on metered org/API accounts.** These have contractual rate
  limits, per-project spend attribution, and no rotating-token fragility.
  Consumer and individual subscriptions are confined to internal and venture
  work, and **their terms must be confirmed** to permit automated use at the
  intended volume.
- **At least two healthy judge families at all times**, each with at least two accounts or a
  pooled org limit. The cross-family rule (I3) is kept: the judge never shares the
  builder's family.

### 6.3 Health as data, not as a dispatch-time surprise

- A **canary** per account runs every N minutes (one trivial completion). It
  classifies results with the factory's doctrine, including the two 2026-10-02
  cases: a provider notice delivered as assistant text, and a pre-model exit that
  shows only on stderr. Results are written to `build_provider_accounts`.
- A **startup chain validation** runs per roster. Every route in every fallback chain
  must authenticate. An unauthenticated route is a configuration error that raises an
  alarm, never a silent "healthy". (This was the xAI failure in `8858e35`.)
- The claim RPC reads canary state (§5.2-4). Workers still classify failures per
  call. A live failure marks the account down immediately.

### 6.4 Cost

Every agent call writes a `build_cost_ledger` row (tokens and list cost;
billed cost for metered accounts). It rolls up by run → work item → project →
origin (engagement/venture). Budget ceilings per project (`build_project_settings`)
are checked at claim time and at each call. A breach holds the project and does
not fail the run.

---

## 7. Reliability doctrine

### 7.1 Kept from the factory (canon for the lane engine)

Invariants **I1–I13** (`factory/canon/invariants.md`) are adopted verbatim as
BuildOS lane canon. B7 (orchestration, not PM) and B8 (no gate auto-advances
across a human decision) are adopted from the factory BuildOps canon. The
classification rules are adopted as typed `failure_class` values:

| Class | Meaning | Response |
|---|---|---|
| `provider_unavailable` | Rate limit, quota, outage, retired model, auth failure | Hold the item until capacity returns. Never a finding, never an escalation. |
| `worker_lost` | Lease expired | Requeue |
| `precondition` | Dirty base, missing canon, profile mismatch | Hold plus an operator alarm. **Not transient.** (`21eb357`) |
| `no_verdict` | The judge produced no envelope | Requeue on another judge account. Never a synthetic finding. (`26c8da1`) |
| `rejected` | A real finding | Fix loop → architect → PM (bounded) |
| `escalated` | A genuine owner decision | `build_decisions`; the item parks and **the rest of the project keeps flowing** |
| `merge_conflict` | Rebase or merge failed | Remediation item (§5.3) |
| `budget_exceeded` | Time, token, or retry ceiling hit (I9) | Hold plus an alarm |

### 7.2 New: no silent failure (the factory's biggest operational gap)

| Alarm | Fires when |
|---|---|
| **Stall** | A project has `ready` work, capacity is available, and nothing has been claimed for N minutes |
| **Starvation** | A project has `ready` work and no accepted run for N hours |
| **Thrash** | A work item has more than K attempts in a window with the same `failure_class` (this would have caught the 384-run loop and the 27-cycle loop) |
| **Dead-man** | No worker heartbeat for N minutes |
| **Capacity** | A judge or builder family has been down for more than N minutes, or any route in a chain fails authentication |
| **Merge** | A merge has failed or a repo is in a non-clean state |

Alarms are rows plus notifications through the notifier port: email, Buzz, or other
channels (D2). The `/app/build` portfolio view shows them first.

### 7.3 Builds already done are reused

A run that built successfully but could not be judged keeps its branch. The next
attempt resumes at the judge phase instead of planning and building again. The
factory's `cb15ac9` intended this, but on 2026-10-02 each JRN-T1 retry still
started again from planning. BuildOS makes it a property of the run model: a
`resumable_from_phase` field and pinned branch.

---

## 8. Entry points (intake)

Intake is a **ratified canon package**. Canon authoring stays upstream of the
build (factory I10): in ConsultOS, in a VentureOS working session, or by hand.

| Origin | Flow | Lineage and durability |
|---|---|---|
| **ConsultOS** | An approved `sow_draft_candidate` snapshot (P6/P7 lane, `lib/proposals/sow-draft-actions.ts`) → operator action "Start BuildOS project" (B4) → `build_projects` row in `intake` | `origin_engagement_id` plus a retention hold. The SOW snapshot id is stored as lineage. **ConsultOS gains one entry-point action and no build logic.** |
| **VentureOS** | Until VentureOS has tables: create a project with `origin_kind='ventureos_venture'` and a text `origin_ref` (the `docs/72 §4.5` lineage-only pattern). When VentureOS exists, it gains a "Start build" action. | Lineage only, no FK, until VentureOS ships |
| **Internal** | Created directly in `/app/build` | — |

**Readiness check before `ready`:** BuildOS validates the project against its
canon profile before any work is dispatched. The canon package must be present,
journeys must have bindings, AC must be declared, and the stack profile must be
known. This is the factory's `readiness.py`, moved to intake.

---

## 9. GovernanceOS integration

- **Governed Delivery** (`docs/73 §7`, `docs/72 §5.1`). Before a client
  `build_deployment` to `production`, BuildOS:
  1. Registers the AI systems and agents it built with `registerGovernedAsset`,
     using `source_system='buildos'` and `source_entity_type='build_project'`
     (idempotent).
  2. Attaches evidence: test, gate and review evidence refs from the run.
  3. Calls `evaluateGovernanceGate`. This is **advisory until G3** (`contracts.ts`
     never returns deny before decision records exist). It becomes enforcing
     when G3/G4 land.
- **BuildOS's own agents are governed assets.** The build agents (builder,
  reviewer, architect) are registered in the **Saipien internal program**
  (`docs/72 §4.6`), with their autonomy level, oversight mode, and model
  providers. Saipien governs its own factory by the standard it sells.
- The dependency rule holds. BuildOS imports only `lib/governance/contracts`.
  GovernanceOS never reads `build_*` tables.

---

## 10. Operator UX (`/app/build`)

| Route | Purpose |
|---|---|
| `/app/build` | **Portfolio:** every project with health, WIP, last accepted run, open decisions, and alarms. A capacity strip shows which families are healthy and the headroom per pool. |
| `/app/build/decisions` | **The cross-project decisions inbox.** One queue, briefs with options and a recommended ruling. Rulings are recorded with the resulting canon ref. |
| `/app/build/[projectId]` | Project: work-item board by state (not Kanban; no assignees), dependency view, runs, deployments, origin lineage |
| `/app/build/[projectId]/runs/[runId]` | Run drill-down: phases, gates with evidence, agent calls (model, family, cost), envelope, PR link. Ports the factory observatory's drill-down. |
| `/app/build/capacity` | Accounts, canary history, spend per project/client, budget state |

The sidebar gets a "Build" group with the BuildOS entry. This is a one-entry edit
to the shared shell, as `docs/72` did for GovernanceOS. No PM surfaces (B7).

---

## 11. Phasing

Each phase has a falsifiable exit test, after the factory plan's own discipline.

**B0 — Ratify (docs only).**
- Rule the decisions (§13). Done 2026-10-02.
- Decision-log entries: the BuildOS boundary, the SoR inversion, naming, the
  factory canon reconciliation.
- Amend `docs/00` and `docs/persistence/00` (lift "BuildOps Non-Disruption").
- Freeze the factory to bug fixes only. Per D9, it resumes on Arxus once a judge route works.
- *Exit:* this doc ratified; `docs/09` entries landed.

**B1 — Control-plane foundation [BuildOS].**
- `0030`+ `buildos_*` migrations with RLS.
- `lib/build/*` service layer and worker RPCs (no worker yet).
- `/app/build` read-only portfolio, project and run views, and the decisions inbox.
- Import Arxus's state (16 accepted items, open decisions) as the first project.
- Tests: RLS negatives, the state machine, and claim-RPC scheduling properties
  (WIP, decomposition gate, capacity, fair share) on PGlite.
- *Exit:* two seeded projects with overlapping canon keys never cross-read. A
  simulated lease expiry requeues the run with `worker_lost`. The claim RPC refuses
  dispatch when the judge family has no healthy account.

**B2 — Execution plane MVP [BuildOS worker].**
- Generalise the lane engine into a worker package with the `next-supabase` stack
  profile and the `arxus-v2` canon profile.
- One worker substrate. A single internal worker may run on the VPS for this phase.
- PR-based merge.
- Canary, chain validation, and all §7.2 alarms.
- *Exit:*
  - **Parity:** `verify.py` goldens pass through the worker.
  - At least one remaining Arxus journey (T1/T2/N1/N2) is accepted and merged via
    BuildOS end to end.
  - Killing the worker mid-run produces a lease-expiry requeue, not a lost run.
  - An injected all-judges-down state produces a capacity hold and a **Capacity
    alarm**, and **zero** builder spend.

**B3 — Scale and isolation [BuildOS + infra].**
- Ephemeral sandbox adapter (D4) and secret manager.
- Provider pools (D3), cost ledger, budgets, fair share.
- A **second, non-Arxus project**, on a different canon profile if one is available.
- *Exit:*
  - Three projects run concurrently with zero manual coordination.
  - Saturating the pool produces backpressure, not unbounded queue growth.
  - Per-project cost reconciles with provider invoices to within 5%.
  - A restore from backup into a clean environment reproduces project state and the
    acceptance record (factory P6 condition).

**B4 — Entry points and governed delivery [BuildOS + ConsultOS action + GovernanceOS contracts].**
- ConsultOS "Start BuildOS project" from an approved SOW.
- `client` isolation class.
- The deployment record and the advisory governance gate.
- Agent registration in the Saipien internal program.
- *Exit:* a ConsultOS engagement's approved SOW starts a build project with a
  retention hold. Deleting that engagement is refused while the project exists. A
  production deployment records an `evaluateGovernanceGate` result.

**B5 — VentureOS entry** follows VentureOS's own foundation. Until then ventures
use lineage-only origin (§8).

**Factory transition.**
- The factory is frozen to bug fixes during B1. Per D9, it keeps draining Arxus
  whenever a judge route is healthy.
- From B2, the remaining Arxus work moves to BuildOS.
- `arxus-factory.service` is decommissioned at the B2 exit.
- The factory repo becomes the lane engine's upstream (or is archived after the
  port, D6).

---

## 12. Ownership ledger

| Work item | Owner | Phase |
|---|---|---|
| Decision-log entries, `docs/00` / `docs/persistence/00` amendments | Canon | B0 |
| `build_*` tables, RLS, state machine, claim/lease RPCs | **BuildOS** | B1 |
| `buildos_worker` principal and worker RPC surface | **BuildOS** (uses platform auth) | B1 |
| `lib/build/*`, `/app/build/**`, sidebar "Build" entry | **BuildOS** | B1 |
| Durable transcript storage | **Platform** `stored_files` (already exists, `owner_module='buildos'`) | B1 |
| Retention-hold use on engagements | **Platform** primitive, used by **BuildOS** | B4 |
| Lane engine package, stack/canon profiles, parity suite | **BuildOS worker** (from factory) | B2 |
| Sandbox adapter, secret manager, worker pool | **BuildOS infra** | B2–B3 |
| Provider accounts, canary, cost ledger | **BuildOS** | B2–B3 |
| "Start BuildOS project" action | **ConsultOS** (one action, no build logic) | B4 |
| Asset registration, evidence, gate evaluation | **GovernanceOS contracts** (called by BuildOS) | B4 |
| Notifier adapters (email; Buzz optional) | **BuildOS** behind a port | B2 |

Platform needs **no new schema** for BuildOS. `buildos` is already in every
module-enum check constraint (`0024`, `0025`). The only platform touch is the
lint rule extension.

---

## 13. Decisions (ruled by the founder, 2026-10-02)

| # | Decision | Ruling |
|---|---|---|
| D1 | System of record | **BuildOS in SLATE** (§1.3). This inverts the factory's `buildops-canon.md §2`. |
| D2 | Buzz | **Notifier adapter.** Decisions are ruled in `/app/build/decisions`; Buzz optionally mirrors them. Email is the default channel. |
| D3 | Model capacity | **Metered org/API accounts for client work.** Subscriptions are allowed only for internal/venture work, once their terms are confirmed for automated use. At least two judge families, each with at least two accounts. |
| D4 | Sandbox substrate and secret manager | **Time-boxed bake-off in B2:** exe.dev vs one container service vs one managed sandbox. Criteria: cold start, per-run cost, egress control, Postgres-in-sandbox, API maturity. The result goes in `docs/83`. |
| D5 | Worker auth | **A dedicated `buildos_worker` DB principal with RPC-only grants.** Workers never hold the service-role key. Revisit if workers run on untrusted networks. |
| D6 | Lane engine language | **Python**, as a separate worker package ported and generalised from the factory. The control plane is TypeScript/SQL. |
| D7 | Route root | **`/app/build`** (supersedes the `docs/03` reservation of `/app/builds`). |
| D8 | Fair share | **Weighted round-robin** by project priority. Client deadlines can raise a project's weight. |
| D9 | Factory during the build-out | **Resume the VPS daemon on Arxus once a judge route works** (a valid xAI key, OpenRouter credit, or a quota reset). Bug fixes only, no new factory features. It is retired at the B2 exit (§11). |
| D10 | Second B3 project | **Decide at B3**, based on which venture has a ratified canon package ready. Prefer one on a different canon profile from Arxus. |

---

## 14. Risks

| Risk | Mitigation |
|---|---|
| Porting the lane loses hard-won behaviour | The parity suite (B2 exit) runs before any production use. The factory stays frozen as the reference. |
| Judge capacity still binds at scale | Treat it as a scheduled resource (§6.1). Metered accounts. Capacity alarms. Measure judge calls per accepted journey from B2. |
| Canon-profile generality is untested (factory §18.4) | B3 requires a second project on a different profile. |
| Cost surprises on metered accounts | Per-project budgets checked at claim time and per call. The cost ledger is reconciled against invoices (B3 exit). |
| The control plane becomes a PM clone | B7 is canon. UX review against §10's "no PM surfaces". |
| Founder ratification is the bottleneck (factory §18.7) | Briefs with recommended options. Batch rulings in the decisions inbox. |

---

## 15. Proposed doc set

| Doc | Owner | Phase |
|---|---|---|
| `docs/80` (this): integration plan | BuildOS | now |
| `docs/81`: BuildOS domain conventions (state machine, failure classes, profiles, naming) | BuildOS | B0 |
| `docs/82`: B1 control-plane acceptance audit | BuildOS | B1 |
| `docs/83`: Execution-plane design (worker contract, sandbox bake-off result, secrets) | BuildOS | B2 |
| `docs/84`: Provider capacity and cost standard | BuildOS / Saipien ops | B2 |
| B1–B4 acceptance audits | BuildOS | per phase |
| `docs/09` entries; `docs/00`, `docs/persistence/00` amendments; `docs/08` + `docs/10` updates | Canon | B0 |

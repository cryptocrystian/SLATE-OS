# G1 — GovernanceOS Foundation: Acceptance Audit

## Status

- **Date:** 2026-09-28
- **Branch:** `persistence/step-0-1-auth-shell` (working tree; **not committed**)
- **Layer:** GovernanceOS module (per `docs/72 §4`)
- **Verdict:** **ACCEPTED for code + database verification.** The operator UI
  is compiled, typed and linted but **not yet click-tested with a signed-in
  session.** That requires the G1 migrations in an environment the founder
  signs into. Production apply is held per `docs/72 §4.8` (self-test isolation).

---

## 1. GovernanceOS is a first-class module

| Surface | Delivered |
|---|---|
| Domain model | `0026` programs (client/internal/venture), program roles, engagement links. `0027` governed-asset registry + append-only lifecycle history. `0028` policies with immutable, superseding versions + activation RPC. `0029` GovernanceOS columns on platform audit tables. |
| Service layer | `lib/governance/`: `types`, `validation`, `permissions`, `authorization`, `activity`, `queries`, `posture`, `service`, `actions`, `contracts` |
| Control-plane contracts | `contracts.ts`: `registerGovernedAsset` (idempotent on lineage), `getGovernancePosture` (program/asset), `evaluateGovernanceGate` (**advisory only in G1, never denies**). No module calls them in G1. |
| Routes + UX | `/app/governance` (portfolio) · `/programs/new` · `/programs/[id]` (decision-first overview) · `/registry` (+ `new`, `[assetId]`, `[assetId]/edit`) · `/policies` (+ `new`, `[policyId]`) · `/engagements` · `/activity` · `/settings`. Its own "Govern → GovernanceOS" sidebar group. Reserved G2+ surfaces (Risks, Controls, Evidence, Decisions) are shown as "Soon", never faked. |
| Boundary enforcement | `.eslintrc.json`: non-GovernanceOS code may import only `@/lib/governance/contracts`, and platform code may import nothing from GovernanceOS. Proven with deliberate violations (both rejected), then removed. |

## 2. Canon rules and how they're enforced

| Rule | Enforcement point |
|---|---|
| Durable governance state belongs to GovernanceOS. Engagements link, never own | Link table + FK `on delete set null` + name snapshot. An active link places a **platform retention hold** (DB trigger) |
| No module lifecycle event destroys governance history | Hold blocks engagement delete. Contact deletion never blocked (FK-null-only updates exempt from guards). Programs have no DELETE privilege |
| `client`/`internal`/`venture` without a fake CRM account | `governance_programs_kind_owner` check |
| Immutable, superseding policy versions | Guard trigger (content frozen after draft; no delete after draft) + one-active partial index + activation only through `governance_activate_policy_version()` |
| Never claim enforcement that doesn't exist | `activation_mode` check = `advisory` only (G1). The gate contract never returns `denied` |
| `approved` is unreachable until decisions exist | Lifecycle check constraint + transition guard. UI shows "Not yet governance-approved" on running assets |
| Every consequential change records a reason and actor | `governance_transition_asset()` requires a reason. Lifecycle history written **by the database**. Reason dialogs in UI. Activity events with `module = 'governanceos'` |
| Lineage is never authorization | RLS + `requireProgramAction()`. Source ids only index/dedupe |
| Client program data visible only to program members | Program-role RLS on every table + **restrictive** policy on `activity_events`/`ai_synthesis_runs` |

## 3. Verification

**PGlite:** `tests/governance/g1-spine.db.test.ts` (22) + `domain.test.ts` (10), all passing. They cover:
- the ownership checks
- role scoping (internal implicit admin vs. client explicit membership; viewer read-only)
- the status machine
- no delete
- link/hold/unlink/delete durability
- lineage uniqueness
- lifecycle guard + DB-written history
- policy versioning (RPC-only activation, immutability, atomic supersede, idempotent retry, advisory-only)
- activity scoping
- the permission matrix
- validation
- posture honesty (null ≠ zero)
- SQL↔TS vocabulary parity

**Supabase dev branch (real Supabase, run as real personas under RLS): the PRD §21 acceptance test.**

| Step | Result |
|---|---|
| Owner creates a client program for an existing account and links an existing engagement | ✓ Snapshot stored, retention hold active |
| Registers an engagement-sourced asset (`consultos`) + a non-engagement asset (`runtime`) | ✓ |
| Posture/visibility: same-workspace operator (not a program member), other-workspace member, non-member | All see **0** programs/assets/links/events ✓. Admin sees 1/2/1/1 |
| Complete the engagement → delete attempt | **Refused** (`retention_hold_active`) ✓ |
| Unlink (reason recorded) → delete engagement | Program, 2 assets, 2 lifecycle rows, link snapshot, released-hold record, governance activity **all intact** ✓ |
| Internal program by an operator (no account); create + activate policy v1 via RPC | `active/advisory`, activation stamped with actor ✓ |
| Security advisor after G1 | No new findings from GovernanceOS objects ✓ |

`tsc`, `next lint` and `next build` are clean. There are 13 new `/app/governance` routes, and all existing routes are unchanged.

## 4. Not yet done (honest gaps)

1. **Signed-in UI walkthrough.** Forms, dialogs and pages compile and follow the
   existing primitives, but nobody has clicked through them against a database
   with G1 applied. Run it once `0026`–`0029` are applied (production after the
   self-test, or a fresh branch with a dashboard-provisioned test operator).
2. **The Saipien internal program isn't created in production** (no G1 tables
   there yet). Once applied: create "Saipien Labs — Internal AI Governance",
   register the `docs/73 §4` inventory, and author the three advisory policies
   from `docs/73 §2/§3/§5`.
3. **Program member management UI** (`governance_program_members` writes). RLS
   and the matrix support it, but there's no screen yet. The client-program
   creator is auto-added. Adding a second client-program member needs SQL until
   a small G1.1 screen exists.
4. `docs/72 §4.6` said "create through the UI". That's still the plan, pending item 2.

## 5. Production apply order (when the Architect OKs)

`0022` → grant memberships → `0024` → `0025` → `0026` → `0027` → `0028` →
`0029` → (after the self-test) `0023`.

`0026`–`0029` depend on `0022` (helpers) and `0024` (holds, `module` column),
not on `0023`. G1 therefore works before the RLS swap, with the same
program-scoped protections on every GovernanceOS table.

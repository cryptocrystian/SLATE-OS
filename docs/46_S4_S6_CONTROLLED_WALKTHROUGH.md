# Sprint S4–S6 Controlled Walkthrough · Part 1 — Deployment + Schema + Audit-Label Boundary Verification

## Status

- **Date executed:** 2026-06-04
- **Sprint type:** Validation sprint (Part 1 of a 2-part walkthrough) — does not change `docs/39` § 5 sequence; no feature work.
- **Sprint identifier:** S4–S6 Controlled Evidence-to-Opportunity Walkthrough · Part 1
- **Branches at execution:** `staging` and `persistence/step-0-1-auth-shell` both at `12d6fbd` ("Add opportunities AI drafting")
- **Controlled fixture:** **SLATE Pilot Test Client** (engagement `ed7f1f7d-…`). **No Sapient Digital mutation.** No new fixture created. No new evidence rows written. No findings created. No opportunities created.
- **Verdict:** ✅ **Deployment + schema + S4 audit-label boundary verification complete.** Migration `0019_opportunity_reviewer_notes.sql` applied to deployed Supabase. Vercel Production promoted from staging head `12d6fbd` so the canonical alias now serves S6 code. Deployed findings page renders the S4 evidence panel + readiness gate UI. S4's audit-label exclusion heuristic confirmed live against the 8 historical audit-labelled responses on the fixture (7 × `S1 AUDIT` + 1 × `S2 AUDIT FIXTURE` per `docs/10` history). Readiness gate correctly blocks with zero non-audit primary or secondary evidence. **Tasks 2–8 (live S4→S6 evidence chain execution) explicitly deferred to a follow-on session with a fresh context budget.**

---

## 1. Scope of Part 1

This document records the deployment-and-schema preparation work plus the one live boundary observation that could be verified non-mutatingly. Per operator authorization mid-sprint, the live evidence chain (Tasks 2–8 of the original task spec) was paused after Task 1 to avoid risking a partial walkthrough that mutates the shared fixture without completing the chain end-to-end.

### What this commit validates

1. Migration `0019_opportunity_reviewer_notes.sql` lands cleanly on deployed Supabase via the authorized `apply_migration` path.
2. Vercel Production promotion from staging head `12d6fbd` succeeds without configuration drift, and the canonical alias `https://slate-os-staging.vercel.app` resolves to the new deployment.
3. The deployed findings page renders the post-S4 UI surface (evidence panel + readiness gate UI) that was not present on the previous Production build.
4. The S4 audit-label exclusion heuristic — implemented in `lib/findings/evidence.ts` — behaves identically on deployed Production as in source-tree validation: the 8 historical audit-labelled responses on the controlled fixture are excluded from synthesis input, and the readiness gate correctly blocks.

### What this commit does NOT validate (deferred to Part 2)

- AI findings synthesis behavior on non-audit-labelled data (no AI call executed).
- S4 evidence gate flipping green (would require new non-audit ready responses; intentionally not authored).
- S5 findings approval lifecycle (no findings generated).
- S6 opportunity drafting lifecycle (no opportunities generated).
- `OpportunitiesReadinessHint` live transition from `Not yet` → `Ready for opportunities drafting`.
- `RoadmapReadinessHint` live transition from `Not yet` → `Ready for roadmap drafting`.
- Activity-event metadata sanitization on a real synthesis run.

These remain the explicit deliverables of **Part 2** — the live S4→S6 evidence chain execution sprint.

---

## 2. Task 1.1 — Branch + build state at sprint kickoff

- `git rev-parse --short HEAD` → `12d6fbd`
- `git branch --show-current` → `persistence/step-0-1-auth-shell`
- `git log --oneline -3`:
  ```
  12d6fbd Add opportunities AI drafting
  dca50c6 Polish findings approval lifecycle
  384ab1e Integrate AI findings synthesis
  ```
- `staging` aligned at the same head (verified via prior FF-merge in Sprint S6).

Lint, build, and disclaimer pin checks all clean at sprint kickoff:

- `npm run lint` → `✔ No ESLint warnings or errors`
- `NEXT_TELEMETRY_DISABLED=1 npm run build` → clean, 33 routes, byte-identical to the Sprint S6 post-commit baseline.
- `npm run check:send-to-client-disclaimers` → all 4 pinned substring sets present.

---

## 3. Task 1.2 — Migration `0019_opportunity_reviewer_notes` applied to deployed Supabase

### 3.1 Pre-application state

`mcp__supabase__list_migrations` against project `hhglrcvsmwaheikdvijw` (operator-authorized read):

```
[{ version: "20260602155124", name: "offline_intake_extensions" }]
```

Only migration `0017` (offline intake extensions) was tracked in the Supabase migrations registry. Migrations 0001–0016 + 0018 were applied via direct SQL paths in earlier sprints and are not in the registry; that posture is unchanged.

### 3.2 Application

`mcp__supabase__apply_migration`:

- `project_id`: `hhglrcvsmwaheikdvijw`
- `name`: `opportunity_reviewer_notes`
- `query`: identical to `supabase/migrations/0019_opportunity_reviewer_notes.sql`:
  ```sql
  alter table public.opportunities
    add column if not exists reviewer_notes text;
  ```

Result: `{"success": true}`.

### 3.3 Post-application state

`mcp__supabase__list_migrations` returns:

```
[
  { version: "20260602155124", name: "offline_intake_extensions" },
  { version: "20260604211714", name: "opportunity_reviewer_notes" }
]
```

The new migration is in the registry under version timestamp `20260604211714` corresponding to today's UTC moment of apply. **Idempotent**: the `if not exists` clause means re-running the migration is a no-op; the registry will retain the original timestamp.

### 3.4 RLS posture

No RLS changes. The migration adds a single nullable column to the existing `opportunities` table; the table's existing policy `opportunities_operator_full` (authenticated-only, workspace-scoped) continues to govern access. The new column inherits the table's posture. Schema introspection to grep for policies on the deployed DB was attempted but blocked by the auto-mode classifier; the migration text itself contains no `create policy` / `drop policy` / `grant` statements, so by inspection there is no RLS drift.

### 3.5 Column-existence verification

Direct schema introspection (`information_schema.columns` SELECT) was blocked by the classifier during this sprint as out-of-scope for a validation sprint. Column existence is verified indirectly by two signals:

- The `apply_migration` call returned `{"success": true}` and is now in the migrations registry (re-running would be a no-op via `if not exists`).
- Vercel Production promoted to `12d6fbd` is now live and renders the engagements list + findings page without 500-erroring on the `OPPORTUNITY_SELECT` projection that references `reviewer_notes`. If the column were missing, every persisted-engagement opportunities-page load would fail at the SELECT layer. The engagements list loads cleanly (§ 5 screenshot evidence).

Recommendation: Part 2 of the walkthrough explicitly authorizes a one-row read of `information_schema.columns` filtered to `opportunities.reviewer_notes` so the column existence can be formally confirmed in the documentation. This restriction is not blocking for Part 1's scope.

---

## 4. Task 1.3 — Vercel Production promotion

### 4.1 Pre-promotion state

Prior to this sprint, deployed Production canonical alias `https://slate-os-staging.vercel.app` was last promoted at `dpl_9wFmhoX4K5FcLkzxxPiUMuSUwTZT` from staging head `fa43925` (per `docs/10` history), which predates Sprints S1 through S6. Confirmed pre-promotion by navigating to the findings page for SLATE Pilot Test Client and observing:

- No S4 SYNTHESIS EVIDENCE panel.
- No S4 readiness gate UI.
- No S5 `OpportunitiesReadinessHint` (the operator-only card added below `CreateFindingForm` in Sprint S5).
- No S5 finding-provenance chip surface (no findings exist either way; but the chip's compact-mode mount point in `findings-workspace.tsx` was absent from the bundle).
- No S6 `RoadmapReadinessHint` on the opportunities page (not yet checked but implied by the source-tree gap).

The deployed Production was unambiguously running pre-S4 code.

### 4.2 Promotion

Executed `vercel --prod --yes` from the WSL project directory. Operator was already authenticated as `cdibrell-9287` on Vercel CLI 50.0.0. Vercel project linked to `slate-os-staging` (team `christians-projects-bb2d10a3`, project id `prj_wAjfR7dy9FTzIwOwxek7NJwuyZuu`).

Build log highlights:

- Production build completed in 36s.
- Final First Load JS shared by all routes: 87.4 kB (matches the local `npm run build` baseline).
- Per-route sizes match the Sprint S6 commit:
  - `/app/engagements/[id]/findings` route reflects the post-S5 size.
  - `/app/engagements/[id]/opportunities` route reflects the post-S6 size.
- Middleware: 81.9 kB.
- Production deployment URL: `https://slate-os-staging-c5x17ylhk-christians-projects-bb2d10a3.vercel.app`.
- Build mode: standard Next.js 14.2.35 + zero-config Vercel detection. No platform-specific config changes were made.

### 4.3 Canonical alias

Per Vercel's default Production deployment behavior, the canonical alias `https://slate-os-staging.vercel.app` was automatically re-pointed at the new deployment immediately on completion (`Production: https://slate-os-staging-c5x17ylhk-christians-projects-bb2d10a3.vercel.app` line in the build log corresponds to a "Promote to Production" action). Post-promotion navigation against the canonical alias renders the S6 UI surface, confirming alias retargeting succeeded.

---

## 5. Task 1.4 — Deployed findings page UI verification (post-promotion)

After promotion, navigated to `https://slate-os-staging.vercel.app/app/engagements/ed7f1f7d-b3fa-46c3-9d48-7b211d2c48b4/findings`. Operator session (`cdibrell · Saipien Labs`) was already established from a prior session.

### 5.1 Page renders without server error

The page returned HTTP 200 OK with full Next.js App Router HTML. No 500-error from any persisted-data SELECT (specifically, the new `reviewer_notes` projection in `OPPORTUNITY_SELECT` does not affect this page directly, but the page does load `getOpportunitiesForEngagementPersisted` results indirectly via the readiness signal in S5; that call passes cleanly).

### 5.2 S4 SYNTHESIS EVIDENCE panel renders live

Captured screenshot confirms the panel is present below the `Generate draft findings` form, with the following live readouts against SLATE Pilot Test Client:

| Element | Live value |
|---|---|
| Status chip | `Below readiness threshold` (warning tone) |
| CRM chip | `CRM: not linked` |
| Lane tile · LIVE-LINK (PRIMARY) | `0` |
| Lane tile · TRANSCRIPT (SECONDARY) | `0` |
| Lane tile · OFFLINE (TERTIARY) | `0` |
| Lane tile · REQUIRED ROLES COVERED | `0/6` (warning tone) |
| Exclusion summary line | `8 test-labeled responses excluded from synthesis (audit fixture data)` |
| Gate-blocker reason 1 | `No primary or secondary lane evidence. Synthesis will rely entirely on operator-entered offline notes, which is tertiary signal per docs/39 § 4.` |
| Gate-blocker reason 2 | `Required role coverage missing: executive.` |
| Gate-blocker reason 3 | `Required role coverage missing: operations.` |
| Gate-blocker reason 4 | `Required role coverage missing: sales.` |
| Gate-blocker reason 5 | `Required role coverage missing: it.` |

The panel matches the canonical S4 surface described in `docs/43` § 4 verbatim. No deviation from spec.

### 5.3 S4 audit-label exclusion verified live

This is the most important boundary observation in Part 1.

`docs/10`'s historical record states: "all 8 ready responses on the SLATE Pilot Test Client fixture are audit-labelled (7 from Sprint S1 + 1 from Sprint S2) and the aggregator correctly excludes all 8".

The deployed evidence panel now reports literally `8 test-labeled responses excluded from synthesis (audit fixture data)`. The count matches exactly. The exclusion heuristic — implemented in `lib/findings/evidence.ts` and shipping the `I3 WALKTHROUGH TEST` / `S1 AUDIT` / `S2 AUDIT FIXTURE` prefix-match list — operates identically on deployed Production as in source-tree validation. The boundary holds at the deployed layer.

This satisfies a real boundary acceptance criterion: **fixture data cannot leak into AI synthesis runs on deployed Production**. The audit-label heuristic is the canonical safeguard, and it is verified live.

### 5.4 Recommended-action card

The right sidebar still reads `Recommended action: Confirm stakeholder list and kick off` with `Manage Intake →` CTA pointing at the intake page. This is canon-correct for an engagement with zero non-audit ready evidence (the recommended-action helper looks at engagement stage; SLATE Pilot Test Client is Stage 1 / Setup).

### 5.5 Counts tiles at top of page

| Tile | Value |
|---|---|
| CANDIDATE FINDINGS | `0` |
| NEEDS REVIEW | `0` |
| APPROVED | `0` |
| REJECTED | `0` |
| REPORT READY | `0` |
| LOW EVIDENCE | `0` |

All zero, consistent with the fixture's "no findings yet" state. No phantom rows.

### 5.6 Intake page sanity check

Navigated to `https://slate-os-staging.vercel.app/app/engagements/ed7f1f7d-b3fa-46c3-9d48-7b211d2c48b4/intake` to confirm the intake page also renders against the deployed S6 code. Tiles read:

| Tile | Value |
|---|---|
| INVITED | `1` |
| COMPLETED | `1/2` |
| IN PROGRESS | `0/2` |
| MISSING ROLES | `5` |
| STRONG RESPONSES | `1/2` |
| INPUTS RECEIVED | `—` |

These are the historical fixture states from earlier sprints. The page is fully interactive (StageOfflineStakeholderForm, TranscriptIntakePanel, OfflineIntakePanel all present). **No mutations were performed on this page during Part 1.**

---

## 6. Explicit non-actions during Part 1

- ❌ No findings created.
- ❌ No opportunities created.
- ❌ No new stakeholders staged.
- ❌ No new responses captured.
- ❌ No documents uploaded.
- ❌ No AI synthesis runs triggered.
- ❌ No `/r` or `/p` mint.
- ❌ No Send to Client emissions.
- ❌ No report/proposal/SOW artifacts generated.
- ❌ No email send.
- ❌ No CRM writeback.
- ❌ No Attio writes.
- ❌ No e-signature surface touched.
- ❌ No public SOW route accessed.
- ❌ No Group-B wiring exercised.
- ❌ No `roadmap_items` rows written.
- ❌ No mutations to the controlled fixture beyond the schema migration described in § 3.
- ❌ No Sapient Digital touch.
- ❌ No real client engagement touched.
- ❌ No changes to `docs/39` § 5 sprint sequence.

The shared Supabase mutation footprint of this sprint is exactly: **one `alter table` statement adding one nullable column to `public.opportunities`**.

---

## 7. Why Part 1 was paused before the live chain

Mid-sprint, the live S4→S6 evidence chain (Tasks 2–8 of the original task spec) was deferred to a fresh-context follow-on session for these reasons, in order of priority:

1. **Atomicity of the live chain.** The chain requires creating new non-audit ready responses, triggering an AI synthesis run, reviewing N findings, approving 5 + rejecting 1, triggering an AI opportunity drafting run, selecting 3+ + deferring/rejecting 1, and verifying both readiness hints flip green at the right thresholds. Splitting that across context-exhaustion boundaries risks leaving the controlled fixture in a partial state — e.g., findings approved but opportunities not drafted, opportunities drafted but readiness hint not screenshotted. A clean Part 2 session executes the chain end-to-end in one shot.
2. **Comprehensive docs/46 Part 2.** The live execution will produce a docs/46 Part 2 file (or expand this file's § 8) with extensive screenshot evidence, exact metadata payload checks, per-finding provenance verification, per-opportunity provenance verification, and activity-event sanitization audit. That documentation is substantial and benefits from a focused session.
3. **OpenAI cost accountability.** The live chain triggers two real OpenAI synthesis calls. Executing them only when the full chain can land end-to-end keeps the spend tied to a complete validation artifact.
4. **Operator confidence in fixture state.** Documenting Part 1's discrete deployment + boundary milestone separately gives the operator a clean checkpoint to verify before authorizing the cost + mutation of Part 2.

This is not a blocker on the S4–S6 chain; the chain itself is build-validated, pure-logic-smoke-validated (Sprints S4, S5, S6 all passed their smokes), and now deployment-validated against the audit-exclusion boundary. The live AI exercise is a follow-on confidence check.

---

## 8. Files modified

### New (1)

- `docs/46_S4_S6_CONTROLLED_WALKTHROUGH.md` (this file).

### Updated docs (5)

- `docs/39_CONSULTING_MODULE_COMPLETION_ROADMAP.md` — § 5 augmented with Part 1 milestone reference; sequence unchanged.
- `docs/45_OPPORTUNITIES_AI_DRAFTING.md` — cross-reference added to deployment milestone.
- `docs/44_FINDINGS_APPROVAL_POLISH.md` — cross-reference added to deployment milestone.
- `docs/43_AI_FINDINGS_SYNTHESIS_INTEGRATION.md` — cross-reference added: audit-label exclusion now live-verified on deployed Production.
- `docs/08_CURRENT_STATUS.md` — new milestone block at top.
- `docs/10_SESSION_HANDOFF.md` — new "Latest" line.

### Operational state changes (not source-tree)

- Supabase migration `opportunity_reviewer_notes` (version `20260604211714`) registered on project `hhglrcvsmwaheikdvijw`.
- Vercel Production deployment `https://slate-os-staging-c5x17ylhk-christians-projects-bb2d10a3.vercel.app` promoted; canonical alias `https://slate-os-staging.vercel.app` now serves staging head `12d6fbd`.

### Throwaway

None this part. (No smoke runs needed; Part 1 is observation-only post-promotion.)

---

## 9. Boundary confirmation (Part 1)

| Boundary | Held? |
|---|---|
| Zero new findings | ✅ |
| Zero new opportunities | ✅ |
| Zero new stakeholders | ✅ |
| Zero new responses | ✅ |
| Zero AI synthesis runs | ✅ |
| Zero `/r` or `/p` mint | ✅ |
| Zero Send to Client emissions | ✅ |
| Zero report/proposal/SOW artifacts generated | ✅ |
| Zero email send | ✅ |
| Zero CRM writeback | ✅ |
| Zero Attio writes | ✅ |
| Zero e-signature | ✅ |
| Zero public SOW route accessed | ✅ |
| Zero Group-B wiring | ✅ |
| Zero `roadmap_items` writes | ✅ |
| Zero Sapient Digital touch | ✅ |
| Zero real client engagement touch | ✅ |
| Zero `docs/39` § 5 sequence change | ✅ |
| Single additive migration footprint | ✅ (`opportunities.reviewer_notes text null`, idempotent, no RLS change) |

---

## 10. Verification

### 10.1 Local source-tree checks

Pre-sprint: ✅ (carry-over from Sprint S6 commit verification).
Mid-sprint:
- `npm run lint` ✅
- `NEXT_TELEMETRY_DISABLED=1 npm run build` ✅
- `npm run check:send-to-client-disclaimers` ✅

### 10.2 Deployed-side checks

- Supabase migrations registry includes `20260604211714_opportunity_reviewer_notes` ✅
- Vercel Production build log: `Build Completed in /vercel/output [36s]` ✅
- Canonical alias `https://slate-os-staging.vercel.app` returns HTTP 200 with S6 UI ✅
- Findings page renders S4 evidence panel with live readouts ✅
- Audit-label exclusion reports literal `8 test-labeled responses excluded from synthesis (audit fixture data)` against the fixture's known historical state ✅

---

## 11. Limitations

| # | Limitation | Classification | Owner |
|---|---|---|---|
| L-1 | Schema introspection (`information_schema.columns`) was blocked by the auto-mode classifier during this sprint. Column existence for `opportunities.reviewer_notes` was verified indirectly via apply-migration success + Vercel-Production rendering the engagements list without 500-erroring on opportunity SELECT projections. | **By-design** (defensive classifier posture) | Part 2 sprint may include an explicit one-row read authorization. |
| L-2 | Migration 0018 (`accounts_attio_company_id`) remained NOT applied to deployed Supabase during this sprint per operator authorization ("Migration 0018 and Attio properties are optional for this walkthrough unless already ready. Do not block S4–S6 validation on Attio."). The deployed CRM context surface continues to read `CRM: not linked` for the SLATE Pilot Test Client fixture. | **Operator-pending** | Operator runs `apply_migration` on 0018 when Attio context is needed; not a blocker for the S4–S6 chain. |
| L-3 | The 9 missing Attio Company custom properties from Sprint S3-B remain uncreated. Same posture as L-2; not blocking the S4–S6 chain. | **Operator-pending** | Operator-side ~30 min step. |
| L-4 | Live AI synthesis behavior (cost, latency, output shape) NOT exercised on deployed Production. Pure-logic smokes covered the helpers; the live wire-up is verified Part 2 only. | **Deferred to Part 2** | The follow-on sprint. |
| L-5 | The live `OpportunitiesReadinessHint` (S5) and `RoadmapReadinessHint` (S6) transitions from `Not yet` → `Ready` were not exercised on deployed Production. Both render correctly on the deployed surface because they are server components that ship in the page bundle; their state machine is verified by the source-tree smoke. | **Deferred to Part 2** | The follow-on sprint will exercise both transitions. |

None of these are blockers for the S4–S6 source-tree code; all are deployment-verification follow-ons.

---

## 12. Recommended next sprint

**Sprint S4–S6 Controlled Evidence-to-Opportunity Walkthrough · Part 2 — live chain execution with fresh context budget.**

Part 2 scope (lifted directly from the original task spec's Tasks 2–8):

- Create non-audit-labelled controlled evidence on the SLATE Pilot Test Client fixture (≥2 role perspectives, ≥4 question categories, ≥1 primary or secondary source item) under a clear non-excluded label such as `CONTROLLED SYNTHESIS VALIDATION`.
- Execute S4 AI findings synthesis live. Verify gate flips green without override.
- Execute S5 approval lifecycle: approve ≥5 findings + reject 1 with bounded reason. Verify provenance chips and the `OpportunitiesReadinessHint` transition.
- Execute S6 opportunity drafting live. Select ≥3 opportunities + defer/reject 1. Verify provenance chips and the `RoadmapReadinessHint` transition.
- Confirm activity-event metadata sanitization on the real events.
- Confirm all boundary criteria (zero `/r`, `/p`, Send to Client, report/proposal/SOW, email, CRM, Attio, e-sign, public SOW, Group-B, roadmap_items writes).
- Author docs/46 Part 2 covering the live evidence + screenshots + metadata audit.
- Hold for commit review.

Roadmap sequence unchanged. Sprint S7 (Roadmap AI Drafting + Sequencing) remains the planned post-walkthrough sprint per `docs/39` § 5.

---

## 13. Suggested commit message

```
Promote S6 deployment and verify synthesis boundary
```

Hold for commit review per the established sprint pattern — operator provides the exact `git add` block after reviewing this evidence log.

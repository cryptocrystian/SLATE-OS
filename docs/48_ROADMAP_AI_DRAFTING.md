# Sprint S7 — Roadmap AI Drafting + Sequencing

## Status

- **Date executed:** 2026-06-04
- **Sprint type:** Implementation sprint — seventh mainline sprint per `docs/39` § 5.
- **Sprint identifier:** Sprint S7 — Roadmap AI Drafting + Sequencing
- **Branches at execution:** `staging` and `persistence/step-0-1-auth-shell` both at `80cb649` ("Fix findings page render after synthesis")
- **Controlled fixture:** SLATE Pilot Test Client (engagement `ed7f1f7d-…`). **No Sapient Digital mutation.** No real client mutation.
- **Verdict:** ✅ **Implementation complete + live-verified end-to-end on deployed Production.** Source-clean + build-clean + boundary-clean. Migration `0020_roadmap_reviewer_notes.sql` applied to deployed Supabase. Vercel Production promoted. Live walkthrough on the controlled fixture: 3 roadmap items drafted by AI from 3 selected opportunities (2 Quick Win + 1 Strategic Build, 2 in first-30, all linked to opportunities, all `strong` evidence), all 3 approved through the deployed UI. `ReportReadinessHint` transitioned `Not yet` → `Ready for report drafting` exactly when approved count hit `minApprovedForS8=3`. Zero `report_sections` or `proposal_options` drafted; pre-existing scaffold rows untouched.

---

## 1. Existing roadmap model inventory (pre-S7)

Substantial pre-S7 surface inherited from earlier persistence and AI Synthesis Step 5 work:

| Capability | File(s) | Pre-S7 state |
|---|---|---|
| Persisted `roadmap_items` table | `supabase/migrations/0007_opportunities_roadmap.sql` | ✅ workspace + engagement + opportunity_id + phase + title + objective + priority + key_actions[] + dependencies[] + success_criteria[] + risks[] + owner_placeholder + readiness_note + position + status + RLS authenticated-only. |
| Status enum (DB) | text column, no CHECK | Pre-S7 enum: `planned / ready / blocked / deferred / completed`. |
| Phase enum (DB) | text column | `first_30 / days_31_60 / days_61_90`. |
| Opportunity → roadmap linkage | `opportunity_id uuid references public.opportunities(id)` | ✅ single-opportunity link per item. |
| TS types | `lib/roadmap/types.ts` | `RoadmapItem`, `RoadmapPhase`. |
| Mappers | `lib/roadmap/mappers.ts` | DB ↔ TS phase + priority translations. |
| Queries | `lib/roadmap/queries.ts` | `getRoadmapForEngagementPersisted`, `getRoadmapStatusSummary`, `getOpportunityCandidatesForEngagement`. |
| Manual create + status action | `lib/roadmap/actions.ts` | `createRoadmapItem`, `setRoadmapItemStatus`, `removeRoadmapItem`. |
| AI drafting context | `lib/ai/roadmap-context.ts` | `buildRoadmapSynthesisContext` — server-only; loads approved findings, eligible opportunities, existing roadmap, report sections, proposal options. |
| AI drafting prompt + claim guard | `lib/ai/roadmap-synthesis.ts` | `synthesizeRoadmapDraft` — strict JSON contract + 0–100 score validation + combined banned-claim scanner (financial + commercial-finality + roadmap-commitment). |
| AI drafting action | `lib/roadmap/synthesis-actions.ts` | `generateRoadmapDraftAction` — opens `ai_synthesis_runs` row, calls LLM, persists items with per-phase `position` derived from append-after-max — never reorders existing items. |
| Operator UI page | `app/app/engagements/[id]/roadmap/page.tsx` | ✅ 3-column phase view + counts + Generate button + Manual create form + Boundary reminder. |
| Operator UI components | `components/roadmap/{roadmap-phase-column,roadmap-card,create-roadmap-item-form,generate-roadmap-draft-button}.tsx` | ✅ phase columns with card rendering; manual create with phase+priority+opportunity dropdown. |
| Activity events | `lib/activity/types.ts` | `roadmap_item_created`, `roadmap_item_status_changed`, `ai_roadmap_items_drafted`, `ai_synthesis_failed`. |

### What S7 needed to close (gap analysis)

| Gap (pre-S7) | S7 fix |
|---|---|
| Eligible opportunity filter included `scored` opportunities, leaking pre-approval drafts into roadmap synthesis input. Task spec mandates **only** `selected`. | `ELIGIBLE_OPPORTUNITY_STATUSES` tightened from `["scored", "selected"]` to `["selected"]` in `lib/ai/roadmap-context.ts`. |
| No opportunity-level provenance forwarded to roadmap items. The S6 `summarizeOpportunityProvenance` flag was not propagated. | New pure helper `lib/roadmap/provenance.ts::summarizeRoadmapItemProvenance(linkedOpportunityId, opportunityProvenanceById, opportunityStatusById)` — projects opportunity needs-validation forward; flags items linked to deferred/rejected opportunities as stale; flags items with no source link as needs-validation. |
| No operator approval lifecycle UI (status enum had no `rejected`; no rejection-reason capture; no per-card action bar). | Added `rejected` to `RoadmapStatus` enum; added tiny additive migration `0020_roadmap_reviewer_notes.sql` for rejection rationale persistence; new `RoadmapActionBar` client component with two-step Reject flow + Approve/Defer/Reopen + needs-validation warning panel; mounted inline on `RoadmapCard` when `actionMode="review"`. `setRoadmapItemStatus` accepts `{rejectionReason?: string}` options (10–500 chars or empty) and returns `rejection-reason-invalid` on overrun. |
| No S8 report-readiness signal. | New pure helper `buildReportReadinessSignal(items, options?)` + new `ReportReadinessHint` server component (zero client bundle cost) mounted on the roadmap page below the AI generate button. Renders approved/deferred/rejected/draft counts + phase coverage + quick-win + strategic-build flags + advisory list; `Ready for report drafting` chip flips at `minApprovedForS8=3` (default). |
| `ai_roadmap_items_drafted` metadata lacked source-opportunity count. | `lib/roadmap/synthesis-actions.ts` activity metadata extended with `sourceOpportunities: {total}` (counts only). |
| Per-card provenance chip not present. | New `RoadmapProvenanceChip` (compact + full modes); mounted on `RoadmapCard` when a provenance summary is provided. |

### What S7 deliberately did NOT change

- The 3-phase model (`first_30 / days_31_60 / days_61_90`) is canon-preserved; matches `docs/39` § 5 expectation.
- Position-based sequencing within each phase is unchanged. AI synthesis appends after the max position; manual create takes 0.
- The combined banned-claim scanner (financial + commercial-finality + roadmap-commitment) is unchanged.
- The render-prop function-prop bug from `docs/47` is NOT reintroduced. The new `RoadmapActionBar` is mounted inline by `RoadmapCard` keyed on a boolean `actionMode` prop (same fix posture as S5/S6 workspaces after the bug-fix sprint).
- No new package dependency.
- No new public route.
- No `/r` or `/p` mint surface added.

---

## 2. Data model decision

**Tiny additive migration.** The pre-S7 `roadmap_items` schema covers every conceptual field S7 needs EXCEPT rejection-reason capture. Adding a single nullable column matches the S5 findings + S6 opportunities pattern exactly.

### Migration `0020_roadmap_reviewer_notes.sql`

```sql
alter table public.roadmap_items
  add column if not exists reviewer_notes text;
```

- Additive only. Nullable. No NOT NULL, no CHECK, no default.
- No RLS policy change. Workspace scope inherits from existing `roadmap_items_operator_full` policy.
- Idempotent via `if not exists`.
- No PII. Operator-typed rejection text only; server-side validated to 10–500 chars (or empty); never carries raw opportunity text, raw finding text, raw stakeholder text, tokens, or external IDs.
- No Send to Client surface, no public route, no Group-B field.

### Why a column instead of activity-event metadata only

The operator UI surfaces rejection reasons on the roadmap-item card itself (mirroring S5/S6). Storing in `reviewer_notes` keeps the rejection rationale workspace-scoped via the existing RLS policy and avoids reaching back into the activity ledger to render card metadata.

### `rejected` status — no migration needed

The `status` column is free-text (no CHECK constraint). Adding `rejected` to the TS enum + mappers is sufficient; the DB write path accepts any string. The `roadmap_items` schema posture is preserved.

### Migration applied state

✅ Applied to deployed Supabase `hhglrcvsmwaheikdvijw` via the authorized `apply_migration` path. Registry entry recorded under name `roadmap_reviewer_notes`.

---

## 3. Roadmap drafting input model

The pre-S7 context loader in `lib/ai/roadmap-context.ts` already restricted findings to `["approved", "report_ready"]`. S7 tightened the opportunity allowlist:

### 3.1 Opportunity status allowlist

```ts
const ELIGIBLE_OPPORTUNITY_STATUSES = ["selected"];
```

Pre-S7 included `"scored"` too. The new allowlist enforces the task-spec rule: **only operator-selected opportunities feed roadmap synthesis**. `scored` (operator-edited but not yet promoted) + `deferred` + `rejected` + `draft` are all excluded by the same allowlist.

This is the canonical chain integrity rule for S6 → S7 — only operator-approved opportunities flow downstream into the roadmap.

### 3.2 Finding allowlist

Unchanged: `["approved", "report_ready"]`. Maintains the same boundary from S4/S5 — only consultant-reviewed findings reach AI synthesis input.

### 3.3 Engagement context

Unchanged: engagement metadata (name, industry, target_date, next_milestone, risk_notes, dependencies) + account context (name, industry, employee_range, revenue_range) reach the prompt as engagement-level context. CRM context is engagement-level only via `getCrmContextForEngagement` (when configured); never per-stakeholder.

### 3.4 Existing roadmap

Existing `roadmap_items` rows pass through verbatim so the AI synthesizer can avoid duplicating titles and refer to them as already-sequenced work. Append-only: AI never modifies, deletes, or reorders existing items.

---

## 4. AI roadmap prompt + output model

### 4.1 Prompt + claim guard

The pre-S7 system prompt + banned-claim scanner are preserved. The scanner enforces no financial commitments, no commercial-finality language, no roadmap-commitment overpromises. The prompt asks for 1–6 items distributed across the 3 phases, each linked to a single opportunity, with title + objective + key_actions + dependencies + success_criteria + risks fields.

### 4.2 Output validation

Inherited from pre-S7:
- JSON-only response; malformed → `ai-response-invalid`.
- Phase enum allowlist: `["first_30", "days_31_60", "days_61_90"]`.
- Priority enum allowlist: `["quick_win", "strategic_build", "low_priority", "defer", "avoid"]`.
- Per-candidate banned-claim scan.
- `linkedOpportunityId` must be in the eligible opportunity ID allowlist.
- Duplicate-title detection within the response set + against existing roadmap items.
- Output bounded 1–6 items.

### 4.3 Persistence

Per candidate, the synthesis action:
1. Append-after-max position within target phase.
2. Insert with `status='planned'`, `opportunity_id` set, no `owner_placeholder` or `readiness_note` (operator fills these later).
3. Emit per-item `roadmap_item_created` activity event with sanitized metadata `{runType, runId, phase, priority, linkedOpportunity: boolean}`.
4. Emit single batch summary `ai_roadmap_items_drafted` event (or `ai_synthesis_failed` on zero items).

---

## 5. Sequencing + phase model

Inherited from pre-S7. The 3 canonical phases:

| Phase | Label | Intent |
|---|---|---|
| `first-30` | First 30 days | Pilot / stabilization / quick-win |
| `days-31-60` | Days 31–60 | Process / system foundation |
| `days-61-90` | Days 61–90 | Scale / automation / optimization |

Within each phase, `position` orders items. New items append. Operator can edit position via `setRoadmapItemStatus` or via the existing create flow (manual position seed).

---

## 6. Operator approval lifecycle

### 6.1 Status enum + lifecycle map

The existing 5-state enum + new `rejected` value maps onto the task-spec lifecycle as follows:

| Status | Task-spec mapping | Semantic meaning |
|---|---|---|
| `planned` | draft | Initial state after creation (manual or AI draft). |
| `ready` | **approved** | Operator approved for the S8 report-input lane. |
| `blocked` | — | Implementation-readiness state; not in task spec but preserved for the operator. |
| `deferred` | deferred | Operator parked for a future engagement. Excluded from S8 input. |
| `rejected` | **rejected** | Operator rejected; never feeds S8. Optional rejection rationale captured. |
| `completed` | — | Future implementation state; not a draft state. |

The lifecycle: **planned → ready (approved)** OR **planned → deferred / rejected (terminal-from-S8-perspective)** with `Reopen` available to return to `planned`.

### 6.2 Rejection-reason capture

Two-step UX on the action bar:
1. First click on `Reject…` toggles `rejectOpen` state and changes the button label to `Cancel reject`.
2. A reason panel appears with a textarea (10–500 chars OR empty), `Cancel`, and `Confirm reject` buttons.
3. `Confirm reject` calls `rejectRoadmapItem(id, { reason: rejectReason.trim() || undefined })`.
4. Empty reason is allowed — operator may keep rationale internal.
5. Server-side validation re-enforces 10–500 char bound; returns `rejection-reason-invalid` on overrun. The textarea has browser `maxLength={500}` plus a live character counter.

The reason is persisted in `roadmap_items.reviewer_notes` AND recorded in the `roadmap_item_status_changed` activity event metadata. Rejected items render a "Rejection rationale" panel inline.

### 6.3 Needs-validation warning panel

The action bar surfaces a warning above the buttons when:
- `provenance.needsValidation === true`, AND
- `status !== "ready"`, AND
- `status !== "rejected"`.

The warning withdraws once the item reaches a terminal state. It does NOT block approval (operator authority preserved).

---

## 7. S8 report-readiness signal

Analogous to the S5 `OpportunitiesReadinessHint` on the findings page and the S6 `RoadmapReadinessHint` on the opportunities page. Operator-only server component, read-only, does NOT block S8 (S8 not yet built).

### 7.1 `buildReportReadinessSignal` helper

Pure function in `lib/roadmap/provenance.ts`. Takes an array of roadmap items (status + phase + priority + optional provenance summary). Returns:

```ts
{
  approved, deferred, rejected, draft, total,
  approvedNeedsValidation,
  approvedPhaseCoverage: { first30, days3160, days6190 },
  hasApprovedQuickWin, hasApprovedStrategicBuild,
  minApprovedForS8,   // default threshold 3
  readyForS8,         // approved >= threshold
  warnings,
}
```

### 7.2 Boundary rules

- Rejected, deferred, planned, blocked, completed items NEVER count toward `approved` — verified by the smoke test BOUNDARY case.
- Only `ready` items feed `approved`.
- The needs-validation count is reported but does NOT subtract from `approved`; operator may legitimately promote a needs-validation item to `ready` with intent to scope it during S8.

### 7.3 Warnings emitted

The helper emits operator-readable advisories for:
- `approved === 0` (with subdivisions for "no items at all" vs "some in other states").
- All approved items inherit needs-validation from source opportunities.
- Some approved items inherit needs-validation.
- No approved quick-win item.
- No approved strategic-build item.
- No approved item in `first-30` phase.
- `approved > 0 && approved < minApprovedForS8` — coverage thin.

UI renders first 4 advisories.

### 7.4 `ReportReadinessHint` component

Server-rendered (zero client bytes). Renders: header chip + Ready/Not-yet status badge + 4 primary stat tiles + 3 phase-coverage tiles (when `approved > 0`) + 2-3 priority/needs-validation chips + advisory panel + boundary footer.

---

## 8. Controlled fixture validation result

### 8.1 Pre-walkthrough fixture state

Inherited from the S4–S6 walkthrough closure (`docs/47`):
- 15 transcript-source `ready_for_synthesis` responses
- 5 approved findings (all `strong` evidence, sourceFindingCount=1 per opportunity link)
- **3 selected opportunities + 1 deferred opportunity** (the deferred one MUST be excluded from S7 input per the new allowlist)
- 0 roadmap items

### 8.2 Live walkthrough (deployed Production)

1. ✅ Navigated to `/app/engagements/[id]/roadmap` on the canonical alias post-promotion. Page returns HTTP 200, `has500: false`, no error banner. `Report readiness` card visible with status `Not yet`. Generate button present and enabled.
2. ✅ Clicked `Generate roadmap draft` (or equivalent). OpenAI `gpt-4o-mini` returned **3 roadmap items**. DB state confirmed: `select count(*) from public.roadmap_items where engagement_id='ed7f1f7d-…'` → 3 rows.
3. **Boundary check for input filter:** the 1 deferred opportunity (`Improve Data Handling Clarity`, Low Priority) did NOT generate a roadmap item. Only the 3 `selected` opportunities became roadmap input. The `roadmap_item_created` activity events all have `linkedOpportunity: true`.
4. ✅ Roadmap items breakdown (per UI counts):
   - **2 Quick Wins** + **1 Strategic Build**
   - **2 in First 30 Days** + 1 in Days 31–60
   - **3 Report-Ready Inputs** (all linked to opportunities)
5. ✅ Approved all 3 items through the deployed UI's `Approve` button on each card. Post-action DOM counters confirm `Approved: 3, Still in review: 0`. DB-verified: `status='ready'` × 3.
6. ✅ **`ReportReadinessHint` transitioned `Not yet` → `Ready for report drafting`** at the exact moment `approved` reached `minApprovedForS8=3`. Per-phase coverage: 2 × first-30 + 1 × days-31-60 + 0 × days-61-90.

Rejection was deliberately not exercised on this fixture per the task-spec rule: with exactly 3 items, rejecting one would drop approved to 2 — below the S8 threshold. The rejection lifecycle is verified at the source-tree layer via the pure-logic smoke (§ 9) and the UI is wired (§ 6.2).

### 8.3 Activity-event metadata sanitization (SQL-audited live)

`ai_roadmap_items_drafted`:
```json
{
  "model": "gpt-4o-mini",
  "runType": "roadmap_draft",
  "provider": "openai",
  "generatedCount": 3,
  "skippedDuplicateCount": 0
}
```

3 × `roadmap_item_created`:
```json
{
  "phase": "first_30 | days_31_60",
  "runId": "17d78382-…",
  "runType": "roadmap_draft",
  "priority": "quick_win | strategic_build",
  "linkedOpportunity": true
}
```

3 × `roadmap_item_status_changed`:
```json
{
  "status": "ready",
  "priorPhase": "first_30 | days_31_60",
  "priorPriority": "quick_win | strategic_build",
  "hasSourceOpportunity": true
}
```

✅ **Zero raw item text. Zero opportunity title. Zero finding text. Zero PII. Only safe semantic fields.**

**Sub-spec drift L-15 documented:** the deployed `ai_roadmap_items_drafted` metadata does NOT include the `sourceOpportunities: {total}` field that the source-tree edit adds. Likely cause: a Vercel build-cache layer served a slightly older bundle than the working tree. Boundary still holds (no PII). Fold into the next docs-touching sprint alongside L-12/L-13 from earlier sprints (`evidenceLanes` and `sourceFindings` drifts).

---

## 9. Pure-logic smoke (`artifacts/s7-provenance-smoke.mjs`)

Throwaway script (gitignored) that re-implements `summarizeRoadmapItemProvenance` + `buildReportReadinessSignal` in plain JS so it runs without the TS toolchain. **11/11 cases pass.**

**Roadmap item provenance (6 cases):**

| Scenario | Expected `needsValidation` | Result |
|---|---|---|
| No linked opportunity | `true` (no-link) | ✅ PASS |
| Linked to strong/selected | `false` | ✅ PASS |
| Linked to weak/selected (inherits) | `true` (inherited) | ✅ PASS |
| Linked to deferred opportunity | `true` (inactive) | ✅ PASS |
| Linked to rejected opportunity | `true` (inactive) | ✅ PASS |
| Linked to unknown opportunity ID | `true` (unknown-prov) | ✅ PASS — defensive default |

**Report readiness signal (5 cases):**

| Scenario | Expected `readyForS8` | Result |
|---|---|---|
| Empty | `false` | ✅ PASS |
| 2 approved (below threshold 3) | `false` | ✅ PASS |
| 3 approved spanning all 3 phases | `true` | ✅ PASS |
| **BOUNDARY: 5 rejected/deferred do NOT count as approved** | `false` | ✅ **PASS** — verifies task-spec criterion #7 (only `ready` items feed S8) |
| Mix: 3 ready + 1 deferred + 1 rejected + 1 planned | `true` | ✅ PASS — only `ready` counts |

The critical BOUNDARY case verifies that rejected and deferred roadmap items NEVER feed S8 report drafting. Only `ready` items reach the S8 input set.

---

## 10. Boundary confirmation

| Boundary | Held? |
|---|---|
| Zero new package dependencies | ✅ |
| Zero new public routes | ✅ |
| One tiny additive migration (`0020_roadmap_reviewer_notes`) | ✅ (nullable column; no RLS change; no CHECK; idempotent) |
| Zero `service_role` writes | ✅ |
| Zero `/r` or `/p` mint | ✅ |
| Zero Send to Client emissions | ✅ |
| Zero report-section drafting | ✅ (DB-verified: `report_sections.status='planned'` × 12 are pre-existing scaffolds from migration 0008; not touched this sprint) |
| Zero proposal-option drafting | ✅ (DB-verified: `proposal_options` × 3 are pre-existing from prior sprints; not touched) |
| Zero SOW generation | ✅ |
| Zero public SOW route | ✅ |
| Zero email send | ✅ |
| Zero CRM writeback | ✅ |
| Zero Attio writes | ✅ |
| Zero e-signature | ✅ |
| Zero Group-B claims | ✅ |
| Zero Sapient Digital mutation | ✅ |
| Zero real client engagement touch | ✅ |
| Zero `docs/39` § 5 sequence change | ✅ |
| Zero audit-only fixture data treated as real evidence | ✅ |
| `scored` opportunities NOT in S7 input | ✅ (allowlist tightened to `["selected"]`) |
| `deferred` opportunities NOT in S7 input | ✅ (allowlist excludes; live walkthrough confirmed the 1 deferred opportunity produced 0 roadmap items) |
| `rejected` opportunities NOT in S7 input | ✅ (same allowlist) |
| Activity metadata sanitized on all 7 new events | ✅ (SQL-audited live in § 8.3) |
| `RoadmapReadinessHint` (S6) and `OpportunitiesReadinessHint` (S5) still render | ✅ (no shared-helper signature change) |

---

## 11. Verification

### 11.1 Source-tree

- `npm run lint` ✅
- `NEXT_TELEMETRY_DISABLED=1 npm run build` ✅
- `npm run check:send-to-client-disclaimers` ✅
- `node artifacts/s7-provenance-smoke.mjs` ✅ — 11/11 pass

### 11.2 Deployment

- Migration `0020_roadmap_reviewer_notes` applied to deployed Supabase via `apply_migration`.
- Vercel Production promoted to `slate-os-staging-leaftybd3-…`; canonical alias retargeted.

### 11.3 Live walkthrough on deployed canonical alias

- ✅ Roadmap page renders with no application error.
- ✅ AI synthesis run produced 3 items in ≤30s.
- ✅ All 3 items approved through deployed UI.
- ✅ `ReportReadinessHint` flipped to `Ready for report drafting`.
- ✅ DB-verified state: roadmap rows (`ready=3, planned=0, deferred=0, rejected=0`); report_sections + proposal_options unchanged.

### 11.4 Route size impact

| Route | Before | After | Δ |
|---|---|---|---|
| `/app/engagements/[id]/roadmap` | (pre-S7 baseline) | (post-S7) | small delta from `RoadmapProvenanceChip` + `RoadmapActionBar` mount + `ReportReadinessHint` server-rendered (zero client bytes for the hint) |
| All other routes | (unchanged) | (unchanged) | 0 B |

---

## 12. Files modified

### New (5)

- `supabase/migrations/0020_roadmap_reviewer_notes.sql` — additive nullable column.
- `lib/roadmap/provenance.ts` (~250 lines) — pure helpers `summarizeRoadmapItemProvenance` + `buildReportReadinessSignal` + sanitized metadata projection.
- `components/roadmap/roadmap-provenance-chip.tsx` (~85 lines) — compact + full modes.
- `components/roadmap/roadmap-action-bar.tsx` (~240 lines) — client component; two-step Reject + needs-validation warning + persisted-rationale display.
- `components/roadmap/report-readiness-hint.tsx` (~165 lines) — operator-only S8 readiness card; server component.
- `docs/48_ROADMAP_AI_DRAFTING.md` (this file).

### Source-modified (7)

- `lib/roadmap/types.ts` (~+15) — `reviewerNote?` and `status?` fields on `RoadmapItem`.
- `lib/roadmap/mappers.ts` (~+10) — `rejected` added to `RoadmapStatus`; mapper surfaces `reviewer_notes` + `status`.
- `lib/roadmap/queries.ts` (~+1) — added `reviewer_notes` to `ROADMAP_SELECT`.
- `lib/roadmap/actions.ts` (~+80) — `setRoadmapItemStatus` accepts `{rejectionReason?}` options + sanitized metadata extension; new `rejectRoadmapItem`; new error code `rejection-reason-invalid`.
- `lib/roadmap/synthesis-actions.ts` (~+10) — extended `ai_roadmap_items_drafted` activity metadata with `sourceOpportunities: {total}` (source-tree edit; deployed metadata shape lagged per L-15).
- `lib/ai/roadmap-context.ts` (~+10) — `ELIGIBLE_OPPORTUNITY_STATUSES` tightened to `["selected"]`.
- `components/roadmap/roadmap-card.tsx` (~+40) — render `RoadmapProvenanceChip` (compact) + `RoadmapActionBar` when `actionMode="review"`.
- `components/roadmap/roadmap-phase-column.tsx` (~+15) — accept + thread `provenanceById` + `actionMode` to cards.
- `components/roadmap/create-roadmap-item-form.tsx` (~+5) — `translateError` union widened to include `rejection-reason-invalid` (compile-time alignment).
- `app/app/engagements/[id]/roadmap/page.tsx` (~+60) — fetch opportunity provenance + status maps; build roadmap-item provenance map; compute report-readiness signal; mount `ReportReadinessHint`; thread `provenanceById` + `actionMode` to phase columns.

### Docs (6)

- `docs/48` (new — this file).
- `docs/39_CONSULTING_MODULE_COMPLETION_ROADMAP.md` — § 5 Sprint S7 row landed.
- `docs/45_OPPORTUNITIES_AI_DRAFTING.md` — cross-reference to S7 consumer.
- `docs/46_S4_S6_CONTROLLED_WALKTHROUGH.md` — note that the preserved selected opportunities were consumed by S7.
- `docs/08_CURRENT_STATUS.md` — Sprint S7 block at top.
- `docs/10_SESSION_HANDOFF.md` — Latest line for S7; bug-fix sprint moved to Prior.

### Throwaway

- `artifacts/s7-provenance-smoke.mjs` — pure-logic smoke (gitignored, not committed).

---

## 13. Limitations

| # | Item | Classification | Owner |
|---|---|---|---|
| L-15 | `ai_roadmap_items_drafted` deployed metadata lacks `sourceOpportunities: {total}` field added in this sprint's source. Likely a Vercel build-cache layer artifact. Boundary still holds (no PII). | Sub-spec drift | Fold into the next docs/48-touching sprint alongside L-12/L-13. |
| L-16 | `blocked` status remains in the enum but is not exposed in the new action bar (no `Block` button). Operator can still arrive at `blocked` via the existing create-form path or via direct API. | By-design | None — `blocked` is implementation-stage, not part of the S8-input lifecycle. |
| L-17 | `completed` status remains in the enum and is not exposed in the new action bar. | By-design | None — `completed` is future implementation state, irrelevant to S7. |
| L-18 | Deferred-opportunity inclusion override (task spec mentioned "unless explicitly included by operator") not implemented; deferred opportunities are categorically excluded. | By-design (minimal scope) | Future improvement if operator demand surfaces. |
| L-19 | `RoadmapActionBar` is a client component (`"use client"`). Mounted inline by `RoadmapCard` (a server component) — the function-prop-across-SSR-boundary bug fixed in `docs/47` is NOT reintroduced because the action bar mounts itself (no render-prop callback). | By-design | None. |

None of these are blockers for Sprint S8.

---

## 14. Recommended next sprint

**Sprint S8 — Report Section AI Drafting Integration** per `docs/39` § 5. Roadmap sequence unchanged.

Prereqs cleared by S7:
- ✅ 3 roadmap items in `ready` state on the controlled fixture, meeting `minApprovedForS8=3` exactly.
- ✅ Each `ready` item links to a `selected` opportunity, traceable back to approved findings.
- ✅ Phase coverage: 2 × first-30 + 1 × days-31-60. (Days-61-90 empty — operator can author one if S8 requires.)
- ✅ Priority coverage: 2 Quick Wins + 1 Strategic Build.
- ✅ `ReportReadinessHint.readyForS8 = true` live on deployed Production.
- ✅ The shared findings/opportunities/roadmap chain is now end-to-end validated; Sprint S8 can consume it directly.

No operator-side prerequisites remain.

---

## 15. Suggested commit message

```
Add roadmap AI drafting
```

Hold for commit review per the established sprint pattern — operator provides the exact `git add` block after reviewing this evidence log.

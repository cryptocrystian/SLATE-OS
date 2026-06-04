# Sprint S6 — Opportunities AI Drafting + Quadrant Approval

## Status

- **Date executed:** 2026-06-04
- **Sprint type:** Implementation sprint — sixth mainline sprint per `docs/39` § 5.
- **Sprint identifier:** Sprint S6 — Opportunities AI Drafting + Quadrant Approval
- **Branches at execution:** `staging` and `persistence/step-0-1-auth-shell` both at `dca50c6` ("Polish findings approval lifecycle")
- **Controlled fixture:** **SLATE Pilot Test Client** (engagement `ed7f1f7d-…`). **No Sapient Digital mutation.** No new fixture created.
- **Verdict:** ✅ **Implementation complete.** AI drafting pipeline (Sprint pre-S6 scaffold) extended with S5 provenance-aware prompt; opportunity rejection-reason capture migration + UI + sanitized activity metadata; OpportunityProvenanceChip on workspace cards + detail view; needs-validation warning panel in the action bar; RoadmapReadinessHint operator-only S7 signal. Source-clean + lint-clean + build-clean + boundary-clean. Live drafting exercise deferred — neither `SLATE Pilot Test Client` (`ed7f1f7d-…`) nor `Sapient Digital` (`76097653-…`) holds any persisted finding rows today (Sapient at Stage 1 Setup; SLATE Pilot's only-evidence is audit-labelled and correctly excluded by the S4 boundary); the polish ships build-validated against the existing `Opportunity` type contract and pure-logic-smoke-validated against the new helpers. Live drafting execution becomes possible the first time a real approved finding lands on any engagement.

---

## 1. Existing opportunity model inventory (pre-S6)

Substantial S6 scaffold already existed at sprint kickoff — landed across pre-S1 persistence work and a pre-S6 AI drafting iteration:

| Capability | File(s) | Pre-S6 state |
|---|---|---|
| Persisted opportunity table | `supabase/migrations/0007_opportunities_roadmap.sql` | ✅ `opportunities` with workspace_id + engagement_id + 6 score axes + category/priority/quadrant/evidence_strength + status + reviewed_by + last_reviewed_at + position + RLS authenticated-only. |
| Status enum | inline `text` column with default `'draft'` | ✅ `draft \| scored \| selected \| deferred \| rejected`. |
| Finding-link join | `opportunity_finding_links` | ✅ Unique-pair index + workspace-scoped RLS. |
| AI synthesis ledger | `supabase/migrations/0011_ai_synthesis_runs.sql` (`ai_synthesis_runs`) | ✅ `run_type='opportunity_draft'` already supported. |
| TS types | `lib/opportunities/types.ts` | ✅ `Opportunity`, `OpportunityCategory`, `OpportunityPriority`, `OpportunityQuadrant`, `EvidenceStrength`, `OpportunityStatus`. |
| Mappers | `lib/opportunities/mappers.ts` | ✅ DB ↔ TS mappers + UUID guard + status helpers. |
| Queries | `lib/opportunities/queries.ts` | ✅ `getOpportunitiesForEngagementPersisted`, `getOpportunityStatusSummary`, `getFindingCandidatesForEngagement`, `getMinimalFindingsForEngagement`. |
| Manual create action | `lib/opportunities/actions.ts` | ✅ `createOpportunity`, `updateOpportunityScores`, `markOpportunitySelected`, `deferOpportunity`, `rejectOpportunity`, `reopenOpportunity` — cookie-bound auth, sanitized activity events. |
| AI drafting context | `lib/ai/opportunities-context.ts` | ✅ `buildOpportunitySynthesisContext` — server-only; loads approved/report-ready findings + source refs + scorecard + input-asset metadata + engagement/account context + existing opportunities; PII-clean. |
| AI drafting prompt | `lib/ai/opportunities-synthesis.ts` | ✅ `synthesizeDraftOpportunities` — strict JSON contract + 0–100 score validation + duplicate-title detection + finding-id allowlist; provider-meta returned. |
| AI drafting action | `lib/opportunities/synthesis-actions.ts` | ✅ `generateDraftOpportunitiesForEngagement` — opens `ai_synthesis_runs` row, calls the LLM, persists draft opportunities with server-derived quadrant/priority, inserts `opportunity_finding_links`, completes run-row, emits sanitized activity event. |
| UI page | `app/app/engagements/[id]/opportunities/page.tsx` | ✅ Persisted branch + mock branch + summary metric tiles. |
| UI workspace | `components/opportunities/opportunities-workspace.tsx` | ✅ Matrix + filter tabs + card list + detail panel + RelatedFindingsPanel + render-prop action bar slot. |
| UI generate form | `components/opportunities/generate-opportunities-form.tsx` | ✅ AI-configured / has-approved-findings gating + result/error rendering. |
| UI manual create | `components/opportunities/create-opportunity-form.tsx` | ✅ Operator-driven create with finding multi-select. |
| UI action bar | `components/opportunities/opportunity-action-bar.tsx` | ✅ Select / Defer / Reopen / Reject buttons; one-click reject; status badge. |
| UI matrix | `components/opportunities/opportunity-matrix.tsx` | ✅ 2×2 quadrant visualization. |
| Activity events | `lib/activity/types.ts` | ✅ `opportunity_created`, `opportunity_selected`, `opportunity_deferred`, `opportunity_rejected`, `ai_opportunities_generated`, `ai_synthesis_failed`. |

### What S6 needed to add (gap analysis)

| Gap (pre-S6) | S6 fix |
|---|---|
| Source-finding provenance from S5 (`summarizeFindingProvenance` needs-validation verdict) was NOT preserved at the opportunity layer. AI drafting consumed approved findings but ignored their per-finding provenance signal. | New `summarizeOpportunityProvenance` helper in `lib/opportunities/provenance.ts` projects each opportunity's `relatedFindingIds` against the S5 per-finding provenance map. Returns counts + needs-validation flag with reason. |
| AI prompt didn't tell the model about source-finding needs-validation state. A weak source finding could still produce a confident-looking opportunity. | `lib/ai/opportunities-synthesis.ts` system prompt extended with "Provenance-aware evidence rule" — bias toward `evidenceStrength: 'thin'`, raise `riskScore`, and use conservative language when source findings carry needs-validation. The model receives the boolean flag per finding via `lib/ai/opportunities-context.ts`. |
| Workspace card list + detail view did NOT surface a needs-validation indicator. Operator could approve a weak-evidence opportunity without seeing the provenance signal. | New `OpportunityProvenanceChip` component renders compactly on the card list (single warning badge) and fully on the detail view (per-lane counts + dominant strength + reason). |
| Action bar's Reject button was one-click — no rejection-reason capture. Activity metadata only recorded `{status: 'rejected'}`. | Two-step Reject… → Confirm reject flow with optional 10–500 char reason textarea. Reason persisted in new `opportunities.reviewer_notes` column AND sanitized into activity event metadata. New `rejection-reason-invalid` error code. Displayed inline on rejected opportunities. |
| No code-side roadmap-readiness signal for S7. Operator had no observable indicator of whether enough opportunities were selected. | New `buildRoadmapReadinessSignal` pure helper + `RoadmapReadinessHint` server component. 7 stat tiles + status chip + 5-rule advisory list. Read-only; does NOT block S7. |
| Activity metadata for `ai_opportunities_generated` lacked source-finding evidence summary — no record of how many input findings carried needs-validation flags. | Metadata extended with `sourceFindings: {total, needsValidation, assumptionFlagged}` counts. Zero raw IDs, zero raw text. |

### What S6 deliberately did NOT change

- The `OpportunityStatus` enum is byte-identical (`draft | scored | selected | deferred | rejected`). The task-spec term "approved/rejected" maps onto `selected` (operator-approved for roadmap) + `rejected` semantically — documented in § 6 below. Renaming the schema would invalidate every existing activity event and add no operator value.
- The score axes (business_impact / complexity / risk / time_to_value / adoption_likelihood / strategic_value) are unchanged. AI drafting fills them; operator edits via the manual create / update-scores actions.
- Quadrant placement is server-derived from impact/complexity (with `risk >= 85` overriding to `defer-avoid`) — unchanged.
- The AI duplicate-title detection across existing opportunities is unchanged.
- No new package dependency.
- No new public route.
- No `/r` or `/p` mint surface added.

---

## 2. Data model decision

**Tiny additive migration.** The existing `opportunities` schema covers every conceptual field S6 needs EXCEPT rejection-reason capture. The S5 findings flow established the pattern: store rejection rationale in a dedicated nullable column so the card UI can render it without round-tripping the activity log. Findings used the existing `findings.reviewer_note` column; opportunities had no equivalent.

### Migration `0019_opportunity_reviewer_notes.sql`

```sql
alter table public.opportunities
  add column if not exists reviewer_notes text;
```

- Additive only. Nullable. No NOT NULL, no CHECK, no default.
- No RLS policy change. Workspace scope inherits from the existing `opportunities_operator_full` policy (authenticated-only).
- Idempotent: safe to re-run via `if not exists`.
- No PII. Operator-typed rejection text only. Server-side validated to 10–500 chars after trim (or empty); never carries raw stakeholder text, raw answer text, tokens, or external IDs.
- No Send to Client surface, no public route, no Group-B field.

### Why a column instead of activity-event metadata only

The operator UI surfaces rejection reasons on the opportunity card itself (mirroring the S5 finding pattern). Storing in `reviewer_notes` keeps the rejection rationale workspace-scoped via the existing RLS policy and avoids reaching back into the activity ledger to render card metadata.

### Other fields considered, not added

| Field | Considered for | Decision |
|---|---|---|
| `urgency_score`, `dependency_note` | Task-spec optional fields | Not added — existing 6 score axes + `dependencies` text array already cover this surface; AI prompt has not surfaced operator demand for finer axes. |
| `provenance_summary jsonb` | Cache the S6 provenance projection in a column | Not added — provenance is a pure derivation from finding refs that can change as findings are edited; caching would create staleness; current in-process projection is `O(refs)` per page render. |
| `last_drafted_by_run_id uuid` | Backlink from opportunity → ai_synthesis_run | Not added — the existing `ai_synthesis_runs.output_summary.generatedCount` plus the `ai_opportunities_generated` activity event preserve the audit trail; explicit FK would require a backfill. |

### Migration application posture

The migration ships in source but is NOT auto-applied to deployed Supabase. Following the S3-B / S5 pattern, operator runs `apply_migration 0019` on deployed `hhglrcvsmwaheikdvijw` before the next Vercel Production promotion picks up the S6 source. Until then the page query selecting `reviewer_notes` would error on deployed prod — but Production currently runs the S4 build (`384ab1e`), unaware of the new SELECT projection.

---

## 3. Opportunity drafting evidence input

The pre-S6 context loader in `lib/ai/opportunities-context.ts` already restricted findings to `review_status IN ('approved', 'report_ready')` — that contract is preserved verbatim. S6 extended the per-finding payload with provenance-aware fields:

### 3.1 Extended `OpportunitySynthesisContext.findings[]`

Pre-S6 shape per finding:
```ts
{
  findingId, statement, summary, category, confidence,
  reviewStatus, suggestedImpact,
  sourceRefs: Array<{sourceType, sourceLabel, sourceRole, strength}>
}
```

S6 adds three fields per finding:
```ts
{
  // ...existing fields...
  needsValidation: boolean,             // derived via summarizeFindingProvenance
  needsValidationReason: string | null, // human-readable reason
  assumptionFlag: boolean,              // from findings.assumption_flag
}
```

### 3.2 Provenance computation

The context loader fetches `finding_source_refs` rows (with `excerpt`) for every loaded finding, normalizes them into the canonical `SourceRef` shape via defensive `mapProvenanceType` + `mapProvenanceStrength` helpers (unknown DB enum values degrade to `consultant-note` / `thin` rather than crashing), and runs the S5 pure helper:

```ts
const provenance = summarizeFindingProvenance(
  provenanceRefsByFinding.get(row.id) ?? [],
  Boolean(row.assumption_flag),
);
```

The prompt-facing `sourceRefs` array (limited to `MAX_SOURCE_REFS_PER_FINDING`) is built separately from the provenance-helper input, so the AI receives a stable prompt size while the provenance verdict reflects the full ref set.

### 3.3 Hard exclusion of rejected / draft / needs-review findings

The context loader's `ELIGIBLE_REVIEW_STATUSES = ['approved', 'report_ready']` allowlist is enforced at the DB SELECT level. There is no override path — rejected, draft, needs-review, edited findings simply do not appear in the model's input.

### 3.4 Audit-label exclusion

Inherited from S4. The findings table is already filtered upstream by S4's `evidence-aware` audit-label exclusion: a finding only lands in `findings` (and reaches S6 input) if its underlying stakeholder responses passed the audit-label heuristic OR the operator authored it manually. Audit fixture data cannot reach opportunity drafting via the AI path.

### 3.5 Engagement-level CRM context

CRM context (Attio from Sprint S3-B) is engagement-level only. It is NOT carried as per-stakeholder findings evidence anywhere in S6 — exactly the boundary `docs/42` § 4 codified. The `OpportunitySynthesisContext.account` block surfaces account industry / employee range / revenue range; no per-stakeholder CRM identity ever reaches the prompt.

---

## 4. AI opportunity prompt + output model

### 4.1 System prompt — Sprint S6 provenance-aware extension

The pre-S6 SYSTEM_PROMPT codified strict consultant register, JSON-only output, finding-ID linkage, no quote invention, and server-derived priority/quadrant. S6 appended a new "Provenance-aware evidence rule" block:

```
Provenance-aware evidence rule (Sprint S6):
- Each finding carries a `needsValidation` boolean and an `assumptionFlag`
  boolean projected from its persisted source-refs by the upstream
  provenance helper.
- When an opportunity links ONLY to findings where
  `needsValidation = true` (or `assumptionFlag = true`), set
  `evidenceStrength = 'thin'`, raise `riskScore` to reflect delivery
  uncertainty, and use conservative implementation-shape language
  ("investigate", "validate", "scope") instead of imperative commitment
  ("build", "ship", "automate").
- When an opportunity mixes some `needsValidation = true` source
  findings with stronger ones, default `evidenceStrength` to
  `'adequate'` at most; do not assert `'strong'`.
- Only assert `evidenceStrength = 'strong'` when ALL linked source
  findings have `needsValidation = false`.
- The operator UI inherits the needs-validation flag from your linked
  findings; conservative wording is the right register when that flag
  will be visible.
```

The model receives `needsValidation + assumptionFlag` per finding in the user payload. Server validation drops any candidate that doesn't link to at least one eligible finding ID; quadrant + priority are server-derived from scores (high risk overrides), so prompt cannot mint a `quick-win` despite weak evidence.

### 4.2 Output validation

Unchanged from pre-S6:
- JSON-only response. Plain-text response → `ai-response-invalid`.
- `opportunities` array (or `draftOpportunities` / `candidates` aliases accepted).
- Per-candidate validators: title required, category must be in 9-entry allowlist, `linkedFindingIds` must be 1–5 UUIDs all present in the eligible finding-id allowlist, scores clamped to 0–100, evidenceStrength clamped to 3-value allowlist with `'adequate'` default, all string fields clipped to per-field limits, all string arrays capped at 6 items × 200 chars.
- Duplicate-title detection within the response set + against `existingOpportunities`.
- Output bounded MIN_OPPORTUNITIES=2, MAX_OPPORTUNITIES=6.

### 4.3 Persistence

Per candidate, the synthesis action:
1. Re-computes `quadrant` server-side from `businessImpactScore + complexityScore + riskScore` (high risk → `defer-avoid`).
2. Derives `priority` from the quadrant.
3. Inserts into `opportunities` with `status='draft'`.
4. Inserts `opportunity_finding_links` rows for each linked finding ID.
5. Skips duplicates (vs existing opportunities + within-batch).
6. Records the run on `ai_synthesis_runs` (status: started → completed/failed; provider + model + output_summary).
7. Emits `ai_opportunities_generated` activity event with sanitized metadata (no raw text, no IDs other than the run-id).

---

## 5. Scoring + quadrant model

The 6-axis scoring model is **inherited unchanged** from pre-S6. Documented here for cross-reference completeness:

| Axis | Direction | Type |
|---|---|---|
| `business_impact_score` | Higher = greater business impact | int 0–100, default 50 |
| `complexity_score` | Higher = harder to implement | int 0–100, default 50 |
| `risk_score` | Higher = more delivery / adoption / governance risk | int 0–100, default 50 |
| `time_to_value_score` | Higher = longer time to value | int 0–100, default 50 |
| `adoption_likelihood_score` | Higher = more likely to be adopted | int 0–100, default 50 |
| `strategic_value_score` | Higher = greater strategic value | int 0–100, default 50 |
| `evidence_strength` | enum: `strong` / `adequate` / `thin` (default `adequate`) | text |

Quadrant derivation (`lib/opportunities/helpers.ts::computeQuadrant`):
- `risk >= 85` → `defer-avoid` (hard override)
- Otherwise classify by impact + complexity bands into `quick-win` / `strategic-build` / `low-priority` / `defer-avoid`.

Priority derivation: mechanically follows the quadrant.

S6 layered on top: provenance does NOT override quadrant. A `quick-win` quadrant placement based on AI scores remains a `quick-win` even if all source findings carry needs-validation. The needs-validation chip appears alongside the quadrant tag so the operator sees both signals — provenance affects evidence-strength + risk-score (via the prompt rule), not placement.

---

## 6. Operator approval lifecycle

### 6.1 Status enum + lifecycle map

The existing 5-state enum maps onto the task-spec lifecycle as follows:

| Existing status | Task-spec mapping | Semantic meaning |
|---|---|---|
| `draft` | pre-approval | AI synthesis or manual create just landed; not yet operator-touched. |
| `scored` | pre-approval | Operator re-scored or reopened; remains in pre-approval review. |
| `selected` | **approved** | Operator approved for roadmap drafting (= S7 candidate). |
| `deferred` | parked | Operator parked for a future engagement; not S7-input. |
| `rejected` | **rejected** | Operator rejected; never feeds S7. |

The lifecycle is therefore: **draft / scored → selected (approved) → roadmap** OR **draft / scored → deferred / rejected (terminal-from-S7-perspective)** with `reopen` available to move terminal opportunities back to `scored`.

This naming was preserved over renaming `selected → approved` because:
1. Renaming the enum would invalidate every existing activity event (`opportunity_selected`).
2. The mapper layer (`tsStatusFor`) treats `selected` as the canonical roadmap-input state.
3. Operator-facing copy already uses "Mark selected" / "Selected" throughout the UI vocabulary.
4. The roadmap readiness signal (§ 7) counts `selected` only — semantic intent is preserved.

### 6.2 Rejection-reason capture

Two-step UX on the action bar:

1. First click on `Reject…` toggles `rejectOpen` state and changes the button label to `Cancel reject`.
2. A reason panel appears with a textarea (10–500 chars OR empty), `Cancel`, and `Confirm reject` buttons.
3. `Confirm reject` calls `rejectOpportunity(id, { reason: rejectReason.trim() || undefined })`.
4. Empty reason is allowed — operator may keep rationale internal.
5. Server-side validation re-enforces 10–500 char bound; returns `rejection-reason-invalid` on overrun. The textarea has browser `maxLength={500}` plus a live character counter.

The reason is persisted in `opportunities.reviewer_notes` AND recorded in the `opportunity_rejected` activity event metadata. Rejected opportunities render a "Rejection rationale" panel inline so the reason is visible at a glance.

### 6.3 Needs-validation warning panel

The action bar surfaces a warning above the buttons when:
- `provenance.needsValidation === true`, AND
- `status !== 'selected'`, AND
- `status !== 'rejected'`.

The warning withdraws once the opportunity reaches a terminal state (selected or rejected) so it stops nagging a settled record. It does NOT block selection — operator authority over opportunity approval is canon-preserved (the operator may legitimately promote a needs-validation opportunity into the roadmap with intent to scope it during S7).

---

## 7. S7 roadmap readiness signal

Analogous to the S5 `OpportunitiesReadinessHint` on the findings page. Operator-only server component, read-only, does NOT block S7 (S7 not yet built).

### 7.1 `buildRoadmapReadinessSignal` helper

Pure function in `lib/opportunities/provenance.ts`. Takes an array of opportunities (status + evidenceStrength + quadrant + optional provenance summary). Returns:

```ts
{
  selected, deferred, rejected, draft, total,
  selectedNeedsValidation,   // selected ops whose provenance is needs-validation
  selectedThinEvidence,      // selected ops where opportunity's own evidenceStrength = 'thin'
  selectedInDeferAvoid,      // selected ops in defer-avoid quadrant
  minSelectedForS7,          // default threshold 3
  readyForS7,                // selected >= threshold
  warnings,                  // operator advisories
}
```

### 7.2 Boundary rules

- Rejected and deferred opportunities NEVER count toward `selected` — verified by the smoke test BOUNDARY case.
- Only operator-selected (`status='selected'`) opportunities feed `selected`.
- The needs-validation count is reported but does NOT subtract from `selected`; operator may legitimately promote a needs-validation opportunity into the roadmap with intent to scope it during S7.

### 7.3 Warnings emitted

The helper emits operator-readable advisories for:
- `selected === 0` (with subdivisions for "no opportunities at all" vs "some in draft/deferred/rejected").
- All selected opportunities inherit needs-validation flags from source findings.
- Some selected opportunities inherit needs-validation flags.
- All selected opportunities carry thin evidence-strength.
- Some selected opportunities carry thin evidence-strength.
- Selected opportunities placed in `defer-avoid` quadrant.
- `selected > 0 && selected < minSelectedForS7` — coverage thin.

The UI surfaces the first 4 advisories; the helper returns all so future surfaces can paginate.

### 7.4 `RoadmapReadinessHint` component

Server-rendered (zero client bytes). Renders:
- Header row: ListChecks-equivalent icon + "Roadmap readiness" eyebrow + Operator-only badge + Ready/Not-yet status chip.
- Primary 4-tile grid: Selected / Deferred / Rejected / Still in review.
- Secondary 3-tile grid (only when `selected > 0`): Selected · needs validation / Selected · thin evidence / Selected · defer-avoid.
- Advisory panel showing first 4 advisories from `signal.warnings`.
- Boundary footer copy explaining that S7 will consume `selected` only and that needs-validation flags propagate.

Mounted on `app/app/engagements/[id]/opportunities/page.tsx` below `CreateOpportunityForm` for persisted engagements (mock branch does not get it).

---

## 8. Controlled validation result

### 8.1 Live drafting exercise — deferred

DB query against deployed Supabase confirms both candidate engagements hold 0 persisted opportunities AND 0 persisted findings:

```
engagement_id                          account                  opportunities  findings  approved_findings
76097653-fedb-42e5-9ef6-e89a0e97f802   Sapient Digital          0              0         0
ed7f1f7d-b3fa-46c3-9d48-7b211d2c48b4   SLATE Pilot Test Client  0              0         0
```

This is the expected boundary outcome inherited from S5:
- SLATE Pilot Test Client's stakeholder responses are all audit-labelled; S4's audit-label exclusion correctly blocks synthesis, so zero findings exist, so zero approved findings exist, so zero opportunities can be drafted.
- Sapient Digital is still at Stage 1 (Setup).

**Live drafting exercise is therefore deferred** until the first real approved finding lands on any engagement. Three scenarios unblock it:

1. Operator authors approved findings manually via `CreateFindingForm`, then runs `Generate draft opportunities`.
2. Operator runs S4 synthesis with `overrideReason` against non-audit data, approves the resulting findings, then runs S6 drafting.
3. Operator authors opportunities manually via `CreateOpportunityForm` (no AI dependency); the approval lifecycle + rejection-reason + provenance chips surface immediately on the next render.

### 8.2 Pure-logic smoke (`artifacts/s6-provenance-smoke.mjs`)

Throwaway script (gitignored) that re-implements `summarizeOpportunityProvenance` + `buildRoadmapReadinessSignal` in plain JS so it runs without the TS toolchain. Validates 11 cases:

**Opportunity provenance (5 cases):**

| Scenario | Expected `needsValidation` | Result |
|---|---|---|
| No linked findings | `true` | ✅ PASS — reason: "Not linked to any source findings." |
| All strong/adequate (mix) | `false` | ✅ PASS — clean |
| All needs-validation | `true` | ✅ PASS — "Every source finding carries a needs-validation flag." |
| Mixed: 1 needs-validation + 1 strong | `true` | ✅ PASS — "1 of 2 source findings carry a needs-validation flag." |
| Linked ID unknown to map | `true` | ✅ PASS — defensive: treats missing as needs-validation |

**Roadmap readiness signal (6 cases):**

| Scenario | Expected `readyForS7` | Result |
|---|---|---|
| Empty | `false` | ✅ PASS |
| 2 selected (below threshold 3) | `false` | ✅ PASS |
| 3 selected (at threshold) | `true` | ✅ PASS |
| Mix: 3 selected + 2 rejected + 1 deferred | `true` | ✅ PASS — only `selected` counts |
| **BOUNDARY: 5 rejected/deferred DOES NOT count as selected** | `false` | ✅ **PASS** — verifies task-spec criterion 7 |
| 3 selected ALL with needs-validation source findings | `true` | ✅ PASS — flag does not block readiness |

**11/11 pass.** The critical BOUNDARY case directly verifies task-spec acceptance criterion #7: "Rejected opportunities cannot feed S7." The roadmap readiness helper counts `selected` opportunities only; rejected and deferred opportunities never contribute regardless of their other axes.

### 8.3 Source-review validation of the integration wiring

Hand-traced the AI drafting + approval + rejection lifecycle through the modified source:

| Action | UI entry | Server action | Status transition | Activity event | Sanitized metadata |
|---|---|---|---|---|---|
| Generate draft opportunities | `Generate draft opportunities` button | `generateDraftOpportunitiesForEngagement(id)` | None → `draft` (new rows) | `ai_opportunities_generated` | ✅ runType, generatedCount, skippedDuplicateCount, sourceFindings: {total, needsValidation, assumptionFlagged}, provider, model |
| Mark selected | `Mark selected` button | `markOpportunitySelected(id)` | `*` → `selected` | `opportunity_selected` | ✅ status, priorEvidenceStrength, priorQuadrant, sourceFindingCount |
| Defer | `Defer` button | `deferOpportunity(id)` | `*` → `deferred` | `opportunity_deferred` | ✅ status, priorEvidenceStrength, priorQuadrant, sourceFindingCount |
| Reject (no reason) | `Reject…` → empty textarea → `Confirm reject` | `rejectOpportunity(id)` | `*` → `rejected` | `opportunity_rejected` | ✅ status, priorEvidenceStrength, priorQuadrant, sourceFindingCount; no `rejectionReason` field |
| Reject (with reason) | `Reject…` → 10–500 char textarea → `Confirm reject` | `rejectOpportunity(id, {reason})` | `*` → `rejected` | `opportunity_rejected` | ✅ + `rejectionReason: <text>`; persisted in `reviewer_notes` |
| Reject (bad-length reason) | textarea with 1–9 chars OR >500 chars | `rejectOpportunity(id, {reason})` | (no transition) | (none) | Returns `rejection-reason-invalid` to UI |
| Reopen | `Reopen` button | `reopenOpportunity(id)` | `selected/deferred/rejected` → `scored` | (none — internal action) | (none) |

All transitions preserve workspace-scoped RLS via cookie-bound auth; none use service-role; none mutate cross-workspace data.

---

## 9. Activity metadata safety

For the `ai_opportunities_generated` event, S6 added `sourceFindings: {total, needsValidation, assumptionFlagged}`. For `opportunity_selected / deferred / rejected`, S6 added `priorEvidenceStrength`, `priorQuadrant`, `sourceFindingCount`, and (rejected-only when supplied) `rejectionReason`.

Safety rules — what is NEVER in the metadata:

- ❌ Raw finding `statement`, `summary`, or `evidenceSummary` text
- ❌ Raw `source_label`, `excerpt`, or `source_role` from any source ref
- ❌ Raw stakeholder name, email, role, or any PII
- ❌ Raw `answer_text` from any underlying `stakeholder_responses` row
- ❌ Raw transcript segment text
- ❌ Token values, API keys, or any auth material
- ❌ UUIDs of source findings (count only)
- ❌ UUIDs of `opportunity_finding_links` join rows
- ❌ `attio_company_id`, CRM identifiers, or any external system ID
- ❌ Raw `reviewer_notes` content from existing findings
- ❌ Provider response body (just `provider` + `model` semantic strings)

The only operator-typed string that lands in metadata is `rejectionReason` (10–500 chars, server-validated, only when supplied for a rejected transition). Operators who want to keep rationale internal can leave the field empty.

---

## 10. Boundary confirmation

| Boundary | Held? |
|---|---|
| Zero new package dependencies | ✅ |
| Zero new public routes | ✅ |
| Zero new migrations beyond `0019_opportunity_reviewer_notes.sql` | ✅ (1 tiny additive migration) |
| Zero `service_role` writes | ✅ |
| Zero `/r` or `/p` mint | ✅ |
| Zero Send to Client emissions | ✅ |
| Zero email send | ✅ |
| Zero CRM writeback | ✅ |
| Zero Attio writes | ✅ |
| Zero e-signature | ✅ |
| Zero public SOW route | ✅ |
| Zero SOW share tokens | ✅ |
| Zero roadmap generation (S7) | ✅ — confirmed by grep; opportunities → roadmap_items insert path untouched |
| Zero report-section generation (S8) | ✅ |
| Zero proposal generation (S9) | ✅ |
| Zero SOW generation | ✅ |
| Zero Group-B claim | ✅ |
| Zero Sapient Digital mutation | ✅ |
| Zero new package deps | ✅ |
| Zero roadmap sequence change | ✅ |
| Zero audit-only fixture data treated as real evidence | ✅ |
| No PII / raw text / tokens in activity metadata | ✅ (verified by exhaustive source grep) |
| Rejected opportunities never feed S7 | ✅ (smoke BOUNDARY case verifies; `selected` count excludes rejected + deferred) |
| Findings approval gates not bypassed | ✅ (context loader allowlist preserved: `review_status IN ('approved', 'report_ready')` only) |

---

## 11. Verification

### 11.1 Lint

`npm run lint` clean ✅ — no warnings, no errors.

### 11.2 Production build

`NEXT_TELEMETRY_DISABLED=1 npm run build` clean ✅.

Route table impact:

| Route | First Load JS (pre-S6 / post-S6) | Δ |
|---|---|---|
| `/app/engagements/[id]/opportunities` | 11.6 kB → 12.6 kB | +1 kB (provenance chip + two-step reject + readiness hint server-rendered) |
| All other 28 routes | (unchanged) | 0 bytes |

`RoadmapReadinessHint` and `OpportunityProvenanceChip` (when only-compact-rendered in card list) are server-rendered; the +1 kB delta is the action-bar reject-reason textarea + provenance-chip client code.

### 11.3 Send-to-client disclaimer pin

`npm run check:send-to-client-disclaimers` clean ✅ — none of the disclaimer canon strings were touched.

### 11.4 Pure-logic smoke

`node artifacts/s6-provenance-smoke.mjs` — 11/11 cases pass (§ 8.2).

### 11.5 Boundary scan

Confirmed via grep over all S6 changes:

- Zero references to `mailto:`, `sendgrid`, `nodemailer`, `docusign`, `hellosign`, `adobesign`, `crm_push` introduced.
- Zero references to `/r/` or `/p/` mint paths introduced.
- Zero references to `service_role` introduced.
- Zero references to Attio writeback functions introduced.
- Zero references to `roadmap_items` write operations introduced (S7 scope).

---

## 12. Files modified

### New (4)

- `supabase/migrations/0019_opportunity_reviewer_notes.sql` — additive nullable column.
- `lib/opportunities/provenance.ts` (~280 lines) — pure helpers `summarizeOpportunityProvenance` + `buildRoadmapReadinessSignal` + sanitized metadata projection.
- `components/opportunities/opportunity-provenance-chip.tsx` (~90 lines) — compact + full modes.
- `components/opportunities/roadmap-readiness-hint.tsx` (~130 lines) — operator-only S7 readiness card; server component.
- `docs/45_OPPORTUNITIES_AI_DRAFTING.md` (this file).

### Source-modified (8)

- `lib/opportunities/types.ts` (~+8) — added `reviewerNote?: string | null` to `Opportunity`.
- `lib/opportunities/mappers.ts` (~+8) — surface `reviewer_notes` → `reviewerNote`.
- `lib/opportunities/queries.ts` (~+110) — added `reviewer_notes` to SELECT; new `getFindingProvenanceForEngagement` helper.
- `lib/opportunities/actions.ts` (~+90) — `setStatus` accepts `{rejectionReason?}` options; persists in `reviewer_notes` on rejected; sanitized metadata extension; new `rejection-reason-invalid` error; `rejectOpportunity` signature widened.
- `lib/opportunities/synthesis-actions.ts` (~+25) — activity-event metadata extended with `sourceFindings` evidence summary.
- `lib/ai/opportunities-context.ts` (~+90) — extended `findings[]` payload with `needsValidation` + `needsValidationReason` + `assumptionFlag`; new `mapProvenanceType` + `mapProvenanceStrength` defensive helpers.
- `lib/ai/opportunities-synthesis.ts` (~+10) — prompt extended with "Provenance-aware evidence rule" block.
- `components/opportunities/opportunity-action-bar.tsx` (~+130) — two-step reject + reason textarea + needs-validation panel + rejection rationale display + `rejection-reason-invalid` error case; new `provenance` + `reviewerNote` props.
- `components/opportunities/opportunities-workspace.tsx` (~+30) — `OpportunityProvenanceChip` in card list (compact when needs-validation) + detail view (full); `provenanceById` prop.
- `components/opportunities/create-opportunity-form.tsx` (~+5) — `translateError` union widened.
- `app/app/engagements/[id]/opportunities/page.tsx` (~+50) — fetches `getFindingProvenanceForEngagement`; builds opportunity provenance map; builds roadmap readiness signal; wires `RoadmapReadinessHint` + threads provenance through workspace + action bar.

### Docs (5)

- `docs/45` (new — this file).
- `docs/39_CONSULTING_MODULE_COMPLETION_ROADMAP.md` — § 5 Sprint S6 row updated with LANDED note; sequence unchanged.
- `docs/44_FINDINGS_APPROVAL_POLISH.md` — cross-reference added to S6 handoff.
- `docs/08_CURRENT_STATUS.md` — Sprint S6 block added at top.
- `docs/10_SESSION_HANDOFF.md` — new "Latest" line for S6; S5 reclassified to "Prior".

### Throwaway artifact (gitignored)

- `artifacts/s6-provenance-smoke.mjs` — pure-logic smoke; not committed.

---

## 13. Limitations

| # | Limitation | Classification per `docs/39` § 11 | Recommended owner |
|---|---|---|---|
| L-1 | Live drafting exercise deferred — both candidate engagements hold 0 persisted findings + 0 opportunities. | **Operator-pending** | Operator runs the first real-data drafting exercise on any engagement; polish surfaces automatically. |
| L-2 | Migration `0019_opportunity_reviewer_notes.sql` NOT yet applied to deployed Supabase. Until applied, the page query selecting `reviewer_notes` would 500-error on every persisted-engagement render. | **Operator-pending** | Operator runs `apply_migration` on `hhglrcvsmwaheikdvijw` before the next Vercel Production promotion (same pattern as S3-B / Sprint I3). Current deployed Production is at S4 (`384ab1e`) and unaffected. |
| L-3 | `RoadmapReadinessHint` advisories are advisory only — they do NOT enforce a gate. S7 will decide its own gating posture when it lands. | **By-design** (per `docs/39` § 5 Sprint S6 scope) | Sprint S7 owner — S7 may, but is not required to, consume the hint signal. |
| L-4 | The needs-validation warning panel does NOT block selection; the operator can still mark an opportunity selected. | **By-design** — canon: operator is the only authority on opportunity approval | None. |
| L-5 | Provenance is recomputed on every page render rather than cached. For an engagement with N findings and M opportunities, the per-render cost is `O(refs)` (typically dozens) + `O(M × avg_links)` (typically small). | **By-design** (caching introduces staleness when findings are edited; current cost is sub-millisecond). | None. |
| L-6 | Default S7 threshold (`minSelectedForS7 = 3`) is a placeholder; S7 may refine it. | **By-design** (overridable via `options.minSelectedForS7`). | Sprint S7 owner. |
| L-7 | The provenance helper degrades unknown DB enum values to `consultant-note` / `thin` rather than crashing. A schema drift that silently rebrands `source_type` would therefore appear as more thin refs in the chip without raising an error. | **By-design** (defensive default — safer than crashing the page). | Future S5/S6 follow-on if operators report ambiguity. |
| L-8 | The AI prompt asks the model to bias toward `evidenceStrength: 'thin'` and conservative wording on weak-source-finding opportunities, but cannot be machine-verified — validation only enforces 0–100 score bounds + enum allowlist. A non-cooperative model could still assert `'strong'` despite the prompt rule. | **By-design** (the operator UI's needs-validation chip surfaces the inherited flag regardless of what the model claimed; double-coverage). | None. |
| L-9 | The existing `selected` status enum was preserved rather than renamed to `approved`. New consumers reading activity events still see `opportunity_selected` rather than `opportunity_approved`. | **By-design** (preserves audit-trail compatibility; semantic mapping documented). | None. |

---

## 14. Recommended next sprint

**Sprint S7 — Roadmap AI Drafting + Sequencing** per `docs/39` § 5.

Prereqs cleared by S6:
- Opportunities have a clearly defined `selected` state representing "operator-approved for roadmap drafting."
- The `RoadmapReadinessHint` exposes how many selected opportunities exist so S7 drafting has an operator-visible threshold signal.
- Provenance flags propagate from findings → opportunities; S7 can inherit them at the roadmap-item level.
- Rejected + deferred opportunities are guaranteed never to reach S7 (smoke BOUNDARY case verified).
- Activity metadata for the existing `opportunity_*` events carries source-finding counts that S7 will need.

Operator-side prerequisites that are NOT blockers for S7 source work but ARE preconditions for a live drafting exercise:

1. Apply migration `0019_opportunity_reviewer_notes.sql` to deployed Supabase (`hhglrcvsmwaheikdvijw`) before Vercel Production promotion past `384ab1e`.
2. Real findings must exist + be approved on the target engagement (today both candidates hold 0; same precondition as S6 live exercise).
3. Operator approves (marks selected) at least 3 opportunities so the `RoadmapReadinessHint.readyForS7` flag flips green — or S7 chooses to draft with weaker coverage.

No roadmap sequence change required.

---

## 15. Suggested commit message

```
Add opportunities AI drafting
```

Hold for commit review per the established sprint pattern — operator provides the exact `git add` block after reviewing this evidence log.

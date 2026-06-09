# docs/51 — Proposal AI Drafting + Scope Edits + Recommended Option (Sprint S9)

> **Status:** Source-clean + lint-clean + build-clean + boundary-clean. Pure-logic smoke 31/31 pass. Live AI bulk-drafting walkthrough deferred to post-commit per the sprint's "Do not commit until review" rule.
> **Branch:** `persistence/step-0-1-auth-shell` (work) · `staging` (deploy target)
> **Upstream base:** `ee24626` (Verify report section drafting walkthrough)
> **Sprint scope:** docs/39 § 5 — Sprint S9.

## 1. Sprint context

Sprint S9 lands AI proposal drafting on top of the substantial pre-S9 scaffold (3 canonical option types + per-option synthesis context + commercial guard + snapshot pipeline + eligibility evaluator + per-option lifecycle actions + initialize-3-options seeding + SOW Draft scaffolding for S10). The drafting consumes the operator-approved evidence chain — approved findings (S5) + selected opportunities (S6) + ready roadmap items (S7) + **approved/final report sections (S8)** — and produces operator-reviewable option drafts without minting any client-facing artifact.

This sprint did NOT introduce proposal-option synthesis from scratch. The pre-S9 scaffold included:

- `supabase/migrations/0008_reports_proposals.sql` — `proposals` (1:1 with engagement) + `proposal_options` (3 canonical types via unique partial index) + `proposal_option_opportunity_links` + `proposal_option_roadmap_links`.
- `lib/ai/proposal-option-context.ts` — per-option synthesis context builder.
- `lib/ai/proposal-option-synthesis.ts` — per-option AI synthesis + combined banned-claim scanner (financial + commercial-finality).
- `lib/proposals/synthesis-actions.ts` — per-option `generateProposalOptionDraftAction`.
- `lib/proposals/actions.ts` — option lifecycle (approve / needs-review / reopen / update / mark-recommended / link / unlink) + proposal-level status / implementation credit / next-step actions.
- `lib/proposals/commercial-guard.ts` — combined 44-pattern scanner (financial 14 + commercial-finality 6 + roadmap-commitment 6 + proposal-finality 18).
- `lib/proposals/snapshot-actions.ts` — operator-only candidate snapshot pipeline (`proposal_delivery_snapshots`).
- `lib/proposals/eligibility.ts` — 13-condition delivery eligibility evaluator.
- `lib/proposals/sow-draft-actions.ts` + `lib/proposals/sow-draft-eligibility.ts` — S10 scaffolding (SOW Draft surface, 70-pattern guard, 15-condition SOW eligibility) all pre-existing.
- `components/proposals/proposal-workspace.tsx` + `proposal-candidates-panel.tsx` + `implementation-credit-panel.tsx` + `proposal-option-action-bar.tsx` + per-option `Generate AI draft` button + per-candidate Approve/Void buttons.

S9 closed three gaps and added four new pieces. Section § 2–§ 9 cover each.

## 2. Proposal model inventory

The deployed model already supports the full S9 contract. No migration was needed.

| Concept (S9 spec) | DB column / table |
|---|---|
| Proposal candidate ID | `proposals.id` (and `proposal_delivery_snapshots.id` for the snapshotted version) |
| Option title | `proposal_options.title` |
| Option scope summary | `proposal_options.scope_summary` |
| Included work | `proposal_options.deliverables text[]` |
| Excluded work | covered at the SOW Draft layer (S10); proposal-side uses `assumptions` for caveats |
| Assumptions | `proposal_options.assumptions text[]` |
| Timeline range / phase summary | `proposal_options.timeline` |
| Source report section IDs | NOT a structural link table (see § 3 note); carried in synthesis-context counts + activity metadata only |
| Source opportunity IDs | `proposal_option_opportunity_links` (M:M, RLS-scoped) |
| Source roadmap item IDs | `proposal_option_roadmap_links` (M:M, RLS-scoped) |
| Recommended option flag | `proposal_options.recommended boolean` + `proposals.recommended_option_id` (denormalized for quick lookup) |
| Approval status | `proposals.status` (`draft` / `needs-review` / `approved` / `sent-placeholder` / `accepted-placeholder`) + `proposal_delivery_snapshots.approval_state` (`unreviewed` / `approved` / `voided`) |
| Operator notes | `proposals.consultant_notes text[]` + `proposals.next_step text` + `proposals.assumptions text[]` (option-level reviewer notes are not stored; the operator uses `next_step` + per-option content edits) |
| Commercial guard status | `proposal_delivery_snapshots.commercial_guard_result jsonb` (44-pattern Sprint P2+ format) |
| ai_drafted boolean | inferred from `ai_synthesis_runs.run_type='proposal_option_draft'`; no scalar column needed |
| Provenance metadata | derived in-process from `*_links` tables + activity-event `sourceFindingCount` / `sourceReportSectionCount` / `sourceOpportunityCount` / `sourceRoadmapItemCount` |
| Implementation credit | `proposals.credit_eligible` + `credit_amount_placeholder` + `credit_window` + `credit_notes` |

## 3. Migration decision

**No migration required.** Every conceptual field S9 needs already exists. The 3-option canonical taxonomy (`quick-win-build`, `ai-workflow-system`, `managed-ai-partner`) matches the spec's "Suggested proposal option pattern". The two link tables are the right shape for source-provenance preservation. Per-option content is text + text[] columns; proposal-level lifecycle + commercial-lever copy is on the proposal row.

**Report-section provenance note:** the existing schema has no `proposal_option_report_section_links` table. The S9 spec says "preserve source provenance from report sections, roadmap, opportunities, and findings **where existing model supports it**" — emphasis on the latter. The existing model supports opportunity + roadmap structural links; report-section provenance is therefore carried in:
- The synthesis context's `reportSections[]` array (counts visible in `ai_synthesis_runs.input_summary`).
- The per-option `ai_proposal_option_drafted` activity metadata's `sourceReportSectionCount` (Sprint S9 — new).

Future migration can add a structural link table when downstream sprints need it (S10's SOW Draft snapshot already captures the source proposal snapshot, which in turn references the report sections that fed proposal drafting — chain integrity holds without the structural link).

This makes S9 footprint as tight as S8 — purely additive TypeScript + UI, zero SQL touch.

## 4. Closed pre-S9 gaps

### 4.1 Opportunity allowlist leak

**Before S9** (`lib/ai/proposal-option-context.ts`):
```ts
const ELIGIBLE_OPPORTUNITY_STATUSES = ["scored", "selected"];
```

`scored` is an internal pre-approval state. Same correctness shape as the S7 leak that was closed in `roadmap-context.ts` and the S8 leak that was closed in `report-section-context.ts`.

**After S9:**
```ts
const ELIGIBLE_OPPORTUNITY_STATUSES = ["selected"];
```

Only operator-blessed `selected` opportunities are eligible inputs. `scored`, `draft`, `deferred`, `rejected` are all excluded.

### 4.2 Roadmap loader had no status filter

**Before S9** (`loadRoadmap` in `lib/ai/proposal-option-context.ts`):
```ts
.from("roadmap_items")
.eq("engagement_id", engagementId)
.order("phase", ...)
```

No `status` filter — every roadmap row regardless of state would reach the model.

**After S9:**
```ts
const ELIGIBLE_ROADMAP_STATUSES = ["ready"];
// ...
.in("status", ELIGIBLE_ROADMAP_STATUSES)
```

### 4.3 Report-section allowlist was too permissive

**Before S9** (`lib/ai/proposal-option-context.ts`):
```ts
const ELIGIBLE_REPORT_SECTION_STATUSES = new Set([
  "drafted",
  "needs_review",
  "approved",
  "final",
]);
```

This included `drafted` + `needs_review` — pre-approval section text would reach the proposal-option AI prompt.

**After S9:**
```ts
const ELIGIBLE_REPORT_SECTION_STATUSES = new Set([
  "approved",
  "final",
]);
```

Per the S8 → S9 contract (docs/49 § 7), proposal options are grounded only on operator-blessed report copy. Pre-approval section text never reaches the proposal-option prompt.

### 4.4 No structural source provenance from AI synthesis

**Before S9** (`lib/proposals/synthesis-actions.ts`): after AI drafting succeeded, the option row was updated with `title` / `best_fit_scenario` / `scope_summary` / `timeline` + the four arrays + `ai_drafted=true`, but the two `proposal_option_*_links` tables were NEVER written by AI synthesis. The prompt asked the model to reference findings/opportunities/roadmap by title, but the IDs reached only the human-readable content — not the queryable link tables.

**Live evidence (deployed Production):** the controlled fixture's 3 pre-existing canonical options have **0 rows across both link tables** — confirming the gap S9 closes.

**After S9:**

- `ProposalOptionDraftCandidate` gained two structured-provenance fields: `groundedOpportunityIds`, `groundedRoadmapItemIds`.
- The AI prompt instructs the model to populate them with IDs drawn ONLY from the supplied context arrays. The validator defensively filters out any UUID not in the upstream allowlist — the model cannot invent provenance.
- After a successful option update, `persistGroundedLinks` writes rows into the two link tables. Unique-violation (23505) is benign (link already exists).
- The activity-event metadata receives sanitized `sourceReportSectionCount`, `sourceFindingCount`, `sourceOpportunityCount`, `sourceRoadmapItemCount` (counts only — no UUIDs).

## 5. New: Proposal drafting input model

The post-S9 input model fed to the per-option AI synthesis:

| Bucket | Filter | Cap |
|---|---|---|
| Engagement | by `engagement_id` | 1 |
| Account | joined via `engagement.account_id` | 0 or 1 |
| Proposal (target) | by lookup from option | 1 |
| Target option | by `optionId` | 1 |
| Sibling options | rest of proposal | up to all 2 |
| Findings | `review_status IN ('approved','report_ready')` | MAX_FINDINGS = 20 |
| Opportunities | `status = 'selected'` only | MAX_OPPORTUNITIES = 20 |
| Roadmap items | `status = 'ready'` only | MAX_ROADMAP_ITEMS = 30 |
| Report sections | `status IN ('approved','final')` only | MAX_REPORT_SECTIONS = 12 |

Hard exclusions enforced by the filter or by the context builder:

- ❌ Rejected / draft / needs-review findings
- ❌ Deferred / rejected / draft / scored opportunities
- ❌ Planned / deferred / rejected / blocked / completed roadmap items
- ❌ Drafted / needs-review / not-started report sections (per the S9 tightening)
- ❌ Stakeholder PII
- ❌ Uploaded file binaries
- ❌ Internal Saipien Fit Score
- ❌ Raw transcript text / raw response text / stakeholder emails

## 6. AI proposal-option drafting integration

The S9 AI pipeline (per option):

```
[Context builder]  buildProposalOptionSynthesisContext({engagementId, optionId})
       │
       ▼
[Model call]       getAiProposalOptionProviderConfig() → openai gpt-4o-mini default
                   response_format: json_object · temperature 0.2 · maxTokens 2400
       │
       ▼
[Validator]        - JSON parsable
                   - Required fields: optionTitle, bestFitScenario, scopeNarrative, timeline (all length-bounded)
                   - HTML markers rejected
                   - deliverables / assumptions / dependencies / risks clipped + arrayCapped
                   - groundedOpportunityIds / groundedRoadmapItemIds:
                       UUID-shape check, allowlist check, dedup, cap at 12 each
       │
       ▼
[Banned-claim scanner]  scanForBannedClaims → combined FINANCIAL + COMMERCIAL-FINALITY patterns
                        (financial 14 + commercial-finality 6 = 20 patterns)
                        Rejects: guaranteed ROI, payback, break-even, top quartile,
                        industry benchmark, ready for signature, binding quote, etc.
       │
       ▼
[Option update]    title, best_fit_scenario, scope_summary, timeline,
                   deliverables[], assumptions[], dependencies[], risks[]
                   — explicitly NOT pricing_placeholder, recommended, option_type, position
       │
       ▼
[Link persistence] persistGroundedLinks writes proposal_option_*_links rows;
                   23505 (unique_violation) is benign
       │
       ▼
[Activity event]   ai_proposal_option_drafted with sanitized counts only
```

### 6.1 Bulk drafting orchestrator (new)

`generateAllProposalOptionDraftsAction({engagementId})`:

- Iterates every option on the proposal sequentially.
- Sequential, not parallel — same rationale as S8's bulk drafter.
- Single failed option never aborts the loop.
- Unlike the S8 bulk drafter, this one does NOT skip any options regardless of their content state. Proposal options have no per-option "approved/final" lifecycle equivalent — operator review happens at the proposal level via `approveProposal`, not per option. The operator's intent in clicking "Draft all options" is to refresh all three canonical SOW shapes from the upstream evidence.
- Emits a single `ai_proposal_options_drafted` event with sanitized aggregate metadata: `{runType='proposal_options_bulk_draft', total, attempted, succeeded, failed, optionTypes, errorCodeCounts}`.

### 6.2 Option taxonomy used

S9 uses the existing 3-option canonical taxonomy without modification, matching the spec's suggested pattern:

| Option type (canonical slug) | Recommended at init? | Suggested pattern |
|---|---|---|
| `quick_win_build` (TS: `quick-win-build`) | No | Option 1 — Focused Foundation / Quick Start |
| `ai_workflow_system` (TS: `ai-workflow-system`) | **Yes** | Option 2 — Recommended Implementation |
| `managed_ai_partner` (TS: `managed-ai-partner`) | No | Option 3 — Expanded Transformation / Strategic Build |

The `initializeProposalForEngagement` action seeds all three with placeholder copy + pre-recommends `ai_workflow_system`. The operator can promote a different option via `markProposalOptionRecommended` — the action demotes any other recommended option then promotes the target.

## 7. Operator review lifecycle

Per-option affordances (existing pre-S9, preserved):

- **Generate AI draft** — single-option synthesis. Hidden when no provider configured. Output is a `partial-field update` — never touches pricing/recommendation/option_type/position.
- **Mark recommended** — promotes the option to the proposal's recommended slot.
- **Edit option** — `updateProposalOption` for direct operator content edits.
- **Link / Unlink** opportunity or roadmap-item provenance.

Proposal-level affordances:

- **Approve** → `status = "approved"` (`approveProposal`)
- **Needs review** → `status = "needs-review"`
- **Reopen** → `status = "draft"`
- **Generate proposal candidate** → operator-only snapshot (`generateProposalCandidateAction`)
- **Approve / Void candidate snapshot** → existing P3 lifecycle

Engagement-level affordances (new in S9):

- **Draft all options** — `GenerateAllProposalOptionsButton`. Mounted in the page header for persisted engagements when `aiAvailable` is true.

## 8. Commercial guard behavior

The existing 44-pattern `runProposalCommercialGuard` (financial 14 + commercial-finality 6 + roadmap-commitment 6 + proposal-finality 18) runs at snapshot-generation time, not at AI draft time (the AI-synthesis layer runs a smaller combined financial+commercial-finality scan against the candidate before persistence). Both are pre-existing; S9 does not change the pattern lists.

The S9 SOW readiness signal exposes the guard verdict via `commercialGuardPassed: boolean | null` (null when no snapshot exists; the `isCommercialGuardPassed` helper folds the snapshot's jsonb result into this shape).

## 9. S10 SOW Draft readiness signal

A pure-function projection over the proposal + options + latest snapshot, rendered into a server-component card on the proposal page.

### 9.1 The contract

`lib/proposals/readiness.ts` exports `buildSowReadinessSignal(args)`:

- `hasProposal` — proposal row exists.
- `optionCount` — number of options.
- `hasRecommendedOption` — at least one option `recommended=true`.
- `recommendedOptionType` — canonical slug of the recommended option, or null.
- `recommendedOpportunityLinkCount` + `recommendedRoadmapLinkCount` — provenance coverage on the recommended option.
- `recommendedHasProvenance` — has any link (advisory only).
- `proposalApproved` — `proposals.status === 'approved'`.
- `hasApprovedSnapshot` — most-recent snapshot is `approval_state='approved'` and NOT voided.
- `commercialGuardPassed` — `true` / `false` / `null` (unknown).
- `hasRequiredReportSectionsApproved` — optional S8 chain integrity check (advisory only).
- `advisories: string[]` — operator-facing strings.
- `readyForS10` — convenience boolean: `hasProposal && optionCount > 0 && hasRecommendedOption && proposalApproved && hasApprovedSnapshot && commercialGuardPassed === true`.

### 9.2 BOUNDARY behavior (smoke-verified)

| Scenario | `readyForS10` | Notes |
|---|---|---|
| No proposal | ❌ | advisories list says "Initialize" |
| 0 options | ❌ | "Seed at least one option" |
| 3 options, none recommended | ❌ | "Use the proposal-option action bar to mark one option" |
| Recommended w/o provenance | ✅ | Provenance is advisory only |
| Recommended w/ provenance, approved, snapshot+guard pass | ✅ | Happy path |
| Proposal NOT approved | ❌ | "Proposal is not yet approved" |
| Snapshot NOT approved | ❌ | "No operator-approved proposal candidate snapshot" |
| **BOUNDARY: commercial guard FAILED** | **❌** | "Commercial guard rejected …" |
| Guard verdict unknown (null) | ❌ | strict — refuses without explicit pass |
| S8 chain degraded | ✅ | Advisory only — does NOT block |

### 9.3 The card

`components/proposals/sow-readiness-hint.tsx` — server component (zero client-bundle cost). Renders:

- Headline `Ready for SOW Draft` (success) or `Not yet` (warning).
- Precondition checklist — 7-8 chips (one per readiness boolean, with `advisoryOnly` styling on the two soft signals).
- 2 provenance-coverage stat tiles (recommended-option opportunity + roadmap link counts).
- Advisory list.
- Boundary footer reiterating no `/p`, no Send to Client, no SOW Draft generation, no e-signature, no pricing math.

## 10. Controlled fixture validation

**Target:** SLATE Pilot Test Client · engagement `ed7f1f7d-b3fa-46c3-9d48-7b211d2c48b4`.

### 10.1 Deployed Supabase preflight (verified)

| Check | Required | Live state |
|---|---|---|
| Approved findings (S5 chain) | ≥ 1 | **5** ✅ |
| Selected opportunities (S9 input filter accepts) | ≥ 1 | **3** ✅ |
| Deferred opportunity (S9 input filter EXCLUDES) | n/a | 1 (correctly excluded) ✅ |
| Scored opportunities (no leak risk on this fixture) | 0 | **0** |
| Ready roadmap items (S9 input filter accepts) | ≥ 1 | **3** ✅ |
| Approved report sections (S8 → S9 chain handoff) | ≥ 1 | **5** ✅ |
| Pre-S9 eligible sections (drafted/needs-review/approved/final) | observed | 12 (the leak we close) |
| **Post-S9 eligible sections (approved/final only)** | ≥ 1 | **5** ✅ |
| Proposal row exists | yes | 1 (status='draft') |
| Proposal options seeded | 3 | **3** (the canonical taxonomy) |
| Recommended option pre-set | 1 | **1** (`ai_workflow_system`) |
| **Pre-existing proposal-option opportunity links** | observed | **0** ✅ confirms S9 closes the provenance-persistence gap |
| **Pre-existing proposal-option roadmap links** | observed | **0** ✅ confirms S9 closes the provenance-persistence gap |
| Pre-existing snapshots | observed | 3 (from prior walkthrough tests) |
| Pre-existing share tokens | observed | 4 (from prior walkthrough tests; revoked) |

### 10.2 Pure-logic smoke

`artifacts/s9-readiness-smoke.mjs` — **31/31 assertions pass** across 11 cases:

| # | Case | Highlight |
|---|---|---|
| 1 | no proposal | readyForS10=false, advisory mentions Initialize |
| 2 | 0 options | readyForS10=false |
| 3 | none recommended | readyForS10=false |
| 4 | recommended w/o provenance | readyForS10=true (advisory) |
| 5 | happy path (5 of 5 conditions met) | readyForS10=true |
| 6 | proposal not approved | readyForS10=false |
| 7 | snapshot not approved | readyForS10=false |
| 8 | **BOUNDARY — commercial guard failed** | **readyForS10=false**, advisory mentions "guard rejected" |
| 9 | guard verdict unknown (null) | readyForS10=false (strict refusal) |
| 10 | S8 chain degraded | readyForS10=true (advisory only) |
| 11 | S8 chain intact, all conditions met | readyForS10=true, advisories empty |

### 10.3 Live AI bulk-drafting walkthrough — DEFERRED

Per the sprint spec, "Do not commit until review." Live AI drafting requires a deploy, which requires a commit. The live walkthrough is therefore the operator's first post-commit action.

Expected live sequence (post-commit + deploy):

1. Navigate to `/app/engagements/ed7f1f7d-b3fa-46c3-9d48-7b211d2c48b4/proposal` → no 500.
2. Verify `SowReadinessHint` renders with `Not yet` status (proposal `status='draft'`).
3. Click `Draft all options` → `generateAllProposalOptionDraftsAction` runs.
4. Verify 3 synthesis runs (one per canonical option type) completed.
5. Verify `proposal_option_*_links` rows populated (non-zero per-option counts).
6. Verify activity-event metadata carries `sourceReportSectionCount: 5`, `sourceFindingCount: 5`, `sourceOpportunityCount: 3`, `sourceRoadmapItemCount: 3` (or close — model can ground on subsets).
7. Approve the proposal via existing UI → `proposals.status='approved'`.
8. Generate a fresh proposal candidate via the existing panel.
9. Approve the snapshot → `proposal_delivery_snapshots.approval_state='approved'`.
10. Verify `SowReadinessHint` flips `Not yet` → `Ready for SOW Draft`.
11. Verify zero `/p` mint, zero Send to Client, zero SOW Draft generated.

## 11. Activity metadata safety

Per-event sanitization:

| Event | New / Extended | Fields | Raw text? | UUIDs? |
|---|---|---|---|---|
| `ai_proposal_option_drafted` | Extended | runType, optionType, **sourceReportSectionCount**, **sourceFindingCount**, **sourceOpportunityCount**, **sourceRoadmapItemCount**, provider, model | **None** | **None** |
| `ai_proposal_options_drafted` | **New (plural)** | runType=`proposal_options_bulk_draft`, total, attempted, succeeded, failed, optionTypes, errorCodeCounts | **None** | **None** |
| `proposal_status_changed` | unchanged | proposalStatus | **None** | **None** |
| `proposal_option_recommended` | unchanged | (empty metadata) | **None** | **None** |
| `proposal_snapshot_*` | unchanged | sanitized aggregate counts only | **None** | snapshot ID only (the subject) |

No raw option body, no draft narrative, no upstream finding/opportunity/roadmap UUIDs, no stakeholder emails, no transcript text, no pricing math.

## 12. Boundary confirmation

| Boundary | Result |
|---|---|
| `/p` mint | Zero |
| `/r` mint | Zero |
| Send to Client | Zero |
| SOW generation | Zero |
| Public report/proposal route changes | Zero |
| Email / CRM / e-signature | Zero |
| Attio writes | Zero |
| Public routes added | Zero |
| Group-B exhibit wiring | Zero |
| Sapient Digital mutation | Zero |
| Real client mutation | Zero |
| `docs/39` § 5 sequence change | Zero |
| New findings created | Zero |
| New opportunities created | Zero |
| New roadmap items created | Zero |
| New report sections created | Zero |
| Override path used | No |
| SQL seeding used | No |
| Service-role writes used | No |
| New package dependencies | Zero |
| Migration footprint | **Zero** (purely additive TS + UI) |

OpenAI cost for live walkthrough (when run post-commit) ≈ $0.02–0.05 for 3 sequential `gpt-4o-mini` calls.

## 13. Files changed

**New (3):**
- `lib/proposals/readiness.ts` — pure-function S10 SOW readiness signal (~250 lines)
- `components/proposals/sow-readiness-hint.tsx` — server component (~170 lines, zero client bundle)
- `components/proposals/generate-all-proposal-options-button.tsx` — client component (~110 lines)

**Source modified (6):**
- `lib/ai/proposal-option-context.ts` — tightened opportunity allowlist + new roadmap allowlist + tightened report-section allowlist + boundary comment block
- `lib/ai/proposal-option-synthesis.ts` — extended candidate with grounded ID arrays + validator + system prompt + schema instruction
- `lib/proposals/synthesis-actions.ts` — persists link rows + extended metadata + new `generateAllProposalOptionDraftsAction` bulk orchestrator
- `lib/activity/types.ts` — added `ai_proposal_options_drafted` to event enum
- `components/activity/activity-timeline.tsx` — label + tone for the new event
- `app/app/engagements/[id]/proposal/page.tsx` — mounts `GenerateAllProposalOptionsButton` + `SowReadinessHint` + computes readiness signal server-side

**Docs (5):**
- `docs/51_PROPOSAL_AI_DRAFTING.md` — this file
- `docs/39_CONSULTING_MODULE_COMPLETION_ROADMAP.md` § 5 — Sprint S9 row landing note (sequence unchanged)
- `docs/49_REPORT_SECTION_AI_DRAFTING.md` — § 17 cross-reference noting S9 consumed S8 output
- `docs/50_S8_REPORT_DRAFTING_WALKTHROUGH.md` — § 14 closure note
- `docs/08_CURRENT_STATUS.md` — new S9 block at top
- `docs/10_SESSION_HANDOFF.md` — new `Latest` paragraph (S9), prior S8 walkthrough demoted

**Throwaway:**
- `artifacts/s9-readiness-smoke.mjs` — gitignored

## 14. Limitations

- **L-27 — Live AI walkthrough deferred to post-commit.** Documented in § 10.3. Operator runs after deploy lands.
- **L-28 — No report-section structural link table.** Documented in § 3. The existing schema has no `proposal_option_report_section_links`. Report-section provenance is carried via synthesis-context counts + activity-event metadata, not via structural links. Future migration can add the table when downstream sprints need it; S10 SOW Draft already inherits proposal-snapshot → report-section traceability via the snapshot's `source_context_snapshot.reportSections` array.
- **L-29 — Bulk drafter does NOT skip operator-edited options.** Unlike S8's bulk drafter (which skips `approved` + `final` sections), S9's bulk drafter overwrites every option's narrative content. Rationale: proposal options have no per-option lifecycle equivalent — `recommended` is a structural flag, not an approval state, and the per-option content is meant to be refreshed when upstream evidence changes. Operator-set commercial levers (pricing/recommendation/option_type/position) are still preserved by the per-option synthesis action's partial-field update contract. If an operator wants to lock in option content that should NOT be re-drafted, they edit it directly via `updateProposalOption` and avoid clicking `Draft all options`.
- **L-30 — `commercialGuardPassed` is strict-null.** The S10 readiness signal refuses to flip ready when the guard verdict is `null` (no snapshot exists). The eligibility evaluator (`evaluateProposalDeliveryEligibility`) does the same — defensive default. Operators surface this as "Regenerate the candidate" in the advisory list.

## 15. Recommended next sprint

**Sprint S10 — Internal SOW Draft Validation** per `docs/39` § 5. Roadmap sequence unchanged.

S10 entry conditions after S9:

- Proposal approved with a recommended option.
- Proposal candidate snapshot approved.
- Commercial guard passed.
- `SowReadinessHint.readyForS10 === true`.
- The existing SOW Draft scaffold (`lib/proposals/sow-draft-actions.ts` + `lib/proposals/sow-draft-eligibility.ts` + 70-pattern guard + 15-condition SOW eligibility evaluator + `PastSowDraftsPanel`) is hot and untouched by S9.

## 16. Suggested commit message

```
Add proposal AI drafting
```

(Per task spec.)

---

## 17. Follow-on — Post-deploy walkthrough PASS WITH ONE CONTRACT GAP (2026-06-08)

⚠ **S9 live-verified end-to-end on deployed Production through all functional layers.** See `docs/52_S9_PROPOSAL_DRAFTING_WALKTHROUGH.md` for the full evidence log.

The deferred live walkthrough from § 10.3 ran successfully on Vercel Production build `slate-os-staging-lyogvylju-…` through:

- Bulk drafter triggered: **3/3 succeeded, 0 failed**.
- **100% provenance allowlist enforcement** across 14 link rows: 7 opportunity links all `selected`, 7 roadmap links all `ready`. The 1 deferred opportunity produced **zero** option links.
- **Banned-language scan: 0 hits across all 3 drafts** (financial / commercial-finality / pricing / HTML / signature / payment-terms patterns).
- **Operator-set commercial levers preserved verbatim** across all 3 options: pricing placeholders unchanged, recommendation flag unchanged (`ai_workflow_system` still the only recommended), option types unchanged, positions unchanged.
- Operator generated a fresh proposal candidate snapshot through the deployed UI.
- **Commercial guard PASSED live**: 45-pattern scan, 0 violations.
- Operator approved the snapshot through the deployed UI — `approval_state='approved'`, not voided.
- Activity metadata sanitized live for all 6 new events: zero raw text, zero PII, zero upstream UUIDs.
- Boundary held: zero `/p`/`/r` mint, zero share tokens, zero SOW drafts, zero upstream mutations during the entire walkthrough window. Only 4 distinct event types observed — all S9 scope.

**One contract gap surfaced — L-31 (CLOSED 2026-06-08 via S9-Fix; see `docs/53`):** `buildSowReadinessSignal.proposalApproved` required `proposals.status === 'approved'` but the deployed UI has no mount for the `approveProposal` server action. The hint stays on "Not yet" even after snapshot-approval. The smallest fix is a 4-line change to soften the contract so snapshot-approval is sufficient (matches the canonical `sow-draft-eligibility.ts` evaluator). Recommended next sprint: a small **S9-Fix** sprint to apply this before S10, OR proceed directly to S10 (the SOW Draft generation gate does not depend on the readiness hint flip).

**S9 drafting fundamentals are working.** Recommendation: small fix sprint then S10. See docs/52 § 11 for the full L-31 disclosure + § 13 for the recommendation.

# docs/49 — Report Section AI Drafting Integration (Sprint S8)

> **Status:** Source-clean + lint-clean + build-clean + boundary-clean. Pure-logic smoke 36/36 pass. Live AI walkthrough deferred to post-commit (see § 9).
> **Branch:** `persistence/step-0-1-auth-shell` (work) · `staging` (deploy target)
> **Upstream base:** `35d8da5` (Add roadmap AI drafting)
> **Sprint scope:** docs/39 § 5 — Sprint S8.

## 1. Sprint context

Sprint S8 lands AI report-section drafting on top of the substantial pre-S8 scaffold (12-section taxonomy + per-section synthesis + banned-claim scanner + per-section Approve / Needs Review / Drafted / Lock as Final controls). The drafting consumes the approved evidence chain — approved findings (S5), selected opportunities (S6), and ready roadmap items (S7) — and produces operator-reviewable draft sections without minting any client-facing artifact.

This sprint did NOT introduce report-section synthesis from scratch. The pre-S8 scaffold included:

- `supabase/migrations/0008_reports_proposals.sql` — `reports`, `report_sections`, `report_section_finding_links`, `report_section_opportunity_links`, `report_section_roadmap_links`.
- `supabase/migrations/0012_report_section_exhibit_slot.sql` — Group-A `exhibit_slot` reference column on report sections.
- `lib/ai/report-section-context.ts` — per-section synthesis context builder.
- `lib/ai/report-section-synthesis.ts` — per-section AI synthesis + banned-claim scanner.
- `lib/reports/synthesis-actions.ts` — per-section `generateReportSectionDraftAction`.
- `lib/reports/actions.ts` — section lifecycle (approve / needs-review / drafted / final / update / link / unlink).
- `components/reports/report-section-action-bar.tsx` — per-section operator UI.
- `components/reports/report-workspace.tsx` — section list + preview + linked context.

S8 closed six gaps and added four new pieces. Section § 2–§ 9 cover each.

## 2. Report model inventory

The deployed model already supports the full S8 contract. No migration was needed.

| Concept (S8 spec) | DB column / table |
|---|---|
| Section key | `report_sections.section_type` (12-value text union: `executive_summary`, `business_context`, `systems_snapshot`, `readiness_assessment`, `workflow_friction`, `stakeholder_synthesis`, `opportunity_portfolio`, `priority_recommendations`, `governance_risk`, `roadmap`, `recommended_next_step`, `appendix`) |
| Title | `report_sections.title` |
| Draft body | `report_sections.summary` + `report_sections.draft_preview` (+ `evidence_notes` for per-bullet evidence) |
| Status | `report_sections.status` (`not_started` / `drafted` / `needs_review` / `approved` / `final`) |
| Source finding IDs | `report_section_finding_links` (M:M) |
| Source opportunity IDs | `report_section_opportunity_links` (M:M) |
| Source roadmap item IDs | `report_section_roadmap_links` (M:M) |
| AI drafted flag | `report_sections.ai_drafted boolean` |
| Reviewer note | `report_sections.reviewer_note text` |
| Last reviewed at | `report_sections.last_reviewed_at` + `reports.last_edited_at` |
| Provenance metadata | derived in-process from links + `ai_drafted` flag (no schema add needed) |
| Exhibit slot | `report_sections.exhibit_slot` (Group-A only, CHECK-constrained) |

## 3. Migration decision

**No migration required.** Every conceptual field S8 needs already exists. The 12-section taxonomy already matches the spec ("Likely sections" list). The three link tables are exactly the source-provenance shape the spec describes. The `status` column accepts the full lifecycle.

This makes S8 footprint smaller than S7 (which needed `0020_roadmap_reviewer_notes` for rejection rationale persistence) — purely additive TypeScript + UI, zero SQL touch.

## 4. Closed pre-S8 gaps

### 4.1 Opportunity allowlist leak

**Before S8** (`lib/ai/report-section-context.ts`):
```ts
const ELIGIBLE_OPPORTUNITY_STATUSES = ["scored", "selected"];
```

`scored` is an internal pre-approval state. Allowing it through the synthesis filter meant operator-not-blessed opportunity drafts could feed report-section AI input. Same correctness shape as the S7 leak that was closed in `roadmap-context.ts`.

**After S8:**
```ts
const ELIGIBLE_OPPORTUNITY_STATUSES = ["selected"];
```

Only operator-blessed `selected` opportunities are eligible inputs. `scored`, `draft`, `deferred`, `rejected` are all excluded.

### 4.2 Roadmap loader had no status filter

**Before S8** (`loadRoadmap` in `lib/ai/report-section-context.ts`):
```ts
.from("roadmap_items")
.eq("engagement_id", engagementId)
.order("phase", ...)
```

No `status` filter — every roadmap row regardless of state would reach the model. That means planned (draft), deferred, rejected, blocked, and completed items would all feed AI input. Per the S7 + S8 contract, only `ready` items are operator-blessed for downstream consumption.

**After S8:**
```ts
const ELIGIBLE_ROADMAP_STATUSES = ["ready"];
// ...
.in("status", ELIGIBLE_ROADMAP_STATUSES)
```

### 4.3 No structural provenance persistence

**Before S8** (`lib/reports/synthesis-actions.ts`): after AI drafting succeeded, the section row was updated with `summary` / `draft_preview` / `evidence_notes` and `ai_drafted=true`, but the three `report_section_*_links` tables were NEVER written. The AI prompt asked the model to ground claims in findings/opportunities/roadmap by name or id, but the IDs reached only the human-readable `evidence_notes` text — not the queryable link tables.

**Live evidence (deployed Production):** the pre-existing `executive_summary` section is `status=approved, ai_drafted=true` and has **zero rows across all three link tables**. This is exactly the gap S8 closes.

**After S8:**

- `ReportSectionDraftCandidate` gained three structured-provenance fields: `groundedFindingIds`, `groundedOpportunityIds`, `groundedRoadmapItemIds`.
- The AI prompt instructs the model to populate them with IDs drawn ONLY from the supplied context arrays. The validator defensively filters out any UUID not in the upstream allowlist — the model cannot invent provenance.
- After a successful section update, `persistGroundedLinks` writes rows into the three link tables. Unique-violation (23505) is benign (link already exists).
- The activity-event metadata receives sanitized `sourceFindingCount`, `sourceOpportunityCount`, `sourceRoadmapItemCount` (counts only — no UUIDs).

## 5. New: Report drafting input model

The post-S8 input model fed to the per-section AI synthesis:

| Bucket | Filter | Cap |
|---|---|---|
| Engagement | by `engagement_id` | 1 |
| Account | joined via `engagement.account_id` | 0 or 1 |
| Section (target) | by `sectionId` AND status not `final` | 1 |
| Sibling sections | rest of report | up to all 11 |
| Findings | `review_status IN ('approved','report_ready')` | MAX_FINDINGS = 20 |
| Opportunities | `status = 'selected'` only | MAX_OPPORTUNITIES = 20 |
| Roadmap items | `status = 'ready'` only | MAX_ROADMAP_ITEMS = 30 |
| Intake sessions | engagement-scoped aggregates only | MAX_INTAKE_SESSIONS = 30 |

Hard exclusions enforced by the filter or by the context builder:

- ❌ Rejected / draft / needs-review findings (only `approved` + `report_ready` reach the model)
- ❌ Deferred / rejected / draft / scored opportunities
- ❌ Planned / deferred / rejected / blocked / completed roadmap items
- ❌ Stakeholder PII (only role + status + response-quality + completion-percent aggregates)
- ❌ Uploaded file binaries / OCR / parsed text / signed URLs
- ❌ Internal Saipien Fit Score
- ❌ Raw transcript text / raw response text / stakeholder emails

## 6. AI report section drafting integration

The S8 AI pipeline (per section):

```
[Context builder]  buildReportSectionSynthesisContext({engagementId, sectionId})
       │
       ▼
[Model call]       getAiReportSectionProviderConfig() → openai gpt-4o-mini default
                   response_format: json_object · temperature 0.2 · maxTokens 2200
       │
       ▼
[Validator]        - JSON parsable
                   - Required fields: sectionTitle, summary, draftPreview (all length-bounded)
                   - HTML markers rejected
                   - evidenceNotes / assumptionsAndLimits clipped + arrayCapped
                   - groundedFindingIds / groundedOpportunityIds / groundedRoadmapItemIds:
                       UUID-shape check, allowlist check, dedup, cap at 12 each
       │
       ▼
[Banned-claim scanner]  scanForBannedClaims → FINANCIAL_CLAIM_PATTERNS (shared)
                        Rejects: guaranteed ROI, guaranteed savings, payback, break-even,
                        cash-flow positive, will save, will reduce cost, top quartile,
                        above average, industry benchmark, peer benchmark, finance-approved,
                        board-ready ROI, guaranteed (return|savings|payback|cost|reduction).
       │
       ▼
[Section update]   summary, draft_preview, evidence_notes, ai_drafted=true,
                   status="needs_review" (NEVER auto-approved)
       │
       ▼
[Link persistence] persistGroundedLinks writes report_section_*_links rows;
                   23505 (unique_violation) is benign
       │
       ▼
[Activity event]   ai_report_section_drafted with sanitized counts only
```

### 6.1 Bulk drafting orchestrator (new)

`generateAllReportSectionDraftsAction({engagementId})`:

- Iterates non-blessed sections sequentially (`status !== 'final' && status !== 'approved'`).
- Sequential, not parallel — keeps each `ai_synthesis_runs` row atomic and respects the OpenAI rate-limit budget.
- Single failed section never aborts the loop; the orchestrator records the failure and continues.
- Emits a single `ai_report_sections_drafted` event with sanitized aggregate metadata: `{total, attempted, succeeded, failed, skippedBlessed, sectionTypes, errorCodeCounts}`.

### 6.2 Section taxonomy used

S8 uses the existing 12-section canonical taxonomy without modification, matching the spec's "use the existing canonical 12-section model if already present":

| # | Section type | Label | Required for S9? |
|---|---|---|---|
| 1 | `executive-summary` | Executive Summary | **Yes** |
| 2 | `business-context` | Business Context | No |
| 3 | `systems-snapshot` | Current-State Systems Snapshot | No |
| 4 | `readiness-assessment` | AI Readiness Assessment | No |
| 5 | `workflow-friction` | Workflow Friction Analysis | No |
| 6 | `stakeholder-synthesis` | Stakeholder Discovery Synthesis | No |
| 7 | `opportunity-portfolio` | AI Opportunity Portfolio | **Yes** |
| 8 | `priority-recommendations` | Priority Recommendations | **Yes** |
| 9 | `governance-risk` | Risk and Governance Notes | No |
| 10 | `roadmap` | 30/60/90-Day Roadmap | **Yes** |
| 11 | `recommended-next-step` | Recommended Next Step | **Yes** |
| 12 | `appendix` | Appendix | No |

## 7. Operator review lifecycle

Per-section affordances (existing pre-S8, preserved):

- **Generate AI draft** — single-section synthesis. Hidden when no provider configured or no `engagementId`. Disabled when status is `final`. Output forces `status=needs_review`.
- **Approve section** → `status=approved`. Disabled when already approved or final.
- **Needs review** → `status=needs_review`. Disabled when already needs-review.
- **Mark drafted** → `status=drafted`. Disabled when already drafted.
- **Lock as final** → `status=final`. Requires status to currently be `approved`. (Final sections cannot be re-drafted; operator must demote.)

Engagement-level affordances (new in S8):

- **Draft remaining sections** — `GenerateAllReportSectionsButton`. Mounted in the page header for persisted engagements when `aiAvailable` is true. Skips both `approved` and `final` sections.

Section-status transitions emit `report_section_status_changed` with the following sanitized metadata:

| Field | Source | Sensitive? |
|---|---|---|
| `sectionStatus` | the new status | No |
| `priorStatus` | the previous status | No |
| `sectionType` | canonical slug | No |
| `hasAiDraft` | `ai_drafted` boolean | No |
| `linkedFindingCount` | count of `report_section_finding_links` for this section | No (count only) |
| `linkedOpportunityCount` | count of `report_section_opportunity_links` for this section | No (count only) |
| `linkedRoadmapItemCount` | count of `report_section_roadmap_links` for this section | No (count only) |

## 8. S9 proposal-readiness signal

A pure-function projection over the loaded sections, rendered into a server-component card on the report page.

### 8.1 The contract

`lib/reports/readiness.ts` exports `buildProposalReadinessSignal(sections, options?)`:

- Counts by lifecycle status (`notStarted`, `drafted`, `needsReview`, `approved`, `final`).
- `operatorBlessed = approved + final`.
- `hasMinimumApproved = operatorBlessed >= minApprovedForS9` (default `5`).
- `requiredApproval: Record<ReportSectionType, boolean>` — per-section approved-or-final flag.
- `hasAllRequiredApproved = every required section approved/final`.
- `approvedSectionsWithProvenance` + `approvedSectionsMissingProvenance` (link-row coverage on operator-blessed sections).
- `advisories: string[]` — operator-facing strings.
- `readyForS9 = hasMinimumApproved && hasAllRequiredApproved`.

### 8.2 Required section set

```ts
export const PROPOSAL_REQUIRED_SECTIONS = [
  "executive-summary",
  "opportunity-portfolio",
  "priority-recommendations",
  "roadmap",
  "recommended-next-step",
];
```

These are the five sections the S9 proposal AI prompt will need approved before it can draft with high confidence.

### 8.3 BOUNDARY behavior (smoke-verified)

| Scenario | `hasMinimumApproved` | `hasAllRequiredApproved` | `readyForS9` |
|---|---|---|---|
| 5 of the 5 required approved | ✅ | ✅ | ✅ |
| 5 approved BUT wrong sections (no required) | ✅ | ❌ | **❌** |
| 4 approved (below threshold) | ❌ | depends | ❌ |
| 5 final (locked) | ✅ | ✅ | ✅ |
| 5 needs-review | ❌ | ❌ | ❌ |
| 5 drafted only | ❌ | ❌ | ❌ |

Provenance is advisory only — missing-link warnings appear in the advisories list, but they do NOT block `readyForS9`. The proposal sprint itself (S9) is responsible for enforcing provenance when it runs.

### 8.4 The card

`components/reports/proposal-readiness-hint.tsx` — server component (zero client-bundle cost). Renders:

- Headline `Ready for proposal drafting` (success) or `Not yet` (warning).
- 4 primary stat tiles (Approved · Needs Review · Drafted · Not Started).
- 5 required-section badges with check-mark when approved.
- 2 provenance-coverage tiles (Approved · linked, Approved · no links).
- Advisory list.
- Boundary footer reiterating no `/r`, no `/p`, no Send to Client, no SOW, no e-signature.

## 9. Controlled fixture validation

**Target:** SLATE Pilot Test Client · engagement `ed7f1f7d-b3fa-46c3-9d48-7b211d2c48b4`.

### 9.1 Deployed Supabase preflight (verified)

| Check | Required | Live state |
|---|---|---|
| Approved findings (input filter accepts) | ≥ 1 | **5** ✅ |
| Selected opportunities (S8 input filter accepts) | ≥ 1 | **3** ✅ |
| Deferred opportunity (input filter EXCLUDES) | n/a | 1 (correctly excluded) ✅ |
| Scored opportunities (no leak risk on this fixture) | 0 | **0** ✅ |
| Ready roadmap items (S8 input filter accepts) | ≥ 1 | **3** ✅ |
| Planned roadmap items (no leak risk on this fixture) | 0 | **0** ✅ |
| 12-section taxonomy seeded | 12 | **12** ✅ |
| Pre-existing approved section | observed | 1 (`executive_summary`, `ai_drafted=true`) |
| Pre-existing link rows across 3 tables | observed | **0** ✅ confirms S8 closes the gap |

### 9.2 Pure-logic smoke

`artifacts/s8-readiness-smoke.mjs` — 36/36 assertions pass across 11 cases:

| # | Case | Highlight |
|---|---|---|
| 1 | empty sections | total=0, advisories include threshold + required |
| 2 | all 12 not-started | readyForS9=false, requiredApproval all false |
| 3 | exactly 5 required approved | readyForS9=true |
| 4 | **BOUNDARY** — 5 approved of the WRONG sections | hasMinimumApproved=true BUT hasAllRequiredApproved=false → **readyForS9=false** |
| 5 | 4 approved (below threshold) | readyForS9=false |
| 6 | 5 required approved with provenance gap | readyForS9=true (provenance is advisory only) |
| 7 | 5 required `final` | readyForS9=true (final counts as operator-blessed) |
| 8 | all drafted | operatorBlessed=0, readyForS9=false |
| 9 | all needs-review | operatorBlessed=0, readyForS9=false |
| 10 | configurable threshold | min=5 ready, min=10 not ready |
| 11 | mixed lifecycle | partial counts correct |

### 9.3 Live AI bulk-drafting walkthrough — DEFERRED

Per the sprint spec, "Do not commit until review." Live AI drafting requires a deploy, which requires a commit. The live walkthrough is therefore the operator's first post-commit action.

Expected live sequence (post-commit + deploy):

1. Navigate to `/app/engagements/ed7f1f7d-b3fa-46c3-9d48-7b211d2c48b4/report` → no 500.
2. Verify `ProposalReadinessHint` renders with `Not yet` status (1 approved < 5 threshold).
3. Click `Draft remaining sections` → `generateAllReportSectionDraftsAction` runs.
4. Verify the orchestrator skipped the 1 pre-existing approved section (`skippedBlessed=1`).
5. Verify 11 sections drafted into `needs_review` with `ai_drafted=true`.
6. Verify `report_section_*_links` rows populated for each draft (per-section source counts > 0).
7. Approve at least the four remaining required sections (`opportunity-portfolio`, `priority-recommendations`, `roadmap`, `recommended-next-step`) — the pre-existing approved `executive_summary` already covers the fifth.
8. Verify `ProposalReadinessHint` flips `Not yet` → `Ready for proposal drafting`.
9. Verify zero proposal-side mutations (`proposal_options` row counts unchanged).
10. Verify zero `/r`/`/p` minting (`report_share_tokens` / `proposal_share_tokens` unchanged).

## 10. Activity metadata safety

Per-event sanitization:

| Event | New / Extended | Fields | Raw text? | UUIDs? |
|---|---|---|---|---|
| `ai_report_section_drafted` | Extended | runType, sectionType, exhibitSlot, **sourceFindingCount**, **sourceOpportunityCount**, **sourceRoadmapItemCount**, provider, model | No | No |
| `ai_report_sections_drafted` | **New (plural)** | runType=`report_sections_bulk_draft`, total, attempted, succeeded, failed, skippedBlessed, sectionTypes, errorCodeCounts | No | No |
| `report_section_status_changed` | Extended | sectionStatus, **priorStatus**, **sectionType**, **hasAiDraft**, **linkedFindingCount**, **linkedOpportunityCount**, **linkedRoadmapItemCount** | No | No |
| `ai_synthesis_failed` | unchanged | runType, sectionId, errorCode | No | sectionId only (the run subject) |

No raw section body, no draft preview, no reviewer note, no upstream finding/opportunity/roadmap UUIDs, no stakeholder emails, no transcript text, no Attio payload, no commercial-final pricing.

## 11. Boundary confirmation

| Boundary | Result |
|---|---|
| Proposal generation | Zero — `proposal_options` untouched |
| SOW generation | Zero |
| `/r` mint | Zero |
| `/p` mint | Zero |
| Send to Client | Zero |
| Public report/proposal route changes | Zero |
| Email / CRM / e-signature | Zero |
| Attio writes | Zero |
| Public routes added | Zero |
| Group-B exhibit wiring | Zero |
| Sapient Digital mutation | Zero |
| Real client mutation | Zero |
| Roadmap sequence change (`docs/39` § 5) | Zero |
| New findings created | Zero |
| New opportunities created | Zero |
| New roadmap items created | Zero |
| Override path used | No |
| SQL seeding used | No |
| Service-role writes used | No |
| New package dependencies | Zero |
| Migration footprint | **Zero** (purely additive TS + UI) |

OpenAI cost during walkthrough (when run post-commit) ≈ $0.05–0.15 for 11 sections (gpt-4o-mini default).

## 12. Files changed

**New (3):**
- `lib/reports/readiness.ts` — pure-function S9 proposal-readiness signal (~250 lines)
- `components/reports/proposal-readiness-hint.tsx` — server component (~165 lines, zero client bundle)
- `components/reports/generate-all-report-sections-button.tsx` — client component (~115 lines)

**Source modified (5):**
- `lib/ai/report-section-context.ts` — tightened opportunity allowlist + added ready-only roadmap filter + boundary comment block
- `lib/ai/report-section-synthesis.ts` — extended candidate with grounded ID arrays + validator + system prompt + schema instruction
- `lib/reports/synthesis-actions.ts` — persists link rows + extended metadata + new `generateAllReportSectionDraftsAction` bulk orchestrator
- `lib/reports/actions.ts` — extended `setSectionStatus` activity metadata with prior status + section type + AI flag + link counts
- `lib/activity/types.ts` — added `ai_report_sections_drafted` to event enum
- `components/activity/activity-timeline.tsx` — label + tone for the new event
- `app/app/engagements/[id]/report/page.tsx` — mounts `GenerateAllReportSectionsButton` + `ProposalReadinessHint`

**Docs (5):**
- `docs/49_REPORT_SECTION_AI_DRAFTING.md` — this file
- `docs/39_CONSULTING_MODULE_COMPLETION_ROADMAP.md` — S8 landing note (sequence unchanged)
- `docs/48_ROADMAP_AI_DRAFTING.md` — § 11 cross-reference noting S8 consumed S7 output
- `docs/46_S4_S6_CONTROLLED_WALKTHROUGH.md` — § 28 closure note
- `docs/08_CURRENT_STATUS.md` — new S8 block at top
- `docs/10_SESSION_HANDOFF.md` — new `Latest` paragraph (S8), demoting S7 to `Prior`

**Throwaway:**
- `artifacts/s8-readiness-smoke.mjs` — gitignored

## 13. Limitations

- **L-20 — Live AI walkthrough deferred to post-commit.** Documented in § 9.3. Operator runs after deploy lands.
- **L-21 — Bulk orchestrator is sequential.** Tradeoffs documented inline in `generateAllReportSectionDraftsAction`. A parallel runner would consume the OpenAI budget faster than the rate limit comfortably allows for 12 sections + the operator gets cleaner per-section run rows.
- **L-22 — Provenance gap on the pre-existing `executive_summary` approved row remains zero links.** The pre-S8 code never wrote links. The operator can either (a) demote the section to `needs_review` and re-draft via the per-section button so S8 writes links, OR (b) manually link via the existing `linkReportSection` action. This is documented but not auto-healed by S8 — touching an already-approved section without the operator's explicit per-section click would violate the operator-blessed boundary.
- **L-23 — `intake` aggregate completion-percent is heuristic.** The context builder derives completion-percent from `stakeholder_intake_sessions.status` rather than counting persisted responses. This is inherited pre-S8 behavior; S8 does not change it. Fine for a model signal but not for an audit gauge.
- **L-24 — `getReportStatusSummary` does NOT use the new readiness helper.** Pre-S8 callers still see the old summary shape. The new `buildProposalReadinessSignal` is only mounted on the report page. Future sprint can migrate other call sites if needed.

## 14. Recommended next sprint

**Sprint S9 — Proposal AI Drafting + Scope Edits + Recommended Option** per `docs/39` § 5. Roadmap sequence unchanged.

S9 entry conditions after S8:

- 5 approved (or final) report sections including the five-section required set.
- `ProposalReadinessHint.readyForS9 === true`.
- The proposal AI prompt can consume the approved report sections as input, plus the upstream chain (`selected` opportunities + `ready` roadmap items + approved findings).
- The existing `proposal_options` scaffold (3 canonical types) is already in place and untouched by S8 (DB-verified zero mutations during this sprint).

## 15. Suggested commit message

```
Add report section AI drafting
```

(Per task spec.)

---

## 16. Follow-on — Post-deploy walkthrough PASS (2026-06-05)

✅ **S8 live-verified end-to-end on deployed Production.** See `docs/50_S8_REPORT_DRAFTING_WALKTHROUGH.md` for the full evidence log.

The deferred live walkthrough from § 9.3 ran successfully on Vercel Production build `slate-os-staging-fxd4ji6bj-…`:

- Bulk drafter triggered: **11/11 succeeded, 0 failed, 1 skipped (pre-existing approved `executive_summary` preserved verbatim)**.
- **100% provenance allowlist enforcement** across 96 link rows: 48 finding links all `approved`, 24 opportunity links all `selected`, 24 roadmap links all `ready`. The 1 deferred opportunity produced **zero** section links.
- **Banned-language scan: 0 hits across all 11 drafts** (the one false positive — "signed contract" in `workflow_friction` — paraphrases the client's own sales-cycle pain, not SLATE producing signature language).
- Operator approved the 4 remaining required sections (opportunity_portfolio, priority_recommendations, roadmap, recommended_next_step) through the deployed UI.
- **`ProposalReadinessHint` transitioned `Not yet` → `Ready for proposal drafting`** at the exact moment the 5th required section was approved.
- Activity metadata sanitized live for all 16 new events: zero raw text, zero PII, zero upstream UUIDs.
- Boundary held: zero proposal/SOW/share-token/upstream mutations during the entire walkthrough window.

Two non-blocker sub-spec drifts documented as L-25 (MCP synthetic-click → React handler limitation; not a source bug) and L-26 (bulk activity event's `sectionTypes` array missing one entry; counts internally consistent).

**S9 prerequisites met. Recommendation unchanged from § 14: Sprint S9 — Proposal AI Drafting + Scope Edits + Recommended Option.**

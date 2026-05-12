# AI Synthesis Steps 3–5 Acceptance Audit

## Status

- **Date:** 2026-05-12
- **Branch:** `persistence/step-0-1-auth-shell`
- **Commit range audited:** `b974df4` (Step 3) · `1c6cd26` (Step 4) · `bed62cf` (Step 5), with shared scaffolding from `208fed1` / `4924e12` / `746d612` / `29aa236` / `dfed4d7`.
- **Outcome:** **Accepted with notes** — operator dev/staging walk-through pending.
- **Scope:** Read-only audit. No source code modified. No schema, API, package dependency, PDF / export, public-scorecard, proposal-delivery, or Benchmark-Gate-1 work performed.

## Executive Summary

The five-step AI synthesis arc is feature-complete:

1. **Step 1 — Findings** (pre-existing) — INSERT, drafts as `needs_review`.
2. **Step 2 — Opportunities** (pre-existing) — INSERT, drafts as `draft`, server derives quadrant + priority from model scores.
3. **Step 3 — Report sections** (this audit) — UPDATE, single section, partial-field, `exhibit_slot` preserved.
4. **Step 4 — Proposal options** (this audit) — UPDATE, single option, partial-field, pricing / recommendation / type / position preserved.
5. **Step 5 — Roadmap items** (this audit) — INSERT, batch, append-only; existing items never modified.

Steps 3–5 share a uniform safety posture: structured JSON prompts; deterministic validators; the shared `lib/ai/claim-guard.ts` (now 26 patterns across **financial / commercial-finality / roadmap-commitment** families); `ai_synthesis_runs` tracking; dedicated `ai_*` activity event types; operator-only UI gated server-side on `isPersisted && isAiConfigured()`. **No client-facing Send / Share / Export / SOW / e-signature path was unlocked.** No schema, migration, API route, or package dependency was introduced by Steps 3–5.

The audit recommends a single live operator walk-through in dev/staging against a real persisted UUID engagement with `OPENAI_API_KEY` configured (test plan below) before moving to **Phase 1B Report Exhibit Wiring Sprint 3 — internal preview PDF** as the next sprint.

## Inventory

### Files present

| Module | Path | Role |
| --- | --- | --- |
| Shared claim guard | `lib/ai/claim-guard.ts` | 26 patterns across 3 families + generic `scanForBannedClaims(fields, rules)` helper |
| Provider helpers | `lib/ai/provider.ts` | `getAiReportSectionProviderConfig` · `getAiProposalOptionProviderConfig` · `getAiRoadmapProviderConfig` (plus `getAiProviderConfig` / `isAiConfigured` from Steps 1–2) |
| Step 3 context | `lib/ai/report-section-context.ts` | Server-only context builder |
| Step 3 synthesis | `lib/ai/report-section-synthesis.ts` | Prompt + validator + financial-claim scan |
| Step 3 action | `lib/reports/synthesis-actions.ts` | `generateReportSectionDraftAction({ engagementId, sectionId })` |
| Step 3 UI | `components/reports/report-section-action-bar.tsx` | "Generate AI draft" button per section |
| Step 4 context | `lib/ai/proposal-option-context.ts` | Server-only context builder |
| Step 4 synthesis | `lib/ai/proposal-option-synthesis.ts` | Prompt + validator + (financial + commercial-finality) scan |
| Step 4 action | `lib/proposals/synthesis-actions.ts` | `generateProposalOptionDraftAction({ engagementId, optionId })` |
| Step 4 UI | `components/proposals/proposal-option-action-bar.tsx` | "Generate AI draft" button per option |
| Step 5 context | `lib/ai/roadmap-context.ts` | Server-only context builder (engagement-wide) |
| Step 5 synthesis | `lib/ai/roadmap-synthesis.ts` | Prompt + validator + dedup + (financial + commercial-finality + roadmap-commitment) scan |
| Step 5 action | `lib/roadmap/synthesis-actions.ts` | `generateRoadmapDraftAction({ engagementId })` — append-only batch |
| Step 5 UI | `components/roadmap/generate-roadmap-draft-button.tsx` | Engagement-level "Generate AI roadmap draft" |

### Claim guard pattern families (verified)

`scanForBannedClaims` is imported and exercised by all three Step-3/4/5 synthesis modules (`Grep` over `lib/ai/`):

- `lib/ai/report-section-synthesis.ts` — `FINANCIAL_CLAIM_PATTERNS` (14)
- `lib/ai/proposal-option-synthesis.ts` — `FINANCIAL_CLAIM_PATTERNS` (14) + `COMMERCIAL_FINALITY_PATTERNS` (6) = 20
- `lib/ai/roadmap-synthesis.ts` — `FINANCIAL_CLAIM_PATTERNS` (14) + `COMMERCIAL_FINALITY_PATTERNS` (6) + `ROADMAP_COMMITMENT_PATTERNS` (6) = 26

### Activity event types (verified)

`Grep` over `lib/*/synthesis-actions.ts` for `eventType: "ai_*"`:

- `ai_findings_generated` (Step 1) · `ai_opportunities_generated` (Step 2)
- `ai_report_section_drafted` (Step 3) — emitted from `lib/reports/synthesis-actions.ts:274`
- `ai_proposal_option_drafted` (Step 4) — emitted from `lib/proposals/synthesis-actions.ts:266`
- `ai_roadmap_items_drafted` (Step 5) — emitted from `lib/roadmap/synthesis-actions.ts:295`
- `ai_synthesis_failed` — emitted by every step on failure
- Step 5 additionally emits per-item `roadmap_item_created` (line 244) so the engagement timeline records each appended item (consistent with `lib/roadmap/actions.ts#createRoadmapItem`).

### `ai_synthesis_runs.run_type` values (verified)

- `findings_draft` (Step 1) · `opportunity_draft` (Step 2) · `report_section_draft` (Step 3) · `proposal_option_draft` (Step 4) · `roadmap_draft` (Step 5).

### What is *not* present (verified absent)

- No PDF / export route, action, or component added by Steps 3–5.
- No new API route under `app/api/`.
- No new schema migration (`supabase/migrations/` last file is still `0012_report_section_exhibit_slot.sql`).
- No `package.json` / `package-lock.json` change.
- No public-scorecard change.
- No `LockedActionButton` was unlocked; all four locked CTAs remain locked (`Export Report`, `Prepare Report`, `Prepare SOW Draft`, `Send to Client` — `Grep` over `*.tsx` for `LockedActionButton`).
- No Group-B exhibit (`BenchmarkComparisonBars`, `AISavingsWaterfall`, `RoiBridge`) is imported outside `app/app/charts-preview/page.tsx` and the three exhibit source files themselves.

## UI Gating Findings

| Surface | Server-side gate | Client-side render | Final-state guard |
| --- | --- | --- | --- |
| Report section AI button | `isAiConfigured()` evaluated in `report/page.tsx` and passed as `aiAvailable` (server prop) | Button only renders when `engagementId && aiAvailable` (both falsy → not in DOM) | Disabled when `section.status === "final"` (`report-section-action-bar.tsx:110`) AND action returns `section-is-final` if invoked (`report-section-context.ts:264` + `synthesis-actions.ts:132–133`) |
| Proposal option AI button | `isAiConfigured()` evaluated in `proposal/page.tsx` and passed as `aiAvailable` | Same render gate as report | No "final" status on options — but the option's `recommended`, `option_type`, `position`, `pricing_placeholder` are NOT in the writeable column list, so they cannot be modified by the action (see Persistence Safety below) |
| Roadmap engagement button | Page-level gate: `{isPersisted && isAiConfigured() ? <GenerateRoadmapDraftButton ... /> : null}` (`roadmap/page.tsx:194`) | Not rendered at all when either is false | N/A — engagement-level action; action is append-only and cannot modify existing items |

### Mock / legacy slug engagements

All three pages branch on `loaded.kind === "real"` (i.e. `isPersisted`). Both Step 3 and Step 4 only pass `engagementId` + `aiAvailable` when `isPersisted` is true; Step 5's button is wrapped in the same gate. **Mock paths never see the button.** Even if a mock engagement somehow reached an action, the action's first guard is `if (!isUuid(engagementId))` → returns `invalid-engagement`.

### Missing `OPENAI_API_KEY`

`isAiConfigured()` returns false → server prop / page gate evaluates false → button is not in the DOM. If the action is invoked anyway (e.g. via a malformed request), it short-circuits with `ai-not-configured` at line 87 (Step 3), line 95 (Step 4), line 89 (Step 5).

## Persistence Safety Findings

### Step 3 — Report sections

`lib/reports/synthesis-actions.ts:211–224` issues exactly one UPDATE with these columns:

```ts
.from("report_sections").update({
  title, summary, draft_preview, evidence_notes,
  ai_drafted, status: "needs_review",
  reviewed_by, last_reviewed_at,
}).eq("id", sectionId)
```

**Verified preserved (not in column list):** `exhibit_slot`, `position`, `report_id`, `engagement_id`, `workspace_id`, `section_type`, `reviewer_note`, `confidence`, `assumption_*`, `created_at`, the three `report_section_*_links` tables. Status is always demoted to `needs_review` — never `approved` / `final`.

### Step 4 — Proposal options

`lib/proposals/synthesis-actions.ts:198–209` issues exactly one UPDATE with these columns:

```ts
.from("proposal_options").update({
  title, best_fit_scenario, scope_summary, timeline,
  deliverables, assumptions, dependencies, risks,
}).eq("id", optionId)
```

**Verified preserved (not in column list):** `pricing_placeholder`, `recommended`, `option_type`, `position`, `confidence`, `proposal_id`, `engagement_id`, `workspace_id`, link rows. The entire `proposals` row is **never written** — credit copy, status, export_status, recommended_option_id all preserved.

### Step 5 — Roadmap items

`lib/roadmap/synthesis-actions.ts:194–212` issues only INSERTs. Per item:

```ts
.from("roadmap_items").insert({
  workspace_id, engagement_id, opportunity_id: candidate.linkedOpportunityId,
  phase, title, objective, priority,
  key_actions, dependencies, success_criteria, risks,
  owner_placeholder: null, readiness_note: null,
  position: nextPositionForPhase, status: "planned",
})
```

**Verified properties of the write path:**

- INSERT-only — no UPDATE or DELETE statement against `roadmap_items` exists in `synthesis-actions.ts`.
- New items always land at `status='planned'` (string literal, no model influence).
- `position` is computed by `buildPositionMap(existingRoadmap)` + per-insert increment → **deterministic append per phase**.
- Duplicate-title filter runs twice: synthesizer drops candidates whose title matches an existing item (case + whitespace normalized) at validation time; the action re-checks at insert time with `existingTitleKeys` set; `skippedDuplicateCount` is reported.
- `linkedOpportunityId` is bounded by the synthesizer to UUIDs present in the supplied `opportunities` array (otherwise null).

## Prompt Context Safety Findings

All three context builders (`lib/ai/report-section-context.ts`, `lib/ai/proposal-option-context.ts`, `lib/ai/roadmap-context.ts`) follow the same posture established in Steps 1 / 2:

### Excluded from prompt payload

- Stakeholder PII (name, email, title) — intake aggregates only.
- Raw stakeholder answer text — `stakeholder_responses.answer_text` never queried.
- Uploaded file binaries — `input_assets` not queried; no signed-URL generation.
- Internal Saipien Fit Score — `leads.fit_score` not queried.
- Unapproved draft findings — all three builders filter with `.in("review_status", ["approved", "report_ready"])`.
- Rejected opportunities — Steps 4–5 filter with `.in("status", ["scored", "selected"])`.
- Group-B benchmark / financial exhibit data — no benchmark dataset or financial assumption set is queried.
- Generated pricing — pricing fields are surfaced only as **read-only context** in Step 4 and Step 5 (e.g. `proposal_options.pricing_placeholder`); the prompts explicitly forbid generating new pricing.

### Included (operator-reviewed or aggregate)

- `engagement` + `accounts` metadata.
- Approved / report-ready findings.
- Scored / selected opportunities + their finding-link UUIDs.
- Roadmap items (Step 4 + Step 5).
- Report sections in `drafted` / `needs_review` / `approved` / `final` (Step 4 + Step 5).
- Proposal options scope/timeline (Step 5).
- Intake-session aggregates (Step 3 — role / status / response-quality / derived completion percent).

## Claim Guard Findings

`lib/ai/claim-guard.ts` exports:

- **`FINANCIAL_CLAIM_PATTERNS`** (14):
  - `guaranteed_roi`, `guaranteed_savings`, `payback`, `break_even`, `cash_flow_positive`, `will_save`, `will_reduce_cost`, `top_quartile`, `above_average`, `industry_benchmark`, `peer_benchmark`, `finance_approved`, `board_ready_roi`, `guaranteed_financial` (catch-all for `guaranteed (return|savings|payback|cost|reduction)`)
- **`COMMERCIAL_FINALITY_PATTERNS`** (6):
  - `ready_for_signature`, `approved_by_finance`, `final_commercial_terms`, `binding_quote`, `binding_offer`, `executed_sow`
- **`ROADMAP_COMMITMENT_PATTERNS`** (6):
  - `guaranteed_completion`, `binding_timeline`, `final_implementation_schedule`, `committed_delivery_date`, `legally_binding_timeline`, `binding_delivery_commitment`
- Generic helper `scanForBannedClaims(fields, rules)` — case-insensitive, ignores empty/null entries, returns `{field, code}[]`.

### Per-step combination (verified)

| Step | Pattern families applied | Total patterns |
| --- | --- | --- |
| 3 (report sections) | financial | 14 |
| 4 (proposal options) | financial + commercial-finality | 20 |
| 5 (roadmap items) | financial + commercial-finality + roadmap-commitment | 26 |

### Pre-persistence enforcement (verified)

Each `synthesizeXxxDraft()` runs the validator and the scanner **before returning ok=true** to the action. If violations exist:

- Action receives `{ ok: false, error: "ai-claim-violation" }`.
- `ai_synthesis_runs` row updated to `status='failed'` with the violation field:code pairs in `error_message` (via `markRunFailed`).
- **No DB write** to the target content row.
- UI surfaces the canon-mandated message: "AI draft was rejected because it included gated benchmark / financial [/ commercial-finality / delivery-commitment] language."

## AI Run + Activity Findings

| Step | `ai_synthesis_runs.run_type` | Success activity event | Failure activity event | Per-item event? |
| --- | --- | --- | --- | --- |
| 3 | `report_section_draft` | `ai_report_section_drafted` | `ai_synthesis_failed` | n/a (one section) |
| 4 | `proposal_option_draft` | `ai_proposal_option_drafted` | `ai_synthesis_failed` | n/a (one option) |
| 5 | `roadmap_draft` | `ai_roadmap_items_drafted` (batch summary) | `ai_synthesis_failed` | yes — per-item `roadmap_item_created` event for each successful INSERT |

### Storage safety (verified)

- `input_summary` carries row counts + optionId/sectionId/runType only — no prompt body, no stakeholder text, no file metadata.
- `output_summary` carries provider + model + counts + (Step 5) `insertedItemIds` — no raw model output.
- `error_code` + `error_message` are bounded to controlled enum codes / `:`-joined violation pairs.

### Activity timeline rendering (verified)

`lib/activity/types.ts` lists all four `ai_*` event types. `components/activity/activity-timeline.tsx` provides tone (`ai`) + label entries for all four.

## Build / Bundle Verification

### Lint

`npm run lint` — **clean** (no ESLint warnings or errors). Verified during this audit session.

### Build

`NEXT_TELEMETRY_DISABLED=1 npm run build` — **transient environmental failure during this audit run**. Multiple consecutive runs failed at the `next/font` Google-Fonts fetch step with `SSL alert 49 (access-denied)` against `fonts.gstatic.com`. This is a network-environment issue (TLS-level rate limiting at the gstatic CDN edge), not a code defect.

**Reference: identical source tree built clean less than 24 hours earlier in the same session.** Step 5 (commit `bed62cf`, the audited HEAD) produced these route sizes:

| Route | Size | First Load JS |
| --- | --- | --- |
| `/` | 150 B | 87.4 kB |
| `/app` | 150 B | 87.4 kB |
| `/app/charts-preview` | 150 B | 87.4 kB |
| `/app/engagements/[id]/chart-diagnostics` | 175 B | 96.1 kB |
| `/app/engagements/[id]/findings` | 10.8 kB | 114 kB |
| `/app/engagements/[id]/intake` | 6.94 kB | 110 kB |
| `/app/engagements/[id]/opportunities` | 11.6 kB | 115 kB |
| `/app/engagements/[id]/proposal` | 6.53 kB | 110 kB |
| `/app/engagements/[id]/report` | 7.5 kB | 111 kB |
| `/app/engagements/[id]/roadmap` | 5.91 kB | 109 kB |
| `/scorecard/results` | 10.7 kB | 119 kB |

Route count: **27** (matches expected baseline). Per-page deltas vs. pre-AI baselines:

- `/app/engagements/[id]/report`: `6.89 kB / 110 kB` → `7.5 kB / 111 kB` (+0.6 kB / +1 kB) — Step 3 client-side trigger.
- `/app/engagements/[id]/proposal`: `5.94 kB / 109 kB` → `6.53 kB / 110 kB` (+0.6 kB / +1 kB) — Step 4 client-side trigger.
- `/app/engagements/[id]/roadmap`: `4.91 kB / 108 kB` → `5.91 kB / 109 kB` (+1 kB / +1 kB) — Step 5 client-side trigger.

**Note (Build):** Operator should re-run `npm run build` on a normal network during the dev/staging walk-through; result is expected to match the table above. If the SSL alert 49 persists on operator workstations, it points to an outbound-egress policy that needs an exception for `fonts.gstatic.com` (Next.js downloads font files at build time when `next/font/google` is used).

## Source Audit

### `git status --short`

```
?? .claude/
?? artifacts/
```
(both local-only, gitignored — no working-tree drift introduced by this audit before docs are touched.)

### Protected-path verification

`git status --short` over the protected paths returns empty for everything outside `lib/ai/`, `lib/reports/`, `lib/proposals/`, `lib/roadmap/`, `components/reports/`, `components/proposals/`, `components/roadmap/`, `app/app/engagements/[id]/{report,proposal,roadmap}/`, `lib/activity/`, `components/activity/`, `docs/08`, `docs/10`. No new file under `supabase/migrations/`, `app/api/`, `app/scorecard/`, or at `package.json` / `package-lock.json` / `middleware.ts`.

### Group-B exhibits

`Grep` for `BenchmarkComparisonBars|AISavingsWaterfall|RoiBridge` over `**/*.{ts,tsx}` returns exactly 4 files:

```
app/app/charts-preview/page.tsx
components/charts/exhibits/roi-bridge.tsx
components/charts/exhibits/ai-savings-waterfall.tsx
components/charts/exhibits/benchmark-comparison-bars.tsx
```

The preview page is the only consumer; the other three are the exhibit components themselves. **No Group-B exhibit is imported by any report / proposal / roadmap / synthesis surface.**

### `LockedActionButton` instances

`Grep` finds 4 active labels: `Export Report` (report page), `Prepare Report` (roadmap page when no items), `Prepare SOW Draft` (proposal workspace), `Send to Client` (proposal workspace). **All four remain locked.** No instance was removed or replaced with an active CTA.

### Send / share / export

No new server action, API route, or button labeled "Send", "Share", "Export", or "SOW" was added by Steps 3–5. The phrase "send" appears in proposal-workspace explanatory copy ("…send, and signature stay locked behind a later commercial sprint."), in operator-facing UI strings explaining that synthesis output requires operator review, and in the `Send to Client` LockedActionButton — all of which are correct.

## Operator Test Plan

To be run in dev/staging against a persisted UUID engagement with `OPENAI_API_KEY` configured.

### Setup (one-time)

1. Sign in as an operator to a SLATE instance pointed at a real Supabase project.
2. Pick (or create) a persisted UUID engagement with:
   - ≥ 5 approved / report-ready findings,
   - ≥ 5 scored / selected opportunities,
   - ≥ 2 existing roadmap items,
   - An initialized report (`Initialize report outline` already run, so 12 sections exist),
   - An initialized proposal (3 seeded options).
3. Confirm `process.env.OPENAI_API_KEY` is set on the server. `Generate AI draft` buttons should be visible on `/app/engagements/[id]/{report,proposal,roadmap}`.

### Report section drafting (Step 3)

| # | Test | Setup | Action | Expected UI | Expected DB write | `ai_synthesis_runs` | Activity | Cleanup |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 3-A | Persisted, AI configured, editable section | Section with `status='needs_review'` or `'drafted'` | Click `Generate AI draft` | Success toast: "AI draft generated (openai · gpt-4o-mini). Section moved to needs-review for operator approval." | `summary`, `draft_preview`, `evidence_notes`, `ai_drafted=true`, `status='needs_review'`, `reviewed_by`, `last_reviewed_at` updated. `exhibit_slot`, link rows, `reviewer_note` preserved. | Row with `run_type='report_section_draft'`, `status='completed'` | `ai_report_section_drafted` event | Operator can revert via "Needs review" / "Mark drafted" / approve. |
| 3-B | Final section | Section with `status='final'` | Click `Generate AI draft` | Button is **disabled** (tooltip: "Final sections cannot be redrafted — demote first."). If somehow invoked, error: "This section is locked as final. Demote it before regenerating." | No write. | No run row inserted (context builder rejects with `section-is-final` before the run insert). | None. | n/a |
| 3-C | Missing `OPENAI_API_KEY` | Unset the env var server-side; restart dev. | Reload report page | Button is **not in the DOM**. If action invoked directly, `ai-not-configured` error. | No write. | No row. | None. | Restore env var. |
| 3-D | Mock / legacy slug | Visit `/app/engagements/atlas-aios-q2/report` | Inspect action bar | Button **not in DOM** (page does not pass `engagementId` to the action bar for mock loads). | No write. | No row. | None. | n/a |
| 3-E | Banned-claim model output | Hard to inject without mocking the OpenAI call. Skip unless the team has a local stub. | n/a | Validator would reject with `ai-claim-violation`. | No write. | Row marked `failed` with field:code pairs in `error_message`. | `ai_synthesis_failed` event. | n/a |

### Proposal option drafting (Step 4)

| # | Test | Setup | Action | Expected UI | Expected DB write | `ai_synthesis_runs` | Activity | Cleanup |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 4-A | Persisted, AI configured, option with strong evidence | Any of the 3 seeded options | Click `Generate AI draft` on the option | Success toast naming provider/model + "Pricing, recommendation, and option type were preserved. Operator review required before any client-facing action." | `title`, `best_fit_scenario`, `scope_summary`, `timeline`, `deliverables[]`, `assumptions[]`, `dependencies[]`, `risks[]` updated. **Confirm** `pricing_placeholder`, `recommended`, `option_type`, `position`, `confidence`, link rows unchanged. | Row with `run_type='proposal_option_draft'`, `status='completed'` | `ai_proposal_option_drafted` | Operator can re-run; no auto-finalization. |
| 4-B | Recommended option | The "AI Workflow System" option (pre-recommended by seed) | Generate AI draft on that option | `recommended` badge **remains** "Recommended". `proposals.recommended_option_id` unchanged. | Same field set as 4-A. | Same. | Same. | n/a |
| 4-C | Pricing placeholder preservation | Note the option's `pricing_placeholder` before generation. | Generate AI draft | `pricing_placeholder` value matches pre-generation byte-for-byte. UI continues to show the placeholder string. | n/a. | n/a. | n/a. | n/a |
| 4-D | Missing `OPENAI_API_KEY` | Unset env var. | Reload proposal page | AI button not in DOM. | No write. | No row. | None. | Restore. |
| 4-E | Mock / legacy slug | `/app/engagements/atlas-aios-q2/proposal` | Inspect option action bar | Button not in DOM. | No write. | No row. | None. | n/a |
| 4-F | Banned commercial-finality output | Requires model stub. | n/a | Validator rejects with `ai-claim-violation`. Toast: "AI draft was rejected because it included gated benchmark, financial, or commercial-finality language." | No write. | `failed`. | `ai_synthesis_failed`. | n/a |

### Roadmap drafting (Step 5)

| # | Test | Setup | Action | Expected UI | Expected DB write | `ai_synthesis_runs` | Activity | Cleanup |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 5-A | Engagement with strong evidence/opportunities | ≥ 5 selected opportunities, no fewer than 2 existing items | Click `Generate AI roadmap draft` | Success toast: "AI drafted N planned roadmap items (provider · model). Existing items were not modified." | 2–6 new rows in `roadmap_items` with `status='planned'`, `position` appending per phase. Existing items byte-identical pre/post. | Row with `run_type='roadmap_draft'`, `status='completed'`, `output_summary.insertedItemIds[]` populated. | One `roadmap_item_created` event per insert + one `ai_roadmap_items_drafted` batch event. | Delete via the existing `removeRoadmapItem` action if not wanted. |
| 5-B | Existing roadmap items present | Same as 5-A | Generate AI draft | Existing items unchanged (positions, statuses, owners, links all preserved). New items appear at the bottom of their phase columns. | Existing rows untouched (verify via `id`+`updated_at` snapshot pre/post). | Same. | Same. | n/a |
| 5-C | Duplicate title output | After 5-A runs, click `Generate AI roadmap draft` again | Generate AI draft | Success toast notes `skippedDuplicateCount > 0` if the model proposed duplicates. The synthesizer + action both dedup against the now-current title set. | Only genuinely new titles insert. | Same. | Same. | n/a |
| 5-D | Insufficient evidence | A near-empty engagement (e.g. 0 approved findings, 0 selected opportunities) | Generate AI draft | Error toast: "AI returned no valid roadmap items and the response was discarded." | No write. | Row `failed` with `error_code='no-items-persisted'` or `error_message` describing validation failure. | `ai_synthesis_failed`. | n/a |
| 5-E | Missing `OPENAI_API_KEY` | Unset env var. | Reload roadmap page | Button not in DOM. | No write. | No row. | None. | Restore. |
| 5-F | Mock / legacy slug | `/app/engagements/atlas-aios-q2/roadmap` | Inspect roadmap page | Button not in DOM. | No write. | No row. | None. | n/a |
| 5-G | Banned delivery-commitment output | Requires model stub. | n/a | Validator rejects with `ai-claim-violation`. Toast: "AI draft was rejected because it included gated benchmark, financial, commercial-finality, or delivery-commitment language." | No write. | `failed` with `error_message` listing field:code pairs (e.g. `items[2].objective:guaranteed_completion`). | `ai_synthesis_failed`. | n/a |

### Aggregate observations to capture

After running 3-A, 4-A, 5-A in sequence on a single engagement:

- `ai_synthesis_runs` should contain exactly three new rows (`status='completed'`), one per run_type.
- The engagement timeline (`/app/engagements/[id]`) should show: N `roadmap_item_created` events + 1 `ai_roadmap_items_drafted` + 1 `ai_proposal_option_drafted` + 1 `ai_report_section_drafted`.
- No new `proposal_status_changed`, `report_section_status_changed` (other than the demotion to `needs_review` from 3-A), or any `*_finalized` event.

## Known Notes / Risks

1. **Build cache fetched fonts**: build succeeded during Step 5 implementation; failed during this audit run with `SSL alert 49` against `fonts.gstatic.com`. The environment, not the code, is the cause. Operators should plan for occasional `next/font` fetch retries on builds run from constrained networks.
2. **Banned-claim coverage is regex-based**, not semantic. A creative model rewording (e.g. "warranted ROI" instead of "guaranteed ROI") could slip through. The current 26-pattern list catches the canonical canon-prohibited language and is deliberately conservative; expansion is straightforward (`lib/ai/claim-guard.ts` is a single source of truth). Operator review remains the safety net.
3. **Report-section Capability Maturity / Stakeholder Coverage adapters still return `insufficient_data` against current persisted data** because of the upstream tagging/topic-taxonomy gap noted in `docs/16` § Polish Backlog. Step 3 drafting on the corresponding sections will succeed (the action does not depend on the exhibit adapter), but the exhibit panels in `<ReportExhibitSlots>` continue to show the canon-mandated fallback cards. This is the honest, documented state.
4. **Roadmap synthesizer cannot reorder existing items.** If an operator wants AI to re-sequence the entire roadmap, they must delete-and-regenerate; Step 5 is deliberately scoped append-only. This is the right safety posture for Phase 1B; revisit only if the canon explicitly authorizes a reorder action.
5. **No live operator walk-through has been performed**. Acceptance is contingent on the test plan above being run in dev/staging.

## Acceptance Decision

**Accepted with notes.**

Steps 3–5 ship with a uniform, defensible safety posture: structured JSON prompts, deterministic validators, a shared 26-pattern banned-claim scanner, run-row tracking, dedicated activity events, operator-only UI gated server-side, and persistence boundaries that preserve every commercial / structural / lifecycle field the operator owns. The current code base satisfies every audit question that can be answered by static inspection, lint, and git history.

The single open question — does the live `OPENAI_API_KEY`-configured path actually produce review-quality drafts and reject canon-prohibited language — is testable only by running the operator test plan above. That test plan is included in this document so the walk-through can happen against the documented expected behaviors row-by-row.

## Recommended Next Sprint

**Phase 1B Report Exhibit Wiring Sprint 3 — internal preview PDF.** Rationale:

- Steps 3–5 are feature-complete and audited; the next gap in the consulting-grade deliverable engine is **vector PDF output of the operator-only report preview** so the existing five Group-A slots (and the AI drafts now flowing into them) can be rasterized for review-quality print.
- It is operator-only by design — no client-facing send / share / SOW / e-signature would be unlocked.
- Group B (Benchmark / Waterfall / ROI Bridge) remains preview-only until `docs/14` / `docs/15` advance their data gates; Sprint 3 keeps that boundary intact.
- The alternative — Benchmark Data Canon Gate 1 advancement — depends on operator-supplied benchmark data and a dedicated sprint of its own; it should not block the PDF path.

Recommended order: complete the dev/staging walk-through against this audit's test plan → land Sprint 3 (internal PDF) → then schedule Benchmark Gate 1 or AI Synthesis Step 6 (if a gap emerges from operator review of Steps 3–5).

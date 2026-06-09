# docs/54 — Sprint S10: Internal SOW Draft Validation

> **Status:** ✅ **PASS.** Sprint S10 end-to-end live-verified on deployed Production. The pre-S10 SOW Draft scaffold (P6-A/B/C) ran cleanly against the controlled fixture: approved proposal snapshot → SOW Draft snapshot, 71-pattern commercial guard scanned with 0 violations, draft persisted as internal-only with operator-review-gated approval state, full operator UI lifecycle (Open / Void) confirmed live, **`Send to Client` LOCKED, share link DISABLED, no public SOW route, no public SOW link minted**.
> **Branch / commit:** `staging` / `0e998f4` — Align SOW readiness with approved proposal snapshot.
> **Deployed Production build:** `slate-os-staging-2hr07mtdt-…`, canonical alias `slate-os-staging.vercel.app`.
> **Fixture:** SLATE Pilot Test Client · engagement `ed7f1f7d-b3fa-46c3-9d48-7b211d2c48b4`.

## 1. Sprint context

Sprint S10 is a **validation sprint** — the SOW Draft scaffold already exists from Phase 1B Sprints P6-A (eligibility canon docs/26), P6-B (action + 70-pattern guard), and P6-C (PastSowDraftsPanel + Generate SOW Draft button + internal SOW Draft renderer). S10 exercises that scaffold against the now-complete S8 → S9 → S9-Fix chain to confirm the canonical S9 → S10 handoff works end-to-end on the controlled fixture.

This sprint did NOT introduce new features. No source touch. No migration. No package change. No new UI affordance. The work is observational + documentary.

## 2. SOW scaffold inventory

| Surface | File / location | Status |
|---|---|---|
| Server action | `lib/proposals/sow-draft-actions.ts` | Pre-existing (P6-B) |
| Eligibility evaluator | `lib/proposals/sow-draft-eligibility.ts` (15-condition) | Pre-existing (P6-B) |
| 70-pattern commercial guard | `lib/proposals/commercial-guard.ts` § SOW_DRAFT_FINALITY_PATTERNS + `runSowDraftCommercialGuard` | Pre-existing (P6-B) |
| Past SOW Drafts panel | `components/proposals/past-sow-drafts-panel.tsx` | Pre-existing (P6-C) |
| Generate SOW Draft button | `components/proposals/generate-sow-draft-button.tsx` | Pre-existing (P6-C) |
| Internal SOW Draft renderer | `components/proposals/sow-draft-document.tsx` + route `app/app/engagements/[id]/proposal/sow/[snapshotId]/` | Pre-existing (P6-C) |
| Void SOW Draft button | `components/proposals/void-sow-draft-button.tsx` | Pre-existing (P6-C) |
| Storage | `proposal_delivery_snapshots` table with `delivery_surface='sow_draft_candidate'` | Migration 0013 (snapshot-based) |
| Activity events | `sow_draft_generated`, `sow_draft_failed`, `sow_draft_voided` | Pre-existing |
| SOW Draft jsonb fields (canon `docs/26`) | `source_context_snapshot.sowDraft` — `scopeStatement`, `deliverables[]`, `exclusions[]`, `assumptions[]`, `dependencies[]`, `proposedTimeline`, `responsibilities{client[],operator[]}`, `openQuestions[]`, `pricingNotice`, `legalBoundaryNotice` | Pre-existing |
| Disclaimers | `LEGAL_BOUNDARY_NOTICE` (canon-curated) + pricing notice (canon-curated) | Pre-existing |
| Lock for `Send to Client` | `LockedActionButton label="Send to Client"` on SOW row | Pre-existing |
| Public SOW route | **NONE** (`/s/[token]` deliberately absent per docs/28) | Pre-existing |

Storage model: **snapshot-based**, not row-based. SOW Drafts share the `proposal_delivery_snapshots` table with proposal candidates, distinguished by `delivery_surface`. Lifecycle states: `status` ∈ `{candidate, voided}`; `approval_state` ∈ `{unreviewed, approved, revoked}`; `draft_watermark` boolean. Pre-existing voided test snapshot from before S10: 1; pre-existing non-voided SOW drafts: **0** — clean preflight.

## 3. Eligibility evaluator result

The pre-S10 `evaluateSowDraftEligibility` (15-condition) gates on:

| Condition | Source field | Result for our fixture |
|---|---|---|
| Engagement persisted | input | ✅ |
| Source snapshot present | input | ✅ (`bcffa4cd-…`) |
| Source snapshot not voided | `src.status !== 'voided'` | ✅ |
| Source surface = `client_proposal_candidate` | `src.deliverySurface` | ✅ |
| Source `approval_state === 'approved'` | `src.approvalState` | ✅ |
| Source commercial guard passed (proposal-side 45-pattern) | `src.commercialGuardResult.passed` | ✅ |
| Source has at least one included option | `optionSnapshot[].includedInArtifact` | ✅ (3 options) |
| Operator selection valid against source | `resolvedIncludedOptionIds` | ✅ (1 selected via recommended fallback) |
| Group-B omission entry present | `src.omittedContent[]` | ✅ |
| SOW guard ran | `input.commercialGuardResult` | ✅ |
| SOW guard `passed === true` | `input.commercialGuardResult.passed` | ✅ |
| Pricing review state ∈ canonical set | `src.pricingReviewState` | ✅ (`placeholder` → warning, not blocker) |
| Implementation credit handling | warning | ✅ (informational) |
| Reviewer notes excluded by canon | warning | ✅ (informational) |
| Public SOW route not authorized | warning | ✅ (informational — Sprint P7-A would change this; not in S10 scope) |

The 4 `warning`-severity reasons are informational only — they do NOT block eligibility per canon (`docs/26` § SOW Eligibility Rules: only `error`-severity blocks).

**Verdict: eligible.** Action proceeded to insert the SOW Draft snapshot.

## 4. Internal SOW draft generation result

Live walkthrough on deployed Production:

| Step | Result |
|---|---|
| Operator clicked `Generate SOW Draft` (JS-dispatched via Chrome MCP — L-25 carryover) | ✅ |
| Server action `generateSowDraftCandidateAction` invoked | ✅ |
| Source snapshot resolved (`bcffa4cd-…`) | ✅ |
| 7 defense-gate checks (engagement match, voided, wrong-surface, not-approved, proposal-mismatch, …) | All passed ✅ |
| Included options resolved via recommended fallback | 1 included (`ai_workflow_system`), 2 omitted (`quick_win_build`, `managed_ai_partner`) |
| SOW Draft jsonb built (`buildSowDraftFromSource`) | ✅ |
| `runSowDraftCommercialGuard` ran | ✅ |
| Guard verdict | **`passed=true`** ✅ |
| Patterns scanned | **71** (financial 14 + commercial-finality 6 + roadmap-commitment 6 + proposal-finality 18 + sow-draft-finality 27 = canonical full SOW pattern set) |
| Pattern families applied | `[financial, commercial-finality, roadmap-commitment, proposal-finality, sow-draft-finality]` ✅ |
| Violations | **0** ✅ |
| `evaluateSowDraftEligibility` verdict | **eligible** ✅ |
| Snapshot row inserted | ✅ |
| Snapshot ID | **`f6ed1fe5-c6e2-4a5c-a29e-5fbad6ab0574`** |
| `status` | `candidate` ✅ |
| `delivery_surface` | `sow_draft_candidate` ✅ |
| `approval_state` | `unreviewed` ✅ (operator-review-gated) |
| `draft_watermark` | `true` ✅ |
| `pricing_review_state` | `placeholder` ✅ (pricing hidden) |
| `proposal_status_at_generation` | `draft` ✅ (captures the proposal row's status — verifies that the S9-Fix is enabling the snapshot-based gate; without S9-Fix the operator-facing `SowReadinessHint` would have stayed on "Not yet" and the canonical eligibility evaluator would have refused to run) |
| `voided_at` | `null` ✅ |
| `selected_option_ids` | 1 (recommended `ai_workflow_system`) |
| `option_snapshot[]` length | 3 (all 3 options captured; only 1 with `includedInArtifact=true`) |

SOW Draft jsonb content (verified via SQL):

| Field | Value |
|---|---|
| `scopeStatement` | Present (from recommended option's scope_summary) |
| `deliverables[]` | 6 entries (deduped from included options) |
| `assumptions[]` | 3 entries |
| `dependencies[]` | 3 entries |
| `exclusions[]` | Empty (canon default; operator fills via future SOW editor) |
| `proposedTimeline` | Present (from recommended option's timeline) |
| `responsibilities.{client,operator}[]` | Empty (canon default) |
| `openQuestions[]` | Empty (canon default) |
| `pricingNotice` | **"Pricing is pending manual review and is intentionally omitted from this draft."** (canon-curated, byte-identical to `PRICING_NOTICE_PLACEHOLDER`) |
| `legalBoundaryNotice` | **"Legal terms are intentionally omitted from this draft. Any legal terms will be provided separately during execution review."** (canon-curated, byte-identical to `LEGAL_BOUNDARY_NOTICE`) |

No binding legal terms. No final pricing. No invoice/payment terms. No e-signature copy. No client delivery action.

## 5. Operator UI result

| Surface | Result |
|---|---|
| `SowReadinessHint` badge | **`Ready for SOW Draft`** ✅ (S9-Fix verified live — flipped from `Not yet`) |
| `Generate SOW Draft` button | Visible + enabled ✅ |
| `Past SOW Drafts` panel | Visible ✅ |
| New SOW Draft row visible in panel | ✅ `f6ed1fe5-…`, marked `Unreviewed` + `Draft watermark` |
| `Open SOW Draft` button on new row | ✅ (operator-internal preview at `/app/engagements/[id]/proposal/sow/[snapshotId]`) |
| `Void` button on new row | ✅ (operator-internal) |
| `Send to Client` button for SOW | **LOCKED** ✅ (`LockedActionButton`, canon-required) |
| Generate share link button for SOW | **NOT PRESENT** ✅ — "Share disabled" badge confirms canon |
| Public SOW route `/s/[token]` | **NOT PRESENT** ✅ |
| Past voided SOW (from prior tests) | Preserved with `Voided` status — historical visibility intact |

## 6. Activity metadata safety result

The lone `sow_draft_generated` event fired during the walkthrough window:

```json
{
  "proposalId": "2e80e41b-d83d-4cf4-9bfd-a6db2cbbfd27",
  "approvalState": "unreviewed",
  "draftWatermark": true,
  "deliverySurface": "sow_draft_candidate",
  "omittedOptionCount": 2,
  "pricingReviewState": "placeholder",
  "includedOptionCount": 1,
  "sourceProposalSnapshotId": "bcffa4cd-3e19-4086-b086-c5d4976b3157"
}
```

| Field | Sensitive? |
|---|---|
| `proposalId` | UUID-only audit anchor — canon-allowed |
| `approvalState` | Canonical enum, no PII |
| `draftWatermark` | Boolean |
| `deliverySurface` | Canonical enum |
| `omittedOptionCount` | Count |
| `pricingReviewState` | Canonical enum (no pricing math) |
| `includedOptionCount` | Count |
| `sourceProposalSnapshotId` | UUID-only audit anchor — canon-allowed for traceability |

**Zero raw SOW body, zero option text, zero report section text, zero stakeholder emails, zero transcript text, zero Attio payload, zero pricing math, zero violation phrase text.** The 2 UUIDs (proposal + source snapshot) are explicit canonical audit anchors required for tracing.

## 7. Boundary confirmation

| Boundary | Result |
|---|---|
| `/p` mint | **0** ✅ |
| `/r` mint | **0** ✅ |
| Public SOW share link | **0** ✅ (no `/s/[token]` route, no SOW share token table) |
| Send to Client | **0** ✅ (button LOCKED for SOW) |
| Email / CRM / e-signature | **0** ✅ |
| Attio writes | **0** ✅ |
| Public route changes | **0** ✅ (source-only sprint had no source touch) |
| Group-B public wiring | **0** ✅ (the canonical `PROPOSAL_GROUP_B_OMISSION_ENTRY` is prepended to omitted_content per the action's own contract) |
| Sapient Digital mutation | **0** ✅ |
| Real client mutation | **0** ✅ |
| `docs/39` § 5 sequence change | **0** ✅ |
| New report PDF candidates | **0** ✅ |
| New proposal candidates | **0** ✅ (the source `bcffa4cd-…` was reused) |
| New proposal/report share tokens | **0** ✅ |
| Active proposal/report share tokens | **0** ✅ (carryover state) |
| Findings / opportunities / roadmap_items / report_sections / proposal_options mutated | **0** ✅ |
| Banned activity events (`*_share_token_*`, `*_sent_to_client`, `account_linked_to_attio`) | **0** ✅ |
| Distinct event types in window | exactly 1 (`sow_draft_generated`) ✅ |
| Migration footprint | **Zero** ✅ |
| Override path used | No ✅ |
| Service-role writes used | No ✅ |
| New package dependencies | Zero ✅ |

## 8. Files changed

**Source-tree: ZERO.** Pure observation + documentation sprint.

**Docs (5):**
- `docs/54_INTERNAL_SOW_DRAFT_VALIDATION.md` (this file)
- `docs/39_CONSULTING_MODULE_COMPLETION_ROADMAP.md` § 5 — Sprint S10 row marked LANDED + LIVE-VERIFIED
- `docs/53_S9_FIX_SOW_READINESS_CONTRACT.md` — § 6 closure note (S10 consumed the readiness signal correctly)
- `docs/08_CURRENT_STATUS.md` — new block at top
- `docs/10_SESSION_HANDOFF.md` — new Latest line

## 9. Lint / build / check result

- `npm run lint` ✅ clean
- `NEXT_TELEMETRY_DISABLED=1 npm run build` ✅ clean — all 33 routes byte-stable
- `npm run check:send-to-client-disclaimers` ✅ clean

## 10. Route size impact

Zero — no source touch this sprint.

## 11. Limitations

- **L-32 — No SOW Draft approval UI surfaced.** The deployed UI surfaces `Void` and `Open SOW Draft` (internal preview), but no "Approve SOW" button. The action layer's `approval_state` enum allows `approved` (and a future action could flip it), but the canonical S10 scope per the user spec is internal review only — not a separate SOW approval workflow. The current flow is: generate → operator reviews via internal preview → operator either accepts implicit (no UI flip) or voids. This matches the spec's "internal draft, operator-reviewable" contract. Add an explicit `Approve SOW` button only if a downstream sprint requires it.
- **L-33 — Public SOW route is canonically absent.** `/s/[token]` does not exist per `docs/28` decision (default: defer). Sprint S11 (Pre-Delivery Audit) does not unblock this. Adding a public SOW share route would be a separate canon decision, not an S10/S11 task.
- **L-25/L-26 (carried forward) — Chrome MCP synthetic-click workaround** still required for browser MCP automation. Not a source bug.

## 12. Recommended next sprint

**Sprint S11 — Pre-Delivery Audit Code-Side Enforcement** per `docs/39` § 5. Roadmap sequence unchanged.

Per `docs/39` § 5, S11 scope is:
1. Convert `docs/35` § 5 readiness gate from operator discipline to a code-side guard.
2. Gate blocks `/r` and `/p` mint attempts when any of the 15 readiness conditions fail.

S11 entry conditions are structurally satisfied:
- S8 → S9 → S9-Fix → S10 chain end-to-end live-verified on the controlled fixture.
- 5 approved findings + 3 selected opportunities + 3 ready roadmap items + 5 approved report sections + 3 drafted proposal options (1 recommended `ai_workflow_system`) + 1 approved proposal snapshot + 1 unreviewed SOW Draft (`f6ed1fe5-…`).
- Pre-existing share-token mint surface intact (locked behind S11 readiness when that lands); SOW Draft sits internal.

## 13. Suggested commit message

```
Validate internal SOW draft flow
```

(Per task spec.)

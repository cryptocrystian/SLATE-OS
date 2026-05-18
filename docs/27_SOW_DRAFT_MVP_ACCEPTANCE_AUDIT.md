# SOW Draft MVP Acceptance Audit

## Status

- **Date:** 2026-05-17
- **Branch:** `persistence/step-0-1-auth-shell`
- **Commits audited (oldest → newest):**
  - `c68fd81` — Add SOW draft canon (Sprint P6-A)
  - `2128e0b` — Add SOW draft foundation (Sprint P6-B)
  - `ad29320` — Add internal SOW draft workflow (Sprint P6-C)
- **Outcome:** **Accepted with notes**
- **Scope:** Internal SOW Draft MVP (operator-only generation, review, void; no public surface, no e-signature, no Send to Client)
- **`Prepare SOW Draft` unlock status:** UNLOCKED for persisted UUID engagements as an in-page anchor (`<Link href="#past-sow-drafts-panel">`); mock paths keep the locked button.
- **`Send to Client` status:** LOCKED. Sprint P8 earliest unlock, requires a separate channel canon (recommended `docs/28`).
- **Public SOW route status:** ABSENT. No `app/s/` directory; no `sow_share_tokens` migration; no service-role public lookup helper. Sprint P7-A decides whether a public route ships; recommended default per `docs/26` § Open Decisions item 11 is **defer**.
- **E-signature status:** ABSENT. Out of Phase 1B scope. Separate canon required (recommended after the channel canon).
- **Read-only audit:** No source code modified. No commits authored by this audit. Docs-only output (this audit doc + `docs/08` + `docs/10`).

## Executive Summary

| Question | Verdict |
|---|---|
| Can an operator generate a SOW Draft from an approved Proposal Candidate? | ✅ Code path verified end-to-end; live walkthrough deferred to operator session. |
| Does the internal SOW route render the SOW artifact correctly? | ✅ Static verification confirms canon-mandated chrome + snapshot-pure render. |
| Does the artifact include all required SOW markings and disclaimers? | ✅ All canon-mandated copy strings grep-matched in the renderer. |
| Does the artifact avoid final pricing, e-signature, acceptance, and legal/contract language? | ✅ Final pricing hidden when `pricing_review_state='placeholder'`; no e-sign / accept / agree / sign / Send to Client controls present. Legal terms named only inside the canon-required omission notice that explains why they're absent. |
| Does voiding a SOW Draft work? | ✅ Shared `voidProposalDeliverySnapshotAction` branches on `delivery_surface`; SOW rows flip to `status='voided'` + `approval_state='revoked'` + audit columns populated; route revalidation switches to the SOW path. |
| Does `sow_draft_voided` activity emit? | ✅ Event-type branch verified in `lib/proposals/snapshot-actions.ts:541-543`. |
| Did `Prepare SOW Draft` unlock only to the internal SOW Draft workflow? | ✅ In-page anchor to `#past-sow-drafts-panel`; no email, no CRM, no public route, no PDF binary, no share token. |
| Are `Send to Client` and public SOW delivery still locked / absent? | ✅ `Send to Client` LOCKED verbatim; public SOW route absent by inventory. |
| Are there blockers before declaring SOW Draft MVP complete? | **No blockers.** Three audit notes carried forward (pattern-count documentation discrepancy + operator-driven live walkthrough deferral + optional SOW-side approval action). |

The Sprint P6 series moves the proposal-side commercial conversation from "approved Proposal Candidate" through the first operator-only SOW Draft surface. Three sprints together (`c68fd81` + `2128e0b` + `ad29320`) ship the canon, the foundation modules, and the operator-visible internal route + panel + Generate/Open/Void controls + the `Prepare SOW Draft` unlock — all without introducing a public SOW route, share token, e-signature, email, CRM, PDF binary, storage bucket, package dependency, schema migration, or middleware change.

## Inventory Audit

All target files present at canonical sizes:

| File | Status | Bytes |
|---|---|---|
| `docs/26_PHASE_1B_SOW_DRAFT_CANON.md` | OK | 44,003 |
| `lib/proposals/sow-draft-eligibility.ts` | OK | 15,032 |
| `lib/proposals/sow-draft-actions.ts` | OK | 18,339 |
| `app/app/engagements/[id]/proposal/sow/[snapshotId]/page.tsx` | OK | 6,120 |
| `components/proposals/sow-draft-document.tsx` | OK | 29,287 |
| `components/proposals/past-sow-drafts-panel.tsx` | OK | 12,695 |
| `components/proposals/generate-sow-draft-button.tsx` | OK | 8,486 |
| `components/proposals/void-sow-draft-button.tsx` | OK | 4,971 |

Modified support files present:

| File | Status | Bytes |
|---|---|---|
| `lib/proposals/commercial-guard.ts` | OK | 21,124 |
| `lib/proposals/delivery-snapshot-types.ts` | OK | 7,571 |
| `lib/proposals/delivery-snapshot-mappers.ts` | OK | 8,263 |
| `lib/proposals/snapshot-actions.ts` | OK | 25,262 |
| `lib/activity/types.ts` | OK | 2,715 |
| `components/activity/activity-timeline.tsx` | OK | 7,648 |
| `app/app/engagements/[id]/proposal/page.tsx` | OK | 15,008 |
| `components/proposals/proposal-workspace.tsx` | OK | 15,545 |

Out-of-scope files **not** added (verified by grep + directory listing): no `app/s/[token]/page.tsx`, no `supabase/migrations/*sow*`, no `lib/proposals/sow-share-*`, no `components/proposals/*sow-share*`, no `lib/proposals/sow-public-*`.

## Canon / Boundary Audit

Verified against `docs/26_PHASE_1B_SOW_DRAFT_CANON.md`:

| Canon rule | Verdict |
|---|---|
| SOW Draft is internal and non-binding | ✅ Mandatory four-line footer + body note enforce this in the renderer (`sow-draft-document.tsx:769`, `:224`). |
| Reuses `proposal_delivery_snapshots` with `delivery_surface='sow_draft_candidate'` | ✅ `generateSowDraftCandidateAction` inserts into the existing table with the existing CHECK-validated surface value. |
| No migration was added | ✅ `git log --stat c68fd81..ad29320 -- supabase/` confirms zero migration files in the Sprint P6 series. |
| No public `/s` or `/sow` route exists | ✅ Inventory grep clean. Only `/s/[token]` reference in code is a canon-warning string inside the eligibility evaluator (`sow-draft-eligibility.ts:385`). |
| No SOW share-token table exists | ✅ No `sow_share_tokens` migration; no `lib/proposals/sow-share-token-*` modules. |
| No e-signature exists | ✅ Renderer + panel + action surface grep clean for `e-sign` / `esign` / `sign here` / `signature_block` / `click to sign`. |
| No email / CRM exists | ✅ No new email pipeline; no `nodemailer`/`@sendgrid`/`postmark` deps in `package.json`; no CRM integration in `lib/`. |
| No PDF binary / storage exists | ✅ No new R2 / Supabase Storage bucket; no PDF library dep; no artifact persistence beyond jsonb snapshot. |
| Group-B remains excluded | ✅ `BenchmarkComparisonBars`, `AISavingsWaterfall`, `RoiBridge` confined to `/app/charts-preview` per `git grep` — not imported by SOW renderer, panel, or route. |
| `Send to Client` remains locked | ✅ `proposal-workspace.tsx:416-420` `LockedActionButton label="Send to Client"` unchanged. |

## Commercial Guard Audit

Verified pattern array contents in `lib/ai/claim-guard.ts` + `lib/proposals/commercial-guard.ts`:

| Family | Source | Pattern count | Canon claim | Verdict |
|---|---|---|---|---|
| `FINANCIAL_CLAIM_PATTERNS` | `lib/ai/claim-guard.ts:34-52` | 14 | 14 | ✅ Match |
| `COMMERCIAL_FINALITY_PATTERNS` | `lib/ai/claim-guard.ts:61-68` | 6 | 6 | ✅ Match |
| `ROADMAP_COMMITMENT_PATTERNS` | `lib/ai/claim-guard.ts:76-95` | 6 | 6 | ✅ Match |
| `PROPOSAL_FINALITY_PATTERNS` | `lib/proposals/commercial-guard.ts:69-110` | **19** | 18 | ⚠️ One-off |
| `SOW_DRAFT_FINALITY_PATTERNS` | `lib/proposals/commercial-guard.ts:128-187` | 26 | 26 | ✅ Match |
| **Combined (Proposal Candidate)** | `COMBINED_RULES` line 200-205 | **45** | 44 | ⚠️ One-off (downstream) |
| **Combined (SOW Draft)** | `COMBINED_RULES_WITH_SOW` line 213-216 | **71** | 70 | ⚠️ One-off (downstream) |

### Audit note 1 — pattern-count documentation discrepancy

Runtime `commercial_guard_result.patternCount` will be `45` for new Proposal Candidate snapshots and `71` for new SOW Draft snapshots — not the `44` / `70` cited in canon docs and prior audits. Cause: `PROPOSAL_FINALITY_PATTERNS` contains 19 distinct entries; the canon enumeration cites 18.

**Severity:** Documentation note. The runtime is the source of truth; existing scanning behaviour is unchanged. The doc / canon language should reconcile to `45 / 71` (or trim one redundant proposal-finality pattern to land on `44 / 70` — operator decision; both options are clean).

Activity event metadata verified to NEVER include violation text:
- `lib/proposals/snapshot-actions.ts:232-237` (Proposal Candidate failure): `metadata: { proposalId, failureReason: 'commercial_guard_violation', violationCount }` — count only.
- `lib/proposals/sow-draft-actions.ts:294-301` (SOW Draft failure): `metadata: { proposalId, sourceProposalSnapshotId, failureReason: 'sow_commercial_guard_violation', violationCount }` — count only.
- Result payload `violations` only carries `{field, code}` shape — banned-phrase text never returned to the caller.

SOW renderer verified to NEVER surface guard codes / families / violation text:
- `components/proposals/sow-draft-document.tsx:247-272` — affirmative-only `Passed` chip OR sanitized violation count chip; no `code` / `patternFamily` rendering.

**Live banned-phrase mutation: deferred to operator-driven walkthrough.** No safe operator edit path exists from the audit harness (no UI surface mutates source-option text into banned phrases without operator session).

## Eligibility Audit

`lib/proposals/sow-draft-eligibility.ts` declares the `SowDraftEligibilityReasonCode` union with **15** members and implements 14 of them in the evaluator body (the 15th, `unsupported_surface`, is declared in the union for future-proofing but unreachable in production because the action layer pre-validates `delivery_surface` before invoking the evaluator).

| # | Reason code | Severity | Source line | Canon | Verdict |
|---|---|---|---|---|---|
| 1 | `engagement_not_persisted` | error | 159 | docs/26 § Eligibility item 1 | ✅ |
| 2 | `source_snapshot_missing` | error | 168 | item 2 | ✅ |
| 3 | `source_snapshot_voided` | error | 190 | item 3 | ✅ |
| 4 | `source_surface_not_proposal_candidate` | error | 199 | item 4 | ✅ |
| 5 | `source_not_approved` | error | 209 | item 5 | ✅ |
| 6 | `source_guard_failed` | error | 218 | item 6 | ✅ |
| 7 | `no_included_options` | error | 240, 282 | item 7 | ✅ |
| 8 | `selected_option_missing` | error | 251, 261 | item 8 | ✅ |
| 9 | `group_b_content_blocked` | error | 314 | item 9 | ✅ |
| 10 | `sow_guard_failed` | error | 324, 331 | item 10 | ✅ |
| 11 | `pricing_pending` | warning | 344 | item 11 | ✅ (warning, not blocker — canon-correct) |
| 12 | `implementation_credit_pending_approval` | warning | 359 | item 12 | ✅ |
| 13 | `reviewer_notes_excluded` | warning | 372 | item 13 | ✅ |
| 14 | `public_sow_not_authorized` | warning | 382 | item 14 | ✅ |
| 15 | `unsupported_surface` | error | declared only | item 15 | ⚠️ Declared but unreachable |

`return-all-reasons` semantic verified: evaluator pushes each independent reason without short-circuiting; only the `source_snapshot_missing` path early-returns because without a source there is nothing else to evaluate (canon-correct).

Pricing-pending behaviour verified: when `pricingReviewState === 'placeholder'`, the evaluator records the warning AND populates `sowDraftNotice.pricingNotice` with the canon-prescribed "Pricing is pending manual review and is intentionally omitted from this draft." string (`sow-draft-eligibility.ts:121-122,151`). The renderer surfaces this notice in place of pricing (`sow-draft-document.tsx:317-320`).

### Audit note 2 — `unsupported_surface` reason code declared but unreachable

The 15th union member `unsupported_surface` is never produced by the evaluator body. The action layer (`sow-draft-actions.ts:207-209`) pre-rejects non-`client_proposal_candidate` sources with `error: 'source-surface-not-proposal-candidate'` before the evaluator runs.

**Severity:** Cosmetic. Either delete the unreachable union member, or move the action-layer's pre-check into the evaluator so the union is fully covered. Not blocking.

## Operator Live Walkthrough

Target engagement: `76097653-fedb-42e5-9ef6-e89a0e97f802` (Sapient Digital).
Target proposal: `77031092-700b-4da1-b69b-15e3dcd889d6`.

### Canonical 14-step path

1. Open `/app/engagements/76097653-fedb-42e5-9ef6-e89a0e97f802/proposal`.
2. If no eligible source candidate, click **Generate Proposal Candidate**.
3. Click **Approve candidate** on the freshly generated row.
4. Scroll to **Past SOW Drafts** (or use the now-unlocked `Prepare SOW Draft` anchor), click **Generate SOW Draft**.
5. Verify inserted row via UI badges + (if operator has read-only SQL access) direct DB read:
   - `delivery_surface='sow_draft_candidate'`
   - `status='candidate'`
   - `approval_state='unreviewed'`
   - `pricing_review_state` copied from source (typically `placeholder` in MVP)
   - `draft_watermark=true`
   - `source_context_snapshot.sowDraft` populated (`scopeStatement`, `deliverables`, `assumptions`, `dependencies`, `pricingNotice`, `legalBoundaryNotice` at minimum)
   - `commercial_guard_result.passed=true`
   - `commercial_guard_result.patternCount=71` (see Audit note 1 — value is 71, not 70 as canon currently documents)
6. Verify `sow_draft_generated` activity event present in the engagement activity timeline with sanitized metadata.
7. Click **Open SOW Draft** → `/app/engagements/76097653-.../proposal/sow/<snapshot-id>` opens in new tab.
8. Verify all canon-mandated chrome present in order:
   - Operator-only print hint (`print:hidden`)
   - Generated banner ("Operator-only SOW Draft · operator review only · not sent by SLATE")
   - Identity header ("Draft SOW · not executed" H1 + body note)
   - SOW content safety checks strip (affirmative `Passed`)
   - Draft watermark warning
   - Disclosure card ("Draft SOW · not executed" + pricing notice + approval state)
   - Legal-boundary notice card
   - Scope statement + proposed timeline + deliverables + assumptions + dependencies + exclusions (scope section)
   - Client / operator responsibilities section (placeholder hint when empty — canon-allowed)
   - Per-option detail cards (carry-forward audit trail)
   - Intentionally-not-included appendix (Group-B canonical + per-option SOW omissions)
   - Mandatory four-line footer
9. **Internal-leak audit on the route body:** the SOW route is operator-only (`/app/*`-gated by middleware), so operator-internal references (option labels, generated-by initials, draft watermark badge, snapshot-id breadcrumb-style identifiers if needed) are PERMITTED by canon for the internal surface. The strict "ZERO internal UUID" rule applies to the future public SOW share route (Sprint P7-A scope) — not to this internal route. **Verify only: no commercial-guard codes, no banned-phrase text, no SOW-share-token strings (no token URL anywhere), no Send-to-Client controls, no e-sign / sign / accept / agree controls, no final pricing while `placeholder`.**
10. Verify the visible button set on the internal SOW route is back-link only (no Send / Share / Sign / Accept / Approve controls in P6-C).
11. Return to proposal page → click **Void** on the SOW Draft row → confirm with default reason.
12. Verify post-void state:
   - Row badge flips to `Voided`
   - `voided_at` populated, `void_reason` populated
   - Reload SOW route → voided banner renders, content preserved for audit
   - **`sow_draft_voided` activity event emitted** (NOT `proposal_snapshot_voided` — this is the Sprint P6-C event-type branch in `snapshot-actions.ts:541-543`)
13. Verify `Prepare SOW Draft` is an in-page anchor: clicking it scrolls to `#past-sow-drafts-panel`; no navigation, no network call, no email, no public route, no share token mint.
14. Verify `Send to Client` remains a `LockedActionButton`.

### Live walkthrough deferral

Read-only SQL against the shared production Supabase remains classifier-blocked under auto mode (consistent with the `docs/21` / `docs/23` / `docs/25` precedent). The audit therefore lands as **Accepted with notes**, with the live walkthrough listed as the canonical operator acceptance step. The audit's static verification covers every code path; the operator session confirms the runtime behaviour against the chosen test engagement.

Walkthrough notes file: `artifacts/walkthroughs/sow-draft-mvp-acceptance/notes.md` (gitignored). Operator records confirmations + screenshots there post-audit.

## SOW Draft Route Audit

`app/app/engagements/[id]/proposal/sow/[snapshotId]/page.tsx` verified at line ranges noted:

| Property | Source | Verdict |
|---|---|---|
| Path `/app/engagements/[id]/proposal/sow/[snapshotId]` | Directory layout | ✅ |
| Authenticated `/app/*` middleware gate | `middleware.ts` matcher unchanged | ✅ |
| `dynamic = "force-dynamic"` | line 40 | ✅ |
| `revalidate = 0` | line 41 | ✅ |
| `fetchCache = "force-no-store"` | line 42 | ✅ |
| `snapshot.engagementId === params.id` defense | lines 116-118 (`notFound()`) | ✅ |
| `snapshot.deliverySurface === 'sow_draft_candidate'` defense | lines 125-127 (`notFound()`) | ✅ |
| Persisted-only — explanatory empty state for legacy slug | lines 68-89 | ✅ |
| Snapshot-not-found explanatory empty state | lines 92-110 | ✅ |
| No public access (anonymous → middleware redirects to `/login`) | mirrors `/proposal/candidate/[snapshotId]` shape | ✅ |
| No share-token mint | not present | ✅ |
| No Send to Client control | not present | ✅ |
| No e-sign controls | not present | ✅ |
| No PDF binary generation | renderer outputs HTML/SVG only | ✅ |
| `.slate-print-light` palette wrapper | line 130 | ✅ |
| Service-role client NOT used | `getProposalDeliverySnapshotById` is cookie-bound RLS | ✅ |

## SOW Draft Artifact Content Audit

Verified content **inclusions** in `components/proposals/sow-draft-document.tsx`:

| Required element | Source line | Verdict |
|---|---|---|
| Operator-only banner "NOT SENT BY SLATE · No client delivery" | 127 | ✅ |
| "Draft SOW · not executed" header | 329 (disclosure card), 215 (identity H1 via component composition) | ✅ |
| Body note "This draft is for review and planning only. It is not binding until reviewed, approved, and executed by authorized parties." | 224 | ✅ |
| Generated date | `IdentityHeader` formatTimestamp | ✅ |
| Selected option count | `IdentityHeader` ("Options N included") | ✅ |
| Status / approval / pricing chips | `IdentityHeader` flex-wrap fragment | ✅ |
| Scope statement | `SowScopeSection` → `SectionBlock label="Scope statement"` | ✅ |
| Deliverables | `BulletBlock label="Deliverables"` | ✅ |
| Exclusions | `BulletBlock label="Exclusions"` (with placeholder hint when empty) | ✅ |
| Assumptions | `BulletBlock label="Assumptions"` | ✅ |
| Dependencies | `BulletBlock label="Dependencies"` | ✅ |
| Proposed timeline | `SectionBlock label="Proposed timeline"` | ✅ |
| Client responsibilities | `SowResponsibilitiesSection` | ✅ |
| Operator responsibilities | `SowResponsibilitiesSection` | ✅ |
| Open questions | `SowOpenQuestionsSection` (conditional) | ✅ |
| Pricing notice | `SowDisclosureNotice` (canon-derived, fallback-safe) | ✅ |
| Legal boundary notice | `LegalBoundaryNotice` line 353 | ✅ |
| Intentionally omitted appendix | `OmittedContentAppendix` line 723 | ✅ |
| Group-B omission | First entry via `PROPOSAL_GROUP_B_OMISSION_ENTRY` carried in `omitted_content` | ✅ |
| Commercial safety affirmative strip | `SafetyStrip` line 268 ("SOW content safety checks") | ✅ |
| Mandatory footer ("Not a contract. Not an executed SOW. Not a binding quote. Not authorization to begin work. Final scope, pricing, timeline, and terms require written approval.") | 769 (with the second-line continuation completing the canon string verbatim) | ✅ |

Verified content **exclusions**:

| Prohibited element | Verdict |
|---|---|
| Final pricing while `pricing_review_state='placeholder'` | ✅ `OptionCard.showPricing = pricingReviewState !== 'placeholder'` guard at line 617 |
| E-signature controls | ✅ No `sign` / `signature` / `e-sign` rendering paths (line 48 reference is JSDoc-only) |
| Sign / accept / agree language in rendered copy | ✅ Grep clean across the renderer body |
| Send to Client controls | ✅ Not present |
| Public share links | ✅ Not present |
| SOW share token data | ✅ Not present |
| Commercial guard codes / pattern families / violation text | ✅ Safety strip shows affirmative `Passed` OR sanitized count only |
| Group-B exhibit data | ✅ Not imported; carried only as omission entry |
| Payment terms (`net 30`, `due upon receipt`, etc.) | ✅ Not present |
| Legal terms surfaced as content | ✅ Named ONLY inside the boundary notice that explains why they're omitted (canon-required transparency) |
| Final SLA / warranty / legal clauses | ✅ Not present |

### Audit note 3 — internal-route content scope clarification

The audit prompt asks to "verify zero internal UUID leak if expected for SOW route". Per canon, the internal SOW route IS operator-facing — operator-internal references (snapshot id breadcrumbs, generated-by initials, draft watermark badge, internal-banner text) are intentionally rendered for operator audit. The strict ZERO-internal-UUID rule applies to **public** surfaces (the future `/s/[token]` SOW share route deferred to Sprint P7-A) — NOT to this internal route.

For symmetry with the proposal-candidate internal route, the SOW renderer DOES echo the snapshot-id-derived option ids inside React `key` props but does NOT surface UUIDs in the rendered DOM text. The renderer body uses snapshot-pure jsonb reads (option titles, scope summaries, timelines, etc.) — never database UUIDs.

**Result:** Internal route shows the operator chrome it must show to be useful for operator review; the leak-prohibition canon scope applies to public surfaces and is preserved by their absence in Sprint P6.

## Past SOW Drafts Panel Audit

`components/proposals/past-sow-drafts-panel.tsx`:

| Property | Verdict |
|---|---|
| Mounted on proposal page (`app/app/engagements/[id]/proposal/page.tsx`) after `<ProposalCandidatesPanel>` | ✅ |
| `id="past-sow-drafts-panel"` anchor present | ✅ (line 116) |
| Latest approved Proposal Candidate auto-resolved | ✅ (line 100-110: `.find(s => s.deliverySurface === 'client_proposal_candidate' && s.status !== 'voided' && s.approvalState === 'approved')`) |
| `Generate SOW Draft` disabled when no approved source | ✅ (`generate-sow-draft-button.tsx:58` `disabled = sourceProposalSnapshotId === null`) |
| Generated SOW rows listed (filtered by `delivery_surface === 'sow_draft_candidate'`) | ✅ (line 112) |
| `Open SOW Draft` link to internal route | ✅ |
| `Void` action present on non-voided rows | ✅ |
| Voided rows remain visible (audit trail preserved) | ✅ |
| No share-link button | ✅ (not imported) |
| No public route reference | ✅ |
| No Send to Client control | ✅ |
| Persisted-engagement only (mounted conditionally in `page.tsx:269-278`) | ✅ |

## `Prepare SOW Draft` Unlock Audit

`components/proposals/proposal-workspace.tsx:389-415`:

| Property | Verdict |
|---|---|
| Active (primary button) for persisted UUID engagements | ✅ (line 390 `{isPersisted ? <Link…> : <LockedActionButton…>}`) |
| Anchors to `#past-sow-drafts-panel` | ✅ (line 399 `<Link href="#past-sow-drafts-panel" scroll>`) |
| Does NOT send email | ✅ (no email pipeline in scope) |
| Does NOT create a public route | ✅ |
| Does NOT create share tokens | ✅ |
| Does NOT produce a PDF binary | ✅ |
| Simply routes operator to Generate SOW Draft workflow | ✅ |
| Mock / non-persisted path remains locked | ✅ (line 410 `LockedActionButton label="Prepare SOW Draft"`) |
| `isPersisted` prop threaded from `proposal/page.tsx` | ✅ (page.tsx line 257 `isPersisted={isPersisted}`) |

## Locked Controls / Boundary Audit

Verified still locked for **persisted UUID engagements** (3 active locks):

| Control | Location | Verdict |
|---|---|---|
| `Send to Client` | `proposal-workspace.tsx:416-420` | ✅ LOCKED |
| `Prepare Report` | `app/app/engagements/[id]/roadmap/page.tsx:122` | ✅ LOCKED |
| `Export Report` | `app/app/engagements/[id]/report/page.tsx:279` | ✅ LOCKED |

Verified still locked for **mock / legacy slug paths** (5 active locks — adds two):

| Additional control | Location | Verdict |
|---|---|---|
| `Prepare SOW Draft` (mock path only) | `proposal-workspace.tsx:410-414` | ✅ LOCKED |
| `Prepare Client Review` (mock path only) | `app/app/engagements/[id]/proposal/page.tsx:143-146` | ✅ LOCKED |

Total `LockedActionButton` mount-site grep count: 5 sites. Sprint P6-C unlocked exactly `Prepare SOW Draft` for persisted UUID engagements (no other locked-control state changed).

Verified **absent**:

| Surface | Verdict |
|---|---|
| `/s` route | ✅ Absent (no `app/s/` directory) |
| `/sow` public route | ✅ Absent |
| `sow_share_tokens` table | ✅ Absent (no migration file matches `*sow*`) |
| SOW public share UI | ✅ Absent |
| E-signature integration | ✅ Absent |
| CRM / email delivery integration | ✅ Absent |
| PDF binary / storage | ✅ Absent |
| Group-B client wiring | ✅ Absent (Group-B exhibits remain confined to `/app/charts-preview`) |

## Build / Lint / Route Audit

```
$ npm run lint
✔ No ESLint warnings or errors

$ NEXT_TELEMETRY_DISABLED=1 npm run build
✓ Compiled successfully
✓ Linting and checking validity of types
✓ Generating static pages (14/14)
✓ Finalizing page optimization
✓ Collecting build traces
```

**Route count:** 29 SLATE app+public routes (build table shows 33 entries: 29 routes + 5 API routes + 1 `_not-found` + `auth/callback` co-counted under the API tier in the historic accounting; the canonical "29 app routes" figure adds the new `/proposal/sow/[snapshotId]` to the Sprint P6-B baseline of 28).

**Reduced-cardinality route table (per audit prompt):**

| Route | Size | First Load JS |
|---|---|---|
| `/app/engagements/[id]/proposal` | 10.5 kB | **114 kB** |
| `/app/engagements/[id]/proposal/sow/[snapshotId]` | 187 B | **96.2 kB** |
| `/app/engagements/[id]/proposal/candidate/[snapshotId]` | 187 B | **96.2 kB** |
| `/p/[token]` | 155 B | **87.4 kB** |
| `/r/[token]` | 155 B | **87.4 kB** |
| `/scorecard/results` | 10.7 kB | **119 kB** |

The new SOW route's First Load JS is byte-identical to the Proposal Candidate internal route (`187 B / 96.2 kB`), confirming the snapshot-pure server-component pattern matches the established baseline. `/proposal` grew `9.87 kB → 10.5 kB` for the new panel + Generate/Void buttons + workspace unlock. `/p/[token]`, `/r/[token]`, and `/scorecard/results` are byte-identical to Sprint P6-B baseline — the SOW work touched no client-facing public surface.

## Visual Artifacts

Captured under `artifacts/walkthroughs/sow-draft-mvp-acceptance/` (gitignored):

- `notes.md` — static verification record + 14-step operator walkthrough checklist + screenshot filenames the operator will capture.

Operator-captured screenshots land here post-audit using the canonical filenames:
- `proposal-page-prepare-sow-draft-unlocked.png`
- `past-sow-drafts-panel.png`
- `internal-sow-draft-route.png`
- `internal-sow-draft-voided.png`
- `activity-log-sow-generated-voided.png`

## Known Backlog

Carry-forward items (none blocking the acceptance decision):

1. **Public SOW share route decision (Sprint P7-A).** Recommended default per `docs/26` § Open Decisions item 11 is **defer** until the Send to Client channel canon (recommended `docs/28`) is authored.
2. **SOW share tokens (if Sprint P7-A approves a public route).** Would need a separate migration + `lib/proposals/sow-share-token-*` modules + service-role public lookup + access logging + cascade-revoke semantics (mirror `proposal_share_tokens` shape).
3. **SOW approval flow (if separate approval needed).** Per `docs/26` § Open Decisions item 8, an `approveSowDraftSnapshotAction` mirroring the proposal-side flow could ship if operator workflow requires SOW-side approval as a distinct state. Current implementation leaves approval out — `draft_watermark` always shows; the canon allows either route.
4. **Pricing approval workflow.** Today every SOW Draft generates with `pricing_review_state` copied from source; no workflow advances it. The renderer correctly hides pricing while `placeholder`. Future commercial-approval workflow remains open.
5. **Implementation-credit approval workflow.** Currently captured in snapshot but hidden from the SOW Draft surface (canon-correct). Future workflow may surface it.
6. **E-signature provider decision.** Out of Phase 1B scope. Separate canon required.
7. **Send to Client channel canon (recommended `docs/28`).** Required before any Sprint P8 `Send to Client` unlock work.
8. **Production hardening backlog from `docs/23` + `docs/25` (carries forward unchanged):**
   - `SLATE_SHARE_TOKEN_ACCESS_PEPPER` deployment
   - access-log debounce on `/r/[token]` + `/p/[token]`
   - dev-only short-expiry affordance
   - audience-label / recipient-email UI for share-token mint
   - revoke-from-panel UI
   - engagement-title fallback investigation
9. **Pattern-count documentation reconciliation (Audit note 1).** `PROPOSAL_FINALITY_PATTERNS` has 19 entries vs canon-claimed 18; runtime `patternCount` reads 45/71 vs canon-claimed 44/70. Either trim one redundant proposal-finality pattern OR update canon docs (`docs/24`, `docs/26`) + prior audits (`docs/25`) to read 45/71. Operator decision; both options are clean.
10. **`unsupported_surface` eligibility union member (Audit note 2).** Declared but unreachable in production. Either delete the union member or move the action-layer's pre-check into the evaluator.
11. **Optional UI tightening: filter Past Proposal Candidates panel to hide SOW Drafts explicitly.** Today the panel filters by `delivery_surface === 'client_proposal_candidate'` implicitly through its query shape; SOW Drafts live in the dedicated Past SOW Drafts panel. A future tightening could render SOW Drafts as visually distinct rows in the proposal panel too — not required.
12. **Operator-driven live walkthrough.** The canonical Generate → Approve → Generate SOW Draft → Open route → Void → verify-events chain belongs to the operator session. Walkthrough notes template lives in `artifacts/walkthroughs/sow-draft-mvp-acceptance/notes.md`.

## Acceptance Decision

**Accepted with notes.**

- Inventory clean.
- Canon / boundary clean.
- Commercial guard pattern math correct (with the documented one-off discrepancy between docs and runtime).
- Eligibility evaluator correct (with the documented unreachable union member).
- SOW route + renderer + panel + workspace unlock match canon.
- Locked-control matrix correct (`Send to Client` LOCKED; `Prepare SOW Draft` unlocked exactly to the internal anchor flow).
- Public-route absence verified by inventory.
- Build + lint clean.
- Three audit notes carried forward as backlog items 9-12 above. None blocks acceptance.

## Recommended Next Milestone

**Declare SOW Draft MVP complete.**

Recommended next sprint: **Sprint P7-A — SOW share route decision canon** _OR_ defer public SOW sharing entirely and move to the production-hardening backlog from `docs/23` + `docs/25`. Both options are clean per `docs/26` § Open Decisions item 11 (canon-recommended default: defer).

Either way:
- `Send to Client` remains LOCKED.
- E-signature remains absent.
- Email / CRM integration remains absent.
- The Sprint P8 `Send to Client` unlock requires a separate channel canon (recommended `docs/28_PHASE_1B_SLATE_DELIVERY_CHANNEL_CANON.md`) authored before code.

Parallel independent decisions (none gates the acceptance):
- Engagement-wide share management UI for both report and proposal lanes.
- Production hardening from `docs/23` + `docs/25` backlog (pepper config, debounce, dev-only short-expiry, audience-label/recipient-email UI, revoke-from-panel).
- Benchmark Gate 1 / Financial Gate 1 advancement for Group-B exhibits.

## Files modified by this audit

- `docs/27_SOW_DRAFT_MVP_ACCEPTANCE_AUDIT.md` (new)
- `docs/08_CURRENT_STATUS.md` (status block updated)
- `docs/10_SESSION_HANDOFF.md` (chronology + next-planned updated)
- `artifacts/walkthroughs/sow-draft-mvp-acceptance/notes.md` (new, gitignored)

**No source code changes.** Read-only audit per the audit prompt.

# SOW Share Link MVP Acceptance Audit

## Status

- **Date:** 2026-08-17
- **Branch:** `persistence/step-0-1-auth-shell`
- **Sprint:** P7-B — client-facing SOW share route (`/s/[token]`)
- **Canon:** `docs/28` (SOW share route decision) + `docs/65` (SOW-share
  re-eligibility canon, which authorised P7-B) + `docs/29` (Option A
  operator-mediated copy-link channel) + `docs/26` (SOW Draft required
  markings) + `docs/35` § 5 / `docs/55` (pre-delivery audit).
- **Commits audited:**
  - `9c1fd66` — P7-B step 1: `approveSowDraftSnapshotAction` + approval UI
  - `114f756` — P7-B step 2: `sow_share_tokens` migration + RLS
  - `f7d1a62` — P7-B step 3: `sow-share-*` module set + audit + cascade wiring
  - `ed3a47b` — P7-B step 4: `/s/[token]` public route + public SOW render
  - `c782481` — P7-B step 5: SOW share mint button + revoke + panel wiring
  - _(this audit)_ — `sow-draft-document.tsx` public-mode operator-chrome
    leak fixes surfaced by the live E2E; this doc.
- **Outcome:** **Accepted — all follow-ups resolved.** The full happy path
  and every negative path were live-verified end-to-end against production.
  The live public render surfaced a **cluster of operator-chrome leaks** on
  the client `/s` surface; all were fixed during this audit and re-verified
  clean. All four carry-forward items (CF-1 source-void cascade, CF-2
  docs-gate asymmetry, CF-3 client safety strip, CF-4 disclaimer
  alignment) were subsequently **resolved and live-verified** — see the
  Carry-forward section. Nothing blocking remains.
- **Migration state:** `0021_sow_share_tokens.sql` **applied to
  production** (`hhglrcvsmwaheikdvijw`) this session, verified on an
  isolated Postgres 17 branch first (21 cols / 5 CHECK / 7 FK / 8 indexes
  / RLS authenticated-only, no anon / 1 trigger; all six constraint tests
  pass).

**Locked-control state after P7-B:**

| Control | Status |
|---|---|
| `Approve SOW Draft` (Past SOW Drafts panel) | **UNLOCKED** — approves the SOW snapshot; SOW **stays a draft** (`draft_watermark` retained) |
| `Generate SOW Share Link` (per approved SOW draft) | **UNLOCKED** — mandatory audience label + two-step confirm; gated by eligibility + pre-delivery audit |
| `Revoke` (per active SOW token) | **UNLOCKED** — two-step confirm |
| SOW e-sign / accept / signature workflow | **Never exists** — no execution step, by canon (`docs/28` § 7) |

## Executive Summary

| Question | Answer |
|---|---|
| Can an operator generate a SOW Draft that records its source Proposal Candidate? | Yes. `Generate SOW Draft` sources from the latest approved candidate and stores `sowSourceProposalSnapshotId` in `source_context_snapshot`. Live-verified: snapshot `c5e2e108` created from approved `897fe797`, 3 options, `draft_watermark=true`. |
| Can an operator approve a SOW Draft without stripping the draft marking? | Yes. `approveSowDraftSnapshotAction` flips `approval_state='approved'` but deliberately **does not** clear `draft_watermark` (a shared SOW stays a draft — `docs/65`). Live-verified: `c5e2e108` → `approved` with `draft_watermark=true` retained. |
| Does the pre-delivery audit gate the SOW mint? | Yes, on the `sow` surface. Live-verified **both** ways: the mint was **blocked** while Meridian was under-provisioned (0 supporting docs, 5 drafted findings < 8), and **passed** after the two blockers were legitimately cleared via the app (3 findings added → 8; 1 supporting document uploaded). |
| Is the mandatory audience label enforced? | Yes, at three layers: the mint UI requires it, `generateSowShareLinkAction` rejects an empty label (`audience-label-required`), and the DB column is `NOT NULL` + non-empty CHECK. |
| Is only the token hash persisted? | Yes. Live-verified: raw token surfaced once in the UI as `/s/rdTCi-2L…`; `sow_share_tokens.token_hash` stored `sha256(raw)` (`c9f46485…`) — confirmed by recomputing the hash off the raw token. No plaintext token, no signatory identity, recipient email hashed-or-null. |
| Does a valid `/s/[token]` render a sanitized, client-appropriate SOW draft? | **Yes, after fixes.** The first live render leaked substantial operator chrome (see Finding P7B-1). After the fix, the public render carries only client-appropriate content + the canon-required disclaimer, DRAFT-for-review marking, legal-boundary notice, and footer. |
| Do revoked / voided / unknown links render the generic-unavailable page? | Yes. Live-verified for a revoked token and a cascade-revoked+voided token: identical generic body ("This SOW link is unavailable… Contact the sender for an updated link."), no reason disclosed, zero SOW content leak. |
| Does operator revoke work? | Yes. `revokeSowShareTokenAction` (two-step confirm) flipped the active token to `status='revoked'`; subsequent `/s` access → generic-unavailable. Live-verified. |
| Does the SOW-snapshot-void cascade work? | Yes, live-verified. Voiding SOW snapshot `c5e2e108` auto-revoked its active token via `cascadeRevokeActiveSowShareTokensForSnapshot` (`status='revoked'`, `revoke_reason='sow_snapshot_voided'`). |
| Does the source-Proposal-Candidate-void cascade work? | **Yes — live-verified** (CF-1, resolved). Voiding the source proposal candidate `231dad8b` (SOW snapshot left un-voided) auto-revoked token `1b5b0746` with `revoke_reason='source_proposal_voided'` via `cascadeRevokeActiveSowShareTokensForSourceProposal`. Distinct from the snapshot cascade (`sow_snapshot_voided`), which is also live-proven. |
| Are the `/s` security headers correct? | Yes. Live `curl`: `Cache-Control: no-store, must-revalidate`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer`. |
| Blockers before declaring the SOW Share Link MVP complete? | **No.** The one serious defect (P7B-1) was fixed and re-verified this session. Four carry-forward items recorded; none blocking. |

## Inventory Audit

All P7-B files present at canonical paths:

| File | Size | Status |
|---|---:|---|
| `supabase/migrations/0021_sow_share_tokens.sql` | 9,364 B | ✓ applied to prod |
| `lib/proposals/sow-share-types.ts` | 3,652 B | ✓ |
| `lib/proposals/sow-share-mappers.ts` | 1,834 B | ✓ |
| `lib/proposals/sow-share-queries.ts` | 3,496 B | ✓ |
| `lib/proposals/sow-share-eligibility.ts` | 4,583 B | ✓ |
| `lib/proposals/sow-share-public.ts` | 14,183 B | ✓ |
| `lib/proposals/sow-share-actions.ts` | 20,315 B | ✓ |
| `lib/proposals/sow-draft-actions.ts` | 23,441 B | ✓ (`approveSowDraftSnapshotAction` + source-id capture) |
| `app/s/[token]/page.tsx` | 6,845 B | ✓ |
| `components/proposals/sow-draft-document.tsx` | 36,964 B | ✓ (public-mode fixes this audit) |
| `components/proposals/generate-sow-share-link-button.tsx` | 14,471 B | ✓ |
| `components/proposals/revoke-sow-share-link-button.tsx` | 4,262 B | ✓ |
| `components/proposals/approve-sow-draft-button.tsx` | 3,445 B | ✓ |
| `components/proposals/past-sow-drafts-panel.tsx` | 16,594 B | ✓ |
| `docs/65_PHASE_1B_SOW_SHARE_REELIGIBILITY_CANON.md` | 15,559 B | ✓ |

## Live E2E — production, Meridian Field Services

Engagement `f477346c-85b4-41b2-a7a2-fe65c7f2ca5d`, operator cookie
(`cdibrell@saipienlabs.com`), Playwright-driven against `localhost:3000`
talking to the production Supabase project.

1. **Generate SOW Draft** → `c5e2e108` from approved candidate `897fe797`;
   `sowSourceProposalSnapshotId` recorded. ✓
2. **Approve SOW Draft** → `approved`, `draft_watermark=true` retained. ✓
3. **Mint (under-provisioned)** → **blocked** by the `sow`-surface
   pre-delivery audit with two accurate reasons (supporting docs;
   findings-drafted < 8). Eligibility had already passed (the action
   reaches the audit only after source-approval / freshness / guard). ✓
4. **Made Meridian audit-ready via the app** (per user decision): added 3
   manual findings (5 → 8 drafted, 5 approved retained) and uploaded 1
   supporting document (`input_assets` 0 → 1). ✓
5. **Mint (ready)** → token `9788a448` minted; raw `/s/rdTCi-2L…`
   surfaced once; only `sha256` persisted (hash recomputation matched). ✓
6. **Public `/s` render** → **Finding P7B-1** (operator-chrome leaks) →
   fixed → re-verified clean. ✓
7. **Revoke** (`9788a448`) → `revoked`; `/s` → generic-unavailable. ✓
8. **Snapshot cascade** → minted token `e2df11a2`; voided SOW snapshot
   `c5e2e108`; token auto-revoked (`revoke_reason='sow_snapshot_voided'`);
   `/s` → generic-unavailable. ✓
9. **Security headers** → `no-store` / `noindex,nofollow` / `no-referrer`. ✓

## Findings

### P7B-1 — Public `/s` render leaked operator chrome _(FIXED this audit)_

**Severity:** serious (client-facing). **Status:** fixed + re-verified.

`SowDraftDocument`'s `mode="public"` was threaded only into the top
disclaimer, `IdentityHeader`, and `SafetyStrip`. The remaining
sub-components rendered operator-internal content on the client surface:

- **`DraftSowWatermark`** showed "DRAFT SOW · OPERATOR REVIEW PENDING" +
  "This SOW Draft has not yet been operator-approved… before using the
  draft in any commercial discussion." On an approved-but-still-draft SOW
  this was both operator-facing **and factually wrong** to the recipient.
- **`OmittedContentAppendix`** ("Intentionally not included") leaked
  internal canon references (`docs/14 / docs/15`), the code identifier
  **`selectedOptionIds[]`**, operator instructions ("Generate a new SOW
  Draft…"), and the by-name `operatorFacingNote` field.
- **`SowDisclosureNotice`** printed "Approval state · approved" (internal
  metadata) and "for internal review".
- **`OptionsList`** header note referenced "the source Proposal Candidate
  snapshot… for audit and operator review".
- **`OptionCard`** pricing-omitted block leaked the internal state name
  ("Pricing review state is `placeholder`") and "commercial-approval
  workflow".
- **`IdentityHeader`** subline: "For internal review and planning only."

**Fix:** `isPublic` is now threaded through every sub-component.
On the public surface: the watermark becomes a client "DRAFT SOW · for
review only" notice; the omitted-content appendix is **hidden entirely**;
the approval-state metadata line, the "internal" wording, the
audit/operator note, and the internal pricing-state name are all dropped
in favour of client-appropriate copy. Re-verified: zero operator-chrome
markers remain; the disclaimer, DRAFT marking, legal-boundary notice,
company identity, and footer all persist. `tsc --noEmit` clean.

## Carry-forward items (non-blocking)

- **CF-1 — Source-proposal-void cascade — RESOLVED (live-verified, this
  audit).** Fired end-to-end on a throwaway approved candidate rather than
  Meridian's operative `897fe797`: approved existing candidate `231dad8b`,
  generated + approved SOW draft `49f87f56` sourced from it, minted token
  `1b5b0746`, then voided the **source** proposal candidate `231dad8b`
  (leaving SOW snapshot `49f87f56` un-voided). Result: token auto-revoked
  with `revoke_reason='source_proposal_voided'` (distinct from the
  snapshot cascade's `sow_snapshot_voided`); `897fe797` untouched. The
  source cascade and the snapshot cascade are now both live-proven.
- **CF-2 — SOW-lane supporting-docs asymmetry — RESOLVED as intentional
  (this audit).** Confirmed the stricter gate is deliberate, not an
  oversight: the SOW is the highest-legal-weight client artifact, so
  requiring ≥1 real supporting document before external share is a
  purposeful stronger bar. Documented as binding prerequisite **7** in
  `docs/65` § 4 (no code change). An engagement that gathered everything
  via interviews satisfies the gate with a short operator-authored summary
  upload; parity with the report/proposal no-docs-ack path would be a
  deliberate future canon amendment, never a silent addition.
- **CF-3 — Client-surface safety strip — RESOLVED (removed, this audit).**
  The affirmative "Content safety checks passed" strip is now dropped from
  the public `/s` render entirely; it remains on the operator surface.
  Guard internals never leaked either way. `docs/26` § 176 amended to
  scope the strip operator-only. Live-verified on a fresh token: the strip
  is gone while the header banner, body note, legal-boundary notice,
  footer, and option detail all remain; spelling stays 6-British /
  0-American. `tsc --noEmit` clean.
- **CF-4 — Disclaimer repetition / spelling — RESOLVED (this audit).**
  Root cause was a code deviation from canon, not a canon conflict: the
  public surface is governed by `docs/28` § 4 (British "authorisation" /
  "authorised", with the exact disclaimer strings hard-verbatim), while
  the shared `SowFooter` and a paraphrased `SowDisclosureNotice` rendered
  American spelling and a duplicate denial paragraph on `/s`. Fix:
  - `SowFooter` is now mode-aware — `docs/28` § 4 verbatim (British) on
    public, `docs/26` (American) on operator. This removes the
    British-top / American-footer mismatch.
  - The public render now uses the `docs/28` § 4 strings **verbatim**: the
    header banner, the body note (single denial paragraph, below the H1),
    the pricing notice, the legal-boundary notice, the closing footer, and
    the additional public-only no-signature disclaimer.
  - De-duplicated: the full comma-form denial paragraph now appears
    **once** (the body note); the top block carries only the banner + the
    no-signature disclaimer; the redundant `SowDisclosureNotice` label and
    the operator draft-watermark callout are dropped on public.
  - Re-verified live on a fresh token: 6 British / 0 American "authoris*"
    hits on `/s`, all five canon strings present verbatim, denial
    paragraph count = 1. `tsc --noEmit` clean.

  Remaining note: the AI-synthesized **scope-summary body** still uses
  American spelling ("prioritized", "standardizing") — that is generated
  option content, not disclaimer copy, and is out of CF-4 scope.

## Fixture side-effects (this audit)

To make Meridian genuinely audit-ready (user decision), the following
real records were created via the app and remain in production:

- 3 additional manual findings (Meridian: 5 → 8 findings).
- 1 supporting document (`input_assets`, "Work Order Lifecycle Notes").
- Several SOW draft snapshots generated across the E2E + CF re-verifications
  (`c5e2e108`, `3e82f17b`, `49f87f56` voided/approved as noted; `06eba1ba`,
  `8d3b6bbe` left approved). Voided snapshots are retained for the audit
  trail per canon; approved-but-unshared drafts are a legitimate state.
- Throwaway proposal candidate `231dad8b` approved then voided during the
  CF-1 source-cascade test (was previously an unreviewed candidate).
- 6 SOW share tokens minted across the E2E + CF-1/CF-3/CF-4 verifications —
  **all revoked** (via operator revoke, snapshot cascade, or source
  cascade). No active token remains.

The operative approved Proposal Candidate `897fe797` and the older SOW
draft `a43cc869` are untouched. The added findings + document are
legitimate enrichments that leave Meridian delivery-ready.

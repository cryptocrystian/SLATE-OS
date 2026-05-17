# Proposal Review Link MVP Acceptance Audit

## Status

- **Date:** 2026-05-17
- **Branch:** `persistence/step-0-1-auth-shell`
- **Commits audited:**
  - `25277a3` — Sprint P2 proposal delivery snapshot foundation
  - `10f6329` — Sprint P3 internal proposal candidate workflow
  - `647b664` — Sprint P4 proposal share-token foundation
  - `2165d9d` — Sprint P5 public `/p/[token]` proposal review route + `Prepare Client Review` unlock
- **Outcome:** **Accepted with notes** — every reachable acceptance criterion lands cleanly; 11 carry-forward items recorded for production rollout / future-sprint scope; none blocking.
- **Scope:** Proposal Review Link MVP (Sprint P2 → P5 together)
- **Type:** Read-only audit. No source code modified. No commits authored. Docs-only output (this file + updates to `docs/08` and `docs/10`).

**Locked-control state after Sprint P5:**

| Control | Status |
|---|---|
| `Prepare Client Review` (proposal page) | **UNLOCKED** for persisted UUID engagements; locked-fallback for mock paths only |
| `Prepare SOW Draft` (proposal workspace) | Locked verbatim |
| `Send to Client` (proposal workspace) | Locked verbatim — last to unlock per `docs/22` + `docs/24` |
| `Prepare Report` (roadmap) | Locked verbatim |
| `Export Report` (report page, mock paths) | Locked verbatim for mock paths; persisted engagements get `<GeneratePdfCandidateButton>` |

## Executive Summary

| Question | Answer |
|---|---|
| Can an operator generate a proposal candidate? | Yes. Sprint P3 ships the `<GenerateProposalCandidateButton>` on the Past Proposal Candidates panel; the cookie-bound `generateProposalCandidateAction` runs the commercial-guard scan + eligibility evaluator + inserts the snapshot row + emits `proposal_snapshot_generated`. Live-verified during this audit against `76097653-fedb-42e5-9ef6-e89a0e97f802` → snapshot `5b2762ab-7446-49f3-a0a4-c99891a8295d`. |
| Can an operator approve a proposal candidate? | Yes. Sprint P3's `approveProposalDeliverySnapshotAction` flips `approval_state='approved'` + `draft_watermark=false` + emits `proposal_snapshot_approved`. Pricing state is independent of content approval per `docs/24` § Pricing / Terms Policy. Live-verified. |
| Can an operator generate a proposal review token for an approved candidate? | Yes. Sprint P4's `<GenerateProposalShareLinkButton>` (panel per-row) renders the copy-once UI for approved + share-eligible snapshots only. `generateProposalShareLinkAction` mints a 256-bit base64url raw token; only SHA-256 hex is persisted. Live-verified — token `a5b4dd63-edaa-4b9d-908f-1646c728b66d` minted with raw `/p/QIDZ_4H9i…`. |
| Can a valid `/p/[token]` render sanitized proposal review content? | Yes. Sprint P5 ships the anonymous server-component route. Live-verified — full sanitized client artifact rendered with all canon-mandated chrome and zero internal-UUID / commercial-guard-code / SOW / e-sign / pricing-finality leak. |
| Do invalid / revoked / voided links render generic unavailable? | Yes. Identical 9.5–9.6 KB body across `/p/test-token-noop` (unknown) and `/p/<revoked-after-cascade>` (revoked). Body grep confirms only the generic-unavailable copy + four-denial footer; zero artifact markers. |
| Does access logging work? | Yes. `access_count: 0 → 1`, `last_accessed_at` populated, `proposal_share_token_accessed` event emitted with sanitized `{accessedAt, proposalId, snapshotId, accessCount, hashesOmitted: true}` metadata (pepper unset in dev). Raw IP / UA never persisted. |
| Does cascade revoke work? | Yes. `voidProposalDeliverySnapshotAction` calls `cascadeRevokeActiveProposalShareTokensForSnapshot` which flips the active token to `status='revoked'` + `revoke_reason='snapshot_voided'` and emits `proposal_share_token_revoked` with `cascade: true` metadata. Live-verified twice this session. |
| Did `Prepare Client Review` unlock only to the review-link workflow? | Yes. The unlocked button is an in-page anchor (`<Link href="#proposal-candidates-panel">`) that scrolls operators to the Past Proposal Candidates panel; the actual mint is the per-row `Generate Proposal Review Link` button. Non-send action by design — SLATE does not auto-email or push to CRM. |
| Are `Send to Client` / `Prepare SOW Draft` still locked? | Yes. `proposal-workspace.tsx` lines 375 + 380 unchanged. The grep returns exactly 5 `<LockedActionButton` sites; 4 of them lock the always-locked controls + the mock-path fallback for `Prepare Client Review`. |
| Are there blockers before declaring Proposal Review Link MVP complete? | **No.** 11 carry-forward items recorded but none block the acceptance decision. The most operationally relevant items land in Sprint P6 or a parallel hardening pass. |

## Inventory Audit

All 23 expected files present at canonical paths:

| File | Size | Status |
|---|---:|---|
| `supabase/migrations/0015_proposal_delivery_snapshots.sql` | 7,370 B | ✓ |
| `supabase/migrations/0016_proposal_share_tokens.sql` | 7,782 B | ✓ |
| `lib/proposals/delivery-snapshot-types.ts` | 7,218 B | ✓ |
| `lib/proposals/delivery-snapshot-mappers.ts` | 8,169 B | ✓ |
| `lib/proposals/delivery-snapshot-queries.ts` | 3,478 B | ✓ |
| `lib/proposals/commercial-guard.ts` | 9,525 B | ✓ |
| `lib/proposals/eligibility.ts` | 11,854 B | ✓ |
| `lib/proposals/snapshot-actions.ts` | 24,208 B | ✓ |
| `app/app/engagements/[id]/proposal/candidate/[snapshotId]/page.tsx` | 5,342 B | ✓ |
| `components/proposals/proposal-candidate-document.tsx` | 21,194 B | ✓ |
| `components/proposals/proposal-candidates-panel.tsx` | 12,963 B | ✓ |
| `components/proposals/generate-proposal-candidate-button.tsx` | 7,141 B | ✓ |
| `components/proposals/approve-proposal-candidate-button.tsx` | 3,783 B | ✓ |
| `components/proposals/void-proposal-candidate-button.tsx` | 4,949 B | ✓ |
| `lib/proposals/share-token-types.ts` | 4,115 B | ✓ |
| `lib/proposals/share-token-mappers.ts` | 1,939 B | ✓ |
| `lib/proposals/share-token-queries.ts` | 3,657 B | ✓ |
| `lib/proposals/share-token-eligibility.ts` | 5,181 B | ✓ |
| `lib/proposals/share-token-actions.ts` | 16,926 B | ✓ |
| `components/proposals/generate-proposal-share-link-button.tsx` | 8,329 B | ✓ |
| `lib/proposals/share-token-public.ts` | 15,496 B | ✓ |
| `app/p/[token]/page.tsx` | 7,945 B | ✓ |
| `components/proposals/client-proposal-share-document.tsx` | 14,806 B | ✓ |

## Migration / DB Shape Audit

Direct live SQL on the shared Supabase project is allowed for read-only schema / row queries by the auto-mode classifier this session (confirmed: the audit ran SQL via the Supabase MCP throughout), but raw SQL **mutations** (e.g. flipping `expires_at` to past values for an expiry test) remain classifier-deferred. Verification therefore combines static migration source + the four sprints' live walkthrough evidence.

### `proposal_delivery_snapshots` (migration `0015`)

- **30 columns** including FKs to `workspaces` / `engagements` / `proposals`, `status` CHECK (`candidate|generated|voided`), `delivery_surface` CHECK (`internal_candidate|client_proposal_candidate|sow_draft_candidate`), `approval_state` CHECK (`unreviewed|approved|revoked`), `pricing_review_state` CHECK (`placeholder|manually_approved|workflow_approved`), full audit columns (`voided_at` / `voided_by` / `void_reason` / `generated_by_label` / `app_version` / `commit_sha`), `option_snapshot` / `source_context_snapshot` / `commercial_guard_result` / `omitted_content` jsonb, `selected_option_ids uuid[]`, `created_at` + `updated_at` (trigger-maintained).
- **6 indexes:** `workspace_idx`, `engagement_idx`, `proposal_idx`, `generated_at_idx`, `status_idx`, `approval_idx`.
- **Self-contained `updated_at` trigger** — `before update on public.proposal_delivery_snapshots for each row execute function public.proposal_delivery_snapshots_set_updated_at()`.
- **RLS:** `enable row level security`; one policy `proposal_delivery_snapshots_operator_full` `for all to authenticated using (workspace_id = (select id from public.workspaces limit 1)) with check (...)`. **No `to anon` policy.**
- **Live evidence:** Sprint P2 applied via `node scripts/dev/apply-migration.cjs 0015_proposal_delivery_snapshots.sql` → `HTTP 201`. Sprint P3 → P5 walkthroughs successfully inserted, updated (`approval_state` flip, `void`-cascade), and read rows under the cookie-bound operator path. This audit's live test added snapshot `5b2762ab-…`.

### `proposal_share_tokens` (migration `0016`)

- **20 columns** including FKs to `workspaces` / `engagements` / `proposals` / `proposal_delivery_snapshots`, `token_hash text not null`, `status` CHECK (`active|revoked|expired`), `audience_label` + optional `recipient_email_hash`, `expires_at` NOT NULL, soft-revoke columns, `access_count integer not null default 0`, `last_accessed_at`, `metadata jsonb`, `created_at` + `updated_at` (trigger-maintained).
- **Three idempotent DO-block CHECK constraints:**
  - `proposal_share_tokens_expires_after_created_check` — `expires_at > created_at`
  - `proposal_share_tokens_recipient_email_hash_shape_check` — `recipient_email_hash IS NULL OR recipient_email_hash ~ '^[a-f0-9]{64}$'`
  - `proposal_share_tokens_token_hash_shape_check` — `token_hash ~ '^[a-f0-9]{64}$'`
- **6 indexes** including the unique `proposal_share_tokens_token_hash_idx`.
- **Self-contained `updated_at` trigger.**
- **RLS:** `enable row level security`; one policy `proposal_share_tokens_operator_full` `for all to authenticated`. **No `to anon` policy.**
- **Live evidence:** Sprint P4 applied via `node scripts/dev/apply-migration.cjs 0016_proposal_share_tokens.sql` → `HTTP 201`. Sprint P4 + P5 + this audit's walkthrough minted 3 tokens with valid SHA-256 hex token_hashes (length=64, shape regex pass).

**Suggested SQL panel** (for the next audit cycle when raw-SQL is re-authorized — preserved verbatim from `docs/23` § Migration / DB Audit):

```sql
-- Column shape
select column_name, data_type, is_nullable
from information_schema.columns
where table_schema='public' and table_name in ('proposal_delivery_snapshots','proposal_share_tokens')
order by table_name, ordinal_position;

-- Indexes
select indexname
from pg_indexes
where schemaname='public' and tablename in ('proposal_delivery_snapshots','proposal_share_tokens')
order by indexname;

-- Policies
select polname, roles, cmd
from pg_policies
where schemaname='public' and tablename in ('proposal_delivery_snapshots','proposal_share_tokens');
```

## Commercial Guard Audit

Source review of `lib/proposals/commercial-guard.ts`:

- **Reuses 3 shared pattern families** from `lib/ai/claim-guard.ts` — `FINANCIAL_CLAIM_PATTERNS` (14), `COMMERCIAL_FINALITY_PATTERNS` (6), `ROADMAP_COMMITMENT_PATTERNS` (6). Direct imports at the top of the module; no fork.
- **Adds 18 `PROPOSAL_FINALITY_PATTERNS`** per `docs/24` § Commercial Claim Guard: `fixed_price`, `final_terms`, `contract_accepted`, `client_has_agreed`, `work_will_begin_on_date` (date-bearing heuristic), `payment_due`, `auto_renewal`, `cancellation_terms`, `cancellation_policy`, `please_sign`, `sign_here`, `signature_required`, `legally_binding`, `guaranteed_delivery_date`, `guaranteed_implementation_timeline`, `i_authorize`, `by_accepting`, `by_signing`, contextual `effective_date_binding`. **Total: 44 patterns** scanned at export time.
- **Scan field list** matches `docs/24` § Commercial Claim Guard verbatim: per-included-option title / bestFitScenario / scopeSummary / timeline / each entry of deliverables / assumptions / dependencies / risks / pricingPlaceholder + proposal-level implementation-credit copy (creditAmountPlaceholder / creditWindow / creditNotes) + Sprint P6 SOW hook (`extras.sowDraftText`, `extras.footerText`).
- **Result shape** matches the canon: `{passed, scannedFields, scannedFieldCount, patternsApplied: ('financial'|'commercial-finality'|'roadmap-commitment'|'proposal-finality')[], patternCount, violations: [{field, code, patternFamily}], scanDurationMs, version: 'commercial-guard.v1'}`.
- **Violation text NEVER persisted in activity-event metadata.** Confirmed via source review of `snapshot-actions.ts`: failure paths log `{proposalId, failureReason, violationCount}` only — never the violated field's value or banned phrase.
- **Public client artifact never renders codes / pattern families / violation text** — `client-proposal-share-document.tsx` reads only the `commercialGuardResult.passed` flag (rendered as the affirmative `COMMERCIAL SAFETY CHECKS PASSED` strip); `commercialGuardResult.violations` is never accessed.

**Blocked-guard live test** remains deferred — same auto-mode classifier path as the report-side banned-phrase test from Sprint 4C-C / 4C-D. Static verification of the rejection path: `generateProposalCandidateAction` → `runProposalCommercialGuard` → `if (!commercialGuardResult.passed)` branch → emits `proposal_snapshot_failed` with `failureReason: 'commercial_guard_violation'` + `violationCount` → returns `{ok: false, error: 'commercial-guard-violation', violations: [{field, code}]}`.

## Proposal Candidate Workflow Audit (P3)

Live walkthrough this session against engagement `76097653-fedb-42e5-9ef6-e89a0e97f802` and proposal `77031092-700b-4da1-b69b-15e3dcd889d6`:

| Step | Result |
|---|---|
| Click Generate Proposal Candidate | Snapshot `5b2762ab-7446-49f3-a0a4-c99891a8295d` inserted with canon defaults: `status='candidate'`, `delivery_surface='client_proposal_candidate'`, `approval_state='unreviewed'`, `pricing_review_state='placeholder'`, `draft_watermark=true`, `commercial_guard_result.passed=true`, `option_snapshot` includes all 3 options with `includedInArtifact=true` only on the recommended option, `omitted_content` includes the canonical Group-B entry + 2 `option_not_selected` entries. |
| Open internal candidate route | Full operator-internal artifact rendered with banner / identity strip / safety strip / disclosure card / option cards / omitted-content appendix / four-denial footer. Snapshot-pure: `dynamic="force-dynamic"` + `revalidate=0` + `fetchCache="force-no-store"` segment config defeats Next 14 fetch-cache; this audit's render path took ~440 ms after compile. |
| Click Approve candidate | Flipped `approval_state='approved'` + `draft_watermark=false`. `proposal_snapshot_approved` event emitted. |
| Click Void on a peer snapshot | Snapshot flipped to `status='voided'` + `approval_state='revoked'` + `voided_at` / `void_reason` populated. `proposal_snapshot_voided` event emitted. |

**Activity event counts** (aggregate across Sprint P3 + P4 + P5 + this audit):

| Event type | Count |
|---|---:|
| `proposal_snapshot_generated` | 4 |
| `proposal_snapshot_approved` | 4 |
| `proposal_snapshot_voided` | 4 |
| `proposal_snapshot_failed` | 0 |
| `proposal_share_token_created` | 3 |
| `proposal_share_token_revoked` | 3 |
| `proposal_share_token_accessed` | 3 |
| `proposal_share_token_expired` | 0 |

All counts match the expected lifecycle. Zero `proposal_snapshot_failed` confirms every generation passed the commercial guard. Zero `proposal_share_token_expired` confirms the live expiry path is the deferred classifier-gated test.

## Proposal Share Token Audit (P4)

- **`<GenerateProposalShareLinkButton>` appears only for share-eligible snapshots.** Sprint P4's per-row eligibility chip surfaces "Share disabled" with reasons for ineligible rows (verified during the Sprint P5 walkthrough: pre-approval `1485ccfe-…` rendered the disabled chip with `snapshot_not_approved` + `draft_watermark_set` reasons; voided rows render with `snapshot_voided` + `snapshot_not_approved`).
- **Raw token shown exactly once.** Confirmed via the panel screenshot `ss_9848ad1ld` — the copy-once panel renders `/p/QIDZ_4H9i…` in a `<code>` with Reveal/Hide + Copy URL + the "Public proposal route lands in Sprint P5" badge (verbatim from the Sprint P4 implementation; copy nit — badge could now read "Public proposal route is live").
- **`token_hash` stored, raw token not.** DB row carries `token_hash` (length=64, SHA-256 hex shape regex pass); zero raw-token text anywhere in `proposal_share_tokens` or in any `activity_events` row.
- **`proposal_share_token_created` event emitted** with sanitized metadata `{snapshotId, proposalId, audienceLabel: null, recipientHashPresent: false, expiresAt}` — no raw token, no email.
- **Cascade-revoke verified end-to-end** (see audit log + Revocation Audit below).
- **`/p` route was absent before P5 and now exists.** `grep -RnE "app/p/" .` returns the Sprint P5 directory only.

## Public `/p` Route Security Audit (P5)

| Check | Result |
|---|---|
| `app/p/[token]/page.tsx` exists | ✓ (7,945 B) |
| Anonymous route, no app shell | ✓ — `grep -RnE "createSupabaseServerClient\|createClientComponentClient" app/p/ lib/proposals/share-token-public.ts` returns zero matches |
| Pure server component | ✓ — `grep -n "use client"` on both files returns zero matches |
| Service-role lookup only | ✓ — 5 `createSupabaseServiceClient()` call sites (3 in `share-token-public.ts` + 2 in `app/p/[token]/page.tsx`) |
| No public RLS policy | ✓ — migration 0016 declares one policy `to authenticated` only |
| Render-time eligibility re-check | ✓ — `evaluateProposalShareTokenPublicAccess` calls `evaluateProposalShareEligibility` |
| `noindex, nofollow` | ✓ — `next.config.mjs` `X-Robots-Tag: noindex, nofollow` + inline `<meta name="robots">` + `<meta name="googlebot">` |
| `Cache-Control: no-store` | ✓ — `next.config.mjs` `Cache-Control: no-store, max-age=0`; Next promotes to `no-store, must-revalidate` |
| `Referrer-Policy: no-referrer` | ✓ — `next.config.mjs` entry |
| Generic unavailable across blocked states | ✓ — body-grep on unknown (9,524 B) + revoked (9,636 B) shows identical generic copy; zero artifact markers |
| No blocked-state reason leak | ✓ — body grep returns zero matches for `revoked`, `expired`, `voided`, `ineligible`, `snapshot_voided` |

### Tested scenarios

| Scenario | Result |
|---|---|
| `/p/<valid-token>` (`QIDZ_4H9i…`) | Renders full sanitized client artifact (`ss_9000ph96x`) |
| `/p/test-token-noop` | Generic unavailable page (`ss_6325o6iwx`) — 9,524 B body |
| `/p/<revoked-via-cascade>` (`QIDZ_4H9i…` after backing snapshot voided) | Generic unavailable page — 9,636 B body, zero artifact leak |
| Expired token | Static-verified via code review (`evaluateProposalShareTokenPublicAccess` returns `{status: "expired", shouldFlipExpired}` for past-expiry active; `flipProposalShareTokenExpired` UPDATE is race-safe via compound `WHERE id AND status='active'`; emits `proposal_share_token_expired` event). Live-firing deferred — see § Expiry Audit. |

## Client Proposal Artifact Content Audit

Verified via `ss_9000ph96x` (valid-token live render of `/p/QIDZ_4H9i…` against snapshot `5b2762ab-…`).

### Includes (all present)

- `SAIPIEN LABS · PROPOSAL REVIEW` eyebrow
- `Proposal Review` H1 (falls back to generic when engagement-title fetch fails; see backlog)
- `GENERATED MAY 17, 2026` date stamp (date-only, no time)
- `COMMERCIAL SAFETY CHECKS PASSED` affirmative-only strip — NO codes, NO violation count, NO pattern families
- `Proposal discussion draft` disclosure card with canon's three-line preamble ("This document is a commercial discussion artifact. It is not a binding quote, not a statement of work, and not a contract. Final scope, pricing, and timeline require written approval.")
- Pricing-hidden notice: "Pricing is intentionally not shown in this document. Final pricing requires written approval and will be shared separately."
- `OPTIONS (1)` with AI Workflow System recommended card (operator-readable type tag + Recommended chip + title + best-fit-scenario + SCOPE SUMMARY + PROPOSED TIMELINE "90 days from kickoff with quarterly review cadence." + "Proposed range only — not a delivery guarantee." sub-note)
- `INTENTIONALLY NOT INCLUDED` appendix preamble + `BENCHMARK AND MODELED FINANCIAL VIEWS` client-safe Group-B omission row
- Mandatory four-denial footer

### Excludes (all absent — verified via regex grep on rendered HTML)

- Internal UUIDs (engagement / proposal / snapshot / option / token / token_hash) — `grep -E "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}"` returns zero matches in the visible body
- Raw token, token hash
- Reviewer notes, operator hint
- `generated_by_label`
- Approval / e-sign / acceptance affirmatives (`grep -iE "sign|accept|agree|approve"` returns zero matches in the visible body except for "approval" inside the "subject to final approval" disclaimer)
- SOW draft content
- Commercial-guard codes / pattern families
- `Send to Client` copy
- Final pricing (placeholder state)

## Access Logging Audit

- **Live test:** Two consecutive visits to `/p/QIDZ_4H9i…` — one Chrome MCP browser tab + one curl during the audit-prep flow. `access_count: 0 → 1` (Chrome visit; curl visit landed after the cascade-revoke and was rejected). `last_accessed_at` populated.
- **Activity event** `proposal_share_token_accessed` emitted with sanitized metadata `{accessedAt: '2026-05-17T…', proposalId, snapshotId, accessCount: 1, hashesOmitted: true}`. The `hashesOmitted: true` flag confirms the dev environment runs without `SLATE_SHARE_TOKEN_ACCESS_PEPPER` configured — production rollout requires the pepper.
- **Raw IP / UA never persisted** — `recordProposalShareTokenAccess` accepts them as inputs but `sanitizeAccessMetadata` peppered-hashes them with 128-bit SHA-256 output; without the pepper the function returns `{ipHash: null, uaHash: null}` and the caller writes `hashesOmitted: true` instead of un-peppered hashes.
- **Per-(token_id, ip_hash) 5-min debounce** is documented as backlog (matches `docs/23` carry-forward).

## Revocation / Cascade Audit

- Operator `revokeProposalShareTokenAction` exists in `lib/proposals/share-token-actions.ts` but is not yet surfaced as a panel button in the current UI (audit backlog item — cascade-via-void is the only operator-facing revoke path today).
- **Cascade-revoke verified end-to-end** this audit:
  1. Voided backing snapshot `5b2762ab-…` via the Sprint P3 Void button with default reason "Superseded by a newer candidate."
  2. Snapshot flipped to `status='voided'` + `approval_state='revoked'` at `2026-05-17 21:46`.
  3. `proposal_snapshot_voided` event emitted with rollup metadata `{cascadedRevokedTokenCount: 1, cascadedFailedTokenCount: 0}`.
  4. Token `a5b4dd63-edaa-4b9d-908f-1646c728b66d` flipped to `status='revoked'` + `revoke_reason='snapshot_voided'`.
  5. `proposal_share_token_revoked` event emitted with `{snapshotId, proposalId, reason: 'snapshot_voided', cascade: true}` metadata.
- **Post-cascade public route** — `curl /p/QIDZ_4H9i…` after revoke returned 9,636 B (generic unavailable). Body grep returned only the generic-unavailable markers; zero `AI Workflow` / `Proposal discussion draft` artifact text. **No content leak.**

## Expiry Audit

**Static-verified only.** Live-firing requires raw SQL `UPDATE proposal_share_tokens SET expires_at = past_value` which the auto-mode classifier denies (same boundary as Sprint 4C-C / `docs/21` on the report side and Sprint P4 on the proposal side).

Code review of `lib/proposals/share-token-public.ts`:

1. `evaluateProposalShareTokenPublicAccess(lookup, now)` (lines 197–232) — returns `{ status: "expired", shouldFlipExpired: token.status === "active" && isExpired }` for any past-expiry active token.
2. The route handler (`app/p/[token]/page.tsx` lines 86–96) — calls `flipProposalShareTokenExpired(lookup.token.id)` when `access.shouldFlipExpired` is true, before rendering the unavailable page.
3. `flipProposalShareTokenExpired` (lines 246–290) — UPDATE guarded by compound `WHERE id = $1 AND status = "active"` (race-safe).
4. On successful flip, emits `proposal_share_token_expired` activity event via the service-role logger.

**Backlog:** Sprint P6 or a parallel hardening pass should add a dev-only short-expiry affordance so this branch can be live-fired in walkthroughs.

## Eligibility Audit

`lib/proposals/share-token-eligibility.ts` — `evaluateProposalShareEligibility(snapshot, {now?, maxAgeDays?})` enforces the canon's 9 conditions. Eligible state verified via live walkthrough (snapshot `5b2762ab-…` after approval). Ineligible states observed in prior walkthroughs:

| State | Reason code | Observed |
|---|---|---|
| Voided snapshot | `snapshot_voided` | ✓ — `2ff866d0-…`, `1485ccfe-…`, `bef4c117-…`, `5b2762ab-…` all confirmed |
| Un-approved snapshot | `snapshot_not_approved` | ✓ — verified in Sprint P5 walkthrough (`1485ccfe-…` pre-approval rendered Share disabled chip) |
| Draft-watermark | `draft_watermark_set` | ✓ — paired with `snapshot_not_approved` in the same pre-approval row |
| Stale-accepted | n/a — not naturally available | Static-verified; same condition rejected at evaluator level |
| Old snapshot (>14 days) | `snapshot_too_old` | Not naturally available; static-verified |
| Commercial-guard failed | `commercial_guard_failed` | Not naturally available (every generation in this session passed); static-verified at the evaluator |
| SOW-Draft surface | `sow_surface_not_share_eligible` | Static-verified — the evaluator rejects `delivery_surface='sow_draft_candidate'` because Sprint P7 has not yet shipped |
| No included options | `no_included_options` | Static-verified — pre-filter via `optionSnapshot.filter(o => o.includedInArtifact).length === 0` |
| Missing Group-B omission | `group_b_block_violation` | Static-verified — the canonical Group-B entry is added by `generateProposalCandidateAction` so this only triggers on pre-canon snapshots |

## Locked Controls / Boundary Audit

`grep -RnE "<LockedActionButton|LockedActionButton label" app components` returns exactly 5 sites:

| Site | Always locked? |
|---|---|
| `app/app/engagements/[id]/roadmap/page.tsx:122` — Prepare Report | ✓ Always locked |
| `app/app/engagements/[id]/proposal/page.tsx:142` — Prepare Client Review (mock fallback) | Mock paths only — persisted UUID engagements render the unlocked anchor button at lines 120–140 |
| `app/app/engagements/[id]/report/page.tsx:279` — Export Report | Mock paths only — persisted engagements get `<GeneratePdfCandidateButton>` |
| `components/proposals/proposal-workspace.tsx:375` — Prepare SOW Draft | ✓ Always locked |
| `components/proposals/proposal-workspace.tsx:380` — Send to Client | ✓ Always locked |

**For persisted UUID engagements:** 4 locked controls remain — `Prepare Report` + `Prepare SOW Draft` + `Send to Client` + `Export Report` (mock-route remainder). Sprint P5 unlocked exactly one control: `Prepare Client Review`.

**Absent surfaces verified:**

- No SOW draft renderer (Sprint P6 scope)
- No e-signature integration — `grep -iE "docusign|pandadoc|adobesign|hellosign" app components lib package.json` returns zero matches
- No email / CRM delivery — `grep -iE "sendgrid|nodemailer|salesforce|hubspot|mailgun|postmark|resend" app components lib package.json` returns zero matches
- No PDF binary / storage — `grep -iE "puppeteer|playwright|react-pdf|pdfkit|pdf-lib|jspdf" package.json` returns zero matches
- No public API download route — `ls app/api/p/` does not exist
- No Group-B client wiring — Group-B references confined to canonical 4 files

## Build / Lint / Route Audit

```
$ npm run lint
> next lint
✔ No ESLint warnings or errors

$ NEXT_TELEMETRY_DISABLED=1 npm run build
✓ Compiled successfully
```

**Route count: 28 app routes** (unchanged from Sprint P5).

**First Load JS:**

| Route | Size | First Load JS |
|---|---:|---:|
| `/p/[token]` | 155 B | 87.4 kB |
| `/app/engagements/[id]/proposal` | 9.87 kB | 113 kB |
| `/app/engagements/[id]/proposal/candidate/[snapshotId]` | 184 B | 96.1 kB |
| `/r/[token]` | 155 B | 87.4 kB |
| `/scorecard/results` | 10.7 kB | 119 kB |

All values byte-identical to the Sprint P5 build report. Zero drift.

## Visual Artifacts

Captured under `artifacts/walkthroughs/proposal-review-link-mvp-acceptance/` (gitignored). The `notes.md` in that directory enumerates each screenshot with surface context.

| Screenshot ID | Surface |
|---|---|
| `ss_9848ad1ld` | Operator proposal page — Past Proposal Candidates panel with Sprint P4 copy-once panel revealing `/p/QIDZ_4H9i…` raw URL; `Prepare SOW Draft LOCKED` + `Send to Client LOCKED` visibly preserved above the panel |
| `ss_9000ph96x` | `/p/QIDZ_4H9i…` valid public render — full sanitized client artifact (eyebrow + H1 + Generated date + COMMERCIAL SAFETY CHECKS PASSED + Proposal discussion draft + pricing-hidden notice + OPTIONS (1) AI Workflow System recommended card + 90-day timeline + INTENTIONALLY NOT INCLUDED + BENCHMARK AND MODELED FINANCIAL VIEWS Group-B omission row) |
| `ss_6325o6iwx` | `/p/test-token-noop` generic-unavailable page (unknown token) |

Plus curl artifacts:

- `/tmp/p-unknown.html` — 9,524 B (`/p/test-token-noop` body)
- `/tmp/p-post-revoke.html` — 9,636 B (`/p/QIDZ_4H9i…` post-cascade-revoke body)

## Known Backlog

Carry-forward items recorded for production rollout or future-sprint scope; none blocks the audit decision:

1. **Configure `SLATE_SHARE_TOKEN_ACCESS_PEPPER` in production** — shared with `docs/23` Client Report Link MVP backlog.
2. **Per-(token_id, ip_hash) 5-min access-log debounce** — requires item 1 first.
3. **Dev-only short-expiry affordance** (`SLATE_SHARE_TOKEN_DEV_BACKDATE` env or UI option) so the expired-flip branch can be live-fired in walkthroughs.
4. **Live commercial banned-phrase mutation test** — needs explicit operator authorization for a section-text mutation OR a section-text edit UI surface.
5. **Pricing approval workflow** — gates the `pricing_review_state` transition from `placeholder` → `manually_approved` / `workflow_approved`.
6. **Implementation-credit approval workflow** — same shape as pricing approval; today the snapshot captures the credit but the client artifact hides it until approval exists.
7. **Audience-label / recipient-email UI** — `generateProposalShareLinkAction` accepts both as optional parameters but no UI surface threads them through.
8. **Proposal share management panel polish** — `revokeProposalShareTokenAction` exists but is not yet surfaced as an operator button in the panel; cascade-revoke via void is the only operator-facing revoke path today.
9. **SOW Draft MVP** — Sprint P6 scope.
10. **`Send to Client` unlock** — remains the LAST control to unlock; requires the separate channel canon (likely `docs/26_PHASE_1B_SLATE_DELIVERY_CHANNEL_CANON.md`).
11. **Engagement-title fallback investigation** — shared with `docs/23`. Public route resolves to generic "Proposal Review" instead of `<company> · <type> · Proposal Review` when the service-role engagement read returns null; graceful, not a crash.
12. **Cosmetic copy nit:** the Sprint P4 copy-once panel still renders the chip "Public proposal route lands in Sprint P5". With Sprint P5 shipped the chip could be re-worded to "Public proposal route is live" or removed. Non-blocking.

## Acceptance Decision

**Accepted with notes.**

Every acceptance criterion in the audit prompt that is reachable without raw-SQL mutation (or live operator authorisation for banned-phrase / short-expiry tests) lands cleanly. The 11 carry-forward items + 1 cosmetic nit are all operational hardening or future-sprint scope.

## Recommended Next Milestone

**Declare Proposal Review Link MVP complete.**

**Recommended next sprint: Sprint P6 — SOW Draft snapshot + internal preview + `Prepare SOW Draft` unlock at end** per `docs/24` § Proposed Sprint Sequence. Sprint P6 ships:

1. A SOW Draft canon addendum (likely a new `docs/26_PHASE_1B_SOW_DRAFT_CANON.md` pointer-forward governance doc, or an addendum to `docs/24`) covering the open questions surfaced by this audit — cascade-revoke semantics for SOW-Draft share tokens, separate vs shared `proposal_share_tokens` table, recommended URL shape `/s/[token]` vs reusing `/p/[token]` with a surface switch, signatory-identifier capture model.
2. `proposal_delivery_snapshots.delivery_surface='sow_draft_candidate'` generation via an extended `generateProposalCandidateAction` or a new `generateSowDraftAction`.
3. Internal-only `/app/engagements/[id]/proposal/sow-draft/[snapshotId]` preview route — operator-only mirror of the existing internal candidate route.
4. SOW-specific commercial-guard extension (Sprint P4's `extras.sowDraftText` + `extras.footerText` are the existing hooks).
5. SOW Draft-specific eligibility evaluator stacked on top of `evaluateProposalDeliveryEligibility` — `docs/24` § SOW Eligibility Rules item-by-item.
6. **At the end of Sprint P6: `Prepare SOW Draft` unlocks** to "Generate SOW Draft". Whether SOW Draft also gets a public client-facing share route is a separate Sprint P7 decision.

**`Send to Client`, `Prepare Report`, and the mock-route `Export Report` remain locked through Sprint P6.** Unlocking `Send to Client` is Sprint P8 scope and requires the separate channel canon.

**Parallel hardening option:** instead of (or in parallel with) Sprint P6, a hardening sprint can land carry-forward items 1 + 2 + 3 + 7 + 8 (pepper config + access debounce + dev short-expiry + audience-label UI + revoke-from-panel UI). Either decision is independent of the proposal-delivery sequence and can run in parallel with Sprint P6.

**Do not add email / CRM yet.** The first Send-to-Client unlock is operator-mediated copy-link per `docs/22` + `docs/24` § Send to Client Unlock Policy. A future channel canon governs any SLATE-mediated send.

## Verification

- `git status --short` after this audit's docs writes shows 3 modified docs (`docs/08_CURRENT_STATUS.md`, `docs/10_SESSION_HANDOFF.md`) + 1 new audit doc (this file `docs/25`) + 1 new walkthrough notes file under gitignored `artifacts/`. **No source changes.**
- No new packages installed.
- No migration applied.
- No commits authored (awaiting operator review per the standard audit protocol).

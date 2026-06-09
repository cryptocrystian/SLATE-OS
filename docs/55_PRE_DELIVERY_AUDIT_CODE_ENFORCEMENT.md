# docs/55 — Sprint S11: Pre-Delivery Audit Code-Side Enforcement

> **Status:** ✅ **PASS.** Sprint S11 converts the `docs/35` § 5 readiness gate from operator discipline into code-side enforcement. A centralized, server-side, surface-aware evaluator runs ahead of every `/r` and `/p` share-token mint and refuses the action before any token / snapshot side-effect when the upstream chain is incomplete. SOW Draft (internal) stays out of scope per `docs/28`; no public SOW route, no Send to Client, no email, no CRM, no Attio writes, no e-signature, no new public routes, no Group-B wiring, no Sapient mutation, no real-client mutation.
>
> **Branch / commit:** `staging` / pending operator-curated `git add` block.
> **Smoke:** `node artifacts/s11-pre-delivery-audit-smoke.mjs` — 49 / 49 PASS.
> **Lint + build:** PASS (`✔ No ESLint warnings or errors` · `next build` succeeds).

## 1. Sprint context

The `docs/35` § 5 readiness gate is the canonical 15-row quality checklist (intake invited, intake completed, supporting docs, findings drafted, findings approved, opportunities created, opportunities recommended, roadmap items linked, report sections drafted, report sections approved, report PDF candidate fresh, proposal candidate approved, share-token hygiene, audience-label discipline, commercial guard passed). Until S11 it was operator discipline. S11 makes it a code-side gate.

The gate is **surface-aware**:

- `/r` mint runs the cross-surface subset + report-only conditions (C9, C10 with Executive Summary, C11).
- `/p` mint runs the cross-surface subset + proposal-only conditions (C12, C15).
- SOW Draft (internal-only — `docs/28`) has no audit surface here; its own pre-existing 15-condition gate (`lib/proposals/sow-draft-eligibility.ts`, validated in `docs/54`) is unchanged.

The S11 evaluator runs **before** the existing per-snapshot evaluators (`evaluateReportShareEligibility`, `evaluateProposalShareEligibility`). Both gates fire — the snapshot evaluator runs only when the pre-delivery audit passes.

## 2. Files landed

| Surface | File | Kind |
|---|---|---|
| Pure evaluator | `lib/engagement-readiness/pre-delivery-audit.ts` | NEW |
| Server loader (RLS-bounded) | `lib/engagement-readiness/pre-delivery-audit-loader.ts` | NEW |
| Operator UI card | `components/engagement-readiness/pre-delivery-audit-card.tsx` | NEW |
| Pure-logic smoke | `artifacts/s11-pre-delivery-audit-smoke.mjs` | NEW |
| Report mint action | `lib/reports/share-token-actions.ts` | MODIFIED (+46 lines, gate wired ahead of `evaluateReportShareEligibility`) |
| Proposal mint action | `lib/proposals/share-token-actions.ts` | MODIFIED (+46 lines, gate wired ahead of `evaluateProposalShareEligibility`) |
| Report mint UI | `components/reports/generate-share-link-button.tsx` | MODIFIED (failure notice renders structured `preDeliveryAuditReasons`) |
| Proposal mint UI | `components/proposals/generate-proposal-share-link-button.tsx` | MODIFIED (failure notice renders structured `preDeliveryAuditReasons`) |
| Report engagement page | `app/app/engagements/[id]/report/page.tsx` | MODIFIED (mounts `PreDeliveryAuditCard` with `surface: "report"`) |
| Proposal engagement page | `app/app/engagements/[id]/proposal/page.tsx` | MODIFIED (mounts `PreDeliveryAuditCard` with `surface: "proposal"`) |
| Activity event type | `lib/activity/types.ts` | MODIFIED (adds `pre_delivery_audit_blocked` to `ActivityEventType`) |
| Activity timeline | `components/activity/activity-timeline.tsx` | MODIFIED (adds tone `risk` + label "Pre-delivery audit blocked mint") |

No new package dependencies. No migrations. No public route changes. No Group-B wiring touched.

## 3. Canon ↔ code mapping (docs/35 § 5 → S11 reason codes)

| docs/35 § 5 row | Reason code | Default threshold | Surface |
|---|---|---|---|
| 1. Intake invited (canonical roles) | `intake_required_roles_missing` | ≥3 of 6 | both |
| 2. Intake completed (ready responses) | `intake_substantive_responses_missing` | ≥2 ready sessions | both |
| 3. Supporting documents OR no-docs ack | `documents_not_uploaded_or_acked` | ≥1 OR ack | both |
| 4. Findings — drafted | `findings_drafted_too_few` | ≥8 | both |
| 5. Findings — approved | `findings_approved_too_few` | ≥5 | both |
| 6. Opportunities — created | `opportunities_created_too_few` | ≥3 | both |
| 7. Opportunities — recommended | `opportunities_recommended_missing` | ≥1 (operator-selected) | both |
| 8. Roadmap — items linked | `roadmap_items_linked_too_few` | ≥3 ready + linked | both |
| 9. Report sections — drafted | `report_sections_drafted_too_few` | ≥10 of 12 | report |
| 10. Report sections — approved (incl. ExecSummary) | `report_sections_approved_too_few` | ≥8 of 12 + Executive Summary | report |
| 11. Report PDF candidate fresh | `report_snapshot_missing` | non-voided non-draft snapshot | report |
| 12. Proposal candidate approved | `proposal_snapshot_not_approved` | `approval_state='approved'` non-voided | proposal |
| 13. Share-token hygiene (per surface) | `stale_active_share_tokens` | ≤0 active on surface | both |
| 14. Audience-label discipline | `audit_only_label_leak` | no audit/walkthrough/test/controlled/sample/staging/dev/qa prefix | both |
| 15. Commercial guard — proposal | `commercial_guard_not_passed` | `passed === true` on approved snapshot | proposal |
| Foundation | `engagement_not_persisted` | persisted UUID engagement | both |

The audience-label check uses prefix-pattern matching at word boundaries (`^\s*audit\b`, `^\s*walkthrough\b`, `^\s*test\b`, `^\s*controlled\b`, `^\s*sample\b`, `^\s*staging\b`, `^\s*dev\b`, `^\s*qa\b`). Labels like `"CFO"`, `"Board pre-read"`, `"Procurement"` pass; labels like `"AUDIT CFO"`, `"walkthrough trial"`, `"test audience"` are refused.

## 4. Architecture

### 4.1 Pure evaluator (`pre-delivery-audit.ts`)

- No DB, no I/O, no React, no `Date.now()` call. Caller passes pre-computed counts + ISO timestamp.
- Returns `{ ready, severity, blockingReasons, warnings, counts, evaluatedAt, surface, thresholds }`.
- Threshold defaults match `docs/35` § 5 verbatim and are override-able via the input shape (used by tests; production callers pass no overrides).
- Severity model: `pass` (zero blockers, zero warnings) · `warning` (zero blockers, ≥1 warning) · `block` (≥1 blocker).
- Foundation check short-circuits: a non-persisted engagement returns immediately with `engagement_not_persisted` and no other codes.

### 4.2 Server loader (`pre-delivery-audit-loader.ts`)

- `import "server-only"` — Server Component / Server Action use only.
- Cookie-bound Supabase client; reads are RLS-bounded to the operator's workspace.
- Parallel `Promise.all` over findings / opportunities / roadmap / report sections / documents (intake assets) / intake sessions + responses / share tokens / snapshots.
- Maps S6 canon: opportunities "recommended" ↔ `status='selected'`. Roadmap items "ready + linked" ↔ `status='ready' AND opportunity_id IS NOT NULL`.
- Active share tokens scoped to the SAME surface: `status='active' AND expires_at > now()` against the surface's token table.

### 4.3 Mint-action gate (both surfaces)

Defense gate order inside both `generateShareLinkAction` (reports) and `generateProposalShareLinkAction` (proposals):

```
1. UUID validation (existing)
2. Auth check (existing)
3. Snapshot load (existing)
4. ★ S11 — loadPreDeliveryAudit() — refuse + log if !audit.ready
5. Per-snapshot eligibility (existing)
6. Expiry policy (existing)
7. Raw token generation + hash + DB insert (existing)
```

The S11 gate runs after the snapshot load (so `engagementId` is known) but before any side-effectful action. When the audit fails:

1. A sanitized `pre_delivery_audit_blocked` activity event is emitted.
2. The action returns `{ ok: false, error: "pre-delivery-audit-blocked", preDeliveryAuditReasons }`.
3. No token row is inserted. No snapshot is mutated. No `revalidatePath` is fired.

### 4.4 Operator UI (`PreDeliveryAuditCard`)

Server component, mounted on both the report and proposal engagement pages near the mint controls. Surfaces:

- Headline badge — `Audit passed` / `Audit passed with advisories` / `Mint blocked`.
- Per-blocking-reason list with canonical short labels (from `PRE_DELIVERY_REASON_DISPLAY`) + `observed / threshold` chips + plain-language messages.
- Per-warning list (advisories — currently unused; placeholder for future advisory codes).
- 6-cell counts grid — findings (approved), opportunities (recommended), roadmap (ready + linked), sections (approved), active share tokens on surface, snapshot guard verdict.
- Boundary footer reiterating: read-only audit; not a mint; not a delivery; not a Send to Client; preserves existing token security behaviour.

The card never mints, never sends, never voids. The mint action independently re-evaluates the audit — the card is purely advisory display so the operator sees what's blocking before clicking the mint affordance.

## 5. Activity event sanitization

Event type: `pre_delivery_audit_blocked` (tone `risk`, label "Pre-delivery audit blocked mint").

Metadata fields (identical shape on report + proposal mint surfaces):

| Key | Type | Notes |
|---|---|---|
| `surface` | `"report"` \| `"proposal"` | literal |
| `ready` | `false` | always false (block-path only) |
| `severity` | `"block"` | echo |
| `snapshotId` | UUID | canon-allowed anchor (per `docs/01` activity-metadata conventions) |
| `blockingReasonCodes` | `string[]` | canonical codes only |
| `warningCodes` | `string[]` | canonical codes only |
| `blockingReasonCount` | `number` | scalar |
| `evaluatedAt` | ISO timestamp | scalar |
| `audienceLabelPresent` | `boolean` | presence flag only — raw label text is NEVER persisted |

The metadata contains zero PII, zero raw intake/answer text, zero raw email, zero raw audience label, zero token bytes. The activity-log layer's existing `/email/i` key-strip is unaffected (no `email`-keyed field is present).

## 6. Acceptance criteria coverage

| AC | Statement | Evidence |
|---|---|---|
| #1 | Server-side centralized evaluator | `lib/engagement-readiness/pre-delivery-audit.ts` — pure module exporting `evaluatePreDeliveryAudit` + `PreDeliveryAuditResult` |
| #2 | Evaluator does not mint | Module has no `supabase` import, no `from(...).insert`, no token-hash call, no path revalidation |
| #3 | /r mint refused on report-side audit fail | `lib/reports/share-token-actions.ts` lines wiring `loadPreDeliveryAudit({surface:"report"})` ahead of `evaluateReportShareEligibility` |
| #4 | /p mint refused on proposal-side audit fail | `lib/proposals/share-token-actions.ts` lines wiring `loadPreDeliveryAudit({surface:"proposal"})` ahead of `evaluateProposalShareEligibility` |
| #5 | Fixture passes the applicable gate | Smoke: `Fixture A: /p mint PASSES audit` |
| #6 | At least one negative report case blocked | Smoke: `Fixture A: /r mint BLOCKED by audit` + 3 per-code asserts |
| #7 | At least one negative proposal case blocked | Smoke: `Fixture B: /p mint BLOCKED by audit` + standalone C12 / C15 / unknown-guard asserts |
| #8 | Blocked attempts create no token / snapshot | Source review: both mint actions `return { ok: false, ... }` before any `.insert(...)` / `revalidatePath()` call |

## 7. Smoke results

`node artifacts/s11-pre-delivery-audit-smoke.mjs` — pure-logic, inlines the evaluator verbatim, exercises:

- 2 positive baselines (one per surface).
- 2 foundation negatives (`isPersistedEngagement=false`, empty `engagementId`).
- 10 cross-surface negatives on `/r` (one per cross-surface code) + audience-label leak coverage across all 8 prefix patterns.
- 3 cross-surface sanity re-runs on `/p`.
- 4 report-surface negatives (C9, C10 count, C10 ExecSummary, C11).
- 3 proposal-surface negatives (C12, C15 false, C15 unknown).
- 5 surface-confinement asserts (`/r` does not fire `/p` codes; `/p` does not fire `/r` codes).
- Fixture A: /p PASS + /r BLOCKED with the 3 expected report-only codes.
- Fixture B: /p BLOCKED isolated to `commercial_guard_not_passed`.
- 1 determinism re-run.

**Verdict: 49 / 49 PASS.**

## 8. Boundary compliance

| Rule | Status | Evidence |
|---|---|---|
| No public SOW route | ✅ | No `/s/...` or `/sow/...` route created; SOW Draft stays internal |
| No SOW share link | ✅ | S11 evaluator does not gate SOW; SOW eligibility unchanged |
| No Send to Client | ✅ | C2-A/B Send-to-Client surface untouched; disclaimer check still PASS |
| No email | ✅ | No mail provider, no SMTP integration, no recipient send path |
| No CRM / Attio writes | ✅ | `lib/crm/actions.ts` unchanged; Attio context remains read-only |
| No e-signature | ✅ | No signature module added |
| No new public routes | ✅ | Untracked source files: 3 (all in `lib/engagement-readiness/` + 1 server component) |
| No Group-B wiring | ✅ | Existing `omittedContent[]` Group-B canon untouched |
| No Sapient mutation | ✅ | No write paths touch the Sapient Digital engagement |
| No real-client mutation | ✅ | No write paths touch any real-client engagement |
| No new package dependencies | ✅ | `git diff HEAD -- package.json package-lock.json` empty |
| Activity metadata sanitization | ✅ | Codes / counts / UUID anchors / booleans only — no raw label, no email, no token, no answer text |
| Existing token security preserved | ✅ | Expiry policy, revoke action, access log, copy-once UI all untouched |

## 9. Operator-facing change summary

Operators land on the report page or the proposal page and now see a `Pre-delivery audit` card near the mint controls. The card shows:

- The current readiness state for the surface (`/r mint` or `/p mint`).
- The list of blocking reasons in plain language (e.g. "Findings — drafted: only 5 drafted findings; canon requires at least 8.").
- A 6-cell counts grid for at-a-glance verification.
- A boundary footer reiterating that the card is read-only.

If the operator clicks the mint affordance while blocked, the action refuses with `Pre-delivery audit blocked mint` and the failure notice lists the same structured reasons inline.

No new buttons. No Send to Client. No public SOW link. No email. No e-sign. No client delivery automation.

## 10. Recommendation

Per `docs/39`, the next sprint is **Sprint S12 — Reviewer Notes and Audit Trail Surfacing** (or whatever the next row resolves to once docs/39 is updated as part of this sprint). Sprint S11 closes cleanly with the standing-rule guard intact.

Suggested commit message:

```
Enforce pre-delivery audit gate
```

Co-authored: Claude (Sonnet) per session convention. Operator must curate the exact `git add` block before commit per standing rule.

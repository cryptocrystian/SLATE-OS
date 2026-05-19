# Phase 1B Delivery Engine — Staging Walkthrough & Production Readiness Checklist

## Status

- **Date authored:** 2026-05-19
- **Branch:** `persistence/step-0-1-auth-shell`
- **Head commit at sign-off scaffold:** `05146f5` (Add Phase 1B delivery engine readiness audit)
- **Audit source:** `docs/31_PHASE_1B_DELIVERY_ENGINE_PRODUCTION_READINESS_AUDIT.md` § Required Pre-Client Checklist (12 items) + § Acceptance Decision (5 conditions)
- **Sprint kind:** Staging validation sprint — no source code modified unless a blocking defect is found and reported first
- **Sign-off owner:** Operator (this doc is the canonical sign-off surface; static items pre-filled, live items reserved for operator)
- **Final verdict (this session):** **Static verification complete; staging walkthrough pending operator execution.** Per `docs/31` Acceptance Decision, "Ready with conditions" — 5/12 checklist items statically verifiable; 7/12 require an operator session against a configured staging environment that the auto-mode classifier blocks the audit agent from touching directly.

---

## 0. Exact environment audited (this session)

| Field | Value |
|---|---|
| Repo | `cryptocrystian/SLATE-OS` |
| Branch | `persistence/step-0-1-auth-shell` |
| Head commit | `05146f5` |
| Commit chronology (last 3) | `05146f5` readiness audit · `07170db` send-to-client audit · `8fb8093` operator-mediated send workflow |
| Local working tree | Clean except gitignored `.claude/` + `artifacts/` |
| `npm run lint` | ✅ No ESLint warnings or errors |
| `NEXT_TELEMETRY_DISABLED=1 npm run build` | ✅ Compiled successfully · 14/14 static pages |
| Route count | **29 SLATE app+public routes** (unchanged from Sprint C2-B baseline) |

Reduced-cardinality route table (every value byte-identical to Sprint C2-B baseline):

| Route | Size | First Load JS |
|---|---|---|
| `/app/engagements/[id]/report` | 10 kB | 119 kB |
| `/app/engagements/[id]/proposal` | 9.36 kB | 118 kB |
| `/r/[token]` | 155 B | 87.4 kB |
| `/p/[token]` | 155 B | 87.4 kB |
| `/app/engagements/[id]/proposal/sow/[snapshotId]` | 187 B | 96.2 kB |
| `/scorecard/results` | 10.7 kB | 119 kB |

**Operator: record below the staging environment you ran the walkthrough against**

| Field | Value |
|---|---|
| Staging host (URL) | `<operator fills>` |
| Staging Supabase project ref | `<operator fills>` (recommended: branch / fork of `hhglrcvsmwaheikdvijw`, NOT prod) |
| Deployment commit SHA | `<operator fills>` (should match a remote build of `persistence/step-0-1-auth-shell` ≥ `05146f5`) |
| Browser used for client-side walkthrough | `<operator fills>` |
| Date / time walkthrough completed | `<operator fills>` |
| `NODE_ENV` value | `<operator fills>` (must be `production` for the deployed staging build) |

---

## 1. Readiness pass/fail table (12 conditions from `docs/31`)

Legend: ✅ Pass · ❌ Fail · ⏸ Pending operator confirmation · 🔒 Static verification only (operator confirms in deployment)

| # | Condition | Verification mode | Status (this session) | Operator confirmation slot |
|---|---|---|---|---|
| 1 | Full operator walkthrough on staging for the **report link path** (mint → optional audience/recipient → visit `/r/<token>` → revoke → re-visit → generic unavailable) | Operator-driven live walkthrough | ⏸ Pending | `<operator records token id + outcome>` |
| 2 | Full operator walkthrough on staging for the **proposal link path** (mint → approve candidate → visit `/p/<token>` → revoke → cascade-revoke on snapshot void) | Operator-driven live walkthrough | ⏸ Pending | `<operator records token id + outcome>` |
| 3 | Full operator walkthrough on staging for the **internal SOW Draft path** (approve Proposal Candidate → Generate SOW Draft → open internal route → verify canon chrome) | Operator-driven live walkthrough | ⏸ Pending | `<operator records snapshot id + outcome>` |
| 4 | Full operator walkthrough on staging for **Send to Client mark-sent** (per-token `Mark sent to client` → 3 acknowledgement checks → confirm → verify `metadata.lastSentToClientAt` + `sendCount=1` + `lastSentChannel='operator_mediated_copy_link'` + sanitized `*_sent_to_client` event) | Operator-driven live walkthrough | ⏸ Pending | `<operator records token id + event payload shape + outcome>` |
| 5 | `SLATE_SHARE_TOKEN_ACCESS_PEPPER` configured in the staging env | Operator confirms via deployment env panel | ⏸ Pending | `<operator records: configured? Y/N · key length ≥ 32 chars? Y/N>` |
| 6 | Migrations 0012-0016 applied in the staging Supabase | Operator confirms via Supabase migrations panel OR `list_migrations` | ⏸ Pending | `<operator records: 0012, 0013, 0014, 0015, 0016 — Y/N each>` |
| 7 | NO `to anon` policies on `report_share_tokens` + `proposal_share_tokens` | Operator confirms via Supabase RLS policy list OR direct SQL | 🔒 Static: migrations 0014 + 0016 declare `to authenticated` only (verified by grep on source) | `<operator records: deployed RLS matches source? Y/N>` |
| 8 | No raw email / token / URL in activity logs | Operator samples recent `*_share_token_*` + `*_sent_to_client` events on staging | 🔒 Static: code-path review confirms metadata builders carry only `{shareTokenId, snapshotId, reportId\|proposalId, audienceLabel, hasRecipientEmailHash: boolean, sentAt, sendCount, channel}` (zero raw fields by grep) | `<operator records: spot-checked N events, found 0 raw values? Y/N>` |
| 9 | Public `/r` and `/p` security headers via `curl` against staging host | Operator runs `curl -I https://<host>/r/test-noop` + `curl -I https://<host>/p/test-noop` | ⏸ Pending | Expected headers per `next.config.mjs`: `Cache-Control: no-store, max-age=0`; `X-Robots-Tag: noindex, nofollow`; `Referrer-Policy: no-referrer`. `<operator pastes curl output below this row>` |
| 10 | Revoke / expired / generic-unavailable behavior identical-shape across all 5 blocked states | Operator visits revoked + (if dev expiry configured) expired + snapshot-voided + unknown-token URLs and compares response bodies | ⏸ Pending | `<operator records: response sizes for each blocked state ± 1KB margin; identical-body grep on key strings>` |
| 11 | Top-level `Send to Client` at `proposal-workspace.tsx:417` remains LOCKED in the deployed bundle | Operator opens the proposal page on staging and visually confirms the locked button | 🔒 Static: grep confirms `LockedActionButton label="Send to Client"` at line 417 unchanged | `<operator records: visible as locked in deployed bundle? Y/N>` |
| 12 | Public SOW route absent — `curl /s/test` + `curl /sow/test` return 404 | Operator runs both curls against the staging host | 🔒 Static: `Glob app/s/**` and `Glob app/sow/**` both return zero files | `<operator pastes both curl status lines below this row>` |

**Summary (this session):**

- **5 items statically verified (🔒)** — 7, 8, 11, 12 (full) + 0 (env baseline pre-fill). All four ✅ at the source-tree level; operator confirms deployed bundle matches source.
- **7 items pending operator confirmation (⏸)** — 1, 2, 3, 4, 5, 6, 9, 10. Items 1-4 are the canonical operator-driven walkthroughs across the four delivery lanes. Items 5-6, 9-10 require a configured staging deployment.

---

## 2. Screenshots / artifact paths

Walkthrough screenshots land under the gitignored `artifacts/walkthroughs/` tree. Recommended filenames the operator captures:

### Report link path → `artifacts/walkthroughs/client-report-link-mvp-acceptance/`
- `r-token-minted.png` — copy-once panel showing the raw token surfaced exactly once
- `r-route-rendered.png` — `/r/<token>` showing the snapshot-pure report artifact with advisory footer
- `r-token-revoked.png` — proposal panel showing the token row flipped to `revoked`
- `r-route-after-revoke.png` — `/r/<token>` showing the generic-unavailable page
- `r-curl-headers.txt` — `curl -I https://<host>/r/<token>` output capturing the three security headers
- `r-activity-event-payload.json` — sanitized `report_share_token_*` event payload showing zero raw values

### Proposal link path → `artifacts/walkthroughs/proposal-review-link-mvp-acceptance/`
- `p-token-minted.png`
- `p-route-rendered.png` — `/p/<token>` showing the proposal artifact with four-denial footer
- `p-snapshot-voided.png` — Past Proposal Candidates panel showing the snapshot flipped to `voided` + cascade-revoke event in activity
- `p-route-after-cascade.png` — `/p/<token>` returning the generic-unavailable page
- `p-curl-headers.txt`
- `p-activity-event-payload.json`

### SOW Draft path → `artifacts/walkthroughs/sow-draft-mvp-acceptance/`
- `sow-proposal-candidate-approved.png`
- `sow-draft-generated.png` — Past SOW Drafts panel row with the new SOW Draft snapshot
- `sow-draft-internal-route.png` — `/app/engagements/[id]/proposal/sow/[snapshotId]` showing the canon-mandated SOW chrome
- `sow-draft-no-public-route.png` — `curl -I https://<host>/s/<snapshotid>` returning 404

### Send to Client path → `artifacts/walkthroughs/send-to-client-mvp-acceptance/`
- `stc-modal-disabled-without-acks.png` — modal with audience filled but Confirm button still disabled
- `stc-modal-all-acks-confirmed.png` — modal with all 3 acknowledgements + audience filled + Confirm enabled
- `stc-success-chip.png` — toast / chip after Confirm
- `stc-token-row-marked.png` — panel row showing "Marked sent by operator 1 time(s) · Last marked <ts> · Channel: Operator-mediated copy-link"
- `stc-activity-event-payload.json` — sanitized `*_sent_to_client` event payload
- `stc-locked-top-level.png` — proposal-workspace screenshot showing the top-level per-option `Send to Client` still rendering as locked

**Operator instruction:** capture each screenshot or text artifact above into the matching `artifacts/walkthroughs/<lane>/` directory after running each step. The `notes.md` file in each directory (already pre-staged across the four prior audits) carries the canonical step-by-step.

---

## 3. Remaining blockers (this session)

**Source-tree blockers:** None. All static verification passes.

**Walkthrough blockers (operator-side, expected per `docs/31` § Operator Live Walkthrough Status):**

1. **Auto-mode classifier blocks the audit agent from running live SQL or curl against any deployed environment** — matches the established precedent across `docs/21` / `docs/23` / `docs/25` / `docs/27` / `docs/30`. The 7 ⏸ items can only be confirmed by an operator with credentialed access to the staging deployment.
2. **No configured staging environment was identified at the time of this sprint** — the audit assumes the operator has (or will provision) a non-production deployment of the `persistence/step-0-1-auth-shell` branch with `SLATE_SHARE_TOKEN_ACCESS_PEPPER` set + migrations 0012-0016 applied + Supabase project provisioned (recommended: a separate Supabase project OR a feature-branch of the production project, NOT the production project itself).

If the operator cannot provision a staging deployment, the alternative is to run the walkthrough against a local `npm run dev` instance pointed at a non-production Supabase project. The 12 conditions remain identical; only the "staging host" reference changes.

---

## 4. Final verdict

### This session (audit-agent scope):
**Static verification complete · operator-driven staging walkthrough pending.**

### After operator completes the 7 ⏸ items above:

The operator updates this doc by:
1. Recording each ⏸ item's actual result in the "Operator confirmation slot" column (✅ / ❌ + brief evidence).
2. Pasting any captured curl outputs / JSON payloads inline below the relevant rows.
3. Updating the final verdict line below.

Possible final verdicts after operator execution:

- **✅ Staging cleared for controlled client use** — all 12 conditions ✅; no blocking defects; SOW + alternative-transport locks confirmed; operator may proceed with controlled external client exposure of `/r` + `/p` links via the operator-mediated copy-link flow.
- **⚠️ Staging cleared with operator-tracked exceptions** — 1-2 ⏸ items unresolved but non-blocking (e.g. dev-only short-expiry test was skipped because pepper-not-yet-deployed); operator documents the exception inline + accepts the risk under explicit sign-off.
- **❌ Not cleared** — any of conditions 1, 2, 3, 4, 7, 11, 12 fails. Operator opens a follow-up sprint to fix the failing condition; this doc stays open until re-execution clears every condition.

**Default expectation per the audit prompt:** "Staging cleared for controlled client use" once the operator completes the walkthrough on a properly configured staging environment.

---

## 5. Operator sign-off

| Field | Value |
|---|---|
| Operator name | `<operator fills>` |
| Walkthrough completion timestamp | `<operator fills>` |
| Final verdict | `<operator chooses: Staging cleared / Cleared with exceptions / Not cleared>` |
| Reviewer (if applicable) | `<operator fills>` |
| Reviewer approval timestamp | `<operator fills>` |

After sign-off lands, the next eligible sprint per `docs/31` § Recommended Next Milestone alternatives is operator choice between:

- **Option B — UX polish / operator guidance sprint** (in-product mark-sent guidance + recipient-hash visual + canon-verbatim disclaimer CI pin from `docs/30` Audit note 2).
- **Option C — CRM / email / e-sign / SOW share canon authoring** (four independent canons per `docs/29` § 17 post-acceptance fork; recommended slot `docs/33`+; SOW share decision re-opens with default still **defer** per `docs/28`).

`Send to Client` remains at operator-mediated copy-link posture across every option until a separate canon explicitly authorises an alternative transport.

---

## Files modified by this sprint

- `docs/32_PHASE_1B_DELIVERY_ENGINE_STAGING_WALKTHROUGH.md` (new — this file)
- `docs/08_CURRENT_STATUS.md` (status block updated)
- `docs/10_SESSION_HANDOFF.md` (chronology + next-planned updated)

**No source code changes.** Read-only sign-off scaffold per the staging-walkthrough sprint prompt.

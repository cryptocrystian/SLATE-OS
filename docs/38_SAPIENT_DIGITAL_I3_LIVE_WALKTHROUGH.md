# Sapient Digital — Sprint I3 Live Walkthrough Log

## Status

- **Date executed:** 2026-06-02
- **Sprint type:** Deployment / database / live UI verification (no source feature work)
- **Sprint identifier:** Sprint I3 Live Walkthrough
- **Source branch at execution:** `staging` and `persistence/step-0-1-auth-shell` both at `a39a50c` — "Add offline intake operator UI"
- **Deployed Vercel host:** `https://slate-os-staging.vercel.app`
- **Deployed Supabase project:** `SLATE OS` (ref `hhglrcvsmwaheikdvijw`)
- **Target engagement:** Sapient Digital · `76097653-fedb-42e5-9ef6-e89a0e97f802`
- **Verdict:** ✅ **Sprint I3 cleared on deployed staging.** Offline intake UI + server actions + migration 0017 work end-to-end against the deployed environment. All canon boundaries held; zero `/r` or `/p` minting, zero Send to Client, zero email/CRM/e-sign, zero SOW, zero new packages, zero source code changes during this walkthrough.

---

## 1. Vercel Production deployment promotion

**Finding pre-walkthrough:** the canonical alias `https://slate-os-staging.vercel.app` was still aliased to a 13-day-old Production deployment from May 20 2026, predating Sprints I2 and I3. Recent staging-branch pushes had been creating Preview deployments only.

**Action taken (operator-authorized):** `vercel --prod --scope christians-projects-bb2d10a3 --yes` from a checkout of `staging` head at `a39a50c`.

**Result:**

- New Production deployment built and deployed in ~1m wall-clock.
- Production deployment id: `dpl_9wFmhoX4K5FcLkzxxPiUMuSUwTZT`.
- Canonical aliases re-pointed automatically to the new deployment:
  - `https://slate-os-staging.vercel.app`
  - `https://slate-os-staging-christians-projects-bb2d10a3.vercel.app`
- Build route table matches local production-build output (intake route 14.2 kB First Load JS — Sprint I3 components present; 28 other routes within ±2 kB of prior baseline).

**Post-deploy curl battery against canonical URL:**

```
== /r/test-noop ==  HTTP/2 200 + cache-control: private, no-cache, no-store, max-age=0, must-revalidate
                                 + x-robots-tag: noindex, nofollow
                                 + referrer-policy: no-referrer
== /p/test-noop ==  HTTP/2 200 + same canon headers
== /s/test     ==  HTTP 404 (no public SOW route)
== /sow/test   ==  HTTP 404 (no public SOW route)
```

All four canon checks pass on the new Production deployment.

---

## 2. Migration 0017 application

**Method:** Supabase MCP `apply_migration` against project `hhglrcvsmwaheikdvijw` with the exact verbatim contents of `supabase/migrations/0017_offline_intake_extensions.sql` from commit `a39a50c` (boilerplate comment header trimmed; SQL body byte-identical). Migration name registered as `offline_intake_extensions`.

**Result:** `{"success": true}` — migration applied without errors or warnings.

**Idempotency:** Migration body uses `add column if not exists` / `drop constraint if exists ... add constraint` / `create index if not exists` / `create table if not exists` / `drop policy if exists ... create policy` throughout, plus a backfill `update ... where ... is null` block — safe to re-run.

---

## 3. Schema + RLS verification

### 3.1 `stakeholder_intake_sessions` — Sprint I3 columns present

| column | type | nullable | default |
|---|---|---|---|
| `source_type` | text | NO | `'live_link'::text` |
| `entered_by` | uuid | YES | — |
| `collected_at` | timestamptz | YES | — |
| `source_confidence` | text | YES | — |
| `operator_notes` | text | YES | — |
| `client_visible` | boolean | NO | `true` |
| `token_hash` | text | **YES** (was NOT NULL before) | — |

### 3.2 `stakeholder_responses` — Sprint I3 columns present

| column | type | nullable | default |
|---|---|---|---|
| `source_type` | text | NO | `'live_link'::text` |
| `response_status` | text | NO | `'ready_for_synthesis'::text` |
| `entered_by` | uuid | YES | — |
| `collected_at` | timestamptz | YES | — |
| `operator_notes` | text | YES | — |
| `supersedes_response_id` | uuid | YES | — |
| `client_visible` | boolean | NO | `true` |

### 3.3 `engagement_intake_documents` — new table, all 20 columns

`id`, `workspace_id`, `engagement_id`, `stakeholder_id`, `title`, `source_type` (default `'document_upload'`), `content_text`, `external_url`, `storage_path`, `mime_type`, `size_bytes`, `source_confidence`, `operator_notes`, `client_visible` (NOT NULL default **false** — distinct from sessions/responses which default true for live-link backfill safety), `created_by`, `voided_at`, `voided_by`, `void_reason`, `created_at`, `updated_at`.

### 3.4 CHECK constraints — 12 total

All Sprint I3 vocabulary + length + mode-gate CHECK constraints present and correctly defined. Most critically:

- `stakeholder_intake_sessions_token_hash_mode_check` — `(source_type = 'live_link' AND token_hash IS NOT NULL) OR (source_type <> 'live_link' AND token_hash IS NULL)`. This is the canonical replacement for the prior `token_hash NOT NULL` column-level invariant.
- `stakeholder_responses_response_status_check` — `response_status IN ('draft', 'ready_for_synthesis', 'superseded', 'voided')`.
- `engagement_intake_documents_source_type_check` — `source_type IN ('document_upload', 'meeting_notes', 'transcript', 'email_paste', 'external_link')` (excludes `live_link`; adds `external_link`).

### 3.5 RLS posture

| table | RLS enabled | policy | role |
|---|---|---|---|
| `stakeholder_intake_sessions` | ✅ | `stakeholder_intake_sessions_operator_full` | `{authenticated}` |
| `stakeholder_responses` | ✅ | `stakeholder_responses_operator_full` | `{authenticated}` |
| `engagement_intake_documents` | ✅ | `engagement_intake_documents_operator_full` | `{authenticated}` |

Zero anon policies on any of the three tables.

### 3.6 Pre-existing data integrity

Pre-migration row counts for `stakeholder_intake_sessions`, `stakeholder_responses`, and `engagement_intake_documents` against the Sapient Digital engagement: 0 / 0 / 0. Backfill `update` statements ran with zero affected rows. Live-link Mode A behavior is preserved by default-column semantics.

---

## 4. Live UI walkthrough — Sapient Digital

Walkthrough was driven from a Chrome MCP browser session attached to the operator's authenticated session at `cdibrell · Saipien Labs` on `https://slate-os-staging.vercel.app`.

### 4.1 Stage offline stakeholder

| Field | Value |
|---|---|
| Display name | `I3 WALKTHROUGH TEST — Operator-staged test stakeholder` |
| Email | (blank) |
| Title | (blank) |
| Role | Executive · Owner |
| Source type | Operator-entered |
| Source confidence | Inferred |
| Collected at | (blank) |
| Operator notes | `I3 LIVE WALKTHROUGH TEST 2026-06-02 — not real client data. Operator-side test only. Do not count toward Sapient readiness gate.` (128/2000 chars) |

**Submission via "Save without sending":** server action succeeded.

**Resulting row** (`stakeholder_intake_sessions`):

| column | value |
|---|---|
| `id` | `91fea09e-426b-4dc0-b67f-98bb7b0331d4` |
| `engagement_id` | `76097653-fedb-42e5-9ef6-e89a0e97f802` |
| `stakeholder_name` | `I3 WALKTHROUGH TEST — Operator-staged test stakeholder` |
| `role` | `executive` |
| `source_type` | `operator_entered` |
| `source_confidence` | `inferred` |
| `client_visible` | **false** ✅ |
| `token_hash` | **null** ✅ |
| `sent_at` | **null** ✅ |
| `operator_notes` length | 128 chars |
| `created_at` | 2026-06-02 15:55:03 UTC |

**UI chips observed:**

- "OFFLINE STAKEHOLDER STAGED" success banner + "No message sent" badge ✅
- Inline reminder: "Save without sending. This row is operator-only..." ✅
- Session row in panel shows role chip + `Operator-entered` source chip + `Inferred` confidence chip + "0 responses" + "Operator-only" label ✅
- Readiness aside card updated: Offline Stakeholders=1, all other counters=0 ✅

### 4.2 Capture offline response

| Field | Value |
|---|---|
| Question | "Where would automation or AI assistance help most?" (`automation_wishlist` seed) |
| Response text | `I3 walkthrough test response - this is not real client content. Synthesis must skip this row. Example PII pattern to verify warning: test@example.com.` (150 chars) |
| Source type | Operator-entered (inherited default from parent session) |

**PII-warning behaviour:** As soon as the answer text containing `test@example.com` was typed, the inline warning rendered correctly:

> ⚠️ **Possible PII detected.** The response text appears to contain an email address. Consider scrubbing this before saving — once stored, it lives in the engagement's audit trail. Synthesis does not need names or contact details to do its job.

The warning is **non-blocking** per the canon — operator chose to save anyway to validate the full pipeline. Per canon, the boundary check (synthesis skips draft/voided rows) is what enforces no-PII-in-client-artifacts, not the warning itself.

**Submission via "Save draft":** server action succeeded; "Response saved as draft. Mark ready when you're confident." success message displayed.

**Resulting row** (`stakeholder_responses`):

| column | value |
|---|---|
| `id` | `02aea7f1-0f69-4631-86ee-5438417aa9a5` |
| `session_id` | `91fea09e-426b-4dc0-b67f-98bb7b0331d4` |
| `question_id` | `automation_wishlist` |
| `question_label` | `Where would automation or AI assistance help most?` |
| `source_type` | `operator_entered` |
| `response_status` | **`draft`** ✅ |
| `client_visible` | **false** ✅ |
| `supersedes_response_id` | null |
| answer length | 150 chars |
| `created_at` | 2026-06-02 15:56:33 UTC |

### 4.3 Mark ready for synthesis

Clicked "Mark ready for synthesis" on the response row. Server action succeeded (server-side commit at 2026-06-02 15:57:11 UTC).

**Resulting state:**

| column | value |
|---|---|
| `response_status` | **`ready_for_synthesis`** ✅ |
| `client_visible` | **false** ✅ (does NOT auto-elevate on mark-ready — canon held) |

**UI chips observed:**

- Status chip flipped from `Draft` (yellow dot) → `Ready for synthesis` (green dot, success tone) ✅
- "Mark ready for synthesis" button removed (terminal-eligible) ✅
- "Void" button retained ✅
- Session summary line updated: "1 response · 1 ready" ✅

### 4.4 Void

Clicked "Void". `window.prompt` was patched in-page to auto-return a clearly-labeled test reason so the Chrome MCP renderer wouldn't block on the native dialog:

```
I3 LIVE WALKTHROUGH TEST 2026-06-02 - voided after Mark ready verification; test artifact
```

Server action succeeded (server-side commit at 2026-06-02 16:00:13 UTC).

**Resulting state:**

| column | value |
|---|---|
| `response_status` | **`voided`** ✅ |
| `client_visible` | **false** ✅ |

**UI chips observed:**

- Status chip flipped to `Voided` (neutral) ✅
- Answer text rendered with `line-through` + muted color ✅
- Both Mark ready and Void buttons removed (terminal state per canon `docs/37` § 4 transition matrix) ✅
- Session counter dropped the "1 ready" suffix ✅

### 4.5 Activity event sanitization

All three activity events emitted by the walkthrough were inspected directly from `public.activity_events`. Metadata payloads:

```json
// offline_intake_session_created
{ "role": "executive", "sourceType": "operator_entered", "sourceConfidence": "inferred" }

// offline_intake_response_created
{ "sessionId": "91fea09e-…", "questionId": "automation_wishlist",
  "sourceType": "operator_entered", "supersedes": false, "responseStatus": "draft" }

// offline_intake_response_ready
{ "sessionId": "91fea09e-…", "sourceType": "operator_entered", "priorSupersededId": null }

// offline_intake_response_voided
{ "sessionId": "91fea09e-…", "sourceType": "operator_entered",
  "priorStatus": "ready_for_synthesis",
  "reason": "I3 LIVE WALKTHROUGH TEST 2026-06-02 - voided after Mark ready verification; test artifact" }
```

**Sanitization boundary held:** ✅ zero `answer_text`, ✅ zero `stakeholder_name`, ✅ zero `email`, ✅ zero `operator_notes` content. The only operator-supplied free text that does land in metadata is the void reason — which is an explicit operator-typed audit string per canon, capped at 500 chars by `engagement_intake_documents_void_reason_length_check`-style validation.

### 4.6 One minor cosmetic finding (NOT a blocker)

The existing live-link role-coverage map and risk-derivation rules count the offline-staged stakeholder against role coverage and emit "1 stakeholder have not opened the intake link — confirm delivery before the kickoff." Offline-staged stakeholders never have an intake link, so this risk note is technically misleading on the offline branch.

This is a cosmetic side-effect of the legacy live-intake-only derivations not yet branching on `source_type`. It does NOT affect:

- The offline data model
- The readiness aside card (which has its own dedicated counter)
- Findings-synthesis gating
- Any client-facing artifact

Recommendation: a future cosmetic polish sprint can branch `deriveFollowUps` and the role-coverage status from `source_type`, or filter out offline-source rows from the live-link risk derivations. Not Sprint I3 scope; tracked here for the next polish opportunity.

---

## 5. Boundary verification — final pass

| Boundary | Evidence | Verdict |
|---|---|---|
| No new report share tokens minted during walkthrough | `select count(*) from report_share_tokens where engagement_id = … and created_at >= '2026-06-02 15:50:00+00'` → **0** | ✅ |
| No new proposal share tokens | same shape → **0** | ✅ |
| No new report delivery snapshots | **0** | ✅ |
| No new proposal delivery snapshots | **0** | ✅ |
| No Send-to-Client or share-token-created activity events | **0** | ✅ |
| No SOW activity events | **0** | ✅ |
| No documents inserted (Sprint I3 does not ship document UI) | `select count(*) from engagement_intake_documents where engagement_id = …` → **0** | ✅ |
| `/s/test` still 404 (no public SOW route) | curl `HTTP 404` | ✅ |
| `/sow/test` still 404 | curl `HTTP 404` | ✅ |
| `/r/test-noop` and `/p/test-noop` still serve canon route + headers | curl `HTTP/2 200` + `no-store, must-revalidate` + `x-robots-tag: noindex, nofollow` + `referrer-policy: no-referrer` | ✅ |
| `client_visible` never elevated for any offline row | session, draft, ready, and voided states all `client_visible = false` | ✅ |
| `token_hash` never minted for offline session | row + CHECK constraint both confirm `null` | ✅ |
| `sent_at` never populated for offline session | row confirms `null` | ✅ |
| No real Sapient stakeholder identity captured | display name explicitly labeled `I3 WALKTHROUGH TEST — Operator-staged test stakeholder` | ✅ |
| No real Sapient email captured | email column null | ✅ |
| Sapient readiness gate (`docs/35` § 5) not advanced by test data | gate stays at 1/15 — see § 7 below | ✅ |
| Live-link Mode A code path unchanged | live-link `createStakeholderSession` not invoked during walkthrough; existing live-link UI surface and token-mint flow not touched | ✅ |
| No email / CRM / e-signature / mailto wiring exercised | UI confirmation: "No invite, no token, no public link. Operator-side only." | ✅ |

All 17 boundary checks pass.

---

## 6. Test artifact state

| artifact | id | final status |
|---|---|---|
| Offline stakeholder session | `91fea09e-426b-4dc0-b67f-98bb7b0331d4` | persisted, `client_visible = false`, `token_hash = null` |
| Offline draft → ready → voided response | `02aea7f1-0f69-4631-86ee-5438417aa9a5` | `response_status = voided`, `client_visible = false`, answer preserved for audit |
| 4 activity events | offline_intake_session_created → offline_intake_response_created → offline_intake_response_ready → offline_intake_response_voided | persisted with sanitized metadata |

**Cleanup posture:** the test session row + test response row are **intentionally retained** as test artifacts on Sapient Digital because:

- They are clearly labeled (`I3 WALKTHROUGH TEST`, `I3 LIVE WALKTHROUGH TEST 2026-06-02`).
- The response is in a terminal `voided` state — findings synthesis will skip it.
- `client_visible = false` on every row — they cannot leak into a client-facing report or proposal.
- They demonstrate the soft-delete + audit-preservation canon contract.
- Hard-deleting them would erase the activity audit trail.

If the operator wants them removed, the recommended path is a separate operator-driven cleanup sprint that voids the session as well and adds an `engagement_intake_documents`-style soft-delete on the session entity. That UI does not exist today (no session-void UI shipped in Sprint I3) and is a candidate for a future polish sprint if needed.

---

## 7. Readiness gate impact

`docs/35` § 5 Sapient Digital readiness gate is **NOT** advanced by this walkthrough. Test data is excluded from the gate because:

- The staged stakeholder is explicitly labeled as test artifact.
- The single staged response is in `voided` terminal state.
- `client_visible = false` on every row.
- No findings synthesis was triggered.
- No `/r` or `/p` mint occurred.

Gate stays at **1/15** — same as after `docs/36` Stage 1-2 Execution Log. Real Sapient stakeholder content remains the next gate-advancement step.

---

## 8. Operational readiness

After this walkthrough, the offline-intake operator UI is **operationally ready** against the deployed staging environment. The operator can now:

1. Use the offline-intake UI to stage real Sapient Digital stakeholders against any of the 6 role slots without sending any external message.
2. Use the docs/36 § 6 question packet either as a pre-call agenda for live discovery calls OR as a fill-in template for offline collection — and then paste the answers per-stakeholder into the offline response form.
3. Mark each response ready for synthesis when confident in the content; void any that turn out to be inapplicable.
4. Trust that **none** of this data reaches a `/r` or `/p` route until the docs/35 § 5 readiness gate is satisfied and a separate share-token-mint sprint runs.

---

## 9. Recommended next sprint

**Option A (Recommended): Sapient Digital Offline Intake Data Capture Sprint.** Operator (with or without Claude) enters real Sapient Digital stakeholder responses collected via the docs/36 § 6 question packet into the offline-intake UI. Mark each as ready when confident. Re-evaluate readiness gate; expect material movement on items related to "stakeholder coverage" and "discovery completeness." This is the highest-leverage next move because it directly converts the now-working ingest path into actual signal for the engagement.

**Option B: Sprint I4 — Document Attachment / Source Capture.** Wire a binary document upload backend behind `engagement_intake_documents.storage_path` so the operator can attach evidence files (meeting notes PDFs, transcript files, deck exports) directly. Recommended ONLY if the operator wants to attach binary content during the data capture session. The `engagement_intake_documents` schema is already in place — only the upload UI + storage backend wiring is missing.

**Option C: Sprint I5 — Findings Synthesis Integration.** Update the findings-synthesis pipeline to consume `response_status = 'ready_for_synthesis'` rows (skipping `draft` and `voided`). Recommended when real content is in hand and the operator wants to drive Stage 3 (findings). Has a soft dependency on Option A landing first.

**Default recommendation:** A first, then C. Defer B unless binary-attachment is an immediate need for the data-capture session.

---

## 10. Files modified by this walkthrough sprint

- `docs/38_SAPIENT_DIGITAL_I3_LIVE_WALKTHROUGH.md` (this file — new)
- `docs/37_SAPIENT_DIGITAL_OFFLINE_INTAKE_CANON.md` (Sprint I3 section updated with live-walkthrough landing note)
- `docs/36_SAPIENT_DIGITAL_STAGE_1_2_EXECUTION_LOG.md` (Path B cross-reference updated)
- `docs/08_CURRENT_STATUS.md` (Sprint I3 live-walkthrough block added at top)
- `docs/10_SESSION_HANDOFF.md` (Latest line replaced with I3 walkthrough outcome + new next-planned milestone)

**Zero source code changes.** Zero schema / package changes outside applying the already-committed migration 0017. Zero new public routes. Zero `/r` or `/p` mint. Zero Send to Client. Two Sapient Digital DB rows created as clearly-labeled test artifacts (retained for audit trail).

# Sapient Digital Offline Intake Canon

## Status

- **Date authored:** 2026-05-23
- **Sprint type:** Canon authoring — no source code, no migration, no engagement mutation, no Sapient Digital interaction
- **Sprint identifier:** Sprint I1 — Offline Intake Canon
- **Branches at authoring:** `staging` / `persistence/step-0-1-auth-shell` (both at `435b431`)
- **Source-tree grounding only:** Read-only inspection of `lib/intake/types.ts`, `lib/intake/actions.ts`, `supabase/migrations/0005_stakeholder_intake.sql` to ground the canon in real entity shapes. **No source changes.**

This doc is the canonical authorization for an operator-staged offline intake workflow that lets the operator collect stakeholder answers outside SLATE and enter or upload them into SLATE without sending stakeholder invitations. It is the post-acceptance fork from `docs/36` § 9 Product Gap Observation 1 ("no operator-staged-response intake path"). The canon DOES NOT modify source code; the implementation sprints (I2-I6) that follow this canon are separately scoped.

---

## 1. Decision summary

| Decision | Verdict |
|---|---|
| Should SLATE support an operator-staged offline intake mode in addition to the existing live-stakeholder-intake mode? | **✅ Yes** — this canon authorizes it as Mode B |
| Should offline-staged responses be visually distinguishable from live-stakeholder responses everywhere they surface in the operator UI + downstream synthesis? | **✅ Yes** — `source_type` is rendered as a chip on every stakeholder + response card; the synthesis surface treats them as separate signal qualities |
| Should offline-staged responses default to client-visible? | **❌ No** — every offline-staged response is `client_visible = false` until the operator explicitly elevates it via a per-response action. The canon preserves the docs/35 § 5 readiness gate for any `/r` or `/p` mint |
| Should the existing `stakeholder_intake_sessions` table be extended OR should offline data live in a parallel table? | **✅ Extend** the existing table (Option 1 below). One stakeholder concept across both modes; one query path for downstream synthesis |
| Should SLATE send anything externally as part of offline intake? | **❌ No** — offline mode is the explicit no-send path. No email, no CRM, no mailto, no SLATE-mediated communication of any kind |
| Should this canon authorize implementation? | **❌ No** — this canon authorizes Sprint I2 (data model + server actions) at the earliest. I3-I6 require successive sprint approval per the implementation sequence in § 10 |

**Recommended default for the first build:** Sprint I2 implements just the data model + server actions (no UI yet); Sprint I3 wires the UI; the operator validates against Sapient Digital in Sprint I6.

---

## 2. The three intake modes

### Mode A — Live stakeholder intake (existing, unchanged by this canon)

- Real stakeholder name + email + role + title
- SLATE creates a `stakeholder_intake_sessions` row with `source_type = 'live_link'` (existing default behavior, after Sprint I2's schema extension)
- SLATE generates a `/intake/[token]` URL with 21-day TTL; only the sha256 hash is persisted (existing canon, unchanged)
- Operator manually hand-delivers the URL via their own approved channel (existing canon — *"Email automation lands later"* per UI copy)
- Stakeholder visits the URL anonymously, submits responses via the public token-gated route, responses persist to `stakeholder_responses`
- Use case: real-client engagements where the stakeholder will fill out intake themselves
- Not used unless operator explicitly authorizes outreach with real contact information

### Mode B — Operator-staged offline responses (the new path this canon authorizes)

- Operator collects answers outside SLATE — in meetings, on calls, via async email threads, from existing documents, etc. — using the `docs/36` § 6 intake question packet (or any other operator-provided question framework)
- Operator opens SLATE intake UI and creates a stakeholder row with `source_type = 'operator_entered'` (or `'meeting_notes'`, `'transcript'`, `'email_paste'` per § 4 enumeration)
- **Email field is optional** for offline-staged modes. **No intake token is minted.** **No URL is generated.** **No email is sent.**
- Operator pastes the collected answers into per-question response fields OR pastes a free-text meeting-notes blob that the operator labels for which question(s) it addresses
- Response rows persist with `source_type` matching the session's `source_type` + `response_status = 'draft'` until operator explicitly marks them `'ready_for_synthesis'`
- Use case: client engagements where the operator has already collected discovery data through normal sales/advisory conversations and wants to capture that data inside SLATE so AI synthesis can use it
- Sapient Digital's immediate viable path per `docs/35` § 6 and `docs/36` § 10 branch A

### Mode C — Document-only intake (subset of Mode B)

- Operator uploads supporting documents (org chart, current process docs, system maps, prior advisory deliverables, transcripts, etc.) without creating per-question response rows
- Documents persist with `source_type = 'document_upload'` and may have `linked_role` to associate them with a specific stakeholder slot
- Findings synthesis can use document metadata + content as a signal even when per-question responses are missing
- Use case: operator has good source material but no formal stakeholder Q&A yet, and explicitly approves AI synthesis against document-only signal as a preliminary read
- Operator MUST explicitly override the synthesis readiness gate per § 5 to use this mode for findings drafting

---

## 3. Data model extensions (conceptual — Sprint I2 implements)

This section defines the conceptual shape Sprint I2 will codify into `supabase/migrations/0017_offline_intake_extensions.sql` (next migration after 0016). **No migration runs in this canon sprint.**

### 3.1 `stakeholder_intake_sessions` extensions

| Field | Type | Nullable | Default | Constraint | Purpose |
|---|---|---|---|---|---|
| `source_type` | text | NOT NULL | `'live_link'` | CHECK (`source_type` IN (`'live_link'`, `'operator_entered'`, `'meeting_notes'`, `'transcript'`, `'email_paste'`, `'document_upload'`)) | Distinguishes intake mode per session |
| `token_hash` | text | **NULL (changed from NOT NULL)** | — | CHECK (`(source_type = 'live_link' AND token_hash IS NOT NULL) OR (source_type != 'live_link' AND token_hash IS NULL)`) | Live mode still requires token; offline modes must not have one |
| `entered_by` | uuid | NULL | — | references `auth.users(id)` | Which operator staged this offline row. NULL for `live_link` (the stakeholder is the entry author) |
| `collected_at` | timestamptz | NULL | — | — | When the offline answer was actually collected (may pre-date the SLATE row creation by hours/days/weeks) |
| `source_confidence` | text | NULL | — | CHECK (`source_confidence` IS NULL OR `source_confidence` IN (`'first_hand'`, `'second_hand'`, `'inferred'`)) | Operator-stamped confidence for offline data quality |
| `operator_notes` | text | NULL | — | LENGTH ≤ 2000 chars | Free-text operator commentary visible only to operators |
| `client_visible` | boolean | NOT NULL | `false` | — | False by default for all offline-staged sessions. Operator must explicitly elevate. Live-link sessions remain `true` (existing behavior) |

**Backwards compatibility:** existing rows are all `live_link` with `token_hash` present + `client_visible` defaults to `true` for live mode. Migration sets `source_type = 'live_link'` and `client_visible = true` for all pre-existing rows.

### 3.2 `stakeholder_responses` extensions

| Field | Type | Nullable | Default | Constraint | Purpose |
|---|---|---|---|---|---|
| `source_type` | text | NOT NULL | `'live_link'` | CHECK same enum as session | Mirrors session for cross-table filtering |
| `response_status` | text | NOT NULL | `'ready_for_synthesis'` for live; `'draft'` for offline | CHECK (`response_status` IN (`'draft'`, `'ready_for_synthesis'`, `'superseded'`, `'voided'`)) | Operator-controlled gate before findings synthesis consumes the answer |
| `entered_by` | uuid | NULL | — | references `auth.users(id)` | Which operator typed/pasted this offline answer. NULL for live |
| `collected_at` | timestamptz | NULL | — | — | Per-response collection time (may differ from session's `collected_at` if multi-meeting capture) |
| `operator_notes` | text | NULL | — | LENGTH ≤ 1000 chars | Per-response operator commentary |
| `supersedes_response_id` | uuid | NULL | — | references `stakeholder_responses(id)` | If an offline response replaces an earlier draft (e.g., operator gets a clarifying answer in a follow-up meeting), this links the new row to the prior. The old row is marked `superseded` |

### 3.3 New entity — `engagement_intake_documents`

The existing schema has no per-engagement document entity — documents may live in some general inputs table or in the `intake_record.supportingInputs` jsonb in legacy code paths. Sprint I2 introduces a first-class entity for offline-mode source attachments.

| Field | Type | Nullable | Default | Constraint |
|---|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()` | primary key |
| `workspace_id` | uuid | NOT NULL | — | references `workspaces(id)`; RLS scope |
| `engagement_id` | uuid | NOT NULL | — | references `engagements(id)` on delete cascade |
| `linked_session_id` | uuid | NULL | — | references `stakeholder_intake_sessions(id)` on delete set null. NULL allowed for engagement-level documents not tied to a specific stakeholder |
| `linked_role` | text | NULL | — | CHECK same role enum as `stakeholder_intake_sessions.role` |
| `title` | text | NOT NULL | — | display label, e.g. "Process map · Sales pipeline" |
| `source_type` | text | NOT NULL | `'document_upload'` | CHECK (`source_type` IN (`'document_upload'`, `'meeting_notes'`, `'transcript'`, `'email_paste'`, `'external_link'`)) |
| `mime_type` | text | NULL | — | e.g., `application/pdf`, `text/markdown` |
| `size_bytes` | bigint | NULL | — | for binary attachments |
| `storage_path` | text | NULL | — | e.g., R2 / Supabase Storage object key. NULL for `meeting_notes` / `email_paste` (which use `content_text`) |
| `content_text` | text | NULL | — | for text-based source modes; nullable for binary attachments |
| `summary` | text | NULL | — | operator-authored summary; surfaced to AI synthesis |
| `source_confidence` | text | NULL | — | same enum as session |
| `entered_by` | uuid | NOT NULL | — | references `auth.users(id)` |
| `collected_at` | timestamptz | NULL | — | when the document was originally produced (may pre-date the SLATE upload by years) |
| `client_visible` | boolean | NOT NULL | `false` | always false for offline docs; operator must elevate. Documents NEVER reach the public `/r` or `/p` routes — they feed only operator-side findings synthesis |
| `created_at` | timestamptz | NOT NULL | `now()` | — |
| `updated_at` | timestamptz | NOT NULL | `now()` | — |

**RLS:** authenticated-only, workspace-scoped. No anon policy. No public-route consumption. Documents are operator-side-only signal for findings synthesis.

### 3.4 PII handling

- Stakeholder `name` and `email` remain optional for offline modes (existing `name` is required; canon proposes making it operator-required only for live mode and operator-optional for offline modes when the operator is capturing a role-level perspective without naming the individual, e.g., "Operations Leader · perspective from Sept 12 discovery call")
- `engagement_intake_documents.content_text` may contain PII if pasted directly. Sprint I3 UI should surface a PII-warning toast on paste (regex match for email, phone, SSN-shape) — operator confirms before save
- `operator_notes` fields are intended for operator-only audit context; never surfaced to public `/r` or `/p` routes
- The existing `client_visible` defaults of `false` are the structural guard against PII leak to client-facing surfaces

---

## 4. UI requirements (Sprint I3 implements)

| Surface | Requirement |
|---|---|
| `/app/engagements/[id]/intake` panel header | Two distinct affordances: **"Invite live stakeholder"** (existing form, unchanged) + **"Stage offline stakeholder"** (new form, no email required, no token minted) |
| "Stage offline stakeholder" form | Fields: Display name (required — may be a role-level label like "Operations Leader · Sept 12 discovery"), Email (optional + clearly muted), Title (optional), Role (required), Department (optional), Source type (required dropdown — `operator_entered` / `meeting_notes` / `transcript` / `email_paste` / `document_upload`), Collected at (optional date picker), Source confidence (optional dropdown — `first_hand` / `second_hand` / `inferred`), Operator notes (optional textarea, max 2000 chars). Submit button labeled **"Save without sending"**. Hard chip: **"SLATE does not send. No email leaves your account."** |
| Per-stakeholder card | Add a `Source` chip (`Live link` / `Operator entered` / `Meeting notes` / `Transcript` / `Email paste` / `Document upload`) visible at all times. Live-link rows show "Sent" / "Started" / "Completed" badges as today; offline rows show "Draft" / "Ready for synthesis" / "Superseded" / "Voided" badges. The two visual languages must not visually blend |
| "Save stakeholder as draft" path | For live-link mode: when operator fills the form but skips email, system saves as a draft live-link stakeholder without minting a token. Draft state distinct from `invited`. Subsequent "Send invite" action mints the token at that later moment. (This addresses `docs/36` § 9 Observation 3.) |
| "Mark stakeholder as offline response expected" | Toggle on a draft live-link stakeholder that flips the row to offline mode + clears any unused token slot |
| Add offline response | Per-question form on stakeholder detail page. Each question gets a textarea + a `Source` mini-chip + an `Operator notes` field. Operator can paste verbatim or summarize. Save → row inserts to `stakeholder_responses` with `response_status='draft'` |
| Paste meeting notes blob | Free-text textarea per stakeholder. On save, operator selects which question(s) this blob addresses (multi-select against the intake question taxonomy). System creates response rows for each selected question with the same blob as `answer_text` and a per-question operator note "From meeting-notes blob, see notes #ABC". OR operator chooses "Save as document-only" → creates an `engagement_intake_documents` row with `source_type='meeting_notes'` and `content_text=<blob>`, no per-question response rows |
| Upload/link supporting document | Per-stakeholder or engagement-level. Supports binary uploads (PDF / image / spreadsheet) + URL paste (`external_link` source type). PII-warning toast on text-pasted content if regex detects email/phone/SSN-shape |
| Mark response ready for synthesis | Per-response action on draft responses; flips `response_status` to `ready_for_synthesis`. Findings synthesis ONLY consumes responses where `response_status='ready_for_synthesis'` |
| Void / supersede response | Two actions. Void = soft-delete (`response_status='voided'`); preserved in audit trail. Supersede = create a new draft response that points at the old via `supersedes_response_id`, then operator promotes the new one to ready and the old auto-flips to `superseded` |
| Intake completeness by role | Existing Role Coverage panel updated to count BOTH live-completed + offline-ready-for-synthesis responses. Visual differentiation per chip |
| Synthesis readiness gate | Visible at top of `/findings` page. Lists per-role readiness with green/yellow/red dots. Operator sign-off button required to elevate from yellow → green even with partial coverage |
| Default-no-send guarantee | Hard rule: no SLATE intake surface ever triggers an external send action. The only "send" mechanism is the live-link `Generate intake link` button which mints a URL + still requires operator to copy + manually deliver. Offline mode has NO send path at all |
| "No message sent" confirmation | After every offline-mode save action, a toast confirms "Saved. SLATE did not send any message." (positive affordance reinforcing canon discipline) |

---

## 5. Findings synthesis readiness gate

Before Stage 3 findings generation may proceed (`Generate draft findings` button enabled), the engagement must satisfy ONE of:

**Standard gate (no override):**
- ≥ 2 distinct role perspectives have at least 1 response with `response_status='ready_for_synthesis'` OR ≥ 2 distinct role perspectives have at least 1 linked document with `source_type IN ('document_upload', 'meeting_notes', 'transcript')`
- AND coverage exists for at least 4 of the following 6 question topics: business model / offer / process / bottleneck / systems / goals (mapped from the `docs/36` § 6 question packet → operator-tagged response area per canonical taxonomy)
- AND no unresolved PII-warning flag remains on any source that will feed synthesis
- AND operator signs off via a confirmation modal: "I confirm the offline responses captured here are accurate enough to drive AI synthesis."

**Operator override (explicit, audit-logged):**
- Operator may bypass the standard gate via an explicit override action that requires:
  - A reason string (≥ 30 chars) explaining why synthesis should proceed despite gap
  - The override is logged as an activity event with type `findings_synthesis_gate_overridden` and the reason text
  - The resulting findings are flagged in the operator-side UI with a `Synthesized under override` chip until the operator explicitly approves each

This gate prevents Stage 3 from running on Mode-C document-only thin data unless the operator explicitly accepts the thin-data risk.

---

## 6. Sapient Digital-specific path (immediate)

**Recommended mode:** Mode B (operator-staged offline responses).

**Operator inputs already authored:** the `docs/36` § 6 intake question packet (5 universal questions + 30 role-specific questions across all 6 stakeholder slots) can be distributed by the operator today via email, in-meeting prompts, or shared doc — independent of this canon's implementation.

**Sequence for Sapient Digital:**

1. **Pre-implementation (today, no SLATE changes needed):** operator distributes the `docs/36` § 6 question packet to Alicia Dibrell + the other 5 stakeholder roles using operator's preferred external channel. Collects responses into a single operator-owned document (e.g., a Google Doc or markdown file). No SLATE intake link is minted; no SLATE message is sent.
2. **Bridge state (after Sprint I2 lands data model + actions, before Sprint I3 lands UI):** operator manually runs the offline-stakeholder server actions via a one-off internal script or Supabase SQL editor query (within operator's authority, NOT via Claude service-role SQL writes). This is acceptable only as an interim path; canonical UX requires Sprint I3.
3. **Full implementation (after Sprint I3 lands UI):** operator opens `/app/engagements/76097653-…/intake`, clicks **"Stage offline stakeholder"** for each of the 6 roles, fills the form with the collected answers, marks each response `ready_for_synthesis` after review.
4. **Stage 3 sprint (Sprint I6 follow-on):** with synthesis readiness gate satisfied (Sapient will have ≥ 2 role perspectives + ≥ 4 of 6 topics covered), operator clicks `Generate draft findings` → AI synthesizes from real Sapient data → operator approves findings per-finding → Stage 3 progresses.
5. **Stage 4-6 sprints:** proceed per the `docs/35` § 6 recommended sprint sequence (Opportunities, Roadmap, Report, Proposal, Pre-Delivery Audit, Delivery).

**Until Sprint I2 lands:** Sapient Digital Stage 3 remains blocked. Operator may use the `docs/36` § 6 question packet externally (offline document) and hold the collected answers in operator-owned storage until the SLATE-side ingest path exists. This is acceptable as a bridge — the question packet is operator-distributable today, and the captured answers can be backfilled into SLATE once Sprint I3 lands.

---

## 7. Implementation sequence (Sprints I2-I6)

### Sprint I1 — Offline Intake Canon (LANDED 2026-05-23)

- **Scope:** Author `docs/37` (this file). Update `docs/35` + `docs/36` + `docs/08` + `docs/10` to reference it.
- **Non-goals:** No source code, no migration, no engagement mutation, no Sapient interaction.
- **Acceptance:** `docs/37` lands; canon is operator-reviewable; next sprint (I2) is clearly scoped. ✅ Landed in commit `8dc9005`.

### Sprint I2 — Data Model + Server Actions (LANDED 2026-05-28)

- **Scope as implemented:** Migration `supabase/migrations/0017_offline_intake_extensions.sql` adds the field changes specified in § 3.1, § 3.2, and the new `engagement_intake_documents` table per § 3.3. Type extensions in `lib/intake/types.ts` add `IntakeSourceType`, `IntakeDocumentSourceType`, `IntakeSourceConfidence`, `IntakeResponseStatus`, `EngagementIntakeDocument`, and the `Create*Input` / `*Result` shapes for every action. Mapper extensions in `lib/intake/mappers.ts` add `DbEngagementIntakeDocumentRow` + `mapEngagementIntakeDocumentRow`. New action module `lib/intake/offline-actions.ts` implements 6 guarded server actions (`createOfflineStakeholderIntakeSessionAction`, `createOfflineStakeholderResponseAction`, `markStakeholderResponseReadyForSynthesisAction`, `voidStakeholderResponseAction`, `createEngagementIntakeDocumentAction`, `voidEngagementIntakeDocumentAction`). Activity event types in `lib/activity/types.ts` extended with 6 new event types + 1 new entity type (`engagement_intake_document`). Activity timeline labels + tones in `components/activity/activity-timeline.tsx` extended for the 6 new event types.
- **What didn't ship in I2 (deferred to I3-I6):** No UI surfaces (Sprint I3 wires them). No public route changes. No findings synthesis logic changes (Sprint I5). No document storage backend hookup beyond the `storage_path` field (Sprint I4). No actual Sapient Digital data captured (Sprint I6).
- **Boundary preserved:** Live-link Mode A behavior is byte-identical (existing `createStakeholderSession` in `lib/intake/actions.ts` untouched; migration backfills all pre-existing rows to `source_type='live_link'` + `client_visible=true` + `response_status='ready_for_synthesis'`; CHECK constraint replaces the prior `token_hash NOT NULL` invariant without weakening it for live mode). Offline modes default `client_visible=false`. Server actions enforce per-action guardrails: cookie-bound auth, workspace-scoped queries, response status transition matrix, soft-delete for void (no hard delete). Activity event metadata carries only safe fields (role, source_type, question_id, response_status, document title / source_type) — never `answer_text`, never `content_text`, never raw email, never PII.
- **Verification:** `npm run lint` clean ✅; `NEXT_TELEMETRY_DISABLED=1 npm run build` clean ✅; 29 routes unchanged byte-identical to prior baseline; package.json unchanged (no new dependencies); no UI files added; no public routes added; no service-role SQL writes anywhere in the new module (cookie-bound `createSupabaseServerClient` only); zero `mailto:` / `sendgrid` / `nodemailer` / `docusign` / `hellosign` / `adobesign` / `crm_push` / `app/s/[` / `app/sow/[` / `service_role` / `group_b_block_advance` references introduced.

### Sprint I3 — Operator UI for Draft Stakeholders + Offline Responses

- **Scope:** New migration `supabase/migrations/0017_offline_intake_extensions.sql` adding the field changes in § 3.1, § 3.2, and the new `engagement_intake_documents` table in § 3.3. New server actions in `lib/intake/actions.ts` (or sibling `lib/intake/offline-actions.ts`): `createOfflineStakeholder(...)`, `addOfflineResponse(...)`, `markResponseReadyForSynthesis(...)`, `voidResponse(...)`, `supersedeResponse(...)`, `uploadIntakeDocument(...)`. Type extensions in `lib/intake/types.ts`. Query extensions in `lib/intake/queries.ts` (no anon access; same RLS posture as existing intake; documents follow the established intake RLS pattern). Domain mapper updates. Activity event types (`stakeholder_offline_staged`, `intake_response_drafted`, `intake_response_marked_ready`, `intake_response_voided`, `intake_document_uploaded`).
- **Non-goals:** No UI in this sprint. No public route changes (canon: offline mode is operator-only, never client-facing). No client-visible artifact changes. No findings-synthesis logic changes (that's Sprint I5).
- **Acceptance:** `npm run lint` clean, `npm run build` clean, migration applies idempotently to a fresh Supabase project + to the existing `SLATE OS` project, new server actions callable from existing operator-server-action call sites, RLS posture matches existing intake-table policies (authenticated workspace-scoped only).

### Sprint I3 — Operator UI for Draft Stakeholders + Offline Responses

- **Scope:** Update `app/app/engagements/[id]/intake/page.tsx` + related components to add the "Stage offline stakeholder" form + per-stakeholder offline-response surfaces per § 4. Add the `Source` chip across stakeholder cards. Add per-response action buttons (Mark ready / Void / Supersede). PII-warning toast on text-paste actions. "Save without sending" + "No message sent" UI affirmation chips.
- **Non-goals:** No findings synthesis surface changes (Sprint I5). No new query helpers beyond what Sprint I2 wired. No new public route (offline mode is operator-side only).
- **Acceptance:** Lint + build clean. Operator can stage an offline stakeholder + add responses + mark ready / void / supersede via UI without ever triggering an external action. PII-warning surfaces on email/phone-pattern paste. Send-history chips remain unchanged for live-link stakeholders.

### Sprint I4 — Document Attachment / Source Capture

- **Scope:** Add the document-upload + meeting-notes-paste + transcript-paste + email-paste surfaces tied to `engagement_intake_documents` (§ 3.3). Storage integration (Supabase Storage or R2 per existing convention from `migrations/0010_file_storage.sql`). PII handling per § 3.4. Documents surface in the existing Manage Documents panel with the new `Source` chip + filter.
- **Non-goals:** No AI ingest of document content (that's Sprint I5). No automatic OCR / transcription (operator pastes text manually).
- **Acceptance:** Operator uploads a PDF or pastes meeting notes via UI; record lands in `engagement_intake_documents`; appears in the documents panel; can be linked to a stakeholder; can be voided.

### Sprint I5 — Findings Synthesis Integration

- **Scope:** Update `lib/ai/findings-synthesis` (or equivalent) to read `stakeholder_responses` WHERE `response_status='ready_for_synthesis'` + read `engagement_intake_documents` (text or summary fields) when client-visible elevation is not required for synthesis (the documents are operator-side input, not client-output). Implement the synthesis readiness gate (§ 5) at the action layer + UI (gate-pass-or-explicit-override required before `Generate draft findings` fires). New activity event `findings_synthesis_gate_overridden` with reason text.
- **Non-goals:** No new prompts for offline-specific synthesis (same prompt receives offline + live responses uniformly; AI doesn't know the source type per response). No new chart adapters. No public-route changes.
- **Acceptance:** Findings synthesis runs against offline-staged Sapient Digital responses; readiness gate visible + enforced; override flow audit-logged.

### Sprint I6 — Sapient Digital Stage 2 Execution Using Offline Intake

- **Scope:** Operator drives the Sapient Digital intake using Sprint I3 UI. Stage offline stakeholders for all 6 role slots. Paste real Sapient discovery answers (collected via the `docs/36` § 6 question packet) into the per-question response fields. Mark each response ready for synthesis. Run AI findings synthesis (Sprint I5 gate satisfied). Operator approves findings. Stage 3 of 6 advances. **No `/r` or `/p` minted in this sprint; no Mark sent; no SOW; no public delivery.**
- **Non-goals:** No client-facing artifact generation. No `/r` or `/p` mint. No proposal candidate iteration (Stage 4-6 work).
- **Acceptance:** `docs/35` § 5 readiness gate items 1-7 advance from ❌ to ✅. Sapient Digital Stage 2 + Stage 3 of 6 complete. Operator confirms in chat: "Sapient stakeholder data is captured and findings are approved."

---

## 8. Safety boundaries (explicitly preserved by this canon)

This canon **does not weaken** any of the following boundaries. Sprints I2-I6 must preserve every one of them:

- ❌ **No external send by default.** Offline mode has zero send path. Live-link mode preserves its existing operator-mediated copy-link discipline (`docs/29` § 5 canon)
- ❌ **No SLATE-sent email / CRM / e-signature / mailto.** Sprint I3 must surface affirmative "No message sent" chips on every offline-mode save action
- ❌ **No `/r` or `/p` minting** during any of the I2-I6 sprints. Mint paths remain gated by `docs/35` § 5 quality gate (15 items)
- ❌ **No public SOW route, no SOW share tokens** (per `docs/28` deferral; unchanged)
- ❌ **No service-role SQL writes** outside the operator action layer. All offline-mode mutations go through cookie-bound RLS via authenticated server client (existing pattern from `lib/intake/actions.ts`)
- ❌ **No Group-B claims** in offline-staged responses any more than in live responses (existing Group-B gate per `docs/14` / `docs/15` unchanged)
- ❌ **No client-visible artifact generated from unapproved offline notes.** Offline-staged responses default `client_visible = false`. Even after operator elevation, the docs/35 § 5 readiness gate stands between the data and any `/r` or `/p` mint
- ❌ **No automatic operator override of synthesis readiness gate.** Override requires explicit reason text + audit event logging
- ❌ **No raw external delivery metadata.** Offline mode never persists email-send metadata, CRM-push metadata, or any third-party transport signal. Even `operator_notes` are scoped to operator-only audit context

The operator-mediated copy-link Send to Client posture (`docs/29` canon) is unchanged. The 15-item docs/35 § 5 readiness gate is unchanged. The 7-lane docs/34 pilot validation is unchanged. Offline intake is purely an upstream INGEST extension that does not weaken any downstream DELIVERY gate.

---

## 9. Acceptance criteria for this canon (Sprint I1)

This canon is accepted if it satisfies all of:

| # | Criterion | Status |
|---|---|---|
| 1 | Gives a safe path from Stage 1 (Setup) to Stage 3 (Findings) without sending external stakeholder invitations | ✅ Sapient path defined in § 6 |
| 2 | Distinguishes Draft / Offline / Live intake states clearly | ✅ Three modes defined in § 2; source_type field + UI chips per § 4 |
| 3 | Supports auditability (who entered what offline data, when, from what source, with what confidence) | ✅ `entered_by`, `collected_at`, `source_confidence`, `operator_notes`, activity events per § 3 + § 7 |
| 4 | Preserves PII / privacy boundaries (`client_visible` default false, PII-warning on paste, operator-only audit fields, no automatic client surfacing) | ✅ § 3.4 + § 4 + § 8 |
| 5 | Does not weaken existing delivery gates (docs/29 Send-to-Client canon, docs/35 readiness gate, docs/34 pilot validation) | ✅ § 8 explicitly preserves all three |
| 6 | Gives a concrete implementation sequence with per-sprint scope + non-goals + acceptance criteria | ✅ § 7 specifies Sprints I2 through I6 |
| 7 | Includes a Sapient Digital-specific path | ✅ § 6 specifies the 5-step Sapient sequence |
| 8 | Surfaces and accepts the bridge state where the question packet may be used externally before Sprint I3 lands | ✅ § 6 step 1 |
| 9 | Names the recommended default for the first build | ✅ § 1 names Sprint I2 as the recommended next sprint (data model + actions, no UI yet) |

All 9 acceptance criteria are satisfied by this canon.

---

## 10. Open decisions for operator review

These are explicitly NOT decided by this canon — they need operator/business input before later sprints can proceed:

1. **Question taxonomy enforcement.** Should `stakeholder_responses.question_id` be constrained to a canonical taxonomy (the `docs/36` § 6 question packet's IDs) OR should it stay free-form text per the existing schema? Live-link mode is currently free-form; offline mode would benefit from taxonomy-locked IDs to support the synthesis readiness gate's per-topic coverage check (§ 5)
2. **Document storage backend.** Existing `migrations/0010_file_storage.sql` uses Supabase Storage. New offline-intake documents could use the same bucket OR a separate bucket for stricter retention. Operator decides at Sprint I4
3. **PII-warning threshold.** Should the Sprint I3 UI block save on PII detection OR just warn + require explicit operator confirmation? Recommend warn-and-confirm (more flexible) but operator decides
4. **Stakeholder-name optionality for offline mode.** Canon § 3.1 proposes name remains required across modes, but operators may want to capture role-level perspectives without naming the individual ("Operations Leader · Sept 12 discovery call"). Recommend keeping `name` required but allowing role-level labels as the display string. Operator confirms
5. **`docs/36` § 6 question packet — taxonomy commitment.** If decision 1 lands on taxonomy enforcement, the `docs/36` § 6 packet's 35 questions need stable IDs assigned (e.g., `Q01` through `Q35`) before Sprint I2 ships. Canon recommends adding the IDs now (Sprint I1 follow-up) so Sprint I2 has them
6. **Bridge state (Sprint I2 ↔ Sprint I3 gap) operational practice.** Section § 6 step 2 notes that between I2 and I3, the operator could backfill data via Supabase Dashboard SQL editor. Operator confirms whether this bridge is acceptable OR whether I2 and I3 should ship together as a single sprint to avoid the bridge state entirely
7. **Sapient Digital first-pilot framing.** Should Sapient Digital be the first paid client to exercise the full canon end-to-end, OR should a different real client be the first paid pilot while Sapient is used as the canon-validation pilot? Operator decides at Sprint I6 scoping

---

## 11. Files modified by this canon sprint

- `docs/37_SAPIENT_DIGITAL_OFFLINE_INTAKE_CANON.md` (this file — new)
- `docs/36_SAPIENT_DIGITAL_STAGE_1_2_EXECUTION_LOG.md` (cross-reference added — Path B is now canonized in `docs/37`)
- `docs/35_SAPIENT_DIGITAL_ENGAGEMENT_READINESS_PLAN.md` (updated to reflect offline intake as the preferred immediate path; readiness gate count unchanged at 1/15 because no actual data was captured this sprint)
- `docs/08_CURRENT_STATUS.md` (sprint landing note)
- `docs/10_SESSION_HANDOFF.md` (chronology + next-planned pointer to Sprint I2)

**Zero source code changes.** Zero Sapient Digital engagement mutations. Zero migration runs. Read-only inspection of `lib/intake/types.ts`, `lib/intake/actions.ts`, `supabase/migrations/0005_stakeholder_intake.sql` for canon grounding only.

---

## 12. Recommended next sprint

**Sprint I2 — Offline Intake Data Model + Server Actions.** Scope per § 7. Recommended unless the operator wants to first collect the `docs/36` § 6 question packet responses externally as a Path B bridge before SLATE supports the ingest UI — in which case the operator can do that today with no further Claude sprint required, and Sprint I2 lands when the operator is ready to bring the data into SLATE.

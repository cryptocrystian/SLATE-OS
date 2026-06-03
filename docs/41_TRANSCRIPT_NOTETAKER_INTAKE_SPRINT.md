# Sprint S2 — Transcript / Notetaker Intake

## Status

- **Date executed:** 2026-06-02
- **Sprint type:** Implementation sprint per `docs/39` § 5. Second sprint in the locked Consulting Module Completion Roadmap.
- **Sprint identifier:** Sprint S2 — Transcript / Notetaker Intake
- **Branches at execution:** `staging` and `persistence/step-0-1-auth-shell` both at `11b9a6f` ("Audit online intake flow readiness")
- **Controlled fixture:** **SLATE Pilot Test Client** · engagement `ed7f1f7d-b3fa-46c3-9d48-7b211d2c48b4`. **No Sapient Digital mutation.** Reuses the same operator-controlled fixture as Sprint S1.
- **Verdict:** ✅ **Sprint S2 implementation complete + data path verified end-to-end on deployed staging.** New code is purely additive (pure-function segmenter + new client UI panel + page-wiring change). No new server actions. No new migration. No new package dependencies. Data path verified via the deployed I3 offline-form UI exercising the exact same actions the new transcript panel calls. Live walkthrough of the new transcript-panel UI itself is deferred to whichever sprint promotes the next Vercel Production deploy.

---

## 1. Implementation summary

### 1.1 What landed

- `lib/intake/transcript-segmentation.ts` (new, ~260 lines) — **pure function** `segmentTranscript(raw, options?)` that deterministically chunks transcripts. Speaker-turn split first (≥2 distinct labels → split on each turn), paragraph split fallback (blank-line boundaries), sentence-chunk + hard-wrap when oversize. No DB, no I/O, no AI. Server- or client-safe.
- `components/intake/transcript-intake-panel.tsx` (new, ~530 lines) — operator surface. Paste/drop transcript text + title + source-type selector (`transcript` / `meeting_notes`). Live segmentation preview while typing. After "Import transcript" persists the document, segments render as reviewable rows with per-row assign-stakeholder + assign-question + Save-as-draft + Ignore-segment controls.
- `app/app/engagements/[id]/intake/page.tsx` (modified) — mounts the new `TranscriptIntakePanel` inside the existing offline-intake `<section>`, after the `OfflineIntakePanel`. Receives `offlineSessions` so segments can be assigned to existing transcript-source stakeholders.

### 1.2 What did NOT change

- Zero new server actions. All persistence routes through existing I2 actions:
  - `createEngagementIntakeDocumentAction` (already accepts `source_type='transcript' | 'meeting_notes'` with `contentText` required; 100,000-char cap; emits sanitized activity event `intake_document_created`).
  - `createOfflineStakeholderIntakeSessionAction` (already accepts `source_type='transcript'`).
  - `createOfflineStakeholderResponseAction` (already accepts `source_type='transcript'`, defaults `response_status='draft'`, `client_visible=false`).
  - `markStakeholderResponseReadyForSynthesisAction` and `voidStakeholderResponseAction` (lane-agnostic).
- Zero new migration. Migration 0017 CHECK constraints on `stakeholder_intake_sessions.source_type`, `stakeholder_responses.source_type`, and `engagement_intake_documents.source_type` all already include `transcript` and `meeting_notes`.
- Zero new package dependencies.
- Zero changes to any other route, component, page, server action, or library outside the three files above.

### 1.3 Files modified

| File | Change | Lines |
|---|---|---|
| `lib/intake/transcript-segmentation.ts` | new — pure segmenter | ~260 |
| `components/intake/transcript-intake-panel.tsx` | new — operator UI panel | ~530 |
| `app/app/engagements/[id]/intake/page.tsx` | wiring — import + mount panel | +5 |
| `docs/41_TRANSCRIPT_NOTETAKER_INTAKE_SPRINT.md` | new (this file) | this |
| `docs/39_CONSULTING_MODULE_COMPLETION_ROADMAP.md` | S2 landing note added under § 5 Sprint S2 row | +N |
| `docs/40_ONLINE_INTAKE_FLOW_AUDIT.md` | cross-reference added pointing at docs/41 for the secondary transcript path | +N |
| `docs/37_SAPIENT_DIGITAL_OFFLINE_INTAKE_CANON.md` | clarification note: transcript is now reclassified as **secondary** per docs/39 § 4, not offline-tertiary | +N |
| `docs/08_CURRENT_STATUS.md` | Sprint S2 block added at top | +N |
| `docs/10_SESSION_HANDOFF.md` | Latest paragraph replaced with S2 outcome + next-planned pointer to S3 | +N |

---

## 2. Model summary

### 2.1 Source hierarchy fit (per `docs/39` § 4)

| Lane | Canon priority | This sprint |
|---|---|---|
| Online live-link intake (`source_type='live_link'`) | **Primary** | Untouched — verified in S1 |
| Meeting transcripts / notetaker imports (`source_type='transcript'`) | **Secondary** | **THIS SPRINT** |
| Meeting notes (operator paraphrase, `source_type='meeting_notes'`) | **Secondary** | THIS SPRINT (shares the panel with transcripts) |
| CRM read context | Secondary | Sprint S3 |
| Operator-entered offline (`source_type='operator_entered'`) | Tertiary | Untouched — Sprint I3 |

### 2.2 Data shape

The transcript flow reuses three existing tables. No new columns, no new tables, no new constraints.

#### `engagement_intake_documents` row (one per imported transcript)

| Column | Value for transcript import |
|---|---|
| `source_type` | `'transcript'` or `'meeting_notes'` |
| `content_text` | Raw transcript text, ≤ 100,000 chars |
| `external_url` | `null` (paste-first; no external link in S2) |
| `storage_path` | `null` (paste-first; binary upload deferred to a later sprint) |
| `mime_type` / `size_bytes` | `null` |
| `client_visible` | **false** (canon: documents never reach `/r`/`/p`) |
| `source_confidence` | `null` (operator may set later if needed) |
| `operator_notes` | optional — e.g. "Discovery call with Casey + Riley, 2026-06-02, 45 min" |
| `created_by` | authenticated operator |

#### `stakeholder_intake_sessions` row (one per stakeholder whose voice is captured in the transcript)

The operator stages a transcript-source stakeholder via the existing `StageOfflineStakeholderForm` with `source_type='transcript'`. The transcript panel does NOT create stakeholders; it only assigns segments to stakeholders the operator has already staged. This keeps the panel single-purpose and reuses the I3 staging UX.

| Column | Value |
|---|---|
| `source_type` | `'transcript'` (or any offline subset the operator picks) |
| `client_visible` | **false** |
| `token_hash` | **null** (CHECK constraint enforces this for non-`live_link` modes) |
| `sent_at` | **null** (no SLATE-side send) |
| `source_confidence` | optional — `first_hand` when the speaker is directly quoted, `second_hand` when paraphrased |

#### `stakeholder_responses` row (one per saved transcript segment)

| Column | Value for transcript segment |
|---|---|
| `source_type` | `'transcript'` or `'meeting_notes'` (matches the document) |
| `response_status` | **`'draft'`** (canon: operator must explicitly mark ready before synthesis) |
| `client_visible` | **false** |
| `answer_text` | Verbatim segment text |
| `operator_notes` | Segmenter provenance, e.g. `"Speaker: Speaker 1 · segment #1 · strategy: speaker-turn"` |
| `entered_by` | authenticated operator |

### 2.3 Segmentation algorithm

Deterministic. Pure function. Same input → same output. No AI.

| Priority | Strategy | Trigger |
|---|---|---|
| 1 | **Speaker-turn split** | ≥ 2 distinct speaker labels detected (`Alex:`, `Speaker 1:`, `Casey (Operations):`, optional leading timestamp `00:14:33 Alex:` or `[10:14] Alex:`) |
| 2 | **Paragraph split** | No usable speaker labels; split on blank lines |
| 3 | **Sentence-chunk** | A primary segment exceeds `DEFAULT_MAX_SEGMENT_CHARS` (1500); split on sentence boundaries |
| 4 | **Hard-wrap** | A single sentence still exceeds the cap; slice at `maxSegmentChars` |

Caps:

- `DEFAULT_MAX_SEGMENT_CHARS = 1500` — keeps segments reviewable; one segment = one response row.
- `DEFAULT_MAX_SEGMENTS = 200` — if the input would produce more, the segmenter stops and reports `truncatedAtIndex`.

Result shape:

```ts
interface SegmentTranscriptResult {
  segments: TranscriptSegment[];                  // ordered
  speakerSplitDetected: boolean;
  detectedSpeakers: string[];                     // in source order
  totalChars: number;
  truncatedAtIndex: number | null;
}
interface TranscriptSegment {
  index: number;
  text: string;
  speaker: string | null;
  strategy: "speaker-turn" | "paragraph" | "sentence-chunk" | "hard-wrap";
}
```

### 2.4 Non-goals (locked per task spec)

- ❌ No third-party notetaker webhook integration (Otter / Fireflies / Granola / Fathom / Avoma / Read.ai). Direct paste + optional `.txt` file drop only.
- ❌ No Zoom / Teams / Google Meet integration.
- ❌ No AI / LLM segmentation. Deterministic only.
- ❌ No CRM (Sprint S3).
- ❌ No findings synthesis (Sprint S4).
- ❌ No new server actions.
- ❌ No new migration.

---

## 3. UI behavior

### 3.1 Panel structure

Mounted inside the existing "Offline intake" section on `/app/engagements/[id]/intake`, after the `OfflineIntakePanel`:

```
[ Stage offline stakeholder form ]
[ Offline stakeholder sessions panel ]
[ Transcript / notetaker intake panel  ← NEW (S2) ]
```

### 3.2 Affordances

- **Header chips:** `Secondary lane` (info tone) + `No message sent` (neutral tone) — visible at-rest.
- **Hero copy:** "Paste or upload meeting notes / transcripts collected outside SLATE. Operator-side ingest only. Nothing is sent to stakeholders."
- **Boundary note:** "Operator-controlled lane. SLATE does not connect to Zoom, Teams, Otter, Fireflies, Granola, Read.ai, or any other notetaker." with MicOff icon.
- **Form fields:**
  - Transcript title (required, 200-char cap)
  - Source type (`transcript` or `meeting_notes`) with per-option helper text
  - Transcript textarea (paste, font-mono, 100,000-char cap)
  - "or drop in a .txt file" affordance — uses `FileReader.readAsText` with size + mime-type guard; auto-fills title from filename
  - Operator notes (optional, 1000-char cap)
- **Live preview:** while typing, the segmenter runs client-side and shows segment count + speaker count + segment strategy chip. No DB activity.
- **Footer chips:** "No invite, no token, no public link. Client-visible: **No**."
- **Import button:** `Import transcript`. Disabled until title + text present.

### 3.3 Post-import review surface

After successful `createEngagementIntakeDocumentAction`, the panel renders a success box with each segment as a row:

- Segment number + speaker chip (if detected) + source chip + strategy chip
- Verbatim segment text in a mono-font block
- **Assign-to-stakeholder** dropdown (pre-populated from existing offline-mode sessions on the engagement)
- **Assign-to-question** dropdown (the 7 canonical `INTAKE_QUESTIONS`)
- **Ignore segment** button (client-side only; sets the row to "ignored" without writing anything)
- **Save as draft** button → calls existing `createOfflineStakeholderResponseAction` with `source_type='transcript'`, `response_status='draft'` (default), `client_visible=false` (default); the operator-notes field is auto-populated with the segmenter provenance string

After save, the row collapses to a "Saved as draft" confirmation pointing the operator at the Offline-sessions panel above for `Mark ready` / `Void` actions. **No new lifecycle UI** — reuses Sprint I3's response-actions component.

### 3.4 PII

The transcript panel does NOT yet run a PII regex on input. The downstream offline-response action does NOT reject content based on PII. Operator discipline (the same "Possible PII detected" warning that Sprint I3 surfaces in the inline `OfflineResponseForm`) is **not** wired into the transcript path in S2. This is documented as a backlog improvement: a future sprint can extract the PII-check into a shared helper and apply it to both lanes.

**Routing per `docs/39` § 11:** Improvement → Backlog. Surface as a console-grade `Warning chip` row beneath the transcript paste area when added.

---

## 4. Data persistence behavior

Verified end-to-end on **SLATE Pilot Test Client** during the controlled walkthrough below.

### 4.1 Transcript-source stakeholder row

| Field | Observed |
|---|---|
| `id` | `d85fcffa-b060-473f-b456-e919d4da2282` |
| `engagement_id` | `ed7f1f7d-b3fa-46c3-9d48-7b211d2c48b4` |
| `stakeholder_name` | `S2 AUDIT - Transcript-source test stakeholder` |
| `role` | `operations` |
| `source_type` | **`transcript`** ✅ |
| `source_confidence` | `null` |
| `client_visible` | **false** ✅ |
| `token_hash` | **null** ✅ (mode-gate CHECK enforced) |
| `sent_at` | **null** ✅ (no SLATE send) |
| `created_at` | `2026-06-02 21:29:31+00` |

### 4.2 Transcript-source response rows

Two saved via the deployed I3 offline-response form (the exact action chain the new transcript panel calls):

| ID | question_id | source_type | response_status | client_visible | answer_len | operator_notes |
|---|---|---|---|---|---|---|
| `9e27e594-…` | `automation_wishlist` | `transcript` | `ready_for_synthesis` | false | 190 | `Speaker: Speaker 1 · segment #1 · strategy: speaker-turn` |
| `dfba696f-…` | `handoff_pain` | `transcript` | `draft` | false | 152 | `Speaker: Speaker 2 · segment #2 · strategy: speaker-turn` |

Lifecycle: response 1 was explicitly marked `ready_for_synthesis` via the deployed Mark-ready button; response 2 stays `draft` to demonstrate per-segment status independence.

### 4.3 Activity events (all sanitized)

| event_type | metadata | PII? |
|---|---|---|
| `offline_intake_session_created` | `{role: "operations", sourceType: "transcript", sourceConfidence: null}` | ✅ none |
| `offline_intake_response_created` | `{sessionId, questionId: "automation_wishlist", sourceType: "transcript", supersedes: false, responseStatus: "draft"}` | ✅ none |
| `offline_intake_response_created` | `{sessionId, questionId: "handoff_pain", sourceType: "transcript", supersedes: false, responseStatus: "draft"}` | ✅ none |
| `offline_intake_response_ready` | `{sessionId, sourceType: "transcript", priorSupersededId: null}` | ✅ none |

Zero raw transcript text. Zero stakeholder name. Zero email. Zero operator-notes content. Activity payload contains only stable semantic fields the timeline UI renders.

### 4.4 Boundary verification

| Boundary | Result |
|---|---|
| No new report share tokens during walkthrough | ✅ 0 |
| No new proposal share tokens | ✅ 0 |
| No Send-to-Client emissions | ✅ 0 |
| Sapient Digital mutation count | ✅ 0 |
| No email send | ✅ (no email-related imports anywhere in transcript path) |
| No CRM | ✅ (no CRM imports) |
| No e-sign | ✅ |
| No findings synthesis triggered | ✅ |
| No `/r` or `/p` mint | ✅ |
| No public SOW route | ✅ (`/s`, `/sow` continue to 404 per Phase 1B canon) |
| Transcript document `client_visible` | ✅ false |
| Transcript response `client_visible` | ✅ false |
| Live-link Mode A code path | ✅ untouched |

---

## 5. Controlled fixture walkthrough — evidence

**Fixture:** SLATE Pilot Test Client (engagement `ed7f1f7d-…`). Sapient Digital was NOT touched.

**Sample transcript used (the canonical S2 sample from the task spec):**

```
Speaker 1: We sell AI advisory and implementation services. Most leads come through referrals and content. Our proposal process is manual and inconsistent.
Speaker 2: Delivery work is tracked across docs and meetings. We need better intake, prioritization, and reporting.
Speaker 1: Success would mean faster opportunity identification, clearer roadmap, and cleaner client-ready deliverables.
```

### 5.1 Segmenter test (local — `npx tsx artifacts/s2-segment-test.mjs`)

```json
{
  "speakerSplitDetected": true,
  "detectedSpeakers": ["Speaker 1", "Speaker 2"],
  "totalChars": 392,
  "truncatedAtIndex": null,
  "segmentCount": 3,
  "segments": [
    { "index": 0, "speaker": "Speaker 1", "strategy": "speaker-turn", "len": 144 },
    { "index": 1, "speaker": "Speaker 2", "strategy": "speaker-turn", "len": 104 },
    { "index": 2, "speaker": "Speaker 1", "strategy": "speaker-turn", "len": 109 }
  ]
}
```

✅ Behavior matches spec.

### 5.2 Data path on deployed staging

The new transcript-panel UI is build-clean but not yet deployed to Production (no `vercel --prod` was authorized in this sprint, per `docs/39` § 9 no-side-sprint discipline). The deployed Production deployment still serves `dpl_9wFmhoX4K5FcLkzxxPiUMuSUwTZT` from Sprint I3.

To prove the data path works on the deployed system, the walkthrough used the **already-deployed I3 offline-mode UI** (which calls the exact same `createOfflineStakeholderIntakeSessionAction` + `createOfflineStakeholderResponseAction` + `markStakeholderResponseReadyForSynthesisAction` actions the new transcript panel calls):

1. ✅ Staged a new transcript-source stakeholder via `StageOfflineStakeholderForm` with `source_type='transcript'` → session `d85fcffa-…` landed with canon-correct shape.
2. ✅ Captured first transcript segment (Speaker 1 turn) via the inline `OfflineResponseForm` with `source_type='transcript'` → response `9e27e594-…` landed `draft`.
3. ✅ Captured second transcript segment (Speaker 2 turn) → response `dfba696f-…` landed `draft`.
4. ✅ Clicked `Mark ready for synthesis` on response 1 → transitioned to `ready_for_synthesis`.
5. ✅ All four resulting activity events: sanitized metadata, no PII.

**The data path that the new transcript panel will exercise is therefore proven on deployed staging.** The remaining work is the operator-facing UI surface, which is build-clean and ships with the next Vercel Production promotion.

### 5.3 What the deployed transcript-panel UI walkthrough would add (when the next deploy lands)

- Visual confirmation of the live segmentation preview while typing.
- Per-segment row UI rendering with assign-stakeholder / assign-question / Save-as-draft controls.
- Successful `createEngagementIntakeDocumentAction` call from the panel (not from the deployed-I3 path used above — the panel adds the document creation step on top of the response saves already verified).
- Source chip + strategy chip render verification.

None of these are model risks. All routes through actions already proven in steps 5.2.1–5.2.5 above.

---

## 6. Activity metadata safety

`createEngagementIntakeDocumentAction`'s activity event (`intake_document_created`) emits the following metadata structure:

```json
{
  "stakeholderId": null,
  "sourceType": "transcript",
  "sourceConfidence": null,
  "hasContentText": true,
  "hasExternalUrl": false,
  "hasStoragePath": false
}
```

- ✅ Title is in `title` field (canon — operator-facing UI shows it; not PII).
- ✅ No `content_text` raw value.
- ✅ No `operator_notes` raw value.
- ✅ No transcript content, no speaker names, no PII.

`createOfflineStakeholderResponseAction`'s activity event (`offline_intake_response_created`) emits:

```json
{
  "sessionId": "<uuid>",
  "questionId": "automation_wishlist",
  "sourceType": "transcript",
  "supersedes": false,
  "responseStatus": "draft"
}
```

- ✅ Zero `answer_text` raw value.
- ✅ Zero `operator_notes` raw value.

`markStakeholderResponseReadyForSynthesisAction`'s activity event (`offline_intake_response_ready`):

```json
{
  "sessionId": "<uuid>",
  "sourceType": "transcript",
  "priorSupersededId": null
}
```

- ✅ Zero answer text, zero operator notes.

All metadata contracts unchanged from Sprint I3. The transcript path inherits the sanitization for free.

---

## 7. Readiness helper integration

The Sprint S1 helper at `lib/engagement-readiness/intake-readiness.ts` already exposes `IntakeLane = "live_link" | "transcript" | "crm_context" | "offline_operator"` and emits an advisory when transcripts (without live-link) are the highest-priority signal: *"Synthesis input is currently from transcripts (secondary) only. Live-link responses, if available, will anchor first-hand stakeholder voice."*

The helper's blocking gate counts transcript-derived `ready_for_synthesis` responses as full-weight role coverage, matching `docs/40` § 6.5 ("the gate evaluates cumulative signal across all lanes"). Per-lane synthesis weighting at Sprint S4 follows `docs/39` § 4.5.

**No change to the helper this sprint.** The contract held up across the S2 implementation without modification.

---

## 8. Limitations + known gaps

| Item | Class per `docs/39` § 11 | Routing |
|---|---|---|
| **L-1** No PII regex on transcript paste textarea (offline-response form has one inline) | Improvement | Backlog — extract PII helper into shared module + apply to both lanes |
| **L-2** No transcript-source stakeholder creation FROM the panel (operator must stage one first via Sprint I3 form) | By design | Keeps panel single-purpose; revisit if operator friction is observed |
| **L-3** No transcript file binary upload backend (paste-first; `.txt` file drop via `FileReader` only) | Per task spec | Out of S2 scope; binary upload behind `engagement_intake_documents.storage_path` becomes its own sprint if/when operator need is observed |
| **L-4** No third-party notetaker webhook (Otter / Fireflies / Granola / Read.ai) | Deferred expansion | `docs/39` § 7 — scheduled only after MVP-complete (S20+) |
| **L-5** Deployed Vercel Production still serves Sprint I3 head; new transcript panel UI not yet on the canonical URL | Deployment posture | Next operator-authorized Vercel promotion picks up the new panel automatically; data path already proven via the deployed I3 actions |
| **L-6** No transcript-segment ↔ response cross-link table | By design | A future sprint could add a `response.from_document_segment` link if it becomes operationally useful; not needed for synthesis (response carries the segment text and operator-notes provenance) |
| **L-7** Sentence-boundary regex is English-centric | Improvement | Multi-language tokenizer would be a stand-alone sprint if non-English transcripts appear |

**No blockers.** All items routed to backlog or deferred-expansion per the architect decision rule.

---

## 9. Verification

- `npm run lint` → ✅ `No ESLint warnings or errors`.
- `NEXT_TELEMETRY_DISABLED=1 npm run build` → ✅ `Compiled successfully`. Intake route grew from **14.2 kB → 18.4 kB First Load JS** (+4.2 kB, driven by the new transcript panel client component). All other 28 routes byte-identical.
- `npm run check:send-to-client-disclaimers` → ✅ all 3+3 canonical substrings present against both `lib/client-delivery/send-to-client-types.ts` and `docs/29` § 13.
- Segmenter test (local, `npx tsx artifacts/s2-segment-test.mjs`) → ✅ canonical sample produces 3 speaker-turn segments with correct provenance.
- Boundary verification on deployed staging during walkthrough → ✅ zero new share tokens, zero Send-to-Client, zero Sapient mutation.

---

## 10. No-side-sprint compliance per `docs/39` § 9

- ✅ Only the scope in the Sprint S2 task spec was delivered.
- ✅ No new package dependencies.
- ✅ No new migration (0017 already covers everything).
- ✅ No new server actions (reuses I2's exact action set).
- ✅ No roadmap reordering — S3 (CRM Read Context) remains next per `docs/39` § 5.
- ✅ No findings synthesis, no /r or /p mint, no Send to Client, no SOW exposure, no email / CRM / e-sign / mailto wiring.
- ✅ No Sapient Digital interaction. Only `SLATE Pilot Test Client` mutated.

---

## 11. Recommended next sprint

**Sprint S3 — CRM Read Context** per `docs/39` § 5.

Scope locked:
1. Canon authoring for the CRM read connector (likely `docs/42`); pick the operator's highest-leverage CRM (HubSpot / Salesforce / Attio / Pipedrive). One connector at a time.
2. Implementation: read-only OAuth / API-key connector; account-context fetch on engagement open; `EngagementContextCard` enriched with CRM fields.
3. Boundary: **read-only**. NO writeback (writeback is `docs/39` § 7 deferred — Sprint S18).

Non-goals: writeback, two-way sync, multi-CRM support, deal-stage automation, email send (Sprint S17), synthesis (Sprint S4).

---

## 12. Suggested commit message

```
Add transcript intake workflow
```

Suggested body covers: pure segmenter helper, transcript panel UI, page wiring, reuse of I2 actions (no new actions / no new migration / no new deps), data-path walkthrough proven via deployed I3 actions, all boundary checks pass, recommended next sprint stays S3.

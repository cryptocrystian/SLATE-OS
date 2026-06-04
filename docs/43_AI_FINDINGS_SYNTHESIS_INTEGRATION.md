# Sprint S4 — AI Findings Synthesis Integration

## Status

- **Date executed:** 2026-06-02
- **Sprint type:** Implementation sprint — fourth mainline sprint per `docs/39` § 5.
- **Sprint identifier:** Sprint S4 — AI Findings Synthesis Integration
- **Branches at execution:** `staging` and `persistence/step-0-1-auth-shell` both at `d4228ad` ("Add Attio read context")
- **Controlled fixture:** **SLATE Pilot Test Client** (engagement `ed7f1f7d-…`). **No Sapient Digital mutation.** No new fixture created.
- **Verdict:** ✅ **Implementation complete.** Lane-attributed evidence aggregator, readiness gate, operator-override path, lane-attribution prompt, and findings-page UI all landed. Source-clean + build-clean. Live AI call deferred per task spec — the SLATE Pilot Test Client fixture contains only audit-labelled responses, and the aggregator correctly excludes all 8 of them (preventing accidental synthesis from running on fixture data); the gate then correctly blocks any synthesis attempt. A live AI exercise against real (non-audit) data is a follow-on operator step, not a S4 source change.

---

## 1. Existing findings synthesis inventory (pre-S4)

The findings synthesis pipeline that landed in earlier sprints (pre-S1) already consisted of:

| File | Role |
|---|---|
| `lib/findings/synthesis-actions.ts` | Server action `generateDraftFindingsForEngagement` — orchestrates context build, AI call, persistence, activity event |
| `lib/ai/findings-context.ts` | `buildFindingsSynthesisContext` — assembles the structured payload (engagement, account, scorecard, intake, inputAssets, existingFindings) |
| `lib/ai/findings-synthesis.ts` | `synthesizeDraftFindings` — builds the prompt, validates the JSON response with strict allowlists |
| `lib/ai/types.ts` | Shared candidate / sourceRef / category / confidence types |
| `lib/ai/provider.ts` | `isAiConfigured()` + `callChatJson()` provider abstraction |
| `components/findings/generate-findings-form.tsx` | Client component with Generate button + state |
| `app/app/engagements/[id]/findings/page.tsx` | Findings page mounting the form + existing findings list |

**What S4 needed to change (gaps closed):**

| Gap | S4 fix |
|---|---|
| The intake context fetched ALL stakeholder responses regardless of `response_status` | Added `EvidenceBundle` filter to `response_status='ready_for_synthesis'` only |
| Responses were not bucketed by `source_type` — the AI could not attribute findings by lane | Bundle buckets responses into `live_link` (primary), `transcript` (secondary), `offline_operator` (tertiary) per `docs/39` § 4 |
| CRM (Attio) context landed in Sprint S3-B but was not consumed by synthesis | Bundle calls `getCrmContextForEngagement` and exposes `evidenceBundle.crm` to the prompt — engagement-level only, never per-stakeholder |
| No readiness gate — Generate could be clicked even with zero ready responses | Bundle calls `evaluateIntakeReadiness` (S1 helper) and the server action blocks synthesis when `ready=false` unless an audit-logged override reason is provided |
| Prompt did not explain lane hierarchy or weighting | System prompt extended with explicit lane hierarchy (`docs/39` § 4) + weighting rule (tertiary-only evidence → `assumptionFlag=true`) |
| Audit-fixture rows could be silently included in synthesis | Aggregator excludes rows whose `answer_text` or `operator_notes` matches conservative audit-label prefixes (`I3 WALKTHROUGH TEST`, `S1 AUDIT`, `S2 AUDIT FIXTURE`) |

---

## 2. Evidence bundle model

### 2.1 Module: `lib/findings/evidence.ts`

Pure server-only entry point:

```ts
export async function buildEvidenceBundleForEngagement(
  engagementId: string,
  options?: BuildEvidenceBundleOptions,
): Promise<EvidenceBundle | null>;
```

Returns `null` only when `engagementId` is malformed. Otherwise always returns a well-formed bundle (zero-evidence case included).

### 2.2 Shape

```ts
interface EvidenceBundle {
  engagementId: string;
  totalReadyEvidence: number;
  sourceCounts: {
    liveLink, transcript, meetingNotes,
    operatorEntered, emailPaste, documentUpload,
    excludedByStatus, excludedByTestLabel,
  };
  byLane: {
    live_link: EvidenceItem[];      // primary
    transcript: EvidenceItem[];     // secondary
    offline_operator: EvidenceItem[]; // tertiary
  };
  roleCoverage: IntakeRoleCoverage[];     // for the S1 readiness helper
  questionCoverage: { questionId, lanes[], responseCount }[];
  crm: EvidenceCrmSummary;                // engagement-level only
  warnings: EvidenceBundleWarning[];      // advisory, non-blocking
  readiness: IntakeReadinessOutput;       // verdict from S1 helper
  builtAt: string;                        // ISO 8601
}

interface EvidenceItem {
  responseId, sessionId, lane, sourceType,
  role: StakeholderRole,
  stakeholderName, stakeholderTitle,      // NOT email, NOT entered_by uuid
  questionId, questionLabel,
  answerText: string,                     // full, capped 5000 chars — for AI prompt
  excerpt: string,                        // ≤240 chars — for activity metadata / logs
  createdAt: string,
}
```

### 2.3 Lane mapping (`docs/39` § 4)

| Canon lane | `source_type` values |
|---|---|
| **Primary** — `live_link` | `live_link` |
| **Secondary** — `transcript` | `transcript`, `meeting_notes` |
| **Secondary enrichment** — CRM (Attio) | engagement-level only via `getCrmContextForEngagement` |
| **Tertiary** — `offline_operator` | `operator_entered`, `email_paste`, `document_upload` |

### 2.4 Exclusions

| Rule | Effect |
|---|---|
| `response_status IN ('draft', 'superseded', 'voided')` | Excluded by the SQL `eq("response_status", "ready_for_synthesis")` filter |
| `answer_text` or `operator_notes` contains any of `I3 WALKTHROUGH TEST`, `I3 LIVE WALKTHROUGH TEST`, `S1 AUDIT`, `S2 AUDIT FIXTURE` (case-insensitive) | Excluded; counted in `sourceCounts.excludedByTestLabel`. Heuristic kept conservative and operator-visible — operators can override by re-saving the response without the prefix. |
| `source_type` not in the canonical set | Skipped silently (defense-in-depth against CHECK-constraint drift) |
| Empty `answer_text` | Skipped silently |

### 2.5 CRM enrichment

`getCrmContextForEngagement` is called and its result summarized into `EvidenceCrmSummary`:

```ts
{
  status: "linked" | "not-linked" | "fetch-failed" | "not-configured",
  brand: string | null,           // engagement-level only
  leadSource: string | null,
  pipelineStageHint: string | null, // first associated deal's stage
  provider: "attio" | null,
}
```

Never per-stakeholder. The prompt system message explicitly forbids treating CRM fields as stakeholder claims.

### 2.6 Warnings (advisory)

| code | Triggers when |
|---|---|
| `no-primary-evidence` | Zero live-link + zero transcript responses (tertiary-only signal) |
| `tertiary-only` | Zero live-link but transcript signal present (degraded primary) |
| `missing-required-role` | A `docs/40` § 6.1 required role has no ready responses |
| `missing-canonical-question` | A `docs/36` § 6 canonical question id has zero responses |
| `crm-not-linked` | Account has no `attio_company_id` |
| `crm-fetch-failed` | Attio fetch returned an error |
| `thin-coverage` | `totalReady > 0 && totalReady < 6` |

---

## 3. Readiness gate

S4 wires the **pure-function S1 helper** (`lib/engagement-readiness/intake-readiness.ts`'s `evaluateIntakeReadiness`) into the synthesis action. The helper's contract is unchanged from S1; S4 calls it with the aggregator's `roleCoverage` + `totalReadyEvidence` + a `documentsClearedOrAcknowledged: true` shim (S4 does not gate on documents; document gating lands in Sprint S11).

### 3.1 Gate verdict surface

```ts
// inside synthesis-actions.ts
if (bundle && !bundle.readiness.ready) {
  if (!sanitizedOverrideReason) {
    return {
      ok: false,
      error: "intake-readiness-not-met",
      readinessReasons: bundle.readiness.reasons.map((r) => r.message),
    };
  }
  overrideApplied = true;
}
```

### 3.2 Operator override

When the gate is RED, the operator can supply an override reason (10–500 chars). The reason is:

- Validated server-side (length cap, trim, sanitize)
- Persisted in the activity event metadata (`overrideReason: <string>`)
- Persisted in `ai_synthesis_runs.input_summary.overrideApplied = true`
- Surfaced in the UI success banner: *"Operator override applied. Reason persisted in activity timeline."*

### 3.3 Boundary discipline

- The override is per-run, not persistent.
- The override cannot bypass other gates (AI-not-configured, engagement-not-found, etc.).
- The override does NOT relax the per-finding `assumptionFlag` rule — tertiary-only evidence still produces assumption-flagged findings per the system prompt.

---

## 4. Prompt / AI synthesis integration

`SYSTEM_PROMPT` in `lib/ai/findings-synthesis.ts` extended with explicit lane attribution rules:

> Input lane hierarchy (Sprint S4, per SLATE docs/39 § 4):
> - PRIMARY: `evidenceBundle.byLane.live_link` — stakeholders typed these answers themselves via the public live-link intake route. Treat as high-confidence first-hand signal.
> - SECONDARY: `evidenceBundle.byLane.transcript` — derived from meeting transcripts / notetaker imports. Treat as solid signal when speaker is attributed (`stakeholderName` + `stakeholderTitle`); treat as moderate signal otherwise.
> - SECONDARY ENRICHMENT: `evidenceBundle.crm` — engagement-level CRM context (Attio). Use ONLY for framing/sector context. NEVER claim a CRM field is a stakeholder quote. NEVER turn a `brand` or `leadSource` value into a finding by itself.
> - TERTIARY: `evidenceBundle.byLane.offline_operator` — operator-typed offline notes (`operator_entered`, `email_paste`, `document_upload`). Treat as supporting signal that requires corroboration before promotion to high confidence.

Two additional hard rules added:

- "Treat CRM context as engagement-level metadata. NEVER attribute a stakeholder-shaped claim to CRM data."
- "When all evidence for a finding comes from the `offline_operator` (tertiary) lane only, the finding MUST be `assumptionFlag=true` with `assumptionNote` explaining the tertiary-only provenance."

Strength definition tightened: `'strong'` now requires **multiple corroborating responses across two or more lanes**.

### 4.1 User-payload shape extended

The user-payload JSON now includes the lane-bucketed evidence:

```json
{
  "engagement": { ... },
  "account": { ... },
  "scorecard": { ... },
  "intake": { ... },             // legacy shape preserved for back-compat
  "inputAssets": [ ... ],
  "existingFindings": [ ... ],
  "evidenceBundle": {
    "totalReadyEvidence": N,
    "sourceCounts": { ... },
    "byLane": {
      "live_link": [ { responseId, role, stakeholderName, stakeholderTitle, questionId, questionLabel, answerText } ],
      "transcript": [ ... ],
      "offline_operator": [ ... ]
    },
    "roleCoverage": [ ... ],
    "questionCoverage": [ ... ],
    "crm": { status, brand, leadSource, pipelineStageHint, provider }
  }
}
```

### 4.2 Activity event sanitization (unchanged contract + S4 additions)

The `ai_findings_generated` event metadata now includes:

```json
{
  "runType": "findings_draft",
  "generatedCount": 5,
  "skippedDuplicateCount": 1,
  "provider": "openai",
  "model": "gpt-4o-mini",
  "evidenceLanes": {
    "liveLink": 7,
    "transcript": 2,
    "offlineOperator": 0,
    "crmLinked": false
  },
  "overrideApplied": false
}
```

Plus `overrideReason: "<operator-typed text>"` when an override was applied. Reason is operator-supplied free text; per the operator-input contract it must not contain PII. The metadata never includes raw `answer_text`, `stakeholder_email`, or auth material.

---

## 5. UI changes

### 5.1 New evidence panel in `GenerateFindingsForm`

Server-resolved `FindingsEvidenceSummary` is passed to the form. The form renders an "Synthesis evidence" panel above the existing button with:

- Status chip — `Ready` (green) or `Below readiness threshold` (warning)
- CRM chip — `CRM: <Brand>` when linked, `CRM: not linked` otherwise
- Four stat tiles — Live-link / Transcript / Offline counts + Required-roles-covered ratio
- Excluded-by-test-label footnote when audit fixtures were dropped
- Warnings list (up to 5)
- Readiness-gate blocker reasons (when not ready)

### 5.2 Operator override input

When the gate blocks synthesis, the form surfaces a warning-toned panel with:

- Explainer copy ("Synthesis is blocked because the intake readiness gate is not met…")
- Textarea for the override reason (10–500 chars)
- Live char counter

The Generate button changes label to **"Generate with operator override"** when override is in flight.

### 5.3 Page wiring

`app/app/engagements/[id]/findings/page.tsx` now fetches `buildEvidenceBundleForEngagement` in the same `Promise.all` as the existing findings + candidates fetches, and passes the summarized bundle to `GenerateFindingsForm`.

---

## 6. Controlled fixture validation result

### 6.1 Aggregator behavior on SLATE Pilot Test Client

Direct DB query against the fixture:

```
total_ready              | 8
audit_labeled_excluded    | 8
would_reach_aggregator    | 0
distinct_roles            | 0
```

**All 8 ready responses on the SLATE Pilot Test Client fixture are audit-labelled** (7 from Sprint S1, 1 from Sprint S2) and are correctly excluded by the audit-label heuristic. Zero responses reach the aggregator. Readiness verdict on this engagement therefore evaluates to **not ready** because:

- 0 of 6 required roles have ready responses
- 0 of 14 minimum ready responses

The gate blocks the Generate button. To proceed, an operator would supply an override reason — at which point the synthesis would run against an empty `EvidenceBundle.byLane` and the AI would either refuse (insufficient context) or produce assumption-only findings.

### 6.2 Smoke test of lane bucketing (`artifacts/s4-evidence-smoke.mjs`)

Pure-logic test with a 11-row synthetic sample (7 S1 audit + 2 S2 audit + 2 hypothetical real responses) confirms:

| Metric | Expected | Observed |
|---|---|---|
| Rows excluded by status (draft) | 1 | 1 ✅ |
| Rows excluded by audit label | 8 | 8 ✅ |
| Reaching aggregator | 2 | 2 ✅ |
| live_link bucket | 1 | 1 ✅ |
| transcript bucket | 1 | 1 ✅ |
| offline_operator bucket | 0 | 0 ✅ |
| Roles covered | 2 (sales, executive) | 2 ✅ |
| Readiness would block | true | true ✅ |

### 6.3 Live AI call

**NOT performed in this sprint.** Rationale:

- The SLATE Pilot Test Client fixture has only audit-labelled responses (correctly excluded).
- Synthesizing against zero evidence would either be a no-op or produce only assumption findings — neither outcome is informative.
- Running synthesis against fresh non-audit data would require mutating a real client engagement, which the sprint task spec forbids unless explicitly authorized.

A future operator-side step that DOES exercise the AI path:
1. Stage at least 14 non-audit-labelled responses across ≥3 required roles on the SLATE Pilot Test Client fixture, OR
2. Use the operator-override path with a clearly-labelled reason (`"S4 walkthrough — AI call against audit-fixture only; outputs are throwaway"`) to force synthesis on the 0-evidence bundle and verify the AI path returns either a no-context error or assumption-only findings.

Either path is appropriate for a follow-on operator walkthrough; neither is required for S4 source acceptance.

### 6.4 OpenAI provider configuration

- `OPENAI_API_KEY` present in `.env.local` ✅
- `isAiConfigured()` returns `true` server-side ✅
- Synthesis path would call the provider if the gate cleared

---

## 7. Activity metadata safety

| Field | In metadata? | Notes |
|---|---|---|
| `answer_text` (raw) | ❌ never | Only sanitized counts surface |
| `stakeholder_email` | ❌ never | Never read by aggregator |
| `stakeholder_name` | ❌ never | Aggregator reads it for the prompt but does not log it |
| `entered_by` / `created_by` user UUIDs | ❌ never | Excluded from bundle and metadata |
| `attio_company_id` | ❌ never | CRM summary fields surfaced only as semantic labels (brand, lead source) |
| `operator_notes` (raw) | ❌ never | Used for test-label exclusion only |
| `evidenceLanes` (counts) | ✅ | New S4 field with `{liveLink, transcript, offlineOperator, crmLinked}` |
| `overrideApplied` (boolean) | ✅ | New S4 field |
| `overrideReason` (operator-typed string) | ✅ when override fires | Length-capped to 500; operator input contract requires no PII |
| `provider` + `model` | ✅ | Unchanged from pre-S4 |
| `generatedCount` + `skippedDuplicateCount` | ✅ | Unchanged |

---

## 8. Boundary confirmation

| Boundary | Result |
|---|---|
| No `/r` or `/p` mint | ✅ none |
| No Send to Client | ✅ none |
| No public SOW route | ✅ unchanged — `/s` + `/sow` still 404 by guarantee |
| No SOW share tokens | ✅ |
| No email send | ✅ no email-related imports anywhere in S4 surface |
| No CRM writeback | ✅ S4 reads CRM via `getCrmContextForEngagement` only; never writes |
| No Attio writes | ✅ |
| No new CRM connector | ✅ |
| No e-signature | ✅ |
| No opportunity scoring | ✅ Sprint S6 scope |
| No roadmap generation | ✅ Sprint S7 scope |
| No report section generation | ✅ Sprint S8 scope |
| No proposal generation | ✅ Sprint S9 scope |
| No `docs/39` sequence change | ✅ S5 still follows S4 |
| No Group-B claims | ✅ |
| Sapient Digital mutation | ✅ none |
| New package dependencies | ✅ zero |
| New public routes | ✅ zero |
| Findings remain `review_status='needs_review'` (draft) | ✅ unchanged pre-S4 behavior preserved; never auto-approved |

---

## 9. Limitations

| Item | Routing per `docs/39` § 11 |
|---|---|
| L-1: Live AI call against real-engagement evidence not exercised in S4 | NOT a blocker — operator-side follow-on step; the AI path is source-clean + build-clean. Reconsider as a tiny operator walkthrough when real intake responses land on any engagement. |
| L-2: Audit-label heuristic is prefix-based and conservative | Improvement → Backlog. Operator can override by re-saving without the prefix. A future polish sprint could add an explicit `is_audit_fixture` boolean column if false-positive exclusions become a real problem (they won't unless an operator types `S1 AUDIT` into a real response by accident). |
| L-3: CRM context is engagement-level only; no per-stakeholder Attio Person → SLATE stakeholder cross-link | By design per `docs/42` § 9.2 — `attio_person_id` is deferred. Revisit when operator wants per-stakeholder enrichment. |
| L-4: Override reason is operator-typed text without a PII-detector | Improvement → Backlog. Same posture as Sprint I3's inline PII-warning; could share a helper later. |
| L-5: Bundle is bounded at 200 evidence items | Configurable per call; default chosen to keep prompt within token budget. Revisit if real engagements exceed it. |
| L-6: Readiness gate's `documentsClearedOrAcknowledged` is shim-set to `true` because S4 does not load documents | Per task spec; document gating lands in Sprint S11. The shim does NOT make the gate more permissive in any other way — role coverage and total-ready count still apply. |
| L-7: System prompt change has not been verified against a live model response | Same posture as L-1; will be visible the first time the AI path runs against real evidence. |

---

## 10. Files modified

| File | Change |
|---|---|
| `lib/findings/evidence.ts` | **new** — EvidenceBundle aggregator (~450 lines) |
| `lib/ai/findings-context.ts` | adds `evidenceBundle` to context shape + invokes the aggregator |
| `lib/ai/findings-synthesis.ts` | extends `SYSTEM_PROMPT` with lane hierarchy + tightens strength rule; serializes the bundle into the user payload |
| `lib/findings/synthesis-actions.ts` | enforces the readiness gate; accepts `overrideReason`; new error codes `intake-readiness-not-met` + `override-reason-invalid`; sanitized lane-count metadata in activity event |
| `app/app/engagements/[id]/findings/page.tsx` | fetches the EvidenceBundle and passes summary to the form |
| `components/findings/generate-findings-form.tsx` | renders evidence panel, gate-blocker reasons, operator override input; new translateError cases |
| `docs/43_AI_FINDINGS_SYNTHESIS_INTEGRATION.md` | **new** — this file |
| `docs/39_CONSULTING_MODULE_COMPLETION_ROADMAP.md` | S4 row updated with landing notes |
| `docs/35_SAPIENT_DIGITAL_ENGAGEMENT_READINESS_PLAN.md` | alignment note: S4's audit-label exclusion preserves the readiness gate's "no test data" intent |
| `docs/08_CURRENT_STATUS.md` | Sprint S4 block added at top |
| `docs/10_SESSION_HANDOFF.md` | Latest paragraph replaced with S4 outcome + next-planned pointer to S5 |

Throwaway artifact `artifacts/s4-evidence-smoke.mjs` lives in gitignored `artifacts/`.

---

## 11. Verification

- `npm run lint` → ✅ clean (after a single `'` → `&apos;` escape fix in JSX copy)
- `NEXT_TELEMETRY_DISABLED=1 npm run build` → ✅ clean. `/app/engagements/[id]/findings` grew **10.8 kB → 12 kB First Load JS** (+1.2 kB — evidence panel + override input). All other 28 routes byte-identical.
- `npm run check:send-to-client-disclaimers` → ✅ clean.
- Pure-logic smoke (`artifacts/s4-evidence-smoke.mjs`) → ✅ lane bucketing + exclusions all match spec.
- DB SQL audit of SLATE Pilot Test Client → ✅ 8/8 audit-labelled responses correctly excluded.
- OPENAI_API_KEY present in `.env.local` → ✅; `isAiConfigured()` returns true.

---

## 12. Recommended next sprint

**Sprint S5 — Findings Approval Polish** per `docs/39` § 5. Roadmap sequence unchanged.

S5 scope is locked per `docs/39` § 5:
1. Validate the existing approve/reject lifecycle against real S4 synthesis output (when real evidence lands).
2. Surface source provenance on each finding row — show which lane(s) and how many responses contributed.
3. Operator-only quality flags (e.g. "needs validation" when synthesis weight was weak, i.e. tertiary-only evidence).

S4-related items that the operator may want to address before or alongside S5:
- Apply migration 0018 to deployed Supabase (Sprint S3-B prerequisite carries over).
- Apply the new S3-B Attio custom properties (Brand, Lead Source, etc.) in the Saipien Labs workspace.
- Run a live AI synthesis exercise against real non-audit data (operator decides which engagement) to observe S4's lane attribution in practice.

None of these block S5 source work.

---

## 13. Suggested commit message

```
Integrate AI findings synthesis
```

Suggested body covers: evidence aggregator, readiness gate + override, lane-attribution prompt, UI panel, controlled-fixture validation showing the audit-label exclusion working correctly, no AI live-call performed (deferred to operator-side walkthrough), no roadmap reordering.

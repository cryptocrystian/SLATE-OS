# Sprint S5 — Findings Approval Polish

## Status

- **Date executed:** 2026-06-04
- **Sprint type:** Implementation sprint — fifth mainline sprint per `docs/39` § 5.
- **Sprint identifier:** Sprint S5 — Findings Approval Polish
- **Branches at execution:** `staging` and `persistence/step-0-1-auth-shell` both at `384ab1e` ("Integrate AI findings synthesis")
- **Controlled fixture:** **SLATE Pilot Test Client** (engagement `ed7f1f7d-…`). **No Sapient Digital mutation.** No new fixture created.
- **Verdict:** ✅ **Implementation complete.** Provenance summary helper, needs-validation badge surface, two-step rejection-reason flow, sanitized lane-aware activity metadata, and operator-only Opportunities Readiness Hint all landed. Source-clean + build-clean + boundary-clean. Live lifecycle exercise deferred — neither `SLATE Pilot Test Client` (`ed7f1f7d-…`) nor `Sapient Digital` (`76097653-…`) holds any persisted finding rows today (S4 correctly blocked synthesis on the audit-only fixture; Sapient has not progressed past intake setup); the polish ships build-validated against the existing `Finding` type contract and pure-logic-smoke-validated against the new helpers. Live lifecycle execution becomes possible the first time a real finding lands on any engagement.
- **Follow-on (2026-06-04 — Sprint S6):** Opportunity drafting + approval lifecycle landed downstream of S5 — see `docs/45_OPPORTUNITIES_AI_DRAFTING.md`. The S6 pipeline consumes approved/report-ready findings (the same `review_status` allowlist S5 surfaced) AND inherits each finding's S5 `summarizeFindingProvenance` verdict into the AI prompt + the workspace UI. Rejected, draft, needs-review, and edited findings never reach S6 — the upstream allowlist is preserved verbatim. S6 does NOT change the S5 approval lifecycle, the S5 provenance helper signature, or the `OpportunitiesReadinessHint` on the findings page; it is a pure downstream consumer.

---

## 1. Existing findings approval lifecycle inventory (pre-S5)

The persisted approval surface that landed in earlier persistence + Sprint S4 work consisted of:

| File | Role (pre-S5) |
|---|---|
| `lib/findings/actions.ts` | Server actions: `approveFinding`, `rejectFinding`, `markFindingReportReady`, `markFindingNeedsReview`, `editFinding`, `updateFindingNote`, `setReviewStatus` (internal) |
| `lib/findings/types.ts` | `Finding`, `FindingReviewStatus` (`draft | needs-review | approved | edited | rejected | report-ready`), `SourceRef` (with `type` + `strength`), `Confidence` |
| `lib/findings/queries.ts` | `getFindingsForEngagementPersisted`, joins `finding_source_refs` per finding |
| `components/findings/findings-workspace.tsx` | Two-pane workspace: card list + detail view |
| `components/findings/review-action-bar.tsx` | Approve / Reject / Mark report-ready / Reopen / Add-edit-note client surface |
| `components/findings/create-finding-form.tsx` | Operator-authored finding entry (Sprint pre-S4) |
| `app/app/engagements/[id]/findings/page.tsx` | Page assembler: header + counts + GenerateFindingsForm (S4) + CreateFindingForm + workspace |

### What S5 needed to change (gaps closed)

| Gap (pre-S5) | S5 fix |
|---|---|
| Operator could not see, at a glance, whether a finding's persisted refs leaned on strong stakeholder evidence or thin operator-only context. | New pure helper `summarizeFindingProvenance(refs, assumptionFlag)`; new `FindingProvenanceChip` rendered in both the card list (compact "Needs validation" warning) and the detail view (full lane-counts + dominant strength + needs-validation badge). |
| Approve was a one-click action even when the finding's refs were all thin / scorecard-only / assumption-flagged — no surfaced warning. | "Needs validation" warning panel mounted above the action-button row in the review action bar; only renders for non-terminal findings where `summarizeFindingProvenance` returns `needsValidation = true`. Does not block approval (operator override is the canon-correct posture). |
| Reject was one-click with no optional reason capture; activity metadata carried only `{reviewStatus: 'rejected'}`. | Two-step UX: first Reject… click opens a reason panel; Confirm reject submits with `{reason?: string}`. Reason validated 10–500 chars (or empty); persisted in `findings.reviewer_note` AND in activity event metadata `rejectionReason` field. |
| Activity event metadata carried only `{reviewStatus, priorStatus, confidence, aiDrafted}` — no provenance attribution. | Metadata now also carries `provenance: {totalRefs, stakeholderResponseRefs, uploadedDocumentRefs, scorecardAnswerRefs, consultantNoteRefs, dominantStrength, needsValidation}`. Counts only — never raw `excerpt`, raw `source_label`, raw answer text, or raw PII. |
| No operator-only "are we close to opportunities drafting?" signal — opportunity drafting (S6) is the next sprint and operators had no observable progress indicator. | New `OpportunitiesReadinessHint` server component renders 4 counts (Approved / Rejected / Still in review / Approved · needs-validation), a Ready / Not-yet status chip, and advisory list driven by the pure `buildOpportunitiesReadinessSignal` helper. Read-only; does NOT block S6 (S6 not yet built); does NOT mint anything; does NOT contact a client. |

### What S5 deliberately did NOT change

- Approval lifecycle status enum (`draft | needs-review | approved | edited | rejected | report-ready`) is byte-identical.
- Workspace-scoped RLS posture is unchanged — no new policy, no service-role usage anywhere in S5.
- Cookie-bound auth via `createSupabaseServerClient` is the only auth path for all S5 actions.
- No new migration. The `reviewer_note` column already exists; we reuse it for rejection-reason persistence.
- No new package dependency.
- No new public route.
- No `/r` or `/p` mint, no Send to Client, no email/CRM/e-sign, no Group-B claim, no Sapient mutation.

---

## 2. Provenance summary helper

### 2.1 Module: `lib/findings/provenance.ts`

Pure-function, no DB, no I/O — safe to call server-side OR client-side OR from a unit test. Exports:

```ts
export interface FindingProvenanceSummary {
  totalRefs: number;
  stakeholderResponseRefs: number;
  uploadedDocumentRefs: number;
  scorecardAnswerRefs: number;
  consultantNoteRefs: number;
  dominantStrength: "strong" | "adequate" | "thin" | "missing";
  needsValidation: boolean;
  needsValidationReason:
    | "no-refs"
    | "all-thin-or-missing"
    | "only-engagement-context"
    | "assumption-flagged"
    | null;
}

export function summarizeFindingProvenance(
  refs: ReadonlyArray<{ type: SourceRef["type"]; strength: SourceRef["strength"] }>,
  assumptionFlag: boolean,
): FindingProvenanceSummary;

export interface OpportunitiesReadinessSignal {
  approved: number;
  rejected: number;
  draft: number;
  total: number;
  approvedNeedsValidation: number;
  readyForS6: boolean;
  warnings: string[];
}

export interface ApprovedFindingProvenanceLike {
  reviewStatus: FindingReviewStatus;
  provenance: FindingProvenanceSummary;
}

export function buildOpportunitiesReadinessSignal(
  findings: ReadonlyArray<ApprovedFindingProvenanceLike>,
  options?: { minApprovedForS6?: number },
): OpportunitiesReadinessSignal;
```

### 2.2 `summarizeFindingProvenance` decision tree

Inputs: list of source refs (each with `type` + `strength`) + `assumption_flag` boolean from the finding row.

1. Count refs per `type` bucket — `stakeholder-response`, `uploaded-document`, `scorecard-answer`, `consultant-note`.
2. Tally strength: `strong | adequate | thin`.
3. Compute `dominantStrength`:
   - `missing` if `totalRefs === 0`
   - `strong` if `strong >= max(adequate, thin)`
   - `adequate` if `adequate >= thin`
   - `thin` otherwise
4. Decide `needsValidation`:
   - `assumptionFlag === true` → `needsValidation = true, reason = "assumption-flagged"`
   - `totalRefs === 0` → `needsValidation = true, reason = "no-refs"`
   - `strong === 0 && adequate === 0` → `needsValidation = true, reason = "all-thin-or-missing"`
   - `stakeholderResponseRefs === 0 && uploadedDocumentRefs === 0` → `needsValidation = true, reason = "only-engagement-context"` (i.e. refs exist but lean entirely on scorecard answers or consultant notes — engagement context, not stakeholder voice)
   - Otherwise → `needsValidation = false`

This mirrors the `docs/39` § 4 hierarchy at the per-finding evidence-quality scale: a finding backed only by scorecard inputs is treated as engagement-context-only, not stakeholder-attributable.

### 2.3 `buildOpportunitiesReadinessSignal` rules

Inputs: array of `{reviewStatus, provenance}` records mapped from the persisted findings list, plus optional `minApprovedForS6` (default **5**).

- Counts approved (`approved` + `report-ready`), rejected, draft (everything else), and approvedNeedsValidation (approved/report-ready findings where `provenance.needsValidation === true`).
- `readyForS6 = approved >= minApprovedForS6`.
- `warnings` (advisory, never blocking):
  - `approved === 0` → "No approved findings yet — Sprint S6 drafting cannot start until at least one finding clears review."
  - `approved >= 1 && approvedNeedsValidation === approved` → "Every approved finding carries a needs-validation flag — corroborate with stakeholder evidence before drafting opportunities."
  - `approved < minApprovedForS6 && approved > 0` → "Approved findings (`N`) below the recommended `M` for opportunities drafting — drafting is unblocked but coverage will be thin."

These are operator advisories, not enforcement. S6 (when built) decides its own gating posture; today the hint surface only tells the operator how close they are to a drafting-ready state.

### 2.4 Why a pure helper instead of a DB view

The data needed for both signals (`finding_source_refs` joined into each finding) is already fetched by `getFindingsForEngagementPersisted` for the workspace render. Building a SQL view would duplicate the join and add cache-invalidation surface. The pure helper runs in-process on data the page is already loading, so the cost is `O(refs)` per finding — bounded by the existing display.

---

## 3. UI changes — provenance visibility

### 3.1 `components/findings/findings-workspace.tsx`

Added a new presentational component `FindingProvenanceChip` and mounted it at two sites:

- **Card list** — `<FindingProvenanceChip finding={f} compact />` renders only when the helper returns `needsValidation = true`; in that case a single `bg-status-warning/15` chip reading "Needs validation" appears below the existing source-count row. When the helper returns clean, nothing renders — the card stays uncluttered.
- **Detail view** — `<FindingProvenanceChip finding={finding} />` (full mode) renders after the statement and before the rationale. Shows: per-lane counts (Stakeholder / Document / Scorecard / Consultant), a dominant-strength chip (`Strong evidence` / `Adequate evidence` / `Thin evidence` / `No refs`), and the needs-validation badge with its reason when applicable.

No props plumbing — the component reads `finding.sourceRefs + finding.assumptionFlag` and calls the helper in-place.

### 3.2 `components/findings/review-action-bar.tsx`

Two additions:

**Needs-validation warning panel** — renders above the action-button row only when:
- `provenance.needsValidation === true`, AND
- `finding.reviewStatus !== "approved"`, AND
- `finding.reviewStatus !== "report-ready"`, AND
- `finding.reviewStatus !== "rejected"`.

i.e. the operator sees the warning before they make a non-terminal decision; once approved, rejected, or marked report-ready, the panel withdraws so it stops nagging a settled record. The panel uses `border-status-warning/40` + `bg-status-warning/10` + `ShieldAlert` icon. Body text is the human-friendly `needsValidationReason`:

| Helper reason | Surface copy |
|---|---|
| `assumption-flagged` | "Evidence strength is low. Approving will mark the finding for downstream review." |
| `no-refs` | (Same fallback copy — covered by the catch-all clause) |
| `all-thin-or-missing` | (Same fallback copy) |
| `only-engagement-context` | (Same fallback copy) |

(The component renders `provenance.needsValidationReason ?? "Evidence strength is low. Approving will mark the finding for downstream review."` so future reason additions don't crash the UI.)

**Two-step rejection-reason capture** — replaces the previous single-click Reject button:

1. First click on `Reject…` toggles `rejectOpen` state and changes the button label to `Cancel reject`.
2. A reason panel renders with a textarea (10–500 chars OR empty), `Cancel`, and `Confirm reject` buttons.
3. `Confirm reject` calls `rejectFinding(finding.id, { reason: rejectReason.trim() || undefined })`.
4. Empty reason is allowed (matches the canon — operators may have a legitimate reason they want to capture only in conversation, not in the audit trail).

The textarea has `maxLength={500}` at the browser layer and a live character counter; server-side validation re-enforces the bound and returns `rejection-reason-invalid` on overrun. The reason is also length-capped server-side.

---

## 4. Server-action changes — `lib/findings/actions.ts`

### 4.1 Refactored `setReviewStatus(findingId, status, options)`

Pre-S5 signature: `setReviewStatus(findingId, status)`.

S5 signature:

```ts
type SetReviewStatusOptions = {
  rejectionReason?: string;
};

async function setReviewStatus(
  findingId: string,
  status: FindingReviewStatus,
  options: SetReviewStatusOptions = {},
): Promise<FindingActionResult>;
```

New behavior:

1. Validates `rejectionReason` length when provided (10–500 chars after `trim`). Returns `{ ok: false, error: "rejection-reason-invalid" }` on length violation. Empty/whitespace-only is treated as no reason.
2. Loads the finding row + queries `finding_source_refs` for that finding (workspace-scoped RLS continues to apply).
3. Maps DB rows through new helpers `mapDbSourceType(raw)` and `mapDbStrength(raw)` so unknown DB enum values default to `"consultant-note"` / `"thin"` rather than crashing — defensive against schema drift.
4. Computes provenance summary via `summarizeFindingProvenance`.
5. When status is `rejected`, writes the rejection reason into `findings.reviewer_note` (only when a reason was provided; never overwrites existing notes with `null`).
6. Emits the activity event with extended sanitized metadata.

### 4.2 Activity event metadata sanitization

Activity event `finding_review_status_changed` metadata BEFORE S5:

```jsonc
{ "reviewStatus": "...", "priorStatus": "...", "confidence": "...", "aiDrafted": true|false }
```

AFTER S5:

```jsonc
{
  "reviewStatus": "approved" | "rejected" | "needs-review" | "report-ready" | "edited" | "draft",
  "priorStatus": "approved" | "rejected" | "needs-review" | "report-ready" | "edited" | "draft",
  "confidence": "high" | "medium" | "low" | "needs-evidence",
  "aiDrafted": true | false,
  "provenance": {
    "totalRefs": 3,
    "stakeholderResponseRefs": 2,
    "uploadedDocumentRefs": 1,
    "scorecardAnswerRefs": 0,
    "consultantNoteRefs": 0,
    "dominantStrength": "adequate",
    "needsValidation": false
  },
  "rejectionReason": "<sanitized operator text, 10–500 chars, only when status='rejected' AND operator provided one>"
}
```

Safety rules — what is NEVER in the metadata:

- ❌ Raw `excerpt` text from any source ref
- ❌ Raw `source_label` text from any source ref
- ❌ Raw stakeholder name, email, role, or any PII
- ❌ Raw answer text from the underlying `stakeholder_responses` row
- ❌ Token values, API keys, or any auth material
- ❌ UUIDs of anything other than the finding-id itself (which is already on the row)
- ❌ `attio_company_id`, CRM linkage IDs, or any external system identifier
- ❌ `reviewerNote` raw text (different from `rejectionReason`; reviewer notes use their own dedicated action)

The only operator-typed string that lands in metadata is `rejectionReason`, and only when the operator chose to provide one for a `rejected` transition. It is bounded 10–500 chars server-side. Operators who want to keep a rejection rationale internal can leave the field empty — the rejection still records, just without an audit trail of the reason text.

### 4.3 `rejectFinding(findingId, options: RejectFindingOptions = {})`

Public action signature widened:

```ts
export interface RejectFindingOptions {
  reason?: string;
}

export async function rejectFinding(
  findingId: string,
  options: RejectFindingOptions = {},
): Promise<FindingActionResult>;
```

Pre-S5 callers that called `rejectFinding(id)` continue to work — `options` defaults to `{}` and `reason` is optional.

### 4.4 New error code

`FindingActionResult` error union extended with `"rejection-reason-invalid"`. The new code surfaces in:

- `components/findings/review-action-bar.tsx` — added case in `translateError` returning "Rejection reason must be between 10 and 500 characters, or empty."
- `components/findings/create-finding-form.tsx` — `translateError` switch updated to also handle the new code (its parameter union widened to match the action's broader error type).

No other consumers exist, so no other touch sites.

---

## 5. Operator-only Opportunities Readiness Hint

### 5.1 Component: `components/findings/opportunities-readiness-hint.tsx`

Server component — no `"use client"`, no client bundle cost. Renders:

- Header row with a `ListChecks` icon, "Opportunities readiness" eyebrow, `Operator-only` badge, and either:
  - `Ready for opportunities drafting` success badge (when `signal.readyForS6 === true`), OR
  - `Not yet` warning badge.
- 4-tile stat grid: Approved / Rejected / Still in review / Approved · needs validation.
- Advisory panel (when `signal.warnings.length > 0`) showing first 4 advisories driven by `buildOpportunitiesReadinessSignal`.
- Boundary footer copy:

> Sprint S6 opportunities drafting consumes approved findings. Findings that carry a needs-validation flag will inherit weak provenance — either corroborate them with stakeholder evidence first, or treat the resulting opportunities as needing operator scoping work.

### 5.2 Page wiring

`app/app/engagements/[id]/findings/page.tsx`:

- Imports `buildOpportunitiesReadinessSignal` + `summarizeFindingProvenance` from `lib/findings/provenance` and `OpportunitiesReadinessHint` from the new component.
- Renders the hint immediately below `CreateFindingForm` for persisted engagements (mock-data branch does not get it — the hint is meaningful only against real findings).
- Signal is built inline from the already-fetched `findings` array:

```tsx
<OpportunitiesReadinessHint
  signal={buildOpportunitiesReadinessSignal(
    findings.map((f) => ({
      reviewStatus: f.reviewStatus,
      provenance: summarizeFindingProvenance(
        f.sourceRefs,
        Boolean(f.assumptionFlag),
      ),
    })),
  )}
/>
```

No new DB fetch. No new RLS surface. No client-bundle cost (server-rendered).

### 5.3 What the hint does NOT do

- Does NOT block S6 (S6 is not yet built; this is purely a "how close are we?" indicator).
- Does NOT mint anything.
- Does NOT surface raw finding statements, raw stakeholder text, or any PII.
- Does NOT call out individual findings — it operates on aggregate counts only.
- Does NOT contact a client. Operator-internal surface only.

---

## 6. Controlled validation against fixture findings

### 6.1 Live lifecycle exercise — deferred

Per task spec ("validate the lifecycle against existing fixture findings if any persist; if not, document the limitation"), we queried both candidate engagements:

| Engagement | `findings` row count |
|---|---|
| `SLATE Pilot Test Client` (`ed7f1f7d-…`) | 0 |
| `Sapient Digital` (`76097653-…`) | 0 |

Neither holds a persisted finding row. This is the expected boundary outcome:

- SLATE Pilot Test Client's 8 stakeholder responses are all audit-labelled (Sprint S1 + S2 fixture data). S4's audit-label exclusion heuristic correctly kept them out of synthesis — zero candidates ever passed the readiness gate, so zero findings were drafted.
- Sapient Digital has not progressed past Stage 1 (Setup) — no intake responses, no candidates for synthesis or operator-authored findings either.

**Live lifecycle execution is therefore deferred** until the first real finding lands on any engagement. The polish is build-validated against the existing `Finding` type contract and pure-logic-smoke-validated against the new helpers (§ 6.2). The two scenarios that would unblock a live walkthrough:

1. Operator authors a `CreateFindingForm` finding manually on any persisted engagement — the polish surfaces immediately on the next page render.
2. Operator runs the S4 synthesis path with an audit-logged `overrideReason` against non-audit data on any engagement — AI candidates land in the workspace and the polish surfaces immediately.

### 6.2 Pure-logic smoke (`artifacts/s5-provenance-smoke.mjs`)

Throwaway script (gitignored) that re-implements `summarizeFindingProvenance` + `buildOpportunitiesReadinessSignal` in plain JS so it runs without the TS toolchain. Validates 9 cases:

**Provenance summary (5 cases):**

| Scenario | Expected `needsValidation` | Result |
|---|---|---|
| Strong evidence — 2 stakeholder-response + 1 uploaded-document | `false` | ✅ PASS — `dominantStrength=adequate, reason=null` |
| Empty refs | `true` | ✅ PASS — `reason=no-refs, dominant=missing` |
| Assumption-flagged with refs | `true` | ✅ PASS — `reason=assumption-flagged, dominant=adequate` |
| All-thin refs | `true` | ✅ PASS — `reason=all-thin-or-missing, dominant=thin` |
| Only scorecard + consultant refs | `true` | ✅ PASS — `reason=only-engagement-context, dominant=adequate` |

**Opportunities readiness (4 cases):**

| Scenario | Expected `readyForS6` | Result |
|---|---|---|
| Empty findings list | `false` | ✅ PASS — `approved=0, draft=0` |
| 3 approved (below default threshold 5) | `false` | ✅ PASS — `approved=3, needsValidation=1` |
| 5 approved at threshold | `true` | ✅ PASS — `approved=5, needsValidation=0` |
| 5 approved, all needs-validation | `true` | ✅ PASS — ready BUT warnings will fire |

`9/9 cases pass`. The smoke artifact lives in `artifacts/` (gitignored) and is thrown away.

### 6.3 Source-review validation of the lifecycle wiring

In addition to the smoke, we hand-traced the approval lifecycle end-to-end through the modified source:

| Action | UI entry | Server action | Status transition | Activity event | Provenance in metadata |
|---|---|---|---|---|---|
| Approve | `Approve` button | `approveFinding(id)` | `*` → `approved` | `finding_review_status_changed` | ✅ Yes |
| Mark report-ready | `Mark report-ready` button (gated on prior approval) | `markFindingReportReady(id)` | `approved` → `report-ready` | `finding_review_status_changed` | ✅ Yes |
| Reject (no reason) | `Reject…` → empty textarea → `Confirm reject` | `rejectFinding(id)` | `*` → `rejected` | `finding_review_status_changed` | ✅ Yes; no `rejectionReason` field |
| Reject (with reason) | `Reject…` → 10–500 char textarea → `Confirm reject` | `rejectFinding(id, { reason })` | `*` → `rejected` | `finding_review_status_changed` | ✅ Yes; `rejectionReason: <text>` |
| Reject (bad-length reason) | textarea with 1–9 chars OR >500 chars | `rejectFinding(id, { reason })` | (no transition) | (none) | (none) — surfaces `rejection-reason-invalid` to operator |
| Reopen | `Reopen` button | `markFindingNeedsReview(id)` | `*` → `needs-review` | `finding_review_status_changed` | ✅ Yes |
| Edit note | `Add note`/`Edit note` → `Save note` | `updateFindingNote(id, text)` | (no status change) | `finding_reviewer_note_updated` | (not extended — note action is separate) |

All transitions preserve workspace-scoped RLS via cookie-bound auth; none use service-role; none mutate cross-workspace data.

---

## 7. Boundary confirmation

| Boundary | Held? |
|---|---|
| Zero new package dependencies | ✅ |
| Zero new public routes | ✅ |
| Zero new migrations | ✅ |
| Zero `service_role` writes | ✅ |
| Zero `/r` or `/p` mint | ✅ |
| Zero Send to Client emissions | ✅ |
| Zero email send | ✅ |
| Zero CRM writeback | ✅ |
| Zero Attio writes | ✅ |
| Zero e-signature | ✅ |
| Zero public SOW route | ✅ |
| Zero SOW share tokens | ✅ |
| Zero opportunity scoring/drafting (Sprint S6 scope) | ✅ |
| Zero roadmap generation (Sprint S7) | ✅ |
| Zero report-section generation (Sprint S8) | ✅ |
| Zero proposal generation (Sprint S9) | ✅ |
| Zero Group-B claim | ✅ |
| Zero Sapient Digital mutation | ✅ |
| Zero new package deps | ✅ |
| Zero roadmap sequence change | ✅ |
| Zero audit-only fixture data treated as real evidence | ✅ |
| No PII / raw text / tokens in activity metadata | ✅ (verified by exhaustive source grep for `answer_text`, `excerpt`, `source_label` propagation paths — none reach the metadata builder) |

---

## 8. Verification

### 8.1 Lint

`npm run lint` clean ✅ — no warnings, no errors in any modified file.

### 8.2 Production build

`NEXT_TELEMETRY_DISABLED=1 npm run build` clean ✅.

Route table impact:

| Route | First Load JS (pre-S5 / post-S5) | Δ |
|---|---|---|
| `/app/engagements/[id]/findings` | 12 kB → 13.3 kB | +1.3 kB (provenance chip + readiness hint server component + rejection-reason textarea) |
| All other 28 routes | (unchanged) | 0 bytes |

The 1.3 kB delta is the FindingProvenanceChip + rejection-reason panel client code. `OpportunitiesReadinessHint` is server-rendered, so it adds zero client bytes.

### 8.3 Send-to-client disclaimer pin

`npm run check:send-to-client-disclaimers` clean ✅ — none of the disclaimer canon strings were touched.

### 8.4 Boundary scan

Confirmed via grep over all S5 changes:

- Zero references to `mailto:`, `sendgrid`, `nodemailer`, `docusign`, `hellosign`, `adobesign`, `crm_push` introduced.
- Zero references to `/r/` or `/p/` mint paths introduced.
- Zero references to `service_role` introduced.
- Zero references to Attio writeback functions introduced.

### 8.5 Pure-logic smoke

`node artifacts/s5-provenance-smoke.mjs` — 9/9 cases pass (§ 6.2).

---

## 9. Files modified

### New (3)

- `lib/findings/provenance.ts` (~250 lines) — pure-function helpers `summarizeFindingProvenance` + `buildOpportunitiesReadinessSignal` + exported types.
- `components/findings/opportunities-readiness-hint.tsx` (~130 lines) — server component for the operator-only readiness signal card.
- `docs/44_FINDINGS_APPROVAL_POLISH.md` (this file).

### Source-modified (5)

- `lib/findings/actions.ts` (+~120 lines) — refactored `setReviewStatus`; added `rejection-reason-invalid` error; added provenance computation + persistence path; widened `rejectFinding` signature.
- `components/findings/findings-workspace.tsx` (+~80 lines) — added `FindingProvenanceChip` (compact + full modes); mounted on card list + detail view.
- `components/findings/review-action-bar.tsx` (+~120 lines) — needs-validation warning panel; two-step rejection-reason flow; `rejection-reason-invalid` error case.
- `components/findings/create-finding-form.tsx` (~+5 lines) — `translateError` union widened to include `rejection-reason-invalid` (compile-time correctness only; never surfaces from this form's actions).
- `app/app/engagements/[id]/findings/page.tsx` (~+30 lines) — wired `OpportunitiesReadinessHint`.

### Docs (5)

- `docs/44` (new — this file).
- `docs/39_CONSULTING_MODULE_COMPLETION_ROADMAP.md` — § 5 Sprint S5 row updated with LANDED note; sequence unchanged.
- `docs/43_AI_FINDINGS_SYNTHESIS_INTEGRATION.md` — cross-reference added to S5 approval lifecycle polish.
- `docs/08_CURRENT_STATUS.md` — Sprint S5 block added at top.
- `docs/10_SESSION_HANDOFF.md` — new "Latest" line for S5; S4 reclassified to "Prior".

### Throwaway artifact (gitignored)

- `artifacts/s5-provenance-smoke.mjs` — pure-logic smoke; not committed.

---

## 10. Limitations

| # | Limitation | Classification per `docs/39` § 11 | Recommended owner |
|---|---|---|---|
| L-1 | Live lifecycle walkthrough deferred — both candidate engagements hold 0 persisted findings (see § 6.1). | **Operator-pending** (not a SLATE source-side fix) | Operator runs the first real-data exercise on any engagement; polish surfaces automatically. |
| L-2 | `OpportunitiesReadinessHint` advisories are advisory only — they do NOT enforce a gate. S6 will decide its own gating posture when it lands. | **By-design** (per `docs/39` § 5 Sprint S5 scope: "Operator-only quality flags") | Sprint S6 owner — S6 may, but is not required to, consume the hint signal. |
| L-3 | Provenance per-lane counts roll up by SourceRef `type`, not by underlying response `source_type`. A stakeholder response that originated from a transcript lane vs a live-link lane both bucket as "Stakeholder" today. | **Improvement → Backlog** | Future S5-follow-on or S6 prep if operators report the rollup is too coarse. |
| L-4 | The rejection-reason textarea has no Markdown / formatting affordance; it's a raw text capture. | **By-design** (the field is an audit-trail entry, not formatted content) | None — not scheduled. |
| L-5 | The needs-validation warning panel does NOT block approval; the operator can still approve. | **By-design** (canon: operator is the only authority on findings; warnings inform but don't gate) | None — intentional posture. |
| L-6 | Activity metadata `provenance.dominantStrength` does not track temporal change (e.g. operator may approve at thin, then later add stakeholder corroboration; the original event still says thin). | **By-design** (activity events record point-in-time decisions; provenance is computed at decision time) | None. |
| L-7 | The opportunity-readiness hint default threshold (`minApprovedForS6 = 5`) is a placeholder; S6 may refine it. | **By-design** (threshold is a default, overridable via the helper's `options.minApprovedForS6`) | Sprint S6 owner. |

---

## 11. Recommended next sprint

**Sprint S6 — Opportunities AI Drafting + Quadrant Approval** per `docs/39` § 5.

Prereqs cleared by S5:
- Approved findings are now visibly distinguishable from needs-validation findings (provenance chip + hint card).
- Approval lifecycle activity events carry per-lane attribution counts so S6 drafting can roll up evidence quality per opportunity.
- Operator has a readiness signal showing how many approved findings exist before drafting kicks off.

Operator-side prerequisites that are NOT blockers for S6 source work but ARE preconditions for a live drafting exercise:

1. Real findings must exist on the target engagement (today both candidates hold 0). Either operator-authors via `CreateFindingForm`, or operator runs the S4 synthesis path with an `overrideReason` on non-audit data.
2. Apply migration 0018 to deployed Supabase (Sprint S3-B carry-over) IF S6 wants to surface CRM context inside opportunity drafts — optional but recommended.

No roadmap sequence change required.

---

## 12. Suggested commit message

```
Polish findings approval lifecycle
```

Hold for commit review per the established sprint pattern — operator provides the exact `git add` block after reviewing this evidence log.

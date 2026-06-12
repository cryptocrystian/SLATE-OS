# docs/60 — Synthetic ICP Pilot Run: Meridian Field Services

> **Status:** ⏸ **Operator-driven execution PENDING.** This document lands as the canonical operator runbook + per-stage verification protocol + result template for the synthetic ICP pilot. **No deployed-UI execution has been performed in the sprint that creates this doc.** The execution is operator-assisted: the operator drives every authenticated UI action; Claude verifies database state through Supabase MCP (read-only) after each major stage; minting (if reached) flows only through the canonical deployed action layer (never direct token insertion).
>
> **Paired packet:** `docs/59_SYNTHETIC_ICP_PILOT_PACKET.md` — fixture content + synthetic responses + document baseline.
> **Branch / commit:** `staging` / `e71d3ad` — Review pilot readiness.

## 1. Execution model

| Role | Action |
|---|---|
| **Claude** (this sprint) | Author packet (`docs/59`) + runbook (`docs/60`) + verification protocol. Run lint/build/disclaimer check. Commit pre-execution. |
| **Operator** (follow-on session) | Open the deployed staging UI (`slate-os-staging.vercel.app`) authenticated as the canonical operator. Perform every UI action listed in § 4. Surface results back to Claude in chat. |
| **Claude** (follow-on session) | After each major stage, run Supabase MCP read-only queries to verify the resulting DB state. Record results inline in this doc § 5. Compute the pre-delivery audit verdict from the live state. If the audit passes, instruct the operator on the mint flow. |
| **Operator** (mint stage) | Execute the canonical mint server actions via the deployed UI. Surface raw `/r` and `/p` URLs to Claude exactly once. |
| **Claude** (validation stage) | curl-validate the public `/r` and `/p` routes for client-safe render. Record outcome in § 7. Recommend revoke vs. preserve. |

**Strict invariants enforced throughout:**

- No direct token insertion (`report_share_tokens`, `proposal_share_tokens`) at any point.
- No direct insertion of AI synthesis outputs (`findings`, `opportunities`, `roadmap_items`, `report_sections`, `proposal_options`, `proposal_delivery_snapshots`, `report_delivery_snapshots`) at any point.
- All synthesis runs through the canonical deployed server actions.
- All mint runs through the canonical deployed server actions.
- The S11 pre-delivery audit gate fires through `generateShareLinkAction` / `generateProposalShareLinkAction` — never bypassed.
- No Sapient Digital mutation.
- No real-client mutation.
- No Send to Client.
- No email / CRM writeback / Attio writes / e-sign / public SOW route / SOW share link / Group-B public wiring.

## 2. Pre-flight (must complete before Stage 1)

Operator confirms via the deployed UI:

- [ ] Logged in to `slate-os-staging.vercel.app` as the canonical operator (`cdibrell`).
- [ ] Branch head: `e71d3ad` (Review pilot readiness) — current upstream `staging` branch tip.
- [ ] No engagement matching `lower(name) LIKE '%meridian%'` exists. (Claude will verify via MCP.)
- [ ] No account named `Meridian Field Services` exists. (Claude will verify via MCP.)
- [ ] The Sapient Digital engagement (`76097653-fedb-42e5-9ef6-e89a0e97f802`) and the SLATE Pilot Test Client engagement (`ed7f1f7d-b3fa-46c3-9d48-7b211d2c48b4`) are NOT to be touched during this run.

## 3. Audience label (for use at mint stage only)

```
SYNTHETIC ICP PILOT 2026-06-10 MERIDIAN FIELD SERVICES
```

- ✅ Does NOT start with `audit | walkthrough | test | controlled | sample | staging | dev | qa` — passes the C14 audit-only label heuristic.
- ✅ Carries `SYNTHETIC` prefix per `docs/59` § 9 labeling protocol.
- ✅ Carries the dated session anchor + company name for audit traceability.

## 4. Operator execution checklist (20 stages — UI-driven)

Each stage names: (a) the deployed UI surface the operator interacts with, (b) the canonical server action that fires, (c) the database table(s) that the action writes, (d) the verification query Claude runs after the operator confirms stage completion.

### Stage 1 — Create synthetic account and engagement

- **UI surface:** `/app/leads/new` OR `/app/engagements/new` (or equivalent operator-driven new-engagement affordance — verify with senior support if first execution).
- **Operator inputs:**
  - Account name: `Meridian Field Services`
  - Engagement name: `SYNTHETIC ICP PILOT — MERIDIAN FIELD SERVICES`
  - Engagement type: `ai_opportunity_sprint`
  - Engagement status: `setup`
  - Linked lead: optional
- **Tables written:** `accounts` (new row), `engagements` (new row), possibly `leads`.
- **Verification (Claude, post-stage):** confirm engagement persists with UUID + correct `engagement_type` + clean `name`. Record the `engagement.id` in § 5.

### Stage 2 — Stage stakeholder personas (4)

- **UI surface:** `/app/engagements/[id]/intake` → `Stage offline stakeholder` affordance per persona.
- **Operator inputs per persona (4 total):**
  - Per `docs/59` § 3, set:
    - `role` to the canonical intake role: `executive`, `operations`, `sales`, `finance`.
    - `stakeholder_name` to `SYNTHETIC — Dana Mitchell (COO)` / `SYNTHETIC — Marcus Lee (Director of Field Operations)` / `SYNTHETIC — Priya Shah (VP of Client Growth)` / `SYNTHETIC — Elena Torres (Controller)`.
    - `source_type` → `operator_entered`.
    - `client_visible` → `false`.
    - `status` → leave at `not_started` until response staging.
- **Canonical action:** `createOfflineStakeholderIntakeSessionAction` (per `lib/intake/offline-actions.ts`).
- **Tables written:** `stakeholder_intake_sessions` (4 new rows).
- **Verification (Claude, post-stage):** count sessions for engagement, confirm 4 distinct canonical roles, confirm `client_visible=false`, confirm naming protocol.

### Stage 3 — Stage synthetic intake responses (40 total — 10 per persona × 4 personas)

- **UI surface:** `/app/engagements/[id]/intake` → for each session, click into the session → `Stage offline response` affordance per question.
- **Operator inputs:** copy verbatim from `docs/59` § 4. Each of 10 universal questions (Q1–Q10) staged per persona. Total: 40 responses.
- **Canonical action:** `createOfflineStakeholderResponseAction` per response, then `markStakeholderResponseReadyForSynthesisAction` per response to flip `response_status` to `ready_for_synthesis`.
- **Tables written:** `stakeholder_responses` (40 new rows).
- **Verification (Claude, post-stage):** confirm 40 responses for engagement, all `response_status='ready_for_synthesis'`, all `client_visible=false`, no raw answer-text in any activity event metadata.

### Stage 4 — Acknowledge synthetic document baseline (5 entries)

- **UI surface:** `/app/engagements/[id]/intake` → document panel → `Acknowledge document` (or upload-by-summary affordance — verify with senior support).
- **Operator inputs per entry (5 total per `docs/59` § 5):**
  - Title format: `SYNTHETIC ICP PILOT — <docname>` (e.g., `SYNTHETIC ICP PILOT — Current Workflow Map Summary`).
  - Source_type → `operator_acknowledgement` (or equivalent canonical type).
  - Summary text per `docs/59` § 5 column 3.
- **Canonical action:** `createEngagementIntakeDocumentAction` (per `lib/intake/offline-actions.ts`) OR equivalent intake-document acknowledgement path.
- **Tables written:** `engagement_intake_documents` OR `input_assets` (whichever the canonical affordance uses for acknowledgement). Both are read by the audit loader for the C3 check.
- **Verification (Claude, post-stage):** confirm ≥ 1 row exists for the engagement in either table satisfying C3 (loader queries `input_assets.count(*)`).

### Stage 5 — Run findings synthesis

- **UI surface:** `/app/engagements/[id]/findings` → `Generate AI findings` button.
- **Operator action:** click button. No override reason needed (readiness gate should clear after Stages 2–4).
- **Canonical action:** `generateDraftFindingsForEngagement` (per `lib/findings/synthesis-actions.ts`).
- **Tables written:** `findings` (multiple draft rows with `ai_drafted=true`, `review_status='needs_review'`), `finding_source_refs`, activity event `ai_findings_generated`.
- **Verification (Claude, post-stage):** count drafted findings, confirm `ai_drafted=true`, confirm provenance refs exist, confirm activity event metadata is sanitized (counts only — no raw text).

### Stage 6 — Approve ≥ 5 findings

- **UI surface:** `/app/engagements/[id]/findings` → per-finding `Approve` button.
- **Operator action:** review each generated finding; approve ≥ 5 (reject the rest if quality is insufficient).
- **Canonical action:** finding `review_status` update via the per-finding action.
- **Tables written:** `findings` (row updates), activity events `finding_approved` / `finding_rejected`.
- **Verification (Claude, post-stage):** confirm ≥ 5 findings with `review_status IN ('approved','report_ready')`, confirm rejection rate within reasonable bounds, confirm activity events safe.

### Stage 7 — Run opportunity drafting

- **UI surface:** `/app/engagements/[id]/opportunities` → `Generate AI opportunities` button.
- **Operator action:** click button. Approved findings are the input.
- **Canonical action:** `generateDraftOpportunitiesForEngagement` (per `lib/opportunities/synthesis-actions.ts`).
- **Tables written:** `opportunities`, `opportunity_finding_links`, activity event `ai_opportunities_generated`.
- **Verification (Claude, post-stage):** count drafted opportunities, confirm `ai_drafted=true`, confirm finding-link rows exist, confirm activity events safe.

### Stage 8 — Select ≥ 3 opportunities

- **UI surface:** `/app/engagements/[id]/opportunities` → per-opportunity `Select` button. ("Selected" ≡ recommended per S6 canon.)
- **Operator action:** mark ≥ 3 opportunities as `status='selected'`; defer the rest.
- **Canonical action:** opportunity `status` update via the per-opportunity action.
- **Tables written:** `opportunities` (row updates), activity events `opportunity_selected` / `opportunity_deferred`.
- **Verification (Claude, post-stage):** confirm ≥ 3 opportunities with `status='selected'`, confirm `recommendedOpportunities ≥ 1` for the audit.

### Stage 9 — Run roadmap drafting

- **UI surface:** `/app/engagements/[id]/roadmap` → `Generate AI roadmap items` button.
- **Operator action:** click button. Selected opportunities are the input.
- **Canonical action:** `generateDraftRoadmapItemsForEngagement` (per `lib/roadmap/synthesis-actions.ts`).
- **Tables written:** `roadmap_items`, activity event `ai_roadmap_items_drafted`.
- **Verification (Claude, post-stage):** count drafted roadmap items, confirm `ai_drafted=true`, confirm `opportunity_id` linkage exists for at least 3 items.

### Stage 10 — Mark ≥ 3 roadmap items `status='ready'`

- **UI surface:** `/app/engagements/[id]/roadmap` → per-item action bar → flip to `ready` AND confirm `opportunity_id` link is present.
- **Operator action:** for each of the items intended for the report, link to source opportunity AND flip status to `ready`.
- **Canonical action:** roadmap-item `status` update + opportunity-link affordance.
- **Tables written:** `roadmap_items` (row updates), activity events `roadmap_item_status_changed`.
- **Verification (Claude, post-stage):** confirm ≥ 3 items with `status='ready' AND opportunity_id IS NOT NULL` (the audit C8 contract).

### Stage 11 — Run report-section drafting

- **UI surface:** `/app/engagements/[id]/report` → `Generate all 12 sections` button (bulk drafter).
- **Operator action:** click button. Approved findings + selected opportunities + ready+linked roadmap items are the input.
- **Canonical action:** `generateAllReportSectionDraftsAction` (per `lib/reports/synthesis-actions.ts`).
- **Tables written:** `report_sections` (12 draft rows including `executive_summary`), activity events `ai_report_section_drafted` (per section) + `ai_report_sections_drafted` (bulk aggregate).
- **Verification (Claude, post-stage):** count drafted sections (should be 12, including `section_type='executive_summary'`); confirm all have `ai_drafted=true`; confirm provenance link tables (`report_section_finding_links`, `_opportunity_links`, `_roadmap_links`) carry rows.

### Stage 12 — Approve required report sections

- **UI surface:** `/app/engagements/[id]/report` → per-section `Approve` button.
- **Operator action:** review each section; approve the canonical required-for-S9 subset at minimum (`executive_summary`, `opportunity_portfolio`, `priority_recommendations`, `roadmap`, `recommended_next_step`) PLUS any additional sections whose quality is acceptable, to reach ≥ 8 of 12.
- **Canonical action:** section `status` update via per-section action.
- **Tables written:** `report_sections` (row updates), activity events `report_section_status_changed`.
- **Verification (Claude, post-stage):** confirm ≥ 8 sections approved INCLUDING `executive_summary`; confirm C9 (≥ 10 drafted) and C10 (≥ 8 approved + ExecSummary) clear.

### Stage 13 — Run proposal-option drafting

- **UI surface:** `/app/engagements/[id]/proposal` → `Generate all 3 proposal options` button (bulk drafter).
- **Operator action:** click button. The 3 canonical option types should be preserved.
- **Canonical action:** `generateAllProposalOptionDraftsAction` (per `lib/proposals/synthesis-actions.ts`).
- **Tables written:** `proposals` (1 row created if not already), `proposal_options` (3 draft rows), `proposal_option_opportunity_links`, `proposal_option_roadmap_links`, activity events `ai_proposal_option_drafted` (×3) + `ai_proposal_options_drafted` (bulk).
- **Verification (Claude, post-stage):** confirm 3 options exist (likely with canonical types: `ai_workflow_system`, `quick_win_build`, `managed_ai_partner`); confirm operator pricing placeholders persisted; confirm provenance links exist.

### Stage 14 — Confirm recommended option

- **UI surface:** `/app/engagements/[id]/proposal` → per-option action bar → `Mark recommended`.
- **Operator action:** mark the `ai_workflow_system` option (or whichever option matches the methodology for Meridian) as `recommended_option_id`.
- **Canonical action:** proposal `recommended_option_id` update.
- **Tables written:** `proposals` (recommended_option_id set).
- **Verification (Claude, post-stage):** confirm `proposals.recommended_option_id` is set to one of the 3 proposal_options.

### Stage 15 — Generate proposal candidate snapshot + commercial guard

- **UI surface:** `/app/engagements/[id]/proposal` → `Generate Proposal Candidate` button.
- **Operator action:** click button.
- **Canonical action:** proposal candidate snapshot creation. The 45-pattern commercial guard fires.
- **Tables written:** `proposal_delivery_snapshots` (new row with `delivery_surface='client_proposal_candidate'`, `approval_state='unreviewed'`, `commercial_guard_result` jsonb containing `passed: true/false`).
- **Verification (Claude, post-stage):** confirm snapshot exists, confirm `guard_passed=true` in the jsonb. If guard FAILS, surface violation codes; operator returns to Stage 13/14 to re-author.

### Stage 16 — Approve proposal snapshot

- **UI surface:** snapshot row action bar → `Approve candidate`.
- **Operator action:** click button.
- **Canonical action:** snapshot `approval_state` → `approved`.
- **Tables written:** `proposal_delivery_snapshots` (row update).
- **Verification (Claude, post-stage):** confirm `approval_state='approved'`, `voided_at IS NULL`, `commercial_guard_result.passed=true`. This satisfies C12 and C15 of the pre-delivery audit.

### Stage 17 — Generate internal SOW Draft

- **UI surface:** Past Proposal Candidates panel → `Generate SOW Draft` button.
- **Operator action:** click button.
- **Canonical action:** `generateSowDraftCandidateAction` (per `lib/proposals/sow-draft-actions.ts`). The 71-pattern SOW commercial guard fires.
- **Tables written:** `proposal_delivery_snapshots` (new row with `delivery_surface='sow_draft_candidate'`, `approval_state='unreviewed'`, `draft_watermark=true`).
- **Verification (Claude, post-stage):** confirm SOW draft snapshot exists, confirm `guard_passed=true`, confirm internal-only (no public route — `/s/<token>` still 404). Operator opens internal SOW Draft preview to verify content quality.

### Stage 18 — Run pre-delivery audit (both surfaces)

- **UI surface:** `/app/engagements/[id]/report` AND `/app/engagements/[id]/proposal` — both pages display the `PreDeliveryAuditCard`.
- **Operator action:** observe the card on each page.
- **Canonical action:** `loadPreDeliveryAudit({surface:"report"|"proposal"})` runs server-side at page render.
- **Tables read:** entire upstream chain (intake / findings / opportunities / roadmap / sections / snapshots / share tokens / `input_assets`).
- **Verification (Claude, post-stage):** run the inlined evaluator against the live state via Supabase MCP and compute the verdict for each surface. Record exact blocking-reason codes (if any) and the audit verdict in § 6.

### Stage 19 — Mint `/r` if and only if report audit PASSES

- **UI surface:** `/app/engagements/[id]/report` → `Generate share link` button.
- **Pre-condition:** Stage 18 report audit verdict = `Audit passed`.
- **Operator inputs:**
  - Audience label: `SYNTHETIC ICP PILOT 2026-06-10 MERIDIAN FIELD SERVICES`
  - Recipient email: leave blank (no real-recipient send intent for synthetic fixture).
- **Canonical action:** `generateShareLinkAction` per `lib/reports/share-token-actions.ts`. The S11 audit fires; on pass, the snapshot eligibility check fires; on pass, a new token row is inserted.
- **Tables written:** `report_share_tokens` (1 new row), activity event `report_share_token_created`.
- **Operator captures the raw `/r/<token>` URL exactly once** (it is displayed in the deployed UI ONE time only) and surfaces it to Claude in chat.
- **Verification (Claude, post-stage):** confirm 1 new active token row exists; confirm activity event metadata is sanitized; record the raw URL in § 7 exactly once.

### Stage 20 — Mint `/p` if and only if proposal audit PASSES

- Same shape as Stage 19, but on the proposal surface.
- **UI surface:** `/app/engagements/[id]/proposal` → `Generate Proposal Review Link` button.
- **Tables written:** `proposal_share_tokens` (1 new row), activity event `proposal_share_token_created`.
- Operator captures the raw `/p/<token>` URL once. Claude records in § 7.

### Stage 21 — Validate public render

- **Claude action:** curl-validate the raw `/r/<token>` and `/p/<token>` URLs for:
  - HTTP 200 OK status (token is active and matches)
  - Generic-unavailable behavior for a malformed-token sibling URL
  - Token expiry / revoke / access-log preserved (verify via DB read)
- Record outcome in § 7.

### Stage 22 — Revoke decision (post-QA)

- **Claude recommendation, operator decision:** revoke immediately for tight QA hygiene, OR preserve briefly for internal demo as a token QA reference (with a planned revoke date).
- If revoke chosen: operator clicks `Revoke` per token row in the deployed UI.

## 5. Per-stage results (operator-executed walkthrough — TO BE FILLED)

> The table below is a template. Each row gets filled when the operator surfaces the stage outcome to Claude in the follow-on session. Until then, every row is `PENDING`.

| Stage | Status | Observed value | Verification query result | Notes |
|---|---|---|---|---|
| Pre-flight | PENDING | — | — | — |
| 1. Account + engagement | PENDING | `engagement.id` = TBD | — | — |
| 2. Stakeholder personas | PENDING | 4 sessions expected | — | — |
| 3. Intake responses | PENDING | 40 responses expected (10 × 4 personas) | — | — |
| 4. Document acknowledgements | PENDING | 5 expected | — | — |
| 5. Findings synthesis | PENDING | drafted count TBD | — | — |
| 6. Findings approval | PENDING | approved ≥ 5 | — | — |
| 7. Opportunities synthesis | PENDING | drafted count TBD | — | — |
| 8. Opportunities selection | PENDING | selected ≥ 3 | — | — |
| 9. Roadmap synthesis | PENDING | drafted count TBD | — | — |
| 10. Roadmap ready + linked | PENDING | ready+linked ≥ 3 | — | — |
| 11. Report-section synthesis | PENDING | 12 drafted expected | — | — |
| 12. Report-section approval | PENDING | ≥ 8 approved incl. ExecSummary | — | — |
| 13. Proposal-option synthesis | PENDING | 3 options expected | — | — |
| 14. Recommended option | PENDING | recommended_option_id set | — | — |
| 15. Proposal snapshot + guard | PENDING | guard_passed = true | — | — |
| 16. Snapshot approval | PENDING | approval_state = approved | — | — |
| 17. SOW Draft | PENDING | guard_passed = true | — | — |
| 18. Pre-delivery audit | PENDING | verdict TBD | — | — |
| 19. /r mint (gated on Stage 18) | PENDING | token count TBD | — | — |
| 20. /p mint (gated on Stage 18) | PENDING | token count TBD | — | — |
| 21. Public render validation | PENDING | curl HTTP TBD | — | — |
| 22. Revoke decision | PENDING | revoke | preserve | — | — |

## 6. Pre-delivery audit result (Stage 18 — TO BE FILLED)

| Surface | Result | Blocking codes | Warning codes | Counts snapshot |
|---|---|---|---|---|
| Report (`/r`) | PENDING | — | — | — |
| Proposal (`/p`) | PENDING | — | — | — |

## 7. /r and /p mint result (Stages 19, 20, 21 — TO BE FILLED)

| Surface | Minted | Token ID | Raw URL (surfaced exactly once) | Public render curl status | Recommendation |
|---|---|---|---|---|---|
| Report (`/r`) | PENDING | — | — | — | — |
| Proposal (`/p`) | PENDING | — | — | — | — |

## 8. Output quality assessment (to be filled after Stages 5–17 complete)

For each generated artifact class, score on the criteria from the user spec:

| Artifact class | Professional tone | Grounded in synthetic evidence | Methodology aligned | Clear / actionable | No overclaiming | No legal/sig/payment leakage | Notes |
|---|---|---|---|---|---|---|---|
| Findings | PENDING | — | — | — | — | — | — |
| Opportunities | PENDING | — | — | — | — | — | — |
| Roadmap | PENDING | — | — | — | — | — | — |
| Report sections | PENDING | — | — | — | — | — | — |
| Proposal options | PENDING | — | — | — | — | — | — |
| SOW Draft | PENDING | — | — | — | — | — | — |
| Public `/r` render | PENDING | — | — | — | — | — | — |
| Public `/p` render | PENDING | — | — | — | — | — | — |

Classify any issues per the user spec:

- True blocker
- QA caution
- Backlog polish
- Not an issue

## 9. Boundary confirmation (this sprint — pre-execution)

| Rule | Status this sprint |
|---|---|
| No Sapient mutation | ✅ — Sapient Digital state untouched; no MCP writes against `76097653-…` |
| No real client mutation | ✅ — no writes against any engagement in this sprint |
| No direct token insertion | ✅ — no MCP writes against `report_share_tokens` / `proposal_share_tokens` |
| No bypass of S11 pre-delivery audit | ✅ — audit will fire through the canonical mint action when the operator executes Stage 19/20 |
| No Send to Client | ✅ |
| No email | ✅ |
| No CRM writeback / Attio writes | ✅ |
| No e-signature | ✅ |
| No public SOW route / SOW share link / `/s` route | ✅ — `/s/test` still 404 |
| No Group-B public wiring | ✅ |
| No `docs/39` sequence change | ✅ — operator-assisted run note added; sequence unchanged |
| No real-client claim / testimonial / case study | ✅ — synthetic fixture clearly labeled throughout `docs/59` and `docs/60` |
| No package dependency change | ✅ |
| No migration | ✅ |

## 10. Recommendation (TO BE FILLED after operator execution)

One of:

- **Ready for real pilot** — synthetic ICP fixture passed end-to-end with acceptable output quality; recommended next step is to invite a real ICP-fit first pilot client per `docs/58` § 10.1.
- **Ready after small output-quality fix** — synthetic ICP fixture exposes a specific, bounded output-quality concern that warrants one targeted source sprint before a real pilot. Specify the concern.
- **Not ready** — synthetic ICP fixture exposes a more material concern requiring rework. Specify the concern.

Until operator execution completes, recommendation remains **PENDING**.

## 11. What this doc IS / is NOT

**This doc IS:**
- The canonical operator runbook for the synthetic Meridian Field Services walkthrough.
- The per-stage verification protocol Claude will run against deployed Supabase.
- The result template the follow-on session fills in.

**This doc is NOT:**
- A record of executed UI actions. Until the operator executes Stages 1–22 via the deployed UI, every result row stays `PENDING`.
- A claim that Meridian Field Services is a real client.
- A bypass of any canonical guardrail.
- Authorization to Send to Client, email, push to CRM, or invoke any non-canonical mutation path.

## 12. Suggested commit message (this sprint — pre-execution)

```
Run synthetic ICP pilot fixture
```

(Body: the docs + runbook + verification protocol land; operator-driven UI execution follows in a subsequent session.)

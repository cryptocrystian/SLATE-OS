# Sapient Digital — Engagement Readiness Plan

## Status

- **Date authored:** 2026-05-22
- **Branch at authoring:** `staging` / `persistence/step-0-1-auth-shell` (both at `65af169`)
- **Sprint type:** Planning / readiness audit — **no client delivery, no mint, no send, no mark-sent, no schema/package changes**
- **Reason for this plan:** First-client billable pilot attempted on 2026-05-22 hit the audit stop condition. The Sapient Digital engagement is at Stage 1 of 6 with no real Sprint content — minting a `/r` or `/p` link against the existing 0-of-12-approved report would either trip the canon-correct draft-watermark gate OR (if forced past the gate) hand the client a thin 1-section "deliverable" inappropriate for a paid first pilot. This plan maps the engagement's current state to the canonical six-stage AI Opportunity Sprint workflow, identifies every gap + blocker, splits the remaining work between Claude-executable and operator-manual steps, and defines an explicit minimum content quality gate that must pass BEFORE any `/r` or `/p` share link may be minted for this real client.

This doc is read-only planning. Claude executed no mutations during inspection.

## Target

| Field | Value |
|---|---|
| Company | Sapient Digital |
| Lead UUID | `fee3895a-7943-48d1-8a28-df98eafb74f2` |
| Engagement UUID | `76097653-fedb-42e5-9ef6-e89a0e97f802` |
| Account owner (in SLATE) | `CDIBRELL` |
| Lead status | Diagnostic Requested · Unverified · Internal Fit 54 |
| Source scorecard | AI Readiness 55 / Workflow Friction 95 / Systems 47 |
| Primary contact (from lead) | Alicia Dibrell, CEO |
| Headcount band | 51–200 |
| Industry | professional-services |
| Engagement type | AI Opportunity Sprint |
| Current sprint stage | **Stage 1 of 6 — Setup** |
| Current milestone in SLATE UI | "Confirm stakeholder list and send role-based intake" |

---

## 1. Current engagement snapshot (read-only inspection, 2026-05-22)

| Surface | Source-of-truth count | What's present | What's missing |
|---|---|---|---|
| **Stage 1 — Setup** | engagement row + lead linkage | Engagement created, owner assigned, linked to source lead + scorecard submission | Stakeholder list not yet confirmed for this client |
| **Stage 2 — Intake** | `INVITED 0 · COMPLETED 0 · IN PROGRESS 0 · MISSING ROLES 6 · INPUTS RECEIVED 0` | Six required role buckets visible in UI (Executive · Owner, Operations Leader, Sales Leader, IT · Technical Contact, Finance · Admin, plus one additional role — UI shows `MISSING ROLES 6`) | Every role uncovered. No stakeholder identities, no invite tokens, no responses, no documents |
| **Stage 3 — Findings** | `Findings 0 · Needs Review 0 · Approved 0 · Rejected 0` | "AI Synthesis · Findings Draft" surface ready (`Generate draft findings` button exists; consumes scorecard context + stakeholder intake responses + document metadata) | Zero findings. UI empty state literally says *"NO FINDINGS YET — Add a manual finding from stakeholder intake evidence above, or wait for AI-assisted synthesis in a later sprint"* |
| **Stage 4 — Opportunities** | `Opportunities 0 · Quick Wins 0` | Opportunity matrix surface ready; quadrant placement logic in place | Zero opportunities. UI empty state: *"NO OPPORTUNITIES YET — Create opportunities from approved or report-ready findings using the form above. Quadrant placement is derived from impact + complexity + risk on save."* |
| **Stage 5 — Roadmap** | `Roadmap Items 3 · Quick Wins 2 · Strategic Builds 1 · Dependencies 3 · First 30 Days 2 · Report-Ready Inputs 0` | **3 roadmap items already exist** — but `REPORT-READY INPUTS 0` confirms none are linked to opportunities (because no opportunities exist). These appear to be leftover seed/audit data from prior Phase 1B sprint cycles, **not** real Sapient Digital scope items. AI roadmap draft surface ready (`Generate AI roadmap draft`). | Items linked to real opportunities; operator confirmation of whether the existing 3 unlinked items are keepable or should be cleared |
| **Stage 6 — Report (sections + exhibits)** | `SECTIONS 12 · APPROVED 0 · NEEDS REVIEW 1 · DRAFTED 0 · EVIDENCE LINKS 0 · EXHIBITS 1` | 12 canonical section scaffolds in place (Executive Summary, Capability Maturity Heatmap, Stakeholder Coverage Matrix, Risk-Adjusted Priority Quadrant, Roadmap Gantt with Dependencies, 30/60/90 sequencing, "Confirm stakeholder list and kick off", Linked context, …). 1 section in needs-review status from prior audit. 4 historical PDF candidates exist — all draft-watermarked (`Share disabled · Snapshot is the draft / Needs Review variant`). | 11 empty sections; 0 drafted; 0 approved. No non-draft snapshot exists. |
| **Stage 6 — Report share tokens** | `SHARE LINKS 10 total · 5 active` | 10 historical share tokens from prior Phase 1B sprint cycles (canonical test fixture usage in docs/30, /31, /32, /33, /34) | **5 active stale tokens** that were never revoked — a data-hygiene blocker before real-client exposure (Finding S-1 below) |
| **Stage 6 — Proposal (3 SOW options)** | `OPTIONS 3 · RECOMMENDED 1` | Three canonical SOW option scaffolds in place (Quick-Win Build, AI Workflow System recommended, Managed AI Partner). 7 historical proposal candidates from prior audit cycles; latest is `Voided · SOW Draft candidate · Approval revoked` (audit leftover) | Fresh approved candidate derived from REAL Sapient Digital scope (not the prior audit's synthetic data) |
| **Stage 6 — Proposal share tokens** | `PROPOSAL REVIEW LINKS 1 total · None active` | 1 historical proposal share token, already revoked | (none; this side is clean) |
| **Stage 6 — Past SOW Drafts** | `0 drafts` (after `docs/34` post-pilot cleanup) | Past SOW Drafts panel ready | (none; SOW is internal-only and remains gated until commercial approval) |

---

## 2. Stage-by-stage gap analysis

### Stage 1 — Setup (mostly complete)

- ✅ Engagement created, owned by CDIBRELL, linked to lead `fee3895a-…` and source scorecard
- ⏸ **Gap:** Operator hasn't confirmed the stakeholder list yet (the UI's listed next milestone)
- 🟡 **Operator input required:** identities + emails + roles for the six stakeholder slots (Executive · Owner, Operations Leader, Sales Leader, IT · Technical Contact, Finance · Admin, + one additional — confirm exact slot)

### Stage 2 — Intake (not started)

- ⏸ **Gap:** Zero invited, zero completed, zero in-progress
- ⏸ **Gap:** Zero documents uploaded (the AI synthesis surface notes "Uploaded files are not parsed yet — only their titles, types, and summaries reach synthesis" — so even partial document metadata would help)
- 🟡 **Operator input required:** Decide whether Sapient Digital stakeholder intake is collected
  - **Path A:** Through SLATE — operator confirms list, SLATE sends role-based intake invites with per-stakeholder one-time tokens, stakeholders respond, responses persist as `stakeholder_intake_sessions`
  - **Path B:** Offline (Sapient already provided answers via meeting / email / other channel) — operator stages the responses manually as if each stakeholder had completed in SLATE. SLATE supports this if there's a paste-in path; needs verification (see § 4 / Claude-executable list)
- ❓ **Blocker check needed:** does SLATE's intake UI support operator-staged responses without an invited stakeholder, or does the intake-token round-trip have to happen? Inspect `/app/engagements/.../intake` UI for a "Mark complete with operator-supplied response" affordance. This determines whether Path B is supported product-side or requires Path A as the only canonical path.

### Stage 3 — Synthesis / Findings (blocked on Stage 2)

- ⏸ **Gap:** Zero findings drafted, approved, or rejected
- ✅ **AI synthesis surface IS ready** — `Generate draft findings` button visible on `/findings` page (canonically uses scorecard context + stakeholder intake responses + document metadata as input)
- 🔒 **Blocker:** AI synthesis canonically requires at least some stakeholder intake responses + scorecard signal (already present) + ideally document metadata. With zero intake responses, AI synthesis will produce only scorecard-derived findings — directionally OK but thin
- 🟡 **Operator input required:** Review every AI-drafted finding before approval; SLATE's canon enforces "Findings are always reviewed by a consultant before they become client-facing" (visible boundary-reminder copy)

### Stage 4 — Opportunities (blocked on Stage 3)

- ⏸ **Gap:** Zero opportunities created or scored
- ✅ **Opportunity matrix surface IS ready** — form + quadrant placement logic in place
- 🔒 **Blocker:** "Create opportunities from approved or report-ready findings using the form above" — UI gates opportunity creation on approved or report-ready findings, so Stage 3 must produce at least 3-5 approved findings before this stage can begin
- 🟡 **Operator input required:** Review proposed opportunities; confirm impact + complexity + risk scoring per item

### Stage 5 — Roadmap (partial seed exists; provenance unclear)

- 🟡 **Gap (data hygiene):** 3 roadmap items already exist (`First 30 Days: 2 · 60-day: 1 · 90-day: 0 · Dependencies: 3`) but **`REPORT-READY INPUTS 0`** confirms none are linked to opportunities (because no opportunities exist for Sapient Digital). These items are likely seed/test data from prior Phase 1B audit cycles, NOT real Sapient Digital scope
- 🟡 **Operator input required:** Decide whether to clear those 3 items + start fresh once opportunities are approved, OR retain them as starting scaffolds + edit them to link to real opportunities
- ✅ **AI roadmap draft surface IS ready** — `Generate AI roadmap draft` button visible; canon copy notes "Appends planned items only. Existing items, their status, and their links are preserved verbatim. All new items require operator review before any client-facing action"

### Stage 6 — Report (12 sections, 0 approved, 1 needs-review)

- ⏸ **Gap:** 0 of 12 sections approved; 11 sections empty; 1 section in needs-review state (from prior audit cycle, content provenance unclear)
- ✅ **AI Synthesis Step 3 (report section drafting) is wired** — `Generate AI draft` button visible per section; canon copy enforces "AI drafts each section; the consultant approves before any section becomes client-facing"
- ✅ Section scaffolds in place: Executive Summary + Capability Maturity Heatmap exhibit slot + Stakeholder Coverage Matrix exhibit slot + Risk-Adjusted Priority Quadrant + Roadmap Gantt with Dependencies + 30/60/90 sequencing + Confirm stakeholder list and kick off + Linked context + 4 others
- 🔒 **Blocker:** Sections need source content (findings → opportunities → roadmap chain) before AI drafting can produce meaningful copy. AI drafting CAN run today on scorecard context alone, but the output would be thin
- 🟡 **Operator input required:** Per-section review + approval (12 × consultant-judgement clicks per snapshot iteration)

### Stage 6 — Report share tokens — **HYGIENE ISSUE**

- 🟡 **Finding S-1:** 5 active stale share tokens exist on this engagement from prior Phase 1B audit cycles. Per canon, the raw token is only displayed once at mint time + the operator copies it. So the 5 stale tokens are NOT discoverable by random third parties — but the operator should still **revoke them before real-client exposure** to remove the audit-trail noise + reduce attack surface (an operator who saved a URL from a prior audit could in principle still visit it)
- ✅ **Claude-executable cleanup:** Same UI / two-step `Revoke` → `Confirm revoke` flow used in `docs/34` post-pilot cleanup. Single batch can revoke all 5 in <30 seconds

### Stage 6 — Proposal (3 SOW options seeded; latest candidate voided)

- ⏸ **Gap:** Most recent proposal candidate is `Voided · SOW Draft candidate · Approval revoked` (from prior audit cycle). No active approved candidate exists
- ✅ **Three SOW option scaffolds in place** (Quick-Win Build, AI Workflow System recommended, Managed AI Partner) — these are the canonical defaults from `lib/proposals/proposal-init.ts`
- ✅ **Proposal Candidate generator + approval flow IS ready** — `Generate Proposal Candidate` button visible; commercial guard runs on every generation
- 🟡 **Operator input required:** Review the seeded option content (likely generic since no Sapient-specific scope is drafted yet) + edit option content to reflect real Sapient Digital scope before approving + generating share links

### Stage 6 — SOW Draft (internal-only, 0 drafts)

- ✅ **Clean state after `docs/34` cleanup** — no current SOW drafts. SOW Commercial Guard works (verified in `docs/34` Lane 5)
- ✅ **Boundary preserved:** SOW remains internal-only; no public SOW share route; no SOW share tokens; SOW Draft requires an approved Proposal Candidate as input

---

## 3. Required operator inputs (the things Claude cannot supply)

These are the inputs the operator MUST provide before this engagement can produce a real client deliverable. Claude cannot invent them.

1. **Stakeholder identities** — at minimum, names + roles + email addresses for the 6 required role slots. Or operator's decision that some roles will be skipped + a rationale
2. **Documents** — any supporting documents the operator wants synthesis to consider (org chart, current process docs, system maps, prior advisory deliverables)
3. **Intake response content** — either real stakeholder responses (via SLATE intake invites) OR operator-collected responses to be staged into the engagement (pending product-side support check)
4. **Finding-by-finding approval signals** — even AI-drafted findings need operator review/edit/approve before being client-facing
5. **Opportunity scoring + selection** — impact / complexity / risk values per opportunity; which opportunities make the recommended set
6. **Roadmap decisions** — which opportunities get 30 / 60 / 90 placement; dependencies between items
7. **Per-section report approval** — 12 × consultant-judgement click events for each generated PDF candidate iteration
8. **Proposal scope decisions** — which of the 3 SOW options is recommended for Sapient; per-option scope summary + best-fit scenario + assumptions + dependencies + pricing-placeholder (NB: pricing stays in placeholder state per canon until commercial approval workflow advances)
9. **Final pre-delivery sign-off** — operator confirms the report + proposal are client-quality before any mint happens
10. **Manual delivery + feedback capture** — operator's own approved channel (email, in-person, etc.) for handing off the `/r` and `/p` URLs + operator capture of client's response after delivery (SLATE never sends email; SLATE never captures client feedback automatically)

---

## 4. Claude-executable tasks (the things Claude CAN run via UI/Chrome MCP)

Given operator-provided inputs above, these are the UI actions Claude can drive non-destructively. **All routes only — no service-role SQL writes, no schema mutations.**

### Stage 1 cleanup
- (none — operator-only)

### Stage 2 — Intake
- Navigate to `/app/engagements/.../intake`
- For each stakeholder identity operator provides: enter name + email + role + invite (if SLATE supports the operator-driven invite flow on this page — needs UI inspection)
- Mark intake invites sent (if a "send" affordance exists; otherwise note as operator-manual)
- ❓ Pending product-side check: is there an "operator-pasted response" path for offline-collected intake responses?

### Stage 3 — Findings
- Click `Generate draft findings` (AI synthesis run)
- Wait for OpenAI synthesis to complete (uses scorecard + intake + document metadata)
- For each AI-drafted finding the operator approves: click the per-finding `Approve` button
- For each finding the operator rejects: click `Reject`

### Stage 4 — Opportunities
- For each opportunity the operator dictates: open the opportunity form, type title + description + impact + complexity + risk values, save
- Verify quadrant placement renders as expected
- Optionally invoke AI suggestion for opportunity drafting (canonical AI Synthesis Step 2)

### Stage 5 — Roadmap
- Decision point: clear the 3 unlinked seed items, OR keep them as starting scaffolds
- For each new roadmap item: open the add-item form, type title + phase (30/60/90) + linked opportunity, save
- Click `Generate AI roadmap draft` to append AI-suggested items (operator reviews before keeping)

### Stage 6 — Report
- Per section: click `Generate AI draft` (AI Synthesis Step 3)
- For each AI-drafted section the operator approves: click `Approve section`
- Once enough sections are approved (per § 5 quality gate): click `Generate PDF Candidate`
- Verify candidate is NOT draft-watermarked
- **PAUSE before minting share link** — fresh re-confirmation from operator required at this point

### Stage 6 — Report share-token cleanup (Finding S-1)
- Revoke each of the 5 stale active share tokens via the two-step `Revoke` → `Confirm revoke` flow (same pattern as `docs/34` cleanup)
- Verify count drops to `SHARE LINKS 10 total · 0 active`

### Stage 6 — Proposal
- Per option, the operator dictates the scope summary + best-fit scenario + assumptions + dependencies → Claude types into per-option editor surfaces (if UI supports it) OR Claude pastes operator-supplied JSON if there's a paste/import path
- Click `Generate Proposal Candidate` to mint a fresh snapshot with the operator-edited option content
- Click `Approve Candidate` after operator review

### Stage 6 — SOW Draft (operator-internal, gated)
- After Proposal Candidate is approved: click `Generate SOW Draft` (canonical pre-mint commercial guard runs)
- Navigate to internal SOW Draft route to verify Draft SOW · not executed canon-chrome renders
- **DO NOT** share externally; SOW is internal-only

### Pre-delivery (gate has to pass first — § 5)
- Mint `/r` link with audience `FIRST CLIENT PILOT 2026-05-22 SAPIENT DIGITAL` (or revised date if pilot ships on a later day)
- Surface raw URL to operator ONCE
- Mint `/p` link with same audience pattern
- Surface raw URL to operator ONCE
- PAUSE — operator hand-delivers via own approved channel
- After operator confirms delivery: drive per-token `Mark sent to client` modal (3-ack gate, channel `operator_mediated_copy_link`, no SLATE email send)

---

## 5. Minimum content quality gate — must pass BEFORE `/r` or `/p` may be minted for Sapient Digital

**Sprint S1 alignment note (2026-06-02):** The intake portion of this gate (rows 1-2 below) has been formally aligned with the canonical input hierarchy in `docs/39` § 4 — primary online intake, secondary transcripts + CRM, tertiary offline operator entry. The aligned wording lives in `docs/40` § 6. The thresholds below are unchanged; the change is that "completed" now means "at least one `response_status='ready_for_synthesis'` row across any lane (live-link, transcript, or offline)". Per-lane signal weighting at synthesis time (Sprint S4) follows `docs/39` § 4.5; the GATE itself looks at cumulative coverage only. Code-side enforcement of the gate lands in **Sprint S11** per the locked roadmap; until then this remains operator discipline. A non-enforcing pure-function helper at `lib/engagement-readiness/intake-readiness.ts` (landed in Sprint S1) is the contract S11 will wire.

**Sprint S4 alignment note (2026-06-02):** Sprint S4 wired the same S1 helper into the AI findings synthesis action — `generateDraftFindingsForEngagement` now blocks synthesis when `readiness.ready === false` unless the operator supplies an audit-logged override reason. S4 also adds an audit-label exclusion heuristic to the evidence aggregator (`lib/findings/evidence.ts`) so prefix-tagged walkthrough rows (`I3 WALKTHROUGH TEST`, `S1 AUDIT`, `S2 AUDIT FIXTURE`) cannot accidentally be consumed by synthesis even when the gate clears. This preserves the readiness gate's original intent — that synthesis never consume test-only / non-client-quality evidence — at the code layer alongside the operator-discipline layer that has held since this doc landed. Full evidence: `docs/43_AI_FINDINGS_SYNTHESIS_INTEGRATION.md`.

**Sprint S12-Fix note (2026-06-09):** The document-count loader path (row 3 of the table below — `Documents — uploaded`) is now read accurately from the deployed `input_assets` schema. Pre-S12-Fix, `lib/engagement-readiness/pre-delivery-audit-loader.ts` filtered `input_assets` with `.is("deleted_at", null)` against a column that does not exist; PostgREST errored, the count fell back to 0, and C3 always blocked unless `documentsClearedOrAcknowledged === true`. S12-Fix drops the spurious clause; the gate now distinguishes "no documents uploaded" (real-value block) from "transient query failure" (conservative fallback block) cleanly. The canon wording of row 3 ("≥ 1 supporting document OR operator's explicit 'no documents needed' sign-off") is unchanged. Full evidence: `docs/57_S12_FIX_DOCUMENT_COUNT_GATE.md`.

**Sprint S12 first-mint result (2026-06-09):** Sprint S12 attempted the first canonical Sapient Digital `/r` + `/p` mint through the S11 audit gate. Both surfaces were **refused by the gate** — `/r` blocked on 10 reason codes (intake_required_roles_missing, intake_substantive_responses_missing, documents_not_uploaded_or_acked, findings_drafted_too_few, findings_approved_too_few, opportunities_created_too_few, opportunities_recommended_missing, roadmap_items_linked_too_few, report_sections_drafted_too_few, report_sections_approved_too_few); `/p` blocked on the same 8 cross-surface codes (proposal-only C12 + C15 happened to clear thanks to legacy pre-S1 approved snapshots, but the cross-surface chain failed). No token created, no delivery snapshot created, no public link minted, no Sapient mutation. The audit system worked exactly as designed. Full evidence: `docs/56_SAPIENT_DIGITAL_CONTROLLED_MINT.md`. The current-state column of the table below should be re-read with the S12 verification counts as authoritative.

**Sprint S11 alignment note (2026-06-09):** This § 5 quality gate is now **code-side enforced** at the `/r` and `/p` mint surface. The centralized server-side evaluator `evaluatePreDeliveryAudit` (`lib/engagement-readiness/pre-delivery-audit.ts`) runs ahead of every share-token mint and refuses the action — before any token / snapshot side-effect — when the upstream chain is incomplete. The evaluator is surface-aware: `/r` mint applies the cross-surface subset + report-only conditions (sections drafted ≥ 10, sections approved ≥ 8 including Executive Summary, fresh non-voided report snapshot); `/p` mint applies the cross-surface subset + proposal-only conditions (approved proposal snapshot, commercial guard `passed === true`). Audience-label discipline (row 16 of this table) is enforced via prefix-pattern matching against `audit|walkthrough|test|controlled|sample|staging|dev|qa`. The mint UI also surfaces a `PreDeliveryAuditCard` near the mint controls so operators can see the gate state and blocking reasons without attempting a mint. SOW Draft (internal-only per `docs/28`) is **not** in scope of this evaluator — its own 15-condition gate (`lib/proposals/sow-draft-eligibility.ts`, `docs/54`) is unchanged. Full evidence: `docs/55_PRE_DELIVERY_AUDIT_CODE_ENFORCEMENT.md`.

Per canon plus first-pilot operator judgement, the engagement must satisfy ALL of the following before any client-facing share link is minted:

| Gate item | Minimum threshold | Current state for Sapient Digital | Pass? |
|---|---|---|---|
| Stakeholder intake — invited | ≥ 3 of the 6 required roles | 0 | ❌ |
| Stakeholder intake — completed | ≥ 2 of the invited (with substantive responses) | 0 | ❌ |
| Documents — uploaded | ≥ 1 supporting document OR operator's explicit "no documents needed" sign-off | 0 | ❌ |
| Findings — drafted | ≥ 8 | 0 | ❌ |
| Findings — approved | ≥ 5 of the drafted | 0 | ❌ |
| Opportunities — created | ≥ 3 with proper scoring | 0 | ❌ |
| Opportunities — recommended | ≥ 1 marked as recommended | 0 | ❌ |
| Roadmap — items linked to opportunities | ≥ 3 items; `REPORT-READY INPUTS > 0` | 0 (3 unlinked) | ❌ |
| Report sections — drafted | ≥ 10 of 12 | 0 | ❌ |
| Report sections — approved | ≥ 8 of 12 (with at least Executive Summary + 3 exhibits) | 0 | ❌ |
| Report PDF candidate — fresh, non-draft | exists; `Share disabled` text absent on the target snapshot | none | ❌ |
| Proposal Candidate — fresh + approved | exists; one of the 3 SOW options edited to reflect real Sapient scope | none | ❌ |
| Commercial guard — proposal | `passed` on the target snapshot | n/a (no current snapshot) | ❌ |
| Stale share tokens — revoked | active count = 0 before mint | ~~5 active stale~~ → **0 active** after 2026-05-23 Stage 1-2 sprint cleanup | ✅ (2026-05-23) |
| Operator sign-off | explicit confirmation in chat that the report + proposal are client-quality | not requested yet | ❌ |
| Audience label discipline | every minted token carries `FIRST CLIENT PILOT 2026-05-22 SAPIENT DIGITAL` (or revised date) | n/a | n/a |

**Net:** ~~0~~ → **1 / 15** gate items currently passing (stale-token cleanup landed during the 2026-05-23 Stage 1-2 sprint — see `docs/36`). Engagement is NOT cleared for client-facing share-link mint.

---

## 6. Recommended next sprint — Sapient Digital Stage 1-2 Execution Sprint

Smallest unit of work that meaningfully advances the engagement without skipping the canonical workflow. Stage 1-2 only — stops before any client-facing artifact is touched.

**Update 2026-05-23:** Path B (offline-staged responses) was canonized in `docs/37_SAPIENT_DIGITAL_OFFLINE_INTAKE_CANON.md` (Sprint I1). Implementation lands in Sprints I2 (data model + actions) → I3 (UI) → I4 (documents) → I5 (synthesis integration) → I6 (Sapient Stage 2 execution). Until Sprint I3 lands, the operator may use the `docs/36` § 6 question packet externally as a bridge — collected responses can be backfilled into SLATE once the offline ingest UI exists.

**In scope:**

1. **Operator inputs collected** — full stakeholder list (6 roles: identity + email + title + slot match), any supporting documents, decision on Path A (SLATE-managed intake) vs Path B (offline-staged responses, now canonized in `docs/37`)
2. **Stakeholder list confirmed in SLATE** — Claude navigates `/app/engagements/.../intake`, types per-stakeholder fields from operator-supplied list
3. **Intake invites sent OR responses staged** — depending on operator's Path A vs Path B choice (and the product-side answer about whether Path B is UI-supported)
4. **Documents uploaded** — operator provides files; Claude uploads through the operator-only documents surface (`/intake` → Manage Documents)
5. **Stage 1-2 hygiene** — clear the 3 unlinked seed roadmap items if operator confirms they were leftover audit artifacts; revoke the 5 stale active share tokens (`Finding S-1`)
6. **AI-draft findings ONLY IF intake responses exist** — operator decides whether to run AI synthesis at the end of the Stage 1-2 sprint, or wait until Stage 3 sprint
7. **Doc the sprint outcome** — `docs/36_SAPIENT_DIGITAL_STAGE_1_2_EXECUTION.md` capturing what landed
8. **Update `docs/08` + `docs/10`**

**Strictly out of scope for the Stage 1-2 sprint:**

- ❌ No `/r` or `/p` minting
- ❌ No Mark sent to client
- ❌ No SOW Draft generation (Stage 6 work)
- ❌ No Send to Client even with operator-mediated copy-link
- ❌ No SLATE email send
- ❌ No CRM push
- ❌ No e-signature
- ❌ No public SOW route
- ❌ No SOW share tokens
- ❌ No Group-B client wiring
- ❌ No schema / migration / package changes
- ❌ No service-role SQL writes

**After Stage 1-2 sprint completes,** the recommended order of subsequent sprints is:

- **Stage 3 Execution Sprint** — AI-draft findings, operator approval cycle, document any findings the operator rejects or significantly edits
- **Stage 4 Execution Sprint** — create + score opportunities from approved findings; mark recommendations
- **Stage 5 Execution Sprint** — clear or relink the 3 unlinked roadmap items; sequence approved opportunities into 30/60/90
- **Stage 6A Execution Sprint** — AI-draft report sections, per-section operator approval; generate non-draft PDF candidate
- **Stage 6B Execution Sprint** — edit the 3 SOW option scaffolds to reflect real Sapient scope; generate + approve fresh Proposal Candidate
- **Pre-Delivery Audit Sprint** — re-run § 5 quality gate; verify all items pass; explicit operator sign-off
- **Delivery Sprint** — finally mint `/r` and `/p`, hand off to operator, drive Mark sent after operator confirms manual delivery

---

## 7. Explicit no-send / no-mint boundary until readiness gate passes

**Until § 5 quality gate shows all green for Sapient Digital, SLATE will NOT mint any client-facing share link for this engagement. No `/r/<token>`, no `/p/<token>`, no exception. The token-mint UI may permit it (if a non-draft snapshot exists, the button activates) — but the operator + Claude commit to NOT clicking it until the readiness gate is satisfied + operator gives explicit chat confirmation.**

Boundaries enforced through this plan:

- **No real client delivery during planning or staging sprints** — only the final Delivery Sprint touches the operator-mediated copy-link flow
- **No `/r` or `/p` minting** during any of the Stage 1-5 sprints — only after § 5 gate passes
- **No SOW external sharing** — SOW Draft remains internal-only per canon; no public SOW route exists; no SOW share tokens
- **No SLATE-sent email, no CRM push, no e-signature** — all delivery is operator-mediated copy-link only
- **No service-role SQL writes** — every action goes through the cookie-bound RLS UI/action layer
- **No Group-B client claims** — Group-B exhibits stay preview-only until `docs/14` / `docs/15` data gates advance
- **No schema / migration / package changes** unless a real blocker is found + reported explicitly with a separate sprint authorization

---

## 8. Open product-side questions surfaced during this audit

These are questions for the operator (or for a future product-side sprint, if SLATE itself needs functionality changes):

1. **Stakeholder intake — offline response staging path?** Does the `/intake` page support an operator-pasted-response mode for stakeholders who completed intake outside SLATE (via meeting, email reply, async document)? If not, Path B is operator-manual-only and the staging needs a different surface
2. **Roadmap seed-data provenance** — confirm whether the 3 existing unlinked roadmap items are leftover from prior Phase 1B audit cycles (likely) OR were intentionally seeded for Sapient Digital ahead of the canonical workflow. If audit-leftover: clear them as part of the Stage 1-2 sprint. If intentional: keep them and link to opportunities once those exist
3. **Existing `9bddb244-…` snapshot in needs-review state** — is the 1 needs-review section's content something the operator drafted earlier OR is it placeholder from a prior audit? Decide whether to keep, edit, or reset to empty before Stage 6 work
4. **Existing 5 stale active share tokens** — are any of them currently in use externally (e.g., handed to anyone)? Recommend operator confirm before bulk-revoke. If yes, the holder should be notified before revoke

---

## 9. Files modified by this plan

- `docs/35_SAPIENT_DIGITAL_ENGAGEMENT_READINESS_PLAN.md` (this file — new)
- `docs/08_CURRENT_STATUS.md` (status block updated)
- `docs/10_SESSION_HANDOFF.md` (chronology + next-planned pointer updated)

**Zero source code changes.** Read-only inspection + planning per the sprint prompt.

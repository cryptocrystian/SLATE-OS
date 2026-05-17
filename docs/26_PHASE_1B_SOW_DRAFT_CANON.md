# Phase 1B SOW Draft Canon

## Status

- **Date:** 2026-05-17
- **Branch:** `persistence/step-0-1-auth-shell`
- **Sprint:** P6-A — Phase 1B SOW Draft Canon
- **Type:** Canon / governance document. **No implementation authorized by this sprint.**
- **Proposal Review Link MVP status:** **Accepted with notes** (`docs/25_PROPOSAL_REVIEW_LINK_MVP_ACCEPTANCE_AUDIT.md`).
- **`Prepare SOW Draft`:** remains locked. This canon does not unlock it. Earliest unlock is at the END of Sprint P6-C.
- **`Send to Client`:** remains locked. This canon does not unlock it. Last to unlock per `docs/22` + `docs/24` § Send to Client Unlock Policy; Sprint P8 scope at the earliest.
- **`Prepare Client Review`:** unlocked at the END of Sprint P5 to the operator-mediated `Generate Proposal Review Link` workflow only. **Unchanged by this canon.**
- **`Prepare Report`** + mock-route **`Export Report`:** remain locked verbatim.
- **E-signature** and **CRM / email delivery** remain **out of Phase 1B scope.** They require separate canons before any code lands.
- **Group-B exhibits** (Benchmark Comparison Bars, AI-Savings Waterfall, ROI Bridge) remain **excluded** from every client-bound SOW Draft artifact until `docs/14` and `docs/15` advance to their respective Gate 1 tiers AND a matching wiring sprint is authorized.

## Why This Exists

The Proposal Review Link MVP (Sprint P2 → P5, accepted via `docs/25`) succeeded because the Proposal Candidate artifact is explicitly framed as **commercial discussion material** — every render carries "not a binding quote · not a statement of work · not a contract" copy, the renderer hides any placeholder pricing, and the public route's `noindex,nofollow` + service-role lookup + sanitized snapshot-pure render keep the proposal artifact at the discussion layer.

**SOW Draft is structurally different. It is implementation scope language.** A SOW Draft restates the agreed scope, deliverables, timeline, dependencies, assumptions, risks, and (when authorised) pricing in the structural shape clients have come to expect from formal engagement-execution documents. Even a clearly-marked draft of a SOW carries weight that a "proposal discussion" does not: clients reasonably anticipate that a SOW Draft is the precursor to a signed agreement and that signing it ends the negotiation.

That difference matters because a misframed SOW Draft can:

- **Accidentally form a contract** — most jurisdictions hold that a sufficiently-detailed scope + price + acceptance signal can form a binding agreement even when one party didn't intend that legal effect. "Draft" headings help but are not magic.
- **Create binding-scope confusion** — vague "we will deliver X" framing without "subject to final approval" footer reads as a commitment.
- **Leak final pricing prematurely** — once a price appears on operator-internal SOW chrome that later reaches a client, retracting it is much harder than retracting an unwritten estimate. The `pricing_review_state` boundary from Sprint P2 must stay enforced.
- **Imply guaranteed delivery dates** — "start date X / go-live Y / completion Z" framing without "estimated" + "subject to final approval" sub-notes reads as a guarantee.
- **Create client acceptance / signature confusion** — even visual-only signature placeholders ("Signed by: ____") on a draft can be screenshotted, re-signed, and presented as proof of agreement.
- **Imply e-signature is wired** — any "Sign here" / "Accept" / "Agree" button shape (even rendered as disabled chrome) implies the workflow exists.
- **Leak payment / billing terms** — "Net 30", "due upon receipt", "auto-renewal", "cancellation fee" all imply a formal financial relationship that doesn't exist until signed.
- **Authorize unauthorized change orders** — once a SOW exists, ad-hoc edits read as change-orders rather than negotiation; the boundary needs to be explicit.
- **Leak Group-B financial / benchmark claims** — Benchmark Comparison Bars, AI-Savings Waterfall, and ROI Bridge remain Gate-0 illustrative-only per `docs/14` + `docs/15`. A SOW Draft route that wires Group-B inherits unvalidated claims into the higher-weight SOW artifact surface.

This canon defines the boundary for every one of those risks **before** any SOW Draft code is written. Future Sprint P6-B / P6-C / P6-D agents must consume this doc as source of truth.

## Current State

What is implemented today (no change from the post-`docs/25` state):

- **Proposal Review Link MVP exists and is accepted** (`docs/25`). Operators can generate, approve, void, and mint share links for proposal candidates; clients see sanitized commercial-discussion artifacts via `/p/[token]`.
- **`proposal_delivery_snapshots`** table from migration `0015` already supports `delivery_surface='sow_draft_candidate'` as a valid CHECK value. The Sprint P2 schema was designed to accommodate the SOW Draft surface without a follow-up migration.
- **SOW Draft is not yet implemented.** No `generateSowDraftAction`, no SOW-specific renderer, no internal SOW Draft route, no SOW share table, no SOW share route.
- **`Prepare SOW Draft`** remains locked verbatim. The `<LockedActionButton>` instance at `components/proposals/proposal-workspace.tsx:375` is unchanged.
- **Existing proposal candidates may be approved.** Sprint P3's `approveProposalDeliverySnapshotAction` flow lands `approval_state='approved'` + `draft_watermark=false`; SOW Draft eligibility will key off these.
- **`pricing_review_state`** remains at `placeholder` throughout the current workflow. No operator path advances it to `manually_approved` or `workflow_approved` yet.
- **No pricing approval workflow exists.** The `pricing_review_state` enum is defined in migration `0015` but no UI surfaces a state-transition action.
- **No e-signature workflow exists.** Zero DocuSign / PandaDoc / Adobe Sign / HelloSign integrations.
- **No SLATE-mediated send (email / CRM)** exists for any artifact. All client-facing surfaces require the operator to hand-deliver the URL out of band.

## SOW Draft Artifact Definition

**SOW Draft** = an **internal, operator-generated implementation-scope artifact** based on an approved Proposal Candidate. It is **not** an executed agreement. It is **not** a substitute for legal review. It is **not** a billing or payment authorisation.

### Must include

- **Draft label.** Visible "Draft SOW · not executed" header on every page of the artifact.
- **Non-binding markings.** Footer + section-level notices per § Required Markings / Disclaimers.
- **Selected proposal option(s).** Snapshot of the operator-selected approved Proposal Candidate option(s) — title, scope summary, timeline, deliverables, etc.
- **Scope summary.** Drawn verbatim from the source Proposal Candidate option's `scopeSummary`.
- **Deliverables.** Drawn from the option's `deliverables[]`.
- **Exclusions.** Either drawn from the source option's `assumptions[]` (where assumption-shaped exclusions live today) or surfaced via a new `sowDraftSnapshot.exclusions[]` field captured at SOW Draft generation time.
- **Assumptions.** Drawn from option's `assumptions[]`.
- **Dependencies.** Drawn from option's `dependencies[]`.
- **Proposed timeline.** Drawn from option's `timeline`. Framed as "Proposed" or "Estimated" — never "Guaranteed".
- **Client / operator responsibilities.** A SOW-specific section that does not exist on the Proposal Candidate; captured at SOW Draft generation time via `sowDraftSnapshot.responsibilities`. Default content can be derived from common-engagement boilerplate or left blank for the operator to fill in pre-share.
- **Open commercial questions.** A SOW-specific section listing unresolved scope / pricing / dependency questions the operator needs answered before the SOW can move toward execution. Captured at `sowDraftSnapshot.openQuestions`.
- **Pricing state notice.** Mandatory per § Required Markings / Disclaimers — either "Pricing pending manual review" (placeholder) or "Estimated · subject to final approval" (approved).
- **Approval / signature boundary.** Mandatory body note clarifying that the document is for review and planning only.

### Must not include

- **Final binding quote.** Pricing is hidden by default when `pricing_review_state='placeholder'`; even when approved it is framed as estimated / non-binding.
- **Payment terms** ("Net 30", "due upon receipt", "auto-renewal", "cancellation fee", "late fee", "refund terms"). Out of scope for Phase 1B.
- **Signature blocks** ("Signed by: ____", "Date: ____", "Title: ____"). Visual signature chrome implies e-sign is wired.
- **Acceptance buttons** ("Accept", "Approve", "Agree", "Sign", "I authorize"). The SOW commercial guard rejects this language.
- **Legally binding language** ("binding agreement", "executed agreement", "this SOW is effective", "legally binding"). Same.
- **Automatic start date** ("Work begins on YYYY-MM-DD", "Effective date YYYY-MM-DD" in a binding-effect context). The commercial guard rejects this.
- **Guaranteed delivery date** ("guaranteed delivery", "completion date guaranteed"). Same.
- **E-signature language** ("DocuSign envelope", "sign electronically", "by clicking Accept you agree").
- **Final SLA clauses** (uptime guarantees, response-time guarantees, liquidated damages). SLAs are downstream of execution.
- **Final legal clauses** (governing law, indemnification, limitation of liability, warranty, termination for convenience). Out of Phase 1B scope.
- **Group-B benchmark / financial claims** (Benchmark Comparison Bars / AI-Savings Waterfall / ROI Bridge numbers, peer percentile claims, ROI guarantees, payback dates). Same boundary as `docs/22` + `docs/24`.

## SOW Eligibility Rules

A `proposal_delivery_snapshots` row may be generated as a `sow_draft_candidate` surface **only when** every one of the following holds:

1. **Persisted UUID engagement.** Mock / legacy-slug demo engagements never reach the SOW pipeline.
2. **Proposal exists.** A `proposals` row is bound to the engagement.
3. **Non-voided Proposal Candidate exists** for the proposal — at least one `proposal_delivery_snapshots` row with `delivery_surface='client_proposal_candidate'` and `status != 'voided'`.
4. **Proposal Candidate `approval_state='approved'`.** Sprint P3's Approve flow is the only path to this state; un-approved candidates cannot back a SOW Draft.
5. **Proposal Candidate `commercial_guard_result.passed=true`** at the time it was generated. SOW Draft cannot derive from a guard-failing snapshot.
6. **Proposal Candidate `delivery_surface='client_proposal_candidate'`** — the SOW pipeline cannot derive from `internal_candidate` snapshots and obviously cannot derive from another `sow_draft_candidate` (no SOW-of-SOW).
7. **Proposal Candidate `pricing_review_state` is one of `placeholder` / `manually_approved` / `workflow_approved`.** No additional gate beyond proposal-side rules:
   - `placeholder` → SOW Draft excludes pricing or marks it explicitly pending.
   - `manually_approved` / `workflow_approved` → SOW Draft may show pricing as estimated / non-binding only.
8. **At least one included option** in the source Proposal Candidate (`optionSnapshot.filter(o => o.includedInArtifact).length > 0`).
9. **No voided backing snapshot.** If the source Proposal Candidate has been voided since the operator clicked Generate SOW Draft, fail closed.
10. **No stale / expired proposal-review dependency.** If the SOW Draft was minted with reference to a specific `proposal_share_tokens` row, that token must still be active. *Optional defensive check; relevant only if Sprint P7 introduces a SOW share that piggybacks on the Proposal Review token model.*
11. **No Group-B content.** Source Proposal Candidate's `omittedContent` must include the canonical Group-B confirmation entry. Same check as proposal eligibility.
12. **SOW commercial guard passes.** § SOW Commercial Guard below — runs at SOW Draft generation time + at any future export-time path.
13. **No e-signature language.** The SOW guard rejects "Sign", "Accept", "Agree", "Authorize", etc.
14. **No final payment terms.** The SOW guard rejects "Net 30", "payment due", "invoice due", etc.
15. **No raw internal reviewer notes.** SOW Draft renders only operator-curated content from `sowDraftSnapshot`; reviewer notes from the source Proposal Candidate are not promoted into the SOW surface.

Returns ALL applicable reasons (not first-fail), mirroring the proposal-side eligibility evaluator pattern.

## Pricing / Terms Policy

- **MVP default: pricing hidden.** Because no operator path currently advances `pricing_review_state` beyond `placeholder`, the SOW Draft renderer hides pricing by default.
- **`placeholder` state notice:** SOW Draft body MUST surface "Pricing is pending manual review and is intentionally omitted from this draft." (verbatim copy per § Required Markings / Disclaimers).
- **No fixed price** unless `pricing_review_state ∈ ('manually_approved', 'workflow_approved')`. The SOW commercial guard rejects "fixed price" language as a hard block.
- **Even approved pricing is marked estimated / non-binding** until the SOW is executed through an out-of-canon legal/commercial workflow. SOW Draft sub-note for any visible price: "Estimated · subject to final approval. Not a binding quote."
- **No taxes, payment due dates, auto-renewal, cancellation terms, late fees, legal terms, or refund terms** anywhere in the SOW Draft surface. The SOW commercial guard rejects these patterns.
- **No "Net 30" / "due upon receipt" / "payable on signature"** anywhere. Hard block.
- **Implementation credit** is hidden in MVP per `docs/24` § Pricing / Terms Policy. SOW Draft does not surface implementation-credit copy until a commercial-approval workflow exists.
- **Any real pricing-approval workflow is future work.** Sprint P6 does not introduce a `pricing_review_state` transition UI; future canon (likely `docs/28` or a separate pricing-canon doc) governs this.

## SOW Commercial Guard

The SOW commercial guard **extends** the existing proposal commercial guard (`lib/proposals/commercial-guard.ts`) with SOW-specific patterns. The Sprint P4 implementation already exposes `extras.sowDraftText` and `extras.footerText` hooks on `runProposalCommercialGuard` — these are the existing extension points.

### Reused (no change required from current proposal guard)

- `FINANCIAL_CLAIM_PATTERNS` — 14 patterns from `lib/ai/claim-guard.ts` (guaranteed ROI / payback / break-even / etc.).
- `COMMERCIAL_FINALITY_PATTERNS` — 6 patterns (ready for signature / binding quote / executed SOW / etc.).
- `ROADMAP_COMMITMENT_PATTERNS` — 6 patterns (binding timeline / final implementation schedule / etc.).
- `PROPOSAL_FINALITY_PATTERNS` — 18 patterns from Sprint P4 (fixed price / final terms / contract accepted / client has agreed / payment due / auto-renewal / please sign / signature required / legally binding / by accepting / etc.).

### SOW-specific extensions (Sprint P6-B authoring scope)

A new `SOW_DRAFT_FINALITY_PATTERNS` family adds SOW-finality patterns that wouldn't apply to a discussion-only proposal but absolutely apply once the artifact is shaped as a SOW. The complete list:

- `binding agreement`
- `executed agreement`
- `signature block`
- `sign below`
- `accepted by`
- `authorized representative`
- `payment due`
- `invoice due`
- `net 30` / `net-30` / `due upon receipt`
- `start date guaranteed`
- `delivery guaranteed`
- `SLA guaranteed`
- `liquidated damages`
- `termination for convenience`
- `governing law`
- `indemnification`
- `limitation of liability`
- `warranty`
- `auto-renewal` (already in proposal-finality; explicit re-check is fine)
- `cancellation fee`
- `change order accepted`
- `legally binding` (already in proposal-finality; explicit re-check fine)
- `statement is binding`
- `this SOW is effective`
- `work shall commence`
- `client hereby agrees`

### Policy

1. **SOW guard reuses the proposal commercial guard and adds the SOW family on top.** The Sprint P6-B implementation extends `runProposalCommercialGuard`'s `RULE_FAMILY` map and `COMBINED_RULES` to include `SOW_DRAFT_FINALITY_PATTERNS` when invoked with the SOW Draft surface, OR adds a new `runSowDraftCommercialGuard` wrapper that delegates to the existing function with the SOW family appended. Smallest safe diff per the Sprint P4 precedent: extend in place.

2. **Export-time guard required.** The guard must run at SOW Draft generation time (mirroring the proposal-side at-generation scan). If Sprint P7 introduces a SOW share route, the public-route module re-runs the guard at render time as defense-in-depth (mirroring the proposal-side render-time eligibility re-check).

3. **Scan field surface.** The SOW guard scans:
   - Every field already scanned by the proposal guard for the source option (title / bestFitScenario / scopeSummary / timeline / each entry of deliverables / assumptions / dependencies / risks / pricingPlaceholder).
   - SOW-specific fields from `sowDraftSnapshot`: `scopeStatement`, every entry of `exclusions`, `responsibilities`, `openQuestions`.
   - `pricingNotice` and `legalBoundaryNotice` text (in case the operator edits them away from the canonical defaults).
   - Operator-authored footer text if any (extends `extras.footerText` from Sprint P4's hook).

4. **Activity metadata must NEVER contain violation text.** Same rule as the proposal guard — log counts + codes only; the banned phrase must not be smuggled into the audit feed.

5. **Public / client artifact must NEVER expose guard internals.** If Sprint P7 ships a public SOW share route, it surfaces only the affirmative `Commercial safety checks passed` strip — same pattern as Sprint P5's `/p/[token]`.

## Required Markings / Disclaimers

### Mandatory SOW Draft header (every page)

```
Draft SOW · not executed
```

High-visibility banner styled distinctly from the Proposal Candidate's `Proposal discussion draft` banner so the two artifacts read differently at a glance. Recommended visual: amber/warning surface with a `FileSignature` or `Stamp` icon.

### Mandatory body note (near top of artifact)

```
This draft is for review and planning only. It is not binding until reviewed, approved, and executed by authorized parties.
```

### Mandatory footer (every page)

```
Not a contract. Not an executed SOW. Not a binding quote. Not authorization to begin work. Final scope, pricing, timeline, and terms require written approval.
```

### Pricing-state notice (mandatory; one of the two below per `pricing_review_state`)

If `pricing_review_state = 'placeholder'`:

```
Pricing is pending manual review and is intentionally omitted from this draft.
```

If `pricing_review_state ∈ ('manually_approved', 'workflow_approved')` AND a price is rendered:

```
Estimated · subject to final approval. Not a binding quote.
```

### Operator-only chrome (internal SOW Draft route only)

The internal SOW Draft route is operator-internal and may surface an additional operator-only banner:

```
Operator-only SOW Draft · NOT SENT BY SLATE · No client delivery
```

This banner appears on the internal `/app/engagements/[id]/proposal/sow/[snapshotId]` route ONLY. If Sprint P7 ships a public SOW share route, the operator-only banner is stripped from that surface (same pattern as the proposal-side internal candidate route vs `/p/[token]` public render).

## SOW Snapshot Model

**Reuse `proposal_delivery_snapshots` with `delivery_surface='sow_draft_candidate'`.**

### Rationale

- The Sprint P2 schema already validates `sow_draft_candidate` as a legal `delivery_surface` value via the CHECK constraint.
- Existing infrastructure works as-is: jsonb columns (`option_snapshot`, `source_context_snapshot`, `commercial_guard_result`, `omitted_content`), `draft_watermark` boolean, `approval_state` enum, `pricing_review_state` enum, `selected_option_ids` uuid[], audit columns (`voided_*`, `generated_*`), trigger-maintained `updated_at`, workspace-scoped operator-full RLS, all work for the SOW Draft surface without modification.
- The Sprint P3 `voidProposalDeliverySnapshotAction` and Sprint P4 `cascadeRevokeActiveProposalShareTokensForSnapshot` both filter by `proposal_id` + `snapshot_id` rather than `delivery_surface`, so they apply to SOW Draft snapshots transparently.
- The Sprint P5 public `/p/[token]` route filters by `delivery_surface='client_proposal_candidate'` in `evaluateProposalShareTokenPublicAccess` — that filter must be revisited for any future SOW share route, but it does not affect Sprint P6-B / P6-C / P6-D scope.

### No migration in P6 unless an implementation gap is discovered

The canon explicitly authorises Sprint P6-B to proceed without a migration. If P6-B's implementation surfaces a missing column (e.g. an additional SOW-specific audit field that doesn't fit cleanly inside `source_context_snapshot.sowDraft`), the canon must be amended before adding a migration. The amendment process is the standard pointer-forward discipline applied throughout `docs/19`–`docs/25`.

### Recommended jsonb shape

SOW-specific content lands under `source_context_snapshot.sowDraft` so the shape is extensible without column additions:

```typescript
interface SowDraftSnapshot {
  // Identity / source
  sourceProposalSnapshotId: string;          // FK by content to the approved Proposal Candidate
  sourceProposalReviewTokenId?: string | null; // Optional — only set if the SOW Draft was generated from an active proposal share-link context
  generatedAt: string;                       // Mirrors snapshot generatedAt for SOW-side audit clarity

  // SOW-specific content
  scopeStatement: string;                    // Promoted from option.scopeSummary at generation; operator may edit
  deliverables: string[];                    // Promoted from option.deliverables
  exclusions: string[];                      // SOW-specific; operator-authored at generation
  assumptions: string[];                     // Promoted from option.assumptions
  dependencies: string[];                    // Promoted from option.dependencies
  proposedTimeline: string;                  // Promoted from option.timeline, framed as "Proposed"
  responsibilities: {                        // SOW-specific structured shape
    client: string[];                        // What the client commits to providing
    operator: string[];                      // What Saipien Labs commits to providing
  };
  openQuestions: string[];                   // SOW-specific; unresolved scope/pricing/dependency items
  pricingNotice: string;                     // Canon-derived per pricing_review_state; operator may edit
  legalBoundaryNotice: string;               // Canon-derived; operator may edit
}
```

### `selected_option_ids` usage

Same shape as proposal-side. SOW Draft pulls from one or more approved Proposal Candidate options; the `selected_option_ids` array carries the operator's selection. Default is the recommended option from the source Proposal Candidate.

### Other columns

- `option_snapshot` — captures the same per-option content the source Proposal Candidate captured; `includedInArtifact` flags the operator-selected options.
- `commercial_guard_result` — captures the SOW guard scan result (combined proposal-finality + SOW-specific families).
- `omitted_content` — includes the canonical Group-B entry + any per-option exclusions.
- `draft_watermark` — initially `true` (mirroring P3 proposal generation default); flipped to `false` by an SOW-specific approval action if Sprint P6-C ships one.
- `approval_state` — initially `unreviewed`. SOW Draft approval is a separate state from the source Proposal Candidate's approval. See § Open Decisions.
- `pricing_review_state` — copied from the source Proposal Candidate. The SOW Draft does not advance pricing state; that's a future pricing canon.
- `proposal_status_at_generation` — captures the parent `proposals.status` at generation.

## SOW Internal Route

### Recommended path

```
/app/engagements/[id]/proposal/sow/[snapshotId]
```

Operator-only internal preview route, mirroring `/app/engagements/[id]/proposal/candidate/[snapshotId]` (Sprint P3) and `/app/engagements/[id]/report/pdf-candidate/[snapshotId]` (Sprint 4C-B).

### Requirements

- **`/app/*` authenticated only.** The Next.js middleware's `needsSessionRefresh` matcher already exempts `/p/*`, `/r/*`, `/intake/*`, `/scorecard*`, `/apply/*`, but NOT `/app/*`. The new SOW route inherits the existing `/app/*` auth gate — no middleware change.
- **`dynamic = "force-dynamic"` + `revalidate = 0` + `fetchCache = "force-no-store"`** segment config (same Sprint 4D-C / Sprint P5 precedent — defeats Next 14's fetch-cache de-dup that would otherwise leak post-void reads).
- **Snapshot-pure render** via a new `<SowDraftDocument>` component that extends the existing `<ProposalCandidateDocument>` patterns (operator hint + Draft Candidate banner + identity strip + sections + footer) with SOW-specific chrome ("Draft SOW · not executed" banner + signatory-placeholder block + canon-mandated body note + SOW footer).
- **Status / approval markers** visible per the operator-only chrome — `status` (`candidate` / `voided`), `approval_state` (`unreviewed` / `approved` / `revoked`), `pricing_review_state` chip, commercial-guard pass/fail strip, draft watermark when applicable.
- **Voided banner** when `status='voided'` (red banner stating "SOW Draft voided · DO NOT DELIVER" with `voided_at` + `void_reason`).
- **No public access.** The route is under `/app/*`; clients never see it.
- **No e-signature controls.** No "Sign", "Accept", "Approve", "Agree" buttons — even disabled. Signatory placeholders, if any, are visual-only (e.g. an inline "[ Authorized signature — to be added during execution ]" string) with no associated click handler.
- **No Send to Client.** The route does not include any mint / share action. The earliest mint surface is Sprint P7's hypothetical SOW share route (operator-only mint, copy-link only).
- **No PDF binary.** Same as the proposal-side internal candidate route — operator drives the browser's Save-as-PDF for review purposes only.
- **Print-friendly light surface.** Wrap the render in the Sprint 4B `.slate-print-light` CSS-variable scope so chart-token colors fall back to the print-safe palette when the operator drives Save-as-PDF.

## Prepare SOW Draft Unlock Policy

`Prepare SOW Draft` (currently a `LockedActionButton` at `components/proposals/proposal-workspace.tsx:375`) unlocks **only at the END of Sprint P6-C** and only if every prerequisite below holds:

1. **SOW Draft eligibility evaluator exists** (`lib/proposals/sow-draft-eligibility.ts` recommended) and enforces every rule in § SOW Eligibility Rules.
2. **`generateSowDraftCandidateAction` works** (`lib/proposals/sow-draft-actions.ts` recommended; could also extend `snapshot-actions.ts`).
3. **Internal SOW Draft route works** at the canonical path above.
4. **SOW commercial guard passes** at the action layer.
5. **Required disclaimers render** per § Required Markings / Disclaimers (header + body note + footer + pricing-state notice).
6. **Pricing placeholder is hidden / marked pending** correctly.
7. **Void action works** end-to-end. `voidProposalDeliverySnapshotAction` already handles `delivery_surface='sow_draft_candidate'` rows transparently because it filters by id, not surface; verify this against the new SOW snapshot during the Sprint P6-D acceptance audit.
8. **Activity events emit** for `sow_draft_generated`, `sow_draft_voided`, and (if implemented) `sow_draft_approved`.
9. **`npm run lint` clean.**
10. **`NEXT_TELEMETRY_DISABLED=1 npm run build` clean.**
11. **No e-signature / no Send to Client / no public SOW share route exists** at the end of P6-C. Public SOW share is Sprint P7 scope; Send to Client is Sprint P8 scope.

### Unlock shape

Replace `components/proposals/proposal-workspace.tsx:375`'s `LockedActionButton` with a primary in-page anchor / button labeled `Generate SOW Draft` (analogous to the Sprint P5 `Prepare Client Review` unlock). The anchor target is a new `<PastSowDraftsPanel>` (recommended sibling to `<ProposalCandidatesPanel>`) where the operator clicks the per-row `Generate SOW Draft` button. **Non-send action by design** — SLATE does not auto-email or push to CRM; the operator hand-delivers the SOW Draft URL out of band (or, in Sprint P6 scope, simply reviews it internally without sharing).

For mock / legacy slug engagements the locked button remains.

## SOW Share Route Policy

**Public SOW share is NOT part of Sprint P6.** It is a Sprint P7 decision authored after the Sprint P6-D acceptance audit signs off the internal SOW Draft flow.

### If approved in Sprint P7

- Recommended URL shape: **`/s/[token]`** (short, visually distinct from `/p/[token]` proposal review and `/r/[token]` report links). Alternative: `/sow/[token]` (more explicit but longer; tab title / copy-paste reveals SOW context). **Recommended default: `/s/[token]`** per the same low-context-leak rationale `docs/24` § Share Token Model Recommendation applied to `/p/[token]`.
- Requires either a new `sow_share_tokens` table (mirroring `proposal_share_tokens`) or a revised `proposal_share_tokens` schema with a `share_surface` column (`'proposal' | 'sow_draft'`). **Recommended default: separate `sow_share_tokens` table** mirroring the canon's report-vs-proposal separation rationale (different cascade rules, different audit-event vocabulary, different legal-review separation).
- Requires stricter public disclaimers than the Proposal Review surface — every disclaimer from § Required Markings / Disclaimers must apply, plus an additional explicit disclaimer reaffirming non-binding status given the SOW shape.
- E-signature is still entirely separate and out of Phase 1B scope.
- Cascade-revoke semantics from Sprint P4 (`cascadeRevokeActiveProposalShareTokensForSnapshot`) apply: voiding a SOW Draft snapshot must cascade-revoke any SOW share tokens that point at it.

### Recommended default for now

**Defer public SOW share until after internal SOW Draft acceptance audit (Sprint P6-D).** The Sprint P6 sequence (P6-A canon → P6-B foundation → P6-C internal route + unlock → P6-D acceptance audit) deliberately stops at internal-preview maturity. Sprint P7 may approve a public route once the canon + foundation + workflow have been signed off internally first.

## Send to Client Policy

- **`Send to Client` remains locked.** No change from `docs/22` + `docs/24` + `docs/25` posture.
- **Earliest unlock: Sprint P8.** Requires every prior sprint (Sprint P6-A through P7-X if SOW share is approved) to have landed and accepted.
- **Requires separate channel canon** if SLATE is to send email or push to CRM. Recommended canon doc number: **`docs/27_PHASE_1B_SLATE_DELIVERY_CHANNEL_CANON.md`** (the next available number after `docs/25` audit + `docs/26` SOW canon).
- **First Send-to-Client version should still be operator-mediated copy-link** unless the channel canon explicitly authorises automation. SLATE does NOT auto-email or push to CRM by default.

## Activity / Audit Events

Future event types to add to `lib/activity/types.ts` when the matching code sprints land. **Do not implement in this canon sprint.**

Sprint P6-B / P6-C events:

- `sow_draft_generated`
- `sow_draft_failed` (counts only — never violation text per the proposal-side precedent)
- `sow_draft_approved` *(optional — only if Sprint P6-C ships SOW-side approval as a separate state from Proposal Candidate approval; see § Open Decisions)*
- `sow_draft_voided`

Sprint P7 events (if SOW share is approved):

- `sow_share_token_created`
- `sow_share_token_accessed`
- `sow_share_token_revoked`
- `sow_share_token_expired`

Sprint P8 events (Send to Client, later only):

- `sow_sent_to_client` (only if a SLATE-mediated send is authorised by the channel canon)

**Activity-event metadata** must follow the proposal-side hygiene rules — no raw token, no banned-claim text in failure event metadata (only counts and codes), sanitised key names that avoid the `FORBIDDEN_KEY_PATTERNS` strip in the activity logger.

## Proposed Sprint Sequence

| Sprint | Title | Scope |
|---|---|---|
| **P6-A** | SOW Draft Canon | **This sprint.** Authors `docs/26`. No code. |
| P6-B | SOW Draft foundation | New `lib/proposals/sow-draft-eligibility.ts` evaluator + extend `commercial-guard.ts` with `SOW_DRAFT_FINALITY_PATTERNS` (or add `runSowDraftCommercialGuard` wrapper) + new `generateSowDraftCandidateAction` (operator cookie-bound; no public route) + 3 new activity event types. **No migration** if reusing `proposal_delivery_snapshots` as recommended. **`Prepare SOW Draft` still locked.** |
| P6-C | Internal SOW Draft route + Past SOW Drafts panel + Prepare SOW Draft unlock | `app/app/engagements/[id]/proposal/sow/[snapshotId]/page.tsx` (operator-only, `/app/*`-gated, snapshot-pure render via new `<SowDraftDocument>`) + `<PastSowDraftsPanel>` on `/app/engagements/[id]/proposal` + Generate / Open / Void buttons + (optional) `approveSowDraftSnapshotAction` if SOW-side approval is a separate state. **At the END of Sprint P6-C: `Prepare SOW Draft` unlocks** to in-page anchor pointing at the new panel. |
| **Audit gate** | SOW Draft MVP Acceptance Audit | Mirrors `docs/23` / `docs/25` shape. Sign off Sprint P6-B + P6-C together before P7-A begins. **No code authored.** |
| P7-A | SOW share route canon OR implementation decision | Either authors a sub-canon (or addendum to this `docs/26`) clarifying whether to ship a public SOW share route at all, then either implements the route (mirroring Sprint P5's shape) or defers indefinitely. **`Send to Client` remains locked.** |
| P8 | (optional, later) Send to Client unlock with channel canon | Requires the separate `docs/27_PHASE_1B_SLATE_DELIVERY_CHANNEL_CANON.md` AND explicit operator authorisation. First version operator-mediated copy-link, not auto-email. **Last LockedActionButton to be unlocked.** |
| Later | E-signature / CRM / contract execution | Out of Phase 1B scope until P8 + dedicated e-signature canon + dedicated contract-execution canon all land. |

### Parallel work — not blockers

- **Production hardening backlog** from `docs/23` + `docs/25` (pepper config + access debounce + dev-only short-expiry affordance + audience-label / recipient-email UI + revoke-from-management-panel UI + engagement-title fallback investigation + Sprint P4 copy-once panel chip wording fix) can run in parallel with Sprint P6-B / P6-C and is independent of the SOW Draft sequence.
- **Benchmark Gate 1 (`docs/14`)** and **Financial Gate 1 (`docs/15`)** advancement remains separate and outside Phase 1B scope. They must lift before any Group-B exhibit can appear in a client-bound SOW Draft artifact, but they do not block P6-A through P7 since Group-B is excluded by canon throughout.

## Open Decisions / Operator Approval Needed

The following decisions are deferred to operator approval before Sprint P6-B begins. Recommended defaults stand committed unless overridden.

| Decision | Options | Recommended default |
|---|---|---|
| Reuse `proposal_delivery_snapshots` or add `sow_delivery_snapshots`? | reuse (no migration) · separate table (migration `0017`) | **Reuse `proposal_delivery_snapshots`** with `delivery_surface='sow_draft_candidate'`. The Sprint P2 schema was designed for this. No migration in P6 unless an implementation gap is discovered. |
| SOW public route URL if Sprint P7 approves a public route | `/s/[token]` · `/sow/[token]` · `/p/[token]` with surface switch | **`/s/[token]`** (short; visually distinct from `/p/` and `/r/`; low-context tab title) |
| Should SOW Draft include pricing if `placeholder`? | hidden · shown with "pending" marker | **Hidden** with the mandatory body note: "Pricing is pending manual review and is intentionally omitted from this draft." Operator may add pricing copy when `pricing_review_state` advances. |
| Should SOW Draft include implementation credit? | shown · hidden | **Hidden until a commercial-approval workflow exists.** Same posture as Proposal Candidate per `docs/24` § Pricing / Terms Policy. |
| Should SOW Draft show client / operator responsibilities? | yes · no · operator-editable | **Yes**, with the `responsibilities: { client[], operator[] }` structured shape in `sowDraftSnapshot`. Default content can be empty; operator fills in pre-share. |
| Should SOW Draft include a change-order placeholder? | yes (block) · no · operator-editable | **No** — omit a dedicated change-order block. Use a single mandatory footer line: "Changes to the agreed scope require separate written approval." (this line is implied by the canon-mandated "Final scope, pricing, timeline, and terms require written approval." footer; no separate change-order section). |
| Is `approval_state='approved'` required for SOW Draft generation, or only for sharing? | generation gate · share gate · both | **Required for generation.** SOW Draft cannot derive from an un-approved Proposal Candidate. The source Proposal Candidate must be `approval_state='approved'` per § SOW Eligibility Rules item 4. |
| Is SOW Draft approval separate from Proposal Candidate approval? | separate state · inherited from Proposal Candidate · no SOW approval at all | **Separate state.** SOW Draft has its own `approval_state` (the existing `proposal_delivery_snapshots.approval_state` column carries it). Initial value `unreviewed`; an `approveSowDraftSnapshotAction` (optional in Sprint P6-C) flips it to `approved`. SOW approval gates any future SOW share-route eligibility (Sprint P7). |
| Generate from one recommended option or multiple selected options? | recommended only · operator-selected | **Operator-selected with recommended-option default.** Same precedent as Sprint P3's `generateProposalCandidateAction` — if `selectedOptionIds[]` is omitted, fall through to the recommended option from the source Proposal Candidate. |
| Are legal terms entirely omitted or represented as "to be provided separately"? | omitted with no notice · single boundary note · per-clause placeholders | **Single boundary note.** A canon-mandated `legalBoundaryNotice` in `sowDraftSnapshot`: "Legal terms (governing law, indemnification, liability, warranty, termination) are intentionally omitted from this draft. They will be provided separately during the execution review process." |
| Public SOW share route before Send to Client? | yes (P7) · no · operator-decision-time | **Operator-decision-time at Sprint P7-A.** Sprint P6-D acceptance audit will surface whether the internal SOW Draft flow is mature enough to warrant public exposure. Recommended default: **defer** unless explicit operator authorisation lands. |
| Future e-sign provider | DocuSign · PandaDoc · Adobe Sign · HelloSign · in-house · undecided | **Undecided and out of Phase 1B scope.** Requires a dedicated e-signature canon authored separately. |

## Non-Goals

This canon sprint authorises **none** of the following:

- No implementation of any SOW Draft surface.
- No schema changes / migrations.
- No new public route (`/s/[token]` is recommended for Sprint P7 IF approved; not authorised by this sprint).
- No new share-token table (`sow_share_tokens` is recommended for Sprint P7 IF approved; not authorised here).
- No `Send to Client` unlock.
- No `Prepare SOW Draft` unlock in this canon sprint (Sprint P6-C scope at the earliest).
- No e-signature integration.
- No CRM / email integration.
- No PDF binary / artifact storage bucket.
- No new package dependency.
- No Group-B wiring beyond what already exists in `/app/charts-preview` (still confined to the canonical 4 files).
- No `docs/14` or `docs/15` gate advancement.
- No AI synthesis change.
- No report-link or proposal-link change (existing `/r/[token]` and `/p/[token]` routes and their dependencies are untouched by this canon).

## Acceptance Criteria

This canon sprint is accepted when:

1. **`docs/26_PHASE_1B_SOW_DRAFT_CANON.md` exists** with every required section.
2. **SOW Draft artifact definition is clear** — § SOW Draft Artifact Definition enumerates must-include + must-not-include lists.
3. **SOW eligibility rules defined** — § SOW Eligibility Rules enumerates 15 conditions.
4. **Pricing / terms policy defined** — § Pricing / Terms Policy locks `placeholder` as the MVP default, gates fixed-price language on `manually_approved` / `workflow_approved`, and forbids payment / billing / legal terms.
5. **SOW commercial guard policy defined** — § SOW Commercial Guard names the reused 4 families (44 patterns) + adds 26 SOW-finality patterns, with the export-time + activity-metadata + public-artifact policies.
6. **Required markings / disclaimers defined** — § Required Markings / Disclaimers provides the mandatory header + body note + footer + pricing-state notice + operator-only chrome.
7. **Snapshot model recommendation defined** — § SOW Snapshot Model authorises reusing `proposal_delivery_snapshots` with `delivery_surface='sow_draft_candidate'` and provides the `sowDraftSnapshot` jsonb shape.
8. **Internal route requirements defined** — § SOW Internal Route specifies the path, segment config, render requirements, and content boundaries.
9. **Prepare SOW Draft unlock policy defined** — § Prepare SOW Draft Unlock Policy enumerates 11 prerequisites and the unlock shape (in-page anchor to the panel).
10. **SOW share route policy defined** — § SOW Share Route Policy defers public share to Sprint P7 with recommended-default `/s/[token]` and separate `sow_share_tokens` table.
11. **Send to Client policy defined** — § Send to Client Policy keeps it locked, requires the channel canon, and prefers copy-link first.
12. **Activity events defined** — § Activity / Audit Events lists 4 Sprint P6 events + 4 Sprint P7 events + 1 Sprint P8 event.
13. **P6 / P7 / P8 sprint sequence defined** — § Proposed Sprint Sequence with explicit boundaries at the Sprint P6-D audit gate and the Sprint P8 channel-canon prerequisite.
14. **Open decisions listed with recommended defaults** — 12 decisions enumerated in § Open Decisions.
15. **`docs/08_CURRENT_STATUS.md` and `docs/10_SESSION_HANDOFF.md` updated** — landing note + revised "Recommended Next Step" + handoff narrative.
16. **No source / schema / API / package / public / storage / PDF / email / CRM / e-sign / middleware / next.config changes.** `git status --short` after this sprint shows only `docs/08`, `docs/10`, `docs/26` modified (`docs/26` added).

## Pointer-Forward

**Future SOW Draft implementation agents must treat `docs/26` as source of truth.** Sprint P6-B through Sprint P7 (and Sprint P8 if it ever runs the SOW lane) consume this canon for:

- the SOW snapshot shape (reuse `proposal_delivery_snapshots` with `delivery_surface='sow_draft_candidate'`);
- the SOW eligibility rules at generation time;
- the SOW commercial guard pattern set + scanned-field surface;
- the recommended `/s/[token]` URL shape and separate `sow_share_tokens` table for any future public SOW share surface;
- the required disclaimer copy verbatim;
- the unlock prerequisites for `Prepare SOW Draft`;
- the pricing / terms / e-signature boundaries.

**Deviations require canon amendment before code lands.** If a Sprint P6-B+ implementation discovers that one of this canon's defaults is wrong (e.g. the reuse-vs-separate-table decision proves untenable due to RLS or audit-event-grouping problems, or a recommended guard pattern proves too strict and blocks legitimate operator copy), the canon must be updated FIRST — via an addendum doc or a `docs/26` edit accompanied by a sign-off note — before the deviating code is authored.

The same pointer-forward discipline that drove `docs/19` → Sprint 4A–4D-C, `docs/22` → Sprint 4D-B / 4D-C, `docs/24` → Sprint P1–P5, and `docs/25` → Sprint P5 unlock applies here. Canon precedes code.

# Phase 1B Proposal/SOW Delivery Canon

## Status

- **Date:** 2026-05-15
- **Branch:** `persistence/step-0-1-auth-shell`
- **Type:** Canon / governance document. **No implementation authorized by this sprint.**
- **Sprint label:** P1 — Phase 1B Proposal/SOW Delivery Canon
- **Client Report Link MVP status:** **Accepted with notes** (`docs/23_CLIENT_REPORT_LINK_MVP_ACCEPTANCE_AUDIT.md`).
- **Proposal/SOW delivery:** not yet implemented. No proposal-side code authored by this sprint.
- **`Prepare Client Review`:** remains locked. This canon does not unlock it.
- **`Prepare SOW Draft`:** remains locked. This canon does not unlock it.
- **`Send to Client`:** remains locked. This canon does not unlock it.
- **`Prepare Report` and the report-side `Export Report` mock control:** unchanged by this canon.
- **E-signature** and **CRM/email delivery** remain **out of scope** for Phase 1B. They require separate canons before any code lands.
- **Group-B exhibits** (Benchmark Comparison Bars, AI-Savings Waterfall, ROI Bridge) remain **excluded** from every client-bound proposal artifact until `docs/14` and `docs/15` advance to their respective Gate 1 tiers AND a matching wiring sprint is authorized.

## Why This Exists

The Client Report Link MVP (`docs/22` + Sprint 4D-B/4D-C, signed off in `docs/23`) succeeded because it constrained the surface to the smallest coherent client-facing delivery — an **advisory** report read-only link with snapshot-pure rendering and a mandatory four-denial footer. Report delivery is, by canon, advisory; it cannot create commercial obligations because every client artifact carries "not a SOW, not a binding quote, not a financial guarantee, not a contract" copy as a non-negotiable footer.

**Proposal/SOW delivery is structurally different. It is commercial.** Proposal options carry scope language, timeline windows, inclusions/exclusions, dependencies, risks, and pricing placeholders that the operator drafts (often with AI assistance). The artifact crosses from "discussion material" to "client-facing commercial document" the moment it leaves the operator's workspace — and a client reading the artifact will reasonably treat it as the starting point of a commercial commitment.

That difference matters because a misframed proposal artifact can:

- **Create binding-quote confusion** — a client may treat any explicit price as an offer they can accept by reply.
- **Create scope ambiguity** — vague language about "what's included" / "what's excluded" becomes the basis of a dispute later.
- **Cause price / term drift** — proposal-side numbers diverging from final SOW numbers reads as a bait-and-switch.
- **Surface AI-generated commercial commitments** — operator-edited text passes through a content path that today only has the report-side claim guard; commercial-finality language (`ready for signature`, `binding quote`, `executed SOW`) needs a stricter, proposal-aware guard.
- **Imply implementation-date guarantees** — "we will start on …", "you'll be live by …", "your team will have …" all read as guarantees the moment they leave SLATE.
- **Create legal / e-signature confusion** — the moment any artifact carries "accept", "approve", "sign", or "agree" wording, clients assume a binding agreement exists.
- **Leak client access** — share-link recipients can be more or less than the intended audience; access controls must be at least as strict as the report-link surface.
- **Render stale proposal options** — proposal options change as discovery progresses; an old share link backed by a stale snapshot is misleading.
- **Create report ↔ proposal mismatch** — the proposal's "based on these findings" framing can drift from the report the client actually sees if the proposal references live data or a different snapshot.
- **Leak Group-B financial / benchmark claims** — Benchmark Comparison Bars, AI-Savings Waterfall, and ROI Bridge are explicitly gated on `docs/14` / `docs/15` advancement. A proposal route that wires Group-B before those gates lift would inherit unvalidated claims.

This canon defines the boundary for every one of those risks **before** any proposal-side code is written. Future agents must consume this doc as source of truth.

## Current State

What is implemented today (no change from the post-`docs/23` state):

- **Proposal option drafting exists internally.** `lib/proposals/synthesis-actions.ts` provides `generateProposalOptionDraftAction({ engagementId, optionId })` — operator-only, single-option AI drafting against a persisted UUID engagement. Partial-field update only; never touches `pricing_placeholder`, `recommended`, `option_type`, `position`, `proposal_id`, or any link row.
- **Proposal options can include** `title`, `option_type`, `recommended`, `position`, `best_fit_scenario`, `scope_summary`, `timeline`, `deliverables[]`, `assumptions[]`, `dependencies[]`, `risks[]`, `pricing_placeholder` (as informational copy, not final pricing). The proposal-level row carries `implementation_credit` as a bounded commercial lever with canonical commercial-lever copy.
- **Proposal action buttons remain locked.** Five `LockedActionButton` instances across the app — three of them on the proposal surface (`Prepare Client Review`, `Prepare SOW Draft`, `Send to Client`).
- **No `proposal_delivery_snapshots` table exists.** No proposal snapshot has ever been generated.
- **No `proposal_share_tokens` table exists.** No proposal share token has ever been minted.
- **No SOW document model exists.** No SOW draft renderer, no SOW snapshot, no SOW share.
- **No e-signature integration.** No DocuSign, PandaDoc, HelloSign, or other e-sign dependency in `package.json`.
- **No CRM / email send.** No SendGrid, SES, Mailgun, Postmark, Resend, Salesforce, HubSpot, or other delivery integration.
- **Report share flow exists** (`docs/22` + Sprint 4D-B/4D-C + `docs/23`). It is the architectural reference pattern but **MUST NOT be reused blindly** for proposal/SOW delivery — see § Relationship to Report Link MVP below.

## Delivery Surface Taxonomy

The proposal-side delivery taxonomy mirrors the seven-surface report-side taxonomy in `docs/22` § Delivery Surface Taxonomy but with **commercial-aware** distinctions:

1. **Internal proposal workspace** — *current.* The operator-only `/app/engagements/[id]/proposal` route. Authenticated. RLS-gated. No share links. Drafting + review only.
2. **Internal proposal preview** — *future, operator-only.* A print-friendly internal-preview route equivalent to `/app/engagements/[id]/report/print`. Operator-driven Save-as-PDF for internal review. Bears the same internal-only chrome as the report preview. **Not in scope for this canon's first implementation sprint.**
3. **Proposal snapshot candidate** — *future, Sprint P2.* The proposal-side analog of `report_delivery_snapshots`. Operator-only metadata-only snapshot capturing per-option content + commercial-guard result + omission appendix at generation time. Drives the candidate route and any future share surface.
4. **Client proposal review link** — *future, Sprint P5.* A public read-only `/p/[token]` route that renders a sanitized proposal candidate snapshot. **This is a discussion artifact, NOT a SOW.** Carries the proposal-side mandatory footer (see § Required Disclaimers / Markings).
5. **SOW draft artifact** — *future, Sprint P6.* A separate, stricter snapshot type for the formal scope-of-work document. **Still non-binding** until reviewed and executed through an approved commercial workflow. Carries the SOW-specific mandatory footer.
6. **SOW approval / e-signature** — *later, out of scope until a separate e-sign canon lands.* No DocuSign / PandaDoc / etc. integration in Phase 1B without explicit operator authorization.
7. **CRM / email-mediated proposal delivery** — *later, out of scope until a separate channel canon lands.* In the first implementation, the operator copies the public link and delivers it through their own channel. SLATE does not send.
8. **Final contract / work order** — *out of current scope.* Requires a contract-execution canon and is independent of both the e-sign canon and the channel canon.

**Boundaries between surfaces:**

- **Proposal review link is not a SOW.** It is a discussion artifact for commercial alignment. Operators must read the SOW-eligibility rules below if they intend to share the same content as a formal SOW.
- **SOW draft is not an executed agreement.** Even a fully-formed SOW draft carries "Draft · not executed" markings and a "not binding until fully executed" footer.
- **E-signature is separate and later.** The proposal review link surface does NOT include "accept", "sign", or "approve" controls. A future e-sign canon will define the legal / audit / signing-event model independently.
- **Report share links and proposal share links are related patterns but separate artifacts.** A client may receive both during the same engagement; they live in separate tables, hash separately, revoke separately, and audit separately. Cross-references between them are by friendly client-visible context only (e.g. "your prepared report") — never by raw UUIDs or token hashes.

## Artifact Definitions

### Proposal Candidate

A **client-safe commercial discussion artifact** based on approved or operator-selected proposal options. Its purpose is to align on scope, recommended option, sequencing, and operator-flagged assumptions / risks **before** any formal SOW conversation.

A Proposal Candidate **may**:

- describe the recommended option, the alternative options, and the reasoning;
- summarise scope, deliverables, assumptions, dependencies, risks, and next steps;
- carry an implementation-credit framing as an informational commercial lever (see § Pricing / Terms Policy);
- reference the corresponding Report snapshot by client-visible context (e.g. "based on the diagnostic findings shared in your prepared report"), **never by internal IDs**.

A Proposal Candidate **must not**:

- include final / fixed-bid pricing unless a Pricing approval workflow exists (see § Pricing / Terms Policy);
- include "sign", "accept", "approve", "agree", or any other commercial-finality affirmative;
- include payment, billing, auto-renewal, cancellation, or termination terms;
- include "binding quote", "binding offer", "executed SOW", "final commercial terms", or any of the 6 commercial-finality patterns from `lib/ai/claim-guard.ts`;
- include guaranteed delivery dates, implementation-date guarantees, or guaranteed savings / ROI / payback / break-even claims (the existing 14 financial + 6 roadmap-commitment patterns);
- include reviewer notes, operator hints, internal IDs, claim-guard codes, or any non-client surface from the snapshot;
- include Group-B exhibits or Group-B-derived numeric claims.

### SOW Draft

A **more formal implementation-scope artifact** still **non-binding** until reviewed and executed through an approved commercial workflow. Its purpose is to capture the agreed scope, timeline, deliverables, dependencies, assumptions, risks, and (when authorized) pricing for legal / commercial review.

A SOW Draft **may**:

- restate the recommended option's scope and deliverables verbatim from the Proposal Candidate;
- frame the timeline as "estimated", "proposed", or "target" — never as a guarantee;
- include placeholders for legal review, commercial-terms review, signatory blocks (without active signing controls);
- include pricing **only** if a Pricing approval workflow has run AND the pricing is explicitly marked "subject to final approval".

A SOW Draft **must**:

- carry the **"Draft SOW · not executed"** marking on every page / fold of the artifact;
- carry "Requires authorized review and signature" copy in the footer;
- carry "Not binding until fully executed" copy in the footer;
- pass a stricter commercial guard that adds SOW-specific patterns to the proposal-side guard;
- carry zero "sign now", "accept", "approve", "agree", or other commercial-finality affirmatives.

### Executed SOW / Contract

**Out of scope for Phase 1B unless separately authorized.** The proposal-delivery canon does not define the executed-contract model; that work belongs to a future contract-execution canon. SLATE in Phase 1B never produces a fully-executed SOW.

## Proposal Eligibility Rules

A `proposal_delivery_snapshots` row may be generated as a `client_proposal_candidate` surface **only when** every one of the following holds at generation time:

1. **Persisted UUID engagement.** Mock / legacy-slug demo engagements never reach the snapshot pipeline.
2. **Proposal exists.** A `proposals` row is bound to the engagement.
3. **At least one proposal option exists.** Zero-option proposals are ineligible.
4. **At least one option is marked `recommended = true`** **OR** the operator explicitly passes a non-empty `selectedOptionIds[]` array to the generator. The snapshot cannot guess which options to include.
5. **All included options must be reviewed / approved.** When the proposal option status surface is canonized (currently options have no `status` column — that addition is part of Sprint P2 scope), every included option must be in `approved` or `final` state, OR explicitly carry a `draft_watermark=true` flag on the snapshot.
6. **`pricing_placeholder` is informational, never final.** If `pricing_placeholder` is non-null at generation time, the snapshot captures it but the client-facing render either hides it or marks it "Estimated · subject to final approval".
7. **No blank / placeholder commercial terms.** Snapshot rejects options whose `scope_summary`, `timeline`, or `best_fit_scenario` is empty, whitespace-only, or carries placeholder language like `TODO`, `TBD`, or `<scope>`.
8. **Commercial guard passes.** The export-time commercial-claim guard (see § Commercial Claim Guard) returns `{ passed: true, violations: [] }` over every scanned field on every included option plus the proposal-level commercial-lever copy and the optional pricing placeholder.
9. **No banned commercial-finality language.** This is a subset of (8) but called out separately so reviewers can see it as a hard rejection vs a soft warning.
10. **No guaranteed delivery / ROI / savings / payback / break-even claims.** Same scanner, financial + roadmap-commitment families.
11. **No Group-B financial / benchmark claim leakage.** The snapshot's omitted-content jsonb carries a canonical Group-B confirmation entry, mirroring the report-side `group_b_block` omission entry.
12. **Reviewer / internal notes excluded by default.** Unless a future canon amendment explicitly opts in a per-option reviewer-note surface, reviewer notes never enter the snapshot.
13. **Proposal links back to report / opportunity / roadmap context when available.** The snapshot's `source_context_snapshot` jsonb captures `reportSnapshotId?: string` (if a recent report snapshot exists), `linkedOpportunityIds[]`, and `linkedRoadmapItemIds[]` — by ID for operator audit, by client-friendly context only for the public render.

## SOW Eligibility Rules

A `proposal_delivery_snapshots` row may be generated as a `sow_draft_candidate` surface **only when** every Proposal Eligibility rule above holds **plus** every one of the stricter requirements below:

1. **A non-voided Proposal Candidate exists for the same proposal.** SOW Draft cannot precede the Proposal Candidate; it ratifies the agreed scope.
2. **The Proposal Candidate is approved.** Either the operator has marked the corresponding snapshot as approved (a column to be added in Sprint P2 — `approval_state: 'unreviewed' | 'approved' | 'revoked'` defaults to `unreviewed`), OR a future canon defines a lighter-weight "operator confirms SOW draft is ready" affordance.
3. **Operator explicitly chooses "Prepare SOW Draft".** The action is never automatic and never cascades from snapshot generation. The locked `Prepare SOW Draft` LockedActionButton's unlock is governed by § Prepare SOW Draft Unlock Policy below.
4. **Operator selects scope / options for the SOW.** If multiple options exist on the proposal, the SOW Draft includes only the operator-selected ones. The selection is captured in the snapshot.
5. **Pricing and terms must be manually reviewed.** If a price appears in the SOW Draft, the operator must explicitly approve it through a Pricing approval workflow (see § Pricing / Terms Policy). The snapshot records `pricing_review_state: 'placeholder' | 'manually_approved' | 'workflow_approved'`.
6. **Timeline framed as estimated / proposed.** "Start date", "go-live", "completion date" are framed as "target", "proposed", "estimated" — never as a guarantee. The commercial guard rejects guarantee-framing on timeline fields.
7. **No e-signature language.** No "sign", "accept", "approve", "agree", "execute", "I authorize", or any other affirmative-act language.
8. **No "ready for signature" framing.** That phrase is already in the commercial-finality pattern list and is rejected at the export-time guard.
9. **No binding-acceptance language.** No "by replying you accept", "by clicking you agree", "your acceptance constitutes …" — these are e-sign-adjacent affirmatives.
10. **No automatic Send to Client.** SOW Draft generation never triggers an outbound send, email, CRM event, or notification of any kind to the client. The operator copies the link.
11. **SOW Draft must carry "Draft · not executed" marking.** On every page / fold of the artifact, visible to both operator and client.

## Snapshot Model Recommendation

The canon recommends a **new** future table at Sprint P2:

```
public.proposal_delivery_snapshots
```

Conceptual columns (mirrors `report_delivery_snapshots` from `docs/20` where appropriate, with commercial-aware additions):

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid primary key default gen_random_uuid()` | |
| `workspace_id` | `uuid not null references public.workspaces(id) on delete cascade` | |
| `engagement_id` | `uuid not null references public.engagements(id) on delete cascade` | |
| `proposal_id` | `uuid not null references public.proposals(id) on delete cascade` | |
| `status` | `text not null default 'candidate' check (status in ('candidate','generated','voided'))` | mirrors the report snapshot status semantics |
| `delivery_surface` | `text not null check (delivery_surface in ('internal_candidate','client_proposal_candidate','sow_draft_candidate'))` | three-value union — proposal candidate and SOW draft share the table but the surface flag drives the renderer and guard |
| `proposal_status_at_generation` | `text` | snapshot of the proposal row's status at generation time |
| `generated_by` | `uuid references auth.users(id) on delete set null` | |
| `generated_by_label` | `text` | initials only (operator-visible) |
| `generated_at` | `timestamptz not null` | |
| `option_snapshot` | `jsonb` | array of included options with full content captured at generation time |
| `source_context_snapshot` | `jsonb` | `{ reportSnapshotId?, linkedOpportunityIds[], linkedRoadmapItemIds[], implementationCredit }` |
| `commercial_guard_result` | `jsonb` | `{ scannedFields[], patternsApplied[], violations[], passed, scanDurationMs, version }` |
| `omitted_content` | `jsonb` | including the canonical Group-B confirmation entry + any omitted-by-eligibility options |
| `draft_watermark` | `boolean not null default false` | |
| `approval_state` | `text not null default 'unreviewed' check (approval_state in ('unreviewed','approved','revoked'))` | proposal-specific; SOW Draft requires `approved` |
| `pricing_review_state` | `text not null default 'placeholder' check (pricing_review_state in ('placeholder','manually_approved','workflow_approved'))` | governs whether the public render shows a price |
| `selected_option_ids` | `uuid[] not null default '{}'` | populated for SOW Draft surface; may be empty for Proposal Candidate when `recommended=true` exists |
| `artifact_path` | `text` | nullable; reserved for a future PDF-binary canon |
| `artifact_mime_type` | `text` | nullable |
| `artifact_size_bytes` | `bigint` | nullable |
| `artifact_sha256` | `text` | nullable |
| `app_version` | `text` | |
| `commit_sha` | `text` | |
| `voided_at` | `timestamptz` | |
| `voided_by` | `uuid references auth.users(id) on delete set null` | |
| `void_reason` | `text` | |
| `created_at` | `timestamptz not null default now()` | |
| `updated_at` | `timestamptz not null default now()` | with trigger |

Indexes (preview): unique constraint not on a token-hash equivalent (snapshots are not referenced by token); secondary indexes on `workspace_id`, `engagement_id`, `proposal_id`, `(status, delivery_surface)`. RLS: `to authenticated` only, workspace-scoped, identical pattern to `report_delivery_snapshots`. No `to anon` policy.

**Do not implement in this sprint.**

### Discussion — reusing `report_delivery_snapshots`?

Considered: extend `report_delivery_snapshots.delivery_surface` to include `client_proposal_candidate` and `sow_draft_candidate` values.

**Rejected.** Proposal / SOW delivery is **commercial**, not advisory. The two artifact families have different:

- **Eligibility rules** — report eligibility is "approved sections + Group-B omitted + claim guard pass + age ≤ 14d"; proposal eligibility adds "recommended option set + commercial guard + pricing placeholder rule".
- **Lifecycles** — report snapshots are tied to report sections; proposal snapshots are tied to proposal options + commercial lever.
- **Risk profiles** — a stale report snapshot misleads; a stale proposal snapshot creates commercial exposure.
- **Guard policies** — report-side claim guard is 26-pattern (financial / commercial-finality / roadmap-commitment) at generation time; proposal-side guard adds SOW-specific patterns and runs at both generation AND export time over additional fields (pricing placeholder, scope summary, timeline, deliverables, assumptions, dependencies, risks, next steps).
- **Approval semantics** — `report_delivery_snapshots` has no `approval_state`; proposal candidates need one because SOW Draft eligibility depends on it.
- **Surface count** — report snapshots have two delivery surfaces (`internal_candidate`, `client_pdf_candidate`); proposal snapshots have three (`internal_candidate`, `client_proposal_candidate`, `sow_draft_candidate`), and conflating them in one table risks accidentally applying the wrong eligibility / guard to the wrong surface.

**Recommendation: separate `proposal_delivery_snapshots` table.** The architectural pattern of `report_delivery_snapshots` is the reference; the implementation is independent.

## Share Token Model Recommendation

The canon recommends a **new** future table at Sprint P4:

```
public.proposal_share_tokens
```

Mirrors the architectural pattern of `report_share_tokens` from `docs/22`:

- **Opaque 256-bit token.** `crypto.randomBytes(32).toString("base64url")` → 43-char URL-safe segment. NOT a JWT.
- **SHA-256 hash at rest.** Only `token_hash` is persisted. CHECK constraint enforces `^[a-f0-9]{64}$`. The raw token is shown to the operator exactly once via the action's return value.
- **14-day default expiry.** Matches the report-side default.
- **30-day max expiry.** Matches the report-side cap. CHECK constraint at DB level enforces `expires_at > created_at`.
- **Revocation.** Immediate flip to `status = 'revoked'` with `revoked_at`, `revoked_by`, `revoke_reason`. Audit trail preserved.
- **Access logging.** `access_count` + `last_accessed_at` + `proposal_share_token_accessed` activity event with sanitized metadata. Same pepper rule as report-side (`SLATE_SHARE_TOKEN_ACCESS_PEPPER`).
- **Generic unavailable page** across every blocked state — never leak which condition failed.
- **No raw UUIDs in the public URL.** URL contains the raw token (which is URL-safe by construction) only.
- **No `to anon` RLS policy.** Public route resolves via the privileged server path (`createSupabaseServiceClient()`); RLS stays operator-full.

**Conceptual column shape:**

```
id, workspace_id, engagement_id, proposal_id, snapshot_id,
token_hash, status (active|revoked|expired),
audience_label, recipient_email_hash,
expires_at, created_by, created_by_label, created_at,
revoked_at, revoked_by, revoke_reason,
last_accessed_at, access_count,
metadata, updated_at
```

(identical column count + types to `report_share_tokens`; only the foreign keys differ.)

**URL shape recommendation:** `/p/[token]` for proposal review links. Rationale:

- Short and visually distinct from `/r/[token]` (report links).
- Avoids "proposal" in the URL — a slightly less-leaky URL framing that a tab title or copy/paste does not preview as commercial content.
- Easy to reserve `/s/[token]` later for SOW Draft share if a separate share surface is authorized.

**Do not implement in this sprint.**

### Discussion — reusing `report_share_tokens`?

Considered: extend `report_share_tokens` with a `share_surface: 'report' | 'proposal' | 'sow_draft'` column and route both report and proposal/SOW shares through the same table.

**Rejected.** Same reasoning as the snapshot model — different lifecycle, different cascade rules (proposal voiding may not cascade-revoke proposal tokens the same way report voiding cascade-revokes report tokens, because the "approval" semantics differ), different audit-event vocabulary, different operator-side UI grouping. A shared table conflates audit trails that legal review will eventually want to read separately.

**Recommendation: separate `proposal_share_tokens` table.**

## Commercial Claim Guard

The proposal/SOW commercial guard extends `lib/ai/claim-guard.ts`'s existing 26-pattern scanner with proposal/SOW-specific additions. The shared module exports the existing families:

- `FINANCIAL_CLAIM_PATTERNS` (14 patterns)
- `COMMERCIAL_FINALITY_PATTERNS` (6 patterns)
- `ROADMAP_COMMITMENT_PATTERNS` (6 patterns)

**Proposal/SOW guard extends this set:**

### Already-blocked (reused from existing families)

- `guaranteed savings`, `guaranteed ROI`, `payback`, `break-even`, `will save`, `will reduce cost`, `cash-flow positive`, `top quartile`, `above average`, `industry benchmark`, `peer benchmark`, `finance-approved`, `board-ready ROI`, `guaranteed <financial>` — from `FINANCIAL_CLAIM_PATTERNS`.
- `ready for signature`, `approved by finance`, `final commercial terms`, `binding quote`, `binding offer`, `executed SOW` — from `COMMERCIAL_FINALITY_PATTERNS`.
- `guaranteed completion`, `binding timeline`, `final implementation schedule`, `committed delivery date`, `legally binding timeline`, `binding delivery commitment` — from `ROADMAP_COMMITMENT_PATTERNS`.

### New proposal/SOW-specific patterns to block

- `fixed price` (unless the snapshot's `pricing_review_state = 'workflow_approved'`)
- `final terms`
- `contract accepted`
- `client has agreed`
- `work will begin on <date>`
- `payment due`
- `auto-renewal`
- `cancellation terms`, `cancellation policy` (unless a commercial workflow exists)
- `please sign`, `sign here`, `signature required`
- `legally binding`
- `guaranteed delivery date`
- `guaranteed implementation timeline`
- `I authorize`, `by accepting`, `by signing`
- `effective date <date>` (in a binding-effect context — heuristic: combined with "agreement" or "contract")

### Policy

1. **AI drafting guard remains necessary but not sufficient.** The existing 26-pattern scan at synthesis time catches model-produced violations. The commercial guard re-runs the full extended pattern set at **export time** (snapshot generation) because operators can edit content after synthesis and the synthesis-time guard never re-scans operator edits.

2. **Export-time guard runs over the full scanned-field set:**
   - per-included-option: `title`, `scope_summary`, `timeline`, `best_fit_scenario`
   - per-included-option arrays: every entry of `deliverables[]`, `assumptions[]`, `dependencies[]`, `risks[]`
   - per-included-option: `pricing_placeholder` (always; even if hidden in the render)
   - proposal-level: implementation-credit copy
   - SOW Draft only: the `sow_draft_text` content + the operator-authored footer / disclaimer text

3. **Reviewer notes excluded by default.** Unless a future canon explicitly opts-in a reviewer-note client surface, reviewer notes never reach the snapshot and never reach the guard.

4. **Result shape** (snapshot's `commercial_guard_result` jsonb):
   ```
   {
     scannedFields: string[],
     scannedFieldCount: number,
     patternsApplied: ('financial'|'commercial-finality'|'roadmap-commitment'|'proposal-finality')[],
     patternCount: number,
     violations: { field: string, code: string, patternFamily: string }[],
     passed: boolean,
     scanDurationMs: number,
     version: string
   }
   ```

5. **Failure path:** any violation aborts snapshot generation with a structured error (`commercial-guard-violation`) and an activity event `proposal_snapshot_failed` carrying violation counts only (never the violation text — that would smuggle the banned phrase into the activity log).

## Required Disclaimers / Markings

### Proposal Candidate — client-facing render

Header / above-the-fold:

- **"Proposal discussion draft"** banner (high-visibility, neutral tone, NOT alarmist).

Footer (the proposal-side analog of the report's four-denial footer):

- **"Not a binding quote"**
- **"Not a statement of work"**
- **"Final scope, pricing, and timeline require written approval"**
- **"Not a contract, not an executed SOW, not a financial guarantee, not acceptance of work"** (combined into the closing paragraph)

### SOW Draft — client-facing render

Header / above-the-fold (more emphatic than Proposal Candidate):

- **"Draft SOW · not executed"** banner (high-visibility, distinct from Proposal Candidate styling so the two artifacts read differently at a glance).

Footer:

- **"Requires authorized review and signature"**
- **"Not binding until fully executed"**
- **"Pricing and timeline subject to final approval"**
- **"Not a contract, not an executed SOW, not a financial guarantee, not acceptance of work"** (same closing line as Proposal Candidate; the operator-readable distinction is in the header banner, not the legal closing).

### Client-facing proposal route footer (universal)

Whichever surface (Proposal Candidate, SOW Draft) renders, the closing paragraph must contain all four denials in plain language:

- not a contract
- not an executed SOW
- not a financial guarantee
- not acceptance of work

This is the proposal-side analog of the report-side mandatory four-denial footer (`"not a SOW, not a binding quote, not a financial guarantee, not a contract"`) and is **non-negotiable**.

## Relationship to Report Link MVP

The Client Report Link MVP is the architectural reference pattern. Reuse what worked; do not reuse what shouldn't generalise.

### Reuse — security / hygiene pattern

- **Opaque token, hashed at rest.** Same shape (256-bit base64url + SHA-256 hex). Same CHECK constraint family.
- **No raw UUIDs in URL.** Same shape (`/p/[token]` mirrors `/r/[token]`).
- **Generic unavailable page across every blocked state.** Same body content style: short heading + "Contact the sender" copy + mandatory denial footer. Never leak which condition failed.
- **`noindex,nofollow` + `Cache-Control: no-store` + `Referrer-Policy: no-referrer`.** Apply the same `next.config.mjs` headers entry for `/p/:token*`.
- **`dynamic = "force-dynamic"` + `revalidate = 0` + `fetchCache = "force-no-store"`** at the segment level — the report-side experience proved that Next 14 server-component fetch cache will otherwise leak post-revoke reads.
- **Access logging with peppered IP / UA hashes** via `SLATE_SHARE_TOKEN_ACCESS_PEPPER` env var.
- **Revocation** via cookie-bound operator action + service-role privileged read on the public path.
- **Snapshot-pure rendering** with no live re-query of proposal options.
- **No anonymous RLS policy.** Public-route lookup via `createSupabaseServiceClient()` (server-only) only.

### Do NOT reuse — domain logic

- **Eligibility rules.** Proposal eligibility is commercial-aware; report eligibility is advisory.
- **Snapshot tables.** Separate `proposal_delivery_snapshots`.
- **Share token tables.** Separate `proposal_share_tokens`.
- **Claim guard configuration.** Extended pattern set for proposal/SOW; runs over more fields.
- **Cascade-revoke semantics.** Report-side cascade-revokes tokens when a snapshot is voided; proposal-side may need stricter cascade (e.g. revoking a Proposal Candidate snapshot also voids any in-progress SOW Draft snapshot built on it). The exact cascade rules are a Sprint P2 decision.
- **Disclaimer footer.** Proposal-side carries the proposal-specific four denials; SOW Draft carries the SOW-specific markings.
- **Audience model.** Proposal share may carry a heavier audience-label requirement than report share (e.g. recipient role / signatory identifier optionally captured in the snapshot; Sprint P4 decision).

### Report share eligibility does not imply proposal share eligibility

A report can be share-eligible while no proposal exists. A proposal can be share-eligible without an open report-link share. A client may receive one, the other, both, or neither. Their state is independent.

### Proposal can reference report snapshot — by friendly context, not internal IDs

The proposal snapshot's `source_context_snapshot.reportSnapshotId` is operator-only. The public render says "based on the diagnostic findings shared in your prepared report" — never "report snapshot UUID xyz".

## Client Proposal Route Security

The future `/p/[token]` route mirrors the security posture of `/r/[token]`:

- **Path:** `app/p/[token]/page.tsx`. Anonymous (middleware exempts `/p/*` via the existing `needsSessionRefresh` matcher — falls through to `NextResponse.next()` exactly like `/r/*`).
- **Server component.** No `"use client"`. No client Supabase. No client-side data fetch.
- **No public DB / RLS policy.** Server-side token lookup via `createSupabaseServiceClient()` (server-only).
- **No raw UUIDs in body.** Snapshot-pure render reads only from snapshot jsonb; never inserts `engagement_id`, `proposal_id`, `snapshot_id`, or any other internal UUID into the rendered HTML.
- **Generic unavailable page** across unknown / revoked / expired / voided / ineligible. Identical body. Never leak which.
- **`noindex,nofollow` + `Cache-Control: no-store` + `Referrer-Policy: no-referrer`** via `next.config.mjs` headers entry for `/p/:token*`.
- **Sanitized snapshot payload only.** The Proposal Candidate render shows: title strip, recommended-option summary, included options with sanitized labels, scope / timeline / deliverables / assumptions / dependencies / risks, next steps, optional implementation-credit framing (when authorized), commercial-safety affirmative strip ("Content safety checks passed"), proposal-side mandatory footer. Reviewer notes / operator hints / activity log / claim-guard codes / internal IDs are all absent.
- **No e-signature controls.** No "Sign", "Accept", "Approve", "Agree" buttons. No checkboxes. No form submissions. Pure read-only render.
- **No pricing unless approved.** Hidden by default; rendered with "Estimated · subject to final approval" framing when `pricing_review_state ∈ ('manually_approved','workflow_approved')`.
- **No file storage by default.** Browser print/save is allowed; the route renders HTML, never `302` redirects to a private bucket.

## Prepare Client Review Unlock Policy

`Prepare Client Review` remains locked. **Sprint P5 is the earliest sprint that can unlock it**, and only after every prerequisite below holds:

1. Proposal snapshot model exists (Sprint P2).
2. Proposal eligibility evaluator exists (Sprint P2).
3. Commercial claim guard exists (Sprint P2).
4. Client proposal route (`/p/[token]`) exists (Sprint P5).
5. Proposal share token + revocation + access logging exist (Sprint P4 + P5).
6. At least one approved or operator-selected proposal option exists for the engagement.
7. The required disclaimers are present on the client render (Sprint P5 sign-off).
8. **`Send to Client` is not unlocked simultaneously.** The proposal-review unlock must NOT cascade-unlock the send control.

**The first unlock is a `Generate Proposal Review Link` action**, not an automatic send. The operator copies the public link and delivers it through their own channel. The locked-button rename (`Prepare Client Review` → `Generate Proposal Review Link`) follows the precedent set by the report-side `Export Report` → `Generate PDF Candidate` rename in Sprint 4C-B.

## Prepare SOW Draft Unlock Policy

`Prepare SOW Draft` remains locked. **Sprint P6 is the earliest sprint that can unlock it**, and only after every prerequisite below holds:

1. A non-voided Proposal Candidate snapshot exists for the proposal (Sprint P3 minimum).
2. The Proposal Candidate snapshot is in `approval_state = 'approved'` (Sprint P2 schema + Sprint P3 UI).
3. The operator selects scope / options for the SOW.
4. The SOW draft renderer exists (Sprint P6).
5. The SOW-specific commercial guard (extended pattern set) passes.
6. Pricing and terms are either blank, manual, or carry `pricing_review_state ∈ ('manually_approved','workflow_approved')`.
7. SOW Draft carries the "Draft · not executed" marking + the SOW-specific footer.
8. **E-signature remains locked.** SOW Draft generation does not unlock any signing surface.
9. **`Send to Client` remains locked unless a separate workflow exists.** Same separation rule as `Prepare Client Review`.

The first unlock is a `Generate SOW Draft` action that produces an operator-readable SOW draft document (similar to the existing `/app/engagements/[id]/report/pdf-candidate/[snapshotId]` route on the report side). A separate decision (Sprint P7) governs whether SOW Draft has its own client-facing share route or whether it remains internal-preview-only until executed contracts are in scope.

## Send to Client Unlock Policy

`Send to Client` remains locked **throughout Phase 1B unless every prerequisite below is met AND a separate channel canon authorizes the unlock.** It is the **last control unlocked**, per `docs/22` § Send to Client Unlock Policy.

Prerequisites:

1. A working proposal share route (Sprint P5).
2. Revocation + audit log surfaces operational (Sprint P5).
3. Recipient / audience confirmation flow exists (operator confirms the recipient set before send).
4. **Channel decision made.** Will SLATE send (via email / CRM integration) or will the operator copy a link? Both have very different security / legal surfaces.
5. **Email / CRM canon authored** (a separate canon doc — likely `docs/25_PHASE_1B_SLATE_DELIVERY_CHANNEL_CANON.md` — if SLATE is to send anything at all).
6. **Proposal / SOW compliance review.** Before any send goes live, an operator audit confirms the snapshot payload + guard result + disclaimer markings satisfy commercial review.

**First version should be copy-link / operator-mediated, not auto-email.** SLATE does not send email or push to a CRM in the first Send-to-Client unlock. The operator-mediated copy-link path is the safest first step because it requires zero deliverability infrastructure, zero recipient address validation, and zero outbound-content liability.

## Pricing / Terms Policy

- **`pricing_placeholder` remains a placeholder** until an approved Pricing workflow lands. The column exists today for informational copy; it carries no commercial weight.
- **No AI-generated final price.** The AI synthesis layer (Step 4 — proposal-option drafting) does not produce `pricing_placeholder` values today, and Sprint P2's snapshot pipeline must NOT allow AI to populate or modify any pricing field. Pricing changes are operator-only edits.
- **No taxes / payment / auto-renewal / cancellation terms** unless approved through a future commercial workflow. The commercial guard rejects these patterns at export time.
- **Implementation credits** (the `proposals.implementation_credit` column) remain **informational** until commercial approval exists. The client-facing render may surface implementation-credit copy but must frame it as "commercial planning lever — not an automatic discount" (the exact existing copy in `components/proposals/implementation-credit-panel.tsx`).
- **Fixed-bid language prohibited** unless a pricing approval workflow exists. The commercial guard's new `fixed price` pattern enforces this.
- **If a price is shown, it must be marked Estimated / non-binding.** Sprint P5 (client proposal route) must render `pricing_placeholder` only when `pricing_review_state ∈ ('manually_approved','workflow_approved')`, and even then with explicit "Estimated · subject to final approval" framing inline beside the number.
- **The pricing workflow itself is out of scope** for this canon. A future canon (`docs/26_PHASE_1B_PROPOSAL_PRICING_CANON.md` if it materialises) will define the pricing-approval state machine.

## E-signature / Contract Policy

**E-signature is out of scope for Phase 1B.**

- **No DocuSign / PandaDoc / HelloSign / Adobe Sign / etc. integration in Phase 1B without a separate canon.** The canon doc would minimally cover: the legal model for an "executed" artifact, the audit trail required around signing events, the storage model for signed artifacts (likely a separate private bucket with stricter access controls than the snapshot model), the revocation / supersession semantics for executed agreements, the e-signature service vendor selection / data-residency / audit-export requirements, and the post-signature workflow (contract storage, renewal, amendment).
- **No "sign now" / "accept proposal" / "approve contract" / "I agree" language anywhere on the proposal or SOW Draft surfaces.** The commercial guard enforces this.
- **No checkbox / form-submission controls** on `/p/[token]` or any future SOW route in Phase 1B.
- **Future e-sign canon prerequisites:** a fully-functional Proposal Review Link (Sprint P5) + SOW Draft (Sprint P6) + a Send-to-Client unlock decision (Sprint P8) + an operator-led legal / compliance review.

## Activity / Audit Events

Future event types to be added to `lib/activity/types.ts` when the matching code sprints land. **Do not implement in this canon sprint.**

Sprint P2 / P3 events:

- `proposal_snapshot_generated`
- `proposal_snapshot_failed` (mirroring `report_pdf_candidate_failed` — captures failure reason without smuggling banned text)
- `proposal_snapshot_voided`

Sprint P4 / P5 events:

- `proposal_share_token_created`
- `proposal_share_token_accessed`
- `proposal_share_token_revoked`
- `proposal_share_token_expired`

Sprint P6 / P7 events (SOW Draft):

- `sow_draft_generated`
- `sow_draft_voided`
- `sow_share_token_created` (only if SOW gets a separate share surface — open decision below)
- `sow_share_token_accessed`
- `sow_share_token_revoked`

Sprint P8 events (Send to Client, later only):

- `proposal_sent_to_client` (only if a SLATE-mediated send is authorized)
- `sow_sent_to_client` (only if SOW reaches Send-to-Client scope)

**Activity-event metadata** must follow the report-side hygiene rules:

- No raw token. No token hash. No raw IP / UA (only peppered short-key hashes when configured).
- No banned-claim text in failure event metadata (only counts and codes).
- Sanitised key names that avoid the `FORBIDDEN_KEY_PATTERNS` strip (e.g. `recipientHashPresent: boolean`, not `hasRecipientEmailHash`; `ipSig`, not `ipHash` if the regex stripped it).

## Proposed Sprint Sequence

| Sprint | Title | Scope |
|---|---|---|
| **P1** | Proposal/SOW Delivery Canon | **This sprint.** Authors `docs/24`. No code. |
| P2 | Proposal delivery foundation | `proposal_delivery_snapshots` migration + types/mappers/queries + commercial-guard module (extends `lib/ai/claim-guard.ts`) + proposal eligibility evaluator + `generateProposalCandidateAction` (operator-only; no public route yet; no client send). |
| P3 | Internal proposal candidate route + panel | `app/app/engagements/[id]/proposal/candidate/[snapshotId]/page.tsx` (operator-only, `/app/*`-gated, snapshot-pure render with internal chrome + Draft Candidate watermark for un-approved snapshots) + `<ReportPdfCandidatesPanel>`-style `<ProposalCandidatesPanel>` on `/app/engagements/[id]/proposal` + `voidProposalSnapshotAction`. Activity events: `proposal_snapshot_generated`, `_failed`, `_voided`. **`Prepare Client Review` still locked.** |
| P4 | Proposal share-token foundation | `proposal_share_tokens` migration (mirroring `report_share_tokens` shape) + types/mappers/queries + pure token service (reuses `lib/reports/share-token-service.ts`'s helpers — they are domain-agnostic enough to extract into `lib/share-tokens/`) + proposal share eligibility evaluator + `generateProposalShareLinkAction` returning raw token once. **Generate Proposal Review Link** copy-once button on the Past Candidates panel. **`Prepare Client Review` still locked.** |
| P5 | Public `/p/[token]` proposal review route + Prepare Client Review unlock | `app/p/[token]/page.tsx` (anonymous, snapshot-pure, no internal IDs, generic unavailable across every blocked state, full security headers via `next.config.mjs`) + `components/proposals/client-proposal-share-document.tsx` (sanitized render with proposal-specific footer) + access logging + revoke flow + render-time eligibility re-check + render-time expiry flip. **`Prepare Client Review` unlocks to "Generate Proposal Review Link"** at the end of this sprint. **`Prepare SOW Draft` and `Send to Client` remain locked.** |
| **Audit gate** | Proposal Review Link MVP Acceptance Audit | Mirrors `docs/23`. Sign off on Sprint P2–P5 together before P6 begins. |
| P6 | SOW Draft canon addendum + SOW Draft snapshot | A canon addendum (likely an update to `docs/24` or a new `docs/24A`) clarifies any open SOW questions surfaced by the audit, then ships `proposal_delivery_snapshots.delivery_surface = 'sow_draft_candidate'` generation + internal-preview SOW draft route + the SOW-specific guard extensions. **`Prepare SOW Draft` unlocks to "Generate SOW Draft"** at the end of this sprint. Internal-preview only — no client-facing surface yet. |
| P7 | SOW Draft share route (if approved) | Separate decision: should SOW Draft have its own client-facing share surface, or remain internal-only until executed-contracts are in scope? If approved, ship `/s/[token]` (or reuse `/p/[token]` with a `surface` switch — Sprint P7 decision) + the SOW-specific client render. The Send-to-Client unlock decision is independent of P7. |
| P8 | (optional, later) Send to Client unlock | Requires a separate channel canon (`docs/25_PHASE_1B_SLATE_DELIVERY_CHANNEL_CANON.md` if SLATE is to send) AND a separate operator authorization. First implementation is operator-mediated copy-link, not auto-email. **Last LockedActionButton to be unlocked.** |
| Later | E-signature / CRM integration | Out of Phase 1B scope until at least P8 + a dedicated e-signature canon land. Requires legal / compliance review. |

### Parallel work — not blockers

- **Report-link production hardening backlog** (the five items from `docs/23` carry-forward: pepper config, access debounce, dev-only short-expiry, engagement-title fallback, optional `snapshot_voided` branch consolidation) can run in parallel with Sprint P2–P5 and is independent of the proposal-delivery sequence.
- **Benchmark Gate 1 (`docs/14`)** and **Financial Gate 1 (`docs/15`)** advancement remains separate. They must lift before any Group-B exhibit can appear in a client-bound proposal artifact, but they do not block P1–P5 since Group-B is excluded by canon throughout the proposal-delivery sequence.

## Open Decisions / Operator Approval Needed

The following decisions are explicitly deferred to operator approval before Sprint P2 begins. The canon's recommended defaults stand committed unless overridden.

| Decision | Options | Recommended default |
|---|---|---|
| Proposal public URL shape | `/p/[token]` · `/proposal/[token]` · other | **`/p/[token]`** (short, visually distinct from `/r/`, low-context leakage) |
| One table or two for Proposal Candidate vs SOW Draft | shared `proposal_delivery_snapshots.delivery_surface` enum · separate tables | **shared table with a surface enum**, mirroring the report side's pattern where `report_delivery_snapshots.delivery_surface` distinguishes `internal_candidate` vs `client_pdf_candidate` |
| Proposal share token table | reuse `report_share_tokens` · separate `proposal_share_tokens` | **separate `proposal_share_tokens`** (different cascade rules, different audit-event vocabulary, different legal-review separation) |
| Can pricing appear in Proposal Candidate MVP? | yes, with framing · hidden in MVP | **hidden in MVP unless `pricing_review_state ∈ ('manually_approved','workflow_approved')`**; the `pricing_placeholder` column is captured in the snapshot but the client render omits it |
| SOW Draft in same milestone as Proposal Candidate or separate? | same · separate | **separate milestone (Sprint P6)** after Proposal Review Link MVP Acceptance Audit |
| Client can download / print? | yes · no | **yes — browser print/save allowed**, no PDF binary stored, no signed-URL download endpoint |
| Recipient email hash used? | required · optional · not at all | **optional**, mirroring the report-side `recipient_email_hash` column. Operator-configurable per token. |
| SLATE sends email vs copy-link only? | SLATE sends · copy-link only | **copy-link only in first implementation.** No SendGrid / SES / Mailgun / CRM integration. Operator hand-delivers the URL. |
| Can proposal route reference report snapshot? | yes by internal ID · yes by friendly context · no | **yes by friendly context** ("based on the diagnostic findings shared in your prepared report"), never by internal ID |
| Implementation credit in client artifact? | shown · hidden | **hidden until commercial approval workflow exists.** When eventually shown, frame as "commercial planning lever — not an automatic discount" (existing canonical copy). |
| Recipient role / signatory identifier capture? | required · optional · not at all | **optional**, captured in snapshot `audience_label` (operator-visible only) |
| Cascade-revoke proposal tokens on snapshot void? | yes (mirror report side) · no | **yes**, mirror report side's cascade-revoke-on-void with `revoke_reason='snapshot_voided'`. SOW-Draft-side cascade is a Sprint P6 decision. |

## Non-Goals

This canon sprint authorizes **none** of the following:

- No implementation of any proposal / SOW delivery surface.
- No schema changes / migrations.
- No API routes.
- No new public route (`/p/[token]` is recommended but not authorized by this sprint).
- No `Send to Client` unlock.
- No `Prepare Client Review` unlock.
- No `Prepare SOW Draft` unlock.
- No e-signature integration.
- No CRM / email integration.
- No PDF binary generation.
- No PDF / artifact storage bucket.
- No new package dependency.
- No Group-B wiring beyond what already exists in `/app/charts-preview` (still confined to those four files).
- No `docs/14` or `docs/15` gate advancement.
- No AI synthesis change.
- No report-link change (the existing `/r/[token]` route and its dependencies are untouched by this canon).

## Acceptance Criteria

This canon sprint is accepted when:

1. **`docs/24_PHASE_1B_PROPOSAL_SOW_DELIVERY_CANON.md` exists** with every required section.
2. **Proposal vs SOW artifact definitions are clear** — § Artifact Definitions distinguishes Proposal Candidate (discussion artifact) from SOW Draft (formal scope artifact, still non-binding) from Executed SOW (out of scope).
3. **Proposal eligibility rules defined** — § Proposal Eligibility Rules enumerates 13 conditions including persisted UUID, recommended-option requirement, commercial-guard pass, and Group-B exclusion.
4. **SOW eligibility rules defined** — § SOW Eligibility Rules enumerates the 11 stricter conditions stacked on top of proposal eligibility.
5. **Snapshot model recommendation defined** — § Snapshot Model Recommendation enumerates the future `proposal_delivery_snapshots` columns and explicitly rejects reusing `report_delivery_snapshots`.
6. **Share-token model recommendation defined** — § Share Token Model Recommendation enumerates the future `proposal_share_tokens` shape (mirror of `report_share_tokens`) and the `/p/[token]` URL recommendation.
7. **Commercial claim guard policy defined** — § Commercial Claim Guard names the existing 26 patterns to reuse plus 15 new proposal-finality patterns, and defines the run-time policy (export-time scan over the full field set).
8. **Required disclaimers / markings defined** — § Required Disclaimers / Markings provides both the Proposal Candidate four-denial footer AND the SOW-specific "Draft · not executed" markings.
9. **Unlock policies defined** for `Prepare Client Review` (Sprint P5), `Prepare SOW Draft` (Sprint P6), and `Send to Client` (Sprint P8, last).
10. **Pricing / terms policy defined** — § Pricing / Terms Policy locks `pricing_placeholder` as informational, forbids AI-generated final pricing, and gates fixed-bid language on a future pricing-approval workflow.
11. **E-signature boundary defined** — § E-signature / Contract Policy puts e-sign out of Phase 1B scope and lists future-canon prerequisites.
12. **Sprint P1 → P8 sequence defined** — § Proposed Sprint Sequence with explicit boundaries at the Sprint P5 audit gate and the Sprint P8 channel-canon prerequisite.
13. **Open decisions listed with recommended defaults** — 12 decisions enumerated in § Open Decisions.
14. **`docs/08` and `docs/10` updated** — landing note + revised "Recommended Next Step" + handoff narrative.
15. **No source / schema / API / package / public / storage / PDF / email / CRM / middleware / next.config changes.** `git status --short` after this sprint shows only `docs/08`, `docs/10`, `docs/24` modified (`docs/24` added).

## Pointer-Forward

**Future Proposal/SOW implementation agents must treat `docs/24` as source of truth.** Sprint P2 through Sprint P7 (and Sprint P8 if it ever runs) consume this canon for:

- the snapshot schema shape;
- the eligibility rules at generation time;
- the commercial guard pattern set + scanned-field surface;
- the share-token URL recommendation;
- the required disclaimer copy;
- the unlock prerequisites for `Prepare Client Review` / `Prepare SOW Draft` / `Send to Client`;
- the pricing / terms / e-signature boundaries.

**Deviations require canon amendment before code lands.** If a Sprint P2+ implementation discovers that one of this canon's defaults is wrong (e.g. the recommended URL shape collides with an existing route, or a commercial guard pattern proves too strict and blocks legitimate operator copy), the canon must be updated FIRST — via an addendum doc or a `docs/24` edit accompanied by a sign-off note — before the deviating code is authored.

The same pointer-forward discipline that drove `docs/19` → Sprint 4A–4D-C applies here. Canon precedes code.

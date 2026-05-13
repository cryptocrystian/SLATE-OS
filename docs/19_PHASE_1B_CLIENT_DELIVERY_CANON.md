# Phase 1B Client Delivery Canon

## Status

- **Date:** 2026-05-13.
- **Branch:** `persistence/step-0-1-auth-shell`.
- **Sprint scope:** **Sprint 4A — canon only.** This document is documentation. No source code, schema, migration, API route, package, export pipeline, share-link infrastructure, AI synthesis change, chart primitive, or storage policy is created or modified by this sprint.
- **No implementation is authorized by this canon.** Future sprints must consume this document as the source of truth for client-facing delivery boundaries; deviations require a canon amendment before code.
- **Client-facing delivery remains locked.** The internal print preview at `/app/engagements/[id]/report/print` is operator-only and stays operator-only until a sprint approved against this canon advances it.
- **All existing `LockedActionButton` controls remain locked.** `Export Report`, `Prepare Report`, `Prepare SOW Draft`, `Send to Client`, and `Prepare Client Review` are unchanged. Sprint 4A does not unlock any of them.
- **Group-B exhibits remain preview-only.** Benchmark Comparison Bars, AI-Savings Waterfall, and ROI Bridge stay confined to `/app/charts-preview` until their gating canons (`docs/14`, `docs/15`) advance.
- **Audit references:** `docs/16_PHASE_1B_PREVIEW_LIBRARY_ACCEPTANCE_AUDIT.md`, `docs/18_AI_SYNTHESIS_STEPS_3_5_ACCEPTANCE_AUDIT.md`, `artifacts/walkthroughs/sprint-3-print-preview/walkthrough-notes.md`.

---

## Why This Exists

Phase 1B Report Exhibit Wiring Sprint 3 (`docs/17`, commit `454adc1`) shipped an operator-only internal browser-print preview at `/app/engagements/[id]/report/print`. The Sprint 3 walkthrough (2026-05-13) confirmed the route renders all canonical chrome correctly: internal banner, identity card with engagement-id + report-id codes, Group-A exhibit area, honest insufficient-data fallback cards, and a `GROUP B OMITTED` notice naming the three gated exhibits. The route is intentionally operator-internal — it relies on browser Save-as-PDF, stores nothing, and exposes nothing.

Moving from this internal preview to **any** form of client-facing delivery introduces a new class of risks that the existing canons (`docs/13`, `docs/14`, `docs/15`, `docs/17`, `docs/18`) do not yet address as a coherent boundary:

1. **Unsupported claims.** A consulting-grade exhibit looks credible. Once a report leaves operator hands, every benchmark percentile, ROI bridge band, and savings waterfall column becomes a claim the firm has to stand behind. The Gate-0 framing in `docs/14` / `docs/15` is sufficient for the operator preview but insufficient for client delivery.
2. **Public / share access control.** Internal preview is protected by the `/app/*` auth boundary inherited from middleware. The moment a delivery surface emits a tokenized URL or a public-bucket signed link, the access-control model changes — tokens must be scoped, expirable, revocable, audit-logged, and unindexable.
3. **Data leakage.** Operator-only context (Saipien Fit Score, internal review notes, raw stakeholder PII, internal `lib/leads/derive.ts` outputs, AI run rows) must never appear in a client-bound artifact. The internal preview deliberately exposes some of these fields because the audience is the operator.
4. **Stale report content.** Persisted rows mutate between report assembly and client delivery. An exported PDF rendered before the latest opportunity score landed is misleading. The delivery boundary must declare a snapshot / versioning rule before any export ships.
5. **Light / dark print quality.** The internal preview is dark-themed (matching the app) and the polish backlog from the Sprint 3 walkthrough documented that chart SVGs print as dark grey bands. Client-facing PDFs require a light-theme readability pass for Group-A charts before that workstream can be authorized.
6. **Final approval workflow.** Today's report has section-level status (`drafted` / `needs_review` / `approved` / `final`) but no report-level "ready for delivery" approval. Sprint 3 surfaced the boundary; client delivery must add a report-level approval gate so an in-progress report is never exportable to a client by accident.
7. **SOW / commercial terms confusion.** Proposal-side `LockedActionButton` controls (`Prepare SOW Draft`, `Send to Client`, `Prepare Client Review`) sit on a separate commercial workflow that overlaps with delivery but is governed by different rules — pricing placeholder preservation, implementation credit framing, no AI-generated binding language. A report-delivery sprint must not accidentally enable SOW delivery.
8. **Auditability.** Every client-bound artifact needs to be reconstructable after the fact: who generated it, against which engagement / report ID, with which exhibits, at which timestamps, using which adapter source summaries. The current `ai_synthesis_runs` + `activity_events` model is operator-side; a delivery audit trail must add new event types without modifying the existing ones.

This canon defines the governance and sequencing required before Sprint 4B (light-theme polish), Sprint 4C (client-safe report PDF candidate), and Sprint 4D (controlled client-facing delivery) can be authorized. It deliberately separates each delivery surface so an implementing sprint cannot conflate them.

---

## Current Delivery State

This is the state of every delivery-adjacent surface in SLATE as of 2026-05-13.

| Surface | State | Notes |
|---|---|---|
| `/app/engagements/[id]/report/print` | Operator-only internal preview | Server-rendered, server-side `/app/*` auth-gated, persisted-UUID only, Group-A only, Group-B explicitly omitted, no client access, no public surface. |
| Browser Save-as-PDF from the print route | Operator-controlled, manual | The operator invokes the browser's print dialog; SLATE never generates a PDF binary. Documented manual flow lives in `artifacts/walkthroughs/sprint-3-print-preview/walkthrough-notes.md`. |
| Generated PDF artifacts | None stored | SLATE neither produces nor stores PDFs. There is no `pdfs` bucket, no `report_pdfs` table, no `puppeteer` / `playwright` / `@react-pdf/renderer` / `jspdf` dependency in `package.json`. |
| Public client share link | None | No share-link route exists. No tokenized URL pattern exists. No `share_tokens` table exists. |
| Client-facing send / share UI | None | No "Send" action wired anywhere outside the locked `Send to Client` chip on the proposal page. |
| `Export Report` `LockedActionButton` | Locked verbatim | On `/app/engagements/[id]/report`. Chip reads `Locked`. No future-sprint label change made. |
| `Prepare Report` `LockedActionButton` | Locked verbatim | On `/app/engagements/[id]/roadmap` when no items exist (auto-flips between locked + active depending on roadmap content per the existing recommended-action helper). The locked state remains canonical. |
| `Prepare SOW Draft` `LockedActionButton` | Locked verbatim | On `/app/engagements/[id]/proposal`. Sibling to `Send to Client`. |
| `Send to Client` `LockedActionButton` | Locked verbatim | On `/app/engagements/[id]/proposal`. |
| `Prepare Client Review` `LockedActionButton` | Locked verbatim | Header CTA on `/app/engagements/[id]/proposal`. |
| Group-A exhibits | Eligible to render in report + print preview | Wired by `docs/17` Sprints 1 / 2 / 2.1 / 3. Adapter freshness pipeline established. Insufficient-data fallback cards render honest copy without sample data. |
| Group-B exhibits | Preview-only | `Grep` for `BenchmarkComparisonBars\|AISavingsWaterfall\|RoiBridge` returns exactly four files — the three exhibit components themselves plus `app/app/charts-preview/page.tsx`. No report / proposal / public-scorecard / print / API consumer exists. |
| Public scorecard route | Separate surface | `/scorecard/*` operates under its own type-narrowed `PublicScoreResult` boundary (`lib/scorecard/public-result.ts`) and never reads / writes engagement / report / proposal rows. |
| Stakeholder intake route | Token-gated | `/intake/[token]` accepts stakeholder responses through a short-lived signed token. Asset uploads land in a private 10 MiB bucket through server-only helpers. No report / proposal / delivery surface is exposed. |

**The implication:** there is currently zero client-facing delivery surface in SLATE. Sprint 4A is defining a boundary against a clean slate.

---

## Delivery Surface Taxonomy

This canon recognizes six distinct delivery surfaces. Each has a different risk profile and a different gating story. An implementing sprint **must** name which surface it is targeting, and **must not** silently combine two surfaces into a single change.

### 1. Internal preview route — current

- **State:** shipped (`docs/17` Sprint 3).
- **Path:** `/app/engagements/[id]/report/print`.
- **Audience:** operator only.
- **Access control:** `/app/*` middleware-gated session.
- **Storage:** none. SLATE never persists a print snapshot.
- **Claim posture:** internal Group-A only; Group-B exhibits explicitly omitted by render path; insufficient-data fallback cards render honest copy.
- **Risk level:** **low** — same boundary as the rest of `/app/*`.

### 2. Internal generated PDF artifact — future

- **State:** not built. Not authorized by this canon.
- **Audience:** operator only.
- **Storage:** private if any storage is added; never public; never client-shareable.
- **Purpose:** operator-only archive or review-quality print that doesn't depend on the browser's Save-as-PDF dialog.
- **Risk level:** **medium** — introduces a server-side render pipeline and possibly a storage bucket. Without a client-facing leg, the only new risk is whether the PDF leaks operator-only context if accidentally shared.

### 3. Client-facing report PDF — future

- **State:** not built. Not authorized by this canon.
- **Audience:** client (named recipient or controlled distribution).
- **Storage:** private with audited generation events; if delivered as a downloadable file, the operator downloads and forwards through their own channels OR a controlled signed-URL delivery is canonized later.
- **Risk level:** **high** — introduces all of (a) claim-safety enforcement, (b) snapshot / versioning, (c) approval gates, (d) Group-B exclusion enforcement at the export-pipeline boundary, (e) light-theme rendering.
- **Required gates before any work begins:** R2 in the report-readiness ladder below; explicit operator authorization; Sprint 4B light-theme work landed; this canon untouched or amended deliberately.

### 4. Client-facing share link — future

- **State:** not built. Not authorized by this canon.
- **Audience:** client (recipient holding a tokenized URL).
- **Storage:** the artifact (PDF or view) lives behind a signed token; the token is the access control.
- **Risk level:** **highest in the canon** — introduces all the risks of surface 3 plus tokenization, expiry, revocation, audit trail, and search-engine indexing exposure.
- **Required gates:** R3 in the report-readiness ladder; a separate share-token canon document; operator authorization; this canon amended or superseded.

### 5. Proposal / SOW document — future

- **State:** not built. Not authorized by this canon.
- **Audience:** client.
- **Scope:** the commercial leg of the engagement. Pricing placeholders, implementation credit framing, recommended-option preservation, no AI-generated binding language.
- **Risk level:** **high and orthogonal** — overlaps with the report-delivery surfaces but is governed by different rules. This canon explicitly does **not** authorize proposal delivery; a separate proposal-delivery canon is required.
- **Required gates:** a dedicated `docs/20_PHASE_1B_PROPOSAL_DELIVERY_CANON.md` (not authored by Sprint 4A); explicit operator authorization; this canon untouched.

### 6. E-signature — future, separately authorized

- **State:** not built. Not authorized by this canon.
- **Audience:** client + operator (counterparty signing flow).
- **Scope:** binds a SOW or contract to a signed acceptance.
- **Risk level:** **out of current Phase 1B implementation scope.**
- **Required gates:** all of (a) the proposal-delivery canon landed; (b) a dedicated e-signature / CRM canon authored; (c) the locked `Send to Client` chip already unlocked through a sprint that owns the broader commercial workflow; (d) explicit operator authorization to extend Phase 1B's boundary.

---

## Locked Control Policy

The four `LockedActionButton` instances in SLATE today (`Export Report`, `Prepare Report`, `Prepare SOW Draft`, `Send to Client`) plus the `Prepare Client Review` header chip on the proposal page are the canonical "this is not yet a real action" surface. They **must** remain locked until the conditions below are met. This canon does not unlock any of them.

### `Export Report`

- **Current location:** `/app/engagements/[id]/report` (header action row, alongside the new `Internal preview PDF` ghost button).
- **Unlock prerequisites:**
  - Sprint 4B (light-theme palette for Group-A charts + report-side print readability pass) landed and accepted.
  - Sprint 4C (client-safe report PDF candidate) landed and accepted — Group-A only, no Group-B unless `docs/14` / `docs/15` advance.
  - Report at R2 readiness (definition below); approved-or-final section status enforced or explicitly accepted.
  - Internal preview accepted as the baseline shape; the client-facing export must not silently differ in content.
  - The internal preview button is **not** repurposed as the client-export button; they are separate controls.
- **Anti-pattern to avoid:** unlocking `Export Report` by re-pointing it at the internal print route. The two controls answer different questions; conflating them is a canon breach.

### `Prepare Report`

- **Current location:** `/app/engagements/[id]/roadmap` header. Auto-flips between locked and active based on whether roadmap items exist (existing recommended-action helper behavior).
- **Unlock prerequisites:**
  - A report-readiness workflow is canonized (this canon's report-readiness gates plus any additional report-status workflow that an implementing sprint authors).
  - The control **does not** become equivalent to the internal preview link. "Prepare Report" must indicate that the report is being prepared for delivery, not that it has been opened for review.
- **Anti-pattern to avoid:** conflating `Prepare Report` with the existing `Internal preview PDF` button. The latter is a render; the former is a workflow step.

### `Prepare SOW Draft`

- **Current location:** `/app/engagements/[id]/proposal` (in-detail action row, alongside `Send to Client`).
- **Unlock prerequisites:**
  - A dedicated proposal / SOW canon exists (out of scope for Sprint 4A).
  - Commercial terms guardrails defined: pricing placeholders preserved as today, implementation credit framing preserved, recommended option preservation preserved, no AI-generated binding language.
  - The SOW pipeline runs `lib/ai/claim-guard.ts`'s `COMMERCIAL_FINALITY_PATTERNS` + `FINANCIAL_CLAIM_PATTERNS` at the export boundary deterministically.
  - The unlock is part of a proposal-delivery sprint, not a report-delivery sprint.

### `Send to Client`

- **Current location:** `/app/engagements/[id]/proposal` (in-detail action row).
- **Unlock prerequisites:**
  - The export, share, and audit canons all exist.
  - An approval gate exists that an operator must affirm before send.
  - An access policy exists for the share / send target (email recipient? signed URL? CRM-mediated delivery?).
  - An audit event type exists that records the send and the artifact identity (snapshot id, exhibit slot list, generated-at timestamp, operator identity).
- **Anti-pattern to avoid:** unlocking `Send to Client` before any of the prerequisites land. **`Send to Client` should be the last control unlocked, not the first.**

### `Prepare Client Review`

- **Current location:** `/app/engagements/[id]/proposal` (header CTA, locked variant).
- **Unlock prerequisites:** part of the proposal-delivery workflow; tracks `Prepare SOW Draft` + `Send to Client` rather than the report path. Same anti-pattern: do not silently re-point this control at the internal preview.

### Canonical anti-patterns (apply to every locked control)

- Unlocking a control by re-pointing it at an internal-only surface.
- Unlocking a control with a feature flag rather than a sprint-bound canon change.
- Removing a `LockedActionButton` in a non-delivery sprint (a "cleanup" commit).
- Adding a sibling control that bypasses the locked-state contract.
- Surfacing a "Beta" or "Preview" client-facing label on what is still an internal control.

---

## Report Readiness Gates

Client-facing report delivery progresses through four readiness gates. Each gate **must** be satisfied before the gate after it can be entered. The current state of SLATE is **Gate R0** for every persisted engagement.

### Gate R0 — Internal preview only (current state)

- The report can be rendered to `/app/engagements/[id]/report/print` for operator review.
- The internal preview banner ("INTERNAL PREVIEW · NOT CLIENT-FACING") is required and present.
- The internal preview is dark-themed by default (matches the app).
- Group-A exhibits render where data is sufficient; honest insufficient-data fallback cards render otherwise.
- Group-B exhibits are explicitly omitted; the `GROUP B OMITTED` card explains the omission.
- No client artifact is produced.
- No locked control is unlocked.

### Gate R1 — Internal PDF candidate

- A server-side render pipeline produces a PDF intended for **operator-only** distribution.
- A light-theme / readability pass for Group-A charts has landed (Sprint 4B scope).
- The PDF identifies itself as internal in the artifact chrome (footer / cover page / metadata).
- Group-A only. Group-B remains explicitly omitted.
- The artifact may be stored privately if storage is part of the implementation sprint.
- The internal preview UI remains operator-only and continues to honor `/app/*` auth.
- Operator review of the Gate R1 artifact is required before any Gate R2 sprint is authorized.

### Gate R2 — Client-safe PDF candidate

- The report's sections are **approved** or **final** — or the operator explicitly accepts a draft-state export and the artifact carries a visible "draft" marker.
- A final operator approval step exists on the report before the artifact can be produced.
- Stale-data warnings (per the adapter freshness pipeline from `docs/17` Sprint 2.1) are either resolved or explicitly accepted on the artifact.
- Group-B is excluded unless `docs/14` has advanced to Gate 1+ (Benchmark Comparison Bars) and `docs/15` has advanced to Gate 1+ (AI-Savings Waterfall) / Gate 1+ (ROI Bridge), AND a separate sprint approves wiring at the corresponding tier.
- A deterministic prohibited-claim scan runs against the report content immediately before export. The scan reuses `lib/ai/claim-guard.ts`'s `FINANCIAL_CLAIM_PATTERNS` (14) and `COMMERCIAL_FINALITY_PATTERNS` (6) at a minimum. Implementation must add a section-content scan if the rich-text section body model has landed by then; otherwise the existing scalar `summary` + `draft_preview` + `evidence_notes` columns are scanned.
- The artifact is operator-only at generation time. Delivery is **not** authorized at R2 — only the artifact itself.

### Gate R3 — Client delivery enabled

- An audit event is logged at delivery time. Event type is new (not a repurposed `ai_synthesis_run` or `report_section_status_changed`) and records: artifact id, engagement id, report id, section ids included, exhibit slots included, generated-at timestamp, delivered-at timestamp, operator id, delivery channel.
- A snapshot / versioning strategy is in place (see "Content Snapshot / Versioning Rules" below).
- If delivery is through a share link, the share-token policy (defined below) is in place: token, expiry, revocation, audit trail, no indexing, no raw asset URLs.
- The corresponding `LockedActionButton` is intentionally unlocked **only** in the sprint that completes the R3 gate — not as a side-effect of earlier work.
- An operator-facing "intentional delivery" affordance exists: the delivery action requires an explicit second confirmation step, not just a single-click unlock.

### Out-of-band rule

A report **may not** advance to a later gate by accident — every gate transition is a sprint-bound, canon-amending change. A backslide (e.g., from R2 to R1 because Group-B was almost wired but stopped short) is preferable to a silent advance.

---

## Exhibit Inclusion Rules

### Group A — eligible for client-safe PDF after R2

- The five Group-A exhibits (Executive Summary 2×2, Risk-Adjusted Priority Quadrant, Capability Maturity Heatmap, Stakeholder Coverage Matrix, Roadmap Gantt with Dependencies) **may** be included in a client-facing PDF after R2 readiness is established.
- An exhibit is included only when its adapter returns `status: "ready"` against the snapshotted data. `insufficient_data`, `invalid_data`, and `gated` states are handled per the fallback rule below.
- The exhibit's `sourceSummary` (source label + row count + generated-at) is rendered in the artifact alongside the exhibit so the claim is sourced.

### Group-A fallback policy

When a Group-A adapter is **not** `ready` at export time, the client-facing artifact has two acceptable paths:

1. **Omit the exhibit from the client PDF.** The corresponding section renders as text-only.
2. **Render the exhibit slot with the canonical insufficient-data card.** The card's copy is the same operator-facing copy from `components/reports/report-exhibit-slots.tsx` but **must** be rephrased so it does not reference operator-only edit paths (e.g., remove "deep link to `/app/engagements/[id]/intake`").

**Default recommendation: omit.** A client-facing artifact should not surface "you need to tag findings with `(capability, dimension)`" to a client. The operator should resolve the data gap before export, not ship the gap. The render-with-fallback path is acceptable as an explicit operator override, not as a default.

This decision is canon. Implementing sprints must implement omit-by-default and add an explicit operator opt-in to render fallback cards in the client artifact.

### Group B — gated, must not appear in client artifacts

The three Group-B exhibits remain gated by `docs/14` (Benchmark Comparison Bars) and `docs/15` (AI-Savings Waterfall, ROI Bridge).

- Group-B exhibits **MUST NOT** appear in any client-facing PDF, share link, or any other client-bound surface under this canon.
- Group-B exhibits **MUST NOT** be included as fallback cards in client artifacts — the very presence of a "Benchmark data not yet validated" card in a client-facing PDF is the kind of inadvertent claim this canon exists to prevent.
- Group-B exhibits **MAY** continue to appear at `/app/charts-preview` (operator-only).
- Group-B exhibits **MAY** appear in the operator-only internal preview at `/app/engagements/[id]/report/print` if and only if a future sprint deliberately wires them under their corresponding gate advancement — Sprint 3 today honors the omission.
- A future sprint that wants to wire a Group-B exhibit into any client-bound surface **must** first land a Gate-advancement sprint against `docs/14` or `docs/15`, then must amend this canon, then may add the wiring.

### No illustrative source notes in client artifacts

The Gate-0 illustrative source-note strings (`"Source: Illustrative sample data · not a financial model"`, `"Source: Illustrative sample data · not a benchmark study"`) are operator-only. They **must not** appear in any client-facing artifact. An export pipeline that produces a client artifact must either:

- Refuse to export when an illustrative source note would render (preferred), or
- Strip the exhibit entirely from the client artifact before render.

### Prohibited client-facing claim language

The following phrases **must not** appear in any client-facing artifact unless an explicit gate advancement authorizes them:

- "industry benchmark," "peer benchmark," "top quartile," "above average" — gated by `docs/14`.
- "ROI," "payback," "break-even," "guaranteed savings," "will save," "will reduce cost," "cash-flow positive" — gated by `docs/15`.
- "ready for signature," "binding quote," "executed SOW," "approved by finance," "final commercial terms," "binding offer" — gated by the future proposal-delivery canon.
- "guaranteed completion," "binding timeline," "committed delivery date," "legally binding timeline," "final implementation schedule," "binding delivery commitment" — gated by the future proposal-delivery canon.

These phrases are exactly the patterns enforced by `lib/ai/claim-guard.ts` (`FINANCIAL_CLAIM_PATTERNS` (14), `COMMERCIAL_FINALITY_PATTERNS` (6), `ROADMAP_COMMITMENT_PATTERNS` (6) — 26 patterns total). The delivery pipeline **must** rerun the scan at the export boundary in addition to the AI-synthesis-time scan, because operator-edited content does not pass through the AI synthesis path and therefore is not scanned today.

---

## Claim Safety Rules

The claim-safety contract for client-facing delivery is:

1. **Benchmark claims** require `docs/14` Gate 1 (`internal_directional`) or Gate 2 (`validated`) — and a sprint that approves wiring at the corresponding tier — before any benchmark exhibit or benchmark phrase reaches a client artifact.
2. **Financial claims** require `docs/15` Gate 1 (`operator_estimated`), Gate 2 (`client_validated`), or Gate 3 (`finance_approved`) — and a sprint that approves wiring at the corresponding tier — before any financial exhibit or financial phrase reaches a client artifact. Phrases like "payback," "break-even," and "ROI" are gated specifically on Gate 3.
3. **Commercial finality claims** are gated by the future proposal-delivery canon. No client artifact this canon authorizes may include them.
4. **Roadmap-commitment claims** are gated by the future proposal-delivery canon. No client artifact this canon authorizes may include them.
5. **AI-generated content** is always subject to operator review before it can appear in a client-bound artifact (see "AI-Drafted Content Rules" below).
6. **A deterministic prohibited-claim scan** must run at export time, immediately before the client artifact is rendered. The scan reuses `lib/ai/claim-guard.ts` and adds a content-source argument distinguishing operator-authored from AI-authored content (because the operator may, in principle, type prohibited phrases manually — the scan should reject them either way for client-bound content).

References:
- `lib/ai/claim-guard.ts` — the 26-pattern shared scanner.
- `docs/14_PHASE_1B_BENCHMARK_DATA_CANON.md` — benchmark gating.
- `docs/15_PHASE_1B_FINANCIAL_ASSUMPTIONS_CANON.md` — financial gating.
- `docs/18_AI_SYNTHESIS_STEPS_3_5_ACCEPTANCE_AUDIT.md` — per-step claim-scan coverage.

---

## Content Snapshot / Versioning Rules

A client-bound artifact **must** reflect a stable point-in-time state. Persisted rows mutate; an exported PDF rendered against live rows can drift between generation and delivery. The desired future behavior is:

1. **The artifact carries an explicit snapshot identifier.** A new entity (e.g., `report_delivery_snapshots`) is created at generation time; the client artifact references it.
2. **The snapshot records:**
   - `report_id` and `engagement_id`.
   - The full list of `report_sections.id` plus each section's `updated_at` at snapshot time.
   - The list of `report_sections.exhibit_slot` values rendered.
   - The adapter `sourceSummary` for each rendered exhibit, including `rowCount`, `generatedAt`, and `freshness`.
   - The artifact's own `generatedAt`, `generatedBy` (operator profile id), and `artifactType` (e.g., `internal_pdf`, `client_pdf`).
   - The `claim_guard` scan result (clean / violations-with-codes; rejection blocks generation).
3. **Internal preview does not require a snapshot.** The browser Save-as-PDF flow is operator-controlled and ephemeral; the operator is implicitly trusted with current-state data.
4. **Client delivery must not depend on live-mutating rows after generation** unless a version strategy explicitly allows post-export updates (this is out of scope for Sprint 4A; future sprints may canonize a "regenerate-on-update" or "freeze-and-republish" rule).
5. **Snapshot retention:** out of scope for this canon. A future sprint may specify retention windows; without one, retain indefinitely under engagement-scoped RLS.

This canon does **not** implement the snapshot model. A future Sprint 4C must author the schema and wiring.

---

## Access Control Rules

### Internal preview

- Internal preview at `/app/engagements/[id]/report/print` remains gated by the existing `/app/*` middleware session.
- No tokenized access, no public bucket, no signed-URL pattern is required for the internal preview.

### Generated client artifact (PDF)

- A generated client artifact **must not** be publicly accessible by default.
- If stored in Supabase Storage, the bucket **must** be private and the artifact path **must not** include a guessable identifier (use UUIDs, not engagement slugs).
- The artifact is downloadable by the operator who generated it (or any operator in the workspace, per existing RLS) through an authenticated route — no public URL.
- A client delivery channel that hands the artifact to the client (e.g., email-with-attachment, CRM-mediated send) is the canonical path; SLATE delivers the artifact to the operator, who delivers it to the client.

### Share link (if and when authorized)

If a sprint canonizes a share-link delivery later, the share-link contract **must** include:

- **Token:** opaque, unguessable, scoped to a single snapshot, single recipient identity.
- **Expiry:** short-lived (recommended ≤ 14 days; canonized at share-link sprint time).
- **Revocation:** the operator can revoke a token at any time; revocation propagates immediately.
- **Audit trail:** every token issuance, access, and revocation is logged as an activity event under a new event type.
- **No indexing:** the share-link route is excluded from search engines via `X-Robots-Tag` + a `<meta name="robots" content="noindex,nofollow">` injection.
- **No raw asset URLs:** the share-link page **must not** embed `storage.objects` signed URLs that themselves are dereferencable without the share token; assets are proxied through the share-link route with the same token check applied.

This canon does **not** authorize the share-link surface. A separate canon must be authored before any share-link sprint can begin.

### Public scorecard remains separate

- `/scorecard/*` already uses a `PublicScoreResult` boundary that strips operator-only fields. No report / proposal / delivery data is exposed by the public scorecard surface.
- Any future implementation of the surfaces above **must not** widen the public scorecard contract.

---

## Storage Rules

- **No generated PDFs are stored today.** SLATE has no `report_pdfs` table, no `pdfs` bucket, no PDF binary in any storage path.
- **Future storage must be private by default.** Any storage bucket added for client-bound artifacts must be private at creation; public buckets are a canon breach.
- **No public bucket for client reports** unless a signed-token delivery canon is approved and the bucket is paired with a token-aware proxy layer.
- **Signed URLs must be short-lived.** Existing pattern (5-minute signed URLs through `/api/app/assets/[id]/download` for engagement documents) is the canon reference for signed-URL lifetime. A future client-artifact pipeline that uses signed URLs **must not** extend the TTL beyond 15 minutes without canon amendment.
- **Audit events should record generation and download.** A `client_artifact_generated` event type (canonized at the implementing sprint) records generation; a `client_artifact_downloaded` event type records each download. Existing AI event types (`ai_synthesis_*`, `ai_*_drafted`, `ai_synthesis_failed`) and existing activity event types (`roadmap_item_created`, `report_section_status_changed`, etc.) **must not** be repurposed for delivery events.

---

## Light-Theme / Print Quality Rules

- **Dark internal print is acceptable for operator review.** Sprint 3 ships dark-themed print output by default (matching the app theme); the Sprint 3 walkthrough documented chart SVGs printing as dark grey bands. That tradeoff is acceptable for operator-only use.
- **Client-facing PDFs require a light-theme / readability pass.** Sprint 4B is the dedicated workstream for this.
- **Group-A charts need print-safe palette and contrast rules** before any client-facing PDF can ship. The Sprint 4B canon (not authored here) is expected to define the light-theme token mapping for `--brand-primary`, `--practice-ai`, the four `--status-*` tokens, and the heatmap/quadrant color bands.
- **Group-B charts remain out of scope** for the light-theme pass under this canon. When `docs/14` / `docs/15` gates advance, the light-theme work for Group-B is a separate sprint.
- **Browser header / footer instructions** (Ctrl-P → uncheck "Headers and footers") are acceptable for the internal preview but **insufficient for client-facing delivery.** The client artifact must own its own cover page / footer / page numbering rather than relying on the recipient's print dialog.
- **Sprint 4B must land before Sprint 4C.** Light-theme palette is a prerequisite for the client-safe PDF candidate.

---

## AI-Drafted Content Rules

- **AI-drafted report / proposal / roadmap content remains operator-review gated.** All Step 3 / Step 4 / Step 5 outputs land in `needs_review` (Step 3) or `draft` (Step 4) or `planned` (Step 5) state and require operator action before becoming approved / final / live. This boundary is preserved by `docs/18` and by the per-step persistence-safety rules in the synthesis actions.
- **Client-facing export must not include un-reviewed AI drafts** unless the artifact carries a visible "draft" marker and the operator explicitly opts in.
- **Final / approved status should be required** by default for any section / option / roadmap item that appears in a client-bound artifact. The implementing sprint may add an explicit operator override, but the default is "approved or better."
- **Banned-claim scanning applies to client-bound content.** The export pipeline reruns the `claim-guard` scan against the snapshotted content; an unreviewed AI draft that originally passed the synthesis-time scan must still pass the export-time scan (operator edits between synthesis and export may have introduced new prohibited language).
- **No AI synthesis changes are authorized by Sprint 4A.** Steps 3 / 4 / 5 stay exactly as they shipped.

---

## Proposed Sprint Sequence

This canon recommends the following staged sequence. Each sprint requires explicit operator authorization before it begins; none is authorized automatically by the existence of the prior sprint.

1. **Sprint 4A — this canon only.** Documentation. No code changes. No locked controls unlocked. No package, schema, API, storage, or AI synthesis touched. **This sprint.**
2. **DB hygiene micro-step — orphan empty report cleanup.** Delete the orphan empty `reports` row for the Sapient Digital engagement (`76097653-fedb-42e5-9ef6-e89a0e97f802`) so the `initializeReportForEngagement` action can re-seed 12 canonical sections, unblocking the docs/18 Step 3 happy-path walkthrough. Cleanup SQL is documented in `artifacts/walkthroughs/sprint-3-print-preview/blocker-fix-notes.md`. The micro-step is a destructive operator-authorized SQL run plus a verification walkthrough re-pass of test case 3-A.
3. **Sprint 4B — internal print polish + light-theme Group-A chart / report palette.** Adds light-theme rendering for the five Group-A exhibits + a light variant of `report-print-document.tsx`. Operator-only; no client-facing surface unlocked. Internal preview at `/app/engagements/[id]/report/print` becomes light by default; dark remains an operator toggle if the implementing sprint authors one. Group-B remains untouched. No locked control unlocked.
4. **Sprint 4C — client-safe report PDF candidate.** Operator-only generation (the operator generates and stores the artifact privately; the operator delivers to the client through their own channels). Server-side render pipeline added. Snapshot model implemented. Claim-guard scan rerun at export. R2 readiness gate enforced. Group-B still excluded. No share link, no `Send to Client` unlock. **Sprint 4C unlocks `Export Report` only when R2 is satisfied.**
5. **Sprint 4D — controlled client-facing delivery / share, if approved.** Either (a) a controlled share-link surface with the full token / expiry / revocation / audit / no-index contract, or (b) an operator-mediated CRM / email delivery integration. Requires a separate share-token canon (or CRM-integration canon) authored before this sprint begins. **Sprint 4D unlocks `Send to Client` and possibly `Prepare Report`** only when R3 is satisfied.
6. **Separate sprint — Proposal / SOW delivery canon.** Authors `docs/20_PHASE_1B_PROPOSAL_DELIVERY_CANON.md`. Defines the commercial leg analogously to this canon. Required before any proposal-side `LockedActionButton` is unlocked.
7. **Separate sprint — Benchmark Gate 1 advancement.** Advances `docs/14` from Gate 0 (`illustrative`) to Gate 1 (`internal_directional`) with a real benchmark dataset. Required before Benchmark Comparison Bars can appear in any client-bound artifact.
8. **Separate sprint — Financial Gate 1 advancement.** Advances `docs/15` from Gate 0 (`illustrative`) to Gate 1 (`operator_estimated`) with a real assumption set. Required before AI-Savings Waterfall and ROI Bridge can appear in any client-bound artifact.
9. **Separate sprint, explicitly later — e-signature / CRM integration.** Out of scope until at least Sprint 4D and the proposal-delivery canon land, and an additional canon authorizes the e-signature / CRM boundary.

---

## Non-Goals

This canon explicitly does not authorize, and is not consulted as authority for, any of the following:

- **No implementation.** No source code under `app/`, `components/`, `lib/`, `supabase/`, `middleware.ts`, `package.json`, or `package-lock.json` is modified by Sprint 4A.
- **No unlock of locked controls.** `Export Report`, `Prepare Report`, `Prepare SOW Draft`, `Send to Client`, and `Prepare Client Review` remain locked.
- **No API routes.** No new file under `app/api/`.
- **No storage policies.** No new bucket, no new `storage.objects` policy.
- **No schema / migration.** No new file under `supabase/migrations/`. `0012_report_section_exhibit_slot.sql` remains the head migration.
- **No package dependencies.** `package.json` and `package-lock.json` are not touched. No `puppeteer`, no `playwright`, no `@react-pdf/renderer`, no `jspdf`, no PDF library is added.
- **No public links.** No share-link route, no public bucket, no public preview surface.
- **No Group-B wiring.** Benchmark Comparison Bars, AI-Savings Waterfall, ROI Bridge stay confined to `/app/charts-preview`.
- **No Benchmark Gate 1 advancement.** `docs/14` is unchanged.
- **No Financial Gate 1 advancement.** `docs/15` is unchanged.
- **No SOW / e-signature / CRM integration.** Out of scope.
- **No AI synthesis changes.** Steps 3 / 4 / 5 are unchanged. No prompt edits, no claim-guard pattern additions, no run-row schema change.
- **No chart library / package work.** The Visx recommendation plan file remains parked. No `@visx/*` additions, no `components/charts/primitives/` or `components/charts/exhibits/` additions.
- **No light-theme implementation.** Light-theme is canon-deferred to Sprint 4B.
- **No deletion of any existing canon doc.** `docs/13`, `docs/14`, `docs/15`, `docs/17`, `docs/18` are referenced; none are modified.

---

## Acceptance Criteria

1. `docs/19_PHASE_1B_CLIENT_DELIVERY_CANON.md` exists.
2. The canon defines the six-surface delivery taxonomy (internal preview, internal generated PDF, client PDF, client share link, proposal / SOW, e-signature).
3. The canon defines the locked-control policy for `Export Report`, `Prepare Report`, `Prepare SOW Draft`, `Send to Client`, and `Prepare Client Review`.
4. The canon defines four report readiness gates (R0 → R3).
5. The canon defines Group-A vs Group-B exhibit inclusion rules.
6. The canon keeps Group-B gated by `docs/14` and `docs/15`.
7. The canon defines a claim-safety policy and references `lib/ai/claim-guard.ts`.
8. The canon defines access, storage, and snapshot / versioning requirements.
9. The canon defines the Sprint 4B / Sprint 4C / Sprint 4D sequence.
10. `docs/08_CURRENT_STATUS.md` and `docs/10_SESSION_HANDOFF.md` are updated to reflect the canon landing.
11. No source code is changed by Sprint 4A.
12. No schema, API, package, PDF pipeline, or public-link change is made by Sprint 4A.

---

## Pointer-Forward

Future implementing agents working on any client-facing delivery surface for SLATE Phase 1B **must** treat this canon as the source of truth. Any deviation — adding a Group-B exhibit to a client artifact, unlocking `Send to Client` outside Sprint 4D, introducing a share link without a share-token canon, exporting a report without an R2-gated approval flow — requires a canon amendment landed in this document **before** the corresponding code change is authored.

The internal preview at `/app/engagements/[id]/report/print` is the baseline. Every client-facing surface built on top of it must answer to this canon.

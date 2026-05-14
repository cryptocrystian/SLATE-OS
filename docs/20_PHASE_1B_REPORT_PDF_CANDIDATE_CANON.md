# Phase 1B Report PDF Candidate Canon

## Status

- **Date:** 2026-05-13.
- **Branch:** `persistence/step-0-1-auth-shell`.
- **Sprint scope:** **Sprint 4C-A — canon / decision only.** This document is documentation. No source code, schema, migration, API route, package, AI synthesis change, chart primitive, storage policy, or unlock of any locked control is made by this sprint.
- **No implementation is authorized by this canon.** Implementation may begin only when the operator approves the recommendations below, lands the prerequisite decisions (PDF pipeline + dependency posture + storage posture), and an implementation-scoped sprint is opened that references this doc.
- **`Export Report` remains locked.** The chip stays `Locked` on `/app/engagements/[id]/report` throughout Sprint 4C-A. The eventual transition from `Export Report Locked` → `Generate PDF Candidate` (operator-only) lands in Sprint 4C-B/C/D, not here.
- **`Send to Client`, `Prepare SOW Draft`, `Prepare Client Review`, `Prepare Report` remain locked.** None of these moves in Sprint 4C-A.
- **Group-B exhibits remain excluded** from every client-bound surface. Benchmark Comparison Bars, AI-Savings Waterfall, and ROI Bridge stay confined to `/app/charts-preview` until `docs/14` / `docs/15` advance.
- **Audit references:** `docs/19_PHASE_1B_CLIENT_DELIVERY_CANON.md`, `docs/17_PHASE_1B_REPORT_EXHIBIT_WIRING_CANON.md`, `docs/18_AI_SYNTHESIS_STEPS_3_5_ACCEPTANCE_AUDIT.md`, `docs/14`, `docs/15`, `artifacts/walkthroughs/sprint-4b-print-polish/notes.md`.

---

## Why This Exists

Sprint 3 (`docs/17` Sprint 3, commit `454adc1`) shipped the internal browser-print preview at `/app/engagements/[id]/report/print`. Sprint 4B (commit `fba95bf`) added the operator-only `.slate-print-light` CSS-variable scope so the print route renders on a light/print-safe surface. The Sprint 3 walkthrough (2026-05-13) confirmed end-to-end print preview behavior against the Sapient Digital persisted UUID engagement, and the DB hygiene micro-step plus the docs/18 Step 3-A re-verification confirmed every Group-A `exhibit_slot` populates correctly + the AI synthesis arc lands a `needs_review` section without dropping `exhibit_slot` / link rows / reviewer notes.

Sprint 4C is the first step toward producing a **client-safe report artifact** — a PDF candidate that an operator can review against canon-mandated safety rules and, eventually, hand to the client through their own delivery channel. Sprint 4C is **not** client delivery. It does **not** ship a share link, an email integration, an automated send, or a SOW. Sprint 4D and a separate proposal-delivery canon own those surfaces.

Per `docs/19` § Proposed Sprint Sequence:

> **Sprint 4C — client-safe report PDF candidate.** Operator-only generation (the operator generates and stores the artifact privately; the operator delivers to the client through their own channels). Server-side render pipeline added. Snapshot model implemented. Claim-guard scan rerun at export. R2 readiness gate enforced. Group-B still excluded. No share link, no `Send to Client` unlock. **Sprint 4C unlocks `Export Report` only when R2 is satisfied.**

Three decisions block implementation: (1) the PDF pipeline (native browser vs server-side library), (2) the snapshot schema (new table vs existing-row JSON column), and (3) the storage posture (no binary stored vs private bucket). This canon resolves all three with explicit recommendations and documents the readiness gate, claim-safety policy, snapshot content, artifact marking, access/storage/audit rules, activity events, and the implementation plan that follows from those decisions.

`Export Report` can be unlocked **only after** R2 implementation lands. The unlock is intentional and sprint-bound — never a feature flag, never a silent change. Sprint 4C-A authorizes the next sprint to implement against this canon; it does not authorize the unlock itself.

---

## Decision Summary

This section commits explicit decisions for the three open choices. Each subsection states the recommendation, the evaluation that justifies it, and what limitations the choice carries forward.

### PDF pipeline — recommendation: Option A (native browser print-to-PDF + metadata-only snapshot) for the first implementation sprint

#### Options considered

- **Option A — Native browser print-to-PDF, snapshot metadata only.** Operator visits a new `/report/pdf-candidate` route (or extends `/report/print` with a candidate variant), reviews the rendered light-theme document, hits Ctrl-P / Cmd-P, picks `Save as PDF`. SLATE persists a `report_delivery_snapshots` row recording what was rendered, the claim-guard result, the source summaries, and the operator identity. **No PDF binary is generated server-side. No PDF binary is stored. No new dependency is added.**
- **Option B — Server-side generated PDF, new dependency.** Wire a PDF library (`@react-pdf/renderer` / `puppeteer` / `playwright` / `pdfkit` / `weasyprint`-via-subprocess) into a new server route that returns a PDF binary. Persists snapshot row + the binary in private storage.
- **Option C — Hybrid.** Keep the existing browser internal preview path for operator preview; add a server-side PDF only for the client-safe candidate.

#### Evaluation

| Axis | Option A | Option B | Option C |
|---|---|---|---|
| Implementation complexity | Low — extends an existing route + adds a snapshot table + an action. | High — new dep, server-render pipeline, font embedding, asset proxying, SVG-to-PDF chart preservation. | Medium-high — both A and B paths to maintain. |
| Dependency risk | None — no new package, no canon amendment. | High — `@react-pdf/renderer` is the lowest-risk option (pure React + JS, no Chromium binary) but still needs a dedicated dependency canon per `docs/19` § Non-Goals. `puppeteer` / `playwright` bundle a headless Chromium (>100 MB) and shift the deployment cost and security surface dramatically. | High — same as B but for one path. |
| Fidelity / pagination | Browser-controlled. Acceptable for operator-only review under the Sprint 4B `.slate-print-light` palette. Per-browser variation in page-break behavior. | High — library owns pagination, font embedding, vector exports. Layout is deterministic across operators. | High on the server-side path; browser-controlled on the preview path. |
| Security surface | Same as `/app/*` today — no new server route producing untrusted binaries. | New surface — server-rendered PDF can leak data (CSS variable substitution, asset URL leakage, embedded fonts with PII metadata) if not designed carefully. | Same as B. |
| Hosting compatibility | Works everywhere — operator's browser does the work. | `@react-pdf/renderer` works on Vercel/Node. `puppeteer`/`playwright` need a Chromium runtime that may exceed Vercel's serverless function size (~50 MB compressed). | Same as B for the server leg. |
| CI / build burden | None. | Adds package install + native-binary download for `puppeteer`/`playwright`; `@react-pdf/renderer` is JS-only. | Same as B. |
| Future share / download needs | Snapshot row carries everything an audit trail needs. The binary is regenerable from snapshot + canonical render. | Binary is persisted at generation time — survives operator absence. | Same as B. |
| Operator workflow | Familiar — operator already uses `Save as PDF` from `/report/print`. Sprint 4B's operator-hint pill already covers this flow. | New affordance — operator clicks a `Generate PDF Candidate` button, waits for the binary, downloads via a signed-URL link. | Operator uses both depending on intent. |

#### Recommendation

**Option A for Sprint 4C-B (first implementation sprint).**

Justification:
- Lowest-risk path that creates an auditable client-safe candidate without introducing a dependency in the same sprint that introduces the snapshot model. Per `docs/19` § Non-Goals, adding a PDF library is an explicit non-goal for Sprint 4A — and is implicitly a non-goal for any sprint that has not first amended its own canon.
- The snapshot row carries every artifact that an auditor or future PDF library would need: rendered section IDs, exhibit slots, adapter source summaries, claim-guard result, operator identity, timestamps, and version markers. The snapshot is **the** durable client-safety artifact; the PDF binary is one possible representation of it.
- The browser Save-as-PDF path is already proven against the live Sapient Digital engagement under Sprint 4B's light-theme palette. Sprint 4B's polish backlog documented the page-break limitation explicitly; the limitation is acceptable for operator-only candidate review.
- Option A's limitations are honest and bounded: (a) per-browser pagination variance (acceptable because the artifact is operator-reviewed, not auto-delivered), (b) no persisted binary (acceptable because the snapshot is the authoritative artifact), (c) no automated send (out of scope for Sprint 4C entirely — Sprint 4D owns delivery).

#### Limitations carried forward

If Option A is chosen for Sprint 4C-B:

- The PDF binary is **not** server-rendered. Operators using different browsers may see micro-differences in pagination, font rendering, or `print-color-adjust` behavior. The snapshot row records what was on screen at generation time; the operator's saved PDF reflects their browser's rendering of that on-screen state.
- The artifact is **not** automatically attached or sent. The operator saves it locally and delivers through their own channel.
- The server cannot **verify** that the operator actually saved a PDF — only that the snapshot was generated. This is acceptable for Sprint 4C because client delivery is not unlocked; the snapshot is the audit hook, not the binary.
- If a future regulatory or commercial requirement mandates a server-rendered binary (e.g., compliance archives), a separate dependency canon must land before that sprint adds a PDF library. Sprint 4C-A does not authorize that dependency.

#### Dependency-canon requirement (if Option B is chosen instead)

If the operator instead authorizes Option B for Sprint 4C-B, the following must land **before** any code:

1. A new doc `docs/21_PHASE_1B_PDF_LIBRARY_DEPENDENCY_CANON.md` evaluating `@react-pdf/renderer` vs `puppeteer` vs `playwright` vs `pdfkit` vs server-side Chromium-headless and approving exactly one.
2. Explicit operator acknowledgment of the dependency's security posture, hosting cost (especially for `puppeteer`/`playwright`'s ~150 MB Chromium binary), and CI burden.
3. A second canon doc covering font embedding, asset proxying for embedded SVG charts, and PII-free PDF metadata (no font filenames that leak system info, no embedded XMP with operator names beyond the documented snapshot fields, no automatic `Producer` / `Creator` strings beyond `SLATE`).

This canon recommends deferring Option B until R3 client delivery (Sprint 4D) is on the immediate horizon and a separate dependency canon has been authored and approved.

### Snapshot schema — recommendation: Option A (new `report_delivery_snapshots` table)

#### Options considered

- **Option A — new `report_delivery_snapshots` table.** Dedicated table with its own lifecycle, RLS policy, and indexable columns.
- **Option B — JSON snapshot column on existing `reports` table.** Add a `delivery_snapshot jsonb` column on `reports`. Single snapshot per report; new generations overwrite.
- **Option C — activity / event-only snapshot.** Record snapshots as rows in `activity_events` with a new `report_pdf_candidate_generated` event type that carries the full payload.

#### Recommendation

**Option A.** Matches the user's default recommendation. Justified by:

- **Lifecycle independence.** Snapshots are not part of the report; they are point-in-time artifacts derived from the report. A report can have many snapshots over its lifetime (operator regenerates the candidate after a section change; voids an earlier snapshot when the content drifts; supersedes a candidate snapshot with a higher-readiness one). Option B can hold at most one snapshot; Option C can hold many but conflates audit events with payloads and bloats the activity timeline.
- **Indexable query patterns.** Operators will want to list "all candidate snapshots for engagement X" / "all snapshots generated in the last 7 days" / "snapshots where claim-guard failed". A dedicated table indexes these queries deterministically.
- **Status semantics.** A snapshot needs `status: candidate | generated | voided`. Modeling that on a `reports` JSON column is awkward; modeling it on an event is wrong (events are immutable).
- **Future-proof for Option B PDF pipeline.** When a future sprint authorizes server-rendered PDFs, the snapshot table is the natural place to add `artifact_path` and `artifact_mime_type` columns — the table grows without touching the `reports` table.

### Snapshot schema — proposed columns (conceptual, not implemented)

```sql
create table if not exists public.report_delivery_snapshots (
  id                                uuid primary key default gen_random_uuid(),
  workspace_id                      uuid not null references public.workspaces(id) on delete restrict,
  engagement_id                     uuid not null references public.engagements(id) on delete cascade,
  report_id                         uuid not null references public.reports(id) on delete cascade,

  status                            text not null check (status in ('candidate','generated','voided')) default 'candidate',
  delivery_surface                  text not null check (delivery_surface in ('internal_candidate','client_pdf_candidate')) default 'internal_candidate',
  report_status_at_generation       text not null,

  generated_by_profile_id           uuid references public.profiles(id) on delete set null,
  generated_by_user_id              uuid references auth.users(id) on delete set null,
  generated_at                      timestamptz not null default now(),

  section_snapshot                  jsonb not null default '[]'::jsonb,
  exhibit_snapshot                  jsonb not null default '[]'::jsonb,
  source_summary_snapshot           jsonb not null default '[]'::jsonb,
  claim_guard_result                jsonb not null default '{}'::jsonb,
  omitted_exhibits                  jsonb not null default '[]'::jsonb,
  draft_watermark                   boolean not null default true,

  artifact_path                     text,
  artifact_mime_type                text,
  artifact_size_bytes               bigint,
  artifact_sha256                   text,

  voided_at                         timestamptz,
  voided_by_profile_id              uuid references public.profiles(id) on delete set null,
  voided_reason                     text,

  app_version                       text,
  commit_sha                        text,

  created_at                        timestamptz not null default now(),
  updated_at                        timestamptz not null default now()
);
```

Notes:
- `workspace_id` is RLS-scoped via the existing `(select id from public.workspaces limit 1)` pattern shared by every other operator table (`ai_synthesis_runs`, `activity_events`, etc.).
- `delivery_surface` distinguishes the operator-internal candidate (today's scope) from the client-PDF candidate (later sprint within 4C) so the table can carry both kinds of snapshot without a schema fork.
- `draft_watermark boolean` records whether the artifact carried the `Draft candidate · requires operator approval` marker; useful for audit ("did this operator approve the snapshot for delivery?").
- `artifact_*` columns are **nullable** in the Option A pipeline (no binary stored). They are reserved for the future Option B sprint without requiring a migration.
- `voided_*` columns let the operator mark a snapshot stale without deletion — important because snapshots are audit records.
- `app_version` + `commit_sha` make the snapshot reproducible against a known SLATE build.

**This schema is not implemented in Sprint 4C-A.** The migration lands in Sprint 4C-B or a dedicated schema sprint.

### Artifact storage — recommendation: metadata-only initially

For Sprint 4C-B's first implementation pass:

- **No PDF binary is stored.** The operator's browser owns the binary via Save-as-PDF.
- The snapshot row carries everything an auditor needs to reconstruct what was rendered.
- If a later sprint authorizes server-rendered PDFs (Option B above), it adds a private `report-delivery-pdfs` bucket with the existing 5–15-minute signed-URL TTL pattern from `lib/supabase/server.ts` + `/api/app/assets/[id]/download`. No public bucket. No share-link surface. No raw asset URLs exposed.
- If storage is introduced later, every storage event must emit a `report_pdf_candidate_downloaded` activity event so the audit trail captures who fetched which snapshot at which time.

### `Export Report` control — recommendation: deferred unlock, only after R2 implementation lands

Sprint 4C-A does **not** unlock `Export Report`. The chip stays `Locked` for the duration of this sprint.

The eventual unlock happens in Sprint 4C-B (or a later sub-sprint) and is gated on:

1. The R2 readiness checks (below) being implemented as a server-side helper.
2. The `report_delivery_snapshots` row being created on every generation attempt — including failed attempts (so the failure is auditable).
3. The export-time claim-guard scan passing against the snapshotted content. A failed scan blocks generation; the snapshot row records the violation codes; the operator sees an inline error.
4. Group-B exclusion enforced at the snapshot boundary (no `benchmark_comparison_bars` / `ai_savings_waterfall` / `roi_bridge` slot in `exhibit_snapshot`).
5. The artifact carrying the appropriate marker (Draft Candidate / Client-Safe Candidate / Internal Candidate — see Artifact Marking below).

The control label changes from `Export Report` (locked CTA implying client export) to `Generate PDF Candidate` (operator-only action) when the unlock lands. **The locked control is not re-pointed at the internal preview route** — that pattern is explicitly forbidden by `docs/19` § Locked Control Policy anti-patterns.

`Send to Client`, `Prepare SOW Draft`, `Prepare Client Review`, and `Prepare Report` remain locked throughout Sprint 4C. None of these moves until Sprint 4D and the separate proposal-delivery canon land.

---

## Report Readiness Gate R2

This section defines the exact checks that must pass before a `report_delivery_snapshots` row can be created with `status='generated'` (rather than `status='candidate'` with `draft_watermark=true`).

### Mandatory R2 checks

A report passes R2 when all of the following are true:

1. **Persisted UUID engagement.** The engagement id matches the UUID regex; mock / legacy slug engagements never reach this path. (Same boundary as every other persisted route.)
2. **Report exists.** A `public.reports` row exists for the engagement.
3. **Report has sections.** `select count(*) from public.report_sections where report_id = ?` is greater than 0. (Sprint 3-A's DB hygiene micro-step confirmed this matters — the orphan empty `reports` row blocked Step 3-A until cleanup.)
4. **All included sections are `approved` or `final`** — **OR** the snapshot is marked `draft_watermark=true` and the artifact carries a visible "Draft candidate · requires operator approval" marker. The default behavior is the stricter rule (approved/final only); the operator may explicitly override per-snapshot.
5. **All included exhibit slots are valid Group-A.** `exhibit_slot` is one of the five canonical values (`executive_summary_portfolio` / `findings_risk_priority` / `diagnostic_capability_maturity` / `diagnostic_stakeholder_coverage` / `roadmap_90_day_sequence`) or `null`. Group-B slot values must never appear (defense-in-depth already enforced by the SQL CHECK constraint added by migration `0012_report_section_exhibit_slot.sql`).
6. **Group-A fallback exhibits resolved.** Slots that return `insufficient_data` / `invalid_data` / `gated` from the adapter pipeline are **omitted from the main body** by default and **listed in the "Omitted Exhibits" appendix** with the canon-mandated insufficient-data copy (stripped of operator-only deep links to `/app/engagements/.../{intake,findings,opportunities,roadmap}` so client-bound artifacts don't carry operator navigation URLs). This matches `docs/19` § Exhibit Inclusion Rules' "Default recommendation: omit."
7. **Stale source summaries resolved or accepted.** A slot whose `sourceSummary.freshness === "stale"` (per Sprint 2.1's `deriveFreshness` 7-day threshold) blocks generation unless the operator explicitly accepts the staleness at generation time. Accepted staleness is recorded in `claim_guard_result.acceptedStaleSlots[]` so the audit trail captures the override.
8. **Export-time claim guard passes.** See "Claim Guard / Content Safety" below.
9. **Group-B excluded.** No Group-B exhibit is imported or rendered by the candidate route. (`Grep` for `BenchmarkComparisonBars|AISavingsWaterfall|RoiBridge` on the new route's render path must return zero matches at PR review.)

### Default behavior choice — recommendation

**Operator-only candidate PDF can include `needs_review` sections only if `draft_watermark=true` and the artifact carries a visible "Draft candidate · not approved for client delivery" marker. A true client-ready PDF (`draft_watermark=false`, `delivery_surface='client_pdf_candidate'`) requires every included section to be `approved` or `final`.**

This matches the recommended default in the user's prompt and respects two practical realities:

- Operators commonly want to preview a candidate while sections are still in review, particularly when iterating with a client during a working session. Blocking `needs_review` sections entirely would force operators back to the internal preview route, which defeats the purpose of having a candidate surface.
- A true client-ready PDF must not silently include un-approved content. The watermark + the explicit `delivery_surface` field on the snapshot row enforce the boundary.

### Stale-data acceptance — operator UI

When an operator generates a candidate snapshot and one or more slots are stale:

- The Generate PDF Candidate action surfaces an inline list of stale slots + the staleness reason.
- The operator either resolves the staleness (e.g., reruns an adapter against fresh persisted rows) or explicitly accepts the staleness with a per-slot checkbox.
- Accepted staleness is recorded in `claim_guard_result.acceptedStaleSlots[]`.
- The generated artifact carries an inline "Source data may be stale — accepted by operator at <timestamp>" marker for each accepted slot.

This UX detail is recommended; final wiring lives in the implementation sprint.

---

## Group-A / Group-B Inclusion Policy

### Group A — eligible after R2

The five Group-A exhibits are eligible for inclusion in the PDF candidate **after** the R2 readiness checks above pass.

- **Ready exhibits** (adapter returned `status='ready'`) render in the main body of the artifact, alongside the corresponding section content.
- **Insufficient-data / invalid-data / gated exhibits** are **omitted from the main body** and listed in an **"Omitted Exhibits" appendix / notice** with the reason (e.g., "Stakeholder Coverage Matrix — insufficient_data — no_topic_taxonomy"). The appendix copy is operator-facing in tone but stripped of `/app/engagements/.../` deep links so the artifact is portable.
- **No sample data fallback.** Per `docs/17` § Fallback Rules and `docs/19` § Group-A fallback policy, the artifact never substitutes preview / illustrative data for missing persisted data.

### Group B — excluded entirely

The three Group-B exhibits remain confined to `/app/charts-preview` until `docs/14` / `docs/15` advance their data gates and a separate wiring sprint authorizes inclusion.

- **`BenchmarkComparisonBars`, `AISavingsWaterfall`, `RoiBridge` are not imported** by any file in the PDF candidate render path.
- **No fallback / omission card for Group-B in the artifact.** Even mentioning that benchmark / financial exhibits exist could create an implicit claim that the data is available. The artifact says nothing about Group-B — silence is the right canonical posture until the gates advance.
- **No illustrative source notes in client-bound artifacts.** The Gate-0 illustrative strings (`"Source: Illustrative sample data · not a benchmark study"` / `"Source: Illustrative sample data · not a financial model"`) are operator-only per `docs/19` § Exhibit Inclusion Rules. The candidate render path refuses to render any slot whose source note matches the illustrative pattern. This is defense-in-depth alongside the Group-B import boundary.

### Prohibited language in client-bound artifacts

Per `docs/19` § Prohibited client-facing claim language, and reinforced here for the artifact-render boundary:

- No "industry benchmark," "peer benchmark," "top quartile," "above average" — gated by `docs/14`.
- No "ROI," "payback," "break-even," "guaranteed savings," "will save," "will reduce cost," "cash-flow positive" — gated by `docs/15`.
- No "ready for signature," "binding quote," "executed SOW," "approved by finance," "final commercial terms," "binding offer" — gated by future proposal-delivery canon.
- No "guaranteed completion," "binding timeline," "committed delivery date," "legally binding timeline," "final implementation schedule," "binding delivery commitment" — gated by future proposal-delivery canon.

These phrases are exactly the patterns enforced by `lib/ai/claim-guard.ts`. The export-time scan re-enforces them.

---

## Claim Guard / Content Safety

The export-time claim-guard scan reruns the existing 26-pattern scanner from `lib/ai/claim-guard.ts` over the snapshotted content. This is necessary because operator edits between AI synthesis and export bypass the synthesis-time scan.

### Scan input fields

For each candidate snapshot, the scanner reads:

- `reports.title`
- For each included `report_sections` row:
  - `title`
  - `summary`
  - `draft_preview`
  - `evidence_notes`
  - `reviewer_note` (if the artifact includes reviewer notes — by default it does not; operators may opt in per snapshot)
  - `assumption_*` fields (if exposed; otherwise null-safe)
- For each rendered exhibit slot:
  - The adapter's `sourceSummary.text`
  - The exhibit's `takeaway` (consultant-authored one-liner, optional)
- Appendix / omission notes (the operator-facing copy generated by the render path for omitted slots)

### Combined pattern set

For client-bound artifacts (`delivery_surface='client_pdf_candidate'`), apply all 26 patterns:

- `FINANCIAL_CLAIM_PATTERNS` (14)
- `COMMERCIAL_FINALITY_PATTERNS` (6)
- `ROADMAP_COMMITMENT_PATTERNS` (6)

For internal-candidate artifacts (`delivery_surface='internal_candidate'`), the same 26 patterns apply — there is no relaxed mode. Internal-candidate is "could be promoted to client-safe by removing the watermark" — so the safety floor is the same.

### Fail behavior

If any violation is detected:

- The candidate snapshot row is created with `status='candidate'` (not `'generated'`) and `claim_guard_result.violations[]` populated with `{ field, code, snippet }` entries.
- The operator sees an inline error listing the violations; no artifact is rendered for that snapshot.
- The artifact route refuses to render the candidate body — only the snapshot identity header + the violation list (still hidden behind the operator-only path).
- The operator must edit the source content (or revert the offending AI draft) and regenerate.

### Why this scan is mandatory

Per `docs/19` § Claim Safety Rules: "A deterministic prohibited-claim scan must run at export time, immediately before the client artifact is rendered." This sprint canonizes the field list above as the scan input set.

### Pattern source of truth

`lib/ai/claim-guard.ts` remains the **single source of truth** for the pattern list. Sprint 4C-B reuses the exported `scanForBannedClaims(fields, rules)` helper exactly as the AI synthesis paths do today. No new patterns are added by Sprint 4C-A or Sprint 4C-B unless an operator-edited violation surfaces during testing that the existing 26 patterns miss — at which point an amendment to `lib/ai/claim-guard.ts` lands in a dedicated patch, not in a delivery sprint.

---

## Snapshot Content

Each `report_delivery_snapshots` row should record:

### Identity

- `report_id` and `engagement_id` (FK + columns)
- `report_status_at_generation` (e.g. `"draft"` / `"in_review"` / `"approved"` / `"final"` from `reports.status`)
- `generated_at` (timestamp)
- `generated_by_profile_id` + `generated_by_user_id` (operator identity)
- `app_version` and `commit_sha` (build identity — populated from env vars or build-time substitution)

### Section snapshot

`section_snapshot jsonb` — array of section entries:

```json
[
  {
    "sectionId": "<uuid>",
    "sectionType": "executive_summary",
    "status": "needs_review",
    "position": 0,
    "exhibitSlot": "executive_summary_portfolio",
    "title": "Executive Summary",
    "summary": "...",
    "draftPreview": "...",
    "evidenceNotes": ["..."],
    "reviewerNote": null,
    "updatedAt": "2026-05-13T19:44:15.193Z",
    "lastReviewedAt": "2026-05-13T19:44:12.252Z",
    "aiDrafted": true,
    "includedInArtifact": true
  }
]
```

### Exhibit snapshot

`exhibit_snapshot jsonb` — array of slot entries:

```json
[
  {
    "slot": "executive_summary_portfolio",
    "adapterStatus": "ready",
    "renderedInArtifact": true,
    "sourceSummary": { "source": "Approved opportunities", "rowCount": 5, "generatedAt": "<iso>", "freshness": "fresh" },
    "issues": []
  }
]
```

### Source summary snapshot

`source_summary_snapshot jsonb` — denormalized copy of per-slot source summaries so the snapshot is self-contained (no need to re-derive freshness later). Mirrors what already lives in `exhibit_snapshot[].sourceSummary` plus a top-level digest:

```json
{
  "digest": { "freshSlots": 4, "staleSlots": 0, "unknownSlots": 1 },
  "acceptedStaleSlots": [],
  "perSlot": [ /* same as exhibit_snapshot[].sourceSummary */ ]
}
```

### Claim guard result

`claim_guard_result jsonb`:

```json
{
  "scannedFields": [ "title", "section[0].summary", ... ],
  "patternsApplied": ["financial", "commercial-finality", "roadmap-commitment"],
  "patternCount": 26,
  "violations": [],
  "scanDurationMs": 12,
  "version": "claim-guard.v1"
}
```

### Omitted exhibits

`omitted_exhibits jsonb` — list of slot/reason pairs for the Omitted Exhibits appendix:

```json
[
  {
    "slot": "diagnostic_stakeholder_coverage",
    "reason": "insufficient_data",
    "issueCode": "no_topic_taxonomy",
    "operatorFacingNote": "Stakeholder coverage matrix omitted because no topic-tagging exists on intake responses for this engagement."
  }
]
```

### Group-B omission confirmation

`omitted_exhibits` always includes the canonical Group-B confirmation entry:

```json
{
  "slot": "group_b_block",
  "reason": "gated",
  "issueCode": "group_b_canon_gate",
  "operatorFacingNote": "Benchmark Comparison Bars, AI-Savings Waterfall, and ROI Bridge are intentionally omitted. They remain preview-only until docs/14 / docs/15 advance their data gates."
}
```

This is the explicit, machine-readable equivalent of the visible Group-B omission card on the artifact.

### No raw prompt / model output

The snapshot does **not** record:

- Raw OpenAI prompt bodies
- Raw OpenAI response bodies
- Stakeholder PII not already in the section content
- File names / signed-URL paths of attachments
- Saipien Fit Score
- Internal scoring intermediates

The snapshot captures **what was rendered**, not **how the rendering pipeline reached that point**. The AI synthesis runs in `ai_synthesis_runs` are the audit hook for the synthesis pipeline; the delivery snapshot is the audit hook for the render pipeline. The two are joined by `section_snapshot[].sectionId` for cross-reference but never duplicated.

---

## PDF Artifact Marking

Every artifact rendered through the PDF candidate path **must** carry the following visible chrome.

### Required markings

1. **Surface designation** — at the top of the artifact, prominent:
   - **Internal candidate** when `delivery_surface='internal_candidate'`
   - **Client-safe candidate** when `delivery_surface='client_pdf_candidate'`
2. **Generated timestamp** — ISO-8601 UTC near the surface designation.
3. **Identity codes** — `ENGAGEMENT ID <uuid>` and `REPORT ID <uuid>` and `SNAPSHOT ID <uuid>` in a mono-spaced identity strip.
4. **Group-B omission notice** — the existing "Benchmark Comparison Bars, AI-Savings Waterfall, and ROI Bridge are intentionally omitted from this candidate. They remain preview-only at /app/charts-preview until docs/14 / docs/15 advance their data gates." card, included unconditionally.
5. **Operator identity** (optional — operator may opt in) — `Generated by <operator-display-name>` if the operator chooses to include it. Default: name omitted; operator initials only.
6. **Draft watermark** — when `draft_watermark=true`, a visible "Draft candidate · requires operator approval" marker on every page of the artifact (CSS `position: fixed` with `print:fixed` or a per-page header — implementation choice).
7. **Stale-data warning** — when any slot is in `claim_guard_result.acceptedStaleSlots[]`, a visible "Source data may be stale — accepted by operator at <timestamp>" marker near the relevant exhibit.

### Forbidden markings

The artifact **must not** include:

- "Send", "Share", "Email", "Submit", "Deliver to client", or any other client-facing delivery verb.
- "Signed", "Executed", "Binding", or any commercial-finality verb (per `docs/19` and the claim-guard scan).
- Any URL pointing to `/app/engagements/...` or other operator-only routes. Deep links are operator-only and must not survive into a client-bound artifact.
- The phrase "Final report" unless every included section is at `status='final'` AND the operator explicitly opted in.
- Any signature line, e-signature affordance, or counterparty placeholder. E-signature is out of scope for Phase 1B and `docs/19`.

---

## Access / Storage / Download Rules

### Route boundary

- The PDF candidate route lives under `/app/*` and is gated by the existing middleware session.
- **No public route.** No `/share/*`, no `/preview/<token>`, no public bucket URL.
- **No client email or send.** SLATE delivers the candidate to the operator only; the operator delivers to the client through their own channel (email attachment, CRM upload, in-person handoff).

### Share / send / token surfaces — out of scope

- **No share token surface is built in Sprint 4C.** Share tokens are gated by a separate canon (`docs/22_PHASE_1B_SHARE_TOKEN_CANON.md` if and when authored) and Sprint 4D. Sprint 4C-A explicitly defers.

### Storage rules

- If Sprint 4C-B's implementation stores a PDF binary (currently recommended **not** to — see "Artifact storage" above), the bucket **must** be private at creation. No public bucket. No anon read.
- Signed-URL TTL **must not exceed 15 minutes** per `docs/19` § Storage Rules.
- The artifact path **must** include a UUID (not an engagement slug) so the path is not guessable.
- The artifact **must not** embed raw private asset URLs from `engagement-documents` or any other storage bucket. Embedded charts are SVG-inline; embedded fonts are JS-inlined; nothing is fetched from a private bucket at view time.

### Download tracking

- Every artifact download emits a `report_pdf_candidate_downloaded` activity event (see below) so the audit trail captures who fetched which snapshot.
- The download tracking is best-effort and never blocks the download; logging failure is silent (matches the existing `lib/activity/log.ts` pattern).

---

## Activity / Audit Events

Define the following new event types in `lib/activity/types.ts` when Sprint 4C-B lands. **Not implemented in Sprint 4C-A.**

| Event type | Trigger | Metadata |
|---|---|---|
| `report_pdf_candidate_generated` | Snapshot row created with `status='generated'` | `{ snapshotId, reportId, deliverySurface, draftWatermark, claimGuardResult: { violations: 0 }, omittedExhibitCount, freshSlots, staleSlots, unknownSlots }` |
| `report_pdf_candidate_failed` | Snapshot row created with `status='candidate'` due to claim-guard violation OR R2 check failure | `{ snapshotId, reportId, failureReason: "claim_guard_violation" | "r2_check_failed", violations[]: [{field, code}], failedChecks[]: ["sections_count_zero", "stale_slot_rejected", ...] }` |
| `report_pdf_candidate_downloaded` | Operator downloads the artifact (only relevant if storage is added later) | `{ snapshotId, reportId, deliverySurface }` |
| `report_delivery_snapshot_voided` | Operator marks a snapshot stale | `{ snapshotId, reportId, voidedReason }` |

### Event safety posture

- No event metadata carries raw PII, stakeholder text, or model output.
- All events route through the existing `lib/activity/log.ts` helper (no new API surface).
- Activity timeline rendering in `components/activity/activity-timeline.tsx` gains new tone/icon entries for the four types (tone `info` / `risk` / `ai` / `neutral` depending on event semantics — final choice belongs to the implementing sprint).
- The activity timeline never exposes raw `claim_guard_result.violations[].snippet` to non-operator users; the public scorecard / stakeholder intake routes never read activity rows of these types (the existing RLS policy already excludes them).

---

## Sprint 4C Implementation Plan

If the operator approves the decisions above, the recommended implementation path is:

### Sprint 4C-B (single-sprint, dependency-free) — recommended

If the operator approves Option A (native browser print-to-PDF, no new dep), the entire Sprint 4C implementation can land in one sprint:

1. **Migration `0013_report_delivery_snapshots.sql`** — creates `public.report_delivery_snapshots` with the columns canonized above + RLS policy mirroring the existing operator-full pattern. Idempotent. No FK back to `report_sections` (snapshot uses `section_snapshot jsonb` instead, so section deletion does not cascade-delete snapshots).
2. **`lib/reports/snapshot-types.ts`** — TypeScript types matching the table shape; pure-function helpers for serializing sections/exhibits into the `*_snapshot` jsonb shapes.
3. **`lib/reports/snapshot-queries.ts`** — read queries for listing snapshots per engagement, fetching a single snapshot, listing voided snapshots.
4. **`lib/reports/snapshot-actions.ts`** — write actions: `generateReportPdfCandidate({ engagementId, deliverySurface, acceptedStaleSlots, includeReviewerNotes })`, `voidReportPdfCandidateSnapshot({ snapshotId, reason })`. Returns the snapshot id on success, the violation list on failure.
5. **`lib/reports/r2-readiness.ts`** — pure-function helper that takes a report + adapter results + operator overrides and returns `{ ready: boolean, blockers: [{check, reason}] }`.
6. **`lib/reports/export-claim-guard.ts`** — pure-function helper that scans the snapshot payload through `lib/ai/claim-guard.ts`'s shared scanner and returns the `claim_guard_result` shape canonized above.
7. **`app/app/engagements/[id]/report/pdf-candidate/page.tsx`** — operator-only route that renders the candidate artifact. Server component. Reuses the Sprint 4B `.slate-print-light` palette via the existing CSS-variable scope. Embeds the snapshot identity strip, the section list, the Group-A exhibits, the Omitted Exhibits appendix, and the artifact marking chrome. **No new exhibit code; no new primitive code; no new adapter code.**
8. **`components/reports/generate-pdf-candidate-button.tsx`** — replaces the `LockedActionButton label="Export Report"` on `/app/engagements/[id]/report` with an active `Generate PDF Candidate` button (operator-only, server-action-backed). The `Send to Client` / `Prepare SOW Draft` / `Prepare Client Review` / `Prepare Report` locked controls stay locked verbatim.
9. **Activity event types** added to `lib/activity/types.ts` + `components/activity/activity-timeline.tsx`.
10. **Documentation updates** to `docs/08`, `docs/10`, and a Sprint 4C-B walkthrough notes file under `artifacts/walkthroughs/sprint-4c-pdf-candidate/notes.md`.

Estimated size: medium — comparable to Sprint 2 (`exhibit_slot` column + slot-map + renderer rewire). Pure additive against the existing print pipeline.

### Sprint 4C-B / C / D (split-sprint) — required if any open decision is unresolved

If the operator does not approve Option A, or if the dependency / schema / storage posture decisions are not resolved at Sprint 4C-A acceptance time, split into:

- **Sprint 4C-B — PDF library dependency canon** (docs-only). Author `docs/21_PHASE_1B_PDF_LIBRARY_DEPENDENCY_CANON.md` evaluating `@react-pdf/renderer` vs `puppeteer` vs `playwright` vs `pdfkit` vs Chromium-headless. Operator approves exactly one. No code.
- **Sprint 4C-C — snapshot schema + R2 readiness** (code, no PDF binary). Lands the migration + types + R2 helper + snapshot action. The action returns a snapshot id but does not yet generate a binary artifact; the operator views the candidate via the print route (which queries the snapshot). Equivalent to a "headless preview" — exercises the safety pipeline without the binary.
- **Sprint 4C-D — generation action + artifact route** (code). Lands the candidate route + the `Generate PDF Candidate` button + the activity events + the (browser or library) artifact rendering.

The split path is appropriate if Option B is chosen, because the dependency canon must precede the migration. It is also appropriate if the operator wants to defer the unlock of `Export Report` past Sprint 4C-C.

---

## Open Decisions / Operator Approval Needed

The following decisions require explicit operator approval **before** implementation begins:

1. **PDF pipeline choice.** Approve Option A (recommended) or Option B (requires dependency canon).
2. **Whether to add a PDF dependency.** Default: no. If yes, requires a separate dependency canon doc.
3. **Snapshot schema strategy.** Approve Option A (recommended — new `report_delivery_snapshots` table) or Option B / C.
4. **Storage vs metadata-only.** Approve metadata-only (recommended) or private-bucket binary storage. The latter requires additional storage canon work.
5. **Draft Candidate watermark acceptability.** Approve the recommended UX: operator may include `needs_review` sections only if the artifact carries the watermark. The alternative is the stricter "approved/final only, always" rule.
6. **`Export Report` becoming `Generate PDF Candidate`.** Approve the label change. `Export Report Locked` is replaced by an active operator-only `Generate PDF Candidate` button when the R2 implementation lands. This is **not** a client-facing export; the button text intentionally says "candidate" to keep the operator-only boundary visible. Alternative: keep `Export Report Locked` and add `Generate PDF Candidate` as a separate sibling button.
7. **Sprint structure.** Approve the single-sprint Sprint 4C-B path (recommended if Option A is approved) or the split Sprint 4C-B/C/D path (recommended if Option B or any other decision is deferred).
8. **Reviewer-note inclusion default.** Approve the recommended default (`reviewerNote` excluded from the artifact by default; operator opts in per snapshot) or the alternative (reviewer notes included).
9. **Operator identity inclusion default.** Approve the recommended default (operator initials only; full name optional) or the alternative (full name always included).

---

## Non-Goals

This canon explicitly does not authorize, and is not consulted as authority for, any of the following:

- **No implementation.** No source code under `app/`, `components/`, `lib/`, `supabase/`, `middleware.ts`, `package.json`, or `package-lock.json` is modified by Sprint 4C-A.
- **No PDF library dependency.** `package.json` and `package-lock.json` are not touched. No `@react-pdf/renderer`, `puppeteer`, `playwright`, `pdfkit`, `jspdf`, or any PDF-related package is added.
- **No schema / migration.** No new file under `supabase/migrations/`. `0012_report_section_exhibit_slot.sql` remains the head migration.
- **No `report_delivery_snapshots` table created.** The schema is canonized here for the next implementation sprint; the migration is not authored by Sprint 4C-A.
- **No API routes.** No new file under `app/api/`.
- **No public share links.** No share-token surface, no public bucket, no public preview URL.
- **No unlock of locked controls.** `Export Report`, `Prepare Report`, `Prepare SOW Draft`, `Send to Client`, and `Prepare Client Review` remain locked.
- **No SOW / e-signature / CRM work.** Out of scope, gated by separate canons.
- **No Group-B wiring.** Benchmark Comparison Bars, AI-Savings Waterfall, ROI Bridge stay confined to `/app/charts-preview`.
- **No Benchmark Gate 1 advancement.** `docs/14` is unchanged.
- **No Financial Gate 1 advancement.** `docs/15` is unchanged.
- **No AI synthesis changes.** Steps 3 / 4 / 5 are unchanged. No prompt edits, no claim-guard pattern additions, no run-row schema change.
- **No chart library / package work.** The Visx recommendation plan file remains parked.
- **No modification to the existing print route implementation.** `/app/engagements/[id]/report/print` and `components/reports/report-print-document.tsx` are not touched by Sprint 4C-A. The new `/report/pdf-candidate` route is a separate surface; the existing print route continues to serve operator-internal preview.
- **No proposal / SOW delivery work.** Gated by a separate proposal-delivery canon.
- **No deletion of any existing canon doc.** `docs/13`, `docs/14`, `docs/15`, `docs/17`, `docs/18`, `docs/19` are referenced; none are modified.

---

## Acceptance Criteria

1. `docs/20_PHASE_1B_REPORT_PDF_CANDIDATE_CANON.md` exists.
2. PDF pipeline options evaluated (A / B / C with axis-by-axis comparison).
3. Recommended PDF path chosen: **Option A — native browser print-to-PDF + metadata-only snapshot**, for the first implementation sprint. Option B is deferred to a dedicated dependency-canon sprint.
4. Snapshot schema concept defined: **Option A — new `report_delivery_snapshots` table**, with explicit column list.
5. R2 readiness gate defined: nine mandatory checks + default behavior choice + stale-data acceptance UX.
6. Export-time claim-guard strategy defined: full 26-pattern scan over title + section fields + exhibit takeaways + appendix notes; failure blocks generation and records violations on the snapshot row.
7. Group-A / Group-B inclusion policy defined: Group-A omit-by-default for fallback; Group-B excluded entirely with the explicit machine-readable confirmation entry in `omitted_exhibits`.
8. Storage / access / download policy defined: no public route, no public bucket, no share token in Sprint 4C, signed-URL TTL ≤ 15 minutes if storage is added later, downloads emit auditable events.
9. `Export Report` unlock boundary defined: unlocks **only** when R2 implementation lands; renamed to `Generate PDF Candidate` (operator-only). Anti-patterns from `docs/19` § Locked Control Policy reaffirmed.
10. Sprint 4C implementation plan defined: single-sprint Sprint 4C-B (if Option A approved) or split Sprint 4C-B/C/D (if Option B or any open decision deferred).
11. `docs/08_CURRENT_STATUS.md` and `docs/10_SESSION_HANDOFF.md` are updated.
12. No source / schema / API / package / PDF / public-surface files changed.

---

## Pointer-Forward

Future Sprint 4C implementation agents (4C-B / 4C-C / 4C-D, whichever path lands) **must** treat this canon as the source of truth for the PDF candidate surface. Deviations — adding a PDF library outside Option A's no-dependency posture, persisting a binary artifact when metadata-only is canonized, repurposing the `report_delivery_snapshots` table for non-delivery use, lowering the R2 gate, dropping the claim-guard rerun, including Group-B exhibits, unlocking `Send to Client` outside Sprint 4D — require a canon amendment landed in this document **before** the corresponding code change is authored.

The internal preview at `/app/engagements/[id]/report/print` and the Sprint 4B light/print palette are the baseline. The Sprint 4C candidate route extends them with the snapshot + claim-guard + R2 boundary; the artifact remains operator-only until Sprint 4D and a separate share-token / CRM-integration canon authorize client-bound delivery.

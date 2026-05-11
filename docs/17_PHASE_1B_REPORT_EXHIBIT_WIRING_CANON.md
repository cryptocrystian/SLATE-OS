# SLATE Phase 1B Report Exhibit Wiring Canon

## Status

- **Library state:** the eight-exhibit Phase 1B preview library is complete and was formally **accepted with notes** in `docs/16_PHASE_1B_PREVIEW_LIBRARY_ACCEPTANCE_AUDIT.md` (2026-05-11).
- **Sprint scope:** this document is **canon / scoping only**. It is **Sprint 0A — Wiring Canon Only**, ahead of the implementation sprint that follows.
- **No adapters are implemented in this sprint.** No file under `lib/charts/adapters/` is created.
- **No report sections are modified in this sprint.** No `report_sections.body` shape change, no `ReportWorkspace` edit, no new persisted column.
- **No client-facing surface is modified in this sprint.** Public scorecard, proposal builder, report builder, PDF export, and SOW surfaces are untouched.
- **No diagnostic surface is created in this sprint.** It is defined here as a future surface only.
- **No schema, migrations, API routes, AI synthesis, PDF export, or package dependencies change in this sprint.**
- This canon authorizes only the **future shape** of adapter and slot mapping work, not implementation.
- **Date:** 2026-05-11.
- **Branch:** `persistence/step-0-1-auth-shell`.
- **Audit reference:** `docs/16_PHASE_1B_PREVIEW_LIBRARY_ACCEPTANCE_AUDIT.md`.

---

## Why This Exists

The eight-exhibit preview library on `/app/charts-preview` is server-rendered, SVG-only, SSR-safe, and confined to static sample data declared at the call site. It does not touch persisted SLATE rows. Moving these exhibits into real engagement reports introduces a stack of new risks that the canon must separate before any code is written:

1. **Real-data risk.** Persisted rows arrive in shapes the exhibits do not understand. Without an adapter contract, every exhibit becomes a one-off integration with its own validation, its own freshness assumptions, and its own fallback policy.
2. **Client-facing risk.** A consulting-grade exhibit looks credible. Wiring it to real data without honoring the existing benchmark / financial gates (`docs/14`, `docs/15`) leaks unverified claims into client-facing surfaces. The audit re-confirmed that the three Gate-0 exhibits — Benchmark Comparison Bars, AI-Savings Waterfall, ROI Bridge — must stay preview-only until those gates advance.
3. **Gating drift risk.** Without a canon, an implementing sprint may quietly add Gate-0 exhibits to report sections "for completeness," eroding the canon-mandated boundary.
4. **Data-staleness risk.** Persisted rows change. An exhibit rendered inside a report can become misleading if the report was assembled before the underlying rows were corrected. There must be a freshness rule, even before there is a freshness implementation.
5. **Scope-creep risk.** Adapter work, report UI work, schema work, AI-synthesis section drafting, rich-text body work, and PDF export work are five separate workstreams. The acceptance audit recommended sequencing them through staged sprints; this canon makes that sequencing explicit.

The intent of this canon is to keep the exhibit library **pure** — exhibits know only their narrow input contract — and to move all integration risk behind a narrow **adapter layer** that future sprints will own.

The exhibit layer remains the contract that prevents library-leak (every exhibit lives inside `<ChartFrame>`, every primitive reads CSS variables, no exhibit imports `@visx/*` outside the approved seven packages). This canon adds the symmetrical contract on the data side.

---

## Exhibit Groups

The Phase 1B Preview Library Acceptance Audit (`docs/16`) classified each exhibit into one of two wiring groups. This canon restates the classification and locks it as the source of truth for the next implementation sprint.

### Group A — eligible for Sprint 0B adapter scaffolding

These five exhibits consume domain shapes that already exist in SLATE today. Wiring them is a matter of writing the adapter + slot map, not a matter of building new persistence. None is benchmark- or financial-gated.

| # | Exhibit | Exhibit component file | Future adapter file | Likely persisted source rows | Target report section slot | Eligibility reason | Caveats |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Executive Summary 2×2 | `components/charts/exhibits/executive-summary-2x2.tsx` | `lib/charts/adapters/executive-summary-2x2-adapter.ts` | `opportunities` (impact, complexity), with optional bubble-size proxy + recommended-item flag derived from existing `priority`/`quadrant` fields | `executive_summary_portfolio` | Bubble-size encodes a safe ROI proxy that already exists in SLATE (business impact). Exhibit reads as part of one design system with the operator's editing matrix. No benchmark / financial data required. | Bubble size MUST NOT be relabeled as a financial figure. The canon's "safe proxy" framing is the contract. |
| 2 | Risk-Adjusted Priority Quadrant | `components/charts/exhibits/risk-adjusted-priority-quadrant.tsx` | `lib/charts/adapters/risk-adjusted-priority-quadrant-adapter.ts` | `opportunities` (impact, complexity, risk) | `findings_risk_priority` | The exhibit already exports a pure adapter `opportunityToRiskQuadrantPoint` from its source file — the adapter scaffolding can re-export and extend it without churn. | Quadrant midlines must remain at 50/50 — the analytical-view convention is intentionally distinct from the 70/60 thresholds in `lib/opportunities/helpers.ts` used by the operator's editing matrix. The two views answer different questions. |
| 3 | Capability Maturity Heatmap | `components/charts/exhibits/capability-maturity-heatmap.tsx` | `lib/charts/adapters/capability-maturity-heatmap-adapter.ts` | Approved `findings` rows tagged with `(capability, dimension)` + maturity scoring, OR a domain-specific maturity table if one is later added | `diagnostic_capability_maturity` | The 4-band maturity rule (`0–39 risk · 40–59 warning · 60–79 info · 80–100 success`) is deterministic from `maturityScore`; nothing benchmark-derived. | If the `(capability, dimension)` tagging does not yet exist on `findings`, the adapter must return `insufficient_data` rather than synthesizing tags. A future schema sprint may add tagging; that work is out of scope for Sprint 0B. |
| 4 | Stakeholder Coverage Matrix | `components/charts/exhibits/stakeholder-coverage-matrix.tsx` | `lib/charts/adapters/stakeholder-coverage-matrix-adapter.ts` | `stakeholder_intake_responses` aggregated by role × topic, mapped to the 4-tone evidence-strength scale (`missing → neutral`, `thin → warning`, `adequate → info`, `strong → success`) | `diagnostic_stakeholder_coverage` | The exhibit deliberately distinguishes `missing` (no row) from `thin` (low response count) so coverage gaps are visible. The aggregation rule is deterministic. | Role and topic axes are determined by the engagement's intake template, not by the exhibit — the adapter must accept role/topic arrays as an explicit argument rather than inferring them from the data alone. |
| 5 | Roadmap Gantt with Dependencies | `components/charts/exhibits/roadmap-gantt-with-dependencies.tsx` | `lib/charts/adapters/roadmap-gantt-adapter.ts` | `roadmap_items` with `phase` / `startOffset` / `durationDays` / `dependencyIds` / `status`, plus an optional `todayOffset` from the engagement's start date | `roadmap_90_day_sequence` | The exhibit already clamps out-of-range items, normalizes invalid durations, and drops unknown dependency ids — its defensive behavior matches what an adapter would otherwise need to enforce. | Forward-in-time dependency rule must be preserved. An edge whose source `id` is missing must be silently dropped at the adapter, not at the exhibit. |

**Adapter file inventory for Sprint 0B (NOT created in this sprint):**

```
lib/charts/adapters/
  executive-summary-2x2-adapter.ts
  risk-adjusted-priority-quadrant-adapter.ts
  capability-maturity-heatmap-adapter.ts
  stakeholder-coverage-matrix-adapter.ts
  roadmap-gantt-adapter.ts
```

### Group B — gated / not eligible for client-facing wiring yet

These three exhibits remain on `/app/charts-preview` only. They MUST NOT be wired into reports, proposals, the public scorecard, or PDF export until the relevant canon advances its data tier.

| # | Exhibit | Gated by | Wiring restored when | Allowed today |
| --- | --- | --- | --- | --- |
| 1 | Benchmark Comparison Bars | `docs/14_PHASE_1B_BENCHMARK_DATA_CANON.md` | A Gate 1 (`internal_directional`) or Gate 2 (`validated`) dataset exists and a separate sprint approves wiring at the corresponding tier per `docs/14`. | Static `illustrative` dataset on `/app/charts-preview` only. |
| 2 | AI-Savings Waterfall | `docs/15_PHASE_1B_FINANCIAL_ASSUMPTIONS_CANON.md` | A Gate 1 (`operator_estimated`), Gate 2 (`client_validated`), or Gate 3 (`finance_approved`) assumption set exists and a separate sprint approves wiring at the corresponding tier per `docs/15`. | Static `illustrative` assumption set on `/app/charts-preview` only. |
| 3 | ROI Bridge | `docs/15_PHASE_1B_FINANCIAL_ASSUMPTIONS_CANON.md` | Same as AI-Savings Waterfall. | Static `illustrative` assumption set + sensitivity bands on `/app/charts-preview` only. |

**Group B explicit rules:**

- Group B exhibits **MAY NOT** be included in the report-section slot mapping (defined below).
- Group B exhibits **MAY NOT** appear on any client-facing surface (report, proposal, public scorecard, PDF export, SOW).
- Group B exhibits **MAY** continue to appear on `/app/charts-preview` until the data gate advances.
- The Sprint 0B diagnostic surface (also defined below) **MUST OMIT** Group B entirely. The diagnostic surface is for adapter validation; Group B has no eligible adapter under Gate 0.
- Wiring Group B prematurely is a canon breach. Any future sprint that wants to wire a Group B exhibit must first land a Gate-advancement sprint against `docs/14` or `docs/15`.

---

## Report Section Slot Vocabulary

Slots are how a `report_sections` row references an exhibit without coupling the section's persisted shape to a specific component. A slot is a stable identifier that maps 1-to-1 to one Group-A exhibit (in this sprint) and is used by future report-section rendering to decide which adapter + exhibit to mount.

This vocabulary is **define-only**. The actual TypeScript declaration of the type lives under `lib/charts/adapters/` in Sprint 0B; this canon fixes its shape.

```ts
type ReportExhibitSlot =
  | "executive_summary_portfolio"
  | "findings_risk_priority"
  | "diagnostic_capability_maturity"
  | "diagnostic_stakeholder_coverage"
  | "roadmap_90_day_sequence";
```

| Slot | Purpose | Allowed exhibit | Expected report section | Required data readiness | Fallback if data is missing | Client-facing eligible at adapter-implementation time? |
| --- | --- | --- | --- | --- | --- | --- |
| `executive_summary_portfolio` | Single-page visual summary of the engagement's opportunity portfolio for non-technical readers. | `ExecutiveSummary2x2` | "Executive Summary" / "Opportunity Portfolio" sections | `≥ 3` approved opportunities (fewer renders insufficient-data state). | Card chrome remains; SVG is replaced by an explicit "Approve at least three opportunities to assemble the portfolio chart." note with a deep link to `/app/engagements/[id]/opportunities`. | Yes — non-gated. Only after operator review of the live adapter on the diagnostic surface. |
| `findings_risk_priority` | Analytical 2×2 grouping opportunities by impact × complexity with risk-band coloring. | `RiskAdjustedPriorityQuadrant` | "Findings — Opportunity Prioritization" / "Risk-Adjusted Priorities" | `≥ 2` approved opportunities. | Insufficient-data state with deep link to the matrix. | Yes — non-gated. |
| `diagnostic_capability_maturity` | Capability × dimension maturity grid surfacing where the org is behind / ahead. | `CapabilityMaturityHeatmap` | "Diagnostic" / "Capability Maturity" | At least one capability row and one dimension column with `≥ 1` populated cell — see `Fallback Rules` below. | Insufficient-data state instructing operator to tag findings with `(capability, dimension)`. | Yes — non-gated. Requires the `(capability, dimension)` tagging exists; if not, the slot renders the insufficient-data state. |
| `diagnostic_stakeholder_coverage` | Role × topic intake-coverage grid surfacing evidence gaps before the report is treated as fully grounded. | `StakeholderCoverageMatrix` | "Diagnostic Appendix" / "Evidence Coverage" | `≥ 1` stakeholder intake response. | Insufficient-data state with deep link to `/app/engagements/[id]/intake`. | Yes — non-gated. |
| `roadmap_90_day_sequence` | 30/60/90-day timeline with right-angle dependency arrows and a brand-primary Today marker. | `RoadmapGanttWithDependencies` | "Roadmap" | `≥ 1` roadmap item. | Insufficient-data state with deep link to `/app/engagements/[id]/roadmap`. | Yes — non-gated. |

**Slot vocabulary rules:**

- A `ReportExhibitSlot` value **MUST** be unique and stable across releases. Adding a new slot is a canon amendment (new slot row above), not a silent code change.
- No slot may reference a Group-B exhibit under this canon.
- Slot strings **MUST** use `snake_case` and **MUST** start with the section family (`executive_summary_`, `findings_`, `diagnostic_`, `roadmap_`) so the slot's intended location is readable.
- The `report_sections` table does **NOT** change shape in this sprint. How a slot reference is persisted (a `slot` column? a richer `body` block? an intermediate `report_section_exhibits` table?) is deferred to Sprint 2, which owns the section model.

---

## Adapter Contract

Adapters are the only bridge between persisted SLATE rows and exhibit input contracts. They are the contract that keeps exhibits data-shape-pure.

### Behavioral contract

An adapter:

- **MUST** be a pure function.
- **MUST** live under `lib/charts/adapters/`.
- **MUST NOT** import React, JSX, or any UI primitive.
- **MUST NOT** import the database client, the Supabase server client, the Supabase browser client, or any route handler.
- **MUST NOT** import any chart primitive from `components/charts/primitives/`.
- **MUST** accept already-fetched persisted rows as arguments. Fetching is the caller's responsibility.
- **MAY** import exhibit prop / point types (e.g. `RiskAdjustedQuadrantPoint`) from `components/charts/exhibits/*` so the adapter return type is exact.
- **MUST** perform deterministic validation and normalization. Same input ⇒ same output.
- **MUST NEVER** fetch data.
- **MUST NEVER** mutate input rows.
- **MUST NEVER** import app routes or anything under `app/`.
- **MUST** return source-note-ready metadata so the caller can render a canon-compliant `<ChartSourceNote>` without re-counting rows.
- **MUST** prefer `insufficient_data` over synthesizing data. **Inventing sample rows when persisted rows are absent is a canon breach.**
- **MUST NOT** bypass exhibit-level validation. If the exhibit itself rejects a shape, the adapter must reject it earlier and surface an issue.
- **MUST NOT** advance a Group-B exhibit out of preview-only. If a future caller passes Group-B input to an adapter, the adapter returns `{ status: "gated" }` and an issue with code `gate_not_satisfied`.

### Generic result type

Adapters return a typed result envelope. The implementing sprint declares it in `lib/charts/adapters/types.ts`; the canonical shape is:

```ts
type ChartAdapterStatus =
  | "ready"
  | "insufficient_data"
  | "invalid_data"
  | "gated";

interface ChartAdapterIssue {
  code: string;                 // e.g. "missing_opportunities", "stale_findings"
  severity: "info" | "warning" | "error";
  message: string;              // operator-readable, never displayed to the client
  field?: string;               // optional: row column the issue points at
}

interface ChartAdapterResult<TProps> {
  status: ChartAdapterStatus;
  props?: TProps;               // present only when status === "ready"
  issues: ChartAdapterIssue[];  // always an array; empty if no issues
  sourceSummary: {
    source: string;             // e.g. "Approved opportunities"
    rowCount: number;
    generatedAt: string;        // ISO 8601 UTC
    freshness: "fresh" | "stale" | "unknown";
  };
}
```

### Status semantics

- `"ready"` — `props` is present, the exhibit may render, the source note is canon-compliant.
- `"insufficient_data"` — the exhibit must NOT render. The caller renders the slot-specific empty state (see `Fallback Rules`). `issues` enumerates what is missing; `sourceSummary.rowCount` is the observed (sub-threshold) count.
- `"invalid_data"` — input rows violate an exhibit invariant the adapter detected (e.g. risk score out of 0–100). The exhibit must NOT render. `issues` enumerates the violations; the diagnostic surface displays them; the report-facing renderer falls back to the empty state and logs.
- `"gated"` — Group-B input reached an adapter. The exhibit must NOT render anywhere. `issues` contains a single `gate_not_satisfied` entry referencing the relevant canon (`docs/14` or `docs/15`).

### Disallowed adapter behaviors

- ❌ Performing any I/O (network, file, database).
- ❌ Reading from `process.env`.
- ❌ Throwing — adapters must surface failure through `status` and `issues`, never `throw`.
- ❌ Using `Date.now()` to compute `generatedAt` directly — the caller passes a clock token so the result is testable and deterministic at the call site. (Implementation detail for Sprint 0B; this canon only fixes the principle.)
- ❌ Returning partial `props` when `status !== "ready"`. The discriminated union is the safety contract.

---

## Data Freshness Rules

Adapters declare a `freshness` value on every output. The canon fixes the rules; the implementing sprint encodes the thresholds.

- **`generatedAt`** is **required** on every adapter output. The caller passes the wall-clock instant (or a derived clock token) so adapter pure-ness is preserved.
- **Stale threshold:** **7 days** by default for report-facing diagnostics. A future per-exhibit override may shorten this (e.g. roadmap diagnostics may tighten to 3 days), but no exhibit may extend it without a canon amendment.
- **`"fresh"`** — the source rows were last touched ≤ stale-threshold ago.
- **`"stale"`** — the source rows were last touched > stale-threshold ago. **MAY** render on the operator diagnostic surface with a visible "Stale data" warning. **MUST NOT** be silently embedded in final PDF / report exports — the report-export path must either re-derive or refuse with a clear notice.
- **`"unknown"`** — the source's last-touched timestamp is not available (e.g. legacy rows). Treated as `"stale"` for client-facing purposes; renders with an explicit "Source timestamp unavailable" footnote.
- **Missing data** is never silently replaced with sample / illustrative data. Adapter returns `"insufficient_data"`.
- Freshness is determined per-adapter from the most-recently-touched persisted row in the relevant source set, not from a wall-clock heuristic.

---

## Fallback Rules

For each Group-A exhibit, the report-facing slot has a deterministic empty / insufficient-data state. **The fallback is always operator-facing copy that points at a fix, never a fake chart.**

| Source data state | Adapter status | Caller behavior |
| --- | --- | --- |
| **No `opportunities` rows** (Executive Summary, Risk Quadrant) | `insufficient_data` (code `no_opportunities`) | Render Card chrome with copy: "No opportunities have been added to this engagement yet." Deep link → `/app/engagements/[id]/opportunities`. |
| **No approved findings** (Capability Maturity) | `insufficient_data` (code `no_approved_findings`) | Card chrome with copy: "Approve findings tagged with capability and dimension to assemble the maturity heatmap." Deep link → `/app/engagements/[id]/findings`. |
| **Findings exist but lack `(capability, dimension)` tagging** | `insufficient_data` (code `untagged_findings`) | Card chrome with copy explaining the tagging requirement; deep link → findings. |
| **No stakeholder intake responses** | `insufficient_data` (code `no_intake_responses`) | Card chrome with copy: "Invite stakeholders and collect intake responses to assemble the coverage matrix." Deep link → `/app/engagements/[id]/intake`. |
| **No roadmap items** | `insufficient_data` (code `no_roadmap_items`) | Card chrome with copy: "Sequence opportunities into a 30 / 60 / 90 roadmap to assemble the timeline." Deep link → `/app/engagements/[id]/roadmap`. |
| **Too few rows for meaningful chart** (e.g. 1 opportunity for a 2×2) | `insufficient_data` (code `below_minimum`) | Card chrome with copy stating the minimum row count; deep link to the relevant editing surface. |
| **Invalid row values** (e.g. impact > 100) | `invalid_data` (code `invariant_violated`) | Card chrome with copy: "The underlying data has an unexpected value and cannot be charted. Please contact the operator." Diagnostic surface displays the per-issue detail; logs the issue. **Never** silently coerces. |
| **Missing source metadata** (no `generatedAt`, no row timestamps) | `insufficient_data` (code `missing_source_metadata`) | Card chrome with copy: "Source metadata is incomplete; the chart cannot be assembled until row timestamps are available." |

**Two absolute rules apply across every fallback:**

1. **Never fall back to static preview / illustrative / sample data.** The preview-library datasets live exclusively in `app/app/charts-preview/page.tsx` and are forbidden from appearing in any other code path.
2. **Always render the Card chrome** (eyebrow, title, takeaway, source-note slot). The chart area swaps to the fallback copy; the surrounding chrome stays. This keeps the section visually anchored in the report layout while honestly stating its empty state.

---

## Diagnostic Surface Rules

A future operator-only diagnostic surface is the only Sprint 0B-eligible UI. It exists to validate adapters against one real persisted engagement before any exhibit is wired into a client-facing surface.

### Recommended route

**Use:** `app/app/engagements/[id]/chart-diagnostics/page.tsx`.

**Why this path and not `app/app/charts-diagnostics/[engagementId]/page.tsx`:**

- Co-located with the engagement workspace, matching the existing pattern (`intake`, `findings`, `opportunities`, `roadmap`, `report`, `proposal` all live under `[id]`).
- Re-uses the existing engagement auth boundary (operator-only via `/app/*` middleware).
- Re-uses the engagement context (the `[id]` route param is already SLATE's UUID + slug primitive).
- Avoids a parallel top-level diagnostics tree that operators would need to remember separately.

### Rules

- **Operator-only.** Lives under `/app/*` so the existing Supabase auth middleware gates it. Not added to the primary nav; reachable via direct URL only, or via a small "Chart diagnostics" link inside the engagement page's debug / settings region — placement is a Sprint 0B decision, not this canon's.
- **One engagement at a time.** The page reads the engagement's persisted rows server-side (via the existing `lib/<domain>/queries.ts` helpers — no new queries; reuse only).
- **Runs Group-A adapters only.** Sprint 0B implementation **MUST OMIT** Benchmark Comparison Bars, AI-Savings Waterfall, and ROI Bridge. Those exhibits remain on `/app/charts-preview` with their static illustrative data.
- **Renders the live exhibit + the adapter envelope side-by-side.** For each Group-A exhibit the page shows:
  - The exhibit (or its empty / insufficient-data state) inside its full `<ChartFrame>` card.
  - The `ChartAdapterResult` payload (status, issues, source summary, freshness) in a structured operator-readable panel underneath.
- **Read-only.** It MUST NOT write to any table. It MUST NOT call any mutation API route. It MUST NOT trigger AI synthesis runs.
- **Does not modify `report_sections`.** Even if the report-section slot is fully wired downstream, the diagnostic surface never writes a `report_section_exhibits` row, never patches the report's `assembled_at`, never sends a notification.
- **Not client-facing.** No part of the diagnostic surface may be linked from the public scorecard, the proposal, the report, or any external surface.
- **No PDF export.** The diagnostic surface does not export anything.
- **No new schema.** The diagnostic surface reads existing rows; no migrations.
- **Group-B exhibits are explicitly omitted.** Even with `static illustrative` data, a Sprint 0B diagnostic route should not render Benchmark / Waterfall / ROI Bridge — those exhibits already have a preview home on `/app/charts-preview`. Reserving the diagnostic surface for Group A only prevents accidental drift.

---

## Source-Note Rules For Report-Wired Group-A Exhibits

Once persisted-data wiring begins, exhibit source notes shift from preview-data wording to real source-count wording. The canon fixes the patterns; adapters compose the exact strings.

### Per-source default patterns

| Persisted source | Source-note text pattern |
| --- | --- |
| Opportunities | `Source: Approved opportunities · n=<count>` |
| Findings | `Source: Approved findings · n=<count>` |
| Stakeholder intake | `Source: Stakeholder intake responses · n=<count>` |
| Roadmap | `Source: 30/60/90 roadmap items · n=<count>` |

### Per-slot composition

Each Group-A slot composes one (or, where appropriate, two) of the per-source patterns. Adapters produce the exact `SourceNote` value; the caller passes it straight to `<ChartFrame sourceNote={...}>`.

| Slot | Composed source-note text |
| --- | --- |
| `executive_summary_portfolio` | `Source: Approved opportunities · n=<opportunityCount>` |
| `findings_risk_priority` | `Source: Approved opportunities · n=<opportunityCount>` (risk and complexity scores live on the opportunity row in SLATE today) |
| `diagnostic_capability_maturity` | `Source: Approved findings · n=<findingCount>` |
| `diagnostic_stakeholder_coverage` | `Source: Stakeholder intake responses · n=<responseCount>` |
| `roadmap_90_day_sequence` | `Source: 30/60/90 roadmap items · n=<itemCount>` |

### Rules

- Source notes **MUST** be derived from persisted row counts. Hand-tuned `n=<literal>` strings are forbidden once wiring lands.
- Source notes **MUST NOT** imply benchmark or financial data unless the exhibit is one of the three Gate-0 exhibits — and those are not wired in this sprint.
- Source notes **MUST NOT** use sample / illustrative wording (`"Static sample preview data · Phase 1B Sprint N"`, `"Illustrative sample data · …"`, etc.) once persisted wiring begins. Those strings belong exclusively to `/app/charts-preview`.
- Source notes **MUST** be passed through the existing `<ChartSourceNote>` / `<ChartFrame sourceNote={...}>` convention. Adapters do not render JSX themselves.
- When `n = 0`, the slot falls back to the insufficient-data state (above) rather than rendering `n=0` under a chart.
- The optional `n` field on `SourceNote` may be used; alternatively, the adapter may compose `n` inline into `text` to match the patterns above byte-for-byte. Sprint 0B picks one form and uses it consistently; this canon does not bind which.

---

## Report Wiring Sequence

The acceptance audit recommended sequencing the wiring work through staged sprints. This canon fixes the order. Each sprint is **independently approvable**; no sprint may start without explicit go-ahead.

| Sprint | Name | Scope | Out of scope | Authorizes |
| --- | --- | --- | --- | --- |
| **0A** | **Wiring Canon Only** *(this sprint)* | This document (`docs/17`). Updates to `docs/08` + `docs/10` reflecting acceptance. | All implementation, including adapter scaffolding, diagnostic route, schema, report-section model, AI synthesis Steps 3/4/5, PDF export. | Sprint 0B's scope. Nothing else. |
| **0B** | **Adapter scaffolding + diagnostic surface** | Create Group-A adapters under `lib/charts/adapters/` per the contract above. Create the diagnostic surface at `app/app/engagements/[id]/chart-diagnostics/page.tsx`. Add `lib/charts/adapters/types.ts` declaring the canonical `ChartAdapterResult<TProps>` envelope. | `ReportWorkspace` changes, `report_sections` schema/model changes, Group-B wiring, AI synthesis Steps 3/4/5, PDF export, public-scorecard wiring, package dep additions. | Sprint 1's scope. |
| **1** | **Report slot rendering — internal preview only** | Wire Group-A exhibits into the internal report preview (operator-only `/app/engagements/[id]/report`) by reading slot references from a thin section-side mapping. Slot mapping may live in a small `lib/reports/slot-map.ts` if needed, or remain inline in the report page. | PDF export. Client-facing "Send to client" or "Share". Any `report_sections.body` schema change beyond what is strictly necessary for slot rendering. Group-B wiring. | Sprint 2's scope. |
| **2** | **Report section model — constrained rich-text + exhibit references** | Define how `report_sections.body` references slots. Options: (a) constrained block model with an `exhibit_slot` block type; (b) a sibling `report_section_exhibits` table; (c) inline JSON in `body`. The Sprint-2 sprint picks one with operator review; this canon does not bind which. | PDF export, client-facing delivery. Group-B wiring. | Sprint 3's scope (once internal rendering and the slot vocabulary survive a real engagement walk-through). |
| **3+** | **PDF / export and client-facing delivery** | Real PDF export with embedded exhibits. Real "Prepare client review" / "Send to client" actions. Public scorecard PDF download. | Group-B wiring (still blocked on `docs/14` / `docs/15` advancement). | Future Gate-advancement sprints for `docs/14` and `docs/15` if Group-B exhibits are desired in client-facing surfaces. |

Sprint 0B begins only after this canon is committed and accepted.

---

## Non-Goals

This sprint **does not** authorize, schedule, or imply work on any of the following. They are explicitly deferred:

- ❌ Implementing any adapter under `lib/charts/adapters/`.
- ❌ Creating any diagnostic route (`app/app/engagements/[id]/chart-diagnostics/page.tsx` or similar).
- ❌ Editing `ReportWorkspace` or anything inside `app/app/engagements/[id]/report/`.
- ❌ Modifying `report_sections` schema, body, or render path.
- ❌ Modifying any proposal surface (`/app/engagements/[id]/proposal`, `ProposalWorkspace`, `ProposalOptionDetail`, etc.).
- ❌ Wiring the public scorecard (`/scorecard*`) to any exhibit.
- ❌ Wiring Benchmark Comparison Bars to any persisted surface (gated on `docs/14`).
- ❌ Wiring AI-Savings Waterfall to any persisted surface (gated on `docs/15`).
- ❌ Wiring ROI Bridge to any persisted surface (gated on `docs/15`).
- ❌ Schema changes, migrations, or new SQL views.
- ❌ API route additions, edits, or removals.
- ❌ AI synthesis Step 3 (report section drafting), Step 4 (proposal options), or Step 5 (roadmap drafting).
- ❌ PDF export of any kind.
- ❌ Visual polish work on any exhibit or primitive (the five `docs/16` polish items remain backlogged, not addressed).
- ❌ Package dependency changes — no `npm install`, no removal.
- ❌ Editing exhibits under `components/charts/exhibits/*`.
- ❌ Editing primitives under `components/charts/primitives/*`.
- ❌ Editing the canon source-of-truth docs (`docs/13`, `docs/14`, `docs/15`, `docs/16`). This sprint references them; it does not amend them.

---

## Acceptance Criteria

This canon is accepted when it:

- ✅ Defines Group A / Group B exhibit eligibility with explicit per-exhibit caveats.
- ✅ Defines a stable `ReportExhibitSlot` vocabulary with five named slots, each mapped to one Group-A exhibit, a target report section, and a required data-readiness state.
- ✅ Defines the pure-function adapter contract, including the typed result envelope (`ChartAdapterResult<TProps>` with `status`, `props`, `issues`, `sourceSummary`).
- ✅ Defines source-note rules for report-wired Group-A exhibits, with per-source patterns and per-slot composed strings.
- ✅ Defines freshness rules (`fresh` / `stale` / `unknown`, 7-day default, never silently embed stale in PDF) and a `generatedAt` requirement.
- ✅ Defines fallback rules for every Group-A exhibit, with the absolute rule that fallback never reverts to sample / illustrative data.
- ✅ Defines diagnostic-surface boundaries, including the recommended route, read-only posture, Group-A-only scope, and operator-only auth.
- ✅ Defines a staged wiring sequence (0A canon → 0B scaffolding → 1 internal rendering → 2 section model → 3+ PDF/export) with crisp per-sprint scope and non-goals.
- ✅ Explicitly blocks Group-B wiring until `docs/14` and `docs/15` advance their data gates.
- ✅ Makes clear no implementation is authorized in this sprint.

---

## Pointer-Forward

Future implementing agents **MUST** treat this canon (`docs/17_PHASE_1B_REPORT_EXHIBIT_WIRING_CANON.md`) as the source of truth for report exhibit wiring through Phase 1B. The companion canons (`docs/13` chart vocabulary, `docs/14` benchmark data, `docs/15` financial assumptions, `docs/16` preview-library acceptance) remain authoritative for their respective domains and are referenced here, not superseded.

Deviations from this canon require **canon amendment** (a new dated section in this document, or a successor doc with an explicit deprecation note here), **not silent implementation drift**. An agent that finds a clearer architecture mid-implementation must pause, propose the amendment, and wait for operator review before changing direction.

The canon may be safely updated in a future sprint to:

- Add new slots (always adding rows to the slot table; never silently repurposing existing slot strings).
- Tighten freshness thresholds per exhibit.
- Lift a Group-B exhibit to Group-A after the relevant data canon advances its gate.
- Replace the recommended diagnostic route path with an operator-preferred location (with a parallel canon update).

It may **not** be updated to:

- Wire a Group-B exhibit into a client-facing surface without the corresponding `docs/14` or `docs/15` gate advancement landing first.
- Permit adapters to fetch data, mutate rows, or throw.
- Permit slots to render sample / illustrative data in any non-preview surface.

The next-sprint candidate, **Phase 1B Report Exhibit Wiring Sprint 0B — adapter scaffolding + diagnostic surface**, becomes implementable only once this canon is committed.

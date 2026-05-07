# SLATE Phase 1B Chart & Exhibit Canon

_This doc is canon. It governs how SLATE produces consulting-grade exhibits inside reports, proposals, and customer-facing surfaces. It does not authorize building the eight required exhibits — that requires its own sprint approval._

---

## Status

- **Approved charting layer:** Visx (`@visx/*`, MIT, by Airbnb).
- **Current state:** Phase 1B proof-of-fit complete (commit `a39228f`). Exactly one exhibit ships today (Executive Summary 2×2, static sample data).
- **Scope of this doc:** canon only. Architecture rules, exhibit catalogue, quality bar, implementation order.
- **Not yet approved by this doc:** the remaining seven exhibits, report/proposal wiring, PDF export, AI drafting (Steps 3/4/5), document parsing, benchmark dataset sourcing.

---

## Why This Exists

The Phase 1A acceptance audit (`docs/12_PHASE_1A_ACCEPTANCE_AUDIT.md`, 2026-05-07) accepted SLATE as the **AdvisoryOps OS foundation** but identified the absence of any charting layer as the largest visible gap between that internal operating-system and the user's stated bar of **McKinsey/BCG/Bain-caliber consulting outputs**.

The audit found:

- Zero charting library installed in the codebase (`package.json` confirmed).
- The opportunity matrix is a CSS 2×2 layout, not a plot.
- The score card is a CSS bar.
- A McKinsey/BCG/Bain consulting deliverable typically carries 8–15 charts/exhibits per report. SLATE produced zero.

This canon closes the architecture half of that gap. The implementation half (the eight exhibits, report/proposal wiring, PDF export) is governed by separate sprint approvals downstream.

---

## Decision

1. **Visx is the SVG/vector primitive layer.** Visx renders pure SVG (no Canvas), is modular per-package (`@visx/scale`, `@visx/shape`, `@visx/axis`, `@visx/grid`, `@visx/group`, `@visx/text`, `@visx/responsive`), is unopinionated about styling, is SSR-safe by default, and renders crisp under PDF / print export.
2. **SLATE owns the visual language.** Visx is a primitive layer; the consulting-grade aesthetic is enforced by SLATE chart primitives that hard-code design tokens (Inter / JetBrains Mono / `tabular-nums`, `--color-*` CSS variables, lean muted strokes, mono uppercase axis labels, source-note footer, takeaway subtitle). The product must never look like an off-the-shelf dashboard library.
3. **Dark in-app + future light-theme PDF/export.** Every chart color is read from a CSS custom property. Switching to a light palette for PDF export is a token-redefinition change, not a chart-code change.

---

## Architecture Rules

These rules are hard. CI/review enforces them; deviations require a canon amendment, not a code review override.

1. **Only chart primitives may import `@visx/*`.** Files under `components/charts/primitives/` are the only place where `import { ... } from "@visx/..."` is allowed.
2. **Exhibits import primitives, not Visx.** Files under `components/charts/exhibits/` may import primitives, scales (`@visx/scale`), shape (`@visx/shape`), group (`@visx/group`), and text (`@visx/text`) — but should not reach into other Visx packages directly. If an exhibit needs a primitive that doesn't exist yet, **add the primitive first**.
3. **App pages import exhibits, not raw chart libraries or primitives.** Files under `app/`, `components/reports/`, `components/proposals/`, `components/scorecard/` may import exhibits only. They never import `@visx/*` directly. They never read tone / typography / margin constants from `lib/charts/types.ts` directly except to compose with an exhibit's API.
4. **No raw chart-library styling in product pages.** Inline SVG `fill` / `stroke` values, hex literals, or `style={{ color: "#...", fontFamily: "..." }}` chart-overrides are forbidden in `app/` and outside `components/charts/`. All chart styling flows through SLATE primitives.
5. **All chart colors must flow through SLATE CSS variables / chart tone mappings.** No hex literals except inside `lib/charts/types.ts`, which centralizes the variable lookup (`CHART_TONE_VAR`, `CHART_GRID_STROKE`, etc.). Charts inherit theme tokens directly via `var(--color-*)` on SVG `fill` and `stroke`.
6. **Every exhibit must have:** a title, a one-line takeaway, a legend where the visual encoding is non-obvious, and a source note. The `ChartFrame` primitive enforces all four. Source attribution is non-optional.
7. **Every exhibit must be readable without hover or tooltips.** A reader looking at the printed page must understand the takeaway with zero interactivity. Hover/tooltip is enhancement only, never required for report comprehension.
8. **Tooltips are enhancement only.** `@visx/tooltip` is intentionally not installed today. If an exhibit benefits from interactive detail in the operator workspace, the same exhibit must still communicate its takeaway statically when rendered into a report.
9. **SSR / static SVG is preferred.** The proof-of-fit exhibit is a pure server component. Future exhibits should follow the same posture wherever possible.
10. **Client wrappers (`"use client"`) are allowed only for responsive measurement or interactivity.** A client wrapper is justified when the exhibit must measure its container at runtime (`@visx/responsive`'s `ParentSize`) or when the operator workspace adds genuine interactivity (filter, hover-detail, drag-to-reorder). Client wrappers are not allowed as the default.
11. **PDF / export rendering uses fixed dimensions.** Every exhibit accepts explicit logical width / height as `viewBox` units; export pipelines pass fixed sizes. No `ParentSize` in the PDF render path.

---

## Existing Proof-of-Fit

The Visx proof-of-fit landed in commit `a39228f` and ships these files:

| File | Role |
| --- | --- |
| [`lib/charts/types.ts`](../lib/charts/types.ts) | Shared types, `ChartTone` vocabulary, `CHART_TONE_VAR` CSS-variable lookup, font stacks, default margins, `SourceNote` shape. |
| [`components/charts/primitives/chart-frame.tsx`](../components/charts/primitives/chart-frame.tsx) | Standard exhibit frame: eyebrow / title / takeaway / legend slot / SVG canvas / source-note footer. `viewBox` + `preserveAspectRatio="xMidYMid meet"` + `block h-auto w-full` for responsive scaling. Pure server component. |
| [`components/charts/primitives/chart-axis.tsx`](../components/charts/primitives/chart-axis.tsx) | SLATE-styled `AxisBottom` / `AxisLeft` (JetBrains Mono uppercase ticks, `--color-border-strong` strokes, `--color-text-muted` labels). |
| [`components/charts/primitives/chart-grid.tsx`](../components/charts/primitives/chart-grid.tsx) | SLATE-styled `GridRows` / `GridColumns` with subtle dashed `--color-border-subtle` strokes. |
| [`components/charts/primitives/chart-source-note.tsx`](../components/charts/primitives/chart-source-note.tsx) | Uppercase mono caption beneath every exhibit. Source attribution is non-optional. |
| [`components/charts/exhibits/executive-summary-2x2.tsx`](../components/charts/exhibits/executive-summary-2x2.tsx) | Phase 1B proof-of-fit. 7 static sample points, McKinsey-style impact × complexity portfolio with bubble size = ROI, color = evidence strength, dashed brand ring on the recommended item. |
| [`components/charts/README.md`](../components/charts/README.md) | Per-directory contract reference. |
| [`app/app/charts-preview/page.tsx`](../app/app/charts-preview/page.tsx) | Operator-only, unlinked preview route. Renders the proof-of-fit exhibit inside a real Card layout for visual review. |

What the proof-of-fit demonstrated:

- **SVG output.** Pure `<svg viewBox>` with `<g>`, `<line>`, `<circle>`, `<text>` elements. Zero canvas.
- **SLATE visual language.** Every color through `var(--color-*)`. Ticks in `var(--font-mono)` 10px letter-spacing 1.2 uppercase. Quadrant labels in `var(--font-mono)` 9px letter-spacing 1.6 uppercase. Data-point labels in `var(--font-sans)` 11px `--color-text-secondary`. Recommended ring in `--color-brand-primary` dashed `2 3`.
- **Dark theme compatibility.** All colors read from CSS variables that are dark-theme-defined; will switch to light theme transparently when those variables are redefined for the PDF render path.
- **Responsive card rendering.** `viewBox` + `preserveAspectRatio="xMidYMid meet"` + `block h-auto w-full` scales to any Card width while preserving the 880:540 (~16:10) aspect ratio.
- **Lint / build clean.** `npm run lint` passes; `NEXT_TELEMETRY_DISABLED=1 npm run build` compiles successfully (26 routes).
- **No bundle growth on non-chart routes.** All 24 pre-existing routes have identical First Load JS to baseline. Per-package Visx imports tree-shake; uninvolved routes pay zero bytes.
- **Server-component posture.** No `"use client"` boundary anywhere in the chart pipeline. The exhibit, the four primitives, and the seven Visx packages all run as server components. The browser receives only the static SVG markup.

---

## Exhibit Quality Bar

"Consulting-grade" inside SLATE means every exhibit, including the static printed PDF version, satisfies:

- **Executive-readable in 10 seconds.** A senior reader gets the takeaway in one glance. The exhibit does not require studying the legend to understand the headline.
- **One clear takeaway.** The takeaway line under the title states what the exhibit shows. If the takeaway can't be written in one sentence, the exhibit is showing too much.
- **Strong title and subtitle/takeaway.** Title is a noun phrase ("Opportunity portfolio · impact × complexity"). Takeaway is a short sentence stating the finding.
- **Minimal chartjunk.** No 3D effects, no drop shadows on bars, no double axes, no gradient fills inside data marks, no decorative borders.
- **Labeled axes and visible scale.** Every axis carries a label and visible ticks. Scales are obvious without measuring.
- **Evidence/source note.** Every exhibit carries a source line. Source attribution is non-optional and is enforced at the primitive level.
- **Annotations for important data points.** The recommended item, the "Today" marker, the executive priority, the outlier — call them out directly with a leader line, a circled marker, or a labeled callout. Don't make the reader hunt.
- **Printable / vector-safe.** Crisp at 100%, 200%, 50% scale. No raster fallbacks. Exports cleanly to PDF.
- **No dashboard-toy feel.** Charts must look like consulting exhibits, not like product widgets. No animation defaults, no hover-pulse, no rounded "card surface" inside the SVG.
- **No gratuitous gradients or animations.** Gradients inside data marks are forbidden. Animation, if used at all, is reserved for the operator workspace and must never appear on the printed/exported page.
- **No unsupported ROI or benchmark claims.** Numerical claims must be either (a) static sample data clearly labeled as such, (b) derived from persisted SLATE data, or (c) sourced from a documented benchmark dataset. Made-up ROI numbers are forbidden anywhere in the production exhibit set.

---

## Required Phase 1B Exhibit Library

Eight exhibits. Each has a fixed name and is the unique SLATE artifact for its narrative slot.

### 1. Executive Summary 2×2

- **Purpose.** One-page-of-the-deck portfolio orientation. Shows where engagement opportunities sit on impact × complexity. Bubble size = ROI proxy. Color = evidence strength. Dashed brand-tinted ring on the recommended item.
- **Data inputs.** Per-opportunity `{ id, title, businessImpactScore, complexityScore, riskScore, evidenceStrength, recommended? }`. ROI proxy derived from a placeholder until the financial model lands.
- **Visual structure.** 2×2 quadrant grid, dashed midlines, four corner labels (`QUICK WINS`, `STRATEGIC BUILDS`, `LOW PRIORITY`, `DEFER · AVOID`), bubble plot with size scale.
- **Expected source note.** "Source: Approved findings + scored opportunities · n=&lt;count&gt;".
- **Implementation dependencies.** `ChartFrame`, `ChartGrid`, `ChartAxisBottom`, `ChartAxisLeft` (existing). Reuses 2×2 mechanics from the proof-of-fit. Final version may add `chart-annotation` primitive for the recommended-item callout.
- **Static derived OK?** Yes for visual structure. The ROI bubble-size axis is the weak input — until the financial model is finalized, ship with `business_impact_score`-driven sizing or omit bubble-size variation entirely. Final version of this exhibit lands last in the implementation order, after the downstream financial assumptions are settled.

### 2. Capability Maturity Heatmap

- **Purpose.** Show maturity across capability × dimension. Used in the Findings / Diagnostic section of the report.
- **Data inputs.** Per-cell `{ capability, dimension, maturityScore (0–100), supportingFindingCount }`. Sourced from scorecard answers + intake response coverage.
- **Visual structure.** Rectangular grid, rows = capabilities, columns = dimensions. Cell color follows `success → info → warning → risk` tone scale by maturity band. Small numeric overlay inside each cell. Row + column labels in `font-mono` uppercase tracking-1.4.
- **Expected source note.** "Source: Stakeholder intake responses + scorecard answers · n=&lt;sessions&gt;".
- **Implementation dependencies.** New primitive `chart-heatmap-cell` (wraps `@visx/heatmap` `HeatmapRect` + cell label rendering). Existing `ChartFrame`.
- **Static derived OK?** Yes. Cells derive entirely from existing scorecard answers + persisted intake responses.

### 3. AI-Savings Waterfall

- **Purpose.** Show how the current cost/effort baseline breaks into AI-impacted savings, residual cost, and the realized state. Classic consulting savings narrative.
- **Data inputs.** `{ currentBaseline, contributions: [{ label, deltaValue, sign }], realizedState }`. Each contribution is positive (savings) or negative (residual).
- **Visual structure.** Bars with stack offsets along a horizontal axis; small connector lines between bar tops; a total bar at the right. Labels above each bar with delta value.
- **Expected source note.** "Source: Engagement scoping assumptions · validated during build".
- **Implementation dependencies.** New primitive `chart-waterfall-bar` (Bar + connector Line). Existing `ChartFrame`, `ChartAxisBottom`, `ChartAxisLeft`.
- **Static derived OK?** **No.** Waterfall numbers depend on a ROI/savings model that does not yet exist. Do not ship with placeholder financials. Build last.

### 4. ROI Bridge

- **Purpose.** Year-1 → year-3 ROI bridge with sensitivity bands. Goes in the proposal commercial section.
- **Data inputs.** `{ y1Value, y2Value, y3Value, p25/p75 sensitivity bands per year, todayMarker }`.
- **Visual structure.** Horizontal time axis (Y1 / Y2 / Y3); shaded band between p25 and p75; central line with markers at each year; "Today" annotation; final-year endpoint label.
- **Expected source note.** "Source: Proposal commercial assumptions · validated during scope".
- **Implementation dependencies.** New primitives `chart-projection-line` (LinePath) and `chart-band-area` (AreaClosed). Future `chart-annotation` primitive for the "Today" marker.
- **Static derived OK?** **No.** Same financial-model dependency as Waterfall. Build after the financial assumptions are committed.

### 5. Roadmap Gantt with Dependencies

- **Purpose.** Visualize the 30/60/90 roadmap as a time-axis Gantt with dependency arrows. Today-marker in the middle.
- **Data inputs.** Per-item `{ id, title, phase, startOffset, durationDays, dependencyIds, ownerPlaceholder, status }`.
- **Visual structure.** Rows = items grouped by phase; horizontal bars span time; arrow connectors between dependent items; vertical "Today" marker.
- **Expected source note.** "Source: 30/60/90 roadmap items".
- **Implementation dependencies.** New primitives `chart-gantt-bar` (Bar + label) and `chart-dependency-arrow` (LinePath + arrowhead marker). Existing `ChartFrame`, `ChartAxisBottom` (time), `ChartAxisLeft` (band of items).
- **Static derived OK?** Yes. Derives from `roadmap_items`. No new model required.

### 6. Risk-Adjusted Priority Quadrant

- **Purpose.** True 2×2 scatter (impact × complexity) with bubble size = ROI proxy and color = risk band. The analytical big-brother of Executive Summary 2×2 — uses real persisted opportunity scores as the input.
- **Data inputs.** Per-opportunity `{ title, businessImpactScore, complexityScore, riskScore, evidenceStrength }`.
- **Visual structure.** Same 2×2 mechanics as Executive Summary, but driven by real persisted data and using risk-banded color (success / warning / risk / critical) rather than evidence strength.
- **Expected source note.** "Source: Persisted opportunities · scoring sourced from review-bar".
- **Implementation dependencies.** Existing `ChartFrame`, `ChartGrid`, `ChartAxisBottom`, `ChartAxisLeft`. Reuses 2×2 mechanics from the proof-of-fit. Build first to harden the 2×2 mechanics on real data.
- **Static derived OK?** Yes. Derives entirely from `opportunities`.

### 7. Stakeholder Coverage Matrix

- **Purpose.** Show role × question coverage for stakeholder intake. Cell color = response evidence strength; missing = gray.
- **Data inputs.** Per-cell `{ role, questionId, evidenceStrength | "missing" }`.
- **Visual structure.** Heatmap; rows = roles, columns = questions. Cell color uses the same tone scale as Capability Maturity. Empty cells render as `--color-border-subtle` blocks.
- **Expected source note.** "Source: Stakeholder intake sessions · n=&lt;sessions&gt;".
- **Implementation dependencies.** Reuses the `chart-heatmap-cell` primitive built for Capability Maturity. No new primitives once #2 ships.
- **Static derived OK?** Yes. Derives from `stakeholder_intake_sessions` + `stakeholder_responses`.

### 8. Benchmark Comparison Bars

- **Purpose.** Show the client's score vs peer percentile bands per dimension (AI readiness, workflow friction, systems readiness, etc.). Public scorecard result-page primary exhibit.
- **Data inputs.** Per-dimension `{ label, clientScore, p25, p50, p75 }`.
- **Visual structure.** Horizontal bar per dimension; client score plotted as a marker; peer bands rendered as background grouped rectangles (light/medium/dark) corresponding to p25/p50/p75 bins.
- **Expected source note.** "Source: Saipien Labs benchmark dataset · vintage &lt;date&gt;".
- **Implementation dependencies.** New primitive `chart-percentile-band`. Existing `ChartFrame`.
- **Static derived OK?** **No.** Requires the benchmark dataset that does not yet exist. Phase 1B has this exhibit's prerequisite as an explicit deferred backlog item.

---

## Recommended Implementation Order

When the eight-exhibit sprint is approved, build in this order. Override only on user instruction.

1. **Risk-Adjusted Priority Quadrant.** Reuses proof-of-fit 2×2 mechanics with real persisted data. Hardens the 2×2 toolchain (scales, axis primitive, grid primitive) on production inputs before any new primitive lands.
2. **Capability Maturity Heatmap.** Forces the first new primitive (`chart-heatmap-cell`). Keeps the visual vocabulary discipline by establishing heatmap mechanics in a familiar narrative slot before the more complex Stakeholder Coverage Matrix.
3. **Stakeholder Coverage Matrix.** Reuses the heatmap primitive. Validates that the primitive is actually reusable — if it isn't, refactor the heatmap primitive before any other exhibit.
4. **Roadmap Gantt with Dependencies.** Introduces the time-axis + dependency-arrow primitives. Independent narrative slot, no financial assumptions.
5. **Benchmark Comparison Bars.** Introduces `chart-percentile-band`. Will likely ship without real data first (placeholder bands clearly labeled "illustrative") and gain real numbers when the benchmark dataset lands. Sequencing this here is conditional on the benchmark dataset being scoped — if not, defer with #6 / #7.
6. **AI-Savings Waterfall.** Introduces waterfall-bar primitives. Holds for the financial model.
7. **ROI Bridge.** Same financial-model dependency. Builds on the waterfall mechanics + introduces the band-area primitive.
8. **Finalized Executive Summary 2×2.** Re-do the proof-of-fit exhibit using real persisted data, real ROI sizing (financial-model-backed), and the matured `chart-annotation` primitive. The proof-of-fit version is replaced; the seven downstream exhibits all already ship by this point.

**Why this order:**

- Build from already-proven 2×2 mechanics first. Risk-Adjusted Priority Quadrant validates that the proof-of-fit primitives hold up under real persisted data.
- Establish the heatmap primitive (Capability Maturity) before the harder consumer of that primitive (Stakeholder Coverage Matrix). One primitive, two exhibits.
- Avoid financial overclaiming until ROI assumptions and the benchmark dataset are settled. Waterfall and ROI Bridge land last so SLATE never ships a printed exhibit with unsupported numbers.
- The final Executive Summary 2×2 should compose from mature downstream exhibits — its annotations, ROI sizing, and recommended-item rules will all benefit from the discipline established by exhibits #1 through #7.

---

## Accessibility and Export Requirements

- **SVG `<title>` / `<desc>` where appropriate.** Every exhibit's outer `<svg>` carries a `role="img"` and an `aria-label` matching the exhibit title (already enforced in `ChartFrame`). Series with multiple data marks should provide a `<title>` per mark when individual identification matters for screen-reader navigation.
- **Meaningful labels for data series.** Color-coded series must include a legend in the rendered output. The legend reads as part of the printed page.
- **No color-only semantics.** Every color-coded data category must also carry a label, marker shape, or band — color alone never communicates the distinction.
- **Source notes visible in exported output.** PDF / DOCX export pipelines must preserve the source-note footer. Stripping the source note in export is forbidden.
- **Print-safe dimensions.** Every exhibit declares logical SVG dimensions in `viewBox` units and renders crisp at any output size. No rasterization in the export path.
- **Light/dark palette readiness.** Every chart color flows through a CSS variable. The light palette is defined as a separate set of `--color-*` overrides applied in the export render path; chart code does not switch palettes itself.
- **Readable at PDF scale.** Tick labels and data labels must remain legible at 72 dpi PDF rendering. Default tick-label sizes (10px logical units inside an 880×540 viewBox) are calibrated for that scale; do not shrink without re-validating against a printed sample.
- **No reliance on hover state.** Reiterating Architecture Rule #7 — hover and tooltip are enhancement only. The static printed exhibit must communicate its takeaway with zero interaction.

---

## Phase 1B Non-Goals

This canon does not authorize, scope, or define any of the following. Each is governed by a separate (later) approval:

- Report section AI drafting (AI Synthesis Step 3).
- Proposal option AI drafting (AI Synthesis Step 4).
- Roadmap AI drafting (AI Synthesis Step 5).
- PDF / DOCX export implementation for reports or SOWs.
- Document parsing (PDF / DOCX / CSV → text).
- Benchmark dataset sourcing.
- Financial model finalization (ROI / savings / sensitivity assumptions).
- CRM integration.
- E-signature integration.
- BuildOps surfaces.
- Client portal.

These remain explicit Phase 1B+ deferred items. The exhibit catalogue above identifies which of them gate which exhibits.

---

## Acceptance Criteria for the Canon

This canon is accepted when it:

- Approves Visx as the underlying charting layer.
- Preserves SLATE visual ownership — exhibits look like SLATE, not like an off-the-shelf library.
- Prevents chart-library leakage into app pages (app code never imports `@visx/*` directly).
- Defines all eight exhibits with purpose, inputs, structure, source note, dependencies, and data-readiness honesty.
- Defines the recommended implementation order with rationale.
- Makes clear that this canon **is not approval to build all eight exhibits yet** — that requires its own sprint approval, which the user controls.

---

## Pointer-Forward

When the eight-exhibit sprint is approved, the implementing agent should treat this canon as the source of truth for: which exhibits exist, what their inputs are, what primitives they need, what the source note must say, and what order they ship in. Deviations from this canon during implementation must be raised as a canon amendment, not silently absorbed into a code change.

— end of Phase 1B chart & exhibit canon —

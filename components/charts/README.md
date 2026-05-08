# SLATE chart vocabulary

This directory holds SLATE's chart-component vocabulary for Phase 1B (the Consulting-Grade Deliverable Engine). **Exhibits never import `@visx/*` directly** — they compose primitives from `./primitives/`. The primitives are the contract that enforces the SLATE design tokens (Inter / JetBrains Mono / `tabular-nums`, the `--color-*` CSS variables, lean muted strokes) on every chart.

## Status

Three exhibits ship today:

- `exhibits/executive-summary-2x2.tsx` — **Phase 1B proof-of-fit.** Opportunity portfolio · impact × complexity. Bubble size = ROI. Color = evidence strength. Dashed brand-tinted ring on the recommended item.
- `exhibits/risk-adjusted-priority-quadrant.tsx` — **Phase 1B Sprint 1.** Analytical 2×2 scatter. Bubble size = business impact (safe proxy for value until a financial model lands). **Color = risk band**, derived deterministically from `riskScore`. 50/50 dashed midlines (analytical convention; intentionally distinct from `lib/opportunities/helpers.ts`'s 70/60 thresholds used by the operator's editing matrix). Highest-impact item per quadrant gets a label; everything else renders unlabeled to avoid clutter.
- `exhibits/capability-maturity-heatmap.tsx` — **Phase 1B Sprint 2.** Capability × dimension grid. Cell color encodes a 4-band maturity scale derived deterministically from `maturityScore`. Cell label is the score itself in tabular mono. Row + column labels in `JetBrains Mono` uppercase tracking-1.4. No `@visx/heatmap` dependency — the cell primitive is plain SVG `rect` + `text`.

All three are **server components** rendering **static SVG**. All use sample data declared at the call site of the preview page (no persisted reads). They are rendered only on the unlinked operator-only `/app/charts-preview` route. None is wired into the report or proposal builders. The remaining five Phase 1B exhibits ship in subsequent sprints after each visual direction is reviewed.

## Layout

```
components/charts/
  primitives/
    chart-frame.tsx        eyebrow / title / takeaway / legend / SVG canvas / source-note
    chart-axis.tsx         SLATE-styled AxisBottom / AxisLeft
    chart-grid.tsx         SLATE-styled GridRows / GridColumns
    chart-source-note.tsx  uppercase mono caption beneath every exhibit
    chart-heatmap-cell.tsx SLATE-styled SVG heatmap cell (rect + centered label)
  exhibits/
    executive-summary-2x2.tsx            Phase 1B proof-of-fit exhibit
    risk-adjusted-priority-quadrant.tsx  Phase 1B Sprint 1 — analytical 2×2
    capability-maturity-heatmap.tsx      Phase 1B Sprint 2 — diagnostic heatmap
```

Shared types and the CSS-variable lookup live in [`lib/charts/types.ts`](../../lib/charts/types.ts).

## Risk-Adjusted Priority Quadrant — input shape and color rule

Component: `RiskAdjustedPriorityQuadrant`. Located at [`exhibits/risk-adjusted-priority-quadrant.tsx`](./exhibits/risk-adjusted-priority-quadrant.tsx).

Inputs (the exhibit deliberately knows nothing about `Opportunity`):

```ts
interface RiskAdjustedQuadrantPoint {
  id: string;
  title: string;
  impact: number;     // 0–100, businessImpactScore
  complexity: number; // 0–100, complexityScore
  risk: number;       // 0–100, riskScore
}

interface RiskAdjustedPriorityQuadrantProps {
  points: RiskAdjustedQuadrantPoint[];
  sourceNote: SourceNote;   // required by canon
  takeaway?: string;        // defaults to a derived one-line summary
}
```

The future report-wiring sprint imports the pure adapter `opportunityToRiskQuadrantPoint` from the same file — that is the only seam between persisted `Opportunity` rows and the chart. App pages never import `@visx/*` to consume this exhibit.

Risk-band color rule (no `critical` chart-tone added; the existing four-tone vocabulary is sufficient):

| `risk` score | Band | `ChartTone` | CSS variable |
| --- | --- | --- | --- |
| 0–24 | Low | `success` | `--color-status-success` |
| 25–49 | Medium | `info` | `--color-status-info` |
| 50–74 | Elevated | `warning` | `--color-status-warning` |
| 75–100 | High | `risk` | `--color-status-risk` |

Bubble size encodes `impact` on a fixed 0–100 domain (so a 50-impact bubble looks the same on every engagement). Quadrant midlines are at **50/50** — this is the analytical-view convention and is deliberately different from the 70/60 thresholds in [`lib/opportunities/helpers.ts`](../../lib/opportunities/helpers.ts) used by the operator's editing matrix. The two views are not in conflict — they answer different questions.

Labels: only the highest-`impact` point in each quadrant is labeled (max 4 labels, deterministic). Every bubble carries an `<svg><title>` for screen-reader and hover-tooltip discoverability without depending on hover for comprehension.

## Capability Maturity Heatmap — input shape and band rule

Component: `CapabilityMaturityHeatmap`. Located at [`exhibits/capability-maturity-heatmap.tsx`](./exhibits/capability-maturity-heatmap.tsx). Composes [`primitives/chart-heatmap-cell.tsx`](./primitives/chart-heatmap-cell.tsx).

Inputs:

```ts
interface CapabilityMaturityCell {
  capability: string;
  dimension: string;
  maturityScore: number;          // 0–100
  supportingFindingCount: number; // shown via the cell's <title>, not visually
}

interface CapabilityMaturityHeatmapProps {
  cells: CapabilityMaturityCell[];
  capabilities: string[];   // row order, top to bottom
  dimensions: string[];     // column order, left to right
  sourceNote: SourceNote;   // required by canon
  takeaway?: string;        // defaults to a derived one-line summary
}
```

The grid is driven by the `capabilities` and `dimensions` arrays — the cells array is treated as a sparse map keyed on `${capability}|${dimension}`. Cells outside the row/column set are silently ignored, and missing intersections render as gaps.

Maturity-band color rule (no new chart-tone added — uses the existing four-tone vocabulary):

| `maturityScore` | Band | `ChartTone` | CSS variable |
| --- | --- | --- | --- |
| 0–39 | Needs foundation | `risk` | `--color-status-risk` |
| 40–59 | Developing | `warning` | `--color-status-warning` |
| 60–79 | Functional | `info` | `--color-status-info` |
| 80–100 | Mature | `success` | `--color-status-success` |

Each cell renders the maturity score in tabular mono numerals (semibold, 13px, `--color-text-primary`). The `supportingFindingCount` is rendered into the cell's `<svg><title>` for screen-reader and hover-tooltip discoverability — never relied on for visual comprehension. Per-cell `<title>` text reads `"<capability> · <dimension>: <score> (<band>). <n> supporting findings."`.

The `ChartHeatmapCell` primitive is intentionally generic so the same primitive can back the **Stakeholder Coverage Matrix** in a later sprint without code changes. The primitive accepts `fill` (typically `CHART_TONE_VAR[tone]`), `label`, `title`, and standard rect attributes — nothing maturity-specific lives in the primitive itself.

The exhibit uses `ChartFrame`'s render-prop `(innerWidth, innerHeight)` to size cells dynamically against any number of rows × columns. Row and column labels render outside the inner group at small negative coordinates so the cells fill the inner area exactly.

## Design-token contract

Charts read SLATE design tokens via CSS custom properties so theming changes propagate without chart-code changes. SVG `fill` and `stroke` accept `var(...)` directly.

| Purpose | Variable / constant |
| --- | --- |
| Categorical tone (success / info / warning / risk) | `--color-status-*`, exposed via `CHART_TONE_VAR` |
| Brand accent (recommended ring, AI markers) | `--color-brand-primary`, `--color-practice-ai` |
| Grid lines | `--color-border-subtle` (`CHART_GRID_STROKE`) |
| Axis + tick strokes | `--color-border-strong` (`CHART_AXIS_STROKE`, `CHART_TICK_STROKE`) |
| Tick labels | `--color-text-muted` (`CHART_TICK_LABEL`) |
| Axis labels | `--color-text-secondary` (`CHART_AXIS_LABEL`) |
| Quadrant labels | `--color-text-muted` (`CHART_QUADRANT_LABEL`) |
| Data point labels | `--color-text-secondary` (`CHART_DATA_LABEL`) |

Typography:

- Tick labels, axis labels, quadrant labels: `var(--font-mono)` (JetBrains Mono), 9–10px, letter-spacing 1.2–1.6, **uppercase passed in as a literal string** (CSS `text-transform` does not apply to SVG `<text>` elements).
- Data point labels: `var(--font-sans)` (Inter), 11px, color `--color-text-secondary`.
- Legend + source note: SLATE `font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted` via Tailwind classes (rendered outside the SVG so Tailwind utilities work).

## Adding a primitive or exhibit

1. **Primitives** live under `primitives/`. They may import `@visx/*`. They must read all design choices from CSS variables — no hex literals except inside `lib/charts/types.ts`, which centralizes the variable lookup.
2. **Exhibits** live under `exhibits/`. They may import primitives, scales (`@visx/scale`), shape (`@visx/shape`), group (`@visx/group`), and text (`@visx/text`). They should not reach into other `@visx/*` packages directly — if an exhibit needs something that does not exist in the primitive set, **add the primitive first**.
3. Every exhibit must be wrapped in `<ChartFrame>` so eyebrow / title / takeaway / legend / source-note formatting stays uniform.
4. Every exhibit must declare a `sourceNote`. Source attribution is non-optional in consulting-grade exhibits.

## SSR posture

`ChartFrame` renders SVG with `viewBox="0 0 W H"` + `preserveAspectRatio="xMidYMid meet"` and the Tailwind classes `block h-auto w-full`. The chart scales to its container width while preserving its logical aspect ratio. **No `"use client"` boundary is required** — the proof-of-fit exhibit is a pure server component.

Future exhibits that need viewport-relative measurement can wrap themselves in a small client shell using `@visx/responsive`'s `ParentSize`. That package is already installed but not imported by the proof-of-fit exhibit, so it does not contribute to the proof's bundle.

## Out of scope today

- The remaining seven Phase 1B exhibits.
- A light-theme palette (PDF export will need this; the contract above accommodates it because every color reads through a CSS variable).
- Tooltip / hover interactions (`@visx/tooltip` is intentionally not installed).
- Persisted-data wiring (the matrix in `components/opportunities/opportunity-matrix.tsx` stays the operator's editing surface; this exhibit is a separate consulting-output surface that will read persisted data only after the Phase 1B sprint that wires it).
- PDF export of any exhibit.

## Why Visx, and not Recharts / Tremor / Nivo / ECharts

The Phase 1A audit (`docs/12_PHASE_1A_ACCEPTANCE_AUDIT.md`) identified the absence of any charting layer as the largest visible gap to a McKinsey/BCG/Bain bar. The library decision rationale lives in the audit doc and in the plan file; in short:

- Visx is **SVG, not Canvas** → crisp PDF export, infinite zoom, fully accessible.
- Visx is **modular per-package** → only ship the bytes for the primitives an exhibit actually uses.
- Visx is **unopinionated styling** → SLATE brings its own design tokens; no fight against built-in defaults that read as "tech-product dashboard."
- Visx is **SSR-safe by default** (pure SVG output, no canvas context, no `window` required at import time).

Off-the-shelf charts from Recharts, Tremor, Nivo, and ECharts ship visual defaults that we would have to override constantly to reach a consulting-grade aesthetic. Visx + a small SLATE primitive layer is the shortest path to McKinsey-grade exhibits.

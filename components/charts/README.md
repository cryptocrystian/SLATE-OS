# SLATE chart vocabulary

This directory holds SLATE's chart-component vocabulary for Phase 1B (the Consulting-Grade Deliverable Engine). **Exhibits never import `@visx/*` directly** — they compose primitives from `./primitives/`. The primitives are the contract that enforces the SLATE design tokens (Inter / JetBrains Mono / `tabular-nums`, the `--color-*` CSS variables, lean muted strokes) on every chart.

## Status

This is the **proof-of-fit** commit. Exactly one exhibit ships:

- `exhibits/executive-summary-2x2.tsx` — Opportunity portfolio · impact × complexity. Bubble size = ROI. Color = evidence strength. Dashed brand-tinted ring on the recommended item.

All data is **static sample data** declared inline in the exhibit file. No persisted reads. The exhibit is rendered only on the unlinked operator-only `/app/charts-preview` route. It is not wired into the report or proposal builders. The remaining seven Phase 1B exhibits (Capability Maturity Heatmap, AI-Savings Waterfall, ROI Bridge, Roadmap Gantt with Dependencies, Risk-Adjusted Priority Quadrant, Stakeholder Coverage Matrix, Benchmark Comparison Bars) ship in subsequent commits after the visual direction here is reviewed.

## Layout

```
components/charts/
  primitives/
    chart-frame.tsx        eyebrow / title / takeaway / legend / SVG canvas / source-note
    chart-axis.tsx         SLATE-styled AxisBottom / AxisLeft
    chart-grid.tsx         SLATE-styled GridRows / GridColumns
    chart-source-note.tsx  uppercase mono caption beneath every exhibit
  exhibits/
    executive-summary-2x2.tsx   Phase 1B proof-of-fit exhibit
```

Shared types and the CSS-variable lookup live in [`lib/charts/types.ts`](../../lib/charts/types.ts).

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

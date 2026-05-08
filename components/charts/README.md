# SLATE chart vocabulary

This directory holds SLATE's chart-component vocabulary for Phase 1B (the Consulting-Grade Deliverable Engine). **Exhibits never import `@visx/*` directly** — they compose primitives from `./primitives/`. The primitives are the contract that enforces the SLATE design tokens (Inter / JetBrains Mono / `tabular-nums`, the `--color-*` CSS variables, lean muted strokes) on every chart.

## Status

Seven exhibits ship today:

- `exhibits/executive-summary-2x2.tsx` — **Phase 1B proof-of-fit.** Opportunity portfolio · impact × complexity. Bubble size = ROI. Color = evidence strength. Dashed brand-tinted ring on the recommended item.
- `exhibits/risk-adjusted-priority-quadrant.tsx` — **Phase 1B Sprint 1.** Analytical 2×2 scatter. Bubble size = business impact (safe proxy for value until a financial model lands). **Color = risk band**, derived deterministically from `riskScore`. 50/50 dashed midlines (analytical convention; intentionally distinct from `lib/opportunities/helpers.ts`'s 70/60 thresholds used by the operator's editing matrix). Highest-impact item per quadrant gets a label; everything else renders unlabeled to avoid clutter.
- `exhibits/capability-maturity-heatmap.tsx` — **Phase 1B Sprint 2.** Capability × dimension grid. Cell color encodes a 4-band maturity scale derived deterministically from `maturityScore`. Cell label is the score itself in tabular mono. Row + column labels in `JetBrains Mono` uppercase tracking-1.4. No `@visx/heatmap` dependency — the cell primitive is plain SVG `rect` + `text`.
- `exhibits/stakeholder-coverage-matrix.tsx` — **Phase 1B Sprint 3.** Role × topic intake-coverage grid. Cell color encodes a 4-tone evidence-strength scale (`missing → neutral`, `thin → warning`, `adequate → info`, `strong → success`). Cell label shows the supporting `responseCount` for present cells and an em-dash for missing cells. **Reuses the Sprint 2 `ChartHeatmapCell` primitive without modification** — the canon's promise that one primitive backs both heatmap exhibits is now realized.
- `exhibits/roadmap-gantt-with-dependencies.tsx` — **Phase 1B Sprint 4.** 30/60/90-day Gantt timeline with right-angle dependency arrows. Bar color = `RoadmapStatus` tone (planned/in-progress/blocked/complete). Vertical "Today" marker in `--color-brand-primary`. Phase headers + dashed phase boundaries at days 30 / 60 / 90. Item titles render in the left margin; bars are clean colored blocks. Adds two new generic primitives: `ChartGanttBar` and `ChartDependencyArrow` (plus `ChartDependencyArrowheadMarker`).
- `exhibits/benchmark-comparison-bars.tsx` — **Phase 1B Sprint 5 · Gate 0 illustrative only.** Per-dimension client score plotted against an illustrative p25 / p50 / p75 percentile band. Adds the `ChartPercentileBand` primitive. **MUST NOT** be wired into reports, proposals, public-scorecard surfaces, or PDF exports until the Phase 1B Benchmark Data Canon (`docs/14_*`) reaches Gate 1 or Gate 2 with a real dataset. Default takeaway, default source note, and legend status pill all carry the "illustrative" label deliberately to prevent fake-benchmark optics.
- `exhibits/ai-savings-waterfall.tsx` — **Phase 1B Sprint 6 · Gate 0 illustrative only.** Cost-baseline → modeled-state waterfall with per-bar savings / cost contributions, dashed connectors at the running cost stack, and a dashed-outline "modeled" treatment on the final-state bar. Adds the `ChartWaterfallBar` primitive. **MUST NOT** be wired into reports, proposals, public-scorecard surfaces, or PDF exports until the Phase 1B Financial Assumptions Canon (`docs/15_*`) reaches Gate 1 / Gate 2 / Gate 3. Default takeaway, default source note, and legend status pill all carry the "Illustrative · Gate 0" label deliberately to prevent fake-savings / fake-ROI optics.

All seven are **server components** rendering **static SVG**. All use sample data declared at the call site of the preview page (no persisted reads). They are rendered only on the unlinked operator-only `/app/charts-preview` route. None is wired into the report or proposal builders. The remaining one Phase 1B exhibit (ROI Bridge) ships in a subsequent sprint after the visual direction is reviewed.

## Layout

```
components/charts/
  primitives/
    chart-frame.tsx        eyebrow / title / takeaway / legend / SVG canvas / source-note
    chart-axis.tsx         SLATE-styled AxisBottom / AxisLeft
    chart-grid.tsx         SLATE-styled GridRows / GridColumns
    chart-source-note.tsx  uppercase mono caption beneath every exhibit
    chart-heatmap-cell.tsx     SLATE-styled SVG heatmap cell (rect + centered label)
    chart-gantt-bar.tsx        SLATE-styled SVG Gantt bar (rect + auto inside/outside label)
    chart-dependency-arrow.tsx SLATE-styled right-angle dependency arrow + arrowhead marker
    chart-percentile-band.tsx  SLATE-styled rail + IQR box + median line + diamond marker
    chart-waterfall-bar.tsx    SLATE-styled stepped bar with optional modeled / muted treatment
  exhibits/
    executive-summary-2x2.tsx            Phase 1B proof-of-fit exhibit
    risk-adjusted-priority-quadrant.tsx  Phase 1B Sprint 1 — analytical 2×2
    capability-maturity-heatmap.tsx      Phase 1B Sprint 2 — diagnostic heatmap
    stakeholder-coverage-matrix.tsx      Phase 1B Sprint 3 — coverage heatmap
    roadmap-gantt-with-dependencies.tsx  Phase 1B Sprint 4 — 30/60/90 Gantt
    benchmark-comparison-bars.tsx        Phase 1B Sprint 5 — illustrative comparison
    ai-savings-waterfall.tsx             Phase 1B Sprint 6 — illustrative waterfall
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

## Stakeholder Coverage Matrix — input shape and band rule

Component: `StakeholderCoverageMatrix`. Located at [`exhibits/stakeholder-coverage-matrix.tsx`](./exhibits/stakeholder-coverage-matrix.tsx). **Reuses the Sprint 2 [`ChartHeatmapCell`](./primitives/chart-heatmap-cell.tsx) primitive without modification.** The cell-primitive contract was designed for this; Sprint 3 is the proof.

Inputs:

```ts
type StakeholderEvidenceStrength = "missing" | "thin" | "adequate" | "strong";

interface StakeholderCoverageCell {
  role: string;
  topic: string;
  strength: StakeholderEvidenceStrength;
  responseCount: number;     // shown in the cell for present strengths;
                             // expected to be 0 for "missing" cells
}

interface StakeholderCoverageMatrixProps {
  cells: StakeholderCoverageCell[];
  roles: string[];           // row order, top to bottom
  topics: string[];          // column order, left to right
  sourceNote: SourceNote;
  takeaway?: string;
}
```

Evidence-strength color rule (no new chart-tone added — uses the existing four-tone vocabulary):

| `strength` | Visual treatment | `ChartTone` | CSS variable |
| --- | --- | --- | --- |
| `missing` | Recessive: `fillOpacity 0.05` + `--color-border-strong` stroke + em-dash glyph + `--color-text-muted` label color | `neutral` | `--color-status-neutral` |
| `thin` | Standard: `fillOpacity 0.18` + same-tone stroke + `responseCount` label in `--color-text-primary` | `warning` | `--color-status-warning` |
| `adequate` | Standard | `info` | `--color-status-info` |
| `strong` | Standard | `success` | `--color-status-success` |

The "missing" treatment is deliberately recessive: a coverage gap should not look like a low-strength response. The em-dash glyph (`—`) plus the very low fill opacity plus the dimmer stroke color combine to read as "this intersection exists in the schema but has no data" — visually distinct from a populated thin/warning cell.

Cell label policy:
- Present cells (`thin` / `adequate` / `strong`) render `responseCount` as a tabular-mono integer (1, 2, 3, …).
- `missing` cells render an em-dash (`—`).
- Every cell carries an `<svg><title>` reading `"<role> · <topic>: <Strength>. <n> response(s)."` for screen-reader / hover discoverability — never required for visual comprehension.

The exhibit follows the same `ChartFrame` render-prop pattern as Capability Maturity: rows / columns are driven by the `roles` and `topics` arrays, the `cells` array is treated as a sparse map keyed on `${role}|${topic}`, and missing intersections in the cells array (vs. `strength: "missing"` cells) render as gaps.

## Roadmap Gantt with Dependencies — input shape and rules

Component: `RoadmapGanttWithDependencies`. Located at [`exhibits/roadmap-gantt-with-dependencies.tsx`](./exhibits/roadmap-gantt-with-dependencies.tsx). Composes [`primitives/chart-gantt-bar.tsx`](./primitives/chart-gantt-bar.tsx) and [`primitives/chart-dependency-arrow.tsx`](./primitives/chart-dependency-arrow.tsx).

Inputs:

```ts
type RoadmapPhase = "days_0_30" | "days_31_60" | "days_61_90";
type RoadmapStatus = "planned" | "in_progress" | "blocked" | "complete";

interface RoadmapGanttItem {
  id: string;
  title: string;
  phase: RoadmapPhase;
  startOffset: number;     // 0–90; clamped to range
  durationDays: number;    // clamped to a minimum visible width; bars
                           // that overflow day 90 are clipped to day 90
  dependencyIds: string[]; // forward-in-time only; unknown ids are dropped
  status: RoadmapStatus;
  ownerPlaceholder?: string;
}

interface RoadmapGanttWithDependenciesProps {
  items: RoadmapGanttItem[];
  sourceNote: SourceNote;
  todayOffset?: number;    // default 0; clamped to 0–90
  takeaway?: string;       // defaults to a derived one-line summary
}
```

Status-tone color rule (no new chart-tone added — uses the existing vocabulary):

| `status` | Visual | `ChartTone` | CSS variable |
| --- | --- | --- | --- |
| `planned` | Standard bar | `info` | `--color-status-info` |
| `in_progress` | Standard bar | `brand` | `--color-brand-primary` |
| `blocked` | Standard bar | `risk` | `--color-status-risk` |
| `complete` | Muted: reduced fill / stroke / label opacity (~45%) | `neutral` | `--color-status-neutral` |

The "complete" treatment leans on `ChartGanttBar`'s `muted` flag — same primitive, different opacity. A completed item still appears on the timeline so the narrative reads end-to-end, but it visually recedes so eyes go to the active work.

Layout:
- **X-axis fixed at 0–90 days.** Items with `startOffset` outside that window are clamped to the range; items whose end exceeds day 90 are visually clipped to day 90 (the underlying data is unchanged — only the rendered bar is clipped). Negative or zero `durationDays` is normalized to a minimum visible width.
- **Phase headers** ("Days 0–30" / "Days 31–60" / "Days 61–90") render at the top, mono uppercase tracking-1.6, centered above each phase region.
- **Phase boundaries** (days 30 and 60) render as subtle dashed verticals using `--color-border-strong` at 0.4 opacity.
- **Today marker** is a vertical `--color-brand-primary` line (1.5px, opacity 0.8) plus a small `TODAY · D<n>` label above the chart in mono uppercase brand-primary.
- **Day axis** at the bottom shows ticks only at 0, 30, 60, 90 with `D<n>` labels — intermediate ticks the linear scale would emit are deliberately suppressed so the axis reads as a phase scale rather than a continuous time scale.
- **Item titles** sit in the left margin (mono uppercase tracking-1.4, `--color-text-muted`). The bars themselves carry no internal label; status is conveyed by color, schedule by position. Each bar carries an `<svg><title>` reading `"<title> · <status>. Days <start>–<end>. Owner: <owner>"` for screen-reader / hover discoverability.

Dependency arrows:
- Right-angle 3-segment path: source bar's right edge → small horizontal stub (8 SVG units) → vertical drop → target bar's left edge. Drawn BEFORE bars so bars sit on top.
- Arrowhead is shared via a single `<marker>` defined once per exhibit (`id="slate-roadmap-dep-arrow"`) so `<defs>` stays clean even with many edges.
- Stroke uses `--color-border-strong` at 0.7 opacity by default — visible but recessive.
- Forward-in-time only: a dependency whose source is later than its target is still drawn but the last segment runs leftward; the routing is intentionally simple rather than re-routing around the chart.
- An edge whose source `id` is not in `items` is silently dropped (defensive against stale ids).

The two new primitives are deliberately generic:
- **`ChartGanttBar`** — `x`, `y`, `width`, `height`, `fill`, `fillOpacity`, `stroke`, `strokeWidth`, `rx`, optional `label` (auto inside/outside placement), `muted` flag, `title`. Zero roadmap-specific logic; reusable by any future horizontal-bar exhibit.
- **`ChartDependencyArrow`** — `startX/Y`, `endX/Y`, `markerId`, `stroke`, `strokeWidth`, `strokeDasharray`, `strokeOpacity`, `stub`, `title`. Plus a sibling helper `ChartDependencyArrowheadMarker` that the exhibit drops once into `<defs>`. Zero domain-specific logic; reusable by any future "A → B" connector.

## Benchmark Comparison Bars — Gate 0 illustrative only

Component: `BenchmarkComparisonBars`. Located at [`exhibits/benchmark-comparison-bars.tsx`](./exhibits/benchmark-comparison-bars.tsx). Composes [`primitives/chart-percentile-band.tsx`](./primitives/chart-percentile-band.tsx).

> ⚠ **Read [`docs/14_PHASE_1B_BENCHMARK_DATA_CANON.md`](../../docs/14_PHASE_1B_BENCHMARK_DATA_CANON.md) before touching this exhibit.** Gate 0 means the exhibit may render **only** with `dataset.status === "illustrative"` and **only** on the operator-only `/app/charts-preview` route. Wiring this exhibit into reports, proposals, public-scorecard surfaces, or PDF exports requires a documented Gate 1 / Gate 2 dataset and a separate sprint approval.

Inputs (match docs/14 exactly):

```ts
type BenchmarkDatasetStatus =
  | "illustrative"
  | "internal_directional"
  | "validated";

interface BenchmarkComparisonPoint {
  dimension: string;
  clientScore: number;       // 0–100, clamped at validation
  p25: number;               // 0–100; must satisfy p25 ≤ p50 ≤ p75
  p50: number;
  p75: number;
  sampleSize: number;
  vintage: string;           // ISO date or YYYY-Q#
  benchmarkLabel: string;
}

interface BenchmarkComparisonDataset {
  label: string;
  methodology: string;       // required when status === "validated"
  vintage: string;
  sampleSize: number;
  points: BenchmarkComparisonPoint[];
  status: BenchmarkDatasetStatus;
}

interface BenchmarkComparisonBarsProps {
  dataset: BenchmarkComparisonDataset;
  sourceNote?: SourceNote;   // defaults from dataset.status per docs/14
  takeaway?: string;         // default is conservative; see below
}
```

Validation (exported as `validateAndClampPoint`):

- Clamps `clientScore`, `p25`, `p50`, `p75` to `[0, 100]`.
- **Rejects** rows where `p25 > p50` or `p50 > p75` — the canon explicitly forbids silently sorting bad percentiles.
- Returns `null` for invalid rows; the exhibit drops them.
- If every row is invalid, the exhibit renders an inline empty-state inside the chart area instead of pretending the chart succeeded.
- The x-axis is fixed at `[0, 100]`. There is no `nice: true` and no axis stretching — the canon explicitly forbids it.

Source-note derivation (exported as `defaultBenchmarkSourceNote`):

| `dataset.status` | Default rendered string |
| --- | --- |
| `illustrative` | `Illustrative sample data · not a benchmark` |
| `internal_directional` | `Internal SLATE assessments · directional benchmark · n=<sampleSize> · vintage <vintage>` |
| `validated` | `Saipien Labs benchmark dataset · n=<sampleSize> · vintage <vintage>` |

The illustrative source note **does not** include `n`, `vintage`, or `methodology`. The non-illustrative tiers compose the full string into `text` (the `n` field is intentionally unused) so the rendered output matches docs/14's exact `n=` placement.

Default takeaway:

```
Illustrative comparison structure only; validated benchmark data is required before client-facing use.
```

This sentence is deliberately conservative. Override it only when the dataset has reached Gate 1 or Gate 2 AND the override does not introduce prohibited claim language. The canon prohibits "industry benchmark," "peer benchmark" without population definition, "above average," "in the top quartile," and similar phrasing. The exhibit's per-row `<svg><title>` text is also written neutrally (`"<dimension>: client score X. Illustrative percentile band p25=Y, p50=Z, p75=W."`).

Visual rules:

- One row per dimension. Dimension labels in the left margin, mono uppercase tracking-1.2.
- Each row composes one `ChartPercentileBand`: a faint full-width rail, the IQR box (p25 → p75) in info-tone at 0.18 fill, the median line at p50, and a brand-primary diamond marker at the client score. The diamond carries a `--color-bg-surface` halo so it visually lifts off the IQR box.
- The diamond marker is the visual primary; bands are scaffolding.
- Bottom axis renders ticks only at `0, 25, 50, 75, 100` with a neutral `SCORE · 0–100` caption — the canon prohibits "better" / "stronger" axis framing because `Workflow friction` is inverted (high friction = leverage, not "good"). The dimension list is interpretive context, not a normative scale.
- The legend includes a status pill (`Illustrative · Gate 0` / `Internal directional · Gate 1` / `Validated · Gate 2`) so the credibility tier is visible chrome, not just a footer footnote.

The `ChartPercentileBand` primitive is value-agnostic: it accepts pre-computed SVG x-positions (`p25X`, `p50X`, `p75X`, `clientX`), never raw domain values. The exhibit handles all value→pixel math. The primitive contains zero benchmark-specific language, so it is reusable by any future "client value within a contextual range" visualization (e.g., a per-stakeholder satisfaction comparison) without modification.

> ⚠ **All sample values shown in this README, in `docs/14`, and in the live `/app/charts-preview` route are illustrative only. They do not represent any real population or benchmark and must not be reused in client-facing artifacts.**

## AI-Savings Waterfall — Gate 0 illustrative only

Component: `AISavingsWaterfall`. Located at [`exhibits/ai-savings-waterfall.tsx`](./exhibits/ai-savings-waterfall.tsx). Composes [`primitives/chart-waterfall-bar.tsx`](./primitives/chart-waterfall-bar.tsx).

> ⚠ **Read [`docs/15_PHASE_1B_FINANCIAL_ASSUMPTIONS_CANON.md`](../../docs/15_PHASE_1B_FINANCIAL_ASSUMPTIONS_CANON.md) before touching this exhibit.** Gate 0 means the exhibit may render **only** with `assumptionSet.status === "illustrative"` and **only** on the operator-only `/app/charts-preview` route. Wiring this exhibit into reports, proposals, public-scorecard surfaces, or PDF exports requires a Gate 1 / Gate 2 / Gate 3 assumption set and a separate sprint approval.

Inputs (match docs/15 exactly):

```ts
type FinancialAssumptionStatus =
  | "illustrative"
  | "operator_estimated"
  | "client_validated"
  | "finance_approved";

type FinancialConfidence = "low" | "medium" | "high";

interface FinancialAssumptionSet {
  id: string;
  label: string;
  status: FinancialAssumptionStatus;
  confidence: FinancialConfidence;
  currency: "USD";
  currentBaselineCost: number;       // USD/year
  currentBaselineHours: number;      // hours/year
  hourlyCostAssumption: number;      // USD/hour, fully-loaded
  implementationCost: number;        // USD, one-time
  recurringCostMonthly: number;      // USD/month
  expectedAutomationRate: number;    // 0–1
  expectedAdoptionRate: number;      // 0–1
  riskAdjustmentFactor: number;      // 0–1
  timeToValueDays: number;
  assumptionOwner: string;           // required when status === "finance_approved"
  lastReviewedAt: string;            // required when status === "finance_approved"
  notes?: string;
}

interface SavingsWaterfallContribution {
  label: string;
  deltaValue: number;                // signed — see validation rules
  sign: "savings" | "cost" | "residual";
  confidence: FinancialConfidence;
  sourceAssumption: string;
}

interface AISavingsWaterfallProps {
  assumptionSet: FinancialAssumptionSet;
  contributions: SavingsWaterfallContribution[];
  sourceNote?: SourceNote;           // defaults from assumptionSet.status per docs/15
  takeaway?: string;                 // default is conservative; see below
}
```

### Value-direction convention

**The y-axis is COST, not savings.** Bars represent the cost stack:

- **Baseline bar** — full bar from `$0` up to the current cost baseline.
- **`sign: "savings"`** — the bar **descends** from the running cost; visually represents cost reduction.
- **`sign: "cost"`** — the bar **ascends** from the running cost; visually represents cost addition.
- **`sign: "residual"`** — the bar ascends; visually represents a residual cost line item that remains after the modeled changes.
- **Modeled-state bar** — full bar from `$0` up to the running cost AFTER all contributions, rendered with a dashed-outline "modeled" treatment per the `ChartWaterfallBar` primitive's `modeled` flag.

This frames the y-axis as "cost remaining" rather than "savings accumulated." The exhibit therefore never labels a single figure as "net savings" — savings appear as individual cost-reduction bars; the modeled state appears as a separate cost level. **The visual is honest about cost stacking; the canon prohibits any single "guaranteed savings" / "annual savings" / "ROI" / "payback" label.**

### Validation (exported as `validateAssumptionSet` and `validateContribution`)

The exhibit enforces the canon's invariants before any bar renders:

- `status` and `confidence` are required and must be in their allowed-value sets.
- `currency === "USD"` (multi-currency is a later canon).
- All money fields finite and non-negative.
- `expectedAutomationRate`, `expectedAdoptionRate`, `riskAdjustmentFactor` clamped `[0, 1]`. Out-of-range is **rejected**, not silently clamped.
- Baseline requirement: `currentBaselineCost > 0` OR (`currentBaselineHours > 0` AND `hourlyCostAssumption > 0`).
- `finance_approved` status requires non-empty `assumptionOwner` and `lastReviewedAt`.
- Contribution `deltaValue < 0` is allowed **only** when `sign === "cost"` (defensive support per docs/15).
- If the assumption set fails validation OR every contribution is rejected, the exhibit renders an inline empty-state inside the chart area instead of pretending the chart succeeded.

### Source-note derivation (exported as `defaultFinancialSourceNote`)

| `assumptionSet.status` | Default rendered string |
| --- | --- |
| `illustrative` | `Source: Illustrative sample data · not a financial model` |
| `operator_estimated` | `Source: Operator-estimated assumptions · internal draft · confidence <confidence>` |
| `client_validated` | `Source: Client-validated assumptions · confidence <confidence> · reviewed <lastReviewedAt>` |
| `finance_approved` | `Source: Finance-approved model · confidence <confidence> · reviewed <lastReviewedAt>` |

The illustrative source note **does not** include `confidence`, `assumptionOwner`, or `lastReviewedAt`. The non-illustrative tiers compose the full string into `text` and skip the structured `n` field, matching the canon's exact placement.

### Default takeaway

```
Illustrative savings structure only; validated financial assumptions are required before client-facing use.
```

This sentence is deliberately conservative. Override it only when the assumption set has reached Gate 1+, AND the override does not introduce prohibited claim language. Per `docs/15`, prohibited phrases include "guaranteed savings," "guaranteed ROI," "payback in X months," "will save $X," "will reduce cost by X%," "profit increase," "cash-flow positive by," and "board-ready ROI." Per-bar `<svg><title>` text is also written neutrally (`"<label>: $Xk (savings reduction)."`).

### Visual rules

- **Y-axis**: vertical, USD, with three ticks at `$0`, half-baseline, and baseline. The `$0` line is the chart floor.
- **Connectors**: dashed `--color-border-strong` segments at the running-total y-position between adjacent bars. Render BEFORE bars so bars sit on top.
- **Baseline + modeled-state bars**: full bars from `$0` to their value, rendered in `info` tone. The modeled-state bar carries the `modeled` flag (dashed outline + reduced fill) so viewers read it as a forecast.
- **Contribution bars**: floating bars between adjacent running-total points. Tone follows the sign — `savings → success` (green), `cost → warning` (orange), `residual → neutral` (gray).
- **Value labels**: rendered above each bar's top edge in tabular-mono semibold. Baseline + modeled-state labels are unsigned (`$1.2M`, `$940k`); contribution labels are signed (`−$560k`, `+$90k`).
- **Category labels**: rendered below the chart, rotated −35° to fit. Mono uppercase tracking-1.2.
- **Legend**: status pill (`Illustrative · Gate 0` for Gate 0), three tone swatches (baseline/modeled · savings · cost), plus a dashed-outline swatch labeled "Modeled forecast" so the modeled treatment is explained.
- **Axis framing**: the y-axis carries USD tick labels only; never "Better" / "Stronger" / "Savings" / "ROI" axis copy.

The `ChartWaterfallBar` primitive is value-agnostic: it accepts pre-computed SVG geometry (x, y, width, height) plus an optional value label, plus boolean `modeled` and `muted` flags that the consuming exhibit interprets. The primitive contains zero financial-specific language, so it is reusable by any future stepped-bar visualization (e.g., a non-financial bridge chart) without modification.

> ⚠ **All sample financial values shown in this README and in the live `/app/charts-preview` route are illustrative only. They do not represent any real client baseline, real savings, or any approved financial model. Reuse outside the preview route is forbidden by `docs/15`.**

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

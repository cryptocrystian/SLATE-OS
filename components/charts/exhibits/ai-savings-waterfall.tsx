import * as React from "react";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { Line } from "@visx/shape";
import { Text } from "@visx/text";
import { ChartFrame } from "@/components/charts/primitives/chart-frame";
import { ChartWaterfallBar } from "@/components/charts/primitives/chart-waterfall-bar";
import {
  CHART_FONT_MONO,
  CHART_FONT_SANS,
  CHART_TICK_LABEL,
  CHART_TONE_VAR,
  type ChartTone,
  type SourceNote,
} from "@/lib/charts/types";

/**
 * AI-Savings Waterfall — Phase 1B Exhibit Sprint 6.
 *
 * Walks the viewer from a current cost baseline through gross savings,
 * adoption / risk haircuts, implementation cost, and recurring cost to
 * a modeled-state bar. Composes `ChartFrame` + the new
 * `ChartWaterfallBar` primitive.
 *
 *   ⚠ CREDIBILITY-SENSITIVE EXHIBIT.
 *   This sprint ships under **Gate 0** of the Phase 1B Financial
 *   Assumptions Canon (`docs/15_PHASE_1B_FINANCIAL_ASSUMPTIONS_CANON.md`).
 *   No financial model exists. The exhibit MUST NOT imply real client
 *   baselines, real savings, real ROI, or finance approval; the bar
 *   chrome, takeaway, and source note are all written to make the
 *   illustrative status unmistakable.
 *
 *   The default takeaway, the default source note, and the legend
 *   status pill all carry the "Illustrative · Gate 0" tier deliberately.
 *   The exhibit deliberately rejects "guaranteed savings" / "ROI" /
 *   "payback" / "annual savings" framing.
 *
 * **Value-direction convention:** bars represent COST levels along the
 * y-axis. Savings reduce the running cost (visually descending);
 * costs increase the running cost (visually ascending). The modeled
 * state bar is the resulting cost level, NOT the "net savings"
 * number — we never label a single figure as net savings under Gate 0.
 *
 * Pure server component. SVG only. No new package dependencies.
 */

// ---------------------------------------------------------------------------
// Public types — match docs/15 exactly.
// ---------------------------------------------------------------------------

export type FinancialAssumptionStatus =
  | "illustrative"
  | "operator_estimated"
  | "client_validated"
  | "finance_approved";

export type FinancialConfidence = "low" | "medium" | "high";

export interface FinancialAssumptionSet {
  id: string;
  label: string;
  status: FinancialAssumptionStatus;
  confidence: FinancialConfidence;
  currency: "USD";
  /** Annual run-rate USD. */
  currentBaselineCost: number;
  /** Annual hours. */
  currentBaselineHours: number;
  /** Fully-loaded USD/hour. */
  hourlyCostAssumption: number;
  /** One-time USD. */
  implementationCost: number;
  /** Monthly USD. */
  recurringCostMonthly: number;
  /** 0–1. */
  expectedAutomationRate: number;
  /** 0–1. */
  expectedAdoptionRate: number;
  /** 0–1. */
  riskAdjustmentFactor: number;
  /** Days. */
  timeToValueDays: number;
  /** Required for finance_approved. */
  assumptionOwner: string;
  /** ISO date. Required for finance_approved. */
  lastReviewedAt: string;
  notes?: string;
}

export interface SavingsWaterfallContribution {
  label: string;
  /**
   * Magnitude of the contribution. Always positive except when
   * `sign === "cost"` and the consumer wants to express a cost
   * REDUCTION as a negative cost — defensive support per docs/15.
   */
  deltaValue: number;
  sign: "savings" | "cost" | "residual";
  confidence: FinancialConfidence;
  sourceAssumption: string;
}

export interface AISavingsWaterfallProps {
  assumptionSet: FinancialAssumptionSet;
  contributions: SavingsWaterfallContribution[];
  /**
   * Optional source-note override. When omitted, the source note is
   * derived from `assumptionSet.status` per the Financial Assumptions
   * Canon. Override only when the call site has a specific reason.
   */
  sourceNote?: SourceNote;
  /**
   * Optional takeaway override. Default: "Illustrative savings structure
   * only; validated financial assumptions are required before
   * client-facing use." Override only at higher tiers, and never to
   * include prohibited claim language.
   */
  takeaway?: string;
}

// ---------------------------------------------------------------------------
// Validation helpers — exported so a future report-wiring sprint can
// reuse them without re-implementing the canon's invariants.
// ---------------------------------------------------------------------------

const VALID_STATUSES: FinancialAssumptionStatus[] = [
  "illustrative",
  "operator_estimated",
  "client_validated",
  "finance_approved",
];
const VALID_CONFIDENCES: FinancialConfidence[] = ["low", "medium", "high"];
const VALID_SIGNS: SavingsWaterfallContribution["sign"][] = [
  "savings",
  "cost",
  "residual",
];

export type AssumptionSetValidationResult =
  | { ok: true; set: FinancialAssumptionSet }
  | { ok: false; reason: string };

export function validateAssumptionSet(
  set: FinancialAssumptionSet,
): AssumptionSetValidationResult {
  if (!set.status || !VALID_STATUSES.includes(set.status)) {
    return { ok: false, reason: "Missing or invalid status" };
  }
  if (!set.confidence || !VALID_CONFIDENCES.includes(set.confidence)) {
    return { ok: false, reason: "Missing or invalid confidence" };
  }
  if (set.currency !== "USD") {
    return { ok: false, reason: "Unsupported currency" };
  }
  // Money values must be finite + non-negative
  const moneyFields = [
    "currentBaselineCost",
    "currentBaselineHours",
    "hourlyCostAssumption",
    "implementationCost",
    "recurringCostMonthly",
    "timeToValueDays",
  ] as const;
  for (const f of moneyFields) {
    const v = set[f];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      return { ok: false, reason: `Non-finite or negative ${f}` };
    }
  }
  // Rates clamped 0–1 — out-of-range is rejected, not silently clamped
  const rateFields = [
    "expectedAutomationRate",
    "expectedAdoptionRate",
    "riskAdjustmentFactor",
  ] as const;
  for (const f of rateFields) {
    const v = set[f];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0 || v > 1) {
      return { ok: false, reason: `Out-of-range ${f}` };
    }
  }
  // Baseline requirement: cost OR (hours + rate)
  const hasCostBaseline = set.currentBaselineCost > 0;
  const hasHoursBaseline =
    set.currentBaselineHours > 0 && set.hourlyCostAssumption > 0;
  if (!hasCostBaseline && !hasHoursBaseline) {
    return {
      ok: false,
      reason:
        "Missing baseline — provide currentBaselineCost OR (currentBaselineHours + hourlyCostAssumption)",
    };
  }
  // finance_approved requires owner + lastReviewedAt
  if (set.status === "finance_approved") {
    if (!set.assumptionOwner || set.assumptionOwner.trim().length === 0) {
      return { ok: false, reason: "finance_approved requires assumptionOwner" };
    }
    if (!set.lastReviewedAt || set.lastReviewedAt.trim().length === 0) {
      return { ok: false, reason: "finance_approved requires lastReviewedAt" };
    }
  }
  return { ok: true, set };
}

export function validateContribution(
  c: SavingsWaterfallContribution,
): SavingsWaterfallContribution | null {
  if (!c || typeof c.deltaValue !== "number" || !Number.isFinite(c.deltaValue)) {
    return null;
  }
  if (!VALID_SIGNS.includes(c.sign)) return null;
  if (!VALID_CONFIDENCES.includes(c.confidence)) return null;
  // deltaValue may be negative only when sign === "cost"
  if (c.deltaValue < 0 && c.sign !== "cost") return null;
  return c;
}

// ---------------------------------------------------------------------------
// Source-note helper — exported. Strings match docs/15 exactly.
// ---------------------------------------------------------------------------

export function defaultFinancialSourceNote(
  set: FinancialAssumptionSet,
): SourceNote {
  switch (set.status) {
    case "illustrative":
      // Gate 0 — no confidence, no owner, no reviewedAt. Anything else
      // would imply a real financial model is behind the numbers.
      return { text: "Source: Illustrative sample data · not a financial model" };
    case "operator_estimated":
      return {
        text: `Source: Operator-estimated assumptions · internal draft · confidence ${set.confidence}`,
      };
    case "client_validated":
      return {
        text: `Source: Client-validated assumptions · confidence ${set.confidence} · reviewed ${set.lastReviewedAt}`,
      };
    case "finance_approved":
      return {
        text: `Source: Finance-approved model · confidence ${set.confidence} · reviewed ${set.lastReviewedAt}`,
      };
  }
}

// ---------------------------------------------------------------------------
// Baseline derivation
// ---------------------------------------------------------------------------

export function deriveBaselineCost(set: FinancialAssumptionSet): number {
  if (set.currentBaselineCost > 0) return set.currentBaselineCost;
  return set.currentBaselineHours * set.hourlyCostAssumption;
}

// ---------------------------------------------------------------------------
// Conservative USD formatter
// ---------------------------------------------------------------------------

/**
 * Conservative USD formatting. Compact for headline labels, tabular for
 * legibility across rows. The function never appends "savings" / "ROI" /
 * "payback" framing — the consuming exhibit is responsible for verb-free
 * copy under Gate 0.
 */
function formatUSD(v: number, opts?: { signed?: boolean }): string {
  const signed = opts?.signed ?? false;
  const abs = Math.abs(v);
  let core: string;
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    core = `$${m.toFixed(abs >= 10_000_000 ? 0 : 1)}M`;
  } else if (abs >= 1_000) {
    core = `$${Math.round(abs / 1_000)}k`;
  } else {
    core = `$${Math.round(abs)}`;
  }
  if (!signed) return core;
  return v < 0 ? `−${core}` : `+${core}`;
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const WIDTH = 880;
const HEIGHT = 540;
// Tall bottom margin to fit rotated category labels.
const MARGINS = { top: 64, right: 32, bottom: 96, left: 76 };
const BAR_WIDTH_RATIO = 0.62;
const Y_DOMAIN_HEADROOM = 1.05;

const DEFAULT_TAKEAWAY =
  "Illustrative savings structure only; validated financial assumptions are required before client-facing use.";

const SIGN_TONE: Record<SavingsWaterfallContribution["sign"], ChartTone> = {
  savings: "success",
  cost: "warning",
  residual: "neutral",
};

const SIGN_DESCRIPTOR: Record<SavingsWaterfallContribution["sign"], string> = {
  savings: "savings reduction",
  cost: "cost addition",
  residual: "residual cost",
};

// ---------------------------------------------------------------------------
// Internal bar-row representation
// ---------------------------------------------------------------------------

interface WaterfallRow {
  kind: "baseline" | "contribution" | "modeled";
  label: string;
  /** Absolute magnitude. */
  absValue: number;
  /** Signed delta for value-label display (positive = cost added, negative = cost reduced). */
  signedValue: number;
  /** Pixel y of bar top (smaller y in SVG terms). */
  topY: number;
  /** Pixel y of bar bottom. */
  bottomY: number;
  tone: ChartTone;
  modeled?: boolean;
  sign?: SavingsWaterfallContribution["sign"];
  /** Running cost-stack value AFTER this row applies. */
  runningEnd: number;
  confidence?: FinancialConfidence;
}

function buildWaterfallRows(
  baseline: number,
  contributions: SavingsWaterfallContribution[],
  yScale: (v: number) => number,
): WaterfallRow[] {
  const rows: WaterfallRow[] = [];
  // Baseline bar — full height from $0 up to the baseline cost.
  rows.push({
    kind: "baseline",
    label: "Baseline",
    absValue: baseline,
    signedValue: baseline,
    topY: yScale(baseline),
    bottomY: yScale(0),
    tone: "info",
    runningEnd: baseline,
  });
  let running = baseline;
  for (const c of contributions) {
    // Convention: savings reduce the running cost (signed negative);
    // cost increases it (signed positive). A "cost" with a negative
    // deltaValue therefore reduces cost (defensive support per docs/15).
    const signedDelta = c.sign === "savings" ? -Math.abs(c.deltaValue) : c.deltaValue;
    const newRunning = running + signedDelta;
    const top = Math.max(running, newRunning);
    const bottom = Math.min(running, newRunning);
    rows.push({
      kind: "contribution",
      label: c.label,
      absValue: Math.abs(c.deltaValue),
      signedValue: signedDelta,
      topY: yScale(top),
      bottomY: yScale(bottom),
      tone: SIGN_TONE[c.sign],
      sign: c.sign,
      runningEnd: newRunning,
      confidence: c.confidence,
    });
    running = newRunning;
  }
  // Modeled-state bar — full height from $0 up to the running total
  // after all contributions. Rendered with `modeled` treatment so
  // viewers read it as a forecast, not a fact.
  rows.push({
    kind: "modeled",
    label: "Modeled state",
    absValue: running,
    signedValue: running,
    topY: yScale(Math.max(0, running)),
    bottomY: yScale(0),
    tone: "info",
    modeled: true,
    runningEnd: running,
  });
  return rows;
}

// ---------------------------------------------------------------------------
// Exhibit
// ---------------------------------------------------------------------------

export function AISavingsWaterfall({
  assumptionSet,
  contributions,
  sourceNote,
  takeaway,
}: AISavingsWaterfallProps) {
  const validation = validateAssumptionSet(assumptionSet);
  const validContributions = contributions
    .map(validateContribution)
    .filter((c): c is SavingsWaterfallContribution => c !== null);

  // Source note: derive from status when not overridden. If the
  // assumption set is invalid, fall back to the safest possible string.
  const resolvedSourceNote =
    sourceNote ??
    (validation.ok
      ? defaultFinancialSourceNote(assumptionSet)
      : { text: "Source: Illustrative sample data · not a financial model" });

  const resolvedTakeaway = takeaway ?? DEFAULT_TAKEAWAY;

  return (
    <ChartFrame
      width={WIDTH}
      height={HEIGHT}
      eyebrow="AI-Savings Waterfall"
      title="Illustrative cost baseline → modeled state"
      takeaway={resolvedTakeaway}
      legend={<Legend status={assumptionSet.status} />}
      sourceNote={resolvedSourceNote}
      margins={MARGINS}
    >
      {(innerWidth, innerHeight) => {
        if (!validation.ok) {
          return (
            <Text
              x={innerWidth / 2}
              y={innerHeight / 2}
              fontFamily={CHART_FONT_MONO}
              fontSize={11}
              letterSpacing={1.4}
              fill="var(--color-text-muted)"
              textAnchor="middle"
              verticalAnchor="middle"
            >
              {`INVALID ASSUMPTION SET · ${validation.reason.toUpperCase()}`}
            </Text>
          );
        }
        if (validContributions.length === 0) {
          return (
            <Text
              x={innerWidth / 2}
              y={innerHeight / 2}
              fontFamily={CHART_FONT_MONO}
              fontSize={11}
              letterSpacing={1.4}
              fill="var(--color-text-muted)"
              textAnchor="middle"
              verticalAnchor="middle"
            >
              {`NO VALID CONTRIBUTIONS · ${contributions.length} ROW${contributions.length === 1 ? "" : "S"} REJECTED`}
            </Text>
          );
        }

        const baseline = deriveBaselineCost(assumptionSet);
        // Headroom above baseline so any contribution that briefly
        // exceeds baseline (rare but possible) is still visible.
        const yDomainMax = Math.max(baseline, baseline) * Y_DOMAIN_HEADROOM;
        const yScale = scaleLinear<number>({
          domain: [0, yDomainMax],
          range: [innerHeight, 0],
        });

        const rows = buildWaterfallRows(baseline, validContributions, yScale);
        const slotWidth = innerWidth / rows.length;
        const barWidth = slotWidth * BAR_WIDTH_RATIO;
        const barGap = slotWidth - barWidth;

        const positionedRows = rows.map((row, i) => {
          const slotLeft = i * slotWidth;
          const barLeft = slotLeft + barGap / 2;
          return {
            ...row,
            barLeft,
            barRight: barLeft + barWidth,
            slotCenter: slotLeft + slotWidth / 2,
          };
        });

        // Y-axis ticks at $0, half-baseline, baseline.
        const yTickValues = [0, Math.round(baseline / 2), baseline];

        return (
          <>
            {/* Subtle horizontal grid + Y-axis tick labels */}
            <Group>
              {yTickValues.map((tick, i) => (
                <g key={`ytick-${i}`}>
                  <Line
                    from={{ x: 0, y: yScale(tick) }}
                    to={{ x: innerWidth, y: yScale(tick) }}
                    stroke="var(--color-border-subtle)"
                    strokeOpacity={0.45}
                    strokeDasharray={tick === 0 ? undefined : "2 4"}
                    strokeWidth={tick === 0 ? 1 : 1}
                  />
                  <Text
                    x={-12}
                    y={yScale(tick)}
                    fontFamily={CHART_FONT_MONO}
                    fontSize={10}
                    letterSpacing={1.2}
                    fill={CHART_TICK_LABEL}
                    textAnchor="end"
                    verticalAnchor="middle"
                  >
                    {formatUSD(tick)}
                  </Text>
                </g>
              ))}
            </Group>

            {/* Connectors between adjacent bars at running-total y.
                Render BEFORE bars so the bars sit on top of the dashed
                lines visually. */}
            <Group>
              {positionedRows.slice(0, -1).map((row, i) => {
                const next = positionedRows[i + 1];
                const y = yScale(row.runningEnd);
                return (
                  <Line
                    key={`conn-${i}`}
                    from={{ x: row.barRight, y }}
                    to={{ x: next.barLeft, y }}
                    stroke="var(--color-border-strong)"
                    strokeWidth={1}
                    strokeOpacity={0.55}
                    strokeDasharray="3 3"
                  />
                );
              })}
            </Group>

            {/* Bars */}
            <Group>
              {positionedRows.map((row, i) => {
                const fill = CHART_TONE_VAR[row.tone];
                const valueLabel =
                  row.kind === "contribution"
                    ? formatUSD(row.signedValue, { signed: true })
                    : formatUSD(row.absValue);
                const titleSuffix =
                  row.kind === "contribution" && row.sign
                    ? ` (${SIGN_DESCRIPTOR[row.sign]})`
                    : row.kind === "modeled"
                      ? " (modeled forecast — not a guarantee)"
                      : "";
                const titleText = `${row.label}: ${formatUSD(row.absValue)}${titleSuffix}.`;
                return (
                  <ChartWaterfallBar
                    key={`bar-${i}`}
                    x={row.barLeft}
                    y={row.topY}
                    width={barWidth}
                    height={row.bottomY - row.topY}
                    fill={fill}
                    modeled={row.modeled}
                    valueLabel={valueLabel}
                    title={titleText}
                  />
                );
              })}
            </Group>

            {/* Category labels under each bar (rotated 35° to fit) */}
            <Group top={innerHeight + 14}>
              {positionedRows.map((row, i) => (
                <Text
                  key={`cat-${i}`}
                  x={row.slotCenter}
                  y={0}
                  fontFamily={CHART_FONT_SANS}
                  fontSize={11}
                  fill="var(--color-text-secondary)"
                  textAnchor="end"
                  verticalAnchor="middle"
                  angle={-35}
                >
                  {row.label}
                </Text>
              ))}
            </Group>
          </>
        );
      }}
    </ChartFrame>
  );
}

// ---------------------------------------------------------------------------
// Legend
// ---------------------------------------------------------------------------

function Legend({ status }: { status: FinancialAssumptionStatus }) {
  // Status pill — Gate 0 must show "Illustrative · Gate 0" so the
  // credibility tier is visible chrome, not a footnote.
  const statusConfig: Record<
    FinancialAssumptionStatus,
    { label: string; tone: ChartTone }
  > = {
    illustrative: { label: "Illustrative · Gate 0", tone: "warning" },
    operator_estimated: {
      label: "Operator-estimated · Gate 1",
      tone: "info",
    },
    client_validated: { label: "Client-validated · Gate 2", tone: "info" },
    finance_approved: { label: "Finance-approved · Gate 3", tone: "success" },
  };
  const cfg = statusConfig[status];

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-text-muted">
      <span
        className="inline-flex items-center gap-1.5 rounded-sm border px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.14em]"
        style={{
          color: CHART_TONE_VAR[cfg.tone],
          borderColor: CHART_TONE_VAR[cfg.tone],
        }}
      >
        {cfg.label}
      </span>
      <LegendSwatch tone="info" label="Baseline / modeled state" />
      <LegendSwatch tone="success" label="Savings (cost reduction)" />
      <LegendSwatch tone="warning" label="Cost (cost addition)" />
      <span aria-hidden className="text-text-disabled">
        ·
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          // Dashed-outline swatch matches the modeled-state bar treatment.
          className="inline-block h-2 w-3 rounded-sm border border-dashed bg-transparent"
          style={{ borderColor: CHART_TONE_VAR.info }}
        />
        Modeled forecast
      </span>
    </div>
  );
}

function LegendSwatch({ tone, label }: { tone: ChartTone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-2 w-3 rounded-sm"
        style={{ backgroundColor: CHART_TONE_VAR[tone] }}
      />
      {label}
    </span>
  );
}

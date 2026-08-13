import * as React from "react";
import { Group } from "@visx/group";
import { Line } from "@visx/shape";
import { Text } from "@visx/text";
import { ChartFrame } from "@/components/charts/primitives/chart-frame";
import { ChartBandArea } from "@/components/charts/primitives/chart-band-area";
import {
  ChartProjectionLine,
  type ChartProjectionLinePoint,
} from "@/components/charts/primitives/chart-projection-line";
import {
  CHART_FONT_MONO,
  CHART_FONT_SANS,
  CHART_TICK_LABEL,
  CHART_TONE_VAR,
  type ChartTone,
  type SourceNote,
} from "@/lib/charts/types";

/**
 * ROI Bridge — Phase 1B Exhibit Sprint 7 (eighth and final Phase 1B exhibit).
 *
 * Walks the viewer through a multi-period (Y1 / Y2 / Y3) modeled return
 * range. The exhibit deliberately renders a SENSITIVITY BAND (low /
 * expected / high) rather than a single deterministic line so the
 * cone-of-uncertainty stays unmistakable at every period.
 *
 * Composes `ChartFrame` + the new `ChartBandArea` primitive (low→high
 * envelope) + the new `ChartProjectionLine` primitive (expected-value
 * line with markers and numeric labels at each period).
 *
 *   ⚠ CREDIBILITY-SENSITIVE EXHIBIT.
 *   This sprint ships under **Gate 0** of the Phase 1B Financial
 *   Assumptions Canon (`docs/15_PHASE_1B_FINANCIAL_ASSUMPTIONS_CANON.md`).
 *   No financial model exists. The exhibit MUST NOT imply real client
 *   ROI, real payback timing, real break-even, or finance approval; the
 *   chrome, takeaway, and source note are written to make the
 *   illustrative status unmistakable.
 *
 *   The default takeaway, the default source note, and the legend
 *   status pill all carry the "Illustrative · Gate 0" tier deliberately.
 *   The exhibit deliberately rejects "guaranteed ROI" / "payback in X
 *   months" / "break-even" / "cash-flow positive by" / "will return X%"
 *   / "board-ready ROI" framing.
 *
 *   The exhibit also deliberately rejects collapsed bands
 *   (lowEstimate === expectedValue === highEstimate) — collapsing the
 *   sensitivity envelope visually implies certainty that no Gate 0
 *   illustrative dataset can support. Validation rejects such points.
 *
 * **Value-direction convention:** y-axis is the modeled return range as
 * a percentage. The exhibit never labels a single ROI figure as a
 * commitment, never names a payback period, never suggests
 * break-even — it shows a range and stops.
 *
 * **Type duplication note.** `FinancialAssumptionSet`,
 * `FinancialConfidence`, and `FinancialAssumptionStatus` are
 * intentionally duplicated from `ai-savings-waterfall.tsx` so the
 * exhibit stays data-shape-pure and free of cross-exhibit imports.
 * Both exhibits' types match the canon (`docs/15_*`) byte-for-byte.
 * A future shared-types extraction sprint will lift these into
 * `lib/charts/financial-types.ts` once a third financial exhibit
 * exists; for now the duplication is deliberate.
 *
 * Pure server component. SVG only. No new package dependencies.
 */

// ---------------------------------------------------------------------------
// Public types — match docs/15 exactly. Duplicated from
// `ai-savings-waterfall.tsx` per the type-duplication note above.
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

export type RoiBridgePeriod = "Y1" | "Y2" | "Y3";

export interface RoiBridgePoint {
  period: RoiBridgePeriod;
  /** Modeled expected-case return for the period, expressed as a percent (e.g. 60 = 60%). */
  expectedValue: number;
  /** Modeled low-case return for the period (percent). */
  lowEstimate: number;
  /** Modeled high-case return for the period (percent). */
  highEstimate: number;
  confidence: FinancialConfidence;
}

export interface RoiBridgeProps {
  assumptionSet: FinancialAssumptionSet;
  /** Period-by-period modeled return ranges. Need at least 2 periods to render a band. */
  points: RoiBridgePoint[];
  /**
   * Optional source-note override. When omitted, the source note is
   * derived from `assumptionSet.status` per the Financial Assumptions
   * Canon. Override only when the call site has a specific reason.
   */
  sourceNote?: SourceNote;
  /**
   * Optional takeaway override. Default: "Illustrative ROI structure
   * only; finance-approved assumptions are required before
   * client-facing return claims." Override only at higher tiers, and
   * never to include prohibited claim language.
   */
  takeaway?: string;
}

// ---------------------------------------------------------------------------
// Validation helpers — exported so a future report-wiring sprint can
// reuse them without re-implementing the canon's invariants.
// Mirrors `ai-savings-waterfall.tsx`'s validateAssumptionSet, with an
// additional `validateRoiBridgePoint` for the band-shape invariants.
// ---------------------------------------------------------------------------

const VALID_STATUSES: FinancialAssumptionStatus[] = [
  "illustrative",
  "operator_estimated",
  "client_validated",
  "finance_approved",
];
const VALID_CONFIDENCES: FinancialConfidence[] = ["low", "medium", "high"];
const VALID_PERIODS: RoiBridgePeriod[] = ["Y1", "Y2", "Y3"];

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

/**
 * Validate a single ROI bridge point. Rejects:
 *   - non-finite expected/low/high values
 *   - missing or unknown period / confidence
 *   - lowEstimate > expectedValue
 *   - expectedValue > highEstimate
 *   - collapsed bands where low === expected === high (implies certainty;
 *     no Gate 0 illustrative dataset can support that and the
 *     cone-of-uncertainty visual would degenerate to a single line)
 */
export function validateRoiBridgePoint(p: RoiBridgePoint): RoiBridgePoint | null {
  if (!p) return null;
  if (!VALID_PERIODS.includes(p.period)) return null;
  if (!VALID_CONFIDENCES.includes(p.confidence)) return null;
  if (
    typeof p.expectedValue !== "number" ||
    !Number.isFinite(p.expectedValue)
  ) {
    return null;
  }
  if (typeof p.lowEstimate !== "number" || !Number.isFinite(p.lowEstimate)) {
    return null;
  }
  if (typeof p.highEstimate !== "number" || !Number.isFinite(p.highEstimate)) {
    return null;
  }
  if (p.lowEstimate > p.expectedValue) return null;
  if (p.expectedValue > p.highEstimate) return null;
  // Reject collapsed bands — same low / expected / high values imply
  // certainty the canon does not allow under Gate 0.
  if (p.lowEstimate === p.expectedValue && p.expectedValue === p.highEstimate) {
    return null;
  }
  return p;
}

// ---------------------------------------------------------------------------
// Source-note helper — exported. Strings match docs/15 exactly.
// (Same vocabulary as `defaultFinancialSourceNote` in the waterfall
// exhibit; the function is duplicated here so this exhibit does not
// import from a sibling.)
// ---------------------------------------------------------------------------

export function defaultRoiBridgeSourceNote(
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
// Layout constants
// ---------------------------------------------------------------------------

const WIDTH = 880;
const HEIGHT = 540;
const MARGINS = { top: 64, right: 56, bottom: 80, left: 84 };
const PERIOD_X_RATIOS: Record<RoiBridgePeriod, number> = {
  Y1: 0.2,
  Y2: 0.5,
  Y3: 0.8,
};

const DEFAULT_TAKEAWAY =
  "Illustrative ROI structure only; finance-approved assumptions are required before client-facing return claims.";

// ---------------------------------------------------------------------------
// Y-axis domain helper
// ---------------------------------------------------------------------------

/**
 * Round the chart's y-axis ceiling to a tidy multiple of 50 percent
 * sitting at least 10% above the largest high estimate. Keeps the
 * top of the band away from the frame edge so the highest marker has
 * vertical headroom for its numeric label.
 */
function deriveYDomainMax(maxHigh: number): number {
  const padded = Math.max(50, maxHigh * 1.1);
  return Math.ceil(padded / 50) * 50;
}

function yScalePercent(
  innerHeight: number,
  yDomainMax: number,
): (v: number) => number {
  return (v: number) => {
    if (yDomainMax <= 0) return innerHeight;
    const clamped = Math.max(0, Math.min(yDomainMax, v));
    return innerHeight - (clamped / yDomainMax) * innerHeight;
  };
}

// ---------------------------------------------------------------------------
// Exhibit
// ---------------------------------------------------------------------------

export function RoiBridge({
  assumptionSet,
  points,
  sourceNote,
  takeaway,
}: RoiBridgeProps) {
  const validation = validateAssumptionSet(assumptionSet);
  const validPoints = points
    .map(validateRoiBridgePoint)
    .filter((p): p is RoiBridgePoint => p !== null);

  // Source note: derive from status when not overridden. If the
  // assumption set is invalid, fall back to the safest possible string.
  const resolvedSourceNote =
    sourceNote ??
    (validation.ok
      ? defaultRoiBridgeSourceNote(assumptionSet)
      : { text: "Source: Illustrative sample data · not a financial model" });

  const resolvedTakeaway = takeaway ?? DEFAULT_TAKEAWAY;

  return (
    <ChartFrame
      width={WIDTH}
      height={HEIGHT}
      eyebrow="ROI Bridge"
      title="Illustrative modeled return range · Y1 → Y2 → Y3"
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
        if (validPoints.length < 2) {
          const rejected = points.length - validPoints.length;
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
              {`INSUFFICIENT VALID POINTS · ${validPoints.length} VALID · ${rejected} REJECTED`}
            </Text>
          );
        }

        // Sort by canonical period order so the line traces left-to-right.
        const orderedPoints = [...validPoints].sort(
          (a, b) =>
            VALID_PERIODS.indexOf(a.period) - VALID_PERIODS.indexOf(b.period),
        );

        const maxHigh = orderedPoints.reduce(
          (m, p) => Math.max(m, p.highEstimate),
          0,
        );
        const yDomainMax = deriveYDomainMax(maxHigh);
        const y = yScalePercent(innerHeight, yDomainMax);

        // X positions: pinned to PERIOD_X_RATIOS so Y1/Y2/Y3 anchor at
        // 20% / 50% / 80% of the inner width regardless of how many
        // periods are present (defensive for partial datasets).
        const positioned = orderedPoints.map((p) => {
          const xRatio = PERIOD_X_RATIOS[p.period];
          return {
            point: p,
            x: xRatio * innerWidth,
            yExpected: y(p.expectedValue),
            yLow: y(p.lowEstimate),
            yHigh: y(p.highEstimate),
          };
        });

        const upperBand: ChartProjectionLinePoint[] = positioned.map((pp) => ({
          x: pp.x,
          y: pp.yHigh,
        }));
        const lowerBand: ChartProjectionLinePoint[] = positioned.map((pp) => ({
          x: pp.x,
          y: pp.yLow,
        }));
        const expectedLine: ChartProjectionLinePoint[] = positioned.map(
          (pp) => ({ x: pp.x, y: pp.yExpected }),
        );

        // Y-axis ticks at 0 / domainMax/2 / domainMax. Round to whole percent.
        const yTickValues = [
          0,
          Math.round(yDomainMax / 2),
          yDomainMax,
        ];

        return (
          <>
            {/* Subtle horizontal grid + Y-axis tick labels */}
            <Group>
              {yTickValues.map((tick, i) => (
                <g key={`ytick-${i}`}>
                  <Line
                    from={{ x: 0, y: y(tick) }}
                    to={{ x: innerWidth, y: y(tick) }}
                    stroke="var(--color-border-subtle)"
                    strokeOpacity={0.45}
                    strokeDasharray={tick === 0 ? undefined : "2 4"}
                    strokeWidth={1}
                  />
                  <Text
                    x={-12}
                    y={y(tick)}
                    fontFamily={CHART_FONT_MONO}
                    fontSize={10}
                    letterSpacing={1.2}
                    fill={CHART_TICK_LABEL}
                    textAnchor="end"
                    verticalAnchor="middle"
                  >
                    {`${tick}%`}
                  </Text>
                </g>
              ))}
            </Group>

            {/* Y-axis label */}
            <Group>
              <Text
                x={-MARGINS.left + 14}
                y={innerHeight / 2}
                fontFamily={CHART_FONT_SANS}
                fontSize={11}
                fill="var(--color-text-muted)"
                textAnchor="middle"
                verticalAnchor="middle"
                angle={-90}
              >
                Modeled range · %
              </Text>
            </Group>

            {/* Sensitivity band — ChartBandArea renders the closed
                low→high envelope so the cone-of-uncertainty is visible
                at every period. */}
            <ChartBandArea
              upperPoints={upperBand}
              lowerPoints={lowerBand}
              fill={CHART_TONE_VAR.info}
              fillOpacity={0.18}
              stroke={CHART_TONE_VAR.info}
              strokeOpacity={0.4}
              strokeWidth={1}
              title="Modeled return range · low to high · illustrative"
            />

            {/* Expected-value polyline with markers at each period */}
            <ChartProjectionLine
              points={expectedLine}
              stroke={CHART_TONE_VAR.info}
              strokeWidth={2}
              strokeOpacity={0.95}
              markerFill={CHART_TONE_VAR.info}
              markerRadius={5}
              title="Modeled expected-case return · illustrative"
            />

            {/* Numeric labels above each expected-value marker. Labels
                read as plain percentages — never "ROI", never "payback",
                never "break-even". */}
            <Group>
              {positioned.map((pp, i) => (
                <Text
                  key={`label-${i}`}
                  x={pp.x}
                  y={pp.yExpected - 14}
                  fontFamily={CHART_FONT_MONO}
                  fontSize={11}
                  letterSpacing={0.8}
                  fill="var(--color-text-secondary)"
                  textAnchor="middle"
                  verticalAnchor="end"
                >
                  {`${Math.round(pp.point.expectedValue)}%`}
                </Text>
              ))}
            </Group>

            {/* X-axis: period labels */}
            <Group top={innerHeight + 18}>
              {positioned.map((pp, i) => (
                <Text
                  key={`period-${i}`}
                  x={pp.x}
                  y={0}
                  fontFamily={CHART_FONT_SANS}
                  fontSize={11}
                  fontWeight={500}
                  fill="var(--color-text-secondary)"
                  textAnchor="middle"
                  verticalAnchor="middle"
                >
                  {pp.point.period}
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
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block h-2 w-3 rounded-sm"
          style={{
            backgroundColor: CHART_TONE_VAR.info,
            opacity: 0.18,
          }}
        />
        Sensitivity band (low → high)
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          // Solid line + dot to match the expected-value polyline.
          className="relative inline-block h-2 w-3"
        >
          <span
            aria-hidden
            className="absolute left-0 right-0 top-1/2 block h-px -translate-y-1/2"
            style={{ backgroundColor: CHART_TONE_VAR.info }}
          />
          <span
            aria-hidden
            className="absolute left-1/2 top-1/2 block h-1.5 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ backgroundColor: CHART_TONE_VAR.info }}
          />
        </span>
        Expected case (modeled)
      </span>
      <span aria-hidden className="text-text-disabled">
        ·
      </span>
      <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
        Modeled range — not a commitment
      </span>
    </div>
  );
}

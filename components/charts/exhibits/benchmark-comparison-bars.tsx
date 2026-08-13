import * as React from "react";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { Line } from "@visx/shape";
import { Text } from "@visx/text";
import { ChartFrame } from "@/components/charts/primitives/chart-frame";
import { ChartPercentileBand } from "@/components/charts/primitives/chart-percentile-band";
import {
  CHART_FONT_MONO,
  CHART_FONT_SANS,
  CHART_TICK_LABEL,
  CHART_TONE_VAR,
  type ChartTone,
  type SourceNote,
} from "@/lib/charts/types";

/**
 * Benchmark Comparison Bars — Phase 1B Exhibit Sprint 5.
 *
 * Per-dimension client score plotted against an illustrative p25/p50/p75
 * percentile band. Composes `ChartFrame` + the new `ChartPercentileBand`
 * primitive.
 *
 *   ⚠ CREDIBILITY-SENSITIVE EXHIBIT.
 *   This sprint ships under **Gate 0** of the Phase 1B Benchmark Data
 *   Canon (`docs/14_PHASE_1B_BENCHMARK_DATA_CANON.md`). No benchmark
 *   dataset exists. The exhibit MUST NOT imply real benchmark data, and
 *   MUST NOT be wired into reports, proposals, public-scorecard
 *   surfaces, or PDF exports until a validated dataset exists.
 *
 *   The default takeaway, the default source note, and the legend copy
 *   are all written to make the illustrative status unmistakable. The
 *   exhibit deliberately rejects "above average" / "top quartile" /
 *   "industry benchmark" framing.
 *
 * Pure server component. SVG only. No new package dependencies.
 */

// ---------------------------------------------------------------------------
// Public types — match docs/14_PHASE_1B_BENCHMARK_DATA_CANON.md exactly.
// ---------------------------------------------------------------------------

export type BenchmarkDatasetStatus =
  | "illustrative"
  | "internal_directional"
  | "validated";

export interface BenchmarkComparisonPoint {
  dimension: string;
  /** Client score, 0–100. Clamped at validation. */
  clientScore: number;
  /** Lower-quartile boundary, 0–100. Must satisfy `p25 ≤ p50 ≤ p75`. */
  p25: number;
  /** Median, 0–100. */
  p50: number;
  /** Upper-quartile boundary, 0–100. */
  p75: number;
  /** Sample size behind THIS dimension's percentiles. */
  sampleSize: number;
  /** Vintage in `YYYY-MM-DD` or `YYYY-Q#` format. */
  vintage: string;
  /** Human-facing label, e.g. "Mid-market SaaS, 2025–2026". */
  benchmarkLabel: string;
}

export interface BenchmarkComparisonDataset {
  label: string;
  /** Required when `status === "validated"`. */
  methodology: string;
  vintage: string;
  sampleSize: number;
  points: BenchmarkComparisonPoint[];
  status: BenchmarkDatasetStatus;
}

export interface BenchmarkComparisonBarsProps {
  dataset: BenchmarkComparisonDataset;
  /**
   * Optional override. When omitted, the source note is derived from
   * `dataset.status` per the Benchmark Data Canon. Override only when
   * the call site has a specific reason to deviate.
   */
  sourceNote?: SourceNote;
  /**
   * Optional override. The default takeaway is intentionally
   * conservative ("Illustrative comparison structure only; validated
   * benchmark data is required before client-facing use.") to prevent
   * fake-benchmark optics under Gate 0.
   */
  takeaway?: string;
}

// ---------------------------------------------------------------------------
// Validation / normalization — pure helpers, exported so a future
// report-wiring sprint can reuse them.
// ---------------------------------------------------------------------------

function clampScore(v: number): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(0, Math.min(100, v));
}

/**
 * Defensive normalization. Returns `null` when the row violates the
 * canonical invariant `p25 ≤ p50 ≤ p75`. Callers MUST drop null rows;
 * the exhibit must not silently sort bad percentiles.
 */
export function validateAndClampPoint(
  p: BenchmarkComparisonPoint,
): BenchmarkComparisonPoint | null {
  const clientScore = clampScore(p.clientScore);
  const p25 = clampScore(p.p25);
  const p50 = clampScore(p.p50);
  const p75 = clampScore(p.p75);
  if (p25 > p50 || p50 > p75) return null;
  return { ...p, clientScore, p25, p50, p75 };
}

// ---------------------------------------------------------------------------
// Source-note derivation — exported so a future report-wiring sprint
// can audit it independently. Strings match docs/14 exactly.
// ---------------------------------------------------------------------------

export function defaultBenchmarkSourceNote(
  dataset: BenchmarkComparisonDataset,
): SourceNote {
  switch (dataset.status) {
    case "illustrative":
      // Gate 0 — no `n`, no vintage, no methodology. Anything else
      // would imply a real sample exists.
      return { text: "Illustrative sample data · not a benchmark" };
    case "internal_directional":
      // Compose `n=…` BEFORE `vintage` per the canon. The structured
      // `n` field is intentionally NOT used so the rendered string
      // matches docs/14 exactly.
      return {
        text: `Internal SLATE assessments · directional benchmark · n=${dataset.sampleSize} · vintage ${dataset.vintage}`,
      };
    case "validated":
      return {
        text: `Saipien Labs benchmark dataset · n=${dataset.sampleSize} · vintage ${dataset.vintage}`,
      };
  }
}

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------

const WIDTH = 880;
const HEIGHT = 540;

// Margins: left for dimension labels, top for legend handled by ChartFrame,
// bottom for the 0/25/50/75/100 axis ticks.
const MARGINS = {
  top: 48,
  right: 32,
  bottom: 44,
  left: 220,
};

const ROW_PAD_RATIO = 0.18;
const DEFAULT_TAKEAWAY =
  "Illustrative comparison structure only; validated benchmark data is required before client-facing use.";

// ---------------------------------------------------------------------------
// Exhibit
// ---------------------------------------------------------------------------

export function BenchmarkComparisonBars({
  dataset,
  sourceNote,
  takeaway,
}: BenchmarkComparisonBarsProps) {
  const validPoints = dataset.points
    .map(validateAndClampPoint)
    .filter((p): p is BenchmarkComparisonPoint => p !== null);

  const resolvedSourceNote = sourceNote ?? defaultBenchmarkSourceNote(dataset);
  const resolvedTakeaway = takeaway ?? DEFAULT_TAKEAWAY;

  return (
    <ChartFrame
      width={WIDTH}
      height={HEIGHT}
      eyebrow="Benchmark Comparison Bars"
      title="Client score vs illustrative percentile bands"
      takeaway={resolvedTakeaway}
      legend={<Legend status={dataset.status} />}
      sourceNote={resolvedSourceNote}
      margins={MARGINS}
    >
      {(innerWidth, innerHeight) => {
        if (validPoints.length === 0) {
          // All rows invalid → render an inline empty state inside the
          // chart area. The canon forbids axis-stretching or silent
          // sorting, so we surface the failure rather than masking it.
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
              {`NO VALID PERCENTILE DATA · ${dataset.points.length} ROW${
                dataset.points.length === 1 ? "" : "S"
              } REJECTED`}
            </Text>
          );
        }

        const xScale = scaleLinear<number>({
          domain: [0, 100],
          range: [0, innerWidth],
          // No `nice: true` — the canon explicitly forbids stretching
          // the axis beyond 0–100.
        });
        const rowHeight = innerHeight / validPoints.length;
        const bandHeight = rowHeight * (1 - ROW_PAD_RATIO * 2);

        return (
          <>
            {/* Dimension labels in the left margin */}
            {validPoints.map((point, ri) => (
              <Text
                key={`row-${ri}`}
                x={-(MARGINS.left - 12)}
                y={ri * rowHeight + rowHeight / 2}
                width={MARGINS.left - 24}
                fontFamily={CHART_FONT_SANS}
                fontSize={12}
                fontWeight={500}
                fill="var(--color-text-secondary)"
                textAnchor="start"
                verticalAnchor="middle"
              >
                {point.dimension}
              </Text>
            ))}

            {/* Percentile bands + client markers, one per dimension */}
            <Group>
              {validPoints.map((point, ri) => {
                const rowTop = ri * rowHeight + rowHeight * ROW_PAD_RATIO;
                const p25X = xScale(point.p25);
                const p50X = xScale(point.p50);
                const p75X = xScale(point.p75);
                const clientX = xScale(point.clientScore);
                // Title text reads neutrally — never "above average" /
                // "top quartile" — to honor the canon's claim rules.
                const titleText = `${point.dimension}: client score ${point.clientScore}. Illustrative percentile band p25=${point.p25}, p50=${point.p50}, p75=${point.p75}.`;
                return (
                  <ChartPercentileBand
                    key={`band-${ri}`}
                    x={0}
                    y={rowTop}
                    width={innerWidth}
                    height={bandHeight}
                    p25X={p25X}
                    p50X={p50X}
                    p75X={p75X}
                    clientX={clientX}
                    clientLabel={point.clientScore}
                    title={titleText}
                  />
                );
              })}
            </Group>

            {/* Bottom axis: discrete ticks at 0, 25, 50, 75, 100. We
                render manually rather than calling ChartAxisBottom so we
                can suppress intermediate ticks the linear scale would
                otherwise emit at 20/40/60/80. */}
            <Group top={innerHeight}>
              <Line
                from={{ x: 0, y: 0 }}
                to={{ x: innerWidth, y: 0 }}
                stroke="var(--color-border-strong)"
                strokeWidth={1}
              />
              {[0, 25, 50, 75, 100].map((value) => (
                <g key={`tick-${value}`}>
                  <Line
                    from={{ x: xScale(value), y: 0 }}
                    to={{ x: xScale(value), y: 4 }}
                    stroke="var(--color-border-strong)"
                    strokeWidth={1}
                  />
                  <Text
                    x={xScale(value)}
                    y={16}
                    fontFamily={CHART_FONT_MONO}
                    fontSize={10}
                    letterSpacing={1.2}
                    fill={CHART_TICK_LABEL}
                    textAnchor="middle"
                    verticalAnchor="middle"
                  >
                    {String(value)}
                  </Text>
                </g>
              ))}
              {/* Neutral axis caption — no "better" / "stronger" framing. */}
              <Text
                x={innerWidth / 2}
                y={36}
                fontFamily={CHART_FONT_SANS}
                fontSize={11}
                fill="var(--color-text-muted)"
                textAnchor="middle"
                verticalAnchor="middle"
              >
                {"Score · 0–100"}
              </Text>
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

function Legend({ status }: { status: BenchmarkDatasetStatus }) {
  // Status pill — read by the audience as a credibility tier. For
  // Gate 0 the canon REQUIRES the word "Illustrative" appear in the
  // visible chrome; the takeaway + source note also carry it.
  const statusConfig: Record<
    BenchmarkDatasetStatus,
    { label: string; tone: ChartTone }
  > = {
    illustrative: { label: "Illustrative · Gate 0", tone: "warning" },
    internal_directional: {
      label: "Internal directional · Gate 1",
      tone: "info",
    },
    validated: { label: "Validated · Gate 2", tone: "success" },
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
        <DiamondSwatch fill={CHART_TONE_VAR.brand} />
        Client score
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block h-2 w-3 rounded-sm"
          style={{
            backgroundColor: CHART_TONE_VAR.info,
            opacity: 0.5,
          }}
        />
        p25 &ndash; p75 range
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block h-2 w-px"
          style={{ backgroundColor: CHART_TONE_VAR.info }}
        />
        Median (p50)
      </span>
    </div>
  );
}

function DiamondSwatch({ fill }: { fill: string }) {
  return (
    <svg
      aria-hidden
      width={9}
      height={9}
      viewBox="0 0 10 10"
      className="inline-block"
    >
      <polygon
        points="5,1 9,5 5,9 1,5"
        fill={fill}
        stroke="var(--color-bg-surface)"
        strokeWidth={1}
        strokeLinejoin="round"
      />
    </svg>
  );
}

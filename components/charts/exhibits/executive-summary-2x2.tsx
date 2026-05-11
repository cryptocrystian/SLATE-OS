import * as React from "react";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { Circle, Line } from "@visx/shape";
import { Text } from "@visx/text";
import { ChartFrame } from "@/components/charts/primitives/chart-frame";
import {
  ChartAxisBottom,
  ChartAxisLeft,
} from "@/components/charts/primitives/chart-axis";
import { ChartGrid } from "@/components/charts/primitives/chart-grid";
import {
  CHART_DATA_LABEL,
  CHART_FONT_MONO,
  CHART_FONT_SANS,
  CHART_QUADRANT_LABEL,
  CHART_TONE_VAR,
  type ChartTone,
  type SourceNote,
} from "@/lib/charts/types";

/**
 * Executive Summary · 2×2 — Phase 1B Sprint 1 (prop-driven).
 *
 * McKinsey-style impact × complexity portfolio matrix. Bubble size is
 * a safe non-financial proxy (`impactSignal`), color is evidence
 * strength, and a single recommended item carries a dashed brand
 * ring. The exhibit is now prop-driven so adapter output from
 * `lib/charts/adapters/executive-summary-2x2-adapter.ts` flows
 * straight in — the proof-of-fit's static `SAMPLE_DATA` was moved
 * into `app/app/charts-preview/page.tsx` and is no longer carried by
 * the exhibit.
 *
 * Pure server component. SVG output. No browser APIs, no hooks. Scales
 * to its container width via `ChartFrame`'s `viewBox` + `w-full h-auto`.
 *
 *   ⚠ Bubble-size framing.
 *   `impactSignal` is **business impact**, not annual ROI or dollars.
 *   The canon (docs/15) prohibits naming this dimension as financial
 *   until a Gate 1+ financial assumption set exists. The preview
 *   route may pass its own legend label to keep the proof-of-fit's
 *   original wording inside that clearly-illustrative context.
 */

export interface ExecutiveSummaryPortfolioPoint {
  id: string;
  title: string;
  /** Impact score 0–100. Drives Y position. */
  impact: number;
  /** Complexity score 0–100. Drives X position. */
  complexity: number;
  /**
   * Bubble-size signal. Carries business impact as a safe non-financial
   * proxy. The canon prohibits naming this dimension "ROI" / "savings"
   * until docs/15 advances to Gate 1+.
   */
  impactSignal: number;
  /** Evidence strength → categorical color tone. */
  evidence: ChartTone;
  /** When true, the bubble carries a dashed brand-tinted outer ring. */
  recommended?: boolean;
}

export interface ExecutiveSummaryPortfolioProps {
  points: ExecutiveSummaryPortfolioPoint[];
  /**
   * Optional explicit recommended-item id. When supplied, overrides
   * any per-point `recommended` flag — the matching point gets the
   * brand ring.
   */
  recommendedId?: string;
  /** Required source attribution. */
  sourceNote: SourceNote;
  /** Optional consultant takeaway. Defaults to the proof-of-fit string. */
  takeaway?: string;
  /**
   * Optional legend label for the bubble-size encoding. The preview
   * route passes `"annual ROI"` to keep the proof-of-fit's original
   * label inside its clearly-illustrative context. Default is the
   * canon-safe neutral phrasing `"business impact"`.
   */
  bubbleSizeLabel?: string;
}

// Logical SVG canvas (viewBox). Aspect ratio is preserved by ChartFrame.
const WIDTH = 880;
const HEIGHT = 540;

// Quadrant midpoints. Impact midpoint is intentionally biased above 50
// because consulting exhibits typically reserve the top-half for
// "actionable opportunity" rather than mathematical mid-line.
const QUADRANT_THRESHOLD_X = 50;
const QUADRANT_THRESHOLD_Y = 60;

const MIN_RADIUS = 8;
const MAX_RADIUS = 28;

const QUADRANT_LABEL_PADDING = 8;

const DEFAULT_TAKEAWAY =
  "Quick wins concentrate above the impact midpoint and below the complexity midpoint. Strategic builds with strong evidence sit upper-right; risk-weighted defer items sit lower-right.";
const DEFAULT_BUBBLE_SIZE_LABEL = "business impact";

export function ExecutiveSummaryTwoByTwo({
  points,
  recommendedId,
  sourceNote,
  takeaway,
  bubbleSizeLabel = DEFAULT_BUBBLE_SIZE_LABEL,
}: ExecutiveSummaryPortfolioProps) {
  const maxImpactSignal = points.reduce(
    (m, p) => Math.max(m, p.impactSignal),
    0,
  );

  return (
    <ChartFrame
      width={WIDTH}
      height={HEIGHT}
      eyebrow="Executive Summary · 2×2"
      title="Opportunity portfolio · impact × complexity"
      takeaway={takeaway ?? DEFAULT_TAKEAWAY}
      legend={<Legend bubbleSizeLabel={bubbleSizeLabel} />}
      sourceNote={sourceNote}
    >
      {(innerWidth, innerHeight) => {
        if (points.length === 0) {
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
              NO PORTFOLIO POINTS
            </Text>
          );
        }
        const xScale = scaleLinear<number>({
          domain: [0, 100],
          range: [0, innerWidth],
          nice: true,
        });
        const yScale = scaleLinear<number>({
          domain: [0, 100],
          range: [innerHeight, 0],
          nice: true,
        });
        const radiusScale = scaleLinear<number>({
          domain: [0, Math.max(1, maxImpactSignal)],
          range: [MIN_RADIUS, MAX_RADIUS],
        });

        return (
          <>
            <ChartGrid
              xScale={xScale}
              yScale={yScale}
              width={innerWidth}
              height={innerHeight}
              numTicksX={5}
              numTicksY={5}
            />

            {/* Quadrant separators: vertical + horizontal midlines */}
            <Line
              from={{ x: xScale(QUADRANT_THRESHOLD_X), y: 0 }}
              to={{ x: xScale(QUADRANT_THRESHOLD_X), y: innerHeight }}
              stroke="var(--color-border-strong)"
              strokeDasharray="4 4"
              strokeOpacity={0.55}
            />
            <Line
              from={{ x: 0, y: yScale(QUADRANT_THRESHOLD_Y) }}
              to={{ x: innerWidth, y: yScale(QUADRANT_THRESHOLD_Y) }}
              stroke="var(--color-border-strong)"
              strokeDasharray="4 4"
              strokeOpacity={0.55}
            />

            {/* Quadrant labels (top-left, top-right, bottom-left, bottom-right) */}
            <Text
              x={QUADRANT_LABEL_PADDING}
              y={QUADRANT_LABEL_PADDING}
              fontFamily={CHART_FONT_MONO}
              fontSize={9}
              letterSpacing={1.6}
              fill={CHART_QUADRANT_LABEL}
              verticalAnchor="start"
            >
              QUICK WINS
            </Text>
            <Text
              x={innerWidth - QUADRANT_LABEL_PADDING}
              y={QUADRANT_LABEL_PADDING}
              fontFamily={CHART_FONT_MONO}
              fontSize={9}
              letterSpacing={1.6}
              fill={CHART_QUADRANT_LABEL}
              verticalAnchor="start"
              textAnchor="end"
            >
              STRATEGIC BUILDS
            </Text>
            <Text
              x={QUADRANT_LABEL_PADDING}
              y={innerHeight - QUADRANT_LABEL_PADDING}
              fontFamily={CHART_FONT_MONO}
              fontSize={9}
              letterSpacing={1.6}
              fill={CHART_QUADRANT_LABEL}
              verticalAnchor="end"
            >
              LOW PRIORITY
            </Text>
            <Text
              x={innerWidth - QUADRANT_LABEL_PADDING}
              y={innerHeight - QUADRANT_LABEL_PADDING}
              fontFamily={CHART_FONT_MONO}
              fontSize={9}
              letterSpacing={1.6}
              fill={CHART_QUADRANT_LABEL}
              verticalAnchor="end"
              textAnchor="end"
            >
              DEFER · AVOID
            </Text>

            {/* Bubbles + per-point labels */}
            <Group>
              {points.map((p) => {
                const cx = xScale(p.complexity);
                const cy = yScale(p.impact);
                const r = radiusScale(p.impactSignal);
                const fill = CHART_TONE_VAR[p.evidence];
                const isRecommended = recommendedId
                  ? p.id === recommendedId
                  : p.recommended === true;
                return (
                  <g key={p.id}>
                    {isRecommended ? (
                      <Circle
                        cx={cx}
                        cy={cy}
                        r={r + 5}
                        fill="none"
                        stroke="var(--color-brand-primary)"
                        strokeOpacity={0.7}
                        strokeWidth={1}
                        strokeDasharray="2 3"
                      />
                    ) : null}
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={fill}
                      fillOpacity={isRecommended ? 0.32 : 0.18}
                      stroke={fill}
                      strokeWidth={isRecommended ? 1.6 : 1}
                    />
                    <Text
                      x={cx}
                      y={cy - r - 8}
                      fontFamily={CHART_FONT_SANS}
                      fontSize={11}
                      fill={CHART_DATA_LABEL}
                      textAnchor="middle"
                      verticalAnchor="end"
                    >
                      {p.title}
                    </Text>
                  </g>
                );
              })}
            </Group>

            <ChartAxisBottom
              top={innerHeight}
              scale={xScale}
              label="Higher complexity"
              arrow
              numTicks={5}
            />
            <ChartAxisLeft
              scale={yScale}
              label="Higher impact"
              arrow
              numTicks={5}
            />
          </>
        );
      }}
    </ChartFrame>
  );
}

function Legend({ bubbleSizeLabel }: { bubbleSizeLabel: string }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-text-muted">
      <LegendSwatch tone="success" label="Strong evidence" />
      <LegendSwatch tone="info" label="Adequate evidence" />
      <LegendSwatch tone="warning" label="Thin evidence" />
      <span aria-hidden className="text-text-disabled">
        ·
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block h-2 w-2 rounded-full border border-dashed"
          style={{ borderColor: "var(--color-brand-primary)" }}
        />
        Recommended
      </span>
      <span aria-hidden className="text-text-disabled">
        ·
      </span>
      <span className="text-text-muted">
        Bubble size · {bubbleSizeLabel}
      </span>
    </div>
  );
}

function LegendSwatch({ tone, label }: { tone: ChartTone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-full"
        style={{ backgroundColor: CHART_TONE_VAR[tone] }}
      />
      {label}
    </span>
  );
}

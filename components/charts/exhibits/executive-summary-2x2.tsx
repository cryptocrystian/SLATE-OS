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
} from "@/lib/charts/types";

/**
 * Executive Summary · 2×2 — Phase 1B proof-of-fit exhibit.
 *
 * Static sample data only. Renders a McKinsey-style impact × complexity
 * portfolio matrix with bubble size = ROI and color = evidence strength.
 * The single recommended item carries a dashed brand ring.
 *
 * Pure server component. SVG output. No browser APIs, no hooks. Scales to
 * its container width via `ChartFrame`'s `viewBox` + `w-full h-auto`.
 *
 * Wiring into the persisted opportunity matrix or report builder is
 * deliberately deferred until the visual direction here is reviewed.
 */

interface PortfolioPoint {
  id: string;
  title: string;
  /** Impact score 0–100. */
  impact: number;
  /** Complexity score 0–100. */
  complexity: number;
  /** Annual ROI in dollars. Drives bubble radius. */
  roi: number;
  /** Evidence strength → categorical color tone. */
  evidence: ChartTone;
  /** When true, the bubble carries a dashed brand-tinted outer ring. */
  recommended?: boolean;
}

const SAMPLE_DATA: PortfolioPoint[] = [
  {
    id: "ai-recon",
    title: "AI-assisted reconciliation",
    impact: 82,
    complexity: 38,
    roi: 240_000,
    evidence: "success",
    recommended: true,
  },
  {
    id: "intake-auto",
    title: "Stakeholder intake automation",
    impact: 71,
    complexity: 28,
    roi: 110_000,
    evidence: "info",
  },
  {
    id: "proposal-draft",
    title: "Proposal draft acceleration",
    impact: 78,
    complexity: 65,
    roi: 320_000,
    evidence: "info",
  },
  {
    id: "kb-retrieval",
    title: "Internal knowledge retrieval",
    impact: 64,
    complexity: 72,
    roi: 180_000,
    evidence: "warning",
  },
  {
    id: "renewal-triage",
    title: "Renewal triage assistant",
    impact: 56,
    complexity: 42,
    roi: 90_000,
    evidence: "info",
  },
  {
    id: "contract-redline",
    title: "Contract redline screening",
    impact: 47,
    complexity: 81,
    roi: 70_000,
    evidence: "warning",
  },
  {
    id: "qbr-summary",
    title: "QBR summary drafting",
    impact: 38,
    complexity: 22,
    roi: 30_000,
    evidence: "warning",
  },
];

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

export function ExecutiveSummaryTwoByTwo() {
  const maxRoi = SAMPLE_DATA.reduce((m, p) => Math.max(m, p.roi), 0);

  return (
    <ChartFrame
      width={WIDTH}
      height={HEIGHT}
      eyebrow="Executive Summary · 2×2"
      title="Opportunity portfolio · impact × complexity"
      takeaway="Quick wins concentrate above the impact midpoint and below the complexity midpoint. Strategic builds with strong evidence sit upper-right; risk-weighted defer items sit lower-right."
      legend={<Legend />}
      sourceNote={{
        text: "Static sample data · Phase 1B proof-of-fit",
        n: SAMPLE_DATA.length,
      }}
    >
      {(innerWidth, innerHeight) => {
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
          domain: [0, maxRoi],
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
              {SAMPLE_DATA.map((p) => {
                const cx = xScale(p.complexity);
                const cy = yScale(p.impact);
                const r = radiusScale(p.roi);
                const fill = CHART_TONE_VAR[p.evidence];
                return (
                  <g key={p.id}>
                    {p.recommended ? (
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
                      fillOpacity={p.recommended ? 0.32 : 0.18}
                      stroke={fill}
                      strokeWidth={p.recommended ? 1.6 : 1}
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

function Legend() {
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
      <span className="text-text-muted">Bubble size · annual ROI</span>
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

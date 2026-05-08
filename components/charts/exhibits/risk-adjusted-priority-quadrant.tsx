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
import type { Opportunity } from "@/lib/opportunities/types";

/**
 * Risk-Adjusted Priority Quadrant — Phase 1B Exhibit Sprint 1.
 *
 * True 2×2 scatter:
 *   - x-axis: complexity (0–100, low → high)
 *   - y-axis: business impact (0–100, low → high)
 *   - bubble size: business impact (safe proxy for value until a
 *     financial model lands)
 *   - bubble color: risk band derived from `riskScore`
 *   - 50/50 dashed midlines (analytical-view convention; intentionally
 *     distinct from `lib/opportunities/helpers.ts`'s 70/60 thresholds
 *     used by the operator's editing matrix)
 *
 * The exhibit is data-shape-pure: it accepts a narrow
 * `RiskAdjustedQuadrantPoint[]` and never imports persisted-data libs
 * directly. The optional `opportunityToRiskQuadrantPoint` adapter at
 * the bottom of this file is the bridge the future report-wiring sprint
 * will consume.
 *
 * Pure server component. SVG only. No hover, no animation, no tooltip,
 * no client measurement. Composes existing SLATE chart primitives —
 * adds zero new Visx packages.
 */

export interface RiskAdjustedQuadrantPoint {
  id: string;
  title: string;
  /** Business impact, 0–100. Drives Y position AND bubble size. */
  impact: number;
  /** Implementation complexity, 0–100. Drives X position. */
  complexity: number;
  /** Delivery / adoption / governance risk, 0–100. Drives bubble color. */
  risk: number;
}

export interface RiskAdjustedPriorityQuadrantProps {
  points: RiskAdjustedQuadrantPoint[];
  /** Required source attribution. The canon mandates one on every exhibit. */
  sourceNote: SourceNote;
  /** Optional consultant takeaway. Defaults to a derived one-line summary. */
  takeaway?: string;
}

// Logical SVG canvas (viewBox). Matches the proof-of-fit so both exhibits
// share the same aspect-ratio rhythm in operator/preview pages.
const WIDTH = 880;
const HEIGHT = 540;

// 50/50 midlines per the user's Sprint 1 spec.
const MIDLINE_X = 50;
const MIDLINE_Y = 50;

const MIN_RADIUS = 8;
const MAX_RADIUS = 28;
const QUADRANT_LABEL_PADDING = 8;

// Risk-band thresholds. 4 bands map cleanly to the existing ChartTone
// vocabulary (success / info / warning / risk) — no new tone needed.
const RISK_BAND_THRESHOLDS = {
  low: 25,        // 0–24  → success
  medium: 50,     // 25–49 → info
  elevated: 75,   // 50–74 → warning
                  // 75+   → risk
} as const;

function riskTone(score: number): ChartTone {
  if (score < RISK_BAND_THRESHOLDS.low) return "success";
  if (score < RISK_BAND_THRESHOLDS.medium) return "info";
  if (score < RISK_BAND_THRESHOLDS.elevated) return "warning";
  return "risk";
}

function riskBandLabel(score: number): "Low" | "Medium" | "Elevated" | "High" {
  if (score < RISK_BAND_THRESHOLDS.low) return "Low";
  if (score < RISK_BAND_THRESHOLDS.medium) return "Medium";
  if (score < RISK_BAND_THRESHOLDS.elevated) return "Elevated";
  return "High";
}

type Quadrant = "quick-win" | "strategic-build" | "low-priority" | "defer-avoid";

function quadrantOf(p: RiskAdjustedQuadrantPoint): Quadrant {
  const highImpact = p.impact >= MIDLINE_Y;
  const lowComplexity = p.complexity < MIDLINE_X;
  if (highImpact && lowComplexity) return "quick-win";
  if (highImpact) return "strategic-build";
  if (lowComplexity) return "low-priority";
  return "defer-avoid";
}

/**
 * Pick the highest-impact point in each quadrant. Up to 4 ids labeled,
 * ensuring readable callouts without label clutter when 8+ points exist.
 */
function topByQuadrantIds(points: RiskAdjustedQuadrantPoint[]): Set<string> {
  const best: Record<Quadrant, RiskAdjustedQuadrantPoint | null> = {
    "quick-win": null,
    "strategic-build": null,
    "low-priority": null,
    "defer-avoid": null,
  };
  for (const p of points) {
    const q = quadrantOf(p);
    const cur = best[q];
    if (!cur || cur.impact < p.impact) best[q] = p;
  }
  return new Set(
    Object.values(best)
      .filter((p): p is RiskAdjustedQuadrantPoint => p !== null)
      .map((p) => p.id),
  );
}

function deriveTakeaway(points: RiskAdjustedQuadrantPoint[]): string {
  if (points.length === 0) {
    return "No opportunities scored yet. Score opportunities to populate the analytical view.";
  }
  let quickWin = 0;
  let strategic = 0;
  let highRisk = 0;
  for (const p of points) {
    const q = quadrantOf(p);
    if (q === "quick-win") quickWin += 1;
    if (q === "strategic-build") strategic += 1;
    if (p.risk >= RISK_BAND_THRESHOLDS.elevated) highRisk += 1;
  }
  const parts: string[] = [];
  parts.push(`${quickWin} quick win${quickWin === 1 ? "" : "s"}`);
  parts.push(`${strategic} strategic build${strategic === 1 ? "" : "s"}`);
  if (highRisk > 0) {
    parts.push(
      `${highRisk} item${highRisk === 1 ? "" : "s"} flagged elevated or high risk`,
    );
  }
  return `${parts.join(" · ")}.`;
}

export function RiskAdjustedPriorityQuadrant({
  points,
  sourceNote,
  takeaway,
}: RiskAdjustedPriorityQuadrantProps) {
  // Pure server component — no hooks. These are computed once per render.
  const labeledIds = topByQuadrantIds(points);
  const resolvedTakeaway = takeaway ?? deriveTakeaway(points);

  return (
    <ChartFrame
      width={WIDTH}
      height={HEIGHT}
      eyebrow="Risk-Adjusted Priority Quadrant"
      title="Opportunity portfolio · impact × complexity, risk-banded"
      takeaway={resolvedTakeaway}
      legend={<Legend />}
      sourceNote={sourceNote}
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
        // Domain fixed at [0, 100] so the bubble-size encoding is stable
        // across datasets — a 50-impact bubble looks the same on every
        // engagement, regardless of the engagement's data range.
        const radiusScale = scaleLinear<number>({
          domain: [0, 100],
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

            {/* Quadrant separators: vertical + horizontal at 50/50 */}
            <Line
              from={{ x: xScale(MIDLINE_X), y: 0 }}
              to={{ x: xScale(MIDLINE_X), y: innerHeight }}
              stroke="var(--color-border-strong)"
              strokeDasharray="4 4"
              strokeOpacity={0.55}
            />
            <Line
              from={{ x: 0, y: yScale(MIDLINE_Y) }}
              to={{ x: innerWidth, y: yScale(MIDLINE_Y) }}
              stroke="var(--color-border-strong)"
              strokeDasharray="4 4"
              strokeOpacity={0.55}
            />

            {/* Quadrant labels at corners */}
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

            {/* Bubbles + labels for the highest-impact item per quadrant */}
            <Group>
              {points.map((p) => {
                const cx = xScale(p.complexity);
                const cy = yScale(p.impact);
                const r = radiusScale(p.impact);
                const fill = CHART_TONE_VAR[riskTone(p.risk)];
                const label = labeledIds.has(p.id);
                const band = riskBandLabel(p.risk);
                const ariaLabel = `${p.title}. Impact ${p.impact}. Complexity ${p.complexity}. ${band} risk.`;
                return (
                  <g key={p.id}>
                    <title>{ariaLabel}</title>
                    <Circle
                      cx={cx}
                      cy={cy}
                      r={r}
                      fill={fill}
                      fillOpacity={0.18}
                      stroke={fill}
                      strokeWidth={1}
                    />
                    {label ? (
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
                    ) : null}
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
      <span className="font-mono uppercase tracking-[0.14em] text-text-muted">
        Risk
      </span>
      <LegendSwatch tone="success" label="Low" />
      <LegendSwatch tone="info" label="Medium" />
      <LegendSwatch tone="warning" label="Elevated" />
      <LegendSwatch tone="risk" label="High" />
      <span aria-hidden className="text-text-disabled">
        ·
      </span>
      <span className="text-text-muted">Bubble size · business impact</span>
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

// ---------------------------------------------------------------------------
// Adapter — maps a persisted Opportunity into the exhibit's narrow point
// shape. Pure function, exported so the future report-wiring sprint can
// import it without leaking @visx into the report code path.
// ---------------------------------------------------------------------------

export function opportunityToRiskQuadrantPoint(
  opp: Opportunity,
): RiskAdjustedQuadrantPoint {
  return {
    id: opp.id,
    title: opp.title,
    impact: opp.businessImpactScore,
    complexity: opp.complexityScore,
    risk: opp.riskScore,
  };
}

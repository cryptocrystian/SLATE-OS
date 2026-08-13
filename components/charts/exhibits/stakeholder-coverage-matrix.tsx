import * as React from "react";
import { Group } from "@visx/group";
import { Text } from "@visx/text";
import { ChartFrame } from "@/components/charts/primitives/chart-frame";
import { ChartHeatmapCell } from "@/components/charts/primitives/chart-heatmap-cell";
import {
  CHART_FONT_SANS,
  CHART_TONE_VAR,
  type ChartTone,
  type SourceNote,
} from "@/lib/charts/types";

/**
 * Stakeholder Coverage Matrix — Phase 1B Exhibit Sprint 3.
 *
 * Role × topic heatmap that surfaces evidence coverage gaps in stakeholder
 * intake. Cell color encodes evidence strength (`missing → neutral`,
 * `thin → warning`, `adequate → info`, `strong → success`); cell label
 * shows the supporting `responseCount` for present cells and an em-dash
 * for missing cells. Missing cells render at very low fill opacity with a
 * subtle stroke so they are visibly absent — distinct from a low-strength
 * cell that has actual evidence.
 *
 * Pure server component. Composes `ChartFrame` and the existing
 * `ChartHeatmapCell` primitive from Sprint 2 — **no new primitive**, no
 * `@visx/heatmap`, no package dependency changes. The cell primitive is
 * unchanged.
 */

export type StakeholderEvidenceStrength =
  | "missing"
  | "thin"
  | "adequate"
  | "strong";

export interface StakeholderCoverageCell {
  role: string;
  topic: string;
  strength: StakeholderEvidenceStrength;
  /**
   * Number of supporting stakeholder responses for this role × topic
   * intersection. `0` is expected for `strength: "missing"` cells. The
   * value is rendered as the cell label for present cells and routed
   * into the cell's `<title>` for a11y / hover discoverability.
   */
  responseCount: number;
}

export interface StakeholderCoverageMatrixProps {
  cells: StakeholderCoverageCell[];
  /** Row order, top to bottom. */
  roles: string[];
  /** Column order, left to right. */
  topics: string[];
  /** Required source attribution. */
  sourceNote: SourceNote;
  /** Bare mode: chart + legend only, for deliverable embedding. */
  bare?: boolean;
  /** Optional consultant takeaway. Defaults to a derived one-line summary. */
  takeaway?: string;
}

// Logical SVG canvas. Matches other Phase 1B exhibits.
const WIDTH = 880;
const HEIGHT = 540;

// Margins — left is generous to fit the longest stakeholder role label.
const MATRIX_MARGINS = {
  top: 56,
  right: 16,
  bottom: 24,
  left: 196,
};

const CELL_GUTTER = 3;

const STRENGTH_TONE: Record<StakeholderEvidenceStrength, ChartTone> = {
  missing: "neutral",
  thin: "warning",
  adequate: "info",
  strong: "success",
};

const STRENGTH_LABEL: Record<StakeholderEvidenceStrength, string> = {
  missing: "Missing",
  thin: "Thin",
  adequate: "Adequate",
  strong: "Strong",
};

const STRENGTH_ORDER: StakeholderEvidenceStrength[] = [
  "missing",
  "thin",
  "adequate",
  "strong",
];

function deriveTakeaway(cells: StakeholderCoverageCell[]): string {
  if (cells.length === 0) {
    return "No coverage scoring yet. Capture stakeholder intake to populate the diagnostic view.";
  }
  let presentStrong = 0;
  let missing = 0;
  for (const c of cells) {
    if (c.strength === "adequate" || c.strength === "strong") presentStrong += 1;
    if (c.strength === "missing") missing += 1;
  }
  return `${presentStrong} of ${cells.length} role-topic intersections have adequate or strong coverage; ${missing} remain unfilled.`;
}

export function StakeholderCoverageMatrix({
  cells,
  roles,
  topics,
  sourceNote,
  takeaway,
  bare = false,
}: StakeholderCoverageMatrixProps) {
  const resolvedTakeaway = takeaway ?? deriveTakeaway(cells);

  // Lookup keyed by role+topic — the grid is driven by roles/topics arrays.
  const lookup = new Map<string, StakeholderCoverageCell>();
  for (const c of cells) lookup.set(`${c.role}|${c.topic}`, c);

  return (
    <ChartFrame
      width={WIDTH}
      height={HEIGHT}
      eyebrow="Stakeholder Coverage Matrix"
      title="Role × topic intake coverage"
      takeaway={resolvedTakeaway}
      legend={<Legend />}
      sourceNote={sourceNote}
      bare={bare}
      margins={MATRIX_MARGINS}
    >
      {(innerWidth, innerHeight) => {
        if (roles.length === 0 || topics.length === 0) return null;
        const cellWidth = innerWidth / topics.length;
        const cellHeight = innerHeight / roles.length;
        return (
          <Group>
            {/* Column labels */}
            {topics.map((topic, ci) => (
              <Text
                key={`col-${ci}`}
                x={ci * cellWidth + cellWidth / 2}
                y={-14}
                width={cellWidth - 8}
                fontFamily={CHART_FONT_SANS}
                fontSize={11}
                fontWeight={500}
                fill="var(--color-text-secondary)"
                textAnchor="middle"
                verticalAnchor="end"
              >
                {topic}
              </Text>
            ))}

            {/* Row labels */}
            {roles.map((role, ri) => (
              <Text
                key={`row-${ri}`}
                x={-14}
                y={ri * cellHeight + cellHeight / 2}
                width={MATRIX_MARGINS.left - 24}
                fontFamily={CHART_FONT_SANS}
                fontSize={11}
                fontWeight={500}
                fill="var(--color-text-secondary)"
                textAnchor="end"
                verticalAnchor="middle"
              >
                {role}
              </Text>
            ))}

            {/* Cells */}
            {roles.map((role, ri) =>
              topics.map((topic, ci) => {
                const cell = lookup.get(`${role}|${topic}`);
                if (!cell) return null;
                const cx = ci * cellWidth + CELL_GUTTER / 2;
                const cy = ri * cellHeight + CELL_GUTTER / 2;
                const cw = cellWidth - CELL_GUTTER;
                const ch = cellHeight - CELL_GUTTER;
                const tone = STRENGTH_TONE[cell.strength];
                const fill = CHART_TONE_VAR[tone];
                const isMissing = cell.strength === "missing";
                const responsesLabel =
                  cell.responseCount === 1 ? "response" : "responses";
                const titleText = `${role} · ${topic}: ${STRENGTH_LABEL[cell.strength]}. ${cell.responseCount} ${responsesLabel}.`;
                // "Missing" cells are intentionally recessive — low fill
                // opacity, subtle stroke, dimmer label color, em-dash glyph
                // — so they read as a coverage gap, not as low evidence.
                return (
                  <ChartHeatmapCell
                    key={`${ri}-${ci}`}
                    x={cx}
                    y={cy}
                    width={cw}
                    height={ch}
                    fill={fill}
                    fillOpacity={isMissing ? 0.05 : 0.18}
                    stroke={
                      isMissing ? "var(--color-border-strong)" : fill
                    }
                    strokeWidth={1}
                    label={isMissing ? "—" : cell.responseCount}
                    labelColor={
                      isMissing
                        ? "var(--color-text-muted)"
                        : "var(--color-text-primary)"
                    }
                    title={titleText}
                  />
                );
              }),
            )}
          </Group>
        );
      }}
    </ChartFrame>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-text-muted">
      <span className="font-mono uppercase tracking-[0.14em] text-text-muted">
        Coverage
      </span>
      {STRENGTH_ORDER.map((s) => (
        <LegendSwatch key={s} tone={STRENGTH_TONE[s]} label={STRENGTH_LABEL[s]} />
      ))}
      <span aria-hidden className="text-text-disabled">
        ·
      </span>
      <span className="text-text-muted">
        Cell value · supporting response count (&mdash; = missing)
      </span>
    </div>
  );
}

function LegendSwatch({ tone, label }: { tone: ChartTone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        // Square swatch matches the heatmap-cell visual for the rest of
        // the SLATE chart vocabulary.
        className="inline-block h-2 w-2 rounded-sm"
        style={{ backgroundColor: CHART_TONE_VAR[tone] }}
      />
      {label}
    </span>
  );
}

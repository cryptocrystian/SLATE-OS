import * as React from "react";
import { Group } from "@visx/group";
import { Text } from "@visx/text";
import { ChartFrame } from "@/components/charts/primitives/chart-frame";
import { ChartHeatmapCell } from "@/components/charts/primitives/chart-heatmap-cell";
import {
  CHART_FONT_MONO,
  CHART_TONE_VAR,
  type ChartTone,
  type SourceNote,
} from "@/lib/charts/types";

/**
 * Capability Maturity Heatmap — Phase 1B Exhibit Sprint 2.
 *
 * Capability × dimension grid. Cell color encodes a 4-band maturity scale
 * (`risk` → `warning` → `info` → `success`) deterministically derived from
 * `maturityScore` (0–100). Cell label is the score itself in tabular mono
 * numerals. Row + column labels render in `JetBrains Mono` uppercase
 * tracking-1.4 — same micro-typography as every other SLATE exhibit.
 *
 * Pure server component. SVG only. Composes `ChartFrame` and the new
 * `ChartHeatmapCell` primitive. The primitive is reusable for the
 * Stakeholder Coverage Matrix in a later sprint — a deliberate choice
 * documented in the canon (`docs/13_PHASE_1B_CHART_EXHIBIT_CANON.md`).
 *
 * No `@visx/heatmap` dependency — the cell primitive is built from
 * plain SVG `rect` + `text` to keep the package footprint minimal.
 */

export interface CapabilityMaturityCell {
  capability: string;
  dimension: string;
  /** Maturity score, 0–100. */
  maturityScore: number;
  /** Number of approved/report-ready findings backing this cell. */
  supportingFindingCount: number;
}

export interface CapabilityMaturityHeatmapProps {
  cells: CapabilityMaturityCell[];
  /** Row order, top to bottom. Drives the grid; cells outside this set are ignored. */
  capabilities: string[];
  /** Column order, left to right. Drives the grid; cells outside this set are ignored. */
  dimensions: string[];
  /** Required source attribution. */
  sourceNote: SourceNote;
  /** Optional consultant takeaway. Defaults to a derived one-line summary. */
  takeaway?: string;
}

// Logical SVG canvas (viewBox). Matches other Phase 1B exhibits.
const WIDTH = 880;
const HEIGHT = 540;

// Margins inside the SVG. Left margin is generous to fit row labels;
// top margin reserves space for column labels. Bottom/right are tight.
const HEATMAP_MARGINS = {
  top: 56,
  right: 16,
  bottom: 24,
  left: 196,
};

// Visual gutter between adjacent cells (in SVG units). Small but visible.
const CELL_GUTTER = 3;

// Maturity band thresholds.
//   0–39  → risk    "Needs foundation"
//   40–59 → warning "Developing"
//   60–79 → info    "Functional"
//   80+   → success "Mature"
const BAND = {
  developing: 40,
  functional: 60,
  mature: 80,
} as const;

function maturityTone(score: number): ChartTone {
  if (score < BAND.developing) return "risk";
  if (score < BAND.functional) return "warning";
  if (score < BAND.mature) return "info";
  return "success";
}

function maturityBandLabel(
  score: number,
): "Needs foundation" | "Developing" | "Functional" | "Mature" {
  if (score < BAND.developing) return "Needs foundation";
  if (score < BAND.functional) return "Developing";
  if (score < BAND.mature) return "Functional";
  return "Mature";
}

function deriveTakeaway(cells: CapabilityMaturityCell[]): string {
  if (cells.length === 0) {
    return "No maturity scoring yet. Score capabilities to populate the diagnostic view.";
  }
  let mature = 0;
  let risk = 0;
  for (const c of cells) {
    if (c.maturityScore >= BAND.mature) mature += 1;
    if (c.maturityScore < BAND.developing) risk += 1;
  }
  return `${mature} of ${cells.length} cells reach Mature; ${risk} sit below the foundation threshold.`;
}

export function CapabilityMaturityHeatmap({
  cells,
  capabilities,
  dimensions,
  sourceNote,
  takeaway,
}: CapabilityMaturityHeatmapProps) {
  const resolvedTakeaway = takeaway ?? deriveTakeaway(cells);

  // Lookup keyed by capability+dimension so cell ordering is independent
  // of input array order — the grid is driven by the row/column arrays.
  const lookup = new Map<string, CapabilityMaturityCell>();
  for (const c of cells) lookup.set(`${c.capability}|${c.dimension}`, c);

  return (
    <ChartFrame
      width={WIDTH}
      height={HEIGHT}
      eyebrow="Capability Maturity Heatmap"
      title="Capability × dimension maturity"
      takeaway={resolvedTakeaway}
      legend={<Legend />}
      sourceNote={sourceNote}
      margins={HEATMAP_MARGINS}
    >
      {(innerWidth, innerHeight) => {
        if (capabilities.length === 0 || dimensions.length === 0) {
          return null;
        }
        const cellWidth = innerWidth / dimensions.length;
        const cellHeight = innerHeight / capabilities.length;
        return (
          <Group>
            {/* Column labels — sit just above the inner grid */}
            {dimensions.map((dim, ci) => {
              const x = ci * cellWidth + cellWidth / 2;
              return (
                <Text
                  key={`col-${ci}`}
                  x={x}
                  y={-14}
                  fontFamily={CHART_FONT_MONO}
                  fontSize={10}
                  letterSpacing={1.4}
                  fill="var(--color-text-muted)"
                  textAnchor="middle"
                  verticalAnchor="end"
                >
                  {dim.toUpperCase()}
                </Text>
              );
            })}

            {/* Row labels — sit just to the left of the inner grid */}
            {capabilities.map((cap, ri) => {
              const y = ri * cellHeight + cellHeight / 2;
              return (
                <Text
                  key={`row-${ri}`}
                  x={-14}
                  y={y}
                  fontFamily={CHART_FONT_MONO}
                  fontSize={10}
                  letterSpacing={1.4}
                  fill="var(--color-text-muted)"
                  textAnchor="end"
                  verticalAnchor="middle"
                >
                  {cap.toUpperCase()}
                </Text>
              );
            })}

            {/* Cells */}
            {capabilities.map((cap, ri) =>
              dimensions.map((dim, ci) => {
                const cell = lookup.get(`${cap}|${dim}`);
                if (!cell) return null;
                const cx = ci * cellWidth + CELL_GUTTER / 2;
                const cy = ri * cellHeight + CELL_GUTTER / 2;
                const cw = cellWidth - CELL_GUTTER;
                const ch = cellHeight - CELL_GUTTER;
                const tone = maturityTone(cell.maturityScore);
                const fill = CHART_TONE_VAR[tone];
                const band = maturityBandLabel(cell.maturityScore);
                const findingsLabel =
                  cell.supportingFindingCount === 1 ? "finding" : "findings";
                const title = `${cap} · ${dim}: ${cell.maturityScore} (${band}). ${cell.supportingFindingCount} supporting ${findingsLabel}.`;
                return (
                  <ChartHeatmapCell
                    key={`${ri}-${ci}`}
                    x={cx}
                    y={cy}
                    width={cw}
                    height={ch}
                    fill={fill}
                    label={cell.maturityScore}
                    labelColor="var(--color-text-primary)"
                    title={title}
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
        Maturity
      </span>
      <LegendSwatch tone="risk" label="Needs foundation" />
      <LegendSwatch tone="warning" label="Developing" />
      <LegendSwatch tone="info" label="Functional" />
      <LegendSwatch tone="success" label="Mature" />
      <span aria-hidden className="text-text-disabled">
        ·
      </span>
      <span className="text-text-muted">
        Cell value · maturity score (0&ndash;100)
      </span>
    </div>
  );
}

function LegendSwatch({ tone, label }: { tone: ChartTone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        // Square swatch (rounded-sm) so the legend reads as a heatmap key
        // rather than a scatter-plot key.
        className="inline-block h-2 w-2 rounded-sm"
        style={{ backgroundColor: CHART_TONE_VAR[tone] }}
      />
      {label}
    </span>
  );
}

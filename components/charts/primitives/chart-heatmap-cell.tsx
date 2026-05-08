import * as React from "react";
import {
  CHART_DATA_LABEL,
  CHART_FONT_MONO,
} from "@/lib/charts/types";

/**
 * Single SVG heatmap cell — primitive for grid-based exhibits
 * (Capability Maturity Heatmap, future Stakeholder Coverage Matrix).
 *
 * Plain `<g><rect/><text/></g>` — no `@visx/heatmap`. Tone color flows
 * through the consumer (typically a `var(--color-status-*)` lookup from
 * `lib/charts/types.ts`'s `CHART_TONE_VAR`), so cells inherit SLATE
 * theme tokens directly with no JS-side palette switching.
 *
 * Pure server component. SVG only. No hooks, no animation.
 */

export interface ChartHeatmapCellProps {
  /** Top-left x in SVG units (relative to the parent group). */
  x: number;
  /** Top-left y in SVG units (relative to the parent group). */
  y: number;
  /** Cell width in SVG units. */
  width: number;
  /** Cell height in SVG units. */
  height: number;
  /** Fill color. Typically `CHART_TONE_VAR[tone]` resolving to a CSS var. */
  fill: string;
  /** Fill opacity, 0–1. Defaults to 0.18 to match SLATE bubble treatment. */
  fillOpacity?: number;
  /** Stroke color. Defaults to the same value as `fill`. */
  stroke?: string;
  /** Stroke width. Defaults to 1. */
  strokeWidth?: number;
  /** Corner radius for the cell rect. Defaults to 2. */
  rx?: number;
  /**
   * Optional numeric or short-string label rendered centered inside the cell
   * (e.g. the maturity score `72`). Use a short value — long labels do not
   * wrap. Pass `null`/`undefined` to render an unlabeled cell.
   */
  label?: string | number | null;
  /** Color of the label. Defaults to `--color-text-secondary`. */
  labelColor?: string;
  /** Font size (px) of the label. Defaults to 13. */
  labelFontSize?: number;
  /**
   * Optional `<title>` text — used for screen-reader access AND for the
   * native browser tooltip on hover. The exhibit's headline is still
   * understandable WITHOUT this, per the canon's "no hover-required
   * behavior" rule; `<title>` is enhancement only.
   */
  title?: string;
}

export function ChartHeatmapCell({
  x,
  y,
  width,
  height,
  fill,
  fillOpacity = 0.18,
  stroke,
  strokeWidth = 1,
  rx = 2,
  label,
  labelColor = CHART_DATA_LABEL,
  labelFontSize = 13,
  title,
}: ChartHeatmapCellProps) {
  const strokeFinal = stroke ?? fill;
  const labelText =
    label === null || label === undefined || label === "" ? null : String(label);
  return (
    <g>
      {title ? <title>{title}</title> : null}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={strokeFinal}
        strokeWidth={strokeWidth}
        rx={rx}
      />
      {labelText !== null ? (
        <text
          x={x + width / 2}
          y={y + height / 2}
          fontFamily={CHART_FONT_MONO}
          fontSize={labelFontSize}
          fontWeight={600}
          fill={labelColor}
          textAnchor="middle"
          dominantBaseline="central"
          // Tabular numerals so adjacent cell labels line up cleanly when
          // glanced across rows or columns.
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {labelText}
        </text>
      ) : null}
    </g>
  );
}

import * as React from "react";
import {
  CHART_DATA_LABEL,
  CHART_FONT_SANS,
} from "@/lib/charts/types";

/**
 * Single SVG Gantt bar — primitive for time-series bar exhibits
 * (Roadmap Gantt with Dependencies; future per-phase milestone strips).
 *
 * Plain `<g><rect/><text/></g>` — no `@visx/*` imports inside the
 * primitive itself. Tone color flows through the consumer (typically a
 * `var(--color-status-*)` lookup from `lib/charts/types.ts`'s
 * `CHART_TONE_VAR`) so bars inherit SLATE theme tokens directly.
 *
 * Pure server component. SVG only. No hooks, no animation, no interactivity.
 *
 * The primitive contains ZERO roadmap-specific logic; it is generic
 * enough to back any horizontal-bar exhibit without modification.
 */

export interface ChartGanttBarProps {
  /** Top-left x in SVG units (relative to the parent group). */
  x: number;
  /** Top-left y in SVG units. */
  y: number;
  /** Bar width in SVG units. */
  width: number;
  /** Bar height in SVG units. */
  height: number;
  /** Fill color. Typically `CHART_TONE_VAR[tone]`. */
  fill: string;
  /** Fill opacity, 0–1. Defaults to 0.22 — slightly stronger than heatmap cells so bars read as "active" objects rather than "background fill." */
  fillOpacity?: number;
  /** Stroke color. Defaults to the same value as `fill`. */
  stroke?: string;
  /** Stroke width. Defaults to 1. */
  strokeWidth?: number;
  /** Corner radius. Defaults to 3. */
  rx?: number;
  /**
   * Optional bar label. When provided the primitive auto-decides whether
   * to render the label inside the bar (when there is room) or outside
   * to the right (for narrow bars). Override via `labelPlacement`.
   */
  label?: string | number | null;
  labelColor?: string;
  labelFontSize?: number;
  labelPlacement?: "auto" | "inside" | "outside" | "none";
  /**
   * If true, the bar is rendered at a reduced overall opacity so it
   * reads as "complete / inactive / paused." Useful for a roadmap item
   * whose work is done but whose entry should still appear on the
   * timeline for narrative continuity.
   */
  muted?: boolean;
  /** Optional `<title>` for screen-reader and hover discoverability. */
  title?: string;
}

const DEFAULT_FILL_OPACITY = 0.22;
const MUTED_OPACITY_MULTIPLIER = 0.45;
const INSIDE_LABEL_MIN_WIDTH = 90;
const INSIDE_LABEL_PAD = 8;

export function ChartGanttBar({
  x,
  y,
  width,
  height,
  fill,
  fillOpacity = DEFAULT_FILL_OPACITY,
  stroke,
  strokeWidth = 1,
  rx = 3,
  label,
  labelColor = CHART_DATA_LABEL,
  labelFontSize = 11,
  labelPlacement = "auto",
  muted = false,
  title,
}: ChartGanttBarProps) {
  const strokeFinal = stroke ?? fill;
  const effectiveFillOpacity = muted
    ? fillOpacity * MUTED_OPACITY_MULTIPLIER
    : fillOpacity;
  const effectiveStrokeOpacity = muted ? MUTED_OPACITY_MULTIPLIER : 1;
  const effectiveLabelOpacity = muted ? 0.7 : 1;

  const hasLabel =
    labelPlacement !== "none" &&
    label !== null &&
    label !== undefined &&
    label !== "";
  const placement: "inside" | "outside" | "none" =
    !hasLabel
      ? "none"
      : labelPlacement === "inside"
        ? "inside"
        : labelPlacement === "outside"
          ? "outside"
          : width >= INSIDE_LABEL_MIN_WIDTH
            ? "inside"
            : "outside";

  let labelX = 0;
  let labelAnchor: "start" | "middle" | "end" = "start";
  if (placement === "inside") {
    labelX = x + INSIDE_LABEL_PAD;
    labelAnchor = "start";
  } else if (placement === "outside") {
    labelX = x + width + INSIDE_LABEL_PAD;
    labelAnchor = "start";
  }

  return (
    <g>
      {title ? <title>{title}</title> : null}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        fill={fill}
        fillOpacity={effectiveFillOpacity}
        stroke={strokeFinal}
        strokeWidth={strokeWidth}
        strokeOpacity={effectiveStrokeOpacity}
        rx={rx}
      />
      {placement !== "none" ? (
        <text
          x={labelX}
          y={y + height / 2}
          fontFamily={CHART_FONT_SANS}
          fontSize={labelFontSize}
          fill={labelColor}
          fillOpacity={effectiveLabelOpacity}
          textAnchor={labelAnchor}
          dominantBaseline="central"
        >
          {String(label)}
        </text>
      ) : null}
    </g>
  );
}

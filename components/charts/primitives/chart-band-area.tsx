import * as React from "react";

/**
 * Closed-area band primitive — generic SVG `<path>` that fills the
 * region between an upper polyline and a lower polyline.
 *
 * The primitive traces `upperPoints` left-to-right, then `lowerPoints`
 * right-to-left, and closes with `Z`. Both arrays must contain at
 * least two points and should share the same x-coordinates so the
 * resulting band reads as a single closed shape.
 *
 * Plain `<g><path/></g>` — no `@visx/*` imports inside the primitive.
 * Color flows through the consumer via `fill` (typically a SLATE
 * `var(--color-*)` token), so bands inherit theme tokens directly.
 *
 * Pure server component. SVG only. No hooks, no animation.
 *
 * **Zero domain-specific wording inside the primitive** — no
 * "uncertainty", "confidence", "ROI", "forecast", or financial
 * language. The primitive is a generic filled band that any future
 * sensitivity / range / envelope exhibit may use without modification.
 */

export interface ChartBandAreaPoint {
  x: number;
  y: number;
}

export interface ChartBandAreaProps {
  /** Upper boundary of the band, traced left-to-right. Need at least 2 points. */
  upperPoints: ChartBandAreaPoint[];
  /** Lower boundary of the band, traced right-to-left. Need at least 2 points. */
  lowerPoints: ChartBandAreaPoint[];
  /** Fill color. Default `--color-status-info`. */
  fill?: string;
  /** Fill opacity 0–1. Default 0.18. */
  fillOpacity?: number;
  /** Optional stroke color. Default no stroke. */
  stroke?: string;
  /** Stroke width when `stroke` is set. Default 1. */
  strokeWidth?: number;
  /** Stroke opacity 0–1 when `stroke` is set. Default 0.5. */
  strokeOpacity?: number;
  /** Optional `<title>` for screen-reader and hover discoverability. */
  title?: string;
}

const DEFAULT_FILL = "var(--color-status-info)";
const DEFAULT_FILL_OPACITY = 0.18;
const DEFAULT_STROKE_WIDTH = 1;
const DEFAULT_STROKE_OPACITY = 0.5;

export function ChartBandArea({
  upperPoints,
  lowerPoints,
  fill = DEFAULT_FILL,
  fillOpacity = DEFAULT_FILL_OPACITY,
  stroke,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  strokeOpacity = DEFAULT_STROKE_OPACITY,
  title,
}: ChartBandAreaProps) {
  if (upperPoints.length < 2 || lowerPoints.length < 2) return null;

  const upperPath = upperPoints
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");
  const lowerPath = [...lowerPoints]
    .reverse()
    .map((p) => `L ${p.x} ${p.y}`)
    .join(" ");
  const d = `${upperPath} ${lowerPath} Z`;

  return (
    <g>
      {title ? <title>{title}</title> : null}
      <path
        d={d}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={stroke ?? "none"}
        strokeWidth={stroke ? strokeWidth : 0}
        strokeOpacity={stroke ? strokeOpacity : 0}
        strokeLinejoin="round"
      />
    </g>
  );
}

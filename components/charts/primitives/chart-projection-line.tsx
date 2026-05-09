import * as React from "react";

/**
 * Polyline-with-markers primitive — generic SVG line connecting a series
 * of pre-computed points, optionally with marker dots at each point.
 *
 * Plain `<g><path/><circle.../></g>` — no `@visx/*` imports inside the
 * primitive. Color flows through the consumer (typically a
 * `var(--color-status-*)` or `var(--color-brand-primary)` lookup) so
 * lines inherit SLATE theme tokens directly.
 *
 * Pure server component. SVG only. No hooks, no animation.
 *
 * **Zero domain-specific wording inside the primitive** — no "ROI",
 * "trend", "forecast", or financial language. The primitive is a
 * generic polyline that any future trend / projection / time-series
 * exhibit may use without modification.
 */

export interface ChartProjectionLinePoint {
  x: number;
  y: number;
}

export interface ChartProjectionLineProps {
  /** Series of pre-computed SVG points to connect. Need at least 2 points to render a path. */
  points: ChartProjectionLinePoint[];
  /** Stroke color. Default `--color-status-info`. */
  stroke?: string;
  /** Stroke width. Default 1.75. */
  strokeWidth?: number;
  /** Stroke opacity 0–1. Default 0.9. */
  strokeOpacity?: number;
  /** Optional dashed pattern, e.g. `"4 3"`. Default solid. */
  strokeDasharray?: string;
  /**
   * Render at reduced overall opacity. Useful when the consumer wants
   * the line to recede visually while still appearing on the timeline
   * (e.g., a baseline trend that should not compete with a newer line).
   */
  muted?: boolean;
  /**
   * Show small filled circles at each point. Useful for emphasizing
   * specific data points (e.g., one marker per period in a Y1/Y2/Y3
   * projection). Defaults to `true`; pass `false` to render an
   * unmarked line.
   */
  markers?: boolean;
  /** Marker fill color. Defaults to the line's `stroke`. */
  markerFill?: string;
  /**
   * Marker outline / "halo" color so the marker visibly separates from
   * a colored band rendered behind it. Default `--color-bg-surface`.
   */
  markerStroke?: string;
  /** Marker radius in SVG units. Default 4. */
  markerRadius?: number;
  /** Optional `<title>` for screen-reader and hover discoverability. */
  title?: string;
}

const DEFAULT_STROKE = "var(--color-status-info)";
const DEFAULT_STROKE_WIDTH = 1.75;
const DEFAULT_STROKE_OPACITY = 0.9;
const DEFAULT_MARKER_RADIUS = 4;
const MUTED_OPACITY_FACTOR = 0.45;

export function ChartProjectionLine({
  points,
  stroke = DEFAULT_STROKE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  strokeOpacity = DEFAULT_STROKE_OPACITY,
  strokeDasharray,
  muted = false,
  markers = true,
  markerFill,
  markerStroke = "var(--color-bg-surface)",
  markerRadius = DEFAULT_MARKER_RADIUS,
  title,
}: ChartProjectionLineProps) {
  if (points.length < 2) return null;

  const mutedFactor = muted ? MUTED_OPACITY_FACTOR : 1;
  const effectiveStrokeOpacity = strokeOpacity * mutedFactor;
  const effectiveMarkerOpacity = mutedFactor;
  const resolvedMarkerFill = markerFill ?? stroke;

  const d = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  return (
    <g>
      {title ? <title>{title}</title> : null}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeOpacity={effectiveStrokeOpacity}
        strokeDasharray={strokeDasharray}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {markers
        ? points.map((p, i) => (
            <circle
              key={`marker-${i}`}
              cx={p.x}
              cy={p.y}
              r={markerRadius}
              fill={resolvedMarkerFill}
              fillOpacity={effectiveMarkerOpacity}
              stroke={markerStroke}
              strokeWidth={1.5}
            />
          ))
        : null}
    </g>
  );
}

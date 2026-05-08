import * as React from "react";

/**
 * Dependency-arrow primitive — generic right-angle SVG connector for
 * Gantt-style exhibits and any other "A → B" relationship visualization.
 *
 * Renders a 3-segment right-angle path:
 *   M startX,startY  H startX+stub  V endY  L endX,endY
 *
 * The arrowhead is drawn via SVG `<marker>`. The exhibit defines the
 * marker once in `<defs>` and passes its `markerId` to each arrow.
 * Centralizing the marker definition keeps `<defs>` clean and avoids
 * id-collision warnings when many arrows share the same arrowhead.
 *
 * Pure server component. No `@visx/*` imports inside the primitive.
 *
 * The primitive contains ZERO domain-specific logic; it is generic
 * enough to back any "A → B" connector without modification.
 */

export interface ChartDependencyArrowProps {
  /** Source endpoint x (typically the right edge of the source bar). */
  startX: number;
  /** Source endpoint y. */
  startY: number;
  /** Target endpoint x (typically the left edge of the target bar). */
  endX: number;
  /** Target endpoint y. */
  endY: number;
  /**
   * ID of the SVG `<marker>` (defined once in `<defs>` by the exhibit)
   * referenced via `marker-end`. Pass `undefined` for an arrowless line.
   */
  markerId?: string;
  /** Stroke color. Defaults to `--color-border-strong`. */
  stroke?: string;
  /** Stroke width. Defaults to 1.25. */
  strokeWidth?: number;
  /** Optional dashed pattern, e.g. `"3 3"`. Defaults to solid. */
  strokeDasharray?: string;
  /** Stroke opacity, 0–1. Defaults to 0.7 — visible but recessive. */
  strokeOpacity?: number;
  /**
   * Horizontal stub before the vertical drop. Defaults to 8 SVG units.
   * Forward-in-time dependencies look correct with this default.
   */
  stub?: number;
  /** Optional `<title>` for screen-reader and hover discoverability. */
  title?: string;
}

// `--color-text-muted` reads as visible-but-recessive against the SLATE
// dark surface. `--color-border-strong` (the heatmap-grid default) is
// too faint when used as a connector line.
const DEFAULT_STROKE = "var(--color-text-muted)";
const DEFAULT_STROKE_WIDTH = 1.5;
const DEFAULT_STROKE_OPACITY = 0.85;
const DEFAULT_STUB = 8;

export function ChartDependencyArrow({
  startX,
  startY,
  endX,
  endY,
  markerId,
  stroke = DEFAULT_STROKE,
  strokeWidth = DEFAULT_STROKE_WIDTH,
  strokeDasharray,
  strokeOpacity = DEFAULT_STROKE_OPACITY,
  stub = DEFAULT_STUB,
  title,
}: ChartDependencyArrowProps) {
  const bend = startX + stub;
  // Right-angle path:
  //   move to (startX, startY)
  //   horizontal to (bend, startY)
  //   vertical to (bend, endY)
  //   line to (endX, endY)
  // Backward dependencies (where endX < bend) are still drawn but the
  // last segment runs leftward; an honest visual that we accept rather
  // than re-route around.
  const d = `M ${startX} ${startY} H ${bend} V ${endY} L ${endX} ${endY}`;
  return (
    <g>
      {title ? <title>{title}</title> : null}
      <path
        d={d}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeOpacity={strokeOpacity}
        strokeDasharray={strokeDasharray}
        markerEnd={markerId ? `url(#${markerId})` : undefined}
      />
    </g>
  );
}

/**
 * Convenience helper: SVG `<marker>` definition for the standard SLATE
 * arrowhead. Drop this once inside the exhibit's `<defs>` block and
 * reference its `id` from each `ChartDependencyArrow`.
 *
 *   <defs>
 *     <ChartDependencyArrowheadMarker id="slate-roadmap-arrowhead" />
 *   </defs>
 *
 * The arrowhead inherits `fill`/`opacity` from the prop set so the
 * exhibit can match it to its dependency-arrow stroke.
 */
export interface ChartDependencyArrowheadMarkerProps {
  id: string;
  /** Fill color of the arrowhead triangle. Defaults to `--color-border-strong`. */
  fill?: string;
  /** Opacity. Defaults to 0.7 to match the arrow stroke. */
  fillOpacity?: number;
}

export function ChartDependencyArrowheadMarker({
  id,
  fill = DEFAULT_STROKE,
  fillOpacity = DEFAULT_STROKE_OPACITY,
}: ChartDependencyArrowheadMarkerProps) {
  return (
    <marker
      id={id}
      viewBox="0 0 8 8"
      markerWidth={8}
      markerHeight={8}
      refX={7}
      refY={4}
      orient="auto"
      markerUnits="userSpaceOnUse"
    >
      <path
        d="M 0 0 L 8 4 L 0 8 Z"
        fill={fill}
        fillOpacity={fillOpacity}
      />
    </marker>
  );
}

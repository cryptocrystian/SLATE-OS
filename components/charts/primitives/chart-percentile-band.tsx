import * as React from "react";
import {
  CHART_FONT_MONO,
  CHART_TONE_VAR,
} from "@/lib/charts/types";

/**
 * Percentile-band primitive — one-row "value with percentile context"
 * visualization. Renders four scaffolded layers:
 *
 *   1. Background rail (full domain width, very faint)
 *   2. Inter-percentile-range (IQR) box from `p25X` → `p75X`
 *   3. Median line at `p50X`
 *   4. Client marker (filled diamond) at `clientX`
 *
 * The primitive is deliberately VALUE-AGNOSTIC: it accepts pre-computed
 * SVG x-positions, never raw domain values. The consumer handles all
 * value→pixel math. There is **zero benchmark-specific language inside
 * the primitive** so it remains reusable for any future "client value
 * within a contextual range" visualization.
 *
 * Pure server component. SVG only.
 */

export interface ChartPercentileBandProps {
  /** Top-left x of the band area in SVG units (left edge of the rail). */
  x: number;
  /** Top-left y of the band area in SVG units. */
  y: number;
  /** Total band width in SVG units (corresponds to the full domain — typically 0–100 → innerWidth). */
  width: number;
  /** Band area height in SVG units. */
  height: number;
  /** Pixel-space x position of the lower-quartile boundary (p25). */
  p25X: number;
  /** Pixel-space x position of the median (p50). */
  p50X: number;
  /** Pixel-space x position of the upper-quartile boundary (p75). */
  p75X: number;
  /** Pixel-space x position of the client marker. */
  clientX: number;
  /** Fill color for the IQR box. Default: status-info CSS var. */
  bandFill?: string;
  /** Fill opacity for the IQR box. Default: 0.18 (matches SLATE bubble treatment). */
  bandFillOpacity?: number;
  /** Stroke color for the median (p50) line. Default: status-info CSS var. */
  medianStroke?: string;
  /** Stroke opacity for the median line. Default: 0.7. */
  medianStrokeOpacity?: number;
  /** Stroke color for the background rail. Default: --color-border-strong. */
  railStroke?: string;
  /** Stroke opacity for the background rail. Default: 0.5. */
  railStrokeOpacity?: number;
  /** Fill color for the client marker (diamond). Default: --color-brand-primary. */
  clientMarkerFill?: string;
  /**
   * Stroke color for the client marker — used as a "halo" so the marker
   * visibly separates from the IQR box behind it. Default:
   * --color-bg-surface (matches the SLATE dark surface).
   */
  clientMarkerStroke?: string;
  /**
   * Optional short numeric label rendered just above the client marker.
   * Use sparingly — labels read as data, so over-labeling reads as noise.
   */
  clientLabel?: string | number | null;
  /** Optional `<title>` for screen-reader / hover discoverability. */
  title?: string;
}

const DEFAULT_BAND_FILL_OPACITY = 0.18;
const DEFAULT_MEDIAN_STROKE_OPACITY = 0.7;
const DEFAULT_RAIL_STROKE_OPACITY = 0.5;
const MARKER_SIZE_RATIO = 0.55;
const MARKER_SIZE_MAX = 12;
const MARKER_SIZE_MIN = 8;

export function ChartPercentileBand({
  x,
  y,
  width,
  height,
  p25X,
  p50X,
  p75X,
  clientX,
  bandFill = CHART_TONE_VAR.info,
  bandFillOpacity = DEFAULT_BAND_FILL_OPACITY,
  medianStroke = CHART_TONE_VAR.info,
  medianStrokeOpacity = DEFAULT_MEDIAN_STROKE_OPACITY,
  railStroke = "var(--color-border-strong)",
  railStrokeOpacity = DEFAULT_RAIL_STROKE_OPACITY,
  clientMarkerFill = CHART_TONE_VAR.brand,
  clientMarkerStroke = "var(--color-bg-surface)",
  clientLabel,
  title,
}: ChartPercentileBandProps) {
  const centerY = y + height / 2;
  // IQR box is centered vertically and a little shorter than the row so
  // the rail and median line read as outside scaffolding.
  const iqrTop = y + height * 0.3;
  const iqrHeight = Math.max(2, height * 0.4);
  // Median line is taller than the IQR box so it visually overshoots top
  // and bottom slightly — a McKinsey-style boxplot whisker affordance.
  const medianTop = y + height * 0.18;
  const medianBottom = y + height * 0.82;
  const markerSize = Math.max(
    MARKER_SIZE_MIN,
    Math.min(MARKER_SIZE_MAX, height * MARKER_SIZE_RATIO),
  );

  return (
    <g>
      {title ? <title>{title}</title> : null}
      {/* Background rail — spans the full domain. Communicates "this is
          a 0–100 axis, not a single point floating in space." */}
      <line
        x1={x}
        y1={centerY}
        x2={x + width}
        y2={centerY}
        stroke={railStroke}
        strokeOpacity={railStrokeOpacity}
        strokeWidth={1}
      />

      {/* IQR box (p25 → p75) — clamp to non-negative width so a degenerate
          input (p25 === p75) still renders something predictable rather
          than an SVG width="-2" warning. */}
      <rect
        x={Math.min(p25X, p75X)}
        y={iqrTop}
        width={Math.max(0, Math.abs(p75X - p25X))}
        height={iqrHeight}
        fill={bandFill}
        fillOpacity={bandFillOpacity}
        stroke={bandFill}
        strokeOpacity={Math.min(1, bandFillOpacity * 1.6)}
        strokeWidth={1}
        rx={2}
      />

      {/* Median line (p50) */}
      <line
        x1={p50X}
        y1={medianTop}
        x2={p50X}
        y2={medianBottom}
        stroke={medianStroke}
        strokeOpacity={medianStrokeOpacity}
        strokeWidth={1.5}
      />

      {/* Client marker — filled diamond, halo'd by a stroke matching
          the background surface so the marker visually "lifts" off the
          IQR box behind it. Highest z-order in this layer. */}
      <DiamondMarker
        cx={clientX}
        cy={centerY}
        size={markerSize}
        fill={clientMarkerFill}
        stroke={clientMarkerStroke}
      />

      {/* Optional numeric client label above the marker. */}
      {clientLabel !== null && clientLabel !== undefined && clientLabel !== ""
        ? (
          <text
            x={clientX}
            y={centerY - markerSize / 2 - 6}
            fontFamily={CHART_FONT_MONO}
            fontSize={10}
            fill="var(--color-text-primary)"
            textAnchor="middle"
            dominantBaseline="alphabetic"
            // Tabular numerals so client labels line up vertically across rows.
            style={{ fontVariantNumeric: "tabular-nums" }}
          >
            {String(clientLabel)}
          </text>
        )
        : null}
    </g>
  );
}

interface DiamondMarkerProps {
  cx: number;
  cy: number;
  size: number;
  fill: string;
  stroke: string;
}

function DiamondMarker({ cx, cy, size, fill, stroke }: DiamondMarkerProps) {
  const half = size / 2;
  // Rotated square: top, right, bottom, left vertices.
  const points = `${cx},${cy - half} ${cx + half},${cy} ${cx},${cy + half} ${cx - half},${cy}`;
  return (
    <polygon
      points={points}
      fill={fill}
      stroke={stroke}
      strokeWidth={1.5}
      strokeLinejoin="round"
    />
  );
}

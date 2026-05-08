import * as React from "react";
import { CHART_FONT_SANS } from "@/lib/charts/types";

/**
 * Single SVG waterfall bar — primitive for waterfall / bridge / step
 * exhibits (AI-Savings Waterfall today; future ROI Bridge or any
 * stepped-bar visualization).
 *
 * Plain `<g><rect/><text/></g>`. Tone color flows through the consumer
 * (typically a `var(--color-status-*)` lookup from `lib/charts/types.ts`'s
 * `CHART_TONE_VAR`) so bars inherit SLATE theme tokens directly.
 *
 * Pure server component. SVG only. No hooks, no animation, no interactivity.
 *
 * **Zero financial-specific logic inside the primitive** — no "savings",
 * "cost", or "ROI" wording. The primitive is a generic stepped-bar with
 * an optional value label and optional `modeled` / `muted` treatments
 * that the consuming exhibit interprets.
 */

export interface ChartWaterfallBarProps {
  /** Top-left x in SVG units (relative to the parent group). */
  x: number;
  /** Top-left y in SVG units. */
  y: number;
  /** Bar width in SVG units. */
  width: number;
  /** Bar height in SVG units. Always non-negative. */
  height: number;
  /** Fill color. Typically `CHART_TONE_VAR[tone]`. */
  fill: string;
  /** Fill opacity, 0–1. Default 0.22 (slightly stronger than heatmap cells so bars read as foreground objects). */
  fillOpacity?: number;
  /** Stroke color. Defaults to the same value as `fill`. */
  stroke?: string;
  /** Stroke width. Defaults to 1. */
  strokeWidth?: number;
  /** Corner radius. Defaults to 3. */
  rx?: number;
  /**
   * Render with reduced fill + dashed outline. Used by exhibits to
   * disclaim certainty on forecast / modeled / projected bars (e.g.
   * a final modeled-state bar in a Gate 0 illustrative waterfall).
   */
  modeled?: boolean;
  /**
   * Render at reduced overall opacity. Useful for completed / inactive
   * bars where the consumer wants the bar to recede visually while
   * still appearing on the timeline.
   */
  muted?: boolean;
  /**
   * Optional value label rendered just above the bar's top edge.
   * Use sparingly — labels read as data, so over-labeling reads as
   * noise. Format the value string at the call site (the primitive
   * never assumes "$" / "USD" / any currency).
   */
  valueLabel?: string | null;
  /** Color of the value label. Defaults to `--color-text-primary`. */
  valueLabelColor?: string;
  /** Font size of the value label. Defaults to 11. */
  valueLabelFontSize?: number;
  /** Optional `<title>` for screen-reader / hover discoverability. */
  title?: string;
}

const DEFAULT_FILL_OPACITY = 0.22;
const MODELED_FILL_OPACITY_FACTOR = 0.5;
const MUTED_OPACITY_FACTOR = 0.45;
const MODELED_STROKE_DASH = "4 3";

export function ChartWaterfallBar({
  x,
  y,
  width,
  height,
  fill,
  fillOpacity = DEFAULT_FILL_OPACITY,
  stroke,
  strokeWidth = 1,
  rx = 3,
  modeled = false,
  muted = false,
  valueLabel,
  valueLabelColor = "var(--color-text-primary)",
  valueLabelFontSize = 11,
  title,
}: ChartWaterfallBarProps) {
  const strokeFinal = stroke ?? fill;
  const mutedFactor = muted ? MUTED_OPACITY_FACTOR : 1;
  const effectiveFillOpacity =
    fillOpacity * (modeled ? MODELED_FILL_OPACITY_FACTOR : 1) * mutedFactor;
  const effectiveStrokeOpacity = mutedFactor;
  const effectiveLabelOpacity = muted ? 0.7 : 1;
  const safeHeight = Math.max(0, height);
  const hasValueLabel =
    valueLabel !== null && valueLabel !== undefined && valueLabel !== "";

  return (
    <g>
      {title ? <title>{title}</title> : null}
      <rect
        x={x}
        y={y}
        width={width}
        height={safeHeight}
        fill={fill}
        fillOpacity={effectiveFillOpacity}
        stroke={strokeFinal}
        strokeWidth={strokeWidth}
        strokeOpacity={effectiveStrokeOpacity}
        strokeDasharray={modeled ? MODELED_STROKE_DASH : undefined}
        rx={rx}
      />
      {hasValueLabel ? (
        <text
          x={x + width / 2}
          y={y - 6}
          fontFamily={CHART_FONT_SANS}
          fontSize={valueLabelFontSize}
          fontWeight={600}
          fill={valueLabelColor}
          fillOpacity={effectiveLabelOpacity}
          textAnchor="middle"
          dominantBaseline="alphabetic"
          // Tabular numerals so adjacent value labels line up cleanly.
          style={{ fontVariantNumeric: "tabular-nums" }}
        >
          {String(valueLabel)}
        </text>
      ) : null}
    </g>
  );
}

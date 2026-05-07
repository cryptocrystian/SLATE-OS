import * as React from "react";
import { AxisBottom, AxisLeft, type AxisScale } from "@visx/axis";
import {
  CHART_AXIS_LABEL,
  CHART_AXIS_STROKE,
  CHART_FONT_MONO,
  CHART_TICK_LABEL,
  CHART_TICK_STROKE,
} from "@/lib/charts/types";

const TICK_LABEL_PROPS_BOTTOM = {
  fontFamily: CHART_FONT_MONO,
  fontSize: 10,
  letterSpacing: 1.2,
  fill: CHART_TICK_LABEL,
  textAnchor: "middle" as const,
  dy: "0.25em",
};

const TICK_LABEL_PROPS_LEFT = {
  fontFamily: CHART_FONT_MONO,
  fontSize: 10,
  letterSpacing: 1.2,
  fill: CHART_TICK_LABEL,
  textAnchor: "end" as const,
  dx: "-0.25em",
  dy: "0.25em",
};

const AXIS_LABEL_PROPS_SHARED = {
  fontFamily: CHART_FONT_MONO,
  fontSize: 10,
  letterSpacing: 1.6,
  fill: CHART_AXIS_LABEL,
  // Visx axis label is positioned by the library; uppercase comes from the
  // string we pass in (CSS text-transform doesn't apply to <text> elements).
};

export interface ChartAxisBottomProps {
  scale: AxisScale<number>;
  /** Y position (typically `innerHeight`). */
  top: number;
  /** Axis title; will be rendered uppercased with optional trailing arrow. */
  label?: string;
  /** When true, render an arrow → after the label. */
  arrow?: boolean;
  numTicks?: number;
}

export function ChartAxisBottom({
  scale,
  top,
  label,
  arrow,
  numTicks = 5,
}: ChartAxisBottomProps) {
  const fullLabel = label
    ? `${label.toUpperCase()}${arrow ? "  →" : ""}`
    : undefined;
  return (
    <AxisBottom
      top={top}
      scale={scale}
      stroke={CHART_AXIS_STROKE}
      tickStroke={CHART_TICK_STROKE}
      tickLength={4}
      tickLabelProps={() => TICK_LABEL_PROPS_BOTTOM}
      label={fullLabel}
      labelOffset={20}
      labelProps={{
        ...AXIS_LABEL_PROPS_SHARED,
        textAnchor: "middle",
      }}
      numTicks={numTicks}
    />
  );
}

export interface ChartAxisLeftProps {
  scale: AxisScale<number>;
  label?: string;
  /** When true, render an arrow ↑ at the end of the label. */
  arrow?: boolean;
  numTicks?: number;
}

export function ChartAxisLeft({
  scale,
  label,
  arrow,
  numTicks = 5,
}: ChartAxisLeftProps) {
  const fullLabel = label
    ? `${label.toUpperCase()}${arrow ? "  ↑" : ""}`
    : undefined;
  return (
    <AxisLeft
      scale={scale}
      stroke={CHART_AXIS_STROKE}
      tickStroke={CHART_TICK_STROKE}
      tickLength={4}
      tickLabelProps={() => TICK_LABEL_PROPS_LEFT}
      label={fullLabel}
      labelOffset={36}
      labelProps={{
        ...AXIS_LABEL_PROPS_SHARED,
        textAnchor: "middle",
      }}
      numTicks={numTicks}
    />
  );
}

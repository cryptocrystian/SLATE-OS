import * as React from "react";
import { GridColumns, GridRows } from "@visx/grid";
import type { AxisScale } from "@visx/axis";
import { CHART_GRID_STROKE } from "@/lib/charts/types";

export interface ChartGridProps {
  xScale: AxisScale<number>;
  yScale: AxisScale<number>;
  width: number;
  height: number;
  numTicksX?: number;
  numTicksY?: number;
  /** SVG `stroke-dasharray` value. Default `"2 4"` is intentionally subtle. */
  dasharray?: string;
}

/**
 * Subtle grid lines using `--color-border-subtle`. Default dashed pattern
 * is intentionally minimal so the grid reads as scaffolding, not as data.
 */
export function ChartGrid({
  xScale,
  yScale,
  width,
  height,
  numTicksX = 5,
  numTicksY = 5,
  dasharray = "2 4",
}: ChartGridProps) {
  return (
    <g aria-hidden>
      <GridRows
        scale={yScale}
        width={width}
        stroke={CHART_GRID_STROKE}
        strokeDasharray={dasharray}
        numTicks={numTicksY}
      />
      <GridColumns
        scale={xScale}
        height={height}
        stroke={CHART_GRID_STROKE}
        strokeDasharray={dasharray}
        numTicks={numTicksX}
      />
    </g>
  );
}

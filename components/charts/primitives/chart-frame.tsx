import * as React from "react";
import { Card, CardBody } from "@/components/ui/card";
import {
  DEFAULT_CHART_MARGINS,
  type ChartMargins,
  type SourceNote,
} from "@/lib/charts/types";
import { ChartSourceNote } from "./chart-source-note";

export interface ChartFrameProps {
  /** Logical SVG width in pixels (the SVG viewBox; the rendered width is fluid). */
  width: number;
  /** Logical SVG height in pixels. */
  height: number;
  eyebrow: string;
  title: string;
  /** Optional one-line consultant takeaway shown above the SVG. */
  takeaway?: string;
  margins?: ChartMargins;
  /** Optional inline legend (rendered between header and SVG). */
  legend?: React.ReactNode;
  /** Required source attribution. */
  sourceNote: SourceNote;
  /**
   * Bare mode: render only the legend + SVG (no Card, no eyebrow/title/
   * takeaway header, no source-note footer). Used inside client deliverables
   * where the surrounding figure frame owns the caption, number, and source.
   */
  bare?: boolean;
  /**
   * Render-prop receives the inner plot dimensions (post-margin). Children
   * draw inside an SVG `<g>` translated to the top-left of the inner area.
   */
  children: (innerWidth: number, innerHeight: number) => React.ReactNode;
}

/**
 * Standard frame for every SLATE exhibit. Holds eyebrow / title / takeaway
 * formatting, the SVG canvas, the legend slot, and the source-note footer
 * uniformly so every chart reads as part of one design system.
 *
 * SSR-safe — pure server component. The SVG uses `viewBox` +
 * `preserveAspectRatio="xMidYMid meet"` and Tailwind's `w-full h-auto`, so
 * the chart scales to its container width while preserving its logical
 * aspect ratio. No `"use client"` boundary required.
 */
export function ChartFrame({
  width,
  height,
  eyebrow,
  title,
  takeaway,
  margins = DEFAULT_CHART_MARGINS,
  legend,
  sourceNote,
  bare = false,
  children,
}: ChartFrameProps) {
  const innerWidth = Math.max(0, width - margins.left - margins.right);
  const innerHeight = Math.max(0, height - margins.top - margins.bottom);

  const plot = (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label={title}
      className="block h-auto w-full"
    >
      <g transform={`translate(${margins.left},${margins.top})`}>
        {children(innerWidth, innerHeight)}
      </g>
    </svg>
  );

  if (bare) {
    return (
      <div className="flex flex-col gap-4">
        {legend ? <div>{legend}</div> : null}
        {plot}
      </div>
    );
  }

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <header className="flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            {eyebrow}
          </span>
          <h3 className="text-base font-semibold tracking-tight text-text-primary sm:text-lg">
            {title}
          </h3>
          {takeaway ? (
            <p className="max-w-prose text-xs leading-relaxed text-text-secondary">
              {takeaway}
            </p>
          ) : null}
        </header>

        {legend ? <div className="-mt-1">{legend}</div> : null}

        {plot}

        <ChartSourceNote note={sourceNote} />
      </CardBody>
    </Card>
  );
}

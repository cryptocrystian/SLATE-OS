import * as React from "react";
import { Group } from "@visx/group";
import { scaleLinear } from "@visx/scale";
import { Line } from "@visx/shape";
import { Text } from "@visx/text";
import { ChartFrame } from "@/components/charts/primitives/chart-frame";
import { ChartGanttBar } from "@/components/charts/primitives/chart-gantt-bar";
import {
  ChartDependencyArrow,
  ChartDependencyArrowheadMarker,
} from "@/components/charts/primitives/chart-dependency-arrow";
import {
  CHART_FONT_MONO,
  CHART_FONT_SANS,
  CHART_TICK_LABEL,
  CHART_TONE_VAR,
  type ChartTone,
  type SourceNote,
} from "@/lib/charts/types";

/**
 * Roadmap Gantt with Dependencies — Phase 1B Exhibit Sprint 4.
 *
 * 30/60/90-day timeline. Items grouped visually by phase, bars span time,
 * dependency arrows curve from one item's right edge to the next item's
 * left edge with a subtle right-angle stub. A vertical "Today" marker
 * sits at the configured day offset (default 0).
 *
 * Pure server component. SVG only. Composes `ChartFrame`, the new
 * `ChartGanttBar` and `ChartDependencyArrow` primitives, plus
 * `ChartDependencyArrowheadMarker` for the arrowhead `<marker>`.
 *
 * No new Visx packages, no `@visx/heatmap`, no client boundary.
 */

export type RoadmapPhase = "days_0_30" | "days_31_60" | "days_61_90";
export type RoadmapStatus =
  | "planned"
  | "in_progress"
  | "blocked"
  | "complete";

export interface RoadmapGanttItem {
  id: string;
  title: string;
  phase: RoadmapPhase;
  /** Start day offset (0–90). Negative values are clamped to 0. */
  startOffset: number;
  /** Duration in days. Negative or zero values are clamped to a minimum visible width. */
  durationDays: number;
  /** IDs of items this item depends on. Forward-in-time dependencies only. */
  dependencyIds: string[];
  status: RoadmapStatus;
  ownerPlaceholder?: string;
}

export interface RoadmapGanttWithDependenciesProps {
  items: RoadmapGanttItem[];
  /** Required source attribution. */
  sourceNote: SourceNote;
  /** Bare mode: chart + legend only, for deliverable embedding. */
  bare?: boolean;
  /** Day offset of the "Today" marker. Default 0 (left edge). */
  todayOffset?: number;
  /** Optional consultant takeaway. Defaults to a derived one-line summary. */
  takeaway?: string;
}

// Logical SVG canvas. Matches other Phase 1B exhibits.
const WIDTH = 880;
const HEIGHT = 540;

// Margins: left for item titles, top for phase headers + Today label,
// bottom for the day-axis ticks. Left margin is generous to accommodate
// real-world initiative names ("Customer support assistant pilot",
// "Governance + change-mgmt rollout") without wrapping or truncation.
const MARGINS = {
  top: 72,
  right: 24,
  bottom: 36,
  left: 280,
};

// Timeline domain — fixed 0–90 day window per Phase 1B canon.
const TIMELINE_START = 0;
const TIMELINE_END = 90;
const PHASE_BOUNDARY_1 = 30;
const PHASE_BOUNDARY_2 = 60;

// Bar geometry within each row.
const BAR_HEIGHT_RATIO = 0.45;
const BAR_HEIGHT_MAX = 30;
const BAR_HEIGHT_MIN = 14;
const MIN_BAR_WIDTH_DAYS = 2; // floor so a 0/1-day item is still visible

// Arrowhead marker id — unique per exhibit to avoid `<defs>` collisions.
const ARROW_MARKER_ID = "slate-roadmap-dep-arrow";

const STATUS_TONE: Record<RoadmapStatus, ChartTone> = {
  planned: "info",
  in_progress: "brand",
  blocked: "risk",
  complete: "neutral",
};

const STATUS_LABEL: Record<RoadmapStatus, string> = {
  planned: "Planned",
  in_progress: "In progress",
  blocked: "Blocked",
  complete: "Complete",
};

const STATUS_ORDER: RoadmapStatus[] = [
  "planned",
  "in_progress",
  "blocked",
  "complete",
];

function clampStartOffset(start: number): number {
  if (!Number.isFinite(start)) return 0;
  return Math.max(TIMELINE_START, Math.min(TIMELINE_END, start));
}

function clampDurationDays(start: number, duration: number): number {
  if (!Number.isFinite(duration)) return MIN_BAR_WIDTH_DAYS;
  const safeDuration = Math.max(MIN_BAR_WIDTH_DAYS, duration);
  // Clamp to the chart edge: an item that runs past day 90 visually stops at 90.
  const remaining = TIMELINE_END - clampStartOffset(start);
  return Math.min(safeDuration, Math.max(MIN_BAR_WIDTH_DAYS, remaining));
}

function deriveTakeaway(items: RoadmapGanttItem[]): string {
  if (items.length === 0) {
    return "No roadmap initiatives sequenced yet.";
  }
  let inProgress = 0;
  let blocked = 0;
  for (const item of items) {
    if (item.status === "in_progress") inProgress += 1;
    if (item.status === "blocked") blocked += 1;
  }
  const initiativesLabel = items.length === 1 ? "initiative" : "initiatives";
  let takeaway = `${items.length} roadmap ${initiativesLabel} span the 90-day plan`;
  const tail: string[] = [];
  if (inProgress > 0) {
    tail.push(
      `${inProgress} ${inProgress === 1 ? "is" : "are"} in progress`,
    );
  }
  if (blocked > 0) {
    tail.push(
      `${blocked} ${blocked === 1 ? "is" : "are"} blocked by a dependency`,
    );
  }
  if (tail.length > 0) takeaway += `; ${tail.join(" and ")}`;
  return `${takeaway}.`;
}

export function RoadmapGanttWithDependencies({
  items,
  sourceNote,
  todayOffset = 0,
  takeaway,
  bare = false,
}: RoadmapGanttWithDependenciesProps) {
  const resolvedTakeaway = takeaway ?? deriveTakeaway(items);
  const safeToday = clampStartOffset(todayOffset);

  return (
    <ChartFrame
      width={WIDTH}
      height={HEIGHT}
      eyebrow="Roadmap Gantt with Dependencies"
      title="30 / 60 / 90-day initiative sequencing"
      takeaway={resolvedTakeaway}
      legend={<Legend />}
      sourceNote={sourceNote}
      bare={bare}
      margins={MARGINS}
    >
      {(innerWidth, innerHeight) => {
        if (items.length === 0) return null;

        // x-scale: domain 0..90 days, range 0..innerWidth.
        const xScale = scaleLinear<number>({
          domain: [TIMELINE_START, TIMELINE_END],
          range: [0, innerWidth],
        });

        // y-scale: rows. Each item occupies one row (deterministic order).
        const rowHeight = innerHeight / items.length;
        const barHeight = Math.max(
          BAR_HEIGHT_MIN,
          Math.min(BAR_HEIGHT_MAX, rowHeight * BAR_HEIGHT_RATIO),
        );

        // Resolve each item's bar geometry once so dependency arrows can
        // index into the same coordinates without recomputing.
        const itemGeom = new Map<
          string,
          {
            x: number;
            y: number;
            width: number;
            barTopY: number;
            barCenterY: number;
            barRightX: number;
            barLeftX: number;
          }
        >();
        items.forEach((item, ri) => {
          const start = clampStartOffset(item.startOffset);
          const dur = clampDurationDays(start, item.durationDays);
          const x = xScale(start);
          const width = Math.max(2, xScale(start + dur) - xScale(start));
          const rowTopY = ri * rowHeight;
          const barTopY = rowTopY + (rowHeight - barHeight) / 2;
          const barCenterY = barTopY + barHeight / 2;
          itemGeom.set(item.id, {
            x,
            y: barTopY,
            width,
            barTopY,
            barCenterY,
            barRightX: x + width,
            barLeftX: x,
          });
        });

        // Pre-build dependency edges. Skip edges where the source isn't
        // in the item set so a stale id can't trip the renderer.
        const idSet = new Set(items.map((i) => i.id));
        const edges: Array<{
          fromId: string;
          toId: string;
          fromTitle: string;
          toTitle: string;
        }> = [];
        for (const item of items) {
          for (const depId of item.dependencyIds) {
            if (!idSet.has(depId)) continue;
            const fromItem = items.find((i) => i.id === depId);
            if (!fromItem) continue;
            edges.push({
              fromId: depId,
              toId: item.id,
              fromTitle: fromItem.title,
              toTitle: item.title,
            });
          }
        }

        return (
          <>
            <defs>
              <ChartDependencyArrowheadMarker id={ARROW_MARKER_ID} />
            </defs>

            {/* Phase headers across the top, one per phase region */}
            <PhaseHeader
              x={(xScale(TIMELINE_START) + xScale(PHASE_BOUNDARY_1)) / 2}
              y={-52}
              label="Days 0–30"
            />
            <PhaseHeader
              x={(xScale(PHASE_BOUNDARY_1) + xScale(PHASE_BOUNDARY_2)) / 2}
              y={-52}
              label="Days 31–60"
            />
            <PhaseHeader
              x={(xScale(PHASE_BOUNDARY_2) + xScale(TIMELINE_END)) / 2}
              y={-52}
              label="Days 61–90"
            />

            {/* Subtle vertical phase boundaries spanning the inner area */}
            <Line
              from={{ x: xScale(PHASE_BOUNDARY_1), y: 0 }}
              to={{ x: xScale(PHASE_BOUNDARY_1), y: innerHeight }}
              stroke="var(--color-border-strong)"
              strokeDasharray="3 4"
              strokeOpacity={0.4}
            />
            <Line
              from={{ x: xScale(PHASE_BOUNDARY_2), y: 0 }}
              to={{ x: xScale(PHASE_BOUNDARY_2), y: innerHeight }}
              stroke="var(--color-border-strong)"
              strokeDasharray="3 4"
              strokeOpacity={0.4}
            />

            {/* Row labels on the left (item titles, mono uppercase).
                Left-anchored at the SVG left edge so long initiative names
                don't get clipped by the viewBox. Letter-spacing 1.2 keeps
                a generous reading rhythm without consuming label width. */}
            {items.map((item, ri) => (
              <Text
                key={`row-${item.id}`}
                x={-(MARGINS.left - 12)}
                y={ri * rowHeight + rowHeight / 2}
                width={MARGINS.left - 28}
                fontFamily={CHART_FONT_SANS}
                fontSize={12}
                fill="var(--color-text-secondary)"
                textAnchor="start"
                verticalAnchor="middle"
              >
                {item.title}
              </Text>
            ))}

            {/* Dependency arrows — render BEFORE bars so bars sit on top */}
            <Group>
              {edges.map((edge) => {
                const from = itemGeom.get(edge.fromId);
                const to = itemGeom.get(edge.toId);
                if (!from || !to) return null;
                return (
                  <ChartDependencyArrow
                    key={`dep-${edge.fromId}-${edge.toId}`}
                    startX={from.barRightX}
                    startY={from.barCenterY}
                    endX={to.barLeftX}
                    endY={to.barCenterY}
                    markerId={ARROW_MARKER_ID}
                    title={`${edge.fromTitle} → ${edge.toTitle}`}
                  />
                );
              })}
            </Group>

            {/* Gantt bars */}
            <Group>
              {items.map((item) => {
                const g = itemGeom.get(item.id);
                if (!g) return null;
                const tone = STATUS_TONE[item.status];
                const fill = CHART_TONE_VAR[tone];
                const muted = item.status === "complete";
                const ownerSuffix = item.ownerPlaceholder
                  ? `. Owner: ${item.ownerPlaceholder}`
                  : "";
                const titleText = `${item.title} · ${STATUS_LABEL[item.status]}. Days ${item.startOffset}–${item.startOffset + item.durationDays}${ownerSuffix}.`;
                return (
                  <ChartGanttBar
                    key={item.id}
                    x={g.x}
                    y={g.y}
                    width={g.width}
                    height={barHeight}
                    fill={fill}
                    muted={muted}
                    labelPlacement="none"
                    title={titleText}
                  />
                );
              })}
            </Group>

            {/* Today marker — vertical line + uppercase label above */}
            <Line
              from={{ x: xScale(safeToday), y: 0 }}
              to={{ x: xScale(safeToday), y: innerHeight }}
              stroke="var(--color-brand-primary)"
              strokeWidth={1.5}
              strokeOpacity={0.8}
            />
            <Text
              x={xScale(safeToday)}
              y={-16}
              fontFamily={CHART_FONT_MONO}
              fontSize={9}
              letterSpacing={1.6}
              fill="var(--color-brand-primary)"
              textAnchor="middle"
              verticalAnchor="end"
            >
              {`TODAY · D${safeToday}`}
            </Text>

            {/* Day-axis ticks at 0, 30, 60, 90 (rendered manually so we can
                hide intermediate ticks the linear scale would otherwise add) */}
            <Group top={innerHeight}>
              <Line
                from={{ x: 0, y: 0 }}
                to={{ x: innerWidth, y: 0 }}
                stroke="var(--color-border-strong)"
                strokeWidth={1}
              />
              {[TIMELINE_START, PHASE_BOUNDARY_1, PHASE_BOUNDARY_2, TIMELINE_END].map(
                (day) => (
                  <g key={`tick-${day}`}>
                    <Line
                      from={{ x: xScale(day), y: 0 }}
                      to={{ x: xScale(day), y: 4 }}
                      stroke="var(--color-border-strong)"
                      strokeWidth={1}
                    />
                    <Text
                      x={xScale(day)}
                      y={16}
                      fontFamily={CHART_FONT_MONO}
                      fontSize={10}
                      letterSpacing={1.2}
                      fill={CHART_TICK_LABEL}
                      textAnchor="middle"
                      verticalAnchor="middle"
                    >
                      {`D${day}`}
                    </Text>
                  </g>
                ),
              )}
            </Group>
          </>
        );
      }}
    </ChartFrame>
  );
}

function PhaseHeader({
  x,
  y,
  label,
}: {
  x: number;
  y: number;
  label: string;
}) {
  return (
    <Text
      x={x}
      y={y}
      fontFamily={CHART_FONT_SANS}
      fontSize={11}
      fontWeight={600}
      letterSpacing={0.6}
      fill="var(--color-text-secondary)"
      textAnchor="middle"
      verticalAnchor="middle"
    >
      {label}
    </Text>
  );
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-text-muted">
      <span className="font-mono uppercase tracking-[0.14em] text-text-muted">
        Status
      </span>
      {STATUS_ORDER.map((s) => (
        <LegendSwatch key={s} tone={STATUS_TONE[s]} label={STATUS_LABEL[s]} />
      ))}
      <span aria-hidden className="text-text-disabled">
        ·
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span
          aria-hidden
          className="inline-block h-2 w-0.5"
          style={{ backgroundColor: "var(--color-brand-primary)" }}
        />
        Today marker
      </span>
    </div>
  );
}

function LegendSwatch({ tone, label }: { tone: ChartTone; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        aria-hidden
        className="inline-block h-2 w-2 rounded-sm"
        style={{ backgroundColor: CHART_TONE_VAR[tone] }}
      />
      {label}
    </span>
  );
}

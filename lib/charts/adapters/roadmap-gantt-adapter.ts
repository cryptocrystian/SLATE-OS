/**
 * Roadmap Gantt with Dependencies — Sprint 0B adapter.
 *
 * Maps persisted `roadmap_items` (TS shape: `RoadmapItem`) into the
 * exhibit's `RoadmapGanttItem[]` props, per docs/17 § Group A row 5.
 *
 *   ⚠ Schedule-derivation note.
 *   `RoadmapItem` carries `phase` (3-value enum), `priority`,
 *   `dependencies`, and free-text supporting fields — but it does NOT
 *   carry explicit `startOffset` (days) or `durationDays`. The exhibit
 *   needs both. Sprint 0B derives a deterministic synthetic schedule
 *   from `phase` + array position within the phase, distributing items
 *   evenly across each phase's 30-day window. This is honest: a
 *   schedule-synthesized info issue is surfaced on every result. A
 *   future schema sprint may add explicit start/duration columns; this
 *   adapter will then prefer persisted values when present.
 *
 *   The persisted `status` enum (`planned / ready / blocked /
 *   deferred / completed`) is stripped by the existing
 *   `mapRoadmapItemRow` and is not exposed on the TS-mapped
 *   `RoadmapItem` today. The adapter therefore defaults every bar to
 *   the `planned` exhibit status and surfaces an info issue. A future
 *   sprint that lifts `status` into the TS type will replace this
 *   default with a real mapping.
 *
 * Pure function. No React, no DB client, no app-route imports, no I/O.
 * Never throws on ordinary bad data.
 */

import type {
  RoadmapGanttItem,
  RoadmapGanttWithDependenciesProps,
  RoadmapPhase as GanttPhase,
} from "@/components/charts/exhibits/roadmap-gantt-with-dependencies";
import {
  adapterInsufficientData,
  adapterInvalidData,
  adapterReady,
  createAdapterSourceSummary,
  persistedSourceNote,
  PERSISTED_SOURCE_LABEL,
  type ChartAdapterIssue,
  type ChartAdapterResult,
} from "@/lib/charts/adapters/types";
import type {
  RoadmapItem,
  RoadmapPhase as PersistedPhase,
} from "@/lib/roadmap/types";

export interface RoadmapGanttAdapterArgs {
  items: RoadmapItem[];
  /** Optional "Today" marker offset (0–90 days). Default 0. */
  todayOffset?: number;
  generatedAt: string | Date;
  lastTouchedAt?: string | Date | null;
}

// Persisted-phase → exhibit-phase + day window. The exhibit expects
// `days_0_30 / days_31_60 / days_61_90`; persistence uses
// `first-30 / days-31-60 / days-61-90`.
const PHASE_WINDOW: Record<
  PersistedPhase,
  { exhibitPhase: GanttPhase; start: number; end: number }
> = {
  "first-30": { exhibitPhase: "days_0_30", start: 0, end: 30 },
  "days-31-60": { exhibitPhase: "days_31_60", start: 31, end: 60 },
  "days-61-90": { exhibitPhase: "days_61_90", start: 61, end: 90 },
};

const PHASE_ORDER: PersistedPhase[] = [
  "first-30",
  "days-31-60",
  "days-61-90",
];

const MIN_BAR_DURATION_DAYS = 4;

export function roadmapGanttFromRoadmapItems(
  args: RoadmapGanttAdapterArgs,
): ChartAdapterResult<RoadmapGanttWithDependenciesProps> {
  const { items, todayOffset, generatedAt, lastTouchedAt } = args;
  const safeRows = Array.isArray(items) ? items : [];

  const sourceSummary = createAdapterSourceSummary({
    source: PERSISTED_SOURCE_LABEL["roadmap-items"],
    rowCount: safeRows.length,
    generatedAt,
    lastTouchedAt: lastTouchedAt ?? null,
  });

  if (safeRows.length === 0) {
    return adapterInsufficientData<RoadmapGanttWithDependenciesProps>(
      sourceSummary,
      [
        {
          code: "no_roadmap_items",
          severity: "info",
          message:
            "No roadmap items exist for this engagement yet. Sequence opportunities into a 30 / 60 / 90 roadmap to assemble the timeline.",
        },
      ],
    );
  }

  const issues: ChartAdapterIssue[] = [];

  // Group by phase preserving the input order (the query helper already
  // orders by phase → position → created_at).
  const buckets: Record<PersistedPhase, RoadmapItem[]> = {
    "first-30": [],
    "days-31-60": [],
    "days-61-90": [],
  };
  const idSet = new Set<string>();
  for (const item of safeRows) {
    if (!item || typeof item.id !== "string" || item.id.length === 0) {
      issues.push({
        code: "missing_id",
        severity: "warning",
        message:
          "A roadmap item with no id was encountered; row dropped to keep the dependency graph stable.",
      });
      continue;
    }
    const bucket = buckets[item.phase];
    if (!bucket) {
      issues.push({
        code: "unknown_phase",
        severity: "warning",
        message: `Roadmap item ${item.id} has unknown phase "${item.phase}"; row dropped.`,
        field: "phase",
      });
      continue;
    }
    bucket.push(item);
    idSet.add(item.id);
  }

  const ganttItems: RoadmapGanttItem[] = [];
  for (const phase of PHASE_ORDER) {
    const bucket = buckets[phase];
    if (bucket.length === 0) continue;
    const window = PHASE_WINDOW[phase];
    const phaseSpan = window.end - window.start;
    const slotCount = bucket.length;
    // Even distribution within the phase. Each item gets `phaseSpan /
    // slotCount` days of width, never less than MIN_BAR_DURATION_DAYS,
    // capped so the last bar's end stays at phase boundary.
    const slotWidth = Math.max(
      MIN_BAR_DURATION_DAYS,
      Math.floor(phaseSpan / Math.max(1, slotCount)),
    );
    for (let i = 0; i < bucket.length; i++) {
      const item = bucket[i];
      const start = window.start + i * slotWidth;
      // Last item in the phase stretches to the phase boundary so the
      // visual fills the phase column even when slotWidth was rounded
      // down by integer math.
      const isLast = i === bucket.length - 1;
      const rawDuration = isLast ? window.end - start : slotWidth;
      const duration = Math.max(MIN_BAR_DURATION_DAYS, rawDuration);
      ganttItems.push({
        id: item.id,
        title: item.title,
        phase: window.exhibitPhase,
        startOffset: start,
        durationDays: duration,
        dependencyIds: cleanDependencyIds(item.dependencies, idSet, issues, item.id),
        status: "planned",
        ownerPlaceholder: item.ownerPlaceholder,
      });
    }
  }

  if (ganttItems.length === 0) {
    return adapterInvalidData<RoadmapGanttWithDependenciesProps>(sourceSummary, [
      ...issues,
      {
        code: "all_rows_rejected",
        severity: "error",
        message:
          "Every roadmap item failed phase validation; no valid items to chart.",
      },
    ]);
  }

  // Two synthesis-disclosure issues so the diagnostic surface surfaces
  // exactly what Sprint 0B is doing on the persisted side.
  issues.push({
    code: "schedule_synthesized",
    severity: "info",
    message:
      "startOffset/durationDays are not persisted today; synthesized by evenly distributing items within each phase by array order. A future schema sprint will replace this with persisted start/duration values.",
    field: "startOffset | durationDays",
  });
  issues.push({
    code: "status_mapping_unavailable",
    severity: "info",
    message:
      "Persisted status is not yet exposed on the TS-mapped RoadmapItem shape; all bars default to 'planned'. A future sprint that surfaces status will replace this default with a real mapping.",
    field: "status",
  });

  // Optional today marker: clamp to the timeline.
  let resolvedTodayOffset: number | undefined;
  if (typeof todayOffset === "number" && Number.isFinite(todayOffset)) {
    resolvedTodayOffset = Math.max(0, Math.min(90, todayOffset));
  }

  const props: RoadmapGanttWithDependenciesProps = {
    items: ganttItems,
    sourceNote: persistedSourceNote(
      PERSISTED_SOURCE_LABEL["roadmap-items"],
      ganttItems.length,
    ),
    todayOffset: resolvedTodayOffset,
  };

  return adapterReady(props, sourceSummary, issues);
}

function cleanDependencyIds(
  dependencies: string[] | undefined | null,
  knownIds: Set<string>,
  issues: ChartAdapterIssue[],
  ownerId: string,
): string[] {
  if (!Array.isArray(dependencies)) return [];
  const cleaned: string[] = [];
  for (const dep of dependencies) {
    if (typeof dep !== "string" || dep.length === 0) continue;
    if (!knownIds.has(dep)) {
      issues.push({
        code: "dropped_unknown_dependency",
        severity: "warning",
        message: `Roadmap item ${ownerId} depends on missing/unknown id "${dep}"; edge dropped.`,
        field: "dependencyIds",
      });
      continue;
    }
    if (dep === ownerId) {
      issues.push({
        code: "dropped_self_dependency",
        severity: "warning",
        message: `Roadmap item ${ownerId} lists itself as a dependency; edge dropped.`,
        field: "dependencyIds",
      });
      continue;
    }
    cleaned.push(dep);
  }
  return cleaned;
}

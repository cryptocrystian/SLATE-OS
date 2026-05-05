import type { OpportunityPriority } from "@/lib/opportunities/types";
import type { RoadmapItem, RoadmapPhase } from "./types";

/**
 * DB ↔ TypeScript mappers for persisted roadmap items.
 */

// ---------------------------------------------------------------------------
// DB row shape
// ---------------------------------------------------------------------------

export interface DbRoadmapItemRow {
  id: string;
  workspace_id: string;
  engagement_id: string;
  opportunity_id: string | null;
  phase: string | null;
  title: string;
  objective: string | null;
  priority: string | null;
  key_actions: string[] | null;
  dependencies: string[] | null;
  success_criteria: string[] | null;
  risks: string[] | null;
  owner_placeholder: string | null;
  readiness_note: string | null;
  position: number | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Enum translation
// ---------------------------------------------------------------------------

const PHASE_FROM_DB: Record<string, RoadmapPhase> = {
  first_30: "first-30",
  days_31_60: "days-31-60",
  days_61_90: "days-61-90",
};

const PHASE_TO_DB: Record<RoadmapPhase, string> = {
  "first-30": "first_30",
  "days-31-60": "days_31_60",
  "days-61-90": "days_61_90",
};

const PRIORITY_FROM_DB: Record<string, OpportunityPriority> = {
  quick_win: "quick-win",
  strategic_build: "strategic-build",
  low_priority: "low-priority",
  defer: "defer",
  avoid: "avoid",
};

const PRIORITY_TO_DB: Record<OpportunityPriority, string> = {
  "quick-win": "quick_win",
  "strategic-build": "strategic_build",
  "low-priority": "low_priority",
  defer: "defer",
  avoid: "avoid",
};

export type RoadmapStatus =
  | "planned"
  | "ready"
  | "blocked"
  | "deferred"
  | "completed";

export const ROADMAP_STATUSES: RoadmapStatus[] = [
  "planned",
  "ready",
  "blocked",
  "deferred",
  "completed",
];

export function dbPhaseFor(phase: RoadmapPhase): string {
  return PHASE_TO_DB[phase] ?? "first_30";
}

export function dbPriorityFor(priority: OpportunityPriority): string {
  return PRIORITY_TO_DB[priority] ?? "low_priority";
}

export function tsPhaseFor(value: string | null | undefined): RoadmapPhase {
  if (!value) return "first-30";
  return PHASE_FROM_DB[value] ?? "first-30";
}

export function tsPriorityFor(
  value: string | null | undefined,
): OpportunityPriority {
  if (!value) return "low-priority";
  return PRIORITY_FROM_DB[value] ?? "low-priority";
}

export function tsStatusFor(
  value: string | null | undefined,
): RoadmapStatus {
  if (!value) return "planned";
  return (ROADMAP_STATUSES as string[]).includes(value)
    ? (value as RoadmapStatus)
    : "planned";
}

// ---------------------------------------------------------------------------
// Public mapper
// ---------------------------------------------------------------------------

export function mapRoadmapItemRow(row: DbRoadmapItemRow): RoadmapItem {
  return {
    id: row.id,
    engagementId: row.engagement_id,
    phase: tsPhaseFor(row.phase),
    title: row.title,
    objective: row.objective ?? "",
    linkedOpportunityId: row.opportunity_id ?? undefined,
    priority: tsPriorityFor(row.priority),
    keyActions: row.key_actions ?? [],
    dependencies: row.dependencies ?? [],
    successCriteria: row.success_criteria ?? [],
    risks: row.risks ?? [],
    ownerPlaceholder: row.owner_placeholder ?? undefined,
    readinessNote: row.readiness_note ?? undefined,
  };
}

// ---------------------------------------------------------------------------
// UUID guard
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

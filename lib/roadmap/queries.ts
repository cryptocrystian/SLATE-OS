import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isUuid,
  mapRoadmapItemRow,
  type DbRoadmapItemRow,
} from "./mappers";
import type { RoadmapItem } from "./types";

/**
 * Server-only query layer for persisted roadmap items.
 */

const ROADMAP_SELECT = `
  id,
  workspace_id,
  engagement_id,
  opportunity_id,
  phase,
  title,
  objective,
  priority,
  key_actions,
  dependencies,
  success_criteria,
  risks,
  owner_placeholder,
  readiness_note,
  position,
  status,
  created_at,
  updated_at
` as const;

export interface RoadmapStatusSummary {
  total: number;
  first30: number;
  days3160: number;
  days6190: number;
  blocked: number;
  deferred: number;
  completed: number;
  ready: number;
  planned: number;
  linkedToOpportunity: number;
  dependencyCount: number;
}

export async function getRoadmapForEngagementPersisted(
  engagementId: string,
): Promise<RoadmapItem[]> {
  if (!isUuid(engagementId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("roadmap_items")
    .select(ROADMAP_SELECT)
    .eq("engagement_id", engagementId)
    .order("phase", { ascending: true })
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) {
    console.error("[roadmap.queries] list-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows = (data as unknown as DbRoadmapItemRow[]) ?? [];
  return rows.map(mapRoadmapItemRow);
}

export async function getRoadmapStatusSummary(
  engagementId: string,
): Promise<RoadmapStatusSummary | null> {
  if (!isUuid(engagementId)) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("roadmap_items")
    .select("phase, status, opportunity_id, dependencies")
    .eq("engagement_id", engagementId);
  if (error) {
    console.error("[roadmap.queries] status-summary-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return null;
  }
  const rows =
    (data as unknown as Array<{
      phase: string | null;
      status: string | null;
      opportunity_id: string | null;
      dependencies: string[] | null;
    }>) ?? [];

  let first30 = 0;
  let days3160 = 0;
  let days6190 = 0;
  let blocked = 0;
  let deferred = 0;
  let completed = 0;
  let ready = 0;
  let planned = 0;
  let linkedToOpportunity = 0;
  let dependencyCount = 0;

  for (const r of rows) {
    switch (r.phase) {
      case "first_30":
        first30 += 1;
        break;
      case "days_31_60":
        days3160 += 1;
        break;
      case "days_61_90":
        days6190 += 1;
        break;
      default:
        break;
    }
    switch (r.status) {
      case "blocked":
        blocked += 1;
        break;
      case "deferred":
        deferred += 1;
        break;
      case "completed":
        completed += 1;
        break;
      case "ready":
        ready += 1;
        break;
      case "planned":
      default:
        planned += 1;
        break;
    }
    if (r.opportunity_id) linkedToOpportunity += 1;
    dependencyCount += (r.dependencies ?? []).length;
  }

  return {
    total: rows.length,
    first30,
    days3160,
    days6190,
    blocked,
    deferred,
    completed,
    ready,
    planned,
    linkedToOpportunity,
    dependencyCount,
  };
}

// ---------------------------------------------------------------------------
// Opportunity candidates — selected/scored opportunities the operator
// can link a roadmap item to.
// ---------------------------------------------------------------------------

export interface OpportunityCandidate {
  id: string;
  title: string;
  priority: string;
  quadrant: string;
  evidenceStrength: string;
  status: string;
}

export async function getOpportunityCandidatesForEngagement(
  engagementId: string,
): Promise<OpportunityCandidate[]> {
  if (!isUuid(engagementId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("opportunities")
    .select(
      "id, title, priority, quadrant, evidence_strength, status",
    )
    .eq("engagement_id", engagementId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[roadmap.queries] candidate-opportunities-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  return (
    (data as unknown as Array<{
      id: string;
      title: string;
      priority: string | null;
      quadrant: string | null;
      evidence_strength: string | null;
      status: string | null;
    }>) ?? []
  ).map((row) => ({
    id: row.id,
    title: row.title,
    priority: row.priority ?? "low_priority",
    quadrant: row.quadrant ?? "low_priority",
    evidenceStrength: row.evidence_strength ?? "adequate",
    status: row.status ?? "draft",
  }));
}

// Re-export for callers that consume status type.
export type { RoadmapStatus } from "./mappers";

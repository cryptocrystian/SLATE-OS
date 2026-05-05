"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  dbPhaseFor,
  dbPriorityFor,
  isUuid,
  type RoadmapStatus,
  ROADMAP_STATUSES,
} from "./mappers";
import type { OpportunityPriority } from "@/lib/opportunities/types";
import type { RoadmapPhase } from "./types";

const VALID_PHASES: RoadmapPhase[] = ["first-30", "days-31-60", "days-61-90"];
const VALID_PRIORITIES: OpportunityPriority[] = [
  "quick-win",
  "strategic-build",
  "low-priority",
  "defer",
  "avoid",
];

export interface CreateRoadmapItemInput {
  engagementId: string;
  phase: RoadmapPhase;
  title: string;
  objective?: string;
  priority: OpportunityPriority;
  opportunityId?: string;
  keyActions?: string[];
  dependencies?: string[];
  successCriteria?: string[];
  risks?: string[];
  ownerPlaceholder?: string;
  readinessNote?: string;
}

export type RoadmapActionResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "unauthenticated"
        | "invalid-engagement"
        | "invalid-roadmap-item"
        | "missing-fields"
        | "invalid-phase"
        | "invalid-priority"
        | "invalid-opportunity"
        | "invalid-status"
        | "engagement-not-found"
        | "roadmap-item-not-found"
        | "service-error";
    };

export type CreateRoadmapItemResult =
  | { ok: true; itemId: string }
  | (Exclude<RoadmapActionResult, { ok: true }> & { ok: false });

export async function createRoadmapItem(
  input: CreateRoadmapItemInput,
): Promise<CreateRoadmapItemResult> {
  if (!isUuid(input.engagementId)) {
    return { ok: false, error: "invalid-engagement" };
  }
  const title = input.title.trim();
  if (!title) return { ok: false, error: "missing-fields" };
  if (!VALID_PHASES.includes(input.phase)) {
    return { ok: false, error: "invalid-phase" };
  }
  if (!VALID_PRIORITIES.includes(input.priority)) {
    return { ok: false, error: "invalid-priority" };
  }
  if (input.opportunityId && !isUuid(input.opportunityId)) {
    return { ok: false, error: "invalid-opportunity" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: engagement, error: engagementError } = await supabase
    .from("engagements")
    .select("id, workspace_id")
    .eq("id", input.engagementId)
    .maybeSingle<{ id: string; workspace_id: string }>();
  if (engagementError) {
    console.error("[roadmap.actions] engagement-lookup-failed", {
      name: engagementError.name,
      code: engagementError.code,
      message: engagementError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!engagement?.id) return { ok: false, error: "engagement-not-found" };

  const { data: inserted, error: insertError } = await supabase
    .from("roadmap_items")
    .insert({
      workspace_id: engagement.workspace_id,
      engagement_id: engagement.id,
      opportunity_id: input.opportunityId ?? null,
      phase: dbPhaseFor(input.phase),
      title,
      objective: trimOrNull(input.objective),
      priority: dbPriorityFor(input.priority),
      key_actions: cleanArray(input.keyActions),
      dependencies: cleanArray(input.dependencies),
      success_criteria: cleanArray(input.successCriteria),
      risks: cleanArray(input.risks),
      owner_placeholder: trimOrNull(input.ownerPlaceholder),
      readiness_note: trimOrNull(input.readinessNote),
      status: "planned",
    })
    .select("id")
    .single<{ id: string }>();
  if (insertError || !inserted?.id) {
    console.error("[roadmap.actions] insert-failed", {
      name: insertError?.name,
      code: insertError?.code,
      message: insertError?.message,
    });
    return { ok: false, error: "service-error" };
  }

  await bumpEngagement(supabase, engagement.id);
  revalidatePaths(engagement.id);
  return { ok: true, itemId: inserted.id };
}

export async function setRoadmapItemStatus(
  itemId: string,
  status: RoadmapStatus,
): Promise<RoadmapActionResult> {
  if (!isUuid(itemId)) return { ok: false, error: "invalid-roadmap-item" };
  if (!ROADMAP_STATUSES.includes(status)) {
    return { ok: false, error: "invalid-status" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("roadmap_items")
    .select("id, engagement_id")
    .eq("id", itemId)
    .maybeSingle<{ id: string; engagement_id: string }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "roadmap-item-not-found" };
  }

  const { error: updateError } = await supabase
    .from("roadmap_items")
    .update({ status })
    .eq("id", itemId);
  if (updateError) {
    console.error("[roadmap.actions] status-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await bumpEngagement(supabase, existing.engagement_id);
  revalidatePaths(existing.engagement_id);
  return { ok: true };
}

export async function removeRoadmapItem(
  itemId: string,
): Promise<RoadmapActionResult> {
  if (!isUuid(itemId)) return { ok: false, error: "invalid-roadmap-item" };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("roadmap_items")
    .select("id, engagement_id")
    .eq("id", itemId)
    .maybeSingle<{ id: string; engagement_id: string }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "roadmap-item-not-found" };
  }

  const { error: deleteError } = await supabase
    .from("roadmap_items")
    .delete()
    .eq("id", itemId);
  if (deleteError) {
    console.error("[roadmap.actions] delete-failed", {
      name: deleteError.name,
      code: deleteError.code,
      message: deleteError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await bumpEngagement(supabase, existing.engagement_id);
  revalidatePaths(existing.engagement_id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function trimOrNull(v: string | null | undefined): string | null {
  if (!v) return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanArray(v: string[] | undefined): string[] {
  if (!v) return [];
  return v.map((s) => s.trim()).filter((s) => s.length > 0);
}

async function bumpEngagement(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
) {
  await supabase
    .from("engagements")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", engagementId);
}

function revalidatePaths(engagementId: string) {
  revalidatePath(`/app/engagements/${engagementId}/roadmap`);
  revalidatePath(`/app/engagements/${engagementId}`);
}

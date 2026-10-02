import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeMetadata } from "@/lib/activity/log";

/**
 * BuildOS activity emitter (docs/80 §4). BUILDOS MODULE.
 *
 * Operator-visible milestones go to the platform `activity_events` table with
 * module = 'buildos'. Run-level detail lives in build_run_events, never here.
 * NEVER sets `engagement_id` (a ConsultOS lifecycle FK); an origin engagement
 * goes in metadata. Best-effort: a failed audit write is logged and never
 * blocks the mutation that already committed.
 */

export const BUILD_EVENT_TYPES = [
  "build_project_created",
  "build_project_status_changed",
  "build_project_settings_changed",
  "build_work_item_created",
  "build_work_item_status_changed",
  "build_decision_ruled",
  "build_run_cancel_requested",
  "build_alarm_cleared",
  "build_provider_account_changed",
  "build_worker_changed",
] as const;
export type BuildEventType = (typeof BUILD_EVENT_TYPES)[number];

export type BuildEntityType =
  | "build_project"
  | "build_work_item"
  | "build_decision"
  | "build_run"
  | "build_alarm"
  | "build_provider_account"
  | "build_worker";

export interface BuildEventInput {
  workspaceId: string;
  actorProfileId: string;
  eventType: BuildEventType;
  entityType: BuildEntityType;
  entityId: string;
  title: string;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordBuildEvent(input: BuildEventInput): Promise<void> {
  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("activity_events").insert({
      workspace_id: input.workspaceId,
      module: "buildos",
      actor_profile_id: input.actorProfileId,
      actor_user_id: input.actorProfileId,
      event_type: input.eventType,
      entity_type: input.entityType,
      entity_id: input.entityId,
      title: input.title.slice(0, 200),
      summary: input.summary ?? null,
      metadata: sanitizeMetadata(input.metadata),
    });
    if (error) {
      console.error("[build.activity] insert-failed", { eventType: input.eventType, code: error.code, message: error.message });
    }
  } catch (e) {
    console.error("[build.activity] unexpected", {
      eventType: input.eventType,
      message: e instanceof Error ? e.message : "unknown",
    });
  }
}

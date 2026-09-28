import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { sanitizeMetadata } from "@/lib/activity/log";

/**
 * GovernanceOS activity emitter (docs/76 §7). GOVERNANCEOS MODULE.
 *
 * Writes to the platform `activity_events` table with the GovernanceOS
 * columns it owns (module = 'governanceos', governance_program_id).
 * NEVER sets `engagement_id` — that FK belongs to ConsultOS lifecycles; an
 * engagement reference goes in metadata as `sourceEngagementId`. The DB
 * enforces both rules (0029 check constraints).
 *
 * Best-effort like the platform logger: a failed audit write is logged
 * server-side and never blocks the governance mutation that already
 * committed. (Lifecycle transitions are additionally recorded by the DB
 * itself in governed_asset_lifecycle_events.)
 */

export const GOVERNANCE_EVENT_TYPES = [
  "governance_program_created",
  "governance_program_updated",
  "governance_program_status_changed",
  "governance_engagement_linked",
  "governance_engagement_unlinked",
  "governance_asset_registered",
  "governance_asset_updated",
  "governance_asset_lifecycle_changed",
  "governance_policy_created",
  "governance_policy_version_drafted",
  "governance_policy_version_activated",
  "governance_policy_version_retired",
] as const;
export type GovernanceEventType = (typeof GOVERNANCE_EVENT_TYPES)[number];

export type GovernanceEntityType =
  | "governance_program"
  | "governance_program_engagement"
  | "governed_asset"
  | "governance_policy"
  | "governance_policy_version";

export interface GovernanceEventInput {
  workspaceId: string;
  programId: string;
  actorProfileId: string;
  eventType: GovernanceEventType;
  entityType: GovernanceEntityType;
  entityId: string;
  title: string;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}

export async function recordGovernanceEvent(input: GovernanceEventInput): Promise<void> {
  try {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("activity_events").insert({
      workspace_id: input.workspaceId,
      governance_program_id: input.programId,
      module: "governanceos",
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
      console.error("[governance.activity] insert-failed", {
        eventType: input.eventType,
        code: error.code,
        message: error.message,
      });
    }
  } catch (e) {
    console.error("[governance.activity] unexpected", {
      eventType: input.eventType,
      message: e instanceof Error ? e.message : "unknown",
    });
  }
}

export const GOVERNANCE_EVENT_LABELS: Record<GovernanceEventType, string> = {
  governance_program_created: "Program created",
  governance_program_updated: "Program updated",
  governance_program_status_changed: "Program status",
  governance_engagement_linked: "Engagement linked",
  governance_engagement_unlinked: "Engagement unlinked",
  governance_asset_registered: "Asset registered",
  governance_asset_updated: "Asset updated",
  governance_asset_lifecycle_changed: "Lifecycle change",
  governance_policy_created: "Policy created",
  governance_policy_version_drafted: "Policy draft",
  governance_policy_version_activated: "Policy activated",
  governance_policy_version_retired: "Policy retired",
};

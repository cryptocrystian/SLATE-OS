import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ActivityEntityType, ActivityEvent, ActivityEventType } from "./types";

const ACTIVITY_SELECT = `
  id,
  event_type,
  entity_type,
  entity_id,
  engagement_id,
  lead_id,
  title,
  summary,
  metadata,
  created_at,
  actor_profile_id,
  actor_user_id
` as const;

interface RawActivityRow {
  id: string;
  event_type: string;
  entity_type: string;
  entity_id: string | null;
  engagement_id: string | null;
  lead_id: string | null;
  title: string;
  summary: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_profile_id: string | null;
  actor_user_id: string | null;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

export async function getActivityForEngagement(
  engagementId: string,
  limit = 25,
): Promise<ActivityEvent[]> {
  if (!isUuid(engagementId)) return [];
  return queryActivity({ column: "engagement_id", value: engagementId, limit });
}

export async function getActivityForLead(
  leadId: string,
  limit = 15,
): Promise<ActivityEvent[]> {
  if (!isUuid(leadId)) return [];
  return queryActivity({ column: "lead_id", value: leadId, limit });
}

async function queryActivity(args: {
  column: "engagement_id" | "lead_id";
  value: string;
  limit: number;
}): Promise<ActivityEvent[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("activity_events")
    .select(ACTIVITY_SELECT)
    .eq(args.column, args.value)
    .order("created_at", { ascending: false })
    .limit(args.limit);
  if (error) {
    console.error("[activity.queries] list-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows = (data as unknown as RawActivityRow[]) ?? [];
  if (rows.length === 0) return [];

  const profileIds = Array.from(
    new Set(
      rows
        .map((r) => r.actor_profile_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );

  const profileLookup: Record<
    string,
    { display_name: string | null; title: string | null }
  > = {};
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, title")
      .in("id", profileIds);
    for (const p of (profiles as Array<{
      id: string;
      display_name: string | null;
      title: string | null;
    }> | null) ?? []) {
      profileLookup[p.id] = {
        display_name: p.display_name,
        title: p.title,
      };
    }
  }

  return rows.map<ActivityEvent>((row) => {
    const profile = row.actor_profile_id
      ? profileLookup[row.actor_profile_id]
      : undefined;
    return {
      id: row.id,
      eventType: row.event_type as ActivityEventType,
      entityType: row.entity_type as ActivityEntityType,
      entityId: row.entity_id,
      engagementId: row.engagement_id,
      leadId: row.lead_id,
      title: row.title,
      summary: row.summary,
      actorDisplayName: profile?.display_name ?? null,
      actorEmail: null,
      metadata: row.metadata ?? {},
      createdAt: row.created_at,
    };
  });
}

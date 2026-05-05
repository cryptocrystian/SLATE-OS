import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isUuid,
  mapEngagementRow,
  type DbAccountJoin,
  type DbContactJoin,
  type DbEngagementRow,
  type DbProfileJoin,
} from "./mappers";
import type { Engagement } from "./types";

/**
 * Server-only query layer for the persisted engagement workspace.
 * Reads via the authenticated server Supabase client so RLS is the
 * boundary, not application code.
 */

const ENGAGEMENT_LIST_SELECT = `
  id,
  workspace_id,
  account_id,
  contact_id,
  linked_lead_id,
  name,
  engagement_type,
  status,
  current_stage,
  owner_profile_id,
  target_date,
  last_activity_at,
  next_milestone,
  recommended_action,
  stage_progress,
  intake_status,
  document_status,
  findings_status,
  opportunity_status,
  report_status,
  proposal_status,
  risk_notes,
  dependencies,
  notes,
  source_snapshot,
  created_at,
  updated_at,
  accounts:account_id ( name, industry, practice_area ),
  contacts:contact_id ( full_name, title, email ),
  owner:owner_profile_id ( display_name )
` as const;

interface RawEngagementJoinRow extends DbEngagementRow {
  accounts: DbAccountJoin | null;
  contacts: DbContactJoin | null;
  owner: DbProfileJoin | null;
}

function toEngagement(raw: RawEngagementJoinRow): Engagement {
  return mapEngagementRow(raw, {
    account: raw.accounts,
    contact: raw.contacts,
    ownerProfile: raw.owner,
  });
}

export async function getAllEngagements(): Promise<Engagement[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("engagements")
    .select(ENGAGEMENT_LIST_SELECT)
    .order("last_activity_at", { ascending: false });
  if (error) {
    console.error("[engagements.queries] getAllEngagements failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  if (!data) return [];
  return (data as unknown as RawEngagementJoinRow[]).map(toEngagement);
}

export async function getEngagementById(
  id: string,
): Promise<Engagement | null> {
  if (!isUuid(id)) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("engagements")
    .select(ENGAGEMENT_LIST_SELECT)
    .eq("id", id)
    .maybeSingle();
  if (error) {
    console.error("[engagements.queries] getEngagementById failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return null;
  }
  if (!data) return null;
  return toEngagement(data as unknown as RawEngagementJoinRow);
}

/** Fetch only the engagement id linked to a lead. Used by `LeadActionsPanel`
 *  to decide whether the primary CTA should read "Open" or "Start". */
export async function getEngagementIdForLead(
  leadId: string,
): Promise<string | null> {
  if (!isUuid(leadId)) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("engagements")
    .select("id")
    .eq("linked_lead_id", leadId)
    .maybeSingle<{ id: string }>();
  if (error) {
    console.error("[engagements.queries] getEngagementIdForLead failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return null;
  }
  return data?.id ?? null;
}

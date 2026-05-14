import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "./mappers";
import { mapReportShareTokenRow } from "./share-token-mappers";
import type {
  DbReportShareTokenRow,
  ReportShareToken,
} from "./share-token-types";

/**
 * Phase 1B Sprint 4D-B — server-only query layer for report share
 * tokens. RLS gates every read; the policy from migration 0014 is the
 * boundary.
 *
 * No public-route handler is wired in this sprint; readers here are
 * operator-side audit surfaces (Past Candidates panel, activity feed
 * decoration, future revocation UI).
 */

const SHARE_TOKEN_SELECT = `
  id,
  workspace_id,
  engagement_id,
  report_id,
  snapshot_id,
  token_hash,
  status,
  audience_label,
  recipient_email_hash,
  expires_at,
  created_by,
  created_by_label,
  created_at,
  revoked_at,
  revoked_by,
  revoke_reason,
  last_accessed_at,
  access_count,
  metadata,
  updated_at
` as const;

export async function getReportShareTokensForSnapshot(
  snapshotId: string,
): Promise<ReportShareToken[]> {
  if (!isUuid(snapshotId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("report_share_tokens")
    .select(SHARE_TOKEN_SELECT)
    .eq("snapshot_id", snapshotId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[reports.share-tokens] fetch-for-snapshot-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows = (data as unknown as DbReportShareTokenRow[]) ?? [];
  return rows.map(mapReportShareTokenRow);
}

export async function getReportShareTokensForReport(
  reportId: string,
): Promise<ReportShareToken[]> {
  if (!isUuid(reportId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("report_share_tokens")
    .select(SHARE_TOKEN_SELECT)
    .eq("report_id", reportId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[reports.share-tokens] fetch-for-report-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows = (data as unknown as DbReportShareTokenRow[]) ?? [];
  return rows.map(mapReportShareTokenRow);
}

export async function countActiveShareTokensForSnapshot(
  snapshotId: string,
): Promise<number> {
  if (!isUuid(snapshotId)) return 0;
  const supabase = createSupabaseServerClient();
  const { count, error } = await supabase
    .from("report_share_tokens")
    .select("id", { count: "exact", head: true })
    .eq("snapshot_id", snapshotId)
    .eq("status", "active");
  if (error) {
    console.error("[reports.share-tokens] count-active-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return 0;
  }
  return count ?? 0;
}

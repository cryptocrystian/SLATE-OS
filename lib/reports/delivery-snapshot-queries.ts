import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "./mappers";
import {
  mapReportDeliverySnapshotRow,
} from "./delivery-snapshot-mappers";
import type {
  DbReportDeliverySnapshotRow,
  ReportDeliverySnapshot,
} from "./delivery-snapshot-types";

/**
 * Phase 1B Sprint 4C-B — server-only query layer for report delivery
 * snapshots. RLS gates every read; the policy from migration 0013 is
 * the boundary.
 */

const SNAPSHOT_SELECT = `
  id,
  workspace_id,
  engagement_id,
  report_id,
  status,
  delivery_surface,
  report_status_at_generation,
  generated_by,
  generated_by_label,
  generated_at,
  section_snapshot,
  exhibit_snapshot,
  source_summary_snapshot,
  claim_guard_result,
  omitted_exhibits,
  draft_watermark,
  artifact_path,
  artifact_mime_type,
  artifact_size_bytes,
  artifact_sha256,
  app_version,
  commit_sha,
  voided_at,
  voided_by,
  void_reason,
  created_at,
  updated_at
` as const;

export async function getReportDeliverySnapshotById(
  snapshotId: string,
): Promise<ReportDeliverySnapshot | null> {
  if (!isUuid(snapshotId)) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("report_delivery_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("id", snapshotId)
    .maybeSingle();
  if (error) {
    console.error("[reports.delivery-snapshots] fetch-by-id-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return null;
  }
  if (!data) return null;
  return mapReportDeliverySnapshotRow(
    data as unknown as DbReportDeliverySnapshotRow,
  );
}

export async function getReportDeliverySnapshotsForReport(
  reportId: string,
): Promise<ReportDeliverySnapshot[]> {
  if (!isUuid(reportId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("report_delivery_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("report_id", reportId)
    .order("generated_at", { ascending: false });
  if (error) {
    console.error("[reports.delivery-snapshots] fetch-for-report-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows = (data as unknown as DbReportDeliverySnapshotRow[]) ?? [];
  return rows.map(mapReportDeliverySnapshotRow);
}

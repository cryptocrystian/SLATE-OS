import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "./mappers";
import { mapProposalDeliverySnapshotRow } from "./delivery-snapshot-mappers";
import type {
  DbProposalDeliverySnapshotRow,
  ProposalDeliverySnapshot,
} from "./delivery-snapshot-types";

/**
 * Phase 1B Proposal/SOW Delivery Sprint P2 — server-only query layer
 * for proposal delivery snapshots. RLS gates every read; the policy
 * from migration 0015 is the boundary. No service-role calls — the
 * public `/p/[token]` route is Sprint P5 scope and will introduce its
 * own privileged-path helpers under `lib/proposals/share-token-public.ts`.
 */

const SNAPSHOT_SELECT = `
  id,
  workspace_id,
  engagement_id,
  proposal_id,
  status,
  delivery_surface,
  proposal_status_at_generation,
  generated_by,
  generated_by_label,
  generated_at,
  option_snapshot,
  source_context_snapshot,
  commercial_guard_result,
  omitted_content,
  draft_watermark,
  approval_state,
  pricing_review_state,
  selected_option_ids,
  artifact_path,
  artifact_mime_type,
  artifact_size_bytes,
  app_version,
  commit_sha,
  voided_at,
  voided_by,
  void_reason,
  created_at,
  updated_at
` as const;

export async function getProposalDeliverySnapshotById(
  snapshotId: string,
): Promise<ProposalDeliverySnapshot | null> {
  if (!isUuid(snapshotId)) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("proposal_delivery_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("id", snapshotId)
    .maybeSingle();
  if (error) {
    console.error("[proposals.delivery-snapshots] fetch-by-id-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return null;
  }
  if (!data) return null;
  return mapProposalDeliverySnapshotRow(
    data as unknown as DbProposalDeliverySnapshotRow,
  );
}

export async function getProposalDeliverySnapshotsForProposal(
  proposalId: string,
): Promise<ProposalDeliverySnapshot[]> {
  if (!isUuid(proposalId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("proposal_delivery_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("proposal_id", proposalId)
    .order("generated_at", { ascending: false });
  if (error) {
    console.error("[proposals.delivery-snapshots] fetch-for-proposal-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows = (data as unknown as DbProposalDeliverySnapshotRow[]) ?? [];
  return rows.map(mapProposalDeliverySnapshotRow);
}

export async function getLatestProposalDeliverySnapshotForProposal(
  proposalId: string,
): Promise<ProposalDeliverySnapshot | null> {
  if (!isUuid(proposalId)) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("proposal_delivery_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("proposal_id", proposalId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error(
      "[proposals.delivery-snapshots] fetch-latest-for-proposal-failed",
      {
        name: error.name,
        code: error.code,
        message: error.message,
      },
    );
    return null;
  }
  if (!data) return null;
  return mapProposalDeliverySnapshotRow(
    data as unknown as DbProposalDeliverySnapshotRow,
  );
}

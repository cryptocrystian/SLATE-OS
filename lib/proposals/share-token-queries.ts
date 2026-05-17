import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "./mappers";
import { mapProposalShareTokenRow } from "./share-token-mappers";
import type {
  DbProposalShareTokenRow,
  ProposalShareToken,
} from "./share-token-types";

/**
 * Phase 1B Proposal/SOW Delivery Sprint P4 — server-only query layer
 * for proposal share tokens. RLS gates every read; the policy from
 * migration 0016 is the boundary.
 *
 * No public-route handler is wired in this sprint; readers here are
 * operator-side audit surfaces (Past Proposal Candidates panel,
 * activity feed decoration, future revocation UI).
 */

const SHARE_TOKEN_SELECT = `
  id,
  workspace_id,
  engagement_id,
  proposal_id,
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

export async function getProposalShareTokensForSnapshot(
  snapshotId: string,
): Promise<ProposalShareToken[]> {
  if (!isUuid(snapshotId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("proposal_share_tokens")
    .select(SHARE_TOKEN_SELECT)
    .eq("snapshot_id", snapshotId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[proposals.share-tokens] fetch-for-snapshot-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows = (data as unknown as DbProposalShareTokenRow[]) ?? [];
  return rows.map(mapProposalShareTokenRow);
}

export async function getProposalShareTokensForProposal(
  proposalId: string,
): Promise<ProposalShareToken[]> {
  if (!isUuid(proposalId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("proposal_share_tokens")
    .select(SHARE_TOKEN_SELECT)
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[proposals.share-tokens] fetch-for-proposal-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows = (data as unknown as DbProposalShareTokenRow[]) ?? [];
  return rows.map(mapProposalShareTokenRow);
}

export async function getProposalShareTokenById(
  tokenId: string,
): Promise<ProposalShareToken | null> {
  if (!isUuid(tokenId)) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("proposal_share_tokens")
    .select(SHARE_TOKEN_SELECT)
    .eq("id", tokenId)
    .maybeSingle();
  if (error) {
    console.error("[proposals.share-tokens] fetch-by-id-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return null;
  }
  if (!data) return null;
  return mapProposalShareTokenRow(
    data as unknown as DbProposalShareTokenRow,
  );
}

export async function countActiveProposalShareTokensForSnapshot(
  snapshotId: string,
): Promise<number> {
  if (!isUuid(snapshotId)) return 0;
  const supabase = createSupabaseServerClient();
  const { count, error } = await supabase
    .from("proposal_share_tokens")
    .select("id", { count: "exact", head: true })
    .eq("snapshot_id", snapshotId)
    .eq("status", "active");
  if (error) {
    console.error("[proposals.share-tokens] count-active-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return 0;
  }
  return count ?? 0;
}

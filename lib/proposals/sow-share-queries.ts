import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "./mappers";
import { mapSowShareTokenRow } from "./sow-share-mappers";
import type { DbSowShareTokenRow, SowShareToken } from "./sow-share-types";

/**
 * Phase 1B SOW Share Route Sprint P7-B — server-only query layer for SOW
 * share tokens. RLS (migration 0021) gates every read; readers here are
 * operator-side audit surfaces (Past SOW Drafts panel, activity feed).
 * Mirrors `share-token-queries.ts`.
 */

const SOW_SHARE_TOKEN_SELECT = `
  id,
  workspace_id,
  engagement_id,
  proposal_id,
  snapshot_id,
  source_proposal_snapshot_id,
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

export async function getSowShareTokensForSnapshot(
  snapshotId: string,
): Promise<SowShareToken[]> {
  if (!isUuid(snapshotId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sow_share_tokens")
    .select(SOW_SHARE_TOKEN_SELECT)
    .eq("snapshot_id", snapshotId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[proposals.sow-share-tokens] fetch-for-snapshot-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows = (data as unknown as DbSowShareTokenRow[]) ?? [];
  return rows.map(mapSowShareTokenRow);
}

export async function getSowShareTokensForProposal(
  proposalId: string,
): Promise<SowShareToken[]> {
  if (!isUuid(proposalId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sow_share_tokens")
    .select(SOW_SHARE_TOKEN_SELECT)
    .eq("proposal_id", proposalId)
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[proposals.sow-share-tokens] fetch-for-proposal-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows = (data as unknown as DbSowShareTokenRow[]) ?? [];
  return rows.map(mapSowShareTokenRow);
}

export async function getSowShareTokenById(
  tokenId: string,
): Promise<SowShareToken | null> {
  if (!isUuid(tokenId)) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("sow_share_tokens")
    .select(SOW_SHARE_TOKEN_SELECT)
    .eq("id", tokenId)
    .maybeSingle();
  if (error) {
    console.error("[proposals.sow-share-tokens] fetch-by-id-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return null;
  }
  if (!data) return null;
  return mapSowShareTokenRow(data as unknown as DbSowShareTokenRow);
}

export async function countActiveSowShareTokensForSnapshot(
  snapshotId: string,
): Promise<number> {
  if (!isUuid(snapshotId)) return 0;
  const supabase = createSupabaseServerClient();
  const { count, error } = await supabase
    .from("sow_share_tokens")
    .select("id", { count: "exact", head: true })
    .eq("snapshot_id", snapshotId)
    .eq("status", "active");
  if (error) {
    console.error("[proposals.sow-share-tokens] count-active-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return 0;
  }
  return count ?? 0;
}

import type {
  DbSowShareTokenRow,
  SowShareToken,
  SowShareTokenStatus,
} from "./sow-share-types";

/**
 * Phase 1B SOW Share Route Sprint P7-B — DB row → TS mappers for SOW
 * share tokens. Malformed `metadata` coerces to `{}`; unknown status
 * strings fall back to `"expired"` (safest closed state). Mirrors
 * `share-token-mappers.ts`.
 *
 * Pure module — no React, no DB, no I/O.
 */

const VALID_STATUSES: ReadonlyArray<SowShareTokenStatus> = [
  "active",
  "revoked",
  "expired",
];

function asStatus(v: string): SowShareTokenStatus {
  return (VALID_STATUSES as ReadonlyArray<string>).includes(v)
    ? (v as SowShareTokenStatus)
    : "expired";
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

export function mapSowShareTokenRow(row: DbSowShareTokenRow): SowShareToken {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    engagementId: row.engagement_id,
    proposalId: row.proposal_id,
    snapshotId: row.snapshot_id,
    sourceProposalSnapshotId: row.source_proposal_snapshot_id,
    tokenHash: row.token_hash,
    status: asStatus(row.status),
    audienceLabel: row.audience_label,
    recipientEmailHash: row.recipient_email_hash,
    expiresAt: row.expires_at,
    createdByUserId: row.created_by,
    createdByLabel: row.created_by_label,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    revokedByUserId: row.revoked_by,
    revokeReason: row.revoke_reason,
    lastAccessedAt: row.last_accessed_at,
    accessCount: asNumber(row.access_count, 0),
    metadata: asObject(row.metadata),
    updatedAt: row.updated_at,
  };
}

import type {
  DbProposalShareTokenRow,
  ProposalShareToken,
  ProposalShareTokenStatus,
} from "./share-token-types";

/**
 * Phase 1B Proposal/SOW Delivery Sprint P4 — DB row → TS shape mappers
 * for proposal share tokens. The jsonb `metadata` column is defensively
 * coerced to an empty object on malformed payloads. Status strings
 * outside the canonical set fall back to `"expired"` (the safest closed
 * state — same defensive default the report-side mapper uses).
 *
 * Pure module — no React, no DB, no I/O.
 */

const VALID_STATUSES: ReadonlyArray<ProposalShareTokenStatus> = [
  "active",
  "revoked",
  "expired",
];

function asStatus(v: string): ProposalShareTokenStatus {
  return (VALID_STATUSES as ReadonlyArray<string>).includes(v)
    ? (v as ProposalShareTokenStatus)
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

export function mapProposalShareTokenRow(
  row: DbProposalShareTokenRow,
): ProposalShareToken {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    engagementId: row.engagement_id,
    proposalId: row.proposal_id,
    snapshotId: row.snapshot_id,
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

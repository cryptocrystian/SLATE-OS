/**
 * Phase 1B SOW Share Route Sprint P7-B — SOW share-token TypeScript
 * shapes. Mirrors `public.sow_share_tokens` (migration
 * `0021_sow_share_tokens.sql`).
 *
 * Deliberately a separate module set from `share-token-*.ts` (proposal
 * lane) per `docs/28` § 3 — the SOW lane carries the highest legal
 * weight, so its eligibility, cascade, and audit vocabulary evolve
 * independently.
 *
 * Runtime token helpers are shared from `lib/reports/share-token-service.ts`
 * (pure Node-crypto wrappers). Pure module — no React, no DB, no I/O.
 */

export type SowShareTokenStatus = "active" | "revoked" | "expired";

export interface SowShareToken {
  id: string;
  workspaceId: string;
  engagementId: string;
  proposalId: string;
  snapshotId: string;
  /**
   * Denormalised source Proposal Candidate snapshot id — drives the
   * source-proposal-void cascade (`docs/28` § 8) and the mint-time
   * source-approval check (`docs/28` § 5 criterion 4).
   */
  sourceProposalSnapshotId: string | null;

  tokenHash: string;
  status: SowShareTokenStatus;

  /** Mandatory on the SOW lane (`docs/28` § 7). Never rendered publicly. */
  audienceLabel: string | null;
  recipientEmailHash: string | null;

  expiresAt: string;
  createdByUserId: string | null;
  createdByLabel: string | null;
  createdAt: string;

  revokedAt: string | null;
  revokedByUserId: string | null;
  revokeReason: string | null;

  lastAccessedAt: string | null;
  accessCount: number;

  metadata: Record<string, unknown>;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// DB row shape — exact column names from migration 0021
// ---------------------------------------------------------------------------

export interface DbSowShareTokenRow {
  id: string;
  workspace_id: string;
  engagement_id: string;
  proposal_id: string;
  snapshot_id: string;
  source_proposal_snapshot_id: string | null;
  token_hash: string;
  status: string;
  audience_label: string | null;
  recipient_email_hash: string | null;
  expires_at: string;
  created_by: string | null;
  created_by_label: string | null;
  created_at: string;
  revoked_at: string | null;
  revoked_by: string | null;
  revoke_reason: string | null;
  last_accessed_at: string | null;
  access_count: number;
  metadata: unknown;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Eligibility evaluator result
// ---------------------------------------------------------------------------

export type SowShareEligibilityReasonCode =
  | "snapshot_not_sow_draft"
  | "snapshot_voided"
  | "snapshot_not_approved"
  | "source_proposal_not_approved"
  | "commercial_guard_failed"
  | "group_b_block_violation"
  | "no_included_options"
  | "snapshot_too_old";

export interface SowShareEligibilityReason {
  code: SowShareEligibilityReasonCode;
  operatorFacingNote: string;
}

export interface SowShareEligibility {
  eligible: boolean;
  reasons: SowShareEligibilityReason[];
  evaluatedAt: string;
}

// ---------------------------------------------------------------------------
// Policy constants — inherit the report/proposal 14-day default / 30-day
// max (`docs/28` § 5 criterion 6).
// ---------------------------------------------------------------------------

/** Default expiry window for newly-minted SOW share tokens. */
export const DEFAULT_SOW_SHARE_TOKEN_EXPIRY_DAYS = 14;
/** Hard maximum expiry window. */
export const MAX_SOW_SHARE_TOKEN_EXPIRY_DAYS = 30;
/** Snapshot age threshold for share eligibility. */
export const MAX_SOW_SNAPSHOT_AGE_DAYS_FOR_SHARE = 14;

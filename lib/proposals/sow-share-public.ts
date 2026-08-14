import "server-only";

import { logActivityEvent } from "@/lib/activity/log";
import { hashShareToken } from "@/lib/reports/share-token-service";
import {
  hashAccessFingerprint,
  type ShareTokenAccessFingerprint,
} from "@/lib/share-tokens/access-signature";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

import { mapProposalDeliverySnapshotRow } from "./delivery-snapshot-mappers";
import type {
  DbProposalDeliverySnapshotRow,
  ProposalDeliverySnapshot,
} from "./delivery-snapshot-types";
import { evaluateSowShareEligibility } from "./sow-share-eligibility";
import { mapSowShareTokenRow } from "./sow-share-mappers";
import type { DbSowShareTokenRow, SowShareToken } from "./sow-share-types";

/**
 * Phase 1B SOW Share Route Sprint P7-B — public-route helpers for
 * `/s/[token]`. Mirrors `share-token-public.ts` (proposal lane) with the
 * SOW-specific source-proposal re-check.
 *
 * The public route is anonymous. RLS on `sow_share_tokens` is
 * operator-full; anonymous reads return zero rows. All lookups use the
 * service-role client and run inside server components only.
 *
 * Generic-rejection rule: every blocked state — unknown token, revoked,
 * expired, voided snapshot, ineligible snapshot — surfaces a distinct
 * internal `status` for server-side logging, but the route MUST render an
 * identical "unavailable" page for all of them.
 *
 * No raw token / token_hash logged. Access fingerprints peppered via
 * `SLATE_SHARE_TOKEN_ACCESS_PEPPER` (omitted when unset).
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

// ---------------------------------------------------------------------------
// Token lookup
// ---------------------------------------------------------------------------

export interface SowShareTokenLookupResult {
  token: SowShareToken;
  snapshot: ProposalDeliverySnapshot;
  /**
   * The source Proposal Candidate snapshot the SOW was derived from,
   * fetched via `token.sourceProposalSnapshotId`. Null when the id is
   * absent (legacy token) or the row is gone — the access evaluator
   * treats a null source as "source not approved" (fail closed).
   */
  sourceProposalSnapshot: ProposalDeliverySnapshot | null;
}

export async function lookupSowShareTokenByRawToken(
  rawToken: string,
): Promise<SowShareTokenLookupResult | null> {
  if (!isPlausibleRawToken(rawToken)) return null;

  const supabase = createSupabaseServiceClient();
  const tokenHash = hashShareToken(rawToken);

  const { data: tokenData, error: tokenError } = await supabase
    .from("sow_share_tokens")
    .select(SOW_SHARE_TOKEN_SELECT)
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (tokenError) {
    console.error("[proposals.sow-share-tokens.public] lookup-failed", {
      name: tokenError.name,
      code: tokenError.code,
      message: tokenError.message,
    });
    return null;
  }
  if (!tokenData) return null;
  const token = mapSowShareTokenRow(tokenData as unknown as DbSowShareTokenRow);

  const { data: snapshotData, error: snapshotError } = await supabase
    .from("proposal_delivery_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("id", token.snapshotId)
    .maybeSingle();
  if (snapshotError) {
    console.error(
      "[proposals.sow-share-tokens.public] snapshot-fetch-failed",
      {
        name: snapshotError.name,
        code: snapshotError.code,
        message: snapshotError.message,
      },
    );
    return null;
  }
  if (!snapshotData) return null;
  const snapshot = mapProposalDeliverySnapshotRow(
    snapshotData as unknown as DbProposalDeliverySnapshotRow,
  );

  // Fetch the source Proposal Candidate for the render-time
  // source-approved re-check (docs/28 § 5 criterion 4 defense-in-depth).
  let sourceProposalSnapshot: ProposalDeliverySnapshot | null = null;
  if (token.sourceProposalSnapshotId) {
    const { data: srcData, error: srcError } = await supabase
      .from("proposal_delivery_snapshots")
      .select(SNAPSHOT_SELECT)
      .eq("id", token.sourceProposalSnapshotId)
      .maybeSingle();
    if (srcError) {
      console.error(
        "[proposals.sow-share-tokens.public] source-fetch-failed",
        {
          name: srcError.name,
          code: srcError.code,
          message: srcError.message,
        },
      );
      // Leave sourceProposalSnapshot null → treated as not approved.
    } else if (srcData) {
      sourceProposalSnapshot = mapProposalDeliverySnapshotRow(
        srcData as unknown as DbProposalDeliverySnapshotRow,
      );
    }
  }

  return { token, snapshot, sourceProposalSnapshot };
}

// ---------------------------------------------------------------------------
// Access evaluation
// ---------------------------------------------------------------------------

export type SowShareTokenPublicAccessStatus =
  | "allowed"
  | "not_found"
  | "revoked"
  | "expired"
  | "snapshot_voided"
  | "snapshot_ineligible";

export interface SowShareTokenPublicAccessResult {
  status: SowShareTokenPublicAccessStatus;
  shouldFlipExpired?: boolean;
  /** Internal-only reason code. NEVER surfaced to the public route. */
  reason?: string;
}

export function evaluateSowShareTokenPublicAccess(
  lookup: SowShareTokenLookupResult | null,
  now: Date = new Date(),
): SowShareTokenPublicAccessResult {
  if (!lookup) {
    return { status: "not_found" };
  }
  const { token, snapshot, sourceProposalSnapshot } = lookup;

  if (token.snapshotId !== snapshot.id) {
    return { status: "not_found", reason: "token_snapshot_mismatch" };
  }

  if (token.status === "revoked") {
    return { status: "revoked" };
  }

  const expiry = new Date(token.expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    return { status: "expired", reason: "expires_at_unparseable" };
  }
  const isExpired = expiry.getTime() <= now.getTime();
  if (token.status === "expired" || isExpired) {
    return {
      status: "expired",
      shouldFlipExpired: token.status === "active" && isExpired,
    };
  }

  if (snapshot.status === "voided") {
    return { status: "snapshot_voided" };
  }

  // Source-approved re-check: the source Proposal Candidate must exist,
  // be approved, and not be voided. Cascade-revoke (docs/28 § 8) already
  // flips the token to revoked when the source is voided; this is the
  // belt-and-braces render-time check per docs/28 § 5 criterion 4.
  const sourceProposalApproved =
    sourceProposalSnapshot !== null &&
    sourceProposalSnapshot.status !== "voided" &&
    sourceProposalSnapshot.approvalState === "approved";

  const eligibility = evaluateSowShareEligibility(snapshot, {
    sourceProposalApproved,
    now,
  });
  if (!eligibility.eligible) {
    return {
      status: "snapshot_ineligible",
      reason: eligibility.reasons.map((r) => r.code).join(","),
    };
  }

  return { status: "allowed" };
}

// ---------------------------------------------------------------------------
// Expiry status flip
// ---------------------------------------------------------------------------

export async function flipSowShareTokenExpired(
  tokenId: string,
): Promise<"expired" | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("sow_share_tokens")
    .update({ status: "expired" })
    .eq("id", tokenId)
    .eq("status", "active")
    .select("id, engagement_id, proposal_id, snapshot_id")
    .maybeSingle<{
      id: string;
      engagement_id: string;
      proposal_id: string;
      snapshot_id: string;
    }>();
  if (error) {
    console.error("[proposals.sow-share-tokens.public] flip-expired-failed", {
      tokenId,
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return null;
  }
  if (!data?.id) return null;

  await logActivityEvent(
    {
      eventType: "sow_share_token_expired",
      entityType: "sow_share_token",
      entityId: tokenId,
      engagementId: data.engagement_id,
      title: "SOW share token expired",
      summary:
        "SOW share token expired at render time. SLATE flipped its status to `expired` and rendered the generic unavailable page.",
      metadata: {
        flippedAt: new Date().toISOString(),
        proposalId: data.proposal_id,
        snapshotId: data.snapshot_id,
      },
    },
    { viaServiceRole: true },
  );

  return "expired";
}

// ---------------------------------------------------------------------------
// Access recording
// ---------------------------------------------------------------------------

export interface SowShareTokenAccessMetadata {
  ip?: string | null;
  userAgent?: string | null;
}

/** 5-minute debounce window (Sprint H1 semantics). */
const ACCESS_LOG_DEBOUNCE_MS = 5 * 60 * 1000;

export async function recordSowShareTokenAccess(
  tokenId: string,
  meta: SowShareTokenAccessMetadata = {},
): Promise<void> {
  const supabase = createSupabaseServiceClient();

  const accessedAt = new Date().toISOString();
  const fingerprint = hashAccessFingerprint({
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  const { data: existing, error: readError } = await supabase
    .from("sow_share_tokens")
    .select(
      "id, engagement_id, proposal_id, snapshot_id, access_count, last_accessed_at, metadata",
    )
    .eq("id", tokenId)
    .maybeSingle<{
      id: string;
      engagement_id: string;
      proposal_id: string;
      snapshot_id: string;
      access_count: number;
      last_accessed_at: string | null;
      metadata: Record<string, unknown> | null;
    }>();
  if (readError || !existing?.id) {
    if (readError) {
      console.error("[proposals.sow-share-tokens.public] access-read-failed", {
        tokenId,
        name: readError.name,
        code: readError.code,
        message: readError.message,
      });
    }
    return;
  }

  if (
    fingerprint.combinedSig &&
    isWithinDebounceWindow(
      existing.metadata,
      fingerprint.combinedSig,
      accessedAt,
    )
  ) {
    return;
  }

  const nextCount = (existing.access_count ?? 0) + 1;
  const nextMetadata = mergeDebounceSignature(
    existing.metadata,
    fingerprint.combinedSig,
    accessedAt,
  );

  const { error: updateError } = await supabase
    .from("sow_share_tokens")
    .update({
      access_count: nextCount,
      last_accessed_at: accessedAt,
      metadata: nextMetadata,
    })
    .eq("id", tokenId);
  if (updateError) {
    console.error("[proposals.sow-share-tokens.public] access-update-failed", {
      tokenId,
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
  }

  await logActivityEvent(
    {
      eventType: "sow_share_token_accessed",
      entityType: "sow_share_token",
      entityId: tokenId,
      engagementId: existing.engagement_id,
      title: "SOW share token accessed",
      summary:
        "Public SOW share link rendered. SLATE recorded an access event with peppered request fingerprints only.",
      metadata: buildAccessActivityMetadata(
        accessedAt,
        nextCount,
        fingerprint,
        existing.proposal_id,
        existing.snapshot_id,
      ),
    },
    { viaServiceRole: true },
  );
}

function buildAccessActivityMetadata(
  accessedAt: string,
  accessCount: number,
  fingerprint: ShareTokenAccessFingerprint,
  proposalId: string,
  snapshotId: string,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    accessedAt,
    accessCount,
    proposalId,
    snapshotId,
  };
  if (fingerprint.uaHash) base.uaSig = fingerprint.uaHash;
  if (fingerprint.ipHash) base.ipSig = fingerprint.ipHash;
  if (fingerprint.hashesOmitted) base.hashesOmitted = true;
  return base;
}

function isWithinDebounceWindow(
  rawMetadata: Record<string, unknown> | null,
  signature: string,
  nowIso: string,
): boolean {
  if (!rawMetadata || typeof rawMetadata !== "object") return false;
  const meta = rawMetadata as {
    lastAccessSig?: unknown;
    lastAccessSigAt?: unknown;
  };
  if (typeof meta.lastAccessSig !== "string" || meta.lastAccessSig.length === 0)
    return false;
  if (
    typeof meta.lastAccessSigAt !== "string" ||
    meta.lastAccessSigAt.length === 0
  )
    return false;
  if (meta.lastAccessSig !== signature) return false;
  const last = new Date(meta.lastAccessSigAt).getTime();
  const now = new Date(nowIso).getTime();
  if (!Number.isFinite(last) || !Number.isFinite(now)) return false;
  return now - last < ACCESS_LOG_DEBOUNCE_MS;
}

function mergeDebounceSignature(
  rawMetadata: Record<string, unknown> | null,
  signature: string | null,
  nowIso: string,
): Record<string, unknown> {
  const base =
    rawMetadata && typeof rawMetadata === "object"
      ? { ...(rawMetadata as Record<string, unknown>) }
      : {};
  if (signature) {
    base.lastAccessSig = signature;
    base.lastAccessSigAt = nowIso;
  } else {
    delete base.lastAccessSig;
    delete base.lastAccessSigAt;
  }
  return base;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isPlausibleRawToken(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  if (raw.length < 16 || raw.length > 256) return false;
  return /^[A-Za-z0-9_-]+$/.test(raw);
}

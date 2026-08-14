"use server";

import { revalidatePath } from "next/cache";

import { logActivityEvent } from "@/lib/activity/log";
import {
  calculateShareTokenExpiry,
  generateRawShareToken,
  hashRecipientEmail,
  hashShareToken,
  isExpiryWithinPolicy,
} from "@/lib/reports/share-token-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadPreDeliveryAudit } from "@/lib/engagement-readiness/pre-delivery-audit-loader";
import type { PreDeliveryReason } from "@/lib/engagement-readiness/pre-delivery-audit";

import { mapProposalDeliverySnapshotRow } from "./delivery-snapshot-mappers";
import type { DbProposalDeliverySnapshotRow } from "./delivery-snapshot-types";
import { isUuid } from "./mappers";
import { evaluateSowShareEligibility } from "./sow-share-eligibility";
import {
  DEFAULT_SOW_SHARE_TOKEN_EXPIRY_DAYS,
  MAX_SOW_SHARE_TOKEN_EXPIRY_DAYS,
} from "./sow-share-types";

/**
 * Phase 1B SOW Share Route Sprint P7-B — operator-only SOW share-link
 * generation, revocation, and cascade helpers. Mirrors
 * `share-token-actions.ts` (proposal lane) with the SOW-lane hard rules
 * from `docs/28` + `docs/65`:
 *
 *   - Audience label is MANDATORY (docs/28 § 7). The action rejects an
 *     empty label; the mint UI additionally enforces it, and the DB
 *     column is NOT NULL.
 *   - The source Proposal Candidate must be approved and not voided
 *     (docs/28 § 5 criterion 4). Fails closed.
 *   - The SOW Draft snapshot must pass `evaluateSowShareEligibility`
 *     (surface, approval, guard, group-B, options, freshness).
 *   - Pre-delivery audit runs on the `sow` surface before any token
 *     side-effect (docs/65 § 4.6).
 *   - Only the SHA-256 hash is persisted; the raw token is returned to
 *     the operator exactly once. SLATE never sends it (Option A,
 *     docs/29) — the operator copies `/s/<rawToken>` and hand-delivers.
 *   - No signatory identity is ever collected.
 */

export type GenerateSowShareLinkError =
  | "unauthenticated"
  | "invalid-snapshot"
  | "snapshot-not-found"
  | "audience-label-required"
  | "snapshot-not-eligible"
  | "pre-delivery-audit-blocked"
  | "invalid-expiry"
  | "service-error";

export interface GenerateSowShareLinkSuccess {
  ok: true;
  tokenId: string;
  /** The raw token — surfaced once via the return value; never persisted. */
  rawToken: string;
  /** `/s/<rawToken>` path for the operator to copy and hand-deliver. */
  shareUrlPath: string;
  expiresAt: string;
  snapshotId: string;
}

export interface GenerateSowShareLinkFailure {
  ok: false;
  error: GenerateSowShareLinkError;
  ineligibilityReasons?: ReadonlyArray<{ code: string; note: string }>;
  preDeliveryAuditReasons?: ReadonlyArray<PreDeliveryReason>;
}

export type GenerateSowShareLinkResult =
  | GenerateSowShareLinkSuccess
  | GenerateSowShareLinkFailure;

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

function resolveSowShareTokenExpiry(args: {
  expiryDays?: number;
  expiryMinutes?: number;
}): string {
  const allowDevExpiry =
    process.env.NODE_ENV !== "production" ||
    process.env.SLATE_SHARE_TOKEN_ALLOW_DEV_EXPIRY === "true";
  if (
    allowDevExpiry &&
    typeof args.expiryMinutes === "number" &&
    Number.isFinite(args.expiryMinutes) &&
    args.expiryMinutes > 0 &&
    args.expiryMinutes <= 60 * 24 * MAX_SOW_SHARE_TOKEN_EXPIRY_DAYS
  ) {
    const ms = args.expiryMinutes * 60 * 1000;
    return new Date(Date.now() + ms).toISOString();
  }
  return calculateShareTokenExpiry({ days: args.expiryDays });
}

/** Read the source Proposal Candidate snapshot id from the raw jsonb. */
function readSowSourceProposalSnapshotId(
  rawSourceContext: unknown,
): string | null {
  if (!rawSourceContext || typeof rawSourceContext !== "object") return null;
  const v = (rawSourceContext as { sowSourceProposalSnapshotId?: unknown })
    .sowSourceProposalSnapshotId;
  return typeof v === "string" && isUuid(v) ? v : null;
}

export async function generateSowShareLinkAction(args: {
  snapshotId: string;
  audienceLabel: string;
  recipientEmail?: string;
  expiryDays?: number;
  /** Dev-only override; production runtimes ignore it. */
  expiryMinutes?: number;
}): Promise<GenerateSowShareLinkResult> {
  const { snapshotId } = args;
  if (!isUuid(snapshotId)) {
    return { ok: false, error: "invalid-snapshot" };
  }

  // Audience label is mandatory on the SOW lane (docs/28 § 7). Reject
  // before any DB work.
  const audienceLabel = sanitizeAudienceLabel(args.audienceLabel);
  if (!audienceLabel) {
    return { ok: false, error: "audience-label-required" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: row, error: fetchError } = await supabase
    .from("proposal_delivery_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("id", snapshotId)
    .maybeSingle();
  if (fetchError) {
    console.error("[proposals.sow-share-tokens] snapshot-fetch-failed", {
      name: fetchError.name,
      code: fetchError.code,
      message: fetchError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!row) {
    return { ok: false, error: "snapshot-not-found" };
  }

  const snapshot = mapProposalDeliverySnapshotRow(
    row as unknown as DbProposalDeliverySnapshotRow,
  );

  // Resolve the source Proposal Candidate (docs/28 § 5 criterion 4).
  // Read the id from the raw jsonb (the typed mapper drops it), then
  // fetch the source snapshot to confirm it is approved + not voided.
  const sourceProposalSnapshotId = readSowSourceProposalSnapshotId(
    (row as unknown as { source_context_snapshot?: unknown })
      .source_context_snapshot,
  );
  let sourceProposalApproved = false;
  if (sourceProposalSnapshotId) {
    const { data: srcRow, error: srcErr } = await supabase
      .from("proposal_delivery_snapshots")
      .select("id, status, approval_state, delivery_surface")
      .eq("id", sourceProposalSnapshotId)
      .maybeSingle<{
        id: string;
        status: string;
        approval_state: string;
        delivery_surface: string;
      }>();
    if (srcErr) {
      console.error("[proposals.sow-share-tokens] source-fetch-failed", {
        name: srcErr.name,
        code: srcErr.code,
        message: srcErr.message,
      });
      return { ok: false, error: "service-error" };
    }
    sourceProposalApproved =
      !!srcRow?.id &&
      srcRow.status !== "voided" &&
      srcRow.approval_state === "approved" &&
      srcRow.delivery_surface === "client_proposal_candidate";
  }

  // Pre-delivery audit on the sow surface (docs/65 § 4.6). Refuses the
  // mint before any token side-effect.
  const audit = await loadPreDeliveryAudit(snapshot.engagementId, {
    surface: "sow",
    audienceLabel,
  });
  if (!audit.ready) {
    await logActivityEvent({
      eventType: "pre_delivery_audit_blocked",
      entityType: "engagement",
      entityId: snapshot.engagementId,
      engagementId: snapshot.engagementId,
      title: "SOW share mint blocked by pre-delivery audit",
      summary:
        "Pre-delivery audit refused a SOW share-token mint attempt. No token was created.",
      metadata: {
        surface: "sow",
        ready: false,
        severity: audit.severity,
        snapshotId: snapshot.id,
        blockingReasonCodes: audit.blockingReasons.map((r) => r.code),
        warningCodes: audit.warnings.map((r) => r.code),
        blockingReasonCount: audit.blockingReasons.length,
        evaluatedAt: audit.evaluatedAt,
        audienceLabelPresent: true,
      },
    });
    return {
      ok: false,
      error: "pre-delivery-audit-blocked",
      preDeliveryAuditReasons: audit.blockingReasons,
    };
  }

  const eligibility = evaluateSowShareEligibility(snapshot, {
    sourceProposalApproved,
  });
  if (!eligibility.eligible) {
    return {
      ok: false,
      error: "snapshot-not-eligible",
      ineligibilityReasons: eligibility.reasons.map((r) => ({
        code: r.code,
        note: r.operatorFacingNote,
      })),
    };
  }

  const expiresAt = resolveSowShareTokenExpiry({
    expiryDays: args.expiryDays,
    expiryMinutes: args.expiryMinutes,
  });
  if (
    !isExpiryWithinPolicy(expiresAt, {
      maxDays: MAX_SOW_SHARE_TOKEN_EXPIRY_DAYS,
    })
  ) {
    return { ok: false, error: "invalid-expiry" };
  }

  const rawToken = generateRawShareToken();
  const tokenHash = hashShareToken(rawToken);
  const recipientEmailHash = args.recipientEmail
    ? hashRecipientEmail(args.recipientEmail)
    : null;
  const operatorLabel = buildOperatorLabel(user);

  const { data: tokenRow, error: insertError } = await supabase
    .from("sow_share_tokens")
    .insert({
      workspace_id: snapshot.workspaceId,
      engagement_id: snapshot.engagementId,
      proposal_id: snapshot.proposalId,
      snapshot_id: snapshot.id,
      source_proposal_snapshot_id: sourceProposalSnapshotId,
      token_hash: tokenHash,
      status: "active",
      audience_label: audienceLabel,
      recipient_email_hash: recipientEmailHash,
      expires_at: expiresAt,
      created_by: user.id,
      created_by_label: operatorLabel,
      metadata: {
        tokenVersion: 1,
        urlShape: "/s/[token]",
        channel: "operator_mediated_copy_link",
        createdFromSnapshotStatus: snapshot.status,
        createdFromApprovalState: snapshot.approvalState,
        expiresPolicyDays:
          args.expiryDays ?? DEFAULT_SOW_SHARE_TOKEN_EXPIRY_DAYS,
      },
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !tokenRow?.id) {
    console.error("[proposals.sow-share-tokens] token-insert-failed", {
      name: insertError?.name,
      code: insertError?.code,
      message: insertError?.message,
    });
    return { ok: false, error: "service-error" };
  }

  await logActivityEvent({
    eventType: "sow_share_token_created",
    entityType: "sow_share_token",
    entityId: tokenRow.id,
    engagementId: snapshot.engagementId,
    title: "SOW share link created",
    summary:
      "Operator generated a one-time SOW share link. Raw token returned to operator only; never stored in plaintext. SLATE does not deliver the link — the operator copies /s/<token> and hand-delivers it.",
    metadata: {
      snapshotId: snapshot.id,
      proposalId: snapshot.proposalId,
      audienceLabel,
      recipientHashPresent: Boolean(recipientEmailHash),
      expiresAt,
    },
  });

  revalidatePath(`/app/engagements/${snapshot.engagementId}/proposal`);

  return {
    ok: true,
    tokenId: tokenRow.id,
    rawToken,
    shareUrlPath: `/s/${rawToken}`,
    expiresAt,
    snapshotId: snapshot.id,
  };
}

// ---------------------------------------------------------------------------
// Revoke action
// ---------------------------------------------------------------------------

export type RevokeSowShareTokenError =
  | "unauthenticated"
  | "invalid-token"
  | "token-not-found"
  | "already-revoked"
  | "service-error";

export type RevokeSowShareTokenResult =
  | { ok: true; tokenId: string }
  | { ok: false; error: RevokeSowShareTokenError };

const DEFAULT_REVOKE_REASON = "Revoked by operator.";

export async function revokeSowShareTokenAction(args: {
  tokenId: string;
  reason?: string;
}): Promise<RevokeSowShareTokenResult> {
  const { tokenId } = args;
  if (!isUuid(tokenId)) {
    return { ok: false, error: "invalid-token" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: row, error: fetchError } = await supabase
    .from("sow_share_tokens")
    .select("id, engagement_id, proposal_id, snapshot_id, status")
    .eq("id", tokenId)
    .maybeSingle<{
      id: string;
      engagement_id: string;
      proposal_id: string;
      snapshot_id: string;
      status: string;
    }>();
  if (fetchError) {
    console.error("[proposals.sow-share-tokens] revoke-fetch-failed", {
      name: fetchError.name,
      code: fetchError.code,
      message: fetchError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!row?.id) return { ok: false, error: "token-not-found" };
  if (row.status !== "active") {
    return { ok: false, error: "already-revoked" };
  }

  const reason = (args.reason ?? DEFAULT_REVOKE_REASON).trim().slice(0, 280);
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("sow_share_tokens")
    .update({
      status: "revoked",
      revoked_at: now,
      revoked_by: user.id,
      revoke_reason: reason,
    })
    .eq("id", tokenId);
  if (updateError) {
    console.error("[proposals.sow-share-tokens] revoke-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await logActivityEvent({
    eventType: "sow_share_token_revoked",
    entityType: "sow_share_token",
    entityId: tokenId,
    engagementId: row.engagement_id,
    title: "SOW share link revoked",
    summary: "Operator revoked a SOW share link. Subsequent /s access is blocked.",
    metadata: {
      proposalId: row.proposal_id,
      snapshotId: row.snapshot_id,
      reason: reason.slice(0, 120),
    },
  });

  revalidatePath(`/app/engagements/${row.engagement_id}/proposal`);

  return { ok: true, tokenId };
}

// ---------------------------------------------------------------------------
// Cascade-revoke helpers (docs/28 § 8)
//
// Two cascades:
//   1. On SOW-snapshot void — revoke tokens pointing at the voided SOW
//      snapshot (`snapshot_id`).
//   2. On source-Proposal-Candidate void — revoke tokens whose
//      `source_proposal_snapshot_id` matches the voided proposal
//      snapshot. Without this, a voided proposal would leave descendant
//      SOW tokens active (a coherency bug).
//
// Service-internal: cookie-bound client, invoked by the void action.
// ---------------------------------------------------------------------------

export interface CascadeRevokeSowShareTokensResult {
  revokedTokenIds: string[];
  failedTokenIds: string[];
}

async function cascadeRevokeSowShareTokensWhere(args: {
  column: "snapshot_id" | "source_proposal_snapshot_id";
  value: string;
  engagementId: string;
  proposalId: string;
  reason: string;
  cascadeKind: "sow_snapshot_voided" | "source_proposal_voided";
}): Promise<CascadeRevokeSowShareTokensResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { revokedTokenIds: [], failedTokenIds: [] };

  const { data: rows, error: fetchError } = await supabase
    .from("sow_share_tokens")
    .select("id")
    .eq(args.column, args.value)
    .eq("status", "active");
  if (fetchError) {
    console.error("[proposals.sow-share-tokens] cascade-fetch-failed", {
      column: args.column,
      name: fetchError.name,
      code: fetchError.code,
      message: fetchError.message,
    });
    return { revokedTokenIds: [], failedTokenIds: [] };
  }
  const tokenIds = ((rows as Array<{ id: string }> | null) ?? [])
    .map((r) => r.id)
    .filter((id): id is string => typeof id === "string");
  if (tokenIds.length === 0) {
    return { revokedTokenIds: [], failedTokenIds: [] };
  }

  const now = new Date().toISOString();
  const trimmedReason = args.reason.trim().slice(0, 280);
  const { data: updated, error: updateError } = await supabase
    .from("sow_share_tokens")
    .update({
      status: "revoked",
      revoked_at: now,
      revoked_by: user.id,
      revoke_reason: trimmedReason,
    })
    .in("id", tokenIds)
    .eq("status", "active")
    .select("id");
  if (updateError) {
    console.error("[proposals.sow-share-tokens] cascade-update-failed", {
      column: args.column,
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { revokedTokenIds: [], failedTokenIds: tokenIds };
  }
  const revokedIds = ((updated as Array<{ id: string }> | null) ?? [])
    .map((r) => r.id)
    .filter((id): id is string => typeof id === "string");

  for (const id of revokedIds) {
    await logActivityEvent({
      eventType: "sow_share_token_revoked",
      entityType: "sow_share_token",
      entityId: id,
      engagementId: args.engagementId,
      title: "SOW share link revoked",
      summary:
        args.cascadeKind === "source_proposal_voided"
          ? "SOW share link revoked automatically because its source Proposal Candidate was voided."
          : "SOW share link revoked automatically because its backing SOW Draft snapshot was voided.",
      metadata: {
        proposalId: args.proposalId,
        reason: trimmedReason.slice(0, 120),
        cascade: true,
        cascadeKind: args.cascadeKind,
      },
    });
  }

  return {
    revokedTokenIds: revokedIds,
    failedTokenIds: tokenIds.filter((id) => !revokedIds.includes(id)),
  };
}

/** Cascade-revoke SOW tokens when the SOW Draft snapshot itself is voided. */
export async function cascadeRevokeActiveSowShareTokensForSnapshot(args: {
  snapshotId: string;
  engagementId: string;
  proposalId: string;
  reason: string;
}): Promise<CascadeRevokeSowShareTokensResult> {
  return cascadeRevokeSowShareTokensWhere({
    column: "snapshot_id",
    value: args.snapshotId,
    engagementId: args.engagementId,
    proposalId: args.proposalId,
    reason: args.reason,
    cascadeKind: "sow_snapshot_voided",
  });
}

/**
 * Cascade-revoke SOW tokens when the SOURCE Proposal Candidate snapshot
 * is voided (docs/28 § 8). Invoked by the proposal snapshot void action.
 */
export async function cascadeRevokeActiveSowShareTokensForSourceProposal(args: {
  sourceProposalSnapshotId: string;
  engagementId: string;
  proposalId: string;
  reason: string;
}): Promise<CascadeRevokeSowShareTokensResult> {
  return cascadeRevokeSowShareTokensWhere({
    column: "source_proposal_snapshot_id",
    value: args.sourceProposalSnapshotId,
    engagementId: args.engagementId,
    proposalId: args.proposalId,
    reason: args.reason,
    cascadeKind: "source_proposal_voided",
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeAudienceLabel(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
  return cleaned.length > 0 ? cleaned : null;
}

function buildOperatorLabel(user: {
  id: string;
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string | null {
  const metaName =
    typeof user.user_metadata?.display_name === "string"
      ? (user.user_metadata.display_name as string)
      : typeof user.user_metadata?.name === "string"
        ? (user.user_metadata.name as string)
        : null;
  if (metaName && metaName.trim().length > 0) {
    return deriveInitials(metaName.trim());
  }
  if (typeof user.email === "string" && user.email.length > 0) {
    const local = user.email.split("@")[0];
    if (local && local.length > 0) {
      return deriveInitials(local).slice(0, 4);
    }
  }
  return null;
}

function deriveInitials(displayName: string): string {
  const parts = displayName
    .split(/[\s._-]+/)
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length === 0) return displayName.slice(0, 2).toUpperCase();
  return parts
    .slice(0, 3)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

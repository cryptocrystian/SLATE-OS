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

import { mapProposalDeliverySnapshotRow } from "./delivery-snapshot-mappers";
import type { DbProposalDeliverySnapshotRow } from "./delivery-snapshot-types";
import { isUuid } from "./mappers";
import { evaluateProposalShareEligibility } from "./share-token-eligibility";
import { loadPreDeliveryAudit } from "@/lib/engagement-readiness/pre-delivery-audit-loader";
import type { PreDeliveryReason } from "@/lib/engagement-readiness/pre-delivery-audit";
import {
  DEFAULT_PROPOSAL_SHARE_TOKEN_EXPIRY_DAYS,
  MAX_PROPOSAL_SHARE_TOKEN_EXPIRY_DAYS,
} from "./share-token-types";

/**
 * Phase 1B Proposal/SOW Delivery Sprint P4 — operator-only proposal
 * share-link generation + revocation actions.
 *
 * Canon (`docs/24` § Share Token Model Recommendation + § Prepare
 * Client Review Unlock Policy):
 *   - Caller must be authenticated and operate inside the snapshot's
 *     workspace (RLS enforces the boundary; we re-check at action
 *     entry to surface a clean error).
 *   - The snapshot must pass `evaluateProposalShareEligibility`. The
 *     proposal-side gate is stricter than the report-side: the
 *     snapshot must additionally be in `approval_state='approved'`
 *     before a share token can be minted.
 *   - A fresh raw token is generated; the DB persists only its
 *     SHA-256 hash. The raw token is returned to the caller exactly
 *     once via the action's return value. This action MUST NOT log
 *     the raw token to activity, to console.log, to the share-token
 *     row, or to error responses.
 *   - The action does NOT send email, push to CRM, or otherwise
 *     deliver the link. Delivery is the operator's manual step.
 *
 * The runtime token-service helpers (`generateRawShareToken`,
 * `hashShareToken`, etc.) are imported directly from
 * `lib/reports/share-token-service.ts` because they are pure
 * Node-crypto wrappers with no report-domain coupling. Direct reuse is
 * the smallest safe diff per Sprint P4 § Task 2 — extracting them into
 * a shared `lib/share-tokens/` module is a future-sprint concern.
 *
 * No public-route handler is wired in this sprint; the returned
 * `/p/<rawToken>` URL is for the operator to copy and hand-deliver
 * out of band until Sprint P5 lands the public route.
 */

export type GenerateProposalShareLinkError =
  | "unauthenticated"
  | "invalid-snapshot"
  | "snapshot-not-found"
  | "snapshot-not-eligible"
  | "pre-delivery-audit-blocked"
  | "invalid-expiry"
  | "service-error";

export interface GenerateProposalShareLinkSuccess {
  ok: true;
  tokenId: string;
  /**
   * The raw token. Surfaced to the operator exactly once via the
   * server-action return. Never persisted, never re-fetchable.
   */
  rawToken: string;
  /**
   * Pre-built `/p/<rawToken>` URL path the operator can paste
   * directly. The public route lands in Sprint P5; until then the
   * URL is for out-of-band copy only.
   */
  shareUrlPath: string;
  expiresAt: string;
  snapshotId: string;
}

export interface GenerateProposalShareLinkFailure {
  ok: false;
  error: GenerateProposalShareLinkError;
  ineligibilityReasons?: ReadonlyArray<{ code: string; note: string }>;
  /**
   * Sprint S11 — when `error === "pre-delivery-audit-blocked"`, the
   * structured blocking reasons returned by the pre-delivery audit
   * evaluator. The operator UI surfaces these inline.
   */
  preDeliveryAuditReasons?: ReadonlyArray<PreDeliveryReason>;
}

export type GenerateProposalShareLinkResult =
  | GenerateProposalShareLinkSuccess
  | GenerateProposalShareLinkFailure;

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

/**
 * Resolve the proposal share-token expiry timestamp. Mirrors the
 * report-side `resolveShareTokenExpiry` (Sprint H1 dev-only short-
 * expiry affordance). Production callers passing `expiryMinutes` get
 * the parameter silently ignored — the 14d default applies.
 */
function resolveProposalShareTokenExpiry(args: {
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
    args.expiryMinutes <= 60 * 24 * MAX_PROPOSAL_SHARE_TOKEN_EXPIRY_DAYS
  ) {
    const ms = args.expiryMinutes * 60 * 1000;
    return new Date(Date.now() + ms).toISOString();
  }
  return calculateShareTokenExpiry({ days: args.expiryDays });
}

export async function generateProposalShareLinkAction(args: {
  snapshotId: string;
  audienceLabel?: string;
  recipientEmail?: string;
  expiryDays?: number;
  /**
   * Dev-only override — see `resolveProposalShareTokenExpiry` doc
   * block. Production runtimes ignore this parameter.
   */
  expiryMinutes?: number;
}): Promise<GenerateProposalShareLinkResult> {
  const { snapshotId } = args;
  if (!isUuid(snapshotId)) {
    return { ok: false, error: "invalid-snapshot" };
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
    console.error("[proposals.share-tokens] snapshot-fetch-failed", {
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

  // Sprint S11 — pre-delivery audit (code-side enforcement of
  // docs/35 § 5 readiness gate). Refuses the mint before any token /
  // snapshot side-effects; emits a sanitized
  // `pre_delivery_audit_blocked` event with reason codes only.
  const audit = await loadPreDeliveryAudit(snapshot.engagementId, {
    surface: "proposal",
    audienceLabel: args.audienceLabel ?? null,
  });
  if (!audit.ready) {
    await logActivityEvent({
      eventType: "pre_delivery_audit_blocked",
      entityType: "engagement",
      entityId: snapshot.engagementId,
      engagementId: snapshot.engagementId,
      title: "Proposal share mint blocked by pre-delivery audit",
      summary:
        "Pre-delivery audit refused a proposal share-token mint attempt. No token was created.",
      metadata: {
        surface: "proposal",
        ready: false,
        severity: audit.severity,
        snapshotId: snapshot.id,
        blockingReasonCodes: audit.blockingReasons.map((r) => r.code),
        warningCodes: audit.warnings.map((r) => r.code),
        blockingReasonCount: audit.blockingReasons.length,
        evaluatedAt: audit.evaluatedAt,
        audienceLabelPresent: Boolean(args.audienceLabel),
      },
    });
    return {
      ok: false,
      error: "pre-delivery-audit-blocked",
      preDeliveryAuditReasons: audit.blockingReasons,
    };
  }

  const eligibility = evaluateProposalShareEligibility(snapshot);
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

  // Default to 14d, max 30d. The action layer is the single place we
  // enforce expiry policy; the DB only enforces `expires_at > created_at`.
  // Dev-only `expiryMinutes` is resolved before policy validation.
  const expiresAt = resolveProposalShareTokenExpiry({
    expiryDays: args.expiryDays,
    expiryMinutes: args.expiryMinutes,
  });
  if (
    !isExpiryWithinPolicy(expiresAt, {
      maxDays: MAX_PROPOSAL_SHARE_TOKEN_EXPIRY_DAYS,
    })
  ) {
    return { ok: false, error: "invalid-expiry" };
  }

  const rawToken = generateRawShareToken();
  const tokenHash = hashShareToken(rawToken);

  const audienceLabel = sanitizeAudienceLabel(args.audienceLabel);
  const recipientEmailHash = args.recipientEmail
    ? hashRecipientEmail(args.recipientEmail)
    : null;

  const operatorLabel = buildOperatorLabel(user);

  const { data: tokenRow, error: insertError } = await supabase
    .from("proposal_share_tokens")
    .insert({
      workspace_id: snapshot.workspaceId,
      engagement_id: snapshot.engagementId,
      proposal_id: snapshot.proposalId,
      snapshot_id: snapshot.id,
      token_hash: tokenHash,
      status: "active",
      audience_label: audienceLabel,
      recipient_email_hash: recipientEmailHash,
      expires_at: expiresAt,
      created_by: user.id,
      created_by_label: operatorLabel,
      metadata: {
        // Operator-audit-only metadata. NEVER the raw token; NEVER the
        // recipient email. The deliberate key names below avoid the
        // activity logger's `FORBIDDEN_KEY_PATTERNS` strip (see Sprint
        // 4D-B precedent — `/email/i`, `/token/i`, `/raw/i` are all
        // filtered if present in event metadata).
        tokenVersion: 1,
        urlShape: "/p/[token]",
        publicRouteImplemented: false,
        createdFromSnapshotStatus: snapshot.status,
        createdFromApprovalState: snapshot.approvalState,
        expiresPolicyDays:
          args.expiryDays ?? DEFAULT_PROPOSAL_SHARE_TOKEN_EXPIRY_DAYS,
      },
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !tokenRow?.id) {
    console.error("[proposals.share-tokens] token-insert-failed", {
      name: insertError?.name,
      code: insertError?.code,
      message: insertError?.message,
    });
    return { ok: false, error: "service-error" };
  }

  await logActivityEvent({
    eventType: "proposal_share_token_created",
    entityType: "proposal_share_token",
    entityId: tokenRow.id,
    engagementId: snapshot.engagementId,
    title: "Proposal share link created",
    summary:
      "Operator generated a one-time proposal review link. Raw token returned to operator only; not stored in plaintext. Public /p route lands in Sprint P5.",
    metadata: {
      snapshotId: snapshot.id,
      proposalId: snapshot.proposalId,
      audienceLabel: audienceLabel ?? null,
      // Boolean only — never the hash bytes; never anything matching
      // the activity logger's strip patterns.
      recipientHashPresent: Boolean(recipientEmailHash),
      expiresAt,
    },
  });

  revalidatePath(`/app/engagements/${snapshot.engagementId}/proposal`);

  return {
    ok: true,
    tokenId: tokenRow.id,
    rawToken,
    shareUrlPath: `/p/${rawToken}`,
    expiresAt,
    snapshotId: snapshot.id,
  };
}

// ---------------------------------------------------------------------------
// Revoke action — Sprint P4 operator-side
// ---------------------------------------------------------------------------

export type RevokeProposalShareTokenError =
  | "unauthenticated"
  | "invalid-token"
  | "token-not-found"
  | "already-revoked"
  | "service-error";

export type RevokeProposalShareTokenResult =
  | { ok: true; tokenId: string }
  | { ok: false; error: RevokeProposalShareTokenError };

const DEFAULT_REVOKE_REASON = "Revoked by operator.";

/**
 * Phase 1B Proposal/SOW Delivery Sprint P4 — operator-only proposal
 * share-token revoke action.
 *
 * Flips `status` from `active` → `revoked`, captures `revoked_by`,
 * `revoked_at`, and a short reason. Revoking a token that is already
 * revoked or expired is a no-op error so the UI can show "already
 * revoked" cleanly. Emits a `proposal_share_token_revoked` activity
 * event with sanitized metadata.
 */
export async function revokeProposalShareTokenAction(args: {
  tokenId: string;
  reason?: string;
}): Promise<RevokeProposalShareTokenResult> {
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
    .from("proposal_share_tokens")
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
    console.error("[proposals.share-tokens] revoke-fetch-failed", {
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
    .from("proposal_share_tokens")
    .update({
      status: "revoked",
      revoked_at: now,
      revoked_by: user.id,
      revoke_reason: reason,
    })
    .eq("id", tokenId);
  if (updateError) {
    console.error("[proposals.share-tokens] revoke-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await logActivityEvent({
    eventType: "proposal_share_token_revoked",
    entityType: "proposal_share_token",
    entityId: tokenId,
    engagementId: row.engagement_id,
    title: "Proposal share link revoked",
    summary: "Operator revoked a proposal share link. Subsequent /p access is blocked.",
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
// Cascade-revoke helper — invoked by `voidProposalDeliverySnapshotAction`
// when a snapshot is voided. Service-internal: same-server runtime, uses
// the cookie-bound supabase client because the void action is itself
// cookie-bound. Returns the list of revoked token ids so the caller
// can attribute the cascade in its own activity event.
// ---------------------------------------------------------------------------

export interface CascadeRevokeProposalShareTokensInput {
  snapshotId: string;
  engagementId: string;
  proposalId: string;
  reason: string;
}

export interface CascadeRevokeProposalShareTokensResult {
  revokedTokenIds: string[];
  failedTokenIds: string[];
}

export async function cascadeRevokeActiveProposalShareTokensForSnapshot(
  args: CascadeRevokeProposalShareTokensInput,
): Promise<CascadeRevokeProposalShareTokensResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { revokedTokenIds: [], failedTokenIds: [] };

  const { data: rows, error: fetchError } = await supabase
    .from("proposal_share_tokens")
    .select("id")
    .eq("snapshot_id", args.snapshotId)
    .eq("status", "active");
  if (fetchError) {
    console.error("[proposals.share-tokens] cascade-fetch-failed", {
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
    .from("proposal_share_tokens")
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
    console.error("[proposals.share-tokens] cascade-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { revokedTokenIds: [], failedTokenIds: tokenIds };
  }
  const revokedIds = ((updated as Array<{ id: string }> | null) ?? [])
    .map((r) => r.id)
    .filter((id): id is string => typeof id === "string");

  // Emit one event per revoked token so the audit trail can attribute
  // each token's lifecycle independently. The volume is bounded by the
  // small per-snapshot token count expected in MVP.
  for (const id of revokedIds) {
    await logActivityEvent({
      eventType: "proposal_share_token_revoked",
      entityType: "proposal_share_token",
      entityId: id,
      engagementId: args.engagementId,
      title: "Proposal share link revoked",
      summary:
        "Proposal share link revoked automatically because its backing snapshot was voided.",
      metadata: {
        proposalId: args.proposalId,
        snapshotId: args.snapshotId,
        reason: trimmedReason.slice(0, 120),
        cascade: true,
      },
    });
  }

  return {
    revokedTokenIds: revokedIds,
    failedTokenIds: tokenIds.filter((id) => !revokedIds.includes(id)),
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sanitizeAudienceLabel(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    // Strip ASCII control characters (0x00-0x1F) and DEL (0x7F).
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, " ")
    // Collapse any whitespace run (including remaining newlines/tabs).
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

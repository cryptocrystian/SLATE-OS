"use server";

import { revalidatePath } from "next/cache";

import { logActivityEvent } from "@/lib/activity/log";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { isUuid } from "./mappers";
import { mapReportDeliverySnapshotRow } from "./delivery-snapshot-mappers";
import { evaluateReportShareEligibility } from "./share-token-eligibility";
import { loadPreDeliveryAudit } from "@/lib/engagement-readiness/pre-delivery-audit-loader";
import type { PreDeliveryReason } from "@/lib/engagement-readiness/pre-delivery-audit";
import {
  calculateShareTokenExpiry,
  generateRawShareToken,
  hashRecipientEmail,
  hashShareToken,
  isExpiryWithinPolicy,
} from "./share-token-service";
import type {
  DbReportDeliverySnapshotRow,
} from "./delivery-snapshot-types";

/**
 * Phase 1B Sprint 4D-B — operator-only Generate Share Link action.
 *
 * Canon (docs/22 §Operator-Side Share-Token Generation):
 *   - Caller must be authenticated and operate inside the snapshot's
 *     workspace (RLS enforces the boundary; we re-check at action
 *     entry to surface a clean error).
 *   - The snapshot must pass `evaluateReportShareEligibility`.
 *   - A fresh raw token is generated; the DB persists only its
 *     SHA-256 hash. The raw token is returned to the caller exactly
 *     once. This action MUST NOT log the raw token to activity, to
 *     console.log, to the snapshot row, or to error responses.
 *   - The action does NOT send email, push to CRM, or otherwise
 *     deliver the link. Delivery is the operator's manual step.
 *
 * No public-route handler is wired in this sprint; the returned token
 * is for the operator to copy and hand-deliver out of band until
 * Sprint 4D-C lands the `/r/[token]` route.
 */

export type GenerateShareLinkError =
  | "unauthenticated"
  | "invalid-snapshot"
  | "snapshot-not-found"
  | "snapshot-not-eligible"
  | "pre-delivery-audit-blocked"
  | "invalid-expiry"
  | "service-error";

export interface GenerateShareLinkSuccess {
  ok: true;
  tokenId: string;
  /**
   * The raw token. Surfaced to the operator exactly once via the
   * server-action return. Never persisted, never re-fetchable.
   */
  rawToken: string;
  expiresAt: string;
  snapshotId: string;
}

export interface GenerateShareLinkFailure {
  ok: false;
  error: GenerateShareLinkError;
  ineligibilityReasons?: ReadonlyArray<{ code: string; note: string }>;
  /**
   * Sprint S11 — when `error === "pre-delivery-audit-blocked"`, the
   * structured blocking reasons returned by the pre-delivery audit
   * evaluator. The operator UI surfaces these inline.
   */
  preDeliveryAuditReasons?: ReadonlyArray<PreDeliveryReason>;
}

export type GenerateShareLinkResult =
  | GenerateShareLinkSuccess
  | GenerateShareLinkFailure;

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

/**
 * Resolve the share-token expiry timestamp.
 *
 * Production default: 14 days, capped at the canon's 30-day maximum.
 *
 * Sprint H1 dev-only short-expiry affordance: when `expiryMinutes` is
 * supplied AND the runtime is non-production (`NODE_ENV !== "production"`
 * OR `SLATE_SHARE_TOKEN_ALLOW_DEV_EXPIRY === "true"`), the helper
 * resolves to `now + minutes * 60s`. Production callers passing
 * `expiryMinutes` get the parameter silently ignored — the 14d default
 * (or the supplied `expiryDays`) applies instead. This lets operators
 * live-test the expiry-flip branch in dev without raw SQL while
 * preserving the production policy verbatim.
 */
function resolveShareTokenExpiry(args: {
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
    args.expiryMinutes <= 60 * 24 * 30
  ) {
    const ms = args.expiryMinutes * 60 * 1000;
    return new Date(Date.now() + ms).toISOString();
  }
  return calculateShareTokenExpiry({ days: args.expiryDays });
}

export async function generateShareLinkAction(args: {
  snapshotId: string;
  audienceLabel?: string;
  recipientEmail?: string;
  expiryDays?: number;
  /**
   * Dev-only override — see `resolveShareTokenExpiry` doc block.
   * Production runtimes ignore this parameter.
   */
  expiryMinutes?: number;
}): Promise<GenerateShareLinkResult> {
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
    .from("report_delivery_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("id", snapshotId)
    .maybeSingle();
  if (fetchError) {
    console.error("[reports.share-tokens] snapshot-fetch-failed", {
      name: fetchError.name,
      code: fetchError.code,
      message: fetchError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!row) {
    return { ok: false, error: "snapshot-not-found" };
  }

  const snapshot = mapReportDeliverySnapshotRow(
    row as unknown as DbReportDeliverySnapshotRow,
  );

  // Sprint S11 — pre-delivery audit (code-side enforcement of
  // docs/35 § 5 readiness gate). The mint is refused before any token
  // / snapshot is created; a sanitized `pre_delivery_audit_blocked`
  // activity event records the attempt with reason codes only.
  const audit = await loadPreDeliveryAudit(snapshot.engagementId, {
    surface: "report",
    audienceLabel: args.audienceLabel ?? null,
  });
  if (!audit.ready) {
    await logActivityEvent({
      eventType: "pre_delivery_audit_blocked",
      entityType: "engagement",
      entityId: snapshot.engagementId,
      engagementId: snapshot.engagementId,
      title: "Report share mint blocked by pre-delivery audit",
      summary:
        "Pre-delivery audit refused a report share-token mint attempt. No token was created.",
      metadata: {
        surface: "report",
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

  const eligibility = evaluateReportShareEligibility(snapshot);
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
  // Dev-only `expiryMinutes` is resolved before policy validation so it
  // still has to pass `isExpiryWithinPolicy` (which permits any future
  // timestamp under the 30-day cap).
  const expiresAt = resolveShareTokenExpiry({
    expiryDays: args.expiryDays,
    expiryMinutes: args.expiryMinutes,
  });
  if (!isExpiryWithinPolicy(expiresAt)) {
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
    .from("report_share_tokens")
    .insert({
      workspace_id: snapshot.workspaceId,
      engagement_id: snapshot.engagementId,
      report_id: snapshot.reportId,
      snapshot_id: snapshot.id,
      token_hash: tokenHash,
      status: "active",
      audience_label: audienceLabel,
      recipient_email_hash: recipientEmailHash,
      expires_at: expiresAt,
      created_by: user.id,
      created_by_label: operatorLabel,
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !tokenRow?.id) {
    console.error("[reports.share-tokens] token-insert-failed", {
      name: insertError?.name,
      code: insertError?.code,
      message: insertError?.message,
    });
    return { ok: false, error: "service-error" };
  }

  await logActivityEvent({
    eventType: "report_share_token_created",
    entityType: "report_share_token",
    entityId: tokenRow.id,
    engagementId: snapshot.engagementId,
    title: "Report share token created",
    summary:
      "Operator generated a one-time share link. Raw token returned to operator only; not stored in plaintext.",
    metadata: {
      snapshotId: snapshot.id,
      reportId: snapshot.reportId,
      audienceLabel: audienceLabel ?? null,
      // NOTE: deliberate key name. The activity logger strips keys
      // matching /email/i so the operator's recipient-hash signal must
      // not include "Email" in the key. Boolean only — no hash bytes.
      recipientHashPresent: Boolean(recipientEmailHash),
      expiresAt,
    },
  });

  revalidatePath(`/app/engagements/${snapshot.engagementId}/report`);

  return {
    ok: true,
    tokenId: tokenRow.id,
    rawToken,
    expiresAt,
    snapshotId: snapshot.id,
  };
}

// ---------------------------------------------------------------------------
// Helpers — `audienceLabel` is an opt-in operator note like "CFO" or
// "Board pre-read." We cap it to a sensible length and strip control
// chars / newlines so it can't poison the activity feed or DB log.
// ---------------------------------------------------------------------------

function sanitizeAudienceLabel(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[ -]+/g, " ")
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

// ---------------------------------------------------------------------------
// Revoke action — Sprint 4D-C
// ---------------------------------------------------------------------------

export type RevokeShareTokenError =
  | "unauthenticated"
  | "invalid-token-id"
  | "token-not-found"
  | "already-closed"
  | "service-error";

export type RevokeShareTokenResult =
  | { ok: true; tokenId: string }
  | { ok: false; error: RevokeShareTokenError };

/**
 * Phase 1B Sprint 4D-C — operator-only revoke action.
 *
 * Flips `status` from `active` → `revoked`, captures `revoked_by`,
 * `revoked_at`, and a short reason. Revoking a token that is already
 * revoked or expired is a no-op error so the operator does not
 * accidentally double-log a revocation. The action emits a
 * `report_share_token_revoked` activity event with sanitized metadata.
 *
 * No public-route side effects: the public route re-evaluates token
 * status on every render and treats any non-`active` token as
 * unavailable.
 */
export async function revokeShareTokenAction(args: {
  tokenId: string;
  reason?: string;
}): Promise<RevokeShareTokenResult> {
  const { tokenId } = args;
  if (!isUuid(tokenId)) {
    return { ok: false, error: "invalid-token-id" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: readError } = await supabase
    .from("report_share_tokens")
    .select("id, engagement_id, snapshot_id, status")
    .eq("id", tokenId)
    .maybeSingle<{
      id: string;
      engagement_id: string;
      snapshot_id: string;
      status: string;
    }>();
  if (readError) {
    console.error("[reports.share-tokens] revoke-read-failed", {
      name: readError.name,
      code: readError.code,
      message: readError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!existing?.id) return { ok: false, error: "token-not-found" };
  if (existing.status !== "active") {
    return { ok: false, error: "already-closed" };
  }

  const reason = sanitizeRevokeReason(args.reason);
  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("report_share_tokens")
    .update({
      status: "revoked",
      revoked_at: now,
      revoked_by: user.id,
      revoke_reason: reason,
    })
    .eq("id", tokenId);
  if (updateError) {
    console.error("[reports.share-tokens] revoke-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await logActivityEvent({
    eventType: "report_share_token_revoked",
    entityType: "report_share_token",
    entityId: tokenId,
    engagementId: existing.engagement_id,
    title: "Report share token revoked",
    summary:
      "Operator revoked a share link. The public route now renders the generic-unavailable page for any further access attempt.",
    metadata: {
      snapshotId: existing.snapshot_id,
      reason: reason ?? null,
    },
  });

  revalidatePath(`/app/engagements/${existing.engagement_id}/report`);

  return { ok: true, tokenId };
}

function sanitizeRevokeReason(raw: string | undefined): string | null {
  if (!raw) return null;
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 200);
  return cleaned.length > 0 ? cleaned : null;
}

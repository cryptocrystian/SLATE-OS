"use server";

import { revalidatePath } from "next/cache";

import { logActivityEvent } from "@/lib/activity/log";
import {
  evaluateSendToClientEligibility,
} from "@/lib/client-delivery/send-to-client-policy";
import {
  SEND_TO_CLIENT_CHANNEL_OPERATOR_MEDIATED_COPY_LINK,
  SEND_TO_CLIENT_METADATA_KEYS,
  type SendToClientConfirmationInput,
  type SendToClientEligibilityReason,
  type SendToClientResult,
} from "@/lib/client-delivery/send-to-client-types";
import {
  validateAudienceLabel,
  validateRecipientEmailForHashing,
} from "@/lib/client-delivery/recipient";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { isUuid } from "./mappers";
import { mapReportDeliverySnapshotRow } from "./delivery-snapshot-mappers";
import { evaluateReportShareEligibility } from "./share-token-eligibility";
import { mapReportShareTokenRow } from "./share-token-mappers";
import { hashRecipientEmail } from "./share-token-service";
import type {
  DbReportDeliverySnapshotRow,
} from "./delivery-snapshot-types";
import type { DbReportShareTokenRow } from "./share-token-types";

/**
 * Phase 1B Send to Client Sprint C2-A — operator-only mark-sent action
 * for the report share-link lane.
 *
 * Pipeline:
 *   1. Validate UUID + operator session.
 *   2. Validate `operatorConfirmed === true` (canon § 12: the modal
 *      cannot be bypassed; a missing confirmation is an action-layer
 *      reject, not a "best effort" warning).
 *   3. Validate audience label (canon § 3 mandatory; trim+sanitize via
 *      `normalizeAudienceLabel`).
 *   4. Validate recipient email (optional; shape-check before hashing).
 *   5. Load the existing report share token via cookie-bound RLS.
 *   6. Load the backing report delivery snapshot for the eligibility
 *      re-check.
 *   7. Run `evaluateReportShareEligibility` on the snapshot (defense
 *      in depth — a snapshot voided since mint must not be sendable).
 *   8. Run `evaluateSendToClientEligibility` against the policy
 *      module's narrowed shape.
 *   9. On any error → log `report_share_token_send_failed` with
 *      sanitized reason metadata; return `{ok: false, status: 'failed', error, reasons}`.
 *  10. Happy path → update the token row's `metadata` jsonb with
 *      `lastSentToClientAt` + `sendCount` + `lastSentChannel` AND
 *      update `audience_label` + `recipient_email_hash` if the
 *      operator edited them at confirm time. **No new column added —
 *      `metadata` jsonb is the audit surface (canon § 5, no schema
 *      change).**
 *  11. Log `report_share_token_sent_to_client` activity event with
 *      sanitized metadata (no raw token, no raw URL, no raw email).
 *  12. Revalidate the report page.
 *  13. Return `{ok: true, status: 'sent', ...}` — no raw token / URL /
 *      email in the result either; the operator's clipboard holds the
 *      URL.
 *
 * SLATE does not send email. SLATE does not push to CRM. SLATE does
 * not open `mailto:` links. SLATE does not invoke a third-party send
 * API. The action records intent + the operator's audit fingerprint
 * and stops.
 */

export type MarkReportLinkSentToClientArgs = {
  shareTokenId: string;
  audienceConfirmation: string;
  recipientEmail?: string;
  operatorConfirmed: SendToClientConfirmationInput["operatorConfirmed"];
};

const SHARE_TOKEN_SELECT = `
  id,
  workspace_id,
  engagement_id,
  report_id,
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

export async function markReportLinkSentToClientAction(
  args: MarkReportLinkSentToClientArgs,
): Promise<SendToClientResult> {
  const { shareTokenId } = args;
  if (!isUuid(shareTokenId)) {
    return failure("invalid-token");
  }
  if (args.operatorConfirmed !== true) {
    return failure("operator-not-confirmed");
  }

  // Canon § 12: audience label is mandatory at confirm time. We
  // validate before any DB read so a missing label doesn't waste a
  // round trip.
  const audienceValidation = validateAudienceLabel(args.audienceConfirmation);
  if (!audienceValidation.ok) {
    return failure(
      audienceValidation.code === "audience_label_too_long"
        ? "audience-label-too-long"
        : "audience-label-missing",
    );
  }

  const recipientValidation = validateRecipientEmailForHashing(
    args.recipientEmail,
  );
  if (!recipientValidation.ok) {
    return failure("not-eligible", [
      {
        code: recipientValidation.code,
        severity: "error",
        message: recipientValidation.message,
      },
    ]);
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return failure("unauthenticated");

  const { data: tokenRow, error: tokenError } = await supabase
    .from("report_share_tokens")
    .select(SHARE_TOKEN_SELECT)
    .eq("id", shareTokenId)
    .maybeSingle();
  if (tokenError) {
    console.error("[reports.send-to-client] token-fetch-failed", {
      name: tokenError.name,
      code: tokenError.code,
      message: tokenError.message,
    });
    return failure("service-error");
  }
  if (!tokenRow) {
    return failure("token-not-found");
  }
  const token = mapReportShareTokenRow(
    tokenRow as unknown as DbReportShareTokenRow,
  );

  const { data: snapshotRow, error: snapshotError } = await supabase
    .from("report_delivery_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("id", token.snapshotId)
    .maybeSingle();
  if (snapshotError) {
    console.error("[reports.send-to-client] snapshot-fetch-failed", {
      name: snapshotError.name,
      code: snapshotError.code,
      message: snapshotError.message,
    });
    return failure("service-error");
  }
  if (!snapshotRow) {
    return failure("not-eligible", [
      {
        code: "snapshot_voided",
        severity: "error",
        message:
          "Snapshot is missing — re-mint a fresh share token before retrying.",
      },
    ]);
  }
  const snapshot = mapReportDeliverySnapshotRow(
    snapshotRow as unknown as DbReportDeliverySnapshotRow,
  );

  const snapshotEligibility = evaluateReportShareEligibility(snapshot);

  const policyResult = evaluateSendToClientEligibility({
    artifactKind: "report",
    proposedAudienceLabel: audienceValidation.value,
    token: {
      id: token.id,
      status: token.status,
      expiresAt: token.expiresAt,
      audienceLabel: token.audienceLabel,
      recipientEmailHash: token.recipientEmailHash,
      snapshotStatus: snapshot.status,
      snapshotEligibleForShare: snapshotEligibility.eligible,
    },
  });

  if (!policyResult.eligible) {
    await emitFailureEvent(token, policyResult.reasons);
    return failure("not-eligible", policyResult.reasons);
  }

  const audienceLabel = audienceValidation.value;
  const recipientEmailHash = recipientValidation.normalizedForHashing
    ? hashRecipientEmail(recipientValidation.normalizedForHashing)
    : token.recipientEmailHash;
  const sentAt = new Date().toISOString();
  const priorSendCount = readNumeric(
    token.metadata,
    SEND_TO_CLIENT_METADATA_KEYS.sendCount,
    0,
  );
  const nextSendCount = priorSendCount + 1;
  const nextMetadata: Record<string, unknown> = {
    ...token.metadata,
    [SEND_TO_CLIENT_METADATA_KEYS.lastSentAt]: sentAt,
    [SEND_TO_CLIENT_METADATA_KEYS.sendCount]: nextSendCount,
    [SEND_TO_CLIENT_METADATA_KEYS.lastChannel]:
      SEND_TO_CLIENT_CHANNEL_OPERATOR_MEDIATED_COPY_LINK,
  };

  const updatePatch: Record<string, unknown> = {
    metadata: nextMetadata,
    audience_label: audienceLabel,
  };
  // Only touch `recipient_email_hash` if the operator edited the
  // recipient field. Leaving the column unchanged preserves the prior
  // hash from raw-mint time. NEVER write the raw email.
  if (recipientValidation.normalizedForHashing) {
    updatePatch.recipient_email_hash = recipientEmailHash;
  }

  const { error: updateError } = await supabase
    .from("report_share_tokens")
    .update(updatePatch)
    .eq("id", token.id);
  if (updateError) {
    console.error("[reports.send-to-client] token-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return failure("service-error");
  }

  await logActivityEvent({
    eventType: "report_share_token_sent_to_client",
    entityType: "report_share_token",
    entityId: token.id,
    engagementId: token.engagementId,
    title: "Report link marked sent",
    summary:
      "Operator confirmed Send to Client for an existing report share link. SLATE does not deliver the link — the operator hand-delivered it through their own channel.",
    metadata: {
      shareTokenId: token.id,
      snapshotId: token.snapshotId,
      reportId: token.reportId,
      audienceLabel,
      hasRecipientEmailHash: Boolean(recipientEmailHash),
      sentAt,
      sendCount: nextSendCount,
      channel: SEND_TO_CLIENT_CHANNEL_OPERATOR_MEDIATED_COPY_LINK,
    },
  });

  revalidatePath(`/app/engagements/${token.engagementId}/report`);

  return {
    ok: true,
    status: "sent",
    artifactKind: "report",
    channel: SEND_TO_CLIENT_CHANNEL_OPERATOR_MEDIATED_COPY_LINK,
    tokenId: token.id,
    sentAt,
    sendCount: nextSendCount,
    hasRecipientEmailHash: Boolean(recipientEmailHash),
    audienceLabel,
  };

  // ---------------------------------------------------------------------
  // Local helpers — closed over `supabase` + `args` above; defined at
  // the bottom of the action so the happy-path read top-to-bottom.
  // ---------------------------------------------------------------------
  async function emitFailureEvent(
    failedToken: typeof token,
    reasons: SendToClientEligibilityReason[],
  ): Promise<void> {
    try {
      await logActivityEvent({
        eventType: "report_share_token_send_failed",
        entityType: "report_share_token",
        entityId: failedToken.id,
        engagementId: failedToken.engagementId,
        title: "Report link send mark failed",
        summary:
          "Operator attempted to mark a report share link as sent, but eligibility re-check rejected the request. The token state is unchanged.",
        metadata: {
          shareTokenId: failedToken.id,
          snapshotId: failedToken.snapshotId,
          reportId: failedToken.reportId,
          failureReason: reasons[0]?.code ?? "unknown",
          // Surface only the first-blocking code on the activity event
          // to avoid metadata bloat; the action return still carries
          // the full reasons array for the UI.
        },
      });
    } catch (logError) {
      console.error(
        "[reports.send-to-client] failure-event-log-failed",
        logError,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Module-level helpers
// ---------------------------------------------------------------------------

function failure(
  error: Exclude<SendToClientResult, { ok: true }>["error"],
  reasons?: SendToClientEligibilityReason[],
): Exclude<SendToClientResult, { ok: true }> {
  return {
    ok: false,
    status: "failed",
    error,
    reasons,
  };
}

function readNumeric(
  metadata: Record<string, unknown>,
  key: string,
  fallback: number,
): number {
  const value = metadata?.[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  return fallback;
}

// Re-exported for the C2-B modal so it can guard against
// surface-specific input shapes without coupling its file path to
// this module.
export type { MarkReportLinkSentToClientArgs as ReportLinkSentToClientArgs };

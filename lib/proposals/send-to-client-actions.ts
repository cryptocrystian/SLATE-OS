"use server";

import { revalidatePath } from "next/cache";

import { logActivityEvent } from "@/lib/activity/log";
import { evaluateSendToClientEligibility } from "@/lib/client-delivery/send-to-client-policy";
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
import { hashRecipientEmail } from "@/lib/reports/share-token-service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

import { mapProposalDeliverySnapshotRow } from "./delivery-snapshot-mappers";
import type {
  DbProposalDeliverySnapshotRow,
} from "./delivery-snapshot-types";
import { isUuid } from "./mappers";
import { evaluateProposalShareEligibility } from "./share-token-eligibility";
import { mapProposalShareTokenRow } from "./share-token-mappers";
import type { DbProposalShareTokenRow } from "./share-token-types";

/**
 * Phase 1B Send to Client Sprint C2-A — operator-only mark-sent action
 * for the proposal share-link lane. Mirrors
 * `lib/reports/send-to-client-actions.ts` end-to-end against
 * `proposal_share_tokens` + `proposal_delivery_snapshots`.
 *
 * See the report-side module for the canonical pipeline doc block;
 * the proposal-side mirror is intentionally byte-similar so future
 * agents reading either lane see the same shape.
 *
 * Notable deltas vs. report-side:
 *   - Loads from `proposal_share_tokens` + `proposal_delivery_snapshots`.
 *   - Activity event types: `proposal_share_token_sent_to_client`
 *     + `proposal_share_token_send_failed`.
 *   - Activity metadata carries `proposalId` instead of `reportId`.
 *   - Revalidates the proposal page rather than the report page.
 *
 * SLATE does not send email. SLATE does not push to CRM. SLATE does
 * not open `mailto:` links. SLATE does not invoke a third-party send
 * API.
 */

export type MarkProposalLinkSentToClientArgs = {
  shareTokenId: string;
  audienceConfirmation: string;
  recipientEmail?: string;
  operatorConfirmed: SendToClientConfirmationInput["operatorConfirmed"];
};

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

export async function markProposalLinkSentToClientAction(
  args: MarkProposalLinkSentToClientArgs,
): Promise<SendToClientResult> {
  const { shareTokenId } = args;
  if (!isUuid(shareTokenId)) {
    return failure("invalid-token");
  }
  if (args.operatorConfirmed !== true) {
    return failure("operator-not-confirmed");
  }

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
    .from("proposal_share_tokens")
    .select(SHARE_TOKEN_SELECT)
    .eq("id", shareTokenId)
    .maybeSingle();
  if (tokenError) {
    console.error("[proposals.send-to-client] token-fetch-failed", {
      name: tokenError.name,
      code: tokenError.code,
      message: tokenError.message,
    });
    return failure("service-error");
  }
  if (!tokenRow) {
    return failure("token-not-found");
  }
  const token = mapProposalShareTokenRow(
    tokenRow as unknown as DbProposalShareTokenRow,
  );

  const { data: snapshotRow, error: snapshotError } = await supabase
    .from("proposal_delivery_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("id", token.snapshotId)
    .maybeSingle();
  if (snapshotError) {
    console.error("[proposals.send-to-client] snapshot-fetch-failed", {
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
  const snapshot = mapProposalDeliverySnapshotRow(
    snapshotRow as unknown as DbProposalDeliverySnapshotRow,
  );

  const snapshotEligibility = evaluateProposalShareEligibility(snapshot);

  const policyResult = evaluateSendToClientEligibility({
    artifactKind: "proposal",
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
  if (recipientValidation.normalizedForHashing) {
    updatePatch.recipient_email_hash = recipientEmailHash;
  }

  const { error: updateError } = await supabase
    .from("proposal_share_tokens")
    .update(updatePatch)
    .eq("id", token.id);
  if (updateError) {
    console.error("[proposals.send-to-client] token-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return failure("service-error");
  }

  await logActivityEvent({
    eventType: "proposal_share_token_sent_to_client",
    entityType: "proposal_share_token",
    entityId: token.id,
    engagementId: token.engagementId,
    title: "Proposal link marked sent",
    summary:
      "Operator confirmed Send to Client for an existing proposal review link. SLATE does not deliver the link — the operator hand-delivered it through their own channel.",
    metadata: {
      shareTokenId: token.id,
      snapshotId: token.snapshotId,
      proposalId: token.proposalId,
      audienceLabel,
      hasRecipientEmailHash: Boolean(recipientEmailHash),
      sentAt,
      sendCount: nextSendCount,
      channel: SEND_TO_CLIENT_CHANNEL_OPERATOR_MEDIATED_COPY_LINK,
    },
  });

  revalidatePath(`/app/engagements/${token.engagementId}/proposal`);

  return {
    ok: true,
    status: "sent",
    artifactKind: "proposal",
    channel: SEND_TO_CLIENT_CHANNEL_OPERATOR_MEDIATED_COPY_LINK,
    tokenId: token.id,
    sentAt,
    sendCount: nextSendCount,
    hasRecipientEmailHash: Boolean(recipientEmailHash),
    audienceLabel,
  };

  // ---------------------------------------------------------------------
  async function emitFailureEvent(
    failedToken: typeof token,
    reasons: SendToClientEligibilityReason[],
  ): Promise<void> {
    try {
      await logActivityEvent({
        eventType: "proposal_share_token_send_failed",
        entityType: "proposal_share_token",
        entityId: failedToken.id,
        engagementId: failedToken.engagementId,
        title: "Proposal link send mark failed",
        summary:
          "Operator attempted to mark a proposal review link as sent, but eligibility re-check rejected the request. The token state is unchanged.",
        metadata: {
          shareTokenId: failedToken.id,
          snapshotId: failedToken.snapshotId,
          proposalId: failedToken.proposalId,
          failureReason: reasons[0]?.code ?? "unknown",
        },
      });
    } catch (logError) {
      console.error(
        "[proposals.send-to-client] failure-event-log-failed",
        logError,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Module-level helpers — same shape as the report-side mirror.
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

export type {
  MarkProposalLinkSentToClientArgs as ProposalLinkSentToClientArgs,
};

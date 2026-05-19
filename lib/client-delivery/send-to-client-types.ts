/**
 * Phase 1B Send to Client Sprint C2-A — shared types.
 *
 * Foundation module shared by the report-side and proposal-side
 * mark-sent actions plus the future C2-B confirm modal. Pure module —
 * no React, no DB, no I/O.
 *
 * Canon source: `docs/29_PHASE_1B_SEND_TO_CLIENT_CHANNEL_CANON.md`.
 *
 * Boundaries enforced through these types:
 *   - SOW Drafts are NOT eligible. The `SendToClientArtifactKind`
 *     union excludes `'sow_draft'` entirely; consumers cannot type-check
 *     a SOW mark-sent call without adding the union member, which
 *     requires a canon amendment.
 *   - The only delivery channel is `'operator_mediated_copy_link'`.
 *     SLATE never sends email, never pushes to CRM, never opens a
 *     `mailto:` link, never invokes a third-party send API.
 *   - Activity-event metadata never carries the raw token, raw URL, or
 *     raw recipient email. `SendToClientResult` returns the operator
 *     enough state to re-render the panel; the raw URL stays in the
 *     operator's clipboard.
 */

export type SendToClientArtifactKind = "report" | "proposal";

/**
 * The set of channels the canon authorises for the first Send to
 * Client unlock. Locked at one entry; expansion (e.g.
 * `'slate_sent_email'`, `'crm_pushed'`) requires a new canon.
 */
export type SendToClientChannel = "operator_mediated_copy_link";

/**
 * Status of a single mark-sent attempt.
 *   - `sent` → eligibility passed, audit event emitted, counter
 *     incremented.
 *   - `failed` → eligibility OR re-check failed; a sanitized
 *     `*_send_failed` activity event was emitted; nothing else on the
 *     token row changed.
 */
export type SendToClientActionStatus = "sent" | "failed";

/**
 * Reason codes surfaced to the operator UI when eligibility fails.
 * Each code maps to a sanitized `failureReason` string in the
 * `*_send_failed` activity event metadata.
 */
export type SendToClientEligibilityReasonCode =
  | "artifact_kind_not_supported"
  | "token_not_found"
  | "token_revoked"
  | "token_expired"
  | "audience_label_missing"
  | "audience_label_too_long"
  | "recipient_email_invalid_shape"
  | "recipient_email_too_long"
  | "snapshot_voided"
  | "snapshot_ineligible"
  | "public_route_not_implemented"
  | "channel_not_authorised";

export type SendToClientEligibilityReasonSeverity = "error" | "warning";

export interface SendToClientEligibilityReason {
  code: SendToClientEligibilityReasonCode;
  severity: SendToClientEligibilityReasonSeverity;
  message: string;
  /** Optional narrow target string for the operator UI. */
  target?: string;
}

/**
 * Shape the eligibility evaluator returns. Both the action layer and
 * the C2-B modal consume this — the modal renders `reasons[]` when
 * the operator opens it against an ineligible token, and the action
 * re-runs eligibility at confirm time as defense-in-depth.
 */
export interface SendToClientEligibilityResult {
  eligible: boolean;
  reasons: SendToClientEligibilityReason[];
  /**
   * Echoed back so the caller can show "evaluated at <iso>" if it
   * surfaces the evaluation timestamp.
   */
  evaluatedAt: string;
}

/**
 * Minimal shape the policy evaluator needs from a share-token row.
 * Deliberately narrower than `ReportShareToken` / `ProposalShareToken`
 * so the policy module stays domain-agnostic (the report + proposal
 * action layers map their domain shapes into this).
 */
export interface SendToClientTokenInput {
  id: string;
  status: "active" | "revoked" | "expired";
  expiresAt: string;
  audienceLabel: string | null;
  recipientEmailHash: string | null;
  snapshotStatus: "candidate" | "generated" | "voided";
  snapshotEligibleForShare: boolean;
}

export interface SendToClientPolicyInput {
  artifactKind: SendToClientArtifactKind;
  token: SendToClientTokenInput | null;
  /**
   * The audience label the operator typed into the confirm modal (if
   * any). The evaluator prefers this over the token's stored label
   * because Send to Client can edit the label at confirmation time
   * per `docs/29` § 12.
   */
  proposedAudienceLabel?: string | null;
  /** Optional clock injection for testability. */
  now?: string;
}

/**
 * What the operator types into the confirm modal and the action
 * receives. The action MUST re-validate every field server-side; the
 * client cannot be trusted to enforce the audience-label-mandatory
 * rule.
 */
export interface SendToClientConfirmationInput {
  /** Mandatory under `docs/29` § 3. */
  audienceLabel: string;
  /** Optional. Hashed server-side via `hashRecipientEmail`. */
  recipientEmail?: string;
  /**
   * Operator-acknowledged confirmation. The action layer rejects the
   * call when this is not strictly `true` so the modal cannot be
   * bypassed.
   */
  operatorConfirmed: true;
}

/**
 * Successful return — surfaced to the operator UI. Notably does NOT
 * carry the raw token, the raw URL, or the recipient email.
 */
export interface SendToClientSuccess {
  ok: true;
  status: "sent";
  artifactKind: SendToClientArtifactKind;
  channel: SendToClientChannel;
  tokenId: string;
  sentAt: string;
  sendCount: number;
  hasRecipientEmailHash: boolean;
  /**
   * The audience label SLATE actually persisted (sanitized; may differ
   * from the operator's input if it was trimmed).
   */
  audienceLabel: string;
}

export type SendToClientError =
  | "unauthenticated"
  | "invalid-token"
  | "token-not-found"
  | "not-eligible"
  | "audience-label-missing"
  | "audience-label-too-long"
  | "operator-not-confirmed"
  | "service-error";

export interface SendToClientFailure {
  ok: false;
  status: "failed";
  error: SendToClientError;
  reasons?: SendToClientEligibilityReason[];
}

export type SendToClientResult = SendToClientSuccess | SendToClientFailure;

/**
 * Token-row metadata keys SLATE writes on a successful Send to Client.
 * Exported so the action implementations and any future audit-reader
 * read from a single source of truth.
 *
 * NEVER:
 *   - the raw token
 *   - the raw URL
 *   - the raw recipient email
 *   - any key matching the activity logger's
 *     `FORBIDDEN_KEY_PATTERNS` strip (`/email/i`, `/token/i`,
 *     `/raw/i`, `/ip/i`, `/userAgent/i`).
 */
export const SEND_TO_CLIENT_METADATA_KEYS = {
  lastSentAt: "lastSentToClientAt",
  sendCount: "sendCount",
  lastChannel: "lastSentChannel",
} as const;

export const SEND_TO_CLIENT_CHANNEL_OPERATOR_MEDIATED_COPY_LINK =
  "operator_mediated_copy_link" as const satisfies SendToClientChannel;

/**
 * Canon-required canonical disclaimer copy per `docs/29` § 13. The
 * modal scaffold imports these so the verbatim copy stays in one place
 * and downstream renames must touch this module.
 */
export const SEND_TO_CLIENT_DISCLAIMERS = {
  report:
    "Marking this report as sent records the operator's intent in SLATE's audit log. SLATE does not deliver this link by email, CRM, or any other channel. After confirming, copy the URL above and deliver it through your own channel (email client, CRM, or in person). SLATE does not track recipient delivery beyond access events on the SLATE public route.",
  proposal:
    "Marking this proposal as sent records the operator's intent in SLATE's audit log. SLATE does not deliver this link by email, CRM, or any other channel. After confirming, copy the URL above and deliver it through your own channel (email client, CRM, or in person). This document is a commercial discussion artifact — not a contract, not an executed SOW, not a binding quote, and not acceptance of work. Final scope, pricing, and timeline require written approval.",
} as const;

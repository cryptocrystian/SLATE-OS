import {
  type SendToClientArtifactKind,
  type SendToClientEligibilityReason,
  type SendToClientEligibilityResult,
  type SendToClientPolicyInput,
} from "./send-to-client-types";

/**
 * Phase 1B Send to Client Sprint C2-A — pure eligibility evaluator.
 *
 * Canon source: `docs/29_PHASE_1B_SEND_TO_CLIENT_CHANNEL_CANON.md` §
 * Unlock prerequisites + § Failure / revoke behavior + § Recipient /
 * audience model + § Eligible artifacts.
 *
 * Returns ALL applicable reasons (not first-fail), mirroring the
 * proposal-share + SOW-draft eligibility evaluators. Warning-severity
 * reasons (none today; reserved for future operator hints) do not
 * block. Pure function — no DB, no I/O, no React.
 */

const AUDIENCE_LABEL_MAX_CHARS = 80;

/**
 * Artifacts the canon's § 2 enumerates as eligible for the first
 * Send to Client unlock. SOW Drafts are deliberately absent — adding
 * them requires `docs/28` to be amended AND a separate Sprint C2/P7-B
 * sequence approved.
 */
const SUPPORTED_ARTIFACT_KINDS: ReadonlySet<SendToClientArtifactKind> = new Set([
  "report",
  "proposal",
]);

export function evaluateSendToClientEligibility(
  input: SendToClientPolicyInput,
): SendToClientEligibilityResult {
  const reasons: SendToClientEligibilityReason[] = [];
  const evaluatedAt = input.now ?? new Date().toISOString();

  // ---------------------------------------------------------------------
  // Artifact-kind gate — SOW etc. are not eligible per canon § 2.
  // ---------------------------------------------------------------------
  if (!SUPPORTED_ARTIFACT_KINDS.has(input.artifactKind)) {
    reasons.push({
      code: "artifact_kind_not_supported",
      severity: "error",
      message:
        "Only report and proposal share links are eligible for Send to Client. SOW Drafts and other artifacts are not.",
      target: input.artifactKind,
    });
  }

  // ---------------------------------------------------------------------
  // Token-existence gate — without a token there's nothing to send.
  // ---------------------------------------------------------------------
  if (!input.token) {
    reasons.push({
      code: "token_not_found",
      severity: "error",
      message:
        "No share token was supplied. Send to Client runs against an existing share-token row that was minted in a separate step.",
    });
    return {
      eligible: false,
      reasons,
      evaluatedAt,
    };
  }

  const token = input.token;

  // ---------------------------------------------------------------------
  // Token-status gates — revoked / expired tokens are not sendable.
  // The action layer also re-runs the share-token-status check at
  // confirmation time; the policy evaluator surfaces the same reasons
  // for parity with the modal-open path.
  // ---------------------------------------------------------------------
  if (token.status === "revoked") {
    reasons.push({
      code: "token_revoked",
      severity: "error",
      message:
        "This share token has been revoked. Re-confirming would not re-activate the public link.",
    });
  }

  if (token.status === "expired") {
    reasons.push({
      code: "token_expired",
      severity: "error",
      message:
        "This share token has expired. The public link returns the generic-unavailable page for any new access.",
    });
  } else if (token.status === "active") {
    const expiry = new Date(token.expiresAt).getTime();
    const now = new Date(evaluatedAt).getTime();
    if (
      Number.isFinite(expiry) &&
      Number.isFinite(now) &&
      expiry <= now
    ) {
      reasons.push({
        code: "token_expired",
        severity: "error",
        message:
          "This share token's expiry timestamp has passed even though its status is still active. The public route will return the generic-unavailable page on next access.",
      });
    }
  }

  // ---------------------------------------------------------------------
  // Snapshot gates — voided or ineligible snapshots cannot be sent.
  // ---------------------------------------------------------------------
  if (token.snapshotStatus === "voided") {
    reasons.push({
      code: "snapshot_voided",
      severity: "error",
      message:
        "The backing snapshot has been voided. Send to Client requires a live snapshot for the operator to confidently hand off the link.",
    });
  }
  if (!token.snapshotEligibleForShare) {
    reasons.push({
      code: "snapshot_ineligible",
      severity: "error",
      message:
        "The backing snapshot no longer passes the share-eligibility evaluator. Send to Client requires the snapshot to remain eligible at confirm time as defense-in-depth.",
    });
  }

  // ---------------------------------------------------------------------
  // Audience-label gates — mandatory per canon § 3.
  // ---------------------------------------------------------------------
  const audienceForGate =
    (input.proposedAudienceLabel ?? token.audienceLabel ?? "").trim();
  if (audienceForGate.length === 0) {
    reasons.push({
      code: "audience_label_missing",
      severity: "error",
      message:
        "Audience label is required for Send to Client. Operators must record who the link was sent to before SLATE writes the audit event.",
    });
  } else if (audienceForGate.length > AUDIENCE_LABEL_MAX_CHARS) {
    reasons.push({
      code: "audience_label_too_long",
      severity: "error",
      message: `Audience label exceeds the ${AUDIENCE_LABEL_MAX_CHARS}-character maximum.`,
    });
  }

  const hasBlockingError = reasons.some((r) => r.severity === "error");
  return {
    eligible: !hasBlockingError,
    reasons,
    evaluatedAt,
  };
}

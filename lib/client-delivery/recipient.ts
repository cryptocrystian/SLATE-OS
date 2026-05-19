/**
 * Phase 1B Send to Client Sprint C2-A — recipient + audience-label
 * validation helpers.
 *
 * Pure module — no React, no DB, no I/O. Reused by both report-side
 * and proposal-side mark-sent actions plus the future C2-B confirm
 * modal so the sanitization rules live in one place.
 *
 * Canon source: `docs/29` § 3 (recipient / audience model) + § 14
 * (PII / privacy posture).
 */

export const AUDIENCE_LABEL_MAX_CHARS = 80;
export const RECIPIENT_EMAIL_MAX_CHARS = 254;

/**
 * Normalize an audience-label string before persistence:
 *
 *   - replaces ASCII control characters (0x00-0x1F, 0x7F) with a
 *     single space so a pasted control byte never survives into the
 *     activity feed or token row;
 *   - collapses any whitespace run (incl. tabs / newlines) into a
 *     single space;
 *   - trims leading + trailing whitespace;
 *   - caps the result at `AUDIENCE_LABEL_MAX_CHARS`.
 *
 * Returns `null` for empty input so callers can distinguish "operator
 * supplied nothing" from "operator supplied something that survived
 * sanitization."
 */
export function normalizeAudienceLabel(
  raw: string | null | undefined,
): string | null {
  if (typeof raw !== "string") return null;
  const cleaned = raw
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, AUDIENCE_LABEL_MAX_CHARS);
  return cleaned.length > 0 ? cleaned : null;
}

export type AudienceLabelValidationFailureCode =
  | "audience_label_missing"
  | "audience_label_too_long";

export interface AudienceLabelValidationFailure {
  ok: false;
  code: AudienceLabelValidationFailureCode;
  message: string;
}

export interface AudienceLabelValidationSuccess {
  ok: true;
  value: string;
}

export type AudienceLabelValidationResult =
  | AudienceLabelValidationFailure
  | AudienceLabelValidationSuccess;

/**
 * Validate an audience-label value for the Send to Client confirm
 * action. Send to Client requires a non-empty label (canon § 3); the
 * raw mint paths accept null. Run `normalizeAudienceLabel` first then
 * validate so the sanitization is the same on both surfaces.
 */
export function validateAudienceLabel(
  raw: string | null | undefined,
): AudienceLabelValidationResult {
  const normalized = normalizeAudienceLabel(raw);
  if (!normalized) {
    return {
      ok: false,
      code: "audience_label_missing",
      message:
        "Audience label is required for Send to Client. Operators must record who the link was sent to before SLATE writes the audit event.",
    };
  }
  if (normalized.length > AUDIENCE_LABEL_MAX_CHARS) {
    // Defensive — `normalizeAudienceLabel` already enforces the cap.
    return {
      ok: false,
      code: "audience_label_too_long",
      message: `Audience label exceeds the ${AUDIENCE_LABEL_MAX_CHARS}-character maximum.`,
    };
  }
  return { ok: true, value: normalized };
}

export type RecipientEmailValidationFailureCode =
  | "recipient_email_invalid_shape"
  | "recipient_email_too_long";

export interface RecipientEmailValidationFailure {
  ok: false;
  code: RecipientEmailValidationFailureCode;
  message: string;
}

export interface RecipientEmailValidationSuccess {
  ok: true;
  /**
   * Trimmed + lowercased value ready to feed into
   * `hashRecipientEmail`. NEVER stored in raw form; the caller hashes
   * and discards.
   */
  normalizedForHashing: string;
}

export type RecipientEmailValidationResult =
  | RecipientEmailValidationFailure
  | RecipientEmailValidationSuccess
  | { ok: true; normalizedForHashing: null };

/**
 * Lightweight email shape check before the caller hashes via
 * `hashRecipientEmail`. Returns `{ok: true, normalizedForHashing: null}`
 * when the operator left the recipient-email field blank — Send to
 * Client treats this as canon-allowed.
 *
 * The shape check is INTENTIONALLY permissive (`local@domain` with at
 * least one dot in the domain part). SLATE never sends to this
 * address; the hash is opaque audit signal only. A stricter validator
 * would risk rejecting unusual-but-legitimate operator inputs (e.g.
 * `name+tag@subdomain.tld`) for no privacy benefit because the hash
 * survives either way.
 */
export function validateRecipientEmailForHashing(
  raw: string | null | undefined,
): RecipientEmailValidationResult {
  if (raw === null || raw === undefined) {
    return { ok: true, normalizedForHashing: null };
  }
  const trimmed = String(raw).trim();
  if (trimmed.length === 0) {
    return { ok: true, normalizedForHashing: null };
  }
  if (trimmed.length > RECIPIENT_EMAIL_MAX_CHARS) {
    return {
      ok: false,
      code: "recipient_email_too_long",
      message: `Recipient email exceeds the ${RECIPIENT_EMAIL_MAX_CHARS}-character maximum.`,
    };
  }
  // Local@domain.tld, permissive. No quoted-local-part, no IP-literal.
  const shape = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!shape.test(trimmed)) {
    return {
      ok: false,
      code: "recipient_email_invalid_shape",
      message:
        "Recipient email does not match a basic local@domain.tld shape.",
    };
  }
  return { ok: true, normalizedForHashing: trimmed.toLowerCase() };
}

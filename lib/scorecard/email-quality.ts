/**
 * Lightweight email-quality classification used by the public
 * scorecard's anti-abuse pipeline.
 *
 * Deliberately does NOT call out to DNS (MX / A record lookups), nor
 * to external validation APIs — both are slow and flaky in serverless
 * and a gentler local heuristic catches the volume of garbage we see
 * today. If conversion data later shows we need a real verification
 * step, that lands as its own decision.
 */

export type EmailQuality =
  | "valid_format"
  | "disposable_blocked"
  | "free_email"
  | "business_domain"
  | "unknown";

export type EmailRejection = "invalid_format" | "disposable_blocked";

export interface EmailClassification {
  quality: EmailQuality;
  /** Lowercased, trimmed email — empty string if input couldn't be normalized. */
  normalized: string;
  /** Bare domain after the `@`, lowercased — empty string if absent. */
  domain: string;
  /** When the email is unfit for submission, the controlled reason; null when accepted. */
  rejection: EmailRejection | null;
  /** Free-form notes appended to the lead's `trust_reasons` array. */
  reasons: string[];
}

// ---------------------------------------------------------------------------
// Blocklists
// ---------------------------------------------------------------------------

/**
 * Deliberately small, hand-curated disposable / throwaway-email list.
 * Hosts that exist solely to receive throwaway signups belong here.
 * Keep this list short — long lists fight rather than help conversion.
 */
const DISPOSABLE_DOMAINS: ReadonlySet<string> = new Set([
  "mailinator.com",
  "tempmail.com",
  "temp-mail.org",
  "10minutemail.com",
  "guerrillamail.com",
  "guerrillamail.info",
  "yopmail.com",
  "throwawaymail.com",
  "trashmail.com",
  "trashmail.de",
  "sharklasers.com",
  "getairmail.com",
  "fakeinbox.com",
  "maildrop.cc",
  "dispostable.com",
  "mintemail.com",
  "mohmal.com",
]);

/** Common consumer-mail providers. Allowed, but flagged as `free_email`
 *  so operators can spot them in the inbox; we don't reject these. */
const FREE_DOMAINS: ReadonlySet<string> = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "yahoo.co.uk",
  "yahoo.ca",
  "ymail.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "proton.me",
  "protonmail.com",
  "pm.me",
  "fastmail.com",
  "tutanota.com",
  "zoho.com",
  "gmx.com",
  "gmx.us",
]);

/** Obviously fake / placeholder hosts that show up in test traffic. */
const FAKE_DOMAINS: ReadonlySet<string> = new Set([
  "example.com",
  "example.org",
  "example.net",
  "test.com",
  "test.test",
  "asdf.com",
  "no.no",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(input: string): string {
  if (typeof input !== "string") return "";
  return input.trim().toLowerCase();
}

export function isValidEmailSyntax(input: string): boolean {
  const v = normalizeEmail(input);
  if (v.length === 0 || v.length > 254) return false;
  if (!EMAIL_RE.test(v)) return false;
  // Reject double-dots and trailing dots in the local-part.
  const [local] = v.split("@");
  if (!local || local.startsWith(".") || local.endsWith(".")) return false;
  if (local.includes("..")) return false;
  return true;
}

export function getEmailDomain(input: string): string {
  const v = normalizeEmail(input);
  const idx = v.lastIndexOf("@");
  if (idx < 0 || idx === v.length - 1) return "";
  return v.slice(idx + 1);
}

export function isDisposableEmailDomain(domain: string): boolean {
  if (!domain) return false;
  return DISPOSABLE_DOMAINS.has(domain.toLowerCase());
}

export function isFreeEmailDomain(domain: string): boolean {
  if (!domain) return false;
  return FREE_DOMAINS.has(domain.toLowerCase());
}

export function isFakeEmailDomain(domain: string): boolean {
  if (!domain) return false;
  return FAKE_DOMAINS.has(domain.toLowerCase());
}

/**
 * Classify an email for the scorecard pipeline.
 *
 * - Invalid syntax → reject.
 * - Disposable / throwaway / obvious-fake hosts → reject.
 * - Free consumer providers → accept but tag `free_email`.
 * - Anything else → accept as `business_domain`.
 */
export function classifyEmailQuality(rawEmail: string): EmailClassification {
  const normalized = normalizeEmail(rawEmail);

  if (!isValidEmailSyntax(normalized)) {
    return {
      quality: "unknown",
      normalized,
      domain: "",
      rejection: "invalid_format",
      reasons: ["invalid_email_format"],
    };
  }

  const domain = getEmailDomain(normalized);

  if (isDisposableEmailDomain(domain) || isFakeEmailDomain(domain)) {
    return {
      quality: "disposable_blocked",
      normalized,
      domain,
      rejection: "disposable_blocked",
      reasons: [`disposable_domain:${domain}`],
    };
  }

  if (isFreeEmailDomain(domain)) {
    return {
      quality: "free_email",
      normalized,
      domain,
      rejection: null,
      reasons: [`free_email_domain:${domain}`],
    };
  }

  return {
    quality: "business_domain",
    normalized,
    domain,
    rejection: null,
    reasons: [],
  };
}

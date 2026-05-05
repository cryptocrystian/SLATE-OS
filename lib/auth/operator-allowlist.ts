/**
 * Operator allowlist policy for SLATE magic-link sign-in.
 *
 * Two configurable env vars (server-only — never `NEXT_PUBLIC_`):
 *
 *   SLATE_OPERATOR_EMAIL_ALLOWLIST   comma-separated exact emails
 *   SLATE_OPERATOR_DOMAIN_ALLOWLIST  comma-separated bare domains (no `@`)
 *
 * Behavior:
 *   - Empty input is rejected.
 *   - Email is normalized (trim + lowercase) before comparison.
 *   - An email is authorized iff it appears in the explicit list OR
 *     its domain part appears in the domain list.
 *   - **Fail closed:** if neither allowlist is configured (both empty),
 *     no email is authorized. There is no "open" mode — production and
 *     development behave identically. Local test addresses must be
 *     listed explicitly.
 *
 * The check happens in `signInWithMagicLink` *before* Supabase is called,
 * so unauthorized addresses never trigger an OTP send and never leak
 * existence-of-account information through Supabase rate-limit timing.
 */

interface Allowlist {
  emails: ReadonlySet<string>;
  domains: ReadonlySet<string>;
}

function parseAllowlist(): Allowlist {
  const emails = new Set(
    (process.env.SLATE_OPERATOR_EMAIL_ALLOWLIST ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  const domains = new Set(
    (process.env.SLATE_OPERATOR_DOMAIN_ALLOWLIST ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase().replace(/^@/, ""))
      .filter(Boolean),
  );
  return { emails, domains };
}

/**
 * `true` if the email is authorized for SLATE operator access.
 * Fail-closed when no allowlist is configured.
 */
export function isAuthorizedOperator(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  if (!normalized) return false;

  const { emails, domains } = parseAllowlist();
  if (emails.size === 0 && domains.size === 0) return false;

  if (emails.has(normalized)) return true;

  const at = normalized.lastIndexOf("@");
  if (at < 0) return false;
  const domain = normalized.slice(at + 1);
  return domains.has(domain);
}

/**
 * `true` only when at least one allowlist env is non-empty. Useful for
 * surfacing a controlled startup error in dev when the operator forgot
 * to populate `.env.local`.
 */
export function isOperatorAllowlistConfigured(): boolean {
  const { emails, domains } = parseAllowlist();
  return emails.size > 0 || domains.size > 0;
}

import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Stakeholder intake token helpers.
 *
 * Public stakeholders authenticate against `/intake/[token]` with an
 * opaque random string. SLATE never stores the raw token: the database
 * holds only the sha256 hash, and every public route hashes the
 * provided token before lookup.
 *
 * Design notes:
 *   - 32 bytes of cryptographic randomness, base64url-encoded → ~43 chars.
 *   - sha256 hex hash for storage. Hex is unique-indexable in Postgres
 *     and reads cleanly in admin tooling without being ambiguous about
 *     case or padding.
 *   - The raw token never appears in logs, telemetry, or final reports.
 */

const TOKEN_BYTES = 32;

/** Generate a fresh opaque token and its sha256 hash. The raw token is
 *  returned exactly once — store the hash, surface the URL containing
 *  the raw token to the operator, and discard the raw value.
 */
export function generateIntakeToken(): { token: string; tokenHash: string } {
  const buf = randomBytes(TOKEN_BYTES);
  const token = toBase64Url(buf);
  return { token, tokenHash: hashIntakeToken(token) };
}

/** Hash a raw token for lookup. Always normalize before hashing so the
 *  caller cannot accidentally produce a different hash by varying URL
 *  encoding or whitespace.
 */
export function hashIntakeToken(rawToken: string): string {
  const normalized = normalizeRawToken(rawToken);
  return createHash("sha256").update(normalized).digest("hex");
}

/** Constant-time comparison of two hex hashes. */
export function compareTokenHashes(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "hex"), Buffer.from(b, "hex"));
  } catch {
    return false;
  }
}

/** Validate that a raw token has a plausible base64url shape before any
 *  DB call. Rejects anything that obviously cannot be a SLATE token.
 */
export function isPlausibleRawToken(rawToken: string): boolean {
  if (typeof rawToken !== "string") return false;
  const trimmed = rawToken.trim();
  if (trimmed.length < 32 || trimmed.length > 128) return false;
  return /^[A-Za-z0-9_-]+$/.test(trimmed);
}

/** Build the public `/intake/<token>` URL. Caller is responsible for
 *  showing this exactly once and never persisting the raw token.
 */
export function buildIntakeUrl(siteUrl: string, rawToken: string): string {
  const base = siteUrl.replace(/\/+$/, "");
  return `${base}/intake/${rawToken}`;
}

function normalizeRawToken(raw: string): string {
  return String(raw ?? "").trim();
}

function toBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/=+$/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

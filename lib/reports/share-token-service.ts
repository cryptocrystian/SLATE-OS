import "server-only";

import { createHash, randomBytes } from "node:crypto";

import {
  DEFAULT_SHARE_TOKEN_EXPIRY_DAYS,
  MAX_SHARE_TOKEN_EXPIRY_DAYS,
} from "./share-token-types";

/**
 * Phase 1B Sprint 4D-B — pure token service helpers.
 *
 * Canon (docs/22 §Token Format & Hash-At-Rest):
 *   - Raw tokens are opaque random strings; NEVER JWTs.
 *   - 256-bit entropy from `crypto.randomBytes(32)`.
 *   - Encoded as URL-safe base64 (`base64url`) so the raw token is
 *     drop-in for a future `/r/[token]` route segment without
 *     percent-encoding.
 *   - The raw token is shown to the operator exactly once. The DB
 *     persists only `sha256(rawToken)` as lowercase hex (the shape
 *     enforced by the `report_share_tokens_token_hash_shape_check`
 *     constraint in migration 0014).
 *
 * Pure module — no DB, no I/O, no React. `node:crypto` only.
 */

const BYTE_ENTROPY = 32; // 256 bits

/**
 * Generate a fresh raw share token. The returned string must be
 * delivered to the operator exactly once and never persisted in raw
 * form anywhere SLATE controls.
 *
 * `base64url` is supported by Node's Buffer encoding and produces only
 * `[A-Za-z0-9_-]` characters (no `=` padding for our 32-byte input,
 * which divides evenly into 4-byte groups for base64).
 */
export function generateRawShareToken(): string {
  return randomBytes(BYTE_ENTROPY).toString("base64url");
}

/**
 * Hash a raw share token to its at-rest representation. SHA-256, hex,
 * lowercase. The migration's CHECK constraint rejects any value that
 * does not match `^[a-f0-9]{64}$`, so this helper IS the contract.
 */
export function hashShareToken(rawToken: string): string {
  return createHash("sha256").update(rawToken, "utf8").digest("hex");
}

/**
 * Compute an expiry timestamp `days` days from `now`. Defaults to the
 * canon's 14-day window. Always returns an ISO 8601 string.
 */
export function calculateShareTokenExpiry(options?: {
  days?: number;
  now?: Date;
}): string {
  const days = options?.days ?? DEFAULT_SHARE_TOKEN_EXPIRY_DAYS;
  const now = options?.now ?? new Date();
  const ms = days * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() + ms).toISOString();
}

/**
 * Returns `true` iff the requested `expiresAt` is strictly after `now`
 * AND within the canon's max-30-day window. Used by the action layer
 * to reject malformed or out-of-policy expiry inputs before insert.
 */
export function isExpiryWithinPolicy(
  expiresAt: string,
  options?: { now?: Date; maxDays?: number },
): boolean {
  const now = options?.now ?? new Date();
  const maxDays = options?.maxDays ?? MAX_SHARE_TOKEN_EXPIRY_DAYS;
  const expiry = new Date(expiresAt);
  if (Number.isNaN(expiry.getTime())) return false;
  if (expiry.getTime() <= now.getTime()) return false;
  const maxAllowedMs = maxDays * 24 * 60 * 60 * 1000;
  return expiry.getTime() - now.getTime() <= maxAllowedMs;
}

/**
 * Hash a recipient email (if the operator chooses to track one) to the
 * same SHA-256 hex shape the DB CHECK enforces. Lowercases and trims
 * first so canonicalisation matches the operator's typical paste.
 */
export function hashRecipientEmail(rawEmail: string): string {
  const normalized = rawEmail.trim().toLowerCase();
  return createHash("sha256").update(normalized, "utf8").digest("hex");
}

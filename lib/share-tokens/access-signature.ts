import "server-only";

import { createHash } from "node:crypto";

/**
 * Production Hardening Sprint H1 — shared access-signature helper for
 * report and proposal share-link public routes.
 *
 * Centralizes the pepper-handling + hash-or-omit posture both surfaces
 * had previously duplicated. Pure module — no DB, no I/O, no React.
 *
 * Privacy contract (mirrors `docs/22` § Public Route Security +
 * `docs/24` § Client Proposal Route Security):
 *
 *   - Raw IP + raw User-Agent are NEVER persisted by SLATE. They reach
 *     this helper from `next/headers` `headers()` reads only.
 *
 *   - When `SLATE_SHARE_TOKEN_ACCESS_PEPPER` is configured to a
 *     non-empty value:
 *       - IP / UA are hashed via `sha256(pepper + ":" + value)` and the
 *         result is truncated to 128 bits of hex (32 chars). Enough
 *         fingerprint to debounce repeated reads from the same viewer;
 *         too little entropy to reverse to the original input.
 *       - `hashesOmitted` = false.
 *
 *   - When the pepper is unset / empty:
 *       - The helper RETURNS without computing low-entropy un-peppered
 *         hashes (which would be reversible against a small input
 *         space). Both hashes are null and `hashesOmitted` = true.
 *       - The public-route render path MUST NOT crash. Debounce
 *         features that depend on a stable signature degrade gracefully
 *         (see `lib/reports/share-token-public.ts` +
 *         `lib/proposals/share-token-public.ts` for the deg paths).
 *
 *   - Stable metadata key shape: callers must use `ipSig` / `uaSig` /
 *     `hashesOmitted` (NOT `ip` / `userAgent` / `tokenHash` / `email`),
 *     because `lib/activity/log.ts` strips any metadata key matching
 *     its `FORBIDDEN_KEY_PATTERNS` regex set. The helper's return shape
 *     is therefore the contract — callers must not rename the fields
 *     downstream.
 *
 * PRODUCTION RECOMMENDATION: set `SLATE_SHARE_TOKEN_ACCESS_PEPPER` in
 * the production environment before relying on IP / UA fingerprinting
 * (debounce, repeat-access detection, geo-clustering). Without the
 * pepper SLATE refuses to compute hashes at all, so any feature that
 * depends on them silently degrades to a "log every access" posture.
 */

const PEPPER_ENV = "SLATE_SHARE_TOKEN_ACCESS_PEPPER";
const HASH_BYTES = 16; // 128 bits — enough fingerprint, no PII

export interface ShareTokenAccessPepperStatus {
  /** True iff `SLATE_SHARE_TOKEN_ACCESS_PEPPER` is non-empty. */
  configured: boolean;
  /**
   * Environment-name the runtime reads. Stable string for
   * documentation surfaces — do NOT log the actual pepper value.
   */
  envName: typeof PEPPER_ENV;
}

export function getShareTokenAccessPepperStatus(): ShareTokenAccessPepperStatus {
  const pepper = process.env[PEPPER_ENV];
  return {
    configured: typeof pepper === "string" && pepper.length > 0,
    envName: PEPPER_ENV,
  };
}

/**
 * Convenience flag — equivalent to `!getShareTokenAccessPepperStatus().configured`,
 * exposed as a named function so its callsites read clearly.
 */
export function shouldOmitAccessHashes(): boolean {
  return !getShareTokenAccessPepperStatus().configured;
}

export interface ShareTokenAccessFingerprintInput {
  ip?: string | null;
  userAgent?: string | null;
}

export interface ShareTokenAccessFingerprint {
  /** Peppered SHA-256 hex truncated to 128 bits, or null when omitted. */
  ipHash: string | null;
  /** Peppered SHA-256 hex truncated to 128 bits, or null when omitted. */
  uaHash: string | null;
  /**
   * Combined `(ip, ua)` signature suitable for debounce keys. Null when
   * both hashes are omitted or when neither component was supplied.
   */
  combinedSig: string | null;
  /**
   * True when no pepper was configured at the runtime. Callers should
   * surface this on the activity event under the literal key
   * `hashesOmitted` so the operator audit trail shows why no
   * fingerprint was recorded.
   */
  hashesOmitted: boolean;
}

/**
 * Hash an IP + user-agent pair into a peppered fingerprint. When no
 * pepper is configured, returns all-null hashes with
 * `hashesOmitted: true`. The caller decides whether to skip persistence,
 * skip debounce, or surface the omission on its own activity event.
 *
 * `ip` and `userAgent` arrive as strings from `next/headers` reads and
 * may be null/undefined. Empty strings are treated identically to null.
 */
export function hashAccessFingerprint(
  input: ShareTokenAccessFingerprintInput,
): ShareTokenAccessFingerprint {
  const pepper = process.env[PEPPER_ENV];
  if (typeof pepper !== "string" || pepper.length === 0) {
    return {
      ipHash: null,
      uaHash: null,
      combinedSig: null,
      hashesOmitted: true,
    };
  }
  const ip = (input.ip ?? "").trim();
  const ua = (input.userAgent ?? "").trim();
  const ipHash = ip.length > 0 ? peppered(ip, pepper) : null;
  const uaHash = ua.length > 0 ? peppered(ua, pepper) : null;
  // Combined signature only when both components were supplied. A
  // single-component signature would collide across different
  // user-agents behind the same IP (NAT'd offices) or across the same
  // viewer's two browsers from the same IP — both undesirable for
  // debounce keys.
  const combinedSig =
    ipHash && uaHash ? peppered(`${ipHash}|${uaHash}`, pepper) : null;
  return {
    ipHash,
    uaHash,
    combinedSig,
    hashesOmitted: false,
  };
}

function peppered(value: string, pepper: string): string {
  return createHash("sha256")
    .update(`${pepper}:${value}`, "utf8")
    .digest("hex")
    .slice(0, HASH_BYTES * 2); // hex => 2 chars per byte
}

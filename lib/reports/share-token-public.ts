import "server-only";

import { logActivityEvent } from "@/lib/activity/log";
import {
  hashAccessFingerprint,
  type ShareTokenAccessFingerprint,
} from "@/lib/share-tokens/access-signature";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

import { mapReportDeliverySnapshotRow } from "./delivery-snapshot-mappers";
import type {
  DbReportDeliverySnapshotRow,
  ReportDeliverySnapshot,
} from "./delivery-snapshot-types";
import { evaluateReportShareEligibility } from "./share-token-eligibility";
import { mapReportShareTokenRow } from "./share-token-mappers";
import { hashShareToken } from "./share-token-service";
import type {
  DbReportShareTokenRow,
  ReportShareToken,
} from "./share-token-types";

/**
 * Phase 1B Sprint 4D-C — public-route helpers for `/r/[token]`.
 *
 * The public route is anonymous (no auth, no session, no cookie). RLS on
 * `report_share_tokens` is operator-full; anonymous reads would return
 * zero rows. The canon therefore mandates a **server-side privileged
 * lookup** via the service-role client, never anonymous Supabase. All
 * helpers in this module use `createSupabaseServiceClient()` and run
 * inside server components / route handlers only.
 *
 * Generic-rejection rule:
 *   Every blocked state — unknown token, revoked, expired, voided
 *   snapshot, ineligible snapshot — surfaces the same `status` shape so
 *   the caller can render an identical "unavailable" page. The route
 *   MUST NOT leak which condition failed.
 *
 * No raw token logged. No token_hash logged. No IP / UA in raw form.
 */

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

// ---------------------------------------------------------------------------
// Token lookup
// ---------------------------------------------------------------------------

export interface ShareTokenLookupResult {
  token: ReportShareToken;
  snapshot: ReportDeliverySnapshot;
}

/**
 * Resolve a raw share token to its `report_share_tokens` row + paired
 * snapshot row via the service-role client. Returns null when no row
 * matches the SHA-256 hash (caller MUST treat null and every other
 * failure identically — see `evaluateShareTokenPublicAccess`).
 *
 * Per `docs/22` § Token Format & Hash-At-Rest the raw token is never
 * persisted by SLATE; this helper exists exactly so the public route
 * can re-derive the hash from the URL segment and look the row up
 * itself.
 */
export async function lookupShareTokenByRawToken(
  rawToken: string,
): Promise<ShareTokenLookupResult | null> {
  if (!isPlausibleRawToken(rawToken)) return null;

  const supabase = createSupabaseServiceClient();
  const tokenHash = hashShareToken(rawToken);

  const { data: tokenData, error: tokenError } = await supabase
    .from("report_share_tokens")
    .select(SHARE_TOKEN_SELECT)
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (tokenError) {
    // Sanitized server-side log; token hash + raw token never leave
    // this scope.
    console.error("[reports.share-tokens.public] lookup-failed", {
      name: tokenError.name,
      code: tokenError.code,
      message: tokenError.message,
    });
    return null;
  }
  if (!tokenData) return null;
  const token = mapReportShareTokenRow(
    tokenData as unknown as DbReportShareTokenRow,
  );

  const { data: snapshotData, error: snapshotError } = await supabase
    .from("report_delivery_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("id", token.snapshotId)
    .maybeSingle();
  if (snapshotError) {
    console.error("[reports.share-tokens.public] snapshot-fetch-failed", {
      name: snapshotError.name,
      code: snapshotError.code,
      message: snapshotError.message,
    });
    return null;
  }
  if (!snapshotData) return null;
  const snapshot = mapReportDeliverySnapshotRow(
    snapshotData as unknown as DbReportDeliverySnapshotRow,
  );

  return { token, snapshot };
}

// ---------------------------------------------------------------------------
// Access evaluation
// ---------------------------------------------------------------------------

export type ShareTokenPublicAccessStatus =
  | "allowed"
  | "not_found"
  | "revoked"
  | "expired"
  | "snapshot_voided"
  | "snapshot_ineligible";

export interface ShareTokenPublicAccessResult {
  status: ShareTokenPublicAccessStatus;
  /**
   * True when the token's status was `active` but `expires_at` has
   * already passed. The caller should attempt a status flip
   * (`flipShareTokenExpired`) but render the generic-unavailable page
   * regardless of the flip outcome.
   */
  shouldFlipExpired?: boolean;
  /**
   * Internal-only reason code. NEVER surfaced to the public route — it
   * exists for server-side logging only.
   */
  reason?: string;
}

/**
 * Decide whether a share token may render its snapshot publicly. Every
 * blocked state returns a distinct `status` for server-side logging
 * but the route MUST render the same generic page for all of them.
 *
 * Re-runs the snapshot eligibility evaluator at render time as
 * defense-in-depth — a token minted while the snapshot was eligible
 * can later be invalidated by a snapshot void or an over-age snapshot.
 */
export function evaluateShareTokenPublicAccess(
  lookup: ShareTokenLookupResult | null,
  now: Date = new Date(),
): ShareTokenPublicAccessResult {
  if (!lookup) {
    return { status: "not_found" };
  }
  const { token, snapshot } = lookup;

  if (token.snapshotId !== snapshot.id) {
    // Should be impossible given how lookup pairs them, but check
    // anyway — never let a mismatched pair render.
    return { status: "not_found", reason: "token_snapshot_mismatch" };
  }

  if (token.status === "revoked") {
    return { status: "revoked" };
  }

  const expiry = new Date(token.expiresAt);
  if (Number.isNaN(expiry.getTime())) {
    return { status: "expired", reason: "expires_at_unparseable" };
  }
  const isExpired = expiry.getTime() <= now.getTime();
  if (token.status === "expired" || isExpired) {
    return {
      status: "expired",
      shouldFlipExpired: token.status === "active" && isExpired,
    };
  }

  // Status here is `active` and not past expiry. Validate the snapshot.
  if (snapshot.status === "voided") {
    return { status: "snapshot_voided" };
  }

  const eligibility = evaluateReportShareEligibility(snapshot, { now });
  if (!eligibility.eligible) {
    return {
      status: "snapshot_ineligible",
      reason: eligibility.reasons.map((r) => r.code).join(","),
    };
  }

  return { status: "allowed" };
}

// ---------------------------------------------------------------------------
// Expiry status flip
// ---------------------------------------------------------------------------

/**
 * Render-time status flip for tokens whose `expires_at` has passed but
 * whose `status` is still `active`. Best-effort: errors are logged and
 * swallowed so the public-route rendering path never crashes.
 *
 * Returns the new status if the flip happened, null otherwise.
 */
export async function flipShareTokenExpired(
  tokenId: string,
): Promise<"expired" | null> {
  const supabase = createSupabaseServiceClient();
  // Guard the update with `status = 'active'` so concurrent flips /
  // revocations don't clobber each other.
  const { data, error } = await supabase
    .from("report_share_tokens")
    .update({ status: "expired" })
    .eq("id", tokenId)
    .eq("status", "active")
    .select("id, engagement_id")
    .maybeSingle<{ id: string; engagement_id: string }>();
  if (error) {
    console.error("[reports.share-tokens.public] flip-expired-failed", {
      tokenId,
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return null;
  }
  if (!data?.id) return null;

  // Activity event uses the service-role logger so it lands even
  // though there's no operator session.
  await logActivityEvent(
    {
      eventType: "report_share_token_expired",
      entityType: "report_share_token",
      entityId: tokenId,
      engagementId: data.engagement_id,
      title: "Report share token expired",
      summary:
        "Share token expired at render time. SLATE flipped its status to `expired` and rendered the generic unavailable page.",
      metadata: { flippedAt: new Date().toISOString() },
    },
    { viaServiceRole: true },
  );

  return "expired";
}

// ---------------------------------------------------------------------------
// Access recording
// ---------------------------------------------------------------------------

export interface ShareTokenAccessMetadata {
  /** Raw IP (e.g. from `x-forwarded-for`). NEVER persisted in raw form. */
  ip?: string | null;
  /** Raw user-agent string. NEVER persisted in raw form. */
  userAgent?: string | null;
}

/**
 * 5-minute debounce window for repeat reads from the same fingerprint.
 *
 * Production Hardening Sprint H1 — when a peppered signature is
 * available AND the same signature appears within this window, SLATE
 * skips the access_count increment + skips the activity event so the
 * timeline does not show a screenful of duplicate accesses from a
 * single browser-tab refresh storm.
 *
 * The debounce is best-effort and degrades gracefully:
 *   - No pepper → no signature → no debounce → existing behaviour.
 *   - No IP / no UA in request → no combined signature → no debounce.
 *   - Signature mismatch → no debounce.
 *   - Signature match but window expired → re-emit.
 *
 * `access_count` is a soft counter (canon explicitly does NOT treat it
 * as a security boundary) so under-counting during a debounce window
 * is an accepted MVP trade.
 */
const ACCESS_LOG_DEBOUNCE_MS = 5 * 60 * 1000;

/**
 * Increment access_count + last_accessed_at on a token and emit a
 * sanitized `report_share_token_accessed` activity event. Best-effort:
 * a logging or update failure never blocks the public render.
 *
 * Privacy:
 *   - The raw token is never an input. The caller passes `tokenId`.
 *   - Raw IP / user-agent are accepted as inputs but NEVER persisted.
 *     The shared `hashAccessFingerprint` helper hashes both with the
 *     server-side `SLATE_SHARE_TOKEN_ACCESS_PEPPER` pepper. When the
 *     pepper is not configured the helper omits hashes entirely and
 *     surfaces that fact via `hashesOmitted: true` rather than persist
 *     a low-entropy un-peppered hash.
 *
 * Debounce (Sprint H1):
 *   - When a combined `(ip, ua)` signature is available, SLATE writes
 *     it under `metadata.lastAccessSig` + `metadata.lastAccessSigAt`
 *     on the token row. On a subsequent access, if the signature
 *     matches and the timestamp is within the 5-minute window, SLATE
 *     skips the counter bump + activity event. `last_accessed_at`
 *     stays unchanged (the previous bump captured the start of the
 *     window).
 *   - When no signature is available (pepper unset OR missing
 *     IP / UA), debounce is bypassed and every access is logged. This
 *     is the safe-degrade posture — production should set the pepper.
 */
export async function recordShareTokenAccess(
  tokenId: string,
  meta: ShareTokenAccessMetadata = {},
): Promise<void> {
  const supabase = createSupabaseServiceClient();

  const accessedAt = new Date().toISOString();
  const fingerprint = hashAccessFingerprint({
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  // Read current state — access_count, last_accessed_at, and the
  // metadata blob holding the prior debounce signature.
  const { data: existing, error: readError } = await supabase
    .from("report_share_tokens")
    .select("id, engagement_id, access_count, last_accessed_at, metadata")
    .eq("id", tokenId)
    .maybeSingle<{
      id: string;
      engagement_id: string;
      access_count: number;
      last_accessed_at: string | null;
      metadata: Record<string, unknown> | null;
    }>();
  if (readError || !existing?.id) {
    if (readError) {
      console.error("[reports.share-tokens.public] access-read-failed", {
        tokenId,
        name: readError.name,
        code: readError.code,
        message: readError.message,
      });
    }
    return;
  }

  // Debounce: matching signature within the 5-min window → no-op.
  if (
    fingerprint.combinedSig &&
    isWithinDebounceWindow(
      existing.metadata,
      fingerprint.combinedSig,
      accessedAt,
    )
  ) {
    return;
  }

  const nextCount = (existing.access_count ?? 0) + 1;
  const nextMetadata = mergeDebounceSignature(
    existing.metadata,
    fingerprint.combinedSig,
    accessedAt,
  );

  const { error: updateError } = await supabase
    .from("report_share_tokens")
    .update({
      access_count: nextCount,
      last_accessed_at: accessedAt,
      metadata: nextMetadata,
    })
    .eq("id", tokenId);
  if (updateError) {
    console.error("[reports.share-tokens.public] access-update-failed", {
      tokenId,
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    // Continue: still log the activity event even if the counter
    // failed to bump (audit trail beats counter accuracy).
  }

  await logActivityEvent(
    {
      eventType: "report_share_token_accessed",
      entityType: "report_share_token",
      entityId: tokenId,
      engagementId: existing.engagement_id,
      title: "Report share token accessed",
      summary:
        "Public share link rendered. SLATE recorded an access event with peppered request fingerprints only.",
      metadata: buildAccessActivityMetadata(
        accessedAt,
        nextCount,
        fingerprint,
      ),
    },
    { viaServiceRole: true },
  );
}

function buildAccessActivityMetadata(
  accessedAt: string,
  accessCount: number,
  fingerprint: ShareTokenAccessFingerprint,
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    accessedAt,
    accessCount,
  };
  // Per the activity logger's FORBIDDEN_KEY_PATTERNS, `userAgent` and
  // `ip` keys would be stripped. `ipSig` / `uaSig` / `hashesOmitted`
  // survive — the shared helper's return shape is the contract.
  if (fingerprint.uaHash) base.uaSig = fingerprint.uaHash;
  if (fingerprint.ipHash) base.ipSig = fingerprint.ipHash;
  if (fingerprint.hashesOmitted) base.hashesOmitted = true;
  return base;
}

function isWithinDebounceWindow(
  rawMetadata: Record<string, unknown> | null,
  signature: string,
  nowIso: string,
): boolean {
  if (!rawMetadata || typeof rawMetadata !== "object") return false;
  const meta = rawMetadata as {
    lastAccessSig?: unknown;
    lastAccessSigAt?: unknown;
  };
  if (typeof meta.lastAccessSig !== "string" || meta.lastAccessSig.length === 0)
    return false;
  if (
    typeof meta.lastAccessSigAt !== "string" ||
    meta.lastAccessSigAt.length === 0
  )
    return false;
  if (meta.lastAccessSig !== signature) return false;
  const last = new Date(meta.lastAccessSigAt).getTime();
  const now = new Date(nowIso).getTime();
  if (!Number.isFinite(last) || !Number.isFinite(now)) return false;
  return now - last < ACCESS_LOG_DEBOUNCE_MS;
}

function mergeDebounceSignature(
  rawMetadata: Record<string, unknown> | null,
  signature: string | null,
  nowIso: string,
): Record<string, unknown> {
  const base =
    rawMetadata && typeof rawMetadata === "object"
      ? { ...(rawMetadata as Record<string, unknown>) }
      : {};
  if (signature) {
    base.lastAccessSig = signature;
    base.lastAccessSigAt = nowIso;
  } else {
    // Pepper unset OR partial signature — strip stale debounce state
    // so a future configured-pepper run does not collide.
    delete base.lastAccessSig;
    delete base.lastAccessSigAt;
  }
  return base;
}

// ---------------------------------------------------------------------------
// Helpers — token shape + access-metadata sanitization
// ---------------------------------------------------------------------------

function isPlausibleRawToken(raw: unknown): raw is string {
  if (typeof raw !== "string") return false;
  // base64url, 32 bytes → 43 chars without padding. We accept 16–256
  // chars to leave room for future entropy bumps without locking the
  // shape too tightly.
  if (raw.length < 16 || raw.length > 256) return false;
  // base64url alphabet only — rejects path-traversal and shell
  // metacharacters at the boundary.
  return /^[A-Za-z0-9_-]+$/.test(raw);
}

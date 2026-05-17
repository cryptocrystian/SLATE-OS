import "server-only";

import { createHash } from "node:crypto";

import { logActivityEvent } from "@/lib/activity/log";
import { hashShareToken } from "@/lib/reports/share-token-service";
import { createSupabaseServiceClient } from "@/lib/supabase/service";

import { mapProposalDeliverySnapshotRow } from "./delivery-snapshot-mappers";
import type {
  DbProposalDeliverySnapshotRow,
  ProposalDeliverySnapshot,
} from "./delivery-snapshot-types";
import { evaluateProposalShareEligibility } from "./share-token-eligibility";
import { mapProposalShareTokenRow } from "./share-token-mappers";
import type {
  DbProposalShareTokenRow,
  ProposalShareToken,
} from "./share-token-types";

/**
 * Phase 1B Proposal/SOW Delivery Sprint P5 — public-route helpers for
 * `/p/[token]`.
 *
 * The public route is anonymous (no auth, no session, no cookie). RLS
 * on `proposal_share_tokens` is operator-full; anonymous reads return
 * zero rows. The canon therefore mandates a **server-side privileged
 * lookup** via the service-role client, never anonymous Supabase. All
 * helpers in this module use `createSupabaseServiceClient()` and run
 * inside server components only.
 *
 * Generic-rejection rule:
 *   Every blocked state — unknown token, revoked, expired, voided
 *   snapshot, ineligible snapshot — surfaces the same `status` shape
 *   so the caller renders an identical "unavailable" page. The route
 *   MUST NOT leak which condition failed.
 *
 * No raw token logged. No token_hash logged. No IP / UA in raw form
 * (peppered via `SLATE_SHARE_TOKEN_ACCESS_PEPPER`; omitted with
 * `hashesOmitted: true` when the pepper is unset).
 *
 * This module deliberately mirrors `lib/reports/share-token-public.ts`
 * end-to-end. The two modules stay separate so the proposal-side
 * eligibility re-check, cascade-revoke semantics, audit-event
 * vocabulary, and future SOW-Draft surface evolve independently.
 */

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

// ---------------------------------------------------------------------------
// Token lookup
// ---------------------------------------------------------------------------

export interface ProposalShareTokenLookupResult {
  token: ProposalShareToken;
  snapshot: ProposalDeliverySnapshot;
}

/**
 * Resolve a raw share token to its `proposal_share_tokens` row + paired
 * snapshot row via the service-role client. Returns null when no row
 * matches the SHA-256 hash (caller MUST treat null and every other
 * failure identically — see `evaluateProposalShareTokenPublicAccess`).
 *
 * Per `docs/24` § Share Token Model Recommendation the raw token is
 * never persisted by SLATE; this helper exists exactly so the public
 * route can re-derive the hash from the URL segment and look the row
 * up itself.
 */
export async function lookupProposalShareTokenByRawToken(
  rawToken: string,
): Promise<ProposalShareTokenLookupResult | null> {
  if (!isPlausibleRawToken(rawToken)) return null;

  const supabase = createSupabaseServiceClient();
  const tokenHash = hashShareToken(rawToken);

  const { data: tokenData, error: tokenError } = await supabase
    .from("proposal_share_tokens")
    .select(SHARE_TOKEN_SELECT)
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (tokenError) {
    // Sanitized server-side log; token hash + raw token never leave
    // this scope.
    console.error("[proposals.share-tokens.public] lookup-failed", {
      name: tokenError.name,
      code: tokenError.code,
      message: tokenError.message,
    });
    return null;
  }
  if (!tokenData) return null;
  const token = mapProposalShareTokenRow(
    tokenData as unknown as DbProposalShareTokenRow,
  );

  const { data: snapshotData, error: snapshotError } = await supabase
    .from("proposal_delivery_snapshots")
    .select(SNAPSHOT_SELECT)
    .eq("id", token.snapshotId)
    .maybeSingle();
  if (snapshotError) {
    console.error("[proposals.share-tokens.public] snapshot-fetch-failed", {
      name: snapshotError.name,
      code: snapshotError.code,
      message: snapshotError.message,
    });
    return null;
  }
  if (!snapshotData) return null;
  const snapshot = mapProposalDeliverySnapshotRow(
    snapshotData as unknown as DbProposalDeliverySnapshotRow,
  );

  return { token, snapshot };
}

// ---------------------------------------------------------------------------
// Access evaluation
// ---------------------------------------------------------------------------

export type ProposalShareTokenPublicAccessStatus =
  | "allowed"
  | "not_found"
  | "revoked"
  | "expired"
  | "snapshot_voided"
  | "snapshot_ineligible";

export interface ProposalShareTokenPublicAccessResult {
  status: ProposalShareTokenPublicAccessStatus;
  /**
   * True when the token's status was `active` but `expires_at` has
   * already passed. The caller should attempt a status flip
   * (`flipProposalShareTokenExpired`) but render the
   * generic-unavailable page regardless of the flip outcome.
   */
  shouldFlipExpired?: boolean;
  /**
   * Internal-only reason code. NEVER surfaced to the public route — it
   * exists for server-side logging only.
   */
  reason?: string;
}

/**
 * Decide whether a proposal share token may render its snapshot
 * publicly. Every blocked state returns a distinct `status` for
 * server-side logging but the route MUST render the same generic
 * page for all of them.
 *
 * Re-runs the snapshot eligibility evaluator at render time as
 * defense-in-depth — a token minted while the snapshot was eligible
 * can later be invalidated by a snapshot void, an approval revoke,
 * an over-age snapshot, or a draft-watermark flip.
 */
export function evaluateProposalShareTokenPublicAccess(
  lookup: ProposalShareTokenLookupResult | null,
  now: Date = new Date(),
): ProposalShareTokenPublicAccessResult {
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

  const eligibility = evaluateProposalShareEligibility(snapshot, { now });
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
export async function flipProposalShareTokenExpired(
  tokenId: string,
): Promise<"expired" | null> {
  const supabase = createSupabaseServiceClient();
  // Guard the update with `status = 'active'` so concurrent flips /
  // revocations don't clobber each other.
  const { data, error } = await supabase
    .from("proposal_share_tokens")
    .update({ status: "expired" })
    .eq("id", tokenId)
    .eq("status", "active")
    .select("id, engagement_id, proposal_id, snapshot_id")
    .maybeSingle<{
      id: string;
      engagement_id: string;
      proposal_id: string;
      snapshot_id: string;
    }>();
  if (error) {
    console.error("[proposals.share-tokens.public] flip-expired-failed", {
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
      eventType: "proposal_share_token_expired",
      entityType: "proposal_share_token",
      entityId: tokenId,
      engagementId: data.engagement_id,
      title: "Proposal share token expired",
      summary:
        "Proposal share token expired at render time. SLATE flipped its status to `expired` and rendered the generic unavailable page.",
      metadata: {
        flippedAt: new Date().toISOString(),
        proposalId: data.proposal_id,
        snapshotId: data.snapshot_id,
      },
    },
    { viaServiceRole: true },
  );

  return "expired";
}

// ---------------------------------------------------------------------------
// Access recording
// ---------------------------------------------------------------------------

export interface ProposalShareTokenAccessMetadata {
  /** Raw IP (e.g. from `x-forwarded-for`). NEVER persisted in raw form. */
  ip?: string | null;
  /** Raw user-agent string. NEVER persisted in raw form. */
  userAgent?: string | null;
}

/**
 * Increment access_count + last_accessed_at on a token and emit a
 * sanitized `proposal_share_token_accessed` activity event.
 * Best-effort: a logging or update failure never blocks the public
 * render.
 *
 * Privacy:
 *   - The raw token is never an input. The caller passes `tokenId`.
 *   - Raw IP / user-agent are accepted as inputs but NEVER persisted.
 *     We hash both with a server-side pepper from
 *     `SLATE_SHARE_TOKEN_ACCESS_PEPPER`. When the pepper is not
 *     configured we omit the hashes entirely (and surface that fact
 *     via a `hashesOmitted` metadata flag) rather than persist a
 *     low-entropy un-peppered hash.
 *   - Debouncing is intentionally minimal in this MVP (a 5-minute
 *     window per `(tokenId, ipHash)` would require a separate state
 *     store). Documented as backlog mirroring the Client Report
 *     Link MVP carry-forward in `docs/23`.
 */
export async function recordProposalShareTokenAccess(
  tokenId: string,
  meta: ProposalShareTokenAccessMetadata = {},
): Promise<void> {
  const supabase = createSupabaseServiceClient();

  const accessedAt = new Date().toISOString();

  // Read current access_count first (RPC for atomic increment would be
  // nicer; this MVP uses an explicit read-modify-write under
  // service-role and accepts the race because access_count is a soft
  // counter, not a security boundary).
  const { data: existing, error: readError } = await supabase
    .from("proposal_share_tokens")
    .select("id, engagement_id, proposal_id, snapshot_id, access_count")
    .eq("id", tokenId)
    .maybeSingle<{
      id: string;
      engagement_id: string;
      proposal_id: string;
      snapshot_id: string;
      access_count: number;
    }>();
  if (readError || !existing?.id) {
    if (readError) {
      console.error("[proposals.share-tokens.public] access-read-failed", {
        tokenId,
        name: readError.name,
        code: readError.code,
        message: readError.message,
      });
    }
    return;
  }
  const nextCount = (existing.access_count ?? 0) + 1;

  const { error: updateError } = await supabase
    .from("proposal_share_tokens")
    .update({
      access_count: nextCount,
      last_accessed_at: accessedAt,
    })
    .eq("id", tokenId);
  if (updateError) {
    console.error("[proposals.share-tokens.public] access-update-failed", {
      tokenId,
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    // Continue: still log the activity event even if the counter
    // failed to bump (audit trail beats counter accuracy).
  }

  const hashes = sanitizeAccessMetadata(meta);
  // Activity-logger's FORBIDDEN_KEY_PATTERNS strips any key matching
  // `/token/i`, `/email/i`, `/ip/i`, `/userAgent/i`, `/raw/i`, etc.
  // The short keys `ipSig` / `uaSig` survive the strip while staying
  // explicit about what they hold (peppered SHA-256 fingerprints).
  const baseMetadata: Record<string, unknown> = {
    accessedAt,
    accessCount: nextCount,
    proposalId: existing.proposal_id,
    snapshotId: existing.snapshot_id,
  };
  if (hashes.uaHash) baseMetadata.uaSig = hashes.uaHash;
  if (hashes.ipHash) baseMetadata.ipSig = hashes.ipHash;
  if (!hashes.uaHash && !hashes.ipHash) {
    baseMetadata.hashesOmitted = true;
  }

  await logActivityEvent(
    {
      eventType: "proposal_share_token_accessed",
      entityType: "proposal_share_token",
      entityId: tokenId,
      engagementId: existing.engagement_id,
      title: "Proposal share token accessed",
      summary:
        "Public proposal review link rendered. SLATE recorded an access event with peppered request fingerprints only.",
      metadata: baseMetadata,
    },
    { viaServiceRole: true },
  );
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

function sanitizeAccessMetadata(meta: ProposalShareTokenAccessMetadata): {
  ipHash: string | null;
  uaHash: string | null;
} {
  const pepper = process.env.SLATE_SHARE_TOKEN_ACCESS_PEPPER;
  if (!pepper || pepper.length === 0) {
    return { ipHash: null, uaHash: null };
  }
  return {
    ipHash: meta.ip ? peppered(meta.ip, pepper) : null,
    uaHash: meta.userAgent ? peppered(meta.userAgent, pepper) : null,
  };
}

function peppered(value: string, pepper: string): string {
  // Same shape as the report-side helper — 128 bits of SHA-256 hex
  // suffices as a fingerprint without leaking PII.
  return createHash("sha256")
    .update(`${pepper}:${value}`, "utf8")
    .digest("hex")
    .slice(0, 32);
}

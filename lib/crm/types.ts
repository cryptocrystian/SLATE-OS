/**
 * Sprint S3-B — Provider-neutral CRM context shape.
 *
 * Canon: `docs/42_ATTIO_CRM_SYSTEM_OF_RECORD_CANON.md` § 13.
 *
 * This module defines the shape UI components import. It is provider-
 * neutral on purpose: future CRM migrations (HubSpot, GHL, etc.) swap
 * the connector and mapper layers WITHOUT touching UI imports.
 *
 * Boundary rules:
 *   - UI components import from this module only.
 *   - Provider-specific API types live in `lib/crm/<provider>/types.ts`
 *     and never leak past the connector boundary.
 *   - All optional fields are nullable so missing-property handling is
 *     uniform: the mapper returns `null` and pushes a warning.
 */

export type CrmProvider = "attio";

/** Currency-bearing value with provider-supplied or operator-set currency. */
export interface CrmCurrencyValue {
  amount: number;
  currency: string;
}

/** Lightweight actor reference suitable for "Owner: …" display copy. */
export interface CrmActorRef {
  displayName: string;
  /** Optional initials for avatar fallback. */
  initials: string | null;
}

/** Contact summary derived from CRM People / Person object. */
export interface CrmContactContext {
  providerContactId: string;
  fullName: string | null;
  primaryEmail: string | null;
  primaryRole: string | null;
  /** Provider permalink — operator can click out to the CRM record. */
  externalUrl: string | null;
}

/** Deal / opportunity context surfaced alongside the Company. */
export interface CrmDealContext {
  providerDealId: string;
  name: string | null;
  pipelineStage: string | null;
  value: CrmCurrencyValue | null;
  /** ISO 8601 close-date estimate, when present. */
  expectedCloseAt: string | null;
  /** Provider permalink. */
  externalUrl: string | null;
}

/** Activity / recent-engagement summary. */
export interface CrmActivityContext {
  /** ISO 8601 last-touch timestamp (any channel). */
  lastTouchAt: string | null;
  /** Short preview of most recent note / activity, capped at ~280 chars. */
  recentSummary: string | null;
  /** Provider permalink to the most-recent note / activity record. */
  recentUrl: string | null;
}

/** Account-level context (the Company side of the CRM). */
export interface CrmAccountContext {
  providerAccountId: string;
  name: string | null;
  /** Primary domain when known; helpful for cross-system reconciliation. */
  domain: string | null;
  /** Per docs/42 § 8 — Saipien Brand / Business Unit. */
  brand: string | null;
  leadSource: string | null;
  knownPainPointsPreview: string | null;
  buyingTimeline: string | null;
  /** Provider permalink to the Company record. */
  externalUrl: string | null;
}

/** Operator-readable warning emitted when a non-critical field is absent. */
export interface CrmContextWarning {
  /** Stable code so the UI can switch on it. */
  code:
    | "missing-attribute"
    | "missing-related-record"
    | "rate-limited"
    | "fetch-error";
  /** Operator-facing message; safe to render verbatim. */
  message: string;
  /** Optional context for debug surfaces. */
  detail?: string | null;
}

/** Top-level container the query layer returns to the UI. */
export interface CrmContext {
  provider: CrmProvider;
  account: CrmAccountContext;
  relationshipOwner: CrmActorRef | null;
  activity: CrmActivityContext;
  deals: CrmDealContext[];
  contacts: CrmContactContext[];
  warnings: CrmContextWarning[];
  /** ISO 8601 — when the fetcher actually pulled the data. */
  fetchedAt: string;
}

/**
 * Status of an attempt to load `CrmContext` for an account / engagement.
 *
 * - `linked`     — Attio company is linked; full context (or partial
 *                   with warnings).
 * - `not-linked` — no `attio_company_id` on the SLATE account row.
 * - `fetch-failed` — link exists but the provider request did not
 *                    succeed (rate limit, bad ID, network).
 * - `not-configured` — no provider credentials are configured at all.
 */
export type CrmContextSourceStatus =
  | { status: "linked"; context: CrmContext }
  | { status: "not-linked"; provider: CrmProvider; accountId: string }
  | { status: "fetch-failed"; provider: CrmProvider; reason: string }
  | { status: "not-configured"; provider: CrmProvider };

// ---------------------------------------------------------------------------
// Server-action input / result shapes
// ---------------------------------------------------------------------------

export interface LinkAccountToAttioCompanyInput {
  /** SLATE accounts.id (UUID) */
  accountId: string;
  /** Attio company record_id (UUID-shaped, but typed `string` for
   *  provider neutrality). Operator copies this from Attio. */
  attioCompanyId: string;
}

export type LinkAccountToAttioCompanyResult =
  | { ok: true; accountId: string; attioCompanyId: string }
  | {
      ok: false;
      error:
        | "unauthenticated"
        | "invalid-account"
        | "invalid-attio-id"
        | "account-not-found"
        | "service-error";
    };

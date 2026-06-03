import "server-only";

/**
 * Sprint S3-B — Attio API response types.
 *
 * Confined to the connector boundary per `docs/42` § 13.2. UI components
 * MUST NOT import from this module — they use the provider-neutral
 * `CrmContext` shape in `lib/crm/types.ts` instead.
 *
 * These types model only the shapes the read-only adapter actually
 * touches. Attio's full API has many more endpoints + shapes; only what
 * the mappers need is typed here.
 *
 * Reference: https://docs.attio.com/rest-api
 */

// ---------------------------------------------------------------------------
// Common envelopes
// ---------------------------------------------------------------------------

export interface AttioListResponse<T> {
  data: T[];
}

export interface AttioSingletonResponse<T> {
  data: T;
}

/** Attio record ID is a `{workspace_id, object_id, record_id}` triple. */
export interface AttioRecordIdEnvelope {
  workspace_id: string;
  object_id: string;
  record_id: string;
}

// ---------------------------------------------------------------------------
// Value envelopes — Attio wraps each attribute value with provenance.
// ---------------------------------------------------------------------------

export interface AttioActiveAttributeValue {
  active_from: string | null;
  active_until: string | null;
  attribute_type: string;
  /** Raw value shape depends on `attribute_type`. */
  value?: unknown;
  /** Some types use `option` instead of `value`. */
  option?: { id?: { option_id?: string }; title?: string } | null;
  /** Some types use `target_record_id` for references. */
  target_record_id?: string | null;
  /** Currency / number / text variants. */
  currency_value?: number | null;
  currency_code?: string | null;
  number_value?: number | null;
  text_value?: string | null;
  /** Interaction-type variants. */
  interacted_at?: string | null;
  interaction_type?: string | null;
  /** Domain attribute. */
  domain?: string | null;
  /** Person / Owner attribute. */
  referenced_actor_type?: string | null;
  referenced_actor_id?: string | null;
}

/** Per-attribute value array. Most attributes carry a single active
 *  value but the API returns an array because some attributes are
 *  multi-valued (e.g. multi-select). */
export type AttioAttributeValues = AttioActiveAttributeValue[];

// ---------------------------------------------------------------------------
// Records
// ---------------------------------------------------------------------------

export interface AttioRecord {
  id: AttioRecordIdEnvelope;
  created_at: string;
  /** All attributes keyed by api_slug. */
  values: Record<string, AttioAttributeValues>;
  /** Optional permalink — not always returned. */
  web_url?: string | null;
}

// ---------------------------------------------------------------------------
// Notes (separate API path — used for the recent-activity pointer)
// ---------------------------------------------------------------------------

export interface AttioNote {
  id: { workspace_id: string; note_id: string };
  parent_object: string;
  parent_record_id: string;
  title: string | null;
  content_plaintext: string | null;
  created_at: string;
  web_url?: string | null;
}

// ---------------------------------------------------------------------------
// Self / workspace metadata
// ---------------------------------------------------------------------------

export interface AttioSelfResponse {
  active: boolean;
  scope: string;
  token_type: string;
  workspace_id: string;
  workspace_name: string;
  workspace_slug: string;
  authorized_by_workspace_member_id: string | null;
}

import "server-only";

import type {
  CrmAccountContext,
  CrmActivityContext,
  CrmActorRef,
  CrmContactContext,
  CrmContext,
  CrmContextWarning,
  CrmCurrencyValue,
  CrmDealContext,
} from "@/lib/crm/types";
import type { AttioRecord } from "./types";

/**
 * Sprint S3-B — Attio → CrmContext mappers.
 *
 * Canon: `docs/42` § 13.2.
 *
 * The mappers' job is to translate Attio's API shape into the
 * provider-neutral `CrmContext` shape. Missing properties never crash;
 * they emit `CrmContextWarning` entries the UI can render.
 *
 * Property name discipline:
 *   - Custom property api_slugs are pulled from a single constants
 *     block so renames in Attio require only one change here.
 *   - Standard Attio properties (`name`, `domains`, `last_interaction`,
 *     `strongest_connection_user`) are also pulled from that block.
 */

// ---------------------------------------------------------------------------
// Attribute slug constants — single source of truth
// ---------------------------------------------------------------------------

const COMPANY_SLUG = {
  // Standard Attio attributes — present on every workspace.
  name: "name",
  domains: "domains",
  lastInteraction: "last_interaction",
  strongestConnectionUser: "strongest_connection_user",
  // Custom attributes per docs/42 § 10 (operator creates these).
  brand: "brand",
  slateAccountId: "slate_account_id",
  slateEngagementId: "slate_engagement_id",
  leadSource: "lead_source",
  knownPainPoints: "known_pain_points",
  buyingTimeline: "buying_timeline",
  relationshipOwner: "relationship_owner",
} as const;

const DEAL_SLUG = {
  name: "name",
  stage: "stage",
  value: "value",
  expectedCloseDate: "expected_close_date",
} as const;

const PERSON_SLUG = {
  name: "name",
  emailAddresses: "email_addresses",
  jobTitle: "job_title",
} as const;

const KNOWN_PAIN_POINTS_PREVIEW_MAX = 280;

// ---------------------------------------------------------------------------
// Public mapper — Attio Company record → CrmContext
// ---------------------------------------------------------------------------

export interface AttioContextInput {
  company: AttioRecord;
  people: AttioRecord[];
  deals: AttioRecord[];
  /** ISO 8601 fetch timestamp. */
  fetchedAt: string;
}

export function mapAttioContextToCrmContext(
  input: AttioContextInput,
): CrmContext {
  const warnings: CrmContextWarning[] = [];

  const account = mapAccount(input.company, warnings);
  const relationshipOwner = mapRelationshipOwner(input.company, warnings);
  const activity = mapActivity(input.company);
  const deals = input.deals.map((d) => mapDeal(d));
  const contacts = input.people.map((p) => mapContact(p));

  return {
    provider: "attio",
    account,
    relationshipOwner,
    activity,
    deals,
    contacts,
    warnings,
    fetchedAt: input.fetchedAt,
  };
}

// ---------------------------------------------------------------------------
// Per-entity mappers
// ---------------------------------------------------------------------------

function mapAccount(
  company: AttioRecord,
  warnings: CrmContextWarning[],
): CrmAccountContext {
  const providerAccountId = company.id.record_id;
  const name = readText(company, COMPANY_SLUG.name);
  const domain = readDomain(company, COMPANY_SLUG.domains);

  const brand = readSelectTitle(company, COMPANY_SLUG.brand);
  if (brand === null) {
    warnings.push({
      code: "missing-attribute",
      message:
        "Attio Company does not have a `Brand` (api_slug `brand`) property set. Create the property and pick a value to enable brand chip rendering.",
    });
  }

  const leadSource = readSelectTitle(company, COMPANY_SLUG.leadSource);
  if (leadSource === null) {
    warnings.push({
      code: "missing-attribute",
      message:
        "Attio Company does not have a `Lead Source` (api_slug `lead_source`) property set.",
    });
  }

  const knownPainPointsRaw = readText(company, COMPANY_SLUG.knownPainPoints);
  const knownPainPointsPreview =
    knownPainPointsRaw === null
      ? null
      : truncate(knownPainPointsRaw, KNOWN_PAIN_POINTS_PREVIEW_MAX);
  if (knownPainPointsRaw === null) {
    warnings.push({
      code: "missing-attribute",
      message:
        "Attio Company does not have a `Known Pain Points` (api_slug `known_pain_points`) property set.",
    });
  }

  const buyingTimeline = readSelectTitle(company, COMPANY_SLUG.buyingTimeline);
  if (buyingTimeline === null) {
    warnings.push({
      code: "missing-attribute",
      message:
        "Attio Company does not have a `Buying Timeline` (api_slug `buying_timeline`) property set.",
    });
  }

  const externalUrl = `https://app.attio.com/saipien-labs/company/${providerAccountId}`;

  return {
    providerAccountId,
    name,
    domain,
    brand,
    leadSource,
    knownPainPointsPreview,
    buyingTimeline,
    externalUrl,
  };
}

function mapRelationshipOwner(
  company: AttioRecord,
  warnings: CrmContextWarning[],
): CrmActorRef | null {
  // Prefer an operator-curated `relationship_owner` property if present.
  const curatedRef = readActorReference(
    company,
    COMPANY_SLUG.relationshipOwner,
  );
  if (curatedRef) return curatedRef;

  // Fallback to the standard `strongest_connection_user`.
  const fallback = readActorReference(
    company,
    COMPANY_SLUG.strongestConnectionUser,
  );
  if (fallback) return fallback;

  warnings.push({
    code: "missing-attribute",
    message:
      "No Relationship Owner is available on this Attio Company (neither `relationship_owner` custom property nor `strongest_connection_user` is populated).",
  });
  return null;
}

function mapActivity(company: AttioRecord): CrmActivityContext {
  const lastTouchAt = readInteractionTimestamp(
    company,
    COMPANY_SLUG.lastInteraction,
  );
  return {
    lastTouchAt,
    // Recent-note preview + permalink would land in a follow-on sprint
    // that adds a `notes.ts` fetcher. S3-B intentionally surfaces only
    // the timestamp.
    recentSummary: null,
    recentUrl: null,
  };
}

function mapDeal(deal: AttioRecord): CrmDealContext {
  return {
    providerDealId: deal.id.record_id,
    name: readText(deal, DEAL_SLUG.name),
    pipelineStage: readSelectTitle(deal, DEAL_SLUG.stage),
    value: readCurrency(deal, DEAL_SLUG.value),
    expectedCloseAt: readDate(deal, DEAL_SLUG.expectedCloseDate),
    externalUrl: `https://app.attio.com/saipien-labs/deal/${deal.id.record_id}`,
  };
}

function mapContact(person: AttioRecord): CrmContactContext {
  return {
    providerContactId: person.id.record_id,
    fullName: readPersonName(person),
    primaryEmail: readPrimaryEmail(person, PERSON_SLUG.emailAddresses),
    primaryRole: readText(person, PERSON_SLUG.jobTitle),
    externalUrl: `https://app.attio.com/saipien-labs/person/${person.id.record_id}`,
  };
}

// ---------------------------------------------------------------------------
// Value-extraction helpers
// ---------------------------------------------------------------------------

function activeValue(record: AttioRecord, slug: string) {
  const arr = record.values?.[slug];
  if (!Array.isArray(arr) || arr.length === 0) return null;
  // Return the first value with `active_until === null` (currently active),
  // else fall back to the first value.
  return arr.find((v) => v.active_until == null) ?? arr[0];
}

function readText(record: AttioRecord, slug: string): string | null {
  const v = activeValue(record, slug);
  if (!v) return null;
  if (typeof v.value === "string" && v.value.trim().length > 0) return v.value;
  if (typeof v.text_value === "string" && v.text_value.trim().length > 0) {
    return v.text_value;
  }
  return null;
}

function readSelectTitle(record: AttioRecord, slug: string): string | null {
  const v = activeValue(record, slug);
  if (!v) return null;
  if (v.option?.title) return String(v.option.title);
  if (typeof v.value === "string" && v.value.trim().length > 0) return v.value;
  return null;
}

function readDomain(record: AttioRecord, slug: string): string | null {
  const v = activeValue(record, slug);
  if (!v) return null;
  if (typeof v.domain === "string" && v.domain.trim().length > 0) return v.domain;
  if (typeof v.value === "string" && v.value.trim().length > 0) return v.value;
  return null;
}

function readInteractionTimestamp(
  record: AttioRecord,
  slug: string,
): string | null {
  const v = activeValue(record, slug);
  if (!v) return null;
  if (typeof v.interacted_at === "string") return v.interacted_at;
  return null;
}

function readCurrency(
  record: AttioRecord,
  slug: string,
): CrmCurrencyValue | null {
  const v = activeValue(record, slug);
  if (!v) return null;
  const amount = v.currency_value;
  const currency = v.currency_code;
  if (typeof amount !== "number" || !currency) return null;
  return { amount, currency };
}

function readDate(record: AttioRecord, slug: string): string | null {
  const v = activeValue(record, slug);
  if (!v) return null;
  if (typeof v.value === "string" && v.value.trim().length > 0) return v.value;
  return null;
}

function readActorReference(
  record: AttioRecord,
  slug: string,
): CrmActorRef | null {
  const v = activeValue(record, slug);
  if (!v) return null;
  // Attio actor-reference values don't include the resolved display
  // name in the bare record fetch; a separate workspace-members lookup
  // is needed for the real name. For S3-B we return a placeholder
  // structure so the UI knows there's an owner but renders an
  // anonymized label. A follow-on sprint can add a workspace-member
  // resolver.
  const id = v.referenced_actor_id;
  if (!id) return null;
  return {
    displayName: "Attio user",
    initials: null,
  };
}

function readPersonName(person: AttioRecord): string | null {
  // Attio's `name` attribute on People is structured: { full_name,
  // first_name, last_name }.
  const v = activeValue(person, PERSON_SLUG.name);
  if (!v) return null;
  const raw = v.value as
    | { full_name?: string; first_name?: string; last_name?: string }
    | string
    | undefined
    | null;
  if (typeof raw === "string") return raw;
  if (raw && typeof raw === "object") {
    if (raw.full_name) return raw.full_name;
    const parts = [raw.first_name, raw.last_name].filter(Boolean).join(" ");
    return parts.length > 0 ? parts : null;
  }
  return null;
}

function readPrimaryEmail(
  person: AttioRecord,
  slug: string,
): string | null {
  const arr = person.values?.[slug];
  if (!Array.isArray(arr) || arr.length === 0) return null;
  for (const v of arr) {
    if (v.active_until != null) continue;
    const candidate =
      (v.value as { email_address?: string } | undefined)?.email_address ??
      (typeof v.value === "string" ? v.value : null);
    if (typeof candidate === "string" && candidate.includes("@")) {
      return candidate;
    }
  }
  return null;
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max - 1).trimEnd()}…`;
}

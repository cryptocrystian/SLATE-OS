/**
 * GovernanceOS input validation (pure; unit-tested). GOVERNANCEOS MODULE.
 *
 * Mirrors the DB CHECK constraints so the UI gets a precise, early error.
 * The database still enforces every rule; this never replaces it.
 */
import {
  ACTIVATION_MODES_AVAILABLE,
  ASSET_TYPES,
  AUTONOMY_LEVELS,
  CRITICALITIES,
  DATA_SENSITIVITIES,
  DEPLOYMENT_ENVIRONMENTS,
  LINK_RELATIONSHIPS,
  OVERSIGHT_MODES,
  POLICY_DOMAINS,
  PROGRAM_KINDS,
  REVIEW_CADENCES,
  SOURCE_SYSTEMS,
  type ActivationMode,
  type AssetType,
  type AutonomyLevel,
  type Criticality,
  type DataSensitivity,
  type DeploymentEnvironment,
  type LinkRelationship,
  type OversightMode,
  type PolicyDomain,
  type ProgramKind,
  type ReviewCadence,
  type SourceSystem,
} from "./types";

export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (s: unknown): s is string => typeof s === "string" && UUID_RE.test(s);

type Result<T> = { ok: true; value: T } | { ok: false; error: string };

function oneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === "string" && (list as readonly string[]).includes(v);
}

function optText(v: unknown, max: number): string | null | undefined | false {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (typeof v !== "string") return false;
  const t = v.trim();
  if (t.length === 0) return null;
  return t.length <= max ? t : false;
}

function optEnum<T extends string>(list: readonly T[], v: unknown): T | null | false {
  if (v === undefined || v === null || v === "") return null;
  return oneOf(list, v) ? v : false;
}

// -----------------------------------------------------------------------------
// Programs
// -----------------------------------------------------------------------------

export interface CreateProgramInput {
  programKind: ProgramKind;
  name: string;
  description: string | null;
  accountId: string | null;
  ventureSourceId: string | null;
  executiveSponsorName: string | null;
  defaultReviewCadence: ReviewCadence | null;
  nextProgramReviewAt: string | null;
}

export function validateCreateProgram(raw: Record<string, unknown>): Result<CreateProgramInput> {
  if (!oneOf(PROGRAM_KINDS, raw.programKind)) return { ok: false, error: "invalid-kind" };
  const name = optText(raw.name, 160);
  if (!name) return { ok: false, error: "invalid-name" };
  const description = optText(raw.description, 4000);
  if (description === false) return { ok: false, error: "invalid-description" };
  const sponsor = optText(raw.executiveSponsorName, 160);
  if (sponsor === false) return { ok: false, error: "invalid-sponsor" };
  const cadence = optEnum(REVIEW_CADENCES, raw.defaultReviewCadence);
  if (cadence === false) return { ok: false, error: "invalid-cadence" };
  const nextReview = parseOptionalDate(raw.nextProgramReviewAt);
  if (nextReview === false) return { ok: false, error: "invalid-review-date" };

  let accountId: string | null = null;
  let ventureSourceId: string | null = null;
  if (raw.programKind === "client") {
    if (!isUuid(raw.accountId)) return { ok: false, error: "account-required" };
    accountId = raw.accountId;
  } else if (raw.programKind === "venture") {
    const v = optText(raw.ventureSourceId, 200);
    if (!v) return { ok: false, error: "venture-source-required" };
    ventureSourceId = v;
  }

  return {
    ok: true,
    value: {
      programKind: raw.programKind,
      name,
      description: description ?? null,
      accountId,
      ventureSourceId,
      executiveSponsorName: sponsor ?? null,
      defaultReviewCadence: cadence,
      nextProgramReviewAt: nextReview,
    },
  };
}

function parseOptionalDate(v: unknown): string | null | false {
  if (v === undefined || v === null || v === "") return null;
  if (typeof v !== "string") return false;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? false : d.toISOString();
}

// -----------------------------------------------------------------------------
// Governed assets (also the cross-SLATE registration contract)
// -----------------------------------------------------------------------------

export interface AssetSourceInput {
  sourceSystem: SourceSystem;
  sourceEntityType: string;
  sourceEntityId: string;
  correlationId: string | null;
}

export interface RegisterAssetInput {
  assetType: AssetType;
  name: string;
  description: string | null;
  criticality: Criticality | null;
  dataSensitivity: DataSensitivity | null;
  autonomyLevel: AutonomyLevel | null;
  humanOversightMode: OversightMode | null;
  deploymentEnvironment: DeploymentEnvironment | null;
  externalVendor: string | null;
  modelProvider: string | null;
  modelIdentifier: string | null;
  intendedUse: string | null;
  prohibitedUses: string[];
  businessOwnerName: string | null;
  technicalOwnerName: string | null;
  source: AssetSourceInput | null;
  externalRuntimeId: string | null;
  parentGovernedAssetId: string | null;
}

export function validateRegisterAsset(raw: Record<string, unknown>): Result<RegisterAssetInput> {
  if (!oneOf(ASSET_TYPES, raw.assetType)) return { ok: false, error: "invalid-asset-type" };
  const name = optText(raw.name, 200);
  if (!name) return { ok: false, error: "invalid-name" };

  const texts: Record<string, number> = {
    description: 4000,
    externalVendor: 200,
    modelProvider: 200,
    modelIdentifier: 200,
    intendedUse: 4000,
    businessOwnerName: 160,
    technicalOwnerName: 160,
    externalRuntimeId: 200,
  };
  const t: Record<string, string | null> = {};
  for (const [k, max] of Object.entries(texts)) {
    const v = optText(raw[k], max);
    if (v === false) return { ok: false, error: `invalid-${k}` };
    t[k] = v ?? null;
  }

  const criticality = optEnum(CRITICALITIES, raw.criticality);
  const dataSensitivity = optEnum(DATA_SENSITIVITIES, raw.dataSensitivity);
  const autonomyLevel = optEnum(AUTONOMY_LEVELS, raw.autonomyLevel);
  const humanOversightMode = optEnum(OVERSIGHT_MODES, raw.humanOversightMode);
  const deploymentEnvironment = optEnum(DEPLOYMENT_ENVIRONMENTS, raw.deploymentEnvironment);
  if ([criticality, dataSensitivity, autonomyLevel, humanOversightMode, deploymentEnvironment].includes(false)) {
    return { ok: false, error: "invalid-dimension" };
  }

  let prohibitedUses: string[] = [];
  if (raw.prohibitedUses !== undefined && raw.prohibitedUses !== null) {
    if (!Array.isArray(raw.prohibitedUses)) return { ok: false, error: "invalid-prohibited-uses" };
    prohibitedUses = raw.prohibitedUses
      .filter((x): x is string => typeof x === "string")
      .map((x) => x.trim())
      .filter(Boolean)
      .slice(0, 25)
      .map((x) => x.slice(0, 300));
  }

  const source = validateSource(raw.source);
  if (source === false) return { ok: false, error: "invalid-source" };

  let parent: string | null = null;
  if (raw.parentGovernedAssetId !== undefined && raw.parentGovernedAssetId !== null && raw.parentGovernedAssetId !== "") {
    if (!isUuid(raw.parentGovernedAssetId)) return { ok: false, error: "invalid-parent" };
    parent = raw.parentGovernedAssetId;
  }

  return {
    ok: true,
    value: {
      assetType: raw.assetType,
      name,
      description: t.description,
      criticality: criticality || null,
      dataSensitivity: dataSensitivity || null,
      autonomyLevel: autonomyLevel || null,
      humanOversightMode: humanOversightMode || null,
      deploymentEnvironment: deploymentEnvironment || null,
      externalVendor: t.externalVendor,
      modelProvider: t.modelProvider,
      modelIdentifier: t.modelIdentifier,
      intendedUse: t.intendedUse,
      prohibitedUses,
      businessOwnerName: t.businessOwnerName,
      technicalOwnerName: t.technicalOwnerName,
      source,
      externalRuntimeId: t.externalRuntimeId,
      parentGovernedAssetId: parent,
    },
  };
}

/** Lineage is all-or-nothing and never an authorization input (docs/76 §5). */
export function validateSource(raw: unknown): AssetSourceInput | null | false {
  if (raw === undefined || raw === null) return null;
  if (typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  const system = r.sourceSystem;
  const type = optText(r.sourceEntityType, 80);
  const id = optText(r.sourceEntityId, 200);
  const corr = optText(r.correlationId, 200);
  if (!system && !type && !id) return null;
  if (!oneOf(SOURCE_SYSTEMS, system) || !type || !id || corr === false) return false;
  return { sourceSystem: system, sourceEntityType: type, sourceEntityId: id, correlationId: corr ?? null };
}

// -----------------------------------------------------------------------------
// Policies
// -----------------------------------------------------------------------------

export interface CreatePolicyInput {
  policyKey: string;
  name: string;
  policyDomain: PolicyDomain;
  statement: string;
  rationale: string | null;
  activationMode: ActivationMode;
}

export const POLICY_KEY_RE = /^[a-z0-9][a-z0-9_.-]{1,79}$/;

export function slugifyPolicyKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80) || "policy";
}

export function validatePolicyDraft(
  raw: Record<string, unknown>,
): Result<{ statement: string; rationale: string | null; activationMode: ActivationMode }> {
  const statement = optText(raw.statement, 8000);
  if (!statement) return { ok: false, error: "invalid-statement" };
  const rationale = optText(raw.rationale, 4000);
  if (rationale === false) return { ok: false, error: "invalid-rationale" };
  const mode = raw.activationMode ?? "advisory";
  if (!oneOf(ACTIVATION_MODES_AVAILABLE, mode)) return { ok: false, error: "activation-mode-unavailable" };
  return { ok: true, value: { statement, rationale: rationale ?? null, activationMode: mode } };
}

export function validateCreatePolicy(raw: Record<string, unknown>): Result<CreatePolicyInput> {
  const name = optText(raw.name, 200);
  if (!name) return { ok: false, error: "invalid-name" };
  if (!oneOf(POLICY_DOMAINS, raw.policyDomain)) return { ok: false, error: "invalid-domain" };
  const key = typeof raw.policyKey === "string" && raw.policyKey.trim() ? raw.policyKey.trim() : slugifyPolicyKey(name);
  if (!POLICY_KEY_RE.test(key)) return { ok: false, error: "invalid-policy-key" };
  const draft = validatePolicyDraft(raw);
  if (!draft.ok) return draft;
  return { ok: true, value: { policyKey: key, name, policyDomain: raw.policyDomain, ...draft.value } };
}

export function validateLinkRelationship(v: unknown): LinkRelationship | false {
  if (v === undefined || v === null || v === "") return "assessment";
  return oneOf(LINK_RELATIONSHIPS, v) ? v : false;
}

export function validateReason(v: unknown): string | false {
  const t = optText(v, 1000);
  return t ? t : false;
}

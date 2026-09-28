/**
 * GovernanceOS domain vocabulary + row shapes (docs/76). GOVERNANCEOS MODULE.
 *
 * Every union here mirrors a CHECK constraint in migrations 0026–0028.
 * Keep them in lockstep: the DB is the enforcement point, these types are
 * the compile-time mirror.
 */

export const PROGRAM_KINDS = ["client", "internal", "venture"] as const;
export type ProgramKind = (typeof PROGRAM_KINDS)[number];

export const PROGRAM_STATUSES = ["draft", "active", "paused", "archived"] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];

export const REVIEW_CADENCES = ["monthly", "quarterly", "semiannual", "annual"] as const;
export type ReviewCadence = (typeof REVIEW_CADENCES)[number];

export const PROGRAM_ROLES = [
  "program_admin",
  "governance_manager",
  "reviewer",
  "contributor",
  "viewer",
] as const;
export type ProgramRole = (typeof PROGRAM_ROLES)[number];

export const ASSET_TYPES = ["use_case", "ai_system", "model", "agent", "workflow", "vendor_service"] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

/** `approved` is reserved until G3 decision records exist (docs/76 §6). */
export const LIFECYCLE_STATUSES = ["proposed", "assessment", "active", "restricted", "retired"] as const;
export type LifecycleStatus = (typeof LIFECYCLE_STATUSES)[number];

export const CRITICALITIES = ["low", "medium", "high", "critical"] as const;
export type Criticality = (typeof CRITICALITIES)[number];

export const DATA_SENSITIVITIES = ["public", "internal", "confidential", "restricted", "regulated"] as const;
export type DataSensitivity = (typeof DATA_SENSITIVITIES)[number];

export const AUTONOMY_LEVELS = ["none", "assistive", "supervised", "conditional", "autonomous"] as const;
export type AutonomyLevel = (typeof AUTONOMY_LEVELS)[number];

export const OVERSIGHT_MODES = ["human_in_the_loop", "human_on_the_loop", "human_out_of_the_loop"] as const;
export type OversightMode = (typeof OVERSIGHT_MODES)[number];

export const DEPLOYMENT_ENVIRONMENTS = ["development", "staging", "production", "client_hosted", "other"] as const;
export type DeploymentEnvironment = (typeof DEPLOYMENT_ENVIRONMENTS)[number];

/** Cross-SLATE lineage (docs/76 §5). Canon module names, lowercase. */
export const SOURCE_SYSTEMS = [
  "consultos",
  "buildos",
  "ventureos",
  "integration",
  "runtime",
  "internal",
  "external",
] as const;
export type SourceSystem = (typeof SOURCE_SYSTEMS)[number];

export const POLICY_DOMAINS = [
  "autonomy",
  "deployment",
  "data",
  "model",
  "tool_access",
  "human_oversight",
  "change",
  "other",
] as const;
export type PolicyDomain = (typeof POLICY_DOMAINS)[number];

export const POLICY_VERSION_STATUSES = ["draft", "active", "superseded", "retired"] as const;
export type PolicyVersionStatus = (typeof POLICY_VERSION_STATUSES)[number];

/**
 * Activation ladder (docs/76 §2). Only `advisory` is accepted in G1;
 * `gated` unlocks in G3, `enforced` only with a registered adapter (G4+).
 */
export const ACTIVATION_MODES = ["advisory", "gated", "enforced"] as const;
export type ActivationMode = (typeof ACTIVATION_MODES)[number];
export const ACTIVATION_MODES_AVAILABLE: readonly ActivationMode[] = ["advisory"];

export const LINK_RELATIONSHIPS = ["baseline", "assessment", "remediation", "advisory", "other"] as const;
export type LinkRelationship = (typeof LINK_RELATIONSHIPS)[number];

// -----------------------------------------------------------------------------
// Row shapes (camelCase domain objects)
// -----------------------------------------------------------------------------

export interface GovernanceProgram {
  id: string;
  workspaceId: string;
  programKind: ProgramKind;
  accountId: string | null;
  accountName: string | null;
  ventureSourceId: string | null;
  name: string;
  description: string | null;
  status: ProgramStatus;
  ownerProfileId: string | null;
  executiveSponsorName: string | null;
  operatingModel: string | null;
  defaultReviewCadence: ReviewCadence | null;
  startedAt: string | null;
  nextProgramReviewAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface GovernedAsset {
  id: string;
  governanceProgramId: string;
  assetType: AssetType;
  name: string;
  description: string | null;
  lifecycleStatus: LifecycleStatus;
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
  operatorOwnerProfileId: string | null;
  businessOwnerName: string | null;
  technicalOwnerName: string | null;
  sourceSystem: SourceSystem | null;
  sourceEntityType: string | null;
  sourceEntityId: string | null;
  correlationId: string | null;
  externalRuntimeId: string | null;
  parentGovernedAssetId: string | null;
  createdAt: string;
  updatedAt: string;
  retiredAt: string | null;
}

export interface AssetLifecycleEvent {
  id: string;
  fromStatus: LifecycleStatus | null;
  toStatus: LifecycleStatus;
  reason: string | null;
  changedBy: string | null;
  changedByName: string | null;
  changedAt: string;
}

export interface GovernancePolicy {
  id: string;
  governanceProgramId: string;
  policyKey: string;
  name: string;
  policyDomain: PolicyDomain;
  ownerProfileId: string | null;
  createdAt: string;
  versions: GovernancePolicyVersion[];
}

export interface GovernancePolicyVersion {
  id: string;
  version: number;
  status: PolicyVersionStatus;
  activationMode: ActivationMode;
  statement: string;
  rationale: string | null;
  supersedesVersionId: string | null;
  createdAt: string;
  activatedAt: string | null;
  supersededAt: string | null;
  retiredAt: string | null;
}

export interface ProgramEngagementLink {
  id: string;
  engagementId: string | null;
  engagementRef: string;
  engagementNameSnapshot: string;
  relationshipType: LinkRelationship;
  linkedAt: string;
  unlinkedAt: string | null;
  unlinkReason: string | null;
}

// -----------------------------------------------------------------------------
// Display labels (UI copy lives with the vocabulary so it cannot drift)
// -----------------------------------------------------------------------------

export const LABELS = {
  programKind: { client: "Client", internal: "Internal", venture: "Venture" } satisfies Record<ProgramKind, string>,
  programStatus: { draft: "Draft", active: "Active", paused: "Paused", archived: "Archived" } satisfies Record<
    ProgramStatus,
    string
  >,
  assetType: {
    use_case: "Use case",
    ai_system: "AI system",
    model: "Model",
    agent: "Agent",
    workflow: "Workflow",
    vendor_service: "Vendor service",
  } satisfies Record<AssetType, string>,
  lifecycle: {
    proposed: "Proposed",
    assessment: "In assessment",
    active: "Active",
    restricted: "Restricted",
    retired: "Retired",
  } satisfies Record<LifecycleStatus, string>,
  sourceSystem: {
    consultos: "ConsultOS",
    buildos: "BuildOS",
    ventureos: "VentureOS",
    integration: "Integration / FDE",
    runtime: "Runtime",
    internal: "Saipien internal",
    external: "External",
  } satisfies Record<SourceSystem, string>,
  policyDomain: {
    autonomy: "Autonomy",
    deployment: "Deployment",
    data: "Data",
    model: "Model / provider",
    tool_access: "Tool access",
    human_oversight: "Human oversight",
    change: "Change",
    other: "Other",
  } satisfies Record<PolicyDomain, string>,
  activationMode: { advisory: "Advisory", gated: "Gated", enforced: "Enforced" } satisfies Record<ActivationMode, string>,
  role: {
    program_admin: "Program admin",
    governance_manager: "Governance manager",
    reviewer: "Reviewer",
    contributor: "Contributor",
    viewer: "Viewer",
  } satisfies Record<ProgramRole, string>,
} as const;

export function humanizeToken(value: string | null | undefined): string {
  if (!value) return "—";
  return value.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

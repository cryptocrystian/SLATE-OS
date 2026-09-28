import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "./validation";
import type {
  AssetLifecycleEvent,
  GovernancePolicy,
  GovernancePolicyVersion,
  GovernanceProgram,
  GovernedAsset,
  ProgramEngagementLink,
} from "./types";

/**
 * GovernanceOS read layer. GOVERNANCEOS MODULE.
 *
 * All reads run under the operator's session, so RLS decides visibility
 * (program role required). Reads are side-effect free.
 */

const PROGRAM_SELECT = `
  id, workspace_id, program_kind, account_id, venture_source_id, name, description, status,
  owner_profile_id, executive_sponsor_name, operating_model, default_review_cadence,
  started_at, next_program_review_at, archived_at, created_at, updated_at,
  account:accounts(name)
`;

type Row = Record<string, unknown>;

function mapProgram(r: Row): GovernanceProgram {
  const account = r.account as { name?: string } | null;
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    programKind: r.program_kind as GovernanceProgram["programKind"],
    accountId: (r.account_id as string) ?? null,
    accountName: account?.name ?? null,
    ventureSourceId: (r.venture_source_id as string) ?? null,
    name: r.name as string,
    description: (r.description as string) ?? null,
    status: r.status as GovernanceProgram["status"],
    ownerProfileId: (r.owner_profile_id as string) ?? null,
    executiveSponsorName: (r.executive_sponsor_name as string) ?? null,
    operatingModel: (r.operating_model as string) ?? null,
    defaultReviewCadence: (r.default_review_cadence as GovernanceProgram["defaultReviewCadence"]) ?? null,
    startedAt: (r.started_at as string) ?? null,
    nextProgramReviewAt: (r.next_program_review_at as string) ?? null,
    archivedAt: (r.archived_at as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function mapAsset(r: Row): GovernedAsset {
  return {
    id: r.id as string,
    governanceProgramId: r.governance_program_id as string,
    assetType: r.asset_type as GovernedAsset["assetType"],
    name: r.name as string,
    description: (r.description as string) ?? null,
    lifecycleStatus: r.lifecycle_status as GovernedAsset["lifecycleStatus"],
    criticality: (r.criticality as GovernedAsset["criticality"]) ?? null,
    dataSensitivity: (r.data_sensitivity as GovernedAsset["dataSensitivity"]) ?? null,
    autonomyLevel: (r.autonomy_level as GovernedAsset["autonomyLevel"]) ?? null,
    humanOversightMode: (r.human_oversight_mode as GovernedAsset["humanOversightMode"]) ?? null,
    deploymentEnvironment: (r.deployment_environment as GovernedAsset["deploymentEnvironment"]) ?? null,
    externalVendor: (r.external_vendor as string) ?? null,
    modelProvider: (r.model_provider as string) ?? null,
    modelIdentifier: (r.model_identifier as string) ?? null,
    intendedUse: (r.intended_use as string) ?? null,
    prohibitedUses: Array.isArray(r.prohibited_uses) ? (r.prohibited_uses as string[]) : [],
    operatorOwnerProfileId: (r.operator_owner_profile_id as string) ?? null,
    businessOwnerName: (r.business_owner_name as string) ?? null,
    technicalOwnerName: (r.technical_owner_name as string) ?? null,
    sourceSystem: (r.source_system as GovernedAsset["sourceSystem"]) ?? null,
    sourceEntityType: (r.source_entity_type as string) ?? null,
    sourceEntityId: (r.source_entity_id as string) ?? null,
    correlationId: (r.correlation_id as string) ?? null,
    externalRuntimeId: (r.external_runtime_id as string) ?? null,
    parentGovernedAssetId: (r.parent_governed_asset_id as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    retiredAt: (r.retired_at as string) ?? null,
  };
}

function mapVersion(r: Row): GovernancePolicyVersion {
  return {
    id: r.id as string,
    version: r.version as number,
    status: r.status as GovernancePolicyVersion["status"],
    activationMode: r.activation_mode as GovernancePolicyVersion["activationMode"],
    statement: r.statement as string,
    rationale: (r.rationale as string) ?? null,
    supersedesVersionId: (r.supersedes_version_id as string) ?? null,
    createdAt: r.created_at as string,
    activatedAt: (r.activated_at as string) ?? null,
    supersededAt: (r.superseded_at as string) ?? null,
    retiredAt: (r.retired_at as string) ?? null,
  };
}

function logError(scope: string, error: { code?: string; message?: string }) {
  console.error(`[governance.queries] ${scope}`, { code: error.code, message: error.message });
}

// -----------------------------------------------------------------------------

export async function listPrograms(): Promise<GovernanceProgram[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_programs")
    .select(PROGRAM_SELECT)
    .order("status", { ascending: true })
    .order("updated_at", { ascending: false });
  if (error) {
    logError("list-programs", error);
    return [];
  }
  return (data as Row[]).map(mapProgram);
}

export async function getProgram(programId: string): Promise<GovernanceProgram | null> {
  if (!isUuid(programId)) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_programs")
    .select(PROGRAM_SELECT)
    .eq("id", programId)
    .maybeSingle();
  if (error) {
    logError("get-program", error);
    return null;
  }
  return data ? mapProgram(data as Row) : null;
}

export async function listAssets(programId: string): Promise<GovernedAsset[]> {
  if (!isUuid(programId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governed_assets")
    .select("*")
    .eq("governance_program_id", programId)
    .order("created_at", { ascending: true });
  if (error) {
    logError("list-assets", error);
    return [];
  }
  return (data as Row[]).map(mapAsset);
}

export async function getAsset(programId: string, assetId: string): Promise<GovernedAsset | null> {
  if (!isUuid(programId) || !isUuid(assetId)) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governed_assets")
    .select("*")
    .eq("governance_program_id", programId)
    .eq("id", assetId)
    .maybeSingle();
  if (error) {
    logError("get-asset", error);
    return null;
  }
  return data ? mapAsset(data as Row) : null;
}

export async function listAssetLifecycle(assetId: string): Promise<AssetLifecycleEvent[]> {
  if (!isUuid(assetId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governed_asset_lifecycle_events")
    .select("id, from_status, to_status, reason, changed_by, changed_at, changer:profiles!governed_asset_lifecycle_events_changed_by_fkey(display_name)")
    .eq("governed_asset_id", assetId)
    .order("changed_at", { ascending: false });
  if (error) {
    logError("list-lifecycle", error);
    return [];
  }
  return (data as Row[]).map((r) => ({
    id: r.id as string,
    fromStatus: (r.from_status as AssetLifecycleEvent["fromStatus"]) ?? null,
    toStatus: r.to_status as AssetLifecycleEvent["toStatus"],
    reason: (r.reason as string) ?? null,
    changedBy: (r.changed_by as string) ?? null,
    changedByName: ((r.changer as { display_name?: string } | null)?.display_name as string) ?? null,
    changedAt: r.changed_at as string,
  }));
}

export async function listPolicies(programId: string): Promise<GovernancePolicy[]> {
  if (!isUuid(programId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_policies")
    .select("id, governance_program_id, policy_key, name, policy_domain, owner_profile_id, created_at, versions:governance_policy_versions(*)")
    .eq("governance_program_id", programId)
    .order("name", { ascending: true });
  if (error) {
    logError("list-policies", error);
    return [];
  }
  return (data as Row[]).map((r) => ({
    id: r.id as string,
    governanceProgramId: r.governance_program_id as string,
    policyKey: r.policy_key as string,
    name: r.name as string,
    policyDomain: r.policy_domain as GovernancePolicy["policyDomain"],
    ownerProfileId: (r.owner_profile_id as string) ?? null,
    createdAt: r.created_at as string,
    versions: ((r.versions as Row[]) ?? []).map(mapVersion).sort((a, b) => b.version - a.version),
  }));
}

export async function getPolicy(programId: string, policyId: string): Promise<GovernancePolicy | null> {
  const all = await listPolicies(programId);
  return all.find((p) => p.id === policyId) ?? null;
}

export async function listEngagementLinks(programId: string): Promise<ProgramEngagementLink[]> {
  if (!isUuid(programId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_program_engagements")
    .select("id, engagement_id, engagement_ref, engagement_name_snapshot, relationship_type, linked_at, unlinked_at, unlink_reason")
    .eq("governance_program_id", programId)
    .order("linked_at", { ascending: false });
  if (error) {
    logError("list-links", error);
    return [];
  }
  return (data as Row[]).map((r) => ({
    id: r.id as string,
    engagementId: (r.engagement_id as string) ?? null,
    engagementRef: r.engagement_ref as string,
    engagementNameSnapshot: r.engagement_name_snapshot as string,
    relationshipType: r.relationship_type as ProgramEngagementLink["relationshipType"],
    linkedAt: r.linked_at as string,
    unlinkedAt: (r.unlinked_at as string) ?? null,
    unlinkReason: (r.unlink_reason as string) ?? null,
  }));
}

/** ConsultOS engagements an operator could link (read-only use of ConsultOS data). */
export async function listLinkableEngagements(): Promise<Array<{ id: string; name: string; status: string; accountId: string }>> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("engagements")
    .select("id, name, status, account_id")
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    logError("list-linkable-engagements", error);
    return [];
  }
  return (data as Row[]).map((r) => ({
    id: r.id as string,
    name: r.name as string,
    status: r.status as string,
    accountId: r.account_id as string,
  }));
}

export async function listAccountsForPicker(): Promise<Array<{ id: string; name: string }>> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("accounts").select("id, name").order("name").limit(500);
  if (error) {
    logError("list-accounts", error);
    return [];
  }
  return (data as Row[]).map((r) => ({ id: r.id as string, name: r.name as string }));
}

export interface GovernanceActivityItem {
  id: string;
  eventType: string;
  entityType: string;
  entityId: string | null;
  title: string;
  summary: string | null;
  actorName: string | null;
  createdAt: string;
}

export async function listProgramActivity(programId: string, limit = 50): Promise<GovernanceActivityItem[]> {
  if (!isUuid(programId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("activity_events")
    .select("id, event_type, entity_type, entity_id, title, summary, created_at, actor:profiles!activity_events_actor_profile_id_fkey(display_name)")
    .eq("governance_program_id", programId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) {
    logError("list-activity", error);
    return [];
  }
  return (data as Row[]).map((r) => ({
    id: r.id as string,
    eventType: r.event_type as string,
    entityType: r.entity_type as string,
    entityId: (r.entity_id as string) ?? null,
    title: r.title as string,
    summary: (r.summary as string) ?? null,
    actorName: ((r.actor as { display_name?: string } | null)?.display_name as string) ?? null,
    createdAt: r.created_at as string,
  }));
}

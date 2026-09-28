import "server-only";

import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordGovernanceEvent } from "./activity";
import { requireProgramAction, requireProgramCreator, type GovernanceAuthError } from "./authorization";
import { LABELS, type LifecycleStatus, type ProgramStatus } from "./types";
import {
  isUuid,
  validateCreatePolicy,
  validateCreateProgram,
  validateLinkRelationship,
  validatePolicyDraft,
  validateReason,
  validateRegisterAsset,
  type RegisterAssetInput,
} from "./validation";

/**
 * GovernanceOS mutation service. GOVERNANCEOS MODULE.
 *
 * The single write path for GovernanceOS state, shared by operator server
 * actions (lib/governance/actions.ts) and cross-SLATE contracts
 * (lib/governance/contracts.ts). Every function:
 *   1. validates input (validation.ts),
 *   2. authorizes the caller (authorization.ts → permissions.ts; RLS again in DB),
 *   3. writes under the caller's session (RLS applies — no service role),
 *   4. emits a GovernanceOS activity event.
 *
 * Source identifiers supplied by callers are lineage, never proof of access.
 */

export type ServiceError =
  | GovernanceAuthError
  | "invalid-input"
  | "not-found"
  | "conflict"
  | "program-archived"
  | "invalid-transition"
  | "service-error";

export type ServiceResult<T = unknown> =
  | ({ ok: true } & T)
  | { ok: false; error: ServiceError; detail?: string };

function mapDbError(error: { code?: string; message?: string }): ServiceError {
  const msg = error.message ?? "";
  if (error.code === "23505") return "conflict";
  if (msg.includes("governance_program_archived")) return "program-archived";
  if (msg.includes("invalid_transition") || msg.includes("_retired") || msg.includes("immutable")) return "invalid-transition";
  if (error.code === "42501" || msg.includes("row-level security") || msg.includes("governance_forbidden")) return "forbidden";
  if (msg.includes("cross_workspace")) return "invalid-input";
  return "service-error";
}

function fail(scope: string, error: { code?: string; message?: string }): { ok: false; error: ServiceError } {
  console.error(`[governance.service] ${scope}`, { code: error.code, message: error.message });
  return { ok: false, error: mapDbError(error) };
}

// -----------------------------------------------------------------------------
// Programs
// -----------------------------------------------------------------------------

export async function createProgram(raw: Record<string, unknown>): Promise<ServiceResult<{ programId: string }>> {
  const parsed = validateCreateProgram(raw);
  if (!parsed.ok) return { ok: false, error: "invalid-input", detail: parsed.error };
  const auth = await requireProgramCreator();
  if (!auth.ok) return auth;
  const v = parsed.value;
  const id = randomUUID();

  const supabase = createSupabaseServerClient();
  // No `.select()`: the creator's program role is granted by an AFTER trigger,
  // so read the row back in a separate statement.
  const { error } = await supabase.from("governance_programs").insert({
    id,
    workspace_id: auth.actor.workspaceId,
    program_kind: v.programKind,
    account_id: v.accountId,
    venture_source_system: v.programKind === "venture" ? "ventureos" : null,
    venture_source_id: v.ventureSourceId,
    name: v.name,
    description: v.description,
    executive_sponsor_name: v.executiveSponsorName,
    default_review_cadence: v.defaultReviewCadence,
    next_program_review_at: v.nextProgramReviewAt,
    owner_profile_id: auth.actor.profileId,
    created_by: auth.actor.profileId,
  });
  if (error) return fail("create-program", error);

  await recordGovernanceEvent({
    workspaceId: auth.actor.workspaceId,
    programId: id,
    actorProfileId: auth.actor.profileId,
    eventType: "governance_program_created",
    entityType: "governance_program",
    entityId: id,
    title: `Program created: ${v.name}`,
    metadata: { programKind: v.programKind },
  });
  return { ok: true, programId: id };
}

const EDITABLE_PROGRAM_FIELDS = {
  name: "name",
  description: "description",
  executiveSponsorName: "executive_sponsor_name",
  operatingModel: "operating_model",
  defaultReviewCadence: "default_review_cadence",
  nextProgramReviewAt: "next_program_review_at",
} as const;

export async function updateProgram(
  programId: string,
  patch: Record<string, unknown>,
): Promise<ServiceResult> {
  if (!isUuid(programId)) return { ok: false, error: "invalid-input" };
  const auth = await requireProgramAction(programId, "program.edit");
  if (!auth.ok) return auth;

  const row: Record<string, unknown> = {};
  for (const [k, col] of Object.entries(EDITABLE_PROGRAM_FIELDS)) {
    if (!(k in patch)) continue;
    const val = patch[k];
    row[col] = typeof val === "string" ? val.trim() || null : val ?? null;
  }
  if (row.name === null) return { ok: false, error: "invalid-input", detail: "invalid-name" };
  if (typeof row.next_program_review_at === "string") {
    const d = new Date(row.next_program_review_at);
    if (Number.isNaN(d.getTime())) return { ok: false, error: "invalid-input", detail: "invalid-review-date" };
    row.next_program_review_at = d.toISOString();
  }
  if (Object.keys(row).length === 0) return { ok: true };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("governance_programs").update(row).eq("id", programId);
  if (error) return fail("update-program", error);

  await recordGovernanceEvent({
    workspaceId: auth.actor.workspaceId,
    programId,
    actorProfileId: auth.actor.profileId,
    eventType: "governance_program_updated",
    entityType: "governance_program",
    entityId: programId,
    title: "Program details updated",
    metadata: { fields: Object.keys(row).join(",") },
  });
  return { ok: true };
}

export async function transitionProgram(
  programId: string,
  to: ProgramStatus,
  reasonRaw: unknown,
): Promise<ServiceResult> {
  if (!isUuid(programId)) return { ok: false, error: "invalid-input" };
  const reason = validateReason(reasonRaw);
  if (!reason) return { ok: false, error: "invalid-input", detail: "reason-required" };
  const auth = await requireProgramAction(programId, "program.transition");
  if (!auth.ok) return auth;

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("governance_programs").update({ status: to }).eq("id", programId);
  if (error) return fail("transition-program", error);

  await recordGovernanceEvent({
    workspaceId: auth.actor.workspaceId,
    programId,
    actorProfileId: auth.actor.profileId,
    eventType: "governance_program_status_changed",
    entityType: "governance_program",
    entityId: programId,
    title: `Program ${LABELS.programStatus[to].toLowerCase()}`,
    summary: reason,
    metadata: { to },
  });
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Engagement links (ConsultOS → GovernanceOS, link never owner)
// -----------------------------------------------------------------------------

export async function linkEngagement(
  programId: string,
  engagementId: string,
  relationshipRaw: unknown,
): Promise<ServiceResult<{ linkId: string }>> {
  if (!isUuid(programId) || !isUuid(engagementId)) return { ok: false, error: "invalid-input" };
  const relationship = validateLinkRelationship(relationshipRaw);
  if (!relationship) return { ok: false, error: "invalid-input", detail: "invalid-relationship" };
  const auth = await requireProgramAction(programId, "engagement.link");
  if (!auth.ok) return auth;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_program_engagements")
    .insert({
      governance_program_id: programId,
      workspace_id: auth.actor.workspaceId,
      engagement_id: engagementId,
      engagement_ref: engagementId,
      engagement_name_snapshot: "(snapshot set by database)",
      relationship_type: relationship,
      linked_by: auth.actor.profileId,
    })
    .select("id, engagement_name_snapshot")
    .single<{ id: string; engagement_name_snapshot: string }>();
  if (error || !data) return fail("link-engagement", error ?? { message: "no row" });

  await recordGovernanceEvent({
    workspaceId: auth.actor.workspaceId,
    programId,
    actorProfileId: auth.actor.profileId,
    eventType: "governance_engagement_linked",
    entityType: "governance_program_engagement",
    entityId: data.id,
    title: `Engagement linked: ${data.engagement_name_snapshot}`,
    // docs/76 §7: engagement reference in metadata, never the cascading FK.
    metadata: { sourceEngagementId: engagementId, relationship },
  });
  return { ok: true, linkId: data.id };
}

export async function unlinkEngagement(
  programId: string,
  linkId: string,
  reasonRaw: unknown,
): Promise<ServiceResult> {
  if (!isUuid(programId) || !isUuid(linkId)) return { ok: false, error: "invalid-input" };
  const reason = validateReason(reasonRaw);
  if (!reason) return { ok: false, error: "invalid-input", detail: "reason-required" };
  const auth = await requireProgramAction(programId, "engagement.unlink");
  if (!auth.ok) return auth;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_program_engagements")
    .update({ unlinked_at: new Date().toISOString(), unlinked_by: auth.actor.profileId, unlink_reason: reason })
    .eq("id", linkId)
    .eq("governance_program_id", programId)
    .is("unlinked_at", null)
    .select("engagement_ref, engagement_name_snapshot")
    .maybeSingle<{ engagement_ref: string; engagement_name_snapshot: string }>();
  if (error) return fail("unlink-engagement", error);
  if (!data) return { ok: false, error: "not-found" };

  await recordGovernanceEvent({
    workspaceId: auth.actor.workspaceId,
    programId,
    actorProfileId: auth.actor.profileId,
    eventType: "governance_engagement_unlinked",
    entityType: "governance_program_engagement",
    entityId: linkId,
    title: `Engagement unlinked: ${data.engagement_name_snapshot}`,
    summary: reason,
    metadata: { sourceEngagementId: data.engagement_ref },
  });
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Governed assets
// -----------------------------------------------------------------------------

function assetRow(v: RegisterAssetInput) {
  return {
    asset_type: v.assetType,
    name: v.name,
    description: v.description,
    criticality: v.criticality,
    data_sensitivity: v.dataSensitivity,
    autonomy_level: v.autonomyLevel,
    human_oversight_mode: v.humanOversightMode,
    deployment_environment: v.deploymentEnvironment,
    external_vendor: v.externalVendor,
    model_provider: v.modelProvider,
    model_identifier: v.modelIdentifier,
    intended_use: v.intendedUse,
    prohibited_uses: v.prohibitedUses,
    business_owner_name: v.businessOwnerName,
    technical_owner_name: v.technicalOwnerName,
    source_system: v.source?.sourceSystem ?? null,
    source_entity_type: v.source?.sourceEntityType ?? null,
    source_entity_id: v.source?.sourceEntityId ?? null,
    correlation_id: v.source?.correlationId ?? null,
    external_runtime_id: v.externalRuntimeId,
    parent_governed_asset_id: v.parentGovernedAssetId,
  };
}

/**
 * Register a governed asset. Idempotent on lineage: if the program already
 * has an asset for the same (source_system, source_entity_type,
 * source_entity_id), that asset is returned with `created: false`.
 */
export async function registerAsset(
  programId: string,
  raw: Record<string, unknown>,
): Promise<ServiceResult<{ assetId: string; created: boolean }>> {
  if (!isUuid(programId)) return { ok: false, error: "invalid-input" };
  const parsed = validateRegisterAsset(raw);
  if (!parsed.ok) return { ok: false, error: "invalid-input", detail: parsed.error };
  const auth = await requireProgramAction(programId, "asset.register");
  if (!auth.ok) return auth;
  const v = parsed.value;
  const supabase = createSupabaseServerClient();

  if (v.source) {
    const existing = await supabase
      .from("governed_assets")
      .select("id")
      .eq("governance_program_id", programId)
      .eq("source_system", v.source.sourceSystem)
      .eq("source_entity_type", v.source.sourceEntityType)
      .eq("source_entity_id", v.source.sourceEntityId)
      .maybeSingle<{ id: string }>();
    if (existing.data) return { ok: true, assetId: existing.data.id, created: false };
  }

  const { data, error } = await supabase
    .from("governed_assets")
    .insert({
      ...assetRow(v),
      workspace_id: auth.actor.workspaceId,
      governance_program_id: programId,
      operator_owner_profile_id: auth.actor.profileId,
      created_by: auth.actor.profileId,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) return fail("register-asset", error ?? { message: "no row" });

  await recordGovernanceEvent({
    workspaceId: auth.actor.workspaceId,
    programId,
    actorProfileId: auth.actor.profileId,
    eventType: "governance_asset_registered",
    entityType: "governed_asset",
    entityId: data.id,
    title: `${LABELS.assetType[v.assetType]} registered: ${v.name}`,
    metadata: {
      assetType: v.assetType,
      sourceSystem: v.source?.sourceSystem ?? null,
      sourceEntityType: v.source?.sourceEntityType ?? null,
      correlationId: v.source?.correlationId ?? null,
    },
  });
  return { ok: true, assetId: data.id, created: true };
}

export async function updateAsset(
  programId: string,
  assetId: string,
  raw: Record<string, unknown>,
): Promise<ServiceResult> {
  if (!isUuid(programId) || !isUuid(assetId)) return { ok: false, error: "invalid-input" };
  const parsed = validateRegisterAsset(raw);
  if (!parsed.ok) return { ok: false, error: "invalid-input", detail: parsed.error };
  const auth = await requireProgramAction(programId, "asset.edit");
  if (!auth.ok) return auth;
  // asset_type is immutable (DB guard); lineage is edited deliberately via linkGovernedAssetSource.
  const { asset_type: _t, source_system: _s, source_entity_type: _e, source_entity_id: _i, correlation_id: _c, ...row } =
    assetRow(parsed.value);

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governed_assets")
    .update(row)
    .eq("id", assetId)
    .eq("governance_program_id", programId)
    .select("id")
    .maybeSingle();
  if (error) return fail("update-asset", error);
  if (!data) return { ok: false, error: "not-found" };

  await recordGovernanceEvent({
    workspaceId: auth.actor.workspaceId,
    programId,
    actorProfileId: auth.actor.profileId,
    eventType: "governance_asset_updated",
    entityType: "governed_asset",
    entityId: assetId,
    title: `Asset updated: ${parsed.value.name}`,
  });
  return { ok: true };
}

export async function transitionAsset(
  programId: string,
  assetId: string,
  to: LifecycleStatus,
  reasonRaw: unknown,
): Promise<ServiceResult> {
  if (!isUuid(programId) || !isUuid(assetId)) return { ok: false, error: "invalid-input" };
  const reason = validateReason(reasonRaw);
  if (!reason) return { ok: false, error: "invalid-input", detail: "reason-required" };
  const auth = await requireProgramAction(programId, to === "retired" ? "asset.retire" : "asset.transition");
  if (!auth.ok) return auth;

  const supabase = createSupabaseServerClient();
  const current = await supabase
    .from("governed_assets")
    .select("name, lifecycle_status")
    .eq("id", assetId)
    .eq("governance_program_id", programId)
    .maybeSingle<{ name: string; lifecycle_status: LifecycleStatus }>();
  if (!current.data) return { ok: false, error: "not-found" };

  const { error } = await supabase.rpc("governance_transition_asset", { asset: assetId, to_status: to, reason });
  if (error) return fail("transition-asset", error);

  await recordGovernanceEvent({
    workspaceId: auth.actor.workspaceId,
    programId,
    actorProfileId: auth.actor.profileId,
    eventType: "governance_asset_lifecycle_changed",
    entityType: "governed_asset",
    entityId: assetId,
    title: `${current.data.name}: ${LABELS.lifecycle[current.data.lifecycle_status]} → ${LABELS.lifecycle[to]}`,
    summary: reason,
    metadata: { from: current.data.lifecycle_status, to },
  });
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Policies (immutable, superseding versions)
// -----------------------------------------------------------------------------

export async function createPolicy(
  programId: string,
  raw: Record<string, unknown>,
): Promise<ServiceResult<{ policyId: string; versionId: string }>> {
  if (!isUuid(programId)) return { ok: false, error: "invalid-input" };
  const parsed = validateCreatePolicy(raw);
  if (!parsed.ok) return { ok: false, error: "invalid-input", detail: parsed.error };
  const auth = await requireProgramAction(programId, "policy.create");
  if (!auth.ok) return auth;
  const v = parsed.value;
  const supabase = createSupabaseServerClient();

  const policy = await supabase
    .from("governance_policies")
    .insert({
      workspace_id: auth.actor.workspaceId,
      governance_program_id: programId,
      policy_key: v.policyKey,
      name: v.name,
      policy_domain: v.policyDomain,
      owner_profile_id: auth.actor.profileId,
      created_by: auth.actor.profileId,
    })
    .select("id")
    .single<{ id: string }>();
  if (policy.error || !policy.data) return fail("create-policy", policy.error ?? { message: "no row" });

  const version = await supabase
    .from("governance_policy_versions")
    .insert({
      workspace_id: auth.actor.workspaceId,
      governance_program_id: programId,
      governance_policy_id: policy.data.id,
      version: 1,
      statement: v.statement,
      rationale: v.rationale,
      activation_mode: v.activationMode,
      created_by: auth.actor.profileId,
    })
    .select("id")
    .single<{ id: string }>();
  if (version.error || !version.data) return fail("create-policy-version", version.error ?? { message: "no row" });

  await recordGovernanceEvent({
    workspaceId: auth.actor.workspaceId,
    programId,
    actorProfileId: auth.actor.profileId,
    eventType: "governance_policy_created",
    entityType: "governance_policy",
    entityId: policy.data.id,
    title: `Policy created: ${v.name} (v1 draft)`,
    metadata: { policyKey: v.policyKey, domain: v.policyDomain },
  });
  return { ok: true, policyId: policy.data.id, versionId: version.data.id };
}

/** Create (or update, while still a draft) the next version of a policy. */
export async function saveDraftVersion(
  programId: string,
  policyId: string,
  raw: Record<string, unknown>,
): Promise<ServiceResult<{ versionId: string }>> {
  if (!isUuid(programId) || !isUuid(policyId)) return { ok: false, error: "invalid-input" };
  const parsed = validatePolicyDraft(raw);
  if (!parsed.ok) return { ok: false, error: "invalid-input", detail: parsed.error };
  const auth = await requireProgramAction(programId, "policy.draft");
  if (!auth.ok) return auth;
  const supabase = createSupabaseServerClient();

  const { data: versions, error: vErr } = await supabase
    .from("governance_policy_versions")
    .select("id, version, status")
    .eq("governance_policy_id", policyId)
    .eq("governance_program_id", programId)
    .order("version", { ascending: false });
  if (vErr) return fail("load-versions", vErr);
  if (!versions || versions.length === 0) return { ok: false, error: "not-found" };

  const draft = versions.find((x) => x.status === "draft");
  const payload = {
    statement: parsed.value.statement,
    rationale: parsed.value.rationale,
    activation_mode: parsed.value.activationMode,
  };

  let versionId: string;
  let versionNumber: number;
  if (draft) {
    const { error } = await supabase.from("governance_policy_versions").update(payload).eq("id", draft.id);
    if (error) return fail("update-draft", error);
    versionId = draft.id;
    versionNumber = draft.version;
  } else {
    const latest = versions[0];
    const active = versions.find((x) => x.status === "active");
    const { data, error } = await supabase
      .from("governance_policy_versions")
      .insert({
        ...payload,
        workspace_id: auth.actor.workspaceId,
        governance_program_id: programId,
        governance_policy_id: policyId,
        version: latest.version + 1,
        supersedes_version_id: active?.id ?? null,
        created_by: auth.actor.profileId,
      })
      .select("id, version")
      .single<{ id: string; version: number }>();
    if (error || !data) return fail("create-draft", error ?? { message: "no row" });
    versionId = data.id;
    versionNumber = data.version;
  }

  await recordGovernanceEvent({
    workspaceId: auth.actor.workspaceId,
    programId,
    actorProfileId: auth.actor.profileId,
    eventType: "governance_policy_version_drafted",
    entityType: "governance_policy_version",
    entityId: versionId,
    title: `Policy draft v${versionNumber} saved`,
    metadata: { policyId, version: versionNumber },
  });
  return { ok: true, versionId };
}

export async function activatePolicyVersion(
  programId: string,
  versionId: string,
  reasonRaw: unknown,
): Promise<ServiceResult> {
  if (!isUuid(programId) || !isUuid(versionId)) return { ok: false, error: "invalid-input" };
  const reason = validateReason(reasonRaw);
  if (!reason) return { ok: false, error: "invalid-input", detail: "reason-required" };
  const auth = await requireProgramAction(programId, "policy.activate");
  if (!auth.ok) return auth;
  const supabase = createSupabaseServerClient();

  const { data: v } = await supabase
    .from("governance_policy_versions")
    .select("version, governance_policy_id, activation_mode")
    .eq("id", versionId)
    .eq("governance_program_id", programId)
    .maybeSingle<{ version: number; governance_policy_id: string; activation_mode: string }>();
  if (!v) return { ok: false, error: "not-found" };

  const { error } = await supabase.rpc("governance_activate_policy_version", { version_id: versionId, reason });
  if (error) return fail("activate-policy", error);

  await recordGovernanceEvent({
    workspaceId: auth.actor.workspaceId,
    programId,
    actorProfileId: auth.actor.profileId,
    eventType: "governance_policy_version_activated",
    entityType: "governance_policy_version",
    entityId: versionId,
    title: `Policy v${v.version} activated (${v.activation_mode})`,
    summary: reason,
    metadata: { policyId: v.governance_policy_id, version: v.version, activationMode: v.activation_mode },
  });
  return { ok: true };
}

export async function retirePolicyVersion(
  programId: string,
  versionId: string,
  reasonRaw: unknown,
): Promise<ServiceResult> {
  if (!isUuid(programId) || !isUuid(versionId)) return { ok: false, error: "invalid-input" };
  const reason = validateReason(reasonRaw);
  if (!reason) return { ok: false, error: "invalid-input", detail: "reason-required" };
  const auth = await requireProgramAction(programId, "policy.retire");
  if (!auth.ok) return auth;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("governance_policy_versions")
    .update({ status: "retired" })
    .eq("id", versionId)
    .eq("governance_program_id", programId)
    .in("status", ["draft", "active"])
    .select("version, governance_policy_id")
    .maybeSingle<{ version: number; governance_policy_id: string }>();
  if (error) return fail("retire-policy", error);
  if (!data) return { ok: false, error: "not-found" };

  await recordGovernanceEvent({
    workspaceId: auth.actor.workspaceId,
    programId,
    actorProfileId: auth.actor.profileId,
    eventType: "governance_policy_version_retired",
    entityType: "governance_policy_version",
    entityId: versionId,
    title: `Policy v${data.version} retired`,
    summary: reason,
    metadata: { policyId: data.governance_policy_id, version: data.version },
  });
  return { ok: true };
}

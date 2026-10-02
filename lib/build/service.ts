import "server-only";

import { randomUUID } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { recordBuildEvent } from "./activity";
import { requireBuildOperator, requireBuildOwner, type BuildAuthError } from "./authorization";
import { getDecision, getProject } from "./queries";
import { PROJECT_TRANSITIONS, type ProjectStatus, type WorkItemStatus } from "./types";
import {
  canOperatorTransitionItem,
  isUuid,
  validateCreateProject,
  validateCreateWorkItem,
  validateProjectSettings,
  validateProviderAccount,
  validateReason,
  validateRuling,
  validateWorker,
} from "./validation";

/**
 * BuildOS operator mutation service. BUILDOS MODULE.
 *
 * The single operator write path. Every function validates, authorizes
 * (authorization.ts; RLS + DB guards again underneath), writes under the
 * caller's session (never the service role) and emits a BuildOS activity
 * event. Engine state (runs, events, ledger, slots, holds) is never written
 * here — only by workers through the 0033 RPCs.
 */

export type ServiceError =
  | BuildAuthError
  | "invalid-input"
  | "not-found"
  | "conflict"
  | "invalid-transition"
  | "project-closed"
  | "service-error";

export type ServiceResult<T = unknown> = ({ ok: true } & T) | { ok: false; error: ServiceError; detail?: string };

function mapDbError(error: { code?: string; message?: string }): ServiceError {
  const msg = error.message ?? "";
  if (error.code === "23505") return "conflict";
  if (msg.includes("build_project_closed")) return "project-closed";
  if (msg.includes("invalid_transition") || msg.includes("immutable") || msg.includes("terminal") || msg.includes("engine_field")
      || msg.includes("decision_closed") || msg.includes("run_finished") || msg.includes("profile_locked")) {
    return "invalid-transition";
  }
  if (error.code === "42501" || msg.includes("row-level security") || msg.includes("build_not_authorized")) return "forbidden";
  if (msg.includes("cross_") || msg.includes("cycle") || msg.includes("check constraint") || msg.includes("unknown_option")) {
    return "invalid-input";
  }
  return "service-error";
}

function fail(scope: string, error: { code?: string; message?: string }): { ok: false; error: ServiceError; detail?: string } {
  console.error(`[build.service] ${scope}`, { code: error.code, message: error.message });
  const mapped = mapDbError(error);
  const detail = (error.message ?? "").includes("build_dependency_cycle") ? "dependency-cycle" : undefined;
  return { ok: false, error: mapped, ...(detail ? { detail } : {}) };
}

// -----------------------------------------------------------------------------
// Projects
// -----------------------------------------------------------------------------

export async function createProject(raw: Record<string, unknown>): Promise<ServiceResult<{ projectId: string }>> {
  const parsed = validateCreateProject(raw);
  if (!parsed.ok) return { ok: false, error: "invalid-input", detail: parsed.error };
  const auth = await requireBuildOperator();
  if (!auth.ok) return auth;
  const v = parsed.value;
  const id = randomUUID();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("build_projects").insert({
    id,
    workspace_id: auth.actor.workspaceId,
    project_key: v.projectKey,
    name: v.name,
    description: v.description,
    origin_kind: v.originKind,
    origin_engagement_id: v.originEngagementId,
    origin_ref: v.originRef,
    // docs/81 §3: a ConsultOS origin is always client-isolated.
    isolation_class: v.originKind === "consultos_engagement" ? "client" : "internal",
    repo_url: v.repoUrl,
    default_branch: v.defaultBranch,
    stack_profile: v.stackProfile,
    canon_profile: v.canonProfile,
    builder_family: v.builderFamily,
    judge_families: v.judgeFamilies,
    created_by: auth.actor.profileId,
  });
  if (error) return fail("createProject", error);
  await recordBuildEvent({
    workspaceId: auth.actor.workspaceId,
    actorProfileId: auth.actor.profileId,
    eventType: "build_project_created",
    entityType: "build_project",
    entityId: id,
    title: `BuildOS project created: ${v.name}`,
    metadata: { projectKey: v.projectKey, originKind: v.originKind, sourceEngagementId: v.originEngagementId },
  });
  return { ok: true, projectId: id };
}

/**
 * Project status change. `intake → ready` records the readiness check
 * (docs/80 §8); the operator attests the canon package validated against its
 * canon profile until the worker-side validator lands in B2.
 */
export async function transitionProject(
  projectId: string,
  to: ProjectStatus,
  reasonRaw: unknown,
): Promise<ServiceResult> {
  if (!isUuid(projectId)) return { ok: false, error: "not-found" };
  const reason = validateReason(reasonRaw);
  if (!reason.ok) return { ok: false, error: "invalid-input", detail: reason.error };
  const auth = await requireBuildOperator();
  if (!auth.ok) return auth;
  const project = await getProject(projectId);
  if (!project) return { ok: false, error: "not-found" };
  if (!PROJECT_TRANSITIONS[project.status].includes(to)) return { ok: false, error: "invalid-transition" };
  const patch: Record<string, unknown> = { status: to };
  if (project.status === "intake" && to === "ready") {
    patch.readiness_checked_at = new Date().toISOString();
    patch.readiness_note = reason.value;
  }
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("build_projects").update(patch).eq("id", projectId);
  if (error) return fail("transitionProject", error);
  await recordBuildEvent({
    workspaceId: project.workspaceId,
    actorProfileId: auth.actor.profileId,
    eventType: "build_project_status_changed",
    entityType: "build_project",
    entityId: projectId,
    title: `${project.name}: ${project.status} → ${to}`,
    summary: reason.value,
    metadata: { from: project.status, to },
  });
  return { ok: true };
}

export async function updateProjectSettings(projectId: string, raw: Record<string, unknown>): Promise<ServiceResult> {
  if (!isUuid(projectId)) return { ok: false, error: "not-found" };
  const parsed = validateProjectSettings(raw);
  if (!parsed.ok) return { ok: false, error: "invalid-input", detail: parsed.error };
  const auth = await requireBuildOperator();
  if (!auth.ok) return auth;
  const v = parsed.value;
  const patch: Record<string, unknown> = {};
  if (v.wipLimit !== undefined) patch.wip_limit = v.wipLimit;
  if (v.priorityWeight !== undefined) patch.priority_weight = v.priorityWeight;
  if (v.maxAttempts !== undefined) patch.max_attempts = v.maxAttempts;
  if (v.dailyBudgetUsd !== undefined) patch.daily_budget_usd = v.dailyBudgetUsd;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("build_projects")
    .update(patch)
    .eq("id", projectId)
    .select("workspace_id, name")
    .maybeSingle();
  if (error) return fail("updateProjectSettings", error);
  if (!data) return { ok: false, error: "not-found" };
  await recordBuildEvent({
    workspaceId: data.workspace_id as string,
    actorProfileId: auth.actor.profileId,
    eventType: "build_project_settings_changed",
    entityType: "build_project",
    entityId: projectId,
    title: `${data.name as string}: scheduling settings changed`,
    metadata: patch,
  });
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Work items
// -----------------------------------------------------------------------------

export async function createWorkItem(
  projectId: string,
  raw: Record<string, unknown>,
): Promise<ServiceResult<{ workItemId: string }>> {
  if (!isUuid(projectId)) return { ok: false, error: "not-found" };
  const parsed = validateCreateWorkItem(raw);
  if (!parsed.ok) return { ok: false, error: "invalid-input", detail: parsed.error };
  const auth = await requireBuildOperator();
  if (!auth.ok) return auth;
  const project = await getProject(projectId);
  if (!project) return { ok: false, error: "not-found" };
  const v = parsed.value;
  const id = randomUUID();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("build_work_items").insert({
    id,
    project_id: projectId,
    workspace_id: project.workspaceId,
    item_key: v.itemKey,
    kind: v.kind,
    canon_ref: v.canonRef,
    title: v.title,
    brief: v.brief,
    bindings: v.bindings,
    status: v.status,
    remediates_item_id: v.remediatesItemId,
    created_by: auth.actor.profileId,
  });
  if (error) return fail("createWorkItem", error);
  if (v.dependsOn.length) {
    const { error: depError } = await supabase.from("build_work_item_deps").insert(
      v.dependsOn.map((d) => ({ work_item_id: id, depends_on_id: d, project_id: projectId, workspace_id: project.workspaceId })),
    );
    if (depError) return fail("createWorkItem.deps", depError);
  }
  await recordBuildEvent({
    workspaceId: project.workspaceId,
    actorProfileId: auth.actor.profileId,
    eventType: "build_work_item_created",
    entityType: "build_work_item",
    entityId: id,
    title: `${project.projectKey}/${v.itemKey}: ${v.title}`,
    metadata: { kind: v.kind, canonRef: v.canonRef, status: v.status },
  });
  return { ok: true, workItemId: id };
}

/** Operator transitions only (docs/81 §4): draft↔ready, release a held item, cancel, supersede. */
export async function transitionWorkItem(itemId: string, to: WorkItemStatus, reasonRaw: unknown): Promise<ServiceResult> {
  if (!isUuid(itemId)) return { ok: false, error: "not-found" };
  const reason = validateReason(reasonRaw);
  if (!reason.ok) return { ok: false, error: "invalid-input", detail: reason.error };
  const auth = await requireBuildOperator();
  if (!auth.ok) return auth;
  const supabase = createSupabaseServerClient();
  const { data: item } = await supabase
    .from("build_work_items")
    .select("id, workspace_id, project_id, item_key, status")
    .eq("id", itemId)
    .maybeSingle();
  if (!item) return { ok: false, error: "not-found" };
  const from = item.status as WorkItemStatus;
  if (!canOperatorTransitionItem(from, to)) return { ok: false, error: "invalid-transition" };
  const { error } = await supabase.from("build_work_items").update({ status: to }).eq("id", itemId).eq("status", from);
  if (error) return fail("transitionWorkItem", error);
  await recordBuildEvent({
    workspaceId: item.workspace_id as string,
    actorProfileId: auth.actor.profileId,
    eventType: "build_work_item_status_changed",
    entityType: "build_work_item",
    entityId: itemId,
    title: `${item.item_key as string}: ${from} → ${to}`,
    summary: reason.value,
    metadata: { from, to, projectId: item.project_id },
  });
  return { ok: true };
}

// -----------------------------------------------------------------------------
// Decisions, runs, alarms (security-definer RPCs; authorization re-checked in DB)
// -----------------------------------------------------------------------------

export async function ruleDecision(decisionId: string, raw: Record<string, unknown>): Promise<ServiceResult> {
  if (!isUuid(decisionId)) return { ok: false, error: "not-found" };
  const auth = await requireBuildOperator();
  if (!auth.ok) return auth;
  const decision = await getDecision(decisionId);
  if (!decision) return { ok: false, error: "not-found" };
  if (decision.status !== "open") return { ok: false, error: "invalid-transition" };
  const parsed = validateRuling(raw, decision.options.map((o) => o.key));
  if (!parsed.ok) return { ok: false, error: "invalid-input", detail: parsed.error };
  const v = parsed.value;
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("build_rule_decision", {
    p_decision: decisionId,
    p_option: v.option,
    p_note: v.note,
    p_item_action: v.itemAction,
    p_canon_ref: v.resultingCanonRef,
  });
  if (error) return fail("ruleDecision", error);
  await recordBuildEvent({
    workspaceId: auth.actor.workspaceId,
    actorProfileId: auth.actor.profileId,
    eventType: "build_decision_ruled",
    entityType: "build_decision",
    entityId: decisionId,
    title: `Ruled: ${decision.title}`,
    summary: v.note,
    metadata: { option: v.option, itemAction: v.itemAction, resultingCanonRef: v.resultingCanonRef },
  });
  return { ok: true };
}

export async function requestRunCancel(runId: string): Promise<ServiceResult> {
  if (!isUuid(runId)) return { ok: false, error: "not-found" };
  const auth = await requireBuildOperator();
  if (!auth.ok) return auth;
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("build_request_cancel", { p_run: runId });
  if (error) return fail("requestRunCancel", error);
  await recordBuildEvent({
    workspaceId: auth.actor.workspaceId,
    actorProfileId: auth.actor.profileId,
    eventType: "build_run_cancel_requested",
    entityType: "build_run",
    entityId: runId,
    title: "Run cancellation requested",
  });
  return { ok: true };
}

export async function clearAlarm(alarmId: string): Promise<ServiceResult> {
  if (!isUuid(alarmId)) return { ok: false, error: "not-found" };
  const auth = await requireBuildOperator();
  if (!auth.ok) return auth;
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.rpc("build_clear_alarm", { p_alarm: alarmId });
  if (error) return fail("clearAlarm", error);
  await recordBuildEvent({
    workspaceId: auth.actor.workspaceId,
    actorProfileId: auth.actor.profileId,
    eventType: "build_alarm_cleared",
    entityType: "build_alarm",
    entityId: alarmId,
    title: "Alarm cleared",
  });
  return { ok: true };
}

/** Re-evaluate alarms for the operator's workspace (docs/81 §10). Idempotent. */
export async function evaluateAlarms(): Promise<ServiceResult<{ raised: number }>> {
  const auth = await requireBuildOperator();
  if (!auth.ok) return auth;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("build_evaluate_alarms", { p_ws: auth.actor.workspaceId });
  if (error) return fail("evaluateAlarms", error);
  return { ok: true, raised: Number(data ?? 0) };
}

// -----------------------------------------------------------------------------
// Capacity: provider accounts (OWNER — they govern spend) and workers
// -----------------------------------------------------------------------------

export async function createProviderAccount(raw: Record<string, unknown>): Promise<ServiceResult<{ accountId: string }>> {
  const parsed = validateProviderAccount(raw);
  if (!parsed.ok) return { ok: false, error: "invalid-input", detail: parsed.error };
  const auth = await requireBuildOwner();
  if (!auth.ok) return auth;
  const v = parsed.value;
  const id = randomUUID();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("build_provider_accounts").insert({
    id,
    workspace_id: auth.actor.workspaceId,
    label: v.label,
    family: v.family,
    provider: v.provider,
    billing_class: v.billingClass,
    secret_ref: v.secretRef,
    max_concurrency: v.maxConcurrency,
    created_by: auth.actor.profileId,
  });
  if (error) return fail("createProviderAccount", error);
  await recordBuildEvent({
    workspaceId: auth.actor.workspaceId,
    actorProfileId: auth.actor.profileId,
    eventType: "build_provider_account_changed",
    entityType: "build_provider_account",
    entityId: id,
    title: `Provider account added: ${v.label}`,
    metadata: { family: v.family, provider: v.provider, billingClass: v.billingClass, maxConcurrency: v.maxConcurrency },
  });
  return { ok: true, accountId: id };
}

export async function setProviderAccountStatus(accountId: string, status: "active" | "disabled"): Promise<ServiceResult> {
  if (!isUuid(accountId) || (status !== "active" && status !== "disabled")) return { ok: false, error: "invalid-input" };
  const auth = await requireBuildOwner();
  if (!auth.ok) return auth;
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("build_provider_accounts").update({ status }).eq("id", accountId);
  if (error) return fail("setProviderAccountStatus", error);
  await recordBuildEvent({
    workspaceId: auth.actor.workspaceId,
    actorProfileId: auth.actor.profileId,
    eventType: "build_provider_account_changed",
    entityType: "build_provider_account",
    entityId: accountId,
    title: `Provider account ${status === "active" ? "enabled" : "disabled"}`,
  });
  return { ok: true };
}

export async function registerWorker(raw: Record<string, unknown>): Promise<ServiceResult<{ workerId: string }>> {
  const parsed = validateWorker(raw);
  if (!parsed.ok) return { ok: false, error: "invalid-input", detail: parsed.error };
  const auth = await requireBuildOperator();
  if (!auth.ok) return auth;
  const v = parsed.value;
  const id = randomUUID();
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("build_workers").insert({
    id,
    workspace_id: auth.actor.workspaceId,
    name: v.name,
    substrate: v.substrate,
    capabilities: v.capabilities,
    created_by: auth.actor.profileId,
  });
  if (error) return fail("registerWorker", error);
  await recordBuildEvent({
    workspaceId: auth.actor.workspaceId,
    actorProfileId: auth.actor.profileId,
    eventType: "build_worker_changed",
    entityType: "build_worker",
    entityId: id,
    title: `Worker registered: ${v.name}`,
    metadata: { substrate: v.substrate, capabilities: v.capabilities },
  });
  return { ok: true, workerId: id };
}

export async function setWorkerStatus(workerId: string, status: "active" | "disabled"): Promise<ServiceResult> {
  if (!isUuid(workerId) || (status !== "active" && status !== "disabled")) return { ok: false, error: "invalid-input" };
  const auth = await requireBuildOperator();
  if (!auth.ok) return auth;
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("build_workers").update({ status }).eq("id", workerId);
  if (error) return fail("setWorkerStatus", error);
  await recordBuildEvent({
    workspaceId: auth.actor.workspaceId,
    actorProfileId: auth.actor.profileId,
    eventType: "build_worker_changed",
    entityType: "build_worker",
    entityId: workerId,
    title: `Worker ${status === "active" ? "enabled" : "disabled"}`,
  });
  return { ok: true };
}

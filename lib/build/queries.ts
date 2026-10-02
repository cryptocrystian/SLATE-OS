import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isUuid } from "./validation";
import type {
  BuildAlarm,
  BuildDecision,
  BuildProject,
  BuildProjectSummary,
  BuildRun,
  BuildRunEvent,
  BuildWorker,
  BuildWorkItem,
  DecisionOption,
  ProjectCost,
  ProviderAccount,
  WorkItemCounts,
} from "./types";

/**
 * BuildOS read layer. BUILDOS MODULE.
 *
 * Reads run under the operator's session — RLS (workspace membership) decides
 * visibility. Side-effect free. Joins across composite FKs are resolved in
 * code (small maps) rather than PostgREST embeds.
 */

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v));
const n = (v: unknown) => (v == null ? null : Number(v));

export function mapProject(r: Row): BuildProject {
  return {
    id: r.id as string,
    workspaceId: r.workspace_id as string,
    projectKey: r.project_key as string,
    name: r.name as string,
    description: s(r.description),
    originKind: r.origin_kind as BuildProject["originKind"],
    originEngagementId: s(r.origin_engagement_id),
    originEngagementRef: s(r.origin_engagement_ref),
    originNameSnapshot: s(r.origin_name_snapshot),
    originRef: s(r.origin_ref),
    isolationClass: r.isolation_class as BuildProject["isolationClass"],
    repoUrl: r.repo_url as string,
    defaultBranch: r.default_branch as string,
    stackProfile: r.stack_profile as string,
    canonProfile: r.canon_profile as string,
    status: r.status as BuildProject["status"],
    readinessCheckedAt: s(r.readiness_checked_at),
    readinessNote: s(r.readiness_note),
    wipLimit: Number(r.wip_limit),
    priorityWeight: Number(r.priority_weight),
    maxAttempts: Number(r.max_attempts),
    dailyBudgetUsd: n(r.daily_budget_usd),
    builderFamily: r.builder_family as BuildProject["builderFamily"],
    judgeFamilies: (r.judge_families as BuildProject["judgeFamilies"]) ?? [],
    activatedAt: s(r.activated_at),
    closedAt: s(r.closed_at),
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function mapWorkItem(r: Row, dependsOn: string[] = []): BuildWorkItem {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    itemKey: r.item_key as string,
    kind: r.kind as BuildWorkItem["kind"],
    canonRef: s(r.canon_ref),
    title: r.title as string,
    brief: s(r.brief),
    bindings: (r.bindings as string[]) ?? [],
    status: r.status as BuildWorkItem["status"],
    readySince: s(r.ready_since),
    attempts: Number(r.attempts),
    holdUntil: s(r.hold_until),
    holdReason: (r.hold_reason as BuildWorkItem["holdReason"]) ?? null,
    lastFailureClass: (r.last_failure_class as BuildWorkItem["lastFailureClass"]) ?? null,
    consecutiveFailures: Number(r.consecutive_failures),
    remediatesItemId: s(r.remediates_item_id),
    acceptedAt: s(r.accepted_at),
    dependsOn,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
  };
}

export function mapRun(r: Row, workerName: string | null = null): BuildRun {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    workItemId: r.work_item_id as string,
    runKey: r.run_key as string,
    attemptNo: Number(r.attempt_no),
    lane: r.lane as string,
    mode: r.mode as BuildRun["mode"],
    workerId: r.worker_id as string,
    workerName,
    status: r.status as BuildRun["status"],
    phase: s(r.phase),
    stackProfile: r.stack_profile as string,
    canonProfile: r.canon_profile as string,
    baseSha: s(r.base_sha),
    canonRefPin: s(r.canon_ref_pin),
    laneVersion: s(r.lane_version),
    rosterHash: s(r.roster_hash),
    leaseExpiresAt: r.lease_expires_at as string,
    heartbeatAt: s(r.heartbeat_at),
    cancelRequestedAt: s(r.cancel_requested_at),
    verdict: (r.verdict as BuildRun["verdict"]) ?? null,
    failureClass: (r.failure_class as BuildRun["failureClass"]) ?? null,
    summary: s(r.summary),
    resumableFromPhase: s(r.resumable_from_phase),
    branch: s(r.branch),
    prUrl: s(r.pr_url),
    mergeSha: s(r.merge_sha),
    startedAt: r.started_at as string,
    finishedAt: s(r.finished_at),
  };
}

function mapDecision(r: Row, proj?: { projectKey: string; name: string }, itemKey?: string): BuildDecision {
  return {
    id: r.id as string,
    projectId: r.project_id as string,
    projectKey: proj?.projectKey ?? null,
    projectName: proj?.name ?? null,
    workItemId: r.work_item_id as string,
    itemKey: itemKey ?? null,
    runId: s(r.run_id),
    class: r.class as BuildDecision["class"],
    title: r.title as string,
    brief: r.brief as string,
    options: Array.isArray(r.options) ? (r.options as DecisionOption[]) : [],
    recommendedOption: s(r.recommended_option),
    status: r.status as BuildDecision["status"],
    rulingOption: s(r.ruling_option),
    rulingNote: s(r.ruling_note),
    itemAction: (r.item_action as BuildDecision["itemAction"]) ?? null,
    resultingCanonRef: s(r.resulting_canon_ref),
    ruledAt: s(r.ruled_at),
    createdAt: r.created_at as string,
  };
}

const emptyCounts = (): WorkItemCounts => ({ total: 0, accepted: 0, inProgress: 0, held: 0, escalated: 0, ready: 0 });

export async function listProjects(): Promise<BuildProjectSummary[]> {
  const supabase = createSupabaseServerClient();
  const [projects, items, decisions, alarms, accepted] = await Promise.all([
    supabase.from("build_projects").select("*").order("created_at", { ascending: true }),
    supabase.from("build_work_items").select("project_id, status"),
    supabase.from("build_decisions").select("project_id").eq("status", "open"),
    supabase.from("build_alarms").select("project_id").is("cleared_at", null),
    supabase
      .from("build_runs")
      .select("project_id, finished_at")
      .eq("verdict", "accepted")
      .order("finished_at", { ascending: false })
      .limit(500),
  ]);
  if (projects.error) {
    console.error("[build.queries] listProjects", projects.error.message);
    return [];
  }
  const counts = new Map<string, WorkItemCounts>();
  for (const it of (items.data ?? []) as Row[]) {
    const c = counts.get(it.project_id as string) ?? emptyCounts();
    c.total += 1;
    if (it.status === "accepted") c.accepted += 1;
    else if (it.status === "in_progress") c.inProgress += 1;
    else if (it.status === "held") c.held += 1;
    else if (it.status === "escalated") c.escalated += 1;
    else if (it.status === "ready") c.ready += 1;
    counts.set(it.project_id as string, c);
  }
  const tally = (rows: Row[] | null) => {
    const m = new Map<string, number>();
    for (const r of rows ?? []) if (r.project_id) m.set(r.project_id as string, (m.get(r.project_id as string) ?? 0) + 1);
    return m;
  };
  const openDecisions = tally(decisions.data as Row[] | null);
  const openAlarms = tally(alarms.data as Row[] | null);
  const lastAccepted = new Map<string, string>();
  for (const r of (accepted.data ?? []) as Row[]) {
    if (!lastAccepted.has(r.project_id as string)) lastAccepted.set(r.project_id as string, r.finished_at as string);
  }
  return ((projects.data ?? []) as Row[]).map((r) => {
    const p = mapProject(r);
    return {
      ...p,
      counts: counts.get(p.id) ?? emptyCounts(),
      openDecisions: openDecisions.get(p.id) ?? 0,
      openAlarms: openAlarms.get(p.id) ?? 0,
      lastAcceptedAt: lastAccepted.get(p.id) ?? null,
    };
  });
}

export async function getProject(projectId: string): Promise<BuildProject | null> {
  if (!isUuid(projectId)) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.from("build_projects").select("*").eq("id", projectId).maybeSingle();
  if (error || !data) return null;
  return mapProject(data as Row);
}

export async function listWorkItems(projectId: string): Promise<BuildWorkItem[]> {
  if (!isUuid(projectId)) return [];
  const supabase = createSupabaseServerClient();
  const [items, deps] = await Promise.all([
    supabase.from("build_work_items").select("*").eq("project_id", projectId).order("created_at", { ascending: true }),
    supabase.from("build_work_item_deps").select("work_item_id, depends_on_id").eq("project_id", projectId),
  ]);
  const depMap = new Map<string, string[]>();
  for (const d of (deps.data ?? []) as Row[]) {
    const k = d.work_item_id as string;
    depMap.set(k, [...(depMap.get(k) ?? []), d.depends_on_id as string]);
  }
  return ((items.data ?? []) as Row[]).map((r) => mapWorkItem(r, depMap.get(r.id as string) ?? []));
}

async function workerNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("build_workers").select("id, name").in("id", [...new Set(ids)]);
  return new Map(((data ?? []) as Row[]).map((w) => [w.id as string, w.name as string]));
}

export async function listRuns(projectId: string, limit = 50): Promise<BuildRun[]> {
  if (!isUuid(projectId)) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("build_runs")
    .select("*")
    .eq("project_id", projectId)
    .order("started_at", { ascending: false })
    .limit(limit);
  const rows = (data ?? []) as Row[];
  const names = await workerNames(rows.map((r) => r.worker_id as string));
  return rows.map((r) => mapRun(r, names.get(r.worker_id as string) ?? null));
}

export async function getRun(
  runId: string,
): Promise<{ run: BuildRun; item: BuildWorkItem | null; events: BuildRunEvent[]; costUsd: number } | null> {
  if (!isUuid(runId)) return null;
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("build_runs").select("*").eq("id", runId).maybeSingle();
  if (!data) return null;
  const row = data as Row;
  const [names, item, events, ledger] = await Promise.all([
    workerNames([row.worker_id as string]),
    supabase.from("build_work_items").select("*").eq("id", row.work_item_id as string).maybeSingle(),
    supabase.from("build_run_events").select("*").eq("run_id", runId).order("id", { ascending: true }).limit(2000),
    supabase.from("build_cost_ledger").select("billed_cost_usd").eq("run_id", runId),
  ]);
  return {
    run: mapRun(row, names.get(row.worker_id as string) ?? null),
    item: item.data ? mapWorkItem(item.data as Row) : null,
    events: ((events.data ?? []) as Row[]).map((e) => ({
      id: Number(e.id),
      ts: e.ts as string,
      kind: e.kind as BuildRunEvent["kind"],
      phase: s(e.phase),
      role: s(e.role),
      model: s(e.model),
      family: (e.family as BuildRunEvent["family"]) ?? null,
      passed: e.passed == null ? null : Boolean(e.passed),
      detail: (e.detail as Record<string, unknown>) ?? {},
    })),
    costUsd: ((ledger.data ?? []) as Row[]).reduce((sum, l) => sum + Number(l.billed_cost_usd ?? 0), 0),
  };
}

export async function listDecisions(opts: { status?: "open" | "all"; projectId?: string } = {}): Promise<BuildDecision[]> {
  const supabase = createSupabaseServerClient();
  let q = supabase.from("build_decisions").select("*").order("created_at", { ascending: false }).limit(200);
  if ((opts.status ?? "open") === "open") q = q.eq("status", "open");
  if (opts.projectId && isUuid(opts.projectId)) q = q.eq("project_id", opts.projectId);
  const { data } = await q;
  const rows = (data ?? []) as Row[];
  if (rows.length === 0) return [];
  const [projects, items] = await Promise.all([
    supabase.from("build_projects").select("id, project_key, name").in("id", [...new Set(rows.map((r) => r.project_id as string))]),
    supabase.from("build_work_items").select("id, item_key").in("id", [...new Set(rows.map((r) => r.work_item_id as string))]),
  ]);
  const pmap = new Map(((projects.data ?? []) as Row[]).map((p) => [p.id as string, { projectKey: p.project_key as string, name: p.name as string }]));
  const imap = new Map(((items.data ?? []) as Row[]).map((i) => [i.id as string, i.item_key as string]));
  return rows.map((r) => mapDecision(r, pmap.get(r.project_id as string), imap.get(r.work_item_id as string)));
}

export async function getDecision(decisionId: string): Promise<BuildDecision | null> {
  if (!isUuid(decisionId)) return null;
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("build_decisions").select("*").eq("id", decisionId).maybeSingle();
  return data ? mapDecision(data as Row) : null;
}

export async function listAlarms(opts: { projectId?: string; includeCleared?: boolean } = {}): Promise<BuildAlarm[]> {
  const supabase = createSupabaseServerClient();
  let q = supabase.from("build_alarms").select("*").order("raised_at", { ascending: false }).limit(200);
  if (!opts.includeCleared) q = q.is("cleared_at", null);
  if (opts.projectId && isUuid(opts.projectId)) q = q.eq("project_id", opts.projectId);
  const { data } = await q;
  const rows = (data ?? []) as Row[];
  const ids = [...new Set(rows.map((r) => r.project_id).filter(Boolean) as string[])];
  const { data: projects } = ids.length
    ? await supabase.from("build_projects").select("id, project_key").in("id", ids)
    : { data: [] };
  const pmap = new Map(((projects ?? []) as Row[]).map((p) => [p.id as string, p.project_key as string]));
  return rows.map((r) => ({
    id: r.id as string,
    projectId: s(r.project_id),
    projectKey: r.project_id ? pmap.get(r.project_id as string) ?? null : null,
    kind: r.kind as BuildAlarm["kind"],
    subject: (r.subject as string) ?? "",
    detail: s(r.detail),
    raisedAt: r.raised_at as string,
    clearedAt: s(r.cleared_at),
  }));
}

export async function listProviderAccounts(): Promise<ProviderAccount[]> {
  const supabase = createSupabaseServerClient();
  const [accounts, leases] = await Promise.all([
    supabase.from("build_provider_accounts").select("*").order("family").order("label"),
    supabase.from("build_capacity_leases").select("account_id, expires_at").is("released_at", null),
  ]);
  const now = Date.now();
  const live = new Map<string, number>();
  for (const l of (leases.data ?? []) as Row[]) {
    if (new Date(l.expires_at as string).getTime() > now) {
      live.set(l.account_id as string, (live.get(l.account_id as string) ?? 0) + 1);
    }
  }
  return ((accounts.data ?? []) as Row[]).map((a) => ({
    id: a.id as string,
    label: a.label as string,
    family: a.family as ProviderAccount["family"],
    provider: a.provider as string,
    billingClass: a.billing_class as ProviderAccount["billingClass"],
    secretRef: a.secret_ref as string,
    maxConcurrency: Number(a.max_concurrency),
    liveSlots: live.get(a.id as string) ?? 0,
    status: a.status as ProviderAccount["status"],
    health: a.health as ProviderAccount["health"],
    healthCheckedAt: s(a.health_checked_at),
    healthDetail: s(a.health_detail),
    cooldownUntil: s(a.cooldown_until),
  }));
}

export async function listWorkers(): Promise<BuildWorker[]> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase.from("build_workers").select("*").order("name");
  return ((data ?? []) as Row[]).map((w) => ({
    id: w.id as string,
    name: w.name as string,
    substrate: w.substrate as string,
    capabilities: (w.capabilities as string[]) ?? [],
    status: w.status as BuildWorker["status"],
    lastSeenAt: s(w.last_seen_at),
  }));
}

/** Spend by project: today (UTC) and trailing 7 days. */
export async function projectCosts(): Promise<Map<string, ProjectCost>> {
  const supabase = createSupabaseServerClient();
  const since = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
  const { data } = await supabase.from("build_cost_ledger").select("project_id, billed_cost_usd, created_at").gte("created_at", since);
  const today = new Date().toISOString().slice(0, 10);
  const out = new Map<string, ProjectCost>();
  for (const r of (data ?? []) as Row[]) {
    const c = out.get(r.project_id as string) ?? { todayUsd: 0, last7dUsd: 0, calls7d: 0 };
    const usd = Number(r.billed_cost_usd ?? 0);
    c.last7dUsd += usd;
    c.calls7d += 1;
    if ((r.created_at as string).slice(0, 10) === today) c.todayUsd += usd;
    out.set(r.project_id as string, c);
  }
  return out;
}

/**
 * BuildOS input validation (docs/81). BUILDOS MODULE.
 *
 * Pure functions (unit-tested). The DB re-checks every rule; this layer exists
 * to fail fast with operator-readable errors.
 */
import {
  BILLING_CLASSES,
  ITEM_ACTIONS,
  MODEL_FAMILIES,
  ORIGIN_KINDS,
  OPERATOR_ITEM_TRANSITIONS,
  WORK_ITEM_KINDS,
  type BillingClass,
  type ItemAction,
  type ModelFamily,
  type OriginKind,
  type WorkItemKind,
  type WorkItemStatus,
} from "./types";

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PROJECT_KEY_RE = /^[a-z][a-z0-9-]{1,39}$/;
export const ITEM_KEY_RE = /^[a-z0-9][a-z0-9.-]{0,79}$/;
const PROFILE_RE = /^[a-z][a-z0-9-]{1,39}$/;
const CANON_PROFILE_RE = /^[a-z][a-z0-9.-]{1,39}$/;
const REPO_RE = /^(https:\/\/|git@)\S+$/;
const BRANCH_RE = /^[A-Za-z0-9._/-]{1,120}$/;
const BINDING_RE = /^(\*|[A-Za-z][A-Za-z0-9_.-]{0,63})$/;
const SECRET_REF_RE = /^[A-Za-z0-9_./:-]{1,120}$/;
const PROVIDER_RE = /^[a-z][a-z0-9-]{1,39}$/;
const WORKER_NAME_RE = /^[a-z0-9][a-z0-9._-]{1,62}$/;

export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID_RE.test(v);

function str(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length === 0 || t.length > max ? null : t;
}

function optStr(v: unknown, max: number): string | null | undefined {
  if (v === undefined || v === null || (typeof v === "string" && v.trim() === "")) return null;
  return str(v, max) ?? undefined; // undefined = present but invalid
}

function int(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "string" && v.trim() !== "" ? Number(v) : v;
  return typeof n === "number" && Number.isInteger(n) && n >= min && n <= max ? n : null;
}

function oneOf<T extends string>(v: unknown, values: readonly T[]): T | null {
  return typeof v === "string" && (values as readonly string[]).includes(v) ? (v as T) : null;
}

/** "Listing, Seller" | ["Listing","Seller"] → ["Listing","Seller"]; dedupes; "*" stands alone. */
export function parseBindings(v: unknown): string[] | null {
  const raw = Array.isArray(v) ? v : typeof v === "string" ? v.split(",") : v == null ? [] : null;
  if (!raw) return null;
  const out = [...new Set(raw.map((b) => String(b).trim()).filter(Boolean))];
  if (!out.every((b) => BINDING_RE.test(b))) return null;
  if (out.includes("*") && out.length > 1) return null;
  return out;
}

export interface CreateProjectInput {
  projectKey: string;
  name: string;
  description: string | null;
  originKind: OriginKind;
  originEngagementId: string | null;
  originRef: string | null;
  repoUrl: string;
  defaultBranch: string;
  stackProfile: string;
  canonProfile: string;
  builderFamily: ModelFamily;
  judgeFamilies: ModelFamily[];
}

export function validateCreateProject(raw: Record<string, unknown>): Parsed<CreateProjectInput> {
  const projectKey = typeof raw.projectKey === "string" ? raw.projectKey.trim() : "";
  if (!PROJECT_KEY_RE.test(projectKey)) return { ok: false, error: "project-key" };
  const name = str(raw.name, 160);
  if (!name) return { ok: false, error: "name" };
  const description = optStr(raw.description, 4000);
  if (description === undefined) return { ok: false, error: "description" };
  const originKind = oneOf(raw.originKind, ORIGIN_KINDS);
  if (!originKind) return { ok: false, error: "origin-kind" };
  let originEngagementId: string | null = null;
  let originRef: string | null = null;
  if (originKind === "consultos_engagement") {
    if (!isUuid(raw.originEngagementId)) return { ok: false, error: "origin-engagement" };
    originEngagementId = raw.originEngagementId;
  } else if (originKind === "ventureos_venture") {
    originRef = str(raw.originRef, 200);
    if (!originRef) return { ok: false, error: "origin-ref" };
  }
  const repoUrl = typeof raw.repoUrl === "string" ? raw.repoUrl.trim() : "";
  if (!REPO_RE.test(repoUrl)) return { ok: false, error: "repo-url" };
  const defaultBranch = typeof raw.defaultBranch === "string" && raw.defaultBranch.trim() ? raw.defaultBranch.trim() : "main";
  if (!BRANCH_RE.test(defaultBranch)) return { ok: false, error: "default-branch" };
  const stackProfile = typeof raw.stackProfile === "string" ? raw.stackProfile.trim() : "";
  if (!PROFILE_RE.test(stackProfile)) return { ok: false, error: "stack-profile" };
  const canonProfile = typeof raw.canonProfile === "string" ? raw.canonProfile.trim() : "";
  if (!CANON_PROFILE_RE.test(canonProfile)) return { ok: false, error: "canon-profile" };
  const builderFamily = (oneOf(raw.builderFamily ?? "anthropic", MODEL_FAMILIES) ?? null) as ModelFamily | null;
  if (!builderFamily) return { ok: false, error: "builder-family" };
  const judgesRaw = Array.isArray(raw.judgeFamilies) ? raw.judgeFamilies : ["openai", "google", "xai"];
  const judgeFamilies = [...new Set(judgesRaw)].map((f) => oneOf(f, MODEL_FAMILIES));
  if (judgeFamilies.length === 0 || judgeFamilies.some((f) => !f)) return { ok: false, error: "judge-families" };
  // I3: the judge never shares the builder's family.
  if (judgeFamilies.includes(builderFamily)) return { ok: false, error: "judge-shares-builder-family" };
  return {
    ok: true,
    value: {
      projectKey,
      name,
      description,
      originKind,
      originEngagementId,
      originRef,
      repoUrl,
      defaultBranch,
      stackProfile,
      canonProfile,
      builderFamily,
      judgeFamilies: judgeFamilies as ModelFamily[],
    },
  };
}

export interface ProjectSettingsInput {
  wipLimit?: number;
  priorityWeight?: number;
  maxAttempts?: number;
  dailyBudgetUsd?: number | null;
}

export function validateProjectSettings(raw: Record<string, unknown>): Parsed<ProjectSettingsInput> {
  const out: ProjectSettingsInput = {};
  if (raw.wipLimit !== undefined) {
    const v = int(raw.wipLimit, 1, 8);
    if (v === null) return { ok: false, error: "wip-limit" };
    out.wipLimit = v;
  }
  if (raw.priorityWeight !== undefined) {
    const v = int(raw.priorityWeight, 1, 10);
    if (v === null) return { ok: false, error: "priority-weight" };
    out.priorityWeight = v;
  }
  if (raw.maxAttempts !== undefined) {
    const v = int(raw.maxAttempts, 1, 10);
    if (v === null) return { ok: false, error: "max-attempts" };
    out.maxAttempts = v;
  }
  if (raw.dailyBudgetUsd !== undefined) {
    if (raw.dailyBudgetUsd === null || raw.dailyBudgetUsd === "") out.dailyBudgetUsd = null;
    else {
      const n = Number(raw.dailyBudgetUsd);
      if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return { ok: false, error: "daily-budget" };
      out.dailyBudgetUsd = Math.round(n * 100) / 100;
    }
  }
  if (Object.keys(out).length === 0) return { ok: false, error: "no-changes" };
  return { ok: true, value: out };
}

export interface CreateWorkItemInput {
  itemKey: string;
  kind: WorkItemKind;
  canonRef: string | null;
  title: string;
  brief: string | null;
  bindings: string[];
  status: "draft" | "ready";
  remediatesItemId: string | null;
  dependsOn: string[];
}

export function validateCreateWorkItem(raw: Record<string, unknown>): Parsed<CreateWorkItemInput> {
  const itemKey = typeof raw.itemKey === "string" ? raw.itemKey.trim().toLowerCase() : "";
  if (!ITEM_KEY_RE.test(itemKey)) return { ok: false, error: "item-key" };
  const kind = oneOf(raw.kind, WORK_ITEM_KINDS);
  if (!kind) return { ok: false, error: "kind" };
  const canonRef = optStr(raw.canonRef, 80);
  if (canonRef === undefined) return { ok: false, error: "canon-ref" };
  const title = str(raw.title, 200);
  if (!title) return { ok: false, error: "title" };
  const brief = optStr(raw.brief, 20000);
  if (brief === undefined) return { ok: false, error: "brief" };
  const bindings = parseBindings(raw.bindings);
  if (!bindings) return { ok: false, error: "bindings" };
  if (kind === "foundation" && bindings.length === 0) bindings.push("*");
  const status = raw.status === "ready" ? "ready" : "draft";
  let remediatesItemId: string | null = null;
  if (kind === "remediation") {
    if (!isUuid(raw.remediatesItemId)) return { ok: false, error: "remediates-item" };
    remediatesItemId = raw.remediatesItemId;
  }
  const depsRaw = raw.dependsOn ?? [];
  if (!Array.isArray(depsRaw) || !depsRaw.every(isUuid)) return { ok: false, error: "depends-on" };
  return {
    ok: true,
    value: { itemKey, kind, canonRef, title, brief, bindings, status, remediatesItemId, dependsOn: [...new Set(depsRaw)] },
  };
}

export function canOperatorTransitionItem(from: WorkItemStatus, to: WorkItemStatus): boolean {
  return OPERATOR_ITEM_TRANSITIONS[from].includes(to);
}

export interface RulingInput {
  option: string;
  note: string | null;
  itemAction: ItemAction;
  resultingCanonRef: string | null;
}

export function validateRuling(raw: Record<string, unknown>, optionKeys: readonly string[]): Parsed<RulingInput> {
  const option = typeof raw.option === "string" ? raw.option : "";
  if (!optionKeys.includes(option)) return { ok: false, error: "option" };
  const itemAction = oneOf(raw.itemAction, ITEM_ACTIONS);
  if (!itemAction) return { ok: false, error: "item-action" };
  const note = optStr(raw.note, 4000);
  if (note === undefined) return { ok: false, error: "note" };
  const resultingCanonRef = optStr(raw.resultingCanonRef, 200);
  if (resultingCanonRef === undefined) return { ok: false, error: "canon-ref" };
  return { ok: true, value: { option, note, itemAction, resultingCanonRef } };
}

export interface ProviderAccountInput {
  label: string;
  family: ModelFamily;
  provider: string;
  billingClass: BillingClass;
  secretRef: string;
  maxConcurrency: number;
}

export function validateProviderAccount(raw: Record<string, unknown>): Parsed<ProviderAccountInput> {
  const label = str(raw.label, 80);
  if (!label) return { ok: false, error: "label" };
  const family = oneOf(raw.family, MODEL_FAMILIES);
  if (!family) return { ok: false, error: "family" };
  const provider = typeof raw.provider === "string" ? raw.provider.trim() : "";
  if (!PROVIDER_RE.test(provider)) return { ok: false, error: "provider" };
  const billingClass = oneOf(raw.billingClass, BILLING_CLASSES);
  if (!billingClass) return { ok: false, error: "billing-class" };
  const secretRef = typeof raw.secretRef === "string" ? raw.secretRef.trim() : "";
  // A secret_ref NAMES a secret; anything that looks like a raw key is refused (docs/81 §7).
  if (!SECRET_REF_RE.test(secretRef) || looksLikeSecret(secretRef)) return { ok: false, error: "secret-ref" };
  const maxConcurrency = int(raw.maxConcurrency ?? 2, 1, 64);
  if (maxConcurrency === null) return { ok: false, error: "max-concurrency" };
  return { ok: true, value: { label, family, provider, billingClass, secretRef, maxConcurrency } };
}

/** Heuristic guard: provider key prefixes or long high-entropy tokens are not references. */
export function looksLikeSecret(v: string): boolean {
  if (/^(sk-|sk_|xai-|AIza|ghp_|github_pat_|eyJ)\S{16,}/.test(v)) return true;
  const tail = v.split(/[/:]/).pop() ?? v;
  return tail.length >= 32 && /[A-Z]/.test(tail) && /[a-z]/.test(tail) && /[0-9]/.test(tail);
}

export interface WorkerInput {
  name: string;
  substrate: string;
  capabilities: string[];
}

export function validateWorker(raw: Record<string, unknown>): Parsed<WorkerInput> {
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  if (!WORKER_NAME_RE.test(name)) return { ok: false, error: "name" };
  const substrate = str(raw.substrate, 60);
  if (!substrate) return { ok: false, error: "substrate" };
  const capsRaw = Array.isArray(raw.capabilities)
    ? raw.capabilities
    : typeof raw.capabilities === "string"
      ? raw.capabilities.split(",")
      : [];
  const capabilities = [...new Set(capsRaw.map((c) => String(c).trim()).filter(Boolean))];
  if (capabilities.length === 0 || !capabilities.every((c) => PROFILE_RE.test(c))) {
    return { ok: false, error: "capabilities" };
  }
  return { ok: true, value: { name, substrate, capabilities } };
}

export function validateReason(v: unknown): Parsed<string> {
  const s = str(v, 1000);
  return s ? { ok: true, value: s } : { ok: false, error: "reason" };
}

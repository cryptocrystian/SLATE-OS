/**
 * BuildOS domain vocabulary (docs/81). BUILDOS MODULE.
 *
 * Mirrors the check constraints in migrations 0030–0033. Machine values are
 * lowercase; UI copy comes from LABELS.
 */

export const ORIGIN_KINDS = ["consultos_engagement", "ventureos_venture", "internal"] as const;
export type OriginKind = (typeof ORIGIN_KINDS)[number];

export const ISOLATION_CLASSES = ["internal", "client"] as const;
export type IsolationClass = (typeof ISOLATION_CLASSES)[number];

export const PROJECT_STATUSES = ["intake", "ready", "active", "paused", "closed"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const MODEL_FAMILIES = ["anthropic", "openai", "google", "xai", "other"] as const;
export type ModelFamily = (typeof MODEL_FAMILIES)[number];

export const WORK_ITEM_KINDS = ["foundation", "journey", "remediation", "chore"] as const;
export type WorkItemKind = (typeof WORK_ITEM_KINDS)[number];

export const WORK_ITEM_STATUSES = [
  "draft",
  "ready",
  "in_progress",
  "held",
  "escalated",
  "accepted",
  "superseded",
  "cancelled",
] as const;
export type WorkItemStatus = (typeof WORK_ITEM_STATUSES)[number];

export const HOLD_REASONS = [
  "provider_unavailable",
  "no_verdict",
  "worker_lost",
  "budget_exceeded",
  "precondition",
  "operator_abort",
  "thrash",
] as const;
export type HoldReason = (typeof HOLD_REASONS)[number];

export const RUN_VERDICTS = ["accepted", "rejected", "escalated", "held", "aborted"] as const;
export type RunVerdict = (typeof RUN_VERDICTS)[number];

export const FAILURE_CLASSES = [
  "rejected",
  "merge_conflict",
  "escalated",
  "provider_unavailable",
  "no_verdict",
  "worker_lost",
  "budget_exceeded",
  "precondition",
  "operator_abort",
] as const;
export type FailureClass = (typeof FAILURE_CLASSES)[number];

export const DECISION_CLASSES = ["technical", "product", "owner"] as const;
export type DecisionClass = (typeof DECISION_CLASSES)[number];

export const DECISION_STATUSES = ["open", "ruled", "withdrawn"] as const;
export type DecisionStatus = (typeof DECISION_STATUSES)[number];

export const ITEM_ACTIONS = ["ready", "cancelled", "superseded"] as const;
export type ItemAction = (typeof ITEM_ACTIONS)[number];

export const BILLING_CLASSES = ["subscription", "metered", "metered_subscription"] as const;
export type BillingClass = (typeof BILLING_CLASSES)[number];

export const ACCOUNT_HEALTH = ["healthy", "degraded", "down", "unknown"] as const;
export type AccountHealth = (typeof ACCOUNT_HEALTH)[number];

export const ALARM_KINDS = ["stall", "starvation", "thrash", "dead_man", "capacity", "merge"] as const;
export type AlarmKind = (typeof ALARM_KINDS)[number];

/** Operator-allowed work-item transitions (docs/81 §4; enforced again by the DB guard). */
export const OPERATOR_ITEM_TRANSITIONS: Readonly<Record<WorkItemStatus, readonly WorkItemStatus[]>> = {
  draft: ["ready", "cancelled", "superseded"],
  ready: ["draft", "cancelled", "superseded"],
  held: ["ready", "cancelled", "superseded"],
  in_progress: [],
  escalated: [],
  accepted: [],
  superseded: [],
  cancelled: [],
};

export const PROJECT_TRANSITIONS: Readonly<Record<ProjectStatus, readonly ProjectStatus[]>> = {
  intake: ["ready", "closed"],
  ready: ["active", "closed"],
  active: ["paused", "closed"],
  paused: ["active", "closed"],
  closed: [],
};

export interface BuildProject {
  id: string;
  workspaceId: string;
  projectKey: string;
  name: string;
  description: string | null;
  originKind: OriginKind;
  originEngagementId: string | null;
  originEngagementRef: string | null;
  originNameSnapshot: string | null;
  originRef: string | null;
  isolationClass: IsolationClass;
  repoUrl: string;
  defaultBranch: string;
  stackProfile: string;
  canonProfile: string;
  status: ProjectStatus;
  readinessCheckedAt: string | null;
  readinessNote: string | null;
  wipLimit: number;
  priorityWeight: number;
  maxAttempts: number;
  dailyBudgetUsd: number | null;
  builderFamily: ModelFamily;
  judgeFamilies: ModelFamily[];
  activatedAt: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WorkItemCounts {
  total: number;
  accepted: number;
  inProgress: number;
  held: number;
  escalated: number;
  ready: number;
}

export interface BuildProjectSummary extends BuildProject {
  counts: WorkItemCounts;
  openDecisions: number;
  openAlarms: number;
  lastAcceptedAt: string | null;
}

export interface BuildWorkItem {
  id: string;
  projectId: string;
  itemKey: string;
  kind: WorkItemKind;
  canonRef: string | null;
  title: string;
  brief: string | null;
  bindings: string[];
  status: WorkItemStatus;
  readySince: string | null;
  attempts: number;
  holdUntil: string | null;
  holdReason: HoldReason | null;
  lastFailureClass: FailureClass | null;
  consecutiveFailures: number;
  remediatesItemId: string | null;
  acceptedAt: string | null;
  dependsOn: string[];
  createdAt: string;
  updatedAt: string;
}

export interface BuildRun {
  id: string;
  projectId: string;
  workItemId: string;
  runKey: string;
  attemptNo: number;
  lane: string;
  mode: "build" | "remediate" | "resume";
  workerId: string;
  workerName: string | null;
  status: "running" | "finished";
  phase: string | null;
  stackProfile: string;
  canonProfile: string;
  baseSha: string | null;
  canonRefPin: string | null;
  laneVersion: string | null;
  rosterHash: string | null;
  leaseExpiresAt: string;
  heartbeatAt: string | null;
  cancelRequestedAt: string | null;
  verdict: RunVerdict | null;
  failureClass: FailureClass | null;
  summary: string | null;
  resumableFromPhase: string | null;
  branch: string | null;
  prUrl: string | null;
  mergeSha: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface BuildRunEvent {
  id: number;
  ts: string;
  kind: "phase_start" | "phase_end" | "gate" | "agent_call" | "log";
  phase: string | null;
  role: string | null;
  model: string | null;
  family: ModelFamily | null;
  passed: boolean | null;
  detail: Record<string, unknown>;
}

export interface DecisionOption {
  key: string;
  label: string;
  consequence?: string;
}

export interface BuildDecision {
  id: string;
  projectId: string;
  projectKey: string | null;
  projectName: string | null;
  workItemId: string;
  itemKey: string | null;
  runId: string | null;
  class: DecisionClass;
  title: string;
  brief: string;
  options: DecisionOption[];
  recommendedOption: string | null;
  status: DecisionStatus;
  rulingOption: string | null;
  rulingNote: string | null;
  itemAction: ItemAction | null;
  resultingCanonRef: string | null;
  ruledAt: string | null;
  createdAt: string;
}

export interface BuildAlarm {
  id: string;
  projectId: string | null;
  projectKey: string | null;
  kind: AlarmKind;
  subject: string;
  detail: string | null;
  raisedAt: string;
  clearedAt: string | null;
}

export interface ProviderAccount {
  id: string;
  label: string;
  family: ModelFamily;
  provider: string;
  billingClass: BillingClass;
  secretRef: string;
  maxConcurrency: number;
  liveSlots: number;
  status: "active" | "disabled";
  health: AccountHealth;
  healthCheckedAt: string | null;
  healthDetail: string | null;
  cooldownUntil: string | null;
}

export interface BuildWorker {
  id: string;
  name: string;
  substrate: string;
  capabilities: string[];
  status: "active" | "disabled";
  lastSeenAt: string | null;
}

export interface ProjectCost {
  todayUsd: number;
  last7dUsd: number;
  calls7d: number;
}

export const LABELS = {
  originKind: {
    consultos_engagement: "Client · ConsultOS",
    ventureos_venture: "Venture",
    internal: "Internal",
  } satisfies Record<OriginKind, string>,
  projectStatus: {
    intake: "Intake",
    ready: "Ready",
    active: "Active",
    paused: "Paused",
    closed: "Closed",
  } satisfies Record<ProjectStatus, string>,
  workItemStatus: {
    draft: "Draft",
    ready: "Ready",
    in_progress: "In progress",
    held: "Held",
    escalated: "Escalated",
    accepted: "Accepted",
    superseded: "Superseded",
    cancelled: "Cancelled",
  } satisfies Record<WorkItemStatus, string>,
  workItemKind: {
    foundation: "Foundation",
    journey: "Journey",
    remediation: "Remediation",
    chore: "Chore",
  } satisfies Record<WorkItemKind, string>,
  holdReason: {
    provider_unavailable: "Provider unavailable",
    no_verdict: "No verdict",
    worker_lost: "Worker lost",
    budget_exceeded: "Budget exceeded",
    precondition: "Precondition — needs operator",
    operator_abort: "Stopped by operator",
    thrash: "Thrash — repeated failure, needs operator",
  } satisfies Record<HoldReason, string>,
  verdict: {
    accepted: "Accepted",
    rejected: "Rejected",
    escalated: "Escalated",
    held: "Held",
    aborted: "Aborted",
  } satisfies Record<RunVerdict, string>,
  failureClass: {
    rejected: "Rejected by review",
    merge_conflict: "Merge conflict",
    escalated: "Escalated to a decision",
    provider_unavailable: "Provider unavailable",
    no_verdict: "No verdict",
    worker_lost: "Worker lost",
    budget_exceeded: "Budget exceeded",
    precondition: "Precondition failed",
    operator_abort: "Stopped by operator",
  } satisfies Record<FailureClass, string>,
  decisionClass: {
    technical: "Technical",
    product: "Product",
    owner: "Owner",
  } satisfies Record<DecisionClass, string>,
  itemAction: {
    ready: "Return to ready",
    cancelled: "Cancel the work item",
    superseded: "Mark superseded",
  } satisfies Record<ItemAction, string>,
  alarmKind: {
    stall: "Stalled",
    starvation: "Starved",
    thrash: "Thrashing",
    dead_man: "Worker silent",
    capacity: "No capacity",
    merge: "Merge failure",
  } satisfies Record<AlarmKind, string>,
  family: {
    anthropic: "Anthropic",
    openai: "OpenAI",
    google: "Google",
    xai: "xAI",
    other: "Other",
  } satisfies Record<ModelFamily, string>,
  billingClass: {
    subscription: "Subscription",
    metered: "Metered",
    metered_subscription: "Metered subscription",
  } satisfies Record<BillingClass, string>,
} as const;

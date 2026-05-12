import type {
  IntakeRecord,
  ResponseQuality,
  RoleCoverageRow,
  StakeholderRole,
  StakeholderStatus,
  Stakeholder,
  SupportingInput,
} from "./types";

/**
 * DB ↔ TypeScript shape mappers for persisted intake.
 *
 * The TS `Stakeholder` / `RoleCoverageRow` / `SupportingInput` shapes
 * predate persistence and use hyphenated unions; the DB stores the
 * underscored equivalents (or free-text where the vocabulary may
 * evolve). This module is the single point of translation so every
 * existing intake component keeps its props unchanged.
 */

// ---------------------------------------------------------------------------
// DB row shapes
// ---------------------------------------------------------------------------

export interface DbIntakeSessionRow {
  id: string;
  workspace_id: string;
  engagement_id: string;
  contact_id: string | null;
  stakeholder_name: string | null;
  stakeholder_email: string | null;
  stakeholder_title: string | null;
  role: string | null;
  department: string | null;
  status: string | null;
  response_quality: string | null;
  token_hash: string;
  token_expires_at: string | null;
  sent_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  last_activity_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbIntakeResponseRow {
  id: string;
  session_id: string;
  question_id: string;
  question_label: string | null;
  answer_text: string | null;
  answer_json: unknown;
  created_at: string;
  updated_at: string;
}

export interface DbInputAssetRow {
  id: string;
  workspace_id: string;
  engagement_id: string;
  session_id: string | null;
  title: string;
  asset_type: string | null;
  source: string | null;
  status: string | null;
  evidence_quality: string | null;
  linked_role: string | null;
  summary: string | null;
  metadata: unknown;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Enum translation
// ---------------------------------------------------------------------------

const ROLE_FROM_DB: Record<string, StakeholderRole> = {
  executive: "executive",
  operations: "operations",
  sales: "sales",
  marketing: "marketing",
  finance: "finance",
  it: "it",
  frontline: "frontline",
  customer_success: "customer-success",
  other: "other",
};

const ROLE_TO_DB: Record<StakeholderRole, string> = {
  executive: "executive",
  operations: "operations",
  sales: "sales",
  marketing: "marketing",
  finance: "finance",
  it: "it",
  frontline: "frontline",
  "customer-success": "customer_success",
  other: "other",
};

const STATUS_FROM_DB: Record<string, StakeholderStatus> = {
  invited: "invited",
  in_progress: "in-progress",
  completed: "completed",
  needs_follow_up: "needs-follow-up",
  not_started: "not-started",
  expired: "needs-follow-up",
};

const QUALITY_FROM_DB: Record<string, ResponseQuality> = {
  strong: "strong",
  adequate: "adequate",
  thin: "thin",
  missing: "missing",
};

export function dbRoleFor(role: StakeholderRole): string {
  return ROLE_TO_DB[role] ?? "other";
}

export function tsRoleFor(role: string | null | undefined): StakeholderRole {
  if (!role) return "other";
  return ROLE_FROM_DB[role] ?? "other";
}

export function tsStatusFor(
  status: string | null | undefined,
): StakeholderStatus {
  if (!status) return "not-started";
  return STATUS_FROM_DB[status] ?? "not-started";
}

export function tsQualityFor(
  quality: string | null | undefined,
): ResponseQuality {
  if (!quality) return "missing";
  return QUALITY_FROM_DB[quality] ?? "missing";
}

// ---------------------------------------------------------------------------
// Time formatters
// ---------------------------------------------------------------------------

export function formatRelativeOrDash(
  iso: string | null | undefined,
  now = new Date(),
): string {
  if (!iso) return "—";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  if (diffHr < 48) return "Yesterday";
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffDay < 14) return "Last week";
  if (diffDay < 31) return `${Math.round(diffDay / 7)} weeks ago`;
  return then.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Derived stakeholder mapping
// ---------------------------------------------------------------------------

export interface SessionWithResponses {
  session: DbIntakeSessionRow;
  responses: DbIntakeResponseRow[];
}

const TOTAL_QUESTIONS = 7;

export function mapSessionToStakeholder(
  input: SessionWithResponses,
): Stakeholder {
  const { session, responses } = input;
  const status = tsStatusFor(session.status);
  const quality = tsQualityFor(session.response_quality);
  const role = tsRoleFor(session.role);

  const completion = computeCompletionPercent(responses, status);
  const summary = buildSummary(responses);

  const name =
    session.stakeholder_name?.trim() ||
    session.stakeholder_email?.trim() ||
    "Pending stakeholder";
  const title = session.stakeholder_title?.trim() || "Title pending";

  return {
    id: session.id,
    name,
    title,
    role,
    department: session.department?.trim() || undefined,
    status,
    completionPercent: completion,
    responseQuality: quality,
    lastActivity: formatRelativeOrDash(session.last_activity_at),
    lastActivityAt: session.last_activity_at ?? null,
    summary,
    keySignals: [],
    openQuestions: [],
    riskFlags: [],
  };
}

function computeCompletionPercent(
  responses: DbIntakeResponseRow[],
  status: StakeholderStatus,
): number {
  if (status === "completed") return 100;
  if (responses.length === 0) return 0;
  const ratio = responses.length / TOTAL_QUESTIONS;
  return Math.min(99, Math.max(5, Math.round(ratio * 100)));
}

function buildSummary(responses: DbIntakeResponseRow[]): string {
  if (responses.length === 0) {
    return "No response yet. Stakeholder has not opened the intake link.";
  }
  // Prefer the automation_wishlist or success_for_role response as a
  // representative blurb; fall back to the first non-empty answer.
  const preferred = responses.find(
    (r) =>
      r.question_id === "automation_wishlist" ||
      r.question_id === "success_for_role",
  );
  const candidate = preferred ?? responses[0];
  const text = candidate?.answer_text?.trim();
  if (!text) {
    return `${responses.length} response${responses.length === 1 ? "" : "s"} submitted.`;
  }
  return text.length > 240 ? `${text.slice(0, 237)}…` : text;
}

// ---------------------------------------------------------------------------
// Role coverage derivation
// ---------------------------------------------------------------------------

const REQUIRED_ROLES: StakeholderRole[] = [
  "executive",
  "operations",
  "sales",
  "it",
  "finance",
  "frontline",
];

const OPTIONAL_ROLES: StakeholderRole[] = [
  "marketing",
  "customer-success",
  "other",
];

const ROLE_NOTE: Record<StakeholderRole, { covered: string; partial: string; missing: string }> = {
  executive: {
    covered: "Executive sponsor identified.",
    partial: "Executive engaged but response incomplete.",
    missing: "Executive sponsor not yet identified.",
  },
  operations: {
    covered: "Operations leader engaged.",
    partial: "Operations response in progress.",
    missing: "Operations perspective not yet covered.",
  },
  sales: {
    covered: "Sales perspective captured.",
    partial: "Sales response in progress.",
    missing: "Sales perspective not yet covered.",
  },
  marketing: {
    covered: "Marketing perspective captured.",
    partial: "Marketing response in progress.",
    missing: "Marketing perspective not yet covered (optional).",
  },
  finance: {
    covered: "Finance perspective captured.",
    partial: "Finance response in progress.",
    missing: "Finance perspective shapes proposal pricing — invite a stakeholder.",
  },
  it: {
    covered: "Systems / IT contact engaged.",
    partial: "Systems contact in progress.",
    missing: "Systems / IT perspective is required to scope integrations.",
  },
  frontline: {
    covered: "Frontline perspective captured.",
    partial: "Frontline response started but incomplete.",
    missing:
      "Frontline coverage is required so recommendations stay grounded in real day-to-day work.",
  },
  "customer-success": {
    covered: "Customer success perspective captured.",
    partial: "Customer success response in progress.",
    missing: "Customer success perspective not yet covered (optional).",
  },
  other: {
    covered: "Additional stakeholders engaged.",
    partial: "Additional stakeholder response in progress.",
    missing: "No additional stakeholders invited.",
  },
};

export function deriveRoleCoverage(
  stakeholders: Stakeholder[],
): RoleCoverageRow[] {
  const ordered: StakeholderRole[] = [...REQUIRED_ROLES, ...OPTIONAL_ROLES];
  return ordered.map((role) => {
    const matching = stakeholders.filter((s) => s.role === role);
    const required = REQUIRED_ROLES.includes(role);
    const completed = matching.filter((s) => s.status === "completed").length;
    const inProgress = matching.filter(
      (s) => s.status === "in-progress" || s.status === "needs-follow-up",
    ).length;

    let status: RoleCoverageRow["status"] = "missing";
    let note = ROLE_NOTE[role].missing;
    if (completed > 0) {
      status = "covered";
      note = ROLE_NOTE[role].covered;
    } else if (inProgress > 0 || matching.length > 0) {
      status = "partial";
      note = ROLE_NOTE[role].partial;
    }

    return {
      role,
      required,
      status,
      stakeholderCount: matching.length,
      coverageNote: note,
    };
  });
}

// ---------------------------------------------------------------------------
// Input asset mapping
// ---------------------------------------------------------------------------

const INPUT_ASSET_TYPES: SupportingInput["type"][] = [
  "operations-doc",
  "process-map",
  "data-export",
  "system-screenshot",
  "policy-doc",
  "report",
  "other",
];

const INPUT_ASSET_STATUSES: SupportingInput["status"][] = [
  "requested",
  "received",
  "reviewed",
  "missing",
  "outdated",
];

const INPUT_ASSET_QUALITIES: SupportingInput["evidenceQuality"][] = [
  "strong",
  "adequate",
  "thin",
  "unverified",
];

function fitInUnion<T extends string>(
  v: string | null | undefined,
  union: T[],
  fallback: T,
): T {
  if (!v) return fallback;
  return (union as string[]).includes(v) ? (v as T) : fallback;
}

export function mapInputAssetRow(row: DbInputAssetRow): SupportingInput {
  return {
    id: row.id,
    title: row.title,
    type: fitInUnion(row.asset_type, INPUT_ASSET_TYPES, "other"),
    source: row.source ?? "Operator",
    status: fitInUnion(row.status, INPUT_ASSET_STATUSES, "requested"),
    evidenceQuality: fitInUnion(
      row.evidence_quality,
      INPUT_ASSET_QUALITIES,
      "unverified",
    ),
    linkedRole: row.linked_role ? tsRoleFor(row.linked_role) : undefined,
    summary: row.summary ?? "",
  };
}

// ---------------------------------------------------------------------------
// Follow-up queue derivation
// ---------------------------------------------------------------------------

export function deriveFollowUps(
  stakeholders: Stakeholder[],
): IntakeRecord["followUps"] {
  const followUps: IntakeRecord["followUps"] = [];
  for (const s of stakeholders) {
    if (s.status === "needs-follow-up") {
      followUps.push({
        id: `follow-${s.id}`,
        label: `${s.name} · ${s.title}`,
        detail:
          "Stakeholder began intake but response stalled. A personal nudge will likely close it.",
        target: "This week",
        severity: "high",
      });
    } else if (s.status === "not-started") {
      followUps.push({
        id: `follow-${s.id}`,
        label: `${s.name} · ${s.title}`,
        detail:
          "Invitation sent but no activity yet. Confirm receipt and remove blockers.",
        target: "This week",
        severity: "medium",
      });
    }
  }
  return followUps;
}

// ---------------------------------------------------------------------------
// UUID guard
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

import type {
  DocumentStatus,
  Engagement,
  EngagementStage,
  EngagementStatus,
  EngagementType,
  FindingsStatus,
  IntakeStatus,
  OpportunityScoringStatus,
  PanelStatusBadge,
  PanelTone,
  ProposalStatus,
  ReportStatus,
  ScorecardSnapshot,
} from "./types";

/**
 * DB ↔ TypeScript shape mappers for persisted engagements.
 *
 * The TS `Engagement` shape predates persistence and uses hyphenated
 * union strings; the DB enums use underscores. This module is the
 * single point of translation so the existing engagement components
 * keep their props unchanged.
 */

// ---------------------------------------------------------------------------
// DB row shape
// ---------------------------------------------------------------------------

export interface DbEngagementRow {
  id: string;
  workspace_id: string;
  account_id: string;
  contact_id: string | null;
  linked_lead_id: string | null;
  name: string;
  engagement_type: string;
  status: string;
  current_stage: string;
  owner_profile_id: string | null;
  target_date: string | null;
  last_activity_at: string;
  next_milestone: string | null;
  recommended_action: unknown;
  stage_progress: unknown;
  intake_status: unknown;
  document_status: unknown;
  findings_status: unknown;
  opportunity_status: unknown;
  report_status: unknown;
  proposal_status: unknown;
  risk_notes: unknown;
  dependencies: unknown;
  notes: unknown;
  source_snapshot: unknown;
  created_at: string;
  updated_at: string;
}

export interface DbAccountJoin {
  name: string;
  industry: string | null;
  practice_area: string | null;
}

export interface DbContactJoin {
  full_name: string | null;
  title: string | null;
  email: string | null;
}

export interface DbProfileJoin {
  display_name: string | null;
}

// ---------------------------------------------------------------------------
// Enum translation
// ---------------------------------------------------------------------------

const STATUS_FROM_DB: Record<string, EngagementStatus> = {
  setup: "setup",
  active: "active",
  needs_review: "needs-review",
  blocked: "blocked",
  ready_for_report: "ready-for-report",
  proposal_draft: "proposal-draft",
  completed: "completed",
  paused: "paused",
};

const STATUS_TO_DB: Record<EngagementStatus, string> = {
  setup: "setup",
  active: "active",
  "needs-review": "needs_review",
  blocked: "blocked",
  "ready-for-report": "ready_for_report",
  "proposal-draft": "proposal_draft",
  completed: "completed",
  paused: "paused",
};

const STAGE_FROM_DB: Record<string, EngagementStage> = {
  setup: "setup",
  intake: "intake",
  synthesis: "synthesis",
  scoring: "scoring",
  report: "report",
  proposal: "proposal",
};

const TYPE_FROM_DB: Record<string, EngagementType> = {
  ai_opportunity_sprint: "AI Opportunity Sprint",
  workflow_automation_assessment: "Workflow Automation Assessment",
  systems_readiness_review: "Systems Readiness Review",
};

const PRACTICE_FROM_DB: Record<string, Engagement["practiceArea"]> = {
  ai_systems: "AI Systems",
  custom_dev: "Custom Development",
  venture_studio: "Venture Studio",
};

export function dbStatusFor(status: EngagementStatus): string {
  return STATUS_TO_DB[status];
}

// ---------------------------------------------------------------------------
// JSON shape helpers
// ---------------------------------------------------------------------------

const PANEL_TONES: PanelTone[] = [
  "info",
  "warning",
  "success",
  "neutral",
  "risk",
  "brand",
];

function toPanelTone(v: unknown, fallback: PanelTone = "neutral"): PanelTone {
  return typeof v === "string" && (PANEL_TONES as string[]).includes(v)
    ? (v as PanelTone)
    : fallback;
}

function toPanelStatus(
  v: unknown,
  fallback: PanelStatusBadge,
): PanelStatusBadge {
  if (v && typeof v === "object" && !Array.isArray(v)) {
    const o = v as Record<string, unknown>;
    return {
      tone: toPanelTone(o.tone, fallback.tone),
      label: typeof o.label === "string" ? o.label : fallback.label,
    };
  }
  return fallback;
}

function toStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

function toString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function toNumber(v: unknown, fallback = 0): number {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = Number(v);
    if (Number.isFinite(n)) return n;
  }
  return fallback;
}

function toIntakeStatus(v: unknown): IntakeStatus {
  const o = (v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  return {
    status: toPanelStatus(o.status, { tone: "info", label: "Ready to send" }),
    stakeholdersInvited: toNumber(o.stakeholdersInvited),
    stakeholdersResponded: toNumber(o.stakeholdersResponded),
    rolesCovered: toStringArray(o.rolesCovered),
    rolesMissing: toStringArray(o.rolesMissing),
    lastResponseAt:
      typeof o.lastResponseAt === "string" ? o.lastResponseAt : undefined,
    nextAction: toString(
      o.nextAction,
      "Send role-based intake to stakeholders.",
    ),
  };
}

function toDocumentStatus(v: unknown): DocumentStatus {
  const o = (v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  return {
    status: toPanelStatus(o.status, {
      tone: "neutral",
      label: "Not yet requested",
    }),
    requested: toNumber(o.requested),
    received: toNumber(o.received),
    reviewed: toNumber(o.reviewed),
    reviewState: toString(
      o.reviewState,
      "Document requests will go out alongside intake.",
    ),
    nextAction: toString(o.nextAction, "Confirm document list before sending."),
  };
}

function toFindingsStatus(v: unknown): FindingsStatus {
  const o = (v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  return {
    status: toPanelStatus(o.status, {
      tone: "neutral",
      label: "Awaiting intake",
    }),
    candidate: toNumber(o.candidate),
    approved: toNumber(o.approved),
    rejected: toNumber(o.rejected),
    reviewState: toString(
      o.reviewState,
      "Synthesis runs after intake responses are in.",
    ),
    nextAction: toString(o.nextAction, "Hold until Synthesis stage."),
  };
}

function toOpportunityStatus(v: unknown): OpportunityScoringStatus {
  const o = (v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  return {
    status: toPanelStatus(o.status, {
      tone: "neutral",
      label: "Awaiting findings",
    }),
    identified: toNumber(o.identified),
    quickWins: toNumber(o.quickWins),
    strategicBuilds: toNumber(o.strategicBuilds),
    defer: toNumber(o.defer),
    scoringState: toString(
      o.scoringState,
      "Scoring begins once findings are approved.",
    ),
    nextAction: toString(o.nextAction, "Hold until Scoring stage."),
  };
}

function toReportStatus(v: unknown): ReportStatus {
  const o = (v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  return {
    status: toPanelStatus(o.status, {
      tone: "neutral",
      label: "Not started",
    }),
    sectionsTotal: toNumber(o.sectionsTotal, 12),
    sectionsDrafted: toNumber(o.sectionsDrafted),
    sectionsApproved: toNumber(o.sectionsApproved),
    state: toString(o.state, "Outline will draft after scoring."),
    nextAction: toString(o.nextAction, "Hold until Report stage."),
  };
}

function toProposalStatus(v: unknown): ProposalStatus {
  const o = (v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const recommended = o.recommendedOption;
  return {
    status: toPanelStatus(o.status, {
      tone: "neutral",
      label: "Not started",
    }),
    options: toNumber(o.options),
    recommendedOption: typeof recommended === "string" ? recommended : null,
    state: toString(
      o.state,
      "Tiered SOW drafts open after the report is finalized.",
    ),
    nextAction: toString(o.nextAction, "Hold until Proposal stage."),
  };
}

function toScorecardSnapshot(v: unknown): ScorecardSnapshot | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const o = v as Record<string, unknown>;
  const ai = o.ai;
  const friction = o.friction;
  const systems = o.systems;
  const classification = o.classification;
  if (
    typeof ai !== "number" ||
    typeof friction !== "number" ||
    typeof systems !== "number" ||
    typeof classification !== "string"
  ) {
    return undefined;
  }
  return { ai, friction, systems, classification };
}

// ---------------------------------------------------------------------------
// Defaults — used when a status panel JSON column is null
// ---------------------------------------------------------------------------

export function defaultIntakeStatus(): IntakeStatus {
  return {
    status: { tone: "info", label: "Ready to send" },
    stakeholdersInvited: 0,
    stakeholdersResponded: 0,
    rolesCovered: [],
    rolesMissing: [],
    nextAction: "Confirm stakeholder list and send role-based intake.",
  };
}

export function defaultDocumentStatus(): DocumentStatus {
  return {
    status: { tone: "neutral", label: "Not yet requested" },
    requested: 0,
    received: 0,
    reviewed: 0,
    reviewState: "Document requests will go out alongside intake.",
    nextAction: "Confirm document list before sending.",
  };
}

export function defaultFindingsStatus(): FindingsStatus {
  return {
    status: { tone: "neutral", label: "Awaiting intake" },
    candidate: 0,
    approved: 0,
    rejected: 0,
    reviewState: "Synthesis runs after intake responses are in.",
    nextAction: "Hold until Synthesis stage.",
  };
}

export function defaultOpportunityStatus(): OpportunityScoringStatus {
  return {
    status: { tone: "neutral", label: "Awaiting findings" },
    identified: 0,
    quickWins: 0,
    strategicBuilds: 0,
    defer: 0,
    scoringState: "Scoring begins once findings are approved.",
    nextAction: "Hold until Scoring stage.",
  };
}

export function defaultReportStatus(): ReportStatus {
  return {
    status: { tone: "neutral", label: "Not started" },
    sectionsTotal: 12,
    sectionsDrafted: 0,
    sectionsApproved: 0,
    state: "Outline drafts after scoring.",
    nextAction: "Hold until Report stage.",
  };
}

export function defaultProposalStatus(): ProposalStatus {
  return {
    status: { tone: "neutral", label: "Not started" },
    options: 0,
    recommendedOption: null,
    state: "Tiered SOW drafts open after the report is finalized.",
    nextAction: "Hold until Proposal stage.",
  };
}

// ---------------------------------------------------------------------------
// Time / date formatters reused from the lead surface
// ---------------------------------------------------------------------------

function formatRelative(iso: string, now = new Date()): string {
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

function formatTargetDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Public mapper
// ---------------------------------------------------------------------------

export interface MapEngagementOptions {
  account: DbAccountJoin | null;
  contact: DbContactJoin | null;
  ownerProfile: DbProfileJoin | null;
}

export function mapEngagementRow(
  row: DbEngagementRow,
  joins: MapEngagementOptions,
): Engagement {
  const account = joins.account;
  const contact = joins.contact;
  const owner = joins.ownerProfile;

  const status = STATUS_FROM_DB[row.status] ?? "active";
  const stage = STAGE_FROM_DB[row.current_stage] ?? "setup";
  const engagementType = TYPE_FROM_DB[row.engagement_type] ?? "AI Opportunity Sprint";
  const practiceArea =
    PRACTICE_FROM_DB[account?.practice_area ?? "ai_systems"] ?? "AI Systems";

  const recommendedRaw = row.recommended_action;
  const recommended =
    recommendedRaw && typeof recommendedRaw === "object" && !Array.isArray(recommendedRaw)
      ? (recommendedRaw as Record<string, unknown>)
      : {};

  const accountName = account?.name?.trim() || "Untitled account";
  const ownerLabel =
    owner?.display_name?.trim() ||
    contact?.full_name?.trim() ||
    "Unassigned";

  return {
    id: row.id,
    name: row.name,
    accountName,
    companyName: accountName,
    industry: account?.industry?.trim() || "Unknown industry",
    practiceArea,
    linkedLeadId: row.linked_lead_id ?? undefined,
    engagementType,
    status,
    currentStage: stage,
    owner: ownerLabel,
    createdAt: row.created_at,
    targetDate: formatTargetDate(row.target_date),
    lastActivityAt: formatRelative(row.last_activity_at),
    nextMilestone:
      row.next_milestone?.trim() ||
      "Confirm next milestone with the engagement owner.",
    recommendedAction: {
      headline: toString(
        recommended.headline,
        "Confirm the next step for this engagement.",
      ),
      detail: toString(
        recommended.detail,
        "Review intake readiness, stakeholder coverage, and source-lead context before kickoff.",
      ),
      cta: toString(recommended.cta, "Manage Intake"),
    },
    scorecardSummary: toScorecardSnapshot(row.source_snapshot),
    intake: row.intake_status ? toIntakeStatus(row.intake_status) : defaultIntakeStatus(),
    documents: row.document_status
      ? toDocumentStatus(row.document_status)
      : defaultDocumentStatus(),
    findings: row.findings_status
      ? toFindingsStatus(row.findings_status)
      : defaultFindingsStatus(),
    opportunities: row.opportunity_status
      ? toOpportunityStatus(row.opportunity_status)
      : defaultOpportunityStatus(),
    report: row.report_status ? toReportStatus(row.report_status) : defaultReportStatus(),
    proposal: row.proposal_status
      ? toProposalStatus(row.proposal_status)
      : defaultProposalStatus(),
    riskNotes: toStringArray(row.risk_notes),
    dependencies: toStringArray(row.dependencies),
    notes: toStringArray(row.notes),
  } satisfies Engagement;
}

// ---------------------------------------------------------------------------
// UUID guard
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

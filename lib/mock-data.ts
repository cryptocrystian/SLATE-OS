export type Practice = "ai" | "dev" | "studio";

export type MetricTone = "neutral" | "info" | "success" | "warning" | "risk";

export interface DashboardMetric {
  id: string;
  label: string;
  value: string;
  delta?: string;
  hint?: string;
  tone?: MetricTone;
}

export type ReviewItemKind =
  | "scorecard"
  | "finding"
  | "proposal"
  | "lead"
  | "report";

export interface ReviewItem {
  id: string;
  kind: ReviewItemKind;
  title: string;
  account: string;
  context: string;
  recommendedAction: string;
  receivedAt: string;
  priority: "high" | "medium" | "low";
}

export type EngagementStage =
  | "Setup"
  | "Intake"
  | "Synthesis"
  | "Scoring"
  | "Report"
  | "Proposal";

export const ENGAGEMENT_STAGES: EngagementStage[] = [
  "Setup",
  "Intake",
  "Synthesis",
  "Scoring",
  "Report",
  "Proposal",
];

export interface Engagement {
  id: string;
  account: string;
  type: string;
  practice: Practice;
  stage: EngagementStage;
  stakeholdersResponded: number;
  stakeholdersTotal: number;
  nextAction: string;
  owner: string;
  health: "on-track" | "attention" | "at-risk";
}

export type ActivityType =
  | "scorecard_completed"
  | "finding_approved"
  | "intake_response"
  | "proposal_sent"
  | "lead_qualified"
  | "report_section_drafted"
  | "document_uploaded";

export interface ActivityEvent {
  id: string;
  type: ActivityType;
  title: string;
  detail: string;
  account: string;
  actor: string;
  at: string;
}

export const dashboardMetrics: DashboardMetric[] = [
  {
    id: "new-scorecards",
    label: "New Scorecards",
    value: "12",
    delta: "+4 this week",
    hint: "Awaiting fit review",
    tone: "info",
  },
  {
    id: "high-fit-leads",
    label: "High-Fit Leads",
    value: "5",
    delta: "+2 this week",
    hint: "Fit score 80+",
    tone: "success",
  },
  {
    id: "active-audits",
    label: "Active Audits",
    value: "3",
    hint: "AI Opportunity Sprints in flight",
    tone: "neutral",
  },
  {
    id: "findings-needs-review",
    label: "Findings Needing Review",
    value: "18",
    delta: "9 high confidence",
    hint: "Across 2 engagements",
    tone: "warning",
  },
  {
    id: "reports-in-progress",
    label: "Reports in Progress",
    value: "2",
    hint: "1 ready for finalization",
    tone: "neutral",
  },
  {
    id: "open-proposals",
    label: "Open Proposals",
    value: "4",
    delta: "$184k total potential",
    hint: "2 awaiting client decision",
    tone: "info",
  },
];

export const reviewQueue: ReviewItem[] = [
  {
    id: "rq-001",
    kind: "scorecard",
    title: "New AI Workflow Scorecard submitted",
    account: "Northwind Logistics",
    context: "Mid-market logistics · 220 employees · ops-heavy workflow",
    recommendedAction: "Review fit score and route to Diagnostic queue",
    receivedAt: "12 minutes ago",
    priority: "high",
  },
  {
    id: "rq-002",
    kind: "finding",
    title: "Findings ready for consultant review",
    account: "Helio Health",
    context: "9 high-confidence findings synthesized from intake responses",
    recommendedAction: "Approve, edit, or regenerate before scoring",
    receivedAt: "1 hour ago",
    priority: "high",
  },
  {
    id: "rq-003",
    kind: "proposal",
    title: "Proposal draft awaiting approval",
    account: "Cumulus Retail Group",
    context: "Three-tier SOW · Quick-Win, Workflow System, Managed Partner",
    recommendedAction: "Review pricing assumptions before client send",
    receivedAt: "3 hours ago",
    priority: "medium",
  },
  {
    id: "rq-004",
    kind: "lead",
    title: "Diagnostic application received",
    account: "Atlas Manufacturing",
    context: "Director of Ops · readiness 72 · friction 81",
    recommendedAction: "Schedule AI Systems Review intro call",
    receivedAt: "Yesterday",
    priority: "medium",
  },
  {
    id: "rq-005",
    kind: "report",
    title: "Executive Summary needs final pass",
    account: "Helio Health",
    context: "Linked to 14 approved findings · roadmap drafted",
    recommendedAction: "Finalize narrative and lock for export",
    receivedAt: "Yesterday",
    priority: "low",
  },
];

export const activeEngagements: Engagement[] = [
  {
    id: "eng-helio",
    account: "Helio Health",
    type: "AI Opportunity Sprint",
    practice: "ai",
    stage: "Synthesis",
    stakeholdersResponded: 6,
    stakeholdersTotal: 8,
    nextAction: "Review synthesized findings",
    owner: "M. Reyes",
    health: "on-track",
  },
  {
    id: "eng-cumulus",
    account: "Cumulus Retail Group",
    type: "AI Opportunity Sprint",
    practice: "ai",
    stage: "Proposal",
    stakeholdersResponded: 7,
    stakeholdersTotal: 7,
    nextAction: "Finalize three-tier proposal",
    owner: "J. Okafor",
    health: "on-track",
  },
  {
    id: "eng-northwind",
    account: "Northwind Logistics",
    type: "Workflow Automation Assessment",
    practice: "ai",
    stage: "Intake",
    stakeholdersResponded: 2,
    stakeholdersTotal: 6,
    nextAction: "Nudge ops + finance stakeholders",
    owner: "A. Lin",
    health: "attention",
  },
  {
    id: "eng-atlas",
    account: "Atlas Manufacturing",
    type: "Systems Readiness Review",
    practice: "ai",
    stage: "Setup",
    stakeholdersResponded: 0,
    stakeholdersTotal: 5,
    nextAction: "Send role-based intake",
    owner: "M. Reyes",
    health: "on-track",
  },
];

export const recentActivity: ActivityEvent[] = [
  {
    id: "act-001",
    type: "scorecard_completed",
    title: "AI Workflow Scorecard completed",
    detail: "Readiness 68 · Friction 74 · routed to Needs Review",
    account: "Northwind Logistics",
    actor: "Public scorecard",
    at: "12 min ago",
  },
  {
    id: "act-002",
    type: "finding_approved",
    title: "Finding approved",
    detail: "Manual data reconciliation across 3 systems flagged as Quick Win candidate",
    account: "Helio Health",
    actor: "M. Reyes",
    at: "38 min ago",
  },
  {
    id: "act-003",
    type: "intake_response",
    title: "Stakeholder intake submitted",
    detail: "VP Operations · 14 of 14 questions answered · 2 documents attached",
    account: "Helio Health",
    actor: "K. Patel",
    at: "1 hr ago",
  },
  {
    id: "act-004",
    type: "report_section_drafted",
    title: "Report section drafted",
    detail: "AI Readiness Assessment generated · evidence linked",
    account: "Cumulus Retail Group",
    actor: "SLATE · suggested",
    at: "2 hr ago",
  },
  {
    id: "act-005",
    type: "lead_qualified",
    title: "Lead marked High Fit",
    detail: "Internal fit score 84 · Prime Candidate",
    account: "Atlas Manufacturing",
    actor: "J. Okafor",
    at: "Yesterday",
  },
  {
    id: "act-006",
    type: "proposal_sent",
    title: "Proposal sent",
    detail: "AI Workflow System tier · 8-week implementation plan",
    account: "Lattice & Co.",
    actor: "J. Okafor",
    at: "Yesterday",
  },
];

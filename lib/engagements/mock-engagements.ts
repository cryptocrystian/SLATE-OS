import type { Engagement } from "./types";

// Persistence/Auth Step 4: runtime engagement list/detail now read from
// Supabase via `lib/engagements/queries.ts`. This file remains as the
// fixture set for the legacy slug-keyed demo paths
// (`atlas-aios-q2`, `helio-aios-q2`, `meridian-aios-q2`,
// `quanta-aios-q2`, `caldera-aios-q2`) used by the mock-backed
// downstream advisory workspaces (`/intake`, `/findings`,
// `/opportunities`, `/roadmap`, `/report`, `/proposal`) until those
// modules ship in Steps 5–8.
export const MOCK_ENGAGEMENTS: Engagement[] = [
  // ── 1. Atlas Manufacturing — Setup ──────────────────────────────────────
  {
    id: "atlas-aios-q2",
    name: "Atlas — AI Opportunity Sprint",
    accountName: "Atlas Manufacturing",
    companyName: "Atlas Manufacturing",
    industry: "Industrial · contract manufacturing",
    practiceArea: "AI Systems",
    linkedLeadId: "atlas-manufacturing",
    engagementType: "AI Opportunity Sprint",
    status: "setup",
    currentStage: "setup",
    owner: "M. Reyes",
    createdAt: "2026-04-30T18:00:00Z",
    targetDate: "2026-06-12",
    lastActivityAt: "Yesterday",
    nextMilestone: "Send role-based intake to all stakeholders",
    recommendedAction: {
      headline: "Send role-based intake",
      detail:
        "Stakeholder list is locked. Send the role-based intake to all five stakeholders today and target 7-day intake close.",
      cta: "Manage Intake",
    },
    scorecardSummary: {
      ai: 64,
      friction: 79,
      systems: 68,
      classification: "Audit-ready",
    },
    intake: {
      status: { tone: "info", label: "Ready to send" },
      stakeholdersInvited: 0,
      stakeholdersResponded: 0,
      rolesCovered: [],
      rolesMissing: [
        "COO",
        "VP Operations",
        "QA Lead",
        "IT/Systems",
        "Frontline Supervisor",
      ],
      nextAction: "Send role-based intake to all 5 stakeholders.",
    },
    documents: {
      status: { tone: "neutral", label: "Not yet requested" },
      requested: 0,
      received: 0,
      reviewed: 0,
      reviewState: "Document requests will go out alongside intake.",
      nextAction: "Confirm document list with Priya before sending.",
    },
    findings: {
      status: { tone: "neutral", label: "Awaiting intake" },
      candidate: 0,
      approved: 0,
      rejected: 0,
      reviewState: "Synthesis runs after intake responses are in.",
      nextAction: "Hold until Synthesis stage.",
    },
    opportunities: {
      status: { tone: "neutral", label: "Awaiting findings" },
      identified: 0,
      quickWins: 0,
      strategicBuilds: 0,
      defer: 0,
      scoringState: "Scoring begins once findings are approved.",
      nextAction: "Hold until Scoring stage.",
    },
    report: {
      status: { tone: "neutral", label: "Not started" },
      sectionsTotal: 12,
      sectionsDrafted: 0,
      sectionsApproved: 0,
      state: "Outline will draft after scoring.",
      nextAction: "Hold until Report stage.",
    },
    proposal: {
      status: { tone: "neutral", label: "Not started" },
      options: 0,
      recommendedOption: null,
      state: "Tiered SOW drafts open after the report is finalized.",
      nextAction: "Hold until Proposal stage.",
    },
    riskNotes: [
      "Industry compliance requirements need explicit governance treatment in sprint scope.",
      "Multi-site rollout means change-management cost is non-trivial after the first sprint.",
    ],
    dependencies: [
      "COO availability for the 30-min intake intro this week.",
    ],
    notes: [
      "Came in via Helio Health CTO referral — referral note shared with Priya.",
    ],
  },

  // ── 2. Helio Health — Intake ────────────────────────────────────────────
  {
    id: "helio-aios-q2",
    name: "Helio Health — AI Opportunity Sprint",
    accountName: "Helio Health",
    companyName: "Helio Health",
    industry: "Healthcare services",
    practiceArea: "AI Systems",
    linkedLeadId: "helio-health",
    engagementType: "AI Opportunity Sprint",
    status: "active",
    currentStage: "intake",
    owner: "M. Reyes",
    createdAt: "2026-04-15T13:00:00Z",
    targetDate: "2026-05-30",
    lastActivityAt: "1 hour ago",
    nextMilestone: "Close intake and start synthesis on Friday",
    recommendedAction: {
      headline: "Nudge finance and frontline reps",
      detail:
        "6 of 8 stakeholders have responded. Finance and frontline are still outstanding — close out before Friday so synthesis stays on schedule.",
      cta: "Manage Intake",
    },
    scorecardSummary: {
      ai: 75,
      friction: 88,
      systems: 61,
      classification: "Audit-ready",
    },
    intake: {
      status: { tone: "info", label: "In progress" },
      stakeholdersInvited: 8,
      stakeholdersResponded: 6,
      rolesCovered: ["Executive", "Operations", "IT", "QA", "Sales", "Marketing"],
      rolesMissing: ["Finance", "Frontline"],
      lastResponseAt: "1 hour ago",
      nextAction: "Send a personal nudge to Finance and Frontline reps.",
    },
    documents: {
      status: { tone: "info", label: "Mostly received" },
      requested: 6,
      received: 4,
      reviewed: 3,
      reviewState: "2 documents outstanding from operations and finance.",
      nextAction: "Follow up on the operations workflow doc and reconciliation export.",
    },
    findings: {
      status: { tone: "warning", label: "Early synthesis · needs review" },
      candidate: 4,
      approved: 0,
      rejected: 0,
      reviewState:
        "4 early candidate findings drafted from partial intake. Each will be re-validated after intake closes.",
      nextAction:
        "Skim the early drafts; full review opens once intake is closed.",
    },
    opportunities: {
      status: { tone: "neutral", label: "Awaiting findings" },
      identified: 0,
      quickWins: 0,
      strategicBuilds: 0,
      defer: 0,
      scoringState: "Scoring begins after findings are approved.",
      nextAction: "Hold until Scoring stage.",
    },
    report: {
      status: { tone: "neutral", label: "Not started" },
      sectionsTotal: 12,
      sectionsDrafted: 0,
      sectionsApproved: 0,
      state: "Outline drafts after scoring.",
      nextAction: "Hold until Report stage.",
    },
    proposal: {
      status: { tone: "neutral", label: "Not started" },
      options: 0,
      recommendedOption: null,
      state: "Proposal drafting opens after the report is finalized.",
      nextAction: "Hold until Proposal stage.",
    },
    riskNotes: [
      "Client-confidential data is in scope. Sprint scope must include explicit governance and human-in-the-loop review.",
      "Frontline reps are the hardest to reach — schedule reminders ahead of close.",
    ],
    dependencies: [
      "Two outstanding documents from Operations and Finance.",
      "Finance stakeholder availability for a 20-min intake call this week.",
    ],
    notes: [
      "Mira flagged that the internal AI working group may be a useful change-management entry point.",
    ],
  },

  // ── 3. Meridian Advisors — Synthesis ────────────────────────────────────
  {
    id: "meridian-aios-q2",
    name: "Meridian Advisors — AI Opportunity Sprint",
    accountName: "Meridian Advisors",
    companyName: "Meridian Advisors",
    industry: "Professional services · advisory",
    practiceArea: "AI Systems",
    engagementType: "AI Opportunity Sprint",
    status: "needs-review",
    currentStage: "synthesis",
    owner: "J. Okafor",
    createdAt: "2026-04-08T16:30:00Z",
    targetDate: "2026-05-22",
    lastActivityAt: "3 hours ago",
    nextMilestone: "Approve findings and move into scoring next week",
    recommendedAction: {
      headline: "Review 12 candidate findings",
      detail:
        "Synthesis surfaced 12 candidate findings with evidence links. Approve, edit, or regenerate before scoring opens.",
      cta: "Review Findings",
    },
    scorecardSummary: {
      ai: 71,
      friction: 82,
      systems: 64,
      classification: "Audit-ready",
    },
    intake: {
      status: { tone: "success", label: "Closed" },
      stakeholdersInvited: 7,
      stakeholdersResponded: 7,
      rolesCovered: [
        "Managing Partner",
        "COO",
        "Practice Lead",
        "Operations",
        "IT",
        "Marketing",
        "Frontline",
      ],
      rolesMissing: [],
      lastResponseAt: "Yesterday",
      nextAction: "Intake is closed. No further action.",
    },
    documents: {
      status: { tone: "success", label: "All reviewed" },
      requested: 8,
      received: 8,
      reviewed: 8,
      reviewState: "All documents reviewed and tagged with evidence quality.",
      nextAction: "No further action.",
    },
    findings: {
      status: { tone: "warning", label: "Needs review" },
      candidate: 12,
      approved: 0,
      rejected: 0,
      reviewState:
        "Synthesis labeled all 12 findings as drafts. Each has linked evidence and a confidence label.",
      nextAction: "Approve, edit, or regenerate each finding.",
    },
    opportunities: {
      status: { tone: "neutral", label: "Awaiting approved findings" },
      identified: 0,
      quickWins: 0,
      strategicBuilds: 0,
      defer: 0,
      scoringState: "Scoring opens once at least 8 findings are approved.",
      nextAction: "Hold until Scoring stage.",
    },
    report: {
      status: { tone: "neutral", label: "Not started" },
      sectionsTotal: 12,
      sectionsDrafted: 0,
      sectionsApproved: 0,
      state: "Outline drafts after scoring.",
      nextAction: "Hold until Report stage.",
    },
    proposal: {
      status: { tone: "neutral", label: "Not started" },
      options: 0,
      recommendedOption: null,
      state: "Proposal drafting opens after the report is finalized.",
      nextAction: "Hold until Proposal stage.",
    },
    riskNotes: [
      "Two findings rely on a single source — flag for additional evidence before approval.",
      "Engagement timeline depends on findings being approved by end of next week.",
    ],
    dependencies: [
      "Practice Lead availability for finding-by-finding review session.",
    ],
    notes: [
      "AI-drafted findings are clearly labeled. Every finding requires human approval before scoring begins.",
    ],
  },

  // ── 4. Quanta Operations — Report ───────────────────────────────────────
  {
    id: "quanta-aios-q1",
    name: "Quanta Operations — AI Opportunity Sprint",
    accountName: "Quanta Operations",
    companyName: "Quanta Operations",
    industry: "Logistics · operations services",
    practiceArea: "AI Systems",
    engagementType: "AI Opportunity Sprint",
    status: "ready-for-report",
    currentStage: "report",
    owner: "A. Lin",
    createdAt: "2026-03-24T14:00:00Z",
    targetDate: "2026-05-08",
    lastActivityAt: "Yesterday",
    nextMilestone: "Finalize Executive Summary and Opportunity Portfolio",
    recommendedAction: {
      headline: "Finalize Executive Summary section",
      detail:
        "8 of 12 sections are drafted. Executive Summary and AI Opportunity Portfolio still need a consultant pass before the report can lock for client review.",
      cta: "Build Report",
    },
    scorecardSummary: {
      ai: 78,
      friction: 84,
      systems: 70,
      classification: "Audit-ready",
    },
    intake: {
      status: { tone: "success", label: "Closed" },
      stakeholdersInvited: 9,
      stakeholdersResponded: 9,
      rolesCovered: [
        "Executive",
        "Operations",
        "Sales",
        "Marketing",
        "Finance",
        "IT",
        "Frontline",
        "QA",
        "Customer Success",
      ],
      rolesMissing: [],
      lastResponseAt: "Two weeks ago",
      nextAction: "No further action.",
    },
    documents: {
      status: { tone: "success", label: "All reviewed" },
      requested: 11,
      received: 11,
      reviewed: 11,
      reviewState: "Every document is tagged with evidence quality.",
      nextAction: "No further action.",
    },
    findings: {
      status: { tone: "success", label: "Approved" },
      candidate: 16,
      approved: 14,
      rejected: 2,
      reviewState:
        "14 findings approved, 2 rejected with notes for the client write-up.",
      nextAction: "No further action.",
    },
    opportunities: {
      status: { tone: "success", label: "Scored" },
      identified: 8,
      quickWins: 3,
      strategicBuilds: 2,
      defer: 3,
      scoringState: "Scored, prioritized, and ranked for the report.",
      nextAction: "No further action.",
    },
    report: {
      status: { tone: "warning", label: "Drafting" },
      sectionsTotal: 12,
      sectionsDrafted: 8,
      sectionsApproved: 4,
      state: "8 of 12 sections drafted; 4 approved; Executive Summary still pending.",
      nextAction: "Finalize Executive Summary and Opportunity Portfolio.",
    },
    proposal: {
      status: { tone: "neutral", label: "Awaiting report lock" },
      options: 0,
      recommendedOption: null,
      state: "Proposal drafting opens once the report is locked.",
      nextAction: "Hold until Proposal stage.",
    },
    riskNotes: [
      "Two rejected findings need a one-line write-up so the client sees how they were considered.",
      "Report finalization is the hinge for the proposal timeline — any slip moves SOW delivery by a week.",
    ],
    dependencies: [
      "Consultant review window for the Executive Summary on Thursday.",
    ],
    notes: [
      "Sprint kicked off on time; intake closed two days ahead of plan.",
    ],
  },

  // ── 5. Caldera Capital Group — Proposal ─────────────────────────────────
  {
    id: "caldera-aios-q1",
    name: "Caldera Capital Group — AI Opportunity Sprint",
    accountName: "Caldera Capital Group",
    companyName: "Caldera Capital Group",
    industry: "Financial services",
    practiceArea: "AI Systems",
    engagementType: "AI Opportunity Sprint",
    status: "proposal-draft",
    currentStage: "proposal",
    owner: "J. Okafor",
    createdAt: "2026-03-04T10:00:00Z",
    targetDate: "2026-05-04",
    lastActivityAt: "Yesterday",
    nextMilestone: "Send proposal to client by Friday",
    recommendedAction: {
      headline: "Review proposal pricing assumptions",
      detail:
        "Three options drafted with the AI Workflow System tier as the recommended path. Validate pricing assumptions and the implementation credit before send.",
      cta: "Draft Proposal",
    },
    scorecardSummary: {
      ai: 82,
      friction: 79,
      systems: 76,
      classification: "Strategic",
    },
    intake: {
      status: { tone: "success", label: "Closed" },
      stakeholdersInvited: 8,
      stakeholdersResponded: 8,
      rolesCovered: [
        "Executive",
        "Operations",
        "Compliance",
        "Risk",
        "IT",
        "Frontline",
        "Finance",
        "Customer Success",
      ],
      rolesMissing: [],
      lastResponseAt: "Three weeks ago",
      nextAction: "No further action.",
    },
    documents: {
      status: { tone: "success", label: "All reviewed" },
      requested: 10,
      received: 10,
      reviewed: 10,
      reviewState: "Compliance docs reviewed with extra rigor.",
      nextAction: "No further action.",
    },
    findings: {
      status: { tone: "success", label: "Approved" },
      candidate: 18,
      approved: 16,
      rejected: 2,
      reviewState: "All findings reviewed; client-facing tone passes locked.",
      nextAction: "No further action.",
    },
    opportunities: {
      status: { tone: "success", label: "Scored" },
      identified: 10,
      quickWins: 4,
      strategicBuilds: 3,
      defer: 3,
      scoringState: "Scored and prioritized; portfolio approved by lead consultant.",
      nextAction: "No further action.",
    },
    report: {
      status: { tone: "success", label: "Final" },
      sectionsTotal: 12,
      sectionsDrafted: 12,
      sectionsApproved: 12,
      state: "Report locked and exported.",
      nextAction: "No further action.",
    },
    proposal: {
      status: { tone: "warning", label: "Draft · awaiting approval" },
      options: 3,
      recommendedOption: "AI Workflow System",
      state:
        "Three tiered options drafted (Quick-Win Build, AI Workflow System, Managed AI Partner). AI Workflow System is the recommended path.",
      nextAction: "Validate pricing and implementation credit before client send.",
    },
    riskNotes: [
      "Compliance posture must be reflected explicitly in the SOW assumptions section.",
      "If Managed AI Partner is selected, second-engagement scoping should follow within 30 days.",
    ],
    dependencies: [
      "Final pricing review with founder before send.",
    ],
    notes: [
      "Client expressed early preference for Workflow System tier during last consultant call.",
    ],
  },
];

export function getEngagementById(id: string): Engagement | undefined {
  return MOCK_ENGAGEMENTS.find((e) => e.id === id);
}

export function engagementForLead(leadId: string): Engagement | undefined {
  return MOCK_ENGAGEMENTS.find((e) => e.linkedLeadId === leadId);
}

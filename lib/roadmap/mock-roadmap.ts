import type { RoadmapItem } from "./types";

const QUANTA: RoadmapItem[] = [
  {
    id: "quanta-r1",
    engagementId: "quanta-aios-q1",
    phase: "first-30",
    title: "Pilot AI-drafted handoff briefs in one business unit",
    objective:
      "Validate the draft-then-review pattern with a single business unit before broader rollout.",
    linkedOpportunityId: "quanta-o1",
    priority: "quick-win",
    keyActions: [
      "Stand up draft-then-review tool inside the existing CRM",
      "Train two reps on the approval flow",
      "Capture two weeks of approved drafts as exemplars",
    ],
    dependencies: ["CRM access for the named pilot business unit"],
    successCriteria: [
      "Time-to-first-operations-question drops by ≥20%",
      "Reps voluntarily continue using the draft after pilot",
    ],
    risks: [
      "If reps skip the review step, drafted context can leak into operations un-validated.",
    ],
    ownerPlaceholder: "Sales Director · pilot lead",
    readinessNote:
      "Pilot scope is intentionally narrow. Broader rollout depends on the exemplar set produced in this 30-day window.",
  },
  {
    id: "quanta-r2",
    engagementId: "quanta-aios-q1",
    phase: "first-30",
    title: "Establish operating-report consolidation baseline",
    objective:
      "Lock a one-page weekly operating consolidation summary with named per-plant owners.",
    linkedOpportunityId: "quanta-o2",
    priority: "quick-win",
    keyActions: [
      "Confirm per-plant data ownership map",
      "Build the consolidation summary",
      "Run the new cadence alongside the existing one for two weeks",
    ],
    dependencies: ["Per-plant data ownership map signed by COO"],
    successCriteria: [
      "Plant managers continue to read the consolidated view",
      "Weekly consolidation cycle drops below 4 hours",
    ],
    risks: [
      "Plants may interpret the same metric differently — variance must surface, not flatten.",
    ],
    ownerPlaceholder: "VP Operations · cadence owner",
  },
  {
    id: "quanta-r3",
    engagementId: "quanta-aios-q1",
    phase: "days-31-60",
    title: "Roll handoff brief to second business unit",
    objective:
      "Promote the validated pilot into a second business unit with a structured rollout playbook.",
    linkedOpportunityId: "quanta-o1",
    priority: "quick-win",
    keyActions: [
      "Document approval-flow exemplars from pilot",
      "Onboard second BU with the same draft-then-review tool",
      "Capture cross-BU variance signal",
    ],
    dependencies: ["First-30-day pilot exemplars are approved"],
    successCriteria: [
      "Second BU's time-to-first-operations-question matches pilot benchmark within 30 days",
    ],
    risks: ["Second BU may have a different handoff template — accommodate, don't ignore."],
    ownerPlaceholder: "VP Operations · rollout sponsor",
  },
  {
    id: "quanta-r4",
    engagementId: "quanta-aios-q1",
    phase: "days-31-60",
    title: "Launch exception-triage MVP",
    objective:
      "Stand up the pattern-plus-rule triage layer with a named approver per exception class.",
    linkedOpportunityId: "quanta-o3",
    priority: "strategic-build",
    keyActions: [
      "Document exception taxonomy",
      "Identify approver per class",
      "Build pattern-detection layer with explicit confidence labels",
    ],
    dependencies: [
      "Validated exception taxonomy",
      "Pilot data from first-30-day pilot",
    ],
    successCriteria: [
      "Exception resolution latency drops by ≥30% in target classes",
      "Zero policy-violation incidents in pilot",
    ],
    risks: ["Auto-routing without human approval risks policy violations."],
    ownerPlaceholder: "VP Operations · approver",
    readinessNote:
      "Strategic Build. Treat the 30-60 window as scope-and-build, not full rollout.",
  },
  {
    id: "quanta-r5",
    engagementId: "quanta-aios-q1",
    phase: "days-61-90",
    title: "Lock multi-plant change-management framework",
    objective:
      "Codify the rollout pattern across plants so each AI surface lands with named owners and a recurring review cadence.",
    linkedOpportunityId: "quanta-o4",
    priority: "strategic-build",
    keyActions: [
      "Document playbook (named owners, success metrics, review cadence)",
      "Confirm quarterly review sponsorship from COO",
      "Run the framework against the two pilots already in flight",
    ],
    dependencies: ["Two pilots in flight with named owners"],
    successCriteria: [
      "Each plant has a named AI owner",
      "Quarterly review cadence persists past the engagement",
    ],
    risks: ["Without explicit ownership, each plant treats the framework differently."],
    ownerPlaceholder: "COO · sponsor",
    readinessNote:
      "Becomes a recurring SOW assumption. Document inside the proposal so it carries forward.",
  },
];

const CALDERA: RoadmapItem[] = [
  {
    id: "caldera-r1",
    engagementId: "caldera-aios-q1",
    phase: "first-30",
    title: "Sprint kickoff and discovery refresh",
    objective:
      "Re-anchor the engagement on the report findings and confirm scope ownership across Operations, Compliance, and Risk.",
    priority: "quick-win",
    keyActions: [
      "Kickoff workshop with all three function leads",
      "Re-validate handoff exemplars from intake",
      "Lock the named approvers per pipeline stage",
    ],
    dependencies: ["Engagement contract signed"],
    successCriteria: [
      "All three function leads confirm the scope and named approvers",
    ],
    risks: ["Function leads may want to renegotiate scope post-report."],
    ownerPlaceholder: "Engagement lead",
  },
  {
    id: "caldera-r2",
    engagementId: "caldera-aios-q1",
    phase: "first-30",
    title: "Pipeline-handoff drafting pilot",
    objective:
      "Stand up the drafting layer for one of the three pipeline handoffs and prove the draft-then-review pattern.",
    linkedOpportunityId: "caldera-o1",
    priority: "quick-win",
    keyActions: [
      "Build draft-then-review tool wrapping the first handoff",
      "Confirm compliance acceptance of the draft pattern",
      "Run two weeks of drafted handoffs through the named approver",
    ],
    dependencies: [
      "Compliance signoff on the draft-then-review pattern",
      "Three named approvers across the pipeline",
    ],
    successCriteria: [
      "First handoff runs entirely on drafts within 30 days",
      "Compliance team accepts the draft pattern",
    ],
    risks: [
      "Compliance posture must stay intact; any draft entering portfolio review without approver sign-off is a policy break.",
    ],
    ownerPlaceholder: "Head of Operations · pilot lead",
  },
  {
    id: "caldera-r3",
    engagementId: "caldera-aios-q1",
    phase: "days-31-60",
    title: "Extend drafting across remaining pipeline handoffs",
    objective:
      "Roll the validated pattern into the other two handoffs in the deal-to-portfolio motion.",
    linkedOpportunityId: "caldera-o1",
    priority: "quick-win",
    keyActions: [
      "Onboard the second and third pipeline approvers",
      "Re-run the same drafting and review loop across both stages",
      "Document any handoff-specific deviations",
    ],
    dependencies: ["First handoff has been running on drafts for two weeks"],
    successCriteria: [
      "All three handoffs run entirely on drafts within 60 days",
    ],
    risks: ["Handoff-specific approvers may slow the rollout."],
    ownerPlaceholder: "Head of Operations · sponsor",
  },
  {
    id: "caldera-r4",
    engagementId: "caldera-aios-q1",
    phase: "days-31-60",
    title: "Stand up the compliance review companion",
    objective:
      "Pair the documented compliance checklist with an AI companion that surfaces risk patterns ahead of the human approver.",
    linkedOpportunityId: "caldera-o2",
    priority: "strategic-build",
    keyActions: [
      "Lock the prompt scaffold against the existing checklist",
      "Identify the named approver per checklist domain",
      "Run companion in shadow mode for two weeks",
    ],
    dependencies: [
      "Compliance-signed prompt scaffold",
      "Named human approver per checklist domain",
    ],
    successCriteria: [
      "Approver review time drops by ≥25%",
      "Zero AI-driven checklist auto-closures",
    ],
    risks: [
      "Drift between checklist and AI companion if the checklist updates without the prompt scaffold.",
    ],
    ownerPlaceholder: "Compliance Officer · approver",
    readinessNote:
      "Shadow mode is required before any AI output reaches the official checklist record.",
  },
  {
    id: "caldera-r5",
    engagementId: "caldera-aios-q1",
    phase: "days-61-90",
    title: "Portfolio-reporting consolidation pilot",
    objective:
      "Pilot AI-summarized quarterly portfolio reporting on a single portfolio segment.",
    linkedOpportunityId: "caldera-o3",
    priority: "strategic-build",
    keyActions: [
      "Lock per-position data ownership map",
      "Build the per-segment summarization layer",
      "Run pilot alongside existing manual cycle for one quarter",
    ],
    dependencies: ["Position-level data ownership map"],
    successCriteria: [
      "Quarterly cycle drops from two weeks to under five days for the pilot segment",
      "Partner-level review continues without delegation",
    ],
    risks: [
      "Aggregation must not flatten variance signal that partners rely on.",
    ],
    ownerPlaceholder: "Senior Analyst + JP Mendel",
  },
  {
    id: "caldera-r6",
    engagementId: "caldera-aios-q1",
    phase: "days-61-90",
    title: "Lock the risk-and-compliance adoption framework",
    objective:
      "Codify the rollout pattern across Risk + Compliance so every AI surface inherits named approvers and audit logs.",
    linkedOpportunityId: "caldera-o5",
    priority: "strategic-build",
    keyActions: [
      "Document the framework",
      "Attach to every active rollout (handoff drafting, compliance companion, reporting consolidation)",
      "Confirm quarterly compliance review cadence",
    ],
    dependencies: ["Risk + Compliance lead sponsorship"],
    successCriteria: [
      "Every AI surface has a named approver and audit log",
      "Quarterly compliance review continues post-engagement",
    ],
    risks: [
      "Without the framework, individual surfaces drift from the canon.",
    ],
    ownerPlaceholder: "Compliance Officer + Risk Lead",
    readinessNote:
      "Becomes a recurring SOW assumption. The proposal should highlight this as the operating posture for the engagement, not as a separate deliverable.",
  },
];

const ROADMAP_BY_ENGAGEMENT: Record<string, RoadmapItem[]> = {
  "quanta-aios-q1": QUANTA,
  "caldera-aios-q1": CALDERA,
};

export function getRoadmapForEngagement(engagementId: string): RoadmapItem[] {
  return ROADMAP_BY_ENGAGEMENT[engagementId] ?? [];
}

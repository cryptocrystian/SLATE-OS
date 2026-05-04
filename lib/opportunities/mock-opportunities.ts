import type { Opportunity } from "./types";

const QUANTA: Opportunity[] = [
  {
    id: "quanta-o1",
    engagementId: "quanta-aios-q1",
    title: "AI-drafted sales-to-operations handoff briefs",
    category: "Sales / Revenue Operations",
    description:
      "Generate first-draft handoff briefs at deal close, pulling sales context into the format operations expects. Reps approve, edit, or override before the brief reaches operations.",
    priority: "quick-win",
    quadrant: "quick-win",
    businessImpactScore: 82,
    complexityScore: 45,
    riskScore: 35,
    timeToValueScore: 80,
    adoptionLikelihoodScore: 70,
    strategicValueScore: 70,
    evidenceStrength: "strong",
    relatedFindingIds: ["quanta-f1", "quanta-f5"],
    sourceSummary:
      "Sales-to-ops data export shows 30% of handoffs trigger a follow-up question within 48 hours. Both Sales Director and VP Operations independently flagged context loss.",
    recommendedAction:
      "Pilot with one business unit on the existing CRM. Approve drafts for two weeks before broader rollout.",
    implementationShape:
      "Lightweight draft-then-review tool inside the CRM. No new system; uses existing handoff template as the prompt scaffold.",
    dependencies: [
      "CRM access for the named pilot business unit",
      "Two reference handoff exemplars approved by VP Operations",
    ],
    risks: [
      "If reps skip the review step, drafted context can leak into operations un-validated.",
    ],
    successSignals: [
      "Time-to-first-operations-question drops by ≥20%",
      "Reps voluntarily continue using the draft after pilot",
    ],
  },
  {
    id: "quanta-o2",
    engagementId: "quanta-aios-q1",
    title: "Cross-plant operating report consolidation",
    category: "Reporting / Analytics",
    description:
      "Compress the weekly cross-plant operating report from a manual half-week of work to an AI-summarized consolidation with explicit data ownership per plant.",
    priority: "quick-win",
    quadrant: "quick-win",
    businessImpactScore: 75,
    complexityScore: 50,
    riskScore: 30,
    timeToValueScore: 70,
    adoptionLikelihoodScore: 75,
    strategicValueScore: 60,
    evidenceStrength: "strong",
    relatedFindingIds: ["quanta-f2", "quanta-f5"],
    sourceSummary:
      "VP Operations described consolidation as 'half a person's week'. IT confirmed integration paths are clear; data ownership is per-plant but consistent.",
    recommendedAction:
      "Build a one-page summary with plant-level drill-down. Lock weekly cadence before expanding scope.",
    implementationShape:
      "Pulls the per-plant exports SLATE already sees, generates a consolidation summary with named owners.",
    dependencies: [
      "Per-plant data ownership map",
      "Decision-use of the existing weekly report (validate before automating)",
    ],
    risks: [
      "Plants may interpret the same metric differently — consolidation must surface variance, not hide it.",
    ],
    successSignals: [
      "Weekly consolidation cycle drops from 2 days to under 4 hours",
      "Plant managers continue to read the consolidated view",
    ],
  },
  {
    id: "quanta-o3",
    engagementId: "quanta-aios-q1",
    title: "Pattern-based exception triage",
    category: "Back-office Automation",
    description:
      "Pattern-detect recurring exceptions in the sales-to-ops pipeline and route them to the right resolver with explicit confidence labels.",
    priority: "strategic-build",
    quadrant: "strategic-build",
    businessImpactScore: 78,
    complexityScore: 70,
    riskScore: 50,
    timeToValueScore: 50,
    adoptionLikelihoodScore: 60,
    strategicValueScore: 75,
    evidenceStrength: "adequate",
    relatedFindingIds: ["quanta-f1"],
    sourceSummary:
      "Same handoff data export plus VP Operations description of recurring exceptions that follow patterns by plant and product line.",
    recommendedAction:
      "Phase 2 candidate. Validate the rule set with VP Operations before scoping a build.",
    implementationShape:
      "Rule-plus-pattern triage layer that drafts a routing recommendation; named approver always closes the loop.",
    dependencies: [
      "Documented exception taxonomy",
      "Approver identification per exception class",
    ],
    risks: [
      "Auto-routing without human approval would risk policy violations.",
    ],
    successSignals: [
      "Exception resolution latency drops by ≥30% in target classes",
      "Zero policy-violation incidents in pilot",
    ],
  },
  {
    id: "quanta-o4",
    engagementId: "quanta-aios-q1",
    title: "Multi-plant change-management framework",
    category: "Governance / Risk Controls",
    description:
      "Codify a structured rollout pattern across plants so each AI surface lands with named owners, success metrics, and a recurring review cadence.",
    priority: "strategic-build",
    quadrant: "strategic-build",
    businessImpactScore: 70,
    complexityScore: 75,
    riskScore: 55,
    timeToValueScore: 40,
    adoptionLikelihoodScore: 50,
    strategicValueScore: 80,
    evidenceStrength: "adequate",
    relatedFindingIds: ["quanta-f3", "quanta-f5"],
    sourceSummary:
      "COO explicitly framed multi-plant change as 'plant-by-plant'. Foundation finding on per-plant data ownership reinforces.",
    recommendedAction:
      "Becomes a SOW assumption rather than a standalone build. Bake into every Quick Win rollout.",
    implementationShape:
      "Documented change-management playbook plus a named owner per plant; recurs into every subsequent rollout.",
    dependencies: [
      "Buy-in from each plant lead",
      "Quarterly review cadence sponsorship from COO",
    ],
    risks: [
      "Without explicit ownership, each plant treats the framework differently.",
    ],
    successSignals: [
      "Each plant has a named AI owner",
      "Quarterly review cadence persists past the engagement",
    ],
  },
  {
    id: "quanta-o5",
    engagementId: "quanta-aios-q1",
    title: "Customer-comm drafting at retail scale",
    category: "Customer Support / Triage",
    description:
      "Draft customer communications across plants paired with rep approval. Brand-voice guardrails and approval workflow are explicit.",
    priority: "defer",
    quadrant: "defer-avoid",
    businessImpactScore: 55,
    complexityScore: 70,
    riskScore: 70,
    timeToValueScore: 30,
    adoptionLikelihoodScore: 35,
    strategicValueScore: 50,
    evidenceStrength: "thin",
    relatedFindingIds: ["quanta-f4", "quanta-f6"],
    sourceSummary:
      "Marketing Director flagged brand-voice as a real constraint. CS Lead's input was directional but not corroborated.",
    recommendedAction:
      "Defer for this engagement. Revisit after Quick Wins land and brand-voice guardrails are documented.",
    implementationShape:
      "Out-of-scope for the current sprint; documented for Phase 2.",
    dependencies: ["Documented brand-voice guardrails"],
    risks: ["Off-brand drafts could surface to customers without approval."],
    successSignals: [],
  },
];

const CALDERA: Opportunity[] = [
  {
    id: "caldera-o1",
    engagementId: "caldera-aios-q1",
    title: "Pipeline-handoff drafting across the deal-to-portfolio motion",
    category: "Sales / Revenue Operations",
    description:
      "Draft the three structured handoffs in the deal-to-portfolio pipeline. Each draft is reviewed by the named human approver before it advances.",
    priority: "quick-win",
    quadrant: "quick-win",
    businessImpactScore: 86,
    complexityScore: 50,
    riskScore: 40,
    timeToValueScore: 75,
    adoptionLikelihoodScore: 78,
    strategicValueScore: 80,
    evidenceStrength: "strong",
    relatedFindingIds: ["caldera-f1"],
    sourceSummary:
      "Deal-to-portfolio pipeline map plus case-management export confirm three structured handoffs with explicit owners per stage.",
    recommendedAction:
      "Anchor of the AI Workflow System tier. Ship pilot in the first 30 days.",
    implementationShape:
      "Drafting layer wrapping the three handoff stages. Each stage's approver is named in the SOW assumptions.",
    dependencies: [
      "Compliance signoff on draft-then-review pattern",
      "Three named approvers across the pipeline",
    ],
    risks: [
      "Compliance posture must stay intact; any draft entering portfolio review without approver sign-off is a policy break.",
    ],
    successSignals: [
      "All three handoffs run on drafts within 30 days",
      "Compliance team accepts the draft-then-review pattern",
    ],
  },
  {
    id: "caldera-o2",
    engagementId: "caldera-aios-q1",
    title: "Compliance review companion",
    category: "Governance / Risk Controls",
    description:
      "AI-assisted companion for the documented compliance checklist that surfaces risk patterns before the approver opens the file.",
    priority: "strategic-build",
    quadrant: "strategic-build",
    businessImpactScore: 78,
    complexityScore: 70,
    riskScore: 45,
    timeToValueScore: 55,
    adoptionLikelihoodScore: 80,
    strategicValueScore: 85,
    evidenceStrength: "strong",
    relatedFindingIds: ["caldera-f2"],
    sourceSummary:
      "Compliance Officer + compliance review checklist converge. Sec. 6 of the policy explicitly allows AI provided a named human approver remains.",
    recommendedAction:
      "Tier 2 build inside the AI Workflow System. Pair with explicit governance treatment in the SOW.",
    implementationShape:
      "AI companion runs alongside the existing checklist; never auto-closes any item; surfaces risk pattern matches with confidence labels.",
    dependencies: [
      "Compliance-signed prompt scaffold",
      "Named human approver per checklist domain",
    ],
    risks: [
      "Drift between checklist and AI companion if the checklist updates without the prompt scaffold.",
    ],
    successSignals: [
      "Approver review time drops by ≥25%",
      "Zero AI-driven checklist auto-closures",
    ],
  },
  {
    id: "caldera-o3",
    engagementId: "caldera-aios-q1",
    title: "Portfolio-reporting consolidation",
    category: "Reporting / Analytics",
    description:
      "AI-summarized quarterly portfolio reporting with explicit per-position data ownership, replacing the current two-week manual cycle.",
    priority: "strategic-build",
    quadrant: "strategic-build",
    businessImpactScore: 72,
    complexityScore: 65,
    riskScore: 40,
    timeToValueScore: 50,
    adoptionLikelihoodScore: 70,
    strategicValueScore: 70,
    evidenceStrength: "adequate",
    relatedFindingIds: ["caldera-f3"],
    sourceSummary:
      "Senior Analyst described quarterly reporting as 'the predictable two weeks of pain'. JP Mendel reinforced.",
    recommendedAction:
      "Phase 2 build. Highlights the AI Workflow System's expansion narrative for the proposal.",
    implementationShape:
      "Per-position summarization with named owner; partner-level review remains.",
    dependencies: [
      "Position-level data ownership map",
      "Reviewer identification per portfolio segment",
    ],
    risks: [
      "Aggregation must not flatten variance signal that partners rely on.",
    ],
    successSignals: [
      "Quarterly cycle drops from two weeks to under five days",
      "Partner-level review continues without delegation",
    ],
  },
  {
    id: "caldera-o4",
    engagementId: "caldera-aios-q1",
    title: "Client-update drafting for the client service motion",
    category: "Client Intake / Onboarding",
    description:
      "Draft routine client updates inside the existing client service workflow. Each update is reviewed by the named relationship lead before send.",
    priority: "quick-win",
    quadrant: "quick-win",
    businessImpactScore: 70,
    complexityScore: 45,
    riskScore: 38,
    timeToValueScore: 78,
    adoptionLikelihoodScore: 72,
    strategicValueScore: 65,
    evidenceStrength: "adequate",
    relatedFindingIds: ["caldera-f4"],
    sourceSummary:
      "Client Service Lead confirmed updates are still hand-written and would benefit from a draft-then-review pattern.",
    recommendedAction:
      "Pilot with one client cohort in the first 30 days.",
    implementationShape:
      "Drafting layer inside the client service tool; relationship lead always signs before send.",
    dependencies: [
      "Approval from the client service lead",
      "Brand-voice guardrails for client updates",
    ],
    risks: ["Off-voice updates reaching a client would damage trust quickly."],
    successSignals: [
      "Update latency drops by ≥30%",
      "Client satisfaction maintains or improves",
    ],
  },
  {
    id: "caldera-o5",
    engagementId: "caldera-aios-q1",
    title: "Risk-and-compliance adoption framework",
    category: "Governance / Risk Controls",
    description:
      "Codified rollout pattern across Risk and Compliance functions that locks named approvers, audit logs, and review cadence into every AI surface.",
    priority: "strategic-build",
    quadrant: "strategic-build",
    businessImpactScore: 65,
    complexityScore: 70,
    riskScore: 50,
    timeToValueScore: 45,
    adoptionLikelihoodScore: 65,
    strategicValueScore: 78,
    evidenceStrength: "adequate",
    relatedFindingIds: ["caldera-f5"],
    sourceSummary:
      "Risk + Compliance leads framed adoption as 'fine if AI slots into existing process'. Strong signal for a structured framework.",
    recommendedAction:
      "Becomes a SOW assumption that recurs across every Caldera AI surface.",
    implementationShape:
      "Documented framework + named approvers + audit-log requirement attached to every rollout.",
    dependencies: ["Risk and Compliance lead sponsorship"],
    risks: [
      "Without the framework, individual surfaces drift from the canon.",
    ],
    successSignals: [
      "Every AI surface has a named approver and audit log",
      "Quarterly compliance review continues post-engagement",
    ],
  },
];

const OPPORTUNITIES_BY_ENGAGEMENT: Record<string, Opportunity[]> = {
  "quanta-aios-q1": QUANTA,
  "caldera-aios-q1": CALDERA,
};

export function getOpportunitiesForEngagement(
  engagementId: string,
): Opportunity[] {
  return OPPORTUNITIES_BY_ENGAGEMENT[engagementId] ?? [];
}

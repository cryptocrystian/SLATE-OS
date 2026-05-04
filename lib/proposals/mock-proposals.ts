import type { Proposal, ProposalOption } from "./types";

const CALDERA_PROPOSAL_ID = "caldera-proposal-q1";

function option(
  o: Omit<ProposalOption, "proposalId">,
  proposalId: string,
): ProposalOption {
  return { ...o, proposalId };
}

const CALDERA: Proposal = {
  id: CALDERA_PROPOSAL_ID,
  engagementId: "caldera-aios-q1",
  title: "Caldera Capital Group · Implementation Proposal",
  status: "needs-review",
  recommendedOptionId: "caldera-po-2",
  exportStatus: "preview-only",
  nextStep:
    "Validate pricing assumptions with founder, then send the AI Workflow System tier as the recommended path with the other two options visible.",
  assumptions: [
    "Compliance posture is preserved across every AI surface; named human approver remains.",
    "Existing case-management tool exposes the integration paths IT confirmed during intake.",
    "Quarterly review cadence is sponsored by the Compliance Officer.",
  ],
  dependencies: [
    "Compliance signoff on the draft-then-review pattern before pilot",
    "Three named pipeline approvers identified",
    "Position-level data ownership map locked before Phase 2 reporting work",
  ],
  implementationCredit: {
    creditEligible: true,
    creditAmountPlaceholder: "Up to 25% of AI Opportunity Sprint fee",
    creditWindow: "Applied if implementation starts within 60 days of report finalization",
    creditNotes:
      "Credit is a commercial planning lever to reduce friction into implementation. Final terms are negotiated in the SOW; this is not an automatic discount.",
  },
  options: [
    option(
      {
        id: "caldera-po-1",
        title: "Quick-Win Build",
        type: "quick-win-build",
        recommended: false,
        bestFitScenario:
          "Best fit if Caldera wants to validate AI value on a single pipeline handoff before broader investment.",
        scopeSummary:
          "Pilot AI-drafted handoff drafting on the first of three pipeline handoffs with the named human approver. 30-day pilot, single business surface.",
        includedOpportunityIds: ["caldera-o1"],
        linkedRoadmapItemIds: ["caldera-r2"],
        timeline: "30 days from kickoff",
        deliverables: [
          "Drafting layer for the first pipeline handoff",
          "Approver onboarding and exemplar set",
          "Two-week measured pilot report",
        ],
        assumptions: [
          "Compliance signoff on the draft-then-review pattern",
          "One named pipeline approver",
        ],
        dependencies: [
          "CRM/case-management access for the first handoff",
        ],
        risks: [
          "Single-handoff scope can underestimate the cross-pipeline change-management cost.",
        ],
        pricingPlaceholder: "$30k–$60k · pricing placeholder for internal planning only",
        confidence: "high",
      },
      CALDERA_PROPOSAL_ID,
    ),
    option(
      {
        id: "caldera-po-2",
        title: "AI Workflow System",
        type: "ai-workflow-system",
        recommended: true,
        bestFitScenario:
          "Best fit for Caldera. Anchors a multi-quarter implementation across the deal-to-portfolio motion and stands up the compliance review companion in shadow.",
        scopeSummary:
          "Roll AI-drafted handoff drafting across all three pipeline handoffs and stand up the compliance review companion in shadow mode. Includes the risk-and-compliance adoption framework as a recurring SOW assumption.",
        includedOpportunityIds: [
          "caldera-o1",
          "caldera-o2",
          "caldera-o5",
        ],
        linkedRoadmapItemIds: [
          "caldera-r2",
          "caldera-r3",
          "caldera-r4",
          "caldera-r6",
        ],
        timeline: "90 days from kickoff with quarterly review cadence",
        deliverables: [
          "Drafting layer across all three pipeline handoffs",
          "Compliance review companion in shadow mode",
          "Risk-and-compliance adoption framework documented and active",
          "Quarterly review cadence sponsored",
          "Audit log + named approver per AI surface",
        ],
        assumptions: [
          "Compliance signoff on the draft-then-review pattern",
          "Three named pipeline approvers",
          "Quarterly compliance review cadence sponsored",
        ],
        dependencies: [
          "Compliance Officer + Risk Lead sponsorship",
          "Compliance-signed prompt scaffold",
        ],
        risks: [
          "Drift between checklist and AI companion if the checklist updates without the prompt scaffold.",
        ],
        pricingPlaceholder: "$120k–$180k · pricing placeholder for internal planning only",
        confidence: "high",
      },
      CALDERA_PROPOSAL_ID,
    ),
    option(
      {
        id: "caldera-po-3",
        title: "Managed AI Partner",
        type: "managed-ai-partner",
        recommended: false,
        bestFitScenario:
          "Best fit if Caldera wants Saipien Labs to remain the operating partner across Phase 2 portfolio reporting and the recurring review cadence.",
        scopeSummary:
          "All AI Workflow System scope plus Phase 2 portfolio-reporting consolidation and the operating posture of Saipien Labs as the AI partner across Caldera's first year of AI rollout.",
        includedOpportunityIds: [
          "caldera-o1",
          "caldera-o2",
          "caldera-o3",
          "caldera-o5",
        ],
        linkedRoadmapItemIds: [
          "caldera-r2",
          "caldera-r3",
          "caldera-r4",
          "caldera-r5",
          "caldera-r6",
        ],
        timeline: "12 months with quarterly review and renewal",
        deliverables: [
          "All AI Workflow System deliverables",
          "Portfolio-reporting consolidation pilot in Phase 2",
          "Quarterly Saipien Labs partner review",
          "Continuous adoption framework operation",
        ],
        assumptions: [
          "All AI Workflow System assumptions",
          "Quarterly partner review cadence is the operating posture",
        ],
        dependencies: [
          "All AI Workflow System dependencies",
          "Position-level data ownership map locked",
        ],
        risks: [
          "Without explicit partner posture, the operating relationship can drift back into one-off engagements.",
        ],
        pricingPlaceholder: "Retainer · $25k–$40k/month · pricing placeholder",
        confidence: "medium",
      },
      CALDERA_PROPOSAL_ID,
    ),
  ],
};

const PROPOSALS_BY_ENGAGEMENT: Record<string, Proposal> = {
  "caldera-aios-q1": CALDERA,
};

export function getProposalForEngagement(
  engagementId: string,
): Proposal | undefined {
  return PROPOSALS_BY_ENGAGEMENT[engagementId];
}

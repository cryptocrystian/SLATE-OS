import type { Lead } from "./types";

export const MOCK_LEADS: Lead[] = [
  {
    id: "helio-health",
    companyName: "Helio Health",
    industry: "Healthcare services",
    employeeRange: "51–200",
    revenueRange: "$10M–$50M",
    contactName: "Mira Reyes",
    contactTitle: "VP Operations",
    contactEmail: "mira@heliohealth.example",
    source: "public-scorecard",
    practiceArea: "AI Systems",
    status: "high-fit",
    createdAt: "2026-04-29T15:32:00Z",
    lastActivityAt: "12 minutes ago",
    scorecardCompletedAt: "2026-04-29T15:32:00Z",
    prospectScores: { ai: 75, friction: 88, systems: 61 },
    internalFitScore: 86,
    fitDimensions: [
      {
        id: "business-value",
        label: "Business Value Potential",
        value: 88,
        note: "Multi-stakeholder workflows with documented bottlenecks across ops and finance.",
      },
      {
        id: "budget",
        label: "Budget Likelihood",
        value: 78,
        note: "$75k–$200k investment range selected. CFO is in scope for the conversation.",
      },
      {
        id: "pain-intensity",
        label: "Pain Intensity",
        value: 92,
        note: "Reported friction severity 5/5 across reconciliation, doc review, and intake.",
      },
      {
        id: "technical-readiness",
        label: "Technical Readiness",
        value: 70,
        note: "A core stack with leaks between tools. Workable, with foundation work scoped.",
      },
      {
        id: "buyer-readiness",
        label: "Buyer Readiness",
        value: 90,
        note: "Director of Operations is the named buyer; timeline is this quarter.",
      },
      {
        id: "expansion",
        label: "Expansion Potential",
        value: 80,
        note: "Healthcare ops is recurring-revenue territory; managed AI partner is a credible second engagement.",
      },
    ],
    qualificationSignals: [
      {
        id: "friction",
        label: "Multi-system friction is real",
        detail:
          "Selected reconciliation, document review, intake, and ops handoffs as recurring friction.",
        direction: "positive",
      },
      {
        id: "systems",
        label: "Workable systems landscape",
        detail:
          "Core stack with documented data sensitivity. Implementation effort is bounded, not exploratory.",
        direction: "positive",
      },
      {
        id: "buyer",
        label: "Decision-maker engaged",
        detail:
          "VP Operations completed the scorecard themselves; timeline is this quarter.",
        direction: "positive",
      },
      {
        id: "regulated",
        label: "Client-confidential data in scope",
        detail:
          "Sprint scope must include explicit governance and human-in-the-loop review.",
        direction: "watch",
      },
    ],
    recommendedAction: {
      headline: "Invite to AI Systems Diagnostic Review",
      detail:
        "Send the Diagnostic Review application within 24 hours. Pre-fill scorecard context and propose two intro-call slots this week.",
      cta: "Send Diagnostic Review invite",
    },
    opportunityAreas: [
      {
        id: "data-reconciliation",
        title: "Cross-system data reconciliation",
        category: "AI Systems",
        summary:
          "Recurring reconciliation across patient intake, billing, and reporting tools.",
        validationNote:
          "Validate exception rate and per-system volumes during the paid sprint.",
      },
      {
        id: "doc-review",
        title: "Document review and synthesis",
        category: "AI Systems",
        summary:
          "Long-form clinical and ops documentation reviewed manually today.",
        validationNote:
          "Anchor with sample documents and a review process before scoping.",
      },
      {
        id: "intake-discovery",
        title: "Stakeholder intake and discovery",
        category: "AdvisoryOps",
        summary:
          "Structured intake would compress current discovery cycle times.",
        validationNote:
          "Pilot in the Opportunity Sprint itself.",
      },
    ],
    riskNotes: [
      "Client-confidential data should stay in well-scoped systems with documented access controls.",
      "VP-led purchases benefit from an explicit CFO read-out before sprint kickoff.",
    ],
    notes: [
      "Mira mentioned an internal AI working group that meets bi-weekly — useful entry point for change management.",
    ],
  },

  {
    id: "northwind-logistics",
    companyName: "Northwind Logistics",
    industry: "Logistics · 3PL",
    employeeRange: "201–1,000",
    revenueRange: "$50M–$250M",
    contactName: "Devon Pham",
    contactTitle: "Director of Operations",
    contactEmail: "devon@northwind.example",
    source: "public-scorecard",
    practiceArea: "AI Systems",
    status: "needs-review",
    createdAt: "2026-04-30T09:14:00Z",
    lastActivityAt: "1 hour ago",
    scorecardCompletedAt: "2026-04-30T09:14:00Z",
    prospectScores: { ai: 58, friction: 81, systems: 52 },
    internalFitScore: 71,
    fitDimensions: [
      {
        id: "business-value",
        label: "Business Value Potential",
        value: 76,
        note: "Throughput-constrained ops org with multi-system reporting load.",
      },
      {
        id: "budget",
        label: "Budget Likelihood",
        value: 60,
        note: "Investment range $25k–$75k selected. May need a Quick-Win framing first.",
      },
      {
        id: "pain-intensity",
        label: "Pain Intensity",
        value: 82,
        note: "Reported friction severity 4/5 across reporting and handoffs.",
      },
      {
        id: "technical-readiness",
        label: "Technical Readiness",
        value: 58,
        note: "Mostly a core stack but workflows leak between tools.",
      },
      {
        id: "buyer-readiness",
        label: "Buyer Readiness",
        value: 72,
        note: "Director-level contact; timeline is next quarter.",
      },
      {
        id: "expansion",
        label: "Expansion Potential",
        value: 65,
        note: "Logistics ops can scale into managed services if the first sprint lands.",
      },
    ],
    qualificationSignals: [
      {
        id: "friction",
        label: "Reporting friction is the lead surface",
        detail:
          "Manual reporting + cross-system reconciliation flagged as the most painful work.",
        direction: "positive",
      },
      {
        id: "budget",
        label: "Budget likely sub-sprint without framing",
        detail:
          "Selected $25k–$75k range. Position around a Quick-Win Build before a full sprint.",
        direction: "watch",
      },
      {
        id: "buyer",
        label: "Director-level contact, not exec",
        detail:
          "Confirm whether COO is in the loop before recommending paid sprint.",
        direction: "watch",
      },
    ],
    recommendedAction: {
      headline: "Schedule a 30-min discovery call",
      detail:
        "Confirm budget posture and whether the COO is sponsoring before recommending the AI Opportunity Sprint.",
      cta: "Book discovery call",
    },
    opportunityAreas: [
      {
        id: "manual-reporting",
        title: "Operating reports and dashboards",
        category: "AI Systems",
        summary:
          "Reporting consolidation across TMS, WMS, and finance tools is the reported pain.",
        validationNote:
          "Confirm data quality and decision-use of the reports before building.",
      },
      {
        id: "ops-handoffs",
        title: "Cross-functional handoffs",
        category: "AdvisoryOps",
        summary:
          "Sales-to-operations handoffs are losing context at scale.",
        validationNote:
          "Workflow mapping in the Opportunity Sprint surfaces the right handoff points.",
      },
      {
        id: "data-reconciliation",
        title: "Cross-system data reconciliation",
        category: "AI Systems",
        summary:
          "Repetitive reconciliation across logistics platforms.",
        validationNote:
          "Validate the actual systems and volumes in a paid Opportunity Sprint.",
      },
    ],
    riskNotes: [
      "Budget signal is below the typical AI Opportunity Sprint range. Frame around a Quick-Win Build first.",
      "Workflows are partially documented; expect a foundation-work line item in scope.",
    ],
    notes: [],
  },

  {
    id: "atlas-manufacturing",
    companyName: "Atlas Manufacturing",
    industry: "Industrial · contract manufacturing",
    employeeRange: "201–1,000",
    revenueRange: "$50M–$250M",
    contactName: "Priya Sahni",
    contactTitle: "COO",
    contactEmail: "priya@atlas.example",
    source: "referral",
    practiceArea: "AI Systems",
    status: "diagnostic-requested",
    createdAt: "2026-04-28T10:02:00Z",
    lastActivityAt: "Yesterday",
    scorecardCompletedAt: "2026-04-28T10:02:00Z",
    prospectScores: { ai: 64, friction: 79, systems: 68 },
    internalFitScore: 84,
    fitDimensions: [
      {
        id: "business-value",
        label: "Business Value Potential",
        value: 86,
        note: "QA review and compliance checks are obvious AI surfaces in this category.",
      },
      {
        id: "budget",
        label: "Budget Likelihood",
        value: 84,
        note: "$75k–$200k investment range; capex appetite confirmed in referral note.",
      },
      {
        id: "pain-intensity",
        label: "Pain Intensity",
        value: 78,
        note: "Friction severity 4/5; lots of reporting and review load.",
      },
      {
        id: "technical-readiness",
        label: "Technical Readiness",
        value: 80,
        note: "Mostly integrated stack with a system of record and clear data ownership.",
      },
      {
        id: "buyer-readiness",
        label: "Buyer Readiness",
        value: 92,
        note: "COO is the contact and the buyer. Came in via a trusted referral.",
      },
      {
        id: "expansion",
        label: "Expansion Potential",
        value: 80,
        note: "Multiple plants — sprint output can become a multi-site rollout.",
      },
    ],
    qualificationSignals: [
      {
        id: "buyer",
        label: "COO is the buyer",
        detail:
          "Contact is also the named buyer. Path to commitment is short.",
        direction: "positive",
      },
      {
        id: "referral",
        label: "Trusted referral",
        detail:
          "Came in via a prior Saipien Labs engagement. Trust signal is high.",
        direction: "positive",
      },
      {
        id: "systems",
        label: "Systems are mostly integrated",
        detail:
          "Implementation work is bounded; the team has a system of record.",
        direction: "positive",
      },
      {
        id: "compliance",
        label: "Compliance posture must be respected",
        detail:
          "Industry regulation should shape sprint scope, not block it.",
        direction: "watch",
      },
    ],
    recommendedAction: {
      headline: "Send AI Opportunity Sprint scope",
      detail:
        "Application already submitted. Send the standard sprint scope tailored to QA review + compliance checks. Aim for kickoff in the next two weeks.",
      cta: "Send sprint scope",
    },
    opportunityAreas: [
      {
        id: "qa-review",
        title: "QA and compliance review",
        category: "AI Systems",
        summary:
          "Pattern-checking with explicit rules and confidence labels lifts consistency without removing oversight.",
        validationNote:
          "Map the rule set and exception handling before any rollout.",
      },
      {
        id: "doc-review",
        title: "Document review and synthesis",
        category: "AI Systems",
        summary:
          "Long-form supplier and inspection documentation reviewed manually today.",
        validationNote:
          "Anchor with sample documents and a review process before scoping.",
      },
      {
        id: "manual-reporting",
        title: "Operating reports and dashboards",
        category: "AI Systems",
        summary:
          "Reporting cycle compression across plants.",
        validationNote:
          "Confirm data quality and decision use of the reports before building.",
      },
    ],
    riskNotes: [
      "Industry compliance requirements need explicit governance treatment in sprint scope.",
      "Multi-site rollout means change-management cost is non-trivial after the first sprint.",
    ],
    notes: [
      "Referred by Helio Health's CTO. Worth a thank-you note regardless of outcome.",
    ],
  },

  {
    id: "cumulus-retail",
    companyName: "Cumulus Retail Group",
    industry: "Retail · multi-brand",
    employeeRange: "1,000+",
    revenueRange: "$250M+",
    contactName: "Jordan Okafor",
    contactTitle: "Head of Customer Experience",
    contactEmail: "jordan@cumulusretail.example",
    source: "public-scorecard",
    practiceArea: "AI Systems",
    status: "new",
    createdAt: "2026-05-01T08:11:00Z",
    lastActivityAt: "3 hours ago",
    scorecardCompletedAt: "2026-05-01T08:11:00Z",
    prospectScores: { ai: 71, friction: 66, systems: 64 },
    internalFitScore: 74,
    fitDimensions: [
      {
        id: "business-value",
        label: "Business Value Potential",
        value: 78,
        note: "Customer-comm volume at retail scale is a strong leverage surface.",
      },
      {
        id: "budget",
        label: "Budget Likelihood",
        value: 72,
        note: "$75k–$200k investment range; CX team has annual program budget.",
      },
      {
        id: "pain-intensity",
        label: "Pain Intensity",
        value: 65,
        note: "Friction severity 3/5 — meaningful, not acute.",
      },
      {
        id: "technical-readiness",
        label: "Technical Readiness",
        value: 76,
        note: "Mostly integrated stack with clear data model.",
      },
      {
        id: "buyer-readiness",
        label: "Buyer Readiness",
        value: 70,
        note: "Head of CX is sponsor; CIO will need to weigh in on scope.",
      },
      {
        id: "expansion",
        label: "Expansion Potential",
        value: 84,
        note: "CX team is one of three orgs that could become repeat engagements.",
      },
    ],
    qualificationSignals: [
      {
        id: "scale",
        label: "Enterprise scale",
        detail:
          "1,000+ employees and clear data model. Sprint can move quickly once aligned.",
        direction: "positive",
      },
      {
        id: "stakeholders",
        label: "Multiple stakeholders likely",
        detail:
          "CIO and CX lead need to be aligned. Plan a dual-stakeholder intro call.",
        direction: "watch",
      },
    ],
    recommendedAction: {
      headline: "Triage to High Fit and confirm CIO involvement",
      detail:
        "Move to High Fit pending confirmation that CIO is sponsoring alongside the CX lead.",
      cta: "Move to High Fit",
    },
    opportunityAreas: [
      {
        id: "client-comms",
        title: "Customer communication and follow-up",
        category: "AdvisoryOps",
        summary:
          "AI drafting paired with CX-rep approval can compress response latency at retail scale.",
        validationNote:
          "Verify content sensitivity and approval workflow with stakeholders.",
      },
      {
        id: "knowledge",
        title: "Internal knowledge retrieval",
        category: "AI Systems",
        summary:
          "Curated retrieval over CX policies and brand-specific guidance.",
        validationNote:
          "Audit source quality and access controls before deployment.",
      },
      {
        id: "manual-reporting",
        title: "Operating reports and dashboards",
        category: "AI Systems",
        summary:
          "Cross-brand CX reporting consolidation.",
        validationNote:
          "Confirm data quality and decision-use of the reports before building.",
      },
    ],
    riskNotes: [
      "Customer-facing AI requires explicit approval workflow and brand-voice guardrails.",
      "Enterprise procurement adds 4–6 weeks to a typical SOW signature.",
    ],
    notes: [],
  },

  {
    id: "lattice-co",
    companyName: "Lattice & Co.",
    industry: "Professional services · accounting",
    employeeRange: "11–50",
    revenueRange: "$1M–$10M",
    contactName: "Sam Brennan",
    contactTitle: "Managing Partner",
    contactEmail: "sam@latticeandco.example",
    source: "public-scorecard",
    practiceArea: "AI Systems",
    status: "nurture",
    createdAt: "2026-04-21T13:46:00Z",
    lastActivityAt: "Last week",
    scorecardCompletedAt: "2026-04-21T13:46:00Z",
    prospectScores: { ai: 48, friction: 70, systems: 42 },
    internalFitScore: 56,
    fitDimensions: [
      {
        id: "business-value",
        label: "Business Value Potential",
        value: 62,
        note: "Document review is the obvious surface, but firm size limits sprint upside.",
      },
      {
        id: "budget",
        label: "Budget Likelihood",
        value: 40,
        note: "$25k–$75k range selected. Below typical sprint investment.",
      },
      {
        id: "pain-intensity",
        label: "Pain Intensity",
        value: 70,
        note: "Friction severity 4/5, especially around document workflows.",
      },
      {
        id: "technical-readiness",
        label: "Technical Readiness",
        value: 38,
        note: "Scattered tools with lots of manual glue. Foundation work first.",
      },
      {
        id: "buyer-readiness",
        label: "Buyer Readiness",
        value: 70,
        note: "Managing Partner is the buyer; timeline is exploratory.",
      },
      {
        id: "expansion",
        label: "Expansion Potential",
        value: 50,
        note: "Smaller firm; expansion would be incremental.",
      },
    ],
    qualificationSignals: [
      {
        id: "value",
        label: "Document review is a real surface",
        detail:
          "Firm reviews and produces long-form documents constantly.",
        direction: "positive",
      },
      {
        id: "systems",
        label: "Systems are scattered",
        detail:
          "Spreadsheets and manual glue. Foundation work would dominate a first sprint.",
        direction: "negative",
      },
      {
        id: "budget",
        label: "Budget likely below sprint range",
        detail:
          "$25k–$75k range and exploratory timeline. Quick-Win Build is the more honest path.",
        direction: "watch",
      },
    ],
    recommendedAction: {
      headline: "Move to nurture and share Quick-Win playbook",
      detail:
        "Send the Quick-Win Build playbook and check back next quarter. A full Opportunity Sprint isn't the right next step today.",
      cta: "Send nurture sequence",
    },
    opportunityAreas: [
      {
        id: "doc-review",
        title: "Document review and synthesis",
        category: "AI Systems",
        summary:
          "Document review is the most defensible AI surface in this firm.",
        validationNote:
          "A scoped Quick-Win Build is a better next step than a full sprint.",
      },
      {
        id: "knowledge",
        title: "Internal knowledge retrieval",
        category: "AI Systems",
        summary:
          "Curated retrieval over prior client work and templates.",
        validationNote:
          "Audit source quality and access controls before deployment.",
      },
      {
        id: "manual-reporting",
        title: "Operating reports and dashboards",
        category: "AI Systems",
        summary:
          "Lower priority — reporting volume is small.",
        validationNote:
          "Likely defer.",
      },
    ],
    riskNotes: [
      "Systems landscape is fragmented. Foundation work tends to pay back faster than AI in this state.",
      "Investment posture suggests Quick-Win Build, not a full Opportunity Sprint.",
    ],
    notes: [
      "Sam is technically curious — could become a strong long-term referral source.",
    ],
  },

  {
    id: "vertex-realty",
    companyName: "Vertex Realty Partners",
    industry: "Real estate brokerage",
    employeeRange: "11–50",
    revenueRange: "Under $5M",
    contactName: "Pat Whittaker",
    contactTitle: "Founder",
    contactEmail: "pat@vertexrealty.example",
    source: "public-scorecard",
    practiceArea: "AI Systems",
    status: "disqualified",
    createdAt: "2026-04-18T16:21:00Z",
    lastActivityAt: "2 weeks ago",
    scorecardCompletedAt: "2026-04-18T16:21:00Z",
    prospectScores: { ai: 30, friction: 44, systems: 28 },
    internalFitScore: 34,
    fitDimensions: [
      {
        id: "business-value",
        label: "Business Value Potential",
        value: 38,
        note: "Small team; AI surfaces are real but not at sprint scale.",
      },
      {
        id: "budget",
        label: "Budget Likelihood",
        value: 22,
        note: "Under $25k investment range. Below any current Saipien Labs offering.",
      },
      {
        id: "pain-intensity",
        label: "Pain Intensity",
        value: 50,
        note: "Mild friction; mostly individual workflows.",
      },
      {
        id: "technical-readiness",
        label: "Technical Readiness",
        value: 28,
        note: "Spreadsheets, manual glue, no documented systems landscape.",
      },
      {
        id: "buyer-readiness",
        label: "Buyer Readiness",
        value: 38,
        note: "Curiosity-stage. No timeline.",
      },
      {
        id: "expansion",
        label: "Expansion Potential",
        value: 28,
        note: "Limited path beyond a single tool.",
      },
    ],
    qualificationSignals: [
      {
        id: "exploratory",
        label: "Curiosity-stage",
        detail:
          "Selected ‘Honestly, exploring what's possible’ as the primary goal.",
        direction: "negative",
      },
      {
        id: "budget",
        label: "Below offering minimum",
        detail:
          "Under $25k investment range. Full Opportunity Sprint isn't appropriate.",
        direction: "negative",
      },
      {
        id: "scale",
        label: "Small team",
        detail:
          "11–50 employees with limited operating leverage from AI investment right now.",
        direction: "watch",
      },
    ],
    recommendedAction: {
      headline: "Disqualify — send education path",
      detail:
        "Auto-respond with the AI Workflow Scorecard explainer and the Quick-Win Build resources. Re-evaluate if they return with a budget signal.",
      cta: "Send education path",
    },
    opportunityAreas: [
      {
        id: "knowledge",
        title: "Internal knowledge retrieval",
        category: "AI Systems",
        summary:
          "Single-tool retrieval over listings and prior deals would be the most defensible bet.",
        validationNote:
          "Better as a Quick-Win Build, not a sprint.",
      },
      {
        id: "client-comms",
        title: "Client communication and follow-up",
        category: "AdvisoryOps",
        summary:
          "AI drafting could compress agent follow-up time.",
        validationNote:
          "Off-the-shelf tooling likely fits better than a custom build.",
      },
      {
        id: "doc-review",
        title: "Document review and synthesis",
        category: "AI Systems",
        summary:
          "Lower priority for a firm of this size.",
        validationNote:
          "Likely defer.",
      },
    ],
    riskNotes: [
      "Foundations aren't in place. Investing in AI before the operating systems are documented tends to be wasteful.",
    ],
    notes: [],
  },
];

export function getLeadById(id: string): Lead | undefined {
  return MOCK_LEADS.find((l) => l.id === id);
}

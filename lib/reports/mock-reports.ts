import type { Report, ReportSection } from "./types";

function section(s: Omit<ReportSection, "reportId">, reportId: string): ReportSection {
  return { ...s, reportId };
}

const QUANTA_REPORT_ID = "quanta-report-q1";
const CALDERA_REPORT_ID = "caldera-report-q1";

const QUANTA: Report = {
  id: QUANTA_REPORT_ID,
  engagementId: "quanta-aios-q1",
  title: "Quanta Operations · AI Opportunity Sprint Report",
  status: "needs-review",
  generatedAt: "2026-04-22T16:00:00Z",
  lastEditedAt: "Yesterday",
  exportStatus: "preview-only",
  recommendedNextStep:
    "Finalize Executive Summary and Opportunity Portfolio sections, then move into proposal scoping.",
  consultantNotes: [
    "Two rejected findings need a one-line write-up so the client sees how they were considered.",
    "Executive Summary should explicitly call out the multi-plant rollout caveat.",
  ],
  sections: [
    section(
      {
        id: "quanta-rs-exec",
        title: "Executive Summary",
        sectionType: "executive-summary",
        status: "drafted",
        summary:
          "Quanta is audit-ready with two strong Quick Win surfaces and two Strategic Builds. Operating posture supports a focused first sprint.",
        draftPreview:
          "Across nine stakeholder responses and eleven evidence documents, Quanta surfaces as audit-ready with clear leverage in cross-system handoffs and operating-report consolidation. Two strategic builds anchor the multi-quarter narrative: pattern-based exception triage and a multi-plant change-management framework.",
        linkedFindingIds: ["quanta-f1", "quanta-f2", "quanta-f5"],
        linkedOpportunityIds: ["quanta-o1", "quanta-o2", "quanta-o3", "quanta-o4"],
        linkedRoadmapItemIds: ["quanta-r1", "quanta-r2"],
        evidenceNotes:
          "Sales-to-ops data export and operations process map anchor the Quick Win narrative.",
        aiDrafted: true,
        confidence: "medium",
      },
      QUANTA_REPORT_ID,
    ),
    section(
      {
        id: "quanta-rs-context",
        title: "Business Context",
        sectionType: "business-context",
        status: "approved",
        summary:
          "Throughput-constrained operations org operating across multiple plants with a workable systems landscape.",
        draftPreview:
          "Quanta operates a multi-plant logistics services business with throughput as the primary operating constraint. The COO's framing of 'plant-by-plant' rollout is the dominant change-management consideration.",
        linkedFindingIds: ["quanta-f5"],
        linkedOpportunityIds: [],
        linkedRoadmapItemIds: [],
        evidenceNotes: "COO and VP Operations responses align on this framing.",
        aiDrafted: true,
        confidence: "high",
        reviewerNote: "Approved by lead consultant on first pass.",
      },
      QUANTA_REPORT_ID,
    ),
    section(
      {
        id: "quanta-rs-systems",
        title: "Current-State Systems Snapshot",
        sectionType: "systems-snapshot",
        status: "approved",
        summary:
          "Mostly integrated stack with a system of record and clear data ownership per plant.",
        draftPreview:
          "Quanta operates a mostly-integrated systems landscape with a defined system of record. Data ownership is per-plant but consistent in shape — integration paths are clear and bounded.",
        linkedFindingIds: ["quanta-f5"],
        linkedOpportunityIds: ["quanta-o3"],
        linkedRoadmapItemIds: [],
        evidenceNotes: "Director of IT confirmed integration paths.",
        aiDrafted: true,
        confidence: "high",
      },
      QUANTA_REPORT_ID,
    ),
    section(
      {
        id: "quanta-rs-readiness",
        title: "AI Readiness Assessment",
        sectionType: "readiness-assessment",
        status: "approved",
        summary:
          "AI Readiness 78 · Workflow Friction 84 · Systems Readiness 70. Audit-ready band.",
        draftPreview:
          "Quanta scores AI Readiness 78, Workflow Friction 84, and Systems Readiness 70 on the public scorecard — landing in the Audit-ready band. All three scores are corroborated by stakeholder evidence.",
        linkedFindingIds: [],
        linkedOpportunityIds: [],
        linkedRoadmapItemIds: [],
        evidenceNotes: "Public scorecard answers + intake responses align.",
        aiDrafted: true,
        confidence: "high",
      },
      QUANTA_REPORT_ID,
    ),
    section(
      {
        id: "quanta-rs-friction",
        title: "Workflow Friction Analysis",
        sectionType: "workflow-friction",
        status: "approved",
        summary:
          "Sales-to-operations handoff is the dominant friction surface; cross-plant reporting is the secondary surface.",
        draftPreview:
          "Friction concentrates in two patterns: cross-functional handoffs between sales and operations (30% of handoffs trigger a follow-up question within 48 hours) and the manual cross-plant reporting cycle that consumes half a person's week.",
        linkedFindingIds: ["quanta-f1", "quanta-f2"],
        linkedOpportunityIds: ["quanta-o1", "quanta-o2"],
        linkedRoadmapItemIds: ["quanta-r1", "quanta-r2"],
        evidenceNotes:
          "Sales-to-ops data export + VP Operations response.",
        aiDrafted: true,
        confidence: "high",
      },
      QUANTA_REPORT_ID,
    ),
    section(
      {
        id: "quanta-rs-stakeholders",
        title: "Stakeholder Discovery Synthesis",
        sectionType: "stakeholder-synthesis",
        status: "drafted",
        summary:
          "Nine stakeholders engaged across executive, operations, sales, marketing, finance, IT, frontline, QA, and customer success.",
        draftPreview:
          "Stakeholder responses converge on two themes: handoff context loss between sales and operations, and consolidation latency in cross-plant reporting. All stakeholders engaged at strong or adequate quality; multi-plant change-management framing is the recurring lens.",
        linkedFindingIds: ["quanta-f1", "quanta-f2", "quanta-f3", "quanta-f5"],
        linkedOpportunityIds: [],
        linkedRoadmapItemIds: [],
        evidenceNotes: "Nine stakeholder responses + eleven documents reviewed.",
        aiDrafted: true,
        confidence: "medium",
      },
      QUANTA_REPORT_ID,
    ),
    section(
      {
        id: "quanta-rs-portfolio",
        title: "AI Opportunity Portfolio",
        sectionType: "opportunity-portfolio",
        status: "needs-review",
        summary:
          "Two Quick Wins, two Strategic Builds, one Defer · Avoid. Portfolio anchors a focused first sprint with a multi-quarter narrative.",
        draftPreview:
          "The opportunity portfolio places two Quick Wins in the high-impact, low-complexity quadrant (handoff drafting, report consolidation), two Strategic Builds in the high-impact, high-complexity quadrant (exception triage, multi-plant change-management framework), and one Defer · Avoid (customer-comm drafting at scale).",
        linkedFindingIds: ["quanta-f1", "quanta-f2", "quanta-f3", "quanta-f5"],
        linkedOpportunityIds: [
          "quanta-o1",
          "quanta-o2",
          "quanta-o3",
          "quanta-o4",
          "quanta-o5",
        ],
        linkedRoadmapItemIds: [],
        evidenceNotes:
          "Five opportunities scored across six dimensions; matrix placement reviewed.",
        aiDrafted: true,
        confidence: "medium",
      },
      QUANTA_REPORT_ID,
    ),
    section(
      {
        id: "quanta-rs-priority",
        title: "Priority Recommendations",
        sectionType: "priority-recommendations",
        status: "needs-review",
        summary:
          "Pilot AI-drafted handoff briefs in one BU; establish report consolidation baseline; scope exception triage MVP.",
        draftPreview:
          "Priority one: pilot AI-drafted handoff briefs in a single business unit with a draft-then-review pattern. Priority two: establish a one-page weekly cross-plant operating consolidation summary with named owners. Priority three: scope the pattern-plus-rule exception triage MVP for the 30-60 window.",
        linkedFindingIds: ["quanta-f1", "quanta-f2"],
        linkedOpportunityIds: ["quanta-o1", "quanta-o2", "quanta-o3"],
        linkedRoadmapItemIds: ["quanta-r1", "quanta-r2", "quanta-r4"],
        evidenceNotes:
          "Convergent evidence across responses, documents, and prior pilot data.",
        aiDrafted: true,
        confidence: "medium",
      },
      QUANTA_REPORT_ID,
    ),
    section(
      {
        id: "quanta-rs-governance",
        title: "Risk and Governance Notes",
        sectionType: "governance-risk",
        status: "drafted",
        summary:
          "Multi-plant rollout requires named owners; rejected findings should be acknowledged in the client write-up.",
        draftPreview:
          "Risk register concentrates in two areas: the multi-plant rollout pattern requires named owners and a recurring review cadence; the customer-comm drafting deferral requires brand-voice guardrails before any future activation.",
        linkedFindingIds: ["quanta-f3"],
        linkedOpportunityIds: ["quanta-o4"],
        linkedRoadmapItemIds: ["quanta-r5"],
        evidenceNotes: "COO + Operations Supervisor responses align.",
        aiDrafted: true,
        confidence: "medium",
      },
      QUANTA_REPORT_ID,
    ),
    section(
      {
        id: "quanta-rs-roadmap",
        title: "30/60/90-Day Roadmap",
        sectionType: "roadmap",
        status: "drafted",
        summary:
          "First 30: pilot handoff briefs + report consolidation baseline. Days 31–60: scale handoff + exception triage MVP. Days 61–90: lock multi-plant change-management framework.",
        draftPreview:
          "First 30 days targets two Quick Wins. Days 31–60 promote the validated handoff pilot and stand up the exception-triage MVP. Days 61–90 lock the multi-plant change-management framework as a recurring SOW assumption.",
        linkedFindingIds: [],
        linkedOpportunityIds: ["quanta-o1", "quanta-o2", "quanta-o3", "quanta-o4"],
        linkedRoadmapItemIds: [
          "quanta-r1",
          "quanta-r2",
          "quanta-r3",
          "quanta-r4",
          "quanta-r5",
        ],
        evidenceNotes: "Roadmap items map 1:1 to scored opportunities.",
        aiDrafted: true,
        confidence: "high",
      },
      QUANTA_REPORT_ID,
    ),
    section(
      {
        id: "quanta-rs-next",
        title: "Recommended Next Step",
        sectionType: "recommended-next-step",
        status: "not-started",
        summary:
          "Engage on the AI Workflow System tier with the multi-plant change-management framework as a recurring SOW assumption.",
        draftPreview: "",
        linkedFindingIds: [],
        linkedOpportunityIds: ["quanta-o1", "quanta-o2"],
        linkedRoadmapItemIds: [],
        evidenceNotes: "Drafts after Executive Summary and Portfolio are approved.",
        aiDrafted: false,
        confidence: "needs-evidence",
      },
      QUANTA_REPORT_ID,
    ),
    section(
      {
        id: "quanta-rs-appendix",
        title: "Appendix",
        sectionType: "appendix",
        status: "not-started",
        summary:
          "Stakeholder roster, evidence index, scoring rubric, change-management framework template.",
        draftPreview: "",
        linkedFindingIds: [],
        linkedOpportunityIds: [],
        linkedRoadmapItemIds: [],
        evidenceNotes: "Auto-generates when report is finalized.",
        aiDrafted: false,
        confidence: "needs-evidence",
      },
      QUANTA_REPORT_ID,
    ),
  ],
};

const CALDERA: Report = {
  id: CALDERA_REPORT_ID,
  engagementId: "caldera-aios-q1",
  title: "Caldera Capital Group · AI Opportunity Sprint Report",
  status: "final",
  generatedAt: "2026-04-12T11:00:00Z",
  lastEditedAt: "2 days ago",
  exportStatus: "ready-for-export-placeholder",
  recommendedNextStep:
    "Engage Saipien Labs as an AI partner. Begin with the AI Workflow System tier; the Managed AI Partner tier is the credible second engagement.",
  consultantNotes: [
    "Compliance footprint must remain visible in the SOW assumptions section.",
    "Client preference for the AI Workflow System tier was expressed during last consultant call.",
  ],
  sections: [
    section(
      {
        id: "caldera-rs-exec",
        title: "Executive Summary",
        sectionType: "executive-summary",
        status: "final",
        summary:
          "Caldera is a strategic AI systems candidate. Three handoffs in the deal-to-portfolio pipeline anchor the AI Workflow System tier.",
        draftPreview:
          "Across eight stakeholders and ten reviewed documents, Caldera surfaces as a strategic AI systems candidate. Three structured pipeline handoffs and a documented compliance posture make the AI Workflow System tier the recommended path; portfolio reporting and client-service drafting are credible Phase 2 surfaces.",
        linkedFindingIds: ["caldera-f1", "caldera-f2"],
        linkedOpportunityIds: ["caldera-o1", "caldera-o2"],
        linkedRoadmapItemIds: ["caldera-r2"],
        evidenceNotes: "Pipeline map + compliance checklist anchor the read.",
        aiDrafted: true,
        confidence: "high",
      },
      CALDERA_REPORT_ID,
    ),
    section(
      {
        id: "caldera-rs-context",
        title: "Business Context",
        sectionType: "business-context",
        status: "final",
        summary:
          "Investment management firm operating a deal-to-portfolio motion with documented compliance posture.",
        draftPreview:
          "Caldera operates an investment management business with a structured deal-to-portfolio pipeline and a documented compliance review process. Strategic intent is to free partner-level time without compromising the compliance posture.",
        linkedFindingIds: ["caldera-f1"],
        linkedOpportunityIds: [],
        linkedRoadmapItemIds: [],
        evidenceNotes: "Managing Director + Head of Operations responses align.",
        aiDrafted: true,
        confidence: "high",
      },
      CALDERA_REPORT_ID,
    ),
    section(
      {
        id: "caldera-rs-systems",
        title: "Current-State Systems Snapshot",
        sectionType: "systems-snapshot",
        status: "final",
        summary:
          "Microsoft 365 + custom case-management tool with documented access controls.",
        draftPreview:
          "Caldera operates on Microsoft 365 plus a custom case-management tool with documented access controls. Integration paths are clean; data dictionary is partial but the model is internalized.",
        linkedFindingIds: [],
        linkedOpportunityIds: [],
        linkedRoadmapItemIds: [],
        evidenceNotes: "Director of IT confirmed.",
        aiDrafted: true,
        confidence: "high",
      },
      CALDERA_REPORT_ID,
    ),
    section(
      {
        id: "caldera-rs-readiness",
        title: "AI Readiness Assessment",
        sectionType: "readiness-assessment",
        status: "final",
        summary:
          "AI Readiness 82 · Workflow Friction 79 · Systems Readiness 76. Strategic candidate band.",
        draftPreview:
          "Caldera scores AI Readiness 82, Workflow Friction 79, and Systems Readiness 76 — landing in the Strategic candidate band. Confidence on the AI Readiness score is reinforced by existing AI working group activity.",
        linkedFindingIds: [],
        linkedOpportunityIds: [],
        linkedRoadmapItemIds: [],
        evidenceNotes: "Public scorecard + intake responses converge.",
        aiDrafted: true,
        confidence: "high",
      },
      CALDERA_REPORT_ID,
    ),
    section(
      {
        id: "caldera-rs-friction",
        title: "Workflow Friction Analysis",
        sectionType: "workflow-friction",
        status: "final",
        summary:
          "Three structured pipeline handoffs are the dominant friction surface; portfolio reporting is secondary.",
        draftPreview:
          "Friction concentrates in three structured pipeline handoffs across the deal-to-portfolio motion. Each handoff drops something the next step has to ask for. The quarterly portfolio reporting cycle is the secondary friction surface.",
        linkedFindingIds: ["caldera-f1", "caldera-f3"],
        linkedOpportunityIds: ["caldera-o1", "caldera-o3"],
        linkedRoadmapItemIds: ["caldera-r2", "caldera-r5"],
        evidenceNotes: "Pipeline map + Senior Analyst response anchor this.",
        aiDrafted: true,
        confidence: "high",
      },
      CALDERA_REPORT_ID,
    ),
    section(
      {
        id: "caldera-rs-stakeholders",
        title: "Stakeholder Discovery Synthesis",
        sectionType: "stakeholder-synthesis",
        status: "final",
        summary:
          "Eight stakeholders across executive, operations, compliance, risk, IT, finance, frontline, and customer success.",
        draftPreview:
          "Stakeholder responses converge on a clear pattern: AI is welcome where it slots into existing process and a named human approver remains. The Compliance and Risk leads framed adoption as 'fine if AI slots into the existing process,' which is the operating posture for the engagement.",
        linkedFindingIds: ["caldera-f2", "caldera-f5"],
        linkedOpportunityIds: ["caldera-o2", "caldera-o5"],
        linkedRoadmapItemIds: [],
        evidenceNotes:
          "Eight stakeholder responses + ten documents reviewed.",
        aiDrafted: true,
        confidence: "high",
      },
      CALDERA_REPORT_ID,
    ),
    section(
      {
        id: "caldera-rs-portfolio",
        title: "AI Opportunity Portfolio",
        sectionType: "opportunity-portfolio",
        status: "final",
        summary:
          "Five opportunities — two Quick Wins, three Strategic Builds. Pipeline-handoff drafting anchors the AI Workflow System tier.",
        draftPreview:
          "The portfolio places two Quick Wins (pipeline-handoff drafting, client-update drafting) and three Strategic Builds (compliance review companion, portfolio-reporting consolidation, risk-and-compliance adoption framework). Pipeline-handoff drafting is the anchor.",
        linkedFindingIds: ["caldera-f1", "caldera-f2", "caldera-f3", "caldera-f4"],
        linkedOpportunityIds: [
          "caldera-o1",
          "caldera-o2",
          "caldera-o3",
          "caldera-o4",
          "caldera-o5",
        ],
        linkedRoadmapItemIds: [],
        evidenceNotes:
          "Five opportunities scored, all with strong or adequate evidence.",
        aiDrafted: true,
        confidence: "high",
      },
      CALDERA_REPORT_ID,
    ),
    section(
      {
        id: "caldera-rs-priority",
        title: "Priority Recommendations",
        sectionType: "priority-recommendations",
        status: "final",
        summary:
          "Pilot pipeline-handoff drafting in the first 30 days; companion compliance review in 31–60; portfolio reporting pilot in 61–90.",
        draftPreview:
          "Priority one: pilot pipeline-handoff drafting on the first of three handoffs with the named human approver. Priority two: stand up the compliance review companion in shadow mode. Priority three: pilot portfolio-reporting consolidation on a single segment.",
        linkedFindingIds: ["caldera-f1", "caldera-f2", "caldera-f3"],
        linkedOpportunityIds: [
          "caldera-o1",
          "caldera-o2",
          "caldera-o3",
        ],
        linkedRoadmapItemIds: [
          "caldera-r2",
          "caldera-r3",
          "caldera-r4",
          "caldera-r5",
        ],
        evidenceNotes: "Convergent evidence across documents and responses.",
        aiDrafted: true,
        confidence: "high",
      },
      CALDERA_REPORT_ID,
    ),
    section(
      {
        id: "caldera-rs-governance",
        title: "Risk and Governance Notes",
        sectionType: "governance-risk",
        status: "final",
        summary:
          "Compliance posture must remain intact; named human approver per AI surface; quarterly compliance review cadence.",
        draftPreview:
          "The single hard constraint: compliance posture must remain intact. Each AI surface requires a named human approver and an audit log. The risk-and-compliance adoption framework codifies this posture as a recurring SOW assumption.",
        linkedFindingIds: ["caldera-f2", "caldera-f5"],
        linkedOpportunityIds: ["caldera-o2", "caldera-o5"],
        linkedRoadmapItemIds: ["caldera-r4", "caldera-r6"],
        evidenceNotes: "Compliance checklist Sec. 6 explicitly allows AI under named approver.",
        aiDrafted: true,
        confidence: "high",
      },
      CALDERA_REPORT_ID,
    ),
    section(
      {
        id: "caldera-rs-roadmap",
        title: "30/60/90-Day Roadmap",
        sectionType: "roadmap",
        status: "final",
        summary:
          "First 30: kickoff + pipeline-handoff pilot. Days 31–60: extend handoffs + compliance companion shadow. Days 61–90: portfolio reporting pilot + adoption framework lock.",
        draftPreview:
          "Six roadmap items spanning the three phases. The first 30 days run kickoff and the pipeline-handoff pilot; days 31–60 extend handoff drafting and stand up the compliance companion in shadow; days 61–90 pilot portfolio-reporting consolidation and lock the risk-and-compliance adoption framework.",
        linkedFindingIds: [],
        linkedOpportunityIds: [
          "caldera-o1",
          "caldera-o2",
          "caldera-o3",
          "caldera-o5",
        ],
        linkedRoadmapItemIds: [
          "caldera-r1",
          "caldera-r2",
          "caldera-r3",
          "caldera-r4",
          "caldera-r5",
          "caldera-r6",
        ],
        evidenceNotes: "Roadmap maps 1:1 to scored opportunities.",
        aiDrafted: true,
        confidence: "high",
      },
      CALDERA_REPORT_ID,
    ),
    section(
      {
        id: "caldera-rs-next",
        title: "Recommended Next Step",
        sectionType: "recommended-next-step",
        status: "final",
        summary:
          "Engage Saipien Labs as an AI partner. Begin with the AI Workflow System tier; Managed AI Partner is the credible second engagement.",
        draftPreview:
          "Saipien Labs recommends engaging on the AI Workflow System tier as the first commercial step. The Managed AI Partner tier is the credible second engagement after pipeline-handoff drafting and the compliance companion are operating in production.",
        linkedFindingIds: [],
        linkedOpportunityIds: [
          "caldera-o1",
          "caldera-o2",
          "caldera-o3",
          "caldera-o5",
        ],
        linkedRoadmapItemIds: [],
        evidenceNotes: "Anchored in approved findings and consultant judgment.",
        aiDrafted: false,
        confidence: "high",
      },
      CALDERA_REPORT_ID,
    ),
    section(
      {
        id: "caldera-rs-appendix",
        title: "Appendix",
        sectionType: "appendix",
        status: "final",
        summary:
          "Stakeholder roster, evidence index, scoring rubric, compliance footprint, change-management framework.",
        draftPreview:
          "Includes stakeholder roster (8), evidence index (10 documents + 8 responses), scoring rubric, compliance footprint summary, and the risk-and-compliance adoption framework template.",
        linkedFindingIds: [],
        linkedOpportunityIds: [],
        linkedRoadmapItemIds: [],
        evidenceNotes: "Auto-generated and reviewed.",
        aiDrafted: false,
        confidence: "high",
      },
      CALDERA_REPORT_ID,
    ),
  ],
};

const REPORTS_BY_ENGAGEMENT: Record<string, Report> = {
  "quanta-aios-q1": QUANTA,
  "caldera-aios-q1": CALDERA,
};

export function getReportForEngagement(engagementId: string): Report | undefined {
  return REPORTS_BY_ENGAGEMENT[engagementId];
}

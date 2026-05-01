import type { Finding } from "./types";

const HELIO: Finding[] = [
  {
    id: "helio-f1",
    engagementId: "helio-aios-q2",
    category: "Workflow Friction",
    statement:
      "Three-system reconciliation across patient intake, billing, and reporting is the dominant operational pain.",
    summary:
      "VP Operations and CTO independently flagged a recurring weekly reconciliation pass that requires manual exception handling. Volume is high enough that AI-assisted matching with an explicit confidence label would compress cycle time while preserving oversight.",
    evidenceSummary:
      "Patient intake reconciliation export shows ~7% exception rate. Mira's response and Daniel's response converge on the same workflow.",
    confidence: "medium",
    reviewStatus: "needs-review",
    suggestedImpact:
      "Quick-Win Build candidate. Likely first sprint surface even without further intake.",
    sourceRefs: [
      {
        id: "ref-helio-mira-1",
        type: "stakeholder-response",
        source: "Mira Reyes",
        role: "VP Operations",
        excerpt:
          "Reconciliation runs weekly. Each exception still gets resolved manually because the systems disagree on the patient ID format.",
        strength: "strong",
      },
      {
        id: "ref-helio-daniel-1",
        type: "stakeholder-response",
        source: "Daniel Patel",
        role: "Chief Technology Officer",
        excerpt:
          "Salesforce, Athena, and the homegrown ops tool don't agree on patient identity. That's the leak.",
        strength: "strong",
      },
      {
        id: "ref-helio-doc-recon-1",
        type: "uploaded-document",
        source: "Patient intake reconciliation export (Q1)",
        excerpt: "Exception rate ~7% on 14,200 records over the quarter.",
        strength: "strong",
      },
    ],
    assumptionFlag:
      "Assumes the reconciliation rule set is already documented somewhere — needs confirmation in the synthesis stage.",
  },
  {
    id: "helio-f2",
    engagementId: "helio-aios-q2",
    category: "Back-office Efficiency",
    statement:
      "Document review and synthesis is the second strongest AI surface, especially around clinical compliance.",
    summary:
      "QA Lead and Customer Success Lead both pointed at long-form documentation review as a repeatable, high-volume task. Pattern-checking with explicit rules would lift consistency without removing oversight.",
    evidenceSummary:
      "Monthly compliance checklist + customer feedback review pattern align on document workflows.",
    confidence: "medium",
    reviewStatus: "draft",
    suggestedImpact:
      "Strategic Build candidate. Pair with the reconciliation surface for a balanced first sprint.",
    sourceRefs: [
      {
        id: "ref-helio-karim-1",
        type: "stakeholder-response",
        source: "Karim Hassan",
        role: "QA Lead",
        excerpt:
          "The monthly compliance review is 30 items × 6 hours of focused reading. It's repeatable.",
        strength: "adequate",
      },
      {
        id: "ref-helio-sora-1",
        type: "stakeholder-response",
        source: "Sora Tanaka",
        role: "Customer Success Lead",
        excerpt:
          "Patient feedback review is high-volume. It's the most obvious AI candidate in our org.",
        strength: "strong",
      },
    ],
  },
  {
    id: "helio-f3",
    engagementId: "helio-aios-q2",
    category: "Adoption Risk",
    statement:
      "Frontline supervisor coverage is incomplete — recommendations risk being theoretical.",
    summary:
      "Pat Briggs stalled at section 2 of intake. Without frontline coverage, day-of work patterns are missing from the synthesis.",
    evidenceSummary:
      "Stakeholder progress report. No frontline shift notes received.",
    confidence: "needs-evidence",
    reviewStatus: "needs-review",
    suggestedImpact: "Block sprint kickoff until frontline read is closed.",
    sourceRefs: [
      {
        id: "ref-helio-coverage",
        type: "consultant-note",
        source: "M. Reyes (Saipien Labs)",
        excerpt:
          "Pat Briggs stalled mid-intake. A 10-minute call would likely close the loop.",
        strength: "thin",
      },
    ],
    assumptionFlag:
      "This is a process-quality finding rather than an opportunity — flagged for human approval before it appears in the report.",
  },
  {
    id: "helio-f4",
    engagementId: "helio-aios-q2",
    category: "Governance / Risk",
    statement:
      "Client-confidential data must shape sprint scope; explicit governance treatment required.",
    summary:
      "Helio's data governance policy is documented and enforced. Any AI rollout must respect identity and access controls and require human review at decision points.",
    evidenceSummary:
      "CTO response + governance policy doc converge on the same posture.",
    confidence: "high",
    reviewStatus: "needs-review",
    suggestedImpact:
      "Will become a recurring SOW assumption rather than a standalone opportunity.",
    sourceRefs: [
      {
        id: "ref-helio-daniel-2",
        type: "stakeholder-response",
        source: "Daniel Patel",
        role: "Chief Technology Officer",
        excerpt:
          "Identity and access controls are in place. AI use cases need explicit oversight at decision points.",
        strength: "strong",
      },
      {
        id: "ref-helio-doc-policy-1",
        type: "uploaded-document",
        source: "Data governance & access policy",
        excerpt:
          "Sec. 4: 'Automated systems acting on client data require named human approver.'",
        strength: "strong",
      },
    ],
  },
];

const MERIDIAN: Finding[] = [
  {
    id: "meridian-f1",
    engagementId: "meridian-aios-q2",
    category: "Back-office Efficiency",
    statement:
      "Long-form research synthesis is the single biggest time sink across associates.",
    summary:
      "Senior Associate response + sample research outputs both point at multi-document synthesis as the dominant work pattern. AI-drafted synthesis with associate review is the strongest first-sprint surface.",
    evidenceSummary:
      "Sample research outputs + associate response converge.",
    confidence: "high",
    reviewStatus: "needs-review",
    suggestedImpact:
      "Quick-Win Build candidate. Frees partner-level time, which is the strategic intent.",
    sourceRefs: [
      {
        id: "ref-meridian-sami-1",
        type: "stakeholder-response",
        source: "Sami Okonkwo",
        role: "Senior Associate",
        excerpt:
          "Most weeks I spend two days reading and one day writing. Synthesis is the bottleneck, not analysis.",
        strength: "strong",
      },
      {
        id: "ref-meridian-doc-research",
        type: "uploaded-document",
        source: "Sample research outputs (anonymized)",
        excerpt:
          "All three samples reference 8–14 source documents in their footnotes.",
        strength: "strong",
      },
    ],
  },
  {
    id: "meridian-f2",
    engagementId: "meridian-aios-q2",
    category: "Workflow Friction",
    statement:
      "Practice-to-operations handoff is repeatable and currently un-instrumented.",
    summary:
      "COO and Practice Lead both confirmed a structured handoff exists on paper, but its actual quality varies by engagement. AI-drafted handoff briefs would reduce dropped context.",
    evidenceSummary:
      "Two convergent responses + the practice delivery handoff playbook.",
    confidence: "high",
    reviewStatus: "needs-review",
    suggestedImpact: "Strategic Build candidate.",
    sourceRefs: [
      {
        id: "ref-meridian-mark-1",
        type: "stakeholder-response",
        source: "Mark Ollier",
        role: "COO",
        excerpt:
          "We have a handoff template, but each practice fills it in differently. Operations sees the difference.",
        strength: "strong",
      },
      {
        id: "ref-meridian-isla-1",
        type: "stakeholder-response",
        source: "Isla Henrik",
        role: "Practice Lead · Strategy",
        excerpt:
          "I'd love a draft of the handoff that I just edit. The blank page is the problem.",
        strength: "strong",
      },
    ],
  },
  {
    id: "meridian-f3",
    engagementId: "meridian-aios-q2",
    category: "Customer Experience",
    statement:
      "Marketing-to-sales handoff loses cross-practice context.",
    summary:
      "Marketing Lead noted that marketing-qualified leads lose the cross-practice context that would help sales position the right offering.",
    evidenceSummary: "Single-source response. Needs corroboration.",
    confidence: "low",
    reviewStatus: "needs-review",
    suggestedImpact:
      "Likely defer to Phase 2; flagged for additional evidence in synthesis.",
    sourceRefs: [
      {
        id: "ref-meridian-julia-1",
        type: "stakeholder-response",
        source: "Julia Crane",
        role: "Marketing Lead",
        excerpt:
          "By the time a lead reaches sales, they only see the surface offering, not the cross-practice fit.",
        strength: "thin",
      },
    ],
    assumptionFlag:
      "Single-source. Needs additional evidence from a sales-side stakeholder before approval.",
  },
  {
    id: "meridian-f4",
    engagementId: "meridian-aios-q2",
    category: "Systems Gap",
    statement:
      "Custom case-management tool is the integration anchor for any AI rollout.",
    summary:
      "IT Lead confirmed Microsoft 365 + a custom case-management tool. The custom tool has clean APIs but no documented data dictionary.",
    evidenceSummary:
      "Case-management workflow export + IT response.",
    confidence: "medium",
    reviewStatus: "draft",
    suggestedImpact:
      "Foundation work; likely a small line item in the proposal.",
    sourceRefs: [
      {
        id: "ref-meridian-ravi-1",
        type: "stakeholder-response",
        source: "Ravi Subramaniam",
        role: "IT Lead",
        excerpt:
          "APIs are clean. We don't have a data dictionary, but we know the model.",
        strength: "adequate",
      },
      {
        id: "ref-meridian-doc-cases",
        type: "uploaded-document",
        source: "Case-management workflow export",
        excerpt: "Two quarters of activity, 11 distinct status values.",
        strength: "strong",
      },
    ],
  },
  {
    id: "meridian-f5",
    engagementId: "meridian-aios-q2",
    category: "Revenue Opportunity",
    statement:
      "AI-assisted research could open a productized advisory tier.",
    summary:
      "Managing Partner explicitly framed an AI-assisted research capability as a possible new offering — pricing leverage rather than cost savings.",
    evidenceSummary: "Single source — Managing Partner response.",
    confidence: "low",
    reviewStatus: "needs-review",
    suggestedImpact:
      "Strategic Build candidate. Belongs in the second-engagement conversation, not the first sprint.",
    sourceRefs: [
      {
        id: "ref-meridian-tessa-1",
        type: "stakeholder-response",
        source: "Tessa Brandt",
        role: "Managing Partner",
        excerpt:
          "If we could productize the synthesis layer, we'd open a different tier of client.",
        strength: "adequate",
      },
    ],
    assumptionFlag:
      "Strategic framing rather than operational finding. Approval depends on whether it belongs in this sprint or the next conversation.",
  },
  {
    id: "meridian-f6",
    engagementId: "meridian-aios-q2",
    category: "Adoption Risk",
    statement:
      "Practice-level adoption variance is the dominant change-management risk.",
    summary:
      "Three practice lines, three different adoption rhythms. Strategy practice is curious; the other two are skeptical.",
    evidenceSummary: "Practice Lead + COO responses align on this pattern.",
    confidence: "medium",
    reviewStatus: "needs-review",
    suggestedImpact:
      "Will appear in the report as a Risk/Governance line item, not a standalone opportunity.",
    sourceRefs: [
      {
        id: "ref-meridian-isla-2",
        type: "stakeholder-response",
        source: "Isla Henrik",
        role: "Practice Lead · Strategy",
        excerpt:
          "Strategy will pilot anything. The other practices need to see results before they touch a new tool.",
        strength: "strong",
      },
    ],
  },
];

const ATLAS: Finding[] = [];

const QUANTA: Finding[] = [
  {
    id: "quanta-f1",
    engagementId: "quanta-aios-q1",
    category: "Workflow Friction",
    statement:
      "Sales-to-operations handoff is the highest-leverage automation surface.",
    summary:
      "Two quarters of handoff data show consistent context loss between sales close and operations kickoff. AI-drafted handoff briefs reduce dropped context without removing reps' judgment.",
    evidenceSummary:
      "Sales-to-operations data export + sales/ops responses converge.",
    confidence: "high",
    reviewStatus: "approved",
    suggestedImpact:
      "Quick Win. Featured in the AI Workflow System tier of the proposal.",
    sourceRefs: [
      {
        id: "ref-quanta-ben-1",
        type: "stakeholder-response",
        source: "Ben Asare",
        role: "Sales Director",
        excerpt:
          "Half the handoff issues are because the rep didn't write down the context that lives in their head.",
        strength: "strong",
      },
      {
        id: "ref-quanta-elena-1",
        type: "stakeholder-response",
        source: "Elena Vargas",
        role: "VP Operations",
        excerpt:
          "By the time we see a deal, we're missing two or three decisions the customer already made.",
        strength: "strong",
      },
      {
        id: "ref-quanta-doc-handoff",
        type: "uploaded-document",
        source: "Sales-to-operations handoff data export",
        excerpt: "30% of handoffs trigger a follow-up question within 48 hours.",
        strength: "strong",
      },
    ],
    reviewerNote:
      "Approved as the lead Quick Win. Featured in the AI Workflow System tier of the proposal.",
  },
  {
    id: "quanta-f2",
    engagementId: "quanta-aios-q1",
    category: "Back-office Efficiency",
    statement:
      "Operating-report consolidation across plants compresses reporting cycle time.",
    summary:
      "Cross-plant reporting currently runs as a manual consolidation. AI summarization with explicit data ownership reduces cycle time without losing the per-plant nuance.",
    evidenceSummary: "Operations process map + VP Ops response.",
    confidence: "high",
    reviewStatus: "approved",
    suggestedImpact: "Quick Win.",
    sourceRefs: [
      {
        id: "ref-quanta-elena-2",
        type: "stakeholder-response",
        source: "Elena Vargas",
        role: "VP Operations",
        excerpt:
          "Each plant produces its own report. Consolidation is half a person's week.",
        strength: "strong",
      },
    ],
  },
  {
    id: "quanta-f3",
    engagementId: "quanta-aios-q1",
    category: "Adoption Risk",
    statement: "Multi-plant change management is non-trivial after the first sprint.",
    summary:
      "If the AI Workflow System tier is selected, rollout across plants will require a structured change-management plan.",
    evidenceSummary: "COO + Operations Supervisor responses align.",
    confidence: "medium",
    reviewStatus: "approved",
    suggestedImpact: "Becomes a SOW assumption rather than a standalone opportunity.",
    sourceRefs: [
      {
        id: "ref-quanta-noah-1",
        type: "stakeholder-response",
        source: "Noah Sterling",
        role: "Chief Operating Officer",
        excerpt:
          "Each plant runs a little differently. Rollout is going to be plant-by-plant.",
        strength: "strong",
      },
    ],
  },
  {
    id: "quanta-f4",
    engagementId: "quanta-aios-q1",
    category: "Customer Experience",
    statement:
      "Customer-success reporting is a credible second-engagement surface.",
    summary:
      "Yuki noted that consistent client reporting drives renewals. Out of scope for the first sprint but flagged for the proposal's expansion language.",
    evidenceSummary: "Single source — CS Lead response.",
    confidence: "medium",
    reviewStatus: "rejected",
    suggestedImpact: "Defer to Phase 2.",
    sourceRefs: [
      {
        id: "ref-quanta-yuki-1",
        type: "stakeholder-response",
        source: "Yuki Nakamura",
        role: "Customer Success Lead",
        excerpt:
          "Renewals depend on consistent reporting back to clients. We've never automated it.",
        strength: "adequate",
      },
    ],
    reviewerNote:
      "Real, but out of scope for this sprint. Surfaced in the proposal's expansion language.",
  },
  {
    id: "quanta-f5",
    engagementId: "quanta-aios-q1",
    category: "Data Readiness",
    statement: "Per-plant data ownership is clear; integration work is bounded.",
    summary:
      "IT confirmed integration paths for both reporting and reconciliation surfaces. Data ownership is per-plant but consistent.",
    evidenceSummary: "IT response + operations process map.",
    confidence: "high",
    reviewStatus: "approved",
    suggestedImpact: "Foundation finding; underlies the Workflow System tier.",
    sourceRefs: [
      {
        id: "ref-quanta-aanya-1",
        type: "stakeholder-response",
        source: "Aanya Krishnan",
        role: "Director of IT",
        excerpt: "Integration paths are clear. The data model varies by plant but the pattern is consistent.",
        strength: "strong",
      },
    ],
  },
  {
    id: "quanta-f6",
    engagementId: "quanta-aios-q1",
    category: "Revenue Opportunity",
    statement: "Customer-comm drafting at retail scale lifts CX response latency.",
    summary:
      "Customer-comm volume across plants creates a credible AI-drafting surface paired with rep approval.",
    evidenceSummary: "Convergent responses from sales + customer success.",
    confidence: "medium",
    reviewStatus: "rejected",
    suggestedImpact: "Defer.",
    sourceRefs: [
      {
        id: "ref-quanta-marian-1",
        type: "stakeholder-response",
        source: "Marian Holloway",
        role: "Marketing Director",
        excerpt: "Customer-comm volume is the trickier surface. Brand voice is a real constraint.",
        strength: "adequate",
      },
    ],
    reviewerNote:
      "Brand-voice constraint makes this a poor first-sprint surface. Defer to a later conversation.",
  },
];

const CALDERA: Finding[] = [
  {
    id: "caldera-f1",
    engagementId: "caldera-aios-q1",
    category: "Workflow Friction",
    statement:
      "Deal-to-portfolio pipeline has three structured handoffs, all currently manual.",
    summary:
      "JP Mendel's pipeline map plus the case-management export show three structured handoffs that are currently manual. Each is a credible AI surface paired with explicit human approval.",
    evidenceSummary: "Pipeline map + case-management export converge.",
    confidence: "high",
    reviewStatus: "report-ready",
    suggestedImpact:
      "Anchor of the AI Workflow System tier in the proposal.",
    sourceRefs: [
      {
        id: "ref-caldera-jp-1",
        type: "stakeholder-response",
        source: "JP Mendel",
        role: "Head of Operations",
        excerpt:
          "The pipeline is three handoffs. Each one drops something we have to ask for again.",
        strength: "strong",
      },
      {
        id: "ref-caldera-doc-pipeline",
        type: "uploaded-document",
        source: "Deal-to-portfolio pipeline map",
        excerpt: "Three documented handoffs with explicit owner per stage.",
        strength: "strong",
      },
    ],
    reviewerNote:
      "Locked for the report. Featured in the AI Workflow System tier.",
  },
  {
    id: "caldera-f2",
    engagementId: "caldera-aios-q1",
    category: "Governance / Risk",
    statement:
      "Compliance posture must shape the SOW assumptions, not block the engagement.",
    summary:
      "Compliance Officer confirmed a documented review checklist. Sprint scope must include explicit governance treatment and human-in-the-loop review for all AI surfaces touching client data.",
    evidenceSummary: "Compliance checklist + Sara's response align.",
    confidence: "high",
    reviewStatus: "report-ready",
    suggestedImpact: "Recurring SOW assumption.",
    sourceRefs: [
      {
        id: "ref-caldera-sara-1",
        type: "stakeholder-response",
        source: "Sara Mehta",
        role: "Compliance Officer",
        excerpt:
          "We have a documented checklist. AI just needs to slot into it, not work around it.",
        strength: "strong",
      },
      {
        id: "ref-caldera-doc-comp",
        type: "uploaded-document",
        source: "Compliance review checklist",
        excerpt: "Sec. 6: 'Automated systems require named human approver.'",
        strength: "strong",
      },
    ],
  },
  {
    id: "caldera-f3",
    engagementId: "caldera-aios-q1",
    category: "Back-office Efficiency",
    statement:
      "Portfolio-reporting consolidation is a strong second-engagement surface.",
    summary:
      "Portfolio reporting runs quarterly. AI summarization with explicit data ownership compresses cycle time and is a natural follow-on engagement.",
    evidenceSummary: "JP + Vince responses align.",
    confidence: "high",
    reviewStatus: "report-ready",
    suggestedImpact: "Phase 2 candidate.",
    sourceRefs: [
      {
        id: "ref-caldera-vince-1",
        type: "stakeholder-response",
        source: "Vince Calhoun",
        role: "Senior Analyst",
        excerpt:
          "Quarterly reporting is the predictable two weeks of pain.",
        strength: "strong",
      },
    ],
  },
  {
    id: "caldera-f4",
    engagementId: "caldera-aios-q1",
    category: "Customer Experience",
    statement:
      "Client service motion is the clearest expansion path post-sprint.",
    summary:
      "Talia Burrows runs a structured client service motion that benefits from AI-drafted client updates.",
    evidenceSummary: "Single-source response, corroborated by Sara on compliance fit.",
    confidence: "medium",
    reviewStatus: "report-ready",
    suggestedImpact: "Phase 2.",
    sourceRefs: [
      {
        id: "ref-caldera-talia-1",
        type: "stakeholder-response",
        source: "Talia Burrows",
        role: "Client Service Lead",
        excerpt:
          "Updates back to the client are still hand-written. They'd benefit from a draft.",
        strength: "adequate",
      },
    ],
  },
  {
    id: "caldera-f5",
    engagementId: "caldera-aios-q1",
    category: "Adoption Risk",
    statement:
      "Risk team and Compliance team adoption posture is the change-management hinge.",
    summary:
      "Risk + Compliance leads framed adoption as 'fine if AI slots into the existing process.' That's the operating posture for the sprint.",
    evidenceSummary: "Risk + Compliance responses converge.",
    confidence: "medium",
    reviewStatus: "report-ready",
    suggestedImpact:
      "Becomes a SOW assumption.",
    sourceRefs: [
      {
        id: "ref-caldera-rico-1",
        type: "stakeholder-response",
        source: "Rico Patel",
        role: "Risk Lead",
        excerpt:
          "Risk has no objection if the human approver is named.",
        strength: "adequate",
      },
    ],
  },
];

const FINDINGS_BY_ENGAGEMENT: Record<string, Finding[]> = {
  "helio-aios-q2": HELIO,
  "meridian-aios-q2": MERIDIAN,
  "atlas-aios-q2": ATLAS,
  "quanta-aios-q1": QUANTA,
  "caldera-aios-q1": CALDERA,
};

export function getFindingsForEngagement(engagementId: string): Finding[] {
  return FINDINGS_BY_ENGAGEMENT[engagementId] ?? [];
}

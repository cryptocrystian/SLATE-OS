import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { EngagementProfileHeader } from "@/components/engagements/engagement-profile-header";
import { EngagementStageTracker } from "@/components/engagements/engagement-stage-tracker";
import { EngagementContextCard } from "@/components/engagements/engagement-context-card";
import { EngagementRecommendedActionCard } from "@/components/engagements/engagement-recommended-action-card";
import { EngagementRisksPanel } from "@/components/engagements/engagement-risks-panel";
import { EngagementNotesPanel } from "@/components/engagements/engagement-notes-panel";
import { StakeholderProgressPanel } from "@/components/engagements/stakeholder-progress-panel";
import { DocumentStatusPanel } from "@/components/engagements/document-status-panel";
import { FindingsStatusPanel } from "@/components/engagements/findings-status-panel";
import { OpportunityStatusPanel } from "@/components/engagements/opportunity-status-panel";
import { ReportStatusPanel } from "@/components/engagements/report-status-panel";
import { ProposalStatusPanel } from "@/components/engagements/proposal-status-panel";
import { Card, CardBody } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { getEngagementById } from "@/lib/engagements/queries";
import { getIntakeStatusSummary } from "@/lib/intake/queries";
import { getFindingsStatusSummary } from "@/lib/findings/queries";
import { getOpportunityStatusSummary } from "@/lib/opportunities/queries";
import { getRoadmapStatusSummary } from "@/lib/roadmap/queries";
import { STAGE_DESCRIPTION, STAGE_LABEL } from "@/lib/engagements/helpers";
import { ROLE_LABEL } from "@/lib/intake/helpers";
import { recommendedActionRoute } from "@/lib/engagements/recommended-action";
import type { Engagement } from "@/lib/engagements/types";
import type { StakeholderRole } from "@/lib/intake/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const engagement = await getEngagementById(params.id);
  if (!engagement) return { title: "Engagement not found" };
  return {
    title: `${engagement.companyName} · Engagement`,
    description: `${engagement.engagementType} for ${engagement.companyName}.`,
  };
}

function ratio(numerator: number, denominator: number, zeroLabel: string) {
  if (denominator === 0) return zeroLabel;
  return `${numerator}/${denominator}`;
}

export default async function EngagementDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const engagement = await getEngagementById(params.id);
  if (!engagement) notFound();

  const [intakeSummary, findingsSummary, opportunitySummary, roadmapSummary] =
    await Promise.all([
      getIntakeStatusSummary(engagement.id),
      getFindingsStatusSummary(engagement.id),
      getOpportunityStatusSummary(engagement.id),
      getRoadmapStatusSummary(engagement.id),
    ]);
  const intake = mergeIntakeStatus(engagement, intakeSummary);
  const findings = mergeFindingsStatus(engagement, findingsSummary);
  const opportunitiesPanel = mergeOpportunityStatus(
    engagement,
    opportunitySummary,
    roadmapSummary,
  );
  const intakeHref = `/app/engagements/${engagement.id}/intake`;
  const findingsHref = `/app/engagements/${engagement.id}/findings`;
  const opportunitiesHref = `/app/engagements/${engagement.id}/opportunities`;
  const reportHref = `/app/engagements/${engagement.id}/report`;
  const proposalHref = `/app/engagements/${engagement.id}/proposal`;
  const recAction = recommendedActionRoute(
    engagement,
    `/app/engagements/${engagement.id}`,
  );

  const stageOrder = ["setup", "intake", "synthesis", "scoring", "report", "proposal"];
  const currentIdx = stageOrder.indexOf(engagement.currentStage);
  const isReportStageOrLater = currentIdx >= stageOrder.indexOf("report");
  const isProposalStageOrLater = currentIdx >= stageOrder.indexOf("proposal");

  const stakeholderTotal =
    intake.stakeholdersInvited || intake.stakeholdersResponded || 0;
  const documentTotal =
    engagement.documents.requested || engagement.documents.received || 0;

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <EngagementProfileHeader engagement={engagement} />

      <EngagementStageTracker currentStage={engagement.currentStage} />

      <Card variant="base">
        <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Where this engagement is right now
          </span>
          <h2 className="text-base font-semibold tracking-tight text-text-primary">
            {STAGE_LABEL[engagement.currentStage]}
          </h2>
          <p className="text-xs leading-relaxed text-text-muted">
            {STAGE_DESCRIPTION[engagement.currentStage]}
          </p>
        </CardBody>
      </Card>

      {/* Pipeline summary metrics */}
      <section
        aria-label="Engagement progress summary"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      >
        <MetricCard
          label="Stakeholders"
          value={ratio(
            intake.stakeholdersResponded,
            stakeholderTotal,
            "Not invited",
          )}
          hint={stakeholderTotal === 0 ? "Awaiting kickoff" : "Responded"}
          tone={
            intake.status.tone === "success"
              ? "success"
              : intake.status.tone === "warning"
                ? "warning"
                : "info"
          }
        />
        <MetricCard
          label="Documents"
          value={ratio(
            engagement.documents.received,
            documentTotal,
            "Not requested",
          )}
          hint={
            documentTotal === 0
              ? "Document list opens with intake"
              : `${engagement.documents.reviewed} reviewed`
          }
          tone={
            engagement.documents.status.tone === "success" ? "success" : "info"
          }
        />
        <MetricCard
          label="Findings"
          value={
            findings.candidate === 0
              ? "—"
              : `${findings.approved}/${findings.candidate}`
          }
          hint={
            findings.candidate === 0
              ? "Synthesis follows intake"
              : "Approved"
          }
          tone={
            findings.status.tone === "warning"
              ? "warning"
              : findings.status.tone === "success"
                ? "success"
                : "neutral"
          }
        />
        <MetricCard
          label="Opportunities"
          value={
            opportunitiesPanel.identified === 0
              ? "—"
              : String(opportunitiesPanel.identified)
          }
          hint={
            opportunitiesPanel.identified === 0
              ? "Scoring follows findings"
              : `${opportunitiesPanel.quickWins} quick wins · ${opportunitiesPanel.strategicBuilds} strategic`
          }
          tone={
            opportunitiesPanel.status.tone === "success"
              ? "success"
              : opportunitiesPanel.status.tone === "warning"
                ? "warning"
                : "neutral"
          }
        />
        <MetricCard
          label="Report"
          value={`${engagement.report.sectionsApproved}/${engagement.report.sectionsTotal}`}
          hint="Sections approved"
          tone={
            engagement.report.status.tone === "warning"
              ? "warning"
              : engagement.report.status.tone === "success"
                ? "success"
                : "neutral"
          }
        />
        <MetricCard
          label="Proposal"
          value={
            engagement.proposal.options === 0
              ? "—"
              : String(engagement.proposal.options)
          }
          hint={
            engagement.proposal.options === 0
              ? "Awaiting report"
              : (engagement.proposal.recommendedOption ?? "Awaiting report")
          }
          tone={
            engagement.proposal.status.tone === "warning"
              ? "warning"
              : "neutral"
          }
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          <StakeholderProgressPanel
            intake={intake}
            intakeHref={intakeHref}
          />
          <DocumentStatusPanel
            documents={engagement.documents}
            intakeHref={intakeHref}
          />
          <FindingsStatusPanel
            findings={findings}
            findingsHref={
              findings.candidate > 0 ||
              engagement.currentStage === "synthesis" ||
              engagement.currentStage === "scoring" ||
              engagement.currentStage === "report" ||
              engagement.currentStage === "proposal"
                ? findingsHref
                : undefined
            }
          />
          <OpportunityStatusPanel
            opportunities={opportunitiesPanel}
            opportunitiesHref={
              engagement.currentStage === "scoring" ||
              engagement.currentStage === "report" ||
              engagement.currentStage === "proposal"
                ? opportunitiesHref
                : undefined
            }
          />
          <ReportStatusPanel
            report={engagement.report}
            reportHref={isReportStageOrLater ? reportHref : undefined}
          />
          <ProposalStatusPanel
            proposal={engagement.proposal}
            proposalHref={isProposalStageOrLater ? proposalHref : undefined}
          />
          <EngagementRisksPanel
            risks={engagement.riskNotes}
            dependencies={engagement.dependencies}
          />
        </div>

        {/* Sidebar */}
        <aside className="flex flex-col gap-6">
          <EngagementRecommendedActionCard
            engagement={engagement}
            href={recAction.href}
            lockedNote={recAction.lockedNote}
          />
          <EngagementContextCard engagement={engagement} />
          <EngagementNotesPanel notes={engagement.notes} />
          <Card variant="base">
            <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                Boundary reminder
              </span>
              <p className="text-xs leading-relaxed text-text-muted">
                The engagement workspace coordinates intake, synthesis, scoring,
                report, and proposal. Each module ships in its own sprint —
                deep workflows are not built yet, but every status panel
                points at the next action so progress stays legible today.
              </p>
            </CardBody>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function mergeIntakeStatus(
  engagement: Engagement,
  summary: Awaited<ReturnType<typeof getIntakeStatusSummary>>,
): Engagement["intake"] {
  if (!summary || summary.total === 0) {
    return engagement.intake;
  }
  const status = pickIntakeStatusBadge(summary);
  const rolesCovered = summary.rolesCovered.map(roleLabel);
  const rolesMissing = summary.rolesMissing.map(roleLabel);
  return {
    status,
    stakeholdersInvited: summary.invited,
    stakeholdersResponded: summary.completed,
    rolesCovered: rolesCovered.length > 0 ? rolesCovered : engagement.intake.rolesCovered,
    rolesMissing: rolesMissing.length > 0 ? rolesMissing : engagement.intake.rolesMissing,
    lastResponseAt:
      summary.lastResponseAt ?? engagement.intake.lastResponseAt,
    nextAction: pickIntakeNextAction(summary, engagement.intake.nextAction),
  };
}

function pickIntakeStatusBadge(
  summary: NonNullable<Awaited<ReturnType<typeof getIntakeStatusSummary>>>,
): Engagement["intake"]["status"] {
  if (summary.total === 0) {
    return { tone: "info", label: "Ready to send" };
  }
  if (summary.completed === summary.total) {
    return { tone: "success", label: "All responses received" };
  }
  if (summary.needsFollowUp > 0) {
    return { tone: "warning", label: "Follow-ups needed" };
  }
  if (summary.completed > 0 || summary.inProgress > 0) {
    return { tone: "info", label: "In progress" };
  }
  return { tone: "info", label: "Invitations sent" };
}

function pickIntakeNextAction(
  summary: NonNullable<Awaited<ReturnType<typeof getIntakeStatusSummary>>>,
  fallback: string,
): string {
  if (summary.total === 0) return fallback;
  if (summary.rolesMissing.length > 0) {
    const missing = summary.rolesMissing.map(roleLabel).join(", ");
    return `Invite a stakeholder for: ${missing}.`;
  }
  if (summary.needsFollowUp > 0) {
    return `${summary.needsFollowUp} stakeholder${summary.needsFollowUp === 1 ? "" : "s"} need a personal follow-up.`;
  }
  if (summary.completed === summary.total) {
    return "All responses received — open synthesis.";
  }
  return "Continue collecting stakeholder responses.";
}

function roleLabel(role: string): string {
  return ROLE_LABEL[role as StakeholderRole] ?? role;
}

function mergeFindingsStatus(
  engagement: Engagement,
  summary: Awaited<ReturnType<typeof getFindingsStatusSummary>>,
): Engagement["findings"] {
  if (!summary || summary.total === 0) {
    return engagement.findings;
  }
  return {
    status: pickFindingsStatusBadge(summary),
    candidate: summary.total,
    approved: summary.approved + summary.reportReady,
    rejected: summary.rejected,
    reviewState: pickFindingsReviewState(summary),
    nextAction: pickFindingsNextAction(summary),
  };
}

function pickFindingsStatusBadge(
  summary: NonNullable<Awaited<ReturnType<typeof getFindingsStatusSummary>>>,
): Engagement["findings"]["status"] {
  if (summary.reportReady > 0 && summary.needsReview === 0) {
    return { tone: "success", label: "Report-ready" };
  }
  if (summary.needsReview > 0) {
    return { tone: "warning", label: "Needs review" };
  }
  if (summary.approved > 0) {
    return { tone: "info", label: "Approved" };
  }
  if (summary.rejected === summary.total) {
    return { tone: "neutral", label: "All rejected" };
  }
  return { tone: "info", label: "In progress" };
}

function pickFindingsReviewState(
  summary: NonNullable<Awaited<ReturnType<typeof getFindingsStatusSummary>>>,
): string {
  if (summary.total === 0) {
    return "Synthesis runs after intake responses are in.";
  }
  if (summary.needsReview > 0) {
    return `${summary.needsReview} finding${summary.needsReview === 1 ? "" : "s"} awaiting consultant decision.`;
  }
  if (summary.reportReady > 0) {
    return `${summary.reportReady} finding${summary.reportReady === 1 ? "" : "s"} locked for the report.`;
  }
  if (summary.approved > 0) {
    return `${summary.approved} approved finding${summary.approved === 1 ? "" : "s"} pending report-ready confirmation.`;
  }
  return "All candidate findings have been triaged.";
}

function pickFindingsNextAction(
  summary: NonNullable<Awaited<ReturnType<typeof getFindingsStatusSummary>>>,
): string {
  if (summary.needsReview > 0) {
    return `Review ${summary.needsReview} candidate finding${summary.needsReview === 1 ? "" : "s"}.`;
  }
  if (summary.approved > 0 && summary.reportReady === 0) {
    return "Mark approved findings report-ready before scoring opens.";
  }
  if (summary.reportReady > 0) {
    return "Open opportunity scoring.";
  }
  if (summary.total === summary.rejected) {
    return "All candidate findings rejected — capture a new finding or revisit intake.";
  }
  return "Continue triaging findings.";
}

function mergeOpportunityStatus(
  engagement: Engagement,
  summary: Awaited<ReturnType<typeof getOpportunityStatusSummary>>,
  roadmapSummary: Awaited<ReturnType<typeof getRoadmapStatusSummary>>,
): Engagement["opportunities"] {
  if (!summary || summary.total === 0) {
    return engagement.opportunities;
  }
  return {
    status: pickOpportunityStatusBadge(summary),
    identified: summary.total,
    quickWins: summary.quickWins,
    strategicBuilds: summary.strategicBuilds,
    defer: summary.deferAvoid + summary.deferred,
    scoringState: pickOpportunityScoringState(summary, roadmapSummary),
    nextAction: pickOpportunityNextAction(summary, roadmapSummary),
  };
}

function pickOpportunityStatusBadge(
  summary: NonNullable<Awaited<ReturnType<typeof getOpportunityStatusSummary>>>,
): Engagement["opportunities"]["status"] {
  if (summary.selected > 0) {
    return { tone: "success", label: "Selections in" };
  }
  if (summary.scored > 0 || summary.quickWins > 0 || summary.strategicBuilds > 0) {
    return { tone: "info", label: "Scoring in flight" };
  }
  if (summary.draft > 0) {
    return { tone: "warning", label: "Drafts pending" };
  }
  return { tone: "neutral", label: "Awaiting findings" };
}

function pickOpportunityScoringState(
  summary: NonNullable<Awaited<ReturnType<typeof getOpportunityStatusSummary>>>,
  roadmap: Awaited<ReturnType<typeof getRoadmapStatusSummary>>,
): string {
  if (summary.total === 0) {
    return "Scoring begins once findings are approved.";
  }
  if (roadmap && roadmap.total > 0) {
    return `${roadmap.total} roadmap item${roadmap.total === 1 ? "" : "s"} sequenced (${roadmap.first30} · ${roadmap.days3160} · ${roadmap.days6190}).`;
  }
  if (summary.selected > 0) {
    return `${summary.selected} opportunity${summary.selected === 1 ? "" : "ies"} selected for the roadmap.`;
  }
  if (summary.quickWins + summary.strategicBuilds > 0) {
    return `${summary.quickWins} quick win${summary.quickWins === 1 ? "" : "s"} · ${summary.strategicBuilds} strategic build${summary.strategicBuilds === 1 ? "" : "s"} scored.`;
  }
  return "Score opportunities to position them on the matrix.";
}

function pickOpportunityNextAction(
  summary: NonNullable<Awaited<ReturnType<typeof getOpportunityStatusSummary>>>,
  roadmap: Awaited<ReturnType<typeof getRoadmapStatusSummary>>,
): string {
  if (roadmap && roadmap.blocked > 0) {
    return `${roadmap.blocked} blocked roadmap item${roadmap.blocked === 1 ? "" : "s"} need attention.`;
  }
  if (summary.selected > 0 && (!roadmap || roadmap.total === 0)) {
    return "Sequence selected opportunities into the 30/60/90 roadmap.";
  }
  if (roadmap && roadmap.total > 0 && roadmap.completed === roadmap.total) {
    return "Roadmap complete — open the report builder when ready.";
  }
  if (summary.scored > 0 && summary.selected === 0) {
    return "Mark scored opportunities as selected before sequencing the roadmap.";
  }
  if (summary.draft > 0) {
    return "Score drafted opportunities before promoting them.";
  }
  return "Continue refining opportunity scoring.";
}

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
import {
  MOCK_ENGAGEMENTS,
  getEngagementById,
} from "@/lib/engagements/mock-engagements";
import { STAGE_DESCRIPTION, STAGE_LABEL } from "@/lib/engagements/helpers";
import type { Engagement } from "@/lib/engagements/types";

export function generateStaticParams() {
  return MOCK_ENGAGEMENTS.map((e) => ({ id: e.id }));
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const engagement = getEngagementById(params.id);
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

function recommendedActionRoute(engagement: Engagement) {
  switch (engagement.currentStage) {
    case "setup":
    case "intake":
      return {
        href: `/app/engagements/${engagement.id}/intake`,
      };
    case "synthesis":
      return {
        href: `/app/engagements/${engagement.id}/findings`,
      };
    case "scoring":
      return { lockedNote: "Sprint 6" };
    case "report":
    case "proposal":
      return { lockedNote: "Sprint 7" };
  }
}

export default function EngagementDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const engagement = getEngagementById(params.id);
  if (!engagement) notFound();

  const intakeHref = `/app/engagements/${engagement.id}/intake`;
  const findingsHref = `/app/engagements/${engagement.id}/findings`;
  const recAction = recommendedActionRoute(engagement);

  const stakeholderTotal =
    engagement.intake.stakeholdersInvited ||
    engagement.intake.stakeholdersResponded ||
    0;
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
            engagement.intake.stakeholdersResponded,
            stakeholderTotal,
            "Not invited",
          )}
          hint={stakeholderTotal === 0 ? "Awaiting kickoff" : "Responded"}
          tone={
            engagement.intake.status.tone === "success"
              ? "success"
              : engagement.intake.status.tone === "warning"
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
            engagement.findings.candidate === 0
              ? "—"
              : `${engagement.findings.approved}/${engagement.findings.candidate}`
          }
          hint={
            engagement.findings.candidate === 0
              ? "Synthesis follows intake"
              : "Approved"
          }
          tone={
            engagement.findings.status.tone === "warning"
              ? "warning"
              : engagement.findings.status.tone === "success"
                ? "success"
                : "neutral"
          }
        />
        <MetricCard
          label="Opportunities"
          value={
            engagement.opportunities.identified === 0
              ? "—"
              : String(engagement.opportunities.identified)
          }
          hint={
            engagement.opportunities.identified === 0
              ? "Scoring follows findings"
              : `${engagement.opportunities.quickWins} quick wins · ${engagement.opportunities.strategicBuilds} strategic`
          }
          tone={
            engagement.opportunities.status.tone === "success"
              ? "success"
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
            intake={engagement.intake}
            intakeHref={intakeHref}
          />
          <DocumentStatusPanel
            documents={engagement.documents}
            intakeHref={intakeHref}
          />
          <FindingsStatusPanel
            findings={engagement.findings}
            findingsHref={
              engagement.findings.candidate > 0 ||
              engagement.currentStage === "synthesis" ||
              engagement.currentStage === "scoring" ||
              engagement.currentStage === "report" ||
              engagement.currentStage === "proposal"
                ? findingsHref
                : undefined
            }
          />
          <OpportunityStatusPanel opportunities={engagement.opportunities} />
          <ReportStatusPanel report={engagement.report} />
          <ProposalStatusPanel proposal={engagement.proposal} />
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

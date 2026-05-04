import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, ScrollText } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LockedActionButton } from "@/components/ui/locked-action-button";
import { ReportWorkspace } from "@/components/reports/report-workspace";
import { EngagementContextCard } from "@/components/engagements/engagement-context-card";
import { EngagementRecommendedActionCard } from "@/components/engagements/engagement-recommended-action-card";
import {
  MOCK_ENGAGEMENTS,
  getEngagementById,
} from "@/lib/engagements/mock-engagements";
import { getReportForEngagement } from "@/lib/reports/mock-reports";
import { getFindingsForEngagement } from "@/lib/findings/mock-findings";
import { getOpportunitiesForEngagement } from "@/lib/opportunities/mock-opportunities";
import { getRoadmapForEngagement } from "@/lib/roadmap/mock-roadmap";
import {
  recommendedActionLabel,
  recommendedActionRoute,
} from "@/lib/engagements/recommended-action";

export function generateStaticParams() {
  return MOCK_ENGAGEMENTS.map((e) => ({ id: e.id }));
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const engagement = getEngagementById(params.id);
  if (!engagement) return { title: "Report not found" };
  return { title: `${engagement.companyName} · AI Opportunity Sprint Report` };
}

export default function EngagementReportPage({
  params,
}: {
  params: { id: string };
}) {
  const engagement = getEngagementById(params.id);
  if (!engagement) notFound();

  const report = getReportForEngagement(engagement.id);
  const findings = getFindingsForEngagement(engagement.id);
  const opportunities = getOpportunitiesForEngagement(engagement.id);
  const roadmap = getRoadmapForEngagement(engagement.id);

  const proposalHref = `/app/engagements/${engagement.id}/proposal`;
  const findingsHref = `/app/engagements/${engagement.id}/findings`;
  const opportunitiesHref = `/app/engagements/${engagement.id}/opportunities`;
  const recAction = recommendedActionRoute(
    engagement,
    `/app/engagements/${engagement.id}/report`,
  );

  const sections = report?.sections ?? [];
  const counts = {
    total: sections.length,
    needsReview: sections.filter((s) => s.status === "needs-review").length,
    approved: sections.filter(
      (s) => s.status === "approved" || s.status === "final",
    ).length,
    evidenceLinks: sections.reduce(
      (sum, s) =>
        sum +
        s.linkedFindingIds.length +
        s.linkedOpportunityIds.length +
        s.linkedRoadmapItemIds.length,
      0,
    ),
    roadmapLinks: sections.reduce(
      (sum, s) => sum + s.linkedRoadmapItemIds.length,
      0,
    ),
  };

  const reportReady =
    report &&
    sections.length > 0 &&
    sections.filter((s) => s.status === "approved" || s.status === "final")
      .length >=
      Math.ceil(sections.length * 0.5);

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageHeader
        eyebrow="AdvisoryOps · Report"
        title="AI Opportunity Sprint report."
        description="Assemble reviewed findings, evidence, opportunities, and roadmap items into a client-facing advisory report."
        actions={
          <>
            <Link href={`/app/engagements/${engagement.id}`}>
              <Button
                variant="secondary"
                size="md"
                leadingIcon={<ArrowLeft className="h-4 w-4" />}
              >
                Back to engagement
              </Button>
            </Link>
            {reportReady ? (
              <Link href={proposalHref}>
                <Button
                  variant="primary"
                  size="md"
                  trailingIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Open Proposal Builder
                </Button>
              </Link>
            ) : null}
            <LockedActionButton label="Export Report" lockedNote="Mock" />
          </>
        }
        meta={
          <>
            <Badge tone="ai" dot>
              {engagement.companyName} · {engagement.engagementType}
            </Badge>
            <span className="text-text-muted">
              <ScrollText className="mr-1 inline h-3 w-3 align-text-bottom text-practice-ai" />
              AI-drafted · awaits human approval before client-facing use
            </span>
            <span className="text-text-disabled">·</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
              Sprint 7 · Mock data
            </span>
          </>
        }
      />

      <section
        aria-label="Report summary"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      >
        <MetricCard
          label="Sections"
          value={counts.total === 0 ? "—" : String(counts.total)}
          hint={counts.total === 0 ? "Awaiting findings + scoring" : "12 standard sections"}
          tone="info"
        />
        <MetricCard
          label="Needs Review"
          value={String(counts.needsReview)}
          hint="Awaiting consultant decision"
          tone={counts.needsReview > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Approved"
          value={String(counts.approved)}
          hint="Cleared for client-facing use"
          tone="success"
        />
        <MetricCard
          label="Evidence Links"
          value={String(counts.evidenceLinks)}
          hint="Findings + opportunities + roadmap"
          tone="info"
        />
        <MetricCard
          label="Roadmap Items"
          value={String(counts.roadmapLinks)}
          hint="Linked from sections"
          tone="info"
        />
        <MetricCard
          label="Export Status"
          value={
            report?.exportStatus === "ready-for-export-placeholder"
              ? "Ready · mock"
              : report?.exportStatus === "preview-only"
                ? "Preview only"
                : "Locked"
          }
          hint="Production export ships later"
          tone="neutral"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-9">
          {!report ? (
            <EmptyState
              icon={<ScrollText className="h-4 w-4" />}
              title="Approve findings and score opportunities before report assembly begins."
              description="The report draws on approved findings, prioritized opportunities, and the 30/60/90 roadmap. Once those land, the outline and section drafts populate here."
              action={
                <div className="flex flex-wrap gap-2">
                  {recAction.href ? (
                    <Link href={recAction.href}>
                      <Button
                        variant="primary"
                        size="md"
                        trailingIcon={<ArrowRight className="h-4 w-4" />}
                      >
                        {recommendedActionLabel(recAction.href)}
                      </Button>
                    </Link>
                  ) : (
                    <Link href={findingsHref}>
                      <Button
                        variant="primary"
                        size="md"
                        trailingIcon={<ArrowRight className="h-4 w-4" />}
                      >
                        Open findings
                      </Button>
                    </Link>
                  )}
                  <Link href={opportunitiesHref}>
                    <Button variant="secondary" size="md">
                      Open opportunities
                    </Button>
                  </Link>
                </div>
              }
            />
          ) : (
            <ReportWorkspace
              engagementId={engagement.id}
              report={report}
              findings={findings}
              opportunities={opportunities}
              roadmap={roadmap}
            />
          )}

          <Card variant="base">
            <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                Boundary reminder
              </span>
              <p className="text-xs leading-relaxed text-text-muted">
                AI drafts each section; the consultant approves before any
                section becomes client-facing. Report assembly never
                auto-promotes anything to a final deliverable. Production
                export and final SOW execution arrive after the MVP arc.
              </p>
            </CardBody>
          </Card>
        </div>

        <aside className="flex flex-col gap-6 lg:col-span-3">
          <EngagementRecommendedActionCard
            engagement={engagement}
            href={recAction.href}
            lockedNote={recAction.lockedNote}
            selfReference={recAction.selfReference}
          />
          <EngagementContextCard engagement={engagement} />
          {report ? (
            <Card variant="base">
              <CardBody className="flex flex-col gap-3 p-5 sm:p-6">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                  Recommended next step
                </span>
                <p className="text-xs leading-relaxed text-text-secondary">
                  {report.recommendedNextStep}
                </p>
                {report.consultantNotes.length > 0 ? (
                  <div className="flex flex-col gap-2 border-t border-border-subtle pt-3">
                    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
                      Consultant notes
                    </span>
                    <ul className="flex flex-col gap-1.5 text-[11px] leading-relaxed text-text-secondary">
                      {report.consultantNotes.map((note, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span
                            aria-hidden
                            className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-muted"
                          />
                          {note}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </CardBody>
            </Card>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

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
import { ReportSectionActionBar } from "@/components/reports/report-section-action-bar";
import { InitializeReportForm } from "@/components/reports/initialize-report-form";
import { ReportExhibitSlots } from "@/components/reports/report-exhibit-slots";
import { EngagementContextCard } from "@/components/engagements/engagement-context-card";
import { EngagementRecommendedActionCard } from "@/components/engagements/engagement-recommended-action-card";
import { loadEngagementForSubroute } from "@/lib/engagements/load-for-subroute";
import { getReportForEngagement } from "@/lib/reports/mock-reports";
import { getReportForEngagementPersisted } from "@/lib/reports/queries";
import { getFindingsForEngagement } from "@/lib/findings/mock-findings";
import { getFindingsForEngagementPersisted } from "@/lib/findings/queries";
import { getOpportunitiesForEngagement } from "@/lib/opportunities/mock-opportunities";
import { getOpportunitiesForEngagementPersisted } from "@/lib/opportunities/queries";
import { getRoadmapForEngagement } from "@/lib/roadmap/mock-roadmap";
import { getRoadmapForEngagementPersisted } from "@/lib/roadmap/queries";
import { getIntakeRecordForEngagement } from "@/lib/intake/queries";
import { executiveSummaryPortfolioFromOpportunities } from "@/lib/charts/adapters/executive-summary-2x2-adapter";
import { risksFromOpportunities } from "@/lib/charts/adapters/risk-adjusted-priority-quadrant-adapter";
import { capabilityMaturityFromFindings } from "@/lib/charts/adapters/capability-maturity-heatmap-adapter";
import { stakeholderCoverageFromIntake } from "@/lib/charts/adapters/stakeholder-coverage-matrix-adapter";
import { roadmapGanttFromRoadmapItems } from "@/lib/charts/adapters/roadmap-gantt-adapter";
import { isGroupAReportSlot } from "@/lib/reports/slot-map";
import {
  latestIsoTimestamp,
  type ReportExhibitSlot,
} from "@/lib/charts/adapters/types";
import { isAiConfigured } from "@/lib/ai/provider";
import {
  recommendedActionLabel,
  recommendedActionRoute,
} from "@/lib/engagements/recommended-action";
import type { Report } from "@/lib/reports/types";
import type { Finding } from "@/lib/findings/types";
import type { Opportunity } from "@/lib/opportunities/types";
import type { RoadmapItem } from "@/lib/roadmap/types";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) return { title: "Report not found" };
  return {
    title: `${loaded.engagement.companyName} · AI Opportunity Sprint Report`,
  };
}

export default async function EngagementReportPage({
  params,
}: {
  params: { id: string };
}) {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) notFound();
  const engagement = loaded.engagement;
  const isPersisted = loaded.kind === "real";

  let report: Report | null | undefined;
  let findings: Finding[];
  let opportunities: Opportunity[];
  let roadmap: RoadmapItem[];

  // Intake responses feed the Sprint 1 Stakeholder Coverage adapter.
  // Fetched only for persisted engagements; mock paths skip the
  // exhibit-slot section entirely.
  let intakeRecord: Awaited<ReturnType<typeof getIntakeRecordForEngagement>> = null;

  if (isPersisted) {
    [report, findings, opportunities, roadmap, intakeRecord] = await Promise.all([
      getReportForEngagementPersisted(engagement.id),
      getFindingsForEngagementPersisted(engagement.id),
      getOpportunitiesForEngagementPersisted(engagement.id),
      getRoadmapForEngagementPersisted(engagement.id),
      getIntakeRecordForEngagement(engagement.id),
    ]);
  } else {
    report = getReportForEngagement(engagement.id);
    findings = getFindingsForEngagement(engagement.id);
    opportunities = getOpportunitiesForEngagement(engagement.id);
    roadmap = getRoadmapForEngagement(engagement.id);
  }

  // ---------------------------------------------------------------------------
  // Sprint 1 internal report-slot exhibits.
  //
  // Group-A adapters run only against persisted engagement rows. Mock
  // (legacy slug) engagements skip the exhibit-slot section entirely so
  // the Sprint 1 wiring stays narrowly scoped to real persisted data.
  // Every adapter is a pure function; a single shared `generatedAt`
  // clock token keeps the source-summary timestamps consistent across
  // slots without any adapter calling Date.now() internally.
  //
  // Group B exhibits (Benchmark Comparison Bars, AI-Savings Waterfall,
  // ROI Bridge) are NOT imported and NOT run — they remain preview-only
  // until docs/14 / docs/15 advance their data gates.
  // ---------------------------------------------------------------------------
  const exhibitSlotsGeneratedAt = new Date().toISOString();
  // Sprint 2 — derive the render order from persisted
  // `report_sections.exhibit_slot` rather than the static
  // `GROUP_A_REPORT_SLOTS` table. Sections without a slot contribute
  // nothing; Group-B values are already filtered by the read-path
  // coercion in `mapReportSectionRow`, but we re-check here for
  // defense-in-depth.
  const persistedSlotsInOrder: ReportExhibitSlot[] = (report?.sections ?? [])
    .map((s) => s.exhibitSlot)
    .filter((slot): slot is ReportExhibitSlot => isGroupAReportSlot(slot));
  // Sprint 2.1 — derive each adapter's `lastTouchedAt` from the
  // latest persisted row timestamp surfaced through the domain
  // mappers. `latestIsoTimestamp` ignores null / unparseable values
  // and returns null when no entry is valid; the adapter then falls
  // through to `"unknown"` freshness per `docs/17` § Data Freshness
  // Rules. No Date.now() inside any adapter — the page captures the
  // wall clock once via `exhibitSlotsGeneratedAt` above.
  const opportunitiesLastTouched = isPersisted
    ? latestIsoTimestamp(opportunities.map((o) => o.updatedAt))
    : null;
  const findingsLastTouched = isPersisted
    ? latestIsoTimestamp(
        findings.flatMap((f) => [f.updatedAt, f.lastReviewedAt]),
      )
    : null;
  const stakeholdersLastTouched = isPersisted
    ? latestIsoTimestamp(
        (intakeRecord?.stakeholders ?? []).map((s) => s.lastActivityAt),
      )
    : null;
  const roadmapLastTouched = isPersisted
    ? latestIsoTimestamp(roadmap.map((r) => r.updatedAt))
    : null;

  const exhibitSlotResults = isPersisted
    ? {
        executiveSummary: executiveSummaryPortfolioFromOpportunities({
          opportunities,
          generatedAt: exhibitSlotsGeneratedAt,
          lastTouchedAt: opportunitiesLastTouched,
        }),
        riskPriority: risksFromOpportunities({
          opportunities,
          generatedAt: exhibitSlotsGeneratedAt,
          lastTouchedAt: opportunitiesLastTouched,
        }),
        capabilityMaturity: capabilityMaturityFromFindings({
          findings,
          capabilities: [],
          dimensions: [],
          generatedAt: exhibitSlotsGeneratedAt,
          lastTouchedAt: findingsLastTouched,
        }),
        stakeholderCoverage: stakeholderCoverageFromIntake({
          stakeholders: intakeRecord?.stakeholders ?? [],
          roles: Array.from(
            new Set(
              (intakeRecord?.stakeholders ?? []).map(
                (s) => s.role as unknown as string,
              ),
            ),
          ),
          topics: [],
          generatedAt: exhibitSlotsGeneratedAt,
          lastTouchedAt: stakeholdersLastTouched,
        }),
        roadmap: roadmapGanttFromRoadmapItems({
          items: roadmap,
          generatedAt: exhibitSlotsGeneratedAt,
          lastTouchedAt: roadmapLastTouched,
        }),
      }
    : null;

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
            <LockedActionButton label="Export Report" lockedNote="Locked" />
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
              {isPersisted ? "Persistence Step 8 · Live" : "Sprint 7 · Mock data"}
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
              ? "Ready · placeholder"
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
            isPersisted ? (
              <InitializeReportForm engagementId={engagement.id} />
            ) : (
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
            )
          ) : (
            <ReportWorkspace
              engagementId={engagement.id}
              report={report}
              findings={findings}
              opportunities={opportunities}
              roadmap={roadmap}
              renderActionBar={
                isPersisted
                  ? (section) => (
                      <ReportSectionActionBar
                        sectionId={section.id}
                        status={section.status}
                        engagementId={engagement.id}
                        aiAvailable={isAiConfigured()}
                      />
                    )
                  : undefined
              }
            />
          )}

          {exhibitSlotResults && report ? (
            <ReportExhibitSlots
              engagementId={engagement.id}
              generatedAt={exhibitSlotsGeneratedAt}
              slots={persistedSlotsInOrder}
              executiveSummary={exhibitSlotResults.executiveSummary}
              riskPriority={exhibitSlotResults.riskPriority}
              capabilityMaturity={exhibitSlotResults.capabilityMaturity}
              stakeholderCoverage={exhibitSlotResults.stakeholderCoverage}
              roadmap={exhibitSlotResults.roadmap}
            />
          ) : null}

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

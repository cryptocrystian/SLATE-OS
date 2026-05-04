import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Calendar } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { LockedActionButton } from "@/components/ui/locked-action-button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { RoadmapPhaseColumn } from "@/components/roadmap/roadmap-phase-column";
import { EngagementContextCard } from "@/components/engagements/engagement-context-card";
import { EngagementRecommendedActionCard } from "@/components/engagements/engagement-recommended-action-card";
import {
  MOCK_ENGAGEMENTS,
  getEngagementById,
} from "@/lib/engagements/mock-engagements";
import { getRoadmapForEngagement } from "@/lib/roadmap/mock-roadmap";
import { getOpportunitiesForEngagement } from "@/lib/opportunities/mock-opportunities";
import { PHASE_ORDER } from "@/lib/roadmap/helpers";
import { recommendedActionRoute } from "@/lib/engagements/recommended-action";

export function generateStaticParams() {
  return MOCK_ENGAGEMENTS.map((e) => ({ id: e.id }));
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const engagement = getEngagementById(params.id);
  if (!engagement) return { title: "Roadmap not found" };
  return {
    title: `${engagement.companyName} · 30/60/90 roadmap`,
  };
}

export default function EngagementRoadmapPage({
  params,
}: {
  params: { id: string };
}) {
  const engagement = getEngagementById(params.id);
  if (!engagement) notFound();

  const items = getRoadmapForEngagement(engagement.id);
  const opportunities = getOpportunitiesForEngagement(engagement.id);

  const counts = {
    total: items.length,
    quickWins: items.filter((i) => i.priority === "quick-win").length,
    strategic: items.filter((i) => i.priority === "strategic-build").length,
    dependencies: items.reduce((sum, i) => sum + i.dependencies.length, 0),
    first30: items.filter((i) => i.phase === "first-30").length,
    reportReadyInputs: items.filter((i) => Boolean(i.linkedOpportunityId))
      .length,
  };

  const opportunitiesHref = `/app/engagements/${engagement.id}/opportunities`;
  const reportHref =
    items.length > 0 ? `/app/engagements/${engagement.id}/report` : undefined;
  const recAction = recommendedActionRoute(
    engagement,
    `/app/engagements/${engagement.id}/roadmap`,
  );

  const opportunityTitles: Record<string, string> = Object.fromEntries(
    opportunities.map((o) => [o.id, o.title]),
  );

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageHeader
        eyebrow="AdvisoryOps · Roadmap"
        title="30/60/90 roadmap."
        description="Sequence approved opportunities into a practical implementation path before report and proposal assembly."
        actions={
          <>
            <Link href={opportunitiesHref}>
              <Button
                variant="secondary"
                size="md"
                leadingIcon={<ArrowLeft className="h-4 w-4" />}
              >
                Back to Opportunities
              </Button>
            </Link>
            {reportHref ? (
              <Link href={reportHref}>
                <Button
                  variant="primary"
                  size="md"
                  trailingIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Prepare Report
                </Button>
              </Link>
            ) : (
              <LockedActionButton label="Prepare Report" />
            )}
          </>
        }
        meta={
          <>
            <Badge tone="ai" dot>
              {engagement.companyName} · {engagement.engagementType}
            </Badge>
            <span className="text-text-muted">
              <Calendar className="mr-1 inline h-3 w-3 align-text-bottom" />
              Owner {engagement.owner} · Target {engagement.targetDate}
            </span>
            <span className="text-text-disabled">·</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
              Sprint 6 · Mock data
            </span>
          </>
        }
      />

      <section
        aria-label="Roadmap summary"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      >
        <MetricCard
          label="Roadmap Items"
          value={counts.total === 0 ? "—" : String(counts.total)}
          hint="Across 30/60/90"
          tone="info"
        />
        <MetricCard
          label="Quick Wins"
          value={String(counts.quickWins)}
          hint="High impact · low complexity"
          tone="success"
        />
        <MetricCard
          label="Strategic Builds"
          value={String(counts.strategic)}
          hint="Multi-phase scoping"
          tone="info"
        />
        <MetricCard
          label="Dependencies"
          value={String(counts.dependencies)}
          hint="Resolve before pilot"
          tone={counts.dependencies > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="First 30 Days"
          value={String(counts.first30)}
          hint="Pilot work"
          tone="info"
        />
        <MetricCard
          label="Report-ready Inputs"
          value={String(counts.reportReadyInputs)}
          hint="Linked to opportunities"
          tone="info"
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-9">
          {counts.total === 0 ? (
            <EmptyState
              icon={<Calendar className="h-4 w-4" />}
              title={
                opportunities.length === 0
                  ? "Score opportunities before sequencing the roadmap."
                  : "No roadmap items yet."
              }
              description={
                opportunities.length === 0
                  ? "Approved findings need to be promoted into opportunities before the 30/60/90-day roadmap can be sequenced."
                  : "Promote opportunities into the 30/60/90 roadmap when the engagement reaches scoping."
              }
              action={
                <Link href={opportunitiesHref}>
                  <Button
                    variant="primary"
                    size="md"
                    trailingIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    Open opportunities
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {PHASE_ORDER.map((phase) => (
                <RoadmapPhaseColumn
                  key={phase}
                  phase={phase}
                  items={items.filter((i) => i.phase === phase)}
                  opportunityTitles={opportunityTitles}
                />
              ))}
            </div>
          )}

          <Card variant="base">
            <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                Boundary reminder
              </span>
              <p className="text-xs leading-relaxed text-text-muted">
                The 30/60/90 roadmap is an advisory implementation-readiness
                plan, not a project-management board. Report assembly and
                proposal generation arrive in Sprint 7. Each roadmap item
                stays linked to its source opportunity and underlying
                evidence so the trail is intact through to the SOW.
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
        </aside>
      </div>
    </div>
  );
}

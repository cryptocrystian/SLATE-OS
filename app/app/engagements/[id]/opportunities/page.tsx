import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Compass, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { OpportunitiesWorkspace } from "@/components/opportunities/opportunities-workspace";
import { EngagementContextCard } from "@/components/engagements/engagement-context-card";
import { EngagementRecommendedActionCard } from "@/components/engagements/engagement-recommended-action-card";
import {
  MOCK_ENGAGEMENTS,
  getEngagementById,
} from "@/lib/engagements/mock-engagements";
import { getOpportunitiesForEngagement } from "@/lib/opportunities/mock-opportunities";
import { getFindingsForEngagement } from "@/lib/findings/mock-findings";
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
  if (!engagement) return { title: "Opportunities not found" };
  return {
    title: `${engagement.companyName} · Opportunity matrix`,
  };
}

export default function EngagementOpportunitiesPage({
  params,
}: {
  params: { id: string };
}) {
  const engagement = getEngagementById(params.id);
  if (!engagement) notFound();

  const opportunities = getOpportunitiesForEngagement(engagement.id);
  const findings = getFindingsForEngagement(engagement.id);
  const approvedFindings = findings.filter(
    (f) => f.reviewStatus === "approved" || f.reviewStatus === "report-ready",
  );

  const total = opportunities.length;
  const quickWins = opportunities.filter((o) => o.quadrant === "quick-win").length;
  const strategic = opportunities.filter((o) => o.quadrant === "strategic-build").length;
  const deferAvoid = opportunities.filter((o) => o.quadrant === "defer-avoid").length;
  const avgImpact =
    total === 0
      ? 0
      : Math.round(
          opportunities.reduce((sum, o) => sum + o.businessImpactScore, 0) /
            total,
        );
  const strongEvidence = opportunities.filter(
    (o) => o.evidenceStrength === "strong",
  ).length;

  const roadmapHref = `/app/engagements/${engagement.id}/roadmap`;
  const findingsHref = `/app/engagements/${engagement.id}/findings`;
  const recAction = recommendedActionRoute(
    engagement,
    `/app/engagements/${engagement.id}/opportunities`,
  );

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageHeader
        eyebrow="AdvisoryOps · Opportunities"
        title="Opportunity matrix."
        description="Prioritize AI and workflow opportunities by impact, complexity, risk, and evidence before building the roadmap."
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
            {total > 0 ? (
              <Link href={roadmapHref}>
                <Button
                  variant="primary"
                  size="md"
                  leadingIcon={<Compass className="h-4 w-4" />}
                  trailingIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Build Roadmap
                </Button>
              </Link>
            ) : null}
          </>
        }
        meta={
          <>
            <Badge tone="ai" dot>
              {engagement.companyName} · {engagement.engagementType}
            </Badge>
            <span className="text-text-muted">
              <Sparkles className="mr-1 inline h-3 w-3 align-text-bottom text-practice-ai" />
              Directional scoring · validate during scoping
            </span>
            <span className="text-text-disabled">·</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
              Sprint 6 · Mock data
            </span>
          </>
        }
      />

      <section
        aria-label="Opportunity summary"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      >
        <MetricCard
          label="Identified"
          value={total === 0 ? "—" : String(total)}
          hint={total === 0 ? "Approve findings to begin" : "From approved findings"}
          tone="info"
        />
        <MetricCard
          label="Quick Wins"
          value={String(quickWins)}
          hint="High impact · low complexity"
          tone="success"
        />
        <MetricCard
          label="Strategic Builds"
          value={String(strategic)}
          hint="High impact · high complexity"
          tone="info"
        />
        <MetricCard
          label="Defer · Avoid"
          value={String(deferAvoid)}
          hint="Low impact · high complexity"
          tone={deferAvoid > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Avg Impact"
          value={total === 0 ? "—" : String(avgImpact)}
          hint="Across the portfolio"
          tone="info"
        />
        <MetricCard
          label="Strong Evidence"
          value={
            total === 0 ? "—" : `${strongEvidence}/${total}`
          }
          hint="Backed by primary sources"
          tone={strongEvidence === total && total > 0 ? "success" : "info"}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-9">
          {total === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-4 w-4" />}
              title={
                approvedFindings.length === 0
                  ? "Approve findings before opportunity scoring begins."
                  : "No opportunities scored yet."
              }
              description={
                approvedFindings.length === 0
                  ? "Findings need consultant approval before they can be turned into opportunities. Open the findings workspace to review."
                  : "Approved findings are ready. Scoring opens once the consultant promotes findings into opportunities."
              }
              action={
                <Link href={findingsHref}>
                  <Button
                    variant="primary"
                    size="md"
                    trailingIcon={<ArrowRight className="h-4 w-4" />}
                  >
                    Open findings workspace
                  </Button>
                </Link>
              }
            />
          ) : (
            <OpportunitiesWorkspace
              engagementId={engagement.id}
              opportunities={opportunities}
              findings={findings}
            />
          )}

          <Card variant="base">
            <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                Boundary reminder
              </span>
              <p className="text-xs leading-relaxed text-text-muted">
                Scoring is directional and human-judgment based. Opportunities
                are validated during scoping, not auto-promoted into the
                roadmap. Report assembly and proposal generation arrive in
                Sprint 7.
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

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
import { CreateOpportunityForm } from "@/components/opportunities/create-opportunity-form";
import { GenerateOpportunitiesForm } from "@/components/opportunities/generate-opportunities-form";
import { RoadmapReadinessHint } from "@/components/opportunities/roadmap-readiness-hint";
import { EngagementContextCard } from "@/components/engagements/engagement-context-card";
import { EngagementRecommendedActionCard } from "@/components/engagements/engagement-recommended-action-card";
import { loadEngagementForSubroute } from "@/lib/engagements/load-for-subroute";
import { isAiConfigured } from "@/lib/ai/provider";
import { getOpportunitiesForEngagement } from "@/lib/opportunities/mock-opportunities";
import {
  getFindingCandidatesForEngagement,
  getFindingProvenanceForEngagement,
  getMinimalFindingsForEngagement,
  getOpportunitiesForEngagementPersisted,
} from "@/lib/opportunities/queries";
import {
  buildRoadmapReadinessSignal,
  summarizeOpportunityProvenance,
  type OpportunityProvenanceSummary,
} from "@/lib/opportunities/provenance";
import { getFindingsForEngagement } from "@/lib/findings/mock-findings";
import { recommendedActionRoute } from "@/lib/engagements/recommended-action";
import type { Opportunity } from "@/lib/opportunities/types";
import type { Finding } from "@/lib/findings/types";
import type { FindingProvenanceSummary } from "@/lib/findings/provenance";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) return { title: "Opportunities not found" };
  return {
    title: `${loaded.engagement.companyName} · Opportunity matrix`,
  };
}

export default async function EngagementOpportunitiesPage({
  params,
}: {
  params: { id: string };
}) {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) notFound();
  const engagement = loaded.engagement;
  const isPersisted = loaded.kind === "real";
  const aiConfigured = isPersisted && isAiConfigured();

  let opportunities: Opportunity[];
  let findings: Finding[];
  let findingCandidates: Awaited<
    ReturnType<typeof getFindingCandidatesForEngagement>
  > = [];
  let findingProvenanceById: Map<string, FindingProvenanceSummary> = new Map();

  if (isPersisted) {
    [opportunities, findings, findingCandidates, findingProvenanceById] =
      await Promise.all([
        getOpportunitiesForEngagementPersisted(engagement.id),
        getMinimalFindingsForEngagement(engagement.id),
        getFindingCandidatesForEngagement(engagement.id),
        getFindingProvenanceForEngagement(engagement.id),
      ]);
  } else {
    opportunities = getOpportunitiesForEngagement(engagement.id);
    findings = getFindingsForEngagement(engagement.id);
  }

  const approvedFindings = findings.filter(
    (f) => f.reviewStatus === "approved" || f.reviewStatus === "report-ready",
  );

  // Sprint S6 — Build opportunity-id → provenance summary map by
  // projecting each opportunity's `relatedFindingIds` against the
  // per-finding provenance map. Pure projection; no DB.
  const opportunityProvenanceById = new Map<
    string,
    OpportunityProvenanceSummary
  >();
  if (isPersisted) {
    for (const o of opportunities) {
      opportunityProvenanceById.set(
        o.id,
        summarizeOpportunityProvenance(
          o.relatedFindingIds,
          findingProvenanceById,
        ),
      );
    }
  }

  // Sprint S6 — S7 roadmap readiness signal, built purely from already-
  // fetched data. Operator-only hint; does NOT block S7.
  const roadmapReadinessSignal = isPersisted
    ? buildRoadmapReadinessSignal(
        opportunities.map((o) => ({
          status: o.status ?? null,
          evidenceStrength: o.evidenceStrength,
          quadrant: o.quadrant,
          provenance: opportunityProvenanceById.get(o.id) ?? null,
        })),
      )
    : null;

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
          value={total === 0 ? "—" : `${strongEvidence}/${total}`}
          hint="Backed by primary sources"
          tone={strongEvidence === total && total > 0 ? "success" : "info"}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-9">
          {isPersisted ? (
            <>
              <GenerateOpportunitiesForm
                engagementId={engagement.id}
                aiConfigured={aiConfigured}
                hasApprovedFindings={findingCandidates.length > 0}
              />
              <CreateOpportunityForm
                engagementId={engagement.id}
                findingCandidates={findingCandidates}
              />
              {/* Sprint S6 — S7 roadmap readiness signal. Read-only;
                  does not block S7 (S7 not yet built). */}
              {roadmapReadinessSignal ? (
                <RoadmapReadinessHint signal={roadmapReadinessSignal} />
              ) : null}
            </>
          ) : null}

          {total === 0 ? (
            isPersisted ? (
              <Card variant="base">
                <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
                  <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                    No opportunities yet
                  </span>
                  <p className="text-xs leading-relaxed text-text-muted">
                    Create opportunities from approved or report-ready
                    findings using the form above. Quadrant placement is
                    derived from impact + complexity + risk on save.
                  </p>
                  {findingCandidates.length === 0 ? (
                    <Link
                      href={findingsHref}
                      className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-brand-primary hover:underline"
                    >
                      Open findings workspace
                      <ArrowRight className="h-3 w-3" />
                    </Link>
                  ) : null}
                </CardBody>
              </Card>
            ) : (
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
            )
          ) : (
            <OpportunitiesWorkspace
              engagementId={engagement.id}
              opportunities={opportunities}
              findings={findings}
              provenanceById={
                isPersisted ? opportunityProvenanceById : undefined
              }
              actionMode={isPersisted ? "triage" : undefined}
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
                roadmap. AI opportunity generation and report assembly
                activate in later sprints.
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

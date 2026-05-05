import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, FileSignature } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LockedActionButton } from "@/components/ui/locked-action-button";
import { ProposalWorkspace } from "@/components/proposals/proposal-workspace";
import { ProposalStatusChip } from "@/components/proposals/proposal-status-chip";
import { ImplementationCreditPanel } from "@/components/proposals/implementation-credit-panel";
import { EngagementContextCard } from "@/components/engagements/engagement-context-card";
import { EngagementRecommendedActionCard } from "@/components/engagements/engagement-recommended-action-card";
import { loadEngagementForSubroute } from "@/lib/engagements/load-for-subroute";
import { getProposalForEngagement } from "@/lib/proposals/mock-proposals";
import { getOpportunitiesForEngagement } from "@/lib/opportunities/mock-opportunities";
import { getRoadmapForEngagement } from "@/lib/roadmap/mock-roadmap";
import { getReportForEngagement } from "@/lib/reports/mock-reports";
import {
  recommendedActionLabel,
  recommendedActionRoute,
} from "@/lib/engagements/recommended-action";
import { EngagementPersistencePlaceholder } from "@/components/engagements/persistence-placeholder";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) return { title: "Proposal not found" };
  return {
    title: `${loaded.engagement.companyName} · Proposal & SOW options`,
  };
}

export default async function EngagementProposalPage({
  params,
}: {
  params: { id: string };
}) {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) notFound();
  const engagement = loaded.engagement;

  if (loaded.kind === "real") {
    return (
      <EngagementPersistencePlaceholder
        engagement={engagement}
        eyebrow="AdvisoryOps · Proposal"
        title="Proposal & SOW options."
        description="Tiered SOW options (Quick-Win Build, AI Workflow System, Managed AI Partner) with implementation credit and pricing placeholders."
        activatesIn="Step 8 · Proposal persistence"
        currentPath={`/app/engagements/${engagement.id}/proposal`}
      />
    );
  }

  const proposal = getProposalForEngagement(engagement.id);
  const opportunities = getOpportunitiesForEngagement(engagement.id);
  const roadmap = getRoadmapForEngagement(engagement.id);
  const report = getReportForEngagement(engagement.id);

  const reportHref = `/app/engagements/${engagement.id}/report`;
  const recAction = recommendedActionRoute(
    engagement,
    `/app/engagements/${engagement.id}/proposal`,
  );

  const includedOpportunityIds = new Set(
    proposal?.options.flatMap((o) => o.includedOpportunityIds) ?? [],
  );
  const quickWinsIncluded = opportunities.filter(
    (o) => includedOpportunityIds.has(o.id) && o.quadrant === "quick-win",
  ).length;
  const strategicIncluded = opportunities.filter(
    (o) =>
      includedOpportunityIds.has(o.id) && o.quadrant === "strategic-build",
  ).length;
  const totalDeps =
    proposal?.options.reduce((sum, o) => sum + o.dependencies.length, 0) ?? 0;
  const recommendedOption =
    proposal?.options.find((o) => o.id === proposal?.recommendedOptionId) ??
    null;

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageHeader
        eyebrow="AdvisoryOps · Proposal"
        title="Proposal / SOW options."
        description="Turn approved recommendations into clear implementation paths, assumptions, and next-step options."
        actions={
          <>
            <Link href={reportHref}>
              <Button
                variant="secondary"
                size="md"
                leadingIcon={<ArrowLeft className="h-4 w-4" />}
              >
                Back to Report
              </Button>
            </Link>
            <LockedActionButton
              label="Prepare Client Review"
              lockedNote="Mock"
            />
          </>
        }
        meta={
          <>
            <Badge tone="ai" dot>
              {engagement.companyName} · {engagement.engagementType}
            </Badge>
            {proposal ? (
              <ProposalStatusChip status={proposal.status} />
            ) : null}
            <span className="text-text-muted">
              Pricing is placeholder · validate scope before quoting
            </span>
            <span className="text-text-disabled">·</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
              Sprint 7 · Mock data
            </span>
          </>
        }
      />

      <section
        aria-label="Proposal summary"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      >
        <MetricCard
          label="Options"
          value={proposal ? String(proposal.options.length) : "—"}
          hint={proposal ? "Tiered SOW options" : "Awaiting report"}
          tone="info"
        />
        <MetricCard
          label="Recommended"
          value={recommendedOption ? "1" : "—"}
          hint={
            recommendedOption?.title.split(" ").slice(0, 3).join(" ") ??
            "Once report is approved"
          }
          tone={recommendedOption ? "success" : "neutral"}
        />
        <MetricCard
          label="Quick Wins Included"
          value={proposal ? String(quickWinsIncluded) : "—"}
          hint="From the opportunity matrix"
          tone="success"
        />
        <MetricCard
          label="Strategic Builds"
          value={proposal ? String(strategicIncluded) : "—"}
          hint="Multi-phase scoping"
          tone="info"
        />
        <MetricCard
          label="Dependencies"
          value={proposal ? String(totalDeps) : "—"}
          hint="Resolve before send"
          tone={totalDeps > 0 ? "warning" : "neutral"}
        />
        <MetricCard
          label="Implementation Credit"
          value={
            proposal?.implementationCredit.creditEligible ? "Eligible" : "—"
          }
          hint={proposal?.implementationCredit.creditWindow ?? "Mock lever"}
          tone={proposal?.implementationCredit.creditEligible ? "success" : "neutral"}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-9">
          {!proposal ? (
            <EmptyState
              icon={<FileSignature className="h-4 w-4" />}
              title="Build the report and roadmap before proposal options are assembled."
              description={
                recAction.lockedNote
                  ? "Proposal options pull from approved opportunities and the 30/60/90 roadmap. The next step in this engagement isn't yet wired."
                  : recAction.href === reportHref
                    ? "Proposal options pull from approved opportunities and the 30/60/90 roadmap. Once the report is at least half-approved, the option workspace populates here."
                    : "Proposal options pull from approved opportunities and the 30/60/90 roadmap. The engagement is still earlier in the workflow — pick up where the work currently is."
              }
              action={
                recAction.href ? (
                  <Link href={recAction.href}>
                    <Button
                      variant="primary"
                      size="md"
                      trailingIcon={<ArrowRight className="h-4 w-4" />}
                    >
                      {recommendedActionLabel(recAction.href)}
                    </Button>
                  </Link>
                ) : null
              }
            />
          ) : (
            <ProposalWorkspace
              proposal={proposal}
              opportunities={opportunities}
              roadmap={roadmap}
            />
          )}

          {proposal ? (
            <Card variant="base">
              <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                  Boundary reminder
                </span>
                <p className="text-xs leading-relaxed text-text-muted">
                  Proposal options are illustrative SOW shapes for the
                  commercial conversation. Pricing is placeholder; final
                  pricing depends on systems access, data readiness, and
                  implementation assumptions. Implementation credit is a
                  commercial planning lever — not an automatic discount or a
                  legally binding term.
                </p>
              </CardBody>
            </Card>
          ) : null}
        </div>

        <aside className="flex flex-col gap-6 lg:col-span-3">
          <EngagementRecommendedActionCard
            engagement={engagement}
            href={recAction.href}
            lockedNote={recAction.lockedNote}
            selfReference={recAction.selfReference}
          />

          {proposal ? (
            <ImplementationCreditPanel credit={proposal.implementationCredit} />
          ) : null}

          {report ? (
            <Card variant="base">
              <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                  Report readiness
                </span>
                <p className="text-xs leading-relaxed text-text-secondary">
                  {report.title} is currently{" "}
                  <span className="text-text-primary">{report.status}</span>.
                  Approved sections become the commercial conversation
                  anchors.
                </p>
                <Link
                  href={reportHref}
                  className="text-[11px] text-text-secondary underline-offset-2 hover:text-text-primary hover:underline"
                >
                  Open report
                </Link>
              </CardBody>
            </Card>
          ) : null}

          {proposal ? (
            <Card variant="base">
              <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                  Commercial assumptions
                </span>
                <ul className="flex flex-col gap-1.5 text-[11px] leading-relaxed text-text-secondary">
                  {proposal.assumptions.map((a, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span
                        aria-hidden
                        className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-warning"
                      />
                      {a}
                    </li>
                  ))}
                </ul>
              </CardBody>
            </Card>
          ) : null}

          <EngagementContextCard engagement={engagement} />
        </aside>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Sparkles } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { MetricCard } from "@/components/ui/metric-card";
import {
  FindingsWorkspace,
  ManualFindingPlaceholder,
} from "@/components/findings/findings-workspace";
import { EngagementContextCard } from "@/components/engagements/engagement-context-card";
import { EngagementRecommendedActionCard } from "@/components/engagements/engagement-recommended-action-card";
import { loadEngagementForSubroute } from "@/lib/engagements/load-for-subroute";
import { getFindingsForEngagement } from "@/lib/findings/mock-findings";
import { recommendedActionRoute } from "@/lib/engagements/recommended-action";
import { EngagementPersistencePlaceholder } from "@/components/engagements/persistence-placeholder";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) return { title: "Findings not found" };
  return { title: `${loaded.engagement.companyName} · Findings review` };
}

export default async function EngagementFindingsPage({
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
        eyebrow="AdvisoryOps · Findings"
        title="Findings review."
        description="Approve, edit, or reject AI-drafted findings before they enter scoring."
        activatesIn="Step 6 · Findings persistence"
        currentPath={`/app/engagements/${engagement.id}/findings`}
      />
    );
  }

  const findings = getFindingsForEngagement(engagement.id);

  const counts = {
    total: findings.length,
    needsReview: findings.filter((f) => f.reviewStatus === "needs-review").length,
    approved: findings.filter((f) => f.reviewStatus === "approved").length,
    rejected: findings.filter((f) => f.reviewStatus === "rejected").length,
    reportReady: findings.filter((f) => f.reviewStatus === "report-ready").length,
    lowEvidence: findings.filter(
      (f) => f.confidence === "low" || f.confidence === "needs-evidence",
    ).length,
  };

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageHeader
        eyebrow="AdvisoryOps · Findings"
        title="Findings review."
        description="Review AI-assisted findings before they become report-ready recommendations. Each finding is approved, edited, regenerated, or rejected by a consultant — never auto-promoted to the report."
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
            <Button
              variant="primary"
              size="md"
              leadingIcon={<Check className="h-4 w-4" />}
            >
              Approve selected
            </Button>
          </>
        }
        meta={
          <>
            <Badge tone="ai" dot>
              {engagement.companyName} · {engagement.engagementType}
            </Badge>
            <span className="text-text-muted">
              <Sparkles className="mr-1 inline h-3 w-3 text-practice-ai align-text-bottom" />
              AI-drafted · awaits human approval
            </span>
            <span className="text-text-disabled">·</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
              Sprint 5 · Mock data
            </span>
          </>
        }
      />

      <section
        aria-label="Findings summary"
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6"
      >
        <MetricCard
          label="Candidate Findings"
          value={String(counts.total)}
          hint="AI drafts in flight"
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
          hint="Cleared by consultant"
          tone="success"
        />
        <MetricCard
          label="Rejected"
          value={String(counts.rejected)}
          hint="Not advancing this sprint"
          tone="risk"
        />
        <MetricCard
          label="Report Ready"
          value={String(counts.reportReady)}
          hint="Locked for the audit report"
          tone="info"
        />
        <MetricCard
          label="Low Evidence"
          value={String(counts.lowEvidence)}
          hint="Single-source or unverified"
          tone={counts.lowEvidence > 0 ? "warning" : "neutral"}
        />
      </section>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-6 lg:col-span-9">
          <FindingsWorkspace findings={findings} />
          <ManualFindingPlaceholder />

          <Card variant="base">
            <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                Boundary reminder
              </span>
              <p className="text-xs leading-relaxed text-text-muted">
                AI-drafted findings are clearly labeled and require human
                approval before becoming report-ready. The consultant edits,
                approves, regenerates, or rejects each one. Report assembly
                and proposal generation arrive in Sprint 7.
              </p>
            </CardBody>
          </Card>
        </div>

        <aside className="flex flex-col gap-6 lg:col-span-3">
          {(() => {
            const route = recommendedActionRoute(
              engagement,
              `/app/engagements/${engagement.id}/findings`,
            );
            return (
              <EngagementRecommendedActionCard
                engagement={engagement}
                href={route.href}
                lockedNote={route.lockedNote}
                selfReference={route.selfReference}
              />
            );
          })()}
          <EngagementContextCard engagement={engagement} />
        </aside>
      </div>
    </div>
  );
}

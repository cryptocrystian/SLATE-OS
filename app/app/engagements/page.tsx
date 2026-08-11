import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Briefcase, Inbox } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { EngagementList } from "@/components/engagements/engagement-list";
import { getAllEngagements } from "@/lib/engagements/queries";

export const metadata: Metadata = {
  title: "Engagements",
};

export const dynamic = "force-dynamic";

export default async function EngagementsPage() {
  const engagements = await getAllEngagements();

  const total = engagements.length;
  const intakeInProgress = engagements.filter(
    (e) => e.currentStage === "intake",
  ).length;
  const findingsNeedReview = engagements.filter(
    (e) => e.findings.candidate > 0 && e.findings.approved === 0,
  ).length;
  const reportsInProgress = engagements.filter(
    (e) => e.currentStage === "report",
  ).length;
  const proposalsInDraft = engagements.filter(
    (e) => e.currentStage === "proposal",
  ).length;

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageHeader
        eyebrow="AdvisoryOps · Engagements"
        title="Engagements."
        description="Track AI Opportunity Sprints from setup through proposal without losing the thread between discovery, scoring, reporting, and implementation planning."
        actions={
          <>
            <Link href="/app/leads">
              <Button variant="secondary" size="md">
                Open Leads
              </Button>
            </Link>
          </>
        }
        meta={
          <>
            <Badge tone="ai" dot>
              AI Systems · AI Opportunity Sprint
            </Badge>
            <span className="text-text-muted">
              Setup through proposal, tracked in one workspace per engagement
            </span>
          </>
        }
      />

      <section
        aria-label="Engagement pipeline summary"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
      >
        <MetricCard
          label="Active Sprints"
          value={String(total)}
          hint="In flight across the team"
          tone="info"
        />
        <MetricCard
          label="Intake in Progress"
          value={String(intakeInProgress)}
          hint="Stakeholder discovery underway"
          tone="info"
        />
        <MetricCard
          label="Findings Need Review"
          value={String(findingsNeedReview)}
          hint="Awaiting consultant approval"
          tone="warning"
        />
        <MetricCard
          label="Reports In Progress"
          value={String(reportsInProgress)}
          hint="Sections being assembled"
          tone="neutral"
        />
        <MetricCard
          label="Proposals In Draft"
          value={String(proposalsInDraft)}
          hint="Tiered SOW being prepared"
          tone="info"
        />
      </section>

      <section aria-label="Engagement list" className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold tracking-tight text-text-primary">
            All engagements
          </h2>
          <p className="flex items-center gap-2 text-xs text-text-muted">
            <Inbox className="h-3.5 w-3.5" />
            {total} sprint{total === 1 ? "" : "s"} — current stage and next
            action obvious at a glance
          </p>
        </div>
        {total === 0 ? (
          <EmptyState
            icon={<Briefcase className="h-4 w-4" />}
            title="No engagements yet"
            description="Start an AI Opportunity Sprint from a qualified lead to create the first workspace."
            action={
              <Link href="/app/leads">
                <Button
                  variant="secondary"
                  size="sm"
                  trailingIcon={<ArrowRight className="h-3 w-3" />}
                >
                  Open Leads
                </Button>
              </Link>
            }
          />
        ) : (
          <EngagementList engagements={engagements} />
        )}
      </section>
    </div>
  );
}

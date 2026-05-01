import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Briefcase, Inbox } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { EngagementList } from "@/components/engagements/engagement-list";
import { MOCK_ENGAGEMENTS } from "@/lib/engagements/mock-engagements";

export const metadata: Metadata = {
  title: "Engagements",
};

export default function EngagementsPage() {
  const total = MOCK_ENGAGEMENTS.length;
  const intakeInProgress = MOCK_ENGAGEMENTS.filter(
    (e) => e.currentStage === "intake",
  ).length;
  const findingsNeedReview = MOCK_ENGAGEMENTS.filter(
    (e) => e.findings.candidate > 0 && e.findings.approved === 0,
  ).length;
  const reportsInProgress = MOCK_ENGAGEMENTS.filter(
    (e) => e.currentStage === "report",
  ).length;
  const proposalsInDraft = MOCK_ENGAGEMENTS.filter(
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
            <Button
              variant="primary"
              size="md"
              leadingIcon={<Briefcase className="h-4 w-4" />}
              trailingIcon={<ArrowRight className="h-4 w-4" />}
            >
              Review Active Sprints
            </Button>
          </>
        }
        meta={
          <>
            <Badge tone="ai" dot>
              AI Systems · AI Opportunity Sprint
            </Badge>
            <span className="text-text-muted">
              Engagement workspaces are seeded until persistence lands
            </span>
            <span className="text-text-disabled">·</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
              Sprint 4 · Mock data
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
        <EngagementList engagements={MOCK_ENGAGEMENTS} />
      </section>
    </div>
  );
}

import { ArrowRight, ClipboardCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { ReviewQueue } from "@/components/slate/review-queue";
import { ActiveEngagementsPanel } from "@/components/slate/active-engagements-panel";
import { RecentActivityPanel } from "@/components/slate/recent-activity-panel";
import {
  activeEngagements,
  dashboardMetrics,
  recentActivity,
  reviewQueue,
} from "@/lib/mock-data";

export const metadata: Metadata = {
  title: "Command Center",
};

export default function CommandCenterPage() {
  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageHeader
        eyebrow="Command Center"
        title="A live operating view of Saipien Labs."
        description="Scorecards, audits, reports, proposals, and next actions across every engagement — calm, structured, and ready for the next decision."
        actions={
          <Link href="/app/leads">
            <Button
              variant="primary"
              size="md"
              leadingIcon={<ClipboardCheck className="h-4 w-4" />}
              trailingIcon={<ArrowRight className="h-4 w-4" />}
            >
              Review New Leads
            </Button>
          </Link>
        }
        meta={
          <>
            <div className="flex items-center gap-2">
              <Badge tone="success" dot>
                System nominal
              </Badge>
              <span className="text-text-muted">All pipelines responsive</span>
            </div>
            <span className="text-text-disabled">·</span>
            <span>
              GrowthOps + AdvisoryOps active · BuildOps, StudioOps queued
            </span>
          </>
        }
      />

      <section
        aria-label="Pipeline summary"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-6"
      >
        {dashboardMetrics.map((metric) => (
          <MetricCard
            key={metric.id}
            label={metric.label}
            value={metric.value}
            delta={metric.delta}
            hint={metric.hint}
            tone={metric.tone}
          />
        ))}
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <ReviewQueue items={reviewQueue} />
        </div>
        <div className="flex flex-col gap-6">
          <ActiveEngagementsPanel engagements={activeEngagements} />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RecentActivityPanel events={recentActivity} />
        </div>
        <aside className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-bg-surface/60 p-5 sm:p-6">
          <div className="flex items-center gap-2">
            <Badge tone="ai" dot>
              Human-Guided AI
            </Badge>
          </div>
          <h3 className="text-sm font-semibold tracking-tight text-text-primary">
            How SLATE assists
          </h3>
          <ul className="flex flex-col gap-3 text-xs leading-relaxed text-text-secondary">
            <li className="flex gap-3">
              <span
                aria-hidden
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-practice-ai"
              />
              <span>
                AI drafts findings, opportunity scores, and report sections —
                always labeled and never final without consultant review.
              </span>
            </li>
            <li className="flex gap-3">
              <span
                aria-hidden
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-practice-ai"
              />
              <span>
                Confidence and evidence are surfaced before approval. Assumptions
                are visible so they can be challenged.
              </span>
            </li>
            <li className="flex gap-3">
              <span
                aria-hidden
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-practice-ai"
              />
              <span>
                The free scorecard identifies likely leverage areas. The paid
                Opportunity Sprint validates them with stakeholder evidence.
              </span>
            </li>
          </ul>
        </aside>
      </section>
    </div>
  );
}

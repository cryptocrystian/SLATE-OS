import type { Metadata } from "next";
import { ExternalLink, Inbox } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LeadList } from "@/components/leads/lead-list";
import { getAllLeads } from "@/lib/leads/queries";
import { fitCategoryFor } from "@/lib/leads/helpers";

export const metadata: Metadata = {
  title: "Leads",
};

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const leads = await getAllLeads();

  const total = leads.length;
  const newCount = leads.filter((l) => l.status === "new").length;
  const highFit = leads.filter((l) => l.status === "high-fit").length;
  const needsReview = leads.filter((l) => l.status === "needs-review").length;
  const diagnosticRequested = leads.filter(
    (l) => l.status === "diagnostic-requested",
  ).length;
  const nurture = leads.filter((l) => l.status === "nurture").length;

  const primeCount = leads.filter(
    (l) => fitCategoryFor(l.internalFitScore).id === "prime",
  ).length;

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageHeader
        eyebrow="GrowthOps · Leads"
        title="Lead inbox."
        description="Review scorecard completions, fit signals, and recommended next actions before a prospect enters a paid diagnostic."
        actions={
          <>
            <Link href="/scorecard" target="_blank" rel="noreferrer">
              <Button
                variant="secondary"
                size="md"
                trailingIcon={<ExternalLink className="h-3.5 w-3.5" />}
              >
                Open public scorecard
              </Button>
            </Link>
          </>
        }
        meta={
          <>
            <Badge tone="success" dot>
              <span>
                {primeCount} Prime Candidate{primeCount === 1 ? "" : "s"}
              </span>
            </Badge>
            <span className="text-text-muted">
              Internal Saipien Fit Score is operator-only — never shown to
              prospects
            </span>
          </>
        }
      />

      <section
        aria-label="Lead pipeline summary"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5"
      >
        <MetricCard
          label="New"
          value={String(newCount)}
          hint="Awaiting first triage"
          tone="info"
        />
        <MetricCard
          label="High Fit"
          value={String(highFit)}
          hint="Move to Diagnostic Review"
          tone="success"
        />
        <MetricCard
          label="Needs Review"
          value={String(needsReview)}
          hint="Validate budget or buyer"
          tone="warning"
        />
        <MetricCard
          label="Diagnostic Requested"
          value={String(diagnosticRequested)}
          hint="Application in flight"
          tone="info"
        />
        <MetricCard
          label="Nurture"
          value={String(nurture)}
          hint="Re-evaluate next quarter"
          tone="neutral"
        />
      </section>

      <section
        aria-label="Lead list"
        className="flex flex-col gap-4"
      >
        <div className="flex flex-col gap-1">
          <h2 className="text-sm font-semibold tracking-tight text-text-primary">
            All leads
          </h2>
          <p className="text-xs text-text-muted">
            {total} scorecard completion{total === 1 ? "" : "s"} · best leads
            should be obvious at a glance
          </p>
        </div>
        {total === 0 ? (
          <EmptyState
            icon={<Inbox className="h-4 w-4" />}
            title="No scorecard submissions yet"
            description="When someone completes the AI Workflow Scorecard, their lead record will appear here for review."
            action={
              <Link href="/scorecard" target="_blank" rel="noreferrer">
                <Button
                  variant="secondary"
                  size="sm"
                  trailingIcon={<ExternalLink className="h-3 w-3" />}
                >
                  Open public scorecard
                </Button>
              </Link>
            }
          />
        ) : (
          <LeadList leads={leads} />
        )}
      </section>
    </div>
  );
}

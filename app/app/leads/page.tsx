import type { Metadata } from "next";
import { ArrowRight, ClipboardCheck, ExternalLink } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MetricCard } from "@/components/ui/metric-card";
import { LeadList } from "@/components/leads/lead-list";
import { MOCK_LEADS } from "@/lib/leads/mock-leads";
import { fitCategoryFor } from "@/lib/leads/helpers";

export const metadata: Metadata = {
  title: "Leads",
};

export default function LeadsPage() {
  const total = MOCK_LEADS.length;
  const newCount = MOCK_LEADS.filter((l) => l.status === "new").length;
  const highFit = MOCK_LEADS.filter((l) => l.status === "high-fit").length;
  const needsReview = MOCK_LEADS.filter(
    (l) => l.status === "needs-review",
  ).length;
  const diagnosticRequested = MOCK_LEADS.filter(
    (l) => l.status === "diagnostic-requested",
  ).length;
  const nurture = MOCK_LEADS.filter((l) => l.status === "nurture").length;

  const primeCount = MOCK_LEADS.filter(
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
            <Button
              variant="primary"
              size="md"
              leadingIcon={<ClipboardCheck className="h-4 w-4" />}
              trailingIcon={<ArrowRight className="h-4 w-4" />}
            >
              Review High-Fit Leads
            </Button>
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
            <span className="text-text-disabled">·</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
              Sprint 3 · Mock data
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
            {total} scorecard completions · best leads should be obvious at a
            glance
          </p>
        </div>
        <LeadList leads={MOCK_LEADS} />
      </section>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ReportPrintDocument } from "@/components/reports/report-print-document";
import { loadEngagementForSubroute } from "@/lib/engagements/load-for-subroute";
import { getFindingsForEngagementPersisted } from "@/lib/findings/queries";
import { getIntakeRecordForEngagement } from "@/lib/intake/queries";
import { getOpportunitiesForEngagementPersisted } from "@/lib/opportunities/queries";
import { getReportForEngagementPersisted } from "@/lib/reports/queries";
import { getRoadmapForEngagementPersisted } from "@/lib/roadmap/queries";
import { isGroupAReportSlot } from "@/lib/reports/slot-map";
import { capabilityMaturityFromFindings } from "@/lib/charts/adapters/capability-maturity-heatmap-adapter";
import { executiveSummaryPortfolioFromOpportunities } from "@/lib/charts/adapters/executive-summary-2x2-adapter";
import { risksFromOpportunities } from "@/lib/charts/adapters/risk-adjusted-priority-quadrant-adapter";
import { roadmapGanttFromRoadmapItems } from "@/lib/charts/adapters/roadmap-gantt-adapter";
import { stakeholderCoverageFromIntake } from "@/lib/charts/adapters/stakeholder-coverage-matrix-adapter";
import {
  latestIsoTimestamp,
  type ReportExhibitSlot,
} from "@/lib/charts/adapters/types";

/**
 * Internal report print preview — Sprint 3.
 *
 * Operator-only, persisted-engagement-only. Reuses the same query
 * helpers, adapter pipeline, and `<ReportExhibitSlots>` renderer as
 * `/app/engagements/[id]/report` — but laid out for review-quality
 * print via the browser's native "Save as PDF" dialog.
 *
 *   - Auth: `/app/*` middleware gates access. No public route.
 *   - Mock / legacy slug engagements render an explanatory empty
 *     state. The print pipeline is real-data only.
 *   - No writes. No mutations. No AI calls. No new query helpers.
 *   - Group B exhibits (Benchmark / Waterfall / ROI Bridge) are
 *     NOT imported and NOT rendered. They remain preview-only at
 *     `/app/charts-preview` until `docs/14` / `docs/15` advance.
 *   - The `<LockedActionButton>` controls for client-facing export /
 *     SOW / send are unchanged on the parent report page; this route
 *     adds an *internal* preview path that exists alongside them.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) return { title: "Report print preview not found" };
  return {
    title: `${loaded.engagement.companyName} · Report · Internal print preview`,
  };
}

export default async function EngagementReportPrintPage({
  params,
}: {
  params: { id: string };
}) {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) notFound();
  const engagement = loaded.engagement;
  const isPersisted = loaded.kind === "real";

  const engagementHref = `/app/engagements/${engagement.id}`;
  const reportHref = `/app/engagements/${engagement.id}/report`;

  // Print preview is real-data only. Mock / legacy slug engagements
  // render an explanatory empty state. The internal preview must not
  // operate over fixture data.
  if (!isPersisted) {
    return (
      <div className="slate-print-light flex flex-col gap-6 px-2 py-4 print:hidden print:bg-white print:p-0 sm:px-4">
        <BackToReportLink reportHref={reportHref} />
        <EmptyState
          title="Internal print preview is only available for persisted engagements."
          description="This route renders persisted engagement rows through the same adapter pipeline as the internal report preview. Legacy demo engagements (slug-keyed fixtures) do not flow through the persisted query helpers."
        />
      </div>
    );
  }

  // Generated-at clock token is captured ONCE so every adapter
  // shares the same wall-clock reference. Adapters themselves remain
  // pure; they do not call Date.now().
  const generatedAt = new Date().toISOString();

  const [report, findings, opportunities, roadmap, intakeRecord] =
    await Promise.all([
      getReportForEngagementPersisted(engagement.id),
      getFindingsForEngagementPersisted(engagement.id),
      getOpportunitiesForEngagementPersisted(engagement.id),
      getRoadmapForEngagementPersisted(engagement.id),
      getIntakeRecordForEngagement(engagement.id),
    ]);

  if (!report) {
    return (
      <div className="slate-print-light flex flex-col gap-6 px-2 py-4 print:hidden print:bg-white print:p-0 sm:px-4">
        <BackToReportLink reportHref={reportHref} />
        <Card variant="base">
          <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Report not initialized
            </span>
            <p className="text-sm leading-relaxed text-text-secondary">
              Initialize the report outline before opening the internal print preview. Persisted sections + exhibit slots populate after the operator runs <code className="font-mono">Initialize report outline</code>.
            </p>
            <div className="pt-2">
              <Link href={reportHref}>
                <Button variant="secondary" size="sm">
                  Open the report page
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Same adapter pipeline as the internal report preview — every
  // domain timestamp surfaced through `lib/<domain>/mappers.ts` flows
  // into the adapter freshness envelope (Sprint 2.1).
  const opportunitiesLastTouched = latestIsoTimestamp(
    opportunities.map((o) => o.updatedAt),
  );
  const findingsLastTouched = latestIsoTimestamp(
    findings.flatMap((f) => [f.updatedAt, f.lastReviewedAt]),
  );
  const stakeholdersLastTouched = latestIsoTimestamp(
    (intakeRecord?.stakeholders ?? []).map((s) => s.lastActivityAt),
  );
  const roadmapLastTouched = latestIsoTimestamp(
    roadmap.map((r) => r.updatedAt),
  );

  const exhibitSlotResults = {
    executiveSummary: executiveSummaryPortfolioFromOpportunities({
      opportunities,
      generatedAt,
      lastTouchedAt: opportunitiesLastTouched,
    }),
    riskPriority: risksFromOpportunities({
      opportunities,
      generatedAt,
      lastTouchedAt: opportunitiesLastTouched,
    }),
    capabilityMaturity: capabilityMaturityFromFindings({
      findings,
      capabilities: [],
      dimensions: [],
      generatedAt,
      lastTouchedAt: findingsLastTouched,
    }),
    stakeholderCoverage: stakeholderCoverageFromIntake({
      stakeholders: intakeRecord?.stakeholders ?? [],
      roles: Array.from(
        new Set(
          (intakeRecord?.stakeholders ?? []).map(
            (s) => s.role as unknown as string,
          ),
        ),
      ),
      topics: [],
      generatedAt,
      lastTouchedAt: stakeholdersLastTouched,
    }),
    roadmap: roadmapGanttFromRoadmapItems({
      items: roadmap,
      generatedAt,
      lastTouchedAt: roadmapLastTouched,
    }),
  };

  // Drive slot order from persisted `report_sections.exhibit_slot` —
  // never from the static `GROUP_A_REPORT_SLOTS` table. Re-filter
  // through `isGroupAReportSlot` for defense-in-depth (the SQL
  // CHECK + read-path coercion already enforce this).
  const persistedSlotsInOrder: ReportExhibitSlot[] = report.sections
    .map((s) => s.exhibitSlot)
    .filter((slot): slot is ReportExhibitSlot => isGroupAReportSlot(slot));

  return (
    <div className="slate-print-light flex flex-col gap-6 px-2 py-4 print:bg-white print:p-0 sm:px-4 print:sm:px-0">
      <BackToReportLink reportHref={reportHref} />

      <ReportPrintDocument
        engagement={engagement}
        report={report}
        generatedAt={generatedAt}
        slots={persistedSlotsInOrder}
        executiveSummary={exhibitSlotResults.executiveSummary}
        riskPriority={exhibitSlotResults.riskPriority}
        capabilityMaturity={exhibitSlotResults.capabilityMaturity}
        stakeholderCoverage={exhibitSlotResults.stakeholderCoverage}
        roadmap={exhibitSlotResults.roadmap}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// On-screen-only back link
// ---------------------------------------------------------------------------

/**
 * Back-to-report link rendered only on-screen. `print:hidden` keeps it
 * out of the printed output so the document starts at the internal
 * preview banner.
 */
function BackToReportLink({ reportHref }: { reportHref: string }) {
  return (
    <div className="print:hidden">
      <Link href={reportHref}>
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<ArrowLeft className="h-3.5 w-3.5" />}
        >
          Back to report
        </Button>
      </Link>
    </div>
  );
}

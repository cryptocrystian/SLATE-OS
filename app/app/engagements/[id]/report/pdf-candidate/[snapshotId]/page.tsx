import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ReportPdfCandidateDocument } from "@/components/reports/report-pdf-candidate-document";
import { ClientReportDeliverable } from "@/components/reports/client-report-deliverable";
import { ViewerModeToggle } from "@/components/reports/viewer-mode-toggle";
import { viewerModeFromSearchParam } from "@/components/reports/viewer-mode";
import type { ReportGroupAExhibitResults } from "@/components/reports/report-group-a-exhibits";
import { loadEngagementForSubroute } from "@/lib/engagements/load-for-subroute";
import { getReportDeliverySnapshotById } from "@/lib/reports/delivery-snapshot-queries";
import { getFindingsForEngagementPersisted } from "@/lib/findings/queries";
import { getIntakeRecordForEngagement } from "@/lib/intake/queries";
import { getOpportunitiesForEngagementPersisted } from "@/lib/opportunities/queries";
import { getRoadmapForEngagementPersisted } from "@/lib/roadmap/queries";
import { capabilityMaturityFromFindings } from "@/lib/charts/adapters/capability-maturity-heatmap-adapter";
import { executiveSummaryPortfolioFromOpportunities } from "@/lib/charts/adapters/executive-summary-2x2-adapter";
import { risksFromOpportunities } from "@/lib/charts/adapters/risk-adjusted-priority-quadrant-adapter";
import { roadmapGanttFromRoadmapItems } from "@/lib/charts/adapters/roadmap-gantt-adapter";
import { stakeholderCoverageFromIntake } from "@/lib/charts/adapters/stakeholder-coverage-matrix-adapter";
import { latestIsoTimestamp } from "@/lib/charts/adapters/types";

/**
 * Phase 1B Sprint 4C-B — operator-only report PDF candidate route.
 *
 * Sprint Presentation Pass 2 (docs/61 § 7.A + 7.B + 7.F):
 *   - Reads the `?mode=client` search param to flip the document into
 *     client-facing render (strips UUIDs, claim-guard scan metadata,
 *     generated-by label, snapshot id footer; softens banner copy).
 *   - Loads the same engagement data shape that the print preview
 *     loads (findings / opportunities / roadmap / intake) so the
 *     Group-A live exhibits render inline alongside the snapshot.
 *   - Group-B exhibits remain gated (slot map enforces split; the new
 *     Group-A exhibit component never imports a Group-B SVG).
 *
 * Boundaries (unchanged):
 *   - `/app/*` middleware gates access. No public route.
 *   - Persisted UUID engagement only.
 *   - Snapshot must belong to the engagement in the URL — otherwise 404.
 *   - No writes. No AI calls. No public bucket. No share token.
 */

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: { id: string; snapshotId: string };
}): Promise<Metadata> {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) return { title: "Report PDF candidate not found" };
  return {
    title: `${loaded.engagement.companyName} · Report PDF candidate`,
  };
}

export default async function ReportPdfCandidatePage({
  params,
  searchParams,
}: {
  params: { id: string; snapshotId: string };
  searchParams: { mode?: string | string[] };
}) {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) notFound();
  const engagement = loaded.engagement;
  const isPersisted = loaded.kind === "real";

  const reportHref = `/app/engagements/${engagement.id}/report`;
  const viewerMode = viewerModeFromSearchParam(searchParams.mode);

  if (!isPersisted) {
    return (
      <div className="slate-print-light flex flex-col gap-6 px-2 py-4 print:hidden print:bg-white print:p-0 sm:px-4">
        <PageChrome reportHref={reportHref} />
        <Card variant="base">
          <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Candidate snapshots are persisted-engagement only
            </span>
            <p className="text-sm leading-relaxed text-text-secondary">
              The PDF candidate route renders persisted{" "}
              <code className="font-mono">report_delivery_snapshots</code>{" "}
              rows. Legacy demo engagements do not flow through the
              snapshot pipeline.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const snapshot = await getReportDeliverySnapshotById(params.snapshotId);
  if (!snapshot) {
    return (
      <div className="slate-print-light flex flex-col gap-6 px-2 py-4 print:hidden print:bg-white print:p-0 sm:px-4">
        <PageChrome reportHref={reportHref} />
        <Card variant="base">
          <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Snapshot not found
            </span>
            <p className="text-sm leading-relaxed text-text-secondary">
              No candidate snapshot matches that id, or it belongs to a
              different workspace. Generate a new candidate from the
              report page.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  // Defense-in-depth: ensure the snapshot really belongs to the URL
  // engagement. RLS already gates by workspace, but the per-engagement
  // check protects against the operator landing on a snapshot from a
  // sibling engagement via guessable URL.
  if (snapshot.engagementId !== engagement.id) {
    notFound();
  }

  // Sprint Presentation Pass 2 (docs/61 § 7.A) — same parallel data
  // load as `/app/.../report/print`. Group-A live exhibits render from
  // current engagement data; Group-B exhibits remain gated.
  const generatedAt = new Date().toISOString();
  const [findings, opportunities, roadmap, intakeRecord] = await Promise.all([
    getFindingsForEngagementPersisted(engagement.id),
    getOpportunitiesForEngagementPersisted(engagement.id),
    getRoadmapForEngagementPersisted(engagement.id),
    getIntakeRecordForEngagement(engagement.id),
  ]);

  const opportunitiesLastTouched = latestIsoTimestamp(
    opportunities.map((o) => o.updatedAt),
  );
  const findingsLastTouched = latestIsoTimestamp(
    findings.flatMap((f) => [f.updatedAt, f.lastReviewedAt]),
  );
  const stakeholdersLastTouched = latestIsoTimestamp(
    (intakeRecord?.stakeholders ?? []).map((s) => s.lastActivityAt),
  );
  const roadmapLastTouched = latestIsoTimestamp(roadmap.map((r) => r.updatedAt));

  const liveExhibits: ReportGroupAExhibitResults = {
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

  return (
    <div className="slate-print-light flex flex-col gap-6 px-2 py-4 print:bg-white print:p-0 sm:px-4 print:sm:px-0">
      <PageChrome reportHref={reportHref} />

      {viewerMode === "client-facing" ? (
        <ClientReportDeliverable
          engagement={engagement}
          snapshot={snapshot}
          liveExhibits={liveExhibits}
        />
      ) : (
        <ReportPdfCandidateDocument
          engagement={engagement}
          snapshot={snapshot}
          viewerMode={viewerMode}
          liveExhibits={liveExhibits}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// On-screen-only operator chrome (back link + viewer-mode toggle)
// ---------------------------------------------------------------------------

function PageChrome({ reportHref }: { reportHref: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
      <Link href={reportHref}>
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<ArrowLeft className="h-3.5 w-3.5" />}
        >
          Back to report
        </Button>
      </Link>
      <ViewerModeToggle label="Report viewer mode" />
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ReportPdfCandidateDocument } from "@/components/reports/report-pdf-candidate-document";
import { loadEngagementForSubroute } from "@/lib/engagements/load-for-subroute";
import { getReportDeliverySnapshotById } from "@/lib/reports/delivery-snapshot-queries";

/**
 * Phase 1B Sprint 4C-B — operator-only report PDF candidate route.
 *
 * Loads a `report_delivery_snapshots` row and renders the snapshot
 * payload as a print-ready artifact. The render is wrapped in the
 * Sprint 4B `.slate-print-light` CSS-variable scope so chart-token
 * colors fall back to the print-safe palette.
 *
 * Boundaries:
 *   - `/app/*` middleware gates access. No public route.
 *   - Persisted UUID engagement only. Mock / legacy slug paths render
 *     an explanatory empty state.
 *   - Snapshot must belong to the engagement in the URL — otherwise
 *     404. Defense-in-depth against guessable snapshot ids.
 *   - No live data is fetched here beyond the engagement summary and
 *     the snapshot itself. The artifact reads from `section_snapshot`
 *     / `exhibit_snapshot` / `omitted_exhibits` etc. exclusively.
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
}: {
  params: { id: string; snapshotId: string };
}) {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) notFound();
  const engagement = loaded.engagement;
  const isPersisted = loaded.kind === "real";

  const reportHref = `/app/engagements/${engagement.id}/report`;

  if (!isPersisted) {
    return (
      <div className="slate-print-light flex flex-col gap-6 px-2 py-4 print:hidden print:bg-white print:p-0 sm:px-4">
        <BackLink reportHref={reportHref} />
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
        <BackLink reportHref={reportHref} />
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

  return (
    <div className="slate-print-light flex flex-col gap-6 px-2 py-4 print:bg-white print:p-0 sm:px-4 print:sm:px-0">
      <BackLink reportHref={reportHref} />

      <ReportPdfCandidateDocument
        engagement={engagement}
        snapshot={snapshot}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// On-screen-only back link
// ---------------------------------------------------------------------------

function BackLink({ reportHref }: { reportHref: string }) {
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

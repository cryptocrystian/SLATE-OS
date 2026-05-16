import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { ProposalCandidateDocument } from "@/components/proposals/proposal-candidate-document";
import { loadEngagementForSubroute } from "@/lib/engagements/load-for-subroute";
import { getProposalDeliverySnapshotById } from "@/lib/proposals/delivery-snapshot-queries";

/**
 * Phase 1B Proposal/SOW Delivery Sprint P3 — operator-only internal
 * proposal candidate route.
 *
 * Loads a `proposal_delivery_snapshots` row and renders the snapshot
 * payload as a print-ready artifact for operator review. The render
 * is wrapped in the Sprint 4B `.slate-print-light` CSS-variable scope
 * so the light/print palette inherits when the operator drives the
 * browser's Save-as-PDF.
 *
 * Boundaries:
 *   - `/app/*` middleware gates access. No public route.
 *   - Persisted UUID engagement only. Mock / legacy slug paths render
 *     an explanatory empty state.
 *   - Snapshot must belong to the engagement in the URL — otherwise
 *     404. Defense-in-depth against guessable snapshot ids.
 *   - No live data is fetched here beyond the engagement summary and
 *     the snapshot itself. The artifact reads from `option_snapshot`
 *     / `source_context_snapshot` / `commercial_guard_result` /
 *     `omitted_content` jsonb exclusively.
 *   - No writes. No AI calls. No public bucket. No share token.
 *   - No SOW/e-signature/Send-to-Client surface.
 */

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const fetchCache = "force-no-store";

export async function generateMetadata({
  params,
}: {
  params: { id: string; snapshotId: string };
}): Promise<Metadata> {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) return { title: "Proposal candidate not found" };
  return {
    title: `${loaded.engagement.companyName} · Proposal candidate`,
  };
}

export default async function ProposalCandidatePage({
  params,
}: {
  params: { id: string; snapshotId: string };
}) {
  const loaded = await loadEngagementForSubroute(params.id);
  if (!loaded) notFound();
  const engagement = loaded.engagement;
  const isPersisted = loaded.kind === "real";

  const proposalHref = `/app/engagements/${engagement.id}/proposal`;

  if (!isPersisted) {
    return (
      <div className="slate-print-light flex flex-col gap-6 px-2 py-4 print:hidden print:bg-white print:p-0 sm:px-4">
        <BackLink proposalHref={proposalHref} />
        <Card variant="base">
          <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Proposal candidate snapshots are persisted-engagement only
            </span>
            <p className="text-sm leading-relaxed text-text-secondary">
              The proposal candidate route renders persisted{" "}
              <code className="font-mono">proposal_delivery_snapshots</code>{" "}
              rows. Legacy demo engagements do not flow through the
              snapshot pipeline.
            </p>
          </CardBody>
        </Card>
      </div>
    );
  }

  const snapshot = await getProposalDeliverySnapshotById(params.snapshotId);
  if (!snapshot) {
    return (
      <div className="slate-print-light flex flex-col gap-6 px-2 py-4 print:hidden print:bg-white print:p-0 sm:px-4">
        <BackLink proposalHref={proposalHref} />
        <Card variant="base">
          <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Snapshot not found
            </span>
            <p className="text-sm leading-relaxed text-text-secondary">
              No proposal candidate snapshot matches that id, or it belongs
              to a different workspace. Generate a new candidate from the
              proposal page.
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
      <BackLink proposalHref={proposalHref} />

      <ProposalCandidateDocument
        engagement={engagement}
        snapshot={snapshot}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// On-screen-only back link
// ---------------------------------------------------------------------------

function BackLink({ proposalHref }: { proposalHref: string }) {
  return (
    <div className="print:hidden">
      <Link href={proposalHref}>
        <Button
          variant="ghost"
          size="sm"
          leadingIcon={<ArrowLeft className="h-3.5 w-3.5" />}
        >
          Back to proposal
        </Button>
      </Link>
    </div>
  );
}

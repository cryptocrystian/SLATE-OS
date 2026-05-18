import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import { SowDraftDocument } from "@/components/proposals/sow-draft-document";
import { loadEngagementForSubroute } from "@/lib/engagements/load-for-subroute";
import { getProposalDeliverySnapshotById } from "@/lib/proposals/delivery-snapshot-queries";

/**
 * Phase 1B SOW Draft Sprint P6-C — operator-only internal SOW Draft
 * route.
 *
 * Loads a `proposal_delivery_snapshots` row whose `delivery_surface`
 * is `sow_draft_candidate` and renders the snapshot payload as a
 * print-ready artifact for operator review. The render is wrapped in
 * the Sprint 4B `.slate-print-light` CSS-variable scope so the
 * light/print palette inherits when the operator drives the browser's
 * Save-as-PDF.
 *
 * Boundaries:
 *   - `/app/*` middleware gates access. No public route.
 *   - Persisted UUID engagement only. Mock / legacy slug paths render
 *     an explanatory empty state.
 *   - Snapshot must belong to the engagement in the URL — otherwise
 *     404. Defense-in-depth against guessable snapshot ids.
 *   - Snapshot's `delivery_surface` must be `sow_draft_candidate` —
 *     otherwise 404. Defense-in-depth against linking a Proposal
 *     Candidate snapshot id at this route by mistake (the operator
 *     should land on `/proposal/candidate/...` instead).
 *   - No live data is fetched here beyond the engagement summary and
 *     the snapshot itself. The artifact reads from `option_snapshot`
 *     / `source_context_snapshot.sowDraft` / `commercial_guard_result`
 *     / `omitted_content` jsonb exclusively.
 *   - No writes. No AI calls. No public bucket. No share token.
 *   - No public SOW share route exists in Sprint P6.
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
  if (!loaded) return { title: "SOW Draft not found" };
  return {
    title: `${loaded.engagement.companyName} · SOW Draft`,
  };
}

export default async function SowDraftPage({
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
              SOW Draft snapshots are persisted-engagement only
            </span>
            <p className="text-sm leading-relaxed text-text-secondary">
              The SOW Draft route renders persisted{" "}
              <code className="font-mono">proposal_delivery_snapshots</code>{" "}
              rows whose <code className="font-mono">delivery_surface</code>{" "}
              is <code className="font-mono">sow_draft_candidate</code>.
              Legacy demo engagements do not flow through the snapshot
              pipeline.
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
              SOW Draft not found
            </span>
            <p className="text-sm leading-relaxed text-text-secondary">
              No SOW Draft snapshot matches that id, or it belongs to a
              different workspace. Generate a new SOW Draft from the
              Past SOW Drafts panel on the proposal page.
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

  // Defense-in-depth: ensure the snapshot is a SOW Draft surface.
  // Linking a Proposal Candidate id at this route would otherwise
  // render Proposal-Candidate content with SOW-Draft chrome, which
  // breaks both the canon-mandated SOW markings and the operator's
  // ability to find the right snapshot.
  if (snapshot.deliverySurface !== "sow_draft_candidate") {
    notFound();
  }

  return (
    <div className="slate-print-light flex flex-col gap-6 px-2 py-4 print:bg-white print:p-0 sm:px-4 print:sm:px-0">
      <BackLink proposalHref={proposalHref} />

      <SowDraftDocument engagement={engagement} snapshot={snapshot} />
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

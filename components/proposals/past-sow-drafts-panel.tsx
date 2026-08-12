import * as React from "react";
import Link from "next/link";
import {
  ExternalLink,
  FileSignature,
  History,
  ShieldAlert,
  ShieldCheck,
  Slash,
} from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getProposalDeliverySnapshotsForProposal } from "@/lib/proposals/delivery-snapshot-queries";
import type {
  ProposalApprovalState,
  ProposalDeliverySnapshot,
  ProposalDeliverySnapshotStatus,
  ProposalPricingReviewState,
} from "@/lib/proposals/delivery-snapshot-types";
import { GenerateSowDraftButton } from "./generate-sow-draft-button";
import { VoidSowDraftButton } from "./void-sow-draft-button";

/**
 * Phase 1B SOW Draft Sprint P6-C — operator-only Past SOW Drafts
 * panel.
 *
 * Read-only list of `proposal_delivery_snapshots` rows whose
 * `delivery_surface='sow_draft_candidate'`, with per-row void
 * affordances and a header action to mint a new SOW Draft. Pure
 * server component — the list fetches via
 * `getProposalDeliverySnapshotsForProposal` which runs through the
 * cookie-bound RLS boundary; non-operator sessions never see snapshot
 * rows.
 *
 * The Generate SOW Draft button needs the latest approved Proposal
 * Candidate to derive from. The panel fetches the full snapshot list
 * (proposal candidates + SOW drafts are stored in the same table),
 * picks the latest non-voided + approved + `client_proposal_candidate`
 * snapshot as the source, then filters the rendered list to SOW Draft
 * surfaces only. When no eligible source exists, the Generate button
 * renders disabled with a help string.
 *
 * Boundaries:
 *   - No public link. No public SOW share route in Sprint P6.
 *   - No client delivery. No `Send to Client` unlock.
 *   - No PDF binary; the panel links to the internal SOW Draft route
 *     which itself renders snapshot-pure metadata.
 *   - Voided snapshots stay in the list (not deleted) and are visibly
 *     marked. The audit trail is preserved.
 *   - No SOW-side approval action in P6-C — the approval surface for
 *     SOW Drafts is reserved for a future sprint when a commercial
 *     approval workflow exists. The draft watermark always shows
 *     until that workflow lands.
 *   - No e-sign, sign, accept, or agree controls.
 */

export interface PastSowDraftsPanelProps {
  engagementId: string;
  proposalId: string;
}

const STATUS_TONE: Record<ProposalDeliverySnapshotStatus, BadgeTone> = {
  candidate: "info",
  generated: "success",
  voided: "neutral",
};

const STATUS_LABEL: Record<ProposalDeliverySnapshotStatus, string> = {
  candidate: "Candidate",
  generated: "Generated",
  voided: "Voided",
};

const APPROVAL_TONE: Record<ProposalApprovalState, BadgeTone> = {
  unreviewed: "warning",
  approved: "success",
  revoked: "neutral",
};

const APPROVAL_LABEL: Record<ProposalApprovalState, string> = {
  unreviewed: "Unreviewed",
  approved: "Approved",
  revoked: "Approval revoked",
};

const PRICING_LABEL: Record<ProposalPricingReviewState, string> = {
  placeholder: "Pricing placeholder",
  manually_approved: "Pricing manually approved",
  workflow_approved: "Pricing workflow approved",
};

export async function PastSowDraftsPanel({
  engagementId,
  proposalId,
}: PastSowDraftsPanelProps) {
  const allSnapshots =
    await getProposalDeliverySnapshotsForProposal(proposalId);

  // Source candidate for the Generate button = latest non-voided +
  // approved + Proposal Candidate surface. The list is already
  // ordered by `generated_at` desc, so .find returns the latest.
  const latestApprovedProposalCandidate: ProposalDeliverySnapshot | null =
    allSnapshots.find(
      (s) =>
        s.deliverySurface === "client_proposal_candidate" &&
        s.status !== "voided" &&
        s.approvalState === "approved",
    ) ?? null;

  const sowSnapshots = allSnapshots.filter(
    (s) => s.deliverySurface === "sow_draft_candidate",
  );

  return (
    <Card variant="base" id="past-sow-drafts-panel">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-muted">
                <History className="h-3.5 w-3.5" />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                Past SOW Drafts
              </span>
            </div>
            <p className="max-w-prose text-[11px] leading-relaxed text-text-muted">
              Operator-only history of SOW Draft snapshots derived from
              approved Proposal Candidates. SLATE does not send these
              artifacts to clients and there is no public SOW share
              route in Sprint P6. Voided snapshots remain visible (not
              deleted) so the audit trail is preserved. Pricing and
              legal terms are intentionally omitted from every draft
              until a commercial approval workflow advances.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <GenerateSowDraftButton
              engagementId={engagementId}
              proposalId={proposalId}
              sourceProposalSnapshotId={
                latestApprovedProposalCandidate?.id ?? null
              }
            />
            <span className="text-[11px] text-text-muted">
              {sowSnapshots.length} draft
              {sowSnapshots.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {sowSnapshots.length === 0 ? (
          <div className="rounded-md border border-dashed border-border-subtle bg-bg-surface/40 p-4 text-[11px] leading-relaxed text-text-muted">
            <span className="uppercase tracking-[0.14em] text-text-muted">
              No SOW Drafts yet
            </span>
            <p className="mt-1">
              {latestApprovedProposalCandidate
                ? "Click Generate SOW Draft above to produce the first internal SOW Draft snapshot from the latest approved Proposal Candidate."
                : "Approve a Proposal Candidate first. SOW Drafts derive from approved Proposal Candidate snapshots."}
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {sowSnapshots.map((s) => (
              <li key={s.id}>
                <SnapshotRow
                  engagementId={engagementId}
                  snapshotId={s.id}
                  status={s.status}
                  approvalState={s.approvalState}
                  pricingReviewState={s.pricingReviewState}
                  draftWatermark={s.draftWatermark}
                  generatedAt={s.generatedAt}
                  generatedByLabel={s.generatedByLabel}
                  proposalStatusAtGeneration={s.proposalStatusAtGeneration}
                  commercialGuardPassed={s.commercialGuardResult.passed}
                  commercialGuardViolations={
                    s.commercialGuardResult.violations?.length ?? 0
                  }
                  includedOptionCount={
                    s.optionSnapshot.filter((o) => o.includedInArtifact).length
                  }
                  selectedOptionIdCount={s.selectedOptionIds.length}
                  voidedAt={s.voidedAt}
                  voidReason={s.voidReason}
                />
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

interface SnapshotRowProps {
  engagementId: string;
  snapshotId: string;
  status: ProposalDeliverySnapshotStatus;
  approvalState: ProposalApprovalState;
  pricingReviewState: ProposalPricingReviewState;
  draftWatermark: boolean;
  generatedAt: string;
  generatedByLabel: string | null;
  proposalStatusAtGeneration: string;
  commercialGuardPassed: boolean;
  commercialGuardViolations: number;
  includedOptionCount: number;
  selectedOptionIdCount: number;
  voidReason: string | null;
  voidedAt: string | null;
}

function SnapshotRow(props: SnapshotRowProps) {
  const sowHref = `/app/engagements/${props.engagementId}/proposal/sow/${props.snapshotId}`;
  const isVoided = props.status === "voided";

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[props.status]}>
          {STATUS_LABEL[props.status]}
        </Badge>
        <Badge tone="warning" variant="outline">
          SOW Draft
        </Badge>
        <Badge tone={APPROVAL_TONE[props.approvalState]} variant="outline">
          {APPROVAL_LABEL[props.approvalState]}
        </Badge>
        {props.draftWatermark ? (
          <Badge tone="warning" variant="outline">
            Draft watermark
          </Badge>
        ) : null}
        {props.commercialGuardPassed ? (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-status-success"
            title="SOW commercial guard scan passed"
          >
            <ShieldCheck className="h-3 w-3" aria-hidden />
            SOW guard passed
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-status-risk"
            title="SOW commercial guard violations recorded"
          >
            <ShieldAlert className="h-3 w-3" aria-hidden />
            {props.commercialGuardViolations} violation
            {props.commercialGuardViolations === 1 ? "" : "s"}
          </span>
        )}
        <span className="text-[11px] text-text-muted">
          {formatTimestamp(props.generatedAt)}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px] text-text-secondary">
        <span>
          <span className="uppercase tracking-[0.12em] text-text-muted">
            Options
          </span>{" "}
          {props.includedOptionCount} included
          {props.selectedOptionIdCount > 0
            ? ` (${props.selectedOptionIdCount} selected)`
            : ""}
        </span>
        <span>
          <span className="uppercase tracking-[0.12em] text-text-muted">
            Pricing
          </span>{" "}
          {PRICING_LABEL[props.pricingReviewState]}
        </span>
        <span>
          <span className="uppercase tracking-[0.12em] text-text-muted">
            Proposal status
          </span>{" "}
          {props.proposalStatusAtGeneration}
        </span>
        {props.generatedByLabel ? (
          <span>
            <span className="uppercase tracking-[0.12em] text-text-muted">
              Generated by
            </span>{" "}
            {props.generatedByLabel}
          </span>
        ) : null}
      </div>

      <code className="break-all font-mono text-[10px] text-text-muted">
        {props.snapshotId}
      </code>

      {isVoided && props.voidReason ? (
        <div className="flex items-start gap-2 rounded-md border border-status-neutral/30 bg-status-neutral/10 p-2 text-[11px] leading-relaxed text-text-secondary">
          <Slash className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span>
            <span className="uppercase tracking-[0.12em] text-text-muted">
              Voided{props.voidedAt ? ` ${formatTimestamp(props.voidedAt)}` : ""}{" "}
              ·
            </span>{" "}
            {props.voidReason}
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={sowHref} target="_blank" rel="noopener noreferrer">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leadingIcon={<FileSignature className="h-3.5 w-3.5" />}
            trailingIcon={<ExternalLink className="h-3.5 w-3.5" />}
          >
            Open SOW Draft
          </Button>
        </Link>
        {!isVoided ? (
          <VoidSowDraftButton snapshotId={props.snapshotId} />
        ) : null}
      </div>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

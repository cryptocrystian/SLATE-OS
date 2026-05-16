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
  ProposalDeliverySnapshotStatus,
  ProposalDeliverySurface,
  ProposalPricingReviewState,
} from "@/lib/proposals/delivery-snapshot-types";
import { ApproveProposalCandidateButton } from "./approve-proposal-candidate-button";
import { GenerateProposalCandidateButton } from "./generate-proposal-candidate-button";
import { VoidProposalCandidateButton } from "./void-proposal-candidate-button";

/**
 * Phase 1B Proposal/SOW Delivery Sprint P3 — operator-only Past
 * Proposal Candidates panel.
 *
 * Read-only list of `proposal_delivery_snapshots` for a given
 * proposal, with per-row void / approve affordances and a header
 * action to mint a new candidate. Pure server component — the list
 * fetches via `getProposalDeliverySnapshotsForProposal` which runs
 * through the cookie-bound RLS boundary; non-operator sessions never
 * see snapshot rows.
 *
 * Boundaries:
 *   - No public link.
 *   - No client delivery.
 *   - No proposal share token mint button (Sprint P4 scope).
 *   - No `Prepare Client Review` unlock (Sprint P5 scope).
 *   - No SOW Draft generator (Sprint P6 scope).
 *   - No PDF binary; the panel links to the internal candidate route
 *     which itself renders snapshot-pure metadata.
 *   - Voided snapshots stay in the list (not deleted) and are visibly
 *     marked. The audit trail is preserved.
 */

export interface ProposalCandidatesPanelProps {
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

const SURFACE_LABEL: Record<ProposalDeliverySurface, string> = {
  internal_candidate: "Internal candidate",
  client_proposal_candidate: "Client-safe candidate",
  sow_draft_candidate: "SOW Draft candidate",
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

export async function ProposalCandidatesPanel({
  engagementId,
  proposalId,
}: ProposalCandidatesPanelProps) {
  const snapshots = await getProposalDeliverySnapshotsForProposal(proposalId);

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-muted">
                <History className="h-3.5 w-3.5" />
              </span>
              <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                Past proposal candidates
              </span>
            </div>
            <p className="max-w-prose text-[11px] leading-relaxed text-text-muted">
              Operator-only history of proposal candidate snapshots.
              SLATE does not send these artifacts to clients. Voided
              snapshots remain visible (not deleted) so the audit trail
              is preserved. The public client-proposal route lands in
              Sprint P5; <code className="font-mono">Send to Client</code>{" "}
              remains locked.
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <GenerateProposalCandidateButton
              engagementId={engagementId}
              proposalId={proposalId}
            />
            <span className="text-[11px] text-text-muted">
              {snapshots.length} snapshot{snapshots.length === 1 ? "" : "s"}
            </span>
          </div>
        </div>

        {snapshots.length === 0 ? (
          <div className="rounded-md border border-dashed border-border-subtle bg-bg-surface/40 p-4 text-[11px] leading-relaxed text-text-muted">
            <span className="font-mono uppercase tracking-[0.14em] text-text-muted">
              No proposal candidates yet
            </span>
            <p className="mt-1">
              Click <strong>Generate Proposal Candidate</strong> above to
              produce the first metadata-only candidate snapshot. The
              recommended option set ships by default; explicit option
              selection lands in a future sprint.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {snapshots.map((s) => (
              <li key={s.id}>
                <SnapshotRow
                  engagementId={engagementId}
                  snapshotId={s.id}
                  status={s.status}
                  deliverySurface={s.deliverySurface}
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
  deliverySurface: ProposalDeliverySurface;
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
  const candidateHref = `/app/engagements/${props.engagementId}/proposal/candidate/${props.snapshotId}`;
  const isVoided = props.status === "voided";
  const canApprove =
    !isVoided && props.approvalState === "unreviewed";

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[props.status]}>
          {STATUS_LABEL[props.status]}
        </Badge>
        <Badge
          tone={
            props.deliverySurface === "client_proposal_candidate"
              ? "info"
              : props.deliverySurface === "sow_draft_candidate"
                ? "warning"
                : "neutral"
          }
          variant="outline"
        >
          {SURFACE_LABEL[props.deliverySurface]}
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
            title="Commercial guard scan passed"
          >
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Commercial guard passed
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-status-risk"
            title="Commercial guard violations recorded"
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
          <span className="font-mono uppercase tracking-[0.12em] text-text-muted">
            Options
          </span>{" "}
          {props.includedOptionCount} included
          {props.selectedOptionIdCount > 0
            ? ` (${props.selectedOptionIdCount} selected)`
            : ""}
        </span>
        <span>
          <span className="font-mono uppercase tracking-[0.12em] text-text-muted">
            Pricing
          </span>{" "}
          {PRICING_LABEL[props.pricingReviewState]}
        </span>
        <span>
          <span className="font-mono uppercase tracking-[0.12em] text-text-muted">
            Proposal status
          </span>{" "}
          {props.proposalStatusAtGeneration}
        </span>
        {props.generatedByLabel ? (
          <span>
            <span className="font-mono uppercase tracking-[0.12em] text-text-muted">
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
            <span className="font-mono uppercase tracking-[0.12em] text-text-muted">
              Voided{props.voidedAt ? ` ${formatTimestamp(props.voidedAt)}` : ""}{" "}
              ·
            </span>{" "}
            {props.voidReason}
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={candidateHref} target="_blank" rel="noopener noreferrer">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leadingIcon={<FileSignature className="h-3.5 w-3.5" />}
            trailingIcon={<ExternalLink className="h-3.5 w-3.5" />}
          >
            Open candidate
          </Button>
        </Link>
        {canApprove ? (
          <ApproveProposalCandidateButton
            snapshotId={props.snapshotId}
            guardPassed={props.commercialGuardPassed}
          />
        ) : null}
        {!isVoided ? (
          <VoidProposalCandidateButton snapshotId={props.snapshotId} />
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

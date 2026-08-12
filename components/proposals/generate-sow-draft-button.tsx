"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, FileSignature, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  generateSowDraftCandidateAction,
  type GenerateSowDraftCandidateResult,
} from "@/lib/proposals/sow-draft-actions";

/**
 * Phase 1B SOW Draft Sprint P6-C — operator-only client trigger for
 * the SOW Draft snapshot pipeline (Sprint P6-B's
 * `generateSowDraftCandidateAction`).
 *
 * The button:
 *   - calls `generateSowDraftCandidateAction` via a React transition
 *   - surfaces an inline success notice with a link to the internal
 *     SOW Draft route + a per-snapshot summary chip set
 *   - surfaces an inline failure notice with sanitized eligibility
 *     reasons and a sanitized violation count when the SOW commercial
 *     guard rejects (NEVER the banned phrase text; the action layer
 *     already strips that from the activity event and the result
 *     payload only carries `{field, code}`)
 *   - is disabled (with a help string) when the panel has no approved
 *     Proposal Candidate to derive from
 *   - never sends anything to a client
 *   - never produces a PDF binary
 *   - never unlocks any LockedActionButton
 *
 * The source Proposal Candidate snapshot id is passed by the parent
 * panel — the latest non-voided + approved Proposal Candidate. If
 * none exists the button is rendered in the disabled "needs approved
 * candidate" state.
 */
export interface GenerateSowDraftButtonProps {
  engagementId: string;
  proposalId: string;
  /**
   * The latest approved Proposal Candidate snapshot id, or null if no
   * approved candidate exists. The button is disabled when null.
   */
  sourceProposalSnapshotId: string | null;
}

export function GenerateSowDraftButton({
  engagementId,
  proposalId,
  sourceProposalSnapshotId,
}: GenerateSowDraftButtonProps) {
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] =
    React.useState<GenerateSowDraftCandidateResult | null>(null);

  const disabled = sourceProposalSnapshotId === null;

  function onClick() {
    if (!sourceProposalSnapshotId) return;
    setResult(null);
    startTransition(async () => {
      try {
        const r = await generateSowDraftCandidateAction({
          engagementId,
          proposalId,
          sourceProposalSnapshotId,
        });
        setResult(r);
      } catch {
        setResult({ ok: false, error: "service-error" });
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <Button
        type="button"
        variant="primary"
        size="md"
        leadingIcon={<FileSignature className="h-4 w-4" />}
        disabled={pending || disabled}
        onClick={onClick}
      >
        {pending ? "Generating…" : "Generate SOW Draft"}
      </Button>

      {disabled ? (
        <p className="max-w-xs text-right text-[11px] leading-relaxed text-text-muted">
          Approve a Proposal Candidate first. SOW Drafts can only derive
          from an approved Proposal Candidate snapshot.
        </p>
      ) : null}

      {result?.ok ? (
        <SuccessNotice engagementId={engagementId} result={result} />
      ) : null}

      {result && !result.ok ? <FailureNotice result={result} /> : null}
    </div>
  );
}

function SuccessNotice({
  engagementId,
  result,
}: {
  engagementId: string;
  result: Extract<GenerateSowDraftCandidateResult, { ok: true }>;
}) {
  const href = `/app/engagements/${engagementId}/proposal/sow/${result.snapshotId}`;
  return (
    <div className="flex max-w-md flex-col gap-2 rounded-md border border-status-success/40 bg-status-success/10 p-3 text-[11px] leading-relaxed text-status-success">
      <span className="text-[11px] uppercase tracking-[0.16em]">
        SOW Draft ready · operator review only
      </span>
      <p className="text-text-secondary">
        Internal SOW Draft generated. {result.includedOptionCount} option
        {result.includedOptionCount === 1 ? "" : "s"} included,{" "}
        {result.omittedOptionCount} omitted. Approval state{" "}
        <code className="font-mono">{result.approvalState}</code>;
        pricing review state{" "}
        <code className="font-mono">{result.pricingReviewState}</code>.
        SLATE does not deliver this artifact to a client.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={href} target="_blank" rel="noopener noreferrer">
          <Button
            variant="secondary"
            size="sm"
            trailingIcon={<ExternalLink className="h-3.5 w-3.5" />}
          >
            Open SOW Draft
          </Button>
        </Link>
        {result.draftWatermark ? (
          <Badge tone="warning" variant="outline">
            Draft watermark
          </Badge>
        ) : null}
      </div>
    </div>
  );
}

function FailureNotice({
  result,
}: {
  result: Exclude<GenerateSowDraftCandidateResult, { ok: true }>;
}) {
  return (
    <div className="flex max-w-md flex-col gap-2 rounded-md border border-status-risk/40 bg-status-risk/10 p-3 text-[11px] leading-relaxed text-status-risk">
      <div className="flex items-center gap-2">
        <ShieldAlert aria-hidden className="h-3.5 w-3.5" />
        <span className="uppercase tracking-[0.16em]">
          {translateError(result.error)}
        </span>
      </div>
      {result.error === "commercial-guard-violation" && result.violations ? (
        <div className="flex flex-col gap-1 text-text-secondary">
          <p>
            {result.violations.length} field
            {result.violations.length === 1 ? "" : "s"} flagged by the
            SOW commercial guard. Edit the offending content on the
            source Proposal Candidate and regenerate.
          </p>
          <ul className="flex flex-col gap-1">
            {result.violations.slice(0, 6).map((v, i) => (
              <li
                key={`${v.field}-${v.code}-${i}`}
                className="flex items-start gap-2"
              >
                <span
                  aria-hidden
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-risk"
                />
                <span>
                  <code className="font-mono text-[10px]">{v.code}</code>{" "}
                  · <span className="text-text-muted">{v.field}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {result.error === "eligibility-blocked" && result.eligibilityReasons ? (
        <ul className="flex flex-col gap-1 text-text-secondary">
          {result.eligibilityReasons
            .filter((r) => r.severity === "error")
            .slice(0, 6)
            .map((r, i) => (
              <li
                key={`${r.code}-${i}`}
                className="flex items-start gap-2"
              >
                <span
                  aria-hidden
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-risk"
                />
                <span>{r.message}</span>
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}

function translateError(
  code: Exclude<GenerateSowDraftCandidateResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Session expired";
    case "invalid-engagement":
      return "Invalid engagement";
    case "invalid-proposal":
      return "Invalid proposal";
    case "invalid-source-snapshot":
      return "Invalid source snapshot";
    case "engagement-not-found":
      return "Engagement not found";
    case "source-snapshot-not-found":
      return "Source Proposal Candidate not found";
    case "source-snapshot-wrong-engagement":
      return "Source snapshot belongs to a different engagement";
    case "source-snapshot-voided":
      return "Source Proposal Candidate is voided";
    case "source-snapshot-not-approved":
      return "Source Proposal Candidate is not approved";
    case "source-surface-not-proposal-candidate":
      return "Source snapshot is not a Proposal Candidate";
    case "eligibility-blocked":
      return "SOW Draft eligibility check failed";
    case "commercial-guard-violation":
      return "SOW commercial guard rejected the draft";
    case "service-error":
    default:
      return "SOW Draft generation failed";
  }
}

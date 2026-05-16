"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, FileSignature, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  generateProposalCandidateAction,
  type GenerateProposalCandidateResult,
} from "@/lib/proposals/snapshot-actions";

/**
 * Phase 1B Proposal/SOW Delivery Sprint P3 — operator-only client
 * trigger for the proposal candidate snapshot pipeline (Sprint P2's
 * `generateProposalCandidateAction`).
 *
 * The button:
 *   - calls `generateProposalCandidateAction` via a React transition
 *   - surfaces an inline success notice with a link to the internal
 *     candidate route + a per-snapshot summary chip set
 *   - surfaces an inline failure notice with the eligibility reasons
 *     and a sanitised violation count when the commercial guard
 *     rejects (NEVER the banned phrase text; the action layer
 *     already strips that from the activity event and the result
 *     payload only carries `{field, code}`)
 *   - never sends anything to a client
 *   - never produces a PDF binary
 *   - never unlocks any LockedActionButton
 */
export interface GenerateProposalCandidateButtonProps {
  engagementId: string;
  proposalId: string;
}

export function GenerateProposalCandidateButton({
  engagementId,
  proposalId,
}: GenerateProposalCandidateButtonProps) {
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] =
    React.useState<GenerateProposalCandidateResult | null>(null);

  function onClick() {
    setResult(null);
    startTransition(async () => {
      try {
        const r = await generateProposalCandidateAction({
          engagementId,
          proposalId,
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
        disabled={pending}
        onClick={onClick}
      >
        {pending ? "Generating…" : "Generate Proposal Candidate"}
      </Button>

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
  result: Extract<GenerateProposalCandidateResult, { ok: true }>;
}) {
  const href = `/app/engagements/${engagementId}/proposal/candidate/${result.snapshotId}`;
  return (
    <div className="flex max-w-md flex-col gap-2 rounded-md border border-status-success/40 bg-status-success/10 p-3 text-[11px] leading-relaxed text-status-success">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em]">
        Proposal candidate ready · operator review only
      </span>
      <p className="text-text-secondary">
        Internal candidate generated.{" "}
        {result.includedOptionCount} option
        {result.includedOptionCount === 1 ? "" : "s"} included,{" "}
        {result.omittedOptionCount} omitted. Approval state{" "}
        <code className="font-mono">{result.approvalState}</code>;
        pricing review state{" "}
        <code className="font-mono">{result.pricingReviewState}</code>.
        SLATE does not send this artifact to a client.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Link href={href} target="_blank" rel="noopener noreferrer">
          <Button
            variant="secondary"
            size="sm"
            trailingIcon={<ExternalLink className="h-3.5 w-3.5" />}
          >
            Open candidate
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
  result: Exclude<GenerateProposalCandidateResult, { ok: true }>;
}) {
  return (
    <div className="flex max-w-md flex-col gap-2 rounded-md border border-status-risk/40 bg-status-risk/10 p-3 text-[11px] leading-relaxed text-status-risk">
      <div className="flex items-center gap-2">
        <ShieldAlert aria-hidden className="h-3.5 w-3.5" />
        <span className="font-mono uppercase tracking-[0.16em]">
          {translateError(result.error)}
        </span>
      </div>
      {result.error === "commercial-guard-violation" && result.violations ? (
        <div className="flex flex-col gap-1 text-text-secondary">
          <p>
            {result.violations.length} field
            {result.violations.length === 1 ? "" : "s"} flagged. Edit
            the offending content and try again.
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
  code: Exclude<GenerateProposalCandidateResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Session expired";
    case "invalid-engagement":
      return "Invalid engagement";
    case "invalid-proposal":
      return "Invalid proposal";
    case "engagement-not-found":
      return "Engagement not found";
    case "proposal-not-found":
      return "Initialize the proposal first";
    case "no-options":
      return "Proposal has no options";
    case "multiple-proposals-need-id":
      return "Specify a proposal id";
    case "eligibility-blocked":
      return "Eligibility check blocked the candidate";
    case "commercial-guard-violation":
      return "Commercial guard rejected the candidate";
    case "service-error":
    default:
      return "Generation failed";
  }
}

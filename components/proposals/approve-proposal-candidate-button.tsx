"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  approveProposalDeliverySnapshotAction,
  type ApproveProposalDeliverySnapshotResult,
} from "@/lib/proposals/snapshot-actions";

/**
 * Phase 1B Proposal/SOW Delivery Sprint P3 — operator-only approval
 * affordance for a proposal candidate snapshot.
 *
 * Single-click action (no two-step confirm) because approval is a soft
 * state flip that the operator can reverse by generating a new
 * candidate or voiding the current one. After success the parent page
 * revalidates and the badge flips from `unreviewed` → `approved`.
 *
 * Per `docs/24` § Prepare SOW Draft Unlock Policy item 2, approval is
 * the prerequisite for SOW Draft eligibility — but Sprint P3 does NOT
 * unlock `Prepare SOW Draft`. That lands in Sprint P6.
 *
 * Per `docs/24` § Pricing / Terms Policy, approving a candidate
 * approves its CONTENT, not its PRICING. The pricing_review_state
 * remains `placeholder` until a separate commercial-approval workflow
 * advances it.
 */
export interface ApproveProposalCandidateButtonProps {
  snapshotId: string;
  disabled?: boolean;
  /**
   * Set to false if the candidate's commercial guard failed at
   * generation time. The action will reject the approval, but the
   * button hides itself rather than letting the operator click
   * something that will always fail.
   */
  guardPassed: boolean;
}

export function ApproveProposalCandidateButton({
  snapshotId,
  disabled,
  guardPassed,
}: ApproveProposalCandidateButtonProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  if (!guardPassed) {
    return (
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
        Approval unavailable · commercial guard failed
      </span>
    );
  }

  function onClick() {
    setError(null);
    startTransition(async () => {
      try {
        const result: ApproveProposalDeliverySnapshotResult =
          await approveProposalDeliverySnapshotAction({ snapshotId });
        if (!result.ok) {
          setError(translateError(result.error));
        }
        // Success path — parent revalidatePath fires; the panel
        // re-renders with the approved badge.
      } catch {
        setError("Approval failed unexpectedly. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        leadingIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
        disabled={disabled || pending}
        onClick={onClick}
      >
        {pending ? "Approving…" : "Approve candidate"}
      </Button>
      {error ? (
        <p className="max-w-xs rounded-md border border-status-critical/40 bg-status-critical/10 p-2 text-[11px] text-status-critical">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function translateError(
  code: Exclude<ApproveProposalDeliverySnapshotResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "invalid-snapshot":
      return "Invalid snapshot reference.";
    case "snapshot-not-found":
      return "Snapshot not found.";
    case "snapshot-voided":
      return "Cannot approve a voided snapshot.";
    case "already-approved":
      return "This candidate is already approved.";
    case "commercial-guard-not-passed":
      return "Commercial guard violations must be resolved before approval.";
    case "service-error":
    default:
      return "Approval failed. Please try again.";
  }
}

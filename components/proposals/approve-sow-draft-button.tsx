"use client";

import * as React from "react";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  approveSowDraftSnapshotAction,
  type ApproveSowDraftSnapshotResult,
} from "@/lib/proposals/sow-draft-actions";

/**
 * Sprint P7-B step 1 (`docs/65` § 4.1) — operator-only approval
 * affordance for a SOW Draft snapshot.
 *
 * A SOW Draft is born `approval_state='unreviewed'`; approving it is the
 * first prerequisite for any future public SOW share (`/s/[token]`).
 * Single-click soft flip, mirroring the proposal-candidate approve
 * button. Approval gates shareability only — it is NOT client delivery,
 * NOT a Send to Client unlock, and NOT authorisation to begin work, and
 * it does not clear the DRAFT watermark: a shared SOW stays a draft.
 */
export interface ApproveSowDraftButtonProps {
  snapshotId: string;
  disabled?: boolean;
  /**
   * False when the SOW commercial guard failed at generation time. The
   * action will reject, so the button hides itself rather than offering
   * a click that always fails.
   */
  guardPassed: boolean;
}

export function ApproveSowDraftButton({
  snapshotId,
  disabled,
  guardPassed,
}: ApproveSowDraftButtonProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  if (!guardPassed) {
    return (
      <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
        Approval unavailable · commercial guard failed
      </span>
    );
  }

  function onClick() {
    setError(null);
    startTransition(async () => {
      try {
        const result: ApproveSowDraftSnapshotResult =
          await approveSowDraftSnapshotAction({ snapshotId });
        if (!result.ok) {
          setError(translateError(result.error));
        }
        // Success path — parent revalidatePath fires; the panel
        // re-renders with the approved state.
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
        {pending ? "Approving…" : "Approve SOW Draft"}
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
  code: Exclude<ApproveSowDraftSnapshotResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "invalid-snapshot":
      return "Invalid snapshot reference.";
    case "snapshot-not-found":
      return "Snapshot not found.";
    case "not-a-sow-draft":
      return "This snapshot is not a SOW Draft.";
    case "snapshot-voided":
      return "Cannot approve a voided SOW Draft.";
    case "already-approved":
      return "This SOW Draft is already approved.";
    case "commercial-guard-not-passed":
      return "Commercial guard violations must be resolved before approval.";
    case "service-error":
    default:
      return "Approval failed. Please try again.";
  }
}

"use client";

import * as React from "react";
import { Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  voidProposalDeliverySnapshotAction,
  type VoidProposalDeliverySnapshotResult,
} from "@/lib/proposals/snapshot-actions";

/**
 * Phase 1B SOW Draft Sprint P6-C — operator-only void affordance for
 * a SOW Draft snapshot. Two-step confirmation, mirrors the proposal
 * candidate void button:
 *
 *   1. Click "Void" → reveals an inline form with a SOW-specific
 *      default reason that the operator can edit.
 *   2. Click "Confirm void" → calls
 *      `voidProposalDeliverySnapshotAction`.
 *
 * The shared `voidProposalDeliverySnapshotAction` branches on the
 * row's `delivery_surface` and emits `sow_draft_voided` (not
 * `proposal_snapshot_voided`) when the row is a SOW Draft. No
 * SOW-specific cascade behaviour today — there is no public SOW
 * share route in Sprint P6, so no tokens to revoke.
 *
 * Void is soft: the row is **not deleted**, just status='voided' +
 * voided_at + voided_by + void_reason + approval_state='revoked'.
 * After success the parent page revalidates and the panel re-renders
 * with the SOW Draft marked voided.
 */
export interface VoidSowDraftButtonProps {
  snapshotId: string;
  disabled?: boolean;
}

const DEFAULT_REASON = "Superseded by a newer SOW Draft.";

export function VoidSowDraftButton({
  snapshotId,
  disabled,
}: VoidSowDraftButtonProps) {
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState(DEFAULT_REASON);
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function onConfirm() {
    setError(null);
    startTransition(async () => {
      try {
        const result: VoidProposalDeliverySnapshotResult =
          await voidProposalDeliverySnapshotAction({
            snapshotId,
            reason: reason.trim().length > 0 ? reason.trim() : DEFAULT_REASON,
          });
        if (!result.ok) {
          setError(translateError(result.error));
          return;
        }
        // Success — parent revalidatePath fires; the panel re-renders.
        setOpen(false);
      } catch {
        setError("Void failed unexpectedly. Please try again.");
      }
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        leadingIcon={<Trash2 className="h-3.5 w-3.5" />}
        disabled={disabled || pending}
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        Void
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-status-warning">
        Void this SOW Draft?
      </span>
      <label className="flex flex-col gap-1 text-[11px] text-text-secondary">
        <span className="uppercase tracking-[0.12em] text-text-muted">
          Reason (operator-visible only)
        </span>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value.slice(0, 280))}
          disabled={pending}
          className="rounded-md border border-border-subtle bg-bg-surface/60 px-2 py-1.5 text-xs text-text-primary outline-none focus:border-border-strong"
          placeholder={DEFAULT_REASON}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          leadingIcon={<Trash2 className="h-3.5 w-3.5" />}
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? "Voiding…" : "Confirm void"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leadingIcon={<X className="h-3.5 w-3.5" />}
          disabled={pending}
          onClick={() => {
            setReason(DEFAULT_REASON);
            setError(null);
            setOpen(false);
          }}
        >
          Cancel
        </Button>
      </div>
      {error ? (
        <p className="rounded-md border border-status-critical/40 bg-status-critical/10 p-2 text-[11px] text-status-critical">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function translateError(
  code: Exclude<VoidProposalDeliverySnapshotResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "invalid-snapshot":
      return "Invalid SOW Draft snapshot reference.";
    case "snapshot-not-found":
      return "SOW Draft snapshot not found.";
    case "already-voided":
      return "This SOW Draft is already voided.";
    case "service-error":
    default:
      return "Voiding failed. Please try again.";
  }
}

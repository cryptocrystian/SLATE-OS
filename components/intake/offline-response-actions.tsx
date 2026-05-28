"use client";

import * as React from "react";
import { CheckCircle2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  markStakeholderResponseReadyForSynthesisAction,
  voidStakeholderResponseAction,
} from "@/lib/intake/offline-actions";
import type {
  IntakeResponseStatus,
  MarkResponseReadyResult,
  VoidOfflineResponseResult,
} from "@/lib/intake/types";

/**
 * Sprint I3 — Per-response lifecycle action row.
 *
 * Buttons rendered depend on the current status:
 *   - draft: [Mark ready] [Void]
 *   - ready_for_synthesis: [Void]   (already ready; can still be retracted)
 *   - superseded / voided: no actions (terminal)
 *
 * Canon: docs/37 § 4 transition matrix. Server-side action layer is the
 * authority on transitions; this UI only surfaces the legal next steps.
 */

export interface OfflineResponseActionsProps {
  responseId: string;
  status: IntakeResponseStatus;
  /** Optional callback after a successful state change. */
  onChanged?: () => void;
}

export function OfflineResponseActions({
  responseId,
  status,
  onChanged,
}: OfflineResponseActionsProps) {
  const [pending, setPending] = React.useState<"ready" | "void" | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  // Terminal states surface no actions.
  if (status === "superseded" || status === "voided") {
    return null;
  }

  async function markReady() {
    setError(null);
    setPending("ready");
    try {
      const result: MarkResponseReadyResult =
        await markStakeholderResponseReadyForSynthesisAction({ responseId });
      if (!result.ok) {
        setError(translateMarkReadyError(result.error));
      } else {
        onChanged?.();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  async function voidResponse() {
    const reason = window.prompt(
      "Reason for voiding this response (optional; max 500 chars). The response will be preserved in the audit trail and skipped by synthesis.",
      "",
    );
    // Cancel button on prompt returns null — treat as abort.
    if (reason === null) return;

    setError(null);
    setPending("void");
    try {
      const result: VoidOfflineResponseResult =
        await voidStakeholderResponseAction({
          responseId,
          reason: reason || undefined,
        });
      if (!result.ok) {
        setError(translateVoidError(result.error));
      } else {
        onChanged?.();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {status === "draft" ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leadingIcon={<CheckCircle2 className="h-3.5 w-3.5" />}
            onClick={markReady}
            disabled={pending !== null}
          >
            {pending === "ready" ? "Marking ready…" : "Mark ready for synthesis"}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leadingIcon={<Trash2 className="h-3.5 w-3.5" />}
          onClick={voidResponse}
          disabled={pending !== null}
        >
          {pending === "void" ? "Voiding…" : "Void"}
        </Button>
      </div>
      {error ? (
        <p className="text-[11px] text-status-critical">{error}</p>
      ) : null}
    </div>
  );
}

function translateMarkReadyError(
  code: Exclude<MarkResponseReadyResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "invalid-response":
    case "response-not-found":
      return "Response not found.";
    case "response-already-voided":
      return "Response has been voided.";
    case "response-not-eligible":
      return "Superseded responses cannot be promoted.";
    case "service-error":
    default:
      return "Couldn't mark this response ready.";
  }
}

function translateVoidError(
  code: Exclude<VoidOfflineResponseResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "invalid-response":
    case "response-not-found":
      return "Response not found.";
    case "response-already-voided":
      return "Response has already been voided.";
    case "field-too-long":
      return "Void reason exceeded the 500-character limit.";
    case "service-error":
    default:
      return "Couldn't void this response.";
  }
}

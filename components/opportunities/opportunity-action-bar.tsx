"use client";

import * as React from "react";
import { Check, Pause, RotateCcw, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  deferOpportunity,
  markOpportunitySelected,
  rejectOpportunity,
  reopenOpportunity,
  type OpportunityActionResult,
} from "@/lib/opportunities/actions";
import type { OpportunityProvenanceSummary } from "@/lib/opportunities/provenance";

export interface OpportunityActionBarProps {
  opportunityId: string;
  status: "draft" | "scored" | "selected" | "deferred" | "rejected";
  /**
   * Sprint S6 — provenance summary derived from source-finding
   * provenance. When `needsValidation` is true the bar surfaces a
   * warning panel above the buttons (mirroring the S5 finding-card
   * pattern). Optional — when null/undefined the warning never
   * renders.
   */
  provenance?: OpportunityProvenanceSummary | null;
  /** Operator-typed rejection rationale already persisted in
   *  `reviewer_notes`. Displayed inline on `rejected` rows so the
   *  reason is visible at a glance. */
  reviewerNote?: string | null;
}

const STATUS_LABEL: Record<OpportunityActionBarProps["status"], string> = {
  draft: "Draft",
  scored: "Scored",
  selected: "Selected",
  deferred: "Deferred",
  rejected: "Rejected",
};

const STATUS_TONE: Record<
  OpportunityActionBarProps["status"],
  "neutral" | "info" | "success" | "warning" | "risk"
> = {
  draft: "neutral",
  scored: "info",
  selected: "success",
  deferred: "warning",
  rejected: "risk",
};

export function OpportunityActionBar({
  opportunityId,
  status,
  provenance,
  reviewerNote,
}: OpportunityActionBarProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  // Sprint S6 — rejection-reason capture. Two-step UX: first click on
  // Reject opens the reason input; second click submits.
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");

  React.useEffect(() => {
    setRejectOpen(false);
    setRejectReason("");
    setError(null);
  }, [opportunityId]);

  function run(runner: () => Promise<OpportunityActionResult>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await runner();
        if (!result.ok) setError(translateError(result.error));
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  const rejectReasonValid =
    rejectReason.trim().length === 0 ||
    (rejectReason.trim().length >= 10 && rejectReason.trim().length <= 500);

  const isTerminal = status === "rejected" || status === "selected";

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
          Triage
        </span>
        <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      </div>

      {/* Sprint S6 — Needs-validation pre-approval warning. Withdraws
          once the opportunity is in a terminal state. */}
      {provenance?.needsValidation && !isTerminal ? (
        <div className="flex items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-2 text-[11px]">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warning" />
          <span className="leading-relaxed text-text-secondary">
            <span className="font-medium text-status-warning">
              Needs validation.
            </span>{" "}
            {provenance.needsValidationReason ??
              "Source findings carry weak provenance. Selecting will inherit a needs-validation flag for downstream roadmap work."}
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          leadingIcon={<Check className="h-3.5 w-3.5" />}
          disabled={pending || status === "selected"}
          onClick={() => run(() => markOpportunitySelected(opportunityId))}
        >
          Mark selected
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leadingIcon={<Pause className="h-3.5 w-3.5" />}
          disabled={pending || status === "deferred"}
          onClick={() => run(() => deferOpportunity(opportunityId))}
        >
          Defer
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
          disabled={pending || status === "scored" || status === "draft"}
          onClick={() => run(() => reopenOpportunity(opportunityId))}
        >
          Reopen
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leadingIcon={<X className="h-3.5 w-3.5" />}
          className="text-status-risk hover:text-status-risk"
          disabled={pending || status === "rejected"}
          onClick={() => {
            setRejectOpen((v) => !v);
            setError(null);
          }}
        >
          {rejectOpen ? "Cancel reject" : "Reject…"}
        </Button>
      </div>

      {/* Sprint S6 — Rejection reason capture. Optional 10–500 chars;
          persisted in reviewer_notes AND activity event metadata. */}
      {rejectOpen ? (
        <div className="flex flex-col gap-2 rounded-md border border-status-risk/40 bg-status-risk/10 p-3">
          <span className="text-[11px] uppercase tracking-[0.14em] text-status-risk">
            Reject opportunity · reason (optional, 10–500 chars)
          </span>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="E.g. 'Out of scope for this engagement; revisit after the integration platform decision lands.'"
            className="w-full rounded-md border border-border-subtle bg-bg-page/60 p-2.5 text-xs leading-relaxed text-text-primary outline-none transition-[border,box-shadow] placeholder:text-text-muted focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-text-muted">
              {rejectReason.trim().length}/500 · empty saves rejection without a
              reason
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setRejectOpen(false);
                  setRejectReason("");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                className="bg-status-risk hover:bg-[color:color-mix(in_oklab,var(--color-status-risk)_88%,white)]"
                disabled={pending || !rejectReasonValid}
                onClick={() =>
                  run(() =>
                    rejectOpportunity(opportunityId, {
                      reason: rejectReason.trim() || undefined,
                    }),
                  )
                }
              >
                Confirm reject
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Sprint S6 — Display persisted rejection rationale on
          already-rejected opportunities. */}
      {status === "rejected" && reviewerNote ? (
        <div className="flex flex-col gap-1 rounded-md border border-status-risk/40 bg-status-risk/5 p-3">
          <span className="text-[11px] uppercase tracking-[0.14em] text-status-risk">
            Rejection rationale
          </span>
          <p className="text-xs leading-relaxed text-text-secondary">
            {reviewerNote}
          </p>
        </div>
      ) : null}

      {error ? (
        <p className="rounded-md border border-status-critical/40 bg-status-critical/10 p-2 text-[11px] text-status-critical">
          {error}
        </p>
      ) : null}
      {pending ? (
        <p className="text-[11px] text-text-muted">Saving…</p>
      ) : null}
    </div>
  );
}

function translateError(
  code: Exclude<OpportunityActionResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "opportunity-not-found":
      return "This opportunity could not be found.";
    case "invalid-opportunity":
      return "Invalid opportunity reference.";
    case "rejection-reason-invalid":
      return "Rejection reason must be between 10 and 500 characters, or empty.";
    case "service-error":
    default:
      return "We couldn't update the opportunity. Please try again.";
  }
}

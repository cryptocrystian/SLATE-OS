"use client";

import * as React from "react";
import { Check, Pause, RotateCcw, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { Badge } from "@/components/ui/badge";
import {
  rejectRoadmapItem,
  setRoadmapItemStatus,
  type RoadmapActionResult,
} from "@/lib/roadmap/actions";
import type { RoadmapItemProvenanceSummary } from "@/lib/roadmap/provenance";
import type { RoadmapStatus } from "@/lib/roadmap/mappers";

export interface RoadmapActionBarProps {
  roadmapItemId: string;
  status: RoadmapStatus;
  /**
   * Sprint S7 — provenance summary derived from the linked source
   * opportunity. When `needsValidation` is true the bar surfaces a
   * warning panel above the buttons (mirroring the S5 finding-card /
   * S6 opportunity-card patterns). Optional — when null/undefined the
   * warning never renders.
   */
  provenance?: RoadmapItemProvenanceSummary | null;
  /** Operator-typed rejection rationale already persisted in
   *  `reviewer_notes`. Displayed inline on rejected items so the
   *  reason is visible at a glance. */
  reviewerNote?: string | null;
}

const STATUS_LABEL: Record<RoadmapStatus, string> = {
  planned: "Planned",
  ready: "Ready",
  blocked: "Blocked",
  deferred: "Deferred",
  rejected: "Rejected",
  completed: "Completed",
};

const STATUS_TONE: Record<
  RoadmapStatus,
  "neutral" | "info" | "success" | "warning" | "risk"
> = {
  planned: "neutral",
  ready: "success",
  blocked: "warning",
  deferred: "warning",
  rejected: "risk",
  completed: "info",
};

export function RoadmapActionBar({
  roadmapItemId,
  status,
  provenance,
  reviewerNote,
}: RoadmapActionBarProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");

  React.useEffect(() => {
    setRejectOpen(false);
    setRejectReason("");
    setError(null);
  }, [roadmapItemId]);

  const { toast } = useToast();

  function run(runner: () => Promise<RoadmapActionResult>, success?: string) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await runner();
        if (!result.ok) {
          const message = translateError(result.error);
          setError(message);
          toast({
            title: "Couldn’t save change",
            description: message,
            variant: "error",
          });
        } else {
          toast({ title: success ?? "Change saved", variant: "success" });
        }
      } catch {
        const message = "Something went wrong. Please try again.";
        setError(message);
        toast({ title: "Couldn’t save change", description: message, variant: "error" });
      }
    });
  }

  const rejectReasonValid =
    rejectReason.trim().length === 0 ||
    (rejectReason.trim().length >= 10 && rejectReason.trim().length <= 500);

  const isTerminal = status === "rejected" || status === "ready";

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
          Triage
        </span>
        <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      </div>

      {/* Sprint S7 — Needs-validation pre-approval warning. */}
      {provenance?.needsValidation && !isTerminal ? (
        <div className="flex items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-2 text-[11px]">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warning" />
          <span className="leading-relaxed text-text-secondary">
            <span className="font-medium text-status-warning">
              Needs validation.
            </span>{" "}
            {provenance.needsValidationReason ??
              "Linked source opportunity carries weak provenance. Approving inherits a needs-validation flag for downstream report drafting."}
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          leadingIcon={<Check className="h-3.5 w-3.5" />}
          disabled={pending || status === "ready"}
          onClick={() => run(() => setRoadmapItemStatus(roadmapItemId, "ready"), "Marked ready")}
        >
          Approve
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leadingIcon={<Pause className="h-3.5 w-3.5" />}
          disabled={pending || status === "deferred"}
          onClick={() =>
            run(() => setRoadmapItemStatus(roadmapItemId, "deferred"), "Deferred")
          }
        >
          Defer
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
          disabled={pending || status === "planned"}
          onClick={() =>
            run(() => setRoadmapItemStatus(roadmapItemId, "planned"), "Reopened")
          }
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

      {/* Two-step rejection reason capture. */}
      {rejectOpen ? (
        <div className="flex flex-col gap-2 rounded-md border border-status-risk/40 bg-status-risk/10 p-3">
          <span className="text-[11px] uppercase tracking-[0.14em] text-status-risk">
            Reject roadmap item · reason (optional, 10–500 chars)
          </span>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="E.g. 'Out of scope for the current engagement timeline; revisit after the platform decision lands in Q3.'"
            className="w-full rounded-md border border-border-subtle bg-bg-page/60 p-2.5 text-xs leading-relaxed text-text-primary outline-none transition-[border,box-shadow] placeholder:text-text-muted focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-text-muted">
              {rejectReason.trim().length}/500 · empty saves rejection without
              a reason
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
                  run(
                    () =>
                      rejectRoadmapItem(roadmapItemId, {
                        reason: rejectReason.trim() || undefined,
                      }),
                    "Roadmap item rejected",
                  )
                }
              >
                Confirm reject
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Display persisted rejection rationale on already-rejected items. */}
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
  code: Exclude<RoadmapActionResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "roadmap-item-not-found":
      return "This roadmap item could not be found.";
    case "invalid-roadmap-item":
      return "Invalid roadmap item reference.";
    case "invalid-status":
      return "Invalid status transition.";
    case "rejection-reason-invalid":
      return "Rejection reason must be between 10 and 500 characters, or empty.";
    case "service-error":
    default:
      return "We couldn't update the roadmap item. Please try again.";
  }
}

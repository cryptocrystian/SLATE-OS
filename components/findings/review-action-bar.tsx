"use client";

import * as React from "react";
import { Check, RotateCcw, Send, ShieldAlert, StickyNote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import {
  approveFinding,
  markFindingNeedsReview,
  markFindingReportReady,
  rejectFinding,
  updateFindingNote,
  type FindingActionResult,
} from "@/lib/findings/actions";
import { summarizeFindingProvenance } from "@/lib/findings/provenance";
import type { Finding, FindingReviewStatus } from "@/lib/findings/types";

export interface FindingReviewActionBarProps {
  finding: Finding;
}

/**
 * Persisted review-action bar for a single finding. Wires every button
 * to the corresponding server action and surfaces a compact pending /
 * error / saved-note state. Reviewer-note edit is inline.
 */
export function FindingReviewActionBar({ finding }: FindingReviewActionBarProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [noteOpen, setNoteOpen] = React.useState(false);
  const [noteDraft, setNoteDraft] = React.useState(finding.reviewerNote ?? "");
  const [noteSaved, setNoteSaved] = React.useState(false);
  // Sprint S5 — rejection-reason capture. Two-step UX: first click on
  // Reject opens the reason input; second click submits.
  const [rejectOpen, setRejectOpen] = React.useState(false);
  const [rejectReason, setRejectReason] = React.useState("");

  // Sprint S5 — Needs-validation signal derived from the persisted
  // refs + assumption flag. Surfaced as an in-bar warning above the
  // Approve button so the operator can't miss it.
  const provenance = React.useMemo(
    () =>
      summarizeFindingProvenance(
        finding.sourceRefs,
        Boolean(finding.assumptionFlag),
      ),
    [finding.sourceRefs, finding.assumptionFlag],
  );

  React.useEffect(() => {
    setNoteDraft(finding.reviewerNote ?? "");
    setNoteOpen(false);
    setNoteSaved(false);
    setRejectOpen(false);
    setRejectReason("");
    setError(null);
  }, [finding.id, finding.reviewerNote]);

  const { toast } = useToast();

  function run(
    runner: () => Promise<FindingActionResult>,
    opts?: { onOk?: () => void; success?: string },
  ) {
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
          opts?.onOk?.();
          toast({ title: opts?.success ?? "Change saved", variant: "success" });
        }
      } catch {
        const message = "Something went wrong. Please try again.";
        setError(message);
        toast({ title: "Couldn’t save change", description: message, variant: "error" });
      }
    });
  }

  const isApproved =
    finding.reviewStatus === "approved" || finding.reviewStatus === "report-ready";

  const rejectReasonValid =
    rejectReason.trim().length === 0 ||
    (rejectReason.trim().length >= 10 && rejectReason.trim().length <= 500);

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
        Review actions
      </span>

      {/* Sprint S5 — Needs-validation pre-approval warning. */}
      {provenance.needsValidation &&
      finding.reviewStatus !== "approved" &&
      finding.reviewStatus !== "report-ready" &&
      finding.reviewStatus !== "rejected" ? (
        <div className="flex items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-2 text-[11px]">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warning" />
          <span className="leading-relaxed text-text-secondary">
            <span className="font-medium text-status-warning">
              Needs validation.
            </span>{" "}
            {provenance.needsValidationReason ??
              "Evidence strength is low. Approving will mark the finding for downstream review."}
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          leadingIcon={<Check className="h-3.5 w-3.5" />}
          disabled={pending || finding.reviewStatus === "approved"}
          onClick={() =>
            run(() => approveFinding(finding.id), { success: "Finding approved" })
          }
        >
          Approve
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leadingIcon={<Send className="h-3.5 w-3.5" />}
          disabled={pending || !isApproved || finding.reviewStatus === "report-ready"}
          onClick={() =>
            run(() => markFindingReportReady(finding.id), {
              success: "Marked report-ready",
            })
          }
        >
          Mark report-ready
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leadingIcon={<StickyNote className="h-3.5 w-3.5" />}
          disabled={pending}
          onClick={() => {
            setNoteOpen((v) => !v);
            setNoteSaved(false);
          }}
        >
          {finding.reviewerNote ? "Edit note" : "Add note"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leadingIcon={<RotateCcw className="h-3.5 w-3.5" />}
          disabled={pending || finding.reviewStatus === "needs-review"}
          onClick={() =>
            run(() => markFindingNeedsReview(finding.id), {
              success: "Reopened for review",
            })
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
          disabled={pending || finding.reviewStatus === "rejected"}
          onClick={() => {
            setRejectOpen((v) => !v);
            setError(null);
          }}
        >
          {rejectOpen ? "Cancel reject" : "Reject…"}
        </Button>
      </div>

      {/* Sprint S5 — Rejection reason capture. Optional 10–500 chars;
          persisted in reviewer_note AND activity event metadata. */}
      {rejectOpen ? (
        <div className="flex flex-col gap-2 rounded-md border border-status-risk/40 bg-status-risk/10 p-3">
          <span className="text-[11px] uppercase tracking-[0.14em] text-status-risk">
            Reject finding · reason (optional, 10–500 chars)
          </span>
          <textarea
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="E.g. 'Stakeholder later clarified this was scoped to a different team — finding does not apply to this engagement.'"
            className="w-full rounded-md border border-border-subtle bg-bg-page/60 p-2.5 text-xs leading-relaxed text-text-primary outline-none transition-[border,box-shadow] placeholder:text-text-muted focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-text-muted">
              {rejectReason.trim().length}/500 · empty saves rejection
              without a reason
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
                      rejectFinding(finding.id, {
                        reason: rejectReason.trim() || undefined,
                      }),
                    { success: "Finding rejected" },
                  )
                }
              >
                Confirm reject
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      {noteOpen ? (
        <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated/50 p-3">
          <label
            htmlFor={`note-${finding.id}`}
            className="text-[11px] uppercase tracking-[0.14em] text-text-muted"
          >
            Reviewer note
          </label>
          <textarea
            id={`note-${finding.id}`}
            value={noteDraft}
            onChange={(e) => setNoteDraft(e.target.value)}
            rows={3}
            maxLength={1000}
            className="w-full rounded-md border border-border-subtle bg-bg-page/60 p-3 text-xs leading-relaxed text-text-primary outline-none transition-[border,box-shadow] placeholder:text-text-muted focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
            placeholder="Capture the reviewer rationale, scope notes, or open questions for synthesis."
          />
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-text-muted">
              {noteSaved ? "Saved." : "Note is operator-only."}
            </span>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={pending}
                onClick={() => {
                  setNoteOpen(false);
                  setNoteDraft(finding.reviewerNote ?? "");
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                size="sm"
                disabled={pending}
                onClick={() =>
                  run(() => updateFindingNote(finding.id, noteDraft), {
                    onOk: () => setNoteSaved(true),
                    success: "Note saved",
                  })
                }
              >
                Save note
              </Button>
            </div>
          </div>
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
  code: Exclude<FindingActionResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "finding-not-found":
      return "This finding could not be found.";
    case "invalid-finding":
      return "Invalid finding reference.";
    case "rejection-reason-invalid":
      return "Rejection reason must be between 10 and 500 characters, or empty.";
    case "service-error":
    default:
      return "We couldn't save that change. Please try again.";
  }
}

export type FindingReviewStatusForBar = FindingReviewStatus;

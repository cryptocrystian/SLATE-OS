"use client";

import * as React from "react";
import { Check, RotateCcw, Send, StickyNote, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  approveFinding,
  markFindingNeedsReview,
  markFindingReportReady,
  rejectFinding,
  updateFindingNote,
  type FindingActionResult,
} from "@/lib/findings/actions";
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

  React.useEffect(() => {
    setNoteDraft(finding.reviewerNote ?? "");
    setNoteOpen(false);
    setNoteSaved(false);
    setError(null);
  }, [finding.id, finding.reviewerNote]);

  function run(
    runner: () => Promise<FindingActionResult>,
    onOk?: () => void,
  ) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await runner();
        if (!result.ok) {
          setError(translateError(result.error));
        } else {
          onOk?.();
        }
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  const isApproved =
    finding.reviewStatus === "approved" || finding.reviewStatus === "report-ready";

  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
        Review actions
      </span>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          leadingIcon={<Check className="h-3.5 w-3.5" />}
          disabled={pending || finding.reviewStatus === "approved"}
          onClick={() => run(() => approveFinding(finding.id))}
        >
          Approve
        </Button>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leadingIcon={<Send className="h-3.5 w-3.5" />}
          disabled={pending || !isApproved || finding.reviewStatus === "report-ready"}
          onClick={() => run(() => markFindingReportReady(finding.id))}
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
          onClick={() => run(() => markFindingNeedsReview(finding.id))}
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
          onClick={() => run(() => rejectFinding(finding.id))}
        >
          Reject
        </Button>
      </div>

      {noteOpen ? (
        <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated/50 p-3">
          <label
            htmlFor={`note-${finding.id}`}
            className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted"
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
                  run(
                    () => updateFindingNote(finding.id, noteDraft),
                    () => setNoteSaved(true),
                  )
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
    case "service-error":
    default:
      return "We couldn't save that change. Please try again.";
  }
}

export type FindingReviewStatusForBar = FindingReviewStatus;

"use client";

import * as React from "react";
import { Check, Pause, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  deferOpportunity,
  markOpportunitySelected,
  rejectOpportunity,
  reopenOpportunity,
  type OpportunityActionResult,
} from "@/lib/opportunities/actions";

export interface OpportunityActionBarProps {
  opportunityId: string;
  status: "draft" | "scored" | "selected" | "deferred" | "rejected";
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
}: OpportunityActionBarProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

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

  return (
    <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
          Triage
        </span>
        <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
      </div>
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
          onClick={() => run(() => rejectOpportunity(opportunityId))}
        >
          Reject
        </Button>
      </div>
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
    case "service-error":
    default:
      return "We couldn't update the opportunity. Please try again.";
  }
}

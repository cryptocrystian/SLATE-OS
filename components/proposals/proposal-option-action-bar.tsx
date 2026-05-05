"use client";

import * as React from "react";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  markProposalOptionRecommended,
  type ProposalActionResult,
} from "@/lib/proposals/actions";

export interface ProposalOptionActionBarProps {
  optionId: string;
  recommended: boolean;
}

export function ProposalOptionActionBar({
  optionId,
  recommended,
}: ProposalOptionActionBarProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function run(runner: () => Promise<ProposalActionResult>) {
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
    <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
          Recommendation
        </span>
        <Badge tone={recommended ? "success" : "neutral"} dot>
          {recommended ? "Recommended" : "Not recommended"}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          leadingIcon={<Star className="h-3.5 w-3.5" />}
          disabled={pending || recommended}
          onClick={() => run(() => markProposalOptionRecommended(optionId))}
        >
          Mark recommended
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
  code: Exclude<ProposalActionResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "option-not-found":
      return "This option could not be found.";
    case "invalid-option":
      return "Invalid option reference.";
    case "service-error":
    default:
      return "We couldn't update the option. Please try again.";
  }
}

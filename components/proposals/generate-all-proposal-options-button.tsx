"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateAllProposalOptionDraftsAction,
  type GenerateAllProposalOptionsResult,
  type GenerateAllProposalOptionsFailure,
} from "@/lib/proposals/synthesis-actions";

/**
 * Sprint S9 — bulk drafting button for proposal options.
 *
 * Client component. Mounted on the engagement proposal page when
 * `isPersisted && aiAvailable`. Calls the server-side orchestrator
 * `generateAllProposalOptionDraftsAction` which iterates each option
 * on the engagement's proposal sequentially.
 *
 * The per-option AI control on `ProposalOptionActionBar` is still
 * available; this button is the engagement-level affordance for
 * "refresh all three SOW shapes from the upstream evidence". The
 * orchestrator preserves pricing, recommendation, option type, and
 * position — only narrative + assumptions + dependencies + risks +
 * deliverables are touched (per the per-option synthesis action's
 * partial-field update contract).
 *
 * Boundary:
 *   - Hidden when no engagement id is supplied.
 *   - Hidden when `aiAvailable` is false (no provider configured).
 *   - Notice copy clarifies operator review is still required.
 */

export interface GenerateAllProposalOptionsButtonProps {
  engagementId: string;
  aiAvailable: boolean;
  /**
   * Optional label override. Defaults to "Draft all options" — the
   * orchestrator does not skip blessed options the way the report
   * bulk-drafter does because proposal options have no per-option
   * approval lifecycle.
   */
  label?: string;
}

type Result =
  | GenerateAllProposalOptionsResult
  | GenerateAllProposalOptionsFailure;

export function GenerateAllProposalOptionsButton({
  engagementId,
  aiAvailable,
  label,
}: GenerateAllProposalOptionsButtonProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  if (!aiAvailable) return null;

  function run() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result: Result = await generateAllProposalOptionDraftsAction({
          engagementId,
        });
        if (result.ok) {
          const detail =
            result.failed > 0
              ? `${result.succeeded} drafted · ${result.failed} failed. Each option is operator-reviewable; pricing, recommendation, and option type were preserved.`
              : `${result.succeeded} proposal options drafted. Pricing, recommendation, and option type were preserved; the operator must review before any client-facing action.`;
          setNotice(detail);
        } else {
          setError(translateError(result.error));
        }
      } catch {
        setError("Bulk drafting failed unexpectedly. Please try again.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-1">
      <Button
        type="button"
        variant="secondary"
        size="md"
        leadingIcon={<Sparkles className="h-4 w-4" />}
        disabled={pending}
        onClick={run}
        title="Draft every proposal option using the AI pipeline. Each draft preserves operator-set commercial levers (pricing, recommendation, option type); the operator must review before any client-facing action."
      >
        {label ?? "Draft all options"}
      </Button>
      {pending ? (
        <span className="text-[11px] text-text-muted">
          Drafting options sequentially…
        </span>
      ) : null}
      {notice ? (
        <span className="text-[11px] leading-relaxed text-status-success">
          {notice}
        </span>
      ) : null}
      {error ? (
        <span className="text-[11px] leading-relaxed text-status-critical">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function translateError(
  code: Exclude<
    GenerateAllProposalOptionsResult | GenerateAllProposalOptionsFailure,
    { ok: true }
  >["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "invalid-engagement":
    case "engagement-not-found":
      return "Engagement not found.";
    case "proposal-not-found":
      return "Initialize the proposal before bulk-drafting.";
    case "ai-not-configured":
      return "AI is not configured for this environment.";
    case "service-error":
    default:
      return "Bulk drafting failed. Please try again.";
  }
}

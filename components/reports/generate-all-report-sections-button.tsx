"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  generateAllReportSectionDraftsAction,
  type GenerateAllReportSectionsResult,
  type GenerateAllReportSectionsFailure,
} from "@/lib/reports/synthesis-actions";

/**
 * Sprint S8 — bulk drafting button.
 *
 * Client component. Mounted on the engagement report page when
 * `isPersisted && aiAvailable`. Calls the server-side orchestrator
 * `generateAllReportSectionDraftsAction` which iterates non-final
 * sections sequentially.
 *
 * The per-section AI control on `ReportSectionActionBar` is still
 * available; this button is the engagement-level affordance for
 * "draft everything I haven't approved yet". The orchestrator
 * preserves source provenance and never auto-approves.
 *
 * Boundary:
 *   - Hidden when no engagement id is supplied.
 *   - Hidden when `aiAvailable` is false (no provider configured).
 *   - Notice copy clarifies operator review is still required.
 */

export interface GenerateAllReportSectionsButtonProps {
  engagementId: string;
  aiAvailable: boolean;
  /**
   * Optional label override. Defaults to "Draft all sections" when
   * `total === 0` (no draftable sections yet), "Draft remaining
   * sections" otherwise.
   */
  label?: string;
}

type Result =
  | GenerateAllReportSectionsResult
  | GenerateAllReportSectionsFailure;

export function GenerateAllReportSectionsButton({
  engagementId,
  aiAvailable,
  label,
}: GenerateAllReportSectionsButtonProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  if (!aiAvailable) return null;

  function run() {
    setError(null);
    setNotice(null);
    startTransition(async () => {
      try {
        const result: Result = await generateAllReportSectionDraftsAction({
          engagementId,
        });
        if (result.ok) {
          const detail =
            result.failed > 0
              ? `${result.succeeded} drafted · ${result.failed} failed · ${result.skippedBlessed} skipped (already approved or final). Each new draft is in needs-review pending operator approval.`
              : `${result.succeeded} sections drafted${result.skippedBlessed > 0 ? ` · ${result.skippedBlessed} skipped (already approved or final)` : ""}. Each new draft is in needs-review pending operator approval.`;
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
        title="Draft every non-final section using the AI pipeline. Each draft is operator-reviewable; nothing is auto-approved."
      >
        {label ?? "Draft remaining sections"}
      </Button>
      {pending ? (
        <span className="text-[11px] text-text-muted">
          Drafting sections sequentially…
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
    GenerateAllReportSectionsResult | GenerateAllReportSectionsFailure,
    { ok: true }
  >["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "invalid-engagement":
    case "engagement-not-found":
      return "Engagement not found.";
    case "report-not-found":
      return "Initialize the report outline before bulk-drafting.";
    case "ai-not-configured":
      return "AI is not configured for this environment.";
    case "service-error":
    default:
      return "Bulk drafting failed. Please try again.";
  }
}

import * as React from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { CopySlopSummary } from "@/lib/ai/copy-slop";

/**
 * Operator-facing copy-check chip.
 *
 * Surfaces the deterministic copy-slop critique attached to an AI-generated
 * draft (see `lib/ai/copy-slop.ts`) so a human sees how much generated-prose
 * slop survived BEFORE approving the draft for client-facing use. It is
 * advisory — it never blocks approval — and carries no client-visible copy;
 * it renders only in the operator workspace.
 *
 * The chip reads the sanitized summary (severity band + flag count + density
 * + categories) — never raw prose — so it is safe to render from persisted
 * run metadata.
 */

const SEVERITY_TONE: Record<CopySlopSummary["severity"], BadgeTone> = {
  none: "success",
  low: "info",
  elevated: "warning",
  high: "risk",
};

const SEVERITY_LABEL: Record<CopySlopSummary["severity"], string> = {
  none: "Copy: clean",
  low: "Copy: minor",
  elevated: "Copy: review",
  high: "Copy: heavy",
};

export function CopyCheckChip({ summary }: { summary: CopySlopSummary }) {
  const tone = SEVERITY_TONE[summary.severity];
  const label = SEVERITY_LABEL[summary.severity];

  // Hover / screen-reader detail — the flag count, density, and which
  // tell-categories fired, so the operator knows where to look.
  const detail =
    summary.severity === "none"
      ? "No copy-slop tells detected in the generated prose."
      : `${summary.flagCount} copy-slop ${
          summary.flagCount === 1 ? "tell" : "tells"
        } (${summary.density.toFixed(1)} per 100 words)` +
        (summary.categories.length > 0
          ? ` — ${summary.categories.join(", ")}`
          : "");

  return (
    <span title={detail} aria-label={`${label}. ${detail}`}>
      <Badge tone={tone} variant="outline">
        {label}
      </Badge>
    </span>
  );
}

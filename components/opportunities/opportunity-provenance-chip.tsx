import * as React from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { OpportunityProvenanceSummary } from "@/lib/opportunities/provenance";

/**
 * Sprint S6 — Opportunity provenance chip.
 *
 * Canon: `docs/45_OPPORTUNITIES_AI_DRAFTING.md` § 5.
 *
 * Renders a compact needs-validation badge on the card list and a
 * fuller breakdown on the detail view. Mirrors the S5 finding-card
 * provenance chip pattern.
 *
 * `summary` is the pure-helper output from
 * `summarizeOpportunityProvenance`. This component does no fetching
 * and no I/O.
 */

export interface OpportunityProvenanceChipProps {
  summary: OpportunityProvenanceSummary;
  /** Compact mode renders only a single needs-validation badge OR
   *  nothing when clean. Full mode renders source counts + the
   *  warning panel. */
  compact?: boolean;
  /** Optional title override; the default reads "Source findings". */
  label?: string;
}

export function OpportunityProvenanceChip({
  summary,
  compact = false,
  label = "Source findings",
}: OpportunityProvenanceChipProps) {
  if (compact) {
    if (!summary.needsValidation) return null;
    return (
      <Badge tone="warning" variant="outline">
        <ShieldAlert className="mr-1 h-3 w-3" />
        Needs validation
      </Badge>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
          {label}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-text-secondary">
          {summary.totalSourceFindings} linked
        </span>
        {summary.strongSourceFindings > 0 ? (
          <Badge tone="success" variant="outline">
            <ShieldCheck className="mr-1 h-3 w-3" />
            {summary.strongSourceFindings} strong
          </Badge>
        ) : null}
        {summary.adequateSourceFindings > 0 ? (
          <Badge tone="info" variant="outline">
            {summary.adequateSourceFindings} adequate
          </Badge>
        ) : null}
        {summary.thinSourceFindings > 0 ? (
          <Badge tone="warning" variant="outline">
            {summary.thinSourceFindings} thin
          </Badge>
        ) : null}
        {summary.needsValidationSourceFindings > 0 &&
        summary.totalSourceFindings > 0 ? (
          <Badge tone="warning" variant="outline">
            <ShieldAlert className="mr-1 h-3 w-3" />
            {summary.needsValidationSourceFindings} of{" "}
            {summary.totalSourceFindings} need validation
          </Badge>
        ) : null}
      </div>
      {summary.needsValidation && summary.needsValidationReason ? (
        <div className="flex items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-2 text-[11px]">
          <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warning" />
          <span className="leading-relaxed text-text-secondary">
            <span className="font-medium text-status-warning">
              Needs validation.
            </span>{" "}
            {summary.needsValidationReason}
          </span>
        </div>
      ) : null}
    </div>
  );
}

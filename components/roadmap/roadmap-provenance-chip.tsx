import * as React from "react";
import { ShieldAlert, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { RoadmapItemProvenanceSummary } from "@/lib/roadmap/provenance";

/**
 * Sprint S7 — Roadmap item provenance chip.
 *
 * Canon: `docs/48_ROADMAP_AI_DRAFTING.md` § 5.
 *
 * Renders a compact needs-validation badge on the card list and a
 * fuller breakdown on the detail view. Mirrors the S5 finding-card +
 * S6 opportunity-card provenance chip patterns.
 *
 * `summary` is the pure-helper output from
 * `summarizeRoadmapItemProvenance`. This component does no fetching
 * and no I/O.
 */

export interface RoadmapProvenanceChipProps {
  summary: RoadmapItemProvenanceSummary;
  /** Compact mode renders only a single needs-validation badge OR
   *  nothing when clean. Full mode renders the warning panel. */
  compact?: boolean;
}

export function RoadmapProvenanceChip({
  summary,
  compact = false,
}: RoadmapProvenanceChipProps) {
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
          Source opportunity
        </span>
        {summary.hasSourceOpportunity ? (
          summary.sourceOpportunityInactive ? (
            <Badge tone="warning" variant="outline">
              <ShieldAlert className="mr-1 h-3 w-3" />
              Linked opportunity inactive
            </Badge>
          ) : summary.needsValidation ? (
            <Badge tone="warning" variant="outline">
              <ShieldAlert className="mr-1 h-3 w-3" />
              Needs validation
            </Badge>
          ) : (
            <Badge tone="success" variant="outline">
              <ShieldCheck className="mr-1 h-3 w-3" />
              Linked · provenance clean
            </Badge>
          )
        ) : (
          <Badge tone="warning" variant="outline">
            <ShieldAlert className="mr-1 h-3 w-3" />
            No source opportunity
          </Badge>
        )}
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

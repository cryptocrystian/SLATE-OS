import * as React from "react";
import { cn } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { OpportunityArea } from "@/lib/scorecard/types";

const categoryTone: Record<OpportunityArea["category"], BadgeTone> = {
  GrowthOps: "info",
  AdvisoryOps: "brand",
  "AI Systems": "ai",
};

export interface OpportunityAreaCardProps {
  rank: number;
  opportunity: OpportunityArea;
}

export function OpportunityAreaCard({
  rank,
  opportunity,
}: OpportunityAreaCardProps) {
  return (
    <article className="relative flex flex-col gap-3 rounded-xl border border-border-subtle bg-bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full border border-border-strong bg-bg-elevated font-mono text-xs font-semibold text-text-secondary",
            )}
            aria-hidden
          >
            {rank}
          </span>
          <Badge tone={categoryTone[opportunity.category]}>
            {opportunity.category}
          </Badge>
        </div>
      </div>
      <h3 className="text-base font-semibold tracking-tight text-text-primary">
        {opportunity.title}
      </h3>
      <p className="text-xs leading-relaxed text-text-muted">
        {opportunity.summary}
      </p>
      <p className="border-t border-border-subtle pt-3 text-[11px] leading-relaxed text-text-secondary">
        <span className="font-medium text-text-primary">Validate:</span>{" "}
        {opportunity.validationNote}
      </p>
    </article>
  );
}

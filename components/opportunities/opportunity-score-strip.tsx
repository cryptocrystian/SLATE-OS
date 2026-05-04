import * as React from "react";
import { cn } from "@/lib/utils";
import type { Opportunity } from "@/lib/opportunities/types";

export interface OpportunityScoreStripProps {
  opportunity: Opportunity;
}

export function OpportunityScoreStrip({
  opportunity,
}: OpportunityScoreStripProps) {
  const items: Array<{ label: string; value: number; tone: "info" | "neutral" | "warning" }> = [
    { label: "Impact", value: opportunity.businessImpactScore, tone: "info" },
    { label: "Complexity", value: opportunity.complexityScore, tone: "neutral" },
    { label: "Risk", value: opportunity.riskScore, tone: "warning" },
    {
      label: "Time to value",
      value: opportunity.timeToValueScore,
      tone: "info",
    },
    {
      label: "Adoption",
      value: opportunity.adoptionLikelihoodScore,
      tone: "neutral",
    },
    {
      label: "Strategic value",
      value: opportunity.strategicValueScore,
      tone: "info",
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {items.map((item) => (
        <Score key={item.label} {...item} />
      ))}
    </div>
  );
}

function Score({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "info" | "neutral" | "warning";
}) {
  const toneText: Record<typeof tone, string> = {
    info: "text-status-info",
    neutral: "text-text-secondary",
    warning: "text-status-warning",
  };
  const toneBar: Record<typeof tone, string> = {
    info: "bg-status-info",
    neutral: "bg-text-secondary",
    warning: "bg-status-warning",
  };
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-bg-elevated/50 p-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] uppercase tracking-[0.12em] text-text-muted">
          {label}
        </span>
        <span
          className={cn("font-mono text-base font-semibold tabular-nums", toneText[tone])}
        >
          {value}
        </span>
      </div>
      <div className="h-1 w-full overflow-hidden rounded-full bg-white/[0.05]">
        <span
          className={cn("block h-full rounded-full", toneBar[tone])}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

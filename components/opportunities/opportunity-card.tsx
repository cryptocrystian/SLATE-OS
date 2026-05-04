"use client";

import * as React from "react";
import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { OpportunityPriorityChip } from "./opportunity-priority-chip";
import {
  CATEGORY_TONE,
  EVIDENCE_LABEL,
  EVIDENCE_TONE,
} from "@/lib/opportunities/helpers";
import type { Opportunity } from "@/lib/opportunities/types";

const CATEGORY_TONE_MAP: Record<string, BadgeTone> = {
  info: "info",
  warning: "warning",
  neutral: "neutral",
  brand: "brand",
  ai: "ai",
  success: "success",
};

const EVIDENCE_TONE_MAP: Record<string, BadgeTone> = {
  success: "success",
  info: "info",
  warning: "warning",
};

export interface OpportunityCardProps {
  opportunity: Opportunity;
  selected?: boolean;
  onClick?: () => void;
  variant?: "default" | "compact";
}

export function OpportunityCard({
  opportunity,
  selected,
  onClick,
  variant = "default",
}: OpportunityCardProps) {
  const isCompact = variant === "compact";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`${opportunity.title}, ${opportunity.priority}`}
      className={cn(
        "flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors",
        selected
          ? "border-brand-primary/60 bg-brand-primary/[0.06]"
          : "border-border-subtle bg-bg-surface hover:border-border-strong hover:bg-bg-elevated/60",
        isCompact ? "gap-2 p-3" : "gap-3 p-4",
      )}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge
          tone={CATEGORY_TONE_MAP[CATEGORY_TONE[opportunity.category]] ?? "neutral"}
        >
          {opportunity.category}
        </Badge>
        <OpportunityPriorityChip priority={opportunity.priority} />
      </div>
      <p
        className={cn(
          "font-medium leading-snug text-text-primary",
          isCompact ? "text-sm" : "text-sm sm:text-[15px]",
        )}
      >
        {opportunity.title}
      </p>

      <div className="grid grid-cols-3 gap-2 pt-1">
        <Cell label="Impact" value={opportunity.businessImpactScore} tone="info" />
        <Cell
          label="Complexity"
          value={opportunity.complexityScore}
          tone="neutral"
        />
        <Cell label="TTV" value={opportunity.timeToValueScore} tone="info" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px]">
        <Badge
          tone={EVIDENCE_TONE_MAP[EVIDENCE_TONE[opportunity.evidenceStrength]] ?? "neutral"}
          variant="outline"
        >
          {EVIDENCE_LABEL[opportunity.evidenceStrength]}
        </Badge>
        <span className="inline-flex items-center gap-1 font-mono tabular-nums text-text-muted">
          <Sparkles aria-hidden className="h-3 w-3 text-practice-ai" />
          {opportunity.relatedFindingIds.length} finding
          {opportunity.relatedFindingIds.length === 1 ? "" : "s"}
        </span>
      </div>
    </button>
  );
}

function Cell({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "info" | "neutral";
}) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-elevated/50 px-2 py-1.5">
      <div className="text-[9px] uppercase tracking-[0.12em] text-text-muted">
        {label}
      </div>
      <div
        className={cn(
          "font-mono text-sm font-semibold tabular-nums",
          tone === "info" ? "text-text-primary" : "text-text-secondary",
        )}
      >
        {value}
      </div>
    </div>
  );
}

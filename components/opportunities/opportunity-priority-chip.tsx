import * as React from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { PRIORITY_LABEL, PRIORITY_TONE } from "@/lib/opportunities/helpers";
import type { OpportunityPriority } from "@/lib/opportunities/types";

const TONE_MAP: Record<string, BadgeTone> = {
  success: "success",
  info: "info",
  warning: "warning",
  neutral: "neutral",
  risk: "risk",
  brand: "brand",
};

export interface OpportunityPriorityChipProps {
  priority: OpportunityPriority;
  className?: string;
}

export function OpportunityPriorityChip({
  priority,
  className,
}: OpportunityPriorityChipProps) {
  return (
    <Badge tone={TONE_MAP[PRIORITY_TONE[priority]] ?? "neutral"} dot className={className}>
      {PRIORITY_LABEL[priority]}
    </Badge>
  );
}

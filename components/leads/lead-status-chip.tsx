import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { LEAD_STATUS_LABEL, LEAD_STATUS_TONE } from "@/lib/leads/helpers";
import type { LeadStatus } from "@/lib/leads/types";

export interface LeadStatusChipProps {
  status: LeadStatus;
  className?: string;
}

export function LeadStatusChip({ status, className }: LeadStatusChipProps) {
  return (
    <Badge tone={LEAD_STATUS_TONE[status]} dot className={className}>
      {LEAD_STATUS_LABEL[status]}
    </Badge>
  );
}

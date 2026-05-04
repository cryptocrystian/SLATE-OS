import * as React from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  PROPOSAL_STATUS_LABEL,
  PROPOSAL_STATUS_TONE,
} from "@/lib/proposals/helpers";
import type { ProposalStatus } from "@/lib/proposals/types";

const TONE_MAP: Record<string, BadgeTone> = {
  info: "info",
  warning: "warning",
  success: "success",
  brand: "brand",
};

export interface ProposalStatusChipProps {
  status: ProposalStatus;
  className?: string;
}

export function ProposalStatusChip({ status, className }: ProposalStatusChipProps) {
  return (
    <Badge
      tone={TONE_MAP[PROPOSAL_STATUS_TONE[status]] ?? "neutral"}
      dot
      className={className}
    >
      {PROPOSAL_STATUS_LABEL[status]}
    </Badge>
  );
}

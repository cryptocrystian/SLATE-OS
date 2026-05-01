import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/engagements/helpers";
import type { EngagementStatus } from "@/lib/engagements/types";

export interface EngagementStatusChipProps {
  status: EngagementStatus;
  className?: string;
}

export function EngagementStatusChip({
  status,
  className,
}: EngagementStatusChipProps) {
  return (
    <Badge tone={STATUS_TONE[status]} dot className={className}>
      {STATUS_LABEL[status]}
    </Badge>
  );
}

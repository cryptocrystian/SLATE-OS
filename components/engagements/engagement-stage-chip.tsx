import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { STAGE_LABEL } from "@/lib/engagements/helpers";
import type { EngagementStage } from "@/lib/engagements/types";

export interface EngagementStageChipProps {
  stage: EngagementStage;
  className?: string;
}

export function EngagementStageChip({
  stage,
  className,
}: EngagementStageChipProps) {
  return (
    <Badge tone="brand" variant="outline" className={className}>
      Stage · {STAGE_LABEL[stage]}
    </Badge>
  );
}

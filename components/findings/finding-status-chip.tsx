import * as React from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  REVIEW_STATUS_LABEL,
  REVIEW_STATUS_TONE,
} from "@/lib/findings/helpers";
import type { FindingReviewStatus } from "@/lib/findings/types";

const TONE_MAP: Record<string, BadgeTone> = {
  info: "info",
  warning: "warning",
  success: "success",
  neutral: "neutral",
  risk: "risk",
  brand: "brand",
};

export interface FindingStatusChipProps {
  status: FindingReviewStatus;
  className?: string;
}

export function FindingStatusChip({ status, className }: FindingStatusChipProps) {
  return (
    <Badge tone={TONE_MAP[REVIEW_STATUS_TONE[status]] ?? "neutral"} dot className={className}>
      {REVIEW_STATUS_LABEL[status]}
    </Badge>
  );
}

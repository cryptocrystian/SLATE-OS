import * as React from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  SECTION_STATUS_LABEL,
  SECTION_STATUS_TONE,
} from "@/lib/reports/helpers";
import type { ReportSectionStatus } from "@/lib/reports/types";

const TONE_MAP: Record<string, BadgeTone> = {
  info: "info",
  warning: "warning",
  success: "success",
  neutral: "neutral",
  brand: "brand",
};

export interface ReportSectionStatusChipProps {
  status: ReportSectionStatus;
  className?: string;
}

export function ReportSectionStatusChip({
  status,
  className,
}: ReportSectionStatusChipProps) {
  return (
    <Badge
      tone={TONE_MAP[SECTION_STATUS_TONE[status]] ?? "neutral"}
      dot
      className={className}
    >
      {SECTION_STATUS_LABEL[status]}
    </Badge>
  );
}

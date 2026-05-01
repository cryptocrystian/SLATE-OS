import * as React from "react";
import { cn } from "@/lib/utils";
import {
  CONFIDENCE_LABEL,
  CONFIDENCE_TONE,
} from "@/lib/findings/helpers";
import type { FindingConfidence } from "@/lib/findings/types";

const TONE_TEXT: Record<string, string> = {
  success: "text-status-success",
  info: "text-status-info",
  warning: "text-status-warning",
  risk: "text-status-risk",
};

const TONE_BAR: Record<string, string> = {
  success: "bg-status-success",
  info: "bg-status-info",
  warning: "bg-status-warning",
  risk: "bg-status-risk",
};

const CONFIDENCE_PCT: Record<FindingConfidence, number> = {
  high: 90,
  medium: 65,
  low: 40,
  "needs-evidence": 20,
};

export interface ConfidenceIndicatorProps {
  confidence: FindingConfidence;
  variant?: "inline" | "block";
  className?: string;
}

export function ConfidenceIndicator({
  confidence,
  variant = "inline",
  className,
}: ConfidenceIndicatorProps) {
  const tone = CONFIDENCE_TONE[confidence];
  if (variant === "inline") {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-border-subtle bg-bg-elevated/50 px-2 py-0.5 text-[11px] font-medium",
          TONE_TEXT[tone],
          className,
        )}
        aria-label={`Confidence: ${CONFIDENCE_LABEL[confidence]}`}
      >
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 rounded-full", TONE_BAR[tone])}
        />
        {CONFIDENCE_LABEL[confidence]}
      </span>
    );
  }
  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
          Confidence
        </span>
        <span className={cn("text-xs font-medium", TONE_TEXT[tone])}>
          {CONFIDENCE_LABEL[confidence]}
        </span>
      </div>
      <div
        className="h-1 w-full overflow-hidden rounded-full bg-white/[0.05]"
        role="meter"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={CONFIDENCE_PCT[confidence]}
        aria-label={`Confidence ${CONFIDENCE_LABEL[confidence]}`}
      >
        <span
          className={cn("block h-full rounded-full", TONE_BAR[tone])}
          style={{ width: `${CONFIDENCE_PCT[confidence]}%` }}
        />
      </div>
    </div>
  );
}

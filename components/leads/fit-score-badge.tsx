import * as React from "react";
import { Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { fitCategoryFor } from "@/lib/leads/helpers";

const TONE_CLASSES: Record<
  "prime" | "good" | "nurture" | "disqualify",
  { surface: string; text: string; border: string; bar: string }
> = {
  prime: {
    surface: "bg-status-success/10",
    border: "border-status-success/25",
    text: "text-status-success",
    bar: "bg-status-success",
  },
  good: {
    surface: "bg-status-info/10",
    border: "border-status-info/25",
    text: "text-status-info",
    bar: "bg-status-info",
  },
  nurture: {
    surface: "bg-status-warning/10",
    border: "border-status-warning/25",
    text: "text-status-warning",
    bar: "bg-status-warning",
  },
  disqualify: {
    surface: "bg-status-risk/10",
    border: "border-status-risk/25",
    text: "text-status-risk",
    bar: "bg-status-risk",
  },
};

export interface FitScoreBadgeProps {
  value: number;
  size?: "sm" | "md";
  /** Show the explicit "Internal-only" affordance. Default: true. */
  showInternalLabel?: boolean;
  className?: string;
}

export function FitScoreBadge({
  value,
  size = "md",
  showInternalLabel = true,
  className,
}: FitScoreBadgeProps) {
  const category = fitCategoryFor(value);
  const tone = TONE_CLASSES[category.id];
  const isSm = size === "sm";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2.5 rounded-md border",
        tone.surface,
        tone.border,
        isSm ? "px-2 py-1" : "px-3 py-1.5",
        className,
      )}
      aria-label={`Internal Saipien Fit Score ${value} of 100, ${category.label}`}
    >
      {showInternalLabel ? (
        <span
          className={cn(
            "flex items-center gap-1 uppercase tracking-[0.14em] text-text-muted",
            isSm ? "text-[9px]" : "text-[10px]",
          )}
          title="Internal Saipien Fit Score — never shown to prospects"
        >
          <Lock aria-hidden className={cn(isSm ? "h-2.5 w-2.5" : "h-3 w-3")} />
          Internal Fit
        </span>
      ) : null}
      <span
        className={cn(
          "font-mono font-semibold tabular-nums",
          tone.text,
          isSm ? "text-sm" : "text-base",
        )}
      >
        {value}
      </span>
      <span
        className={cn(
          "border-l pl-2 uppercase tracking-[0.14em]",
          tone.text,
          tone.border,
          isSm ? "text-[9px]" : "text-[10px]",
        )}
      >
        {category.short}
      </span>
    </div>
  );
}

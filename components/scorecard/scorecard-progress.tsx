import * as React from "react";
import { cn } from "@/lib/utils";
import { SECTIONS } from "@/lib/scorecard/types";

export interface ScorecardProgressProps {
  currentIdx: number;
}

export function ScorecardProgress({ currentIdx }: ScorecardProgressProps) {
  const total = SECTIONS.length;
  const pctComplete = Math.round((currentIdx / (total - 1)) * 100);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between text-[11px] font-medium uppercase tracking-[0.14em] text-text-muted">
        <span>
          Section <span className="font-mono text-text-secondary">{currentIdx + 1}</span> of{" "}
          <span className="font-mono text-text-secondary">{total}</span>
        </span>
        <span className="font-mono text-text-muted">{pctComplete}% complete</span>
      </div>
      <div
        className="flex w-full items-center gap-1"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={currentIdx + 1}
        aria-label={`Scorecard section ${currentIdx + 1} of ${total}`}
      >
        {SECTIONS.map((section, idx) => {
          const isComplete = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          return (
            <span
              key={section.id}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                isComplete && "bg-brand-primary/70",
                isCurrent && "bg-brand-primary",
                !isComplete && !isCurrent && "bg-white/[0.06]",
              )}
            />
          );
        })}
      </div>
    </div>
  );
}

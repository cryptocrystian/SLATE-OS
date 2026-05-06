import * as React from "react";
import { Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  STAGES,
  STAGE_DESCRIPTION,
  STAGE_LABEL,
  stageIndex,
} from "@/lib/engagements/helpers";
import type { EngagementStage } from "@/lib/engagements/types";

export interface EngagementStageTrackerProps {
  currentStage: EngagementStage;
  className?: string;
  /** Stages that should render a subtle AI affordance next to their label.
   *  Server-resolved on the engagement detail page from `isAiConfigured()`
   *  + the engagement being a real persisted UUID. Empty/undefined for
   *  legacy mock slug engagements and for environments without an AI
   *  provider key configured. */
  aiAvailableStages?: EngagementStage[];
}

export function EngagementStageTracker({
  currentStage,
  className,
  aiAvailableStages,
}: EngagementStageTrackerProps) {
  const currentIdx = stageIndex(currentStage);
  const aiStages = new Set(aiAvailableStages ?? []);

  return (
    <div
      className={cn(
        "rounded-xl border border-border-subtle bg-bg-surface p-5 shadow-card sm:p-6",
        className,
      )}
      aria-label={`Engagement stage: ${STAGE_LABEL[currentStage]}`}
    >
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            AI Opportunity Sprint flow
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-brand-primary">
            Stage {currentIdx + 1} of {STAGES.length} · {STAGE_LABEL[currentStage]}
          </span>
        </div>

        {/* Desktop: horizontal */}
        <ol
          className="hidden gap-3 lg:grid"
          style={{ gridTemplateColumns: `repeat(${STAGES.length}, minmax(0, 1fr))` }}
        >
          {STAGES.map((stage, i) => {
            const isComplete = i < currentIdx;
            const isCurrent = i === currentIdx;
            return (
              <li key={stage} className="flex flex-col gap-2">
                <span
                  className={cn(
                    "h-1 w-full rounded-full transition-colors",
                    isComplete && "bg-brand-primary/70",
                    isCurrent && "bg-brand-primary",
                    !isComplete && !isCurrent && "bg-white/[0.06]",
                  )}
                />
                <div className="flex items-center gap-2">
                  <span
                    aria-hidden
                    className={cn(
                      "flex h-5 w-5 items-center justify-center rounded-full border font-mono text-[10px]",
                      isComplete &&
                        "border-brand-primary/60 bg-brand-primary/15 text-brand-primary",
                      isCurrent &&
                        "border-brand-primary bg-brand-primary text-text-inverse",
                      !isComplete &&
                        !isCurrent &&
                        "border-border-strong bg-bg-elevated text-text-muted",
                    )}
                  >
                    {isComplete ? <Check className="h-3 w-3" /> : i + 1}
                  </span>
                  <span
                    className={cn(
                      "text-sm font-medium tracking-tight",
                      isCurrent
                        ? "text-text-primary"
                        : isComplete
                          ? "text-text-secondary"
                          : "text-text-muted",
                    )}
                  >
                    {STAGE_LABEL[stage]}
                  </span>
                  {aiStages.has(stage) ? (
                    <span
                      title="AI draft findings available"
                      aria-label="AI draft findings available"
                      className="inline-flex shrink-0 text-practice-ai"
                    >
                      <Sparkles aria-hidden className="h-3 w-3" />
                    </span>
                  ) : null}
                </div>
                <p className="text-[11px] leading-relaxed text-text-muted">
                  {STAGE_DESCRIPTION[stage]}
                </p>
              </li>
            );
          })}
        </ol>

        {/* Mobile + tablet: vertical */}
        <ol className="flex flex-col gap-2 lg:hidden">
          {STAGES.map((stage, i) => {
            const isComplete = i < currentIdx;
            const isCurrent = i === currentIdx;
            return (
              <li
                key={stage}
                className={cn(
                  "flex items-start gap-3 rounded-md border p-3",
                  isCurrent
                    ? "border-brand-primary/60 bg-brand-primary/[0.06]"
                    : isComplete
                      ? "border-border-subtle bg-bg-elevated/30"
                      : "border-border-subtle bg-bg-surface/40",
                )}
              >
                <span
                  aria-hidden
                  className={cn(
                    "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[10px]",
                    isComplete &&
                      "border-brand-primary/60 bg-brand-primary/15 text-brand-primary",
                    isCurrent &&
                      "border-brand-primary bg-brand-primary text-text-inverse",
                    !isComplete &&
                      !isCurrent &&
                      "border-border-strong bg-bg-elevated text-text-muted",
                  )}
                >
                  {isComplete ? <Check className="h-3 w-3" /> : i + 1}
                </span>
                <div className="flex flex-col gap-0.5">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5 text-sm font-medium tracking-tight",
                      isCurrent ? "text-text-primary" : "text-text-secondary",
                    )}
                  >
                    {STAGE_LABEL[stage]}
                    {aiStages.has(stage) ? (
                      <span
                        title="AI draft findings available"
                        aria-label="AI draft findings available"
                        className="inline-flex shrink-0 text-practice-ai"
                      >
                        <Sparkles aria-hidden className="h-3 w-3" />
                      </span>
                    ) : null}
                  </span>
                  <p className="text-[11px] leading-relaxed text-text-muted">
                    {STAGE_DESCRIPTION[stage]}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

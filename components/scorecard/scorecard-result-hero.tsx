import * as React from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { ScoreResult } from "@/lib/scorecard/types";

export interface ScorecardResultHeroProps {
  result: ScoreResult;
  firstName?: string;
  company?: string;
}

export function ScorecardResultHero({
  result,
  firstName,
  company,
}: ScorecardResultHeroProps) {
  const greeting = firstName
    ? `Result for ${firstName}${company ? ` at ${company}` : ""}`
    : company
      ? `Result for ${company}`
      : "Your scorecard result";

  return (
    <header className="flex flex-col gap-6 border-b border-border-subtle pb-10">
      <div className="flex flex-col items-start gap-3">
        <Badge tone="ai" dot>
          AI Workflow Scorecard · Result
        </Badge>
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
          {greeting}
        </span>
      </div>
      <h1 className="text-balance text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl">
        <span className="text-text-secondary">You look like a </span>
        <span className="text-brand-primary">
          {result.classification.label}
        </span>
        <span className="text-text-secondary">.</span>
      </h1>
      <p className="max-w-3xl text-base leading-relaxed text-text-secondary">
        {result.classification.description}
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1 text-xs text-text-muted">
        <span className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-practice-ai" />
          Self-reported · directional only
        </span>
        <span aria-hidden className="text-text-disabled">
          ·
        </span>
        <span>Validate with a paid AI Opportunity Sprint</span>
      </div>
    </header>
  );
}

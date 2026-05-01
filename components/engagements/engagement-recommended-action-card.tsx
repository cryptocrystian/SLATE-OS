import * as React from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Engagement } from "@/lib/engagements/types";

export interface EngagementRecommendedActionCardProps {
  engagement: Engagement;
}

export function EngagementRecommendedActionCard({
  engagement,
}: EngagementRecommendedActionCardProps) {
  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-border-strong bg-bg-elevated/80 p-5 shadow-elevated sm:p-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-10 -top-20 -z-10 h-32 bg-gradient-to-b from-brand-primary/15 via-transparent to-transparent blur-2xl"
      />
      <div className="flex flex-col gap-4">
        <Badge tone="brand" dot variant="soft" className="self-start">
          <Sparkles className="mr-1.5 h-3 w-3" />
          Recommended action
        </Badge>
        <h2 className="text-lg font-semibold tracking-tight text-text-primary">
          {engagement.recommendedAction.headline}
        </h2>
        <p className="text-xs leading-relaxed text-text-secondary">
          {engagement.recommendedAction.detail}
        </p>
        <Button
          variant="primary"
          size="md"
          trailingIcon={<ArrowRight className="h-4 w-4" />}
          className="self-start"
        >
          {engagement.recommendedAction.cta}
        </Button>
        <p className="border-t border-border-subtle pt-3 text-[11px] leading-relaxed text-text-muted">
          Action stays mock for now — wiring lands when stakeholder intake,
          findings, scoring, report, and proposal modules ship in Sprints 5–7.
        </p>
      </div>
    </section>
  );
}

import * as React from "react";
import Link from "next/link";
import { ArrowRight, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Engagement } from "@/lib/engagements/types";

export interface EngagementRecommendedActionCardProps {
  engagement: Engagement;
  /** When provided, the CTA links here. When absent, the CTA renders as
   *  a locked button with the optional `lockedNote` (e.g. "Sprint 7"). */
  href?: string;
  lockedNote?: string;
}

export function EngagementRecommendedActionCard({
  engagement,
  href,
  lockedNote,
}: EngagementRecommendedActionCardProps) {
  const accessibleLockName = lockedNote
    ? `${engagement.recommendedAction.cta}, locked until ${lockedNote}`
    : `${engagement.recommendedAction.cta}, locked`;

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

        {href ? (
          <Link href={href} className="self-start">
            <Button
              variant="primary"
              size="md"
              trailingIcon={<ArrowRight className="h-4 w-4" />}
            >
              {engagement.recommendedAction.cta}
            </Button>
          </Link>
        ) : (
          <button
            type="button"
            disabled
            aria-disabled
            aria-label={accessibleLockName}
            className="inline-flex w-full cursor-not-allowed items-center justify-between gap-2 self-start rounded-md border border-border-subtle bg-bg-elevated/60 px-4 py-2 text-left text-xs font-medium text-text-secondary opacity-80 sm:w-auto"
          >
            <span className="inline-flex items-center gap-2">
              <Lock aria-hidden className="h-3 w-3 text-text-muted" />
              {engagement.recommendedAction.cta}
            </span>
            {lockedNote ? (
              <span
                aria-hidden
                className="ml-2 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted"
              >
                {lockedNote}
              </span>
            ) : null}
          </button>
        )}

        <p className="border-t border-border-subtle pt-3 text-[11px] leading-relaxed text-text-muted">
          {href
            ? "Action stays mock for now — wiring lands when stakeholder intake, findings, scoring, report, and proposal modules ship in Sprints 5–7."
            : "Destination activates with the sprint that ships its module."}
        </p>
      </div>
    </section>
  );
}

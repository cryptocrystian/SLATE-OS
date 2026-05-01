import * as React from "react";
import Link from "next/link";
import { ArrowRight, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ResultClassification } from "@/lib/scorecard/types";

export interface RecommendedNextStepCardProps {
  classification: ResultClassification;
}

export function RecommendedNextStepCard({
  classification,
}: RecommendedNextStepCardProps) {
  const step = classification.recommendedNextStep;
  return (
    <section className="relative isolate overflow-hidden rounded-2xl border border-border-strong bg-bg-elevated/80 p-6 shadow-elevated sm:p-8">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-10 -top-20 -z-10 h-40 bg-gradient-to-b from-brand-primary/15 via-transparent to-transparent blur-2xl"
      />
      <div className="flex flex-col gap-5">
        <Badge tone="brand" dot variant="soft" className="self-start">
          Recommended next step
        </Badge>
        <h2 className="text-balance text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          {step.title}
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
          {step.description}
        </p>
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Link href="/apply/ai-systems-review">
            <Button
              variant="primary"
              size="lg"
              leadingIcon={<ClipboardCheck className="h-4 w-4" />}
              trailingIcon={<ArrowRight className="h-4 w-4" />}
            >
              {step.cta}
            </Button>
          </Link>
          {step.secondaryCta ? (
            <Link href="/scorecard#what-you-get">
              <Button variant="ghost" size="lg">
                {step.secondaryCta}
              </Button>
            </Link>
          ) : null}
        </div>
        <p className="border-t border-border-subtle pt-4 text-[11px] leading-relaxed text-text-muted">
          The Diagnostic Review is invite-only. Not every applicant becomes a
          paid engagement — Saipien Labs prioritizes prospects where AI is
          genuinely likely to create operating leverage.
        </p>
      </div>
    </section>
  );
}

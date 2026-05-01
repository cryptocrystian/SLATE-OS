import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Calendar, ClipboardList, MailCheck } from "lucide-react";
import { PublicAssessmentShell } from "@/components/scorecard/public-assessment-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Apply for the AI Systems Review",
  description:
    "The AI Systems Review is an invite-based diagnostic from Saipien Labs. Application flow coming soon.",
};

const STEPS = [
  {
    icon: ClipboardList,
    title: "Submit a short application",
    description:
      "Confirms scorecard context, decision-maker involvement, and rough investment posture. About 5 minutes.",
  },
  {
    icon: Calendar,
    title: "Diagnostic intro call",
    description:
      "30 minutes with a Saipien Labs strategist to validate fit and align on what an AI Opportunity Sprint would actually look like for the business.",
  },
  {
    icon: MailCheck,
    title: "Sprint scoping or honest pass",
    description:
      "If the fit is real, you get a tailored AI Opportunity Sprint scope. If it isn't, you get an honest write-up of why — no pressure to engage.",
  },
];

export default function ApplyForAISystemsReviewPage() {
  return (
    <PublicAssessmentShell width="narrow">
      <div className="flex flex-col gap-12 sm:gap-16">
        <header className="flex flex-col gap-5">
          <Badge tone="brand" dot variant="soft" className="self-start">
            Invite-based · Diagnostic Review
          </Badge>
          <h1 className="text-balance text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl">
            Apply for the AI Systems Review.
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-text-secondary">
            The AI Systems Review is the next step after a strong AI Workflow
            Scorecard. It is a paid AI Opportunity Sprint that pairs
            stakeholder discovery, systems review, and consultant judgment
            with directional findings — the part the free scorecard does not
            do.
          </p>
          <p className="max-w-2xl text-sm leading-relaxed text-text-muted">
            The Diagnostic Review is selective. Saipien Labs prioritizes
            prospects where AI is genuinely likely to create operating
            leverage, and it is fine to recommend against an engagement when
            the fit isn’t there.
          </p>
        </header>

        <section className="flex flex-col gap-5">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            How the application flow will work
          </span>
          <div className="grid grid-cols-1 gap-3">
            {STEPS.map((step, i) => {
              const Icon = step.icon;
              return (
                <Card key={step.title} variant="base">
                  <CardBody className="flex items-start gap-4 p-5 sm:p-6">
                    <span
                      aria-hidden
                      className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-practice-ai"
                    >
                      <Icon className="h-4 w-4" />
                    </span>
                    <div className="flex flex-1 flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
                          Step {i + 1}
                        </span>
                      </div>
                      <h2 className="text-base font-semibold tracking-tight text-text-primary">
                        {step.title}
                      </h2>
                      <p className="text-xs leading-relaxed text-text-muted">
                        {step.description}
                      </p>
                    </div>
                  </CardBody>
                </Card>
              );
            })}
          </div>
        </section>

        <section className="relative isolate overflow-hidden rounded-2xl border border-border-strong bg-bg-elevated/80 p-6 shadow-elevated sm:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-x-10 -top-20 -z-10 h-40 bg-gradient-to-b from-brand-primary/15 via-transparent to-transparent blur-2xl"
          />
          <div className="flex flex-col gap-4">
            <Badge tone="warning" dot variant="soft" className="self-start">
              Application flow coming soon
            </Badge>
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
              The full application is being built.
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
              Until the application form is live, return to your scorecard
              result for the directional read or revisit the diagnostic
              overview. The internal Saipien Labs team uses SLATE to review
              high-fit scorecards as they come in.
            </p>
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
              <Link href="/scorecard/results">
                <Button
                  variant="primary"
                  size="lg"
                  trailingIcon={<ArrowRight className="h-4 w-4" />}
                >
                  Back to my scorecard result
                </Button>
              </Link>
              <Link href="/scorecard">
                <Button
                  variant="ghost"
                  size="lg"
                  leadingIcon={<ArrowLeft className="h-4 w-4" />}
                >
                  Scorecard overview
                </Button>
              </Link>
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-border-subtle bg-bg-surface/60 p-5 sm:p-6">
          <h3 className="text-sm font-semibold tracking-tight text-text-primary">
            What the AI Opportunity Sprint includes
          </h3>
          <p className="mt-2 text-xs leading-relaxed text-text-muted">
            Stakeholder intake, systems review, workflow mapping, opportunity
            scoring, a 30/60/90-day roadmap, and a SOW with three tiered
            options (Quick-Win Build, AI Workflow System, or Managed AI
            Partner). Every output goes through human review before it
            becomes a recommendation.
          </p>
        </section>
      </div>
    </PublicAssessmentShell>
  );
}

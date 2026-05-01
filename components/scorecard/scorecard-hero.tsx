import * as React from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function ScorecardHero() {
  return (
    <section className="relative grid grid-cols-1 gap-10 lg:grid-cols-12 lg:gap-12">
      <div className="flex flex-col gap-6 lg:col-span-7 lg:gap-8">
        <Badge tone="ai" dot variant="soft" className="self-start">
          AI Workflow Scorecard
        </Badge>
        <h1 className="text-balance text-4xl font-semibold tracking-tight text-text-primary sm:text-5xl lg:text-[56px] lg:leading-[1.05]">
          Where could AI{" "}
          <span className="text-brand-primary">actually create value</span> in
          your business?
        </h1>
        <p className="max-w-xl text-base leading-relaxed text-text-secondary sm:text-lg">
          A short diagnostic to identify your AI readiness, workflow friction,
          systems maturity, and likely opportunity areas. Built by Saipien
          Labs, run inside SLATE.
        </p>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
          <Link href="/scorecard/start">
            <Button
              variant="primary"
              size="lg"
              trailingIcon={<ArrowRight className="h-4 w-4" />}
            >
              Start the Scorecard
            </Button>
          </Link>
          <Link href="#what-you-get">
            <Button variant="ghost" size="lg">
              See what you’ll get
            </Button>
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-2 text-xs text-text-muted">
          <span>~7 minutes</span>
          <span aria-hidden className="text-text-disabled">
            ·
          </span>
          <span>8 sections</span>
          <span aria-hidden className="text-text-disabled">
            ·
          </span>
          <span>Self-reported · directional only</span>
        </div>
      </div>

      <div className="relative lg:col-span-5">
        <ScorecardResultPreview />
      </div>
    </section>
  );
}

function ScorecardResultPreview() {
  return (
    <div className="relative isolate">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-3xl bg-gradient-to-br from-brand-primary/15 via-transparent to-practice-ai/10 blur-2xl"
      />
      <div className="relative overflow-hidden rounded-2xl border border-border-strong bg-bg-elevated/80 shadow-elevated">
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-3 text-[11px] text-text-muted">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-status-success" />
            <span className="font-mono uppercase tracking-[0.14em]">
              Result preview
            </span>
            <span className="rounded-full border border-border-strong bg-bg-page px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-text-muted">
              Sample
            </span>
          </div>
          <span className="font-mono">Audit-ready</span>
        </div>

        <div className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-practice-ai" />
            <span className="text-xs uppercase tracking-[0.14em] text-text-muted">
              Recommended next step
            </span>
          </div>
          <h3 className="text-lg font-semibold tracking-tight text-text-primary">
            Run an AI Opportunity Sprint
          </h3>
          <p className="text-xs leading-relaxed text-text-muted">
            Stakeholder discovery, systems review, opportunity scoring, and a
            30/60/90-day roadmap.
          </p>

          <div className="grid grid-cols-3 gap-2 pt-1">
            <PreviewMetric label="AI Readiness" value="72" tone="info" />
            <PreviewMetric label="Friction" value="68" tone="warning" />
            <PreviewMetric label="Systems" value="61" tone="neutral" />
          </div>

          <div className="flex flex-col gap-2 border-t border-border-subtle pt-4">
            <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
              Likely opportunity areas
            </span>
            <ul className="flex flex-col gap-1.5 text-xs text-text-secondary">
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-practice-ai" />
                Cross-system data reconciliation
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-practice-ai" />
                Document review and synthesis
              </li>
              <li className="flex items-center gap-2">
                <span className="h-1 w-1 rounded-full bg-practice-ai" />
                Stakeholder intake and discovery
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function PreviewMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "info" | "warning" | "neutral";
}) {
  const toneText: Record<typeof tone, string> = {
    info: "text-status-info",
    warning: "text-status-warning",
    neutral: "text-text-secondary",
  };
  return (
    <div className="rounded-md border border-border-subtle bg-bg-surface/80 p-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">
        {label}
      </div>
      <div className={`font-mono text-xl font-semibold tabular-nums ${toneText[tone]}`}>
        {value}
      </div>
    </div>
  );
}

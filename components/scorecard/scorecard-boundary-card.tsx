import * as React from "react";
import { Check, Minus } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";

const INCLUDES = [
  "AI Readiness Score, directional",
  "Workflow Friction profile",
  "Systems Readiness snapshot",
  "Risk and readiness notes",
  "Top likely opportunity areas",
  "A recommended next step",
];

const DOES_NOT_INCLUDE = [
  "A full workflow map",
  "Technical architecture or system design",
  "ROI model or cost-saving guarantees",
  "Detailed 30/60/90-day implementation roadmap",
  "Proposal, SOW, or pricing",
  "Final recommendations",
];

export function ScorecardBoundaryCard() {
  return (
    <section className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          What this is — and isn’t
        </span>
        <h2 className="max-w-2xl text-balance text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          A diagnostic, not a deliverable.
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
          This scorecard is based on self-reported inputs and provides
          directional guidance. A full AI Opportunity Sprint validates findings
          through stakeholder discovery, systems review, workflow mapping, and
          implementation planning.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <Card variant="base">
          <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-status-success/30 bg-status-success/10 text-status-success">
                <Check className="h-3 w-3" />
              </span>
              <span className="text-sm font-semibold tracking-tight text-text-primary">
                The scorecard includes
              </span>
            </div>
            <ul className="flex flex-col gap-2.5">
              {INCLUDES.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-xs leading-relaxed text-text-secondary"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-success"
                  />
                  {item}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>

        <Card variant="base">
          <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-border-strong bg-bg-elevated text-text-muted">
                <Minus className="h-3 w-3" />
              </span>
              <span className="text-sm font-semibold tracking-tight text-text-primary">
                The scorecard does not include
              </span>
            </div>
            <ul className="flex flex-col gap-2.5">
              {DOES_NOT_INCLUDE.map((item) => (
                <li
                  key={item}
                  className="flex items-start gap-2.5 text-xs leading-relaxed text-text-muted"
                >
                  <span
                    aria-hidden
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-disabled"
                  />
                  {item}
                </li>
              ))}
            </ul>
            <p className="border-t border-border-subtle pt-3 text-[11px] leading-relaxed text-text-muted">
              Those arrive in a paid AI Opportunity Sprint, where SLATE pairs
              stakeholder evidence with consultant judgment.
            </p>
          </CardBody>
        </Card>
      </div>
    </section>
  );
}

import * as React from "react";
import {
  Activity,
  Boxes,
  Compass,
  Sparkles,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";

interface ValueProp {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}

const VALUE_PROPS: ValueProp[] = [
  {
    icon: Activity,
    title: "AI Readiness Score",
    description:
      "How prepared the operating posture is to absorb AI assistance — culture, confidence, prior usage.",
  },
  {
    icon: Compass,
    title: "Workflow Friction Profile",
    description:
      "Where day-to-day work is breaking down — the strongest signal of where AI is likely to pay back.",
  },
  {
    icon: Boxes,
    title: "Systems Readiness Snapshot",
    description:
      "Whether the systems landscape is integration-ready or needs foundation work before AI lands.",
  },
  {
    icon: Sparkles,
    title: "Likely Opportunity Areas",
    description:
      "A directional shortlist of where AI is most likely to create leverage in this specific business.",
  },
];

export function ScorecardValueProps() {
  return (
    <section
      id="what-you-get"
      className="flex flex-col gap-8 scroll-mt-24"
    >
      <div className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          What you’ll get
        </span>
        <h2 className="max-w-2xl text-balance text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
          Four directional reads that point to where AI is most likely to
          create leverage.
        </h2>
        <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
          The scorecard is the start of a conversation, not a deliverable. It
          identifies promising surfaces. A paid AI Opportunity Sprint validates
          them with stakeholder evidence and an implementation plan.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {VALUE_PROPS.map((vp) => {
          const Icon = vp.icon;
          return (
            <Card key={vp.title} variant="base">
              <CardBody className="flex flex-col gap-3 p-5 sm:p-6">
                <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-practice-ai">
                  <Icon className="h-4 w-4" />
                </div>
                <h3 className="text-sm font-semibold tracking-tight text-text-primary">
                  {vp.title}
                </h3>
                <p className="text-xs leading-relaxed text-text-muted">
                  {vp.description}
                </p>
              </CardBody>
            </Card>
          );
        })}
      </div>
    </section>
  );
}

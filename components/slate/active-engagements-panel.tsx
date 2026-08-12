import * as React from "react";
import { ArrowRight, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
  CardFooter,
} from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ENGAGEMENT_STAGES,
  type Engagement,
  type EngagementStage,
} from "@/lib/mock-data";

const healthTone: Record<Engagement["health"], BadgeTone> = {
  "on-track": "success",
  attention: "warning",
  "at-risk": "risk",
};

const healthLabel: Record<Engagement["health"], string> = {
  "on-track": "On Track",
  attention: "Needs Attention",
  "at-risk": "At Risk",
};

function stageIndex(stage: EngagementStage) {
  return ENGAGEMENT_STAGES.indexOf(stage);
}

function StageTracker({ stage }: { stage: EngagementStage }) {
  const currentIdx = stageIndex(stage);
  return (
    <div
      className="flex w-full items-center gap-1"
      role="img"
      aria-label={`Stage: ${stage}`}
    >
      {ENGAGEMENT_STAGES.map((s, i) => {
        const isComplete = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={s} className="flex flex-1 items-center gap-1">
            <span
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                isComplete && "bg-brand-primary/70",
                isCurrent && "bg-brand-primary",
                !isComplete && !isCurrent && "bg-white/[0.05]",
              )}
            />
          </div>
        );
      })}
    </div>
  );
}

export interface ActiveEngagementsPanelProps {
  engagements: Engagement[];
}

export function ActiveEngagementsPanel({
  engagements,
}: ActiveEngagementsPanelProps) {
  return (
    <Card variant="base">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Active Engagements</CardTitle>
            <CardDescription>
              AI Opportunity Sprints and assessments in flight. Stage tracker
              shows where each engagement stands.
            </CardDescription>
          </div>
          <Badge tone="ai" dot>
            AI Systems
          </Badge>
        </div>
      </CardHeader>
      <CardBody className="pt-0">
        <ul className="flex flex-col gap-2.5">
          {engagements.map((eng) => (
            <li key={eng.id}>
              <button
                type="button"
                className="group block w-full rounded-lg border border-border-subtle bg-bg-elevated/50 p-4 text-left transition-colors hover:border-border-strong hover:bg-bg-elevated"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium text-text-primary">
                        {eng.account}
                      </span>
                      <Badge tone="neutral">{eng.type}</Badge>
                    </div>
                    <p className="text-xs text-text-muted">
                      Owner {eng.owner} · Stakeholders{" "}
                      <span className="font-mono text-text-secondary">
                        {eng.stakeholdersResponded}/{eng.stakeholdersTotal}
                      </span>
                    </p>
                  </div>
                  <Badge tone={healthTone[eng.health]} dot>
                    {healthLabel[eng.health]}
                  </Badge>
                </div>

                <div className="mt-4 flex flex-col gap-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="uppercase tracking-[0.14em] text-text-muted">
                      Stage
                    </span>
                    <span className="text-text-secondary">{eng.stage}</span>
                  </div>
                  <StageTracker stage={eng.stage} />
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 border-t border-border-subtle pt-3">
                  <div className="min-w-0 text-xs">
                    <span className="text-text-muted">Next: </span>
                    <span className="text-text-secondary">{eng.nextAction}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 shrink-0 text-text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-text-primary" />
                </div>
              </button>
            </li>
          ))}
        </ul>
      </CardBody>
      <CardFooter>
        <Button
          variant="ghost"
          size="sm"
          trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}
        >
          View all engagements
        </Button>
      </CardFooter>
    </Card>
  );
}

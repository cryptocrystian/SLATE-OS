import * as React from "react";
import { Eye } from "lucide-react";
import { ScoreCard } from "@/components/scorecard/score-card";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Lead } from "@/lib/leads/types";

export interface ScorecardSummaryPanelProps {
  lead: Lead;
}

export function ScorecardSummaryPanel({ lead }: ScorecardSummaryPanelProps) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-2">
            <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Prospect-facing scorecard
            </span>
            <h2 className="text-base font-semibold tracking-tight text-text-primary">
              What {lead.contactName.split(" ")[0]} saw on the result page
            </h2>
          </div>
          <Badge tone="neutral" variant="outline">
            <Eye className="mr-1.5 h-3 w-3" />
            Read-only mirror
          </Badge>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <ScoreCard
            label="AI Readiness"
            value={lead.prospectScores.ai}
            dimension="ai"
            description="Operating posture and prior usage that affect how easily AI can be absorbed."
          />
          <ScoreCard
            label="Workflow Friction"
            value={lead.prospectScores.friction}
            dimension="friction"
            description="Severity and breadth of day-to-day friction. High friction is the strongest signal of likely AI leverage."
          />
          <ScoreCard
            label="Systems Readiness"
            value={lead.prospectScores.systems}
            dimension="systems"
            description="Integration maturity that determines what is realistic in 30/60/90 days."
          />
        </div>

        <p className="text-[11px] leading-relaxed text-text-muted">
          The prospect did not see the Internal Saipien Fit Score, the
          qualification signals, or the recommended action. Those are visible
          only inside SLATE.
        </p>
      </CardBody>
    </Card>
  );
}

import * as React from "react";
import { Grid2x2 } from "lucide-react";
import { EngagementStatusPanel } from "./engagement-status-panel";
import type { OpportunityScoringStatus } from "@/lib/engagements/types";

export interface OpportunityStatusPanelProps {
  opportunities: OpportunityScoringStatus;
  opportunitiesHref?: string;
}

export function OpportunityStatusPanel({
  opportunities,
  opportunitiesHref,
}: OpportunityStatusPanelProps) {
  return (
    <EngagementStatusPanel
      icon={<Grid2x2 className="h-4 w-4" />}
      title="Opportunity scoring"
      status={opportunities.status}
      description="Approved findings are placed onto the impact-vs-complexity matrix as Quick Wins, Strategic Builds, Low Priority, or Defer."
      progress={
        opportunities.identified > 0
          ? {
              label: "Quick wins / Strategic builds",
              value: opportunities.quickWins + opportunities.strategicBuilds,
              total: opportunities.identified,
            }
          : undefined
      }
      metrics={[
        {
          label: "Quick wins",
          value: String(opportunities.quickWins),
        },
        {
          label: "Strategic builds",
          value: String(opportunities.strategicBuilds),
        },
        {
          label: "Defer",
          value: String(opportunities.defer),
        },
        {
          label: "State",
          value: opportunities.scoringState,
        },
      ]}
      nextAction={opportunities.nextAction}
      cta={{ label: "Score Opportunities", href: opportunitiesHref }}
    />
  );
}

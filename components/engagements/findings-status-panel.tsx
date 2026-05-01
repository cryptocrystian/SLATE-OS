import * as React from "react";
import { Sparkles } from "lucide-react";
import { EngagementStatusPanel } from "./engagement-status-panel";
import type { FindingsStatus } from "@/lib/engagements/types";

export interface FindingsStatusPanelProps {
  findings: FindingsStatus;
}

export function FindingsStatusPanel({ findings }: FindingsStatusPanelProps) {
  const reviewed = findings.approved + findings.rejected;
  return (
    <EngagementStatusPanel
      icon={<Sparkles className="h-4 w-4" />}
      title="Findings"
      status={findings.status}
      description="AI-drafted findings from intake and documents. Every finding is approved, edited, or rejected by a consultant before scoring."
      progress={
        findings.candidate > 0
          ? {
              label: "Findings reviewed",
              value: reviewed,
              total: findings.candidate,
            }
          : undefined
      }
      metrics={[
        {
          label: "Candidate / approved / rejected",
          value: `${findings.candidate} / ${findings.approved} / ${findings.rejected}`,
        },
        { label: "Review state", value: findings.reviewState },
      ]}
      nextAction={findings.nextAction}
      cta={{ label: "Review Findings", lockedNote: "Sprint 5" }}
    />
  );
}

import * as React from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EngagementStatusPanel } from "./engagement-status-panel";
import type { FindingsStatus } from "@/lib/engagements/types";

export interface FindingsStatusPanelProps {
  findings: FindingsStatus;
  findingsHref?: string;
  /** Server-detected: AI synthesis is configured for this environment AND
   *  the engagement is a real persisted UUID (not a mock slug). When false,
   *  the panel renders without any AI affordance — preserving Sprint-5
   *  behavior on legacy demo paths. */
  aiAvailable?: boolean;
  /** True when at least one stakeholder intake response is attached to the
   *  engagement. Drives the AI-readiness copy: with evidence the panel
   *  reads "AI draft is ready to run"; without it, "intake first." */
  hasIntakeEvidence?: boolean;
}

export function FindingsStatusPanel({
  findings,
  findingsHref,
  aiAvailable = false,
  hasIntakeEvidence = false,
}: FindingsStatusPanelProps) {
  const reviewed = findings.approved + findings.rejected;
  const aiReadinessNote = aiAvailable
    ? hasIntakeEvidence
      ? "AI draft findings is ready to run."
      : "AI draft available, but intake evidence is thin. Capture stakeholder input first."
    : null;
  return (
    <EngagementStatusPanel
      icon={<Sparkles className="h-4 w-4" />}
      title="Findings"
      status={findings.status}
      headerAccessory={
        aiAvailable ? (
          <Badge tone="ai" variant="outline" title="AI draft findings available">
            <Sparkles aria-hidden className="mr-1 h-3 w-3" />
            AI draft available
          </Badge>
        ) : null
      }
      description="AI-drafted findings from intake and documents. Every finding is approved, edited, or rejected by a consultant before scoring."
      footnote={aiReadinessNote}
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
      cta={{ label: "Review Findings", href: findingsHref }}
    />
  );
}

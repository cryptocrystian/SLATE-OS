import * as React from "react";
import { ScrollText } from "lucide-react";
import { EngagementStatusPanel } from "./engagement-status-panel";
import type { ReportStatus } from "@/lib/engagements/types";

export interface ReportStatusPanelProps {
  report: ReportStatus;
}

export function ReportStatusPanel({ report }: ReportStatusPanelProps) {
  return (
    <EngagementStatusPanel
      icon={<ScrollText className="h-4 w-4" />}
      title="Audit report"
      status={report.status}
      description="AI Opportunity Sprint report — Executive Summary through 30/60/90 Roadmap. Sections lock only after consultant approval."
      progress={{
        label: "Sections drafted",
        value: report.sectionsDrafted,
        total: report.sectionsTotal,
      }}
      metrics={[
        {
          label: "Approved sections",
          value: `${report.sectionsApproved} / ${report.sectionsTotal}`,
        },
        { label: "State", value: report.state },
      ]}
      nextAction={report.nextAction}
      cta={{ label: "Build Report", lockedNote: "Sprint 7" }}
    />
  );
}

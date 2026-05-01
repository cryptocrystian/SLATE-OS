import * as React from "react";
import { Users } from "lucide-react";
import { EngagementStatusPanel } from "./engagement-status-panel";
import type { IntakeStatus } from "@/lib/engagements/types";

export interface StakeholderProgressPanelProps {
  intake: IntakeStatus;
  intakeHref?: string;
}

export function StakeholderProgressPanel({
  intake,
  intakeHref,
}: StakeholderProgressPanelProps) {
  const metrics: Array<{ label: string; value: string }> = [
    {
      label: "Roles covered",
      value:
        intake.rolesCovered.length === 0
          ? "—"
          : intake.rolesCovered.join(", "),
    },
    {
      label: "Roles missing",
      value:
        intake.rolesMissing.length === 0
          ? "All covered"
          : intake.rolesMissing.join(", "),
    },
  ];
  if (intake.lastResponseAt) {
    metrics.push({ label: "Last response", value: intake.lastResponseAt });
  }

  return (
    <EngagementStatusPanel
      icon={<Users className="h-4 w-4" />}
      title="Stakeholder intake"
      status={intake.status}
      description="Role-based stakeholder discovery, AI-guided. Each response is reviewed before synthesis."
      progress={{
        label: "Stakeholders responded",
        value: intake.stakeholdersResponded,
        total: intake.stakeholdersInvited || intake.stakeholdersResponded,
      }}
      metrics={metrics}
      nextAction={intake.nextAction}
      cta={{ label: "Manage Intake", href: intakeHref }}
    />
  );
}

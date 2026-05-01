import * as React from "react";
import { FileSignature } from "lucide-react";
import { EngagementStatusPanel } from "./engagement-status-panel";
import type { ProposalStatus } from "@/lib/engagements/types";

export interface ProposalStatusPanelProps {
  proposal: ProposalStatus;
}

export function ProposalStatusPanel({ proposal }: ProposalStatusPanelProps) {
  return (
    <EngagementStatusPanel
      icon={<FileSignature className="h-4 w-4" />}
      title="Proposal & SOW"
      status={proposal.status}
      description="Tiered SOW options — Quick-Win Build, AI Workflow System, Managed AI Partner. Implementation credit and assumptions are included."
      metrics={[
        { label: "Options drafted", value: String(proposal.options) },
        {
          label: "Recommended",
          value: proposal.recommendedOption ?? "—",
        },
        { label: "State", value: proposal.state },
      ]}
      nextAction={proposal.nextAction}
      cta={{ label: "Draft Proposal", lockedNote: "Sprint 7" }}
    />
  );
}

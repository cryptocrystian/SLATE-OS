import * as React from "react";
import { FileText } from "lucide-react";
import { EngagementStatusPanel } from "./engagement-status-panel";
import type { DocumentStatus } from "@/lib/engagements/types";

export interface DocumentStatusPanelProps {
  documents: DocumentStatus;
}

export function DocumentStatusPanel({ documents }: DocumentStatusPanelProps) {
  return (
    <EngagementStatusPanel
      icon={<FileText className="h-4 w-4" />}
      title="Documents & inputs"
      status={documents.status}
      description="Client documents and operational evidence. Each is tagged with evidence quality before synthesis."
      progress={{
        label: "Documents received",
        value: documents.received,
        total: documents.requested || documents.received,
      }}
      metrics={[
        { label: "Reviewed", value: `${documents.reviewed} reviewed` },
        { label: "Review state", value: documents.reviewState },
      ]}
      nextAction={documents.nextAction}
      cta={{ label: "Manage Documents", lockedNote: "Sprint 5" }}
    />
  );
}

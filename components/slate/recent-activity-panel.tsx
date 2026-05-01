import * as React from "react";
import {
  ClipboardList,
  CheckCircle2,
  MessageSquare,
  FileText,
  UserCheck,
  FileSignature,
  FileUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardBody,
} from "@/components/ui/card";
import type { ActivityEvent, ActivityType } from "@/lib/mock-data";

const iconForType: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  scorecard_completed: ClipboardList,
  finding_approved: CheckCircle2,
  intake_response: MessageSquare,
  proposal_sent: FileSignature,
  lead_qualified: UserCheck,
  report_section_drafted: FileText,
  document_uploaded: FileUp,
};

const accentForType: Record<ActivityType, string> = {
  scorecard_completed: "text-status-info",
  finding_approved: "text-status-success",
  intake_response: "text-text-secondary",
  proposal_sent: "text-brand-primary",
  lead_qualified: "text-status-success",
  report_section_drafted: "text-practice-ai",
  document_uploaded: "text-text-secondary",
};

export interface RecentActivityPanelProps {
  events: ActivityEvent[];
}

export function RecentActivityPanel({ events }: RecentActivityPanelProps) {
  return (
    <Card variant="base" className="flex h-full flex-col">
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
        <CardDescription>
          Cross-engagement signal — scorecards, intakes, findings, proposals.
        </CardDescription>
      </CardHeader>
      <CardBody className="pt-0">
        <ol className="relative flex flex-col">
          <span
            aria-hidden
            className="absolute left-[15px] top-1 bottom-1 w-px bg-gradient-to-b from-border-subtle via-border-subtle to-transparent"
          />
          {events.map((event) => {
            const Icon = iconForType[event.type];
            return (
              <li
                key={event.id}
                className="relative flex items-start gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div
                  className={cn(
                    "relative z-10 mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-elevated",
                    accentForType[event.type],
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                    <p className="text-sm font-medium text-text-primary">
                      {event.title}
                    </p>
                    <span className="font-mono text-[11px] text-text-muted">
                      {event.at}
                    </span>
                  </div>
                  <p className="text-xs leading-relaxed text-text-muted">
                    {event.detail}
                  </p>
                  <p className="text-[11px] text-text-muted">
                    <span className="text-text-secondary">{event.account}</span>
                    <span className="mx-1.5 text-text-disabled">·</span>
                    <span>{event.actor}</span>
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </CardBody>
    </Card>
  );
}

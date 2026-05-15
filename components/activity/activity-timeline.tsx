import * as React from "react";
import { Activity } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type {
  ActivityEvent,
  ActivityEventType,
} from "@/lib/activity/types";

export interface ActivityTimelineProps {
  events: ActivityEvent[];
  emptyTitle: string;
  emptyDescription: string;
  /** When set, the panel renders a heading. */
  heading?: string;
}

const EVENT_TONE: Record<ActivityEventType, BadgeTone> = {
  scorecard_submitted: "info",
  lead_created: "info",
  lead_status_changed: "info",
  engagement_created: "brand",
  intake_session_created: "info",
  intake_response_submitted: "info",
  finding_created: "info",
  finding_approved: "success",
  finding_rejected: "risk",
  finding_report_ready: "success",
  opportunity_created: "info",
  opportunity_selected: "success",
  opportunity_deferred: "warning",
  opportunity_rejected: "risk",
  roadmap_item_created: "info",
  roadmap_item_status_changed: "info",
  report_initialized: "brand",
  report_section_status_changed: "info",
  proposal_initialized: "brand",
  proposal_option_recommended: "success",
  proposal_status_changed: "info",
  note_created: "neutral",
  note_updated: "neutral",
  note_deleted: "neutral",
  input_asset_uploaded: "info",
  input_asset_downloaded: "neutral",
  ai_findings_generated: "ai",
  ai_opportunities_generated: "ai",
  ai_report_section_drafted: "ai",
  ai_proposal_option_drafted: "ai",
  ai_roadmap_items_drafted: "ai",
  ai_synthesis_failed: "risk",
  report_pdf_candidate_generated: "success",
  report_pdf_candidate_failed: "risk",
  report_pdf_candidate_downloaded: "info",
  report_delivery_snapshot_voided: "neutral",
  report_share_token_created: "brand",
  report_share_token_revoked: "warning",
  report_share_token_accessed: "info",
  report_share_token_expired: "neutral",
  proposal_snapshot_generated: "success",
  proposal_snapshot_failed: "risk",
  proposal_snapshot_voided: "neutral",
};

const EVENT_LABEL: Record<ActivityEventType, string> = {
  scorecard_submitted: "Scorecard",
  lead_created: "Lead",
  lead_status_changed: "Lead status",
  engagement_created: "Engagement",
  intake_session_created: "Intake invite",
  intake_response_submitted: "Intake response",
  finding_created: "Finding",
  finding_approved: "Finding approved",
  finding_rejected: "Finding rejected",
  finding_report_ready: "Report-ready",
  opportunity_created: "Opportunity",
  opportunity_selected: "Selected",
  opportunity_deferred: "Deferred",
  opportunity_rejected: "Rejected",
  roadmap_item_created: "Roadmap",
  roadmap_item_status_changed: "Roadmap status",
  report_initialized: "Report",
  report_section_status_changed: "Section",
  proposal_initialized: "Proposal",
  proposal_option_recommended: "Recommended",
  proposal_status_changed: "Proposal status",
  note_created: "Note",
  note_updated: "Note edited",
  note_deleted: "Note removed",
  input_asset_uploaded: "Document uploaded",
  input_asset_downloaded: "Document downloaded",
  ai_findings_generated: "AI findings generated",
  ai_opportunities_generated: "AI opportunities generated",
  ai_report_section_drafted: "AI report section drafted",
  ai_proposal_option_drafted: "AI proposal option drafted",
  ai_roadmap_items_drafted: "AI roadmap items drafted",
  ai_synthesis_failed: "AI synthesis failed",
  report_pdf_candidate_generated: "Report PDF candidate",
  report_pdf_candidate_failed: "Report PDF candidate failed",
  report_pdf_candidate_downloaded: "Report PDF candidate downloaded",
  report_delivery_snapshot_voided: "Snapshot voided",
  report_share_token_created: "Share link created",
  report_share_token_revoked: "Share link revoked",
  report_share_token_accessed: "Share link accessed",
  report_share_token_expired: "Share link expired",
  proposal_snapshot_generated: "Proposal candidate",
  proposal_snapshot_failed: "Proposal candidate failed",
  proposal_snapshot_voided: "Proposal candidate voided",
};

export function ActivityTimeline({
  events,
  emptyTitle,
  emptyDescription,
  heading = "Recent activity",
}: ActivityTimelineProps) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-muted">
              <Activity className="h-3.5 w-3.5" />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              {heading}
            </span>
          </div>
          <span className="text-[11px] text-text-muted">
            {events.length} event{events.length === 1 ? "" : "s"}
          </span>
        </div>

        {events.length === 0 ? (
          <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border-subtle bg-bg-surface/40 p-4">
            <span className="text-xs font-medium text-text-primary">
              {emptyTitle}
            </span>
            <p className="text-[11px] leading-relaxed text-text-muted">
              {emptyDescription}
            </p>
          </div>
        ) : (
          <ol className="flex flex-col gap-2">
            {events.map((event) => (
              <li key={event.id}>
                <TimelineRow event={event} />
              </li>
            ))}
          </ol>
        )}
      </CardBody>
    </Card>
  );
}

function TimelineRow({ event }: { event: ActivityEvent }) {
  const tone = EVENT_TONE[event.eventType] ?? "neutral";
  const label = EVENT_LABEL[event.eventType] ?? "Event";
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={tone} variant="outline">
          {label}
        </Badge>
        <span className="text-[11px] text-text-muted">
          {formatTimestamp(event.createdAt)}
        </span>
        <span aria-hidden className="text-text-disabled">
          ·
        </span>
        <span className="text-[11px] text-text-secondary">
          {event.actorDisplayName ?? "System"}
        </span>
      </div>
      <span className="text-xs font-medium text-text-primary">
        {event.title}
      </span>
      {event.summary ? (
        <p className="text-[11px] leading-relaxed text-text-muted">
          {event.summary}
        </p>
      ) : null}
    </div>
  );
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

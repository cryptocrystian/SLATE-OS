import * as React from "react";
import { Bell } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import type { IntakeRecord } from "@/lib/intake/types";

const SEVERITY_TONE: Record<"high" | "medium" | "low", BadgeTone> = {
  high: "warning",
  medium: "info",
  low: "neutral",
};

const SEVERITY_LABEL: Record<"high" | "medium" | "low", string> = {
  high: "High priority",
  medium: "Follow up",
  low: "When time allows",
};

export interface FollowUpQueueProps {
  followUps: IntakeRecord["followUps"];
}

export function FollowUpQueue({ followUps }: FollowUpQueueProps) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-status-warning">
              <Bell className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-semibold tracking-tight text-text-primary">
              Follow-up queue
            </h2>
          </div>
          <Badge tone="warning" variant="outline">
            Mock — not wired
          </Badge>
        </div>
        {followUps.length === 0 ? (
          <EmptyState
            title="No follow-ups required"
            description="Stakeholder coverage looks healthy. Items needing a personal nudge or reminder will surface here."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {followUps.map((f) => (
              <li
                key={f.id}
                className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <span className="text-sm font-medium text-text-primary">
                    {f.label}
                  </span>
                  <Badge tone={SEVERITY_TONE[f.severity]} dot>
                    {SEVERITY_LABEL[f.severity]}
                  </Badge>
                </div>
                <p className="text-xs leading-relaxed text-text-muted">
                  {f.detail}
                </p>
                <p className="text-[11px] text-text-muted">
                  Target:{" "}
                  <span className="text-text-secondary">{f.target}</span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

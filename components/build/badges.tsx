import * as React from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  LABELS,
  type AccountHealth,
  type AlarmKind,
  type DecisionClass,
  type OriginKind,
  type ProjectStatus,
  type RunVerdict,
  type WorkItemStatus,
} from "@/lib/build/types";

const PROJECT_TONE: Record<ProjectStatus, BadgeTone> = {
  intake: "neutral",
  ready: "info",
  active: "success",
  paused: "warning",
  closed: "neutral",
};

const ITEM_TONE: Record<WorkItemStatus, BadgeTone> = {
  draft: "neutral",
  ready: "info",
  in_progress: "brand",
  held: "warning",
  escalated: "risk",
  accepted: "success",
  superseded: "neutral",
  cancelled: "neutral",
};

const VERDICT_TONE: Record<RunVerdict, BadgeTone> = {
  accepted: "success",
  rejected: "risk",
  escalated: "risk",
  held: "warning",
  aborted: "neutral",
};

const HEALTH_TONE: Record<AccountHealth, BadgeTone> = {
  healthy: "success",
  degraded: "warning",
  down: "critical",
  unknown: "neutral",
};

export function OriginBadge({ kind }: { kind: OriginKind }) {
  return (
    <Badge tone={kind === "internal" ? "brand" : kind === "ventureos_venture" ? "studio" : "ai"} variant="outline">
      {LABELS.originKind[kind]}
    </Badge>
  );
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge tone={PROJECT_TONE[status]} dot>
      {LABELS.projectStatus[status]}
    </Badge>
  );
}

export function ItemStatusBadge({ status }: { status: WorkItemStatus }) {
  return (
    <Badge tone={ITEM_TONE[status]} dot>
      {LABELS.workItemStatus[status]}
    </Badge>
  );
}

export function RunBadge({ status, verdict }: { status: "running" | "finished"; verdict: RunVerdict | null }) {
  if (status === "running") {
    return (
      <Badge tone="brand" dot>
        Running
      </Badge>
    );
  }
  return verdict ? (
    <Badge tone={VERDICT_TONE[verdict]} dot>
      {LABELS.verdict[verdict]}
    </Badge>
  ) : null;
}

export function HealthBadge({ health }: { health: AccountHealth }) {
  return (
    <Badge tone={HEALTH_TONE[health]} dot>
      {health === "unknown" ? "Unchecked" : health[0].toUpperCase() + health.slice(1)}
    </Badge>
  );
}

export function AlarmBadge({ kind }: { kind: AlarmKind }) {
  return (
    <Badge tone={kind === "capacity" || kind === "thrash" || kind === "dead_man" ? "critical" : "warning"} dot>
      {LABELS.alarmKind[kind]}
    </Badge>
  );
}

export function DecisionClassBadge({ cls }: { cls: DecisionClass }) {
  return (
    <Badge tone={cls === "owner" ? "risk" : cls === "product" ? "info" : "neutral"} variant="outline">
      {LABELS.decisionClass[cls]}
    </Badge>
  );
}

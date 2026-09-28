import * as React from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  LABELS,
  type ActivationMode,
  type Criticality,
  type LifecycleStatus,
  type PolicyVersionStatus,
  type ProgramKind,
  type ProgramStatus,
} from "@/lib/governance/types";

const PROGRAM_STATUS_TONE: Record<ProgramStatus, BadgeTone> = {
  draft: "neutral",
  active: "success",
  paused: "warning",
  archived: "neutral",
};

const LIFECYCLE_TONE: Record<LifecycleStatus, BadgeTone> = {
  proposed: "neutral",
  assessment: "info",
  active: "brand",
  restricted: "warning",
  retired: "neutral",
};

const CRITICALITY_TONE: Record<Criticality, BadgeTone> = {
  low: "neutral",
  medium: "info",
  high: "risk",
  critical: "critical",
};

const POLICY_STATUS_TONE: Record<PolicyVersionStatus, BadgeTone> = {
  draft: "neutral",
  active: "success",
  superseded: "neutral",
  retired: "neutral",
};

export function ProgramKindBadge({ kind }: { kind: ProgramKind }) {
  return (
    <Badge tone={kind === "internal" ? "brand" : kind === "venture" ? "studio" : "ai"} variant="outline">
      {LABELS.programKind[kind]}
    </Badge>
  );
}

export function ProgramStatusBadge({ status }: { status: ProgramStatus }) {
  return (
    <Badge tone={PROGRAM_STATUS_TONE[status]} dot={status === "active"}>
      {LABELS.programStatus[status]}
    </Badge>
  );
}

/**
 * Lifecycle + honest approval state. In G1 nothing is governance-approved,
 * so running assets carry an explicit "not approved" marker (docs/76 §6).
 */
export function LifecycleBadge({ status, showApproval = true }: { status: LifecycleStatus; showApproval?: boolean }) {
  const running = status === "active" || status === "restricted";
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <Badge tone={LIFECYCLE_TONE[status]} dot={running}>
        {LABELS.lifecycle[status]}
      </Badge>
      {showApproval && running ? (
        <Badge tone="warning" variant="outline">
          Not yet governance-approved
        </Badge>
      ) : null}
    </span>
  );
}

export function CriticalityBadge({ value }: { value: Criticality | null }) {
  if (!value) return <Badge tone="neutral" variant="outline">Unclassified</Badge>;
  return <Badge tone={CRITICALITY_TONE[value]}>{value.charAt(0).toUpperCase() + value.slice(1)}</Badge>;
}

export function PolicyStatusBadge({ status }: { status: PolicyVersionStatus }) {
  return (
    <Badge tone={POLICY_STATUS_TONE[status]} dot={status === "active"}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </Badge>
  );
}

export function ActivationBadge({ mode }: { mode: ActivationMode }) {
  return (
    <Badge tone={mode === "advisory" ? "info" : mode === "gated" ? "warning" : "critical"} variant="outline">
      {LABELS.activationMode[mode]}
    </Badge>
  );
}

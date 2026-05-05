import * as React from "react";
import { CheckCircle2, Eye, Flag, ShieldOff } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { LeadTrustStatus } from "@/lib/leads/types";

const LABEL: Record<LeadTrustStatus, string> = {
  verified: "Verified",
  unverified: "Unverified",
  flagged: "Flagged",
  rejected: "Rejected",
};

const TONE: Record<LeadTrustStatus, BadgeTone> = {
  verified: "success",
  unverified: "neutral",
  flagged: "warning",
  rejected: "risk",
};

const ICONS: Record<
  LeadTrustStatus,
  React.ComponentType<{ className?: string }>
> = {
  verified: CheckCircle2,
  unverified: Eye,
  flagged: Flag,
  rejected: ShieldOff,
};

export interface LeadTrustChipProps {
  status: LeadTrustStatus;
  /** Optional list of internal trust reasons; rendered as a `title`
   *  hover tooltip so operators can scan signals without expanding. */
  reasons?: string[];
  size?: "sm" | "md";
  className?: string;
}

/**
 * Operator-only chip surfacing the lead's trust posture. Only renders
 * inside `/app/*` and never on a public surface. Default `unverified`
 * is intentionally low-key (neutral tone, eye icon) so the inbox
 * doesn't read as alarming for legitimate prospects.
 */
export function LeadTrustChip({
  status,
  reasons,
  size = "sm",
  className,
}: LeadTrustChipProps) {
  const Icon = ICONS[status];
  const title =
    reasons && reasons.length > 0
      ? `Trust: ${LABEL[status]} — ${reasons.join(", ")}`
      : `Trust: ${LABEL[status]}`;
  return (
    <Badge
      tone={TONE[status]}
      variant="outline"
      className={cn(
        size === "sm" ? "gap-1 text-[10px]" : "gap-1.5 text-[11px]",
        className,
      )}
      title={title}
    >
      <Icon className={size === "sm" ? "h-3 w-3" : "h-3.5 w-3.5"} aria-hidden />
      <span>{LABEL[status]}</span>
    </Badge>
  );
}

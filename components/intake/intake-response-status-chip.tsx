import * as React from "react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import type { IntakeResponseStatus } from "@/lib/intake/types";

/**
 * Sprint I3 — Reusable chip for displaying offline-response lifecycle
 * status on stakeholder cards and response rows.
 *
 * Canon: docs/37 § 4. The lifecycle is:
 *   draft → ready_for_synthesis
 *   draft → voided
 *   ready_for_synthesis → voided
 *   ready_for_synthesis → superseded (when a replacement is staged)
 *
 * Tone choices:
 *   - draft: warning (operator action required before synthesis)
 *   - ready_for_synthesis: success (cleared the operator gate)
 *   - superseded: neutral (replaced; preserved for audit)
 *   - voided: neutral (soft-deleted; preserved for audit)
 *
 * The chip is dot-prefixed to make the lifecycle stage scannable in
 * dense stakeholder lists.
 */

const TONE_BY_STATUS: Record<IntakeResponseStatus, BadgeTone> = {
  draft: "warning",
  ready_for_synthesis: "success",
  superseded: "neutral",
  voided: "neutral",
};

const LABEL_BY_STATUS: Record<IntakeResponseStatus, string> = {
  draft: "Draft",
  ready_for_synthesis: "Ready for synthesis",
  superseded: "Superseded",
  voided: "Voided",
};

const TITLE_BY_STATUS: Record<IntakeResponseStatus, string> = {
  draft:
    "Operator-staged response. Not yet promoted for findings synthesis. AI synthesis will not consume this row.",
  ready_for_synthesis:
    "Operator has cleared this response for findings synthesis. AI synthesis may consume it.",
  superseded:
    "A newer operator-staged response replaced this one. Preserved for audit; synthesis will not consume it.",
  voided:
    "Operator removed this response. Preserved for audit; synthesis will not consume it.",
};

export interface IntakeResponseStatusChipProps {
  status: IntakeResponseStatus;
  /** Optional override; otherwise the canonical operator-facing label. */
  label?: string;
  /** Default true. Shows a small colored dot to make the chip more scannable. */
  showDot?: boolean;
}

export function IntakeResponseStatusChip({
  status,
  label,
  showDot = true,
}: IntakeResponseStatusChipProps) {
  return (
    <Badge
      tone={TONE_BY_STATUS[status]}
      variant="outline"
      dot={showDot}
      title={TITLE_BY_STATUS[status]}
    >
      {label ?? LABEL_BY_STATUS[status]}
    </Badge>
  );
}

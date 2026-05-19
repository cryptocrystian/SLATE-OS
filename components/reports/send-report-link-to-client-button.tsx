"use client";

import * as React from "react";
import { Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SendToClientConfirmModal } from "@/components/client-delivery/send-to-client-confirm-modal";
import { markReportLinkSentToClientAction } from "@/lib/reports/send-to-client-actions";

/**
 * Phase 1B Send to Client Sprint C2-B — operator-only per-token
 * "Mark sent" button for an active eligible report share token.
 *
 * Two visual states:
 *   1. Audience label already on the token → primary `Mark sent`
 *      button that opens the Sprint C2-A confirm modal.
 *   2. Audience label missing → disabled chip with operator-facing
 *      help text ("Audience label required before marking sent.").
 *      The mint flow accepts an optional audience label; if the
 *      operator skipped it, Send to Client gates here before the
 *      modal opens to avoid presenting a half-filled flow.
 *
 * Boundaries enforced at the action layer:
 *   - SLATE does not send email.
 *   - SLATE does not push to CRM.
 *   - SLATE does not open `mailto:` links.
 *   - SLATE records the operator's mark-sent intent + audit event
 *     and stops. The operator delivers the link through their own
 *     channel.
 *
 * The raw token / URL is NOT passed in — SLATE never stores it after
 * the mint-once copy flow, so the modal renders without the URL
 * recopy panel. If the operator needs to recopy the URL they must
 * mint a fresh token via the existing Generate Share Link flow.
 */

export interface SendReportLinkToClientButtonProps {
  tokenId: string;
  audienceLabel: string | null;
  hasRecipientEmailHash: boolean;
}

export function SendReportLinkToClientButton({
  tokenId,
  audienceLabel,
  hasRecipientEmailHash,
}: SendReportLinkToClientButtonProps) {
  const [open, setOpen] = React.useState(false);

  const trimmedAudience = (audienceLabel ?? "").trim();
  const audienceMissing = trimmedAudience.length === 0;

  if (audienceMissing) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Badge tone="neutral" variant="outline">
          Mark sent disabled
        </Badge>
        <span className="text-[11px] text-text-muted">
          Audience label required before marking sent.
        </span>
      </div>
    );
  }

  return (
    <>
      <Button
        type="button"
        variant="secondary"
        size="sm"
        leadingIcon={<Send className="h-3.5 w-3.5" />}
        onClick={() => setOpen(true)}
      >
        Mark sent to client
      </Button>
      <SendToClientConfirmModal
        open={open}
        onOpenChange={setOpen}
        artifactKind="report"
        tokenId={tokenId}
        initialAudienceLabel={trimmedAudience}
        hasRecipientEmailHash={hasRecipientEmailHash}
        // SLATE never stored the raw token after the mint-once copy
        // flow, so the modal does not show a recopy panel. Operator
        // re-mints via the existing Generate Share Link button if a
        // fresh URL is needed.
        shareUrlPath={null}
        onConfirm={async ({ audienceLabel: nextAudience, recipientEmail }) =>
          markReportLinkSentToClientAction({
            shareTokenId: tokenId,
            audienceConfirmation: nextAudience,
            recipientEmail,
            operatorConfirmed: true,
          })
        }
      />
    </>
  );
}

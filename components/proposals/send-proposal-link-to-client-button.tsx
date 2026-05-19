"use client";

import * as React from "react";
import { Send } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SendToClientConfirmModal } from "@/components/client-delivery/send-to-client-confirm-modal";
import { markProposalLinkSentToClientAction } from "@/lib/proposals/send-to-client-actions";

/**
 * Phase 1B Send to Client Sprint C2-B — operator-only per-token
 * "Mark sent" button for an active eligible proposal share token.
 *
 * Mirrors `components/reports/send-report-link-to-client-button.tsx`
 * against the proposal mark-sent action. See that file's doc block
 * for the canonical contract.
 */

export interface SendProposalLinkToClientButtonProps {
  tokenId: string;
  audienceLabel: string | null;
  hasRecipientEmailHash: boolean;
}

export function SendProposalLinkToClientButton({
  tokenId,
  audienceLabel,
  hasRecipientEmailHash,
}: SendProposalLinkToClientButtonProps) {
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
        artifactKind="proposal"
        tokenId={tokenId}
        initialAudienceLabel={trimmedAudience}
        hasRecipientEmailHash={hasRecipientEmailHash}
        // SLATE never stored the raw token after mint-once copy.
        shareUrlPath={null}
        onConfirm={async ({ audienceLabel: nextAudience, recipientEmail }) =>
          markProposalLinkSentToClientAction({
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

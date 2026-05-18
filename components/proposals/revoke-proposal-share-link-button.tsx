"use client";

import * as React from "react";
import { ShieldOff, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  revokeProposalShareTokenAction,
  type RevokeProposalShareTokenResult,
} from "@/lib/proposals/share-token-actions";

/**
 * Production Hardening Sprint H1 — operator-only revoke control
 * surfaced beside each active proposal share token in the Proposal
 * Candidates panel. Mirrors `components/reports/revoke-share-link-button.tsx`
 * end-to-end.
 *
 * Two-step confirm flow:
 *   1. Initial state — small "Revoke" button.
 *   2. Confirm state — reason input (optional) + "Confirm revoke" /
 *      "Cancel" pair.
 *
 * Revocation never re-displays the raw token; once revoked, the
 * public /p route renders the generic-unavailable page regardless of
 * what the recipient does with the URL.
 */

export interface RevokeProposalShareLinkButtonProps {
  tokenId: string;
}

export function RevokeProposalShareLinkButton({
  tokenId,
}: RevokeProposalShareLinkButtonProps) {
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [result, setResult] =
    React.useState<RevokeProposalShareTokenResult | null>(null);

  function onRevokeClick() {
    setResult(null);
    setOpen(true);
  }

  function onCancel() {
    setOpen(false);
    setReason("");
  }

  function onConfirm() {
    startTransition(async () => {
      try {
        const r = await revokeProposalShareTokenAction({
          tokenId,
          reason: reason.trim() ? reason : undefined,
        });
        setResult(r);
        if (r.ok) {
          setOpen(false);
          setReason("");
        }
      } catch {
        setResult({ ok: false, error: "service-error" });
      }
    });
  }

  if (!open) {
    return (
      <div className="flex flex-col items-start gap-1">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leadingIcon={<ShieldOff className="h-3.5 w-3.5" />}
          onClick={onRevokeClick}
          disabled={pending}
        >
          Revoke
        </Button>
        {result && !result.ok ? (
          <span className="text-[11px] text-status-risk">
            {translateError(result.error)}
          </span>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex max-w-sm flex-col gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-3 text-[11px] leading-relaxed text-status-warning">
      <span className="font-mono uppercase tracking-[0.16em]">
        Confirm revoke
      </span>
      <p className="text-text-secondary">
        The public proposal review link will immediately return the
        generic unavailable page. This action is logged and cannot be
        undone.
      </p>
      <label className="flex flex-col gap-1 text-text-secondary">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
          Reason (optional)
        </span>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          placeholder="Superseded by a newer candidate."
          className="rounded border border-border-subtle bg-bg-surface px-2 py-1 text-[11px] text-text-primary placeholder:text-text-disabled"
          disabled={pending}
        />
      </label>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="primary"
          size="sm"
          leadingIcon={<ShieldOff className="h-3.5 w-3.5" />}
          onClick={onConfirm}
          disabled={pending}
        >
          {pending ? "Revoking…" : "Confirm revoke"}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          leadingIcon={<X className="h-3.5 w-3.5" />}
          onClick={onCancel}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
      {result && !result.ok ? (
        <span className="text-status-risk">
          {translateError(result.error)}
        </span>
      ) : null}
    </div>
  );
}

function translateError(
  code: Exclude<RevokeProposalShareTokenResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Session expired";
    case "invalid-token":
      return "Invalid token id";
    case "token-not-found":
      return "Token not found";
    case "already-revoked":
      return "Token is already revoked or expired";
    case "service-error":
    default:
      return "Revoke failed";
  }
}

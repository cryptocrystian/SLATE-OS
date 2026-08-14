"use client";

import * as React from "react";
import { ShieldOff, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  revokeSowShareTokenAction,
  type RevokeSowShareTokenResult,
} from "@/lib/proposals/sow-share-actions";

/**
 * Sprint P7-B — operator-only revoke control beside each active SOW
 * share token. Two-step confirm, mirroring the proposal revoke button.
 * Once revoked, the public `/s` route renders the generic-unavailable
 * page regardless of what the recipient does with the URL.
 */

export interface RevokeSowShareLinkButtonProps {
  tokenId: string;
}

export function RevokeSowShareLinkButton({
  tokenId,
}: RevokeSowShareLinkButtonProps) {
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [result, setResult] =
    React.useState<RevokeSowShareTokenResult | null>(null);

  function onConfirm() {
    startTransition(async () => {
      try {
        const r = await revokeSowShareTokenAction({
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
          onClick={() => {
            setResult(null);
            setOpen(true);
          }}
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
      <span className="uppercase tracking-[0.16em]">Confirm revoke</span>
      <p className="text-text-secondary">
        The public SOW link will immediately return the generic
        unavailable page. This action is logged and cannot be undone.
      </p>
      <label className="flex flex-col gap-1 text-text-secondary">
        <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
          Reason (optional)
        </span>
        <input
          type="text"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          maxLength={200}
          placeholder="Superseded by a newer SOW Draft."
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
          onClick={() => {
            setOpen(false);
            setReason("");
          }}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
      {result && !result.ok ? (
        <span className="text-status-risk">{translateError(result.error)}</span>
      ) : null}
    </div>
  );
}

function translateError(
  code: Exclude<RevokeSowShareTokenResult, { ok: true }>["error"],
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

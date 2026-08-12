"use client";

import * as React from "react";
import { ShieldOff, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  revokeShareTokenAction,
  type RevokeShareTokenResult,
} from "@/lib/reports/share-token-actions";

/**
 * Phase 1B Sprint 4D-C — operator-only revoke control surfaced beside
 * each active share token in the Past Candidates panel.
 *
 * Two-step confirm flow:
 *   1. Initial state — a small "Revoke" button.
 *   2. Confirm state — reason input (optional) + "Confirm revoke" /
 *      "Cancel" pair.
 *
 * Revocation never re-displays the raw token; once revoked, the public
 * route renders the generic-unavailable page regardless of what the
 * recipient does with the URL.
 */

export interface RevokeShareLinkButtonProps {
  tokenId: string;
}

export function RevokeShareLinkButton({ tokenId }: RevokeShareLinkButtonProps) {
  const [pending, startTransition] = React.useTransition();
  const [open, setOpen] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [result, setResult] = React.useState<RevokeShareTokenResult | null>(
    null,
  );

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
        const r = await revokeShareTokenAction({
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
      <span className="uppercase tracking-[0.16em]">
        Confirm revoke
      </span>
      <p className="text-text-secondary">
        The public link will immediately return the generic unavailable
        page. This action is logged and cannot be undone.
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
  code: Exclude<RevokeShareTokenResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Session expired";
    case "invalid-token-id":
      return "Invalid token id";
    case "token-not-found":
      return "Token not found";
    case "already-closed":
      return "Token is already revoked or expired";
    case "service-error":
    default:
      return "Revoke failed";
  }
}

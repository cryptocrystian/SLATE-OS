"use client";

import * as React from "react";
import { Copy, Eye, EyeOff, Send, ShieldAlert, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  SEND_TO_CLIENT_DISCLAIMERS,
  type SendToClientArtifactKind,
  type SendToClientEligibilityReason,
  type SendToClientResult,
} from "@/lib/client-delivery/send-to-client-types";

/**
 * Phase 1B Send to Client Sprint C2-A — reusable two-step confirm
 * modal scaffold.
 *
 * **NOT MOUNTED IN SPRINT C2-A.** This component is exported for use
 * by Sprint C2-B, which will:
 *   1. Import it into `components/reports/report-pdf-candidates-panel.tsx`
 *      and `components/proposals/proposal-candidates-panel.tsx`.
 *   2. Render a per-token `Send to Client` button beside each active
 *      share-token row.
 *   3. Wire `onConfirm` to either
 *      `markReportLinkSentToClientAction` or
 *      `markProposalLinkSentToClientAction`.
 *
 * Until C2-B lands, this file ships as dead code so the import graph
 * is ready and the canon-required disclaimer copy already lives in
 * one place. Lint + build keep it honest.
 *
 * UX contract per `docs/29` § 12:
 *   - Two steps: open + confirm.
 *   - Mandatory audience-label input (Send to Client gate).
 *   - Optional recipient-email input (hashed server-side).
 *   - Three operator-acknowledged checkboxes:
 *       (a) "I copied the link"
 *       (b) "I delivered it through my own approved channel"
 *       (c) "I understand SLATE is only recording the handoff"
 *   - Canon-verbatim disclaimer copy under
 *     `SEND_TO_CLIENT_DISCLAIMERS[artifactKind]`.
 *   - The modal NEVER sends email, NEVER opens `mailto:`, NEVER
 *     invokes a third-party send API. It is a confirmation surface
 *     only.
 *   - The modal is domain-agnostic — it does not know about report
 *     vs. proposal action details. The parent passes a thin
 *     `onConfirm` callback returning a `SendToClientResult`.
 *
 * Operator copy-once for the URL is owned by the caller because the
 * raw URL belongs to the original mint flow. The modal renders an
 * optional `shareUrlPath` prop solely for the operator's convenience
 * (so they can recopy the URL inline before confirming); the modal
 * NEVER persists or logs the URL.
 */

export interface SendToClientConfirmModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  artifactKind: SendToClientArtifactKind;
  /**
   * Token id surfaced for the parent's action call. The modal does
   * not display it (operators don't think in token UUIDs); the parent
   * threads it through `onConfirm`.
   */
  tokenId: string;
  /**
   * Audience label captured at mint time, if any. Pre-populated into
   * the input field but operator-editable per `docs/29` § 12.
   */
  initialAudienceLabel?: string | null;
  /**
   * Whether the token row already carries a `recipient_email_hash`.
   * Surfaced as a "Recipient hash present" indicator but never as the
   * hash bytes or the raw email.
   */
  hasRecipientEmailHash?: boolean;
  /**
   * Optional `/r/<token>` or `/p/<token>` URL the operator can recopy
   * inline. Pass `null` to hide the recopy panel. The URL is never
   * persisted by the modal and never reaches activity metadata.
   */
  shareUrlPath?: string | null;
  /**
   * Optional eligibility reasons computed at modal-open time. When
   * non-empty AND any severity is `error`, the Confirm button stays
   * disabled and the reasons render inline.
   */
  eligibilityReasons?: SendToClientEligibilityReason[];
  /**
   * Parent-provided action runner. Returns the eventual
   * `SendToClientResult` so the modal can surface success / failure.
   * The modal does NOT know which action (report vs. proposal) to
   * call — the parent picks.
   */
  onConfirm: (input: {
    audienceLabel: string;
    recipientEmail?: string;
  }) => Promise<SendToClientResult>;
}

export function SendToClientConfirmModal({
  open,
  onOpenChange,
  artifactKind,
  tokenId: _tokenId,
  initialAudienceLabel,
  hasRecipientEmailHash,
  shareUrlPath,
  eligibilityReasons,
  onConfirm,
}: SendToClientConfirmModalProps) {
  const [audienceLabel, setAudienceLabel] = React.useState(
    initialAudienceLabel ?? "",
  );
  const [recipientEmail, setRecipientEmail] = React.useState("");
  const [reveal, setReveal] = React.useState(false);
  const [copiedConfirm, setCopiedConfirm] = React.useState(false);
  const [deliveredConfirm, setDeliveredConfirm] = React.useState(false);
  const [recordOnlyConfirm, setRecordOnlyConfirm] = React.useState(false);
  const [urlCopied, setUrlCopied] = React.useState(false);
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<SendToClientResult | null>(null);

  // Reset transient state every time the modal is reopened so the
  // operator does not see stale checkboxes / inputs from a prior run.
  React.useEffect(() => {
    if (open) {
      setAudienceLabel(initialAudienceLabel ?? "");
      setRecipientEmail("");
      setReveal(false);
      setCopiedConfirm(false);
      setDeliveredConfirm(false);
      setRecordOnlyConfirm(false);
      setUrlCopied(false);
      setResult(null);
    }
  }, [open, initialAudienceLabel]);

  if (!open) return null;

  const audienceFilled = audienceLabel.trim().length > 0;
  const allChecks =
    copiedConfirm && deliveredConfirm && recordOnlyConfirm;
  const hasBlockingReason =
    eligibilityReasons?.some((r) => r.severity === "error") ?? false;
  const confirmDisabled =
    pending || !audienceFilled || !allChecks || hasBlockingReason;

  const headingLabel =
    artifactKind === "report"
      ? "Confirm Send Report to Client"
      : "Confirm Send Proposal to Client";
  const disclaimer = SEND_TO_CLIENT_DISCLAIMERS[artifactKind];

  async function onCopyUrl() {
    if (!shareUrlPath) return;
    try {
      await navigator.clipboard.writeText(shareUrlPath);
      setUrlCopied(true);
      window.setTimeout(() => setUrlCopied(false), 2400);
    } catch {
      // Operator can still select + copy from the visible field.
    }
  }

  function onConfirmClick() {
    setResult(null);
    const trimmedAudience = audienceLabel.trim();
    const trimmedEmail = recipientEmail.trim();
    startTransition(async () => {
      try {
        const r = await onConfirm({
          audienceLabel: trimmedAudience,
          recipientEmail: trimmedEmail.length > 0 ? trimmedEmail : undefined,
        });
        setResult(r);
        if (r.ok) {
          // Close after a brief beat so the operator sees the success
          // chip before the modal disappears.
          window.setTimeout(() => onOpenChange(false), 800);
        }
      } catch {
        setResult({
          ok: false,
          status: "failed",
          error: "service-error",
        });
      }
    });
  }

  return (
    <div
      aria-modal
      role="dialog"
      aria-labelledby="send-to-client-modal-heading"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
    >
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-lg border border-border-strong bg-bg-elevated p-5 shadow-card">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Send to Client · operator-mediated handoff
            </span>
            <h2
              id="send-to-client-modal-heading"
              className="text-base font-semibold tracking-tight text-text-primary"
            >
              {headingLabel}
            </h2>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leadingIcon={<X className="h-3.5 w-3.5" />}
            onClick={() => onOpenChange(false)}
            disabled={pending}
            aria-label="Close"
          >
            Close
          </Button>
        </div>

        <p className="text-xs leading-relaxed text-text-secondary">
          {disclaimer}
        </p>

        {eligibilityReasons && eligibilityReasons.length > 0 ? (
          <EligibilityNotice reasons={eligibilityReasons} />
        ) : null}

        {shareUrlPath ? (
          <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-surface/50 p-3">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
              Share URL (operator copies; SLATE does not send)
            </span>
            <code
              className="select-all break-all rounded border border-border-subtle bg-bg-surface px-2 py-1 font-mono text-[11px] text-text-primary"
              aria-label="Share URL"
            >
              {reveal
                ? shareUrlPath
                : "•".repeat(Math.min(shareUrlPath.length, 48))}
            </code>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                leadingIcon={<Copy className="h-3.5 w-3.5" />}
                onClick={onCopyUrl}
                disabled={pending}
              >
                {urlCopied ? "Copied" : "Copy URL"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                leadingIcon={
                  reveal ? (
                    <EyeOff className="h-3.5 w-3.5" />
                  ) : (
                    <Eye className="h-3.5 w-3.5" />
                  )
                }
                onClick={() => setReveal((p) => !p)}
                disabled={pending}
              >
                {reveal ? "Hide" : "Reveal"}
              </Button>
            </div>
          </div>
        ) : null}

        <label className="flex flex-col gap-1 text-[11px] text-text-secondary">
          <span className="uppercase tracking-[0.14em] text-text-muted">
            Audience label · required
          </span>
          <input
            type="text"
            value={audienceLabel}
            onChange={(e) => setAudienceLabel(e.target.value.slice(0, 80))}
            maxLength={80}
            placeholder="e.g. J. Patel (CFO, Acme · pre-board read)"
            disabled={pending}
            className="rounded border border-border-subtle bg-bg-surface px-2 py-1.5 text-xs text-text-primary outline-none focus:border-border-strong"
          />
          <span className="text-[10px] text-text-muted">
            Operator-visible only. Never rendered on the public route.
          </span>
        </label>

        <label className="flex flex-col gap-1 text-[11px] text-text-secondary">
          <span className="uppercase tracking-[0.14em] text-text-muted">
            Recipient email · optional · hashed at rest
          </span>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) => setRecipientEmail(e.target.value.slice(0, 254))}
            maxLength={254}
            placeholder={
              hasRecipientEmailHash
                ? "Hash already stored — enter a new value to update"
                : "reviewer@client.example"
            }
            disabled={pending}
            className="rounded border border-border-subtle bg-bg-surface px-2 py-1.5 text-xs text-text-primary outline-none focus:border-border-strong"
          />
          <span className="text-[10px] text-text-muted">
            SLATE does not email this recipient. The value is hashed
            before persistence; the raw email never reaches the DB or
            the activity feed.
          </span>
        </label>

        <fieldset className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-bg-surface/50 p-3 text-[11px] text-text-secondary">
          <legend className="px-1 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
            Operator acknowledgement
          </legend>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={copiedConfirm}
              onChange={(e) => setCopiedConfirm(e.target.checked)}
              disabled={pending}
              className="mt-0.5"
            />
            <span>I copied the link.</span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={deliveredConfirm}
              onChange={(e) => setDeliveredConfirm(e.target.checked)}
              disabled={pending}
              className="mt-0.5"
            />
            <span>I delivered it through my own approved channel.</span>
          </label>
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={recordOnlyConfirm}
              onChange={(e) => setRecordOnlyConfirm(e.target.checked)}
              disabled={pending}
              className="mt-0.5"
            />
            <span>
              I understand SLATE is only recording the handoff (no
              email / CRM / e-signature delivery).
            </span>
          </label>
        </fieldset>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="primary"
            size="sm"
            leadingIcon={<Send className="h-3.5 w-3.5" />}
            onClick={onConfirmClick}
            disabled={confirmDisabled}
          >
            {pending ? "Marking…" : "Confirm send"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leadingIcon={<X className="h-3.5 w-3.5" />}
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          {hasRecipientEmailHash ? (
            <Badge tone="neutral" variant="outline">
              Recipient hash stored
            </Badge>
          ) : null}
        </div>

        {result?.ok ? (
          <p className="rounded-md border border-status-success/40 bg-status-success/10 p-2 text-[11px] text-status-success">
            Marked sent. SLATE recorded the handoff in the audit log
            and did not deliver the link.
          </p>
        ) : null}
        {result && !result.ok ? <FailureNotice result={result} /> : null}
      </div>
    </div>
  );
}

function EligibilityNotice({
  reasons,
}: {
  reasons: SendToClientEligibilityReason[];
}) {
  const errors = reasons.filter((r) => r.severity === "error");
  if (errors.length === 0) return null;
  return (
    <div className="flex max-w-md flex-col gap-1 rounded-md border border-status-risk/40 bg-status-risk/10 p-3 text-[11px] leading-relaxed text-status-risk">
      <div className="flex items-center gap-2">
        <ShieldAlert aria-hidden className="h-3.5 w-3.5" />
        <span className="uppercase tracking-[0.16em]">
          Send disabled
        </span>
      </div>
      <ul className="flex flex-col gap-1 text-text-secondary">
        {errors.slice(0, 6).map((r, i) => (
          <li key={`${r.code}-${i}`} className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-risk"
            />
            <span>{r.message}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function FailureNotice({
  result,
}: {
  result: Exclude<SendToClientResult, { ok: true }>;
}) {
  return (
    <div className="rounded-md border border-status-risk/40 bg-status-risk/10 p-2 text-[11px] text-status-risk">
      <span className="uppercase tracking-[0.16em]">
        {translateError(result.error)}
      </span>
      {result.reasons && result.reasons.length > 0 ? (
        <ul className="mt-1 flex flex-col gap-1 text-text-secondary">
          {result.reasons.slice(0, 4).map((r, i) => (
            <li key={`${r.code}-${i}`}>{r.message}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function translateError(
  code: Exclude<SendToClientResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Session expired";
    case "invalid-token":
      return "Invalid token id";
    case "token-not-found":
      return "Share token not found";
    case "audience-label-missing":
      return "Audience label is required";
    case "audience-label-too-long":
      return "Audience label is too long";
    case "operator-not-confirmed":
      return "Operator confirmation missing";
    case "not-eligible":
      return "Send eligibility check failed";
    case "service-error":
    default:
      return "Mark-sent failed";
  }
}

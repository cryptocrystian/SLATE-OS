"use client";

import * as React from "react";
import { Copy, Eye, EyeOff, Link2, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  generateProposalShareLinkAction,
  type GenerateProposalShareLinkResult,
} from "@/lib/proposals/share-token-actions";
import type { ProposalShareEligibilityReason } from "@/lib/proposals/share-token-types";
import { PRE_DELIVERY_REASON_DISPLAY } from "@/lib/engagement-readiness/pre-delivery-audit";

/**
 * Phase 1B Proposal/SOW Delivery Sprint P4 — operator-only Generate
 * Proposal Review Link button.
 *
 * Renders one of three states per row:
 *   1. Ineligible — disabled chip + reasons. No action.
 *   2. Eligible (idle) — "Generate Proposal Review Link" button.
 *   3. Just-generated — copy-once panel showing raw token URL path
 *      EXACTLY ONCE. Once the operator clicks Hide / navigates away
 *      / the component unmounts, the raw token is gone from React
 *      state and cannot be recovered.
 *
 * The raw token / URL path never go to:
 *   - localStorage / sessionStorage
 *   - the browser URL bar
 *   - the activity feed (the server action logs only sanitized
 *     metadata; never the raw token)
 *   - the DB (only the SHA-256 hash is persisted)
 *
 * In this sprint no `/p/[token]` route exists yet; the URL path is
 * still safe to copy but it can't be followed. The operator copies it
 * for out-of-band delivery only. Sprint P5 wires the public route.
 */

export interface GenerateProposalShareLinkButtonProps {
  snapshotId: string;
  /** Empty array ⇔ eligible. */
  ineligibilityReasons: ProposalShareEligibilityReason[];
}

export function GenerateProposalShareLinkButton({
  snapshotId,
  ineligibilityReasons,
}: GenerateProposalShareLinkButtonProps) {
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] =
    React.useState<GenerateProposalShareLinkResult | null>(null);
  const [reveal, setReveal] = React.useState(false);
  const [audienceLabel, setAudienceLabel] = React.useState("");
  const [recipientEmail, setRecipientEmail] = React.useState("");

  if (ineligibilityReasons.length > 0) {
    return <IneligibleNotice reasons={ineligibilityReasons} />;
  }

  function onGenerate() {
    setResult(null);
    setReveal(true);
    const trimmedAudience = audienceLabel.trim();
    const trimmedEmail = recipientEmail.trim();
    startTransition(async () => {
      try {
        const r = await generateProposalShareLinkAction({
          snapshotId,
          audienceLabel:
            trimmedAudience.length > 0 ? trimmedAudience : undefined,
          recipientEmail: trimmedEmail.length > 0 ? trimmedEmail : undefined,
        });
        setResult(r);
      } catch {
        setResult({ ok: false, error: "service-error" });
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <OperatorTrackingFields
        disabled={pending}
        audienceLabel={audienceLabel}
        onAudienceLabelChange={setAudienceLabel}
        recipientEmail={recipientEmail}
        onRecipientEmailChange={setRecipientEmail}
      />
      <Button
        type="button"
        variant="secondary"
        size="sm"
        leadingIcon={<Link2 className="h-3.5 w-3.5" />}
        disabled={pending}
        onClick={onGenerate}
      >
        {pending ? "Generating…" : "Generate Proposal Review Link"}
      </Button>

      {result?.ok ? (
        <CopyOncePanel
          shareUrlPath={result.shareUrlPath}
          expiresAt={result.expiresAt}
          reveal={reveal}
          onToggleReveal={() => setReveal((p) => !p)}
        />
      ) : null}

      {result && !result.ok ? <FailureNotice result={result} /> : null}
    </div>
  );
}

/**
 * Sprint H1 — operator-tracking fields mirroring the report-side
 * `<OperatorTrackingFields>`. Audience label and recipient email are
 * operator-audit-only; SLATE never emails the recipient. The email is
 * hashed by the server action; the raw value never reaches the DB or
 * the activity feed.
 */
function OperatorTrackingFields({
  disabled,
  audienceLabel,
  onAudienceLabelChange,
  recipientEmail,
  onRecipientEmailChange,
}: {
  disabled: boolean;
  audienceLabel: string;
  onAudienceLabelChange: (v: string) => void;
  recipientEmail: string;
  onRecipientEmailChange: (v: string) => void;
}) {
  return (
    <details className="w-full max-w-md rounded-md border border-border-subtle bg-bg-elevated/40 px-3 py-2 text-[11px] text-text-secondary">
      <summary className="cursor-pointer font-mono uppercase tracking-[0.14em] text-text-muted">
        Optional · audience label and recipient email
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <p className="text-[11px] leading-relaxed text-text-muted">
          Optional. Used for operator tracking only. SLATE does not
          email this recipient. The email is hashed at rest; SLATE never
          stores the raw address.
        </p>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
            Audience label
          </span>
          <input
            type="text"
            value={audienceLabel}
            onChange={(e) => onAudienceLabelChange(e.target.value.slice(0, 80))}
            disabled={disabled}
            maxLength={80}
            placeholder="Procurement · CFO · Board pre-read"
            className="rounded border border-border-subtle bg-bg-surface px-2 py-1 text-[11px] text-text-primary placeholder:text-text-disabled"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
            Recipient email (hashed at rest)
          </span>
          <input
            type="email"
            value={recipientEmail}
            onChange={(e) =>
              onRecipientEmailChange(e.target.value.slice(0, 254))
            }
            disabled={disabled}
            maxLength={254}
            placeholder="reviewer@client.example"
            className="rounded border border-border-subtle bg-bg-surface px-2 py-1 text-[11px] text-text-primary placeholder:text-text-disabled"
          />
        </label>
      </div>
    </details>
  );
}

function IneligibleNotice({
  reasons,
}: {
  reasons: ProposalShareEligibilityReason[];
}) {
  return (
    <div className="flex flex-col items-start gap-1.5">
      <Badge tone="neutral" variant="outline">
        Share disabled
      </Badge>
      <ul className="flex max-w-md flex-col gap-1 text-[11px] leading-relaxed text-text-muted">
        {reasons.slice(0, 4).map((r) => (
          <li key={r.code} className="flex items-start gap-2">
            <span
              aria-hidden
              className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-muted"
            />
            <span>{r.operatorFacingNote}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CopyOncePanel({
  shareUrlPath,
  expiresAt,
  reveal,
  onToggleReveal,
}: {
  shareUrlPath: string;
  expiresAt: string;
  reveal: boolean;
  onToggleReveal: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(shareUrlPath);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch {
      // Browsers without async clipboard fall through silently;
      // operator can still select + copy from the revealed field.
    }
  }

  return (
    <div className="flex max-w-md flex-col gap-2 rounded-md border border-status-success/40 bg-status-success/10 p-3 text-[11px] leading-relaxed text-status-success">
      <span className="font-mono uppercase tracking-[0.16em]">
        Proposal review link generated — copy now
      </span>
      <p className="text-text-secondary">
        This URL path is displayed exactly once. SLATE stores only its
        SHA-256 hash; once you close this panel, the raw token cannot
        be recovered. Hand it to the client out of band (no email,
        Slack, or CRM send from SLATE). Expires{" "}
        <span className="font-mono">{formatTimestamp(expiresAt)}</span>.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code
          className="select-all break-all rounded border border-border-subtle bg-bg-surface px-2 py-1 font-mono text-[11px] text-text-primary"
          aria-label="Proposal share URL path"
        >
          {reveal
            ? shareUrlPath
            : "•".repeat(Math.min(shareUrlPath.length, 48))}
        </code>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          leadingIcon={<Copy className="h-3.5 w-3.5" />}
          onClick={onCopy}
        >
          {copied ? "Copied" : "Copy URL"}
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
          onClick={onToggleReveal}
        >
          {reveal ? "Hide" : "Reveal"}
        </Button>
        <Badge tone="success" variant="outline">
          Public proposal route is live
        </Badge>
      </div>
    </div>
  );
}

function FailureNotice({
  result,
}: {
  result: Exclude<GenerateProposalShareLinkResult, { ok: true }>;
}) {
  return (
    <div className="flex max-w-md flex-col gap-2 rounded-md border border-status-risk/40 bg-status-risk/10 p-3 text-[11px] leading-relaxed text-status-risk">
      <div className="flex items-center gap-2">
        <ShieldAlert aria-hidden className="h-3.5 w-3.5" />
        <span className="font-mono uppercase tracking-[0.16em]">
          {translateError(result.error)}
        </span>
      </div>
      {result.error === "snapshot-not-eligible" && result.ineligibilityReasons ? (
        <ul className="flex flex-col gap-1 text-text-secondary">
          {result.ineligibilityReasons.slice(0, 6).map((r, i) => (
            <li
              key={`${r.code}-${i}`}
              className="flex items-start gap-2"
            >
              <span
                aria-hidden
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-risk"
              />
              <span>
                <code className="font-mono text-[10px]">{r.code}</code> ·{" "}
                <span className="text-text-muted">{r.note}</span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {result.error === "pre-delivery-audit-blocked" &&
      result.preDeliveryAuditReasons ? (
        <ul className="flex flex-col gap-1 text-text-secondary">
          {result.preDeliveryAuditReasons.slice(0, 6).map((r, i) => {
            const display = PRE_DELIVERY_REASON_DISPLAY[r.code];
            return (
              <li
                key={`${r.code}-${i}`}
                className="flex items-start gap-2"
              >
                <span
                  aria-hidden
                  className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-risk"
                />
                <span>
                  <code className="font-mono text-[10px]">
                    {display?.shortLabel ?? r.code}
                  </code>{" "}
                  · <span className="text-text-muted">{r.message}</span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function translateError(
  code: Exclude<GenerateProposalShareLinkResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Session expired";
    case "invalid-snapshot":
      return "Invalid snapshot";
    case "snapshot-not-found":
      return "Snapshot not found";
    case "snapshot-not-eligible":
      return "Snapshot is not share-eligible";
    case "pre-delivery-audit-blocked":
      return "Pre-delivery audit blocked mint";
    case "invalid-expiry":
      return "Requested expiry outside policy";
    case "service-error":
    default:
      return "Generation failed";
  }
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

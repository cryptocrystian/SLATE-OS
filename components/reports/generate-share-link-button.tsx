"use client";

import * as React from "react";
import { Copy, Eye, EyeOff, Link2, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  generateShareLinkAction,
  type GenerateShareLinkResult,
} from "@/lib/reports/share-token-actions";
import type { ReportShareEligibilityReason } from "@/lib/reports/share-token-types";

/**
 * Phase 1B Sprint 4D-B — operator-only Generate Share Link button.
 *
 * Renders one of three states per row:
 *   1. Ineligible — disabled chip + reasons. No action.
 *   2. Eligible (idle) — "Generate share link" button.
 *   3. Just-generated — copy-once panel showing raw token EXACTLY ONCE.
 *      Once the operator clicks Hide / clicks away / mounts elsewhere,
 *      the raw token is gone from the React state and cannot be
 *      recovered.
 *
 * The raw token never goes to:
 *   - localStorage / sessionStorage
 *   - the URL
 *   - the activity feed
 *   - the DB (only the SHA-256 hash is persisted)
 *
 * In this sprint no `/r/[token]` route exists yet; the raw token is
 * still safe to copy, but it can't be followed. The operator copies it
 * for out-of-band delivery only.
 */

export interface GenerateShareLinkButtonProps {
  snapshotId: string;
  /** Empty array ⇔ eligible. */
  ineligibilityReasons: ReportShareEligibilityReason[];
}

export function GenerateShareLinkButton({
  snapshotId,
  ineligibilityReasons,
}: GenerateShareLinkButtonProps) {
  const [pending, startTransition] = React.useTransition();
  const [result, setResult] = React.useState<GenerateShareLinkResult | null>(
    null,
  );
  const [reveal, setReveal] = React.useState(false);

  if (ineligibilityReasons.length > 0) {
    return <IneligibleNotice reasons={ineligibilityReasons} />;
  }

  function onGenerate() {
    setResult(null);
    setReveal(true);
    startTransition(async () => {
      try {
        const r = await generateShareLinkAction({ snapshotId });
        setResult(r);
      } catch {
        setResult({ ok: false, error: "service-error" });
      }
    });
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button
        type="button"
        variant="secondary"
        size="sm"
        leadingIcon={<Link2 className="h-3.5 w-3.5" />}
        disabled={pending}
        onClick={onGenerate}
      >
        {pending ? "Generating…" : "Generate share link"}
      </Button>

      {result?.ok ? (
        <CopyOncePanel
          rawToken={result.rawToken}
          expiresAt={result.expiresAt}
          reveal={reveal}
          onToggleReveal={() => setReveal((p) => !p)}
        />
      ) : null}

      {result && !result.ok ? <FailureNotice result={result} /> : null}
    </div>
  );
}

function IneligibleNotice({
  reasons,
}: {
  reasons: ReportShareEligibilityReason[];
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
  rawToken,
  expiresAt,
  reveal,
  onToggleReveal,
}: {
  rawToken: string;
  expiresAt: string;
  reveal: boolean;
  onToggleReveal: () => void;
}) {
  const [copied, setCopied] = React.useState(false);

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(rawToken);
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
        Share link generated — copy now
      </span>
      <p className="text-text-secondary">
        This token is displayed exactly once. SLATE stores only its
        SHA-256 hash; once you close this panel, the raw token cannot
        be recovered. Hand it to the client out of band (no email,
        Slack, or CRM send from SLATE). Expires{" "}
        <span className="font-mono">{formatTimestamp(expiresAt)}</span>.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <code
          className="select-all break-all rounded border border-border-subtle bg-bg-surface px-2 py-1 font-mono text-[11px] text-text-primary"
          aria-label="Raw share token"
        >
          {reveal ? rawToken : "•".repeat(Math.min(rawToken.length, 40))}
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
          {copied ? "Copied" : "Copy token"}
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
        <Badge tone="warning" variant="outline">
          Public route lands in Sprint 4D-C
        </Badge>
      </div>
    </div>
  );
}

function FailureNotice({
  result,
}: {
  result: Exclude<GenerateShareLinkResult, { ok: true }>;
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
    </div>
  );
}

function translateError(
  code: Exclude<GenerateShareLinkResult, { ok: true }>["error"],
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

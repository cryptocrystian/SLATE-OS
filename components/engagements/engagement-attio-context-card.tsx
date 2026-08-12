import * as React from "react";
import { AlertTriangle, ExternalLink, Link2, ShieldOff } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LinkAttioCompanyForm } from "@/components/engagements/link-attio-company-form";
import type { CrmContextSourceStatus } from "@/lib/crm/types";

/**
 * Sprint S3-B — Read-only Attio context surface on the engagement page.
 *
 * Canon: `docs/42` § 12 + § 5.
 *
 * Renders one of four states:
 *   - "not-configured" → hidden entirely (workspace doesn't have the
 *     ATTIO_ACCESS_TOKEN env var; this is silent so it doesn't add
 *     noise to non-CRM engagements).
 *   - "not-linked"     → mini form prompting operator to paste the
 *     Attio Company record_id.
 *   - "fetch-failed"   → "Attio link broken — re-link?" affordance.
 *   - "linked"         → brand chip + relationship owner + last touch +
 *     deal summary + contacts summary + warnings for missing custom
 *     properties.
 *
 * Boundary copy held verbatim across every state: "Read-only. SLATE
 * does not write to Attio."
 */

export interface EngagementAttioContextCardProps {
  /** Server-resolved `CrmContextSourceStatus | null`. `null` means the
   *  engagement is not persisted yet (mock fixture) — render nothing. */
  status: CrmContextSourceStatus | null;
}

export function EngagementAttioContextCard({
  status,
}: EngagementAttioContextCardProps) {
  if (!status) return null;

  // Silent in the not-configured case — keeps the page calm for
  // workspaces that haven't wired the CRM yet.
  if (status.status === "not-configured") return null;

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-secondary">
            <Link2 className="h-4 w-4" />
          </span>
          <div className="flex flex-col">
            <h3 className="text-base font-semibold tracking-tight text-text-primary">
              Attio context
            </h3>
            <p className="text-[11px] text-text-muted">
              Read-only. SLATE does not write to Attio.
            </p>
          </div>
          <Badge tone="info" variant="outline" className="ml-auto">
            Secondary lane
          </Badge>
        </div>

        {status.status === "not-linked" ? (
          <NotLinkedState accountId={status.accountId} />
        ) : null}
        {status.status === "fetch-failed" ? (
          <FetchFailedState reason={status.reason} />
        ) : null}
        {status.status === "linked" ? (
          <LinkedState status={status} />
        ) : null}
      </CardBody>
    </Card>
  );
}

function NotLinkedState({ accountId }: { accountId: string }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs leading-relaxed text-text-secondary">
        This SLATE account is not linked to an Attio Company record yet.
        Paste the Attio Company record_id below to enable read-only context
        enrichment (brand, owner, last touch, deal summary, contacts).
        SLATE will not write to Attio.
      </p>
      <LinkAttioCompanyForm accountId={accountId} />
    </div>
  );
}

function FetchFailedState({ reason }: { reason: string }) {
  return (
    <div className="flex items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-3 text-xs text-text-secondary">
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warning" />
      <span className="leading-relaxed">
        <span className="font-medium text-status-warning">
          Attio link broken.
        </span>{" "}
        {reason} The stored Attio Company ID is preserved; use the link
        form when re-linking against a fresh Attio record.
      </span>
    </div>
  );
}

function LinkedState({
  status,
}: {
  status: Extract<CrmContextSourceStatus, { status: "linked" }>;
}) {
  const { account, relationshipOwner, activity, deals, contacts, warnings } =
    status.context;
  const lastTouchDisplay = formatTimestamp(activity.lastTouchAt);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        {account.brand ? (
          <Badge tone="brand" variant="outline">
            {account.brand}
          </Badge>
        ) : null}
        {account.leadSource ? (
          <Badge tone="neutral" variant="outline">
            {account.leadSource}
          </Badge>
        ) : null}
        {account.buyingTimeline ? (
          <Badge tone="neutral" variant="outline">
            {account.buyingTimeline}
          </Badge>
        ) : null}
      </div>

      <dl className="grid grid-cols-1 gap-y-2 text-xs">
        <Row label="Company" value={account.name ?? "—"} />
        {account.domain ? (
          <Row label="Domain" value={account.domain} />
        ) : null}
        <Row
          label="Relationship owner"
          value={relationshipOwner?.displayName ?? "—"}
        />
        <Row label="Last touch" value={lastTouchDisplay} />
      </dl>

      {account.knownPainPointsPreview ? (
        <div className="flex flex-col gap-1 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
            Known pain points
          </span>
          <p className="text-xs leading-relaxed text-text-secondary">
            {account.knownPainPointsPreview}
          </p>
        </div>
      ) : null}

      {deals.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
            Deals ({deals.length})
          </span>
          <ul className="flex flex-col gap-1.5">
            {deals.map((deal) => (
              <li
                key={deal.providerDealId}
                className="flex flex-wrap items-center gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 px-2.5 py-1.5 text-[11px] text-text-secondary"
              >
                <span className="font-medium text-text-primary">
                  {deal.name ?? "Untitled deal"}
                </span>
                {deal.pipelineStage ? (
                  <Badge tone="neutral" variant="outline">
                    {deal.pipelineStage}
                  </Badge>
                ) : null}
                {deal.value ? (
                  <span className="font-mono tabular-nums">
                    {formatCurrency(deal.value.amount, deal.value.currency)}
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {contacts.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-text-muted">
            Contacts ({contacts.length})
          </span>
          <ul className="flex flex-col gap-1.5">
            {contacts.slice(0, 6).map((c) => (
              <li
                key={c.providerContactId}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 px-2.5 py-1.5 text-[11px]"
              >
                <span className="text-text-primary">
                  {c.fullName ?? "Unnamed contact"}
                  {c.primaryRole ? (
                    <span className="text-text-muted"> · {c.primaryRole}</span>
                  ) : null}
                </span>
                {/* Email intentionally NOT rendered here — see boundary
                    note below; full record visible on Attio. */}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {warnings.length > 0 ? (
        <div className="flex flex-col gap-1.5 rounded-md border border-border-subtle bg-bg-elevated/30 p-3">
          <div className="flex items-center gap-2 text-[11px] text-text-muted">
            <ShieldOff className="h-3 w-3" />
            <span className="uppercase tracking-[0.16em]">
              Missing in Attio · {warnings.length}
            </span>
          </div>
          <ul className="flex flex-col gap-1 text-[11px] leading-relaxed text-text-secondary">
            {warnings.slice(0, 6).map((w, i) => (
              <li key={`${w.code}:${i}`}>{w.message}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border-subtle pt-3 text-[11px] text-text-muted">
        <span>
          Fetched {formatTimestamp(status.context.fetchedAt)} · provider{" "}
          <code className="font-mono">{status.context.provider}</code>
        </span>
        {account.externalUrl ? (
          <a
            href={account.externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-text-secondary underline decoration-dotted underline-offset-2 hover:text-text-primary"
          >
            View in Attio
            <ExternalLink className="h-3 w-3" />
          </a>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-2 last:border-b-0 last:pb-0">
      <dt className="text-text-muted">{label}</dt>
      <dd className="text-right font-medium text-text-secondary">{value}</dd>
    </div>
  );
}

function formatTimestamp(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const now = Date.now();
  const diffMs = now - d.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin} min ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay} d ago`;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount.toLocaleString()} ${currency}`;
  }
}

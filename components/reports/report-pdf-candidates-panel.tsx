import * as React from "react";
import Link from "next/link";
import {
  ExternalLink,
  FileText,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
  Slash,
  History,
  Link2,
} from "lucide-react";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getReportDeliverySnapshotsForReport } from "@/lib/reports/delivery-snapshot-queries";
import { evaluateReportShareEligibility } from "@/lib/reports/share-token-eligibility";
import { getReportShareTokensForReport } from "@/lib/reports/share-token-queries";
import type {
  ReportShareEligibilityReason,
  ReportShareToken,
  ReportShareTokenStatus,
} from "@/lib/reports/share-token-types";
import { GenerateShareLinkButton } from "./generate-share-link-button";
import { RevokeShareLinkButton } from "./revoke-share-link-button";
import { SendReportLinkToClientButton } from "./send-report-link-to-client-button";
import { VoidPdfCandidateButton } from "./void-pdf-candidate-button";

/**
 * Phase 1B Sprint 4C-D — operator-only Past Candidates panel.
 *
 * Read-only list of `report_delivery_snapshots` for a given report,
 * with a per-row void affordance (non-voided snapshots only). Pure
 * server component — the list fetches via `getReportDeliverySnapshotsForReport`
 * which runs through the cookie-bound RLS boundary; non-operator
 * sessions never see snapshot rows.
 *
 * Boundaries:
 *   - No public link.
 *   - No client delivery.
 *   - No PDF binary surfaced; the panel links to the candidate route
 *     (which itself renders snapshot-pure metadata).
 *   - Voided snapshots stay in the list (not deleted) and are visibly
 *     marked.
 */

export interface ReportPdfCandidatesPanelProps {
  engagementId: string;
  reportId: string;
}

const STATUS_TONE: Record<"candidate" | "generated" | "voided", BadgeTone> = {
  candidate: "info",
  generated: "success",
  voided: "neutral",
};

const STATUS_LABEL: Record<"candidate" | "generated" | "voided", string> = {
  candidate: "Candidate",
  generated: "Generated",
  voided: "Voided",
};

const SHARE_TOKEN_TONE: Record<ReportShareTokenStatus, BadgeTone> = {
  active: "success",
  revoked: "neutral",
  expired: "neutral",
};

const SHARE_TOKEN_LABEL: Record<ReportShareTokenStatus, string> = {
  active: "Active",
  revoked: "Revoked",
  expired: "Expired",
};

export async function ReportPdfCandidatesPanel({
  engagementId,
  reportId,
}: ReportPdfCandidatesPanelProps) {
  const [snapshots, shareTokens] = await Promise.all([
    getReportDeliverySnapshotsForReport(reportId),
    getReportShareTokensForReport(reportId),
  ]);
  const tokensBySnapshotId = new Map<string, ReportShareToken[]>();
  for (const token of shareTokens) {
    const bucket = tokensBySnapshotId.get(token.snapshotId) ?? [];
    bucket.push(token);
    tokensBySnapshotId.set(token.snapshotId, bucket);
  }

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-muted">
              <History className="h-3.5 w-3.5" />
            </span>
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Past PDF candidates
            </span>
          </div>
          <span className="text-[11px] text-text-muted">
            {snapshots.length} snapshot{snapshots.length === 1 ? "" : "s"}
          </span>
        </div>

        <p className="max-w-prose text-[11px] leading-relaxed text-text-muted">
          Operator-only history of report PDF candidate snapshots. SLATE
          does not send these artifacts to clients. Voided snapshots
          remain visible (not deleted) so the audit trail is preserved.
        </p>

        {snapshots.length === 0 ? (
          <div className="rounded-md border border-dashed border-border-subtle bg-bg-surface/40 p-4 text-[11px] leading-relaxed text-text-muted">
            <span className="font-mono uppercase tracking-[0.14em] text-text-muted">
              No candidates yet
            </span>
            <p className="mt-1">
              Click <strong>Generate PDF Candidate</strong> in the
              actions row to produce the first metadata-only candidate
              snapshot. Sections must be at <code>needs-review</code>,
              <code>drafted</code>, <code>approved</code>, or{" "}
              <code>final</code> to be included.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {snapshots.map((s) => {
              const eligibility = evaluateReportShareEligibility(s);
              const snapshotShareTokens = tokensBySnapshotId.get(s.id) ?? [];
              return (
                <li key={s.id}>
                  <SnapshotRow
                    engagementId={engagementId}
                    snapshotId={s.id}
                    status={s.status}
                    deliverySurface={s.deliverySurface}
                    draftWatermark={s.draftWatermark}
                    generatedAt={s.generatedAt}
                    generatedByLabel={s.generatedByLabel}
                    reportStatusAtGeneration={s.reportStatusAtGeneration}
                    claimGuardPassed={s.claimGuardResult.passed}
                    claimGuardViolations={
                      s.claimGuardResult.violations?.length ?? 0
                    }
                    includedSectionCount={
                      s.sectionSnapshot.filter((x) => x.includedInArtifact).length
                    }
                    includedExhibitCount={
                      s.exhibitSnapshot.filter((x) => x.renderedInArtifact).length
                    }
                    staleAcceptedCount={
                      s.sourceSummarySnapshot.acceptedStaleSlots?.length ?? 0
                    }
                    voidReason={s.voidReason}
                    voidedAt={s.voidedAt}
                    shareIneligibilityReasons={eligibility.reasons}
                    shareTokens={snapshotShareTokens}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

interface SnapshotRowProps {
  engagementId: string;
  snapshotId: string;
  status: "candidate" | "generated" | "voided";
  deliverySurface: "internal_candidate" | "client_pdf_candidate";
  draftWatermark: boolean;
  generatedAt: string;
  generatedByLabel: string | null;
  reportStatusAtGeneration: string;
  claimGuardPassed: boolean;
  claimGuardViolations: number;
  includedSectionCount: number;
  includedExhibitCount: number;
  staleAcceptedCount: number;
  voidReason: string | null;
  voidedAt: string | null;
  shareIneligibilityReasons: ReportShareEligibilityReason[];
  shareTokens: ReportShareToken[];
}

function SnapshotRow(props: SnapshotRowProps) {
  const candidateHref = `/app/engagements/${props.engagementId}/report/pdf-candidate/${props.snapshotId}`;
  const isVoided = props.status === "voided";

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={STATUS_TONE[props.status]}>
          {STATUS_LABEL[props.status]}
        </Badge>
        <Badge
          tone={
            props.deliverySurface === "client_pdf_candidate" ? "info" : "neutral"
          }
          variant="outline"
        >
          {props.deliverySurface === "client_pdf_candidate"
            ? "Client-safe candidate"
            : "Internal candidate"}
        </Badge>
        {props.draftWatermark ? (
          <Badge tone="warning" variant="outline">
            Draft watermark
          </Badge>
        ) : null}
        {props.claimGuardPassed ? (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-status-success"
            title="Claim guard scan passed"
          >
            <ShieldCheck className="h-3 w-3" aria-hidden />
            Claim guard passed
          </span>
        ) : (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-status-risk"
            title="Claim guard violations recorded"
          >
            <ShieldAlert className="h-3 w-3" aria-hidden />
            {props.claimGuardViolations} violation
            {props.claimGuardViolations === 1 ? "" : "s"}
          </span>
        )}
        {props.staleAcceptedCount > 0 ? (
          <span
            className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] text-status-warning"
            title="Stale source data accepted at generation time"
          >
            <Sparkles className="h-3 w-3" aria-hidden />
            Stale accepted ({props.staleAcceptedCount})
          </span>
        ) : null}
        <span className="text-[11px] text-text-muted">
          {formatTimestamp(props.generatedAt)}
        </span>
      </div>

      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px] text-text-secondary">
        <span>
          <span className="font-mono uppercase tracking-[0.12em] text-text-muted">
            Sections
          </span>{" "}
          {props.includedSectionCount} included
        </span>
        <span>
          <span className="font-mono uppercase tracking-[0.12em] text-text-muted">
            Exhibits
          </span>{" "}
          {props.includedExhibitCount} rendered
        </span>
        <span>
          <span className="font-mono uppercase tracking-[0.12em] text-text-muted">
            Report status
          </span>{" "}
          {props.reportStatusAtGeneration}
        </span>
        {props.generatedByLabel ? (
          <span>
            <span className="font-mono uppercase tracking-[0.12em] text-text-muted">
              Generated by
            </span>{" "}
            {props.generatedByLabel}
          </span>
        ) : null}
      </div>

      <code className="break-all font-mono text-[10px] text-text-muted">
        {props.snapshotId}
      </code>

      {isVoided && props.voidReason ? (
        <div className="flex items-start gap-2 rounded-md border border-status-neutral/30 bg-status-neutral/10 p-2 text-[11px] leading-relaxed text-text-secondary">
          <Slash className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <span>
            <span className="font-mono uppercase tracking-[0.12em] text-text-muted">
              Voided{props.voidedAt ? ` ${formatTimestamp(props.voidedAt)}` : ""}{" "}
              ·
            </span>{" "}
            {props.voidReason}
          </span>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Link href={candidateHref} target="_blank" rel="noopener noreferrer">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            leadingIcon={<FileText className="h-3.5 w-3.5" />}
            trailingIcon={<ExternalLink className="h-3.5 w-3.5" />}
          >
            Open candidate
          </Button>
        </Link>
        {!isVoided ? (
          <VoidPdfCandidateButton snapshotId={props.snapshotId} />
        ) : null}
        <GenerateShareLinkButton
          snapshotId={props.snapshotId}
          ineligibilityReasons={props.shareIneligibilityReasons}
        />
      </div>

      {props.shareTokens.length > 0 ? (
        <ShareTokenSummary tokens={props.shareTokens} />
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Share-token summary — Sprint 4D-C
// ---------------------------------------------------------------------------

function ShareTokenSummary({ tokens }: { tokens: ReportShareToken[] }) {
  const activeCount = tokens.filter((t) => t.status === "active").length;
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-surface/40 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
          <Link2 className="h-3 w-3" aria-hidden />
          Share links
        </span>
        <span className="text-[11px] text-text-secondary">
          {tokens.length} total
        </span>
        {activeCount > 0 ? (
          <Badge tone="success" variant="outline">
            {activeCount} active
          </Badge>
        ) : (
          <Badge tone="neutral" variant="outline">
            None active
          </Badge>
        )}
      </div>
      <ShareTokenOperatorGuidance />
      <ul className="flex flex-col gap-1.5">
        {tokens.map((token) => (
          <li key={token.id}>
            <ShareTokenRow token={token} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Phase 1B UX Polish — operator-only inline guidance for the report
 * share-token surface. Canon-derived from `docs/29` § 13: SLATE never
 * sends email, never pushes to CRM. The mark-sent control records the
 * operator's handoff intent only; the operator must hand-deliver the
 * URL through their own approved channel. Audience label is required
 * before Mark sent. Recipient email is optional and hashed at rest.
 *
 * Operator-only surface — does NOT appear on the public `/r/[token]`
 * route. Render-time eligibility / send-eligibility evaluators are
 * unchanged.
 */
function ShareTokenOperatorGuidance() {
  return (
    <div
      role="note"
      aria-label="Send to Client operator guidance"
      className="rounded-md border border-border-subtle bg-bg-elevated/60 px-2.5 py-2 text-[11px] leading-relaxed text-text-muted"
    >
      <p>
        <span className="font-mono uppercase tracking-[0.12em] text-text-secondary">
          SLATE never sends.
        </span>{" "}
        Mark sent records the operator handoff only — copy the URL and
        deliver through your own approved channel (email client, CRM,
        in-person). Audience label required before Mark sent. Recipient
        email is optional and{" "}
        <span title="SLATE never stores the raw email address.">
          hashed at rest
        </span>
        .
      </p>
    </div>
  );
}

function ShareTokenRow({ token }: { token: ReportShareToken }) {
  const expiresAt = new Date(token.expiresAt);
  const isPastExpiry =
    !Number.isNaN(expiresAt.getTime()) &&
    expiresAt.getTime() <= Date.now();
  const displayStatus: ReportShareTokenStatus =
    token.status === "active" && isPastExpiry ? "expired" : token.status;
  // Sprint C2-B — Send-history surfaced from token.metadata jsonb
  // written by `markReportLinkSentToClientAction`. Never the raw
  // token / URL / email; just the operator-audit counters.
  const sendCount = readSendCount(token.metadata);
  const lastSentToClientAt = readLastSentAt(token.metadata);
  const lastSentChannel = readLastSentChannel(token.metadata);
  return (
    <div className="flex flex-col gap-1 rounded border border-border-subtle/60 bg-bg-elevated/40 px-2.5 py-2 text-[11px] leading-relaxed text-text-secondary">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={SHARE_TOKEN_TONE[displayStatus]} variant="outline">
          {SHARE_TOKEN_LABEL[displayStatus]}
        </Badge>
        <span className="font-mono uppercase tracking-[0.12em] text-text-muted">
          created
        </span>
        <span>{formatTimestamp(token.createdAt)}</span>
        <span aria-hidden className="text-text-disabled">
          ·
        </span>
        <span className="font-mono uppercase tracking-[0.12em] text-text-muted">
          expires
        </span>
        <span>{formatTimestamp(token.expiresAt)}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span>
          <span className="font-mono uppercase tracking-[0.12em] text-text-muted">
            Accesses
          </span>{" "}
          {token.accessCount}
        </span>
        {token.lastAccessedAt ? (
          <span>
            <span className="font-mono uppercase tracking-[0.12em] text-text-muted">
              Last access
            </span>{" "}
            {formatTimestamp(token.lastAccessedAt)}
          </span>
        ) : (
          <span className="text-text-muted">No access recorded</span>
        )}
        {token.audienceLabel ? (
          <span>
            <span className="font-mono uppercase tracking-[0.12em] text-text-muted">
              Audience
            </span>{" "}
            {token.audienceLabel}
          </span>
        ) : null}
        {token.recipientEmailHash ? (
          <span
            className="text-text-secondary"
            title="SLATE never stores the raw email address."
          >
            <span className="font-mono uppercase tracking-[0.12em] text-text-muted">
              Recipient
            </span>{" "}
            hash present
          </span>
        ) : (
          <span
            className="text-text-muted"
            title="SLATE never stores the raw email address."
          >
            <span className="font-mono uppercase tracking-[0.12em]">
              Recipient
            </span>{" "}
            no recipient hash
          </span>
        )}
      </div>
      {sendCount > 0 ? (
        <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px] text-text-secondary">
          <span>
            <span className="font-mono uppercase tracking-[0.12em] text-text-muted">
              Marked sent by operator
            </span>{" "}
            {sendCount} time{sendCount === 1 ? "" : "s"}
          </span>
          {lastSentToClientAt ? (
            <span>
              <span className="font-mono uppercase tracking-[0.12em] text-text-muted">
                Last marked
              </span>{" "}
              {formatTimestamp(lastSentToClientAt)}
            </span>
          ) : null}
          {lastSentChannel === "operator_mediated_copy_link" ? (
            <span
              className="text-text-muted"
              title="SLATE recorded the operator's intent to deliver the link. SLATE did not send email or push to CRM."
            >
              <span className="font-mono uppercase tracking-[0.12em]">
                Channel
              </span>{" "}
              Operator-mediated copy-link
            </span>
          ) : null}
        </div>
      ) : null}
      {token.status === "revoked" && token.revokeReason ? (
        <p className="text-[11px] text-text-muted">
          <span className="font-mono uppercase tracking-[0.12em]">
            Revoke reason
          </span>{" "}
          · {token.revokeReason}
        </p>
      ) : null}
      {displayStatus === "active" ? (
        <div className="flex flex-wrap items-start gap-2 pt-1">
          <SendReportLinkToClientButton
            tokenId={token.id}
            audienceLabel={token.audienceLabel}
            hasRecipientEmailHash={Boolean(token.recipientEmailHash)}
          />
          <RevokeShareLinkButton tokenId={token.id} />
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Send-history metadata readers — Sprint C2-B
//
// `report_share_tokens.metadata` is a jsonb column whose shape the
// Sprint C2-A `markReportLinkSentToClientAction` writes to. The
// readers below are intentionally defensive: a missing key OR a
// shape-mismatched value yields a safe default (0 for count, null
// for timestamp / channel) so a malformed metadata blob does not
// crash the panel.
// ---------------------------------------------------------------------------

function readSendCount(metadata: Record<string, unknown>): number {
  const v = metadata?.sendCount;
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function readLastSentAt(metadata: Record<string, unknown>): string | null {
  const v = metadata?.lastSentToClientAt;
  if (typeof v !== "string" || v.length === 0) return null;
  return Number.isFinite(new Date(v).getTime()) ? v : null;
}

function readLastSentChannel(
  metadata: Record<string, unknown>,
): string | null {
  const v = metadata?.lastSentChannel;
  return typeof v === "string" && v.length > 0 ? v : null;
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

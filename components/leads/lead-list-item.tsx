import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LeadStatusChip } from "./lead-status-chip";
import { LeadTrustChip } from "./lead-trust-chip";
import { FitScoreBadge } from "./fit-score-badge";
import type { Lead } from "@/lib/leads/types";

export interface LeadListItemProps {
  lead: Lead;
}

export function LeadListItem({ lead }: LeadListItemProps) {
  return (
    <Link
      href={`/app/leads/${lead.id}`}
      className="group block rounded-xl border border-border-subtle bg-bg-surface p-5 shadow-card transition-colors hover:border-border-strong hover:bg-bg-elevated/80 sm:p-6"
    >
      <div className="flex flex-col gap-5">
        {/* Top: company + status + fit */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex min-w-0 flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-base font-semibold tracking-tight text-text-primary">
                {lead.companyName}
              </span>
              <Badge tone="neutral">{lead.industry}</Badge>
              <Badge tone="ai">{lead.practiceArea}</Badge>
            </div>
            <p className="text-xs text-text-muted">
              <span className="text-text-secondary">{lead.contactName}</span>
              <span className="mx-1.5 text-text-disabled">·</span>
              {lead.contactTitle}
              <span className="mx-1.5 text-text-disabled">·</span>
              {lead.employeeRange}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LeadStatusChip status={lead.status} />
            <LeadTrustChip
              status={lead.trustStatus}
              reasons={lead.trustReasons}
              size="sm"
            />
            <FitScoreBadge value={lead.internalFitScore} size="sm" />
          </div>
        </div>

        {/* Middle: prospect-facing scores */}
        <div className="grid grid-cols-3 gap-2">
          <ScoreCell label="AI Readiness" value={lead.prospectScores.ai} />
          <ScoreCell
            label="Workflow Friction"
            value={lead.prospectScores.friction}
          />
          <ScoreCell label="Systems" value={lead.prospectScores.systems} />
        </div>

        {/* Bottom: recommended action + meta */}
        <div className="flex flex-col gap-3 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-xs">
            <span className="text-text-muted">Recommended: </span>
            <span className="font-medium text-text-secondary">
              {lead.recommendedAction.headline}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-text-muted">
            <span>Last activity {lead.lastActivityAt}</span>
            <span aria-hidden className="text-text-disabled">
              ·
            </span>
            <span className="inline-flex items-center gap-1 text-text-secondary transition-colors group-hover:text-text-primary">
              Review lead
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function ScoreCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-elevated/50 p-3">
      <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">
        {label}
      </div>
      <div className="font-mono text-lg font-semibold tabular-nums text-text-primary">
        {value}
      </div>
    </div>
  );
}

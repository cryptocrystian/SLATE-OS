import * as React from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { LeadStatusChip } from "./lead-status-chip";
import { LeadTrustChip } from "./lead-trust-chip";
import { FitScoreBadge } from "./fit-score-badge";
import type { Lead } from "@/lib/leads/types";

export interface LeadProfileHeaderProps {
  lead: Lead;
}

export function LeadProfileHeader({ lead }: LeadProfileHeaderProps) {
  return (
    <header className="flex flex-col gap-5 border-b border-border-subtle pb-6">
      <Link
        href="/app/leads"
        className="inline-flex items-center gap-1.5 self-start text-xs text-text-muted transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to leads
      </Link>

      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="ai">{lead.practiceArea}</Badge>
            <Badge tone="neutral">{lead.industry}</Badge>
            <Badge tone="neutral">{lead.employeeRange}</Badge>
            <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
              Source · {lead.source.replace(/-/g, " ")}
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-[32px]">
            {lead.companyName}
          </h1>
          <p className="text-sm text-text-secondary">
            <span className="font-medium text-text-primary">
              {lead.contactName}
            </span>
            <span className="mx-1.5 text-text-disabled">·</span>
            {lead.contactTitle}
            <span className="mx-1.5 text-text-disabled">·</span>
            <a
              href={`mailto:${lead.contactEmail}`}
              className="text-text-secondary underline-offset-2 hover:text-text-primary hover:underline"
            >
              {lead.contactEmail}
            </a>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LeadStatusChip status={lead.status} />
          <LeadTrustChip
            status={lead.trustStatus}
            reasons={lead.trustReasons}
            size="md"
          />
          <FitScoreBadge value={lead.internalFitScore} />
        </div>
      </div>
    </header>
  );
}

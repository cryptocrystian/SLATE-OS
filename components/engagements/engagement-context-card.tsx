import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Building2, Sparkles } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Engagement } from "@/lib/engagements/types";

export interface EngagementContextCardProps {
  engagement: Engagement;
}

export function EngagementContextCard({
  engagement,
}: EngagementContextCardProps) {
  const sc = engagement.scorecardSummary;
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-secondary">
            <Building2 className="h-4 w-4" />
          </span>
          <h3 className="text-base font-semibold tracking-tight text-text-primary">
            Linked context
          </h3>
        </div>

        <dl className="grid grid-cols-1 gap-y-2 text-xs">
          <Row label="Account" value={engagement.accountName} />
          <Row label="Industry" value={engagement.industry} />
          <Row label="Practice" value={engagement.practiceArea} />
          <Row label="Owner" value={engagement.owner} />
          <Row label="Target close" value={engagement.targetDate} />
        </dl>

        {engagement.linkedLeadId ? (
          <Link
            href={`/app/leads/${engagement.linkedLeadId}`}
            className="group inline-flex items-center justify-between gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 px-3 py-2 text-xs text-text-secondary transition-colors hover:border-border-strong hover:text-text-primary"
          >
            <span>View source lead</span>
            <ArrowUpRight className="h-3.5 w-3.5 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </Link>
        ) : null}

        {sc ? (
          <div className="flex flex-col gap-3 rounded-lg border border-border-subtle bg-bg-elevated/40 p-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5 text-practice-ai" />
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
                Source scorecard
              </span>
              <Badge tone="ai" variant="outline">
                {sc.classification}
              </Badge>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <ScoreCell label="AI" value={sc.ai} />
              <ScoreCell label="Friction" value={sc.friction} />
              <ScoreCell label="Systems" value={sc.systems} />
            </div>
          </div>
        ) : null}
      </CardBody>
    </Card>
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

function ScoreCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-surface/80 p-2 text-center">
      <div className="text-[9px] uppercase tracking-[0.12em] text-text-muted">
        {label}
      </div>
      <div className="font-mono text-sm font-semibold tabular-nums text-text-primary">
        {value}
      </div>
    </div>
  );
}

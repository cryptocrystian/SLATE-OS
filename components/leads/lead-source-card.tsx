import * as React from "react";
import { Card, CardBody } from "@/components/ui/card";
import type { Lead } from "@/lib/leads/types";

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export interface LeadSourceCardProps {
  lead: Lead;
}

export function LeadSourceCard({ lead }: LeadSourceCardProps) {
  const rows: Array<[string, string]> = [
    ["Source", lead.source.replace(/-/g, " ")],
    ["Practice", lead.practiceArea],
    ["Industry", lead.industry],
    ["Headcount", lead.employeeRange],
    ...(lead.revenueRange ? ([["Revenue", lead.revenueRange]] as [string, string][]) : []),
    ["Scorecard completed", formatDate(lead.scorecardCompletedAt)],
    ["Last activity", lead.lastActivityAt],
  ];

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-3 p-5 sm:p-6">
        <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
          Source metadata
        </span>
        <dl className="grid grid-cols-1 gap-y-2 text-xs">
          {rows.map(([label, value]) => (
            <div
              key={label}
              className="flex items-baseline justify-between gap-3 border-b border-border-subtle pb-2 last:border-b-0 last:pb-0"
            >
              <dt className="text-text-muted">{label}</dt>
              <dd className="text-right font-medium text-text-secondary">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </CardBody>
    </Card>
  );
}

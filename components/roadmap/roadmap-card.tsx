import * as React from "react";
import { Link2, ShieldAlert, Target, User2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { OpportunityPriorityChip } from "@/components/opportunities/opportunity-priority-chip";
import type { RoadmapItem } from "@/lib/roadmap/types";

export interface RoadmapCardProps {
  item: RoadmapItem;
}

export function RoadmapCard({ item }: RoadmapCardProps) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <OpportunityPriorityChip priority={item.priority} />
          {item.linkedOpportunityId ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-bg-elevated/50 px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
              <Link2 aria-hidden className="h-3 w-3" />
              Linked opportunity
            </span>
          ) : null}
        </div>
        <h3 className="text-sm font-semibold leading-snug tracking-tight text-text-primary">
          {item.title}
        </h3>
        <p className="text-xs leading-relaxed text-text-secondary">
          {item.objective}
        </p>

        {item.keyActions.length > 0 ? (
          <Block label="Key actions" items={item.keyActions} dot="bg-brand-primary/70" />
        ) : null}
        {item.dependencies.length > 0 ? (
          <Block
            label="Dependencies"
            items={item.dependencies}
            dot="bg-status-info"
          />
        ) : null}
        {item.successCriteria.length > 0 ? (
          <Block
            label="Success criteria"
            items={item.successCriteria}
            dot="bg-status-success"
          />
        ) : null}
        {item.risks.length > 0 ? (
          <Block label="Risks" items={item.risks} dot="bg-status-warning" />
        ) : null}

        {(item.ownerPlaceholder || item.readinessNote) ? (
          <div className="flex flex-col gap-1.5 border-t border-border-subtle pt-3 text-[11px] text-text-muted">
            {item.ownerPlaceholder ? (
              <span className="inline-flex items-center gap-1.5">
                <User2 aria-hidden className="h-3 w-3" />
                <span className="text-text-secondary">{item.ownerPlaceholder}</span>
              </span>
            ) : null}
            {item.readinessNote ? (
              <span className="inline-flex items-start gap-1.5 leading-relaxed">
                <Target aria-hidden className="mt-0.5 h-3 w-3 shrink-0 text-text-muted" />
                <span>{item.readinessNote}</span>
              </span>
            ) : null}
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

function Block({
  label,
  items,
  dot,
}: {
  label: string;
  items: string[];
  dot: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
        {label}
      </span>
      <ul className="flex flex-col gap-1.5 text-[11px] leading-relaxed text-text-secondary">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2">
            <span
              aria-hidden
              className={`mt-1.5 h-1 w-1 shrink-0 rounded-full ${dot}`}
            />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// Lightweight risk icon stub left in case it gets used later
export const _ShieldAlertRef = ShieldAlert;

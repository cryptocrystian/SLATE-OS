import * as React from "react";
import { Link2, ShieldAlert, Target, User2 } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { OpportunityPriorityChip } from "@/components/opportunities/opportunity-priority-chip";
import { RoadmapProvenanceChip } from "./roadmap-provenance-chip";
import { RoadmapActionBar } from "./roadmap-action-bar";
import type { RoadmapItem } from "@/lib/roadmap/types";
import type { RoadmapItemProvenanceSummary } from "@/lib/roadmap/provenance";

export interface RoadmapCardProps {
  item: RoadmapItem;
  /** Map from opportunity id → short title, used to surface the linked
   *  opportunity name on the chip. */
  opportunityTitles?: Record<string, string>;
  /**
   * Sprint S7 — Per-item provenance summary derived from the linked
   * source opportunity. When provided and non-clean, the compact
   * needs-validation chip renders on the card.
   */
  provenance?: RoadmapItemProvenanceSummary | null;
  /**
   * Sprint S7 — When `"review"`, mounts `RoadmapActionBar` inline at
   * the foot of the card so the operator can approve / defer / reject
   * the roadmap item without leaving the phase column.
   *
   * Boolean-shaped instead of a render-prop function so it can cross
   * the Server-Component → Client-Component serialization boundary
   * (per docs/47).
   */
  actionMode?: "review";
}

export function RoadmapCard({
  item,
  opportunityTitles,
  provenance,
  actionMode,
}: RoadmapCardProps) {
  const linkedTitle =
    item.linkedOpportunityId && opportunityTitles
      ? opportunityTitles[item.linkedOpportunityId]
      : undefined;

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-3 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-1.5">
          <OpportunityPriorityChip priority={item.priority} />
          {item.linkedOpportunityId ? (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-bg-elevated/50 px-2 py-0.5 text-[11px] font-medium text-text-secondary"
              title={linkedTitle ?? "Linked opportunity"}
              aria-label={`Linked opportunity: ${linkedTitle ?? "linked opportunity"}`}
            >
              <Link2 aria-hidden className="h-3 w-3 text-text-muted" />
              <span aria-hidden className="font-mono uppercase tracking-[0.12em] text-text-muted">
                →
              </span>
              <span
                aria-hidden
                className="block max-w-[18ch] overflow-hidden text-ellipsis whitespace-nowrap sm:max-w-[28ch]"
              >
                {linkedTitle ?? "Linked opportunity"}
              </span>
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

        {/* Sprint S7 — Needs-validation chip on the card (compact mode). */}
        {provenance ? (
          <RoadmapProvenanceChip summary={provenance} compact />
        ) : null}

        {/* Sprint S7 — Operator approval lifecycle bar. */}
        {actionMode === "review" && item.status ? (
          <div className="border-t border-border-subtle pt-3">
            <RoadmapActionBar
              roadmapItemId={item.id}
              status={item.status}
              provenance={provenance ?? null}
              reviewerNote={item.reviewerNote ?? null}
            />
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

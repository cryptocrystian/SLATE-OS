import * as React from "react";
import { Calendar } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { RoadmapCard } from "./roadmap-card";
import { PHASE_DESCRIPTION, PHASE_LABEL } from "@/lib/roadmap/helpers";
import type { RoadmapItem, RoadmapPhase } from "@/lib/roadmap/types";
import type { RoadmapItemProvenanceSummary } from "@/lib/roadmap/provenance";

export interface RoadmapPhaseColumnProps {
  phase: RoadmapPhase;
  items: RoadmapItem[];
  opportunityTitles?: Record<string, string>;
  /**
   * Sprint S7 — Map of roadmap-item-id → provenance summary, threaded
   * through from the page. Items without an entry render no provenance
   * chip.
   */
  provenanceById?: ReadonlyMap<string, RoadmapItemProvenanceSummary>;
  /** Sprint S7 — Boolean-shaped action-bar mode (see RoadmapCard). */
  actionMode?: "review";
}

export function RoadmapPhaseColumn({
  phase,
  items,
  opportunityTitles,
  provenanceById,
  actionMode,
}: RoadmapPhaseColumnProps) {
  return (
    <section
      aria-label={`${PHASE_LABEL[phase]}, ${items.length} item${items.length === 1 ? "" : "s"}`}
      className="flex flex-col gap-3"
    >
      <Card variant="base">
        <CardBody className="flex flex-col gap-2 p-4 sm:p-5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-brand-primary">
                <Calendar className="h-3.5 w-3.5" />
              </span>
              <h2 className="text-sm font-semibold tracking-tight text-text-primary">
                {PHASE_LABEL[phase]}
              </h2>
            </div>
            <Badge tone="brand" variant="outline">
              {items.length} item{items.length === 1 ? "" : "s"}
            </Badge>
          </div>
          <p className="text-[11px] leading-relaxed text-text-muted">
            {PHASE_DESCRIPTION[phase]}
          </p>
        </CardBody>
      </Card>

      {items.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border-subtle bg-bg-surface/40 p-4 text-xs text-text-muted">
          Nothing yet. Sequence opportunities into this phase as the engagement
          locks scope.
        </div>
      ) : (
        <ul className="flex flex-col gap-3">
          {items.map((item) => (
            <li key={item.id}>
              <RoadmapCard
                item={item}
                opportunityTitles={opportunityTitles}
                provenance={provenanceById?.get(item.id) ?? null}
                actionMode={actionMode}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

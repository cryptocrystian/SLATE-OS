"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { OpportunityPriorityChip } from "./opportunity-priority-chip";
import {
  QUADRANT_DESCRIPTION,
  QUADRANT_LABEL,
  QUADRANT_TONE,
} from "@/lib/opportunities/helpers";
import type {
  Opportunity,
  OpportunityQuadrant,
} from "@/lib/opportunities/types";

const TONE_MAP: Record<string, BadgeTone> = {
  success: "success",
  brand: "brand",
  neutral: "neutral",
  risk: "risk",
};

const ORDERED_QUADRANTS: OpportunityQuadrant[] = [
  "quick-win",
  "strategic-build",
  "low-priority",
  "defer-avoid",
];

export interface OpportunityMatrixProps {
  opportunities: Opportunity[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}

export function OpportunityMatrix({
  opportunities,
  selectedId,
  onSelect,
}: OpportunityMatrixProps) {
  const groups = React.useMemo(() => {
    const g: Record<OpportunityQuadrant, Opportunity[]> = {
      "quick-win": [],
      "strategic-build": [],
      "low-priority": [],
      "defer-avoid": [],
    };
    for (const o of opportunities) g[o.quadrant].push(o);
    return g;
  }, [opportunities]);

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Impact × complexity matrix
          </span>
          <h2 className="text-base font-semibold tracking-tight text-text-primary">
            Quick Wins, Strategic Builds, Low Priority, Defer
          </h2>
        </div>

        {/* Axis legend */}
        <div
          id="opportunity-matrix-axis-x"
          className="flex items-center justify-between text-[11px] text-text-muted"
        >
          <span className="uppercase tracking-[0.12em]">
            ← Lower complexity
          </span>
          <span className="uppercase tracking-[0.12em]">
            Higher complexity →
          </span>
        </div>

        <div
          className="grid gap-3 sm:grid-cols-2"
          role="group"
          aria-label="Opportunity matrix: impact (rows) by complexity (columns)"
          aria-describedby="opportunity-matrix-axis-x opportunity-matrix-axis-y"
        >
          {ORDERED_QUADRANTS.map((q) => {
            const tone = TONE_MAP[QUADRANT_TONE[q]] ?? "neutral";
            const items = groups[q];
            return (
              <section
                key={q}
                aria-label={`${QUADRANT_LABEL[q]} quadrant, ${items.length} opportunit${items.length === 1 ? "y" : "ies"}`}
                className={cn(
                  "flex flex-col gap-3 rounded-lg border bg-bg-elevated/40 p-3",
                  q === "quick-win" && "border-status-success/30",
                  q === "strategic-build" && "border-brand-primary/30",
                  q === "low-priority" && "border-border-subtle",
                  q === "defer-avoid" && "border-status-risk/30",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col gap-1">
                    <Badge tone={tone} dot>
                      {QUADRANT_LABEL[q]}
                    </Badge>
                    <p className="text-[11px] leading-relaxed text-text-muted">
                      {QUADRANT_DESCRIPTION[q]}
                    </p>
                  </div>
                  <span className="font-mono text-xs tabular-nums text-text-muted">
                    {items.length}
                  </span>
                </div>

                {items.length === 0 ? (
                  <p className="rounded-md border border-dashed border-border-subtle bg-bg-surface/40 p-2.5 text-[11px] text-text-muted">
                    Nothing here.
                  </p>
                ) : (
                  <ul className="flex flex-col gap-2">
                    {items.map((o) => {
                      const isSelected = o.id === selectedId;
                      return (
                        <li key={o.id}>
                          <button
                            type="button"
                            onClick={() => onSelect?.(o.id)}
                            aria-pressed={isSelected}
                            className={cn(
                              "flex w-full flex-col gap-2 rounded-md border p-3 text-left transition-colors",
                              isSelected
                                ? "border-brand-primary/60 bg-brand-primary/[0.06]"
                                : "border-border-subtle bg-bg-surface hover:border-border-strong hover:bg-bg-elevated/60",
                            )}
                          >
                            <div className="flex items-center gap-2">
                              <OpportunityPriorityChip priority={o.priority} />
                            </div>
                            <p className="text-sm font-medium leading-snug text-text-primary">
                              {o.title}
                            </p>
                            <div className="flex items-center justify-between text-[11px] text-text-muted">
                              <span className="font-mono tabular-nums">
                                Impact {o.businessImpactScore} · Complexity{" "}
                                {o.complexityScore}
                              </span>
                              <span className="font-mono tabular-nums">
                                {o.relatedFindingIds.length} finding
                                {o.relatedFindingIds.length === 1 ? "" : "s"}
                              </span>
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>

        <div
          id="opportunity-matrix-axis-y"
          className="flex items-center justify-between text-[11px] text-text-muted"
        >
          <span className="uppercase tracking-[0.12em]">
            ↓ Lower impact
          </span>
          <span className="uppercase tracking-[0.12em]">
            Higher impact ↑
          </span>
        </div>
      </CardBody>
    </Card>
  );
}

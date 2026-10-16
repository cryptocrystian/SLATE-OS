import * as React from "react";
import { Layers } from "lucide-react";
import type { StackInventoryRow } from "@/lib/scorecard/stack";

export interface StackInventoryPanelProps {
  rows: StackInventoryRow[];
}

/** Systems the prospect reported in the Scorecard stack questions.
 *  Inventory only: these answers carry no scoring weight. */
export function StackInventoryPanel({ rows }: StackInventoryPanelProps) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-secondary">
          <Layers className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold tracking-tight text-text-primary">
          Systems in use
        </h3>
      </div>
      <dl className="flex flex-col gap-3">
        {rows.map((row) => (
          <div key={row.questionId} className="flex flex-col gap-1">
            <dt className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              {row.category}
            </dt>
            <dd className="text-xs leading-relaxed text-text-secondary">
              {row.systems.join(" · ")}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

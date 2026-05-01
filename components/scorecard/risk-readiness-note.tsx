import * as React from "react";
import { ShieldAlert } from "lucide-react";

export interface RiskReadinessNoteProps {
  notes: string[];
}

export function RiskReadinessNote({ notes }: RiskReadinessNoteProps) {
  return (
    <section className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-bg-surface p-5 shadow-card sm:p-6">
      <div className="flex items-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-status-warning">
          <ShieldAlert className="h-3.5 w-3.5" />
        </span>
        <h3 className="text-sm font-semibold tracking-tight text-text-primary">
          Risk and readiness notes
        </h3>
      </div>
      <ul className="flex flex-col gap-2.5">
        {notes.map((note, i) => (
          <li
            key={i}
            className="flex items-start gap-2.5 text-xs leading-relaxed text-text-secondary"
          >
            <span
              aria-hidden
              className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-warning"
            />
            {note}
          </li>
        ))}
      </ul>
    </section>
  );
}

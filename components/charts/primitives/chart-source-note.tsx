import * as React from "react";
import type { SourceNote } from "@/lib/charts/types";

export interface ChartSourceNoteProps {
  note: SourceNote;
}

/**
 * Small uppercase mono caption shown beneath an exhibit. Sourcing is
 * non-optional in consulting-grade exhibits — every chart that ships in
 * SLATE wears its source.
 */
export function ChartSourceNote({ note }: ChartSourceNoteProps) {
  const text =
    typeof note.n === "number"
      ? `${note.text} · n=${note.n}`
      : note.text;
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
      {text}
    </p>
  );
}

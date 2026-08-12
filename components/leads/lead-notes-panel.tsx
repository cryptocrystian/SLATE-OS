import * as React from "react";
import { StickyNote } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";

export interface LeadNotesPanelProps {
  notes: string[];
}

export function LeadNotesPanel({ notes }: LeadNotesPanelProps) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Internal notes
          </span>
          <span className="text-[11px] text-text-muted">
            {notes.length} note{notes.length === 1 ? "" : "s"}
          </span>
        </div>
        {notes.length === 0 ? (
          <EmptyState
            icon={<StickyNote className="h-4 w-4" />}
            title="No notes yet"
            description="Notes added by Saipien Labs operators will appear here. Persistence arrives with the backend."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {notes.map((note, i) => (
              <li
                key={i}
                className="rounded-md border border-border-subtle bg-bg-elevated/40 p-3 text-xs leading-relaxed text-text-secondary"
              >
                {note}
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

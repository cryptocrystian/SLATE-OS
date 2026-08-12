"use client";

import * as React from "react";
import { Pencil, Pin, Plus, StickyNote, Trash2, X } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  createNote,
  deleteNote,
  toggleNotePinned,
  updateNote,
  type NoteActionResult,
} from "@/lib/notes/actions";
import type { Note, NoteEntityType } from "@/lib/notes/types";

export interface NotesPanelProps {
  entityType: NoteEntityType;
  entityId: string;
  notes: Note[];
  emptyTitle: string;
  emptyDescription: string;
  composerLabel?: string;
  composerPlaceholder?: string;
}

export function NotesPanel({
  entityType,
  entityId,
  notes,
  emptyTitle,
  emptyDescription,
  composerLabel = "Add an internal note",
  composerPlaceholder = "Capture an internal-only note. Visible to operators only.",
}: NotesPanelProps) {
  const [pending, startTransition] = React.useTransition();
  const [draft, setDraft] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const body = draft.trim();
    if (!body) {
      setError("Note can't be empty.");
      return;
    }
    startTransition(async () => {
      const result = await createNote({ entityType, entityId, body });
      if (!result.ok) {
        setError(translateError(result.error));
      } else {
        setDraft("");
      }
    });
  }

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Internal notes
          </span>
          <span className="text-[11px] text-text-muted">
            {notes.length} note{notes.length === 1 ? "" : "s"}
          </span>
        </div>

        <form
          onSubmit={handleCreate}
          className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-3"
        >
          <label
            htmlFor={`notes-${entityId}-body`}
            className="text-[11px] uppercase tracking-[0.14em] text-text-muted"
          >
            {composerLabel}
          </label>
          <textarea
            id={`notes-${entityId}-body`}
            name="body"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={composerPlaceholder}
            rows={3}
            maxLength={4000}
            className="w-full resize-y rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-xs leading-relaxed text-text-primary placeholder:text-text-muted focus:border-brand-primary/60 focus:outline-none"
          />
          <div className="flex items-center justify-between gap-3">
            <Badge tone="neutral" variant="outline">
              Internal-only
            </Badge>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              leadingIcon={<Plus className="h-3.5 w-3.5" />}
              disabled={pending || draft.trim().length === 0}
            >
              {pending ? "Saving…" : "Save note"}
            </Button>
          </div>
          {error ? (
            <p className="rounded-md border border-status-critical/40 bg-status-critical/10 p-2 text-[11px] text-status-critical">
              {error}
            </p>
          ) : null}
        </form>

        {notes.length === 0 ? (
          <EmptyNotesState
            title={emptyTitle}
            description={emptyDescription}
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {notes.map((note) => (
              <li key={note.id}>
                <NoteRow note={note} />
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

function EmptyNotesState({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-md border border-dashed border-border-subtle bg-bg-surface/40 p-4">
      <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-muted">
        <StickyNote className="h-3.5 w-3.5" />
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-text-primary">{title}</span>
        <p className="text-[11px] leading-relaxed text-text-muted">
          {description}
        </p>
      </div>
    </div>
  );
}

function NoteRow({ note }: { note: Note }) {
  const [pending, startTransition] = React.useTransition();
  const [editing, setEditing] = React.useState(false);
  const [draft, setDraft] = React.useState(note.body);
  const [error, setError] = React.useState<string | null>(null);

  function run(runner: () => Promise<NoteActionResult>) {
    setError(null);
    startTransition(async () => {
      const result = await runner();
      if (!result.ok) setError(translateError(result.error));
      else if (editing) setEditing(false);
    });
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[11px] text-text-muted">
          <span className="font-medium text-text-secondary">
            {note.authorDisplayName ?? "Operator"}
          </span>
          <span aria-hidden>·</span>
          <span>{formatTimestamp(note.createdAt)}</span>
          {note.pinned ? (
            <Badge tone="brand" variant="outline">
              Pinned
            </Badge>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leadingIcon={<Pin className="h-3.5 w-3.5" />}
            disabled={pending}
            onClick={() => run(() => toggleNotePinned(note.id))}
            aria-label={note.pinned ? "Unpin note" : "Pin note"}
          >
            {note.pinned ? "Unpin" : "Pin"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leadingIcon={
              editing ? <X className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />
            }
            disabled={pending}
            onClick={() => {
              setEditing((p) => !p);
              setDraft(note.body);
              setError(null);
            }}
            aria-label={editing ? "Cancel edit" : "Edit note"}
          >
            {editing ? "Cancel" : "Edit"}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            leadingIcon={<Trash2 className="h-3.5 w-3.5" />}
            className="text-status-risk hover:text-status-risk"
            disabled={pending}
            onClick={() => run(() => deleteNote(note.id))}
            aria-label="Delete note"
          >
            Delete
          </Button>
        </div>
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={3}
            maxLength={4000}
            className="w-full resize-y rounded-md border border-border-subtle bg-bg-surface px-3 py-2 text-xs leading-relaxed text-text-primary focus:border-brand-primary/60 focus:outline-none"
          />
          <div className="flex justify-end">
            <Button
              type="button"
              variant="primary"
              size="sm"
              disabled={pending || draft.trim().length === 0}
              onClick={() =>
                run(() => updateNote({ noteId: note.id, body: draft }))
              }
            >
              {pending ? "Saving…" : "Save changes"}
            </Button>
          </div>
        </div>
      ) : (
        <p className="whitespace-pre-line text-xs leading-relaxed text-text-secondary">
          {note.body}
        </p>
      )}

      {error ? (
        <p className="rounded-md border border-status-critical/40 bg-status-critical/10 p-2 text-[11px] text-status-critical">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function translateError(
  code: Exclude<NoteActionResult, { ok: true }>["error"],
): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "missing-body":
      return "Note can't be empty.";
    case "entity-not-found":
      return "We couldn't find this entity. Please refresh.";
    case "note-not-found":
      return "Note not found. Please refresh.";
    case "invalid-entity":
      return "Invalid entity reference.";
    case "invalid-note":
      return "Invalid note reference.";
    case "service-error":
    default:
      return "We couldn't save the note. Please try again.";
  }
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return "";
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

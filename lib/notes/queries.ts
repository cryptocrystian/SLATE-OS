import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Note, NoteEntityType, NoteVisibility } from "./types";

const NOTE_SELECT = `
  id,
  entity_type,
  entity_id,
  body,
  visibility,
  pinned,
  created_at,
  updated_at,
  author_profile_id
` as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

interface RawNoteRow {
  id: string;
  entity_type: string;
  entity_id: string;
  body: string;
  visibility: string;
  pinned: boolean | null;
  created_at: string;
  updated_at: string;
  author_profile_id: string | null;
}

export async function getNotesForEntity(
  entityType: NoteEntityType,
  entityId: string,
): Promise<Note[]> {
  if (!isUuid(entityId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_SELECT)
    .eq("entity_type", entityType)
    .eq("entity_id", entityId)
    .is("deleted_at", null)
    .order("pinned", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[notes.queries] list-failed", {
      entityType,
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows = (data as unknown as RawNoteRow[]) ?? [];
  if (rows.length === 0) return [];

  const profileIds = Array.from(
    new Set(
      rows
        .map((r) => r.author_profile_id)
        .filter((id): id is string => Boolean(id)),
    ),
  );
  const profileLookup: Record<string, { display_name: string | null }> = {};
  if (profileIds.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name")
      .in("id", profileIds);
    for (const p of (profiles as Array<{
      id: string;
      display_name: string | null;
    }> | null) ?? []) {
      profileLookup[p.id] = { display_name: p.display_name };
    }
  }

  return rows.map<Note>((row) => ({
    id: row.id,
    entityType: row.entity_type as NoteEntityType,
    entityId: row.entity_id,
    body: row.body,
    visibility: (row.visibility as NoteVisibility) ?? "internal",
    pinned: Boolean(row.pinned),
    authorDisplayName: row.author_profile_id
      ? (profileLookup[row.author_profile_id]?.display_name ?? null)
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

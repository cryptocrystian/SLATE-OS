"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActivityEvent } from "@/lib/activity/log";
import type { ActivityEntityType } from "@/lib/activity/types";
import type { NoteEntityType } from "./types";

/**
 * Authenticated-operator server actions for internal notes.
 *
 * Notes are operator-only. RLS is the boundary; every action also
 * `auth.getUser()`-gates so an unauthenticated request fails fast
 * rather than relying on RLS alone.
 */

export type NoteActionResult =
  | { ok: true; noteId?: string }
  | {
      ok: false;
      error:
        | "unauthenticated"
        | "invalid-entity"
        | "invalid-note"
        | "missing-body"
        | "entity-not-found"
        | "note-not-found"
        | "service-error";
    };

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

const NOTE_ENTITY_TYPES: NoteEntityType[] = [
  "lead",
  "engagement",
  "finding",
  "opportunity",
  "report",
  "report_section",
  "proposal",
];

interface EntityContext {
  workspaceId: string;
  leadId: string | null;
  engagementId: string | null;
}

async function resolveEntityContext(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  entityType: NoteEntityType,
  entityId: string,
): Promise<EntityContext | null> {
  if (entityType === "lead") {
    const { data } = await supabase
      .from("leads")
      .select("id, workspace_id")
      .eq("id", entityId)
      .maybeSingle<{ id: string; workspace_id: string }>();
    if (!data?.id) return null;
    return {
      workspaceId: data.workspace_id,
      leadId: data.id,
      engagementId: null,
    };
  }
  if (entityType === "engagement") {
    const { data } = await supabase
      .from("engagements")
      .select("id, workspace_id, linked_lead_id")
      .eq("id", entityId)
      .maybeSingle<{
        id: string;
        workspace_id: string;
        linked_lead_id: string | null;
      }>();
    if (!data?.id) return null;
    return {
      workspaceId: data.workspace_id,
      leadId: data.linked_lead_id,
      engagementId: data.id,
    };
  }
  // Other entity types resolve to their parent engagement.
  const tableByEntity: Partial<Record<NoteEntityType, string>> = {
    finding: "findings",
    opportunity: "opportunities",
    report: "reports",
    report_section: "report_sections",
    proposal: "proposals",
  };
  const table = tableByEntity[entityType];
  if (!table) return null;
  const { data } = await supabase
    .from(table)
    .select("id, workspace_id, engagement_id")
    .eq("id", entityId)
    .maybeSingle<{
      id: string;
      workspace_id: string;
      engagement_id: string;
    }>();
  if (!data?.id) return null;
  return {
    workspaceId: data.workspace_id,
    leadId: null,
    engagementId: data.engagement_id,
  };
}

export interface CreateNoteInput {
  entityType: NoteEntityType;
  entityId: string;
  body: string;
}

export async function createNote(
  input: CreateNoteInput,
): Promise<NoteActionResult> {
  if (!NOTE_ENTITY_TYPES.includes(input.entityType)) {
    return { ok: false, error: "invalid-entity" };
  }
  if (!isUuid(input.entityId)) {
    return { ok: false, error: "invalid-entity" };
  }
  const body = input.body.trim();
  if (!body) return { ok: false, error: "missing-body" };
  if (body.length > 4000) {
    return { ok: false, error: "missing-body" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const ctx = await resolveEntityContext(
    supabase,
    input.entityType,
    input.entityId,
  );
  if (!ctx) return { ok: false, error: "entity-not-found" };

  const { data: inserted, error: insertError } = await supabase
    .from("notes")
    .insert({
      workspace_id: ctx.workspaceId,
      author_profile_id: user.id,
      author_user_id: user.id,
      entity_type: input.entityType,
      entity_id: input.entityId,
      lead_id: ctx.leadId,
      engagement_id: ctx.engagementId,
      body,
      visibility: "internal",
      pinned: false,
    })
    .select("id")
    .single<{ id: string }>();
  if (insertError || !inserted?.id) {
    console.error("[notes.actions] insert-failed", {
      entityType: input.entityType,
      name: insertError?.name,
      code: insertError?.code,
      message: insertError?.message,
    });
    return { ok: false, error: "service-error" };
  }

  await logActivityEvent({
    eventType: "note_created",
    entityType: "note",
    entityId: inserted.id,
    engagementId: ctx.engagementId,
    leadId: ctx.leadId,
    title: "Note added",
    summary: noteContextSummary(input.entityType),
    metadata: {
      subjectEntityType: input.entityType,
    },
  });

  revalidateForContext(ctx);
  return { ok: true, noteId: inserted.id };
}

export interface UpdateNoteInput {
  noteId: string;
  body: string;
}

export async function updateNote(
  input: UpdateNoteInput,
): Promise<NoteActionResult> {
  if (!isUuid(input.noteId)) {
    return { ok: false, error: "invalid-note" };
  }
  const body = input.body.trim();
  if (!body) return { ok: false, error: "missing-body" };
  if (body.length > 4000) return { ok: false, error: "missing-body" };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("notes")
    .select("id, entity_type, entity_id, lead_id, engagement_id")
    .eq("id", input.noteId)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      entity_type: string;
      entity_id: string;
      lead_id: string | null;
      engagement_id: string | null;
    }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "note-not-found" };
  }

  const { error: updateError } = await supabase
    .from("notes")
    .update({ body })
    .eq("id", input.noteId);
  if (updateError) {
    console.error("[notes.actions] update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await logActivityEvent({
    eventType: "note_updated",
    entityType: "note",
    entityId: existing.id,
    engagementId: existing.engagement_id,
    leadId: existing.lead_id,
    title: "Note updated",
    summary: noteContextSummary(existing.entity_type as NoteEntityType),
    metadata: {
      subjectEntityType: existing.entity_type,
    },
  });

  revalidateForContext({
    workspaceId: "",
    leadId: existing.lead_id,
    engagementId: existing.engagement_id,
  });
  return { ok: true, noteId: existing.id };
}

export async function deleteNote(noteId: string): Promise<NoteActionResult> {
  if (!isUuid(noteId)) {
    return { ok: false, error: "invalid-note" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("notes")
    .select("id, entity_type, entity_id, lead_id, engagement_id")
    .eq("id", noteId)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      entity_type: string;
      entity_id: string;
      lead_id: string | null;
      engagement_id: string | null;
    }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "note-not-found" };
  }

  const { error: updateError } = await supabase
    .from("notes")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", noteId);
  if (updateError) {
    console.error("[notes.actions] soft-delete-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await logActivityEvent({
    eventType: "note_deleted",
    entityType: "note",
    entityId: existing.id,
    engagementId: existing.engagement_id,
    leadId: existing.lead_id,
    title: "Note removed",
    summary: noteContextSummary(existing.entity_type as NoteEntityType),
    metadata: {
      subjectEntityType: existing.entity_type,
    },
  });

  revalidateForContext({
    workspaceId: "",
    leadId: existing.lead_id,
    engagementId: existing.engagement_id,
  });
  return { ok: true };
}

export async function toggleNotePinned(
  noteId: string,
): Promise<NoteActionResult> {
  if (!isUuid(noteId)) {
    return { ok: false, error: "invalid-note" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("notes")
    .select("id, pinned, lead_id, engagement_id")
    .eq("id", noteId)
    .is("deleted_at", null)
    .maybeSingle<{
      id: string;
      pinned: boolean | null;
      lead_id: string | null;
      engagement_id: string | null;
    }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "note-not-found" };
  }

  const next = !existing.pinned;
  const { error: updateError } = await supabase
    .from("notes")
    .update({ pinned: next })
    .eq("id", noteId);
  if (updateError) {
    console.error("[notes.actions] pin-toggle-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  revalidateForContext({
    workspaceId: "",
    leadId: existing.lead_id,
    engagementId: existing.engagement_id,
  });
  return { ok: true, noteId };
}

function revalidateForContext(ctx: EntityContext): void {
  if (ctx.engagementId) {
    revalidatePath(`/app/engagements/${ctx.engagementId}`);
  }
  if (ctx.leadId) {
    revalidatePath(`/app/leads/${ctx.leadId}`);
  }
}

function noteContextSummary(entityType: NoteEntityType): string {
  switch (entityType) {
    case "lead":
      return "An operator added or changed an internal note on the lead.";
    case "engagement":
      return "An operator added or changed an internal note on the engagement.";
    case "finding":
      return "An operator added or changed a note on a finding.";
    case "opportunity":
      return "An operator added or changed a note on an opportunity.";
    case "report":
      return "An operator added or changed a note on the report.";
    case "report_section":
      return "An operator added or changed a note on a report section.";
    case "proposal":
      return "An operator added or changed a note on the proposal.";
    default:
      return "An operator changed an internal note.";
  }
}

// Re-export for convenience.
export type { ActivityEntityType };

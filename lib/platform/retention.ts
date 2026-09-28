import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { SlateModule } from "./modules";

/**
 * Retention holds (migration 0024; docs/72 §3.4). SLATE PLATFORM.
 *
 * A hold says "module M depends on this row; do not delete it". The
 * database refuses deletes of held engagements / accounts / contacts /
 * leads. The platform never interprets `holderRef` — the holding module
 * does (e.g. GovernanceOS passes a program id).
 *
 * Runs under the caller's session: RLS requires workspace membership to
 * place or release a hold. Holds are never deleted; release is permanent
 * and recorded.
 */

export type HoldableEntity = "engagement" | "account" | "contact" | "lead";

export interface PlaceHoldInput {
  workspaceId: string;
  entityType: HoldableEntity;
  entityId: string;
  module: SlateModule;
  holderRef: string;
  reason: string;
  actorProfileId: string;
}

export type HoldResult = { ok: true; holdId: string } | { ok: false; error: "hold-failed" };

/** Idempotent: an existing active hold for the same (entity, module, holderRef) is returned. */
export async function placeRetentionHold(input: PlaceHoldInput): Promise<HoldResult> {
  const supabase = createSupabaseServerClient();

  const existing = await supabase
    .from("retention_holds")
    .select("id")
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .eq("held_by_module", input.module)
    .eq("holder_ref", input.holderRef)
    .is("released_at", null)
    .maybeSingle<{ id: string }>();
  if (existing.data) return { ok: true, holdId: existing.data.id };

  const { data, error } = await supabase
    .from("retention_holds")
    .insert({
      workspace_id: input.workspaceId,
      entity_type: input.entityType,
      entity_id: input.entityId,
      held_by_module: input.module,
      holder_ref: input.holderRef,
      reason: input.reason,
      created_by: input.actorProfileId,
    })
    .select("id")
    .single<{ id: string }>();
  if (error || !data) return { ok: false, error: "hold-failed" };
  return { ok: true, holdId: data.id };
}

export async function releaseRetentionHold(input: {
  entityType: HoldableEntity;
  entityId: string;
  module: SlateModule;
  holderRef: string;
  reason: string;
  actorProfileId: string;
}): Promise<{ ok: true; released: number } | { ok: false; error: "release-failed" }> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("retention_holds")
    .update({
      released_at: new Date().toISOString(),
      released_by: input.actorProfileId,
      release_reason: input.reason,
    })
    .eq("entity_type", input.entityType)
    .eq("entity_id", input.entityId)
    .eq("held_by_module", input.module)
    .eq("holder_ref", input.holderRef)
    .is("released_at", null)
    .select("id");
  if (error) return { ok: false, error: "release-failed" };
  return { ok: true, released: data?.length ?? 0 };
}

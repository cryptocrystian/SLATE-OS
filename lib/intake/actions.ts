"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { getSiteUrl } from "@/lib/env";
import { buildIntakeUrl, generateIntakeToken } from "./tokens";
import {
  dbRoleFor,
  isUuid,
} from "./mappers";
import type { StakeholderRole } from "./types";

const VALID_ROLES: StakeholderRole[] = [
  "executive",
  "operations",
  "sales",
  "marketing",
  "finance",
  "it",
  "frontline",
  "customer-success",
  "other",
];

const TOKEN_TTL_DAYS = 21;

export interface CreateSessionInput {
  engagementId: string;
  name: string;
  email: string;
  title: string;
  role: StakeholderRole;
  department?: string;
}

export type CreateSessionResult =
  | {
      ok: true;
      sessionId: string;
      intakeUrl: string;
    }
  | {
      ok: false;
      error:
        | "unauthenticated"
        | "invalid-engagement"
        | "missing-fields"
        | "invalid-role"
        | "engagement-not-found"
        | "service-error";
    };

/**
 * Operator-side server action that creates a stakeholder intake session
 * for a real engagement. Generates a fresh opaque token, stores only its
 * sha256 hash, and returns the public `/intake/<token>` URL exactly
 * once. Callers should display the URL and never persist the raw token.
 */
export async function createStakeholderSession(
  input: CreateSessionInput,
): Promise<CreateSessionResult> {
  if (!isUuid(input.engagementId)) {
    return { ok: false, error: "invalid-engagement" };
  }
  if (!VALID_ROLES.includes(input.role)) {
    return { ok: false, error: "invalid-role" };
  }
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();
  const title = input.title.trim();
  if (!name || !email || !title) {
    return { ok: false, error: "missing-fields" };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "missing-fields" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "unauthenticated" };
  }

  const { data: engagement, error: engagementError } = await supabase
    .from("engagements")
    .select("id, workspace_id")
    .eq("id", input.engagementId)
    .maybeSingle<{ id: string; workspace_id: string }>();
  if (engagementError) {
    console.error("[intake.actions] engagement-lookup-failed", {
      name: engagementError.name,
      code: engagementError.code,
      message: engagementError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!engagement?.id) {
    return { ok: false, error: "engagement-not-found" };
  }

  const { token, tokenHash } = generateIntakeToken();
  const expiresAt = new Date();
  expiresAt.setUTCDate(expiresAt.getUTCDate() + TOKEN_TTL_DAYS);

  const { data: inserted, error: insertError } = await supabase
    .from("stakeholder_intake_sessions")
    .insert({
      workspace_id: engagement.workspace_id,
      engagement_id: engagement.id,
      stakeholder_name: name,
      stakeholder_email: email,
      stakeholder_title: title,
      role: dbRoleFor(input.role),
      department: input.department?.trim() || null,
      status: "invited",
      response_quality: "missing",
      token_hash: tokenHash,
      token_expires_at: expiresAt.toISOString(),
      sent_at: new Date().toISOString(),
      last_activity_at: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();

  if (insertError || !inserted?.id) {
    console.error("[intake.actions] session-insert-failed", {
      name: insertError?.name,
      code: insertError?.code,
      message: insertError?.message,
    });
    return { ok: false, error: "service-error" };
  }

  // Best-effort: bump the engagement's last_activity_at. RLS will
  // enforce workspace scoping; we ignore the error to keep the action
  // resilient.
  await supabase
    .from("engagements")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", engagement.id);

  const intakeUrl = buildIntakeUrl(getSiteUrl(), token);

  revalidatePath(`/app/engagements/${engagement.id}/intake`);
  revalidatePath(`/app/engagements/${engagement.id}`);

  return { ok: true, sessionId: inserted.id, intakeUrl };
}

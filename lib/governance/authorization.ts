import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireWorkspaceMember, type WorkspaceActor } from "@/lib/auth/authorization";
import { can, type GovernanceAction } from "./permissions";
import type { ProgramRole } from "./types";

/**
 * GovernanceOS server-side authorization (docs/76 §8). GOVERNANCEOS MODULE.
 *
 * Two layers, both always applied:
 *   1. The DB (RLS + `governance_program_role()`) — the actual control.
 *   2. This module — fails fast with a typed error and enforces the finer
 *      action matrix in `permissions.ts` that RLS does not express
 *      (e.g. contributors may register assets but not activate policies).
 *
 * UI hiding is never a control.
 */

export type GovernanceAuthError = "unauthenticated" | "not-a-member" | "forbidden";

export interface ProgramActor extends WorkspaceActor {
  programId: string;
  programRole: ProgramRole;
}

export async function getProgramRole(programId: string): Promise<ProgramRole | null> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.rpc("governance_program_role", { program: programId });
  if (error) return null;
  return (data as ProgramRole | null) ?? null;
}

export async function requireProgramAction(
  programId: string,
  action: GovernanceAction,
): Promise<{ ok: true; actor: ProgramActor } | { ok: false; error: GovernanceAuthError }> {
  const member = await requireWorkspaceMember();
  if (!member.ok) {
    return { ok: false, error: member.error === "unauthenticated" ? "unauthenticated" : "not-a-member" };
  }
  const role = await getProgramRole(programId);
  if (!role || !can(role, action)) return { ok: false, error: "forbidden" };
  return { ok: true, actor: { ...member.actor, programId, programRole: role } };
}

/** Creating a program is a workspace-level act (owner/operator). */
export async function requireProgramCreator(): Promise<
  { ok: true; actor: WorkspaceActor } | { ok: false; error: GovernanceAuthError }
> {
  const member = await requireWorkspaceMember({ roles: ["owner", "operator"] });
  if (member.ok) return member;
  if (member.error === "unauthenticated") return { ok: false, error: "unauthenticated" };
  if (member.error === "forbidden-role") return { ok: false, error: "forbidden" };
  return { ok: false, error: "not-a-member" };
}

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Workspace authorization primitive (docs/72 §3.2). SLATE PLATFORM.
 *
 * Resolves the caller's ACTIVE workspace membership from
 * `public.workspace_memberships` (migration 0022). This is the application
 * mirror of the RLS helpers `is_workspace_member()` / `has_workspace_role()`;
 * RLS remains the actual control — this exists so server actions can fail
 * fast with a typed error and know which workspace/role they act in.
 *
 * New code (GovernanceOS and later modules) uses this instead of the
 * singleton `workspaces ... limit(1)` lookup. Existing ConsultOS code keeps
 * its lookup until it is migrated (no churn in G0).
 *
 * Roles here are PLATFORM roles only. Module roles (e.g. GovernanceOS
 * program roles) are resolved by their modules.
 */

export type WorkspaceRole = "owner" | "operator" | "viewer";

export interface WorkspaceActor {
  userId: string;
  /** profiles.id === auth.users.id */
  profileId: string;
  workspaceId: string;
  role: WorkspaceRole;
}

export type WorkspaceAuthError = "unauthenticated" | "not-a-member" | "forbidden-role";

export type WorkspaceAuthResult =
  | { ok: true; actor: WorkspaceActor }
  | { ok: false; error: WorkspaceAuthError };

interface MembershipRow {
  workspace_id: string;
  role: WorkspaceRole;
  created_at: string;
}

/**
 * Pure selection logic (unit-tested): pick the membership to act in.
 * With a requested workspace, only that one qualifies. Otherwise the
 * oldest active membership wins (v1 has one workspace per operator).
 */
export function selectMembership(
  rows: MembershipRow[],
  opts: { workspaceId?: string; roles?: readonly WorkspaceRole[] } = {},
): { ok: true; row: MembershipRow } | { ok: false; error: Exclude<WorkspaceAuthError, "unauthenticated"> } {
  const candidates = opts.workspaceId
    ? rows.filter((r) => r.workspace_id === opts.workspaceId)
    : [...rows].sort((a, b) => a.created_at.localeCompare(b.created_at));
  const row = candidates[0];
  if (!row) return { ok: false, error: "not-a-member" };
  if (opts.roles && !opts.roles.includes(row.role)) return { ok: false, error: "forbidden-role" };
  return { ok: true, row };
}

export async function requireWorkspaceMember(
  opts: { workspaceId?: string; roles?: readonly WorkspaceRole[] } = {},
): Promise<WorkspaceAuthResult> {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  // RLS on workspace_memberships lets a user read their own rows.
  const { data, error } = await supabase
    .from("workspace_memberships")
    .select("workspace_id, role, created_at")
    .eq("profile_id", user.id)
    .eq("status", "active");
  if (error || !data) return { ok: false, error: "not-a-member" };

  const picked = selectMembership(data as MembershipRow[], opts);
  if (!picked.ok) return picked;

  return {
    ok: true,
    actor: {
      userId: user.id,
      profileId: user.id,
      workspaceId: picked.row.workspace_id,
      role: picked.row.role,
    },
  };
}

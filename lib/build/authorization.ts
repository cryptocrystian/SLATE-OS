import "server-only";

import { requireWorkspaceMember, type WorkspaceActor, type WorkspaceRole } from "@/lib/auth/authorization";

/**
 * BuildOS server-side authorization (docs/81 §11). BUILDOS MODULE.
 *
 * Two layers, both always applied: the DB (RLS, role-based engine guards,
 * security-definer RPC checks) is the actual control; this module fails fast
 * with a typed error. B1 has no project-level roles — workspace roles only:
 *   viewer → read · operator → operate · owner → also provider accounts (spend).
 */

export type BuildAuthError = "unauthenticated" | "not-a-member" | "forbidden";

export type BuildAuthResult = { ok: true; actor: WorkspaceActor } | { ok: false; error: BuildAuthError };

async function requireRoles(roles?: readonly WorkspaceRole[]): Promise<BuildAuthResult> {
  const member = await requireWorkspaceMember(roles ? { roles } : {});
  if (member.ok) return member;
  if (member.error === "unauthenticated") return { ok: false, error: "unauthenticated" };
  if (member.error === "forbidden-role") return { ok: false, error: "forbidden" };
  return { ok: false, error: "not-a-member" };
}

export const requireBuildMember = () => requireRoles();
export const requireBuildOperator = () => requireRoles(["owner", "operator"]);
export const requireBuildOwner = () => requireRoles(["owner"]);

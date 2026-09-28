/**
 * GovernanceOS action matrix (pure; unit-tested). GOVERNANCEOS MODULE.
 *
 * RLS enforces the coarse boundary (read = any program role; write = the
 * roles listed per table). This matrix adds the finer rules. It can only
 * NARROW what RLS allows — never widen it.
 *
 * Consequential actions are reserved for program_admin / governance_manager
 * (PRD §9.3). AI never holds a role; there is no path by which a model can
 * perform these actions.
 */
import type { ProgramRole } from "./types";

export const GOVERNANCE_ACTIONS = [
  "program.view",
  "program.edit",
  "program.transition",
  "program.manage_members",
  "engagement.link",
  "engagement.unlink",
  "asset.register",
  "asset.edit",
  "asset.transition",
  "asset.retire",
  "policy.create",
  "policy.draft",
  "policy.activate",
  "policy.retire",
] as const;
export type GovernanceAction = (typeof GOVERNANCE_ACTIONS)[number];

const MATRIX: Record<GovernanceAction, readonly ProgramRole[]> = {
  "program.view": ["program_admin", "governance_manager", "reviewer", "contributor", "viewer"],
  "program.edit": ["program_admin", "governance_manager"],
  "program.transition": ["program_admin"],
  "program.manage_members": ["program_admin"],
  "engagement.link": ["program_admin", "governance_manager"],
  "engagement.unlink": ["program_admin", "governance_manager"],
  "asset.register": ["program_admin", "governance_manager", "contributor"],
  "asset.edit": ["program_admin", "governance_manager", "contributor"],
  "asset.transition": ["program_admin", "governance_manager"],
  "asset.retire": ["program_admin", "governance_manager"],
  "policy.create": ["program_admin", "governance_manager"],
  "policy.draft": ["program_admin", "governance_manager"],
  "policy.activate": ["program_admin", "governance_manager"],
  "policy.retire": ["program_admin"],
};

export function can(role: ProgramRole | null | undefined, action: GovernanceAction): boolean {
  if (!role) return false;
  return MATRIX[action].includes(role);
}

export function allowedActions(role: ProgramRole | null | undefined): GovernanceAction[] {
  return GOVERNANCE_ACTIONS.filter((a) => can(role, a));
}

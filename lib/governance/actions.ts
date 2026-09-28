"use server";

import { revalidatePath } from "next/cache";
import * as service from "./service";
import type { LifecycleStatus, ProgramStatus } from "./types";

/**
 * GovernanceOS operator server actions. GOVERNANCEOS MODULE.
 *
 * Thin wrappers: all validation, authorization, writes and audit live in
 * service.ts. These only add cache revalidation for the /app/governance tree.
 */

const base = (programId?: string) => (programId ? `/app/governance/programs/${programId}` : "/app/governance");

function done<T extends { ok: boolean }>(result: T, ...paths: string[]): T {
  if (result.ok) for (const p of paths) revalidatePath(p, "layout");
  return result;
}

export async function createProgramAction(input: Record<string, unknown>) {
  const r = await service.createProgram(input);
  return done(r, base());
}

export async function updateProgramAction(programId: string, patch: Record<string, unknown>) {
  return done(await service.updateProgram(programId, patch), base(programId), base());
}

export async function transitionProgramAction(programId: string, to: ProgramStatus, reason: string) {
  return done(await service.transitionProgram(programId, to, reason), base(programId), base());
}

export async function linkEngagementAction(programId: string, engagementId: string, relationship: string) {
  return done(await service.linkEngagement(programId, engagementId, relationship), base(programId));
}

export async function unlinkEngagementAction(programId: string, linkId: string, reason: string) {
  return done(await service.unlinkEngagement(programId, linkId, reason), base(programId));
}

export async function registerAssetAction(programId: string, input: Record<string, unknown>) {
  return done(await service.registerAsset(programId, input), base(programId));
}

export async function updateAssetAction(programId: string, assetId: string, input: Record<string, unknown>) {
  return done(await service.updateAsset(programId, assetId, input), base(programId));
}

export async function transitionAssetAction(
  programId: string,
  assetId: string,
  to: LifecycleStatus,
  reason: string,
) {
  return done(await service.transitionAsset(programId, assetId, to, reason), base(programId));
}

export async function createPolicyAction(programId: string, input: Record<string, unknown>) {
  return done(await service.createPolicy(programId, input), base(programId));
}

export async function saveDraftVersionAction(programId: string, policyId: string, input: Record<string, unknown>) {
  return done(await service.saveDraftVersion(programId, policyId, input), base(programId));
}

export async function activatePolicyVersionAction(programId: string, versionId: string, reason: string) {
  return done(await service.activatePolicyVersion(programId, versionId, reason), base(programId));
}

export async function retirePolicyVersionAction(programId: string, versionId: string, reason: string) {
  return done(await service.retirePolicyVersion(programId, versionId, reason), base(programId));
}

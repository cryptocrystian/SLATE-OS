import "server-only";

/**
 * GovernanceOS control-plane contracts (docs/72 §1.1, §4.2). GOVERNANCEOS MODULE.
 *
 * THE ONLY surface other SLATE modules (ConsultOS, BuildOS, VentureOS,
 * integration/FDE, runtime adapters, internal tooling) may import from
 * GovernanceOS. Enforced by the `no-restricted-imports` rule in
 * .eslintrc.json. Callers never read governance tables directly.
 *
 * Contract rules:
 *   - In-process, typed, server-only. No second service stack.
 *   - Every call runs as the calling operator's session: RLS + GovernanceOS
 *     authorization apply. Source identifiers are LINEAGE, never proof of
 *     access (docs/76 §5).
 *   - Reads are side-effect free.
 *   - G1: no module calls these yet (isolation from the founder self-test).
 *     The first caller is ConsultOS "Promote to GovernanceOS" (G2).
 *   - G1 gate evaluation is ADVISORY ONLY: it never returns "deny". Gated /
 *     enforced outcomes arrive with decision records (G3) and adapters (G4).
 */

import { computeAssetPosture, computePosture, type AssetPosture, type GovernancePosture } from "./posture";
import { getAsset, getProgram, listAssets, listEngagementLinks, listPolicies } from "./queries";
import { registerAsset, type ServiceResult } from "./service";
import type { AssetType, SourceSystem } from "./types";
import { isUuid } from "./validation";

export type { GovernancePosture, AssetPosture } from "./posture";

/** Common source contract (PRD §7.1). */
export interface GovernedAssetSourceContract {
  programId: string;
  assetType: AssetType;
  name: string;
  description?: string;
  source: {
    sourceSystem: SourceSystem;
    sourceEntityType: string;
    sourceEntityId: string;
    correlationId?: string;
  };
  owners?: { businessOwnerName?: string; technicalOwnerName?: string };
  /** Material governance metadata — same vocabulary as the registry. */
  governance?: {
    criticality?: string;
    dataSensitivity?: string;
    autonomyLevel?: string;
    humanOversightMode?: string;
    deploymentEnvironment?: string;
    modelProvider?: string;
    modelIdentifier?: string;
    externalVendor?: string;
    intendedUse?: string;
  };
}

/** Idempotent on (program, source_system, source_entity_type, source_entity_id). */
export async function registerGovernedAsset(
  input: GovernedAssetSourceContract,
): Promise<ServiceResult<{ assetId: string; created: boolean }>> {
  return registerAsset(input.programId, {
    assetType: input.assetType,
    name: input.name,
    description: input.description,
    businessOwnerName: input.owners?.businessOwnerName,
    technicalOwnerName: input.owners?.technicalOwnerName,
    ...input.governance,
    source: input.source,
  });
}

export async function getGovernancePosture(
  target: { programId: string } | { programId: string; assetId: string },
): Promise<
  | { ok: true; scope: "program"; posture: GovernancePosture }
  | { ok: true; scope: "asset"; posture: AssetPosture }
  | { ok: false; error: "not-found" }
> {
  if (!isUuid(target.programId)) return { ok: false, error: "not-found" };
  const program = await getProgram(target.programId);
  if (!program) return { ok: false, error: "not-found" };
  const policies = await listPolicies(program.id);

  if ("assetId" in target) {
    const asset = await getAsset(program.id, target.assetId);
    if (!asset) return { ok: false, error: "not-found" };
    return { ok: true, scope: "asset", posture: computeAssetPosture(asset, policies) };
  }

  const [assets, links] = await Promise.all([listAssets(program.id), listEngagementLinks(program.id)]);
  return { ok: true, scope: "program", posture: computePosture({ program, assets, policies, links }) };
}

/** Structured, human- and machine-readable gate outcome (PRD §14). */
export interface GovernanceGateOutcome {
  outcome: "allowed" | "approval_required" | "denied";
  activationMode: "advisory";
  reasonCode:
    | "advisory_only_g1"
    | "asset_not_registered"
    | "asset_retired"
    | "asset_not_governance_approved";
  explanation: string;
  advisories: Array<{ policyKey: string; name: string; statement: string }>;
}

/**
 * Advisory gate evaluation (PRD §7.2 `evaluateGovernanceGate`). In G1 this
 * NEVER blocks: `outcome` is always "allowed" and the result carries the
 * advisories an operator or system should heed. It records nothing
 * (side-effect free); enforcement-event logging arrives with G4.
 */
export async function evaluateGovernanceGate(input: {
  programId: string;
  assetId?: string;
  action: string;
}): Promise<GovernanceGateOutcome> {
  const policies = await listPolicies(input.programId);
  const advisories = policies.flatMap((p) => {
    const active = p.versions.find((v) => v.status === "active");
    return active ? [{ policyKey: p.policyKey, name: p.name, statement: active.statement }] : [];
  });
  if (input.assetId) {
    const asset = await getAsset(input.programId, input.assetId);
    if (!asset) {
      return {
        outcome: "allowed",
        activationMode: "advisory",
        reasonCode: "asset_not_registered",
        explanation: "Asset is not registered in this governance program. Advisory only in G1; register it to govern it.",
        advisories,
      };
    }
    if (asset.lifecycleStatus === "retired") {
      return {
        outcome: "allowed",
        activationMode: "advisory",
        reasonCode: "asset_retired",
        explanation: `${asset.name} is retired. Advisory only in G1; a retired asset should not be operated.`,
        advisories,
      };
    }
    return {
      outcome: "allowed",
      activationMode: "advisory",
      reasonCode: "asset_not_governance_approved",
      explanation: `${asset.name} has no governance approval yet (decision records arrive in G3). Advisory only.`,
      advisories,
    };
  }
  return {
    outcome: "allowed",
    activationMode: "advisory",
    reasonCode: "advisory_only_g1",
    explanation: "GovernanceOS gates are advisory in G1.",
    advisories,
  };
}

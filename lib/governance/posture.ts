/**
 * Governance posture read model (docs/72 §4.2). GOVERNANCEOS MODULE.
 *
 * `computePosture` is PURE and side-effect free (unit-tested); callers load
 * data under the operator's session and pass it in. It is the structured
 * answer to "what is the governance state of this program / asset?" for
 * both the operator overview and cross-SLATE callers (contracts.ts).
 *
 * Honesty rules:
 *   - Nothing is reported as governance-approved in G1 (no decision records
 *     exist yet); running assets are `activeNotApproved`.
 *   - Risk / control / evidence posture is `null` ("not yet assessed"),
 *     never zero. Zero would imply "no risk".
 *   - Policies are advisory-only in G1; `gatedOrEnforcedActive` is 0 by
 *     construction, not by omission.
 */
import type {
  AssetType,
  GovernancePolicy,
  GovernanceProgram,
  GovernedAsset,
  LifecycleStatus,
  ProgramEngagementLink,
  SourceSystem,
} from "./types";

export type AttentionKind =
  | "asset_active_not_approved"
  | "asset_unclassified"
  | "program_review_overdue"
  | "program_review_unscheduled"
  | "policy_draft_pending"
  | "program_has_no_policies"
  | "program_has_no_assets";

export interface AttentionItem {
  kind: AttentionKind;
  severity: "high" | "medium" | "low";
  title: string;
  entityId: string | null;
}

export interface GovernancePosture {
  programId: string;
  asOf: string;
  programStatus: GovernanceProgram["status"];
  assets: {
    total: number;
    live: number; // not retired
    byLifecycle: Record<LifecycleStatus, number>;
    byType: Partial<Record<AssetType, number>>;
    bySource: Partial<Record<SourceSystem | "unsourced", number>>;
    activeNotApproved: number;
    highOrCriticalLive: number;
    unclassifiedLive: number; // missing criticality or data sensitivity
    autonomousLive: number;
  };
  policies: {
    total: number;
    activeAdvisory: number;
    gatedOrEnforcedActive: number;
    draftsPending: number;
  };
  engagements: { linkedActive: number; linkedHistorical: number };
  review: { nextProgramReviewAt: string | null; overdue: boolean; unscheduled: boolean };
  /** Reserved for G2/G3 — null means "not yet assessed", never "none". */
  risks: null;
  controls: null;
  evidence: null;
  approvals: { approvedAssets: null };
  attention: AttentionItem[];
}

const EMPTY_LIFECYCLE: Record<LifecycleStatus, number> = {
  proposed: 0,
  assessment: 0,
  active: 0,
  restricted: 0,
  retired: 0,
};

export function computePosture(input: {
  program: GovernanceProgram;
  assets: GovernedAsset[];
  policies: GovernancePolicy[];
  links: ProgramEngagementLink[];
  now?: Date;
}): GovernancePosture {
  const now = input.now ?? new Date();
  const byLifecycle = { ...EMPTY_LIFECYCLE };
  const byType: Partial<Record<AssetType, number>> = {};
  const bySource: Partial<Record<SourceSystem | "unsourced", number>> = {};
  const attention: AttentionItem[] = [];
  let activeNotApproved = 0;
  let highOrCriticalLive = 0;
  let unclassifiedLive = 0;
  let autonomousLive = 0;

  for (const a of input.assets) {
    byLifecycle[a.lifecycleStatus] += 1;
    byType[a.assetType] = (byType[a.assetType] ?? 0) + 1;
    const src = a.sourceSystem ?? "unsourced";
    bySource[src] = (bySource[src] ?? 0) + 1;
    if (a.lifecycleStatus === "retired") continue;
    if (a.lifecycleStatus === "active" || a.lifecycleStatus === "restricted") {
      activeNotApproved += 1;
      attention.push({
        kind: "asset_active_not_approved",
        severity: a.criticality === "high" || a.criticality === "critical" ? "high" : "medium",
        title: `${a.name} is running without a governance approval`,
        entityId: a.id,
      });
    }
    if (a.criticality === "high" || a.criticality === "critical") highOrCriticalLive += 1;
    if (a.autonomyLevel === "autonomous" || a.autonomyLevel === "conditional") autonomousLive += 1;
    if (!a.criticality || !a.dataSensitivity) {
      unclassifiedLive += 1;
      attention.push({
        kind: "asset_unclassified",
        severity: "low",
        title: `${a.name} is missing ${!a.criticality ? "criticality" : "data sensitivity"}`,
        entityId: a.id,
      });
    }
  }

  let activeAdvisory = 0;
  let gatedOrEnforcedActive = 0;
  let draftsPending = 0;
  for (const p of input.policies) {
    const active = p.versions.find((v) => v.status === "active");
    if (active) {
      if (active.activationMode === "advisory") activeAdvisory += 1;
      else gatedOrEnforcedActive += 1;
    }
    if (p.versions.some((v) => v.status === "draft")) {
      draftsPending += 1;
      attention.push({
        kind: "policy_draft_pending",
        severity: "low",
        title: `${p.name} has an unactivated draft`,
        entityId: p.id,
      });
    }
  }

  const next = input.program.nextProgramReviewAt;
  const overdue = next !== null && new Date(next).getTime() < now.getTime();
  const unscheduled = next === null;
  if (input.program.status === "active" || input.program.status === "paused") {
    if (overdue) {
      attention.push({ kind: "program_review_overdue", severity: "high", title: "Program review is overdue", entityId: null });
    } else if (unscheduled) {
      attention.push({
        kind: "program_review_unscheduled",
        severity: "medium",
        title: "No next program review is scheduled",
        entityId: null,
      });
    }
  }
  if (input.program.status !== "archived") {
    if (input.assets.length === 0) {
      attention.push({ kind: "program_has_no_assets", severity: "medium", title: "No governed assets registered yet", entityId: null });
    }
    if (input.policies.length === 0) {
      attention.push({ kind: "program_has_no_policies", severity: "low", title: "No policies defined yet", entityId: null });
    }
  }

  const severityRank = { high: 0, medium: 1, low: 2 } as const;
  attention.sort((a, b) => severityRank[a.severity] - severityRank[b.severity]);

  return {
    programId: input.program.id,
    asOf: now.toISOString(),
    programStatus: input.program.status,
    assets: {
      total: input.assets.length,
      live: input.assets.length - byLifecycle.retired,
      byLifecycle,
      byType,
      bySource,
      activeNotApproved,
      highOrCriticalLive,
      unclassifiedLive,
      autonomousLive,
    },
    policies: { total: input.policies.length, activeAdvisory, gatedOrEnforcedActive, draftsPending },
    engagements: {
      linkedActive: input.links.filter((l) => !l.unlinkedAt).length,
      linkedHistorical: input.links.filter((l) => l.unlinkedAt).length,
    },
    review: { nextProgramReviewAt: next, overdue, unscheduled },
    risks: null,
    controls: null,
    evidence: null,
    approvals: { approvedAssets: null },
    attention,
  };
}

export interface AssetPosture {
  assetId: string;
  lifecycleStatus: LifecycleStatus;
  governanceApproved: false; // G1: no decision records exist yet
  classified: boolean;
  applicableAdvisoryPolicies: number;
  risks: null;
  controls: null;
  evidence: null;
}

export function computeAssetPosture(asset: GovernedAsset, policies: GovernancePolicy[]): AssetPosture {
  return {
    assetId: asset.id,
    lifecycleStatus: asset.lifecycleStatus,
    governanceApproved: false,
    classified: Boolean(asset.criticality && asset.dataSensitivity),
    // G1 policies are program-wide (no scope selectors yet).
    applicableAdvisoryPolicies: policies.filter((p) =>
      p.versions.some((v) => v.status === "active" && v.activationMode === "advisory"),
    ).length,
    risks: null,
    controls: null,
    evidence: null,
  };
}

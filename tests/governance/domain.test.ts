/**
 * GovernanceOS pure domain logic: permissions, validation, posture.
 * Layer: GOVERNANCEOS MODULE.
 */
import { describe, expect, it } from "vitest";
import { can, allowedActions } from "@/lib/governance/permissions";
import {
  validateCreatePolicy,
  validateCreateProgram,
  validatePolicyDraft,
  validateRegisterAsset,
  validateSource,
  slugifyPolicyKey,
} from "@/lib/governance/validation";
import { computeAssetPosture, computePosture } from "@/lib/governance/posture";
import type { GovernancePolicy, GovernanceProgram, GovernedAsset } from "@/lib/governance/types";
import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("permissions matrix", () => {
  it("viewers and reviewers are read-only in G1", () => {
    expect(allowedActions("viewer")).toEqual(["program.view"]);
    expect(allowedActions("reviewer")).toEqual(["program.view"]);
    expect(can(null, "program.view")).toBe(false);
  });
  it("contributors register and edit assets but cannot make consequential moves", () => {
    expect(can("contributor", "asset.register")).toBe(true);
    for (const a of ["asset.transition", "asset.retire", "policy.activate", "engagement.link", "program.transition"] as const) {
      expect(can("contributor", a)).toBe(false);
    }
  });
  it("only program admins retire policies, change program status, or manage members", () => {
    for (const a of ["policy.retire", "program.transition", "program.manage_members"] as const) {
      expect(can("program_admin", a)).toBe(true);
      expect(can("governance_manager", a)).toBe(false);
    }
  });
});

describe("validation", () => {
  it("program kind drives required ownership", () => {
    expect(validateCreateProgram({ programKind: "client", name: "X" })).toEqual({ ok: false, error: "account-required" });
    expect(validateCreateProgram({ programKind: "venture", name: "X" })).toEqual({ ok: false, error: "venture-source-required" });
    const internal = validateCreateProgram({ programKind: "internal", name: " Saipien ", accountId: crypto.randomUUID() });
    expect(internal.ok && internal.value.accountId).toBe(null); // internal never carries an account
    expect(internal.ok && internal.value.name).toBe("Saipien");
  });

  it("asset dimensions must be in vocabulary; lineage is all-or-nothing", () => {
    expect(validateRegisterAsset({ assetType: "agent", name: "A", criticality: "extreme" })).toEqual({
      ok: false,
      error: "invalid-dimension",
    });
    expect(validateSource({ sourceSystem: "buildos", sourceEntityType: "release" })).toBe(false);
    expect(validateSource({ sourceSystem: "advisoryops", sourceEntityType: "x", sourceEntityId: "1" })).toBe(false);
    expect(validateSource({ sourceSystem: "", sourceEntityType: "", sourceEntityId: "" })).toBe(null);
    const ok = validateRegisterAsset({
      assetType: "agent",
      name: "Support agent",
      prohibitedUses: ["  Approving refunds ", "", 7],
      source: { sourceSystem: "runtime", sourceEntityType: "agent", sourceEntityId: "rt-1" },
    });
    expect(ok.ok && ok.value.prohibitedUses).toEqual(["Approving refunds"]);
    expect(ok.ok && ok.value.source?.sourceSystem).toBe("runtime");
  });

  it("policies: only advisory activation is available in G1; keys are slugged", () => {
    expect(validatePolicyDraft({ statement: "x", activationMode: "enforced" })).toEqual({
      ok: false,
      error: "activation-mode-unavailable",
    });
    expect(validatePolicyDraft({ statement: "x", activationMode: "gated" }).ok).toBe(false);
    expect(slugifyPolicyKey("Approved AI Providers!")).toBe("approved-ai-providers");
    const p = validateCreatePolicy({ name: "Model change procedure", policyDomain: "change", statement: "..." });
    expect(p.ok && p.value.policyKey).toBe("model-change-procedure");
    expect(validateCreatePolicy({ name: "x", policyDomain: "change", statement: "s", policyKey: "Bad Key" }).ok).toBe(false);
  });

  it("TS vocabularies mirror the SQL check constraints", () => {
    const sql = ["0026_governance_programs.sql", "0027_governance_assets.sql", "0028_governance_policies.sql"]
      .map((f) => readFileSync(join(__dirname, "..", "..", "supabase", "migrations", f), "utf8"))
      .join("\n");
    for (const token of [
      "'use_case', 'ai_system', 'model', 'agent', 'workflow', 'vendor_service'",
      "'proposed', 'assessment', 'active', 'restricted', 'retired'",
      "'consultos', 'buildos', 'ventureos', 'integration', 'runtime', 'internal', 'external'",
      "'program_admin', 'governance_manager', 'reviewer', 'contributor', 'viewer'",
    ]) {
      expect(sql).toContain(token);
    }
  });
});

const program = (over: Partial<GovernanceProgram> = {}): GovernanceProgram => ({
  id: "p1",
  workspaceId: "w",
  programKind: "internal",
  accountId: null,
  accountName: null,
  ventureSourceId: null,
  name: "Internal",
  description: null,
  status: "active",
  ownerProfileId: null,
  executiveSponsorName: null,
  operatingModel: null,
  defaultReviewCadence: "quarterly",
  startedAt: null,
  nextProgramReviewAt: null,
  archivedAt: null,
  createdAt: "2026-09-28T00:00:00Z",
  updatedAt: "2026-09-28T00:00:00Z",
  ...over,
});

const asset = (over: Partial<GovernedAsset>): GovernedAsset => ({
  id: over.id ?? "a",
  governanceProgramId: "p1",
  assetType: "ai_system",
  name: "Asset",
  description: null,
  lifecycleStatus: "proposed",
  criticality: null,
  dataSensitivity: null,
  autonomyLevel: null,
  humanOversightMode: null,
  deploymentEnvironment: null,
  externalVendor: null,
  modelProvider: null,
  modelIdentifier: null,
  intendedUse: null,
  prohibitedUses: [],
  operatorOwnerProfileId: null,
  businessOwnerName: null,
  technicalOwnerName: null,
  sourceSystem: null,
  sourceEntityType: null,
  sourceEntityId: null,
  correlationId: null,
  externalRuntimeId: null,
  parentGovernedAssetId: null,
  createdAt: "",
  updatedAt: "",
  retiredAt: null,
  ...over,
});

const policy = (statuses: Array<"draft" | "active" | "superseded" | "retired">): GovernancePolicy => ({
  id: `pol-${statuses.join("-")}`,
  governanceProgramId: "p1",
  policyKey: "k",
  name: "Policy",
  policyDomain: "model",
  ownerProfileId: null,
  createdAt: "",
  versions: statuses.map((status, i) => ({
    id: `v${i}`,
    version: i + 1,
    status,
    activationMode: "advisory",
    statement: "s",
    rationale: null,
    supersedesVersionId: null,
    createdAt: "",
    activatedAt: null,
    supersededAt: null,
    retiredAt: null,
  })),
});

describe("posture read model", () => {
  it("never reports approval, and reports risk/control/evidence as not assessed (null), never zero", () => {
    const p = computePosture({ program: program(), assets: [], policies: [], links: [] });
    expect(p.risks).toBeNull();
    expect(p.controls).toBeNull();
    expect(p.evidence).toBeNull();
    expect(p.approvals.approvedAssets).toBeNull();
    const ap = computeAssetPosture(asset({ lifecycleStatus: "active" }), []);
    expect(ap.governanceApproved).toBe(false);
  });

  it("surfaces running-but-unapproved and unclassified assets, highest severity first", () => {
    const p = computePosture({
      program: program({ nextProgramReviewAt: "2026-01-01T00:00:00Z" }),
      assets: [
        asset({ id: "a1", name: "Pipeline", lifecycleStatus: "active", criticality: "high", dataSensitivity: "confidential" }),
        asset({ id: "a2", name: "Proposed thing" }),
        asset({ id: "a3", name: "Old", lifecycleStatus: "retired", criticality: "critical" }),
      ],
      policies: [policy(["superseded", "active"]), policy(["draft"])],
      links: [],
      now: new Date("2026-09-28T00:00:00Z"),
    });
    expect(p.assets.live).toBe(2);
    expect(p.assets.activeNotApproved).toBe(1);
    expect(p.assets.highOrCriticalLive).toBe(1); // retired critical excluded
    expect(p.assets.unclassifiedLive).toBe(1);
    expect(p.policies).toEqual({ total: 2, activeAdvisory: 1, gatedOrEnforcedActive: 0, draftsPending: 1 });
    expect(p.review.overdue).toBe(true);
    expect(p.attention[0].severity).toBe("high");
    expect(p.attention.map((a) => a.kind)).toEqual(
      expect.arrayContaining(["asset_active_not_approved", "asset_unclassified", "program_review_overdue", "policy_draft_pending"]),
    );
  });

  it("an archived program raises no 'empty program' nags", () => {
    const p = computePosture({ program: program({ status: "archived" }), assets: [], policies: [], links: [] });
    expect(p.attention).toEqual([]);
  });
});

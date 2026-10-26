/** Launch path (docs/73 v0.2): proportionality checklist + starter register validity. Pure. */
import { describe, expect, it } from "vitest";
import { controlSummary, gov06Missing, requiredControls } from "@/lib/governance/proportionality";
import { STARTER_ASSETS, STARTER_POLICIES } from "@/lib/governance/starter-register";
import { validateCreatePolicy, validateRegisterAsset, validateToolsAndPermissions } from "@/lib/governance/validation";
import type { GovernedAsset } from "@/lib/governance/types";

const asset = (over: Partial<GovernedAsset> = {}): GovernedAsset => ({
  id: "a",
  governanceProgramId: "p",
  assetType: "ai_system",
  name: "A",
  description: null,
  lifecycleStatus: "proposed",
  criticality: null,
  dataSensitivity: null,
  autonomyLevel: null,
  humanOversightMode: null,
  deploymentEnvironment: null,
  clientImpact: null,
  controlTier: "unclassified",
  toolsAndPermissions: [],
  stopMechanism: null,
  approverName: null,
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

const complete: Partial<GovernedAsset> = {
  operatorOwnerProfileId: "u",
  autonomyLevel: "assistive",
  humanOversightMode: "human_in_the_loop",
  dataSensitivity: "confidential",
  clientImpact: "direct",
  toolsAndPermissions: [{ tool: "OpenAI", permission: "drafts" }],
  stopMechanism: "Remove key",
  approverName: "Founder",
};

describe("GOV 06 — gov06Missing mirrors the 0037 guard", () => {
  it("lists every missing field on an empty record and nothing on a complete one", () => {
    expect(gov06Missing(asset())).toEqual([
      "owner",
      "autonomy level",
      "oversight mode",
      "data sensitivity",
      "client impact",
      "tools and permissions",
      "stop mechanism",
      "named approver",
    ]);
    expect(gov06Missing(asset(complete))).toEqual([]);
    expect(gov06Missing(asset({ ...complete, approverName: "  " }))).toEqual(["named approver"]);
  });
});

describe("GOV 02 — required controls scale with the tier", () => {
  it("adds controls as the tier rises and never reports a pending control as met", () => {
    const std = requiredControls(asset({ ...complete, controlTier: "standard" }));
    const elev = requiredControls(asset({ ...complete, controlTier: "elevated" }));
    const high = requiredControls(asset({ ...complete, controlTier: "high" }));
    expect(std.length).toBeLessThan(elev.length);
    expect(elev.length).toBeLessThan(high.length);
    expect(high.find((c) => c.id === "go-live-decision")?.status).toBe("pending");
    expect(high.find((c) => c.id === "prohibited-uses")?.status).toBe("missing");
    expect(controlSummary(std).missing).toBe(0);
  });

  it("flags unclassified systems and weak oversight at the high tier", () => {
    expect(requiredControls(asset()).find((c) => c.id === "readings")?.status).toBe("missing");
    const outOfLoop = requiredControls(asset({ ...complete, controlTier: "high", humanOversightMode: "human_out_of_the_loop" }));
    expect(outOfLoop.find((c) => c.id === "oversight-strength")?.status).toBe("missing");
  });
});

describe("tools and permissions parsing", () => {
  it("accepts 'tool: permission' lines and objects; rejects junk", () => {
    expect(validateToolsAndPermissions(["OpenAI API: send prompts", "  ", "Attio"])).toEqual([
      { tool: "OpenAI API", permission: "send prompts" },
      { tool: "Attio", permission: "unspecified" },
    ]);
    expect(validateToolsAndPermissions([{ tool: "X", permission: "read" }])).toEqual([{ tool: "X", permission: "read" }]);
    expect(validateToolsAndPermissions("nope")).toBe(false);
    expect(validateToolsAndPermissions([42])).toBe(false);
  });
});

describe("starter register (docs/73 v0.2)", () => {
  it("every system passes the same validation the app applies", () => {
    for (const a of STARTER_ASSETS) {
      const r = validateRegisterAsset({ ...a.input, source: { sourceSystem: "internal", sourceEntityType: "starter_register", sourceEntityId: a.key } });
      expect(r.ok, `${a.key}: ${!r.ok ? r.error : ""}`).toBe(true);
    }
  });

  it("never pre-names an approver — a person must, so nothing can go live on load", () => {
    for (const a of STARTER_ASSETS) {
      expect(a.input.approverName, a.key).toBeNull();
      expect(gov06Missing(asset({ ...(a.input as Partial<GovernedAsset>), operatorOwnerProfileId: "u" }))).toContain("named approver");
    }
  });

  it("parents exist and keys are unique", () => {
    const keys = STARTER_ASSETS.map((a) => a.key);
    expect(new Set(keys).size).toBe(keys.length);
    for (const a of STARTER_ASSETS) if (a.parentKey) expect(keys).toContain(a.parentKey);
  });

  it("drafts exactly the seven GOV policies, all valid and advisory", () => {
    expect(STARTER_POLICIES.map((p) => p.gov)).toEqual(["GOV 01", "GOV 02", "GOV 03", "GOV 04", "GOV 05", "GOV 06", "GOV 07"]);
    for (const p of STARTER_POLICIES) {
      const r = validateCreatePolicy({ ...p, name: `${p.gov} · ${p.name}`, activationMode: "advisory" });
      expect(r.ok, p.policyKey).toBe(true);
    }
  });
});

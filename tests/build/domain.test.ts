/** BuildOS pure-domain rules (docs/81). BUILDOS MODULE. */
import { describe, expect, it } from "vitest";
import {
  canOperatorTransitionItem,
  looksLikeSecret,
  parseBindings,
  validateCreateProject,
  validateCreateWorkItem,
  validateProjectSettings,
  validateProviderAccount,
  validateRuling,
  validateWorker,
} from "@/lib/build/validation";
import { ago, until } from "@/components/build/format";

const project = {
  projectKey: "arxus",
  name: "Arxus",
  originKind: "ventureos_venture",
  originRef: "arxus",
  repoUrl: "https://github.com/cryptocrystian/arxus",
  stackProfile: "next-supabase",
  canonProfile: "arxus-v2",
};

describe("validateCreateProject", () => {
  it("accepts a venture project with default roster", () => {
    const r = validateCreateProject(project);
    expect(r.ok && r.value).toMatchObject({ builderFamily: "anthropic", judgeFamilies: ["openai", "google", "xai"], defaultBranch: "main" });
  });
  it("enforces I3: a judge family may not equal the builder family", () => {
    expect(validateCreateProject({ ...project, judgeFamilies: ["anthropic", "openai"] })).toEqual({
      ok: false,
      error: "judge-shares-builder-family",
    });
  });
  it("requires origin lineage by kind", () => {
    expect(validateCreateProject({ ...project, originRef: "" })).toMatchObject({ ok: false, error: "origin-ref" });
    expect(validateCreateProject({ ...project, originKind: "consultos_engagement" })).toMatchObject({ ok: false, error: "origin-engagement" });
    const internal = validateCreateProject({ ...project, originKind: "internal", originRef: "ignored" });
    expect(internal.ok && internal.value.originRef).toBeNull();
  });
  it("rejects bad keys and repos", () => {
    expect(validateCreateProject({ ...project, projectKey: "Arxus!" })).toMatchObject({ error: "project-key" });
    expect(validateCreateProject({ ...project, repoUrl: "ftp://x" })).toMatchObject({ error: "repo-url" });
  });
});

describe("work items", () => {
  it("parses bindings and keeps '*' alone", () => {
    expect(parseBindings("Listing, Seller, Listing")).toEqual(["Listing", "Seller"]);
    expect(parseBindings(["*"])).toEqual(["*"]);
    expect(parseBindings("*, Listing")).toBeNull();
    expect(parseBindings("bad binding")).toBeNull();
  });
  it("a foundation without bindings binds the whole project", () => {
    const r = validateCreateWorkItem({ itemKey: "auth-foundation", kind: "foundation", title: "Auth" });
    expect(r.ok && r.value.bindings).toEqual(["*"]);
  });
  it("a remediation must name the item it remediates", () => {
    expect(validateCreateWorkItem({ itemKey: "jrn-s4.r1", kind: "remediation", title: "Fix" })).toMatchObject({
      ok: false,
      error: "remediates-item",
    });
  });
  it("operator transitions exclude engine-owned states", () => {
    expect(canOperatorTransitionItem("held", "ready")).toBe(true);
    expect(canOperatorTransitionItem("ready", "in_progress")).toBe(false);
    expect(canOperatorTransitionItem("escalated", "ready")).toBe(false); // only via a ruling
    expect(canOperatorTransitionItem("accepted", "cancelled")).toBe(false);
  });
});

describe("settings, rulings, capacity", () => {
  it("bounds scheduling settings", () => {
    expect(validateProjectSettings({ wipLimit: 9 })).toMatchObject({ ok: false, error: "wip-limit" });
    expect(validateProjectSettings({ dailyBudgetUsd: "12.345" })).toEqual({ ok: true, value: { dailyBudgetUsd: 12.35 } });
    expect(validateProjectSettings({})).toMatchObject({ ok: false, error: "no-changes" });
  });
  it("a ruling must pick a known option and an item action", () => {
    expect(validateRuling({ option: "x", itemAction: "ready" }, ["ratify"])).toMatchObject({ error: "option" });
    expect(validateRuling({ option: "ratify", itemAction: "dispatch" }, ["ratify"])).toMatchObject({ error: "item-action" });
    expect(validateRuling({ option: "ratify", itemAction: "ready", resultingCanonRef: "DEC-062" }, ["ratify"])).toMatchObject({ ok: true });
  });
  it("provider accounts store a secret REFERENCE, never a key", () => {
    const base = { label: "xai-1", family: "xai", provider: "xai", billingClass: "metered", maxConcurrency: 2 };
    expect(validateProviderAccount({ ...base, secretRef: "vault/xai-1" }).ok).toBe(true);
    expect(validateProviderAccount({ ...base, secretRef: "xai-abcdefghijklmnop" })).toMatchObject({ error: "secret-ref" });
    expect(looksLikeSecret("sk-proj-1234567890abcdef")).toBe(true);
    expect(looksLikeSecret("xai-1")).toBe(false); // a reasonable reference name
    expect(looksLikeSecret("vault/Abc123Def456Ghi789Jkl012Mno345Pq")).toBe(true);
    expect(looksLikeSecret("vault/openai-org-1")).toBe(false);
  });
  it("workers declare at least one stack profile", () => {
    expect(validateWorker({ name: "vps-1", substrate: "vps", capabilities: "next-supabase" }).ok).toBe(true);
    expect(validateWorker({ name: "vps-1", substrate: "vps", capabilities: "" })).toMatchObject({ error: "capabilities" });
  });
});

describe("format", () => {
  const now = Date.parse("2026-10-02T12:00:00Z");
  it("renders relative times", () => {
    expect(ago(null, now)).toBe("never");
    expect(ago("2026-10-02T11:59:30Z", now)).toBe("30s ago");
    expect(ago("2026-10-02T10:00:00Z", now)).toBe("2h ago");
    expect(until("2026-10-02T12:15:00Z", now)).toBe("15m");
  });
});

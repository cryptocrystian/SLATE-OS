/**
 * GOV 02 proportionality + GOV 06 go-live record (docs/73 v0.2). GOVERNANCEOS MODULE.
 *
 * PURE (unit-tested). The control tier itself is derived by the database
 * (migration 0037) from the three readings — data sensitivity, autonomy,
 * client impact — and is only READ here. This module answers: for this
 * system's tier, which controls are required, and which are met by what is
 * on record?
 *
 * Status of each control:
 *   met        — the record shows it
 *   missing    — required at this tier and not on record
 *   procedural — required, but evidenced by a policy/procedure run rather than
 *                a field (e.g. GOV 05 sample test before a model change)
 *   pending    — required, but its record type arrives with G3/G4 (e.g. a
 *                go-live approval decision). Shown honestly, never as met.
 */
import type { ControlTier, GovernedAsset } from "./types";

export type ControlStatus = "met" | "missing" | "procedural" | "pending";

export interface RequiredControl {
  id: string;
  gov: "GOV 01" | "GOV 02" | "GOV 04" | "GOV 05" | "GOV 06" | "GOV 07";
  label: string;
  status: ControlStatus;
  detail?: string;
}

const TIER_RANK: Record<ControlTier, number> = { unclassified: -1, standard: 0, elevated: 1, high: 2 };

const has = (s: string | null | undefined) => Boolean(s && s.trim());

/** Fields GOV 06 needs before go-live. Mirrors the 0037 guard exactly. */
export function gov06Missing(a: GovernedAsset): string[] {
  const missing: string[] = [];
  if (!a.operatorOwnerProfileId && !has(a.businessOwnerName)) missing.push("owner");
  if (!a.autonomyLevel) missing.push("autonomy level");
  if (!a.humanOversightMode) missing.push("oversight mode");
  if (!a.dataSensitivity) missing.push("data sensitivity");
  if (!a.clientImpact) missing.push("client impact");
  if (a.toolsAndPermissions.length === 0) missing.push("tools and permissions");
  if (!has(a.stopMechanism)) missing.push("stop mechanism");
  if (!has(a.approverName)) missing.push("named approver");
  return missing;
}

export function requiredControls(a: GovernedAsset): RequiredControl[] {
  const tier = a.controlTier;
  const rank = TIER_RANK[tier];
  const out: RequiredControl[] = [];
  const field = (id: string, gov: RequiredControl["gov"], label: string, ok: boolean, detail?: string) =>
    out.push({ id, gov, label, status: ok ? "met" : "missing", detail });

  // GOV 02 — the readings themselves.
  field(
    "readings",
    "GOV 02",
    "Three readings taken: data sensitivity, autonomy, client impact",
    tier !== "unclassified",
    tier === "unclassified" ? "Record all three to derive the control tier." : undefined,
  );

  // GOV 06 — every tier, before go-live.
  field("owner", "GOV 06", "Owner recorded", Boolean(a.operatorOwnerProfileId || has(a.businessOwnerName)));
  field("oversight", "GOV 06", "Human oversight mode recorded", Boolean(a.humanOversightMode));
  field("tools", "GOV 06", "Tools and permissions listed", a.toolsAndPermissions.length > 0);
  field("stop", "GOV 06", "Stop mechanism documented", has(a.stopMechanism));
  field("approver", "GOV 06", "Named approver", has(a.approverName));

  // GOV 04 — vendor/model assets must be on the approved register (policy).
  if (a.assetType === "model" || a.assetType === "vendor_service" || a.modelProvider || a.externalVendor) {
    out.push({
      id: "approved-tool",
      gov: "GOV 04",
      label: "Provider covered by the active approved-tools policy",
      status: "procedural",
      detail: "Evidenced by the program's active approved-AI-tools policy version.",
    });
  }

  if (rank >= 1) {
    // Elevated and above.
    field("intended-use", "GOV 06", "Intended use written down", has(a.intendedUse));
    field("technical-owner", "GOV 06", "Technical owner named", has(a.technicalOwnerName));
    out.push({
      id: "change-procedure",
      gov: "GOV 05",
      label: "Model/provider changes follow the change procedure (sample test, approval, spot check)",
      status: "procedural",
    });
  }

  if (rank >= 2) {
    // High.
    field(
      "oversight-strength",
      "GOV 01",
      "A person is in or on the loop (not out of the loop)",
      a.humanOversightMode === "human_in_the_loop" || a.humanOversightMode === "human_on_the_loop",
    );
    field("prohibited-uses", "GOV 06", "Prohibited uses listed", a.prohibitedUses.length > 0);
    out.push({
      id: "go-live-decision",
      gov: "GOV 01",
      label: "Go-live approved by a senior leader as a recorded decision",
      status: "pending",
      detail: "Decision records arrive in G3; until then the named approver and the lifecycle reason are the record.",
    });
    out.push({
      id: "incident-path",
      gov: "GOV 07",
      label: "Incident path known (stop, record, notify, remediate)",
      status: "procedural",
    });
  }

  return out;
}

export function controlSummary(controls: RequiredControl[]) {
  return {
    met: controls.filter((c) => c.status === "met").length,
    missing: controls.filter((c) => c.status === "missing").length,
    procedural: controls.filter((c) => c.status === "procedural").length,
    pending: controls.filter((c) => c.status === "pending").length,
  };
}

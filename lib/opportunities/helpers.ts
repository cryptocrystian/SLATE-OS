import type {
  EvidenceStrength,
  OpportunityCategory,
  OpportunityPriority,
  OpportunityQuadrant,
} from "./types";

export const PRIORITY_LABEL: Record<OpportunityPriority, string> = {
  "quick-win": "Quick Win",
  "strategic-build": "Strategic Build",
  "low-priority": "Low Priority",
  defer: "Defer",
  avoid: "Avoid",
};

export const PRIORITY_TONE: Record<
  OpportunityPriority,
  "success" | "info" | "warning" | "neutral" | "risk" | "brand"
> = {
  "quick-win": "success",
  "strategic-build": "brand",
  "low-priority": "neutral",
  defer: "warning",
  avoid: "risk",
};

export const QUADRANT_LABEL: Record<OpportunityQuadrant, string> = {
  "quick-win": "Quick Wins",
  "strategic-build": "Strategic Builds",
  "low-priority": "Low Priority",
  "defer-avoid": "Defer · Avoid",
};

export const QUADRANT_DESCRIPTION: Record<OpportunityQuadrant, string> = {
  "quick-win": "High impact · low complexity. Move on these first.",
  "strategic-build":
    "High impact · high complexity. Worth scoping for a multi-phase build.",
  "low-priority":
    "Low impact · low complexity. Useful but not urgent.",
  "defer-avoid":
    "Low impact · high complexity. Recommend deferring or declining.",
};

export const QUADRANT_TONE: Record<
  OpportunityQuadrant,
  "success" | "brand" | "neutral" | "risk"
> = {
  "quick-win": "success",
  "strategic-build": "brand",
  "low-priority": "neutral",
  "defer-avoid": "risk",
};

export const EVIDENCE_LABEL: Record<EvidenceStrength, string> = {
  strong: "Strong evidence",
  adequate: "Adequate evidence",
  thin: "Thin evidence",
};

export const EVIDENCE_TONE: Record<
  EvidenceStrength,
  "success" | "info" | "warning"
> = {
  strong: "success",
  adequate: "info",
  thin: "warning",
};

export const CATEGORY_TONE: Record<
  OpportunityCategory,
  "info" | "warning" | "neutral" | "brand" | "ai" | "success"
> = {
  "Sales / Revenue Operations": "success",
  "Client Intake / Onboarding": "info",
  "Proposal / Document Generation": "brand",
  "Customer Support / Triage": "ai",
  "Internal Knowledge / Retrieval": "info",
  "Reporting / Analytics": "info",
  "Back-office Automation": "warning",
  "Systems Integration": "neutral",
  "Governance / Risk Controls": "warning",
};

const HIGH_IMPACT = 70;
const HIGH_COMPLEXITY = 60;

export function computeQuadrant(
  impact: number,
  complexity: number,
): OpportunityQuadrant {
  const highImpact = impact >= HIGH_IMPACT;
  const highComplexity = complexity >= HIGH_COMPLEXITY;
  if (highImpact && !highComplexity) return "quick-win";
  if (highImpact && highComplexity) return "strategic-build";
  if (!highImpact && !highComplexity) return "low-priority";
  return "defer-avoid";
}

export type OpportunityFilterId =
  | "all"
  | "quick-win"
  | "strategic-build"
  | "low-priority"
  | "defer-avoid";

export const OPPORTUNITY_FILTERS: Array<{
  id: OpportunityFilterId;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "quick-win", label: "Quick Wins" },
  { id: "strategic-build", label: "Strategic Builds" },
  { id: "low-priority", label: "Low Priority" },
  { id: "defer-avoid", label: "Defer · Avoid" },
];

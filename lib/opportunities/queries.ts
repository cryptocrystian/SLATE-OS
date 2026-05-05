import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isUuid,
  mapOpportunityRow,
  type DbOpportunityFindingLinkRow,
  type DbOpportunityRow,
  type OpportunityStatus,
} from "./mappers";
import type { Opportunity } from "./types";
import type { Finding } from "@/lib/findings/types";

/**
 * Server-only query layer for persisted opportunities.
 *
 * Uses the authenticated server Supabase client so RLS is the boundary,
 * not application code.
 */

const OPPORTUNITY_SELECT = `
  id,
  workspace_id,
  engagement_id,
  title,
  category,
  description,
  priority,
  quadrant,
  business_impact_score,
  complexity_score,
  risk_score,
  time_to_value_score,
  adoption_likelihood_score,
  strategic_value_score,
  evidence_strength,
  source_summary,
  recommended_action,
  implementation_shape,
  dependencies,
  risks,
  success_signals,
  status,
  position,
  created_at,
  updated_at
` as const;

const LINK_SELECT = `
  id,
  workspace_id,
  engagement_id,
  opportunity_id,
  finding_id,
  strength,
  created_at
` as const;

export interface OpportunityStatusSummary {
  total: number;
  quickWins: number;
  strategicBuilds: number;
  lowPriority: number;
  deferAvoid: number;
  selected: number;
  deferred: number;
  rejected: number;
  draft: number;
  scored: number;
  strongEvidence: number;
  averageImpact: number;
}

export async function getOpportunitiesForEngagementPersisted(
  engagementId: string,
): Promise<Opportunity[]> {
  if (!isUuid(engagementId)) return [];
  const supabase = createSupabaseServerClient();
  const { data: rows, error } = await supabase
    .from("opportunities")
    .select(OPPORTUNITY_SELECT)
    .eq("engagement_id", engagementId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[opportunities.queries] list-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const opportunityRows = (rows as unknown as DbOpportunityRow[]) ?? [];
  if (opportunityRows.length === 0) return [];

  const opportunityIds = opportunityRows.map((r) => r.id);
  const { data: links } = await supabase
    .from("opportunity_finding_links")
    .select(LINK_SELECT)
    .in("opportunity_id", opportunityIds);
  const linkRows = (links as unknown as DbOpportunityFindingLinkRow[]) ?? [];

  return opportunityRows.map((row) => mapOpportunityRow(row, linkRows));
}

export async function getOpportunityStatusSummary(
  engagementId: string,
): Promise<OpportunityStatusSummary | null> {
  if (!isUuid(engagementId)) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("opportunities")
    .select(
      "quadrant, status, evidence_strength, business_impact_score",
    )
    .eq("engagement_id", engagementId);
  if (error) {
    console.error("[opportunities.queries] status-summary-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return null;
  }
  const rows =
    (data as unknown as Array<{
      quadrant: string | null;
      status: string | null;
      evidence_strength: string | null;
      business_impact_score: number | null;
    }>) ?? [];

  let quickWins = 0;
  let strategicBuilds = 0;
  let lowPriority = 0;
  let deferAvoid = 0;
  let selected = 0;
  let deferred = 0;
  let rejected = 0;
  let draft = 0;
  let scored = 0;
  let strongEvidence = 0;
  let impactSum = 0;

  for (const r of rows) {
    switch (r.quadrant) {
      case "quick_win":
        quickWins += 1;
        break;
      case "strategic_build":
        strategicBuilds += 1;
        break;
      case "low_priority":
        lowPriority += 1;
        break;
      case "defer_avoid":
      case "defer":
      case "avoid":
        deferAvoid += 1;
        break;
      default:
        break;
    }
    switch (r.status) {
      case "selected":
        selected += 1;
        break;
      case "deferred":
        deferred += 1;
        break;
      case "rejected":
        rejected += 1;
        break;
      case "scored":
        scored += 1;
        break;
      case "draft":
      default:
        draft += 1;
        break;
    }
    if (r.evidence_strength === "strong") strongEvidence += 1;
    if (typeof r.business_impact_score === "number") {
      impactSum += r.business_impact_score;
    }
  }

  return {
    total: rows.length,
    quickWins,
    strategicBuilds,
    lowPriority,
    deferAvoid,
    selected,
    deferred,
    rejected,
    draft,
    scored,
    strongEvidence,
    averageImpact:
      rows.length === 0 ? 0 : Math.round(impactSum / rows.length),
  };
}

// ---------------------------------------------------------------------------
// Finding candidates — approved/report-ready findings used to seed
// opportunity evidence.
// ---------------------------------------------------------------------------

export interface FindingCandidate {
  id: string;
  statement: string;
  category: string;
  reviewStatus: string;
  evidenceStrength: "strong" | "adequate" | "thin";
}

export async function getFindingCandidatesForEngagement(
  engagementId: string,
): Promise<FindingCandidate[]> {
  if (!isUuid(engagementId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("findings")
    .select("id, statement, category, review_status, confidence")
    .eq("engagement_id", engagementId)
    .in("review_status", ["approved", "report_ready"])
    .order("position", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    console.error("[opportunities.queries] finding-candidates-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  return (
    (data as unknown as Array<{
      id: string;
      statement: string;
      category: string | null;
      review_status: string | null;
      confidence: string | null;
    }>) ?? []
  ).map((row) => ({
    id: row.id,
    statement: row.statement,
    category: humanizeCategory(row.category),
    reviewStatus: humanizeReviewStatus(row.review_status),
    evidenceStrength: confidenceToStrength(row.confidence),
  }));
}

// Status helpers re-exported for convenience.
export type { OpportunityStatus } from "./mappers";

// ---------------------------------------------------------------------------
// Findings shaped for the visual workspace — minimal Finding objects so
// `OpportunitiesWorkspace` can render the related-findings panel.
// ---------------------------------------------------------------------------

export async function getMinimalFindingsForEngagement(
  engagementId: string,
): Promise<Finding[]> {
  if (!isUuid(engagementId)) return [];
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("findings")
    .select(
      "id, engagement_id, statement, summary, evidence_summary, category, confidence, review_status, suggested_impact",
    )
    .eq("engagement_id", engagementId);
  if (error) return [];
  return (
    (data as unknown as Array<{
      id: string;
      engagement_id: string;
      statement: string;
      summary: string | null;
      evidence_summary: string | null;
      category: string | null;
      confidence: string | null;
      review_status: string | null;
      suggested_impact: string | null;
    }>) ?? []
  ).map<Finding>((row) => ({
    id: row.id,
    engagementId: row.engagement_id,
    statement: row.statement,
    summary: row.summary ?? "",
    evidenceSummary: row.evidence_summary ?? "",
    category: humanizeFindingCategory(row.category),
    confidence: humanizeConfidence(row.confidence),
    reviewStatus: humanizeFindingReviewStatus(row.review_status),
    suggestedImpact: row.suggested_impact ?? "",
    sourceRefs: [],
  }));
}

function humanizeCategory(value: string | null): string {
  if (!value) return "Uncategorized";
  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function humanizeReviewStatus(value: string | null): string {
  if (!value) return "Needs review";
  return value.replace(/_/g, " ");
}

function confidenceToStrength(
  value: string | null,
): "strong" | "adequate" | "thin" {
  if (value === "high") return "strong";
  if (value === "medium") return "adequate";
  return "thin";
}

function humanizeFindingCategory(
  value: string | null,
): Finding["category"] {
  switch (value) {
    case "workflow_friction":
      return "Workflow Friction";
    case "systems_gap":
      return "Systems Gap";
    case "data_readiness":
      return "Data Readiness";
    case "adoption_risk":
      return "Adoption Risk";
    case "governance_risk":
      return "Governance / Risk";
    case "revenue_opportunity":
      return "Revenue Opportunity";
    case "back_office_efficiency":
      return "Back-office Efficiency";
    case "customer_experience":
      return "Customer Experience";
    default:
      return "Workflow Friction";
  }
}

function humanizeConfidence(value: string | null): Finding["confidence"] {
  switch (value) {
    case "high":
      return "high";
    case "medium":
      return "medium";
    case "low":
      return "low";
    case "needs_evidence":
    default:
      return "needs-evidence";
  }
}

function humanizeFindingReviewStatus(
  value: string | null,
): Finding["reviewStatus"] {
  switch (value) {
    case "draft":
      return "draft";
    case "approved":
      return "approved";
    case "edited":
      return "edited";
    case "rejected":
      return "rejected";
    case "report_ready":
      return "report-ready";
    case "needs_review":
    default:
      return "needs-review";
  }
}

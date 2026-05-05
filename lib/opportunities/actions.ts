"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { logActivityEvent } from "@/lib/activity/log";
import type { ActivityEventType } from "@/lib/activity/types";
import {
  dbPriorityFor,
  dbQuadrantFor,
  isUuid,
  type OpportunityStatus,
} from "./mappers";
import { computeQuadrant } from "./helpers";
import type {
  EvidenceStrength,
  OpportunityCategory,
  OpportunityPriority,
  OpportunityQuadrant,
} from "./types";

/**
 * Authenticated-operator server actions for opportunities. Every action
 * runs against the cookie-bound server Supabase client so RLS evaluates
 * with the operator's auth.uid().
 */

const VALID_CATEGORIES: OpportunityCategory[] = [
  "Sales / Revenue Operations",
  "Client Intake / Onboarding",
  "Proposal / Document Generation",
  "Customer Support / Triage",
  "Internal Knowledge / Retrieval",
  "Reporting / Analytics",
  "Back-office Automation",
  "Systems Integration",
  "Governance / Risk Controls",
];

const VALID_EVIDENCE: EvidenceStrength[] = ["strong", "adequate", "thin"];

export interface CreateOpportunityInput {
  engagementId: string;
  title: string;
  category: OpportunityCategory;
  description?: string;
  businessImpactScore: number;
  complexityScore: number;
  riskScore: number;
  timeToValueScore: number;
  adoptionLikelihoodScore: number;
  strategicValueScore: number;
  evidenceStrength: EvidenceStrength;
  sourceSummary?: string;
  recommendedAction?: string;
  implementationShape?: string;
  dependencies?: string[];
  risks?: string[];
  successSignals?: string[];
  findingIds?: string[];
}

export type OpportunityActionResult =
  | { ok: true }
  | {
      ok: false;
      error:
        | "unauthenticated"
        | "invalid-engagement"
        | "invalid-opportunity"
        | "missing-fields"
        | "invalid-category"
        | "invalid-evidence"
        | "invalid-score"
        | "engagement-not-found"
        | "opportunity-not-found"
        | "service-error";
    };

export type CreateOpportunityResult =
  | { ok: true; opportunityId: string }
  | (Exclude<OpportunityActionResult, { ok: true }> & { ok: false });

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export async function createOpportunity(
  input: CreateOpportunityInput,
): Promise<CreateOpportunityResult> {
  if (!isUuid(input.engagementId)) {
    return { ok: false, error: "invalid-engagement" };
  }
  const title = input.title.trim();
  if (!title) return { ok: false, error: "missing-fields" };
  if (!VALID_CATEGORIES.includes(input.category)) {
    return { ok: false, error: "invalid-category" };
  }
  if (!VALID_EVIDENCE.includes(input.evidenceStrength)) {
    return { ok: false, error: "invalid-evidence" };
  }

  const scores = {
    business: clampScore(input.businessImpactScore),
    complexity: clampScore(input.complexityScore),
    risk: clampScore(input.riskScore),
    ttv: clampScore(input.timeToValueScore),
    adoption: clampScore(input.adoptionLikelihoodScore),
    strategic: clampScore(input.strategicValueScore),
  };
  if (Object.values(scores).some((s) => s === null)) {
    return { ok: false, error: "invalid-score" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: engagement, error: engagementError } = await supabase
    .from("engagements")
    .select("id, workspace_id")
    .eq("id", input.engagementId)
    .maybeSingle<{ id: string; workspace_id: string }>();
  if (engagementError) {
    console.error("[opportunities.actions] engagement-lookup-failed", {
      name: engagementError.name,
      code: engagementError.code,
      message: engagementError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!engagement?.id) return { ok: false, error: "engagement-not-found" };

  const quadrant = pickQuadrant(scores.business!, scores.complexity!, scores.risk!);
  const priority = priorityFromQuadrant(quadrant);

  const { data: inserted, error: insertError } = await supabase
    .from("opportunities")
    .insert({
      workspace_id: engagement.workspace_id,
      engagement_id: engagement.id,
      title,
      category: input.category,
      description: trimOrNull(input.description),
      priority: dbPriorityFor(priority),
      quadrant: dbQuadrantFor(quadrant),
      business_impact_score: scores.business,
      complexity_score: scores.complexity,
      risk_score: scores.risk,
      time_to_value_score: scores.ttv,
      adoption_likelihood_score: scores.adoption,
      strategic_value_score: scores.strategic,
      evidence_strength: input.evidenceStrength,
      source_summary: trimOrNull(input.sourceSummary),
      recommended_action: trimOrNull(input.recommendedAction),
      implementation_shape: trimOrNull(input.implementationShape),
      dependencies: cleanArray(input.dependencies),
      risks: cleanArray(input.risks),
      success_signals: cleanArray(input.successSignals),
      status: "scored",
    })
    .select("id")
    .single<{ id: string }>();
  if (insertError || !inserted?.id) {
    console.error("[opportunities.actions] insert-failed", {
      name: insertError?.name,
      code: insertError?.code,
      message: insertError?.message,
    });
    return { ok: false, error: "service-error" };
  }

  const findingIds = (input.findingIds ?? []).filter((id) => isUuid(id));
  if (findingIds.length > 0) {
    const linkRows = findingIds.map((findingId) => ({
      workspace_id: engagement.workspace_id,
      engagement_id: engagement.id,
      opportunity_id: inserted.id,
      finding_id: findingId,
      strength: input.evidenceStrength,
    }));
    const { error: linksError } = await supabase
      .from("opportunity_finding_links")
      .insert(linkRows);
    if (linksError) {
      console.error("[opportunities.actions] links-insert-failed", {
        name: linksError.name,
        code: linksError.code,
        message: linksError.message,
      });
      // Non-fatal — opportunity exists; links can be added later.
    }
  }

  await bumpEngagement(supabase, engagement.id);
  revalidatePaths(engagement.id);

  await logActivityEvent({
    eventType: "opportunity_created",
    entityType: "opportunity",
    entityId: inserted.id,
    engagementId: engagement.id,
    title: "Opportunity scored",
    summary: "An operator scored a new opportunity from approved findings.",
    metadata: {
      category: input.category,
      quadrant,
      priority,
      evidenceStrength: input.evidenceStrength,
      findingLinkCount: findingIds.length,
    },
  });

  return { ok: true, opportunityId: inserted.id };
}

// ---------------------------------------------------------------------------
// Update scores
// ---------------------------------------------------------------------------

export interface UpdateOpportunityScoresInput {
  opportunityId: string;
  businessImpactScore?: number;
  complexityScore?: number;
  riskScore?: number;
  timeToValueScore?: number;
  adoptionLikelihoodScore?: number;
  strategicValueScore?: number;
  evidenceStrength?: EvidenceStrength;
}

export async function updateOpportunityScores(
  input: UpdateOpportunityScoresInput,
): Promise<OpportunityActionResult> {
  if (!isUuid(input.opportunityId)) {
    return { ok: false, error: "invalid-opportunity" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("opportunities")
    .select(
      "id, engagement_id, business_impact_score, complexity_score, risk_score",
    )
    .eq("id", input.opportunityId)
    .maybeSingle<{
      id: string;
      engagement_id: string;
      business_impact_score: number | null;
      complexity_score: number | null;
      risk_score: number | null;
    }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "opportunity-not-found" };
  }

  const update: Record<string, unknown> = {
    last_reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
  };
  let businessScore = existing.business_impact_score ?? 50;
  let complexityScore = existing.complexity_score ?? 50;
  let riskScore = existing.risk_score ?? 50;

  if (input.businessImpactScore !== undefined) {
    const v = clampScore(input.businessImpactScore);
    if (v === null) return { ok: false, error: "invalid-score" };
    update.business_impact_score = v;
    businessScore = v;
  }
  if (input.complexityScore !== undefined) {
    const v = clampScore(input.complexityScore);
    if (v === null) return { ok: false, error: "invalid-score" };
    update.complexity_score = v;
    complexityScore = v;
  }
  if (input.riskScore !== undefined) {
    const v = clampScore(input.riskScore);
    if (v === null) return { ok: false, error: "invalid-score" };
    update.risk_score = v;
    riskScore = v;
  }
  if (input.timeToValueScore !== undefined) {
    const v = clampScore(input.timeToValueScore);
    if (v === null) return { ok: false, error: "invalid-score" };
    update.time_to_value_score = v;
  }
  if (input.adoptionLikelihoodScore !== undefined) {
    const v = clampScore(input.adoptionLikelihoodScore);
    if (v === null) return { ok: false, error: "invalid-score" };
    update.adoption_likelihood_score = v;
  }
  if (input.strategicValueScore !== undefined) {
    const v = clampScore(input.strategicValueScore);
    if (v === null) return { ok: false, error: "invalid-score" };
    update.strategic_value_score = v;
  }
  if (input.evidenceStrength) {
    if (!VALID_EVIDENCE.includes(input.evidenceStrength)) {
      return { ok: false, error: "invalid-evidence" };
    }
    update.evidence_strength = input.evidenceStrength;
  }

  const quadrant = pickQuadrant(businessScore, complexityScore, riskScore);
  update.quadrant = dbQuadrantFor(quadrant);
  update.priority = dbPriorityFor(priorityFromQuadrant(quadrant));
  update.status = "scored";

  const { error: updateError } = await supabase
    .from("opportunities")
    .update(update)
    .eq("id", input.opportunityId);
  if (updateError) {
    console.error("[opportunities.actions] update-scores-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await bumpEngagement(supabase, existing.engagement_id);
  revalidatePaths(existing.engagement_id);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Status changes
// ---------------------------------------------------------------------------

async function setStatus(
  opportunityId: string,
  status: OpportunityStatus,
): Promise<OpportunityActionResult> {
  if (!isUuid(opportunityId)) {
    return { ok: false, error: "invalid-opportunity" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  const { data: existing, error: existingError } = await supabase
    .from("opportunities")
    .select("id, engagement_id")
    .eq("id", opportunityId)
    .maybeSingle<{ id: string; engagement_id: string }>();
  if (existingError || !existing?.id) {
    return { ok: false, error: "opportunity-not-found" };
  }

  const { error: updateError } = await supabase
    .from("opportunities")
    .update({
      status,
      reviewed_by: user.id,
      last_reviewed_at: new Date().toISOString(),
    })
    .eq("id", opportunityId);
  if (updateError) {
    console.error("[opportunities.actions] status-update-failed", {
      name: updateError.name,
      code: updateError.code,
      message: updateError.message,
    });
    return { ok: false, error: "service-error" };
  }

  await bumpEngagement(supabase, existing.engagement_id);
  revalidatePaths(existing.engagement_id);

  const eventType = STATUS_EVENT_TYPE[status];
  if (eventType) {
    await logActivityEvent({
      eventType,
      entityType: "opportunity",
      entityId: existing.id,
      engagementId: existing.engagement_id,
      title: STATUS_EVENT_TITLE[status],
      summary: STATUS_EVENT_SUMMARY[status],
      metadata: { status },
    });
  }
  return { ok: true };
}

const STATUS_EVENT_TYPE: Partial<Record<OpportunityStatus, ActivityEventType>> = {
  selected: "opportunity_selected",
  deferred: "opportunity_deferred",
  rejected: "opportunity_rejected",
};

const STATUS_EVENT_TITLE: Record<OpportunityStatus, string> = {
  draft: "Opportunity moved to draft",
  scored: "Opportunity scoring updated",
  selected: "Opportunity selected",
  deferred: "Opportunity deferred",
  rejected: "Opportunity rejected",
};

const STATUS_EVENT_SUMMARY: Record<OpportunityStatus, string> = {
  draft: "An operator moved an opportunity back to draft.",
  scored: "An operator updated opportunity scoring.",
  selected: "An operator promoted an opportunity into the roadmap candidate list.",
  deferred: "An operator deferred an opportunity for a future engagement.",
  rejected: "An operator rejected an opportunity.",
};

export async function markOpportunitySelected(
  opportunityId: string,
): Promise<OpportunityActionResult> {
  return setStatus(opportunityId, "selected");
}

export async function deferOpportunity(
  opportunityId: string,
): Promise<OpportunityActionResult> {
  return setStatus(opportunityId, "deferred");
}

export async function rejectOpportunity(
  opportunityId: string,
): Promise<OpportunityActionResult> {
  return setStatus(opportunityId, "rejected");
}

export async function reopenOpportunity(
  opportunityId: string,
): Promise<OpportunityActionResult> {
  return setStatus(opportunityId, "scored");
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function pickQuadrant(
  impact: number,
  complexity: number,
  risk: number,
): OpportunityQuadrant {
  if (risk >= 85) return "defer-avoid";
  return computeQuadrant(impact, complexity);
}

function priorityFromQuadrant(
  quadrant: OpportunityQuadrant,
): OpportunityPriority {
  switch (quadrant) {
    case "quick-win":
      return "quick-win";
    case "strategic-build":
      return "strategic-build";
    case "low-priority":
      return "low-priority";
    case "defer-avoid":
      return "defer";
    default:
      return "low-priority";
  }
}

function clampScore(v: number | undefined): number | null {
  if (typeof v !== "number" || !Number.isFinite(v)) return null;
  return Math.max(0, Math.min(100, Math.round(v)));
}

function trimOrNull(v: string | null | undefined): string | null {
  if (!v) return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function cleanArray(v: string[] | undefined): string[] {
  if (!v) return [];
  return v.map((s) => s.trim()).filter((s) => s.length > 0);
}

async function bumpEngagement(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
) {
  await supabase
    .from("engagements")
    .update({ last_activity_at: new Date().toISOString() })
    .eq("id", engagementId);
}

function revalidatePaths(engagementId: string) {
  revalidatePath(`/app/engagements/${engagementId}/opportunities`);
  revalidatePath(`/app/engagements/${engagementId}/roadmap`);
  revalidatePath(`/app/engagements/${engagementId}`);
}

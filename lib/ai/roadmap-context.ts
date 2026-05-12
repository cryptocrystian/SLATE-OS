import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-only roadmap synthesis context builder — AI Synthesis Step 5.
 *
 * Mirrors the boundary in `report-section-context.ts` and
 * `proposal-option-context.ts`:
 *
 *   - Only consultant-reviewed findings (approved + report-ready) and
 *     scored/selected opportunities reach the model.
 *   - Existing roadmap items are passed through verbatim so the
 *     synthesizer can avoid duplicating their titles and can refer to
 *     them as already-sequenced work.
 *   - Operator-touched report sections surface only `summary` +
 *     `draftPreview` + status + slot.
 *   - Proposal options surface scope / timeline framing only —
 *     pricing is read-only context, never an input the model can use
 *     as a generative driver.
 *   - Stakeholder PII never reaches the model.
 *   - Uploaded files remain metadata-only.
 *   - Internal Saipien Fit Score is omitted.
 *
 * The output is consumed by `lib/ai/roadmap-synthesis.ts` and is never
 * logged in raw form or persisted on the synthesis-run row.
 */

export type RoadmapContextLoadError =
  | "unauthenticated"
  | "engagement-not-found"
  | "service-error";

export interface RoadmapSynthesisContext {
  engagement: {
    id: string;
    name: string;
    engagementType: string;
    industry: string | null;
    targetDate: string | null;
    nextMilestone: string | null;
    riskNotes: string[];
    dependencies: string[];
  };
  account: {
    name: string;
    industry: string | null;
    employeeRange: string | null;
    revenueRange: string | null;
  } | null;
  /** Approved / report-ready findings only. */
  findings: Array<{
    findingId: string;
    statement: string;
    summary: string | null;
    category: string | null;
    confidence: string | null;
    suggestedImpact: string | null;
  }>;
  /** Scored / selected opportunities — drafts and rejected dropped. */
  opportunities: Array<{
    opportunityId: string;
    title: string;
    description: string | null;
    category: string | null;
    quadrant: string | null;
    priority: string | null;
    status: string | null;
    businessImpactScore: number | null;
    complexityScore: number | null;
    riskScore: number | null;
    evidenceStrength: string | null;
  }>;
  /** Existing roadmap items — DB phase / priority enums verbatim. */
  existingRoadmap: Array<{
    roadmapItemId: string;
    title: string;
    phase: string;
    priority: string;
    status: string;
    objective: string | null;
    linkedOpportunityId: string | null;
    keyActions: string[];
    dependencies: string[];
    successCriteria: string[];
    risks: string[];
  }>;
  /** Report-section summaries — operator-touched only. */
  reportSections: Array<{
    sectionId: string;
    sectionType: string;
    title: string;
    status: string;
    summary: string | null;
    draftPreview: string | null;
    exhibitSlot: string | null;
  }>;
  /** Proposal options — scope / timeline only. Pricing is read-only context. */
  proposalOptions: Array<{
    optionId: string;
    optionType: string;
    title: string;
    recommended: boolean;
    bestFitScenario: string | null;
    scopeSummary: string | null;
    timeline: string | null;
    /** Pricing copy is included as READ-ONLY context, never as an input the model can edit. */
    pricingPlaceholder: string | null;
  }>;
}

export interface RoadmapContextLoadResult {
  ok: true;
  context: RoadmapSynthesisContext;
}

export interface RoadmapContextLoadFailure {
  ok: false;
  error: RoadmapContextLoadError;
}

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

const MAX_FINDINGS = 20;
const MAX_OPPORTUNITIES = 20;
const MAX_EXISTING_ROADMAP_ITEMS = 30;
const MAX_REPORT_SECTIONS = 12;
const MAX_PROPOSAL_OPTIONS = 6;

const STATEMENT_LIMIT = 280;
const SUMMARY_LIMIT = 360;
const TITLE_LIMIT = 200;
const SUGGESTED_IMPACT_LIMIT = 320;
const ARRAY_ITEM_LIMIT = 200;
const MAX_ARRAY_ITEMS = 6;
const SECTION_PREVIEW_LIMIT = 800;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ELIGIBLE_FINDING_STATUSES = ["approved", "report_ready"];
const ELIGIBLE_OPPORTUNITY_STATUSES = ["scored", "selected"];
const ELIGIBLE_REPORT_SECTION_STATUSES = new Set([
  "drafted",
  "needs_review",
  "approved",
  "final",
]);

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

export async function buildRoadmapSynthesisContext(args: {
  engagementId: string;
}): Promise<RoadmapContextLoadResult | RoadmapContextLoadFailure> {
  const { engagementId } = args;
  if (!UUID_RE.test(engagementId)) {
    return { ok: false, error: "engagement-not-found" };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

  // --- Engagement + account ------------------------------------------------
  const { data: engagementRow, error: engagementError } = await supabase
    .from("engagements")
    .select(
      `
      id,
      name,
      engagement_type,
      target_date,
      next_milestone,
      risk_notes,
      dependencies,
      account_id,
      accounts:account_id ( name, industry, employee_range, revenue_range )
    `,
    )
    .eq("id", engagementId)
    .maybeSingle();
  if (engagementError) {
    console.error("[ai.roadmap-context] engagement-lookup-failed", {
      name: engagementError.name,
      code: engagementError.code,
      message: engagementError.message,
    });
    return { ok: false, error: "service-error" };
  }
  if (!engagementRow) {
    return { ok: false, error: "engagement-not-found" };
  }
  const eng = engagementRow as unknown as {
    id: string;
    name: string;
    engagement_type: string | null;
    target_date: string | null;
    next_milestone: string | null;
    risk_notes: string[] | null;
    dependencies: string[] | null;
    accounts: {
      name: string | null;
      industry: string | null;
      employee_range: string | null;
      revenue_range: string | null;
    } | null;
  };

  const [
    findings,
    opportunities,
    existingRoadmap,
    reportSections,
    proposalOptions,
  ] = await Promise.all([
    loadEligibleFindings(supabase, engagementId),
    loadEligibleOpportunities(supabase, engagementId),
    loadExistingRoadmap(supabase, engagementId),
    loadReportSections(supabase, engagementId),
    loadProposalOptions(supabase, engagementId),
  ]);

  return {
    ok: true,
    context: {
      engagement: {
        id: eng.id,
        name: eng.name,
        engagementType: eng.engagement_type ?? "ai_opportunity_sprint",
        industry: eng.accounts?.industry ?? null,
        targetDate: eng.target_date ?? null,
        nextMilestone: eng.next_milestone?.trim() || null,
        riskNotes: cleanStringArray(eng.risk_notes),
        dependencies: cleanStringArray(eng.dependencies),
      },
      account: eng.accounts
        ? {
            name: eng.accounts.name?.trim() || "Unknown account",
            industry: eng.accounts.industry?.trim() || null,
            employeeRange: eng.accounts.employee_range?.trim() || null,
            revenueRange: eng.accounts.revenue_range?.trim() || null,
          }
        : null,
      findings,
      opportunities,
      existingRoadmap,
      reportSections,
      proposalOptions,
    },
  };
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

async function loadEligibleFindings(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<RoadmapSynthesisContext["findings"]> {
  const { data, error } = await supabase
    .from("findings")
    .select(
      "id, statement, summary, category, confidence, review_status, suggested_impact, position, created_at",
    )
    .eq("engagement_id", engagementId)
    .in("review_status", ELIGIBLE_FINDING_STATUSES)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(MAX_FINDINGS * 2);
  if (error) {
    console.error("[ai.roadmap-context] findings-lookup-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows =
    (data as unknown as Array<{
      id: string;
      statement: string;
      summary: string | null;
      category: string | null;
      confidence: string | null;
      suggested_impact: string | null;
    }>) ?? [];
  return rows.slice(0, MAX_FINDINGS).map((r) => ({
    findingId: r.id,
    statement: clipString(r.statement, STATEMENT_LIMIT) ?? r.statement,
    summary: clipString(r.summary, SUMMARY_LIMIT),
    category: r.category,
    confidence: r.confidence,
    suggestedImpact: clipString(r.suggested_impact, SUGGESTED_IMPACT_LIMIT),
  }));
}

async function loadEligibleOpportunities(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<RoadmapSynthesisContext["opportunities"]> {
  const { data, error } = await supabase
    .from("opportunities")
    .select(
      "id, title, description, category, quadrant, priority, status, business_impact_score, complexity_score, risk_score, evidence_strength, position, created_at",
    )
    .eq("engagement_id", engagementId)
    .in("status", ELIGIBLE_OPPORTUNITY_STATUSES)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(MAX_OPPORTUNITIES * 2);
  if (error) {
    console.error("[ai.roadmap-context] opportunities-lookup-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows =
    (data as unknown as Array<{
      id: string;
      title: string;
      description: string | null;
      category: string | null;
      quadrant: string | null;
      priority: string | null;
      status: string | null;
      business_impact_score: number | null;
      complexity_score: number | null;
      risk_score: number | null;
      evidence_strength: string | null;
    }>) ?? [];
  return rows.slice(0, MAX_OPPORTUNITIES).map((o) => ({
    opportunityId: o.id,
    title: clipString(o.title, TITLE_LIMIT) ?? o.title,
    description: clipString(o.description, SUMMARY_LIMIT),
    category: o.category,
    quadrant: o.quadrant,
    priority: o.priority,
    status: o.status,
    businessImpactScore: o.business_impact_score,
    complexityScore: o.complexity_score,
    riskScore: o.risk_score,
    evidenceStrength: o.evidence_strength,
  }));
}

async function loadExistingRoadmap(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<RoadmapSynthesisContext["existingRoadmap"]> {
  const { data, error } = await supabase
    .from("roadmap_items")
    .select(
      "id, title, phase, priority, status, objective, opportunity_id, key_actions, dependencies, success_criteria, risks, position, created_at",
    )
    .eq("engagement_id", engagementId)
    .order("phase", { ascending: true })
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(MAX_EXISTING_ROADMAP_ITEMS);
  if (error) {
    console.error("[ai.roadmap-context] roadmap-lookup-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows =
    (data as unknown as Array<{
      id: string;
      title: string;
      phase: string | null;
      priority: string | null;
      status: string | null;
      objective: string | null;
      opportunity_id: string | null;
      key_actions: string[] | null;
      dependencies: string[] | null;
      success_criteria: string[] | null;
      risks: string[] | null;
    }>) ?? [];
  return rows.map((r) => ({
    roadmapItemId: r.id,
    title: clipString(r.title, TITLE_LIMIT) ?? r.title,
    phase: r.phase ?? "first_30",
    priority: r.priority ?? "low_priority",
    status: r.status ?? "planned",
    objective: clipString(r.objective, SUMMARY_LIMIT),
    linkedOpportunityId: r.opportunity_id,
    keyActions: clipArrayLimitedTo(r.key_actions),
    dependencies: clipArrayLimitedTo(r.dependencies),
    successCriteria: clipArrayLimitedTo(r.success_criteria),
    risks: clipArrayLimitedTo(r.risks),
  }));
}

async function loadReportSections(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<RoadmapSynthesisContext["reportSections"]> {
  const { data, error } = await supabase
    .from("report_sections")
    .select(
      "id, section_type, title, status, summary, draft_preview, exhibit_slot, position, created_at",
    )
    .eq("engagement_id", engagementId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(MAX_REPORT_SECTIONS * 2);
  if (error) {
    console.error("[ai.roadmap-context] report-sections-lookup-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows =
    (data as unknown as Array<{
      id: string;
      section_type: string;
      title: string;
      status: string | null;
      summary: string | null;
      draft_preview: string | null;
      exhibit_slot: string | null;
    }>) ?? [];
  return rows
    .filter((r) =>
      r.status ? ELIGIBLE_REPORT_SECTION_STATUSES.has(r.status) : false,
    )
    .slice(0, MAX_REPORT_SECTIONS)
    .map((r) => ({
      sectionId: r.id,
      sectionType: r.section_type,
      title: r.title,
      status: r.status ?? "drafted",
      summary: clipString(r.summary, SUMMARY_LIMIT),
      draftPreview: clipString(r.draft_preview, SECTION_PREVIEW_LIMIT),
      exhibitSlot: r.exhibit_slot,
    }));
}

async function loadProposalOptions(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<RoadmapSynthesisContext["proposalOptions"]> {
  const { data, error } = await supabase
    .from("proposal_options")
    .select(
      "id, option_type, title, recommended, best_fit_scenario, scope_summary, timeline, pricing_placeholder, position, created_at",
    )
    .eq("engagement_id", engagementId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(MAX_PROPOSAL_OPTIONS);
  if (error) {
    console.error("[ai.roadmap-context] proposal-options-lookup-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows =
    (data as unknown as Array<{
      id: string;
      option_type: string;
      title: string;
      recommended: boolean | null;
      best_fit_scenario: string | null;
      scope_summary: string | null;
      timeline: string | null;
      pricing_placeholder: string | null;
    }>) ?? [];
  return rows.map((o) => ({
    optionId: o.id,
    optionType: o.option_type,
    title: clipString(o.title, TITLE_LIMIT) ?? o.title,
    recommended: Boolean(o.recommended),
    bestFitScenario: clipString(o.best_fit_scenario, SUMMARY_LIMIT),
    scopeSummary: clipString(o.scope_summary, SUMMARY_LIMIT),
    timeline: clipString(o.timeline, ARRAY_ITEM_LIMIT),
    pricingPlaceholder: clipString(o.pricing_placeholder, ARRAY_ITEM_LIMIT),
  }));
}

// ---------------------------------------------------------------------------
// Small string helpers
// ---------------------------------------------------------------------------

function clipString(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.replace(/\s+/g, " ").trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function clipArrayLimitedTo(values: string[] | null | undefined): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const v of values) {
    if (out.length >= MAX_ARRAY_ITEMS) break;
    const clipped = clipString(v, ARRAY_ITEM_LIMIT);
    if (clipped) out.push(clipped);
  }
  return out;
}

function cleanStringArray(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const v of value) {
    if (typeof v !== "string") continue;
    const trimmed = v.trim();
    if (trimmed.length === 0) continue;
    out.push(
      trimmed.length > ARRAY_ITEM_LIMIT
        ? `${trimmed.slice(0, ARRAY_ITEM_LIMIT - 1)}…`
        : trimmed,
    );
    if (out.length >= MAX_ARRAY_ITEMS) break;
  }
  return out;
}

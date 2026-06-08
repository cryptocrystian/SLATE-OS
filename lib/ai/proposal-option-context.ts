import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-only proposal-option synthesis context builder — AI Synthesis
 * Step 4.
 *
 * Mirrors the boundary in `report-section-context.ts`:
 *
 *   - Only consultant-reviewed findings (approved + report-ready)
 *     reach the model. Needs-review/draft/rejected findings are
 *     filtered out.
 *   - Only operator-selected opportunities are surfaced. Sprint S9
 *     tightened this from `["scored", "selected"]` to `["selected"]`
 *     only — `scored` (pre-approval) opportunities no longer leak
 *     into proposal-option synthesis input. Same correctness shape
 *     as the S7/S8 tightenings to roadmap-context and
 *     report-section-context.
 *   - Only `ready` roadmap items reach the model. Sprint S9 added
 *     this allowlist; the prior loader passed every roadmap row
 *     through regardless of status.
 *   - Only `approved` or `final` report sections reach the model.
 *     Sprint S9 tightened the allowlist from
 *     `["drafted", "needs_review", "approved", "final"]` so the
 *     proposal-option AI draft stays consistent with the
 *     operator-blessed report copy and never grounds on
 *     pre-approval section text. Per the S9 spec — "approved report
 *     sections only" — this matches the canonical S8 → S9 contract.
 *   - Stakeholder PII never reaches the model.
 *   - Uploaded files remain metadata-only.
 *   - Internal Saipien Fit Score is omitted.
 *   - The target option's commercial-lever fields (pricing,
 *     recommendation, implementation credit, option type, position)
 *     are surfaced READ-ONLY so the model knows their values but the
 *     prompt forbids changing them.
 *
 * The output is consumed by `lib/ai/proposal-option-synthesis.ts` and
 * is never logged in raw form or persisted on the synthesis-run row.
 */

export type ProposalOptionContextLoadError =
  | "unauthenticated"
  | "engagement-not-found"
  | "proposal-not-found"
  | "option-not-found"
  | "service-error";

export interface ProposalOptionTargetMeta {
  optionId: string;
  proposalId: string;
  optionType: string;
  title: string;
  recommended: boolean;
  bestFitScenario: string | null;
  scopeSummary: string | null;
  timeline: string | null;
  deliverables: string[];
  assumptions: string[];
  dependencies: string[];
  risks: string[];
  /** Operator-set commercial-lever copy — surfaced read-only. */
  pricingPlaceholder: string | null;
  confidence: string;
  position: number;
}

export interface ProposalSiblingOption {
  optionId: string;
  optionType: string;
  title: string;
  recommended: boolean;
  position: number;
}

export interface ProposalOptionSynthesisContext {
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
  /** Read-only proposal context — title / next step / status / credit copy. */
  proposal: {
    proposalId: string;
    title: string;
    status: string;
    nextStep: string | null;
    /** Commercial-lever copy. Read-only — Step 4 NEVER edits these. */
    creditEligible: boolean;
    creditAmountPlaceholder: string | null;
    creditWindow: string | null;
    creditNotes: string | null;
  };
  /** Target option the prompt is drafting. */
  option: ProposalOptionTargetMeta;
  /** Sibling options on the same proposal — id / type / recommendation only. */
  siblingOptions: ProposalSiblingOption[];
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
  /** Persisted roadmap items in canonical order. */
  roadmap: Array<{
    roadmapItemId: string;
    title: string;
    phase: string;
    priority: string;
    objective: string | null;
    keyActions: string[];
    dependencies: string[];
    successCriteria: string[];
    risks: string[];
    linkedOpportunityId: string | null;
  }>;
  /** Report-section summaries — operator-approved or in-draft only. */
  reportSections: Array<{
    sectionId: string;
    sectionType: string;
    title: string;
    status: string;
    summary: string | null;
    draftPreview: string | null;
    exhibitSlot: string | null;
  }>;
}

export interface ProposalOptionContextLoadResult {
  ok: true;
  context: ProposalOptionSynthesisContext;
}

export interface ProposalOptionContextLoadFailure {
  ok: false;
  error: ProposalOptionContextLoadError;
}

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

const MAX_FINDINGS = 20;
const MAX_OPPORTUNITIES = 20;
const MAX_ROADMAP_ITEMS = 30;
const MAX_REPORT_SECTIONS = 12;

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
// Sprint S9 — tightened from `["scored", "selected"]` to `["selected"]`
// only. `scored` is an internal pre-approval state. Same correctness
// shape as the S7 fix to roadmap-context.ts and the S8 fix to
// report-section-context.ts. See docs/51 § 3.
const ELIGIBLE_OPPORTUNITY_STATUSES = ["selected"];
// Sprint S9 — only `ready` roadmap items feed proposal-option
// synthesis. Planned (draft), deferred, rejected, blocked, and
// completed items are excluded.
const ELIGIBLE_ROADMAP_STATUSES = ["ready"];
// Sprint S9 — tightened from
// `["drafted", "needs_review", "approved", "final"]` to
// `["approved", "final"]` only. Per the S8 → S9 contract
// (docs/49 § 7, docs/51 § 3), proposal options are grounded ONLY
// on operator-blessed report copy. Pre-approval section text never
// reaches the proposal-option prompt.
const ELIGIBLE_REPORT_SECTION_STATUSES = new Set([
  "approved",
  "final",
]);

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

export async function buildProposalOptionSynthesisContext(args: {
  engagementId: string;
  optionId: string;
}): Promise<
  ProposalOptionContextLoadResult | ProposalOptionContextLoadFailure
> {
  const { engagementId, optionId } = args;
  if (!UUID_RE.test(engagementId)) {
    return { ok: false, error: "engagement-not-found" };
  }
  if (!UUID_RE.test(optionId)) {
    return { ok: false, error: "option-not-found" };
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
    console.error("[ai.proposal-option-context] engagement-lookup-failed", {
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

  // --- Target option + sibling options (engagement-scoped fan-out) --------
  const { data: optionRows, error: optionsError } = await supabase
    .from("proposal_options")
    .select(
      "id, proposal_id, option_type, title, recommended, best_fit_scenario, scope_summary, timeline, deliverables, assumptions, dependencies, risks, pricing_placeholder, confidence, position",
    )
    .eq("engagement_id", engagementId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (optionsError) {
    console.error("[ai.proposal-option-context] options-lookup-failed", {
      name: optionsError.name,
      code: optionsError.code,
      message: optionsError.message,
    });
    return { ok: false, error: "service-error" };
  }
  const allOptionRows =
    (optionRows as unknown as Array<{
      id: string;
      proposal_id: string;
      option_type: string;
      title: string;
      recommended: boolean | null;
      best_fit_scenario: string | null;
      scope_summary: string | null;
      timeline: string | null;
      deliverables: string[] | null;
      assumptions: string[] | null;
      dependencies: string[] | null;
      risks: string[] | null;
      pricing_placeholder: string | null;
      confidence: string | null;
      position: number | null;
    }>) ?? [];
  if (allOptionRows.length === 0) {
    return { ok: false, error: "proposal-not-found" };
  }
  const target = allOptionRows.find((o) => o.id === optionId);
  if (!target) {
    return { ok: false, error: "option-not-found" };
  }

  // --- Proposal-level metadata (commercial-lever copy, status) ------------
  const { data: proposalRow, error: proposalError } = await supabase
    .from("proposals")
    .select(
      "id, title, status, next_step, credit_eligible, credit_amount_placeholder, credit_window, credit_notes",
    )
    .eq("id", target.proposal_id)
    .maybeSingle<{
      id: string;
      title: string;
      status: string | null;
      next_step: string | null;
      credit_eligible: boolean | null;
      credit_amount_placeholder: string | null;
      credit_window: string | null;
      credit_notes: string | null;
    }>();
  if (proposalError || !proposalRow) {
    console.error("[ai.proposal-option-context] proposal-lookup-failed", {
      name: proposalError?.name,
      code: proposalError?.code,
      message: proposalError?.message,
    });
    return { ok: false, error: "proposal-not-found" };
  }

  // --- Findings + opportunities + roadmap + report sections in parallel --
  const [findings, opportunities, roadmap, reportSections] = await Promise.all([
    loadEligibleFindings(supabase, engagementId),
    loadEligibleOpportunities(supabase, engagementId),
    loadRoadmap(supabase, engagementId),
    loadReportSections(supabase, engagementId),
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
      proposal: {
        proposalId: proposalRow.id,
        title: proposalRow.title,
        status: proposalRow.status ?? "draft",
        nextStep: clipString(proposalRow.next_step, SUMMARY_LIMIT),
        creditEligible: Boolean(proposalRow.credit_eligible),
        creditAmountPlaceholder: clipString(
          proposalRow.credit_amount_placeholder,
          ARRAY_ITEM_LIMIT,
        ),
        creditWindow: clipString(proposalRow.credit_window, ARRAY_ITEM_LIMIT),
        creditNotes: clipString(proposalRow.credit_notes, SUMMARY_LIMIT),
      },
      option: {
        optionId: target.id,
        proposalId: target.proposal_id,
        optionType: target.option_type,
        title: target.title,
        recommended: Boolean(target.recommended),
        bestFitScenario: clipString(
          target.best_fit_scenario,
          SUMMARY_LIMIT,
        ),
        scopeSummary: clipString(target.scope_summary, SUMMARY_LIMIT),
        timeline: clipString(target.timeline, ARRAY_ITEM_LIMIT),
        deliverables: clipArrayLimitedTo(target.deliverables),
        assumptions: clipArrayLimitedTo(target.assumptions),
        dependencies: clipArrayLimitedTo(target.dependencies),
        risks: clipArrayLimitedTo(target.risks),
        pricingPlaceholder: clipString(
          target.pricing_placeholder,
          ARRAY_ITEM_LIMIT,
        ),
        confidence: target.confidence ?? "medium",
        position: target.position ?? 0,
      },
      siblingOptions: allOptionRows
        .filter((o) => o.id !== target.id)
        .map((o) => ({
          optionId: o.id,
          optionType: o.option_type,
          title: o.title,
          recommended: Boolean(o.recommended),
          position: o.position ?? 0,
        })),
      findings,
      opportunities,
      roadmap,
      reportSections,
    },
  };
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

async function loadEligibleFindings(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<ProposalOptionSynthesisContext["findings"]> {
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
    console.error("[ai.proposal-option-context] findings-lookup-failed", {
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
): Promise<ProposalOptionSynthesisContext["opportunities"]> {
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
    console.error("[ai.proposal-option-context] opportunities-lookup-failed", {
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

async function loadRoadmap(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<ProposalOptionSynthesisContext["roadmap"]> {
  const { data, error } = await supabase
    .from("roadmap_items")
    .select(
      "id, title, phase, priority, objective, key_actions, dependencies, success_criteria, risks, opportunity_id, position, created_at",
    )
    .eq("engagement_id", engagementId)
    // Sprint S9 — only operator-approved (`ready`) roadmap items feed
    // proposal-option synthesis. Planned/deferred/rejected/blocked/
    // completed items are excluded from AI input.
    .in("status", ELIGIBLE_ROADMAP_STATUSES)
    .order("phase", { ascending: true })
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(MAX_ROADMAP_ITEMS);
  if (error) {
    console.error("[ai.proposal-option-context] roadmap-lookup-failed", {
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
      objective: string | null;
      key_actions: string[] | null;
      dependencies: string[] | null;
      success_criteria: string[] | null;
      risks: string[] | null;
      opportunity_id: string | null;
    }>) ?? [];
  return rows.map((r) => ({
    roadmapItemId: r.id,
    title: clipString(r.title, TITLE_LIMIT) ?? r.title,
    phase: r.phase ?? "first_30",
    priority: r.priority ?? "low_priority",
    objective: clipString(r.objective, SUMMARY_LIMIT),
    keyActions: clipArrayLimitedTo(r.key_actions),
    dependencies: clipArrayLimitedTo(r.dependencies),
    successCriteria: clipArrayLimitedTo(r.success_criteria),
    risks: clipArrayLimitedTo(r.risks),
    linkedOpportunityId: r.opportunity_id,
  }));
}

async function loadReportSections(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<ProposalOptionSynthesisContext["reportSections"]> {
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
    console.error("[ai.proposal-option-context] report-sections-lookup-failed", {
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

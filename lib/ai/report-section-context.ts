import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-only report-section synthesis context builder.
 *
 * Mirrors the boundary in `opportunities-context.ts` and
 * `findings-context.ts`:
 *
 *   - Only consultant-reviewed findings (approved + report-ready) are
 *     loaded as evidence. Needs-review/draft/rejected findings never
 *     reach the model.
 *   - Only operator-selected opportunities are surfaced — drafts,
 *     scored-but-not-selected, deferred, and rejected opportunities
 *     are filtered out. Sprint S8 tightened this from
 *     `["scored", "selected"]` to `["selected"]` only so pre-approval
 *     opportunity drafts never feed report-section synthesis. The
 *     `scored` stage is an internal operator review state; only
 *     `selected` opportunities are operator-blessed for downstream
 *     consumption. See `docs/49_REPORT_SECTION_AI_DRAFTING.md` § 3.
 *   - Only `ready` roadmap items are surfaced — planned drafts,
 *     deferred/rejected items, and completed items never feed report
 *     synthesis. Sprint S8 added this allowlist; the prior loader
 *     accepted every roadmap row regardless of status.
 *   - Stakeholder PII is never embedded: only intake-session aggregates
 *     (status / role / response-quality / completion percent / a brief
 *     summary blurb already authored by the mapper) reach the model.
 *   - Uploaded files remain metadata-only — no binary contents, no
 *     OCR/parsing, no signed URLs.
 *   - Internal Saipien Fit Score is intentionally omitted.
 *   - The target section's persisted `exhibit_slot` is surfaced as a
 *     **gating signal** so the prompt can mention the slot only as
 *     internal context, never as a final client artifact.
 *
 * The output is consumed by `lib/ai/report-section-synthesis.ts` and is
 * never logged in raw form or persisted on the synthesis-run row.
 */

export type ReportSectionContextLoadError =
  | "unauthenticated"
  | "engagement-not-found"
  | "report-not-found"
  | "section-not-found"
  | "section-is-final"
  | "service-error";

export interface ReportSectionTargetMeta {
  sectionId: string;
  sectionType: string;
  title: string;
  status: string;
  exhibitSlot: string | null;
  /** Existing reviewer note, if any. Surfaced so the model can preserve operator intent. */
  reviewerNote: string | null;
}

export interface ReportSectionSynthesisContext {
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
  /** Target section the prompt is drafting. */
  section: ReportSectionTargetMeta;
  /** All other sections (id + type + title + slot) for cross-reference context. */
  siblingSections: Array<{
    sectionId: string;
    sectionType: string;
    title: string;
    status: string;
    exhibitSlot: string | null;
  }>;
  /** Approved / report-ready findings only. */
  findings: Array<{
    findingId: string;
    statement: string;
    summary: string | null;
    category: string | null;
    confidence: string | null;
    reviewStatus: string;
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
    linkedFindingIds: string[];
  }>;
  /** Persisted roadmap items in order. */
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
  /** Stakeholder intake aggregates (no PII, no answer text). */
  intake: Array<{
    sessionId: string;
    role: string | null;
    status: string;
    responseQuality: string | null;
    completionPercent: number;
  }>;
}

export interface ReportSectionContextLoadResult {
  ok: true;
  context: ReportSectionSynthesisContext;
}

export interface ReportSectionContextLoadFailure {
  ok: false;
  error: ReportSectionContextLoadError;
}

// ---------------------------------------------------------------------------
// Bounds
// ---------------------------------------------------------------------------

const MAX_FINDINGS = 20;
const MAX_OPPORTUNITIES = 20;
const MAX_ROADMAP_ITEMS = 30;
const MAX_INTAKE_SESSIONS = 30;

const STATEMENT_LIMIT = 280;
const SUMMARY_LIMIT = 360;
const TITLE_LIMIT = 200;
const SUGGESTED_IMPACT_LIMIT = 320;
const REVIEWER_NOTE_LIMIT = 600;
const ARRAY_ITEM_LIMIT = 200;
const MAX_ARRAY_ITEMS = 6;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ELIGIBLE_FINDING_STATUSES = ["approved", "report_ready"];
// Sprint S8 — tightened from `["scored", "selected"]` to `["selected"]`
// only. `scored` is an internal pre-approval state; only operator-blessed
// `selected` opportunities are eligible inputs for report-section
// synthesis. Same correctness pattern as the S7 fix to roadmap-context.
// See docs/49 § 3.
const ELIGIBLE_OPPORTUNITY_STATUSES = ["selected"];
// Sprint S8 — only `ready` roadmap items feed report-section synthesis.
// Planned (draft), deferred, rejected, blocked, and completed items are
// excluded. The `ready` state is the operator-approved roadmap output of
// S7; nothing else is operator-blessed for downstream consumption.
const ELIGIBLE_ROADMAP_STATUSES = ["ready"];

// ---------------------------------------------------------------------------
// Public builder
// ---------------------------------------------------------------------------

export async function buildReportSectionSynthesisContext(args: {
  engagementId: string;
  sectionId: string;
}): Promise<
  ReportSectionContextLoadResult | ReportSectionContextLoadFailure
> {
  const { engagementId, sectionId } = args;
  if (!UUID_RE.test(engagementId)) {
    return { ok: false, error: "engagement-not-found" };
  }
  if (!UUID_RE.test(sectionId)) {
    return { ok: false, error: "section-not-found" };
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
    console.error("[ai.report-section-context] engagement-lookup-failed", {
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

  // --- Section + siblings --------------------------------------------------
  const { data: sectionsData, error: sectionsError } = await supabase
    .from("report_sections")
    .select(
      "id, report_id, section_type, title, status, exhibit_slot, reviewer_note, position, created_at",
    )
    .eq("engagement_id", engagementId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (sectionsError) {
    console.error("[ai.report-section-context] sections-lookup-failed", {
      name: sectionsError.name,
      code: sectionsError.code,
      message: sectionsError.message,
    });
    return { ok: false, error: "service-error" };
  }
  const sectionRows =
    (sectionsData as unknown as Array<{
      id: string;
      report_id: string;
      section_type: string;
      title: string;
      status: string | null;
      exhibit_slot: string | null;
      reviewer_note: string | null;
      position: number | null;
      created_at: string;
    }>) ?? [];
  if (sectionRows.length === 0) {
    return { ok: false, error: "report-not-found" };
  }
  const target = sectionRows.find((s) => s.id === sectionId);
  if (!target) {
    return { ok: false, error: "section-not-found" };
  }
  if (target.status === "final") {
    return { ok: false, error: "section-is-final" };
  }

  // --- Findings (approved / report-ready) ---------------------------------
  const findings = await loadEligibleFindings(supabase, engagementId);

  // --- Opportunities (scored / selected) + their finding links -----------
  const opportunities = await loadEligibleOpportunities(supabase, engagementId);

  // --- Roadmap items -----------------------------------------------------
  const roadmap = await loadRoadmap(supabase, engagementId);

  // --- Intake aggregates -------------------------------------------------
  const intake = await loadIntakeAggregates(supabase, engagementId);

  const reviewerNote = clipString(target.reviewer_note, REVIEWER_NOTE_LIMIT);

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
      section: {
        sectionId: target.id,
        sectionType: target.section_type,
        title: target.title,
        status: target.status ?? "not_started",
        exhibitSlot: target.exhibit_slot,
        reviewerNote,
      },
      siblingSections: sectionRows
        .filter((s) => s.id !== target.id)
        .map((s) => ({
          sectionId: s.id,
          sectionType: s.section_type,
          title: s.title,
          status: s.status ?? "not_started",
          exhibitSlot: s.exhibit_slot,
        })),
      findings,
      opportunities,
      roadmap,
      intake,
    },
  };
}

// ---------------------------------------------------------------------------
// Loaders
// ---------------------------------------------------------------------------

async function loadEligibleFindings(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<ReportSectionSynthesisContext["findings"]> {
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
    console.error("[ai.report-section-context] findings-lookup-failed", {
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
      review_status: string | null;
      suggested_impact: string | null;
    }>) ?? [];
  return rows.slice(0, MAX_FINDINGS).map((r) => ({
    findingId: r.id,
    statement: clipString(r.statement, STATEMENT_LIMIT) ?? r.statement,
    summary: clipString(r.summary, SUMMARY_LIMIT),
    category: r.category,
    confidence: r.confidence,
    reviewStatus: r.review_status ?? "approved",
    suggestedImpact: clipString(r.suggested_impact, SUGGESTED_IMPACT_LIMIT),
  }));
}

async function loadEligibleOpportunities(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<ReportSectionSynthesisContext["opportunities"]> {
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
    console.error("[ai.report-section-context] opportunities-lookup-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const oppRows =
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
  const trimmed = oppRows.slice(0, MAX_OPPORTUNITIES);
  if (trimmed.length === 0) return [];

  // Pull finding links for traceability — small fan-in query.
  const oppIds = trimmed.map((o) => o.id);
  const { data: links } = await supabase
    .from("opportunity_finding_links")
    .select("opportunity_id, finding_id")
    .in("opportunity_id", oppIds);
  const linkRows =
    (links as unknown as Array<{
      opportunity_id: string;
      finding_id: string;
    }>) ?? [];

  return trimmed.map((o) => ({
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
    linkedFindingIds: linkRows
      .filter((l) => l.opportunity_id === o.id)
      .map((l) => l.finding_id),
  }));
}

async function loadRoadmap(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<ReportSectionSynthesisContext["roadmap"]> {
  const { data, error } = await supabase
    .from("roadmap_items")
    .select(
      "id, title, phase, priority, objective, key_actions, dependencies, success_criteria, risks, opportunity_id, position, created_at",
    )
    .eq("engagement_id", engagementId)
    // Sprint S8 — only operator-approved (`ready`) roadmap items feed
    // report-section synthesis. Planned/deferred/rejected/blocked/
    // completed items are excluded from AI input.
    .in("status", ELIGIBLE_ROADMAP_STATUSES)
    .order("phase", { ascending: true })
    .order("position", { ascending: true })
    .order("created_at", { ascending: true })
    .limit(MAX_ROADMAP_ITEMS);
  if (error) {
    console.error("[ai.report-section-context] roadmap-lookup-failed", {
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

async function loadIntakeAggregates(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<ReportSectionSynthesisContext["intake"]> {
  const { data, error } = await supabase
    .from("stakeholder_intake_sessions")
    .select("id, role, status, response_quality, completed_at, last_activity_at, started_at")
    .eq("engagement_id", engagementId)
    .limit(MAX_INTAKE_SESSIONS);
  if (error) {
    console.error("[ai.report-section-context] intake-lookup-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows =
    (data as unknown as Array<{
      id: string;
      role: string | null;
      status: string | null;
      response_quality: string | null;
    }>) ?? [];
  // Conservative completion percent: derived heuristically without
  // querying the responses table (we only need an aggregate signal).
  return rows.map((r) => ({
    sessionId: r.id,
    role: r.role,
    status: r.status ?? "not_started",
    responseQuality: r.response_quality,
    completionPercent: deriveCompletionPercent(r.status),
  }));
}

function deriveCompletionPercent(status: string | null): number {
  if (status === "completed") return 100;
  if (status === "in_progress") return 50;
  if (status === "needs_follow_up") return 30;
  return 0;
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
    out.push(trimmed.length > ARRAY_ITEM_LIMIT ? `${trimmed.slice(0, ARRAY_ITEM_LIMIT - 1)}…` : trimmed);
    if (out.length >= MAX_ARRAY_ITEMS) break;
  }
  return out;
}

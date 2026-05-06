import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-only opportunity synthesis context builder.
 *
 * Mirrors the boundary in `findings-context.ts`:
 *
 *   - Only consultant-reviewed findings (approved + report-ready) are
 *     loaded as evidence. Needs-review/draft/rejected findings never
 *     reach the model — that would compound unreviewed AI output.
 *   - Stakeholder PII is never embedded (we only carry per-source
 *     labels and roles already present on `finding_source_refs`).
 *   - Uploaded files remain metadata-only — no binary contents, no
 *     OCR/parsing, no signed URLs.
 *   - Internal Saipien Fit Score is intentionally omitted.
 *   - Existing opportunities are summarized so the model can avoid
 *     duplicating prior drafts.
 *
 * The output is consumed by `lib/ai/opportunities-synthesis.ts` and is
 * never logged in raw form or persisted on the synthesis-run row.
 */

export type OpportunityContextLoadError =
  | "unauthenticated"
  | "engagement-not-found"
  | "no-approved-findings"
  | "service-error";

export interface OpportunitySynthesisContext {
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
  scorecard: {
    classification: string | null;
    prospectAiReadiness: number | null;
    prospectWorkflowFriction: number | null;
    prospectSystemsReadiness: number | null;
    answers: Array<{ questionId: string; valueLabel: string }>;
  } | null;
  findings: Array<{
    findingId: string;
    statement: string;
    summary: string | null;
    category: string | null;
    confidence: string | null;
    reviewStatus: string;
    suggestedImpact: string | null;
    sourceRefs: Array<{
      sourceType: string | null;
      sourceLabel: string;
      sourceRole: string | null;
      strength: string | null;
    }>;
  }>;
  inputAssets: Array<{
    assetId: string;
    title: string;
    assetType: string | null;
    summary: string | null;
    mimeFamily: string | null;
  }>;
  existingOpportunities: Array<{
    opportunityId: string;
    title: string;
    category: string | null;
    quadrant: string | null;
    status: string | null;
    evidenceStrength: string | null;
    linkedFindingIds: string[];
  }>;
}

export interface OpportunityContextLoadResult {
  ok: true;
  context: OpportunitySynthesisContext;
}

export interface OpportunityContextLoadFailure {
  ok: false;
  error: OpportunityContextLoadError;
}

const MAX_FINDINGS = 20;
const MAX_SOURCE_REFS_PER_FINDING = 5;
const MAX_EXISTING_OPPORTUNITIES = 20;
const MAX_SCORECARD_ANSWERS = 20;
const MAX_INPUT_ASSETS = 20;

const STATEMENT_LIMIT = 280;
const SUMMARY_LIMIT = 360;
const ANSWER_EXCERPT_LIMIT = 240;
const TITLE_LIMIT = 200;
const SOURCE_LABEL_LIMIT = 160;
const SOURCE_ROLE_LIMIT = 80;
const SUGGESTED_IMPACT_LIMIT = 320;
const ASSET_SUMMARY_LIMIT = 240;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ELIGIBLE_REVIEW_STATUSES = ["approved", "report_ready"] as const;

export async function buildOpportunitySynthesisContext(
  engagementId: string,
): Promise<OpportunityContextLoadResult | OpportunityContextLoadFailure> {
  if (!UUID_RE.test(engagementId)) {
    return { ok: false, error: "engagement-not-found" };
  }
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "unauthenticated" };

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
      linked_lead_id,
      account_id,
      accounts:account_id ( name, industry, employee_range, revenue_range ),
      leads:linked_lead_id ( submission_id )
    `,
    )
    .eq("id", engagementId)
    .maybeSingle();
  if (engagementError) {
    console.error("[ai.opportunities-context] engagement-lookup-failed", {
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
    linked_lead_id: string | null;
    account_id: string | null;
    accounts: {
      name: string | null;
      industry: string | null;
      employee_range: string | null;
      revenue_range: string | null;
    } | null;
    leads: { submission_id: string | null } | null;
  };

  const submissionId = eng.leads?.submission_id ?? null;

  const [findings, scorecard, inputAssets, existingOpportunities] =
    await Promise.all([
      loadEligibleFindings(supabase, engagementId),
      loadScorecardSnapshot(supabase, submissionId),
      loadInputAssetMetadata(supabase, engagementId),
      loadExistingOpportunities(supabase, engagementId),
    ]);

  if (findings.length === 0) {
    return { ok: false, error: "no-approved-findings" };
  }

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
      scorecard,
      findings,
      inputAssets,
      existingOpportunities,
    },
  };
}

async function loadEligibleFindings(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<OpportunitySynthesisContext["findings"]> {
  const { data: findingRows, error: findingsError } = await supabase
    .from("findings")
    .select(
      "id, statement, summary, category, confidence, review_status, suggested_impact",
    )
    .eq("engagement_id", engagementId)
    .in("review_status", ELIGIBLE_REVIEW_STATUSES as unknown as string[])
    .order("position", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(MAX_FINDINGS);
  if (findingsError) {
    console.error("[ai.opportunities-context] findings-load-failed", {
      name: findingsError.name,
      code: findingsError.code,
      message: findingsError.message,
    });
    return [];
  }
  const rows =
    (findingRows as unknown as Array<{
      id: string;
      statement: string;
      summary: string | null;
      category: string | null;
      confidence: string | null;
      review_status: string | null;
      suggested_impact: string | null;
    }>) ?? [];

  if (rows.length === 0) return [];

  const findingIds = rows.map((r) => r.id);
  const { data: refRows } = await supabase
    .from("finding_source_refs")
    .select("finding_id, source_type, source_label, source_role, strength")
    .in("finding_id", findingIds)
    .order("created_at", { ascending: true });
  const refs =
    (refRows as unknown as Array<{
      finding_id: string;
      source_type: string | null;
      source_label: string | null;
      source_role: string | null;
      strength: string | null;
    }>) ?? [];

  const refsByFinding = new Map<
    string,
    OpportunitySynthesisContext["findings"][number]["sourceRefs"]
  >();
  for (const ref of refs) {
    const list = refsByFinding.get(ref.finding_id) ?? [];
    if (list.length >= MAX_SOURCE_REFS_PER_FINDING) continue;
    list.push({
      sourceType: ref.source_type ?? null,
      sourceLabel: clip(ref.source_label ?? "", SOURCE_LABEL_LIMIT) ?? "Source",
      sourceRole: ref.source_role
        ? clip(ref.source_role, SOURCE_ROLE_LIMIT)
        : null,
      strength: ref.strength ?? null,
    });
    refsByFinding.set(ref.finding_id, list);
  }

  return rows.map((row) => ({
    findingId: row.id,
    statement: clip(row.statement, STATEMENT_LIMIT) ?? row.statement,
    summary: row.summary ? clip(row.summary, SUMMARY_LIMIT) : null,
    category: row.category ?? null,
    confidence: row.confidence ?? null,
    reviewStatus: row.review_status ?? "approved",
    suggestedImpact: row.suggested_impact
      ? clip(row.suggested_impact, SUGGESTED_IMPACT_LIMIT)
      : null,
    sourceRefs: refsByFinding.get(row.id) ?? [],
  }));
}

async function loadScorecardSnapshot(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  submissionId: string | null,
): Promise<OpportunitySynthesisContext["scorecard"]> {
  if (!submissionId) return null;
  const { data: submission, error: submissionError } = await supabase
    .from("scorecard_submissions")
    .select(
      `
      id,
      classification,
      prospect_ai_readiness,
      prospect_workflow_friction,
      prospect_systems_readiness
    `,
    )
    .eq("id", submissionId)
    .maybeSingle<{
      id: string;
      classification: string | null;
      prospect_ai_readiness: number | null;
      prospect_workflow_friction: number | null;
      prospect_systems_readiness: number | null;
    }>();
  if (submissionError || !submission) return null;

  const { data: answerRows } = await supabase
    .from("scorecard_answers")
    .select("question_id, value")
    .eq("submission_id", submission.id)
    .limit(MAX_SCORECARD_ANSWERS);

  const answers: Array<{ questionId: string; valueLabel: string }> = [];
  for (const row of (answerRows as unknown as Array<{
    question_id: string;
    value: unknown;
  }>) ?? []) {
    const valueLabel = stringifyAnswerValue(row.value);
    if (!valueLabel) continue;
    answers.push({
      questionId: row.question_id,
      valueLabel: clip(valueLabel, ANSWER_EXCERPT_LIMIT) ?? valueLabel,
    });
    if (answers.length >= MAX_SCORECARD_ANSWERS) break;
  }

  return {
    classification: submission.classification ?? null,
    prospectAiReadiness: submission.prospect_ai_readiness ?? null,
    prospectWorkflowFriction: submission.prospect_workflow_friction ?? null,
    prospectSystemsReadiness: submission.prospect_systems_readiness ?? null,
    answers,
  };
}

async function loadInputAssetMetadata(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<OpportunitySynthesisContext["inputAssets"]> {
  const { data: assetRows } = await supabase
    .from("input_assets")
    .select("id, title, asset_type, summary, mime_type")
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: false })
    .limit(MAX_INPUT_ASSETS);
  const rows =
    (assetRows as unknown as Array<{
      id: string;
      title: string;
      asset_type: string | null;
      summary: string | null;
      mime_type: string | null;
    }>) ?? [];
  return rows.map((row) => ({
    assetId: row.id,
    title: clip(row.title, TITLE_LIMIT) ?? row.title,
    assetType: row.asset_type ?? null,
    summary: row.summary ? clip(row.summary, ASSET_SUMMARY_LIMIT) : null,
    mimeFamily: deriveMimeFamily(row.mime_type),
  }));
}

async function loadExistingOpportunities(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<OpportunitySynthesisContext["existingOpportunities"]> {
  const { data: opportunityRows, error: opportunityError } = await supabase
    .from("opportunities")
    .select("id, title, category, quadrant, status, evidence_strength")
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: false })
    .limit(MAX_EXISTING_OPPORTUNITIES);
  if (opportunityError) {
    console.error("[ai.opportunities-context] opportunities-load-failed", {
      name: opportunityError.name,
      code: opportunityError.code,
      message: opportunityError.message,
    });
    return [];
  }
  const rows =
    (opportunityRows as unknown as Array<{
      id: string;
      title: string;
      category: string | null;
      quadrant: string | null;
      status: string | null;
      evidence_strength: string | null;
    }>) ?? [];

  if (rows.length === 0) return [];

  const opportunityIds = rows.map((r) => r.id);
  const { data: linkRows } = await supabase
    .from("opportunity_finding_links")
    .select("opportunity_id, finding_id")
    .in("opportunity_id", opportunityIds);
  const links =
    (linkRows as unknown as Array<{
      opportunity_id: string;
      finding_id: string;
    }>) ?? [];
  const linksByOpportunity = new Map<string, string[]>();
  for (const link of links) {
    const list = linksByOpportunity.get(link.opportunity_id) ?? [];
    list.push(link.finding_id);
    linksByOpportunity.set(link.opportunity_id, list);
  }

  return rows.map((row) => ({
    opportunityId: row.id,
    title: clip(row.title, TITLE_LIMIT) ?? row.title,
    category: row.category ?? null,
    quadrant: row.quadrant ?? null,
    status: row.status ?? null,
    evidenceStrength: row.evidence_strength ?? null,
    linkedFindingIds: linksByOpportunity.get(row.id) ?? [],
  }));
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function clip(text: string | null | undefined, max: number): string | null {
  if (typeof text !== "string") return null;
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1)}…`;
}

function cleanStringArray(value: string[] | null | undefined): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((s) => (typeof s === "string" ? s.trim() : ""))
    .filter((s) => s.length > 0)
    .slice(0, 12);
}

function stringifyAnswerValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return value.trim() || null;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) {
    const parts = value
      .filter((v) => typeof v === "string")
      .map((v) => (v as string).trim())
      .filter((v) => v.length > 0);
    return parts.length > 0 ? parts.join(", ") : null;
  }
  return null;
}

function deriveMimeFamily(mime: string | null): string | null {
  if (!mime) return null;
  const lower = mime.toLowerCase();
  if (lower.includes("pdf")) return "pdf";
  if (lower.includes("word") || lower.includes("officedocument.wordprocessing"))
    return "word";
  if (
    lower.includes("excel") ||
    lower.includes("spreadsheetml") ||
    lower.includes("csv")
  )
    return "spreadsheet";
  if (lower.includes("text/")) return "text";
  if (lower.startsWith("image/")) return "image";
  return null;
}

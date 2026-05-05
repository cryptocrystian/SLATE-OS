import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Server-only synthesis context builder.
 *
 * Assembles the structured payload that the LLM will read when drafting
 * findings. The boundary is strict:
 *
 *   - Stakeholder PII is redacted: names trimmed, emails and contact
 *     details never leave the operator surface.
 *   - Uploaded files are metadata-only. We never load binary contents,
 *     never mint signed URLs, never call OCR/parsing.
 *   - Internal fit score is intentionally omitted from the payload —
 *     the LLM should reason from evidence, not from our internal scoring.
 *   - Fields are capped to keep the prompt compact and bounded.
 *
 * The output is consumed by `lib/ai/findings-synthesis.ts` (which
 * shapes the user prompt) and is *not* logged or persisted in raw form.
 */

export type FindingsContextLoadError =
  | "unauthenticated"
  | "engagement-not-found"
  | "service-error";

export interface FindingsSynthesisContext {
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
  intake: {
    sessionCount: number;
    completedCount: number;
    responses: Array<{
      responseId: string;
      sessionId: string;
      role: string | null;
      stakeholderRole: string | null;
      questionId: string;
      questionLabel: string | null;
      answerExcerpt: string;
    }>;
  };
  inputAssets: Array<{
    assetId: string;
    title: string;
    assetType: string | null;
    source: string | null;
    status: string | null;
    evidenceQuality: string | null;
    summary: string | null;
    mimeFamily: string | null;
  }>;
  existingFindings: Array<{
    findingId: string;
    statement: string;
    category: string | null;
    reviewStatus: string | null;
    confidence: string | null;
    evidenceSummary: string | null;
  }>;
}

export interface FindingsContextLoadResult {
  ok: true;
  context: FindingsSynthesisContext;
}

export interface FindingsContextLoadFailure {
  ok: false;
  error: FindingsContextLoadError;
}

const MAX_INTAKE_RESPONSES = 50;
const MAX_INPUT_ASSETS = 30;
const MAX_EXISTING_FINDINGS = 30;
const MAX_SCORECARD_ANSWERS = 30;
const ANSWER_EXCERPT_LIMIT = 360;
const SUMMARY_LIMIT = 280;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function buildFindingsSynthesisContext(
  engagementId: string,
): Promise<FindingsContextLoadResult | FindingsContextLoadFailure> {
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
    console.error("[ai.findings-context] engagement-lookup-failed", {
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

  // Run the remaining loads in parallel — each is bounded and uses RLS.
  const [scorecard, intake, inputAssets, existingFindings] = await Promise.all([
    loadScorecardSnapshot(supabase, submissionId),
    loadIntakeContext(supabase, engagementId),
    loadInputAssetMetadata(supabase, engagementId),
    loadExistingFindings(supabase, engagementId),
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
      scorecard,
      intake,
      inputAssets,
      existingFindings,
    },
  };
}

async function loadScorecardSnapshot(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  submissionId: string | null,
): Promise<FindingsSynthesisContext["scorecard"]> {
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
      valueLabel: clip(valueLabel, ANSWER_EXCERPT_LIMIT),
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

async function loadIntakeContext(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<FindingsSynthesisContext["intake"]> {
  const { data: sessionRows } = await supabase
    .from("stakeholder_intake_sessions")
    .select("id, role, stakeholder_title, status")
    .eq("engagement_id", engagementId);
  const sessions = (sessionRows as unknown as Array<{
    id: string;
    role: string | null;
    stakeholder_title: string | null;
    status: string | null;
  }>) ?? [];

  const sessionCount = sessions.length;
  const completedCount = sessions.filter((s) => s.status === "completed").length;
  const sessionLookup = new Map<
    string,
    { role: string | null; title: string | null }
  >();
  for (const s of sessions) {
    sessionLookup.set(s.id, {
      role: s.role,
      title: s.stakeholder_title?.trim() || null,
    });
  }

  if (sessions.length === 0) {
    return { sessionCount: 0, completedCount: 0, responses: [] };
  }

  const { data: responseRows } = await supabase
    .from("stakeholder_responses")
    .select("id, session_id, question_id, question_label, answer_text")
    .in(
      "session_id",
      sessions.map((s) => s.id),
    )
    .order("created_at", { ascending: true })
    .limit(MAX_INTAKE_RESPONSES);

  const responses: FindingsSynthesisContext["intake"]["responses"] = [];
  for (const row of (responseRows as unknown as Array<{
    id: string;
    session_id: string;
    question_id: string;
    question_label: string | null;
    answer_text: string | null;
  }>) ?? []) {
    const answer = (row.answer_text ?? "").trim();
    if (answer.length === 0) continue;
    const session = sessionLookup.get(row.session_id);
    responses.push({
      responseId: row.id,
      sessionId: row.session_id,
      role: session?.title ?? null,
      stakeholderRole: session?.role ?? null,
      questionId: row.question_id,
      questionLabel: row.question_label?.trim() || null,
      answerExcerpt: clip(answer, ANSWER_EXCERPT_LIMIT),
    });
    if (responses.length >= MAX_INTAKE_RESPONSES) break;
  }
  return { sessionCount, completedCount, responses };
}

async function loadInputAssetMetadata(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<FindingsSynthesisContext["inputAssets"]> {
  const { data: assetRows } = await supabase
    .from("input_assets")
    .select(
      `
      id,
      title,
      asset_type,
      source,
      status,
      evidence_quality,
      summary,
      mime_type
    `,
    )
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: false })
    .limit(MAX_INPUT_ASSETS);
  const rows = (assetRows as unknown as Array<{
    id: string;
    title: string;
    asset_type: string | null;
    source: string | null;
    status: string | null;
    evidence_quality: string | null;
    summary: string | null;
    mime_type: string | null;
  }>) ?? [];
  return rows.map((row) => ({
    assetId: row.id,
    title: row.title,
    assetType: row.asset_type ?? null,
    source: row.source?.trim() || null,
    status: row.status ?? null,
    evidenceQuality: row.evidence_quality ?? null,
    summary: row.summary ? clip(row.summary, SUMMARY_LIMIT) : null,
    mimeFamily: deriveMimeFamily(row.mime_type),
  }));
}

async function loadExistingFindings(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  engagementId: string,
): Promise<FindingsSynthesisContext["existingFindings"]> {
  const { data: rows } = await supabase
    .from("findings")
    .select(
      "id, statement, category, review_status, confidence, evidence_summary",
    )
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: false })
    .limit(MAX_EXISTING_FINDINGS);
  const findings = (rows as unknown as Array<{
    id: string;
    statement: string;
    category: string | null;
    review_status: string | null;
    confidence: string | null;
    evidence_summary: string | null;
  }>) ?? [];
  return findings.map((row) => ({
    findingId: row.id,
    statement: clip(row.statement, 240),
    category: row.category ?? null,
    reviewStatus: row.review_status ?? null,
    confidence: row.confidence ?? null,
    evidenceSummary: row.evidence_summary
      ? clip(row.evidence_summary, SUMMARY_LIMIT)
      : null,
  }));
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function clip(text: string, max: number): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
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

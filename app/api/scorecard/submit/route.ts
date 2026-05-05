import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { scoreScorecard } from "@/lib/scorecard/scoring";
import { toPublicScoreResult } from "@/lib/scorecard/public-result";
import {
  deriveFitDimensions,
  deriveQualificationSignals,
  deriveLeadStatus,
} from "@/lib/leads/derive";
import type {
  Answers,
  AnswerValue,
  ResultClassificationId,
} from "@/lib/scorecard/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * POST /api/scorecard/submit
 *
 * Public scorecard submission endpoint. Accepts an answers payload, runs
 * server-side scoring, and atomically (best-effort multi-step) persists:
 *   - account (upsert by lower(name) within the singleton workspace)
 *   - contact (upsert by email within that account)
 *   - scorecard_submission row
 *   - scorecard_answers rows
 *   - lead row
 *   - lead_fit_dimensions rows
 *   - lead_qualification_signals rows
 *   - back-fills submission.lead_id
 *
 * Returns ONLY a public-safe response shape:
 *   { submissionId, result: PublicScoreResult, displayContext }
 *
 * Never returns: internal_fit_score, lead row, fit dimensions,
 * qualification signals, or any Supabase internals.
 */
export async function POST(request: NextRequest) {
  let payload: { answers?: unknown; clientMeta?: unknown };
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-json" }, { status: 400 });
  }

  const answers = sanitizeAnswers(payload?.answers);
  if (!answers) {
    return NextResponse.json({ error: "invalid-answers" }, { status: 400 });
  }
  const validation = validateContactFields(answers);
  if (!validation.ok) {
    return NextResponse.json(
      { error: "missing-fields", fields: validation.missing },
      { status: 400 },
    );
  }

  // Score server-side. Never trust client-side scoring.
  const result = scoreScorecard(answers);

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    return NextResponse.json(
      { error: "service-not-configured" },
      { status: 503 },
    );
  }

  // Singleton workspace lookup (Step 1 seeded one row).
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (workspaceError || !workspace?.id) {
    return logAndError(workspaceError, "workspace-missing");
  }
  const workspaceId = workspace.id;

  // ---- Account upsert ------------------------------------------------------
  const companyName = String(answers["contact.company"] ?? "").trim();
  const industry = stringOrNull(answers["company.industry"]);
  const employeeRange = stringOrNull(answers["company.size"]);

  const { data: existingAccount, error: existingAccountError } = await supabase
    .from("accounts")
    .select("id")
    .eq("workspace_id", workspaceId)
    .ilike("name", companyName)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (existingAccountError) {
    return logAndError(existingAccountError, "account-lookup-failed");
  }

  let accountId: string;
  if (existingAccount?.id) {
    accountId = existingAccount.id;
  } else {
    const { data: insertedAccount, error: accountInsertError } = await supabase
      .from("accounts")
      .insert({
        workspace_id: workspaceId,
        name: companyName,
        industry,
        employee_range: employeeRange,
        practice_area: "ai_systems",
      })
      .select("id")
      .single<{ id: string }>();
    if (accountInsertError || !insertedAccount?.id) {
      return logAndError(accountInsertError, "account-insert-failed");
    }
    accountId = insertedAccount.id;
  }

  // ---- Contact upsert ------------------------------------------------------
  const firstName = String(answers["contact.firstName"] ?? "").trim();
  const lastName = String(answers["contact.lastName"] ?? "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || null;
  const role = stringOrNull(answers["contact.role"]);
  const email = String(answers["contact.email"] ?? "").trim();

  const { data: existingContact, error: existingContactError } = await supabase
    .from("contacts")
    .select("id")
    .eq("account_id", accountId)
    .eq("email", email)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (existingContactError) {
    return logAndError(existingContactError, "contact-lookup-failed");
  }

  let contactId: string;
  if (existingContact?.id) {
    const { error: contactUpdateError } = await supabase
      .from("contacts")
      .update({ full_name: fullName, title: role })
      .eq("id", existingContact.id);
    if (contactUpdateError) {
      return logAndError(contactUpdateError, "contact-update-failed");
    }
    contactId = existingContact.id;
  } else {
    const { data: insertedContact, error: contactInsertError } = await supabase
      .from("contacts")
      .insert({
        account_id: accountId,
        full_name: fullName,
        title: role,
        email,
      })
      .select("id")
      .single<{ id: string }>();
    if (contactInsertError || !insertedContact?.id) {
      return logAndError(contactInsertError, "contact-insert-failed");
    }
    contactId = insertedContact.id;
  }

  // ---- Submission row ------------------------------------------------------
  const classificationDb = mapClassificationToDb(result.classification.id);
  const clientMeta = sanitizeClientMeta(payload?.clientMeta, request);

  const { data: insertedSubmission, error: submissionInsertError } =
    await supabase
      .from("scorecard_submissions")
      .insert({
        submitted_email: email,
        submitted_first_name: firstName || null,
        submitted_last_name: lastName || null,
        submitted_role: role,
        submitted_company: companyName,
        industry,
        employee_range: employeeRange,
        prospect_ai_readiness: result.ai,
        prospect_workflow_friction: result.friction,
        prospect_systems_readiness: result.systems,
        internal_fit_score: result.fit,
        classification: classificationDb,
        client_meta: clientMeta,
      })
      .select("id")
      .single<{ id: string }>();
  if (submissionInsertError || !insertedSubmission?.id) {
    return logAndError(submissionInsertError, "submission-insert-failed");
  }
  const submissionId = insertedSubmission.id;

  // ---- Answer rows ---------------------------------------------------------
  const answerRows = Object.entries(answers).map(([questionId, value]) => ({
    submission_id: submissionId,
    question_id: questionId,
    value,
  }));
  if (answerRows.length > 0) {
    const { error: answersInsertError } = await supabase
      .from("scorecard_answers")
      .insert(answerRows);
    if (answersInsertError) {
      // Best-effort cleanup of the submission row to avoid an orphan.
      await supabase
        .from("scorecard_submissions")
        .delete()
        .eq("id", submissionId);
      return logAndError(answersInsertError, "answers-insert-failed");
    }
  }

  // ---- Lead + dimensions + signals -----------------------------------------
  const leadStatusInfo = deriveLeadStatus(result);
  const fitDimensions = deriveFitDimensions(answers, result);
  const qualificationSignals = deriveQualificationSignals(answers, result);

  const { data: insertedLead, error: leadInsertError } = await supabase
    .from("leads")
    .insert({
      workspace_id: workspaceId,
      account_id: accountId,
      contact_id: contactId,
      source: "public_scorecard",
      practice_area: "ai_systems",
      status: leadStatusInfo.status,
      internal_fit_score: result.fit,
      prospect_scores: {
        ai: result.ai,
        friction: result.friction,
        systems: result.systems,
      },
      recommended_action: leadStatusInfo.recommendedAction,
      submission_id: submissionId,
      last_activity_at: new Date().toISOString(),
    })
    .select("id")
    .single<{ id: string }>();
  if (leadInsertError || !insertedLead?.id) {
    return logAndError(leadInsertError, "lead-insert-failed");
  }
  const leadId = insertedLead.id;

  if (fitDimensions.length > 0) {
    const { error: dimsInsertError } = await supabase
      .from("lead_fit_dimensions")
      .insert(
        fitDimensions.map((d) => ({
          lead_id: leadId,
          dimension_id: d.dimensionId,
          value: d.value,
          note: d.note,
        })),
      );
    if (dimsInsertError) {
      return logAndError(dimsInsertError, "fit-dimensions-insert-failed");
    }
  }

  if (qualificationSignals.length > 0) {
    const { error: signalsInsertError } = await supabase
      .from("lead_qualification_signals")
      .insert(
        qualificationSignals.map((s) => ({
          lead_id: leadId,
          label: s.label,
          detail: s.detail,
          direction: s.direction,
          position: s.position,
        })),
      );
    if (signalsInsertError) {
      return logAndError(signalsInsertError, "qualification-signals-insert-failed");
    }
  }

  // Back-fill the submission row's lead_id for the bidirectional link.
  await supabase
    .from("scorecard_submissions")
    .update({ lead_id: leadId })
    .eq("id", submissionId);

  // ---- Public-safe response ------------------------------------------------
  return NextResponse.json({
    submissionId,
    result: toPublicScoreResult(result),
    displayContext: {
      firstName: firstName || null,
      company: companyName || null,
    },
  });
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function sanitizeAnswers(input: unknown): Answers | null {
  if (input == null || typeof input !== "object" || Array.isArray(input)) {
    return null;
  }
  const out: Answers = {};
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    if (typeof key !== "string" || key.length === 0) continue;
    if (typeof value === "string" || typeof value === "number") {
      out[key] = value as AnswerValue;
    } else if (Array.isArray(value) && value.every((v) => typeof v === "string")) {
      out[key] = value as string[];
    }
    // Anything else (objects, booleans, nulls) is dropped silently.
  }
  return out;
}

function validateContactFields(answers: Answers): {
  ok: boolean;
  missing: string[];
} {
  const required = [
    "contact.firstName",
    "contact.lastName",
    "contact.email",
    "contact.company",
  ];
  const missing = required.filter((key) => {
    const v = answers[key];
    return typeof v !== "string" || v.trim().length === 0;
  });
  if (missing.length > 0) return { ok: false, missing };

  const email = String(answers["contact.email"]).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, missing: ["contact.email"] };
  }
  return { ok: true, missing: [] };
}

function stringOrNull(v: AnswerValue | undefined): string | null {
  if (typeof v !== "string") return null;
  const trimmed = v.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function mapClassificationToDb(
  id: ResultClassificationId,
): "not_ready" | "automation_ready" | "quick_win" | "audit_ready" | "strategic" {
  switch (id) {
    case "not-ready":
      return "not_ready";
    case "automation-ready":
      return "automation_ready";
    case "quick-win":
      return "quick_win";
    case "audit-ready":
      return "audit_ready";
    case "strategic":
      return "strategic";
  }
}

function sanitizeClientMeta(
  raw: unknown,
  request: NextRequest,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (typeof v === "string" && v.length <= 1024) out[k] = v;
    }
  }
  out.userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? null;
  out.ipHash = null; // intentionally not collected for MVP
  out.submittedAtIso = new Date().toISOString();
  return out;
}

/**
 * Server-side error logger. Whitelists Supabase error fields only —
 * never echoes the email, the answers payload, or any credential.
 */
function logAndError(error: unknown, code: string) {
  if (error && typeof error === "object") {
    const e = error as Record<string, unknown>;
    // eslint-disable-next-line no-console
    console.error(`[scorecard.submit] ${code}`, {
      name: typeof e.name === "string" ? e.name : undefined,
      code: typeof e.code === "string" ? e.code : undefined,
      message: typeof e.message === "string" ? e.message : undefined,
    });
  } else {
    // eslint-disable-next-line no-console
    console.error(`[scorecard.submit] ${code}`);
  }
  return NextResponse.json({ error: code }, { status: 500 });
}

import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { scoreScorecard } from "@/lib/scorecard/scoring";
import { toPublicScoreResult } from "@/lib/scorecard/public-result";
import {
  classifyEmailQuality,
  type EmailClassification,
} from "@/lib/scorecard/email-quality";
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

// ---------------------------------------------------------------------------
// Anti-abuse thresholds and constants
// ---------------------------------------------------------------------------

/** Below this duration, the submission is rejected outright as bot-like. */
const MIN_DURATION_MS_REJECT = 15_000;
/** Between MIN_DURATION_MS_REJECT and this, accept but flag for review. */
const MIN_DURATION_MS_ACCEPT = 45_000;

/** Per-email rolling window (ms) and max submissions inside it. */
const RATE_WINDOW_EMAIL_MS = 60 * 60 * 1000; // 1 hour
const RATE_WINDOW_EMAIL_MAX = 3;

/** Per-business-domain window. Free providers (gmail/yahoo/etc.) skip
 *  this check — many real prospects share those domains. */
const RATE_WINDOW_DOMAIN_MS = 60 * 60 * 1000;
const RATE_WINDOW_DOMAIN_MAX = 6;

/** Honeypot field on the client payload. Real users leave this empty. */
const HONEYPOT_FIELD = "website";

// ---------------------------------------------------------------------------
// Public error vocabulary
// ---------------------------------------------------------------------------

type PublicError =
  | "invalid-json"
  | "invalid-submission"
  | "missing-fields"
  | "invalid-email"
  | "disposable-email"
  | "submission-too-fast"
  | "rate-limited"
  | "service-not-configured";

interface PublicErrorBody {
  error: PublicError;
  fields?: string[];
}

function publicError(
  error: PublicError,
  status: number,
  extra: Partial<PublicErrorBody> = {},
) {
  return NextResponse.json<PublicErrorBody>(
    { error, ...extra },
    { status },
  );
}

// ---------------------------------------------------------------------------
// Submit handler
// ---------------------------------------------------------------------------

/**
 * POST /api/scorecard/submit
 *
 * Public scorecard submission endpoint. Accepts an answers payload, runs
 * server-side scoring, classifies email quality + bot signals, and
 * persists the submission + lead chain. Internal anti-abuse internals
 * (reasons, fingerprint, durations) are stored server-side only.
 *
 * Returns ONLY a public-safe response shape:
 *   { submissionId, result: PublicScoreResult, displayContext }
 */
export async function POST(request: NextRequest) {
  let payload: {
    answers?: unknown;
    clientMeta?: unknown;
    honeypot?: unknown;
  };
  try {
    payload = await request.json();
  } catch {
    return publicError("invalid-json", 400);
  }

  const answers = sanitizeAnswers(payload?.answers);
  if (!answers) {
    return publicError("invalid-submission", 400);
  }

  // ---- Honeypot ------------------------------------------------------------
  // If the hidden field came back filled, this is almost certainly a bot.
  // Reject with a generic invalid-submission shape — never reveal the
  // honeypot's existence.
  const honeypotValue = readHoneypot(payload, answers);
  if (honeypotValue && honeypotValue.length > 0) {
    return publicError("invalid-submission", 400);
  }

  // ---- Client-meta + duration ---------------------------------------------
  const clientMetaInput = sanitizeClientMetaInput(payload?.clientMeta);
  const submissionDurationMs = readDurationMs(clientMetaInput);

  let abuseStatus: "accepted" | "flagged" = "accepted";
  const abuseReasons: string[] = [];

  if (
    typeof submissionDurationMs === "number" &&
    submissionDurationMs < MIN_DURATION_MS_REJECT
  ) {
    return publicError("submission-too-fast", 400);
  }
  if (
    typeof submissionDurationMs === "number" &&
    submissionDurationMs < MIN_DURATION_MS_ACCEPT
  ) {
    abuseStatus = "flagged";
    abuseReasons.push("submission_duration_short");
  }

  // ---- Required contact fields --------------------------------------------
  const validation = validateContactFields(answers);
  if (!validation.ok) {
    return publicError("missing-fields", 400, { fields: validation.missing });
  }

  // ---- Email quality classification ---------------------------------------
  const rawEmail = String(answers["contact.email"]).trim();
  const emailInfo = classifyEmailQuality(rawEmail);
  if (emailInfo.rejection === "invalid_format") {
    return publicError("invalid-email", 400);
  }
  if (emailInfo.rejection === "disposable_blocked") {
    return publicError("disposable-email", 400);
  }
  if (emailInfo.quality === "free_email") {
    abuseReasons.push(...emailInfo.reasons);
    if (abuseStatus === "accepted") abuseStatus = "flagged";
  } else if (emailInfo.reasons.length > 0) {
    abuseReasons.push(...emailInfo.reasons);
  }

  // Snap the validated email back into the answers payload so the rest
  // of the chain stores a normalized value.
  answers["contact.email"] = emailInfo.normalized;

  // ---- Score server-side ---------------------------------------------------
  const result = scoreScorecard(answers);

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    return publicError("service-not-configured", 503);
  }

  // ---- Rate limiting -------------------------------------------------------
  // Cheap counts against scorecard_submissions for the past hour. Free
  // providers skip the domain bucket; the per-email bucket always
  // applies.
  const rateLimited = await checkRateLimits(
    supabase,
    emailInfo.normalized,
    emailInfo.domain,
    emailInfo.quality,
  );
  if (rateLimited.limited) {
    return publicError("rate-limited", 429);
  }

  // ---- Workspace + account + contact upserts -------------------------------
  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id")
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (workspaceError || !workspace?.id) {
    return logAndError(workspaceError, "workspace-missing");
  }
  const workspaceId = workspace.id;

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

  const firstName = String(answers["contact.firstName"] ?? "").trim();
  const lastName = String(answers["contact.lastName"] ?? "").trim();
  const fullName = [firstName, lastName].filter(Boolean).join(" ") || null;
  const role = stringOrNull(answers["contact.role"]);

  const { data: existingContact, error: existingContactError } = await supabase
    .from("contacts")
    .select("id")
    .eq("account_id", accountId)
    .eq("email", emailInfo.normalized)
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
        email: emailInfo.normalized,
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
  const clientMeta = buildPersistedClientMeta(clientMetaInput, request);
  const fingerprintHash = computeFingerprintHash(
    request,
    clientMetaInput,
    emailInfo.normalized,
  );

  const { data: insertedSubmission, error: submissionInsertError } =
    await supabase
      .from("scorecard_submissions")
      .insert({
        submitted_email: emailInfo.normalized,
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
        email_normalized: emailInfo.normalized,
        email_domain: emailInfo.domain || null,
        email_quality: emailInfo.quality,
        email_verified: false,
        anti_abuse_status: abuseStatus,
        anti_abuse_reasons: abuseReasons,
        submission_duration_ms:
          typeof submissionDurationMs === "number" ? submissionDurationMs : null,
        honeypot_value: null, // never store the bot payload itself
        client_fingerprint_hash: fingerprintHash,
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

  const trustStatus: "unverified" | "flagged" = abuseStatus === "flagged"
    ? "flagged"
    : "unverified";
  const trustReasons = [...abuseReasons, ...emailInfo.reasons];

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
      trust_status: trustStatus,
      trust_reasons: dedupe(trustReasons),
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

function readHoneypot(
  payload: { honeypot?: unknown },
  answers: Answers,
): string | null {
  const top = payload?.honeypot;
  if (typeof top === "string" && top.trim().length > 0) return top.trim();
  // The honeypot may also surface as a stray answer key if a bot blindly
  // mirrors form fields into the answers payload.
  const inAnswers = answers[HONEYPOT_FIELD];
  if (typeof inAnswers === "string" && inAnswers.trim().length > 0) {
    return inAnswers.trim();
  }
  return null;
}

function sanitizeClientMetaInput(raw: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string" && v.length <= 1024) out[k] = v;
  }
  return out;
}

function readDurationMs(meta: Record<string, string>): number | null {
  // Prefer an explicit `submissionDurationMs` if present; otherwise diff
  // `startedAtIso` against `completedAtIso` if both are well-formed.
  const direct = meta.submissionDurationMs;
  if (direct) {
    const n = Number(direct);
    if (Number.isFinite(n) && n >= 0) return Math.floor(n);
  }
  const startedAt = parseIso(meta.startedAtIso);
  const completedAt = parseIso(meta.completedAtIso) ?? new Date();
  if (startedAt) {
    const diff = completedAt.getTime() - startedAt.getTime();
    if (Number.isFinite(diff) && diff >= 0) return diff;
  }
  return null;
}

function parseIso(value: string | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

function buildPersistedClientMeta(
  meta: Record<string, string>,
  request: NextRequest,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...meta };
  out.userAgent = request.headers.get("user-agent")?.slice(0, 512) ?? null;
  out.ipHash = null; // intentionally never collected
  out.submittedAtIso = new Date().toISOString();
  return out;
}

function computeFingerprintHash(
  request: NextRequest,
  meta: Record<string, string>,
  normalizedEmail: string,
): string | null {
  // Very lightweight — UA + a client-supplied locale/timezone + the
  // normalized email. NOT a tracking fingerprint, just a coarse bucket
  // for repeat-submission patterns. We never store the input.
  const ua = request.headers.get("user-agent") ?? "";
  const locale = meta.locale ?? "";
  const tz = meta.timezone ?? "";
  if (!ua && !normalizedEmail) return null;
  return createHash("sha256")
    .update(`${ua}|${locale}|${tz}|${normalizedEmail}`)
    .digest("hex");
}

async function checkRateLimits(
  supabase: ReturnType<typeof createSupabaseServiceClient>,
  email: string,
  domain: string,
  quality: EmailClassification["quality"],
): Promise<{ limited: boolean }> {
  const emailWindowFromIso = new Date(
    Date.now() - RATE_WINDOW_EMAIL_MS,
  ).toISOString();
  const domainWindowFromIso = new Date(
    Date.now() - RATE_WINDOW_DOMAIN_MS,
  ).toISOString();

  // Per-email bucket — applies to every email regardless of quality.
  if (email) {
    const { count, error } = await supabase
      .from("scorecard_submissions")
      .select("id", { count: "exact", head: true })
      .eq("email_normalized", email)
      .gte("submitted_at", emailWindowFromIso);
    if (!error && typeof count === "number" && count >= RATE_WINDOW_EMAIL_MAX) {
      return { limited: true };
    }
  }

  // Per-business-domain bucket — skip for free providers (gmail.com,
  // outlook.com, etc.) because many real prospects share those domains.
  if (domain && quality !== "free_email") {
    const { count, error } = await supabase
      .from("scorecard_submissions")
      .select("id", { count: "exact", head: true })
      .eq("email_domain", domain)
      .gte("submitted_at", domainWindowFromIso);
    if (!error && typeof count === "number" && count >= RATE_WINDOW_DOMAIN_MAX) {
      return { limited: true };
    }
  }

  return { limited: false };
}

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values.filter((v) => typeof v === "string")));
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
  // Deeper email validation runs in classifyEmailQuality below.
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

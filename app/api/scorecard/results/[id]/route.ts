import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServiceClient } from "@/lib/supabase/service";
import { scoreScorecard } from "@/lib/scorecard/scoring";
import { toPublicScoreResult } from "@/lib/scorecard/public-result";
import type { Answers } from "@/lib/scorecard/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/scorecard/results/[id]
 *
 * Public, read-only endpoint that returns the prospect-facing result for
 * a previously persisted submission.
 *
 * Privacy posture:
 *   - Selects an explicit, prospect-safe column list. Never selects
 *     `internal_fit_score` or `lead_id`.
 *   - The full {@link toPublicScoreResult} conversion drops `fit` again
 *     after re-running scoring server-side (defense in depth).
 *   - Reads through the service-role client (anon RLS denies select on
 *     submissions); the client never reaches the browser.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = params.id;
  if (!isUuid(id)) {
    return NextResponse.json({ error: "invalid-id" }, { status: 400 });
  }

  let supabase;
  try {
    supabase = createSupabaseServiceClient();
  } catch {
    return NextResponse.json(
      { error: "service-not-configured" },
      { status: 503 },
    );
  }

  const { data: submission, error: submissionError } = await supabase
    .from("scorecard_submissions")
    .select(
      [
        "id",
        "submitted_first_name",
        "submitted_company",
        "submitted_at",
      ].join(","),
    )
    .eq("id", id)
    .maybeSingle<{
      id: string;
      submitted_first_name: string | null;
      submitted_company: string | null;
      submitted_at: string;
    }>();
  if (submissionError) {
    // eslint-disable-next-line no-console
    console.error("[scorecard.results] submission-lookup-failed", {
      name: (submissionError as { name?: string }).name,
      code: (submissionError as { code?: string }).code,
      message: (submissionError as { message?: string }).message,
    });
    return NextResponse.json({ error: "lookup-failed" }, { status: 500 });
  }
  if (!submission) {
    return NextResponse.json({ error: "not-found" }, { status: 404 });
  }

  const { data: answerRows, error: answersError } = await supabase
    .from("scorecard_answers")
    .select("question_id, value")
    .eq("submission_id", id);
  if (answersError) {
    return NextResponse.json({ error: "lookup-failed" }, { status: 500 });
  }

  const answers: Answers = {};
  for (const row of answerRows ?? []) {
    const v = (row as { value: unknown }).value;
    if (typeof v === "string" || typeof v === "number") {
      answers[(row as { question_id: string }).question_id] = v;
    } else if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      answers[(row as { question_id: string }).question_id] = v as string[];
    }
  }

  const result = scoreScorecard(answers);

  return NextResponse.json({
    submissionId: submission.id,
    result: toPublicScoreResult(result),
    displayContext: {
      firstName: submission.submitted_first_name,
      company: submission.submitted_company,
    },
  });
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
    s,
  );
}

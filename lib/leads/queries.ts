import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { scoreScorecard } from "@/lib/scorecard/scoring";
import type { Answers, AnswerValue, OpportunityArea } from "@/lib/scorecard/types";
import {
  mapFitDimensionRow,
  mapLeadRowToListLead,
  mapQualificationSignalRow,
  orderFitDimensions,
  type DbFitDimensionRow,
  type DbLeadRow,
  type DbQualificationSignalRow,
} from "./mappers";
import type { Lead } from "./types";

/**
 * Server-only query layer for the persisted lead surface.
 *
 * Uses the authenticated server Supabase client so RLS is exercised on
 * every read. The internal app's middleware already redirects
 * unauthenticated requests to /login before any of these run, but the
 * RLS policies are still the boundary that prevents an unauthenticated
 * caller from ever reading a lead row.
 */

const LEAD_LIST_SELECT = `
  id,
  source,
  practice_area,
  status,
  internal_fit_score,
  prospect_scores,
  recommended_action,
  submission_id,
  last_activity_at,
  created_at,
  trust_status,
  trust_reasons,
  accounts:account_id ( name, industry, employee_range, revenue_range ),
  contacts:contact_id ( full_name, title, email ),
  scorecard_submissions:submission_id ( submitted_at )
` as const;

interface RawLeadJoinRow {
  id: string;
  source: string;
  practice_area: string;
  status: string;
  internal_fit_score: number | null;
  prospect_scores: DbLeadRow["prospect_scores"];
  recommended_action: DbLeadRow["recommended_action"];
  submission_id: string | null;
  last_activity_at: string;
  created_at: string;
  trust_status: string | null;
  trust_reasons: string[] | null;
  accounts: DbLeadRow["accounts"];
  contacts: DbLeadRow["contacts"];
  scorecard_submissions: { submitted_at: string | null } | null;
}

function toDbLeadRow(raw: RawLeadJoinRow): DbLeadRow {
  return {
    id: raw.id,
    source: raw.source,
    practice_area: raw.practice_area,
    status: raw.status,
    internal_fit_score: raw.internal_fit_score,
    prospect_scores: raw.prospect_scores,
    recommended_action: raw.recommended_action,
    submission_id: raw.submission_id,
    last_activity_at: raw.last_activity_at,
    created_at: raw.created_at,
    trust_status: raw.trust_status,
    trust_reasons: raw.trust_reasons,
    accounts: raw.accounts,
    contacts: raw.contacts,
    submission_submitted_at: raw.scorecard_submissions?.submitted_at ?? null,
  };
}

/** Fetch all leads in the workspace, newest activity first. */
export async function getAllLeads(): Promise<Lead[]> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("leads")
    .select(LEAD_LIST_SELECT)
    .order("last_activity_at", { ascending: false });

  if (error) {
    console.error("[leads.queries] getAllLeads failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  if (!data) return [];

  return (data as unknown as RawLeadJoinRow[]).map((raw) => {
    const partial = mapLeadRowToListLead(toDbLeadRow(raw));
    return {
      ...partial,
      fitDimensions: [],
      qualificationSignals: [],
      opportunityAreas: [],
      riskNotes: [],
      notes: [],
    } satisfies Lead;
  });
}

/** Fetch a single lead with its fit dimensions, qualification signals,
 *  and re-derived opportunity areas + risk notes (from the persisted
 *  scorecard answers if available). Returns null when the lead does not
 *  exist or RLS denies the read. */
export async function getLeadById(id: string): Promise<Lead | null> {
  if (!isUuid(id)) return null;
  const supabase = createSupabaseServerClient();

  const { data: raw, error } = await supabase
    .from("leads")
    .select(LEAD_LIST_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[leads.queries] getLeadById failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return null;
  }
  if (!raw) return null;

  const dbRow = toDbLeadRow(raw as unknown as RawLeadJoinRow);
  const partial = mapLeadRowToListLead(dbRow);

  const [dimensions, signals, derived] = await Promise.all([
    fetchFitDimensions(id),
    fetchQualificationSignals(id),
    deriveOpportunityAndRisk(dbRow.submission_id),
  ]);

  return {
    ...partial,
    fitDimensions: dimensions,
    qualificationSignals: signals,
    opportunityAreas: derived.opportunityAreas,
    riskNotes: derived.riskNotes,
    notes: [],
  } satisfies Lead;
}

async function fetchFitDimensions(leadId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("lead_fit_dimensions")
    .select("dimension_id, value, note")
    .eq("lead_id", leadId);
  if (error || !data) return [];
  const mapped = (data as DbFitDimensionRow[])
    .map(mapFitDimensionRow)
    .filter((d): d is NonNullable<typeof d> => Boolean(d));
  return orderFitDimensions(mapped);
}

async function fetchQualificationSignals(leadId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("lead_qualification_signals")
    .select("id, label, detail, direction, position")
    .eq("lead_id", leadId)
    .order("position", { ascending: true });
  if (error || !data) return [];
  return (data as DbQualificationSignalRow[]).map(mapQualificationSignalRow);
}

interface DerivedOpportunityAndRisk {
  opportunityAreas: OpportunityArea[];
  riskNotes: string[];
}

async function deriveOpportunityAndRisk(
  submissionId: string | null,
): Promise<DerivedOpportunityAndRisk> {
  if (!submissionId) {
    return { opportunityAreas: [], riskNotes: [] };
  }
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("scorecard_answers")
    .select("question_id, value")
    .eq("submission_id", submissionId);
  if (error || !data) {
    return { opportunityAreas: [], riskNotes: [] };
  }
  const answers: Answers = {};
  for (const row of data as Array<{
    question_id: string;
    value: unknown;
  }>) {
    const v = row.value;
    if (typeof v === "string" || typeof v === "number") {
      answers[row.question_id] = v as AnswerValue;
    } else if (Array.isArray(v) && v.every((x) => typeof x === "string")) {
      answers[row.question_id] = v as string[];
    }
  }
  const result = scoreScorecard(answers);
  return {
    opportunityAreas: result.opportunities,
    riskNotes: result.riskNotes,
  };
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isUuid(s: string): boolean {
  return UUID_RE.test(s);
}

import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isUuid,
  mapFindingRow,
  type DbFindingRow,
  type DbFindingSourceRefRow,
} from "./mappers";
import type { Finding } from "./types";

/**
 * Server-only query layer for persisted findings.
 *
 * Uses the authenticated server Supabase client so RLS is the boundary,
 * not application code. Service role is intentionally not used — every
 * read in this module belongs to an authenticated operator.
 */

const FINDING_SELECT = `
  id,
  workspace_id,
  engagement_id,
  category,
  statement,
  summary,
  evidence_summary,
  confidence,
  review_status,
  suggested_impact,
  assumption_flag,
  assumption_note,
  reviewer_note,
  ai_drafted,
  position,
  reviewed_by,
  last_reviewed_at,
  created_at,
  updated_at
` as const;

const SOURCE_REF_SELECT = `
  id,
  workspace_id,
  engagement_id,
  finding_id,
  source_type,
  source_id,
  source_label,
  source_role,
  excerpt,
  strength,
  metadata,
  created_at
` as const;

export interface FindingsStatusSummary {
  total: number;
  needsReview: number;
  approved: number;
  rejected: number;
  reportReady: number;
  draft: number;
  edited: number;
  lowEvidence: number;
}

export async function getFindingsForEngagementPersisted(
  engagementId: string,
): Promise<Finding[]> {
  if (!isUuid(engagementId)) return [];
  const supabase = createSupabaseServerClient();
  const { data: findings, error } = await supabase
    .from("findings")
    .select(FINDING_SELECT)
    .eq("engagement_id", engagementId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  if (error) {
    console.error("[findings.queries] getFindingsForEngagement failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return [];
  }
  const rows = (findings as unknown as DbFindingRow[]) ?? [];
  if (rows.length === 0) return [];

  const findingIds = rows.map((r) => r.id);
  const { data: refs, error: refsError } = await supabase
    .from("finding_source_refs")
    .select(SOURCE_REF_SELECT)
    .in("finding_id", findingIds);
  if (refsError) {
    console.error("[findings.queries] source-refs-fetch-failed", {
      name: refsError.name,
      code: refsError.code,
      message: refsError.message,
    });
  }
  const refRows = (refs as unknown as DbFindingSourceRefRow[]) ?? [];

  return rows.map((row) =>
    mapFindingRow(
      row,
      refRows.filter((r) => r.finding_id === row.id),
    ),
  );
}

export async function getFindingByIdPersisted(
  findingId: string,
): Promise<Finding | null> {
  if (!isUuid(findingId)) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("findings")
    .select(FINDING_SELECT)
    .eq("id", findingId)
    .maybeSingle();
  if (error || !data) {
    if (error) {
      console.error("[findings.queries] getFindingById failed", {
        name: error.name,
        code: error.code,
        message: error.message,
      });
    }
    return null;
  }
  const row = data as unknown as DbFindingRow;
  const { data: refs } = await supabase
    .from("finding_source_refs")
    .select(SOURCE_REF_SELECT)
    .eq("finding_id", row.id);
  return mapFindingRow(
    row,
    (refs as unknown as DbFindingSourceRefRow[]) ?? [],
  );
}

export async function getFindingsStatusSummary(
  engagementId: string,
): Promise<FindingsStatusSummary | null> {
  if (!isUuid(engagementId)) return null;
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("findings")
    .select("review_status, confidence")
    .eq("engagement_id", engagementId);
  if (error) {
    console.error("[findings.queries] status-summary-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return null;
  }
  const rows =
    (data as unknown as Array<{
      review_status: string | null;
      confidence: string | null;
    }>) ?? [];
  const summary: FindingsStatusSummary = {
    total: rows.length,
    needsReview: 0,
    approved: 0,
    rejected: 0,
    reportReady: 0,
    draft: 0,
    edited: 0,
    lowEvidence: 0,
  };
  for (const r of rows) {
    switch (r.review_status) {
      case "needs_review":
        summary.needsReview += 1;
        break;
      case "approved":
        summary.approved += 1;
        break;
      case "rejected":
        summary.rejected += 1;
        break;
      case "report_ready":
        summary.reportReady += 1;
        break;
      case "draft":
        summary.draft += 1;
        break;
      case "edited":
        summary.edited += 1;
        break;
      default:
        break;
    }
    if (r.confidence === "low" || r.confidence === "needs_evidence") {
      summary.lowEvidence += 1;
    }
  }
  return summary;
}

// ---------------------------------------------------------------------------
// Evidence candidates — used by the manual create-finding form so the
// operator can attach existing intake responses or input assets as
// source references when authoring a finding.
// ---------------------------------------------------------------------------

export interface EvidenceCandidate {
  id: string;
  type: "stakeholder-response" | "input-asset";
  /** Display label — stakeholder name + question label, or asset title. */
  label: string;
  /** Optional sub-label (role for responses, asset type for assets). */
  sublabel?: string;
  /** Excerpt to seed the source ref's quoted excerpt. */
  excerpt: string;
}

export async function getEvidenceCandidatesForEngagement(
  engagementId: string,
): Promise<EvidenceCandidate[]> {
  if (!isUuid(engagementId)) return [];
  const supabase = createSupabaseServerClient();

  // Stakeholder responses + sessions (two cheap reads, joined in JS to
  // avoid relying on PostgREST relationship inference).
  const { data: responses, error: responsesError } = await supabase
    .from("stakeholder_responses")
    .select("id, session_id, question_id, question_label, answer_text")
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (responsesError) {
    console.error("[findings.queries] response-candidates-failed", {
      name: responsesError.name,
      code: responsesError.code,
      message: responsesError.message,
    });
  }
  const responseRows =
    (responses as unknown as Array<{
      id: string;
      session_id: string;
      question_id: string;
      question_label: string | null;
      answer_text: string | null;
    }>) ?? [];

  const sessionLookup: Record<
    string,
    {
      stakeholder_name: string | null;
      stakeholder_title: string | null;
      role: string | null;
    }
  > = {};
  if (responseRows.length > 0) {
    const sessionIds = Array.from(
      new Set(responseRows.map((r) => r.session_id)),
    );
    const { data: sessions } = await supabase
      .from("stakeholder_intake_sessions")
      .select("id, stakeholder_name, stakeholder_title, role")
      .in("id", sessionIds);
    for (const s of (sessions as unknown as Array<{
      id: string;
      stakeholder_name: string | null;
      stakeholder_title: string | null;
      role: string | null;
    }>) ?? []) {
      sessionLookup[s.id] = {
        stakeholder_name: s.stakeholder_name,
        stakeholder_title: s.stakeholder_title,
        role: s.role,
      };
    }
  }

  const responseCandidates = responseRows
    .filter((r) => (r.answer_text ?? "").trim().length > 0)
    .map<EvidenceCandidate>((r) => {
      const session = sessionLookup[r.session_id];
      const stakeholder =
        session?.stakeholder_name?.trim() || "Stakeholder";
      const role = session?.stakeholder_title?.trim() || undefined;
      const question = r.question_label?.trim() || r.question_id;
      const excerpt = (r.answer_text ?? "").trim();
      return {
        id: r.id,
        type: "stakeholder-response",
        label: `${stakeholder} · ${question}`,
        sublabel: role,
        excerpt:
          excerpt.length > 320 ? `${excerpt.slice(0, 317)}…` : excerpt,
      };
    });

  // Input assets.
  const { data: assets, error: assetsError } = await supabase
    .from("input_assets")
    .select("id, title, asset_type, summary")
    .eq("engagement_id", engagementId)
    .order("created_at", { ascending: false })
    .limit(50);
  const assetCandidates = ((assets as unknown as Array<{
    id: string;
    title: string;
    asset_type: string | null;
    summary: string | null;
  }>) ?? []).map<EvidenceCandidate>((a) => ({
    id: a.id,
    type: "input-asset",
    label: a.title,
    sublabel: a.asset_type ?? undefined,
    excerpt: (a.summary ?? "").trim(),
  }));
  if (assetsError) {
    console.error("[findings.queries] asset-candidates-failed", {
      name: assetsError.name,
      code: assetsError.code,
      message: assetsError.message,
    });
  }

  return [...responseCandidates, ...assetCandidates];
}

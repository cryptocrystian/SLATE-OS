import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  isUuid,
  mapReportRow,
  mapReportSectionRow,
  type DbReportRow,
  type DbReportSectionLinkRow,
  type DbReportSectionRow,
} from "./mappers";
import { SECTION_ORDER } from "./helpers";
import type { Report, ReportSection } from "./types";
import type { CopySlopSummary } from "@/lib/ai/copy-slop";

/**
 * Server-only query layer for persisted reports.
 *
 * Uses the authenticated server Supabase client so RLS is the boundary.
 */

const REPORT_SELECT = `
  id,
  workspace_id,
  engagement_id,
  title,
  status,
  generated_at,
  last_edited_at,
  recommended_next_step,
  consultant_notes,
  export_status,
  reviewed_by,
  last_reviewed_at,
  created_at,
  updated_at
` as const;

const SECTION_SELECT = `
  id,
  workspace_id,
  engagement_id,
  report_id,
  section_type,
  title,
  status,
  summary,
  draft_preview,
  evidence_notes,
  reviewer_note,
  ai_drafted,
  confidence,
  position,
  reviewed_by,
  last_reviewed_at,
  exhibit_slot,
  created_at,
  updated_at
` as const;

const FINDING_LINK_SELECT = `
  id,
  workspace_id,
  engagement_id,
  report_section_id,
  finding_id,
  created_at
` as const;

const OPPORTUNITY_LINK_SELECT = `
  id,
  workspace_id,
  engagement_id,
  report_section_id,
  opportunity_id,
  created_at
` as const;

const ROADMAP_LINK_SELECT = `
  id,
  workspace_id,
  engagement_id,
  report_section_id,
  roadmap_item_id,
  created_at
` as const;

export interface ReportStatusSummary {
  exists: boolean;
  status: string;
  total: number;
  notStarted: number;
  drafted: number;
  needsReview: number;
  approved: number;
  final: number;
  evidenceLinks: number;
  exportStatus: string;
}

export async function getReportForEngagementPersisted(
  engagementId: string,
): Promise<Report | null> {
  if (!isUuid(engagementId)) return null;
  const supabase = createSupabaseServerClient();
  const { data: reportData, error: reportError } = await supabase
    .from("reports")
    .select(REPORT_SELECT)
    .eq("engagement_id", engagementId)
    .maybeSingle();
  if (reportError) {
    console.error("[reports.queries] report-fetch-failed", {
      name: reportError.name,
      code: reportError.code,
      message: reportError.message,
    });
    return null;
  }
  if (!reportData) return null;
  const reportRow = reportData as unknown as DbReportRow;

  const { data: sectionsData, error: sectionsError } = await supabase
    .from("report_sections")
    .select(SECTION_SELECT)
    .eq("report_id", reportRow.id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (sectionsError) {
    console.error("[reports.queries] sections-fetch-failed", {
      name: sectionsError.name,
      code: sectionsError.code,
      message: sectionsError.message,
    });
  }
  const sectionRows = (sectionsData as unknown as DbReportSectionRow[]) ?? [];

  let findingLinks: DbReportSectionLinkRow[] = [];
  let opportunityLinks: DbReportSectionLinkRow[] = [];
  let roadmapLinks: DbReportSectionLinkRow[] = [];

  if (sectionRows.length > 0) {
    const sectionIds = sectionRows.map((s) => s.id);
    const [
      { data: findingLinkData },
      { data: opportunityLinkData },
      { data: roadmapLinkData },
    ] = await Promise.all([
      supabase
        .from("report_section_finding_links")
        .select(FINDING_LINK_SELECT)
        .in("report_section_id", sectionIds),
      supabase
        .from("report_section_opportunity_links")
        .select(OPPORTUNITY_LINK_SELECT)
        .in("report_section_id", sectionIds),
      supabase
        .from("report_section_roadmap_links")
        .select(ROADMAP_LINK_SELECT)
        .in("report_section_id", sectionIds),
    ]);
    findingLinks =
      (findingLinkData as unknown as DbReportSectionLinkRow[]) ?? [];
    opportunityLinks =
      (opportunityLinkData as unknown as DbReportSectionLinkRow[]) ?? [];
    roadmapLinks =
      (roadmapLinkData as unknown as DbReportSectionLinkRow[]) ?? [];
  }

  const sections: ReportSection[] = sectionRows.map((row) =>
    mapReportSectionRow(row, findingLinks, opportunityLinks, roadmapLinks),
  );

  // Apply canonical order — DB position is authoritative when set, but
  // fall back to canonical order for sections that share position 0.
  const canonicalIndex = new Map(SECTION_ORDER.map((t, i) => [t, i] as const));
  sections.sort((a, b) => {
    const ia = canonicalIndex.get(a.sectionType) ?? 999;
    const ib = canonicalIndex.get(b.sectionType) ?? 999;
    return ia - ib;
  });

  return mapReportRow(reportRow, sections);
}

export async function getReportStatusSummary(
  engagementId: string,
): Promise<ReportStatusSummary | null> {
  if (!isUuid(engagementId)) return null;
  const supabase = createSupabaseServerClient();
  const { data: reportData, error: reportError } = await supabase
    .from("reports")
    .select("id, status, export_status")
    .eq("engagement_id", engagementId)
    .maybeSingle<{ id: string; status: string | null; export_status: string | null }>();
  if (reportError) {
    console.error("[reports.queries] status-summary-report-failed", {
      name: reportError.name,
      code: reportError.code,
      message: reportError.message,
    });
    return null;
  }
  if (!reportData) {
    return {
      exists: false,
      status: "draft",
      total: 0,
      notStarted: 0,
      drafted: 0,
      needsReview: 0,
      approved: 0,
      final: 0,
      evidenceLinks: 0,
      exportStatus: "locked",
    };
  }

  const { data: sectionsData, error: sectionsError } = await supabase
    .from("report_sections")
    .select("id, status")
    .eq("report_id", reportData.id);
  if (sectionsError) {
    console.error("[reports.queries] status-summary-sections-failed", {
      name: sectionsError.name,
      code: sectionsError.code,
      message: sectionsError.message,
    });
  }
  const sectionRows =
    (sectionsData as unknown as Array<{
      id: string;
      status: string | null;
    }>) ?? [];

  let notStarted = 0;
  let drafted = 0;
  let needsReview = 0;
  let approved = 0;
  let final = 0;
  for (const s of sectionRows) {
    switch (s.status) {
      case "drafted":
        drafted += 1;
        break;
      case "needs_review":
        needsReview += 1;
        break;
      case "approved":
        approved += 1;
        break;
      case "final":
        final += 1;
        break;
      case "not_started":
      default:
        notStarted += 1;
        break;
    }
  }

  let evidenceLinks = 0;
  if (sectionRows.length > 0) {
    const sectionIds = sectionRows.map((s) => s.id);
    const [findingLinks, opportunityLinks, roadmapLinks] = await Promise.all([
      supabase
        .from("report_section_finding_links")
        .select("id", { count: "exact", head: true })
        .in("report_section_id", sectionIds),
      supabase
        .from("report_section_opportunity_links")
        .select("id", { count: "exact", head: true })
        .in("report_section_id", sectionIds),
      supabase
        .from("report_section_roadmap_links")
        .select("id", { count: "exact", head: true })
        .in("report_section_id", sectionIds),
    ]);
    evidenceLinks =
      (findingLinks.count ?? 0) +
      (opportunityLinks.count ?? 0) +
      (roadmapLinks.count ?? 0);
  }

  return {
    exists: true,
    status: reportData.status ?? "draft",
    total: sectionRows.length,
    notStarted,
    drafted,
    needsReview,
    approved,
    final,
    evidenceLinks,
    exportStatus: reportData.export_status ?? "locked",
  };
}

/**
 * Latest copy-slop critique per section, keyed by `report_sections.id`.
 *
 * The copy-slop summary is written into `ai_synthesis_runs.output_summary`
 * at draft time (see `lib/reports/synthesis-actions.ts`). There is no
 * dedicated column — the section linkage lives in the JSON `sectionId`
 * field — so we read the completed `report_section_draft` runs newest-first
 * and keep the first (latest) summary seen per section. Sections whose most
 * recent draft predates the copy-slop feature simply have no entry.
 *
 * Returns an empty map on any error or for non-persisted engagements; the
 * chip is advisory and must never block the workspace from rendering.
 */
export async function getSectionCopySlopMap(
  engagementId: string,
): Promise<Map<string, CopySlopSummary>> {
  const map = new Map<string, CopySlopSummary>();
  if (!isUuid(engagementId)) return map;

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("ai_synthesis_runs")
    .select("output_summary, completed_at")
    .eq("engagement_id", engagementId)
    .eq("run_type", "report_section_draft")
    .eq("status", "completed")
    .order("completed_at", { ascending: false });
  if (error) {
    console.error("[reports.queries] copy-slop-map-failed", {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    return map;
  }

  for (const row of (data as { output_summary: unknown }[] | null) ?? []) {
    const summary = row.output_summary;
    if (!summary || typeof summary !== "object") continue;
    const sectionId = (summary as { sectionId?: unknown }).sectionId;
    const copySlop = (summary as { copySlop?: unknown }).copySlop;
    if (typeof sectionId !== "string") continue;
    if (map.has(sectionId)) continue; // newest-first: keep the first seen
    const parsed = parseCopySlopSummary(copySlop);
    if (parsed) map.set(sectionId, parsed);
  }
  return map;
}

/** Defensive parse of a persisted copy-slop summary (unknown JSON → typed). */
function parseCopySlopSummary(raw: unknown): CopySlopSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const severity = o.severity;
  if (
    severity !== "none" &&
    severity !== "low" &&
    severity !== "elevated" &&
    severity !== "high"
  ) {
    return null;
  }
  return {
    severity,
    flagCount: typeof o.flagCount === "number" ? o.flagCount : 0,
    density: typeof o.density === "number" ? o.density : 0,
    categories: Array.isArray(o.categories)
      ? (o.categories.filter((c) => typeof c === "string") as CopySlopSummary["categories"])
      : [],
  };
}

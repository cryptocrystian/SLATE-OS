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

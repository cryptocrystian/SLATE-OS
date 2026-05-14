/**
 * Phase 1B Sprint 4C-B — report delivery snapshot TypeScript shapes.
 *
 * Mirrors the `public.report_delivery_snapshots` table created by
 * migration `0013_report_delivery_snapshots.sql`. Snapshots are
 * point-in-time delivery artifacts; the first implementation (this
 * sprint) stores metadata only and never produces a PDF binary.
 *
 * Pure module — no React, no DB, no I/O.
 */

import type { ReportExhibitSlot } from "@/lib/charts/adapters/types";

export type ReportDeliverySnapshotStatus =
  | "candidate"
  | "generated"
  | "voided";

export type ReportDeliverySurface =
  | "internal_candidate"
  | "client_pdf_candidate";

/**
 * Per-section snapshot. Captures the values that were rendered into
 * the artifact at generation time. Reviewer notes are intentionally
 * excluded by default (see canon §10).
 */
export interface ReportDeliverySectionSnapshot {
  sectionId: string;
  sectionType: string;
  status: string;
  position: number;
  title: string;
  summary: string;
  draftPreview: string;
  evidenceNotes: string;
  exhibitSlot: ReportExhibitSlot | null;
  aiDrafted: boolean;
  confidence: string;
  updatedAt: string | null;
  lastReviewedAt: string | null;
  includedInArtifact: boolean;
}

/**
 * Per-Group-A exhibit snapshot. Records the adapter result envelope as
 * it stood at generation time so the snapshot is self-contained.
 */
export interface ReportDeliveryExhibitSnapshot {
  slot: ReportExhibitSlot;
  adapterStatus: "ready" | "insufficient_data" | "invalid_data" | "gated";
  renderedInArtifact: boolean;
  sourceSummary: {
    source: string;
    rowCount: number;
    generatedAt: string;
    freshness: "fresh" | "stale" | "unknown";
  };
  issues: ReadonlyArray<{
    code: string;
    severity: "info" | "warning" | "error";
    message: string;
    field?: string;
  }>;
}

/**
 * Source-summary digest. Mirrors per-slot summaries on
 * `exhibit_snapshot[].sourceSummary` but adds a top-level fresh/stale
 * digest plus accepted-staleness tracking.
 */
export interface ReportDeliverySourceSummarySnapshot {
  digest: {
    freshSlots: number;
    staleSlots: number;
    unknownSlots: number;
  };
  acceptedStaleSlots: ReportExhibitSlot[];
}

/**
 * Result of the export-time claim-guard scan. The shape is canonized
 * in `docs/20` § Claim Guard / Content Safety.
 */
export interface ReportDeliveryClaimGuardResult {
  scannedFields: string[];
  scannedFieldCount: number;
  patternsApplied: ReadonlyArray<
    "financial" | "commercial-finality" | "roadmap-commitment"
  >;
  patternCount: number;
  violations: ReadonlyArray<{
    field: string;
    code: string;
    patternFamily: "financial" | "commercial-finality" | "roadmap-commitment";
  }>;
  passed: boolean;
  scanDurationMs: number;
  version: string;
}

/**
 * Omission appendix entry. The canonical Group-B confirmation entry is
 * always present; per-Group-A omissions land alongside it.
 */
export interface ReportDeliveryOmittedExhibit {
  /**
   * Either a Group-A `ReportExhibitSlot` value or the literal string
   * `"group_b_block"` for the canonical Group-B omission entry.
   */
  slot: ReportExhibitSlot | "group_b_block";
  reason: "insufficient_data" | "invalid_data" | "gated" | "stale_rejected";
  issueCode: string;
  operatorFacingNote: string;
}

export interface ReportDeliverySnapshot {
  id: string;
  workspaceId: string;
  engagementId: string;
  reportId: string;

  status: ReportDeliverySnapshotStatus;
  deliverySurface: ReportDeliverySurface;
  reportStatusAtGeneration: string;

  generatedByUserId: string | null;
  generatedByLabel: string | null;
  generatedAt: string;

  sectionSnapshot: ReportDeliverySectionSnapshot[];
  exhibitSnapshot: ReportDeliveryExhibitSnapshot[];
  sourceSummarySnapshot: ReportDeliverySourceSummarySnapshot;
  claimGuardResult: ReportDeliveryClaimGuardResult;
  omittedExhibits: ReportDeliveryOmittedExhibit[];

  draftWatermark: boolean;

  artifactPath: string | null;
  artifactMimeType: string | null;
  artifactSizeBytes: number | null;
  artifactSha256: string | null;

  appVersion: string | null;
  commitSha: string | null;

  voidedAt: string | null;
  voidedByUserId: string | null;
  voidReason: string | null;

  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// DB row shape — exact column names from migration 0013
// ---------------------------------------------------------------------------

export interface DbReportDeliverySnapshotRow {
  id: string;
  workspace_id: string;
  engagement_id: string;
  report_id: string;
  status: string;
  delivery_surface: string;
  report_status_at_generation: string;
  generated_by: string | null;
  generated_by_label: string | null;
  generated_at: string;
  section_snapshot: unknown;
  exhibit_snapshot: unknown;
  source_summary_snapshot: unknown;
  claim_guard_result: unknown;
  omitted_exhibits: unknown;
  draft_watermark: boolean;
  artifact_path: string | null;
  artifact_mime_type: string | null;
  artifact_size_bytes: number | null;
  artifact_sha256: string | null;
  app_version: string | null;
  commit_sha: string | null;
  voided_at: string | null;
  voided_by: string | null;
  void_reason: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Group-B canonical omission entry — always present in omittedExhibits
// ---------------------------------------------------------------------------

export const GROUP_B_OMISSION_ENTRY: ReportDeliveryOmittedExhibit = {
  slot: "group_b_block",
  reason: "gated",
  issueCode: "group_b_canon_gate",
  operatorFacingNote:
    "Benchmark Comparison Bars, AI-Savings Waterfall, and ROI Bridge are intentionally omitted. They remain preview-only until docs/14 / docs/15 advance their data gates.",
};

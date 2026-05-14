/**
 * Phase 1B Sprint 4C-B — Report PDF candidate R2 readiness evaluator.
 *
 * Pure function. Takes already-fetched persisted rows + already-run
 * Group-A adapter results and decides whether a delivery snapshot can
 * be created. Returns the partitioned set of included/omitted sections
 * and exhibits, the operator-facing blockers, and the watermark flag.
 *
 * No fetching, no mutation, no React imports. Per docs/20 § Report
 * Readiness Gate R2.
 */

import type {
  ChartAdapterResult,
  ChartAdapterSourceSummary,
  ReportExhibitSlot,
} from "@/lib/charts/adapters/types";
import { isGroupAReportSlot } from "@/lib/reports/slot-map";
import type { Report, ReportSection } from "./types";
import {
  GROUP_B_OMISSION_ENTRY,
  type ReportDeliverySectionSnapshot,
  type ReportDeliveryExhibitSnapshot,
  type ReportDeliveryOmittedExhibit,
  type ReportDeliverySourceSummarySnapshot,
} from "./delivery-snapshot-types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export type ReportPdfCandidateReadinessStatus =
  | "ready"
  | "requires_acceptance"
  | "blocked";

export interface ReportPdfCandidateReadinessIssue {
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  target?: string;
}

export interface ReportPdfCandidateReadinessResult {
  status: ReportPdfCandidateReadinessStatus;
  draftWatermark: boolean;
  issues: ReportPdfCandidateReadinessIssue[];
  includedSectionIds: string[];
  omittedSectionIds: string[];
  includedExhibitSlots: ReportExhibitSlot[];
  omittedExhibits: ReportDeliveryOmittedExhibit[];
  acceptedStaleSlots: ReportExhibitSlot[];

  /** Pre-built payload pieces the action can drop straight into the snapshot row. */
  payload: {
    sectionSnapshot: ReportDeliverySectionSnapshot[];
    exhibitSnapshot: ReportDeliveryExhibitSnapshot[];
    sourceSummarySnapshot: ReportDeliverySourceSummarySnapshot;
  };
}

export interface ReportPdfCandidateReadinessInput {
  report: Report;
  adapterResults: Record<ReportExhibitSlot, ChartAdapterResult<unknown>>;
  /** Stale slots the operator has explicitly accepted at generation time. */
  acceptedStaleSlots?: ReportExhibitSlot[];
}

// ---------------------------------------------------------------------------
// Status helpers
// ---------------------------------------------------------------------------

const INCLUDABLE_NON_WATERMARK_STATUSES = new Set<ReportSection["status"]>([
  "approved",
  "final",
]);
const WATERMARK_TRIGGER_STATUSES = new Set<ReportSection["status"]>([
  "needs-review",
  "drafted",
]);

// ---------------------------------------------------------------------------
// Main evaluator
// ---------------------------------------------------------------------------

export function evaluateReportPdfCandidateReadiness(
  input: ReportPdfCandidateReadinessInput,
): ReportPdfCandidateReadinessResult {
  const { report, adapterResults } = input;
  const acceptedStaleSet = new Set<ReportExhibitSlot>(
    input.acceptedStaleSlots ?? [],
  );

  const issues: ReportPdfCandidateReadinessIssue[] = [];
  const includedSectionIds: string[] = [];
  const omittedSectionIds: string[] = [];
  const omittedExhibits: ReportDeliveryOmittedExhibit[] = [];
  const includedExhibitSlots: ReportExhibitSlot[] = [];
  const sectionSnapshot: ReportDeliverySectionSnapshot[] = [];
  const exhibitSnapshot: ReportDeliveryExhibitSnapshot[] = [];

  let draftWatermark = false;
  let requiresAcceptance = false;
  let hardBlocked = false;

  // -------------------------------------------------------------------------
  // Section partition
  // -------------------------------------------------------------------------
  if (report.sections.length === 0) {
    hardBlocked = true;
    issues.push({
      code: "no_sections",
      severity: "error",
      message:
        "Report has no sections. Initialize the report outline before generating a candidate.",
    });
  }

  for (const section of report.sections) {
    const status = section.status;
    const baseSnap: ReportDeliverySectionSnapshot = {
      sectionId: section.id,
      sectionType: section.sectionType,
      status,
      position: report.sections.indexOf(section),
      title: section.title,
      summary: section.summary,
      draftPreview: section.draftPreview,
      evidenceNotes: section.evidenceNotes,
      exhibitSlot: section.exhibitSlot ?? null,
      aiDrafted: section.aiDrafted,
      confidence: section.confidence,
      updatedAt: null,
      lastReviewedAt: null,
      includedInArtifact: false,
    };

    if (INCLUDABLE_NON_WATERMARK_STATUSES.has(status)) {
      baseSnap.includedInArtifact = true;
      includedSectionIds.push(section.id);
      sectionSnapshot.push(baseSnap);
      continue;
    }

    if (WATERMARK_TRIGGER_STATUSES.has(status)) {
      draftWatermark = true;
      baseSnap.includedInArtifact = true;
      includedSectionIds.push(section.id);
      sectionSnapshot.push(baseSnap);
      issues.push({
        code: "draft_watermark_required",
        severity: "warning",
        message: `Section "${section.title}" is in ${status}; artifact carries the Draft candidate watermark.`,
        target: section.id,
      });
      continue;
    }

    // not-started → excluded from the artifact body
    omittedSectionIds.push(section.id);
    sectionSnapshot.push(baseSnap);
  }

  if (!hardBlocked && includedSectionIds.length === 0) {
    hardBlocked = true;
    issues.push({
      code: "no_includable_sections",
      severity: "error",
      message:
        "No sections are approved, final, drafted, or in needs-review. The candidate has nothing to render.",
    });
  }

  // -------------------------------------------------------------------------
  // Exhibit slot partition — drive off persisted Group-A slots only.
  // Group-B never reaches the adapterResults map by construction
  // (`evaluateReportPdfCandidateReadiness` only accepts a Group-A keyed
  // map), but the renderer always emits the canonical Group-B omission
  // entry alongside any per-Group-A omissions.
  // -------------------------------------------------------------------------
  omittedExhibits.push(GROUP_B_OMISSION_ENTRY);

  const seenSlots = new Set<ReportExhibitSlot>();
  for (const section of report.sections) {
    const slot = section.exhibitSlot;
    if (!slot || !isGroupAReportSlot(slot)) continue;
    if (seenSlots.has(slot)) continue;
    seenSlots.add(slot);

    const adapter = adapterResults[slot];
    if (!adapter) continue;

    const sourceSummary: ChartAdapterSourceSummary = adapter.sourceSummary;

    const baseExhibit: ReportDeliveryExhibitSnapshot = {
      slot,
      adapterStatus: adapter.status,
      renderedInArtifact: false,
      sourceSummary: {
        source: sourceSummary.source,
        rowCount: sourceSummary.rowCount,
        generatedAt: sourceSummary.generatedAt,
        freshness: sourceSummary.freshness,
      },
      issues: adapter.issues.map((i) => ({
        code: i.code,
        severity: i.severity,
        message: i.message,
        field: i.field,
      })),
    };

    if (adapter.status !== "ready") {
      omittedExhibits.push({
        slot,
        reason:
          adapter.status === "insufficient_data"
            ? "insufficient_data"
            : adapter.status === "invalid_data"
              ? "invalid_data"
              : "gated",
        issueCode: adapter.issues[0]?.code ?? adapter.status,
        operatorFacingNote:
          adapter.issues[0]?.message ??
          `Exhibit slot ${slot} omitted (${adapter.status}).`,
      });
      exhibitSnapshot.push(baseExhibit);
      continue;
    }

    // Adapter is ready. Decide on stale handling.
    if (sourceSummary.freshness === "stale") {
      if (acceptedStaleSet.has(slot)) {
        baseExhibit.renderedInArtifact = true;
        includedExhibitSlots.push(slot);
        exhibitSnapshot.push(baseExhibit);
        issues.push({
          code: "stale_slot_accepted",
          severity: "info",
          message: `Slot ${slot} is stale; operator accepted at generation time.`,
          target: slot,
        });
      } else {
        requiresAcceptance = true;
        omittedExhibits.push({
          slot,
          reason: "stale_rejected",
          issueCode: "stale_source_unaccepted",
          operatorFacingNote: `Slot ${slot} is stale and was not accepted at generation time.`,
        });
        exhibitSnapshot.push(baseExhibit);
        issues.push({
          code: "stale_slot_requires_acceptance",
          severity: "warning",
          message: `Slot ${slot} returned stale data and was not accepted. Accept staleness explicitly or refresh the source rows.`,
          target: slot,
        });
      }
      continue;
    }

    // Ready + fresh / unknown — include.
    baseExhibit.renderedInArtifact = true;
    includedExhibitSlots.push(slot);
    exhibitSnapshot.push(baseExhibit);
  }

  // -------------------------------------------------------------------------
  // Source summary digest
  // -------------------------------------------------------------------------
  let freshSlots = 0;
  let staleSlots = 0;
  let unknownSlots = 0;
  for (const exhibit of exhibitSnapshot) {
    switch (exhibit.sourceSummary.freshness) {
      case "fresh":
        freshSlots += 1;
        break;
      case "stale":
        staleSlots += 1;
        break;
      case "unknown":
        unknownSlots += 1;
        break;
    }
  }

  const sourceSummarySnapshot: ReportDeliverySourceSummarySnapshot = {
    digest: { freshSlots, staleSlots, unknownSlots },
    acceptedStaleSlots: Array.from(acceptedStaleSet),
  };

  // -------------------------------------------------------------------------
  // Final status
  // -------------------------------------------------------------------------
  const status: ReportPdfCandidateReadinessStatus = hardBlocked
    ? "blocked"
    : requiresAcceptance
      ? "requires_acceptance"
      : "ready";

  return {
    status,
    draftWatermark,
    issues,
    includedSectionIds,
    omittedSectionIds,
    includedExhibitSlots,
    omittedExhibits,
    acceptedStaleSlots: Array.from(acceptedStaleSet),
    payload: {
      sectionSnapshot,
      exhibitSnapshot,
      sourceSummarySnapshot,
    },
  };
}

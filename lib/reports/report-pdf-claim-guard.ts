/**
 * Phase 1B Sprint 4C-B — export-time claim-guard scan for the report
 * PDF candidate.
 *
 * Pure function. Reuses `lib/ai/claim-guard.ts`'s shared 26-pattern
 * scanner (financial + commercial-finality + roadmap-commitment). The
 * scan runs at export time because operator edits between AI synthesis
 * and export bypass the synthesis-time scan.
 *
 * Per docs/20 § Claim Guard / Content Safety. Scan inputs:
 *   - report title
 *   - included section: title, summary, draftPreview, evidenceNotes
 *   - included exhibit: sourceSummary.source
 *   - omitted-exhibit appendix: operatorFacingNote
 *
 * Excluded by default:
 *   - reviewer notes
 *   - raw AI prompt/response bodies
 *   - uploaded file content
 *   - signed-URL paths
 */

import {
  COMMERCIAL_FINALITY_PATTERNS,
  FINANCIAL_CLAIM_PATTERNS,
  ROADMAP_COMMITMENT_PATTERNS,
  scanForBannedClaims,
  type BannedClaimRule,
} from "@/lib/ai/claim-guard";
import type { Report } from "./types";
import type {
  ReportDeliveryClaimGuardResult,
  ReportDeliveryExhibitSnapshot,
  ReportDeliveryOmittedExhibit,
  ReportDeliverySectionSnapshot,
} from "./delivery-snapshot-types";

const CLAIM_GUARD_VERSION = "claim-guard.v1";

const RULE_FAMILY = new Map<
  ReadonlyArray<BannedClaimRule>,
  "financial" | "commercial-finality" | "roadmap-commitment"
>([
  [FINANCIAL_CLAIM_PATTERNS, "financial"],
  [COMMERCIAL_FINALITY_PATTERNS, "commercial-finality"],
  [ROADMAP_COMMITMENT_PATTERNS, "roadmap-commitment"],
]);

const COMBINED_RULES: ReadonlyArray<BannedClaimRule> = [
  ...FINANCIAL_CLAIM_PATTERNS,
  ...COMMERCIAL_FINALITY_PATTERNS,
  ...ROADMAP_COMMITMENT_PATTERNS,
];

function familyForCode(
  code: string,
): "financial" | "commercial-finality" | "roadmap-commitment" {
  for (const [rules, family] of RULE_FAMILY.entries()) {
    if (rules.some((r) => r.code === code)) return family;
  }
  // Defensive default; every shipped code is in one of the three families.
  return "financial";
}

export interface RunReportPdfClaimGuardInput {
  report: Report;
  sectionSnapshot: ReportDeliverySectionSnapshot[];
  exhibitSnapshot: ReportDeliveryExhibitSnapshot[];
  omittedExhibits: ReportDeliveryOmittedExhibit[];
}

export function runReportPdfClaimGuard(
  input: RunReportPdfClaimGuardInput,
): ReportDeliveryClaimGuardResult {
  const start = Date.now();

  const fields: Array<{
    field: string;
    values: ReadonlyArray<string | null | undefined>;
  }> = [];

  // Report title
  fields.push({ field: "report.title", values: [input.report.title] });

  // Included sections — title/summary/draftPreview/evidenceNotes
  for (const section of input.sectionSnapshot) {
    if (!section.includedInArtifact) continue;
    fields.push({
      field: `section[${section.sectionId}].title`,
      values: [section.title],
    });
    fields.push({
      field: `section[${section.sectionId}].summary`,
      values: [section.summary],
    });
    fields.push({
      field: `section[${section.sectionId}].draftPreview`,
      values: [section.draftPreview],
    });
    fields.push({
      field: `section[${section.sectionId}].evidenceNotes`,
      values: [section.evidenceNotes],
    });
  }

  // Included exhibits — source-summary text only (the only operator-
  // visible text that flows through the artifact for ready slots).
  for (const exhibit of input.exhibitSnapshot) {
    if (!exhibit.renderedInArtifact) continue;
    fields.push({
      field: `exhibit[${exhibit.slot}].sourceSummary.source`,
      values: [exhibit.sourceSummary.source],
    });
  }

  // Omitted-exhibit appendix notes — operator-facing copy ships in
  // the artifact alongside the slot list.
  for (const omission of input.omittedExhibits) {
    fields.push({
      field: `omittedExhibit[${omission.slot}].note`,
      values: [omission.operatorFacingNote],
    });
  }

  const violations = scanForBannedClaims(fields, COMBINED_RULES);

  const scanDurationMs = Date.now() - start;

  return {
    scannedFields: fields.map((f) => f.field),
    scannedFieldCount: fields.length,
    patternsApplied: ["financial", "commercial-finality", "roadmap-commitment"],
    patternCount: COMBINED_RULES.length,
    violations: violations.map((v) => ({
      field: v.field,
      code: v.code,
      patternFamily: familyForCode(v.code),
    })),
    passed: violations.length === 0,
    scanDurationMs,
    version: CLAIM_GUARD_VERSION,
  };
}

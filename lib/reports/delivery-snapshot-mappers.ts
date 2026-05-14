import type {
  DbReportDeliverySnapshotRow,
  ReportDeliverySnapshot,
  ReportDeliverySnapshotStatus,
  ReportDeliverySurface,
  ReportDeliverySectionSnapshot,
  ReportDeliveryExhibitSnapshot,
  ReportDeliverySourceSummarySnapshot,
  ReportDeliveryClaimGuardResult,
  ReportDeliveryOmittedExhibit,
} from "./delivery-snapshot-types";

/**
 * Phase 1B Sprint 4C-B — DB row → TS shape mappers for report delivery
 * snapshots. The JSON columns are validated defensively: malformed
 * payloads (manual SQL edits, future schema drift) coerce to safe
 * empty shapes rather than crashing the renderer.
 *
 * Pure module — no React, no DB, no I/O.
 */

const VALID_STATUSES: ReadonlyArray<ReportDeliverySnapshotStatus> = [
  "candidate",
  "generated",
  "voided",
];

const VALID_SURFACES: ReadonlyArray<ReportDeliverySurface> = [
  "internal_candidate",
  "client_pdf_candidate",
];

function asStatus(v: string): ReportDeliverySnapshotStatus {
  return (VALID_STATUSES as ReadonlyArray<string>).includes(v)
    ? (v as ReportDeliverySnapshotStatus)
    : "candidate";
}

function asSurface(v: string): ReportDeliverySurface {
  return (VALID_SURFACES as ReadonlyArray<string>).includes(v)
    ? (v as ReportDeliverySurface)
    : "client_pdf_candidate";
}

function asArray<T>(v: unknown, isItem: (x: unknown) => x is T): T[] {
  if (!Array.isArray(v)) return [];
  const out: T[] = [];
  for (const x of v) {
    if (isItem(x)) out.push(x);
  }
  return out;
}

function asObject(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : {};
}

function asString(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function asNumber(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function asBoolean(v: unknown, fallback = false): boolean {
  return typeof v === "boolean" ? v : fallback;
}

function isSectionSnapshot(x: unknown): x is ReportDeliverySectionSnapshot {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.sectionId === "string" && typeof o.title === "string";
}

function isExhibitSnapshot(x: unknown): x is ReportDeliveryExhibitSnapshot {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.slot === "string" && typeof o.adapterStatus === "string";
}

function isOmissionEntry(x: unknown): x is ReportDeliveryOmittedExhibit {
  if (!x || typeof x !== "object") return false;
  const o = x as Record<string, unknown>;
  return typeof o.slot === "string" && typeof o.reason === "string";
}

function mapSourceSummary(
  v: unknown,
): ReportDeliverySourceSummarySnapshot {
  const o = asObject(v);
  const digest = asObject(o.digest);
  return {
    digest: {
      freshSlots: asNumber(digest.freshSlots, 0),
      staleSlots: asNumber(digest.staleSlots, 0),
      unknownSlots: asNumber(digest.unknownSlots, 0),
    },
    acceptedStaleSlots: asArray(
      o.acceptedStaleSlots,
      (x): x is ReportDeliverySourceSummarySnapshot["acceptedStaleSlots"][number] =>
        typeof x === "string",
    ),
  };
}

function mapClaimGuardResult(v: unknown): ReportDeliveryClaimGuardResult {
  const o = asObject(v);
  return {
    scannedFields: asArray(o.scannedFields, (x): x is string => typeof x === "string"),
    scannedFieldCount: asNumber(o.scannedFieldCount, 0),
    patternsApplied: asArray(
      o.patternsApplied,
      (x): x is ReportDeliveryClaimGuardResult["patternsApplied"][number] =>
        x === "financial" || x === "commercial-finality" || x === "roadmap-commitment",
    ),
    patternCount: asNumber(o.patternCount, 0),
    violations: asArray(
      o.violations,
      (x): x is ReportDeliveryClaimGuardResult["violations"][number] => {
        if (!x || typeof x !== "object") return false;
        const v = x as Record<string, unknown>;
        return (
          typeof v.field === "string" &&
          typeof v.code === "string" &&
          (v.patternFamily === "financial" ||
            v.patternFamily === "commercial-finality" ||
            v.patternFamily === "roadmap-commitment")
        );
      },
    ),
    passed: asBoolean(o.passed, true),
    scanDurationMs: asNumber(o.scanDurationMs, 0),
    version: asString(o.version, "claim-guard.v1"),
  };
}

export function mapReportDeliverySnapshotRow(
  row: DbReportDeliverySnapshotRow,
): ReportDeliverySnapshot {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    engagementId: row.engagement_id,
    reportId: row.report_id,
    status: asStatus(row.status),
    deliverySurface: asSurface(row.delivery_surface),
    reportStatusAtGeneration: row.report_status_at_generation,
    generatedByUserId: row.generated_by,
    generatedByLabel: row.generated_by_label,
    generatedAt: row.generated_at,
    sectionSnapshot: asArray(row.section_snapshot, isSectionSnapshot),
    exhibitSnapshot: asArray(row.exhibit_snapshot, isExhibitSnapshot),
    sourceSummarySnapshot: mapSourceSummary(row.source_summary_snapshot),
    claimGuardResult: mapClaimGuardResult(row.claim_guard_result),
    omittedExhibits: asArray(row.omitted_exhibits, isOmissionEntry),
    draftWatermark: row.draft_watermark,
    artifactPath: row.artifact_path,
    artifactMimeType: row.artifact_mime_type,
    artifactSizeBytes: row.artifact_size_bytes,
    artifactSha256: row.artifact_sha256,
    appVersion: row.app_version,
    commitSha: row.commit_sha,
    voidedAt: row.voided_at,
    voidedByUserId: row.voided_by,
    voidReason: row.void_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

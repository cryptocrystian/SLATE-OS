export type StakeholderRole =
  | "executive"
  | "operations"
  | "sales"
  | "marketing"
  | "finance"
  | "it"
  | "frontline"
  | "customer-success"
  | "other";

export type StakeholderStatus =
  | "invited"
  | "in-progress"
  | "completed"
  | "needs-follow-up"
  | "not-started";

export type ResponseQuality = "strong" | "adequate" | "thin" | "missing";

export interface Stakeholder {
  id: string;
  name: string;
  title: string;
  role: StakeholderRole;
  department?: string;
  status: StakeholderStatus;
  completionPercent: number;
  responseQuality: ResponseQuality;
  /** Operator-readable relative time ("Yesterday", "3 days ago", "—"). */
  lastActivity: string;
  /**
   * Raw ISO 8601 UTC timestamp from `stakeholder_intake_sessions.last_activity_at`.
   * Surfaced alongside the display string so chart adapters can derive
   * freshness without re-parsing the relative-time format. Mock fixtures
   * omit this field.
   */
  lastActivityAt?: string | null;
  summary: string;
  keySignals: string[];
  openQuestions: string[];
  riskFlags: string[];
}

export type RoleCoverage = "covered" | "partial" | "missing";

export interface RoleCoverageRow {
  role: StakeholderRole;
  required: boolean;
  status: RoleCoverage;
  stakeholderCount: number;
  coverageNote: string;
}

export type DocumentStatus =
  | "requested"
  | "received"
  | "reviewed"
  | "missing"
  | "outdated";

export interface SupportingInput {
  id: string;
  title: string;
  type:
    | "operations-doc"
    | "process-map"
    | "data-export"
    | "system-screenshot"
    | "policy-doc"
    | "report"
    | "other";
  source: string;
  status: DocumentStatus;
  evidenceQuality: "strong" | "adequate" | "thin" | "unverified";
  linkedStakeholder?: string;
  linkedRole?: StakeholderRole;
  summary: string;
}

export interface IntakeRecord {
  engagementId: string;
  stakeholders: Stakeholder[];
  roleCoverage: RoleCoverageRow[];
  supportingInputs: SupportingInput[];
  followUps: Array<{
    id: string;
    label: string;
    detail: string;
    target: string;
    severity: "high" | "medium" | "low";
  }>;
  intakeRiskNotes: string[];
}

// ---------------------------------------------------------------------------
// Sprint I2 — Offline intake (Mode B + Mode C) types
//
// Canon: docs/37_SAPIENT_DIGITAL_OFFLINE_INTAKE_CANON.md.
//
// These types extend the existing intake vocabulary (live-link Mode A
// is the default; offline modes are additive). The DB enforces the
// canonical values via CHECK constraints in migration
// 0017_offline_intake_extensions.sql; the TS unions mirror those
// constraints so callers cannot construct invalid values.
//
// Boundary reminders:
//   - Live-link Mode A is unchanged by Sprint I2.
//   - Offline modes never mint a token; never send anything.
//   - client_visible defaults to false for offline rows; the
//     docs/35 § 5 readiness gate stands between offline data and any
//     client-facing artifact.
// ---------------------------------------------------------------------------

/**
 * Per-row source-type discriminator. `live_link` is the existing public
 * intake-route mode; the remaining values are operator-staged offline
 * modes that bypass the stakeholder-token round trip per docs/37 § 2.
 */
export type IntakeSourceType =
  | "live_link"
  | "operator_entered"
  | "meeting_notes"
  | "transcript"
  | "email_paste"
  | "document_upload";

/**
 * Document-only source-type subset for `engagement_intake_documents`.
 * Excludes `live_link` because documents never live on the live-link
 * code path; adds `external_link` for URL-only references.
 */
export type IntakeDocumentSourceType =
  | "document_upload"
  | "meeting_notes"
  | "transcript"
  | "email_paste"
  | "external_link";

/**
 * Operator-stamped confidence for offline-collected signal. Live-link
 * rows leave this null because the stakeholder typed the answer
 * themselves.
 */
export type IntakeSourceConfidence = "first_hand" | "second_hand" | "inferred";

/**
 * Response lifecycle per docs/37 § 4. Live-link responses default to
 * `ready_for_synthesis` immediately because the stakeholder typed
 * them; offline-staged responses default to `draft` and must be
 * explicitly promoted by the operator before findings synthesis
 * consumes them.
 *
 * Server-action layer enforces the transition matrix:
 *   draft → ready_for_synthesis
 *   draft → voided
 *   ready_for_synthesis → voided
 *   ready_for_synthesis → superseded (when a replacement is staged)
 */
export type IntakeResponseStatus =
  | "draft"
  | "ready_for_synthesis"
  | "superseded"
  | "voided";

/**
 * Operator-side document attached to an engagement for offline-mode
 * findings synthesis input. Distinct from `SupportingInput` (the
 * Sprint 5 metadata-only entity surfaced in the intake workspace);
 * documents under this entity carry full content (text or storage
 * reference) plus operator provenance.
 *
 * Documents NEVER reach the public `/r` or `/p` routes. `client_visible`
 * defaults to false and is reserved for a future operator-elevation
 * surface; in Sprint I2 it remains structurally false.
 */
export interface EngagementIntakeDocument {
  id: string;
  workspaceId: string;
  engagementId: string;
  /** Optional link to a `stakeholder_intake_sessions.id`. */
  stakeholderId: string | null;
  title: string;
  sourceType: IntakeDocumentSourceType;
  /** Inline content for text-based source modes. */
  contentText: string | null;
  /** External URL reference for `external_link` source type. */
  externalUrl: string | null;
  /** Storage object key for binary `document_upload` source type. */
  storagePath: string | null;
  mimeType: string | null;
  sizeBytes: number | null;
  sourceConfidence: IntakeSourceConfidence | null;
  operatorNotes: string | null;
  clientVisible: boolean;
  createdBy: string | null;
  voidedAt: string | null;
  voidedBy: string | null;
  voidReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Server-action input shapes (Sprint I2 — pure types, no UI)
// ---------------------------------------------------------------------------

export interface CreateOfflineStakeholderInput {
  engagementId: string;
  /** Display name. May be a role-level label per docs/37 § 4. */
  name: string;
  /** Optional for offline modes. */
  email?: string;
  title?: string;
  role: StakeholderRole;
  department?: string;
  /** Required. Distinguishes offline source mode. */
  sourceType: Exclude<IntakeSourceType, "live_link">;
  /** When the offline answer was collected (may pre-date the SLATE row). */
  collectedAt?: string;
  sourceConfidence?: IntakeSourceConfidence;
  /** Operator-only audit context; max 2000 chars per docs/37 § 3.1. */
  operatorNotes?: string;
}

export interface CreateOfflineResponseInput {
  sessionId: string;
  questionId: string;
  questionLabel?: string;
  answerText: string;
  sourceType: Exclude<IntakeSourceType, "live_link">;
  collectedAt?: string;
  /** Operator-only audit context; max 1000 chars per docs/37 § 3.2. */
  operatorNotes?: string;
  /** Optional; if set, the prior response is auto-flipped to `superseded`. */
  supersedesResponseId?: string;
}

export interface MarkResponseReadyInput {
  responseId: string;
}

export interface VoidOfflineResponseInput {
  responseId: string;
  /** Optional reason captured in the activity event metadata. */
  reason?: string;
}

export interface CreateIntakeDocumentInput {
  engagementId: string;
  stakeholderId?: string;
  title: string;
  sourceType: IntakeDocumentSourceType;
  contentText?: string;
  externalUrl?: string;
  storagePath?: string;
  mimeType?: string;
  sizeBytes?: number;
  sourceConfidence?: IntakeSourceConfidence;
  /** Operator-only audit context; max 1000 chars. */
  operatorNotes?: string;
}

export interface VoidIntakeDocumentInput {
  documentId: string;
  reason?: string;
}

// ---------------------------------------------------------------------------
// Server-action result discriminated unions
// ---------------------------------------------------------------------------

export type OfflineIntakeErrorCode =
  | "unauthenticated"
  | "invalid-engagement"
  | "invalid-session"
  | "invalid-response"
  | "invalid-document"
  | "invalid-role"
  | "invalid-source-type"
  | "invalid-source-confidence"
  | "invalid-content"
  | "missing-fields"
  | "field-too-long"
  | "engagement-not-found"
  | "session-not-found"
  | "response-not-found"
  | "response-not-eligible"
  | "document-not-found"
  | "document-already-voided"
  | "response-already-voided"
  | "session-mode-mismatch"
  | "service-error";

export type CreateOfflineStakeholderResult =
  | { ok: true; sessionId: string; sourceType: IntakeSourceType }
  | { ok: false; error: OfflineIntakeErrorCode };

export type CreateOfflineResponseResult =
  | {
      ok: true;
      responseId: string;
      sessionId: string;
      responseStatus: IntakeResponseStatus;
    }
  | { ok: false; error: OfflineIntakeErrorCode };

export type MarkResponseReadyResult =
  | { ok: true; responseId: string }
  | { ok: false; error: OfflineIntakeErrorCode };

export type VoidOfflineResponseResult =
  | { ok: true; responseId: string }
  | { ok: false; error: OfflineIntakeErrorCode };

export type CreateIntakeDocumentResult =
  | { ok: true; documentId: string; sourceType: IntakeDocumentSourceType }
  | { ok: false; error: OfflineIntakeErrorCode };

export type VoidIntakeDocumentResult =
  | { ok: true; documentId: string }
  | { ok: false; error: OfflineIntakeErrorCode };

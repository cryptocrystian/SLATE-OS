export type ActivityEventType =
  | "scorecard_submitted"
  | "lead_created"
  | "lead_status_changed"
  | "engagement_created"
  | "intake_session_created"
  | "intake_response_submitted"
  | "finding_created"
  | "finding_approved"
  | "finding_rejected"
  | "finding_report_ready"
  | "opportunity_created"
  | "opportunity_selected"
  | "opportunity_deferred"
  | "opportunity_rejected"
  | "roadmap_item_created"
  | "roadmap_item_status_changed"
  | "report_initialized"
  | "report_section_status_changed"
  | "proposal_initialized"
  | "proposal_option_recommended"
  | "proposal_status_changed"
  | "note_created"
  | "note_updated"
  | "note_deleted"
  | "input_asset_uploaded"
  | "input_asset_downloaded"
  | "ai_findings_generated"
  | "ai_opportunities_generated"
  | "ai_report_section_drafted"
  // Sprint S8 — operator-triggered bulk drafting orchestrator
  // (`generateAllReportSectionDraftsAction`). One event per bulk run;
  // metadata carries safe counts only — no UUIDs, no section bodies.
  | "ai_report_sections_drafted"
  | "ai_proposal_option_drafted"
  | "ai_roadmap_items_drafted"
  | "ai_synthesis_failed"
  | "report_pdf_candidate_generated"
  | "report_pdf_candidate_failed"
  | "report_pdf_candidate_downloaded"
  | "report_delivery_snapshot_voided"
  | "report_share_token_created"
  | "report_share_token_revoked"
  | "report_share_token_accessed"
  | "report_share_token_expired"
  | "proposal_snapshot_generated"
  | "proposal_snapshot_failed"
  | "proposal_snapshot_voided"
  | "proposal_snapshot_approved"
  | "proposal_share_token_created"
  | "proposal_share_token_revoked"
  | "proposal_share_token_accessed"
  | "proposal_share_token_expired"
  | "sow_draft_generated"
  | "sow_draft_failed"
  | "sow_draft_voided"
  | "report_share_token_sent_to_client"
  | "report_share_token_send_failed"
  | "proposal_share_token_sent_to_client"
  | "proposal_share_token_send_failed"
  // Sprint I2 — Offline intake (docs/37 Mode B + Mode C). These events
  // track operator-staged offline stakeholder sessions, the draft +
  // ready-for-synthesis lifecycle of their per-question responses, and
  // attached offline source documents. None of these events imply
  // external delivery — SLATE never sends; the operator collected the
  // content outside SLATE.
  | "offline_intake_session_created"
  | "offline_intake_response_created"
  | "offline_intake_response_ready"
  | "offline_intake_response_voided"
  | "intake_document_created"
  | "intake_document_voided"
  // Sprint S3-B — Attio CRM read-context link (docs/42 § 12).
  // Operator linked a SLATE account to an Attio Company record. No
  // Attio writeback; SLATE never mutates the CRM.
  | "account_linked_to_attio";

export type ActivityEntityType =
  | "lead"
  | "engagement"
  | "intake_session"
  | "stakeholder_response"
  | "finding"
  | "opportunity"
  | "roadmap_item"
  | "report"
  | "report_section"
  | "proposal"
  | "proposal_option"
  | "note"
  | "scorecard_submission"
  | "input_asset"
  | "ai_synthesis_run"
  | "report_delivery_snapshot"
  | "report_share_token"
  | "proposal_delivery_snapshot"
  | "proposal_share_token"
  // Sprint I2 — Offline intake document entity (docs/37 § 3.3).
  | "engagement_intake_document"
  // Sprint S3-B — Account entity (docs/42 § 9.1). Used by the
  // `account_linked_to_attio` event so the timeline can render an
  // account-scoped row without conflating it with engagement events.
  | "account";

export interface ActivityEvent {
  id: string;
  eventType: ActivityEventType;
  entityType: ActivityEntityType;
  entityId: string | null;
  engagementId: string | null;
  leadId: string | null;
  title: string;
  summary: string | null;
  actorDisplayName: string | null;
  actorEmail: string | null;
  /** Small, safe metadata bag. UI must not render raw JSON. */
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface LogActivityEventInput {
  eventType: ActivityEventType;
  entityType: ActivityEntityType;
  entityId?: string | null;
  engagementId?: string | null;
  leadId?: string | null;
  accountId?: string | null;
  contactId?: string | null;
  title: string;
  summary?: string | null;
  metadata?: Record<string, unknown>;
}

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
  | "ai_proposal_option_drafted"
  | "ai_roadmap_items_drafted"
  | "ai_synthesis_failed"
  | "report_pdf_candidate_generated"
  | "report_pdf_candidate_failed"
  | "report_pdf_candidate_downloaded"
  | "report_delivery_snapshot_voided";

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
  | "report_delivery_snapshot";

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

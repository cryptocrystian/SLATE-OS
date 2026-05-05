export type NoteEntityType =
  | "lead"
  | "engagement"
  | "finding"
  | "opportunity"
  | "report"
  | "report_section"
  | "proposal";

export type NoteVisibility = "internal" | "client_visible_placeholder";

export interface Note {
  id: string;
  entityType: NoteEntityType;
  entityId: string;
  body: string;
  visibility: NoteVisibility;
  pinned: boolean;
  authorDisplayName: string | null;
  createdAt: string;
  updatedAt: string;
}

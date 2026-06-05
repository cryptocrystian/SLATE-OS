import type { OpportunityPriority } from "@/lib/opportunities/types";

export type RoadmapPhase = "first-30" | "days-31-60" | "days-61-90";

export interface RoadmapItem {
  id: string;
  engagementId: string;
  phase: RoadmapPhase;
  title: string;
  objective: string;
  linkedOpportunityId?: string;
  priority: OpportunityPriority;
  keyActions: string[];
  dependencies: string[];
  successCriteria: string[];
  risks: string[];
  ownerPlaceholder?: string;
  readinessNote?: string;
  /**
   * Last persisted update timestamp (ISO 8601 UTC). Surfaced from
   * `roadmap_items.updated_at` for freshness derivation in chart
   * adapters. Mock fixtures omit this field.
   */
  updatedAt?: string | null;
  /**
   * Sprint S7 — Operator-typed rejection rationale persisted in
   * `roadmap_items.reviewer_notes`. Set when the operator confirms a
   * `Reject` transition with a 10–500 char reason. Null when no
   * reason was provided or the item is not rejected.
   */
  reviewerNote?: string | null;
  /**
   * Sprint S7 — Lifecycle status surfaced from `roadmap_items.status`.
   * Mock fixtures may omit this; persisted items always carry it.
   */
  status?:
    | "planned"
    | "ready"
    | "blocked"
    | "deferred"
    | "rejected"
    | "completed";
}

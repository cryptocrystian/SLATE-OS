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
}

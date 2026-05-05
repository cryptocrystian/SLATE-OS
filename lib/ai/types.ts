/**
 * Shared types for the SLATE AI synthesis layer.
 *
 * The `DraftFindingCandidate` shape is the agreed-upon contract between
 * the LLM provider, the validator, and the findings synthesis action.
 * Snake-cased category / source-type values match the DB vocabulary so
 * the validator can map directly to the existing finding mappers.
 */

export type DraftFindingCategory =
  | "workflow_friction"
  | "systems_gap"
  | "data_readiness"
  | "adoption_risk"
  | "governance_risk"
  | "revenue_opportunity"
  | "back_office_efficiency"
  | "customer_experience";

export type DraftFindingConfidence =
  | "high"
  | "medium"
  | "low"
  | "needs_evidence";

export type DraftFindingSourceType =
  | "stakeholder_response"
  | "input_asset"
  | "scorecard_answer"
  | "consultant_note";

export type DraftFindingSourceStrength =
  | "strong"
  | "adequate"
  | "thin"
  | "missing";

export interface DraftFindingSourceRef {
  sourceType: DraftFindingSourceType;
  /** Optional UUID of the underlying record (response/asset/answer/note). */
  sourceId?: string;
  sourceLabel: string;
  sourceRole?: string;
  excerpt?: string;
  strength: DraftFindingSourceStrength;
}

export interface DraftFindingCandidate {
  category: DraftFindingCategory;
  statement: string;
  summary: string;
  evidenceSummary: string;
  confidence: DraftFindingConfidence;
  suggestedImpact?: string;
  assumptionFlag: boolean;
  assumptionNote?: string;
  sourceRefs: DraftFindingSourceRef[];
}

export interface AiProviderConfig {
  provider: "openai";
  model: string;
}

/**
 * Shape returned by every provider call. The raw payload is intentionally
 * not exposed to higher layers — only the structured candidates and
 * controlled error codes propagate up.
 */
export interface ProviderInvocationOk {
  ok: true;
  candidates: DraftFindingCandidate[];
  /** Bounded provider metadata for logging only — never the prompt body
   *  or raw response. */
  providerMeta: {
    provider: AiProviderConfig["provider"];
    model: string;
  };
}

export type ProviderInvocationError =
  | "ai-not-configured"
  | "ai-request-failed"
  | "ai-response-invalid"
  | "ai-rate-limited"
  | "ai-timeout";

export interface ProviderInvocationFailure {
  ok: false;
  error: ProviderInvocationError;
  /** Short, sanitized error message for logs. Never includes prompt body
   *  or stakeholder content. */
  message?: string;
}

export type ProviderInvocationResult =
  | ProviderInvocationOk
  | ProviderInvocationFailure;

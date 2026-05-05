import type {
  FitDimension,
  Lead,
  LeadSource,
  LeadStatus,
  LeadTrustStatus,
  PracticeArea,
  ProspectScores,
  QualificationSignal,
} from "./types";

/**
 * DB ↔ TypeScript shape mappers for the persisted lead surface.
 *
 * The TypeScript `Lead` shape predates persistence and uses hyphenated
 * union strings ("public-scorecard", "high-fit"). The DB enums use
 * underscores ("public_scorecard", "high_fit"). The mappers are the
 * single point of translation so the rest of the app keeps consuming
 * the existing component contract unchanged.
 */

// ---------------------------------------------------------------------------
// DB row shapes (just what we actually select in queries.ts)
// ---------------------------------------------------------------------------

export interface DbAccountRow {
  name: string;
  industry: string | null;
  employee_range: string | null;
  revenue_range: string | null;
}

export interface DbContactRow {
  full_name: string | null;
  title: string | null;
  email: string | null;
}

export interface DbProspectScores {
  ai?: number | null;
  friction?: number | null;
  systems?: number | null;
}

export interface DbRecommendedAction {
  headline?: string | null;
  detail?: string | null;
  cta?: string | null;
}

export interface DbLeadRow {
  id: string;
  source: string;
  practice_area: string;
  status: string;
  internal_fit_score: number | null;
  prospect_scores: DbProspectScores | null;
  recommended_action: DbRecommendedAction | null;
  submission_id: string | null;
  last_activity_at: string;
  created_at: string;
  trust_status: string | null;
  trust_reasons: string[] | null;
  accounts: DbAccountRow | null;
  contacts: DbContactRow | null;
  /** From scorecard_submissions when joined; otherwise null. */
  submission_submitted_at?: string | null;
}

export interface DbFitDimensionRow {
  dimension_id: string;
  value: number;
  note: string | null;
}

export interface DbQualificationSignalRow {
  id: string;
  label: string;
  detail: string | null;
  direction: string;
  position: number;
}

// ---------------------------------------------------------------------------
// Enum mappers
// ---------------------------------------------------------------------------

const STATUS_FROM_DB: Record<string, LeadStatus> = {
  new: "new",
  needs_review: "needs-review",
  high_fit: "high-fit",
  diagnostic_requested: "diagnostic-requested",
  nurture: "nurture",
  disqualified: "disqualified",
  converted: "converted",
};

const SOURCE_FROM_DB: Record<string, LeadSource> = {
  public_scorecard: "public-scorecard",
  referral: "referral",
  outbound: "outbound",
  event: "event",
  partner: "partner",
};

const PRACTICE_FROM_DB: Record<string, PracticeArea> = {
  ai_systems: "AI Systems",
  custom_dev: "Custom Development",
  venture_studio: "Venture Studio",
};

const TRUST_FROM_DB: Record<string, LeadTrustStatus> = {
  verified: "verified",
  unverified: "unverified",
  flagged: "flagged",
  rejected: "rejected",
};

function mapTrustStatus(raw: string | null | undefined): LeadTrustStatus {
  if (!raw) return "unverified";
  return TRUST_FROM_DB[raw] ?? "unverified";
}

const FIT_DIMENSION_LABEL: Record<FitDimension["id"], string> = {
  "business-value": "Business Value Potential",
  budget: "Budget Likelihood",
  "pain-intensity": "Pain Intensity",
  "technical-readiness": "Technical Readiness",
  "buyer-readiness": "Buyer Readiness",
  expansion: "Expansion Potential",
};

const FIT_DIMENSION_FROM_DB: Record<string, FitDimension["id"]> = {
  business_value: "business-value",
  budget: "budget",
  pain_intensity: "pain-intensity",
  technical_readiness: "technical-readiness",
  buyer_readiness: "buyer-readiness",
  expansion: "expansion",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function clampScore(v: unknown): number {
  const n = typeof v === "number" ? v : Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function mapProspectScores(raw: DbProspectScores | null): ProspectScores {
  return {
    ai: clampScore(raw?.ai),
    friction: clampScore(raw?.friction),
    systems: clampScore(raw?.systems),
  };
}

/** Render an absolute timestamp as a short, relative phrase. */
export function formatRelative(iso: string, now = new Date()): string {
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "—";
  const diffMs = now.getTime() - then.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin} minute${diffMin === 1 ? "" : "s"} ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr === 1 ? "" : "s"} ago`;
  if (diffHr < 48) return "Yesterday";
  const diffDay = Math.round(diffHr / 24);
  if (diffDay < 7) return `${diffDay} days ago`;
  if (diffDay < 14) return "Last week";
  if (diffDay < 31) return `${Math.round(diffDay / 7)} weeks ago`;
  return then.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// ---------------------------------------------------------------------------
// Public mappers
// ---------------------------------------------------------------------------

/** Map a DB lead row (with joined account+contact) to the partial Lead shape
 *  shared by the inbox list. The list does not need fitDimensions,
 *  qualificationSignals, opportunityAreas, riskNotes, or notes. */
export function mapLeadRowToListLead(row: DbLeadRow): Omit<
  Lead,
  | "fitDimensions"
  | "qualificationSignals"
  | "opportunityAreas"
  | "riskNotes"
  | "notes"
> {
  const account = row.accounts ?? null;
  const contact = row.contacts ?? null;
  const status = STATUS_FROM_DB[row.status] ?? "new";
  const source = SOURCE_FROM_DB[row.source] ?? "public-scorecard";
  const practiceArea = PRACTICE_FROM_DB[row.practice_area] ?? "AI Systems";

  const recommended = row.recommended_action ?? {};
  const completedIso = row.submission_submitted_at ?? row.created_at;

  return {
    id: row.id,
    companyName: account?.name?.trim() || "Untitled account",
    industry: account?.industry?.trim() || "Unknown industry",
    employeeRange: account?.employee_range?.trim() || "—",
    revenueRange: account?.revenue_range?.trim() || undefined,
    contactName: contact?.full_name?.trim() || "Unknown contact",
    contactTitle: contact?.title?.trim() || "—",
    contactEmail: contact?.email?.trim() || "",
    source,
    practiceArea,
    status,
    createdAt: row.created_at,
    lastActivityAt: formatRelative(row.last_activity_at),
    scorecardCompletedAt: completedIso,
    prospectScores: mapProspectScores(row.prospect_scores),
    internalFitScore: clampScore(row.internal_fit_score),
    recommendedAction: {
      headline: recommended.headline?.toString() || "Triage on the lead inbox",
      detail:
        recommended.detail?.toString() ||
        "Review qualification signals before scheduling a discovery call.",
      cta: recommended.cta?.toString() || "Open lead",
    },
    trustStatus: mapTrustStatus(row.trust_status),
    trustReasons: Array.isArray(row.trust_reasons)
      ? row.trust_reasons.filter((s): s is string => typeof s === "string")
      : [],
  };
}

/** Map a `lead_fit_dimensions` row into the existing `FitDimension` shape. */
export function mapFitDimensionRow(row: DbFitDimensionRow): FitDimension | null {
  const id = FIT_DIMENSION_FROM_DB[row.dimension_id];
  if (!id) return null;
  return {
    id,
    label: FIT_DIMENSION_LABEL[id],
    value: clampScore(row.value),
    note: row.note ?? "",
  };
}

const FIT_DIMENSION_ORDER: FitDimension["id"][] = [
  "business-value",
  "budget",
  "pain-intensity",
  "technical-readiness",
  "buyer-readiness",
  "expansion",
];

/** Sort dimensions into the canonical UI order. */
export function orderFitDimensions(rows: FitDimension[]): FitDimension[] {
  const byId = new Map(rows.map((d) => [d.id, d] as const));
  return FIT_DIMENSION_ORDER.map((id) => byId.get(id)).filter(
    (d): d is FitDimension => Boolean(d),
  );
}

const QUALIFICATION_DIRECTION_FROM_DB: Record<
  string,
  QualificationSignal["direction"]
> = {
  positive: "positive",
  watch: "watch",
  negative: "negative",
};

/** Map a `lead_qualification_signals` row into the existing
 *  `QualificationSignal` shape. */
export function mapQualificationSignalRow(
  row: DbQualificationSignalRow,
): QualificationSignal {
  const direction = QUALIFICATION_DIRECTION_FROM_DB[row.direction] ?? "watch";
  return {
    id: row.id,
    label: row.label,
    detail: row.detail ?? "",
    direction,
  };
}

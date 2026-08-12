/**
 * Sprint S1 — Online Intake Flow Audit + Stakeholder Intake Readiness.
 *
 * NON-ENFORCING readiness helper. This module is a pure-function shape
 * that Sprint S11 (`docs/39` § 5) will wire into the code-side
 * pre-delivery audit guard. **Nothing in the current codebase reads
 * from this helper.** It is intentionally orphan-shipped so the
 * contract is reviewable now (Sprint S1) and the enforcement landing
 * (Sprint S11) is the only sprint that takes a behavior risk.
 *
 * Canon references:
 *   - `docs/39` § 4 — canonical input hierarchy (primary online intake,
 *     secondary transcripts + CRM, tertiary offline operator entry).
 *   - `docs/35` § 5 — the 15-item engagement readiness gate; the intake
 *     portion (rows 1-2 of the table) is what this helper checks.
 *   - `docs/40` § 5 — the formal readiness-gate wording this helper
 *     implements verbatim.
 *
 * Rules for callers (when S11 wires this up):
 *   - This function is pure: same input → same output.
 *   - No DB reads, no logging, no side effects.
 *   - All counts must be pre-computed from query layer before calling.
 *   - Synthesis weighting per `docs/39` § 4.5 is applied here so the
 *     gate verdict is decision-ready.
 *   - The function returns advisory output until S11 wires it into the
 *     `/r` and `/p` mint guard. Operator override path is reserved for
 *     S11; this stub does NOT model override.
 */

import type { StakeholderRole } from "@/lib/intake/types";

// ---------------------------------------------------------------------------
// Required role set per canon (`docs/35` § 5 + `docs/39` § 4).
// Frontline and IT are required because the canonical AI Opportunity
// Sprint deliverable requires day-to-day ground truth (frontline) +
// systems-integration constraint (IT). Marketing and Customer Success
// are optional — they enrich the report but don't block it.
// ---------------------------------------------------------------------------

export const REQUIRED_INTAKE_ROLES: ReadonlySet<StakeholderRole> = new Set([
  "executive",
  "operations",
  "sales",
  "it",
  "finance",
  "frontline",
]);

// ---------------------------------------------------------------------------
// Per-role coverage state. Each entry is what the operator-side query
// layer should aggregate from `stakeholder_intake_sessions` +
// `stakeholder_responses` before calling `evaluateIntakeReadiness`.
// ---------------------------------------------------------------------------

export type IntakeLane =
  /** docs/39 § 4.1 — primary. `live_link` Mode A. */
  | "live_link"
  /** docs/39 § 4.2 — secondary. Transcript / notetaker. */
  | "transcript"
  /** docs/39 § 4.2 — secondary. CRM context (engagement-level only). */
  | "crm_context"
  /** docs/39 § 4.4 — tertiary. Operator-entered, meeting_notes, email_paste. */
  | "offline_operator";

export interface IntakeRoleCoverage {
  role: StakeholderRole;
  /** Sessions invited for this role across all lanes. */
  sessionsInvited: number;
  /**
   * Sessions whose responses have at least one
   * `response_status = 'ready_for_synthesis'` row.
   */
  sessionsWithReadyResponses: number;
  /** Which lanes contributed signal for this role (per docs/39 § 4). */
  contributingLanes: IntakeLane[];
}

export interface IntakeReadinessInput {
  /** One row per role the engagement could cover. Roles not listed
   *  are treated as "missing". */
  roleCoverage: IntakeRoleCoverage[];
  /** Total `ready_for_synthesis` responses across all sessions /
   *  lanes. Drafts + voided rows are excluded by definition. */
  totalReadyResponses: number;
  /** Total non-voided documents available on the engagement. */
  totalDocuments: number;
  /**
   * Whether at least one supporting document has been uploaded, OR
   * the operator has explicitly signed off "no documents needed for
   * this engagement". S11 will wire this from the docs/35 § 5 row 3
   * checklist UI; for the stub, callers pass a boolean.
   */
  documentsClearedOrAcknowledged: boolean;
}

// ---------------------------------------------------------------------------
// Reason taxonomy. Sprint S11 will key gate UI off these enum values, so
// reasons are codes + display strings. Add new codes carefully — they're
// part of the future code-side guard's stable contract.
// ---------------------------------------------------------------------------

export type IntakeReadinessReasonCode =
  | "missing-required-role-coverage"
  | "insufficient-ready-responses"
  | "documents-not-cleared"
  | "no-stakeholders-invited";

export interface IntakeReadinessReason {
  code: IntakeReadinessReasonCode;
  /** Operator-facing message. Safe to render verbatim in UI. */
  message: string;
}

export interface IntakeReadinessOutput {
  /** True iff every blocking condition has cleared. */
  ready: boolean;
  /** Required roles with zero ready-response coverage. */
  missingRequiredRoles: StakeholderRole[];
  /** Reasons the gate is not yet ready. Empty when `ready = true`. */
  reasons: IntakeReadinessReason[];
  /**
   * Best-case lane the engagement currently has signal from. Used to
   * surface "you're relying on tertiary input only — consider a
   * transcript before findings synthesis" advisory copy. NOT a gate
   * blocker on its own.
   */
  highestLaneSignal: IntakeLane | null;
  /**
   * Advisory notes that DON'T block the gate but warrant operator
   * attention before findings synthesis. Surfaced separately from
   * `reasons` so S11's UI can distinguish blockers vs. nudges.
   */
  advisories: string[];
}

// ---------------------------------------------------------------------------
// Canon thresholds (`docs/35` § 5 rows 1-2 + `docs/40` § 5).
// Kept as named constants so the canonical numbers live in code, not
// scattered comments.
// ---------------------------------------------------------------------------

/** docs/35 § 5 row 1 — minimum REQUIRED roles with at least one ready
 *  response across any lane (live-link or transcript or offline). */
const MIN_REQUIRED_ROLES_WITH_READY_RESPONSE = 3;

/** docs/35 § 5 row 2 — minimum count of ready-for-synthesis responses
 *  across the engagement. Substantive-response heuristic; finer-grained
 *  per-question completeness checks land in S5 when synthesis quality
 *  feedback is observable. */
const MIN_TOTAL_READY_RESPONSES = 14;

// ---------------------------------------------------------------------------
// Lane priority order — used to compute `highestLaneSignal`.
// Lower index = higher priority. Matches docs/39 § 4 hierarchy.
// ---------------------------------------------------------------------------

const LANE_PRIORITY: IntakeLane[] = [
  "live_link",
  "transcript",
  "crm_context",
  "offline_operator",
];

// ---------------------------------------------------------------------------
// The function.
// ---------------------------------------------------------------------------

/**
 * Pure-function readiness evaluator. NOT WIRED into any UI or guard
 * yet — Sprint S11 will wire it.
 *
 * Returns the gate verdict + structured reasons. Operator override is
 * NOT modeled here; S11's gate UI handles override with audit-logged
 * reason text per `docs/39` § 5 acceptance criterion 4.
 */
export function evaluateIntakeReadiness(
  input: IntakeReadinessInput,
): IntakeReadinessOutput {
  const reasons: IntakeReadinessReason[] = [];
  const advisories: string[] = [];

  // 1. Compute missing required roles. A role is "covered" if it has
  //    >= 1 session with ready responses across any input lane.
  const coveredRequiredRoles = new Set<StakeholderRole>();
  let totalSessionsInvited = 0;
  const allLanes = new Set<IntakeLane>();
  for (const row of input.roleCoverage) {
    totalSessionsInvited += row.sessionsInvited;
    for (const lane of row.contributingLanes) allLanes.add(lane);
    if (
      REQUIRED_INTAKE_ROLES.has(row.role) &&
      row.sessionsWithReadyResponses > 0
    ) {
      coveredRequiredRoles.add(row.role);
    }
  }
  const missingRequiredRoles = Array.from(REQUIRED_INTAKE_ROLES).filter(
    (r) => !coveredRequiredRoles.has(r),
  );

  // 2. Hard-block reasons (each one keeps `ready = false`).
  if (totalSessionsInvited === 0) {
    reasons.push({
      code: "no-stakeholders-invited",
      message:
        "No stakeholders have been invited or staged yet. Add at least one stakeholder before synthesis can begin.",
    });
  }

  if (coveredRequiredRoles.size < MIN_REQUIRED_ROLES_WITH_READY_RESPONSE) {
    reasons.push({
      code: "missing-required-role-coverage",
      message: `Only ${coveredRequiredRoles.size} of the required ${MIN_REQUIRED_ROLES_WITH_READY_RESPONSE} role perspectives have responses marked ready for synthesis. Required roles: ${Array.from(
        REQUIRED_INTAKE_ROLES,
      ).join(", ")}.`,
    });
  }

  if (input.totalReadyResponses < MIN_TOTAL_READY_RESPONSES) {
    reasons.push({
      code: "insufficient-ready-responses",
      message: `Only ${input.totalReadyResponses} of the minimum ${MIN_TOTAL_READY_RESPONSES} ready-for-synthesis responses are present. Drafts and voided responses are excluded.`,
    });
  }

  if (!input.documentsClearedOrAcknowledged) {
    reasons.push({
      code: "documents-not-cleared",
      message:
        "At least one supporting document must be uploaded OR the operator must explicitly sign off that no supporting documents are needed for this engagement.",
    });
  }

  // 3. Advisories (don't block, but worth surfacing).
  const highestLaneSignal = LANE_PRIORITY.find((l) => allLanes.has(l)) ?? null;
  if (highestLaneSignal === "offline_operator") {
    advisories.push(
      "Synthesis input is currently from operator-entered (tertiary) signal only. Consider capturing at least one live-link response or transcript before findings synthesis to anchor primary signal.",
    );
  } else if (
    highestLaneSignal === "transcript" &&
    !allLanes.has("live_link")
  ) {
    advisories.push(
      "Synthesis input is currently from transcripts (secondary) only. Live-link responses, if available, will anchor first-hand stakeholder voice.",
    );
  }
  if (input.totalDocuments === 0 && input.documentsClearedOrAcknowledged) {
    advisories.push(
      "Operator has acknowledged the no-documents condition. Findings will rely solely on stakeholder responses; ensure responses cover the operational dimensions documents would have answered.",
    );
  }

  return {
    ready: reasons.length === 0,
    missingRequiredRoles,
    reasons,
    highestLaneSignal,
    advisories,
  };
}

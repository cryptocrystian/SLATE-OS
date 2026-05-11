/**
 * Stakeholder Coverage Matrix — Sprint 0B adapter.
 *
 * Aggregates persisted `stakeholder_intake_responses` (here exposed via
 * the higher-level `Stakeholder` shape) by role × topic and maps the
 * resulting response counts into the exhibit's 4-tone evidence-strength
 * scale, per docs/17 § Group A row 4.
 *
 *   ⚠ Topic-axis note.
 *   The persisted intake response shape does not carry an explicit
 *   topic taxonomy today — responses are keyed by `question_id` /
 *   `question_label`. Per the canon (§ "do not infer topics from
 *   answer text if topic metadata is unavailable"), the adapter MUST
 *   NOT synthesize topics from free text. The caller therefore
 *   supplies:
 *     - `topics: string[]` — the explicit topic column axis
 *     - `topicForStakeholder` — a pure callback that maps each
 *       stakeholder (and optionally a question) to a topic; returning
 *       `null` means "no contribution to any topic"
 *
 *   When the caller omits a topic resolver, the adapter returns
 *   `insufficient_data` with code `no_topic_taxonomy`. This is the
 *   honest Sprint 0B state — the diagnostic surface surfaces the
 *   blocker explicitly. A future sprint (likely the same one that
 *   wires the engagement intake template's topic axis) will supply a
 *   real resolver.
 *
 * Pure function. No React, no DB client, no app-route imports, no I/O.
 * Never throws on ordinary bad data.
 */

import type {
  StakeholderCoverageCell,
  StakeholderCoverageMatrixProps,
  StakeholderEvidenceStrength,
} from "@/components/charts/exhibits/stakeholder-coverage-matrix";
import {
  adapterInsufficientData,
  adapterReady,
  createAdapterSourceSummary,
  persistedSourceNote,
  PERSISTED_SOURCE_LABEL,
  type ChartAdapterIssue,
  type ChartAdapterResult,
} from "@/lib/charts/adapters/types";
import type { Stakeholder, StakeholderRole } from "@/lib/intake/types";

export interface StakeholderCoverageAdapterArgs {
  /** All stakeholders for the engagement. */
  stakeholders: Stakeholder[];
  /** Row order, top to bottom. Required. */
  roles: string[];
  /** Column order, left to right. Required. */
  topics: string[];
  /**
   * Pure callback mapping (stakeholder, topic) → number of supporting
   * responses for that intersection. Returning `0` is allowed — the
   * cell becomes `"missing"`. Returning a positive integer drives the
   * evidence-strength bucket. The adapter only calls this for
   * (role, topic) intersections present in `roles` × `topics`.
   */
  responseCountFor?: (stakeholder: Stakeholder, topic: string) => number;
  /**
   * Optional mapping from `StakeholderRole` (typed enum) to the
   * caller's role-axis labels. When omitted, the adapter falls back to
   * the persisted role enum as-is.
   */
  roleLabelOverride?: Partial<Record<StakeholderRole, string>>;
  generatedAt: string | Date;
  lastTouchedAt?: string | Date | null;
}

export function stakeholderCoverageFromIntake(
  args: StakeholderCoverageAdapterArgs,
): ChartAdapterResult<StakeholderCoverageMatrixProps> {
  const {
    stakeholders,
    roles,
    topics,
    responseCountFor,
    roleLabelOverride,
    generatedAt,
    lastTouchedAt,
  } = args;

  const safeRows = Array.isArray(stakeholders) ? stakeholders : [];

  const sourceSummary = createAdapterSourceSummary({
    source: PERSISTED_SOURCE_LABEL["stakeholder-intake-responses"],
    rowCount: safeRows.length,
    generatedAt,
    lastTouchedAt: lastTouchedAt ?? null,
  });

  if (safeRows.length === 0) {
    return adapterInsufficientData<StakeholderCoverageMatrixProps>(
      sourceSummary,
      [
        {
          code: "no_intake_responses",
          severity: "info",
          message:
            "No stakeholder intake responses exist for this engagement yet. Invite stakeholders and collect responses to assemble the coverage matrix.",
        },
      ],
    );
  }

  if (!Array.isArray(roles) || roles.length === 0) {
    return adapterInsufficientData<StakeholderCoverageMatrixProps>(
      sourceSummary,
      [
        {
          code: "no_role_axis",
          severity: "info",
          message:
            "No role axis supplied. Pass `roles` (row order) to assemble the coverage matrix.",
          field: "roles",
        },
      ],
    );
  }
  if (!Array.isArray(topics) || topics.length === 0) {
    return adapterInsufficientData<StakeholderCoverageMatrixProps>(
      sourceSummary,
      [
        {
          code: "no_topic_axis",
          severity: "info",
          message:
            "No topic axis supplied. Pass `topics` (column order) to assemble the coverage matrix.",
          field: "topics",
        },
      ],
    );
  }
  if (!responseCountFor) {
    return adapterInsufficientData<StakeholderCoverageMatrixProps>(
      sourceSummary,
      [
        {
          code: "no_topic_taxonomy",
          severity: "info",
          message:
            "Persisted intake responses do not yet carry topic tagging. The coverage matrix will activate once a future sprint supplies a `responseCountFor(stakeholder, topic)` resolver.",
          field: "responseCountFor",
        },
      ],
    );
  }

  const issues: ChartAdapterIssue[] = [];

  // Group stakeholders by their persisted role label. Missing roles in
  // the axis array still emit `"missing"` cells (the exhibit relies on
  // axis-driven iteration; the cells array is a sparse map).
  const stakeholdersByRoleLabel = new Map<string, Stakeholder[]>();
  for (const role of roles) stakeholdersByRoleLabel.set(role, []);
  for (const s of safeRows) {
    const roleLabel =
      roleLabelOverride?.[s.role] ?? (s.role as unknown as string);
    const bucket = stakeholdersByRoleLabel.get(roleLabel);
    if (!bucket) {
      issues.push({
        code: "role_outside_axis",
        severity: "info",
        message: `Stakeholder ${s.id} has role "${roleLabel}" which is not in the supplied roles array; row excluded from the matrix.`,
      });
      continue;
    }
    bucket.push(s);
  }

  const cells: StakeholderCoverageCell[] = [];
  for (const role of roles) {
    const bucket = stakeholdersByRoleLabel.get(role) ?? [];
    for (const topic of topics) {
      let count = 0;
      for (const s of bucket) {
        let perStakeholder: number;
        try {
          perStakeholder = responseCountFor(s, topic);
        } catch {
          // Defensive: a misbehaving resolver must not crash the adapter.
          perStakeholder = 0;
          issues.push({
            code: "resolver_threw",
            severity: "warning",
            message: `responseCountFor(stakeholder=${s.id}, topic=${topic}) threw; treated as 0 responses.`,
          });
        }
        if (Number.isFinite(perStakeholder) && perStakeholder > 0) {
          count += Math.floor(perStakeholder);
        }
      }
      cells.push({
        role,
        topic,
        strength: strengthForCount(count),
        responseCount: count,
      });
    }
  }

  const props: StakeholderCoverageMatrixProps = {
    cells,
    roles,
    topics,
    sourceNote: persistedSourceNote(
      PERSISTED_SOURCE_LABEL["stakeholder-intake-responses"],
      safeRows.length,
    ),
  };

  return adapterReady(props, sourceSummary, issues);
}

/**
 * Evidence-strength bucketing per docs/17 § Group A row 4 + the canon's
 * adapter rules:
 *   0 responses → missing
 *   1 response  → thin
 *   2 responses → adequate
 *   3+          → strong
 */
function strengthForCount(count: number): StakeholderEvidenceStrength {
  if (count <= 0) return "missing";
  if (count === 1) return "thin";
  if (count === 2) return "adequate";
  return "strong";
}

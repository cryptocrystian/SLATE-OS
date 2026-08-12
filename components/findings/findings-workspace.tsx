"use client";

import * as React from "react";
import {
  AlertTriangle,
  Plus,
  ShieldAlert,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { FindingStatusChip } from "./finding-status-chip";
import { ConfidenceIndicator } from "./confidence-indicator";
import { EvidencePanel } from "./evidence-panel";
import {
  CATEGORY_TONE,
  FINDING_FILTERS,
  type FindingFilterId,
} from "@/lib/findings/helpers";
import { summarizeFindingProvenance } from "@/lib/findings/provenance";
import { FindingReviewActionBar } from "./review-action-bar";
import type { Finding } from "@/lib/findings/types";

const CATEGORY_TONE_MAP: Record<string, BadgeTone> = {
  info: "info",
  warning: "warning",
  neutral: "neutral",
  brand: "brand",
  ai: "ai",
  success: "success",
};

export interface FindingsWorkspaceProps {
  findings: Finding[];
  /**
   * Selects which per-finding action bar to mount inside the detail
   * panel. Boolean-shaped instead of a render-prop function so it can
   * cross the Server-Component → Client-Component serialization
   * boundary in Next.js 14 (functions cannot, render-prop crashed live
   * synthesis runs with digest `463418387` once findings landed).
   * `"review"` mounts the persisted `FindingReviewActionBar`;
   * `undefined` mounts no action bar (mock-data path).
   */
  actionMode?: "review";
}

export function FindingsWorkspace({
  findings,
  actionMode,
}: FindingsWorkspaceProps) {
  const [active, setActive] = React.useState<FindingFilterId>(
    findings.some((f) => f.reviewStatus === "needs-review")
      ? "needs-review"
      : "all",
  );
  const [selectedId, setSelectedId] = React.useState<string | null>(
    findings[0]?.id ?? null,
  );

  const counts = React.useMemo(() => {
    const c: Record<FindingFilterId, number> = {
      all: findings.length,
      draft: 0,
      "needs-review": 0,
      approved: 0,
      edited: 0,
      rejected: 0,
      "report-ready": 0,
    };
    for (const f of findings) c[f.reviewStatus] += 1;
    return c;
  }, [findings]);

  const filtered = React.useMemo(() => {
    if (active === "all") return findings;
    return findings.filter((f) => f.reviewStatus === active);
  }, [findings, active]);

  React.useEffect(() => {
    if (filtered.length === 0) return;
    if (!filtered.some((f) => f.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = findings.find((f) => f.id === selectedId) ?? null;

  if (findings.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles className="h-4 w-4" />}
        title="No findings yet"
        description="Findings will appear after stakeholder intake responses or documents have been analyzed. Once intake closes, SLATE will draft candidate findings for review."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* List + filters */}
      <div className="flex flex-col gap-3 lg:col-span-4">
        <div
          role="tablist"
          aria-label="Filter findings by review status"
          className="flex flex-wrap gap-1.5 rounded-lg border border-border-subtle bg-bg-surface/60 p-1.5"
        >
          {FINDING_FILTERS.map((filter) => {
            const isActive = active === filter.id;
            return (
              <button
                key={filter.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActive(filter.id)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-xs font-medium tracking-tight transition-colors",
                  isActive
                    ? "bg-bg-elevated text-text-primary shadow-card"
                    : "text-text-secondary hover:bg-bg-elevated/60 hover:text-text-primary",
                )}
              >
                <span>{filter.label}</span>
                <span
                  className={cn(
                    "rounded-full px-1.5 py-px font-mono text-[10px] tabular-nums",
                    isActive
                      ? "bg-brand-primary/15 text-brand-primary"
                      : "bg-white/[0.06] text-text-muted",
                  )}
                >
                  {counts[filter.id]}
                </span>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-subtle bg-bg-surface/40 p-4 text-xs text-text-muted">
            No findings in this lane.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {filtered.map((f) => {
              const isSelected = f.id === selectedId;
              return (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(f.id)}
                    aria-pressed={isSelected}
                    aria-label={`${f.statement}, ${f.reviewStatus}`}
                    className={cn(
                      "flex w-full flex-col gap-2 rounded-lg border p-3 text-left transition-colors",
                      isSelected
                        ? "border-brand-primary/60 bg-brand-primary/[0.06]"
                        : "border-border-subtle bg-bg-surface hover:border-border-strong hover:bg-bg-elevated/60",
                    )}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={CATEGORY_TONE_MAP[CATEGORY_TONE[f.category]] ?? "neutral"}>
                        {f.category}
                      </Badge>
                      <FindingStatusChip status={f.reviewStatus} />
                      {f.aiDrafted !== false ? (
                        <Badge tone="ai" variant="outline">
                          <Sparkles className="mr-1 h-2.5 w-2.5" />
                          AI
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm font-medium leading-snug text-text-primary">
                      {f.statement}
                    </p>
                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <ConfidenceIndicator confidence={f.confidence} />
                      <span className="font-mono tabular-nums text-text-muted">
                        {f.sourceRefs.length} source
                        {f.sourceRefs.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    {/* Sprint S5 — Needs-validation chip on the card.
                        Computed inline from the persisted refs + the
                        finding's assumption flag. */}
                    <FindingProvenanceChip finding={f} compact />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Detail panel */}
      <div className="flex flex-col gap-4 lg:col-span-5">
        {selected ? (
          <FindingDetail finding={selected} actionMode={actionMode} />
        ) : (
          <p className="rounded-md border border-dashed border-border-subtle bg-bg-surface/40 p-4 text-xs text-text-muted">
            Select a finding to review.
          </p>
        )}
      </div>

      {/* Evidence panel */}
      <div className="flex flex-col gap-4 lg:col-span-3">
        <EvidencePanel finding={selected} />
      </div>
    </div>
  );
}

function FindingDetail({
  finding,
  actionMode,
}: {
  finding: Finding;
  actionMode?: "review";
}) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={CATEGORY_TONE_MAP[CATEGORY_TONE[finding.category]] ?? "neutral"}>
            {finding.category}
          </Badge>
          <FindingStatusChip status={finding.reviewStatus} />
          {finding.aiDrafted !== false ? (
            <Badge tone="ai" variant="outline">
              <Sparkles className="mr-1 h-3 w-3" />
              AI-drafted
            </Badge>
          ) : (
            <Badge tone="neutral" variant="outline">
              Operator-authored
            </Badge>
          )}
        </div>

        <h2 className="text-lg font-semibold leading-snug tracking-tight text-text-primary sm:text-xl">
          {finding.statement}
        </h2>

        {/* Sprint S5 — Provenance row: per-lane chip + needs-validation badge. */}
        <FindingProvenanceChip finding={finding} />

        <ConfidenceIndicator confidence={finding.confidence} variant="block" />

        <div className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
            Summary
          </span>
          <p className="text-sm leading-relaxed text-text-secondary">
            {finding.summary}
          </p>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-elevated/40 p-3">
          <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
            Evidence summary
          </span>
          <p className="text-xs leading-relaxed text-text-secondary">
            {finding.evidenceSummary}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
            Suggested impact
          </span>
          <p className="text-sm leading-relaxed text-text-secondary">
            {finding.suggestedImpact}
          </p>
        </div>

        {finding.assumptionFlag ? (
          <div className="flex items-start gap-3 rounded-lg border border-status-warning/30 bg-status-warning/10 p-3">
            <AlertTriangle
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 text-status-warning"
            />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-status-warning">
                Assumption flag
              </span>
              <p className="text-xs leading-relaxed text-text-secondary">
                {finding.assumptionFlag}
              </p>
            </div>
          </div>
        ) : null}

        {finding.reviewerNote ? (
          <div className="flex items-start gap-3 rounded-lg border border-border-subtle bg-bg-elevated/40 p-3">
            <StickyNote
              aria-hidden
              className="mt-0.5 h-4 w-4 shrink-0 text-text-secondary"
            />
            <div className="flex flex-col gap-1">
              <span className="text-xs font-medium text-text-primary">
                Reviewer note
              </span>
              <p className="text-xs leading-relaxed text-text-secondary">
                {finding.reviewerNote}
              </p>
            </div>
          </div>
        ) : null}

        {actionMode === "review" ? (
          <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
            <FindingReviewActionBar finding={finding} />
          </div>
        ) : null}
      </CardBody>
    </Card>
  );
}

/**
 * Sprint S5 — Per-finding provenance + needs-validation chip row.
 *
 * Two render modes:
 *   - `compact` (used in the card list) — single `Needs validation`
 *     badge OR a small evidence-strength dot, only rendered when there's
 *     something operator-actionable to surface.
 *   - default (used in the detail card) — full chip row with lane counts +
 *     dominant strength + needs-validation badge + reason tooltip.
 */
function FindingProvenanceChip({
  finding,
  compact = false,
}: {
  finding: Finding;
  compact?: boolean;
}) {
  const provenance = React.useMemo(
    () =>
      summarizeFindingProvenance(
        finding.sourceRefs,
        Boolean(finding.assumptionFlag),
      ),
    [finding.sourceRefs, finding.assumptionFlag],
  );

  if (compact) {
    if (provenance.needsValidation) {
      return (
        <Badge tone="warning" variant="outline" dot>
          <ShieldAlert className="mr-1 h-2.5 w-2.5" />
          Needs validation
        </Badge>
      );
    }
    return null;
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated/30 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-[0.16em] text-text-muted">
          Provenance
        </span>
        {provenance.needsValidation ? (
          <Badge tone="warning" variant="outline" dot>
            <ShieldAlert className="mr-1 h-2.5 w-2.5" />
            Needs validation
          </Badge>
        ) : (
          <Badge tone="success" variant="outline" dot>
            Evidence-backed
          </Badge>
        )}
        <Badge tone="neutral" variant="outline">
          Strength: {provenance.dominantStrength}
        </Badge>
      </div>
      <div className="flex flex-wrap gap-1.5 text-[11px]">
        {provenance.stakeholderResponseRefs > 0 ? (
          <Badge tone="info" variant="outline">
            Stakeholder ·{" "}
            <span className="font-mono tabular-nums">
              {provenance.stakeholderResponseRefs}
            </span>
          </Badge>
        ) : null}
        {provenance.uploadedDocumentRefs > 0 ? (
          <Badge tone="neutral" variant="outline">
            Document ·{" "}
            <span className="font-mono tabular-nums">
              {provenance.uploadedDocumentRefs}
            </span>
          </Badge>
        ) : null}
        {provenance.scorecardAnswerRefs > 0 ? (
          <Badge tone="neutral" variant="outline">
            Scorecard ·{" "}
            <span className="font-mono tabular-nums">
              {provenance.scorecardAnswerRefs}
            </span>
          </Badge>
        ) : null}
        {provenance.consultantNoteRefs > 0 ? (
          <Badge tone="neutral" variant="outline">
            Consultant note ·{" "}
            <span className="font-mono tabular-nums">
              {provenance.consultantNoteRefs}
            </span>
          </Badge>
        ) : null}
        {provenance.totalRefs === 0 ? (
          <Badge tone="warning" variant="outline">
            No source refs attached
          </Badge>
        ) : null}
      </div>
      {provenance.needsValidationReason ? (
        <p className="text-[11px] leading-relaxed text-text-muted">
          {provenance.needsValidationReason}
        </p>
      ) : null}
    </div>
  );
}

export function ManualFindingPlaceholder() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-dashed border-border-subtle bg-bg-surface/40 p-4">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-secondary">
        <Plus className="h-3.5 w-3.5" />
      </span>
      <div className="flex flex-col gap-1">
        <span className="text-sm font-medium text-text-primary">
          Add a manual finding
        </span>
        <p className="text-xs leading-relaxed text-text-muted">
          Consultant-authored findings sit alongside AI-drafted ones and follow
          the same approval flow.
        </p>
      </div>
    </div>
  );
}

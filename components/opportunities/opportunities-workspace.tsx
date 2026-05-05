"use client";

import * as React from "react";
import { ArrowRight, ShieldAlert, Sparkles, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { OpportunityMatrix } from "./opportunity-matrix";
import { OpportunityCard } from "./opportunity-card";
import { OpportunityPriorityChip } from "./opportunity-priority-chip";
import { OpportunityScoreStrip } from "./opportunity-score-strip";
import { RelatedFindingsPanel } from "./related-findings-panel";
import {
  CATEGORY_TONE,
  EVIDENCE_LABEL,
  EVIDENCE_TONE,
  OPPORTUNITY_FILTERS,
  type OpportunityFilterId,
} from "@/lib/opportunities/helpers";
import type { Opportunity } from "@/lib/opportunities/types";
import type { Finding } from "@/lib/findings/types";

const CATEGORY_TONE_MAP: Record<string, BadgeTone> = {
  info: "info",
  warning: "warning",
  neutral: "neutral",
  brand: "brand",
  ai: "ai",
  success: "success",
};

const EVIDENCE_TONE_MAP: Record<string, BadgeTone> = {
  success: "success",
  info: "info",
  warning: "warning",
};

export interface OpportunitiesWorkspaceProps {
  engagementId: string;
  opportunities: Opportunity[];
  findings: Finding[];
  /** Optional render-prop for the per-opportunity action bar. When
   *  provided, the persisted action bar renders inside the detail panel
   *  in place of the static placeholder. */
  renderActionBar?: (opportunity: Opportunity) => React.ReactNode;
}

export function OpportunitiesWorkspace({
  engagementId,
  opportunities,
  findings,
  renderActionBar,
}: OpportunitiesWorkspaceProps) {
  const [active, setActive] = React.useState<OpportunityFilterId>("all");
  const [selectedId, setSelectedId] = React.useState<string | null>(
    opportunities[0]?.id ?? null,
  );

  const counts: Record<OpportunityFilterId, number> = React.useMemo(() => {
    const c: Record<OpportunityFilterId, number> = {
      all: opportunities.length,
      "quick-win": 0,
      "strategic-build": 0,
      "low-priority": 0,
      "defer-avoid": 0,
    };
    for (const o of opportunities) c[o.quadrant] += 1;
    return c;
  }, [opportunities]);

  const filtered = React.useMemo(() => {
    if (active === "all") return opportunities;
    return opportunities.filter((o) => o.quadrant === active);
  }, [opportunities, active]);

  React.useEffect(() => {
    if (filtered.length === 0) return;
    if (!filtered.some((f) => f.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = opportunities.find((o) => o.id === selectedId) ?? null;
  const findingsById = React.useMemo(
    () => Object.fromEntries(findings.map((f) => [f.id, f])),
    [findings],
  );
  const relatedFindings = selected
    ? selected.relatedFindingIds
        .map((id) => findingsById[id])
        .filter((f): f is Finding => Boolean(f))
    : [];

  return (
    <div className="flex flex-col gap-6">
      <OpportunityMatrix
        opportunities={opportunities}
        selectedId={selectedId}
        onSelect={setSelectedId}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col gap-4 lg:col-span-5">
          <div
            role="tablist"
            aria-label="Filter opportunities by quadrant"
            className="flex flex-wrap gap-1.5 rounded-lg border border-border-subtle bg-bg-surface/60 p-1.5"
          >
            {OPPORTUNITY_FILTERS.map((filter) => {
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
              Nothing in this quadrant.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {filtered.map((o) => (
                <li key={o.id}>
                  <OpportunityCard
                    opportunity={o}
                    selected={o.id === selectedId}
                    onClick={() => setSelectedId(o.id)}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="flex flex-col gap-4 lg:col-span-7">
          {selected ? (
            <OpportunityDetailPanel opportunity={selected} />
          ) : (
            <p className="rounded-md border border-dashed border-border-subtle bg-bg-surface/40 p-4 text-xs text-text-muted">
              Select an opportunity to review.
            </p>
          )}
          {selected && renderActionBar ? (
            <div>{renderActionBar(selected)}</div>
          ) : null}
          {selected ? (
            <RelatedFindingsPanel
              engagementId={engagementId}
              findings={relatedFindings}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

function OpportunityDetailPanel({
  opportunity,
}: {
  opportunity: Opportunity;
}) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            tone={CATEGORY_TONE_MAP[CATEGORY_TONE[opportunity.category]] ?? "neutral"}
          >
            {opportunity.category}
          </Badge>
          <OpportunityPriorityChip priority={opportunity.priority} />
          <Badge
            tone={EVIDENCE_TONE_MAP[EVIDENCE_TONE[opportunity.evidenceStrength]] ?? "neutral"}
            variant="outline"
          >
            {EVIDENCE_LABEL[opportunity.evidenceStrength]}
          </Badge>
        </div>

        <h2 className="text-lg font-semibold leading-snug tracking-tight text-text-primary sm:text-xl">
          {opportunity.title}
        </h2>

        <p className="text-sm leading-relaxed text-text-secondary">
          {opportunity.description}
        </p>

        <OpportunityScoreStrip opportunity={opportunity} />

        <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-elevated/40 p-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
            Implementation shape
          </span>
          <p className="text-xs leading-relaxed text-text-secondary">
            {opportunity.implementationShape}
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
            Source summary
          </span>
          <p className="text-xs leading-relaxed text-text-secondary">
            {opportunity.sourceSummary}
          </p>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Block
            icon={<ShieldAlert className="h-3.5 w-3.5 text-status-warning" />}
            label="Risks"
            items={opportunity.risks}
          />
          <Block
            icon={<Target className="h-3.5 w-3.5 text-status-info" />}
            label="Dependencies"
            items={opportunity.dependencies}
          />
          <Block
            icon={<Sparkles className="h-3.5 w-3.5 text-status-success" />}
            label="Success signals"
            items={opportunity.successSignals}
          />
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border-strong bg-bg-elevated/60 p-4">
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
            Recommended next action
          </span>
          <p className="text-sm leading-relaxed text-text-primary">
            {opportunity.recommendedAction}
          </p>
          <p className="border-t border-border-subtle pt-2 text-[11px] text-text-muted">
            <ArrowRight aria-hidden className="mr-1 inline h-3 w-3 align-text-bottom" />
            Lands in the 30/60/90-day roadmap on the next page.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

function Block({
  icon,
  label,
  items,
}: {
  icon: React.ReactNode;
  label: string;
  items: string[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-elevated/40 p-3">
      <div className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated">
          {icon}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
          {label}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="text-[11px] text-text-muted">—</p>
      ) : (
        <ul className="flex flex-col gap-1.5 text-[11px] leading-relaxed text-text-secondary">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2">
              <span
                aria-hidden
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-muted"
              />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

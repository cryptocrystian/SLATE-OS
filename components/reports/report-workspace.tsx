"use client";

import * as React from "react";
import {
  AlertTriangle,
  Check,
  Pencil,
  RefreshCw,
  Sparkles,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ReportSectionStatusChip } from "./report-status-chip";
import { ReportSectionActionBar } from "./report-section-action-bar";
import {
  CONFIDENCE_LABEL,
  CONFIDENCE_TONE,
  REPORT_FILTERS,
  SECTION_LABEL,
  type ReportFilterId,
} from "@/lib/reports/helpers";
import type { Report, ReportSection } from "@/lib/reports/types";
import type { Finding } from "@/lib/findings/types";
import type { Opportunity } from "@/lib/opportunities/types";
import type { RoadmapItem } from "@/lib/roadmap/types";

const CONFIDENCE_TONE_MAP: Record<string, BadgeTone> = {
  success: "success",
  info: "info",
  warning: "warning",
  risk: "risk",
};

export interface ReportWorkspaceProps {
  engagementId: string;
  report: Report;
  findings: Finding[];
  opportunities: Opportunity[];
  roadmap: RoadmapItem[];
  /**
   * When true, the per-section `<ReportSectionActionBar>` is rendered
   * inline. Mock / legacy slug engagements pass `false` (or omit) to
   * suppress the action bar entirely.
   *
   * The previous `renderActionBar` render-prop API was replaced because
   * a server-component-created function closure cannot cross the
   * server → client boundary in Next.js 14 (runtime serialization
   * error). The client workspace now imports
   * `<ReportSectionActionBar>` directly and decides per-section
   * whether to render it from JSON-safe props.
   */
  showActionBar?: boolean;
  /**
   * Whether the server has confirmed `OPENAI_API_KEY` is configured.
   * Threaded into `<ReportSectionActionBar>` so the AI control is
   * hidden in unconfigured environments. JSON-safe boolean.
   */
  aiAvailable?: boolean;
}

export function ReportWorkspace({
  engagementId,
  report,
  findings,
  opportunities,
  roadmap,
  showActionBar = false,
  aiAvailable = false,
}: ReportWorkspaceProps) {
  const sections = report.sections;
  const [active, setActive] = React.useState<ReportFilterId>("all");
  const initialId =
    sections.find((s) => s.status === "needs-review")?.id ??
    sections[0]?.id ??
    null;
  const [selectedId, setSelectedId] = React.useState<string | null>(initialId);

  const counts: Record<ReportFilterId, number> = React.useMemo(() => {
    const c: Record<ReportFilterId, number> = {
      all: sections.length,
      "not-started": 0,
      drafted: 0,
      "needs-review": 0,
      approved: 0,
      final: 0,
    };
    for (const s of sections) c[s.status] += 1;
    return c;
  }, [sections]);

  const filtered = React.useMemo(() => {
    if (active === "all") return sections;
    return sections.filter((s) => s.status === active);
  }, [sections, active]);

  React.useEffect(() => {
    if (filtered.length === 0) return;
    if (!filtered.some((s) => s.id === selectedId)) {
      setSelectedId(filtered[0].id);
    }
  }, [filtered, selectedId]);

  const selected = sections.find((s) => s.id === selectedId) ?? null;

  const findingsById = React.useMemo(
    () => Object.fromEntries(findings.map((f) => [f.id, f])),
    [findings],
  );
  const opportunitiesById = React.useMemo(
    () => Object.fromEntries(opportunities.map((o) => [o.id, o])),
    [opportunities],
  );
  const roadmapById = React.useMemo(
    () => Object.fromEntries(roadmap.map((r) => [r.id, r])),
    [roadmap],
  );

  const linkedFindings = selected
    ? selected.linkedFindingIds
        .map((id) => findingsById[id])
        .filter((f): f is Finding => Boolean(f))
    : [];
  const linkedOpportunities = selected
    ? selected.linkedOpportunityIds
        .map((id) => opportunitiesById[id])
        .filter((o): o is Opportunity => Boolean(o))
    : [];
  const linkedRoadmapItems = selected
    ? selected.linkedRoadmapItemIds
        .map((id) => roadmapById[id])
        .filter((r): r is RoadmapItem => Boolean(r))
    : [];

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      {/* Outline */}
      <div className="flex flex-col gap-3 lg:col-span-3">
        <div
          role="tablist"
          aria-label="Filter report sections by status"
          className="flex flex-wrap gap-1.5 rounded-lg border border-border-subtle bg-bg-surface/60 p-1.5"
        >
          {REPORT_FILTERS.map((filter) => {
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

        <ol className="flex flex-col gap-1.5">
          {filtered.map((s) => {
            const canonicalIdx = sections.findIndex((x) => x.id === s.id);
            const sectionNumber = String(canonicalIdx + 1).padStart(2, "0");
            const isSelected = s.id === selectedId;
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setSelectedId(s.id)}
                  aria-pressed={isSelected}
                  aria-label={`Section ${sectionNumber} of ${sections.length}, ${s.title}, ${s.status}`}
                  className={cn(
                    "flex w-full flex-col gap-1.5 rounded-lg border p-3 text-left transition-colors",
                    isSelected
                      ? "border-brand-primary/60 bg-brand-primary/[0.06]"
                      : "border-border-subtle bg-bg-surface hover:border-border-strong hover:bg-bg-elevated/60",
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
                      {sectionNumber}
                    </span>
                    <ReportSectionStatusChip status={s.status} />
                  </div>
                  <span className="text-sm font-medium text-text-primary">
                    {s.title}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </div>

      {/* Selected section preview */}
      <div className="flex flex-col gap-4 lg:col-span-6">
        {selected ? (
          <SectionPreview
            section={selected}
            linkedFindingsCount={linkedFindings.length}
            linkedOpportunitiesCount={linkedOpportunities.length}
            linkedRoadmapItemsCount={linkedRoadmapItems.length}
            actionBar={
              showActionBar ? (
                <ReportSectionActionBar
                  sectionId={selected.id}
                  status={selected.status}
                  engagementId={engagementId}
                  aiAvailable={aiAvailable}
                />
              ) : null
            }
          />
        ) : (
          <p className="rounded-md border border-dashed border-border-subtle bg-bg-surface/40 p-4 text-xs text-text-muted">
            Select a section to review.
          </p>
        )}
      </div>

      {/* Linked context */}
      <div className="flex flex-col gap-4 lg:col-span-3">
        {selected ? (
          <LinkedRefsPanel
            engagementId={engagementId}
            findings={linkedFindings}
            opportunities={linkedOpportunities}
            roadmapItems={linkedRoadmapItems}
            evidenceNotes={selected.evidenceNotes}
          />
        ) : null}
      </div>
    </div>
  );

  function SectionPreview({
    section,
    linkedFindingsCount,
    linkedOpportunitiesCount,
    linkedRoadmapItemsCount,
    actionBar,
  }: {
    section: ReportSection;
    linkedFindingsCount: number;
    linkedOpportunitiesCount: number;
    linkedRoadmapItemsCount: number;
    actionBar?: React.ReactNode;
  }) {
    return (
      <Card variant="base">
        <CardBody className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-text-muted">
              {SECTION_LABEL[section.sectionType]}
            </span>
            <ReportSectionStatusChip status={section.status} />
            {section.aiDrafted ? (
              <Badge tone="ai" variant="outline">
                <Sparkles aria-hidden className="mr-1 h-3 w-3" />
                AI-drafted
              </Badge>
            ) : (
              <Badge tone="brand" variant="outline">
                Consultant-authored
              </Badge>
            )}
            <Badge
              tone={
                CONFIDENCE_TONE_MAP[CONFIDENCE_TONE[section.confidence]] ??
                "neutral"
              }
              variant="outline"
            >
              {CONFIDENCE_LABEL[section.confidence]}
            </Badge>
          </div>

          <h2 className="text-lg font-semibold leading-snug tracking-tight text-text-primary sm:text-xl">
            {section.title}
          </h2>

          <p className="text-sm leading-relaxed text-text-secondary">
            {section.summary}
          </p>

          <div className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-elevated/40 p-4">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
              Draft preview
            </span>
            {section.draftPreview ? (
              <p className="whitespace-pre-line text-sm leading-relaxed text-text-secondary">
                {section.draftPreview}
              </p>
            ) : (
              <p className="rounded-md border border-dashed border-border-subtle bg-bg-surface/40 p-3 text-xs text-text-muted">
                Draft hasn’t been generated yet. Generate a draft to begin
                review.
              </p>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2 text-[11px]">
            <Cell label="Findings linked" value={linkedFindingsCount} />
            <Cell
              label="Opportunities linked"
              value={linkedOpportunitiesCount}
            />
            <Cell
              label="Roadmap items linked"
              value={linkedRoadmapItemsCount}
            />
          </div>

          {section.reviewerNote ? (
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
                  {section.reviewerNote}
                </p>
              </div>
            </div>
          ) : null}

          {section.confidence === "needs-evidence" && section.aiDrafted ? (
            <div className="flex items-start gap-3 rounded-lg border border-status-warning/30 bg-status-warning/10 p-3">
              <AlertTriangle
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0 text-status-warning"
              />
              <p className="text-xs leading-relaxed text-text-secondary">
                Section needs additional evidence before it can be approved
                for client-facing use.
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 border-t border-border-subtle pt-4">
            {actionBar ? (
              actionBar
            ) : (
              <>
                <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
                  Review actions · mock
                </span>
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="primary"
                    size="sm"
                    leadingIcon={<Check className="h-3.5 w-3.5" />}
                  >
                    Approve section
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    leadingIcon={<Pencil className="h-3.5 w-3.5" />}
                  >
                    Edit section
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={<RefreshCw className="h-3.5 w-3.5" />}
                  >
                    Regenerate draft
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    leadingIcon={<StickyNote className="h-3.5 w-3.5" />}
                  >
                    Add note
                  </Button>
                </div>
                <p className="text-[11px] leading-relaxed text-text-muted">
                  Review actions are mock until persistence ships. Approving a
                  section locks it for the report; editing keeps the consultant
                  in control of the language.
                </p>
              </>
            )}
          </div>
        </CardBody>
      </Card>
    );
  }
}

function Cell({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-elevated/50 px-3 py-2 text-center">
      <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">
        {label}
      </div>
      <div className="font-mono text-base font-semibold tabular-nums text-text-primary">
        {value}
      </div>
    </div>
  );
}

function LinkedRefsPanel({
  engagementId,
  findings,
  opportunities,
  roadmapItems,
  evidenceNotes,
}: {
  engagementId: string;
  findings: Finding[];
  opportunities: Opportunity[];
  roadmapItems: RoadmapItem[];
  evidenceNotes: string;
}) {
  return (
    <Card variant="base" className="h-full">
      <CardBody className="flex h-full flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Linked context
          </span>
          <h3 className="text-sm font-semibold tracking-tight text-text-primary">
            Source trail for this section
          </h3>
        </div>

        <RefBlock
          label="Findings"
          href={`/app/engagements/${engagementId}/findings`}
          items={findings.map((f) => ({
            id: f.id,
            title: f.statement,
          }))}
        />

        <RefBlock
          label="Opportunities"
          href={`/app/engagements/${engagementId}/opportunities`}
          items={opportunities.map((o) => ({ id: o.id, title: o.title }))}
        />

        <RefBlock
          label="Roadmap items"
          href={`/app/engagements/${engagementId}/roadmap`}
          items={roadmapItems.map((r) => ({ id: r.id, title: r.title }))}
        />

        <p className="border-t border-border-subtle pt-3 text-[11px] leading-relaxed text-text-muted">
          {evidenceNotes ||
            "Source trail will populate once the section is drafted from approved evidence."}
        </p>
      </CardBody>
    </Card>
  );
}

function RefBlock({
  label,
  href,
  items,
}: {
  label: string;
  href: string;
  items: Array<{ id: string; title: string }>;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
          {label}
        </span>
        <a
          href={href}
          className="text-[11px] text-text-muted underline-offset-2 hover:text-text-primary hover:underline"
        >
          Open
        </a>
      </div>
      {items.length === 0 ? (
        <p className="rounded-md border border-dashed border-border-subtle bg-bg-surface/40 p-2 text-[11px] text-text-muted">
          None linked.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {items.map((item) => (
            <li
              key={item.id}
              className="flex items-start gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-2 text-[11px] leading-relaxed text-text-secondary"
            >
              <span
                aria-hidden
                className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-text-muted"
              />
              <span className="line-clamp-2">{item.title}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

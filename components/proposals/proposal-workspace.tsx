"use client";

import * as React from "react";
import {
  ArrowRight,
  Calendar,
  Coins,
  ListChecks,
  Sparkles,
  ShieldAlert,
  Target,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { LockedActionButton } from "@/components/ui/locked-action-button";
import {
  OPTION_TYPE_LABEL,
  OPTION_TYPE_TONE,
} from "@/lib/proposals/helpers";
import { ProposalOptionActionBar } from "./proposal-option-action-bar";
import type { Proposal, ProposalOption } from "@/lib/proposals/types";
import type { Opportunity } from "@/lib/opportunities/types";
import type { RoadmapItem } from "@/lib/roadmap/types";

const OPTION_TYPE_TONE_MAP: Record<string, BadgeTone> = {
  success: "success",
  brand: "brand",
  ai: "ai",
};

export interface ProposalWorkspaceProps {
  proposal: Proposal;
  opportunities: Opportunity[];
  roadmap: RoadmapItem[];
  /**
   * Persisted UUID engagement id. When set, the per-option
   * `<ProposalOptionActionBar>` renders inline. Mock / legacy slug
   * engagements omit this prop and the action bar is hidden.
   *
   * The previous `renderOptionActionBar` render-prop API was replaced
   * because a server-component-created function closure cannot cross
   * the server → client boundary in Next.js 14 (runtime
   * serialization error). The client workspace now imports
   * `<ProposalOptionActionBar>` directly and decides whether to
   * render it from JSON-safe props.
   */
  engagementId?: string;
  /**
   * Whether the server has confirmed `OPENAI_API_KEY` is configured.
   * Threaded into `<ProposalOptionActionBar>` so the AI control is
   * hidden in unconfigured environments. JSON-safe boolean.
   */
  aiAvailable?: boolean;
}

export function ProposalWorkspace({
  proposal,
  opportunities,
  roadmap,
  engagementId,
  aiAvailable = false,
}: ProposalWorkspaceProps) {
  const initialId =
    proposal.recommendedOptionId ?? proposal.options[0]?.id ?? null;
  const [selectedId, setSelectedId] = React.useState<string | null>(initialId);

  const opportunitiesById = React.useMemo(
    () => Object.fromEntries(opportunities.map((o) => [o.id, o])),
    [opportunities],
  );
  const roadmapById = React.useMemo(
    () => Object.fromEntries(roadmap.map((r) => [r.id, r])),
    [roadmap],
  );

  const selected =
    proposal.options.find((o) => o.id === selectedId) ??
    proposal.options[0] ??
    null;

  const linkedOpportunities = selected
    ? selected.includedOpportunityIds
        .map((id) => opportunitiesById[id])
        .filter((o): o is Opportunity => Boolean(o))
    : [];
  const linkedRoadmapItems = selected
    ? selected.linkedRoadmapItemIds
        .map((id) => roadmapById[id])
        .filter((r): r is RoadmapItem => Boolean(r))
    : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Option cards row */}
      <section
        aria-label="Proposal options"
        className="grid grid-cols-1 gap-3 lg:grid-cols-3"
      >
        {proposal.options.map((option) => (
          <ProposalOptionCard
            key={option.id}
            option={option}
            selected={option.id === selectedId}
            onSelect={() => setSelectedId(option.id)}
          />
        ))}
      </section>

      {/* Selected option detail */}
      {selected ? (
        <ProposalOptionDetail
          option={selected}
          opportunities={linkedOpportunities}
          roadmapItems={linkedRoadmapItems}
          actionBar={
            engagementId ? (
              <ProposalOptionActionBar
                optionId={selected.id}
                recommended={selected.recommended}
                engagementId={engagementId}
                aiAvailable={aiAvailable}
              />
            ) : null
          }
        />
      ) : null}
    </div>
  );
}

function ProposalOptionCard({
  option,
  selected,
  onSelect,
}: {
  option: ProposalOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const tone = OPTION_TYPE_TONE_MAP[OPTION_TYPE_TONE[option.type]] ?? "brand";
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "flex flex-col gap-3 rounded-xl border p-5 text-left shadow-card transition-colors",
        selected
          ? "border-brand-primary/60 bg-bg-elevated/80"
          : "border-border-subtle bg-bg-surface hover:border-border-strong hover:bg-bg-elevated/60",
        option.recommended && "ring-1 ring-inset ring-brand-primary/30",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Badge tone={tone}>{OPTION_TYPE_LABEL[option.type]}</Badge>
        {option.recommended ? (
          <Badge tone="brand" dot>
            Recommended
          </Badge>
        ) : null}
      </div>
      <h3 className="text-base font-semibold tracking-tight text-text-primary">
        {option.title}
      </h3>
      <p className="text-xs leading-relaxed text-text-muted">
        {option.bestFitScenario}
      </p>
      <dl className="grid grid-cols-2 gap-x-3 gap-y-2 border-t border-border-subtle pt-3 text-[11px]">
        <Field label="Timeline" value={option.timeline} />
        <Field
          label="Opportunities"
          value={String(option.includedOpportunityIds.length)}
        />
        <Field
          label="Roadmap items"
          value={String(option.linkedRoadmapItemIds.length)}
        />
        <Field label="Confidence" value={option.confidence} />
      </dl>
      <p className="mt-1 rounded-md border border-border-subtle bg-bg-elevated/40 px-2 py-1.5 text-[11px] text-text-secondary">
        <span className="font-mono uppercase tracking-[0.12em] text-text-muted">
          Pricing placeholder ·
        </span>{" "}
        {option.pricingPlaceholder}
      </p>
    </button>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="font-mono uppercase tracking-[0.12em] text-text-muted">
        {label}
      </dt>
      <dd className="text-text-secondary">{value}</dd>
    </div>
  );
}

function ProposalOptionDetail({
  option,
  opportunities,
  roadmapItems,
  actionBar,
}: {
  option: ProposalOption;
  opportunities: Opportunity[];
  roadmapItems: RoadmapItem[];
  actionBar?: React.ReactNode;
}) {
  const tone = OPTION_TYPE_TONE_MAP[OPTION_TYPE_TONE[option.type]] ?? "brand";
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={tone}>{OPTION_TYPE_LABEL[option.type]}</Badge>
          {option.recommended ? (
            <Badge tone="brand" dot>
              Recommended
            </Badge>
          ) : null}
        </div>

        <h2 className="text-xl font-semibold tracking-tight text-text-primary">
          {option.title}
        </h2>

        <p className="text-sm leading-relaxed text-text-secondary">
          {option.scopeSummary}
        </p>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Block icon={<Calendar className="h-3.5 w-3.5" />} label="Timeline">
            <p className="text-xs leading-relaxed text-text-secondary">
              {option.timeline}
            </p>
          </Block>
          <Block
            icon={<ListChecks className="h-3.5 w-3.5" />}
            label="Deliverables"
          >
            <ul className="flex flex-col gap-1.5 text-[11px] leading-relaxed text-text-secondary">
              {option.deliverables.map((d, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-success"
                  />
                  {d}
                </li>
              ))}
            </ul>
          </Block>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <Block
            icon={<Sparkles className="h-3.5 w-3.5 text-practice-ai" />}
            label="Included opportunities"
          >
            {opportunities.length === 0 ? (
              <p className="text-[11px] text-text-muted">None linked.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-[11px] leading-relaxed text-text-secondary">
                {opportunities.map((o) => (
                  <li key={o.id} className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-practice-ai"
                    />
                    {o.title}
                  </li>
                ))}
              </ul>
            )}
          </Block>
          <Block
            icon={<Calendar className="h-3.5 w-3.5 text-brand-primary" />}
            label="Linked roadmap items"
          >
            {roadmapItems.length === 0 ? (
              <p className="text-[11px] text-text-muted">None linked.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-[11px] leading-relaxed text-text-secondary">
                {roadmapItems.map((r) => (
                  <li key={r.id} className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-brand-primary"
                    />
                    {r.title}
                  </li>
                ))}
              </ul>
            )}
          </Block>
          <Block
            icon={<Target className="h-3.5 w-3.5 text-status-info" />}
            label="Dependencies"
          >
            {option.dependencies.length === 0 ? (
              <p className="text-[11px] text-text-muted">None.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-[11px] leading-relaxed text-text-secondary">
                {option.dependencies.map((d, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span
                      aria-hidden
                      className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-info"
                    />
                    {d}
                  </li>
                ))}
              </ul>
            )}
          </Block>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Block
            icon={<Target className="h-3.5 w-3.5 text-status-warning" />}
            label="Assumptions"
          >
            <ul className="flex flex-col gap-1.5 text-[11px] leading-relaxed text-text-secondary">
              {option.assumptions.map((a, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-warning"
                  />
                  {a}
                </li>
              ))}
            </ul>
          </Block>
          <Block
            icon={<ShieldAlert className="h-3.5 w-3.5 text-status-warning" />}
            label="Risks"
          >
            <ul className="flex flex-col gap-1.5 text-[11px] leading-relaxed text-text-secondary">
              {option.risks.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span
                    aria-hidden
                    className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-status-warning"
                  />
                  {r}
                </li>
              ))}
            </ul>
          </Block>
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-border-strong bg-bg-elevated/60 p-4">
          <div className="flex items-center gap-2">
            <Coins aria-hidden className="h-4 w-4 text-status-success" />
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
              Pricing placeholder · for internal planning only
            </span>
          </div>
          <p className="text-sm font-semibold text-text-primary">
            {option.pricingPlaceholder}
          </p>
          <p className="text-[11px] leading-relaxed text-text-muted">
            Final pricing depends on systems access, data readiness, and
            implementation assumptions. Validate scope before quoting.
          </p>
        </div>

        {actionBar ? <div className="border-t border-border-subtle pt-3">{actionBar}</div> : null}

        <div className="flex flex-wrap gap-2 border-t border-border-subtle pt-3">
          <LockedActionButton
            label="Prepare SOW Draft"
            lockedNote="Locked"
            size="sm"
          />
          <LockedActionButton
            label="Send to Client"
            lockedNote="Locked"
            size="sm"
          />
          <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-text-muted">
            <ArrowRight aria-hidden className="h-3 w-3" />
            SOW draft, send, and signature stay locked behind a later
            commercial sprint.
          </span>
        </div>
      </CardBody>
    </Card>
  );
}

function Block({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
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
      {children}
    </div>
  );
}

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { cardInteractiveClass } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EngagementStatusChip } from "./engagement-status-chip";
import { STAGES, STAGE_LABEL, stageIndex } from "@/lib/engagements/helpers";
import type { Engagement } from "@/lib/engagements/types";

export interface EngagementListItemProps {
  engagement: Engagement;
}

export function EngagementListItem({ engagement }: EngagementListItemProps) {
  const idx = stageIndex(engagement.currentStage);

  return (
    <Link
      href={`/app/engagements/${engagement.id}`}
      className={cn("group block rounded-xl p-5 sm:p-6", cardInteractiveClass)}
    >
      <div className="flex flex-col gap-5">
        {/* Top: name + status */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="ai">{engagement.engagementType}</Badge>
              <Badge tone="neutral">{engagement.industry}</Badge>
            </div>
            <h3 className="text-base font-semibold tracking-tight text-text-primary">
              {engagement.companyName}
            </h3>
            <p className="text-xs text-text-muted">
              <span className="text-text-secondary">{engagement.name}</span>
              <span className="mx-1.5 text-text-disabled">·</span>
              Owner {engagement.owner}
              <span className="mx-1.5 text-text-disabled">·</span>
              Target {engagement.targetDate}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <EngagementStatusChip status={engagement.status} />
            <Badge tone="brand" variant="outline">
              Stage · {STAGE_LABEL[engagement.currentStage]}
            </Badge>
          </div>
        </div>

        {/* Stage tracker miniature */}
        <div className="flex flex-col gap-2">
          <div className="flex w-full items-center gap-1">
            {STAGES.map((stage, i) => {
              const isComplete = i < idx;
              const isCurrent = i === idx;
              return (
                <span
                  key={stage}
                  className={cn(
                    "h-1 flex-1 rounded-full",
                    isComplete && "bg-brand-primary/70",
                    isCurrent && "bg-brand-primary",
                    !isComplete && !isCurrent && "bg-white/[0.06]",
                  )}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-between text-[11px] text-text-muted">
            <span>
              <span className="uppercase tracking-[0.12em]">
                Setup
              </span>
              <span aria-hidden className="mx-1.5 text-text-disabled">
                →
              </span>
              <span className="uppercase tracking-[0.12em]">
                Proposal
              </span>
            </span>
            <span className="font-mono">
              Stage {idx + 1} of {STAGES.length}
            </span>
          </div>
        </div>

        {/* Status counts */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Cell
            label="Intake"
            value={`${engagement.intake.stakeholdersResponded}/${engagement.intake.stakeholdersInvited || engagement.intake.stakeholdersResponded || 0}`}
          />
          <Cell
            label="Documents"
            value={`${engagement.documents.received}/${engagement.documents.requested || engagement.documents.received || 0}`}
          />
          <Cell
            label="Findings"
            value={
              engagement.findings.candidate === 0
                ? "—"
                : `${engagement.findings.approved}/${engagement.findings.candidate}`
            }
          />
          <Cell
            label="Report"
            value={`${engagement.report.sectionsApproved}/${engagement.report.sectionsTotal}`}
          />
        </div>

        {/* Bottom: recommended action + meta */}
        <div className="flex flex-col gap-3 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0 text-xs">
            <span className="text-text-muted">Recommended: </span>
            <span className="font-medium text-text-secondary">
              {engagement.recommendedAction.headline}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[11px] text-text-muted">
            <span>Last activity {engagement.lastActivityAt}</span>
            <span aria-hidden className="text-text-disabled">
              ·
            </span>
            <span className="inline-flex items-center gap-1 text-text-secondary transition-colors group-hover:text-text-primary">
              Open engagement
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border-subtle bg-bg-elevated/50 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.12em] text-text-muted">
        {label}
      </div>
      <div className="font-mono text-sm font-semibold tabular-nums text-text-primary">
        {value}
      </div>
    </div>
  );
}

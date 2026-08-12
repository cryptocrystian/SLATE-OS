import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EngagementStatusChip } from "./engagement-status-chip";
import { STAGE_LABEL } from "@/lib/engagements/helpers";
import type { Engagement } from "@/lib/engagements/types";

export interface EngagementProfileHeaderProps {
  engagement: Engagement;
}

export function EngagementProfileHeader({
  engagement,
}: EngagementProfileHeaderProps) {
  return (
    <header className="flex flex-col gap-5 border-b border-border-subtle pb-6">
      <Link
        href="/app/engagements"
        className="inline-flex items-center gap-1.5 self-start text-xs text-text-muted transition-colors hover:text-text-primary"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to engagements
      </Link>

      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
        <div className="flex min-w-0 flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="ai">{engagement.engagementType}</Badge>
            <Badge tone="neutral">{engagement.industry}</Badge>
            <Badge tone="neutral">{engagement.practiceArea}</Badge>
            <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
              Owner · {engagement.owner}
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-[32px]">
            {engagement.companyName}
          </h1>
          <p className="text-sm text-text-secondary">
            <span className="font-medium text-text-primary">
              {engagement.name}
            </span>
          </p>
          <p className="flex items-center gap-2 text-xs text-text-muted">
            <Calendar aria-hidden className="h-3.5 w-3.5" />
            <span>Next milestone:</span>
            <span className="text-text-secondary">
              {engagement.nextMilestone}
            </span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <EngagementStatusChip status={engagement.status} />
          <Badge tone="brand" variant="outline">
            Stage · {STAGE_LABEL[engagement.currentStage]}
          </Badge>
        </div>
      </div>
    </header>
  );
}

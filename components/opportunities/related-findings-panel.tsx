import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, Sparkles } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { FindingStatusChip } from "@/components/findings/finding-status-chip";
import {
  CATEGORY_TONE,
} from "@/lib/findings/helpers";
import type { Finding } from "@/lib/findings/types";

const CATEGORY_TONE_MAP: Record<string, BadgeTone> = {
  info: "info",
  warning: "warning",
  neutral: "neutral",
  brand: "brand",
  ai: "ai",
  success: "success",
};

export interface RelatedFindingsPanelProps {
  engagementId: string;
  findings: Finding[];
}

export function RelatedFindingsPanel({
  engagementId,
  findings,
}: RelatedFindingsPanelProps) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-practice-ai">
              <Sparkles className="h-3.5 w-3.5" />
            </span>
            <h3 className="text-sm font-semibold tracking-tight text-text-primary">
              Related findings
            </h3>
          </div>
          <span className="font-mono text-[11px] tabular-nums text-text-muted">
            {findings.length}
          </span>
        </div>

        {findings.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-subtle bg-bg-surface/40 p-3 text-xs text-text-muted">
            No findings linked to this opportunity yet.
          </p>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {findings.map((f) => (
              <li
                key={f.id}
                className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-3"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge
                    tone={CATEGORY_TONE_MAP[CATEGORY_TONE[f.category]] ?? "neutral"}
                  >
                    {f.category}
                  </Badge>
                  <FindingStatusChip status={f.reviewStatus} />
                </div>
                <p className="text-xs leading-relaxed text-text-secondary">
                  {f.statement}
                </p>
                <div className="flex items-center justify-between text-[11px] text-text-muted">
                  <span className="font-mono tabular-nums">
                    {f.sourceRefs.length} source
                    {f.sourceRefs.length === 1 ? "" : "s"}
                  </span>
                  <Link
                    href={`/app/engagements/${engagementId}/findings`}
                    className="inline-flex items-center gap-1 text-text-secondary transition-colors hover:text-text-primary"
                  >
                    Open finding
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}

        <p className="border-t border-border-subtle pt-3 text-[11px] leading-relaxed text-text-muted">
          Every opportunity inherits its evidence from approved findings —
          source traceability stays intact through scoring and into the report.
        </p>
      </CardBody>
    </Card>
  );
}

import * as React from "react";
import {
  ClipboardList,
  FileText,
  MessageSquare,
  StickyNote,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { SOURCE_TYPE_LABEL } from "@/lib/findings/helpers";
import type { Finding, SourceRef, SourceRefType } from "@/lib/findings/types";

const ICON: Record<
  SourceRefType,
  React.ComponentType<{ className?: string }>
> = {
  "stakeholder-response": MessageSquare,
  "uploaded-document": FileText,
  "scorecard-answer": ClipboardList,
  "consultant-note": StickyNote,
};

const STRENGTH_TONE: Record<SourceRef["strength"], BadgeTone> = {
  strong: "success",
  adequate: "info",
  thin: "warning",
};

export interface EvidencePanelProps {
  finding: Finding | null;
}

export function EvidencePanel({ finding }: EvidencePanelProps) {
  return (
    <Card variant="base" className="h-full">
      <CardBody className="flex h-full flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Evidence
          </span>
          <h3 className="text-base font-semibold tracking-tight text-text-primary">
            Why this finding exists
          </h3>
        </div>

        {!finding ? (
          <p className="text-xs text-text-muted">
            Select a finding to see linked evidence.
          </p>
        ) : finding.sourceRefs.length === 0 ? (
          <p className="rounded-md border border-dashed border-border-subtle bg-bg-surface/40 p-3 text-xs text-text-muted">
            No evidence linked yet. Findings without evidence cannot move to
            report-ready.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {finding.sourceRefs.map((ref) => {
              const Icon = ICON[ref.type];
              return (
                <li
                  key={ref.id}
                  className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-elevated/40 p-3"
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={cn(
                        "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-secondary",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium text-text-primary">
                        {ref.source}
                      </span>
                      <span className="text-[11px] text-text-muted">
                        {SOURCE_TYPE_LABEL[ref.type]}
                        {ref.role ? (
                          <>
                            <span className="mx-1.5 text-text-disabled">·</span>
                            {ref.role}
                          </>
                        ) : null}
                      </span>
                    </div>
                    <Badge
                      tone={STRENGTH_TONE[ref.strength]}
                      variant="outline"
                      className="ml-auto"
                    >
                      {ref.strength}
                    </Badge>
                  </div>
                  <blockquote className="border-l-2 border-border-strong pl-3 text-xs italic leading-relaxed text-text-secondary">
                    {ref.excerpt}
                  </blockquote>
                </li>
              );
            })}
          </ul>
        )}

        {finding ? (
          <p className="border-t border-border-subtle pt-3 text-[11px] leading-relaxed text-text-muted">
            Source links below the report stay attached as the finding moves to
            scoring and into the audit report.
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

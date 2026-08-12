import * as React from "react";
import { FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ROLE_LABEL } from "@/lib/intake/helpers";
import type { SupportingInput } from "@/lib/intake/types";

const STATUS_TONE: Record<SupportingInput["status"], BadgeTone> = {
  requested: "info",
  received: "info",
  reviewed: "success",
  missing: "risk",
  outdated: "warning",
};

const STATUS_LABEL: Record<SupportingInput["status"], string> = {
  requested: "Requested",
  received: "Received",
  reviewed: "Reviewed",
  missing: "Missing",
  outdated: "Outdated",
};

const QUALITY_TONE: Record<SupportingInput["evidenceQuality"], BadgeTone> = {
  strong: "success",
  adequate: "info",
  thin: "warning",
  unverified: "neutral",
};

export interface SupportingInputsPanelProps {
  inputs: SupportingInput[];
}

export function SupportingInputsPanel({ inputs }: SupportingInputsPanelProps) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-col gap-1">
          <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Supporting inputs
          </span>
          <h2 className="text-base font-semibold tracking-tight text-text-primary">
            Documents and evidence
          </h2>
        </div>
        {inputs.length === 0 ? (
          <EmptyState
            icon={<FileText className="h-4 w-4" />}
            title="Document list opens with intake"
            description="Document requests will go out alongside the role-based intake. Received inputs will appear here once intake is open."
          />
        ) : (
          <ul className="flex flex-col gap-2.5">
            {inputs.map((input) => (
              <li
                key={input.id}
                className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-elevated/40 p-3"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-secondary">
                      <FileText className="h-3.5 w-3.5" />
                    </span>
                    <span className="text-sm font-medium text-text-primary">
                      {input.title}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={STATUS_TONE[input.status]} dot>
                      {STATUS_LABEL[input.status]}
                    </Badge>
                    <Badge tone={QUALITY_TONE[input.evidenceQuality]} variant="outline">
                      {input.evidenceQuality} evidence
                    </Badge>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-text-muted">
                  {input.summary}
                </p>
                <p className={cn("text-[11px] text-text-muted")}>
                  <span className="text-text-secondary">{input.source}</span>
                  {input.linkedRole ? (
                    <>
                      <span className="mx-1.5 text-text-disabled">·</span>
                      {ROLE_LABEL[input.linkedRole]}
                    </>
                  ) : null}
                </p>
              </li>
            ))}
          </ul>
        )}
      </CardBody>
    </Card>
  );
}

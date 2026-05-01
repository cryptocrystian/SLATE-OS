import * as React from "react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import {
  COVERAGE_LABEL,
  COVERAGE_TONE,
  ROLE_LABEL,
} from "@/lib/intake/helpers";
import type { RoleCoverageRow } from "@/lib/intake/types";

const TONE_MAP: Record<string, BadgeTone> = {
  success: "success",
  warning: "warning",
  risk: "risk",
};

export interface RoleCoverageMapProps {
  rows: RoleCoverageRow[];
}

export function RoleCoverageMap({ rows }: RoleCoverageMapProps) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Role coverage
            </span>
            <h2 className="text-base font-semibold tracking-tight text-text-primary">
              Discovery coverage by role
            </h2>
          </div>
          <Badge tone="brand" variant="outline">
            Required vs. optional
          </Badge>
        </div>
        <ul className="flex flex-col gap-2">
          {rows.map((row) => (
            <li
              key={row.role}
              className="flex flex-col gap-2 rounded-lg border border-border-subtle bg-bg-elevated/40 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <span className="text-sm font-medium text-text-primary">
                  {ROLE_LABEL[row.role]}
                </span>
                {row.required ? (
                  <Badge tone="neutral" variant="outline">
                    Required
                  </Badge>
                ) : (
                  <Badge tone="neutral">Optional</Badge>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] tabular-nums text-text-muted">
                  {row.stakeholderCount} stakeholder
                  {row.stakeholderCount === 1 ? "" : "s"}
                </span>
                <Badge tone={TONE_MAP[COVERAGE_TONE[row.status]] ?? "neutral"} dot>
                  {COVERAGE_LABEL[row.status]}
                </Badge>
              </div>
              <p className="basis-full pt-1 text-xs leading-relaxed text-text-muted sm:basis-auto sm:pt-0">
                {row.coverageNote}
              </p>
            </li>
          ))}
        </ul>
      </CardBody>
    </Card>
  );
}

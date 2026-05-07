import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { ExecutiveSummaryTwoByTwo } from "@/components/charts/exhibits/executive-summary-2x2";

export const metadata: Metadata = {
  title: "SLATE · Charts preview",
};

export const dynamic = "force-dynamic";

/**
 * Operator-only, unlinked preview surface for the SLATE chart vocabulary.
 *
 * Phase 1B proof-of-fit. Renders a single exhibit with static sample data
 * so the visual direction can be reviewed in a real Card layout without
 * touching the report or proposal builders.
 *
 * Not added to nav. Reachable only by direct URL.
 */
export default function ChartsPreviewPage() {
  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageHeader
        eyebrow="AdvisoryOps · Phase 1B preview"
        title="Charts preview."
        description="Operator-only proof-of-fit surface for the SLATE chart vocabulary. Unlinked from nav. Static sample data only — no persisted reads. Not wired into the report or proposal builders."
        meta={
          <>
            <Badge tone="ai" dot>
              Visx · proof of fit
            </Badge>
            <span className="text-text-muted">
              One exhibit. Visual direction review only.
            </span>
            <span className="text-text-disabled">·</span>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
              Phase 1B preview · not wired into reports
            </span>
          </>
        }
      />

      <ExecutiveSummaryTwoByTwo />

      <Card variant="base">
        <CardBody className="flex flex-col gap-2 p-5 sm:p-6">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Boundary reminder
          </span>
          <p className="text-xs leading-relaxed text-text-muted">
            This route is a Phase 1B proof-of-fit and is intentionally
            unlinked from the operator nav. Data shown above is static sample
            data declared inside the exhibit file. The remaining seven Phase
            1B exhibits ship in subsequent commits after the visual direction
            here is reviewed.
          </p>
        </CardBody>
      </Card>
    </div>
  );
}

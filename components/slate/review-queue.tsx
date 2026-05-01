import * as React from "react";
import {
  ClipboardList,
  Sparkles,
  FileSignature,
  UserCheck,
  ScrollText,
  ArrowRight,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardBody, CardFooter } from "@/components/ui/card";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { ReviewItem, ReviewItemKind } from "@/lib/mock-data";

const iconForKind: Record<ReviewItemKind, React.ComponentType<{ className?: string }>> = {
  scorecard: ClipboardList,
  finding: Sparkles,
  proposal: FileSignature,
  lead: UserCheck,
  report: ScrollText,
};

const labelForKind: Record<ReviewItemKind, string> = {
  scorecard: "Scorecard",
  finding: "Finding",
  proposal: "Proposal",
  lead: "Lead",
  report: "Report",
};

const toneForKind: Record<ReviewItemKind, BadgeTone> = {
  scorecard: "info",
  finding: "ai",
  proposal: "brand",
  lead: "success",
  report: "neutral",
};

const priorityTone: Record<ReviewItem["priority"], BadgeTone> = {
  high: "warning",
  medium: "info",
  low: "neutral",
};

const priorityLabel: Record<ReviewItem["priority"], string> = {
  high: "Needs Review",
  medium: "Ready for Review",
  low: "When Time Allows",
};

export interface ReviewQueueProps {
  items: ReviewItem[];
}

export function ReviewQueue({ items }: ReviewQueueProps) {
  return (
    <Card variant="base" className="flex h-full flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <CardTitle>Review Queue</CardTitle>
            <CardDescription>
              Items waiting on consultant judgment. AI drafts are clearly labeled and never final.
            </CardDescription>
          </div>
          <Badge tone="info" dot>
            {items.length} open
          </Badge>
        </div>
      </CardHeader>
      <CardBody className="pt-0">
        {items.length === 0 ? (
          <EmptyState
            title="Inbox is clear"
            description="Submitted scorecards, AI-drafted findings, and proposals awaiting approval will appear here."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border-subtle">
            {items.map((item) => {
              const Icon = iconForKind[item.kind];
              return (
                <li key={item.id} className="group py-3 first:pt-0 last:pb-0">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-secondary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={toneForKind[item.kind]}>
                          {labelForKind[item.kind]}
                        </Badge>
                        <Badge tone={priorityTone[item.priority]} dot>
                          {priorityLabel[item.priority]}
                        </Badge>
                        <span className="text-[11px] text-text-muted">
                          · {item.receivedAt}
                        </span>
                      </div>
                      <p className="text-sm font-medium leading-snug text-text-primary">
                        {item.title}
                      </p>
                      <p className="text-xs text-text-muted leading-relaxed">
                        <span className="text-text-secondary">{item.account}</span>{" "}
                        · {item.context}
                      </p>
                      <p className="text-xs leading-relaxed text-text-secondary">
                        <span className="font-medium text-text-primary">
                          Recommended:
                        </span>{" "}
                        {item.recommendedAction}
                      </p>
                    </div>
                    <button
                      type="button"
                      className="mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-text-muted transition-colors group-hover:bg-bg-elevated/80 group-hover:text-text-primary"
                      aria-label="Open item"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardBody>
      {items.length > 0 ? (
        <CardFooter>
          <Button variant="ghost" size="sm" trailingIcon={<ArrowRight className="h-3.5 w-3.5" />}>
            Open full review queue
          </Button>
        </CardFooter>
      ) : null}
    </Card>
  );
}

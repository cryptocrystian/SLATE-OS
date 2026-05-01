import * as React from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Briefcase,
  Building2,
  Clock,
  XCircle,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export interface LeadActionsPanelProps {
  /** If a seeded engagement already exists for this lead, link the
   *  "Start AI Opportunity Sprint" button to it. */
  engagementId?: string;
}

export function LeadActionsPanel({ engagementId }: LeadActionsPanelProps) {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Lead actions
          </span>
          <Badge tone="warning" variant="outline">
            {engagementId ? "Engagement linked" : "Mock — not wired"}
          </Badge>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <Button
            variant="secondary"
            size="md"
            leadingIcon={<Building2 className="h-4 w-4" />}
            className="justify-start"
          >
            Convert to Account
          </Button>
          {engagementId ? (
            <Link href={`/app/engagements/${engagementId}`}>
              <Button
                variant="primary"
                size="md"
                leadingIcon={<Briefcase className="h-4 w-4" />}
                trailingIcon={<ArrowUpRight className="h-4 w-4" />}
                className="w-full justify-start"
              >
                Open AI Opportunity Sprint
              </Button>
            </Link>
          ) : (
            <Button
              variant="secondary"
              size="md"
              leadingIcon={<Briefcase className="h-4 w-4" />}
              className="justify-start"
            >
              Start AI Opportunity Sprint
            </Button>
          )}
          <Button
            variant="ghost"
            size="md"
            leadingIcon={<Clock className="h-4 w-4" />}
            className="justify-start"
          >
            Move to Nurture
          </Button>
          <Button
            variant="ghost"
            size="md"
            leadingIcon={<XCircle className="h-4 w-4" />}
            className="justify-start text-status-risk hover:text-status-risk"
          >
            Disqualify
          </Button>
        </div>
        <p className="border-t border-border-subtle pt-3 text-[11px] leading-relaxed text-text-muted">
          {engagementId
            ? "“Start AI Opportunity Sprint” opens the seeded engagement workspace in this MVP. Real creation activates when persistence lands."
            : "Account creation, sprint kickoff, and status changes will activate once persistence is in place. Today these buttons are visual placeholders for the workflow."}
        </p>
      </CardBody>
    </Card>
  );
}

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
import { createOrOpenEngagementForLead } from "@/lib/engagements/actions";

export interface LeadActionsPanelProps {
  /** The current lead's UUID — used to bind the create/open server action. */
  leadId: string;
  /** When provided, an engagement already exists for this lead and the
   *  primary CTA reads "Open AI Opportunity Sprint" instead of "Start". */
  engagementId?: string;
}

export function LeadActionsPanel({
  leadId,
  engagementId,
}: LeadActionsPanelProps) {
  const startEngagement = createOrOpenEngagementForLead.bind(null, leadId);

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Lead actions
          </span>
          <Badge tone={engagementId ? "success" : "info"} variant="outline">
            {engagementId ? "Engagement linked" : "Ready to start"}
          </Badge>
        </div>
        <div className="flex flex-col gap-2 pt-1">
          <Button
            variant="secondary"
            size="md"
            leadingIcon={<Building2 className="h-4 w-4" />}
            className="justify-start"
            disabled
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
            <form action={startEngagement}>
              <Button
                type="submit"
                variant="primary"
                size="md"
                leadingIcon={<Briefcase className="h-4 w-4" />}
                trailingIcon={<ArrowUpRight className="h-4 w-4" />}
                className="w-full justify-start"
              >
                Start AI Opportunity Sprint
              </Button>
            </form>
          )}

          <Button
            variant="ghost"
            size="md"
            leadingIcon={<Clock className="h-4 w-4" />}
            className="justify-start"
            disabled
          >
            Move to Nurture
          </Button>
          <Button
            variant="ghost"
            size="md"
            leadingIcon={<XCircle className="h-4 w-4" />}
            className="justify-start text-status-risk hover:text-status-risk"
            disabled
          >
            Disqualify
          </Button>
        </div>
        <p className="border-t border-border-subtle pt-3 text-[11px] leading-relaxed text-text-muted">
          {engagementId
            ? "“Open AI Opportunity Sprint” jumps to the engagement workspace tied to this lead. Status changes (Convert to Account, Move to Nurture, Disqualify) activate as later steps land."
            : "“Start AI Opportunity Sprint” creates a real engagement workspace tied to this lead. Status changes (Convert to Account, Move to Nurture, Disqualify) activate as later steps land."}
        </p>
      </CardBody>
    </Card>
  );
}

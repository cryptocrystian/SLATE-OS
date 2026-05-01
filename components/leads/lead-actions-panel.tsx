import * as React from "react";
import {
  Briefcase,
  Building2,
  Clock,
  XCircle,
} from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export function LeadActionsPanel() {
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
            Lead actions
          </span>
          <Badge tone="warning" variant="outline">
            Mock — not wired
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
          <Button
            variant="secondary"
            size="md"
            leadingIcon={<Briefcase className="h-4 w-4" />}
            className="justify-start"
          >
            Start AI Opportunity Sprint
          </Button>
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
          Account creation, sprint kickoff, and status changes will activate
          once persistence is in place. Today these buttons are visual
          placeholders for the workflow.
        </p>
      </CardBody>
    </Card>
  );
}

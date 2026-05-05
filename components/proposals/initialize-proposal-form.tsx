"use client";

import * as React from "react";
import { ArrowRight, FileSignature } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardBody } from "@/components/ui/card";
import {
  initializeProposalForEngagement,
  type InitializeProposalResult,
} from "@/lib/proposals/actions";

export interface InitializeProposalFormProps {
  engagementId: string;
}

export function InitializeProposalForm({
  engagementId,
}: InitializeProposalFormProps) {
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      try {
        const result: InitializeProposalResult =
          await initializeProposalForEngagement(engagementId);
        if (!result.ok) setError(translateError(result.error));
      } catch {
        setError("Something went wrong. Please try again.");
      }
    });
  }

  return (
    <Card variant="elevated">
      <CardBody className="flex flex-col items-start gap-4 p-6 sm:p-8">
        <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-secondary">
          <FileSignature className="h-4 w-4" />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold tracking-tight text-text-primary">
            Initialize the proposal
          </h2>
          <p className="max-w-prose text-sm leading-relaxed text-text-muted">
            Seeds the three canonical SOW options — Quick-Win Build, AI
            Workflow System, and Managed AI Partner — pre-pointing the AI
            Workflow System tier as recommended. Implementation credit lands
            with the canonical commercial-lever copy. Pricing is placeholder
            until you validate scope.
          </p>
        </div>
        <Button
          type="button"
          variant="primary"
          size="md"
          trailingIcon={<ArrowRight className="h-4 w-4" />}
          disabled={pending}
          onClick={handleClick}
        >
          {pending ? "Initializing…" : "Initialize proposal"}
        </Button>
        {error ? (
          <p className="rounded-md border border-status-critical/40 bg-status-critical/10 p-2 text-[11px] text-status-critical">
            {error}
          </p>
        ) : null}
      </CardBody>
    </Card>
  );
}

function translateError(code: string): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "engagement-not-found":
      return "Engagement not found.";
    case "invalid-engagement":
      return "Invalid engagement reference.";
    default:
      return "We couldn't initialize the proposal. Please try again.";
  }
}

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, Hourglass } from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardBody } from "@/components/ui/card";
import { EngagementContextCard } from "./engagement-context-card";
import { EngagementRecommendedActionCard } from "./engagement-recommended-action-card";
import { recommendedActionRoute } from "@/lib/engagements/recommended-action";
import type { Engagement } from "@/lib/engagements/types";

export interface EngagementPersistencePlaceholderProps {
  engagement: Engagement;
  /** Eyebrow line — e.g. "AdvisoryOps · Intake". */
  eyebrow: string;
  /** Page title — e.g. "Stakeholder intake.". */
  title: string;
  /** Short description shown under the title. */
  description: string;
  /** Sprint label that activates this workspace. */
  activatesIn: string;
  /** Workspace path — used to detect self-reference on the recommended action card. */
  currentPath: string;
}

/**
 * Premium "this workspace activates in a future step" surface used by
 * downstream engagement sub-routes (`/intake`, `/findings`,
 * `/opportunities`, `/roadmap`, `/report`, `/proposal`) when the
 * engagement was created from a real lead in Step 4 but the underlying
 * deliverable persistence hasn't shipped yet.
 */
export function EngagementPersistencePlaceholder({
  engagement,
  eyebrow,
  title,
  description,
  activatesIn,
  currentPath,
}: EngagementPersistencePlaceholderProps) {
  const route = recommendedActionRoute(engagement, currentPath);

  return (
    <div className="flex flex-col gap-8 lg:gap-10">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        actions={
          <Link href={`/app/engagements/${engagement.id}`}>
            <Button
              variant="secondary"
              size="md"
              leadingIcon={<ArrowLeft className="h-4 w-4" />}
            >
              Back to engagement
            </Button>
          </Link>
        }
        meta={
          <>
            <Badge tone="ai" dot>
              {engagement.companyName} · {engagement.engagementType}
            </Badge>
            <span className="text-text-muted">
              Owner {engagement.owner} · Target {engagement.targetDate}
            </span>
            <span className="text-text-disabled">·</span>
            <span className="text-[11px] uppercase tracking-[0.14em]">
              {activatesIn}
            </span>
          </>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <Card variant="elevated">
            <CardBody className="flex flex-col items-start gap-4 p-6 sm:p-8">
              <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-secondary">
                <Hourglass className="h-4 w-4" />
              </span>
              <div className="flex flex-col gap-2">
                <h2 className="text-lg font-semibold tracking-tight text-text-primary">
                  Workspace ready · activates with {activatesIn}
                </h2>
                <p className="max-w-prose text-sm leading-relaxed text-text-muted">
                  This engagement was created from a real lead. This workspace
                  is being prepared — until it&apos;s ready, the surface stays
                  in a clean holding state.
                </p>
              </div>
              <Link href={`/app/engagements/${engagement.id}`}>
                <Button variant="secondary" size="sm">
                  Return to engagement command center
                </Button>
              </Link>
            </CardBody>
          </Card>
        </div>

        <aside className="flex flex-col gap-6">
          <EngagementRecommendedActionCard
            engagement={engagement}
            href={route.href}
            lockedNote={route.lockedNote}
            selfReference={route.selfReference}
          />
          <EngagementContextCard engagement={engagement} />
        </aside>
      </div>
    </div>
  );
}

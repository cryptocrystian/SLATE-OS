import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import { PublicAssessmentShell } from "@/components/scorecard/public-assessment-shell";
import { PublicIntakeForm } from "@/components/intake/public-intake-form";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { loadStakeholderSessionByToken } from "@/lib/intake/public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Stakeholder intake · SLATE",
  description: "Token-gated stakeholder intake for a SLATE engagement.",
  robots: { index: false, follow: false },
};

export default async function PublicIntakePage({
  params,
}: {
  params: { token: string };
}) {
  const lookup = await loadStakeholderSessionByToken(params.token);

  if (!lookup.ok) {
    return (
      <PublicAssessmentShell width="narrow">
        {lookup.reason === "expired" ? (
          <ExpiredState />
        ) : (
          <InvalidState />
        )}
      </PublicAssessmentShell>
    );
  }

  const { session } = lookup;
  const initialAnswers: Record<string, string> = {};
  for (const r of session.existingResponses) {
    initialAnswers[r.questionId] = r.answerText;
  }

  return (
    <PublicAssessmentShell width="narrow">
      <PublicIntakeForm
        rawToken={params.token}
        role={session.role}
        stakeholderName={session.stakeholderName}
        companyName={session.engagement.companyName}
        engagementName={session.engagement.engagementName}
        initialAnswers={initialAnswers}
        initiallyComplete={session.status === "completed"}
      />
    </PublicAssessmentShell>
  );
}

function ExpiredState() {
  return (
    <Card variant="elevated">
      <CardBody className="flex flex-col items-start gap-4 p-6 sm:p-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-md border border-status-warning/40 bg-status-warning/15 text-status-warning">
          <Clock className="h-5 w-5" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">
            This invite has expired.
          </h1>
          <p className="max-w-prose text-sm leading-relaxed text-text-secondary">
            Stakeholder intake links are time-limited. Reach out to your
            engagement contact at Saipien Labs and they&apos;ll send a fresh
            link.
          </p>
        </div>
        <Link href="/scorecard">
          <Button variant="secondary" size="sm">
            Back to SLATE
          </Button>
        </Link>
      </CardBody>
    </Card>
  );
}

function InvalidState() {
  return (
    <Card variant="elevated">
      <CardBody className="flex flex-col items-start gap-4 p-6 sm:p-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-md border border-status-critical/40 bg-status-critical/15 text-status-critical">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">
            This invite link is not active.
          </h1>
          <p className="max-w-prose text-sm leading-relaxed text-text-secondary">
            The link may have been revoked, mistyped, or already retired.
            Confirm the URL with the person who sent it, or reach out to
            your engagement contact at Saipien Labs.
          </p>
        </div>
        <Link href="/scorecard">
          <Button variant="secondary" size="sm">
            Back to SLATE
          </Button>
        </Link>
      </CardBody>
    </Card>
  );
}

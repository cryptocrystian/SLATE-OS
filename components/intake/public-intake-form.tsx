"use client";

import * as React from "react";
import { CheckCircle2, ShieldCheck } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { submitPublicIntake } from "@/app/intake/[token]/actions";
import { ROLE_LABEL } from "@/lib/intake/helpers";
import {
  INTAKE_QUESTIONS,
  rolePromptFor,
  type IntakeQuestion,
} from "@/lib/intake/seed-questions";
import type { StakeholderRole } from "@/lib/intake/types";

export interface PublicIntakeFormProps {
  rawToken: string;
  role: StakeholderRole;
  stakeholderName: string | null;
  companyName: string | null;
  engagementName: string | null;
  initialAnswers: Record<string, string>;
  initiallyComplete: boolean;
}

export function PublicIntakeForm(props: PublicIntakeFormProps) {
  const [answers, setAnswers] = React.useState<Record<string, string>>(
    () => seedAnswers(props.initialAnswers),
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [done, setDone] = React.useState(props.initiallyComplete);

  function handleChange(id: string, value: string) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const missingRequired = INTAKE_QUESTIONS.filter(
      (q) => q.required && !((answers[q.id] ?? "").trim()),
    );
    if (missingRequired.length > 0) {
      setError("Please answer the required questions before submitting.");
      return;
    }

    setPending(true);
    try {
      const payload = INTAKE_QUESTIONS.map((q) => ({
        questionId: q.id,
        questionLabel: q.label,
        answerText: answers[q.id] ?? "",
      }));
      const result = await submitPublicIntake({
        token: props.rawToken,
        answers: payload,
      });
      if (result.ok) {
        setDone(true);
      } else {
        setError(translateError(result.reason));
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  if (done) {
    return <CompletionState companyName={props.companyName} />;
  }

  return (
    <div className="flex flex-col gap-8">
      <Header
        role={props.role}
        stakeholderName={props.stakeholderName}
        companyName={props.companyName}
        engagementName={props.engagementName}
      />

      <form onSubmit={onSubmit} className="flex flex-col gap-5">
        {INTAKE_QUESTIONS.map((q, i) => (
          <QuestionField
            key={q.id}
            index={i + 1}
            question={q}
            value={answers[q.id] ?? ""}
            onChange={(v) => handleChange(q.id, v)}
          />
        ))}

        {error ? (
          <p className="rounded-md border border-status-critical/40 bg-status-critical/10 p-3 text-xs text-status-critical">
            {error}
          </p>
        ) : null}

        <div className="flex flex-col items-start gap-3 border-t border-border-subtle pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="flex items-center gap-2 text-[11px] text-text-muted">
            <ShieldCheck className="h-3.5 w-3.5 text-status-success" />
            Your responses go directly to the engagement team. SLATE
            never shares them publicly.
          </p>
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={pending}
          >
            {pending ? "Submitting…" : "Submit responses"}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Header({
  role,
  stakeholderName,
  companyName,
  engagementName,
}: {
  role: StakeholderRole;
  stakeholderName: string | null;
  companyName: string | null;
  engagementName: string | null;
}) {
  return (
    <div className="flex flex-col gap-3">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
        Stakeholder intake · {ROLE_LABEL[role]}
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
        {stakeholderName ? `Welcome, ${stakeholderName}.` : "Welcome."}
      </h1>
      <p className="max-w-prose text-sm leading-relaxed text-text-secondary">
        {companyName
          ? `Saipien Labs is helping ${companyName} identify the highest-value AI and automation opportunities.`
          : "Saipien Labs is identifying the highest-value AI and automation opportunities for your organization."}{" "}
        Your perspective shapes the recommendations. Take 10–15 minutes;
        depth is more useful than length.
      </p>
      <p className="text-xs leading-relaxed text-text-muted">
        {rolePromptFor(role)}
      </p>
      {engagementName ? (
        <Badge tone="ai" variant="outline" className="self-start">
          {engagementName}
        </Badge>
      ) : null}
    </div>
  );
}

function QuestionField({
  index,
  question,
  value,
  onChange,
}: {
  index: number;
  question: IntakeQuestion;
  value: string;
  onChange: (v: string) => void;
}) {
  const id = `intake-${question.id}`;
  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-3 p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="font-mono text-[11px] tabular-nums text-text-muted">
            {String(index).padStart(2, "0")}
          </span>
          <div className="flex flex-col gap-1">
            <label
              htmlFor={id}
              className="text-sm font-semibold tracking-tight text-text-primary"
            >
              {question.label}{" "}
              {question.required ? (
                <span className="text-status-critical">*</span>
              ) : null}
            </label>
            {question.helper ? (
              <p className="text-xs leading-relaxed text-text-muted">
                {question.helper}
              </p>
            ) : null}
          </div>
        </div>
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Type your answer here…"
          className="w-full rounded-md border border-border-subtle bg-bg-elevated/60 p-3 text-sm leading-relaxed text-text-primary outline-none transition-[border,box-shadow] placeholder:text-text-muted focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
        />
      </CardBody>
    </Card>
  );
}

function CompletionState({ companyName }: { companyName: string | null }) {
  return (
    <Card variant="elevated">
      <CardBody className="flex flex-col items-start gap-4 p-6 sm:p-8">
        <span className="flex h-10 w-10 items-center justify-center rounded-md border border-status-success/40 bg-status-success/15 text-status-success">
          <CheckCircle2 className="h-5 w-5" />
        </span>
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold tracking-tight text-text-primary">
            Thanks — your responses are in.
          </h2>
          <p className="max-w-prose text-sm leading-relaxed text-text-secondary">
            The engagement team at Saipien Labs will fold your perspective
            into the synthesis for{" "}
            {companyName ? (
              <span className="font-semibold text-text-primary">
                {companyName}
              </span>
            ) : (
              "your engagement"
            )}
            . You can close this tab.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

function seedAnswers(initial: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const q of INTAKE_QUESTIONS) {
    out[q.id] = initial[q.id] ?? "";
  }
  return out;
}

function translateError(reason: string): string {
  switch (reason) {
    case "no-answers":
      return "Please answer at least one question before submitting.";
    case "expired":
      return "This invite has expired. Reach out to your engagement contact for a new link.";
    case "not-found":
    case "invalid":
      return "This invite link is no longer valid.";
    case "service-error":
    default:
      return "We couldn't save your responses. Please try again.";
  }
}

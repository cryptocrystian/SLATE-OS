"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScorecardProgress } from "./scorecard-progress";
import { ScorecardQuestionCard } from "./scorecard-question-card";
import {
  loadScorecardState,
  saveScorecardState,
} from "@/lib/scorecard/storage";
import { questionsForSection } from "@/lib/scorecard/questions";
import {
  SECTIONS,
  type AnswerValue,
  type Answers,
  type Question,
} from "@/lib/scorecard/types";

function messageFor(status: number): string {
  if (status === 400)
    return "Some required fields didn't make it through. Please check the contact section and try again.";
  if (status === 503)
    return "SLATE submission is temporarily unavailable. Please try again in a moment.";
  return "Something went wrong submitting your scorecard. Please try again.";
}

function isAnswered(q: Question, value: AnswerValue | undefined) {
  if (q.optional) return true;
  if (value == null) return false;
  if (q.type === "multi") return Array.isArray(value) && value.length > 0;
  if (q.type === "scale") return typeof value === "number";
  if (q.type === "text") {
    if (typeof value !== "string") return false;
    if (q.inputKind === "email")
      return /.+@.+\..+/.test(value.trim());
    return value.trim().length > 0;
  }
  return typeof value === "string" && value.length > 0;
}

export function ScorecardStepper() {
  const router = useRouter();
  const [hydrated, setHydrated] = React.useState(false);
  const [sectionIdx, setSectionIdx] = React.useState(0);
  const [answers, setAnswers] = React.useState<Answers>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [showValidation, setShowValidation] = React.useState(false);

  React.useEffect(() => {
    const stored = loadScorecardState();
    if (stored) {
      setAnswers(stored.answers ?? {});
      setSectionIdx(
        Math.min(Math.max(stored.sectionIdx ?? 0, 0), SECTIONS.length - 1),
      );
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    saveScorecardState({ answers, sectionIdx });
  }, [answers, sectionIdx, hydrated]);

  const section = SECTIONS[sectionIdx];
  const questions = React.useMemo(
    () => questionsForSection(section.id),
    [section.id],
  );

  const allAnswered = React.useMemo(
    () => questions.every((q) => isAnswered(q, answers[q.id])),
    [questions, answers],
  );

  const isLast = sectionIdx === SECTIONS.length - 1;

  function setAnswer(id: string, value: AnswerValue) {
    setAnswers((prev) => ({ ...prev, [id]: value }));
    setShowValidation(false);
  }

  function back() {
    if (sectionIdx === 0) return;
    setSectionIdx(sectionIdx - 1);
    setShowValidation(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  function next() {
    if (!allAnswered) {
      setShowValidation(true);
      return;
    }
    if (isLast) {
      submit();
      return;
    }
    setSectionIdx(sectionIdx + 1);
    setShowValidation(false);
    if (typeof window !== "undefined") window.scrollTo({ top: 0 });
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError(null);
    // Keep local answers as a resume buffer regardless of API outcome.
    saveScorecardState({
      answers,
      sectionIdx,
      completedAt: new Date().toISOString(),
    });

    try {
      const resp = await fetch("/api/scorecard/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (!resp.ok) {
        setSubmitting(false);
        setSubmitError(messageFor(resp.status));
        return;
      }
      const data = (await resp.json()) as { submissionId?: string };
      if (!data?.submissionId) {
        setSubmitting(false);
        setSubmitError(
          "We received your scorecard but couldn't open the result. Please try again.",
        );
        return;
      }
      router.push(`/scorecard/results?submission_id=${data.submissionId}`);
    } catch {
      setSubmitting(false);
      setSubmitError(
        "Couldn't reach the SLATE server. Check your connection and try again.",
      );
    }
  }

  if (!hydrated) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <ScorecardProgress currentIdx={sectionIdx} />

      <header className="flex flex-col gap-3">
        <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
          {section.eyebrow}
        </span>
        <h1 className="text-balance text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
          {section.title}
        </h1>
        <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
          {section.intent}
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {questions.map((q, i) => (
          <ScorecardQuestionCard
            key={q.id}
            question={q}
            index={i}
            value={answers[q.id]}
            onChange={(v) => setAnswer(q.id, v)}
          />
        ))}
      </div>

      {showValidation && !allAnswered ? (
        <div
          role="alert"
          className="rounded-md border border-status-warning/40 bg-status-warning/10 px-4 py-3 text-xs text-status-warning"
        >
          Please answer every question in this section before continuing.
          Optional questions are marked.
        </div>
      ) : null}

      {submitError ? (
        <div
          role="alert"
          className="rounded-md border border-status-critical/40 bg-status-critical/10 px-4 py-3 text-xs leading-relaxed text-status-critical"
        >
          {submitError} Your answers are still saved on this device — you can
          retry without re-entering them.
        </div>
      ) : null}

      <footer className="flex flex-col-reverse gap-3 border-t border-border-subtle pt-6 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          {sectionIdx > 0 ? (
            <Button
              variant="ghost"
              size="md"
              leadingIcon={<ArrowLeft className="h-4 w-4" />}
              onClick={back}
            >
              Back
            </Button>
          ) : (
            <Link href="/scorecard">
              <Button
                variant="ghost"
                size="md"
                leadingIcon={<ArrowLeft className="h-4 w-4" />}
              >
                Back to overview
              </Button>
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[11px] text-text-muted">
            Progress is saved on this device
          </span>
          <Button
            variant="primary"
            size="md"
            leadingIcon={
              submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : undefined
            }
            trailingIcon={
              submitting ? null : <ArrowRight className="h-4 w-4" />
            }
            onClick={next}
            disabled={submitting}
          >
            {submitting
              ? "Submitting…"
              : isLast
                ? "See my result"
                : "Continue"}
          </Button>
        </div>
      </footer>
    </div>
  );
}

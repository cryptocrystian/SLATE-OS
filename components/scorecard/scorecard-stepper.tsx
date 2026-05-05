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

type ApiErrorCode =
  | "invalid-email"
  | "disposable-email"
  | "submission-too-fast"
  | "rate-limited"
  | "missing-fields"
  | "invalid-submission"
  | "service-not-configured"
  | "unknown";

const API_ERROR_COPY: Record<ApiErrorCode, string> = {
  "invalid-email":
    "Use a valid work email to see your result.",
  "disposable-email":
    "Use a real work email so we can keep the scorecard useful.",
  "submission-too-fast":
    "That was submitted too quickly. Please review your answers and try again.",
  "rate-limited":
    "Too many scorecard submissions were received from this email. Try again later.",
  "missing-fields":
    "Some required fields didn't make it through. Please check the contact section and try again.",
  "invalid-submission":
    "We couldn't accept that submission. Please review your answers and try again.",
  "service-not-configured":
    "SLATE submission is temporarily unavailable. Please try again in a moment.",
  unknown: "Something went wrong submitting your scorecard. Please try again.",
};

function classifyApiError(
  status: number,
  code: string | undefined,
): ApiErrorCode {
  switch (code) {
    case "invalid-email":
    case "disposable-email":
    case "submission-too-fast":
    case "rate-limited":
    case "missing-fields":
    case "invalid-submission":
    case "service-not-configured":
      return code;
    default:
      if (status === 503) return "service-not-configured";
      return "unknown";
  }
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
  // Honeypot — must stay empty for a real user. Hidden from the visual
  // surface and from assistive tech via aria-hidden + tabIndex=-1.
  const [honeypot, setHoneypot] = React.useState("");
  // Tracks when the user actually started filling out the scorecard.
  // Set on first hydration; mirrors into localStorage so a refresh
  // doesn't reset the "fast submit" trigger.
  const startedAtRef = React.useRef<string | null>(null);

  React.useEffect(() => {
    const stored = loadScorecardState();
    if (stored) {
      setAnswers(stored.answers ?? {});
      setSectionIdx(
        Math.min(Math.max(stored.sectionIdx ?? 0, 0), SECTIONS.length - 1),
      );
      if (stored.startedAt) {
        startedAtRef.current = stored.startedAt;
      }
    }
    if (!startedAtRef.current) {
      startedAtRef.current = new Date().toISOString();
      saveScorecardState({
        answers: stored?.answers ?? {},
        sectionIdx: stored?.sectionIdx ?? 0,
        startedAt: startedAtRef.current,
      });
    }
    setHydrated(true);
  }, []);

  React.useEffect(() => {
    if (!hydrated) return;
    saveScorecardState({
      answers,
      sectionIdx,
      startedAt: startedAtRef.current ?? undefined,
    });
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
    const completedAtIso = new Date().toISOString();
    const startedAtIso = startedAtRef.current ?? completedAtIso;
    const submissionDurationMs = Math.max(
      0,
      new Date(completedAtIso).getTime() - new Date(startedAtIso).getTime(),
    );

    saveScorecardState({
      answers,
      sectionIdx,
      startedAt: startedAtIso,
      completedAt: completedAtIso,
    });

    const clientMeta: Record<string, string> = {
      startedAtIso,
      completedAtIso,
      submissionDurationMs: String(submissionDurationMs),
    };
    if (typeof window !== "undefined") {
      try {
        clientMeta.locale = navigator.language;
        clientMeta.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      } catch {
        /* non-fatal */
      }
    }

    try {
      const resp = await fetch("/api/scorecard/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ answers, clientMeta, honeypot }),
      });
      if (!resp.ok) {
        let code: string | undefined;
        try {
          const body = (await resp.json()) as { error?: string };
          code = body?.error;
        } catch {
          /* JSON failure — fall through to status-based copy */
        }
        const tag = classifyApiError(resp.status, code);
        setSubmitting(false);
        setSubmitError(API_ERROR_COPY[tag]);
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

      {/* Honeypot — visually and assistively hidden, but still in the DOM.
          Real users never interact with this field; bots filling every
          input land here and get rejected by the server. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-[9999px] top-auto h-px w-px overflow-hidden opacity-0"
      >
        <label htmlFor="slate-website-confirm">Website (do not fill)</label>
        <input
          id="slate-website-confirm"
          name="website"
          type="text"
          autoComplete="off"
          tabIndex={-1}
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
        />
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

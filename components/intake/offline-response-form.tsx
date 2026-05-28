"use client";

import * as React from "react";
import { AlertTriangle, Save } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { INTAKE_QUESTIONS } from "@/lib/intake/seed-questions";
import { createOfflineStakeholderResponseAction } from "@/lib/intake/offline-actions";
import type {
  CreateOfflineResponseResult,
  IntakeSourceType,
} from "@/lib/intake/types";

/**
 * Sprint I3 — Offline Response Form.
 *
 * Captures a single offline-staged response against a stakeholder
 * session. Defaults to draft per docs/37 § 4 — operator must
 * separately mark each response ready for synthesis before findings
 * synthesis consumes it.
 *
 * Includes a lightweight PII-warning that fires when the pasted answer
 * matches simple regex patterns (email, SSN-shaped, phone numbers).
 * The warning is inline and non-blocking — it nudges the operator to
 * scrub identifying detail before storing it in the engagement.
 */

const OFFLINE_SOURCE_OPTIONS: Array<{
  value: Exclude<IntakeSourceType, "live_link">;
  label: string;
}> = [
  { value: "operator_entered", label: "Operator-entered" },
  { value: "meeting_notes", label: "Meeting notes" },
  { value: "transcript", label: "Transcript" },
  { value: "email_paste", label: "Email paste" },
  { value: "document_upload", label: "Document upload" },
];

const PII_PATTERNS: Array<{ id: string; label: string; pattern: RegExp }> = [
  {
    id: "email",
    label: "an email address",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/,
  },
  {
    id: "ssn",
    label: "a number shaped like an SSN",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/,
  },
  {
    id: "phone",
    label: "a phone number",
    // Loose: covers US-style and international-style separators.
    pattern: /\b(?:\+?\d{1,3}[ .-]?)?\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}\b/,
  },
  {
    id: "card",
    label: "what looks like a credit-card number",
    pattern: /\b(?:\d[ -]?){13,16}\b/,
  },
];

function detectPii(text: string): string[] {
  const hits: string[] = [];
  for (const p of PII_PATTERNS) {
    if (p.pattern.test(text)) hits.push(p.label);
  }
  return hits;
}

export interface OfflineResponseFormProps {
  sessionId: string;
  /** Default source type for the parent stakeholder. */
  defaultSourceType: Exclude<IntakeSourceType, "live_link">;
  /** Optional supersedes target — passing this flips the prior to 'superseded'. */
  supersedesResponseId?: string;
  /** Optional preset question (when answering a specific seed question). */
  defaultQuestionId?: string;
  /** Optional callback after successful submit (e.g., to close inline drawer). */
  onSubmitted?: () => void;
}

export function OfflineResponseForm({
  sessionId,
  defaultSourceType,
  supersedesResponseId,
  defaultQuestionId,
  onSubmitted,
}: OfflineResponseFormProps) {
  const [questionId, setQuestionId] = React.useState(
    defaultQuestionId ?? INTAKE_QUESTIONS[0]?.id ?? "",
  );
  const [customLabel, setCustomLabel] = React.useState("");
  const [answerText, setAnswerText] = React.useState("");
  const [sourceType, setSourceType] =
    React.useState<Exclude<IntakeSourceType, "live_link">>(defaultSourceType);
  const [operatorNotes, setOperatorNotes] = React.useState("");
  const [collectedAt, setCollectedAt] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState<string | null>(null);

  const isCustomQuestion = questionId === "__custom__";
  const piiHits = React.useMemo(() => detectPii(answerText), [answerText]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setPending(true);
    try {
      const seedQuestion = INTAKE_QUESTIONS.find((q) => q.id === questionId);
      const effectiveQuestionId = isCustomQuestion
        ? customLabel.trim().toLowerCase().replace(/\s+/g, "_").slice(0, 80) ||
          "custom_question"
        : questionId;
      const effectiveQuestionLabel = isCustomQuestion
        ? customLabel.trim() || undefined
        : seedQuestion?.label;

      const result: CreateOfflineResponseResult =
        await createOfflineStakeholderResponseAction({
          sessionId,
          questionId: effectiveQuestionId,
          questionLabel: effectiveQuestionLabel,
          answerText,
          sourceType,
          collectedAt: collectedAt || undefined,
          operatorNotes: operatorNotes || undefined,
          supersedesResponseId,
        });
      if (result.ok) {
        setSuccess("Response saved as draft. Mark ready when you're confident.");
        setAnswerText("");
        setOperatorNotes("");
        setCollectedAt("");
        onSubmitted?.();
      } else {
        setError(translateError(result.error));
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="flex flex-col gap-3 rounded-md border border-border-subtle bg-bg-elevated/40 p-4"
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone="warning" variant="outline">
          Saves as draft
        </Badge>
        <span className="text-[11px] text-text-muted">
          Drafts are operator-only until you mark them ready for synthesis.
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label
            htmlFor={`offline-response-q-${sessionId}`}
            className="text-xs font-medium tracking-tight text-text-secondary"
          >
            Question
          </label>
          <select
            id={`offline-response-q-${sessionId}`}
            value={questionId}
            onChange={(e) => setQuestionId(e.target.value)}
            className="h-10 w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-3 text-sm text-text-primary outline-none transition-[border,box-shadow] focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
          >
            {INTAKE_QUESTIONS.map((q) => (
              <option key={q.id} value={q.id}>
                {q.label}
              </option>
            ))}
            <option value="__custom__">Custom question…</option>
          </select>
        </div>

        {isCustomQuestion ? (
          <Input
            label="Custom question label"
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="Where does sales-to-ops handoff drop info?"
            autoComplete="off"
            required={isCustomQuestion}
            className="sm:col-span-2"
            hint="Free-text. Will be normalized into a question key on save."
          />
        ) : null}

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label
            htmlFor={`offline-response-text-${sessionId}`}
            className="text-xs font-medium tracking-tight text-text-secondary"
          >
            Response text
          </label>
          <textarea
            id={`offline-response-text-${sessionId}`}
            value={answerText}
            onChange={(e) => setAnswerText(e.target.value)}
            rows={6}
            maxLength={20_000}
            required
            placeholder="Paste the meeting notes, transcript excerpt, or operator-typed answer here."
            className="w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none transition-[border,box-shadow] focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
          />
          <p className="text-[11px] leading-relaxed text-text-muted">
            {answerText.length}/20,000
          </p>
        </div>

        {piiHits.length > 0 ? (
          <div
            role="alert"
            className="flex items-start gap-2 rounded-md border border-status-warning/40 bg-status-warning/10 p-3 text-xs text-text-secondary sm:col-span-2"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-status-warning" />
            <span className="leading-relaxed">
              <span className="font-medium text-status-warning">
                Possible PII detected.
              </span>{" "}
              The response text appears to contain {piiHits.join(", ")}.
              Consider scrubbing this before saving — once stored, it lives in
              the engagement&apos;s audit trail. Synthesis does not need names
              or contact details to do its job.
            </span>
          </div>
        ) : null}

        <div className="flex flex-col gap-1.5">
          <label
            htmlFor={`offline-response-source-${sessionId}`}
            className="text-xs font-medium tracking-tight text-text-secondary"
          >
            Source type
          </label>
          <select
            id={`offline-response-source-${sessionId}`}
            value={sourceType}
            onChange={(e) =>
              setSourceType(
                e.target.value as Exclude<IntakeSourceType, "live_link">,
              )
            }
            className="h-10 w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-3 text-sm text-text-primary outline-none transition-[border,box-shadow] focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
          >
            {OFFLINE_SOURCE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <Input
          label="Collected at (optional)"
          type="date"
          value={collectedAt}
          onChange={(e) => setCollectedAt(e.target.value)}
          autoComplete="off"
          hint="When was this content originally captured?"
        />

        <div className="flex flex-col gap-1.5 sm:col-span-2">
          <label
            htmlFor={`offline-response-notes-${sessionId}`}
            className="text-xs font-medium tracking-tight text-text-secondary"
          >
            Operator notes (optional, 1000 chars max)
          </label>
          <textarea
            id={`offline-response-notes-${sessionId}`}
            value={operatorNotes}
            onChange={(e) => setOperatorNotes(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder="Audit context only — not shown to the client."
            className="w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none transition-[border,box-shadow] focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
          />
          <p className="text-[11px] leading-relaxed text-text-muted">
            {operatorNotes.length}/1000
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] text-text-muted">
          {supersedesResponseId
            ? "Saving will mark the prior response superseded when this one is ready."
            : "Draft only — does not feed synthesis until marked ready."}
        </p>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          leadingIcon={<Save className="h-3.5 w-3.5" />}
          disabled={pending || !answerText.trim()}
        >
          {pending ? "Saving draft…" : "Save draft"}
        </Button>
      </div>

      {error ? (
        <p className="rounded-md border border-status-critical/40 bg-status-critical/10 p-3 text-xs text-status-critical">
          {error}
        </p>
      ) : null}
      {success ? (
        <p className="rounded-md border border-status-success/40 bg-status-success/10 p-3 text-xs text-status-success">
          {success}
        </p>
      ) : null}
    </form>
  );
}

type OfflineResponseFailure = Exclude<
  CreateOfflineResponseResult,
  { ok: true }
>["error"];

function translateError(code: OfflineResponseFailure): string {
  switch (code) {
    case "unauthenticated":
      return "Your session expired. Sign in again to save offline responses.";
    case "invalid-session":
    case "session-not-found":
      return "This stakeholder session could not be found.";
    case "session-mode-mismatch":
      return "This is a live-link session. Offline responses must target an offline stakeholder.";
    case "invalid-response":
    case "response-not-found":
      return "The supersedes target response is not valid.";
    case "response-already-voided":
      return "The prior response has already been voided.";
    case "invalid-source-type":
      return "Pick a valid offline source type.";
    case "missing-fields":
      return "Question and response text are required.";
    case "field-too-long":
      return "Response text or notes exceeded the maximum length.";
    case "service-error":
    default:
      return "We couldn't save this response. Please try again.";
  }
}

"use client";

import * as React from "react";
import { Plus, Sparkles } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  CONFIDENCE_LABEL,
  FINDING_CATEGORIES,
} from "@/lib/findings/helpers";
import { createManualFinding } from "@/lib/findings/actions";
import type {
  FindingCategory,
  FindingConfidence,
  SourceRefType,
} from "@/lib/findings/types";

export interface EvidenceCandidateOption {
  id: string;
  type: "stakeholder-response" | "input-asset";
  label: string;
  sublabel?: string;
  excerpt: string;
}

export interface CreateFindingFormProps {
  engagementId: string;
  candidates: EvidenceCandidateOption[];
}

const CONFIDENCE_OPTIONS: FindingConfidence[] = [
  "needs-evidence",
  "low",
  "medium",
  "high",
];

export function CreateFindingForm({
  engagementId,
  candidates,
}: CreateFindingFormProps) {
  const [open, setOpen] = React.useState(false);
  const [category, setCategory] = React.useState<FindingCategory>(
    "Workflow Friction",
  );
  const [statement, setStatement] = React.useState("");
  const [summary, setSummary] = React.useState("");
  const [evidenceSummary, setEvidenceSummary] = React.useState("");
  const [confidence, setConfidence] =
    React.useState<FindingConfidence>("medium");
  const [suggestedImpact, setSuggestedImpact] = React.useState("");
  const [assumptionFlag, setAssumptionFlag] = React.useState(false);
  const [assumptionNote, setAssumptionNote] = React.useState("");
  const [reviewerNote, setReviewerNote] = React.useState("");
  const [selectedCandidates, setSelectedCandidates] = React.useState<
    Set<string>
  >(new Set());
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  function reset() {
    setStatement("");
    setSummary("");
    setEvidenceSummary("");
    setConfidence("medium");
    setSuggestedImpact("");
    setAssumptionFlag(false);
    setAssumptionNote("");
    setReviewerNote("");
    setSelectedCandidates(new Set());
    setError(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!statement.trim()) {
      setError("A statement is required.");
      return;
    }
    setPending(true);
    try {
      const sourceRefs = Array.from(selectedCandidates)
        .map((id) => candidates.find((c) => c.id === id))
        .filter((c): c is EvidenceCandidateOption => Boolean(c))
        .map((c) => ({
          type: candidateToRefType(c.type),
          sourceId: c.id,
          sourceLabel: c.label,
          sourceRole: c.sublabel,
          excerpt: c.excerpt,
          strength: "adequate" as const,
        }));
      const result = await createManualFinding({
        engagementId,
        category,
        statement: statement.trim(),
        summary,
        evidenceSummary,
        confidence,
        suggestedImpact,
        assumptionFlag,
        assumptionNote,
        reviewerNote,
        sourceRefs,
      });
      if (result.ok) {
        setSuccess(true);
        reset();
        // Stay open so an operator can quickly add a follow-on finding;
        // revalidatePath in the action will refresh the list above.
      } else {
        setError(translateError(result.error));
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  function toggleCandidate(id: string) {
    setSelectedCandidates((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Manual finding
            </span>
            <h2 className="text-base font-semibold tracking-tight text-text-primary">
              Capture a finding from intake evidence
            </h2>
            <p className="text-xs leading-relaxed text-text-muted">
              Operator-authored findings sit alongside future AI-drafted ones
              and follow the same review flow. AI synthesis activates in a
              later sprint.
            </p>
          </div>
          <Button
            type="button"
            variant={open ? "secondary" : "primary"}
            size="sm"
            leadingIcon={<Plus className="h-4 w-4" />}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close form" : "Add manual finding"}
          </Button>
        </div>

        {open ? (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="finding-category"
                  className="text-xs font-medium tracking-tight text-text-secondary"
                >
                  Category
                </label>
                <select
                  id="finding-category"
                  value={category}
                  onChange={(e) =>
                    setCategory(e.target.value as FindingCategory)
                  }
                  className="h-10 w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-3 text-sm text-text-primary outline-none transition-[border,box-shadow] focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                >
                  {FINDING_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-col gap-1.5">
                <label
                  htmlFor="finding-confidence"
                  className="text-xs font-medium tracking-tight text-text-secondary"
                >
                  Confidence
                </label>
                <select
                  id="finding-confidence"
                  value={confidence}
                  onChange={(e) =>
                    setConfidence(e.target.value as FindingConfidence)
                  }
                  className="h-10 w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-3 text-sm text-text-primary outline-none transition-[border,box-shadow] focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                >
                  {CONFIDENCE_OPTIONS.map((c) => (
                    <option key={c} value={c}>
                      {CONFIDENCE_LABEL[c]}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <Input
              label="Statement"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="One-sentence finding headline."
              required
              autoComplete="off"
            />

            <FieldTextarea
              label="Summary"
              id="finding-summary"
              rows={3}
              value={summary}
              onChange={setSummary}
              placeholder="What did stakeholders say or what did the evidence show?"
            />

            <FieldTextarea
              label="Evidence summary"
              id="finding-evidence"
              rows={2}
              value={evidenceSummary}
              onChange={setEvidenceSummary}
              placeholder="Compressed reading of the underlying evidence."
            />

            <FieldTextarea
              label="Suggested impact"
              id="finding-impact"
              rows={2}
              value={suggestedImpact}
              onChange={setSuggestedImpact}
              placeholder="Quick-Win Build, Strategic Build, governance constraint, etc."
            />

            <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
              <label className="flex items-center gap-2 text-xs font-medium text-text-secondary">
                <input
                  type="checkbox"
                  checked={assumptionFlag}
                  onChange={(e) => setAssumptionFlag(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-border-subtle bg-bg-elevated"
                />
                Flag as assumption
              </label>
              {assumptionFlag ? (
                <FieldTextarea
                  label="Assumption note"
                  id="finding-assumption-note"
                  rows={2}
                  value={assumptionNote}
                  onChange={setAssumptionNote}
                  placeholder="What still needs validation before this finding moves into the report?"
                />
              ) : null}
            </div>

            <FieldTextarea
              label="Reviewer note (optional)"
              id="finding-reviewer-note"
              rows={2}
              value={reviewerNote}
              onChange={setReviewerNote}
              placeholder="Operator-only context. Never shown to public principals."
            />

            <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                  Link evidence
                </span>
                <Badge tone="ai" variant="outline">
                  <Sparkles className="mr-1 h-3 w-3" />
                  Optional
                </Badge>
              </div>
              {candidates.length === 0 ? (
                <p className="text-[11px] leading-relaxed text-text-muted">
                  No intake responses or input assets yet. Capture intake
                  responses in the intake workspace to link them here.
                </p>
              ) : (
                <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
                  {candidates.map((c) => {
                    const checked = selectedCandidates.has(c.id);
                    return (
                      <li key={c.id}>
                        <label className="flex items-start gap-2 rounded-md border border-border-subtle bg-bg-page/40 p-2 text-xs">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleCandidate(c.id)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-border-subtle bg-bg-elevated"
                          />
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-text-primary">
                              {c.label}
                            </span>
                            {c.sublabel ? (
                              <span className="text-[11px] text-text-muted">
                                {c.sublabel}
                              </span>
                            ) : null}
                            {c.excerpt ? (
                              <span className="text-[11px] leading-relaxed text-text-secondary">
                                “{truncate(c.excerpt, 200)}”
                              </span>
                            ) : null}
                          </div>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>

            {error ? (
              <p className="rounded-md border border-status-critical/40 bg-status-critical/10 p-3 text-xs text-status-critical">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="rounded-md border border-status-success/40 bg-status-success/10 p-3 text-xs text-status-success">
                Finding added. Add another or close the form.
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-text-muted">
                Manual findings start in <span className="font-medium">Needs Review</span>.
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    reset();
                    setSuccess(false);
                  }}
                  disabled={pending}
                >
                  Reset
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={pending}
                >
                  {pending ? "Saving…" : "Save finding"}
                </Button>
              </div>
            </div>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}

function FieldTextarea({
  id,
  label,
  rows,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  rows: number;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-xs font-medium tracking-tight text-text-secondary"
      >
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        maxLength={4000}
        className="w-full rounded-md border border-border-subtle bg-bg-elevated/60 p-3 text-sm leading-relaxed text-text-primary outline-none transition-[border,box-shadow] placeholder:text-text-muted focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
      />
    </div>
  );
}

function candidateToRefType(
  type: EvidenceCandidateOption["type"],
): SourceRefType {
  switch (type) {
    case "stakeholder-response":
      return "stakeholder-response";
    case "input-asset":
      return "uploaded-document";
    default:
      return "consultant-note";
  }
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1)}…`;
}

function translateError(
  code:
    | "unauthenticated"
    | "invalid-engagement"
    | "invalid-finding"
    | "missing-fields"
    | "invalid-category"
    | "invalid-confidence"
    | "engagement-not-found"
    | "finding-not-found"
    | "service-error"
    // Sprint S5 — added to FindingActionResult; createManualFinding
    // does not return it but the shared union now includes it.
    | "rejection-reason-invalid",
): string {
  switch (code) {
    case "missing-fields":
      return "Statement is required.";
    case "invalid-category":
      return "Pick a valid finding category.";
    case "invalid-confidence":
      return "Pick a valid confidence value.";
    case "engagement-not-found":
    case "invalid-engagement":
      return "This engagement could not be found. Refresh the page and try again.";
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "rejection-reason-invalid":
      return "Rejection reason must be between 10 and 500 characters, or empty.";
    case "service-error":
    default:
      return "We couldn't save the finding. Please try again.";
  }
}

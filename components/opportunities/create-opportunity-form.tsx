"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createOpportunity } from "@/lib/opportunities/actions";
import { EVIDENCE_LABEL } from "@/lib/opportunities/helpers";
import type {
  EvidenceStrength,
  OpportunityCategory,
} from "@/lib/opportunities/types";

const CATEGORIES: OpportunityCategory[] = [
  "Sales / Revenue Operations",
  "Client Intake / Onboarding",
  "Proposal / Document Generation",
  "Customer Support / Triage",
  "Internal Knowledge / Retrieval",
  "Reporting / Analytics",
  "Back-office Automation",
  "Systems Integration",
  "Governance / Risk Controls",
];

const EVIDENCE_OPTIONS: EvidenceStrength[] = ["thin", "adequate", "strong"];

export interface FindingCandidateOption {
  id: string;
  statement: string;
  category: string;
  reviewStatus: string;
  evidenceStrength: "strong" | "adequate" | "thin";
}

export interface CreateOpportunityFormProps {
  engagementId: string;
  findingCandidates: FindingCandidateOption[];
}

export function CreateOpportunityForm({
  engagementId,
  findingCandidates,
}: CreateOpportunityFormProps) {
  const [open, setOpen] = React.useState(false);
  const [title, setTitle] = React.useState("");
  const [category, setCategory] = React.useState<OpportunityCategory>(
    "Back-office Automation",
  );
  const [description, setDescription] = React.useState("");
  const [businessImpact, setBusinessImpact] = React.useState(70);
  const [complexity, setComplexity] = React.useState(40);
  const [risk, setRisk] = React.useState(40);
  const [timeToValue, setTimeToValue] = React.useState(60);
  const [adoption, setAdoption] = React.useState(60);
  const [strategic, setStrategic] = React.useState(50);
  const [evidence, setEvidence] = React.useState<EvidenceStrength>("adequate");
  const [sourceSummary, setSourceSummary] = React.useState("");
  const [recommendedAction, setRecommendedAction] = React.useState("");
  const [implementationShape, setImplementationShape] = React.useState("");
  const [dependencies, setDependencies] = React.useState("");
  const [risks, setRisks] = React.useState("");
  const [successSignals, setSuccessSignals] = React.useState("");
  const [selectedFindings, setSelectedFindings] = React.useState<Set<string>>(
    new Set(),
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  function reset() {
    setTitle("");
    setDescription("");
    setBusinessImpact(70);
    setComplexity(40);
    setRisk(40);
    setTimeToValue(60);
    setAdoption(60);
    setStrategic(50);
    setEvidence("adequate");
    setSourceSummary("");
    setRecommendedAction("");
    setImplementationShape("");
    setDependencies("");
    setRisks("");
    setSuccessSignals("");
    setSelectedFindings(new Set());
    setError(null);
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    if (!title.trim()) {
      setError("Title is required.");
      return;
    }
    setPending(true);
    try {
      const result = await createOpportunity({
        engagementId,
        title: title.trim(),
        category,
        description,
        businessImpactScore: businessImpact,
        complexityScore: complexity,
        riskScore: risk,
        timeToValueScore: timeToValue,
        adoptionLikelihoodScore: adoption,
        strategicValueScore: strategic,
        evidenceStrength: evidence,
        sourceSummary,
        recommendedAction,
        implementationShape,
        dependencies: splitLines(dependencies),
        risks: splitLines(risks),
        successSignals: splitLines(successSignals),
        findingIds: Array.from(selectedFindings),
      });
      if (result.ok) {
        setSuccess(true);
        reset();
      } else {
        setError(translateError(result.error));
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setPending(false);
    }
  }

  function toggleFinding(id: string) {
    setSelectedFindings((prev) => {
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
              Score an opportunity
            </span>
            <h2 className="text-base font-semibold tracking-tight text-text-primary">
              Promote a finding into a scored opportunity
            </h2>
            <p className="text-xs leading-relaxed text-text-muted">
              Quadrant placement is computed from impact + complexity + risk.
              All scores are 0–100 directional.
            </p>
          </div>
          <Button
            type="button"
            variant={open ? "secondary" : "primary"}
            size="sm"
            leadingIcon={<Plus className="h-4 w-4" />}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close form" : "Create opportunity"}
          </Button>
        </div>

        {open ? (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. AI-assisted reconciliation"
                required
                autoComplete="off"
              />
              <Select
                id="opportunity-category"
                label="Category"
                value={category}
                onChange={(v) => setCategory(v as OpportunityCategory)}
                options={CATEGORIES.map((c) => ({ value: c, label: c }))}
              />
            </div>

            <Textarea
              id="opportunity-description"
              label="Description"
              rows={3}
              value={description}
              onChange={setDescription}
              placeholder="What is the opportunity, and why does it matter for this engagement?"
            />

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <ScoreField
                id="impact"
                label="Business impact"
                value={businessImpact}
                onChange={setBusinessImpact}
              />
              <ScoreField
                id="complexity"
                label="Complexity"
                value={complexity}
                onChange={setComplexity}
              />
              <ScoreField
                id="risk"
                label="Risk"
                value={risk}
                onChange={setRisk}
              />
              <ScoreField
                id="ttv"
                label="Time to value"
                value={timeToValue}
                onChange={setTimeToValue}
              />
              <ScoreField
                id="adoption"
                label="Adoption likelihood"
                value={adoption}
                onChange={setAdoption}
              />
              <ScoreField
                id="strategic"
                label="Strategic value"
                value={strategic}
                onChange={setStrategic}
              />
            </div>

            <Select
              id="opportunity-evidence"
              label="Evidence strength"
              value={evidence}
              onChange={(v) => setEvidence(v as EvidenceStrength)}
              options={EVIDENCE_OPTIONS.map((e) => ({
                value: e,
                label: EVIDENCE_LABEL[e],
              }))}
            />

            <Textarea
              id="opportunity-source"
              label="Source summary"
              rows={2}
              value={sourceSummary}
              onChange={setSourceSummary}
              placeholder="Where does this opportunity come from? Which stakeholder responses or evidence support it?"
            />
            <Textarea
              id="opportunity-recommended"
              label="Recommended action"
              rows={2}
              value={recommendedAction}
              onChange={setRecommendedAction}
              placeholder="What should the engagement do next on this opportunity?"
            />
            <Textarea
              id="opportunity-implementation"
              label="Implementation shape"
              rows={2}
              value={implementationShape}
              onChange={setImplementationShape}
              placeholder="What does building this look like at a high level?"
            />

            <Textarea
              id="opportunity-dependencies"
              label="Dependencies (one per line)"
              rows={2}
              value={dependencies}
              onChange={setDependencies}
              placeholder="Stakeholder availability, system access, etc."
            />
            <Textarea
              id="opportunity-risks"
              label="Risks (one per line)"
              rows={2}
              value={risks}
              onChange={setRisks}
              placeholder="What could derail this?"
            />
            <Textarea
              id="opportunity-success"
              label="Success signals (one per line)"
              rows={2}
              value={successSignals}
              onChange={setSuccessSignals}
              placeholder="What does success look like in 90 days?"
            />

            <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                  Linked findings
                </span>
                <Badge tone="neutral" variant="outline">
                  Approved or report-ready
                </Badge>
              </div>
              {findingCandidates.length === 0 ? (
                <p className="text-[11px] leading-relaxed text-text-muted">
                  No approved findings yet. Approve at least one finding in the
                  findings workspace to link it as evidence here.
                </p>
              ) : (
                <ul className="flex max-h-64 flex-col gap-1.5 overflow-y-auto pr-1">
                  {findingCandidates.map((c) => {
                    const checked = selectedFindings.has(c.id);
                    return (
                      <li key={c.id}>
                        <label className="flex items-start gap-2 rounded-md border border-border-subtle bg-bg-page/40 p-2 text-xs">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFinding(c.id)}
                            className="mt-0.5 h-3.5 w-3.5 rounded border-border-subtle bg-bg-elevated"
                          />
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-text-primary">
                              {c.statement}
                            </span>
                            <span className="text-[11px] text-text-muted">
                              {c.category} · {c.reviewStatus}
                              <span className="mx-1.5 text-text-disabled">·</span>
                              {c.evidenceStrength} evidence
                            </span>
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
                Opportunity saved. Add another or close the form.
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-text-muted">
                Quadrant + priority are derived from your scores on save.
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
                  {pending ? "Saving…" : "Save opportunity"}
                </Button>
              </div>
            </div>
          </form>
        ) : null}
      </CardBody>
    </Card>
  );
}

function ScoreField({
  id,
  label,
  value,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={`opportunity-score-${id}`}
        className="text-xs font-medium tracking-tight text-text-secondary"
      >
        {label}
      </label>
      <input
        id={`opportunity-score-${id}`}
        type="number"
        inputMode="numeric"
        min={0}
        max={100}
        step={1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="h-10 w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-3 text-sm font-mono tabular-nums text-text-primary outline-none transition-[border,box-shadow] focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
      />
    </div>
  );
}

function Textarea({
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

function Select({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ value: string; label: string }>;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label
        htmlFor={id}
        className="text-xs font-medium tracking-tight text-text-secondary"
      >
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-3 text-sm text-text-primary outline-none transition-[border,box-shadow] focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function translateError(
  code:
    | "unauthenticated"
    | "invalid-engagement"
    | "invalid-opportunity"
    | "missing-fields"
    | "invalid-category"
    | "invalid-evidence"
    | "invalid-score"
    | "engagement-not-found"
    | "opportunity-not-found"
    | "rejection-reason-invalid"
    | "service-error",
): string {
  switch (code) {
    case "missing-fields":
      return "Title is required.";
    case "invalid-category":
      return "Pick a valid category.";
    case "invalid-evidence":
      return "Pick a valid evidence strength.";
    case "invalid-score":
      return "Scores must be between 0 and 100.";
    case "engagement-not-found":
    case "invalid-engagement":
      return "This engagement could not be found. Refresh the page and try again.";
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "rejection-reason-invalid":
      // Form does not surface this code; included for compile-time
      // alignment with the broader OpportunityActionResult union.
      return "Rejection reason must be between 10 and 500 characters, or empty.";
    case "service-error":
    default:
      return "We couldn't save the opportunity. Please try again.";
  }
}

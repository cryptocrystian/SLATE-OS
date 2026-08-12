"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Card, CardBody } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { createRoadmapItem } from "@/lib/roadmap/actions";
import { PHASE_LABEL, PHASE_ORDER } from "@/lib/roadmap/helpers";
import { PRIORITY_LABEL } from "@/lib/opportunities/helpers";
import type { OpportunityPriority } from "@/lib/opportunities/types";
import type { RoadmapPhase } from "@/lib/roadmap/types";

const PRIORITY_OPTIONS: OpportunityPriority[] = [
  "quick-win",
  "strategic-build",
  "low-priority",
  "defer",
  "avoid",
];

export interface OpportunityCandidateOption {
  id: string;
  title: string;
  priority: string;
  status: string;
}

export interface CreateRoadmapItemFormProps {
  engagementId: string;
  opportunityCandidates: OpportunityCandidateOption[];
}

export function CreateRoadmapItemForm({
  engagementId,
  opportunityCandidates,
}: CreateRoadmapItemFormProps) {
  const [open, setOpen] = React.useState(false);
  const [phase, setPhase] = React.useState<RoadmapPhase>("first-30");
  const [title, setTitle] = React.useState("");
  const [objective, setObjective] = React.useState("");
  const [priority, setPriority] = React.useState<OpportunityPriority>(
    "quick-win",
  );
  const [opportunityId, setOpportunityId] = React.useState<string>("");
  const [keyActions, setKeyActions] = React.useState("");
  const [dependencies, setDependencies] = React.useState("");
  const [successCriteria, setSuccessCriteria] = React.useState("");
  const [risks, setRisks] = React.useState("");
  const [ownerPlaceholder, setOwnerPlaceholder] = React.useState("");
  const [readinessNote, setReadinessNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [success, setSuccess] = React.useState(false);

  function reset() {
    setTitle("");
    setObjective("");
    setOpportunityId("");
    setKeyActions("");
    setDependencies("");
    setSuccessCriteria("");
    setRisks("");
    setOwnerPlaceholder("");
    setReadinessNote("");
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
      const result = await createRoadmapItem({
        engagementId,
        phase,
        title: title.trim(),
        objective,
        priority,
        opportunityId: opportunityId || undefined,
        keyActions: splitLines(keyActions),
        dependencies: splitLines(dependencies),
        successCriteria: splitLines(successCriteria),
        risks: splitLines(risks),
        ownerPlaceholder,
        readinessNote,
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

  return (
    <Card variant="base">
      <CardBody className="flex flex-col gap-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Sequence the roadmap
            </span>
            <h2 className="text-base font-semibold tracking-tight text-text-primary">
              Add a 30/60/90 roadmap item
            </h2>
            <p className="text-xs leading-relaxed text-text-muted">
              Link to a selected opportunity when possible. Drag-and-drop
              ordering and automatic generation are deferred.
            </p>
          </div>
          <Button
            type="button"
            variant={open ? "secondary" : "primary"}
            size="sm"
            leadingIcon={<Plus className="h-4 w-4" />}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? "Close form" : "Add roadmap item"}
          </Button>
        </div>

        {open ? (
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Select
                id="roadmap-phase"
                label="Phase"
                value={phase}
                onChange={(v) => setPhase(v as RoadmapPhase)}
                options={PHASE_ORDER.map((p) => ({
                  value: p,
                  label: PHASE_LABEL[p],
                }))}
              />
              <Select
                id="roadmap-priority"
                label="Priority"
                value={priority}
                onChange={(v) => setPriority(v as OpportunityPriority)}
                options={PRIORITY_OPTIONS.map((p) => ({
                  value: p,
                  label: PRIORITY_LABEL[p],
                }))}
              />
            </div>

            <Input
              label="Title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Stand up reconciliation pilot"
              required
              autoComplete="off"
            />

            <Textarea
              id="roadmap-objective"
              label="Objective"
              rows={2}
              value={objective}
              onChange={setObjective}
              placeholder="What outcome does this item produce by the end of the phase?"
            />

            <div className="flex flex-col gap-2 rounded-md border border-border-subtle bg-bg-elevated/40 p-3">
              <div className="flex items-center justify-between">
                <span className="text-[11px] uppercase tracking-[0.14em] text-text-muted">
                  Linked opportunity
                </span>
                <Badge tone="neutral" variant="outline">
                  Optional
                </Badge>
              </div>
              {opportunityCandidates.length === 0 ? (
                <p className="text-[11px] leading-relaxed text-text-muted">
                  No opportunities yet. Score an opportunity in the
                  opportunities workspace to link it here.
                </p>
              ) : (
                <select
                  value={opportunityId}
                  onChange={(e) => setOpportunityId(e.target.value)}
                  className="h-10 w-full rounded-md border border-border-subtle bg-bg-elevated/60 px-3 text-sm text-text-primary outline-none transition-[border,box-shadow] focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30"
                >
                  <option value="">— No linked opportunity —</option>
                  {opportunityCandidates.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title} · {humanize(c.priority)} · {humanize(c.status)}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <Textarea
              id="roadmap-actions"
              label="Key actions (one per line)"
              rows={3}
              value={keyActions}
              onChange={setKeyActions}
              placeholder="Concrete steps to land in this phase."
            />
            <Textarea
              id="roadmap-dependencies"
              label="Dependencies (one per line)"
              rows={2}
              value={dependencies}
              onChange={setDependencies}
              placeholder="Stakeholder availability, system access, etc."
            />
            <Textarea
              id="roadmap-success"
              label="Success criteria (one per line)"
              rows={2}
              value={successCriteria}
              onChange={setSuccessCriteria}
              placeholder="What does done look like for this item?"
            />
            <Textarea
              id="roadmap-risks"
              label="Risks (one per line)"
              rows={2}
              value={risks}
              onChange={setRisks}
              placeholder="What could derail this item?"
            />

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="Owner placeholder"
                value={ownerPlaceholder}
                onChange={(e) => setOwnerPlaceholder(e.target.value)}
                placeholder="e.g. Saipien Labs strategist"
                autoComplete="off"
              />
              <Input
                label="Readiness note"
                value={readinessNote}
                onChange={(e) => setReadinessNote(e.target.value)}
                placeholder="Anything that unblocks this item."
                autoComplete="off"
              />
            </div>

            {error ? (
              <p className="rounded-md border border-status-critical/40 bg-status-critical/10 p-3 text-xs text-status-critical">
                {error}
              </p>
            ) : null}
            {success ? (
              <p className="rounded-md border border-status-success/40 bg-status-success/10 p-3 text-xs text-status-success">
                Roadmap item added. Add another or close the form.
              </p>
            ) : null}

            <div className="flex items-center justify-between gap-3">
              <p className="text-[11px] text-text-muted">
                Items default to <span className="font-medium">Planned</span>{" "}
                status.
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
                  {pending ? "Saving…" : "Save roadmap item"}
                </Button>
              </div>
            </div>
          </form>
        ) : null}
      </CardBody>
    </Card>
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

function humanize(value: string): string {
  return value.replace(/_/g, " ");
}

function translateError(
  code:
    | "unauthenticated"
    | "invalid-engagement"
    | "invalid-roadmap-item"
    | "missing-fields"
    | "invalid-phase"
    | "invalid-priority"
    | "invalid-opportunity"
    | "invalid-status"
    | "engagement-not-found"
    | "roadmap-item-not-found"
    | "rejection-reason-invalid"
    | "service-error",
): string {
  switch (code) {
    case "missing-fields":
      return "Title is required.";
    case "invalid-phase":
      return "Pick a valid phase.";
    case "invalid-priority":
      return "Pick a valid priority.";
    case "invalid-opportunity":
      return "Pick a valid linked opportunity, or leave blank.";
    case "engagement-not-found":
    case "invalid-engagement":
      return "This engagement could not be found. Refresh the page and try again.";
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "rejection-reason-invalid":
      // Form does not surface this code; included for compile-time
      // alignment with the broader RoadmapActionResult union.
      return "Rejection reason must be between 10 and 500 characters, or empty.";
    case "service-error":
    default:
      return "We couldn't save the roadmap item. Please try again.";
  }
}

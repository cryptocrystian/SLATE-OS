"use client";

import * as React from "react";
import { Check, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import type { AnswerValue, Question } from "@/lib/scorecard/types";

export interface ScorecardQuestionCardProps {
  question: Question;
  index: number;
  value: AnswerValue | undefined;
  onChange: (value: AnswerValue) => void;
}

export function ScorecardQuestionCard({
  question,
  index,
  value,
  onChange,
}: ScorecardQuestionCardProps) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-bg-surface p-5 shadow-card sm:p-6">
      <div className="flex flex-col gap-2">
        <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-text-muted">
          Question {index + 1}
          {question.optional ? " · Optional" : ""}
        </span>
        <h3 className="text-lg font-semibold leading-snug text-text-primary sm:text-xl">
          {question.prompt}
        </h3>
        {question.whyWeAsk ? (
          <p className="flex items-start gap-2 text-xs leading-relaxed text-text-muted">
            <HelpCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-text-muted" />
            <span>
              <span className="font-medium text-text-secondary">Why we ask:</span>{" "}
              {question.whyWeAsk}
            </span>
          </p>
        ) : null}
      </div>

      <div className="flex flex-col gap-2.5 pt-1">
        {question.type === "single" ? (
          <SingleChoiceControl
            question={question}
            value={typeof value === "string" ? value : undefined}
            onChange={onChange}
          />
        ) : null}
        {question.type === "multi" ? (
          <MultiChoiceControl
            question={question}
            value={Array.isArray(value) ? value : []}
            onChange={onChange}
          />
        ) : null}
        {question.type === "scale" ? (
          <ScaleControl
            question={question}
            value={typeof value === "number" ? value : undefined}
            onChange={onChange}
          />
        ) : null}
        {question.type === "text" ? (
          <TextControl
            question={question}
            value={typeof value === "string" ? value : ""}
            onChange={onChange}
          />
        ) : null}
      </div>
    </div>
  );
}

function SingleChoiceControl({
  question,
  value,
  onChange,
}: {
  question: Extract<Question, { type: "single" }>;
  value: string | undefined;
  onChange: (v: AnswerValue) => void;
}) {
  return (
    <div role="radiogroup" className="flex flex-col gap-2">
      {question.choices.map((choice) => {
        const selected = value === choice.value;
        return (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(choice.value)}
            className={cn(
              "flex w-full items-start gap-3 rounded-lg border bg-bg-elevated/40 px-4 py-3 text-left transition-colors",
              selected
                ? "border-brand-primary/60 bg-brand-primary/[0.08]"
                : "border-border-subtle hover:border-border-strong hover:bg-bg-elevated/70",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border",
                selected
                  ? "border-brand-primary bg-brand-primary"
                  : "border-border-strong bg-bg-page",
              )}
            >
              {selected ? (
                <span className="h-1.5 w-1.5 rounded-full bg-text-inverse" />
              ) : null}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-medium text-text-primary">
                {choice.label}
              </span>
              {choice.description ? (
                <span className="text-xs text-text-muted">
                  {choice.description}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function MultiChoiceControl({
  question,
  value,
  onChange,
}: {
  question: Extract<Question, { type: "multi" }>;
  value: string[];
  onChange: (v: AnswerValue) => void;
}) {
  const max = question.max;
  const isFull = max != null && value.length >= max;

  function toggle(v: string) {
    if (value.includes(v)) {
      onChange(value.filter((x) => x !== v));
    } else if (!isFull) {
      onChange([...value, v]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {max != null ? (
        <div className="text-[11px] text-text-muted">
          Pick up to {max} · {value.length} selected
        </div>
      ) : null}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {question.choices.map((choice) => {
          const selected = value.includes(choice.value);
          const disabled = !selected && isFull;
          return (
            <button
              key={choice.value}
              type="button"
              role="checkbox"
              aria-checked={selected}
              aria-disabled={disabled || undefined}
              onClick={() => toggle(choice.value)}
              className={cn(
                "flex items-start gap-3 rounded-lg border bg-bg-elevated/40 px-4 py-3 text-left transition-colors",
                selected
                  ? "border-brand-primary/60 bg-brand-primary/[0.08]"
                  : "border-border-subtle hover:border-border-strong hover:bg-bg-elevated/70",
                disabled && "cursor-not-allowed opacity-50 hover:bg-bg-elevated/40 hover:border-border-subtle",
              )}
            >
              <span
                aria-hidden
                className={cn(
                  "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                  selected
                    ? "border-brand-primary bg-brand-primary"
                    : "border-border-strong bg-bg-page",
                )}
              >
                {selected ? <Check className="h-3 w-3 text-text-inverse" /> : null}
              </span>
              <span className="text-sm font-medium text-text-primary">
                {choice.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ScaleControl({
  question,
  value,
  onChange,
}: {
  question: Extract<Question, { type: "scale" }>;
  value: number | undefined;
  onChange: (v: AnswerValue) => void;
}) {
  const ticks = Array.from(
    { length: question.max - question.min + 1 },
    (_, i) => question.min + i,
  );
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-5 gap-2" role="radiogroup">
        {ticks.map((t) => {
          const selected = value === t;
          return (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(t)}
              className={cn(
                "flex h-12 items-center justify-center rounded-lg border font-mono text-sm font-semibold tabular-nums transition-colors",
                selected
                  ? "border-brand-primary bg-brand-primary/15 text-brand-primary"
                  : "border-border-subtle bg-bg-elevated/40 text-text-secondary hover:border-border-strong hover:text-text-primary",
              )}
            >
              {t}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between text-[11px] text-text-muted">
        <span>{question.minLabel}</span>
        <span>{question.maxLabel}</span>
      </div>
    </div>
  );
}

function TextControl({
  question,
  value,
  onChange,
}: {
  question: Extract<Question, { type: "text" }>;
  value: string;
  onChange: (v: AnswerValue) => void;
}) {
  return (
    <Input
      type={question.inputKind === "email" ? "email" : "text"}
      placeholder={question.placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={question.inputKind === "email" ? "email" : "off"}
    />
  );
}

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/** GovernanceOS form fields — same surface treatment as the SLATE Input primitive. */

const control =
  "w-full rounded-md border border-border-subtle bg-bg-elevated/60 text-sm text-text-primary outline-none transition-[border,box-shadow] placeholder:text-text-muted hover:border-border-strong focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30";

function Label({ htmlFor, children, required }: { htmlFor: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={htmlFor} className="text-xs font-medium tracking-tight text-text-secondary">
      {children}
      {required ? <span className="ml-0.5 text-status-critical">*</span> : null}
    </label>
  );
}

function Hint({ children }: { children?: React.ReactNode }) {
  return children ? <p className="text-[11px] leading-relaxed text-text-muted">{children}</p> : null;
}

export function TextAreaField({
  label,
  value,
  onChange,
  rows = 4,
  placeholder,
  hint,
  required,
  maxLength = 4000,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  hint?: React.ReactNode;
  required?: boolean;
  maxLength?: number;
}) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <textarea
        id={id}
        rows={rows}
        value={value}
        required={required}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={cn(control, "p-3 leading-relaxed")}
      />
      <Hint>{hint}</Hint>
    </div>
  );
}

export function SelectField<T extends string>({
  label,
  value,
  onChange,
  options,
  placeholder,
  hint,
  required,
}: {
  label: string;
  value: T | "";
  onChange: (v: T | "") => void;
  options: ReadonlyArray<{ value: T; label: string; disabled?: boolean }>;
  placeholder?: string;
  hint?: React.ReactNode;
  required?: boolean;
}) {
  const id = React.useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id} required={required}>
        {label}
      </Label>
      <select
        id={id}
        value={value}
        required={required}
        onChange={(e) => onChange(e.target.value as T | "")}
        className={cn(control, "h-10 px-3")}
      >
        {placeholder !== undefined ? <option value="">{placeholder}</option> : null}
        {options.map((o) => (
          <option key={o.value} value={o.value} disabled={o.disabled}>
            {o.label}
          </option>
        ))}
      </select>
      <Hint>{hint}</Hint>
    </div>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-md border border-status-critical/40 bg-status-critical/10 p-2 text-[11px] text-status-critical"
    >
      {message}
    </p>
  );
}

export function FieldGroup({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-bg-surface p-4 sm:p-5">
      <legend className="sr-only">{title}</legend>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold tracking-tight text-text-primary">{title}</h3>
        {description ? <p className="text-xs leading-relaxed text-text-muted">{description}</p> : null}
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </fieldset>
  );
}

/** Map a service error code to calm operator copy. */
export function describeServiceError(error: string, detail?: string): string {
  switch (error) {
    case "unauthenticated":
      return "Your session expired. Sign in again.";
    case "not-a-member":
      return "Your account is not a member of this workspace.";
    case "forbidden":
      return "Your program role does not allow this action.";
    case "not-found":
      return "That record could not be found. It may have changed — reload the page.";
    case "conflict":
      return "A record with the same identity already exists (e.g. duplicate policy key or source lineage).";
    case "program-archived":
      return "This program is archived. Archived programs are read-only.";
    case "invalid-transition":
      return "That change is not allowed from the record's current state.";
    case "invalid-input":
      return detail ? `Please check the form (${detail.replace(/-/g, " ")}).` : "Please check the form.";
    default:
      return "Something went wrong. Please try again.";
  }
}

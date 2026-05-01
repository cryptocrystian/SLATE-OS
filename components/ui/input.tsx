import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  invalid?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  function Input(
    { className, label, hint, invalid, id, ...props },
    ref,
  ) {
    const reactId = React.useId();
    const inputId = id ?? reactId;
    return (
      <div className="flex flex-col gap-1.5">
        {label ? (
          <label
            htmlFor={inputId}
            className="text-xs font-medium tracking-tight text-text-secondary"
          >
            {label}
          </label>
        ) : null}
        <input
          ref={ref}
          id={inputId}
          className={cn(
            "h-10 w-full rounded-md border bg-bg-elevated/60 px-3 text-sm text-text-primary placeholder:text-text-muted",
            "transition-[border,box-shadow] outline-none",
            "focus-visible:border-brand-primary/60 focus-visible:bg-bg-elevated focus-visible:ring-2 focus-visible:ring-brand-primary/30",
            invalid
              ? "border-status-critical/50"
              : "border-border-subtle hover:border-border-strong",
            className,
          )}
          aria-invalid={invalid || undefined}
          {...props}
        />
        {hint ? (
          <p className="text-[11px] leading-relaxed text-text-muted">{hint}</p>
        ) : null}
      </div>
    );
  },
);

import * as React from "react";
import { cn } from "@/lib/utils";

export interface PageHeaderProps extends React.HTMLAttributes<HTMLElement> {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  meta?: React.ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  meta,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-5 border-b border-border-subtle pb-6",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col items-start justify-between gap-4 lg:flex-row lg:items-end">
        <div className="flex flex-col gap-2">
          {eyebrow ? (
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              {eyebrow}
            </span>
          ) : null}
          <h1 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-[28px]">
            {title}
          </h1>
          {description ? (
            <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
              {description}
            </p>
          ) : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 items-center gap-2">{actions}</div>
        ) : null}
      </div>
      {meta ? (
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-text-muted">
          {meta}
        </div>
      ) : null}
    </header>
  );
}

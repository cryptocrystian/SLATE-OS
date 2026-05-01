import * as React from "react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  ...props
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-lg border border-dashed border-border-subtle bg-bg-surface/40 p-6",
        className,
      )}
      {...props}
    >
      {icon ? (
        <div className="flex h-9 w-9 items-center justify-center rounded-md border border-border-subtle bg-bg-elevated text-text-secondary">
          {icon}
        </div>
      ) : null}
      <div className="flex flex-col gap-1">
        <h4 className="text-sm font-semibold text-text-primary">{title}</h4>
        {description ? (
          <p className="max-w-prose text-xs leading-relaxed text-text-muted">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="pt-1">{action}</div> : null}
    </div>
  );
}

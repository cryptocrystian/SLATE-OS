import * as React from "react";
import { cn } from "@/lib/utils";

type CardVariant = "base" | "elevated" | "interactive";

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  as?: keyof JSX.IntrinsicElements;
}

/**
 * Interactive surface treatment — exported so clickable rows that can't be a
 * <Card> element (Link, button) share the same hover model. (Phase 1 / docs/63 W2)
 */
export const cardInteractiveClass =
  "border border-border-subtle bg-bg-surface shadow-card transition-[border,background,transform] duration-150 hover:border-border-strong hover:bg-bg-elevated/80";

const variants: Record<CardVariant, string> = {
  base: "bg-bg-surface border border-border-subtle shadow-card",
  elevated: "bg-bg-elevated border border-border-subtle shadow-elevated",
  interactive: cardInteractiveClass,
};

export function Card({
  className,
  variant = "base",
  as: Tag = "div",
  ...props
}: CardProps) {
  const Component = Tag as React.ElementType;
  return (
    <Component
      className={cn("rounded-xl", variants[variant], className)}
      {...props}
    />
  );
}

export function CardHeader({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-col gap-1.5 px-5 pt-5 pb-3 sm:px-6 sm:pt-6",
        className,
      )}
      {...props}
    />
  );
}

export function CardTitle({
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      className={cn(
        "text-sm font-semibold tracking-tight text-text-primary",
        className,
      )}
      {...props}
    />
  );
}

export function CardDescription({
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      className={cn("text-xs text-text-muted leading-relaxed", className)}
      {...props}
    />
  );
}

export function CardBody({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("px-5 pb-5 sm:px-6 sm:pb-6", className)} {...props} />
  );
}

export function CardFooter({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-t border-border-subtle px-5 py-3 sm:px-6",
        className,
      )}
      {...props}
    />
  );
}

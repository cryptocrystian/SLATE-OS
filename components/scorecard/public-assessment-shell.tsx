import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PublicAssessmentShellProps {
  children: React.ReactNode;
  /** Render with a tighter max width for stepper / results screens */
  width?: "wide" | "narrow";
  className?: string;
}

export function PublicAssessmentShell({
  children,
  width = "wide",
  className,
}: PublicAssessmentShellProps) {
  return (
    <div className="relative flex min-h-screen flex-col bg-bg-page text-text-primary">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-radial-glow"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[480px] bg-gradient-to-b from-brand-primary/[0.06] via-transparent to-transparent"
      />

      <header className="relative z-10 border-b border-border-subtle bg-bg-page/70 backdrop-blur-md">
        <div
          className={cn(
            "mx-auto flex h-16 w-full items-center justify-between px-5 sm:px-8",
            width === "wide" ? "max-w-6xl" : "max-w-3xl",
          )}
        >
          <Link
            href="/scorecard"
            className="flex flex-col gap-1 outline-none"
            aria-label="SLATE — AI Workflow Scorecard"
          >
            <Image
              src="/brand/slate-logo-white.png"
              alt="SLATE"
              width={720}
              height={155}
              priority
              className="h-7 w-auto"
            />
            <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
              AI Workflow Scorecard
            </span>
          </Link>

          <div className="hidden items-center gap-2 text-[11px] text-text-muted sm:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-status-success" />
            <span>Self-reported · No subscription · Result is directional</span>
          </div>
        </div>
      </header>

      <main
        className={cn(
          "relative z-10 mx-auto w-full flex-1 px-5 pb-16 pt-10 sm:px-8 sm:pt-14 lg:pt-20",
          width === "wide" ? "max-w-6xl" : "max-w-3xl",
          className,
        )}
      >
        {children}
      </main>

      <footer className="relative z-10 border-t border-border-subtle bg-bg-page/70">
        <div
          className={cn(
            "mx-auto flex w-full flex-col gap-3 px-5 py-6 text-[11px] text-text-muted sm:flex-row sm:items-center sm:justify-between sm:px-8",
            width === "wide" ? "max-w-6xl" : "max-w-3xl",
          )}
        >
          <p>
            SLATE is the operating system behind Saipien Labs’ discovery,
            strategy, build, and venture workflows.
          </p>
          <p className="font-mono uppercase tracking-[0.14em]">
            © Saipien Labs · Built on SLATE
          </p>
        </div>
      </footer>
    </div>
  );
}

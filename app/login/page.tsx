import * as React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = {
  title: "Sign in",
  description:
    "Operator access to SLATE — Saipien Labs' operating system for scorecards, advisory sprints, reports, and proposals.",
  robots: {
    index: false,
    follow: false,
  },
};

export const dynamic = "force-dynamic";

interface LoginPageProps {
  searchParams?: { sent?: string; error?: string };
}

const ERROR_COPY: Record<string, string> = {
  "missing-email": "Enter your email to continue.",
  "invalid-email": "That doesn't look like a valid email address.",
  unauthorized: "That email is not authorized for SLATE operator access.",
  config:
    "SLATE is not yet connected to Supabase in this environment. Reach out to the operator who set up your invite.",
  auth: "We couldn't send a sign-in link. Try again, or contact a SLATE operator.",
  callback:
    "That sign-in link expired or had already been used. Send a new one to continue.",
};

function describeError(code?: string): string | null {
  if (!code) return null;
  return ERROR_COPY[code] ?? "Something went wrong. Try sending a new link.";
}

export default function LoginPage({ searchParams }: LoginPageProps) {
  const sent = searchParams?.sent === "1";
  const errorMessage = describeError(searchParams?.error);

  return (
    <div className="relative flex min-h-screen items-stretch bg-bg-page text-text-primary">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-radial-glow"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-x-0 top-0 h-[520px] bg-gradient-to-b from-brand-primary/[0.07] via-transparent to-transparent"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed inset-y-0 right-0 hidden w-1/2 bg-gradient-to-bl from-practice-ai/[0.08] via-transparent to-transparent lg:block"
      />

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-5 py-10 sm:px-8 lg:flex-row lg:items-stretch lg:gap-16 lg:py-16">
        {/* Left rail — premium SLATE framing */}
        <section className="flex flex-1 flex-col justify-between gap-10 lg:max-w-md">
          <Link
            href="/"
            className="inline-flex w-fit items-center gap-3 outline-none"
          >
            <div className="relative flex h-10 w-10 items-center justify-center rounded-lg border border-border-strong bg-bg-elevated">
              <div
                aria-hidden
                className="absolute inset-0 rounded-lg bg-gradient-to-br from-brand-primary/30 via-transparent to-practice-ai/20"
              />
              <span className="relative font-mono text-sm font-semibold tracking-tight text-text-primary">
                SL
              </span>
            </div>
            <div className="flex flex-col leading-tight">
              <span className="text-sm font-semibold tracking-tight text-text-primary">
                SLATE
              </span>
              <span className="text-[10px] uppercase tracking-[0.14em] text-text-muted">
                Saipien Labs OS
              </span>
            </div>
          </Link>

          <div className="flex flex-col gap-6">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-text-muted">
              Operator access · Internal
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
              Sign in to SLATE
            </h1>
            <p className="max-w-sm text-sm leading-relaxed text-text-secondary">
              Access Saipien Labs’ operating system for scorecards, advisory
              sprints, reports, and proposals.
            </p>

            <ul className="hidden flex-col gap-3 pt-2 text-[13px] text-text-secondary sm:flex">
              <li className="flex items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-practice-ai" />
                <span>
                  GrowthOps + AdvisoryOps lifecycle, from public scorecard
                  through proposal, behind one operator surface.
                </span>
              </li>
              <li className="flex items-start gap-3">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-status-success" />
                <span>
                  Internal Saipien Fit Score and engagement records are
                  never exposed to prospects or stakeholders.
                </span>
              </li>
            </ul>
          </div>

          <p className="text-[11px] leading-relaxed text-text-muted">
            Operator access only. The{" "}
            <Link
              href="/scorecard"
              className="text-text-secondary underline-offset-4 hover:text-text-primary hover:underline"
            >
              public scorecard
            </Link>{" "}
            and stakeholder intake do not require a SLATE login.
          </p>
        </section>

        {/* Right rail — auth surface */}
        <section className="mt-10 flex flex-1 items-center justify-center lg:mt-0">
          <div className="w-full max-w-md">
            <div className="rounded-2xl border border-border-subtle bg-bg-surface/90 p-7 shadow-elevated backdrop-blur-md sm:p-8">
              <div className="flex flex-col gap-1.5 pb-6">
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
                  Magic link sign-in
                </p>
                <h2 className="text-lg font-semibold tracking-tight text-text-primary">
                  Continue with your operator email
                </h2>
                <p className="text-xs leading-relaxed text-text-muted">
                  We’ll email a single-use link. The link signs you in to
                  SLATE on this device — no password to remember.
                </p>
              </div>

              {sent ? (
                <div
                  role="status"
                  aria-live="polite"
                  className="mb-5 flex items-start gap-3 rounded-lg border border-status-success/30 bg-status-success/[0.08] p-4 text-[13px] leading-relaxed text-text-primary"
                >
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-status-success" />
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">Check your email.</span>
                    <span className="text-text-secondary">
                      We sent a secure sign-in link if the address is
                      authorized. The link expires after a short time — if
                      it doesn’t arrive in a minute, send a new one.
                    </span>
                  </div>
                </div>
              ) : null}

              {errorMessage ? (
                <div
                  role="alert"
                  className="mb-5 flex items-start gap-3 rounded-lg border border-status-critical/30 bg-status-critical/[0.06] p-4 text-[13px] leading-relaxed text-text-primary"
                >
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-status-critical" />
                  <div className="flex flex-col gap-1">
                    <span className="font-medium">We couldn’t send that.</span>
                    <span className="text-text-secondary">{errorMessage}</span>
                  </div>
                </div>
              ) : null}

              <LoginForm invalid={Boolean(errorMessage)} />

              <p className="mt-6 border-t border-border-subtle pt-5 text-[11px] leading-relaxed text-text-muted">
                Operator access only. Public scorecards and stakeholder
                intake do not require a SLATE login. SLATE never sends
                marketing email — only operator sign-in links.
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

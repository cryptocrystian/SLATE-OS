"use client";

import * as React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowRight, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScorecardResultHero } from "./scorecard-result-hero";
import { ScoreCard } from "./score-card";
import { OpportunityAreaCard } from "./opportunity-area-card";
import { RecommendedNextStepCard } from "./recommended-next-step-card";
import { RiskReadinessNote } from "./risk-readiness-note";
import {
  clearScorecardState,
  loadScorecardState,
} from "@/lib/scorecard/storage";
import { scoreScorecard } from "@/lib/scorecard/scoring";
import {
  toPublicScoreResult,
  type PublicScoreResult,
} from "@/lib/scorecard/public-result";

interface State {
  status: "loading" | "missing" | "ready" | "error";
  result?: PublicScoreResult;
  firstName?: string;
  company?: string;
}

export function ScorecardResultsView() {
  const searchParams = useSearchParams();
  const submissionId = searchParams?.get("submission_id") ?? null;
  const [state, setState] = React.useState<State>({ status: "loading" });

  React.useEffect(() => {
    let cancelled = false;

    async function load() {
      if (submissionId) {
        try {
          const resp = await fetch(`/api/scorecard/results/${submissionId}`, {
            cache: "no-store",
          });
          if (!resp.ok) {
            if (cancelled) return;
            setState({ status: resp.status === 404 ? "missing" : "error" });
            return;
          }
          const data = (await resp.json()) as {
            submissionId: string;
            result: PublicScoreResult;
            displayContext: { firstName: string | null; company: string | null };
          };
          if (cancelled) return;
          setState({
            status: "ready",
            result: data.result,
            firstName: data.displayContext?.firstName ?? undefined,
            company: data.displayContext?.company ?? undefined,
          });
          return;
        } catch {
          if (cancelled) return;
          setState({ status: "error" });
          return;
        }
      }

      // Fallback: localStorage resume buffer (dev / mid-flow refresh)
      const stored = loadScorecardState();
      if (
        !stored ||
        !stored.answers ||
        Object.keys(stored.answers).length === 0
      ) {
        if (cancelled) return;
        setState({ status: "missing" });
        return;
      }
      const result = toPublicScoreResult(scoreScorecard(stored.answers));
      const firstName = stored.answers["contact.firstName"];
      const company = stored.answers["contact.company"];
      if (cancelled) return;
      setState({
        status: "ready",
        result,
        firstName: typeof firstName === "string" ? firstName : undefined,
        company: typeof company === "string" ? company : undefined,
      });
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [submissionId]);

  if (state.status === "loading") {
    return <div className="min-h-[40vh]" aria-hidden />;
  }

  if (state.status === "error") {
    return <ResultsErrorState submissionId={submissionId} />;
  }

  if (state.status === "missing" || !state.result) {
    return <ResultsMissingState />;
  }

  const { result } = state;

  return (
    <div className="flex flex-col gap-12 sm:gap-16">
      <ScorecardResultHero
        result={result}
        firstName={state.firstName}
        company={state.company}
      />

      <section
        aria-label="Score summary"
        className="grid grid-cols-1 gap-3 md:grid-cols-3"
      >
        <ScoreCard
          label="AI Readiness"
          value={result.ai}
          dimension="ai"
          description="Operating posture and prior usage that affect how easily AI can be absorbed."
        />
        <ScoreCard
          label="Workflow Friction"
          value={result.friction}
          dimension="friction"
          description="Severity and breadth of day-to-day friction. High friction is the strongest signal of where AI is likely to create leverage — not a problem to be celebrated."
        />
        <ScoreCard
          label="Systems Readiness"
          value={result.systems}
          dimension="systems"
          description="Integration maturity that determines what is realistic in 30/60/90 days."
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="flex flex-col gap-6 lg:col-span-2">
          <header className="flex flex-col gap-2">
            <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
              Likely opportunity areas
            </span>
            <h2 className="text-balance text-2xl font-semibold tracking-tight text-text-primary">
              Three surfaces where AI is most likely to create leverage.
            </h2>
            <p className="max-w-2xl text-sm leading-relaxed text-text-secondary">
              These are directional matches based on self-reported friction. A
              paid AI Opportunity Sprint validates them with stakeholder
              evidence and produces an implementation plan.
            </p>
          </header>
          <div className="flex flex-col gap-3">
            {result.opportunities.map((o, i) => (
              <OpportunityAreaCard key={o.id} rank={i + 1} opportunity={o} />
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-6">
          <RiskReadinessNote notes={result.riskNotes} />
        </div>
      </section>

      <RecommendedNextStepCard classification={result.classification} />

      <section className="flex flex-col gap-4 rounded-xl border border-border-subtle bg-bg-surface/60 p-5 sm:p-6">
        <h3 className="text-sm font-semibold tracking-tight text-text-primary">
          What this scorecard does and does not include
        </h3>
        <p className="text-xs leading-relaxed text-text-muted">
          The scorecard provides directional guidance based on self-reported
          inputs. It does not include a full workflow map, technical
          architecture, ROI model, detailed implementation roadmap, proposal,
          or pricing. Those arrive in a paid AI Opportunity Sprint, where
          SLATE pairs stakeholder evidence with consultant judgment.
        </p>
      </section>

      <footer className="flex flex-col items-start justify-between gap-3 border-t border-border-subtle pt-6 sm:flex-row sm:items-center">
        <Link href="/scorecard">
          <Button
            variant="ghost"
            size="md"
            leadingIcon={<ArrowLeft className="h-4 w-4" />}
          >
            Back to scorecard overview
          </Button>
        </Link>
        <Button
          variant="outline"
          size="md"
          leadingIcon={<RefreshCw className="h-4 w-4" />}
          onClick={() => {
            clearScorecardState();
            window.location.href = "/scorecard/start";
          }}
        >
          Restart with new answers
        </Button>
      </footer>
    </div>
  );
}

function ResultsMissingState() {
  return (
    <div className="flex flex-col items-start gap-5 rounded-xl border border-border-subtle bg-bg-surface p-8 shadow-card sm:p-10">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-muted">
        No scorecard yet
      </span>
      <h1 className="text-balance text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
        Take the scorecard to see your result.
      </h1>
      <p className="max-w-xl text-sm leading-relaxed text-text-secondary">
        Results are calculated from your answers. Once you complete the
        scorecard, the result lands here.
      </p>
      <Link href="/scorecard/start">
        <Button
          variant="primary"
          size="lg"
          trailingIcon={<ArrowRight className="h-4 w-4" />}
        >
          Start the Scorecard
        </Button>
      </Link>
    </div>
  );
}

function ResultsErrorState({ submissionId }: { submissionId: string | null }) {
  return (
    <div className="flex flex-col items-start gap-5 rounded-xl border border-status-critical/30 bg-bg-surface p-8 shadow-card sm:p-10">
      <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-status-critical">
        Result unavailable
      </span>
      <h1 className="text-balance text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
        We couldn’t load that scorecard result.
      </h1>
      <p className="max-w-xl text-sm leading-relaxed text-text-secondary">
        {submissionId
          ? "The result link may have expired or the SLATE server hit a transient error. You can retry from the scorecard overview."
          : "There was a problem reaching the SLATE server. Try again in a moment."}
      </p>
      <Link href="/scorecard">
        <Button
          variant="primary"
          size="md"
          trailingIcon={<ArrowRight className="h-4 w-4" />}
        >
          Back to scorecard overview
        </Button>
      </Link>
    </div>
  );
}

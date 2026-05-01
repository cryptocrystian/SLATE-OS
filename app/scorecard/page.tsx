import type { Metadata } from "next";
import { PublicAssessmentShell } from "@/components/scorecard/public-assessment-shell";
import { ScorecardHero } from "@/components/scorecard/scorecard-hero";
import { ScorecardValueProps } from "@/components/scorecard/scorecard-value-props";
import { ScorecardBoundaryCard } from "@/components/scorecard/scorecard-boundary-card";

export const metadata: Metadata = {
  title: "Where could AI actually create value in your business?",
};

export default function ScorecardLandingPage() {
  return (
    <PublicAssessmentShell>
      <div className="flex flex-col gap-20 sm:gap-24">
        <ScorecardHero />
        <ScorecardValueProps />
        <ScorecardBoundaryCard />
      </div>
    </PublicAssessmentShell>
  );
}

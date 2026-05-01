import type { Metadata } from "next";
import { PublicAssessmentShell } from "@/components/scorecard/public-assessment-shell";
import { ScorecardResultsView } from "@/components/scorecard/scorecard-results-view";

export const metadata: Metadata = {
  title: "Your scorecard result",
};

export default function ScorecardResultsPage() {
  return (
    <PublicAssessmentShell>
      <ScorecardResultsView />
    </PublicAssessmentShell>
  );
}

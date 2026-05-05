import type { Metadata } from "next";
import { PublicAssessmentShell } from "@/components/scorecard/public-assessment-shell";
import { ScorecardResultsView } from "@/components/scorecard/scorecard-results-view";

export const metadata: Metadata = {
  title: "Your scorecard result",
};

// The result view reads `submission_id` from URL params and fetches the
// persisted result at request time — never prerender.
export const dynamic = "force-dynamic";

export default function ScorecardResultsPage() {
  return (
    <PublicAssessmentShell>
      <ScorecardResultsView />
    </PublicAssessmentShell>
  );
}

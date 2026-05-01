import type { Metadata } from "next";
import { PublicAssessmentShell } from "@/components/scorecard/public-assessment-shell";
import { ScorecardStepper } from "@/components/scorecard/scorecard-stepper";

export const metadata: Metadata = {
  title: "Take the AI Workflow Scorecard",
};

export default function ScorecardStartPage() {
  return (
    <PublicAssessmentShell width="narrow">
      <ScorecardStepper />
    </PublicAssessmentShell>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "AI Workflow Scorecard",
    template: "%s · AI Workflow Scorecard",
  },
  description:
    "A short diagnostic from Saipien Labs to identify your AI readiness, workflow friction, systems maturity, and likely opportunity areas.",
};

export default function ScorecardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

import type { RoadmapPhase } from "./types";

export const PHASE_ORDER: RoadmapPhase[] = [
  "first-30",
  "days-31-60",
  "days-61-90",
];

export const PHASE_LABEL: Record<RoadmapPhase, string> = {
  "first-30": "First 30 Days",
  "days-31-60": "Days 31–60",
  "days-61-90": "Days 61–90",
};

export const PHASE_DESCRIPTION: Record<RoadmapPhase, string> = {
  "first-30":
    "Pilot work, kickoff actions, and the first measurable outcome of the engagement.",
  "days-31-60":
    "Scale the pilots that worked. Begin the strategic build conversations alongside.",
  "days-61-90":
    "Lock the operating posture. Surface the second-engagement narrative if appropriate.",
};

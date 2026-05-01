import type { FitCategory, LeadStatus } from "./types";

export const FIT_CATEGORIES: FitCategory[] = [
  {
    id: "prime",
    label: "Prime Candidate",
    short: "Prime",
    threshold: 80,
    description:
      "All core qualification signals are present. Move quickly into the AI Systems Review.",
  },
  {
    id: "good",
    label: "Good Candidate",
    short: "Good",
    threshold: 65,
    description:
      "Most qualification signals are healthy. A short discovery call should validate fit before a paid sprint.",
  },
  {
    id: "nurture",
    label: "Nurture",
    short: "Nurture",
    threshold: 50,
    description:
      "Real interest, but not yet sprint-ready. Stay in touch and re-evaluate in the next quarter.",
  },
  {
    id: "disqualify",
    label: "Disqualify · Education Path",
    short: "Disqualify",
    threshold: 0,
    description:
      "Foundations or budget aren't there yet. Send education resources and step back.",
  },
];

export function fitCategoryFor(score: number): FitCategory {
  for (const category of FIT_CATEGORIES) {
    if (score >= category.threshold) return category;
  }
  return FIT_CATEGORIES[FIT_CATEGORIES.length - 1];
}

export const LEAD_STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  "needs-review": "Needs Review",
  "high-fit": "High Fit",
  "diagnostic-requested": "Diagnostic Requested",
  nurture: "Nurture",
  disqualified: "Disqualified",
  converted: "Converted",
};

export const LEAD_STATUS_TONE: Record<
  LeadStatus,
  "info" | "warning" | "success" | "neutral" | "brand" | "risk"
> = {
  new: "info",
  "needs-review": "warning",
  "high-fit": "success",
  "diagnostic-requested": "brand",
  nurture: "neutral",
  disqualified: "risk",
  converted: "success",
};

export const LEAD_FILTERS: Array<{
  id: "all" | LeadStatus;
  label: string;
}> = [
  { id: "all", label: "All" },
  { id: "new", label: "New" },
  { id: "high-fit", label: "High Fit" },
  { id: "needs-review", label: "Needs Review" },
  { id: "diagnostic-requested", label: "Diagnostic Requested" },
  { id: "nurture", label: "Nurture" },
  { id: "disqualified", label: "Disqualified" },
];

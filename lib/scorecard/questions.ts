import type { Question, SectionId } from "./types";

export const QUESTIONS: Question[] = [
  // ── Section 1: Company Profile ────────────────────────────────────────
  {
    id: "company.industry",
    section: "company",
    type: "single",
    prompt: "What best describes the industry?",
    whyWeAsk:
      "Industry shapes which workflows are typically high-value and which are heavily regulated.",
    choices: [
      { value: "professional-services", label: "Professional services" },
      { value: "financial-services", label: "Financial services" },
      { value: "healthcare", label: "Healthcare or life sciences" },
      { value: "logistics", label: "Logistics or operations-heavy" },
      { value: "retail", label: "Retail or consumer" },
      { value: "tech-saas", label: "Technology / SaaS" },
      { value: "industrial", label: "Industrial or manufacturing" },
      { value: "other", label: "Something else" },
    ],
  },
  {
    id: "company.size",
    section: "company",
    type: "single",
    prompt: "How many people work in the business?",
    choices: [
      { value: "1-10", label: "1–10", weights: { fit: -1 } },
      { value: "11-50", label: "11–50", weights: { fit: 1 } },
      { value: "51-200", label: "51–200", weights: { fit: 2 } },
      { value: "201-1000", label: "201–1,000", weights: { fit: 2 } },
      { value: "1000+", label: "1,000+", weights: { fit: 1 } },
    ],
  },

  // ── Section 2: Business Model & Goals ─────────────────────────────────
  {
    id: "business.goal",
    section: "business",
    type: "single",
    prompt: "What is the most important operational goal in the next 12 months?",
    whyWeAsk:
      "AI delivers leverage when it's pointed at a real commercial goal — not at novelty.",
    choices: [
      {
        value: "throughput",
        label: "Increase throughput without proportional headcount",
        weights: { fit: 2, friction: 1 },
      },
      {
        value: "quality",
        label: "Improve consistency and quality of work",
        weights: { fit: 1 },
      },
      {
        value: "cost",
        label: "Reduce operating cost",
        weights: { fit: 1, friction: 1 },
      },
      {
        value: "growth",
        label: "Open up a new revenue line or product",
        weights: { fit: 2 },
      },
      {
        value: "customer",
        label: "Improve client / customer experience",
        weights: { fit: 1 },
      },
      {
        value: "explore",
        label: "Honestly, we're exploring what's possible",
        weights: { fit: -2 },
      },
    ],
  },
  {
    id: "business.constraint",
    section: "business",
    type: "scale",
    prompt:
      "How constrained is growth right now by manual operational work?",
    minLabel: "Not at all",
    maxLabel: "Severely",
    min: 1,
    max: 5,
    weights: { friction: 4, fit: 2 },
  },

  // ── Section 3: Workflow Friction ──────────────────────────────────────
  {
    id: "friction.areas",
    section: "friction",
    type: "multi",
    prompt: "Which of these are real, recurring friction points? Pick up to four.",
    whyWeAsk:
      "Multi-system, repetitive, judgment-light work is where AI assistance pays back fastest.",
    max: 4,
    choices: [
      {
        value: "data-reconciliation",
        label: "Reconciling data across multiple systems",
        weights: { friction: 2, ai: 1 },
      },
      {
        value: "manual-reporting",
        label: "Manual reporting and dashboards",
        weights: { friction: 2, ai: 1 },
      },
      {
        value: "client-comms",
        label: "Client communication and follow-up",
        weights: { friction: 1, ai: 1 },
      },
      {
        value: "doc-review",
        label: "Reviewing or summarizing long documents",
        weights: { friction: 2, ai: 2 },
      },
      {
        value: "intake-discovery",
        label: "Stakeholder intake or discovery",
        weights: { friction: 1, ai: 2 },
      },
      {
        value: "qa-review",
        label: "QA, review, or compliance checks",
        weights: { friction: 2, ai: 1 },
      },
      {
        value: "ops-handoffs",
        label: "Handoffs between ops, sales, and delivery",
        weights: { friction: 2 },
      },
      {
        value: "knowledge",
        label: "Finding internal knowledge and prior work",
        weights: { friction: 1, ai: 1 },
      },
    ],
  },
  {
    id: "friction.severity",
    section: "friction",
    type: "scale",
    prompt: "How severely is friction slowing the team down today?",
    minLabel: "Mild",
    maxLabel: "Painful",
    min: 1,
    max: 5,
    weights: { friction: 4 },
  },

  // ── Section 4: Systems & Tools ────────────────────────────────────────
  {
    id: "systems.maturity",
    section: "systems",
    type: "single",
    prompt: "How would you describe the current systems landscape?",
    whyWeAsk:
      "Integration readiness shapes what's realistic in a 30/60/90-day rollout.",
    choices: [
      {
        value: "scattered",
        label: "Scattered tools, lots of spreadsheets and manual glue",
        weights: { systems: -2, friction: 2 },
      },
      {
        value: "core",
        label: "A core stack, but workflows still leak between tools",
        weights: { systems: 0, friction: 1 },
      },
      {
        value: "integrated",
        label: "Mostly integrated, with a system of record",
        weights: { systems: 2 },
      },
      {
        value: "platformed",
        label: "Modern platformed stack with APIs and clear data model",
        weights: { systems: 4, ai: 1 },
      },
    ],
  },
  {
    id: "systems.documentation",
    section: "systems",
    type: "scale",
    prompt: "How well are workflows actually documented today?",
    minLabel: "Tribal knowledge",
    maxLabel: "Documented and current",
    min: 1,
    max: 5,
    weights: { systems: 3 },
  },

  // ── Section 5: AI Adoption ────────────────────────────────────────────
  {
    id: "ai.usage",
    section: "ai",
    type: "single",
    prompt: "How is AI being used in the business today?",
    choices: [
      {
        value: "none",
        label: "Not really — curiosity-stage",
        weights: { ai: 0 },
      },
      {
        value: "individual",
        label: "Individual contributors use AI tools ad hoc",
        weights: { ai: 2 },
      },
      {
        value: "team",
        label: "A few teams use AI in defined workflows",
        weights: { ai: 4, fit: 1 },
      },
      {
        value: "embedded",
        label: "AI is embedded in core operating workflows",
        weights: { ai: 6, fit: 2 },
      },
    ],
  },
  {
    id: "ai.confidence",
    section: "ai",
    type: "scale",
    prompt: "How confident is leadership in evaluating AI opportunities?",
    minLabel: "Not confident",
    maxLabel: "Very confident",
    min: 1,
    max: 5,
    weights: { ai: 2 },
  },

  // ── Section 6: Data & Risk ────────────────────────────────────────────
  {
    id: "data.sensitivity",
    section: "data",
    type: "single",
    prompt: "How sensitive is the data the team works with?",
    whyWeAsk:
      "Sensitivity changes which AI patterns are appropriate and how oversight is handled.",
    choices: [
      { value: "public", label: "Mostly public or low-sensitivity", weights: { ai: 1 } },
      { value: "internal", label: "Internal-only operating data" },
      {
        value: "client-confidential",
        label: "Client-confidential data",
        weights: { systems: 1 },
      },
      {
        value: "regulated",
        label: "Regulated data (PHI, PII, financial)",
        weights: { fit: 1, systems: 1 },
      },
    ],
  },
  {
    id: "data.governance",
    section: "data",
    type: "scale",
    prompt: "How clear is the team on data governance and AI risk posture?",
    minLabel: "Not yet",
    maxLabel: "Documented and reviewed",
    min: 1,
    max: 5,
    weights: { systems: 2, fit: 1 },
  },

  // ── Section 7: Urgency & Investment Readiness ─────────────────────────
  {
    id: "urgency.timeline",
    section: "urgency",
    type: "single",
    prompt: "When does the team want a path forward?",
    choices: [
      {
        value: "this-quarter",
        label: "This quarter",
        weights: { fit: 3 },
      },
      {
        value: "next-quarter",
        label: "Next quarter",
        weights: { fit: 2 },
      },
      {
        value: "this-year",
        label: "Sometime this year",
        weights: { fit: 1 },
      },
      {
        value: "exploring",
        label: "No timeline — exploring",
        weights: { fit: -2 },
      },
    ],
  },
  {
    id: "urgency.investment",
    section: "urgency",
    type: "single",
    prompt:
      "What level of investment is realistic if the diagnostic surfaces a clear opportunity?",
    whyWeAsk:
      "Helps SLATE recommend a Quick-Win Build, an AI Workflow System, or a Managed AI Partner — not a generic answer.",
    choices: [
      {
        value: "under-25k",
        label: "Under $25k",
        weights: { fit: -1 },
      },
      {
        value: "25-75k",
        label: "$25k–$75k",
        weights: { fit: 1 },
      },
      {
        value: "75-200k",
        label: "$75k–$200k",
        weights: { fit: 2 },
      },
      {
        value: "200k+",
        label: "$200k+",
        weights: { fit: 3 },
      },
      {
        value: "unsure",
        label: "Not sure yet",
      },
    ],
  },

  // ── Section 8: Contact ────────────────────────────────────────────────
  {
    id: "contact.firstName",
    section: "contact",
    type: "text",
    prompt: "First name",
    placeholder: "First name",
  },
  {
    id: "contact.lastName",
    section: "contact",
    type: "text",
    prompt: "Last name",
    placeholder: "Last name",
  },
  {
    id: "contact.role",
    section: "contact",
    type: "text",
    prompt: "Role or title",
    placeholder: "e.g. VP Operations",
  },
  {
    id: "contact.company",
    section: "contact",
    type: "text",
    prompt: "Company",
    placeholder: "Company name",
  },
  {
    id: "contact.email",
    section: "contact",
    type: "text",
    inputKind: "email",
    prompt: "Work email",
    placeholder: "you@company.com",
    whyWeAsk:
      "Used to deliver the result and a recommended next step. SLATE does not subscribe you to anything.",
  },
];

export function questionsForSection(sectionId: SectionId): Question[] {
  return QUESTIONS.filter((q) => q.section === sectionId);
}

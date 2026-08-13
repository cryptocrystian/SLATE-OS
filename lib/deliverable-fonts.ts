import { Source_Serif_4 } from "next/font/google";

/**
 * Display/heading face for client-facing deliverables (report, proposal, SOW).
 *
 * Deliberately distinct from the operator app's Inter (UI sans): premium
 * consulting documents carry a serif with editorial authority, not the
 * product's screen typeface. Source Serif 4 is a workhorse editorial serif —
 * authoritative at display sizes, readable in headings — and is NOT one of the
 * AI-default display faces. Body copy stays on Inter; mono stays JetBrains.
 *
 * Exposed as the CSS variable `--font-deliverable-serif`; apply the `.variable`
 * class on a deliverable root and reference it via
 * `[font-family:var(--font-deliverable-serif)]`.
 */
export const deliverableSerif = Source_Serif_4({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-deliverable-serif",
  display: "swap",
});

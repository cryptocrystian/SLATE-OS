/**
 * Shared types for the SLATE chart vocabulary (Phase 1B proof-of-fit).
 *
 * Every chart exhibit composes primitives from `components/charts/primitives/`.
 * Primitives never hard-code colors — they read from CSS variables so the
 * existing dark theme tokens (and a future light theme) propagate without
 * chart-code changes.
 *
 * No persisted data is read in the proof-of-fit. The single exhibit ships
 * with static sample data declared inline.
 */

export type ChartPalette = "dark" | "light";

export interface ChartMargins {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const DEFAULT_CHART_MARGINS: ChartMargins = {
  top: 28,
  right: 28,
  bottom: 56,
  left: 56,
};

/**
 * Categorical tone vocabulary. Maps to the same status/practice tones the
 * rest of SLATE uses (`Badge`, `MetricCard`, etc.) so chart legends and
 * surrounding chrome stay in one design system.
 */
export type ChartTone =
  | "success"
  | "info"
  | "warning"
  | "risk"
  | "neutral"
  | "brand"
  | "ai";

/**
 * CSS-variable lookup. SVG `fill`/`stroke` accept `var(...)` directly, so
 * charts inherit theme tokens with zero JS-side palette switching.
 */
export const CHART_TONE_VAR: Record<ChartTone, string> = {
  success: "var(--color-status-success)",
  info: "var(--color-status-info)",
  warning: "var(--color-status-warning)",
  risk: "var(--color-status-risk)",
  neutral: "var(--color-status-neutral)",
  brand: "var(--color-brand-primary)",
  ai: "var(--color-practice-ai)",
};

/** Stroke / label tokens used by primitives. */
export const CHART_GRID_STROKE = "var(--color-border-subtle)";
export const CHART_AXIS_STROKE = "var(--color-border-strong)";
export const CHART_TICK_STROKE = "var(--color-border-strong)";
export const CHART_TICK_LABEL = "var(--color-text-muted)";
export const CHART_AXIS_LABEL = "var(--color-text-secondary)";
export const CHART_QUADRANT_LABEL = "var(--color-text-muted)";
export const CHART_DATA_LABEL = "var(--color-text-secondary)";

/** Font stacks. Inter for sans, JetBrains Mono for mono — wired in `app/layout.tsx`. */
export const CHART_FONT_SANS =
  "var(--font-sans), Inter, system-ui, sans-serif";
export const CHART_FONT_MONO =
  "var(--font-mono), 'JetBrains Mono', ui-monospace, monospace";

/**
 * Sourcing footer surfaced under every exhibit. Either pre-rendered text or
 * a `text + n` pair. Source attribution is non-optional in consulting-grade
 * exhibits — the contract is enforced at the primitive level.
 */
export interface SourceNote {
  /** Human-readable source description, e.g. "Stakeholder intake responses". */
  text: string;
  /** Sample size, e.g. n=12. Optional but encouraged. */
  n?: number;
}

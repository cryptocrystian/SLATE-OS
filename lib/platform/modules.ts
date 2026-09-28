/**
 * SLATE module vocabulary (docs/72 §1.2). SLATE PLATFORM.
 *
 * Canon module names: ConsultOS, BuildOS, VentureOS, GovernanceOS.
 * Legacy aliases in older docs (AdvisoryOps/GrowthOps → ConsultOS,
 * BuildOps → BuildOS, StudioOps → VentureOS) are NOT canon and never appear
 * as machine values.
 *
 * Mirrors the `module` check constraints in migrations 0024/0025.
 */
export const SLATE_MODULES = [
  "consultos",
  "buildos",
  "ventureos",
  "governanceos",
  "platform",
] as const;

export type SlateModule = (typeof SLATE_MODULES)[number];

export function isSlateModule(value: unknown): value is SlateModule {
  return typeof value === "string" && (SLATE_MODULES as readonly string[]).includes(value);
}

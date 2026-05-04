import type { Engagement, EngagementStage } from "./types";

export interface RecommendedActionRoute {
  /** When present, the recommended-action CTA links here. */
  href?: string;
  /** When present, the CTA renders as a locked button with this label. */
  lockedNote?: string;
  /** When true, the recommended action's destination is the page the user
   *  is currently on. Callers should hide the card or render it as
   *  read-only "Current workspace." */
  selfReference?: boolean;
}

const STAGE_DESTINATION: Partial<
  Record<EngagementStage, (id: string) => RecommendedActionRoute>
> = {
  setup: (id) => ({ href: `/app/engagements/${id}/intake` }),
  intake: (id) => ({ href: `/app/engagements/${id}/intake` }),
  synthesis: (id) => ({ href: `/app/engagements/${id}/findings` }),
  scoring: (id) => ({ href: `/app/engagements/${id}/opportunities` }),
  report: (id) => ({ href: `/app/engagements/${id}/report` }),
  proposal: (id) => ({ href: `/app/engagements/${id}/proposal` }),
};

/**
 * Resolve where the engagement's recommended action should go.
 * Pass `currentPath` (the path the user is on) so the helper can detect
 * a self-reference and let the caller render a "Current workspace" state.
 */
export function recommendedActionRoute(
  engagement: Engagement,
  currentPath?: string,
): RecommendedActionRoute {
  const resolver = STAGE_DESTINATION[engagement.currentStage];
  const route = resolver ? resolver(engagement.id) : { lockedNote: "Soon" };

  if (route.href && currentPath && currentPath === route.href) {
    return { ...route, selfReference: true };
  }
  return route;
}

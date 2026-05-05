import "server-only";

import { getEngagementById as getMockEngagementById } from "./mock-engagements";
import { getEngagementById as getRealEngagementById } from "./queries";
import type { Engagement } from "./types";

/**
 * Resolve an engagement by id for downstream sub-routes.
 *
 * Order:
 *   1. Mock engagement lookup (legacy slug ids like `atlas-aios-q2`).
 *      Demo paths keep working with their seeded stakeholder / findings /
 *      opportunities / roadmap / report / proposal data.
 *   2. Real persisted engagement lookup (UUIDs created in Step 4 from
 *      a real lead).
 *
 * Returns `kind: "mock"` when the id matches a seeded fixture and the
 * sub-route should render its existing mock workspace, or `kind: "real"`
 * when the engagement was persisted in Step 4 and the sub-route should
 * render the persistence placeholder until its own step ships.
 */
export async function loadEngagementForSubroute(
  id: string,
): Promise<
  | { kind: "mock"; engagement: Engagement }
  | { kind: "real"; engagement: Engagement }
  | null
> {
  const mock = getMockEngagementById(id);
  if (mock) return { kind: "mock", engagement: mock };
  const real = await getRealEngagementById(id);
  if (real) return { kind: "real", engagement: real };
  return null;
}

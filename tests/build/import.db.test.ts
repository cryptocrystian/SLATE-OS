/**
 * Factory → BuildOS import (docs/80 §11 B1: "Import Arxus's state as the first project").
 * Layer: BUILDOS MODULE. Generates the SQL and applies it to PGlite.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { createRequire } from "node:module";
import { createTestDb, createUser, grantMembership } from "../helpers/pglite-db";

const require_ = createRequire(import.meta.url);
const { buildImportSql, parseJourneys } = require_("../../scripts/build/import-factory-project.cjs") as {
  buildImportSql: (o: Record<string, unknown>) => { sql: string; imported: number; skipped: number };
  parseJourneys: (md: string) => Map<string, { title: string; bindings: string[] }>;
};

// Shape-faithful excerpt of Arxus "Canonical Journeys v2.md".
const JOURNEYS = `# Canonical Journeys v2

## Seller journeys

### JRN-S1 — Visitor completes a valuation and receives an emailed result · P1
- **Touches:** \`Valuation\` · \`valuation_created\` · benchmark source-tagged (DEC-019) · INV-010.

### JRN-S2 — Lead becomes a published seller with a live listing · P1  \`[v2 · F3]\`
- **Touches:** \`User\`, \`SellerProfile\`, \`Business\`, \`Listing\`, \`ListingVersion\` · \`listing_activated\` · INV-001.

### JRN-T1 — Deal is structured · P2
- **Touches:** \`Deal\`, \`Document\`, \`Partner\` (legal), \`Consent\`, \`AIAction\`/\`HumanReview\` · \`deal_terms_agreed\` · HARD-003.
`;

const BACKLOG = {
  items: [
    { id: "auth-foundation", repo: "arxus", kind: "foundation", status: "accepted", run_id: "2026-08-10-x" },
    { id: "jrn-s1", repo: "arxus", kind: "journey", journey: "JRN-S1", status: "accepted" },
    { id: "jrn-s2", repo: "arxus", kind: "journey", journey: "JRN-S2", depends_on: ["auth-foundation"], status: "accepted" },
    { id: "jrn-t1", repo: "arxus", kind: "journey", journey: "JRN-T1", depends_on: ["jrn-s2"], status: "infra_hold" },
    { id: "jrn-b3", repo: "arxus", kind: "journey", journey: "JRN-B3", status: "superseded" },
    { id: "ratify-rubric", kind: "decision", status: "launch_gated", note: "OPEN-S3-1 ratify the rubric" },
    { id: "other-repo-item", repo: "elsewhere", kind: "journey", journey: "JRN-S1", status: "ready" },
  ],
};

let db: PGlite;
let ws: string;
let founder: string;

beforeAll(async () => {
  db = await createTestDb({
    beforeApply: async (n, d) => {
      if (n !== 23) return;
      ws = (await d.query<{ id: string }>(`select id from public.workspaces limit 1`)).rows[0].id;
      founder = await createUser(d, "founder@saipienlabs.com");
      await grantMembership(d, ws, founder, "owner");
    },
  });
});

describe("parseJourneys", () => {
  it("reads titles and Touches entities (the factory's binding rule)", () => {
    const j = parseJourneys(JOURNEYS);
    expect(j.get("JRN-S2")).toEqual({
      title: "Lead becomes a published seller with a live listing",
      bindings: ["User", "SellerProfile", "Business", "Listing", "ListingVersion"],
    });
    expect(j.get("JRN-T1")?.bindings).toEqual(["Deal", "Document", "Partner", "Consent", "AIAction", "HumanReview"]);
  });
});

describe("import SQL", () => {
  it("rejects bad identifiers before generating anything", () => {
    expect(() => buildImportSql({ backlog: BACKLOG, journeysMarkdown: JOURNEYS, workspace: "x", createdBy: founder, projectKey: "arxus", repo: "https://g/x" })).toThrow(/workspace/);
  });

  it("applies cleanly: project ready (not active), states mapped, deps kept, decisions listed not imported", async () => {
    const { sql, imported, skipped } = buildImportSql({
      backlog: BACKLOG,
      journeysMarkdown: JOURNEYS,
      workspace: ws,
      createdBy: founder,
      projectKey: "arxus",
      name: "Arxus",
      repo: "https://github.com/cryptocrystian/arxus",
      originRef: "arxus",
      repoFilter: "arxus",
    });
    expect([imported, skipped]).toEqual([5, 1]);
    expect(sql).toMatch(/NOT imported[\s\S]*ratify-rubric/);
    await db.exec(sql);

    const p = (await db.query<{ status: string; origin_kind: string }>(`select status, origin_kind from public.build_projects where project_key = 'arxus'`)).rows[0];
    expect(p).toEqual({ status: "ready", origin_kind: "ventureos_venture" });
    const items = (await db.query<{ item_key: string; status: string; bindings: string[] }>(
      `select item_key, status, bindings from public.build_work_items order by item_key`,
    )).rows;
    expect(Object.fromEntries(items.map((i) => [i.item_key, i.status]))).toEqual({
      "auth-foundation": "accepted",
      "jrn-b3": "superseded",
      "jrn-s1": "accepted",
      "jrn-s2": "accepted",
      "jrn-t1": "ready",
    });
    expect(items.find((i) => i.item_key === "auth-foundation")?.bindings).toEqual(["*"]);
    const deps = await db.query(`select count(*)::int as n from public.build_work_item_deps`);
    expect(deps.rows[0]).toEqual({ n: 2 });
    // Re-applying is refused (project key is unique per workspace) — the import is one-shot.
    await expect(db.exec(sql)).rejects.toThrow(/duplicate key/);
    await db.exec("rollback"); // close the aborted transaction the refused re-apply left open
  });

  it("keeps remediation-mode journeys as journeys and fills canon gaps (accepted extras + drafts)", async () => {
    const backlog = {
      items: [
        { id: "jrn-s2", repo: "arxus", kind: "remediation", journey: "JRN-S2", status: "accepted" },
      ],
    };
    const { sql, imported } = buildImportSql({
      backlog,
      journeysMarkdown: JOURNEYS,
      workspace: ws,
      createdBy: founder,
      projectKey: "arxus-gaps",
      repo: "https://github.com/cryptocrystian/arxus",
      addFromCanon: "1",
      acceptedExtra: "jrn-s1",
    });
    expect(imported).toBe(3); // s2 from the backlog + s1, t1 from canon
    await db.exec(sql);
    const rows = (await db.query<{ item_key: string; kind: string; status: string }>(
      `select i.item_key, i.kind, i.status from public.build_work_items i
         join public.build_projects p on p.id = i.project_id where p.project_key = 'arxus-gaps' order by 1`,
    )).rows;
    expect(rows).toEqual([
      { item_key: "jrn-s1", kind: "journey", status: "accepted" },
      { item_key: "jrn-s2", kind: "journey", status: "accepted" },
      { item_key: "jrn-t1", kind: "journey", status: "draft" },
    ]);
  });
});

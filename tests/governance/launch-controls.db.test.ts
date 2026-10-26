/**
 * Launch-path controls (docs/73 v0.2): GOV 02 derived tier, GOV 06 go-live gate
 * (0037) and the GOV 01 named-approver guard (0038).
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { as, createTestDb, createUser, grantMembership } from "../helpers/pglite-db";

let db: PGlite;
let ws: string;
let founder: string;
let programId: string;

const asFounder = <T>(fn: (tx: Transaction) => Promise<T>) =>
  as(db, { kind: "authenticated", userId: founder }, fn, { commit: true });

async function newAsset(fields: Record<string, unknown> = {}) {
  const cols = { workspace_id: ws, governance_program_id: programId, asset_type: "ai_system", name: "Sys", ...fields };
  const keys = Object.keys(cols);
  const r = await asFounder((tx) =>
    tx.query<{ id: string; control_tier: string }>(
      `insert into public.governed_assets (${keys.join(",")}) values (${keys
        .map((k, i) => (k === "tools_and_permissions" ? `$${i + 1}::jsonb` : `$${i + 1}`))
        .join(",")}) returning id, control_tier`,
      Object.values(cols).map((v) => (typeof v === "object" && v !== null ? JSON.stringify(v) : v)),
    ),
  );
  return r.rows[0];
}

beforeAll(async () => {
  db = await createTestDb({
    beforeApply: async (n, d) => {
      if (n !== 23) return;
      const { rows } = await d.query<{ id: string }>(`select id from public.workspaces limit 1`);
      ws = rows[0].id;
      founder = await createUser(d, "founder@saipienlabs.com");
      await grantMembership(d, ws, founder, "owner");
    },
  });
  programId = crypto.randomUUID();
  await asFounder((tx) =>
    tx.query(
      `insert into public.governance_programs (id, workspace_id, program_kind, name, created_by) values ($1, $2, 'internal', 'Internal', $3)`,
      [programId, ws, founder],
    ),
  );
});

describe("GOV 02 — control tier is derived by the database", () => {
  it.each([
    [{}, "unclassified"],
    [{ data_sensitivity: "internal", autonomy_level: "assistive", client_impact: "none" }, "standard"],
    [{ data_sensitivity: "confidential", autonomy_level: "assistive", client_impact: "indirect" }, "elevated"],
    [{ data_sensitivity: "internal", autonomy_level: "autonomous", client_impact: "none" }, "high"],
    [{ data_sensitivity: "public", autonomy_level: "none", client_impact: "critical" }, "high"],
    [{ data_sensitivity: "confidential", autonomy_level: "assistive" }, "unclassified"],
  ])("%j → %s", async (fields, tier) => {
    const a = await newAsset(fields);
    expect(a.control_tier).toBe(tier);
  });

  it("cannot be written directly", async () => {
    await expect(newAsset({ control_tier: "standard" })).rejects.toThrow(/generated|cannot insert/i);
  });
});

describe("GOV 06 — go-live gate", () => {
  const complete = {
    operator_owner_profile_id: "__founder__",
    autonomy_level: "assistive",
    human_oversight_mode: "human_in_the_loop",
    data_sensitivity: "confidential",
    client_impact: "direct",
    tools_and_permissions: [{ tool: "OpenAI API", permission: "drafts" }],
    stop_mechanism: "Remove the key",
    approver_name: "Founder",
  };
  const fill = (o: Record<string, unknown>) =>
    Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === "__founder__" ? founder : v]));

  it("refuses inserting a system straight into active without the full record", async () => {
    await expect(newAsset({ lifecycle_status: "active" })).rejects.toThrow(/gov06_incomplete: owner, autonomy_level/);
  });

  it("names exactly what is missing", async () => {
    const { stop_mechanism: _s, approver_name: _a, ...partial } = complete;
    await expect(newAsset({ ...fill(partial), lifecycle_status: "active" })).rejects.toThrow(
      /gov06_incomplete: stop_mechanism, approver_name/,
    );
  });

  it("allows go-live once complete, and blank strings do not count", async () => {
    await expect(newAsset({ ...fill(complete), approver_name: "   ", lifecycle_status: "active" })).rejects.toThrow(/approver_name/);
    const a = await newAsset({ ...fill(complete), lifecycle_status: "active" });
    expect(a.control_tier).toBe("elevated");
  });

  it("deleting a linked contact still never blocks (approver contact FK nulls freely)", async () => {
    const acct = await db.query<{ id: string }>(`insert into public.accounts (workspace_id, name) values ($1, 'C') returning id`, [ws]);
    const c = await db.query<{ id: string }>(`insert into public.contacts (account_id, full_name) values ($1, 'Approver') returning id`, [acct.rows[0].id]);
    const a = await newAsset({ ...fill(complete), approver_contact_id: c.rows[0].id, lifecycle_status: "active" });
    await asFounder((tx) => tx.query(`update public.governance_programs set status = 'active' where id = $1`, [programId]));
    await db.query(`delete from public.contacts where id = $1`, [c.rows[0].id]);
    const { rows } = await db.query<{ approver_contact_id: string | null; approver_name: string }>(
      `select approver_contact_id, approver_name from public.governed_assets where id = $1`,
      [a.id],
    );
    expect(rows[0].approver_contact_id).toBeNull();
    expect(rows[0].approver_name).toBe("Founder");
  });
});

describe("GOV 01 — named approver guard (0038)", () => {
  let engagementId: string;

  beforeAll(async () => {
    const acct = await db.query<{ id: string }>(`insert into public.accounts (workspace_id, name) values ($1, 'Client') returning id`, [ws]);
    const e = await db.query<{ id: string }>(
      `insert into public.engagements (workspace_id, account_id, name) values ($1, $2, 'E') returning id`,
      [ws, acct.rows[0].id],
    );
    engagementId = e.rows[0].id;
  });

  async function finding(status = "needs_review") {
    const r = await db.query<{ id: string }>(
      `insert into public.findings (workspace_id, engagement_id, statement, review_status) values ($1, $2, 'f', $3) returning id`,
      [ws, engagementId, status],
    );
    return r.rows[0].id;
  }

  it("refuses a direct database approval with no signed-in person", async () => {
    const id = await finding();
    await expect(db.query(`update public.findings set review_status = 'approved' where id = $1`, [id])).rejects.toThrow(
      /named_approver_required/,
    );
    await expect(finding("approved")).rejects.toThrow(/named_approver_required/);
  });

  it("stamps the signed-in approver when the caller left it empty", async () => {
    const id = await finding();
    await asFounder((tx) => tx.query(`update public.findings set review_status = 'approved' where id = $1`, [id]));
    const { rows } = await db.query<{ reviewed_by: string }>(`select reviewed_by from public.findings where id = $1`, [id]);
    expect(rows[0].reviewed_by).toBe(founder);
  });

  it("does not treat edits to an already-approved row as a new approval", async () => {
    const id = await finding();
    await asFounder((tx) => tx.query(`update public.findings set review_status = 'approved' where id = $1`, [id]));
    await db.query(`update public.findings set statement = 'edited by maintenance' where id = $1`, [id]);
  });

  it("guards opportunities, report sections and proposal snapshots too", async () => {
    const opp = await db.query<{ id: string }>(
      `insert into public.opportunities (workspace_id, engagement_id, title) values ($1, $2, 'o') returning id`,
      [ws, engagementId],
    ).catch(() => null);
    if (opp) {
      await expect(db.query(`update public.opportunities set status = 'selected' where id = $1`, [opp.rows[0].id])).rejects.toThrow(
        /named_approver_required/,
      );
    }
    const triggers = await db.query<{ tgname: string }>(
      `select tgname from pg_trigger where tgname like '%named_approver' order by 1`,
    );
    expect(triggers.rows.map((r) => r.tgname)).toEqual([
      "findings_named_approver",
      "opportunities_named_approver",
      "proposal_snapshots_named_approver",
      "proposals_named_approver",
      "report_sections_named_approver",
      "reports_named_approver",
    ]);
  });
});

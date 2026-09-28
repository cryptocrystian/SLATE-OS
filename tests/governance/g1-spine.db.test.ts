/**
 * GovernanceOS G1 database invariants (docs/72 §4.7).
 * Layer: GOVERNANCEOS MODULE.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { as, createTestDb, createUser, createWorkspace, grantMembership } from "../helpers/pglite-db";

let db: PGlite;
let ws: string;
let wsB: string;
let founder: string; // workspace owner
let operator: string; // workspace operator
let viewer: string; // workspace viewer
let otherWsMember: string;
let accountId: string;
let engagementId: string;

const asUser = <T>(userId: string, fn: (tx: Transaction) => Promise<T>, commit = true) =>
  as(db, { kind: "authenticated", userId }, fn, { commit });

async function createProgram(
  userId: string,
  fields: Record<string, unknown>,
): Promise<string> {
  const id = crypto.randomUUID();
  const cols = { id, workspace_id: ws, created_by: userId, ...fields };
  const keys = Object.keys(cols);
  await asUser(userId, (tx) =>
    tx.query(
      `insert into public.governance_programs (${keys.join(",")}) values (${keys.map((_, i) => `$${i + 1}`).join(",")})`,
      Object.values(cols),
    ),
  );
  return id;
}

beforeAll(async () => {
  db = await createTestDb({
    beforeApply: async (n, d) => {
      if (n !== 23) return;
      const { rows } = await d.query<{ id: string }>(`select id from public.workspaces limit 1`);
      ws = rows[0].id;
      wsB = await createWorkspace(d, "Other");
      founder = await createUser(d, "founder@saipienlabs.com");
      operator = await createUser(d, "operator@saipienlabs.com");
      viewer = await createUser(d, "viewer@saipienlabs.com");
      otherWsMember = await createUser(d, "b@example.com");
      await grantMembership(d, ws, founder, "owner");
      await grantMembership(d, ws, operator, "operator");
      await grantMembership(d, ws, viewer, "viewer");
      await grantMembership(d, wsB, otherWsMember, "operator");
    },
  });
  const acct = await db.query<{ id: string }>(
    `insert into public.accounts (workspace_id, name) values ($1, 'Client Co') returning id`,
    [ws],
  );
  accountId = acct.rows[0].id;
  const eng = await db.query<{ id: string }>(
    `insert into public.engagements (workspace_id, account_id, name) values ($1, $2, 'Baseline sprint') returning id`,
    [ws, accountId],
  );
  engagementId = eng.rows[0].id;
});

describe("program ownership (program_kind)", () => {
  it("client requires an account; internal forbids one; venture requires lineage", async () => {
    await expect(createProgram(founder, { program_kind: "client", name: "No account" })).rejects.toThrow(
      /governance_programs_kind_owner/,
    );
    await expect(
      createProgram(founder, { program_kind: "internal", name: "Fake acct", account_id: accountId }),
    ).rejects.toThrow(/governance_programs_kind_owner/);
    await expect(createProgram(founder, { program_kind: "venture", name: "No lineage" })).rejects.toThrow(
      /governance_programs_kind_owner/,
    );
    const v = await createProgram(founder, {
      program_kind: "venture",
      name: "Venture X",
      venture_source_system: "ventureos",
      venture_source_id: "vx-001",
    });
    expect(v).toBeTruthy();
  });

  it("only workspace owners/operators can create programs, as themselves", async () => {
    await expect(createProgram(viewer, { program_kind: "internal", name: "Nope" })).rejects.toThrow(
      /row-level security/,
    );
    await expect(
      asUser(operator, (tx) =>
        tx.query(
          `insert into public.governance_programs (workspace_id, program_kind, name, created_by) values ($1, 'internal', 'spoof', $2)`,
          [ws, founder],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("rejects a client account from another workspace", async () => {
    const other = await db.query<{ id: string }>(
      `insert into public.accounts (workspace_id, name) values ($1, 'B acct') returning id`,
      [wsB],
    );
    await expect(
      createProgram(founder, { program_kind: "client", name: "X-ws", account_id: other.rows[0].id }),
    ).rejects.toThrow(/governance_cross_workspace_reference|row-level security/);
  });
});

describe("program access", () => {
  let internalId: string;
  let clientId: string;

  beforeAll(async () => {
    internalId = await createProgram(founder, { program_kind: "internal", name: "Saipien Internal" });
    clientId = await createProgram(founder, { program_kind: "client", name: "Client Program", account_id: accountId });
  });

  it("internal programs: operators are admins, viewers read-only", async () => {
    const role = await asUser(operator, async (tx) =>
      (await tx.query<{ r: string }>(`select public.governance_program_role($1) r`, [internalId])).rows[0].r,
    );
    expect(role).toBe("program_admin");
    const vRole = await asUser(viewer, async (tx) =>
      (await tx.query<{ r: string }>(`select public.governance_program_role($1) r`, [internalId])).rows[0].r,
    );
    expect(vRole).toBe("viewer");
    await expect(
      asUser(viewer, (tx) =>
        tx.query(`update public.governance_programs set description = 'x' where id = $1 returning id`, [internalId]).then(
          (r) => {
            if (r.rows.length === 0) throw new Error("row-level security: no rows updated");
          },
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("client programs: creator is program_admin; other workspace operators cannot see it", async () => {
    const founderSees = await asUser(founder, async (tx) =>
      (await tx.query(`select 1 from public.governance_programs where id = $1`, [clientId])).rows.length,
    );
    expect(founderSees).toBe(1);
    const operatorSees = await asUser(operator, async (tx) =>
      (await tx.query(`select 1 from public.governance_programs where id = $1`, [clientId])).rows.length,
    );
    expect(operatorSees, "client program needs explicit membership").toBe(0);
  });

  it("another workspace's member sees nothing", async () => {
    const n = await asUser(otherWsMember, async (tx) =>
      (await tx.query(`select 1 from public.governance_programs`)).rows.length,
    );
    expect(n).toBe(0);
  });

  it("status machine: draft→active→paused→active→archived; archived is terminal; kind immutable", async () => {
    const id = await createProgram(founder, { program_kind: "internal", name: "Lifecycle" });
    await expect(
      asUser(founder, (tx) => tx.query(`update public.governance_programs set status = 'paused' where id = $1`, [id])),
    ).rejects.toThrow(/invalid_transition/);
    for (const s of ["active", "paused", "active", "archived"]) {
      await asUser(founder, (tx) => tx.query(`update public.governance_programs set status = $2 where id = $1`, [id, s]));
    }
    const { rows } = await db.query<{ started_at: string; archived_at: string }>(
      `select started_at, archived_at from public.governance_programs where id = $1`,
      [id],
    );
    expect(rows[0].started_at).toBeTruthy();
    expect(rows[0].archived_at).toBeTruthy();
    await expect(
      asUser(founder, (tx) => tx.query(`update public.governance_programs set name = 'x' where id = $1`, [id])),
    ).rejects.toThrow(/governance_program_archived/);
    await expect(
      asUser(founder, (tx) =>
        tx.query(`update public.governance_programs set program_kind = 'venture' where id = $1`, [internalId]),
      ),
    ).rejects.toThrow(/immutable_field/);
  });

  it("programs cannot be deleted by anyone in the app", async () => {
    await expect(
      asUser(founder, (tx) => tx.query(`delete from public.governance_programs where id = $1`, [internalId])),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("PRD §21 acceptance: engagement link, assets, durability", () => {
  let programId: string;
  let linkId: string;

  beforeAll(async () => {
    programId = await createProgram(founder, { program_kind: "client", name: "Client Co Governance", account_id: accountId });
  });

  it("links an engagement, snapshots it, and places a retention hold", async () => {
    const r = await asUser(founder, (tx) =>
      tx.query<{ id: string; engagement_name_snapshot: string }>(
        `insert into public.governance_program_engagements (governance_program_id, workspace_id, engagement_id, engagement_ref, engagement_name_snapshot, linked_by)
         values ($1, $2, $3, $3, 'ignored', $4) returning id, engagement_name_snapshot`,
        [programId, ws, engagementId, founder],
      ),
    );
    linkId = r.rows[0].id;
    expect(r.rows[0].engagement_name_snapshot).toBe("Baseline sprint");
    const holds = await db.query(
      `select 1 from public.retention_holds where entity_id = $1 and held_by_module = 'governanceos' and released_at is null`,
      [engagementId],
    );
    expect(holds.rows.length).toBe(1);
  });

  it("registers an engagement-sourced asset and a non-engagement asset", async () => {
    await asUser(founder, (tx) =>
      tx.query(
        `insert into public.governed_assets (workspace_id, governance_program_id, asset_type, name, source_system, source_entity_type, source_entity_id, created_by)
         values ($1, $2, 'use_case', 'Invoice triage', 'consultos', 'engagement', $3, $4),
                ($1, $2, 'agent', 'Support agent', 'runtime', 'agent', 'rt-agent-42', $4)`,
        [ws, programId, engagementId, founder],
      ),
    );
    const { rows } = await db.query(`select count(*)::int n from public.governed_assets where governance_program_id = $1`, [
      programId,
    ]);
    expect((rows[0] as { n: number }).n).toBe(2);
  });

  it("lineage is unique per program (idempotent registration key)", async () => {
    await expect(
      asUser(founder, (tx) =>
        tx.query(
          `insert into public.governed_assets (workspace_id, governance_program_id, asset_type, name, source_system, source_entity_type, source_entity_id)
           values ($1, $2, 'agent', 'dup', 'runtime', 'agent', 'rt-agent-42')`,
          [ws, programId],
        ),
      ),
    ).rejects.toThrow(/governed_assets_lineage_uniq/);
  });

  it("a linked engagement cannot be deleted; completing it changes nothing", async () => {
    await db.query(`update public.engagements set status = 'completed' where id = $1`, [engagementId]);
    await expect(db.query(`delete from public.engagements where id = $1`, [engagementId])).rejects.toThrow(
      /retention_hold_active/,
    );
  });

  it("unlink releases the hold; delete then succeeds; program, assets and link history survive", async () => {
    await asUser(founder, (tx) =>
      tx.query(
        `update public.governance_program_engagements set unlinked_at = now(), unlinked_by = $2, unlink_reason = 'sprint closed' where id = $1`,
        [linkId, founder],
      ),
    );
    await db.query(`delete from public.engagements where id = $1`, [engagementId]);
    const link = await db.query<{ engagement_id: string | null; engagement_ref: string; engagement_name_snapshot: string }>(
      `select engagement_id, engagement_ref, engagement_name_snapshot from public.governance_program_engagements where id = $1`,
      [linkId],
    );
    expect(link.rows[0].engagement_id).toBeNull();
    expect(link.rows[0].engagement_ref).toBe(engagementId);
    expect(link.rows[0].engagement_name_snapshot).toBe("Baseline sprint");
    const assets = await db.query(`select 1 from public.governed_assets where governance_program_id = $1`, [programId]);
    expect(assets.rows.length).toBe(2);
  });

  it("link rows are never deleted and unlink happens once", async () => {
    await expect(
      asUser(founder, (tx) => tx.query(`delete from public.governance_program_engagements where id = $1`, [linkId])),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(founder, (tx) =>
        tx.query(`update public.governance_program_engagements set unlinked_at = now() where id = $1`, [linkId]),
      ),
    ).rejects.toThrow(/already_unlinked/);
  });
});

describe("asset lifecycle", () => {
  let programId: string;
  let assetId: string;

  beforeAll(async () => {
    programId = await createProgram(founder, { program_kind: "internal", name: "Lifecycle program" });
    const r = await asUser(founder, (tx) =>
      tx.query<{ id: string }>(
        `insert into public.governed_assets (workspace_id, governance_program_id, asset_type, name) values ($1, $2, 'ai_system', 'SLATE pipeline') returning id`,
        [ws, programId],
      ),
    );
    assetId = r.rows[0].id;
  });

  it("`approved` is unreachable in G1", async () => {
    await expect(
      asUser(founder, (tx) => tx.query(`select public.governance_transition_asset($1, 'approved', 'try')`, [assetId])),
    ).rejects.toThrow(/invalid_transition|lifecycle_status_check/);
    await expect(
      asUser(founder, (tx) =>
        tx.query(
          `insert into public.governed_assets (workspace_id, governance_program_id, asset_type, name, lifecycle_status) values ($1, $2, 'model', 'x', 'approved')`,
          [ws, programId],
        ),
      ),
    ).rejects.toThrow(/lifecycle_status_check/);
  });

  it("transitions require a reason and are recorded append-only by the database", async () => {
    await expect(
      asUser(founder, (tx) => tx.query(`select public.governance_transition_asset($1, 'active', '')`, [assetId])),
    ).rejects.toThrow(/governance_reason_required/);
    await asUser(founder, (tx) =>
      tx.query(`select public.governance_transition_asset($1, 'active', 'Already in production')`, [assetId]),
    );
    const { rows } = await db.query<{ from_status: string | null; to_status: string; reason: string | null; changed_by: string }>(
      `select from_status, to_status, reason, changed_by from public.governed_asset_lifecycle_events where governed_asset_id = $1 order by changed_at`,
      [assetId],
    );
    expect(rows.map((r) => [r.from_status, r.to_status])).toEqual([
      [null, "proposed"],
      ["proposed", "active"],
    ]);
    expect(rows[1].reason).toBe("Already in production");
    expect(rows[1].changed_by).toBe(founder);
    await expect(
      asUser(founder, (tx) =>
        tx.query(
          `insert into public.governed_asset_lifecycle_events (workspace_id, governance_program_id, governed_asset_id, to_status) values ($1, $2, $3, 'retired')`,
          [ws, programId, assetId],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("invalid transitions are refused; retired is terminal", async () => {
    await expect(
      asUser(founder, (tx) => tx.query(`select public.governance_transition_asset($1, 'proposed', 'x')`, [assetId])),
    ).rejects.toThrow(/invalid_transition/);
    await asUser(founder, (tx) => tx.query(`select public.governance_transition_asset($1, 'retired', 'Decommissioned')`, [assetId]));
    await expect(
      asUser(founder, (tx) => tx.query(`update public.governed_assets set name = 'x' where id = $1`, [assetId])),
    ).rejects.toThrow(/governed_asset_retired/);
    await expect(
      asUser(founder, (tx) => tx.query(`delete from public.governed_assets where id = $1`, [assetId])),
    ).rejects.toThrow(/permission denied/);
  });

  it("parent must be in the same program", async () => {
    const other = await createProgram(founder, { program_kind: "internal", name: "Other program" });
    const p = await asUser(founder, (tx) =>
      tx.query<{ id: string }>(
        `insert into public.governed_assets (workspace_id, governance_program_id, asset_type, name) values ($1, $2, 'ai_system', 'Parent') returning id`,
        [ws, other],
      ),
    );
    await expect(
      asUser(founder, (tx) =>
        tx.query(
          `insert into public.governed_assets (workspace_id, governance_program_id, asset_type, name, parent_governed_asset_id) values ($1, $2, 'model', 'Child', $3)`,
          [ws, programId, p.rows[0].id],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
  });
});

describe("policy versioning (immutable, superseding)", () => {
  let programId: string;
  let policyId: string;

  async function newDraft(version: number, statement: string, supersedes?: string) {
    const r = await asUser(founder, (tx) =>
      tx.query<{ id: string }>(
        `insert into public.governance_policy_versions (workspace_id, governance_program_id, governance_policy_id, version, statement, supersedes_version_id, created_by)
         values ($1, $2, $3, $4, $5, $6, $7) returning id`,
        [ws, programId, policyId, version, statement, supersedes ?? null, founder],
      ),
    );
    return r.rows[0].id;
  }

  beforeAll(async () => {
    programId = await createProgram(founder, { program_kind: "internal", name: "Policy program" });
    const r = await asUser(founder, (tx) =>
      tx.query<{ id: string }>(
        `insert into public.governance_policies (workspace_id, governance_program_id, policy_key, name, policy_domain, created_by)
         values ($1, $2, 'approved-providers', 'Approved AI providers', 'model', $3) returning id`,
        [ws, programId, founder],
      ),
    );
    policyId = r.rows[0].id;
  });

  it("activation must go through the RPC; active content is immutable; supersede is atomic", async () => {
    const v1 = await newDraft(1, "Only OpenAI API and Anthropic may process client data.");
    await expect(
      asUser(founder, (tx) =>
        tx.query(`update public.governance_policy_versions set status = 'active', activated_at = now() where id = $1`, [v1]),
      ),
    ).rejects.toThrow(/activation_requires_rpc/);

    await asUser(founder, (tx) => tx.query(`select public.governance_activate_policy_version($1, 'Ratified')`, [v1]));
    await expect(
      asUser(founder, (tx) =>
        tx.query(`update public.governance_policy_versions set statement = 'edited' where id = $1`, [v1]),
      ),
    ).rejects.toThrow(/governance_policy_version_immutable/);
    await expect(
      asUser(founder, (tx) => tx.query(`delete from public.governance_policy_versions where id = $1`, [v1])),
    ).rejects.toThrow(/governance_policy_version_immutable/);

    const v2 = await newDraft(2, "Only OpenAI API, Anthropic and Vercel AI Gateway may process client data.", v1);
    await asUser(founder, (tx) => tx.query(`select public.governance_activate_policy_version($1, 'Gateway approved')`, [v2]));
    const { rows } = await db.query<{ version: number; status: string }>(
      `select version, status from public.governance_policy_versions where governance_policy_id = $1 order by version`,
      [policyId],
    );
    expect(rows).toEqual([
      { version: 1, status: "superseded" },
      { version: 2, status: "active" },
    ]);
    // idempotent retry
    await asUser(founder, (tx) => tx.query(`select public.governance_activate_policy_version($1, 'retry')`, [v2]));
  });

  it("G1 accepts only advisory activation", async () => {
    await expect(
      asUser(founder, (tx) =>
        tx.query(
          `insert into public.governance_policy_versions (workspace_id, governance_program_id, governance_policy_id, version, statement, activation_mode)
           values ($1, $2, $3, 9, 'x', 'enforced')`,
          [ws, programId, policyId],
        ),
      ),
    ).rejects.toThrow(/activation_mode_check/);
  });

  it("viewers cannot activate", async () => {
    const v3 = await newDraft(3, "draft three", undefined);
    await expect(
      asUser(viewer, (tx) => tx.query(`select public.governance_activate_policy_version($1, 'x')`, [v3])),
    ).rejects.toThrow(/governance_forbidden|not_found/);
  });
});

describe("governance activity on the platform table", () => {
  it("governance rows must be module=governanceos, never carry engagement_id, and are program-scoped", async () => {
    const clientId = await createProgram(founder, { program_kind: "client", name: "Scoped", account_id: accountId });
    await expect(
      asUser(founder, (tx) =>
        tx.query(
          `insert into public.activity_events (workspace_id, event_type, entity_type, title, governance_program_id) values ($1, 'x', 'x', 'x', $2)`,
          [ws, clientId],
        ),
      ),
    ).rejects.toThrow(/activity_events_governance_module_check/);
    await asUser(founder, (tx) =>
      tx.query(
        `insert into public.activity_events (workspace_id, event_type, entity_type, title, governance_program_id, module)
         values ($1, 'governance_program_created', 'governance_program', 'Program created', $2, 'governanceos')`,
        [ws, clientId],
      ),
    );
    const operatorSees = await asUser(operator, async (tx) =>
      (await tx.query(`select 1 from public.activity_events where governance_program_id = $1`, [clientId])).rows.length,
    );
    expect(operatorSees, "non-member operator cannot read client program activity").toBe(0);
    const founderSees = await asUser(founder, async (tx) =>
      (await tx.query(`select 1 from public.activity_events where governance_program_id = $1`, [clientId])).rows.length,
    );
    expect(founderSees).toBe(1);
  });
});

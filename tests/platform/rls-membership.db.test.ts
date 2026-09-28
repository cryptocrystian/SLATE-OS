/**
 * Platform G0 negative security tests (docs/72 §3.6 tests 1–5).
 * Layer: SLATE PLATFORM.
 */
import { beforeAll, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import {
  as,
  createTestDb,
  createUser,
  createWorkspace,
  grantMembership,
  publicTables,
} from "../helpers/pglite-db";

async function seedWorkspaceData(db: PGlite, workspaceId: string, label: string) {
  const acct = await db.query<{ id: string }>(
    `insert into public.accounts (workspace_id, name) values ($1, $2) returning id`,
    [workspaceId, `${label} Co`],
  );
  const eng = await db.query<{ id: string }>(
    `insert into public.engagements (workspace_id, account_id, name) values ($1, $2, $3) returning id`,
    [workspaceId, acct.rows[0].id, `${label} engagement`],
  );
  await db.query(
    `insert into public.findings (workspace_id, engagement_id, statement) values ($1, $2, $3)`,
    [workspaceId, eng.rows[0].id, `${label} finding`],
  );
  await db.query(
    `insert into public.contacts (account_id, full_name) values ($1, $2)`,
    [acct.rows[0].id, `${label} contact`],
  );
  await db.query(
    `insert into public.activity_events (workspace_id, event_type, entity_type, title, engagement_id)
     values ($1, 'engagement_created', 'engagement', $2, $3)`,
    [workspaceId, `${label} created`, eng.rows[0].id],
  );
  return { accountId: acct.rows[0].id, engagementId: eng.rows[0].id };
}

async function count(db: PGlite, persona: Parameters<typeof as>[1], table: string) {
  return as(db, persona, async (tx) => {
    const { rows } = await tx.query<{ n: number }>(`select count(*)::int as n from public.${table}`);
    return rows[0].n;
  });
}

describe("pre-G0 baseline (documents the exposure 0023 closes)", () => {
  it("any authenticated session reads singleton-workspace data before 0023", async () => {
    const db = await createTestDb({ upTo: 21 });
    const { rows } = await db.query<{ id: string }>(`select id from public.workspaces limit 1`);
    await seedWorkspaceData(db, rows[0].id, "A");
    const stranger = await createUser(db, "stranger@example.com");
    expect(await count(db, { kind: "authenticated", userId: stranger }, "findings")).toBe(1);
    expect(await count(db, { kind: "authenticated", userId: stranger }, "scorecard_submissions")).toBe(0);
  });
});

describe("0023 precondition", () => {
  it("refuses to apply when no active membership exists", async () => {
    await expect(createTestDb()).rejects.toThrow(/0023 precondition failed/);
  });
});

describe("membership RLS (after 0022–0025)", () => {
  let db: PGlite;
  let wsA: string;
  let wsB: string;
  let ownerA: string;
  let operatorA: string;
  let memberB: string;
  let stranger: string;

  beforeAll(async () => {
    // Model the real apply order: 0022 → grant memberships → 0023+.
    db = await createTestDb({
      beforeApply: async (n, d) => {
        if (n !== 23) return;
        const { rows } = await d.query<{ id: string }>(`select id from public.workspaces limit 1`);
        wsA = rows[0].id;
        wsB = await createWorkspace(d, "Other Workspace");
        ownerA = await createUser(d, "owner@saipienlabs.com");
        operatorA = await createUser(d, "operator@saipienlabs.com");
        memberB = await createUser(d, "member-b@example.com");
        stranger = await createUser(d, "stranger@example.com");
        await grantMembership(d, wsA, ownerA, "owner");
        await grantMembership(d, wsA, operatorA, "operator");
        await grantMembership(d, wsB, memberB, "operator");
      },
    });

    await seedWorkspaceData(db, wsA, "A");
    await seedWorkspaceData(db, wsB, "B");
    await db.query(`insert into public.scorecard_submissions default values`).catch(() => undefined);
  });

  it("1. anon reads zero rows from every public table", async () => {
    for (const t of await publicTables(db)) {
      const n = await as(db, { kind: "anon" }, async (tx) => {
        try {
          const { rows } = await tx.query<{ n: number }>(`select count(*)::int as n from public.${t}`);
          return rows[0].n;
        } catch {
          return 0; // permission denied is also a pass
        }
      });
      expect(n, `anon rows in ${t}`).toBe(0);
    }
  });

  it("2. authenticated non-member reads zero rows (except their own profile)", async () => {
    for (const t of await publicTables(db)) {
      const n = await count(db, { kind: "authenticated", userId: stranger }, t);
      expect(n, `stranger rows in ${t}`).toBe(t === "profiles" ? 1 : 0);
    }
  });

  it("2b. authenticated non-member cannot insert workspace data", async () => {
    await expect(
      as(db, { kind: "authenticated", userId: stranger }, (tx) =>
        tx.query(`insert into public.accounts (workspace_id, name) values ($1, 'x')`, [wsA]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("3. workspace B member cannot read or write workspace A", async () => {
    const persona = { kind: "authenticated" as const, userId: memberB };
    const visible = await as(db, persona, async (tx) => {
      const { rows } = await tx.query<{ workspace_id: string }>(`select workspace_id from public.findings`);
      return rows.map((r) => r.workspace_id);
    });
    expect(visible.length).toBe(1);
    expect(visible.every((w) => w === wsB)).toBe(true);
    await expect(
      as(db, persona, (tx) =>
        tx.query(`insert into public.accounts (workspace_id, name) values ($1, 'x')`, [wsA]),
      ),
    ).rejects.toThrow(/row-level security/);
    // contacts authorise through their parent account
    expect(await count(db, persona, "contacts")).toBe(1);
  });

  it("3b. workspace A operator sees exactly workspace A data", async () => {
    const persona = { kind: "authenticated" as const, userId: operatorA };
    expect(await count(db, persona, "findings")).toBe(1);
    expect(await count(db, persona, "workspaces")).toBe(1);
    expect(await count(db, persona, "profiles")).toBe(2); // owner + self
  });

  it("4. only owners can write memberships", async () => {
    await expect(
      as(db, { kind: "authenticated", userId: operatorA }, (tx) =>
        tx.query(
          `insert into public.workspace_memberships (workspace_id, profile_id, role) values ($1, $2, 'operator')`,
          [wsA, stranger],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      as(db, { kind: "authenticated", userId: memberB }, (tx) =>
        tx.query(
          `insert into public.workspace_memberships (workspace_id, profile_id, role) values ($1, $2, 'owner')`,
          [wsA, memberB],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    const ok = await as(db, { kind: "authenticated", userId: ownerA }, async (tx) => {
      await tx.query(
        `insert into public.workspace_memberships (workspace_id, profile_id, role) values ($1, $2, 'viewer')`,
        [wsA, stranger],
      );
      return true;
    });
    expect(ok).toBe(true);
  });

  it("4b. suspended membership grants nothing", async () => {
    await db.query(
      `update public.workspace_memberships set status = 'suspended' where profile_id = $1`,
      [operatorA],
    );
    expect(await count(db, { kind: "authenticated", userId: operatorA }, "findings")).toBe(0);
    await db.query(
      `update public.workspace_memberships set status = 'active' where profile_id = $1`,
      [operatorA],
    );
  });

  it("5. membership helpers take no user argument and anon cannot execute them", async () => {
    const { rows } = await db.query<{ proname: string; args: string }>(
      `select p.proname, pg_get_function_identity_arguments(p.oid) as args
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'public'
          and p.proname in ('is_workspace_member','has_workspace_role','has_any_workspace_membership','shares_workspace_with')`,
    );
    expect(rows.find((r) => r.proname === "is_workspace_member")?.args).toBe("ws uuid");
    expect(rows.find((r) => r.proname === "has_workspace_role")?.args).toBe("ws uuid, roles text[]");
    await expect(
      as(db, { kind: "anon" }, (tx) => tx.query(`select public.is_workspace_member($1)`, [wsA])),
    ).rejects.toThrow(/permission denied/);
  });
});

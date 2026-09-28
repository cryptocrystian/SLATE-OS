/**
 * Platform G0 lifecycle-durability tests (docs/72 §3.6 test 6; docs/75).
 * Canon rule: no lifecycle event in one module may silently destroy another
 * module's history.
 * Layer: SLATE PLATFORM.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { PGlite } from "@electric-sql/pglite";
import { as, createTestDb, createUser, grantMembership } from "../helpers/pglite-db";

let db: PGlite;
let ws: string;
let operator: string;

async function seedEngagement(label: string) {
  const acct = await db.query<{ id: string }>(
    `insert into public.accounts (workspace_id, name) values ($1, $2) returning id`,
    [ws, `${label} Co`],
  );
  const eng = await db.query<{ id: string }>(
    `insert into public.engagements (workspace_id, account_id, name) values ($1, $2, $3) returning id`,
    [ws, acct.rows[0].id, `${label} engagement`],
  );
  const engagementId = eng.rows[0].id;
  await db.query(
    `insert into public.activity_events (workspace_id, event_type, entity_type, title, engagement_id)
     values ($1, 'engagement_created', 'engagement', 'created', $2)`,
    [ws, engagementId],
  );
  await db.query(
    `insert into public.notes (workspace_id, entity_type, entity_id, body, engagement_id)
     values ($1, 'engagement', $2, 'a note', $2)`,
    [ws, engagementId],
  );
  await db.query(
    `insert into public.ai_synthesis_runs (workspace_id, engagement_id, run_type) values ($1, $2, 'findings_draft')`,
    [ws, engagementId],
  );
  await db.query(
    `insert into public.findings (workspace_id, engagement_id, statement) values ($1, $2, 'f')`,
    [ws, engagementId],
  );
  return { accountId: acct.rows[0].id, engagementId };
}

beforeEach(async () => {
  db = await createTestDb({
    beforeApply: async (n, d) => {
      if (n !== 23) return;
      const { rows } = await d.query<{ id: string }>(`select id from public.workspaces limit 1`);
      ws = rows[0].id;
      operator = await createUser(d, "operator@saipienlabs.com");
      await grantMembership(d, ws, operator, "operator");
    },
  });
});

describe("audit/provenance survives engagement deletion", () => {
  it("activity_events, notes and ai_synthesis_runs keep engagement_ref after delete", async () => {
    const { engagementId } = await seedEngagement("X");
    await db.query(`delete from public.engagements where id = $1`, [engagementId]);

    for (const table of ["activity_events", "notes", "ai_synthesis_runs"]) {
      const { rows } = await db.query<{ engagement_id: string | null; engagement_ref: string }>(
        `select engagement_id, engagement_ref from public.${table} where engagement_ref = $1`,
        [engagementId],
      );
      expect(rows.length, `${table} survives`).toBe(1);
      expect(rows[0].engagement_id).toBeNull();
    }
    // Engagement-private ConsultOS data still cascades (unchanged behaviour).
    const { rows } = await db.query(`select 1 from public.findings where engagement_id = $1`, [engagementId]);
    expect(rows.length).toBe(0);
  });

  it("new inserts populate *_ref automatically (no ConsultOS code change)", async () => {
    const { engagementId } = await seedEngagement("Y");
    const { rows } = await db.query<{ engagement_ref: string; module: string }>(
      `select engagement_ref, module from public.activity_events where engagement_id = $1`,
      [engagementId],
    );
    expect(rows[0].engagement_ref).toBe(engagementId);
    expect(rows[0].module).toBe("consultos");
  });

  it("ai_synthesis_runs accepts non-engagement subjects but not subject-less rows", async () => {
    await db.query(
      `insert into public.ai_synthesis_runs (workspace_id, run_type, module, subject_type, subject_id)
       values ($1, 'governance_mapping', 'governanceos', 'governance_program', gen_random_uuid())`,
      [ws],
    );
    await expect(
      db.query(`insert into public.ai_synthesis_runs (workspace_id, run_type) values ($1, 'orphan')`, [ws]),
    ).rejects.toThrow(/ai_synthesis_runs_subject_check/);
  });

  it("module vocabulary is enforced", async () => {
    await expect(
      db.query(
        `insert into public.activity_events (workspace_id, event_type, entity_type, title, module)
         values ($1, 'x', 'x', 'x', 'advisoryops')`,
        [ws],
      ),
    ).rejects.toThrow(/activity_events_module_check/);
  });
});

describe("retention holds", () => {
  async function placeHold(entityType: string, entityId: string, holderRef = "program-1") {
    return as(
      db,
      { kind: "authenticated", userId: operator },
      async (tx) => {
        const { rows } = await tx.query<{ id: string }>(
          `insert into public.retention_holds (workspace_id, entity_type, entity_id, held_by_module, holder_ref, reason)
           values ($1, $2, $3, 'governanceos', $4, 'linked to governance program') returning id`,
          [ws, entityType, entityId, holderRef],
        );
        return rows[0].id;
      },
      { commit: true },
    );
  }

  it("blocks deleting a held engagement, even as superuser", async () => {
    const { engagementId } = await seedEngagement("H");
    await placeHold("engagement", engagementId);
    await expect(db.query(`delete from public.engagements where id = $1`, [engagementId])).rejects.toThrow(
      /retention_hold_active/,
    );
    const { rows } = await db.query(`select 1 from public.findings where engagement_id = $1`, [engagementId]);
    expect(rows.length, "nothing cascaded").toBe(1);
  });

  it("released hold allows the delete; hold history remains", async () => {
    const { engagementId } = await seedEngagement("R");
    const holdId = await placeHold("engagement", engagementId);
    await as(
      db,
      { kind: "authenticated", userId: operator },
      (tx) =>
        tx.query(
          `update public.retention_holds set released_at = now(), released_by = $2, release_reason = 'unlinked' where id = $1`,
          [holdId, operator],
        ),
      { commit: true },
    );
    await db.query(`delete from public.engagements where id = $1`, [engagementId]);
    const { rows } = await db.query(`select released_at from public.retention_holds where id = $1`, [holdId]);
    expect(rows.length).toBe(1);
  });

  it("holds are immutable except for a single release, and cannot be deleted by members", async () => {
    const { engagementId } = await seedEngagement("I");
    const holdId = await placeHold("engagement", engagementId);
    const persona = { kind: "authenticated" as const, userId: operator };
    await expect(
      as(db, persona, (tx) => tx.query(`update public.retention_holds set reason = 'changed' where id = $1`, [holdId])),
    ).rejects.toThrow(/retention_hold_immutable/);
    // No DELETE privilege for authenticated at all (0024) — refused, not filtered.
    await expect(
      as(db, persona, (tx) => tx.query(`delete from public.retention_holds where id = $1`, [holdId])),
    ).rejects.toThrow(/permission denied/);
  });

  it("guards accounts, contacts and leads too", async () => {
    const { accountId } = await seedEngagement("A");
    const contact = await db.query<{ id: string }>(
      `insert into public.contacts (account_id, full_name) values ($1, 'c') returning id`,
      [accountId],
    );
    await placeHold("contact", contact.rows[0].id);
    await expect(db.query(`delete from public.contacts where id = $1`, [contact.rows[0].id])).rejects.toThrow(
      /retention_hold_active/,
    );
  });

  it("non-members cannot place holds", async () => {
    const { engagementId } = await seedEngagement("N");
    const stranger = await createUser(db, "stranger@example.com");
    await expect(
      as(db, { kind: "authenticated", userId: stranger }, (tx) =>
        tx.query(
          `insert into public.retention_holds (workspace_id, entity_type, entity_id, held_by_module, holder_ref, reason)
           values ($1, 'engagement', $2, 'governanceos', 'p', 'r')`,
          [ws, engagementId],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("durable file store", () => {
  it("stored_files requires a sha256 and is member-readable only", async () => {
    await expect(
      db.query(
        `insert into public.stored_files (workspace_id, owner_module, path, sha256, size_bytes, mime_type)
         values ($1, 'governanceos', 'a/b.pdf', 'not-a-hash', 1, 'application/pdf')`,
        [ws],
      ),
    ).rejects.toThrow(/stored_files_sha256_check/);
    await db.query(
      `insert into public.stored_files (workspace_id, owner_module, path, sha256, size_bytes, mime_type)
       values ($1, 'governanceos', 'a/b.pdf', $2, 1, 'application/pdf')`,
      [ws, "a".repeat(64)],
    );
    const member = await as(db, { kind: "authenticated", userId: operator }, async (tx) =>
      (await tx.query(`select 1 from public.stored_files`)).rows.length,
    );
    expect(member).toBe(1);
    await expect(
      as(db, { kind: "authenticated", userId: operator }, (tx) =>
        tx.query(
          `insert into public.stored_files (workspace_id, owner_module, path, sha256, size_bytes, mime_type)
           values ($1, 'governanceos', 'c.pdf', $2, 1, 'application/pdf')`,
          [ws, "b".repeat(64)],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

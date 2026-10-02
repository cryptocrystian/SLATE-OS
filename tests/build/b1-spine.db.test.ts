/**
 * BuildOS B1 database invariants (docs/80 §11 B1 exit; docs/81).
 * Layer: BUILDOS MODULE.
 *
 * B1 exit criteria covered here:
 *   1. two projects with overlapping canon keys never cross-read;
 *   2. a lease expiry requeues the run as worker_lost;
 *   3. the claim RPC refuses dispatch when the judge family has no healthy account.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { PGlite, Transaction } from "@electric-sql/pglite";
import { as, createTestDb, createUser, createWorkspace, grantMembership } from "../helpers/pglite-db";

let db: PGlite;
let ws: string;
let wsB: string;
let owner: string;
let operator: string;
let viewer: string;
let otherOwner: string;
let engagementId: string;

const asUser = <T>(userId: string, fn: (tx: Transaction) => Promise<T>, commit = true) =>
  as(db, { kind: "authenticated", userId }, fn, { commit });

/** Run as the buildos_worker principal (D5), committed. */
async function asWorker<T>(fn: (tx: Transaction) => Promise<T>): Promise<T> {
  let out!: T;
  await db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claims', '', true)`);
    await tx.exec(`set local role buildos_worker`);
    out = await fn(tx);
  });
  return out;
}

const rpc = async <T = unknown>(tx: Transaction, sql: string, params: unknown[] = []) =>
  (await tx.query<{ r: T }>(`select ${sql} as r`, params)).rows[0]?.r;

// ---------- superuser fixtures ----------
let seq = 0;
async function project(
  workspace: string,
  key: string,
  fields: Record<string, unknown> = {},
  activate = true,
): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.build_projects (workspace_id, project_key, name, origin_kind, repo_url, stack_profile, canon_profile)
     values ($1, $2, $3, 'internal', 'https://github.com/example/' || $2, 'next-supabase', 'arxus-v2') returning id`,
    [workspace, key, `Project ${key}`],
  );
  const id = rows[0].id;
  const sets = Object.entries(fields);
  if (sets.length) {
    await db.query(
      `update public.build_projects set ${sets.map(([k], i) => `${k} = $${i + 2}`).join(", ")} where id = $1`,
      [id, ...sets.map(([, v]) => v)],
    );
  }
  if (activate) {
    await db.query(
      `update public.build_projects set readiness_checked_at = now(), status = 'ready' where id = $1`,
      [id],
    );
    await db.query(`update public.build_projects set status = 'active' where id = $1`, [id]);
  }
  return id;
}

async function item(projectId: string, key: string, bindings: string[] = [], status = "ready"): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.build_work_items (project_id, workspace_id, item_key, kind, canon_ref, title, bindings, status)
     select $1, p.workspace_id, $2, 'journey', upper($2), 'Item ' || $2, $3, $4 from public.build_projects p where p.id = $1
     returning id`,
    [projectId, key, bindings, status],
  );
  return rows[0].id;
}

async function account(workspace: string, family: string, fields: Record<string, unknown> = {}): Promise<string> {
  seq += 1;
  const f = { health: "healthy", billing_class: "subscription", max_concurrency: 4, ...fields };
  const { rows } = await db.query<{ id: string }>(
    `insert into public.build_provider_accounts (workspace_id, label, family, provider, billing_class, secret_ref, max_concurrency, health)
     values ($1, $2, $3, 'p-' || $3, $4, 'vault/' || $2, $5, $6) returning id`,
    [workspace, `${family}-${seq}`, family, f.billing_class, f.max_concurrency, f.health],
  );
  return rows[0].id;
}

async function worker(workspace: string, name: string, caps = ["next-supabase"]): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.build_workers (workspace_id, name, substrate, capabilities) values ($1, $2, 'test', $3) returning id`,
    [workspace, name, caps],
  );
  return rows[0].id;
}

type Lease = { run_id: string; run_key: string; work_item: { item_key: string }; project: { project_key: string } };
const claim = (w: string) => asWorker((tx) => rpc<Lease | null>(tx, `public.build_claim_run($1)`, [w]));
const finish = (w: string, run: string, verdict: string, cls: string | null, payload: object = {}) =>
  asWorker((tx) => rpc(tx, `public.build_finish_run($1, $2, $3, $4, $5)`, [w, run, verdict, cls, payload]));
const itemRow = async (id: string) =>
  (await db.query<Record<string, unknown>>(`select * from public.build_work_items where id = $1`, [id])).rows[0];
const drainRunning = async (projectId: string) => {
  // Finish any running runs in a project as accepted-equivalent noise (superuser cleanup between tests).
  await db.query(
    `update public.build_runs set lease_expires_at = now() - interval '1 second' where project_id = $1 and status = 'running'`,
    [projectId],
  );
};

beforeAll(async () => {
  db = await createTestDb({
    beforeApply: async (n, d) => {
      if (n !== 23) return;
      const { rows } = await d.query<{ id: string }>(`select id from public.workspaces limit 1`);
      ws = rows[0].id;
      wsB = await createWorkspace(d, "Other");
      owner = await createUser(d, "owner@saipienlabs.com");
      operator = await createUser(d, "operator@saipienlabs.com");
      viewer = await createUser(d, "viewer@saipienlabs.com");
      otherOwner = await createUser(d, "b@example.com");
      await grantMembership(d, ws, owner, "owner");
      await grantMembership(d, ws, operator, "operator");
      await grantMembership(d, ws, viewer, "viewer");
      await grantMembership(d, wsB, otherOwner, "owner");
    },
  });
  const acct = await db.query<{ id: string }>(
    `insert into public.accounts (workspace_id, name) values ($1, 'Client Co') returning id`,
    [ws],
  );
  const eng = await db.query<{ id: string }>(
    `insert into public.engagements (workspace_id, account_id, name) values ($1, $2, 'Build engagement') returning id`,
    [ws, acct.rows[0].id],
  );
  engagementId = eng.rows[0].id;
});

describe("projects", () => {
  it("must start in intake; ready needs a readiness check; closed is terminal", async () => {
    const id = await project(ws, "lifecycle", {}, false);
    await expect(db.query(`update public.build_projects set status = 'ready' where id = $1`, [id])).rejects.toThrow(
      /build_projects_ready_needs_readiness/,
    );
    await expect(db.query(`update public.build_projects set status = 'active' where id = $1`, [id])).rejects.toThrow(
      /invalid_transition/,
    );
    await db.query(`update public.build_projects set status = 'closed' where id = $1`, [id]);
    await expect(db.query(`update public.build_projects set name = 'x' where id = $1`, [id])).rejects.toThrow(
      /build_project_closed/,
    );
  });

  it("enforces I3 on the roster: the judge never shares the builder's family", async () => {
    await expect(
      project(ws, "i3", { builder_family: "anthropic", judge_families: ["anthropic", "openai"] }, false),
    ).rejects.toThrow(/build_projects_judges/);
  });

  it("a ConsultOS origin is client-isolated and holds its engagement until closed", async () => {
    await expect(
      db.query(
        `insert into public.build_projects (workspace_id, project_key, name, origin_kind, origin_engagement_id, repo_url, stack_profile, canon_profile)
         values ($1, 'client-internal', 'X', 'consultos_engagement', $2, 'https://github.com/x/y', 'next-supabase', 'arxus-v2')`,
        [ws, engagementId],
      ),
    ).rejects.toThrow(/build_projects_origin/);
    const { rows } = await db.query<{ id: string; origin_name_snapshot: string }>(
      `insert into public.build_projects (workspace_id, project_key, name, origin_kind, origin_engagement_id, isolation_class, repo_url, stack_profile, canon_profile)
       values ($1, 'client-build', 'Client build', 'consultos_engagement', $2, 'client', 'https://github.com/x/y', 'next-supabase', 'arxus-v2')
       returning id, origin_name_snapshot`,
      [ws, engagementId],
    );
    expect(rows[0].origin_name_snapshot).toBe("Build engagement");
    await expect(db.query(`delete from public.engagements where id = $1`, [engagementId])).rejects.toThrow(/retention_hold_active.*buildos/);
    await db.query(`update public.build_projects set status = 'closed' where id = $1`, [rows[0].id]);
    const holds = await db.query(
      `select 1 from public.retention_holds where entity_id = $1 and held_by_module = 'buildos' and released_at is null`,
      [engagementId],
    );
    expect(holds.rows).toHaveLength(0);
  });

  it("operators create projects; viewers cannot; other workspaces cannot see them", async () => {
    await asUser(operator, (tx) =>
      tx.query(
        `insert into public.build_projects (workspace_id, project_key, name, origin_kind, repo_url, stack_profile, canon_profile, created_by)
         values ($1, 'op-made', 'Op', 'internal', 'https://github.com/x/op', 'next-supabase', 'arxus-v2', $2)`,
        [ws, operator],
      ),
    );
    await expect(
      asUser(viewer, (tx) =>
        tx.query(
          `insert into public.build_projects (workspace_id, project_key, name, origin_kind, repo_url, stack_profile, canon_profile, created_by)
           values ($1, 'viewer-made', 'V', 'internal', 'https://github.com/x/v', 'next-supabase', 'arxus-v2', $2)`,
          [ws, viewer],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    const seen = await asUser(otherOwner, (tx) => tx.query(`select 1 from public.build_projects where workspace_id = $1`, [ws]), false);
    expect(seen.rows).toHaveLength(0);
  });

  it("operators cannot edit engine-owned fair-share state", async () => {
    const id = await project(ws, "fairness-guard");
    await expect(
      asUser(operator, (tx) => tx.query(`update public.build_projects set sched_pass = -100 where id = $1`, [id])),
    ).rejects.toThrow(/build_project_engine_field/);
  });
});

describe("B1 exit 1 — project-scoped identity: overlapping canon keys never cross-read", () => {
  it("two projects (two workspaces) both with JRN-S1 keep separate runs and visibility", async () => {
    const pA = await project(ws, "alpha");
    const pB = await project(wsB, "alpha"); // same project_key, other workspace
    await item(pA, "jrn-s1");
    await item(pB, "jrn-s1");
    for (const w of [ws, wsB]) {
      await account(w, "anthropic");
      await account(w, "openai");
    }
    const wA = await worker(ws, "worker-a");
    const wB = await worker(wsB, "worker-b");
    const leaseA = await claim(wA);
    const leaseB = await claim(wB);
    expect(leaseA?.project.project_key).toBe("alpha");
    expect(leaseB?.project.project_key).toBe("alpha");
    expect(leaseA?.run_id).not.toBe(leaseB?.run_id);
    // A worker never sees the other workspace's work.
    const rowsA = await db.query<{ workspace_id: string }>(`select workspace_id from public.build_runs where id = $1`, [leaseA!.run_id]);
    expect(rowsA.rows[0].workspace_id).toBe(ws);
    // A member of workspace B cannot read workspace A's runs.
    const crossRead = await asUser(otherOwner, (tx) =>
      tx.query(`select 1 from public.build_runs where id = $1`, [leaseA!.run_id]), false);
    expect(crossRead.rows).toHaveLength(0);
    // A worker cannot finish a run it does not own.
    await expect(finish(wB, leaseA!.run_id, "accepted", null)).rejects.toThrow(/build_run_not_owned/);
    await drainRunning(pA);
    await drainRunning(pB);
  });
});

describe("scheduling", () => {
  it("decomposition gate: overlapping bindings serialize, disjoint ones run in parallel; WIP caps", async () => {
    const p = await project(ws, "decomp", { wip_limit: 3 });
    await item(p, "a", ["Listing", "Seller"]);
    await item(p, "b", ["Seller"]); // overlaps a
    await item(p, "c", ["Buyer"]); // disjoint
    const w = await worker(ws, "worker-decomp");
    const keys: string[] = [];
    for (let i = 0; i < 3; i++) {
      const l = await claim(w);
      if (l?.project.project_key === "decomp") keys.push(l.work_item.item_key);
    }
    expect(keys.sort()).toEqual(["a", "c"]);
    await drainRunning(p);
  });

  it("a foundation ('*') binds the whole project", async () => {
    const p = await project(ws, "foundation", { wip_limit: 4 });
    await item(p, "f", ["*"]);
    await item(p, "x", ["Anything"]);
    const w = await worker(ws, "worker-found");
    const first = await claim(w);
    const second = await claim(w);
    const mine = [first, second].filter((l) => l?.project.project_key === "foundation");
    expect(mine).toHaveLength(1);
    await drainRunning(p);
  });

  it("dependencies must be accepted before an item is claimable", async () => {
    const p = await project(ws, "deps");
    const a = await item(p, "dep-a", ["A"], "draft");
    const b = await item(p, "dep-b", ["B"]);
    await db.query(
      `insert into public.build_work_item_deps (work_item_id, depends_on_id, project_id, workspace_id) values ($1, $2, $3, $4)`,
      [b, a, p, ws],
    );
    await expect(
      db.query(
        `insert into public.build_work_item_deps (work_item_id, depends_on_id, project_id, workspace_id) values ($1, $2, $3, $4)`,
        [a, b, p, ws],
      ),
    ).rejects.toThrow(/build_dependency_cycle/);
    const w = await worker(ws, "worker-deps");
    const l = await claim(w);
    expect(l?.project.project_key === "deps" && l.work_item.item_key === "dep-b").toBe(false);
    if (l) await drainRunning(p);
  });

  it("fair share: stride scheduling alternates between equal-weight projects", async () => {
    const wsF = await createWorkspace(db, "Fair");
    await account(wsF, "anthropic", { max_concurrency: 64 });
    await account(wsF, "openai", { max_concurrency: 64 });
    const p1 = await project(wsF, "one", { wip_limit: 8 });
    const p2 = await project(wsF, "two", { wip_limit: 8 });
    for (let i = 0; i < 3; i++) {
      await item(p1, `one-${i}`, [`E${i}`]);
      await item(p2, `two-${i}`, [`E${i}`]);
    }
    const w = await worker(wsF, "worker-fair");
    const order: string[] = [];
    for (let i = 0; i < 4; i++) order.push((await claim(w))!.project.project_key);
    expect(order.filter((k) => k === "one")).toHaveLength(2);
    expect(order.filter((k) => k === "two")).toHaveLength(2);
    expect(order[0]).not.toBe(order[1]);
  });
});

describe("B1 exit 3 — capacity: no dispatch without a healthy judge family", () => {
  it("refuses to claim when every judge account is down, and alarms; dispatches once one recovers", async () => {
    const wsC = await createWorkspace(db, "Capacity");
    await account(wsC, "anthropic");
    const judge = await account(wsC, "openai", { health: "down" });
    const p = await project(wsC, "cap");
    await item(p, "jrn-t1", ["T"]);
    const w = await worker(wsC, "worker-cap");
    expect(await claim(w)).toBeNull();
    await db.query(`select public.build_evaluate_alarms($1)`, [wsC]);
    const alarms = await db.query(`select subject from public.build_alarms where project_id = $1 and kind = 'capacity' and cleared_at is null`, [p]);
    expect(alarms.rows).toEqual([{ subject: "judge" }]);
    await asWorker((tx) => rpc(tx, `public.build_report_account_health($1, $2, 'healthy', 'canary ok')`, [w, judge]));
    expect((await claim(w))?.work_item.item_key).toBe("jrn-t1");
    await db.query(`select public.build_evaluate_alarms($1)`, [wsC]);
    const after = await db.query(`select 1 from public.build_alarms where project_id = $1 and kind = 'capacity' and cleared_at is null`, [p]);
    expect(after.rows).toHaveLength(0);
  });

  it("client projects count only metered accounts", async () => {
    const wsM = await createWorkspace(db, "Metered");
    await account(wsM, "anthropic", { billing_class: "subscription" });
    await account(wsM, "openai", { billing_class: "metered" });
    const acct = await db.query<{ id: string }>(`insert into public.accounts (workspace_id, name) values ($1, 'C') returning id`, [wsM]);
    const eng = await db.query<{ id: string }>(
      `insert into public.engagements (workspace_id, account_id, name) values ($1, $2, 'E') returning id`,
      [wsM, acct.rows[0].id],
    );
    const { rows } = await db.query<{ id: string }>(
      `insert into public.build_projects (workspace_id, project_key, name, origin_kind, origin_engagement_id, isolation_class, repo_url, stack_profile, canon_profile)
       values ($1, 'client-m', 'Client', 'consultos_engagement', $2, 'client', 'https://github.com/x/m', 'next-supabase', 'arxus-v2') returning id`,
      [wsM, eng.rows[0].id],
    );
    const p = rows[0].id;
    await db.query(`update public.build_projects set readiness_checked_at = now(), status = 'ready' where id = $1`, [p]);
    await db.query(`update public.build_projects set status = 'active' where id = $1`, [p]);
    await item(p, "c1", ["X"]);
    const w = await worker(wsM, "worker-m");
    expect(await claim(w)).toBeNull(); // builder family only has a subscription account
    await account(wsM, "anthropic", { billing_class: "metered" });
    expect((await claim(w))?.work_item.item_key).toBe("c1");
  });

  it("slots: I3 is enforced per call, concurrency is bounded, release writes the ledger", async () => {
    const wsS = await createWorkspace(db, "Slots");
    await account(wsS, "anthropic", { max_concurrency: 1 });
    const judgeAcct = await account(wsS, "openai", { max_concurrency: 1 });
    const p = await project(wsS, "slots");
    await item(p, "s1", ["S"]);
    const w = await worker(wsS, "worker-s");
    const l = (await claim(w))!;
    await expect(
      asWorker((tx) => rpc(tx, `public.build_acquire_slot($1, $2, 'anthropic', 'reviewer')`, [w, l.run_id])),
    ).rejects.toThrow(/build_i3_violation/);
    const slot = await asWorker((tx) =>
      rpc<{ lease_id: string; secret_ref: string }>(tx, `public.build_acquire_slot($1, $2, 'openai', 'reviewer')`, [w, l.run_id]),
    );
    expect(slot?.secret_ref).toMatch(/^vault\//);
    const none = await asWorker((tx) => rpc(tx, `public.build_acquire_slot($1, $2, 'openai', 'reviewer')`, [w, l.run_id]));
    expect(none).toBeNull(); // max_concurrency 1
    await asWorker((tx) =>
      rpc(tx, `public.build_release_slot($1, $2, $3)`, [
        w,
        slot!.lease_id,
        { model: "gpt-x", tokens_in: 10, tokens_out: 5, billed_cost_usd: 0.25, outcome: "provider_unavailable", retry_after_s: 600 },
      ]),
    );
    const ledger = await db.query(`select billed_cost_usd::float as c from public.build_cost_ledger where run_id = $1`, [l.run_id]);
    expect(ledger.rows).toEqual([{ c: 0.25 }]);
    const acct = await db.query<{ health: string }>(`select health from public.build_provider_accounts where id = $1`, [judgeAcct]);
    expect(acct.rows[0].health).toBe("down");
  });
});

describe("B1 exit 2 — leases: a lost worker's run is reclaimed, never lost", () => {
  it("lease expiry finishes the run held/worker_lost and the item is claimable again after its backoff", async () => {
    const wsL = await createWorkspace(db, "Leases");
    await account(wsL, "anthropic");
    await account(wsL, "openai");
    const p = await project(wsL, "lease");
    const it1 = await item(p, "l1", ["L"]);
    const w = await worker(wsL, "worker-l");
    const l = (await claim(w))!;
    await db.query(`update public.build_runs set lease_expires_at = now() - interval '1 second' where id = $1`, [l.run_id]);
    expect(await claim(w)).toBeNull(); // reaped, but held for the 1-minute backoff
    const run = await db.query(`select verdict, failure_class from public.build_runs where id = $1`, [l.run_id]);
    expect(run.rows[0]).toEqual({ verdict: "held", failure_class: "worker_lost" });
    expect((await itemRow(it1)).status).toBe("held");
    await expect(
      asWorker((tx) => rpc(tx, `public.build_heartbeat($1, $2, 'builder')`, [w, l.run_id])),
    ).rejects.toThrow(/build_run_finished/);
    await db.query(`update public.build_work_items set hold_until = now() - interval '1 second' where id = $1`, [it1]);
    const again = await claim(w);
    expect(again?.run_key).toBe("lease/l1/2");
  });
});

describe("finish transitions (docs/81 §5.1)", () => {
  // Each test gets its own workspace + worker so no other test's ready items
  // can be claimed in its place.
  let wsT: string;
  let w: string;
  let n = 0;
  beforeEach(async () => {
    n += 1;
    wsT = await createWorkspace(db, `Transitions ${n}`);
    await grantMembership(db, wsT, owner, "owner");
    await grantMembership(db, wsT, operator, "operator");
    await grantMembership(db, wsT, viewer, "viewer");
    await account(wsT, "anthropic", { max_concurrency: 64 });
    await account(wsT, "openai", { max_concurrency: 64 });
    w = await worker(wsT, `worker-t${n}`);
  });

  it("accepted requires pins and accepts the item", async () => {
    const p = await project(wsT, "acc");
    const i = await item(p, "a1", ["A"]);
    const l = (await claim(w))!;
    await expect(finish(w, l.run_id, "accepted", null)).rejects.toThrow(/build_runs_accepted_pinned/);
    await asWorker((tx) =>
      rpc(tx, `public.build_heartbeat($1, $2, 'review', $3)`, [w, l.run_id, { base_sha: "abc1234", lane_version: "lane-1" }]),
    );
    await finish(w, l.run_id, "accepted", null, { merge_sha: "def5678" });
    expect((await itemRow(i)).status).toBe("accepted");
    await expect(
      db.query(`update public.build_runs set verdict = 'rejected', failure_class = 'rejected' where id = $1`, [l.run_id]),
    ).rejects.toThrow(/build_run_finished_immutable/);
  });

  it("a verdict must match its failure class", async () => {
    const p = await project(wsT, "mismatch");
    await item(p, "m1", ["M"]);
    const l = (await claim(w))!;
    await expect(finish(w, l.run_id, "held", "rejected")).rejects.toThrow(/build_runs_verdict_class/);
    await finish(w, l.run_id, "held", "precondition");
  });

  it("precondition holds wait for an operator; a provider outage holds with the advertised cooldown", async () => {
    const p = await project(wsT, "holds", { wip_limit: 2 });
    const i1 = await item(p, "h1", ["H1"]);
    const i2 = await item(p, "h2", ["H2"]);
    const l1 = (await claim(w))!;
    const l2 = (await claim(w))!;
    const byKey = Object.fromEntries([l1, l2].map((l) => [l.work_item.item_key, l.run_id]));
    await finish(w, byKey.h1, "held", "precondition", { summary: "origin dirty" });
    await finish(w, byKey.h2, "held", "provider_unavailable", { retry_after_s: 3600 });
    const r1 = await itemRow(i1);
    expect([r1.status, r1.hold_until]).toEqual(["held", null]);
    const r2 = await db.query<{ mins: number }>(
      `select round(extract(epoch from hold_until - now()) / 60)::int as mins from public.build_work_items where id = $1`,
      [i2],
    );
    expect(r2.rows[0].mins).toBeGreaterThanOrEqual(59);
    // operator release clears the hold
    await asUser(operator, (tx) => tx.query(`update public.build_work_items set status = 'ready' where id = $1`, [i1]));
    expect((await itemRow(i1)).status).toBe("ready");
  });

  it("thrash rule: five identical failures park the item for an operator and alarm", async () => {
    const p = await project(wsT, "thrash");
    const i = await item(p, "t1", ["T"]);
    for (let n = 1; n <= 5; n++) {
      await db.query(`update public.build_work_items set hold_until = now() - interval '1 second' where id = $1 and status = 'held'`, [i]);
      const l = (await claim(w))!;
      expect(l.work_item.item_key).toBe("t1");
      await finish(w, l.run_id, "held", "no_verdict");
    }
    const row = await itemRow(i);
    expect([row.status, row.hold_reason, row.hold_until, row.consecutive_failures]).toEqual(["held", "thrash", null, 5]);
    const alarm = await db.query(`select 1 from public.build_alarms where project_id = $1 and kind = 'thrash' and cleared_at is null`, [p]);
    expect(alarm.rows).toHaveLength(1);
    expect(await claim(w)).toBeNull();
  });

  it("rejection past max_attempts escalates a technical decision; a ruling resets the budget and never dispatches", async () => {
    const p = await project(wsT, "reject", { max_attempts: 2 });
    const i = await item(p, "r1", ["R"]);
    let l = (await claim(w))!;
    await finish(w, l.run_id, "rejected", "rejected", { summary: "AC-3 unmet" });
    expect((await itemRow(i)).status).toBe("ready");
    l = (await claim(w))!;
    await finish(w, l.run_id, "rejected", "rejected", { summary: "AC-3 still unmet" });
    expect((await itemRow(i)).status).toBe("escalated");
    const d = await db.query<{ id: string; class: string; recommended_option: string }>(
      `select id, class, recommended_option from public.build_decisions where work_item_id = $1`,
      [i],
    );
    expect(d.rows[0]).toMatchObject({ class: "technical", recommended_option: "retry" });
    await expect(
      asUser(viewer, (tx) => tx.query(`select public.build_rule_decision($1, 'retry', null, 'ready')`, [d.rows[0].id])),
    ).rejects.toThrow(/build_not_authorized/);
    await asUser(owner, (tx) =>
      tx.query(`select public.build_rule_decision($1, 'retry', 'try once more', 'ready', 'DEC-099')`, [d.rows[0].id]),
    );
    const after = await itemRow(i);
    expect([after.status, after.attempt_budget_base]).toEqual(["ready", 2]);
    expect((await db.query(`select 1 from public.build_runs where work_item_id = $1 and status = 'running'`, [i])).rows).toHaveLength(0);
    l = (await claim(w))!;
    await finish(w, l.run_id, "rejected", "rejected");
    expect((await itemRow(i)).status).toBe("ready"); // fresh budget
  });

  it("an escalated run must carry a decision payload; the decision is immutable and ruled once", async () => {
    const p = await project(wsT, "esc");
    const i = await item(p, "e1", ["E"]);
    const l = (await claim(w))!;
    await expect(finish(w, l.run_id, "escalated", "escalated", {})).rejects.toThrow(/build_decision_payload_required/);
    await finish(w, l.run_id, "escalated", "escalated", {
      decision: {
        class: "owner",
        title: "What does seller stage mean?",
        brief: "DEC-062: provisional financing ladder.",
        options: [
          { key: "ratify", label: "Ratify the ladder", consequence: "AC-S4-03 stands" },
          { key: "deal", label: "Stage = deal progress", consequence: "AC-S4-03 changes" },
        ],
        recommended_option: "ratify",
      },
    });
    expect((await itemRow(i)).status).toBe("escalated");
    const d = (await db.query<{ id: string }>(`select id from public.build_decisions where work_item_id = $1`, [i])).rows[0];
    await expect(
      asUser(owner, (tx) => tx.query(`select public.build_rule_decision($1, 'nope', null, 'ready')`, [d.id])),
    ).rejects.toThrow(/build_decision_unknown_option/);
    await asUser(owner, (tx) => tx.query(`select public.build_rule_decision($1, 'ratify', null, 'ready')`, [d.id]));
    await expect(
      asUser(owner, (tx) => tx.query(`select public.build_rule_decision($1, 'deal', null, 'ready')`, [d.id])),
    ).rejects.toThrow(/build_decision_closed/);
  });

  it("operator cancel reaches the worker via heartbeat; abort without a request is refused", async () => {
    const p = await project(wsT, "cancel");
    const i = await item(p, "c1", ["C"]);
    const l = (await claim(w))!;
    await expect(finish(w, l.run_id, "aborted", "operator_abort")).rejects.toThrow(/build_abort_without_cancel_request/);
    await asUser(operator, (tx) => tx.query(`select public.build_request_cancel($1)`, [l.run_id]));
    const hb = await asWorker((tx) => rpc<string>(tx, `public.build_heartbeat($1, $2, 'builder')`, [w, l.run_id]));
    expect(hb).toBe("cancel");
    await finish(w, l.run_id, "aborted", "operator_abort");
    const row = await itemRow(i);
    expect([row.status, row.hold_reason, row.hold_until]).toEqual(["held", "operator_abort", null]);
  });
});

describe("authorization boundaries (docs/81 §11)", () => {
  it("operators cannot write engine tables or engine-only item transitions", async () => {
    const p = await project(ws, "authz");
    const i = await item(p, "z1", ["Z"]);
    await expect(
      asUser(owner, (tx) =>
        tx.query(
          `insert into public.build_runs (workspace_id, project_id, work_item_id, run_key, attempt_no, worker_id, stack_profile, canon_profile, lease_expires_at)
           values ($1, $2, $3, 'x/y/1', 1, gen_random_uuid(), 's', 'c', now())`,
          [ws, p, i],
        ),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(
      asUser(owner, (tx) => tx.query(`update public.build_work_items set status = 'in_progress' where id = $1`, [i])),
    ).rejects.toThrow(/invalid_transition/);
    await expect(
      asUser(owner, (tx) => tx.query(`update public.build_work_items set attempts = 9 where id = $1`, [i])),
    ).rejects.toThrow(/build_work_item_engine_field/);
    await expect(
      asUser(owner, (tx) => tx.query(`insert into public.build_decisions (workspace_id, project_id, work_item_id, class, title, brief) values ($1, $2, $3, 'owner', 't', 'b')`, [ws, p, i])),
    ).rejects.toThrow(/permission denied/);
  });

  it("the worker principal has no table access and cannot call operator RPCs", async () => {
    await expect(asWorker((tx) => tx.query(`select * from public.build_projects`))).rejects.toThrow(/permission denied/);
    await expect(asWorker((tx) => tx.query(`select * from public.engagements`))).rejects.toThrow(/permission denied/);
    await expect(
      asWorker((tx) => tx.query(`select public.build_rule_decision(gen_random_uuid(), 'x', null, 'ready')`)),
    ).rejects.toThrow(/permission denied/);
  });

  it("authenticated users cannot call worker RPCs; anon gets nothing", async () => {
    const w = await worker(ws, "worker-authz");
    await expect(asUser(owner, (tx) => tx.query(`select public.build_claim_run($1)`, [w]))).rejects.toThrow(/permission denied/);
    await expect(
      as(db, { kind: "anon" }, (tx) => tx.query(`select * from public.build_projects`)),
    ).rejects.toThrow(/permission denied/);
  });

  it("alarm evaluation by an end user is limited to their own workspace", async () => {
    await expect(
      asUser(otherOwner, (tx) => tx.query(`select public.build_evaluate_alarms($1)`, [ws])),
    ).rejects.toThrow(/build_not_authorized/);
  });

  it("events and ledger are append-only", async () => {
    const wsE = await createWorkspace(db, "Events");
    await account(wsE, "anthropic");
    await account(wsE, "openai");
    const p = await project(wsE, "events");
    await item(p, "ev", ["V"]);
    const w = await worker(wsE, "worker-e");
    const l = (await claim(w))!;
    const n = await asWorker((tx) =>
      rpc<number>(tx, `public.build_report_events($1, $2, $3)`, [
        w,
        l.run_id,
        [{ kind: "phase_start", phase: "planner" }, { kind: "gate", phase: "builder", passed: true, detail: { gate: "typecheck" } }],
      ]),
    );
    expect(n).toBe(2);
    await expect(db.query(`delete from public.build_run_events where run_id = $1`, [l.run_id])).rejects.toThrow(/build_append_only/);
  });
});

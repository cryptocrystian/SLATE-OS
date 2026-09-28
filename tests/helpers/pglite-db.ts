/**
 * In-process Postgres (PGlite) test harness for SLATE migrations.
 *
 * Layer: SLATE PLATFORM test foundation (docs/72 §3.6). No Docker.
 *
 * What it models faithfully: tables, constraints, triggers, RLS policies,
 * security-definer helpers, role switching.
 * What it does NOT model: the Supabase Auth / PostgREST HTTP layer and the
 * Storage API. Those are verified on a short-lived Supabase dev branch
 * before each production apply (docs/72 §3.6, Architect decision
 * 2026-09-28).
 *
 * Supabase stand-ins installed before the migrations run:
 *   - roles anon / authenticated / service_role (service_role BYPASSRLS)
 *   - auth.users + auth.uid() reading `request.jwt.claims` like Supabase
 *   - storage.buckets / storage.objects (shape only)
 *   - Supabase-style grants (anon + authenticated get table privileges;
 *     RLS is the actual control, exactly as on the hosted project)
 */
import { PGlite, type Transaction } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(__dirname, "..", "..", "supabase", "migrations");

const SUPABASE_SHIM = `
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;

create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  email text,
  is_anonymous boolean not null default false,
  created_at timestamptz not null default now()
);
create or replace function auth.uid() returns uuid
language sql stable as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ), ''
  )::uuid
$$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;

create schema if not exists storage;
create table if not exists storage.buckets (
  id text primary key,
  name text not null,
  public boolean default false,
  file_size_limit bigint,
  allowed_mime_types text[],
  created_at timestamptz default now()
);
create table if not exists storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id),
  name text
);
alter table storage.objects enable row level security;
`;

// Mirrors the PRODUCTION project's pg_default_acl (verified 2026-09-28):
// every new table/sequence/function in `public` is granted to anon,
// authenticated and service_role. Migrations that revoke explicitly keep
// their revokes. (Newer Supabase projects grant nothing by default — the
// G0 migrations state their grants explicitly so both behave the same.)
const SUPABASE_DEFAULT_PRIVILEGES = `
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

export function listMigrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => /^\d{4}_.+\.sql$/.test(f))
    .sort();
}

function adaptForPglite(sql: string): string {
  // pgcrypto is not bundled with PGlite; the migrations only use
  // gen_random_uuid(), which is core Postgres >= 13.
  return sql.replace(/create extension if not exists pgcrypto\s*;/gi, "");
}

export interface TestDbOptions {
  /** Apply migrations with a number <= this (e.g. 21 = state before G0). */
  upTo?: number;
  /** Skip specific migration numbers (e.g. [23] to model "0023 held"). */
  skip?: number[];
  /**
   * Called before migration `n` is applied — models operational steps that
   * sit between migrations (e.g. granting memberships before 0023).
   */
  beforeApply?: (n: number, db: PGlite) => Promise<void>;
}

export async function createTestDb(opts: TestDbOptions = {}): Promise<PGlite> {
  const db = await PGlite.create({ extensions: { citext } });
  await db.exec(SUPABASE_SHIM);
  await db.exec(SUPABASE_DEFAULT_PRIVILEGES);
  for (const file of listMigrationFiles()) {
    const n = Number(file.slice(0, 4));
    if (opts.upTo !== undefined && n > opts.upTo) continue;
    if (opts.skip?.includes(n)) continue;
    if (opts.beforeApply) await opts.beforeApply(n, db);
    const sql = adaptForPglite(readFileSync(join(MIGRATIONS_DIR, file), "utf8"));
    try {
      await db.exec(sql);
    } catch (err) {
      throw new Error(`migration ${file} failed in PGlite: ${(err as Error).message}`);
    }
  }
  return db;
}

export type Persona =
  | { kind: "anon" }
  | { kind: "authenticated"; userId: string }
  | { kind: "service_role" };

/** Run `fn` inside a transaction as the given persona (rolled back unless `commit`). */
export async function as<T>(
  db: PGlite,
  persona: Persona,
  fn: (tx: Transaction) => Promise<T>,
  { commit = false }: { commit?: boolean } = {},
): Promise<T> {
  let result!: T;
  const ROLLBACK = Symbol("rollback");
  try {
    await db.transaction(async (tx) => {
      if (persona.kind === "authenticated") {
        await tx.query(`select set_config('request.jwt.claims', $1, true)`, [
          JSON.stringify({ sub: persona.userId, role: "authenticated" }),
        ]);
        await tx.exec(`set local role authenticated`);
      } else {
        await tx.query(`select set_config('request.jwt.claims', '', true)`);
        await tx.exec(`set local role ${persona.kind}`);
      }
      result = await fn(tx);
      if (!commit) throw ROLLBACK;
    });
  } catch (err) {
    if (err !== ROLLBACK) throw err;
  }
  return result;
}

/** Superuser setup helpers (bypass RLS; test fixtures only). */
export async function createUser(db: PGlite, email: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into auth.users (email) values ($1) returning id`,
    [email],
  );
  // 0001's on_auth_user_created trigger creates the profile row.
  return rows[0].id;
}

export async function createWorkspace(db: PGlite, name: string): Promise<string> {
  const { rows } = await db.query<{ id: string }>(
    `insert into public.workspaces (name) values ($1) returning id`,
    [name],
  );
  return rows[0].id;
}

export async function grantMembership(
  db: PGlite,
  workspaceId: string,
  profileId: string,
  role: "owner" | "operator" | "viewer" = "operator",
): Promise<void> {
  await db.query(
    `insert into public.workspace_memberships (workspace_id, profile_id, role) values ($1, $2, $3)`,
    [workspaceId, profileId, role],
  );
}

export async function publicTables(db: PGlite): Promise<string[]> {
  const { rows } = await db.query<{ relname: string }>(
    `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r' order by 1`,
  );
  return rows.map((r) => r.relname);
}

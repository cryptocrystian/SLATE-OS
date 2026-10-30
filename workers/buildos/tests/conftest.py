"""Contract-test harness: the REAL SLATE migrations on PGlite (Postgres 17, no Docker).

Mirrors tests/helpers/pglite-db.ts: the same Supabase stand-ins (roles, auth.uid(),
storage shape, default privileges) so the worker is tested against exactly the grants
and guards production has.

The server is tests/pgserver/server.mjs: current @electric-sql/pglite + pglite-socket
(wire protocol), with the real citext contrib extension. (py-pglite was tried first; it
pins pglite-socket 0.0.8, whose server crashed on any in-transaction error and on large
multi-statement messages.) Every ControlPlane call shares one connection behind a lock,
which also proves the client never needs two connections at once.
"""
from __future__ import annotations

import contextlib
import json
import os
import re
import shutil
import subprocess
import threading
import uuid
from pathlib import Path

import psycopg
import pytest

from buildos_worker.controlplane import ControlPlane

REPO = Path(__file__).resolve().parents[3]
MIGRATIONS = REPO / "supabase" / "migrations"
PGSERVER = Path(__file__).resolve().parent / "pgserver"

SUPABASE_SHIM = """
do $$ begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then create role service_role nologin bypassrls; end if;
end $$;
create schema if not exists auth;
create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(), email text,
  is_anonymous boolean not null default false, created_at timestamptz not null default now());
create or replace function auth.uid() returns uuid language sql stable as $$
  select nullif(coalesce(current_setting('request.jwt.claim.sub', true),
    (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid $$;
grant usage on schema auth to anon, authenticated, service_role;
grant execute on function auth.uid() to anon, authenticated, service_role;
create schema if not exists storage;
create table if not exists storage.buckets (id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[], created_at timestamptz default now());
create table if not exists storage.objects (id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id), name text);
alter table storage.objects enable row level security;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
"""


class SharedConn:
    """A single autocommit connection handed out under a lock (PGlite: one client)."""

    def __init__(self, conn: psycopg.Connection):
        self.conn, self.lock = conn, threading.RLock()

    @contextlib.contextmanager
    def __call__(self):
        with self.lock:
            yield self.conn


@contextlib.contextmanager
def pglite_server():
    node = shutil.which("node")
    if not node:
        pytest.skip("node is required for the PGlite test server")
    if not (PGSERVER / "node_modules" / "@electric-sql" / "pglite-socket").is_dir():
        subprocess.run(["npm", "ci", "--silent"], cwd=PGSERVER, check=True)
    proc = subprocess.Popen([node, "server.mjs", "0"], cwd=PGSERVER, stdin=subprocess.PIPE,
                            stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    try:
        line = proc.stdout.readline()
        if not line:
            raise RuntimeError(f"PGlite test server failed to start: {proc.stderr.read()[:2000]}")
        yield f"postgresql://postgres:postgres@127.0.0.1:{json.loads(line)['port']}/postgres?sslmode=disable"
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()


@pytest.fixture(scope="session")
def db():
    with pglite_server() as dsn:
        conn = psycopg.connect(dsn, autocommit=True)
        conn.execute(SUPABASE_SHIM)
        for f in sorted(p for p in MIGRATIONS.glob("*.sql") if re.match(r"^\d{4}_", p.name)):
            n = int(f.name[:4])
            if n == 23:  # 0023 refuses to run without active memberships (as in production)
                ws = conn.execute("select id from public.workspaces limit 1").fetchone()[0]
                uid = conn.execute("insert into auth.users (email) values ('seed@saipienlabs.com') returning id").fetchone()[0]
                conn.execute("insert into public.workspace_memberships (workspace_id, profile_id, role) values (%s, %s, 'owner')", (ws, uid))
            # pgcrypto is not bundled with PGlite; the migrations only use gen_random_uuid() (core PG).
            sql = re.sub(r"create extension if not exists pgcrypto\s*;", "", f.read_text(), flags=re.I)
            try:
                conn.execute(sql)
            except psycopg.Error as e:
                raise RuntimeError(f"migration {f.name} failed on PGlite: {e}") from e
        yield SharedConn(conn)
        conn.close()


class Fixture:
    """Superuser helpers that build an isolated workspace per test."""

    def __init__(self, shared: SharedConn):
        self.shared = shared
        with shared() as c:
            self.ws = c.execute("insert into public.workspaces (name) values (%s) returning id",
                                (f"ws-{uuid.uuid4().hex[:8]}",)).fetchone()[0]

    def sql(self, q: str, *args):
        with self.shared() as c:
            cur = c.execute(q, args)
            return cur.fetchall() if cur.description else None

    def one(self, q: str, *args):
        rows = self.sql(q, *args)
        return rows[0] if rows else None

    def project(self, key: str, *, judges=("openai",), activate=True, **cols) -> str:
        pid = self.one(
            """insert into public.build_projects (workspace_id, project_key, name, origin_kind, origin_ref,
                 repo_url, stack_profile, canon_profile, judge_families)
               values (%s, %s, %s, 'ventureos_venture', %s, %s, 'next-supabase', 'arxus-v2', %s) returning id""",
            self.ws, key, key, key, f"https://github.com/example/{key}", list(judges))[0]
        for k, v in cols.items():
            self.sql(f"update public.build_projects set {k} = %s where id = %s", v, pid)
        if activate:
            self.sql("update public.build_projects set status='ready', readiness_checked_at=now() where id=%s", pid)
            self.sql("update public.build_projects set status='active' where id=%s", pid)
        return str(pid)

    def item(self, project_id: str, key: str, bindings=("X",)) -> str:
        return str(self.one(
            """insert into public.build_work_items (project_id, workspace_id, item_key, kind, title, bindings, status)
               values (%s, %s, %s, 'journey', %s, %s, 'ready') returning id""",
            project_id, self.ws, key, key, list(bindings))[0])

    def account(self, family: str, *, health="healthy", billing="subscription", max_concurrency=4) -> str:
        label = f"{family}-{uuid.uuid4().hex[:6]}"
        return str(self.one(
            """insert into public.build_provider_accounts (workspace_id, label, family, provider, billing_class,
                 secret_ref, max_concurrency, health) values (%s, %s, %s, %s, %s, %s, %s, %s) returning id""",
            self.ws, label, family, f"p-{family}", billing, f"vault/{label}", max_concurrency, health)[0])

    def worker(self, name: str | None = None, caps=("next-supabase",)) -> str:
        return str(self.one(
            "insert into public.build_workers (workspace_id, name, substrate, capabilities) values (%s, %s, 'test', %s) returning id",
            self.ws, name or f"w-{uuid.uuid4().hex[:6]}", list(caps))[0])

    def control_plane(self, worker_id: str) -> ControlPlane:
        # The real worker connects AS a login role in buildos_worker; here we SET ROLE to it.
        return ControlPlane(self.shared, worker_id, assume_role="buildos_worker")


@pytest.fixture
def fx(db) -> Fixture:
    return Fixture(db)

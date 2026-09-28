#!/usr/bin/env node
/**
 * Grant (or update) a workspace membership — the explicit, reviewed
 * provisioning step required by migration 0022 (docs/72 §3.2). SLATE PLATFORM.
 *
 * Deliberately NOT a migration seed: a profile minted through the pre-fix
 * sign-up exposure must never inherit access automatically. Each grant names
 * a specific email.
 *
 * Usage:
 *   node scripts/platform/grant-workspace-membership.cjs <email> <owner|operator|viewer> [--dry-run]
 *
 * Env (from .env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 * Uses the service role (bypasses RLS) — run only from a trusted machine.
 * Grants into the singleton workspace (v1). Prints no secrets.
 */
const fs = require("node:fs");
const path = require("node:path");
const { createClient } = require("@supabase/supabase-js");

function loadEnv() {
  const file = path.join(__dirname, "..", "..", ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "").trim();
  }
}

async function main() {
  loadEnv();
  const [email, role, flag] = process.argv.slice(2);
  const dryRun = flag === "--dry-run";
  if (!email || !["owner", "operator", "viewer"].includes(role)) {
    console.error("usage: grant-workspace-membership.cjs <email> <owner|operator|viewer> [--dry-run]");
    process.exit(2);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error("missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
    process.exit(2);
  }
  const supabase = createClient(url, key, { auth: { persistSession: false } });

  const normalized = email.trim().toLowerCase();
  let user = null;
  for (let page = 1; page <= 20 && !user; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(`listUsers failed: ${error.message}`);
    user = data.users.find((u) => (u.email ?? "").toLowerCase() === normalized) ?? null;
    if (data.users.length < 200) break;
  }
  if (!user) {
    console.error(`no auth user for ${normalized} — invite/provision the operator first`);
    process.exit(1);
  }

  const { data: ws, error: wsErr } = await supabase.from("workspaces").select("id, name").limit(2);
  if (wsErr) throw new Error(`workspaces read failed: ${wsErr.message}`);
  if (!ws || ws.length !== 1) {
    console.error(`expected exactly one workspace (v1), found ${ws?.length ?? 0}; pass-through not implemented`);
    process.exit(1);
  }

  console.log(`${dryRun ? "[dry-run] " : ""}grant ${role} on "${ws[0].name}" to ${normalized}`);
  if (dryRun) return;

  const { error } = await supabase.from("workspace_memberships").upsert(
    { workspace_id: ws[0].id, profile_id: user.id, role, status: "active" },
    { onConflict: "workspace_id,profile_id" },
  );
  if (error) throw new Error(`upsert failed: ${error.message}`);
  console.log("✓ membership active");
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});

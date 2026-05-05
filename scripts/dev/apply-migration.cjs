#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Dev-only utility: apply a `supabase/migrations/*.sql` file to the
 * configured Supabase project via the Management API SQL endpoint.
 *
 * Mirrors `configure-supabase-smtp.cjs` — reads creds from `.env.local`
 * via @next/env, never logs the PAT, never prints the SQL body, redacts
 * known credential patterns from any error output.
 *
 * Required env (in `.env.local`):
 *   SUPABASE_ACCESS_TOKEN   — Personal Access Token (server-only)
 *   SUPABASE_PROJECT_REF    — project ref (the slug in your dashboard URL)
 *
 * Usage:
 *   node scripts/dev/apply-migration.cjs <name>
 *   node scripts/dev/apply-migration.cjs 0002_scorecard_leads.sql
 *   node scripts/dev/apply-migration.cjs supabase/migrations/0002_scorecard_leads.sql
 */

const path = require("path");
const fs = require("fs");

(async () => {
  try {
    const { loadEnvConfig } = require("@next/env");
    loadEnvConfig(path.resolve(__dirname, "..", ".."));
  } catch {
    console.error("Could not load @next/env. Run `npm install` first.");
    process.exit(1);
  }

  const arg = process.argv[2];
  if (!arg) {
    console.error("usage: node scripts/dev/apply-migration.cjs <migration-file>");
    process.exit(2);
  }

  const PAT = process.env.SUPABASE_ACCESS_TOKEN;
  const rawRef = process.env.SUPABASE_PROJECT_REF || "";
  const refMatch = rawRef.match(/([a-z0-9]{20})\/?$/);
  const REF = refMatch ? refMatch[1] : rawRef;

  if (!PAT || !/^[a-z0-9]{20}$/.test(REF)) {
    console.error(
      "missing or invalid env: SUPABASE_ACCESS_TOKEN and/or SUPABASE_PROJECT_REF",
    );
    process.exit(1);
  }

  const filePath = path.isAbsolute(arg)
    ? arg
    : fs.existsSync(arg)
      ? path.resolve(arg)
      : path.resolve(__dirname, "..", "..", "supabase", "migrations", arg);
  if (!fs.existsSync(filePath)) {
    console.error(`migration file not found: ${arg}`);
    process.exit(1);
  }
  const sql = fs.readFileSync(filePath, "utf8");
  console.log(
    `applying ${path.relative(process.cwd(), filePath)} (${sql.length} bytes)…`,
  );

  const url = `https://api.supabase.com/v1/projects/${REF}/database/query`;
  let res;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PAT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: sql }),
    });
  } catch (err) {
    console.error("network error:", err.message);
    process.exit(1);
  }

  if (res.ok) {
    console.log(`✓ migration applied (HTTP ${res.status})`);
    process.exit(0);
  }

  let errBody = "";
  try {
    errBody = await res.text();
  } catch {}
  const redacted = errBody
    .replace(/sbp_[A-Za-z0-9_-]{16,}/g, "<pat-redacted>")
    .replace(/eyJ[A-Za-z0-9_.-]+/g, "<jwt-redacted>")
    .replace(/[A-Fa-f0-9]{32,}/g, "<hex-secret-redacted>")
    .replace(/key-[A-Za-z0-9]{20,}/g, "<mailgun-key-redacted>")
    .replace(/re_[A-Za-z0-9_-]{16,}/g, "<resend-key-redacted>")
    .replace(/[a-z0-9]{20}\.supabase\.co/g, "<project>.supabase.co")
    .replace(
      /https?:\/\/(?:api|app)\.supabase\.com\/[^\s"'<>]+/g,
      "<supabase-url-redacted>",
    )
    .replace(
      /supabase\.com\/dashboard\/project\/[a-z0-9]{20}/g,
      "supabase.com/dashboard/project/<ref>",
    )
    .replace(/\/projects\/[a-z0-9]{20}\//g, "/projects/<ref>/")
    .slice(0, 800);
  console.error(`✗ HTTP ${res.status}`);
  if (redacted) console.error(`  body (redacted): ${redacted}`);
  process.exit(1);
})();

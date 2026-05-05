#!/usr/bin/env node
/* eslint-disable no-console */

/**
 * Dev-only utility: configure Supabase Auth SMTP via the Management API.
 *
 * This bypasses the Supabase Dashboard for one-off SMTP configuration. It
 * reads creds from `.env.local` (loaded the same way Next.js loads it) and
 * issues a single PATCH to the project's auth config. It never logs the
 * SMTP password, the management PAT, or any other secret.
 *
 * Required env (in `.env.local`):
 *   SUPABASE_ACCESS_TOKEN     — Personal Access Token (server-only)
 *   SUPABASE_PROJECT_REF      — project ref (the slug in your dashboard URL)
 *   MAILGUN_SMTP_USER         — e.g. postmaster@<sending-domain>
 *   MAILGUN_SMTP_PASSWORD     — Mailgun SMTP password
 *   SMTP_ADMIN_EMAIL          — visible From: address
 *
 * Optional env:
 *   SMTP_SENDER_NAME          — default "SLATE"
 *   SMTP_HOST                 — default "smtp.mailgun.org"
 *   SMTP_PORT                 — default 587
 *   SMTP_MAX_FREQUENCY        — default 60 (seconds)
 *
 * Usage:
 *   node scripts/dev/configure-supabase-smtp.cjs
 */

const path = require("path");

(async () => {
  // Load .env.local the same way Next.js does.
  try {
    const { loadEnvConfig } = require("@next/env");
    loadEnvConfig(path.resolve(__dirname, "..", ".."));
  } catch (e) {
    console.error("Could not load @next/env. Run `npm install` first.");
    process.exit(1);
  }

  const PAT = process.env.SUPABASE_ACCESS_TOKEN;
  // Lenience: accept either a bare ref slug ("abc...20chars") or a full
  // dashboard URL ("https://supabase.com/dashboard/project/<ref>").
  const rawRef = process.env.SUPABASE_PROJECT_REF || "";
  const refMatch = rawRef.match(/([a-z0-9]{20})\/?$/);
  const REF = refMatch ? refMatch[1] : rawRef;
  const SMTP_USER = process.env.MAILGUN_SMTP_USER;
  const SMTP_PASS = process.env.MAILGUN_SMTP_PASSWORD;
  const SMTP_ADMIN_EMAIL = process.env.SMTP_ADMIN_EMAIL;
  const SMTP_SENDER_NAME = process.env.SMTP_SENDER_NAME || "SLATE";
  const SMTP_HOST = process.env.SMTP_HOST || "smtp.mailgun.org";
  const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
  const SMTP_MAX_FREQUENCY = Number(process.env.SMTP_MAX_FREQUENCY || 60);

  const required = {
    SUPABASE_ACCESS_TOKEN: PAT,
    SUPABASE_PROJECT_REF: REF,
    MAILGUN_SMTP_USER: SMTP_USER,
    MAILGUN_SMTP_PASSWORD: SMTP_PASS,
    SMTP_ADMIN_EMAIL,
  };
  const missing = Object.entries(required)
    .filter(([, v]) => !v)
    .map(([k]) => k);
  if (missing.length) {
    console.error("missing required env vars:", missing.join(", "));
    process.exit(1);
  }
  if (!/^[a-z0-9]{20}$/.test(REF)) {
    console.error(
      "SUPABASE_PROJECT_REF must be the 20-character ref slug (the last path segment of your dashboard URL), not the full URL.",
    );
    process.exit(1);
  }
  if (!Number.isFinite(SMTP_PORT) || SMTP_PORT <= 0) {
    console.error("invalid SMTP_PORT");
    process.exit(1);
  }

  const url = `https://api.supabase.com/v1/projects/${REF}/config/auth`;
  const body = {
    smtp_admin_email: SMTP_ADMIN_EMAIL,
    smtp_host: SMTP_HOST,
    smtp_port: String(SMTP_PORT),
    smtp_user: SMTP_USER,
    smtp_pass: SMTP_PASS,
    smtp_sender_name: SMTP_SENDER_NAME,
    smtp_max_frequency: SMTP_MAX_FREQUENCY,
    external_email_enabled: true,
  };

  let res;
  try {
    res = await fetch(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${PAT}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.error("network error:", err.message);
    process.exit(1);
  }

  if (res.ok) {
    console.log(`✓ Supabase Auth SMTP configured (HTTP ${res.status})`);
    console.log(`  host: ${SMTP_HOST}:${SMTP_PORT}`);
    console.log(`  sender_name: ${SMTP_SENDER_NAME}`);
    console.log(`  smtp_user, sender_email, password: <not logged>`);
    console.log(
      "  Verify in Supabase Dashboard → Authentication → SMTP Settings.",
    );
    process.exit(0);
  }

  let errBody = "";
  try {
    errBody = await res.text();
  } catch {}
  // Aggressively redact anything that looks like a credential before printing.
  const redacted = errBody
    .replace(/sbp_[A-Za-z0-9_-]{16,}/g, "<pat-redacted>")
    .replace(/eyJ[A-Za-z0-9_.-]+/g, "<jwt-redacted>")
    .replace(/[A-Fa-f0-9]{32,}/g, "<hex-secret-redacted>")
    .replace(/key-[A-Za-z0-9]{20,}/g, "<mailgun-key-redacted>")
    .replace(/re_[A-Za-z0-9_-]{16,}/g, "<resend-key-redacted>")
    // Redact the project ref (20-char slug) and any URL containing it,
    // including the dashboard URL the API may echo back.
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
    .slice(0, 600);
  console.error(`✗ HTTP ${res.status}`);
  if (redacted) console.error(`  body (redacted): ${redacted}`);
  process.exit(1);
})();

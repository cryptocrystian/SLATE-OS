#!/usr/bin/env node
/**
 * Migration numbering guard (docs/72 §3.5, docs/PARALLEL_WORK.md §2). SLATE PLATFORM.
 *
 * Fails when supabase/migrations has:
 *   - a file not matching NNNN_<snake_case>.sql, or a duplicate number
 *   - (from 0022 on) a file without a module prefix:
 *       platform_ | consultos_ | governance_ | buildos_ | ventureos_
 *   - (from 0030 on) a file whose number is not claimed in ops/claims.json,
 *     or is claimed for a different module than its prefix
 *   - a gap in the sequence that nobody has claimed
 *
 * Gaps that ARE claimed are allowed: they are another branch's migrations in
 * flight. The next free number comes from the ledger, not from this branch.
 *
 * Usage: node scripts/check-migration-sequence.cjs [dir] [claimsFile]
 */
const fs = require("node:fs");
const path = require("node:path");

const LAYER_PREFIX_FROM = 22;
const CLAIMS_FROM = 30;
const NAME_RE = /^(\d{4})_([a-z0-9_]+)\.sql$/;
const MODULES = ["platform", "consultos", "governance", "buildos", "ventureos"];
const LAYER_RE = new RegExp(`^(${MODULES.join("|")})_`);
const pad = (n) => String(n).padStart(4, "0");

function loadClaims(claimsFile) {
  if (!claimsFile || !fs.existsSync(claimsFile)) return null;
  const json = JSON.parse(fs.readFileSync(claimsFile, "utf8"));
  return json.migrations ?? {};
}

function check(dir, claimsFile = path.join(dir, "..", "..", "ops", "claims.json")) {
  const errors = [];
  const claims = loadClaims(claimsFile);
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const seen = new Map();
  for (const f of files) {
    const m = NAME_RE.exec(f);
    if (!m) {
      errors.push(`bad filename: ${f}`);
      continue;
    }
    const n = Number(m[1]);
    if (seen.has(n)) errors.push(`duplicate number ${m[1]}: ${seen.get(n)} and ${f}`);
    seen.set(n, f);
    const layer = LAYER_RE.exec(m[2]);
    if (n >= LAYER_PREFIX_FROM && !layer) {
      errors.push(`missing module prefix (${MODULES.map((x) => x + "_").join("|")}) on ${f}`);
    }
    if (claims && n >= CLAIMS_FROM) {
      const claim = claims[m[1]];
      if (!claim) errors.push(`unclaimed migration number ${m[1]} (${f}): claim it in ops/claims.json first`);
      else if (layer && claim.module !== layer[1]) {
        errors.push(`${f} is claimed for module '${claim.module}', not '${layer[1]}'`);
      }
    }
  }
  const numbers = [...seen.keys()].sort((a, b) => a - b);
  const max = numbers.at(-1) ?? 0;
  for (let n = 1; n <= max; n++) {
    if (seen.has(n)) continue;
    if (claims && claims[pad(n)]) continue; // in flight on another branch
    errors.push(`sequence gap: ${pad(n)} is missing and not claimed in ops/claims.json`);
    break;
  }
  const claimedMax = claims ? Math.max(0, ...Object.keys(claims).map(Number)) : 0;
  const next = pad(Math.max(max, claimedMax) + 1);
  return { errors, next, count: numbers.length };
}

module.exports = { check, MODULES };

if (require.main === module) {
  const dir = process.argv[2] ?? path.join(__dirname, "..", "supabase", "migrations");
  const claimsFile = process.argv[3] ?? path.join(__dirname, "..", "ops", "claims.json");
  const { errors, next, count } = check(dir, claimsFile);
  if (errors.length) {
    console.error(`✗ migration sequence check failed (${dir}):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`✓ ${count} migrations in sequence. Next free number: ${next}`);
}

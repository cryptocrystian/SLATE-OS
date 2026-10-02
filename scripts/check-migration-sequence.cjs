#!/usr/bin/env node
/**
 * Migration numbering guard (docs/72 §3.5). SLATE PLATFORM.
 *
 * Fails when supabase/migrations has:
 *   - a gap or duplicate in the 4-digit sequence
 *   - a file not matching NNNN_<snake_case>.sql
 *   - (from 0022 on) a file without a layer prefix: platform_ | governance_ | buildos_
 *
 * The next free number is always "highest file at branch head + 1"; it is
 * re-checked against the live project's applied list before apply.
 *
 * Usage: node scripts/check-migration-sequence.cjs [dir]
 */
const fs = require("node:fs");
const path = require("node:path");

const LAYER_PREFIX_FROM = 22;
const NAME_RE = /^(\d{4})_([a-z0-9_]+)\.sql$/;
const LAYER_RE = /^(platform|governance|buildos)_/;

function check(dir) {
  const errors = [];
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
    if (n >= LAYER_PREFIX_FROM && !LAYER_RE.test(m[2])) {
      errors.push(`missing layer prefix (platform_|governance_|buildos_) on ${f}`);
    }
  }
  const numbers = [...seen.keys()].sort((a, b) => a - b);
  for (let i = 0; i < numbers.length; i++) {
    if (numbers[i] !== i + 1) {
      errors.push(`sequence gap: expected ${String(i + 1).padStart(4, "0")}, found ${String(numbers[i]).padStart(4, "0")}`);
      break;
    }
  }
  const next = String((numbers.at(-1) ?? 0) + 1).padStart(4, "0");
  return { errors, next, count: numbers.length };
}

module.exports = { check };

if (require.main === module) {
  const dir = process.argv[2] ?? path.join(__dirname, "..", "supabase", "migrations");
  const { errors, next, count } = check(dir);
  if (errors.length) {
    console.error(`✗ migration sequence check failed (${dir}):`);
    for (const e of errors) console.error(`  - ${e}`);
    process.exit(1);
  }
  console.log(`✓ ${count} migrations in sequence. Next free number: ${next}`);
}

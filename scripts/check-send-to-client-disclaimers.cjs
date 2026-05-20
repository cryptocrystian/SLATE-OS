#!/usr/bin/env node
"use strict";

/**
 * Phase 1B UX Polish — Send to Client disclaimer pin check.
 *
 * Closes (in part) `docs/30` Audit Note 2 "Canon-verbatim disclaimer
 * drift potential". The audit note recommended adding a CI lint or
 * doc-test that pins the `SEND_TO_CLIENT_DISCLAIMERS` constants to the
 * canon strings.
 *
 * This script verifies that:
 *
 *   1. `lib/client-delivery/send-to-client-types.ts` contains the
 *      canonical report disclaimer substrings (per `docs/29` § 13).
 *   2. `lib/client-delivery/send-to-client-types.ts` contains the
 *      canonical proposal disclaimer substrings (per `docs/29` § 13).
 *   3. `docs/29_PHASE_1B_SEND_TO_CLIENT_CHANNEL_CANON.md` ALSO contains
 *      the same substrings — so a future operator who edits ONE source
 *      cannot silently drift it away from the other.
 *
 * The substrings below are sourced from the CURRENT canon state in
 * `docs/29` § 13 + `SEND_TO_CLIENT_DISCLAIMERS` in
 * `lib/client-delivery/send-to-client-types.ts`. They are intentionally
 * stable phrases (no proper nouns inside, no numbers, no operator
 * names) so the pin survives ordinary editorial polish; a meaningful
 * canon amendment necessarily touches one of these phrases AND must be
 * mirrored in this script + docs/29 + the constant in lockstep.
 *
 * Exits 0 on success; exits 1 with a printed diff on the first miss.
 *
 * Pure Node — no TypeScript parser dependency, no NPM packages. Run
 * via `npm run check:send-to-client-disclaimers`.
 */

const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const TYPES_PATH = path.join(
  ROOT,
  "lib",
  "client-delivery",
  "send-to-client-types.ts",
);
const CANON_PATH = path.join(
  ROOT,
  "docs",
  "29_PHASE_1B_SEND_TO_CLIENT_CHANNEL_CANON.md",
);

/**
 * Substrings every canonical SLATE disclaimer for the REPORT artifact
 * kind MUST contain — both in the runtime constant AND in docs/29 § 13.
 * Sourced verbatim from the current canon; chosen to be stable phrases
 * that capture the canon semantics (no SLATE-side delivery; operator
 * hand-delivery; no recipient-delivery tracking).
 */
const EXPECTED_REPORT_SUBSTRINGS = [
  "SLATE does not deliver this link by email, CRM, or any other channel.",
  "copy the URL above and deliver it through your own channel",
  "SLATE does not track recipient delivery beyond access events on the SLATE public route.",
];

/**
 * Substrings every canonical SLATE disclaimer for the PROPOSAL artifact
 * kind MUST contain — both in the runtime constant AND in docs/29 § 13.
 * Captures the canon semantics (no SLATE-side delivery; operator
 * hand-delivery; commercial-discussion-not-a-contract boundary).
 */
const EXPECTED_PROPOSAL_SUBSTRINGS = [
  "SLATE does not deliver this link by email, CRM, or any other channel.",
  "copy the URL above and deliver it through your own channel",
  "not a contract, not an executed SOW, not a binding quote",
];

function checkFile(filePath, label, substrings) {
  let text;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch (err) {
    console.error(`✗ ${label}: failed to read ${filePath}: ${err.message}`);
    return 1;
  }
  const missing = substrings.filter((s) => !text.includes(s));
  if (missing.length === 0) {
    console.log(
      `✓ ${label}: all ${substrings.length} canonical substring(s) present`,
    );
    return 0;
  }
  console.error(
    `✗ ${label}: missing ${missing.length} of ${substrings.length} canonical substring(s):`,
  );
  for (const m of missing) {
    console.error(`    - "${m}"`);
  }
  return 1;
}

let failures = 0;

console.log(
  "Pinning Send to Client disclaimers against docs/29 § 13...",
);
console.log("");

// Runtime constant (SEND_TO_CLIENT_DISCLAIMERS in
// lib/client-delivery/send-to-client-types.ts).
failures += checkFile(
  TYPES_PATH,
  "send-to-client-types.ts (report disclaimer)",
  EXPECTED_REPORT_SUBSTRINGS,
);
failures += checkFile(
  TYPES_PATH,
  "send-to-client-types.ts (proposal disclaimer)",
  EXPECTED_PROPOSAL_SUBSTRINGS,
);

// Canon source of truth (docs/29 § 13 canonical disclaimer text).
failures += checkFile(
  CANON_PATH,
  "docs/29 § 13 (report disclaimer)",
  EXPECTED_REPORT_SUBSTRINGS,
);
failures += checkFile(
  CANON_PATH,
  "docs/29 § 13 (proposal disclaimer)",
  EXPECTED_PROPOSAL_SUBSTRINGS,
);

console.log("");
if (failures > 0) {
  console.error(
    `${failures} disclaimer pin check(s) failed.`,
  );
  console.error(
    "Either restore the canonical substrings to the file above OR",
  );
  console.error(
    "amend docs/29 § 13 + this script + the runtime constant in lockstep.",
  );
  process.exit(1);
}

console.log(
  "All canonical Send to Client disclaimer substrings pinned successfully.",
);
process.exit(0);

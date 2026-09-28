/** Migration numbering guard (docs/72 §3.6 test 8). SLATE PLATFORM. */
import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const { check } = require_("../../scripts/check-migration-sequence.cjs") as {
  check: (dir: string) => { errors: string[]; next: string; count: number };
};

function dirWith(files: string[]) {
  const d = mkdtempSync(join(tmpdir(), "slate-mig-"));
  for (const f of files) writeFileSync(join(d, f), "-- test");
  return d;
}

describe("check-migration-sequence", () => {
  it("passes on the repo", () => {
    const r = check(join(__dirname, "..", "..", "supabase", "migrations"));
    expect(r.errors).toEqual([]);
  });

  it("fails on a gap", () => {
    expect(check(dirWith(["0001_a.sql", "0003_b.sql"])).errors.join()).toMatch(/sequence gap/);
  });

  it("fails on a duplicate number", () => {
    expect(check(dirWith(["0001_a.sql", "0001_b.sql"])).errors.join()).toMatch(/duplicate number/);
  });

  it("requires a layer prefix from 0022", () => {
    const files = Array.from({ length: 22 }, (_, i) => `${String(i + 1).padStart(4, "0")}_x.sql`);
    expect(check(dirWith(files)).errors.join()).toMatch(/missing layer prefix/);
    files[21] = "0022_governance_x.sql";
    expect(check(dirWith(files)).errors).toEqual([]);
  });

  it("reports the next free number", () => {
    expect(check(dirWith(["0001_a.sql", "0002_b.sql"])).next).toBe("0003");
  });
});

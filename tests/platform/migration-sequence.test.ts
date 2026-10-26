/** Migration numbering guard (docs/72 §3.6 test 8; docs/PARALLEL_WORK.md §2). SLATE PLATFORM. */
import { describe, expect, it } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
const { check } = require_("../../scripts/check-migration-sequence.cjs") as {
  check: (dir: string, claimsFile?: string) => { errors: string[]; next: string; count: number };
};

function dirWith(files: string[]) {
  const d = mkdtempSync(join(tmpdir(), "slate-mig-"));
  for (const f of files) writeFileSync(join(d, f), "-- test");
  return d;
}

function claimsWith(migrations: Record<string, { module: string }>) {
  const f = join(mkdtempSync(join(tmpdir(), "slate-claims-")), "claims.json");
  writeFileSync(f, JSON.stringify({ migrations }));
  return f;
}

/** 0001..0029 unprefixed below 0022 and governance_ from 0022, as in the repo. */
const base = Array.from({ length: 29 }, (_, i) => `${String(i + 1).padStart(4, "0")}_${i + 1 >= 22 ? "governance_" : ""}x.sql`);

describe("check-migration-sequence", () => {
  it("passes on the repo (with its ledger)", () => {
    const r = check(join(__dirname, "..", "..", "supabase", "migrations"), join(__dirname, "..", "..", "ops", "claims.json"));
    expect(r.errors).toEqual([]);
  });

  it("fails on a gap", () => {
    expect(check(dirWith(["0001_a.sql", "0003_b.sql"])).errors.join()).toMatch(/sequence gap/);
  });

  it("fails on a duplicate number", () => {
    expect(check(dirWith(["0001_a.sql", "0001_b.sql"])).errors.join()).toMatch(/duplicate number/);
  });

  it("requires a module prefix from 0022", () => {
    const files = Array.from({ length: 22 }, (_, i) => `${String(i + 1).padStart(4, "0")}_x.sql`);
    expect(check(dirWith(files)).errors.join()).toMatch(/missing module prefix/);
    files[21] = "0022_governance_x.sql";
    expect(check(dirWith(files)).errors).toEqual([]);
    files[21] = "0022_consultos_x.sql";
    expect(check(dirWith(files)).errors).toEqual([]);
  });

  it("reports the next free number", () => {
    expect(check(dirWith(["0001_a.sql", "0002_b.sql"])).next).toBe("0003");
  });

  describe("with the claims ledger", () => {
    const claims = claimsWith({
      "0030": { module: "buildos" },
      "0031": { module: "consultos" },
      "0032": { module: "governance" },
    });

    it("allows a gap that another branch has claimed, and takes the next number from the ledger", () => {
      const r = check(dirWith([...base, "0030_buildos_a.sql", "0032_governance_c.sql"]), claims);
      expect(r.errors).toEqual([]);
      expect(r.next).toBe("0033");
    });

    it("refuses an unclaimed number", () => {
      const r = check(dirWith([...base, "0030_buildos_a.sql", "0031_consultos_b.sql", "0032_governance_c.sql", "0033_platform_d.sql"]), claims);
      expect(r.errors.join()).toMatch(/unclaimed migration number 0033/);
    });

    it("refuses a file whose prefix doesn't match its claim", () => {
      const r = check(dirWith([...base, "0030_governance_a.sql"]), claims);
      expect(r.errors.join()).toMatch(/claimed for module 'buildos'/);
    });

    it("still refuses an unclaimed gap", () => {
      const r = check(dirWith([...base, "0030_buildos_a.sql", "0034_platform_e.sql"]), claimsWith({ "0030": { module: "buildos" }, "0034": { module: "platform" } }));
      expect(r.errors.join()).toMatch(/0031 is missing and not claimed/);
    });
  });
});

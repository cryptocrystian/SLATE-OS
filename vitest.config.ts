import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

// SLATE test foundation (docs/72 §3.6). Unit + in-process DB (PGlite) tests.
export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, ".") },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // Each DB test file boots its own PGlite and replays every migration.
    testTimeout: 60_000,
    hookTimeout: 120_000,
    pool: "forks",
  },
});

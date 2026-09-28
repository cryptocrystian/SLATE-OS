/**
 * Platform G0 auth tests (docs/72 §3.6 test 7; docs/74).
 * Layer: SLATE PLATFORM.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const signOut = vi.fn(async () => ({ error: null }));
const exchangeCodeForSession = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: () => ({ auth: { exchangeCodeForSession, signOut } }),
}));
vi.mock("@/lib/env", () => ({ isSupabaseEnvConfigured: () => true }));

describe("auth callback re-checks the allowlist after the session exists", () => {
  beforeEach(() => {
    vi.stubEnv("SLATE_OPERATOR_EMAIL_ALLOWLIST", "");
    vi.stubEnv("SLATE_OPERATOR_DOMAIN_ALLOWLIST", "saipienlabs.com");
    signOut.mockClear();
  });
  afterEach(() => vi.unstubAllEnvs());

  async function call(email: string | null) {
    exchangeCodeForSession.mockResolvedValueOnce({
      data: { user: email ? { email } : null },
      error: null,
    });
    const { GET } = await import("@/app/auth/callback/route");
    const { NextRequest } = await import("next/server");
    return GET(new NextRequest("https://slate.test/auth/callback?code=abc"));
  }

  it("signs out a non-allowlisted session (e.g. minted directly via Supabase Auth)", async () => {
    const res = await call("attacker@example.com");
    expect(signOut).toHaveBeenCalledOnce();
    expect(res.headers.get("location")).toBe("https://slate.test/login?error=unauthorized");
  });

  it("signs out when the user has no email", async () => {
    const res = await call(null);
    expect(signOut).toHaveBeenCalledOnce();
    expect(res.headers.get("location")).toContain("error=unauthorized");
  });

  it("lets an allowlisted operator through", async () => {
    const res = await call("founder@saipienlabs.com");
    expect(signOut).not.toHaveBeenCalled();
    expect(res.headers.get("location")).toBe("https://slate.test/app");
  });
});

describe("workspace membership selection", () => {
  it("requires membership and honours role filters", async () => {
    const { selectMembership } = await import("@/lib/auth/authorization");
    const rows = [
      { workspace_id: "w2", role: "viewer" as const, created_at: "2026-02-01" },
      { workspace_id: "w1", role: "operator" as const, created_at: "2026-01-01" },
    ];
    expect(selectMembership([], {})).toEqual({ ok: false, error: "not-a-member" });
    const oldest = selectMembership(rows);
    expect(oldest.ok && oldest.row.workspace_id).toBe("w1");
    expect(selectMembership(rows, { workspaceId: "w3" })).toEqual({ ok: false, error: "not-a-member" });
    expect(selectMembership(rows, { workspaceId: "w2", roles: ["owner", "operator"] })).toEqual({
      ok: false,
      error: "forbidden-role",
    });
  });
});

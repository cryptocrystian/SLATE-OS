# G0 — Platform Prerequisites: Acceptance Audit

## Status

- **Date:** 2026-09-28
- **Branch:** `persistence/step-0-1-auth-shell` (working tree; **not committed**)
- **Layer:** SLATE platform (per `docs/72 §3`)
- **Verdict:** **ACCEPTED for code + verification.** Two items remain for the
  founder. Both are deliberately held:
  1. flip the Supabase "Allow new users to sign up" toggle (§5.1)
  2. apply `0022`/`0024`/`0025` to production, grant memberships, then `0023`
     after the self-test (§5.2)

---

## 1. Scope delivered vs. plan

| Plan item (`docs/72 §3`) | Delivered | Evidence |
|---|---|---|
| 3.1 Auth exposure audit + fix | Audit recorded (`docs/74`). Code fix: `shouldCreateUser: false` + callback allowlist re-check. Config toggle left to the founder. | `lib/auth/actions.ts`, `app/auth/callback/route.ts`, `tests/platform/auth.test.ts` |
| 3.2 Workspace membership + helpers | `0022`: table, 4 helpers (`is_workspace_member`, `has_workspace_role`, `has_any_workspace_membership`, `shares_workspace_with`), owner-only writes, no seed. `lib/auth/authorization.ts`. `scripts/platform/grant-workspace-membership.cjs`. | migration + tests 1–5 |
| 3.3 Existing-table RLS swap | `0023`: every live policy swapped (generated from live `pg_policies`), including the previously-`true` scorecard/profile/workspace policies. Precondition guard aborts if no active membership exists. **Held for post-self-test apply.** | migration, precondition test, branch before/after probe |
| 3.4 Lifecycle durability | `docs/75` audit. `0024` retention holds + delete guards (engagements, accounts, contacts, leads). `activity_events`/`notes`/`ai_synthesis_runs` survive deletion with `*_ref`. `ai_synthesis_runs` engagement-optional. `0025` durable file store + `lib/platform/files.ts`, `lib/platform/retention.ts`. | 10 lifecycle tests + branch run |
| 3.5 Migration numbering | `scripts/check-migration-sequence.cjs` (`npm run check:migrations`): gaps, duplicates, `platform_`/`governance_` prefix from `0022`. | 5 tests |
| 3.6 Test foundation | `vitest` + `@electric-sql/pglite` (dev only; Architect-approved 2026-09-28; **no Docker**). `tests/helpers/pglite-db.ts` replays every migration in-process with Supabase role/auth/storage stand-ins that mirror production's default privileges. Supabase dev-branch verification before production. | `npm test` |
| 3.7 Share-engine generalization | Decision recorded only (G5). | `docs/72 §3.7` |
| 3.8 GovernanceOS conventions | `docs/76`. | — |
| 3.9 Operating standard | `docs/73` v0.1 draft (⚑ items need founder decisions). | — |

## 2. Findings made during G0 (not in any prior doc)

| # | Finding | Severity | Disposition |
|---|---|---|---|
| F-1 | **Sign-up exposure confirmed reachable.** `disable_signup: false` + email provider on. Any holder of the public anon key could mint a session that passed all RLS. **Not exploited:** 2 auth users, both known. | High | Code layer fixed. Config toggle needed from the founder (`docs/74 §5`). DB layer = `0023` (held). |
| F-2 | Scorecard submissions/answers, profiles and workspaces had `true` policies. Any session could read and **write** inbound prospect data. | High | Closed by `0023`. |
| F-3 | **Production schema drift: `0018_accounts_attio_company_id` was never applied to production.** `lib/crm/queries.ts` selects `attio_company_id`, errors, and returns `null`. The Attio CRM context and "Link to Attio" have been silently off in production. This affects the current self-test. | Medium | **Not changed** (production, mid self-test). Founder decision: apply `0018` (additive, idempotent). |
| F-4 | Production's migration history table tracks only 4 of 21 migrations (earlier ones were applied via the Management API script). Supabase branches therefore can't auto-build the schema. | Low | Branch verification replays repo migrations explicitly. Worth reconciling the history table later. |
| F-5 | Newer Supabase projects grant **no** table privileges to API roles by default. Production grants everything. The first draft of `0022`/`0024`/`0025` relied on the default. | Medium (latent) | Fixed: every G0/G1 migration now states explicit grants/revokes. PGlite harness mirrors production's `pg_default_acl`. |
| F-6 | Supabase advisor: the trigger-only `SECURITY DEFINER` function was RPC-exposed to `anon`. | Low | Fixed (explicit revokes). Remaining advisor entries are intended caller-only helpers or pre-existing (`handle_new_auth_user`, mutable `search_path` on legacy `*_set_updated_at`, `citext` in `public`). |

## 3. Verification

**Local (PGlite, in-process, no Docker):**
- `npm test`: **61/61 passing** across 6 files (29 platform + 32 GovernanceOS).
- `npm run check:migrations` passes.
- `tsc --noEmit` clean. `next lint` clean. `next build` clean (all existing routes unchanged).

**Supabase dev branch `g0-platform-verify`** (real PG17 + Supabase auth/storage; $0.01344/h; created and **deleted** this session):

| Check | Result |
|---|---|
| Replay `0001`–`0021`; compare to production | Policies identical (hash match). Columns identical **except F-3**. |
| `0023` without memberships | Aborted by the precondition guard ✓ |
| Before `0023`, as a non-member session | Read the singleton workspace's findings, accounts, all profiles (exposure reproduced) |
| After `0023` | anon 0 rows. Non-member: own profile only. Other-workspace member: own workspace only. Operator: own workspace ✓ |
| Retention hold (superuser and member) | Delete refused. Release → delete allowed. Audit/AI-run rows kept with `engagement_ref`. Engagement-private rows still cascade ✓ |
| Re-apply `0022`/`0024`/`0025` | Idempotent ✓ |

## 4. ConsultOS impact

- **Zero ConsultOS code changes** apart from the shared auth path (sign-in +
  callback) and one optional `module` field on the platform logger. That field is
  only sent when set, so it's safe against a pre-`0024` database.
- After `0024`: audit/provenance rows outlive a manual engagement delete, and a
  held engagement can't be deleted. No reader changes, because every ConsultOS
  query filters by a specific live `engagement_id`.
- After `0023`: an operator **without** a membership row sees an empty app.
  That's why the grant step precedes it and the migration refuses to run otherwise.

## 5. Founder actions (in order)

1. **Now (closes F-1 fastest, no effect on existing operators):** Supabase →
   SLATE OS → Authentication → Sign In / Providers → turn **off** "Allow new
   users to sign up".
2. **Decide F-3:** apply `0018_accounts_attio_company_id.sql` to production
   (restores Attio context). Recommended before the self-test reaches the CRM checkpoint.
3. **When the self-test pauses** (or immediately, if you accept the small risk):
   apply `0022`, `0024`, `0025` to production. Then run
   `node scripts/platform/grant-workspace-membership.cjs <email> owner` for the
   founder and `… operator` for the second operator.
4. **After the self-test, before any external/client use:** apply `0023`, then run
   the `docs/69` smoke check.
5. Ratify `docs/73` (⚑ items) and `docs/76`.

## 6. Production apply log (2026-09-28, founder-approved)

- Founder disabled Supabase public sign-ups (verified `disable_signup: true`). F-1 config layer closed.
- Applied to production via Supabase `apply_migration` (now recorded in `supabase_migrations`):
  `0018` (F-3 fixed — Attio column restored), `0022`, then memberships (both existing
  accounts granted `owner`, founder decision), `0024`, `0025`.
- Post-apply checks: existing activity/AI-run rows fully backfilled (`*_ref`); 4 delete
  guards live; `slate-durable-files` bucket present; ConsultOS reads + writes shaped like
  current code succeed as an owner (probe rolled back); advisor output identical to the branch run.
- **Still held:** `0023` (the 32 singleton policies remain) — apply after the founder self-test.

### 6.1 `0023` applied (2026-10-01, founder-approved, after the Northpath self-test)

- Pre-flight: 2 auth users, 2 active `owner` memberships, 0 users without membership.
- Applied via Supabase `apply_migration` (tracked). Remaining singleton (`LIMIT 1`) policies: **0**; remaining `true` policies: **0**.
- Visibility, before vs. after, across 18 table groups (accounts, contacts, leads, scorecard,
  engagements, findings, opportunities, roadmap, report sections, proposal options, snapshots,
  share tokens, activity, AI runs, notes, intake, profiles, workspaces): **identical for both
  owners**; a signed-in non-member and `anon` now see **0 rows everywhere**.
- Owner ConsultOS write (activity insert) succeeds with `engagement_ref` filled (rolled back).
  Live routes unchanged (`/login` 200; `/app`, `/app/governance` → `/login` when signed out).
- **F-1 / F-2 fully closed** at the config, code and database layers.

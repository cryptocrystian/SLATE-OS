# Platform Auth Exposure Audit (G0)

## Status

- **Date:** 2026-09-28
- **Layer:** SLATE platform (G0, `docs/72 §3.1`)
- **Project:** Supabase `SLATE OS` (`hhglrcvsmwaheikdvijw`), production
- **Method:** read-only. Auth config read via the Supabase Management API
  (`GET /v1/projects/{ref}/config/auth`); `auth.users` and `pg_policies`
  read via SQL. No settings changed, no users removed.

---

## 1. Verdict

**The exposure is confirmed as reachable. It has not been exploited.**

Supabase Auth accepts new sign-ups (`disable_signup: false`) over the email
provider (`external_email_enabled: true`). SLATE's operator allowlist runs only
inside our `signInWithMagicLink` server action. The public anon key ships in
the browser bundle, so anyone can call Supabase Auth directly
(`POST /auth/v1/otp`) for their own address, click the link, and hold a valid
`authenticated` session. Until G0, every RLS policy accepted any
`authenticated` session against the singleton workspace. That session could
read and write all consulting data and all inbound scorecard data through
PostgREST, without ever touching the Next.js app.

`auth.users` held exactly **2 users** on the audit date. Both are known
operators (one `saipienlabs.com`, one founder `gmail.com`). There are no
anonymous users and no unconfirmed users. **Nothing needs to be removed.**

## 2. Live Auth configuration (relevant, non-secret fields)

| Setting | Value | Assessment |
|---|---|---|
| `disable_signup` | **false** | ✗ The root of the exposure. Must be `true`. |
| `external_email_enabled` | true | Required (magic link). |
| `external_phone_enabled` | false | ✓ |
| `external_anonymous_users_enabled` | false | ✓ |
| other `external_*` OAuth providers | none enabled | ✓ |
| `mailer_autoconfirm` | false | ✓ (a link click is still required) |
| `security_captcha_enabled` | false | Acceptable once sign-ups are off. |
| `rate_limit_email_sent` / `rate_limit_otp` | 2 / 30 | ✓ |
| `mfa_totp_enroll_enabled` | true | Enrollment allowed; not enforced. |
| `site_url` | staging Vercel alias | ✓ |
| `uri_allow_list` | localhost:3001 callback + `/**`, staging callback | Fine for now. Tighten `http://localhost:3001/**` before real client use. |

## 3. RLS inventory at audit time (from live `pg_policies`)

- **28 tables** with `workspace_id` use the check `workspace_id = (select id from workspaces limit 1)`.
  That means any authenticated session passes.
- `contacts`, `lead_fit_dimensions`, `lead_qualification_signals` do the same
  singleton check through their parent.
- `scorecard_submissions`, `scorecard_answers`: **`true`** for select and write.
  Any authenticated session could read and alter inbound prospect data.
- `profiles`, `workspaces`: select `true`.
- `storage.objects`: no policies (service-role only). ✓

## 4. Fix: three layers

| Layer | Change | State |
|---|---|---|
| **Config** | Set **"Allow new users to sign up" → off** (Auth → Providers → Email / `disable_signup: true`). Operators are invited by the founder from the dashboard. | **Founder action required.** Not changed by Claude: it's a security setting on the production project. See §5. |
| **Code** | `signInWithOtp(..., { shouldCreateUser: false })` (`lib/auth/actions.ts`). `/auth/callback` re-checks the allowlist after `exchangeCodeForSession` and signs out non-allowlisted sessions (`app/auth/callback/route.ts`). | Done. Unit-tested (`tests/platform/auth.test.ts`). |
| **Database (the actual control)** | `0022` workspace memberships + helpers. `0023` swaps every policy above to membership predicates. | Authored and tested (PGlite + dev branch). `0023` is **held until after the founder self-test** (Architect decision). |

The code layer only protects the app surface. A session minted directly
against Supabase never passes through `/auth/callback`. **Until the config
toggle is flipped or `0023` is applied, the exposure remains open.** The
config toggle is the fastest close, and it has no effect on existing operators.

## 5. Founder actions

1. Supabase dashboard → project **SLATE OS** → Authentication → Sign In / Providers →
   turn **off** "Allow new users to sign up". Existing operators keep signing in
   by magic link (`shouldCreateUser: false` matches this).
2. To add a new operator later: invite them from the dashboard (or
   `auth.admin.inviteUserByEmail`), add them to the allowlist env, then grant
   membership:
   `node scripts/platform/grant-workspace-membership.cjs <email> operator`.
3. Before applying `0023` (after the self-test), grant memberships to both
   current operators. The migration aborts if no active membership exists.

## 6. Residual items

- The `localhost:3001/**` wildcard in `uri_allow_list`: tighten before external use.
- MFA is enrollable but not enforced. That's a later platform decision (recommended
  before client users exist).
- `lib/activity/log.ts` still resolves the workspace with the singleton lookup.
  That's correct while there is one workspace, and it's migrated when a second
  workspace becomes possible.

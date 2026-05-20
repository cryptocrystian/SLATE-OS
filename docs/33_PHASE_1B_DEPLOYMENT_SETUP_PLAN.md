# Phase 1B Deployment Setup Plan

## Status

- **Date authored:** 2026-05-20
- **Branch at authoring:** `persistence/step-0-1-auth-shell`
- **Head at authoring:** `d79147a` (Verify Phase 1B production preconditions)
- **Sprint kind:** Operator/deployment planning — no source code changes
- **Document scope:** Decide and document the deployment path required to clear the three operator-side production preconditions documented in `docs/32` § 4.
- **Prerequisite:** `docs/32` precondition table (production preconditions) + `docs/31` readiness audit + `docs/29` Send to Client channel canon.

This doc is the **operator-runnable plan** for standing up a deployed staging environment so the Phase 1B Delivery Engine verdict can be re-verified end-to-end and promoted from "✅ Staging cleared, production preconditions partially pending" to "✅ Cleared for controlled external client exposure of `/r` and `/p` links."

**No source code changes proposed here.** The repo is already deployment-ready for zero-config Vercel detection of Next.js 14.

---

## 1. Decision matrix — staging deployment posture

| Option | Hosting | Supabase | Pros | Cons | Recommendation |
|---|---|---|---|---|---|
| **A — Vercel staging on existing Supabase** | Vercel (or Netlify) preview/staging | Existing `SLATE OS` project (`hhglrcvsmwaheikdvijw`), reads/writes go to existing tables, restricted to canonical test fixture engagement `76097653-fedb-42e5-9ef6-e89a0e97f802` (Sapient Digital) | Fastest; zero new Supabase cost; reuses already-applied migrations; operator can clear all three preconditions in one deploy. | Test rows/events land in the existing DB. Operator must hold the discipline of only mutating the canonical fixture engagement and the `STAGING WALKTHROUGH` audience labels. | ✅ **Recommended** for immediate precondition clearance. Matches the constraints the operator has already been honoring across the last six sprints. |
| **B — Vercel staging + separate Supabase schema in same project** | Vercel (or Netlify) preview/staging | Same project `hhglrcvsmwaheikdvijw`, but reads/writes go to a `slate_staging` schema (rather than `public`) | No new project cost; environment isolation at the schema layer. | Requires source code changes — the Supabase client currently reads/writes `public` schema by default; the cookie-bound + service-role clients would both need a schema-routing layer. Not a precondition-clearing path — it's a sprint of its own. | ❌ Not recommended for this sprint. Re-evaluate if the operator later wants schema-level isolation. |
| **C — Vercel staging on a new non-prod Supabase project** | Vercel (or Netlify) preview/staging | New Supabase project (recommended naming: `SLATE OS — staging`), migrations applied via `supabase db push` against source-tree `supabase/migrations/0001…0016.sql` | Cleanest environment isolation. Cleanest long-term staging posture. Lets the operator load test data without risking production rows. | Adds Supabase project cost (free tier likely sufficient short-term; check org plan limits). Requires migrations to be reapplied (operator-side, ~5 minutes). | 🟡 Recommended **after** Option A clears the immediate preconditions, OR immediately IF the operator wants permanent environment isolation before any controlled client exposure. |

**This plan documents Option A** as the recommended immediate path. Option C remains the recommended long-term posture; the operator chooses when to migrate from A to C based on usage growth.

---

## 2. Vercel deployment checklist (Option A)

### 2.1 Vercel project setup

1. **Sign in to Vercel** at <https://vercel.com> with the GitHub account that has access to `cryptocrystian/SLATE-OS`.
2. **Import the repo:**
   - Vercel Dashboard → **Add New → Project** → select **Import Git Repository** → choose `cryptocrystian/SLATE-OS`.
   - If the repo doesn't appear, click **Adjust GitHub App Permissions** and grant the SLATE-OS repo to the Vercel GitHub App.
3. **Framework Preset:** Vercel auto-detects **Next.js 14**. Accept the default.
4. **Root Directory:** `/` (repo root). No subdirectory selection needed.
5. **Build & Output Settings:** all defaults are correct.
   - Build Command: `next build` (auto-detected from `package.json` `"build"` script — leave Vercel default; do NOT override)
   - Output Directory: `.next` (auto-detected; do NOT override)
   - Install Command: `npm install` (auto-detected; do NOT override)
   - Development Command: `next dev` (Vercel-only, used when `vercel dev` runs locally — irrelevant for deployment)
6. **Node.js Version:** accept Vercel's default (currently Node 20.x). No `engines` pin in `package.json`, so the default applies.
7. **Region:** pick the region closest to the canonical Supabase project region (`us-east-2` per `list_projects`). Vercel's `iad1` (US East, N. Virginia) or `cle1` (US East, Cleveland) are the closest matches.

### 2.2 Branch selection

- **Production Branch on Vercel:** set to a NEW branch dedicated to staging — recommended `staging` — so production deploys are NOT triggered by every push to `main` or `persistence/step-0-1-auth-shell`.
- Vercel will create:
  - **Production deployment** from the `staging` branch → URL like `https://slate-os.vercel.app` (or whatever the project is named) — this is the "deployed staging" URL.
  - **Preview deployments** from every other branch push (free on hobby tier; per-deploy-hour billable on Pro). For Phase 1B precondition verification, preview deployments aren't required — only the production deployment from `staging` matters.
- **Workflow recommendation:** keep merging Phase 1B sprints into `persistence/step-0-1-auth-shell` as today, then merge that branch into `staging` when ready to refresh the staging deploy. This gives the operator explicit control over what's deployed.

### 2.3 Deploy

1. Click **Deploy** after env vars are set (see § 4 below). Don't deploy before env vars are configured — the first build will fail without them.
2. First build takes ~2–4 minutes (Vercel cold cache).
3. Vercel will assign a stable production URL (e.g., `https://slate-os.vercel.app`) — record this as the **staging host URL** below in § 6.

### 2.4 Custom domain (optional)

- Skip for the initial precondition clearance. The default `*.vercel.app` URL works for `/r/<token>` and `/p/<token>` links.
- If/when SLATE moves to a custom-domain staging (e.g., `staging.saipienlabs.com`), set it in Vercel Dashboard → Project → **Settings → Domains**; DNS instructions are platform-standard.

---

## 3. Supabase posture (Option A)

### 3.1 Project selection

- **Use:** existing `SLATE OS` project (`hhglrcvsmwaheikdvijw`, region `us-east-2`).
- **Source of truth:** the Supabase Dashboard environment panel for this project supplies all four required Supabase env vars (URL, anon key, service role key, project ref).

### 3.2 Hard guardrails for the staging deploy

These are operational disciplines, not code guards. The operator commits to:

- **Canonical test fixture only.** Every action taken from the deployed staging UI MUST target engagement `76097653-fedb-42e5-9ef6-e89a0e97f802` (Sapient Digital) OR explicitly operator-created STAGING WALKTHROUGH engagements with audience labels prefixed `STAGING WALKTHROUGH YYYY-MM-DD`.
- **No service-role SQL writes from outside the action layer.** All mutations flow through existing server actions. Direct SQL via Dashboard SQL editor is allowed for READ-ONLY verification queries (see § 6) but not for mutations.
- **No destructive SQL** (no `DELETE`, no `TRUNCATE`, no `DROP`) against any table outside an explicit operator-authored migration.
- **No mutation of real client engagements** even if real client rows exist in the same project.

### 3.3 Migration parity for the staging deploy

- Migrations 0001–0016 are assumed already applied in the existing project (this is the project the local dev server has been operating against successfully for the prior six sprints).
- Operator confirms parity via the manual SQL queries in § 6.2.

---

## 4. Environment variables (operator sets these in Vercel)

**Claude must NEVER see or set these in the deployed env.** The operator copies values directly from the Supabase Dashboard + their own pepper-generation step into the Vercel env panel.

| Var | Visibility | Source | Notes |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public (browser bundle) | Supabase Dashboard → Project Settings → API → **Project URL** | Currently `https://hhglrcvsmwaheikdvijw.supabase.co`. Required by `@supabase/ssr` cookie-bound client + the service-role server client. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public (browser bundle) | Supabase Dashboard → Project Settings → API → **anon public** | Required for client-side auth + RLS-respecting reads. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only | Supabase Dashboard → Project Settings → API → **service_role** | NEVER prefix with `NEXT_PUBLIC_`. Used exclusively in `server-only`-tagged modules (`lib/supabase/service.ts` + `lib/reports/share-token-public.ts` + `lib/proposals/share-token-public.ts`). Required for anonymous `/r/[token]` + `/p/[token]` route lookups (anonymous users have no RLS-visible rows; the service-role client looks them up server-side). |
| `NEXT_PUBLIC_SITE_URL` | Public | The Vercel-assigned URL (e.g., `https://slate-os.vercel.app`) — set AFTER first deploy completes | Used by Supabase magic-link redirect. Must be HTTPS for the deployed staging. |
| `SLATE_SHARE_TOKEN_ACCESS_PEPPER` | Server-only | Operator generates a fresh 64+-char base64url value (do NOT reuse the local-dev pepper) | Operator pepper-generation one-liner: `node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"`. Per `lib/share-tokens/access-signature.ts`, when this var is unset the H1 fingerprint helper safe-degrades to `hashesOmitted: true` (canon-allowed for non-prod but RECOMMENDED for production). |
| `SLATE_OPERATOR_DOMAIN_ALLOWLIST` | Server-only | Set to `saipienlabs.com` per `.env.example` | Comma-separated domains allowed to sign in via magic-link. Empty values fail-closed (every email rejected). |
| `SLATE_OPERATOR_EMAIL_ALLOWLIST` | Server-only | Optional — empty unless specific external operators need access | Comma-separated exact emails. Either this OR `SLATE_OPERATOR_DOMAIN_ALLOWLIST` must be set. |
| `OPENAI_API_KEY` | Server-only | Required ONLY if AI synthesis (Steps 1, 1.1, 2) should be functional in staging | When absent, AI surfaces render the controlled "AI synthesis is not configured" state and the build stays clean. Optional for precondition clearance; can be added later. |
| `SLATE_AI_PROVIDER` | Server-only | Set to `openai` if AI is wired | Defaults to `openai`; leave unset to disable. |
| `SLATE_AI_FINDINGS_MODEL` | Server-only | Optional override; default `gpt-4o-mini` | |
| `SLATE_AI_OPPORTUNITIES_MODEL` | Server-only | Optional override; default `SLATE_AI_FINDINGS_MODEL` | |

**Pepper-generation command (operator runs locally; never share output with Claude):**
```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```
Length will be exactly **64 chars** (48 bytes → 64 base64url chars). This meets the 64-char production minimum from `docs/29` § 4.

**Setting env vars in Vercel:**
1. Vercel Dashboard → Project → **Settings → Environment Variables**.
2. For each var: enter Name + Value, select **Production** environment (NOT Preview, NOT Development), click **Save**.
3. After all vars are set, click **Deployments → … → Redeploy** on the latest deployment (or push a fresh commit) so the new env vars take effect. Vercel does NOT auto-redeploy on env-var change.
4. Confirm each var is set by checking the **Environment Variables** list shows the expected names + the Production environment chip.

---

## 5. Post-deploy verification (clears Precondition 3)

After Vercel finishes the first deploy from the `staging` branch, the operator runs:

```sh
# Replace <staging-host> with the Vercel-assigned URL (e.g., slate-os.vercel.app)
STAGING_HOST="<staging-host>"

# Expect 200 OK + Cache-Control: no-store, must-revalidate + X-Robots-Tag: noindex, nofollow + Referrer-Policy: no-referrer
curl -sI "https://${STAGING_HOST}/r/test-noop"
curl -sI "https://${STAGING_HOST}/p/test-noop"

# Expect 404 Not Found
curl -sI "https://${STAGING_HOST}/s/test"
curl -sI "https://${STAGING_HOST}/sow/test"
```

**Expected output (all four checks):**

| Path | Expected status | Expected headers |
|---|---|---|
| `/r/test-noop` | `200 OK` | `Cache-Control: no-store, max-age=0`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer` |
| `/p/test-noop` | `200 OK` | `Cache-Control: no-store, max-age=0`, `X-Robots-Tag: noindex, nofollow`, `Referrer-Policy: no-referrer` |
| `/s/test` | `404 Not Found` | (no special headers required) |
| `/sow/test` | `404 Not Found` | (no special headers required) |

**Bonus body-shape verification (no token leak beyond Next.js RSC framework echo):**
```sh
curl -s "https://${STAGING_HOST}/r/test-noop" | grep -oiE "unavailable|Contact the sender|advisory only" | sort -u
curl -s "https://${STAGING_HOST}/p/test-noop" | grep -oiE "unavailable|Contact the sender|not a binding quote|written approval" | sort -u
```
Both should return the expected canon-disclaimer markers. Per `docs/30` Audit Note 4, the literal token segment `test-noop` will appear exactly once in each body — this is framework-level Next.js RSC hydration payload, not a SLATE-side leak.

After all four checks pass against the deployed host, **paste the curl output into `docs/32` § 4 Precondition 3 row** as evidence. The verification report from the re-issued Phase 1B Production Preconditions Verification Sprint can then promote the verdict.

---

## 6. Manual Supabase verification (clears Precondition 2)

Run from the Supabase Dashboard → **SQL Editor** of the `SLATE OS` project, NOT via Claude/MCP. All queries are READ-ONLY.

### 6.1 Confirm the share-token + delivery-snapshot tables exist

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in (
    'report_share_tokens',
    'proposal_share_tokens',
    'report_delivery_snapshots',
    'proposal_delivery_snapshots'
  )
order by table_name;
```
**Expect:** 4 rows — `proposal_delivery_snapshots`, `proposal_share_tokens`, `report_delivery_snapshots`, `report_share_tokens`.

### 6.2 Confirm RLS enabled on every share-token table

```sql
select schemaname, tablename, rowsecurity
from pg_tables
where schemaname = 'public'
  and tablename in (
    'report_share_tokens',
    'proposal_share_tokens',
    'report_delivery_snapshots',
    'proposal_delivery_snapshots'
  )
order by tablename;
```
**Expect:** 4 rows, each with `rowsecurity = true`.

### 6.3 Confirm NO anon policies on share-token tables

```sql
select
  pg_class.relname as table_name,
  pg_policy.polname as policy_name,
  pg_policy.polroles::regrole[] as policy_roles
from pg_policy
join pg_class on pg_policy.polrelid = pg_class.oid
where pg_class.relname in (
  'report_share_tokens',
  'proposal_share_tokens'
)
order by table_name, policy_name;
```
**Expect:** every row's `policy_roles` includes `{authenticated}` and **never** `{anon}`. Public anonymous reads are deliberately impossible — only the server-side service-role client looks up share-tokens, after which it re-evaluates eligibility before rendering.

### 6.4 Confirm token_hash uniqueness + SHA-256 shape

```sql
-- Check the unique index on token_hash exists.
select indexname, indexdef
from pg_indexes
where tablename in ('report_share_tokens', 'proposal_share_tokens')
  and indexdef ilike '%token_hash%'
order by tablename, indexname;
```
**Expect:** at least one `UNIQUE` index per table whose definition references `token_hash`. The migration files (`0014_report_share_tokens.sql`, `0016_proposal_share_tokens.sql`) declare these inline as part of the table definition.

### 6.5 Confirm metadata jsonb columns present

```sql
select table_name, column_name, data_type
from information_schema.columns
where table_schema = 'public'
  and table_name in ('report_share_tokens', 'proposal_share_tokens')
  and column_name = 'metadata'
order by table_name;
```
**Expect:** 2 rows, both with `data_type = jsonb`. The `metadata` column is where the `markReport(Proposal)LinkSentToClientAction` writes the canon-sanctioned `lastSentToClientAt` / `sendCount` / `lastSentChannel` keys.

### 6.6 Paste results into docs/32

After running all five queries, paste the results inline below the Precondition 2 row in `docs/32` § 4 (preserve the column shapes — copy-paste the result grid from the Supabase Dashboard).

---

## 7. Deployed env pepper verification (clears Precondition 1)

The operator confirms via the Vercel Dashboard:

1. Vercel Dashboard → Project → **Settings → Environment Variables**.
2. Filter / scroll to `SLATE_SHARE_TOKEN_ACCESS_PEPPER`.
3. **Expect:** entry present, set for `Production` environment, value masked.
4. Vercel does not show the value once saved (eyes-only at entry time) — that is correct. The operator should record only:
   - Present? (Y)
   - Length category (≥64 chars? Y)
   - Environment (Production)
5. Paste this status as a single line into `docs/32` § 4 Precondition 1 row.

---

## 8. End-to-end smoke test against deployed staging (optional but recommended)

After § 5–7 land, the operator runs through the four Lane walkthroughs from `docs/32` § 1 once more against the deployed host:

- **Lane 1 (Report)** — operator logs in via magic link against the deployed host, navigates to `https://${STAGING_HOST}/app/engagements/76097653-…/report`, generates a fresh PDF candidate, mints a share link with audience `"STAGING WALKTHROUGH YYYY-MM-DD LANE 1 DEPLOYED"`, visits the `/r/<token>` URL anonymously (in a private browser window), confirms canon-correct artifact OR canon-correct generic-unavailable, revokes, re-visits.
- **Lane 2 (Proposal)** — same shape on `/proposal` panel.
- **Lane 3 (SOW Draft)** — generate fresh proposal candidate + approve + Generate SOW Draft + open internal route + void.
- **Lane 4 (Send to Client)** — exercise both report-side + proposal-side mark-sent flows via the modal.

Each lane uses the same UI/action-layer-only methodology from `docs/32` (no service-role SQL writes).

**Acceptance:** all four lanes pass against the deployed host with identical canon-correct behavior. If any lane fails, document the failure inline below `docs/32` § 1 and pause before any external client exposure.

---

## 9. Sign-off checklist (operator-completable)

After all preconditions clear:

- [ ] Vercel project imported, branch `staging` deploying from `cryptocrystian/SLATE-OS`
- [ ] All required env vars set in Vercel (§ 4)
- [ ] First deploy succeeded (build ✅ + start ✅)
- [ ] § 5 curl checks pass against deployed host
- [ ] § 6 Supabase verification queries pass
- [ ] § 7 deployed env pepper presence confirmed
- [ ] § 8 optional end-to-end smoke test passes (if performed)
- [ ] `docs/32` § 4 updated inline with all evidence
- [ ] `docs/08` and `docs/10` status blocks updated
- [ ] Verdict promoted to "✅ Phase 1B Delivery Engine cleared for controlled external client exposure of /r and /p links"

---

## 10. Out of scope for this plan

- Email / CRM / e-signature / public SOW route / SOW share tokens — explicitly deferred per `docs/29` § 17 (post-acceptance fork). Operator opens new canons at `docs/34`+ when business priority requires.
- Migration to Option C (separate non-prod Supabase project) — operator chooses when to migrate after Option A clears immediate preconditions.
- Custom domain setup — operator's choice; not required for precondition clearance.
- CI/CD pipeline (GitHub Actions / Vercel-side build hooks beyond defaults) — operator's choice; not required.
- Production monitoring / alerting / observability — operator's choice; not required for precondition clearance.
- Backup / disaster recovery posture for the staging Supabase — defer until after Option C lands.

---

## 11. Files modified by this plan

- `docs/33_PHASE_1B_DEPLOYMENT_SETUP_PLAN.md` (this file — new)
- `docs/32_PHASE_1B_DELIVERY_ENGINE_STAGING_WALKTHROUGH.md` (cross-reference added to § 4)
- `docs/08_CURRENT_STATUS.md` (status block updated)
- `docs/10_SESSION_HANDOFF.md` (chronology + next-planned updated)

**No source code changes.** Read-only planning doc per the sprint prompt.

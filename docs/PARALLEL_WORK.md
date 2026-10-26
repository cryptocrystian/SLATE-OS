# Working on SLATE in parallel

Several Claude sessions build SLATE modules at the same time: ConsultOS,
GovernanceOS, BuildOS, VentureOS, and the platform. They share one repo, one
migration sequence, one production database and one production deploy. These
five rules keep them from colliding. **Every session reads this before writing
anything.**

---

## 1. One worktree + branch per session

- The **trunk** (integration branch) is `persistence/step-0-1-auth-shell`.
  Nobody develops directly in the main checkout's trunk.
- Each session works in its own worktree and branch, named
  `<module>/<topic>`: `governance/launch-path`, `buildos/b2-worker`,
  `consultos/scorecard-launch`, `ventureos/v0-canon`, `platform/<topic>`.
  - Create it with `git worktree add -b <branch> .claude/worktrees/<name> origin/persistence/step-0-1-auth-shell`.
    `.claude/` is git-ignored. The desktop app's "new session in worktree" does the same.
  - Worktrees created from Windows resolve only through Windows git; run
    `npm`/`vitest` inside WSL against the same path. Share `node_modules` by
    symlinking it to the main checkout's.
- Merge to the trunk only when the branch's tests pass, then delete the worktree.
  Rebase on the trunk before merging (`git fetch && git rebase origin/persistence/step-0-1-auth-shell`).

## 2. Claim numbers before writing

`ops/claims.json` is the ledger for **migration numbers** and **doc numbers**.

1. `git fetch` and take the next free number from the ledger (not from your branch).
2. Add your claim, then commit and push that one-line change **to the trunk**
   right away, in its own commit.
3. Only then create the file.

Migration filenames are `NNNN_<module>_<name>.sql`, where module is one of
`platform`, `consultos`, `governance`, `buildos` or `ventureos`.
`npm run check:migrations` fails on:
- a duplicate number
- a missing or wrong module prefix
- a file whose number isn't claimed for that module
- a gap that nobody has claimed

Gaps that *are* claimed (another branch's work in flight) are allowed.

Doc numbers are claimed the same way. Cite docs by full filename when a
number is ambiguous (see `known_collisions`).

## 3. Shared files: small, separate commits

Every module touches these, so change them only in tiny dedicated commits that
reach the trunk quickly:
- `components/layout/sidebar-nav.tsx`
- `.eslintrc.json`
- `package.json` / `package-lock.json`
- `lib/activity/types.ts`
- `lib/platform/modules.ts`
- `scripts/check-migration-sequence.cjs`
- `ops/claims.json`

Status docs (`docs/08`, `docs/09`, `docs/10`) are **append-only**: add an entry
and never rewrite another module's.

Module code stays inside its module's folders (`lib/<module>`, `app/app/<module>`,
`components/<module>`, `tests/<module>`). The ESLint boundary rules enforce the
imports between them.

## 4. One release owner for production

There is one production Supabase project (`hhglrcvsmwaheikdvijw`) and one Vercel
production deploy (`slate-os-staging.vercel.app`). **Exactly one session at a
time** releases, always from the trunk, in this order:

1. All branches in the release are merged and the trunk's `npm test`,
   `tsc --noEmit`, `next lint` and `next build` pass.
2. **Dry-run** each new migration on production inside `begin … rollback`.
3. Apply the release's migrations in number order (Supabase `apply_migration`,
   so they're tracked), then mark them `"applied"` in `ops/claims.json`.
4. Promote the deployment. Production does **not** auto-deploy from `staging`,
   so promote the trunk build with `vercel promote <url>`, then record the
   previous deployment id as the rollback target.
5. Smoke-check the live routes and log the release in `docs/08`.

Never apply another session's migration, and never deploy a trunk whose
migrations aren't all applied. That ships code against a schema that doesn't
exist yet.

## 5. Founder decisions stay with the founder

Ratifying policies, naming approvers, applying to production and promoting
deploys all need the founder's explicit go-ahead, every time.

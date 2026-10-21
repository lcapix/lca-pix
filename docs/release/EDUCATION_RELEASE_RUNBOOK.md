# Release runbook: the education screens

The release that puts the 35 education screens live. Do the steps **in order**. Every step that
touches production needs Shreya's go; nothing here has been run on production yet.

## What people will see change

- **Everything they look at.** A new landing page, sign-up and About you, a new Home, the case
  workspace (tree in five lanes, Inventory, Results with cost beside impact, step costs), the
  project pages (Cases, People, Compare, Analytics, Reports), a student Home, and a read-only phone
  view. The classic screens stay in the code behind two flags (see Rollback).
- **A flow now reaches its cost.** Adding or changing a flow on a step offers that step's material
  or energy cost from the flows ("Material cost from these flows: $0.12 · Use it") and names any
  material with no price ("No price for Packaging tape: add its cost"). Nothing changes until Use it.
- **New accounts** get a finished sample study (the painted steel bracket, 1.72 kg CO₂-eq) built
  when they sign up. **Existing accounts** keep their projects, which appear on the new Home; they
  can add the sample from Home ("Add the sample study").
- **Nobody is signed out.** `JWT_SECRET` does not change in this release.
- **Preview deployments** lose Vercel's toolbar: the Content Security Policy is now enforced and does
  not allow `vercel.live`. Production never shows the toolbar.
- **Nothing else.** The data people entered is untouched: the release migrations add tables and
  columns and four library substances, and remove nothing (rehearsed, below).

## What the release contains

| Part | Detail |
|---|---|
| Code | branch `v1-production` (on top of 9227580; one commit, made with her go) |
| Migrations | 033 to 042, all additive and idempotent: 033 a flow may have no amount yet, 034 own factor per flow, 035 cost basis per step, 036 list indexes, 037 per-case privacy, 038 sample flags, 039 four sample substances, 040 held import lines, 041 pinned projects, 042 the AI switch and checked-reply cache |
| Deploy gate | `pnpm vercel-build` runs `scripts/db/check-migrations.mjs` before `next build`: a production build stops if a migration has not reached its database |
| Health | `GET /api/health`: 200 `{"status":"ok","db":"ok","commit":"<sha>"}`, 503 when the database does not answer |
| Logs | production server lines are JSON (lib/observability); errors carry `"alert":true` |
| Dependencies | Next.js 15.5.27 (the 15.5.26 advisories fixed); six "latest" ranges pinned |

## Before the day

1. **Environment variables on Vercel (Production).** Required and already set: `DATABASE_HOST`,
   `DATABASE_PORT`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`, `JWT_SECRET`,
   `NEXT_PUBLIC_APP_URL`. Recommended: `DATABASE_SSL=true` with `DATABASE_SSL_CA`. Optional, each
   switches a feature on with no code change:
   - `KV_REST_API_URL` and `KV_REST_API_TOKEN` (or the Upstash pair): rate limits shared across
     server instances, so "reads left this hour" is exact. Without them each instance counts alone.
   - `HF_TOKEN`: Magic Insights' written narration. Without it the computed summary shows.
   - `NEXT_PUBLIC_LCAPIX_LMS_NAME=Canvas`: names the course system on the hand-in line.
   - Error monitoring: a Vercel log drain to the provider, filtered on `"alert":true`.
2. **A fresh dump of production**, then the rehearsal on it, locally:
   ```bash
   node scripts/db/rehearse.mjs <today's lcapix-prod dump> --from=033 --baseline-through=025
   ```
   It must end with `every check held`. On the Oct 14 copy it did (2026-10-21): 033 to 042 applied
   in 2.1 s; five new empty tables, four substances, ten ledger rows; no row removed anywhere; a second
   runner pass applied nothing; each file run again by hand changed none of the 28 table checksums;
   the final schema matched the tested one with 0 differences.
   `--baseline-through=025` mirrors how production's ledger was started. Production now has a
   ledger (24 rows, 009 to 032): **never run `--baseline` on production again.**

## The day

1. **Snapshot the database** (RDS snapshot of `lcapix-prod`) and keep a `mysqldump` beside it.
2. **Dry run against production.** From a machine that can reach it, with the production values in a
   local env file that is never committed:
   ```bash
   node --env-file=<prod env file> scripts/db/migrate.mjs --dry-run --allow-remote
   ```
   It asks you to type the database name. It must list exactly `migrate-033` to `migrate-042` as
   pending. Anything else pending, or a checksum warning on 033 to 042: stop and look.
3. **Apply them.** The same command without `--dry-run`. Each file is recorded as it applies; a
   failure stops the run and records nothing for that file. The code now live keeps working on the
   new schema: every change is a new table, an index, or a new column with a default, and 033 only
   allows an empty flow amount, which only the new code writes. Verified 2026-10-21: production's code
   (b5bed3d) passed its own API suite, 1,550 of 1,550, on a database built with all 34 migrations.
4. **Confirm the gate will pass:**
   ```bash
   node --env-file=<prod env file> scripts/db/check-migrations.mjs --force
   ```
   Expect `all 34 migrations are on <database>`.
5. **Vercel: production branch = `main`** (Project, Settings, Git). Today it is `v1-hardening`.
6. **Merge.** Push `v1-production`, open a pull request into `main`, wait
   for the checks (CI: typecheck, unit, build, gitleaks, DB, API, browser tests), merge with "Create a
   merge commit".
   The push to `main` deploys production twice if both paths stay on: the GitHub workflow's
   `vercel --prod` job (needs the `VERCEL_TOKEN`, `ORG_ID`, `PROJECT_ID` secrets) and Vercel's own Git
   deploy of the production branch. Both run the migration gate; keep one (Vercel's Git deploy is the
   simpler) and disable the other.
7. **Watch the build.** It prints `[migrations] all 34 migrations are on …` before `next build`. A
   build that stops there means step 3 did not reach the database the deployment uses.

## The live smoke test

Read-only, no account needed:

```bash
curl -s https://<domain>/api/health
```
Expect `{"status":"ok","db":"ok","commit":"<the merge commit's first 7>"}`.

```bash
node scripts/security/check-headers.mjs https://<domain>
```
Expect `0 misses` (the enforced CSP, HSTS, nosniff, frame denial and the rest, on a page, log in, an API
route, a 404 and a static file).

Then in a browser: the landing page shows the bracket and 1.72; `/auth/login` loads; an unauthenticated
`/api/projects` answers 401. With the team's own account: Home opens, a project opens, a case runs.

## Rollback

- **Code:** Vercel, Deployments, the previous production deployment, Instant Rollback. The schema stays;
  the old code runs on it (step 3, verified).
- **Only the screens:** `NEXT_PUBLIC_LCAPIX_SHELL=classic` (and `NEXT_PUBLIC_LCAPIX_WORKSPACE=classic` for
  the case workspace) bring the classic screens back. They are read at build time, so set them and
  redeploy.
- **The database:** the migrations are not reversed. Restore the snapshot from step 1 only if data is
  damaged, which the rehearsal says these migrations do not do.

## Still open (not blocking the release)

- Cardboard in the sample: the library has a factor for it (0.937), so the design's "no factor" line
  is false; the sample leaves cardboard out for now (1.72, not 1.78). Her decision.
- The Pricing and Security pages still carry lines the D10 review flagged.
- The Overview of a project of your own is still the classic page.
- The members API still allows sharing a sample project (the screens never offer it).
- 31 advisories in build-time and install-time packages are accepted with reasons in
  `scripts/security/audit-accepted.json`; review on every dependency change.

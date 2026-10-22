# Release runbook: the education screens, on Postgres

The release that puts the 35 education screens live, now on Postgres (Neon, through Vercel) instead of
MySQL on AWS RDS. Do the steps **in order**. Every step that touches production needs Shreya's go.

## What people will see change

- **Everything they look at.** A new landing page, sign-up and About you, a new Home, the case
  workspace (tree in five lanes, Inventory, Results with cost beside impact, step costs), the
  project pages (Cases, People, Compare, Analytics, Reports), a student Home, and a read-only phone
  view. The classic screens stay in the code behind two flags (see Rollback).
- **A flow now reaches its cost.** Adding or changing a flow on a step offers that step's material
  or energy cost from the flows ("Material cost from these flows: $0.12 · Use it") and names any
  material with no price ("No price for Packaging tape: add its cost"). Nothing changes until Use it.
- **New accounts** get a finished sample study (the painted steel bracket, 1.72 kg CO₂-eq) built
  when they sign up. **Existing accounts** keep their projects, which appear on the new Home.
- **Their data is production as of Oct 14, 2026** (the newest copy that could be taken before AWS
  access was lost). Anything entered on the live site after Oct 14 is not carried over.
- **Nobody is signed out.** `JWT_SECRET` does not change, and every account keeps its id.
- **The database moves; nothing about it is visible.** Every case computes exactly what it did on
  MySQL: all 32 production cases, 64 runs, 655 values, bit-identical (port log, P4).

## What the release contains

| Part | Detail |
|---|---|
| Code | branch `v1-postgres` (on top of `66d49ff`, the tested MySQL release; one commit, made together) |
| Database | Neon Postgres 17, loaded once from the Oct 14 production copy by `~/lca/ops/load-neon-2026-10-22.sh`: schema (`db/pg/000-schema.sql`) and every row in one transaction, then proved (row count and fingerprint per table, schema 0 differences, deploy gate) |
| Data layer | `lib/db.ts` (pg, mysql2-shaped results) and `lib/db-dialect.ts`; MySQL-only SQL rewritten at the site; port log `~/lca/research/postgres-port-log.md` |
| Deploy gate | `pnpm vercel-build` runs `scripts/db/check-migrations.mjs` before `next build`: a production build stops unless the database records the baseline and every file in `db/pg/migrations` |
| Health | `GET /api/health`: 200 `{"status":"ok","db":"ok","commit":"<sha>"}`, 503 when the database does not answer |
| Logs | production server lines are JSON (lib/observability); errors carry `"alert":true` |

## The load (once, before the merge)

1. In Vercel, Storage, the Neon database: copy `DATABASE_URL_UNPOOLED` (the direct connection) into
   `~/lca/.neon.env` as `NEON_URL=…`. Never commit it, never paste it in a chat.
2. Run `bash ~/lca/ops/load-neon-2026-10-22.sh` and type the Neon database name when asked.
3. It must end with all three: `27 tables copied, every row count and fingerprint the same`,
   `0 differences`, `[migrations] all 2 migrations are on <database>`. If the load fails, Neon is
   left exactly as it was: fix the cause and run it again.

## Vercel

1. **Environment variables (Production, and Preview).** The Neon integration added `DATABASE_URL`
   (the pooled connection). The new code reads it first. **Leave the old `DATABASE_HOST`,
   `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` (RDS) in place for now:** the current
   production deployment uses them, and Instant Rollback needs them. Remove them once the release
   has run cleanly. `JWT_SECRET` and `NEXT_PUBLIC_APP_URL` stay as they are. Optional, each switches
   a feature on with no code change: `KV_REST_API_URL` and `KV_REST_API_TOKEN` (exact "reads left"),
   `HF_TOKEN` (Magic Insights narration; needs credits), `NEXT_PUBLIC_LCAPIX_LMS_NAME=Canvas`.
2. **Preview deployments** need a database with the schema too. If the Neon integration makes a
   branch per preview, it copies the loaded database and works; if Preview points at an empty
   database, previews answer 500 (the gate only warns on previews).
3. **Production branch = `main`** (Project, Settings, Git). Today it is `v1-hardening`.
4. **One production deploy path.** A push to `main` runs both the GitHub workflow's `vercel --prod`
   job and Vercel's own Git deploy if both are on; keep one (Vercel's Git deploy is the simpler).

## The merge

1. Push `v1-postgres` and open a pull request into `main`. The checks (typecheck, unit, build,
   gitleaks, DB, API and browser tests, now on a Postgres 17 service) must pass.
2. Merge with "Create a merge commit".
3. Watch the build: it prints `[migrations] all 2 migrations are on <database>` before `next build`.
   A build that stops there means the deployment's `DATABASE_URL` is not the loaded Neon database.

## The live smoke test

```bash
curl -s https://<domain>/api/health
```
Expect `{"status":"ok","db":"ok","commit":"<the merge commit's first 7>"}`.

```bash
node scripts/security/check-headers.mjs https://<domain>
```
Expect `0 misses`.

Then in a browser: the landing page shows the bracket and 1.72; log in with an existing account;
Home lists its projects; open a case and run it: the numbers are the ones it had before.

## Rollback

- **Code and database together:** Vercel, Deployments, the previous production deployment, Instant
  Rollback. It runs the MySQL release against RDS, as before. Anything written on Neon after the
  switch is not on RDS: say so to anyone affected. This works only while RDS runs and its variables
  are still set.
- **Only the screens:** `NEXT_PUBLIC_LCAPIX_SHELL=classic` (and `NEXT_PUBLIC_LCAPIX_WORKSPACE=classic`
  for the case workspace), then redeploy. They are read at build time.

## After the release

- Remove the RDS `DATABASE_*` variables from Vercel once the release has run cleanly.
- When AWS access is back: a final snapshot of `lcapix-prod`, then delete it, and check that the old
  `lca-dev-db` (about $354 a month in September) and the EC2 box are gone.
- A schema change from now on: a numbered file in `db/pg/migrations`, rehearsed on a restored copy of
  Neon (`node scripts/db/rehearse.mjs --from=<local copy>`), applied with
  `node --env-file=<prod env> scripts/db/migrate.mjs --allow-remote` before the merge that needs it.

## Still open (not blocking the release)

- Cardboard in the sample: the library has a factor for it (0.937), so the design's "no factor" line
  is false; the sample leaves cardboard out for now (1.72, not 1.78). Her decision.
- The Pricing and Security pages still carry lines the D10 review flagged.
- Production's data has three old findings (integrity report, the same on MySQL and Postgres): 3 steps
  whose level is not their depth, 27 library substances with an empty category, 51 texts encoded twice.
- 31 advisories in build-time and install-time packages are accepted with reasons in
  `scripts/security/audit-accepted.json`; review on every dependency change.

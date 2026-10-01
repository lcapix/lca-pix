# Deploy checklist — `v1-hardening-kavish`

This branch changes authentication, the database schema and the deploy pipeline. Do these steps **in order**. Nothing here has been deployed yet.

## 0. Before anything (people)
- [ ] Rotate the RDS master password; create a least-privilege app user (SELECT/INSERT/UPDATE/DELETE on `lca_v3` only); enforce TLS (`require_secure_transport=ON`).
- [ ] Rotate `JWT_SECRET` in every environment (this logs everyone out — expected; old tokens are rejected anyway, see §4).
- [ ] Change the password of the old E2E test account; confirm no seed/demo accounts exist in production.
- [ ] Decide on the git history purge (the procedure is in the private audit folder, `05-history-purge.md`). Rotation first, purge second.
- [ ] Take an RDS snapshot.

## 1. Vercel (and Amplify/Docker if used) environment variables — all required now
`lib/db.ts` no longer falls back to built-in values; missing variables make every database request fail.
- [ ] `DATABASE_HOST`, `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME`
- [ ] `JWT_SECRET` (≥ 32 random bytes: `openssl rand -base64 32`)
- [ ] `NEXT_PUBLIC_APP_URL`
- [ ] Recommended: `DATABASE_SSL=true` and `DATABASE_SSL_CA` (the RDS CA bundle, inline PEM is fine)
- [ ] Optional: `DATABASE_PORT` (default 3306); `UPSTASH_REDIS_REST_URL`/`_TOKEN` or `KV_REST_API_URL`/`_TOKEN` for shared rate limits (without them limits are per server instance)
- [ ] Existing: `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`, `HF_TOKEN`, integration API keys

## 2. Database migrations (before the new code serves traffic)
The new code reads columns that only exist after these migrations; deploying code first makes case routes fail.
- [ ] From a machine with access (never from CI): `node --env-file=<prod env file> scripts/db/migrate.mjs --dry-run --allow-remote`
- [ ] First time only: `--baseline` marks 009–025 as already applied (they are, in production). Confirm with the team that 009–025 were all applied; if unsure, check for their columns first.
- [ ] Apply 026–032 with the runner (it records each in `schema_migrations`):
  - 026 result values → DOUBLE (tiny results no longer stored as 0)
  - 027 results keep their rows when a step is deleted (FK `ON DELETE SET NULL`)
  - 028 wood fuel / lumber split (wood fuel factor back to 94.956 kg CO₂e/MMBtu)
  - 029 GWP vintage per method (data only)
  - 030 flow quantities → DOUBLE
  - 031 account profile columns (no-op where they already exist)
  - 032 case ownership + "members see only their own cases" (off by default)
- [ ] Run the read-only integrity report: `node --env-file=<prod env file> scripts/db/integrity-report.mjs` and review (known: 3 components with no parent at levels 3/5; 27 legacy substances with an empty category).

## 3. GitHub
- [ ] CI now deploys to production only on push to `main`; pull requests run checks only. Make `check`, `secrets` (gitleaks), `db-tests`, `api-tests` and `e2e` required checks.
- [ ] The first PR's gitleaks run may flag the committed test-account password in old commits until the history purge — clear with the purge or a `.gitleaksignore` fingerprint.

## 4. What users will notice after deploy
- Everyone signs in again (tokens now carry a revocation fingerprint).
- Old Google accounts sign in normally; a password previously set on a Google-owned email stops working (account takeover protection).
- Request limits: login 5/min, signup 3/hour, insights 20/hour, import 10/hour, runs 30/hour, price lookups 60/hour per user.
- Uploads over 12 MB are refused with a message (Vercel's own limit is 4.5 MB).
- Non-admins no longer see Integrations; the factor library is admin-protected.
- People outside a project get "not found" for its URLs.

## 5. Decisions still open (product / domain)
- TRACI GWP vintage (keep AR4 + recompute 4 fuel rows, or move to AR5 — methane 25→28).
- Coal acidification rows 82/272/319 (quarantine or convert).
- Natural-gas m³ basis (28.263 vs EPA 27.60 m³/MMBtu, +2.4%).
- TRACI seed "Nitrogen Oxides" CAS number before anyone re-runs the openLCA import on production.
- Custom substance names unique per user instead of globally.

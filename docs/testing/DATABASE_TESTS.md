# Database tests

`pnpm test:db` builds a Postgres database from nothing, runs the database tests against it, and drops it. It needs no existing data and no dump, so it runs the same way on any machine and in CI.

```
db/pg/000-schema.sql            the schema (MySQL's at migration 042, ported 2026-10-21)
db/pg/001-reference.sql         the library (categories, permissions, substances, factors, cost rates, templates)
scripts/db/migrate.mjs          every db/pg/migrations/migrate-NNN-*.sql, recorded in schema_migrations
        │
        ▼
lcapix_t_<time>_<random>        throwaway database → tests/db/** → dropped
```

The app ran on MySQL until 2026-10-21. The 34 MySQL migrations (`migrate-0NN-*.sql` in the repo root) and `db/baseline/` stay as history: their result is `db/pg/000-schema.sql` and `001-reference.sql`, written by `scripts/db/pg/schema-from-mysql.mjs` and `scripts/db/pg/copy-from-mysql.mjs` and checked by `scripts/db/pg/compare-schema.mjs` (0 differences). The port is logged in `~/lca/research/postgres-port-log.md`.

## Running it

You need:

- A local Postgres, 17 (what CI and Neon run). No command-line client is needed: every script uses the `pg` driver.
- A user that can `CREATE DATABASE` and `DROP DATABASE`, for example local `postgres`. The integrity tests plant broken rows with `session_replication_role`, which needs a superuser.
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER` and `DATABASE_PASSWORD`, either in the environment or in `.env.local`. Values already in the environment win. `DATABASE_NAME` is ignored, so the database `.env.local` points at is never touched.

A local server in Docker, reachable from this machine only:

```bash
docker run -d --name lcapix-pg -p 127.0.0.1:5432:5432 -e POSTGRES_HOST_AUTH_METHOD=trust postgres:17
```

| Command | What it does |
|---|---|
| `pnpm test:db` | Builds a fresh database, runs `tests/db/**`, then drops the database. It takes a few seconds. |
| `pnpm test:db tests/db/schema.test.ts` | Runs one file, still against a fresh database. |
| `DB_TESTS_KEEP=1 pnpm test:db` | Keeps the database afterwards and prints its name. |
| `npx vitest run` | Runs the unit tests. `tests/db` is excluded because it needs a server. |

`tests/e2e-local` (`pnpm test:db:e2e-local`) holds checks written against MySQL; they are not part of any suite now.

### Safety

- Only `127.0.0.1`, `localhost` and `::1` are accepted. Nothing can override this: a remote host is refused.
- Only databases named `lcapix_t_*` are ever created or dropped. `CREATE DATABASE` fails if the name is already taken, so an existing database is never reused or overwritten.
- If a build fails halfway, it drops its own half-built database.
- The runner refuses remote hosts unless given `--allow-remote` plus a typed confirmation. The database tests never pass that flag.

### Building a database by hand

```bash
node --env-file=.env.local scripts/db/fresh.mjs                # build one, print its name
node --env-file=.env.local scripts/db/fresh.mjs --no-migrate   # baseline only
node --env-file=.env.local scripts/db/fresh.mjs --from=NAME    # a copy of another local database
node --env-file=.env.local scripts/db/fresh.mjs --keep-on-error
node --env-file=.env.local scripts/db/fresh.mjs --drop lcapix_t_xxx
node --env-file=.env.local scripts/db/fresh.mjs --list
node --env-file=.env.local scripts/db/fresh.mjs --drop-stale   # built over 60 min ago (or =N minutes)
node --env-file=.env.local scripts/db/fresh.mjs --drop-all     # every lcapix_t_*, including a run in progress elsewhere
```

A test run that is killed (Ctrl-C) cannot drop its database. Clear leftovers with `--drop-stale`.

## The baseline

- **`db/pg/000-schema.sql`**: the schema. Every string column has the collation `ci` (ICU, case- and accent-blind, as MySQL's `*_ci` were), so `=`, unique keys and `GROUP BY` ignore case. Postgres 17 refuses `LIKE` and regular expressions on such a column: write `col COLLATE "C" ILIKE '…'`. MySQL's `tinyint(1)` is `smallint` (code compares with 0 and 1), an enum is text with a `CHECK` (plus `''`, which legacy rows hold), `ON UPDATE CURRENT_TIMESTAMP` is the `set_updated_at` trigger, and index names carry their table (`<table>__<name>`).
- **`db/pg/001-reference.sql`**: the library as MySQL migration 042 left it, written by `pg_dump --data-only --inserts`; each id counter is set past its largest id.
- **App SQL** still uses `?` placeholders and gets mysql2-shaped results: `lib/db.ts` and `lib/db-dialect.ts` translate (placeholders, `insertId` through `RETURNING`, MySQL error codes, booleans as 1/0). Write new SQL in Postgres's dialect with `?` placeholders.

## What each test guards

| File | Test | Guards against |
|---|---|---|
| `migrations.test.ts` | the baseline files are recorded with their checksums | a database built from something else |
| | a new numbered migration is applied and recorded; a second run changes nothing (schema, ledger, library) | new migrations being missed, or re-applied |
| | an edited, already-applied file is reported (`WARNING … changed since it was recorded`) and not re-run | silent drift between the repo and the databases |
| | a file that fails changes nothing and is not recorded (each file runs in one transaction) | a half-applied migration |
| | a database without the baseline is refused | migrating the wrong database |
| `schema.test.ts` | every string column has the collation `ci` | text compared by case, which MySQL never did |
| | `impact_value` and `contribution_percentage` are double precision | small results stored as 0 (RUN-2) |
| | `assessment_results.component_id` is nullable, with exactly one key, `ON DELETE SET NULL` | deleting a step erasing history (RUN-1) |
| | unique keys: factor `(substance, category, method, scope)`, `substance_name`, `email`, `username`, `(project_id, user_id)`, `category_name`, `permission_name`, `cost_rates.unique_rate`, `process_templates.template_name`, `comparison_metadata.comparison_id`, `lcia_gwp_vintage` PK, `schema_migrations` PK | upserts in 015/017/028 duplicating rows; duplicate accounts and memberships |
| | lookup indexes: component by case and parent, flows by component and substance, runs by case, results by run and component, factors by method and category, and others | slow tree, flow, run and factor loads |
| | FK delete rules (cascades from project → case → step → flow; results cascade with the run; RESTRICT on substances and categories) | orphans, or accidental deletes of library rows |
| | every table has a primary key | |
| | account profile columns exist | AUTH-7 |
| | spot checks for columns from 009–042; an `updated_at` trigger on every table with the column, and no other function | MySQL's `ON UPDATE CURRENT_TIMESTAMP` lost |
| `field-limits.test.ts` | every column size in `lib/field-limits.ts` (varchar length, numeric precision and scale; text columns are text, the 65,535-byte TEXT limit is the API's own rule) equals `information_schema` | a migration resizing a column while the API keeps validating against the old size (the oversized-input 500s) |
| `integrity.test.ts` | every tenant check in `scripts/db/integrity-report.mjs` returns 0 rows on a seeded world | |
| | each core check fires on its defect, inside a rolled-back transaction: orphan step, orphan flow, parent in another case, parent cycle, self-parent, wrong `hierarchy_level`, result without run, member without account, owner membership for a non-owner, two final cases | a check that can never fail |
| `factor-data.test.ts` | no live factor row with a `QUARANTINE: <method>` twin | E2 |
| | Wood (MMBtu) is 94.956 kg CO2 eq/MMBtu, and 'Wood, dimensional lumber' (kg) is 0.187, under all three methods | E1 |
| | the only live factors whose unit denominator is outside the substance's unit family are factor rows 27 (Water) and 34 (Wastewater). Both are zeroed per-kg rows on m3 substances. Any new one fails | E11 |
| | `lcia_gwp_vintage` has rows for each method, and TRACI is AR4 | E5 |
| | the audited anchors: electricity US 0.350, Global 0.473, EU 0.242; natural gas 1.877 kg CO2 eq/m3 | |
| | at most 27 substances with an empty category | new invalid rows |
| `run-snapshot.test.ts` | a run frozen the way `POST /api/cases/:id/assessments` freezes it (same SQL, same `lib/run-snapshot` helpers, the real engine) keeps a byte-identical snapshot, the same totals, per-step rows and report parts after a step is deleted. Its result rows survive with `component_id` NULL and still add up. A new run reflects the edit | RUN-1, STAGE-2, EXP-1 |
| `precision.test.ts` | 4.2e-7, 4.2e-9, 1.5e-15, … round-trip exactly in `impact_value`; 0.004 in `contribution_percentage`; the SUM keeps them | RUN-2 |
| | `flows.quantity` keeps 4.2e-7, and the column is double precision | |

## Integrity report on real data

The same checks run read-only against any **local** database:

```bash
node --env-file=.env.local scripts/db/integrity-report.mjs --db=lcapix_db_tests --rows
```

Findings on the July 2026 dev data plus all migrations (`lcapix_db_tests`, 2026-09-30):

| Check | Count | Notes |
|---|---|---|
| `hierarchy_level_mismatch` (EDIT-9) | 3 | Components 233094, 233146 and 233147 have no parent but levels 3 and 5 |
| `substance_empty_category` | 27 | Legacy seed substances 16–43 have `category = ''` |
| `mojibake_text` | 7 | Factor provenance with a double-encoded "—" (`â€”`). It is present in `lcapix_db_tests` but not in a fresh build, so it came from how that copy was loaded, not from the migrations |

Every other check returned 0: orphans, cross-case parents, cycles, dangling results, members, owners, QUARANTINE twins and duplicate factor keys. No data was changed.

## Adding a migration

1. Name it `db/pg/migrations/migrate-NNN-short-name.sql`, using the next free number (the first is 043; the numbers carry on from the MySQL series). The runner orders by number and refuses two files with the same number.
2. Each file runs in one transaction with its ledger row, so a failing file changes nothing. Still make data changes upserts (`ON CONFLICT`) or delete-then-insert on natural keys.
3. Never edit a file that has been applied anywhere. Write a new one. The ledger reports an edited file and does not re-run it.
4. Run `pnpm test:db`. The new file is picked up automatically: `fresh.mjs` hands the directory to `migrate.mjs`.
5. If the migration changes something these tests pin, update the expectation in the same PR and say why: a column type, key or delete rule (`schema.test.ts`), a factor value or unit (`factor-data.test.ts`), a column size (`lib/field-limits.ts`).
6. Before applying it to production, rehearse it on a copy: restore a `pg_dump` of Neon into a local database, then `node scripts/db/rehearse.mjs --from=<that database>`. It must end with `every check held` (no table loses rows, a second run applies nothing, the schema equals a fresh build).
7. Apply: `node --env-file=<prod env> scripts/db/migrate.mjs --allow-remote` (it asks for the database name). The deploy gate (`scripts/db/check-migrations.mjs`, in `pnpm vercel-build`) stops a production build until every file is recorded there.

Do not edit `db/pg/000-schema.sql` or `001-reference.sql` after the first production load: change the schema with a numbered migration.

## CI

The `db-tests` job in `.github/workflows/deploy.yml` runs on pull requests only:

1. A `postgres:17` service container starts with trusted local login.
2. The job installs dependencies (no database client is needed).
3. It runs `pnpm test:db`.

The job is not a dependency of `deploy`. To make it block merges, mark it required in branch protection.

## API suite (`pnpm test:api`)

`pnpm test:api` (`vitest.api.config.ts`) runs `tests/api-real/**`: the API, authorization and security tests against a real database. It reuses this suite's global setup, so it builds a fresh `lcapix_t_*` database the same way, runs every file one at a time against it, and drops it pass or fail. It takes about 40 s locally.

- **No server.** A test imports a route module and calls its exported handler with a `NextRequest` (headers, JSON or multipart body, cookies, client IP) and a `params` Promise, the way Next calls it. `tests/api-real/support/api.ts` finds the route file for a concrete URL the way the App Router does.
- **Only outbound network is mocked.** `support/outbound.ts` replaces `fetch` with fixtures for BLS, EIA, Metals-API, Electricity Maps, PubChem, Google (token, userinfo) and the Hugging Face router (an SSE stream that starts with role-only, reasoning-only and keep-alive events). A request to any other host fails the test that made it. `security/error-leaks.test.ts` is the one file that also wraps `@/lib/db-helpers`, to force database errors.
- **Accounts are real.** `support/users.ts` signs up through `POST /api/auth/signup`, so tokens carry `pv`. SQL (throwaway database only) makes a platform admin, deactivates an account or changes a password hash. `support/world.ts` builds the standard world of TEST_PLAN §2.3 through the API.
- **Every error body is scanned.** `support/http.ts` fails the test when a 4xx/5xx body contains an SQL error code or keyword, the word mysql, a stack frame, a source path with a line number or an RDS host.
- **Limits.** A fresh in-memory rate-limit store before each test; `RATE_LIMIT_STORE=memory`; no upstream API keys unless a test sets one.

| Folder | What |
|---|---|
| `authz/matrix.test.ts` | Generated from `docs/flows/flows.yaml` `permissions:`: 69 rows × 7 roles, plus a deactivated account, a revoked token and a wrong-secret token on every signed-in row (673 cells). A 404 for a non-member must be byte-identical to the missing-id 404; a refused write must leave every writable table's fingerprint (md5 over every row) unchanged. |
| `authz/route-coverage.test.ts` | Every exported handler in `app/api/**/route.ts` has a row, and every row a handler. |
| `authz/cross-tenant.test.ts` | Every id-bearing row replayed with the other tenant's ids (404, no names, no writes), and body-borne ids: parent step, substance, source case, attach step, run override, legacy case ids, document and member ids. |
| `flows/f01…f19` | USER_FLOWS F1–F19 at the API level, in the order the UI calls the routes. F19 (the tour) is client-only; its file checks the reads behind the tour's pages. |
| `security/*` | JWT refusal, Google OAuth, login enumeration, rate limits, upload size and type, CSV formula injection, SQL-injection fuzz over every path and query parameter, mass assignment, oversized and malformed input, error leakage, logout cookies, security headers. |

Known bugs are tests too: each is an `it.fails` whose comment names the bug and the file and line that cause it, so the suite goes red when a fix lands and the marker must flip. To see why each one fails today, turn them into plain tests for one run: `grep -rl "it.fails(" tests/api-real | xargs sed -i '' 's/it\.fails(/it(/'`, run `pnpm test:api`, then `git checkout -- tests/api-real`.

Known bugs pinned today: none (0 `it.fails`; the matrix, error-leak and oversized-input files keep their `it.fails` hooks for the next one). The 38 pinned at `2009f63` were fixed on `fix/bugs38`, each by flipping its `it.fails` to `it`:

| Bug | Severity | Test (now `it`) | Fix |
|---|---|---|---|
| Ingest apply wrote another user's private `substance_id` into the caller's case (L3, ingest twin of FLOW-5) | Medium | `authz/cross-tenant.test.ts` › ingest/apply (+ new append-mode twin) | `app/api/ingest/apply/route.ts` looks every plan substance up through `lib/flow-fields.ts` `findUsableSubstance` (library, or the caller's own); anything else is 400 "Flow n: Unknown substance…" before any write, no name echoed |
| Ingest preview offered other users' private substances as matches and candidates (ING-9, L3) | Medium | `authz/cross-tenant.test.ts` › ingest/preview | `app/api/ingest/preview/route.ts` builds the match catalog from `is_custom = 0 OR created_by = ?` |
| Run creation returned `details: error.message` on a 500 (L1) | Medium | `security/error-leaks.test.ts` › R23 (+ request-id and engine-path tests) | `lib/http.ts` `internalError()`: `{ error, request_id }`, the error logged under the id; the failed run's `error_log` stores the id, not the message; the run modal shows "reference <id>" |
| Strings longer than their column answered 500 (or a misleading 409 "needs migrate-014"): project name/description/goal fields, case name/description/reference flow unit, duplicate and import case names, component unit/process type/driver fields/description, flow unit/driver description/transport mode, profile fields (PROF-1), ingest node names | Medium | `security/oversized-input.test.ts` (15 rows, now requiring 400, an error naming the field and unchanged tables), `flows/f18-profile.test.ts`, `flows/f13-import.test.ts` | `lib/field-limits.ts` holds every column size (VARCHAR in characters, TEXT in UTF-8 bytes, DECIMAL precision/scale), checked against each fresh database by `tests/db/field-limits.test.ts`; routes validate before their first write; composed names ("(Copy)", "(n)") are cut to fit |
| Malformed JSON answered 500 on 11 write routes | Low | `security/oversized-input.test.ts` › malformed JSON (11 rows) | every route reads its body with `lib/http.ts` `readJson()`: 400 "Invalid JSON body" / "Request body must be a JSON object" |
| A cost, quantity or scale target larger than its DECIMAL column, or a non-finite scale target, answered 500 | Low | `flows/f08-costs.test.ts`, `security/oversized-input.test.ts` › numbers | `lib/component-fields.ts` `nonNegative(column, v)` bounds by the column; scale takes 0.000001 to 999,999,999.999999 and maps a derived overflow to 400 after the rollback; case reference flow, flow transport distance and ingest numbers bounded too |
| Replaying a scale request scaled the inventory again (COST-7) | Low | `flows/f08-costs.test.ts` › COST-7 (+ three concurrent requests apply once) | `app/api/cases/[caseId]/scale/route.ts` locks the case, reads the product quantity with a locking read and answers 409 unless `from` equals it |
| Two cases in one project could both be the hand-in (WRITE-1) | Low | `flows/f15-class-mode.test.ts` › WRITE-1 (+ a shared class project keeps one hand-in per student) | marking a hand-in locks the project and clears `is_final`/`finalized_at` on the same author's other cases in the project (`created_by`, migrate-032) in the same transaction: a new hand-in replaces that author's previous one |
| Runs made in the same second were listed in no defined order | Low | `flows/f09-run-results.test.ts` | `ORDER BY run_date DESC, run_id DESC` in the case's run list and `lib/comparison-engine.ts` |
| The worked example always skipped its argon flow | Low | `flows/f04-project-example.test.ts` (+ every example substance is a library row) | `lib/example-case.ts` no longer names Argon (no sourced factor exists to seed; see the commit) |

Fixed on this branch, each with its own test: the export route's `details: error.message` on a 500 (`security/error-leaks.test.ts` › R42), `lib/integrations/admin-guard.ts` mapping auth failures with `isAuthError` (`tests/integrations/admin-guard.test.ts`), the stale `RATE_LIMITS` comment (`tests/lib/rate-limit-wiring.test.ts`), and the class page offering the Admin role to non-owners (`tests/app/class-page.test.tsx`).

Useful switches: `API_TESTS_VERBOSE=1` keeps the routes' console output; `DB_TESTS_KEEP=1` keeps the database. CI runs the suite in the `api-tests` job (pull requests, Postgres 17), next to `db-tests`.

## Differences from TEST_PLAN §4

- Databases are named `lcapix_t_*`, not `lca_test_*`.
- The files are `000-schema.sql` and `001-reference.sql`, with a hyphen instead of an underscore.
- The seed carries the whole pre-009 library rather than a hand-picked subset. It is 34 KB, and `migrate-009` onward need those rows by name.
- `database/migrations/002`–`008` are not replayed. The baseline already contains their effect as the dev database had it.

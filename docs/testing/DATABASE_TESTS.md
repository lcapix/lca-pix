# Database tests

`pnpm test:db` builds a MySQL database from nothing, runs the database tests against it, and drops it. It needs no existing data and no dump, so it runs the same way on any machine and in CI.

```
db/baseline/000-schema.sql      pre-009 schema, structure only
db/baseline/001-reference.sql   reference rows (categories, permissions, substances, factors, cost rates)
scripts/db/migrate.mjs          every migrate-NNN-*.sql in the repo root, recorded in schema_migrations
        │
        ▼
lcapix_t_<time>_<random>        throwaway database → tests/db/** → dropped
```

## Running it

You need:

- A local MySQL server, 8.0 or later. It is tested on 9.6 locally and on 8.0 in CI.
- The `mysql` command-line client on your `PATH`. Some migrations use `DELIMITER`, which only the CLI understands.
- A user that can `CREATE DATABASE` and `DROP DATABASE`, for example local `root`.
- `DATABASE_HOST`, `DATABASE_PORT`, `DATABASE_USER` and `DATABASE_PASSWORD`, either in the environment or in `.env.local`. Values already in the environment win. `DATABASE_NAME` is ignored, so the database `.env.local` points at is never touched.

| Command | What it does |
|---|---|
| `pnpm test:db` | Builds a fresh database, runs `tests/db/**`, then drops the database. It takes about 10 s. |
| `pnpm test:db tests/db/schema.test.ts` | Runs one file, still against a fresh database. |
| `pnpm test:db:e2e-local` | Runs the same suite, then `tests/e2e-local/**` against the same fresh database. It sets `LOCAL_DB=1` and adds one fixture account for those tests to sign in as. |
| `DB_TESTS_KEEP=1 pnpm test:db` | Keeps the database afterwards and prints its name. |
| `npx vitest run` | Runs the unit tests. `tests/db` is excluded because it needs a server. |

The original way of running the local tests still works: `LOCAL_DB=1 npx vitest run tests/e2e-local` against whatever `.env.local` names.

### Safety

- Only `127.0.0.1`, `localhost` and `::1` are accepted. Nothing can override this: a remote host is refused.
- Only databases named `lcapix_t_*` are ever created or dropped. `CREATE DATABASE` fails if the name is already taken, so an existing database is never reused or overwritten.
- If a build fails halfway, it drops its own half-built database.
- The runner still refuses remote hosts unless given `--allow-remote` plus a typed confirmation. The database tests never pass that flag.

### Building a database by hand

```bash
node --env-file=.env.local scripts/db/fresh.mjs                # build one, print its name
node --env-file=.env.local scripts/db/fresh.mjs --no-migrate   # baseline + seed only
node --env-file=.env.local scripts/db/fresh.mjs --keep-on-error
node --env-file=.env.local scripts/db/fresh.mjs --drop lcapix_t_xxx
node --env-file=.env.local scripts/db/fresh.mjs --list
node --env-file=.env.local scripts/db/fresh.mjs --drop-stale   # built over 60 min ago (or =N minutes)
node --env-file=.env.local scripts/db/fresh.mjs --drop-all     # every lcapix_t_*, including a run in progress elsewhere
```

A test run that is killed (Ctrl-C) cannot drop its database. Clear leftovers with `--drop-stale`.

## The baseline

### `000-schema.sql`

- **Size:** 18 KB, structure only.
- **What it is:** every `CREATE TABLE` from `lca_v3-dump-20260708-181808.sql`, the last dump of the dev database taken before `migrate-009`. That is the schema `migrate-009` onward was written against.
- **How it relates to the old files:** it equals `lca_v3_drawsql_schema.sql` plus `database/migrations/002`–`008` as the dev database actually had them. The drawsql file itself is stale (TEST_PLAN §4.1).
- **Verified:** baseline plus all migrations gives a schema identical to the dump plus the same migrations. Every column, type, default, collation, comment, index, foreign key, CHECK constraint and table collation was compared through `information_schema`.
- **Two edits by the generator:**
  - `AUTO_INCREMENT` counters are removed.
  - The six account profile columns are removed. See the next section.

### Account profile columns (AUTH-7)

The profile and Google OAuth routes use six columns on `account`: `full_name`, `company`, `role`, `use_case`, `country` and `onboarded_at`. No migration created them; the dev database got them by hand. `migrate-031-account-profile.sql` now adds each one only if it is missing, with the same definition and position as the dev database.

Leaving them out of the baseline means:

- every fresh database proves that migration works;
- existing databases, which already have the columns, are left unchanged.

It is numbered 031 because 030 is reserved for a change being written in parallel.

### `001-reference.sql`

- **Size:** 34 KB.
- **Contents:** the reference rows as they stood before `migrate-009`:
  - `impact_categories`: 8 rows
  - `permissions`: 4
  - `substances`: 42
  - `driver_impact_factors`: 162
  - `cost_rates`: 20
- **No user data.** Accounts, projects, cases, components, flows, runs, results, members and logs are never copied. The generator also refuses any INSERT whose columns name a user field.
- **IDs are kept.** `migrate-011`, `012` and `013` write Global Warming as `category_id = 1`, and the factor tests name factor rows 27 and 34.
- **Strict mode is relaxed for this file only.** 27 legacy substances have an empty `category` (`''`), which is not a valid ENUM value. Strict mode would refuse those rows. The dev and production data hold them, so the seed keeps them rather than hiding them.

The later migrations bring in the TRACI library, materials, process templates and so on. After the chain, the fresh database has 3,288 substances and 4,293 factor rows. Those rows come from the migrations, not from the seed.

### Regenerating

Both files are generated. Do not edit them by hand.

```bash
node scripts/db/build-baseline.mjs --dump=/path/to/lca_v3-dump-20260708-181808.sql          # rewrite
node scripts/db/build-baseline.mjs --dump=/path/to/lca_v3-dump-20260708-181808.sql --check  # verify
```

The dump is not in the repo, because it contains user accounts and password hashes. You only need it to regenerate the baseline, and that should almost never happen. A new schema change is a new migration, never a baseline edit.

## What each test guards

| File | Test | Guards against |
|---|---|---|
| `migrations.test.ts` | chain applies cleanly on the bare baseline, in numeric order | a migration that only works on a hand-patched database |
| | every file recorded with its sha256, none as baseline | the ledger missing a file |
| | second runner pass: `Nothing to apply`; schema, ledger and reference data unchanged | a re-run of `009` resetting TRACI methane (E5), or `016` clobbering Wood (E1) |
| | an edited, already-applied file is reported (`WARNING … changed since it was recorded`) and not re-run | silent drift between the repo and the databases |
| | a new `migrate-NNN` file is picked up and recorded | new migrations being missed |
| | every file applied a second time by hand: no SQL error, no schema change, no factor value change | a migration that is not guarded (audit §5). The one known change is that `009` §2e rewrites the provenance text of the 5 rows it zeroes |
| `schema.test.ts` | `impact_value` and `contribution_percentage` are DOUBLE | small results stored as 0 (RUN-2) |
| | `assessment_results.component_id` is nullable, with exactly one key, `ON DELETE SET NULL` | deleting a step erasing history (RUN-1) |
| | unique keys: factor `(substance, category, method, scope)`, `substance_name`, `email`, `username`, `(project_id, user_id)`, `category_name`, `permission_name`, `cost_rates.unique_rate`, `process_templates.template_name`, `comparison_metadata.comparison_id`, `lcia_gwp_vintage` PK, `schema_migrations` PK | upserts in 015/017/028 duplicating rows; duplicate accounts and memberships |
| | lookup indexes: component by case and parent, flows by component and substance, runs by case, results by run and component, factors by method and category, and others | slow tree, flow, run and factor loads |
| | FK delete rules (cascades from project → case → step → flow; results cascade with the run; RESTRICT on substances and categories) | orphans, or accidental deletes of library rows |
| | every table has a primary key | |
| | account profile columns exist | AUTH-7 |
| | spot checks for columns from 009–022; no leftover `lcapix_add_col` procedure | |
| `field-limits.test.ts` | every column size in `lib/field-limits.ts` (VARCHAR length, TEXT bytes, DECIMAL precision and scale) equals `information_schema` | a migration resizing a column while the API keeps validating against the old size (the oversized-input 500s) |
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
| | `flows.quantity` keeps 4.2e-7 | **Skipped** until a `migrate-030-*.sql` exists. Until then it asserts the column is still `decimal(15,6)` and says so in the output |

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

1. Name it `migrate-NNN-short-name.sql` in the repo root, using the next free number. The runner orders by number and refuses two files with the same number, so a clash is caught.
2. Make it idempotent:
   - Guard every DDL with an `information_schema` check and `PREPARE` (see 026, 027 and 031). `DELIMITER` procedures also work, because files go through the `mysql` CLI.
   - Make data changes upserts or delete-then-insert on natural keys.
   - The raw second-apply test fails if the file errors or changes the schema on a second run.
3. Never edit a file that has been applied anywhere. Write a new one. The ledger reports an edited file and does not re-run it.
4. Run `pnpm test:db`. The new file is picked up automatically: `fresh.mjs` hands the whole directory to `migrate.mjs`.
5. If the migration changes something these tests pin, update the expectation in the same PR and say why. That covers:
   - a column type, key or delete rule (`schema.test.ts`)
   - a factor value or unit (`factor-data.test.ts`)
   - the list of unit-family exceptions
6. Do not touch `db/baseline/`. It is the fixed pre-009 starting point.

Applying to a real database is unchanged: `node --env-file=.env.local scripts/db/migrate.mjs`. Use `--baseline` once for a database that had 009–025 applied by hand.

## CI

The `db-tests` job in `.github/workflows/deploy.yml` runs on pull requests only:

1. A `mysql:8.0` service container starts with an empty root password.
2. The job installs dependencies and checks for the `mysql` client.
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
| `authz/matrix.test.ts` | Generated from `docs/flows/flows.yaml` `permissions:`: 69 rows × 7 roles, plus a deactivated account, a revoked token and a wrong-secret token on every signed-in row (673 cells). A 404 for a non-member must be byte-identical to the missing-id 404; a refused write must leave every writable table's `CHECKSUM` unchanged. |
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
| Two cases in one project could both be the hand-in (WRITE-1) | Low | `flows/f15-class-mode.test.ts` › WRITE-1 | marking a hand-in locks the project and clears `is_final`/`finalized_at` on its other cases in the same transaction (a new hand-in replaces the previous) |
| Runs made in the same second were listed in no defined order | Low | `flows/f09-run-results.test.ts` | `ORDER BY run_date DESC, run_id DESC` in the case's run list and `lib/comparison-engine.ts` |
| The worked example always skipped its argon flow | Low | `flows/f04-project-example.test.ts` (+ every example substance is a library row) | `lib/example-case.ts` no longer names Argon (no sourced factor exists to seed; see the commit) |

Fixed on this branch, each with its own test: the export route's `details: error.message` on a 500 (`security/error-leaks.test.ts` › R42), `lib/integrations/admin-guard.ts` mapping auth failures with `isAuthError` (`tests/integrations/admin-guard.test.ts`), the stale `RATE_LIMITS` comment (`tests/lib/rate-limit-wiring.test.ts`), and the class page offering the Admin role to non-owners (`tests/app/class-page.test.tsx`).

Useful switches: `API_TESTS_VERBOSE=1` keeps the routes' console output; `DB_TESTS_KEEP=1` keeps the database. CI runs the suite in the `api-tests` job (pull requests, MySQL 8.0), next to `db-tests`.

## Differences from TEST_PLAN §4

- Databases are named `lcapix_t_*`, not `lca_test_*`.
- The files are `000-schema.sql` and `001-reference.sql`, with a hyphen instead of an underscore.
- The seed carries the whole pre-009 library rather than a hand-picked subset. It is 34 KB, and `migrate-009` onward need those rows by name.
- `database/migrations/002`–`008` are not replayed. The baseline already contains their effect as the dev database had it.

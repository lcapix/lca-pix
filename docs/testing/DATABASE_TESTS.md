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

## Differences from TEST_PLAN §4

- Databases are named `lcapix_t_*`, not `lca_test_*`.
- The files are `000-schema.sql` and `001-reference.sql`, with a hyphen instead of an underscore.
- The seed carries the whole pre-009 library rather than a hand-picked subset. It is 34 KB, and `migrate-009` onward need those rows by name.
- `database/migrations/002`–`008` are not replayed. The baseline already contains their effect as the dev database had it.

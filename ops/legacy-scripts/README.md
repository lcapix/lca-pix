# Legacy one-off scripts

**These connect to live databases. Do not run.**

Everything here was moved out of the repository root on 2026-09-29 (audit
findings C1 and M8). They are one-off database, AWS and deploy scripts from
2025-2026. Many were written against the shared AWS RDS instance, either
directly or through an SSH/SSM tunnel on `127.0.0.1:3307`. Several delete
data, reassign ownership or run `DROP TABLE`
(`sh/deploy-database.sh`, `sh/deploy-database-complete.sh`,
`js/cleanup-all-projects.js`, `js/cleanup-project-7-incorrect-data.js`,
`js/fix-project-ownership.js`, `sql/cleanup-redundant-data.sql`, ...).

They are kept only as a record of what was done to the data.

| Folder | Contents |
|---|---|
| `js/` | Node scripts: `db_check*`, `check-*`, `cleanup-*`, `fix-*`, `load-*`, `execute-*`, `populate-all-drivers`, `update-test-data`, ad-hoc migration runners |
| `sh/` | Shell scripts: RDS/EC2/SSM deploys, tunnels, AWS profile switching, API smoke tests against old EC2 hosts |
| `sql/` | Seed data (MSWT, Nutroleum), one-off ownership fixes, schema dumps |
| `py/` | `fix-database-python.py` |

## Safety guard

Every `.js`, `.sh` and `.py` file here starts with a one-line guard that exits
unless `LCAPIX_ALLOW_LEGACY_SCRIPT=1` is set. The `.sql` files have no guard;
do not pipe them into a `mysql` client.

Credentials that used to be inline were replaced with placeholders such as
`<DB_PASSWORD>` and `<RDS_HOST>`. That was done so the files could stay in
the repository; the placeholders are not meant to be filled back in.

Paths between scripts were not updated when the files moved (for example
`js/execute-mswt-data.js` still looks for its `.sql` next to itself), so
they would fail even with the guard lifted.

## What to use instead

- Schema changes: the numbered `migrate-0xx-*.sql` files at the repo root,
  applied to a database you name explicitly, after a review.
- Local development: a local MySQL and `.env.local` (see
  `.env.local.example`). Never point a development checkout at a shared
  database.
- Anything that has to touch production: a reviewed runbook, run by an owner,
  with credentials from the secret store rather than from a file.

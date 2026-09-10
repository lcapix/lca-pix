# Database Migration — Clone `lca_v3` to a New AWS

How to take a full dump of the current production database and restore it onto a new RDS (or any
MySQL 8 host) when we move AWS accounts/regions.

## Current source database

| | |
|---|---|
| Engine | AWS RDS **MySQL 8** |
| Host | `lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com` |
| Port | `3306` |
| Database | `lca_v3` |
| User | `lcaadmin` |
| Region | `us-east-1` |
| Auth plugin | `mysql_native_password` |

Tables (~13): `account`, `project`, `project_members`, `case_table`, `component`, `flows`,
`substances`, `impact_categories`, `driver_impact_factors`, `assessment_runs`,
`assessment_results`, `permissions`, `audit_log`.

## Prerequisite — a MySQL 8 client

The RDS user authenticates with `mysql_native_password`. Newer clients (Homebrew **MySQL 9.x**)
dropped that plugin and fail with:

```
ERROR 2059: Authentication plugin 'mysql_native_password' cannot be loaded
```

Use a MySQL-8 client instead. Any one of:

```bash
# Option A — Homebrew MySQL 8 client (keg-only, no server)
brew install mysql-client@8
export PATH="/opt/homebrew/opt/mysql-client@8/bin:$PATH"

# Option B — Docker (self-contained, nothing installed)
docker run --rm -v "$PWD:/out" mysql:8 mysqldump ...   # see command below

# Option C — run it from the existing EC2 box (35.170.250.110), which already has a working client
```

## Step 1 — Full dump (schema + data)

```bash
# Load source creds from the repo env file (keeps the password out of shell history)
set -a; source .env.production; set +a
STAMP=$(date +%Y%m%d-%H%M%S)

MYSQL_PWD="$DATABASE_PASSWORD" mysqldump \
  -h "$DATABASE_HOST" -P "${DATABASE_PORT:-3306}" -u "$DATABASE_USER" \
  --single-transaction --quick --routines --triggers --events \
  --set-gtid-purged=OFF --column-statistics=0 \
  --databases "$DATABASE_NAME" \
  > "lca_v3-dump-$STAMP.sql"

ls -lh "lca_v3-dump-$STAMP.sql"
```

Flag notes:
- `--single-transaction --quick` → consistent snapshot without locking the live tables (InnoDB).
- `--routines --triggers --events` → include stored programs, not just tables.
- `--set-gtid-purged=OFF` → avoids GTID statements that break restore on a fresh RDS.
- `--column-statistics=0` → needed when the client is older than the server; harmless otherwise.

**Data-only** (if the new DB already has the schema): add `--no-create-info`.
**Schema-only** (structure, no rows): use `--no-data` instead.

## Step 2 — Create the target database

On the new RDS (as its admin user):
```sql
CREATE DATABASE lca_v3 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'lcaadmin'@'%' IDENTIFIED BY '<NEW_STRONG_PASSWORD>';
GRANT ALL PRIVILEGES ON lca_v3.* TO 'lcaadmin'@'%';
FLUSH PRIVILEGES;
```

## Step 3 — Restore

```bash
NEW_HOST="<new-rds-endpoint>.rds.amazonaws.com"
NEW_USER="lcaadmin"
NEW_DB="lca_v3"

MYSQL_PWD="<NEW_PASSWORD>" mysql \
  -h "$NEW_HOST" -u "$NEW_USER" "$NEW_DB" < "lca_v3-dump-$STAMP.sql"
```
(The dump already contains `CREATE DATABASE ... USE lca_v3` because of `--databases`, so restoring
into the same name is clean.)

## Step 4 — Verify parity

```bash
# Compare per-table row counts between old and new
for H in "$DATABASE_HOST" "$NEW_HOST"; do
  echo "== $H =="
  MYSQL_PWD="<pw for that host>" mysql -h "$H" -u lcaadmin lca_v3 -N -e "
    SELECT table_name, table_rows FROM information_schema.tables
    WHERE table_schema='lca_v3' ORDER BY table_name;"
done
```
Then smoke-test the app against the new DB (log in, open a project, run an assessment).

## Step 5 — Cut the app over

The connection target lives in **`lib/db.ts`** (defaults) and env vars. Update on the host(s):

- **Vercel:** Project → Settings → Environment Variables → set `DATABASE_HOST`, `DATABASE_PORT`,
  `DATABASE_USER`, `DATABASE_PASSWORD`, `DATABASE_NAME` → redeploy.
- **EC2** (`35.170.250.110`): edit `/home/ec2-user/lca-app/.env` → `pm2 restart lca-app`.
- **Repo:** update the hardcoded fallback host/user in [`lib/db.ts`](../lib/db.ts) so the default no
  longer points at the old RDS.

> ⚠️ Both the Vercel deployment and the EC2 box currently read/write this **same** database. When
> you migrate, point **both** at the new host (or retire one) so you don't end up with a split brain.

## Security follow-ups during the move
- Rotate `DATABASE_PASSWORD` and `JWT_SECRET` on the new environment (don't carry the old ones).
- Lock the new RDS security group to only the app hosts (Vercel egress / EC2), not `0.0.0.0/0`.
- Consider renaming the instance off `lca-dev-db-small` — production shouldn't run on a "dev-small"
  instance; size it and label it as prod.
- Store secrets in AWS Secrets Manager / SSM Parameter Store rather than committed env files.

#!/bin/bash
# Back up the production database (Neon) to a file on this machine, and prove
# the file restores. Neon's Free plan keeps 6 hours of history, so a mistake
# noticed the next morning is fixed from these files, not from Neon.
#
#   scripts/db/backup.sh                     back up Neon (NEON_URL from .neon.env), then the restore drill
#   scripts/db/backup.sh --local=<database>  back up a local database instead (to rehearse)
#
# Files land in ~/lca/backups/ as lcapix-<database>-<UTC time>.dump (pg_dump
# custom format). The drill restores the newest file into a throwaway local
# database (lcapix_restore_drill on lcapix-pg), runs the integrity report on it,
# compares row counts with the source, and drops it. Uses the postgres:18 image
# (Neon runs PG 18; pg_dump must be at least the server's version). The
# connection string is never printed.
set -euo pipefail
cd "$(dirname "$0")/../.."
OUT="$HOME/lca/backups"
mkdir -p "$OUT"
chmod 700 "$OUT"
STAMP=$(date -u +%Y%m%dT%H%M%SZ)
LOCAL_DB=""
for a in "$@"; do
  case "$a" in
    --local=*) LOCAL_DB="${a#--local=}" ;;
    *) echo "Unknown option $a"; exit 2 ;;
  esac
done

docker inspect lcapix-pg >/dev/null 2>&1 || { echo "Docker container lcapix-pg is not running. Open Docker, then: docker start lcapix-pg"; exit 1; }

if [ -n "$LOCAL_DB" ]; then
  SRC_URL="postgresql://postgres@host.docker.internal:5433/$LOCAL_DB"
  NAME="$LOCAL_DB"
else
  [ -f .neon.env ] || { echo "No .neon.env here: it holds NEON_URL."; exit 1; }
  set -a; . ./.neon.env; set +a
  [ -n "${NEON_URL:-}" ] || { echo ".neon.env has no NEON_URL."; exit 1; }
  SRC_URL="$NEON_URL"
  NAME="neon"
fi
FILE="$OUT/lcapix-$NAME-$STAMP.dump"

echo "Backing up $NAME to $FILE"
docker run --rm -e SRC_URL="$SRC_URL" -v "$OUT":/out postgres:18 \
  sh -c 'pg_dump --format=custom --no-owner --no-privileges --dbname="$SRC_URL" --file=/out/'"$(basename "$FILE")"
chmod 600 "$FILE"
echo "Saved $(du -h "$FILE" | cut -f1)."

# Row counts of the tables that hold people's work, from the source, to compare after the restore.
COUNTS_SQL="SELECT 'account', count(*) FROM account UNION ALL SELECT 'project', count(*) FROM project UNION ALL SELECT 'case_table', count(*) FROM case_table UNION ALL SELECT 'component', count(*) FROM component UNION ALL SELECT 'flows', count(*) FROM flows UNION ALL SELECT 'assessment_runs', count(*) FROM assessment_runs ORDER BY 1"
SRC_COUNTS=$(docker run --rm -e SRC_URL="$SRC_URL" postgres:18 psql "$SRC_URL" -At -c "$COUNTS_SQL")

DRILL=lcapix_restore_drill
echo "Restore drill into $DRILL (local)"
docker exec lcapix-pg psql -U postgres -q -c "DROP DATABASE IF EXISTS $DRILL" -c "CREATE DATABASE $DRILL"
docker run --rm -v "$OUT":/out postgres:18 \
  pg_restore --no-owner --no-privileges --exit-on-error --dbname="postgresql://postgres@host.docker.internal:5433/$DRILL" "/out/$(basename "$FILE")"
DRILL_COUNTS=$(docker exec lcapix-pg psql -U postgres -d "$DRILL" -At -c "$COUNTS_SQL")
if [ "$SRC_COUNTS" != "$DRILL_COUNTS" ]; then
  echo "RESTORE DRILL FAILED: row counts differ."
  echo "source:";   echo "$SRC_COUNTS"
  echo "restored:"; echo "$DRILL_COUNTS"
  exit 1
fi
echo "Row counts match:"; echo "$DRILL_COUNTS" | tr '|' ' ' | sed 's/^/  /'
DATABASE_URL= DATABASE_HOST=127.0.0.1 DATABASE_PORT=5433 DATABASE_USER=postgres DATABASE_PASSWORD=local-trust \
  node scripts/db/integrity-report.mjs --db="$DRILL" | tail -5
docker exec lcapix-pg psql -U postgres -q -c "DROP DATABASE $DRILL"
echo "Backup good: $FILE"

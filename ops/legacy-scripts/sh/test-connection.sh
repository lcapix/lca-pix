#!/bin/bash
[ "${LCAPIX_ALLOW_LEGACY_SCRIPT:-}" = "1" ] || { echo "Refusing to run: legacy script that can touch live infrastructure. See ops/legacy-scripts/README.md (override: LCAPIX_ALLOW_LEGACY_SCRIPT=1)." >&2; return 1 2>/dev/null || exit 1; }
export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"

SECRET_JSON=$(aws secretsmanager get-secret-value \
    --secret-id "rds!db-fabed009-0d32-4d03-aa8a-54bb8209c1b4" \
    --profile lca-pix \
    --query 'SecretString' \
    --output text)

DB_PASSWORD=$(echo "$SECRET_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin)['password'])")

echo "Testing connection to lca-dev-db-small..."
mysql -h <RDS_HOST> \
      -P 3306 \
      -u lcaadmin \
      -p"$DB_PASSWORD" \
      -e "SELECT 1 as test;"

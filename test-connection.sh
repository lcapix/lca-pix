#!/bin/bash
export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"

SECRET_JSON=$(aws secretsmanager get-secret-value \
    --secret-id "rds!db-fabed009-0d32-4d03-aa8a-54bb8209c1b4" \
    --profile lca-pix \
    --query 'SecretString' \
    --output text)

DB_PASSWORD=$(echo "$SECRET_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin)['password'])")

echo "Testing connection to lca-dev-db-small..."
mysql -h lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com \
      -P 3306 \
      -u lcaadmin \
      -p"$DB_PASSWORD" \
      -e "SELECT 1 as test;"

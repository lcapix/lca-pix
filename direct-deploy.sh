#!/bin/bash
export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"

DB_HOST="lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com"
DB_USER="lcaadmin"
DB_PASS='EP76017fLefZ8?d!ezTHsN[kA()X'

echo "Testing connection to $DB_HOST..."
mysql -h "$DB_HOST" -P 3306 -u "$DB_USER" -p"$DB_PASS" -e "SELECT 1 as test;" --connect-timeout=30

if [ $? -eq 0 ]; then
    echo "✅ Connection successful!"
    echo "Creating database..."
    mysql -h "$DB_HOST" -P 3306 -u "$DB_USER" -p"$DB_PASS" -e "CREATE DATABASE IF NOT EXISTS lca_v3 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

    echo "Deploying schema..."
    mysql -h "$DB_HOST" -P 3306 -u "$DB_USER" -p"$DB_PASS" lca_v3 < lca_v3_drawsql_schema.sql

    echo "✅ Schema deployed!"
else
    echo "❌ Connection failed"
    echo "The database is in a private VPC and cannot be reached from your local machine."
fi

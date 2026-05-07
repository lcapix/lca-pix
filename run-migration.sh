#!/bin/bash

# ============================================================================
# LCA PROJECT V3 - RUN DATABASE MIGRATION
# ============================================================================
# This script connects to AWS RDS and runs the migration SQL file
# ============================================================================

set -e  # Exit on any error

echo "🔧 LCA v3 Database Migration Script"
echo "===================================="
echo ""

# Get database password from AWS Secrets Manager
echo "📦 Fetching database credentials from AWS Secrets Manager..."
DB_PASSWORD=$(aws secretsmanager get-secret-value \
  --secret-id lca-v3-db-credentials \
  --profile lca-pix \
  --query SecretString \
  --output text 2>/dev/null | python3 -c 'import sys, json; print(json.load(sys.stdin)["password"])' 2>/dev/null)

if [ -z "$DB_PASSWORD" ]; then
    echo "❌ ERROR: Could not retrieve database password from Secrets Manager"
    echo "   Make sure lca-v3-db-credentials exists in AWS Secrets Manager"
    exit 1
fi

echo "✅ Database credentials retrieved"
echo ""

# Database connection details
DB_HOST="lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com"
DB_USER="lcaadmin"
DB_NAME="lca_v3"
MIGRATION_FILE="migrate-add-driver-columns.sql"

echo "📡 Database connection details:"
echo "   Host: $DB_HOST"
echo "   User: $DB_USER"
echo "   Database: $DB_NAME"
echo "   Migration file: $MIGRATION_FILE"
echo ""

# Check if migration file exists
if [ ! -f "$MIGRATION_FILE" ]; then
    echo "❌ ERROR: Migration file '$MIGRATION_FILE' not found"
    exit 1
fi

echo "📝 Migration file found: $MIGRATION_FILE"
echo ""
echo "🚀 Running migration..."
echo "===================================="
echo ""

# Run migration using mysql command
# Note: This requires mysql client to be installed
if ! command -v mysql &> /dev/null; then
    echo "❌ ERROR: mysql client not installed"
    echo "   Install with: brew install mysql-client"
    echo "   Or use: brew install mysql"
    exit 1
fi

# Execute migration
mysql -h "$DB_HOST" \
      -u "$DB_USER" \
      -p"$DB_PASSWORD" \
      "$DB_NAME" \
      < "$MIGRATION_FILE"

if [ $? -eq 0 ]; then
    echo ""
    echo "===================================="
    echo "✅ Migration completed successfully!"
    echo "===================================="
    echo ""
    echo "📊 Verifying changes..."
    echo ""

    # Verify the migration by checking if columns exist
    mysql -h "$DB_HOST" \
          -u "$DB_USER" \
          -p"$DB_PASSWORD" \
          "$DB_NAME" \
          -e "SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'lca_v3' AND TABLE_NAME = 'component' AND COLUMN_NAME IN ('driver_category', 'driver_type', 'drivers', 'process_type');"

    echo ""
    echo "✨ All done! The component table now has driver columns."
else
    echo ""
    echo "===================================="
    echo "❌ Migration failed!"
    echo "===================================="
    exit 1
fi

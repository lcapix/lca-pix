#!/bin/bash

# ============================================================================
# Apply Assessment Runs Table Fix
# ============================================================================
# This script applies the migration to add missing columns to assessment_runs
# ============================================================================

set -e  # Exit on error

echo "🔧 Applying Assessment Runs Table Fix"
echo "====================================="
echo ""

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "❌ Error: .env.local file not found"
    echo "   Please ensure your database credentials are configured"
    exit 1
fi

# Load database credentials
source .env.local

echo "📋 Database Configuration:"
echo "   Host: ${DATABASE_HOST}"
echo "   Database: ${DATABASE_NAME}"
echo "   User: ${DATABASE_USER}"
echo ""

# Prompt for confirmation
echo "⚠️  This will modify the assessment_runs table structure"
echo "   New columns will be added: status, calculation_method, error_log, run_date"
echo ""
read -p "Do you want to proceed? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "❌ Migration cancelled"
    exit 0
fi

echo ""
echo "🚀 Applying migration..."
echo ""

# Apply the migration using mysql client
mysql -h "${DATABASE_HOST}" \
      -P "${DATABASE_PORT:-3306}" \
      -u "${DATABASE_USER}" \
      -p"${DATABASE_PASSWORD}" \
      "${DATABASE_NAME}" \
      < migrate-fix-assessment-runs.sql

if [ $? -eq 0 ]; then
    echo ""
    echo "✅ Migration applied successfully!"
    echo ""
    echo "📊 Next steps:"
    echo "   1. Restart your development server: npm run dev"
    echo "   2. Navigate to your project page"
    echo "   3. Check that assessment status is now displayed"
    echo "   4. Try running a new assessment"
    echo ""
else
    echo ""
    echo "❌ Migration failed!"
    echo "   Please check the error messages above"
    exit 1
fi

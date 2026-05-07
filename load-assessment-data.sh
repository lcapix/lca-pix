#!/bin/bash

# Load Assessment Test Data for Analytics
# This script loads test data including completed assessments for both cases

echo "🔄 Loading Assessment Test Data for Analytics..."
echo "================================================"
echo ""

# Database connection details
DB_HOST="127.0.0.1"
DB_PORT="3307"
DB_NAME="lca_v3"
DB_USER="lcaadmin"
DB_PASS="EP76017fLefZ8?d!ezTHsN[kA()X"

# Check if tunnel is running
if ! lsof -ti:3307 > /dev/null 2>&1; then
    echo "❌ Database tunnel not running on port 3307"
    echo "   Please start the tunnel first:"
    echo "   ./start-dev.sh"
    exit 1
fi

echo "✅ Database tunnel detected on port 3307"
echo ""

# Load base test data (Case 1 + assessment)
echo "📊 Step 1: Loading base test data (Case 1 with assessment)..."
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < create-test-data.sql 2>&1 | grep -v "mysql: \[Warning\]"

if [ $? -eq 0 ]; then
    echo "✅ Base test data loaded successfully"
else
    echo "❌ Failed to load base test data"
    exit 1
fi

echo ""

# Load Case 2 test data (Renewable Energy Scenario + assessment)
echo "📊 Step 2: Loading Case 2 test data (Renewable Energy with assessment)..."
mysql -h "$DB_HOST" -P "$DB_PORT" -u "$DB_USER" -p"$DB_PASS" "$DB_NAME" < add-case2-test-data.sql 2>&1 | grep -v "mysql: \[Warning\]"

if [ $? -eq 0 ]; then
    echo "✅ Case 2 test data loaded successfully"
else
    echo "❌ Failed to load Case 2 test data"
    exit 1
fi

echo ""
echo "================================================"
echo "✅ All Assessment Data Loaded Successfully!"
echo "================================================"
echo ""
echo "📊 Data Summary:"
echo "  - Case 1: Baseline Production - 2025"
echo "  - Case 2: Renewable Energy Scenario"
echo "  - Both cases have completed assessments"
echo "  - Ready for analytics visualization"
echo ""
echo "🌐 Next Steps:"
echo "  1. Navigate to: http://localhost:3002/project/1/"
echo "  2. Click 'Compare Cases'"
echo "  3. Select both cases"
echo "  4. Click 'Run Comparison'"
echo "  5. Analytics page will now show visualizations!"
echo ""

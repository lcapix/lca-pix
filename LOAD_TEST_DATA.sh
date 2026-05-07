#!/bin/bash

# ============================================================================
# LOAD TEST DATA INTO DATABASE
# ============================================================================
# This script loads comprehensive test data including assessment runs
# Works with both local MySQL and SSH tunnel to RDS
# ============================================================================

PROJECT_DIR="/Users/kavishpandit/Desktop/lca/lca project v3"
cd "$PROJECT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}============================================================================${NC}"
echo -e "${BLUE}LOAD TEST DATA - LCA Project v3${NC}"
echo -e "${BLUE}============================================================================${NC}"
echo ""

# ============================================================================
# STEP 1: Load environment variables
# ============================================================================

if [ ! -f ".env.local" ]; then
    echo -e "${RED}❌ .env.local not found${NC}"
    echo "   Please create .env.local with database credentials"
    exit 1
fi

# Source environment variables
export $(grep -v '^#' .env.local | xargs)

DB_HOST=${DATABASE_HOST:-127.0.0.1}
DB_PORT=${DATABASE_PORT:-3307}
DB_NAME=${DATABASE_NAME:-lca_v3}
DB_USER=${DATABASE_USER:-lcaadmin}
DB_PASS=${DATABASE_PASSWORD}

echo -e "${GREEN}✅ Environment loaded${NC}"
echo "   Database: $DB_NAME"
echo "   Host: $DB_HOST:$DB_PORT"
echo "   User: $DB_USER"
echo ""

# ============================================================================
# STEP 2: Check if we can connect
# ============================================================================

echo -e "${YELLOW}🔍 Testing database connection...${NC}"

# Create test connection script
cat > .test-connection.js << 'EOF'
const mysql = require('mysql2/promise');

async function test() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DATABASE_HOST || '127.0.0.1',
      port: process.env.DATABASE_PORT || 3307,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      connectTimeout: 10000
    });
    await connection.execute('SELECT 1');
    console.log('✅ Connection successful');
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Connection failed:', error.message);
    process.exit(1);
  }
}
test();
EOF

if node .test-connection.js; then
    echo -e "${GREEN}✅ Database connection OK${NC}"
    rm -f .test-connection.js
else
    rm -f .test-connection.js
    echo -e "${RED}❌ Cannot connect to database${NC}"
    echo ""
    echo "Troubleshooting:"
    echo "1. Check if SSH tunnel is running (for RDS):"
    echo "   lsof -ti:3307"
    echo ""
    echo "2. Check if MySQL is running (for local):"
    echo "   brew services list | grep mysql"
    echo ""
    echo "3. Verify credentials in .env.local"
    echo ""
    exit 1
fi

echo ""

# ============================================================================
# STEP 3: Ask user about existing data
# ============================================================================

echo -e "${YELLOW}⚠️  WARNING: This will add test data to your database${NC}"
echo ""
echo "Options:"
echo "  1) Add test data (keeps existing data)"
echo "  2) Clear test data first, then add new data"
echo "  3) Cancel"
echo ""
read -p "Choose option (1-3): " choice

case $choice in
    1)
        echo -e "${GREEN}Adding test data...${NC}"
        CLEAR_FIRST=false
        ;;
    2)
        echo -e "${YELLOW}Will clear test data first...${NC}"
        CLEAR_FIRST=true
        ;;
    3)
        echo "Cancelled"
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo ""

# ============================================================================
# STEP 4: Clear existing test data if requested
# ============================================================================

if [ "$CLEAR_FIRST" = true ]; then
    echo -e "${YELLOW}🧹 Clearing existing test data...${NC}"

    cat > .clear-test-data.js << 'EOF'
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function clearTestData() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: process.env.DATABASE_PORT || 3307,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME
  });

  try {
    // Delete in correct order (respect foreign keys)
    await connection.query('DELETE FROM assessment_results WHERE run_id >= 5000 AND run_id <= 5999');
    await connection.query('DELETE FROM assessment_runs WHERE run_id >= 5000 AND run_id <= 5999');
    await connection.query('DELETE FROM flows WHERE component_id >= 4000 AND component_id <= 4999');
    await connection.query('DELETE FROM component WHERE component_id >= 4000 AND component_id <= 4999');
    await connection.query('DELETE FROM case_table WHERE case_id >= 3000 AND case_id <= 3999');
    await connection.query('DELETE FROM project_members WHERE project_id >= 2000 AND project_id <= 2999');
    await connection.query('DELETE FROM project WHERE project_id >= 2000 AND project_id <= 2999');
    await connection.query('DELETE FROM account WHERE id >= 1000 AND id <= 1999');

    console.log('✅ Test data cleared');
  } catch (error) {
    console.error('❌ Error clearing data:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

clearTestData();
EOF

    if node .clear-test-data.js; then
        echo -e "${GREEN}✅ Test data cleared${NC}"
        rm -f .clear-test-data.js
    else
        echo -e "${RED}❌ Failed to clear test data${NC}"
        rm -f .clear-test-data.js
        exit 1
    fi

    echo ""
fi

# ============================================================================
# STEP 5: Load test data SQL
# ============================================================================

echo -e "${BLUE}📥 Loading test data from populate-test-data.sql...${NC}"
echo ""

if [ ! -f "populate-test-data.sql" ]; then
    echo -e "${RED}❌ populate-test-data.sql not found${NC}"
    exit 1
fi

# Create Node.js script to execute SQL
cat > .load-sql.js << 'EOF'
const mysql = require('mysql2/promise');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

async function loadSQL() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: process.env.DATABASE_PORT || 3307,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    multipleStatements: true
  });

  try {
    const sql = fs.readFileSync('populate-test-data.sql', 'utf8');

    console.log('Executing SQL...');
    const [results] = await connection.query(sql);

    // Display any SELECT results
    if (Array.isArray(results)) {
      results.forEach((result, index) => {
        if (Array.isArray(result) && result.length > 0) {
          const firstRow = result[0];
          // Check if it's a message row (single column)
          const keys = Object.keys(firstRow);
          if (keys.length === 1) {
            const value = firstRow[keys[0]];
            if (typeof value === 'string') {
              console.log(value);
            }
          }
        }
      });
    }

    console.log('\n✅ SQL execution completed');
  } catch (error) {
    console.error('❌ SQL execution failed:', error.message);
    console.error('Error details:', error.sqlMessage || error);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

loadSQL();
EOF

if node .load-sql.js; then
    echo ""
    echo -e "${GREEN}✅ Test data loaded successfully${NC}"
    rm -f .load-sql.js
else
    echo -e "${RED}❌ Failed to load test data${NC}"
    rm -f .load-sql.js
    exit 1
fi

echo ""

# ============================================================================
# STEP 6: Verify data was loaded
# ============================================================================

echo -e "${YELLOW}🔍 Verifying data...${NC}"
echo ""

# Create verification script
cat > .verify-data.js << 'EOF'
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function verify() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: process.env.DATABASE_PORT || 3307,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME
  });

  try {
    const [users] = await connection.query(
      'SELECT COUNT(*) as count FROM account WHERE id >= 1000 AND id <= 1999'
    );
    console.log(`✅ Users: ${users[0].count}`);

    const [projects] = await connection.query(
      'SELECT COUNT(*) as count FROM project WHERE project_id >= 2000 AND project_id <= 2999'
    );
    console.log(`✅ Projects: ${projects[0].count}`);

    const [cases] = await connection.query(
      'SELECT COUNT(*) as count FROM case_table WHERE case_id >= 3000 AND case_id <= 3999'
    );
    console.log(`✅ Cases: ${cases[0].count}`);

    const [components] = await connection.query(
      'SELECT COUNT(*) as count FROM component WHERE component_id >= 4000 AND component_id <= 4999'
    );
    console.log(`✅ Components: ${components[0].count}`);

    const [flows] = await connection.query(
      'SELECT COUNT(*) as count FROM flows WHERE component_id >= 4000 AND component_id <= 4999'
    );
    console.log(`✅ Flows: ${flows[0].count}`);

    const [runs] = await connection.query(
      'SELECT COUNT(*) as count FROM assessment_runs WHERE run_id >= 5000 AND run_id <= 5999'
    );
    console.log(`✅ Assessment Runs: ${runs[0].count}`);

    const [results] = await connection.query(
      'SELECT COUNT(*) as count FROM assessment_results WHERE run_id >= 5000 AND run_id <= 5999'
    );
    console.log(`✅ Assessment Results: ${results[0].count}`);

    console.log('');
    console.log('📊 Sample Assessment Runs:');
    const [sampleRuns] = await connection.query(
      `SELECT ar.run_id, ar.run_name, ar.status, c.case_name
       FROM assessment_runs ar
       JOIN case_table c ON ar.case_id = c.case_id
       WHERE ar.run_id >= 5000 AND ar.run_id <= 5999
       ORDER BY ar.run_id`
    );

    sampleRuns.forEach(run => {
      console.log(`   • Run ${run.run_id}: ${run.run_name} [${run.status}]`);
      console.log(`     Case: ${run.case_name}`);
    });

  } catch (error) {
    console.error('❌ Verification failed:', error.message);
    process.exit(1);
  } finally {
    await connection.end();
  }
}

verify();
EOF

if node .verify-data.js; then
    rm -f .verify-data.js
else
    rm -f .verify-data.js
    echo -e "${RED}❌ Verification failed${NC}"
    exit 1
fi

echo ""

# ============================================================================
# SUCCESS
# ============================================================================

echo -e "${GREEN}============================================================================${NC}"
echo -e "${GREEN}✅ TEST DATA LOADED SUCCESSFULLY${NC}"
echo -e "${GREEN}============================================================================${NC}"
echo ""
echo -e "${BLUE}🔑 Login Credentials:${NC}"
echo "   Email: demo@lcaproject.com"
echo "   Password: demo123"
echo ""
echo -e "${BLUE}📁 Test Data Includes:${NC}"
echo "   • 2 Users (demo + admin)"
echo "   • 2 Projects (EV Battery, Solar Panel)"
echo "   • 4 Cases (2 base + 2 comparative)"
echo "   • 16 Components (5-level hierarchies)"
echo "   • 22 Environmental Flows"
echo "   • 4 Assessment Runs (ALL COMPLETED)"
echo "   • 12 Assessment Results"
echo ""
echo -e "${BLUE}🔬 Assessment Runs Available:${NC}"
echo "   • Run 5000: EV Baseline (Coal Grid)"
echo "   • Run 5001: EV Renewable Energy"
echo "   • Run 5002: Solar Standard Process"
echo "   • Run 5003: Solar Recycled Silicon"
echo ""
echo -e "${BLUE}📊 Next Steps:${NC}"
echo "   1. Open TablePlus and refresh"
echo "   2. Query: SELECT * FROM assessment_runs WHERE run_id >= 5000"
echo "   3. Login to app: http://localhost:3002/auth/login"
echo "   4. View projects and assessments"
echo ""
echo -e "${BLUE}🧪 API Testing:${NC}"
echo "   Run: ./test-assessment-api.js"
echo ""
echo -e "${GREEN}============================================================================${NC}"
echo ""

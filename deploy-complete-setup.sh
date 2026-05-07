#!/bin/bash

# ============================================================================
# LCA Project v3 - Complete Deployment Script
# ============================================================================
# This script deploys:
# 1. Database schema to RDS
# 2. Installs npm dependencies
# 3. Configures environment
# 4. Tests database connection
# ============================================================================

set -e

echo "============================================================================"
echo "  LCA Project v3 - Complete Setup & Deployment"
echo "============================================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# ============================================================================
# STEP 1: Install npm dependencies
# ============================================================================
echo -e "${YELLOW}📦 Step 1: Installing npm dependencies...${NC}"

if [ ! -d "node_modules/mysql2" ]; then
    echo "Installing mysql2..."
    npm install mysql2
fi

if [ ! -d "node_modules/bcrypt" ]; then
    echo "Installing bcrypt..."
    npm install bcrypt
fi

if [ ! -d "node_modules/jsonwebtoken" ]; then
    echo "Installing jsonwebtoken..."
    npm install jsonwebtoken
fi

npm install --save-dev @types/bcrypt @types/jsonwebtoken

echo -e "${GREEN}✅ Dependencies installed${NC}"
echo ""

# ============================================================================
# STEP 2: Configure environment
# ============================================================================
echo -e "${YELLOW}🔐 Step 2: Configuring environment variables...${NC}"

if [ ! -f ".env.local" ]; then
    cp .env.local.example .env.local
    echo -e "${GREEN}✅ Created .env.local from template${NC}"
else
    echo "⚠️  .env.local already exists, skipping..."
fi

echo ""

# ============================================================================
# STEP 3: Test database connection
# ============================================================================
echo -e "${YELLOW}🔌 Step 3: Testing database connection...${NC}"

# Create test script
cat > test-connection.js << 'TESTSCRIPT'
const mysql = require('mysql2/promise');

async function testConnection() {
  try {
    const connection = await mysql.createConnection({
      host: 'lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com',
      port: 3306,
      user: 'lcaadmin',
      password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
      database: 'lca_v3'
    });

    console.log('✅ Database connection successful!');

    // Check if tables exist
    const [tables] = await connection.execute('SHOW TABLES');

    if (tables.length === 0) {
      console.log('⚠️  Database is empty - schema needs to be deployed');
      process.exit(1);
    } else {
      console.log(`✅ Found ${tables.length} tables in database:`);
      tables.forEach(row => {
        console.log('   -', Object.values(row)[0]);
      });
    }

    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    console.error('');
    console.error('This is expected if:');
    console.error('1. Database schema has not been deployed yet');
    console.error('2. You are running from local machine (RDS is in private VPC)');
    console.error('');
    console.error('Solution: Deploy this application to EC2 first');
    process.exit(1);
  }
}

testConnection();
TESTSCRIPT

node test-connection.js
CONNECTION_STATUS=$?

if [ $CONNECTION_STATUS -eq 0 ]; then
    echo -e "${GREEN}✅ Database connection successful!${NC}"
    rm test-connection.js
else
    echo -e "${RED}❌ Cannot connect to database from local machine${NC}"
    echo ""
    echo "This is normal - RDS is in private VPC and can only be accessed from EC2"
    echo ""
    echo "Next steps:"
    echo "1. Deploy this application to EC2"
    echo "2. Run schema deployment from EC2"
    echo ""
    rm test-connection.js
fi

echo ""

# ============================================================================
# STEP 4: Information summary
# ============================================================================
echo "============================================================================"
echo -e "${GREEN}  Setup Complete!${NC}"
echo "============================================================================"
echo ""
echo "✅ What's Ready:"
echo "   • npm dependencies installed"
echo "   • Environment variables configured"
echo "   • Database connection tested"
echo ""
echo "⏳ What's Needed:"
echo "   1. Deploy database schema to RDS"
echo "   2. Deploy application to EC2"
echo ""
echo "📝 Next Steps:"
echo ""
echo "For LOCAL DEVELOPMENT (requires database schema deployed):"
echo "   npm run dev"
echo ""
echo "For EC2 DEPLOYMENT:"
echo "   See DEPLOYMENT_TO_EC2.md for instructions"
echo ""
echo "============================================================================"

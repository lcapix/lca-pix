#!/bin/bash

# ============================================================================
# LCA Project v3 - Diagnostic and Auto-Fix Script
# ============================================================================
# This script diagnoses connection issues and attempts to fix them
# ============================================================================

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "🔍 LCA Project v3 - Connection Diagnostic Tool"
echo "=============================================="
echo ""

# Step 1: Check AWS Session Manager Plugin
echo -e "${BLUE}Step 1/5: Checking AWS Session Manager Plugin...${NC}"
if command -v session-manager-plugin &> /dev/null; then
    echo -e "${GREEN}✅ AWS Session Manager plugin installed${NC}"
    HAS_SSM=true
elif aws ssm start-session --help &> /dev/null 2>&1; then
    echo -e "${GREEN}✅ AWS Session Manager plugin installed${NC}"
    HAS_SSM=true
else
    echo -e "${RED}❌ AWS Session Manager plugin NOT installed${NC}"
    echo ""
    echo "📥 To install:"
    echo "   1. Visit: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html"
    echo "   2. Download the plugin for macOS"
    echo "   3. Install and restart terminal"
    echo "   4. Run this script again"
    echo ""
    HAS_SSM=false
fi
echo ""

# Step 2: Check Database Tunnel
echo -e "${BLUE}Step 2/5: Checking database tunnel (port 3307)...${NC}"
if lsof -Pi :3307 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${GREEN}✅ Database tunnel running on port 3307${NC}"
    TUNNEL_RUNNING=true
else
    echo -e "${YELLOW}⚠️  Database tunnel NOT running${NC}"
    TUNNEL_RUNNING=false

    if [ "$HAS_SSM" = true ]; then
        echo ""
        echo "🔄 Attempting to start tunnel..."

        # Start tunnel in background
        nohup aws ssm start-session \
          --target i-055b91c4baf230251 \
          --profile lca-pix \
          --document-name AWS-StartPortForwardingSessionToRemoteHost \
          --parameters '{
            "host":["lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com"],
            "portNumber":["3306"],
            "localPortNumber":["3307"]
          }' > /tmp/lca-tunnel.log 2>&1 &

        TUNNEL_PID=$!
        echo "$TUNNEL_PID" > /tmp/lca-tunnel.pid
        echo "   Tunnel PID: $TUNNEL_PID"

        # Wait for tunnel
        echo "   Waiting for tunnel to establish..."
        sleep 5

        if lsof -Pi :3307 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
            echo -e "${GREEN}✅ Tunnel started successfully!${NC}"
            TUNNEL_RUNNING=true
        else
            echo -e "${RED}❌ Failed to start tunnel${NC}"
            echo "   Check /tmp/lca-tunnel.log for details"
        fi
    fi
fi
echo ""

# Step 3: Test Database Connection
echo -e "${BLUE}Step 3/5: Testing database connection...${NC}"
if [ "$TUNNEL_RUNNING" = true ]; then
    # Create test script
    cat > /tmp/test-db.js << 'DBTEST'
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function test() {
  try {
    const conn = await mysql.createConnection({
      host: process.env.DATABASE_HOST || '127.0.0.1',
      port: process.env.DATABASE_PORT || 3307,
      user: process.env.DATABASE_USER,
      password: process.env.DATABASE_PASSWORD,
      database: process.env.DATABASE_NAME,
      connectTimeout: 5000
    });

    const [rows] = await conn.execute('SELECT COUNT(*) as count FROM project');
    console.log(`PROJECTS:${rows[0].count}`);

    const [cases] = await conn.execute('SELECT COUNT(*) as count FROM case_table');
    console.log(`CASES:${cases[0].count}`);

    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error(`ERROR:${err.message}`);
    process.exit(1);
  }
}
test();
DBTEST

    cd "$(dirname "$0")"
    DB_TEST=$(node /tmp/test-db.js 2>&1)
    DB_EXIT=$?

    if [ $DB_EXIT -eq 0 ]; then
        echo -e "${GREEN}✅ Database connection successful${NC}"
        PROJECT_COUNT=$(echo "$DB_TEST" | grep "PROJECTS:" | cut -d: -f2)
        CASE_COUNT=$(echo "$DB_TEST" | grep "CASES:" | cut -d: -f2)
        echo "   Projects: $PROJECT_COUNT"
        echo "   Cases: $CASE_COUNT"
        DB_CONNECTED=true
    else
        echo -e "${RED}❌ Database connection failed${NC}"
        ERROR_MSG=$(echo "$DB_TEST" | grep "ERROR:" | cut -d: -f2-)
        echo "   Error: $ERROR_MSG"
        DB_CONNECTED=false
    fi

    rm -f /tmp/test-db.js
else
    echo -e "${RED}❌ Cannot test - tunnel not running${NC}"
    DB_CONNECTED=false
fi
echo ""

# Step 4: Check Dev Server
echo -e "${BLUE}Step 4/5: Checking dev server (port 3002)...${NC}"
if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    echo -e "${GREEN}✅ Dev server running on port 3002${NC}"
    SERVER_RUNNING=true

    # Test if server responds
    if curl -s -o /dev/null -w "%{http_code}" http://localhost:3002 | grep -q "200\|301\|302" ; then
        echo -e "${GREEN}✅ Dev server responding to requests${NC}"
    else
        echo -e "${YELLOW}⚠️  Dev server not responding (may still be starting)${NC}"
    fi
else
    echo -e "${YELLOW}⚠️  Dev server NOT running${NC}"
    SERVER_RUNNING=false

    echo ""
    echo "🔄 Starting dev server..."
    cd "$(dirname "$0")"
    nohup npm run dev > /tmp/lca-dev.log 2>&1 &
    DEV_PID=$!
    echo "$DEV_PID" > /tmp/lca-dev.pid
    echo "   Dev server PID: $DEV_PID"

    # Wait for server
    echo "   Waiting for server to start..."
    MAX_WAIT=20
    WAIT_COUNT=0
    while [ $WAIT_COUNT -lt $MAX_WAIT ]; do
        if lsof -Pi :3002 -sTCP:LISTEN -t >/dev/null 2>&1 ; then
            echo -e "${GREEN}✅ Dev server started!${NC}"
            SERVER_RUNNING=true
            break
        fi
        sleep 1
        WAIT_COUNT=$((WAIT_COUNT + 1))
    done

    if [ $WAIT_COUNT -eq $MAX_WAIT ]; then
        echo -e "${RED}❌ Dev server failed to start${NC}"
        echo "   Check /tmp/lca-dev.log for details"
    fi
fi
echo ""

# Step 5: Test Project Page
echo -e "${BLUE}Step 5/5: Testing project page access...${NC}"
if [ "$SERVER_RUNNING" = true ] && [ "$DB_CONNECTED" = true ]; then
    sleep 2  # Give server a moment to fully initialize

    HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/project/1)

    if [ "$HTTP_CODE" = "200" ]; then
        echo -e "${GREEN}✅ Project page accessible (HTTP $HTTP_CODE)${NC}"
    elif [ "$HTTP_CODE" = "302" ] || [ "$HTTP_CODE" = "301" ]; then
        echo -e "${YELLOW}⚠️  Project page redirects (HTTP $HTTP_CODE - may need login)${NC}"
    else
        echo -e "${RED}❌ Project page returned HTTP $HTTP_CODE${NC}"
    fi
else
    echo -e "${RED}❌ Cannot test - server not running or DB not connected${NC}"
fi
echo ""

# Summary
echo "=============================================="
echo -e "${BLUE}📊 Diagnostic Summary${NC}"
echo "=============================================="
echo ""

if [ "$HAS_SSM" = true ] && [ "$TUNNEL_RUNNING" = true ] && [ "$DB_CONNECTED" = true ] && [ "$SERVER_RUNNING" = true ]; then
    echo -e "${GREEN}🎉 All systems operational!${NC}"
    echo ""
    echo "✅ AWS Session Manager: Installed"
    echo "✅ Database Tunnel:     Running (port 3307)"
    echo "✅ Database Connection: Connected"
    echo "✅ Dev Server:          Running (port 3002)"
    echo ""
    echo "🌐 Access your application:"
    echo "   http://localhost:3002"
    echo "   http://localhost:3002/project/1"
    echo ""
    echo "📊 Process IDs:"
    echo "   Tunnel: $(cat /tmp/lca-tunnel.pid 2>/dev/null || echo 'N/A')"
    echo "   Server: $(cat /tmp/lca-dev.pid 2>/dev/null || echo 'N/A')"
    echo ""
    echo "🛑 To stop:"
    echo "   ./stop-dev.sh"
else
    echo -e "${YELLOW}⚠️  Some issues detected${NC}"
    echo ""
    [ "$HAS_SSM" = false ] && echo -e "${RED}❌${NC} AWS Session Manager: NOT installed"
    [ "$HAS_SSM" = true ] && echo -e "${GREEN}✅${NC} AWS Session Manager: Installed"

    [ "$TUNNEL_RUNNING" = false ] && echo -e "${RED}❌${NC} Database Tunnel: NOT running"
    [ "$TUNNEL_RUNNING" = true ] && echo -e "${GREEN}✅${NC} Database Tunnel: Running"

    [ "$DB_CONNECTED" = false ] && echo -e "${RED}❌${NC} Database Connection: Failed"
    [ "$DB_CONNECTED" = true ] && echo -e "${GREEN}✅${NC} Database Connection: Connected"

    [ "$SERVER_RUNNING" = false ] && echo -e "${RED}❌${NC} Dev Server: NOT running"
    [ "$SERVER_RUNNING" = true ] && echo -e "${GREEN}✅${NC} Dev Server: Running"
    echo ""
    echo "📝 Next steps:"
    [ "$HAS_SSM" = false ] && echo "   1. Install AWS Session Manager plugin (see above)"
    [ "$TUNNEL_RUNNING" = false ] && [ "$HAS_SSM" = true ] && echo "   1. Check /tmp/lca-tunnel.log for tunnel errors"
    [ "$DB_CONNECTED" = false ] && echo "   2. Verify .env.local database credentials"
    [ "$SERVER_RUNNING" = false ] && echo "   3. Check /tmp/lca-dev.log for server errors"
    echo "   4. Run this script again after fixing issues"
fi

echo ""
echo "📖 Logs:"
echo "   Dev server: tail -f /tmp/lca-dev.log"
echo "   Tunnel:     tail -f /tmp/lca-tunnel.log"
echo ""

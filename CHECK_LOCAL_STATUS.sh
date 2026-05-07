#!/bin/bash

# ============================================================================
# LCA PROJECT V3 - CHECK LOCAL DEVELOPMENT STATUS
# ============================================================================

PROJECT_DIR="/Users/kavishpandit/Desktop/lca/lca project v3"
cd "$PROJECT_DIR"

echo "🔍 LCA Project v3 - Local Development Status"
echo "================================================================"
echo ""

# Check SSH Tunnel (Port 3307)
echo "🔒 SSH Tunnel Status (Port 3307):"
TUNNEL_PID=$(lsof -ti:3307 2>/dev/null || echo "")
if [ ! -z "$TUNNEL_PID" ]; then
    echo "   ✅ Running (PID: $TUNNEL_PID)"
    TUNNEL_PROCESS=$(ps -p $TUNNEL_PID -o comm= 2>/dev/null)
    echo "   Process: $TUNNEL_PROCESS"
else
    echo "   ❌ Not running"
fi
echo ""

# Check Next.js Server (Port 3002)
echo "🌐 Next.js Server Status (Port 3002):"
NEXTJS_PID=$(lsof -ti:3002 2>/dev/null || echo "")
if [ ! -z "$NEXTJS_PID" ]; then
    echo "   ✅ Running (PID: $NEXTJS_PID)"
    NEXTJS_PROCESS=$(ps -p $NEXTJS_PID -o comm= 2>/dev/null)
    echo "   Process: $NEXTJS_PROCESS"

    # Test if server is responding
    if curl -s http://localhost:3002 > /dev/null 2>&1; then
        echo "   ✅ Server responding"
    else
        echo "   ⚠️  Server not responding (may be starting up)"
    fi
else
    echo "   ❌ Not running"
fi
echo ""

# Check Database Connection
echo "🗄️  Database Connection:"
if [ ! -z "$TUNNEL_PID" ]; then
    # Create quick test
    cat > .status-test.js << 'EOF'
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
    await conn.execute('SELECT 1');
    console.log('   ✅ Connected to lca_v3 database');
    await conn.end();
  } catch (error) {
    console.log('   ❌ Connection failed:', error.message);
  }
}
test();
EOF

    node .status-test.js 2>/dev/null
    rm -f .status-test.js
else
    echo "   ⚠️  Cannot test (tunnel not running)"
fi
echo ""

# Check Environment
echo "⚙️  Environment:"
if [ -f ".env.local" ]; then
    echo "   ✅ .env.local exists"

    # Check critical variables
    if grep -q "DATABASE_HOST" .env.local; then
        DB_HOST=$(grep "DATABASE_HOST" .env.local | cut -d'=' -f2)
        echo "   Database Host: $DB_HOST"
    fi

    if grep -q "DATABASE_PORT" .env.local; then
        DB_PORT=$(grep "DATABASE_PORT" .env.local | cut -d'=' -f2)
        echo "   Database Port: $DB_PORT"
    fi

    if grep -q "DATABASE_NAME" .env.local; then
        DB_NAME=$(grep "DATABASE_NAME" .env.local | cut -d'=' -f2)
        echo "   Database Name: $DB_NAME"
    fi
else
    echo "   ❌ .env.local not found"
fi
echo ""

# Check Dependencies
echo "📦 Dependencies:"
if [ -d "node_modules" ]; then
    echo "   ✅ node_modules installed"
    NODE_COUNT=$(find node_modules -maxdepth 1 -type d | wc -l)
    echo "   Packages: $NODE_COUNT"
else
    echo "   ❌ node_modules not found (run: npm install)"
fi
echo ""

# Check Log Files
echo "📝 Log Files:"
if [ -f "tunnel.log" ]; then
    TUNNEL_SIZE=$(ls -lh tunnel.log | awk '{print $5}')
    echo "   tunnel.log: $TUNNEL_SIZE"
else
    echo "   tunnel.log: Not found"
fi

if [ -f "nextjs.log" ]; then
    NEXTJS_SIZE=$(ls -lh nextjs.log | awk '{print $5}')
    echo "   nextjs.log: $NEXTJS_SIZE"

    # Check for errors in Next.js log
    ERROR_COUNT=$(grep -i "error" nextjs.log 2>/dev/null | wc -l)
    if [ $ERROR_COUNT -gt 0 ]; then
        echo "   ⚠️  Found $ERROR_COUNT errors in nextjs.log"
    fi
else
    echo "   nextjs.log: Not found"
fi
echo ""

# Overall Status
echo "================================================================"
TUNNEL_OK=$( [ ! -z "$TUNNEL_PID" ] && echo "yes" || echo "no" )
NEXTJS_OK=$( [ ! -z "$NEXTJS_PID" ] && echo "yes" || echo "no" )

if [ "$TUNNEL_OK" = "yes" ] && [ "$NEXTJS_OK" = "yes" ]; then
    echo "✅ Status: RUNNING"
    echo ""
    echo "🌍 Application URLs:"
    echo "   http://localhost:3002"
    echo "   http://localhost:3002/auth/login"
    echo "   http://localhost:3002/home"
    echo ""
    echo "📊 Database Connection:"
    echo "   Host: 127.0.0.1"
    echo "   Port: 3307"
    echo "   Database: lca_v3"
elif [ "$TUNNEL_OK" = "yes" ] && [ "$NEXTJS_OK" = "no" ]; then
    echo "⚠️  Status: PARTIAL (Tunnel running, Next.js stopped)"
    echo ""
    echo "💡 To start Next.js: npm run dev"
elif [ "$TUNNEL_OK" = "no" ] && [ "$NEXTJS_OK" = "yes" ]; then
    echo "⚠️  Status: PARTIAL (Next.js running, Tunnel stopped)"
    echo ""
    echo "💡 To start tunnel: ./persistent-tunnel.sh"
else
    echo "❌ Status: STOPPED"
    echo ""
    echo "💡 To start everything: ./START_LOCAL_DEVELOPMENT.sh"
fi

echo "================================================================"
echo ""

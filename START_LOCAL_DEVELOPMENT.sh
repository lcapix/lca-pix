#!/bin/bash

# ============================================================================
# LCA PROJECT V3 - LOCAL DEVELOPMENT STARTUP SCRIPT
# ============================================================================
# This script will:
# 1. Start SSH tunnel to AWS RDS database
# 2. Wait for tunnel to be ready
# 3. Start Next.js development server
# 4. Open browser to application
# ============================================================================

set -e  # Exit on error

PROJECT_DIR="/Users/kavishpandit/Desktop/lca/lca project v3"
cd "$PROJECT_DIR"

echo "🚀 Starting LCA Project v3 Local Development Environment"
echo "================================================================"
echo ""

# ============================================================================
# STEP 1: Check Prerequisites
# ============================================================================
echo "📋 Checking prerequisites..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi
echo "✅ Node.js $(node --version) found"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi
echo "✅ npm $(npm --version) found"

# Check AWS CLI
if ! command -v aws &> /dev/null; then
    echo "❌ AWS CLI is not installed. Please install it first."
    exit 1
fi
echo "✅ AWS CLI found"

# Check Session Manager Plugin
if ! aws ssm start-session --help &> /dev/null; then
    echo "❌ AWS Session Manager plugin not installed."
    echo "   Install it from: https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager-working-with-install-plugin.html"
    exit 1
fi
echo "✅ AWS Session Manager plugin found"

# Check if .env.local exists
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local file not found!"
    echo "   Please create .env.local from .env.local.example"
    exit 1
fi
echo "✅ .env.local found"

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "⚠️  node_modules not found. Installing dependencies..."
    npm install
fi
echo "✅ Dependencies installed"

echo ""

# ============================================================================
# STEP 2: Kill Existing Processes
# ============================================================================
echo "🧹 Cleaning up any existing processes..."

# Kill existing SSH tunnel on port 3307
TUNNEL_PID=$(lsof -ti:3307 2>/dev/null || echo "")
if [ ! -z "$TUNNEL_PID" ]; then
    echo "   Killing existing SSH tunnel (PID: $TUNNEL_PID)"
    kill -9 $TUNNEL_PID 2>/dev/null || true
    sleep 2
fi

# Kill existing Next.js server on port 3002
NEXT_PID=$(lsof -ti:3002 2>/dev/null || echo "")
if [ ! -z "$NEXT_PID" ]; then
    echo "   Killing existing Next.js server (PID: $NEXT_PID)"
    kill -9 $NEXT_PID 2>/dev/null || true
    sleep 2
fi

echo "✅ Cleanup complete"
echo ""

# ============================================================================
# STEP 3: Start SSH Tunnel
# ============================================================================
echo "🔒 Starting SSH tunnel to AWS RDS database..."
echo "   Local port: 3307"
echo "   Remote: lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com:3306"
echo ""

# Start tunnel in background
nohup aws ssm start-session \
    --target i-055b91c4baf230251 \
    --profile lca-pix \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters '{
      "host":["lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com"],
      "portNumber":["3306"],
      "localPortNumber":["3307"]
    }' > tunnel.log 2>&1 &

TUNNEL_PID=$!
echo "   SSH tunnel started (PID: $TUNNEL_PID)"

# Wait for tunnel to be ready
echo "   Waiting for tunnel to establish..."
for i in {1..30}; do
    if lsof -ti:3307 > /dev/null 2>&1; then
        echo "✅ SSH tunnel ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "❌ Tunnel failed to start within 30 seconds"
        echo "   Check tunnel.log for details"
        exit 1
    fi
    sleep 1
    echo -n "."
done
echo ""

# ============================================================================
# STEP 4: Test Database Connection
# ============================================================================
echo "🗄️  Testing database connection..."

# Create a quick test script
cat > test-db-connection.js << 'EOF'
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function testConnection() {
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
    console.log('✅ Database connection successful!');
    await connection.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    process.exit(1);
  }
}

testConnection();
EOF

# Run connection test
if node test-db-connection.js; then
    echo "✅ Database is accessible"
else
    echo "❌ Cannot connect to database"
    echo "   Check your .env.local configuration"
    echo "   Stopping..."
    rm -f test-db-connection.js
    kill -9 $TUNNEL_PID 2>/dev/null || true
    exit 1
fi

# Clean up test script
rm -f test-db-connection.js
echo ""

# ============================================================================
# STEP 5: Start Next.js Development Server
# ============================================================================
echo "🌐 Starting Next.js development server..."
echo "   Port: 3002"
echo "   Mode: Development (hot reload enabled)"
echo ""

# Start Next.js in background
nohup npm run dev > nextjs.log 2>&1 &
NEXTJS_PID=$!
echo "   Next.js started (PID: $NEXTJS_PID)"

# Wait for Next.js to be ready
echo "   Waiting for Next.js to compile..."
MAX_WAIT=60
ELAPSED=0
while [ $ELAPSED -lt $MAX_WAIT ]; do
    if curl -s http://localhost:3002 > /dev/null 2>&1; then
        echo "✅ Next.js server ready!"
        break
    fi

    if [ $ELAPSED -eq $MAX_WAIT ]; then
        echo "❌ Next.js failed to start within ${MAX_WAIT} seconds"
        echo "   Check nextjs.log for details"
        kill -9 $TUNNEL_PID 2>/dev/null || true
        kill -9 $NEXTJS_PID 2>/dev/null || true
        exit 1
    fi

    sleep 2
    ELAPSED=$((ELAPSED + 2))
    echo -n "."
done
echo ""
echo ""

# ============================================================================
# SUCCESS!
# ============================================================================
echo "================================================================"
echo "🎉 SUCCESS! Local development environment is running!"
echo "================================================================"
echo ""
echo "📍 Application URLs:"
echo "   Main:       http://localhost:3002"
echo "   Login:      http://localhost:3002/auth/login"
echo "   Home:       http://localhost:3002/home"
echo ""
echo "🔒 SSH Tunnel:"
echo "   Status:     Active (PID: $TUNNEL_PID)"
echo "   Local:      127.0.0.1:3307"
echo "   Remote:     RDS Database"
echo ""
echo "🌐 Next.js Server:"
echo "   Status:     Running (PID: $NEXTJS_PID)"
echo "   Port:       3002"
echo "   Mode:       Development"
echo ""
echo "👤 Default Login:"
echo "   Email:      lcapix50@gmail.com"
echo "   Password:   Lcapix@guerry123"
echo ""
echo "📊 TablePlus Connection:"
echo "   Host:       127.0.0.1"
echo "   Port:       3307"
echo "   User:       lcaadmin"
echo "   Database:   lca_v3"
echo ""
echo "📝 Log Files:"
echo "   SSH Tunnel: tunnel.log"
echo "   Next.js:    nextjs.log"
echo ""
echo "🛑 To Stop Everything:"
echo "   Run: ./STOP_LOCAL_DEVELOPMENT.sh"
echo "   Or:  kill -9 $TUNNEL_PID $NEXTJS_PID"
echo ""
echo "================================================================"
echo ""

# Save PIDs to file for easy stopping
cat > .dev-pids << EOF
TUNNEL_PID=$TUNNEL_PID
NEXTJS_PID=$NEXTJS_PID
EOF

# Open browser (optional - comment out if you don't want auto-open)
echo "🌍 Opening browser in 3 seconds..."
sleep 3
open http://localhost:3002 2>/dev/null || echo "   Please manually open: http://localhost:3002"

echo ""
echo "✨ Ready to develop! Press Ctrl+C to stop following logs, or close this terminal."
echo ""

# Follow logs
echo "📋 Following Next.js logs (Ctrl+C to exit):"
echo "================================================================"
tail -f nextjs.log

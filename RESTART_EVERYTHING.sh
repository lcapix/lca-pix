#!/bin/bash
# Complete cleanup and restart script for LCA Project v3
# Run this in a FRESH terminal window

set -e

echo "============================================"
echo "  LCA Project v3 - Complete Restart"
echo "============================================"
echo ""

# Step 1: Kill everything
echo "Step 1: Killing all existing processes..."
pkill -9 node 2>/dev/null || true
pkill -9 npm 2>/dev/null || true
pkill -9 session-manager-plugin 2>/dev/null || true
sleep 5

# Step 2: Verify cleanup
echo "Step 2: Verifying cleanup..."
REMAINING=$(ps aux | grep -E "node|npm|session-manager" | grep -v grep | wc -l | tr -d ' ')
if [ "$REMAINING" -gt "0" ]; then
    echo "⚠️  Still have $REMAINING processes running. Retrying..."
    killall -9 node npm session-manager-plugin 2>/dev/null || true
    sleep 5
fi

# Step 3: Clear port 3002 and 3307
echo "Step 3: Clearing ports 3002 and 3307..."
lsof -ti:3002 2>/dev/null | xargs kill -9 2>/dev/null || true
lsof -ti:3307 2>/dev/null | xargs kill -9 2>/dev/null || true
sleep 2

# Step 4: Wait for database connections to timeout
echo "Step 4: Waiting 45 seconds for RDS connections to close..."
echo "   (This is necessary to avoid 'Too many connections' error)"
sleep 45

# Step 5: Start SSM tunnel
echo "Step 5: Starting SSM tunnel to RDS database..."
aws ssm start-session \
  --target i-055b91c4baf230251 \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com"],"portNumber":["3306"],"localPortNumber":["3307"]}' \
  --region us-east-1 \
  --profile lca-pix &

SSM_PID=$!
echo "   SSM tunnel started (PID: $SSM_PID)"
sleep 10

# Step 6: Verify tunnel is working
echo "Step 6: Verifying SSM tunnel..."
if lsof -i:3307 | grep -q LISTEN; then
    echo "   ✅ Tunnel is active on port 3307"
else
    echo "   ❌ Tunnel failed to start!"
    exit 1
fi

# Step 7: Test database connection
echo "Step 7: Testing database connection..."
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
node -e "
const mysql = require('mysql2/promise');
(async () => {
  try {
    const conn = await mysql.createConnection({
      host: '127.0.0.1',
      port: 3307,
      user: 'lcaadmin',
      password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
      database: 'lca_v3'
    });
    console.log('   ✅ Database connection successful!');
    await conn.end();
    process.exit(0);
  } catch (err) {
    console.error('   ❌ Database connection failed:', err.message);
    process.exit(1);
  }
})();
" || {
    echo "   Database connection test failed. Exiting..."
    kill $SSM_PID
    exit 1
}

# Step 8: Start dev server
echo "Step 8: Starting Next.js dev server on port 3002..."
PORT=3002 npm run dev &
DEV_PID=$!
echo "   Dev server started (PID: $DEV_PID)"

echo ""
echo "============================================"
echo "  ✅ All services started successfully!"
echo "============================================"
echo ""
echo "SSM Tunnel PID: $SSM_PID"
echo "Dev Server PID: $DEV_PID"
echo ""
echo "Application running at: http://localhost:3002"
echo ""
echo "Login credentials:"
echo "  Email: lcapix50@gmail.com"
echo "  Password: Lcapix@guerry123"
echo ""
echo "To stop everything, run:"
echo "  kill $SSM_PID $DEV_PID"
echo ""

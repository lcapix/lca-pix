#!/bin/bash
echo "🧹 Cleaning up all processes..."

# Kill all node/npm processes
pkill -9 -f "npm run dev"
pkill -9 -f "next dev"  
pkill -9 -f "next-server"

# Wait for processes to die
sleep 5

# Verify nothing is running
if pgrep -f "npm run dev" > /dev/null; then
    echo "❌ Still have npm processes running"
    exit 1
fi

if lsof -ti:3002 > /dev/null 2>&1; then
    echo "🔧 Killing process on port 3002"
    lsof -ti:3002 | xargs kill -9
    sleep 2
fi

# Verify SSM tunnel is running
if ! lsof -i:3307 | grep -q LISTEN; then
    echo "❌ SSM tunnel not running on port 3307"
    echo "Please start it manually with:"
    echo "aws ssm start-session --target i-055b91c4baf230251 --document-name AWS-StartPortForwardingSessionToRemoteHost --parameters '{\"host\":[\"lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com\"],\"portNumber\":[\"3306\"],\"localPortNumber\":[\"3307\"]}' --region us-east-1 --profile lca-pix"
    exit 1
fi

echo "✅ Clean state achieved"
echo "🚀 Starting dev server..."

cd "/Users/kavishpandit/Desktop/lca/lca project v3"
PORT=3002 npm run dev

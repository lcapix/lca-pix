#!/bin/bash

# ============================================================================
# SIMPLE LOCAL STARTUP - No SSH Tunnel Required
# ============================================================================
# This script starts Next.js only, assuming database is already accessible
# ============================================================================

PROJECT_DIR="/Users/kavishpandit/Desktop/lca/lca project v3"
cd "$PROJECT_DIR"

echo "🚀 Starting LCA Project v3 - Simple Mode"
echo "================================================================"
echo ""

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found"
    exit 1
fi
echo "✅ Node.js $(node --version)"

# Check npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm not found"
    exit 1
fi
echo "✅ npm $(npm --version)"

# Check .env.local
if [ ! -f ".env.local" ]; then
    echo "❌ .env.local not found"
    exit 1
fi
echo "✅ .env.local exists"

# Check node_modules
if [ ! -d "node_modules" ]; then
    echo "⚠️  Installing dependencies..."
    npm install
fi
echo "✅ Dependencies ready"
echo ""

# Kill existing Next.js
echo "🧹 Checking for existing Next.js process..."
NEXT_PID=$(lsof -ti:3002 2>/dev/null || echo "")
if [ ! -z "$NEXT_PID" ]; then
    echo "   Killing existing process (PID: $NEXT_PID)"
    kill -9 $NEXT_PID 2>/dev/null || true
    sleep 2
fi
echo ""

# Start Next.js
echo "🌐 Starting Next.js development server..."
echo "   Port: 3002"
echo "   Mode: Development"
echo ""

npm run dev


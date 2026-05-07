#!/bin/bash

# ============================================================================
# LCA PROJECT V3 - STOP LOCAL DEVELOPMENT
# ============================================================================
# This script will stop all running development processes
# ============================================================================

PROJECT_DIR="/Users/kavishpandit/Desktop/lca/lca project v3"
cd "$PROJECT_DIR"

echo "🛑 Stopping LCA Project v3 Local Development Environment"
echo "================================================================"
echo ""

# Try to read PIDs from file
if [ -f ".dev-pids" ]; then
    source .dev-pids
    echo "📋 Found saved PIDs:"
    echo "   SSH Tunnel PID: $TUNNEL_PID"
    echo "   Next.js PID: $NEXTJS_PID"
    echo ""

    # Kill SSH tunnel
    if [ ! -z "$TUNNEL_PID" ]; then
        if ps -p $TUNNEL_PID > /dev/null 2>&1; then
            echo "🔒 Stopping SSH tunnel (PID: $TUNNEL_PID)..."
            kill -9 $TUNNEL_PID 2>/dev/null || true
            echo "✅ SSH tunnel stopped"
        else
            echo "⚠️  SSH tunnel already stopped"
        fi
    fi

    # Kill Next.js
    if [ ! -z "$NEXTJS_PID" ]; then
        if ps -p $NEXTJS_PID > /dev/null 2>&1; then
            echo "🌐 Stopping Next.js server (PID: $NEXTJS_PID)..."
            kill -9 $NEXTJS_PID 2>/dev/null || true
            echo "✅ Next.js server stopped"
        else
            echo "⚠️  Next.js server already stopped"
        fi
    fi

    # Remove PID file
    rm -f .dev-pids
else
    echo "⚠️  No .dev-pids file found. Searching for processes..."
fi

echo ""

# Fallback: Kill by port
echo "🔍 Checking for processes on ports..."

# Kill anything on port 3307 (SSH tunnel)
TUNNEL_PORT_PID=$(lsof -ti:3307 2>/dev/null || echo "")
if [ ! -z "$TUNNEL_PORT_PID" ]; then
    echo "   Killing process on port 3307 (PID: $TUNNEL_PORT_PID)"
    kill -9 $TUNNEL_PORT_PID 2>/dev/null || true
fi

# Kill anything on port 3002 (Next.js)
NEXTJS_PORT_PID=$(lsof -ti:3002 2>/dev/null || echo "")
if [ ! -z "$NEXTJS_PORT_PID" ]; then
    echo "   Killing process on port 3002 (PID: $NEXTJS_PORT_PID)"
    kill -9 $NEXTJS_PORT_PID 2>/dev/null || true
fi

echo ""

# Verify everything is stopped
echo "🔍 Verifying shutdown..."
sleep 2

REMAINING_3307=$(lsof -ti:3307 2>/dev/null || echo "")
REMAINING_3002=$(lsof -ti:3002 2>/dev/null || echo "")

if [ -z "$REMAINING_3307" ] && [ -z "$REMAINING_3002" ]; then
    echo "✅ All processes stopped successfully!"
else
    if [ ! -z "$REMAINING_3307" ]; then
        echo "⚠️  Warning: Process still running on port 3307"
    fi
    if [ ! -z "$REMAINING_3002" ]; then
        echo "⚠️  Warning: Process still running on port 3002"
    fi
    echo ""
    echo "   Try running this script again, or manually kill:"
    echo "   kill -9 $REMAINING_3307 $REMAINING_3002"
fi

echo ""
echo "================================================================"
echo "✅ Local development environment stopped"
echo "================================================================"
echo ""
echo "📝 Log files preserved:"
echo "   tunnel.log"
echo "   nextjs.log"
echo ""
echo "   To view logs: tail -f tunnel.log"
echo "                 tail -f nextjs.log"
echo ""
echo "   To clear logs: rm -f tunnel.log nextjs.log"
echo ""
echo "🚀 To restart: ./START_LOCAL_DEVELOPMENT.sh"
echo ""

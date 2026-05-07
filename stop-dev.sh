#!/bin/bash

# ============================================================================
# LCA Project v3 - Stop Development Environment
# ============================================================================
# Cleanly stops all dev processes
# ============================================================================

echo ""
echo "🛑 Stopping LCA Project v3 Development Environment"
echo "===================================================="
echo ""

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

STOPPED_COUNT=0

# Stop dev server
echo "📍 Stopping dev server (port 3002)..."
if lsof -ti:3002 >/dev/null 2>&1; then
    lsof -ti:3002 | xargs kill -9 2>/dev/null
    echo -e "${GREEN}✅ Dev server stopped${NC}"
    STOPPED_COUNT=$((STOPPED_COUNT + 1))
else
    echo -e "${YELLOW}⚠️  No dev server running on port 3002${NC}"
fi

# Stop tunnel
echo "📍 Stopping database tunnel (port 3307)..."
if lsof -ti:3307 >/dev/null 2>&1; then
    lsof -ti:3307 | xargs kill -9 2>/dev/null
    echo -e "${GREEN}✅ Database tunnel stopped${NC}"
    STOPPED_COUNT=$((STOPPED_COUNT + 1))
else
    echo -e "${YELLOW}⚠️  No tunnel running on port 3307${NC}"
fi

# Kill by PID if stored
if [ -f /tmp/lca-dev.pid ]; then
    DEV_PID=$(cat /tmp/lca-dev.pid)
    if ps -p $DEV_PID > /dev/null 2>&1; then
        kill -9 $DEV_PID 2>/dev/null
        echo -e "${GREEN}✅ Killed dev server process (PID: $DEV_PID)${NC}"
    fi
    rm /tmp/lca-dev.pid
fi

if [ -f /tmp/lca-tunnel.pid ]; then
    TUNNEL_PID=$(cat /tmp/lca-tunnel.pid)
    if ps -p $TUNNEL_PID > /dev/null 2>&1; then
        kill -9 $TUNNEL_PID 2>/dev/null
        echo -e "${GREEN}✅ Killed tunnel process (PID: $TUNNEL_PID)${NC}"
    fi
    rm /tmp/lca-tunnel.pid
fi

# Clean up log files
echo ""
echo "🧹 Cleaning up..."
rm -f /tmp/lca-dev.log /tmp/lca-tunnel.log

echo ""
if [ $STOPPED_COUNT -gt 0 ]; then
    echo -e "${GREEN}✅ Stopped $STOPPED_COUNT process(es)${NC}"
else
    echo -e "${YELLOW}ℹ️  No running processes found${NC}"
fi

echo ""
echo "=============================================="
echo -e "${GREEN}🎉 Development Environment Stopped${NC}"
echo "=============================================="
echo ""
echo "To start again: ./start-dev.sh"
echo ""

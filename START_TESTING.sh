#!/bin/bash

echo "🚀 Starting LCA Project v3 Testing Environment"
echo "=============================================="
echo ""

# Check if tunnel is already running
if lsof -Pi :3307 -sTCP:LISTEN -t >/dev/null ; then
    echo "✅ Database tunnel already running on port 3307"
else
    echo "⚠️  Database tunnel NOT running"
    echo ""
    echo "❗ IMPORTANT: You MUST start the database tunnel first!"
    echo ""
    echo "In a SEPARATE terminal window, run:"
    echo "   cd \"/Users/kavishpandit/Desktop/lca/lca project v3\""
    echo "   ./persistent-tunnel.sh"
    echo ""
    echo "Then run this script again."
    exit 1
fi

echo ""
echo "✅ All prerequisites met!"
echo ""
echo "📝 Next steps:"
echo "   1. Open browser: http://localhost:3002"
echo "   2. Click 'Continue with Google'"
echo "   3. Login with: lcapix50@gmail.com"
echo ""
echo "🐛 If issues occur, check:"
echo "   - Browser console (F12)"
echo "   - Terminal logs above"
echo ""
echo "📖 Full guide: LOCALHOST_TESTING_GUIDE.md"
echo ""

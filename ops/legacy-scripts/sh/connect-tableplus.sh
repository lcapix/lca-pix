#!/bin/bash
[ "${LCAPIX_ALLOW_LEGACY_SCRIPT:-}" = "1" ] || { echo "Refusing to run: legacy script that can touch live infrastructure. See ops/legacy-scripts/README.md (override: LCAPIX_ALLOW_LEGACY_SCRIPT=1)." >&2; return 1 2>/dev/null || exit 1; }

echo "🔌 Creating SSH tunnel to RDS via EC2..."
echo ""
echo "This will create a local tunnel on port 3307"
echo "Keep this terminal window open while using TablePlus!"
echo ""
echo "Press Ctrl+C to stop the tunnel"
echo ""

# Create SSH tunnel via SSM
aws ssm start-session \
  --target i-055b91c4baf230251 \
  --profile lca-pix \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{
    "host":["<RDS_HOST>"],
    "portNumber":["3306"],
    "localPortNumber":["3307"]
  }'

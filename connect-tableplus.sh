#!/bin/bash

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
    "host":["lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com"],
    "portNumber":["3306"],
    "localPortNumber":["3307"]
  }'

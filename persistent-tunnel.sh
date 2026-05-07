#!/bin/bash

# Persistent SSH Tunnel for TablePlus
# This script auto-reconnects if the tunnel drops

echo "🔒 Starting Persistent SSH Tunnel to RDS..."
echo "This will keep reconnecting automatically if it drops"
echo "Press Ctrl+C to stop completely"
echo ""

RETRY_COUNT=0

while true; do
  RETRY_COUNT=$((RETRY_COUNT + 1))

  if [ $RETRY_COUNT -gt 1 ]; then
    echo "🔄 Reconnecting (attempt $RETRY_COUNT)..."
    sleep 3
  fi

  echo "📡 Establishing tunnel on port 3307..."

  aws ssm start-session \
    --target i-055b91c4baf230251 \
    --profile lca-pix \
    --document-name AWS-StartPortForwardingSessionToRemoteHost \
    --parameters '{
      "host":["lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com"],
      "portNumber":["3306"],
      "localPortNumber":["3307"]
    }' 2>&1

  EXIT_CODE=$?

  if [ $EXIT_CODE -eq 130 ]; then
    echo ""
    echo "👋 Tunnel stopped by user (Ctrl+C)"
    exit 0
  fi

  echo "⚠️  Tunnel disconnected (exit code: $EXIT_CODE)"
  echo "    Waiting 5 seconds before reconnecting..."
  sleep 5
done

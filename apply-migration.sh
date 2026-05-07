#!/bin/bash

# ============================================================================
# LCA PROJECT V3 - Apply Database Migration Script
# ============================================================================
# This script uploads and executes the migration script on EC2 RDS database
# ============================================================================

set -e  # Exit on error

echo "🔄 Starting database migration process..."
echo ""

# Step 1: Upload migration script to S3
echo "📤 Step 1/4: Uploading migration script to S3..."
aws s3 cp migrate-schema-updates.sql s3://lca-dev-assests/migrations/ --profile lca-pix
echo "✅ Migration script uploaded to S3"
echo ""

# Step 2: Download script to EC2
echo "📥 Step 2/4: Downloading migration script to EC2..."
COMMAND_ID=$(aws ssm send-command \
  --instance-ids i-055b91c4baf230251 \
  --document-name "AWS-RunShellScript" \
  --parameters 'commands=["cd /home/ec2-user","aws s3 cp s3://lca-dev-assests/migrations/migrate-schema-updates.sql .","ls -lh migrate-schema-updates.sql"]' \
  --profile lca-pix \
  --query 'Command.CommandId' \
  --output text)

echo "   Command ID: $COMMAND_ID"
echo "   Waiting for download to complete..."
sleep 5

# Check if download succeeded
OUTPUT=$(aws ssm get-command-invocation \
  --command-id "$COMMAND_ID" \
  --instance-id i-055b91c4baf230251 \
  --profile lca-pix \
  --query 'StandardOutputContent' \
  --output text)

echo "$OUTPUT"
echo "✅ Migration script downloaded to EC2"
echo ""

# Step 3: Execute migration script
echo "🗄️  Step 3/4: Executing migration script on RDS database..."
echo ""
echo "⚠️  IMPORTANT: You need to execute the migration script manually via TablePlus or MySQL client"
echo ""
echo "📋 Instructions:"
echo "   1. Start the persistent tunnel: ./persistent-tunnel.sh"
echo "   2. Open TablePlus and connect to localhost:3307"
echo "   3. Open the SQL file: migrate-schema-updates.sql"
echo "   4. Execute the entire script"
echo "   5. Verify all changes applied successfully"
echo ""
echo "Alternatively, execute via command line:"
echo "   mysql -h lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com -P 3306 -u lcaadmin -p lca_v3 < migrate-schema-updates.sql"
echo ""

read -p "Press ENTER once you've executed the migration script manually..."

echo ""
echo "✅ Migration process completed!"
echo ""
echo "🔍 Next steps:"
echo "   1. Verify schema changes in TablePlus"
echo "   2. Deploy updated application to EC2"
echo "   3. Test Google OAuth functionality"
echo ""

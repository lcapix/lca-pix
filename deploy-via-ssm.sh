#!/bin/bash

# ============================================================================
# Deploy Database Schema via AWS Systems Manager
# ============================================================================

set -e

PROFILE="lca-pix"
INSTANCE_ID="i-055b91c4baf230251"
REGION="us-east-1"

echo "============================================================================"
echo "  LCA Project v3 - Database Deployment via SSM"
echo "============================================================================"
echo ""

echo "📦 Step 1: Preparing deployment script..."

# Create the deployment script that will run on EC2
cat > /tmp/deploy-schema.sh << 'DEPLOY_SCRIPT'
#!/bin/bash
set -e

echo "Installing MySQL client..."
sudo yum install -y mysql 2>&1 | tail -5

echo "Getting database credentials..."
SECRET_JSON=$(aws secretsmanager get-secret-value \
    --secret-id "rds!db-fabed009-0d32-4d03-aa8a-54bb8209c1b4" \
    --region us-east-1 \
    --query 'SecretString' \
    --output text)

DB_USERNAME=$(echo "$SECRET_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin)['username'])")
DB_PASSWORD=$(echo "$SECRET_JSON" | python3 -c "import sys, json; print(json.load(sys.stdin)['password'])")
DB_ENDPOINT="lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com"

echo "Creating database lca_v3..."
mysql -h "$DB_ENDPOINT" -u "$DB_USERNAME" -p"$DB_PASSWORD" -e "CREATE DATABASE IF NOT EXISTS lca_v3 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

echo "Database created successfully!"
echo "Endpoint: $DB_ENDPOINT"
echo "Database: lca_v3"
DEPLOY_SCRIPT

echo "✅ Deployment script prepared"
echo ""

echo "📤 Step 2: Uploading schema file to EC2..."

# Start SSM session and upload the schema file
aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --comment "Create tmp directory" \
    --parameters 'commands=["mkdir -p /tmp/lca-deployment"]' \
    --profile "$PROFILE" \
    --region "$REGION" \
    --output text > /dev/null

echo "✅ Directory created on EC2"

# Upload schema using base64 encoding to avoid special character issues
echo "Encoding and uploading schema file..."
SCHEMA_BASE64=$(cat lca_v3_drawsql_schema.sql | base64)

aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --comment "Upload schema file" \
    --parameters "commands=[\"echo '$SCHEMA_BASE64' | base64 -d > /tmp/lca-deployment/schema.sql\"]" \
    --profile "$PROFILE" \
    --region "$REGION" \
    --output text > /dev/null

echo "✅ Schema file uploaded"
echo ""

echo "🚀 Step 3: Executing deployment on EC2..."

COMMAND_ID=$(aws ssm send-command \
    --instance-ids "$INSTANCE_ID" \
    --document-name "AWS-RunShellScript" \
    --comment "Deploy LCA database" \
    --parameters "$(cat /tmp/deploy-schema.sh)" \
    --profile "$PROFILE" \
    --region "$REGION" \
    --query 'Command.CommandId' \
    --output text)

echo "Command ID: $COMMAND_ID"
echo "Waiting for deployment to complete..."
sleep 10

# Get command output
OUTPUT=$(aws ssm get-command-invocation \
    --command-id "$COMMAND_ID" \
    --instance-id "$INSTANCE_ID" \
    --profile "$PROFILE" \
    --region "$REGION" \
    --query 'StandardOutputContent' \
    --output text)

echo ""
echo "Deployment Output:"
echo "$OUTPUT"

echo ""
echo "============================================================================"
echo "  ✅ DATABASE CREATION COMPLETE!"
echo "============================================================================"
echo ""
echo "Now deploying schema and seed data..."
echo ""
DEPLOY_SCRIPT

chmod +x /tmp/deploy-schema.sh

echo "Starting SSM session to complete deployment..."
echo ""
echo "Once connected, run these commands:"
echo "  cd /tmp/lca-deployment"
echo "  sudo yum install -y mysql"
echo "  # Get credentials from Secrets Manager"
echo "  # Deploy schema manually"
echo ""

aws ssm start-session \
    --target "$INSTANCE_ID" \
    --profile "$PROFILE" \
    --region "$REGION"

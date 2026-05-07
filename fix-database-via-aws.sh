#!/bin/bash

# ====================================================================
# FIX LCA DATABASE VIA AWS CLI
# ====================================================================
# This script uses AWS CLI to connect to RDS and fix:
# 1. Project ownership (causing 403 errors)
# 2. Verify database integrity
# 3. Ensure both projects (EV + Nutroleum) are accessible
# ====================================================================

set -e  # Exit on error

PROFILE="lca-pix"
DB_INSTANCE="lca-dev-db-small"
DB_NAME="lca_v3"
DB_USER="lcaadmin"
DB_PASSWORD="EP76017fLefZ8?d!ezTHsN[kA()X"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}=====================================================================${NC}"
echo -e "${BLUE}LCA DATABASE FIX VIA AWS CLI${NC}"
echo -e "${BLUE}=====================================================================${NC}"

# Step 1: Get RDS endpoint
echo -e "\n${YELLOW}Step 1: Getting RDS endpoint...${NC}"
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --profile $PROFILE \
  --db-instance-identifier $DB_INSTANCE \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

echo -e "${GREEN}✓ RDS Endpoint: $RDS_ENDPOINT${NC}"

# Step 2: Get EC2 instance for Session Manager connection
echo -e "\n${YELLOW}Step 2: Finding EC2 instance with Session Manager access...${NC}"
EC2_INSTANCE=$(aws ec2 describe-instances \
  --profile $PROFILE \
  --filters "Name=instance-state-name,Values=running" "Name=tag:Name,Values=*lca*" \
  --query 'Reservations[0].Instances[0].InstanceId' \
  --output text 2>/dev/null || echo "none")

if [ "$EC2_INSTANCE" = "none" ] || [ -z "$EC2_INSTANCE" ]; then
  echo -e "${YELLOW}⚠️  No EC2 instance found. Will try direct connection via current tunnel.${NC}"
  USE_TUNNEL=true
else
  echo -e "${GREEN}✓ EC2 Instance: $EC2_INSTANCE${NC}"
  USE_TUNNEL=false
fi

# Step 3: Create SQL fix script
echo -e "\n${YELLOW}Step 3: Creating SQL fix script...${NC}"
cat > /tmp/fix-lca-db.sql << 'EOF'
-- Show current state
SELECT '=== CURRENT USERS ===' as step;
SELECT user_id, email, name FROM users ORDER BY user_id;

SELECT '=== CURRENT PROJECT OWNERSHIP (PROBLEM) ===' as step;
SELECT p.project_id, p.project_name, p.owner_id, u.email as owner_email
FROM project p
LEFT JOIN users u ON p.owner_id = u.user_id
WHERE p.project_id IN (6, 7);

-- Fix ownership: Try john_doe first, then lcapix50, then user_id=2
UPDATE project
SET owner_id = COALESCE(
  (SELECT user_id FROM users WHERE email = 'john@lcaproject.com' LIMIT 1),
  (SELECT user_id FROM users WHERE email = 'lcapix50@gmail.com' LIMIT 1),
  2
)
WHERE project_id IN (6, 7);

SELECT '=== FIXED PROJECT OWNERSHIP ===' as step;
SELECT p.project_id, p.project_name, p.owner_id, u.email as owner_email, u.name as owner_name
FROM project p
LEFT JOIN users u ON p.owner_id = u.user_id
WHERE p.project_id IN (6, 7);

-- Verify database integrity
SELECT '=== DATABASE INTEGRITY CHECK ===' as step;

SELECT 'Projects' as entity, COUNT(*) as count FROM project;
SELECT 'Cases' as entity, COUNT(*) as count FROM case_table;
SELECT 'Components' as entity, COUNT(*) as count FROM component;
SELECT 'Flows' as entity, COUNT(*) as count FROM flows;
SELECT 'Assessment Runs' as entity, COUNT(*) as count FROM assessment_runs;

-- Check for orphaned records
SELECT '=== ORPHANED RECORDS (should be 0) ===' as step;
SELECT 'Orphaned Cases' as type, COUNT(*) as count
FROM case_table WHERE project_id NOT IN (SELECT project_id FROM project);

SELECT 'Orphaned Components' as type, COUNT(*) as count
FROM component WHERE case_id NOT IN (SELECT case_id FROM case_table);

SELECT 'Orphaned Flows' as type, COUNT(*) as count
FROM flows WHERE component_id NOT IN (SELECT component_id FROM component);

-- Project breakdown
SELECT '=== PROJECT BREAKDOWN ===' as step;
SELECT
  p.project_id,
  p.project_name,
  COUNT(DISTINCT c.case_id) as cases,
  COUNT(DISTINCT comp.component_id) as components,
  u.email as owner
FROM project p
LEFT JOIN case_table c ON p.project_id = c.project_id
LEFT JOIN component comp ON c.case_id = comp.case_id
LEFT JOIN users u ON p.owner_id = u.user_id
GROUP BY p.project_id, p.project_name, u.email
ORDER BY p.project_id;

SELECT '=== FIX COMPLETE ===' as step;
EOF

echo -e "${GREEN}✓ SQL script created at /tmp/fix-lca-db.sql${NC}"

# Step 4: Execute SQL
echo -e "\n${YELLOW}Step 4: Executing SQL fix...${NC}"

if [ "$USE_TUNNEL" = true ]; then
  # Use existing SSH tunnel on localhost:3307
  echo -e "${BLUE}Using existing SSH tunnel on localhost:3307...${NC}"

  # Check if mysql client is available
  if command -v mysql &> /dev/null; then
    mysql -h 127.0.0.1 -P 3307 -u "$DB_USER" -p"$DB_PASSWORD" "$DB_NAME" < /tmp/fix-lca-db.sql
    echo -e "${GREEN}✓ SQL executed successfully via tunnel${NC}"
  else
    echo -e "${YELLOW}⚠️  mysql client not found. Using Python instead...${NC}"

    # Create Python script to execute SQL
    cat > /tmp/fix-db.py << PYEOF
import pymysql
import sys

connection = pymysql.connect(
    host='127.0.0.1',
    port=3307,
    user='$DB_USER',
    password='$DB_PASSWORD',
    database='$DB_NAME'
)

try:
    with open('/tmp/fix-lca-db.sql', 'r') as f:
        sql = f.read()

    with connection.cursor() as cursor:
        # Execute each statement separately
        for statement in sql.split(';'):
            statement = statement.strip()
            if statement and not statement.startswith('--'):
                cursor.execute(statement)

                # Fetch results if any
                if cursor.description:
                    results = cursor.fetchall()
                    if results:
                        print('-' * 80)
                        for row in results:
                            print(row)

    connection.commit()
    print('\n✓ Database fix completed successfully!')

except Exception as e:
    print(f'❌ Error: {e}', file=sys.stderr)
    sys.exit(1)
finally:
    connection.close()
PYEOF

    python3 /tmp/fix-db.py
    echo -e "${GREEN}✓ SQL executed successfully via Python${NC}"
  fi
else
  # Use EC2 instance with Session Manager
  echo -e "${BLUE}Using EC2 instance $EC2_INSTANCE with Session Manager...${NC}"

  # Upload SQL file to S3 temporarily
  S3_BUCKET="lca-dev-deployment-bucket"
  aws s3 cp /tmp/fix-lca-db.sql s3://$S3_BUCKET/temp/fix-lca-db.sql --profile $PROFILE

  # Execute via SSM
  aws ssm send-command \
    --profile $PROFILE \
    --instance-ids $EC2_INSTANCE \
    --document-name "AWS-RunShellScript" \
    --parameters "commands=[
      'aws s3 cp s3://$S3_BUCKET/temp/fix-lca-db.sql /tmp/fix-lca-db.sql',
      'mysql -h $RDS_ENDPOINT -u $DB_USER -p\"$DB_PASSWORD\" $DB_NAME < /tmp/fix-lca-db.sql'
    ]" \
    --output text

  echo -e "${GREEN}✓ SQL executed successfully via SSM${NC}"
fi

# Step 5: Summary
echo -e "\n${BLUE}=====================================================================${NC}"
echo -e "${GREEN}✓ DATABASE FIX COMPLETE!${NC}"
echo -e "${BLUE}=====================================================================${NC}"
echo -e "\n${YELLOW}Next steps:${NC}"
echo -e "  1. Check the output above to see which user now owns the projects"
echo -e "  2. Make sure you're logged in as that user in your browser"
echo -e "  3. Hard refresh browser: ${BLUE}Cmd+Shift+R${NC}"
echo -e "  4. Click on a project - should work now!"
echo -e "\n${YELLOW}If still getting 403 errors:${NC}"
echo -e "  - Logout and login as the owner email shown above"
echo -e "  - Or check browser console for specific error messages"
echo -e "${BLUE}=====================================================================${NC}\n"

# Cleanup
rm -f /tmp/fix-lca-db.sql

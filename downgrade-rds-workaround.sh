#!/bin/bash

# ============================================================================
# RDS Downgrade Workaround Script
# ============================================================================
# Issue: Can't downgrade db.m7g.large with Performance Insights Advanced mode
# Solution: Create new db.t3.small from snapshot, then swap
# ============================================================================

set -e

PROFILE="lca-pix"
OLD_INSTANCE="lca-dev-db"
NEW_INSTANCE="lca-dev-db-small"
SNAPSHOT="lca-dev-db-backup-before-downgrade-20251012-053621"

echo "============================================================================"
echo "  RDS Downgrade Workaround - Create New Instance from Snapshot"
echo "============================================================================"
echo ""

# Get current RDS details
echo "📋 Step 1: Getting current RDS configuration..."
SUBNET_GROUP=$(aws rds describe-db-instances \
    --db-instance-identifier "$OLD_INSTANCE" \
    --profile "$PROFILE" \
    --query 'DBInstances[0].DBSubnetGroup.DBSubnetGroupName' \
    --output text)

VPC_SG=$(aws rds describe-db-instances \
    --db-instance-identifier "$OLD_INSTANCE" \
    --profile "$PROFILE" \
    --query 'DBInstances[0].VpcSecurityGroups[0].VpcSecurityGroupId' \
    --output text)

echo "   Subnet Group: $SUBNET_GROUP"
echo "   Security Group: $VPC_SG"
echo ""

# Create new instance from snapshot
echo "🔨 Step 2: Creating new db.t3.small instance from snapshot..."
echo "   This will take 5-10 minutes..."
echo ""

aws rds restore-db-instance-from-db-snapshot \
    --db-instance-identifier "$NEW_INSTANCE" \
    --db-snapshot-identifier "$SNAPSHOT" \
    --db-instance-class db.t3.small \
    --db-subnet-group-name "$SUBNET_GROUP" \
    --vpc-security-group-ids "$VPC_SG" \
    --no-multi-az \
    --no-publicly-accessible \
    --profile "$PROFILE" \
    --no-enable-performance-insights

echo "✅ Restore initiated!"
echo ""
echo "⏳ Waiting for new instance to become available..."

# Wait for new instance
while true; do
    STATUS=$(aws rds describe-db-instances \
        --db-instance-identifier "$NEW_INSTANCE" \
        --profile "$PROFILE" \
        --query 'DBInstances[0].DBInstanceStatus' \
        --output text 2>/dev/null || echo "creating")

    echo "   Status: $STATUS"

    if [ "$STATUS" == "available" ]; then
        echo "✅ New instance is available!"
        break
    elif [ "$STATUS" == "failed" ]; then
        echo "❌ Instance creation failed!"
        exit 1
    fi

    sleep 30
done

# Get new endpoint
NEW_ENDPOINT=$(aws rds describe-db-instances \
    --db-instance-identifier "$NEW_INSTANCE" \
    --profile "$PROFILE" \
    --query 'DBInstances[0].Endpoint.Address' \
    --output text)

echo ""
echo "============================================================================"
echo "  ✅ NEW INSTANCE CREATED!"
echo "============================================================================"
echo ""
echo "New Instance Details:"
echo "   Identifier: $NEW_INSTANCE"
echo "   Class: db.t3.small (2 vCPU, 2GB RAM)"
echo "   Multi-AZ: No"
echo "   Endpoint: $NEW_ENDPOINT"
echo "   Cost: ~\$25/month (vs \$115/month)"
echo ""
echo "============================================================================"
echo "  NEXT STEPS (Manual)"
echo "============================================================================"
echo ""
echo "1. ✅ Test connection to new instance:"
echo "   mysql -h $NEW_ENDPOINT -u lcaadmin -p"
echo ""
echo "2. ✅ Verify data integrity"
echo ""
echo "3. ⚠️  Update application to use new endpoint:"
echo "   OLD: lca-dev-db.cmp8mswckq1j.us-east-1.rds.amazonaws.com"
echo "   NEW: $NEW_ENDPOINT"
echo ""
echo "4. ⚠️  After confirming everything works, delete old instance to save money:"
echo "   aws rds delete-db-instance \\"
echo "       --db-instance-identifier $OLD_INSTANCE \\"
echo "       --skip-final-snapshot \\"
echo "       --profile $PROFILE"
echo ""
echo "   This will immediately save \$90/month!"
echo ""
echo "5. ⚠️  Optionally rename new instance to old name (after deleting old):"
echo "   aws rds modify-db-instance \\"
echo "       --db-instance-identifier $NEW_INSTANCE \\"
echo "       --new-db-instance-identifier $OLD_INSTANCE \\"
echo "       --apply-immediately \\"
echo "       --profile $PROFILE"
echo ""
echo "============================================================================"

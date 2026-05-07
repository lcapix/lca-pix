#!/bin/bash

# =============================================================================
# AWS LCA Project Configuration Checker
# =============================================================================
# This script checks all AWS resources for your LCA project
# Run this to see what's been set up and what's missing
# =============================================================================

echo "======================================================================"
echo "  AWS LCA Project v3 - Configuration Checker"
echo "======================================================================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if AWS CLI is installed
if ! command -v aws &> /dev/null; then
    echo -e "${RED}❌ AWS CLI is not installed${NC}"
    echo "Install it from: https://aws.amazon.com/cli/"
    exit 1
fi

echo -e "${GREEN}✅ AWS CLI is installed${NC}"
echo ""

# Get current AWS account and region
echo "======================================================================"
echo "  1. AWS ACCOUNT INFORMATION"
echo "======================================================================"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ AWS Account ID: ${ACCOUNT_ID}${NC}"
    CURRENT_REGION=$(aws configure get region)
    echo -e "${GREEN}✅ Current Region: ${CURRENT_REGION}${NC}"
    USER_ARN=$(aws sts get-caller-identity --query Arn --output text)
    echo -e "${GREEN}✅ Current User: ${USER_ARN}${NC}"
else
    echo -e "${RED}❌ AWS CLI not configured${NC}"
    echo "Run: aws configure"
    exit 1
fi
echo ""

# =============================================================================
# 2. CHECK S3 BUCKETS
# =============================================================================
echo "======================================================================"
echo "  2. S3 BUCKETS"
echo "======================================================================"
BUCKETS=$(aws s3 ls 2>/dev/null | grep lca)
if [ -z "$BUCKETS" ]; then
    echo -e "${RED}❌ No LCA buckets found${NC}"
    echo "Expected buckets:"
    echo "  - lca-dev-assets-*"
    echo "  - lca-dev-backups-*"
else
    echo -e "${GREEN}✅ Found LCA buckets:${NC}"
    echo "$BUCKETS" | while read -r line; do
        BUCKET_NAME=$(echo $line | awk '{print $3}')
        echo -e "${BLUE}   📦 ${BUCKET_NAME}${NC}"

        # Check bucket size
        SIZE=$(aws s3 ls s3://$BUCKET_NAME --recursive --summarize 2>/dev/null | grep "Total Size" | awk '{print $3}')
        OBJECTS=$(aws s3 ls s3://$BUCKET_NAME --recursive --summarize 2>/dev/null | grep "Total Objects" | awk '{print $3}')

        if [ ! -z "$SIZE" ]; then
            SIZE_MB=$(echo "scale=2; $SIZE / 1024 / 1024" | bc)
            echo -e "      Size: ${SIZE_MB} MB, Objects: ${OBJECTS}"
        fi

        # Check lifecycle rules (for backups bucket)
        if [[ $BUCKET_NAME == *"backup"* ]]; then
            LIFECYCLE=$(aws s3api get-bucket-lifecycle-configuration --bucket $BUCKET_NAME 2>/dev/null)
            if [ $? -eq 0 ]; then
                echo -e "${GREEN}      ✅ Lifecycle rules configured${NC}"
            else
                echo -e "${YELLOW}      ⚠️  No lifecycle rules (backups won't auto-delete)${NC}"
            fi
        fi
    done
fi
echo ""

# =============================================================================
# 3. CHECK RDS DATABASES
# =============================================================================
echo "======================================================================"
echo "  3. RDS DATABASES"
echo "======================================================================"
DBS=$(aws rds describe-db-instances --query 'DBInstances[*].[DBInstanceIdentifier,DBInstanceStatus,Engine,DBInstanceClass,AllocatedStorage,MultiAZ,Endpoint.Address]' --output text 2>/dev/null)
if [ -z "$DBS" ]; then
    echo -e "${RED}❌ No RDS databases found${NC}"
    echo "Expected: lca-dev-db or similar"
else
    echo "$DBS" | while read -r line; do
        DB_ID=$(echo $line | awk '{print $1}')
        DB_STATUS=$(echo $line | awk '{print $2}')
        DB_ENGINE=$(echo $line | awk '{print $3}')
        DB_CLASS=$(echo $line | awk '{print $4}')
        DB_STORAGE=$(echo $line | awk '{print $5}')
        DB_MULTI_AZ=$(echo $line | awk '{print $6}')
        DB_ENDPOINT=$(echo $line | awk '{print $7}')

        if [ "$DB_STATUS" == "available" ]; then
            echo -e "${GREEN}✅ Database: ${DB_ID}${NC}"
        else
            echo -e "${YELLOW}⚠️  Database: ${DB_ID} (Status: ${DB_STATUS})${NC}"
        fi

        echo "   Engine: $DB_ENGINE"
        echo "   Instance Class: $DB_CLASS"
        echo "   Storage: ${DB_STORAGE} GB"
        echo "   Multi-AZ: $DB_MULTI_AZ"
        echo -e "   ${BLUE}Endpoint: ${DB_ENDPOINT}${NC}"

        # Check backup retention
        BACKUP_RETENTION=$(aws rds describe-db-instances --db-instance-identifier $DB_ID --query 'DBInstances[0].BackupRetentionPeriod' --output text 2>/dev/null)
        echo "   Backup Retention: ${BACKUP_RETENTION} days"

        # Calculate monthly cost estimate
        if [[ $DB_CLASS == *"t3.micro"* ]]; then
            COST="~\$15/month"
        elif [[ $DB_CLASS == *"t3.small"* ]]; then
            COST="~\$30/month"
        elif [[ $DB_CLASS == *"t3.medium"* ]]; then
            COST="~\$60/month"
        else
            COST="Unknown"
        fi
        echo -e "   ${YELLOW}Estimated Cost: ${COST}${NC}"
        echo ""
    done
fi
echo ""

# =============================================================================
# 4. CHECK EC2 INSTANCES
# =============================================================================
echo "======================================================================"
echo "  4. EC2 INSTANCES"
echo "======================================================================"
INSTANCES=$(aws ec2 describe-instances --filters "Name=instance-state-name,Values=running,stopped,stopping,pending" --query 'Reservations[*].Instances[*].[InstanceId,State.Name,InstanceType,PublicIpAddress,Tags[?Key==`Name`].Value|[0]]' --output text 2>/dev/null)
if [ -z "$INSTANCES" ]; then
    echo -e "${RED}❌ No EC2 instances found${NC}"
    echo "Expected: lca-dev-server or similar"
else
    echo "$INSTANCES" | while read -r line; do
        INST_ID=$(echo $line | awk '{print $1}')
        INST_STATE=$(echo $line | awk '{print $2}')
        INST_TYPE=$(echo $line | awk '{print $3}')
        INST_IP=$(echo $line | awk '{print $4}')
        INST_NAME=$(echo $line | awk '{print $5}')

        if [ "$INST_STATE" == "running" ]; then
            echo -e "${GREEN}✅ Instance: ${INST_NAME} (${INST_ID})${NC}"
        elif [ "$INST_STATE" == "stopped" ]; then
            echo -e "${YELLOW}⚠️  Instance: ${INST_NAME} (${INST_ID}) - STOPPED${NC}"
        else
            echo -e "${BLUE}ℹ️  Instance: ${INST_NAME} (${INST_ID}) - ${INST_STATE}${NC}"
        fi

        echo "   State: $INST_STATE"
        echo "   Type: $INST_TYPE"

        if [ "$INST_IP" != "None" ]; then
            echo -e "   ${BLUE}Public IP: ${INST_IP}${NC}"
        else
            echo "   Public IP: None (not accessible from internet)"
        fi

        # Check for Elastic IP
        ELASTIC_IP=$(aws ec2 describe-addresses --filters "Name=instance-id,Values=$INST_ID" --query 'Addresses[0].PublicIp' --output text 2>/dev/null)
        if [ "$ELASTIC_IP" != "None" ] && [ ! -z "$ELASTIC_IP" ]; then
            echo -e "   ${GREEN}✅ Elastic IP: ${ELASTIC_IP} (permanent address)${NC}"
        else
            echo -e "   ${YELLOW}⚠️  No Elastic IP (IP changes on restart)${NC}"
        fi

        # Calculate monthly cost estimate
        if [[ $INST_TYPE == *"t3.micro"* ]]; then
            COST="~\$7.50/month (FREE first 12 months)"
        elif [[ $INST_TYPE == *"t3.small"* ]]; then
            COST="~\$15/month"
        elif [[ $INST_TYPE == *"t3.medium"* ]]; then
            COST="~\$30/month"
        else
            COST="Unknown"
        fi
        echo -e "   ${YELLOW}Estimated Cost: ${COST}${NC}"
        echo ""
    done
fi
echo ""

# =============================================================================
# 5. CHECK ELASTIC IPS
# =============================================================================
echo "======================================================================"
echo "  5. ELASTIC IPS"
echo "======================================================================"
ELASTIC_IPS=$(aws ec2 describe-addresses --query 'Addresses[*].[PublicIp,InstanceId,AllocationId]' --output text 2>/dev/null)
if [ -z "$ELASTIC_IPS" ]; then
    echo -e "${YELLOW}⚠️  No Elastic IPs allocated${NC}"
else
    echo "$ELASTIC_IPS" | while read -r line; do
        EIP=$(echo $line | awk '{print $1}')
        EIP_INST=$(echo $line | awk '{print $2}')
        EIP_ALLOC=$(echo $line | awk '{print $3}')

        if [ "$EIP_INST" != "None" ]; then
            echo -e "${GREEN}✅ Elastic IP: ${EIP} → Associated with ${EIP_INST}${NC}"
        else
            echo -e "${YELLOW}⚠️  Elastic IP: ${EIP} → Not associated (COSTS MONEY!)${NC}"
        fi
    done
fi
echo ""

# =============================================================================
# 6. CHECK ELASTICACHE (REDIS)
# =============================================================================
echo "======================================================================"
echo "  6. ELASTICACHE (REDIS)"
echo "======================================================================"
REDIS=$(aws elasticache describe-replication-groups --query 'ReplicationGroups[*].[ReplicationGroupId,Status,NodeGroups[0].PrimaryEndpoint.Address]' --output text 2>/dev/null)
if [ -z "$REDIS" ]; then
    echo -e "${YELLOW}⚠️  No ElastiCache clusters found${NC}"
    echo "Note: You may be using self-hosted Redis on EC2 (which is fine for budget setup)"
else
    echo "$REDIS" | while read -r line; do
        REDIS_ID=$(echo $line | awk '{print $1}')
        REDIS_STATUS=$(echo $line | awk '{print $2}')
        REDIS_ENDPOINT=$(echo $line | awk '{print $3}')

        if [ "$REDIS_STATUS" == "available" ]; then
            echo -e "${GREEN}✅ Redis Cluster: ${REDIS_ID}${NC}"
        else
            echo -e "${YELLOW}⚠️  Redis Cluster: ${REDIS_ID} (Status: ${REDIS_STATUS})${NC}"
        fi

        echo -e "   ${BLUE}Endpoint: ${REDIS_ENDPOINT}${NC}"
    done
fi
echo ""

# =============================================================================
# 7. CHECK SECRETS MANAGER
# =============================================================================
echo "======================================================================"
echo "  7. SECRETS MANAGER"
echo "======================================================================"
SECRETS=$(aws secretsmanager list-secrets --query 'SecretList[?contains(Name, `lca`)].Name' --output text 2>/dev/null)
if [ -z "$SECRETS" ]; then
    echo -e "${RED}❌ No LCA secrets found${NC}"
    echo "Expected secrets:"
    echo "  - lca/database-credentials"
    echo "  - lca/redis-credentials"
    echo "  - lca/ecoinvent-credentials"
else
    echo -e "${GREEN}✅ Found LCA secrets:${NC}"
    for SECRET in $SECRETS; do
        echo -e "${BLUE}   🔐 ${SECRET}${NC}"

        # Check last accessed
        LAST_ACCESSED=$(aws secretsmanager describe-secret --secret-id $SECRET --query 'LastAccessedDate' --output text 2>/dev/null)
        if [ "$LAST_ACCESSED" != "None" ]; then
            echo "      Last accessed: $LAST_ACCESSED"
        fi
    done

    # Cost calculation
    SECRET_COUNT=$(echo "$SECRETS" | wc -w)
    SECRET_COST=$(echo "scale=2; $SECRET_COUNT * 0.40" | bc)
    echo -e "   ${YELLOW}Estimated Cost: \$${SECRET_COST}/month${NC}"
fi
echo ""

# =============================================================================
# 8. CHECK IAM ROLES
# =============================================================================
echo "======================================================================"
echo "  8. IAM ROLES"
echo "======================================================================"
ROLES=$(aws iam list-roles --query 'Roles[?contains(RoleName, `lca`)].RoleName' --output text 2>/dev/null)
if [ -z "$ROLES" ]; then
    echo -e "${YELLOW}⚠️  No LCA-specific IAM roles found${NC}"
else
    echo -e "${GREEN}✅ Found LCA roles:${NC}"
    for ROLE in $ROLES; do
        echo -e "${BLUE}   👤 ${ROLE}${NC}"

        # List attached policies
        POLICIES=$(aws iam list-attached-role-policies --role-name $ROLE --query 'AttachedPolicies[*].PolicyName' --output text 2>/dev/null)
        if [ ! -z "$POLICIES" ]; then
            echo "      Policies: $POLICIES"
        fi
    done
fi
echo ""

# =============================================================================
# 9. CHECK CLOUDWATCH ALARMS
# =============================================================================
echo "======================================================================"
echo "  9. CLOUDWATCH ALARMS"
echo "======================================================================"
ALARMS=$(aws cloudwatch describe-alarms --query 'MetricAlarms[?contains(AlarmName, `lca`)].AlarmName' --output text 2>/dev/null)
if [ -z "$ALARMS" ]; then
    echo -e "${YELLOW}⚠️  No LCA-specific CloudWatch alarms found${NC}"
    echo "Recommended alarms:"
    echo "  - lca-dev-server-cpu-high"
    echo "  - lca-dev-db-cpu-high"
    echo "  - lca-dev-db-storage-low"
else
    echo -e "${GREEN}✅ Found LCA alarms:${NC}"
    for ALARM in $ALARMS; do
        ALARM_STATE=$(aws cloudwatch describe-alarms --alarm-names $ALARM --query 'MetricAlarms[0].StateValue' --output text 2>/dev/null)

        if [ "$ALARM_STATE" == "OK" ]; then
            echo -e "${GREEN}   ✅ ${ALARM} (${ALARM_STATE})${NC}"
        elif [ "$ALARM_STATE" == "ALARM" ]; then
            echo -e "${RED}   🚨 ${ALARM} (${ALARM_STATE})${NC}"
        else
            echo -e "${BLUE}   ℹ️  ${ALARM} (${ALARM_STATE})${NC}"
        fi
    done
fi
echo ""

# =============================================================================
# 10. CHECK SECURITY GROUPS
# =============================================================================
echo "======================================================================"
echo "  10. SECURITY GROUPS"
echo "======================================================================"
SECURITY_GROUPS=$(aws ec2 describe-security-groups --query 'SecurityGroups[?contains(GroupName, `lca`)].GroupName' --output text 2>/dev/null)
if [ -z "$SECURITY_GROUPS" ]; then
    echo -e "${YELLOW}⚠️  No LCA-specific security groups found${NC}"
else
    echo -e "${GREEN}✅ Found LCA security groups:${NC}"
    for SG in $SECURITY_GROUPS; do
        SG_ID=$(aws ec2 describe-security-groups --group-names $SG --query 'SecurityGroups[0].GroupId' --output text 2>/dev/null)
        echo -e "${BLUE}   🔒 ${SG} (${SG_ID})${NC}"

        # Show open ports
        INBOUND=$(aws ec2 describe-security-groups --group-names $SG --query 'SecurityGroups[0].IpPermissions[*].[IpProtocol,FromPort,ToPort]' --output text 2>/dev/null)
        if [ ! -z "$INBOUND" ]; then
            echo "      Inbound ports:"
            echo "$INBOUND" | while read -r port_line; do
                echo "        $port_line"
            done
        fi
    done
fi
echo ""

# =============================================================================
# 11. COST ESTIMATE
# =============================================================================
echo "======================================================================"
echo "  11. MONTHLY COST ESTIMATE"
echo "======================================================================"

# Initialize total cost
TOTAL_COST=0

# Count resources and estimate costs
EC2_COUNT=$(echo "$INSTANCES" | wc -l)
RDS_COUNT=$(echo "$DBS" | wc -l)
S3_COUNT=$(echo "$BUCKETS" | wc -l)
SECRET_COUNT=$(echo "$SECRETS" | wc -w)
ALARM_COUNT=$(echo "$ALARMS" | wc -w)

# Calculate estimates (rough)
if [ $EC2_COUNT -gt 0 ]; then
    echo -e "${YELLOW}EC2 Instances (t3.small): ~\$15 × ${EC2_COUNT} = \$$(echo "15 * $EC2_COUNT" | bc)${NC}"
    TOTAL_COST=$(echo "$TOTAL_COST + (15 * $EC2_COUNT)" | bc)
fi

if [ $RDS_COUNT -gt 0 ]; then
    echo -e "${YELLOW}RDS Databases (t3.micro): ~\$15 × ${RDS_COUNT} = \$$(echo "15 * $RDS_COUNT" | bc)${NC}"
    TOTAL_COST=$(echo "$TOTAL_COST + (15 * $RDS_COUNT)" | bc)
fi

if [ $S3_COUNT -gt 0 ]; then
    echo -e "${YELLOW}S3 Storage (10GB): ~\$1${NC}"
    TOTAL_COST=$(echo "$TOTAL_COST + 1" | bc)
fi

if [ $SECRET_COUNT -gt 0 ]; then
    SECRET_COST=$(echo "scale=2; $SECRET_COUNT * 0.40" | bc)
    echo -e "${YELLOW}Secrets Manager: ~\$${SECRET_COST}${NC}"
    TOTAL_COST=$(echo "$TOTAL_COST + $SECRET_COST" | bc)
fi

echo -e "${YELLOW}CloudWatch: ~\$2${NC}"
TOTAL_COST=$(echo "$TOTAL_COST + 2" | bc)

echo -e "${YELLOW}Data Transfer: ~\$2${NC}"
TOTAL_COST=$(echo "$TOTAL_COST + 2" | bc)

echo -e "${YELLOW}Ecoinvent API (estimated): ~\$5${NC}"
TOTAL_COST=$(echo "$TOTAL_COST + 5" | bc)

echo "----------------------------------------------------------------------"
echo -e "${GREEN}ESTIMATED TOTAL: \$${TOTAL_COST}/month${NC}"
echo -e "${BLUE}Note: Actual costs may vary. Check AWS Cost Explorer for accurate billing.${NC}"
echo ""

# =============================================================================
# 12. SUMMARY & RECOMMENDATIONS
# =============================================================================
echo "======================================================================"
echo "  12. SUMMARY & NEXT STEPS"
echo "======================================================================"

# Check what's missing
MISSING=()

if [ -z "$BUCKETS" ]; then
    MISSING+=("S3 Buckets")
fi

if [ -z "$DBS" ]; then
    MISSING+=("RDS Database")
fi

if [ -z "$INSTANCES" ]; then
    MISSING+=("EC2 Instance")
fi

if [ -z "$SECRETS" ]; then
    MISSING+=("Secrets Manager")
fi

if [ -z "$ALARMS" ]; then
    MISSING+=("CloudWatch Alarms")
fi

if [ ${#MISSING[@]} -eq 0 ]; then
    echo -e "${GREEN}✅ All core services are configured!${NC}"
    echo ""
    echo "Next steps:"
    echo "1. Connect to your EC2 instance"
    echo "2. Install application software (Node.js, Redis, etc.)"
    echo "3. Deploy your Next.js application"
    echo "4. Import database schema"
    echo "5. Test the application"
else
    echo -e "${RED}⚠️  Missing services:${NC}"
    for ITEM in "${MISSING[@]}"; do
        echo -e "   ${RED}❌ ${ITEM}${NC}"
    done
    echo ""
    echo "Refer to: AWS_CONSOLE_SETUP_GUIDE.md"
fi

echo ""
echo "======================================================================"
echo "  Configuration check complete!"
echo "======================================================================"

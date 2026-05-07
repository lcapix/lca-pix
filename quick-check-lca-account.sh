#!/bin/bash

# Quick check script for LCA PIX AWS Account
# Usage: ./quick-check-lca-account.sh [profile-name]

PROFILE=${1:-default}

echo "=================================================="
echo "  LCA PIX Account Configuration Check"
echo "=================================================="
echo ""

# Check if profile flag should be used
if [ "$PROFILE" != "default" ]; then
    PROFILE_FLAG="--profile $PROFILE"
    echo "Using AWS Profile: $PROFILE"
else
    PROFILE_FLAG=""
    echo "Using default AWS profile"
fi
echo ""

# Account Info
echo "1️⃣  ACCOUNT INFORMATION"
echo "---------------------------------------------------"
ACCOUNT=$(aws sts get-caller-identity $PROFILE_FLAG --query Account --output text 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "✅ Account ID: $ACCOUNT"
    if [ "$ACCOUNT" = "117852575520" ]; then
        echo "✅ This is the LCA PIX account!"
    else
        echo "⚠️  This is NOT the LCA PIX account (expected: 117852575520)"
    fi

    REGION=$(aws configure get region $PROFILE_FLAG 2>/dev/null || echo "not set")
    echo "✅ Region: $REGION"
else
    echo "❌ Cannot connect to AWS. Please configure credentials."
    echo ""
    echo "To configure for LCA PIX account:"
    echo "  aws configure --profile lca-pix"
    exit 1
fi
echo ""

# S3 Buckets
echo "2️⃣  S3 BUCKETS"
echo "---------------------------------------------------"
BUCKETS=$(aws s3 ls $PROFILE_FLAG 2>/dev/null | wc -l)
if [ $BUCKETS -gt 0 ]; then
    echo "✅ Found $BUCKETS bucket(s):"
    aws s3 ls $PROFILE_FLAG | awk '{print "   - " $3}'
else
    echo "❌ No S3 buckets found"
fi
echo ""

# EC2 Instances
echo "3️⃣  EC2 INSTANCES"
echo "---------------------------------------------------"
INSTANCES=$(aws ec2 describe-instances $PROFILE_FLAG --query 'Reservations[*].Instances[*].[InstanceId,State.Name,InstanceType,PublicIpAddress,Tags[?Key==`Name`].Value|[0]]' --output text 2>/dev/null)
if [ ! -z "$INSTANCES" ]; then
    echo "$INSTANCES" | while read line; do
        INST_ID=$(echo $line | awk '{print $1}')
        STATE=$(echo $line | awk '{print $2}')
        TYPE=$(echo $line | awk '{print $3}')
        IP=$(echo $line | awk '{print $4}')
        NAME=$(echo $line | awk '{print $5}')

        if [ "$STATE" = "running" ]; then
            echo "✅ $NAME ($INST_ID) - $STATE"
        else
            echo "⚠️  $NAME ($INST_ID) - $STATE"
        fi
        echo "   Type: $TYPE | IP: $IP"
    done
else
    echo "❌ No EC2 instances found"
fi
echo ""

# RDS Databases
echo "4️⃣  RDS DATABASES"
echo "---------------------------------------------------"
DBS=$(aws rds describe-db-instances $PROFILE_FLAG --query 'DBInstances[*].[DBInstanceIdentifier,DBInstanceStatus,DBInstanceClass,Endpoint.Address]' --output text 2>/dev/null)
if [ ! -z "$DBS" ]; then
    echo "$DBS" | while read line; do
        DB_ID=$(echo $line | awk '{print $1}')
        DB_STATUS=$(echo $line | awk '{print $2}')
        DB_CLASS=$(echo $line | awk '{print $3}')
        DB_ENDPOINT=$(echo $line | awk '{print $4}')

        if [ "$DB_STATUS" = "available" ]; then
            echo "✅ $DB_ID - $DB_STATUS"
        else
            echo "⚠️  $DB_ID - $DB_STATUS"
        fi
        echo "   Class: $DB_CLASS"
        echo "   Endpoint: $DB_ENDPOINT"
    done
else
    echo "❌ No RDS databases found"
fi
echo ""

# Secrets Manager
echo "5️⃣  SECRETS MANAGER"
echo "---------------------------------------------------"
SECRETS=$(aws secretsmanager list-secrets $PROFILE_FLAG --query 'SecretList[*].Name' --output text 2>/dev/null)
if [ ! -z "$SECRETS" ]; then
    SECRET_COUNT=$(echo "$SECRETS" | wc -w)
    echo "✅ Found $SECRET_COUNT secret(s):"
    for SECRET in $SECRETS; do
        echo "   - $SECRET"
    done
else
    echo "❌ No secrets found"
fi
echo ""

# ElastiCache
echo "6️⃣  ELASTICACHE (REDIS)"
echo "---------------------------------------------------"
REDIS=$(aws elasticache describe-replication-groups $PROFILE_FLAG --query 'ReplicationGroups[*].[ReplicationGroupId,Status]' --output text 2>/dev/null)
if [ ! -z "$REDIS" ]; then
    echo "$REDIS" | while read line; do
        REDIS_ID=$(echo $line | awk '{print $1}')
        REDIS_STATUS=$(echo $line | awk '{print $2}')
        echo "✅ $REDIS_ID - $REDIS_STATUS"
    done
else
    echo "❌ No ElastiCache clusters found"
    echo "   (Self-hosted Redis on EC2 is OK for budget setup)"
fi
echo ""

# CloudWatch Alarms
echo "7️⃣  CLOUDWATCH ALARMS"
echo "---------------------------------------------------"
ALARMS=$(aws cloudwatch describe-alarms $PROFILE_FLAG --query 'MetricAlarms[*].[AlarmName,StateValue]' --output text 2>/dev/null | wc -l)
if [ $ALARMS -gt 0 ]; then
    echo "✅ Found $ALARMS alarm(s)"
    aws cloudwatch describe-alarms $PROFILE_FLAG --query 'MetricAlarms[*].[AlarmName,StateValue]' --output text | while read line; do
        ALARM_NAME=$(echo $line | awk '{print $1}')
        ALARM_STATE=$(echo $line | awk '{print $2}')
        if [ "$ALARM_STATE" = "OK" ]; then
            echo "   ✅ $ALARM_NAME - $ALARM_STATE"
        elif [ "$ALARM_STATE" = "ALARM" ]; then
            echo "   🚨 $ALARM_NAME - $ALARM_STATE"
        else
            echo "   ⚠️  $ALARM_NAME - $ALARM_STATE"
        fi
    done
else
    echo "❌ No CloudWatch alarms configured"
fi
echo ""

# Summary
echo "=================================================="
echo "  SUMMARY"
echo "=================================================="

# Check if core services exist
HAS_S3=$([[ $BUCKETS -gt 0 ]] && echo "yes" || echo "no")
HAS_EC2=$([[ ! -z "$INSTANCES" ]] && echo "yes" || echo "no")
HAS_RDS=$([[ ! -z "$DBS" ]] && echo "yes" || echo "no")
HAS_SECRETS=$([[ ! -z "$SECRETS" ]] && echo "yes" || echo "no")

echo "Core Services Status:"
echo "  S3 Buckets: $HAS_S3"
echo "  EC2 Instance: $HAS_EC2"
echo "  RDS Database: $HAS_RDS"
echo "  Secrets Manager: $HAS_SECRETS"
echo ""

if [ "$HAS_S3" = "yes" ] && [ "$HAS_EC2" = "yes" ] && [ "$HAS_RDS" = "yes" ]; then
    echo "✅ All core infrastructure is set up!"
    echo ""
    echo "Next steps:"
    echo "  1. Connect to EC2 instance"
    echo "  2. Deploy application"
    echo "  3. Test connectivity"
else
    echo "⚠️  Some infrastructure is missing"
    echo ""
    echo "Refer to: AWS_CONSOLE_SETUP_GUIDE.md"
fi

echo ""
echo "=================================================="

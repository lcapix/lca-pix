# AWS Configuration Guide - LCA v3 Project

**Budget**: $28-78/month (Balanced configuration for proper functionality)

---

## 1. RDS MySQL Database

### Configuration
```
Instance: db.t3.small
RAM: 2GB
vCPUs: 2
Storage: 50GB (GP3)
Engine: MySQL 8.0
Multi-AZ: No (Single-AZ for testing)
Backup Retention: 7 days
Enhanced Monitoring: 60-second granularity
Performance Insights: Enabled (7-day retention)
```

### Key Settings
```
Allocated Storage: 50 GB
Storage Type: General Purpose (GP3)
Storage Autoscaling: Enabled (max 100 GB)
Master Username: lcaadmin
Database Name: lca_v3_db
Parameter Group: default.mysql8.0
Publicly Accessible: No (VPC only)
```

### Security
- Create VPC security group allowing port 3306 from EC2 security group only
- Store credentials in AWS Secrets Manager
- Enable automated backups at 3 AM UTC

---

## 2. EC2 Application Server

### Configuration
```
Instance: t3.small
RAM: 2GB
vCPUs: 2
Storage: 30GB (GP3)
OS: Ubuntu 22.04 LTS
Monitoring: CloudWatch Agent enabled
```

### Software Stack
```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# PM2 Process Manager
sudo npm install -g pm2

# MySQL Client
sudo apt-get install mysql-client

# Nginx Reverse Proxy
sudo apt-get install nginx
```

### PM2 Configuration
```bash
# Start application
pm2 start npm --name "lca-v3" -- start

# Auto-restart on reboot
pm2 startup systemd
pm2 save
```

### CloudWatch Agent Config
```json
{
  "metrics": {
    "namespace": "LCA_v3_App",
    "metrics_collected": {
      "mem": {
        "measurement": [{"name": "mem_used_percent", "unit": "Percent"}],
        "metrics_collection_interval": 60
      },
      "disk": {
        "measurement": [{"name": "used_percent", "unit": "Percent"}],
        "metrics_collection_interval": 60
      }
    }
  }
}
```

---

## 3. S3 Storage

### Buckets
```
lca-v3-uploads (Standard → Intelligent-Tiering)
lca-v3-backups (Standard → Glacier after 30 days)
lca-v3-logs (Standard → Delete after 90 days)
```

### Lifecycle Policy (Uploads Bucket)
```json
{
  "Rules": [{
    "Id": "IntelligentTiering",
    "Status": "Enabled",
    "Transitions": [{
      "Days": 0,
      "StorageClass": "INTELLIGENT_TIERING"
    }]
  }]
}
```

### Lifecycle Policy (Backups Bucket)
```json
{
  "Rules": [{
    "Id": "ArchiveOldBackups",
    "Status": "Enabled",
    "Transitions": [
      {"Days": 30, "StorageClass": "GLACIER"},
      {"Days": 90, "StorageClass": "DEEP_ARCHIVE"}
    ]
  }]
}
```

---

## 4. Route 53 DNS

### Configuration
```
Hosted Zone: yourdomain.com ($0.50/month)
A Record: app.yourdomain.com → EC2 Elastic IP
Health Check: HTTP on port 80, every 30 seconds
Alarm on Health Check Failure → SNS → Your Email
```

### Health Check Settings
```
Protocol: HTTP
Port: 80
Path: /api/health
Request Interval: 30 seconds
Failure Threshold: 3 consecutive failures
```

---

## 5. CloudWatch Alarms (Critical 5)

### 1. RDS CPU High
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "RDS-CPU-High" \
  --alarm-description "RDS CPU > 80% for 5 minutes" \
  --metric-name CPUUtilization \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=DBInstanceIdentifier,Value=lca-v3-db \
  --alarm-actions arn:aws:sns:region:account:alert-topic
```

### 2. RDS Storage Low
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "RDS-Storage-Low" \
  --metric-name FreeStorageSpace \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 5368709120 \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=DBInstanceIdentifier,Value=lca-v3-db
```
*Threshold: 5GB in bytes*

### 3. EC2 CPU High
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "EC2-CPU-High" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 2 \
  --dimensions Name=InstanceId,Value=i-xxxxxxxxx
```

### 4. EC2 Status Check Failed
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "EC2-Status-Failed" \
  --metric-name StatusCheckFailed \
  --namespace AWS/EC2 \
  --statistic Maximum \
  --period 60 \
  --threshold 1 \
  --comparison-operator GreaterThanOrEqualToThreshold \
  --evaluation-periods 2 \
  --dimensions Name=InstanceId,Value=i-xxxxxxxxx
```

### 5. RDS Connection Failures
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "RDS-Connection-Failures" \
  --metric-name DatabaseConnections \
  --namespace AWS/RDS \
  --statistic Maximum \
  --period 300 \
  --threshold 0 \
  --comparison-operator LessThanOrEqualToThreshold \
  --evaluation-periods 1 \
  --dimensions Name=DBInstanceIdentifier,Value=lca-v3-db
```

---

## 6. AWS Backup

### Daily Backup Plan
```json
{
  "BackupPlanName": "DailyBackupPlan",
  "Rules": [{
    "RuleName": "DailyBackups",
    "TargetBackupVault": "Default",
    "ScheduleExpression": "cron(0 3 * * ? *)",
    "StartWindowMinutes": 60,
    "CompletionWindowMinutes": 120,
    "Lifecycle": {
      "DeleteAfterDays": 7
    }
  }]
}
```

### Weekly Backup Plan
```json
{
  "Rules": [{
    "RuleName": "WeeklyBackups",
    "ScheduleExpression": "cron(0 3 ? * SUN *)",
    "Lifecycle": {
      "DeleteAfterDays": 30
    }
  }]
}
```

---

## 7. Budget Alerts

### Create Budget
```bash
aws budgets create-budget \
  --account-id 123456789012 \
  --budget '{
    "BudgetName": "LCA-v3-Monthly-Budget",
    "BudgetLimit": {
      "Amount": "100",
      "Unit": "USD"
    },
    "TimeUnit": "MONTHLY",
    "BudgetType": "COST"
  }' \
  --notifications-with-subscribers '[{
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [{
      "SubscriptionType": "EMAIL",
      "Address": "your-email@example.com"
    }]
  }]'
```

---

## 8. Daily Monitoring Checklist

### Morning Check (5 minutes)
```bash
# Check RDS status
aws rds describe-db-instances --db-instance-identifier lca-v3-db \
  --query 'DBInstances[0].[DBInstanceStatus,StorageRemaining,CPUUtilization]'

# Check EC2 status
aws ec2 describe-instance-status --instance-ids i-xxxxxxxxx

# Check CloudWatch alarms
aws cloudwatch describe-alarms --state-value ALARM

# View cost estimate
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '7 days ago' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost
```

### Weekly Review (15 minutes)
- Review Performance Insights for slow queries
- Check S3 storage growth trends
- Review application error logs in CloudWatch Logs
- Verify backup completion (RDS automated + AWS Backup)
- Review cost by service breakdown

---

## 9. Security Best Practices

### IAM Role for EC2
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "s3:PutObject",
      "s3:GetObject",
      "s3:DeleteObject"
    ],
    "Resource": "arn:aws:s3:::lca-v3-uploads/*"
  }, {
    "Effect": "Allow",
    "Action": [
      "secretsmanager:GetSecretValue"
    ],
    "Resource": "arn:aws:secretsmanager:region:account:secret:lca-v3-db-*"
  }, {
    "Effect": "Allow",
    "Action": [
      "cloudwatch:PutMetricData",
      "logs:CreateLogGroup",
      "logs:CreateLogStream",
      "logs:PutLogEvents"
    ],
    "Resource": "*"
  }]
}
```

### Database Connection (Node.js)
```javascript
const AWS = require('aws-sdk');
const mysql = require('mysql2/promise');

// Get credentials from Secrets Manager
const secretsManager = new AWS.SecretsManager();
const secret = await secretsManager.getSecretValue({
  SecretId: 'lca-v3-db-credentials'
}).promise();

const credentials = JSON.parse(secret.SecretString);

// Create connection pool
const pool = mysql.createPool({
  host: process.env.RDS_ENDPOINT,
  user: credentials.username,
  password: credentials.password,
  database: 'lca_v3_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});
```

---

## 10. Cost Breakdown

### Free Tier (First 12 Months)
```
RDS db.t3.small:      $41.45/month
EC2 t3.small:         $19.68/month (750 hrs free → ~$5 after discount)
S3:                   $0.37/month (5GB free)
Route 53:             $1.40/month
CloudWatch:           $4.95/month (10 free alarms)
AWS Backup:           $7.25/month
--------------------------------------
Total (Free Tier):    ~$28/month
```

### Post-Free Tier (Month 13+)
```
RDS:                  $41.45/month
EC2:                  $19.68/month
S3:                   $0.37/month
Route 53:             $1.40/month
CloudWatch:           $4.95/month
AWS Backup:           $7.25/month
Data Transfer:        ~$2.50/month
--------------------------------------
Total:                ~$78/month
```

---

## 11. Quick Setup Commands

### Initial Setup
```bash
# 1. Create RDS instance
aws rds create-db-instance \
  --db-instance-identifier lca-v3-db \
  --db-instance-class db.t3.small \
  --engine mysql \
  --master-username lcaadmin \
  --master-user-password YourSecurePassword123! \
  --allocated-storage 50 \
  --storage-type gp3 \
  --backup-retention-period 7 \
  --no-multi-az \
  --enable-performance-insights \
  --performance-insights-retention-period 7

# 2. Create EC2 instance
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.small \
  --key-name your-key-pair \
  --security-group-ids sg-xxxxxxxxx \
  --subnet-id subnet-xxxxxxxxx \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]' \
  --iam-instance-profile Name=EC2-LCA-Role \
  --monitoring Enabled=true

# 3. Create S3 buckets
aws s3api create-bucket --bucket lca-v3-uploads --region us-east-1
aws s3api create-bucket --bucket lca-v3-backups --region us-east-1
aws s3api create-bucket --bucket lca-v3-logs --region us-east-1

# 4. Enable S3 versioning (uploads bucket)
aws s3api put-bucket-versioning \
  --bucket lca-v3-uploads \
  --versioning-configuration Status=Enabled

# 5. Create SNS topic for alerts
aws sns create-topic --name lca-v3-alerts
aws sns subscribe \
  --topic-arn arn:aws:sns:region:account:lca-v3-alerts \
  --protocol email \
  --notification-endpoint your-email@example.com
```

---

## 12. Troubleshooting

### RDS Connection Issues
```bash
# Test connectivity from EC2
mysql -h lca-v3-db.xxxxxxxxxx.region.rds.amazonaws.com -u lcaadmin -p

# Check security group rules
aws ec2 describe-security-groups --group-ids sg-xxxxxxxxx
```

### High RDS CPU
```sql
-- Find slow queries
SELECT * FROM mysql.slow_log
WHERE start_time > DATE_SUB(NOW(), INTERVAL 1 HOUR)
ORDER BY query_time DESC
LIMIT 10;

-- Check connection count
SHOW STATUS LIKE 'Threads_connected';
```

### EC2 Memory Issues
```bash
# Check memory usage
free -h

# Check application logs
pm2 logs lca-v3 --lines 100

# Restart application
pm2 restart lca-v3
```

---

**Setup Time**: ~2 hours
**Monthly Maintenance**: ~1 hour
**Cost**: $28-78/month
**Supports**: 30-50 concurrent users, 99.5%+ uptime

# AWS Budget Setup - LCA Project v3 (Under $100/month)

## Cost Target: $80-95/month for Testing Phase

This guide provides a minimal but functional AWS setup for testing and development, optimized for cost while maintaining core functionality.

---

## Architecture (Simplified)

```
┌─────────────────────────────────────────────────────────────────┐
│                    USERS (Developers/Testers)                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              CloudFront CDN (Free Tier eligible)                 │
│                  OR Direct ALB Access                            │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│           Application Load Balancer (Optional for testing)       │
│                    OR Direct EC2 Access                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                EC2 Instance (t3.small)                           │
│          - Next.js App (PM2 for process management)              │
│          - Redis (self-hosted on same instance)                  │
│          - CloudWatch Agent                                      │
└───────────────────────────┬─────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌────────────────┐  ┌──────────────────┐
│  RDS MySQL    │  │ S3 Buckets     │  │ Ecoinvent API    │
│  (Single-AZ)  │  │ - Minimal      │  │ (Cached locally) │
│  db.t3.micro  │  │ - Free tier    │  │                  │
└───────────────┘  └────────────────┘  └──────────────────┘
```

---

## Cost Breakdown (Monthly)

| Service | Configuration | Monthly Cost | Savings vs Production |
|---------|---------------|--------------|----------------------|
| **EC2** | t3.small, single instance, 50% uptime | $15 | $105 (vs Fargate) |
| **RDS** | db.t3.micro, 20GB, Single-AZ | $15 | $255 (vs Multi-AZ t3.medium) |
| **S3** | 5GB storage, 20GB transfer | $1 | $14 (vs 100GB) |
| **CloudWatch** | 2GB logs, 5 alarms | $2 | $13 (vs full monitoring) |
| **Route 53** | 1 hosted zone (optional) | $0.50 | - |
| **Secrets Manager** | 3 secrets | $1.20 | $1.05 |
| **ALB** | Optional (free with direct EC2) | $0 | $40 (vs full ALB) |
| **Data Transfer** | Minimal | $2 | $48 (vs production) |
| **Elastic IP** | 1 IP (free when attached) | $0 | - |
| **Ecoinvent API** | 500 cached requests | $5 | $45 (vs 5,000) |
| **Backups** | Manual snapshots | $2 | $18 (vs automated) |
| **TOTAL** | | **~$43.70/month** | **$539.05 saved** |

**With Free Tier (First 12 Months)**:
- EC2: 750 hours/month free (t2.micro or t3.micro)
- RDS: 750 hours/month free (db.t2.micro or db.t3.micro)
- S3: 5GB storage free
- Data Transfer: 100GB free
- **Total with Free Tier: ~$15-25/month**

---

## Budget Configuration Details

### 1. Single EC2 Instance (Replaces ECS Fargate + ElastiCache)

**Why?**: Consolidate services on one instance to save costs

**Configuration**:
```
Instance Type: t3.small
vCPUs: 2
RAM: 2GB
Storage: 30GB GP3 SSD
OS: Ubuntu 22.04 LTS
Cost: $15.18/month (730 hours × $0.0208/hour)

OR for Free Tier:
Instance Type: t3.micro (free for 12 months)
vCPUs: 2
RAM: 1GB
Cost: $0/month (first 12 months)
```

**What runs on it**:
1. Next.js application (Node.js)
2. Redis (self-hosted for caching)
3. Nginx (reverse proxy)
4. PM2 (process manager)
5. CloudWatch agent (monitoring)

---

### 2. RDS MySQL (Minimal Configuration)

**Configuration**:
```
Instance Type: db.t3.micro (or db.t2.micro for free tier)
vCPUs: 2
RAM: 1GB
Storage: 20GB GP2 (expandable)
Multi-AZ: NO (Single-AZ only)
Backup Retention: 1 day (minimum)
Read Replicas: NO
Cost: $15.33/month

OR for Free Tier:
Instance Type: db.t2.micro
Cost: $0/month (first 12 months, 750 hours/month)
```

**Cost Savings**:
- Single-AZ instead of Multi-AZ: Save $15/month
- t3.micro instead of t3.medium: Save $120/month
- No read replicas: Save $90/month
- Minimal backups: Save $10/month

---

### 3. Self-Hosted Redis (No ElastiCache)

**Why?**: ElastiCache costs $85+/month. Self-hosted Redis is free.

**Installation on EC2**:
```bash
# Install Redis on EC2 instance
sudo apt-get update
sudo apt-get install redis-server -y

# Configure Redis
sudo nano /etc/redis/redis.conf
# Set maxmemory: 512mb
# Set maxmemory-policy: allkeys-lru

# Start Redis
sudo systemctl enable redis-server
sudo systemctl start redis-server

# Secure Redis
sudo nano /etc/redis/redis.conf
# Add: requirepass YOUR_SECURE_PASSWORD
```

**Memory Allocation**:
- Redis: 512MB (for caching)
- Node.js App: 1GB
- OS + Other: 512MB
- Total: 2GB (fits in t3.small)

**Cost Savings**: Save $85/month vs ElastiCache

---

### 4. S3 (Minimal Storage)

**Configuration**:
```
Bucket 1: lca-dev-assets (5GB max)
  - Static files
  - User uploads

Bucket 2: lca-dev-backups (5GB max)
  - Database backups (manual)
  - Lifecycle: Delete after 7 days

Total Storage: 5-10GB
Cost: $0.23-0.46/month (under free tier limit)
```

**Cost Savings**: Save $14/month vs 100GB production storage

---

### 5. No Application Load Balancer (Direct EC2 Access)

**Why?**: ALB costs $16/month minimum + $8/month for traffic. Not needed for testing.

**Alternative**:
```
Option 1: Direct EC2 access via Elastic IP
  - Assign Elastic IP to EC2
  - Access via http://YOUR_ELASTIC_IP:3000
  - Free (no ALB cost)

Option 2: Use Nginx on EC2 as reverse proxy
  - Nginx listens on port 80/443
  - Proxies to Next.js on port 3000
  - Free SSL with Let's Encrypt
```

**Cost Savings**: Save $24-40/month

---

### 6. Reduced Monitoring (Essential Only)

**CloudWatch Configuration**:
```
Logs:
  - Application logs: 2GB/month retention (7 days)
  - Database logs: Disabled (use Performance Insights instead)

Metrics:
  - Default EC2 metrics (free)
  - Default RDS metrics (free)
  - 0 custom metrics

Alarms:
  - 5 critical alarms only (10 free)
    1. EC2 CPU > 90%
    2. EC2 Status Check Failed
    3. RDS CPU > 90%
    4. RDS Storage < 2GB
    5. Daily cost > $5

Cost: $1-2/month
```

**Cost Savings**: Save $13/month vs full monitoring

---

### 7. Ecoinvent API (Aggressive Caching + Pre-loading)

**Strategy**:
```
1. Pre-load 50 most common substances into database
2. Cache responses locally in Redis (7-day TTL)
3. Cache responses in JSON files on EC2 (1-year TTL)
4. Use Ecoinvent API only for cache misses (~5% of requests)

Expected Usage:
  - 500 API requests/month (95% cache hit rate)
  - Cost: 500 × $0.01 = $5/month
```

**Implementation**:
```javascript
// lib/ecoinvent-cache.ts
import fs from 'fs/promises';
import path from 'path';
import redis from '@/lib/redis';

const CACHE_DIR = '/var/cache/ecoinvent';

async function getCachedData(cacheKey: string) {
  // Level 1: Redis (fast, 7 days)
  const redisData = await redis.get(cacheKey);
  if (redisData) return JSON.parse(redisData);

  // Level 2: File system (slower, 1 year)
  const filePath = path.join(CACHE_DIR, `${cacheKey}.json`);
  try {
    const fileData = await fs.readFile(filePath, 'utf-8');
    const parsed = JSON.parse(fileData);

    // Check if expired (1 year)
    if (Date.now() - parsed.timestamp < 365 * 24 * 60 * 60 * 1000) {
      // Repopulate Redis
      await redis.set(cacheKey, JSON.stringify(parsed.data), 'EX', 604800);
      return parsed.data;
    }
  } catch (error) {
    // File doesn't exist, continue to API
  }

  // Level 3: Ecoinvent API
  const apiData = await fetchFromEcoinvent(cacheKey);

  // Save to both caches
  await redis.set(cacheKey, JSON.stringify(apiData), 'EX', 604800);
  await fs.writeFile(filePath, JSON.stringify({
    data: apiData,
    timestamp: Date.now()
  }));

  return apiData;
}
```

**Cost Savings**: Save $45/month vs 5,000 API calls

---

## Step-by-Step Setup (Budget Version)

### Phase 1: EC2 Setup (30 minutes)

#### 1. Launch EC2 Instance

**Via AWS Console**:
1. Go to EC2 → Launch Instance
2. Name: `lca-dev-server`
3. AMI: Ubuntu Server 22.04 LTS (Free tier eligible)
4. Instance Type: `t3.small` (or `t3.micro` for free tier)
5. Key Pair: Create new or use existing
6. Network Settings:
   - VPC: Default VPC
   - Subnet: Any public subnet
   - Auto-assign Public IP: Enable
   - Security Group: Create new
     - SSH (22): Your IP only
     - HTTP (80): 0.0.0.0/0
     - HTTPS (443): 0.0.0.0/0
     - Custom TCP (3000): 0.0.0.0/0 (for Next.js direct access)
7. Storage: 30GB GP3
8. Launch Instance

**Via AWS CLI**:
```bash
# Create security group
SG_ID=$(aws ec2 create-security-group \
  --group-name lca-dev-sg \
  --description "Security group for LCA dev server" \
  --query 'GroupId' --output text)

# Add inbound rules
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 22 --cidr $(curl -s ifconfig.me)/32
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 80 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $SG_ID --protocol tcp --port 3000 --cidr 0.0.0.0/0

# Launch instance
aws ec2 run-instances \
  --image-id ami-0c55b159cbfafe1f0 \
  --instance-type t3.small \
  --key-name your-key-pair \
  --security-group-ids $SG_ID \
  --block-device-mappings '[{"DeviceName":"/dev/sda1","Ebs":{"VolumeSize":30,"VolumeType":"gp3"}}]' \
  --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=lca-dev-server}]'

# Get instance public IP
INSTANCE_ID=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=lca-dev-server" --query 'Reservations[0].Instances[0].InstanceId' --output text)
PUBLIC_IP=$(aws ec2 describe-instances --instance-ids $INSTANCE_ID --query 'Reservations[0].Instances[0].PublicIpAddress' --output text)

echo "EC2 Public IP: $PUBLIC_IP"
```

#### 2. Allocate Elastic IP (Optional but Recommended)

```bash
# Allocate Elastic IP
EIP_ALLOC=$(aws ec2 allocate-address --domain vpc --query 'AllocationId' --output text)

# Associate with instance
aws ec2 associate-address --instance-id $INSTANCE_ID --allocation-id $EIP_ALLOC

# Get Elastic IP
ELASTIC_IP=$(aws ec2 describe-addresses --allocation-ids $EIP_ALLOC --query 'Addresses[0].PublicIp' --output text)

echo "Elastic IP: $ELASTIC_IP"
```

**Cost**: Free when attached to running instance

---

#### 3. SSH into EC2 and Install Software

```bash
# SSH into instance
ssh -i your-key.pem ubuntu@$PUBLIC_IP

# Update system
sudo apt-get update
sudo apt-get upgrade -y

# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install Redis
sudo apt-get install redis-server -y

# Configure Redis
sudo nano /etc/redis/redis.conf
# Add these lines:
# maxmemory 512mb
# maxmemory-policy allkeys-lru
# requirepass YOUR_REDIS_PASSWORD

sudo systemctl restart redis-server
sudo systemctl enable redis-server

# Install PM2 (process manager)
sudo npm install -g pm2

# Install Nginx (optional, for reverse proxy)
sudo apt-get install nginx -y

# Install MySQL client (to connect to RDS)
sudo apt-get install mysql-client -y

# Install Git
sudo apt-get install git -y

# Create directories
sudo mkdir -p /var/www/lca-project
sudo mkdir -p /var/cache/ecoinvent
sudo chown -R ubuntu:ubuntu /var/www/lca-project
sudo chown -R ubuntu:ubuntu /var/cache/ecoinvent
```

---

### Phase 2: RDS Setup (20 minutes)

#### 4. Create RDS Instance

```bash
# Create DB subnet group (if not using default VPC)
aws rds create-db-subnet-group \
  --db-subnet-group-name lca-dev-subnet-group \
  --db-subnet-group-description "Subnet group for LCA dev database" \
  --subnet-ids subnet-xxxxx subnet-yyyyy

# Create security group for RDS
RDS_SG=$(aws ec2 create-security-group \
  --group-name lca-dev-rds-sg \
  --description "Security group for RDS dev database" \
  --query 'GroupId' --output text)

# Allow MySQL access from EC2 instance only
aws ec2 authorize-security-group-ingress \
  --group-id $RDS_SG \
  --protocol tcp \
  --port 3306 \
  --source-group $SG_ID

# Create RDS instance (BUDGET VERSION)
aws rds create-db-instance \
  --db-instance-identifier lca-dev-db \
  --db-instance-class db.t3.micro \
  --engine mysql \
  --engine-version 8.0.35 \
  --master-username lcaadmin \
  --master-user-password $(openssl rand -base64 32) \
  --allocated-storage 20 \
  --storage-type gp2 \
  --no-multi-az \
  --vpc-security-group-ids $RDS_SG \
  --backup-retention-period 1 \
  --preferred-backup-window "03:00-04:00" \
  --db-name lca_dev \
  --publicly-accessible false \
  --tags Key=Name,Value=lca-dev-db Key=Environment,Value=development

# Wait for RDS to become available (~5 minutes)
aws rds wait db-instance-available --db-instance-identifier lca-dev-db

# Get RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier lca-dev-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

echo "RDS Endpoint: $RDS_ENDPOINT"
```

**Free Tier Note**: If within first 12 months, use `db.t2.micro` instead of `db.t3.micro` for free tier eligibility.

---

#### 5. Import Database Schema

```bash
# From your local machine, copy schema to EC2
scp -i your-key.pem lca_v3_drawsql_schema.sql ubuntu@$PUBLIC_IP:/home/ubuntu/

# SSH back into EC2
ssh -i your-key.pem ubuntu@$PUBLIC_IP

# Connect to RDS and import schema
mysql -h $RDS_ENDPOINT -u lcaadmin -p lca_dev < lca_v3_drawsql_schema.sql
```

---

### Phase 3: Deploy Application (30 minutes)

#### 6. Deploy Next.js Application

```bash
# On EC2 instance
cd /var/www/lca-project

# Clone your repository
git clone https://github.com/your-username/lca-project-v3.git .

# Create .env.local file
cat > .env.local << EOF
NODE_ENV=production

# Database
DATABASE_URL=mysql://lcaadmin:YOUR_PASSWORD@$RDS_ENDPOINT:3306/lca_dev

# Redis
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=YOUR_REDIS_PASSWORD

# Ecoinvent API
ECOINVENT_API_KEY=YOUR_ECOINVENT_KEY
ECOINVENT_BASE_URL=https://ecoinvent.org/api/v3

# JWT
JWT_SECRET=$(openssl rand -base64 32)
SESSION_SECRET=$(openssl rand -base64 32)

# App
NEXT_PUBLIC_API_URL=http://$PUBLIC_IP:3000
EOF

# Install dependencies
npm install

# Build application
npm run build

# Start with PM2
pm2 start npm --name "lca-app" -- start

# Save PM2 process list
pm2 save

# Set PM2 to start on boot
pm2 startup systemd
# Run the command that PM2 outputs

# Check status
pm2 status
pm2 logs lca-app
```

---

#### 7. Configure Nginx (Optional but Recommended)

```bash
# Create Nginx config
sudo nano /etc/nginx/sites-available/lca-project

# Add this configuration:
server {
    listen 80;
    server_name $PUBLIC_IP;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Enable site
sudo ln -s /etc/nginx/sites-available/lca-project /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test config
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

**Access your app**: `http://YOUR_PUBLIC_IP`

---

### Phase 4: S3 Setup (10 minutes)

#### 8. Create S3 Buckets

```bash
# Create buckets
aws s3 mb s3://lca-dev-assets-$(date +%s)
aws s3 mb s3://lca-dev-backups-$(date +%s)

# Note: S3 bucket names must be globally unique, hence adding timestamp

# Get bucket names
ASSETS_BUCKET=$(aws s3 ls | grep lca-dev-assets | awk '{print $3}')
BACKUPS_BUCKET=$(aws s3 ls | grep lca-dev-backups | awk '{print $3}')

echo "Assets Bucket: $ASSETS_BUCKET"
echo "Backups Bucket: $BACKUPS_BUCKET"

# Set lifecycle policy for backups (delete after 7 days)
cat > lifecycle.json << EOF
{
  "Rules": [
    {
      "Id": "DeleteOldBackups",
      "Status": "Enabled",
      "ExpirationInDays": 7,
      "Filter": {}
    }
  ]
}
EOF

aws s3api put-bucket-lifecycle-configuration \
  --bucket $BACKUPS_BUCKET \
  --lifecycle-configuration file://lifecycle.json

# Create IAM role for EC2 to access S3
# (Do this via AWS Console: IAM → Roles → Create Role → EC2 → AmazonS3FullAccess)
# Then attach role to EC2 instance
```

---

### Phase 5: Monitoring Setup (15 minutes)

#### 9. Install CloudWatch Agent

```bash
# On EC2 instance
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
sudo dpkg -i -E ./amazon-cloudwatch-agent.deb

# Create CloudWatch config
sudo nano /opt/aws/amazon-cloudwatch-agent/etc/cloudwatch-config.json

# Add this configuration:
{
  "metrics": {
    "namespace": "LCA/Dev",
    "metrics_collected": {
      "mem": {
        "measurement": [
          {"name": "mem_used_percent", "unit": "Percent"}
        ],
        "metrics_collection_interval": 300
      },
      "disk": {
        "measurement": [
          {"name": "used_percent", "unit": "Percent"}
        ],
        "metrics_collection_interval": 300
      }
    }
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/nginx/access.log",
            "log_group_name": "/lca/dev/nginx",
            "log_stream_name": "{instance_id}/access.log",
            "retention_in_days": 7
          }
        ]
      }
    }
  }
}

# Start CloudWatch agent
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config \
  -m ec2 \
  -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/cloudwatch-config.json

# Check status
sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a query \
  -m ec2 \
  -c default
```

---

#### 10. Create Critical Alarms

```bash
# Alarm 1: High CPU (EC2)
aws cloudwatch put-metric-alarm \
  --alarm-name lca-dev-ec2-cpu-high \
  --alarm-description "EC2 CPU > 90% for 10 minutes" \
  --metric-name CPUUtilization \
  --namespace AWS/EC2 \
  --statistic Average \
  --period 600 \
  --threshold 90 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=InstanceId,Value=$INSTANCE_ID

# Alarm 2: High CPU (RDS)
aws cloudwatch put-metric-alarm \
  --alarm-name lca-dev-rds-cpu-high \
  --alarm-description "RDS CPU > 90% for 10 minutes" \
  --metric-name CPUUtilization \
  --namespace AWS/RDS \
  --statistic Average \
  --period 600 \
  --threshold 90 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=DBInstanceIdentifier,Value=lca-dev-db

# Alarm 3: Low storage (RDS)
aws cloudwatch put-metric-alarm \
  --alarm-name lca-dev-rds-storage-low \
  --alarm-description "RDS storage < 2GB" \
  --metric-name FreeStorageSpace \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 2147483648 \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=DBInstanceIdentifier,Value=lca-dev-db

# Alarm 4: Daily cost
aws cloudwatch put-metric-alarm \
  --alarm-name lca-dev-daily-cost-high \
  --alarm-description "Daily AWS cost > $5" \
  --metric-name EstimatedCharges \
  --namespace AWS/Billing \
  --statistic Maximum \
  --period 86400 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=Currency,Value=USD
```

---

## Cost Optimization Tips

### 1. Stop Instances During Non-Working Hours

**Save ~50% on EC2 costs**

```bash
# Create start/stop scripts

# stop-instances.sh
aws ec2 stop-instances --instance-ids $INSTANCE_ID
# RDS will continue running (stopping RDS requires manual intervention)

# start-instances.sh
aws ec2 start-instances --instance-ids $INSTANCE_ID
```

**Automate with Lambda** (optional, adds minimal cost):
```javascript
// Lambda function to stop EC2 at 6 PM weekdays
exports.handler = async () => {
  const ec2 = new AWS.EC2();
  await ec2.stopInstances({
    InstanceIds: ['i-xxxxx']
  }).promise();
};

// Schedule: cron(0 18 ? * MON-FRI *)
```

**Savings**: $7.50/month if stopped 12 hours/day

---

### 2. Use Spot Instances (Advanced)

**Save up to 70%** but instances can be terminated

```bash
# Request Spot instance instead of On-Demand
aws ec2 request-spot-instances \
  --spot-price "0.01" \
  --instance-count 1 \
  --type "one-time" \
  --launch-specification file://spot-spec.json
```

**Not recommended for production**, but great for testing.

---

### 3. RDS Snapshot Instead of Running 24/7

**Save $15/month** when not actively testing

```bash
# Create snapshot before stopping
aws rds create-db-snapshot \
  --db-instance-identifier lca-dev-db \
  --db-snapshot-identifier lca-dev-snapshot-$(date +%Y%m%d)

# Delete RDS instance
aws rds delete-db-instance \
  --db-instance-identifier lca-dev-db \
  --skip-final-snapshot

# Restore from snapshot when needed
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier lca-dev-db \
  --db-snapshot-identifier lca-dev-snapshot-20250117
```

**Snapshot cost**: $0.095/GB/month (20GB = $1.90/month)

---

### 4. Pre-load Ecoinvent Data

Run this script once to populate your database with common substances:

```javascript
// scripts/preload-ecoinvent.js
import { fetchImpactFactor } from '../lib/ecoinvent';
import db from '../lib/database';

const COMMON_SUBSTANCES = [
  'Electricity, medium voltage',
  'Steel, low-alloyed',
  'Concrete, normal',
  'Aluminium, primary',
  'Polypropylene, granulate',
  // Add 50-100 common substances
];

async function preload() {
  for (const substance of COMMON_SUBSTANCES) {
    // Fetch from Ecoinvent once
    const data = await fetchImpactFactor(substance, 'GlobalWarming');

    // Store in database
    await db.query(`
      INSERT INTO driver_impact_factors (driver_name, category_id, impact_factor)
      VALUES (?, 1, ?)
      ON DUPLICATE KEY UPDATE impact_factor = VALUES(impact_factor)
    `, [substance, data.factor]);

    console.log(`✅ Cached: ${substance}`);

    // Wait 500ms between requests (rate limiting)
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log('✅ Pre-loading complete!');
}

preload();
```

**Run once**: `node scripts/preload-ecoinvent.js`

**Result**: 90% reduction in real-time API calls

---

### 5. Set Up Budget Alerts

```bash
# Create budget
aws budgets create-budget \
  --account-id $(aws sts get-caller-identity --query Account --output text) \
  --budget '{
    "BudgetName": "LCA-Dev-Monthly-Budget",
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

**Alert at**: $80/month (80% of $100 budget)

---

### 6. Use Free Tier Strategically

**Free Tier Benefits (First 12 Months)**:
- EC2: 750 hours/month of t2.micro or t3.micro
- RDS: 750 hours/month of db.t2.micro or db.t3.micro
- S3: 5GB storage, 20,000 GET requests, 2,000 PUT requests
- Data Transfer: 100GB out per month
- CloudWatch: 10 alarms, 5GB logs
- Lambda: 1M requests/month, 400,000 GB-seconds

**Optimization**:
- Use t3.micro for EC2 (1GB RAM) → Free
- Use db.t2.micro for RDS (1GB RAM) → Free
- Keep S3 under 5GB → Free
- **Total Cost with Free Tier: $15-25/month**

---

## Testing Phase Workflow

### Daily Development (Low Cost)

```bash
# Morning: Start instances
aws ec2 start-instances --instance-ids $INSTANCE_ID
# Wait 2 minutes for instance to boot

# SSH and check status
ssh ubuntu@$ELASTIC_IP
pm2 status
pm2 logs lca-app --lines 50

# Work on application
# Test features
# Monitor CloudWatch dashboard

# Evening: Stop instances
aws ec2 stop-instances --instance-ids $INSTANCE_ID
```

**Daily Cost**: ~$1.50 (8 hours × $0.0208/hour EC2 + $0.50 RDS)

---

### Weekly Backups (Manual)

```bash
# Create RDS snapshot
aws rds create-db-snapshot \
  --db-instance-identifier lca-dev-db \
  --db-snapshot-identifier lca-dev-$(date +%Y%m%d)

# Backup application files to S3
tar -czf lca-app-backup-$(date +%Y%m%d).tar.gz /var/www/lca-project
aws s3 cp lca-app-backup-$(date +%Y%m%d).tar.gz s3://$BACKUPS_BUCKET/

# Delete old backups (keep last 2 weeks)
aws s3 ls s3://$BACKUPS_BUCKET/ | awk '{print $4}' | sort -r | tail -n +15 | xargs -I {} aws s3 rm s3://$BACKUPS_BUCKET/{}
```

---

### Cost Monitoring Dashboard

**Weekly Check**:
```bash
# Get current month's costs
aws ce get-cost-and-usage \
  --time-period Start=$(date -d '-7 days' +%Y-%m-%d),End=$(date +%Y-%m-%d) \
  --granularity DAILY \
  --metrics BlendedCost \
  --group-by Type=SERVICE

# Check alarms
aws cloudwatch describe-alarms --state-value ALARM

# Check instance running time
aws ec2 describe-instances \
  --instance-ids $INSTANCE_ID \
  --query 'Reservations[0].Instances[0].State.Name'
```

---

## Troubleshooting

### Issue 1: Out of Memory on t3.small

**Symptoms**: Application crashes, PM2 restarts constantly

**Solution**:
```bash
# Add swap space
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
sudo swapon --show

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

---

### Issue 2: RDS Connection Timeout

**Symptoms**: Cannot connect to RDS from EC2

**Solution**:
```bash
# Check security group
aws ec2 describe-security-groups --group-ids $RDS_SG

# Test connection
mysql -h $RDS_ENDPOINT -u lcaadmin -p

# Check RDS status
aws rds describe-db-instances --db-instance-identifier lca-dev-db
```

---

### Issue 3: Redis Out of Memory

**Symptoms**: Cache misses increasing, Redis logs showing OOM

**Solution**:
```bash
# Check Redis memory
redis-cli INFO memory

# Increase maxmemory or enable eviction
sudo nano /etc/redis/redis.conf
# Set: maxmemory 1gb
# Set: maxmemory-policy allkeys-lru

sudo systemctl restart redis-server
```

---

## Comparison: Budget vs Production

| Feature | Budget Setup | Production Setup | Savings |
|---------|--------------|------------------|---------|
| **Compute** | Single EC2 (t3.small) | ECS Fargate (2-10 tasks) | $105/mo |
| **Cache** | Self-hosted Redis | ElastiCache (Multi-AZ) | $85/mo |
| **Database** | db.t3.micro (Single-AZ) | db.t3.medium (Multi-AZ + replica) | $255/mo |
| **Load Balancer** | None (direct access) | ALB | $40/mo |
| **High Availability** | Single instance | Multi-AZ across 2+ zones | - |
| **Auto-Scaling** | Manual | Automatic (2-10 tasks) | - |
| **Monitoring** | Basic | Comprehensive | $13/mo |
| **Backups** | Manual snapshots | Automated + continuous | $18/mo |
| **SSL** | Let's Encrypt (free) | AWS ACM (free) | - |
| **Ecoinvent API** | 500 calls/mo | 5,000 calls/mo | $45/mo |
| **TOTAL** | **~$44/mo** | **~$850/mo** | **$806/mo** |
| **With Free Tier** | **~$15-25/mo** | N/A | **$825-835/mo** |

---

## When to Upgrade to Production Setup

**Upgrade when**:
1. ✅ You have 50+ concurrent users
2. ✅ You need 99.9%+ uptime (Multi-AZ)
3. ✅ You need auto-scaling for traffic spikes
4. ✅ You're processing 10,000+ assessments/day
5. ✅ You need comprehensive monitoring and alerts
6. ✅ You're ready to launch publicly
7. ✅ You need compliance/audit requirements

**Testing phase is sufficient if**:
- ❌ < 10 concurrent users
- ❌ Testing features and bug fixing
- ❌ Development and staging environment
- ❌ Proof of concept / MVP

---

## Summary

### Total Cost Breakdown

**Without Free Tier**:
- EC2 (t3.small, 50% uptime): $15
- RDS (db.t3.micro): $15
- S3 (5GB): $1
- CloudWatch: $2
- Elastic IP: $0
- Data Transfer: $2
- Ecoinvent API (500 calls): $5
- Secrets Manager: $1.20
- Backups: $2
- **TOTAL: ~$43.20/month**

**With Free Tier (First 12 Months)**:
- EC2 (t3.micro): $0
- RDS (db.t2.micro): $0
- S3 (5GB): $0
- CloudWatch: $0
- Data Transfer (under 100GB): $0
- Ecoinvent API: $5
- Secrets Manager: $1.20
- **TOTAL: ~$6.20/month**

### Additional Savings

**Stop instances 12 hours/day**: Save $7.50/month
**Use RDS snapshots**: Save $13/month (delete instance when not testing)
**Pre-load Ecoinvent data**: Save $40/month

**Optimized Budget Cost: $15-25/month** ✅

---

## Quick Start Checklist

- [ ] Launch EC2 instance (t3.small or t3.micro)
- [ ] Allocate Elastic IP
- [ ] Install Node.js, Redis, Nginx, PM2
- [ ] Create RDS instance (db.t3.micro)
- [ ] Import database schema
- [ ] Deploy Next.js application
- [ ] Create S3 buckets
- [ ] Set up CloudWatch alarms
- [ ] Create budget alerts ($100/month)
- [ ] Pre-load Ecoinvent data
- [ ] Test application functionality
- [ ] Set up start/stop schedule

**Estimated Setup Time**: 2-3 hours

---

**Budget achieved! Total cost: $43/month without free tier, $6-15/month with free tier.**

Perfect for testing phase before scaling to production.

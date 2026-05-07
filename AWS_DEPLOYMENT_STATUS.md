# LCA Project v3 - AWS Deployment Status & Budget Optimization

**Date:** 2025-10-12
**Account:** LCA PIX (117852575520)
**Region:** us-east-1
**Status:** ⚠️ In Progress - Cost Optimization

---

## 🎯 Budget Optimization Summary

### Current Cost Analysis (BEFORE Optimization)
| Service | Configuration | Monthly Cost |
|---------|--------------|--------------|
| **RDS** | db.m7g.large Multi-AZ | **$115** ⚠️ |
| **EC2** | t3.small | $20 |
| **S3** | 2 buckets + backups | $10 |
| **Total** | | **$145/month** |

### Optimized Budget (AFTER Optimization)
| Service | Configuration | Monthly Cost | Savings |
|---------|--------------|--------------|---------|
| **RDS** | db.t3.small Single-AZ | **$25** | **-$90** ✅ |
| **EC2** | t3.small | $20 | $0 |
| **S3** | 2 buckets + lifecycle | $8 | -$2 |
| **Total** | | **$53/month** | **-$92/month** |

**Annual Savings: $1,104**

---

## 📊 Current Infrastructure Status

### ✅ Deployed Services

#### 1. **EC2 Application Server**
- **Instance ID:** i-055b91c4baf230251
- **Type:** t3.small (2 vCPU, 2GB RAM)
- **Public IP:** 35.170.250.110
- **Private IP:** 172.31.24.138
- **Status:** ✅ Running
- **Key Pair:** lca-dev-keypair
- **Security Group:** sg-07766b3dc9cf8aac9
- **Cost:** ~$20/month

**Recommended Setup:**
```bash
# SSH into EC2 (need keypair file)
ssh -i lca-dev-keypair.pem ec2-user@35.170.250.110

# Install Node.js for Next.js app
sudo yum update -y
sudo yum install -y nodejs npm
sudo npm install -g pm2

# Install Redis for caching
sudo yum install -y redis
sudo systemctl start redis
sudo systemctl enable redis

# Clone and deploy your application
git clone <your-repo-url>
cd lca-project-v3
npm install
npm run build
pm2 start npm --name "lca-app" -- start
pm2 save
```

#### 2. **RDS MySQL Database**
- **Identifier:** lca-dev-db
- **Current Class:** db.m7g.large (8GB RAM) ⚠️
- **Target Class:** db.t3.small (2GB RAM) ✅
- **Engine:** MySQL 8.0.42
- **Storage:** 20GB (gp2)
- **Multi-AZ:** Yes → Changing to No
- **Endpoint:** lca-dev-db.cmp8mswckq1j.us-east-1.rds.amazonaws.com
- **Port:** 3306
- **Status:** ⏳ Backing up (before downgrade)
- **Backup:** lca-dev-db-backup-before-downgrade-20251012-053621
- **Public Access:** No (VPC only - secure ✅)
- **Username:** lcaadmin
- **Current Cost:** ~$115/month
- **Target Cost:** ~$25/month

**Actions Pending:**
1. ⏳ Wait for backup completion (5-10 minutes)
2. ⏳ Downgrade to db.t3.small Single-AZ
3. ⏳ Verify database connectivity
4. ⏳ Deploy schema and seed data

#### 3. **S3 Storage**
- **Buckets:**
  - `lca-dev-assests` (Created: Oct 10, 2025)
  - `lca-dev-backups` (Created: Oct 10, 2025)
- **Versioning:** Not enabled
- **Lifecycle Policies:** ⏳ To be configured
- **Cost:** ~$10/month (current) → ~$8/month (optimized)

**Recommended Lifecycle Policy:**
```json
{
  "Rules": [
    {
      "Id": "Move old backups to Glacier",
      "Status": "Enabled",
      "Transitions": [
        {
          "Days": 30,
          "StorageClass": "GLACIER"
        }
      ],
      "Expiration": {
        "Days": 90
      }
    }
  ]
}
```

#### 4. **Secrets Manager**
- **Secret:** rds!db-fabed009-0d32-4d03-aa8a-54bb8209c1b4
- **Purpose:** RDS master credentials
- **Cost:** $0.40/month
- **Status:** ✅ Active

#### 5. **VPC & Networking**
- **VPC ID:** vpc-03029e711a7f03684
- **Subnet:** subnet-00ebf63668640640a
- **Security Groups:** Configured
- **Cost:** $0 (free)

### ❌ Missing Services (To Configure)

#### 1. **CloudWatch Alarms** (Critical for Monitoring)
**Priority:** HIGH
**Cost:** $0.10/alarm (~$0.50/month for 5 alarms)

**Recommended Alarms:**
- RDS CPU > 80%
- RDS Storage < 20%
- EC2 CPU > 80%
- Estimated Monthly Charges > $60
- Database Connection Failures > 10

#### 2. **ElastiCache Redis** (Optional)
**Priority:** LOW (use EC2-hosted Redis for budget)
**Cost:** $85/month (too expensive for budget)

**Budget Alternative:** Install Redis on EC2 (included in EC2 cost)

#### 3. **Application Load Balancer** (Optional)
**Priority:** LOW (use direct EC2 access for testing)
**Cost:** $16/month (skip for budget)

---

## 🔧 Database Deployment Ready

### Schema File
- **Location:** `/Users/kavishpandit/Desktop/lca/lca project v3/lca_v3_drawsql_schema.sql`
- **Tables:** 13 tables
- **Features:**
  - ✅ Multi-user collaboration (account, project_members, permissions)
  - ✅ 5-level process hierarchy (component table)
  - ✅ Substance catalog (materials, energy, emissions)
  - ✅ Impact categories (8 standard LCIA categories)
  - ✅ Driver impact factors (calculation engine)
  - ✅ Assessment runs & results (historical tracking)
  - ✅ Audit log (compliance)

### Deployment Script Created
- **Location:** `/Users/kavishpandit/Desktop/lca/lca project v3/deploy-database.sh`
- **Status:** ✅ Ready to execute
- **What it does:**
  1. Waits for RDS to be available
  2. Gets credentials from Secrets Manager
  3. Creates `lca_v3` database
  4. Deploys complete schema (13 tables)
  5. Seeds reference data:
     - 4 permission roles
     - 8 impact categories
     - 13 common substances
     - 11 driver impact factors
  6. Verifies deployment

**To run after RDS downgrade:**
```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
./deploy-database.sh
```

---

## 🚀 Next Steps

### Immediate (Next 30 minutes)
1. ⏳ **Wait for RDS backup to complete**
2. ⏳ **Downgrade RDS to db.t3.small Single-AZ** (saves $90/month)
3. ⏳ **Deploy database schema** (run deploy-database.sh)
4. ⏳ **Verify database connectivity**

### Short-term (Next 1-2 hours)
5. 🔧 **Configure S3 lifecycle policies** (saves $2/month)
6. 🔧 **Set up CloudWatch alarms** (adds $0.50/month)
7. 🔧 **Update EC2 security group** (allow your IP for testing)

### Medium-term (Next 1-2 days)
8. 📦 **Deploy Next.js application to EC2**
9. 🔐 **Configure SSL/TLS certificate** (Let's Encrypt - free)
10. 🧪 **Test complete application stack**
11. 📊 **Set up CloudWatch dashboards**

### Optional Enhancements
12. 🌐 **Configure Route 53** (domain name - $12/year)
13. 🚀 **Set up CloudFront CDN** (improves performance - $5-10/month)
14. 🔄 **Configure automated backups**
15. 📈 **Enable RDS Performance Insights**

---

## 💰 Final Monthly Budget Breakdown

### Core Services (Required)
| Service | Monthly Cost |
|---------|--------------|
| RDS db.t3.small Single-AZ | $25.00 |
| EC2 t3.small | $20.00 |
| S3 Storage + Backups | $8.00 |
| Secrets Manager | $0.40 |
| CloudWatch Alarms (5) | $0.50 |
| **Subtotal** | **$53.90** |

### Optional Services
| Service | Monthly Cost | Priority |
|---------|--------------|----------|
| Route 53 (Domain) | $1.00 | Medium |
| CloudFront CDN | $5-10 | Low |
| ALB (Load Balancer) | $16.00 | Low |
| ElastiCache Redis | $85.00 | Low |

### Budget Summary
- **Minimum Budget:** $53.90/month ✅
- **With Domain:** $54.90/month
- **With CDN:** $59-64/month
- **Target Budget:** Under $100/month ✅

---

## 🔐 Security Checklist

### ✅ Implemented
- [x] RDS not publicly accessible (VPC only)
- [x] Database credentials in Secrets Manager
- [x] Security groups configured
- [x] Encrypted RDS storage

### ⏳ To Implement
- [ ] EC2 security group: Allow only your IP
- [ ] SSL/TLS certificate for HTTPS
- [ ] IAM roles for EC2 (instead of hardcoded credentials)
- [ ] Regular automated backups
- [ ] CloudWatch log monitoring

---

## 📞 AWS Account Details

**Account Name:** LCA PIX
**Account ID:** 117852575520
**Region:** us-east-1 (US East - N. Virginia)
**CLI Profile:** `lca-pix`

**Switch to this account:**
```bash
# Set environment variable
export AWS_PROFILE=lca-pix

# Or use --profile flag
aws s3 ls --profile lca-pix
```

---

## 🔗 Connection Information

### Database Connection
```bash
# MySQL CLI
mysql -h lca-dev-db.cmp8mswckq1j.us-east-1.rds.amazonaws.com \
      -P 3306 \
      -u lcaadmin \
      -p \
      lca_v3

# Connection String for Application
mysql://lcaadmin:[PASSWORD]@lca-dev-db.cmp8mswckq1j.us-east-1.rds.amazonaws.com:3306/lca_v3
```

### EC2 SSH
```bash
# SSH (need keypair file)
ssh -i lca-dev-keypair.pem ec2-user@35.170.250.110
```

### Environment Variables for Application
```bash
# .env.production
DATABASE_HOST=lca-dev-db.cmp8mswckq1j.us-east-1.rds.amazonaws.com
DATABASE_PORT=3306
DATABASE_NAME=lca_v3
DATABASE_USER=lcaadmin
DATABASE_PASSWORD=[from Secrets Manager]

AWS_REGION=us-east-1
S3_BUCKET_ASSETS=lca-dev-assests
S3_BUCKET_BACKUPS=lca-dev-backups
```

---

## 📝 Notes

1. **RDS Downgrade Impact:**
   - Downtime: 5-15 minutes
   - Performance: Still adequate for testing (2 vCPU, 2GB RAM)
   - Can upgrade later when in production

2. **Multi-AZ vs Single-AZ:**
   - Multi-AZ: High availability, automatic failover, 2x cost
   - Single-AZ: Fine for development/testing
   - Recommendation: Use Single-AZ for testing, upgrade to Multi-AZ for production

3. **Cost Monitoring:**
   - Set up billing alert at $60/month
   - Review AWS Cost Explorer weekly
   - Consider Reserved Instances after 3 months (save 30-40%)

4. **Backup Strategy:**
   - RDS automated backups: 1 day retention (included)
   - Manual snapshots before major changes (free for 20GB)
   - S3 backups: Move to Glacier after 30 days

---

**Last Updated:** 2025-10-12 05:36 UTC
**Next Review:** After RDS downgrade completes

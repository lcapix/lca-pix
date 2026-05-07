# Database Deployment Options

Your RDS database is **not publicly accessible** (good for security), which means you can't connect directly from your local machine.

## Option 1: Make RDS Temporarily Public (Quick but Less Secure)

### Steps:
```bash
# 1. Make RDS publicly accessible
aws rds modify-db-instance \
    --db-instance-identifier lca-dev-db-small \
    --publicly-accessible \
    --apply-immediately \
    --profile lca-pix

# 2. Add your IP to security group
YOUR_IP=$(curl -s https://checkip.amazonaws.com)
aws ec2 authorize-security-group-ingress \
    --group-id sg-01baf6b650f9c860a \
    --protocol tcp \
    --port 3306 \
    --cidr $YOUR_IP/32 \
    --profile lca-pix

# 3. Wait 2-3 minutes, then deploy
export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
./deploy-database.sh

# 4. Make RDS private again (IMPORTANT!)
aws rds modify-db-instance \
    --db-instance-identifier lca-dev-db-small \
    --no-publicly-accessible \
    --apply-immediately \
    --profile lca-pix

# 5. Remove your IP from security group
aws ec2 revoke-security-group-ingress \
    --group-id sg-01baf6b650f9c860a \
    --protocol tcp \
    --port 3306 \
    --cidr $YOUR_IP/32 \
    --profile lca-pix
```

**Time:** 10-15 minutes
**Security:** Temporarily exposed (not recommended for production)

---

## Option 2: Deploy from EC2 (Secure, Recommended)

### Prerequisites:
- Need EC2 SSH key file: `lca-dev-keypair.pem`
- Download from AWS Console → EC2 → Key Pairs

### Steps:
```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
./deploy-from-ec2.sh
```

This script:
1. Uploads schema file to EC2
2. Installs MySQL client on EC2
3. Connects to RDS from within VPC
4. Deploys schema and seeds data

**Time:** 5-10 minutes
**Security:** ✅ Best practice (stays within VPC)

---

## Option 3: Manual Deployment via AWS Console

1. Go to AWS Console → RDS
2. Select `lca-dev-db-small`
3. Click "Modify"
4. Set "Public access" to "Yes"
5. Click "Continue" → "Apply immediately"
6. Wait 3-5 minutes
7. Use MySQL Workbench or TablePlus to connect:
   - Host: `lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com`
   - Port: 3306
   - Username: `lcaadmin`
   - Password: Get from Secrets Manager
8. Run the SQL file manually
9. Set "Public access" back to "No"

**Time:** 15-20 minutes
**Security:** Temporarily exposed

---

## Option 4: Use AWS Systems Manager Session Manager

Connect to EC2 without SSH key:

```bash
# Install Session Manager plugin (one-time)
brew install --cask session-manager-plugin

# Start session
aws ssm start-session \
    --target i-055b91c4baf230251 \
    --profile lca-pix

# Then run deployment commands inside the session
```

**Time:** 10 minutes
**Security:** ✅ Very secure (no open ports)

---

## Recommendation

For **testing/development**: Use **Option 1** (temporary public access)
For **production**: Use **Option 2** (deploy from EC2)

---

## Current Status

- ✅ New RDS instance created: `lca-dev-db-small`
- ✅ Cost optimized: $25/month (was $115/month)
- ✅ Schema file ready: `lca_v3_drawsql_schema.sql`
- ⏳ Waiting for deployment method selection

---

## Quick Deploy (Option 1 - Recommended for Now)

Run this single command to make temporary public, deploy, and secure again:

```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"

# Get your IP
YOUR_IP=$(curl -s https://checkip.amazonaws.com)
echo "Your IP: $YOUR_IP"

# Make public and add your IP
aws rds modify-db-instance \
    --db-instance-identifier lca-dev-db-small \
    --publicly-accessible \
    --apply-immediately \
    --profile lca-pix

aws ec2 authorize-security-group-ingress \
    --group-id sg-01baf6b650f9c860a \
    --protocol tcp \
    --port 3306 \
    --cidr $YOUR_IP/32 \
    --profile lca-pix

echo "Waiting 3 minutes for RDS to become publicly accessible..."
sleep 180

# Deploy
export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"
./deploy-database.sh

# Secure again
echo "Re-securing database..."
aws rds modify-db-instance \
    --db-instance-identifier lca-dev-db-small \
    --no-publicly-accessible \
    --apply-immediately \
    --profile lca-pix

aws ec2 revoke-security-group-ingress \
    --group-id sg-01baf6b650f9c860a \
    --protocol tcp \
    --port 3306 \
    --cidr $YOUR_IP/32 \
    --profile lca-pix

echo "✅ Deployment complete and database secured!"
```

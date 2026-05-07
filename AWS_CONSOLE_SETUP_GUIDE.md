# AWS Setup Guide - LCA Project v3 (Web Dashboard Instructions)

## 📋 For Non-Technical Users - No Command Line Required!

**Target Budget**: $43-100/month (or $6-25/month with free tier)
**Setup Time**: 2-3 hours
**Difficulty**: Beginner-friendly ⭐⭐☆☆☆

---

## 🎯 What You'll Create

By the end of this guide, you'll have:
- ✅ A web server running your application (EC2)
- ✅ A database to store your data (RDS)
- ✅ File storage for reports and backups (S3)
- ✅ Monitoring and alerts (CloudWatch)
- ✅ Secure credential storage (Secrets Manager)
- ✅ A fixed web address for your app (Elastic IP)

**Think of it as**: Renting a computer in the cloud (EC2), a database (RDS), and a hard drive (S3) that work together to run your LCA application.

---

## 📊 Cost Summary (What You'll Pay)

| Service | What It Does | Monthly Cost |
|---------|--------------|--------------|
| **EC2** | Web server (runs your app) | $15 |
| **RDS** | Database (stores your data) | $15 |
| **S3** | File storage (reports, backups) | $1 |
| **CloudWatch** | Monitoring and alerts | $2 |
| **Secrets Manager** | Secure password storage | $1.20 |
| **Data Transfer** | Internet bandwidth | $2 |
| **Ecoinvent API** | LCA data service | $5 |
| **TOTAL** | | **~$41.20/month** |

**With Free Tier (First 12 Months)**: ~$6-15/month 🎉

---

## 🚀 Before You Start

### Step 0: Create AWS Account (15 minutes)

1. **Go to**: https://aws.amazon.com
2. **Click**: "Create an AWS Account" (orange button, top right)
3. **Fill in**:
   - Email address
   - Password
   - AWS Account name (e.g., "LCA Project V3")
4. **Contact Information**:
   - Choose "Personal" account type
   - Fill in your name, phone, address
5. **Payment Information**:
   - Enter credit/debit card details
   - AWS won't charge you unless you exceed free tier limits
   - You'll see a temporary $1 charge (verification, will be refunded)
6. **Identity Verification**:
   - Choose phone call or SMS verification
   - Enter the code you receive
7. **Select Support Plan**:
   - Choose "Basic Support - Free"
8. **Wait**: You'll receive a confirmation email (2-5 minutes)
9. **Sign In**: Go to https://console.aws.amazon.com

---

### Step 0.1: Set Up Billing Alerts (10 minutes)

**⚠️ IMPORTANT: Do this first to avoid surprise charges!**

1. **Sign in to AWS Console**: https://console.aws.amazon.com
2. **Click your account name** (top right) → **Account**
3. **Scroll down** to "IAM User and Role Access to Billing Information"
4. **Click "Edit"** → Check the box → **Click "Update"**

Now set up budget alerts:

5. **Go to**: AWS Console → Search bar (top) → Type "Budgets" → Click **AWS Budgets**
6. **Click**: "Create budget" (orange button)
7. **Choose**: "Use a template (simplified)"
8. **Select**: "Monthly cost budget"
9. **Fill in**:
   - Budget name: `LCA-Monthly-Budget`
   - Budgeted amount: `100` (dollars)
   - Email recipients: Your email address
10. **Click**: "Create budget"

**What this does**: You'll get an email when you reach $80/month (80% of budget)

---

## 📝 Section 1: Create Storage (S3 Buckets)

**Time**: 10 minutes
**Cost**: ~$1/month

### What is S3?
Think of S3 as a cloud hard drive where you'll store:
- User-uploaded files
- PDF reports
- Database backups
- Application logs

---

### Step 1.1: Create Assets Bucket

1. **Go to AWS Console**: https://console.aws.amazon.com
2. **Search bar** (top): Type `S3` → Click **S3**
3. **Click**: "Create bucket" (orange button)
4. **Fill in**:
   - **Bucket name**: `lca-dev-assets-YOURNAME` (replace YOURNAME with your initials, e.g., `lca-dev-assets-jd`)
     - Note: Bucket names must be globally unique across all AWS users
     - Use lowercase letters, numbers, and hyphens only
   - **AWS Region**: Select `US East (N. Virginia) us-east-1`
     - Important: Use the same region for all services
5. **Object Ownership**: Leave as "ACLs disabled (recommended)"
6. **Block Public Access**: Leave all checkboxes **checked** (keep files private)
7. **Bucket Versioning**: Leave as "Disable"
8. **Default encryption**: Select "Enable"
   - Choose "Server-side encryption with Amazon S3 managed keys (SSE-S3)"
9. **Scroll down** → **Click**: "Create bucket"

---

### Step 1.2: Create Backups Bucket

Repeat the same steps:

1. **Click**: "Create bucket"
2. **Bucket name**: `lca-dev-backups-YOURNAME`
3. **Region**: `US East (N. Virginia) us-east-1`
4. **Same settings as before** → **Create bucket**

---

### Step 1.3: Set Up Auto-Delete for Old Backups

To save money, automatically delete backups older than 7 days:

1. **Click on**: Your `lca-dev-backups-YOURNAME` bucket (from the list)
2. **Click**: "Management" tab (top menu)
3. **Scroll down** → **Click**: "Create lifecycle rule"
4. **Fill in**:
   - **Rule name**: `Delete-Old-Backups`
   - **Choose a rule scope**: Select "Apply to all objects in the bucket"
   - **Check the box**: "I acknowledge that this rule will apply to all objects..."
5. **Lifecycle rule actions**: Check "Expire current versions of objects"
6. **Days after object creation**: `7`
7. **Scroll down** → **Click**: "Create rule"

**What this does**: Backups older than 7 days are automatically deleted to save storage costs.

---

## 📝 Section 2: Create Database (RDS)

**Time**: 20 minutes (plus 10-minute wait)
**Cost**: ~$15/month (FREE for first 12 months with free tier)

### What is RDS?
RDS is a managed database service. Think of it as a spreadsheet on steroids that stores all your LCA project data (accounts, projects, components, assessments).

---

### Step 2.1: Create Database

1. **AWS Console** → **Search**: `RDS` → Click **RDS**
2. **Click**: "Create database" (orange button)

**Step 1 - Choose Engine**:
3. **Select**: "Standard create"
4. **Engine type**: Select **MySQL**
5. **Engine Version**: Select **MySQL 8.0.35** (or latest 8.0.x)

**Step 2 - Templates**:
6. **Select**: **Free tier** (if available) OR **Dev/Test** (if you're past 12 months)

**Step 3 - Settings**:
7. **DB instance identifier**: `lca-dev-db` (this is the database name)
8. **Master username**: `lcaadmin`
9. **Master password**: Click "Auto generate a password" (RECOMMENDED)
   - ⚠️ **IMPORTANT**: Click the "View" button and copy this password to a safe place (Notepad/Notes app)
   - You'll need this password later!

**Step 4 - Instance Configuration**:
10. **DB instance class**: Select **Burstable classes**
11. **Choose**: `db.t3.micro` (1 vCPU, 1 GB RAM)
    - If free tier available, choose `db.t2.micro`

**Step 5 - Storage**:
12. **Storage type**: `General Purpose SSD (gp2)`
13. **Allocated storage**: `20` GB
14. **Uncheck**: "Enable storage autoscaling" (save money)

**Step 6 - Connectivity**:
15. **Virtual private cloud (VPC)**: Select **Default VPC**
16. **Public access**: Select **Yes**
    - We need this so EC2 can connect
17. **VPC security group**: Select "Create new"
    - **Name**: `lca-dev-db-sg`

**Step 7 - Database Authentication**:
18. **Select**: "Password authentication"

**Step 8 - Additional Configuration** (click to expand):
19. **Initial database name**: `lca_dev`
    - ⚠️ Important: Don't skip this!
20. **Backup**:
    - **Backup retention**: `1 day` (minimum)
    - **Backup window**: Leave as default
21. **Encryption**: Check "Enable encryption"
22. **Monitoring**:
    - Check "Enable Performance Insights"
    - **Retention**: `7 days`
23. **Maintenance**:
    - Uncheck "Enable auto minor version upgrade" (avoid surprises)

**Final Step**:
24. **Scroll down** → **Click**: "Create database" (orange button)

⏰ **Wait 5-10 minutes** for the database to be created. You'll see "Creating" status change to "Available".

---

### Step 2.2: Note Down Database Endpoint

Once status shows "Available":

1. **Click on** your database name: `lca-dev-db`
2. **Scroll to** "Connectivity & security" section
3. **Find**: "Endpoint" (looks like `lca-dev-db.xxxxx.us-east-1.rds.amazonaws.com`)
4. **Copy this** to Notepad - you'll need it later!

Example: `lca-dev-db.ch1a2b3c4d5e.us-east-1.rds.amazonaws.com`

---

### Step 2.3: Configure Security Group (Allow Access)

Right now, nothing can connect to your database. Let's fix that:

1. **Click**: "VPC security groups" link (under Connectivity & security)
2. **Click**: The security group name (e.g., `lca-dev-db-sg`)
3. **Click**: "Inbound rules" tab (bottom panel)
4. **Click**: "Edit inbound rules"
5. **Click**: "Add rule"
6. **Fill in**:
   - **Type**: Select `MySQL/Aurora`
   - **Source**: Select `Anywhere-IPv4` (0.0.0.0/0)
     - Note: This is for testing only. In production, restrict to specific IPs
7. **Click**: "Save rules"

**What this does**: Allows your web server to connect to the database.

---

## 📝 Section 3: Create Web Server (EC2)

**Time**: 30 minutes
**Cost**: ~$15/month (FREE for first 12 months with t3.micro)

### What is EC2?
EC2 is a virtual computer in the cloud that runs your Next.js application. Think of it as renting a computer that's always on and accessible via the internet.

---

### Step 3.1: Launch EC2 Instance

1. **AWS Console** → **Search**: `EC2` → Click **EC2**
2. **Click**: "Launch instance" (orange button)

**Step 1 - Name and Tags**:
3. **Name**: `lca-dev-server`

**Step 2 - Application and OS Images**:
4. **Quick Start**: Click **Ubuntu**
5. **Select**: **Ubuntu Server 22.04 LTS** (should say "Free tier eligible")
6. **Architecture**: Select `64-bit (x86)`

**Step 3 - Instance Type**:
7. **Select**: `t3.small` (2 vCPU, 2 GB RAM)
   - OR `t3.micro` (2 vCPU, 1 GB RAM) if you want to use free tier
   - Note: t3.small is recommended for better performance

**Step 4 - Key Pair (Login)**:
8. **Click**: "Create new key pair"
9. **Fill in**:
   - **Key pair name**: `lca-dev-keypair`
   - **Key pair type**: RSA
   - **Private key file format**:
     - **Windows users**: Select `.ppk` (for PuTTY)
     - **Mac/Linux users**: Select `.pem`
10. **Click**: "Create key pair"
11. **Save the downloaded file** to a safe place (you can't download it again!)

**Step 5 - Network Settings**:
12. **Click**: "Edit" (next to Network settings)
13. **Auto-assign public IP**: Select **Enable**
14. **Firewall (security groups)**: Select "Create security group"
15. **Security group name**: `lca-dev-server-sg`
16. **Description**: `Security group for LCA dev server`
17. **Inbound security group rules**:
    - **Rule 1 (SSH)**: Already added
      - Type: SSH
      - Source: My IP (or Anywhere for easier access)
    - **Click "Add security group rule"** and add:

    **Rule 2 (HTTP)**:
    - Type: HTTP
    - Source: Anywhere

    **Rule 3 (HTTPS)**:
    - Type: HTTPS
    - Source: Anywhere

    **Rule 4 (Custom TCP for Next.js)**:
    - Type: Custom TCP
    - Port range: 3000
    - Source: Anywhere

**Step 6 - Configure Storage**:
18. **Size**: `30` GB
19. **Volume type**: `gp3`
20. **Delete on termination**: Check (enabled)

**Step 7 - Advanced Details** (click to expand):
21. **IAM instance profile**: Leave as "None" (we'll add permissions later)
22. Scroll to bottom

**Final Step**:
23. **Click**: "Launch instance" (orange button)
24. **Wait 2-3 minutes** for the instance to start

---

### Step 3.2: Get Your Server's IP Address

1. **Click**: "View all instances"
2. **Check the box** next to your instance: `lca-dev-server`
3. **Look at the details below**:
   - Find **Public IPv4 address** (e.g., `54.123.45.67`)
   - **Copy this IP address** to Notepad - this is your server's address!

---

### Step 3.3: Allocate Elastic IP (Fixed Address)

Your server's IP address changes if you restart it. Let's fix that:

1. **Left sidebar** → Click **Elastic IPs** (under "Network & Security")
2. **Click**: "Allocate Elastic IP address" (orange button)
3. **Click**: "Allocate"
4. **Select** the new IP address (check the box)
5. **Actions** dropdown → **Associate Elastic IP address**
6. **Fill in**:
   - **Resource type**: Instance
   - **Instance**: Select `lca-dev-server`
   - **Private IP address**: Leave as default
7. **Click**: "Associate"

**What this does**: Your server now has a permanent IP address that won't change.

8. **Copy the Elastic IP** to Notepad - this is your app's permanent address!

---

## 📝 Section 4: Store Passwords Securely (Secrets Manager)

**Time**: 10 minutes
**Cost**: ~$1.20/month

### What is Secrets Manager?
Instead of storing passwords in plain text files, Secrets Manager encrypts and stores them securely.

---

### Step 4.1: Store Database Password

1. **AWS Console** → **Search**: `Secrets Manager` → Click **Secrets Manager**
2. **Click**: "Store a new secret" (orange button)

**Step 1 - Secret Type**:
3. **Select**: "Other type of secret"
4. **Key/value pairs**: Click "Plaintext" tab
5. **Delete** the example text and paste this (replace with your actual values):

```json
{
  "host": "lca-dev-db.xxxxx.us-east-1.rds.amazonaws.com",
  "port": 3306,
  "username": "lcaadmin",
  "password": "YOUR_DATABASE_PASSWORD_HERE",
  "database": "lca_dev"
}
```

Replace:
- `lca-dev-db.xxxxx...` with your RDS endpoint (from Step 2.2)
- `YOUR_DATABASE_PASSWORD_HERE` with your database password (from Step 2.1)

6. **Encryption key**: Leave as default
7. **Click**: "Next"

**Step 2 - Secret Name**:
8. **Secret name**: `lca/database-credentials`
9. **Description**: `Database connection details for LCA dev`
10. **Click**: "Next"

**Step 3 - Configure Rotation**:
11. **Select**: "Disable automatic rotation" (for now)
12. **Click**: "Next"

**Step 4 - Review**:
13. **Click**: "Store"

---

### Step 4.2: Store Redis Password

Repeat the same process:

1. **Click**: "Store a new secret"
2. **Select**: "Other type of secret"
3. **Plaintext** tab, paste:

```json
{
  "password": "CHANGE_THIS_TO_SECURE_PASSWORD"
}
```

4. **Secret name**: `lca/redis-credentials`
5. **Next** → **Next** → **Store**

---

### Step 4.3: Store Ecoinvent API Credentials

1. **Click**: "Store a new secret"
2. **Select**: "Other type of secret"
3. **Plaintext** tab, paste:

```json
{
  "api_key": "YOUR_ECOINVENT_API_KEY",
  "username": "YOUR_ECOINVENT_USERNAME",
  "password": "YOUR_ECOINVENT_PASSWORD",
  "base_url": "https://ecoinvent.org/api/v3"
}
```

Replace with your actual Ecoinvent credentials (you'll get these from Ecoinvent)

4. **Secret name**: `lca/ecoinvent-credentials`
5. **Next** → **Next** → **Store**

---

## 📝 Section 5: Set Up Monitoring (CloudWatch)

**Time**: 15 minutes
**Cost**: ~$2/month

### What is CloudWatch?
CloudWatch monitors your server and database, and sends you email alerts if something goes wrong (like high CPU usage or database running out of space).

---

### Step 5.1: Create SNS Topic (For Email Alerts)

First, we need to set up email notifications:

1. **AWS Console** → **Search**: `SNS` → Click **Simple Notification Service**
2. **Left sidebar** → Click **Topics**
3. **Click**: "Create topic"
4. **Type**: Select **Standard**
5. **Name**: `lca-dev-alerts`
6. **Display name**: `LCA Alerts`
7. **Click**: "Create topic"

Now subscribe your email:

8. **Click**: "Create subscription"
9. **Protocol**: Select **Email**
10. **Endpoint**: Enter your email address
11. **Click**: "Create subscription"
12. **Check your email** → Click the confirmation link in the email from AWS

---

### Step 5.2: Create Alarms

#### Alarm 1: High Server CPU

1. **AWS Console** → **Search**: `CloudWatch` → Click **CloudWatch**
2. **Left sidebar** → **Alarms** → **All alarms**
3. **Click**: "Create alarm"
4. **Click**: "Select metric"
5. **Click**: "EC2" → "Per-Instance Metrics"
6. **Search** for your instance name: `lca-dev-server`
7. **Find the row** with "CPUUtilization" → **Check the box**
8. **Click**: "Select metric" (bottom right)

**Configure alarm**:
9. **Conditions**:
   - **Threshold type**: Static
   - **Whenever CPUUtilization is**: Greater/Equal
   - **than...**: `90`
10. **Click**: "Next"

**Configure actions**:
11. **Alarm state trigger**: Select **In alarm**
12. **Send notification to**: Select your SNS topic `lca-dev-alerts`
13. **Click**: "Next"

**Name and description**:
14. **Alarm name**: `lca-dev-server-cpu-high`
15. **Description**: `Alert when server CPU exceeds 90%`
16. **Click**: "Next"
17. **Click**: "Create alarm"

---

#### Alarm 2: High Database CPU

Repeat the process:

1. **Create alarm** → **Select metric**
2. **Click**: "RDS" → "Per-Database Metrics"
3. **Find**: Your database `lca-dev-db` with "CPUUtilization"
4. **Select** → **Threshold**: `90`
5. **SNS topic**: `lca-dev-alerts`
6. **Name**: `lca-dev-db-cpu-high`
7. **Create alarm**

---

#### Alarm 3: Low Database Storage

1. **Create alarm** → **Select metric**
2. **RDS** → **Per-Database Metrics**
3. **Find**: Your database `lca-dev-db` with "FreeStorageSpace"
4. **Select** → **Threshold type**: Static
5. **Whenever FreeStorageSpace is**: Lower/Equal
6. **than...**: `2000000000` (2 GB in bytes)
7. **SNS topic**: `lca-dev-alerts`
8. **Name**: `lca-dev-db-storage-low`
9. **Create alarm**

---

## 📝 Section 6: Grant Permissions (IAM)

**Time**: 10 minutes
**Cost**: FREE

### What is IAM?
IAM (Identity and Access Management) controls who can access what in AWS. We'll give your server permission to access S3 and Secrets Manager.

---

### Step 6.1: Create IAM Role for EC2

1. **AWS Console** → **Search**: `IAM` → Click **IAM**
2. **Left sidebar** → Click **Roles**
3. **Click**: "Create role"

**Step 1 - Select trusted entity**:
4. **Trusted entity type**: Select **AWS service**
5. **Use case**: Select **EC2**
6. **Click**: "Next"

**Step 2 - Add permissions**:
7. **Search** for: `AmazonS3FullAccess`
8. **Check the box** next to it
9. **Search** for: `SecretsManagerReadWrite`
10. **Check the box** next to it
11. **Search** for: `CloudWatchAgentServerPolicy`
12. **Check the box** next to it
13. **Click**: "Next"

**Step 3 - Name and review**:
14. **Role name**: `lca-dev-server-role`
15. **Description**: `Role for LCA dev server to access S3 and Secrets Manager`
16. **Click**: "Create role"

---

### Step 6.2: Attach Role to EC2 Instance

1. **AWS Console** → **EC2** → **Instances**
2. **Check the box** next to `lca-dev-server`
3. **Actions** dropdown → **Security** → **Modify IAM role**
4. **IAM role**: Select `lca-dev-server-role`
5. **Click**: "Update IAM role"

**What this does**: Your server can now access S3 buckets and read passwords from Secrets Manager.

---

## 📝 Section 7: Connect to Your Server

**Time**: 10 minutes

Now we need to connect to your server to install the application. There are two ways:

---

### Option A: Connect via Browser (Easiest)

1. **AWS Console** → **EC2** → **Instances**
2. **Check the box** next to `lca-dev-server`
3. **Click**: "Connect" button (top right)
4. **Select**: "EC2 Instance Connect" tab
5. **Click**: "Connect" (orange button)

A new browser window opens with a terminal!

---

### Option B: Connect via SSH (For Advanced Users)

**Windows users** (using PuTTY):
1. Download PuTTY: https://www.putty.org/
2. Open PuTTY
3. **Host Name**: `ubuntu@YOUR_ELASTIC_IP`
4. **Port**: `22`
5. **Connection type**: SSH
6. **Left sidebar** → **SSH** → **Auth** → **Credentials**
7. **Private key file**: Browse to your `.ppk` file
8. **Click**: "Open"

**Mac/Linux users**:
1. Open Terminal
2. Run: `chmod 400 /path/to/lca-dev-keypair.pem`
3. Run: `ssh -i /path/to/lca-dev-keypair.pem ubuntu@YOUR_ELASTIC_IP`

---

## 📝 Section 8: Install Software on Server

**Time**: 20 minutes

Once connected to your server, you'll see a command prompt. Copy and paste these commands one by one.

⚠️ **How to paste**:
- Browser terminal: Right-click → Paste
- PuTTY: Right-click (auto-pastes)
- Mac Terminal: Cmd+V

---

### Step 8.1: Update System

```bash
sudo apt-get update
sudo apt-get upgrade -y
```

Wait 2-3 minutes for this to complete.

---

### Step 8.2: Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

Verify installation:
```bash
node --version
```

Should show: `v20.x.x`

---

### Step 8.3: Install Redis (Cache Server)

```bash
sudo apt-get install redis-server -y
```

Configure Redis:
```bash
sudo nano /etc/redis/redis.conf
```

This opens a text editor. Use arrow keys to navigate.

Find these lines (use Ctrl+W to search):

1. Search for: `maxmemory`
   - Add this line: `maxmemory 512mb`

2. Search for: `maxmemory-policy`
   - Add this line: `maxmemory-policy allkeys-lru`

3. Search for: `requirepass`
   - Add this line: `requirepass YOUR_SECURE_PASSWORD`
   - Replace `YOUR_SECURE_PASSWORD` with a strong password (same as in Secrets Manager)

**Save and exit**: Press `Ctrl+X`, then `Y`, then `Enter`

Restart Redis:
```bash
sudo systemctl restart redis-server
sudo systemctl enable redis-server
```

---

### Step 8.4: Install PM2 (Process Manager)

```bash
sudo npm install -g pm2
```

---

### Step 8.5: Install Nginx (Web Server)

```bash
sudo apt-get install nginx -y
```

---

### Step 8.6: Install MySQL Client

```bash
sudo apt-get install mysql-client -y
```

---

### Step 8.7: Create Directories

```bash
sudo mkdir -p /var/www/lca-project
sudo mkdir -p /var/cache/ecoinvent
sudo chown -R ubuntu:ubuntu /var/www/lca-project
sudo chown -R ubuntu:ubuntu /var/cache/ecoinvent
```

---

## 📝 Section 9: Import Database Schema

**Time**: 5 minutes

Now let's set up the database tables.

---

### Step 9.1: Upload Schema File to Server

**Option A: Use SCP (Command line on your computer)**

```bash
scp -i /path/to/lca-dev-keypair.pem /path/to/lca_v3_drawsql_schema.sql ubuntu@YOUR_ELASTIC_IP:/home/ubuntu/
```

**Option B: Copy-Paste Method (Easier)**

1. On your local computer, open: `lca_v3_drawsql_schema.sql`
2. Copy all the contents
3. In your server terminal, create a new file:
```bash
nano /home/ubuntu/schema.sql
```
4. Paste the contents (Right-click → Paste)
5. Save and exit: `Ctrl+X`, `Y`, `Enter`

---

### Step 9.2: Import to Database

```bash
mysql -h YOUR_RDS_ENDPOINT -u lcaadmin -p lca_dev < /home/ubuntu/schema.sql
```

Replace:
- `YOUR_RDS_ENDPOINT` with your database endpoint (from Step 2.2)

When prompted, enter your database password.

**Verify**:
```bash
mysql -h YOUR_RDS_ENDPOINT -u lcaadmin -p lca_dev -e "SHOW TABLES;"
```

You should see your 13 tables listed!

---

## 📝 Section 10: Deploy Your Application

**Time**: 15 minutes

⚠️ **Note**: This section assumes your developer will provide you with:
- Application source code (GitHub repository or zip file)
- Environment variables (.env file)

For now, I'll show you the structure. Your developer will fill in the details.

---

### Step 10.1: Get Application Code

**If using GitHub**:
```bash
cd /var/www/lca-project
git clone https://github.com/YOUR_USERNAME/lca-project-v3.git .
```

**If using zip file**:
1. Upload zip to S3 bucket
2. Download on server:
```bash
cd /var/www/lca-project
aws s3 cp s3://YOUR_BUCKET/lca-app.zip .
unzip lca-app.zip
```

---

### Step 10.2: Create Environment File

Your developer will provide these values:

```bash
nano /var/www/lca-project/.env.local
```

Paste (your developer will provide actual values):
```
NODE_ENV=production

DATABASE_URL=mysql://lcaadmin:PASSWORD@RDS_ENDPOINT:3306/lca_dev

REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=YOUR_REDIS_PASSWORD

ECOINVENT_API_KEY=YOUR_KEY
ECOINVENT_BASE_URL=https://ecoinvent.org/api/v3

JWT_SECRET=RANDOM_SECRET_HERE
SESSION_SECRET=RANDOM_SECRET_HERE

NEXT_PUBLIC_API_URL=http://YOUR_ELASTIC_IP:3000
```

Save and exit: `Ctrl+X`, `Y`, `Enter`

---

### Step 10.3: Install Dependencies and Build

```bash
cd /var/www/lca-project
npm install
npm run build
```

This will take 3-5 minutes.

---

### Step 10.4: Start Application

```bash
pm2 start npm --name "lca-app" -- start
pm2 save
pm2 startup systemd
```

Copy the command that PM2 outputs and run it. It will look like:
```bash
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u ubuntu --hp /home/ubuntu
```

---

### Step 10.5: Check Application Status

```bash
pm2 status
pm2 logs lca-app --lines 50
```

You should see your app running on port 3000!

---

## 📝 Section 11: Access Your Application

**Time**: 2 minutes

Open your browser and go to:
```
http://YOUR_ELASTIC_IP:3000
```

Replace `YOUR_ELASTIC_IP` with your server's IP address.

You should see your LCA application! 🎉

---

## 📝 Section 12: Set Up Automatic Backups

**Time**: 5 minutes

### Database Backups (Manual Snapshots)

1. **AWS Console** → **RDS** → **Databases**
2. **Click** on: `lca-dev-db`
3. **Actions** dropdown → **Take snapshot**
4. **Snapshot name**: `lca-dev-manual-backup-YYYYMMDD`
   - Replace YYYYMMDD with today's date (e.g., `20250117`)
5. **Click**: "Take snapshot"

**Repeat this weekly** to have rolling backups.

---

## 📝 Section 13: Cost Management

### Monitor Your Costs Daily

1. **AWS Console** → **Search**: `Cost Explorer` → **Cost Explorer**
2. **Click**: "Launch Cost Explorer"
3. **View**: Daily costs, grouped by service

**Check this once a week** to ensure you're staying under budget!

---

### Stop Server When Not Using (Save 50%)

If you're not actively testing:

**Stop Server**:
1. **EC2** → **Instances**
2. **Check box** next to `lca-dev-server`
3. **Instance state** dropdown → **Stop instance**

**Start Server** (when needed):
1. Same steps, but choose **Start instance**

⚠️ **Note**: Database (RDS) continues running and charging. To stop RDS:

**Stop Database**:
1. **RDS** → **Databases**
2. **Select**: `lca-dev-db`
3. **Actions** → **Stop temporarily** (auto-starts after 7 days)

---

## ✅ Final Checklist

- [ ] AWS account created
- [ ] Billing alerts set up ($100 budget)
- [ ] S3 buckets created (assets + backups)
- [ ] RDS database created and accessible
- [ ] EC2 server launched with Elastic IP
- [ ] Secrets Manager configured with credentials
- [ ] CloudWatch alarms created (3 alarms)
- [ ] IAM role attached to EC2
- [ ] Software installed on server (Node.js, Redis, Nginx)
- [ ] Database schema imported
- [ ] Application deployed and running
- [ ] Can access app via browser
- [ ] Took first database snapshot

---

## 🆘 Troubleshooting

### Issue 1: Can't Access Application in Browser

**Check**:
1. Is EC2 instance running? (AWS Console → EC2 → Instances → State should be "Running")
2. Is security group configured correctly? (Port 3000 should be open)
3. Is app running? (Connect to server and run `pm2 status`)

**Solution**:
```bash
pm2 restart lca-app
pm2 logs lca-app
```

---

### Issue 2: Application Can't Connect to Database

**Check**:
1. Is RDS instance running? (RDS → Databases → Status should be "Available")
2. Is security group allowing connections? (RDS security group should allow port 3306)
3. Is password correct in .env file?

**Solution**: Double-check RDS endpoint and password in `/var/www/lca-project/.env.local`

---

### Issue 3: Costs Higher Than Expected

**Check**:
1. AWS Console → Billing Dashboard → Bill Details
2. Look for unexpected charges

**Common causes**:
- Elastic IP not attached to running instance
- NAT Gateway accidentally created
- Data transfer out (large file downloads)
- Multiple instances running

**Solution**: Delete unused resources via AWS Console.

---

## 📞 Getting Help

### AWS Support (Free Tier)
- AWS Console → Support Center → Create case
- Response time: 24 hours

### Community Help
- AWS Forums: https://forums.aws.amazon.com/
- Stack Overflow: Tag questions with `amazon-web-services`

---

## 🎯 What to Tell Your Developer

Once you've completed this setup, provide your developer with:

1. **Elastic IP address**: `YOUR_ELASTIC_IP`
2. **RDS endpoint**: `lca-dev-db.xxxxx.us-east-1.rds.amazonaws.com`
3. **S3 bucket names**:
   - Assets: `lca-dev-assets-YOURNAME`
   - Backups: `lca-dev-backups-YOURNAME`
4. **AWS Region**: `us-east-1`
5. **Secrets Manager paths**:
   - Database: `lca/database-credentials`
   - Redis: `lca/redis-credentials`
   - Ecoinvent: `lca/ecoinvent-credentials`

Your developer can then:
- SSH into the server
- Deploy application updates
- Configure environment variables
- Set up CI/CD pipelines
- Optimize performance

---

## 📊 Expected Monthly Costs

| Item | Cost |
|------|------|
| EC2 (t3.small, running 24/7) | $15.18 |
| RDS (db.t3.micro, running 24/7) | $15.33 |
| S3 (10GB storage + transfer) | $1.50 |
| CloudWatch (logs + alarms) | $2.00 |
| Secrets Manager (3 secrets) | $1.20 |
| Data Transfer | $2.00 |
| Ecoinvent API (500 calls) | $5.00 |
| **TOTAL** | **$42.21/month** | Still a range expectation 50-100 $

**With Free Tier (First 12 Months)**:
- EC2 t3.micro: FREE
- RDS db.t2.micro: FREE
- S3: FREE (under 5GB)
- Data Transfer: FREE (under 100GB)
- **TOTAL**: ~$6-15/month

---

## 🎉 Congratulations!

You've successfully set up:
- ✅ A cloud-based web server
- ✅ A managed database
- ✅ Secure file storage
- ✅ Monitoring and alerts
- ✅ A fully functional LCA application environment

**Next Steps**:
1. Share the details with your developer
2. Test the application thoroughly
3. Monitor costs weekly
4. Take weekly database backups
5. When ready for production, upgrade to larger instances

---

**Need help?** Save this document and refer back to it. Share specific sections with your developer as needed.

**Budget achieved: ~$42/month** ✅ (Under $100 target!)

#!/bin/bash
# EC2 Setup Script
# Copy this script to EC2 and run it after downloading lca-app.tar.gz from S3

set -e

echo "🖥️  LCA v3 EC2 Setup"
echo "===================="
echo ""

# Configuration
RDS_HOST="lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com"
RDS_USER="lcaadmin"
RDS_PASS="EP76017fLefZ8?d!ezTHsN[kA()X"
RDS_DB="lca_v3"
S3_BUCKET="lca-v3-uploads"

echo "📥 Step 1: Download Application from S3"
echo "----------------------------------------"
cd /home/ubuntu
aws s3 cp s3://$S3_BUCKET/lca-app.tar.gz .
echo "✅ Downloaded"
echo ""

echo "📦 Step 2: Extract Application"
echo "-------------------------------"
tar -xzf lca-app.tar.gz
echo "✅ Extracted"
echo ""

echo "🔧 Step 3: Install Node.js 18"
echo "------------------------------"
if ! command -v node &> /dev/null; then
  echo "Installing Node.js..."
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
else
  NODE_VERSION=$(node --version)
  echo "Node.js already installed: $NODE_VERSION"
fi
echo "✅ Node.js ready"
echo ""

echo "📦 Step 4: Install PM2"
echo "-----------------------"
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2..."
  sudo npm install -g pm2
else
  echo "PM2 already installed"
fi
echo "✅ PM2 ready"
echo ""

echo "📚 Step 5: Install MySQL Client"
echo "--------------------------------"
if ! command -v mysql &> /dev/null; then
  echo "Installing MySQL client..."
  sudo apt-get update
  sudo apt-get install -y mysql-client
else
  echo "MySQL client already installed"
fi
echo "✅ MySQL client ready"
echo ""

echo "📦 Step 6: Install Node Dependencies"
echo "-------------------------------------"
npm install --production --legacy-peer-deps
echo "✅ Dependencies installed"
echo ""

echo "🗄️  Step 7: Test Database Connection"
echo "-------------------------------------"
mysql -h $RDS_HOST -u $RDS_USER -p"$RDS_PASS" -e "SELECT 1;" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "✅ Database connection successful"
else
  echo "❌ Database connection failed"
  echo "Please check RDS security group allows EC2 access"
  exit 1
fi
echo ""

echo "🗄️  Step 8: Create Test Data"
echo "-----------------------------"
read -p "Create test data now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
  mysql -h $RDS_HOST -u $RDS_USER -p"$RDS_PASS" $RDS_DB < create-test-data.sql
  echo "✅ Test data created"

  # Verify
  echo ""
  echo "Verifying test data..."
  mysql -h $RDS_HOST -u $RDS_USER -p"$RDS_PASS" $RDS_DB -e "
    SELECT 'Users:' as '', COUNT(*) FROM account;
    SELECT 'Projects:' as '', COUNT(*) FROM project;
    SELECT 'Components:' as '', COUNT(*) FROM component;
    SELECT 'Flows:' as '', COUNT(*) FROM flows;
    SELECT 'Assessments:' as '', COUNT(*) FROM assessment_runs;
  "
fi
echo ""

echo "🚀 Step 9: Start Application"
echo "-----------------------------"
# Stop existing instance if running
pm2 stop lca-app 2>/dev/null || true
pm2 delete lca-app 2>/dev/null || true

# Start application
pm2 start npm --name "lca-app" -- start

echo "✅ Application started"
echo ""

echo "📊 Step 10: Check Status"
echo "------------------------"
sleep 3
pm2 status
echo ""

echo "📝 Step 11: View Logs"
echo "---------------------"
pm2 logs lca-app --lines 20 --nostream
echo ""

echo "🎉 Setup Complete!"
echo "=================="
echo ""
echo "📍 Your application is running!"
echo ""
echo "🌐 Access URL:"
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo "   http://$EC2_IP:3000"
echo ""
echo "🔐 Test Login:"
echo "   Email: john@lcaproject.com"
echo "   Password: password123"
echo ""
echo "📋 Useful Commands:"
echo "   pm2 logs lca-app          # View logs"
echo "   pm2 restart lca-app       # Restart app"
echo "   pm2 stop lca-app          # Stop app"
echo "   pm2 status                # Check status"
echo ""
echo "🔍 Next Steps:"
echo "   1. Test in browser: http://$EC2_IP:3000"
echo "   2. Run test-deployment.sh from local machine"
echo "   3. Share with PM for validation"
echo ""

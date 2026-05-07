#!/bin/bash
# Quick Deploy Script for LCA v3 to EC2
# Run this from your local machine

set -e

echo "🚀 LCA v3 EC2 Deployment Script"
echo "================================"
echo ""

# Configuration
EC2_INSTANCE_ID="i-055b91c4baf230251"
AWS_PROFILE="lca-pix"
DEPLOY_DIR="$HOME/lca-ec2-deploy"
S3_BUCKET="lca-v3-uploads"

echo "📋 Step 1: Get EC2 Public IP"
echo "----------------------------"
EC2_IP=$(aws ec2 describe-instances \
  --instance-ids $EC2_INSTANCE_ID \
  --profile $AWS_PROFILE \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text)

if [ -z "$EC2_IP" ]; then
  echo "❌ Could not get EC2 IP. Is the instance running?"
  exit 1
fi

echo "✅ EC2 IP: $EC2_IP"
echo ""

echo "📦 Step 2: Build Next.js Application"
echo "-------------------------------------"
npm run build

if [ ! -d ".next" ]; then
  echo "❌ Build failed - .next directory not created"
  exit 1
fi

echo "✅ Build complete"
echo ""

echo "📁 Step 3: Create Deployment Package"
echo "-------------------------------------"
rm -rf $DEPLOY_DIR
mkdir -p $DEPLOY_DIR

# Copy necessary files
cp -r .next $DEPLOY_DIR/
cp -r public $DEPLOY_DIR/ 2>/dev/null || echo "No public directory"
cp -r app $DEPLOY_DIR/
cp -r lib $DEPLOY_DIR/
cp -r components $DEPLOY_DIR/ 2>/dev/null || echo "No components directory"
cp -r hooks $DEPLOY_DIR/ 2>/dev/null || echo "No hooks directory"
cp package.json $DEPLOY_DIR/
cp package-lock.json $DEPLOY_DIR/
cp next.config.mjs $DEPLOY_DIR/
cp tsconfig.json $DEPLOY_DIR/
cp tailwind.config.ts $DEPLOY_DIR/ 2>/dev/null || echo "No tailwind config"
cp postcss.config.mjs $DEPLOY_DIR/ 2>/dev/null || echo "No postcss config"
cp create-test-data.sql $DEPLOY_DIR/

# Create .env.production
cat > $DEPLOY_DIR/.env.production <<EOF
DATABASE_HOST=lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com
DATABASE_PORT=3306
DATABASE_NAME=lca_v3
DATABASE_USER=lcaadmin
DATABASE_PASSWORD=EP76017fLefZ8?d!ezTHsN[kA()X
JWT_SECRET=your-super-secret-jwt-key-change-in-production-xyz123
JWT_EXPIRES_IN=7d
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://$EC2_IP:3000
EOF

echo "✅ Deployment package created in $DEPLOY_DIR"
echo ""

echo "📦 Step 4: Create Tarball"
echo "-------------------------"
cd $DEPLOY_DIR
tar -czf lca-app.tar.gz .
cd -

echo "✅ Tarball created: $DEPLOY_DIR/lca-app.tar.gz"
echo ""

echo "☁️ Step 5: Upload to S3"
echo "------------------------"
aws s3 cp $DEPLOY_DIR/lca-app.tar.gz s3://$S3_BUCKET/ --profile $AWS_PROFILE

echo "✅ Uploaded to S3"
echo ""

echo "🎉 Deployment Package Ready!"
echo "============================"
echo ""
echo "📝 Next Steps:"
echo ""
echo "1. Connect to EC2 via Session Manager:"
echo "   Go to AWS Console → EC2 → Instances → $EC2_INSTANCE_ID → Connect → Session Manager"
echo ""
echo "2. Run these commands in EC2 terminal:"
echo ""
echo "   # Download from S3"
echo "   aws s3 cp s3://$S3_BUCKET/lca-app.tar.gz /home/ubuntu/"
echo ""
echo "   # Extract"
echo "   cd /home/ubuntu"
echo "   tar -xzf lca-app.tar.gz"
echo ""
echo "   # Install Node.js (if not already installed)"
echo "   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -"
echo "   sudo apt-get install -y nodejs"
echo ""
echo "   # Install PM2"
echo "   sudo npm install -g pm2"
echo ""
echo "   # Install dependencies"
echo "   npm install --production"
echo ""
echo "   # Start application"
echo "   pm2 start npm --name \"lca-app\" -- start"
echo ""
echo "   # View logs"
echo "   pm2 logs lca-app"
echo ""
echo "3. Access your app at: http://$EC2_IP:3000"
echo ""
echo "4. Create test data:"
echo "   mysql -h lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com \\"
echo "     -u lcaadmin \\"
echo "     -p'EP76017fLefZ8?d!ezTHsN[kA()X' \\"
echo "     lca_v3 < create-test-data.sql"
echo ""
echo "5. Test login: john@lcaproject.com / password123"
echo ""

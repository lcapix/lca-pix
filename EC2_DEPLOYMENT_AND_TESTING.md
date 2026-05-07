# Deploy to EC2 & Test Complete Flow

## Why Deploy to EC2?

✅ **EC2 can access RDS** (same VPC)  
✅ **Test real production environment**  
✅ **Access from anywhere via public IP**  
✅ **PM can test and validate**  
✅ **No local MySQL setup needed**  

---

## 🚀 Deployment Plan (2-3 hours)

### Phase 1: Build & Prepare (15 min)
### Phase 2: Deploy to EC2 (30 min)
### Phase 3: Create Test Data (5 min)
### Phase 4: Test Frontend & Backend (30 min)
### Phase 5: PM Validation (PM's time)

---

## Phase 1: Build & Prepare Locally

### Step 1.1: Build Next.js Application (5 min)

```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"

# Build for production
npm run build

# This creates .next/ folder with optimized production build
```

### Step 1.2: Create Deployment Package (5 min)

```bash
# Create deployment directory
mkdir -p ~/ec2-deploy

# Copy necessary files
cp -r .next ~/ec2-deploy/
cp -r public ~/ec2-deploy/
cp -r app ~/ec2-deploy/
cp -r lib ~/ec2-deploy/
cp -r components ~/ec2-deploy/
cp -r hooks ~/ec2-deploy/
cp package.json ~/ec2-deploy/
cp package-lock.json ~/ec2-deploy/
cp next.config.mjs ~/ec2-deploy/
cp tsconfig.json ~/ec2-deploy/
cp tailwind.config.ts ~/ec2-deploy/
cp postcss.config.mjs ~/ec2-deploy/
cp create-test-data.sql ~/ec2-deploy/

# Create .env.production file (with RDS credentials)
cat > ~/ec2-deploy/.env.production <<'EOF'
DATABASE_HOST=lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com
DATABASE_PORT=3306
DATABASE_NAME=lca_v3
DATABASE_USER=lcaadmin
DATABASE_PASSWORD=EP76017fLefZ8?d!ezTHsN[kA()X
JWT_SECRET=your-super-secret-jwt-key-change-in-production-xyz123
JWT_EXPIRES_IN=7d
NODE_ENV=production
NEXT_PUBLIC_API_URL=http://YOUR_EC2_PUBLIC_IP:3000
EOF

# Create tarball
cd ~/ec2-deploy
tar -czf lca-app.tar.gz *
```

### Step 1.3: Get EC2 Public IP (2 min)

```bash
# Get EC2 public IP
aws ec2 describe-instances \
  --instance-ids i-055b91c4baf230251 \
  --profile lca-pix \
  --query 'Reservations[0].Instances[0].PublicIpAddress' \
  --output text
```

**Save this IP** - you'll need it!

---

## Phase 2: Deploy to EC2

### Step 2.1: Upload Files to EC2 (10 min)

We'll use **Session Manager** to transfer files:

```bash
# Option A: Upload via S3 (Recommended)
# 1. Upload to S3
aws s3 cp ~/ec2-deploy/lca-app.tar.gz s3://your-bucket-name/ --profile lca-pix

# 2. In EC2 Session Manager, download from S3
# (Run this in EC2 terminal)
aws s3 cp s3://your-bucket-name/lca-app.tar.gz /home/ubuntu/
```

**Or if you have SSH key:**

```bash
# Option B: SCP (if you have SSH key)
scp -i your-key.pem ~/ec2-deploy/lca-app.tar.gz ubuntu@EC2_PUBLIC_IP:/home/ubuntu/
```

### Step 2.2: Set Up EC2 Environment (15 min)

**In EC2 Session Manager terminal**, run:

```bash
# Update system
sudo apt-get update

# Install Node.js 18+ (if not installed)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify Node version
node --version  # Should be 18+
npm --version

# Install PM2 (process manager)
sudo npm install -g pm2

# Extract application
cd /home/ubuntu
tar -xzf lca-app.tar.gz

# Install dependencies
npm install --production

# Make sure .env.production exists
ls -la .env.production

# Update the NEXT_PUBLIC_API_URL with actual EC2 IP
# Get EC2 public IP first:
EC2_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4)
echo "EC2 Public IP: $EC2_IP"

# Update .env.production
sed -i "s/YOUR_EC2_PUBLIC_IP/$EC2_IP/g" .env.production

# Show final config (verify)
cat .env.production
```

### Step 2.3: Start Application with PM2 (5 min)

```bash
# Start Next.js with PM2
cd /home/ubuntu
pm2 start npm --name "lca-app" -- start

# View logs
pm2 logs lca-app

# Check status
pm2 status

# Make PM2 restart on server reboot
pm2 startup
pm2 save
```

---

## Phase 3: Create Test Data in RDS (5 min)

**Still in EC2 Session Manager:**

```bash
# Create test data in RDS
mysql -h lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com \
  -u lcaadmin \
  -p'EP76017fLefZ8?d!ezTHsN[kA()X' \
  lca_v3 < create-test-data.sql

# Verify data was created
mysql -h lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com \
  -u lcaadmin \
  -p'EP76017fLefZ8?d!ezTHsN[kA()X' \
  lca_v3 -e "
SELECT 'SUMMARY:' AS '';
SELECT COUNT(*) as users FROM account;
SELECT COUNT(*) as projects FROM project;
SELECT COUNT(*) as components FROM component;
SELECT COUNT(*) as flows FROM flows;
SELECT COUNT(*) as assessments FROM assessment_runs;
"
```

Expected output:
```
users: 1
projects: 1
components: 5
flows: 4
assessments: 1
```

---

## Phase 4: Test Everything

### 4.1: Test Backend APIs (10 min)

Replace `YOUR_EC2_IP` with your actual EC2 public IP:

```bash
EC2_IP="YOUR_EC2_IP"  # e.g., 35.170.250.110

# Test 1: Health check
curl http://$EC2_IP:3000/

# Test 2: Signup new user
curl -X POST http://$EC2_IP:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'

# Test 3: Login with test data user
RESPONSE=$(curl -s -X POST http://$EC2_IP:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@lcaproject.com","password":"password123"}')

echo "$RESPONSE"

# Extract token (you'll need jq or do this manually)
TOKEN=$(echo "$RESPONSE" | grep -o '"token":"[^"]*' | cut -d'"' -f4)
echo "Token: $TOKEN"

# Test 4: Get projects (should see "Electric Vehicle Manufacturing")
curl -X GET http://$EC2_IP:3000/api/projects \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.'

# Test 5: Get substances
curl -X GET http://$EC2_IP:3000/api/substances \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.substances[] | {id, name, category}'

# Test 6: Get impact categories
curl -X GET http://$EC2_IP:3000/api/impact-categories \
  -H "Authorization: Bearer $TOKEN" \
  | jq '.categories[] | {id, name, unit}'
```

**Expected Results:**
- ✅ Signup: Returns new user + token
- ✅ Login: Returns token
- ✅ Projects: Shows "Electric Vehicle Manufacturing"
- ✅ Substances: Shows 13 substances
- ✅ Impact Categories: Shows 8 categories

### 4.2: Test Frontend in Browser (10 min)

Open your browser and navigate to:

```
http://YOUR_EC2_IP:3000
```

**Test Flow:**

1. **Homepage loads** ✅
2. **Login page** - Try logging in:
   - Email: `john@lcaproject.com`
   - Password: `password123`
3. **Dashboard** - Should show projects
4. **Project view** - Click "Electric Vehicle Manufacturing"
5. **Cases** - Should see 2 cases (Baseline + Renewable)
6. **Components** - Click Baseline case, should see hierarchy
7. **Flows** - Navigate to Oven Heating Task, should see 4 flows
8. **Assessment Results** - Should see calculated impacts

**What to Check:**
- [ ] Can you see the test project?
- [ ] Can you navigate the component hierarchy (5 levels)?
- [ ] Can you see the flows (Electricity, CO₂, Methane, Water)?
- [ ] Can you see assessment results with impact values?
- [ ] Do all pages load without errors?

### 4.3: Test Data Persistence (5 min)

**Create something new:**

1. Go to http://YOUR_EC2_IP:3000
2. Create a **new project** via the UI
3. Verify it appears in the list
4. Check database to confirm:

```bash
# In EC2 Session Manager
mysql -h lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com \
  -u lcaadmin \
  -p'EP76017fLefZ8?d!ezTHsN[kA()X' \
  lca_v3 -e "SELECT * FROM project;"
```

Your new project should be there! ✅

---

## Phase 5: PM Validation & Testing

### Share with Your PM:

**Send them this information:**

```
🌐 Application URL: http://YOUR_EC2_IP:3000

📧 Test Login Credentials:
   Email: john@lcaproject.com
   Password: password123

📊 Test Data Available:
   - Project: Electric Vehicle Manufacturing
   - Cases: Baseline Production + Renewable Energy
   - Complete 5-level component hierarchy
   - 4 flows with environmental data
   - 1 assessment with calculated impacts

🧪 Ask PM to Test:
   1. Login with test credentials
   2. Navigate through the project structure
   3. View component hierarchy (5 levels)
   4. Review flows and their quantities
   5. Check assessment results
   6. Validate impact calculations
   7. Try creating a new project/case
   8. Provide feedback on data structure
```

### PM Testing Checklist:

**For Your PM to Complete:**

- [ ] Can login successfully
- [ ] Can view Electric Vehicle Manufacturing project
- [ ] Can see both cases (Baseline + Renewable)
- [ ] Can navigate 5-level component hierarchy
- [ ] Component names make sense for EV manufacturing
- [ ] Flows show correct inputs/outputs
- [ ] Flow quantities seem realistic
- [ ] Assessment results are calculated
- [ ] Impact values are reasonable (195.25 kg CO₂ eq for GWP)
- [ ] Can create new project successfully
- [ ] All data persists after page refresh
- [ ] No errors in browser console

---

## Monitoring & Troubleshooting

### View Application Logs

```bash
# In EC2 Session Manager
pm2 logs lca-app

# Or view last 50 lines
pm2 logs lca-app --lines 50

# View errors only
pm2 logs lca-app --err
```

### Restart Application

```bash
pm2 restart lca-app
```

### Check Application Status

```bash
pm2 status
pm2 monit  # Real-time monitoring
```

### Common Issues

**Port 3000 not accessible?**
```bash
# Check security group allows port 3000
aws ec2 describe-security-groups \
  --group-ids sg-054e4fe65b9baf76a \
  --profile lca-pix \
  --query 'SecurityGroups[0].IpPermissions'

# Add rule if needed:
aws ec2 authorize-security-group-ingress \
  --group-id sg-054e4fe65b9baf76a \
  --protocol tcp \
  --port 3000 \
  --cidr 0.0.0.0/0 \
  --profile lca-pix
```

**Application not starting?**
```bash
# Check Node version
node --version  # Should be 18+

# Check logs
pm2 logs lca-app --lines 100

# Try running manually to see errors
cd /home/ubuntu
npm start
```

**Database connection issues?**
```bash
# Test MySQL connection from EC2
mysql -h lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com \
  -u lcaadmin \
  -p'EP76017fLefZ8?d!ezTHsN[kA()X' \
  -e "SELECT 1;"
```

---

## Success Criteria ✅

Your deployment is successful when:

1. ✅ Application accessible at http://EC2_IP:3000
2. ✅ Can login with test credentials
3. ✅ Can see test project with full hierarchy
4. ✅ Can view flows and assessment results
5. ✅ Can create new projects/cases
6. ✅ All data persists in RDS database
7. ✅ PM can access and validate
8. ✅ No console errors in browser
9. ✅ API endpoints responding correctly
10. ✅ Frontend and backend fully integrated

---

## After Successful Testing

### Next Steps:

1. **Get PM Approval** on data structure
2. **Purchase Ecoinvent API** access
3. **Integrate Ecoinvent** data
4. **Set up proper domain** (optional)
5. **Configure SSL/HTTPS** (optional)
6. **Add more test cases** based on PM feedback
7. **Begin real projects!**

---

## Cost Tracking

**Running on EC2:**
- EC2 t3.small: ~$0.021/hour = ~$15/month
- RDS db.t3.small: ~$0.034/hour = ~$25/month
- **Total: ~$40/month** (very affordable!)

**Can stop EC2 when not testing to save costs:**
```bash
aws ec2 stop-instances \
  --instance-ids i-055b91c4baf230251 \
  --profile lca-pix
```

---

## Documentation for PM

Create this summary for your PM:

**Subject: LCA App Ready for Testing on EC2**

Hi [PM Name],

The LCA application is now deployed and ready for testing!

**Access:**
- URL: http://[EC2_IP]:3000
- Login: john@lcaproject.com / password123

**What to Test:**
1. Navigate through "Electric Vehicle Manufacturing" project
2. Review 5-level component hierarchy
3. Check flows (Electricity, CO₂, Methane, Water)
4. Validate assessment results (195.25 kg CO₂ eq GWP)
5. Try creating a new project

**Validation Checklist:**
- Data structure matches LCA methodology
- Flow quantities are realistic
- Impact calculations are correct
- All 8 impact categories calculated
- Can collaborate on projects

Please provide feedback on:
1. Data accuracy
2. Missing features
3. UI/UX improvements needed
4. Ready to integrate Ecoinvent?

Thanks!

---

*Follow this guide step-by-step and you'll have a fully working, testable deployment!* 🚀

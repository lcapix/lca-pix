# 🚀 Deploy to EC2 - Quick Checklist

## ⏱️ Time: 2-3 hours total

---

## ☑️ Pre-Deployment (15 min)

### On Your Local Machine:

- [ ] **Build app**: `npm run build`
- [ ] **Create tarball** with .next, app, lib, package.json, .env.production
- [ ] **Get EC2 IP**: 
  ```bash
  aws ec2 describe-instances --instance-ids i-055b91c4baf230251 --profile lca-pix --query 'Reservations[0].Instances[0].PublicIpAddress' --output text
  ```
- [ ] **Save EC2 IP**: ___________________

---

## ☑️ Deployment (45 min)

### In EC2 Session Manager Terminal:

- [ ] **Upload files** (via S3 or direct copy)
- [ ] **Install Node.js 18+**: 
  ```bash
  curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
  sudo apt-get install -y nodejs
  ```
- [ ] **Install PM2**: `sudo npm install -g pm2`
- [ ] **Extract files**: `tar -xzf lca-app.tar.gz`
- [ ] **Install deps**: `npm install --production`
- [ ] **Update .env.production** with EC2 IP
- [ ] **Start app**: `pm2 start npm --name "lca-app" -- start`
- [ ] **Check status**: `pm2 status`
- [ ] **View logs**: `pm2 logs lca-app`

---

## ☑️ Create Test Data (5 min)

### In EC2 Session Manager:

- [ ] **Run SQL script**:
  ```bash
  mysql -h lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com -u lcaadmin -p'EP76017fLefZ8?d!ezTHsN[kA()X' lca_v3 < create-test-data.sql
  ```
- [ ] **Verify**: `mysql ... -e "SELECT COUNT(*) FROM account; SELECT COUNT(*) FROM project;"`
- [ ] **Expected**: 1 user, 1 project, 5 components, 4 flows

---

## ☑️ Test Backend APIs (15 min)

### From Your Local Machine Terminal:

Replace `EC2_IP` with your actual IP:

- [ ] **Test homepage**: `curl http://EC2_IP:3000/`
- [ ] **Test signup**: 
  ```bash
  curl -X POST http://EC2_IP:3000/api/auth/signup -H "Content-Type: application/json" -d '{"username":"testuser","email":"test@example.com","password":"password123"}'
  ```
- [ ] **Test login**:
  ```bash
  curl -X POST http://EC2_IP:3000/api/auth/login -H "Content-Type: application/json" -d '{"email":"john@lcaproject.com","password":"password123"}'
  ```
- [ ] **Save token from login**: ___________________
- [ ] **Test get projects**:
  ```bash
  curl -X GET http://EC2_IP:3000/api/projects -H "Authorization: Bearer YOUR_TOKEN"
  ```
- [ ] **Verify**: Should see "Electric Vehicle Manufacturing" project

---

## ☑️ Test Frontend (15 min)

### In Your Browser:

- [ ] **Open**: `http://EC2_IP:3000`
- [ ] **Homepage loads** (no errors)
- [ ] **Login works**: john@lcaproject.com / password123
- [ ] **Can see project**: Electric Vehicle Manufacturing
- [ ] **Can see cases**: Baseline Production + Renewable Energy
- [ ] **Can see components**: 5-level hierarchy
- [ ] **Can see flows**: Electricity, CO₂, Methane, Water
- [ ] **Can see assessment**: Q1 2025 Baseline Assessment
- [ ] **Can see impacts**: 195.25 kg CO₂ eq (Global Warming)
- [ ] **No console errors**: Open browser DevTools > Console

---

## ☑️ Test Data Persistence (10 min)

### In Browser:

- [ ] **Create new project** via UI
- [ ] **Give it a name**: ___________________
- [ ] **Verify it appears** in project list
- [ ] **Refresh page** - still there?

### In EC2 Terminal:

- [ ] **Check database**:
  ```bash
  mysql -h lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com -u lcaadmin -p'EP76017fLefZ8?d!ezTHsN[kA()X' lca_v3 -e "SELECT * FROM project;"
  ```
- [ ] **Your new project is in database** ✅

---

## ☑️ Share with PM

### Send PM This Email:

```
Subject: LCA App Ready for Testing

Hi [PM Name],

The LCA application is deployed and ready for validation!

🌐 URL: http://[YOUR_EC2_IP]:3000

🔐 Login:
   Email: john@lcaproject.com
   Password: password123

📊 Test Data:
   - 1 Project: Electric Vehicle Manufacturing
   - 2 Cases: Baseline + Renewable Energy
   - 5-level hierarchy: Product → Machine → Subprocess → Operation → Elemental Task
   - 4 Flows: Electricity (250.5 kWh), CO₂ (125.25 kg), Methane (2.5 kg), Water (15 m³)
   - 1 Assessment: Calculated environmental impacts
   - Result: 195.25 kg CO₂ eq Global Warming Potential

✅ Please validate:
   1. Data structure matches LCA methodology
   2. Flow quantities are realistic
   3. Impact calculations are correct
   4. Component hierarchy makes sense
   5. Ready for Ecoinvent integration

Please test and provide feedback!
```

- [ ] **Email sent to PM**: ___________________
- [ ] **PM testing date**: ___________________

---

## ☑️ Success Criteria

Check all before considering deployment successful:

- [ ] App accessible at http://EC2_IP:3000
- [ ] Login works with test credentials
- [ ] Test project visible with full data
- [ ] Can navigate complete hierarchy
- [ ] Flows display correctly
- [ ] Assessment results show impacts
- [ ] Can create new projects
- [ ] Data persists in RDS
- [ ] No errors in browser console
- [ ] No errors in PM2 logs
- [ ] PM can access and test

---

## 🆘 Troubleshooting

### App won't start?
```bash
pm2 logs lca-app --lines 50
node --version  # Must be 18+
```

### Can't access on port 3000?
```bash
# Add security group rule:
aws ec2 authorize-security-group-ingress --group-id sg-054e4fe65b9baf76a --protocol tcp --port 3000 --cidr 0.0.0.0/0 --profile lca-pix
```

### Database connection fails?
```bash
# Test from EC2:
mysql -h lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com -u lcaadmin -p'EP76017fLefZ8?d!ezTHsN[kA()X' -e "SELECT 1;"
```

### Frontend shows Zustand data?
- Frontend still using localStorage (Zustand)
- APIs work but frontend needs integration
- This is OK for now - backend is fully functional
- Frontend integration is next phase

---

## 📋 After PM Approval

- [ ] PM approved data structure
- [ ] PM approved flow values
- [ ] PM approved impact calculations
- [ ] Ready to purchase Ecoinvent API
- [ ] Begin real LCA projects!

---

## 💰 Cost Management

**To save money when not testing:**
```bash
# Stop EC2 (app will be down)
aws ec2 stop-instances --instance-ids i-055b91c4baf230251 --profile lca-pix

# Start when needed
aws ec2 start-instances --instance-ids i-055b91c4baf230251 --profile lca-pix
```

**Monthly costs when running:**
- EC2: ~$15/month
- RDS: ~$25/month
- Total: ~$40/month

---

## 📚 Full Details

See **[EC2_DEPLOYMENT_AND_TESTING.md](./EC2_DEPLOYMENT_AND_TESTING.md)** for:
- Complete step-by-step instructions
- Detailed troubleshooting
- Monitoring commands
- PM validation guide

---

*Check off each box as you complete it!* ✅

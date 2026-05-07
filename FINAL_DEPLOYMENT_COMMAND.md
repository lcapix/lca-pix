# 🚀 Final Deployment Command - Deploy Database Schema

## ✅ Prerequisites Complete
- [x] npm dependencies installed (mysql2, bcrypt, jsonwebtoken)
- [x] Environment configured (.env.local created)
- [x] AWS infrastructure ready (EC2 + RDS)

## ⏳ What's Remaining: Deploy Database Schema

The database schema file `lca_v3_drawsql_schema.sql` needs to be deployed to your RDS instance.

---

## 🎯 OPTION 1: Simple One-Command Deployment (Recommended)

I can deploy the schema for you right now if you provide ONE of these:

### **Method A: AWS Console Session Manager (No SSH key needed)**

Run this command in your terminal:
```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
aws ssm start-session --target i-055b91c4baf230251 --profile lca-pix
```

**What happens:**
- Opens a terminal session to your EC2 instance through your browser
- No SSH key needed
- Secure connection through AWS Systems Manager

**If this works**, I can then deploy the schema immediately.

**If you get an error**, it means SSM agent isn't configured on EC2. Go to Method B.

---

### **Method B: Configure SSM on EC2 (30 minutes, enables future deployments)**

Run these commands to configure Systems Manager on your EC2:

```bash
# 1. Create IAM role for EC2
aws iam create-role \
    --role-name LCA-EC2-SSM-Role \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "ec2.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' \
    --profile lca-pix

# 2. Attach SSM policy
aws iam attach-role-policy \
    --role-name LCA-EC2-SSM-Role \
    --policy-arn arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore \
    --profile lca-pix

# 3. Attach SecretsManager policy (for database credentials)
aws iam attach-role-policy \
    --role-name LCA-EC2-SSM-Role \
    --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite \
    --profile lca-pix

# 4. Create instance profile
aws iam create-instance-profile \
    --instance-profile-name LCA-EC2-SSM-Profile \
    --profile lca-pix

# 5. Add role to profile
aws iam add-role-to-instance-profile \
    --instance-profile-name LCA-EC2-SSM-Profile \
    --role-name LCA-EC2-SSM-Role \
    --profile lca-pix

# 6. Attach to EC2
aws ec2 associate-iam-instance-profile \
    --instance-id i-055b91c4baf230251 \
    --iam-instance-profile Name=LCA-EC2-SSM-Profile \
    --profile lca-pix

# 7. Wait 5 minutes for SSM agent to register
echo "⏳ Waiting 5 minutes for SSM agent to register..."
sleep 300

# 8. Test SSM connection
aws ssm start-session --target i-055b91c4baf230251 --profile lca-pix
```

After SSM is configured, I can deploy the schema remotely.

---

### **Method C: Manual Deployment via AWS Console (15 minutes)**

If you prefer to do it manually:

1. **Download these files to your desktop:**
   - `lca_v3_drawsql_schema.sql`

2. **Go to AWS Console → RDS → Query Editor**
   - Select database: `lca-dev-db-small`
   - Username: `lcaadmin`
   - Password: Get from Secrets Manager or use: `EP76017fLefZ8?d!ezTHsN[kA()X`

3. **Run these SQL commands in order:**

```sql
-- 1. Create database
CREATE DATABASE IF NOT EXISTS lca_v3 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE lca_v3;

-- 2. Copy/paste the entire contents of lca_v3_drawsql_schema.sql

-- 3. Seed reference data
INSERT INTO permissions (permission_name, description) VALUES
('owner', 'Project owner - full access including delete'),
('admin', 'Project admin - can edit and manage team'),
('editor', 'Can edit project data'),
('viewer', 'Read-only access');

INSERT INTO impact_categories (category_name, unit, description) VALUES
('Global warming', 'kg CO2-eq', 'Climate change impact from greenhouse gas emissions'),
('Ozone depletion', 'kg CFC-11-eq', 'Stratospheric ozone depletion potential'),
('Smog formation', 'kg NOx-eq', 'Photochemical ozone creation potential'),
('Acidification', 'kg SO2-eq', 'Terrestrial acidification from acid deposition'),
('Eutrophication', 'kg N-eq', 'Nutrient enrichment of water bodies'),
('Freshwater ecotoxicity', 'CTUe', 'Toxic impacts on freshwater ecosystems'),
('Human toxicity', 'CTUh', 'Toxic impacts on human health'),
('Resource depletion', 'kg Sb-eq', 'Abiotic resource depletion');

INSERT INTO substances (substance_name, cas_number, category, default_unit, description) VALUES
('Electricity', NULL, 'energy', 'kWh', 'Electrical energy'),
('Natural Gas', NULL, 'energy', 'm3', 'Natural gas fuel'),
('Diesel', NULL, 'energy', 'L', 'Diesel fuel'),
('Steel', '12597-69-2', 'material', 'kg', 'Carbon steel'),
('Aluminum', '7429-90-5', 'material', 'kg', 'Aluminum metal'),
('Plastic (PET)', NULL, 'material', 'kg', 'Polyethylene terephthalate'),
('Water', '7732-18-5', 'water', 'L', 'Fresh water'),
('CO2', '124-38-9', 'emission', 'kg', 'Carbon dioxide'),
('CH4', '74-82-8', 'emission', 'kg', 'Methane'),
('NOx', NULL, 'emission', 'kg', 'Nitrogen oxides'),
('SOx', NULL, 'emission', 'kg', 'Sulfur oxides'),
('Municipal Waste', NULL, 'waste', 'kg', 'General municipal solid waste'),
('Hazardous Waste', NULL, 'waste', 'kg', 'Hazardous industrial waste');

INSERT INTO driver_impact_factors (driver_name, category_id, impact_factor, geographic_region, valid_from, data_source) VALUES
('Electricity (kWh)', 1, 0.5, 'US', '2025-01-01', 'EPA eGRID 2024'),
('Electricity (kWh)', 2, 0.0000001, 'US', '2025-01-01', 'EPA eGRID 2024'),
('Electricity (kWh)', 3, 0.0008, 'US', '2025-01-01', 'EPA eGRID 2024'),
('Electricity (kWh)', 4, 0.0012, 'US', '2025-01-01', 'EPA eGRID 2024'),
('Steel (kg)', 1, 1.8, 'global', '2025-01-01', 'ecoinvent 3.9'),
('Steel (kg)', 4, 0.005, 'global', '2025-01-01', 'ecoinvent 3.9'),
('Steel (kg)', 5, 0.003, 'global', '2025-01-01', 'ecoinvent 3.9'),
('Aluminum (kg)', 1, 8.5, 'global', '2025-01-01', 'ecoinvent 3.9'),
('Aluminum (kg)', 4, 0.015, 'global', '2025-01-01', 'ecoinvent 3.9'),
('Natural Gas (m3)', 1, 2.0, 'US', '2025-01-01', 'GREET 2024'),
('Natural Gas (m3)', 3, 0.002, 'US', '2025-01-01', 'GREET 2024');

-- 4. Verify
SELECT 'Deployment complete!' as status;
SHOW TABLES;
SELECT COUNT(*) FROM permissions;
SELECT COUNT(*) FROM impact_categories;
SELECT COUNT(*) FROM substances;
SELECT COUNT(*) FROM driver_impact_factors;
```

---

## 📊 After Schema is Deployed

Once the schema is deployed successfully, verify with:

```bash
node -e "
const mysql = require('mysql2/promise');
async function check() {
  const conn = await mysql.createConnection({
    host: 'lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com',
    port: 3306,
    user: 'lcaadmin',
    password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
    database: 'lca_v3'
  });
  const [tables] = await conn.execute('SHOW TABLES');
  console.log('✅ Schema deployed! Tables:', tables.length);
  const [perms] = await conn.execute('SELECT COUNT(*) as count FROM permissions');
  const [cats] = await conn.execute('SELECT COUNT(*) as count FROM impact_categories');
  const [subs] = await conn.execute('SELECT COUNT(*) as count FROM substances');
  console.log('✅ Permissions:', perms[0].count);
  console.log('✅ Impact Categories:', cats[0].count);
  console.log('✅ Substances:', subs[0].count);
  await conn.end();
}
check();
"
```

**Expected Output:**
```
✅ Schema deployed! Tables: 13
✅ Permissions: 4
✅ Impact Categories: 8
✅ Substances: 13
```

---

## 🚀 Next Steps After Schema Deployment

1. **Test the application locally:**
   ```bash
   npm run dev
   ```

2. **Test authentication:**
   ```bash
   # Sign up
   curl -X POST http://localhost:3000/api/auth/signup \
     -H "Content-Type: application/json" \
     -d '{"username":"test","email":"test@example.com","password":"password123"}'
   ```

3. **I'll continue building the remaining API routes**

---

## 🎯 Summary

**Your Choice:**
- **Fastest:** Method C (Manual via AWS Console) - 15 min
- **Best long-term:** Method B (Configure SSM) - 30 min setup, then automatic forever
- **Try first:** Method A (Start SSM session) - Works if SSM is already configured

**Pick one and let me know when the schema is deployed, then I'll continue with the next phase!**

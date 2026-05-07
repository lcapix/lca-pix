# Run LCA Project Locally with Test Data

## Problem
RDS database is in private VPC - your local machine cannot connect to it.

## Solution
Use local MySQL database for development.

---

## Step 1: Install MySQL Locally (5 min)

```bash
# Install MySQL
brew install mysql

# Start MySQL service
brew services start mysql

# Verify it's running
mysql --version
```

---

## Step 2: Create Local Database (2 min)

```bash
# Connect to MySQL (no password for root by default)
mysql -u root

# In MySQL prompt, create database:
CREATE DATABASE lca_v3 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
EXIT;
```

Or one-liner:
```bash
mysql -u root -e "CREATE DATABASE lca_v3 CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

---

## Step 3: Deploy Schema to Local MySQL (1 min)

```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"

# Deploy the complete schema
mysql -u root lca_v3 < lca_v3_drawsql_schema.sql

# Verify tables were created
mysql -u root lca_v3 -e "SHOW TABLES;"
```

You should see all 13 tables listed!

---

## Step 4: Update .env.local (1 min)

Edit your `.env.local` file to use local MySQL:

```env
DATABASE_HOST=localhost
DATABASE_PORT=3306
DATABASE_NAME=lca_v3
DATABASE_USER=root
DATABASE_PASSWORD=

JWT_SECRET=change-this-to-a-random-secret-key-in-production
JWT_EXPIRES_IN=7d
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3000
```

**Note**: Empty password for local root user (default)

---

## Step 5: Create Test Data (2 min)

Run the test data script:

```bash
mysql -u root lca_v3 <<'EOSQL'
-- Create test user
INSERT INTO account (username, email, password_hash, account_type) VALUES
('john_doe', 'john@lcaproject.com', '$2b$10$abcdefghijklmnopqrstuvwxyz0123456789ABCDEFGHIJKLMNO', 'user');
SET @user_id = LAST_INSERT_ID();

-- Create project
INSERT INTO project (project_name, description, owner_id) VALUES
('Electric Vehicle Manufacturing', 'Life cycle assessment of EV battery production facility', @user_id);
SET @project_id = LAST_INSERT_ID();

-- Add owner permission
INSERT INTO project_members (project_id, user_id, permission_id) 
SELECT @project_id, @user_id, permission_id FROM permissions WHERE permission_name = 'owner';

-- Create base case
INSERT INTO case_table (project_id, case_name, case_type, description) VALUES
(@project_id, 'Baseline Production - 2025', 'base', 'Current state with coal-based grid electricity');
SET @case_id = LAST_INSERT_ID();

-- Create 5-level component hierarchy
INSERT INTO component (case_id, component_name, component_type, hierarchy_level, quantity, unit) VALUES
(@case_id, 'EV Battery Pack (60 kWh)', 'product', 1, 1.0, 'unit');
SET @comp1 = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit) VALUES
(@case_id, @comp1, 'Cell Assembly Line', 'machine_line', 2, 1.0, 'line');
SET @comp2 = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit) VALUES
(@case_id, @comp2, 'Electrode Coating Process', 'subprocess', 3, 1.0, 'batch');
SET @comp3 = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit) VALUES
(@case_id, @comp3, 'Drying Operation', 'operation', 4, 1.0, 'cycle');
SET @comp4 = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit) VALUES
(@case_id, @comp4, 'Oven Heating Task', 'elemental_task', 5, 1.0, 'task');
SET @comp5 = LAST_INSERT_ID();

-- Add flows
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
(@comp5, 7, 'input', 250.5, 'kWh', TRUE, 'Electric energy consumption'),
(@comp5, 1, 'output', 125.25, 'kg', TRUE, 'CO2 emissions'),
(@comp5, 2, 'output', 2.5, 'kg', TRUE, 'Methane emissions'),
(@comp5, 8, 'input', 15.0, 'm3', FALSE, NULL);

-- Run assessment
INSERT INTO assessment_runs (case_id, run_name, calculation_method, status, executed_by) VALUES
(@case_id, 'Q1 2025 Baseline Assessment', 'CML 2001', 'running', @user_id);
SET @run_id = LAST_INSERT_ID();

-- Calculate results
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit)
SELECT @run_id, f.component_id, dif.category_id, f.quantity * dif.factor_value, ic.unit
FROM flows f
JOIN driver_impact_factors dif ON f.substance_id = dif.substance_id
JOIN impact_categories ic ON dif.category_id = ic.category_id
WHERE f.component_id = @comp5 AND f.is_driver = TRUE;

-- Mark as completed
UPDATE assessment_runs SET status = 'completed' WHERE run_id = @run_id;

-- Create comparative case
INSERT INTO case_table (project_id, case_name, case_type, parent_case_id, description) VALUES
(@project_id, 'Renewable Energy Scenario', 'comparative', @case_id, 'With 100% renewable electricity');

-- Show summary
SELECT '========== SUCCESS! ==========' AS result;
SELECT CONCAT('User: john@lcaproject.com (ID: ', @user_id, ')') AS info;
SELECT CONCAT('Project: Electric Vehicle Manufacturing (ID: ', @project_id, ')') AS info;
SELECT CONCAT('Base Case (ID: ', @case_id, ')') AS info;
SELECT CONCAT('5 components, 4 flows, 1 assessment (ID: ', @run_id, ')') AS info;
SELECT '=============================' AS result;
EOSQL
```

---

## Step 6: Start Development Server (1 min)

```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
npm run dev
```

Server will start on: http://localhost:3000

---

## Step 7: Test the APIs (2 min)

### Test 1: Signup
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"password123"}'
```

### Test 2: Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"john@lcaproject.com","password":"password123"}'
```

### Test 3: Get Projects (need token from login)
```bash
TOKEN="your-token-from-login"
curl -X GET http://localhost:3000/api/projects \
  -H "Authorization: Bearer $TOKEN"
```

### Test 4: View Data in Database
```bash
# See all test data
mysql -u root lca_v3 -e "
SELECT 'USERS:' AS ''; SELECT id, username, email FROM account;
SELECT 'PROJECTS:' AS ''; SELECT project_id, project_name FROM project;
SELECT 'COMPONENTS:' AS ''; SELECT component_id, component_name, hierarchy_level FROM component ORDER BY hierarchy_level;
SELECT 'FLOWS:' AS ''; SELECT f.flow_id, s.substance_name, f.flow_type, f.quantity FROM flows f LEFT JOIN substances s ON f.substance_id = s.substance_id;
SELECT 'IMPACTS:' AS ''; SELECT ic.category_name, ROUND(ar.impact_value, 2) as impact, ar.unit FROM assessment_results ar LEFT JOIN impact_categories ic ON ar.category_id = ic.category_id;
"
```

---

## ✅ You're Done!

Your local setup now has:
- ✅ MySQL database running locally
- ✅ Complete schema with 13 tables
- ✅ Reference data (36 records)
- ✅ Test data (user, project, cases, components, flows, assessment)
- ✅ Working APIs that connect to local database
- ✅ Development server running

---

## Verify Everything Works

```bash
# Check database has data
mysql -u root lca_v3 -e "
SELECT 
  (SELECT COUNT(*) FROM account) as users,
  (SELECT COUNT(*) FROM project) as projects,
  (SELECT COUNT(*) FROM case_table) as cases,
  (SELECT COUNT(*) FROM component) as components,
  (SELECT COUNT(*) FROM flows) as flows,
  (SELECT COUNT(*) FROM assessment_runs) as assessments,
  (SELECT COUNT(*) FROM assessment_results) as results;
"
```

Expected output:
```
+-------+----------+-------+------------+-------+-------------+---------+
| users | projects | cases | components | flows | assessments | results |
+-------+----------+-------+------------+-------+-------------+---------+
|     1 |        1 |     2 |          5 |     4 |           1 |      ~8 |
+-------+----------+-------+------------+-------+-------------+---------+
```

---

## Troubleshooting

### MySQL not installing?
```bash
# If homebrew issues:
brew update
brew doctor
brew install mysql
```

### Can't connect to MySQL?
```bash
# Check if running:
brew services list

# Restart if needed:
brew services restart mysql
```

### Tables not created?
```bash
# Check for errors:
mysql -u root lca_v3 < lca_v3_drawsql_schema.sql

# View any error messages
```

### API still timing out?
```bash
# Verify .env.local has:
cat .env.local | grep DATABASE_HOST
# Should show: DATABASE_HOST=localhost
```

---

## Next Steps

1. ✅ Frontend is still using Zustand (localStorage)
2. ✅ Need to replace Zustand with API calls
3. ✅ Test complete user flow in browser
4. ✅ Deploy to EC2 when ready for production

For now, you can:
- Test all APIs work with curl
- View data directly in MySQL
- Develop frontend against local database
- Later switch .env.local back to RDS when deploying to EC2

---

*Local development is now fully functional!* 🎉

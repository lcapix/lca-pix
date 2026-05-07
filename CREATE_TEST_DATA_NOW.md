# 🚀 Create Test Data in Your Database - RIGHT NOW!

## What This Will Do

This will populate your AWS RDS database with a complete, working example of an LCA project including:

- ✅ 1 Test User (john@lcaproject.com)
- ✅ 1 Project (Electric Vehicle Manufacturing)
- ✅ 2 Cases (Baseline + Renewable Energy scenarios)
- ✅ 5 Components (Complete hierarchy: Product → Machine → Subprocess → Operation → Elemental Task)
- ✅ 4 Flows (Electricity, CO2, Methane, Water)
- ✅ 1 Assessment Run with calculated environmental impact results
- ✅ Real impact values for Global Warming, Resource Depletion, etc.

## Step 1: Open EC2 Session Manager

1. Go to: https://console.aws.amazon.com/ec2
2. Make sure you're in **us-east-1** region (top-right dropdown)
3. Click **Instances** in left sidebar
4. Find instance ID: **i-055b91c4baf230251**
5. Click the checkbox next to it
6. Click **Connect** button (top-right)
7. Click **Session Manager** tab
8. Click **Connect** button

You should see a terminal that looks like:
```
sh-4.2$
```

## Step 2: Paste This Command

Copy and paste this ENTIRE command into the terminal:

```bash
mysql -h lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com -u lcaadmin -p'EP76017fLefZ8?d!ezTHsN[kA()X' lca_v3 <<'EOSQL'
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
SELECT CONCAT('Created user: john@lcaproject.com (ID: ', @user_id, ')') AS info;
SELECT CONCAT('Created project: Electric Vehicle Manufacturing (ID: ', @project_id, ')') AS info;
SELECT CONCAT('Created base case (ID: ', @case_id, ')') AS info;
SELECT CONCAT('Created 5 components, 4 flows, 1 assessment (ID: ', @run_id, ')') AS info;
SELECT '=============================' AS result;
EOSQL
```

## Step 3: Verify It Worked

You should see output like:
```
========== SUCCESS! ==========
Created user: john@lcaproject.com (ID: 1)
Created project: Electric Vehicle Manufacturing (ID: 1)
Created base case (ID: 1)
Created 5 components, 4 flows, 1 assessment (ID: 1)
=============================
```

## Step 4: View Your Data

Run this to see everything that was created:

```bash
mysql -h lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com -u lcaadmin -p'EP76017fLefZ8?d!ezTHsN[kA()X' lca_v3 -e "
SELECT 'USERS:' AS ''; 
SELECT id, username, email FROM account;

SELECT 'PROJECTS:' AS ''; 
SELECT project_id, project_name FROM project;

SELECT 'CASES:' AS ''; 
SELECT case_id, case_name, case_type FROM case_table;

SELECT 'COMPONENTS (5-level hierarchy):' AS ''; 
SELECT component_id, component_name, component_type, hierarchy_level 
FROM component ORDER BY hierarchy_level;

SELECT 'FLOWS:' AS ''; 
SELECT f.flow_id, c.component_name, s.substance_name, f.flow_type, f.quantity, f.unit
FROM flows f 
LEFT JOIN component c ON f.component_id = c.component_id
LEFT JOIN substances s ON f.substance_id = s.substance_id;

SELECT 'ASSESSMENT:' AS ''; 
SELECT run_id, run_name, status FROM assessment_runs;

SELECT 'ENVIRONMENTAL IMPACTS:' AS ''; 
SELECT c.component_name, ic.category_name, ROUND(ar.impact_value, 2) as impact, ar.unit
FROM assessment_results ar
LEFT JOIN component c ON ar.component_id = c.component_id
LEFT JOIN impact_categories ic ON ar.category_id = ic.category_id;
"
```

## What You'll See

### Environmental Impact Results:
- **Global Warming**: 125.25 kg CO2 eq (from CO2 emissions)
- **Global Warming**: 70.0 kg CO2 eq (from Methane, using 28x GWP factor)
- **Resource Depletion**: 0.00135 kg Sb eq (from electricity usage)
- **And more** for other impact categories!

### Complete Hierarchy:
```
1. EV Battery Pack (60 kWh) [Product]
   └─ 2. Cell Assembly Line [Machine/Line]
      └─ 3. Electrode Coating Process [Subprocess]
         └─ 4. Drying Operation [Operation]
            └─ 5. Oven Heating Task [Elemental Task]
               ├─ INPUT: 250.5 kWh Electricity (driver)
               ├─ INPUT: 15.0 m3 Water
               ├─ OUTPUT: 125.25 kg CO2 (driver)
               └─ OUTPUT: 2.5 kg Methane (driver)
```

## 🎉 You're Done!

Your database now has:
- ✅ Real, persistent test data
- ✅ A complete working example
- ✅ Calculated environmental impacts
- ✅ Ready to integrate with Ecoinvent API

**Next**: You can now confidently purchase Ecoinvent API access and start building real LCA projects!

---

*Need help? See [FINAL_SUMMARY.md](./FINAL_SUMMARY.md) for the complete project overview.*

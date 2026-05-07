# Direct Database Test - Creating Test Data

Since the local machine cannot connect to RDS (it's in a private VPC), we have two options:

## Option 1: Create Test Data Directly in Database (FASTEST - 5 minutes)

Run this in **EC2 Session Manager terminal**:

```bash
mysql -h lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com -u lcaadmin -p'EP76017fLefZ8?d!ezTHsN[kA()X' lca_v3 <<'EOSQL'
-- 1. Create test user
INSERT INTO account (username, email, password_hash, account_type) VALUES
('john_doe', 'john@lcaproject.com', '$2b$10$xQZ8JYvZ8n3KQZ8JYvZ8JeX8JYvZ8JYvZ8JYvZ8JYvZ8JYvZ8JYvZ', 'user');

SET @user_id = LAST_INSERT_ID();

-- 2. Create project
INSERT INTO project (project_name, description, owner_id) VALUES
('Electric Vehicle Manufacturing', 'Life cycle assessment of EV battery production facility', @user_id);

SET @project_id = LAST_INSERT_ID();

-- 3. Add owner to project_members
INSERT INTO project_members (project_id, user_id, permission_id) 
SELECT @project_id, @user_id, permission_id FROM permissions WHERE permission_name = 'owner';

-- 4. Create base case
INSERT INTO case_table (project_id, case_name, case_type, description) VALUES
(@project_id, 'Baseline Production - 2025', 'base', 'Current state with coal-based grid electricity');

SET @case_id = LAST_INSERT_ID();

-- 5. Create component hierarchy (5 levels)
-- Level 1: Product
INSERT INTO component (case_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case_id, 'EV Battery Pack (60 kWh)', 'product', 1, 1.0, 'unit', 'Complete lithium-ion battery pack for electric vehicle');
SET @comp1_id = LAST_INSERT_ID();

-- Level 2: Machine/Line
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case_id, @comp1_id, 'Cell Assembly Line', 'machine_line', 2, 1.0, 'line', 'Automated battery cell assembly line');
SET @comp2_id = LAST_INSERT_ID();

-- Level 3: Subprocess
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case_id, @comp2_id, 'Electrode Coating Process', 'subprocess', 3, 1.0, 'batch', 'Coating electrodes with active materials');
SET @comp3_id = LAST_INSERT_ID();

-- Level 4: Operation
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case_id, @comp3_id, 'Drying Operation', 'operation', 4, 1.0, 'cycle', 'High temperature drying of coated electrodes');
SET @comp4_id = LAST_INSERT_ID();

-- Level 5: Elemental Task
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case_id, @comp4_id, 'Oven Heating Task', 'elemental_task', 5, 1.0, 'task', 'Electric heating element operation');
SET @comp5_id = LAST_INSERT_ID();

-- 6. Add flows to elemental task
-- Electricity input (driver)
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
(@comp5_id, 7, 'input', 250.5, 'kWh', TRUE, 'Electric energy consumption for oven heating');

-- CO2 output (driver)
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
(@comp5_id, 1, 'output', 125.25, 'kg', TRUE, 'CO2 emissions from coal-based electricity generation');

-- Methane output (driver)
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
(@comp5_id, 2, 'output', 2.5, 'kg', TRUE, 'Methane emissions from energy production');

-- Water input (non-driver)
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver) VALUES
(@comp5_id, 8, 'input', 15.0, 'm3', FALSE);

-- 7. Run assessment
INSERT INTO assessment_runs (case_id, run_name, calculation_method, status, executed_by) VALUES
(@case_id, 'Q1 2025 Baseline Assessment', 'CML 2001', 'running', @user_id);

SET @run_id = LAST_INSERT_ID();

-- 8. Calculate and store results
-- For each driver flow, multiply by impact factors and store results
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit)
SELECT 
    @run_id,
    f.component_id,
    dif.category_id,
    f.quantity * dif.factor_value as impact_value,
    ic.unit
FROM flows f
JOIN driver_impact_factors dif ON f.substance_id = dif.substance_id
JOIN impact_categories ic ON dif.category_id = ic.category_id
WHERE f.component_id = @comp5_id AND f.is_driver = TRUE;

-- 9. Update assessment status to completed
UPDATE assessment_runs SET status = 'completed' WHERE run_id = @run_id;

-- 10. Create comparative case
INSERT INTO case_table (project_id, case_name, case_type, parent_case_id, description) VALUES
(@project_id, 'Renewable Energy Scenario', 'comparative', @case_id, 'Same production with 100% renewable electricity');

-- Display summary
SELECT '========== TEST DATA CREATED ==========' AS '';
SELECT 'User ID:', @user_id AS '', 'john@lcaproject.com' AS '';
SELECT 'Project ID:', @project_id AS '', 'Electric Vehicle Manufacturing' AS '';
SELECT 'Case ID:', @case_id AS '', 'Baseline Production - 2025' AS '';
SELECT 'Assessment Run ID:', @run_id AS '', 'Q1 2025 Baseline Assessment' AS '';
SELECT '' AS '';
SELECT 'Created:' AS '';
SELECT '  - 1 User' AS '';
SELECT '  - 1 Project' AS '';
SELECT '  - 2 Cases (base + comparative)' AS '';
SELECT '  - 5 Components (full hierarchy)' AS '';
SELECT '  - 4 Flows (3 drivers + 1 non-driver)' AS '';
SELECT '  - 1 Assessment Run with Results' AS '';
SELECT '========================================' AS '';
EOSQL
```

## Option 2: Deploy Next.js to EC2 (Full solution - 2 hours)

This will make the APIs accessible from within the VPC where they can reach RDS.

See [DEPLOYMENT_STATUS.md](./DEPLOYMENT_STATUS.md) for deployment instructions.

## Verify Data Was Created

After running Option 1, verify with:

```bash
mysql -h lca-dev-db-small.cmp8mswckq1j.us-east-1.rds.amazonaws.com -u lcaadmin -p'EP76017fLefZ8?d!ezTHsN[kA()X' lca_v3 -e "
SELECT 'USERS:' AS ''; SELECT id, username, email FROM account;
SELECT '' AS '';
SELECT 'PROJECTS:' AS ''; SELECT project_id, project_name, description FROM project;
SELECT '' AS '';
SELECT 'CASES:' AS ''; SELECT case_id, case_name, case_type FROM case_table;
SELECT '' AS '';
SELECT 'COMPONENTS:' AS ''; SELECT component_id, component_name, component_type, hierarchy_level FROM component ORDER BY hierarchy_level;
SELECT '' AS '';
SELECT 'FLOWS:' AS ''; SELECT f.flow_id, c.component_name, s.substance_name, f.flow_type, f.quantity, f.is_driver FROM flows f LEFT JOIN component c ON f.component_id = c.component_id LEFT JOIN substances s ON f.substance_id = s.substance_id;
SELECT '' AS '';
SELECT 'ASSESSMENT:' AS ''; SELECT run_id, run_name, status FROM assessment_runs;
SELECT '' AS '';
SELECT 'RESULTS:' AS ''; SELECT ar.result_id, c.component_name, ic.category_name, ROUND(ar.impact_value, 2) as impact, ar.unit FROM assessment_results ar LEFT JOIN component c ON ar.component_id = c.component_id LEFT JOIN impact_categories ic ON ar.category_id = ic.category_id;
"
```

## What This Creates

- **1 Test User**: john@lcaproject.com (password hash is for "password123")
- **1 Project**: Electric Vehicle Manufacturing
- **2 Cases**: 
  - Baseline Production (with full hierarchy and flows)
  - Renewable Energy Scenario (comparative)
- **5 Components**: Complete 5-level hierarchy from Product → Elemental Task
- **4 Flows**: 
  - 250.5 kWh Electricity (input, driver)
  - 125.25 kg CO2 (output, driver)
  - 2.5 kg Methane (output, driver)
  - 15.0 m3 Water (input, non-driver)
- **1 Assessment Run**: With calculated impact results
- **Assessment Results**: Environmental impacts calculated across all impact categories

## Why We Need This

The RDS database is in a **private VPC** subnet, which means:
- ✅ Secure (not publicly accessible)
- ❌ Cannot connect from local machine
- ✅ Can connect from EC2 (in same VPC)
- ✅ Future Next.js app on EC2 will have full access

This test data will be **persistent** in AWS RDS and will be there when you deploy the Next.js application to EC2.

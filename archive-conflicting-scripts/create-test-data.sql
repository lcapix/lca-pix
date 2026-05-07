-- LCA Project v3 - Test Data Creation Script
-- Run this in EC2 Session Manager terminal

USE lca_v3;

-- 1. Create test user (password is hashed "password123")
INSERT INTO account (username, email, password_hash, account_type) VALUES
('john_doe', 'john@lcaproject.com', '$2b$10$YourHashedPasswordHere', 'user');

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
INSERT INTO component (case_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case_id, 'EV Battery Pack (60 kWh)', 'product', 1, 1.0, 'unit', 'Complete lithium-ion battery pack');
SET @comp1_id = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case_id, @comp1_id, 'Cell Assembly Line', 'machine_line', 2, 1.0, 'line', 'Automated assembly line');
SET @comp2_id = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case_id, @comp2_id, 'Electrode Coating Process', 'subprocess', 3, 1.0, 'batch', 'Coating process');
SET @comp3_id = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case_id, @comp3_id, 'Drying Operation', 'operation', 4, 1.0, 'cycle', 'High temperature drying');
SET @comp4_id = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case_id, @comp4_id, 'Oven Heating Task', 'elemental_task', 5, 1.0, 'task', 'Electric heating');
SET @comp5_id = LAST_INSERT_ID();

-- 6. Add flows to elemental task
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
(@comp5_id, 7, 'input', 250.5, 'kWh', TRUE, 'Electric energy consumption'),
(@comp5_id, 1, 'output', 125.25, 'kg', TRUE, 'CO2 emissions from electricity'),
(@comp5_id, 2, 'output', 2.5, 'kg', TRUE, 'Methane emissions'),
(@comp5_id, 8, 'input', 15.0, 'm3', FALSE, NULL);

-- 7. Run assessment
INSERT INTO assessment_runs (case_id, run_name, calculation_method, status, executed_by) VALUES
(@case_id, 'Q1 2025 Baseline Assessment', 'CML 2001', 'running', @user_id);

SET @run_id = LAST_INSERT_ID();

-- 8. Calculate and store results
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

-- 9. Update assessment status
UPDATE assessment_runs SET status = 'completed' WHERE run_id = @run_id;

-- 10. Create first comparative case (Renewable Energy Scenario)
INSERT INTO case_table (project_id, case_name, case_type, parent_case_id, description) VALUES
(@project_id, 'Renewable Energy Scenario', 'comparative', @case_id, 'With 100% renewable electricity');

SET @comp_case1_id = LAST_INSERT_ID();

-- Create component hierarchy for first comparative case
INSERT INTO component (case_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@comp_case1_id, 'EV Battery Pack (60 kWh)', 'product', 1, 1.0, 'unit', 'Complete lithium-ion battery pack - renewable energy');
SET @comp1_comp1_id = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@comp_case1_id, @comp1_comp1_id, 'Cell Assembly Line', 'machine_line', 2, 1.0, 'line', 'Automated assembly line - renewable');
SET @comp1_comp2_id = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@comp_case1_id, @comp1_comp2_id, 'Electrode Coating Process', 'subprocess', 3, 1.0, 'batch', 'Coating process - renewable');
SET @comp1_comp3_id = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@comp_case1_id, @comp1_comp3_id, 'Drying Operation', 'operation', 4, 1.0, 'cycle', 'High temperature drying - renewable');
SET @comp1_comp4_id = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@comp_case1_id, @comp1_comp4_id, 'Oven Heating Task', 'elemental_task', 5, 1.0, 'task', 'Electric heating - renewable');
SET @comp1_comp5_id = LAST_INSERT_ID();

-- Add flows to first comparative case (lower emissions due to renewable energy)
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
(@comp1_comp5_id, 7, 'input', 250.5, 'kWh', TRUE, 'Electric energy consumption - renewable'),
(@comp1_comp5_id, 1, 'output', 12.09, 'kg', TRUE, 'CO2 emissions from renewable electricity (much lower)'),
(@comp1_comp5_id, 2, 'output', 0.65, 'kg', TRUE, 'Methane emissions (reduced)'),
(@comp1_comp5_id, 8, 'input', 15.0, 'm3', FALSE, NULL);

-- Run assessment for first comparative case
INSERT INTO assessment_runs (case_id, run_name, calculation_method, status, executed_by) VALUES
(@comp_case1_id, 'Q1 2025 Renewable Energy Assessment', 'CML 2001', 'running', @user_id);

SET @comp1_run_id = LAST_INSERT_ID();

-- Calculate and store results for first comparative case
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit)
SELECT
    @comp1_run_id,
    f.component_id,
    dif.category_id,
    f.quantity * dif.factor_value as impact_value,
    ic.unit
FROM flows f
JOIN driver_impact_factors dif ON f.substance_id = dif.substance_id
JOIN impact_categories ic ON dif.category_id = ic.category_id
WHERE f.component_id = @comp1_comp5_id AND f.is_driver = TRUE;

-- Update first comparative assessment status
UPDATE assessment_runs SET status = 'completed' WHERE run_id = @comp1_run_id;

-- 11. Create second comparative case (Solar-Powered Production)
INSERT INTO case_table (project_id, case_name, case_type, parent_case_id, description) VALUES
(@project_id, 'Solar-Powered Production', 'comparative', @case_id, 'Using 100% solar energy with battery storage');

SET @comp_case2_id = LAST_INSERT_ID();

-- Create component hierarchy for second comparative case
INSERT INTO component (case_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@comp_case2_id, 'EV Battery Pack (60 kWh)', 'product', 1, 1.0, 'unit', 'Complete lithium-ion battery pack - solar powered');
SET @comp2_comp1_id = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@comp_case2_id, @comp2_comp1_id, 'Cell Assembly Line', 'machine_line', 2, 1.0, 'line', 'Automated assembly line - solar');
SET @comp2_comp2_id = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@comp_case2_id, @comp2_comp2_id, 'Electrode Coating Process', 'subprocess', 3, 1.0, 'batch', 'Coating process - solar');
SET @comp2_comp3_id = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@comp_case2_id, @comp2_comp3_id, 'Drying Operation', 'operation', 4, 1.0, 'cycle', 'High temperature drying - solar');
SET @comp2_comp4_id = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@comp_case2_id, @comp2_comp4_id, 'Oven Heating Task', 'elemental_task', 5, 1.0, 'task', 'Electric heating - solar');
SET @comp2_comp5_id = LAST_INSERT_ID();

-- Add flows to second comparative case (very low emissions with solar)
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
(@comp2_comp5_id, 7, 'input', 250.5, 'kWh', TRUE, 'Electric energy consumption - solar'),
(@comp2_comp5_id, 1, 'output', 7.8, 'kg', TRUE, 'CO2 emissions from solar electricity (minimal)'),
(@comp2_comp5_id, 2, 'output', 0.35, 'kg', TRUE, 'Methane emissions (minimal)'),
(@comp2_comp5_id, 8, 'input', 15.0, 'm3', FALSE, NULL);

-- Run assessment for second comparative case
INSERT INTO assessment_runs (case_id, run_name, calculation_method, status, executed_by) VALUES
(@comp_case2_id, 'Q1 2025 Solar-Powered Assessment', 'CML 2001', 'running', @user_id);

SET @comp2_run_id = LAST_INSERT_ID();

-- Calculate and store results for second comparative case
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit)
SELECT
    @comp2_run_id,
    f.component_id,
    dif.category_id,
    f.quantity * dif.factor_value as impact_value,
    ic.unit
FROM flows f
JOIN driver_impact_factors dif ON f.substance_id = dif.substance_id
JOIN impact_categories ic ON dif.category_id = ic.category_id
WHERE f.component_id = @comp2_comp5_id AND f.is_driver = TRUE;

-- Update second comparative assessment status
UPDATE assessment_runs SET status = 'completed' WHERE run_id = @comp2_run_id;

-- 12. Create third comparative case (Wind-Powered Production)
INSERT INTO case_table (project_id, case_name, case_type, parent_case_id, description) VALUES
(@project_id, 'Wind-Powered Production', 'comparative', @case_id, 'Using wind energy with grid backup');

SET @comp_case3_id = LAST_INSERT_ID();

-- Create component hierarchy for third comparative case
INSERT INTO component (case_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@comp_case3_id, 'EV Battery Pack (60 kWh)', 'product', 1, 1.0, 'unit', 'Complete lithium-ion battery pack - wind powered');
SET @comp3_comp1_id = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@comp_case3_id, @comp3_comp1_id, 'Cell Assembly Line', 'machine_line', 2, 1.0, 'line', 'Automated assembly line - wind');
SET @comp3_comp2_id = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@comp_case3_id, @comp3_comp2_id, 'Electrode Coating Process', 'subprocess', 3, 1.0, 'batch', 'Coating process - wind');
SET @comp3_comp3_id = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@comp_case3_id, @comp3_comp3_id, 'Drying Operation', 'operation', 4, 1.0, 'cycle', 'High temperature drying - wind');
SET @comp3_comp4_id = LAST_INSERT_ID();

INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@comp_case3_id, @comp3_comp4_id, 'Oven Heating Task', 'elemental_task', 5, 1.0, 'task', 'Electric heating - wind');
SET @comp3_comp5_id = LAST_INSERT_ID();

-- Add flows to third comparative case (mid-range emissions with wind + grid backup)
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
(@comp3_comp5_id, 7, 'input', 250.5, 'kWh', TRUE, 'Electric energy consumption - wind + grid'),
(@comp3_comp5_id, 1, 'output', 10.2, 'kg', TRUE, 'CO2 emissions from wind electricity (low)'),
(@comp3_comp5_id, 2, 'output', 0.48, 'kg', TRUE, 'Methane emissions (low)'),
(@comp3_comp5_id, 8, 'input', 15.0, 'm3', FALSE, NULL);

-- Run assessment for third comparative case
INSERT INTO assessment_runs (case_id, run_name, calculation_method, status, executed_by) VALUES
(@comp_case3_id, 'Q1 2025 Wind-Powered Assessment', 'CML 2001', 'running', @user_id);

SET @comp3_run_id = LAST_INSERT_ID();

-- Calculate and store results for third comparative case
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit)
SELECT
    @comp3_run_id,
    f.component_id,
    dif.category_id,
    f.quantity * dif.factor_value as impact_value,
    ic.unit
FROM flows f
JOIN driver_impact_factors dif ON f.substance_id = dif.substance_id
JOIN impact_categories ic ON dif.category_id = ic.category_id
WHERE f.component_id = @comp3_comp5_id AND f.is_driver = TRUE;

-- Update third comparative assessment status
UPDATE assessment_runs SET status = 'completed' WHERE run_id = @comp3_run_id;

-- Display summary
SELECT '========== TEST DATA CREATED ==========' AS summary;
SELECT CONCAT('User: john@lcaproject.com (ID: ', @user_id, ')') AS info;
SELECT CONCAT('Project: Electric Vehicle Manufacturing (ID: ', @project_id, ')') AS info;
SELECT CONCAT('Base Case: Baseline Production (ID: ', @case_id, ')') AS info;
SELECT CONCAT('Comparative Case 1: Renewable Energy (ID: ', @comp_case1_id, ')') AS info;
SELECT CONCAT('Comparative Case 2: Solar-Powered (ID: ', @comp_case2_id, ')') AS info;
SELECT CONCAT('Comparative Case 3: Wind-Powered (ID: ', @comp_case3_id, ')') AS info;
SELECT CONCAT('Assessment Runs: Base (ID: ', @run_id, '), Comp1 (ID: ', @comp1_run_id, '), Comp2 (ID: ', @comp2_run_id, '), Comp3 (ID: ', @comp3_run_id, ')') AS info;
SELECT '1 Base Case + 3 Comparative Cases with Full Component Hierarchies' AS summary;
SELECT '========================================' AS summary;

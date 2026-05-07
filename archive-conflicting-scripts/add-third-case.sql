-- LCA Project v3 - Add Third Comparative Case (Wind-Powered Production)
-- This script adds the "Wind-Powered Production" comparative case to the database
-- Run this script via your MySQL connection

USE lca_v3;

-- Get existing IDs
SET @project_id = (SELECT project_id FROM project WHERE project_name = 'Electric Vehicle Manufacturing' LIMIT 1);
SET @base_case_id = (SELECT case_id FROM case_table WHERE case_type = 'base' AND project_id = @project_id LIMIT 1);
SET @user_id = (SELECT id FROM account WHERE email = 'john@lcaproject.com' LIMIT 1);

-- Verify we have the required data
SELECT CONCAT('Project ID: ', @project_id, ' | Base Case ID: ', @base_case_id, ' | User ID: ', @user_id) as verification;

-- ==============================================================================
-- CREATE THIRD COMPARATIVE CASE
-- ==============================================================================

INSERT INTO case_table (project_id, case_name, case_type, parent_case_id, description) VALUES
(@project_id, 'Wind-Powered Production', 'comparative', @base_case_id, 'Using wind energy with grid backup');

SET @case3_id = LAST_INSERT_ID();

SELECT CONCAT('Created Case ID: ', @case3_id, ' - Wind-Powered Production') as case_created;

-- ==============================================================================
-- CREATE COMPONENT HIERARCHY (5 levels)
-- ==============================================================================

-- Level 1: Product
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case3_id, NULL, 'EV Battery Pack (60 kWh)', 'product', 1, 1.0, 'unit', 'Complete lithium-ion battery pack - wind powered');
SET @comp1_id = LAST_INSERT_ID();

-- Level 2: Machine
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case3_id, @comp1_id, 'Cell Assembly Line', 'machine_line', 2, 1.0, 'line', 'Automated assembly line - wind energy');
SET @comp2_id = LAST_INSERT_ID();

-- Level 3: Subprocess
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case3_id, @comp2_id, 'Electrode Coating Process', 'subprocess', 3, 1.0, 'batch', 'Coating process - wind energy');
SET @comp3_id = LAST_INSERT_ID();

-- Level 4: Operation
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case3_id, @comp3_id, 'Drying Operation', 'operation', 4, 1.0, 'cycle', 'High temperature drying - wind energy');
SET @comp4_id = LAST_INSERT_ID();

-- Level 5: Elemental (where flows are attached)
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case3_id, @comp4_id, 'Oven Heating Task', 'elemental_task', 5, 1.0, 'task', 'Electric heating - wind energy with grid backup');
SET @comp5_id = LAST_INSERT_ID();

SELECT CONCAT('Created 5 components (IDs: ', @comp1_id, ' to ', @comp5_id, ')') as components_created;

-- ==============================================================================
-- ADD ENVIRONMENTAL FLOWS
-- Wind energy with grid backup: mid-range emissions between renewable and solar
-- ==============================================================================

-- Get substance IDs
SET @electricity_id = (SELECT substance_id FROM substances WHERE substance_name = 'Electricity' LIMIT 1);
SET @co2_id = (SELECT substance_id FROM substances WHERE substance_name = 'Carbon Dioxide' LIMIT 1);
SET @ch4_id = (SELECT substance_id FROM substances WHERE substance_name = 'Methane' LIMIT 1);
SET @water_id = (SELECT substance_id FROM substances WHERE substance_name = 'Water' LIMIT 1);

-- Flow 1: Electricity INPUT (same consumption)
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
(@comp5_id, @electricity_id, 'input', 250.5, 'kWh', TRUE, 'Electric energy consumption - wind with grid backup');

-- Flow 2: CO₂ OUTPUT (10.2 kg - between Renewable 12.09 and Solar 7.8)
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
(@comp5_id, @co2_id, 'output', 10.2, 'kg', TRUE, 'CO2 emissions from wind electricity (low, with grid backup)');

-- Flow 3: Methane OUTPUT (0.48 kg - between Renewable 0.65 and Solar 0.35)
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
(@comp5_id, @ch4_id, 'output', 0.48, 'kg', TRUE, 'Methane emissions (low)');

-- Flow 4: Water INPUT (same as other cases)
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
(@comp5_id, @water_id, 'input', 15.0, 'm³', FALSE, 'Process cooling water');

SELECT CONCAT('Created 4 flows for component ID: ', @comp5_id) as flows_created;

-- ==============================================================================
-- CREATE ASSESSMENT RUN
-- ==============================================================================

INSERT INTO assessment_runs (case_id, run_name, calculation_method, status, executed_by, run_date) VALUES
(@case3_id, 'Q1 2025 Wind-Powered Assessment', 'CML 2001', 'completed', @user_id, NOW());

SET @run3_id = LAST_INSERT_ID();

SELECT CONCAT('Created assessment run ID: ', @run3_id) as assessment_created;

-- ==============================================================================
-- CALCULATE AND STORE ASSESSMENT RESULTS
-- ==============================================================================

-- Get impact category IDs
SET @gwp_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Global Warming' LIMIT 1);
SET @odp_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Ozone Depletion' LIMIT 1);
SET @ap_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Acidification' LIMIT 1);
SET @ep_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Eutrophication' LIMIT 1);
SET @pocp_id = (SELECT category_id FROM im pact_categories WHERE category_name = 'Photochemical Oxidation' LIMIT 1);

-- Calculate results using driver impact factors
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit)
SELECT
    @run3_id,
    f.component_id,
    dif.category_id,
    f.quantity * dif.factor_value as impact_value,
    ic.unit
FROM flows f
JOIN driver_impact_factors dif ON f.substance_id = dif.substance_id
JOIN impact_categories ic ON dif.category_id = ic.category_id
WHERE f.component_id = @comp5_id AND f.is_driver = TRUE;

SELECT CONCAT('Created assessment results for run ID: ', @run3_id) as results_created;

-- ==============================================================================
-- VERIFICATION
-- ==============================================================================

SELECT '========== WIND-POWERED CASE SUMMARY ==========' as summary;

SELECT 'Case Info:' as section,
       @case3_id as case_id,
       'Wind-Powered Production' as case_name,
       'comparative' as case_type;

SELECT 'Components:' as section, COUNT(*) as count
FROM component WHERE case_id = @case3_id;

SELECT 'Flows:' as section, COUNT(*) as count
FROM flows WHERE component_id IN (SELECT component_id FROM component WHERE case_id = @case3_id);

SELECT 'Assessment Results:' as section, COUNT(*) as count
FROM assessment_results WHERE run_id = @run3_id;

-- Show all cases for this project
SELECT '========== ALL CASES IN PROJECT ==========' as summary;
SELECT case_id, case_name, case_type, description
FROM case_table
WHERE project_id = @project_id
ORDER BY case_type, case_id;

SELECT '========== SCRIPT COMPLETE ==========' as summary;

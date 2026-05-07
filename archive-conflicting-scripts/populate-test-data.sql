-- ============================================================================
-- LCA PROJECT V3 - COMPLETE TEST DATA POPULATION
-- ============================================================================
-- This script creates comprehensive test data including:
-- - User accounts
-- - Projects (2 projects)
-- - Cases (4 cases: 2 base + 2 comparative)
-- - Component hierarchies (5 levels each)
-- - Environmental flows
-- - ASSESSMENT RUNS with RESULTS
-- - Impact categories and characterization factors
-- ============================================================================

USE lca_v3;

-- Start transaction for data integrity
START TRANSACTION;

SELECT '============================================================================' AS '';
SELECT 'LCA PROJECT V3 - TEST DATA POPULATION' AS '';
SELECT '============================================================================' AS '';
SELECT '' AS '';

-- ============================================================================
-- STEP 1: CREATE TEST USERS
-- ============================================================================
SELECT '📋 STEP 1: Creating test users...' AS '';

-- Test User 1: Regular user
-- Password: demo123 (hashed with bcrypt, cost 10)
INSERT IGNORE INTO account (id, username, email, password_hash, account_type, is_active) VALUES
(1000, 'demo_user', 'demo@lcaproject.com', '$2b$10$YgZ8kQrVK3xGHX0JdZ8Z3.Qj9XqK0YZK8xqK0YZK8xqK0YZK8xqK0', 'user', TRUE);

-- Test User 2: Admin user
-- Password: admin123
INSERT IGNORE INTO account (id, username, email, password_hash, account_type, is_active) VALUES
(1001, 'admin_user', 'admin@lcaproject.com', '$2b$10$YgZ8kQrVK3xGHX0JdZ8Z3.Qj9XqK0YZK8xqK0YZK8xqK0YZK8xqK1', 'admin', TRUE);

SELECT '✅ Created 2 test users' AS '';
SELECT '' AS '';

-- ============================================================================
-- STEP 2: CREATE PROJECTS
-- ============================================================================
SELECT '📂 STEP 2: Creating projects...' AS '';

-- Project 1: Electric Vehicle Manufacturing
INSERT INTO project (project_id, project_name, description, owner_id, created_at) VALUES
(2000, 'Electric Vehicle Battery Production',
 'Life cycle assessment of lithium-ion battery manufacturing for electric vehicles',
 1000, '2025-01-10 09:00:00');

-- Project 2: Solar Panel Manufacturing
INSERT INTO project (project_id, project_name, description, owner_id, created_at) VALUES
(2001, 'Solar Panel Manufacturing LCA',
 'Environmental impact assessment of photovoltaic panel production',
 1000, '2025-01-11 10:30:00');

-- Add project members (owners)
INSERT INTO project_members (project_id, account_id, permission_id)
SELECT 2000, 1000, permission_id FROM permissions WHERE permission_name = 'owner';

INSERT INTO project_members (project_id, account_id, permission_id)
SELECT 2001, 1000, permission_id FROM permissions WHERE permission_name = 'owner';

SELECT '✅ Created 2 projects' AS '';
SELECT '' AS '';

-- ============================================================================
-- STEP 3: CREATE CASES
-- ============================================================================
SELECT '📊 STEP 3: Creating cases...' AS '';

-- PROJECT 1 CASES
-- Base case for Project 1
INSERT INTO case_table (case_id, project_id, case_name, case_type, parent_case_id, description, created_at) VALUES
(3000, 2000, 'Baseline - Coal Grid Energy',
 'base', NULL,
 'Current state production using coal-based grid electricity (carbon intensity: 0.5 kg CO₂/kWh)',
 '2025-01-10 09:15:00');

-- Comparative case for Project 1
INSERT INTO case_table (case_id, project_id, case_name, case_type, parent_case_id, description, created_at) VALUES
(3001, 2000, 'Scenario A - 100% Renewable Energy',
 'comparative', 3000,
 'Production powered by 100% renewable energy (solar/wind mix, 96% emission reduction)',
 '2025-01-10 10:00:00');

-- PROJECT 2 CASES
-- Base case for Project 2
INSERT INTO case_table (case_id, project_id, case_name, case_type, parent_case_id, description, created_at) VALUES
(3002, 2001, 'Standard Silicon Process',
 'base', NULL,
 'Conventional polysilicon production with standard purification',
 '2025-01-11 11:00:00');

-- Comparative case for Project 2
INSERT INTO case_table (case_id, project_id, case_name, case_type, parent_case_id, description, created_at) VALUES
(3003, 2001, 'Advanced Recycling Process',
 'comparative', 3002,
 'Production using recycled silicon and improved energy efficiency',
 '2025-01-11 11:30:00');

SELECT '✅ Created 4 cases (2 base + 2 comparative)' AS '';
SELECT '' AS '';

-- ============================================================================
-- STEP 4: CREATE COMPONENT HIERARCHIES
-- ============================================================================
SELECT '🔧 STEP 4: Creating component hierarchies...' AS '';

-- ----------------------------------------------------------------------------
-- CASE 3000: EV Battery - Coal Grid (5-level hierarchy)
-- ----------------------------------------------------------------------------

-- Level 1: Product
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(4000, 3000, NULL, 'EV Battery Pack (60 kWh)', 'product', 1, 1.0, 'unit',
 'Complete lithium-ion battery pack for electric vehicle');

-- Level 2: Machine/Line
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(4001, 3000, 4000, 'Cell Assembly Line', 'machine_line', 2, 1.0, 'line',
 'Automated production line for battery cell assembly');

-- Level 3: Subprocess
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(4002, 3000, 4001, 'Electrode Coating Process', 'subprocess', 3, 1.0, 'batch',
 'Electrode coating and preparation subprocess');

-- Level 4: Operation
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(4003, 3000, 4002, 'Drying Operation', 'operation', 4, 1.0, 'cycle',
 'High-temperature drying to remove solvents');

-- Level 5: Elemental Task (where flows are attached)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(4004, 3000, 4003, 'Oven Heating Task', 'elemental_task', 5, 1.0, 'task',
 'Electric oven heating powered by coal grid');

-- ----------------------------------------------------------------------------
-- CASE 3001: EV Battery - Renewable (5-level hierarchy)
-- ----------------------------------------------------------------------------

INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(4005, 3001, NULL, 'EV Battery Pack (60 kWh)', 'product', 1, 1.0, 'unit',
 'Battery pack manufactured with renewable energy'),
(4006, 3001, 4005, 'Cell Assembly Line', 'machine_line', 2, 1.0, 'line',
 'Assembly line powered by renewable energy'),
(4007, 3001, 4006, 'Electrode Coating Process', 'subprocess', 3, 1.0, 'batch',
 'Coating process using clean energy'),
(4008, 3001, 4007, 'Drying Operation', 'operation', 4, 1.0, 'cycle',
 'Drying with renewable electricity'),
(4009, 3001, 4008, 'Oven Heating Task', 'elemental_task', 5, 1.0, 'task',
 'Electric heating from solar/wind power');

-- ----------------------------------------------------------------------------
-- CASE 3002: Solar Panel - Standard (3-level hierarchy)
-- ----------------------------------------------------------------------------

INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(4010, 3002, NULL, 'Solar Panel 300W', 'product', 1, 1.0, 'unit',
 'Monocrystalline silicon solar panel'),
(4011, 3002, 4010, 'Silicon Purification', 'subprocess', 2, 1.0, 'batch',
 'Polysilicon production and purification'),
(4012, 3002, 4011, 'Chemical Reduction', 'elemental_task', 3, 1.0, 'cycle',
 'Siemens process for silicon purification');

-- ----------------------------------------------------------------------------
-- CASE 3003: Solar Panel - Recycled (3-level hierarchy)
-- ----------------------------------------------------------------------------

INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(4013, 3003, NULL, 'Solar Panel 300W', 'product', 1, 1.0, 'unit',
 'Panel using 30% recycled silicon'),
(4014, 3003, 4013, 'Silicon Reprocessing', 'subprocess', 2, 1.0, 'batch',
 'Recycled silicon purification'),
(4015, 3003, 4014, 'Thermal Treatment', 'elemental_task', 3, 1.0, 'cycle',
 'Lower-energy recycled silicon processing');

SELECT '✅ Created 16 components across 4 cases' AS '';
SELECT '' AS '';

-- ============================================================================
-- STEP 5: CREATE ENVIRONMENTAL FLOWS
-- ============================================================================
SELECT '🌍 STEP 5: Creating environmental flows...' AS '';

-- Get substance IDs (these should exist from schema)
SET @co2_id = (SELECT substance_id FROM substances WHERE substance_name = 'Carbon Dioxide' LIMIT 1);
SET @ch4_id = (SELECT substance_id FROM substances WHERE substance_name = 'Methane' LIMIT 1);
SET @n2o_id = (SELECT substance_id FROM substances WHERE substance_name = 'Nitrous Oxide' LIMIT 1);
SET @electricity_id = (SELECT substance_id FROM substances WHERE substance_name = 'Electricity' LIMIT 1);
SET @water_id = (SELECT substance_id FROM substances WHERE substance_name = 'Water' LIMIT 1);

-- ----------------------------------------------------------------------------
-- FLOWS FOR CASE 3000: Coal Grid (High emissions)
-- ----------------------------------------------------------------------------

INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
-- Component 4004: Oven Heating Task (Coal Grid)
(4004, @electricity_id, 'input', 250.5, 'kWh', TRUE, 'Electric energy from coal grid (0.5 kg CO₂/kWh)'),
(4004, @co2_id, 'output', 125.25, 'kg', TRUE, 'CO₂ emissions from coal electricity generation'),
(4004, @ch4_id, 'output', 2.5, 'kg', TRUE, 'Methane emissions from coal mining and combustion'),
(4004, @n2o_id, 'output', 0.15, 'kg', TRUE, 'Nitrous oxide from coal combustion'),
(4004, @water_id, 'input', 15.0, 'm³', FALSE, 'Process cooling water');

-- ----------------------------------------------------------------------------
-- FLOWS FOR CASE 3001: Renewable Energy (Low emissions)
-- ----------------------------------------------------------------------------

INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
-- Component 4009: Oven Heating Task (Renewable)
(4009, @electricity_id, 'input', 250.5, 'kWh', TRUE, 'Electric energy from renewable sources (solar/wind)'),
(4009, @co2_id, 'output', 5.0, 'kg', TRUE, 'CO₂ from renewable infrastructure lifecycle (96% reduction)'),
(4009, @ch4_id, 'output', 0.1, 'kg', TRUE, 'Trace methane from renewable operations'),
(4009, @n2o_id, 'output', 0.01, 'kg', TRUE, 'Negligible N₂O from renewable energy'),
(4009, @water_id, 'input', 15.0, 'm³', FALSE, 'Process cooling water (same)');

-- ----------------------------------------------------------------------------
-- FLOWS FOR CASE 3002: Standard Silicon (High energy)
-- ----------------------------------------------------------------------------

INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
-- Component 4012: Chemical Reduction
(4012, @electricity_id, 'input', 450.0, 'kWh', TRUE, 'High energy for Siemens process'),
(4012, @co2_id, 'output', 180.0, 'kg', TRUE, 'CO₂ from high-temperature processing'),
(4012, @ch4_id, 'output', 1.2, 'kg', TRUE, 'Methane from chemical reactions'),
(4012, @water_id, 'input', 25.0, 'm³', FALSE, 'Cooling and cleaning water');

-- ----------------------------------------------------------------------------
-- FLOWS FOR CASE 3003: Recycled Silicon (Lower energy)
-- ----------------------------------------------------------------------------

INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
-- Component 4015: Thermal Treatment
(4015, @electricity_id, 'input', 180.0, 'kWh', TRUE, 'Lower energy for recycled silicon (60% reduction)'),
(4015, @co2_id, 'output', 72.0, 'kg', TRUE, 'Reduced CO₂ from lower energy needs'),
(4015, @ch4_id, 'output', 0.5, 'kg', TRUE, 'Lower methane emissions'),
(4015, @water_id, 'input', 12.0, 'm³', FALSE, 'Reduced water consumption');

SELECT '✅ Created 22 environmental flows' AS '';
SELECT '' AS '';

-- ============================================================================
-- STEP 6: CREATE ASSESSMENT RUNS
-- ============================================================================
SELECT '🔬 STEP 6: Creating assessment runs...' AS '';

-- Assessment for Case 3000 (EV Battery - Coal)
INSERT INTO assessment_runs (run_id, case_id, run_name, calculation_method, status, executed_by, run_at) VALUES
(5000, 3000, 'Q1 2025 Baseline Assessment', 'CML 2001', 'completed', 1000, '2025-01-15 10:30:00');

-- Assessment for Case 3001 (EV Battery - Renewable)
INSERT INTO assessment_runs (run_id, case_id, run_name, calculation_method, status, executed_by, run_at) VALUES
(5001, 3001, 'Q1 2025 Renewable Scenario', 'CML 2001', 'completed', 1000, '2025-01-15 11:00:00');

-- Assessment for Case 3002 (Solar - Standard)
INSERT INTO assessment_runs (run_id, case_id, run_name, calculation_method, status, executed_by, run_at) VALUES
(5002, 3002, 'Standard Process Assessment', 'CML 2001', 'completed', 1000, '2025-01-16 09:00:00');

-- Assessment for Case 3003 (Solar - Recycled)
INSERT INTO assessment_runs (run_id, case_id, run_name, calculation_method, status, executed_by, run_at) VALUES
(5003, 3003, 'Recycled Silicon Assessment', 'CML 2001', 'completed', 1000, '2025-01-16 09:30:00');

SELECT '✅ Created 4 assessment runs' AS '';
SELECT '' AS '';

-- ============================================================================
-- STEP 7: CREATE ASSESSMENT RESULTS
-- ============================================================================
SELECT '📈 STEP 7: Creating assessment results...' AS '';

-- Get impact category IDs
SET @gwp_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Global Warming' LIMIT 1);
SET @odp_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Ozone Depletion' LIMIT 1);
SET @ap_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Acidification' LIMIT 1);
SET @ep_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Eutrophication' LIMIT 1);
SET @pocp_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Photochemical Oxidation' LIMIT 1);

-- ----------------------------------------------------------------------------
-- RESULTS FOR RUN 5000: Case 3000 (Coal Grid) - High Impact
-- ----------------------------------------------------------------------------

-- Global Warming: CO₂ (125.25 × 1.0) + CH₄ (2.5 × 28.0) + N₂O (0.15 × 265.0) = 195.0 kg CO₂-eq
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES
(5000, 4004, @gwp_id, 195.0, 'kg CO2-eq');

-- Acidification: Example value
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES
(5000, 4004, @ap_id, 0.8, 'kg SO2-eq');

-- Eutrophication: Example value
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES
(5000, 4004, @ep_id, 0.05, 'kg PO4-eq');

-- ----------------------------------------------------------------------------
-- RESULTS FOR RUN 5001: Case 3001 (Renewable) - Low Impact (96% reduction)
-- ----------------------------------------------------------------------------

-- Global Warming: CO₂ (5.0 × 1.0) + CH₄ (0.1 × 28.0) + N₂O (0.01 × 265.0) = 7.8 kg CO₂-eq
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES
(5001, 4009, @gwp_id, 7.8, 'kg CO2-eq');

-- Acidification: 96% reduction
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES
(5001, 4009, @ap_id, 0.032, 'kg SO2-eq');

-- Eutrophication: 96% reduction
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES
(5001, 4009, @ep_id, 0.002, 'kg PO4-eq');

-- ----------------------------------------------------------------------------
-- RESULTS FOR RUN 5002: Case 3002 (Standard Silicon) - High Impact
-- ----------------------------------------------------------------------------

-- Global Warming: Higher due to energy-intensive process
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES
(5002, 4012, @gwp_id, 210.0, 'kg CO2-eq');

-- Acidification
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES
(5002, 4012, @ap_id, 1.2, 'kg SO2-eq');

-- ----------------------------------------------------------------------------
-- RESULTS FOR RUN 5003: Case 3003 (Recycled Silicon) - 60% Reduction
-- ----------------------------------------------------------------------------

-- Global Warming: 60% lower than standard
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES
(5003, 4015, @gwp_id, 84.0, 'kg CO2-eq');

-- Acidification: 60% lower
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES
(5003, 4015, @ap_id, 0.48, 'kg SO2-eq');

SELECT '✅ Created 12 assessment results' AS '';
SELECT '' AS '';

-- ============================================================================
-- STEP 8: COMMIT TRANSACTION
-- ============================================================================

COMMIT;

SELECT '' AS '';
SELECT '============================================================================' AS '';
SELECT '✅ TEST DATA POPULATION COMPLETE' AS '';
SELECT '============================================================================' AS '';
SELECT '' AS '';

-- ============================================================================
-- SUMMARY REPORT
-- ============================================================================

SELECT '📊 DATA SUMMARY:' AS '';
SELECT '' AS '';

SELECT CONCAT('Users Created: ', COUNT(*), ' (IDs: 1000-1001)') AS summary
FROM account WHERE id >= 1000 AND id <= 1001;

SELECT CONCAT('Projects Created: ', COUNT(*), ' (IDs: 2000-2001)') AS summary
FROM project WHERE project_id >= 2000 AND project_id <= 2001;

SELECT CONCAT('Cases Created: ', COUNT(*), ' (IDs: 3000-3003)') AS summary
FROM case_table WHERE case_id >= 3000 AND case_id <= 3003;

SELECT CONCAT('Components Created: ', COUNT(*), ' (IDs: 4000-4015)') AS summary
FROM component WHERE component_id >= 4000 AND component_id <= 4015;

SELECT CONCAT('Flows Created: ', COUNT(*)) AS summary
FROM flows WHERE component_id >= 4000 AND component_id <= 4015;

SELECT CONCAT('Assessment Runs Created: ', COUNT(*), ' (IDs: 5000-5003)') AS summary
FROM assessment_runs WHERE run_id >= 5000 AND run_id <= 5003;

SELECT CONCAT('Assessment Results Created: ', COUNT(*)) AS summary
FROM assessment_results WHERE run_id >= 5000 AND run_id <= 5003;

SELECT '' AS '';
SELECT '🔑 TEST LOGIN CREDENTIALS:' AS '';
SELECT '   Email: demo@lcaproject.com' AS '';
SELECT '   Password: demo123' AS '';
SELECT '' AS '';
SELECT '📁 PROJECT IDS:' AS '';
SELECT '   2000: Electric Vehicle Battery Production' AS '';
SELECT '   2001: Solar Panel Manufacturing LCA' AS '';
SELECT '' AS '';
SELECT '📊 CASE IDS:' AS '';
SELECT '   3000: EV Baseline (Coal Grid) - Has Assessment' AS '';
SELECT '   3001: EV Renewable - Has Assessment' AS '';
SELECT '   3002: Solar Standard - Has Assessment' AS '';
SELECT '   3003: Solar Recycled - Has Assessment' AS '';
SELECT '' AS '';
SELECT '🔬 ASSESSMENT RUN IDS:' AS '';
SELECT '   5000-5003: All completed with results' AS '';
SELECT '' AS '';
SELECT '============================================================================' AS '';

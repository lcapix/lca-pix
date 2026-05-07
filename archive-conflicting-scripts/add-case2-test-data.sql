-- LCA Project v3 - Case 2 (Comparative Case) Test Data
-- This adds complete test data for the "Renewable Energy Scenario" case
-- Run after create-test-data.sql has been executed

USE lca_v3;

-- Get the case_id for Case 2 (Renewable Energy Scenario)
SET @case2_id = (SELECT case_id FROM case_table WHERE case_name = 'Renewable Energy Scenario' LIMIT 1);

-- Verify we found the case
SELECT CONCAT('Adding test data for Case ID: ', @case2_id) as status;

-- ==============================================================================
-- COMPONENTS: Create same 5-level hierarchy as Case 1
-- ==============================================================================

-- Level 1: Product
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case2_id, NULL, 'EV Battery Pack (60 kWh)', 'product', 1, 1.0, 'unit', 'Complete lithium-ion battery pack - renewable energy production');
SET @comp6_id = LAST_INSERT_ID();

-- Level 2: Machine
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case2_id, @comp6_id, 'Cell Assembly Line', 'machine_line', 2, 1.0, 'line', 'Automated assembly line powered by renewable energy');
SET @comp7_id = LAST_INSERT_ID();

-- Level 3: Subprocess
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case2_id, @comp7_id, 'Electrode Coating Process', 'subprocess', 3, 1.0, 'batch', 'Coating electrodes with renewable energy');
SET @comp8_id = LAST_INSERT_ID();

-- Level 4: Operation
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case2_id, @comp8_id, 'Drying Operation', 'operation', 4, 1.0, 'cycle', 'High temperature drying using renewable electricity');
SET @comp9_id = LAST_INSERT_ID();

-- Level 5: Elemental (where flows are attached)
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES
(@case2_id, @comp9_id, 'Oven Heating Task', 'elemental_task', 5, 1.0, 'task', 'Electric heating powered by 100% renewable energy');
SET @comp10_id = LAST_INSERT_ID();

SELECT CONCAT('Created 5 components (IDs: ', @comp6_id, '-', @comp10_id, ')') as components_created;

-- ==============================================================================
-- FLOWS: Input and output flows for elemental component
-- Renewable energy has ~96% lower emissions than coal
-- ==============================================================================

-- Get substance IDs
SET @electricity_id = (SELECT substance_id FROM substances WHERE substance_name = 'Electricity' LIMIT 1);
SET @co2_id = (SELECT substance_id FROM substances WHERE substance_name = 'Carbon Dioxide' LIMIT 1);
SET @ch4_id = (SELECT substance_id FROM substances WHERE substance_name = 'Methane' LIMIT 1);
SET @water_id = (SELECT substance_id FROM substances WHERE substance_name = 'Water' LIMIT 1);

-- Flow 1: Electricity INPUT (same as Case 1, but from renewable sources)
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
(@comp10_id, @electricity_id, 'input', 250.5, 'kWh', TRUE, 'Electric energy consumption from 100% renewable sources (solar/wind)');

-- Flow 2: CO₂ OUTPUT (96% reduction: 125.25 → 5.0 kg)
-- Renewable energy still has some emissions from manufacturing/construction
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
(@comp10_id, @co2_id, 'output', 5.0, 'kg', TRUE, 'CO₂ emissions from renewable electricity lifecycle (manufacturing, maintenance)');

-- Flow 3: Methane OUTPUT (96% reduction: 2.5 → 0.1 kg)
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
(@comp10_id, @ch4_id, 'output', 0.1, 'kg', TRUE, 'Trace methane emissions from renewable energy infrastructure');

-- Flow 4: Water INPUT (same as Case 1)
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES
(@comp10_id, @water_id, 'input', 15.0, 'm³', FALSE, 'Process cooling water (same for both cases)');

SELECT CONCAT('Created 4 flows for component ID: ', @comp10_id) as flows_created;

-- ==============================================================================
-- ASSESSMENT RUN: Create assessment record for Case 2
-- ==============================================================================

-- Get user ID
SET @user_id = (SELECT id FROM account WHERE email = 'john@lcaproject.com' LIMIT 1);

INSERT INTO assessment_runs (case_id, run_name, calculation_method, status, executed_by, run_date) VALUES
(@case2_id, 'Q1 2025 Renewable Energy Assessment', 'CML 2001', 'completed', @user_id, '2025-01-15 14:30:00');

SET @run2_id = LAST_INSERT_ID();

SELECT CONCAT('Created assessment run ID: ', @run2_id) as assessment_created;

-- ==============================================================================
-- ASSESSMENT RESULTS: Calculate environmental impacts for Case 2
-- Results show ~96% reduction in most categories due to renewable energy
-- ==============================================================================

-- Get impact category IDs
SET @gwp_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Global Warming' LIMIT 1);
SET @odp_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Ozone Depletion' LIMIT 1);
SET @ap_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Acidification' LIMIT 1);
SET @ep_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Eutrophication' LIMIT 1);
SET @pocp_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Photochemical Oxidation' LIMIT 1);
SET @adp_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Resource Depletion' LIMIT 1);

-- Result 1: Global Warming from CO₂ (5.0 kg × 1.0 factor = 5.0 kg CO₂ eq)
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES
(@run2_id, @comp10_id, @gwp_id, 5.0, 'kg CO₂ eq');

-- Result 2: Global Warming from CH₄ (0.1 kg × 28.0 factor = 2.8 kg CO₂ eq)
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES
(@run2_id, @comp10_id, @gwp_id, 2.8, 'kg CO₂ eq');

-- Result 3: Ozone Depletion (96% reduction: 0.0425 → 0.0017)
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES
(@run2_id, @comp10_id, @odp_id, 0.0017, 'kg CFC-11 eq');

-- Result 4: Acidification (96% reduction: 87.675 → 3.5)
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES
(@run2_id, @comp10_id, @ap_id, 3.5, 'kg SO₂ eq');

-- Result 5: Eutrophication (96% reduction: 16.275 → 0.65)
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES
(@run2_id, @comp10_id, @ep_id, 0.65, 'kg PO₄ eq');

-- Result 6: Photochemical Oxidation (96% reduction: 3.50 → 0.14)
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES
(@run2_id, @comp10_id, @pocp_id, 0.14, 'kg C₂H₄ eq');

-- Result 7: Resource Depletion (90% reduction: 0.001353 → 0.000135)
-- Renewable energy uses fewer resources but still requires materials for infrastructure
INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES
(@run2_id, @comp10_id, @adp_id, 0.000135, 'kg Sb eq');

SELECT CONCAT('Created 7 assessment results for run ID: ', @run2_id) as results_created;

-- ==============================================================================
-- VERIFICATION QUERIES
-- ==============================================================================

SELECT '==== CASE 2 DATA SUMMARY ====' as section;

SELECT 'Components:' as data_type, COUNT(*) as count FROM component WHERE case_id = @case2_id;
SELECT 'Flows:' as data_type, COUNT(*) as count FROM flows WHERE component_id IN (SELECT component_id FROM component WHERE case_id = @case2_id);
SELECT 'Assessment Runs:' as data_type, COUNT(*) as count FROM assessment_runs WHERE case_id = @case2_id;
SELECT 'Assessment Results:' as data_type, COUNT(*) as count FROM assessment_results WHERE run_id = @run2_id;

-- Show the component hierarchy
SELECT '==== COMPONENT HIERARCHY ====' as section;
SELECT
    c.component_id,
    c.component_name,
    c.component_type,
    COALESCE(p.component_name, 'ROOT') as parent_name
FROM component c
LEFT JOIN component p ON c.parent_component_id = p.component_id
WHERE c.case_id = @case2_id
ORDER BY c.component_id;

-- Show total impacts by category
SELECT '==== TOTAL IMPACTS BY CATEGORY ====' as section;
SELECT
    ic.category_name,
    SUM(ar.impact_value) as total_impact,
    ar.unit
FROM assessment_results ar
JOIN impact_categories ic ON ar.category_id = ic.category_id
WHERE ar.run_id = @run2_id
GROUP BY ic.category_name, ar.unit
ORDER BY ic.category_name;

SELECT '==== CASE 2 TEST DATA COMPLETE ====' as final_status;

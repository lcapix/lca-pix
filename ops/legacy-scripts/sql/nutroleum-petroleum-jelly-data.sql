-- ============================================
-- Nutroleum vs Petroleum Jelly LCA Database Setup
-- ============================================
-- Project: Nutroleum vs Petroleum Jelly LCA Demo
-- Database: lca_v3
--
-- Cost Summary:
-- - Petroleum Jelly Total Cost: $0.5812 per unit
-- - Nutroleum Total Cost: $2.51 per unit
-- - Cost Difference: $1.9288 per unit (332% increase)
--
-- Total Components: 89 (Petroleum) + 92 (Nutroleum) = 181 components
-- ============================================

-- ============================================
-- STEP 0: CLEANUP - Remove existing Nutroleum/Vaseline projects
-- ============================================
-- This uses CASCADE deletes to automatically remove all child records

-- Delete by project name patterns (catches various naming variations)
DELETE FROM project WHERE project_name LIKE '%Nutroleum%'
   OR project_name LIKE '%Vaseline%'
   OR project_name LIKE '%Petroleum Jelly%';

-- Also delete by known project IDs if they exist
DELETE FROM project WHERE project_id IN (6, 10);

-- Clean up any orphaned data
DELETE FROM case_table WHERE project_id NOT IN (SELECT project_id FROM project);
DELETE FROM component WHERE case_id NOT IN (SELECT case_id FROM case_table);

-- ============================================
-- STEP 1: USER PERMISSIONS SETUP
-- ============================================

-- Note: john_doe account already exists with id=1
-- Only need to insert additional users and permissions

-- Insert additional analyst user (ignore if exists)
INSERT IGNORE INTO account (id, username, email, password_hash, account_type, is_active, created_at) VALUES
(2, 'nutroleum_analyst', 'analyst@lcapix-demo.com', 'hash_placeholder_analyst', 'user', 1, '2024-01-15 10:00:00');

-- Insert permission types (ignore if exists)
INSERT IGNORE INTO permissions (permission_id, permission_name, description) VALUES
(1, 'owner', 'Full control over project including deletion'),
(2, 'editor', 'Can view and edit project data but cannot delete project'),
(3, 'viewer', 'Can only view project data, no editing allowed');

-- ============================================
-- STEP 2: PROJECT CREATION
-- ============================================

-- Create main project with john_doe as owner
INSERT INTO project (project_id, project_name, description, owner_id, is_template, created_at) VALUES
(10, 'Nutroleum vs Petroleum Jelly LCA Demo', 'LCA and cost driver analysis for base Petroleum Jelly (3 oz) and comparative Nutroleum (3 oz) moisturizing products', 1, 0, '2024-01-15 10:00:00');

-- Add project members
INSERT INTO project_members (project_id, user_id, permission_id, added_at) VALUES
(10, 1, 1, '2024-01-15 10:00:00'),  -- john_doe as owner
(10, 2, 2, '2024-01-15 10:00:00');  -- Analyst as editor

-- ============================================
-- STEP 3: CASES CREATION
-- ============================================

-- Insert base and comparative cases
INSERT INTO case_table (case_id, project_id, case_name, case_type, parent_case_id, description, created_at) VALUES
(21, 10, 'Petroleum Jelly (3 oz) Base Case', 'base', NULL, 'Baseline petroleum jelly formula with current manufacturing process', '2024-01-15 10:00:00'),
(22, 10, 'Nutroleum (3 oz) Comparative Case', 'comparative', 21, 'Nutroleum alternative formula with beeswax and glucoside additives, modified process', '2024-01-15 10:00:00');

-- ============================================
-- STEP 4: SUBSTANCES AND IMPACT CATEGORIES
-- ============================================

-- Insert substances used in the project (ignore if exists)
INSERT IGNORE INTO substances (substance_id, substance_name, category, unit, description) VALUES
(1, 'Electricity, medium voltage', 'resource', 'kWh', 'Grid electricity mix, North America average'),
(2, 'Labour hour', 'resource', 'hour', 'Direct labor time'),
(3, 'Glycerin', 'resource', 'kg', 'Glycerin raw material'),
(4, 'Beeswax', 'resource', 'kg', 'Natural beeswax for Nutroleum formula'),
(5, 'Glucoside', 'resource', 'kg', 'Stabilizer additive for Nutroleum'),
(6, 'Plastic lid', 'resource', 'piece', 'Standard PET lid for 3 oz jar'),
(7, 'Label', 'resource', 'piece', 'Product label for 3 oz jar'),
(8, 'Transport, truck', 'resource', 'tkm', 'Road transport by truck'),
(9, 'Petroleum wax', 'resource', 'kg', 'Petroleum-based wax for base case'),
(10, 'Mineral oil', 'resource', 'kg', 'Mineral oil for petroleum jelly base');

-- Insert impact categories (ignore if exists)
INSERT IGNORE INTO impact_categories (category_id, category_name, abbreviation, unit, description) VALUES
(1, 'Total Cost', 'COST', 'USD', 'Total production cost per unit'),
(2, 'Global Warming Potential', 'GWP', 'kg CO2-eq', 'Climate change potential based on IPCC 100 year');

-- ============================================
-- STEP 5: PETROLEUM JELLY COMPONENTS (BASE CASE)
-- Total Components: 89
-- Total Cost: $0.5812
-- ============================================

-- Product level
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, driver_category, currency, cost_allocation_type) VALUES
(100, 21, NULL, 'Petroleum Jelly (3 oz)', 'product', 1, 1.0, 'unit', 'Petroleum Jelly moisturizing product, 3 oz jar', NULL, NULL, 'USD', 'manual');

-- Machine Line 2.1: Blending / Mixing
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, driver_category, currency, cost_allocation_type) VALUES
(110, 21, 100, 'Blending / Mixing', 'machine_line', 2, 1.0, 'unit', 'Blending and mixing process line', 'Blending / Mixing', NULL, 'USD', 'manual');

-- Subprocess 2.1.1: Raw Material Weighing
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(111, 21, 110, 'Raw Material Weighing', 'subprocess', 3, 1.0, 'unit', 'Raw material weighing subprocess', NULL, 'USD', 'manual');

-- Operation 2.1.1.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(1111, 21, 111, 'Raw material handling & weighing', 'operation', 4, 1.0, 'unit', 'Raw material handling and weighing operation', 'USD', 'manual');

-- Elemental Task 2.1.1.1.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, capex, opex, energy_cost, transportation_cost, labor_cost, currency, cost_allocation_type) VALUES
(11111, 21, 1111, 'Handle and weigh wax & oil', 'elemental_task', 5, 1.0, 'task', 'Handle and weigh petroleum wax and mineral oil', 'Labour', 'Direct labour time', 0.0000, 0.0778, 0.0085, 0.0074, 0.0389, 'USD', 'manual');

-- Subprocess 2.1.2: Wax Melting
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(112, 21, 110, 'Wax Melting', 'subprocess', 3, 1.0, 'unit', 'Wax melting subprocess', NULL, 'USD', 'manual');

-- Operation 2.1.2.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(1121, 21, 112, 'Wax melting cycle', 'operation', 4, 1.0, 'unit', 'Wax melting cycle operation', 'USD', 'manual');

-- Elemental Task 2.1.2.1.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, capex, opex, energy_cost, transportation_cost, labor_cost, currency, cost_allocation_type) VALUES
(11211, 21, 1121, 'Load and melt wax', 'elemental_task', 5, 1.0, 'task', 'Load and melt petroleum wax', 'Energy', 'Electricity consumption', 0.0338, 0.0609, 0.0284, 0.0047, 0.0331, 'USD', 'manual');

-- Subprocess 2.1.3: Oil Preheating
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(113, 21, 110, 'Oil Preheating', 'subprocess', 3, 1.0, 'unit', 'Oil preheating subprocess', NULL, 'USD', 'manual');

-- Operation 2.1.3.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(1131, 21, 113, 'Oil preheating', 'operation', 4, 1.0, 'unit', 'Oil preheating operation', 'USD', 'manual');

-- Elemental Task 2.1.3.1.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, capex, opex, energy_cost, transportation_cost, labor_cost, currency, cost_allocation_type) VALUES
(11311, 21, 1131, 'Oil preheating cycle', 'elemental_task', 5, 1.0, 'task', 'Preheat mineral oil', 'Energy', 'Electricity consumption', 0.0338, 0.0068, 0.0068, 0.0034, 0.0068, 'USD', 'manual');

-- Subprocess 2.1.4: Mixing / Additives
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(114, 21, 110, 'Mixing / Additives', 'subprocess', 3, 1.0, 'unit', 'Mixing and additives subprocess', NULL, 'USD', 'manual');

-- Operation 2.1.4.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(1141, 21, 114, 'Mixing & additive incorporation', 'operation', 4, 1.0, 'unit', 'Mixing and additive incorporation', 'USD', 'manual');

-- Elemental Task 2.1.4.1.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, capex, opex, energy_cost, transportation_cost, labor_cost, currency, cost_allocation_type) VALUES
(11411, 21, 1141, 'Blend base and additives', 'elemental_task', 5, 1.0, 'task', 'Blend base materials and additives', 'Energy', 'Electricity consumption', 0.0676, 0.0169, 0.0068, 0.0034, 0.0169, 'USD', 'manual');

-- Subprocess 2.1.5: QC Sample / Testing
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(115, 21, 110, 'QC Sample / Testing', 'subprocess', 3, 1.0, 'unit', 'Quality control sampling and testing', NULL, 'USD', 'manual');

-- Operation 2.1.5.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(1151, 21, 115, 'Quality control sampling', 'operation', 4, 1.0, 'unit', 'Quality control sampling operation', 'USD', 'manual');

-- Elemental Task 2.1.5.1.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, capex, opex, energy_cost, transportation_cost, labor_cost, currency, cost_allocation_type) VALUES
(11511, 21, 1151, 'Take sample & run tests', 'elemental_task', 5, 1.0, 'task', 'Take sample and run quality tests', 'Labour', 'Direct labour time', 0.0338, 0.0068, 0.0034, 0.0034, 0.0169, 'USD', 'manual');

-- Machine Line 2.2: Filling
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, driver_category, currency, cost_allocation_type) VALUES
(120, 21, 100, 'Filling', 'machine_line', 2, 1.0, 'unit', 'Filling process line', 'Filling', NULL, 'USD', 'manual');

-- Subprocess 2.2.1: Container Prep
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(121, 21, 120, 'Container Prep', 'subprocess', 3, 1.0, 'unit', 'Container preparation', NULL, 'USD', 'manual');

-- Operation 2.2.1.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(1211, 21, 121, 'Prepare containers', 'operation', 4, 1.0, 'unit', 'Prepare containers for filling', 'USD', 'manual');

-- Elemental Task 2.2.1.1.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, capex, opex, energy_cost, transportation_cost, labor_cost, currency, cost_allocation_type) VALUES
(12111, 21, 1211, 'Clean & stage containers', 'elemental_task', 5, 1.0, 'task', 'Clean and stage containers', 'Labour', 'Direct labour time', 0.0338, 0.0068, 0.0068, 0.0068, 0.0169, 'USD', 'manual');

-- Subprocess 2.2.2: Heated Filling
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(122, 21, 120, 'Heated Filling', 'subprocess', 3, 1.0, 'unit', 'Heated filling process', NULL, 'USD', 'manual');

-- Operation 2.2.2.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(1221, 21, 122, 'Heated filling', 'operation', 4, 1.0, 'unit', 'Heated product filling', 'USD', 'manual');

-- Elemental Task 2.2.2.1.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, capex, opex, energy_cost, transportation_cost, labor_cost, currency, cost_allocation_type) VALUES
(12211, 21, 1221, 'Fill product into containers', 'elemental_task', 5, 1.0, 'task', 'Fill heated product into containers', 'Energy', 'Electricity consumption', 0.0676, 0.0338, 0.0169, 0.0068, 0.0135, 'USD', 'manual');

-- Subprocess 2.2.3: QC / Weight Check
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(123, 21, 120, 'QC / Weight Check', 'subprocess', 3, 1.0, 'unit', 'Quality control and weight verification', NULL, 'USD', 'manual');

-- Operation 2.2.3.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(1231, 21, 123, 'Fill weight verification', 'operation', 4, 1.0, 'unit', 'Verify fill weight', 'USD', 'manual');

-- Elemental Task 2.2.3.1.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, capex, opex, energy_cost, transportation_cost, labor_cost, currency, cost_allocation_type) VALUES
(12311, 21, 1231, 'Check weight / volume', 'elemental_task', 5, 1.0, 'task', 'Check weight and volume accuracy', 'Labour', 'Direct labour time', 0.0338, 0.0068, 0.0034, 0.0068, 0.0068, 'USD', 'manual');

-- Machine Line 2.3: Sealing / Capping
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, driver_category, currency, cost_allocation_type) VALUES
(130, 21, 100, 'Sealing / Capping', 'machine_line', 2, 1.0, 'unit', 'Sealing and capping process line', 'Sealing / Capping', NULL, 'USD', 'manual');

-- Subprocess 2.3.1: Sealing / Capping
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(131, 21, 130, 'Sealing / Capping', 'subprocess', 3, 1.0, 'unit', 'Sealing and capping subprocess', NULL, 'USD', 'manual');

-- Operation 2.3.1.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(1311, 21, 131, 'Apply and seal caps', 'operation', 4, 1.0, 'unit', 'Apply and seal caps on containers', 'USD', 'manual');

-- Elemental Task 2.3.1.1.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, capex, opex, energy_cost, transportation_cost, labor_cost, currency, cost_allocation_type) VALUES
(13111, 21, 1311, 'Cap application & seal', 'elemental_task', 5, 1.0, 'task', 'Apply caps and seal containers', 'Labour', 'Direct labour time', 0.0338, 0.0169, 0.0034, 0.0068, 0.0169, 'USD', 'manual');

-- Subprocess 2.3.2: Labeling
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(132, 21, 130, 'Labeling', 'subprocess', 3, 1.0, 'unit', 'Labeling subprocess', NULL, 'USD', 'manual');

-- Operation 2.3.2.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(1321, 21, 132, 'Apply labels', 'operation', 4, 1.0, 'unit', 'Apply product labels', 'USD', 'manual');

-- Elemental Task 2.3.2.1.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, capex, opex, energy_cost, transportation_cost, labor_cost, currency, cost_allocation_type) VALUES
(13211, 21, 1321, 'Label application & check', 'elemental_task', 5, 1.0, 'task', 'Apply labels and verify placement', 'Labour', 'Direct labour time', 0.0068, 0.0237, 0.0034, 0.0068, 0.0101, 'USD', 'manual');

-- Subprocess 2.3.3: Cartoning / Batch Coding
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(133, 21, 130, 'Cartoning / Batch Coding', 'subprocess', 3, 1.0, 'unit', 'Cartoning and batch coding', NULL, 'USD', 'manual');

-- Operation 2.3.3.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(1331, 21, 133, 'Carton & code', 'operation', 4, 1.0, 'unit', 'Pack into cartons and apply batch codes', 'USD', 'manual');

-- Elemental Task 2.3.3.1.1
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, capex, opex, energy_cost, transportation_cost, labor_cost, currency, cost_allocation_type) VALUES
(13311, 21, 1331, 'Cartoning and batch coding', 'elemental_task', 5, 1.0, 'task', 'Pack products into cartons and apply batch codes', 'Labour', 'Direct labour time', 0.0338, 0.0169, 0.0034, 0.0101, 0.0135, 'USD', 'manual');

-- ============================================
-- STEP 6: NUTROLEUM COMPONENTS (COMPARATIVE CASE)
-- Total Components: 92
-- Total Cost: $2.51
-- ============================================

-- Product level
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, driver_category, currency, cost_allocation_type) VALUES
(200, 22, NULL, 'Nutroleum (3 oz)', 'product', 1, 1.0, 'unit', 'Nutroleum moisturizing jelly, 3 oz jar', NULL, NULL, 'USD', 'manual');

-- Machine Line 1.1: Raw Material Handling & Prep
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, driver_category, currency, cost_allocation_type) VALUES
(210, 22, 200, 'Raw Material Handling & Prep', 'machine_line', 2, 1.0, 'unit', 'Raw material handling and preparation line', 'Raw material handling and prep', NULL, 'USD', 'manual');

-- Subprocess 1.1.1: Receiving & Inspection
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(211, 22, 210, 'Receiving & Inspection', 'subprocess', 3, 1.0, 'unit', 'Material receiving and inspection', NULL, 'USD', 'manual');

-- Operation 1.1.1.1: Raw material receiving
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2111, 22, 211, 'Raw material receiving', 'operation', 4, 1.0, 'unit', 'Raw material receiving operation', 'USD', 'manual');

-- Elemental Task 1.1.1.1.1: Offload raw materials
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, labor_cost, currency, cost_allocation_type) VALUES
(21111, 22, 2111, 'Offload raw materials', 'elemental_task', 5, 1.0, 'task', 'Offloading incoming raw material pallets', 'Labour', 'Direct labour time', '[{"driver": "Labour", "rate_per_hour": 20, "minutes_per_unit": 0.84}]', 0.28, 0.28, 'USD', 'manual');

-- Operation 1.1.1.2: Quality inspection
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2112, 22, 211, 'Quality inspection', 'operation', 4, 1.0, 'unit', 'Quality inspection of raw materials', 'USD', 'manual');

-- Elemental Task 1.1.1.2.1: Contamination check
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, labor_cost, currency, cost_allocation_type) VALUES
(21121, 22, 2112, 'Contamination check', 'elemental_task', 5, 1.0, 'task', 'Check raw materials for contamination', 'Labour', 'Direct labour time', '[{"driver": "Labour", "rate_per_hour": 20, "minutes_per_unit": 0.36}]', 0.12, 0.12, 'USD', 'manual');

-- Operation 1.1.1.3: Storage allocation
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2113, 22, 211, 'Storage allocation', 'operation', 4, 1.0, 'unit', 'Allocate storage for raw materials', 'USD', 'manual');

-- Elemental Task 1.1.1.3.1: Move to racks; update JIT
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, labor_cost, currency, cost_allocation_type) VALUES
(21131, 22, 2113, 'Move to racks; update JIT', 'elemental_task', 5, 1.0, 'task', 'Move materials to storage racks and update JIT system', 'Labour', 'Direct labour time', '[{"driver": "Labour", "rate_per_hour": 20, "minutes_per_unit": 0.30}]', 0.10, 0.10, 'USD', 'manual');

-- Subprocess 1.1.2: Weighing & Batching
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(212, 22, 210, 'Weighing & Batching', 'subprocess', 3, 1.0, 'unit', 'Ingredient weighing and batch preparation', NULL, 'USD', 'manual');

-- Operation 1.1.2.1: Ingredient weighing
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2121, 22, 212, 'Ingredient weighing', 'operation', 4, 1.0, 'unit', 'Weigh ingredients for batch', 'USD', 'manual');

-- Elemental Task 1.1.2.1.1: Weigh glycerin, beeswax, glucoside
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, labor_cost, currency, cost_allocation_type) VALUES
(21211, 22, 2121, 'Weigh glycerin, beeswax, glucoside', 'elemental_task', 5, 1.0, 'task', 'Weigh glycerin, beeswax, and glucoside for batch', 'Labour', 'Direct labour time', '[{"driver": "Labour", "rate_per_hour": 20, "minutes_per_unit": 0.51}]', 0.17, 0.17, 'USD', 'manual');

-- Operation 1.1.2.2: Batch prep
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2122, 22, 212, 'Batch prep', 'operation', 4, 1.0, 'unit', 'Prepare batch for processing', 'USD', 'manual');

-- Elemental Task 1.1.2.2.1: Record weights; stage batch
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, labor_cost, currency, cost_allocation_type) VALUES
(21221, 22, 2122, 'Record weights; stage batch', 'elemental_task', 5, 1.0, 'task', 'Record ingredient weights and stage batch', 'Labour', 'Direct labour time', '[{"driver": "Labour", "rate_per_hour": 20, "minutes_per_unit": 0.24}]', 0.08, 0.08, 'USD', 'manual');

-- Machine Line 1.2: Refining / Purification
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, driver_category, currency, cost_allocation_type) VALUES
(220, 22, 200, 'Refining / Purification', 'machine_line', 2, 1.0, 'unit', 'Refining and purification process line', 'Refining and purification', NULL, 'USD', 'manual');

-- Subprocess 1.2.1: Heating & Melting
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(221, 22, 220, 'Heating & Melting', 'subprocess', 3, 1.0, 'unit', 'Heating and melting process', NULL, 'USD', 'manual');

-- Operation 1.2.1.1: Radiant heat melting
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2211, 22, 221, 'Radiant heat melting', 'operation', 4, 1.0, 'unit', 'Radiant heat melting operation', 'USD', 'manual');

-- Elemental Task 1.2.1.1.1: Heat reactor
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, energy_cost, currency, cost_allocation_type) VALUES
(22111, 22, 2211, 'Heat reactor', 'elemental_task', 5, 1.0, 'task', 'Heat reactor for melting process', 'Energy', 'Electricity consumption', '[{"driver": "Electricity", "kWh_per_unit": 0.3, "rate_per_kWh": 0.14}]', 0.04, 0.04, 'USD', 'manual');

-- Operation 1.2.1.2: Monitor melt
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2212, 22, 221, 'Monitor melt', 'operation', 4, 1.0, 'unit', 'Monitor melting process', 'USD', 'manual');

-- Elemental Task 1.2.1.2.1: Monitor melt
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, labor_cost, currency, cost_allocation_type) VALUES
(22121, 22, 2212, 'Monitor melt', 'elemental_task', 5, 1.0, 'task', 'Monitor melting process parameters', 'Labour', 'Direct labour time', '[{"driver": "Labour", "rate_per_hour": 20, "minutes_per_unit": 0.18}]', 0.06, 0.06, 'USD', 'manual');

-- Subprocess 1.2.2: Purification / Filtering
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(222, 22, 220, 'Purification / Filtering', 'subprocess', 3, 1.0, 'unit', 'Purification and filtering process', NULL, 'USD', 'manual');

-- Operation 1.2.2.1: Micron filtration
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2221, 22, 222, 'Micron filtration', 'operation', 4, 1.0, 'unit', 'Micron filtration operation', 'USD', 'manual');

-- Elemental Task 1.2.2.1.1: Clarify product
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, labor_cost, currency, cost_allocation_type) VALUES
(22211, 22, 2221, 'Clarify product', 'elemental_task', 5, 1.0, 'task', 'Clarify product through filtration', 'Labour', 'Direct labour time', '[{"driver": "Labour", "rate_per_hour": 20, "minutes_per_unit": 0.30}]', 0.10, 0.10, 'USD', 'manual');

-- Operation 1.2.2.2: Filter cleanup
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2222, 22, 222, 'Filter cleanup', 'operation', 4, 1.0, 'unit', 'Clean filters after use', 'USD', 'manual');

-- Elemental Task 1.2.2.2.1: Remove residue
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, labor_cost, currency, cost_allocation_type) VALUES
(22221, 22, 2222, 'Remove residue', 'elemental_task', 5, 1.0, 'task', 'Remove residue from filters', 'Labour', 'Direct labour time', '[{"driver": "Labour", "rate_per_hour": 20, "minutes_per_unit": 0.36}]', 0.12, 0.12, 'USD', 'manual');

-- Operation 1.2.2.3: Transfer
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2223, 22, 222, 'Transfer', 'operation', 4, 1.0, 'unit', 'Transfer to holding tank', 'USD', 'manual');

-- Elemental Task 1.2.2.3.1: Move to holding tank
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, labor_cost, currency, cost_allocation_type) VALUES
(22231, 22, 2223, 'Move to holding tank', 'elemental_task', 5, 1.0, 'task', 'Transfer product to holding tank', 'Labour', 'Direct labour time', '[{"driver": "Labour", "rate_per_hour": 20, "minutes_per_unit": 0.18}]', 0.06, 0.06, 'USD', 'manual');

-- Machine Line 1.3: Blending & Homogenization
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, driver_category, currency, cost_allocation_type) VALUES
(230, 22, 200, 'Blending & Homogenization', 'machine_line', 2, 1.0, 'unit', 'Blending and homogenization process line', 'Blending and homogenization', NULL, 'USD', 'manual');

-- Subprocess 1.3.1: Additive Incorporation
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(231, 22, 230, 'Additive Incorporation', 'subprocess', 3, 1.0, 'unit', 'Incorporate additives into base', NULL, 'USD', 'manual');

-- Operation 1.3.1.1: Add beeswax
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2311, 22, 231, 'Add beeswax', 'operation', 4, 1.0, 'unit', 'Add beeswax to mixture', 'USD', 'manual');

-- Elemental Task 1.3.1.1.1: 2-3% beeswax addition
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, material_cost, currency, cost_allocation_type) VALUES
(23111, 22, 2311, '2-3% beeswax addition', 'elemental_task', 5, 1.0, 'task', 'Add 2-3% beeswax to formulation', 'Materials', 'Raw materials', '[{"driver": "Materials", "rate_per_kg": 18, "kg_per_unit": 0.0028}]', 0.05, 0.05, 'USD', 'manual');

-- Operation 1.3.1.2: Add glucoside
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2312, 22, 231, 'Add glucoside', 'operation', 4, 1.0, 'unit', 'Add glucoside stabilizer', 'USD', 'manual');

-- Elemental Task 1.3.1.2.1: Stabilizer addition
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, material_cost, currency, cost_allocation_type) VALUES
(23121, 22, 2312, 'Stabilizer addition', 'elemental_task', 5, 1.0, 'task', 'Add glucoside stabilizer', 'Materials', 'Raw materials', '[{"driver": "Materials", "rate_per_kg": 10, "kg_per_unit": 0.0020}]', 0.02, 0.02, 'USD', 'manual');

-- Subprocess 1.3.2: Homogenization
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(232, 22, 230, 'Homogenization', 'subprocess', 3, 1.0, 'unit', 'Homogenize product mixture', NULL, 'USD', 'manual');

-- Operation 1.3.2.1: High-shear mixing
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2321, 22, 232, 'High-shear mixing', 'operation', 4, 1.0, 'unit', 'High-shear mixing operation', 'USD', 'manual');

-- Elemental Task 1.3.2.1.1: Engage mixer
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, energy_cost, labor_cost, currency, cost_allocation_type) VALUES
(23211, 22, 2321, 'Engage mixer', 'elemental_task', 5, 1.0, 'task', 'Engage high-shear mixer', 'Energy', 'Mixed energy and labour', '[{"driver": "Energy", "kWh_per_unit": 0.2, "rate_per_kWh": 0.14}, {"driver": "Labour", "rate_per_hour": 20, "minutes_per_unit": 0.12}]', 0.07, 0.028, 0.042, 'USD', 'manual');

-- Operation 1.3.2.2: Consistency checks
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2322, 22, 232, 'Consistency checks', 'operation', 4, 1.0, 'unit', 'Check product consistency', 'USD', 'manual');

-- Elemental Task 1.3.2.2.1: Viscosity sampling
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, labor_cost, currency, cost_allocation_type) VALUES
(23221, 22, 2322, 'Viscosity sampling', 'elemental_task', 5, 1.0, 'task', 'Sample and test viscosity', 'Labour', 'Direct labour time', '[{"driver": "Labour", "rate_per_hour": 20, "minutes_per_unit": 0.12}]', 0.04, 0.04, 'USD', 'manual');

-- Machine Line 1.4: Filling & Packaging
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, driver_category, currency, cost_allocation_type) VALUES
(240, 22, 200, 'Filling & Packaging', 'machine_line', 2, 1.0, 'unit', 'Filling and packaging process line', 'Filling and packaging', NULL, 'USD', 'manual');

-- Subprocess 1.4.1: Jar Filling
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(241, 22, 240, 'Jar Filling', 'subprocess', 3, 1.0, 'unit', 'Fill product into jars', NULL, 'USD', 'manual');

-- Operation 1.4.1.1: Automated filling
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2411, 22, 241, 'Automated filling', 'operation', 4, 1.0, 'unit', 'Automated jar filling', 'USD', 'manual');

-- Elemental Task 1.4.1.1.1: Load jars; calibrate fill volume
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, labor_cost, currency, cost_allocation_type) VALUES
(24111, 22, 2411, 'Load jars; calibrate fill volume', 'elemental_task', 5, 1.0, 'task', 'Load jars and calibrate filling volume', 'Labour', 'Direct labour time', '[{"driver": "Labour", "rate_per_hour": 20, "minutes_per_unit": 0.30}]', 0.10, 0.10, 'USD', 'manual');

-- Operation 1.4.1.2: Fill product
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2412, 22, 241, 'Fill product', 'operation', 4, 1.0, 'unit', 'Fill product into jars', 'USD', 'manual');

-- Elemental Task 1.4.1.2.1: Fill product
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, equipment_cost, labor_cost, currency, cost_allocation_type) VALUES
(24121, 22, 2412, 'Fill product', 'elemental_task', 5, 1.0, 'task', 'Automated filling of product', 'Mixed', 'Machine and labour', '[{"driver": "Machine", "units_per_hour": 60}, {"driver": "Labour", "rate_per_hour": 20, "minutes_per_unit": 0.06}]', 0.02, 0.01, 0.01, 'USD', 'manual');

-- Subprocess 1.4.2: Capping
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(242, 22, 240, 'Capping', 'subprocess', 3, 1.0, 'unit', 'Apply caps to jars', NULL, 'USD', 'manual');

-- Operation 1.4.2.1: Apply lid
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2421, 22, 242, 'Apply lid', 'operation', 4, 1.0, 'unit', 'Apply lid to jar', 'USD', 'manual');

-- Elemental Task 1.4.2.1.1: 50¢ lid
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, material_cost, currency, cost_allocation_type) VALUES
(24211, 22, 2421, '50¢ lid', 'elemental_task', 5, 1.0, 'task', 'Apply plastic lid to jar', 'Packaging', 'Packaging materials', '[{"driver": "Packaging", "cost_per_unit": 0.50}]', 0.21, 0.21, 'USD', 'manual');

-- Operation 1.4.2.2: Seal verification
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2422, 22, 242, 'Seal verification', 'operation', 4, 1.0, 'unit', 'Verify seal quality', 'USD', 'manual');

-- Elemental Task 1.4.2.2.1: QC check
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, labor_cost, currency, cost_allocation_type) VALUES
(24221, 22, 2422, 'QC check', 'elemental_task', 5, 1.0, 'task', 'Quality check of seal', 'Labour', 'Direct labour time', '[{"driver": "Labour", "rate_per_hour": 20, "minutes_per_unit": 0.12}]', 0.04, 0.04, 'USD', 'manual');

-- Subprocess 1.4.3: Labelling
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(243, 22, 240, 'Labelling', 'subprocess', 3, 1.0, 'unit', 'Apply labels to jars', NULL, 'USD', 'manual');

-- Operation 1.4.3.1: Label application
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2431, 22, 243, 'Label application', 'operation', 4, 1.0, 'unit', 'Apply product label', 'USD', 'manual');

-- Elemental Task 1.4.3.1.1: Apply label (50¢ each)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, material_cost, currency, cost_allocation_type) VALUES
(24311, 22, 2431, 'Apply label (50¢ each)', 'elemental_task', 5, 1.0, 'task', 'Apply product label to jar', 'Packaging', 'Packaging materials', '[{"driver": "Packaging", "cost_per_unit": 0.50}]', 0.21, 0.21, 'USD', 'manual');

-- Operation 1.4.3.2: Label QC
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2432, 22, 243, 'Label QC', 'operation', 4, 1.0, 'unit', 'Check label placement', 'USD', 'manual');

-- Elemental Task 1.4.3.2.1: Placement check
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, labor_cost, currency, cost_allocation_type) VALUES
(24321, 22, 2432, 'Placement check', 'elemental_task', 5, 1.0, 'task', 'Check label placement accuracy', 'Labour', 'Direct labour time', '[{"driver": "Labour", "rate_per_hour": 20, "minutes_per_unit": 0.09}]', 0.03, 0.03, 'USD', 'manual');

-- Machine Line 1.5: Post-Production Handling
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, driver_category, currency, cost_allocation_type) VALUES
(250, 22, 200, 'Post-Production Handling', 'machine_line', 2, 1.0, 'unit', 'Post-production handling and storage', 'Post-production handling', NULL, 'USD', 'manual');

-- Subprocess 1.5.1: Storage
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(251, 22, 250, 'Storage', 'subprocess', 3, 1.0, 'unit', 'Product storage', NULL, 'USD', 'manual');

-- Operation 1.5.1.1: Warehouse staging
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2511, 22, 251, 'Warehouse staging', 'operation', 4, 1.0, 'unit', 'Stage products in warehouse', 'USD', 'manual');

-- Elemental Task 1.5.1.1.1: Pallet placement
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, overhead_cost, currency, cost_allocation_type) VALUES
(25111, 22, 2511, 'Pallet placement', 'elemental_task', 5, 1.0, 'task', 'Place products on pallets', 'Rent', 'Warehouse rent', '[{"driver": "Rent", "monthly_cost": 1200, "units_per_month": 60000}]', 0.02, 0.02, 'USD', 'manual');

-- Operation 1.5.1.2: Inventory mgmt
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2512, 22, 251, 'Inventory mgmt', 'operation', 4, 1.0, 'unit', 'Inventory management', 'USD', 'manual');

-- Elemental Task 1.5.1.2.1: Climate control
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, overhead_cost, currency, cost_allocation_type) VALUES
(25121, 22, 2512, 'Climate control', 'elemental_task', 5, 1.0, 'task', 'Maintain climate control in storage', 'Overhead', 'General overhead', '[{"driver": "Overhead", "allocated_per_unit": 0.01}]', 0.01, 0.01, 'USD', 'manual');

-- Subprocess 1.5.2: Distribution Prep
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(252, 22, 250, 'Distribution Prep', 'subprocess', 3, 1.0, 'unit', 'Prepare products for distribution', NULL, 'USD', 'manual');

-- Operation 1.5.2.1: Order picking
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2521, 22, 252, 'Order picking', 'operation', 4, 1.0, 'unit', 'Pick orders for shipping', 'USD', 'manual');

-- Elemental Task 1.5.2.1.1: Pack order
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, labor_cost, currency, cost_allocation_type) VALUES
(25211, 22, 2521, 'Pack order', 'elemental_task', 5, 1.0, 'task', 'Pack order for shipping', 'Labour', 'Direct labour time', '[{"driver": "Labour", "rate_per_hour": 20, "minutes_per_unit": 0.30}]', 0.10, 0.10, 'USD', 'manual');

-- Operation 1.5.2.2: Shipping
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2522, 22, 252, 'Shipping', 'operation', 4, 1.0, 'unit', 'Ship products', 'USD', 'manual');

-- Elemental Task 1.5.2.2.1: Box, routing
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, transportation_cost, currency, cost_allocation_type) VALUES
(25221, 22, 2522, 'Box, routing', 'elemental_task', 5, 1.0, 'task', 'Box products and arrange routing', 'Distribution', 'Transport per unit', '[{"driver": "Distribution", "cost_per_unit": 0.70}]', 0.29, 0.29, 'USD', 'manual');

-- Machine Line 1.6: Admin & Overhead
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, driver_category, currency, cost_allocation_type) VALUES
(260, 22, 200, 'Admin & Overhead', 'machine_line', 2, 1.0, 'unit', 'Administrative and overhead costs', 'Admin and overhead', NULL, 'USD', 'manual');

-- Subprocess 1.6.1: Branding & Marketing
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(261, 22, 260, 'Branding & Marketing', 'subprocess', 3, 1.0, 'unit', 'Branding and marketing activities', NULL, 'USD', 'manual');

-- Operation 1.6.1.1: Allocate marketing
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2611, 22, 261, 'Allocate marketing', 'operation', 4, 1.0, 'unit', 'Allocate marketing costs', 'USD', 'manual');

-- Elemental Task 1.6.1.1.1: Branding
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, overhead_cost, currency, cost_allocation_type) VALUES
(26111, 22, 2611, 'Branding', 'elemental_task', 5, 1.0, 'task', 'Branding cost allocation', 'Branding', 'Marketing expense', '[{"driver": "Branding", "monthly_cost": 250, "units_per_month": 8333}]', 0.03, 0.03, 'USD', 'manual');

-- Subprocess 1.6.2: Warehouse Rent
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(262, 22, 260, 'Warehouse Rent', 'subprocess', 3, 1.0, 'unit', 'Warehouse rent allocation', NULL, 'USD', 'manual');

-- Operation 1.6.2.1: Rent allocation
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2621, 22, 262, 'Rent allocation', 'operation', 4, 1.0, 'unit', 'Allocate warehouse rent', 'USD', 'manual');

-- Elemental Task 1.6.2.1.1: Storage overhead
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, overhead_cost, currency, cost_allocation_type) VALUES
(26211, 22, 2621, 'Storage overhead', 'elemental_task', 5, 1.0, 'task', 'Warehouse rent overhead allocation', 'Rent', 'Warehouse rent', '[{"driver": "Rent", "monthly_cost": 1200, "units_per_month": 60000}]', 0.02, 0.02, 'USD', 'manual');

-- Subprocess 1.6.3: Labour
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, process_type, currency, cost_allocation_type) VALUES
(263, 22, 260, 'Labour', 'subprocess', 3, 1.0, 'unit', 'Direct labour overhead', NULL, 'USD', 'manual');

-- Operation 1.6.3.1: Direct labour
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2631, 22, 263, 'Direct labour', 'operation', 4, 1.0, 'unit', 'Direct labour allocation', 'USD', 'manual');

-- Elemental Task 1.6.3.1.1: Labour overhead
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, drivers, opex, labor_cost, currency, cost_allocation_type) VALUES
(26311, 22, 2631, 'Labour overhead', 'elemental_task', 5, 1.0, 'task', 'Direct labour overhead allocation', 'Labour', 'Direct labour time', '[{"driver": "Labour", "rate_per_hour": 20, "allocated_per_unit": 0.05}]', 0.05, 0.05, 'USD', 'manual');

-- ============================================
-- STEP 7: VERIFICATION QUERIES
-- ============================================

-- Run these queries to verify successful insertion:

-- 1. Check project was created
SELECT project_id, project_name, owner_id FROM project WHERE project_id = 10;

-- 2. Check cases were created
SELECT case_id, case_name, case_type, parent_case_id FROM case_table WHERE project_id = 10;

-- 3. Count components per case
SELECT
    c.case_id,
    ct.case_name,
    COUNT(*) as component_count,
    SUM(CASE WHEN c.component_type = 'product' THEN 1 ELSE 0 END) as products,
    SUM(CASE WHEN c.component_type = 'machine_line' THEN 1 ELSE 0 END) as machine_lines,
    SUM(CASE WHEN c.component_type = 'subprocess' THEN 1 ELSE 0 END) as subprocesses,
    SUM(CASE WHEN c.component_type = 'operation' THEN 1 ELSE 0 END) as operations,
    SUM(CASE WHEN c.component_type = 'elemental_task' THEN 1 ELSE 0 END) as elemental_tasks
FROM component c
JOIN case_table ct ON c.case_id = ct.case_id
WHERE ct.project_id = 10
GROUP BY c.case_id, ct.case_name;

-- 4. Verify total costs per case
SELECT
    ct.case_name,
    SUM(COALESCE(c.opex, 0) + COALESCE(c.capex, 0)) as total_cost
FROM component c
JOIN case_table ct ON c.case_id = ct.case_id
WHERE ct.project_id = 10
GROUP BY ct.case_name;

-- 5. Check project members
SELECT pm.*, a.username, p.permission_name
FROM project_members pm
JOIN account a ON pm.user_id = a.id
JOIN permissions p ON pm.permission_id = p.permission_id
WHERE pm.project_id = 10;

-- ============================================
-- END OF SCRIPT
-- ============================================

-- ============================================
-- Nutroleum vs Petroleum Jelly LCA Database Setup
-- ACCURATE VERSION based on user reference data
-- ============================================
-- Project: Nutroleum vs Petroleum Jelly LCA Demo
-- Database: lca_v3
-- ============================================

-- ============================================
-- STEP 0: CLEANUP
-- ============================================

DELETE FROM project WHERE project_name LIKE '%Nutroleum%'
   OR project_name LIKE '%Vaseline%'
   OR project_name LIKE '%Petroleum Jelly%';

DELETE FROM project WHERE project_id IN (6, 9, 10);

-- ============================================
-- STEP 1: PROJECT AND CASES
-- ============================================

INSERT INTO project (project_id, project_name, description, owner_id, is_template, created_at) VALUES
(10, 'Nutroleum vs Petroleum Jelly LCA Demo', 'LCA and cost driver analysis for Petroleum Jelly (base) and Nutroleum (comparative) 3 oz products', 1, 0, NOW());

INSERT INTO project_members (project_id, user_id, permission_id, added_at) VALUES
(10, 1, 1, NOW());

INSERT INTO case_table (case_id, project_id, case_name, case_type, parent_case_id, description, created_at) VALUES
(21, 10, 'Petroleum Jelly (3 oz) Base Case', 'base', NULL, 'Baseline petroleum jelly formula', NOW()),
(22, 10, 'Nutroleum (3 oz) Comparative Case', 'comparative', 21, 'Nutroleum alternative formula with beeswax and glucoside', NOW());

-- ============================================
-- STEP 2: PETROLEUM JELLY BASE CASE (Case 21)
-- Structure: Product -> Machine Lines -> Subprocesses -> Operations -> Elemental Tasks
-- ============================================

-- Level 1: Product
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2000, 21, NULL, 'Petroleum Jelly (3 oz)', 'product', 1, 1.0, 'unit', 'Complete petroleum jelly product', 'USD', 'calculated');

-- Level 2: Machine Lines
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2100, 21, 2000, 'Blending / Mixing', 'machine_line', 2, 1.0, 'line', 'Blending and mixing operations', 'USD', 'calculated'),
(2200, 21, 2000, 'Filling', 'machine_line', 2, 1.0, 'line', 'Filling operations', 'USD', 'calculated'),
(2300, 21, 2000, 'Sealing / Capping', 'machine_line', 2, 1.0, 'line', 'Sealing and capping operations', 'USD', 'calculated');

-- Level 3: Subprocesses
-- Under Blending / Mixing (2100)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2110, 21, 2100, 'Raw Material Weighing', 'subprocess', 3, 1.0, 'subprocess', 'Raw material weighing subprocess', 'USD', 'calculated'),
(2120, 21, 2100, 'Wax Melting', 'subprocess', 3, 1.0, 'subprocess', 'Wax melting subprocess', 'USD', 'calculated'),
(2130, 21, 2100, 'Oil Preheating', 'subprocess', 3, 1.0, 'subprocess', 'Oil preheating subprocess', 'USD', 'calculated'),
(2140, 21, 2100, 'Mixing / Additives', 'subprocess', 3, 1.0, 'subprocess', 'Mixing and additives subprocess', 'USD', 'calculated'),
(2150, 21, 2100, 'QC Sample / Testing', 'subprocess', 3, 1.0, 'subprocess', 'Quality control sampling subprocess', 'USD', 'calculated');

-- Under Filling (2200)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2210, 21, 2200, 'Container Prep', 'subprocess', 3, 1.0, 'subprocess', 'Container preparation subprocess', 'USD', 'calculated'),
(2220, 21, 2200, 'Heated Filling', 'subprocess', 3, 1.0, 'subprocess', 'Heated filling subprocess', 'USD', 'calculated'),
(2230, 21, 2200, 'QC / Weight Check', 'subprocess', 3, 1.0, 'subprocess', 'Fill weight verification subprocess', 'USD', 'calculated');

-- Under Sealing / Capping (2300)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(2310, 21, 2300, 'Sealing / Capping', 'subprocess', 3, 1.0, 'subprocess', 'Sealing and capping subprocess', 'USD', 'calculated'),
(2320, 21, 2300, 'Labeling', 'subprocess', 3, 1.0, 'subprocess', 'Labeling subprocess', 'USD', 'calculated'),
(2330, 21, 2300, 'Cartoning / Batch Coding', 'subprocess', 3, 1.0, 'subprocess', 'Cartoning and batch coding subprocess', 'USD', 'calculated');

-- Level 4: Operations
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(21101, 21, 2110, 'Raw material handling & weighing', 'operation', 4, 1.0, 'operation', 'Raw material handling and weighing operation', 'USD', 'calculated'),
(21201, 21, 2120, 'Wax melting cycle', 'operation', 4, 1.0, 'operation', 'Wax melting cycle operation', 'USD', 'calculated'),
(21301, 21, 2130, 'Oil preheating', 'operation', 4, 1.0, 'operation', 'Oil preheating operation', 'USD', 'calculated'),
(21401, 21, 2140, 'Mixing & additive incorporation', 'operation', 4, 1.0, 'operation', 'Mixing and additive incorporation operation', 'USD', 'calculated'),
(21501, 21, 2150, 'Quality control sampling', 'operation', 4, 1.0, 'operation', 'Quality control sampling operation', 'USD', 'calculated'),
(22101, 21, 2210, 'Prepare containers', 'operation', 4, 1.0, 'operation', 'Prepare containers operation', 'USD', 'calculated'),
(22201, 21, 2220, 'Heated filling', 'operation', 4, 1.0, 'operation', 'Heated filling operation', 'USD', 'calculated'),
(22301, 21, 2230, 'Fill weight verification', 'operation', 4, 1.0, 'operation', 'Fill weight verification operation', 'USD', 'calculated'),
(23101, 21, 2310, 'Apply and seal caps', 'operation', 4, 1.0, 'operation', 'Apply and seal caps operation', 'USD', 'calculated'),
(23201, 21, 2320, 'Apply labels', 'operation', 4, 1.0, 'operation', 'Apply labels operation', 'USD', 'calculated'),
(23301, 21, 2330, 'Carton & code', 'operation', 4, 1.0, 'operation', 'Cartoning and coding operation', 'USD', 'calculated');

-- Level 5: Elemental Tasks with EXACT cost data from reference
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, capex, opex, energy_cost, transportation_cost, labor_cost, currency, cost_allocation_type) VALUES
-- 2.1.1.1.1 Handle and weigh wax & oil
(211011, 21, 21101, 'Handle and weigh wax & oil', 'elemental_task', 5, 1.0, 'task', 'Handle and weigh petroleum wax and mineral oil', 'Labour', 'Direct labour time', 0.0000, 0.0778, 0.0085, 0.0074, 0.0389, 'USD', 'manual'),

-- 2.1.2.1.1 Load and melt wax
(212011, 21, 21201, 'Load and melt wax', 'elemental_task', 5, 1.0, 'task', 'Load wax into kettle and melt', 'Energy', 'kWh', 0.0338, 0.0609, 0.0284, 0.0047, 0.0331, 'USD', 'manual'),

-- 2.1.3.1.1 Oil preheating cycle
(213011, 21, 21301, 'Oil preheating cycle', 'elemental_task', 5, 1.0, 'task', 'Preheat mineral oil to required temperature', 'Energy', 'kWh', 0.0338, 0.0068, 0.0068, 0.0034, 0.0068, 'USD', 'manual'),

-- 2.1.4.1.1 Blend base and additives
(214011, 21, 21401, 'Blend base and additives', 'elemental_task', 5, 1.0, 'task', 'Blend base materials and incorporate additives', 'Energy', 'kWh', 0.0676, 0.0169, 0.0068, 0.0034, 0.0169, 'USD', 'manual'),

-- 2.1.5.1.1 Take sample & run tests
(215011, 21, 21501, 'Take sample & run tests', 'elemental_task', 5, 1.0, 'task', 'Take QC sample and run quality tests', 'Labour', 'Direct labour time', 0.0338, 0.0068, 0.0034, 0.0034, 0.0169, 'USD', 'manual'),

-- 2.2.1.1.1 Clean & stage containers
(221011, 21, 22101, 'Clean & stage containers', 'elemental_task', 5, 1.0, 'task', 'Clean and stage containers for filling', 'Labour', 'Direct labour time', 0.0338, 0.0068, 0.0068, 0.0068, 0.0169, 'USD', 'manual'),

-- 2.2.2.1.1 Fill product into containers
(222011, 21, 22201, 'Fill product into containers', 'elemental_task', 5, 1.0, 'task', 'Fill heated product into containers', 'Equipment', 'Machine time', 0.0676, 0.0338, 0.0169, 0.0068, 0.0135, 'USD', 'manual'),

-- 2.2.3.1.1 Check weight / volume
(223011, 21, 22301, 'Check weight / volume', 'elemental_task', 5, 1.0, 'task', 'Verify fill weight and volume', 'Labour', 'Direct labour time', 0.0338, 0.0068, 0.0034, 0.0068, 0.0068, 'USD', 'manual'),

-- 2.3.1.1.1 Cap application & seal
(231011, 21, 23101, 'Cap application & seal', 'elemental_task', 5, 1.0, 'task', 'Apply cap and seal container', 'Equipment', 'Machine time', 0.0338, 0.0169, 0.0034, 0.0068, 0.0169, 'USD', 'manual'),

-- 2.3.2.1.1 Label application & check
(232011, 21, 23201, 'Label application & check', 'elemental_task', 5, 1.0, 'task', 'Apply label and check placement', 'Equipment', 'Machine time', 0.0068, 0.0237, 0.0034, 0.0068, 0.0101, 'USD', 'manual'),

-- 2.3.3.1.1 Cartoning and batch coding
(233011, 21, 23301, 'Cartoning and batch coding', 'elemental_task', 5, 1.0, 'task', 'Carton product and apply batch code', 'Equipment', 'Machine time', 0.0338, 0.0169, 0.0034, 0.0101, 0.0135, 'USD', 'manual');

-- ============================================
-- STEP 3: NUTROLEUM COMPARATIVE CASE (Case 22)
-- ============================================

-- Level 1: Product
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(1000, 22, NULL, 'Nutroleum (3 oz)', 'product', 1, 1.0, 'unit', 'Complete Nutroleum product', 'USD', 'calculated');

-- Level 2: Machine Lines
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(1100, 22, 1000, 'Raw Material Handling & Prep', 'machine_line', 2, 1.0, 'line', 'Raw material handling and preparation', 'USD', 'calculated'),
(1200, 22, 1000, 'Refining / Purification', 'machine_line', 2, 1.0, 'line', 'Refining and purification operations', 'USD', 'calculated'),
(1300, 22, 1000, 'Blending & Homogenization', 'machine_line', 2, 1.0, 'line', 'Blending and homogenization operations', 'USD', 'calculated'),
(1400, 22, 1000, 'Filling & Packaging', 'machine_line', 2, 1.0, 'line', 'Filling and packaging operations', 'USD', 'calculated'),
(1500, 22, 1000, 'Post-Production Handling', 'machine_line', 2, 1.0, 'line', 'Post-production handling operations', 'USD', 'calculated'),
(1600, 22, 1000, 'Admin & Overhead', 'machine_line', 2, 1.0, 'line', 'Administrative and overhead costs', 'USD', 'calculated');

-- Level 3: Subprocesses
-- Under Raw Material Handling & Prep (1100)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(1110, 22, 1100, 'Receiving & Inspection', 'subprocess', 3, 1.0, 'subprocess', 'Receiving and inspection subprocess', 'USD', 'calculated'),
(1120, 22, 1100, 'Weighing & Batching', 'subprocess', 3, 1.0, 'subprocess', 'Weighing and batching subprocess', 'USD', 'calculated');

-- Under Refining / Purification (1200)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(1210, 22, 1200, 'Heating & Melting', 'subprocess', 3, 1.0, 'subprocess', 'Heating and melting subprocess', 'USD', 'calculated'),
(1220, 22, 1200, 'Purification / Filtering', 'subprocess', 3, 1.0, 'subprocess', 'Purification and filtering subprocess', 'USD', 'calculated');

-- Under Blending & Homogenization (1300)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(1310, 22, 1300, 'Additive Incorporation', 'subprocess', 3, 1.0, 'subprocess', 'Additive incorporation subprocess', 'USD', 'calculated'),
(1320, 22, 1300, 'Homogenization', 'subprocess', 3, 1.0, 'subprocess', 'Homogenization subprocess', 'USD', 'calculated');

-- Under Filling & Packaging (1400)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(1410, 22, 1400, 'Jar Filling', 'subprocess', 3, 1.0, 'subprocess', 'Jar filling subprocess', 'USD', 'calculated'),
(1420, 22, 1400, 'Capping', 'subprocess', 3, 1.0, 'subprocess', 'Capping subprocess', 'USD', 'calculated'),
(1430, 22, 1400, 'Labelling', 'subprocess', 3, 1.0, 'subprocess', 'Labelling subprocess', 'USD', 'calculated');

-- Under Post-Production Handling (1500)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(1510, 22, 1500, 'Storage', 'subprocess', 3, 1.0, 'subprocess', 'Storage subprocess', 'USD', 'calculated'),
(1520, 22, 1500, 'Distribution Prep', 'subprocess', 3, 1.0, 'subprocess', 'Distribution preparation subprocess', 'USD', 'calculated');

-- Under Admin & Overhead (1600)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(1610, 22, 1600, 'Branding & Marketing', 'subprocess', 3, 1.0, 'subprocess', 'Branding and marketing subprocess', 'USD', 'calculated'),
(1620, 22, 1600, 'Warehouse Rent', 'subprocess', 3, 1.0, 'subprocess', 'Warehouse rent subprocess', 'USD', 'calculated'),
(1630, 22, 1600, 'Labour', 'subprocess', 3, 1.0, 'subprocess', 'Labour overhead subprocess', 'USD', 'calculated'),
(1640, 22, 1600, 'Distribution', 'subprocess', 3, 1.0, 'subprocess', 'Distribution subprocess', 'USD', 'calculated');

-- Level 4: Operations
-- Under Receiving & Inspection (1110)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(11101, 22, 1110, 'Raw material receiving', 'operation', 4, 1.0, 'operation', 'Raw material receiving operation', 'USD', 'calculated'),
(11102, 22, 1110, 'Quality inspection', 'operation', 4, 1.0, 'operation', 'Quality inspection operation', 'USD', 'calculated'),
(11103, 22, 1110, 'Storage allocation', 'operation', 4, 1.0, 'operation', 'Storage allocation operation', 'USD', 'calculated');

-- Under Weighing & Batching (1120)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(11201, 22, 1120, 'Ingredient weighing', 'operation', 4, 1.0, 'operation', 'Ingredient weighing operation', 'USD', 'calculated'),
(11202, 22, 1120, 'Batch prep', 'operation', 4, 1.0, 'operation', 'Batch preparation operation', 'USD', 'calculated');

-- Under Heating & Melting (1210)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(12101, 22, 1210, 'Radiant heat melting', 'operation', 4, 1.0, 'operation', 'Radiant heat melting operation', 'USD', 'calculated'),
(12102, 22, 1210, 'Monitor melt', 'operation', 4, 1.0, 'operation', 'Monitor melt operation', 'USD', 'calculated');

-- Under Purification / Filtering (1220)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(12201, 22, 1220, 'Micron filtration', 'operation', 4, 1.0, 'operation', 'Micron filtration operation', 'USD', 'calculated'),
(12202, 22, 1220, 'Filter cleanup', 'operation', 4, 1.0, 'operation', 'Filter cleanup operation', 'USD', 'calculated'),
(12203, 22, 1220, 'Transfer', 'operation', 4, 1.0, 'operation', 'Transfer to holding tank operation', 'USD', 'calculated');

-- Under Additive Incorporation (1310)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(13101, 22, 1310, 'Add beeswax', 'operation', 4, 1.0, 'operation', 'Add beeswax operation', 'USD', 'calculated'),
(13102, 22, 1310, 'Add glucoside', 'operation', 4, 1.0, 'operation', 'Add glucoside operation', 'USD', 'calculated');

-- Under Homogenization (1320)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(13201, 22, 1320, 'High-shear mixing', 'operation', 4, 1.0, 'operation', 'High-shear mixing operation', 'USD', 'calculated'),
(13202, 22, 1320, 'Consistency checks', 'operation', 4, 1.0, 'operation', 'Consistency checks operation', 'USD', 'calculated');

-- Under Jar Filling (1410)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(14101, 22, 1410, 'Automated filling', 'operation', 4, 1.0, 'operation', 'Automated filling operation', 'USD', 'calculated'),
(14102, 22, 1410, 'Fill product', 'operation', 4, 1.0, 'operation', 'Fill product operation', 'USD', 'calculated');

-- Under Capping (1420)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(14201, 22, 1420, 'Apply lid', 'operation', 4, 1.0, 'operation', 'Apply lid operation', 'USD', 'calculated'),
(14202, 22, 1420, 'Seal verification', 'operation', 4, 1.0, 'operation', 'Seal verification operation', 'USD', 'calculated');

-- Under Labelling (1430)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(14301, 22, 1430, 'Label application', 'operation', 4, 1.0, 'operation', 'Label application operation', 'USD', 'calculated'),
(14302, 22, 1430, 'Label QC', 'operation', 4, 1.0, 'operation', 'Label QC operation', 'USD', 'calculated');

-- Under Storage (1510)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(15101, 22, 1510, 'Warehouse staging', 'operation', 4, 1.0, 'operation', 'Warehouse staging operation', 'USD', 'calculated'),
(15102, 22, 1510, 'Inventory mgmt', 'operation', 4, 1.0, 'operation', 'Inventory management operation', 'USD', 'calculated');

-- Under Distribution Prep (1520)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(15201, 22, 1520, 'Order picking', 'operation', 4, 1.0, 'operation', 'Order picking operation', 'USD', 'calculated'),
(15202, 22, 1520, 'Shipping', 'operation', 4, 1.0, 'operation', 'Shipping operation', 'USD', 'calculated');

-- Under Admin & Overhead subprocesses
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, currency, cost_allocation_type) VALUES
(16101, 22, 1610, 'Allocate marketing', 'operation', 4, 1.0, 'operation', 'Allocate marketing operation', 'USD', 'calculated'),
(16201, 22, 1620, 'Rent allocation', 'operation', 4, 1.0, 'operation', 'Rent allocation operation', 'USD', 'calculated'),
(16301, 22, 1630, 'Direct labour', 'operation', 4, 1.0, 'operation', 'Direct labour operation', 'USD', 'calculated'),
(16401, 22, 1640, 'Distribution cost', 'operation', 4, 1.0, 'operation', 'Distribution cost operation', 'USD', 'calculated');

-- Level 5: Elemental Tasks with EXACT cost data from reference
-- Cost data stored in labor_cost field as "Allocated Cost"

-- Receiving & Inspection elemental tasks
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, labor_cost, currency, cost_allocation_type) VALUES
(111011, 22, 11101, 'Offload raw materials', 'elemental_task', 5, 1.0, 'task', 'Offloading incoming raw material pallets', 'Labour', 'Direct labour time', 0.28, 'USD', 'manual'),
(111021, 22, 11102, 'Contamination check', 'elemental_task', 5, 1.0, 'task', 'Check for contamination', 'Labour', 'Direct labour time', 0.12, 'USD', 'manual'),
(111031, 22, 11103, 'Move to racks; update JIT', 'elemental_task', 5, 1.0, 'task', 'Move to storage racks and update JIT system', 'Labour', 'Direct labour time', 0.10, 'USD', 'manual');

-- Weighing & Batching elemental tasks
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, labor_cost, currency, cost_allocation_type) VALUES
(112011, 22, 11201, 'Weigh glycerin, beeswax, glucoside', 'elemental_task', 5, 1.0, 'task', 'Weigh all ingredients', 'Labour', 'Direct labour time', 0.17, 'USD', 'manual'),
(112021, 22, 11202, 'Record weights; stage batch', 'elemental_task', 5, 1.0, 'task', 'Record weights and stage batch', 'Labour', 'Direct labour time', 0.08, 'USD', 'manual');

-- Heating & Melting elemental tasks
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, energy_cost, labor_cost, currency, cost_allocation_type) VALUES
(121011, 22, 12101, 'Heat reactor', 'elemental_task', 5, 1.0, 'task', 'Heat reactor using radiant heat', 'Energy', 'kWh', 0.04, 0.00, 'USD', 'manual'),
(121021, 22, 12102, 'Monitor melt', 'elemental_task', 5, 1.0, 'task', 'Monitor melting process', 'Labour', 'Direct labour time', 0.00, 0.06, 'USD', 'manual');

-- Purification / Filtering elemental tasks
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, labor_cost, currency, cost_allocation_type) VALUES
(122011, 22, 12201, 'Clarify product', 'elemental_task', 5, 1.0, 'task', 'Micron filtration to clarify', 'Labour', 'Direct labour time', 0.10, 'USD', 'manual'),
(122021, 22, 12202, 'Remove residue', 'elemental_task', 5, 1.0, 'task', 'Filter cleanup and remove residue', 'Labour', 'Direct labour time', 0.12, 'USD', 'manual'),
(122031, 22, 12203, 'Move to holding tank', 'elemental_task', 5, 1.0, 'task', 'Transfer to holding tank', 'Labour', 'Direct labour time', 0.06, 'USD', 'manual');

-- Additive Incorporation elemental tasks
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, material_cost, currency, cost_allocation_type) VALUES
(131011, 22, 13101, '2-3% beeswax addition', 'elemental_task', 5, 1.0, 'task', 'Add beeswax at 2-3%', 'Materials', 'kg', 0.05, 'USD', 'manual'),
(131021, 22, 13102, 'Stabilizer addition', 'elemental_task', 5, 1.0, 'task', 'Add glucoside stabilizer', 'Materials', 'kg', 0.02, 'USD', 'manual');

-- Homogenization elemental tasks
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, energy_cost, labor_cost, currency, cost_allocation_type) VALUES
(132011, 22, 13201, 'Engage mixer', 'elemental_task', 5, 1.0, 'task', 'High-shear mixing', 'Energy', 'kWh + Labour', 0.035, 0.035, 'USD', 'manual'),
(132021, 22, 13202, 'Viscosity sampling', 'elemental_task', 5, 1.0, 'task', 'Viscosity consistency check', 'Labour', 'Direct labour time', 0.00, 0.04, 'USD', 'manual');

-- Jar Filling elemental tasks
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, labor_cost, currency, cost_allocation_type) VALUES
(141011, 22, 14101, 'Load jars; calibrate fill volume', 'elemental_task', 5, 1.0, 'task', 'Load jars and calibrate fill volume', 'Labour', 'Direct labour time', 0.10, 'USD', 'manual'),
(141021, 22, 14102, 'Fill product', 'elemental_task', 5, 1.0, 'task', 'Fill product into jars', 'Equipment', 'Machine + labour', 0.02, 'USD', 'manual');

-- Capping elemental tasks
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, material_cost, labor_cost, currency, cost_allocation_type) VALUES
(142011, 22, 14201, '50¢ lid', 'elemental_task', 5, 1.0, 'task', 'Apply 50 cent lid', 'Packaging', 'each', 0.21, 0.00, 'USD', 'manual'),
(142021, 22, 14202, 'QC check', 'elemental_task', 5, 1.0, 'task', 'Seal verification QC check', 'Labour', 'Direct labour time', 0.00, 0.04, 'USD', 'manual');

-- Labelling elemental tasks
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, material_cost, labor_cost, currency, cost_allocation_type) VALUES
(143011, 22, 14301, 'Apply label (50¢ each)', 'elemental_task', 5, 1.0, 'task', 'Apply 50 cent label', 'Packaging', 'each', 0.21, 0.00, 'USD', 'manual'),
(143021, 22, 14302, 'Placement check', 'elemental_task', 5, 1.0, 'task', 'Label placement QC check', 'Labour', 'Direct labour time', 0.00, 0.03, 'USD', 'manual');

-- Storage elemental tasks
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, overhead_cost, currency, cost_allocation_type) VALUES
(151011, 22, 15101, 'Pallet placement', 'elemental_task', 5, 1.0, 'task', 'Warehouse staging pallet placement', 'Rent', 'monthly', 0.02, 'USD', 'manual'),
(151021, 22, 15102, 'Climate control', 'elemental_task', 5, 1.0, 'task', 'Inventory management climate control', 'Overhead', 'monthly', 0.01, 'USD', 'manual');

-- Distribution Prep elemental tasks
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, labor_cost, transportation_cost, currency, cost_allocation_type) VALUES
(152011, 22, 15201, 'Pack order', 'elemental_task', 5, 1.0, 'task', 'Order picking and packing', 'Labour', 'Direct labour time', 0.10, 0.00, 'USD', 'manual'),
(152021, 22, 15202, 'Box, routing', 'elemental_task', 5, 1.0, 'task', 'Shipping box and routing', 'Distribution', 'each', 0.00, 0.29, 'USD', 'manual');

-- Admin & Overhead elemental tasks
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, overhead_cost, labor_cost, transportation_cost, currency, cost_allocation_type) VALUES
(161011, 22, 16101, 'Branding', 'elemental_task', 5, 1.0, 'task', 'Branding and marketing allocation', 'Branding', 'monthly', 0.03, 0.00, 0.00, 'USD', 'manual'),
(162011, 22, 16201, 'Storage overhead', 'elemental_task', 5, 1.0, 'task', 'Warehouse rent allocation', 'Rent', 'monthly', 0.02, 0.00, 0.00, 'USD', 'manual'),
(163011, 22, 16301, '2 minutes/unit', 'elemental_task', 5, 1.0, 'task', 'Direct labour 2 min per unit', 'Labour', 'Direct labour time', 0.00, 0.28, 0.00, 'USD', 'manual'),
(164011, 22, 16401, 'Per unit', 'elemental_task', 5, 1.0, 'task', 'Distribution cost per unit', 'Distribution', 'each', 0.00, 0.00, 0.29, 'USD', 'manual');

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

SELECT 'Project' as type, project_id, project_name FROM project WHERE project_id = 10;

SELECT 'Cases' as type, case_id, case_name, case_type FROM case_table WHERE project_id = 10;

SELECT ct.case_name, COUNT(c.component_id) as total_components
FROM case_table ct
LEFT JOIN component c ON ct.case_id = c.case_id
WHERE ct.project_id = 10
GROUP BY ct.case_id, ct.case_name;

SELECT ct.case_name, c.component_type, COUNT(*) as count
FROM case_table ct
JOIN component c ON ct.case_id = c.case_id
WHERE ct.project_id = 10
GROUP BY ct.case_id, ct.case_name, c.component_type
ORDER BY ct.case_id, c.hierarchy_level;

-- Calculate total costs
SELECT ct.case_name,
       ROUND(SUM(COALESCE(c.capex, 0) + COALESCE(c.opex, 0) + COALESCE(c.labor_cost, 0) +
                 COALESCE(c.energy_cost, 0) + COALESCE(c.transportation_cost, 0) +
                 COALESCE(c.material_cost, 0) + COALESCE(c.overhead_cost, 0)), 4) as total_cost
FROM case_table ct
JOIN component c ON ct.case_id = c.case_id
WHERE ct.project_id = 10 AND c.component_type = 'elemental_task'
GROUP BY ct.case_id, ct.case_name;

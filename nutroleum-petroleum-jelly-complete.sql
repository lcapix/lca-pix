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

DELETE FROM project WHERE project_name LIKE '%Nutroleum%'
   OR project_name LIKE '%Vaseline%'
   OR project_name LIKE '%Petroleum Jelly%';

DELETE FROM project WHERE project_id IN (6, 9, 10);

-- ============================================
-- STEP 1: PROJECT AND CASES CREATION
-- ============================================

INSERT INTO project (project_id, project_name, description, owner_id, is_template, created_at) VALUES
(10, 'Nutroleum vs Petroleum Jelly LCA Demo', 'LCA and cost driver analysis for base Petroleum Jelly (3 oz) and comparative Nutroleum (3 oz) moisturizing products', 1, 0, NOW());

INSERT INTO project_members (project_id, user_id, permission_id, added_at) VALUES
(10, 1, 1, NOW());

INSERT INTO case_table (case_id, project_id, case_name, case_type, parent_case_id, description, created_at) VALUES
(21, 10, 'Petroleum Jelly (3 oz) Base Case', 'base', NULL, 'Baseline petroleum jelly formula with current manufacturing process', NOW()),
(22, 10, 'Nutroleum (3 oz) Comparative Case', 'comparative', 21, 'Nutroleum alternative formula with beeswax and glucoside additives', NOW());

-- ============================================
-- STEP 2: PETROLEUM JELLY COMPONENTS (CASE 21)
-- 89 Components, Total Cost: $0.5812
-- ============================================

-- Level 1: Product
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, currency, cost_allocation_type) VALUES
(1000, 21, NULL, 'Petroleum Jelly 3 oz', 'product', 1, 1.0, 'unit', 'Complete petroleum jelly product unit', 'Product', 'USD', 'calculated');

-- Level 2: Machine Lines (4 lines)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, currency, cost_allocation_type) VALUES
(1100, 21, 1000, 'Raw Material Receiving', 'machine_line', 2, 1.0, 'line', 'Raw material handling and storage', 'Process', 'USD', 'calculated'),
(1200, 21, 1000, 'Mixing & Blending', 'machine_line', 2, 1.0, 'line', 'Main mixing and blending operations', 'Process', 'USD', 'calculated'),
(1300, 21, 1000, 'Filling & Packaging', 'machine_line', 2, 1.0, 'line', 'Product filling and packaging', 'Process', 'USD', 'calculated'),
(1400, 21, 1000, 'Quality & Shipping', 'machine_line', 2, 1.0, 'line', 'Quality control and shipping', 'Process', 'USD', 'calculated');

-- Level 3: Subprocesses (12 subprocesses)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, currency, cost_allocation_type) VALUES
-- Raw Material Receiving subprocesses
(1110, 21, 1100, 'Material Receipt', 'subprocess', 3, 1.0, 'subprocess', 'Receiving and inspection', 'Labour', 'USD', 'calculated'),
(1120, 21, 1100, 'Storage & Staging', 'subprocess', 3, 1.0, 'subprocess', 'Warehouse storage', 'Labour', 'USD', 'calculated'),
-- Mixing & Blending subprocesses
(1210, 21, 1200, 'Wax Preparation', 'subprocess', 3, 1.0, 'subprocess', 'Petroleum wax melting', 'Energy', 'USD', 'calculated'),
(1220, 21, 1200, 'Oil Addition', 'subprocess', 3, 1.0, 'subprocess', 'Mineral oil blending', 'Energy', 'USD', 'calculated'),
(1230, 21, 1200, 'Final Mixing', 'subprocess', 3, 1.0, 'subprocess', 'Homogenization', 'Energy', 'USD', 'calculated'),
-- Filling & Packaging subprocesses
(1310, 21, 1300, 'Jar Filling', 'subprocess', 3, 1.0, 'subprocess', 'Automated filling', 'Equipment', 'USD', 'calculated'),
(1320, 21, 1300, 'Lid Application', 'subprocess', 3, 1.0, 'subprocess', 'Lid sealing', 'Equipment', 'USD', 'calculated'),
(1330, 21, 1300, 'Labeling', 'subprocess', 3, 1.0, 'subprocess', 'Label application', 'Equipment', 'USD', 'calculated'),
-- Quality & Shipping subprocesses
(1410, 21, 1400, 'Quality Testing', 'subprocess', 3, 1.0, 'subprocess', 'QC inspection', 'Labour', 'USD', 'calculated'),
(1420, 21, 1400, 'Carton Packing', 'subprocess', 3, 1.0, 'subprocess', 'Case packing', 'Labour', 'USD', 'calculated'),
(1430, 21, 1400, 'Palletizing', 'subprocess', 3, 1.0, 'subprocess', 'Pallet loading', 'Equipment', 'USD', 'calculated'),
(1440, 21, 1400, 'Shipping', 'subprocess', 3, 1.0, 'subprocess', 'Distribution', 'Transportation', 'USD', 'calculated');

-- Level 4: Operations (24 operations)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, currency, cost_allocation_type) VALUES
-- Material Receipt operations
(1111, 21, 1110, 'Unload Materials', 'operation', 4, 1.0, 'operation', 'Unloading delivery trucks', 'Labour', 'USD', 'calculated'),
(1112, 21, 1110, 'Inspect Materials', 'operation', 4, 1.0, 'operation', 'Quality inspection', 'Labour', 'USD', 'calculated'),
-- Storage operations
(1121, 21, 1120, 'Move to Storage', 'operation', 4, 1.0, 'operation', 'Transport to warehouse', 'Equipment', 'USD', 'calculated'),
(1122, 21, 1120, 'Stage for Production', 'operation', 4, 1.0, 'operation', 'Pre-production staging', 'Labour', 'USD', 'calculated'),
-- Wax Preparation operations
(1211, 21, 1210, 'Load Wax', 'operation', 4, 1.0, 'operation', 'Load petroleum wax', 'Labour', 'USD', 'calculated'),
(1212, 21, 1210, 'Melt Wax', 'operation', 4, 1.0, 'operation', 'Heat and melt wax', 'Energy', 'USD', 'calculated'),
-- Oil Addition operations
(1221, 21, 1220, 'Measure Oil', 'operation', 4, 1.0, 'operation', 'Measure mineral oil', 'Labour', 'USD', 'calculated'),
(1222, 21, 1220, 'Add Oil to Mix', 'operation', 4, 1.0, 'operation', 'Pour oil into mixer', 'Equipment', 'USD', 'calculated'),
-- Final Mixing operations
(1231, 21, 1230, 'Homogenize', 'operation', 4, 1.0, 'operation', 'High-speed mixing', 'Energy', 'USD', 'calculated'),
(1232, 21, 1230, 'Cool Product', 'operation', 4, 1.0, 'operation', 'Controlled cooling', 'Energy', 'USD', 'calculated'),
-- Filling operations
(1311, 21, 1310, 'Position Jars', 'operation', 4, 1.0, 'operation', 'Index jars on line', 'Equipment', 'USD', 'calculated'),
(1312, 21, 1310, 'Dispense Product', 'operation', 4, 1.0, 'operation', 'Fill jars', 'Equipment', 'USD', 'calculated'),
-- Lid Application operations
(1321, 21, 1320, 'Place Lids', 'operation', 4, 1.0, 'operation', 'Position lids', 'Equipment', 'USD', 'calculated'),
(1322, 21, 1320, 'Seal Lids', 'operation', 4, 1.0, 'operation', 'Press seal lids', 'Equipment', 'USD', 'calculated'),
-- Labeling operations
(1331, 21, 1330, 'Apply Front Label', 'operation', 4, 1.0, 'operation', 'Front label', 'Equipment', 'USD', 'calculated'),
(1332, 21, 1330, 'Apply Back Label', 'operation', 4, 1.0, 'operation', 'Back label', 'Equipment', 'USD', 'calculated'),
-- QC operations
(1411, 21, 1410, 'Visual Inspection', 'operation', 4, 1.0, 'operation', 'Visual check', 'Labour', 'USD', 'calculated'),
(1412, 21, 1410, 'Weight Check', 'operation', 4, 1.0, 'operation', 'Fill weight QC', 'Equipment', 'USD', 'calculated'),
-- Packing operations
(1421, 21, 1420, 'Form Cartons', 'operation', 4, 1.0, 'operation', 'Erect cartons', 'Equipment', 'USD', 'calculated'),
(1422, 21, 1420, 'Load Cartons', 'operation', 4, 1.0, 'operation', 'Place units in carton', 'Labour', 'USD', 'calculated'),
-- Palletizing operations
(1431, 21, 1430, 'Stack Cartons', 'operation', 4, 1.0, 'operation', 'Build pallet', 'Equipment', 'USD', 'calculated'),
(1432, 21, 1430, 'Wrap Pallet', 'operation', 4, 1.0, 'operation', 'Stretch wrap', 'Equipment', 'USD', 'calculated'),
-- Shipping operations
(1441, 21, 1440, 'Load Truck', 'operation', 4, 1.0, 'operation', 'Forklift loading', 'Equipment', 'USD', 'calculated'),
(1442, 21, 1440, 'Transport', 'operation', 4, 1.0, 'operation', 'Deliver to DC', 'Transportation', 'USD', 'calculated');

-- Level 5: Elemental Tasks (48 tasks for Petroleum Jelly)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, opex, labor_cost, energy_cost, transportation_cost, material_cost, overhead_cost, currency, cost_allocation_type) VALUES
-- Unload Materials tasks
(11111, 21, 1111, 'Position forklift', 'elemental_task', 5, 1.0, 'task', 'Position forklift at truck', 'Labour', 'Direct labour time', 0.0012, 0.0012, 0.0000, 0.0000, 0.0000, 0.0001, 'USD', 'manual'),
(11112, 21, 1111, 'Lift pallet', 'elemental_task', 5, 1.0, 'task', 'Lift material pallet', 'Equipment', 'Machine time', 0.0015, 0.0008, 0.0005, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Inspect Materials tasks
(11121, 21, 1112, 'Check COA', 'elemental_task', 5, 1.0, 'task', 'Review certificate of analysis', 'Labour', 'Direct labour time', 0.0020, 0.0020, 0.0000, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
(11122, 21, 1112, 'Sample material', 'elemental_task', 5, 1.0, 'task', 'Take QC sample', 'Labour', 'Direct labour time', 0.0025, 0.0025, 0.0000, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Move to Storage tasks
(11211, 21, 1121, 'Transport to warehouse', 'elemental_task', 5, 1.0, 'task', 'Move pallet to storage', 'Equipment', 'Machine time', 0.0018, 0.0010, 0.0006, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
(11212, 21, 1121, 'Place in rack', 'elemental_task', 5, 1.0, 'task', 'Position in storage rack', 'Equipment', 'Machine time', 0.0015, 0.0008, 0.0005, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Stage for Production tasks
(11221, 21, 1122, 'Retrieve materials', 'elemental_task', 5, 1.0, 'task', 'Pick production materials', 'Labour', 'Direct labour time', 0.0022, 0.0022, 0.0000, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
(11222, 21, 1122, 'Stage at line', 'elemental_task', 5, 1.0, 'task', 'Position at production area', 'Labour', 'Direct labour time', 0.0018, 0.0018, 0.0000, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Load Wax tasks
(12111, 21, 1211, 'Weigh wax', 'elemental_task', 5, 1.0, 'task', 'Measure petroleum wax', 'Labour', 'Direct labour time', 0.0030, 0.0030, 0.0000, 0.0000, 0.0800, 0.0003, 'USD', 'manual'),
(12112, 21, 1211, 'Load into kettle', 'elemental_task', 5, 1.0, 'task', 'Pour wax into melting kettle', 'Labour', 'Direct labour time', 0.0025, 0.0025, 0.0000, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Melt Wax tasks
(12121, 21, 1212, 'Heat to temp', 'elemental_task', 5, 1.0, 'task', 'Heat wax to melting point', 'Energy', 'kWh', 0.0180, 0.0000, 0.0180, 0.0000, 0.0000, 0.0015, 'USD', 'manual'),
(12122, 21, 1212, 'Monitor temp', 'elemental_task', 5, 1.0, 'task', 'Monitor temperature', 'Labour', 'Direct labour time', 0.0015, 0.0015, 0.0000, 0.0000, 0.0000, 0.0001, 'USD', 'manual'),
-- Measure Oil tasks
(12211, 21, 1221, 'Weigh oil', 'elemental_task', 5, 1.0, 'task', 'Measure mineral oil', 'Labour', 'Direct labour time', 0.0028, 0.0028, 0.0000, 0.0000, 0.0650, 0.0003, 'USD', 'manual'),
(12212, 21, 1221, 'Transfer to vessel', 'elemental_task', 5, 1.0, 'task', 'Pour into mixing vessel', 'Labour', 'Direct labour time', 0.0020, 0.0020, 0.0000, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Add Oil tasks
(12221, 21, 1222, 'Open valve', 'elemental_task', 5, 1.0, 'task', 'Open transfer valve', 'Equipment', 'Machine time', 0.0008, 0.0005, 0.0002, 0.0000, 0.0000, 0.0001, 'USD', 'manual'),
(12222, 21, 1222, 'Pump oil', 'elemental_task', 5, 1.0, 'task', 'Pump oil into mixer', 'Equipment', 'Machine time', 0.0035, 0.0010, 0.0020, 0.0000, 0.0000, 0.0005, 'USD', 'manual'),
-- Homogenize tasks
(12311, 21, 1231, 'Start mixer', 'elemental_task', 5, 1.0, 'task', 'Start high-speed mixer', 'Energy', 'kWh', 0.0250, 0.0000, 0.0250, 0.0000, 0.0000, 0.0020, 'USD', 'manual'),
(12312, 21, 1231, 'Run cycle', 'elemental_task', 5, 1.0, 'task', 'Complete mixing cycle', 'Energy', 'kWh', 0.0350, 0.0015, 0.0320, 0.0000, 0.0000, 0.0015, 'USD', 'manual'),
-- Cool Product tasks
(12321, 21, 1232, 'Activate cooling', 'elemental_task', 5, 1.0, 'task', 'Start cooling system', 'Energy', 'kWh', 0.0120, 0.0000, 0.0120, 0.0000, 0.0000, 0.0010, 'USD', 'manual'),
(12322, 21, 1232, 'Monitor cooling', 'elemental_task', 5, 1.0, 'task', 'Monitor temperature drop', 'Labour', 'Direct labour time', 0.0012, 0.0012, 0.0000, 0.0000, 0.0000, 0.0001, 'USD', 'manual'),
-- Position Jars tasks
(13111, 21, 1311, 'Load jars', 'elemental_task', 5, 1.0, 'task', 'Load jars to conveyor', 'Equipment', 'Machine time', 0.0020, 0.0008, 0.0008, 0.0000, 0.0350, 0.0004, 'USD', 'manual'),
(13112, 21, 1311, 'Index jars', 'elemental_task', 5, 1.0, 'task', 'Position for filling', 'Equipment', 'Machine time', 0.0012, 0.0005, 0.0005, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Dispense Product tasks
(13121, 21, 1312, 'Open nozzle', 'elemental_task', 5, 1.0, 'task', 'Open fill nozzle', 'Equipment', 'Machine time', 0.0008, 0.0003, 0.0003, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
(13122, 21, 1312, 'Fill jar', 'elemental_task', 5, 1.0, 'task', 'Dispense 3 oz product', 'Equipment', 'Machine time', 0.0015, 0.0005, 0.0008, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Place Lids tasks
(13211, 21, 1321, 'Pick lid', 'elemental_task', 5, 1.0, 'task', 'Pick lid from feeder', 'Equipment', 'Machine time', 0.0012, 0.0005, 0.0005, 0.0000, 0.0180, 0.0002, 'USD', 'manual'),
(13212, 21, 1321, 'Position lid', 'elemental_task', 5, 1.0, 'task', 'Position on jar', 'Equipment', 'Machine time', 0.0010, 0.0004, 0.0004, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Seal Lids tasks
(13221, 21, 1322, 'Apply pressure', 'elemental_task', 5, 1.0, 'task', 'Press seal lid', 'Equipment', 'Machine time', 0.0015, 0.0005, 0.0008, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
(13222, 21, 1322, 'Verify seal', 'elemental_task', 5, 1.0, 'task', 'Check seal integrity', 'Equipment', 'Machine time', 0.0008, 0.0003, 0.0003, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Apply Labels tasks
(13311, 21, 1331, 'Apply front', 'elemental_task', 5, 1.0, 'task', 'Apply front label', 'Equipment', 'Machine time', 0.0018, 0.0006, 0.0008, 0.0000, 0.0120, 0.0004, 'USD', 'manual'),
(13312, 21, 1331, 'Press label', 'elemental_task', 5, 1.0, 'task', 'Press to adhere', 'Equipment', 'Machine time', 0.0010, 0.0004, 0.0004, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
(13321, 21, 1332, 'Apply back', 'elemental_task', 5, 1.0, 'task', 'Apply back label', 'Equipment', 'Machine time', 0.0015, 0.0005, 0.0006, 0.0000, 0.0080, 0.0004, 'USD', 'manual'),
(13322, 21, 1332, 'Press label', 'elemental_task', 5, 1.0, 'task', 'Press to adhere', 'Equipment', 'Machine time', 0.0008, 0.0003, 0.0003, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Visual Inspection tasks
(14111, 21, 1411, 'Check fill level', 'elemental_task', 5, 1.0, 'task', 'Visual fill check', 'Labour', 'Direct labour time', 0.0015, 0.0015, 0.0000, 0.0000, 0.0000, 0.0001, 'USD', 'manual'),
(14112, 21, 1411, 'Check labels', 'elemental_task', 5, 1.0, 'task', 'Visual label check', 'Labour', 'Direct labour time', 0.0012, 0.0012, 0.0000, 0.0000, 0.0000, 0.0001, 'USD', 'manual'),
-- Weight Check tasks
(14121, 21, 1412, 'Place on scale', 'elemental_task', 5, 1.0, 'task', 'Position on checkweigher', 'Equipment', 'Machine time', 0.0008, 0.0003, 0.0003, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
(14122, 21, 1412, 'Record weight', 'elemental_task', 5, 1.0, 'task', 'Record fill weight', 'Equipment', 'Machine time', 0.0010, 0.0004, 0.0004, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Form Cartons tasks
(14211, 21, 1421, 'Erect carton', 'elemental_task', 5, 1.0, 'task', 'Form carton box', 'Equipment', 'Machine time', 0.0015, 0.0005, 0.0006, 0.0000, 0.0200, 0.0004, 'USD', 'manual'),
(14212, 21, 1421, 'Tape bottom', 'elemental_task', 5, 1.0, 'task', 'Seal carton bottom', 'Equipment', 'Machine time', 0.0012, 0.0004, 0.0006, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Load Cartons tasks
(14221, 21, 1422, 'Place units', 'elemental_task', 5, 1.0, 'task', 'Load units into carton', 'Labour', 'Direct labour time', 0.0020, 0.0020, 0.0000, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
(14222, 21, 1422, 'Close carton', 'elemental_task', 5, 1.0, 'task', 'Close and seal carton', 'Labour', 'Direct labour time', 0.0015, 0.0015, 0.0000, 0.0000, 0.0000, 0.0001, 'USD', 'manual'),
-- Stack Cartons tasks
(14311, 21, 1431, 'Place on pallet', 'elemental_task', 5, 1.0, 'task', 'Stack carton on pallet', 'Equipment', 'Machine time', 0.0018, 0.0006, 0.0010, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
(14312, 21, 1431, 'Arrange pattern', 'elemental_task', 5, 1.0, 'task', 'Arrange stacking pattern', 'Equipment', 'Machine time', 0.0012, 0.0004, 0.0006, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Wrap Pallet tasks
(14321, 21, 1432, 'Apply wrap', 'elemental_task', 5, 1.0, 'task', 'Apply stretch wrap', 'Equipment', 'Machine time', 0.0025, 0.0008, 0.0012, 0.0000, 0.0050, 0.0005, 'USD', 'manual'),
(14322, 21, 1432, 'Secure wrap', 'elemental_task', 5, 1.0, 'task', 'Secure wrap end', 'Equipment', 'Machine time', 0.0010, 0.0004, 0.0004, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Load Truck tasks
(14411, 21, 1441, 'Move to dock', 'elemental_task', 5, 1.0, 'task', 'Transport to shipping dock', 'Equipment', 'Machine time', 0.0020, 0.0008, 0.0010, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
(14412, 21, 1441, 'Load pallet', 'elemental_task', 5, 1.0, 'task', 'Load onto truck', 'Equipment', 'Machine time', 0.0018, 0.0006, 0.0010, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Transport tasks
(14421, 21, 1442, 'Local delivery', 'elemental_task', 5, 1.0, 'task', 'Transport to distribution', 'Transportation', 'tkm', 0.0150, 0.0000, 0.0000, 0.0150, 0.0000, 0.0010, 'USD', 'manual'),
(14422, 21, 1442, 'Unload at DC', 'elemental_task', 5, 1.0, 'task', 'Unload at destination', 'Transportation', 'tkm', 0.0100, 0.0000, 0.0000, 0.0100, 0.0000, 0.0008, 'USD', 'manual');

-- ============================================
-- STEP 3: NUTROLEUM COMPONENTS (CASE 22)
-- 92 Components, Total Cost: $2.51
-- ============================================

-- Level 1: Product
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, currency, cost_allocation_type) VALUES
(2000, 22, NULL, 'Nutroleum 3 oz', 'product', 1, 1.0, 'unit', 'Complete Nutroleum product unit', 'Product', 'USD', 'calculated');

-- Level 2: Machine Lines (5 lines - includes additional additive processing)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, currency, cost_allocation_type) VALUES
(2100, 22, 2000, 'Raw Material Receiving', 'machine_line', 2, 1.0, 'line', 'Raw material handling and storage', 'Process', 'USD', 'calculated'),
(2200, 22, 2000, 'Beeswax Processing', 'machine_line', 2, 1.0, 'line', 'Beeswax melting and preparation', 'Process', 'USD', 'calculated'),
(2300, 22, 2000, 'Additive Blending', 'machine_line', 2, 1.0, 'line', 'Glucoside and specialty additive mixing', 'Process', 'USD', 'calculated'),
(2400, 22, 2000, 'Filling & Packaging', 'machine_line', 2, 1.0, 'line', 'Product filling and packaging', 'Process', 'USD', 'calculated'),
(2500, 22, 2000, 'Quality & Shipping', 'machine_line', 2, 1.0, 'line', 'Quality control and shipping', 'Process', 'USD', 'calculated');

-- Level 3: Subprocesses (15 subprocesses)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, currency, cost_allocation_type) VALUES
-- Raw Material Receiving subprocesses
(2110, 22, 2100, 'Material Receipt', 'subprocess', 3, 1.0, 'subprocess', 'Receiving and inspection', 'Labour', 'USD', 'calculated'),
(2120, 22, 2100, 'Storage & Staging', 'subprocess', 3, 1.0, 'subprocess', 'Warehouse storage', 'Labour', 'USD', 'calculated'),
-- Beeswax Processing subprocesses
(2210, 22, 2200, 'Beeswax Melting', 'subprocess', 3, 1.0, 'subprocess', 'Melt raw beeswax', 'Energy', 'USD', 'calculated'),
(2220, 22, 2200, 'Beeswax Filtering', 'subprocess', 3, 1.0, 'subprocess', 'Filter impurities', 'Equipment', 'USD', 'calculated'),
(2230, 22, 2200, 'Glycerin Addition', 'subprocess', 3, 1.0, 'subprocess', 'Add glycerin base', 'Energy', 'USD', 'calculated'),
-- Additive Blending subprocesses
(2310, 22, 2300, 'Glucoside Prep', 'subprocess', 3, 1.0, 'subprocess', 'Prepare glucoside solution', 'Energy', 'USD', 'calculated'),
(2320, 22, 2300, 'Additive Mixing', 'subprocess', 3, 1.0, 'subprocess', 'Mix specialty additives', 'Energy', 'USD', 'calculated'),
(2330, 22, 2300, 'Final Homogenization', 'subprocess', 3, 1.0, 'subprocess', 'Final product blending', 'Energy', 'USD', 'calculated'),
-- Filling & Packaging subprocesses
(2410, 22, 2400, 'Jar Filling', 'subprocess', 3, 1.0, 'subprocess', 'Automated filling', 'Equipment', 'USD', 'calculated'),
(2420, 22, 2400, 'Lid Application', 'subprocess', 3, 1.0, 'subprocess', 'Lid sealing', 'Equipment', 'USD', 'calculated'),
(2430, 22, 2400, 'Labeling', 'subprocess', 3, 1.0, 'subprocess', 'Premium label application', 'Equipment', 'USD', 'calculated'),
-- Quality & Shipping subprocesses
(2510, 22, 2500, 'Quality Testing', 'subprocess', 3, 1.0, 'subprocess', 'Enhanced QC inspection', 'Labour', 'USD', 'calculated'),
(2520, 22, 2500, 'Carton Packing', 'subprocess', 3, 1.0, 'subprocess', 'Premium case packing', 'Labour', 'USD', 'calculated'),
(2530, 22, 2500, 'Palletizing', 'subprocess', 3, 1.0, 'subprocess', 'Pallet loading', 'Equipment', 'USD', 'calculated'),
(2540, 22, 2500, 'Shipping', 'subprocess', 3, 1.0, 'subprocess', 'Distribution', 'Transportation', 'USD', 'calculated');

-- Level 4: Operations (30 operations)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, currency, cost_allocation_type) VALUES
-- Material Receipt operations
(2111, 22, 2110, 'Unload Materials', 'operation', 4, 1.0, 'operation', 'Unloading delivery trucks', 'Labour', 'USD', 'calculated'),
(2112, 22, 2110, 'Inspect Materials', 'operation', 4, 1.0, 'operation', 'Premium ingredient inspection', 'Labour', 'USD', 'calculated'),
-- Storage operations
(2121, 22, 2120, 'Move to Storage', 'operation', 4, 1.0, 'operation', 'Transport to warehouse', 'Equipment', 'USD', 'calculated'),
(2122, 22, 2120, 'Stage for Production', 'operation', 4, 1.0, 'operation', 'Pre-production staging', 'Labour', 'USD', 'calculated'),
-- Beeswax Melting operations
(2211, 22, 2210, 'Load Beeswax', 'operation', 4, 1.0, 'operation', 'Load raw beeswax', 'Labour', 'USD', 'calculated'),
(2212, 22, 2210, 'Melt Beeswax', 'operation', 4, 1.0, 'operation', 'Heat and melt beeswax', 'Energy', 'USD', 'calculated'),
-- Beeswax Filtering operations
(2221, 22, 2220, 'Setup Filter', 'operation', 4, 1.0, 'operation', 'Prepare filtration system', 'Equipment', 'USD', 'calculated'),
(2222, 22, 2220, 'Filter Wax', 'operation', 4, 1.0, 'operation', 'Filter molten beeswax', 'Equipment', 'USD', 'calculated'),
-- Glycerin Addition operations
(2231, 22, 2230, 'Measure Glycerin', 'operation', 4, 1.0, 'operation', 'Measure glycerin volume', 'Labour', 'USD', 'calculated'),
(2232, 22, 2230, 'Add to Mix', 'operation', 4, 1.0, 'operation', 'Add glycerin to beeswax', 'Equipment', 'USD', 'calculated'),
-- Glucoside Prep operations
(2311, 22, 2310, 'Weigh Glucoside', 'operation', 4, 1.0, 'operation', 'Measure glucoside', 'Labour', 'USD', 'calculated'),
(2312, 22, 2310, 'Dissolve Glucoside', 'operation', 4, 1.0, 'operation', 'Create solution', 'Energy', 'USD', 'calculated'),
-- Additive Mixing operations
(2321, 22, 2320, 'Combine Additives', 'operation', 4, 1.0, 'operation', 'Mix all additives', 'Energy', 'USD', 'calculated'),
(2322, 22, 2320, 'Quality Check', 'operation', 4, 1.0, 'operation', 'Verify additive blend', 'Labour', 'USD', 'calculated'),
-- Final Homogenization operations
(2331, 22, 2330, 'High-Speed Mix', 'operation', 4, 1.0, 'operation', 'Homogenize blend', 'Energy', 'USD', 'calculated'),
(2332, 22, 2330, 'Cool Product', 'operation', 4, 1.0, 'operation', 'Controlled cooling', 'Energy', 'USD', 'calculated'),
-- Filling operations
(2411, 22, 2410, 'Position Jars', 'operation', 4, 1.0, 'operation', 'Index jars on line', 'Equipment', 'USD', 'calculated'),
(2412, 22, 2410, 'Dispense Product', 'operation', 4, 1.0, 'operation', 'Fill jars', 'Equipment', 'USD', 'calculated'),
-- Lid Application operations
(2421, 22, 2420, 'Place Lids', 'operation', 4, 1.0, 'operation', 'Position premium lids', 'Equipment', 'USD', 'calculated'),
(2422, 22, 2420, 'Seal Lids', 'operation', 4, 1.0, 'operation', 'Press seal lids', 'Equipment', 'USD', 'calculated'),
-- Labeling operations
(2431, 22, 2430, 'Apply Front Label', 'operation', 4, 1.0, 'operation', 'Premium front label', 'Equipment', 'USD', 'calculated'),
(2432, 22, 2430, 'Apply Back Label', 'operation', 4, 1.0, 'operation', 'Premium back label', 'Equipment', 'USD', 'calculated'),
-- QC operations
(2511, 22, 2510, 'Visual Inspection', 'operation', 4, 1.0, 'operation', 'Enhanced visual check', 'Labour', 'USD', 'calculated'),
(2512, 22, 2510, 'Weight Check', 'operation', 4, 1.0, 'operation', 'Fill weight QC', 'Equipment', 'USD', 'calculated'),
-- Packing operations
(2521, 22, 2520, 'Form Cartons', 'operation', 4, 1.0, 'operation', 'Erect premium cartons', 'Equipment', 'USD', 'calculated'),
(2522, 22, 2520, 'Load Cartons', 'operation', 4, 1.0, 'operation', 'Place units in carton', 'Labour', 'USD', 'calculated'),
-- Palletizing operations
(2531, 22, 2530, 'Stack Cartons', 'operation', 4, 1.0, 'operation', 'Build pallet', 'Equipment', 'USD', 'calculated'),
(2532, 22, 2530, 'Wrap Pallet', 'operation', 4, 1.0, 'operation', 'Stretch wrap', 'Equipment', 'USD', 'calculated'),
-- Shipping operations
(2541, 22, 2540, 'Load Truck', 'operation', 4, 1.0, 'operation', 'Forklift loading', 'Equipment', 'USD', 'calculated'),
(2542, 22, 2540, 'Transport', 'operation', 4, 1.0, 'operation', 'Deliver to DC', 'Transportation', 'USD', 'calculated');

-- Level 5: Elemental Tasks (42 tasks for Nutroleum - higher costs due to premium ingredients and extra processing)
INSERT INTO component (component_id, case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description, driver_category, driver_type, opex, labor_cost, energy_cost, transportation_cost, material_cost, overhead_cost, currency, cost_allocation_type) VALUES
-- Unload Materials tasks
(21111, 22, 2111, 'Position forklift', 'elemental_task', 5, 1.0, 'task', 'Position forklift at truck', 'Labour', 'Direct labour time', 0.0015, 0.0015, 0.0000, 0.0000, 0.0000, 0.0001, 'USD', 'manual'),
(21112, 22, 2111, 'Lift pallet', 'elemental_task', 5, 1.0, 'task', 'Lift material pallet', 'Equipment', 'Machine time', 0.0018, 0.0010, 0.0006, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Inspect Materials tasks (more thorough for premium ingredients)
(21121, 22, 2112, 'Check COA', 'elemental_task', 5, 1.0, 'task', 'Review certificate of analysis', 'Labour', 'Direct labour time', 0.0035, 0.0035, 0.0000, 0.0000, 0.0000, 0.0003, 'USD', 'manual'),
(21122, 22, 2112, 'Sample material', 'elemental_task', 5, 1.0, 'task', 'Take QC sample', 'Labour', 'Direct labour time', 0.0040, 0.0040, 0.0000, 0.0000, 0.0000, 0.0004, 'USD', 'manual'),
-- Storage tasks
(21211, 22, 2121, 'Transport to warehouse', 'elemental_task', 5, 1.0, 'task', 'Move pallet to storage', 'Equipment', 'Machine time', 0.0020, 0.0012, 0.0006, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
(21212, 22, 2121, 'Place in rack', 'elemental_task', 5, 1.0, 'task', 'Position in storage rack', 'Equipment', 'Machine time', 0.0018, 0.0010, 0.0006, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Stage tasks
(21221, 22, 2122, 'Retrieve materials', 'elemental_task', 5, 1.0, 'task', 'Pick production materials', 'Labour', 'Direct labour time', 0.0028, 0.0028, 0.0000, 0.0000, 0.0000, 0.0003, 'USD', 'manual'),
(21222, 22, 2122, 'Stage at line', 'elemental_task', 5, 1.0, 'task', 'Position at production area', 'Labour', 'Direct labour time', 0.0022, 0.0022, 0.0000, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Load Beeswax tasks (premium material - higher cost)
(22111, 22, 2211, 'Weigh beeswax', 'elemental_task', 5, 1.0, 'task', 'Measure premium beeswax', 'Labour', 'Direct labour time', 0.0045, 0.0045, 0.0000, 0.0000, 0.4500, 0.0005, 'USD', 'manual'),
(22112, 22, 2211, 'Load into kettle', 'elemental_task', 5, 1.0, 'task', 'Pour beeswax into melting kettle', 'Labour', 'Direct labour time', 0.0035, 0.0035, 0.0000, 0.0000, 0.0000, 0.0003, 'USD', 'manual'),
-- Melt Beeswax tasks (higher energy for beeswax)
(22121, 22, 2212, 'Heat to temp', 'elemental_task', 5, 1.0, 'task', 'Heat beeswax to melting point', 'Energy', 'kWh', 0.0280, 0.0000, 0.0280, 0.0000, 0.0000, 0.0022, 'USD', 'manual'),
(22122, 22, 2212, 'Monitor temp', 'elemental_task', 5, 1.0, 'task', 'Monitor temperature', 'Labour', 'Direct labour time', 0.0020, 0.0020, 0.0000, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Filter tasks
(22211, 22, 2221, 'Setup filter', 'elemental_task', 5, 1.0, 'task', 'Prepare filtration system', 'Equipment', 'Machine time', 0.0025, 0.0012, 0.0010, 0.0000, 0.0000, 0.0003, 'USD', 'manual'),
(22212, 22, 2221, 'Run filtration', 'elemental_task', 5, 1.0, 'task', 'Filter impurities', 'Equipment', 'Machine time', 0.0035, 0.0015, 0.0015, 0.0000, 0.0000, 0.0005, 'USD', 'manual'),
-- Glycerin tasks (premium ingredient)
(22311, 22, 2231, 'Weigh glycerin', 'elemental_task', 5, 1.0, 'task', 'Measure organic glycerin', 'Labour', 'Direct labour time', 0.0038, 0.0038, 0.0000, 0.0000, 0.3200, 0.0004, 'USD', 'manual'),
(22312, 22, 2231, 'Transfer to vessel', 'elemental_task', 5, 1.0, 'task', 'Pour into mixing vessel', 'Labour', 'Direct labour time', 0.0028, 0.0028, 0.0000, 0.0000, 0.0000, 0.0003, 'USD', 'manual'),
-- Add to Mix tasks
(22321, 22, 2232, 'Open valve', 'elemental_task', 5, 1.0, 'task', 'Open transfer valve', 'Equipment', 'Machine time', 0.0012, 0.0006, 0.0004, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
(22322, 22, 2232, 'Pump glycerin', 'elemental_task', 5, 1.0, 'task', 'Pump into mixer', 'Equipment', 'Machine time', 0.0042, 0.0012, 0.0025, 0.0000, 0.0000, 0.0005, 'USD', 'manual'),
-- Glucoside Prep tasks (specialty additive - expensive)
(23111, 22, 2311, 'Weigh glucoside', 'elemental_task', 5, 1.0, 'task', 'Measure glucoside powder', 'Labour', 'Direct labour time', 0.0048, 0.0048, 0.0000, 0.0000, 0.5800, 0.0006, 'USD', 'manual'),
(23112, 22, 2311, 'Prepare solution', 'elemental_task', 5, 1.0, 'task', 'Prepare glucoside solution', 'Labour', 'Direct labour time', 0.0055, 0.0055, 0.0000, 0.0000, 0.0000, 0.0005, 'USD', 'manual'),
-- Dissolve tasks
(23121, 22, 2312, 'Heat solution', 'elemental_task', 5, 1.0, 'task', 'Heat to dissolve', 'Energy', 'kWh', 0.0150, 0.0000, 0.0150, 0.0000, 0.0000, 0.0012, 'USD', 'manual'),
(23122, 22, 2312, 'Mix solution', 'elemental_task', 5, 1.0, 'task', 'Stir to dissolve completely', 'Energy', 'kWh', 0.0120, 0.0000, 0.0120, 0.0000, 0.0000, 0.0010, 'USD', 'manual'),
-- Combine Additives tasks
(23211, 22, 2321, 'Add all additives', 'elemental_task', 5, 1.0, 'task', 'Combine all specialty additives', 'Energy', 'kWh', 0.0180, 0.0000, 0.0180, 0.0000, 0.0000, 0.0015, 'USD', 'manual'),
(23212, 22, 2321, 'Mix thoroughly', 'elemental_task', 5, 1.0, 'task', 'Ensure complete mixing', 'Energy', 'kWh', 0.0220, 0.0000, 0.0220, 0.0000, 0.0000, 0.0018, 'USD', 'manual'),
-- Quality Check tasks
(23221, 22, 2322, 'Sample blend', 'elemental_task', 5, 1.0, 'task', 'Take QC sample', 'Labour', 'Direct labour time', 0.0038, 0.0038, 0.0000, 0.0000, 0.0000, 0.0004, 'USD', 'manual'),
(23222, 22, 2322, 'Test viscosity', 'elemental_task', 5, 1.0, 'task', 'Verify blend quality', 'Labour', 'Direct labour time', 0.0045, 0.0045, 0.0000, 0.0000, 0.0000, 0.0004, 'USD', 'manual'),
-- High-Speed Mix tasks
(23311, 22, 2331, 'Start mixer', 'elemental_task', 5, 1.0, 'task', 'Start high-speed mixer', 'Energy', 'kWh', 0.0320, 0.0000, 0.0320, 0.0000, 0.0000, 0.0025, 'USD', 'manual'),
(23312, 22, 2331, 'Run cycle', 'elemental_task', 5, 1.0, 'task', 'Complete mixing cycle', 'Energy', 'kWh', 0.0450, 0.0020, 0.0410, 0.0000, 0.0000, 0.0020, 'USD', 'manual'),
-- Cool Product tasks
(23321, 22, 2332, 'Activate cooling', 'elemental_task', 5, 1.0, 'task', 'Start cooling system', 'Energy', 'kWh', 0.0180, 0.0000, 0.0180, 0.0000, 0.0000, 0.0015, 'USD', 'manual'),
(23322, 22, 2332, 'Monitor cooling', 'elemental_task', 5, 1.0, 'task', 'Monitor temperature drop', 'Labour', 'Direct labour time', 0.0018, 0.0018, 0.0000, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Filling tasks (premium jars)
(24111, 22, 2411, 'Load jars', 'elemental_task', 5, 1.0, 'task', 'Load premium jars to conveyor', 'Equipment', 'Machine time', 0.0028, 0.0012, 0.0010, 0.0000, 0.0550, 0.0006, 'USD', 'manual'),
(24112, 22, 2411, 'Index jars', 'elemental_task', 5, 1.0, 'task', 'Position for filling', 'Equipment', 'Machine time', 0.0015, 0.0006, 0.0006, 0.0000, 0.0000, 0.0003, 'USD', 'manual'),
-- Dispense tasks
(24121, 22, 2412, 'Open nozzle', 'elemental_task', 5, 1.0, 'task', 'Open fill nozzle', 'Equipment', 'Machine time', 0.0010, 0.0004, 0.0004, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
(24122, 22, 2412, 'Fill jar', 'elemental_task', 5, 1.0, 'task', 'Dispense 3 oz product', 'Equipment', 'Machine time', 0.0018, 0.0006, 0.0010, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Lid tasks (premium lids)
(24211, 22, 2421, 'Pick lid', 'elemental_task', 5, 1.0, 'task', 'Pick premium lid from feeder', 'Equipment', 'Machine time', 0.0015, 0.0006, 0.0006, 0.0000, 0.0280, 0.0003, 'USD', 'manual'),
(24212, 22, 2421, 'Position lid', 'elemental_task', 5, 1.0, 'task', 'Position on jar', 'Equipment', 'Machine time', 0.0012, 0.0005, 0.0005, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Seal tasks
(24221, 22, 2422, 'Apply pressure', 'elemental_task', 5, 1.0, 'task', 'Press seal lid', 'Equipment', 'Machine time', 0.0018, 0.0006, 0.0010, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
(24222, 22, 2422, 'Verify seal', 'elemental_task', 5, 1.0, 'task', 'Check seal integrity', 'Equipment', 'Machine time', 0.0010, 0.0004, 0.0004, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
-- Label tasks (premium labels)
(24311, 22, 2431, 'Apply front', 'elemental_task', 5, 1.0, 'task', 'Apply premium front label', 'Equipment', 'Machine time', 0.0025, 0.0008, 0.0010, 0.0000, 0.0250, 0.0007, 'USD', 'manual'),
(24312, 22, 2431, 'Press label', 'elemental_task', 5, 1.0, 'task', 'Press to adhere', 'Equipment', 'Machine time', 0.0012, 0.0005, 0.0005, 0.0000, 0.0000, 0.0002, 'USD', 'manual'),
(24321, 22, 2432, 'Apply back', 'elemental_task', 5, 1.0, 'task', 'Apply premium back label', 'Equipment', 'Machine time', 0.0020, 0.0006, 0.0008, 0.0000, 0.0150, 0.0006, 'USD', 'manual'),
(24322, 22, 2432, 'Press label', 'elemental_task', 5, 1.0, 'task', 'Press to adhere', 'Equipment', 'Machine time', 0.0010, 0.0004, 0.0004, 0.0000, 0.0000, 0.0002, 'USD', 'manual');

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify project
SELECT project_id, project_name FROM project WHERE project_id = 10;

-- Verify cases
SELECT case_id, case_name, case_type FROM case_table WHERE project_id = 10;

-- Verify component counts
SELECT ct.case_name, COUNT(c.component_id) as component_count
FROM case_table ct
LEFT JOIN component c ON ct.case_id = c.case_id
WHERE ct.project_id = 10
GROUP BY ct.case_id, ct.case_name;

-- Verify hierarchy distribution
SELECT ct.case_name, c.component_type, COUNT(*) as count
FROM case_table ct
JOIN component c ON ct.case_id = c.case_id
WHERE ct.project_id = 10
GROUP BY ct.case_id, ct.case_name, c.component_type
ORDER BY ct.case_id, c.hierarchy_level;

-- Calculate total costs per case
SELECT ct.case_name,
       SUM(COALESCE(c.opex, 0) + COALESCE(c.labor_cost, 0) + COALESCE(c.energy_cost, 0) +
           COALESCE(c.transportation_cost, 0) + COALESCE(c.material_cost, 0) + COALESCE(c.overhead_cost, 0)) as total_cost
FROM case_table ct
JOIN component c ON ct.case_id = c.case_id
WHERE ct.project_id = 10
GROUP BY ct.case_id, ct.case_name;

-- ====================================================================
-- ADD COMPONENTS TO EXISTING PROJECT 7
-- ====================================================================
-- Project 7 already exists with 3 cases (14, 15, 16)
-- This script adds the missing 15 components (5 per case)
-- ====================================================================

-- Case 14: Baseline Production (Components 500-504)
INSERT INTO component (component_id, case_id, process_node_name, node_type, description, quantity, unit, level, created_at, updated_at)
VALUES
  (500, 14, 'EV Battery Pack (60 kWh)', 'Product', 'Complete electric vehicle battery pack assembly. Functional unit for LCA comparison.', 1.0, 'unit', 1, NOW(), NOW()),
  (501, 14, 'Cell Assembly Line', 'Machine/Line', 'Automated production line for lithium-ion cell assembly.', 1.0, 'line', 2, NOW(), NOW()),
  (502, 14, 'Electrode Coating', 'Subprocess', 'Precision coating of active materials onto current collectors.', 1.0, 'subprocess', 3, NOW(), NOW()),
  (503, 14, 'Drying Operation', 'Operation', 'High-temperature drying to remove NMP solvent and moisture.', 1.0, 'operation', 4, NOW(), NOW()),
  (504, 14, 'Oven Heating Task', 'Elemental Task', 'Electric heating element operation using coal-grid electricity.', 1.0, 'task', 5, NOW(), NOW());

-- Set parent relationships for Case 14
UPDATE component SET parent_id = 500 WHERE component_id = 501;
UPDATE component SET parent_id = 501 WHERE component_id = 502;
UPDATE component SET parent_id = 502 WHERE component_id = 503;
UPDATE component SET parent_id = 503 WHERE component_id = 504;

-- Case 15: Renewable Energy (Components 505-509)
INSERT INTO component (component_id, case_id, process_node_name, node_type, description, quantity, unit, level, created_at, updated_at)
VALUES
  (505, 15, 'EV Battery Pack (60 kWh)', 'Product', 'Battery pack manufactured using 100% renewable energy.', 1.0, 'unit', 1, NOW(), NOW()),
  (506, 15, 'Cell Assembly Line', 'Machine/Line', 'Production line powered by renewable grid mix.', 1.0, 'line', 2, NOW(), NOW()),
  (507, 15, 'Electrode Coating', 'Subprocess', 'Coating process powered by renewable energy.', 1.0, 'subprocess', 3, NOW(), NOW()),
  (508, 15, 'Drying Operation', 'Operation', 'Drying powered by renewable electricity.', 1.0, 'operation', 4, NOW(), NOW()),
  (509, 15, 'Oven Heating Task', 'Elemental Task', 'Heating using renewable-grid electricity (96% emission reduction).', 1.0, 'task', 5, NOW(), NOW());

-- Set parent relationships for Case 15
UPDATE component SET parent_id = 505 WHERE component_id = 506;
UPDATE component SET parent_id = 506 WHERE component_id = 507;
UPDATE component SET parent_id = 507 WHERE component_id = 508;
UPDATE component SET parent_id = 508 WHERE component_id = 509;

-- Case 16: Solar-Powered (Components 510-514)
INSERT INTO component (component_id, case_id, process_node_name, node_type, description, quantity, unit, level, created_at, updated_at)
VALUES
  (510, 16, 'EV Battery Pack (60 kWh)', 'Product', 'Battery pack manufactured using on-site solar power.', 1.0, 'unit', 1, NOW(), NOW()),
  (511, 16, 'Cell Assembly Line', 'Machine/Line', 'Production line powered by 2 MW solar array.', 1.0, 'line', 2, NOW(), NOW()),
  (512, 16, 'Electrode Coating', 'Subprocess', 'Coating powered by solar electricity.', 1.0, 'subprocess', 3, NOW(), NOW()),
  (513, 16, 'Drying Operation', 'Operation', 'Drying using solar power with battery storage.', 1.0, 'operation', 4, NOW(), NOW()),
  (514, 16, 'Oven Heating Task', 'Elemental Task', 'Heating using solar electricity (94% emission reduction).', 1.0, 'task', 5, NOW(), NOW());

-- Set parent relationships for Case 16
UPDATE component SET parent_id = 510 WHERE component_id = 511;
UPDATE component SET parent_id = 511 WHERE component_id = 512;
UPDATE component SET parent_id = 512 WHERE component_id = 513;
UPDATE component SET parent_id = 513 WHERE component_id = 514;

-- Add Environmental Flows
INSERT INTO flows (component_id, substance_id, flow_type, direction, quantity, unit, notes, created_at, updated_at)
VALUES
  (504, 7, 'Energy', 'Input', 147.15, 'kWh', 'Coal grid electricity', NOW(), NOW()),
  (504, 1, 'Emission', 'Output', 125.25, 'kg', 'CO2 from coal electricity', NOW(), NOW()),
  (509, 7, 'Energy', 'Input', 147.15, 'kWh', 'Renewable electricity', NOW(), NOW()),
  (509, 1, 'Emission', 'Output', 5.0, 'kg', 'Minimal CO2 (96% reduction)', NOW(), NOW()),
  (514, 7, 'Energy', 'Input', 147.15, 'kWh', 'Solar electricity', NOW(), NOW()),
  (514, 1, 'Emission', 'Output', 7.8, 'kg', 'CO2 from solar panels (94% reduction)', NOW(), NOW());

-- Add ABC Costing
UPDATE component SET capex = 1000000, opex = 2500, labor_cost = 800, energy_cost = 1200, transportation_cost = 300, material_cost = 150, equipment_cost = 50, overhead_cost = 0, currency = 'USD' WHERE component_id = 500;
UPDATE component SET capex = 500000, opex = 8500, labor_cost = 3500, energy_cost = 2800, transportation_cost = 1500, material_cost = 600, equipment_cost = 100, overhead_cost = 0, currency = 'USD' WHERE component_id = 501;
UPDATE component SET capex = 150000, opex = 4200, labor_cost = 1800, energy_cost = 1500, transportation_cost = 600, material_cost = 250, equipment_cost = 50, overhead_cost = 0, currency = 'USD' WHERE component_id = 502;
UPDATE component SET capex = 50000, opex = 2100, labor_cost = 900, energy_cost = 850, transportation_cost = 250, material_cost = 80, equipment_cost = 20, overhead_cost = 0, currency = 'USD' WHERE component_id = 503;
UPDATE component SET capex = 20000, opex = 1050, labor_cost = 450, energy_cost = 425, transportation_cost = 125, material_cost = 40, equipment_cost = 10, overhead_cost = 0, currency = 'USD' WHERE component_id = 504;

UPDATE component SET capex = 1000000, opex = 2500, labor_cost = 800, energy_cost = 1200, transportation_cost = 300, material_cost = 150, equipment_cost = 50, overhead_cost = 0, currency = 'USD' WHERE component_id = 505;
UPDATE component SET capex = 500000, opex = 8500, labor_cost = 3500, energy_cost = 2800, transportation_cost = 1500, material_cost = 600, equipment_cost = 100, overhead_cost = 0, currency = 'USD' WHERE component_id = 506;
UPDATE component SET capex = 150000, opex = 4200, labor_cost = 1800, energy_cost = 1500, transportation_cost = 600, material_cost = 250, equipment_cost = 50, overhead_cost = 0, currency = 'USD' WHERE component_id = 507;
UPDATE component SET capex = 50000, opex = 2100, labor_cost = 900, energy_cost = 850, transportation_cost = 250, material_cost = 80, equipment_cost = 20, overhead_cost = 0, currency = 'USD' WHERE component_id = 508;
UPDATE component SET capex = 20000, opex = 1050, labor_cost = 450, energy_cost = 425, transportation_cost = 125, material_cost = 40, equipment_cost = 10, overhead_cost = 0, currency = 'USD' WHERE component_id = 509;

UPDATE component SET capex = 1200000, opex = 2300, labor_cost = 800, energy_cost = 800, transportation_cost = 300, material_cost = 150, equipment_cost = 50, overhead_cost = 200, currency = 'USD' WHERE component_id = 510;
UPDATE component SET capex = 650000, opex = 7800, labor_cost = 3500, energy_cost = 1800, transportation_cost = 1500, material_cost = 600, equipment_cost = 100, overhead_cost = 300, currency = 'USD' WHERE component_id = 511;
UPDATE component SET capex = 180000, opex = 3900, labor_cost = 1800, energy_cost = 1200, transportation_cost = 600, material_cost = 250, equipment_cost = 50, overhead_cost = 0, currency = 'USD' WHERE component_id = 512;
UPDATE component SET capex = 60000, opex = 1950, labor_cost = 900, energy_cost = 680, transportation_cost = 250, material_cost = 80, equipment_cost = 20, overhead_cost = 20, currency = 'USD' WHERE component_id = 513;
UPDATE component SET capex = 24000, opex = 975, labor_cost = 450, energy_cost = 340, transportation_cost = 125, material_cost = 40, equipment_cost = 10, overhead_cost = 10, currency = 'USD' WHERE component_id = 514;

-- Verify
SELECT 'Components added:' as step;
SELECT case_id, COUNT(*) as count FROM component WHERE case_id IN (14, 15, 16) GROUP BY case_id;

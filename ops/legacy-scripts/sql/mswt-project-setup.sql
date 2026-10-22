-- ============================================================
-- MSWT Project (Project ID: 12) Setup Script
-- ============================================================
-- This script creates the complete structure for the MSWT
-- (Municipal Solid Waste Treatment) project with test data
-- based on the actual database schema from Project 10
--
-- Database: lca_v3
-- Created: 2025-12-03
-- ============================================================

-- ============================================================
-- STEP 1: Create Base Cases for MSWT Project
-- ============================================================

INSERT INTO case_table (project_id, case_name, case_type, parent_case_id, description, created_at, updated_at)
VALUES
  (
    12,
    'MSWT Landfill Disposal Base Case',
    'base',
    NULL,
    'Baseline municipal solid waste treatment via landfill disposal',
    NOW(),
    NOW()
  ),
  (
    12,
    'MSWT Incineration with Energy Recovery',
    'comparative',
    LAST_INSERT_ID(),
    'Alternative MSWT scenario using incineration with energy recovery',
    NOW(),
    NOW()
  ),
  (
    12,
    'MSWT Recycling and Composting',
    'comparative',
    LAST_INSERT_ID() - 1,
    'Alternative MSWT scenario with source separation, recycling, and composting',
    NOW(),
    NOW()
  );

-- Store case IDs for reference (first base case)
-- Landfill Base Case - assume case_id 31 (adjust if needed)
-- Incineration Comparative - assume case_id 32
-- Recycling Comparative - assume case_id 33

-- ============================================================
-- STEP 2: Create Process Hierarchy for Landfill Base Case
-- ============================================================

-- Product Level (Root)
INSERT INTO component (
  case_id, parent_component_id, component_name, component_type, hierarchy_level,
  quantity, unit, description, process_type, cost_allocation_type, currency, created_at, updated_at
)
VALUES (
  31, NULL, 'MSW Treatment System - Landfill',
  'product', 1, 1, 'unit', 'Complete municipal solid waste treatment via landfill',
  'product', 'calculated', 'USD', NOW(), NOW()
);

-- Get the product component_id (should be auto-incremented)
-- For reference: product_id = LAST_INSERT_ID()

-- Machine/Line Level (Collection and Transport)
INSERT INTO component (
  case_id, parent_component_id, component_name, component_type, hierarchy_level,
  quantity, unit, description, cost_allocation_type, currency, created_at, updated_at
)
VALUES (
  31, LAST_INSERT_ID(), 'Waste Collection and Transportation',
  'machine_line', 2, 1, 'system', 'Collection trucks and transportation to landfill',
  'calculated', 'USD', NOW(), NOW()
);

SET @collection_id = LAST_INSERT_ID();

-- Subprocess Level (Collection)
INSERT INTO component (
  case_id, parent_component_id, component_name, component_type, hierarchy_level,
  quantity, unit, description, cost_allocation_type, currency, created_at, updated_at
)
VALUES (
  31, @collection_id, 'Curbside Collection',
  'subprocess', 3, 1, 'subprocess', 'Weekly curbside waste collection',
  'calculated', 'USD', NOW(), NOW()
),
(
  31, @collection_id, 'Transfer Station Operations',
  'subprocess', 3, 1, 'subprocess', 'Transfer and consolidation of waste',
  'calculated', 'USD', NOW(), NOW()
),
(
  31, @collection_id, 'Transportation to Landfill',
  'subprocess', 3, 1, 'subprocess', 'Long-haul transportation to landfill facility',
  'calculated', 'USD', NOW(), NOW()
);

SET @collection_curbside = LAST_INSERT_ID() - 2;
SET @transfer_station = LAST_INSERT_ID() - 1;
SET @transport_landfill = LAST_INSERT_ID();

-- Operation Level (Curbside Collection Details)
INSERT INTO component (
  case_id, parent_component_id, component_name, component_type, hierarchy_level,
  quantity, unit, description, driver_category, driver_type, cost_allocation_type, currency, created_at, updated_at
)
VALUES (
  31, @collection_curbside, 'Truck Loading Operations',
  'operation', 4, 1, 'operation', 'Mechanical and manual waste loading',
  'labor_energy', 'manual_handling', 'manual', 'USD', NOW(), NOW()
),
(
  31, @collection_curbside, 'Truck Fuel Consumption',
  'operation', 4, 1, 'operation', 'Diesel fuel for collection vehicle',
  'fuel', 'diesel_consumption', 'manual', 'USD', NOW(), NOW()
);

SET @loading_ops = LAST_INSERT_ID() - 1;
SET @fuel_consumption = LAST_INSERT_ID();

-- Machine/Line Level (Landfill Operations)
-- Get the main product component_id for reference
SELECT @product_id := MAX(component_id) FROM component WHERE case_id = 31 AND component_type = 'product';

INSERT INTO component (
  case_id, parent_component_id, component_name, component_type, hierarchy_level,
  quantity, unit, description, cost_allocation_type, currency, created_at, updated_at
)
VALUES (
  31, @product_id, 'Landfill Operations',
  'machine_line', 2, 1, 'facility', 'Landfill site operations and management',
  'calculated', 'USD', NOW(), NOW()
);

SET @landfill_ops = LAST_INSERT_ID();

-- Subprocess Level (Landfill Processes)
INSERT INTO component (
  case_id, parent_component_id, component_name, component_type, hierarchy_level,
  quantity, unit, description, cost_allocation_type, currency, created_at, updated_at
)
VALUES (
  31, @landfill_ops, 'Waste Reception and Spreading',
  'subprocess', 3, 1, 'subprocess', 'Initial waste handling and spreading',
  'calculated', 'USD', NOW(), NOW()
),
(
  31, @landfill_ops, 'Soil Cover Application',
  'subprocess', 3, 1, 'subprocess', 'Daily and intermediate soil cover',
  'calculated', 'USD', NOW(), NOW()
),
(
  31, @landfill_ops, 'Leachate Management',
  'subprocess', 3, 1, 'subprocess', 'Leachate collection and treatment',
  'calculated', 'USD', NOW(), NOW()
),
(
  31, @landfill_ops, 'Landfill Gas Management',
  'subprocess', 3, 1, 'subprocess', 'Methane capture and treatment',
  'calculated', 'USD', NOW(), NOW()
);

SET @reception_spreading = LAST_INSERT_ID() - 3;
SET @soil_cover = LAST_INSERT_ID() - 2;
SET @leachate_mgmt = LAST_INSERT_ID() - 1;
SET @gas_mgmt = LAST_INSERT_ID();

-- Operation Level (Landfill Gas Management)
INSERT INTO component (
  case_id, parent_component_id, component_name, component_type, hierarchy_level,
  quantity, unit, description, driver_category, driver_type, is_driver, cost_allocation_type, currency, created_at, updated_at
)
VALUES (
  31, @gas_mgmt, 'Landfill Gas Flaring',
  'operation', 4, 1, 'operation', 'Combustion of collected landfill gas',
  'emissions', 'methane_combustion', 1, 'manual', 'USD', NOW(), NOW()
);

-- ============================================================
-- STEP 3: Add Environmental Flows for Landfill Base Case
-- ============================================================

-- Flows for Truck Fuel Consumption (Operation)
-- Get substance IDs for common materials
-- Assuming diesel already exists as substance, or we use a generic fuel substance

-- First, let's get the substance IDs we'll need
SELECT @diesel_id := substance_id FROM substances WHERE substance_name LIKE '%Diesel%' LIMIT 1;
SELECT @co2_id := substance_id FROM substances WHERE substance_name = 'Carbon Dioxide' LIMIT 1;
SELECT @ch4_id := substance_id FROM substances WHERE substance_name = 'Methane' LIMIT 1;
SELECT @electricity_id := substance_id FROM substances WHERE substance_name = 'Electricity' LIMIT 1;

-- If substances don't exist, we'll use the IDs we know exist (1 = CO2, 2 = Methane from the sample data)
-- For now, insert flows using known substance IDs from the sample

-- Flows for Collection Truck Fuel Consumption
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description, created_at, updated_at)
VALUES (
  @fuel_consumption, 10, 'input', 0.25, 'liter', 1, 'Diesel fuel per kg MSW collected', NOW(), NOW()
),
(
  @fuel_consumption, 2, 'output', 0.75, 'kg', 1, 'CO2 from diesel combustion per kg MSW', NOW(), NOW()
);

-- Flows for Landfill Gas Flaring
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description, created_at, updated_at)
VALUES (
  @fuel_consumption, 2, 'output', 0.05, 'kg', 1, 'CH4 flared per kg MSW (partial collection)', NOW(), NOW()
),
(
  @fuel_consumption, 2, 'output', 0.02, 'kg', 1, 'CO2 from flaring per kg MSW', NOW(), NOW()
);

-- Flows for Leachate (Environmental Emission)
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description, created_at, updated_at)
VALUES (
  @leachate_mgmt, 8, 'output', 0.15, 'liter', 1, 'Leachate generated per kg MSW', NOW(), NOW()
);

-- ============================================================
-- STEP 4: Add Cost Data for Components
-- ============================================================

-- Update Collection and Transportation costs
UPDATE component SET
  opex = 45.00,
  labor_cost = 22.50,
  energy_cost = 15.00,
  transportation_cost = 7.50
WHERE component_id = @collection_id;

-- Update Landfill Operations costs
UPDATE component SET
  opex = 65.00,
  labor_cost = 20.00,
  equipment_cost = 25.00,
  overhead_cost = 20.00
WHERE component_id = @landfill_ops;

-- Update specific operations
UPDATE component SET
  opex = 10.00,
  labor_cost = 8.00,
  energy_cost = 2.00
WHERE component_id = @loading_ops;

UPDATE component SET
  opex = 12.50,
  material_cost = 12.50
WHERE component_id = @fuel_consumption;

UPDATE component SET
  opex = 18.00,
  labor_cost = 8.00,
  equipment_cost = 10.00
WHERE component_id = @reception_spreading;

UPDATE component SET
  opex = 8.00,
  material_cost = 8.00
WHERE component_id = @soil_cover;

UPDATE component SET
  opex = 15.00,
  equipment_cost = 10.00,
  energy_cost = 5.00
WHERE component_id = @leachate_mgmt;

UPDATE component SET
  opex = 22.00,
  equipment_cost = 15.00,
  energy_cost = 7.00
WHERE component_id = @gas_mgmt;

-- ============================================================
-- STEP 5: Create Comparative Case - Incineration
-- ============================================================

-- Get the base case structure and ID for Incineration case (case_id 32)

-- Product Level
INSERT INTO component (
  case_id, parent_component_id, component_name, component_type, hierarchy_level,
  quantity, unit, description, process_type, cost_allocation_type, currency, created_at, updated_at
)
VALUES (
  32, NULL, 'MSW Treatment System - Incineration with Energy Recovery',
  'product', 1, 1, 'unit', 'Municipal solid waste treatment via incineration with energy recovery',
  'product', 'calculated', 'USD', NOW(), NOW()
);

SET @incineration_product = LAST_INSERT_ID();

-- Collection remains similar
INSERT INTO component (
  case_id, parent_component_id, component_name, component_type, hierarchy_level,
  quantity, unit, description, cost_allocation_type, currency, created_at, updated_at
)
VALUES (
  32, @incineration_product, 'Waste Collection and Transportation',
  'machine_line', 2, 1, 'system', 'Collection trucks and transportation to incineration facility',
  'calculated', 'USD', NOW(), NOW()
);

SET @incineration_collection = LAST_INSERT_ID();

-- Incineration Facility Machine Line
INSERT INTO component (
  case_id, parent_component_id, component_name, component_type, hierarchy_level,
  quantity, unit, description, cost_allocation_type, currency, created_at, updated_at
)
VALUES (
  32, @incineration_product, 'Incineration Facility Operations',
  'machine_line', 2, 1, 'facility', 'Waste to energy incineration facility',
  'calculated', 'USD', NOW(), NOW()
);

SET @incineration_facility = LAST_INSERT_ID();

-- Incineration Subprocesses
INSERT INTO component (
  case_id, parent_component_id, component_name, component_type, hierarchy_level,
  quantity, unit, description, cost_allocation_type, currency, created_at, updated_at
)
VALUES (
  32, @incineration_facility, 'Waste Reception and Feeding',
  'subprocess', 3, 1, 'subprocess', 'Waste reception and feeding into incinerator',
  'calculated', 'USD', NOW(), NOW()
),
(
  32, @incineration_facility, 'Combustion Process',
  'subprocess', 3, 1, 'subprocess', 'Primary combustion chamber operation',
  'calculated', 'USD', NOW(), NOW()
),
(
  32, @incineration_facility, 'Energy Recovery and Boiler',
  'subprocess', 3, 1, 'subprocess', 'Heat recovery and steam generation',
  'calculated', 'USD', NOW(), NOW()
),
(
  32, @incineration_facility, 'Air Pollution Control',
  'subprocess', 3, 1, 'subprocess', 'Emission treatment and air quality control',
  'calculated', 'USD', NOW(), NOW()
),
(
  32, @incineration_facility, 'Ash Handling and Landfill',
  'subprocess', 3, 1, 'subprocess', 'Bottom ash and fly ash management',
  'calculated', 'USD', NOW(), NOW()
);

SET @waste_reception = LAST_INSERT_ID() - 4;
SET @combustion = LAST_INSERT_ID() - 3;
SET @energy_recovery = LAST_INSERT_ID() - 2;
SET @air_control = LAST_INSERT_ID() - 1;
SET @ash_handling = LAST_INSERT_ID();

-- Add costs for Incineration case
UPDATE component SET opex = 40.00, labor_cost = 20.00, energy_cost = 10.00, transportation_cost = 10.00
WHERE component_id = @incineration_collection;

UPDATE component SET opex = 120.00, labor_cost = 45.00, equipment_cost = 50.00, overhead_cost = 25.00
WHERE component_id = @incineration_facility;

-- Update subprocesses for incineration
UPDATE component SET opex = 15.00, labor_cost = 10.00, energy_cost = 5.00
WHERE component_id IN (@waste_reception, @combustion, @air_control);

UPDATE component SET opex = 35.00, energy_cost = 30.00, equipment_cost = 5.00
WHERE component_id = @energy_recovery;

UPDATE component SET opex = 12.00, labor_cost = 5.00, material_cost = 7.00
WHERE component_id = @ash_handling;

-- Add flows for incineration (more emissions due to combustion)
-- Combustion emissions
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description, created_at, updated_at)
VALUES (
  @combustion, 2, 'output', 1.2, 'kg', 1, 'CO2 from complete combustion per kg MSW', NOW(), NOW()
),
(
  @combustion, 3, 'output', 0.008, 'kg', 1, 'NOx emissions from combustion per kg MSW', NOW(), NOW()
),
(
  @combustion, 4, 'output', 0.004, 'kg', 1, 'SO2 emissions from combustion per kg MSW', NOW(), NOW()
);

-- Energy recovery (credit for electricity/heat)
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description, created_at, updated_at)
VALUES (
  @energy_recovery, 7, 'output', 2.5, 'kWh', 1, 'Electricity generated per kg MSW (avoided production)', NOW(), NOW()
);

-- ============================================================
-- STEP 6: Create Assessment Runs
-- ============================================================

-- Assessment for Landfill Base Case
INSERT INTO assessment_runs (case_id, run_name, run_date, calculation_method, status, executed_by)
VALUES (
  31,
  'MSWT-Landfill-Assessment-Base',
  NOW(),
  'CML 2001',
  'completed',
  1
);

-- Assessment for Incineration Case
INSERT INTO assessment_runs (case_id, run_name, run_date, calculation_method, status, executed_by)
VALUES (
  32,
  'MSWT-Incineration-Assessment',
  NOW(),
  'CML 2001',
  'completed',
  1
);

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================

-- Verify case structure
SELECT 'Case Table Summary' as section;
SELECT case_id, project_id, case_name, case_type, parent_case_id
FROM case_table WHERE project_id = 12
ORDER BY case_id;

-- Verify component hierarchy
SELECT 'Component Hierarchy - Landfill Base Case' as section;
SELECT
  CONCAT(REPEAT('  ', (hierarchy_level - 1)), component_name) as hierarchy,
  component_type, component_id, hierarchy_level
FROM component WHERE case_id = 31
ORDER BY component_id;

-- Verify cost allocation
SELECT 'Cost Summary by Component (Landfill)' as section;
SELECT
  component_name,
  COALESCE(opex, 0) as opex,
  COALESCE(labor_cost, 0) as labor,
  COALESCE(energy_cost, 0) as energy,
  COALESCE(material_cost, 0) as material,
  (COALESCE(opex, 0)) as total_opex
FROM component WHERE case_id = 31 AND opex IS NOT NULL
ORDER BY component_id;

-- Verify flows
SELECT 'Environmental Flows - Landfill Case' as section;
SELECT
  c.component_name,
  s.substance_name,
  f.flow_type,
  f.quantity,
  f.unit,
  f.driver_description
FROM flows f
JOIN component c ON f.component_id = c.component_id
JOIN substances s ON f.substance_id = s.substance_id
WHERE c.case_id = 31
ORDER BY f.flow_id;

-- Assessment summary
SELECT 'Assessment Runs - MSWT Project' as section;
SELECT
  a.run_id,
  c.case_name,
  a.run_name,
  a.run_date,
  a.calculation_method,
  a.status
FROM assessment_runs a
JOIN case_table c ON a.case_id = c.case_id
WHERE c.project_id = 12
ORDER BY a.run_id;

-- Summary statistics
SELECT 'Data Summary - MSWT Project (Project ID 12)' as section;
SELECT
  (SELECT COUNT(*) FROM case_table WHERE project_id = 12) as case_count,
  (SELECT COUNT(*) FROM component WHERE case_id IN (SELECT case_id FROM case_table WHERE project_id = 12)) as component_count,
  (SELECT COUNT(*) FROM flows WHERE component_id IN (SELECT component_id FROM component WHERE case_id IN (SELECT case_id FROM case_table WHERE project_id = 12))) as flow_count,
  (SELECT COUNT(*) FROM assessment_runs WHERE case_id IN (SELECT case_id FROM case_table WHERE project_id = 12)) as assessment_count;

-- ============================================================
-- End of MSWT Project Setup Script
-- ============================================================

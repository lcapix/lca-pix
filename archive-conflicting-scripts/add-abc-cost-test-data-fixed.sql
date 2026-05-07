-- ABC Costing Test Data (Fixed Version)
-- Adds realistic cost breakdowns to existing components for testing

-- First, get the component IDs we'll update
-- We'll update components manually by ID to avoid the subquery issue

-- Update components with ABC cost data
-- Note: Adjust component_id values based on your actual data

-- Product level component
UPDATE component
SET
  labor_cost_usd = 1200.00,
  energy_cost_usd = 600.00,
  transportation_cost_usd = 200.00,
  material_cost_usd = 300.00,
  equipment_cost_usd = 150.00,
  overhead_cost_usd = 50.00,
  opex = 2500.00,  -- Sum of above breakdown
  cost_allocation_type = 'manual'
WHERE component_type = 'product'
ORDER BY component_id
LIMIT 1;

-- Machine/Line component
UPDATE component
SET
  labor_cost_usd = 800.00,
  energy_cost_usd = 400.00,
  transportation_cost_usd = 150.00,
  material_cost_usd = 450.00,
  equipment_cost_usd = 100.00,
  overhead_cost_usd = 100.00,
  opex = 2000.00,  -- Sum of above
  capex = 5000.00,  -- Capital expenditure for machinery
  cost_allocation_type = 'manual'
WHERE component_type = 'machine_line'
ORDER BY component_id
LIMIT 1;

-- Subprocess component (labor-intensive)
UPDATE component
SET
  labor_cost_usd = 2000.00,  -- Labor-intensive
  energy_cost_usd = 100.00,
  transportation_cost_usd = 50.00,
  material_cost_usd = 600.00,
  equipment_cost_usd = 200.00,
  overhead_cost_usd = 50.00,
  opex = 3000.00,
  cost_allocation_type = 'manual'
WHERE component_type = 'subprocess'
ORDER BY component_id
LIMIT 1;

-- Operation component (energy-intensive)
UPDATE component
SET
  labor_cost_usd = 300.00,
  energy_cost_usd = 1200.00,  -- Energy-intensive operation
  transportation_cost_usd = 100.00,
  material_cost_usd = 200.00,
  equipment_cost_usd = 150.00,
  overhead_cost_usd = 50.00,
  opex = 2000.00,
  capex = 3000.00,  -- Equipment capital cost
  cost_allocation_type = 'manual'
WHERE component_type = 'operation'
ORDER BY component_id
LIMIT 1;

-- Elemental task component (simple breakdown)
UPDATE component
SET
  labor_cost_usd = 500.00,
  energy_cost_usd = 200.00,
  transportation_cost_usd = 50.00,
  material_cost_usd = 150.00,
  equipment_cost_usd = 75.00,
  overhead_cost_usd = 25.00,
  opex = 1000.00,
  cost_allocation_type = 'manual'
WHERE component_type = 'elemental_task'
ORDER BY component_id
LIMIT 1;

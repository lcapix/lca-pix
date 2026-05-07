-- Add ABC Cost Data to Case 1 Components
-- This populates cost data for components in case_id = 1 (Baseline Production - 2025)
-- Components 1-5 or 6-10: Standard production with coal-based grid electricity

-- First, let's update components in Case 1, regardless of their IDs
-- We'll use the component names to ensure we're updating the right ones

-- Component: EV Battery Pack (60 kWh) - Product (Baseline with coal grid)
UPDATE component
SET
  labor_cost = 1200.00,
  energy_cost = 600.00,
  transportation_cost = 200.00,
  material_cost = 300.00,
  equipment_cost = 150.00,
  overhead_cost = 50.00,
  opex = 2500.00,
  capex = 1000000.00,
  currency = 'USD',
  cost_allocation_type = 'manual'
WHERE case_id = 1
  AND component_name = 'EV Battery Pack (60 kWh)'
  AND component_type = 'product';

-- Component: Cell Assembly Line - Machine/Line (Standard power)
UPDATE component
SET
  labor_cost = 800.00,
  energy_cost = 400.00,
  transportation_cost = 150.00,
  material_cost = 450.00,
  equipment_cost = 100.00,
  overhead_cost = 100.00,
  opex = 2000.00,
  capex = 5000.00,
  currency = 'USD',
  cost_allocation_type = 'manual'
WHERE case_id = 1
  AND component_name = 'Cell Assembly Line'
  AND component_type = 'machine_line';

-- Component: Electrode Coating Process - Subprocess (Coal powered)
UPDATE component
SET
  labor_cost = 2000.00,
  energy_cost = 100.00,
  transportation_cost = 50.00,
  material_cost = 600.00,
  equipment_cost = 200.00,
  overhead_cost = 50.00,
  opex = 3000.00,
  capex = 100000.00,
  currency = 'USD',
  cost_allocation_type = 'manual'
WHERE case_id = 1
  AND component_name = 'Electrode Coating Process'
  AND component_type = 'subprocess';

-- Component: Drying Operation - Operation (Energy-intensive coal power)
UPDATE component
SET
  labor_cost = 300.00,
  energy_cost = 1000.00,
  transportation_cost = 100.00,
  material_cost = 200.00,
  equipment_cost = 150.00,
  overhead_cost = 50.00,
  opex = 1800.00,
  capex = 3000.00,
  currency = 'USD',
  cost_allocation_type = 'manual'
WHERE case_id = 1
  AND component_name = 'Drying Operation'
  AND component_type = 'operation';

-- Component: Oven Heating Task - Elemental Task (Electric heating from coal)
UPDATE component
SET
  labor_cost = 500.00,
  energy_cost = 200.00,
  transportation_cost = 50.00,
  material_cost = 150.00,
  equipment_cost = 75.00,
  overhead_cost = 25.00,
  opex = 1000.00,
  capex = 20000.00,
  currency = 'USD',
  cost_allocation_type = 'manual'
WHERE case_id = 1
  AND component_name = 'Oven Heating Task'
  AND component_type = 'elemental_task';

-- Verify updates
SELECT
  component_id,
  component_name,
  component_type,
  labor_cost,
  energy_cost,
  transportation_cost,
  material_cost,
  equipment_cost,
  overhead_cost,
  opex,
  capex,
  currency
FROM component
WHERE case_id = 1
ORDER BY component_id;

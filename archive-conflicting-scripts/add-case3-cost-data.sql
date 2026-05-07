-- Add ABC Cost Data to Case 3 Components
-- This populates cost data for components in case_id = 3

-- Component 16: EV Battery Pack (60 kWh) - Product
UPDATE component
SET
  labor_cost = 1500.00,
  energy_cost = 800.00,
  transportation_cost = 250.00,
  material_cost = 400.00,
  equipment_cost = 200.00,
  overhead_cost = 100.00,
  opex = 3250.00,
  capex = 1200000.00,
  currency = 'USD',
  cost_allocation_type = 'manual'
WHERE component_id = 16;

-- Component 17: Cell Assembly Line - Machine/Line
UPDATE component
SET
  labor_cost = 900.00,
  energy_cost = 500.00,
  transportation_cost = 180.00,
  material_cost = 520.00,
  equipment_cost = 120.00,
  overhead_cost = 130.00,
  opex = 2350.00,
  capex = 5500.00,
  currency = 'USD',
  cost_allocation_type = 'manual'
WHERE component_id = 17;

-- Component 18: Electrode Coating Process - Subprocess
UPDATE component
SET
  labor_cost = 2200.00,
  energy_cost = 150.00,
  transportation_cost = 60.00,
  material_cost = 650.00,
  equipment_cost = 220.00,
  overhead_cost = 70.00,
  opex = 3350.00,
  capex = 110000.00,
  currency = 'USD',
  cost_allocation_type = 'manual'
WHERE component_id = 18;

-- Component 19: Drying Operation - Operation (Energy-intensive with wind power)
UPDATE component
SET
  labor_cost = 250.00,
  energy_cost = 1000.00,
  transportation_cost = 90.00,
  material_cost = 180.00,
  equipment_cost = 140.00,
  overhead_cost = 40.00,
  opex = 1700.00,
  capex = 2500.00,
  currency = 'USD',
  cost_allocation_type = 'manual'
WHERE component_id = 19;

-- Component 20: Oven Heating Task - Elemental Task
UPDATE component
SET
  labor_cost = 450.00,
  energy_cost = 180.00,
  transportation_cost = 45.00,
  material_cost = 140.00,
  equipment_cost = 70.00,
  overhead_cost = 20.00,
  opex = 905.00,
  capex = 18000.00,
  currency = 'USD',
  cost_allocation_type = 'manual'
WHERE component_id = 20;

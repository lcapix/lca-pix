-- Add ABC Cost Data to Case 2 Components
-- This populates cost data for components in case_id = 2

-- Component 11: EV Battery Pack (60 kWh) - Product (Renewable energy focus)
UPDATE component
SET
  labor_cost = 1300.00,
  energy_cost = 500.00,  -- Lower energy cost due to renewable energy
  transportation_cost = 220.00,
  material_cost = 350.00,
  equipment_cost = 180.00,
  overhead_cost = 80.00,
  opex = 2630.00,
  capex = 1100000.00,
  currency = 'USD',
  cost_allocation_type = 'manual'
WHERE component_id = 11;

-- Component 12: Cell Assembly Line - Machine/Line (Renewable powered)
UPDATE component
SET
  labor_cost = 850.00,
  energy_cost = 350.00,  -- Lower energy cost with renewable
  transportation_cost = 160.00,
  material_cost = 480.00,
  equipment_cost = 110.00,
  overhead_cost = 110.00,
  opex = 2060.00,
  capex = 5200.00,
  currency = 'USD',
  cost_allocation_type = 'manual'
WHERE component_id = 12;

-- Component 13: Electrode Coating Process - Subprocess (Renewable energy)
UPDATE component
SET
  labor_cost = 2100.00,
  energy_cost = 80.00,  -- Very low energy cost with renewable
  transportation_cost = 55.00,
  material_cost = 620.00,
  equipment_cost = 210.00,
  overhead_cost = 60.00,
  opex = 3125.00,
  capex = 105000.00,
  currency = 'USD',
  cost_allocation_type = 'manual'
WHERE component_id = 13;

-- Component 14: Drying Operation - Operation (Renewable electricity)
UPDATE component
SET
  labor_cost = 280.00,
  energy_cost = 900.00,  -- Lower energy cost with renewable
  transportation_cost = 95.00,
  material_cost = 190.00,
  equipment_cost = 145.00,
  overhead_cost = 45.00,
  opex = 1655.00,
  capex = 2800.00,
  currency = 'USD',
  cost_allocation_type = 'manual'
WHERE component_id = 14;

-- Component 15: Oven Heating Task - Elemental Task (100% renewable)
UPDATE component
SET
  labor_cost = 480.00,
  energy_cost = 150.00,  -- Lowest energy cost - 100% renewable
  transportation_cost = 48.00,
  material_cost = 145.00,
  equipment_cost = 72.00,
  overhead_cost = 22.00,
  opex = 917.00,
  capex = 19500.00,
  currency = 'USD',
  cost_allocation_type = 'manual'
WHERE component_id = 15;

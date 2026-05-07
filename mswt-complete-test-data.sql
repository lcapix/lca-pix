-- ========================================================================================================
-- MSWT PROJECT - COMPLETE TEST DATA
-- ========================================================================================================
--
-- Project: Modular Vertical Axis Wind Turbine (MSWT)
-- Client: Daniel Lerner
-- Category: Energy Generation & Storage
-- Methodology: SM 2013
--
-- This script creates a comprehensive LCA project with:
-- - 1 Base Case: North America: Modular Vertical Axis Wind Turbine (MSWT)
-- - 3 Comparative Cases: Heat Pump, Coastal North Sea, US Great Plains
-- - Complete 5-level component hierarchies
-- - ABC costing data
-- - Flow data linking elemental tasks to substances
-- - Assessment results calibrated to target values
--
-- Target Impact Results:
-- - Base Case (MSWT): 37 ELU
-- - Heat Pump: 16 ELU (+56% better performance)
-- - Coastal North Sea: 37 ELU
-- - US Great Plains: 37 ELU
--
-- ========================================================================================================

-- ========================================================================================================
-- SECTION 1: USER ACCOUNT SETUP
-- ========================================================================================================

-- Clean up any existing data from previous runs
DELETE FROM project WHERE project_name = 'Modular Vertical Axis Wind Turbine (MSWT)';
DELETE FROM account WHERE username = 'daniel.lerner' OR email = 'daniel.lerner@lcaproject.com';

-- Create Daniel Lerner's account
INSERT INTO account (username, email, password_hash, created_at)
VALUES (
  'daniel.lerner',
  'daniel.lerner@lcaproject.com',
  -- Password: 'LCA2025!' (hashed with bcrypt)
  '$2a$10$YourHashedPasswordHere123456789012345678901234567890123456',
  NOW()
);

-- Store user ID for later use
SET @user_id = LAST_INSERT_ID();

SELECT @user_id AS 'Created User ID', 'Daniel Lerner' AS 'Username';

-- ========================================================================================================
-- SECTION 2: PROJECT CREATION
-- ========================================================================================================

INSERT INTO project (
  project_name,
  description,
  owner_id,
  created_at,
  updated_at
)
VALUES (
  'Modular Vertical Axis Wind Turbine (MSWT)',
  'Project Background:
The global transition to renewable energy is driving demand for distributed, resilient, and low-carbon power solutions, especially in urban and peri-urban environments. Traditional horizontal-axis wind turbines (HAWTs) are often unsuitable for these contexts due to their size, noise, and siting requirements. Vertical Axis Wind Turbines (VAWTs), and specifically modular, stackable designs, offer a promising alternative by enabling flexible deployment, easier maintenance, and improved performance in turbulent, multidirectional wind conditions.

Product Background:
The Modular Vertical Axis Wind Turbine (MSWT) is designed to address the unique challenges of urban and community-scale renewable energy. The system features a modular, stackable architecture that allows for rapid assembly, scalable power output, and straightforward maintenance. Key innovations include adaptive blade geometry for efficient energy capture, a lightweight aluminum tower for easy transport and installation, and integrated power electronics for grid or microgrid compatibility. The MSWT is intended for rooftop, ground, or wall-mounted applications, supporting both standalone and hybrid renewable energy systems.

Methodology: SM 2013

Ecodesign Strategies:
- Material Efficiency: Use of recyclable aluminum and advanced composites
- Modularity & Upgradability: Design for disassembly
- Manufacturing Optimization: Low-energy, low-waste processes
- Transportation Minimization: Modular packaging and local assembly
- Extended Product Life: 20+ year service life
- End-of-Life Planning: Recycling pathways for metals and electronics
- System Integration: Smart grid and battery storage compatibility',
  @user_id,
  NOW(),
  NOW()
);

-- Store project ID
SET @project_id = LAST_INSERT_ID();

SELECT @project_id AS 'Created Project ID', 'MSWT' AS 'Project Name';

-- ========================================================================================================
-- SECTION 3: SUBSTANCE CATALOG VERIFICATION & ADDITIONS
-- ========================================================================================================

-- Check existing substances and add missing ones

-- Metals
INSERT IGNORE INTO substances (substance_name, cas_number, category, unit, description, created_at)
VALUES
  ('Steel, reinforced', '12597-68-1', 'Metal', 'kg', 'Reinforced structural steel', NOW()),
  ('Aluminum, primary', '7429-90-5', 'Metal', 'kg', 'Primary aluminum production', NOW()),
  ('Aluminum alloy, economical', '7429-90-5', 'Metal', 'kg', 'Economic grade aluminum alloy', NOW()),
  ('Copper, primary', '7440-50-8', 'Metal', 'kg', 'Primary copper production', NOW()),
  ('Zinc powder, economical', '7440-66-6', 'Metal', 'kg', 'Zinc powder for coatings', NOW()),
  ('Platinum, primary', '7440-06-4', 'Metal', 'kg', 'Primary platinum production', NOW()),
  ('Cast iron', '7439-89-6', 'Metal', 'kg', 'Cast iron components', NOW());

-- Plastics & Composites
INSERT IGNORE INTO substances (substance_name, cas_number, category, unit, description, created_at)
VALUES
  ('Glass fiber reinforced polymer (GFRP)', '65997-17-3', 'Plastic/Composite', 'kg', 'Glass fiber reinforced polymer for blades', NOW()),
  ('Polyethylene, high density (HDPE)', '9002-88-4', 'Plastic', 'kg', 'High density polyethylene', NOW()),
  ('Polycarbonate', '25037-45-0', 'Plastic', 'kg', 'Polycarbonate plastic', NOW()),
  ('Epoxy resin', '25068-38-6', 'Plastic/Resin', 'kg', 'Epoxy resin for composites', NOW());

-- Electronics
INSERT IGNORE INTO substances (substance_name, cas_number, category, unit, description, created_at)
VALUES
  ('Electronics, integrated circuits', '00000-00-0', 'Electronics', 'kg', 'Integrated circuits and PCBs', NOW()),
  ('Electronics, sensors', '00000-00-0', 'Electronics', 'kg', 'Sensors and monitoring equipment', NOW()),
  ('Electronics, control systems', '00000-00-0', 'Electronics', 'kg', 'Control systems and power electronics', NOW());

-- Fluids & Refrigerants
INSERT IGNORE INTO substances (substance_name, cas_number, category, unit, description, created_at)
VALUES
  ('Refrigerant R-410A', '354-33-6', 'Refrigerant', 'kg', 'R-410A refrigerant for heat pumps', NOW()),
  ('Lubricating oil', '64742-54-7', 'Fluid', 'kg', 'Lubricating oil for bearings', NOW()),
  ('Hydraulic fluid', '64742-54-7', 'Fluid', 'kg', 'Hydraulic fluid', NOW());

-- Energy
INSERT IGNORE INTO substances (substance_name, cas_number, category, unit, description, created_at)
VALUES
  ('Electricity, grid mix', '00000-00-0', 'Energy', 'kWh', 'Grid electricity, regional mix', NOW()),
  ('Manufacturing energy', '00000-00-0', 'Energy', 'kWh', 'Energy for manufacturing processes', NOW()),
  ('Natural gas', '74-82-8', 'Energy', 'MJ', 'Natural gas for heating', NOW());

-- Emissions & Waste
INSERT IGNORE INTO substances (substance_name, cas_number, category, unit, description, created_at)
VALUES
  ('Carbon dioxide (CO2)', '124-38-9', 'Emission/Air', 'kg', 'Carbon dioxide emissions', NOW()),
  ('Nitrogen oxides (NOx)', '11104-93-1', 'Emission/Air', 'kg', 'Nitrogen oxide emissions', NOW()),
  ('Sulfur dioxide (SO2)', '7446-09-5', 'Emission/Air', 'kg', 'Sulfur dioxide emissions', NOW()),
  ('Particulate matter (PM10)', '00000-00-0', 'Emission/Air', 'kg', 'Particulate matter emissions', NOW()),
  ('Wastewater, industrial', '00000-00-0', 'Emission/Water', 'm3', 'Industrial wastewater', NOW());

-- Transportation
INSERT IGNORE INTO substances (substance_name, cas_number, category, unit, description, created_at)
VALUES
  ('Transport, truck, regional', '00000-00-0', 'Transportation', 'tkm', 'Regional truck transportation', NOW()),
  ('Transport, truck, long-haul', '00000-00-0', 'Transportation', 'tkm', 'Long-haul truck transportation', NOW()),
  ('Transport, ocean freight', '00000-00-0', 'Transportation', 'tkm', 'Ocean freight shipping', NOW());

SELECT COUNT(*) AS 'Total Substances in Catalog' FROM substances;

-- ========================================================================================================
-- SECTION 4: IMPACT CATEGORIES VERIFICATION
-- ========================================================================================================

-- Verify all required impact categories exist
SELECT
  category_id,
  category_name,
  unit
FROM impact_categories
ORDER BY category_id;

-- ========================================================================================================
-- COMMENTED_OUT: -- SECTION 5: CREATE DRIVER IMPACT FACTORS
-- COMMENTED_OUT: -- ========================================================================================================
-- COMMENTED_OUT: -- Link substances to impact categories with characterization factors
-- COMMENTED_OUT: 
-- COMMENTED_OUT: -- Get substance IDs
-- COMMENTED_OUT: SET @steel_id = (SELECT substance_id FROM substances WHERE substance_name = 'Steel, reinforced' LIMIT 1);
-- COMMENTED_OUT: SET @aluminum_id = (SELECT substance_id FROM substances WHERE substance_name = 'Aluminum, primary' LIMIT 1);
-- COMMENTED_OUT: SET @copper_id = (SELECT substance_id FROM substances WHERE substance_name = 'Copper, primary' LIMIT 1);
-- COMMENTED_OUT: SET @gfrp_id = (SELECT substance_id FROM substances WHERE substance_name = 'Glass fiber reinforced polymer (GFRP)' LIMIT 1);
-- COMMENTED_OUT: SET @electricity_id = (SELECT substance_id FROM substances WHERE substance_name = 'Electricity, grid mix' LIMIT 1);
-- COMMENTED_OUT: SET @co2_id = (SELECT substance_id FROM substances WHERE substance_name = 'Carbon dioxide (CO2)' LIMIT 1);
-- COMMENTED_OUT: 
-- COMMENTED_OUT: -- Get impact category IDs
-- COMMENTED_OUT: SET @gwp_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Global warming' LIMIT 1);
-- COMMENTED_OUT: SET @odp_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Ozone depletion' LIMIT 1);
-- COMMENTED_OUT: SET @ap_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Acidification' LIMIT 1);
-- COMMENTED_OUT: SET @ep_id = (SELECT category_id FROM impact_categories WHERE category_name = 'Eutrophication' LIMIT 1);
-- COMMENTED_OUT: 
-- COMMENTED_OUT: -- Create driver impact factors (characterization factors)
-- COMMENTED_OUT: -- These factors determine how much each substance contributes to environmental impacts
-- COMMENTED_OUT: 
-- COMMENTED_OUT: -- Steel characterization factors
-- COMMENTED_OUT: INSERT IGNORE INTO driver_impact_factors (substance_id, category_id, factor_value, unit, method, created_at)
-- COMMENTED_OUT: VALUES
-- COMMENTED_OUT:   (@steel_id, @gwp_id, 1.85, 'kg CO2-eq/kg', 'CML 2001', NOW()),
-- COMMENTED_OUT:   (@steel_id, @ap_id, 0.012, 'kg SO2-eq/kg', 'CML 2001', NOW()),
-- COMMENTED_OUT:   (@steel_id, @ep_id, 0.008, 'kg PO4-eq/kg', 'CML 2001', NOW());
-- COMMENTED_OUT: 
-- COMMENTED_OUT: -- Aluminum characterization factors
-- COMMENTED_OUT: INSERT IGNORE INTO driver_impact_factors (substance_id, category_id, factor_value, unit, method, created_at)
-- COMMENTED_OUT: VALUES
-- COMMENTED_OUT:   (@aluminum_id, @gwp_id, 12.3, 'kg CO2-eq/kg', 'CML 2001', NOW()),
-- COMMENTED_OUT:   (@aluminum_id, @ap_id, 0.045, 'kg SO2-eq/kg', 'CML 2001', NOW()),
-- COMMENTED_OUT:   (@aluminum_id, @ep_id, 0.025, 'kg PO4-eq/kg', 'CML 2001', NOW());
-- COMMENTED_OUT: 
-- COMMENTED_OUT: -- Copper characterization factors
-- COMMENTED_OUT: INSERT IGNORE INTO driver_impact_factors (substance_id, category_id, factor_value, unit, method, created_at)
-- COMMENTED_OUT: VALUES
-- COMMENTED_OUT:   (@copper_id, @gwp_id, 3.2, 'kg CO2-eq/kg', 'CML 2001', NOW()),
-- COMMENTED_OUT:   (@copper_id, @ap_id, 0.028, 'kg SO2-eq/kg', 'CML 2001', NOW()),
-- COMMENTED_OUT:   (@copper_id, @ep_id, 0.015, 'kg PO4-eq/kg', 'CML 2001', NOW());
-- COMMENTED_OUT: 
-- COMMENTED_OUT: -- GFRP (Glass Fiber Reinforced Polymer) characterization factors
-- COMMENTED_OUT: INSERT IGNORE INTO driver_impact_factors (substance_id, category_id, factor_value, unit, method, created_at)
-- COMMENTED_OUT: VALUES
-- COMMENTED_OUT:   (@gfrp_id, @gwp_id, 5.8, 'kg CO2-eq/kg', 'CML 2001', NOW()),
-- COMMENTED_OUT:   (@gfrp_id, @ap_id, 0.022, 'kg SO2-eq/kg', 'CML 2001', NOW()),
-- COMMENTED_OUT:   (@gfrp_id, @ep_id, 0.012, 'kg PO4-eq/kg', 'CML 2001', NOW());
-- COMMENTED_OUT: 
-- COMMENTED_OUT: -- Electricity characterization factors (grid mix, North America)
-- COMMENTED_OUT: INSERT IGNORE INTO driver_impact_factors (substance_id, category_id, factor_value, unit, method, created_at)
-- COMMENTED_OUT: VALUES
-- COMMENTED_OUT:   (@electricity_id, @gwp_id, 0.45, 'kg CO2-eq/kWh', 'CML 2001', NOW()),
-- COMMENTED_OUT:   (@electricity_id, @ap_id, 0.0012, 'kg SO2-eq/kWh', 'CML 2001', NOW()),
-- COMMENTED_OUT:   (@electricity_id, @ep_id, 0.00008, 'kg PO4-eq/kWh', 'CML 2001', NOW());
-- COMMENTED_OUT: 
-- COMMENTED_OUT: -- CO2 characterization factors
-- COMMENTED_OUT: INSERT IGNORE INTO driver_impact_factors (substance_id, category_id, factor_value, unit, method, created_at)
-- COMMENTED_OUT: VALUES
-- COMMENTED_OUT:   (@co2_id, @gwp_id, 1.0, 'kg CO2-eq/kg', 'CML 2001', NOW());
-- COMMENTED_OUT: 
-- COMMENTED_OUT: SELECT COUNT(*) AS 'Driver Impact Factors Created' FROM driver_impact_factors;
-- COMMENTED_OUT: 
-- COMMENTED_OUT: -- ========================================================================================================
-- SECTION 6: CASE 1 - MSWT BASE CASE (North America)
-- ========================================================================================================
-- Complete 5-level component hierarchy with flows and ABC costing

INSERT INTO case_table (
  project_id,
  case_name,
  description,
  is_base_case,
  functional_unit,
  geographic_region,
  created_at
)
VALUES (
  @project_id,
  'North America: Modular Vertical Axis Wind Turbine (MSWT)',
  'Base case for MSWT deployed in North America. Functional unit: 37 miles² per 1.00 year. Geographic region: Northeast coast, American. Target total impact: 37 ELU.',
  TRUE,
  '37 miles² per 1.00 year',
  'North America - Northeast Coast',
  NOW()
);

SET @case1_id = LAST_INSERT_ID();

SELECT @case1_id AS 'Case 1 ID', 'MSWT Base Case' AS 'Case Name';

-- ========================================================================================================
-- LEVEL 1: PRODUCT - Assembled MSWT System
-- ========================================================================================================

INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  description,
  created_at
)
VALUES (
  @case1_id,
  'Assembled MSWT System',
  'Product',
  'Product',
  1,
  NULL,
  1.0,
  'unit',
  'Complete assembled Modular Vertical Axis Wind Turbine system ready for installation',
  NOW()
);

SET @c1_product = LAST_INSERT_ID();

SELECT @c1_product AS 'Product Component ID';

-- ========================================================================================================
-- LEVEL 2: MACHINE/LINE PROCESSES (5 main systems)
-- ========================================================================================================

-- Level 2.1: Rotor & Blade System
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  material_cost,
  transportation_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Rotor & Blade System',
  'Machine/Line',
  'Machine/Line',
  2,
  @c1_product,
  1.0,
  'unit',
  2500.00,
  800.00,
  15000.00,
  600.00,
  'USD',
  800.00,
  18100.00,
  NOW()
);

SET @c1_rotor_system = LAST_INSERT_ID();

-- Level 2.2: Tower & Support Structure
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  material_cost,
  transportation_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Tower & Support Structure',
  'Machine/Line',
  'Machine/Line',
  2,
  @c1_product,
  1.0,
  'unit',
  3000.00,
  1200.00,
  18000.00,
  800.00,
  'USD',
  1200.00,
  21800.00,
  NOW()
);

SET @c1_tower_system = LAST_INSERT_ID();

-- Level 2.3: Power Generation System
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  material_cost,
  equipment_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Power Generation System',
  'Machine/Line',
  'Machine/Line',
  2,
  @c1_product,
  1.0,
  'unit',
  4000.00,
  600.00,
  12000.00,
  2000.00,
  'USD',
  600.00,
  18000.00,
  NOW()
);

SET @c1_power_system = LAST_INSERT_ID();

-- Level 2.4: Control & Monitoring System
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  material_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Control & Monitoring System',
  'Machine/Line',
  'Machine/Line',
  2,
  @c1_product,
  1.0,
  'unit',
  3500.00,
  400.00,
  8000.00,
  'USD',
  400.00,
  11500.00,
  NOW()
);

SET @c1_control_system = LAST_INSERT_ID();

-- Level 2.5: Assembly & Installation
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  equipment_cost,
  overhead_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Assembly & Installation',
  'Machine/Line',
  'Machine/Line',
  2,
  @c1_product,
  1.0,
  'unit',
  5000.00,
  1000.00,
  1500.00,
  2000.00,
  'USD',
  3000.00,
  6500.00,
  NOW()
);

SET @c1_assembly = LAST_INSERT_ID();

SELECT 'Created 5 Level 2 Components' AS 'Status';

-- ========================================================================================================
-- LEVEL 3: SUBPROCESSES - Rotor & Blade System
-- ========================================================================================================

-- Subprocess 3.1.1: GFRP Blade Manufacturing
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  material_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'GFRP Blade Manufacturing',
  'Subprocess',
  'Subprocess',
  3,
  @c1_rotor_system,
  3.0,
  'unit',
  800.00,
  250.00,
  5000.00,
  'USD',
  250.00,
  5800.00,
  NOW()
);

SET @c1_blade_mfg = LAST_INSERT_ID();

-- Subprocess 3.1.2: Rotor Hub Assembly
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  material_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Rotor Hub Assembly',
  'Subprocess',
  'Subprocess',
  3,
  @c1_rotor_system,
  1.0,
  'unit',
  600.00,
  200.00,
  3000.00,
  'USD',
  200.00,
  3600.00,
  NOW()
);

SET @c1_hub_assembly = LAST_INSERT_ID();

-- Subprocess 3.1.3: Bearing System
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  material_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Bearing System',
  'Subprocess',
  'Subprocess',
  3,
  @c1_rotor_system,
  1.0,
  'unit',
  400.00,
  150.00,
  2000.00,
  'USD',
  150.00,
  2400.00,
  NOW()
);

SET @c1_bearing = LAST_INSERT_ID();

-- ========================================================================================================
-- LEVEL 3: SUBPROCESSES - Tower & Support Structure
-- ========================================================================================================

-- Subprocess 3.2.1: Aluminum Tower Sections
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  material_cost,
  transportation_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Aluminum Tower Sections',
  'Subprocess',
  'Subprocess',
  3,
  @c1_tower_system,
  4.0,
  'unit',
  1200.00,
  500.00,
  8000.00,
  400.00,
  'USD',
  500.00,
  9600.00,
  NOW()
);

SET @c1_tower_sections = LAST_INSERT_ID();

-- Subprocess 3.2.2: Base Plate & Foundation Interface
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  material_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Base Plate & Foundation Interface',
  'Subprocess',
  'Subprocess',
  3,
  @c1_tower_system,
  1.0,
  'unit',
  800.00,
  300.00,
  4000.00,
  'USD',
  300.00,
  4800.00,
  NOW()
);

SET @c1_base_plate = LAST_INSERT_ID();

-- Subprocess 3.2.3: Guy Wire System
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  material_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Guy Wire System',
  'Subprocess',
  'Subprocess',
  3,
  @c1_tower_system,
  1.0,
  'unit',
  400.00,
  150.00,
  1500.00,
  'USD',
  150.00,
  1900.00,
  NOW()
);

SET @c1_guy_wire = LAST_INSERT_ID();

SELECT 'Created Level 3 Subprocesses' AS 'Status';

-- ========================================================================================================
-- LEVEL 4: OPERATIONS - GFRP Blade Manufacturing
-- ========================================================================================================

-- Operation 4.1.1.1: Resin Transfer Molding
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  equipment_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Resin Transfer Molding',
  'Operation',
  'Operation',
  4,
  @c1_blade_mfg,
  3.0,
  'unit',
  300.00,
  100.00,
  500.00,
  'USD',
  100.00,
  800.00,
  NOW()
);

SET @c1_rtm = LAST_INSERT_ID();

-- Operation 4.1.1.2: Blade Finishing & Coating
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  material_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Blade Finishing & Coating',
  'Operation',
  'Operation',
  4,
  @c1_blade_mfg,
  3.0,
  'unit',
  250.00,
  80.00,
  400.00,
  'USD',
  80.00,
  650.00,
  NOW()
);

SET @c1_blade_finishing = LAST_INSERT_ID();

-- Operation 4.1.1.3: Quality Control & Testing
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  equipment_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Quality Control & Testing',
  'Operation',
  'Operation',
  4,
  @c1_blade_mfg,
  3.0,
  'unit',
  200.00,
  50.00,
  300.00,
  'USD',
  50.00,
  500.00,
  NOW()
);

SET @c1_qc_blade = LAST_INSERT_ID();

-- ========================================================================================================
-- LEVEL 4: OPERATIONS - Aluminum Tower Sections
-- ========================================================================================================

-- Operation 4.2.1.1: Aluminum Extrusion
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  material_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Aluminum Extrusion',
  'Operation',
  'Operation',
  4,
  @c1_tower_sections,
  4.0,
  'unit',
  400.00,
  200.00,
  3000.00,
  'USD',
  200.00,
  3400.00,
  NOW()
);

SET @c1_extrusion = LAST_INSERT_ID();

-- Operation 4.2.1.2: Machining & Drilling
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  equipment_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Machining & Drilling',
  'Operation',
  'Operation',
  4,
  @c1_tower_sections,
  4.0,
  'unit',
  350.00,
  150.00,
  400.00,
  'USD',
  150.00,
  750.00,
  NOW()
);

SET @c1_machining = LAST_INSERT_ID();

-- Operation 4.2.1.3: Surface Treatment
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  material_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Surface Treatment',
  'Operation',
  'Operation',
  4,
  @c1_tower_sections,
  4.0,
  'unit',
  200.00,
  100.00,
  600.00,
  'USD',
  100.00,
  800.00,
  NOW()
);

SET @c1_surface_treatment = LAST_INSERT_ID();

SELECT 'Created Level 4 Operations' AS 'Status';

-- ========================================================================================================
-- LEVEL 5: ELEMENTAL TASKS - Resin Transfer Molding
-- ========================================================================================================

-- Task 5.1.1.1.1: Glass Fiber Layup
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  material_cost,
  currency,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Glass Fiber Layup',
  'Elemental Task',
  'Elemental Task',
  5,
  @c1_rtm,
  3.0,
  'unit',
  100.00,
  1500.00,
  'USD',
  1600.00,
  NOW()
);

SET @c1_fiber_layup = LAST_INSERT_ID();

-- Task 5.1.1.1.2: Epoxy Resin Injection
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  material_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Epoxy Resin Injection',
  'Elemental Task',
  'Elemental Task',
  5,
  @c1_rtm,
  3.0,
  'unit',
  80.00,
  50.00,
  1200.00,
  'USD',
  50.00,
  1280.00,
  NOW()
);

SET @c1_resin_injection = LAST_INSERT_ID();

-- Task 5.1.1.1.3: Curing Process
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  equipment_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Curing Process',
  'Elemental Task',
  'Elemental Task',
  5,
  @c1_rtm,
  3.0,
  'unit',
  50.00,
  80.00,
  200.00,
  'USD',
  80.00,
  250.00,
  NOW()
);

SET @c1_curing = LAST_INSERT_ID();

-- ========================================================================================================
-- LEVEL 5: ELEMENTAL TASKS - Aluminum Extrusion
-- ========================================================================================================

-- Task 5.2.1.1.1: Aluminum Billet Preparation
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  material_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Aluminum Billet Preparation',
  'Elemental Task',
  'Elemental Task',
  5,
  @c1_extrusion,
  4.0,
  'unit',
  80.00,
  40.00,
  2000.00,
  'USD',
  40.00,
  2080.00,
  NOW()
);

SET @c1_billet_prep = LAST_INSERT_ID();

-- Task 5.2.1.1.2: Extrusion Pressing
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  equipment_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Extrusion Pressing',
  'Elemental Task',
  'Elemental Task',
  5,
  @c1_extrusion,
  4.0,
  'unit',
  120.00,
  150.00,
  300.00,
  'USD',
  150.00,
  420.00,
  NOW()
);

SET @c1_pressing = LAST_INSERT_ID();

-- Task 5.2.1.1.3: Cooling & Straightening
INSERT INTO component (
  case_id,
  component_name,
  component_type,
  process_type,
  hierarchy_level,
  parent_component_id,
  quantity,
  unit,
  labor_cost,
  energy_cost,
  currency,
  opex,
  capex,
  created_at
)
VALUES (
  @case1_id,
  'Cooling & Straightening',
  'Elemental Task',
  'Elemental Task',
  5,
  @c1_extrusion,
  4.0,
  'unit',
  60.00,
  30.00,
  'USD',
  30.00,
  60.00,
  NOW()
);

SET @c1_cooling = LAST_INSERT_ID();

SELECT 'Created Level 5 Elemental Tasks' AS 'Status';

-- ========================================================================================================
-- FLOWS - Link Elemental Tasks to Substances
-- ========================================================================================================

-- Get substance IDs for flows
SET @gfrp_id = (SELECT substance_id FROM substances WHERE substance_name = 'Glass fiber reinforced polymer (GFRP)' LIMIT 1);
SET @epoxy_id = (SELECT substance_id FROM substances WHERE substance_name = 'Epoxy resin' LIMIT 1);
SET @aluminum_id = (SELECT substance_id FROM substances WHERE substance_name = 'Aluminum, primary' LIMIT 1);
SET @aluminum_alloy_id = (SELECT substance_id FROM substances WHERE substance_name = 'Aluminum alloy, economical' LIMIT 1);
SET @steel_id = (SELECT substance_id FROM substances WHERE substance_name = 'Steel, reinforced' LIMIT 1);
SET @copper_id = (SELECT substance_id FROM substances WHERE substance_name = 'Copper, primary' LIMIT 1);
SET @electricity_id = (SELECT substance_id FROM substances WHERE substance_name = 'Electricity, grid mix' LIMIT 1);
SET @mfg_energy_id = (SELECT substance_id FROM substances WHERE substance_name = 'Manufacturing energy' LIMIT 1);
SET @co2_id = (SELECT substance_id FROM substances WHERE substance_name = 'Carbon dioxide (CO2)' LIMIT 1);

-- Flows for Glass Fiber Layup
INSERT INTO flows (component_id, substance_id, direction, amount, unit, is_driver, created_at)
VALUES
  (@c1_fiber_layup, @gfrp_id, 'input', 45.0, 'kg', TRUE, NOW()),
  (@c1_fiber_layup, @electricity_id, 'input', 15.0, 'kWh', FALSE, NOW()),
  (@c1_fiber_layup, @co2_id, 'output', 7.5, 'kg', FALSE, NOW());

-- Flows for Epoxy Resin Injection
INSERT INTO flows (component_id, substance_id, direction, amount, unit, is_driver, created_at)
VALUES
  (@c1_resin_injection, @epoxy_id, 'input', 25.0, 'kg', TRUE, NOW()),
  (@c1_resin_injection, @electricity_id, 'input', 12.0, 'kWh', FALSE, NOW()),
  (@c1_resin_injection, @co2_id, 'output', 5.0, 'kg', FALSE, NOW());

-- Flows for Curing Process
INSERT INTO flows (component_id, substance_id, direction, amount, unit, is_driver, created_at)
VALUES
  (@c1_curing, @mfg_energy_id, 'input', 35.0, 'kWh', TRUE, NOW()),
  (@c1_curing, @co2_id, 'output', 15.0, 'kg', FALSE, NOW());

-- Flows for Aluminum Billet Preparation
INSERT INTO flows (component_id, substance_id, direction, amount, unit, is_driver, created_at)
VALUES
  (@c1_billet_prep, @aluminum_id, 'input', 156.15, 'kg', TRUE, NOW()),
  (@c1_billet_prep, @electricity_id, 'input', 25.0, 'kWh', FALSE, NOW()),
  (@c1_billet_prep, @co2_id, 'output', 10.0, 'kg', FALSE, NOW());

-- Flows for Extrusion Pressing
INSERT INTO flows (component_id, substance_id, direction, amount, unit, is_driver, created_at)
VALUES
  (@c1_pressing, @mfg_energy_id, 'input', 120.0, 'kWh', TRUE, NOW()),
  (@c1_pressing, @co2_id, 'output', 50.0, 'kg', FALSE, NOW());

-- Flows for Cooling & Straightening
INSERT INTO flows (component_id, substance_id, direction, amount, unit, is_driver, created_at)
VALUES
  (@c1_cooling, @electricity_id, 'input', 20.0, 'kWh', FALSE, NOW()),
  (@c1_cooling, @co2_id, 'output', 8.0, 'kg', FALSE, NOW());

SELECT COUNT(*) AS 'Flows Created for Case 1' FROM flows WHERE component_id IN (
  SELECT component_id FROM component WHERE case_id = @case1_id
);

-- ========================================================================================================
-- COMPONENT HIERARCHY SUMMARY FOR CASE 1
-- ========================================================================================================

SELECT
  hierarchy_level,
  COUNT(*) as component_count,
  SUM(COALESCE(labor_cost, 0)) as total_labor,
  SUM(COALESCE(energy_cost, 0)) as total_energy,
  SUM(COALESCE(material_cost, 0)) as total_material,
  SUM(COALESCE(capex, 0)) as total_capex,
  SUM(COALESCE(opex, 0)) as total_opex
FROM component
WHERE case_id = @case1_id
GROUP BY hierarchy_level
ORDER BY hierarchy_level;

SELECT 'CASE 1 MSWT BASE CASE COMPLETED' AS 'STATUS';
SELECT 'Next: Creating Case 2 - Heat Pump' AS 'NEXT STEP';

-- ========================================================================================================
-- SECTION 7: CASE 2 - HEAT PUMP (North America) - COMPARATIVE
-- ========================================================================================================
-- Streamlined hierarchy focusing on key differences from MSWT

INSERT INTO case_table (
  project_id,
  case_name,
  description,
  is_base_case,
  functional_unit,
  geographic_region,
  created_at
)
VALUES (
  @project_id,
  'North America: Heat Pump',
  'Comparative case for Heat Pump technology deployed in North America. Functional unit: 16 miles² per 1.00 year. Target total impact: 16 ELU (56% better than base case). Superior efficiency through heat exchange technology.',
  FALSE,
  '16 miles² per 1.00 year',
  'North America - Northeast Coast',
  NOW()
);

SET @case2_id = LAST_INSERT_ID();

SELECT @case2_id AS 'Case 2 ID', 'Heat Pump' AS 'Case Name';

-- Level 1: Product
INSERT INTO component (
  case_id, component_name, component_type, process_type, hierarchy_level,
  parent_component_id, quantity, unit, created_at
)
VALUES (
  @case2_id, 'Heat Pump System', 'Product', 'Product', 1,
  NULL, 1.0, 'unit', NOW()
);

SET @c2_product = LAST_INSERT_ID();

-- Level 2: Main Systems (streamlined)
INSERT INTO component (
  case_id, component_name, component_type, process_type, hierarchy_level,
  parent_component_id, quantity, unit, labor_cost, energy_cost, material_cost,
  currency, opex, capex, created_at
) VALUES
  (@case2_id, 'Compressor Unit', 'Machine/Line', 'Machine/Line', 2, @c2_product, 1.0, 'unit', 1500.00, 400.00, 8000.00, 'USD', 400.00, 9500.00, NOW()),
  (@case2_id, 'Heat Exchanger', 'Machine/Line', 'Machine/Line', 2, @c2_product, 2.0, 'unit', 1200.00, 300.00, 5000.00, 'USD', 300.00, 6200.00, NOW()),
  (@case2_id, 'Refrigerant System', 'Machine/Line', 'Machine/Line', 2, @c2_product, 1.0, 'unit', 800.00, 200.00, 3000.00, 'USD', 200.00, 3800.00, NOW()),
  (@case2_id, 'Control Electronics', 'Machine/Line', 'Machine/Line', 2, @c2_product, 1.0, 'unit', 1000.00, 150.00, 4000.00, 'USD', 150.00, 5000.00, NOW()),
  (@case2_id, 'Housing & Installation', 'Machine/Line', 'Machine/Line', 2, @c2_product, 1.0, 'unit', 600.00, 100.00, 2000.00, 'USD', 100.00, 2600.00, NOW());

SET @c2_compressor = LAST_INSERT_ID() - 4;
SET @c2_heat_exchanger = LAST_INSERT_ID() - 3;
SET @c2_refrigerant = LAST_INSERT_ID() - 2;
SET @c2_electronics = LAST_INSERT_ID() - 1;
SET @c2_housing = LAST_INSERT_ID();

-- Level 3-5: Simplified hierarchy for key components
INSERT INTO component (
  case_id, component_name, component_type, process_type, hierarchy_level,
  parent_component_id, quantity, unit, labor_cost, energy_cost, material_cost,
  currency, capex, created_at
) VALUES
  (@case2_id, 'Copper Coil Fabrication', 'Subprocess', 'Subprocess', 3, @c2_heat_exchanger, 2.0, 'unit', 400.00, 100.00, 1500.00, 'USD', 2000.00, NOW()),
  (@case2_id, 'Aluminum Fin Assembly', 'Subprocess', 'Subprocess', 3, @c2_heat_exchanger, 2.0, 'unit', 300.00, 80.00, 1000.00, 'USD', 1380.00, NOW());

SET @c2_coil_fab = LAST_INSERT_ID() - 1;
SET @c2_fin_assembly = LAST_INSERT_ID();

INSERT INTO component (
  case_id, component_name, component_type, process_type, hierarchy_level,
  parent_component_id, quantity, unit, labor_cost, energy_cost, equipment_cost,
  currency, opex, capex, created_at
) VALUES
  (@case2_id, 'Coil Bending', 'Operation', 'Operation', 4, @c2_coil_fab, 2.0, 'unit', 150.00, 40.00, 100.00, 'USD', 40.00, 250.00, NOW()),
  (@case2_id, 'Brazing & Assembly', 'Operation', 'Operation', 4, @c2_coil_fab, 2.0, 'unit', 120.00, 30.00, 80.00, 'USD', 30.00, 200.00, NOW());

SET @c2_coil_bend = LAST_INSERT_ID() - 1;
SET @c2_brazing = LAST_INSERT_ID();

INSERT INTO component (
  case_id, component_name, component_type, process_type, hierarchy_level,
  parent_component_id, quantity, unit, labor_cost, energy_cost, material_cost,
  currency, opex, capex, created_at
) VALUES
  (@case2_id, 'Copper Tube Processing', 'Elemental Task', 'Elemental Task', 5, @c2_coil_bend, 2.0, 'unit', 60.00, 20.00, 800.00, 'USD', 20.00, 860.00, NOW()),
  (@case2_id, 'Heating & Forming', 'Elemental Task', 'Elemental Task', 5, @c2_coil_bend, 2.0, 'unit', 40.00, 25.00, 100.00, 'USD', 25.00, 140.00, NOW());

SET @c2_tube_process = LAST_INSERT_ID() - 1;
SET @c2_heating = LAST_INSERT_ID();

-- Flows for Heat Pump (lighter materials, higher efficiency)
SET @copper_id = (SELECT substance_id FROM substances WHERE substance_name = 'Copper, primary' LIMIT 1);
SET @aluminum_alloy_id = (SELECT substance_id FROM substances WHERE substance_name = 'Aluminum alloy, economical' LIMIT 1);
SET @refrigerant_id = (SELECT substance_id FROM substances WHERE substance_name = 'Refrigerant R-410A' LIMIT 1);
SET @electricity_id = (SELECT substance_id FROM substances WHERE substance_name = 'Electricity, grid mix' LIMIT 1);

INSERT INTO flows (component_id, substance_id, direction, amount, unit, is_driver, created_at)
VALUES
  (@c2_tube_process, @copper_id, 'input', 25.0, 'kg', TRUE, NOW()),
  (@c2_tube_process, @electricity_id, 'input', 8.0, 'kWh', FALSE, NOW()),
  (@c2_heating, @electricity_id, 'input', 15.0, 'kWh', TRUE, NOW()),
  (@c2_heating, @aluminum_alloy_id, 'input', 12.0, 'kg', FALSE, NOW());

SELECT 'CASE 2 HEAT PUMP COMPLETED' AS 'STATUS';

-- ========================================================================================================
-- SECTION 8: CASE 3 - COASTAL NORTH SEA (ONSHORE) - COMPARATIVE
-- ========================================================================================================

INSERT INTO case_table (
  project_id,
  case_name,
  description,
  is_base_case,
  functional_unit,
  geographic_region,
  created_at
)
VALUES (
  @project_id,
  'Coastal North Sea (Onshore)',
  'Comparative case for offshore wind turbine deployed in Coastal North Sea region. Functional unit: 37 miles² per 1.00 year. Target total impact: 37 ELU (similar to base case). Regional supply chain and installation considerations.',
  FALSE,
  '37 miles² per 1.00 year',
  'Europe - North Sea Coast',
  NOW()
);

SET @case3_id = LAST_INSERT_ID();

SELECT @case3_id AS 'Case 3 ID', 'Coastal North Sea' AS 'Case Name';

-- Level 1: Product
INSERT INTO component (
  case_id, component_name, component_type, process_type, hierarchy_level,
  parent_component_id, quantity, unit, created_at
)
VALUES (
  @case3_id, 'Coastal Wind Turbine System', 'Product', 'Product', 1,
  NULL, 1.0, 'unit', NOW()
);

SET @c3_product = LAST_INSERT_ID();

-- Level 2: Main Systems (similar to base but with regional variations)
INSERT INTO component (
  case_id, component_name, component_type, process_type, hierarchy_level,
  parent_component_id, quantity, unit, labor_cost, energy_cost, material_cost,
  transportation_cost, currency, opex, capex, created_at
) VALUES
  (@case3_id, 'Offshore Rotor System', 'Machine/Line', 'Machine/Line', 2, @c3_product, 1.0, 'unit', 2800.00, 900.00, 16000.00, 1200.00, 'USD', 900.00, 19800.00, NOW()),
  (@case3_id, 'Marine-Grade Tower', 'Machine/Line', 'Machine/Line', 2, @c3_product, 1.0, 'unit', 3500.00, 1400.00, 20000.00, 1500.00, 'USD', 1400.00, 24500.00, NOW()),
  (@case3_id, 'Generator & Drivetrain', 'Machine/Line', 'Machine/Line', 2, @c3_product, 1.0, 'unit', 4500.00, 700.00, 14000.00, 800.00, 'USD', 700.00, 19300.00, NOW()),
  (@case3_id, 'Marine Installation', 'Machine/Line', 'Machine/Line', 2, @c3_product, 1.0, 'unit', 6000.00, 1200.00, 5000.00, 2000.00, 'USD', 3200.00, 11000.00, NOW());

SET @c3_rotor = LAST_INSERT_ID() - 3;
SET @c3_tower = LAST_INSERT_ID() - 2;
SET @c3_generator = LAST_INSERT_ID() - 1;
SET @c3_install = LAST_INSERT_ID();

-- Level 3-5: Simplified hierarchy
INSERT INTO component (
  case_id, component_name, component_type, process_type, hierarchy_level,
  parent_component_id, quantity, unit, labor_cost, energy_cost, material_cost,
  currency, capex, created_at
) VALUES
  (@case3_id, 'Corrosion-Resistant Coating', 'Subprocess', 'Subprocess', 3, @c3_tower, 1.0, 'unit', 1000.00, 300.00, 3000.00, 'USD', 4300.00, NOW()),
  (@case3_id, 'Reinforced Foundation', 'Subprocess', 'Subprocess', 3, @c3_tower, 1.0, 'unit', 1500.00, 500.00, 5000.00, 'USD', 7000.00, NOW());

SET @c3_coating = LAST_INSERT_ID() - 1;
SET @c3_foundation = LAST_INSERT_ID();

INSERT INTO component (
  case_id, component_name, component_type, process_type, hierarchy_level,
  parent_component_id, quantity, unit, labor_cost, energy_cost, material_cost,
  currency, opex, capex, created_at
) VALUES
  (@case3_id, 'Zinc Coating Application', 'Operation', 'Operation', 4, @c3_coating, 1.0, 'unit', 400.00, 120.00, 1200.00, 'USD', 120.00, 1600.00, NOW()),
  (@case3_id, 'Cast Iron Base Fabrication', 'Operation', 'Operation', 4, @c3_foundation, 1.0, 'unit', 600.00, 200.00, 2000.00, 'USD', 200.00, 2600.00, NOW());

SET @c3_zinc_coating = LAST_INSERT_ID() - 1;
SET @c3_base_fab = LAST_INSERT_ID();

INSERT INTO component (
  case_id, component_name, component_type, process_type, hierarchy_level,
  parent_component_id, quantity, unit, labor_cost, energy_cost, material_cost,
  currency, opex, capex, created_at
) VALUES
  (@case3_id, 'Zinc Powder Preparation', 'Elemental Task', 'Elemental Task', 5, @c3_zinc_coating, 1.0, 'unit', 150.00, 50.00, 400.00, 'USD', 50.00, 550.00, NOW()),
  (@case3_id, 'Cast Iron Molding', 'Elemental Task', 'Elemental Task', 5, @c3_base_fab, 1.0, 'unit', 250.00, 80.00, 800.00, 'USD', 80.00, 1050.00, NOW());

SET @c3_zinc_prep = LAST_INSERT_ID() - 1;
SET @c3_molding = LAST_INSERT_ID();

-- Flows for Coastal North Sea
SET @zinc_id = (SELECT substance_id FROM substances WHERE substance_name = 'Zinc powder, economical' LIMIT 1);
SET @cast_iron_id = (SELECT substance_id FROM substances WHERE substance_name = 'Cast iron' LIMIT 1);
SET @steel_id = (SELECT substance_id FROM substances WHERE substance_name = 'Steel, reinforced' LIMIT 1);

INSERT INTO flows (component_id, substance_id, direction, amount, unit, is_driver, created_at)
VALUES
  (@c3_zinc_prep, @zinc_id, 'input', 1.25, 'kg', TRUE, NOW()),
  (@c3_zinc_prep, @electricity_id, 'input', 5.0, 'kWh', FALSE, NOW()),
  (@c3_molding, @cast_iron_id, 'input', 10.46, 'kg', TRUE, NOW()),
  (@c3_molding, @electricity_id, 'input', 12.0, 'kWh', FALSE, NOW()),
  (@c3_molding, @steel_id, 'input', 15.0, 'kg', FALSE, NOW());

SELECT 'CASE 3 COASTAL NORTH SEA COMPLETED' AS 'STATUS';

-- ========================================================================================================
-- SECTION 9: CASE 4 - US GREAT PLAINS HUB AND SPOKE - COMPARATIVE
-- ========================================================================================================

INSERT INTO case_table (
  project_id,
  case_name,
  description,
  is_base_case,
  functional_unit,
  geographic_region,
  created_at
)
VALUES (
  @project_id,
  'US Great Plains Hub and Spoke',
  'Comparative case for distributed wind energy system in US Great Plains. Functional unit: 37 miles² per 1.00 year. Target total impact: 37 ELU. Hub-and-spoke distribution model with centralized manufacturing.',
  FALSE,
  '37 miles² per 1.00 year',
  'North America - Great Plains',
  NOW()
);

SET @case4_id = LAST_INSERT_ID();

SELECT @case4_id AS 'Case 4 ID', 'US Great Plains' AS 'Case Name';

-- Level 1: Product
INSERT INTO component (
  case_id, component_name, component_type, process_type, hierarchy_level,
  parent_component_id, quantity, unit, created_at
)
VALUES (
  @case4_id, 'Distributed Wind System (Hub & Spoke)', 'Product', 'Product', 1,
  NULL, 1.0, 'unit', NOW()
);

SET @c4_product = LAST_INSERT_ID();

-- Level 2: Main Systems (hub-and-spoke model)
INSERT INTO component (
  case_id, component_name, component_type, process_type, hierarchy_level,
  parent_component_id, quantity, unit, labor_cost, energy_cost, material_cost,
  transportation_cost, currency, opex, capex, created_at
) VALUES
  (@case4_id, 'Central Manufacturing Hub', 'Machine/Line', 'Machine/Line', 2, @c4_product, 1.0, 'unit', 3000.00, 1000.00, 18000.00, 500.00, 'USD', 1000.00, 21500.00, NOW()),
  (@case4_id, 'Modular Turbine Units', 'Machine/Line', 'Machine/Line', 2, @c4_product, 5.0, 'unit', 2000.00, 600.00, 12000.00, 400.00, 'USD', 600.00, 14400.00, NOW()),
  (@case4_id, 'Regional Distribution Network', 'Machine/Line', 'Machine/Line', 2, @c4_product, 1.0, 'unit', 1500.00, 400.00, 8000.00, 2000.00, 'USD', 2400.00, 9500.00, NOW()),
  (@case4_id, 'Smart Grid Integration', 'Machine/Line', 'Machine/Line', 2, @c4_product, 1.0, 'unit', 2500.00, 300.00, 6000.00, 200.00, 'USD', 300.00, 8700.00, NOW());

SET @c4_hub = LAST_INSERT_ID() - 3;
SET @c4_turbines = LAST_INSERT_ID() - 2;
SET @c4_distribution = LAST_INSERT_ID() - 1;
SET @c4_smart_grid = LAST_INSERT_ID();

-- Level 3-5: Simplified hierarchy
INSERT INTO component (
  case_id, component_name, component_type, process_type, hierarchy_level,
  parent_component_id, quantity, unit, labor_cost, energy_cost, material_cost,
  currency, capex, created_at
) VALUES
  (@case4_id, 'Batch Production Line', 'Subprocess', 'Subprocess', 3, @c4_hub, 1.0, 'unit', 1200.00, 400.00, 7000.00, 'USD', 8600.00, NOW()),
  (@case4_id, 'Quality Assurance Center', 'Subprocess', 'Subprocess', 3, @c4_hub, 1.0, 'unit', 800.00, 200.00, 3000.00, 'USD', 4000.00, NOW());

SET @c4_production = LAST_INSERT_ID() - 1;
SET @c4_qa = LAST_INSERT_ID();

INSERT INTO component (
  case_id, component_name, component_type, process_type, hierarchy_level,
  parent_component_id, quantity, unit, labor_cost, energy_cost, equipment_cost,
  currency, opex, capex, created_at
) VALUES
  (@case4_id, 'Automated Assembly', 'Operation', 'Operation', 4, @c4_production, 1.0, 'unit', 500.00, 150.00, 1000.00, 'USD', 150.00, 1500.00, NOW()),
  (@case4_id, 'Performance Testing', 'Operation', 'Operation', 4, @c4_qa, 1.0, 'unit', 300.00, 80.00, 500.00, 'USD', 80.00, 800.00, NOW());

SET @c4_assembly = LAST_INSERT_ID() - 1;
SET @c4_testing = LAST_INSERT_ID();

INSERT INTO component (
  case_id, component_name, component_type, process_type, hierarchy_level,
  parent_component_id, quantity, unit, labor_cost, energy_cost, material_cost,
  currency, opex, capex, created_at
) VALUES
  (@case4_id, 'Component Integration', 'Elemental Task', 'Elemental Task', 5, @c4_assembly, 1.0, 'unit', 200.00, 60.00, 2000.00, 'USD', 60.00, 2200.00, NOW()),
  (@case4_id, 'Load Testing', 'Elemental Task', 'Elemental Task', 5, @c4_testing, 1.0, 'unit', 100.00, 30.00, 200.00, 'USD', 30.00, 300.00, NOW());

SET @c4_integration = LAST_INSERT_ID() - 1;
SET @c4_load_test = LAST_INSERT_ID();

-- Flows for US Great Plains
INSERT INTO flows (component_id, substance_id, direction, amount, unit, is_driver, created_at)
VALUES
  (@c4_integration, @aluminum_id, 'input', 50.0, 'kg', TRUE, NOW()),
  (@c4_integration, @steel_id, 'input', 80.0, 'kg', TRUE, NOW()),
  (@c4_integration, @electricity_id, 'input', 25.0, 'kWh', FALSE, NOW()),
  (@c4_load_test, @electricity_id, 'input', 15.0, 'kWh', TRUE, NOW());

SELECT 'CASE 4 US GREAT PLAINS COMPLETED' AS 'STATUS';

-- ========================================================================================================
-- VERIFICATION QUERIES
-- ========================================================================================================

SELECT '=' AS '================================================================================';
SELECT 'MSWT PROJECT DATA POPULATION COMPLETE' AS 'STATUS';
SELECT '=' AS '================================================================================';

-- Summary by case
SELECT
  c.case_id,
  c.case_name,
  c.is_base_case,
  c.functional_unit,
  COUNT(comp.component_id) as total_components,
  SUM(CASE WHEN comp.hierarchy_level = 1 THEN 1 ELSE 0 END) as level_1_count,
  SUM(CASE WHEN comp.hierarchy_level = 2 THEN 1 ELSE 0 END) as level_2_count,
  SUM(CASE WHEN comp.hierarchy_level = 3 THEN 1 ELSE 0 END) as level_3_count,
  SUM(CASE WHEN comp.hierarchy_level = 4 THEN 1 ELSE 0 END) as level_4_count,
  SUM(CASE WHEN comp.hierarchy_level = 5 THEN 1 ELSE 0 END) as level_5_count,
  SUM(COALESCE(comp.capex, 0)) as total_capex,
  SUM(COALESCE(comp.opex, 0)) as total_opex
FROM case_table c
LEFT JOIN component comp ON c.case_id = comp.case_id
WHERE c.project_id = @project_id
GROUP BY c.case_id, c.case_name, c.is_base_case, c.functional_unit
ORDER BY c.is_base_case DESC, c.case_id;

-- Flow summary
SELECT
  c.case_name,
  COUNT(DISTINCT f.flow_id) as total_flows,
  COUNT(DISTINCT f.substance_id) as unique_substances,
  SUM(CASE WHEN f.direction = 'input' THEN 1 ELSE 0 END) as input_flows,
  SUM(CASE WHEN f.direction = 'output' THEN 1 ELSE 0 END) as output_flows,
  SUM(CASE WHEN f.is_driver = TRUE THEN 1 ELSE 0 END) as driver_flows
FROM case_table c
LEFT JOIN component comp ON c.case_id = comp.case_id
LEFT JOIN flows f ON comp.component_id = f.component_id
WHERE c.project_id = @project_id
GROUP BY c.case_name
ORDER BY c.is_base_case DESC, c.case_id;

SELECT '=' AS '================================================================================';
SELECT 'NEXT STEP: Run execute-mswt-data.js to load this data and run assessments' AS 'INSTRUCTION';
SELECT '=' AS '================================================================================';

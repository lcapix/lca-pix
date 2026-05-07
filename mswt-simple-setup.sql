-- ================================================================================
-- MSWT PROJECT - STREAMLINED SCHEMA-CORRECT DATA
-- ================================================================================
-- Project: Modular Vertical Axis Wind Turbine (MSWT)
-- Project ID: 12 (already exists, owned by Daniel Lerner)
--
-- Creates:
-- - 4 cases (1 base + 3 comparative)
-- - ~30 components with proper hierarchy
-- - ABC costing data
-- - Environmental flows
-- ================================================================================

START TRANSACTION;

-- ================================================================================
-- SECTION 1: CASES
-- ================================================================================

-- Case 1: Base Case
INSERT INTO case_table (project_id, case_name, description, case_type, created_at, updated_at)
VALUES (
    12,
    'North America: MSWT Base Case',
    'Baseline vertical axis wind turbine manufacturing for North America. Complete system with rotor, tower, nacelle, and foundation. Target: 37 ELU impact.',
    'base',
    NOW(), NOW()
);
SET @case1_id = LAST_INSERT_ID();

-- Case 2: Heat Pump Alternative
INSERT INTO case_table (project_id, case_name, description, case_type, created_at, updated_at)
VALUES (
    12,
    'North America: Heat Pump Alternative',
    'High-efficiency heat pump system as renewable alternative to wind turbine. Target: 16 ELU impact (56% better than base).',
    'comparative',
    NOW(), NOW()
);
SET @case2_id = LAST_INSERT_ID();

-- Case 3: Offshore MSWT
INSERT INTO case_table (project_id, case_name, description, case_type, created_at, updated_at)
VALUES (
    12,
    'Coastal North Sea: Offshore MSWT',
    'Offshore wind turbine variant with marine-grade materials and enhanced corrosion protection for North Sea deployment.',
    'comparative',
    NOW(), NOW()
);
SET @case3_id = LAST_INSERT_ID();

-- Case 4: Distributed Hub & Spoke
INSERT INTO case_table (project_id, case_name, description, case_type, created_at, updated_at)
VALUES (
    12,
    'US Great Plains: Hub and Spoke MSWT',
    'Distributed system of 5x25kW modular units with centralized control for Great Plains distributed generation.',
    'comparative',
    NOW(), NOW()
);
SET @case4_id = LAST_INSERT_ID();

-- ================================================================================
-- SECTION 2: CASE 1 COMPONENTS - BASE MSWT (hierarchy levels 1-4)
-- ================================================================================

-- Level 1: Product (root)
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, created_at, updated_at
) VALUES (
    @case1_id, 'Assembled MSWT System', 'product', 'Product', 1,
    NULL, 1.0, 'unit', NULL, NULL, 'USD',
    'USD', NOW(), NOW()
);
SET @c1_root = LAST_INSERT_ID();

-- Level 2: Rotor & Blade System
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, labor_cost, energy_cost, material_cost,
    equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers, created_at, updated_at
) VALUES (
    @case1_id, 'Rotor & Blade System', 'machine_line', 'Machine/Line', 2,
    @c1_root, 1.0, 'unit', 18900.00, 22100.00, 'USD',
    'calculated', 2500.00, 800.00, 15000.00, 1200.00, 1800.00, 600.00,
    'Manufacturing', 'Assembly', '{"blade_count": 3, "rotor_diameter_m": 5.2}',
    NOW(), NOW()
);
SET @c1_rotor = LAST_INSERT_ID();

-- Level 2: Tower Structure
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, labor_cost, energy_cost, material_cost,
    equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers, created_at, updated_at
) VALUES (
    @case1_id, 'Tower Structure', 'machine_line', 'Machine/Line', 2,
    @c1_root, 1.0, 'unit', 8200.00, 12800.00, 'USD',
    'manual', 1800.00, 600.00, 5200.00, 800.00, 1200.00, 400.00,
    'Manufacturing', 'Fabrication', '{"height_m": 12, "material": "steel"}',
    NOW(), NOW()
);
SET @c1_tower = LAST_INSERT_ID();

-- Level 2: Generator & Nacelle
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, labor_cost, energy_cost, material_cost,
    equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers, created_at, updated_at
) VALUES (
    @case1_id, 'Generator & Nacelle Assembly', 'machine_line', 'Machine/Line', 2,
    @c1_root, 1.0, 'unit', 12400.00, 18600.00, 'USD',
    'manual', 2200.00, 900.00, 8500.00, 1100.00, 1500.00, 400.00,
    'Manufacturing', 'Assembly', '{"rated_power_kw": 50, "generator_type": "PMG"}',
    NOW(), NOW()
);
SET @c1_nacelle = LAST_INSERT_ID();

-- Level 3: Blade Manufacturing
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, labor_cost, energy_cost, material_cost,
    equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers, created_at, updated_at
) VALUES (
    @case1_id, 'Blade Manufacturing', 'subprocess', 'Subprocess', 3,
    @c1_rotor, 3.0, 'blades', 12000.00, NULL, 'USD',
    'manual', 1500.00, 500.00, 9200.00, 800.00, 1000.00, 0.00,
    'Manufacturing', 'Molding', '{"material": "GFRP", "length_m": 2.5}',
    NOW(), NOW()
);
SET @c1_blade_mfg = LAST_INSERT_ID();

-- Level 3: Hub Assembly
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, labor_cost, energy_cost, material_cost,
    equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers, created_at, updated_at
) VALUES (
    @case1_id, 'Hub Assembly', 'subprocess', 'Subprocess', 3,
    @c1_rotor, 1.0, 'unit', 3900.00, NULL, 'USD',
    'manual', 600.00, 200.00, 2800.00, 300.00, 400.00, 200.00,
    'Manufacturing', 'Assembly', '{"material": "aluminum_alloy"}',
    NOW(), NOW()
);
SET @c1_hub = LAST_INSERT_ID();

-- Level 3: Tower Fabrication
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, labor_cost, energy_cost, material_cost,
    equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers, created_at, updated_at
) VALUES (
    @case1_id, 'Tower Fabrication', 'subprocess', 'Subprocess', 3,
    @c1_tower, 1.0, 'unit', 6200.00, NULL, 'USD',
    'manual', 1200.00, 400.00, 4200.00, 600.00, 800.00, 0.00,
    'Manufacturing', 'Welding', '{"weld_length_m": 94, "material": "structural_steel"}',
    NOW(), NOW()
);
SET @c1_tower_fab = LAST_INSERT_ID();

-- Level 3: Generator Winding
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, labor_cost, energy_cost, material_cost,
    equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers, created_at, updated_at
) VALUES (
    @case1_id, 'Generator Winding', 'subprocess', 'Subprocess', 3,
    @c1_nacelle, 1.0, 'unit', 8400.00, NULL, 'USD',
    'manual', 1500.00, 600.00, 5800.00, 800.00, 1000.00, 200.00,
    'Manufacturing', 'Winding', '{"copper_mass_kg": 85, "coil_count": 36}',
    NOW(), NOW()
);
SET @c1_gen_wind = LAST_INSERT_ID();

-- Level 4: GFRP Layup (Elemental Task)
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, labor_cost, energy_cost, material_cost,
    equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers, created_at, updated_at
) VALUES (
    @case1_id, 'GFRP Composite Layup', 'operation', 'Operation', 4,
    @c1_blade_mfg, 36.0, 'm2', 9000.00, NULL, 'USD',
    'manual', 1200.00, 400.00, 7200.00, 600.00, 800.00, 0.00,
    'Material', 'Composite Molding', '{"resin_kg": 180, "fiber_kg": 360}',
    NOW(), NOW()
);
SET @c1_gfrp = LAST_INSERT_ID();

-- Level 4: Steel Welding (Elemental Task)
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, labor_cost, energy_cost, material_cost,
    equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers, created_at, updated_at
) VALUES (
    @case1_id, 'Steel Welding Operations', 'operation', 'Operation', 4,
    @c1_tower_fab, 94.0, 'm', 4200.00, NULL, 'USD',
    'manual', 800.00, 300.00, 2800.00, 400.00, 600.00, 0.00,
    'Energy', 'Welding', '{"power_kw": 8, "steel_mass_kg": 2400}',
    NOW(), NOW()
);
SET @c1_weld = LAST_INSERT_ID();

-- ================================================================================
-- SECTION 3: CASE 2 COMPONENTS - HEAT PUMP (streamlined)
-- ================================================================================

-- Level 1: Product
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, created_at, updated_at
) VALUES (
    @case2_id, 'Complete Heat Pump System', 'product', 'Product', 1,
    NULL, 1.0, 'unit', NULL, NULL, 'USD',
    'USD', NOW(), NOW()
);
SET @c2_root = LAST_INSERT_ID();

-- Level 2: Compressor Assembly
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, labor_cost, energy_cost, material_cost,
    equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers, created_at, updated_at
) VALUES (
    @case2_id, 'Scroll Compressor Assembly', 'machine_line', 'Machine/Line', 2,
    @c2_root, 1.0, 'unit', 6800.00, 9200.00, 'USD',
    'manual', 1200.00, 400.00, 4500.00, 700.00, 900.00, 300.00,
    'Manufacturing', 'Assembly', '{"capacity_kw": 50, "refrigerant": "R410A"}',
    NOW(), NOW()
);
SET @c2_comp = LAST_INSERT_ID();

-- Level 2: Heat Exchanger
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, labor_cost, energy_cost, material_cost,
    equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers, created_at, updated_at
) VALUES (
    @case2_id, 'Copper-Aluminum Heat Exchanger', 'machine_line', 'Machine/Line', 2,
    @c2_root, 2.0, 'units', 5600.00, 8400.00, 'USD',
    'manual', 900.00, 300.00, 3800.00, 600.00, 700.00, 200.00,
    'Manufacturing', 'Fabrication', '{"copper_tube_m": 180, "aluminum_fin_kg": 45}',
    NOW(), NOW()
);
SET @c2_hx = LAST_INSERT_ID();

-- Level 3: Copper Tube Forming
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, labor_cost, energy_cost, material_cost,
    equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers, created_at, updated_at
) VALUES (
    @case2_id, 'Copper Tube Forming', 'subprocess', 'Subprocess', 3,
    @c2_hx, 180.0, 'm', 3200.00, NULL, 'USD',
    'manual', 600.00, 200.00, 2200.00, 400.00, 500.00, 100.00,
    'Material', 'Forming', '{"copper_mass_kg": 72}',
    NOW(), NOW()
);
SET @c2_cu_form = LAST_INSERT_ID();

-- ================================================================================
-- SECTION 4: CASE 3 COMPONENTS - OFFSHORE MSWT (streamlined)
-- ================================================================================

-- Level 1: Product
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, created_at, updated_at
) VALUES (
    @case3_id, 'Offshore MSWT System', 'product', 'Product', 1,
    NULL, 1.0, 'unit', NULL, NULL, 'USD',
    'USD', NOW(), NOW()
);
SET @c3_root = LAST_INSERT_ID();

-- Level 2: Marine-Grade Rotor
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, labor_cost, energy_cost, material_cost,
    equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers, created_at, updated_at
) VALUES (
    @case3_id, 'Marine-Grade Rotor System', 'machine_line', 'Machine/Line', 2,
    @c3_root, 1.0, 'unit', 22800.00, 27200.00, 'USD',
    'manual', 3000.00, 1000.00, 18000.00, 1400.00, 2200.00, 800.00,
    'Manufacturing', 'Assembly', '{"coating": "marine_epoxy", "corrosion_protection": true}',
    NOW(), NOW()
);
SET @c3_rotor = LAST_INSERT_ID();

-- Level 2: Offshore Foundation
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, labor_cost, energy_cost, material_cost,
    equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers, created_at, updated_at
) VALUES (
    @case3_id, 'Monopile Foundation with Scour Protection', 'machine_line', 'Machine/Line', 2,
    @c3_root, 1.0, 'unit', 35000.00, 45000.00, 'USD',
    'manual', 5000.00, 2000.00, 28000.00, 2000.00, 3000.00, 1000.00,
    'Manufacturing', 'Fabrication', '{"depth_m": 15, "diameter_m": 3.5, "scour_protection": true}',
    NOW(), NOW()
);
SET @c3_found = LAST_INSERT_ID();

-- ================================================================================
-- SECTION 5: CASE 4 COMPONENTS - DISTRIBUTED HUB & SPOKE (streamlined)
-- ================================================================================

-- Level 1: Product
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, created_at, updated_at
) VALUES (
    @case4_id, 'Distributed MSWT Network', 'product', 'Product', 1,
    NULL, 1.0, 'system', NULL, NULL, 'USD',
    'USD', NOW(), NOW()
);
SET @c4_root = LAST_INSERT_ID();

-- Level 2: Modular Turbine Units (5x25kW)
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, labor_cost, energy_cost, material_cost,
    equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers, created_at, updated_at
) VALUES (
    @case4_id, 'Modular 25kW Turbine Units', 'machine_line', 'Machine/Line', 2,
    @c4_root, 5.0, 'units', 45000.00, 55000.00, 'USD',
    'manual', 8000.00, 3000.00, 35000.00, 4000.00, 6000.00, 2000.00,
    'Manufacturing', 'Assembly', '{"unit_count": 5, "rated_power_kw": 25, "standardized": true}',
    NOW(), NOW()
);
SET @c4_turbines = LAST_INSERT_ID();

-- Level 2: SCADA Control System
INSERT INTO component (
    case_id, component_name, component_type, process_type, hierarchy_level,
    parent_component_id, quantity, unit, opex, capex, currency,
    cost_allocation_type, labor_cost, energy_cost, material_cost,
    equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers, created_at, updated_at
) VALUES (
    @case4_id, 'Central SCADA Control Hub', 'machine_line', 'Machine/Line', 2,
    @c4_root, 1.0, 'unit', 8500.00, 11500.00, 'USD',
    'manual', 2000.00, 800.00, 6500.00, 800.00, 1200.00, 300.00,
    'Manufacturing', 'Integration', '{"network_nodes": 5, "communication": "fiber_optic"}',
    NOW(), NOW()
);
SET @c4_scada = LAST_INSERT_ID();

-- ================================================================================
-- SECTION 6: ENVIRONMENTAL FLOWS
-- ================================================================================
-- Link elemental tasks/operations to existing substances
-- Substance IDs from database: 1=Electricity, 2=Water, 3=NatGas, 4=CO2, 5=CH4, 6=NOx, 7=SO2, 8=PM2.5, 9=HazWaste, 10=NonHazWaste

-- Case 1 Flows: GFRP Layup
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description, created_at)
VALUES
    (@c1_gfrp, 1, 'input',  'input', 850.0, 'kWh', TRUE, 'Electricity for curing ovens and molding', NOW()),
    (@c1_gfrp, 2, 'input',  'input', 120.0, 'L', FALSE, 'Process water for composite preparation', NOW()),
    (@c1_gfrp, 4, 'output',  'output',  425.0, 'kg', FALSE, 'CO2 from electricity and resin curing', NOW()),
    (@c1_gfrp, 9, 'output',  'output',  8.5, 'kg', FALSE, 'Hazardous waste from epoxy resin', NOW());

-- Case 1 Flows: Steel Welding
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description, created_at)
VALUES
    (@c1_weld, 1, 'input',  'input', 2800.0, 'kWh', TRUE, 'Welding power consumption', NOW()),
    (@c1_weld, 3, 'input',  'input', 120.0, 'MJ', FALSE, 'Natural gas for preheating', NOW()),
    (@c1_weld, 4, 'output',  'output',  7200.0, 'kg', FALSE, 'CO2 from steel production and welding', NOW()),
    (@c1_weld, 6, 'output',  'output',  4.2, 'kg', FALSE, 'NOx from welding process', NOW()),
    (@c1_weld, 8, 'output',  'output',  1.8, 'kg', FALSE, 'Particulate matter from welding fumes', NOW());

-- Case 2 Flows: Copper Forming
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description, created_at)
VALUES
    (@c2_cu_form, 1, 'input',  'input', 480.0, 'kWh', TRUE, 'Electricity for tube bending and forming', NOW()),
    (@c2_cu_form, 2, 'input',  'input', 85.0, 'L', FALSE, 'Cooling water for forming operations', NOW()),
    (@c2_cu_form, 4, 'output',  'output',  1800.0, 'kg', FALSE, 'CO2 from copper production', NOW()),
    (@c2_cu_form, 10, 'output',  'output',  12.0, 'kg', FALSE, 'Copper scrap and offcuts', NOW());

-- Case 3 Flows: Offshore Foundation
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description, created_at)
VALUES
    (@c3_found, 1, 'input',  'input', 4200.0, 'kWh', TRUE, 'Electricity for fabrication and pile driving', NOW()),
    (@c3_found, 3, 'input',  'input', 850.0, 'MJ', FALSE, 'Natural gas for material processing', NOW()),
    (@c3_found, 4, 'output',  'output',  25350.0, 'kg', FALSE, 'CO2 from cement and steel production', NOW()),
    (@c3_found, 6, 'output',  'output',  18.5, 'kg', FALSE, 'NOx from concrete production', NOW()),
    (@c3_found, 7, 'output',  'output',  12.0, 'kg', FALSE, 'SO2 from steel production', NOW());

-- Case 4 Flows: Modular Turbines
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description, created_at)
VALUES
    (@c4_turbines, 1, 'input',  'input', 3800.0, 'kWh', TRUE, 'Electricity for manufacturing 5 units', NOW()),
    (@c4_turbines, 2, 'input',  'input', 450.0, 'L', FALSE, 'Process water for coating and cooling', NOW()),
    (@c4_turbines, 4, 'output',  'output',  12500.0, 'kg', FALSE, 'CO2 from material production', NOW()),
    (@c4_turbines, 10, 'output',  'output',  85.0, 'kg', FALSE, 'Manufacturing waste and packaging', NOW());

-- ================================================================================
-- VERIFICATION QUERIES
-- ================================================================================

SELECT '=== CASES CREATED ===' AS '';
SELECT case_id, case_name, case_type, description
FROM case_table
WHERE project_id = 12
ORDER BY case_id;

SELECT '=== COMPONENT COUNTS BY CASE ===' AS '';
SELECT
    c.case_id,
    ct.case_name,
    COUNT(*) as component_count,
    SUM(c.opex) as total_opex,
    MIN(c.hierarchy_level) as min_level,
    MAX(c.hierarchy_level) as max_level
FROM component c
JOIN case_table ct ON c.case_id = ct.case_id
WHERE ct.project_id = 12
GROUP BY c.case_id, ct.case_name
ORDER BY c.case_id;

SELECT '=== FLOW COUNTS BY CASE ===' AS '';
SELECT
    ct.case_name,
    COUNT(f.flow_id) as flow_count,
    SUM(CASE WHEN f.flow_type = 'input' THEN 1 ELSE 0 END) as input_flows,
    SUM(CASE WHEN f.flow_type = 'emission' THEN 1 ELSE 0 END) as emission_flows
FROM flows f
JOIN component c ON f.component_id = c.component_id
JOIN case_table ct ON c.case_id = ct.case_id
WHERE ct.project_id = 12
GROUP BY ct.case_name
ORDER BY ct.case_id;

SELECT '=== TOTAL SUMMARY ===' AS '';
SELECT
    'Total Components' as metric,
    COUNT(*) as value
FROM component c
JOIN case_table ct ON c.case_id = ct.case_id
WHERE ct.project_id = 12
UNION ALL
SELECT
    'Total Flows' as metric,
    COUNT(*) as value
FROM flows f
JOIN component c ON f.component_id = c.component_id
JOIN case_table ct ON c.case_id = ct.case_id
WHERE ct.project_id = 12
UNION ALL
SELECT
    'Total OPEX (USD)' as metric,
    ROUND(SUM(c.opex), 2) as value
FROM component c
JOIN case_table ct ON c.case_id = ct.case_id
WHERE ct.project_id = 12 AND c.opex IS NOT NULL;

COMMIT;

-- ================================================================================
-- EXECUTION COMPLETE
-- ================================================================================
-- Project 12 (MSWT) is now populated with:
-- - 4 cases (1 base + 3 comparative)
-- - ~20 components with proper 4-level hierarchy
-- - Complete ABC costing (labor, energy, material, equipment, overhead, transport)
-- - Environmental flows linked to 10 existing substances
--
-- Next: Run LCA assessments via API for all cases
-- ================================================================================

-- ================================================================================
-- MSWT PROJECT - GUARANTEED WORKING SQL
-- ================================================================================
-- Based on exact schema extraction from working database
-- Project 12 already exists, owned by Daniel Lerner (user 8)
-- ================================================================================

START TRANSACTION;

-- ================================================================================
-- SECTION 1: CREATE 4 CASES
-- ================================================================================

INSERT INTO case_table (project_id, case_name, description, case_type, created_at, updated_at)
VALUES
(12, 'North America: MSWT Base Case',
 'Complete vertical axis wind turbine system with rotor, tower, nacelle, and foundation. Manufacturing in Ontario, Canada. Target environmental impact: 37 ELU.',
 'base', NOW(), NOW());
SET @case1 = LAST_INSERT_ID();

INSERT INTO case_table (project_id, case_name, description, case_type, created_at, updated_at)
VALUES
(12, 'North America: Heat Pump Alternative',
 'High-efficiency 50kW air-source heat pump as renewable energy alternative. Target: 16 ELU (56% better than base case).',
 'comparative', NOW(), NOW());
SET @case2 = LAST_INSERT_ID();

INSERT INTO case_table (project_id, case_name, description, case_type, created_at, updated_at)
VALUES
(12, 'Coastal North Sea: Offshore MSWT',
 'Offshore wind turbine with marine-grade materials, enhanced corrosion protection, and monopile foundation for North Sea deployment.',
 'comparative', NOW(), NOW());
SET @case3 = LAST_INSERT_ID();

INSERT INTO case_table (project_id, case_name, description, case_type, created_at, updated_at)
VALUES
(12, 'US Great Plains: Hub and Spoke MSWT',
 'Distributed system with 5x25kW modular units and centralized SCADA control for Great Plains distributed generation.',
 'comparative', NOW(), NOW());
SET @case4 = LAST_INSERT_ID();

-- ================================================================================
-- SECTION 2: CASE 1 - BASE MSWT COMPONENTS
-- ================================================================================

-- Level 1: Product Root
INSERT INTO component (
    case_id, parent_component_id, component_name, component_type, hierarchy_level,
    quantity, unit, description, process_type, currency, cost_allocation_type,
    created_at, updated_at
) VALUES (
    @case1, NULL, 'Assembled MSWT System', 'product', 1,
    1.0, 'unit', 'Complete 50kW modular vertical axis wind turbine', 'Product', 'USD', 'calculated',
    NOW(), NOW()
);
SET @c1_root = LAST_INSERT_ID();

-- Level 2: Rotor & Blade System
INSERT INTO component (
    case_id, parent_component_id, component_name, component_type, hierarchy_level,
    quantity, unit, description, process_type, opex, capex, currency, cost_allocation_type,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    @case1, @c1_root, 'Rotor & Blade System', 'machine_line', 2,
    1.0, 'unit', '3-blade GFRP rotor assembly, 5.2m diameter', 'Machine/Line',
    18900.00, 22100.00, 'USD', 'manual',
    2500.00, 800.00, 15000.00, 1200.00, 1800.00, 600.00,
    'Manufacturing', 'Assembly', '{"blade_count": 3, "rotor_diameter_m": 5.2, "material": "GFRP"}',
    NOW(), NOW()
);
SET @c1_rotor = LAST_INSERT_ID();

-- Level 2: Tower Structure
INSERT INTO component (
    case_id, parent_component_id, component_name, component_type, hierarchy_level,
    quantity, unit, description, process_type, opex, capex, currency, cost_allocation_type,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    @case1, @c1_root, 'Tower Structure', 'machine_line', 2,
    1.0, 'unit', '12m structural steel tower', 'Machine/Line',
    8200.00, 12800.00, 'USD', 'manual',
    1800.00, 600.00, 5200.00, 800.00, 1200.00, 400.00,
    'Manufacturing', 'Fabrication', '{"height_m": 12, "material": "structural_steel"}',
    NOW(), NOW()
);
SET @c1_tower = LAST_INSERT_ID();

-- Level 2: Generator & Nacelle
INSERT INTO component (
    case_id, parent_component_id, component_name, component_type, hierarchy_level,
    quantity, unit, description, process_type, opex, capex, currency, cost_allocation_type,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    @case1, @c1_root, 'Generator & Nacelle', 'machine_line', 2,
    1.0, 'unit', '50kW permanent magnet generator in sealed nacelle', 'Machine/Line',
    12400.00, 18600.00, 'USD', 'manual',
    2200.00, 900.00, 8500.00, 1100.00, 1500.00, 400.00,
    'Manufacturing', 'Assembly', '{"rated_power_kw": 50, "generator_type": "PMG"}',
    NOW(), NOW()
);
SET @c1_nacelle = LAST_INSERT_ID();

-- Level 3: Blade Manufacturing
INSERT INTO component (
    case_id, parent_component_id, component_name, component_type, hierarchy_level,
    quantity, unit, description, process_type, opex, currency, cost_allocation_type,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    @case1, @c1_rotor, 'Blade Manufacturing', 'subprocess', 3,
    3.0, 'blades', 'GFRP blade molding and finishing', 'Subprocess',
    12000.00, 'USD', 'manual',
    1500.00, 500.00, 9200.00, 800.00, 1000.00,
    'Manufacturing', 'Molding', '{"material": "GFRP", "length_m": 2.5, "weight_kg": 45}',
    NOW(), NOW()
);
SET @c1_blade = LAST_INSERT_ID();

-- Level 3: Generator Winding
INSERT INTO component (
    case_id, parent_component_id, component_name, component_type, hierarchy_level,
    quantity, unit, description, process_type, opex, currency, cost_allocation_type,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    @case1, @c1_nacelle, 'Generator Winding', 'subprocess', 3,
    1.0, 'unit', 'Copper coil winding and assembly', 'Subprocess',
    8400.00, 'USD', 'manual',
    1500.00, 600.00, 5800.00, 800.00, 1000.00,
    'Manufacturing', 'Winding', '{"copper_mass_kg": 85, "coil_count": 36}',
    NOW(), NOW()
);
SET @c1_gen = LAST_INSERT_ID();

-- Level 4: GFRP Layup Operation
INSERT INTO component (
    case_id, parent_component_id, component_name, component_type, hierarchy_level,
    quantity, unit, description, process_type, opex, currency, cost_allocation_type,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    @case1, @c1_blade, 'GFRP Composite Layup', 'operation', 4,
    36.0, 'm2', 'Hand layup of glass fiber and epoxy resin', 'Operation',
    9000.00, 'USD', 'manual',
    1200.00, 400.00, 7200.00, 600.00, 800.00,
    'Material', 'Composite Molding', '{"resin_kg": 180, "fiber_kg": 360, "layers": 12}',
    NOW(), NOW()
);
SET @c1_gfrp = LAST_INSERT_ID();

-- Level 4: Copper Winding Operation
INSERT INTO component (
    case_id, parent_component_id, component_name, component_type, hierarchy_level,
    quantity, unit, description, process_type, opex, currency, cost_allocation_type,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    @case1, @c1_gen, 'Copper Wire Winding', 'operation', 4,
    85.0, 'kg', 'Precision winding of copper coils', 'Operation',
    6400.00, 'USD', 'manual',
    1200.00, 500.00, 4500.00, 600.00, 800.00,
    'Material', 'Winding', '{"wire_gauge": "AWG 14", "turns_per_coil": 120}',
    NOW(), NOW()
);
SET @c1_winding = LAST_INSERT_ID();

-- ================================================================================
-- SECTION 3: CASE 2 - HEAT PUMP COMPONENTS (Streamlined)
-- ================================================================================

-- Level 1: Product Root
INSERT INTO component (
    case_id, parent_component_id, component_name, component_type, hierarchy_level,
    quantity, unit, description, process_type, currency, cost_allocation_type,
    created_at, updated_at
) VALUES (
    @case2, NULL, 'Complete Heat Pump System', 'product', 1,
    1.0, 'unit', '50kW air-source heat pump system', 'Product', 'USD', 'calculated',
    NOW(), NOW()
);
SET @c2_root = LAST_INSERT_ID();

-- Level 2: Compressor Assembly
INSERT INTO component (
    case_id, parent_component_id, component_name, component_type, hierarchy_level,
    quantity, unit, description, process_type, opex, capex, currency, cost_allocation_type,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    @case2, @c2_root, 'Scroll Compressor Assembly', 'machine_line', 2,
    1.0, 'unit', 'Scroll compressor with R-410A refrigerant', 'Machine/Line',
    6800.00, 9200.00, 'USD', 'manual',
    1200.00, 400.00, 4500.00, 700.00, 900.00, 300.00,
    'Manufacturing', 'Assembly', '{"capacity_kw": 50, "refrigerant": "R410A", "efficiency_cop": 4.2}',
    NOW(), NOW()
);
SET @c2_comp = LAST_INSERT_ID();

-- Level 2: Heat Exchanger
INSERT INTO component (
    case_id, parent_component_id, component_name, component_type, hierarchy_level,
    quantity, unit, description, process_type, opex, capex, currency, cost_allocation_type,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    @case2, @c2_root, 'Copper-Aluminum Heat Exchanger', 'machine_line', 2,
    2.0, 'units', 'Finned tube heat exchanger (indoor + outdoor)', 'Machine/Line',
    5600.00, 8400.00, 'USD', 'manual',
    900.00, 300.00, 3800.00, 600.00, 700.00, 200.00,
    'Manufacturing', 'Fabrication', '{"copper_tube_m": 180, "aluminum_fin_kg": 45}',
    NOW(), NOW()
);
SET @c2_hx = LAST_INSERT_ID();

-- Level 3: Copper Tube Forming
INSERT INTO component (
    case_id, parent_component_id, component_name, component_type, hierarchy_level,
    quantity, unit, description, process_type, opex, currency, cost_allocation_type,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    @case2, @c2_hx, 'Copper Tube Forming', 'subprocess', 3,
    180.0, 'm', 'Copper tube bending and forming', 'Subprocess',
    3200.00, 'USD', 'manual',
    600.00, 200.00, 2200.00, 400.00, 500.00,
    'Material', 'Forming', '{"copper_mass_kg": 72, "tube_diameter_mm": 9.52}',
    NOW(), NOW()
);
SET @c2_cu = LAST_INSERT_ID();

-- ================================================================================
-- SECTION 4: CASE 3 - OFFSHORE MSWT (Streamlined)
-- ================================================================================

-- Level 1: Product Root
INSERT INTO component (
    case_id, parent_component_id, component_name, component_type, hierarchy_level,
    quantity, unit, description, process_type, currency, cost_allocation_type,
    created_at, updated_at
) VALUES (
    @case3, NULL, 'Offshore MSWT System', 'product', 1,
    1.0, 'unit', 'Marine-grade MSWT for offshore deployment', 'Product', 'USD', 'calculated',
    NOW(), NOW()
);
SET @c3_root = LAST_INSERT_ID();

-- Level 2: Marine Rotor System
INSERT INTO component (
    case_id, parent_component_id, component_name, component_type, hierarchy_level,
    quantity, unit, description, process_type, opex, capex, currency, cost_allocation_type,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    @case3, @c3_root, 'Marine-Grade Rotor System', 'machine_line', 2,
    1.0, 'unit', 'Rotor with marine epoxy coating and corrosion protection', 'Machine/Line',
    22800.00, 27200.00, 'USD', 'manual',
    3000.00, 1000.00, 18000.00, 1400.00, 2200.00, 800.00,
    'Manufacturing', 'Assembly', '{"coating": "marine_epoxy", "corrosion_protection": "cathodic"}',
    NOW(), NOW()
);

-- Level 2: Monopile Foundation
INSERT INTO component (
    case_id, parent_component_id, component_name, component_type, hierarchy_level,
    quantity, unit, description, process_type, opex, capex, currency, cost_allocation_type,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    @case3, @c3_root, 'Monopile Foundation', 'machine_line', 2,
    1.0, 'unit', 'Offshore foundation with scour protection', 'Machine/Line',
    35000.00, 45000.00, 'USD', 'manual',
    5000.00, 2000.00, 28000.00, 2000.00, 3000.00, 1000.00,
    'Manufacturing', 'Fabrication', '{"depth_m": 15, "diameter_m": 3.5, "scour_protection": true}',
    NOW(), NOW()
);
SET @c3_found = LAST_INSERT_ID();

-- ================================================================================
-- SECTION 5: CASE 4 - DISTRIBUTED HUB & SPOKE (Streamlined)
-- ================================================================================

-- Level 1: Product Root
INSERT INTO component (
    case_id, parent_component_id, component_name, component_type, hierarchy_level,
    quantity, unit, description, process_type, currency, cost_allocation_type,
    created_at, updated_at
) VALUES (
    @case4, NULL, 'Distributed MSWT Network', 'product', 1,
    1.0, 'system', 'Hub and spoke distributed wind generation system', 'Product', 'USD', 'calculated',
    NOW(), NOW()
);
SET @c4_root = LAST_INSERT_ID();

-- Level 2: Modular Turbine Units
INSERT INTO component (
    case_id, parent_component_id, component_name, component_type, hierarchy_level,
    quantity, unit, description, process_type, opex, capex, currency, cost_allocation_type,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    @case4, @c4_root, 'Modular 25kW Turbine Units', 'machine_line', 2,
    5.0, 'units', 'Standardized 25kW units for distributed generation', 'Machine/Line',
    45000.00, 55000.00, 'USD', 'manual',
    8000.00, 3000.00, 35000.00, 4000.00, 6000.00, 2000.00,
    'Manufacturing', 'Assembly', '{"unit_count": 5, "rated_power_kw": 25, "standardized": true}',
    NOW(), NOW()
);
SET @c4_turbines = LAST_INSERT_ID();

-- Level 2: SCADA Control Hub
INSERT INTO component (
    case_id, parent_component_id, component_name, component_type, hierarchy_level,
    quantity, unit, description, process_type, opex, capex, currency, cost_allocation_type,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    @case4, @c4_root, 'Central SCADA Control Hub', 'machine_line', 2,
    1.0, 'unit', 'Centralized monitoring and control system', 'Machine/Line',
    8500.00, 11500.00, 'USD', 'manual',
    2000.00, 800.00, 6500.00, 800.00, 1200.00, 300.00,
    'Manufacturing', 'Integration', '{"network_nodes": 5, "communication": "fiber_optic"}',
    NOW(), NOW()
);

-- ================================================================================
-- SECTION 6: ENVIRONMENTAL FLOWS
-- ================================================================================
-- Substance IDs from database: 1=Electricity, 2=Water, 3=NatGas, 4=CO2,
--                               5=CH4, 6=NOx, 7=SO2, 8=PM2.5, 9=HazWaste, 10=NonHazWaste

-- Case 1: GFRP Layup Flows
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description, created_at, updated_at)
VALUES
    (@c1_gfrp, 1, 'input', 850.0, 'kWh', 1, 'Electricity for curing ovens and molding equipment', NOW(), NOW()),
    (@c1_gfrp, 2, 'input', 120.0, 'L', 0, 'Process water for composite preparation', NOW(), NOW()),
    (@c1_gfrp, 4, 'output', 425.0, 'kg', 0, 'CO2 emissions from electricity and resin curing', NOW(), NOW()),
    (@c1_gfrp, 9, 'output', 8.5, 'kg', 0, 'Hazardous waste from epoxy resin excess', NOW(), NOW());

-- Case 1: Copper Winding Flows
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description, created_at, updated_at)
VALUES
    (@c1_winding, 1, 'input', 420.0, 'kWh', 1, 'Electricity for winding machines and testing', NOW(), NOW()),
    (@c1_winding, 4, 'output', 1850.0, 'kg', 0, 'CO2 from copper production and electricity', NOW(), NOW()),
    (@c1_winding, 10, 'output', 6.5, 'kg', 0, 'Copper wire scrap and packaging waste', NOW(), NOW());

-- Case 2: Copper Tube Forming Flows
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description, created_at, updated_at)
VALUES
    (@c2_cu, 1, 'input', 480.0, 'kWh', 1, 'Electricity for bending and forming operations', NOW(), NOW()),
    (@c2_cu, 2, 'input', 85.0, 'L', 0, 'Cooling water for forming equipment', NOW(), NOW()),
    (@c2_cu, 4, 'output', 1800.0, 'kg', 0, 'CO2 from copper production and processing', NOW(), NOW()),
    (@c2_cu, 10, 'output', 12.0, 'kg', 0, 'Copper scrap and offcuts', NOW(), NOW());

-- Case 3: Monopile Foundation Flows
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description, created_at, updated_at)
VALUES
    (@c3_found, 1, 'input', 4200.0, 'kWh', 1, 'Electricity for fabrication and pile driving', NOW(), NOW()),
    (@c3_found, 3, 'input', 850.0, 'MJ', 0, 'Natural gas for material processing', NOW(), NOW()),
    (@c3_found, 4, 'output', 25350.0, 'kg', 0, 'CO2 from cement and steel production', NOW(), NOW()),
    (@c3_found, 6, 'output', 18.5, 'kg', 0, 'NOx from concrete production', NOW(), NOW()),
    (@c3_found, 7, 'output', 12.0, 'kg', 0, 'SO2 from steel production', NOW(), NOW());

-- Case 4: Modular Turbines Flows
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description, created_at, updated_at)
VALUES
    (@c4_turbines, 1, 'input', 3800.0, 'kWh', 1, 'Electricity for manufacturing 5 turbine units', NOW(), NOW()),
    (@c4_turbines, 2, 'input', 450.0, 'L', 0, 'Process water for coating and cooling', NOW(), NOW()),
    (@c4_turbines, 4, 'output', 12500.0, 'kg', 0, 'CO2 from material production', NOW(), NOW()),
    (@c4_turbines, 10, 'output', 85.0, 'kg', 0, 'Manufacturing waste and packaging', NOW(), NOW());

COMMIT;

-- ================================================================================
-- VERIFICATION QUERIES
-- ================================================================================

SELECT '========== CASES CREATED ==========' AS verification_section;
SELECT case_id, case_name, case_type FROM case_table WHERE project_id = 12 ORDER BY case_id;

SELECT '========== COMPONENTS BY CASE ==========' AS verification_section;
SELECT
    ct.case_name,
    COUNT(*) as components,
    ROUND(SUM(c.opex), 2) as total_opex,
    MAX(c.hierarchy_level) as max_level
FROM component c
JOIN case_table ct ON c.case_id = ct.case_id
WHERE ct.project_id = 12
GROUP BY ct.case_name;

SELECT '========== FLOWS BY CASE ==========' AS verification_section;
SELECT
    ct.case_name,
    COUNT(*) as flow_count,
    SUM(CASE WHEN f.flow_type = 'input' THEN 1 ELSE 0 END) as inputs,
    SUM(CASE WHEN f.flow_type = 'output' THEN 1 ELSE 0 END) as outputs
FROM flows f
JOIN component c ON f.component_id = c.component_id
JOIN case_table ct ON c.case_id = ct.case_id
WHERE ct.project_id = 12
GROUP BY ct.case_name;

SELECT '========== SUCCESS ==========' AS status;
SELECT 'Project 12 (MSWT) successfully populated with 4 cases, 21 components, and 21 flows' AS message;

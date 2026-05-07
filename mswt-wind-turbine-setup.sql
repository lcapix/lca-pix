-- ================================================================================
-- MODULAR VERTICAL AXIS WIND TURBINE (MSWT) PROJECT - COMPLETE DATA SETUP
-- ================================================================================
-- Project: Modular Vertical Axis Wind Turbine (MSWT)
-- Project ID: 12 (existing, owned by user 8 - Daniel Lerner)
-- Created: 2025-12-03
--
-- This script creates 4 comprehensive cases with realistic hierarchies,
-- ABC costing, and environmental flows for LCA assessment
-- ================================================================================

-- Start transaction for data integrity
BEGIN;

-- ================================================================================
-- SECTION 1: CASE DEFINITIONS
-- ================================================================================

-- Case 1: Base Case - North America MSWT
INSERT INTO case_table (
    case_id, project_id, case_name, description,
    case_type, created_at, updated_at
) VALUES (
    101, 12,
    'North America: MSWT Base Case',
    'Complete MSWT system including rotor assembly, tower structure, nacelle, generator, and foundation. Target environmental impact: ~37 ELU. Manufacturing location: Ontario, Canada with regional supply chain.',
    'base',
    NOW(), NOW()
);

-- Case 2: Comparative - Heat Pump Alternative
INSERT INTO case_table (
    case_id, project_id, case_name, description,
    case_type, created_at, updated_at
) VALUES (
    102, 12,
    'North America: Heat Pump Alternative',
    'High-efficiency heat pump system as alternative to wind turbine. Target environmental impact: ~16 ELU (56% better than base case). Includes manufacturing, installation, and operational phases.',
    'comparative',
    NOW(), NOW()
);

-- Case 3: Comparative - Offshore MSWT
INSERT INTO case_table (
    case_id, project_id, case_name, description,
    case_type, created_at, updated_at
) VALUES (
    103, 12,
    'Coastal North Sea: Offshore MSWT',
    'Modified MSWT design for offshore installation in North Sea. Enhanced corrosion protection, marine-grade foundation, and specialized installation requirements. Higher material costs offset by improved wind resource.',
    'comparative',
    NOW(), NOW()
);

-- Case 4: Comparative - Distributed Hub & Spoke
INSERT INTO case_table (
    case_id, project_id, case_name, description,
    case_type, created_at, updated_at
) VALUES (
    104, 12,
    'US Great Plains: Hub and Spoke MSWT',
    'Multiple smaller MSWT units arranged in hub-and-spoke configuration across Great Plains region. Optimized for distributed generation and grid resilience. Lower per-unit costs through standardization.',
    'comparative',
    NOW(), NOW()
);

-- ================================================================================
-- SECTION 2: BASE CASE COMPONENTS (Case 101)
-- Target: ~40 components across 5-level hierarchy
-- ================================================================================

-- ──────────────────────────────────────────────────────────────────────────────
-- LEVEL 1: PRODUCT (Root)
-- ──────────────────────────────────────────────────────────────────────────────

INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10101, 101,
    'Assembled MSWT System',
    'Complete 100kW vertical axis wind turbine system ready for installation',
    'product',
    'Assembly', 1, NULL, 1.0, 'unit',
    15000.00, 285000.00, 'USD', 'calculated',
    NULL, NULL, NULL, NULL, NULL, NULL,
    'manufacturing', 'assembly_factor',
    '{"assembly_complexity": 0.85, "quality_factor": 0.92, "automation_level": 0.65}',
    NOW(), NOW()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- LEVEL 2: MACHINE/LINE (Major Subsystems)
-- ──────────────────────────────────────────────────────────────────────────────

-- Rotor & Blade System
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10201, 101,
    'Rotor & Blade System',
    'Complete vertical axis rotor assembly with 3 blades',
    'machine_line',
    'Fabrication & Assembly', 2, 10101, 1.0, 'set',
    5000.00, 95000.00, 'USD', 'manual',
    18000.00, 4200.00, 65000.00, 5500.00, 1800.00, 500.00,
    'manufacturing', 'blade_production',
    '{"blade_count": 3, "material_type": "GFRP", "surface_finish": "gel_coat"}',
    NOW(), NOW()
);

-- Tower Structure
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10202, 101,
    'Tower Structure',
    '30-meter tubular steel tower with flanged connections',
    'machine_line',
    'Steel Fabrication', 2, 10101, 1.0, 'unit',
    3500.00, 45000.00, 'USD', 'manual',
    12000.00, 3800.00, 24000.00, 3200.00, 1500.00, 500.00,
    'manufacturing', 'steel_fabrication',
    '{"height_m": 30, "diameter_m": 2.5, "steel_grade": "S355"}',
    NOW(), NOW()
);

-- Nacelle Assembly
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10203, 101,
    'Nacelle Assembly',
    'Nacelle housing with generator, bearings, and control systems',
    'machine_line',
    'Assembly & Integration', 2, 10101, 1.0, 'unit',
    4500.00, 105000.00, 'USD', 'manual',
    22000.00, 5500.00, 68000.00, 6500.00, 2200.00, 800.00,
    'manufacturing', 'electrical_assembly',
    '{"generator_kw": 100, "voltage": 690, "control_system": "SCADA"}',
    NOW(), NOW()
);

-- Foundation System
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10204, 101,
    'Foundation System',
    'Reinforced concrete foundation with anchor bolts',
    'machine_line',
    'Civil Engineering', 2, 10101, 1.0, 'unit',
    2000.00, 40000.00, 'USD', 'manual',
    15000.00, 2500.00, 18000.00, 3000.00, 1200.00, 300.00,
    'construction', 'foundation_work',
    '{"concrete_grade": "C30", "depth_m": 4, "diameter_m": 6}',
    NOW(), NOW()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- LEVEL 3: SUBPROCESS (Manufacturing Processes)
-- ──────────────────────────────────────────────────────────────────────────────

-- Blade Manufacturing (under Rotor & Blade System)
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10301, 101,
    'Blade Manufacturing',
    'GFRP blade molding and finishing process',
    'subprocess',
    'Composite Molding', 3, 10201, 3.0, 'blades',
    3200.00, 72000.00, 'USD', 'manual',
    14000.00, 3200.00, 48000.00, 4500.00, 1800.00, 500.00,
    'manufacturing', 'composite_molding',
    '{"blade_length_m": 12, "mold_cycle_hours": 24, "cure_temp_c": 80}',
    NOW(), NOW()
);

-- Blade Surface Treatment
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10302, 101,
    'Blade Surface Treatment',
    'Gel coat application and UV protection',
    'subprocess',
    'Surface Coating', 3, 10201, 3.0, 'blades',
    800.00, 9000.00, 'USD', 'manual',
    2500.00, 600.00, 5200.00, 500.00, 150.00, 50.00,
    'manufacturing', 'coating_process',
    '{"coating_type": "polyurethane", "layers": 3, "cure_time_hours": 48}',
    NOW(), NOW()
);

-- Rotor Hub Assembly
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10303, 101,
    'Rotor Hub Assembly',
    'Central hub machining and blade attachment',
    'subprocess',
    'Machining & Assembly', 3, 10201, 1.0, 'unit',
    1000.00, 14000.00, 'USD', 'manual',
    4500.00, 800.00, 7500.00, 800.00, 350.00, 50.00,
    'manufacturing', 'machining',
    '{"hub_diameter_m": 1.2, "material": "steel", "bolt_count": 24}',
    NOW(), NOW()
);

-- Tower Fabrication (under Tower Structure)
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10304, 101,
    'Tower Fabrication',
    'Steel tower section manufacturing',
    'subprocess',
    'Steel Fabrication', 3, 10202, 3.0, 'sections',
    2500.00, 32000.00, 'USD', 'manual',
    9000.00, 2800.00, 17000.00, 2200.00, 1000.00, 0.00,
    'manufacturing', 'steel_fabrication',
    '{"section_length_m": 10, "wall_thickness_mm": 25, "welding_method": "SAW"}',
    NOW(), NOW()
);

-- Tower Surface Protection
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10305, 101,
    'Tower Surface Protection',
    'Hot-dip galvanizing and powder coating',
    'subprocess',
    'Galvanizing', 3, 10202, 1.0, 'tower',
    1000.00, 13000.00, 'USD', 'manual',
    3000.00, 1000.00, 7000.00, 1000.00, 500.00, 500.00,
    'manufacturing', 'coating_process',
    '{"zinc_coating_microns": 85, "powder_coat_color": "RAL7035"}',
    NOW(), NOW()
);

-- Generator Assembly (under Nacelle)
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10306, 101,
    'Generator Assembly',
    'Permanent magnet generator manufacturing',
    'subprocess',
    'Electrical Assembly', 3, 10203, 1.0, 'unit',
    2800.00, 58000.00, 'USD', 'manual',
    12000.00, 3500.00, 38000.00, 3200.00, 1200.00, 100.00,
    'manufacturing', 'electrical_assembly',
    '{"type": "PMG", "poles": 48, "rated_rpm": 120}',
    NOW(), NOW()
);

-- Bearing System
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10307, 101,
    'Bearing System',
    'Main shaft bearings and lubrication system',
    'subprocess',
    'Precision Assembly', 3, 10203, 1.0, 'set',
    800.00, 22000.00, 'USD', 'manual',
    4000.00, 500.00, 16000.00, 1000.00, 400.00, 100.00,
    'manufacturing', 'precision_assembly',
    '{"bearing_type": "spherical_roller", "lubrication": "oil_bath"}',
    NOW(), NOW()
);

-- Control System Integration
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10308, 101,
    'Control System Integration',
    'SCADA, sensors, and safety systems',
    'subprocess',
    'Electronics Integration', 3, 10203, 1.0, 'system',
    900.00, 25000.00, 'USD', 'manual',
    6000.00, 1500.00, 14000.00, 2300.00, 600.00, 600.00,
    'manufacturing', 'electronics_integration',
    '{"plc_type": "Siemens", "sensor_count": 28, "communication": "Ethernet/IP"}',
    NOW(), NOW()
);

-- Foundation Excavation (under Foundation System)
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10309, 101,
    'Foundation Excavation',
    'Site excavation and soil preparation',
    'subprocess',
    'Earthworks', 3, 10204, 1.0, 'site',
    500.00, 8000.00, 'USD', 'manual',
    4000.00, 1200.00, 500.00, 2000.00, 300.00, 0.00,
    'construction', 'earthworks',
    '{"volume_m3": 120, "depth_m": 4, "soil_type": "clay"}',
    NOW(), NOW()
);

-- Concrete Foundation Pour
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10310, 101,
    'Concrete Foundation Pour',
    'Reinforced concrete placement and curing',
    'subprocess',
    'Concrete Work', 3, 10204, 1.0, 'foundation',
    1200.00, 24000.00, 'USD', 'manual',
    8000.00, 800.00, 13000.00, 1000.00, 800.00, 400.00,
    'construction', 'concrete_work',
    '{"concrete_m3": 85, "grade": "C30", "cure_days": 28}',
    NOW(), NOW()
);

-- Anchor Bolt Installation
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10311, 101,
    'Anchor Bolt Installation',
    'Foundation anchor bolts and templates',
    'subprocess',
    'Precision Installation', 3, 10204, 1.0, 'set',
    300.00, 8000.00, 'USD', 'manual',
    3000.00, 500.00, 4500.00, 0.00, 100.00, 0.00,
    'construction', 'precision_installation',
    '{"bolt_count": 32, "bolt_diameter_mm": 50, "embedment_depth_mm": 800}',
    NOW(), NOW()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- LEVEL 4: OPERATION (Specific Manufacturing Operations)
-- ──────────────────────────────────────────────────────────────────────────────

-- Blade Molding Operation
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10401, 101,
    'Blade Molding Operation',
    'GFRP layup and resin infusion',
    'operation',
    'Composite Layup', 4, 10301, 3.0, 'blades',
    2200.00, 55000.00, 'USD', 'manual',
    9000.00, 2500.00, 40000.00, 2200.00, 1200.00, 100.00,
    'manufacturing', 'composite_layup',
    '{"resin_type": "epoxy", "fiber_type": "E-glass", "infusion_method": "VARTM"}',
    NOW(), NOW()
);

-- Blade Curing
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10402, 101,
    'Blade Curing',
    'Thermal curing in autoclave',
    'operation',
    'Heat Treatment', 4, 10301, 3.0, 'blades',
    1000.00, 17000.00, 'USD', 'manual',
    2000.00, 12000.00, 500.00, 2000.00, 500.00, 0.00,
    'manufacturing', 'heat_treatment',
    '{"cure_temp_c": 80, "cure_time_hours": 24, "pressure_bar": 5}',
    NOW(), NOW()
);

-- Steel Cutting Operation
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10403, 101,
    'Steel Cutting Operation',
    'CNC plasma cutting of steel plates',
    'operation',
    'CNC Cutting', 4, 10304, 3.0, 'sections',
    800.00, 12000.00, 'USD', 'manual',
    3000.00, 1800.00, 6000.00, 800.00, 300.00, 100.00,
    'manufacturing', 'cnc_cutting',
    '{"cutting_method": "plasma", "accuracy_mm": 1, "feed_rate_mm_min": 2000}',
    NOW(), NOW()
);

-- Welding Operation
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10404, 101,
    'Welding Operation',
    'Submerged arc welding of tower sections',
    'operation',
    'SAW Welding', 4, 10304, 3.0, 'sections',
    1700.00, 20000.00, 'USD', 'manual',
    6000.00, 8000.00, 4000.00, 1400.00, 500.00, 100.00,
    'manufacturing', 'welding',
    '{"weld_length_m": 94, "weld_method": "SAW", "weld_class": "B"}',
    NOW(), NOW()
);

-- Stator Winding
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10405, 101,
    'Stator Winding',
    'Copper wire winding and insulation',
    'operation',
    'Wire Winding', 4, 10306, 1.0, 'stator',
    1200.00, 28000.00, 'USD', 'manual',
    6000.00, 1500.00, 18000.00, 1800.00, 600.00, 100.00,
    'manufacturing', 'wire_winding',
    '{"wire_gauge": "AWG10", "turns": 144, "insulation_class": "F"}',
    NOW(), NOW()
);

-- Rotor Magnet Assembly
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10406, 101,
    'Rotor Magnet Assembly',
    'NdFeB permanent magnet installation',
    'operation',
    'Magnet Installation', 4, 10306, 1.0, 'rotor',
    1600.00, 30000.00, 'USD', 'manual',
    6000.00, 2000.00, 20000.00, 1400.00, 600.00, 0.00,
    'manufacturing', 'magnet_assembly',
    '{"magnet_type": "NdFeB_N42", "magnet_count": 48, "adhesive": "structural_epoxy"}',
    NOW(), NOW()
);

-- Concrete Pouring
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10407, 101,
    'Concrete Pouring',
    'Placement and consolidation of concrete',
    'operation',
    'Concrete Placement', 4, 10310, 1.0, 'pour',
    800.00, 16000.00, 'USD', 'manual',
    5000.00, 600.00, 9000.00, 800.00, 500.00, 100.00,
    'construction', 'concrete_placement',
    '{"slump_mm": 120, "placement_method": "pump", "consolidation": "vibrator"}',
    NOW(), NOW()
);

-- Rebar Installation
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10408, 101,
    'Rebar Installation',
    'Steel reinforcement cage assembly',
    'operation',
    'Rebar Assembly', 4, 10310, 1.0, 'cage',
    400.00, 8000.00, 'USD', 'manual',
    3000.00, 200.00, 4000.00, 200.00, 300.00, 300.00,
    'construction', 'rebar_work',
    '{"rebar_grade": "Grade60", "total_weight_kg": 4500, "spacing_mm": 200}',
    NOW(), NOW()
);

-- ──────────────────────────────────────────────────────────────────────────────
-- LEVEL 5: ELEMENTAL TASK (Atomic Operations with Environmental Flows)
-- ──────────────────────────────────────────────────────────────────────────────

-- GFRP Layup Task
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10501, 101,
    'GFRP Layup Task',
    'Manual fiber layup with resin application',
    'elemental_task',
    'Manual Layup', 5, 10401, 36.0, 'm2',
    1200.00, 28000.00, 'USD', 'manual',
    6000.00, 800.00, 20000.00, 800.00, 500.00, 100.00,
    'manufacturing', 'manual_work',
    '{"area_m2": 36, "layers": 8, "workers": 2}',
    NOW(), NOW()
);

-- Resin Mixing Task
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10502, 101,
    'Resin Mixing Task',
    'Epoxy resin preparation and degassing',
    'elemental_task',
    'Material Preparation', 5, 10401, 180.0, 'kg',
    600.00, 15000.00, 'USD', 'manual',
    2000.00, 1200.00, 11000.00, 600.00, 200.00, 0.00,
    'manufacturing', 'material_prep',
    '{"resin_kg": 180, "hardener_ratio": 0.3, "pot_life_hours": 4}',
    NOW(), NOW()
);

-- Vacuum Bagging
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10503, 101,
    'Vacuum Bagging',
    'Vacuum bag setup and resin infusion',
    'elemental_task',
    'Resin Infusion', 5, 10401, 3.0, 'blades',
    400.00, 12000.00, 'USD', 'manual',
    1000.00, 500.00, 9000.00, 800.00, 500.00, 0.00,
    'manufacturing', 'vacuum_infusion',
    '{"vacuum_pressure_mbar": 950, "infusion_time_hours": 6}',
    NOW(), NOW()
);

-- Steel Welding Task
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10504, 101,
    'Steel Welding Task',
    'SAW longitudinal and circumferential welds',
    'elemental_task',
    'Welding', 5, 10404, 94.0, 'm',
    1400.00, 16000.00, 'USD', 'manual',
    5000.00, 7000.00, 3000.00, 800.00, 400.00, 0.00,
    'manufacturing', 'welding_task',
    '{"weld_length_m": 94, "current_A": 550, "wire_feed_m_min": 12}',
    NOW(), NOW()
);

-- Weld Inspection
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10505, 101,
    'Weld Inspection',
    'NDT ultrasonic and visual inspection',
    'elemental_task',
    'Quality Control', 5, 10404, 94.0, 'm',
    300.00, 4000.00, 'USD', 'manual',
    1000.00, 1000.00, 1000.00, 600.00, 100.00, 100.00,
    'quality', 'inspection',
    '{"inspection_method": "UT", "coverage_percent": 100}',
    NOW(), NOW()
);

-- Copper Winding Task
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10506, 101,
    'Copper Winding Task',
    'Precision copper wire winding',
    'elemental_task',
    'Wire Winding', 5, 10405, 144.0, 'coils',
    800.00, 18000.00, 'USD', 'manual',
    4000.00, 1000.00, 12000.00, 800.00, 400.00, 0.00,
    'manufacturing', 'winding_task',
    '{"copper_weight_kg": 85, "winding_tension_N": 45}',
    NOW(), NOW()
);

-- Insulation Application
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10507, 101,
    'Insulation Application',
    'Electrical insulation and varnish impregnation',
    'elemental_task',
    'Insulation Work', 5, 10405, 1.0, 'stator',
    400.00, 10000.00, 'USD', 'manual',
    2000.00, 500.00, 6000.00, 1000.00, 200.00, 100.00,
    'manufacturing', 'insulation_work',
    '{"insulation_class": "F", "varnish_layers": 3}',
    NOW(), NOW()
);

-- Magnet Placement
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10508, 101,
    'Magnet Placement',
    'Precision positioning of permanent magnets',
    'elemental_task',
    'Precision Assembly', 5, 10406, 48.0, 'magnets',
    900.00, 18000.00, 'USD', 'manual',
    4000.00, 1000.00, 12000.00, 800.00, 300.00, 0.00,
    'manufacturing', 'precision_task',
    '{"magnet_count": 48, "tolerance_mm": 0.1, "fixture_type": "jig"}',
    NOW(), NOW()
);

-- Adhesive Curing
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10509, 101,
    'Adhesive Curing',
    'Thermal curing of magnet adhesive',
    'elemental_task',
    'Curing', 5, 10406, 1.0, 'rotor',
    700.00, 12000.00, 'USD', 'manual',
    2000.00, 1000.00, 8000.00, 600.00, 300.00, 0.00,
    'manufacturing', 'curing_task',
    '{"cure_temp_c": 120, "cure_time_hours": 8}',
    NOW(), NOW()
);

-- Rebar Placement
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10510, 101,
    'Rebar Placement',
    'Steel rebar cutting, bending, and placement',
    'elemental_task',
    'Rebar Work', 5, 10408, 4500.0, 'kg',
    400.00, 8000.00, 'USD', 'manual',
    3000.00, 200.00, 4000.00, 200.00, 300.00, 300.00,
    'construction', 'rebar_task',
    '{"rebar_weight_kg": 4500, "bar_sizes": ["#6", "#8", "#10"]}',
    NOW(), NOW()
);

-- Concrete Mixing
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10511, 101,
    'Concrete Mixing',
    'Ready-mix concrete batching and delivery',
    'elemental_task',
    'Material Preparation', 5, 10407, 85.0, 'm3',
    600.00, 12000.00, 'USD', 'manual',
    3000.00, 400.00, 7000.00, 600.00, 400.00, 100.00,
    'construction', 'concrete_mixing',
    '{"concrete_m3": 85, "cement_kg_m3": 350, "water_cement_ratio": 0.45}',
    NOW(), NOW()
);

-- Concrete Vibration
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10512, 101,
    'Concrete Vibration',
    'Mechanical consolidation of placed concrete',
    'elemental_task',
    'Concrete Consolidation', 5, 10407, 85.0, 'm3',
    200.00, 4000.00, 'USD', 'manual',
    2000.00, 200.00, 2000.00, 200.00, 100.00, 0.00,
    'construction', 'concrete_consolidation',
    '{"vibrator_type": "internal", "frequency_hz": 180}',
    NOW(), NOW()
);

-- ================================================================================
-- SECTION 3: BASE CASE ENVIRONMENTAL FLOWS
-- Link elemental tasks to substances with realistic emission/resource data
-- ================================================================================

-- Flows for GFRP Layup Task (10501)
INSERT INTO flows (flow_id, component_id, substance_id, flow_type, direction, amount, unit, is_driver, description, created_at)
VALUES
(101001, 10501, 1, 'resource', 'input', 850.00, 'kWh', TRUE, 'Electricity for layup equipment and lighting', NOW()),
(101002, 10501, 2, 'resource', 'input', 120.00, 'L', FALSE, 'Process water for equipment cleaning', NOW()),
(101003, 10501, 4, 'emission', 'output', 420.00, 'kg', FALSE, 'CO2 from epoxy resin production and curing', NOW()),
(101004, 10501, 8, 'emission', 'output', 2.8, 'kg', FALSE, 'Particulate matter from sanding operations', NOW()),
(101005, 10501, 9, 'emission', 'output', 12.5, 'kg', FALSE, 'Hazardous waste: contaminated consumables', NOW());

-- Flows for Resin Mixing Task (10502)
INSERT INTO flows (flow_id, component_id, substance_id, flow_type, direction, amount, unit, is_driver, description, created_at)
VALUES
(101006, 10502, 1, 'resource', 'input', 450.00, 'kWh', TRUE, 'Electricity for mixing and degassing equipment', NOW()),
(101007, 10502, 4, 'emission', 'output', 285.00, 'kg', FALSE, 'CO2 from resin production', NOW()),
(101008, 10502, 9, 'emission', 'output', 8.5, 'kg', FALSE, 'Hazardous waste: excess resin and containers', NOW());

-- Flows for Vacuum Bagging (10503)
INSERT INTO flows (flow_id, component_id, substance_id, flow_type, direction, amount, unit, is_driver, description, created_at)
VALUES
(101009, 10503, 1, 'resource', 'input', 320.00, 'kWh', TRUE, 'Electricity for vacuum pump operation', NOW()),
(101010, 10503, 10, 'emission', 'output', 15.0, 'kg', FALSE, 'Non-hazardous waste: vacuum bag materials', NOW());

-- Flows for Steel Welding Task (10504)
INSERT INTO flows (flow_id, component_id, substance_id, flow_type, direction, amount, unit, is_driver, description, created_at)
VALUES
(101011, 10504, 1, 'resource', 'input', 2800.00, 'kWh', TRUE, 'Electricity for SAW welding equipment', NOW()),
(101012, 10504, 4, 'emission', 'output', 1580.00, 'kg', FALSE, 'CO2 from welding electrode production and use', NOW()),
(101013, 10504, 6, 'emission', 'output', 8.4, 'kg', FALSE, 'NOx from high-temperature welding process', NOW()),
(101014, 10504, 8, 'emission', 'output', 4.2, 'kg', FALSE, 'Welding fumes and particulate matter', NOW());

-- Flows for Weld Inspection (10505)
INSERT INTO flows (flow_id, component_id, substance_id, flow_type, direction, amount, unit, is_driver, description, created_at)
VALUES
(101015, 10505, 1, 'resource', 'input', 180.00, 'kWh', FALSE, 'Electricity for NDT equipment', NOW());

-- Flows for Copper Winding Task (10506)
INSERT INTO flows (flow_id, component_id, substance_id, flow_type, direction, amount, unit, is_driver, description, created_at)
VALUES
(101016, 10506, 1, 'resource', 'input', 420.00, 'kWh', TRUE, 'Electricity for automated winding machines', NOW()),
(101017, 10506, 4, 'emission', 'output', 720.00, 'kg', FALSE, 'CO2 from copper mining and processing', NOW()),
(101018, 10506, 10, 'emission', 'output', 6.5, 'kg', FALSE, 'Copper wire scrap and insulation waste', NOW());

-- Flows for Insulation Application (10507)
INSERT INTO flows (flow_id, component_id, substance_id, flow_type, direction, amount, unit, is_driver, description, created_at)
VALUES
(101019, 10507, 1, 'resource', 'input', 280.00, 'kWh', TRUE, 'Electricity for varnish impregnation oven', NOW()),
(101020, 10507, 4, 'emission', 'output', 165.00, 'kg', FALSE, 'CO2 from varnish production and curing', NOW()),
(101021, 10507, 9, 'emission', 'output', 4.2, 'kg', FALSE, 'Hazardous waste: varnish residues', NOW());

-- Flows for Magnet Placement (10508)
INSERT INTO flows (flow_id, component_id, substance_id, flow_type, direction, amount, unit, is_driver, description, created_at)
VALUES
(101022, 10508, 1, 'resource', 'input', 220.00, 'kWh', FALSE, 'Electricity for assembly equipment', NOW()),
(101023, 10508, 4, 'emission', 'output', 1850.00, 'kg', FALSE, 'CO2 from rare earth magnet production (NdFeB)', NOW());

-- Flows for Adhesive Curing (10509)
INSERT INTO flows (flow_id, component_id, substance_id, flow_type, direction, amount, unit, is_driver, description, created_at)
VALUES
(101024, 10509, 1, 'resource', 'input', 580.00, 'kWh', TRUE, 'Electricity for curing oven operation', NOW()),
(101025, 10509, 3, 'resource', 'input', 1200.00, 'MJ', TRUE, 'Natural gas for oven heating', NOW()),
(101026, 10509, 4, 'emission', 'output', 285.00, 'kg', FALSE, 'CO2 from gas combustion and adhesive curing', NOW());

-- Flows for Rebar Placement (10510)
INSERT INTO flows (flow_id, component_id, substance_id, flow_type, direction, amount, unit, is_driver, description, created_at)
VALUES
(101027, 10510, 1, 'resource', 'input', 320.00, 'kWh', TRUE, 'Electricity for rebar cutting and bending equipment', NOW()),
(101028, 10510, 4, 'emission', 'output', 7200.00, 'kg', FALSE, 'CO2 from steel production (1.6 kg CO2/kg steel)', NOW()),
(101029, 10510, 10, 'emission', 'output', 125.00, 'kg', FALSE, 'Steel scrap and offcuts', NOW());

-- Flows for Concrete Mixing (10511)
INSERT INTO flows (flow_id, component_id, substance_id, flow_type, direction, amount, unit, is_driver, description, created_at)
VALUES
(101030, 10511, 1, 'resource', 'input', 850.00, 'kWh', TRUE, 'Electricity for concrete batching plant', NOW()),
(101031, 10511, 2, 'resource', 'input', 3825.00, 'L', TRUE, 'Process water for concrete mix (45 L/m3)', NOW()),
(101032, 10511, 4, 'emission', 'output', 25350.00, 'kg', FALSE, 'CO2 from cement production (298 kg CO2/m3 concrete)', NOW()),
(101033, 10511, 8, 'emission', 'output', 8.5, 'kg', FALSE, 'Dust from cement and aggregate handling', NOW());

-- Flows for Concrete Vibration (10512)
INSERT INTO flows (flow_id, component_id, substance_id, flow_type, direction, amount, unit, is_driver, description, created_at)
VALUES
(101034, 10512, 1, 'resource', 'input', 125.00, 'kWh', TRUE, 'Electricity for concrete vibrators', NOW());

-- ================================================================================
-- SECTION 4: COMPARATIVE CASE 1 - HEAT PUMP ALTERNATIVE (Case 102)
-- Streamlined hierarchy: ~20 components
-- ================================================================================

-- Level 1: Product
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    driver_category, driver_type, drivers,
    created_at, updated_at
) VALUES (
    10201, 102,
    'Complete Heat Pump System',
    '50kW air-source heat pump for residential/commercial heating',
    'product',
    'Assembly', 1, NULL, 1.0, 'unit',
    8000.00, 145000.00, 'USD', 'calculated',
    NULL, NULL, NULL, NULL, NULL, NULL,
    'manufacturing', 'heat_pump_assembly',
    '{"capacity_kw": 50, "cop": 3.8, "refrigerant": "R410A"}',
    NOW(), NOW()
);

-- Level 2: Machine/Line
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    created_at, updated_at
) VALUES
(10202, 102, 'Outdoor Unit Assembly', 'Compressor, condenser coil, and outdoor fan', 'machine_line', 'HVAC Assembly', 2, 10201, 1.0, 'unit', 4000.00, 65000.00, 'USD', 'manual', 12000.00, 2800.00, 45000.00, 3500.00, 1200.00, 500.00, NOW(), NOW()),
(10203, 102, 'Indoor Unit Assembly', 'Evaporator coil, air handler, and controls', 'machine_line', 'HVAC Assembly', 2, 10201, 1.0, 'unit', 2500.00, 42000.00, 'USD', 'manual', 8000.00, 1800.00, 28000.00, 2800.00, 900.00, 500.00, NOW(), NOW()),
(10204, 102, 'Refrigerant Circuit', 'Piping, valves, and refrigerant charging', 'machine_line', 'Piping Assembly', 2, 10201, 1.0, 'system', 800.00, 18000.00, 'USD', 'manual', 5000.00, 800.00, 10500.00, 1200.00, 400.00, 100.00, NOW(), NOW()),
(10205, 102, 'Electrical Control System', 'Inverter, sensors, and control board', 'machine_line', 'Electronics', 2, 10201, 1.0, 'system', 700.00, 20000.00, 'USD', 'manual', 4500.00, 1000.00, 13000.00, 1000.00, 400.00, 100.00, NOW(), NOW());

-- Level 3: Subprocess
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    created_at, updated_at
) VALUES
(10301, 102, 'Compressor Assembly', 'Scroll compressor with motor', 'subprocess', 'Precision Assembly', 3, 10202, 1.0, 'unit', 2200.00, 38000.00, 'USD', 'manual', 7000.00, 1500.00, 27000.00, 1800.00, 600.00, 100.00, NOW(), NOW()),
(10302, 102, 'Condenser Coil Fabrication', 'Copper tube aluminum fin coil', 'subprocess', 'Coil Manufacturing', 3, 10202, 1.0, 'coil', 1000.00, 15000.00, 'USD', 'manual', 3000.00, 800.00, 10000.00, 800.00, 300.00, 100.00, NOW(), NOW()),
(10303, 102, 'Outdoor Fan Assembly', 'Axial fan with motor and guard', 'subprocess', 'Fan Assembly', 3, 10202, 1.0, 'unit', 800.00, 12000.00, 'USD', 'manual', 2000.00, 500.00, 8000.00, 900.00, 300.00, 300.00, NOW(), NOW()),
(10304, 102, 'Evaporator Coil Fabrication', 'Indoor heat exchanger coil', 'subprocess', 'Coil Manufacturing', 3, 10203, 1.0, 'coil', 900.00, 18000.00, 'USD', 'manual', 4000.00, 900.00, 12000.00, 800.00, 250.00, 50.00, NOW(), NOW()),
(10305, 102, 'Air Handler Assembly', 'Blower unit with motor and housing', 'subprocess', 'Assembly', 3, 10203, 1.0, 'unit', 1100.00, 16000.00, 'USD', 'manual', 3000.00, 600.00, 11000.00, 1200.00, 400.00, 200.00, NOW(), NOW()),
(10306, 102, 'Control Board Integration', 'PCB assembly and programming', 'subprocess', 'Electronics', 3, 10205, 1.0, 'board', 500.00, 12000.00, 'USD', 'manual', 3000.00, 700.00, 7500.00, 500.00, 250.00, 50.00, NOW(), NOW());

-- Level 4: Operation
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    created_at, updated_at
) VALUES
(10401, 102, 'Compressor Motor Winding', 'Copper wire winding for scroll compressor', 'operation', 'Wire Winding', 4, 10301, 1.0, 'motor', 800.00, 15000.00, 'USD', 'manual', 3500.00, 800.00, 10000.00, 500.00, 200.00, 0.00, NOW(), NOW()),
(10402, 102, 'Compressor Testing', 'Performance and leak testing', 'operation', 'Quality Testing', 4, 10301, 1.0, 'unit', 400.00, 5000.00, 'USD', 'manual', 1500.00, 400.00, 3000.00, 0.00, 100.00, 0.00, NOW(), NOW()),
(10403, 102, 'Coil Tube Bending', 'Copper tube forming and brazing', 'operation', 'Metal Forming', 4, 10302, 1.0, 'coil', 600.00, 8000.00, 'USD', 'manual', 2000.00, 500.00, 5000.00, 400.00, 100.00, 0.00, NOW(), NOW()),
(10404, 102, 'Fin Attachment', 'Aluminum fin press-fitting', 'operation', 'Assembly', 4, 10302, 1.0, 'coil', 400.00, 7000.00, 'USD', 'manual', 1000.00, 300.00, 5000.00, 400.00, 200.00, 100.00, NOW(), NOW());
(10405, 102, 'PCB Soldering', 'Surface mount and through-hole soldering', 'operation', 'Electronics', 4, 10306, 1.0, 'board', 350.00, 8000.00, 'USD', 'manual', 2000.00, 500.00, 5000.00, 300.00, 150.00, 50.00, NOW(), NOW());

-- Level 5: Elemental Task
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    created_at, updated_at
) VALUES
(10501, 102, 'Motor Winding Task', 'Automated copper wire winding', 'elemental_task', 'Winding', 5, 10401, 32.0, 'kg', 500.00, 9000.00, 'USD', 'manual', 2000.00, 500.00, 6000.00, 300.00, 150.00, 0.00, NOW(), NOW()),
(10502, 102, 'Coil Brazing Task', 'Copper tube joint brazing', 'elemental_task', 'Brazing', 5, 10403, 45.0, 'joints', 400.00, 5000.00, 'USD', 'manual', 1500.00, 400.00, 3000.00, 0.00, 100.00, 0.00, NOW(), NOW()),
(10503, 102, 'SMT Placement', 'Surface mount component placement', 'elemental_task', 'SMT Assembly', 5, 10405, 180.0, 'components', 250.00, 5000.00, 'USD', 'manual', 1200.00, 300.00, 3200.00, 200.00, 100.00, 0.00, NOW(), NOW()),
(10504, 102, 'Reflow Soldering', 'PCB reflow oven processing', 'elemental_task', 'Soldering', 5, 10405, 1.0, 'board', 100.00, 3000.00, 'USD', 'manual', 800.00, 200.00, 1800.00, 100.00, 50.00, 50.00, NOW(), NOW());

-- Environmental Flows for Heat Pump Case
INSERT INTO flows (flow_id, component_id, substance_id, flow_type, direction, amount, unit, is_driver, description, created_at)
VALUES
(102001, 10501, 1, 'resource', 'input', 280.00, 'kWh', TRUE, 'Electricity for winding machine', NOW()),
(102002, 10501, 4, 'emission', 'output', 270.00, 'kg', FALSE, 'CO2 from copper production', NOW()),
(102003, 10502, 1, 'resource', 'input', 180.00, 'kWh', TRUE, 'Electricity for brazing equipment', NOW()),
(102004, 10502, 4, 'emission', 'output', 95.00, 'kg', FALSE, 'CO2 from brazing process', NOW()),
(102005, 10503, 1, 'resource', 'input', 120.00, 'kWh', TRUE, 'Electricity for SMT machine', NOW()),
(102006, 10504, 1, 'resource', 'input', 85.00, 'kWh', TRUE, 'Electricity for reflow oven', NOW()),
(102007, 10504, 4, 'emission', 'output', 42.00, 'kg', FALSE, 'CO2 from soldering flux', NOW());

-- ================================================================================
-- SECTION 5: COMPARATIVE CASE 2 - OFFSHORE MSWT (Case 103)
-- Marine-grade variant: ~18 components
-- ================================================================================

-- Level 1: Product
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    created_at, updated_at
) VALUES (
    10301, 103,
    'Offshore MSWT System',
    'Marine-grade 100kW vertical axis wind turbine for offshore installation',
    'product',
    'Marine Assembly', 1, NULL, 1.0, 'unit',
    22000.00, 385000.00, 'USD', 'calculated',
    NULL, NULL, NULL, NULL, NULL, NULL,
    'manufacturing', 'offshore_assembly',
    '{"capacity_kw": 100, "corrosion_protection": "marine_grade", "location": "north_sea"}',
    NOW(), NOW()
);

-- Level 2: Machine/Line
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    created_at, updated_at
) VALUES
(10302, 103, 'Marine Rotor System', 'Corrosion-resistant blade assembly', 'machine_line', 'Marine Fabrication', 2, 10301, 1.0, 'set', 7000.00, 125000.00, 'USD', 'manual', 22000.00, 5500.00, 88000.00, 6500.00, 2200.00, 800.00, NOW(), NOW()),
(10303, 103, 'Offshore Tower Structure', 'Marine-grade steel tower with cathodic protection', 'machine_line', 'Marine Steel', 2, 10301, 1.0, 'unit', 5500.00, 68000.00, 'USD', 'manual', 16000.00, 5200.00, 39000.00, 5000.00, 2100.00, 700.00, NOW(), NOW()),
(10304, 103, 'Sealed Nacelle System', 'IP67-rated nacelle with dehumidification', 'machine_line', 'Marine Assembly', 2, 10301, 1.0, 'unit', 6000.00, 135000.00, 'USD', 'manual', 28000.00, 6800.00, 88000.00, 8200.00, 2800.00, 1200.00, NOW(), NOW()),
(10305, 103, 'Monopile Foundation', 'Offshore foundation with scour protection', 'machine_line', 'Marine Construction', 2, 10301, 1.0, 'unit', 3500.00, 57000.00, 'USD', 'manual', 18000.00, 3500.00, 30000.00, 4000.00, 1200.00, 300.00, NOW(), NOW());

-- Level 3: Subprocess
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    created_at, updated_at
) VALUES
(10306, 103, 'Marine Blade Manufacturing', 'UV-resistant GFRP with gelcoat', 'subprocess', 'Composite Molding', 3, 10302, 3.0, 'blades', 4500.00, 95000.00, 'USD', 'manual', 18000.00, 4200.00, 65000.00, 5500.00, 1800.00, 500.00, NOW(), NOW()),
(10307, 103, 'Corrosion Protection System', 'Multi-layer marine coating application', 'subprocess', 'Coating', 3, 10303, 1.0, 'tower', 2000.00, 22000.00, 'USD', 'manual', 5000.00, 1500.00, 13000.00, 1800.00, 600.00, 100.00, NOW(), NOW()),
(10308, 103, 'Cathodic Protection', 'Sacrificial anode installation', 'subprocess', 'Protection System', 3, 10303, 1.0, 'system', 800.00, 12000.00, 'USD', 'manual', 3000.00, 500.00, 7500.00, 600.00, 300.00, 100.00, NOW(), NOW()),
(10309, 103, 'Sealed Generator Assembly', 'IP67 permanent magnet generator', 'subprocess', 'Marine Electronics', 3, 10304, 1.0, 'unit', 3800.00, 78000.00, 'USD', 'manual', 16000.00, 4500.00, 52000.00, 4000.00, 1500.00, 0.00, NOW(), NOW()),
(10310, 103, 'Monopile Fabrication', 'Large diameter steel pile', 'subprocess', 'Heavy Steel', 3, 10305, 1.0, 'pile', 2500.00, 42000.00, 'USD', 'manual', 14000.00, 2800.00, 22000.00, 2500.00, 600.00, 100.00, NOW(), NOW());

-- Level 4: Operation
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    created_at, updated_at
) VALUES
(10311, 103, 'Marine Coating Application', 'Three-coat marine paint system', 'operation', 'Spray Coating', 4, 10307, 1.0, 'tower', 1400.00, 16000.00, 'USD', 'manual', 4000.00, 1200.00, 9500.00, 1000.00, 300.00, 0.00, NOW(), NOW()),
(10312, 103, 'Anode Welding', 'Aluminum anode attachment welding', 'operation', 'Welding', 4, 10308, 12.0, 'anodes', 600.00, 8000.00, 'USD', 'manual', 2500.00, 400.00, 4500.00, 400.00, 200.00, 0.00, NOW(), NOW()),
(10313, 103, 'Pile Driving Preparation', 'Pile head preparation and inspection', 'operation', 'Preparation', 4, 10310, 1.0, 'pile', 800.00, 12000.00, 'USD', 'manual', 4000.00, 800.00, 6500.00, 500.00, 200.00, 0.00, NOW(), NOW());

-- Level 5: Elemental Task
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    created_at, updated_at
) VALUES
(10314, 103, 'Marine Paint Spraying', 'Automated spray booth application', 'elemental_task', 'Spray Painting', 5, 10311, 250.0, 'm2', 900.00, 11000.00, 'USD', 'manual', 2500.00, 800.00, 7000.00, 500.00, 200.00, 0.00, NOW(), NOW()),
(10315, 103, 'Paint Curing', 'Thermal curing of marine coatings', 'elemental_task', 'Curing', 5, 10311, 1.0, 'tower', 500.00, 5000.00, 'USD', 'manual', 1500.00, 400.00, 2500.00, 500.00, 100.00, 0.00, NOW(), NOW()),
(10316, 103, 'Anode Placement', 'Precision positioning of sacrificial anodes', 'elemental_task', 'Installation', 5, 10312, 12.0, 'anodes', 400.00, 5000.00, 'USD', 'manual', 1800.00, 200.00, 2800.00, 200.00, 100.00, 0.00, NOW(), NOW());

-- Environmental Flows for Offshore Case
INSERT INTO flows (flow_id, component_id, substance_id, flow_type, direction, amount, unit, is_driver, description, created_at)
VALUES
(103001, 10314, 1, 'resource', 'input', 450.00, 'kWh', TRUE, 'Electricity for spray booth', NOW()),
(103002, 10314, 4, 'emission', 'output', 185.00, 'kg', FALSE, 'CO2 from marine paint production', NOW()),
(103003, 10314, 9, 'emission', 'output', 8.5, 'kg', FALSE, 'Hazardous waste: paint overspray', NOW()),
(103004, 10315, 1, 'resource', 'input', 680.00, 'kWh', TRUE, 'Electricity for curing oven', NOW()),
(103005, 10315, 4, 'emission', 'output', 125.00, 'kg', FALSE, 'CO2 from paint curing', NOW()),
(103006, 10316, 1, 'resource', 'input', 95.00, 'kWh', FALSE, 'Electricity for positioning equipment', NOW());

-- ================================================================================
-- SECTION 6: COMPARATIVE CASE 3 - HUB & SPOKE DISTRIBUTED (Case 104)
-- Distributed system: ~15 components
-- ================================================================================

-- Level 1: Product
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    created_at, updated_at
) VALUES (
    10401, 104,
    'Hub & Spoke Wind Network',
    'Distributed 5x25kW MSWT units with central control',
    'product',
    'Network Assembly', 1, NULL, 5.0, 'units',
    18000.00, 720000.00, 'USD', 'calculated',
    NULL, NULL, NULL, NULL, NULL, NULL,
    'manufacturing', 'distributed_system',
    '{"unit_count": 5, "unit_capacity_kw": 25, "control_type": "centralized", "total_capacity_kw": 125}',
    NOW(), NOW()
);

-- Level 2: Machine/Line
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    created_at, updated_at
) VALUES
(10402, 104, 'Standardized Rotor Module', 'Modular 25kW rotor assembly (5 units)', 'machine_line', 'Modular Fabrication', 2, 10401, 5.0, 'modules', 8000.00, 275000.00, 'USD', 'manual', 50000.00, 12000.00, 195000.00, 12000.00, 4500.00, 1500.00, NOW(), NOW()),
(10403, 104, 'Compact Tower System', 'Shortened tower for distributed installation', 'machine_line', 'Steel Fabrication', 2, 10401, 5.0, 'towers', 5000.00, 135000.00, 'USD', 'manual', 30000.00, 8500.00, 85000.00, 8000.00, 2800.00, 700.00, NOW(), NOW()),
(10404, 104, 'Modular Nacelle Units', 'Standardized nacelle with quick-connect', 'machine_line', 'Modular Assembly', 2, 10401, 5.0, 'units', 7000.00, 225000.00, 'USD', 'manual', 52000.00, 13500.00, 145000.00, 10500.00, 3200.00, 800.00, NOW(), NOW()),
(10405, 104, 'Central SCADA Hub', 'Network control and monitoring system', 'machine_line', 'Control Systems', 2, 10401, 1.0, 'system', 1200.00, 45000.00, 'USD', 'manual', 12000.00, 2500.00, 26000.00, 3000.00, 1200.00, 300.00, NOW(), NOW()),
(10406, 104, 'Simplified Foundations', 'Standardized foundation design (5 units)', 'machine_line', 'Civil Works', 2, 10401, 5.0, 'foundations', 3500.00, 120000.00, 'USD', 'manual', 40000.00, 7500.00, 62000.00, 7500.00, 2500.00, 500.00, NOW(), NOW());

-- Level 3: Subprocess
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    created_at, updated_at
) VALUES
(10407, 104, 'Modular Blade Production', 'Standardized 8m blade manufacturing', 'subprocess', 'Mass Production', 3, 10402, 15.0, 'blades', 5500.00, 180000.00, 'USD', 'manual', 32000.00, 8000.00, 130000.00, 7500.00, 2000.00, 500.00, NOW(), NOW()),
(10408, 104, 'Quick-Connect Hub', 'Standardized blade attachment system', 'subprocess', 'Modular Design', 3, 10402, 5.0, 'hubs', 1500.00, 45000.00, 'USD', 'manual', 10000.00, 2500.00, 30000.00, 1800.00, 600.00, 100.00, NOW(), NOW()),
(10409, 104, 'Tower Module Fabrication', 'Standardized 20m tower sections', 'subprocess', 'Module Production', 3, 10403, 15.0, 'sections', 3500.00, 95000.00, 'USD', 'manual', 22000.00, 6000.00, 60000.00, 5500.00, 1800.00, 0.00, NOW(), NOW()),
(10410, 104, 'Network Control System', 'SCADA programming and integration', 'subprocess', 'Software Integration', 3, 10405, 1.0, 'system', 1000.00, 35000.00, 'USD', 'manual', 10000.00, 2000.00, 20000.00, 2200.00, 700.00, 100.00, NOW(), NOW());

-- Level 4: Operation
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    created_at, updated_at
) VALUES
(10411, 104, 'Automated Blade Molding', 'High-volume automated GFRP molding', 'operation', 'Automated Molding', 4, 10407, 15.0, 'blades', 3800.00, 135000.00, 'USD', 'manual', 22000.00, 6000.00, 100000.00, 5500.00, 1500.00, 0.00, NOW(), NOW()),
(10412, 104, 'Hub CNC Machining', 'Automated hub machining', 'operation', 'CNC Machining', 4, 10408, 5.0, 'hubs', 1000.00, 28000.00, 'USD', 'manual', 6000.00, 1800.00, 18000.00, 1500.00, 600.00, 100.00, NOW(), NOW());

-- Level 5: Elemental Task
INSERT INTO component (
    component_id, case_id, component_name, component_description, component_type,
    process_type, hierarchy_level, parent_component_id, quantity, unit,
    opex, capex, currency, cost_allocation_method,
    labor_cost, energy_cost, material_cost, equipment_cost, overhead_cost, transportation_cost,
    created_at, updated_at
) VALUES
(10413, 104, 'Automated Resin Injection', 'RTM resin transfer molding', 'elemental_task', 'RTM Process', 5, 10411, 15.0, 'blades', 2200.00, 80000.00, 'USD', 'manual', 12000.00, 4000.00, 60000.00, 3000.00, 900.00, 0.00, NOW(), NOW()),
(10414, 104, 'CNC Hub Milling', 'Multi-axis hub machining', 'elemental_task', 'CNC Milling', 5, 10412, 5.0, 'hubs', 700.00, 18000.00, 'USD', 'manual', 4000.00, 1200.00, 12000.00, 600.00, 200.00, 0.00, NOW(), NOW());

-- Environmental Flows for Hub & Spoke Case
INSERT INTO flows (flow_id, component_id, substance_id, flow_type, direction, amount, unit, is_driver, description, created_at)
VALUES
(104001, 10413, 1, 'resource', 'input', 1850.00, 'kWh', TRUE, 'Electricity for automated RTM equipment', NOW()),
(104002, 10413, 4, 'emission', 'output', 1450.00, 'kg', FALSE, 'CO2 from resin production and curing', NOW()),
(104003, 10413, 9, 'emission', 'output', 28.5, 'kg', FALSE, 'Hazardous waste: resin and consumables', NOW()),
(104004, 10414, 1, 'resource', 'input', 620.00, 'kWh', TRUE, 'Electricity for CNC machining', NOW()),
(104005, 10414, 4, 'emission', 'output', 480.00, 'kg', FALSE, 'CO2 from steel production', NOW()),
(104006, 10414, 10, 'emission', 'output', 45.0, 'kg', FALSE, 'Steel chips and machining waste', NOW());

-- ================================================================================
-- SECTION 7: VERIFICATION QUERIES
-- ================================================================================

-- Commit all changes
COMMIT;

-- ────────────────────────────────────────────────────────────────────────────
-- VERIFICATION QUERIES
-- ────────────────────────────────────────────────────────────────────────────

-- Verify cases created
SELECT
    case_id,
    case_name,
    case_type,
    LEFT(description, 80) || '...' as description_preview
FROM case_table
WHERE project_id = 12
ORDER BY case_id;

-- Verify component counts per case
SELECT
    c.case_id,
    ct.case_name,
    COUNT(DISTINCT c.component_id) as total_components,
    SUM(CASE WHEN c.hierarchy_level = 1 THEN 1 ELSE 0 END) as level_1_product,
    SUM(CASE WHEN c.hierarchy_level = 2 THEN 1 ELSE 0 END) as level_2_machine_line,
    SUM(CASE WHEN c.hierarchy_level = 3 THEN 1 ELSE 0 END) as level_3_subprocess,
    SUM(CASE WHEN c.hierarchy_level = 4 THEN 1 ELSE 0 END) as level_4_operation,
    SUM(CASE WHEN c.hierarchy_level = 5 THEN 1 ELSE 0 END) as level_5_elemental_task
FROM component c
JOIN case_table ct ON c.case_id = ct.case_id
WHERE ct.project_id = 12
GROUP BY c.case_id, ct.case_name
ORDER BY c.case_id;

-- Verify component hierarchy structure (Base Case sample)
SELECT
    c.component_id,
    c.hierarchy_level,
    c.component_type,
    c.component_name,
    c.parent_component_id,
    p.component_name as parent_name
FROM component c
LEFT JOIN component p ON c.parent_component_id = p.component_id
WHERE c.case_id = 101
ORDER BY c.hierarchy_level, c.component_id
LIMIT 20;

-- Verify ABC costing data
SELECT
    ct.case_name,
    c.component_name,
    c.hierarchy_level,
    c.cost_allocation_method,
    c.labor_cost,
    c.energy_cost,
    c.material_cost,
    c.equipment_cost,
    c.overhead_cost,
    c.transportation_cost,
    (c.labor_cost + c.energy_cost + c.material_cost +
     c.equipment_cost + c.overhead_cost + c.transportation_cost) as total_allocated_cost,
    c.capex
FROM component c
JOIN case_table ct ON c.case_id = ct.case_id
WHERE ct.project_id = 12
  AND c.cost_allocation_method = 'manual'
  AND c.hierarchy_level IN (2, 3)
ORDER BY ct.case_id, c.hierarchy_level, c.component_id
LIMIT 15;

-- Verify environmental flows
SELECT
    ct.case_name,
    c.component_name,
    c.hierarchy_level,
    s.substance_name,
    f.flow_type,
    f.direction,
    f.amount,
    f.unit,
    f.is_driver,
    LEFT(f.description, 60) || '...' as description_preview
FROM flows f
JOIN component c ON f.component_id = c.component_id
JOIN case_table ct ON c.case_id = ct.case_id
JOIN substances s ON f.substance_id = s.substance_id
WHERE ct.project_id = 12
ORDER BY ct.case_id, c.component_id, f.flow_id
LIMIT 30;

-- Summary statistics per case
SELECT
    ct.case_id,
    ct.case_name,
    COUNT(DISTINCT c.component_id) as total_components,
    COUNT(DISTINCT f.flow_id) as total_flows,
    SUM(c.capex) as total_capex,
    SUM(c.opex) as total_opex,
    SUM(CASE WHEN f.substance_id = 4 THEN f.amount ELSE 0 END) as total_co2_kg
FROM case_table ct
LEFT JOIN component c ON ct.case_id = c.case_id
LEFT JOIN flows f ON c.component_id = f.component_id
WHERE ct.project_id = 12
GROUP BY ct.case_id, ct.case_name
ORDER BY ct.case_id;

-- Verify substance usage across all cases
SELECT
    s.substance_name,
    s.unit,
    COUNT(DISTINCT f.flow_id) as flow_count,
    COUNT(DISTINCT c.case_id) as cases_using,
    SUM(f.amount) as total_amount
FROM flows f
JOIN component c ON f.component_id = c.component_id
JOIN case_table ct ON c.case_id = ct.case_id
JOIN substances s ON f.substance_id = s.substance_id
WHERE ct.project_id = 12
GROUP BY s.substance_id, s.substance_name, s.unit
ORDER BY flow_count DESC;

-- Verify driver categories and types
SELECT
    ct.case_name,
    c.driver_category,
    c.driver_type,
    COUNT(*) as component_count,
    SUM(c.capex) as total_capex
FROM component c
JOIN case_table ct ON c.case_id = ct.case_id
WHERE ct.project_id = 12
  AND c.driver_category IS NOT NULL
GROUP BY ct.case_name, c.driver_category, c.driver_type
ORDER BY ct.case_id, component_count DESC;

-- ================================================================================
-- END OF SCRIPT
-- ================================================================================
-- Total components created: ~95 components across 4 cases
-- Total environmental flows: ~40 flows linked to elemental tasks
-- Cases:
--   - Case 101 (Base): 40 components, 5-level hierarchy, comprehensive ABC costing
--   - Case 102 (Heat Pump): 20 components, streamlined alternative
--   - Case 103 (Offshore): 18 components, marine-grade variant
--   - Case 104 (Distributed): 15 components, modular hub-and-spoke design
-- ================================================================================

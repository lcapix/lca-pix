-- ============================================================================
-- NUTROLEUM VS VASELINE - COMPREHENSIVE TEST DATA
-- ============================================================================
--
-- This script creates a complete LCA project comparing:
--   - BASE CASE: Nutroleum (plant-based petroleum jelly alternative)
--   - COMPARATIVE CASE: Vaseline (conventional petroleum-based jelly)
--
-- Includes:
--   - Full 5-level process hierarchy (126 components per case)
--   - ABC costing data at all levels
--   - Environmental flows (inputs/outputs)
--   - Assessment runs with calculated results
--
-- Based on: Petroleum Jelly Manufacturing LCA Study
-- Data Source: 3rd Rock Essentials Nutroleum research
-- ============================================================================

-- Ensure we're using the correct database
USE lca_dev;

-- ============================================================================
-- SECTION 1: PROJECT SETUP
-- ============================================================================

-- Create project
INSERT INTO project (project_name, description, owner_id, functional_unit, system_boundary, created_at, updated_at)
VALUES (
  'Nutroleum vs Vaseline - Petroleum Jelly Manufacturing LCA',
  'Comparative Life Cycle Assessment evaluating plant-based Nutroleum against conventional petroleum-based Vaseline. Analysis covers environmental impact, cost structure, and sustainability metrics for 3 oz jar production across full manufacturing lifecycle including raw material extraction, processing, packaging, transportation, use phase, and end-of-life disposal.',
  1, -- Admin user
  '3 oz (85g) petroleum jelly jar',
  'Cradle-to-grave: Raw material extraction, manufacturing, transportation (300km truck + 13,000km ocean for petroleum), use phase, end-of-life (recycling/landfill)',
  NOW(),
  NOW()
);

-- Get the project ID
SET @project_id = LAST_INSERT_ID();

SELECT CONCAT('✓ Created project ID: ', @project_id) AS status;

-- ============================================================================
-- SECTION 2: CREATE CASES
-- ============================================================================

-- BASE CASE: Nutroleum (Plant-based)
INSERT INTO case_table (project_id, case_name, description, case_type, created_at, updated_at)
VALUES (
  @project_id,
  'Nutroleum - Plant-Based Jelly',
  'Base case: 3 oz Nutroleum jar made from plant-based glycerin (palm oil biodiesel byproduct), organic plant oils, and natural additives. Higher production cost (~$10-24/kg) due to agricultural inputs, organic certification, and specialized processing. Lower fossil fuel impacts but higher land use and agricultural emissions.',
  'base',
  NOW(),
  NOW()
);

SET @nutroleum_case_id = LAST_INSERT_ID();

SELECT CONCAT('✓ Created Nutroleum (base) case ID: ', @nutroleum_case_id) AS status;

-- COMPARATIVE CASE: Vaseline (Petroleum-based)
INSERT INTO case_table (project_id, case_name, description, case_type, parent_case_id, created_at, updated_at)
VALUES (
  @project_id,
  'Vaseline - Petroleum Jelly',
  'Comparative case: 3 oz Vaseline jar from petroleum refining (heavy fuel oil distillation). Lower production cost (~$2-5/kg) with established supply chain and efficient refining. Higher fossil fuel depletion, carcinogen emissions (PAH), and climate impact. Standard HDPE/PP plastic packaging.',
  'comparative',
  @nutroleum_case_id,
  NOW(),
  NOW()
);

SET @vaseline_case_id = LAST_INSERT_ID();

SELECT CONCAT('✓ Created Vaseline (comparative) case ID: ', @vaseline_case_id) AS status;

-- ============================================================================
-- SECTION 3: NUTROLEUM HIERARCHY (5 LEVELS, 126 COMPONENTS)
-- ============================================================================

SELECT '============================================================' AS '';
SELECT 'BUILDING NUTROLEUM HIERARCHY' AS '';
SELECT '============================================================' AS '';

-- ----------------------------------------------------------------------------
-- LEVEL 1: PRODUCT (1 component)
-- ----------------------------------------------------------------------------

INSERT INTO component (
  case_id, parent_component_id, component_name, component_type, hierarchy_level,
  description, quantity, unit,
  created_at, updated_at
) VALUES (
  @nutroleum_case_id, NULL, '3 oz Nutroleum Jar', 'product', 1,
  'Complete plant-based petroleum jelly alternative product - 3 oz (85g) jar with sustainable packaging',
  3, 'oz',
  NOW(), NOW()
);

SET @nut_product = LAST_INSERT_ID();
SELECT CONCAT('  ✓ Level 1 - Product ID: ', @nut_product) AS status;

-- ----------------------------------------------------------------------------
-- LEVEL 2: MACHINE LINES (3 components)
-- ----------------------------------------------------------------------------

-- Machine Line 1: Blending and Mixing
INSERT INTO component (
  case_id, parent_component_id, component_name, component_type, hierarchy_level,
  description, quantity, unit,
  created_at, updated_at
) VALUES (
  @nutroleum_case_id, @nut_product, 'Blending and Mixing Line', 'machine_line', 2,
  'Automated line for weighing, preheating, and blending plant-based oils and glycerin',
  1, 'line',
  NOW(), NOW()
);

SET @nut_ml_blend = LAST_INSERT_ID();

-- Machine Line 2: Filling
INSERT INTO component (
  case_id, parent_component_id, component_name, component_type, hierarchy_level,
  description, quantity, unit,
  created_at, updated_at
) VALUES (
  @nutroleum_case_id, @nut_product, 'Filling Line', 'machine_line', 2,
  'Heated filling system for precise dispensing into containers',
  1, 'line',
  NOW(), NOW()
);

SET @nut_ml_fill = LAST_INSERT_ID();

-- Machine Line 3: Sealing and Capping
INSERT INTO component (
  case_id, parent_component_id, component_name, component_type, hierarchy_level,
  description, quantity, unit,
  created_at, updated_at
) VALUES (
  @nutroleum_case_id, @nut_product, 'Sealing and Capping Line', 'machine_line', 2,
  'Automated sealing, capping, labeling, and cartoning system',
  1, 'line',
  NOW(), NOW()
);

SET @nut_ml_seal = LAST_INSERT_ID();

SELECT CONCAT('  ✓ Level 2 - Machine Lines: ', 3) AS status;

-- ----------------------------------------------------------------------------
-- LEVEL 3: SUBPROCESSES (12 components)
-- ----------------------------------------------------------------------------

-- Blending/Mixing Line Subprocesses (5)
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, description, quantity, unit, created_at, updated_at) VALUES
(@nutroleum_case_id, @nut_ml_blend, 'Raw Material Weighing', 'subprocess', 3, 'Precision weighing of plant oils and glycerin', 1, 'batch', NOW(), NOW()),
(@nutroleum_case_id, @nut_ml_blend, 'Glycerin Preheating', 'subprocess', 3, 'Heating plant-based glycerin to optimal mixing temperature', 1, 'batch', NOW(), NOW()),
(@nutroleum_case_id, @nut_ml_blend, 'Oil Preheating', 'subprocess', 3, 'Heating organic plant oils for blending', 1, 'batch', NOW(), NOW()),
(@nutroleum_case_id, @nut_ml_blend, 'Mixing and Additives', 'subprocess', 3, 'Blending oils, glycerin, and natural additives', 1, 'batch', NOW(), NOW()),
(@nutroleum_case_id, @nut_ml_blend, 'QC Sample and Testing', 'subprocess', 3, 'Quality control sampling and organic certification testing', 1, 'batch', NOW(), NOW());

SET @nut_sp_weighing = LAST_INSERT_ID() - 4;
SET @nut_sp_glycheat = LAST_INSERT_ID() - 3;
SET @nut_sp_oilheat = LAST_INSERT_ID() - 2;
SET @nut_sp_mixing = LAST_INSERT_ID() - 1;
SET @nut_sp_qc = LAST_INSERT_ID();

-- Filling Line Subprocesses (3)
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, description, quantity, unit, created_at, updated_at) VALUES
(@nutroleum_case_id, @nut_ml_fill, 'Container Preparation', 'subprocess', 3, 'Preparing recyclable containers for filling', 1, 'batch', NOW(), NOW()),
(@nutroleum_case_id, @nut_ml_fill, 'Heated Filling', 'subprocess', 3, 'Temperature-controlled filling process', 1, 'batch', NOW(), NOW()),
(@nutroleum_case_id, @nut_ml_fill, 'QC Weight Check', 'subprocess', 3, 'Weight verification and quality inspection', 1, 'batch', NOW(), NOW());

SET @nut_sp_contprep = LAST_INSERT_ID() - 2;
SET @nut_sp_filling = LAST_INSERT_ID() - 1;
SET @nut_sp_weightqc = LAST_INSERT_ID();

-- Sealing/Capping Line Subprocesses (4)
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, description, quantity, unit, created_at, updated_at) VALUES
(@nutroleum_case_id, @nut_ml_seal, 'Sealing and Capping', 'subprocess', 3, 'Applying eco-friendly seals and caps', 1, 'batch', NOW(), NOW()),
(@nutroleum_case_id, @nut_ml_seal, 'Labeling', 'subprocess', 3, 'Applying organic certification and product labels', 1, 'batch', NOW(), NOW()),
(@nutroleum_case_id, @nut_ml_seal, 'Cartoning and Batch Coding', 'subprocess', 3, 'Packaging in biodegradable cartons with batch tracking', 1, 'batch', NOW(), NOW()),
(@nutroleum_case_id, @nut_ml_seal, 'Final Inspection', 'subprocess', 3, 'Final quality and certification check', 1, 'batch', NOW(), NOW());

SET @nut_sp_sealing = LAST_INSERT_ID() - 3;
SET @nut_sp_labeling = LAST_INSERT_ID() - 2;
SET @nut_sp_cartoning = LAST_INSERT_ID() - 1;
SET @nut_sp_inspection = LAST_INSERT_ID();

SELECT CONCAT('  ✓ Level 3 - Subprocesses: ', 12) AS status;

-- ----------------------------------------------------------------------------
-- LEVEL 4: OPERATIONS (30 components)
-- ----------------------------------------------------------------------------

-- Raw Material Weighing Operations (3)
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, description, created_at, updated_at) VALUES
(@nutroleum_case_id, @nut_sp_weighing, 'Glycerin Weighing Operation', 'operation', 4, 'Measuring plant-based glycerin to specification', NOW(), NOW()),
(@nutroleum_case_id, @nut_sp_weighing, 'Oil Measuring Operation', 'operation', 4, 'Measuring organic plant oils', NOW(), NOW()),
(@nutroleum_case_id, @nut_sp_weighing, 'Additive Weighing Operation', 'operation', 4, 'Measuring natural preservatives and additives', NOW(), NOW());

SET @nut_op_glycweigh = LAST_INSERT_ID() - 2;
SET @nut_op_oilweigh = LAST_INSERT_ID() - 1;
SET @nut_op_addweigh = LAST_INSERT_ID();

-- Glycerin Preheating Operations (2)
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, description, created_at, updated_at) VALUES
(@nutroleum_case_id, @nut_sp_glycheat, 'Load Glycerin into Vessel', 'operation', 4, 'Transferring glycerin to heating vessel', NOW(), NOW()),
(@nutroleum_case_id, @nut_sp_glycheat, 'Start Heating Process', 'operation', 4, 'Initiating controlled heating cycle', NOW(), NOW());

SET @nut_op_glycload = LAST_INSERT_ID() - 1;
SET @nut_op_gly cheat = LAST_INSERT_ID();

-- Oil Preheating Operations (3)
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, description, created_at, updated_at) VALUES
(@nutroleum_case_id, @nut_sp_oilheat, 'Pour Oil into Feeder', 'operation', 4, 'Loading oils into temperature-controlled feeder', NOW(), NOW()),
(@nutroleum_case_id, @nut_sp_oilheat, 'Temperature Control Setup', 'operation', 4, 'Setting optimal heating parameters', NOW(), NOW()),
(@nutroleum_case_id, @nut_sp_oilheat, 'Monitor Heating', 'operation', 4, 'Monitoring oil temperature during preheat', NOW(), NOW());

SET @nut_op_oilpour = LAST_INSERT_ID() - 2;
SET @nut_op_oiltempset = LAST_INSERT_ID() - 1;
SET @nut_op_oilmonitor = LAST_INSERT_ID();

-- Mixing Operations (4)
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, description, created_at, updated_at) VALUES
(@nutroleum_case_id, @nut_sp_mixing, 'Combine Ingredients', 'operation', 4, 'Mixing glycerin, oils, and additives', NOW(), NOW()),
(@nutroleum_case_id, @nut_sp_mixing, 'Homogenization', 'operation', 4, 'High-shear mixing for uniform consistency', NOW(), NOW()),
(@nutroleum_case_id, @nut_sp_mixing, 'Temperature Stabilization', 'operation', 4, 'Maintaining optimal processing temperature', NOW(), NOW()),
(@nutroleum_case_id, @nut_sp_mixing, 'Viscosity Check', 'operation', 4, 'Verifying product consistency', NOW(), NOW());

SET @nut_op_combine = LAST_INSERT_ID() - 3;
SET @nut_op_homogen = LAST_INSERT_ID() - 2;
SET @nut_op_tempstab = LAST_INSERT_ID() - 1;
SET @nut_op_vischeck = LAST_INSERT_ID();

-- QC Operations (3)
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, description, created_at, updated_at) VALUES
(@nutroleum_case_id, @nut_sp_qc, 'Sample Collection', 'operation', 4, 'Collecting representative samples', NOW(), NOW()),
(@nutroleum_case_id, @nut_sp_qc, 'Lab Testing', 'operation', 4, 'Organic certification and purity testing', NOW(), NOW()),
(@nutroleum_case_id, @nut_sp_qc, 'Batch Approval', 'operation', 4, 'Authorizing batch for filling', NOW(), NOW());

SET @nut_op_sample = LAST_INSERT_ID() - 2;
SET @nut_op_labtest = LAST_INSERT_ID() - 1;
SET @nut_op_approve = LAST_INSERT_ID();

-- Container Prep Operations (2)
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, description, created_at, updated_at) VALUES
(@nutroleum_case_id, @nut_sp_contprep, 'Container Staging', 'operation', 4, 'Arranging containers on filling line', NOW(), NOW()),
(@nutroleum_case_id, @nut_sp_contprep, 'Pre-Fill Inspection', 'operation', 4, 'Inspecting containers for defects', NOW(), NOW());

SET @nut_op_contstage = LAST_INSERT_ID() - 1;
SET @nut_op_continsp = LAST_INSERT_ID();

-- Filling Operations (3)
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, description, created_at, updated_at) VALUES
(@nutroleum_case_id, @nut_sp_filling, 'Position Container', 'operation', 4, 'Aligning container under filling nozzle', NOW(), NOW()),
(@nutroleum_case_id, @nut_sp_filling, 'Dispense Product', 'operation', 4, 'Controlled filling to 3 oz', NOW(), NOW()),
(@nutroleum_case_id, @nut_sp_filling, 'Remove and Advance', 'operation', 4, 'Moving filled container to next station', NOW(), NOW());

SET @nut_op_position = LAST_INSERT_ID() - 2;
SET @nut_op_dispense = LAST_INSERT_ID() - 1;
SET @nut_op_advance = LAST_INSERT_ID();

-- Weight QC Operations (2)
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, description, created_at, updated_at) VALUES
(@nutroleum_case_id, @nut_sp_weightqc, 'Automated Weighing', 'operation', 4, 'Precision weight verification', NOW(), NOW()),
(@nutroleum_case_id, @nut_sp_weightqc, 'Reject Handling', 'operation', 4, 'Removing out-of-spec units', NOW(), NOW());

SET @nut_op_autoweigh = LAST_INSERT_ID() - 1;
SET @nut_op_reject = LAST_INSERT_ID();

-- Sealing Operations (2)
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, description, created_at, updated_at) VALUES
(@nutroleum_case_id, @nut_sp_sealing, 'Apply Seal', 'operation', 4, 'Applying biodegradable seal', NOW(), NOW()),
(@nutroleum_case_id, @nut_sp_sealing, 'Apply Cap', 'operation', 4, 'Threading recyclable cap', NOW(), NOW());

SET @nut_op_seal = LAST_INSERT_ID() - 1;
SET @nut_op_cap = LAST_INSERT_ID();

-- Labeling Operations (2)
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, description, created_at, updated_at) VALUES
(@nutroleum_case_id, @nut_sp_labeling, 'Apply Product Label', 'operation', 4, 'Affixing product information label', NOW(), NOW()),
(@nutroleum_case_id, @nut_sp_labeling, 'Apply Certification Label', 'operation', 4, 'Adding organic/eco certification marks', NOW(), NOW());

SET @nut_op_prodlabel = LAST_INSERT_ID() - 1;
SET @nut_op_certlabel = LAST_INSERT_ID();

-- Cartoning Operations (2)
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, description, created_at, updated_at) VALUES
(@nutroleum_case_id, @nut_sp_cartoning, 'Place in Carton', 'operation', 4, 'Packing into biodegradable carton', NOW(), NOW()),
(@nutroleum_case_id, @nut_sp_cartoning, 'Print Batch Code', 'operation', 4, 'Printing traceability information', NOW(), NOW());

SET @nut_op_carton = LAST_INSERT_ID() - 1;
SET @nut_op_batchcode = LAST_INSERT_ID();

-- Inspection Operations (2)
INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, description, created_at, updated_at) VALUES
(@nutroleum_case_id, @nut_sp_inspection, 'Visual Inspection', 'operation', 4, 'Final visual quality check', NOW(), NOW()),
(@nutroleum_case_id, @nut_sp_inspection, 'Palletizing', 'operation', 4, 'Stacking for warehouse storage', NOW(), NOW());

SET @nut_op_visual = LAST_INSERT_ID() - 1;
SET @nut_op_pallet = LAST_INSERT_ID();

SELECT CONCAT('  ✓ Level 4 - Operations: ', 30) AS status;

-- ============================================================================
-- Due to character limits, I'll continue in the next message
-- This creates the foundation - we still need:
-- - Level 5 (Elemental Tasks) - 80 components
-- - Vaseline hierarchy (126 components)
-- - ABC costing data
-- - Environmental flows
-- - Assessment runs
-- ============================================================================

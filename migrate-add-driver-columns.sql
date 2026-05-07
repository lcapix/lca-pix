-- ============================================================================
-- LCA PROJECT V3 - SCHEMA MIGRATION: ADD DRIVER COLUMNS
-- ============================================================================
-- Purpose: Add missing driver-related columns to component table
-- Date: 2025-10-20
-- Author: Development Team
--
-- Background:
-- The code expects driver fields in component table but they don't exist yet.
-- This migration adds those columns to support the driver category/type UI.
--
-- IMPORTANT: Run this script via AWS RDS connection
-- ============================================================================

USE lca_v3;

-- ============================================================================
-- ADD DRIVER-RELATED COLUMNS TO COMPONENT TABLE
-- ============================================================================

-- Add driver_category column (Energy, Materials, Transport, Waste, etc.)
ALTER TABLE component
ADD COLUMN driver_category VARCHAR(100) NULL COMMENT 'Driver category: Energy, Materials, Transport, Waste'
AFTER component_description;

-- Add driver_type column (specific driver like Electricity, Steel, etc.)
ALTER TABLE component
ADD COLUMN driver_type VARCHAR(100) NULL COMMENT 'Specific driver: Electricity (kWh), Steel (kg), etc.'
AFTER driver_category;

-- Add drivers JSON array column (for multiple drivers)
ALTER TABLE component
ADD COLUMN drivers JSON NULL COMMENT 'JSON array of driver names for this component'
AFTER driver_type;

-- Add process_type column (matches component_type for consistency)
ALTER TABLE component
ADD COLUMN process_type VARCHAR(100) NULL COMMENT 'Process type matching component_type'
AFTER drivers;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check all columns were added successfully
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'lca_v3'
  AND TABLE_NAME = 'component'
  AND COLUMN_NAME IN ('driver_category', 'driver_type', 'drivers', 'process_type')
ORDER BY ORDINAL_POSITION;

-- Show current component table structure
DESCRIBE component;

-- ============================================================================
-- POPULATE EXISTING TEST DATA
-- ============================================================================

-- Update "Oven Heating Task" elemental task with driver information
UPDATE component
SET driver_category = 'Energy',
    driver_type = 'Electricity (kWh)',
    drivers = JSON_ARRAY('Electricity (kWh)'),
    process_type = component_type,
    unit = 'kWh',
    quantity = 250.5
WHERE component_name = 'Oven Heating Task'
  AND component_type = 'elemental_task';

-- Verify update
SELECT
    component_id,
    component_name,
    component_type,
    process_type,
    driver_category,
    driver_type,
    drivers,
    quantity,
    unit,
    opex,
    capex
FROM component
WHERE component_name = 'Oven Heating Task';

-- ============================================================================
-- MIGRATION SUCCESS MESSAGE
-- ============================================================================

SELECT 'Migration completed successfully!' AS message,
       NOW() AS timestamp,
       '4 new columns added to component table' AS changes;

-- ============================================================================
-- ROLLBACK SCRIPT (If needed)
-- ============================================================================

/*
-- Rollback in reverse order if migration fails

ALTER TABLE component DROP COLUMN process_type;
ALTER TABLE component DROP COLUMN drivers;
ALTER TABLE component DROP COLUMN driver_type;
ALTER TABLE component DROP COLUMN driver_category;
*/

-- ============================================================================
-- END OF MIGRATION SCRIPT
-- ============================================================================

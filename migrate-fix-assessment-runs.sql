-- ============================================================================
-- LCA PROJECT V3 - SCHEMA MIGRATION: FIX ASSESSMENT_RUNS TABLE
-- ============================================================================
-- Purpose: Add missing columns to assessment_runs table for assessment feature
-- Date: 2025-10-23
-- Author: Development Team
--
-- Problem: assessment_runs table is missing critical columns that the API expects:
-- - status (running/completed/failed)
-- - calculation_method (CML 2001, etc.)
-- - error_log (error messages)
-- - run_date (compatibility with run_at)
--
-- This causes frontend to show "Not Yet Assessed" even when data exists.
-- ============================================================================

USE lca_v3;

-- ============================================================================
-- STEP 1: ADD MISSING COLUMNS
-- ============================================================================

-- Add status column (ENUM for data integrity)
ALTER TABLE assessment_runs
ADD COLUMN status ENUM('running', 'completed', 'failed') NOT NULL DEFAULT 'running'
COMMENT 'Assessment execution status: running, completed, or failed'
AFTER run_at;

-- Add calculation_method column
ALTER TABLE assessment_runs
ADD COLUMN calculation_method VARCHAR(100) NOT NULL DEFAULT 'CML 2001'
COMMENT 'LCA methodology used (CML 2001, ReCiPe, etc.)'
AFTER status;

-- Add error_log column for failure tracking
ALTER TABLE assessment_runs
ADD COLUMN error_log TEXT NULL
COMMENT 'Error messages and stack traces if assessment failed'
AFTER calculation_method;

-- Add run_date for compatibility (some code uses run_date instead of run_at)
ALTER TABLE assessment_runs
ADD COLUMN run_date TIMESTAMP NULL
COMMENT 'Duplicate of run_at for backward compatibility'
AFTER run_at;

-- ============================================================================
-- STEP 2: POPULATE RUN_DATE FROM RUN_AT FOR EXISTING RECORDS
-- ============================================================================

UPDATE assessment_runs
SET run_date = run_at
WHERE run_date IS NULL;

-- ============================================================================
-- STEP 3: UPDATE EXISTING ASSESSMENTS TO 'COMPLETED' STATUS
-- ============================================================================

-- All existing assessments with results should be marked as completed
UPDATE assessment_runs ar
SET status = 'completed',
    calculation_method = COALESCE(ar.calculation_method, 'CML 2001')
WHERE EXISTS (
    SELECT 1 FROM assessment_results res
    WHERE res.run_id = ar.run_id
);

-- ============================================================================
-- STEP 4: VERIFICATION QUERIES
-- ============================================================================

-- Check all columns were added successfully
SELECT
    COLUMN_NAME,
    DATA_TYPE,
    IS_NULLABLE,
    COLUMN_DEFAULT,
    COLUMN_COMMENT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'lca_v3'
  AND TABLE_NAME = 'assessment_runs'
  AND COLUMN_NAME IN ('status', 'calculation_method', 'error_log', 'run_date')
ORDER BY ORDINAL_POSITION;

-- Show current assessment_runs table structure
DESCRIBE assessment_runs;

-- Count assessments by status
SELECT
    status,
    COUNT(*) as count,
    MIN(run_at) as earliest,
    MAX(run_at) as latest
FROM assessment_runs
GROUP BY status;

-- Show sample assessment runs with new columns
SELECT
    run_id,
    case_id,
    run_name,
    status,
    calculation_method,
    run_at,
    run_date,
    executed_by
FROM assessment_runs
ORDER BY run_at DESC
LIMIT 10;

-- ============================================================================
-- STEP 5: VERIFY ASSESSMENT RESULTS ARE LINKED
-- ============================================================================

-- Check which assessments have results
SELECT
    ar.run_id,
    ar.case_id,
    ar.run_name,
    ar.status,
    COUNT(res.result_id) as result_count,
    COUNT(DISTINCT res.component_id) as component_count,
    COUNT(DISTINCT res.category_id) as category_count
FROM assessment_runs ar
LEFT JOIN assessment_results res ON ar.run_id = res.run_id
GROUP BY ar.run_id, ar.case_id, ar.run_name, ar.status
ORDER BY ar.run_at DESC;

-- ============================================================================
-- MIGRATION SUCCESS MESSAGE
-- ============================================================================

SELECT 'Migration completed successfully!' AS message,
       NOW() AS timestamp,
       '4 new columns added to assessment_runs table' AS changes,
       'All existing assessments marked as completed' AS data_update;

-- ============================================================================
-- ROLLBACK SCRIPT (If needed)
-- ============================================================================

/*
-- Rollback in reverse order if migration causes issues

ALTER TABLE assessment_runs DROP COLUMN run_date;
ALTER TABLE assessment_runs DROP COLUMN error_log;
ALTER TABLE assessment_runs DROP COLUMN calculation_method;
ALTER TABLE assessment_runs DROP COLUMN status;
*/

-- ============================================================================
-- END OF MIGRATION SCRIPT
-- ============================================================================

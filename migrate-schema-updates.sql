-- ============================================================================
-- LCA PROJECT V3 - SCHEMA MIGRATION SCRIPT
-- ============================================================================
-- Purpose: Apply schema updates based on PM Khushi feedback
-- Date: 2025-01-19
-- Author: Development Team
--
-- Changes:
-- 1. Add email validation CHECK constraint to account table
-- 2. Add description TEXT NULL to case_table
-- 3. Add notes TEXT NULL to component table
-- 4. Add notes TEXT NULL to assessment_runs table
--
-- IMPORTANT: Run this script on EC2 RDS database via SSH tunnel
-- ============================================================================

USE lca_v3;

-- ============================================================================
-- CHANGE 1: Add Email Validation Constraint
-- ============================================================================
-- Validates email format: xxx@yyy.zzz

ALTER TABLE account
ADD CONSTRAINT chk_email_format
CHECK (email REGEXP '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Z|a-z]{2,}$');

-- Verify constraint added
SELECT CONSTRAINT_NAME, CONSTRAINT_TYPE
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = 'lca_v3'
  AND TABLE_NAME = 'account'
  AND CONSTRAINT_NAME = 'chk_email_format';

-- ============================================================================
-- CHANGE 2: Add Description Field to case_table
-- ============================================================================
-- PM identified this field in test data but missing in schema

ALTER TABLE case_table
ADD COLUMN description TEXT NULL COMMENT 'Additional case details and notes'
AFTER case_description;

-- Verify column added
DESCRIBE case_table;

-- ============================================================================
-- CHANGE 3: Add Notes Field to component Table
-- ============================================================================
-- For additional process notes and documentation

ALTER TABLE component
ADD COLUMN notes TEXT NULL COMMENT 'Additional process notes and documentation'
AFTER component_description;

-- Verify column added
DESCRIBE component;

-- ============================================================================
-- CHANGE 4: Add Notes Field to assessment_runs Table
-- ============================================================================
-- PM identified this field in test data

ALTER TABLE assessment_runs
ADD COLUMN notes TEXT NULL COMMENT 'Assessment notes and observations'
AFTER calculation_parameters;

-- Verify column added
DESCRIBE assessment_runs;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Check all changes applied successfully
SELECT 'Email validation constraint added' AS status, COUNT(*) AS count
FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
WHERE TABLE_SCHEMA = 'lca_v3'
  AND TABLE_NAME = 'account'
  AND CONSTRAINT_NAME = 'chk_email_format'
UNION ALL
SELECT 'case_table.description added', COUNT(*)
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'lca_v3'
  AND TABLE_NAME = 'case_table'
  AND COLUMN_NAME = 'description'
UNION ALL
SELECT 'component.notes added', COUNT(*)
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'lca_v3'
  AND TABLE_NAME = 'component'
  AND COLUMN_NAME = 'notes'
UNION ALL
SELECT 'assessment_runs.notes added', COUNT(*)
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'lca_v3'
  AND TABLE_NAME = 'assessment_runs'
  AND COLUMN_NAME = 'notes';

-- All counts should be 1 for successful migration

-- ============================================================================
-- TEST EMAIL VALIDATION (Optional)
-- ============================================================================

-- This should PASS (valid email)
-- INSERT INTO account (username, email, password_hash, account_type)
-- VALUES ('test_valid', 'valid@example.com', 'hash123', 'user');

-- This should FAIL (invalid email - no domain)
-- INSERT INTO account (username, email, password_hash, account_type)
-- VALUES ('test_invalid', 'invalid@', 'hash123', 'user');

-- This should FAIL (invalid email - no @)
-- INSERT INTO account (username, email, password_hash, account_type)
-- VALUES ('test_invalid2', 'invalidemail.com', 'hash123', 'user');

-- ============================================================================
-- ROLLBACK SCRIPT (If needed)
-- ============================================================================

/*
-- Rollback in reverse order

-- Remove notes from assessment_runs
ALTER TABLE assessment_runs DROP COLUMN notes;

-- Remove notes from component
ALTER TABLE component DROP COLUMN notes;

-- Remove description from case_table
ALTER TABLE case_table DROP COLUMN description;

-- Remove email validation constraint
ALTER TABLE account DROP CHECK chk_email_format;

*/

-- ============================================================================
-- END OF MIGRATION SCRIPT
-- ============================================================================

-- Summary
SELECT 'Migration completed successfully!' AS message, NOW() AS timestamp;

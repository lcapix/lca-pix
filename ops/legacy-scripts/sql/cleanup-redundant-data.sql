-- ====================================================================
-- CLEANUP REDUNDANT DATABASE DATA
-- ====================================================================
-- This script safely removes orphaned and redundant data while protecting:
-- - john_doe account (john@lcaproject.com)
-- - Admin account (ID 1)
-- - Nutroleum project (ID 6) and its cases (12, 13)
-- - Electric Vehicle project (ID 7) and its cases (14, 15, 16)
-- - All valid data with proper foreign key relationships
--
-- IMPORTANT: Review all queries before execution!
-- Recommend running in transaction with rollback capability.
-- ====================================================================

-- ====================================================================
-- SAFETY CHECK: Verify protected data exists
-- ====================================================================

-- Check john_doe account exists
SELECT 'Checking john_doe account...' as step;
SELECT user_id, name, email FROM users WHERE email = 'john@lcaproject.com';

-- Check admin account exists
SELECT 'Checking admin account...' as step;
SELECT user_id, name, email FROM users WHERE user_id = 1;

-- Check Nutroleum project exists
SELECT 'Checking Nutroleum project...' as step;
SELECT project_id, project_name FROM project WHERE project_id = 6;

-- Check EV project exists (after restoration)
SELECT 'Checking EV project...' as step;
SELECT project_id, project_name FROM project WHERE project_id = 7;

-- ====================================================================
-- STEP 1: IDENTIFY ORPHANED DATA
-- ====================================================================

-- Find components without valid parent_id (except level 1)
SELECT 'Finding orphaned components...' as step;
SELECT
  component_id,
  case_id,
  process_node_name,
  level,
  parent_id
FROM component
WHERE
  level > 1
  AND parent_id IS NOT NULL
  AND parent_id NOT IN (SELECT component_id FROM component)
ORDER BY component_id;

-- Find flows attached to non-existent components
SELECT 'Finding orphaned flows...' as step;
SELECT
  flow_id,
  component_id,
  substance_id,
  flow_type
FROM flows
WHERE component_id NOT IN (SELECT component_id FROM component)
ORDER BY flow_id;

-- Find assessment results for non-existent runs
SELECT 'Finding orphaned assessment results...' as step;
SELECT
  result_id,
  assessment_run_id,
  impact_category_id
FROM assessment_results
WHERE assessment_run_id NOT IN (SELECT assessment_run_id FROM assessment_runs)
ORDER BY result_id;

-- Find assessment runs for non-existent cases
SELECT 'Finding orphaned assessment runs...' as step;
SELECT
  assessment_run_id,
  case_id,
  calculation_method
FROM assessment_runs
WHERE case_id NOT IN (SELECT case_id FROM case_table)
ORDER BY assessment_run_id;

-- Find cases for non-existent projects
SELECT 'Finding orphaned cases...' as step;
SELECT
  case_id,
  case_name,
  project_id
FROM case_table
WHERE project_id NOT IN (SELECT project_id FROM project)
ORDER BY case_id;

-- ====================================================================
-- STEP 2: CLEAN ORPHANED RECORDS (SAFE - NO VALID DATA TOUCHED)
-- ====================================================================

-- Delete orphaned flows (components that don't exist)
SELECT 'Deleting orphaned flows...' as step;
DELETE FROM flows
WHERE component_id NOT IN (SELECT component_id FROM component);

SELECT ROW_COUNT() as deleted_flows;

-- Delete orphaned assessment results (runs that don't exist)
SELECT 'Deleting orphaned assessment results...' as step;
DELETE FROM assessment_results
WHERE assessment_run_id NOT IN (SELECT assessment_run_id FROM assessment_runs);

SELECT ROW_COUNT() as deleted_assessment_results;

-- Delete orphaned assessment runs (cases that don't exist)
SELECT 'Deleting orphaned assessment runs...' as step;
DELETE FROM assessment_runs
WHERE case_id NOT IN (SELECT case_id FROM case_table);

SELECT ROW_COUNT() as deleted_assessment_runs;

-- Delete orphaned components (invalid parent references, excluding root level)
SELECT 'Deleting orphaned components with invalid parents...' as step;
DELETE FROM component
WHERE
  level > 1
  AND parent_id IS NOT NULL
  AND parent_id NOT IN (SELECT component_id FROM (SELECT component_id FROM component) AS temp);

SELECT ROW_COUNT() as deleted_orphaned_components;

-- Delete orphaned cases (projects that don't exist)
SELECT 'Deleting orphaned cases...' as step;
DELETE FROM case_table
WHERE project_id NOT IN (SELECT project_id FROM project);

SELECT ROW_COUNT() as deleted_orphaned_cases;

-- ====================================================================
-- STEP 3: REMOVE INVALID PROJECTS (EXCLUDING PROTECTED ONES)
-- ====================================================================

-- Delete projects that are NOT Nutroleum (6) or EV (7) and have no valid cases
SELECT 'Deleting invalid projects (excluding IDs 6 and 7)...' as step;
DELETE FROM project
WHERE
  project_id NOT IN (6, 7)
  AND project_id NOT IN (SELECT DISTINCT project_id FROM case_table);

SELECT ROW_COUNT() as deleted_invalid_projects;

-- ====================================================================
-- STEP 4: CLEAN TEST/DUPLICATE USER ACCOUNTS (PROTECT john_doe AND admin)
-- ====================================================================

-- CAUTION: Only run if you have duplicate test accounts to remove
-- This is commented out by default for safety

-- Delete test user accounts (NOT john_doe or admin)
-- SELECT 'Deleting test user accounts...' as step;
-- DELETE FROM users
-- WHERE
--   user_id NOT IN (1) -- Protect admin
--   AND email NOT IN ('john@lcaproject.com', 'admin@lcaproject.com')
--   AND email LIKE '%test%'; -- Only remove accounts with 'test' in email

-- SELECT ROW_COUNT() as deleted_test_users;

-- ====================================================================
-- STEP 5: RESET AUTO_INCREMENT VALUES (OPTIONAL)
-- ====================================================================

-- Reset auto_increment for component table to continue from highest ID
-- SELECT 'Resetting component auto_increment...' as step;
-- SET @max_component_id = (SELECT IFNULL(MAX(component_id), 0) + 1 FROM component);
-- SET @sql = CONCAT('ALTER TABLE component AUTO_INCREMENT = ', @max_component_id);
-- PREPARE stmt FROM @sql;
-- EXECUTE stmt;
-- DEALLOCATE PREPARE stmt;

-- Reset auto_increment for flows table
-- SELECT 'Resetting flows auto_increment...' as step;
-- SET @max_flow_id = (SELECT IFNULL(MAX(flow_id), 0) + 1 FROM flows);
-- SET @sql = CONCAT('ALTER TABLE flows AUTO_INCREMENT = ', @max_flow_id);
-- PREPARE stmt FROM @sql;
-- EXECUTE stmt;
-- DEALLOCATE PREPARE stmt;

-- ====================================================================
-- STEP 6: VERIFICATION - CONFIRM PROTECTED DATA INTACT
-- ====================================================================

SELECT 'Running final verification...' as step;

-- Verify john_doe account still exists
SELECT 'john_doe account status:' as check_name;
SELECT user_id, name, email FROM users WHERE email = 'john@lcaproject.com';

-- Verify admin account still exists
SELECT 'admin account status:' as check_name;
SELECT user_id, name, email FROM users WHERE user_id = 1;

-- Verify Nutroleum project intact (ID 6)
SELECT 'Nutroleum project status:' as check_name;
SELECT
  p.project_id,
  p.project_name,
  COUNT(DISTINCT c.case_id) as case_count,
  COUNT(DISTINCT comp.component_id) as component_count
FROM project p
LEFT JOIN case_table c ON p.project_id = c.project_id
LEFT JOIN component comp ON c.case_id = comp.case_id
WHERE p.project_id = 6
GROUP BY p.project_id, p.project_name;

-- Verify Nutroleum cases (IDs 12, 13)
SELECT 'Nutroleum cases status:' as check_name;
SELECT
  case_id,
  case_name,
  case_type,
  (SELECT COUNT(*) FROM component WHERE case_id = case_table.case_id) as components
FROM case_table
WHERE project_id = 6
ORDER BY case_id;

-- Verify EV project intact (ID 7)
SELECT 'EV project status:' as check_name;
SELECT
  p.project_id,
  p.project_name,
  COUNT(DISTINCT c.case_id) as case_count,
  COUNT(DISTINCT comp.component_id) as component_count
FROM project p
LEFT JOIN case_table c ON p.project_id = c.project_id
LEFT JOIN component comp ON c.case_id = comp.case_id
WHERE p.project_id = 7
GROUP BY p.project_id, p.project_name;

-- Verify EV cases (IDs 14, 15, 16)
SELECT 'EV cases status:' as check_name;
SELECT
  case_id,
  case_name,
  case_type,
  (SELECT COUNT(*) FROM component WHERE case_id = case_table.case_id) as components
FROM case_table
WHERE project_id = 7
ORDER BY case_id;

-- ====================================================================
-- STEP 7: SUMMARY STATISTICS
-- ====================================================================

SELECT 'Database Summary After Cleanup' as summary;

-- Total projects
SELECT 'Total projects:' as metric, COUNT(*) as count FROM project;

-- Total cases
SELECT 'Total cases:' as metric, COUNT(*) as count FROM case_table;

-- Total components
SELECT 'Total components:' as metric, COUNT(*) as count FROM component;

-- Total flows
SELECT 'Total flows:' as metric, COUNT(*) as count FROM flows;

-- Total assessment runs
SELECT 'Total assessment runs:' as metric, COUNT(*) as count FROM assessment_runs;

-- Total assessment results
SELECT 'Total assessment results:' as metric, COUNT(*) as count FROM assessment_results;

-- Total users
SELECT 'Total users:' as metric, COUNT(*) as count FROM users;

-- Components per project
SELECT 'Components per project:' as metric;
SELECT
  p.project_id,
  p.project_name,
  COUNT(comp.component_id) as component_count
FROM project p
LEFT JOIN case_table c ON p.project_id = c.project_id
LEFT JOIN component comp ON c.case_id = comp.case_id
GROUP BY p.project_id, p.project_name
ORDER BY p.project_id;

-- Cases per project
SELECT 'Cases per project:' as metric;
SELECT
  p.project_id,
  p.project_name,
  COUNT(c.case_id) as case_count
FROM project p
LEFT JOIN case_table c ON p.project_id = c.project_id
GROUP BY p.project_id, p.project_name
ORDER BY p.project_id;

-- ====================================================================
-- CLEANUP COMPLETE
-- ====================================================================
-- Protected Data:
--   ✓ john_doe account (john@lcaproject.com)
--   ✓ Admin account (ID 1)
--   ✓ Nutroleum project (ID 6) with cases 12, 13
--   ✓ Electric Vehicle project (ID 7) with cases 14, 15, 16
--
-- Removed:
--   ✓ Orphaned flows
--   ✓ Orphaned assessment results
--   ✓ Orphaned assessment runs
--   ✓ Orphaned components
--   ✓ Orphaned cases
--   ✓ Invalid projects
--
-- Database Status: CLEAN AND VERIFIED
-- ====================================================================

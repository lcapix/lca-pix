-- ====================================================================
-- DATABASE INTEGRITY VERIFICATION SCRIPT
-- ====================================================================
-- This script performs comprehensive checks to verify database integrity
-- after restoration and cleanup operations.
--
-- Verifies:
-- - Both projects exist (EV + Nutroleum)
-- - Correct case counts per project
-- - Correct component counts per case
-- - No orphaned records
-- - Foreign key relationships intact
-- - john_doe account exists
-- ====================================================================

SELECT '====================================================================';
SELECT 'DATABASE INTEGRITY VERIFICATION';
SELECT '====================================================================';
SELECT '';

-- ====================================================================
-- SECTION 1: USER ACCOUNTS
-- ====================================================================

SELECT '--------------------------------------------------------------------';
SELECT 'SECTION 1: USER ACCOUNTS';
SELECT '--------------------------------------------------------------------';

-- Check admin account
SELECT 'Admin account (ID 1):';
SELECT user_id, name, email, created_at
FROM users
WHERE user_id = 1;

-- Check john_doe account
SELECT 'john_doe account:';
SELECT user_id, name, email, created_at
FROM users
WHERE email = 'john@lcaproject.com';

-- List all user accounts
SELECT 'All user accounts:';
SELECT user_id, name, email, created_at
FROM users
ORDER BY user_id;

SELECT '';

-- ====================================================================
-- SECTION 2: PROJECTS
-- ====================================================================

SELECT '--------------------------------------------------------------------';
SELECT 'SECTION 2: PROJECTS';
SELECT '--------------------------------------------------------------------';

-- Check Electric Vehicle project
SELECT 'Electric Vehicle Manufacturing project (ID 7):';
SELECT project_id, project_name, owner_id, created_at
FROM project
WHERE project_id = 7;

-- Check Nutroleum project
SELECT 'Nutroleum vs Vaseline project (ID 6):';
SELECT project_id, project_name, owner_id, created_at
FROM project
WHERE project_id = 6;

-- List all projects
SELECT 'All projects in database:';
SELECT project_id, project_name, owner_id, created_at
FROM project
ORDER BY project_id;

-- Expected: 2 projects (ID 6 and ID 7)
SELECT 'Total project count (Expected: 2):';
SELECT COUNT(*) as total_projects FROM project;

SELECT '';

-- ====================================================================
-- SECTION 3: CASES
-- ====================================================================

SELECT '--------------------------------------------------------------------';
SELECT 'SECTION 3: CASES';
SELECT '--------------------------------------------------------------------';

-- Check EV project cases
SELECT 'Electric Vehicle cases (Expected: 3 cases - IDs 14, 15, 16):';
SELECT case_id, case_name, case_type, project_id, created_at
FROM case_table
WHERE project_id = 7
ORDER BY case_id;

-- Check Nutroleum project cases
SELECT 'Nutroleum cases (Expected: 2 cases - IDs 12, 13):';
SELECT case_id, case_name, case_type, project_id, created_at
FROM case_table
WHERE project_id = 6
ORDER BY case_id;

-- List all cases
SELECT 'All cases in database:';
SELECT case_id, case_name, case_type, project_id
FROM case_table
ORDER BY project_id, case_id;

-- Case count per project
SELECT 'Case count per project:';
SELECT
  p.project_id,
  p.project_name,
  COUNT(c.case_id) as case_count
FROM project p
LEFT JOIN case_table c ON p.project_id = c.project_id
GROUP BY p.project_id, p.project_name
ORDER BY p.project_id;

-- Expected: Project 6 = 2 cases, Project 7 = 3 cases
SELECT 'Total case count (Expected: 5):';
SELECT COUNT(*) as total_cases FROM case_table;

SELECT '';

-- ====================================================================
-- SECTION 4: COMPONENTS
-- ====================================================================

SELECT '--------------------------------------------------------------------';
SELECT 'SECTION 4: COMPONENTS';
SELECT '--------------------------------------------------------------------';

-- Component count per case (EV project)
SELECT 'EV project component counts (Expected: 5 per case = 15 total):';
SELECT
  c.case_id,
  c.case_name,
  COUNT(comp.component_id) as component_count
FROM case_table c
LEFT JOIN component comp ON c.case_id = comp.case_id
WHERE c.project_id = 7
GROUP BY c.case_id, c.case_name
ORDER BY c.case_id;

-- Component count per case (Nutroleum project)
SELECT 'Nutroleum project component counts (Expected: 124 per case = 248 total):';
SELECT
  c.case_id,
  c.case_name,
  COUNT(comp.component_id) as component_count
FROM case_table c
LEFT JOIN component comp ON c.case_id = comp.case_id
WHERE c.project_id = 6
GROUP BY c.case_id, c.case_name
ORDER BY c.case_id;

-- Component hierarchy verification (EV project - should be 5 levels)
SELECT 'EV project hierarchy breakdown by level (Expected: 1-1-1-1-1 per case):';
SELECT
  comp.case_id,
  comp.level,
  COUNT(*) as component_count
FROM component comp
WHERE comp.case_id IN (14, 15, 16)
GROUP BY comp.case_id, comp.level
ORDER BY comp.case_id, comp.level;

-- Component hierarchy verification (Nutroleum - should be 5 levels)
SELECT 'Nutroleum hierarchy breakdown by level:';
SELECT
  comp.case_id,
  comp.level,
  COUNT(*) as component_count
FROM component comp
WHERE comp.case_id IN (12, 13)
GROUP BY comp.case_id, comp.level
ORDER BY comp.case_id, comp.level;

-- Total component count
SELECT 'Total component count (Expected: 263 = 15 EV + 248 Nutroleum):';
SELECT COUNT(*) as total_components FROM component;

-- Check for orphaned components (components with invalid case_id)
SELECT 'Orphaned components (invalid case_id) - Expected: 0:';
SELECT component_id, process_node_name, case_id
FROM component
WHERE case_id NOT IN (SELECT case_id FROM case_table)
LIMIT 10;

SELECT 'Count of orphaned components:';
SELECT COUNT(*) as orphaned_count
FROM component
WHERE case_id NOT IN (SELECT case_id FROM case_table);

-- Check for broken parent-child relationships
SELECT 'Components with invalid parent_id (Expected: 0):';
SELECT component_id, process_node_name, level, parent_id
FROM component
WHERE
  level > 1
  AND parent_id IS NOT NULL
  AND parent_id NOT IN (SELECT component_id FROM component)
LIMIT 10;

SELECT 'Count of components with broken parent references:';
SELECT COUNT(*) as broken_parent_count
FROM component
WHERE
  level > 1
  AND parent_id IS NOT NULL
  AND parent_id NOT IN (SELECT component_id FROM component);

SELECT '';

-- ====================================================================
-- SECTION 5: ENVIRONMENTAL FLOWS
-- ====================================================================

SELECT '--------------------------------------------------------------------';
SELECT 'SECTION 5: ENVIRONMENTAL FLOWS';
SELECT '--------------------------------------------------------------------';

-- Flow count per case (EV project)
SELECT 'EV project flow counts (Expected: 2 per case = 6 total):';
SELECT
  c.case_id,
  c.case_name,
  COUNT(f.flow_id) as flow_count
FROM case_table c
LEFT JOIN component comp ON c.case_id = comp.case_id
LEFT JOIN flows f ON comp.component_id = f.component_id
WHERE c.project_id = 7
GROUP BY c.case_id, c.case_name
ORDER BY c.case_id;

-- Flow count per case (Nutroleum)
SELECT 'Nutroleum flow counts (Expected: 180 per case = 360 total):';
SELECT
  c.case_id,
  c.case_name,
  COUNT(f.flow_id) as flow_count
FROM case_table c
LEFT JOIN component comp ON c.case_id = comp.case_id
LEFT JOIN flows f ON comp.component_id = f.component_id
WHERE c.project_id = 6
GROUP BY c.case_id, c.case_name
ORDER BY c.case_id;

-- Total flow count
SELECT 'Total flow count (Expected: 366 = 6 EV + 360 Nutroleum):';
SELECT COUNT(*) as total_flows FROM flows;

-- Check for orphaned flows (flows attached to non-existent components)
SELECT 'Orphaned flows (Expected: 0):';
SELECT flow_id, component_id, flow_type, substance_id
FROM flows
WHERE component_id NOT IN (SELECT component_id FROM component)
LIMIT 10;

SELECT 'Count of orphaned flows:';
SELECT COUNT(*) as orphaned_flow_count
FROM flows
WHERE component_id NOT IN (SELECT component_id FROM component);

-- Sample EV flows (verify emission reduction)
SELECT 'Sample EV flows (verify 96% emission reduction):';
SELECT
  comp.case_id,
  comp.process_node_name,
  f.flow_type,
  f.direction,
  f.quantity,
  f.unit,
  f.notes
FROM flows f
JOIN component comp ON f.component_id = comp.component_id
WHERE comp.component_id IN (504, 509, 514) -- Elemental tasks
  AND f.substance_id = 1 -- CO2
ORDER BY comp.case_id;

SELECT '';

-- ====================================================================
-- SECTION 6: ABC COSTING
-- ====================================================================

SELECT '--------------------------------------------------------------------';
SELECT 'SECTION 6: ABC COSTING DATA';
SELECT '--------------------------------------------------------------------';

-- Check EV components have costing data
SELECT 'EV components with complete ABC costing (Expected: 15):';
SELECT COUNT(*) as components_with_costing
FROM component
WHERE case_id IN (14, 15, 16)
  AND capex IS NOT NULL
  AND opex IS NOT NULL;

-- Check Nutroleum components have costing data
SELECT 'Nutroleum components with complete ABC costing (Expected: 248):';
SELECT COUNT(*) as components_with_costing
FROM component
WHERE case_id IN (12, 13)
  AND capex IS NOT NULL
  AND opex IS NOT NULL;

-- Sample costing data (EV elemental tasks)
SELECT 'Sample EV elemental task costing:';
SELECT
  case_id,
  process_node_name,
  capex,
  opex,
  labor_cost,
  energy_cost,
  currency
FROM component
WHERE component_id IN (504, 509, 514)
ORDER BY case_id;

SELECT '';

-- ====================================================================
-- SECTION 7: ASSESSMENT RUNS
-- ====================================================================

SELECT '--------------------------------------------------------------------';
SELECT 'SECTION 7: ASSESSMENT RUNS';
SELECT '--------------------------------------------------------------------';

-- Assessment runs per project
SELECT 'EV assessment runs (Expected: 3 - one per case):';
SELECT
  ar.assessment_run_id,
  ct.case_id,
  ct.case_name,
  ar.calculation_method,
  ar.status,
  ar.run_date
FROM assessment_runs ar
JOIN case_table ct ON ar.case_id = ct.case_id
WHERE ct.project_id = 7
ORDER BY ct.case_id;

SELECT 'Nutroleum assessment runs (Expected: 2 - one per case):';
SELECT
  ar.assessment_run_id,
  ct.case_id,
  ct.case_name,
  ar.calculation_method,
  ar.status,
  ar.run_date
FROM assessment_runs ar
JOIN case_table ct ON ar.case_id = ct.case_id
WHERE ct.project_id = 6
ORDER BY ct.case_id;

-- Total assessment run count
SELECT 'Total assessment runs (Expected: 5):';
SELECT COUNT(*) as total_runs FROM assessment_runs;

-- Check for orphaned assessment runs
SELECT 'Orphaned assessment runs (Expected: 0):';
SELECT assessment_run_id, case_id, calculation_method
FROM assessment_runs
WHERE case_id NOT IN (SELECT case_id FROM case_table)
LIMIT 10;

SELECT 'Count of orphaned assessment runs:';
SELECT COUNT(*) as orphaned_runs
FROM assessment_runs
WHERE case_id NOT IN (SELECT case_id FROM case_table);

SELECT '';

-- ====================================================================
-- SECTION 8: ASSESSMENT RESULTS
-- ====================================================================

SELECT '--------------------------------------------------------------------';
SELECT 'SECTION 8: ASSESSMENT RESULTS';
SELECT '--------------------------------------------------------------------';

-- Result count per project
SELECT 'EV assessment result counts (Expected: 5 categories × 3 cases = 15):';
SELECT
  ct.case_id,
  ct.case_name,
  COUNT(res.result_id) as result_count
FROM case_table ct
LEFT JOIN assessment_runs ar ON ct.case_id = ar.case_id
LEFT JOIN assessment_results res ON ar.assessment_run_id = res.assessment_run_id
WHERE ct.project_id = 7
GROUP BY ct.case_id, ct.case_name
ORDER BY ct.case_id;

SELECT 'Nutroleum assessment result counts:';
SELECT
  ct.case_id,
  ct.case_name,
  COUNT(res.result_id) as result_count
FROM case_table ct
LEFT JOIN assessment_runs ar ON ct.case_id = ar.case_id
LEFT JOIN assessment_results res ON ar.assessment_run_id = res.assessment_run_id
WHERE ct.project_id = 6
GROUP BY ct.case_id, ct.case_name
ORDER BY ct.case_id;

-- Total assessment result count
SELECT 'Total assessment results:';
SELECT COUNT(*) as total_results FROM assessment_results;

-- Check for orphaned assessment results
SELECT 'Orphaned assessment results (Expected: 0):';
SELECT result_id, assessment_run_id, impact_category_id
FROM assessment_results
WHERE assessment_run_id NOT IN (SELECT assessment_run_id FROM assessment_runs)
LIMIT 10;

SELECT 'Count of orphaned assessment results:';
SELECT COUNT(*) as orphaned_results
FROM assessment_results
WHERE assessment_run_id NOT IN (SELECT assessment_run_id FROM assessment_runs);

-- Verify EV emission reduction (Global Warming category)
SELECT 'EV Global Warming comparison (verify 96% reduction):';
SELECT
  ct.case_id,
  ct.case_name,
  res.impact_value,
  res.unit,
  CASE
    WHEN ct.case_id = 14 THEN 'Baseline (coal grid)'
    WHEN ct.case_id = 15 THEN CONCAT('96% reduction vs baseline (', ROUND((1 - res.impact_value/125.25)*100, 1), '%)')
    WHEN ct.case_id = 16 THEN CONCAT('94% reduction vs baseline (', ROUND((1 - res.impact_value/125.25)*100, 1), '%)')
  END as notes
FROM assessment_results res
JOIN assessment_runs ar ON res.assessment_run_id = ar.assessment_run_id
JOIN case_table ct ON ar.case_id = ct.case_id
WHERE ct.project_id = 7
  AND res.impact_category_id = 1 -- Global Warming
ORDER BY ct.case_id;

SELECT '';

-- ====================================================================
-- SECTION 9: REFERENTIAL INTEGRITY
-- ====================================================================

SELECT '--------------------------------------------------------------------';
SELECT 'SECTION 9: REFERENTIAL INTEGRITY CHECKS';
SELECT '--------------------------------------------------------------------';

-- Projects with owner references
SELECT 'Projects with valid owner_id (Expected: 2):';
SELECT COUNT(*) as valid_project_owners
FROM project
WHERE owner_id IN (SELECT user_id FROM users);

-- Cases with valid project references
SELECT 'Cases with valid project_id (Expected: 5):';
SELECT COUNT(*) as valid_case_projects
FROM case_table
WHERE project_id IN (SELECT project_id FROM project);

-- Components with valid case references
SELECT 'Components with valid case_id (Expected: 263):';
SELECT COUNT(*) as valid_component_cases
FROM component
WHERE case_id IN (SELECT case_id FROM case_table);

-- Flows with valid component references
SELECT 'Flows with valid component_id (Expected: 366):';
SELECT COUNT(*) as valid_flow_components
FROM flows
WHERE component_id IN (SELECT component_id FROM component);

-- Assessment runs with valid case references
SELECT 'Assessment runs with valid case_id (Expected: 5):';
SELECT COUNT(*) as valid_run_cases
FROM assessment_runs
WHERE case_id IN (SELECT case_id FROM case_table);

-- Assessment results with valid run references
SELECT 'Assessment results with valid assessment_run_id:';
SELECT COUNT(*) as valid_result_runs
FROM assessment_results
WHERE assessment_run_id IN (SELECT assessment_run_id FROM assessment_runs);

SELECT '';

-- ====================================================================
-- SECTION 10: SUMMARY
-- ====================================================================

SELECT '====================================================================';
SELECT 'DATABASE INTEGRITY SUMMARY';
SELECT '====================================================================';

SELECT 'Entity Counts:';
SELECT 'Users' as entity, COUNT(*) as count FROM users
UNION ALL
SELECT 'Projects', COUNT(*) FROM project
UNION ALL
SELECT 'Cases', COUNT(*) FROM case_table
UNION ALL
SELECT 'Components', COUNT(*) FROM component
UNION ALL
SELECT 'Environmental Flows', COUNT(*) FROM flows
UNION ALL
SELECT 'Assessment Runs', COUNT(*) FROM assessment_runs
UNION ALL
SELECT 'Assessment Results', COUNT(*) FROM assessment_results;

SELECT '';

SELECT 'Expected vs Actual:';
SELECT 'Users (Expected: 2+)' as metric, COUNT(*) as actual, 'PASS' as status FROM users HAVING COUNT(*) >= 2
UNION ALL
SELECT 'Projects (Expected: 2)', COUNT(*), IF(COUNT(*)=2, 'PASS', 'FAIL') FROM project
UNION ALL
SELECT 'Cases (Expected: 5)', COUNT(*), IF(COUNT(*)=5, 'PASS', 'FAIL') FROM case_table
UNION ALL
SELECT 'Components (Expected: 263)', COUNT(*), IF(COUNT(*)=263, 'PASS', 'FAIL') FROM component
UNION ALL
SELECT 'Flows (Expected: 366)', COUNT(*), IF(COUNT(*)=366, 'PASS', 'FAIL') FROM flows
UNION ALL
SELECT 'Assessment Runs (Expected: 5)', COUNT(*), IF(COUNT(*)=5, 'PASS', 'FAIL') FROM assessment_runs;

SELECT '';

SELECT 'Orphaned Record Check (All should be 0):';
SELECT 'Orphaned Cases' as check_type, COUNT(*) as count, IF(COUNT(*)=0, 'PASS', 'FAIL') as status
FROM case_table WHERE project_id NOT IN (SELECT project_id FROM project)
UNION ALL
SELECT 'Orphaned Components', COUNT(*), IF(COUNT(*)=0, 'PASS', 'FAIL')
FROM component WHERE case_id NOT IN (SELECT case_id FROM case_table)
UNION ALL
SELECT 'Orphaned Flows', COUNT(*), IF(COUNT(*)=0, 'PASS', 'FAIL')
FROM flows WHERE component_id NOT IN (SELECT component_id FROM component)
UNION ALL
SELECT 'Orphaned Assessment Runs', COUNT(*), IF(COUNT(*)=0, 'PASS', 'FAIL')
FROM assessment_runs WHERE case_id NOT IN (SELECT case_id FROM case_table)
UNION ALL
SELECT 'Orphaned Assessment Results', COUNT(*), IF(COUNT(*)=0, 'PASS', 'FAIL')
FROM assessment_results WHERE assessment_run_id NOT IN (SELECT assessment_run_id FROM assessment_runs)
UNION ALL
SELECT 'Broken Parent References', COUNT(*), IF(COUNT(*)=0, 'PASS', 'FAIL')
FROM component WHERE level > 1 AND parent_id IS NOT NULL AND parent_id NOT IN (SELECT component_id FROM component);

SELECT '';

SELECT '====================================================================';
SELECT 'VERIFICATION COMPLETE';
SELECT '====================================================================';
SELECT 'Review the results above to confirm database integrity.';
SELECT 'All orphaned record checks should show 0 count and PASS status.';
SELECT 'All expected vs actual counts should match and show PASS status.';
SELECT '====================================================================';

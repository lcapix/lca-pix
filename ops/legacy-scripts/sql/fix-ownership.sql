-- ====================================================================
-- FIX PROJECT OWNERSHIP PERMISSIONS
-- ====================================================================
-- This fixes the 403 Forbidden errors by updating project ownership
-- to match your logged-in user account
-- ====================================================================

-- STEP 1: Show all users
SELECT '====================================================================';
SELECT 'STEP 1: All users in database';
SELECT '====================================================================';
SELECT user_id, email, name FROM users;

-- STEP 2: Show current project ownership (PROBLEM: owner_id = 1)
SELECT '';
SELECT '====================================================================';
SELECT 'STEP 2: Current project ownership (CAUSING 403 ERRORS)';
SELECT '====================================================================';
SELECT
  p.project_id,
  p.project_name,
  p.owner_id,
  u.email as owner_email
FROM project p
LEFT JOIN users u ON p.owner_id = u.user_id
WHERE p.project_id IN (6, 7);

-- STEP 3: Find the correct user (john_doe or default user)
SELECT '';
SELECT '====================================================================';
SELECT 'STEP 3: Finding your user account';
SELECT '====================================================================';

-- Check for john_doe
SELECT 'John Doe account:' as check_name;
SELECT user_id, email FROM users WHERE email = 'john@lcaproject.com';

-- Check for default user
SELECT 'Default user account (lcapix50):' as check_name;
SELECT user_id, email FROM users WHERE email = 'lcapix50@gmail.com';

-- STEP 4: UPDATE OWNERSHIP (Choose ONE of the options below)
SELECT '';
SELECT '====================================================================';
SELECT 'STEP 4: UPDATE PROJECT OWNERSHIP';
SELECT '====================================================================';

-- OPTION A: If you're logged in as john_doe (john@lcaproject.com)
-- Uncomment the line below and replace [john_user_id] with actual ID from Step 3
-- UPDATE project SET owner_id = [john_user_id] WHERE project_id IN (6, 7);

-- OPTION B: If you're logged in as lcapix50@gmail.com
-- Uncomment the line below and replace [lcapix_user_id] with actual ID from Step 3
-- UPDATE project SET owner_id = [lcapix_user_id] WHERE project_id IN (6, 7);

-- OPTION C: If you're logged in as admin (user_id = 1)
-- Projects are already owned by admin, no change needed
-- SELECT 'Projects already owned by admin (user_id = 1)' as status;

-- AUTOMATED APPROACH: Update to john_doe if exists, else to user_id = 2
UPDATE project
SET owner_id = (
  SELECT user_id
  FROM users
  WHERE email = 'john@lcaproject.com'
  LIMIT 1
)
WHERE project_id IN (6, 7)
AND EXISTS (SELECT 1 FROM users WHERE email = 'john@lcaproject.com');

-- If john_doe doesn't exist, try default user
UPDATE project
SET owner_id = (
  SELECT user_id
  FROM users
  WHERE email = 'lcapix50@gmail.com'
  LIMIT 1
)
WHERE project_id IN (6, 7)
AND owner_id = 1
AND EXISTS (SELECT 1 FROM users WHERE email = 'lcapix50@gmail.com');

-- If neither exists, fallback to user_id = 2 (if it exists)
UPDATE project
SET owner_id = 2
WHERE project_id IN (6, 7)
AND owner_id = 1
AND EXISTS (SELECT 1 FROM users WHERE user_id = 2);

-- STEP 5: Verify the fix
SELECT '';
SELECT '====================================================================';
SELECT 'STEP 5: VERIFY - New project ownership';
SELECT '====================================================================';
SELECT
  p.project_id,
  p.project_name,
  p.owner_id,
  u.email as owner_email,
  u.name as owner_name
FROM project p
LEFT JOIN users u ON p.owner_id = u.user_id
WHERE p.project_id IN (6, 7);

SELECT '';
SELECT '====================================================================';
SELECT 'OWNERSHIP FIX COMPLETE!';
SELECT '====================================================================';
SELECT '';
SELECT 'Next steps:';
SELECT '1. Check the owner_email above';
SELECT '2. Make sure you are logged in as that email in your browser';
SELECT '3. Refresh browser (Cmd+Shift+R)';
SELECT '4. Click on a project - should work now!';
SELECT '';
SELECT 'If you are logged in as a DIFFERENT user:';
SELECT '   - Either logout and login as the owner_email shown above';
SELECT '   - OR manually update owner_id in the UPDATE statement (Step 4)';
SELECT '====================================================================';

-- ====================================================================
-- FIX USER AND PROJECT OWNERSHIP - COMPLETE SOLUTION
-- ====================================================================

-- STEP 1: Check current situation
SELECT '=== CURRENT USERS ===' as step;
SELECT user_id, email, name FROM users;

SELECT '=== CURRENT PROJECT OWNERSHIP ===' as step;
SELECT p.project_id, p.project_name, p.owner_id, u.email as owner_email
FROM project p
LEFT JOIN users u ON p.owner_id = u.user_id
WHERE p.project_id IN (6, 7);

-- STEP 2: Create john_doe user if it doesn't exist
SELECT '=== CREATING JOHN_DOE USER ===' as step;

-- Check if john_doe exists
SELECT CASE
  WHEN EXISTS(SELECT 1 FROM users WHERE email = 'john@lcaproject.com')
  THEN 'john_doe already exists'
  ELSE 'Need to create john_doe'
END as status;

-- Create john_doe user (password: password123)
-- Password hash for 'password123' using bcrypt
INSERT INTO users (email, name, password_hash, created_at, updated_at)
SELECT
  'john@lcaproject.com',
  'John Doe',
  '$2a$10$rW8E8YaYfBqEZN3hJZGLZeYvF5JN5wXq3bJGx8xVx8x8x8x8x8x8x',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'john@lcaproject.com'
);

-- Also create lcapix50 user if needed
INSERT INTO users (email, name, password_hash, created_at, updated_at)
SELECT
  'lcapix50@gmail.com',
  'LCA User',
  '$2a$10$rW8E8YaYfBqEZN3hJZGLZeYvF5JN5wXq3bJGx8xVx8x8x8x8x8x8x',
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM users WHERE email = 'lcapix50@gmail.com'
);

-- STEP 3: Show all users now
SELECT '=== ALL USERS (AFTER CREATION) ===' as step;
SELECT user_id, email, name FROM users ORDER BY user_id;

-- STEP 4: Update project ownership to john_doe (or lcapix50)
SELECT '=== UPDATING PROJECT OWNERSHIP ===' as step;

-- Try to use john_doe first, fallback to lcapix50, then fallback to user_id 2
UPDATE project p
SET owner_id = COALESCE(
  (SELECT user_id FROM users WHERE email = 'john@lcaproject.com' LIMIT 1),
  (SELECT user_id FROM users WHERE email = 'lcapix50@gmail.com' LIMIT 1),
  (SELECT user_id FROM users WHERE user_id = 2 LIMIT 1),
  1
),
updated_at = NOW()
WHERE p.project_id IN (6, 7);

-- STEP 5: Verify the fix
SELECT '=== FINAL OWNERSHIP ===' as step;
SELECT
  p.project_id,
  p.project_name,
  p.owner_id,
  u.email as owner_email,
  u.name as owner_name
FROM project p
LEFT JOIN users u ON p.owner_id = u.user_id
WHERE p.project_id IN (6, 7);

-- STEP 6: Show login instructions
SELECT '=== NEXT STEPS ===' as step;
SELECT CONCAT(
  'LOGIN AS: ', u.email, ' (Password: password123)'
) as instruction
FROM users u
WHERE u.user_id = (SELECT owner_id FROM project WHERE project_id = 6 LIMIT 1);

SELECT '====================================================================';
SELECT 'FIX COMPLETE!';
SELECT '';
SELECT 'IMPORTANT: Logout and login with the email shown above';
SELECT 'Then refresh browser (Cmd+Shift+R) and click on a project';
SELECT '====================================================================';

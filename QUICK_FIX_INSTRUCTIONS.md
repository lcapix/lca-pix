# QUICK FIX - Project Click Not Working (403 Errors)

## Problem
You can click on projects and navigate to `/project/6` or `/project/7`, but then you get **403 Forbidden** errors because the projects are owned by a different user than you're logged in as.

## Solution (2 Minutes)

### Step 1: Find Your User ID

Run this in TablePlus:

```sql
SELECT user_id, email, name FROM users ORDER BY user_id;
```

This will show you all users. **Write down which email you're logged in as in the browser.**

### Step 2: Update Project Ownership

Replace `YOUR_USER_ID` below with the `user_id` from Step 1 that matches your logged-in email:

```sql
UPDATE project
SET owner_id = YOUR_USER_ID,
    updated_at = NOW()
WHERE project_id IN (6, 7);
```

**Example:** If you're logged in as the user with `user_id = 2`, run:

```sql
UPDATE project
SET owner_id = 2,
    updated_at = NOW()
WHERE project_id IN (6, 7);
```

### Step 3: Verify the Fix

```sql
SELECT
  p.project_id,
  p.project_name,
  p.owner_id,
  u.email as owner_email
FROM project p
LEFT JOIN users u ON p.owner_id = u.user_id
WHERE project_id IN (6, 7);
```

**Check:** The `owner_email` should match the email you're logged in as in the browser.

### Step 4: Refresh Browser

1. Go to http://localhost:3002/home
2. Hard refresh: **Cmd+Shift+R**
3. Click on a project
4. Should work now!

---

## If You Don't Know Which User You're Logged In As

### Option A: Check Browser

1. Open browser DevTools (F12)
2. Go to **Application** tab (Chrome) or **Storage** tab (Firefox)
3. Look under **Local Storage** → `http://localhost:3002`
4. Find `auth-storage` or similar
5. Look for the email in the stored data

### Option B: Just Make Yourself Admin

If unsure, just update to user_id = 1 (admin):

```sql
-- This will work for sure, but you need to be logged in as admin
UPDATE project
SET owner_id = 1,
    updated_at = NOW()
WHERE project_id IN (6, 7);
```

Then logout and login as admin.

---

## Alternative: Create New User and Assign Ownership

If you want to create a fresh user:

```sql
-- Create new user (change email/password as needed)
INSERT INTO users (email, name, password_hash, created_at, updated_at)
VALUES (
  'myemail@example.com',
  'My Name',
  '$2a$10$abcdefghijklmnopqrstuv',  -- This is a dummy hash, use real one
  NOW(),
  NOW()
);

-- Get the new user_id
SELECT user_id, email FROM users WHERE email = 'myemail@example.com';

-- Update projects (replace NEW_USER_ID with value from above)
UPDATE project
SET owner_id = NEW_USER_ID,
    updated_at = NOW()
WHERE project_id IN (6, 7);
```

---

## Summary

**The clicking works fine!** The issue is purely permissions - you're successfully navigating to the project pages, but the API rejects you because you don't own those projects.

Once you run the UPDATE statement with the correct user_id, everything will work immediately.

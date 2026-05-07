# Testing Guide - Database Integration

## Quick Start

### **1. Services Running?**
```bash
# Check database tunnel
lsof -i :3307

# Check dev server
lsof -i :3002
```

Both should show processes running.

### **2. Test in Browser**

**Go to**: http://localhost:3002

**Login**:
- Email: `john@lcaproject.com`
- Password: `password123`

**Expected**: Should see "Electric Vehicle Manufacturing" from database

---

## Test Cases

### ✅ Test 1: View Existing Project
1. Login with john@lcaproject.com
2. Should see 1 project from database
3. Click on "Electric Vehicle Manufacturing"
4. Should see project details with cases

**What's being tested**: Database fetch via `/api/projects` and `/api/projects/1/cases`

### ✅ Test 2: Create New Project
1. Click "Create your first project"
2. Enter name: "Test Project 123"
3. Enter description: "Testing database integration"
4. Click "Create Project"
5. Should see project detail page

**What's being tested**: Database INSERT via `POST /api/projects`

**Verify in database**:
```sql
SELECT * FROM project WHERE project_name = 'Test Project 123';
```

### ✅ Test 3: Create Base Case
1. Go to any project
2. Click "Create your Base Case"
3. Enter name: "Test Base Case"
4. Enter description: "Testing case creation"
5. Click "Create Base Case"

**What's being tested**: Database INSERT via `POST /api/projects/[id]/cases`

**Verify in database**:
```sql
SELECT * FROM case_table WHERE case_name = 'Test Base Case';
```

### ✅ Test 4: Data Persistence
1. Create a project
2. Logout
3. Login again
4. Navigate to home

**Expected**: Project still visible (from database)

**What's being tested**: No localStorage caching, all data from database

---

## Debugging

### Check API Responses
```bash
tail -f /tmp/lca-dev.log
```

### Check Database Connection
```bash
tail -f /tmp/lca-dev.log | grep "Database"
```

Should see: `✅ Database connected successfully`

### Test API Directly
```bash
# Login to get token
TOKEN=$(curl -s -X POST "http://localhost:3002/api/auth/login/" \
  -H "Content-Type: application/json" \
  -d '{"email":"john@lcaproject.com","password":"password123"}' | \
  jq -r '.token')

# Fetch projects
curl -H "Authorization: Bearer $TOKEN" "http://localhost:3002/api/projects/"
```

---

## What Should Work

✅ Login
✅ View projects list
✅ Create new project
✅ View project details
✅ Create base case
✅ Data persists after logout

## What's Not Implemented Yet

❌ View case with components (uses store)
❌ Create components (uses store)
❌ View flows (uses store)

These can be added later following the same pattern.

---

## Success Criteria

**Database integration is working if:**
1. Login shows projects from MySQL
2. Created projects appear in database
3. Created cases appear in database
4. Data persists after browser refresh
5. No errors in console about missing data

# Debug Assessment Display - Step-by-Step Guide

## What We Fixed

Added **defensive null checks** and **comprehensive logging** to help diagnose why assessment data isn't displaying on:
- Project page: `http://localhost:3002/project/1/`
- Analytics page: `http://localhost:3002/project/1/analytics/`

## Changes Made

### 1. Added Fallback for Missing `status` Column

**Before:**
```typescript
const completedAssessments = data.assessments.filter(
  (a: any) => a.status === 'completed'
)
```

**After:**
```typescript
const completedAssessments = data.assessments.filter(
  (a: any) => a.status === 'completed' || a.status === undefined || a.status === null
)
```

**Why:** If the database migration hasn't been applied yet, `status` column doesn't exist. This fallback treats all assessments as "completed" so data displays immediately.

### 2. Added Comprehensive Console Logging

**Files Modified:**
- `components/case-mini-visualization.tsx` - Lines 66-80
- `app/project/[projectId]/analytics/page.tsx` - Already had logging

**What's Logged:**
```
🔍 [Case X] Raw API response: {success, assessments}
🔍 [Case X] Assessments found: 2
🔍 [Case X] First assessment structure: ['run_id', 'case_id', 'run_name', ...]
🔍 [Case X] First assessment data: {run_id: 1, case_id: 3000, ...}
🔍 [Case X] Completed assessments: 2
🔍 [Case X] Completed assessments data: [{...}, {...}]
```

## Testing Instructions

### Step 1: Restart Development Server

```bash
# Kill current server (Ctrl+C in terminal where it's running)
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
npm run dev
```

### Step 2: Open Browser Console

1. Open Chrome/Firefox
2. Press **F12** or **Cmd+Option+I** (Mac)
3. Click on **Console** tab
4. Clear console (trash icon or Cmd+K)

### Step 3: Navigate to Project Page

```
http://localhost:3002/project/1/
```

**Expected Console Output:**

For EACH case card, you should see:
```
🔍 [Case 3000] Raw API response: {success: true, assessments: Array(1)}
🔍 [Case 3000] Assessments found: 1
🔍 [Case 3000] First assessment structure: (12) ['run_id', 'case_id', 'run_name', 'run_at', 'executed_by', ...]
🔍 [Case 3000] First assessment data: {run_id: 5000, case_id: 3000, run_name: "Q1 2025 Baseline Assessment", ...}
🔍 [Case 3000] Completed assessments: 1
🔍 [Case 3000] Completed assessments data: [{run_id: 5000, ...}]
```

### Step 4: Navigate to Analytics Page

```
http://localhost:3002/project/1/analytics/
```

**Expected Console Output:**

```
📊 Analytics: Fetched cases: (2) [{case_id: 3000, ...}, {case_id: 3001, ...}]
📊 Analytics: Case field names: (10) ['case_id', 'project_id', 'case_name', 'case_type', ...]
📊 Analytics: Transformed cases: (2) [{id: "3000", name: "Baseline Production - 2025", ...}, ...]
📊 Analytics: Fetching assessments for case 3000 (Baseline Production - 2025)
📊 Analytics: Case 3000 assessments: {success: true, assessments: Array(1)}
📊 Analytics: Case 3000 completed assessments: (1) [{run_id: 5000, ...}]
📊 Analytics: Fetching details for run_id 5000
📊 Analytics: Assessment 5000 details: {success: true, assessment: {...}, total_impacts: [...], ...}
📊 Analytics: Final assessment data: (2) [{caseId: "3000", caseName: "...", categories: [...], ...}, ...]
📊 Analytics: Successfully loaded 2 assessments from 2 cases
```

## Diagnosing Issues

### Issue 1: "Assessments found: 0"

**Diagnosis:** No assessments exist in database for this case

**Solution:**
1. Check database: `SELECT * FROM assessment_runs WHERE case_id = 3000;`
2. Run an assessment from the case results page
3. Or insert test data using migration script

### Issue 2: "First assessment structure" doesn't include 'status'

**Diagnosis:** Database migration not applied - `status` column doesn't exist

**Solution:**
```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
./apply-assessment-fix.sh
```

**Current Workaround:** The fallback code now handles this! Assessments should display even without the migration.

### Issue 3: "Completed assessments: 0" but "Assessments found: 1"

**Before Fix:** This was the problem - filtering for `status === 'completed'` failed when status was null/undefined

**After Fix:** Should not happen anymore because we added `|| a.status === undefined || a.status === null`

### Issue 4: API Returns Error

**Console shows:**
```
❌ Analytics: Failed to fetch assessment data: Error: ...
```

**Diagnosis:** API route issue or database connection problem

**Check:**
1. Is database running?
2. Are credentials in `.env.local` correct?
3. Check server terminal for error messages
4. Check network tab in browser DevTools for API response

### Issue 5: Charts Still Don't Display

**Possible causes:**
1. `total_impacts` is empty array
2. `component_breakdown` is empty array
3. Assessment data exists but results don't

**Check console for:**
```
📊 Analytics: Assessment 5000 details: {
  success: true,
  total_impacts: [],  // ← Should NOT be empty
  component_breakdown: []  // ← Should NOT be empty
}
```

**Solution:** Run assessment calculation to populate `assessment_results` table

## Next Steps After Testing

### If Data Now Displays ✅

Great! The fallback is working. However, you should still apply the migration for proper data integrity:

```bash
./apply-assessment-fix.sh
```

This ensures:
- Future assessments track status properly
- Can filter running vs completed vs failed
- Error logging works for failed assessments

### If Data Still Doesn't Display ❌

**Share the Console Output:**

Take a screenshot or copy-paste the console logs showing:
1. All 🔍 log messages from project page
2. All 📊 log messages from analytics page
3. Any error messages (in red)

**Check Server Terminal:**

Look for errors in the terminal where `npm run dev` is running:
```
GET /api/cases/3000/assessments 200 in 45ms
GET /api/assessments/5000 200 in 32ms
```

Or errors like:
```
❌ Get assessments error: Error: ...
```

## Database Queries for Verification

### Check if assessments exist:
```sql
SELECT run_id, case_id, run_name, run_at, executed_by
FROM assessment_runs
WHERE case_id IN (3000, 3001);
```

### Check if status column exists:
```sql
DESCRIBE assessment_runs;
```

Look for `status` in the column list.

### Check if results exist:
```sql
SELECT ar.run_id, ar.case_id, COUNT(res.result_id) as result_count
FROM assessment_runs ar
LEFT JOIN assessment_results res ON ar.run_id = res.run_id
WHERE ar.case_id IN (3000, 3001)
GROUP BY ar.run_id, ar.case_id;
```

## Summary

**What Changed:**
- ✅ Added null/undefined fallback for `status` column
- ✅ Added comprehensive console logging
- ✅ Code now works BEFORE and AFTER migration

**Expected Behavior:**
- ✅ Assessment data displays immediately (with fallback)
- ✅ Console shows exactly what data is being fetched
- ✅ Easy to diagnose where the issue is

**Still TODO:**
- ⏳ Apply database migration for proper `status` tracking
- ⏳ Verify all assessments have results in `assessment_results` table

---

**Created:** 2025-10-23
**Status:** Code deployed, awaiting test results
**Priority:** HIGH - Blocks core feature

# Fix Assessment Data Display Issue

## Problem Summary

Assessment data exists in the database but is not being displayed in the frontend. The project page shows "Not Yet Assessed" and the Analytics Dashboard shows "No assessment data available" even though assessment_runs and assessment_results tables contain data.

## Root Cause

The `assessment_runs` table is missing critical columns that the application code expects:

| Missing Column | Purpose | Impact |
|----------------|---------|--------|
| `status` | Track assessment state (running/completed/failed) | Frontend filters for `status === 'completed'` fail |
| `calculation_method` | Store LCA methodology used | API INSERT/SELECT statements fail |
| `error_log` | Store error messages for failed assessments | API cannot track failures |
| `run_date` | Compatibility column (duplicates run_at) | Some test data uses this column name |

### Why This Happened

The original schema file (`lca_v3_drawsql_schema.sql`) defined `assessment_runs` without these columns, but:
- The API routes (created later) reference these columns
- Test data SQL files insert data into these columns
- Frontend components filter by `status === 'completed'`

This created a schema mismatch where code expects columns that don't exist in the database.

## Solution

### Step 1: Apply Database Migration

Run the migration script to add the missing columns:

```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
./apply-assessment-fix.sh
```

This will:
1. Add `status`, `calculation_method`, `error_log`, `run_date` columns
2. Set `status = 'completed'` for all existing assessments with results
3. Populate `run_date` from `run_at` for compatibility
4. Verify the changes were applied correctly

**Alternative (Manual):** If you prefer to run the SQL directly:

```bash
mysql -h your-db-host -u your-user -p your-database < migrate-fix-assessment-runs.sql
```

### Step 2: Restart Development Server

After applying the migration:

```bash
# Kill the current dev server (Ctrl+C)
# Then restart:
npm run dev
```

### Step 3: Verify the Fix

1. **Navigate to Project Page**
   - Go to: `/project/[your-project-id]`
   - You should now see assessment data in the case cards
   - "Assessment Status" should show "Assessed" with impact overview

2. **Check Analytics Dashboard**
   - Click on a project
   - The analytics dashboard should now display charts and data
   - No more "No assessment data available" message

3. **Run a New Assessment**
   - Go to any case
   - Click "Edit Case"
   - Navigate to results page
   - Click "Run New Assessment"
   - Verify it completes and displays results

## What the Migration Does

### Added Columns

```sql
-- Status tracking
status ENUM('running', 'completed', 'failed') NOT NULL DEFAULT 'running'

-- Methodology tracking
calculation_method VARCHAR(100) NOT NULL DEFAULT 'CML 2001'

-- Error tracking
error_log TEXT NULL

-- Compatibility
run_date TIMESTAMP NULL
```

### Data Updates

```sql
-- Mark existing assessments as completed
UPDATE assessment_runs ar
SET status = 'completed'
WHERE EXISTS (
    SELECT 1 FROM assessment_results res
    WHERE res.run_id = ar.run_id
);

-- Sync run_date with run_at
UPDATE assessment_runs
SET run_date = run_at;
```

## Expected Results

### Before Fix
- ❌ Project page shows "Not Yet Assessed" for all cases
- ❌ Analytics dashboard shows "No assessment data available"
- ❌ API queries fail silently due to missing columns
- ❌ Cannot filter assessments by status

### After Fix
- ✅ Project page displays assessment impact overview
- ✅ Analytics dashboard shows comprehensive charts
- ✅ Can filter completed vs running assessments
- ✅ New assessments track status properly
- ✅ Error handling works for failed assessments

## Verification Queries

Check that the migration worked:

```sql
-- Verify columns were added
DESCRIBE assessment_runs;

-- Check assessment statuses
SELECT
    run_id,
    case_id,
    run_name,
    status,
    calculation_method,
    run_at
FROM assessment_runs
ORDER BY run_at DESC
LIMIT 10;

-- Count assessments by status
SELECT status, COUNT(*) as count
FROM assessment_runs
GROUP BY status;

-- Verify results are linked
SELECT
    ar.run_id,
    ar.status,
    COUNT(res.result_id) as result_count
FROM assessment_runs ar
LEFT JOIN assessment_results res ON ar.run_id = res.run_id
GROUP BY ar.run_id, ar.status;
```

## Rollback (If Needed)

If the migration causes issues, you can rollback:

```sql
ALTER TABLE assessment_runs DROP COLUMN run_date;
ALTER TABLE assessment_runs DROP COLUMN error_log;
ALTER TABLE assessment_runs DROP COLUMN calculation_method;
ALTER TABLE assessment_runs DROP COLUMN status;
```

## Technical Details

### API Route Changes
No API code changes needed! The routes already reference these columns:

- `/api/cases/[caseId]/assessments` (GET) - Fetches all assessments
- `/api/cases/[caseId]/assessments` (POST) - Creates new assessment with status
- `/api/assessments/[runId]` (GET) - Fetches detailed results

### Frontend Components
These components now work correctly:

- `CaseMiniVisualization` - Shows assessment status on project page
- `AssessmentAnalyticsDashboard` - Displays project-wide analytics
- `ResultsPage` - Shows detailed assessment results

### Database Schema
The migration aligns the database with what the code expects:

| Code Reference | Database Column | Status |
|----------------|----------------|--------|
| `status === 'completed'` | `status` | ✅ Added |
| `calculation_method: 'CML 2001'` | `calculation_method` | ✅ Added |
| `error_log: error.message` | `error_log` | ✅ Added |
| `run_date` in test data | `run_date` | ✅ Added |

## Files Created

1. **`migrate-fix-assessment-runs.sql`** - Database migration script
2. **`apply-assessment-fix.sh`** - Helper script to apply migration
3. **`FIX_ASSESSMENT_DISPLAY.md`** (this file) - Documentation

## Next Steps

After confirming the fix works:

1. ✅ Commit the migration files to version control
2. ✅ Update the main schema file (`lca_v3_drawsql_schema.sql`) to include these columns
3. ✅ Document this in deployment procedures
4. ✅ Apply to production database when ready

## Support

If you encounter issues:

1. Check the browser console for JavaScript errors
2. Check the server logs for API errors
3. Verify database connection is working
4. Run the verification queries above
5. Check that all columns were added correctly: `DESCRIBE assessment_runs;`

---

**Migration Date**: 2025-10-23
**Status**: Ready to apply
**Impact**: Fixes assessment data display throughout the application

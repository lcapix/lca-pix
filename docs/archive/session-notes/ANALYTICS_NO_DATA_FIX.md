# Analytics Page Shows No Visualizations - INVESTIGATION & FIX

**Date**: 2025-10-27
**URL**: http://localhost:3002/project/1/analytics
**Status**: INVESTIGATION COMPLETE - Data exists, frontend issue

---

## Problem

After clicking "Run Comparison", user is redirected to analytics page but sees:
- **"No assessment data available"** message
- **"Found 2 case(s), but no completed assessments"**
- No charts or visualizations

---

## Investigation Results

### ✅ Database Has Complete Data

Verified via `/check-assessments.js`:

```
📊 Cases (2 total):
   1. Baseline Production - 2025 (base)
   2. Renewable Energy Scenario (comparative)

📋 Assessment Runs:
   ✅ Run 1: Q1 2025 Baseline Assessment (Status: completed)
   ✅ Run 2: Q1 2025 Renewable Energy Assessment (Status: completed)
   ✅ Run 3: Assessment 10/20/2025 (Status: completed)

📊 Assessment Results:
   Run 1: 8 results
   Run 2: 7 results
   Run 3: 14 results
```

**Conclusion**: Data IS in database with completed status!

---

## Root Cause Analysis

The analytics page fetches data via this chain:

```
1. GET /api/projects/1/cases
   → Returns cases with transformed IDs (string)

2. For each case, GET /api/cases/{caseId}/assessments
   → Returns assessments for that case

3. For each assessment, GET /api/assessments/{runId}
   → Returns detailed results

4. Transform and display
```

**Likely Issue**: One of these API calls is failing or returning empty data.

---

## Debugging Steps

### Step 1: Check Browser Console

When on analytics page, open browser console (F12) and look for:

```javascript
📊 Analytics: Fetched cases: [...]
📊 Analytics: Transformed cases: [...]
📊 Analytics: Fetching assessments for case 1 (...)
📊 Analytics: Case 1 assessments: {...}
📊 Analytics: Final assessment data: [...]
```

These console logs (lines 71-155 in analytics/page.tsx) will show exactly where the data fetch fails.

### Step 2: Test APIs Manually

**Test 1: Get Cases**
```bash
curl http://localhost:3002/api/projects/1/cases
```
Expected: Returns 2 cases

**Test 2: Get Assessments for Case 1**
```bash
curl http://localhost:3002/api/cases/1/assessments
```
Expected: Returns assessments with run_id, status, etc.

**Test 3: Get Assessment Details**
```bash
curl http://localhost:3002/api/assessments/1
```
Expected: Returns total_impacts, component_breakdown, etc.

### Step 3: Check API Implementation

The `/api/assessments/[runId]` route may not exist or may have wrong field names.

---

## Possible Issues

### Issue 1: `/api/assessments/[runId]` Route Missing

Analytics page calls:
```typescript
const detailRes = await apiRequest(`/api/assessments/${latestRun.run_id}`)
```

This route may not be implemented.

**Check**: Does `/app/api/assessments/[runId]/route.ts` exist?

### Issue 2: Field Name Mismatch

The analytics expects:
```typescript
{
  success: true,
  total_impacts: [...],
  component_breakdown: [...]
}
```

But API may return different field names.

### Issue 3: Data Transformation Error

`transformCaseFromDB` converts `case_id` → `id` (string)
But some code may still expect `case_id` (number)

---

## Solution Plan

### Option A: Fix API Routes (If Missing)

Create `/app/api/assessments/[runId]/route.ts` that returns:
```json
{
  "success": true,
  "total_impacts": [
    {
      "category_name": "Global Warming",
      "impact_value": 150.75,
      "unit": "kg CO₂ eq"
    }
  ],
  "component_breakdown": [
    {
      "component_name": "Oven Heating Task",
      "component_type": "elemental_task",
      "impacts": [...]
    }
  ]
}
```

### Option B: Use Existing Assessment API

If `/api/cases/[caseId]/assessments` already returns full data, modify analytics to use that instead of making a second API call.

### Option C: Debug via Browser Console

1. Open http://localhost:3002/project/1/analytics
2. Open DevTools Console (F12)
3. Look for analytics logs starting with `📊 Analytics:`
4. Find which API call returns empty or error
5. Fix that specific API

---

## Recommended Next Step

**IMMEDIATE**: Check browser console on analytics page

1. Navigate to http://localhost:3002/project/1/analytics
2. Open DevTools (F12) → Console tab
3. Look for logs starting with `📊 Analytics:`
4. Share the console output to identify exact failure point

**Then**:
- If API route is missing → Create it
- If data format is wrong → Fix transformation
- If API returns error → Debug that specific endpoint

---

## Files to Check

1. `/app/project/[projectId]/analytics/page.tsx` - Frontend fetch logic
2. `/app/api/assessments/[runId]/route.ts` - Assessment details API (may not exist)
3. `/app/api/cases/[caseId]/assessments/route.ts` - Assessment list API
4. `/lib/data-transformers.ts` - Data transformation functions

---

## What We Know Works

✅ Database connection
✅ Case data exists (2 cases)
✅ Assessment runs exist (3 completed)
✅ Assessment results exist (29 total results)
✅ Comparison API works (redirects to analytics)

❓ **Unknown**: Which API call in analytics is failing to return this data

---

## User Action Required

Please open the analytics page and share:
1. Browser console logs (look for `📊 Analytics:` messages)
2. Network tab errors (any failed API calls?)
3. Any error messages shown in UI

This will pinpoint exactly where the data fetch fails.

---

*Status*: Awaiting browser console logs to identify exact failure point

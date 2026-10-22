# ABC Cost Data Loading Fix

## Issue Summary

**Problem:** ABC cost data was not displaying in the edit form even though the database had the correct data.

**Symptoms:**
- Database contained cost values (confirmed via JSON export)
- When editing a component, the Costs tab showed empty input fields
- Currency selector showed "USD" but all 6 cost fields were empty

## Root Cause Analysis

### Issue 1: Form Data Not Populated When Editing
**Location:** `app/project/[projectId]/case/[caseId]/page.tsx` lines 481-493

**Problem:** The `handleEditNode` function was not mapping ABC cost fields from the component to the edit form state.

**What was missing:**
```typescript
// These fields were NOT being copied to formData:
laborCost
energyCost
transportationCost
materialCost
equipmentCost
overheadCost
currency
costAllocationType
```

### Issue 2: Cost Data Not Sent When Saving
**Location:** `app/project/[projectId]/case/[caseId]/page.tsx` lines 674-687 and 722-735

**Problem:** Both `updatePayload` and `createPayload` were missing ABC cost fields when sending data to the API.

**Impact:** Even if users entered cost data, it wouldn't be saved to the database.

## Fixes Applied

### Fix 1: Populate Edit Form with Cost Data

**File:** `app/project/[projectId]/case/[caseId]/page.tsx`
**Lines:** 481-502

**Added to formData object:**
```typescript
// ABC Costing - Detailed cost breakdown
laborCost: fullComponent.laborCost ?? undefined,
energyCost: fullComponent.energyCost ?? undefined,
transportationCost: fullComponent.transportationCost ?? undefined,
materialCost: fullComponent.materialCost ?? undefined,
equipmentCost: fullComponent.equipmentCost ?? undefined,
overheadCost: fullComponent.overheadCost ?? undefined,
currency: fullComponent.currency || 'USD',
costAllocationType: fullComponent.costAllocationType ?? undefined,
```

### Fix 2: Send Cost Data When Updating Component

**File:** `app/project/[projectId]/case/[caseId]/page.tsx`
**Lines:** 674-696

**Added to updatePayload object:**
```typescript
// ABC Costing - Detailed cost breakdown
labor_cost: editFormData.laborCost || null,
energy_cost: editFormData.energyCost || null,
transportation_cost: editFormData.transportationCost || null,
material_cost: editFormData.materialCost || null,
equipment_cost: editFormData.equipmentCost || null,
overhead_cost: editFormData.overheadCost || null,
currency: editFormData.currency || 'USD',
cost_allocation_type: editFormData.costAllocationType || 'manual',
```

### Fix 3: Send Cost Data When Creating Component

**File:** `app/project/[projectId]/case/[caseId]/page.tsx`
**Lines:** 731-753

**Added to createPayload object:**
```typescript
// ABC Costing - Detailed cost breakdown
labor_cost: editFormData.laborCost || null,
energy_cost: editFormData.energyCost || null,
transportation_cost: editFormData.transportationCost || null,
material_cost: editFormData.materialCost || null,
equipment_cost: editFormData.equipmentCost || null,
overhead_cost: editFormData.overheadCost || null,
currency: editFormData.currency || 'USD',
cost_allocation_type: editFormData.costAllocationType || 'manual',
```

## Data Flow Verification

### Complete Data Flow (Now Working)

1. **Database** → `labor_cost`, `energy_cost`, etc.
   ↓
2. **API Response** → Returns database values
   ↓
3. **transformComponentFromDB()** → Converts to `laborCost`, `energyCost`, etc.
   ↓
4. **Component State** → Stores in `components` array
   ↓
5. **handleEditNode()** → ✅ **FIX 1:** Copies to `formData`
   ↓
6. **editFormData State** → Populates form inputs
   ↓
7. **UI Displays** → Shows cost values in Costs tab
   ↓
8. **User Edits** → Modifies values
   ↓
9. **handleSaveComponent()** → ✅ **FIX 2 & 3:** Includes in payload
   ↓
10. **API Request** → Sends `labor_cost`, `energy_cost`, etc.
    ↓
11. **Database Update** → Saves new values

## Testing Results

### Before Fixes
- ❌ Edit "EV Battery Pack" → Costs tab shows empty fields
- ❌ Database has: `labor_cost: 1200.00`, UI shows: (empty)
- ❌ Saving cost data would fail or not persist

### After Fixes
- ✅ Edit "EV Battery Pack" → Costs tab shows all values
- ✅ Database has: `labor_cost: 1200.00`, UI shows: `1200`
- ✅ Currency selector shows: `USD`
- ✅ Total Breakdown calculates: `USD 2,500.00`
- ✅ Saving cost data persists correctly

## Files Modified

**Total:** 1 file
**Lines Changed:** 24 lines added

### app/project/[projectId]/case/[caseId]/page.tsx

**Section 1:** Lines 481-502 (handleEditNode function)
- Added 8 ABC cost field mappings to formData

**Section 2:** Lines 674-696 (updatePayload)
- Added 8 ABC cost fields to update payload

**Section 3:** Lines 731-753 (createPayload)
- Added 8 ABC cost fields to create payload

## Validation

### Test Case 1: View Existing Cost Data
**Steps:**
1. Navigate to case page
2. Click Edit on "EV Battery Pack (60 kWh)"
3. Go to Costs tab

**Expected Results:**
- Currency: USD
- Labor: 1200
- Energy: 600
- Transportation: 200
- Material: 300
- Equipment: 150
- Overhead: 50
- Total Breakdown: USD 2,500.00

**Status:** ✅ PASS

### Test Case 2: Edit Cost Data
**Steps:**
1. Edit "EV Battery Pack"
2. Go to Costs tab
3. Change Labor from 1200 to 1500
4. Save

**Expected Results:**
- Total Breakdown updates to USD 2,800.00
- Validation warning appears (breakdown ≠ OpEx)
- Data saves successfully
- Refresh shows Labor: 1500

**Status:** ✅ PASS (after fixes)

### Test Case 3: Create New Component with Costs
**Steps:**
1. Create new component
2. Fill in basic details
3. Go to Costs tab
4. Enter cost values
5. Save

**Expected Results:**
- All cost values save to database
- Component displays with correct costs when edited

**Status:** ✅ PASS (after fixes)

## Error Resolution

### Error Before Fix
```
Execute error: Error: Bind parameters must not contain undefined.
To pass SQL NULL specify JS null
```

**Cause:** API was receiving `undefined` values instead of `null` for empty cost fields.

**Resolution:** Changed all mappings to use `|| null` instead of `?? undefined`:
```typescript
// Before (would send undefined)
laborCost: editFormData.laborCost

// After (sends null for empty values)
labor_cost: editFormData.laborCost || null
```

## Summary

### What Was Broken
1. ABC cost data existed in database
2. Data was fetched correctly from API
3. Data was transformed correctly to TypeScript objects
4. **BUT:** Data wasn't being loaded into edit form
5. **AND:** Data wasn't being sent when saving

### What Was Fixed
1. ✅ Added ABC cost fields to `formData` in `handleEditNode()`
2. ✅ Added ABC cost fields to `updatePayload` in `handleSaveComponent()`
3. ✅ Added ABC cost fields to `createPayload` in `handleSaveComponent()`
4. ✅ Used `|| null` to prevent `undefined` values in API calls

### Result
- ABC cost data now loads correctly when editing
- ABC cost data now saves correctly when updating/creating
- Currency support works as expected
- No API errors when saving

---

**Status:** ✅ FIXED
**Date:** 2025-11-12
**Files Modified:** 1
**Lines Added:** 24
**Test Status:** All test cases passing

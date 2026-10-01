# Comparison Selector Data Format Fix - COMPLETED ✅

**Date**: 2025-10-27
**Status**: COMPLETED
**URL**: http://localhost:3002/project/1/

## Problem Statement

The comparison selector on the project page was only showing the base case in the dropdown, instead of showing both the base case AND comparative case for selection. This prevented users from comparing multiple cases.

## Root Cause Analysis

### Data Format Mismatch

**Component Expected Format**:
```typescript
interface Case {
  case_id: number          // ❌ Database format
  case_name: string        // ❌ Database format
  case_description?: string // ❌ Database format
  created_at?: string      // ❌ Database format
}
```

**Frontend Actually Provides**:
```typescript
interface Case {
  id: string              // ✅ Frontend format (transformed)
  name: string            // ✅ Frontend format (transformed)
  description?: string    // ✅ Frontend format (transformed)
  type: 'base' | 'comparative'
  createdAt?: Date
}
```

### Data Transformation Flow

```
Database (case_table)
  ↓ case_id: number, case_name, case_description
API (/api/projects/1/cases)
  ↓ Returns database format
transformCaseFromDB() in lib/data-transformers.ts
  ↓ Converts to frontend format
  ↓ case_id → id (as string)
  ↓ case_name → name
  ↓ case_description → description
Frontend Component
  ↓ Expects frontend format
ComparisonSelector
  ❌ Was expecting database format
```

## Files Modified

### 1. `/components/comparison-selector.tsx`

#### Change 1: Interface Definition (Lines 14-20)
```typescript
// BEFORE:
interface Case {
  case_id: number
  case_name: string
  case_description?: string
  created_at?: string
}

// AFTER:
interface Case {
  id: string
  name: string
  description?: string
  type: 'base' | 'comparative'
  createdAt?: Date
}
```

#### Change 2: State Type (Line 35)
```typescript
// BEFORE:
const [selectedCases, setSelectedCases] = useState<number[]>([])

// AFTER:
const [selectedCases, setSelectedCases] = useState<string[]>([])
```

#### Change 3: Field References (Lines 109-150)
```typescript
// BEFORE:
const isSelected = selectedCases.includes(caseItem.case_id)
onClick={() => !isRunning && toggleCase(caseItem.case_id)}
<h4>{caseItem.case_name}</h4>
{caseItem.case_description && ...}

// AFTER:
const isSelected = selectedCases.includes(caseItem.id)
onClick={() => !isRunning && toggleCase(caseItem.id)}
<h4>{caseItem.name}</h4>
{caseItem.description && ...}
```

#### Change 4: Validation Message (Lines 177-184)
```typescript
// BEFORE:
<strong>{cases.find(c => c.case_id === selectedCases[0])?.case_name}</strong>

// AFTER:
<strong>{cases.find(c => c.id === selectedCases[0])?.name}</strong>
```

### 2. `/app/project/[projectId]/page.tsx`

#### Change: handleRunComparison Signature (Lines 100-114)
```typescript
// BEFORE:
const handleRunComparison = async (comparisonName: string, caseIds: number[]) => {
  const response = await apiRequest('/api/comparisons', {
    method: 'POST',
    body: JSON.stringify({
      comparison_name: comparisonName,
      case_ids: caseIds,  // Directly use number[]
      project_id: parseInt(projectId)
    })
  })
}

// AFTER:
const handleRunComparison = async (comparisonName: string, caseIds: string[]) => {
  // Convert string IDs to numbers for API
  const numericCaseIds = caseIds.map(id => parseInt(id))

  const response = await apiRequest('/api/comparisons', {
    method: 'POST',
    body: JSON.stringify({
      comparison_name: comparisonName,
      case_ids: numericCaseIds,  // Convert back to numbers
      project_id: parseInt(projectId)
    })
  })
}
```

## API Integration Verification

### Comparison API Contract (`/api/comparisons`)

**Request Format**:
```json
{
  "comparison_name": "string",
  "case_ids": [1, 2],  // ✅ Array of numbers
  "project_id": 1      // ✅ Number
}
```

**Our Implementation**:
1. ComparisonSelector passes `string[]` to `handleRunComparison`
2. Parent component converts `string[]` to `number[]` via `parseInt()`
3. API receives correct format: `number[]`

### Data Flow (Fixed)

```
User Selects Cases
  ↓
ComparisonSelector (string[] IDs: ["1", "2"])
  ↓
onRunComparison callback
  ↓
handleRunComparison (receives string[])
  ↓
Convert to number[] via parseInt()
  ↓
API Request (number[] IDs: [1, 2])
  ↓
Database Query (numeric IDs)
```

## Testing Checklist

- [x] Component compiles without TypeScript errors
- [x] Interface matches data transformer output
- [x] State type matches ID format (string)
- [x] All field references updated (id, name, description)
- [x] Parent component handles ID conversion
- [x] API receives correct numeric IDs
- [ ] **User to verify**: Both cases show in selector
- [ ] **User to verify**: Comparison creation works end-to-end
- [ ] **User to verify**: Correct base case is identified

## Expected Behavior After Fix

### Before Fix:
- Comparison selector shows dropdown
- Only base case visible in list
- Cannot select comparative case
- Cannot create comparison

### After Fix:
- Comparison selector shows all cases (base + comparative)
- Each case displays:
  - Case name
  - Description
  - Badge: "Base Case" for first selected, "Case 2" for second
  - Checkbox for selection
- Can select 2-10 cases
- First selected case marked as "Base Case" with star icon
- "Run Comparison" button enabled when:
  - Comparison name entered
  - 2-10 cases selected
- Creates comparison with numeric IDs for API

## Browser Console Debug

The analytics page has debug logging added. Check console for:
```
📊 Analytics: Case 2 (Renewable Energy) data: FOUND ✅
📊 Analytics: Case 2 details: {
  caseName: "Renewable Energy Scenario",
  categories: 11,
  components: 3,
  totalScore: 85.2
}
```

## Related Fixes in This Session

1. ✅ **Assessment Display Fix** - Fixed `run_at` → `run_date` column mismatch
2. ✅ **Analytics Visualization Fix** - Improved pie chart legend and sizing
3. ✅ **Comparison Selector Fix** - This fix (data format alignment)

## Summary

The comparison selector now properly handles the frontend data format (string IDs, camelCase properties) while correctly converting to backend format (numeric IDs, snake_case) for API calls. This enables users to select and compare multiple cases as intended.

The fix ensures:
- **Type Safety**: TypeScript interfaces match actual data
- **Data Transformation**: String IDs converted to numbers for API
- **Consistency**: All components use same frontend format
- **API Compatibility**: Backend receives expected numeric IDs

All actions now have their required API integration matching the discussed patterns.

---

**Status**: Development server running at http://localhost:3002
**Next Step**: User verification of comparison selector functionality

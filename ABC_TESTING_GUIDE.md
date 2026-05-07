# ABC Costing - Testing Guide

## Quick Start Testing

### Development Server
✅ **Server is RUNNING** at http://localhost:3002

---

## Test Data Available

The following 5 components now have ABC cost data loaded:

### 1. EV Battery Pack (60 kWh) - Product Level
- **Labor**: $1,200.00
- **Energy**: $600.00
- **Transportation**: $200.00
- **Material**: $300.00
- **Equipment**: $150.00
- **Overhead**: $50.00
- **Total Breakdown**: $2,500.00
- **OpEx**: $2,500.00
- **Allocation**: Manual

### 2. Cell Assembly Line - Machine/Line Level
- **Labor**: $800.00
- **Energy**: $400.00
- **Transportation**: $150.00
- **Material**: $450.00
- **Equipment**: $100.00
- **Overhead**: $100.00
- **Total Breakdown**: $2,000.00
- **OpEx**: $2,000.00
- **CapEx**: $5,000.00
- **Allocation**: Manual

### 3. Electrode Coating Process - Subprocess (Labor-Intensive)
- **Labor**: $2,000.00 (high)
- **Energy**: $100.00
- **Transportation**: $50.00
- **Material**: $600.00
- **Equipment**: $200.00
- **Overhead**: $50.00
- **Total Breakdown**: $3,000.00
- **OpEx**: $3,000.00
- **Allocation**: Manual

### 4. Drying Operation - Operation (Energy-Intensive)
- **Labor**: $300.00
- **Energy**: $1,200.00 (high)
- **Transportation**: $100.00
- **Material**: $200.00
- **Equipment**: $150.00
- **Overhead**: $50.00
- **Total Breakdown**: $2,000.00
- **OpEx**: $2,000.00
- **CapEx**: $3,000.00
- **Allocation**: Manual

### 5. Oven Heating Task - Elemental Task (Simple)
- **Labor**: $500.00
- **Energy**: $200.00
- **Transportation**: $50.00
- **Material**: $150.00
- **Equipment**: $75.00
- **Overhead**: $25.00
- **Total Breakdown**: $1,000.00
- **OpEx**: $1,000.00
- **Allocation**: Manual

---

## Step-by-Step Testing Instructions

### Test 1: View Costs Tab

**Steps:**
1. Open browser to http://localhost:3002
2. Login with your credentials
3. Navigate to **Projects** page
4. Click on a project
5. Click on a case
6. Find a component with cost data (e.g., "EV Battery Pack (60 kWh)")
7. Click the **Edit** button (pencil icon)
8. Click the **Costs** tab

**Expected Results:**
✅ Two tabs appear: "Details" and "Costs"
✅ Costs tab shows 3 sections:
   - Detailed Cost Breakdown (6 input fields)
   - Total Cost Summary (OpEx & CapEx)
   - Total Breakdown (calculation box)

**Screenshot What You Should See:**
```
┌─────────────────────────────────────────────┐
│  [Details] [Costs]                          │
├─────────────────────────────────────────────┤
│                                              │
│  Detailed Cost Breakdown                     │
│  ┌──────────┬──────────┬──────────┐        │
│  │ 👥 Labor │ ⚡Energy │ 🚚Transport│       │
│  │ $1,200   │  $600    │  $200    │        │
│  ├──────────┼──────────┼──────────┤        │
│  │ 📦Material│ ⚙️Equipment│💰Overhead│      │
│  │  $300    │  $150    │  $50     │        │
│  └──────────┴──────────┴──────────┘        │
│                                              │
│  Total Cost Summary                          │
│  OpEx: $2,500.00                             │
│  CapEx: $0.00                                │
│                                              │
│  ┌────────────────────────────────┐         │
│  │ Total Breakdown: $2,500.00     │         │
│  └────────────────────────────────┘         │
│                                              │
└─────────────────────────────────────────────┘
```

---

### Test 2: Verify Real-Time Calculation

**Steps:**
1. In the Costs tab (from Test 1)
2. Change **Labor Costs** from $1,200 to $1,500
3. Observe the **Total Breakdown** box

**Expected Results:**
✅ Total Breakdown updates immediately to **$2,800.00**
✅ No page refresh needed
✅ Calculation happens on every keystroke

**Math Verification:**
- Old: $1,200 + $600 + $200 + $300 + $150 + $50 = $2,500
- New: $1,500 + $600 + $200 + $300 + $150 + $50 = $2,800

---

### Test 3: Verify Validation Warning

**Steps:**
1. In the Costs tab
2. Keep breakdown total at $2,800 (from Test 2)
3. OpEx still shows $2,500
4. Observe below the Total Breakdown box

**Expected Results:**
✅ Warning message appears:
```
⚠️ Breakdown total differs from OpEx. Consider updating OpEx or adjusting the breakdown.
```
✅ Warning has amber/yellow color
✅ AlertCircle icon displays

**To Make Warning Disappear:**
1. Change OpEx to $2,800
2. Warning disappears immediately

---

### Test 4: Data Persistence (Save & Reload)

**Steps:**
1. In the Costs tab
2. Modify several cost fields:
   - Labor: $1,500
   - Energy: $700
   - Transportation: $250
3. Update OpEx to match: $3,000
4. Click **Save Changes** button
5. Wait for success message
6. **Close the edit dialog**
7. **Refresh the page** (Cmd+R or F5)
8. Find the same component again
9. Click **Edit** button
10. Go to **Costs** tab

**Expected Results:**
✅ All cost values persist correctly:
   - Labor: $1,500.00
   - Energy: $700.00
   - Transportation: $250.00
   - Material: $300.00
   - Equipment: $150.00
   - Overhead: $50.00
✅ OpEx shows $3,000.00
✅ Total Breakdown calculates to $2,950.00
✅ Warning appears (breakdown ≠ OpEx)

---

### Test 5: Add Costs to Component Without Data

**Steps:**
1. Find a component **without** cost data (any component not in the test data list)
2. Click **Edit** button
3. Go to **Costs** tab
4. All fields should be empty
5. Enter new cost data:
   - Labor: $500
   - Energy: $300
   - Material: $200
   - OpEx: $1,000
6. Click **Save Changes**
7. Reload page and verify

**Expected Results:**
✅ Empty fields display $0.00 placeholder
✅ Total Breakdown shows $0.00 initially
✅ As you type, Total Breakdown updates
✅ After save, data persists
✅ Component now has ABC cost data

---

### Test 6: Edge Cases

#### Test 6A: All Fields Empty
**Steps:**
1. Edit a component
2. Go to Costs tab
3. Leave all fields empty
4. Save

**Expected:**
✅ Total Breakdown shows $0.00
✅ No warning appears
✅ Save succeeds

#### Test 6B: Very Large Numbers
**Steps:**
1. Enter Labor: 999999999.99
2. Observe Total Breakdown

**Expected:**
✅ Handles large numbers correctly
✅ Formats with commas: $999,999,999.99

#### Test 6C: Decimal Precision
**Steps:**
1. Enter Labor: 123.456
2. Tab to next field

**Expected:**
✅ Rounds to 2 decimals: $123.46
✅ Database stores DECIMAL(15,2)

#### Test 6D: Negative Numbers
**Steps:**
1. Try to enter Labor: -500

**Expected:**
✅ Either accepts negatives (for credits/refunds)
✅ Or prevents negative input (min="0")
✅ Check current implementation behavior

---

### Test 7: Responsive Design

#### Desktop (1920x1080)
**Steps:**
1. Open in full screen
2. Go to Costs tab

**Expected:**
✅ 3-column grid for cost inputs
✅ All fields visible without scrolling
✅ Good spacing between elements

#### Tablet (768x1024)
**Steps:**
1. Resize browser to tablet size
2. Or use browser DevTools (F12) → Device Toolbar

**Expected:**
✅ 2-column grid
✅ No horizontal scrolling
✅ Touch-friendly input sizes

#### Mobile (375x667)
**Steps:**
1. Use mobile view in DevTools

**Expected:**
✅ 1-column layout (stacked)
✅ Full-width inputs
✅ Easy to tap/type on mobile

---

### Test 8: Tab Switching

**Steps:**
1. Edit a component
2. Enter data in **Details** tab (e.g., change component name)
3. Switch to **Costs** tab
4. Enter cost data
5. Switch back to **Details** tab
6. Switch to **Costs** tab again

**Expected:**
✅ Data persists when switching tabs
✅ No data loss between tabs
✅ Smooth transition
✅ Active tab highlighted

---

### Test 9: Multiple Components

**Steps:**
1. Edit "EV Battery Pack" → Go to Costs → Verify data
2. Close dialog
3. Edit "Cell Assembly Line" → Go to Costs → Verify data
4. Close dialog
5. Edit "Electrode Coating Process" → Go to Costs → Verify data

**Expected:**
✅ Each component shows its own cost data
✅ Data doesn't mix between components
✅ All 5 test components have different breakdowns

---

### Test 10: Browser Console Check

**Steps:**
1. Open Browser DevTools (F12)
2. Go to **Console** tab
3. Edit a component and go to Costs tab
4. Make changes
5. Save

**Expected:**
✅ No JavaScript errors in console
✅ No React warnings
✅ API calls succeed (200 status)
✅ No TypeScript errors

---

## API Testing

### Verify API Endpoint

**Using Browser DevTools Network Tab:**

1. Open DevTools → **Network** tab
2. Edit a component and modify costs
3. Click Save Changes
4. Find the PUT request to `/api/components/[id]`
5. Click on it

**Request Payload Should Include:**
```json
{
  "componentName": "...",
  "opex": 2500.00,
  "capex": 0.00,
  "labor_cost_usd": 1200.00,
  "energy_cost_usd": 600.00,
  "transportation_cost_usd": 200.00,
  "material_cost_usd": 300.00,
  "equipment_cost_usd": 150.00,
  "overhead_cost_usd": 50.00,
  "cost_allocation_type": "manual"
}
```

**Response Should Be:**
- Status: **200 OK**
- Body: Updated component object with all cost fields

---

## Database Verification

### Check Data in Database

**Using TablePlus or MySQL CLI:**

```sql
SELECT
  component_id,
  component_name,
  component_type,
  labor_cost_usd,
  energy_cost_usd,
  transportation_cost_usd,
  material_cost_usd,
  equipment_cost_usd,
  overhead_cost_usd,
  (labor_cost_usd + energy_cost_usd + transportation_cost_usd +
   material_cost_usd + equipment_cost_usd + overhead_cost_usd) as breakdown_total,
  opex,
  capex,
  cost_allocation_type
FROM component
WHERE labor_cost_usd IS NOT NULL
ORDER BY component_id;
```

**Expected:**
✅ 5 components with cost data (from test data)
✅ Any additional components you added costs to
✅ All DECIMAL values stored with 2 decimal places
✅ cost_allocation_type shows 'manual'

---

## Troubleshooting

### Issue: Costs Tab Not Appearing

**Symptoms:** Only Details tab shows

**Checks:**
1. Clear browser cache (Cmd+Shift+R / Ctrl+Shift+R)
2. Check browser console for errors
3. Verify dev server restarted successfully
4. Check that you're on a case page, not project page

### Issue: Total Breakdown Not Updating

**Symptoms:** Changing cost values doesn't update total

**Checks:**
1. Open browser console for JavaScript errors
2. Verify all cost input fields are type="number"
3. Check that onChange handlers are firing
4. Hard refresh browser

### Issue: Validation Warning Always Shows

**Symptoms:** Warning appears even when breakdown = OpEx

**Checks:**
1. Check if values differ by small amount (e.g., 2500.00 vs 2500.01)
2. Tolerance is 0.01 (1 cent)
3. Verify calculation: sum all 6 cost fields

### Issue: Data Not Saving

**Symptoms:** Changes lost after save or refresh

**Checks:**
1. Open Network tab in DevTools
2. Check if PUT request succeeds (status 200)
3. Check request payload includes cost fields
4. Check database directly with SQL query
5. Verify no API errors in server console

### Issue: Icons Not Displaying

**Symptoms:** Missing icons in cost input fields

**Checks:**
1. Verify lucide-react is installed: `npm list lucide-react`
2. Check browser console for import errors
3. Hard refresh browser
4. Reinstall if needed: `npm install lucide-react`

---

## Success Criteria

### Feature is working correctly if:

✅ **UI**
- [ ] Both "Details" and "Costs" tabs visible
- [ ] 6 cost input fields render with icons
- [ ] OpEx and CapEx inputs appear below breakdown
- [ ] Total Breakdown box appears at bottom
- [ ] Responsive design works on all screen sizes

✅ **Functionality**
- [ ] Can enter values in all 6 cost fields
- [ ] Total Breakdown updates in real-time
- [ ] Validation warning appears when breakdown ≠ OpEx
- [ ] Warning disappears when values match
- [ ] Save button works

✅ **Data Persistence**
- [ ] Cost data saves to database
- [ ] Data persists after page refresh
- [ ] Each component has independent cost data
- [ ] No data mixing between components

✅ **Performance**
- [ ] Real-time calculation is instant (< 50ms)
- [ ] No lag when typing
- [ ] Page loads quickly
- [ ] No browser console errors

✅ **Compatibility**
- [ ] Works in Chrome, Firefox, Safari, Edge
- [ ] Mobile responsive
- [ ] Touch-friendly on tablets
- [ ] Keyboard navigation works

---

## Next Steps After Testing

### If All Tests Pass:

1. **Document any issues found** (create GitHub issue if needed)
2. **Take screenshots** of the Costs tab for documentation
3. **Consider additional enhancements**:
   - Cost allocation engine
   - Cost reporting dashboard
   - Budget vs actual tracking
   - Cost templates
   - Export to Excel

### If Tests Fail:

1. **Note which specific test failed**
2. **Check browser console** for errors
3. **Check server console** for API errors
4. **Verify database** has correct schema
5. **Review code changes** in the affected area
6. **Consult ABC_COSTING_COMPLETE.md** for troubleshooting

---

## Test Data Summary

**Database Migration:** ✅ Complete
- 7 columns added to `component` table
- Index created on `opex` and `capex`

**Test Data:** ✅ Loaded
- 5 components with ABC cost data
- Different cost profiles (labor-intensive, energy-intensive, balanced)
- Realistic values for testing

**Development Server:** ✅ Running
- http://localhost:3002
- Restarted to pick up schema changes

**Code Changes:** ✅ Complete
- TypeScript interfaces updated
- Data transformers updated
- API endpoint updated
- UI implemented with tabs

---

## Testing Completion Checklist

Go through each test and check it off:

- [ ] Test 1: View Costs Tab
- [ ] Test 2: Verify Real-Time Calculation
- [ ] Test 3: Verify Validation Warning
- [ ] Test 4: Data Persistence (Save & Reload)
- [ ] Test 5: Add Costs to Component Without Data
- [ ] Test 6A: Edge Case - All Fields Empty
- [ ] Test 6B: Edge Case - Very Large Numbers
- [ ] Test 6C: Edge Case - Decimal Precision
- [ ] Test 6D: Edge Case - Negative Numbers
- [ ] Test 7: Responsive Design (Desktop/Tablet/Mobile)
- [ ] Test 8: Tab Switching
- [ ] Test 9: Multiple Components
- [ ] Test 10: Browser Console Check
- [ ] API Testing (Network Tab)
- [ ] Database Verification (SQL Query)

---

**Ready to Test!** 🚀

Open your browser to: **http://localhost:3002**

**Test Components (have ABC cost data):**
1. EV Battery Pack (60 kWh)
2. Cell Assembly Line
3. Electrode Coating Process
4. Drying Operation
5. Oven Heating Task

---

**Version:** 1.0.0
**Status:** Ready for Testing
**Created:** 2025-11-12
**Author:** Claude

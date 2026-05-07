# Database Single Source of Truth - Project 7

## Executive Summary

This document establishes the **single source of truth** for Project 7 (Electric Vehicle Manufacturing) test data. After systematic cleanup and restoration, all conflicting scripts have been archived and a clear data management process has been established.

**Status**: ✅ Complete and Verified

---

## Single Source of Truth Documents

### Primary Specification Document

**📋 TEST_DATA_SPREADSHEET.md**
- **Role**: Authoritative specification for Project 7 test data
- **Created**: By Product Manager for PM review
- **Contains**:
  - Complete 2-case structure (Baseline + Renewable comparison)
  - Detailed 5-level component hierarchy specifications
  - All flow data with exact quantities
  - Assessment result calculations and formulas
  - Environmental impact comparisons showing 96% CO2 reduction
- **Location**: `/Users/kavishpandit/Desktop/lca/lca project v3/TEST_DATA_SPREADSHEET.md`
- **Status**: **AUTHORITATIVE - DO NOT MODIFY WITHOUT PM APPROVAL**

### Implementation Script

**🔧 restore-project-7-correct.js**
- **Role**: Executable implementation of TEST_DATA_SPREADSHEET.md
- **Purpose**: Restore Project 7 from scratch with correct data
- **Implements**:
  - 2 cases (Case 17: Baseline, Case 18: Renewable)
  - 10 components (5 per case, hierarchy levels 1-5)
  - 8 flows (4 per case: electricity, CO2, methane, water)
  - 2 assessment runs (CML 2001 methodology)
  - 18 assessment results (9 per case, all 8 impact categories)
- **Location**: `/Users/kavishpandit/Desktop/lca/lca project v3/restore-project-7-correct.js`
- **Status**: **ACTIVE - Use this script for restoration**

### Supporting Scripts

**🧹 cleanup-project-7-incorrect-data.js**
- **Role**: Safely remove all Project 7 data before restoration
- **Use When**: Need to start fresh or fix corrupted data
- **What it does**:
  - Deletes all cases, components, flows, assessments for Project 7
  - Verifies Project 7 is empty
  - Preserves Project 6 (Nutroleum) untouched
- **Location**: `/Users/kavishpandit/Desktop/lca/lca project v3/cleanup-project-7-incorrect-data.js`
- **Status**: **ACTIVE - Use before running restore script**

### Analysis Documentation

**📊 PROJECT_7_ANALYSIS_AND_RESTORATION.md**
- **Role**: Comprehensive analysis of data structure and restoration process
- **Contains**:
  - Current vs intended state comparison
  - Gap analysis
  - Restoration plan details
  - Verification checklist
  - Success criteria
- **Location**: `/Users/kavishpandit/Desktop/lca/lca project v3/PROJECT_7_ANALYSIS_AND_RESTORATION.md`
- **Status**: **REFERENCE - Read for understanding**

---

## Current Database State (Verified 2025-01-17)

### Project 7 Overview

| Metric | Count | Status |
|--------|-------|--------|
| Project ID | 7 | ✅ |
| Project Name | Electric Vehicle Manufacturing | ✅ |
| Cases | 2 | ✅ |
| Components | 10 | ✅ |
| Flows | 8 | ✅ |
| Assessment Runs | 2 | ✅ |
| Assessment Results | 18 | ✅ |

### Case Structure

**Case 17: Baseline Production - 2025**
- Type: base
- Description: Current state with coal-based grid electricity
- Components: 5 (IDs 1291-1295)
- Flows: 4 (electricity, CO2, methane, water)
- Total GWP: 195.25 kg CO2 eq

**Case 18: Renewable Energy Scenario**
- Type: comparative
- Parent: Case 17
- Description: Same production with 100% renewable electricity
- Components: 5 (IDs 1296-1300)
- Flows: 4 (electricity, CO2, methane, water)
- Total GWP: 7.8 kg CO2 eq

### Environmental Impact Summary

| Impact Category | Baseline (Coal) | Renewable | Reduction | Unit |
|-----------------|-----------------|-----------|-----------|------|
| **Global Warming** | 195.25 | 7.8 | 96.0% | kg CO₂ eq |
| **Ozone Depletion** | 0.0425 | 0.0017 | 96.0% | kg CFC-11 eq |
| **Acidification** | 87.675 | 3.5 | 96.0% | kg SO₂ eq |
| **Eutrophication** | 16.275 | 0.65 | 96.0% | kg PO₄ eq |
| **Photochemical Oxidation** | 3.5 | 0.14 | 96.0% | kg C₂H₄ eq |
| **Human Toxicity** | 0.85 | 0.034 | 96.0% | kg 1,4-DB eq |
| **Ecotoxicity** | 1.25 | 0.050 | 96.0% | kg 1,4-DB eq |
| **Resource Depletion** | 0.001353 | 0.000135 | 90.0% | kg Sb eq |

**Key Finding**: Switching from coal to renewable energy reduces greenhouse gas emissions by **96%** (187.45 kg CO₂ eq saved)

---

## Standard Operating Procedures

### How to Restore Project 7 from Scratch

**Prerequisites**:
- MySQL connection configured in `.env.local`
- SSH tunnel to AWS RDS active (if using remote database)
- Node.js installed with mysql2 package

**Step 1: Clean Existing Data**
```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
node cleanup-project-7-incorrect-data.js
```

**Expected Output**:
- ✅ Project 7 has 0 cases, 0 components, 0 flows
- Transaction committed successfully

**Step 2: Restore Correct Data**
```bash
node restore-project-7-correct.js
```

**Expected Output**:
- ✅ 2 cases created
- ✅ 10 components created (5 per case)
- ✅ 8 flows created (4 per case)
- ✅ 2 assessment runs created
- ✅ 18 assessment results created
- Final verification shows 96% CO2 reduction

**Step 3: Verify in UI**
1. Hard refresh browser (Cmd+Shift+R)
2. Navigate to home page
3. Click "Electric Vehicle Manufacturing"
4. Verify:
   - 2 cases visible
   - Tree visualization shows 5-level hierarchy
   - Comparison shows 96% CO2 reduction
   - Analytics displays all 8 impact categories

### How to Verify Database State

**Quick Verification Query**:
```javascript
// Run this Node.js script to verify
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

async function verify() {
  const connection = await mysql.createConnection({
    host: process.env.DATABASE_HOST,
    port: process.env.DATABASE_PORT,
    user: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
  });

  const [summary] = await connection.execute(`
    SELECT
      COUNT(DISTINCT c.case_id) as cases,
      COUNT(DISTINCT comp.component_id) as components,
      COUNT(DISTINCT f.flow_id) as flows
    FROM project p
    LEFT JOIN case_table c ON p.project_id = c.project_id
    LEFT JOIN component comp ON c.case_id = comp.case_id
    LEFT JOIN flows f ON comp.component_id = f.component_id
    WHERE p.project_id = 7
  `);

  console.log('Expected: cases=2, components=10, flows=8');
  console.log('Actual:', summary[0]);

  await connection.end();
}

verify();
```

**Expected Results**:
- Cases: 2
- Components: 10
- Flows: 8

---

## Archived Files

All conflicting and obsolete scripts have been moved to:
```
/archive-conflicting-scripts/
```

### What Was Archived

**Conflicting Restoration Scripts**:
- `restore-complete-database.js` - Created 3 cases instead of 2
- `restore-ev-project.sql` - SQL version with different structure
- `create-test-data.sql` - Created 4 cases instead of 2
- `populate-test-data.sql` - Used different project IDs

**Obsolete Partial Scripts**:
- `add-case1-cost-data.sql` - Partial data only
- `add-case2-cost-data.sql` - Partial data only
- `add-case3-cost-data.sql` - For non-existent 3rd case
- `add-case2-test-data.sql` - Incomplete
- `add-third-case.sql` - Extra case not in specification

**Redundant ABC Costing Scripts**:
- `add-abc-cost-test-data.sql` - Costing included in main script
- `add-abc-cost-test-data-fixed.sql` - Duplicate
- `load-abc-test-data.js` - Costing included in main script
- `load-case1-cost-data.js` - Per-case costing obsolete
- `load-case2-cost-data.js` - Per-case costing obsolete
- `load-case3-cost-data.js` - Per-case costing obsolete

**Miscellaneous**:
- `add-component-flows.js` - Flows included in main script
- `add-project7-components.sql` - Components included in main script

**⚠️ DO NOT USE ARCHIVED FILES** - They contain incorrect data structures and will cause conflicts

---

## Data Management Rules

### Rule 1: Single Modification Path
**Only modify Project 7 data through these scripts:**
1. First: `cleanup-project-7-incorrect-data.js`
2. Then: `restore-project-7-correct.js`

**Never**:
- Manually INSERT/UPDATE/DELETE Project 7 data
- Use archived scripts from `/archive-conflicting-scripts/`
- Create ad-hoc SQL scripts
- Mix data from different restoration attempts

### Rule 2: Specification Changes
**If TEST_DATA_SPREADSHEET.md needs updates:**
1. Get PM approval for changes
2. Update TEST_DATA_SPREADSHEET.md
3. Modify `restore-project-7-correct.js` to match
4. Run cleanup then restoration
5. Verify all changes
6. Document what changed and why

### Rule 3: Version Control
**Always commit changes with clear messages:**
```bash
git add TEST_DATA_SPREADSHEET.md restore-project-7-correct.js
git commit -m "Update Project 7 test data: [describe changes]"
```

### Rule 4: Testing Before Deployment
**Before deploying to production:**
1. Test restoration on local database
2. Verify all 8 impact categories display
3. Confirm 96% reduction calculation
4. Test tree visualization
5. Check comparison charts
6. Review with PM

---

## Troubleshooting

### Problem: Project 7 shows wrong number of cases

**Solution**:
```bash
node cleanup-project-7-incorrect-data.js
node restore-project-7-correct.js
```

### Problem: Missing flows or assessment results

**Solution**:
```bash
# Clean and restore completely
node cleanup-project-7-incorrect-data.js
node restore-project-7-correct.js
```

### Problem: Tree visualization not showing

**Checklist**:
- [ ] Hard refresh browser (Cmd+Shift+R)
- [ ] Check browser console for errors
- [ ] Verify component hierarchy in database
- [ ] Ensure parent_component_id relationships are correct
- [ ] Check that root components have NULL parent_component_id

### Problem: Comparison shows wrong percentages

**Checklist**:
- [ ] Verify Case 1 CO2: 125.25 kg
- [ ] Verify Case 2 CO2: 5.0 kg
- [ ] Verify Case 1 CH4: 2.5 kg
- [ ] Verify Case 2 CH4: 0.1 kg
- [ ] Check assessment_results table
- [ ] Recalculate: (195.25 - 7.8) / 195.25 = 96.0%

### Problem: Database connection failed

**Check**:
- [ ] SSH tunnel is active
- [ ] `.env.local` has correct credentials
- [ ] Port 3307 is not in use by another process
- [ ] AWS RDS instance is running

---

## Reference Data

### Substance IDs (from substances table)

| ID | Name | CAS | Category |
|----|------|-----|----------|
| 1 | Carbon Dioxide | 124-38-9 | emission_air |
| 2 | Methane | 74-82-8 | emission_air |
| 7 | Electricity | N/A | resource |
| 8 | Water | 7732-18-5 | resource |

### Impact Category IDs (from impact_categories table)

| ID | Name | Abbreviation | Unit |
|----|------|--------------|------|
| 1 | Global Warming | GWP | kg CO₂ eq |
| 2 | Ozone Depletion | ODP | kg CFC-11 eq |
| 3 | Acidification | AP | kg SO₂ eq |
| 4 | Eutrophication | EP | kg PO₄ eq |
| 5 | Photochemical Oxidation | POCP | kg C₂H₄ eq |
| 6 | Human Toxicity | HTP | kg 1,4-DB eq |
| 7 | Ecotoxicity | ETP | kg 1,4-DB eq |
| 8 | Resource Depletion | ADP | kg Sb eq |

### Component Hierarchy Levels

| Level | Type | Example | Description |
|-------|------|---------|-------------|
| 1 | Product | EV Battery Pack (60 kWh) | Final product |
| 2 | Machine/Line | Cell Assembly Line | Production equipment |
| 3 | Subprocess | Electrode Coating Process | Sub-process |
| 4 | Operation | Drying Operation | Specific operation |
| 5 | Elemental Task | Oven Heating Task | Basic task (flows attach here) |

---

## Change Log

### 2025-01-17: Initial Restoration
- **Action**: Cleaned incorrect 3-case structure
- **Action**: Restored correct 2-case structure per TEST_DATA_SPREADSHEET.md
- **Result**: 96% CO2 reduction verified
- **Files Created**:
  - TEST_DATA_SPREADSHEET.md (specification)
  - restore-project-7-correct.js (implementation)
  - cleanup-project-7-incorrect-data.js (cleanup utility)
  - PROJECT_7_ANALYSIS_AND_RESTORATION.md (analysis)
  - DATABASE_SINGLE_SOURCE_OF_TRUTH.md (this document)
- **Files Archived**: 17 conflicting scripts moved to /archive-conflicting-scripts/

---

## Maintenance Guidelines

### Monthly Review
- [ ] Verify Project 7 still has exactly 2 cases
- [ ] Check assessment results are complete
- [ ] Confirm 96% reduction calculation
- [ ] Test UI visualizations

### Before Major Changes
- [ ] Review TEST_DATA_SPREADSHEET.md
- [ ] Get PM approval
- [ ] Create backup of current data
- [ ] Test on local database first
- [ ] Document all changes

### After Database Migration
- [ ] Run cleanup script
- [ ] Run restoration script
- [ ] Verify all data present
- [ ] Test UI functionality

---

## Success Criteria

✅ **Data Structure**:
- Exactly 2 cases for Project 7
- Exactly 10 components (5 per case)
- Exactly 8 flows (4 per case)
- All parent-child relationships correct

✅ **Environmental Impact**:
- Baseline (Coal): 195.25 kg CO₂ eq total GWP
- Renewable: 7.8 kg CO₂ eq total GWP
- Reduction: 96.0%

✅ **UI Functionality**:
- Tree visualization displays 5-level hierarchy
- Comparison chart shows 96% CO₂ reduction
- Analytics page displays all 8 impact categories
- No console errors

✅ **Documentation**:
- TEST_DATA_SPREADSHEET.md is specification
- restore-project-7-correct.js is implementation
- All conflicting scripts archived
- Clear restoration process documented

---

## Contact and Support

**For Questions About**:
- **Data Structure**: Reference TEST_DATA_SPREADSHEET.md
- **Restoration Process**: Reference this document
- **Specifications**: Contact Product Manager
- **Technical Issues**: Check troubleshooting section

**Critical Files** (DO NOT DELETE):
- TEST_DATA_SPREADSHEET.md
- restore-project-7-correct.js
- cleanup-project-7-incorrect-data.js
- PROJECT_7_ANALYSIS_AND_RESTORATION.md
- DATABASE_SINGLE_SOURCE_OF_TRUTH.md

---

*Document Version: 1.0*
*Created: 2025-01-17*
*Author: System*
*Status: Active*
*Last Verified: 2025-01-17*

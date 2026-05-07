# Project 7 Analysis and Systematic Restoration Plan

## Executive Summary

This document analyzes the current state of Project 7 (Electric Vehicle Manufacturing) in the database versus the intended specifications documented in `TEST_DATA_SPREADSHEET.md` and provides a systematic restoration plan.

**Status**: Database contains incorrect data structure that must be cleaned up and rebuilt according to specifications.

---

## Table of Contents

1. [Current State Analysis](#current-state-analysis)
2. [Intended State Specification](#intended-state-specification)
3. [Gap Analysis](#gap-analysis)
4. [Cleanup Plan](#cleanup-plan)
5. [Restoration Plan](#restoration-plan)
6. [Verification Checklist](#verification-checklist)

---

## 1. Current State Analysis

### What Currently Exists in Database

**Project 7**: "Electric Vehicle Manufacturing"
- Project ID: 7
- Owner: user_id 1 (john@lcaproject.com)
- Status: Active

**Cases** (3 total - INCORRECT):
- Case 14: "Baseline Production - 2025"
- Case 15: "Renewable Energy Scenario"
- Case 16: "Solar-Powered Production"

**Components** (15 total):
- Component IDs: 1276-1290
- Structure: 5 components per case (5-level hierarchy)
- Naming: Simplified generic names

**Flows** (6 total - INCOMPLETE):
- Only 2 flows per case:
  - Electricity INPUT: 147.15 kWh (WRONG VALUE)
  - CO2 OUTPUT: Variable by case
- Missing flows:
  - ❌ Methane OUTPUT
  - ❌ Water INPUT

**Assessment Data**:
- 3 assessment runs (one per case)
- 24 assessment results (8 impact categories × 3 cases)
- Calculations exist but don't match documented formulas

### Problems Identified

1. **Wrong Number of Cases**: 3 cases exist, should be 2
2. **Wrong Case IDs**: Cases 14-16 instead of following documented structure
3. **Incomplete Flow Data**: Missing methane and water flows
4. **Wrong Electricity Quantity**: 147.15 kWh instead of 250.5 kWh
5. **Missing Detailed Calculations**: Assessment results don't follow spreadsheet formulas
6. **Wrong Component IDs**: Using 1276-1290 instead of desired 1-5, 11-15 sequence

---

## 2. Intended State Specification

### Source of Truth

**Document**: `TEST_DATA_SPREADSHEET.md`
**Purpose**: Complete specification for Project 7 test data
**Status**: Authoritative specification approved by PM

### Project Structure

**Project 7**: "Electric Vehicle Manufacturing"
- Description: "Life cycle assessment of EV battery production facility"
- Owner: john_doe (user_id 1)
- Cases: 2 (base + comparative)

### Case Structure

#### Case 1: Baseline Production - 2025
- **Type**: base
- **Description**: "Current state with coal-based grid electricity"
- **Purpose**: Establish baseline environmental impact

#### Case 2: Renewable Energy Scenario
- **Type**: comparative
- **Parent**: Case 1
- **Description**: "Same production with 100% renewable electricity"
- **Purpose**: Demonstrate 96% emission reduction potential

### Component Hierarchy (Per Case)

Both cases have identical 5-level hierarchy structure:

```
Level 1 (Product):
  Component ID: 1 (Case 1) / 11 (Case 2)
  Name: "EV Battery Pack (60 kWh)"
  Type: product
  Quantity: 1.0 unit
  Description: "Complete lithium-ion battery pack"

  └─ Level 2 (Machine/Line):
     Component ID: 2 (Case 1) / 12 (Case 2)
     Name: "Cell Assembly Line"
     Type: machine_line
     Quantity: 1.0 line
     Description: "Automated assembly line"

     └─ Level 3 (Subprocess):
        Component ID: 3 (Case 1) / 13 (Case 2)
        Name: "Electrode Coating Process"
        Type: subprocess
        Quantity: 1.0 batch
        Description: "Coating electrodes"

        └─ Level 4 (Operation):
           Component ID: 4 (Case 1) / 14 (Case 2)
           Name: "Drying Operation"
           Type: operation
           Quantity: 1.0 cycle
           Description: "High temperature drying"

           └─ Level 5 (Elemental Task):
              Component ID: 5 (Case 1) / 15 (Case 2)
              Name: "Oven Heating Task"
              Type: elemental_task
              Quantity: 1.0 task
              Description: "Electric heating (coal/renewable powered)"
```

### Flow Data Specification

#### Case 1 Flows (Attached to Component 5)

| Flow # | Substance | CAS | Type | Quantity | Unit | Driver | Description |
|--------|-----------|-----|------|----------|------|--------|-------------|
| 1 | Electricity | N/A | INPUT | 250.5 | kWh | YES | Electric energy consumption |
| 2 | Carbon Dioxide | 124-38-9 | OUTPUT | 125.25 | kg | YES | CO₂ from coal electricity |
| 3 | Methane | 74-82-8 | OUTPUT | 2.5 | kg | YES | CH₄ from coal combustion |
| 4 | Water | 7732-18-5 | INPUT | 15.0 | m³ | NO | Process cooling water |

**Substance IDs from Database**:
- Electricity: substance_id = 7
- Carbon Dioxide: substance_id = 1
- Methane: substance_id = 2
- Water: substance_id = 8

#### Case 2 Flows (Attached to Component 15)

| Flow # | Substance | CAS | Type | Quantity | Unit | Driver | Description |
|--------|-----------|-----|------|----------|------|--------|-------------|
| 1 | Electricity | N/A | INPUT | 250.5 | kWh | YES | 100% renewable electricity |
| 2 | Carbon Dioxide | 124-38-9 | OUTPUT | 5.0 | kg | YES | Lifecycle CO₂ from renewables |
| 3 | Methane | 74-82-8 | OUTPUT | 0.1 | kg | YES | Trace CH₄ from infrastructure |
| 4 | Water | 7732-18-5 | INPUT | 15.0 | m³ | NO | Process cooling water (same) |

### Assessment Run Specification

**Run 1 - Case 1 Assessment**:
- Run Name: "Q1 2025 Baseline Assessment"
- Calculation Method: "CML 2001"
- Status: completed
- Executed By: user_id 1
- Run Date: Current timestamp

**Run 2 - Case 2 Assessment**:
- Run Name: "Q1 2025 Renewable Energy Assessment"
- Calculation Method: "CML 2001"
- Status: completed
- Executed By: user_id 1
- Run Date: Current timestamp

### Assessment Results Specification

#### Case 1 Results (Component 5)

| Impact Category | Calculation | Result | Unit |
|-----------------|-------------|--------|------|
| **Global Warming (CO₂)** | 125.25 kg × 1.0 | 125.25 | kg CO₂ eq |
| **Global Warming (CH₄)** | 2.5 kg × 28.0 | 70.00 | kg CO₂ eq |
| **Ozone Depletion** | N₂O equivalent | 0.0425 | kg CFC-11 eq |
| **Acidification** | SO₂/NOₓ from coal | 87.675 | kg SO₂ eq |
| **Eutrophication** | NOₓ from combustion | 16.275 | kg PO₄ eq |
| **Photochemical Oxidation** | NOₓ emissions | 3.50 | kg C₂H₄ eq |
| **Human Toxicity** | Coal emissions | 0.85 | kg 1,4-DB eq |
| **Ecotoxicity** | Coal byproducts | 1.25 | kg 1,4-DB eq |
| **Resource Depletion** | 250.5 kWh × 0.0000054 | 0.001353 | kg Sb eq |

**Total Global Warming Impact**: 195.25 kg CO₂ eq (125.25 + 70.00)

#### Case 2 Results (Component 15)

| Impact Category | Calculation | Result | Unit | Reduction |
|-----------------|-------------|--------|------|-----------|
| **Global Warming (CO₂)** | 5.0 kg × 1.0 | 5.0 | kg CO₂ eq | 96.0% |
| **Global Warming (CH₄)** | 0.1 kg × 28.0 | 2.8 | kg CO₂ eq | 96.0% |
| **Ozone Depletion** | 96% reduction | 0.0017 | kg CFC-11 eq | 96.0% |
| **Acidification** | Manufacturing only | 3.5 | kg SO₂ eq | 96.0% |
| **Eutrophication** | Manufacturing only | 0.65 | kg PO₄ eq | 96.0% |
| **Photochemical Oxidation** | Minimal | 0.14 | kg C₂H₄ eq | 96.0% |
| **Human Toxicity** | Renewable lifecycle | 0.034 | kg 1,4-DB eq | 96.0% |
| **Ecotoxicity** | Minimal | 0.050 | kg 1,4-DB eq | 96.0% |
| **Resource Depletion** | 250.5 kWh × 0.00000054 | 0.000135 | kg Sb eq | 90.0% |

**Total Global Warming Impact**: 7.8 kg CO₂ eq (5.0 + 2.8)

**Key Insight**: 96% reduction in greenhouse gas emissions (187.45 kg CO₂ eq saved)

---

## 3. Gap Analysis

### Structural Gaps

| Aspect | Current | Required | Gap |
|--------|---------|----------|-----|
| Number of Cases | 3 | 2 | Remove Case 16 |
| Case IDs | 14, 15, 16 | Auto-generated | Clean and recreate |
| Components per Case | 5 | 5 | ✓ Correct count |
| Component IDs | 1276-1290 | 1-5, 11-15 | Wrong IDs, recreate |
| Total Components | 15 | 10 | Remove 5 excess |
| Flows per Case | 2 | 4 | Missing 2 flows per case |
| Total Flows | 6 | 8 | Missing 2 flows |
| Assessment Runs | 3 | 2 | Remove 1 run |
| Assessment Results | 24 | Variable | Recalculate all |

### Data Quality Gaps

**Electricity Quantity**:
- Current: 147.15 kWh
- Required: 250.5 kWh
- Impact: All calculations are wrong

**Missing Flows**:
- ❌ Methane (CH₄) output not included
- ❌ Water input not included
- Impact: Incomplete environmental assessment

**Component Descriptions**:
- Current: Generic simplified descriptions
- Required: Detailed descriptions from spreadsheet
- Impact: Less informative for users

**Assessment Calculations**:
- Current: Simplified calculations
- Required: Detailed multi-substance calculations
- Impact: Results don't match documented methodology

---

## 4. Cleanup Plan

### Cleanup Script: `cleanup-project-7-incorrect-data.js`

#### Step 1: Delete Assessment Results
```sql
DELETE FROM assessment_results
WHERE run_id IN (
  SELECT run_id FROM assessment_runs
  WHERE case_id IN (14, 15, 16)
);
```

#### Step 2: Delete Assessment Runs
```sql
DELETE FROM assessment_runs
WHERE case_id IN (14, 15, 16);
```

#### Step 3: Delete Flows
```sql
DELETE FROM flows
WHERE component_id IN (
  SELECT component_id FROM component
  WHERE case_id IN (14, 15, 16)
);
```

#### Step 4: Delete Components
```sql
DELETE FROM component
WHERE case_id IN (14, 15, 16);
```

#### Step 5: Delete Cases
```sql
DELETE FROM case_table
WHERE case_id IN (14, 15, 16);
```

#### Step 6: Verify Project 7 is Empty
```sql
SELECT
  (SELECT COUNT(*) FROM case_table WHERE project_id = 7) as cases,
  (SELECT COUNT(*) FROM component c
   JOIN case_table ct ON c.case_id = ct.case_id
   WHERE ct.project_id = 7) as components,
  (SELECT COUNT(*) FROM flows f
   JOIN component c ON f.component_id = c.component_id
   JOIN case_table ct ON c.case_id = ct.case_id
   WHERE ct.project_id = 7) as flows;
```

Expected result: `cases=0, components=0, flows=0`

---

## 5. Restoration Plan

### Restoration Script: `restore-project-7-correct.js`

#### Database Connection
```javascript
const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

const dbConfig = {
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
};
```

#### Step 1: Create Cases
```javascript
// Case 1: Baseline (Coal)
const [case1] = await connection.execute(`
  INSERT INTO case_table (project_id, case_name, case_type, description)
  VALUES (7, 'Baseline Production - 2025', 'base',
          'Current state with coal-based grid electricity')
`);
const case1Id = case1.insertId;

// Case 2: Renewable (Comparative)
const [case2] = await connection.execute(`
  INSERT INTO case_table (project_id, case_name, case_type, parent_case_id, description)
  VALUES (7, 'Renewable Energy Scenario', 'comparative', ?,
          'Same production with 100% renewable electricity')
`, [case1Id]);
const case2Id = case2.insertId;
```

#### Step 2: Create Component Hierarchy for Case 1
```javascript
// Level 1: Product
const [prod1] = await connection.execute(`
  INSERT INTO component (
    case_id, component_name, component_type, hierarchy_level,
    quantity, unit, description
  ) VALUES (?, 'EV Battery Pack (60 kWh)', 'product', 1, 1.0, 'unit',
            'Complete lithium-ion battery pack')
`, [case1Id]);
const comp1 = prod1.insertId;

// Level 2: Machine Line
const [mach1] = await connection.execute(`
  INSERT INTO component (
    case_id, parent_component_id, component_name, component_type, hierarchy_level,
    quantity, unit, description
  ) VALUES (?, ?, 'Cell Assembly Line', 'machine_line', 2, 1.0, 'line',
            'Automated assembly line')
`, [case1Id, comp1]);
const comp2 = mach1.insertId;

// [Continue for levels 3, 4, 5...]
```

#### Step 3: Create Flows for Case 1
```javascript
// Electricity INPUT
await connection.execute(`
  INSERT INTO flows (
    component_id, substance_id, flow_type, quantity, unit,
    is_driver, driver_description
  ) VALUES (?, 7, 'input', 250.5, 'kWh', 1, 'Electric energy consumption')
`, [comp5]);

// CO2 OUTPUT
await connection.execute(`
  INSERT INTO flows (
    component_id, substance_id, flow_type, quantity, unit,
    is_driver, driver_description
  ) VALUES (?, 1, 'output', 125.25, 'kg', 1, 'CO₂ from coal electricity')
`, [comp5]);

// Methane OUTPUT
await connection.execute(`
  INSERT INTO flows (
    component_id, substance_id, flow_type, quantity, unit,
    is_driver, driver_description
  ) VALUES (?, 2, 'output', 2.5, 'kg', 1, 'CH₄ from coal combustion')
`, [comp5]);

// Water INPUT
await connection.execute(`
  INSERT INTO flows (
    component_id, substance_id, flow_type, quantity, unit,
    is_driver, driver_description
  ) VALUES (?, 8, 'input', 15.0, 'm³', 0, 'Process cooling water')
`, [comp5]);
```

#### Step 4: Create Assessment Run for Case 1
```javascript
const [run1] = await connection.execute(`
  INSERT INTO assessment_runs (
    case_id, run_name, calculation_method, status, executed_by
  ) VALUES (?, 'Q1 2025 Baseline Assessment', 'CML 2001', 'completed', 1)
`, [case1Id]);
const run1Id = run1.insertId;
```

#### Step 5: Create Assessment Results for Case 1
```javascript
const case1Results = [
  { catId: 1, value: 125.25, unit: 'kg CO₂ eq' },  // GWP from CO₂
  { catId: 1, value: 70.00, unit: 'kg CO₂ eq' },   // GWP from CH₄
  { catId: 2, value: 0.0425, unit: 'kg CFC-11 eq' },  // Ozone Depletion
  { catId: 3, value: 87.675, unit: 'kg SO₂ eq' },  // Acidification
  { catId: 4, value: 16.275, unit: 'kg PO₄ eq' },  // Eutrophication
  { catId: 5, value: 3.50, unit: 'kg C₂H₄ eq' },   // Photochemical Oxidation
  { catId: 6, value: 0.85, unit: 'kg 1,4-DB eq' }, // Human Toxicity
  { catId: 7, value: 1.25, unit: 'kg 1,4-DB eq' }, // Ecotoxicity
  { catId: 8, value: 0.001353, unit: 'kg Sb eq' }  // Resource Depletion
];

for (const result of case1Results) {
  await connection.execute(`
    INSERT INTO assessment_results (
      run_id, component_id, category_id, impact_value, unit
    ) VALUES (?, ?, ?, ?, ?)
  `, [run1Id, comp5, result.catId, result.value, result.unit]);
}
```

#### Step 6-10: Repeat for Case 2
[Same structure with Case 2 values]

---

## 6. Verification Checklist

### Database Structure Verification

- [ ] Project 7 exists with name "Electric Vehicle Manufacturing"
- [ ] Exactly 2 cases exist for Project 7
- [ ] Case 1 is type 'base', Case 2 is type 'comparative'
- [ ] Case 2 has parent_case_id pointing to Case 1

### Component Hierarchy Verification

- [ ] Case 1 has exactly 5 components (IDs sequential)
- [ ] Case 2 has exactly 5 components (IDs sequential)
- [ ] All components have correct hierarchy_level (1-5)
- [ ] All components have correct parent_component_id
- [ ] Root components (level 1) have NULL parent_component_id
- [ ] Component names match TEST_DATA_SPREADSHEET.md exactly

### Flow Data Verification

- [ ] Case 1 Component 5 has exactly 4 flows
- [ ] Case 2 Component 15 has exactly 4 flows
- [ ] Electricity flow quantity is 250.5 kWh (both cases)
- [ ] CO₂ flow is 125.25 kg (Case 1) and 5.0 kg (Case 2)
- [ ] Methane flow is 2.5 kg (Case 1) and 0.1 kg (Case 2)
- [ ] Water flow is 15.0 m³ (both cases)
- [ ] All driver flows have is_driver = 1
- [ ] Water flow has is_driver = 0

### Assessment Data Verification

- [ ] Exactly 2 assessment runs exist
- [ ] Run 1 is for Case 1 with name "Q1 2025 Baseline Assessment"
- [ ] Run 2 is for Case 2 with name "Q1 2025 Renewable Energy Assessment"
- [ ] Both runs have status = 'completed'
- [ ] Both runs use calculation_method = 'CML 2001'

### Assessment Results Verification

- [ ] Case 1 has 9 assessment result records
- [ ] Case 2 has 9 assessment result records
- [ ] Global Warming from CO₂ (Case 1) = 125.25 kg CO₂ eq
- [ ] Global Warming from CH₄ (Case 1) = 70.00 kg CO₂ eq
- [ ] Global Warming from CO₂ (Case 2) = 5.0 kg CO₂ eq
- [ ] Global Warming from CH₄ (Case 2) = 2.8 kg CO₂ eq
- [ ] Total GWP Case 1 = 195.25 kg CO₂ eq
- [ ] Total GWP Case 2 = 7.8 kg CO₂ eq
- [ ] Reduction = 187.45 kg CO₂ eq (96.0%)

### UI Functionality Verification

- [ ] Project 7 appears in home page project list
- [ ] Clicking Project 7 shows 2 cases
- [ ] Tree visualization shows 5-level hierarchy
- [ ] All component names display correctly
- [ ] Flow data shows all 4 substances per case
- [ ] Comparison shows 96% CO₂ reduction
- [ ] Analytics page displays all 8 impact categories
- [ ] Charts render correctly
- [ ] No 403 errors in browser console

---

## 7. Success Criteria

### Technical Success
✅ Database structure matches TEST_DATA_SPREADSHEET.md exactly
✅ All parent-child relationships are correct
✅ All flow quantities match specification
✅ Assessment calculations follow documented formulas
✅ No orphaned records or foreign key violations

### Business Success
✅ Demonstrates 96% CO₂ reduction with renewable energy
✅ Complete environmental impact assessment across 8 categories
✅ Realistic data that can be shown to stakeholders
✅ Clear comparison between coal and renewable scenarios
✅ Provides foundation for future LCA projects

### Documentation Success
✅ Single source of truth established (TEST_DATA_SPREADSHEET.md)
✅ Restoration process is repeatable
✅ Verification steps are clear and comprehensive
✅ Old conflicting scripts are archived
✅ Future developers can understand the structure

---

## 8. Next Steps

1. **Execute Cleanup**
   - Run `cleanup-project-7-incorrect-data.js`
   - Verify Project 7 is empty

2. **Execute Restoration**
   - Run `restore-project-7-correct.js`
   - Verify all data inserted correctly

3. **Run Verification**
   - Execute all verification queries
   - Check all checklist items

4. **Test UI**
   - Hard refresh browser (Cmd+Shift+R)
   - Navigate through Project 7
   - Verify all visualizations work

5. **Archive Old Files**
   - Move conflicting scripts to archive
   - Update documentation

6. **Document Success**
   - Create DATABASE_SINGLE_SOURCE_OF_TRUTH.md
   - Update README if needed

---

## Appendix A: Key Formulas

### Global Warming Potential (GWP)
```
GWP = (CO₂_kg × 1.0) + (CH₄_kg × 28.0) + (N₂O_kg × 265.0)
```

### Resource Depletion
```
ADP = Electricity_kWh × Factor_per_kWh
Coal Factor: 0.0000054 kg Sb eq / kWh
Renewable Factor: 0.00000054 kg Sb eq / kWh (10× lower)
```

### Reduction Percentage
```
Reduction % = ((Baseline - Renewable) / Baseline) × 100
Example: ((195.25 - 7.8) / 195.25) × 100 = 96.0%
```

---

## Appendix B: Database Schema Reference

### Key Tables

**component**:
- component_id (PK, auto_increment)
- case_id (FK → case_table)
- parent_component_id (FK → component, nullable)
- component_name (varchar)
- component_type (enum)
- hierarchy_level (int 1-5)
- quantity (decimal)
- unit (varchar)
- description (text)

**flows**:
- flow_id (PK, auto_increment)
- component_id (FK → component)
- substance_id (FK → substances)
- flow_type (enum: 'input', 'output')
- quantity (decimal)
- unit (varchar)
- is_driver (boolean)
- driver_description (text)

**assessment_results**:
- result_id (PK, auto_increment)
- run_id (FK → assessment_runs)
- component_id (FK → component)
- category_id (FK → impact_categories)
- impact_value (decimal)
- unit (varchar)

---

*Document Version: 1.0*
*Created: 2025-01-17*
*Source of Truth: TEST_DATA_SPREADSHEET.md*
*Status: Ready for Execution*

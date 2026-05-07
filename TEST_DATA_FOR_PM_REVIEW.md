# Test Data for Product Manager Review

## Purpose
This document shows the exact test data that will be created in the LCA database. Please review this data structure and values to ensure it matches your LCA methodology and business requirements.

---

## 📋 Test Data Overview

### User Account
```
Username: john_doe
Email: john@lcaproject.com
Password: password123
Account Type: user
```

### Project Details
```
Project Name: Electric Vehicle Manufacturing
Description: Life cycle assessment of EV battery production facility
Owner: john_doe
Created: [timestamp]
```

---

## 🏗️ Case Structures

### Case 1: Baseline Production - 2025 (Base Case)
```
Type: base
Description: Current state with coal-based grid electricity
Status: Active with complete assessment
```

### Case 2: Renewable Energy Scenario (Comparative Case)
```
Type: comparative
Parent Case: Baseline Production - 2025
Description: Same production with 100% renewable electricity
Status: Created (ready for future assessment)
```

---

## 🔧 5-Level Component Hierarchy

This demonstrates the complete hierarchy from Product down to Elemental Task:

```
Level 1 - PRODUCT
└─ EV Battery Pack (60 kWh)
   │  Type: product
   │  Quantity: 1.0 unit
   │  Description: Complete lithium-ion battery pack for electric vehicle
   │
   └─ Level 2 - MACHINE/LINE
      └─ Cell Assembly Line
         │  Type: machine_line
         │  Quantity: 1.0 line
         │  Description: Automated battery cell assembly line
         │
         └─ Level 3 - SUBPROCESS
            └─ Electrode Coating Process
               │  Type: subprocess
               │  Quantity: 1.0 batch
               │  Description: Coating electrodes with active materials
               │
               └─ Level 4 - OPERATION
                  └─ Drying Operation
                     │  Type: operation
                     │  Quantity: 1.0 cycle
                     │  Description: High temperature drying of coated electrodes
                     │
                     └─ Level 5 - ELEMENTAL TASK
                        └─ Oven Heating Task
                           Type: elemental_task
                           Quantity: 1.0 task
                           Description: Electric heating element operation
```

**PM Review Questions:**
- ✅ Does this hierarchy structure match your LCA process breakdown?
- ✅ Are the component names appropriate for EV battery manufacturing?
- ✅ Is the 5-level depth sufficient for your analysis?

---

## 🔄 Material Flows (Inputs/Outputs)

Flows attached to: **Oven Heating Task** (Elemental Task)

### Input Flows

| Substance | Quantity | Unit | Driver? | Description |
|-----------|----------|------|---------|-------------|
| **Electricity** | 250.5 | kWh | ✅ Yes | Electric energy consumption for oven heating |
| **Water** | 15.0 | m³ | ❌ No | Process cooling water |

### Output Flows

| Substance | Quantity | Unit | Driver? | Description |
|-----------|----------|------|---------|-------------|
| **Carbon Dioxide (CO₂)** | 125.25 | kg | ✅ Yes | CO₂ emissions from coal-based electricity generation |
| **Methane (CH₄)** | 2.5 | kg | ✅ Yes | Methane emissions from energy production |

**PM Review Questions:**
- ✅ Are these flow quantities realistic for battery manufacturing?
- ✅ Are we missing any important inputs or outputs?
- ✅ Should water be marked as a driver for water depletion impacts?
- ✅ Are emission values appropriate for coal-based electricity?

---

## 📊 Assessment Run Configuration

```
Assessment Name: Q1 2025 Baseline Assessment
Calculation Method: CML 2001
Status: Completed
Executed By: john_doe
Scope: Full product lifecycle
```

---

## 🌍 Environmental Impact Results

These are automatically calculated based on the driver flows and impact factors:

### Global Warming Potential (GWP)

| Source | Quantity | Factor | Impact | Unit |
|--------|----------|--------|--------|------|
| CO₂ emissions | 125.25 kg | 1.0 | **125.25** | kg CO₂ eq |
| CH₄ emissions | 2.5 kg | 28.0 | **70.00** | kg CO₂ eq |
| **Total GWP** | - | - | **195.25** | **kg CO₂ eq** |

### Ozone Depletion Potential (ODP)

| Source | Quantity | Factor | Impact | Unit |
|--------|----------|--------|--------|------|
| N₂O emissions | 2.5 kg | 0.017 | **0.0425** | kg CFC-11 eq |

### Resource Depletion (ADP)

| Source | Quantity | Factor | Impact | Unit |
|--------|----------|--------|--------|------|
| Electricity | 250.5 kWh | 0.0000054 | **0.001353** | kg Sb eq |
| Coal (embedded) | - | - | *calculated* | kg Sb eq |

### Additional Categories Calculated:
- ✅ Acidification (AP)
- ✅ Eutrophication (EP)  
- ✅ Photochemical Oxidation (POCP)
- ✅ Human Toxicity (HTP)
- ✅ Ecotoxicity (ETP)

**PM Review Questions:**
- ✅ Do these impact calculation factors match CML 2001 methodology?
- ✅ Are the calculated values in the expected range?
- ✅ Should we include additional impact categories?
- ✅ Is the GWP factor for methane correct (28x CO₂)?

---

## 🔍 Data Quality & Sources

### Impact Factors Sources:
- **GWP Factors**: IPCC AR6 2021 (100-year GWP)
- **ODP Factors**: WMO 2018
- **Acidification/Eutrophication**: CML 2001
- **Resource Depletion**: CML 2001 - Electricity mix

### Data Quality Scores:
- CO₂ GWP: 5.0/5.0 (highest quality)
- CH₄ GWP: 5.0/5.0 (highest quality)
- Electricity ADP: 3.5/5.0 (medium quality - grid mix dependent)

**PM Review Questions:**
- ✅ Are these data sources acceptable for your LCA reports?
- ✅ Do we need to track data quality for each flow?
- ✅ Should we support regional electricity grid factors?

---

## 📈 Complete Data Model

### Database Tables Populated:

| Table | Records | Description |
|-------|---------|-------------|
| **account** | 1 | Test user |
| **project** | 1 | EV Manufacturing project |
| **project_members** | 1 | Owner permission |
| **case_table** | 2 | Base + comparative cases |
| **component** | 5 | Full 5-level hierarchy |
| **flows** | 4 | 2 inputs + 2 outputs |
| **assessment_runs** | 1 | Completed assessment |
| **assessment_results** | ~8-10 | Impact calculations across categories |

### Reference Data (Already Seeded):

| Table | Records | Content |
|-------|---------|---------|
| **permissions** | 4 | owner, admin, editor, viewer |
| **impact_categories** | 8 | GWP, ODP, AP, EP, POCP, HTP, ETP, ADP |
| **substances** | 13 | CO₂, CH₄, N₂O, SO₂, NOₓ, PM2.5, Electricity, Water, Oil, Gas, Coal, Wastewater, Waste |
| **driver_impact_factors** | 11 | Conversion factors for CML 2001 |

---

## ✅ PM Validation Checklist

### LCA Methodology
- [ ] Component hierarchy matches standard LCA process breakdown
- [ ] Flow types (input/output) are correctly categorized
- [ ] Driver flows are properly identified
- [ ] Impact categories align with ISO 14040/14044 standards

### Data Values
- [ ] Electricity consumption (250.5 kWh) is realistic for the process
- [ ] CO₂ emissions (125.25 kg) are appropriate for coal-based electricity
- [ ] Methane emissions (2.5 kg) are within expected range
- [ ] Water consumption (15 m³) is reasonable

### Calculation Results
- [ ] GWP total (195.25 kg CO₂ eq) is in expected range
- [ ] Characterization factors (e.g., CH₄ = 28x CO₂) are correct
- [ ] Impact calculation methodology is sound
- [ ] Results can be compared between base and comparative cases

### Business Requirements
- [ ] Data structure supports required LCA workflows
- [ ] All necessary data fields are captured
- [ ] Permission system (owner/admin/editor/viewer) is appropriate
- [ ] Assessment run tracking is sufficient for audit purposes

### Future Integration
- [ ] Structure is ready for Ecoinvent database integration
- [ ] Can accommodate additional substances and impact categories
- [ ] Supports comparative LCA scenarios
- [ ] Allows for sensitivity analysis

---

## 📝 PM Feedback Form

Please provide feedback on the following:

### 1. Data Structure
**Is the 5-level hierarchy appropriate for your LCA needs?**
```
[ ] Perfect as is
[ ] Needs modification: _________________________________
[ ] Additional levels needed: __________________________
```

### 2. Flow Quantities
**Are the test values realistic?**
```
[ ] Yes, values look good
[ ] No, adjust the following: _________________________
```

### 3. Impact Categories
**Are these 8 categories sufficient?**
```
[ ] Yes
[ ] No, add: __________________________________________
```

### 4. Missing Data
**What's missing that you need for LCA reporting?**
```
_______________________________________________________
_______________________________________________________
```

### 5. Ecoinvent Integration
**What Ecoinvent data do you need most urgently?**
```
[ ] Process databases
[ ] Substance characterization factors
[ ] Life cycle inventory data
[ ] Other: ____________________________________________
```

### 6. Additional Comments
```
_______________________________________________________
_______________________________________________________
_______________________________________________________
```

---

## 🚀 Next Steps After Validation

1. **PM Reviews & Approves** this test data structure
2. **Execute Test Data Script** to populate database
3. **PM Verifies** data in actual database
4. **Purchase Ecoinvent API** access
5. **Integrate Ecoinvent** data into the system
6. **Begin Real Projects** with actual LCA data

---

## 📞 Contact for Questions

If you need clarification on:
- **Data Structure**: Database schema design questions
- **LCA Methodology**: Impact calculation questions  
- **Ecoinvent Integration**: API integration planning
- **Modifications**: Changes to test data or structure

Please provide feedback so we can adjust before creating the test data!

---

*Document Purpose: Product Manager validation of test data structure*  
*Status: Awaiting PM Review*  
*Next Action: PM approval to proceed with test data creation*

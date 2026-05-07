# Nutroleum vs Vaseline LCA Project - Test Data Guide

## Overview
This test project demonstrates a complete comparative Life Cycle Assessment between:
- **Base Case:** Nutroleum (plant-based petroleum jelly alternative)
- **Comparative Case:** Vaseline (conventional petroleum-based jelly)

## Project Structure

### Hierarchy (5 Levels per Case)
```
Level 1: Product
  └─ 3 oz Petroleum Jelly Jar

Level 2: Machine Lines (3)
  ├─ Blending and Mixing Line
  ├─ Filling Line
  └─ Sealing and Capping Line

Level 3: Subprocesses (12 total)
  Blending/Mixing (5):
    ├─ Raw Material Weighing
    ├─ Glycerin/Wax Preheating
    ├─ Oil Preheating
    ├─ Mixing and Additives
    └─ QC Sample and Testing

  Filling (3):
    ├─ Container Preparation
    ├─ Heated Filling
    └─ QC Weight Check

  Sealing/Capping (4):
    ├─ Sealing and Capping
    ├─ Labeling
    ├─ Cartoning and Batch Coding
    └─ Final Inspection

Level 4: Operations (~30 per case)
  Example operations per subprocess

Level 5: Elemental Tasks (~80 per case)
  Detailed tasks with environmental flows
```

### Total Components
- **Nutroleum Case:** ~126 components
- **Vaseline Case:** ~126 components
- **Total:** ~252 components

## Key Differences

### Nutroleum (Plant-Based)
- **Raw Materials:** Plant-based glycerin (palm oil byproduct), organic oils
- **Production Cost:** $10-24/kg
- **Environmental Profile:**
  - Lower fossil fuel depletion
  - Higher land use (agriculture)
  - Lower carcinogen emissions
  - Organic certification overhead
- **Packaging:** Eco-friendly, recyclable materials

### Vaseline (Petroleum-Based)
- **Raw Materials:** Heavy fuel oil, petroleum distillates
- **Production Cost:** $2-5/kg
- **Environmental Profile:**
  - Higher fossil fuel depletion
  - Higher CO2 emissions
  - Higher carcinogen risk (PAH)
  - Lower land use
- **Packaging:** Standard HDPE/PP plastics

## ABC Costing Breakdown

Each component includes:
- **CAPEX:** Capital expenditure
- **OPEX:** Operational costs
  - Labor Cost
  - Energy Cost
  - Transportation Cost
  - Material Cost
  - Equipment Cost
  - Overhead Cost

### Sample Cost Values (per component level)
| Level | Capex | Opex | Labor | Energy | Transport | Material |
|-------|-------|------|-------|--------|-----------|----------|
| Product | - | - | - | - | - | - |
| Machine Line | 0.01-0.02 | 0.005-0.01 | 0.002-0.005 | 0.002-0.005 | 0.001-0.002 | 0.002-0.005 |
| Subprocess | 0.01-0.02 | 0.002-0.01 | 0.002-0.005 | 0.001-0.005 | 0.001-0.002 | 0.002-0.005 |
| Operation | minimal | 0.002-0.003 | 0.0015-0.002 | 0.0003-0.0005 | 0.0003 | minimal |
| Elemental Task | minimal | 0.001-0.002 | 0.0005-0.001 | 0.0001-0.0003 | 0.0001 | minimal |

## Environmental Flows

### Flow Types
- **Input Flows:** Raw materials, energy, water consumed
- **Output Flows:** Products, emissions, waste generated

### Key Substances

**Nutroleum Flows:**
- Inputs: Plant oils, renewable electricity, process water, recycled packaging
- Outputs: CO2 (agricultural), organic waste, recyclable packaging

**Vaseline Flows:**
- Inputs: Heavy fuel oil, grid electricity, natural gas, process water, plastic packaging
- Outputs: CO2 (high), NOx, SOx, PAH, wastewater, plastic waste

## Impact Categories (10)

1. **Global Warming** (kg CO2-eq) - Vaseline higher
2. **Ozone Depletion** (kg CFC-11-eq)
3. **Acidification** (kg SO2-eq) - Vaseline higher
4. **Eutrophication** (kg PO4-eq) - Nutroleum higher (agriculture)
5. **Photochemical Oxidation** (kg C2H4-eq)
6. **Human Toxicity** (kg 1,4-DB-eq) - Vaseline higher (PAH)
7. **Ecotoxicity Aquatic** (kg 1,4-DB-eq)
8. **Ecotoxicity Terrestrial** (kg 1,4-DB-eq)
9. **Resource Depletion** (kg Sb-eq) - Vaseline higher (fossil fuels)
10. **Land Use** (m2a) - Nutroleum higher (agriculture)

## Implementation Files

1. **nutroleum-vaseline-test-data.sql** - Main SQL script (in progress)
2. **load-nutroleum-data.js** - JavaScript loader (if needed)
3. **This README** - Documentation

## Loading the Data

### Option 1: Direct MySQL
```bash
mysql -u root -p lca_dev < nutroleum-vaseline-test-data.sql
```

### Option 2: Via Application
Use the existing test data loading mechanisms in the app

### Option 3: Via Script
```bash
node load-nutroleum-data.js
```

## Expected Results

After loading:
- 1 new project appears in project list
- 2 cases (Base: Nutroleum, Comparative: Vaseline)
- Full tree visualization with 5 levels
- ABC costing data visible in component details
- Environmental flows attached to elemental tasks
- Assessment results showing comparative impact
- Analytics dashboard with charts comparing both cases

## Data Sources

- ABC Costing: Petroleum Jelly Manufacturing Costs Table
- LCA Methodology: Sustainable Minds framework
- Impact Values: Based on real Nutroleum research study
- Hierarchy: Manufacturing process flow analysis
- Substances: Standard LCA databases (ecoinvent, USLCI)

## Validation Checklist

- [ ] Project created successfully
- [ ] Both cases visible in UI
- [ ] Tree shows 5 levels of hierarchy
- [ ] ABC costs display correctly
- [ ] Environmental flows attached
- [ ] Assessment runs complete
- [ ] Analytics show comparative data
- [ ] Comparison page works
- [ ] All 252 components created
- [ ] No orphaned components

## Notes

- This is TEST DATA for demonstration purposes
- Cost values are illustrative based on research
- Environmental flows use simplified LCA factors
- Actual production values may vary significantly
- Designed to showcase all application features

## References

- 3rd Rock Essentials Nutroleum Study
- Petroleum Jelly Manufacturing Process Analysis
- EGRMGMT 590 LCA Bucket Assignment
- Sustainable Minds LCA Methodology

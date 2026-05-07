# MSWT Project Database Schema Guide

## Overview

This document provides detailed information about the database schema extracted from the working LCA v3 system (Project 10 - Petroleum Jelly) and used to create the MSWT (Municipal Solid Waste Treatment) project setup (Project 12).

## Database Connection Details

```
Host:     127.0.0.1
Port:     3307
Database: lca_v3
User:     lcaadmin
Password: EP76017fLefZ8?d!ezTHsN[kA()X
```

## Table Structures

### 1. case_table

The primary table for managing different assessment cases (base case and comparative scenarios).

#### Column Structure:

```sql
Field                Type           Null    Key     Default              Extra
─────────────────────────────────────────────────────────────────────────────
case_id              INT            NO      PRI     NULL                 auto_increment
project_id           INT            NO      MUL     NULL
case_name            VARCHAR(200)   NO              NULL
case_type            ENUM('base'    NO              NULL
                         'comparative')
parent_case_id       INT            YES     MUL     NULL
description          TEXT           YES             NULL
created_at           TIMESTAMP      YES             CURRENT_TIMESTAMP
updated_at           TIMESTAMP      YES             CURRENT_TIMESTAMP (on update)
```

#### Key Relationships:
- Links cases to projects via `project_id`
- Supports hierarchical relationships: `parent_case_id` creates comparative case chains
- Case types: `base` (baseline scenario) or `comparative` (alternative scenarios)

#### Sample Data (Project 10):
```json
{
  "case_id": 21,
  "project_id": 10,
  "case_name": "Petroleum Jelly (3 oz) Base Case",
  "case_type": "base",
  "parent_case_id": null,
  "description": "Baseline petroleum jelly formula",
  "created_at": "2025-11-19T02:04:21.000Z",
  "updated_at": "2025-11-19T02:04:21.000Z"
}
```

---

### 2. component

Represents the process hierarchy - breaking down complex systems into manageable sub-processes.

#### Column Structure:

```sql
Field                    Type                                      Null    Key     Default     Extra
────────────────────────────────────────────────────────────────────────────────────────────────────
component_id             INT                                       NO      PRI     NULL        auto_increment
case_id                  INT                                       NO      MUL     NULL
parent_component_id      INT                                       YES     MUL     NULL
component_name           VARCHAR(200)                              NO              NULL
component_type           ENUM('product'                            NO      MUL     NULL
                              'machine_line'
                              'subprocess'
                              'operation'
                              'elemental_task')
hierarchy_level          INT                                       NO      MUL     NULL
quantity                 DECIMAL(15,6)                             YES             1.000000
unit                     VARCHAR(50)                               YES             'unit'
description              TEXT                                      YES             NULL
created_at               TIMESTAMP                                 YES             CURRENT_TIMESTAMP
updated_at               TIMESTAMP                                 YES             CURRENT_TIMESTAMP
process_type             VARCHAR(100)                              YES             NULL
driver_category          VARCHAR(100)                              YES             NULL
driver_type              VARCHAR(100)                              YES             NULL
drivers                  JSON                                      YES             NULL
opex                     DECIMAL(15,2)                             YES     MUL     NULL
capex                    DECIMAL(15,2)                             YES             NULL
labor_cost               DECIMAL(15,2)                             YES             NULL
energy_cost              DECIMAL(15,2)                             YES             NULL
transportation_cost      DECIMAL(15,2)                             YES             NULL
material_cost            DECIMAL(15,2)                             YES             NULL
equipment_cost           DECIMAL(15,2)                             YES             NULL
overhead_cost            DECIMAL(15,2)                             YES             NULL
currency                 VARCHAR(3)                                YES     MUL     'USD'
cost_allocation_type     ENUM('manual'                             YES             'manual'
                              'calculated'
                              'allocated')
```

#### Hierarchy Levels (5-tier structure):

1. **product** (Level 1): Complete final product or system
2. **machine_line** (Level 2): Major process lines or facilities
3. **subprocess** (Level 3): Sub-activities within a machine line
4. **operation** (Level 4): Individual operations or process steps
5. **elemental_task** (Level 5): Lowest level tasks (rarely used)

#### Cost Fields:
- `opex`: Operating expenditure
- `capex`: Capital expenditure
- `labor_cost`: Direct labor costs
- `energy_cost`: Energy/fuel costs
- `transportation_cost`: Logistics costs
- `material_cost`: Raw material costs
- `equipment_cost`: Equipment/machinery costs
- `overhead_cost`: Indirect overhead

#### Sample Component (Project 10):
```json
{
  "component_id": 2000,
  "case_id": 21,
  "parent_component_id": null,
  "component_name": "Petroleum Jelly 3oz",
  "component_type": "product",
  "hierarchy_level": 1,
  "quantity": "1.000000",
  "unit": "unit",
  "description": "Complete petroleum jelly product",
  "opex": "12.00",
  "labor_cost": "1.00",
  "energy_cost": "34.00",
  "currency": "USD",
  "cost_allocation_type": "calculated"
}
```

---

### 3. flows

Environmental flows and material inputs/outputs through the process system.

#### Column Structure:

```sql
Field                Type                    Null    Key     Default              Extra
──────────────────────────────────────────────────────────────────────────────────────────
flow_id              INT                     NO      PRI     NULL                 auto_increment
component_id         INT                     NO      MUL     NULL
substance_id         INT                     NO      MUL     NULL
flow_type            ENUM('input'            NO      MUL     NULL
                          'output')
quantity             DECIMAL(15,6)           NO              NULL
unit                 VARCHAR(50)             NO              NULL
is_driver            TINYINT(1)              YES     MUL     0
driver_description   TEXT                    YES             NULL
created_at           TIMESTAMP               YES             CURRENT_TIMESTAMP
updated_at           TIMESTAMP               YES             CURRENT_TIMESTAMP
```

#### Flow Types:
- **input**: Resources entering the process (materials, energy)
- **output**: Products or emissions leaving the process

#### Key Concepts:
- `is_driver` flag (1 = yes, 0 = no) marks flows that are key drivers for environmental impact
- Each flow connects a component to a substance with a quantity and unit
- Driver flows are used in sensitivity analysis and cost allocation

#### Sample Flows (Project 10):
```json
[
  {
    "flow_id": 1906,
    "component_id": 211011,
    "substance_id": 1,
    "flow_type": "input",
    "quantity": "0.083333",
    "unit": "kWh",
    "is_driver": 1,
    "driver_description": "Electricity consumption"
  },
  {
    "flow_id": 1907,
    "component_id": 211011,
    "substance_id": 2,
    "flow_type": "output",
    "quantity": "0.033333",
    "unit": "kg",
    "is_driver": 1,
    "driver_description": "CO2 from electricity"
  }
]
```

---

### 4. substances

The substance database - materials, resources, and environmental emissions.

#### Column Structure:

```sql
Field              Type                                      Null    Key     Default              Extra
──────────────────────────────────────────────────────────────────────────────────────────────────────
substance_id       INT                                       NO      PRI     NULL                 auto_increment
substance_name     VARCHAR(200)                              NO      UNI     NULL
cas_number         VARCHAR(50)                               YES             NULL
category           ENUM('resource'                           NO      MUL     NULL
                        'emission_air'
                        'emission_water'
                        'emission_soil'
                        'waste')
unit               VARCHAR(50)                               NO              NULL
description        TEXT                                      YES             NULL
created_at         TIMESTAMP                                 YES             CURRENT_TIMESTAMP
```

#### Categories:
- **resource**: Raw materials, energy, water
- **emission_air**: Atmospheric emissions
- **emission_water**: Water discharge and aquatic emissions
- **emission_soil**: Soil contamination
- **waste**: Solid waste streams

#### Sample Substances (Extracted):
```json
[
  {"substance_id": 1, "substance_name": "Carbon Dioxide", "cas_number": "124-38-9", "category": "emission_air", "unit": "kg"},
  {"substance_id": 2, "substance_name": "Methane", "cas_number": "74-82-8", "category": "emission_air", "unit": "kg"},
  {"substance_id": 3, "substance_name": "Nitrous Oxide", "cas_number": "10024-97-2", "category": "emission_air", "unit": "kg"},
  {"substance_id": 4, "substance_name": "Sulfur Dioxide", "cas_number": "7446-09-5", "category": "emission_air", "unit": "kg"},
  {"substance_id": 5, "substance_name": "Nitrogen Oxides", "cas_number": "11104-93-1", "category": "emission_air", "unit": "kg"},
  {"substance_id": 6, "substance_name": "Particulate Matter (PM2.5)", "cas_number": "N/A", "category": "emission_air", "unit": "kg"},
  {"substance_id": 7, "substance_name": "Electricity", "cas_number": "N/A", "category": "resource", "unit": "kWh"},
  {"substance_id": 8, "substance_name": "Water", "cas_number": "7732-18-5", "category": "resource", "unit": "liter"},
  {"substance_id": 9, "substance_name": "Crude Oil", "cas_number": "8002-05-9", "category": "resource", "unit": "kg"},
  {"substance_id": 10, "substance_name": "Natural Gas", "cas_number": "8006-14-2", "category": "resource", "unit": "m3"}
]
```

---

### 5. assessment_runs

Tracks assessment calculation runs and their results.

#### Column Structure:

```sql
Field                Type           Null    Key     Default              Extra
─────────────────────────────────────────────────────────────────────────────
run_id               INT            NO      PRI     NULL                 auto_increment
case_id              INT            NO      MUL     NULL
run_name             VARCHAR(100)   YES             NULL
run_date             TIMESTAMP      YES     MUL     CURRENT_TIMESTAMP
calculation_method   VARCHAR(100)   YES             'CML 2001'
status               ENUM('running' YES     MUL     'running'
                          'completed'
                          'failed')
error_log            TEXT           YES             NULL
executed_by          INT            NO      MUL     NULL
```

#### Status Values:
- **running**: Assessment calculation in progress
- **completed**: Assessment successfully calculated
- **failed**: Assessment encountered an error

#### Sample Assessment (Project 10):
```json
{
  "run_id": 22,
  "case_id": 21,
  "run_name": "Assessment-2025-11-18T22:31:19.088Z",
  "run_date": "2025-11-19T03:31:19.000Z",
  "calculation_method": "CML 2001",
  "status": "completed",
  "executed_by": 1
}
```

---

## MSWT Project Structure (project_id = 12)

The SQL script creates a complete MSWT project with the following structure:

### Cases Created:

1. **Case ID 31**: MSWT Landfill Disposal Base Case
   - Root product component: "MSW Treatment System - Landfill"
   - Collection and Transportation machine line
   - Landfill Operations machine line
   - Multiple sub-processes and operations

2. **Case ID 32**: MSWT Incineration with Energy Recovery (Comparative)
   - Root product component: "MSW Treatment System - Incineration"
   - Collection and Transportation machine line
   - Incineration Facility machine line
   - Energy recovery subprocess
   - Air pollution control subprocess

3. **Case ID 33**: MSWT Recycling and Composting (Comparative)
   - Alternative scenario with source separation

### Component Hierarchy Example (Landfill):

```
MSW Treatment System - Landfill (product, level 1)
├── Waste Collection and Transportation (machine_line, level 2)
│   ├── Curbside Collection (subprocess, level 3)
│   │   ├── Truck Loading Operations (operation, level 4)
│   │   └── Truck Fuel Consumption (operation, level 4)
│   ├── Transfer Station Operations (subprocess, level 3)
│   └── Transportation to Landfill (subprocess, level 3)
└── Landfill Operations (machine_line, level 2)
    ├── Waste Reception and Spreading (subprocess, level 3)
    ├── Soil Cover Application (subprocess, level 3)
    ├── Leachate Management (subprocess, level 3)
    └── Landfill Gas Management (subprocess, level 3)
        └── Landfill Gas Flaring (operation, level 4)
```

### Flows Included:

- **Collection Truck Fuel**: Diesel input → CO2 output
- **Landfill Gas Flaring**: CH4 flaring → CO2 output
- **Leachate Generation**: Water output
- **Incineration Combustion**: Complete combustion → CO2, NOx, SO2 outputs
- **Energy Recovery**: Electricity generated (credit)

### Cost Allocation:

Each component includes cost breakdowns:
- OPEX (Operating Expenditure)
- Labor, Energy, Material, Equipment, Transportation costs
- Currency support (USD for MSWT)
- Cost allocation types: manual, calculated, or allocated

---

## Data Insertion Guide

### Order of Operations:

1. **Create case_table entries** - Establish base case and comparative scenarios
2. **Create component hierarchy** - Build process tree structure
3. **Add flows** - Connect substances to components with quantities
4. **Update costs** - Populate cost fields for components
5. **Create assessment_runs** - Log assessment calculations

### SQL Script Sections:

```sql
STEP 1: Create Base Cases for MSWT Project
         │
         ├─→ case_table (INSERT)
         │
STEP 2: Create Process Hierarchy for Landfill Base Case
         │
         ├─→ component (INSERT) - Product level
         ├─→ component (INSERT) - Machine/Line level
         ├─→ component (INSERT) - Subprocess level
         ├─→ component (INSERT) - Operation level
         │
STEP 3: Add Environmental Flows for Landfill Base Case
         │
         ├─→ flows (INSERT)
         │
STEP 4: Add Cost Data for Components
         │
         ├─→ component (UPDATE) - Set cost fields
         │
STEP 5: Create Comparative Case - Incineration
         │
         ├─→ component (INSERT) - All hierarchy levels for incineration
         │
STEP 6: Create Assessment Runs
         │
         └─→ assessment_runs (INSERT)
```

---

## Important Constraints and Notes

### Foreign Key Relationships:

- `component.case_id` → `case_table.case_id`
- `component.parent_component_id` → `component.component_id` (self-referencing)
- `flows.component_id` → `component.component_id`
- `flows.substance_id` → `substances.substance_id`
- `assessment_runs.case_id` → `case_table.case_id`

### Data Validation:

1. **component_type** must be one of: product, machine_line, subprocess, operation, elemental_task
2. **hierarchy_level** should be 1-5 in ascending order
3. **cost_allocation_type** must be: manual, calculated, or allocated
4. **flow_type** must be: input or output
5. **substance category** must be one of: resource, emission_air, emission_water, emission_soil, waste
6. **assessment status** must be: running, completed, or failed

### Performance Considerations:

- Index on `case_id` (component, flows, assessment_runs)
- Index on `component_id` (flows)
- Index on `substance_id` (flows)
- Index on `opex` for cost analysis queries
- Index on `run_date` for temporal analysis

---

## Verification Queries

The SQL script includes verification queries to check:

1. **Case Table Summary**: Shows all cases for project 12
2. **Component Hierarchy**: Displays indented tree structure
3. **Cost Summary**: Total opex by component
4. **Environmental Flows**: All flows with substance names
5. **Assessment Summary**: All assessment runs
6. **Data Summary**: Count statistics

---

## Usage in Application Code

### Example: Querying Component Hierarchy

```sql
SELECT
  CONCAT(REPEAT('  ', (hierarchy_level - 1)), component_name) as hierarchy,
  component_type, component_id, hierarchy_level, opex
FROM component
WHERE case_id = 31
ORDER BY component_id;
```

### Example: Environmental Impact Analysis

```sql
SELECT
  c.component_name,
  s.substance_name,
  s.category,
  f.flow_type,
  f.quantity,
  f.unit
FROM flows f
JOIN component c ON f.component_id = c.component_id
JOIN substances s ON f.substance_id = s.substance_id
WHERE c.case_id = 31
  AND f.is_driver = 1
  AND s.category LIKE 'emission_%'
ORDER BY s.category, f.quantity DESC;
```

### Example: Cost Analysis by Level

```sql
SELECT
  hierarchy_level,
  component_type,
  COUNT(*) as count,
  SUM(opex) as total_opex,
  AVG(opex) as avg_opex
FROM component
WHERE case_id = 31 AND opex IS NOT NULL
GROUP BY hierarchy_level, component_type
ORDER BY hierarchy_level;
```

---

## Additional Resources

- **Database Connection File**: `/lib/db.ts`
- **Setup Script**: `/mswt-project-setup.sql`
- **API Documentation**: `/API_DOCUMENTATION.md`

---

*Last Updated: 2025-12-03*
*Schema Version: 1.0*
*Based on: Project 10 (Petroleum Jelly) - LCA v3 Database*

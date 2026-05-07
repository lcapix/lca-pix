# ENUM Field Data Dictionary - LCA Project v3

**Document Purpose:** Complete reference for all ENUM fields in the database schema
**Created:** 2025-01-19
**Status:** Official Reference for Development & QA

---

## Table of Contents
1. [Account Table](#account-table)
2. [Case Table](#case-table)
3. [Component Table](#component-table)
4. [Substances Table](#substances-table)
5. [Flows Table](#flows-table)
6. [Audit Log Table](#audit-log-table)

---

## Account Table

### `account_type` ENUM

**Field:** `account.account_type`
**Default Value:** `'user'`
**Required:** Yes (NOT NULL)

| Value | Description | Permissions |
|-------|-------------|-------------|
| `user` | Standard user account | Can create projects, collaborate with teams, run assessments |
| `admin` | System administrator | All user permissions + platform-wide management, user administration |

**Usage Notes:**
- Most users should be `'user'` type
- Only create `'admin'` accounts for platform administrators
- Admin accounts have access to all projects (for support/audit purposes)
- Cannot be NULL - every account must have a type

**Example:**
```sql
-- Create standard user
INSERT INTO account (username, email, password_hash, account_type)
VALUES ('john_doe', 'john@example.com', '$2b$10$...', 'user');

-- Create admin user
INSERT INTO account (username, email, password_hash, account_type)
VALUES ('admin_user', 'admin@lcapix.com', '$2b$10$...', 'admin');
```

---

## Case Table

### `case_type` ENUM

**Field:** `case_table.case_type`
**Required:** Yes (NOT NULL)

| Value | Description | Usage |
|-------|-------------|-------|
| `base` | Baseline/reference scenario | The "current state" or standard configuration. **Each project must have exactly ONE base case.** |
| `comparative` | Alternative scenario | Variations for comparison against the base case. **Can have multiple comparative cases per project.** |

**Business Rules:**
- ✅ **Requirement:** Every project MUST have exactly 1 `base` case
- ✅ **Allowed:** Multiple `comparative` cases per project
- ✅ **Use Case:** Compare different scenarios (e.g., renewable vs fossil energy)

**Example Scenarios:**
```
Project: Electric Vehicle Manufacturing

├─ Case 1: "Baseline Production - 2025" (base)
│  └─ Uses coal-based grid electricity
│
├─ Case 2: "Renewable Energy Scenario" (comparative)
│  └─ Uses 100% renewable electricity
│
└─ Case 3: "Efficiency Improvements" (comparative)
   └─ Optimized manufacturing process
```

**Example:**
```sql
-- Create base case (required)
INSERT INTO case_table (project_id, case_name, case_type)
VALUES (1, 'Current Production Process', 'base');

-- Create comparative cases (optional)
INSERT INTO case_table (project_id, case_name, case_type)
VALUES (1, 'Renewable Energy Alternative', 'comparative');
```

---

## Component Table

### `component_type` ENUM

**Field:** `component.component_type`
**Required:** Yes (NOT NULL)

| Value | Hierarchy Level | Description | Parent Type | Can Have Children? |
|-------|----------------|-------------|-------------|-------------------|
| `product` | Level 1 (Root) | Final product or system being analyzed | None (parent_id = NULL) | ✅ Yes (`machine` only) |
| `machine` | Level 2 | Manufacturing machine or production line | `product` | ✅ Yes (`subprocess` only) |
| `subprocess` | Level 3 | Process or subprocess within a machine | `machine` | ✅ Yes (`operation` only) |
| `operation` | Level 4 | Unit operation or process step | `subprocess` | ✅ Yes (`elemental` only) |
| `elemental` | Level 5 (Leaf) | Elementary task - where flows are attached | `operation` | ❌ No (leaf node) |

**Hierarchy Rules:**
```
Product (Level 1 - Root)
  └─ Machine (Level 2)
      └─ Subprocess (Level 3)
          └─ Operation (Level 4)
              └─ Elemental Task (Level 5 - Leaf)
                  └─ [Flows attach here]
```

**Important Notes:**
- ⚠️ **Only `elemental` type components can have flows (inputs/outputs)**
- ⚠️ **`product` type MUST have `parent_id = NULL`** (enforced by CHECK constraint)
- ⚠️ **Each type can only have specific parent types** (enforced by application logic)

**Real-World Example:**
```
Component 1: EV Battery Pack (60 kWh)          [product]
  └─ Component 2: Cell Assembly Line           [machine]
      └─ Component 3: Electrode Coating        [subprocess]
          └─ Component 4: Drying Operation     [operation]
              └─ Component 5: Oven Heating     [elemental] ← Flows attached here
                  ├─ INPUT: Electricity (250.5 kWh)
                  ├─ OUTPUT: CO₂ (125.25 kg)
                  └─ OUTPUT: CH₄ (2.5 kg)
```

**Example:**
```sql
-- Create 5-level hierarchy
INSERT INTO component (case_id, component_name, component_type, parent_id) VALUES
(1, 'Metal Bucket Product', 'product', NULL),         -- Level 1 (root)
(1, 'Manufacturing Line', 'machine', 1),               -- Level 2
(1, 'Body Manufacturing', 'subprocess', 2),            -- Level 3
(1, 'Metal Stamping', 'operation', 3),                 -- Level 4
(1, 'Electricity Consumption', 'elemental', 4);        -- Level 5 (leaf)
```

---

## Substances Table

### `category` ENUM

**Field:** `substances.category`
**Required:** Yes (NOT NULL)

| Value | Description | Examples | Typical Direction |
|-------|-------------|----------|------------------|
| `material` | Raw materials and physical resources | Steel, Aluminum, Plastic, Concrete, Copper | INPUT |
| `energy` | Energy resources | Electricity, Natural Gas, Coal, Diesel, Gasoline | INPUT |
| `emission` | Air and water emissions | CO₂, NOₓ, SO₂, CH₄, Wastewater, VOCs | OUTPUT |
| `waste` | Solid waste streams | Hazardous waste, Scrap metal, Municipal waste | OUTPUT |
| `water` | Water consumption and discharge | Process water, Cooling water, Wastewater | INPUT or OUTPUT |

**Usage Guidelines:**
- **`material`:** Physical resources consumed in production
- **`energy`:** All forms of energy (electricity, fuels, etc.)
- **`emission`:** Environmental releases to air or water
- **`waste`:** Solid waste requiring disposal or recycling
- **`water`:** Separate category due to special regulatory requirements

**Example:**
```sql
INSERT INTO substances (substance_name, category, default_unit) VALUES
('Steel', 'material', 'kg'),
('Electricity', 'energy', 'kWh'),
('Carbon Dioxide (CO₂)', 'emission', 'kg'),
('Solid Waste', 'waste', 'kg'),
('Process Water', 'water', 'm³');
```

---

## Flows Table

### `direction` ENUM

**Field:** `flows.direction`
**Required:** Yes (NOT NULL)

| Value | Description | Examples | Impact Calculation |
|-------|-------------|----------|-------------------|
| `input` | Resources consumed by the process | Electricity, Steel, Water, Natural Gas | Resource depletion impacts |
| `output` | Products or emissions produced | CO₂, Products, Wastewater, Heat | Environmental impact characterization |

**Flow Direction Rules:**
- **INPUT flows:** Resources going INTO the process (consumption)
- **OUTPUT flows:** Materials/emissions coming OUT of the process (production/emissions)

**Driver Flow Identification:**
- ✅ **Driver flows:** Primary inputs/outputs that scale with production (marked for impact calculations)
- ⚠️ **Non-driver flows:** Secondary flows that don't scale directly

**Example for an "Oven Heating" elemental task:**
```sql
-- INPUT flows (resources consumed)
INSERT INTO flows (component_id, substance_id, direction, amount, unit) VALUES
(5, 7, 'input', 250.5, 'kWh'),    -- Electricity (DRIVER)
(5, 8, 'input', 15.0, 'm³');       -- Water (non-driver)

-- OUTPUT flows (emissions produced)
INSERT INTO flows (component_id, substance_id, direction, amount, unit) VALUES
(5, 1, 'output', 125.25, 'kg'),    -- CO₂ (DRIVER)
(5, 2, 'output', 2.5, 'kg');       -- CH₄ (DRIVER)
```

**Impact Calculation:**
- **INPUT flows:** Used for resource depletion calculations (e.g., ADP - Abiotic Depletion Potential)
- **OUTPUT flows:** Used for environmental impact calculations (e.g., GWP - Global Warming Potential)

---

## Audit Log Table

### `action` ENUM

**Field:** `audit_log.action`
**Required:** Yes (NOT NULL)

| Value | Description | When Triggered | old_values | new_values |
|-------|-------------|---------------|-----------|-----------|
| `CREATE` | New record inserted | INSERT operation | NULL | ✅ Full new record |
| `UPDATE` | Existing record modified | UPDATE operation | ✅ Before state | ✅ After state |
| `DELETE` | Record removed | DELETE operation | ✅ Deleted record | NULL |

**Audit Trail Purpose:**
- ✅ **Regulatory Compliance:** ISO 14040/14044 requires documentation of LCA methodology changes
- ✅ **Data Integrity:** Track who changed what and when
- ✅ **Debugging:** Investigate unexpected behavior or data corruption
- ✅ **Accountability:** User activity monitoring for security

**JSON Structure for `old_values` and `new_values`:**
```json
{
  "field_name": "old_value_or_new_value",
  "updated_at": "2025-01-19T10:30:00Z"
}
```

**Example:**
```sql
-- CREATE action
INSERT INTO audit_log (table_name, record_id, action, changed_by, new_values) VALUES
('component', 123, 'CREATE', 5, '{"component_name": "New Process", "component_type": "elemental"}');

-- UPDATE action
INSERT INTO audit_log (table_name, record_id, action, changed_by, old_values, new_values) VALUES
('component', 123, 'UPDATE', 5,
  '{"driver_amount": 100.0}',
  '{"driver_amount": 150.0}');

-- DELETE action
INSERT INTO audit_log (table_name, record_id, action, changed_by, old_values) VALUES
('component', 123, 'DELETE', 5, '{"component_name": "Obsolete Process", "component_type": "elemental"}');
```

---

## Validation Summary

### Application-Level Validation Checklist

When inserting/updating records, ensure:

**Account:**
- ✅ `account_type` is one of: `'user'`, `'admin'`
- ✅ Email matches regex: `^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}$`

**Case:**
- ✅ `case_type` is one of: `'base'`, `'comparative'`
- ✅ Only ONE `base` case per project

**Component:**
- ✅ `component_type` is one of: `'product'`, `'machine'`, `'subprocess'`, `'operation'`, `'elemental'`
- ✅ `product` type has `parent_id = NULL`
- ✅ Other types have valid `parent_id` referencing correct parent type

**Substances:**
- ✅ `category` is one of: `'material'`, `'energy'`, `'emission'`, `'waste'`, `'water'`

**Flows:**
- ✅ `direction` is one of: `'input'`, `'output'`
- ✅ Only attached to `elemental` type components

**Audit Log:**
- ✅ `action` is one of: `'CREATE'`, `'UPDATE'`, `'DELETE'`

---

## TypeScript Type Definitions

For frontend/backend type safety, use these TypeScript types:

```typescript
// Account types
export type AccountType = 'user' | 'admin';

// Case types
export type CaseType = 'base' | 'comparative';

// Component types
export type ComponentType = 'product' | 'machine' | 'subprocess' | 'operation' | 'elemental';

// Substance categories
export type SubstanceCategory = 'material' | 'energy' | 'emission' | 'waste' | 'water';

// Flow directions
export type FlowDirection = 'input' | 'output';

// Audit actions
export type AuditAction = 'CREATE' | 'UPDATE' | 'DELETE';

// Complete hierarchy level mapping
export const HIERARCHY_LEVELS: Record<ComponentType, number> = {
  product: 1,
  machine: 2,
  subprocess: 3,
  operation: 4,
  elemental: 5,
};

// Parent-child relationships
export const VALID_PARENT_TYPES: Record<ComponentType, ComponentType | null> = {
  product: null,            // Products have no parent
  machine: 'product',       // Machines belong to products
  subprocess: 'machine',    // Subprocesses belong to machines
  operation: 'subprocess',  // Operations belong to subprocesses
  elemental: 'operation',   // Elemental tasks belong to operations
};
```

---

## Change Log

| Date | Version | Changes | Author |
|------|---------|---------|--------|
| 2025-01-19 | 1.0 | Initial creation based on PM Khushi feedback | Development Team |

---

**End of Document**

# MSWT Project Setup - Complete Documentation Index

**Project**: Municipal Solid Waste Treatment (MSWT) LCA Analysis
**Project ID**: 12
**Database**: lca_v3 (127.0.0.1:3307)
**Created**: 2025-12-03

---

## Quick Start

### 1. Execute the SQL Setup Script

```bash
mysql -h 127.0.0.1 -P 3307 -u lcaadmin -p'EP76017fLefZ8?d!ezTHsN[kA()X' \
  lca_v3 < mswt-project-setup.sql
```

### 2. Verify Installation

```sql
-- Check cases created
SELECT COUNT(*) FROM case_table WHERE project_id = 12;
-- Expected: 3

-- Check components created
SELECT COUNT(*) FROM component
WHERE case_id IN (SELECT case_id FROM case_table WHERE project_id = 12);
-- Expected: 43

-- Check flows created
SELECT COUNT(*) FROM flows
WHERE component_id IN (
  SELECT component_id FROM component
  WHERE case_id IN (SELECT case_id FROM case_table WHERE project_id = 12)
);
-- Expected: 22
```

### 3. Start Using the Project

- View Landfill case: case_id = 31
- View Incineration case: case_id = 32
- View Recycling case: case_id = 33

---

## Documentation Files

### Main Implementation File

**File**: `mswt-project-setup.sql`
**Size**: ~800 lines
**Purpose**: Complete SQL script to set up MSWT project

**What it does**:
- Creates 3 cases (31, 32, 33)
- Inserts 43 components with full hierarchy
- Adds 22 environmental flows
- Sets up complete cost allocation
- Creates assessment runs

### Comprehensive Schema Guide

**File**: `MSWT_SCHEMA_GUIDE.md`
**Size**: ~400 lines
**Purpose**: Complete reference for database schema

**Best for**:
- Understanding the complete schema
- Learning table relationships
- Writing custom queries
- Extending the system

### Quick Reference Guide

**File**: `MSWT_SQL_QUICK_REFERENCE.md`
**Size**: ~350 lines
**Purpose**: Practical guide for implementation and troubleshooting

**Best for**:
- First-time setup
- Running the script
- Modifying data
- Troubleshooting errors

### Detailed Extraction Report

**File**: `EXTRACTED_SCHEMA_COMPARISON.md`
**Size**: ~600 lines
**Purpose**: Detailed comparison of source (Project 10) to target (Project 12)

**Best for**:
- Understanding data relationships
- Seeing actual data examples
- Learning what exists in the database
- Validating data integrity

### Project Summary & Overview

**File**: `SCHEMA_EXTRACTION_SUMMARY.md`
**Size**: ~500 lines
**Purpose**: High-level overview of the entire project setup

**Best for**:
- Getting an overview
- Understanding what was created
- Seeing summary statistics
- Planning next steps

---

## Document Selection Guide

### I want to...

**...set up the MSWT project quickly**
→ Use: `mswt-project-setup.sql` (execute directly)

**...understand the database schema**
→ Read: `MSWT_SCHEMA_GUIDE.md`

**...run the script and verify it**
→ Read: `MSWT_SQL_QUICK_REFERENCE.md`

**...see actual data from the database**
→ Read: `EXTRACTED_SCHEMA_COMPARISON.md`

**...get a high-level overview**
→ Read: `SCHEMA_EXTRACTION_SUMMARY.md`

---

## Key Statistics

### Record Counts
| Category | Count |
|----------|-------|
| Cases | 3 |
| Components | 43 |
| Flows | 22 |
| Assessment Runs | 2 |
| Substances Used | 10 |

### Cost Distribution
| Category | Amount |
|----------|--------|
| Total OPEX | $755.50 |
| Labor Costs | $158.50 |
| Energy Costs | $99.00 |
| Equipment Costs | $115.00 |

### Cases
| Case ID | Name | Type | Parent | Components |
|---------|------|------|--------|------------|
| 31 | Landfill | base | NULL | 21 |
| 32 | Incineration | comparative | 31 | 18 |
| 33 | Recycling | comparative | 31 | 4 |

---

## Database Credentials

```
Host:     127.0.0.1
Port:     3307
Database: lca_v3
User:     lcaadmin
Password: EP76017fLefZ8?d!ezTHsN[kA()X
```

---

## Implementation Workflow

### Step 1: Review Documentation
- [ ] Read `SCHEMA_EXTRACTION_SUMMARY.md` for overview

### Step 2: Execute Setup
- [ ] Run `mswt-project-setup.sql` script
- [ ] Check for execution errors

### Step 3: Verify
- [ ] Query case_table for 3 cases
- [ ] Query component for 43 records
- [ ] Query flows for 22 records

### Step 4: Use
- [ ] Run LCA calculations
- [ ] Compare Landfill vs Incineration
- [ ] Analyze environmental impacts

---

## File Locations

All files are located in:
```
/Users/kavishpandit/Desktop/lca/lca project v3/
```

---

## Common Queries

### Get All MSWT Cases
```sql
SELECT * FROM case_table WHERE project_id = 12;
```

### Get Component Hierarchy
```sql
SELECT
  CONCAT(REPEAT('  ', (hierarchy_level - 1)), component_name) as hierarchy,
  component_type, opex
FROM component
WHERE case_id = 31
ORDER BY component_id;
```

### Compare Cases
```sql
SELECT
  component_type,
  COUNT(*) as count,
  SUM(opex) as total_opex
FROM component
WHERE case_id IN (31, 32)
GROUP BY component_type;
```

---

*Last Updated: 2025-12-03*
*Database: lca_v3*
*Project: MSWT (Project ID 12)*
*Status: Ready for Use*

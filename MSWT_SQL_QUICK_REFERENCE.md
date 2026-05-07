# MSWT SQL Script - Quick Reference Guide

## Script Overview

The `mswt-project-setup.sql` script creates a complete Municipal Solid Waste Treatment (MSWT) project structure with test data for project_id = 12.

**File Location**: `/Users/kavishpandit/Desktop/lca/lca project v3/mswt-project-setup.sql`

---

## What the Script Creates

### 3 Complete Cases:
- **Case 31**: Landfill Disposal (Base Case)
- **Case 32**: Incineration with Energy Recovery (Comparative)
- **Case 33**: Recycling and Composting (Comparative)

### 40+ Components across cases
- Product level (system root)
- Machine lines (collection, landfill operations, incineration facility)
- Sub-processes (14+ different processes)
- Operations (individual steps and tasks)

### 20+ Environmental Flows
- Input flows: diesel, water, electricity
- Output flows: CO2, methane, NOx, SO2
- Driver flows marked for impact calculation

### Complete Cost Data
- OPEX (Operating Expenditure)
- Labor costs
- Energy costs
- Material costs
- Equipment costs
- Overhead costs
- Transportation costs

### Assessment Runs
- Baseline assessment for landfill case
- Comparative assessment for incineration case

---

## Key Tables Modified

| Table | Records Inserted |
|-------|-----------------|
| case_table | 3 cases |
| component | 43 components |
| flows | 22 flows |
| assessment_runs | 2 runs |

---

## Data Structure Examples

### Case Hierarchy:

```
Case 31: MSWT Landfill Disposal Base Case (project_id = 12)
├─ Product: MSW Treatment System - Landfill
│  ├─ Machine Line: Waste Collection and Transportation
│  │  ├─ Subprocess: Curbside Collection
│  │  │  ├─ Operation: Truck Loading Operations
│  │  │  └─ Operation: Truck Fuel Consumption
│  │  ├─ Subprocess: Transfer Station Operations
│  │  └─ Subprocess: Transportation to Landfill
│  └─ Machine Line: Landfill Operations
│     ├─ Subprocess: Waste Reception and Spreading
│     ├─ Subprocess: Soil Cover Application
│     ├─ Subprocess: Leachate Management
│     └─ Subprocess: Landfill Gas Management
│        └─ Operation: Landfill Gas Flaring
```

### Cost Allocation Example:

```
Waste Collection and Transportation (Machine Line) = $45.00
├─ Labor Cost: $22.50 (50%)
├─ Energy Cost: $15.00 (33%)
└─ Transportation Cost: $7.50 (17%)

Landfill Operations (Machine Line) = $65.00
├─ Labor Cost: $20.00 (31%)
├─ Equipment Cost: $25.00 (38%)
└─ Overhead Cost: $20.00 (31%)
```

### Environmental Flows Example:

```
Component: Truck Fuel Consumption
├─ INPUT: 0.25 liters Diesel per kg MSW
├─ OUTPUT: 0.75 kg CO2 from diesel combustion per kg MSW
└─ Flag: is_driver = 1 (key environmental driver)

Component: Landfill Gas Flaring
├─ OUTPUT: 0.05 kg CH4 flared per kg MSW
├─ OUTPUT: 0.02 kg CO2 from flaring per kg MSW
└─ Flag: is_driver = 1 (key environmental driver)
```

---

## Important Notes

### Variable Assignments Used:

The script uses MySQL variables to manage auto-incremented IDs:

```sql
SET @collection_id = LAST_INSERT_ID();           -- Stores the last inserted component_id
SET @incineration_product = LAST_INSERT_ID();    -- Resets for new table insert
SET @fuel_consumption = LAST_INSERT_ID();        -- Stores operation component
```

**Why?** Components are inserted with `NULL` for `component_id` (auto-increment), so we use variables to store the generated IDs and use them as `parent_component_id` for child components.

### Substance IDs:

The script assumes these substances already exist in the database:
- 1 = Carbon Dioxide (CO2)
- 2 = Methane (CH4)
- 3 = Nitrous Oxide (N2O)
- 4 = Sulfur Dioxide (SO2)
- 5 = Nitrogen Oxides (NOx)
- 6 = Particulate Matter (PM2.5)
- 7 = Electricity
- 8 = Water
- 9 = Crude Oil
- 10 = Natural Gas

If substances don't exist, add them first:

```sql
INSERT INTO substances (substance_name, cas_number, category, unit)
VALUES ('Diesel', 'N/A', 'resource', 'liter');
```

### Currency:

All MSWT project costs are in USD. Change if needed:

```sql
-- Update before running script
UPDATE component SET currency = 'EUR' WHERE case_id IN (31, 32, 33);
```

---

## Running the Script

### Via MySQL Command Line:

```bash
mysql -h 127.0.0.1 -P 3307 -u lcaadmin -p'EP76017fLefZ8?d!ezTHsN[kA()X' lca_v3 < mswt-project-setup.sql
```

### Via MySQL Client (Windows/Mac):

```bash
# Mac Terminal or Windows PowerShell
mysql -h 127.0.0.1 \
  -P 3307 \
  -u lcaadmin \
  -p'EP76017fLefZ8?d!ezTHsN[kA()X' \
  lca_v3 < /path/to/mswt-project-setup.sql
```

### Via Node.js:

```javascript
const connection = await pool.getConnection();
const sql = fs.readFileSync('mswt-project-setup.sql', 'utf8');
await connection.query(sql);
connection.release();
```

---

## Verification After Running

### Check Cases Created:

```sql
SELECT * FROM case_table WHERE project_id = 12;
-- Expected: 3 rows (landfill, incineration, recycling)
```

### Check Component Count:

```sql
SELECT COUNT(*) as total_components
FROM component
WHERE case_id IN (SELECT case_id FROM case_table WHERE project_id = 12);
-- Expected: 43 components
```

### Check Cost Data:

```sql
SELECT
  SUM(opex) as total_opex,
  COUNT(*) as components_with_cost
FROM component
WHERE case_id = 31 AND opex IS NOT NULL;
-- Expected: total_opex = $240.00, components_with_cost = 8
```

### Check Flows:

```sql
SELECT COUNT(*) as total_flows
FROM flows
WHERE component_id IN (
  SELECT component_id FROM component
  WHERE case_id IN (SELECT case_id FROM case_table WHERE project_id = 12)
);
-- Expected: 22 flows
```

### Check Assessments:

```sql
SELECT * FROM assessment_runs
WHERE case_id IN (SELECT case_id FROM case_table WHERE project_id = 12);
-- Expected: 2 assessment runs
```

---

## Modifying the Script for Your Needs

### Change Project ID:

Find and replace `project_id = 12` with your desired project ID:

```sql
-- OLD:
INSERT INTO case_table (project_id, ...) VALUES (12, ...);

-- NEW:
INSERT INTO case_table (project_id, ...) VALUES (13, ...); -- Your project ID
```

### Change Currency:

Replace `'USD'` with your currency code:

```sql
-- OLD:
currency = 'USD'

-- NEW:
currency = 'EUR'  -- or 'GBP', 'CNY', etc.
```

### Change Cost Values:

Modify specific OPEX amounts:

```sql
-- OLD:
opex = 45.00,

-- NEW:
opex = 55.00,  -- Your updated cost
```

### Add New Substances:

Before running the main script, add missing substances:

```sql
INSERT INTO substances (substance_name, cas_number, category, unit)
VALUES
  ('Diesel', 'N/A', 'resource', 'liter'),
  ('Aluminum', '7429-90-5', 'resource', 'kg'),
  ('Glass', 'N/A', 'resource', 'kg');
```

### Add New Flows:

Add flows to existing components:

```sql
INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
VALUES
  (2100, 9, 'input', 0.05, 'kg', 1, 'Petroleum wax input per unit'),
  (2100, 2, 'output', 0.02, 'kg', 1, 'Methane emissions per unit');
```

---

## Data Validation Checklist

Before running in production, verify:

- [ ] All substance IDs exist in `substances` table
- [ ] No duplicate case names within project 12
- [ ] All component types are valid (product, machine_line, subprocess, operation, elemental_task)
- [ ] Hierarchy levels are correct (1-5)
- [ ] Cost values are realistic for your analysis
- [ ] Currency codes are valid (ISO 4217)
- [ ] Flow quantities are scientifically plausible
- [ ] Driver components are correctly marked (is_driver = 1)

---

## Common Issues and Solutions

### Issue: "Duplicate entry for key 'substance_name'"

**Cause**: Substance already exists in the database

**Solution**: Check existing substances first:
```sql
SELECT * FROM substances WHERE substance_name IN ('Carbon Dioxide', 'Methane', ...);
```

### Issue: "Cannot add or update a child row: a foreign key constraint fails"

**Cause**: Referenced component_id or case_id doesn't exist

**Solution**: Ensure parent records are inserted first:
```sql
-- Check case exists
SELECT * FROM case_table WHERE case_id = 31;

-- Check component exists
SELECT * FROM component WHERE component_id = 2000;
```

### Issue: "Duplicate entry for key 'case_table_project_id_case_name'"

**Cause**: Case name is not unique within the project

**Solution**: Use different case names:
```sql
-- OLD: "MSWT Landfill Disposal Base Case"
-- NEW: "Landfill Scenario - Municipal"
```

### Issue: Assessment runs show NULL for executed_by

**Cause**: User_id doesn't exist

**Solution**: Check valid user IDs:
```sql
SELECT user_id FROM users LIMIT 1;
-- Update executed_by to a valid user_id
```

---

## Performance Tips

1. **Disable foreign key checks during bulk insert** (if needed):
```sql
SET FOREIGN_KEY_CHECKS = 0;
-- Run script
SET FOREIGN_KEY_CHECKS = 1;
```

2. **Use transactions for consistency**:
```sql
START TRANSACTION;
-- Run script
COMMIT;
-- Or ROLLBACK; if errors occur
```

3. **Create indexes after bulk insert**:
```sql
ALTER TABLE component ADD INDEX idx_case_id (case_id);
ALTER TABLE flows ADD INDEX idx_component_id (component_id);
```

---

## Backup Before Running

Always backup your database:

```bash
# Create backup
mysqldump -h 127.0.0.1 -P 3307 -u lcaadmin -p'EP76017fLefZ8?d!ezTHsN[kA()X' \
  lca_v3 > lca_v3_backup_$(date +%Y%m%d_%H%M%S).sql

# Restore if needed
mysql -h 127.0.0.1 -P 3307 -u lcaadmin -p'EP76017fLefZ8?d!ezTHsN[kA()X' \
  lca_v3 < lca_v3_backup_20251203_120000.sql
```

---

## Related Documentation

- **Complete Schema Guide**: `MSWT_SCHEMA_GUIDE.md`
- **Database Connection**: `lib/db.ts`
- **API Documentation**: `API_DOCUMENTATION.md`
- **Project Structure**: `README.md`

---

*Last Updated: 2025-12-03*
*Version: 1.0*
*Script File: /Users/kavishpandit/Desktop/lca/lca project v3/mswt-project-setup.sql*

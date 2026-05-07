# Database Recovery Instructions

## Overview

This guide provides step-by-step instructions to restore the accidentally deleted Electric Vehicle Manufacturing project and clean up redundant data in the LCA v3 database.

## What Happened

During the Nutroleum project creation process, the original Electric Vehicle Manufacturing project (Project ID 1) was accidentally deleted along with duplicate test projects. This restoration process will:

1. ✅ Restore the complete EV Manufacturing project with **new IDs** (Project ID: 7, Case IDs: 14-16)
2. ✅ Keep the Nutroleum project intact (Project ID: 6, Case IDs: 12-13)
3. ✅ Preserve john_doe account credentials
4. ✅ Remove any orphaned/redundant data safely
5. ✅ Verify database integrity

---

## Files Included

This recovery package includes 4 SQL scripts:

1. **`restore-ev-project.sql`** - Restores the Electric Vehicle Manufacturing project
2. **`cleanup-redundant-data.sql`** - Removes orphaned data safely
3. **`verify-database-integrity.sql`** - Comprehensive verification queries
4. **`RECOVERY_INSTRUCTIONS.md`** - This file

---

## Prerequisites

### Required Access
- Database: `lca_v3`
- Host: `127.0.0.1:3307` (SSH tunnel to RDS)
- User: `lcaadmin`
- Password: Available in environment or connection scripts

### SSH Tunnel Setup
Ensure your SSH tunnel to the RDS database is active:

```bash
# Check if tunnel is running
lsof -ti:3307

# If not running, start the tunnel
# (Refer to your existing tunnel setup scripts)
```

### Database Client Options
You can execute these scripts using any of these tools:

- **TablePlus** (GUI - Recommended for beginners)
- **MySQL Workbench** (GUI)
- **mysql CLI** (Command line)
- **Node.js script** (Programmatic)

---

## Recovery Process

### **STEP 1: Backup Current Database** ⚠️ CRITICAL

Before making any changes, create a backup of the current database state:

```bash
# Using mysqldump via SSH tunnel
mysqldump -h 127.0.0.1 -P 3307 -u lcaadmin -p lca_v3 > lca_v3_backup_$(date +%Y%m%d_%H%M%S).sql

# Or use TablePlus: Database → Export → SQL Dump
```

**DO NOT PROCEED** without a backup!

---

### **STEP 2: Restore Electric Vehicle Project**

This script creates a complete EV Manufacturing project with realistic data.

#### Option A: Using TablePlus (Recommended)

1. Open TablePlus
2. Connect to `lca_v3` database (127.0.0.1:3307)
3. Click **"SQL"** button or press **Cmd+E** (Mac) / **Ctrl+E** (Windows)
4. Click **"Open File"** and select `restore-ev-project.sql`
5. Review the script content
6. Click **"Run Current"** or press **Cmd+Return**
7. Wait for completion (~15-30 seconds)
8. Check for errors in the output panel

#### Option B: Using mysql CLI

```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"

mysql -h 127.0.0.1 -P 3307 -u lcaadmin -p lca_v3 < restore-ev-project.sql
```

Enter password when prompted.

#### What Gets Created

- **Project ID:** 7
- **Project Name:** Electric Vehicle Manufacturing
- **Cases:** 3 (IDs 14, 15, 16)
  - Case 14: Baseline Production - 2025 (coal grid, 125.25 kg CO₂)
  - Case 15: Renewable Energy Scenario (5.0 kg CO₂, 96% reduction)
  - Case 16: Solar-Powered Production (7.8 kg CO₂, 94% reduction)
- **Components:** 15 (5 per case, full 5-level hierarchy)
- **Environmental Flows:** 6 (2 per elemental task showing emission differences)
- **ABC Costing:** Complete cost data for all 15 components
- **Assessment Runs:** 3 (one per case)
- **Assessment Results:** 15 (5 impact categories × 3 cases)

#### Expected Output

```sql
Query OK, 1 row affected (0.02 sec)
Query OK, 1 row affected (0.01 sec)
Query OK, 1 row affected (0.01 sec)
...
[Multiple "Query OK" messages for all INSERT/UPDATE statements]
```

If you see **errors**, STOP and check:
- Database connection is active
- No conflicts with existing IDs (shouldn't happen with fresh IDs)
- SSH tunnel is working

---

### **STEP 3: Clean Up Redundant Data**

This script safely removes orphaned records while protecting valid data.

#### ⚠️ IMPORTANT: Review Before Running

Open `cleanup-redundant-data.sql` and review the DELETE statements. The script includes safety checks and will:

- ✅ **PROTECT** john_doe account (john@lcaproject.com)
- ✅ **PROTECT** Admin account (ID 1)
- ✅ **PROTECT** Nutroleum project (ID 6) and cases (12, 13)
- ✅ **PROTECT** EV project (ID 7) and cases (14, 15, 16)
- ❌ **DELETE** orphaned flows (components that don't exist)
- ❌ **DELETE** orphaned assessment results
- ❌ **DELETE** orphaned components (invalid parent references)
- ❌ **DELETE** invalid projects with no cases

#### Execution (TablePlus)

1. Open TablePlus
2. Connect to `lca_v3` database
3. Load `cleanup-redundant-data.sql`
4. Review the DELETE statements carefully
5. Run the script
6. Review the output showing deletion counts

#### Execution (mysql CLI)

```bash
mysql -h 127.0.0.1 -P 3307 -u lcaadmin -p lca_v3 < cleanup-redundant-data.sql
```

#### Expected Output

```
+---------------------------------------+
| step                                  |
+---------------------------------------+
| Checking john_doe account...          |
+---------------------------------------+

[Account verification results]

+---------------------------------------+
| Deleting orphaned flows...            |
+---------------------------------------+

[Deletion counts for each type of orphaned record]

[Final verification showing protected data intact]
```

**If large numbers of records are deleted unexpectedly, STOP and restore from backup!**

---

### **STEP 4: Verify Database Integrity**

Run comprehensive verification to confirm everything is correct.

#### Execution (TablePlus)

1. Open TablePlus
2. Connect to `lca_v3` database
3. Load `verify-database-integrity.sql`
4. Run the script
5. Review all output sections carefully

#### Execution (mysql CLI)

```bash
mysql -h 127.0.0.1 -P 3307 -u lcaadmin -p lca_v3 < verify-database-integrity.sql
```

#### What to Check

The verification script includes 10 sections:

1. **User Accounts** - Confirm john_doe and admin exist
2. **Projects** - Should show 2 projects (IDs 6 and 7)
3. **Cases** - Should show 5 cases total (2 for Nutroleum, 3 for EV)
4. **Components** - Should show 263 total (248 Nutroleum + 15 EV)
5. **Environmental Flows** - Should show 366 total (360 Nutroleum + 6 EV)
6. **ABC Costing** - All components should have cost data
7. **Assessment Runs** - Should show 5 runs (2 Nutroleum + 3 EV)
8. **Assessment Results** - Check emission reduction (96% for renewable)
9. **Referential Integrity** - All foreign keys valid
10. **Summary** - All checks should show **PASS** status

#### Expected Summary Output

```
+----------------------------------+-------+--------+
| check_type                       | count | status |
+----------------------------------+-------+--------+
| Orphaned Cases                   |     0 | PASS   |
| Orphaned Components              |     0 | PASS   |
| Orphaned Flows                   |     0 | PASS   |
| Orphaned Assessment Runs         |     0 | PASS   |
| Orphaned Assessment Results      |     0 | PASS   |
| Broken Parent References         |     0 | PASS   |
+----------------------------------+-------+--------+

+-------------------------------+--------+--------+
| metric                        | actual | status |
+-------------------------------+--------+--------+
| Users (Expected: 2+)          |      2 | PASS   |
| Projects (Expected: 2)        |      2 | PASS   |
| Cases (Expected: 5)           |      5 | PASS   |
| Components (Expected: 263)    |    263 | PASS   |
| Flows (Expected: 366)         |    366 | PASS   |
| Assessment Runs (Expected: 5) |      5 | PASS   |
+-------------------------------+--------+--------+
```

**If any checks show FAIL, review the detailed output above to identify issues.**

---

### **STEP 5: Verify in Application**

After successful database recovery, verify the projects appear correctly in the web application.

#### 5.1 Refresh Browser

```
1. Navigate to: http://localhost:3002/home
2. Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
3. Or clear browser cache completely
```

#### 5.2 Expected Home Page View

You should see **2 projects** in the project list:

1. **Electric Vehicle Manufacturing**
   - Description: Comparative LCA of EV battery production scenarios
   - Click to open

2. **Nutroleum vs Vaseline - Petroleum Jelly Manufacturing LCA**
   - Description: Plant-based vs petroleum comparison
   - Click to open

#### 5.3 Verify EV Project Navigation

Click on "Electric Vehicle Manufacturing" → Should navigate to:
```
http://localhost:3002/project/7
```

You should see:
- **3 case tabs** (blue for Base, purple for Comparative 1 & 2)
- **Case 1 (BASE):** Baseline Production - 2025
- **Case 2 (COMPARATIVE):** Renewable Energy Scenario
- **Case 3 (COMPARATIVE):** Solar-Powered Production
- Component count: 5 components per case
- Buttons: "View Tree", "View Analytics", "Compare Cases"

#### 5.4 Verify Tree Visualization

Click **"View Tree"** → Should show:
- **5-level hierarchy** per case
- Color-coded component types:
  - Pink/Red = Product
  - Orange = Machine/Line
  - Yellow = Subprocess
  - Blue = Operation
  - Purple = Elemental Task
- Expandable/collapsible nodes

#### 5.5 Verify Environmental Flows

Navigate to an elemental task component → Environmental Flows tab:
- **Baseline Case (coal):** 147.15 kWh input → 125.25 kg CO₂ output
- **Renewable Case:** 147.15 kWh input → 5.0 kg CO₂ output (96% reduction)
- **Solar Case:** 147.15 kWh input → 7.8 kg CO₂ output (94% reduction)

#### 5.6 Verify Analytics

Click **"View Analytics"** → Should show:
- Impact visualizations for selected case
- Bar charts, pie charts, radar charts
- 5 impact categories with values
- **Global Warming** should show dramatic difference between cases

#### 5.7 Verify Nutroleum Project Still Works

Navigate back to home → Click "Nutroleum vs Vaseline" → Should show:
- 2 cases (Nutroleum base, Vaseline comparative)
- 124 components per case
- Full tree visualization
- ABC costing intact
- Environmental flows intact

---

## Troubleshooting

### Issue: "Duplicate entry for key 'PRIMARY'"

**Cause:** IDs 7, 14-16, or component IDs 500-514 already exist in database.

**Solution:**
1. Check existing projects: `SELECT project_id FROM project WHERE project_id = 7;`
2. If Project 7 exists, either:
   - Delete it first: `DELETE FROM project WHERE project_id = 7;`
   - Or edit the SQL script to use different IDs (e.g., 8, 17-19, 600-614)

### Issue: "Cannot add or update a child row: foreign key constraint fails"

**Cause:** Parent record doesn't exist (e.g., user_id 1 doesn't exist).

**Solution:**
1. Verify admin user exists: `SELECT * FROM users WHERE user_id = 1;`
2. If not, create admin user first or change owner_id in SQL script

### Issue: "Table doesn't exist" or "Unknown column"

**Cause:** Database schema doesn't match expected structure.

**Solution:**
1. Verify you're connected to correct database: `SELECT DATABASE();`
2. Check table structure: `DESCRIBE component;`
3. Compare with script expectations

### Issue: Projects don't appear in UI after running SQL

**Cause:** Browser cache showing old data.

**Solution:**
1. Hard refresh: Cmd+Shift+R or Ctrl+Shift+R
2. Clear browser cache completely
3. Open in incognito/private window
4. Check browser console (F12) for errors

### Issue: Navigation click not working

**Cause:** JavaScript error or routing issue.

**Solution:**
1. Open browser console (F12)
2. Look for error messages
3. Try direct URL: `http://localhost:3002/project/7`
4. Ensure dev server is running on port 3002
5. Check terminal for Next.js errors

### Issue: Verification shows orphaned records

**Cause:** Cleanup script didn't run completely or foreign keys disabled.

**Solution:**
1. Check foreign key status: `SHOW VARIABLES LIKE 'foreign_key_checks';`
2. Re-run cleanup script
3. Manually delete orphaned records identified in verification

---

## Rollback Procedure

If something goes wrong, restore from the backup created in Step 1:

### Option A: Using mysql CLI

```bash
# Drop current database
mysql -h 127.0.0.1 -P 3307 -u lcaadmin -p -e "DROP DATABASE lca_v3;"

# Recreate database
mysql -h 127.0.0.1 -P 3307 -u lcaadmin -p -e "CREATE DATABASE lca_v3;"

# Restore from backup
mysql -h 127.0.0.1 -P 3307 -u lcaadmin -p lca_v3 < lca_v3_backup_YYYYMMDD_HHMMSS.sql
```

### Option B: Using TablePlus

1. Connect to RDS instance
2. Right-click `lca_v3` database → Delete
3. Right-click server → Create Database → Name: `lca_v3`
4. Database → Import → Select backup SQL file
5. Wait for import to complete

---

## Post-Recovery Checklist

After completing all steps, verify:

- [ ] Backup file created and accessible
- [ ] `restore-ev-project.sql` executed successfully
- [ ] `cleanup-redundant-data.sql` executed successfully
- [ ] `verify-database-integrity.sql` shows all PASS status
- [ ] 2 projects visible in home page
- [ ] EV project opens correctly (3 cases, 5 components per case)
- [ ] Nutroleum project still works (2 cases, 124 components per case)
- [ ] Tree visualization displays correctly for both projects
- [ ] Environmental flows show correct emission values
- [ ] ABC costing data visible
- [ ] Analytics dashboard works
- [ ] john_doe account still accessible (john@lcaproject.com)
- [ ] No console errors in browser

---

## Database Summary After Recovery

### Projects (2 total)

| ID | Name | Cases | Components |
|----|------|-------|------------|
| 6 | Nutroleum vs Vaseline | 2 | 248 |
| 7 | Electric Vehicle Manufacturing | 3 | 15 |

### Cases (5 total)

| ID | Project | Name | Type | Components |
|----|---------|------|------|------------|
| 12 | Nutroleum | Nutroleum - Plant-Based Jelly | BASE | 124 |
| 13 | Nutroleum | Vaseline - Petroleum Jelly | COMPARATIVE | 124 |
| 14 | EV | Baseline Production - 2025 | BASE | 5 |
| 15 | EV | Renewable Energy Scenario | COMPARATIVE | 5 |
| 16 | EV | Solar-Powered Production | COMPARATIVE | 5 |

### Data Totals

- **Components:** 263 (248 Nutroleum + 15 EV)
- **Environmental Flows:** 366 (360 Nutroleum + 6 EV)
- **Assessment Runs:** 5 (2 Nutroleum + 3 EV)
- **Assessment Results:** 15+ (5 categories × 3 EV cases, Nutroleum calculated in UI)

---

## Key Emission Values (EV Project)

Demonstrates 96% emission reduction through renewable energy:

| Case | Energy Source | CO₂ Emissions | Reduction |
|------|---------------|---------------|-----------|
| Baseline | Coal grid | 125.25 kg | Baseline |
| Renewable | Wind/hydro/solar | 5.0 kg | **96%** |
| Solar | On-site PV | 7.8 kg | **94%** |

---

## Support

If you encounter issues not covered in this guide:

1. **Check verification output** - The `verify-database-integrity.sql` script provides detailed diagnostics
2. **Review cleanup output** - Check what was deleted in `cleanup-redundant-data.sql` output
3. **Check application logs** - Look at Next.js terminal output for errors
4. **Browser console** - Check for JavaScript errors (F12)
5. **Database logs** - Check RDS logs if available
6. **Restore from backup** - Use rollback procedure if needed

---

## Files Reference

All recovery files are located in:
```
/Users/kavishpandit/Desktop/lca/lca project v3/
```

- `restore-ev-project.sql` - Main restoration script
- `cleanup-redundant-data.sql` - Data cleanup script
- `verify-database-integrity.sql` - Verification queries
- `RECOVERY_INSTRUCTIONS.md` - This file
- `DATABASE_CLEANUP_COMPLETE.md` - Documentation of what was deleted
- `NUTROLEUM_LOAD_SUCCESS.md` - Nutroleum project details

---

## Summary

This recovery process:

1. ✅ Restores complete Electric Vehicle Manufacturing project
2. ✅ Maintains Nutroleum vs Vaseline project integrity
3. ✅ Preserves all user accounts (john_doe, admin)
4. ✅ Removes orphaned/redundant data safely
5. ✅ Provides comprehensive verification
6. ✅ Includes rollback capability

**Estimated Time:** 15-30 minutes (including verification)

**Risk Level:** Low (with backup created first)

**Status:** Ready for execution

---

*Document Created: November 13, 2025*
*Database: lca_v3*
*Recovery Package Version: 1.0*

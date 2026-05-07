# How to Load Nutroleum vs Vaseline Test Project

## Quick Start

### Step 1: Set Database Password
```bash
export DB_PASSWORD="your_rds_password_here"
```

### Step 2: Run the Loader Script
```bash
cd "/Users/kavishpandit/Desktop/lca/lca project v3"
node load-nutroleum-project.js
```

### Step 3: Verify in Application
1. Start the Next.js dev server: `npm run dev`
2. Navigate to `http://localhost:3000/home`
3. You should see: "Nutroleum vs Vaseline - Petroleum Jelly Manufacturing LCA"

## What Gets Created

### Project Structure
- **1 Project**: "Nutroleum vs Vaseline - Petroleum Jelly Manufacturing LCA"
- **2 Cases**:
  - Base: Nutroleum (plant-based)
  - Comparative: Vaseline (petroleum-based)

### Component Hierarchy (Per Case)
```
Level 1: Product (1)
Level 2: Machine Lines (3)
Level 3: Subprocesses (12)
Level 4: Operations (36)
Level 5: Elemental Tasks (72)
─────────────────────────────
Total per case: 124 components
Total both cases: 248 components
```

### Data Included
- ✅ Full 5-level process hierarchy
- ✅ ABC costing data (Capex, Opex, Labor, Energy, Transport, Material, Equipment, Overhead)
- ✅ Environmental flows (inputs/outputs at elemental task level)
- ✅ Assessment runs (2 completed assessments)
- ✅ Sample results for key impact categories

## Expected Output

When you run the script, you should see:

```
======================================================================
NUTROLEUM VS VASELINE - TEST DATA LOADER
======================================================================

📡 Connecting to database...
✓ Connected to database

🏗️  Creating project...
✓ Project created (ID: X)

📋 Creating cases...
✓ Nutroleum case created (ID: X)
✓ Vaseline case created (ID: X)

🌳 Building Nutroleum hierarchy...
✓ Created 124 Nutroleum components

🌳 Building Vaseline hierarchy...
✓ Created 124 Vaseline components

💰 Adding ABC costing data...
✓ ABC costing added to all components

🌍 Adding environmental flows...
✓ Added 288 environmental flows

📊 Creating assessment runs...
✓ Assessment runs created

======================================================================
✅ COMPLETE! Test project loaded successfully
======================================================================

Project Summary:
  • Project ID: X
  • Cases: 2 (Base + Comparative)
  • Components: 248
  • Flows: 288
  • Assessments: 2 runs
```

## Verifying the Data

### 1. Check Project List
Navigate to `/home` - you should see the new project in the list.

### 2. View Case Details
Click on the project → You should see both cases with their color-coded tabs:
- **Blue** = Nutroleum (Base)
- **Purple** = Vaseline (Comparative)

### 3. Explore Tree Visualization
Click "View Tree" → You should see:
- 5 levels of hierarchy
- Color-coded component types
- Full tree structure with all 124 components per case

### 4. Check ABC Costing
Click on any component → Details tab → You should see:
- Capex and Opex values
- Breakdown of costs (Labor, Energy, Transport, Material, Equipment, Overhead)
- Currency (USD)

### 5. View Environmental Flows
Navigate to an elemental task component → Environmental Flows tab:
- Input flows (electricity, water, materials)
- Output flows (CO2, emissions, waste)
- Quantities and units

### 6. Check Analytics
Click "View Analytics" button:
- Should show data for selected case
- Bar charts, pie charts, radar charts
- Impact categories with values

### 7. Test Comparison
Navigate to Comparison page:
- Should show Nutroleum vs Vaseline comparison
- Side-by-side impact values
- % difference calculations

## Troubleshooting

### Error: "DB_PASSWORD environment variable not set"
**Solution:** Export the password before running:
```bash
export DB_PASSWORD="your_password"
```

### Error: "Cannot find module 'mysql2/promise'"
**Solution:** Install dependencies:
```bash
npm install mysql2
```

### Error: "Connection timeout" or "ECONNREFUSED"
**Solution:** Check:
1. RDS instance is running
2. Security group allows your IP
3. Database host/port are correct

### Error: "Duplicate entry" or "already exists"
**Solution:** The project may already exist. Either:
1. Delete it from the database first
2. Modify the script to use unique project names

### No data appears in UI
**Solution:** Check:
1. Database connection successful
2. Script completed without errors
3. Refresh the page (Ctrl+R or Cmd+R)
4. Clear browser cache
5. Check browser console for errors

## Advanced Options

### Customize Project Name
Edit `load-nutroleum-project.js`, line 209:
```javascript
'Nutroleum vs Vaseline - Petroleum Jelly Manufacturing LCA - v2'
```

### Adjust ABC Costs
Edit the `ABC_COSTS` object (lines 133-175) to change cost values.

### Modify Hierarchy
Edit `NUTROLEUM_HIERARCHY` and `VASELINE_HIERARCHY` objects to add/remove components.

### Change Environmental Flows
Modify the `addEnvironmentalFlows()` function (lines 455-491) to adjust flow types and quantities.

## Database Direct Access (Alternative)

If you prefer to use SQL directly instead of the Node.js script:

### Option A: MySQL Command Line
```bash
mysql -h lca-dev-db-small.c55ojm7spphe.us-east-1.rds.amazonaws.com \
      -u admin \
      -p \
      lca_dev < nutroleum-vaseline-test-data.sql
```

### Option B: TablePlus / MySQL Workbench
1. Connect to RDS database
2. Open `nutroleum-vaseline-test-data.sql`
3. Execute the script
4. Verify results

## Performance Notes

- **Execution Time**: ~10-30 seconds depending on network speed
- **Database Writes**: ~500 INSERT statements
- **Memory Usage**: Minimal (<50MB)
- **Network Traffic**: ~500KB

## Cleanup (If Needed)

To remove the test project:

```sql
-- Get the project ID first
SELECT project_id FROM project
WHERE project_name LIKE '%Nutroleum vs Vaseline%';

-- Then delete (cascades to all related data)
DELETE FROM project WHERE project_id = X;
```

**WARNING:** This will delete ALL related data including:
- Cases
- Components
- Flows
- Assessment runs
- Results

## Support

If you encounter issues:

1. **Check logs**: Look for error messages in script output
2. **Verify database**: Ensure RDS is accessible
3. **Test connection**: Try connecting via MySQL client first
4. **Review code**: Check script logic if behavior is unexpected

## Next Steps

After loading the data:

1. ✅ Explore the tree visualization
2. ✅ Review ABC costing data
3. ✅ Check environmental flows
4. ✅ Run analytics on each case
5. ✅ Compare Nutroleum vs Vaseline
6. ✅ Test all application features with realistic data

---

**Questions?** Refer to `NUTROLEUM_PROJECT_README.md` for more details about the project structure and data sources.

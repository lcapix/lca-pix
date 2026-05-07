const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

/**
 * Project 7 Restoration Script - Correct Data
 *
 * Source of Truth: TEST_DATA_SPREADSHEET.md
 * Purpose: Insert correct test data for Electric Vehicle Manufacturing project
 *
 * What this creates:
 * - 2 Cases (Base + Comparative showing 96% CO2 reduction)
 * - 10 Components (5-level hierarchy per case)
 * - 8 Flows (4 per case: electricity, CO2, methane, water)
 * - 2 Assessment Runs (CML 2001 methodology)
 * - 18 Assessment Results (9 per case including multiple GWP entries)
 */

const dbConfig = {
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
};

async function restoreProject7() {
  let connection;

  try {
    console.log('\n' + '='.repeat(80));
    console.log('PROJECT 7 RESTORATION - Correct Data per TEST_DATA_SPREADSHEET.md');
    console.log('='.repeat(80) + '\n');

    // Connect to database
    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database\n');

    // Start transaction
    await connection.beginTransaction();
    console.log('📝 Transaction started\n');

    // Store component IDs for later reference
    const componentIds = {};
    const caseIds = {};

    // ================================================================
    // STEP 1: CREATE CASES
    // ================================================================
    console.log('='.repeat(80));
    console.log('STEP 1: Creating Cases');
    console.log('='.repeat(80) + '\n');

    // Case 1: Baseline Production - 2025
    const [case1Result] = await connection.execute(`
      INSERT INTO case_table (
        project_id, case_name, case_type, description
      ) VALUES (
        7,
        'Baseline Production - 2025',
        'base',
        'Current state with coal-based grid electricity'
      )
    `);
    caseIds.case1 = case1Result.insertId;
    console.log(`✓ Case 1 created: "Baseline Production - 2025" (ID: ${caseIds.case1})`);

    // Case 2: Renewable Energy Scenario
    const [case2Result] = await connection.execute(`
      INSERT INTO case_table (
        project_id, case_name, case_type, parent_case_id, description
      ) VALUES (
        7,
        'Renewable Energy Scenario',
        'comparative',
        ?,
        'Same production with 100% renewable electricity'
      )
    `, [caseIds.case1]);
    caseIds.case2 = case2Result.insertId;
    console.log(`✓ Case 2 created: "Renewable Energy Scenario" (ID: ${caseIds.case2})`);
    console.log('\n✅ Created 2 cases\n');

    // ================================================================
    // STEP 2: CREATE COMPONENT HIERARCHY FOR CASE 1
    // ================================================================
    console.log('='.repeat(80));
    console.log('STEP 2: Creating Component Hierarchy for Case 1 (Coal-Based)');
    console.log('='.repeat(80) + '\n');

    // Level 1: Product
    const [prod1] = await connection.execute(`
      INSERT INTO component (
        case_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, ?, 'product', 1, 1.0, 'unit', ?)
    `, [
      caseIds.case1,
      'EV Battery Pack (60 kWh)',
      'Complete lithium-ion battery pack for electric vehicle'
    ]);
    componentIds.case1_product = prod1.insertId;
    console.log(`  ✓ Level 1 (Product): EV Battery Pack (ID: ${componentIds.case1_product})`);

    // Level 2: Machine Line
    const [mach1] = await connection.execute(`
      INSERT INTO component (
        case_id, parent_component_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, ?, ?, 'machine_line', 2, 1.0, 'line', ?)
    `, [
      caseIds.case1,
      componentIds.case1_product,
      'Cell Assembly Line',
      'Automated assembly line for battery cell manufacturing'
    ]);
    componentIds.case1_machine = mach1.insertId;
    console.log(`  ✓ Level 2 (Machine/Line): Cell Assembly Line (ID: ${componentIds.case1_machine})`);

    // Level 3: Subprocess
    const [sub1] = await connection.execute(`
      INSERT INTO component (
        case_id, parent_component_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, ?, ?, 'subprocess', 3, 1.0, 'batch', ?)
    `, [
      caseIds.case1,
      componentIds.case1_machine,
      'Electrode Coating Process',
      'Process for coating battery electrodes with active materials'
    ]);
    componentIds.case1_subprocess = sub1.insertId;
    console.log(`  ✓ Level 3 (Subprocess): Electrode Coating Process (ID: ${componentIds.case1_subprocess})`);

    // Level 4: Operation
    const [op1] = await connection.execute(`
      INSERT INTO component (
        case_id, parent_component_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, ?, ?, 'operation', 4, 1.0, 'cycle', ?)
    `, [
      caseIds.case1,
      componentIds.case1_subprocess,
      'Drying Operation',
      'High temperature drying operation for coated electrodes'
    ]);
    componentIds.case1_operation = op1.insertId;
    console.log(`  ✓ Level 4 (Operation): Drying Operation (ID: ${componentIds.case1_operation})`);

    // Level 5: Elemental Task
    const [task1] = await connection.execute(`
      INSERT INTO component (
        case_id, parent_component_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, ?, ?, 'elemental_task', 5, 1.0, 'task', ?)
    `, [
      caseIds.case1,
      componentIds.case1_operation,
      'Oven Heating Task',
      'Electric heating in industrial oven powered by coal-based grid electricity'
    ]);
    componentIds.case1_task = task1.insertId;
    console.log(`  ✓ Level 5 (Elemental Task): Oven Heating Task (ID: ${componentIds.case1_task})`);

    console.log('\n✅ Created 5 components for Case 1\n');

    // ================================================================
    // STEP 3: CREATE FLOWS FOR CASE 1
    // ================================================================
    console.log('='.repeat(80));
    console.log('STEP 3: Creating Environmental Flows for Case 1');
    console.log('='.repeat(80) + '\n');

    // Flow 1: Electricity INPUT
    await connection.execute(`
      INSERT INTO flows (
        component_id, substance_id, flow_type, quantity, unit,
        is_driver, driver_description
      ) VALUES (?, 7, 'input', 250.5, 'kWh', 1, ?)
    `, [componentIds.case1_task, 'Electric energy consumption for oven heating']);
    console.log('  ✓ Electricity INPUT: 250.5 kWh');

    // Flow 2: CO2 OUTPUT
    await connection.execute(`
      INSERT INTO flows (
        component_id, substance_id, flow_type, quantity, unit,
        is_driver, driver_description
      ) VALUES (?, 1, 'output', 125.25, 'kg', 1, ?)
    `, [componentIds.case1_task, 'CO₂ emissions from coal-based electricity generation']);
    console.log('  ✓ CO₂ OUTPUT: 125.25 kg');

    // Flow 3: Methane OUTPUT
    await connection.execute(`
      INSERT INTO flows (
        component_id, substance_id, flow_type, quantity, unit,
        is_driver, driver_description
      ) VALUES (?, 2, 'output', 2.5, 'kg', 1, ?)
    `, [componentIds.case1_task, 'Methane emissions from coal mining and combustion']);
    console.log('  ✓ Methane OUTPUT: 2.5 kg');

    // Flow 4: Water INPUT
    await connection.execute(`
      INSERT INTO flows (
        component_id, substance_id, flow_type, quantity, unit,
        is_driver, driver_description
      ) VALUES (?, 8, 'input', 15.0, 'm³', 0, ?)
    `, [componentIds.case1_task, 'Process cooling water']);
    console.log('  ✓ Water INPUT: 15.0 m³ (non-driver)');

    console.log('\n✅ Created 4 flows for Case 1\n');

    // ================================================================
    // STEP 4: CREATE COMPONENT HIERARCHY FOR CASE 2
    // ================================================================
    console.log('='.repeat(80));
    console.log('STEP 4: Creating Component Hierarchy for Case 2 (Renewable Energy)');
    console.log('='.repeat(80) + '\n');

    // Level 1: Product
    const [prod2] = await connection.execute(`
      INSERT INTO component (
        case_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, ?, 'product', 1, 1.0, 'unit', ?)
    `, [
      caseIds.case2,
      'EV Battery Pack (60 kWh)',
      'Complete lithium-ion battery pack manufactured using renewable energy'
    ]);
    componentIds.case2_product = prod2.insertId;
    console.log(`  ✓ Level 1 (Product): EV Battery Pack (ID: ${componentIds.case2_product})`);

    // Level 2: Machine Line
    const [mach2] = await connection.execute(`
      INSERT INTO component (
        case_id, parent_component_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, ?, ?, 'machine_line', 2, 1.0, 'line', ?)
    `, [
      caseIds.case2,
      componentIds.case2_product,
      'Cell Assembly Line',
      'Automated assembly line powered by 100% renewable energy'
    ]);
    componentIds.case2_machine = mach2.insertId;
    console.log(`  ✓ Level 2 (Machine/Line): Cell Assembly Line (ID: ${componentIds.case2_machine})`);

    // Level 3: Subprocess
    const [sub2] = await connection.execute(`
      INSERT INTO component (
        case_id, parent_component_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, ?, ?, 'subprocess', 3, 1.0, 'batch', ?)
    `, [
      caseIds.case2,
      componentIds.case2_machine,
      'Electrode Coating Process',
      'Process for coating battery electrodes using renewable energy'
    ]);
    componentIds.case2_subprocess = sub2.insertId;
    console.log(`  ✓ Level 3 (Subprocess): Electrode Coating Process (ID: ${componentIds.case2_subprocess})`);

    // Level 4: Operation
    const [op2] = await connection.execute(`
      INSERT INTO component (
        case_id, parent_component_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, ?, ?, 'operation', 4, 1.0, 'cycle', ?)
    `, [
      caseIds.case2,
      componentIds.case2_subprocess,
      'Drying Operation',
      'High temperature drying using renewable electricity'
    ]);
    componentIds.case2_operation = op2.insertId;
    console.log(`  ✓ Level 4 (Operation): Drying Operation (ID: ${componentIds.case2_operation})`);

    // Level 5: Elemental Task
    const [task2] = await connection.execute(`
      INSERT INTO component (
        case_id, parent_component_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, ?, ?, 'elemental_task', 5, 1.0, 'task', ?)
    `, [
      caseIds.case2,
      componentIds.case2_operation,
      'Oven Heating Task',
      'Electric heating powered by 100% renewable energy (solar/wind)'
    ]);
    componentIds.case2_task = task2.insertId;
    console.log(`  ✓ Level 5 (Elemental Task): Oven Heating Task (ID: ${componentIds.case2_task})`);

    console.log('\n✅ Created 5 components for Case 2\n');

    // ================================================================
    // STEP 5: CREATE FLOWS FOR CASE 2
    // ================================================================
    console.log('='.repeat(80));
    console.log('STEP 5: Creating Environmental Flows for Case 2');
    console.log('='.repeat(80) + '\n');

    // Flow 1: Electricity INPUT (same quantity)
    await connection.execute(`
      INSERT INTO flows (
        component_id, substance_id, flow_type, quantity, unit,
        is_driver, driver_description
      ) VALUES (?, 7, 'input', 250.5, 'kWh', 1, ?)
    `, [componentIds.case2_task, 'Electric energy from 100% renewable sources (solar/wind)']);
    console.log('  ✓ Electricity INPUT: 250.5 kWh');

    // Flow 2: CO2 OUTPUT (96% reduction!)
    await connection.execute(`
      INSERT INTO flows (
        component_id, substance_id, flow_type, quantity, unit,
        is_driver, driver_description
      ) VALUES (?, 1, 'output', 5.0, 'kg', 1, ?)
    `, [componentIds.case2_task, 'CO₂ emissions from renewable electricity lifecycle (manufacturing, maintenance)']);
    console.log('  ✓ CO₂ OUTPUT: 5.0 kg (96% reduction from 125.25 kg!)');

    // Flow 3: Methane OUTPUT (96% reduction!)
    await connection.execute(`
      INSERT INTO flows (
        component_id, substance_id, flow_type, quantity, unit,
        is_driver, driver_description
      ) VALUES (?, 2, 'output', 0.1, 'kg', 1, ?)
    `, [componentIds.case2_task, 'Trace methane emissions from renewable energy infrastructure']);
    console.log('  ✓ Methane OUTPUT: 0.1 kg (96% reduction from 2.5 kg!)');

    // Flow 4: Water INPUT (same as Case 1)
    await connection.execute(`
      INSERT INTO flows (
        component_id, substance_id, flow_type, quantity, unit,
        is_driver, driver_description
      ) VALUES (?, 8, 'input', 15.0, 'm³', 0, ?)
    `, [componentIds.case2_task, 'Process cooling water (same for both cases)']);
    console.log('  ✓ Water INPUT: 15.0 m³ (non-driver)');

    console.log('\n✅ Created 4 flows for Case 2\n');

    // ================================================================
    // STEP 6: CREATE ASSESSMENT RUNS
    // ================================================================
    console.log('='.repeat(80));
    console.log('STEP 6: Creating Assessment Runs');
    console.log('='.repeat(80) + '\n');

    // Assessment Run 1 - Case 1
    const [run1] = await connection.execute(`
      INSERT INTO assessment_runs (
        case_id, run_name, calculation_method, status, executed_by
      ) VALUES (?, 'Q1 2025 Baseline Assessment', 'CML 2001', 'completed', 1)
    `, [caseIds.case1]);
    const run1Id = run1.insertId;
    console.log(`✓ Assessment Run 1 created for Case 1 (Run ID: ${run1Id})`);

    // Assessment Run 2 - Case 2
    const [run2] = await connection.execute(`
      INSERT INTO assessment_runs (
        case_id, run_name, calculation_method, status, executed_by
      ) VALUES (?, 'Q1 2025 Renewable Energy Assessment', 'CML 2001', 'completed', 1)
    `, [caseIds.case2]);
    const run2Id = run2.insertId;
    console.log(`✓ Assessment Run 2 created for Case 2 (Run ID: ${run2Id})`);

    console.log('\n✅ Created 2 assessment runs\n');

    // ================================================================
    // STEP 7: CREATE ASSESSMENT RESULTS FOR CASE 1
    // ================================================================
    console.log('='.repeat(80));
    console.log('STEP 7: Creating Assessment Results for Case 1 (Coal-Based)');
    console.log('='.repeat(80) + '\n');

    // Case 1 Results from TEST_DATA_SPREADSHEET.md (pages 122-131)
    const case1Results = [
      { catId: 1, value: 125.25, unit: 'kg CO₂ eq', desc: 'Global Warming from CO₂' },
      { catId: 1, value: 70.00, unit: 'kg CO₂ eq', desc: 'Global Warming from CH₄' },
      { catId: 2, value: 0.0425, unit: 'kg CFC-11 eq', desc: 'Ozone Depletion' },
      { catId: 3, value: 87.675, unit: 'kg SO₂ eq', desc: 'Acidification' },
      { catId: 4, value: 16.275, unit: 'kg PO₄ eq', desc: 'Eutrophication' },
      { catId: 5, value: 3.50, unit: 'kg C₂H₄ eq', desc: 'Photochemical Oxidation' },
      { catId: 6, value: 0.85, unit: 'kg 1,4-DB eq', desc: 'Human Toxicity' },
      { catId: 7, value: 1.25, unit: 'kg 1,4-DB eq', desc: 'Ecotoxicity' },
      { catId: 8, value: 0.001353, unit: 'kg Sb eq', desc: 'Resource Depletion' }
    ];

    for (const result of case1Results) {
      await connection.execute(`
        INSERT INTO assessment_results (
          run_id, component_id, category_id, impact_value, unit
        ) VALUES (?, ?, ?, ?, ?)
      `, [run1Id, componentIds.case1_task, result.catId, result.value, result.unit]);
      console.log(`  ✓ ${result.desc}: ${result.value} ${result.unit}`);
    }

    const totalGWPCase1 = 125.25 + 70.00;
    console.log(`\n  📊 Total Global Warming Impact (Case 1): ${totalGWPCase1} kg CO₂ eq`);
    console.log('\n✅ Created 9 assessment results for Case 1\n');

    // ================================================================
    // STEP 8: CREATE ASSESSMENT RESULTS FOR CASE 2
    // ================================================================
    console.log('='.repeat(80));
    console.log('STEP 8: Creating Assessment Results for Case 2 (Renewable)');
    console.log('='.repeat(80) + '\n');

    // Case 2 Results from TEST_DATA_SPREADSHEET.md (pages 134-145)
    const case2Results = [
      { catId: 1, value: 5.0, unit: 'kg CO₂ eq', desc: 'Global Warming from CO₂' },
      { catId: 1, value: 2.8, unit: 'kg CO₂ eq', desc: 'Global Warming from CH₄' },
      { catId: 2, value: 0.0017, unit: 'kg CFC-11 eq', desc: 'Ozone Depletion' },
      { catId: 3, value: 3.5, unit: 'kg SO₂ eq', desc: 'Acidification' },
      { catId: 4, value: 0.65, unit: 'kg PO₄ eq', desc: 'Eutrophication' },
      { catId: 5, value: 0.14, unit: 'kg C₂H₄ eq', desc: 'Photochemical Oxidation' },
      { catId: 6, value: 0.034, unit: 'kg 1,4-DB eq', desc: 'Human Toxicity' },
      { catId: 7, value: 0.050, unit: 'kg 1,4-DB eq', desc: 'Ecotoxicity' },
      { catId: 8, value: 0.000135, unit: 'kg Sb eq', desc: 'Resource Depletion' }
    ];

    for (const result of case2Results) {
      await connection.execute(`
        INSERT INTO assessment_results (
          run_id, component_id, category_id, impact_value, unit
        ) VALUES (?, ?, ?, ?, ?)
      `, [run2Id, componentIds.case2_task, result.catId, result.value, result.unit]);
      console.log(`  ✓ ${result.desc}: ${result.value} ${result.unit}`);
    }

    const totalGWPCase2 = 5.0 + 2.8;
    const reduction = totalGWPCase1 - totalGWPCase2;
    const reductionPercent = ((reduction / totalGWPCase1) * 100).toFixed(1);

    console.log(`\n  📊 Total Global Warming Impact (Case 2): ${totalGWPCase2} kg CO₂ eq`);
    console.log(`  🌍 Reduction: ${reduction} kg CO₂ eq (${reductionPercent}% decrease)`);
    console.log('\n✅ Created 9 assessment results for Case 2\n');

    // ================================================================
    // COMMIT TRANSACTION
    // ================================================================
    await connection.commit();
    console.log('='.repeat(80));
    console.log('✅ TRANSACTION COMMITTED - All data saved successfully!');
    console.log('='.repeat(80) + '\n');

    // ================================================================
    // FINAL VERIFICATION
    // ================================================================
    console.log('='.repeat(80));
    console.log('FINAL VERIFICATION');
    console.log('='.repeat(80) + '\n');

    const [summary] = await connection.execute(`
      SELECT
        p.project_id,
        p.project_name,
        COUNT(DISTINCT c.case_id) as cases,
        COUNT(DISTINCT comp.component_id) as components,
        COUNT(DISTINCT f.flow_id) as flows,
        COUNT(DISTINCT ar.run_id) as assessment_runs,
        COUNT(DISTINCT res.result_id) as assessment_results
      FROM project p
      LEFT JOIN case_table c ON p.project_id = c.project_id
      LEFT JOIN component comp ON c.case_id = comp.case_id
      LEFT JOIN flows f ON comp.component_id = f.component_id
      LEFT JOIN assessment_runs ar ON c.case_id = ar.case_id
      LEFT JOIN assessment_results res ON ar.run_id = res.run_id
      WHERE p.project_id = 7
      GROUP BY p.project_id, p.project_name
    `);

    console.log('Project 7 - Final State:');
    console.table(summary);

    const [casesDetail] = await connection.execute(`
      SELECT case_id, case_name, case_type
      FROM case_table
      WHERE project_id = 7
      ORDER BY case_id
    `);

    console.log('\nCases Created:');
    console.table(casesDetail);

    // ================================================================
    // SUCCESS SUMMARY
    // ================================================================
    console.log('\n' + '='.repeat(80));
    console.log('✅ SUCCESS! Project 7 Restoration Complete');
    console.log('='.repeat(80));
    console.log('\n📊 Key Results:');
    console.log(`   • Cases: 2 (Baseline + Renewable Comparison)`);
    console.log(`   • Components: 10 (5-level hierarchy per case)`);
    console.log(`   • Flows: 8 (4 per case including electricity, CO₂, CH₄, water)`);
    console.log(`   • Assessment Runs: 2 (CML 2001 methodology)`);
    console.log(`   • Assessment Results: 18 (9 impact values per case)`);
    console.log(`\n🌍 Environmental Impact:`);
    console.log(`   • Coal-Based (Case 1): ${totalGWPCase1} kg CO₂ eq`);
    console.log(`   • Renewable (Case 2): ${totalGWPCase2} kg CO₂ eq`);
    console.log(`   • Reduction: ${reduction} kg CO₂ eq (${reductionPercent}%)`);
    console.log('\n📝 Next Steps:');
    console.log('   1. Hard refresh browser (Cmd+Shift+R)');
    console.log('   2. Navigate to Project 7');
    console.log('   3. Verify tree visualization shows correct hierarchy');
    console.log('   4. Check comparison shows 96% CO₂ reduction');
    console.log('   5. View analytics for all 8 impact categories');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    // Rollback on error
    if (connection) {
      await connection.rollback();
      console.error('\n❌ ERROR - Transaction rolled back:', error.message);
    }
    console.error('\nFull error:', error);
    console.error('\nFatal error:', error.message);
    process.exit(1);
  } finally {
    // Close connection
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed\n');
    }
  }
}

// Run restoration
restoreProject7().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

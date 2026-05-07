const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

const dbConfig = {
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
};

console.log('\n' + '='.repeat(80));
console.log('COMPLETE DATABASE RESTORATION');
console.log('='.repeat(80) + '\n');

async function restoreDatabase() {
  const connection = await mysql.createConnection(dbConfig);

  try {
    console.log('✅ Connected to database\n');

    await connection.beginTransaction();
    console.log('📝 Transaction started\n');

    // ================================================================
    // STEP 1: RESTORE PROJECT 7 COMPONENTS
    // ================================================================
    console.log('='.repeat(80));
    console.log('STEP 1: Restoring Project 7 Components');
    console.log('='.repeat(80) + '\n');

    const cases = [
      { id: 14, name: 'Baseline Production - 2025', type: 'coal', co2: 125.25 },
      { id: 15, name: 'Renewable Energy Scenario', type: 'renewable', co2: 5.0 },
      { id: 16, name: 'Solar-Powered Production', type: 'solar', co2: 7.8 }
    ];

    const componentIds = {};
    let totalComponents = 0;

    for (const caseData of cases) {
      const caseId = caseData.id;
      const caseType = caseData.type;

      console.log(`\nCase ${caseId}: ${caseData.name}`);
      console.log('-'.repeat(60));

      // Level 1: Product (ROOT)
      const [product] = await connection.execute(`
        INSERT INTO component (
          case_id, parent_component_id, component_name, component_type,
          hierarchy_level, quantity, unit, description,
          capex, opex, labor_cost, energy_cost, transportation_cost,
          material_cost, equipment_cost, overhead_cost, currency
        ) VALUES (?, NULL, ?, 'product', 1, 1.0, 'unit', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD')
      `, [
        caseId,
        'EV Battery Pack (60 kWh)',
        `Complete lithium-ion battery pack for electric vehicle. Manufactured using ${caseType} energy source.`,
        caseType === 'solar' ? 1200000 : 1000000, // Higher CAPEX for solar
        caseType === 'solar' ? 2300 : 2500,
        800, 1200, 300, 150, 50, caseType === 'solar' ? 200 : 0
      ]);
      const productId = product.insertId;
      componentIds[`case${caseId}_product`] = productId;
      console.log(`  ✓ Product created (ID: ${productId})`);

      // Level 2: Machine Line
      const [machine] = await connection.execute(`
        INSERT INTO component (
          case_id, parent_component_id, component_name, component_type,
          hierarchy_level, quantity, unit, description,
          capex, opex, labor_cost, energy_cost, transportation_cost,
          material_cost, equipment_cost, overhead_cost, currency
        ) VALUES (?, ?, ?, 'machine_line', 2, 1.0, 'line', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD')
      `, [
        caseId, productId,
        'Cell Assembly Line',
        `Automated production line for lithium-ion cell assembly. Energy: ${caseType} grid.`,
        caseType === 'solar' ? 650000 : 500000,
        caseType === 'solar' ? 7800 : 8500,
        3500, caseType === 'solar' ? 1800 : 2800, 1500, 600, 100, caseType === 'solar' ? 300 : 0
      ]);
      const machineId = machine.insertId;
      componentIds[`case${caseId}_machine`] = machineId;
      console.log(`  ✓ Machine Line created (ID: ${machineId})`);

      // Level 3: Subprocess
      const [subprocess] = await connection.execute(`
        INSERT INTO component (
          case_id, parent_component_id, component_name, component_type,
          hierarchy_level, quantity, unit, description,
          capex, opex, labor_cost, energy_cost, transportation_cost,
          material_cost, equipment_cost, overhead_cost, currency
        ) VALUES (?, ?, ?, 'subprocess', 3, 1.0, 'batch', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD')
      `, [
        caseId, machineId,
        'Electrode Coating Process',
        `Precision coating of active materials onto current collectors. Powered by ${caseType} energy.`,
        caseType === 'solar' ? 180000 : 150000,
        caseType === 'solar' ? 3900 : 4200,
        1800, caseType === 'solar' ? 1200 : 1500, 600, 250, 50, 0
      ]);
      const subprocessId = subprocess.insertId;
      componentIds[`case${caseId}_subprocess`] = subprocessId;
      console.log(`  ✓ Subprocess created (ID: ${subprocessId})`);

      // Level 4: Operation
      const [operation] = await connection.execute(`
        INSERT INTO component (
          case_id, parent_component_id, component_name, component_type,
          hierarchy_level, quantity, unit, description,
          capex, opex, labor_cost, energy_cost, transportation_cost,
          material_cost, equipment_cost, overhead_cost, currency
        ) VALUES (?, ?, ?, 'operation', 4, 1.0, 'cycle', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'USD')
      `, [
        caseId, subprocessId,
        'Drying Operation',
        `High-temperature drying to remove NMP solvent. Powered by ${caseType} electricity.`,
        caseType === 'solar' ? 60000 : 50000,
        caseType === 'solar' ? 1950 : 2100,
        900, caseType === 'solar' ? 680 : 850, 250, 80, 20, caseType === 'solar' ? 20 : 0
      ]);
      const operationId = operation.insertId;
      componentIds[`case${caseId}_operation`] = operationId;
      console.log(`  ✓ Operation created (ID: ${operationId})`);

      // Level 5: Elemental Task
      const [task] = await connection.execute(`
        INSERT INTO component (
          case_id, parent_component_id, component_name, component_type,
          hierarchy_level, quantity, unit, description,
          process_type, driver_category, driver_type,
          capex, opex, labor_cost, energy_cost, transportation_cost,
          material_cost, equipment_cost, overhead_cost, currency
        ) VALUES (?, ?, ?, 'elemental_task', 5, 1.0, 'task', ?, 'elemental_task', 'Energy', 'Electricity (kWh)', ?, ?, ?, ?, ?, ?, ?, ?, 'USD')
      `, [
        caseId, operationId,
        'Oven Heating Task',
        `Electric heating element operation. ${caseType === 'coal' ? 'Coal grid (0.85 kg CO2/kWh)' : caseType === 'renewable' ? 'Renewable grid (0.034 kg CO2/kWh, 96% reduction)' : 'Solar PV (0.053 kg CO2/kWh, 94% reduction)'}.`,
        caseType === 'solar' ? 24000 : 20000,
        caseType === 'solar' ? 975 : 1050,
        450, caseType === 'solar' ? 340 : 425, 125, 40, 10, caseType === 'solar' ? 10 : 0
      ]);
      const taskId = task.insertId;
      componentIds[`case${caseId}_task`] = taskId;
      console.log(`  ✓ Elemental Task created (ID: ${taskId})`);

      totalComponents += 5;
    }

    console.log(`\n✅ Created ${totalComponents} components across 3 cases\n`);

    // ================================================================
    // STEP 2: ADD ENVIRONMENTAL FLOWS
    // ================================================================
    console.log('='.repeat(80));
    console.log('STEP 2: Adding Environmental Flows');
    console.log('='.repeat(80) + '\n');

    let totalFlows = 0;

    for (const caseData of cases) {
      const taskId = componentIds[`case${caseData.id}_task`];
      console.log(`Case ${caseData.id} flows (Component ${taskId}):`);

      // Electricity input
      await connection.execute(`
        INSERT INTO flows (
          component_id, substance_id, flow_type,
          quantity, unit, driver_description, created_at, updated_at
        ) VALUES (?, 7, 'input', 147.15, 'kWh', ?, NOW(), NOW())
      `, [
        taskId,
        `${caseData.type.charAt(0).toUpperCase() + caseData.type.slice(1)} grid electricity for oven heating`
      ]);
      console.log(`  ✓ Electricity input: 147.15 kWh`);

      // CO2 output
      await connection.execute(`
        INSERT INTO flows (
          component_id, substance_id, flow_type,
          quantity, unit, driver_description, created_at, updated_at
        ) VALUES (?, 1, 'output', ?, 'kg', ?, NOW(), NOW())
      `, [
        taskId,
        caseData.co2,
        `CO2 emissions from ${caseData.type} electricity generation`
      ]);
      console.log(`  ✓ CO2 output: ${caseData.co2} kg`);

      totalFlows += 2;
    }

    console.log(`\n✅ Created ${totalFlows} environmental flows\n`);

    // ================================================================
    // STEP 3: CREATE ASSESSMENT RUNS
    // ================================================================
    console.log('='.repeat(80));
    console.log('STEP 3: Creating Assessment Runs');
    console.log('='.repeat(80) + '\n');

    const assessmentRunIds = {};

    // Nutroleum cases
    const nutrolemumCases = [12, 13];
    for (const caseId of nutrolemumCases) {
      const [run] = await connection.execute(`
        INSERT INTO assessment_runs (
          case_id, run_date, calculation_method, status, executed_by
        ) VALUES (?, NOW(), 'TRACI 2.1', 'completed', 1)
      `, [caseId]);
      assessmentRunIds[`case${caseId}`] = run.insertId;
      console.log(`✓ Assessment run created for Case ${caseId} (Run ID: ${run.insertId})`);
    }

    // EV cases
    for (const caseData of cases) {
      const [run] = await connection.execute(`
        INSERT INTO assessment_runs (
          case_id, run_date, calculation_method, status, executed_by
        ) VALUES (?, NOW(), 'TRACI 2.1', 'completed', 1)
      `, [caseData.id]);
      assessmentRunIds[`case${caseData.id}`] = run.insertId;
      console.log(`✓ Assessment run created for Case ${caseData.id} (Run ID: ${run.insertId})`);
    }

    console.log(`\n✅ Created 5 assessment runs\n`);

    // ================================================================
    // STEP 4: ADD ASSESSMENT RESULTS WITH IMPACT CATEGORIES
    // ================================================================
    console.log('='.repeat(80));
    console.log('STEP 4: Adding Assessment Results with Impact Categories');
    console.log('='.repeat(80) + '\n');

    // Impact category mapping
    const impactCategories = [
      { id: 1, name: 'Global Warming', unit: 'kg CO2 eq' },
      { id: 2, name: 'Ozone Depletion', unit: 'kg CFC-11 eq' },
      { id: 3, name: 'Acidification', unit: 'kg SO2 eq' },
      { id: 4, name: 'Eutrophication', unit: 'kg PO4 eq' },
      { id: 5, name: 'Photochemical Oxidation', unit: 'kg C2H4 eq' },
      { id: 6, name: 'Human Toxicity', unit: 'kg 1,4-DB eq' },
      { id: 7, name: 'Ecotoxicity', unit: 'kg 1,4-DB eq' },
      { id: 8, name: 'Resource Depletion', unit: 'kg Sb eq' }
    ];

    let totalResults = 0;

    // Get root component IDs for Nutroleum cases
    const [case12Root] = await connection.execute(
      `SELECT component_id FROM component WHERE case_id = 12 AND parent_component_id IS NULL LIMIT 1`
    );
    const [case13Root] = await connection.execute(
      `SELECT component_id FROM component WHERE case_id = 13 AND parent_component_id IS NULL LIMIT 1`
    );

    const case12ComponentId = case12Root[0]?.component_id || 1;
    const case13ComponentId = case13Root[0]?.component_id || 1;

    // Nutroleum (Case 12) - Plant-based baseline
    console.log('Case 12 (Nutroleum - Plant-Based):');
    for (const cat of impactCategories) {
      const value = cat.id === 1 ? 8.5 : // Lower GWP for plant-based
                    cat.id === 2 ? 0.0000005 :
                    cat.id === 3 ? 0.042 :
                    cat.id === 4 ? 0.018 :
                    cat.id === 5 ? 0.012 :
                    cat.id === 6 ? 0.28 :
                    cat.id === 7 ? 0.35 :
                    0.015; // Resource depletion

      await connection.execute(`
        INSERT INTO assessment_results (
          run_id, component_id, category_id, impact_value, unit
        ) VALUES (?, ?, ?, ?, ?)
      `, [assessmentRunIds.case12, case12ComponentId, cat.id, value, cat.unit]);
      totalResults++;
    }
    console.log('  ✓ 8 results added\n');

    // Vaseline (Case 13) - Petroleum comparative (higher impacts)
    console.log('Case 13 (Vaseline - Petroleum):');
    for (const cat of impactCategories) {
      const value = cat.id === 1 ? 45.2 : // Higher GWP for petroleum
                    cat.id === 2 ? 0.000008 :
                    cat.id === 3 ? 0.285 :
                    cat.id === 4 ? 0.092 :
                    cat.id === 5 ? 0.068 :
                    cat.id === 6 ? 1.85 :
                    cat.id === 7 ? 2.15 :
                    0.125; // Resource depletion

      await connection.execute(`
        INSERT INTO assessment_results (
          run_id, component_id, category_id, impact_value, unit
        ) VALUES (?, ?, ?, ?, ?)
      `, [assessmentRunIds.case13, case13ComponentId, cat.id, value, cat.unit]);
      totalResults++;
    }
    console.log('  ✓ 8 results added\n');

    // EV Cases
    for (const caseData of cases) {
      console.log(`Case ${caseData.id} (${caseData.name}):`);
      const runId = assessmentRunIds[`case${caseData.id}`];

      for (const cat of impactCategories) {
        // Scale other impacts based on CO2 ratio
        const ratio = caseData.co2 / 125.25; // Relative to baseline

        const value = cat.id === 1 ? caseData.co2 : // Actual CO2 value
                      cat.id === 2 ? 0.000012 * ratio :
                      cat.id === 3 ? 0.85 * ratio :
                      cat.id === 4 ? 0.15 * ratio :
                      cat.id === 5 ? 0.08 * ratio :
                      cat.id === 6 ? 0.45 * ratio :
                      cat.id === 7 ? 0.52 * ratio :
                      2.45 * ratio; // Resource depletion

        const productId = componentIds[`case${caseData.id}_product`];
        await connection.execute(`
          INSERT INTO assessment_results (
            run_id, component_id, category_id, impact_value, unit
          ) VALUES (?, ?, ?, ?, ?)
        `, [runId, productId, cat.id, value, cat.unit]);
        totalResults++;
      }
      console.log(`  ✓ 8 results added\n`);
    }

    console.log(`✅ Created ${totalResults} assessment results\n`);

    // ================================================================
    // COMMIT TRANSACTION
    // ================================================================
    await connection.commit();
    console.log('='.repeat(80));
    console.log('✅ TRANSACTION COMMITTED - All changes saved!');
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
        COUNT(DISTINCT ar.run_id) as runs
      FROM project p
      LEFT JOIN case_table c ON p.project_id = c.project_id
      LEFT JOIN component comp ON c.case_id = comp.case_id
      LEFT JOIN flows f ON comp.component_id = f.component_id
      LEFT JOIN assessment_runs ar ON c.case_id = ar.case_id
      GROUP BY p.project_id, p.project_name
      ORDER BY p.project_id
    `);

    console.table(summary);

    console.log('\\n' + '='.repeat(80));
    console.log('🎉 DATABASE RESTORATION COMPLETE!');
    console.log('='.repeat(80));
    console.log('');
    console.log('Summary of additions:');
    console.log(`  - ${totalComponents} components added to Project 7`);
    console.log(`  - ${totalFlows} environmental flows`);
    console.log(`  - 5 assessment runs`);
    console.log(`  - ${totalResults} assessment results`);
    console.log('');
    console.log('Next steps:');
    console.log('  1. Hard refresh browser: Cmd+Shift+R');
    console.log('  2. Click on Project 6 (Nutroleum) - should show tree');
    console.log('  3. Click on Project 7 (EV Manufacturing) - should show tree');
    console.log('  4. View Analytics - should show impact category charts');
    console.log('='.repeat(80) + '\\n');

  } catch (error) {
    await connection.rollback();
    console.error('\n❌ ERROR - Transaction rolled back:', error.message);
    console.error(error);
    throw error;
  } finally {
    await connection.end();
  }
}

restoreDatabase().catch(err => {
  console.error('\\nFatal error:', err.message);
  process.exit(1);
});

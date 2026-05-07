const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

/**
 * PROJECT 1: ELECTRIC VEHICLE MANUFACTURING
 *
 * Simple 5-level hierarchy demonstrating 96% CO2 reduction with renewable energy
 *
 * Structure:
 * - 2 cases (Base: Coal grid, Comparative: Renewable energy)
 * - 5 components per case (one at each level)
 * - 4 flows per case (electricity, CO2, methane, water)
 * - Assessment results showing environmental impact
 */

const dbConfig = {
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
};

async function createProject1() {
  let connection;

  try {
    console.log('\n' + '='.repeat(80));
    console.log('PROJECT 1: ELECTRIC VEHICLE MANUFACTURING');
    console.log('='.repeat(80) + '\n');

    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database\n');

    await connection.beginTransaction();
    console.log('📝 Transaction started\n');

    // ================================================================
    // CREATE PROJECT
    // ================================================================
    console.log('='.repeat(80));
    console.log('Creating Project 1');
    console.log('='.repeat(80) + '\n');

    const [project] = await connection.execute(`
      INSERT INTO project (project_name, description, owner_id)
      VALUES (
        'Electric Vehicle Manufacturing',
        'Life Cycle Assessment comparing coal-powered vs renewable energy EV battery production',
        1
      )
    `);
    const projectId = project.insertId;
    console.log(`✓ Project created (ID: ${projectId})`);
    console.log(`  Name: Electric Vehicle Manufacturing`);
    console.log(`  Owner: User ID 1\\n`);

    // Add project owner to project_members
    await connection.execute(`
      INSERT INTO project_members (project_id, user_id, permission_id)
      VALUES (?, 1, 1)
    `, [projectId]);

    // ================================================================
    // CREATE CASE 1: BASELINE (COAL)
    // ================================================================
    console.log('='.repeat(80));
    console.log('Case 1: Baseline Production - Coal Grid');
    console.log('='.repeat(80) + '\n');

    const [case1] = await connection.execute(`
      INSERT INTO case_table (project_id, case_name, case_type, description)
      VALUES (?, 'Baseline Production - 2025', 'base',
              'Current manufacturing powered by coal-based electricity grid')
    `, [projectId]);
    const case1Id = case1.insertId;
    console.log(`✓ Case 1 created (ID: ${case1Id})\\n`);

    // LEVEL 1: Product
    const [prod1] = await connection.execute(`
      INSERT INTO component (
        case_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, 'EV Battery Pack (60 kWh)', 'product', 1, 1.0, 'unit',
                'Complete lithium-ion battery pack for electric vehicle')
    `, [case1Id]);
    const comp1_1 = prod1.insertId;
    console.log(`  Level 1 [PRODUCT]: EV Battery Pack (60 kWh)`);
    console.log(`    └─ ID: ${comp1_1}, Quantity: 1.0 unit\\n`);

    // LEVEL 2: Machine/Line
    const [mach1] = await connection.execute(`
      INSERT INTO component (
        case_id, parent_component_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, ?, 'Cell Assembly Line', 'machine_line', 2, 1.0, 'line',
                'Automated assembly line for battery cell manufacturing')
    `, [case1Id, comp1_1]);
    const comp1_2 = mach1.insertId;
    console.log(`  Level 2 [MACHINE/LINE]: Cell Assembly Line`);
    console.log(`    └─ ID: ${comp1_2}, Parent: ${comp1_1}\\n`);

    // LEVEL 3: Subprocess
    const [sub1] = await connection.execute(`
      INSERT INTO component (
        case_id, parent_component_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, ?, 'Electrode Coating Process', 'subprocess', 3, 1.0, 'batch',
                'Process for coating battery electrodes with active materials')
    `, [case1Id, comp1_2]);
    const comp1_3 = sub1.insertId;
    console.log(`  Level 3 [SUBPROCESS]: Electrode Coating Process`);
    console.log(`    └─ ID: ${comp1_3}, Parent: ${comp1_2}\\n`);

    // LEVEL 4: Operation
    const [op1] = await connection.execute(`
      INSERT INTO component (
        case_id, parent_component_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, ?, 'Drying Operation', 'operation', 4, 1.0, 'cycle',
                'High temperature drying of coated electrodes')
    `, [case1Id, comp1_3]);
    const comp1_4 = op1.insertId;
    console.log(`  Level 4 [OPERATION]: Drying Operation`);
    console.log(`    └─ ID: ${comp1_4}, Parent: ${comp1_3}\\n`);

    // LEVEL 5: Elemental Task
    const [task1] = await connection.execute(`
      INSERT INTO component (
        case_id, parent_component_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, ?, 'Oven Heating Task', 'elemental_task', 5, 1.0, 'task',
                'Electric heating in industrial oven - COAL POWERED')
    `, [case1Id, comp1_4]);
    const comp1_5 = task1.insertId;
    console.log(`  Level 5 [ELEMENTAL TASK]: Oven Heating Task`);
    console.log(`    └─ ID: ${comp1_5}, Parent: ${comp1_4}`);
    console.log(`    └─ This is where environmental flows are attached!\\n`);

    // FLOWS FOR CASE 1
    console.log(`  Environmental Flows (attached to component ${comp1_5}):`);

    await connection.execute(`
      INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
      VALUES (?, 7, 'input', 250.5, 'kWh', 1, 'Coal-based grid electricity consumption')
    `, [comp1_5]);
    console.log(`    ✓ INPUT:  Electricity = 250.5 kWh (coal grid)`);

    await connection.execute(`
      INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
      VALUES (?, 1, 'output', 125.25, 'kg', 1, 'CO2 emissions from coal electricity generation')
    `, [comp1_5]);
    console.log(`    ✓ OUTPUT: CO2 = 125.25 kg (HIGH - from coal)`);

    await connection.execute(`
      INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
      VALUES (?, 2, 'output', 2.5, 'kg', 1, 'Methane emissions from coal mining/combustion')
    `, [comp1_5]);
    console.log(`    ✓ OUTPUT: Methane = 2.5 kg`);

    await connection.execute(`
      INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
      VALUES (?, 8, 'input', 15.0, 'm³', 0, 'Process cooling water')
    `, [comp1_5]);
    console.log(`    ✓ INPUT:  Water = 15.0 m³\\n`);

    console.log(`✅ Case 1 complete: 5 components, 4 flows\\n`);

    // ================================================================
    // CREATE CASE 2: RENEWABLE ENERGY
    // ================================================================
    console.log('='.repeat(80));
    console.log('Case 2: Renewable Energy Scenario');
    console.log('='.repeat(80) + '\n');

    const [case2] = await connection.execute(`
      INSERT INTO case_table (project_id, case_name, case_type, parent_case_id, description)
      VALUES (?, 'Renewable Energy Scenario', 'comparative', ?,
              'Same manufacturing but powered by 100% renewable electricity (solar/wind)')
    `, [projectId, case1Id]);
    const case2Id = case2.insertId;
    console.log(`✓ Case 2 created (ID: ${case2Id}, Parent: ${case1Id})\\n`);

    // Same hierarchy for Case 2
    const [prod2] = await connection.execute(`
      INSERT INTO component (
        case_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, 'EV Battery Pack (60 kWh)', 'product', 1, 1.0, 'unit',
                'Complete lithium-ion battery pack - RENEWABLE ENERGY')
    `, [case2Id]);
    const comp2_1 = prod2.insertId;

    const [mach2] = await connection.execute(`
      INSERT INTO component (
        case_id, parent_component_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, ?, 'Cell Assembly Line', 'machine_line', 2, 1.0, 'line',
                'Assembly line powered by renewable energy')
    `, [case2Id, comp2_1]);
    const comp2_2 = mach2.insertId;

    const [sub2] = await connection.execute(`
      INSERT INTO component (
        case_id, parent_component_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, ?, 'Electrode Coating Process', 'subprocess', 3, 1.0, 'batch',
                'Coating process using renewable electricity')
    `, [case2Id, comp2_2]);
    const comp2_3 = sub2.insertId;

    const [op2] = await connection.execute(`
      INSERT INTO component (
        case_id, parent_component_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, ?, 'Drying Operation', 'operation', 4, 1.0, 'cycle',
                'Drying with renewable electricity')
    `, [case2Id, comp2_3]);
    const comp2_4 = op2.insertId;

    const [task2] = await connection.execute(`
      INSERT INTO component (
        case_id, parent_component_id, component_name, component_type, hierarchy_level,
        quantity, unit, description
      ) VALUES (?, ?, 'Oven Heating Task', 'elemental_task', 5, 1.0, 'task',
                'Electric heating in industrial oven - 100% RENEWABLE')
    `, [case2Id, comp2_4]);
    const comp2_5 = task2.insertId;

    console.log(`  Same 5-level hierarchy created for Case 2\\n`);

    // FLOWS FOR CASE 2 (96% REDUCTION!)
    console.log(`  Environmental Flows (attached to component ${comp2_5}):`);

    await connection.execute(`
      INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
      VALUES (?, 7, 'input', 250.5, 'kWh', 1, '100% renewable electricity (solar/wind)')
    `, [comp2_5]);
    console.log(`    ✓ INPUT:  Electricity = 250.5 kWh (SAME - renewable)`);

    await connection.execute(`
      INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
      VALUES (?, 1, 'output', 5.0, 'kg', 1, 'CO2 lifecycle emissions from renewable infrastructure')
    `, [comp2_5]);
    console.log(`    ✓ OUTPUT: CO2 = 5.0 kg (96% REDUCTION! 🌍)`);

    await connection.execute(`
      INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
      VALUES (?, 2, 'output', 0.1, 'kg', 1, 'Trace methane from renewable infrastructure')
    `, [comp2_5]);
    console.log(`    ✓ OUTPUT: Methane = 0.1 kg (96% reduction)`);

    await connection.execute(`
      INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description)
      VALUES (?, 8, 'input', 15.0, 'm³', 0, 'Process cooling water (same)')
    `, [comp2_5]);
    console.log(`    ✓ INPUT:  Water = 15.0 m³ (same)\\n`);

    console.log(`✅ Case 2 complete: 5 components, 4 flows\\n`);

    // ================================================================
    // ADD ABC COSTING DATA
    // ================================================================
    console.log('='.repeat(80));
    console.log('Adding ABC Costing Data');
    console.log('='.repeat(80) + '\n');

    const costingData = [
      { comp: comp1_1, capex: 50000, opex: 12000, labor: 8500, energy: 15000, transport: 3500, material: 25000, equipment: 18000, overhead: 9000 },
      { comp: comp1_5, capex: 5000, opex: 3200, labor: 2100, energy: 4500, transport: 800, material: 6500, equipment: 3800, overhead: 1900 },
      { comp: comp2_1, capex: 50000, opex: 9000, labor: 8500, energy: 12000, transport: 3500, material: 25000, equipment: 18000, overhead: 9000 },
      { comp: comp2_5, capex: 5000, opex: 2400, labor: 2100, energy: 3800, transport: 800, material: 6500, equipment: 3800, overhead: 1900 }
    ];

    for (const cost of costingData) {
      await connection.execute(`
        UPDATE component
        SET capex = ?, opex = ?, labor_cost = ?, energy_cost = ?,
            transportation_cost = ?, material_cost = ?, equipment_cost = ?,
            overhead_cost = ?, currency = 'USD'
        WHERE component_id = ?
      `, [cost.capex, cost.opex, cost.labor, cost.energy, cost.transport,
           cost.material, cost.equipment, cost.overhead, cost.comp]);
    }
    console.log(`✓ ABC costing added to 4 key components\\n`);

    // ================================================================
    // CREATE ASSESSMENT RUNS
    // ================================================================
    console.log('='.repeat(80));
    console.log('Creating Assessment Runs');
    console.log('='.repeat(80) + '\n');

    const [run1] = await connection.execute(`
      INSERT INTO assessment_runs (case_id, run_name, calculation_method, status, executed_by)
      VALUES (?, 'Q1 2025 Baseline Assessment', 'CML 2001', 'completed', 1)
    `, [case1Id]);
    const run1Id = run1.insertId;
    console.log(`✓ Assessment run created for Case 1 (Run ID: ${run1Id})`);

    const [run2] = await connection.execute(`
      INSERT INTO assessment_runs (case_id, run_name, calculation_method, status, executed_by)
      VALUES (?, 'Q1 2025 Renewable Assessment', 'CML 2001', 'completed', 1)
    `, [case2Id]);
    const run2Id = run2.insertId;
    console.log(`✓ Assessment run created for Case 2 (Run ID: ${run2Id})\\n`);

    // ================================================================
    // ADD ASSESSMENT RESULTS (ALL 8 IMPACT CATEGORIES)
    // ================================================================
    console.log('='.repeat(80));
    console.log('Adding Assessment Results (8 Impact Categories)');
    console.log('='.repeat(80) + '\n');

    // Case 1 - Coal Grid Results
    const case1Results = [
      { catId: 1, value: 125.25, unit: 'kg CO₂ eq', desc: 'Global Warming (CO2)' },
      { catId: 1, value: 70.00, unit: 'kg CO₂ eq', desc: 'Global Warming (CH4)' },
      { catId: 2, value: 0.0425, unit: 'kg CFC-11 eq', desc: 'Ozone Depletion' },
      { catId: 3, value: 87.675, unit: 'kg SO₂ eq', desc: 'Acidification' },
      { catId: 4, value: 16.275, unit: 'kg PO₄ eq', desc: 'Eutrophication' },
      { catId: 5, value: 3.50, unit: 'kg C₂H₄ eq', desc: 'Photochemical Oxidation' },
      { catId: 6, value: 0.85, unit: 'kg 1,4-DB eq', desc: 'Human Toxicity' },
      { catId: 7, value: 1.25, unit: 'kg 1,4-DB eq', desc: 'Ecotoxicity' },
      { catId: 8, value: 0.001353, unit: 'kg Sb eq', desc: 'Resource Depletion' }
    ];

    console.log(`Case 1 Results (Coal Grid):`);
    for (const result of case1Results) {
      await connection.execute(`
        INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit)
        VALUES (?, ?, ?, ?, ?)
      `, [run1Id, comp1_5, result.catId, result.value, result.unit]);
      console.log(`  ✓ ${result.desc}: ${result.value} ${result.unit}`);
    }
    console.log(`  📊 Total GWP: 195.25 kg CO₂ eq\\n`);

    // Case 2 - Renewable Energy Results
    const case2Results = [
      { catId: 1, value: 5.0, unit: 'kg CO₂ eq', desc: 'Global Warming (CO2)' },
      { catId: 1, value: 2.8, unit: 'kg CO₂ eq', desc: 'Global Warming (CH4)' },
      { catId: 2, value: 0.0017, unit: 'kg CFC-11 eq', desc: 'Ozone Depletion' },
      { catId: 3, value: 3.5, unit: 'kg SO₂ eq', desc: 'Acidification' },
      { catId: 4, value: 0.65, unit: 'kg PO₄ eq', desc: 'Eutrophication' },
      { catId: 5, value: 0.14, unit: 'kg C₂H₄ eq', desc: 'Photochemical Oxidation' },
      { catId: 6, value: 0.034, unit: 'kg 1,4-DB eq', desc: 'Human Toxicity' },
      { catId: 7, value: 0.050, unit: 'kg 1,4-DB eq', desc: 'Ecotoxicity' },
      { catId: 8, value: 0.000135, unit: 'kg Sb eq', desc: 'Resource Depletion' }
    ];

    console.log(`Case 2 Results (Renewable Energy):`);
    for (const result of case2Results) {
      await connection.execute(`
        INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit)
        VALUES (?, ?, ?, ?, ?)
      `, [run2Id, comp2_5, result.catId, result.value, result.unit]);
      console.log(`  ✓ ${result.desc}: ${result.value} ${result.unit}`);
    }
    const reduction = ((195.25 - 7.8) / 195.25 * 100).toFixed(1);
    console.log(`  📊 Total GWP: 7.8 kg CO₂ eq`);
    console.log(`  🌍 Reduction: ${reduction}%\\n`);

    // Commit transaction
    await connection.commit();
    console.log('='.repeat(80));
    console.log('✅ TRANSACTION COMMITTED - Project 1 created successfully!');
    console.log('='.repeat(80) + '\n');

    // Summary
    console.log('='.repeat(80));
    console.log('PROJECT 1 SUMMARY');
    console.log('='.repeat(80));
    console.log(`Project ID: ${projectId}`);
    console.log(`Total Cases: 2`);
    console.log(`Total Components: 10 (5 per case)`);
    console.log(`Total Flows: 8 (4 per case)`);
    console.log(`\\nEnvironmental Impact:`);
    console.log(`  Coal Grid (Case 1):     125.25 kg CO2`);
    console.log(`  Renewable (Case 2):     5.0 kg CO2`);
    console.log(`  Reduction:              120.25 kg CO2 (96.0%)`)
;
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    if (connection) {
      await connection.rollback();
      console.error('\n❌ ERROR - Transaction rolled back:', error.message);
    }
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed\n');
    }
  }
}

createProject1().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

const mysql = require('mysql2/promise');
require('dotenv').config({ path: '.env.local' });

const dbConfig = {
  host: process.env.DATABASE_HOST,
  port: process.env.DATABASE_PORT,
  user: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
};

async function createProject2() {
  let connection;
  try {
    console.log('\n' + '='.repeat(80));
    console.log('PROJECT 2: NUTROLEUM VS VASELINE - PETROLEUM JELLY MANUFACTURING');
    console.log('='.repeat(80) + '\n');

    connection = await mysql.createConnection(dbConfig);
    console.log('✅ Connected to database\n');
    await connection.beginTransaction();
    console.log('📝 Transaction started\n');

    // CREATE PROJECT
    const [project] = await connection.execute(`
      INSERT INTO project (project_name, description, owner_id)
      VALUES (
        'Nutroleum vs Vaseline - Petroleum Jelly Manufacturing',
        'LCA comparing plant-based Nutroleum against petroleum-based Vaseline jelly production',
        1
      )
    `);
    const projectId = project.insertId;
    console.log(`✓ Project created (ID: ${projectId})\n`);

    await connection.execute(`INSERT INTO project_members (project_id, user_id, permission_id) VALUES (?, 1, 1)`, [projectId]);

    // CASE 1: Nutroleum (Plant-Based)
    const [case1] = await connection.execute(`
      INSERT INTO case_table (project_id, case_name, case_type, description)
      VALUES (?, 'Nutroleum - Plant-Based Jelly', 'base',
              'Plant-based petroleum jelly alternative using vegetable oils')
    `, [projectId]);
    const case1Id = case1.insertId;
    console.log('='.repeat(80));
    console.log(`Case 1: Nutroleum (Plant-Based) - ID: ${case1Id}`);
    console.log('='.repeat(80) + '\n');

    // Level 1-5 for Case 1
    const [p1] = await connection.execute(`INSERT INTO component (case_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES (?, 'Nutroleum Jar (3 oz)', 'product', 1, 1.0, 'unit', 'Plant-based petroleum jelly alternative')`, [case1Id]);
    const c1_1 = p1.insertId;
    console.log(`  Level 1 [PRODUCT]: Nutroleum Jar (3 oz) - ID: ${c1_1}`);

    const [m1] = await connection.execute(`INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES (?, ?, 'Manufacturing Line', 'machine_line', 2, 1.0, 'line', 'Automated jelly production line')`, [case1Id, c1_1]);
    const c1_2 = m1.insertId;
    console.log(`  Level 2 [MACHINE/LINE]: Manufacturing Line - ID: ${c1_2}`);

    const [s1] = await connection.execute(`INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES (?, ?, 'Mixing & Heating Process', 'subprocess', 3, 1.0, 'batch', 'Mixing vegetable oils and heating')`, [case1Id, c1_2]);
    const c1_3 = s1.insertId;
    console.log(`  Level 3 [SUBPROCESS]: Mixing & Heating Process - ID: ${c1_3}`);

    const [o1] = await connection.execute(`INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES (?, ?, 'Blending Operation', 'operation', 4, 1.0, 'cycle', 'Blend oils to correct consistency')`, [case1Id, c1_3]);
    const c1_4 = o1.insertId;
    console.log(`  Level 4 [OPERATION]: Blending Operation - ID: ${c1_4}`);

    const [t1] = await connection.execute(`INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES (?, ?, 'Heat & Mix Task', 'elemental_task', 5, 1.0, 'task', 'Heat vegetable oils with mixing - PLANT BASED')`, [case1Id, c1_4]);
    const c1_5 = t1.insertId;
    console.log(`  Level 5 [ELEMENTAL TASK]: Heat & Mix Task - ID: ${c1_5}\n`);

    // Flows for Case 1
    await connection.execute(`INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES (?, 7, 'input', 12.5, 'kWh', 1, 'Electricity for heating and mixing')`, [c1_5]);
    await connection.execute(`INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES (?, 1, 'output', 8.5, 'kg', 1, 'CO2 from plant-based oil processing')`, [c1_5]);
    await connection.execute(`INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES (?, 8, 'input', 2.0, 'm³', 0, 'Cooling water')`, [c1_5]);
    await connection.execute(`INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES (?, 9, 'input', 85.0, 'g', 1, 'Plant-based oils (soy, coconut)')`, [c1_5]);
    console.log(`  ✓ 4 flows added: Electricity=12.5kWh, CO2=8.5kg, Water=2.0m³, Oils=85g\n`);

    // CASE 2: Vaseline (Petroleum-Based)
    const [case2] = await connection.execute(`
      INSERT INTO case_table (project_id, case_name, case_type, parent_case_id, description)
      VALUES (?, 'Vaseline - Petroleum Jelly', 'comparative', ?,
              'Traditional petroleum-based jelly from crude oil derivatives')
    `, [projectId, case1Id]);
    const case2Id = case2.insertId;
    console.log('='.repeat(80));
    console.log(`Case 2: Vaseline (Petroleum-Based) - ID: ${case2Id}`);
    console.log('='.repeat(80) + '\n');

    // Level 1-5 for Case 2
    const [p2] = await connection.execute(`INSERT INTO component (case_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES (?, 'Vaseline Jar (3 oz)', 'product', 1, 1.0, 'unit', 'Petroleum-based jelly')`, [case2Id]);
    const c2_1 = p2.insertId;
    const [m2] = await connection.execute(`INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES (?, ?, 'Manufacturing Line', 'machine_line', 2, 1.0, 'line', 'Petroleum processing line')`, [case2Id, c2_1]);
    const c2_2 = m2.insertId;
    const [s2] = await connection.execute(`INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES (?, ?, 'Mixing & Heating Process', 'subprocess', 3, 1.0, 'batch', 'Refining petroleum derivatives')`, [case2Id, c2_2]);
    const c2_3 = s2.insertId;
    const [o2] = await connection.execute(`INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES (?, ?, 'Blending Operation', 'operation', 4, 1.0, 'cycle', 'Blend petroleum derivatives')`, [case2Id, c2_3]);
    const c2_4 = o2.insertId;
    const [t2] = await connection.execute(`INSERT INTO component (case_id, parent_component_id, component_name, component_type, hierarchy_level, quantity, unit, description) VALUES (?, ?, 'Heat & Mix Task', 'elemental_task', 5, 1.0, 'task', 'Process petroleum - HIGH EMISSIONS')`, [case2Id, c2_4]);
    const c2_5 = t2.insertId;
    console.log(`  Same 5-level hierarchy - ID: ${c2_1} to ${c2_5}\n`);

    // Flows for Case 2 (HIGHER EMISSIONS)
    await connection.execute(`INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES (?, 7, 'input', 18.5, 'kWh', 1, 'Energy for petroleum refining')`, [c2_5]);
    await connection.execute(`INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES (?, 1, 'output', 45.2, 'kg', 1, 'CO2 from petroleum processing - MUCH HIGHER!')`, [c2_5]);
    await connection.execute(`INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES (?, 8, 'input', 2.0, 'm³', 0, 'Cooling water')`, [c2_5]);
    await connection.execute(`INSERT INTO flows (component_id, substance_id, flow_type, quantity, unit, is_driver, driver_description) VALUES (?, 9, 'input', 85.0, 'g', 1, 'Petroleum derivatives (crude oil)')`, [c2_5]);
    console.log(`  ✓ 4 flows added: Electricity=18.5kWh, CO2=45.2kg (431% MORE!)\n`);

    // ABC COSTING
    console.log('Adding ABC Costing...');
    const costs = [
      {comp: c1_1, capex: 15000, opex: 5000, labor: 3500, energy: 2200, trans: 1200, mat: 8500, equip: 6000, oh: 2800},
      {comp: c1_5, capex: 3000, opex: 1200, labor: 850, energy: 550, trans: 280, mat: 2100, equip: 1400, oh: 680},
      {comp: c2_1, capex: 25000, opex: 8500, labor: 3500, energy: 4200, trans: 1500, mat: 12000, equip: 8500, oh: 4200},
      {comp: c2_5, capex: 5500, opex: 2100, labor: 850, energy: 1200, trans: 350, mat: 3500, equip: 2400, oh: 1100}
    ];
    for (const cost of costs) {
      await connection.execute(`UPDATE component SET capex=?, opex=?, labor_cost=?, energy_cost=?, transportation_cost=?, material_cost=?, equipment_cost=?, overhead_cost=?, currency='USD' WHERE component_id=?`,
        [cost.capex, cost.opex, cost.labor, cost.energy, cost.trans, cost.mat, cost.equip, cost.oh, cost.comp]);
    }
    console.log('✓ ABC costing added\n');

    // ASSESSMENT RUNS
    const [run1] = await connection.execute(`INSERT INTO assessment_runs (case_id, run_name, calculation_method, status, executed_by) VALUES (?, 'Q1 2025 Nutroleum Assessment', 'CML 2001', 'completed', 1)`, [case1Id]);
    const r1 = run1.insertId;
    const [run2] = await connection.execute(`INSERT INTO assessment_runs (case_id, run_name, calculation_method, status, executed_by) VALUES (?, 'Q1 2025 Vaseline Assessment', 'CML 2001', 'completed', 1)`, [case2Id]);
    const r2 = run2.insertId;
    console.log(`✓ Assessment runs created (${r1}, ${r2})\n`);

    // ASSESSMENT RESULTS
    console.log('Adding Assessment Results...');
    const c1Res = [{cat:1,v:8.5,u:'kg CO₂ eq'},{cat:2,v:0.0000005,u:'kg CFC-11 eq'},{cat:3,v:0.042,u:'kg SO₂ eq'},{cat:4,v:0.018,u:'kg PO₄ eq'},{cat:5,v:0.012,u:'kg C₂H₄ eq'},{cat:6,v:0.28,u:'kg 1,4-DB eq'},{cat:7,v:0.35,u:'kg 1,4-DB eq'},{cat:8,v:0.015,u:'kg Sb eq'}];
    const c2Res = [{cat:1,v:45.2,u:'kg CO₂ eq'},{cat:2,v:0.000008,u:'kg CFC-11 eq'},{cat:3,v:0.285,u:'kg SO₂ eq'},{cat:4,v:0.092,u:'kg PO₄ eq'},{cat:5,v:0.068,u:'kg C₂H₄ eq'},{cat:6,v:1.85,u:'kg 1,4-DB eq'},{cat:7,v:2.15,u:'kg 1,4-DB eq'},{cat:8,v:0.125,u:'kg Sb eq'}];
    
    for (const r of c1Res) await connection.execute(`INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES (?,?,?,?,?)`, [r1, c1_5, r.cat, r.v, r.u]);
    for (const r of c2Res) await connection.execute(`INSERT INTO assessment_results (run_id, component_id, category_id, impact_value, unit) VALUES (?,?,?,?,?)`, [r2, c2_5, r.cat, r.v, r.u]);
    
    const reduction = ((45.2-8.5)/45.2*100).toFixed(1);
    console.log(`✓ All 8 impact categories added for both cases`);
    console.log(`  Nutroleum: 8.5 kg CO2`);
    console.log(`  Vaseline: 45.2 kg CO2`);
    console.log(`  🌱 Plant-based reduces CO2 by ${reduction}%!\n`);

    await connection.commit();
    console.log('='.repeat(80));
    console.log('✅ PROJECT 2 COMPLETE!');
    console.log('='.repeat(80) + '\n');

  } catch (error) {
    if (connection) await connection.rollback();
    console.error('❌ ERROR:', error.message);
    process.exit(1);
  } finally {
    if (connection) await connection.end();
    console.log('🔌 Connection closed\n');
  }
}

createProject2().catch(console.error);

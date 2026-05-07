const mysql = require('mysql2/promise');

async function testAssessment() {
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'lcaadmin',
    password: 'EP76017fLefZ8?d!ezTHsN[kA()X',
    database: 'lca_v3'
  });

  try {
    console.log('🧪 Testing LCA Assessment Engine\n');
    console.log('═══════════════════════════════════════════════════════════\n');

    // Step 1: Get all components with flows
    console.log('📋 Step 1: Components with Environmental Flows\n');
    const [components] = await connection.query(`
      SELECT
        c.component_id,
        c.component_name,
        c.component_type,
        COUNT(DISTINCT f.flow_id) as total_flows,
        COUNT(DISTINCT CASE WHEN f.is_driver = 1 THEN f.flow_id END) as driver_flows
      FROM component c
      INNER JOIN flows f ON c.component_id = f.component_id
      WHERE c.case_id = 1
      GROUP BY c.component_id, c.component_name, c.component_type
      ORDER BY c.component_id
    `);

    components.forEach(comp => {
      console.log(`  ✓ ${comp.component_name} (${comp.component_type})`);
      console.log(`    Total: ${comp.total_flows} flows | Drivers: ${comp.driver_flows}\n`);
    });

    // Step 2: Preview impact calculations
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('🔬 Step 2: Preview Impact Calculations\n');

    const [impactPreview] = await connection.query(`
      SELECT
        c.component_name,
        s.substance_name,
        f.quantity,
        f.unit,
        ic.category_name,
        dif.factor_value as characterization_factor,
        (f.quantity * dif.factor_value) as calculated_impact,
        ic.unit as impact_unit
      FROM flows f
      INNER JOIN component c ON f.component_id = c.component_id
      INNER JOIN substances s ON f.substance_id = s.substance_id
      INNER JOIN driver_impact_factors dif ON s.substance_id = dif.substance_id
      INNER JOIN impact_categories ic ON dif.category_id = ic.category_id
      WHERE f.is_driver = 1 AND c.case_id = 1
      ORDER BY ic.category_name, c.component_id
    `);

    let currentCategory = '';
    impactPreview.forEach(row => {
      if (row.category_name !== currentCategory) {
        if (currentCategory !== '') console.log('');
        console.log(`  📊 ${row.category_name}:`);
        currentCategory = row.category_name;
      }
      console.log(`     ${row.component_name}:`);
      const calcImpact = (row.calculated_impact !== null && row.calculated_impact !== undefined) ? row.calculated_impact.toFixed(4) : 'NULL';
      const charFactor = (row.characterization_factor !== null && row.characterization_factor !== undefined) ? row.characterization_factor : 'NULL';
      console.log(`       ${row.substance_name}: ${row.quantity} ${row.unit} × ${charFactor} = ${calcImpact} ${row.impact_unit}`);
    });

    // Step 3: Calculate totals by category
    console.log('\n═══════════════════════════════════════════════════════════\n');
    console.log('📈 Step 3: Total Impacts by Category\n');

    const [categoryTotals] = await connection.query(`
      SELECT
        ic.category_name,
        SUM(f.quantity * dif.factor_value) as total_impact,
        ic.unit,
        COUNT(DISTINCT f.component_id) as component_count,
        COUNT(f.flow_id) as flow_count
      FROM flows f
      INNER JOIN component c ON f.component_id = c.component_id
      INNER JOIN substances s ON f.substance_id = s.substance_id
      INNER JOIN driver_impact_factors dif ON s.substance_id = dif.substance_id
      INNER JOIN impact_categories ic ON dif.category_id = ic.category_id
      WHERE f.is_driver = 1 AND c.case_id = 1
      GROUP BY ic.category_id, ic.category_name, ic.unit
      ORDER BY total_impact DESC
    `);

    categoryTotals.forEach(cat => {
      console.log(`  ${cat.category_name}:`);
      console.log(`    Total: ${cat.total_impact.toFixed(4)} ${cat.unit}`);
      console.log(`    Components: ${cat.component_count} | Flows: ${cat.flow_count}\n`);
    });

    // Step 4: Check existing assessment runs
    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('📁 Step 4: Existing Assessment Runs\n');

    const [existingRuns] = await connection.query(`
      SELECT
        run_id,
        run_name,
        status,
        calculation_method,
        run_date
      FROM assessment_runs
      WHERE case_id = 1
      ORDER BY run_date DESC
      LIMIT 5
    `);

    if (existingRuns.length === 0) {
      console.log('  No previous assessment runs found.\n');
    } else {
      existingRuns.forEach(run => {
        console.log(`  Run ${run.run_id}: ${run.run_name}`);
        console.log(`    Status: ${run.status} | Method: ${run.calculation_method}`);
        console.log(`    Date: ${new Date(run.run_date).toLocaleString()}\n`);
      });
    }

    console.log('═══════════════════════════════════════════════════════════\n');
    console.log('✅ Assessment engine test complete!\n');
    console.log('💡 Ready to run assessment via API at:');
    console.log('   POST http://localhost:3002/api/cases/1/assessments\n');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error);
  } finally {
    await connection.end();
  }
}

testAssessment().catch(console.error);

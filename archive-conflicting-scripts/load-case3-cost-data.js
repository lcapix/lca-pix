/**
 * Load ABC Cost Data for Case 3
 * Populates cost data for components in case_id = 3
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function loadCase3CostData() {
  console.log('🚀 Loading Cost Data for Case 3...\n');

  // Load .env.local
  require('dotenv').config({ path: path.join(__dirname, '.env.local') });

  // Database connection config
  const config = {
    host: process.env.DATABASE_HOST || '127.0.0.1',
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    user: process.env.DATABASE_USER || 'lcaadmin',
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME || 'lca_v3',
    multipleStatements: true
  };

  let connection;

  try {
    // Read SQL file
    const sqlPath = path.join(__dirname, 'add-case3-cost-data.sql');
    console.log(`📄 Reading SQL file: ${sqlPath}`);

    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL file not found: ${sqlPath}`);
    }

    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Connect to database
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to database\n');

    // Execute SQL
    console.log('⚙️  Updating Case 3 components with cost data...\n');
    await connection.query(sql);

    console.log('✅ SQL executed successfully!\n');

    // Verify the updates
    console.log('🔍 Verifying updated components...');
    const [components] = await connection.query(`
      SELECT
        component_id,
        component_name,
        component_type,
        labor_cost,
        energy_cost,
        transportation_cost,
        material_cost,
        equipment_cost,
        overhead_cost,
        (labor_cost + energy_cost + transportation_cost +
         material_cost + equipment_cost + overhead_cost) as breakdown_total,
        opex,
        capex,
        currency
      FROM component
      WHERE case_id = 3
      ORDER BY component_id
    `);

    console.log(`\n📊 Updated ${components.length} components in Case 3:\n`);

    components.forEach((comp, idx) => {
      const laborCost = parseFloat(comp.labor_cost || 0);
      const energyCost = parseFloat(comp.energy_cost || 0);
      const transportationCost = parseFloat(comp.transportation_cost || 0);
      const materialCost = parseFloat(comp.material_cost || 0);
      const equipmentCost = parseFloat(comp.equipment_cost || 0);
      const overheadCost = parseFloat(comp.overhead_cost || 0);
      const total = laborCost + energyCost + transportationCost + materialCost + equipmentCost + overheadCost;

      console.log(`${idx + 1}. ${comp.component_name} (${comp.component_type})`);
      console.log(`   Labor: $${laborCost.toFixed(2)}`);
      console.log(`   Energy: $${energyCost.toFixed(2)}`);
      console.log(`   Transportation: $${transportationCost.toFixed(2)}`);
      console.log(`   Material: $${materialCost.toFixed(2)}`);
      console.log(`   Equipment: $${equipmentCost.toFixed(2)}`);
      console.log(`   Overhead: $${overheadCost.toFixed(2)}`);
      console.log(`   Breakdown Total: $${total.toFixed(2)}`);
      console.log(`   OpEx: $${parseFloat(comp.opex || 0).toFixed(2)}`);
      console.log(`   CapEx: $${parseFloat(comp.capex || 0).toFixed(2)}`);
      console.log(`   Currency: ${comp.currency}`);
      console.log('');
    });

    console.log('🎉 Case 3 Cost Data Loading Complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Refresh the page: http://localhost:3002/project/1/case/3/');
    console.log('   2. Click Edit on any component');
    console.log('   3. Go to "Costs" tab');
    console.log('   4. Verify cost data now displays correctly\n');

  } catch (error) {
    console.error('❌ Failed to load cost data:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Cannot connect to database');
      console.error('   - Check if DATABASE_HOST and DATABASE_PORT are correct in .env.local\n');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Tip: Database authentication failed');
      console.error('   - Check DATABASE_PASSWORD in .env.local\n');
    } else if (error.code === 'ENOENT') {
      console.error('\n💡 SQL file not found');
      console.error('   - Check that add-case3-cost-data.sql exists\n');
    } else {
      console.error('\n💡 SQL Error:', error.sqlMessage || error.message);
    }

    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the script
loadCase3CostData();

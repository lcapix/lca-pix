/**
 * Load ABC Cost Data for Case 1
 * Populates cost data for components in case_id = 1 (Baseline Production)
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function loadCase1CostData() {
  console.log('🚀 Loading Cost Data for Case 1 (Baseline Production)...\n');

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
    const sqlPath = path.join(__dirname, 'add-case1-cost-data.sql');
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
    console.log('⚙️  Updating Case 1 components with cost data...\n');
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
      WHERE case_id = 1
      ORDER BY component_id
    `);

    console.log(`\n📊 Updated ${components.length} components in Case 1:\n`);

    components.forEach((comp, idx) => {
      const laborCost = parseFloat(comp.labor_cost || 0);
      const energyCost = parseFloat(comp.energy_cost || 0);
      const transportationCost = parseFloat(comp.transportation_cost || 0);
      const materialCost = parseFloat(comp.material_cost || 0);
      const equipmentCost = parseFloat(comp.equipment_cost || 0);
      const overheadCost = parseFloat(comp.overhead_cost || 0);
      const total = laborCost + energyCost + transportationCost + materialCost + equipmentCost + overheadCost;

      console.log(`${idx + 1}. ${comp.component_name} (${comp.component_type})`);
      console.log(`   ID: ${comp.component_id}`);
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

    console.log('🎉 Case 1 Cost Data Loading Complete!\n');
    console.log('✅ You can now test at: http://localhost:3002/project/1/case/1/\n');

  } catch (error) {
    console.error('❌ Failed to load cost data:', error.message);
    console.error('\n💡 SQL Error:', error.sqlMessage || error.message);
    console.error('\n🔧 Make sure:');
    console.error('   1. MySQL/Database is running');
    console.error('   2. .env.local has correct DATABASE_* credentials');
    console.error('   3. You can connect via: mysql -h HOST -u USER -p DATABASE_NAME');
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('🔌 Database connection closed');
    }
  }
}

// Run the script
loadCase1CostData();

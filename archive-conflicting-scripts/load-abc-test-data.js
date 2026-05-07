/**
 * ABC Costing Test Data Loader
 * Loads sample ABC cost data for testing
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function loadTestData() {
  console.log('🚀 Loading ABC Costing Test Data...\n');

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
    // Read test data file
    const testDataPath = path.join(__dirname, 'add-abc-cost-test-data-fixed.sql');
    console.log(`📄 Reading test data file: ${testDataPath}`);

    if (!fs.existsSync(testDataPath)) {
      throw new Error(`Test data file not found: ${testDataPath}`);
    }

    const testDataSQL = fs.readFileSync(testDataPath, 'utf8');

    // Connect to database
    console.log('🔌 Connecting to database...');
    connection = await mysql.createConnection(config);
    console.log('✅ Connected to database\n');

    // Execute test data SQL
    console.log('⚙️  Loading test data...\n');
    await connection.query(testDataSQL);

    console.log('✅ Test data loaded successfully!\n');

    // Verify test data
    console.log('🔍 Verifying loaded test data...');
    const [components] = await connection.query(`
      SELECT
        component_id,
        component_name,
        component_type,
        labor_cost_usd,
        energy_cost_usd,
        transportation_cost_usd,
        material_cost_usd,
        equipment_cost_usd,
        overhead_cost_usd,
        opex,
        cost_allocation_type
      FROM component
      WHERE labor_cost_usd IS NOT NULL
      ORDER BY component_type, component_id
    `);

    console.log(`\n📊 Loaded ${components.length} components with ABC cost data:\n`);

    components.forEach((comp, idx) => {
      const total = (
        (parseFloat(comp.labor_cost_usd) || 0) +
        (parseFloat(comp.energy_cost_usd) || 0) +
        (parseFloat(comp.transportation_cost_usd) || 0) +
        (parseFloat(comp.material_cost_usd) || 0) +
        (parseFloat(comp.equipment_cost_usd) || 0) +
        (parseFloat(comp.overhead_cost_usd) || 0)
      );

      console.log(`${idx + 1}. ${comp.component_name} (${comp.component_type})`);
      console.log(`   Labor: $${parseFloat(comp.labor_cost_usd || 0).toFixed(2)}`);
      console.log(`   Energy: $${parseFloat(comp.energy_cost_usd || 0).toFixed(2)}`);
      console.log(`   Transportation: $${parseFloat(comp.transportation_cost_usd || 0).toFixed(2)}`);
      console.log(`   Material: $${parseFloat(comp.material_cost_usd || 0).toFixed(2)}`);
      console.log(`   Equipment: $${parseFloat(comp.equipment_cost_usd || 0).toFixed(2)}`);
      console.log(`   Overhead: $${parseFloat(comp.overhead_cost_usd || 0).toFixed(2)}`);
      console.log(`   Breakdown Total: $${total.toFixed(2)}`);
      console.log(`   OpEx: $${parseFloat(comp.opex || 0).toFixed(2)}`);
      console.log(`   Allocation: ${comp.cost_allocation_type}`);
      console.log('');
    });

    console.log('🎉 Test Data Loading Complete!\n');
    console.log('📝 Next steps:');
    console.log('   1. Restart development server: npm run dev');
    console.log('   2. Navigate to a case page');
    console.log('   3. Edit one of the components with cost data');
    console.log('   4. Click "Costs" tab to see the ABC cost breakdown\n');

  } catch (error) {
    console.error('❌ Test data loading failed:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Cannot connect to database');
      console.error('   - Check if DATABASE_HOST and DATABASE_PORT are correct in .env.local\n');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Tip: Database authentication failed');
      console.error('   - Check DATABASE_PASSWORD in .env.local\n');
    } else if (error.code === 'ENOENT') {
      console.error('\n💡 Test data file not found');
      console.error('   - Check that add-abc-cost-test-data.sql exists\n');
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

// Run test data loader
loadTestData();

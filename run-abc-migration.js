/**
 * ABC Costing Migration Runner
 * Runs the 003_abc_cost_breakdown.sql migration
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runABCMigration() {
  console.log('🚀 Starting ABC Costing Migration...\n');

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
    // Read migration file
    const migrationPath = path.join(__dirname, 'database', 'migrations', '003_abc_cost_breakdown.sql');
    console.log(`📄 Reading migration file: ${migrationPath}`);

    if (!fs.existsSync(migrationPath)) {
      throw new Error(`Migration file not found: ${migrationPath}`);
    }

    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Connect to database
    console.log('🔌 Connecting to database...');
    console.log(`   Host: ${config.host}:${config.port}`);
    console.log(`   Database: ${config.database}`);
    console.log(`   User: ${config.user}\n`);

    connection = await mysql.createConnection(config);
    console.log('✅ Connected to database\n');

    // Execute migration
    console.log('⚙️  Executing ABC Costing migration SQL...\n');
    await connection.query(migrationSQL);

    console.log('✅ Migration executed successfully!\n');

    // Verify columns were added
    console.log('🔍 Verifying new columns in component table...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${config.database}'
        AND TABLE_NAME = 'component'
        AND COLUMN_NAME IN (
          'labor_cost_usd',
          'energy_cost_usd',
          'transportation_cost_usd',
          'material_cost_usd',
          'equipment_cost_usd',
          'overhead_cost_usd',
          'cost_allocation_type'
        )
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\n📊 ABC Cost Columns Added:');
    columns.forEach(col => {
      console.log(`   ✓ ${col.COLUMN_NAME} (${col.COLUMN_TYPE}) - ${col.COLUMN_COMMENT || 'No comment'}`);
    });

    // Verify index was created
    console.log('\n🔍 Verifying index...');
    const [indexes] = await connection.query(`
      SHOW INDEX FROM component WHERE Key_name = 'idx_component_costs'
    `);

    if (indexes.length > 0) {
      console.log('   ✓ idx_component_costs index created successfully');
    } else {
      console.log('   ⚠️  Index not found (might be OK if it already existed)');
    }

    // Check existing data
    console.log('\n📈 Component table statistics:');
    const [stats] = await connection.query(`
      SELECT
        COUNT(*) as total_components,
        COUNT(labor_cost_usd) as components_with_labor_cost,
        COUNT(opex) as components_with_opex
      FROM component
    `);

    console.log(`   Total components: ${stats[0].total_components}`);
    console.log(`   Components with labor cost: ${stats[0].components_with_labor_cost}`);
    console.log(`   Components with OpEx: ${stats[0].components_with_opex}`);

    console.log('\n🎉 ABC Costing Migration Complete!');
    console.log('\n✨ You can now use ABC costing features in the application.\n');
    console.log('📝 Next steps:');
    console.log('   1. Optional: Load test data with add-abc-cost-test-data.sql');
    console.log('   2. Restart development server: npm run dev');
    console.log('   3. Test the Costs tab in component editing\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Cannot connect to database');
      console.error('   - Check if DATABASE_HOST and DATABASE_PORT are correct in .env.local');
      console.error('   - If using SSH tunnel, make sure it\'s running\n');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Tip: Database authentication failed');
      console.error('   - Check DATABASE_PASSWORD in .env.local\n');
    } else if (error.code === 'ER_DUP_FIELDNAME' || error.sqlMessage?.includes('Duplicate column')) {
      console.error('\n💡 Columns already exist - migration was already run!');
      console.error('   This is OK, you can proceed to testing.\n');
      process.exit(0); // Exit successfully
    } else if (error.code === 'ENOENT') {
      console.error('\n💡 Migration file not found');
      console.error('   - Check that database/migrations/003_abc_cost_breakdown.sql exists\n');
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

// Run migration
runABCMigration();

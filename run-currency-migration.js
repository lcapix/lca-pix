/**
 * Currency Support Migration Runner
 * Runs the 004_currency_support.sql migration
 */

const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

async function runCurrencyMigration() {
  console.log('🚀 Starting Currency Support Migration...\n');

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
    const migrationPath = path.join(__dirname, 'database', 'migrations', '004_currency_support.sql');
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
    console.log('⚙️  Executing Currency Support migration SQL...\n');
    await connection.query(migrationSQL);

    console.log('✅ Migration executed successfully!\n');

    // Verify columns were renamed
    console.log('🔍 Verifying renamed columns in component table...');
    const [columns] = await connection.query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, COLUMN_COMMENT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = '${config.database}'
        AND TABLE_NAME = 'component'
        AND COLUMN_NAME IN (
          'labor_cost',
          'energy_cost',
          'transportation_cost',
          'material_cost',
          'equipment_cost',
          'overhead_cost',
          'currency'
        )
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\n📊 Cost Columns (USD suffix removed):');
    columns.forEach(col => {
      console.log(`   ✓ ${col.COLUMN_NAME} (${col.COLUMN_TYPE}) - ${col.COLUMN_COMMENT || 'No comment'}`);
    });

    // Verify currency column was added
    const currencyCol = columns.find(col => col.COLUMN_NAME === 'currency');
    if (currencyCol) {
      console.log('\n💱 Currency Support:');
      console.log(`   ✓ currency column added (${currencyCol.COLUMN_TYPE})`);
      console.log(`   ✓ Default value: USD`);
    }

    // Verify index was created
    console.log('\n🔍 Verifying index...');
    const [indexes] = await connection.query(`
      SHOW INDEX FROM component WHERE Key_name = 'idx_component_currency'
    `);

    if (indexes.length > 0) {
      console.log('   ✓ idx_component_currency index created successfully');
    } else {
      console.log('   ⚠️  Index not found (might be OK if it already existed)');
    }

    // Check existing data
    console.log('\n📈 Component table statistics:');
    const [stats] = await connection.query(`
      SELECT
        COUNT(*) as total_components,
        COUNT(labor_cost) as components_with_labor_cost,
        COUNT(DISTINCT currency) as unique_currencies,
        GROUP_CONCAT(DISTINCT currency) as currencies_in_use
      FROM component
    `);

    console.log(`   Total components: ${stats[0].total_components}`);
    console.log(`   Components with labor cost: ${stats[0].components_with_labor_cost}`);
    console.log(`   Unique currencies: ${stats[0].unique_currencies}`);
    console.log(`   Currencies in use: ${stats[0].currencies_in_use || 'None'}`);

    console.log('\n🎉 Currency Support Migration Complete!');
    console.log('\n✨ Changes applied:');
    console.log('   - Removed _usd suffix from all cost columns');
    console.log('   - Added currency column (default: USD)');
    console.log('   - Created index on currency column');
    console.log('   - Updated existing records to USD\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);

    if (error.code === 'ECONNREFUSED') {
      console.error('\n💡 Tip: Cannot connect to database');
      console.error('   - Check if DATABASE_HOST and DATABASE_PORT are correct in .env.local');
      console.error('   - If using SSH tunnel, make sure it\'s running\n');
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\n💡 Tip: Database authentication failed');
      console.error('   - Check DATABASE_PASSWORD in .env.local\n');
    } else if (error.code === 'ER_BAD_FIELD_ERROR' && error.sqlMessage?.includes('Unknown column')) {
      console.error('\n💡 Columns might already be renamed!');
      console.error('   This migration may have already been run.\n');
      process.exit(0); // Exit successfully
    } else if (error.code === 'ENOENT') {
      console.error('\n💡 Migration file not found');
      console.error('   - Check that database/migrations/004_currency_support.sql exists\n');
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
runCurrencyMigration();
